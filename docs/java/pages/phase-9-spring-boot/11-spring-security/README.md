---
title: "Spring Security, the working subset"
sidebar_label: "11 · Spring Security"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against the Spring Security reference
> (docs.spring.io/spring-security/reference/) — *Architecture*, *Servlet
> Authentication Architecture*, *Authorize HTTP Requests*, *Method Security*,
> *Session Management*, *OAuth 2.0 Resource Server JWT*, *Password Storage*,
> *CSRF*, *CORS* and *Concurrency Support* — plus the Spring Security 7.0
> configuration-migration notes on the removal of `and()`. Spring Boot 4.1.0,
> Spring Framework 7.0.x, Spring Security 7.x, JDK 25.

**Spring Security is a filter chain. Almost every question anyone has about it —
why a rule "did not apply", why a 401 never reached the error handler, why the
login page has no styling, why `@PreAuthorize` does nothing — is answered by
knowing which filter ran, in which chain, and where that chain sits relative to
Spring MVC. This topic teaches the model first and the annotations second,
because the annotations are learnable in an afternoon and debuggable only with
the model.**

🔴 **Boot 4 pairs with Spring Security 7, where the lambda DSL is the only DSL.**
`and()` was removed, `authorizeRequests()` and `antMatchers()` are gone, and
`WebSecurityConfigurerAdapter` went in Security 6. **Every sample online
containing `http.csrf().disable()` is dead syntax** — [chunk 5](05-configuring-the-chain.md)
shows what replaces it and why.

| # | Chunk | Covers |
|---|---|---|
| 1 | **[One filter, three objects](01-one-filter-three-objects.md)** | `DelegatingFilterProxy` → `FilterChainProxy` → `SecurityFilterChain`, "only the first matching chain is invoked", the `HttpFirewall`, and matching on more than the URL |
| 2 | **[The filters that matter](02-the-filters-that-matter.md)** | The fixed order and why it exists; `SecurityContextHolderFilter` and explicit saving, CORS-before-auth, `CsrfFilter`, the three authentication filters, `AuthorizationFilter`, and `ExceptionTranslationFilter` choosing 401 vs 403 |
| 3 | **[Authentication vs authorization](03-authentication-and-authorization.md)** | `SecurityContextHolder` strategies, the dual role of `Authentication`, `GrantedAuthority`, `ProviderManager` and credential erasure, `AbstractAuthenticationProcessingFilter`'s sequence, and where the identity comes from per style |
| 4 | **[The thread-local caveat](04-the-threadlocal-caveat.md)** | Why clearing is non-optional, why `@Async` sees nothing, the `DelegatingSecurityContext*` family, why `MODE_INHERITABLETHREADLOCAL` is not the fix, and what virtual threads do and do not change |
| 5 | **[Configuring the chain](05-configuring-the-chain.md)** | The `SecurityFilterChain` bean in full, the three ways the old DSL is dead, every access rule, the `ROLE_` double-prefix trap, first-match ordering, and what `STATELESS` actually does |
| 6 | **[Matchers and multiple chains](06-matchers-and-multiple-chains.md)** | `securityMatcher` (routing) vs `requestMatchers` (policy), the SPA-plus-API two-chain shape, explicit `@Order`, pattern forms, and the static-resource and `/error` paths everyone forgets |
| 7 | **[Method security: the annotations](07-method-security.md)** | `@EnableMethodSecurity` and the silence without it, `@PreAuthorize`/`@PostAuthorize`/`@PreFilter`/`@PostFilter`, class-level override semantics, and meta-annotations |
| 8 | **[Method vs URL rules](08-method-vs-url-security.md)** | It is AOP: self-invocation, private and final methods, `offset` against `@Transactional`; unannotated methods are unsecured, and the honest comparison table |
| 9 | **[JWT resource server](09-jwt-resource-server.md)** | `issuer-uri` and JWK discovery, the four default validations and the audience omission, composing validators without silently dropping the defaults, clock skew, and the revocation trade-off |
| 10 | **[Claims to authorities](10-claims-to-authorities.md)** | The `SCOPE_` default and why `hasRole` never matches, `JwtAuthenticationConverter`, reading both scopes and roles, why the distinction is worth keeping, and why `STATELESS` belongs here |
| 11 | **[Password encoding](11-password-encoding.md)** | Why there is no `decode`, `DelegatingPasswordEncoder` and the `{bcrypt}` prefix, the four adaptive functions and the Password4j set new in 7.0, the work factor as a capacity decision, and upgrading on login |
| 12 | **[CORS](12-cors-for-an-spa.md)** | What a preflight is and why it carries no credentials, why `@CrossOrigin` cannot fix a rejected preflight, the one-bean rule, and why `*` plus `allowCredentials` is refused |
| 13 | **[CSRF decisions](13-csrf-decisions.md)** | The criterion — does the browser attach the credential automatically — both right answers argued, BREACH and `XorCsrfTokenRequestAttributeHandler`, and `csrf.spa()` |
| 14 | **[The traps](14-the-traps.md)** | Fourteen collected failures, which of them are outages and which are silent vulnerabilities, and the two habits that catch them |

