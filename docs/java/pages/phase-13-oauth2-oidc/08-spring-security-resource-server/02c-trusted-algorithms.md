---
title: "The decoder trusts exactly one signature algorithm until you tell it otherwise, and every widening of that set is a deliberate decision you should be able to justify at a review"
sidebar_label: "02c · Trusted algorithms"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against the Spring Security 7.x reference — *OAuth 2.0 Resource
> Server JWT* §"Configuring Trusted Algorithms" (Via Spring Boot / Using a Builder / From
> JWK Set response), §"Exposing a `JwtDecoder` `@Bean`"
> ([docs.spring.io](https://docs.spring.io/spring-security/reference/servlet/oauth2/resource-server/jwt.html))
> — the Spring Boot 4.1.x source `OAuth2ResourceServerProperties.Jwt` (`jwsAlgorithms`
> defaults to `Arrays.asList("RS256")`) and `JwtDecoderConfiguration#jwsAlgorithms`
> ([github.com](https://github.com/spring-projects/spring-boot/tree/4.1.x/module/spring-boot-security-oauth2-resource-server))
> — **RFC 9068** §4 ([datatracker.ietf.org](https://datatracker.ietf.org/doc/html/rfc9068)).
> JDK 25 · Spring Boot 4.1.1 · Spring Framework 7.0.9 · Spring Security 7.x (7.1.0).

**The algorithm list is an allow-list, not a hint. It is the only configuration in a
resource server that says "I will not accept a signature made this way", and because the
default is a single algorithm that happens to be right almost everywhere, most teams never
discover it exists — until an IdP migration turns it into a startup failure or a wall of
401s. This chunk is that one property, its three spellings, and the one spelling that
performs network I/O while your context is still refreshing.**

## Trusted algorithms

Independent of the key source, you decide which signature algorithms you will honour. The
reference states the default:

> *"By default, `NimbusJwtDecoder`, and hence Resource Server, will only trust and verify
> tokens using `RS256`."*

```yaml
spring:
  security:
    oauth2:
      resourceserver:
        jwt:
          jws-algorithms: RS512
          jwk-set-uri: https://idp.example.org/.well-known/jwks.json
```

Or on the builder, where `jwsAlgorithm` is additive:

```java
@Bean
JwtDecoder jwtDecoder() {
    NimbusJwtDecoder jwtDecoder = NimbusJwtDecoder.withIssuerLocation(this.issuer)
            .jwsAlgorithm(RS512).jwsAlgorithm(ES512).build();
    jwtDecoder.setJwtValidator(JwtValidators.createDefaultWithIssuer(this.issuer));
    return jwtDecoder;
}
```

> *"Calling `jwsAlgorithm` more than once will configure `NimbusJwtDecoder` to trust more
> than one algorithm."*

Note what that snippet does *after* `build()`: it calls `setJwtValidator`. On the builder
path that is mandatory, and forgetting it is the subject of
[06b · Composing validators](06b-composing-validators.md) — the builder does not know your
issuer, so the decoder it produces validates timestamps and type but not `iss`.

There is also a dynamic form, which reads the algorithm family from the JWK set itself:

```java
@Bean
public JwtDecoder jwtDecoder() {
    // makes a request to the JWK Set endpoint
    JWSKeySelector<SecurityContext> jwsKeySelector =
            JWSAlgorithmFamilyJWSKeySelector.fromJWKSetURL(this.jwkSetUrl);

    DefaultJWTProcessor<SecurityContext> jwtProcessor = new DefaultJWTProcessor<>();
    jwtProcessor.setJWSKeySelector(jwsKeySelector);

    return new NimbusJwtDecoder(jwtProcessor);
}
```

Read the comment Spring itself put in that sample: **`// makes a request to the JWK Set
endpoint`.** This form fetches at bean-creation time, which is the one construction on this
page that genuinely couples startup to the authorization server — see
[03 · Startup coupling](03-startup-coupling.md).

`alg`, the algorithms themselves and the confusion attacks that motivate pinning them are
[06 · JWT anatomy and validation](../06-jwt-anatomy-and-validation/README.md).

## Where the default comes from

Boot's `OAuth2ResourceServerProperties.Jwt` declares it as a list with one element:

```java
/**
 * JSON Web Algorithms used for verifying the digital signatures.
 */
private List<String> jwsAlgorithms = Arrays.asList("RS256");
```

so `jws-algorithms` is never null and never empty, which is why the
`public-key-location` branch can assert on its size
([02b · jwk-set-uri and static keys](02b-jwk-set-uri-and-static-keys.md)). An unrecognised
name is rejected with a configuration-property error naming the property and the value:

```java
throw new InvalidConfigurationPropertyValueException(
        "spring.security.oauth2.resourceserver.jwt.jws-algorithms", algorithm, "Unknown algorithm");
```

The names are JWA identifiers — `RS256`, `RS384`, `RS512`, `ES256`, `ES384`, `ES512`,
`PS256` and so on — resolved through `SignatureAlgorithm.from(String)`. Lowercase, spaces
and friendly names such as `RSA` all fail this lookup.

## Choosing the set

- **Leave it at `RS256` unless something forces you off it.** It is what the vast majority
  of authorization servers emit and what Spring trusts by default, so the configuration is
  absent and there is nothing to get wrong.
- **Widen it only for the duration of a migration**, then narrow it again. An allow-list
  that permanently contains every algorithm the IdP has ever used is not an allow-list.
- **Never derive it from the token.** The `alg` header is attacker-controlled input; the
  point of the list is that the decoder consults *your* configuration, not the token's
  opinion of itself. The attacks that exploit servers doing otherwise are
  [06 · JWT anatomy and validation](../06-jwt-anatomy-and-validation/README.md).
- **Prefer widening to `ES256`/`EdDSA` over widening to anything symmetric.** A JWK set
  can legitimately carry an `oct` key; trusting an HMAC algorithm on a decoder that also
  trusts an RSA JWK set is the shape of the classic algorithm-confusion attack.

## Gotchas

**★ `jwsAlgorithm` on the builder is additive; the property is a list that replaces.**
`jwsAlgorithm(RS512).jwsAlgorithm(ES512)` trusts both. `jws-algorithms: RS512` trusts only
RS512 and stops trusting the RS256 default — which is usually what you wanted and
occasionally a surprise when the IdP signs with RS256.

**★ `JWSAlgorithmFamilyJWSKeySelector.fromJWKSetURL(...)` performs I/O when the bean is
created.**
Spring's own sample carries the comment saying so. Used inside a `@Bean` method, it makes
context refresh depend on the authorization server being up — the exact coupling
`issuer-uri` was designed to avoid.

**★ An unknown algorithm name fails the context, not the request.**
`SignatureAlgorithm.from(...)` returning `null` throws
`InvalidConfigurationPropertyValueException`. This is the good case — a typo in
`jws-algorithms` stops the application instead of silently trusting nothing.

**★ Setting `jws-algorithms` stops trusting RS256.**
The property replaces the default single-element list. `jws-algorithms: ES256` on a system
where the IdP still signs some tokens with RS256 produces intermittent 401s that correlate
with nothing visible in your service.

**★ Trusting an HMAC algorithm on a decoder backed by a JWK set is how algorithm confusion
starts.**
If the decoder will accept `HS256`, a JWK set entry — or a public key an attacker can
obtain — becomes a candidate HMAC secret. Keep the allow-list asymmetric when the key
source is asymmetric.

**★ The algorithm list does not travel with a `JwtDecoder` you build yourself.**
`jws-algorithms` is read by `JwtDecoderConfiguration`. Declare your own `JwtDecoder` bean
and that configuration class backs off entirely — the property is then dead configuration
that looks live. Call `jwsAlgorithm(...)` on your builder instead.

## Interview questions

**★ Spring's own example for reading algorithms from the JWK set carries the comment
"makes a request to the JWK Set endpoint". Why does that matter?**
Because it moves the network call from first-request time into bean-creation time. The
deferred behaviour that makes `issuer-uri` safe at startup — `SupplierJwtDecoder` — is
bypassed, so if the authorization server is down when your pod starts, the context fails to
refresh and the pod crash-loops. See [03 · Startup coupling](03-startup-coupling.md).

**★ Your IdP announces it is rotating to ES256 next month while continuing to sign some
tokens with RS256. What do you change?**
Trust both during the overlap: `NimbusJwtDecoder...jwsAlgorithm(RS256).jwsAlgorithm(ES256)`
on the builder, or `jws-algorithms: RS256,ES256` as a property — and note that if you are
on `public-key-location` you cannot do this at all, because that branch permits exactly one
algorithm. Narrow back to ES256 once the last RS256 token has expired.

**★ What is the default set of trusted signature algorithms, and where is it defined?**
A single algorithm, `RS256`. The reference states it — *"By default, `NimbusJwtDecoder`,
and hence Resource Server, will only trust and verify tokens using `RS256`"* — and Boot's
`OAuth2ResourceServerProperties.Jwt` backs it with
`private List<String> jwsAlgorithms = Arrays.asList("RS256");`, which is why the list is
never empty.

**★ Why is the algorithm list an allow-list rather than something read from the token?**
Because the `alg` header is part of the token, and the token is attacker-controlled until
it has been verified. Any design that lets the token choose how it will be verified is
circular. The allow-list is the resource server stating, independently of any token, which
signature schemes it is willing to evaluate at all.

**★ You declare your own `JwtDecoder` bean and `jws-algorithms` stops having any effect.
Why?**
Because `JwtDecoderConfiguration` is annotated `@ConditionalOnMissingBean(JwtDecoder.class)`
at class level. Your bean satisfies that condition, the whole configuration backs off, and
every property it read — algorithms, audiences, issuer validation — is no longer applied by
anyone. This is the single most common way a resource server ends up with weaker validation
after a "small" customisation; see
[06b · Composing validators](06b-composing-validators.md) and
**06d · A validator bean** *(not written yet)* for the two ways out.

---

← [jwk-set-uri and static keys](02b-jwk-set-uri-and-static-keys.md) · [Topic index](README.md) · Next → [Startup coupling](03-startup-coupling.md)
