---
title: "Two levels of matcher decide everything — which chain runs, then which rule inside it wins — and both are first-match, which is why a permitAll at the top of the list and a missing catch-all chain are the two defects that open a resource server without producing a single error"
sidebar_label: "04b · Matcher and chain order"
sidebar_position: 8
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against the Spring Security 7.x reference — *Authorize HTTP
> Requests*
> ([docs.spring.io](https://docs.spring.io/spring-security/reference/servlet/authorization/authorize-http-requests.html)),
> *Architecture* ("Only the first `SecurityFilterChain` that matches is invoked")
> ([docs.spring.io](https://docs.spring.io/spring-security/reference/servlet/architecture.html)),
> *OAuth 2.0 Resource Server JWT* §"Configuring Authorization"
> ([docs.spring.io](https://docs.spring.io/spring-security/reference/servlet/oauth2/resource-server/jwt.html))
> and the Spring Boot 4.1.x source `DefaultWebSecurityCondition`.
> JDK 25 · Spring Boot 4.1.1 · Spring Framework 7.0.9 · Spring Security 7.x (7.1.0).

**Spring Security evaluates matchers twice, at two different levels, and both are
first-match-wins. `securityMatcher` chooses which `SecurityFilterChain` handles the request;
`requestMatchers` inside `authorizeHttpRequests` chooses which rule applies. Get the order
wrong at level two and Spring may refuse to start. Get it wrong at level one and nothing
tells you at all — the request simply misses every chain and is served with no security
filters in front of it.**

[Phase 9 chunk 6](../../phase-9-spring-boot/11-spring-security/06-matchers-and-multiple-chains.md)
introduced the two levels. This chunk is what they do specifically to a resource server,
where the failure mode is not "the user sees a login page" but "the endpoint had no
authentication at all and returned 200".

## Level two: rule order inside one chain

```java
.authorizeHttpRequests(auth -> auth
    .requestMatchers("/api/public/**").permitAll()
    .requestMatchers(HttpMethod.GET, "/api/orders/**").access(hasScope("orders.read"))
    .requestMatchers(HttpMethod.POST, "/api/orders/**").access(hasScope("orders.write"))
    .anyRequest().authenticated()
)
```

Rules are evaluated top to bottom and the **first matching rule wins**; everything below it
is not consulted. Two consequences specific to token APIs:

**A broad `permitAll()` above a narrow rule deletes the narrow rule.**

```java
.authorizeHttpRequests(auth -> auth
    .requestMatchers("/api/**").permitAll()                             // ⛔
    .requestMatchers("/api/admin/**").access(hasScope("admin"))         // unreachable
    .anyRequest().authenticated()
)
```

`/api/admin/users` matches line one, is permitted, and line two is never evaluated. No
warning, no startup failure — `/api/**` and `/api/admin/**` are different patterns, so
Spring cannot tell that one subsumes the other. This is the shape of the defect the brief
calls "`permitAll()` at the top opened everything", and the only defence is a review habit:
**every `permitAll()` in a resource-server chain gets read as "and everything under this
path, forever, including endpoints not yet written".**

**Method-less matchers match every method.**

```java
.requestMatchers("/api/orders").permitAll()   // GET, POST, PUT, DELETE, PATCH
```

If the intent was a public read, write `requestMatchers(HttpMethod.GET, "/api/orders")`.
On a resource server this is worse than on a session app, because there is no CSRF token
standing between an attacker and the write.

**`anyRequest()` must be last, and Spring enforces that one case.** Putting a rule after
`anyRequest()` fails at configuration time — one of the few places you get a startup error
instead of a silent hole. It does *not* detect the overlapping-pattern case above.

**`anyRequest().permitAll()` is a default-open policy.** Every endpoint anybody adds in
future is public until somebody writes a rule. `authenticated()` or `denyAll()` makes the
failure mode "the new endpoint 403s in staging" instead of "the new endpoint was public for
four months".

### `permitAll()` does not mean "no token is processed"

A subtlety worth stating because it drives test design. `permitAll()` is an *authorization*
decision, evaluated by `AuthorizationFilter` at the end of the chain. The
`BearerTokenAuthenticationFilter` still runs earlier and still processes any token present.
So on a `permitAll()` endpoint:

- with no token, the principal is anonymous and `@AuthenticationPrincipal Jwt` is `null`;
- with a **valid** token, the principal is a `Jwt` and you can read claims;
- with an **invalid** token, the filter fails authentication and the request is rejected —
  `permitAll()` never gets a say, because the failure happened before the authorization
  filter.

That last bullet surprises people. A `permitAll()` health endpoint that a client
accidentally sends an expired token to returns 401, not 200.

## Level one: chain selection

> *"Only the first `SecurityFilterChain` that matches is invoked."*

```java
@Bean @Order(10)
SecurityFilterChain api(HttpSecurity http) throws Exception {
    return http.securityMatcher("/api/**") ... .build();
}

@Bean @Order(20)
SecurityFilterChain web(HttpSecurity http) throws Exception {
    return http /* no securityMatcher → matches everything */ ... .build();
}
```

Three rules that are not negotiable:

1. **Always set `@Order`.** Without it, precedence follows bean definition order, which
   follows configuration-class processing order. Renaming a class can reorder your security
   policy.
2. **Rules do not merge across chains.** The chain that wins is the *only* one that runs.
   A `requestMatchers("/actuator/**").permitAll()` in chain 20 has no effect on a request
   that matched chain 10.
3. **The last chain must have no `securityMatcher`.** Otherwise there are requests that
   match no chain.

### The request that matches no chain

This is the failure with no symptom. If every chain has a `securityMatcher` and a request
matches none of them, `FilterChainProxy` finds no chain and the request proceeds to the
servlet **with no security filters applied**. No `SecurityContext`, no authorization filter,
no 401 — a controller method executes and returns 200.

On a resource server this is catastrophic in a very specific way: the endpoint appears in
your API, the tests that use `MockMvc` with `@WebMvcTest` may not even load the chain, and
a scanner sees a 200. The fix is one bean:

```java
@Bean
@Order(Ordered.LOWEST_PRECEDENCE)
SecurityFilterChain denyTheRest(HttpSecurity http) throws Exception {
    return http
        .authorizeHttpRequests(auth -> auth.anyRequest().denyAll())
        .build();
}
```

`denyAll()` rather than `authenticated()`, because anything reaching this chain is by
definition a path nobody thought about.

### The Boot auto-configuration trapdoor

Boot's `OAuth2ResourceServerWebSecurityAutoConfiguration` chain is
`@ConditionalOnDefaultWebSecurity`, which resolves to
`@ConditionalOnMissingBean(SecurityFilterChain.class)`. So:

- **zero chains declared** → Boot's catch-all `anyRequest().authenticated()` protects
  everything;
- **one chain declared, scoped to `/api/**`** → Boot's chain is gone, and every path outside
  `/api/**` matches nothing.

The transition from "secure by accident" to "open by accident" happens on the commit that
adds the first `SecurityFilterChain`. That is why the catch-all bean above is not optional
advice; it restores the property you had before you started configuring.

## Splitting a browser app and an API

The canonical two-chain shape, and why it is two chains rather than one:

```java
@Bean @Order(10)
SecurityFilterChain apiChain(HttpSecurity http) throws Exception {
    return http
        .securityMatcher("/api/**")
        .authorizeHttpRequests(auth -> auth.anyRequest().authenticated())
        .oauth2ResourceServer(oauth2 -> oauth2.jwt(Customizer.withDefaults()))
        .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        .build();
}

@Bean @Order(20)
SecurityFilterChain webChain(HttpSecurity http) throws Exception {
    return http
        .authorizeHttpRequests(auth -> auth
            .requestMatchers("/", "/login", "/css/**").permitAll()
            .anyRequest().authenticated())
        .formLogin(Customizer.withDefaults())
        .build();
}
```

A single chain can only have one answer to four questions that are properly per-audience:
is a session created, is CSRF enforced, what does an unauthenticated request receive (401,
or a redirect to `/login`), and which authentication filters run. A browser and a machine
client want opposite answers to all four.

## Gotchas

**★ A broad `permitAll()` above a narrow rule makes the narrow rule dead code, silently.**
`/api/**` permitted before `/api/admin/**` restricted means admin is public. Spring cannot
detect pattern subsumption, so there is no startup error. Order rules narrow-to-broad and
read every `permitAll()` as permanent.

**★ Declaring your first `SecurityFilterChain` removes Boot's catch-all.**
Everything outside your `securityMatcher` now matches no chain and runs with no security
filters at all. Add a `LOWEST_PRECEDENCE` chain with `anyRequest().denyAll()` in the same
commit.

**★ A request matching no chain is not denied — it is unfiltered.**
There is no default-deny at the `FilterChainProxy` level. The request goes straight to the
servlet. This produces a 200 with no authentication and no log line saying anything
unusual happened.

**★ `requestMatchers("/api/orders")` with no `HttpMethod` matches POST, PUT and DELETE too.**
On a token API with CSRF exempted for bearer requests, that is a writable public endpoint.

**★ An invalid token on a `permitAll()` endpoint still produces 401.**
Authentication runs before authorization. The bearer filter fails, the entry point commences,
and `permitAll()` is never reached. A client that sends a stale token to your public health
endpoint gets 401, which reads as a broken health check.

**★ `@Order` omitted means your security policy depends on bean definition order.**
Which depends on classpath scanning order and configuration-class processing order. Space
the orders (10, 20, 30) so a chain can be inserted later without renumbering.

**★ Rules do not merge across chains, so a "shared" `permitAll()` is not shared.**
Every chain needs its own complete rule set. Copying `/actuator/health` exemptions into
only one of two chains is a common half-fix.

**★ `securityMatcher` on the last chain leaves a hole by construction.**
The catch-all chain must have no `securityMatcher`. If every chain is scoped, there is
always some path that is unprotected; you just have not found it yet.

## Interview questions

**★ What is the difference between `securityMatcher` and `requestMatchers`?**
`securityMatcher` is level one: it decides whether this `SecurityFilterChain` handles the
request at all, and only the first matching chain runs. `requestMatchers` is level two: it
decides which authorization rule applies *within* the chain that won. Rules never merge
across chains.

**★ What happens to a request that matches no `SecurityFilterChain`?**
It is served with no security filters. Not denied, not 401 — unfiltered. There is no
implicit default-deny at chain-selection level, so the only protection is to have a
catch-all chain with no `securityMatcher` and `anyRequest().denyAll()`.

**★ Why does adding a `SecurityFilterChain` bean sometimes make an application *less*
secure?**
Because Boot's auto-configured chain is `@ConditionalOnMissingBean(SecurityFilterChain.class)`.
Before your bean exists, that chain requires authentication on every request. After it
exists, only the paths your `securityMatcher` covers are handled at all — everything else
matches nothing and is unfiltered.

**★ You have `requestMatchers("/api/**").permitAll()` followed by
`requestMatchers("/api/admin/**").hasAuthority("SCOPE_admin")`. What is the effective
policy, and why did nothing warn you?**
Everything under `/api/` is public, including `/api/admin/`. Matching is first-match in
declaration order, and Spring only detects the specific case of a rule placed after
`anyRequest()`. It has no notion of one path pattern subsuming another, so overlapping
patterns in the wrong order are a silent policy change.

**★ Should a public endpoint on a resource server be `permitAll()`, and what does that
actually permit?**
It permits the *authorization* decision, not the authentication step. The bearer filter
still runs: no token means an anonymous principal and a 200; a valid token means the claims
are available; an invalid token means 401 before authorization is ever consulted. If you
need "never 401 regardless of what the client sends", that endpoint belongs on a separate
chain that does not configure `oauth2ResourceServer` at all.

**★ Why split a browser app and an API into two chains instead of one with careful
matchers?**
Because four properties are chain-wide, not rule-wide: session creation policy, CSRF
enforcement, the unauthenticated response (401 versus redirect to a login page), and which
authentication filters are installed. Browsers and machine clients want opposite answers to
every one of them, and a single chain can only give one answer each.

---

← [The filter chain](04-the-filter-chain.md) · [Topic index](README.md) · Next → [STATELESS, CSRF and CORS](04c-stateless-csrf-cors.md)
