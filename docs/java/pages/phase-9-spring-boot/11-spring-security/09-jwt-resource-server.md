---
title: "The stateless JWT resource server"
sidebar_label: "9 · JWT resource server"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against the Spring Security reference — *OAuth 2.0
> Resource Server JWT*
> (docs.spring.io/spring-security/reference/servlet/oauth2/resource-server/jwt.html
> — `issuer-uri`, `jwk-set-uri`, `audiences`, `jws-algorithms`,
> `NimbusJwtDecoder`, `JwtDecoders`, the four default validations,
> `JwtValidators.createDefaultWithIssuer`, `DelegatingOAuth2TokenValidator`,
> `JwtTimestampValidator`, `JwtIssuerValidator`). Spring Boot 4.1.0, Spring
> Security 7.x, JDK 25.

**A resource server does exactly one job: take a signed token off the request,
check that it is genuine and applicable, and turn its claims into an
`Authentication`. It never talks to a user, never issues a token, and never runs
a login flow — all of which belong to the authorization server. Keeping that
boundary clear is most of what makes this configuration short.**

The *flows* — authorization code with PKCE, client credentials, refresh, the
OIDC ID token — are
[Phase 13 — OAuth2 and OIDC](../../phase-13-oauth2-oidc/README.md)'s subject.
This chunk is only what your service does with the token it is handed;
[chunk 10](10-claims-to-authorities.md) is what it does with the claims once it
trusts them.

## The whole configuration

```yaml
spring:
  security:
    oauth2:
      resourceserver:
        jwt:
          issuer-uri: https://idp.example.com/issuer
          audiences: https://orders.example.com
```

```java
@Bean
SecurityFilterChain apiChain(HttpSecurity http) throws Exception {
    return http
        .securityMatcher("/api/**")
        .authorizeHttpRequests(auth -> auth.anyRequest().authenticated())
        .oauth2ResourceServer(oauth2 -> oauth2.jwt(Customizer.withDefaults()))
        .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        .csrf(CsrfConfigurer::disable)
        .cors(Customizer.withDefaults())
        .build();
}
```

That is a complete, production-shaped resource server. The dependencies are
`spring-security-oauth2-resource-server` and `spring-security-oauth2-jose` — the
second is what actually decodes and verifies the JWT, and omitting it produces a
startup failure naming a class rather than the missing library.

`oauth2ResourceServer(...jwt(...))` adds the `BearerTokenAuthenticationFilter`
described in [chunk 2](02-the-filters-that-matter.md), which reads
`Authorization: Bearer …` and delegates to a `JwtAuthenticationProvider`.

## What `issuer-uri` buys

Given only an issuer, Spring Security fetches the provider's metadata document
(the OpenID Provider Configuration or OAuth 2.0 Authorization Server Metadata
endpoint) and learns the JWK Set URL from it. It then fetches the public keys
from that URL and caches them, refreshing when a token arrives with a key id it
does not recognise.

Three consequences worth internalising:

- **Your service makes an outbound call at startup or first use.** If the IdP is
  unreachable, nothing can be verified. That is a real runtime dependency and
  belongs in your availability thinking, not just your configuration.
- **Key rotation is handled for you.** The IdP publishes a new key, tokens start
  arriving with a new `kid`, the JWK set is re-fetched. You do nothing.
- **No shared secret exists.** The service holds a *public* key: it can verify
  tokens and cannot mint them. That asymmetry is why a compromised resource
  server cannot forge identities for the rest of the estate.

If the provider has no discovery endpoint, name the JWK set directly:

```yaml
spring:
  security:
    oauth2:
      resourceserver:
        jwt:
          issuer-uri: https://idp.example.com
          jwk-set-uri: https://idp.example.com/.well-known/jwks.json
```

## What is validated, by default

The reference lists four automatic checks:

