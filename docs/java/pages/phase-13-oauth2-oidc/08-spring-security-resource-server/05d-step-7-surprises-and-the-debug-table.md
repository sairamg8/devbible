---
title: "The last hop of the request path does two things nobody configured — it merges authorities from an existing authentication and it rejects a DPoP-bound token presented as a bearer token — and the seven-step sequence turns into a debugging table where the row people misfile is the 500"
sidebar_label: "05d · Step 7 and the debug table"
sidebar_position: 13
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against the Spring Security 7.x reference — *OAuth 2.0 Resource
> Server* index §"Reading the Bearer Token"
> ([docs.spring.io](https://docs.spring.io/spring-security/reference/servlet/oauth2/resource-server/index.html)),
> *OAuth 2.0 Resource Server JWT* §"How JWT Authentication Works"
> ([docs.spring.io](https://docs.spring.io/spring-security/reference/servlet/oauth2/resource-server/jwt.html))
> — and the Spring Security 7.0.x sources `BearerTokenAuthenticationFilter#doFilterInternal`,
> `JwtAuthenticationProvider#authenticate`, `JwtAuthenticationConverter#convert`,
> `FactorGrantedAuthority` (`BEARER_AUTHORITY = "FACTOR_BEARER"`, `@since 7.0`),
> `BearerTokenErrors` ([github.com](https://github.com/spring-projects/spring-security));
> RFC 9449 §7 (DPoP, protecting against downgrade)
> ([datatracker.ietf.org/doc/html/rfc9449](https://datatracker.ietf.org/doc/html/rfc9449)).
> JDK 25 · Spring Boot 4.1.0 · Spring Framework 7.0.8 · **Spring Security 7.x (7.1.0)**.
> **No sandbox** — quoted sources and javadoc only; error strings are quoted from the
> framework, never reconstructed from a run.

**[The seven steps](05-the-request-path.md) describe what the framework was asked to do.
This chunk is the two things it does at step 7 that nobody asked for, and the table that
turns the whole sequence into a five-second diagnosis. Both step-7 behaviours are new enough
that most published material predates them, and both produce failures whose error message
points nowhere near the cause: a test that asserts on an exact authority set breaks on
upgrade, and a correctly-issued token is rejected with a message that never mentions why.**

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

**★ An unreachable JWK set produces 500, not 401.**
`JwtException` that is not a `BadJwtException` becomes `AuthenticationServiceException`.
Alerting that only watches 401s will miss an IdP outage entirely; alerting that treats 500s
as "our bug" will send the wrong team. The fix is to split the alert, not the code:

```java
// A 5xx from the resource server during an IdP incident is correct behaviour.
// Alert on it as an *upstream* signal, not as an application defect.
management.metrics.tags.component=resource-server
```

**★ Every bearer-authenticated principal carries `FACTOR_BEARER` in Spring Security 7.**
It is added unconditionally by the converter. If you assert on the exact authority set in a
test — `containsExactly("SCOPE_read")` — that test breaks on upgrade to 7.x and the failure
looks like your converter changed. Assert on containment instead:

```java
assertThat(auth.getAuthorities())
        .extracting(GrantedAuthority::getAuthority)
        .contains("SCOPE_read");            // not containsExactly
```

**★ A custom `Converter<Jwt, AbstractAuthenticationToken>` supplied to the DSL replaces the
whole `JwtAuthenticationConverter`, including the `FACTOR_BEARER` addition.**
If anything in your policy or in a library depends on that authority, it disappears. Add it
back yourself:

```java
Converter<Jwt, AbstractAuthenticationToken> converter = jwt -> {
    Collection<GrantedAuthority> authorities = new ArrayList<>(mapScopes(jwt));
    authorities.add(FactorGrantedAuthority.fromAuthority(
            FactorGrantedAuthority.BEARER_AUTHORITY));      // do not silently drop it
    return new JwtAuthenticationToken(jwt, authorities);
};
```

**★ A DPoP-bound token sent as a bearer token is rejected as `invalid_token`.**
Deliberately, to prevent downgrade. The client's error message says nothing about DPoP, so
this reads as an inexplicable rejection of a token the client believes is fine. The
diagnosis is in the token, not the server — a DPoP-bound token carries a `cnf` claim with a
`jkt` thumbprint:

```java
// Decode without validating, purely to diagnose: is this token sender-constrained?
Map<String, Object> cnf = (Map<String, Object>) jwt.getClaims().get("cnf");
boolean dpopBound = cnf != null && cnf.containsKey("jkt");   // RFC 9449 §6.1
```

If `dpopBound` is true, the client must present it on the DPoP scheme, not `Bearer`.

**★ The authority merge fires on a chain you thought was stateless.**
`SessionCreationPolicy.STATELESS` stops Spring *creating* a session; it does not stop a
`SecurityContext` being present because an earlier filter in the same chain put one there.
If you mix form login and bearer auth in one chain, a browser session and a token in the
same request produce the union of both authority sets, and a `@PreAuthorize` that should
have failed passes. Separate the chains rather than reasoning about the merge:

```java
@Bean
@Order(1)
SecurityFilterChain api(HttpSecurity http) throws Exception {
    return http.securityMatcher("/api/**")
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .oauth2ResourceServer(o -> o.jwt(Customizer.withDefaults()))
            .build();
}
```

**★ The debugging table's step numbers are the *only* thing distinguishing two identical
401s.**
`"The iss claim is not valid"` from `JwtIssuerValidator` (step 5) and `"Invalid issuer"`
from `JwtIssuerAuthenticationManagerResolver` (step 2) are different failures with nearly
identical wording. The first means the token was decoded and its issuer did not match your
`issuer-uri`; the second means no trusted manager exists for that issuer at all, and the
token was never decoded. Turn on `logging.level.org.springframework.security=TRACE` and the
step is unambiguous.

## Interview questions

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

**★ Under what circumstances does the bearer filter merge authorities from an existing
`Authentication`?**
When the `SecurityContextHolder` already contains an authenticated `Authentication` when the
bearer filter runs, and the new result supports `toBuilder()`. The existing authorities that
are not already present are added. On a `STATELESS` chain this never happens, because
nothing loaded a context; on a mixed chain it is how a session-authenticated user who also
sends a token ends up with the union of both.

**★ Is the authority merge a vulnerability?**
Not by itself — it is the mechanism that makes step-up authentication expressible, and both
credentials were genuinely presented and independently verified. It becomes a problem when a
chain mixes two authentication mechanisms *unintentionally*, because the resulting authority
set is one neither mechanism would have granted alone. The defensible position is to make
the mixing deliberate: one chain per mechanism, or an explicit policy that says which
combinations of `FACTOR_` authorities satisfy which rule.

**★ Why does the specification want a DPoP-bound token rejected on the bearer scheme rather
than simply accepted?**
Because accepting it would make sender-constraining opt-out at the attacker's discretion. If
a stolen DPoP-bound token could be replayed as a plain bearer token, the proof-of-possession
key would defend nothing — the whole point of RFC 9449 is that possession of the token is
insufficient. Rejecting the downgrade is what converts "bound" from a label into a property.

**★ Your dashboards show a spike of 401s with `invalid_token` and a flat 500 line during an
IdP incident. What does that tell you?**
That the JWK set is still being served — the decoder is reaching it and getting keys — so
the failure is in the tokens themselves rather than in key retrieval. That points at issuance
rather than at discovery: expired tokens because refresh is failing, or newly-minted tokens
signed with a key the cached JWK set does not yet contain. A flat 500 line rules out the
unreachable-JWKS path entirely, which is exactly why the two are worth separating on the
dashboard.

---

← [Alternative token transports](05c-alternative-token-transports.md) · [Topic index](README.md) · Next → [The default validators](06-the-default-validators.md)
