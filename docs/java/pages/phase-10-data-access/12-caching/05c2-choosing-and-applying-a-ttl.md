---
title: "A TTL is the only bound on a cache that survives a code change, and it is not invalidation — it decides how long a wrong answer is allowed to live, which is a product decision wearing an engineering hat"
sidebar_label: "5c2 · Choosing and applying a TTL"
sidebar_position: 15
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the Spring Data Redis 4.1 reference *Redis Cache* — the defaults
> table, *Expiration/Eviction/Invalidation* and the `TtlFunction` example
> ([docs.spring.io/spring-data/redis/reference/redis/redis-cache.html](https://docs.spring.io/spring-data/redis/reference/redis/redis-cache.html)),
> the `RedisCacheManager.RedisCacheManagerBuilder` javadoc
> ([docs.spring.io/spring-data/redis](https://docs.spring.io/spring-data/redis/docs/current/api/org/springframework/data/redis/cache/RedisCacheManager.RedisCacheManagerBuilder.html)),
> and Boot 4.1.x `CacheProperties`
> ([github.com/spring-projects/spring-boot](https://github.com/spring-projects/spring-boot/blob/4.1.x/module/spring-boot-cache/src/main/java/org/springframework/boot/cache/autoconfigure/CacheProperties.java)).
> JDK 25, Spring Boot 4.1.0, Spring Data Redis 4.1, Redis 8.

**[5c](05c-expiry-and-eviction.md) argued that you need a TTL so the instance does not fill up.
This chunk is about the harder half: which TTL, applied to which cache, through which of three
APIs that are not interchangeable — and why the number you pick is a statement about how wrong
your application is allowed to be, not a memory setting.**

## TTL per cache

Per-cache TTL goes through the builder, via a customizer so Boot keeps configuring everything
else ([5e](05e-changing-the-defaults-safely.md) explains why this extension point and not the
obvious one):

```java
@Bean
RedisCacheManagerBuilderCustomizer cacheTtls() {
    return builder -> builder.withInitialCacheConfigurations(Map.of(
        "fxRates",   RedisCacheConfiguration.defaultCacheConfig().entryTtl(Duration.ofSeconds(30)),
        "profiles",  RedisCacheConfiguration.defaultCacheConfig().entryTtl(Duration.ofHours(6)),
        "countries", RedisCacheConfiguration.defaultCacheConfig().entryTtl(Duration.ofDays(1))));
}
```

🔴 `defaultCacheConfig()` is the *library* default, not Boot's. A per-cache configuration built
this way starts from `JdkSerializationRedisSerializer` and the standard prefix, discarding
whatever you configured globally. If you have a JSON serializer
([5b2](05b2-json-and-the-jackson-3-rename.md)), build the per-cache configurations from your own
base configuration and call `entryTtl` on that, not on `defaultCacheConfig()`.

## The three TTL controls are not interchangeable

- **`entryTtl(Duration)` / `enableTtl(Duration)`** — a fixed lifetime from the write.

- **`entryTtl(TtlFunction)`** — a lifetime computed per entry from its key and value. This is how
  you give negative entries a shorter life than positive ones, which is the mitigation
  [4 · Condition, unless and null](04-null-and-sync.md) points at:

  ```java
  enum ShorterForMisses implements TtlFunction {
      INSTANCE;
      @Override
      public Duration getTimeToLive(@Nullable Object key, @Nullable Object value) {
          return value instanceof NullValue ? Duration.ofSeconds(30) : Duration.ofHours(1);
      }
  }
  ```

- **`enableTimeToIdle()`** — sliding expiry. Without it the reference is unambiguous:

  > *"TTL is only set and reset by a create or update data access operation."*

  **A read does not extend the TTL.** Your hottest key expires on exactly the same schedule as
  your coldest one — and it is the hottest key whose expiry costs most, because that is the one
  a hundred concurrent requests will all miss on at the same instant.

## TTL is not invalidation

Be precise about what a TTL buys, because it is routinely oversold as a correctness mechanism.

A TTL bounds **how long a wrong answer survives**. It does not prevent one, it does not shorten
the window between the write and the next read, and it does not know that a write happened. A
ten-minute TTL on an account balance means the balance can be ten minutes wrong; whether that is
acceptable is a product decision, not an engineering one, and it is the decision
[1 · Caching is a decision](01-caching-is-a-decision.md) says to write down.

What a TTL genuinely does, and what nothing else does as cheaply:

- It **bounds the damage from a missed eviction**. Every invalidation scheme has holes — a write
  path someone forgot, a batch job, a change made directly in the database. The TTL is what
  turns those from permanent to temporary.
- It **bounds the damage from a poisoned generation**. A serializer change or a shape change
  ([5b](05b-serialization-is-the-hard-part.md)) leaves unreadable entries; with no TTL they are
  there forever.
- It **is the only bound on memory that survives a code change**, because it does not depend on
  anyone remembering to evict.

**So: a short TTL plus honest invalidation, not one or the other.** A cache with invalidation
and no TTL is one forgotten code path away from permanent wrongness; a cache with a TTL and no
invalidation is correct-eventually by design, which is a legitimate choice as long as it was a
choice.

## Gotchas

**★ A read does not extend a TTL.** *"TTL is only set and reset by a create or update data access
operation."* Without `enableTimeToIdle()` your hottest key expires on schedule and every
in-flight request for it misses simultaneously.

**★ `defaultCacheConfig()` inside a per-cache map silently reverts the serializer and the
prefix.** Every per-cache configuration must be derived from your configured base, not from the
library default — otherwise the caches you cared enough about to tune are the ones that lose
your JSON serializer.

**★ A TTL is not invalidation.** It bounds how long a stale answer lives; it does not shorten the
window after a write, and it cannot know a write happened.

**★ Choosing a TTL by "what feels safe" produces a number nobody can defend.** The question is
how stale this specific answer may be before someone is harmed, and the answer differs per
cache, which is why one global `time-to-live` is almost always wrong.

**★ Negative entries deserve a shorter TTL than positive ones**, and that needs a `TtlFunction`
— a single `entryTtl(Duration)` gives a cached "not found" the same lifetime as real data, which
is how a row created five minutes ago stays invisible for an hour.

**★ `enableTimeToIdle()` can keep an entry alive indefinitely.** Sliding expiry means a key that
is read constantly is never rewritten and never re-read from the source, so the staleness bound
you thought you set does not exist for exactly the keys that matter most.

**★ A `TtlFunction` runs on every write, and it receives the value.** Keep it cheap and keep it
total — an exception thrown there fails the cache put, which the default error handler turns
into a failed request.

**★ Identical TTLs across a warm-up produce synchronised expiry.** Everything written during the
first minute after a deploy expires during the same minute an hour later. Nothing in Spring
jitters this for you; if it matters, jitter it yourself in a `TtlFunction`.

## Interview questions

**★ How do you choose a TTL?**
By asking how stale this particular answer may be before it does harm, and being willing to
write the number down. A country list can be a day; a currency rate is seconds; an account
balance probably should not be cached at all. What I avoid is a single application-wide
`spring.cache.redis.time-to-live`, because it forces the tightest requirement onto every cache
or, more commonly, the loosest. And I treat the TTL as a backstop rather than the primary
mechanism: it bounds how long a missed invalidation hurts, which is what it is genuinely good
at.

**★ Does a TTL solve cache invalidation?**
No, and conflating the two is how caches quietly become wrong. A TTL bounds the lifetime of a
stale entry; it does nothing about the window between a write and the entry's natural expiry,
and it has no idea a write happened. What it does do — and nothing else does as cheaply — is
limit the blast radius of the invalidation you forgot to write, the batch job that updates rows
behind the application's back, and the entry left unreadable by a serialization change. So the
answer is both: explicit invalidation for the paths you know about, and a TTL short enough that
the paths you did not think of heal on their own.

**★ Why does a hot key expiring hurt more than a cold one?**
Because expiry is not staggered by access. The reference says TTL is only set and reset by a
create or update operation, so reading a key never extends its life — the key that serves a
thousand requests a second dies on the same fixed schedule as one that serves one a day. At the
instant it dies, every in-flight request for it misses simultaneously and they all go to the
database together. `enableTimeToIdle()` turns the TTL into a sliding window, which fixes the
schedule but not the herd; for the herd you need single-flight, and on Redis that is not what
`sync = true` gives you — see [5d](05d-clearing-locking-and-failing.md).

**★ How do you give cached misses a shorter lifetime than cached hits?**
With a `TtlFunction` rather than a fixed `entryTtl(Duration)`. The function receives the key and
the value, and Spring's cached null is a `NullValue` sentinel, so the check is a type test:
`NullValue` gets thirty seconds, everything else gets the real TTL. It matters because negative
caching is on by default, and a cached "not found" with the same lifetime as real data is how a
newly-created row stays invisible for an hour. The alternative — a separate cache name for
misses — works too and costs a second annotation on every method, which is why the TTL function
is usually the better trade.

**★ When is `enableTimeToIdle()` the wrong choice?**
Whenever the TTL exists for correctness rather than for memory. Sliding expiry keeps an entry
alive as long as it keeps being read, so a key under constant load is never refreshed — the
staleness bound you documented silently does not apply to your busiest data, which is the data
most people are looking at. Time-to-idle is right when the TTL is there to reclaim memory from
things nobody wants any more, and wrong when it is there to guarantee that nothing is more than
ten minutes out of date.

**★ Two caches, same TTL, and every hour the database sees a spike. What is happening?**
Synchronised expiry. Entries written during the same window expire during the same window, and
after a deploy that window is the warm-up — so an hour later the entire warm-up's worth of keys
dies together and every request for them misses at once. Nothing in the Spring or Redis
configuration jitters expiry for you. The fix is a `TtlFunction` that adds a small random or
key-derived offset to the base duration, so the same population of keys expires spread over a
window instead of at a point.

{/* FOOTER */}
