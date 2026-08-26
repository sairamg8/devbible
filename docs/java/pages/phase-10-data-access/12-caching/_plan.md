# Topic 12 · Caching — chunk plan

Tier: **Know**. Target: Spring Framework 7.0.8, Spring Boot 4.1.0, Hibernate ORM 7.4.1,
Redis 8.x, JDK 25.

## Boundary

- **12 owns** — caching as a decision: Spring's cache abstraction, Hibernate's
  second-level cache and query cache, and invalidation.
- 🔴 **08 owns N+1 and already argues the second-level cache is not an N+1 fix.** 12 gives
  the cache its own honest treatment and links back rather than contradicting it.
- The Redis section of this bible owns Redis itself; 12 owns the Java boundary.

## Chunks (a PLAN, not a budget — split at 301 lines, rule 1)

| # | File | What it argues |
|---|---|---|
| 1 | `01-caching-is-a-decision.md` | You are trading correctness for latency; name the trade |
| 2 | `02-the-cache-abstraction.md` | `@EnableCaching`, `@Cacheable`, `@CachePut`, `@CacheEvict` |
| 2b | `02b-the-proxy-again.md` | Self-invocation defeats `@Cacheable` for the same reason it defeats `@Transactional` — link to topic 04 |
| 3 | `03-keys.md` | The default key generator, SpEL keys, and the key that collides |
| 4 | `04-null-and-sync.md` | Caching a null, `unless`, `sync = true` and the stampede |
| 5 | `05-redis-as-the-store.md` | `RedisCacheManager`, serialization, TTL per cache |
| 5b | `05b-serialization-is-the-hard-part.md` | JDK serialization vs JSON; the class that changed shape |
| 6 | `06-hibernate-second-level.md` | What it caches, what it does not, `@Cache` and the region factory |
| 6b | `06b-the-query-cache.md` | Why it is off by default and usually stays off |
| 7 | `07-invalidation.md` | The two hard problems, and why the second one is this |
| 7b | `07b-caching-in-a-cluster.md` | Two pods, two caches, one stale answer |
| 8 | `08-when-not-to-cache.md` | The query you should have indexed |
| 9 | `09-the-checklist.md` | Before you add `@Cacheable` |

## Traps to verify, not assume

- ⚠️ **Hibernate 6/7 changed the second-level cache configuration** (region factory,
  provider artifacts). Verify against the 7.4 user guide; do not repeat Hibernate 5 setup.
- ⚠️ Boot's `spring.cache.type` and the auto-configured `CacheManager` fallback (`simple`)
  — a misconfigured app silently caches in a `ConcurrentHashMap` per pod.
- 🔴 No console blocks: no hit-rate numbers, no latency figures.
