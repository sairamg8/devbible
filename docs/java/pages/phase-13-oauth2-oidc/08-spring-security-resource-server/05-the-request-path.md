---
title: "One request, seven objects: tracing a bearer token from the Authorization header to the SecurityContext is the only way to know which component to fix, and the last hop adds an authority to your token that Spring Security 7 invented"
sidebar_label: "05 · The request path"
sidebar_position: 10
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against the Spring Security 7.x reference — *OAuth 2.0 Resource
> Server* index §"Reading the Bearer Token" (the numbered filter walkthrough)
> ([docs.spring.io](https://docs.spring.io/spring-security/reference/servlet/oauth2/resource-server/index.html)),
> *OAuth 2.0 Resource Server JWT* §"How JWT Authentication Works"
> ([docs.spring.io](https://docs.spring.io/spring-security/reference/servlet/oauth2/resource-server/jwt.html))
> — and the Spring Security sources `BearerTokenAuthenticationFilter#doFilterInternal`,
> `JwtAuthenticationProvider#authenticate`/`getJwt`, `JwtAuthenticationConverter#convert`,
> `FactorGrantedAuthority` (`BEARER_AUTHORITY = "FACTOR_BEARER"`, `@since 7.0`)
> ([github.com](https://github.com/spring-projects/spring-security)).
> JDK 25 · Spring Boot 4.1.1 · Spring Framework 7.0.9 · Spring Security 7.x (7.1.0).

**Every 401 you will ever debug on a resource server happened at one of seven places, and
they fail in ways that look identical from outside. Knowing the sequence — converter,
filter, resolver, `ProviderManager`, provider, decoder, authentication converter — turns
"the token is rejected" into "the third step rejected it, here is the class". This chunk
walks the path once, in order, naming what each object is allowed to throw.**

The two behaviours the last step adds on its own — the authority merge and the DPoP downgrade
rejection — plus the symptom-to-step debugging table are
[05d · Step 7 and the debug table](05d-step-7-surprises-and-the-debug-table.md).

## The sequence

The reference numbers it; here it is with the classes and the failure each produces.

**1 · `BearerTokenAuthenticationFilter` asks an `AuthenticationConverter` for the token.**

```java
Authentication authenticationRequest;
try {
    authenticationRequest = this.authenticationConverter.convert(request);
}
catch (OAuth2AuthenticationException invalid) {
    this.logger.trace("Sending to authentication entry point since failed to resolve bearer token", invalid);
    this.authenticationEntryPoint.commence(request, response, invalid);
    return;
}

if (authenticationRequest == null) {
    this.logger.trace("Did not process request since did not find bearer token");
    filterChain.doFilter(request, response);
    return;
}
```

Two distinct outcomes and the difference matters enormously:

- **`null` — no token present.** The filter does nothing and the chain continues. The
  request is *anonymous*, not rejected. Whether it succeeds is now purely an
  `authorizeHttpRequests` question.
- **Exception — a token was present and malformed.** The entry point commences immediately.
  Details of what counts as malformed are
  [05b · Bearer token resolution](05b-bearer-token-resolution.md).

**2 · The filter resolves an `AuthenticationManager` from the request.**

> *"Next, the `HttpServletRequest` is passed to the `AuthenticationManagerResolver`, which
> selects the `AuthenticationManager`."*

In the single-tenant case the configurer wraps a fixed manager in a trivial resolver
(`resolver = (request) -> authenticationManager;`). In the multi-tenant case this is where
`JwtIssuerAuthenticationManagerResolver` reads the *unverified* `iss` claim to pick a
manager — **09 · Multi-tenancy** *(not written yet)*.

**3 · `ProviderManager` delegates to `JwtAuthenticationProvider`.** Standard Spring Security
plumbing; the provider `supports(BearerTokenAuthenticationToken.class)`.

**4 · The provider calls `JwtDecoder.decode(...)`, and this is where the exception taxonomy
lives.**

```java
private Jwt getJwt(BearerTokenAuthenticationToken bearer) {
    try {
        return this.jwtDecoder.decode(bearer.getToken());
    }
    catch (BadJwtException failed) {
        this.logger.debug("Failed to authenticate since the JWT was invalid");
        throw new InvalidBearerTokenException(
                (failed.getMessage() != null) ? failed.getMessage() : "Invalid token", failed);
    }
    catch (JwtException failed) {
        throw new AuthenticationServiceException(
                (failed.getMessage() != null) ? failed.getMessage() : "Invalid token", failed);
    }
}
```

🔴 **Read the two catch blocks.** `BadJwtException` — the token is bad — becomes
`InvalidBearerTokenException`, which is a `401 invalid_token`. Any *other* `JwtException`
— which is what `NimbusJwtDecoder` throws when the JWK set cannot be fetched or is
malformed — becomes `AuthenticationServiceException`, which is a **500**.

That is correct behaviour and almost nobody expects it. "The IdP is unreachable" is not the
client's fault, so the client does not get a 401 telling it to fetch a new token; it gets a
server error telling it to retry. The `NimbusJwtDecoder` source draws the line explicitly:

```java
throw new BadJwtException(String.format(DECODING_ERROR_MESSAGE_TEMPLATE, "Malformed token"), ex);
...
throw new JwtException(String.format(DECODING_ERROR_MESSAGE_TEMPLATE, "Malformed Jwk set"), ex);
```

Malformed **token** → 401. Malformed or unreachable **JWK set** → 500.

**5 · The decoder verifies the signature and then runs its `OAuth2TokenValidator<Jwt>`.**
Validation failures produce a `JwtValidationException`, which extends `BadJwtException`, so
they land in the first catch block and become 401s. Which validators run is
[06 · The default validators](06-the-default-validators.md).

**6 · The provider calls the `JwtAuthenticationConverter`.**

```java
@Override
public final AbstractAuthenticationToken convert(Jwt jwt) {
    Collection<GrantedAuthority> authorities = new HashSet<>(this.jwtGrantedAuthoritiesConverter.convert(jwt));
    authorities.add(FactorGrantedAuthority.fromAuthority(AUTHORITY));
    OAuth2AuthenticatedPrincipal principal = this.jwtPrincipalConverter.convert(jwt);
    authorities.addAll(principal.getAuthorities());
    return new JwtAuthenticationToken(jwt, principal, authorities);
}
```

Three things worth pinning:

- `convert` is **`final`**. You extend the behaviour by setting
  `jwtGrantedAuthoritiesConverter` or `jwtPrincipalConverter`, never by overriding.
- `AUTHORITY` is `FactorGrantedAuthority.BEARER_AUTHORITY`, whose value is the string
  `FACTOR_BEARER`. Spring Security 7 adds it to **every** bearer-authenticated token. The
  reference says so: *"a set of authorities that contains at least `FACTOR_BEARER`"*.
- The principal's own authorities are merged in, which is how a
  `UserDetailsService`-backed principal converter contributes authorities
  (**07b · The converters** *(not written yet)*).

**7 · The filter installs the result.**

```java
SecurityContext context = this.securityContextHolderStrategy.createEmptyContext();
context.setAuthentication(authenticationResult);
this.securityContextHolderStrategy.setContext(context);
this.securityContextRepository.saveContext(context, request, response);
```

The default `securityContextRepository` on this filter is
`RequestAttributeSecurityContextRepository` — request-scoped, nothing persisted. That is why
the bearer path is stateless even before you set `SessionCreationPolicy.STATELESS`
([04c](04c-stateless-csrf-cors.md) explains what `STATELESS` is actually for).

## Gotchas

**★ A missing token is not an error at this layer.**
The converter returns `null`, the filter calls `doFilter` and the request continues
anonymously. Whether that is a 401 or a 200 is decided later by `authorizeHttpRequests` and
`ExceptionTranslationFilter`. Debugging a "401 with no token" at the bearer filter is
looking in the wrong place.

**★ `JwtAuthenticationConverter.convert` is `final`.**
Subclassing to change the authority mapping does not compile. Set
`setJwtGrantedAuthoritiesConverter(...)` or `setJwtPrincipalConverter(...)`, or supply a
completely different `Converter<Jwt, AbstractAuthenticationToken>` to the DSL.

**★ The filter's `SecurityContextRepository` is request-scoped by default.**
`RequestAttributeSecurityContextRepository`. Nothing persists. If you were relying on the
bearer filter to populate a session for a later request, it never did.

**★ The `iss` claim is read before the signature is verified in the multi-tenant path.**
Step 2 parses the token to pick a manager. That is unavoidable — you cannot verify without
knowing which keys to use — and it is exactly why the trusted-issuer allow-list is
mandatory. See **09 · Multi-tenancy** *(not written yet)*.

## Interview questions

**★ Walk a bearer token from the HTTP header to the `SecurityContext`.**
`BearerTokenAuthenticationFilter` asks an `AuthenticationConverter` (wrapping a
`BearerTokenResolver`) for the token and builds a `BearerTokenAuthenticationToken`. It
resolves an `AuthenticationManager` from the request via an `AuthenticationManagerResolver`.
`ProviderManager` delegates to `JwtAuthenticationProvider`, which calls `JwtDecoder.decode`
— signature verification plus the composed `OAuth2TokenValidator<Jwt>` — and then a
`JwtAuthenticationConverter` to produce a `JwtAuthenticationToken` whose principal is the
`Jwt` and whose authorities include the mapped scopes plus `FACTOR_BEARER`. The filter puts
that on the `SecurityContextHolder` and continues the chain.

**★ What happens if a request arrives with no `Authorization` header at all?**
The converter returns `null`, the bearer filter logs a trace message and calls
`filterChain.doFilter`. The request continues as anonymous. It is `AuthorizationFilter` and
then `ExceptionTranslationFilter` that turn "anonymous and the rule says authenticated" into
a 401 with a `WWW-Authenticate` header — not the bearer filter.

**★ You want to add a claim-derived attribute to the `Authentication`. Where do you hook
in?**
Not by subclassing `JwtAuthenticationConverter` — `convert` is `final`. Either set a
`jwtPrincipalConverter` (7.1) to produce a richer `OAuth2AuthenticatedPrincipal`, set a
`jwtGrantedAuthoritiesConverter` if it is really an authority, or supply your own
`Converter<Jwt, AbstractAuthenticationToken>` to `jwt().jwtAuthenticationConverter(...)` —
remembering that the last option means you are now responsible for adding `FACTOR_BEARER`
yourself if anything depends on it.

---

← [STATELESS, CSRF and CORS](04c-stateless-csrf-cors.md) · [Topic index](README.md) · Next → [Bearer token resolution](05b-bearer-token-resolution.md)
