---
title: "The whole configuration surface is one SecurityFilterChain bean written in a DSL where and() no longer exists, and the oauth2ResourceServer configurer does four things behind your back before the first request arrives"
sidebar_label: "04 · The filter chain"
sidebar_position: 7
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against the Spring Security 7.x reference — *OAuth 2.0 Resource
> Server JWT* §"Overriding or Replacing Boot Auto Configuration" (the Default and Custom
> JWT Configuration samples), §"Configuring Authorization"
> ([docs.spring.io](https://docs.spring.io/spring-security/reference/servlet/oauth2/resource-server/jwt.html))
> — the Spring Security source `OAuth2ResourceServerConfigurer` (`init`, `configure`,
> `validateConfiguration`, `registerDefaultAccessDeniedHandler`,
> `registerDefaultEntryPoint`, `registerDefaultCsrfOverride`, `BearerTokenRequestMatcher`)
> and `OAuth2AuthorizationManagers`
> ([github.com](https://github.com/spring-projects/spring-security)).
> Spring Security 7 removed `and()`, `authorizeRequests()` and `antMatchers()`; every
> snippet here is the 7.x lambda DSL and was checked against the 7.x reference samples.
> JDK 25 · Spring Boot 4.1.0 · Spring Framework 7.0.8 · Spring Security 7.x (7.1.0).

**A resource server's security configuration is one `@Bean` returning a
`SecurityFilterChain`. In Spring Security 7 the lambda DSL is not a preference — `and()` was
removed, so the chained style every pre-2023 article shows does not compile. That much
[phase 9 chunk 5](../../phase-9-spring-boot/11-spring-security/05-configuring-the-chain.md)
already established. What it did not cover, and what decides whether your chain behaves the
way you think, is that `oauth2ResourceServer(...)` registers an entry point, an access-denied
handler and a CSRF exemption during `init()` — before you have written a single rule.**

## The complete, production-shaped chain

```java
@Configuration
@EnableWebSecurity
class ResourceServerSecurity {

    @Bean
    @Order(10)
    SecurityFilterChain apiChain(HttpSecurity http) throws Exception {
        return http
            .securityMatcher("/api/**")
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(HttpMethod.GET, "/api/orders/**").access(hasScope("orders.read"))
                .requestMatchers(HttpMethod.POST, "/api/orders/**").access(hasScope("orders.write"))
                .anyRequest().authenticated()
            )
            .oauth2ResourceServer(oauth2 -> oauth2
                .jwt(Customizer.withDefaults())
            )
            .sessionManagement(session -> session
                .sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .csrf(CsrfConfigurer::disable)
            .cors(Customizer.withDefaults())
            .exceptionHandling(Customizer.withDefaults())
            .build();
    }

    @Bean
    @Order(1000)
    SecurityFilterChain denyTheRest(HttpSecurity http) throws Exception {
        return http
            .authorizeHttpRequests(auth -> auth.anyRequest().denyAll())
            .build();
    }
}
```

`hasScope` is the static import
`org.springframework.security.oauth2.core.authorization.OAuth2AuthorizationManagers.hasScope`,
which the reference uses in its own samples. Its implementation is exactly what you would
write by hand:

```java
public static <T> AuthorizationManager<T> hasScope(String scope) {
    assertScope(scope);
    return AuthorityAuthorizationManager.hasAuthority("SCOPE_" + scope);
}
```

so `access(hasScope("orders.read"))` and `hasAuthority("SCOPE_orders.read")` are the same
check. The former reads better and cannot be typo'd into a prefix mistake; the latter is
what you will see in older code. `hasAnyScope(...)` and `hasAllScopes(...)` exist alongside
it.

The second bean is the part most configurations are missing —
[04b · Matcher order and chain order](04b-matcher-order.md) explains why it belongs there.

## What `oauth2ResourceServer(...)` does during `init()`

Four things, all of them before your `authorizeHttpRequests` rules are ever evaluated. From
the configurer source:

```java
@Override
public void init(H http) {
    validateConfiguration();
    registerDefaultAccessDeniedHandler(http);
    registerDefaultEntryPoint(http);
    registerDefaultCsrfOverride(http);
    AuthenticationProvider authenticationProvider = getAuthenticationProvider();
    if (authenticationProvider != null) {
        http.authenticationProvider(authenticationProvider);
    }
}
```

**1 · It validates that you configured exactly one token format.** Two assertions, and the
messages are the clearest in the module:

```java
Assert.state(this.jwtConfigurer != null || this.opaqueTokenConfigurer != null,
    "Jwt and Opaque Token are the only supported formats for bearer tokens "
    + "in Spring Security and neither was found. ...");
Assert.state(this.jwtConfigurer == null || this.opaqueTokenConfigurer == null,
    "Spring Security only supports JWTs or Opaque Tokens, not both at the same time.");
```

and, if you supplied an `authenticationManagerResolver`:

```java
Assert.state(this.jwtConfigurer == null && this.opaqueTokenConfigurer == null,
    "If an authenticationManagerResolver() is configured, then it takes "
    + "precedence over any jwt() or opaqueToken() configuration.");
```

**2 · It installs a `BearerTokenAccessDeniedHandler`**, scoped to requests that carry a
bearer token. That is what turns an authorization failure into `403` with
`WWW-Authenticate: Bearer error="insufficient_scope"` rather than a generic Spring 403.

**3 · It installs a `BearerTokenAuthenticationEntryPoint`**, scoped to a `RequestMatcher`
that is the union of "carries a bearer token", `X-Requested-With`, "asks for a non-HTML
media type", and `Accept: */*`. That last set is why a browser hitting a secured API path
directly can get an HTML-ish 401 while your client gets a JSON-friendly one. Both are
[10 · Error responses](10-error-responses.md).

**4 · 🔴 It exempts bearer-token requests from CSRF, on its own.**

```java
private void registerDefaultCsrfOverride(H http) {
    CsrfConfigurer<H> csrf = http.getConfigurer(CsrfConfigurer.class);
    if (csrf != null) {
        csrf.ignoringRequestMatchers(this.requestMatcher);
    }
}
```

where `this.requestMatcher` is a `BearerTokenRequestMatcher` that returns true when the
configured `AuthenticationConverter` can extract a token from the request. This is the fact
that makes most `csrf(CsrfConfigurer::disable)` calls on a resource-server chain
unnecessary — and it has a sharp edge, which is
[04c · Stateless, CSRF and CORS](04c-stateless-csrf-cors.md).

## What it does during `configure()`

```java
BearerTokenAuthenticationFilter filter = new BearerTokenAuthenticationFilter(resolver, converter);
filter.setAuthenticationEntryPoint(this.authenticationEntryPoint);
filter.setSecurityContextHolderStrategy(getSecurityContextHolderStrategy());
filter = postProcess(filter);
http.addFilter(filter);
```

One filter, added at the position `FilterOrderRegistration` assigns — see
[phase 9 chunk 2](../../phase-9-spring-boot/11-spring-security/02-the-filters-that-matter.md)
for why the order is not yours to choose. Then, in Spring Security 7.1, one more:

```java
OAuth2ProtectedResourceMetadataFilter protectedResourceMetadataFilter =
        new OAuth2ProtectedResourceMetadataFilter();
...
http.addFilterBefore(protectedResourceMetadataFilter, AbstractPreAuthenticatedProcessingFilter.class);
```

That filter serves `/.well-known/oauth-protected-resource` and is added **unconditionally**
whenever `oauth2ResourceServer` is configured. It is
[10c · Protected resource metadata](10c-protected-resource-metadata.md), and it is new
enough that no tutorial mentions it.

## The DSL methods that exist on `oauth2ResourceServer`

From the 7.x configurer, in the order you are likely to need them:

| Method | Purpose |
|---|---|
| `jwt(Customizer)` | local JWT validation |
| `opaqueToken(Customizer)` | RFC 7662 introspection |
| `authenticationManagerResolver(...)` | pick the manager per request — multi-tenancy |
| `bearerTokenResolver(...)` | where the token is read from |
| `authenticationConverter(...)` | request → `Authentication` request object |
| `authenticationEntryPoint(...)` | the 401 |
| `accessDeniedHandler(...)` | the 403 |
| `dPoP(Customizer)` | RFC 9449 sender-constrained tokens (7.1) |
| `protectedResourceMetadata(Customizer)` | customise the RFC 9728 document (7.1) |

Inside `jwt(...)`: `decoder(...)`, `jwkSetUri(...)`, `jwtAuthenticationConverter(...)`,
`authenticationManager(...)`. Inside `opaqueToken(...)`: `introspector(...)`,
`introspectionUri(...)`, `introspectionClientCredentials(id, secret)`,
`authenticationConverter(...)`, `authenticationManager(...)`.

Note what is *not* there: there is no `audiences(...)`, no `issuer(...)` and no
`validator(...)` on the DSL. Validation is a property of the `JwtDecoder`, not of the
chain — which is why [06b · Composing validators](06b-composing-validators.md) is a
separate discussion from this one.

## Gotchas

**★ `oauth2ResourceServer(Customizer.withDefaults())` with nothing inside it fails at
startup.**
The configurer asserts that exactly one of `jwt()` or `opaqueToken()` was configured. The
message — *"Jwt and Opaque Token are the only supported formats … and neither was found"* —
is accurate but people read it as a dependency problem.

**★ `csrf(CsrfConfigurer::disable)` on a resource-server chain is usually redundant and
occasionally harmful.**
`registerDefaultCsrfOverride` already exempts requests carrying a bearer token. Disabling
CSRF outright also exempts requests that *do not* carry one — including cookie-authenticated
ones if anything else in the chain can authenticate them. See
[04c](04c-stateless-csrf-cors.md).

**★ There is no `and()` and there is no `authorizeRequests()`.**
Spring Security 7 removed both, along with `antMatchers()`, `mvcMatchers()` and
`regexMatchers()`. Anything you paste from a pre-2023 article will not compile, and the
compiler error points at the method, not at the version.

**★ `@EnableWebSecurity` is optional under Boot but `@Order` is not.**
Without `@Order`, chain precedence depends on bean definition order, which depends on
configuration-class processing order. Two chains and no orders is a configuration that
changes behaviour when someone moves a method.

**★ You cannot configure both `jwt()` and `opaqueToken()` on one chain.**
By assertion, at startup. Two separate chains with different `securityMatcher`s works; one
chain with an `AuthenticationManagerResolver` works; both configurers on one chain does not.

**★ `authenticationManagerResolver(...)` silently forbids `jwt()` and `opaqueToken()`.**
Not silently, actually — it asserts. But the reason is worth internalising: the resolver
*is* the thing that chooses a manager, so a statically configured manager would have nothing
to do.

**★ The protected-resource-metadata filter is added whether you asked for it or not.**
In 7.1, `oauth2ResourceServer` always registers `OAuth2ProtectedResourceMetadataFilter`.
If `/.well-known/oauth-protected-resource` matters to you — for exposure review, or because
it now appears in your route table — see [10c](10c-protected-resource-metadata.md).

**★ Validation cannot be configured from the chain DSL.**
No `audiences`, no `issuer`, no `validator`. If your mental model is "everything is in the
chain bean", you will look for audience validation in the wrong file. It lives on the
`JwtDecoder`, or in Boot properties, or in an `OAuth2TokenValidator<Jwt>` bean.

## Interview questions

**★ Write the minimal Spring Security 7 resource-server chain from memory.**
A `@Bean` returning `http.authorizeHttpRequests(auth -> auth.anyRequest().authenticated())
.oauth2ResourceServer(oauth2 -> oauth2.jwt(Customizer.withDefaults())).build()`. Everything
else — session policy, CSRF, CORS, matchers — is a decision layered on top. Note there is
no `and()`, no `authorizeRequests()` and no `antMatchers()` in Spring Security 7.

**★ What does `oauth2ResourceServer(...)` register besides a filter?**
During `init()`: a `BearerTokenAccessDeniedHandler` and a
`BearerTokenAuthenticationEntryPoint`, both scoped to bearer-token requests, plus a CSRF
exemption for those same requests, plus the `AuthenticationProvider` for the chosen token
format. During `configure()`: the `BearerTokenAuthenticationFilter` and, in 7.1, the
protected-resource-metadata filter.

**★ Why does Spring Security refuse to let one chain accept both JWTs and opaque tokens?**
Because the chain has exactly one `AuthenticationManager` for bearer tokens and the two
formats need different providers. The framework makes you say how the choice is made rather
than guessing: either two chains with different `securityMatcher`s, or one chain with an
`AuthenticationManagerResolver` that picks per request.

**★ `access(hasScope("orders.read"))` versus `hasAuthority("SCOPE_orders.read")` — is there
a functional difference?**
No. `OAuth2AuthorizationManagers.hasScope` returns
`AuthorityAuthorizationManager.hasAuthority("SCOPE_" + scope)`. The value of the helper is
that the prefix cannot be forgotten or doubled, and that the call site says "scope" rather
than "authority that happens to start with SCOPE_" — which matters for the argument in
[07e · Roles are not scopes](07e-roles-are-not-scopes.md).

**★ Where does audience validation go in the chain DSL?**
Nowhere — it is not a chain concern. The `oauth2ResourceServer` DSL has no `audiences`
method. Audience is validated by the `JwtDecoder`'s `OAuth2TokenValidator<Jwt>`, configured
via the `spring.security.oauth2.resourceserver.jwt.audiences` property, via a
`JwtAudienceValidator` composed onto the defaults, or via an `OAuth2TokenValidator<Jwt>`
bean that Boot picks up.

{/* FOOTER */}
