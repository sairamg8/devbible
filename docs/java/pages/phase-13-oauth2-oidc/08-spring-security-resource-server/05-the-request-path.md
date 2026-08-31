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
> JDK 25 · Spring Boot 4.1.0 · Spring Framework 7.0.8 · Spring Security 7.x (7.1.0).

**Every 401 you will ever debug on a resource server happened at one of seven places, and
they fail in ways that look identical from outside. Knowing the sequence — converter,
filter, resolver, `ProviderManager`, provider, decoder, authentication converter — turns
"the token is rejected" into "the third step rejected it, here is the class". This chunk
walks the path once, in order, naming what each object is allowed to throw.**

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

## Two behaviours in step 7 that will surprise you

**Authorities merge with an already-authenticated request.** Just before installing the
context:

```java
Authentication current = this.securityContextHolderStrategy.getContext().getAuthentication();
if (current != null && current.isAuthenticated() && declaresToBuilder(authenticationResult)) {
    authenticationResult = authenticationResult.toBuilder().authorities((a) -> {
        Set<String> newAuthorities = a.stream()
            .map(GrantedAuthority::getAuthority)
            .collect(Collectors.toUnmodifiableSet());
        for (GrantedAuthority currentAuthority : current.getAuthorities()) {
            if (!newAuthorities.contains(currentAuthority.getAuthority())) {
                a.add(currentAuthority);
            }
        }
    }).build();
}
```

The reference states the same thing in prose: *"Any already-authenticated `Authentication`
in the `SecurityContextHolder` is loaded and its authorities are added to the returned
`Authentication`."* This is the multi-factor machinery — a session-authenticated user who
also presents a bearer token ends up with the union — and on a chain that is genuinely
stateless it never fires, because there is no pre-existing authentication.

**A DPoP-bound token presented as a plain bearer token is rejected.**

```java
if (isDPoPBoundAccessToken(authenticationResult)) {
    // Prevent downgraded usage of DPoP-bound access tokens,
    // by rejecting a DPoP-bound access token received as a bearer token.
    BearerTokenError error = BearerTokenErrors.invalidToken("Invalid bearer token");
    throw new OAuth2AuthenticationException(error);
}
```

Sender-constrained tokens (RFC 9449) must not be usable without the proof, so a stolen one
cannot be replayed through the bearer path. Sender constraining is
**14 · mTLS and workload identity** *(not written yet)*.

## The whole path as a debugging table

| Symptom | Step | Object | Likely cause |
|---|---|---|---|
| 200, principal anonymous | 1 | converter returned `null` | header absent or not `Bearer` |
| 401 `invalid_request` | 1 | `DefaultBearerTokenResolver` | two tokens in one request |
| 401 `invalid_token` "Bearer token is malformed" | 1 | resolver regex | stray whitespace, quotes, `Bearer:` |
| 401 `invalid_token` "Invalid issuer" | 2 | `JwtIssuerAuthenticationManagerResolver` | `iss` not in the trusted list |
| 401 `invalid_token` "Unsupported algorithm of …" | 4 | `NimbusJwtDecoder` | `alg` not in the trusted set |
| 401 `invalid_token` "The iss claim is not valid" | 5 | `JwtIssuerValidator` | `issuer-uri` mismatch |
| 401 `invalid_token` "Jwt expired at …" | 5 | `JwtTimestampValidator` | genuine expiry or clock skew |
| **500** | 4 | `AuthenticationServiceException` | JWK set unreachable or malformed |
| 403 `insufficient_scope` | after 7 | `AuthorizationFilter` | authenticated, wrong authorities |

The 500 row is the one people misfile. If your error rate shows 500s rather than 401s during
an IdP incident, that is the system working as designed and telling you the truth.

## Gotchas

**★ A missing token is not an error at this layer.**
The converter returns `null`, the filter calls `doFilter` and the request continues
anonymously. Whether that is a 401 or a 200 is decided later by `authorizeHttpRequests` and
`ExceptionTranslationFilter`. Debugging a "401 with no token" at the bearer filter is
looking in the wrong place.

**★ An unreachable JWK set produces 500, not 401.**
`JwtException` that is not a `BadJwtException` becomes `AuthenticationServiceException`.
Alerting that only watches 401s will miss an IdP outage entirely; alerting that treats 500s
as "our bug" will send the wrong team.

**★ `JwtAuthenticationConverter.convert` is `final`.**
Subclassing to change the authority mapping does not compile. Set
`setJwtGrantedAuthoritiesConverter(...)` or `setJwtPrincipalConverter(...)`, or supply a
completely different `Converter<Jwt, AbstractAuthenticationToken>` to the DSL.

**★ Every bearer-authenticated principal carries `FACTOR_BEARER` in Spring Security 7.**
It is added unconditionally by the converter. If you assert on the exact authority set in a
test — `containsExactly("SCOPE_read")` — that test breaks on upgrade to 7.x and the failure
looks like your converter changed.

**★ A custom `Converter<Jwt, AbstractAuthenticationToken>` supplied to the DSL replaces the
whole `JwtAuthenticationConverter`, including the `FACTOR_BEARER` addition.**
If anything in your policy or in a library depends on that authority, it disappears.

**★ The filter's `SecurityContextRepository` is request-scoped by default.**
`RequestAttributeSecurityContextRepository`. Nothing persists. If you were relying on the
bearer filter to populate a session for a later request, it never did.

**★ The `iss` claim is read before the signature is verified in the multi-tenant path.**
Step 2 parses the token to pick a manager. That is unavoidable — you cannot verify without
knowing which keys to use — and it is exactly why the trusted-issuer allow-list is
mandatory. See **09 · Multi-tenancy** *(not written yet)*.

**★ A DPoP-bound token sent as a bearer token is rejected as `invalid_token`.**
Deliberately, to prevent downgrade. The client's error message says nothing about DPoP, so
this reads as an inexplicable rejection of a token the client believes is fine.

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

**★ Why does an unreachable JWKS endpoint produce a 500 rather than a 401?**
Because `JwtAuthenticationProvider` distinguishes `BadJwtException` — the token is bad,
which is the client's problem and maps to `invalid_token`/401 — from every other
`JwtException`, which it wraps in `AuthenticationServiceException`. An infrastructure
failure is not evidence that the credential is invalid, so telling the client to get a new
token would be a lie.

**★ What is `FACTOR_BEARER` and when did it appear?**
A `FactorGrantedAuthority` constant, `@since 7.0`, added unconditionally by
`JwtAuthenticationConverter` (and by the opaque-token converter) to every successfully
authenticated bearer request. It exists so that authorization rules can reason about *how*
the caller authenticated, which is the foundation of Spring Security 7's step-up and
multi-factor support.

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

**★ Under what circumstances does the bearer filter merge authorities from an existing
`Authentication`?**
When the `SecurityContextHolder` already contains an authenticated `Authentication` when the
bearer filter runs, and the new result supports `toBuilder()`. The existing authorities that
are not already present are added. On a `STATELESS` chain this never happens, because
nothing loaded a context; on a mixed chain it is how a session-authenticated user who also
sends a token ends up with the union of both.

{/* FOOTER */}
