---
title: "12 · Caching"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-know">Know</span>

> Verified: see each chunk's own `> Verified:` line.

**Caching as a decision rather than a technique: what Spring's cache abstraction actually
does, what Hibernate's second-level cache actually caches, and the bill that arrives with
both — invalidation, staleness, a wire format, a failure domain and a memory budget that
none of the annotations mention.**

:::tip Complete — 35 chunks
Five parts. **The decision and the abstraction** (naming the trade before you type
`@Cacheable`, what the annotations do, the proxy rule that makes self-invocation silent, the
write half, and what happens to reactive return types). **Keys** — the default generator and
what it deliberately omits, writing SpEL yourself, the dimension missing from the key that
produces a confident wrong answer, and the key that never repeats. **The store** — `condition`
versus `unless` and caching a `null`, Redis as a shared cache, serialization as the hard part,
JSON and the Jackson 3 rename, expiry, TTLs, clearing and locking, what happens when the store
is down, and the four ways to change a default that each disable something else. **Hibernate**
— what the second-level cache caches and what it does not, the query cache and why it stays
off, cache modes, mapping and concurrency strategies, and how it is actually enabled in 6 and
7. **Invalidation and the decision to say no** — the gap between the evict and the commit,
caching in a cluster, getting the eviction right, the entries nobody wrote an evict for, the
writes the cache never sees at all, and what Hibernate never sees. It closes on the argument
the topic exists for: a cache in front of a fixable query buys latency with correctness — with
the cases where a cache is the wrong risk, what to measure before and after, and a two-part
review checklist.
:::

Boundaries this topic keeps: **08** owns N+1 and every fix for it — including the argument
that the second-level cache is *not* an N+1 fix — **06** owns the persistence context and
entity states, **07** owns mappings and fetch types, **04** owns the `@Transactional` proxy and
after-commit behaviour, **11** owns migrations, and the Redis section of this bible owns Redis
itself. This topic owns the Java boundary and links to the rest rather than re-arguing it.

{/* CHUNKS */}

