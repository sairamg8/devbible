---
title: "One filter, three objects"
sidebar_label: "1 · One filter, three objects"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against the Spring Security reference — *Architecture*
> (docs.spring.io/spring-security/reference/servlet/architecture.html —
> `DelegatingFilterProxy`, `FilterChainProxy`, `SecurityFilterChain`, request
> matching and the `HttpFirewall` note). Spring Boot 4.1.1, Spring Framework
> 7.0.x, Spring Security 7.x, JDK 25.

**Spring Security adds exactly one filter to your servlet container, and
everything else it does happens inside that one filter. Once you can draw that
picture — one container filter, delegating to a bean, which picks one of your
chains — almost every question people ask about Spring Security answers itself:
why a rule "did not apply", why the order of your chains matters, and why a
request that "should be public" got rejected before your controller existed.**

## The three objects, outermost first

### 1. `DelegatingFilterProxy` — the bridge into Spring

A servlet container knows how to register `jakarta.servlet.Filter` instances. It
does not know anything about a Spring `ApplicationContext`, and it has to
register its filters before Spring has finished creating beans. Spring's
`DelegatingFilterProxy` exists to bridge those two lifecycles: the container
registers *it*, and it looks the real filter bean up from the
`ApplicationContext` on first use.

The reference is explicit that this is the point — it "allows bridging between
the Servlet container's lifecycle and Spring's `ApplicationContext`", and the
benefit is that it "allows delaying looking up `Filter` bean instances".

Under Spring Boot you never write this registration. Boot's security
auto-configuration registers a `DelegatingFilterProxy` named
`springSecurityFilterChain`, which is why the whole thing appears with one
dependency and no code. This is the same servlet-filter mechanism described in
[filters and the container](../01-why-frameworks-servlet-model/02-filters-and-the-container.md)
— Spring Security is not doing anything the servlet spec does not already allow,
and that is worth holding on to, because it means everything here is debuggable
with servlet-level reasoning.

### 2. `FilterChainProxy` — the bean it delegates to

`FilterChainProxy` is "a special `Filter` provided by Spring Security that
allows delegating to many `Filter` instances through `SecurityFilterChain`".
Because it is an ordinary bean, it is what the `DelegatingFilterProxy` finds.

It is not merely a dispatcher. The reference lists things it does that are "not
viewed as optional":

- it is "a starting point for all of Spring Security's Servlet support";
- it **clears out the `SecurityContext`** after the request, "to avoid memory
  leaks" — this matters enormously and is the subject of
  [chunk 3](03-authentication-and-authorization.md);
- it applies Spring Security's `HttpFirewall`, which rejects malformed and
  suspicious request paths before anything else looks at them.

That last one is a recurring surprise. A request containing an encoded slash or
a `;` path parameter inside a URL segment can be rejected with a 400 from inside
Spring Security, with no matcher of yours involved at all, and no log line that
mentions your configuration. The firewall is doing its job; the request shape is
the problem.

### 3. `SecurityFilterChain` — one per "kind of request"

A `SecurityFilterChain` is a `RequestMatcher` plus an ordered `List<Filter>`.
`FilterChainProxy` walks its chains in order and uses each matcher to decide
which one handles the request.

**The single most important sentence in the architecture page:**

> Only the first `SecurityFilterChain` that matches is invoked.

Not "all that match". Not "the most specific". The **first**, in bean order. The
reference's own example makes the consequence concrete: a request to
`/api/messages/` matches a chain declared for `/api/**` and also matches a
later, broader chain, and only the `/api/**` one runs.

Two consequences follow immediately, and both bite people:

- **A chain with no matcher matches everything.** Declared first, it swallows
  every request and every later chain is dead code that still compiles, still
  starts, and never runs.
- **Rules do not accumulate across chains.** If chain A permits `/health` and
  chain B requires authentication for `/**`, a request to `/health` is decided
  entirely by whichever chain matched first. There is no merge step.

This is where nearly all multi-chain confusion comes from, and it is handled
with `@Order` and `securityMatcher` in
[chunk 5](05-configuring-the-chain.md).

### Matching is not limited to URLs

`RequestMatcher` is given the whole `HttpServletRequest`, so a chain can be
selected on a header, an HTTP method, a media type, or an arbitrary predicate.
Selecting a stateless API chain by the presence of an `Authorization: Bearer …`
header — so that browser traffic and machine traffic take genuinely different
chains — is a legitimate and fairly common design.

## What this buys, and what it costs

The payoff is that security is completely independent of application code. No
controller knows it exists; the rules live in one place; you can change the
authentication mechanism from form login to bearer tokens without touching a
handler method.