## Why this runs to fourteen files

- **The model is the expensive part, and it is three separate mechanisms.** How
  a request reaches a chain, what runs inside that chain, and where the identity
  is stored are independent — and each one produces its own family of bugs.
  Compressing them into "Spring Security is a filter chain" is what leaves
  people unable to debug it.
- **CORS and CSRF are decisions, not settings.** Both are routinely
  cargo-culted, both have one line that is correct in one deployment and
  reckless in another, and neither is understandable without the browser-side
  half. Arguing each one properly takes a chunk; asserting them takes a
  sentence and teaches nothing.
- **Method security is two topics wearing one name.** The annotations are
  straightforward. The mechanism under them — proxies, self-invocation,
  advisor ordering, and the fact that it is default-open where URL rules are
  default-closed — is what decides whether you should use it at all, and it
  deserves its own argument rather than a footnote.
- **The resource server splits at the trust boundary.** Verifying that a token
  is genuine and deciding what its claims mean are different jobs with different
  failure modes; the second is where a correctly configured service still denies
  everybody.
- **The traps chunk exists because the failures rhyme.** Collected in one place
  they show a pattern — rules that never fire, checks that silently do not run,
  and the seam between the filter chain and MVC — that no individual page makes
  visible.

## Where this connects

- **[Topic 01 — Why frameworks: the servlet model](../01-why-frameworks-servlet-model/README.md)**
  — Spring Security is one servlet filter. The whole architecture rests on
  [filters and the container](../01-why-frameworks-servlet-model/02-filters-and-the-container.md),
  and on filters being upstream of `DispatcherServlet`.
- **[Topic 02 — The IoC container](../02-the-ioc-container/README.md)** — method
  security is Spring AOP, so
  [proxies and self-invocation](../02-the-ioc-container/05-proxies-and-self-invocation.md)
  is the mechanism, not an analogy.
- **[Topic 07 — REST controllers](../07-rest-controllers/README.md)** — the
  handlers these rules protect.
- **[Topic 09 — Error handling](../09-error-handling/06-problemdetail-and-rfc-9457.md)**
  — the `ProblemDetail` contract your `AuthenticationEntryPoint` and
  `AccessDeniedHandler` must match, because security failures never reach
  `@ControllerAdvice`.
- **[Topic 12 — Outbound HTTP](../12-outbound-http/README.md)** — a resource
  server makes an outbound call to fetch the JWK set, and it needs real
  timeouts like any other dependency.
- **[Phase 13 — OAuth2 and OIDC](../../phase-13-oauth2-oidc/README.md)** — the
  flows that produce the token this topic only consumes.
- **[Phase 6 — thread-locals and scoped values](../../phase-6-concurrency/12-threadlocal-scopedvalue/README.md)**
  — `SecurityContextHolder` is a `ThreadLocal`, and every propagation problem in
  chunk 4 is that phase's material in a security costume.

## Phase gate

You can state, without looking it up, which chain will serve a given request,
which filter produced a 401 or a 403, whether a `csrf.disable()` in front of you
is correct, and why `@PreAuthorize` on a method called from the same class does
nothing.

---

← Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [One filter, three objects](01-one-filter-three-objects.md)
