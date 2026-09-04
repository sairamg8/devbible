---
title: "There are four places to change how the cache is configured and three of them silently disable something else, so the only safe way to override one default is to know which extension point Boot backs out of"
sidebar_label: "5e · Changing the defaults safely"
sidebar_position: 18
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the Spring Boot 4.1 reference *Caching*
> ([docs.spring.io/spring-boot/reference/io/caching.html](https://docs.spring.io/spring-boot/reference/io/caching.html)),
> Boot 4.1.x `RedisCacheConfiguration` and `CacheProperties` on the `4.1.x` branch
> ([github.com/spring-projects/spring-boot](https://github.com/spring-projects/spring-boot/blob/4.1.x/module/spring-boot-cache/src/main/java/org/springframework/boot/cache/autoconfigure/RedisCacheConfiguration.java)),
> the `RedisCacheManager.RedisCacheManagerBuilder` javadoc
> ([docs.spring.io/spring-data/redis](https://docs.spring.io/spring-data/redis/docs/current/api/org/springframework/data/redis/cache/RedisCacheManager.RedisCacheManagerBuilder.html))
> and the Spring Framework 7.0 reference *Configuring the Cache Storage*
> ([docs.spring.io/spring-framework/reference/integration/cache/store-configuration.html](https://docs.spring.io/spring-framework/reference/integration/cache/store-configuration.html)).
> JDK 25, Spring Boot 4.1.1, Spring Framework 7.0, Spring Data Redis 4.1, Redis 8.

**Every previous chunk in this section ended with "so set it explicitly", and this is where that
goes wrong. Boot's cache auto-configuration is a chain of conditionals, and the natural place to
put your override — a `@Bean` of the type you want to change — is usually the one place that
makes the auto-configuration stop running. The result is not an error; it is your
`application.yaml` quietly ceasing to mean anything.**

## Four extension points, ordered by how much they take away

| You define | What Boot does |
|---|---|
| `spring.cache.*` properties | Read by the auto-configuration. Nothing is disabled. |
| `CacheManagerCustomizer<T>` bean | Invoked on the auto-configured manager, if the type matches. |
| `RedisCacheManagerBuilderCustomizer` bean | Invoked on Boot's own builder. Properties still apply. |
| `RedisCacheConfiguration` bean | **Replaces** the property-derived configuration wholesale. |
| `CacheManager` bean | Backs out of the auto-configuration entirely. |

The Boot reference states the last row as the entry condition for the whole feature:

> *"If you have not defined a bean of type `CacheManager` or a `CacheResolver` named
> `cacheResolver`, Spring Boot tries to auto-detect available cache providers."*

which is the same thing the auto-configuration class says with an annotation,
`@ConditionalOnMissingBean(CacheManager.class)`. Defining a `RedisCacheManager` to change one
setting therefore removes the key prefix, the TTL property, the null-value property and the
serializer choice at once — and the reference's key-prefix advice is worded for exactly this
audience: *"We strongly recommend keeping this setting enabled if you create your own
`RedisCacheManager`."*

## The one-line trap

The `RedisCacheConfiguration` row is the one that catches people, and it is a single line of the
auto-configuration:

```java
private org.springframework.data.redis.cache.RedisCacheConfiguration determineConfiguration(
        CacheProperties cacheProperties,
        ObjectProvider<org.springframework.data.redis.cache.RedisCacheConfiguration> redisCacheConfiguration,
        @Nullable ClassLoader classLoader) {
    return redisCacheConfiguration.getIfAvailable(() -> createConfiguration(cacheProperties, classLoader));
}
```

`getIfAvailable` takes the supplier only when no bean exists. And `createConfiguration` is the
method that reads the properties:

```java
config = config.serializeValuesWith(SerializationPair.fromSerializer(new JdkSerializationRedisSerializer(classLoader)));
if (redisProperties.getTimeToLive() != null)   config = config.entryTtl(redisProperties.getTimeToLive());
if (redisProperties.getKeyPrefix() != null)    config = config.prefixCacheNameWith(redisProperties.getKeyPrefix());
if (!redisProperties.isCacheNullValues())      config = config.disableCachingNullValues();
if (!redisProperties.isUseKeyPrefix())         config = config.disableKeyPrefix();
```

**Define a `RedisCacheConfiguration` bean to set a serializer and you have turned off
`time-to-live`, `key-prefix`, `use-key-prefix` and `cache-null-values`.** They stay in the YAML.
They stop applying. The most common casualty is the TTL, and its absence is invisible until the
instance fills up ([5c](05c-expiry-and-eviction.md)).

If you take this route — and there are good reasons to — set every property you care about on
the bean instead, and delete them from the YAML so nobody reads them as still in force:

```java
@Bean
org.springframework.data.redis.cache.RedisCacheConfiguration cacheConfiguration(RedisSerializer<Object> json) {
    return org.springframework.data.redis.cache.RedisCacheConfiguration.defaultCacheConfig()
            .serializeValuesWith(SerializationPair.fromSerializer(json))
            .entryTtl(Duration.ofMinutes(10))
            .computePrefixWith(cacheName -> "app:v4:" + cacheName + "::");
}
```

The safer alternative for most changes is the builder customizer, which composes rather than
replaces because Boot invokes it explicitly:

```java
redisCacheManagerBuilderCustomizers.orderedStream()
        .forEach((customizer) -> customizer.customize(builder));
```

⚠️ `CacheManagerCustomizer` has a caveat of its own, stated in the reference:

> *"In the preceding example, an auto-configured `ConcurrentMapCacheManager` is expected. If that
> is not the case (either you provided your own config or a different cache provider was
> auto-configured), the customizer is not invoked at all."*

A customizer typed to the wrong `CacheManager` is silently skipped. Combine that with the silent
provider downgrade from [5](05-redis-as-the-store.md) and you can have a customizer that runs
locally, where `spring.cache.type` resolved to `simple`, and never runs in production.

## Which caches exist

By default `RedisCacheManager` creates a cache the first time a name is requested, so any
`cacheNames` value in any annotation is valid — including a typo, which becomes a real, separate,
permanently-cold cache. Boot lets you pin the set:

```yaml
spring:
  cache:
    cache-names: profiles,fxRates,countries
```

which becomes `builder.initialCacheNames(...)`, and which the reference warns about precisely:

> *"If you do so and your application uses a cache not listed, then it fails at runtime when the
> cache is needed, but not on startup."*

That converts a typo from "silently useless cache" into "exception the first time this method is
called". Better, and not startup validation — it only helps on a path you actually exercise, so
its value is proportional to your test coverage of cached methods.

⚠️ `initialCacheNames` has an ordering trap, stated in its javadoc: *"This calls depends on
`cacheDefaults(RedisCacheConfiguration)` using whatever default `RedisCacheConfiguration` is
present at the time of invoking this method."* If you build the manager by hand, call
`cacheDefaults` **before** `initialCacheNames` — otherwise the caches that exist at startup, the
ones you were most deliberate about, get the previous defaults.

The underlying switch is `disableCreateOnMissingCache()`: *"`getMissingCache(String)` returns
`null` for any non-configured, undeclared `Cache` instead of a new `RedisCache` instance. This
allows the `CompositeCacheManager` to participate."*

## Turning it off, on purpose

Two switches worth knowing, for two different reasons.

**`spring.cache.type=none`** — *"To use a no-op cache rather than the auto-configured cache
manager in a certain environment, set the cache type to `none`."* The framework describes what a
no-op cache does: it *"does not store any information, causing the target method to be invoked
every time"*. That is the right setting for a test profile where you want to assert on what the
database was asked, and it is a far better answer than removing annotations or hoping the cache
is cold — see the warm-cache trap in
[../08-the-n-plus-1-problem/17b-the-second-level-cache.md](../08-the-n-plus-1-problem/17b-the-second-level-cache.md).

**Where `@EnableCaching` lives.** The reference gives this as a WARNING:

> *"Avoid adding `@EnableCaching` to the main method's application class. Doing so makes caching
> a mandatory feature, including when running a test suite."*

Put it on a `@Configuration` class you can exclude, so that a slice test or a profile can run
without the cache infrastructure at all. On the application class it is loaded by every test that
loads the application class, which is most of them.

## Gotchas

**★ Defining any `CacheManager` bean backs Boot out of the whole cache auto-configuration.** The
reference states the entry condition explicitly, and so does
`@ConditionalOnMissingBean(CacheManager.class)`. You inherit responsibility for the prefix, the
TTL and the serializer at the moment you define that bean.

**★ A `CacheResolver` bean named `cacheResolver` has the same effect.** It is the second half of
the same documented condition and is easy to add without realising it disables provider
detection.

**★ Defining a `RedisCacheConfiguration` bean silently discards four `spring.cache.redis.*`
properties.** `getIfAvailable` means `createConfiguration` never runs. The YAML stays, and stops
meaning anything.

**★ A `CacheManagerCustomizer` typed to the wrong manager is not invoked and does not complain.**
The reference says so in as many words. Combined with the silent provider downgrade, a customizer
can work on your machine and never run in production.

**★ `spring.cache.cache-names` fails at runtime, not at startup.** Its value is bounded by how
thoroughly your tests exercise cached methods.

**★ `initialCacheNames` snapshots whatever `cacheDefaults` was set when you called it.** Order
the builder calls the other way round and the pre-created caches — the ones that exist at startup
— get the wrong configuration.

**★ Per-cache configurations built from `defaultCacheConfig()` revert to the library defaults**,
not yours. Derive them from your own base configuration or the caches you tuned lose the
serializer you chose.

**★ `@EnableCaching` on the application class makes caching mandatory in every test.** The Boot
reference raises this as a warning; put it on a configuration class you can exclude.

**★ `spring.cache.type=none` is a no-op cache, not "no caching code".** The annotations still
run, the proxies still exist, and the target method is invoked every time — which is exactly
what you want in a test asserting query counts, and not the same as proving the annotations are
absent.

**★ There is no warning anywhere for any of this.** Every failure in this chunk is a
configuration that silently does less than you think. The only reliable check is to assert on
the actual runtime configuration rather than on the fact that the YAML contains the setting.

## Interview questions

**★ You need a JSON serializer on your Redis cache. Where do you put the change, and why does it
matter?**
The obvious place is a `RedisCacheConfiguration` bean, and that is the wrong one. Boot's
auto-configuration resolves that bean with `getIfAvailable`, so defining it means the method that
reads `spring.cache.redis.time-to-live`, `key-prefix`, `use-key-prefix` and `cache-null-values`
never runs — those properties silently stop applying while remaining in the YAML, and the one
people miss is the TTL. The composing extension point is a `RedisCacheManagerBuilderCustomizer`,
which Boot invokes against its own builder. If I do want to own the configuration, I set every
property explicitly on the bean and delete them from the YAML, so that the file does not claim
settings that are not in force.

**★ How does Spring Boot decide it should not configure caching for you?**
Two documented conditions: a bean of type `CacheManager`, or a `CacheResolver` bean named
`cacheResolver`. Either one means Boot does not try to auto-detect a provider at all. That is a
sensible design — you have clearly taken over — but it is a large step to take by accident, and
people do take it by accident, because "I need a `SCAN`-based cache writer" or "I need per-cache
TTLs" both look like reasons to declare a `RedisCacheManager`. The consequence worth naming is
the key prefix: it is on by default, the reference strongly recommends keeping it, and it
disappears along with everything else.

**★ How would you disable caching in tests?**
`spring.cache.type=none`, which gives a no-op cache manager: the framework describes a no-op
cache as one that "does not store any information, causing the target method to be invoked every
time". That keeps the proxies and annotations in place, so the wiring is still exercised, while
guaranteeing that a statement-count or interaction assertion measures the code and not the cache.
The structural half of the same answer is where `@EnableCaching` lives — the Boot reference
warns against putting it on the application class, because that makes caching mandatory for every
test that loads the application class, which is most of them.

**★ Someone adds `spring.cache.cache-names` to lock down the cache list. Good idea?**
Mostly yes, with a caveat about what it actually buys. Without it, `RedisCacheManager` creates a
cache on demand, so a typo in a `cacheNames` attribute produces a real cache that nothing else
ever touches — permanently cold, invisible in review, and indistinguishable from a cache that is
simply not helping. With it, the same typo throws. But the reference is explicit that the failure
is at runtime when the cache is needed and not at startup, so it only catches typos on paths the
tests execute. I would take it, and I would not describe it as validation.

**★ Your cache configuration works locally and does nothing in production. What is the
mechanism?**
Almost certainly a conditional that resolved differently. The two documented ones are the
provider fallback — with no `RedisConnectionFactory` bean, Boot falls back to a
`ConcurrentHashMap` implementation without complaining, so locally you get `simple` and in
production you get Redis, or vice versa — and `CacheManagerCustomizer`, which the reference says
"is not invoked at all" if the auto-configured manager is not the type the customizer is
parameterised with. Between them you can have a customizer that runs against a
`ConcurrentMapCacheManager` on a laptop and is silently skipped against a `RedisCacheManager` in
production. Pinning `spring.cache.type` in every environment removes the first half and makes the
second half fail loudly.

{/* FOOTER */}
