---
title: "Matchers and multiple chains"
sidebar_label: "6 · Matchers and multiple chains"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against the Spring Security reference — *Architecture*
> (docs.spring.io/spring-security/reference/servlet/architecture.html — "Only
> the first `SecurityFilterChain` that matches is invoked", `RequestMatcher`)
> and *Authorize HTTP Requests*
> (docs.spring.io/spring-security/reference/servlet/authorization/authorize-http-requests.html).
> Spring Boot 4.1.0, Spring Security 7.x, JDK 25.

**There are two matchers in play and confusing them is the single most expensive
mistake in Spring Security configuration. `securityMatcher` decides *which chain
handles the request*; `requestMatchers` decides *what the rules are inside that
chain*. The first is a routing decision made once per request; the second is a
policy evaluated within the chain that won.**

## The two levels, side by side

```java
@Bean
@Order(1)
SecurityFilterChain apiChain(HttpSecurity http) throws Exception {
    return http
        .securityMatcher("/api/**")                       // ← LEVEL 1: does this chain apply?
        .authorizeHttpRequests(auth -> auth
            .requestMatchers(HttpMethod.GET, "/api/products/**").permitAll()  // ← LEVEL 2
            .anyRequest().authenticated()
        )
        .oauth2ResourceServer(o -> o.jwt(Customizer.withDefaults()))
        .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        .csrf(CsrfConfigurer::disable)
        .build();
}

@Bean
@Order(2)
SecurityFilterChain webChain(HttpSecurity http) throws Exception {
    return http                                           // no securityMatcher → catch-all
        .authorizeHttpRequests(auth -> auth
            .requestMatchers("/", "/login", "/css/**").permitAll()
            .anyRequest().authenticated()
        )
        .formLogin(Customizer.withDefaults())
        .build();
}
```

That pair is the canonical SPA-plus-API shape: a stateless bearer-token chain
with CSRF off for `/api/**`, and a session-based chain with CSRF on and form
login for everything else. The two decisions in [chunk 13](13-csrf-decisions.md)
— when disabling CSRF is correct and when it is reckless — are exactly why the
split exists.

## Why the split matters more than it looks

A single chain can only have one answer to questions that are properly
per-audience: is there a session, is CSRF enforced, what does an unauthenticated
request get back (a 401, or a redirect to `/login`?), which authentication
filters run. A browser page and a machine client want opposite answers to all
four. Trying to serve both from one chain is where configurations become
conditional, unreadable, and quietly wrong.

## Ordering, and the failure it causes

Recall the rule from [chunk 1](01-one-filter-three-objects.md): **only the first
matching chain runs, in bean order, and rules do not merge across chains.**

Two things follow.

**Never leave chain order implicit.** Without `@Order`, it depends on bean
definition order, which depends on configuration-class processing order, which
changes when someone moves a `@Bean` method. Annotate every chain, and space the
values (10, 20, 30) so one can be inserted later without renumbering.

**The catch-all chain goes last and has no `securityMatcher`.** Every chain
before it must be narrow. If the first chain has no matcher, it swallows every
request and every later chain is dead code that compiles, starts and never runs
— with no warning of any kind.

The reference's own example is worth restating because the asymmetry surprises
people: a request to `/api/messages/` matches a `/api/**` chain *and* a broader
one declared later. It does not get the union of their rules, and it does not
get the more specific one because it is more specific. It gets the first one.

## Matcher forms

`requestMatchers` accepts several shapes:

```java
.requestMatchers("/api/orders/**")                       // path pattern
.requestMatchers(HttpMethod.POST, "/api/orders")         // method + path
.requestMatchers(HttpMethod.OPTIONS, "/**")              // method only, any path
.requestMatchers(new RegexRequestMatcher("^/v\\d+/.*$", null))
.requestMatchers(request -> request.getHeader("X-Internal") != null)  // predicate
```

Path patterns are Ant-style, and the distinction that catches everyone is:

- `/api/*` — exactly **one** more path segment. `/api/orders` matches;
  `/api/orders/7` does not.
- `/api/**` — **any number** of further segments, including none.

`securityMatcher` accepts the same forms, which is what allows a chain to be
selected on a header rather than a path:

```java
.securityMatcher(request -> {
    String auth = request.getHeader(HttpHeaders.AUTHORIZATION);
    return auth != null && auth.startsWith("Bearer ");
})
```

That routes any bearer-token request to the stateless chain regardless of URL —
useful when the same resource paths serve both a browser session and a machine
client.

## Static resources and the endpoints you forgot

Two categories of path reliably get missed.

**Static resources.** With `anyRequest().authenticated()`, your CSS and
JavaScript are protected too. The login page then renders unstyled, or the SPA
shell fails to boot, and it looks like a routing bug:

```java
.requestMatchers("/css/**", "/js/**", "/images/**", "/favicon.ico").permitAll()
```

The older `WebSecurity#ignoring()` mechanism removes those paths from the filter
chain **entirely** — no security headers, no firewall, nothing. Prefer
`permitAll` inside the chain, which still writes the security headers and still
applies the firewall.

**Error dispatches.** A container may re-dispatch to `/error` after an
exception. If that path is not permitted, the error page itself is rejected and
the caller sees a confusing second failure instead of the first one. Boot's
defaults normally handle this; a chain with a narrow `securityMatcher` that
happens to include `/error` may not.

**Actuator.** Health, readiness and metrics need a deliberate rule rather than
an accident — permitted for the orchestrator, closed for everything else. That
belongs to **[Topic 13 — Actuator](../13-actuator/README.md)**, but the matcher lives
here.

## The trade-off

Multiple chains are what make the SPA-plus-API case expressible at all, and each
chain reads as a coherent policy for one audience. The cost is a **routing
decision with no diagnostics**: nothing reports which chain served a request, so
when a rule "does not apply" you are debugging a dispatch you cannot see. The
discipline that keeps it manageable is unglamorous — explicit `@Order` on every
chain, a `securityMatcher` on every chain but the last, and a comment naming the
audience each one serves.

## Gotchas

**Symptom:** A second `SecurityFilterChain` never seems to run.
**Cause:** An earlier chain has no `securityMatcher` and matches everything.
**Fix:** Only the final chain may be a catch-all.

**Symptom:** The chain order changes after an unrelated refactor.
**Cause:** No `@Order`; bean definition order decided it.
**Fix:** `@Order(10)`, `@Order(20)`, `@Order(30)` on every chain.

**Symptom:** `permitAll` on `/api/public/**` has no effect.
**Cause:** The request was routed to a *different* chain, whose rules never
mention that path. `permitAll` in a chain that did not win is invisible.
**Fix:** Check `securityMatcher` first, rules second. This is the ordering of
questions that saves the most time.

**Symptom:** The login page loads with no styling.
**Cause:** `anyRequest().authenticated()` covers `/css/**`.
**Fix:** `permitAll` those paths explicitly, inside the chain rather than via
`WebSecurity#ignoring()`.

**Symptom:** `/api/orders/7` is protected but `/api/orders` is not, though you
wrote one rule.
**Cause:** `/api/*` matches a single segment.
**Fix:** `"/api/orders", "/api/orders/**"` — or just `/api/**` if the whole tree
shares a policy.

**Symptom:** A CORS preflight is rejected on the API chain.
**Cause:** `OPTIONS` requests carry no credentials and matched an
`authenticated()` rule.
**Fix:** Configure `cors(...)` on that chain so CORS is handled ahead of
authentication — [chunk 12](12-cors-for-an-spa.md). Blanket-permitting `OPTIONS`
is the workaround people reach for and it is strictly worse, because it also
permits `OPTIONS` requests that are not preflights.

**Symptom:** Two chains both need the same twenty-line rule block, and it drifts.
**Cause:** Copy-paste between `@Bean` methods.
**Fix:** Extract a `Customizer<AuthorizeHttpRequestsConfigurer<HttpSecurity>
        .AuthorizationManagerRequestMatcherRegistry>` and apply it in both —
the DSL takes customizers everywhere, so shared policy can be a shared object.

## Interview questions

**★ `securityMatcher` versus `requestMatchers` — what is the difference?**
`securityMatcher` selects which `SecurityFilterChain` handles the request; it is
a routing decision made once, before any filter in that chain runs.
`requestMatchers` appears inside `authorizeHttpRequests` and selects which
authorization rule applies within the chain that already won. Confusing them
produces rules that are correct and never consulted.

**★ You have three chains and the rules in the third never apply. Diagnose it.**
Almost certainly the first or second chain matches the request — most often one
of them has no `securityMatcher`, so it is a catch-all sitting above the others.
Only the first matching chain runs and rules never merge, so a `permitAll` in
chain three is invisible if chain one matched.

**★ Why should chain order be explicit?**
Because implicit order is bean definition order, which depends on how Spring
happens to process your configuration classes. Moving a `@Bean` method to
another file can silently reorder your security policy. `@Order` makes the
routing a property of the code rather than of the container.

**★ Why does `permitAll` on static resources beat `WebSecurity#ignoring()`?**
`ignoring()` removes the paths from the security filter chain entirely, so they
get no security headers and are not seen by the `HttpFirewall`. `permitAll`
keeps them inside the chain and simply authorizes everyone, which is the same
access outcome with the protections intact.

**★ How would you route browser traffic and machine traffic to different policies when they share URLs?**
Give the machine chain a `securityMatcher` that tests for a bearer
`Authorization` header rather than a path. `RequestMatcher` sees the whole
request, so header-based selection is fully supported, and it lets the same
resource path be stateless-and-CSRF-free for API clients while remaining
session-based and CSRF-protected for the browser.

**★ Difference between `/api/*` and `/api/**`?**
`*` matches exactly one path segment; `**` matches any number, including zero.
`/api/*` therefore does not cover `/api/orders/7`, which is the most common
cause of "the rule applies to the collection but not the item".

---

← Prev: [Configuring the chain](05-configuring-the-chain.md) · Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [Method security](07-method-security.md)
