---
title: "The last three rows of the Redis cache defaults decide what a bulk evict costs the whole server, whether `sync = true` means anything, and whether a cache outage is a latency event or an availability one"
sidebar_label: "5d · Clearing, locking and failing"
sidebar_position: 16
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the Spring Data Redis 4.1 reference *Redis Cache* — *Redis Cache
> Writer* and the defaults tables
> ([docs.spring.io/spring-data/redis/reference/redis/redis-cache.html](https://docs.spring.io/spring-data/redis/reference/redis/redis-cache.html)),
> the Spring Framework 7.0 reference *Cache Abstraction*
> ([docs.spring.io/spring-framework/reference/integration/cache/annotations.html](https://docs.spring.io/spring-framework/reference/integration/cache/annotations.html)),
> and the `Cacheable`, `Cache`, `SimpleCacheErrorHandler` and `TransactionAwareCacheDecorator`
> javadoc
> ([docs.spring.io/spring-framework](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/cache/interceptor/SimpleCacheErrorHandler.html)).
> JDK 25, Spring Boot 4.1.1, Spring Framework 7.0, Spring Data Redis 4.1, Redis 8.

**A `ConcurrentHashMap` cache clears in constant time, locks per bucket and cannot fail. Replace
it with Redis and all three stop being true: a bulk evict is an O(N) scan of the whole server's
keyspace, the cache does not lock per entry so `sync = true` stops meaning what it says, and the
store can be unreachable while your application is up — in which case, by default, cached
methods throw.**

## `clear()` is `KEYS` by default

> *"The cache implementation defaults to use `KEYS` and `DEL` to clear the cache. `KEYS` can
> cause performance issues with large keyspaces. Therefore, the default `RedisCacheWriter` can be
> created with a `BatchStrategy` to switch to a `SCAN`-based batch strategy. The `SCAN` strategy
> requires a batch size to avoid excessive Redis command round trips."*

So this annotation:

```java
@CacheEvict(cacheNames = "profiles", allEntries = true)
public void reindexProfiles() { … }
```

issues a `KEYS profiles::*` against Redis. `KEYS` walks **the entire keyspace of the instance** —
every key, including keys belonging to services that have nothing to do with you — and Redis
executes commands on a single thread, so nothing else runs while it does. On a large instance
that is a visible latency spike for every client. Put the annotation on a method someone calls
in a loop and you have written a denial of service against shared infrastructure.

The `SCAN` alternative has to be built by hand, because the default writer is constructed for
you:

```java
@Bean
RedisCacheManager cacheManager(RedisConnectionFactory factory, RedisCacheConfiguration defaults) {
    return RedisCacheManager
            .builder(RedisCacheWriter.nonLockingRedisCacheWriter(factory, BatchStrategies.scan(1000)))
            .cacheDefaults(defaults)
            .build();
}
```

⚠️ That is a `CacheManager` bean, which backs Boot out of the auto-configuration entirely
([5e](05e-changing-the-defaults-safely.md)). You now own the prefix, the TTL and the serializer
explicitly. That cost is why the honest recommendation is usually not "switch to `SCAN`" but
**"stop doing bulk evicts"**: a version segment in the key prefix
([5](05-redis-as-the-store.md)) abandons a whole generation of entries with no command at all.

Two constraints on `SCAN` from the same page:

> *"The `KEYS` batch strategy is fully supported using any driver and Redis operation mode
> (Standalone, Clustered). `SCAN` is fully supported when using the Lettuce driver. Jedis
> supports `SCAN` only in non-clustered modes."*

On Jedis in a Redis Cluster, the `KEYS` problem is not optional. That is a deployment fact that
decides an application design question, which is an uncomfortable but real dependency.

## `evict` may be deferred; `evictIfPresent` may not be

The `Cache` interface has two eviction methods and two clearing methods, and the difference is
stated in their javadoc rather than their names:

> `evict(Object)` — *"Evict the mapping for this key from this cache if it is present. Actual
> eviction may be performed in an asynchronous or deferred fashion, with subsequent lookups
> possibly still seeing the entry. This may for example be the case with transactional cache
> decorators."*

> `evictIfPresent(Object)` — *"Evict the mapping for this key from this cache if it is present,
> expecting the key to be immediately invisible for subsequent lookups."*

and correspondingly `clear()` versus `invalidate()`: *"Invalidate the cache through removing all
mappings, expecting all entries to be immediately invisible for subsequent lookups."*

**`@CacheEvict` calls the deferred forms.** If you are writing invalidation by hand against a
`Cache` — and [7 · Invalidation](07-invalidation.md) argues you sometimes must — the choice of
method is the choice between "eventually gone" and "gone now". It matters most under a
transaction-aware decorator, whose own javadoc says:

> *"**Note:** Use of immediate operations such as `putIfAbsent(Object, Object)` and
> `evictIfPresent(Object)` cannot be deferred to the after-commit phase of a running transaction.
> Use these with care in a transactional environment."*

So the immediate variants bypass the very mechanism you added the decorator for. There is no
method that is both immediate and transaction-safe, because those are contradictory requirements.

## Lock-free by default, which is what `sync = true` collides with

> *"`RedisCacheManager` defaults to a lock-free `RedisCacheWriter` for reading and writing binary
> values. Lock-free caching improves throughput. The lack of entry locking can lead to
> overlapping, non-atomic commands for the `Cache` `putIfAbsent` and `clean` operations… The
> locking counterpart prevents command overlap by setting an explicit lock key and checking
> against presence of this key, which leads to additional requests and potential command wait
> times."*

and the sentence that settles the question:

> *"Locking applies on the **cache level**, not per **cache entry**."*

Now put that next to what `sync` claims. The framework reference:

> *"In a multi-threaded environment, certain operations might be concurrently invoked for the
> same argument (typically on startup). By default, the cache abstraction does not lock anything,
> and the same value may be computed several times, defeating the purpose of caching."* … *"you
> can use the `sync` attribute to instruct the underlying cache provider to lock the cache entry
> while the value is being computed."* … *"This is an optional feature, and your favorite cache
> library may not support it."*

and the `@Cacheable` javadoc, which is blunter:

> *"This is effectively a hint and the chosen cache provider might not actually support it in a
> synchronized fashion."*

**On Redis with the default writer there is no entry lock, so concurrent misses on the same key
each run the method.** Switching to `lockingRedisCacheWriter` does not give you what you wanted
either: its lock is per *cache*, so you have replaced a stampede on one key with serialisation
across every key in that cache — every request for every profile queues behind one slow
computation. Neither setting is the per-key single-flight the annotation reads like.

`sync` also carries three restrictions that apply everywhere, from the javadoc:

> *"1. `unless()` is not supported 2. Only one cache may be specified 3. No other cache-related
> operation can be combined"*

If you genuinely need single-flight against a shared store, write it: a short-lived Redis lock
key taken around the recompute, with a timeout, and a fallback that serves stale or computes
anyway when the lock cannot be taken. That is more code than an annotation attribute, and it is
the only version that does what people think the attribute does.

## Gotchas

**★ `@CacheEvict(allEntries = true)` issues `KEYS` by default**, an O(N) walk of the whole
instance's keyspace on a single-threaded server shared with everyone else's data.

**★ `SCAN` is not universally available.** Fully supported on Lettuce; Jedis supports it only in
non-clustered mode. On Jedis in a cluster you cannot fix the `KEYS` problem by configuration.

**★ Switching to a `SCAN` writer means constructing the `CacheManager` yourself**, which backs
Boot out of the auto-configuration and hands you the prefix, TTL and serializer. Weigh that
against simply not doing bulk evicts.

**★ `evict` is documented as possibly deferred; `evictIfPresent` is the immediate one.** If your
invalidation must be visible before the method returns, the method name matters.

**★ The immediate variants cannot be deferred to after-commit.** Under a transaction-aware
decorator, `evictIfPresent` and `putIfAbsent` bypass the deferral, which is the opposite of what
the decorator was added to do.

**★ `sync = true` does not give per-key single-flight on Redis.** The default writer is
lock-free; the locking writer locks the whole cache. The javadoc calls `sync` "effectively a
hint".

**★ `sync = true` silently disallows `unless`, multiple caches, and combination with other cache
operations.** Those are compile-time-invisible constraints on a single boolean attribute.

**★ The locking cache writer can be worse than the stampede it prevents.** Cache-level locking
serialises unrelated keys, so one slow recompute blocks every other lookup in that cache.

## Interview questions

**★ What actually happens when you call `@CacheEvict(allEntries = true)` against Redis?**
By default the cache writer builds the key set with `KEYS <prefix>*` and then deletes them.
`KEYS` scans the whole keyspace of the instance — everyone's keys, not just this cache's — and
Redis runs it on the single command thread, so it blocks every other client for the duration. On
a large instance that is a latency spike for unrelated services, and if the annotated method is
called frequently it is a sustained one. The documented alternative is a `SCAN`-based
`BatchStrategy`, which requires building the cache writer and therefore the `CacheManager`
yourself and is Lettuce-only in cluster mode. The alternative I would reach for first is not
doing it at all: put a version in the key prefix and bump it, which abandons the generation with
no command.

**★ Does `sync = true` prevent a cache stampede?**
It depends entirely on the provider, and on Redis the honest answer is no. `RedisCacheManager`
defaults to a lock-free writer, so concurrent misses on the same key each invoke the method —
which is why the `@Cacheable` javadoc calls `sync` "effectively a hint" and says the provider
might not support it in a synchronized fashion. You can opt in to `lockingRedisCacheWriter`, but
the reference says locking "applies on the cache level, not per cache entry", so you would
serialise every key in the cache to protect one. The in-process cache managers do support it
properly. If I need single-flight against a shared store I implement it explicitly with a
short-lived lock key and a timeout, and I accept that a request that cannot take the lock has to
do something specific — wait, serve stale, or compute anyway.

**★ What is the difference between `evict` and `evictIfPresent`?**
Their contracts, not their behaviour on any particular provider. `evict` is documented as
possibly asynchronous or deferred, with subsequent lookups possibly still seeing the entry;
`evictIfPresent` expects the key to be immediately invisible afterwards, and returns whether an
entry was actually there. The distinction exists because of decorators — notably the
transaction-aware one, which defers `put`, `evict` and `clear` to the after-commit phase and
explicitly cannot defer the immediate variants. So `evictIfPresent` under a transaction-aware
cache runs now, before commit, which is either exactly what you wanted or exactly the bug the
decorator was there to prevent.

**★ Why does Spring's `Cache` interface have both `clear()` and `invalidate()`?**
For the same reason it has both `evict` and `evictIfPresent`: to let a caller state whether it
needs the removal to be visible immediately or is content for it to be deferred. `clear()` is
documented as possibly asynchronous, with subsequent lookups possibly still seeing entries;
`invalidate()` expects all entries to be immediately invisible and reports whether the cache was
non-empty. Under a plain provider they behave the same, which is why the distinction looks
academic until you wrap the cache in a transaction-aware decorator and the deferred forms start
waiting for a commit that has not happened yet.

{/* FOOTER */}
