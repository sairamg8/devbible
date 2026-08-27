---
title: "Moving the cache to Redis makes it shared, and in exchange the cache becomes a network hop and a separate failure domain configured entirely by defaults you did not choose"
sidebar_label: "5 · Redis as the store"
sidebar_position: 11
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the Spring Data Redis 4.1 reference *Redis Cache*
> ([docs.spring.io/spring-data/redis/reference/redis/redis-cache.html](https://docs.spring.io/spring-data/redis/reference/redis/redis-cache.html)),
> the `RedisCacheManager.RedisCacheManagerBuilder` javadoc
> ([docs.spring.io/spring-data/redis](https://docs.spring.io/spring-data/redis/docs/current/api/org/springframework/data/redis/cache/RedisCacheManager.RedisCacheManagerBuilder.html)),
> the Spring Boot 4.1 reference *Caching*
> ([docs.spring.io/spring-boot/reference/io/caching.html](https://docs.spring.io/spring-boot/reference/io/caching.html))
> and Boot 4.1.x `RedisCacheConfiguration` on the `4.1.x` branch
> ([github.com/spring-projects/spring-boot](https://github.com/spring-projects/spring-boot/blob/4.1.x/module/spring-boot-cache/src/main/java/org/springframework/boot/cache/autoconfigure/RedisCacheConfiguration.java)).
> JDK 25, Spring Boot 4.1.0, Spring Framework 7.0, Spring Data Redis 4.1, Redis 8.

**A `ConcurrentHashMap` cache is per-JVM, so with three pods you have three caches, three copies
of every entry and three different opinions about what the answer is. Redis fixes that by
putting one cache behind all of them. What it costs is that every hit is a network round trip
and a deserialization, the cache can be down while the application is up, and the whole thing is
governed by two tables of defaults that were chosen for safety in the abstract rather than for
your data.**

## What Boot actually wires

Boot's provider detection order is fixed and documented: *Generic, JCache (JSR-107), Hazelcast,
Infinispan, Couchbase, Redis, Caffeine, Cache2k, Simple*. Redis wins only if a
`RedisConnectionFactory` bean exists, none of the earlier providers matched, and — from the
auto-configuration class itself — you have not already defined a `CacheManager`:

```java
@Configuration(proxyBeanMethods = false)
@ConditionalOnClass(RedisConnectionFactory.class)
@ConditionalOnBean(RedisConnectionFactory.class)
@ConditionalOnMissingBean(CacheManager.class)
@Conditional(CacheCondition.class)
class RedisCacheConfiguration { … }
```

If none of that matches, you fall through to the bottom of the list, and the bottom of the list
is not an error:

> *"If none of the other providers can be found, a simple implementation using a
> `ConcurrentHashMap` as the cache store is configured. This is the default if no caching library
> is present in your application."* … *"The simple provider is not really recommended for
> production usage."*

**So the failure mode of "Redis caching is misconfigured" is not a startup failure. It is a
per-pod in-memory map that works, passes every test, and quietly reintroduces every problem you
moved to Redis to solve.** Pin it if it matters:

```yaml
spring:
  cache:
    type: redis
```

With the type pinned, a missing provider is a startup failure instead of a silent downgrade.
That single line is the highest-value thing on this page.

## The defaults you inherit

The reference gives `RedisCacheConfiguration`'s defaults as a table:

| Setting | Value |
|---|---|
| Key Expiration | None |
| Cache `null` | Yes |
| Prefix Keys | Yes |
| Default Prefix | The actual cache name |
| Key Serializer | `StringRedisSerializer` |
| Value Serializer | `JdkSerializationRedisSerializer` |
| Conversion Service | `DefaultFormattingConversionService` with default cache key converters |

and `RedisCacheManager`'s as another:

| Setting | Value |
|---|---|
| Cache Writer | Non-locking, `KEYS` batch strategy |
| Cache Configuration | `RedisCacheConfiguration#defaultConfiguration` |
| Initial Caches | None |
| Transaction Aware | No |

Read those as a list of decisions that have already been made for you. Four of the rows are
load-bearing enough to get their own chunks:

| Row | Where it is settled |
|---|---|
| Value Serializer = `JdkSerializationRedisSerializer` | [5b · Serialization is the hard part](05b-serialization-is-the-hard-part.md) |
| Key Expiration = None | [5c · Expiry and eviction](05c-expiry-and-eviction.md) |
| Cache Writer = non-locking, `KEYS` | [5d · Clearing, locking and failing](05d-clearing-locking-and-failing.md) |
| Transaction Aware = No | [7 · Invalidation](07-invalidation.md) |

And because changing any of them is itself a trap — the obvious extension point silently
discards your `application.yaml` — how to change a default without losing the rest is
[5e · Changing the defaults without losing them](05e-changing-the-defaults-safely.md).

`Cache null: Yes` matches the framework's own behaviour and is argued in
[4 · Condition, unless and null](04-null-and-sync.md); the Redis switch for it is
`spring.cache.redis.cache-null-values`. The `Conversion Service` row is why a custom key class
that works fine on a `ConcurrentHashMap` throws on Redis — see
[3d](03d-the-key-that-never-repeats.md).

## The key prefix, and why you keep it

> *"By default, any `key` for a cache entry gets prefixed with the actual cache name followed by
> two colons (`::`)."*

So `@Cacheable(cacheNames = "profiles", key = "#id")` with `id = 42` becomes the Redis key
`profiles::42`. Boot's reference explains why and gives it an unusually strong recommendation:

> *"By default, a key prefix is added so that, if two separate caches use the same key, Redis
> does not have overlapping keys and cannot return invalid values. We strongly recommend keeping
> this setting enabled if you create your own `RedisCacheManager`."*

Read "invalid values" literally. Without the prefix, `profiles` key `42` and `orders` key `42`
are the same Redis key, and a lookup in one cache returns the other cache's object. That is not
a stale answer, it is the wrong entity — and if the serializer is type-aware you get a
deserialization exception, while if it is not you get a silently wrong object of the right
shape.

`spring.cache.redis.use-key-prefix=false` and `disableKeyPrefix()` exist for the case where you
share a keyspace with a non-Java consumer that expects bare keys. If you use them, every cache
in the application must have disjoint key spaces by construction, and you have to keep that
true forever, including for the cache someone adds next year.

You can also shape the prefix rather than remove it:

```java
RedisCacheConfiguration.defaultCacheConfig()
        .prefixCacheNameWith("app:v3:");                       // static

RedisCacheConfiguration.defaultCacheConfig()
        .computePrefixWith(cacheName -> "app:v3:" + cacheName + ":");   // computed
```

**A version segment in the prefix is the cheapest available answer to "the cached shape
changed".** Bumping `v3` to `v4` abandons an entire generation of entries with no `DEL`, no
`KEYS` scan and no coordination between pods — the old keys simply stop being addressed and
expire on their own. Keep that in mind while reading
[5b](05b-serialization-is-the-hard-part.md), where the alternative is a deploy that cannot read
its own cache.

## Gotchas

**★ A missing Redis provider does not fail, it downgrades to a `ConcurrentHashMap`.** The
application starts, the tests pass, and each pod caches privately with no shared state. Set
`spring.cache.type=redis` so a misconfiguration is a startup failure.

**★ Disabling the key prefix makes two caches with the same key collide.** The result is not
staleness, it is one cache returning another cache's object — a deserialization exception if
you are lucky and a wrong entity of the right shape if you are not.

**★ The prefix is an invalidation tool, not just a namespace.** A version segment in it lets you
abandon a whole generation of entries without touching Redis, which is strictly better than the
bulk evict in [5d](05d-clearing-locking-and-failing.md).

**★ Every hit is a network round trip plus a deserialization.** For a lookup that was already an
indexed primary-key read, Redis can be slower than the database it is protecting — see
[8 · When not to cache](08-when-not-to-cache.md).

**★ `Transaction Aware: No` is in the defaults table.** The eviction happens when the method
returns, not when the transaction commits. That is [7 · Invalidation](07-invalidation.md), and
it is the single most common source of "we evicted it and it came back stale".

**★ A shared cache means a shared blast radius.** Every pod now reads the same wrong entry, and
one pod writing a bad value poisons all of them at once. The local-cache version of the same bug
affects a third of your traffic and heals on the next deploy of that pod.

## Interview questions

**★ Why move a cache from Caffeine or a `ConcurrentHashMap` to Redis?**
Because a local cache is per-JVM, and with more than one instance you have as many caches as
instances, each with its own copy and its own idea of what is current. An eviction on the pod
that handled the write does nothing to the other pods' copies, so the staleness window is
unbounded rather than TTL-bounded. Redis makes it one cache: an entry is written once instead of
once per pod, and an eviction is global. The costs are real — every hit becomes a network round
trip plus a deserialization, the cache can be unavailable while the application is up, and you
have introduced a serialization contract between deploys that did not exist while the objects
never left the heap.

**★ What are the Spring Data Redis cache defaults?**
No key expiration, nulls cached, keys prefixed with the cache name and two colons, a
`StringRedisSerializer` for keys and `JdkSerializationRedisSerializer` for values, a
non-locking cache writer that uses `KEYS` for clears, no initial caches and not
transaction-aware. Almost every production problem with a Spring Redis cache is one of those
rows: the serializer breaks across a deploy, the missing expiry fills the instance, the `KEYS`
clear blocks the server, and the missing transaction awareness evicts before commit. It is worth
knowing the table by heart because none of those defaults is wrong in the abstract — they are
just not decisions anyone on your team made.

**★ Why does the cache name appear in the Redis key?**
Because cache names are namespaces and Redis keys are not. Two caches will eventually use the
same key — id `42` exists in both `profiles` and `orders` — and without the prefix they are the
same Redis entry. Boot's reference puts it as "Redis does not have overlapping keys and cannot
return invalid values", and "invalid" is the right word: you get another cache's object back,
which either fails deserialization or, worse, does not. The prefix is also the cheapest
invalidation tool available, because bumping a version segment in it abandons a whole generation
of entries with no `DEL` and no coordination.

**★ Your Redis cache appears to work, but the hit rate is near zero and pods disagree. What do
you check first?**
Whether it is actually Redis. Boot's provider detection falls back to a `ConcurrentHashMap`
implementation when nothing else matches, and the fallback is silent — the application starts,
caching "works" per pod, and nothing is shared. A missing `RedisConnectionFactory`, a
`CacheManager` bean defined elsewhere that pre-empts the auto-configuration, or a connection
that failed to configure all land you there. The immediate check is the runtime type of the
`CacheManager` bean; the prevention is `spring.cache.type=redis`, which turns the downgrade into
a startup failure.

**★ What is the operational downside of one shared cache versus one cache per pod?**
Blast radius. A local cache holding a wrong value affects one instance's share of traffic and
disappears when that instance restarts. A shared cache holding a wrong value affects everything,
survives every restart, and — with the default `Key Expiration: None` — survives indefinitely.
The same property that makes a shared cache correct for invalidation makes it a single point of
wrongness, so the things I insist on for a shared cache are a TTL as a backstop, a versioned key
prefix so a bad generation can be abandoned, and a deliberate decision about what happens when
the store is unreachable.

{/* FOOTER */}