1. **The signature**, against the public keys from the JWK set.
2. **`exp`** — the token has not expired.
3. **`nbf`** — it is not being used before its not-before time.
4. **`iss`** — the issuer matches the configured one.

Add the audience, because it is the check that stops a token minted for another
service being replayed at yours:

```yaml
spring:
  security:
    oauth2:
      resourceserver:
        jwt:
          issuer-uri: https://idp.example.com
          audiences: https://orders.example.com
```

**A valid signature is not authorization.** A token your IdP issued for a
completely different application is cryptographically perfect and has no
business being accepted here. Issuer plus audience is what turns "genuine" into
"genuine, and meant for me".

You can also pin the accepted algorithms, which matters if you want to be
explicit about what you will honour rather than accepting whatever the JWK set
offers:

```yaml
spring:
  security:
    oauth2:
      resourceserver:
        jwt:
          jws-algorithms: RS256
```

## Doing it in Java, when you need more

```java
@Bean
JwtDecoder jwtDecoder() {
    NimbusJwtDecoder decoder = NimbusJwtDecoder.withIssuerLocation(this.issuer).build();

    OAuth2TokenValidator<Jwt> withClockSkew = new DelegatingOAuth2TokenValidator<>(
            new JwtTimestampValidator(Duration.ofSeconds(60)),
            new JwtIssuerValidator(this.issuer));

    decoder.setJwtValidator(withClockSkew);
    return decoder;
}
```

🔴 Note what `setJwtValidator` does: it **replaces** the validator, it does not
add to it. Set only an audience validator and you have just switched off the
issuer and timestamp checks — and your own tokens still pass, so no test fails.
The documented pattern is to compose explicitly on top of the defaults:

```java
static class AudienceValidator implements OAuth2TokenValidator<Jwt> {
    private final OAuth2Error error =
            new OAuth2Error("invalid_token", "Required audience is missing", null);

    @Override
    public OAuth2TokenValidatorResult validate(Jwt jwt) {
        return jwt.getAudience().contains("https://orders.example.com")
                ? OAuth2TokenValidatorResult.success()
                : OAuth2TokenValidatorResult.failure(this.error);
    }
}

@Bean
JwtDecoder jwtDecoder() {
    NimbusJwtDecoder decoder =
            (NimbusJwtDecoder) JwtDecoders.fromIssuerLocation(this.issuerUri);

    OAuth2TokenValidator<Jwt> withIssuer =
            JwtValidators.createDefaultWithIssuer(this.issuerUri);   // ← keeps exp/nbf/iss
    decoder.setJwtValidator(
            new DelegatingOAuth2TokenValidator<>(withIssuer, new AudienceValidator()));

    return decoder;
}
```

`JwtValidators.createDefaultWithIssuer(...)` is the piece that preserves the
defaults. Forgetting it is a silent downgrade.

`JwtTimestampValidator(Duration)` is also how you tolerate clock skew between the
IdP and your host — 60 seconds is the reference's own example. Without it, and
with a host clock a little ahead, freshly issued tokens are rejected as expired,
which reads as an inexplicable intermittent 401.

## The trade-off

Self-contained tokens buy statelessness: no session store, no lookup per
request, and any instance can serve any caller. What they cost is
**revocation**. A token is valid until it expires, because validity is a
property of the token rather than of a record you can delete. Log a user out,
disable an account, strip a role — every token already issued keeps working.

The standard mitigations are short lifetimes with refresh tokens (Phase 13's
material), and, where revocation must be immediate, a denylist checked per
request — which reintroduces exactly the shared state the design removed. There
is no free version of this. What you are choosing is the size of the exposure
window, and it should be a decision somebody wrote down.

## Gotchas

**Symptom:** Every request is 401, the `WWW-Authenticate` header says the token
is invalid, and the token looks fine when you decode it.
**Cause:** Issuer mismatch — a trailing slash, `http` versus `https`, or an
internal hostname differing from the `iss` claim.
**Fix:** The configured `issuer-uri` must equal the `iss` claim exactly.