| # | Chunk | What it argues |
|---|---|---|
| 1 | **[1 · Caching is a decision](01-caching-is-a-decision.md)** | A cache is a second copy of your data with a consistency model you now own, so the decision to add one is a decision… |
| 2 | **[2 · The cache abstraction](02-the-cache-abstraction.md)** | Spring's cache abstraction caches method return values against a key, and everything that goes wrong with it goes… |
| 3 | **[2b · The proxy, again](02b-the-proxy-again.md)** | @Cacheable is proxy-based advice, so a method calling another method of its own class caches nothing at all — the… |
| 4 | **[2c · Put, evict and the rest](02c-put-evict-and-the-rest.md)** | @CachePut and @CacheEvict are the write half of the abstraction, and both fail the same way — by operating on a key… |
| 5 | **[2d · Futures and reactive returns](02d-futures-and-reactive-returns.md)** | The cache annotations understand CompletableFuture, Mono and Flux — and the Flux case buffers your entire stream into… |
| 6 | **[3 · Keys](03-keys.md)** | The cache entry is identified by a key you probably did not write, and the default generator deliberately leaves out… |
| 7 | **[3b · Writing the key yourself](03b-writing-the-key-yourself.md)** | Writing the key yourself means writing SpEL, which is an unchecked string in an annotation — so the question is not… |
| 8 | **[3c · Keys that silently vary](03c-keys-that-silently-vary.md)** | The key covers the arguments, so every input to the answer that is not an argument is a dimension missing from the… |
| 9 | **[3d · The key that never repeats](03d-the-key-that-never-repeats.md)** | A key that carries more than the answer depends on never repeats, which turns the cache into a write-only store — and… |
| 10 | **[4 · Condition, unless and null](04-null-and-sync.md)** | condition runs before the method and switches the whole cache off, unless runs after and only vetoes the write — and… |
| 11 | **[5 · Redis as the store](05-redis-as-the-store.md)** | Moving the cache to Redis makes it shared, and in exchange the cache becomes a network hop and a separate failure… |
| 12 | **[5b · Serialization is the hard part](05b-serialization-is-the-hard-part.md)** | The moment a cached object leaves the heap it acquires a wire format, and the shipped default is JDK serialization —… |
| 13 | **[5b2 · JSON, and the Jackson 3 rename](05b2-json-and-the-jackson-3-rename.md)** | Moving the cache to JSON removes the field-shape incident and keeps the class-name one, and on Spring Boot 4 the… |
| 14 | **[5c · Expiry and eviction](05c-expiry-and-eviction.md)** | Spring writes cache entries that never expire into a server whose default policy is to reject new writes rather than… |
| 15 | **[5c2 · Choosing and applying a TTL](05c2-choosing-and-applying-a-ttl.md)** | A TTL is the only bound on a cache that survives a code change, and it is not invalidation — it decides how long a… |
| 16 | **[5d · Clearing, locking and failing](05d-clearing-locking-and-failing.md)** | The last three rows of the Redis cache defaults decide what a bulk evict costs the whole server, whether sync = true… |
| 17 | **[5d2 · When the cache is down](05d2-when-the-cache-is-down.md)** | The default cache error handler rethrows, so an unreachable Redis makes every cached method fail rather than miss —… |
| 18 | **[5e · Changing the defaults safely](05e-changing-the-defaults-safely.md)** | There are four places to change how the cache is configured and three of them silently disable something else, so the… |
| 19 | **[6 · The second-level cache](06-hibernate-second-level.md)** | Hibernate's second-level cache is a cache of rows by identifier, not a cache of queries — so it can eliminate the… |
| 20 | **[6b · The query cache](06b-the-query-cache.md)** | The query cache is off by default because Hibernate must track every commit against every table a cached query… |
| 21 | **[6b2 · Cache modes, and when it is right](06b2-cache-modes-and-when-its-right.md)** | Hibernate has the force-refresh primitive that Spring's cache abstraction lacks, and four conditions that between… |
| 22 | **[6c · Mapping and strategies](06c-mapping-and-strategies.md)** | Marking an entity cacheable takes two annotations from two packages, and the second one asks you to pick a… |
| 23 | **[6d · Turning it on](06d-turning-it-on.md)** | In Hibernate 6 and 7 the second-level cache is enabled by configuring a region factory rather than by setting a… |
| 24 | **[7 · Invalidation and the transaction](07-invalidation.md)** | @CacheEvict fires when the method returns and the transaction commits some time afterwards, so between those two… |
| 25 | **[7b · Caching in a cluster](07b-caching-in-a-cluster.md)** | With a local cache and three pods you have three caches, and an eviction on the pod that handled the write is… |
| 26 | **[7c · Getting the eviction right](07c-getting-the-eviction-right.md)** | By default an exception in the method skips the eviction entirely, so the safest write path evicts before the work,… |
| 27 | **[7d · The invalidation you forgot](07d-the-invalidation-you-forgot.md)** | Every @CacheEvict in the codebase names a key somebody was thinking about, so the entries that go stale are the ones… |
| 28 | **[7e · The writes the cache never sees](07e-the-writes-the-cache-never-sees.md)** | The cache abstraction is advice on your methods, so a bulk UPDATE, a migration or another program changes the rows… |
| 29 | **[7f · What Hibernate never sees](07f-what-hibernate-never-sees.md)** | Hibernate's documentation says outright that the second-level cache is never aware of changes made externally to… |
| 30 | **[8 · When not to cache](08-when-not-to-cache.md)** | A cache in front of a query that needs an index does not make the query faster — it makes it rarer, and it removes… |
| 31 | **[8b · When the cache is the wrong risk](08b-when-the-cache-is-the-wrong-risk.md)** | The other half of the case against caching has nothing to do with speed: some data is wrong rather than late when it… |
| 32 | **[8c · What to measure first](08c-what-to-measure-first.md)** | Five numbers decide whether a cache is the right change, none of them is the hit rate, and Spring Boot's automatic… |
| 33 | **[8d · What to watch once it is live](08d-what-to-watch-once-it-is-live.md)** | Once a cache is running, every meter you have describes the cache and none of them describes the thing you traded… |
| 34 | **[9 · The checklist](09-the-checklist.md)** | A pull request that adds @Cacheable is three lines long and changes the consistency model of your application, so… |
| 35 | **[9b · The store and the invalidation](09b-the-store-and-the-invalidation.md)** | The second half of a caching review is everything the annotation does not mention — which store you are actually on,… |

{/* FOOTER */}
