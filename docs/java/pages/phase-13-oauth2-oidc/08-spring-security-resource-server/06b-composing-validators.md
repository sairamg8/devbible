---
title: "setJwtValidator replaces rather than appends, which is why adding one check silently removes three — and createDefaultWithValidators exists precisely so you stop having to remember that"
sidebar_label: "06b · Composing validators"
sidebar_position: 14
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against the Spring Security 7.x source `JwtValidators`
> (`createDefaultWithIssuer`, `createDefaultWithValidators(List)`,
> `createDefaultWithValidators(varargs)`), `DelegatingOAuth2TokenValidator`,
> `NimbusJwtDecoder#setJwtValidator`, `JwtClaimValidator`
> ([github.com](https://github.com/spring-projects/spring-security)) — the Spring Security
> 7.x reference *OAuth 2.0 Resource Server JWT* §"Configuring Validation",
> §"Configuring a Custom Validator"
> ([docs.spring.io](https://docs.spring.io/spring-security/reference/servlet/oauth2/resource-server/jwt.html)).
> JDK 25 · Spring Boot 4.1.0 · Spring Framework 7.0.8 · Spring Security 7.x (7.1.0).

**`NimbusJwtDecoder` holds exactly one `OAuth2TokenValidator<Jwt>`. `setJwtValidator` sets
it. Not adds — sets. Every "how do I check the audience" answer that calls
`setJwtValidator(new AudienceValidator())` has just turned off expiry checking, and the
resulting configuration passes every test the team writes, because the tokens they test with
are fresh. This chunk is the two correct compositions, the API added in 6.3 that makes the
mistake structurally impossible, and the reason the older documented pattern still appears
everywhere.**

## The mistake, in three lines

```java
// ⛔ expiry, nbf, typ and thumbprint checking are now OFF
@Bean
JwtDecoder jwtDecoder() {
    NimbusJwtDecoder decoder = NimbusJwtDecoder.withIssuerLocation(this.issuer).build();
    decoder.setJwtValidator(new AudienceValidator("https://orders.example.com"));
    return decoder;
}
```

`NimbusJwtDecoder` initialises `jwtValidator` to `JwtValidators.createDefault()`. That call
overwrites the field. Signature verification still happens — it is not a validator, it is
part of decoding — so the token still has to be genuine. Everything else is gone: an expired
token from a year ago now authenticates successfully.

Nothing fails. No log line. The unit tests use `Jwt.withTokenValue("token")...build()` and
never construct an expired one. The integration tests use a token minted thirty seconds ago.
The defect ships and is found, if ever, by someone reading the code.

## Composition one: the documented pattern

```java
@Bean
JwtDecoder jwtDecoder() {
    NimbusJwtDecoder jwtDecoder = (NimbusJwtDecoder)
        JwtDecoders.fromIssuerLocation(issuerUri);

    OAuth2TokenValidator<Jwt> audienceValidator = audienceValidator();
    OAuth2TokenValidator<Jwt> withIssuer = JwtValidators.createDefaultWithIssuer(issuerUri);
    OAuth2TokenValidator<Jwt> withAudience =
            new DelegatingOAuth2TokenValidator<>(withIssuer, audienceValidator);

    jwtDecoder.setJwtValidator(withAudience);

    return jwtDecoder;
}
```

That is the reference's own sample. `createDefaultWithIssuer(issuerUri)` rebuilds the
defaults plus the issuer check, and `DelegatingOAuth2TokenValidator` wraps that together
with yours. It works, and it is the pattern you will find in every article — including
[phase 9 chunk 9](../../phase-9-spring-boot/11-spring-security/09-jwt-resource-server.md),
which showed exactly this.

Its weakness is that it is a convention you have to remember. Forget
`createDefaultWithIssuer` and you are back to the three-line mistake, in a form that looks
more careful.

## Composition two: `createDefaultWithValidators` (the one to use)

Added in 6.3, and it removes the possibility of forgetting:

```java
public static OAuth2TokenValidator<Jwt> createDefaultWithValidators(List<OAuth2TokenValidator<Jwt>> validators) {
    Assert.notEmpty(validators, "validators cannot be null or empty");
    List<OAuth2TokenValidator<Jwt>> tokenValidators = new ArrayList<>(validators);
    X509CertificateThumbprintValidator x509CertificateThumbprintValidator = CollectionUtils
        .findValueOfType(tokenValidators, X509CertificateThumbprintValidator.class);
    if (x509CertificateThumbprintValidator == null) {
        tokenValidators.add(0, new X509CertificateThumbprintValidator(
                X509CertificateThumbprintValidator.DEFAULT_X509_CERTIFICATE_SUPPLIER));
    }
    JwtTimestampValidator jwtTimestampValidator = CollectionUtils.findValueOfType(tokenValidators,
            JwtTimestampValidator.class);
    if (jwtTimestampValidator == null) {
        tokenValidators.add(0, new JwtTimestampValidator());
    }
    JwtTypeValidator typeValidator = CollectionUtils.findValueOfType(tokenValidators, JwtTypeValidator.class);
    if (typeValidator == null) {
        tokenValidators.add(0, JwtTypeValidator.jwt());
    }
    return new DelegatingOAuth2TokenValidator<>(tokenValidators);
}
```

Read what it does: for each of the three defaults, **if you did not supply one of that type,
it inserts one**. So:

```java
@Bean
JwtDecoder jwtDecoder() {
    NimbusJwtDecoder decoder = NimbusJwtDecoder.withIssuerLocation(this.issuer).build();
    decoder.setJwtValidator(JwtValidators.createDefaultWithValidators(
            new JwtIssuerValidator(this.issuer),
            new JwtAudienceValidator("https://orders.example.com")));
    return decoder;
}
```

is complete: type, timestamps, thumbprint, issuer, audience. And the "if not supplied"
behaviour means overriding a default is natural rather than dangerous —

```java
decoder.setJwtValidator(JwtValidators.createDefaultWithValidators(
        new JwtTimestampValidator(Duration.ofSeconds(15)),   // ← replaces the 60s default
        new JwtIssuerValidator(this.issuer),
        new JwtAudienceValidator(this.audience)));
```

Your `JwtTimestampValidator` is found by `findValueOfType`, so no second one is added. Same
for a `JwtTypeValidator` configured for `at+jwt`.

**Use this form. It is strictly better than the documented `DelegatingOAuth2TokenValidator`
pattern and there is no case where the older one is preferable.**

## Composition three: do not touch the decoder at all

Boot 4.x appends every `OAuth2TokenValidator<Jwt>` bean to the list it builds. That is
[06d · A validator bean](06d-a-validator-bean.md), and it is better than both of the above
because it does not require replacing the `JwtDecoder` bean — which, as
[02c](02c-trusted-algorithms.md) and [03](03-startup-coupling.md) both noted, quietly
discards `audiences`, `jws-algorithms` and the lazy startup behaviour.

The decision tree is short:

1. **Can you express it as a validator?** → `OAuth2TokenValidator<Jwt>` bean. Done.
2. **Do you need to change the decoder itself** (timeouts, cache, algorithms)? →
   `JwkSetUriJwtDecoderBuilderCustomizer` bean, still no `JwtDecoder` bean.
3. **Do you genuinely need a different decoder** (a `JWTProcessor`, multi-tenant key
   selection)? → then and only then declare a `JwtDecoder`, wrap it in `SupplierJwtDecoder`,
   and use `createDefaultWithValidators`.

## How `DelegatingOAuth2TokenValidator` behaves

It runs **all** delegates and collects every error rather than short-circuiting on the
first. That matters for two reasons. It means the cost of a validator is paid even when an
earlier one already failed — irrelevant for claim comparisons, relevant if you write one
that hits a database. And it means the `JwtValidationException` carries the full error
collection even though only the first description reaches the client
([10b · What not to leak](10b-what-not-to-leak.md)).

## Writing the validator itself

Two shapes. The compact one, for a single claim and a predicate:

```java
OAuth2TokenValidator<Jwt> audienceValidator() {
    return new JwtClaimValidator<List<String>>(AUD, aud -> aud.contains("messaging"));
}
```

`JwtClaimValidator` handles the null case for you — an absent claim fails — and produces the
error `"The <claim> claim is not valid"` with the RFC 6750 §3.1 error URI. The verbose one,
when you need control over the error:

```java
static class AudienceValidator implements OAuth2TokenValidator<Jwt> {
    OAuth2Error error = new OAuth2Error("custom_code", "Custom error message", null);

    @Override
    public OAuth2TokenValidatorResult validate(Jwt jwt) {
        if (jwt.getAudience().contains("messaging")) {
            return OAuth2TokenValidatorResult.success();
        } else {
            return OAuth2TokenValidatorResult.failure(error);
        }
    }
}
```

⚠️ Both are the reference's own samples, and the second one has a subtlety worth naming:
the error code `"custom_code"` is not one of RFC 6750's three, so it will be emitted verbatim
in the `WWW-Authenticate` header as `error="custom_code"`. Clients that switch on the error
code will not recognise it. Prefer `OAuth2ErrorCodes.INVALID_TOKEN` unless you have a
specific reason. More in [10 · Error responses](10-error-responses.md).

## Gotchas

**★ `setJwtValidator` replaces the whole validator; it never appends.**
One call with one validator disables type checking, timestamp checking and thumbprint
checking. The tokens you test with are fresh and well-formed, so nothing fails.

**★ The classic fix — `DelegatingOAuth2TokenValidator(createDefaultWithIssuer(iss), yours)`
— is correct but forgettable.**
It is a convention, not a constraint. `createDefaultWithValidators(...)` encodes the same
intent in a call you cannot get half-right.

**★ `createDefaultWithValidators` will not double up a validator you supplied.**
It looks for an existing instance of each default type with `findValueOfType` and only
inserts what is missing. That is how you override the 60-second clock skew or switch the
type validator to `at+jwt` without losing the rest.

**★ `createDefaultWithValidators` rejects an empty list.**
`Assert.notEmpty(validators, "validators cannot be null or empty")`. If you want just the
defaults, call `createDefault()`.

**★ Declaring a `JwtDecoder` bean to add a validator throws away `audiences`,
`jws-algorithms` and the deferred startup.**
The whole of `JwtDecoderConfiguration` backs off. An `OAuth2TokenValidator<Jwt>` bean adds
the validator and keeps all three.

**★ `DelegatingOAuth2TokenValidator` does not short-circuit.**
Every delegate runs on every token. A validator that performs I/O — a database lookup, a
call to a revocation list — runs even for tokens that already failed expiry.

**★ A custom `OAuth2Error` code is emitted verbatim to the client.**
`new OAuth2Error("custom_code", ...)` produces `error="custom_code"` in `WWW-Authenticate`.
RFC 6750 §3.1 defines exactly three codes; anything else is a private extension your clients
have never heard of.

**★ `JwtClaimValidator` fails when the claim is absent.**
`validate` returns failure whenever `token.getClaim(claim)` is `null`. That is the right
default for `aud` and `iss` and it is worth knowing explicitly, because
`JwtTimestampValidator` does the opposite for `exp` — see
[06e](06e-clock-skew-and-missing-exp.md).

## Interview questions

**★ Someone adds an audience validator and expiry checking stops working. Explain
precisely what happened.**
`NimbusJwtDecoder` holds a single `OAuth2TokenValidator<Jwt>`, initialised to
`JwtValidators.createDefault()`. `setJwtValidator(new AudienceValidator())` assigns over
that field, so the type, timestamp and thumbprint validators are no longer referenced by
anything. Signature verification is unaffected because it happens during decoding, not
validation — which is why the token still has to be genuine and merely no longer has to be
current.

**★ What is the best available way to add a validator in Spring Security 7 on Boot 4?**
Publish an `OAuth2TokenValidator<Jwt>` bean and let `JwtDecoderConfiguration#getValidator`
append it to the list it passes to `createDefaultWithValidators`. That keeps the `audiences`
and `jws-algorithms` properties, keeps `SupplierJwtDecoder`'s deferred startup, and makes it
impossible to drop a default. If you must build the decoder yourself, use
`JwtValidators.createDefaultWithValidators(...)` rather than composing a
`DelegatingOAuth2TokenValidator` by hand.

**★ How does `createDefaultWithValidators` avoid adding a second timestamp validator when
you supplied one?**
It calls `CollectionUtils.findValueOfType(tokenValidators, JwtTimestampValidator.class)` and
only inserts a default if the result is `null` — same for `JwtTypeValidator` and
`X509CertificateThumbprintValidator`. So supplying `new JwtTimestampValidator(Duration.ofSeconds(15))`
overrides the skew rather than duplicating the check.

**★ Does `DelegatingOAuth2TokenValidator` stop at the first failure?**
No. It evaluates every delegate and aggregates the errors into a single
`OAuth2TokenValidatorResult`, which `NimbusJwtDecoder` turns into a `JwtValidationException`
carrying them all. That is why an expensive validator should be treated as if it runs on
every request, including requests that were already going to fail.

**★ When is it correct to declare your own `JwtDecoder` bean?**
When you need something the builder and the customizer cannot express: a Nimbus
`JWTProcessor` with claim-set-aware key selection for multi-tenancy, a completely different
decoder implementation, or a decoder that wraps another. For validation, algorithms,
timeouts and caching there are extension points that do not require it — and replacing the
bean costs you the audience property, the algorithm property and the lazy startup.

**★ You need a 15-second clock skew and an audience check. Write it.**
```java
decoder.setJwtValidator(JwtValidators.createDefaultWithValidators(
        new JwtTimestampValidator(Duration.ofSeconds(15)),
        new JwtIssuerValidator(this.issuer),
        new JwtAudienceValidator(this.audience)));
```
The supplied `JwtTimestampValidator` suppresses the default one; type and thumbprint
validators are still inserted. Better still on Boot 4: publish the two validators as beans,
set `audiences` and leave the decoder alone.

{/* FOOTER */}
