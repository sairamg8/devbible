---
title: "A key that carries more than the answer depends on never repeats, which turns the cache into a write-only store — and the two default configurations, a `ConcurrentHashMap` and a Redis with no TTL, both let it grow until something dies"
sidebar_label: "3d · The key that never repeats"
sidebar_position: 9
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the Spring Framework 7.0 reference *Cache Abstraction →
> Configuring the Cache Storage* (the `ConcurrentMap`-based store)
> ([docs.spring.io/spring-framework/reference/integration/cache/store-configuration.html](https://docs.spring.io/spring-framework/reference/integration/cache/store-configuration.html)),
> the Spring Boot 4.1 reference *Caching*
> ([docs.spring.io/spring-boot/reference/io/caching.html](https://docs.spring.io/spring-boot/reference/io/caching.html)),
> the Spring Data Redis reference *Redis Cache*
> ([docs.spring.io/spring-data/redis/reference/redis/redis-cache.html](https://docs.spring.io/spring-data/redis/reference/redis/redis-cache.html))
> and the `RedisCache` javadoc
> ([docs.spring.io/spring-data/redis/docs/current/api/org/springframework/data/redis/cache/RedisCache.html](https://docs.spring.io/spring-data/redis/docs/current/api/org/springframework/data/redis/cache/RedisCache.html)).
> JDK 25, Spring Boot 4.1.0, Spring Framework 7.0.8, Spring Data Redis 4.1.

**[3c](03c-keys-that-silently-vary.md) was about a key that carries too little and therefore
serves the wrong answer. This is the mirror image: a key that carries too much never matches
anything, so every call is a miss and every miss writes an entry nobody will read. It does not
serve wrong data, which is why it survives review — it just consumes memory forever while
looking, in the dashboard, like a cache with a disappointing hit rate.**

## A cache that never hits is not a slow cache

It is worth naming the failure precisely, because "the hit rate is low" is heard as a tuning
problem and this is not one. If a key never repeats:

- every call runs the method *and* pays the interceptor, the key computation and the write;
- every call adds an entry;
- nothing is ever read back;
- nothing removes anything, unless something else is configured to.

So the feature costs latency on every request and memory without limit, and delivers nothing.
The only thing that ever ends it is an eviction policy, a TTL, or an outage.

## The arguments that never repeat

### A request, context or "options" object

```java
@Cacheable("reports")
public Report build(ReportRequest request) { … }
```

Innocuous, until you look at `ReportRequest`. If it carries a correlation id, a submission
timestamp, a `Principal`, a `Locale` object, or a freshly built list, then two logically
identical requests are two different keys. This is the most common form by far, because the
parameter object is a good design everywhere except here.

### A lambda or a method reference

Their equality is identity, and each evaluation of a lambda expression may produce a new
instance. A key containing one is a key that never repeats. The same goes for a `Comparator`, a
`Supplier` default, or a callback passed for error handling.

### A `Clock`, an `Instant`, or anything derived from the wall clock

If it is precise enough to be useful it is precise enough to be unique.

### A collection whose equality depends on order

`Set.equals` is order-independent, so a `Set<String>` of SKUs is a perfectly stable key. A
`List<String>` built by iterating a `HashSet` is not — the iteration order is unspecified, so the
same logical input can produce different lists in the same JVM after a rehash, and reliably
different ones across JVMs. If a collection is going to be a key, make it a `Set`, or sort it.

### A DTO without `equals`

A hand-written parameter class that never got `equals` and `hashCode` behaves exactly like the
entity in [3 · Keys](03-keys.md): identity comparison, zero hits. A `record` gets both
generated, which is one more reason for key-carrying parameter types to be records.

### A `Pageable` or `Sort` assembled inconsistently

`PageRequest` implements `equals` properly, so this one is only a problem when the *inputs*
differ: a `Sort` built from a map iteration, a default sort appended in one code path and not
another, a page size taken from a config value that differs per instance.

### Anything with a cache-buster in it

A query-parameter map that includes `_t=1724650000` or a client-generated request id. The
client added it to defeat a browser cache and it defeats yours too, one level down.

## The key has a size, and a remote store charges you for it

On a local `ConcurrentHashMap` the key is a reference and a hash. On Redis it is a byte string
that travels over the network on every read and every write, and it is stored alongside every
value.

Spring Data Redis's defaults make this concrete: the key serializer is `StringRedisSerializer`,
the conversion service is a `DefaultFormattingConversionService` "with default cache key
converters", and

> *"By default, any `key` for a cache entry gets prefixed with the actual cache name followed by
> two colons (`::`)."*

So the stored key is `cacheName::<the key rendered as a String>`. A key built from a large
object renders large, and you pay for it on every single lookup, forever.

🔴 **And a key that cannot be rendered fails only on the remote store.** `RedisCache.convertKey`
is documented to throw:

> *"Throws `IllegalStateException` — if `key` cannot be converted to a `String`."*

That is the shape of a genuinely nasty bug: a custom key type works perfectly against the
`ConcurrentHashMap` the tests use, because a map will accept any object as a key, and throws the
first time the same code runs against Redis. The fix is to register a converter on the cache
configuration's conversion service, or — better — to use a key type that is obviously a string
or a number in the first place.

## Nothing bounds a cache by default. Not on either end.

This is the part worth internalising, because both defaults are permissive.

**The local default has no eviction.** Spring's own documentation on the `ConcurrentMap`-based
store says it "does not provide any management, persistence capabilities, or eviction
contracts", and Boot falls back to exactly that provider when no caching library is on the
classpath:

> *"If none of the other providers can be found, a simple implementation using a
> `ConcurrentHashMap` as the cache store is configured. This is the default if no caching
> library is present in your application."*

**The remote default has no expiry.** Spring Data Redis's defaults table gives Key Expiration
as *None*, and Boot's `spring.cache.redis.time-to-live` is unset unless you set it — the entries
never expire on their own.

So an unbounded key space plus either default is unbounded growth. **Every cache needs at least
one of three things, chosen deliberately: a bounded key space, an eviction policy with a
maximum size, or a TTL.** A cache with none of the three is not configured, it is merely
enabled. Caffeine gives you the second — `spring.cache.caffeine.spec=maximumSize=10000` — and
Redis gives you the third; the local default gives you neither, which is the single strongest
argument against shipping on it.

## Name the cache after its key

A convention that costs nothing and prevents most of both [3c](03c-keys-that-silently-vary.md)
and this page: **the cache name states what the key is.** `prices-by-sku`,
`dashboard-by-user`, `orders-by-customer-and-tenant`.

Then the annotation reviews itself. A reader can see at a glance whether the key expression
matches the name; a method whose answer also depends on the locale cannot be added to
`prices-by-sku` without somebody noticing the name has become a lie; and the shared-cache-name
collision from [3 · Keys](03-keys.md) becomes unnatural, because a name that describes one key
does not get casually reused for a different one.

## The three questions to ask of any `@Cacheable`

1. **What does this answer depend on, and is all of it in the key?** Principal, tenant, locale,
   clock, feature flag, session filter.
2. **Is the key space bounded, and does it repeat?** If the key contains a timestamp, a
   correlation id, a lambda or an unsorted list, it does not.
3. **What removes an entry — an eviction, a size limit, or a TTL?** If the answer is "nothing",
   the cache grows forever and never refreshes.

None of the three requires running the code, which is why they belong in review rather than in
an incident.

## Gotchas

**★ A cache with a near-zero hit rate is not underperforming, it is broken.** Something in the
key never repeats, and every call is paying for a write nobody will read.

**★ A parameter object is a good design that makes a bad key.** The correlation id, timestamp
or principal it carries for perfectly sound reasons is what makes every key unique.

**★ Lambdas, method references and comparators as arguments guarantee a miss.** Their equality
is identity and a fresh instance may be created per call.

**★ A `List` built from a `HashSet` is not a stable key.** Iteration order is unspecified, so
the same logical input can render differently in the same JVM and reliably differs across JVMs.

**★ A `Set` *is* a stable key**, because `Set.equals` ignores order. Converting an unordered
collection argument to a `Set` — or sorting it — is usually the whole fix.

**★ A hand-written DTO without `equals` is the entity problem wearing a different name.** Use a
`record` for anything that will be part of a key.

**★ A custom key type can work in tests and throw in production.** A `ConcurrentHashMap` accepts
any object as a key; `RedisCache.convertKey` throws `IllegalStateException` when it cannot render
one as a `String`.

**★ Key size is a per-lookup network and memory cost on a remote store**, and it is paid on
misses too. A key built from a large object is a permanent tax.

**★ The stored Redis key is `cacheName::key` by default**, so long cache names are also key
size. Boot's documentation strongly recommends keeping the prefix enabled, so shorten the name
rather than disabling it.

**★ Boot's fallback provider has no eviction contract at all.** The documentation says so
outright, and it is the provider you get by doing nothing.

**★ Spring Boot's Redis TTL is unset by default and Spring Data Redis's default Key Expiration
is None.** Nothing expires unless you configure it.

**★ A cache-busting parameter forwarded from the client defeats your cache too.** It was added
to defeat a different one.

**★ "We will add a size limit later" is how a heap dump happens.** The limit is one property on
Caffeine and one property for a Redis TTL; there is no version of "later" that is cheaper than
now.

## Interview questions

**★ A cache's hit rate is flat and its memory keeps growing. What is your first guess?**
That the key includes something that never repeats. Usually a request or context object passed
as a parameter, carrying a correlation id or a timestamp; sometimes a lambda, whose equality is
identity; sometimes a list built from an unordered collection. Every call writes an entry
nothing will ever read. With Boot's fallback provider there is no eviction contract, and with
Redis there is no TTL by default, so nothing degrades gracefully before memory runs out.

**★ Why is a low hit rate worse than no cache at all?**
Because you are paying every cost and collecting no benefit. The interceptor runs, the key is
computed, the value is serialized and written — on a remote store, over the network — and the
method still executes. Then the entry occupies memory for as long as the configuration allows.
A cache that never hits is strictly worse than the uncached method on latency, on memory, and on
the number of things that can fail.

**★ How can a key work in tests and throw in production?**
The test almost certainly runs against Boot's fallback `ConcurrentHashMap` provider, which will
use any object at all as a map key. Production runs against Redis, where the key has to be
rendered as a `String` — `RedisCache.convertKey` is documented to throw `IllegalStateException`
if it cannot. So a custom key class with no registered converter passes every test and fails on
the first request. It is a good argument for running at least one integration test against the
real cache provider, and a better argument for keeping key types boring.

**★ Is a `Set` a safe cache key? Is a `List`?**
A `Set` is, because its `equals` is order-independent, so the same members always produce the
same key. A `List` is only safe if the order is deterministic — and a list produced by iterating
a `HashSet` is not, which is a surprisingly common way to build one. If I have a collection
argument that is logically unordered, I would make it a `Set` or sort it before it reaches the
key, and I would not rely on the caller having done so.

**★ What is the minimum configuration you would accept on a new cache?**
At least one bound, chosen on purpose. Either the key space is genuinely small and closed — a
handful of configuration keys, a fixed set of currencies — or there is a maximum size, or there
is a TTL. Both defaults in the common Boot setup give you none: the fallback provider has no
eviction contract, and Redis entries never expire unless a time-to-live is configured. So doing
nothing is not a neutral choice, it is a choice to grow without limit.

**★ Does key size matter?**
On a local map, barely — it is a reference and a hash. On Redis it matters on every operation:
the key is serialized to a string, prefixed with the cache name and two colons, sent over the
network on reads and writes alike, and stored next to every value. A key built by rendering a
large parameter object is a cost paid on misses as well as hits, indefinitely. It is one of the
better reasons to pass an identifier rather than an object.

**★ Would you ever disable the Redis key prefix to save space?**
No. Boot's documentation says a prefix is added "so that, if two separate caches use the same
key, Redis does not have overlapping keys and cannot return invalid values", and recommends
keeping it enabled. Turning it off to save bytes trades a bounded, predictable overhead for the
possibility of two caches silently sharing entries — which is the collision from
[3 · Keys](03-keys.md) again, at the storage layer. If the prefix is genuinely too large, the
answer is a shorter cache name.

**★ How do you review a `@Cacheable` in a pull request without running anything?**
Three questions. What does the answer depend on, and is all of it in the key — including the
principal, the tenant, the locale and the clock. Does the key repeat, or does it contain
something unique per call. And what removes an entry: an evict, a size limit, or a TTL. If the
answer to any of them is "nothing", the annotation is not finished. All three are answerable by
reading the method signature and the cache configuration, which is the point.

**★ Someone argues the growth is fine because the pod restarts every day. Do you accept it?**
Not as a design, though I would accept it as a temporary state with an issue attached. A cache
whose only bound is the deployment cadence is one long weekend, one paused rollout or one
traffic pattern away from an out-of-memory error, and the failure lands during whatever is
keeping the pod alive longer than usual — which is rarely a quiet period. It also means a
restart is doing invisible work that nobody has attributed to the cache, so when it does break,
the cause will look like something else.

{/* FOOTER */}
