---
title: "Spring writes cache entries that never expire into a server whose default policy is to reject new writes rather than evict, so the two shipped defaults compose into an outage that takes down every client of that Redis instance"
sidebar_label: "5c · Expiry and eviction"
sidebar_position: 14
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the Spring Data Redis 4.1 reference *Redis Cache*
> ([docs.spring.io/spring-data/redis/reference/redis/redis-cache.html](https://docs.spring.io/spring-data/redis/reference/redis/redis-cache.html)),
> Boot 4.1.x `CacheProperties`
> ([github.com/spring-projects/spring-boot](https://github.com/spring-projects/spring-boot/blob/4.1.x/module/spring-boot-cache/src/main/java/org/springframework/boot/cache/autoconfigure/CacheProperties.java)),
> Redis *Key eviction* ([redis.io/docs](https://redis.io/docs/latest/develop/reference/eviction/))
> and `redis.conf` on the Redis 8.0 branch
> ([github.com/redis/redis](https://github.com/redis/redis/blob/8.0/redis.conf)).
> JDK 25, Spring Boot 4.1.0, Spring Data Redis 4.1, Redis 8.

**Two defaults, each defensible alone. Spring Data Redis ships `Key Expiration: None`, because
it cannot know whether your key space is bounded. Redis ships `maxmemory-policy noeviction`,
because it cannot know whether your keys are disposable. Put a Spring cache on a stock Redis and
you have a keyspace that grows forever behind a server that refuses to make room — and the
failure lands on every application sharing that instance, not just the one with the cache.**

## Nothing on the Spring side bounds the cache

The reference's defaults table begins with the row that matters:

| Setting | Value |
|---|---|
| Key Expiration | None |

and Boot's `CacheProperties.Redis` says it again on the field itself:

```java
/**
 * Entry expiration. By default the entries never expire.
 */
private @Nullable Duration timeToLive;
```

An entry written by `@Cacheable` stays in Redis until something deletes it. Nothing does. There
is no maximum size, no LRU list and no background sweeper anywhere in the Spring half of this
stack — unlike a `ConcurrentHashMap` cache, which at least dies with the pod.

⚠️ Note that this is *the same* absence you have locally. The framework's own `ConcurrentMap`
store *"does not provide any management, persistence capabilities, or eviction contracts"*. The
difference is that a local unbounded cache is bounded in practice by the process lifetime and
kills only itself, while a shared unbounded cache accumulates across every deploy of every pod
and takes its neighbours with it.

## Nothing on the Redis side bounds it either

From `redis.conf` on the Redis 8.0 branch:

```
# The default is:
#
# maxmemory-policy noeviction
```

and from the eviction reference:

> *"`noeviction`: Keys are not evicted but the server will return an error when you try to
> execute commands that cache new data. If your database uses replication then this condition
> only applies to the primary database. Note that commands that only read existing data still
> work as normal."*

`redis.conf` restates it for every policy once nothing is eligible:

> *"Note: with any of the above policies, when there are no suitable keys for eviction, Redis
> will return an error on write operations that require more memory. These are usually commands
> that create new keys, add data or modify existing keys. A few examples are: SET, INCR, HSET,
> LPUSH, SUNIONSTORE, SORT (due to the STORE argument), and EXEC."*

**Compose the two defaults and you get the shape of the outage.** Entries never expire, so the
keyspace grows monotonically. `maxmemory` is reached. The policy is `noeviction`, so Redis
begins rejecting writes — not just cache writes, *every* write from every application on that
instance, including the session store and the rate limiter someone else put there. Reads keep
working, which is why the first symptom is a partial and confusing failure rather than an
obvious one: logins fail while pages render, and the cache that caused it looks healthy because
its hit rate is excellent.

⚠️ And the trap inside the trap: *"The `volatile-xxx` policies behave like `noeviction` if no
keys have an associated expiration."* Setting `volatile-lru` on a Spring cache that kept
`Key Expiration: None` buys you exactly nothing. It is `noeviction` wearing a hat.

## Set both. They are independent controls.

**On the Redis side**, a ceiling plus a policy that degrades into evictions:

```
maxmemory 4gb
maxmemory-policy allkeys-lru
```

The reference's own rule of thumb:

> *"Use `allkeys-lru` when you expect that a subset of elements will be accessed far more often
> than the rest. This is a very common case according to the Pareto principle, so `allkeys-lru`
> is a good default option if you have no reason to prefer any others."*

It also notes the reason to prefer `allkeys-*` over `volatile-*` even when you do set TTLs:
*"setting an `expire` value for a key costs memory, so a policy like `allkeys-lru` is more
memory efficient since it doesn't need an `expire` value to operate."* And if you are
co-tenanting a cache with data that must not disappear: *"The `volatile-lru`, `volatile-lrm`,
and `volatile-random` policies are mainly useful when you want to use a single Redis instance
for both caching and for a set of persistent keys. However, you should consider running two
separate Redis instances in a case like this, if possible."* Take the second sentence
seriously — a cache and a session store on one instance means an eviction policy tuned for one
of them is wrong for the other.

⚠️ Also from the reference, and easy to miss when sizing: if you use replication or persistence,
the replication/AOF buffer *"is not included in the total that is compared to `maxmemory`"*, so
`maxmemory` must leave RAM free rather than equal the box.

**On the Spring side**, a TTL. The blunt version is one property:

```yaml
spring:
  cache:
    type: redis
    redis:
      time-to-live: 10m
```

which is a single TTL for every cache in the application — almost never right, because a
currency-rate cache and a country-list cache do not have the same tolerance for staleness.
Applying a TTL per cache, and deciding what the number should be, is
[5c2 · Choosing and applying a TTL](05c2-choosing-and-applying-a-ttl.md).

## Which policy, and how exact it is not

The full list from the reference — `noeviction`, `allkeys-lru`, `allkeys-lrm`, `allkeys-lfu`,
`allkeys-random`, `volatile-lru`, `volatile-lrm`, `volatile-lfu`, `volatile-random`,
`volatile-ttl` — is longer than the three people remember, and the differences are real:

- **`allkeys-lru`** is the default recommendation. *"Use `allkeys-random` when you expect all
  keys to be accessed with roughly equal frequency. An example of this is when your app reads
  data items in a repeating cycle."* — that is the shape where LRU is actively counterproductive,
  because a cyclic scan evicts precisely the item you are about to ask for.
- **`allkeys-lfu`** tracks frequency rather than recency, with *"a probabilistic counter, called
  a Morris counter"* and a decay period, tuned by `lfu-log-factor` and `lfu-decay-time`. By
  default Redis is configured to *"Saturate the counter at, around, one million requests"* and
  *"Decay the counter every one minute."* LFU is the better fit when a small set of keys is hot
  for a long time and a burst of cold traffic would otherwise flush them.
- **`allkeys-lrm`** — least recently *modified* — exists from Redis 8.6: *"LRM is similar to LRU
  but only updates the timestamp on write operations, not read operations."* Useful when you want
  to keep data that is being written and discard data that is only being read, which is an
  unusual want for a cache and a common one for a working set.
- **`volatile-ttl`** *"Evict keys with an associated expiration (TTL) that have the shortest
  remaining TTL value"* — sensible only if you have deliberately assigned meaningfully different
  TTLs, which per-cache configuration makes possible.

🔴 **None of these is exact.** *"The Redis LRU algorithm uses an approximation of the least
recently used keys rather than calculating them exactly. It samples a small number of keys at
random and then evicts the ones with the longest time since last access."* The sample size is
`maxmemory-samples`, and the reference is explicit that *"the approximation is virtually
equivalent for an application using Redis"* while noting *"you can raise the sample size to 10 at
the cost of some additional CPU usage to closely approximate true LRU"*. So an entry you would
expect LRU to keep can be evicted anyway. **Never build correctness on the assumption that a key
which was read recently is still there.** A cache is allowed to forget anything at any time —
that is the definition — and an approximate eviction policy is a reminder that it means it.

## How you find out it is happening

The reference names the fields, and they are the ones to put on a dashboard before you need them:

- `INFO stats` → `keyspace_hits` and `keyspace_misses`, with the ratio
  `keyspace_hits / (keyspace_hits + keyspace_misses) * 100`. Note the caveat: *"When the `EXISTS`
  command reports that a key is absent then this is counted as a keyspace miss."*
- `INFO stats` → `evicted_keys`. *"A high proportion of evictions would suggest that the wrong
  keys are being evicted too often by your chosen policy."*
- `INFO stats` → `expired_keys`. *"If this number is high, you might be using a TTL that is too
  low or you are choosing the wrong keys to expire and this is causing keys to disappear from the
  cache before they should."*
- `INFO stats` → `current_eviction_exceeded_time`, *"The time since the cache last started to
  exceed `maxmemory`."*
- `INFO memory` → `used_memory_dataset` and `mem_not_counted_for_evict`, the second being the
  buffer memory excluded from the `maxmemory` comparison.
- `INFO commandstats` → *"this reports the number of times each command issued to the server has
  been rejected. If you are using `noeviction` or one of the `volatile_xxx` policies, you can use
  this to find which commands are being stopped by the `maxmemory` limit and how often it is
  happening."*

That last one is the direct answer to "is `noeviction` currently breaking us?", and it is the
field nobody looks at because the failure presents as unrelated services misbehaving.

On the Spring side the equivalent is `spring.cache.redis.enable-statistics`, which defaults to
`false`; with it on, `RedisCacheManager` exposes per-cache hit/miss/put counts through
`CacheStatistics`. Turning it on per cache is what tells you *which* cache is worth its memory —
the Redis-level ratio aggregates every cache and every non-cache client together, so it can look
excellent while one specific cache never gets a hit.

## Gotchas

**★ The Spring default is no expiry and the Redis default is no eviction.** Individually
defensible, jointly an outage. Set a TTL *and* a `maxmemory` policy; neither substitutes for the
other.

**★ The outage hits every client of the Redis instance, not just your cache.** `noeviction`
rejects writes globally while reads keep succeeding, so the symptom set is scattered across
services that have nothing to do with caching.

**★ `volatile-*` policies are `noeviction` if nothing has a TTL.** Documented verbatim. This is
the specific way a team that "already set an eviction policy" still fills the instance.

**★ `maxmemory` does not account for replication and AOF buffers.** The reference excludes them
from the total deliberately, so `maxmemory` set to the size of the box will still OOM.

**★ Co-tenanting a cache with persistent keys forces one eviction policy onto two workloads.**
The Redis reference explicitly suggests two instances instead. A session store evicted by
`allkeys-lru` logs people out.

**★ LRU in Redis is approximate.** It samples `maxmemory-samples` keys at random rather than
maintaining a true recency order, so a recently-read key can still be evicted. Any code that
assumes "I wrote it a moment ago, so it is there" is wrong on a cache and doubly wrong on this
one.

**★ `allkeys-lru` is the wrong policy for a cyclic access pattern.** The reference names
`allkeys-random` for the case where everything is read with roughly equal frequency in a
repeating cycle — LRU evicts exactly the entry the cycle is about to reach.

**★ `enable-statistics` is off by default**, so you have no per-cache hit rate until you turn it
on. The Redis-level `keyspace_hits` ratio aggregates every cache and every other client, and can
look healthy while one specific cache never hits.

**★ `EXISTS` returning absent counts as a keyspace miss.** Documented, and it means anything else
probing that Redis skews the hit ratio you are using to judge your cache.

**★ A high `expired_keys` count is a signal, not just a statistic.** The reference reads it as
"your TTL is too low or you are expiring the wrong keys" — that is, entries are dying before
they earn their keep, which is the cache paying full price for nothing.

**★ Nobody watches `commandstats` rejections.** It is the field that says `noeviction` is
actively rejecting writes right now, and it is the one nobody has on a dashboard because the
symptoms show up in other people's services.

## Interview questions

**★ What happens to a Spring Redis cache that has no TTL?**
It grows until Redis hits `maxmemory`, and then the interesting part starts. Redis's default
policy is `noeviction`, which does not evict anything — it returns an error on any command that
needs more memory. Reads keep working, so the instance looks alive; writes fail everywhere,
including for every other application sharing that Redis. The cache itself will appear healthy
in metrics because its hit rate is fine. That is why I treat the TTL and the `maxmemory` policy
as one decision made twice: Spring's default is no expiry, Redis's is no eviction, and each is
reasonable in isolation only because it assumes the other side handles it.

**★ You set `maxmemory-policy volatile-lru` and the instance still filled up. Why?**
Because `volatile-*` only considers keys that have an expiry set, and the Spring cache's default
is `Key Expiration: None`, so no key was a candidate. The Redis reference states it directly:
the volatile policies behave like `noeviction` if no keys have an associated expiration. Either
set TTLs on the Spring side so the policy has something to work with, or use `allkeys-lru` —
which the same reference recommends as the sensible default, and which is also more
memory-efficient because it does not need an expire value per key.

**★ How would you choose between `allkeys-lru` and `allkeys-lfu`?**
By what the access pattern looks like over time rather than over the last few seconds. LRU keeps
what was touched most recently, so a burst of one-off traffic — a crawler, a report walking an
id range, a batch job — can flush a hot set that will be wanted again in a minute. LFU tracks
frequency with a decaying probabilistic counter, so a genuinely hot key survives a burst of cold
ones, which is usually what a cache in front of a database wants. LRU is the reference's default
recommendation and the right first choice; I would move to LFU when I could see hot keys being
evicted by traffic that never comes back, which `evicted_keys` combined with a falling hit ratio
will show. And for a workload that reads everything in a repeating cycle, both are wrong and
`allkeys-random` is the documented answer.

**★ Can you rely on a key still being in the cache because you just read it?**
No, and the eviction implementation makes the point vividly. Redis's LRU is approximate — it
samples a handful of keys at random and evicts the least recently used among them rather than
maintaining a true ordering — so a key read a moment ago can be chosen. On top of that, a cache
may evict for reasons that have nothing to do with your key at all: memory pressure from another
application on the same instance, a `FLUSHDB` during an incident, a failover to a replica that
never had the entry. Any code whose correctness depends on a cache hit is not using a cache, it
is using a database with no durability guarantees, and it will fail in a way that is very hard
to reproduce.

**★ Which metrics tell you a cache is actually earning its place?**
Redis's `keyspace_hits` and `keyspace_misses` give the instance-wide ratio, and that is the
number people quote — but it aggregates every cache and every other client on the box, so it can
be excellent while a specific cache is useless. For the per-cache view I would turn on
`spring.cache.redis.enable-statistics`, which is off by default, and look at hits, misses and
puts per cache name: a cache whose puts roughly equal its misses and whose hits are near zero is
pure cost. Alongside those I want `evicted_keys` and `expired_keys`, because they distinguish
"my working set does not fit" from "my TTL is shorter than the interval between reads", and
`commandstats` rejections, because that is the field that says `noeviction` is currently
breaking writes.

{/* FOOTER */}
