---
title: "The default validator set changed in Spring Security 7 and now contains three validators, not two — every page on the internet that lists the defaults as exp, nbf and iss is describing a version you are not running"
sidebar_label: "06 · The default validators"
sidebar_position: 14
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against the Spring Security 7.x source `JwtValidators`
> (`createDefault`, `createDefaultWithIssuer`, `createDefaultWithValidators`),
> `JwtTimestampValidator`, `JwtIssuerValidator`, `JwtClaimValidator`, `NimbusJwtDecoder`
> (`private OAuth2TokenValidator<Jwt> jwtValidator = JwtValidators.createDefault();`)
> ([github.com](https://github.com/spring-projects/spring-security)) — the Spring Security
> 7.x reference *OAuth 2.0 Resource Server JWT* §"Runtime Expectations", §"Configuring
> Validation"
> ([docs.spring.io](https://docs.spring.io/spring-security/reference/servlet/oauth2/resource-server/jwt.html))
> — the Spring Boot 4.1.x source `JwtDecoderConfiguration#getValidator`
> ([github.com](https://github.com/spring-projects/spring-boot/tree/4.1.x/module/spring-boot-security-oauth2-resource-server))
> — **RFC 8705** §3.1 (mutual-TLS certificate-bound access tokens)
> ([datatracker.ietf.org](https://datatracker.ietf.org/doc/html/rfc8705)).
> JDK 25 · Spring Boot 4.1.0 · Spring Framework 7.0.8 · Spring Security 7.x (7.1.0).

**Ask anyone what a Spring resource server validates by default and you will hear
"signature, `exp`, `nbf`, `iss`". That answer is now incomplete in one direction and
overstated in another. `JwtValidators.createDefault()` in Spring Security 7 composes a
**type** validator, a **timestamp** validator and an **X.509 thumbprint** validator — and
`iss` is not in that list at all. It is added by Boot, from the `issuer-uri` property,
which is why a decoder you construct yourself validates less than the one Boot builds.**

## What the source says

```java
public static OAuth2TokenValidator<Jwt> createDefault() {
    return new DelegatingOAuth2TokenValidator<>(Arrays.asList(
            JwtTypeValidator.jwt(),
            new JwtTimestampValidator(),
            new X509CertificateThumbprintValidator(
                    X509CertificateThumbprintValidator.DEFAULT_X509_CERTIFICATE_SUPPLIER)));
}
```

Three validators. And `NimbusJwtDecoder` starts life with exactly that:

```java
private OAuth2TokenValidator<Jwt> jwtValidator = JwtValidators.createDefault();
```

So a bare `NimbusJwtDecoder.withJwkSetUri(...).build()` — no `setJwtValidator` call —
verifies the signature and then applies those three, and **nothing else**. No issuer check.
No audience check.

### 1 · `JwtTypeValidator.jwt()`

Checks the `typ` header. A JWT whose `typ` announces it is something else — an ID token
profile, an RFC 9068 access token, a logout token — is rejected. This is the newest of the
three and it exists because tokens issued for one purpose being accepted for another is a
whole class of bug. Note the interaction with RFC 9068: an `at+jwt` token has
`typ: at+jwt`, which is *not* what `JwtTypeValidator.jwt()` accepts, which is why the RFC
9068 path uses `validateTypes(false)` and its own type validator —
**06f · RFC 9068 validation** *(not written yet)*.

### 2 · `JwtTimestampValidator`

`exp` and `nbf`, with a default 60-second clock skew. Its two most consequential defaults —
`allowEmptyExpiryClaim = true` and `allowEmptyNotBeforeClaim = true` — are
**06e · Clock skew and the missing `exp`** *(not written yet)*, and the second
of those is one of the sharpest edges in the whole topic.

### 3 · `X509CertificateThumbprintValidator`

This one is genuinely surprising in a default list. It implements the confirmation-method
check for **RFC 8705 certificate-bound access tokens**: if the token carries a
`cnf` claim with an `x5t#S256` thumbprint, the validator compares it against the client
certificate presented on the TLS connection. A token bound to a certificate you are not
presenting is rejected.

The important half is what it does when there is *no* `cnf` claim: nothing. It is a
conditional check that only engages for tokens that opted into sender-constraining, which
is why it can sit in the default list without breaking every ordinary deployment.
Sender-constrained tokens as a topic are **14 · mTLS and workload identity**
*(not written yet)*; what matters here is that Spring already enforces the binding if the
authorization server sets it, and you get that for free.

## Where `iss` comes from

`createDefaultWithIssuer` is a one-liner:

```java
public static OAuth2TokenValidator<Jwt> createDefaultWithIssuer(String issuer) {
    return createDefaultWithValidators(new JwtIssuerValidator(issuer));
}
```

and Boot composes the real list itself:

```java
private OAuth2TokenValidator<Jwt> getValidator() {
    List<OAuth2TokenValidator<Jwt>> validators = new ArrayList<>();
    if (this.properties.getIssuerUri() != null) {
        validators.add(new JwtIssuerValidator(this.properties.getIssuerUri()));
    }
    if (!CollectionUtils.isEmpty(this.properties.getAudiences())) {
        validators.add(audienceValidator(this.properties.getAudiences()));
    }
    validators.addAll(this.additionalValidators);
    return validators.isEmpty() ? JwtValidators.createDefault()
            : JwtValidators.createDefaultWithValidators(validators);
}
```

Read that and the whole picture snaps into focus:

- `iss` is validated **only because `issuer-uri` is set**.
- `aud` is validated **only because `audiences` is set** (**06c · Audience** *(not written yet)*).
- Any `OAuth2TokenValidator<Jwt>` bean in the context is appended
  (**06d · A validator bean** *(not written yet)*).
- Everything else — type, timestamps, thumbprint — comes from `createDefaultWithValidators`,
  which is the subject of [06b · Composing validators](06b-composing-validators.md).

So the reference's *"Runtime Expectations"* summary —

> *"1. Validate its signature against a public key obtained from the `jwks_url` endpoint …
> 2. Validate the JWT's `exp` and `nbf` timestamps and the JWT's `iss` claim, and
> 3. Map each scope to an authority with the prefix `SCOPE_`."*

— is a description of the **Boot-configured** decoder, not of `JwtValidators.createDefault()`.
Both statements are true; they are about different objects.

## What is still not validated, by anyone, by default

- **`aud`.** The single most important omission and the reason a token minted for another
  service in the same estate is accepted. **06c · Audience** *(not written yet)*.
- **`sub`.** Absent `sub` is fine as far as the framework is concerned; you may care.
- **`iat`.** Not checked at all. A token with an issuance time in the future passes.
- **`jti`.** No replay detection. Bearer tokens are bearer tokens.
- **`client_id`, `azp`, `scope` non-emptiness** — all yours.
- **Revocation.** Nothing here contacts the authorization server. If you need
  per-request revocation the answer is introspection —
  **08 · Opaque token introspection** *(not written yet)*.

## How a failure is reported

Validation failures do not throw individually. `DelegatingOAuth2TokenValidator` runs every
delegate and collects the errors; `NimbusJwtDecoder` then aggregates them:

```java
throw new JwtValidationException(validationErrorString, errors);
```

and builds the message from the first error's description:

```java
return String.format(DECODING_ERROR_MESSAGE_TEMPLATE, oAuth2Error.getDescription());
```

`JwtValidationException` extends `BadJwtException`, so
[05 · The request path](05-the-request-path.md) step 4 turns it into
`InvalidBearerTokenException` and a 401. The description ends up in the
`WWW-Authenticate` header's `error_description` parameter, which is
**10b · What not to leak** *(not written yet)*.

## Gotchas

**★ The default validator list in Spring Security 7 does not include `iss`.**
`JwtValidators.createDefault()` is type, timestamps and X.509 thumbprint. Issuer validation
comes from `createDefaultWithIssuer(...)` or from Boot reading `issuer-uri`. A hand-built
`NimbusJwtDecoder` with no `setJwtValidator` call does not check the issuer.

**★ Every article listing the defaults as "signature, exp, nbf, iss" is describing Boot's
composition, not the framework's.**
Both are correct about different objects, and the difference is invisible until you build a
decoder yourself — at which point you lose the half you assumed was intrinsic.

**★ `X509CertificateThumbprintValidator` is in the default list and does nothing for most
people.**
It only engages when the token carries a `cnf` claim with `x5t#S256`. That is not a bug —
it is a conditional control that costs nothing when unused and enforces RFC 8705 binding
when the AS sets it.

**★ `JwtTypeValidator.jwt()` rejects `typ: at+jwt`.**
An authorization server that follows RFC 9068 sets that header, and the stock default
validator will reject its tokens. The fix is `validateTypes(false)` on the builder plus
`JwtValidators.createAtJwtValidator()` — **06f** *(not written yet)*.

**★ `iat` is never checked.**
A token claiming to have been issued next Tuesday validates fine, as long as `exp` and `nbf`
are sane. If issuance time matters to you — some fraud controls use it — you write that
validator.

**★ Nothing here detects replay.**
There is no `jti` tracking, no nonce, no one-time use. A bearer token is valid for anyone
holding it until it expires. Sender-constraining (RFC 8705, RFC 9449) is the structural
answer; short lifetimes are the practical one.

**★ Multiple validation failures are collected, and the client sees the first one.**
`DelegatingOAuth2TokenValidator` accumulates every error, but the message rendered into
`error_description` comes from the first. A token that is both expired and for the wrong
audience reports only one of the two.

## Interview questions

**★ What does `JwtValidators.createDefault()` return in Spring Security 7?**
A `DelegatingOAuth2TokenValidator` over three validators: `JwtTypeValidator.jwt()` (checks
the `typ` header), `JwtTimestampValidator` (`exp` and `nbf` with 60 seconds of skew) and
`X509CertificateThumbprintValidator` (RFC 8705 `cnf`/`x5t#S256` binding, active only when
the claim is present). Notably it does **not** validate `iss`.

**★ Then why do people say issuer validation is a default?**
Because it is a default of the *Boot-configured* decoder. `JwtDecoderConfiguration#getValidator`
adds a `JwtIssuerValidator` whenever `issuer-uri` is set, and then passes the list to
`createDefaultWithValidators`. Build a `NimbusJwtDecoder` yourself and that step does not
happen.

**★ What is `X509CertificateThumbprintValidator` doing in the default list?**
Enforcing RFC 8705 certificate-bound access tokens. If a token carries a `cnf` claim with an
`x5t#S256` thumbprint, the validator requires the TLS client certificate on the connection
to match. If there is no such claim it passes. Including it by default means sender-bound
tokens are enforced automatically wherever an authorization server issues them.

**★ Which registered claims does a stock Spring resource server *not* validate?**
`aud` unless you configure it, and `iat`, `jti`, `sub`, `client_id` and `azp` at all. There
is also no revocation check of any kind — a JWT resource server never contacts the
authorization server about a specific token. `aud` is the one that matters most, because
without it a token minted for a sibling service is accepted.

**★ A token fails two validators at once. What does the client see?**
One error. `DelegatingOAuth2TokenValidator` collects every failure into the
`JwtValidationException`, but the message that reaches `error_description` is derived from
the first error's description. If you need the full picture, it is in the exception, which
means it is in your logs — not in the response.

**★ Why is a validation failure a 401 and not a 403?**
Because it is an authentication failure, not an authorization one. `JwtValidationException`
extends `BadJwtException`, `JwtAuthenticationProvider` maps that to
`InvalidBearerTokenException`, and `BearerTokenErrors.invalidToken(...)` carries
`HttpStatus.UNAUTHORIZED` — matching RFC 6750 §3.1, which says `invalid_token` SHOULD be a
401 and that the client MAY request a new token and retry.

---

← [Step 7 and the debug table](05d-step-7-surprises-and-the-debug-table.md) · [Topic index](README.md) · Next → [Composing validators](06b-composing-validators.md)
