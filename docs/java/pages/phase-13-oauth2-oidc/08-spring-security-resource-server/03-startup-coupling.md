---
title: "issuer-uri does not make your service refuse to start when the authorization server is down — Spring defers the whole discovery process to the first request, and the ways teams accidentally undo that deferral are all in code they wrote themselves"
sidebar_label: "03 · Startup coupling"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against the Spring Security 7.x reference — *OAuth 2.0 Resource
> Server JWT* §"Startup Expectations" (including the `SupplierJwtDecoder` note),
> §"Configuring Timeouts", §"Exposing a `JwtDecoder` `@Bean`"
> ([docs.spring.io](https://docs.spring.io/spring-security/reference/servlet/oauth2/resource-server/jwt.html))
> — the Spring Boot 4.1.x source `JwtDecoderConfiguration#jwtDecoderByIssuerUri`
> (returns `SupplierJwtDecoder`) and `JwkSetUriJwtDecoderBuilderCustomizer`
> ([github.com](https://github.com/spring-projects/spring-boot/tree/4.1.x/module/spring-boot-security-oauth2-resource-server)).
> JDK 25 · Spring Boot 4.1.1 · Spring Framework 7.0.9 · Spring Security 7.x (7.1.0).

**🔴 This chunk corrects a widely repeated claim, including one on our own
[phase 9 page](../../phase-9-spring-boot/11-spring-security/09-jwt-resource-server.md),
which says the service "makes an outbound call at startup or first use". The Spring
Security reference is unambiguous that with `issuer-uri` alone the call happens at *first
use only*, and Boot implements that with `SupplierJwtDecoder`. The real risk is not that
`issuer-uri` couples your startup to the IdP — it does not — but that four common
customisations silently reintroduce the coupling, and that the default timeouts and cache
TTL are almost certainly not what you would choose.**

## What the reference actually says

> *"It achieves this through a deterministic discovery process it launches at the first
> request containing a JWT:*
>
> *1. Query the Provider Configuration or Authorization Server Metadata endpoint for the
> `jwks_url` property*
> *2. Query the `jwks_url` endpoint for supported algorithms*
> *3. Configure the validation strategy to query `jwks_url` for valid public keys of the
> algorithms found*
> *4. Configure the validation strategy to validate each JWTs `iss` claim against
> `https://idp.example.com`."*
>
> *"One benefit of deferring this process is that Resource Server startup is not coupled to
> the authorization server's availability."*

And the mechanism, in a note that most readers skip:

> *"This deferral is managed by `SupplierJwtDecoder`. Consider wrapping any `JwtDecoder`
> `@Bean` you declare in order to preserve this behavior."*

Boot 4.1's source confirms it — the `issuer-uri` branch returns the supplier type, not a
built decoder:

```java
@Bean
@ConditionalOnIssuerLocationJwtDecoder
SupplierJwtDecoder jwtDecoderByIssuerUri() {
    return new SupplierJwtDecoder(this::supplyJwtDecoderByIssuerUri);
}
```

`supplyJwtDecoderByIssuerUri` — which calls `NimbusJwtDecoder.withIssuerLocation(...)` and
therefore performs the discovery probe — is only invoked when the supplier is first
dereferenced, that is, on the first token to arrive.

## So what actually breaks when the IdP is down?

Three distinct states, and conflating them is why the incident reports are confused.

| State | With `issuer-uri` only | With `jwk-set-uri` |
|---|---|---|
| IdP down when the pod starts | pod starts fine | pod starts fine |
| IdP down, first token ever arrives | discovery fails → request fails | JWK fetch fails → request fails |
| IdP down, keys already cached, known `kid` | requests succeed | requests succeed |
| IdP down, keys cached, **unknown `kid`** after rotation | fetch attempted → fails | fetch attempted → fails |

The honest summary: **the authorization server is a runtime dependency of every request
whose key you have not already cached, and it is not a startup dependency at all.** That
is a much better failure profile than "crash-loops until the IdP is back", and it is worth
knowing you already have it.

## The four ways teams undo the deferral

### 1. Declaring a `JwtDecoder` bean the eager way

This is the big one, and the reference's note exists because of it.

```java
// ⛔ discovery now runs during context refresh
@Bean
JwtDecoder jwtDecoder() {
    return JwtDecoders.fromIssuerLocation(this.issuerUri);
}
```

> *"Calling `JwtDecoders#fromIssuerLocation` is what invokes the Provider Configuration or
> Authorization Server Metadata endpoint in order to derive the JWK Set Uri."*

Inside a `@Bean` method, that call happens while the context is refreshing. If the IdP is
unreachable, context refresh throws and the application does not start. In Kubernetes that
is a `CrashLoopBackOff` whose root cause is a service you do not own.

The fix is the one the reference names — wrap it:

```java
// ✅ preserves the deferral
@Bean
JwtDecoder jwtDecoder() {
    return new SupplierJwtDecoder(() -> {
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withIssuerLocation(this.issuerUri).build();
        decoder.setJwtValidator(JwtValidators.createDefaultWithValidators(
                new JwtIssuerValidator(this.issuerUri),
                new JwtAudienceValidator(this.audience)));
        return decoder;
    });
}
```

Everything inside the lambda — including the discovery probe performed by
`withIssuerLocation(...).build()` — runs on first use.

Better still, in Boot 4.x: **do not declare a `JwtDecoder` bean at all.** Declare an
`OAuth2TokenValidator<Jwt>` bean and let the auto-configuration keep its supplier. That is
**06d · A validator bean** *(not written yet)*, and it is the single most useful thing
in this topic that no tutorial has caught up with.

### 2. The Nimbus key-selector recipe

```java
@Bean
public JwtDecoder jwtDecoder() {
    // makes a request to the JWK Set endpoint
    JWSKeySelector<SecurityContext> jwsKeySelector =
            JWSAlgorithmFamilyJWSKeySelector.fromJWKSetURL(this.jwkSetUrl);
    ...
}
```

Spring's own comment says it. Same problem, same fix — wrap the body in a supplier.

### 3. A health check or warm-up that decodes a token at startup

An `ApplicationRunner` that "primes the cache" by decoding a canned token converts the
deferral into eager initialisation on purpose. Sometimes that is what you want (fail fast
in a controlled rollout); make sure it is a decision, and make sure the runner does not
prevent the readiness probe from passing.

### 4. A liveness probe on a secured path

If `/actuator/health/liveness` requires a token, the first probe becomes the "first request
containing a JWT" — except it contains no JWT, so it 401s and the pod is killed. See
**12 · Actuator and the resource server** *(not written yet)*.

## What this chunk deliberately leaves out

Timeouts and the JWK set cache are the other half of "the authorization server is a runtime
dependency", and they are big enough to have their own page:
[03b · Timeouts and the JWK cache](03b-timeouts-and-the-jwk-cache.md). Read it next — the
30-second default read timeout is the number most likely to hurt you.

## Gotchas

**★ Declaring `@Bean JwtDecoder jwtDecoder() { return JwtDecoders.fromIssuerLocation(uri); }`
turns a runtime dependency into a startup dependency.**
The discovery call happens during context refresh, so an IdP outage becomes a
crash-looping deployment. Wrap the body in a `SupplierJwtDecoder`, exactly as the reference
note instructs.

**★ Declaring any `JwtDecoder` bean also discards `audiences`, `issuer-uri` validation and
`jws-algorithms`.**
`JwtDecoderConfiguration` is `@ConditionalOnMissingBean(JwtDecoder.class)` at class level.
The properties stay in `application.yml`, look configured, and do nothing. This is the
highest-impact gotcha in the whole topic.

**★ A liveness probe behind the resource-server chain kills the pod before the first real
request.**
It 401s because it carries no token, the platform interprets that as unhealthy, and the pod
restarts forever while the application is completely healthy.

**★ "Warming the cache" at startup is re-adding the coupling you were given for free.**
It can be right — failing fast in a canary is a legitimate goal — but do it with an
explicit runner you can disable, not accidentally through a `@Bean` method.

## Interview questions

**★ Does `issuer-uri` couple your service's startup to the authorization server?**
No. The reference states that the discovery process is *"launche[d] at the first request
containing a JWT"*, and *"One benefit of deferring this process is that Resource Server
startup is not coupled to the authorization server's availability."* Boot implements the
deferral by returning a `SupplierJwtDecoder`. What *is* coupled is the first request whose
signing key is not already cached.

**★ How would you accidentally reintroduce that coupling?**
By declaring a `JwtDecoder` bean whose body calls `JwtDecoders.fromIssuerLocation(...)`,
`NimbusJwtDecoder.withIssuerLocation(...).build()` or
`JWSAlgorithmFamilyJWSKeySelector.fromJWKSetURL(...)` directly. All three perform the
network call when the bean is created. The documented fix is to wrap the body in a
`SupplierJwtDecoder`.

**★ Your pods crash-loop after an IdP maintenance window even though you use `issuer-uri`.
What do you look for?**
Something that dereferences the decoder during startup: an eagerly-built `JwtDecoder` bean,
a `JWSAlgorithmFamilyJWSKeySelector.fromJWKSetURL` call in a `@Bean` method, an
`ApplicationRunner` that decodes a token, or a startup/readiness probe hitting a secured
path. With plain `issuer-uri` and no custom decoder, an IdP outage cannot prevent startup.

**★ The IdP is down and requests are still being served successfully. Is that a bug?**
No — it is the cache working. Keys already fetched remain valid for the cache duration and
the tokens they signed continue to verify locally. It stops as soon as a token arrives with
a `kid` that is not in the cached set, or the cache expires. It is also a reminder that
"the resource server is up" and "the IdP is up" are different questions.

---

← [Trusted algorithms](02c-trusted-algorithms.md) · [Topic index](README.md) · Next → [Timeouts and the JWK cache](03b-timeouts-and-the-jwk-cache.md)