**Symptom:** Startup fails naming a JOSE or Nimbus class.
**Cause:** `spring-security-oauth2-jose` is missing.
**Fix:** Add it — the resource-server artifact alone cannot decode a JWT.

**Symptom:** Tokens issued for a different application are accepted.
**Cause:** No audience validation; the signature and issuer are genuinely valid.
**Fix:** `spring.security.oauth2.resourceserver.jwt.audiences`, or an audience
validator composed onto the defaults.

**Symptom:** After adding a custom validator, expired tokens started passing.
**Cause:** `setJwtValidator` replaced the defaults.
**Fix:** `new DelegatingOAuth2TokenValidator<>(JwtValidators.createDefaultWithIssuer(issuer), yours)`.

**Symptom:** Freshly issued tokens are rejected as expired.
**Cause:** Clock skew.
**Fix:** `new JwtTimestampValidator(Duration.ofSeconds(60))` in the composed
validator — and fix the clock, because skew large enough to matter usually
indicates something else is wrong on the host.

**Symptom:** Works in staging, fails on the first request after a production
deploy.
**Cause:** The JWK set fetch failed — egress policy, a proxy, or DNS.
**Fix:** Treat the IdP as a dependency: allow the egress, and give the decoder's
HTTP client real timeouts so a hanging fetch does not stall request threads.
Timeouts are **Topic 12 — Outbound HTTP** *(not written yet)*.

**Symptom:** A user is deactivated and keeps working for the rest of the day.
**Cause:** Token lifetime. This is the model working as designed.
**Fix:** Shorter lifetimes, or an explicit revocation check. There is no
configuration flag that makes this go away.

## Interview questions

**★ What does a resource server actually do?**
It extracts a bearer token, verifies its signature against the issuer's public
keys, checks the registered claims (`exp`, `nbf`, `iss`, and ideally `aud`), and
converts the claims into an `Authentication`. It does not authenticate users,
issue tokens, or run any OAuth flow — those belong to the authorization server.

**★ What does `issuer-uri` do that `jwk-set-uri` does not?**
It triggers discovery: the metadata document at the issuer is fetched and the
JWK set location read from it, so the key endpoint is not hardcoded and can move
without redeploying you. `jwk-set-uri` is the manual fallback for providers
without a discovery endpoint.

**★ Which claims are validated by default, and which is the important omission?**
Signature, `exp`, `nbf` and `iss` are automatic. **`aud` is not**, and it is the
one that stops a genuine token minted for a sibling service in the same IdP from
being replayed against yours.

**★ You add an audience validator and expiry checking stops working. What happened?**
`NimbusJwtDecoder.setJwtValidator` replaces the validator wholesale rather than
appending. Compose instead: wrap `JwtValidators.createDefaultWithIssuer(issuer)`
and your validator in a `DelegatingOAuth2TokenValidator`.

**★ How do you revoke a JWT?**
In the general case you cannot. Validity is a property of the signed token, so it
holds until `exp`. The practical answers are short lifetimes with refresh
tokens, and — when immediate revocation is a hard requirement — a per-request
denylist, which brings back the shared state the stateless model was chosen to
avoid.

**★ What happens if the IdP is down?**
If the JWK set is already cached, verification continues for the keys it knows.
On a cold start, or when a rotation introduces an unseen `kid`, verification
fails and requests are rejected. So the IdP is a genuine runtime dependency, and
key-cache behaviour and fetch timeouts are worth deciding deliberately.

**★ Why is asymmetric signing used rather than a shared secret?**
Because a resource server only needs to *verify*. With a public key it cannot
mint tokens, so compromising one service does not let an attacker forge
identities accepted by every other service. A shared HMAC secret would give
every holder the power to issue.

---

← Prev: [Method security vs URL rules](08-method-vs-url-security.md) · Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [Claims to authorities](10-claims-to-authorities.md)
