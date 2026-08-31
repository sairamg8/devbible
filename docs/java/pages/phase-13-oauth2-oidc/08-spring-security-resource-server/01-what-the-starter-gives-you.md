---
title: "The resource-server starter configures two beans and one filter chain, and the single most expensive misunderstanding in this topic is believing it configures more than that"
sidebar_label: "01 · What the starter gives you"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against the Spring Security 7.x reference — *OAuth 2.0 Resource
> Server JWT* §"Minimal Dependencies for JWT", §"Minimal Configuration for JWTs",
> §"Overriding or Replacing Boot Auto Configuration"
> ([docs.spring.io](https://docs.spring.io/spring-security/reference/servlet/oauth2/resource-server/jwt.html))
> — and the Spring Boot 4.1.x sources `OAuth2ResourceServerAutoConfiguration`,
> `OAuth2ResourceServerWebSecurityAutoConfiguration`, `JwtDecoderConfiguration`,
> `JwtConverterConfiguration`, `OpaqueTokenIntrospectionConfiguration`,
> `DefaultWebSecurityCondition`
> ([github.com](https://github.com/spring-projects/spring-boot/tree/4.1.x/module/spring-boot-security-oauth2-resource-server)).
> Version spine confirmed from `spring-boot-dependencies:4.1.0`, which pins
> `spring-security.version` **7.1.0** and `spring-framework.version` **7.0.8**.
> JDK 25 · Spring Boot 4.1.0 · Spring Framework 7.0.8 · Spring Security 7.x (7.1.0).

**A resource server is the half of OAuth2 that never talks to a human. It receives a bearer
token it did not issue, decides whether that token is genuine *and applicable*, turns its
claims into an `Authentication`, and gets out of the way. Everything Spring Boot
auto-configures for you is three beans wide — a `JwtDecoder`, an optional
`JwtAuthenticationConverter`, and one throwaway `SecurityFilterChain` that vanishes the
moment you declare your own. Knowing exactly where that line falls is the difference
between a service that validates tokens and a service that merely decodes them.**

## The role, stated precisely

**02 · The four roles** *(not written yet)* owns the vocabulary; this is the one sentence
that matters here. A **resource server** is an OAuth 2.0 *protected resource*: it holds
data, it accepts access tokens, and RFC 6750 §2.1 says of the `Authorization: Bearer`
form —

> *"Clients SHOULD make authenticated requests with a bearer token using the
> 'Authorization' request header field with the 'Bearer' HTTP authorization scheme.
> Resource servers MUST support this method."*

Three things a resource server therefore **never** does, and every one of them shows up in
misconfigured projects:

- **It never runs a login.** No form, no redirect to the authorization server, no consent
  screen. If your resource-server chain has `formLogin()` on it, one of the two is in the
  wrong place — see [04b · Matcher order and chain order](04b-matcher-order.md).
- **It never issues or refreshes a token.** Refresh tokens are never presented to a
  resource server; a resource server that sees one has been handed the wrong credential.
- **It never asks the client who the user is.** The token says so, and the signature (or
  the introspection response) is what makes that claim trustworthy.

The outbound half — calling *another* service with a token — is **09 · Spring as OAuth2
client** *(not written yet)*. `@PreAuthorize` expressions are **10 · Method security**
*(not written yet)*. The JWT wire format, `alg`, JWKS internals and the `alg: none` family
of attacks are **06 · JWT anatomy and validation** *(not written yet)*.

## The two artifacts, and why one of them is not optional

The reference is unusually blunt about this:

> *"Most Resource Server support is collected into `spring-security-oauth2-resource-server`.
> However, the support for decoding and verifying JWTs is in `spring-security-oauth2-jose`,
> meaning that both are necessary in order to have a working resource server that supports
> JWT-encoded Bearer Tokens."*

```xml
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-oauth2-resource-server</artifactId>
</dependency>
```

The starter pulls both, plus `spring-boot-starter-security`. If you assemble the
dependencies by hand and take only `-resource-server`, JWT support is absent and the
failure names a Nimbus or JOSE class rather than the missing artifact.

Opaque tokens are the exception: introspection needs no JOSE at all, because the
authorization server does the cryptography. The reference states it explicitly —

> *"unless a custom `OpaqueTokenIntrospector` is provided, the Resource Server will
> fallback to `SpringOpaqueTokenIntrospector`. This means that only
> `spring-security-oauth2-resource-server` is necessary in order to have a working minimal
> Resource Server that supports opaque Bearer Tokens."*

## What Boot auto-configures, exactly

Two auto-configuration classes, and it is worth knowing which does what because they back
off on different conditions.

`OAuth2ResourceServerAutoConfiguration` is `@ConditionalOnClass(BearerTokenAuthenticationToken.class)`
and imports three configurations:

| Configuration | Produces | Backs off when |
|---|---|---|
| `JwtDecoderConfiguration` | a `JwtDecoder` | any `JwtDecoder` bean exists |
| `JwtConverterConfiguration` | a `JwtAuthenticationConverter` | any `JwtAuthenticationConverter` bean exists — **and it only runs at all if one of the five `jwt.*` converter properties is set** |
| `OpaqueTokenIntrospectionConfiguration` | a `SpringOpaqueTokenIntrospector` | any `OpaqueTokenIntrospector` bean exists, or `introspection-uri` is unset |

`OAuth2ResourceServerWebSecurityAutoConfiguration` produces the filter chain, and it is
`@ConditionalOnDefaultWebSecurity` — which resolves, via `DefaultWebSecurityCondition`, to
`@ConditionalOnMissingBean(SecurityFilterChain.class)`:

```java
@Bean
@ConditionalOnBean(JwtDecoder.class)
SecurityFilterChain jwtSecurityFilterChain(HttpSecurity http) {
    http.authorizeHttpRequests((requests) -> requests.anyRequest().authenticated());
    http.oauth2ResourceServer((resourceServer) -> resourceServer.jwt(withDefaults()));
    return http.build();
}
```

That is the entire auto-configured chain, copied from the Boot 4.1.x source. Read what is
**not** in it:

- no `sessionManagement`, so the policy is `IF_REQUIRED` and an `HttpSession` can still be
  created;
- no `csrf` call — though `oauth2ResourceServer` quietly makes one on your behalf, which
  is [04c · Stateless, CSRF and CORS](04c-stateless-csrf-cors.md)'s subject and is not what
  most people assume;
- no `cors`;
- no path exclusions, so **every** URL including your actuator endpoints requires a token.

🔴 **The whole thing disappears the instant you declare one `SecurityFilterChain` bean.**
Not "is merged with", not "is added to" — the condition is `@ConditionalOnMissingBean`, so
declaring a chain for `/api/**` removes the auto-configured catch-all and everything
outside `/api/**` is served by whatever chain is left. That is the mechanism behind the
most common self-inflicted outage in this area: a team adds a narrow chain, the broad one
evaporates, and endpoints that were protected by accident become public by accident.

## The two beans you will actually override

Boot's own documentation names them:

> *"There are two `@Bean`s that Spring Boot generates on Resource Server's behalf."*

The `SecurityFilterChain` and the `JwtDecoder`. The decoder is where key material, trusted
algorithms, timeouts, caching and validation live — [02 · issuer-uri](02-issuer-uri.md)
onwards. The chain is where matchers, session policy and error handling live —
[04 · The filter chain](04-the-filter-chain.md).

There is a third bean Boot creates *conditionally*, and its condition surprises people:
`JwtConverterConfiguration` is annotated
`@Conditional(JwtConverterConfiguration.PropertiesCondition.class)`, an `AnyNestedCondition`
over `authority-prefix`, `principal-claim-name`, `authorities-claim-name` and
`authorities-claim-expressions`. Set none of them and **no `JwtAuthenticationConverter`
bean exists at all** — `JwtAuthenticationProvider` falls back to its own internal default.
That matters when you try to inject one to tweak it. See
[07c · Authorities by property](07c-authorities-by-property.md).

## Where phase 9 stops and this topic starts

[Phase 9 · chunk 9 — The stateless JWT resource server](../../phase-9-spring-boot/11-spring-security/09-jwt-resource-server.md)
already showed the minimum viable configuration and
[chunk 10 — Claims to authorities](../../phase-9-spring-boot/11-spring-security/10-claims-to-authorities.md)
already showed the `SCOPE_` default. This topic does not repeat them; it goes underneath
them. Where phase 9 says "four default validations", this topic names the actual validator
objects Spring Security 7 composes and shows that the list changed. Where phase 9 says
"add an audience validator", this topic shows the Boot 4.x way that does not require
replacing the decoder at all.

Nothing here contradicts phase 9. Two things **extend** it and are called out where they
appear: the default validator set in 7.x now includes a `typ` header check and an X.509
thumbprint check ([06 · The default validators](06-the-default-validators.md)), and Boot
4.x will compose an `OAuth2TokenValidator<Jwt>` bean onto the defaults for you
([06d · A validator bean](06d-a-validator-bean.md)).

## Gotchas

**★ Declaring one `SecurityFilterChain` deletes the auto-configured one, including its
protection of every path you did not think about.**
`@ConditionalOnDefaultWebSecurity` is `@ConditionalOnMissingBean(SecurityFilterChain.class)`.
The fix is to always terminate your own chain with `.anyRequest().authenticated()` and, if
you use `securityMatcher` to scope it, to add a deny-everything catch-all chain last.

**★ `spring-security-oauth2-jose` missing produces a class-not-found, not a helpful
message.**
The resource-server artifact contains the filter and the provider; the decoder lives in
the JOSE artifact. Use `spring-boot-starter-oauth2-resource-server` rather than picking
artifacts individually.

**★ The auto-configured chain does not set `SessionCreationPolicy.STATELESS`.**
The source sets only `authorizeHttpRequests` and `oauth2ResourceServer`. If you rely on
the auto-configuration in production you are running a token API that will create sessions
under `IF_REQUIRED`. Write your own chain; see
[04c](04c-stateless-csrf-cors.md).

**★ Configuring both `jwt()` and `opaqueToken()` on one chain is a startup failure, by
design.**
`OAuth2ResourceServerConfigurer.validateConfiguration()` asserts
`"Spring Security only supports JWTs or Opaque Tokens, not both at the same time."` If you
genuinely need both formats, that is an `AuthenticationManagerResolver` —
[09b · Dynamic tenants and mixed token formats](09b-dynamic-tenants.md).

**★ Configuring neither is also a startup failure, and the message is the most useful in
the whole module.**
`"Jwt and Opaque Token are the only supported formats for bearer tokens in Spring Security
and neither was found."` Calling `oauth2ResourceServer(Customizer.withDefaults())` with an
empty body gets you exactly this.

**★ A `JwtAuthenticationConverter` bean may not exist even though the docs talk about
"the" converter.**
Boot only creates one when one of the four converter properties is set. Injecting
`JwtAuthenticationConverter` into your configuration without setting a property fails to
resolve. Declare your own bean instead — that is the supported extension point.

**★ "It works" is not evidence that validation is on.**
A resource server with a wrong `issuer-uri` and a reachable JWK set will still verify
signatures and still reject nothing else. The tokens your own IdP mints pass every test
you are likely to write. The checks that matter are the ones that reject *other people's*
valid tokens — [06c · Audience](06c-audience.md).

## Interview questions

**★ What does `spring-boot-starter-oauth2-resource-server` actually auto-configure?**
A `JwtDecoder` (from `issuer-uri`, `jwk-set-uri` or `public-key-location`), a
`SpringOpaqueTokenIntrospector` if an `introspection-uri` is set, a
`JwtAuthenticationConverter` *only if* one of the four converter properties is present,
and a single `SecurityFilterChain` that requires authentication on every request and
enables `oauth2ResourceServer().jwt()`. The chain is conditional on there being no
`SecurityFilterChain` bean anywhere in the context.

**★ You add a `SecurityFilterChain` scoped to `/api/**` and suddenly `/internal/metrics`
is wide open. Why?**
Because the auto-configured catch-all chain was conditional on your not declaring one. By
declaring a chain you removed the only rule that protected everything else. Spring
Security's chain selection is first-match-wins across chains, and with no chain matching
`/internal/**` the request is not filtered by any security chain at all. The fix is a
final, unmatched-scope chain with `anyRequest().denyAll()` or `authenticated()`.

**★ Why are two dependencies needed for JWT but one for opaque tokens?**
Because JWT validation is cryptography performed locally: the decoder needs Nimbus, which
lives in `spring-security-oauth2-jose`. Introspection performs no cryptography — it posts
the token to the authorization server and reads `active`. The resource-server artifact
alone carries everything introspection needs.

**★ A resource server receives a refresh token in an `Authorization: Bearer` header. What
should happen?**
It should fail validation like any other unusable credential. A refresh token is a
credential for the authorization server's token endpoint, not for a protected resource; if
it is opaque it will not decode, and if introspection is in use the AS should report it as
not an access token or the resource server should not accept it. The deeper point is that
a refresh token should never reach a resource server at all — a client that sends one has
a bug that a working `aud` check would also catch.

**★ Which parts of OAuth2 is a resource server explicitly *not* responsible for?**
User authentication, consent, token issuance, token refresh and token revocation. It
consumes a credential and enforces an authorization policy. Every one of those other
responsibilities belongs to the authorization server, and blurring the line is how
resource servers acquire a login page and a client secret they have no business holding.

{/* FOOTER */}