The cost is a **second dispatch model running in front of the one you already
understand**. You now have two ordering systems (chain order, and filter order
inside a chain), two ways a request can be rejected, and a region of the request
lifecycle where your code has not started yet. Every hour lost to Spring
Security is an hour spent debugging inside that second model without having
drawn it — which is why this topic starts here rather than with annotations.

## Gotchas

**Symptom:** A rule you added to `authorizeHttpRequests` seems to be ignored
entirely — no error, no log, it just does not apply.
**Cause:** Another `SecurityFilterChain` bean matches the request first, and only
the first match runs.
**Fix:** Give the chains explicit `@Order` values and make every non-final
chain's `securityMatcher` narrow. See [chunk 5](05-configuring-the-chain.md).

**Symptom:** Two `SecurityFilterChain` beans, and the second is never used.
**Cause:** The first has no `securityMatcher`, so it matches everything.
**Fix:** Only the final fallback chain may match all requests. Every chain
before it declares a `securityMatcher`.

**Symptom:** A 400 with a message about the request URL, for a path that looks
perfectly ordinary.
**Cause:** `HttpFirewall` inside `FilterChainProxy` rejected it — commonly an
encoded slash (`%2F`) or a `;` in a path segment.
**Fix:** Change the URL scheme so the value travels in a query parameter or the
request body rather than in a path segment. Relaxing the firewall with a
permissive `StrictHttpFirewall` configuration is possible and is a genuine
reduction in protection — do it deliberately, not to make a test pass.

**Symptom:** You define a `SecurityFilterChain` bean and Boot's default rules
still seem to apply somewhere.
**Cause:** Boot's `SpringBootWebSecurityConfiguration` backs off its default
chain only when *some* `SecurityFilterChain` bean exists. If yours is narrow and
does not match a path, that path now has **no** chain rather than the default
one, which is a different failure from the one you expected.
**Fix:** Always terminate with a catch-all chain that states what should happen
to everything you did not think about — normally `anyRequest().authenticated()`.

**Symptom:** Ordering works locally and breaks after a refactor that moved a
`@Bean` method to another `@Configuration` class.
**Cause:** Without explicit `@Order`, chain order depends on bean definition
order, which depends on configuration-class processing order.
**Fix:** Never rely on it. Annotate every `SecurityFilterChain` bean with
`@Order(N)`, spaced (10, 20, 30) so a chain can be inserted later.

## Interview questions

**★ What actually gets registered with the servlet container when you add Spring Security?**
Exactly one filter: a `DelegatingFilterProxy` named `springSecurityFilterChain`.
It delegates to the `FilterChainProxy` bean, which chooses one
`SecurityFilterChain` per request and runs that chain's ordered filters. So the
container's view of Spring Security is a single filter; everything else is
Spring's own structure inside it.

**★ Why is there a `DelegatingFilterProxy` at all — why not register the filter bean directly?**
Because the container must know its filters at startup, before Spring has
created beans. `DelegatingFilterProxy` lets registration happen immediately
while deferring the lookup of the actual bean until the first request. That is
what allows a Spring-managed, dependency-injected filter to participate in the
container's filter pipeline.

**★ Several chains match a request. Which one runs?**
Only the first matching chain, in bean order. Not the most specific, not all of
them, and rules from the others do not merge in. This is why every non-final
chain gets a narrow `securityMatcher` and an explicit `@Order`.

**★ Can a chain be selected on something other than the path?**
Yes — `RequestMatcher` sees the whole request, so header, method, content type
or a custom predicate are all valid selectors. Routing bearer-token traffic to a
stateless chain and everything else to a session-based chain by inspecting the
`Authorization` header is a common example.

**★ What does the `HttpFirewall` protect against, and where does it sit?**
It sits inside `FilterChainProxy`, ahead of every chain, and rejects requests
whose URLs are structurally suspicious — encoded path separators, path traversal
sequences, control characters, semicolon path parameters. The point is that
these can make two different components disagree about what path was requested,
which is how authorization bypasses happen; rejecting the request outright
removes the disagreement.

**★ Why is clearing the `SecurityContext` after each request "not optional"?**
Because the context lives in a `ThreadLocal` and request-handling threads are
reused. If it were not cleared, the next request served by that thread could
start out holding the previous caller's identity — a privilege escalation with
no attacker involved. `FilterChainProxy` does the clearing in a `finally`, which
is why it has to be the outermost security component.

---

← Index: [Spring Security, the working subset](README.md) · Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [The filters that matter](02-the-filters-that-matter.md)
