---
title: "Thirty-second timeouts and a five-minute key cache are the two numbers a resource server ships with, and the documented way to change either without silently deleting your validators is a Boot customizer almost nobody knows exists"
sidebar_label: "03b · Timeouts and the JWK cache"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against the Spring Security 7.x reference — *OAuth 2.0 Resource
> Server JWT* §"Configuring Timeouts" (both the JDK system properties and the
> `RestOperations` form, and the JWK-set cache paragraphs)
> ([docs.spring.io](https://docs.spring.io/spring-security/reference/servlet/oauth2/resource-server/jwt.html))
> — the Spring Boot 4.1.x sources `JwtDecoderConfiguration#buildJwkSetUriJwtDecoder` and
> `JwkSetUriJwtDecoderBuilderCustomizer`
> ([github.com](https://github.com/spring-projects/spring-boot/tree/4.1.x/module/spring-boot-security-oauth2-resource-server)).
> JDK 25 · Spring Boot 4.1.0 · Spring Framework 7.0.8 · Spring Security 7.x (7.1.0).

**Every JWT that arrives with an unseen `kid` costs your service an outbound HTTP call to
the authorization server, on a request thread, with a thirty-second timeout. That is the
default, it is documented, and it is a thread-pool exhaustion incident waiting for the day
the IdP gets slow rather than the day it goes down. The fix is two beans and it must be
done in the one way that does not also throw away issuer and audience validation.**

### Timeouts

> *"By default, Resource Server uses connection and socket timeouts of 30 seconds each for
> coordinating with the authorization server. You can override these defaults without
> changing any code by setting the JDK's `sun.net.client.defaultConnectTimeout` and
> `sun.net.client.defaultReadTimeout` system properties (in milliseconds)."*

Thirty seconds is a very long time to hold a request thread while a JWK set fetch hangs.
Under load, a slow or blackholed IdP turns into thread-pool exhaustion in your service —
the failure is yours, the cause is theirs. The documented way to fix it properly:

```java
@Bean
public JwtDecoder jwtDecoder(RestTemplateBuilder builder) {
    RestOperations rest = builder
            .setConnectTimeout(Duration.ofSeconds(60))
            .setReadTimeout(Duration.ofSeconds(60))
            .build();

    NimbusJwtDecoder jwtDecoder = NimbusJwtDecoder.withIssuerLocation(issuer).restOperations(rest).build();
    return jwtDecoder;
}
```

That is the reference's own sample, and note two things about it: it uses *longer* timeouts
than the default, because the reference's stated concern is *"This may be too short in some
scenarios"*; and it is written in the eager form, so it reintroduces problem 1. In a real
service you want shorter timeouts and the supplier wrapper — and you want them without
losing the auto-configured validators, which is what the next section is for.

### Keeping the auto-configuration and changing the builder

Boot 4.x exposes an extension point precisely so you do not have to replace the decoder:

```java
@Bean
JwkSetUriJwtDecoderBuilderCustomizer decoderTimeouts(RestTemplateBuilder builder) {
    RestOperations rest = builder
            .setConnectTimeout(Duration.ofSeconds(2))
            .setReadTimeout(Duration.ofSeconds(2))
            .build();
    return decoderBuilder -> decoderBuilder.restOperations(rest);
}
```

`JwtDecoderConfiguration#buildJwkSetUriJwtDecoder` runs every
`JwkSetUriJwtDecoderBuilderCustomizer` bean over the builder before calling `build()`, and
then still applies `getValidator()` — so you get your timeouts **and** the issuer validator,
the audience validator and any `OAuth2TokenValidator<Jwt>` beans. It also still returns
through the `SupplierJwtDecoder` on the `issuer-uri` branch, so the deferral survives.

This is the correct answer to "how do I set timeouts on the JWK fetch" and it is almost
never the answer you will find online, which is invariably "declare a `JwtDecoder` bean".

### The JWK set cache

> *"Also by default, Resource Server caches in-memory the authorization server's JWK set for
> 5 minutes, which you may want to adjust."*

Five minutes means a JWK set fetch every five minutes per instance, and a five-minute window
in which a request carrying a newly rotated `kid` triggers a fresh fetch. To take control:

```java
@Bean
public JwtDecoder jwtDecoder(CacheManager cacheManager) {
    return NimbusJwtDecoder.withIssuerLocation(issuer)
            .cache(cacheManager.getCache("jwks"))
            .build();
}
```

> *"When given a `Cache`, Resource Server will use the JWK Set Uri as the key and the JWK
> Set JSON as the value."*

> *"Spring isn't a cache provider, so you'll need to make sure to include the appropriate
> dependencies, like `spring-boot-starter-cache` and your favorite caching provider."*

A shared cache (Redis, Hazelcast) is the interesting case: it turns N instances each
fetching every five minutes into one fetch every five minutes, and it means a newly started
instance inherits a warm key set. The cost is that a poisoned cache entry is now poisoned
for everybody — the JWK set is security material and belongs in a cache you trust as much
as you trust the IdP.

The same `.cache(...)` call works through `JwkSetUriJwtDecoderBuilderCustomizer`, which is
how you get it without losing the validators.

## Why the customizer matters more than the timeout

Look again at what `JwtDecoderConfiguration` does with the builder:

```java
private JwtDecoder buildJwkSetUriJwtDecoder(JwkSetUriJwtDecoderBuilder builder) {
    this.jwkSetUriJwtDecoderBuilderCustomizers.orderedStream()
        .forEach((customizer) -> customizer.customize(builder));
    NimbusJwtDecoder decoder = builder.build();
    decoder.setJwtValidator(getValidator());
    return decoder;
}
```

Three lines, and the last one is the point. Every customizer runs, *then* Boot attaches
`getValidator()` — the composed issuer validator, audience validator and every
`OAuth2TokenValidator<Jwt>` bean in the context. Replace the `JwtDecoder` bean and you get
the builder but lose that last line. Publish a customizer and you get both.

The customizer is also `Ordered`-aware (`orderedStream()`), so several can coexist: one for
timeouts, one for the cache, one for a corporate proxy's `RestOperations`.

## A production-shaped pair

```java
@Configuration
class JwtDecoderTuning {

    @Bean
    @Order(10)
    JwkSetUriJwtDecoderBuilderCustomizer jwkTimeouts(RestTemplateBuilder builder) {
        RestOperations rest = builder
                .setConnectTimeout(Duration.ofSeconds(2))
                .setReadTimeout(Duration.ofSeconds(2))
                .build();
        return decoder -> decoder.restOperations(rest);
    }

    @Bean
    @Order(20)
    JwkSetUriJwtDecoderBuilderCustomizer jwkCache(CacheManager cacheManager) {
        return decoder -> decoder.cache(cacheManager.getCache("jwks"));
    }
}
```

Two seconds is a judgement, not a rule. The reasoning: the call is on the request path, the
client is already waiting, and a JWK endpoint that cannot answer in two seconds is not
going to answer usefully in thirty. Pair it with a retry budget you control rather than a
long timeout you do not.

## What a slow IdP does to a Tomcat thread pool

The mechanism is worth spelling out because the symptom points somewhere else entirely.
A key rotation lands. Every in-flight request now carries a `kid` that is not in the cache.
Each of those requests, on its own worker thread, enters the JWK fetch. The IdP is slow —
not down, slow. Each thread blocks for up to the read timeout. With a 200-thread pool and
a 30-second timeout, the pool is saturated within a second of steady traffic and stays
saturated for thirty. Health checks that share the pool now fail. The platform restarts
the pod. The new pod has an empty cache and does exactly the same thing.

Nothing in your service's metrics says "IdP". The dashboards say thread pool exhausted,
latency infinite, restarts climbing. This is why the timeout is a resilience control and
not a tuning knob.

## Cache sizing, honestly

The default is *"in-memory the authorization server's JWK set for 5 minutes"*. Three
decisions follow:

- **Longer TTL** — fewer fetches, more tolerance of an IdP outage, and a longer window in
  which a key the IdP has retired is still trusted by you. If the IdP retires keys because
  one was compromised, that window is exactly your exposure.
- **Shorter TTL** — more fetches, less exposure, more load on a shared endpoint from every
  instance you scale to.
- **Shared cache** — one fetch per cluster rather than one per instance per TTL, and warm
  keys for a newly started pod. The value stored is the JWK Set JSON keyed by the JWK Set
  URI, so anything that can write that key can install signing keys your whole fleet will
  trust.

There is no universally correct answer, which is why Spring ships a default and an
extension point rather than a recommendation.

## Gotchas

**★ 30-second connect and read timeouts are the default for the JWK fetch.**
Under a hung IdP, request threads block for 30 seconds each. Set them explicitly — via
`JwkSetUriJwtDecoderBuilderCustomizer` so the validators survive.

**★ The JDK system properties are global.**
`sun.net.client.defaultConnectTimeout` changes every `HttpURLConnection` in the JVM, not
just the JWK fetch. It is the zero-code option, not the correct one.

**★ A five-minute JWK cache means an unrecognised `kid` can trigger a fetch on the hot
path.**
That is the desired behaviour — it is how rotation works transparently — but it means an
IdP outage that coincides with a rotation produces failures for tokens that are otherwise
perfectly valid. Budget for it in your availability model.

**★ A shared JWK cache is shared attack surface.**
The value is the JWK Set JSON keyed by the JWK Set URI. Anything with write access to that
cache can install signing keys for your entire fleet. In-memory per-instance caching is the
safer default; reach for a shared one only with the write path locked down.

**★ Setting the cache but replacing the decoder loses the validators anyway.**
`NimbusJwtDecoder.withIssuerLocation(issuer).cache(...).build()` inside a `@Bean` method is
the reference's own illustration of the cache API, not a template for production. It has no
`setJwtValidator` call, so the resulting decoder validates `typ` and timestamps and nothing
else. Use the customizer.

**★ `spring-boot-starter-cache` alone gives you no cache.**
The reference says it: *"Spring isn't a cache provider, so you'll need to make sure to
include the appropriate dependencies, like `spring-boot-starter-cache` and your favorite
caching provider."* Without a provider you get the no-op or simple map cache, which is not
what you designed for.

**★ The timeouts apply to the discovery probe as well as the key fetch.**
Both go through the same `RestOperations`. A discovery endpoint behind a slow WAF costs you
the same thirty seconds on the first token after a restart.

## Interview questions

**★ You need a two-second timeout on the JWK fetch. What is the least destructive way?**
Publish a `JwkSetUriJwtDecoderBuilderCustomizer` bean that sets `restOperations(...)` on the
builder. Boot applies every such customizer inside `buildJwkSetUriJwtDecoder` and then still
attaches `getValidator()`, so you keep issuer validation, audience validation and any
`OAuth2TokenValidator<Jwt>` beans — none of which survive if you replace the `JwtDecoder`
bean outright.

**★ What is the default JWK set cache duration, and what does changing it buy you?**
Five minutes, in memory, per instance. Lengthening it reduces load on the IdP and widens
the window in which a rotated-away key is still trusted locally; shortening it does the
opposite. Supplying a shared `Cache` collapses N instances' fetches into one and warms new
instances instantly, at the cost of making the cache itself security-critical.

**★ Why is a slow authorization server worse than a down one?**
Because a down one fails fast — connection refused — and the request errors immediately. A
slow one holds a request thread for the read timeout, which by default is thirty seconds.
Under sustained traffic after a key rotation, that saturates the servlet thread pool and
takes down endpoints that have nothing to do with tokens, including health checks, which
then gets the pod restarted with a cold cache.

**★ What exactly is stored in the JWK cache, and why does that make a shared cache
sensitive?**
The reference: *"Resource Server will use the JWK Set Uri as the key and the JWK Set JSON as
the value."* The value is the set of public keys the service will trust for signature
verification. Write access to that cache entry is equivalent to being able to mint tokens
for every instance reading from it.

**★ Where would you rather spend your resilience budget: a longer JWK timeout or a longer
cache TTL?**
The cache TTL. A long timeout converts an IdP slowdown into an outage of your own service;
a long TTL converts an IdP outage into a period where you keep serving with the keys you
already have. The trade-off on the TTL side is the window in which a retired key is still
accepted, which is a security decision you can reason about; thread-pool exhaustion is not.

---

← [Startup coupling](03-startup-coupling.md) · [Topic index](README.md) · Next → [The filter chain](04-the-filter-chain.md)
