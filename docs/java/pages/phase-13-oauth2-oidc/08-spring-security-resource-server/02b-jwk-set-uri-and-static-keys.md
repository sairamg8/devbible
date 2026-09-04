---
title: "There are four ways to tell a resource server where the keys are, they trade key rotation against startup independence, and one of them quietly requires you to configure exactly one signature algorithm"
sidebar_label: "02b · jwk-set-uri and static keys"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against the Spring Security 7.x reference — *OAuth 2.0 Resource
> Server JWT* §"Specifying the Authorization Server JWK Set Uri Directly", §"Configuring
> Trusted Algorithms", §"Trusting a Single Asymmetric Key", §"Trusting a Single Symmetric
> Key", §"Exposing a `JwtDecoder` `@Bean`"
> ([docs.spring.io](https://docs.spring.io/spring-security/reference/servlet/oauth2/resource-server/jwt.html))
> — the Spring Boot 4.1.x source `JwtDecoderConfiguration` (`@ConditionalOnPublicKeyJwtDecoder`,
> `@ConditionalOnJwkSetUriJwtDecoder`, `@ConditionalOnIssuerLocationJwtDecoder`,
> `exactlyOneAlgorithm()`) and `OAuth2ResourceServerProperties`
> ([github.com](https://github.com/spring-projects/spring-boot/tree/4.1.x/module/spring-boot-security-oauth2-resource-server))
> — **RFC 9068** §4 ([datatracker.ietf.org](https://datatracker.ietf.org/doc/html/rfc9068)).
> JDK 25 · Spring Boot 4.1.0 · Spring Framework 7.0.8 · Spring Security 7.x (7.1.0).

**Four key sources, and the choice is a choice about *rotation*. A JWK set lets the
authorization server change keys without telling you; a hard-coded public key means every
rotation is a redeploy; a shared secret means every holder of the secret can mint tokens.
Boot picks between them with three mutually-exclusive conditions, and the least-used branch
— `public-key-location` — will fail at startup if you have not narrowed `jws-algorithms`
to exactly one entry.**

## The four sources, side by side

| Source | Property or builder | Rotation | Startup dependency on the AS |
|---|---|---|---|
| Discovery | `issuer-uri` | automatic | none — deferred to first request |
| JWK set | `jwk-set-uri` | automatic | none — fetched on first decode |
| Public key | `public-key-location`, `NimbusJwtDecoder.withPublicKey` | manual redeploy | none |
| Secret key | `NimbusJwtDecoder.withSecretKey` | manual redeploy | none |

Only the first two survive a key rotation without human action, and that is the reason
production systems overwhelmingly use them.

## `jwk-set-uri`: the manual key endpoint

```yaml
spring:
  security:
    oauth2:
      resourceserver:
        jwt:
          issuer-uri: https://idp.example.com
          jwk-set-uri: https://idp.example.com/.well-known/jwks.json
```

The reference names both the reason you would do this and the caveat:

> *"If the authorization server doesn't support any configuration endpoints, or if Resource
> Server must be able to initialize independently from the authorization server, then the
> `jwk-set-uri` can be supplied as well."*

> *"The JWK Set uri is not standardized, but can typically be found in the authorization
> server's documentation."*

"Not standardized" is doing real work in that sentence. `jwks_uri` is a *metadata field*
defined by RFC 8414 and OIDC Discovery; the path it points at is whatever the vendor chose.
Hard-coding it means that when the vendor moves it, you redeploy. That is the price of not
depending on discovery.

Keep `issuer-uri` alongside it. The reference says why in one line — *"We still specify the
`issuer-uri` so that Resource Server still validates the `iss` claim on incoming JWTs"* —
and [02 · issuer-uri](02-issuer-uri.md) explains what you lose without it.

The same value can be supplied in the DSL, and the reference states the precedence
plainly: *"Using `jwkSetUri()` takes precedence over any configuration property."*

```java
http.oauth2ResourceServer(oauth2 -> oauth2
    .jwt(jwt -> jwt.jwkSetUri("https://idp.example.com/.well-known/jwks.json")));
```

## `public-key-location`: one key, no rotation, and a trap

```yaml
spring:
  security:
    oauth2:
      resourceserver:
        jwt:
          public-key-location: classpath:my-key.pub
          jws-algorithms: RS256
```

🔴 **That second line is not optional here, and the reason is only visible in the Boot
source.** `JwtDecoderConfiguration#jwtDecoderByPublicKeyValue` calls
`exactlyOneAlgorithm()`, which asserts:

```java
Assert.state(algorithms != null && algorithms.size() == 1,
    () -> "Creating a JWT decoder using a public key requires exactly one JWS algorithm but "
            + algorithms.size() + " were configured");
```

The default value of `jws-algorithms` is the single-element list `["RS256"]`, so the naive
case works. The moment you widen it — `jws-algorithms: RS256,ES256`, a perfectly reasonable
thing to write while migrating algorithms — the application fails to start, and the message
does not mention `public-key-location` at all. A single RSA public key can only verify one
family of signatures, so the constraint is correct; it is the diagnosis that is hard.

`public-key-location` reads a PEM file. Boot strips the PEM armour and base64-decodes it:

```java
return Base64.getMimeDecoder().decode(
        value.replace("-----BEGIN PUBLIC KEY-----", "")
             .replace("-----END PUBLIC KEY-----", ""));
```

so the file must be an X.509 `SubjectPublicKeyInfo` PEM — a *public* key, not a
certificate, and not a private key. Handing it a certificate PEM produces a key-spec
failure at startup.

The direct builder form is the same thing without the property plumbing:

```java
@Bean
public JwtDecoder jwtDecoder() {
    return NimbusJwtDecoder.withPublicKey(this.key).build();
}
```

Where this is genuinely the right choice: a fixed internal signer that never rotates, an
air-gapped environment, or a test fixture. Where it is the wrong choice: anywhere the IdP
rotates keys, because the first rotation takes your service down and no amount of
configuration will bring it back without a deploy.

## `withSecretKey`: symmetric, and mostly a mistake

```java
@Bean
public JwtDecoder jwtDecoder() {
    return NimbusJwtDecoder.withSecretKey(this.key).build();
}
```

There is no Boot property for this, which is a hint. A shared HMAC secret means the
resource server holds the *same* material the authorization server uses to sign. Anything
that can verify can also mint. Compromise one resource server in an estate of twelve and
the attacker can forge tokens accepted by all twelve, for any user, with any scope.

Asymmetric signing exists precisely so a resource server holds a capability it cannot abuse.
Use a secret key only when the signer and the verifier are the same process and the token
never leaves it — at which point you should ask why it is a JWT.

RFC 9068 §4 makes the recommendation explicit for access tokens:

> *"For the purpose of facilitating validation data retrieval, it is RECOMMENDED here that
> authorization servers sign JWT access tokens with an asymmetric algorithm."*

## Which one to choose

- **Default to `issuer-uri` alone.** It is one line, it survives rotation, and it costs
  nothing at startup.
- **Add `jwk-set-uri` when discovery is unreachable, unreliable or behind a path your
  proxy does not forward** — and keep `issuer-uri` for the claim check.
- **Use `public-key-location` only where the key genuinely never changes**, and pin
  `jws-algorithms` to the single matching algorithm on purpose rather than by accident
  ([02c · Trusted algorithms](02c-trusted-algorithms.md)).
- **Do not use a symmetric key** in a service you did not also write the signer for.

## Gotchas

**★ `public-key-location` plus more than one `jws-algorithms` value is a startup failure.**
`exactlyOneAlgorithm()` asserts a list size of one, and the message names the algorithm
count without naming the public-key branch that imposed it. Set exactly one algorithm.

**★ `public-key-location` wants a public key PEM, not a certificate.**
Boot strips only the `BEGIN/END PUBLIC KEY` armour and feeds the bytes to an
`X509EncodedKeySpec`. A `BEGIN CERTIFICATE` file decodes to something that is not a
`SubjectPublicKeyInfo` and fails at startup with a key-spec error.

**★ Hard-coding a public key makes your service an outage waiting for a rotation.**
The IdP rotates on its own schedule, often automatically. The day it does, every token is
signed by a key you do not have and nothing short of a deploy fixes it. If you must
hard-code, put a calendar reminder against the IdP's rotation period.

**★ `jwk-set-uri` alone, with no `issuer-uri`, accepts every tenant on a shared IdP.**
Boot only adds `JwtIssuerValidator` when the issuer property is present. All tenants of a
multi-tenant authorization server are usually signed from one key set.

**★ A symmetric key turns every resource server into a token factory.**
The verifier and the signer hold identical material. This is a containment failure, not a
style preference: one compromised service forges identities for the entire estate.

**★ `jwkSetUri()` in the DSL silently wins over the property.**
The reference says it "takes precedence". If someone added the DSL call during a debugging
session and left it, changing the YAML has no effect and nothing warns you.

## Interview questions

**★ When would you prefer `jwk-set-uri` over `issuer-uri`?**
When the authorization server publishes no discovery document, when the discovery paths are
not routable from your network, or when you want to be certain the resource server never
performs the discovery probe. You keep `issuer-uri` alongside it so the `iss` claim is
still asserted; you lose the ability to follow the vendor if they move the key endpoint.

**★ Why does `public-key-location` require exactly one `jws-algorithms` entry?**
Because a single RSA public key can verify exactly one signature scheme, so Boot's
`exactlyOneAlgorithm()` refuses to guess. The default list already has one element
(`RS256`), so the failure only appears when someone widens the list — usually mid-migration
— and the assertion message does not mention public keys at all.

**★ What is wrong with `NimbusJwtDecoder.withSecretKey(...)` in a microservice estate?**
It gives the resource server the ability to *issue* tokens, not just verify them. The
security model of a resource server depends on holding a verification-only capability;
with a shared HMAC secret, compromising any one service lets an attacker forge tokens
accepted by every service sharing that secret. Asymmetric signing removes the class of
attack entirely.

---

← [issuer-uri](02-issuer-uri.md) · [Topic index](README.md) · Next → [Trusted algorithms](02c-trusted-algorithms.md)
