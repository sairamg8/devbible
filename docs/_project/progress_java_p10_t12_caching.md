---
name: progress-java-p10-t12-caching
description: Java Phase 10 · Topic 12 · Caching — fork progress
metadata:
  type: progress
---

# Java Phase 10 · Topic 12 · Caching — fork progress

**Scope (mine alone):** `docs/java/pages/phase-10-data-access/12-caching/`
**Tier:** Know (`<span className="db-tier t-know">Know</span>` on every chunk)
**Started:** 2026-08-26
**Versions:** JDK 25 · Spring Boot 4.1.0 · Spring Framework 7.0.8 · Hibernate ORM 7.4.1 ·
Jakarta Persistence 3.2 · Spring Data JPA 4.1.0 · Redis 8.x · PostgreSQL 18

## Boundary
- **12 owns** caching as a decision: Spring's cache abstraction, Hibernate's second-level
  and query caches, invalidation, clustering.
- 🔴 `../08-the-n-plus-1-problem/17b-the-second-level-cache.md` owns the verdict "the L2
  cache is NOT an N+1 fix". I link to it and never contradict it.
- The Redis section owns Redis; I own the Java boundary only.
- Topics 09, 10, 11, 13, 14 of this phase are being written concurrently → **bold plain
  text + *(not written yet)***, never a link.

## Rules in force
- 300-line file cap is a FILE-SIZE rule; footer costs 4 lines → write ≤296 body lines.
- Depth never capped by section count — gotchas/questions exhaustive per topic.
- NO console blocks. No hit rates, no latency figures, no `redis-cli` output.
- Do not touch README.md / _category_.json / _plan.md / any board. Do not commit devbible.

## Per-file table
| # | File | Lines | Gotchas | Questions | Status |
|---|---|---|---|---|---|
| — | — | — | — | — | plan written, chunk 1 next |

## Load-bearing claims and their sources
(filled in as written)

## Traps hit
(filled in as written)

## RESUME HERE
Next file: `01-caching-is-a-decision.md` (sidebar_position 1).

## VERIFIED CLAIMS (research pass 1, 2026-08-26)

### Spring Framework 7.0 cache abstraction
Source: https://docs.spring.io/spring-framework/reference/integration/cache/annotations.html
- Default key generator algorithm, verbatim: "If no parameters are given, return `SimpleKey.EMPTY`. If only
  one parameter is given, return that instance. If more than one parameter is given, return a `SimpleKey`
  that contains all parameters."
- "The default key generation strategy changed with the release of Spring 4.0. Earlier versions ... considered
  only the `hashCode()` of parameters and not `equals()`. This could cause unexpected key collisions."
- "The `key` and `keyGenerator` parameters are mutually exclusive and an operation that specifies both results
  in an exception."
- `unless`: "Unlike `condition`, `unless` expressions are evaluated after the method has been invoked."
- @CacheEvict beforeInvocation: "If the method does not run (as it might be cached) or an exception is thrown,
  the eviction does not occur. The latter (`beforeInvocation=true`) causes the eviction to always occur before
  the method is invoked."
- @CacheEvict allEntries: "This option comes in handy when an entire cache region needs to be cleared out."
- @CachePut + @Cacheable together: "generally strongly discouraged because they have different behaviors."
- @CacheConfig: "Placing this annotation on the class does not turn on any caching operation."
- Proxy mode: "only external method calls coming in through the proxy are intercepted ... self-invocation ...
  does not lead to actual caching at runtime even if the invoked method is marked with `@Cacheable`."
- Visibility: "apply the cache annotations only to methods with public visibility ... no error is raised, but
  the annotated method does not exhibit the configured caching settings."
- sync: "By default, the cache abstraction does not lock anything, and the same value may be computed several
  times, defeating the purpose of caching." / "This is an optional feature, and your favorite cache library
  may not support it."
- SpEL context table: #root.methodName, #root.method, #root.target, #root.targetClass, #root.args,
  #root.caches, #argName / #a0 / #p0, #result ("only in `unless`, cache put, or cache evict expressions").
- Optional: "If an `Optional` value is present, it will be stored ... If an `Optional` value is not present,
  `null` will be stored in the associated cache. `#result` always refers to the business entity and never a
  supported wrapper."

Source: https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/cache/annotation/Cacheable.html
- sync limitations, verbatim: "1. `unless()` is not supported 2. Only one cache may be specified 3. No other
  cache-related operation can be combined" + "This is effectively a hint and the chosen cache provider might
  not actually support it in a synchronized fashion."
- cacheNames: "If multiple names are specified, they will be consulted for a cache hit in the order of
  definition, and they will all receive a put/evict request for the same newly cached value."

Source: https://docs.spring.io/spring-framework/reference/integration/cache/strategies.html
- "The caching abstraction has no special handling for multi-threaded and multi-process environments, as such
  features are handled by the cache implementation."
- "This approach works only for methods that are guaranteed to return the same output (result) for a given
  input (or arguments) no matter how many times they are invoked."

Source: https://docs.spring.io/spring-framework/reference/integration/cache/store-configuration.html
- ConcurrentMap store "does not provide any management, persistence capabilities, or eviction contracts".
- CompositeCacheManager `fallbackToNoOpCache`: no-op cache "does not store any information, causing the target
  method to be invoked every time".

### Spring Boot 4.1
Source: https://docs.spring.io/spring-boot/reference/io/caching.html
- Provider detection order: Generic, JCache (JSR-107), Hazelcast, Infinispan, Couchbase, Redis, Caffeine,
  Cache2k, Simple.
- Simple: "If none of the other providers can be found, a simple implementation using a `ConcurrentHashMap` as
  the cache store is configured. This is the default if no caching library is present in your application."
  "The simple provider is not really recommended for production usage."
- WARNING verbatim: "Avoid adding `@EnableCaching` to the main method's application class. Doing so makes
  caching a mandatory feature, including when running a test suite."
- cache-names: "If you do so and your application uses a cache not listed, then it fails at runtime when the
  cache is needed, but not on startup."
- Redis key prefix: "By default, a key prefix is added so that, if two separate caches use the same key, Redis
  does not have overlapping keys and cannot return invalid values. We strongly recommend keeping this setting
  enabled if you create your own `RedisCacheManager`."
Source: spring-boot 4.1.x CacheProperties.java (module/spring-boot-cache/.../CacheProperties.java)
- Redis defaults: timeToLive null ("By default the entries never expire"), cacheNullValues=true,
  keyPrefix null, useKeyPrefix=true, enableStatistics=false.

### Spring Data Redis 4.1
Source: https://docs.spring.io/spring-data/redis/reference/redis/redis-cache.html
- Default RedisCacheConfiguration: Key Expiration None; Cache null Yes; Prefix Keys Yes; Default Prefix = the
  actual cache name; Key Serializer StringRedisSerializer; Value Serializer JdkSerializationRedisSerializer.
- "By default, any `key` for a cache entry gets prefixed with the actual cache name followed by two colons (`::`)."
- "`RedisCacheManager` defaults to a lock-free `RedisCacheWriter` for reading and writing binary values.
  Lock-free caching improves throughput." Locking "applies on the cache level, not per cache entry."
- "The cache implementation defaults to use `KEYS` and `DEL` to clear the cache. `KEYS` can cause performance
  issues with large keyspaces." BatchStrategies.scan(1000) alternative; "`SCAN` is fully supported when using
  the Lettuce driver. Jedis supports `SCAN` only in non-clustered modes."
🔴 TRAP (verified, contradicts every blog):
Source: https://docs.spring.io/spring-data-redis/reference/api/java/org/springframework/data/redis/serializer/package-summary.html
- In Spring Data Redis 4.x the JSON serializer is **GenericJacksonJsonRedisSerializer** (Jackson 3).
  `GenericJackson2JsonRedisSerializer` and `Jackson2JsonRedisSerializer` are **deprecated since 4.0** in favour
  of `GenericJacksonJsonRedisSerializer` / `JacksonJsonRedisSerializer`. There is NO
  `GenericJackson3JsonRedisSerializer` in the shipped 4.1 package (it existed only in 4.0.0-M5 milestones).

### Hibernate ORM 7.4
Source: https://docs.hibernate.org/orm/7.4/javadocs/org/hibernate/cfg/CacheSettings.html
- USE_SECOND_LEVEL_CACHE default: **true when a provider is specified; false otherwise** (a 6/7-era change —
  do not write "you must set it to true").
- CACHE_REGION_FACTORY accepts a **short strategy name** (`jcache`, `infinispan`) as well as a class/instance
  — Hibernate 5 folklore uses the FQCN.
- AUTO_EVICT_COLLECTION_CACHE default false. USE_STRUCTURED_CACHE default false. USE_QUERY_CACHE default false.
- JAKARTA_SHARED_CACHE_MODE default ENABLE_SELECTIVE; Hibernate recommends ENABLE_SELECTIVE.
- QUERY_CACHE_LAYOUT is @Incubating.
Source: https://raw.githubusercontent.com/hibernate/hibernate-orm/7.4/hibernate-jcache/src/main/java/org/hibernate/cache/jcache/ConfigSettings.java
🔴 TRAP: the JCache property prefix is STILL `hibernate.javax.cache.` in Hibernate 7 despite the Jakarta
  migration — `hibernate.javax.cache.provider`, `.uri`, `.cache_manager`, `.missing_cache_strategy`.
  SIMPLE_FACTORY_NAME = "jcache". MISSING_CACHE_STRATEGY default is `FAIL`.
Source: existing chunk ../08-the-n-plus-1-problem/17b-the-second-level-cache.md (quotes §14/§31.7 of the 7.4
  User Guide verbatim — reuse those quotes, do not contradict its verdict).

## Files written (pass 1) — 2026-08-26
| # | File | Lines | Gotchas | Questions | Status |
|---|---|---|---|---|---|
| 1 | 01-caching-is-a-decision.md | 285 | 11 | 8 | done |
| 2 | 02-the-cache-abstraction.md | 270 | 11 | 7 | done |
| 3 | 02b-the-proxy-again.md | 264 | 8 | 7 | done |
| 4 | 02c-put-evict-and-the-rest.md | 278 | 10 | 8 | done |
| 5 | 02d-futures-and-reactive-returns.md | 168 | 6 | 4 | done |

⚠️ Deviation from _plan.md filenames (allowed by rule 1 — plan is not a budget):
`02c-put-evict-and-the-rest.md` and `02d-futures-and-reactive-returns.md` are new chunks
created by splitting `02` at 307/323 lines. `02b-the-proxy-again.md` keeps the planned name.
sidebar_position so far: 01=1, 02=2, 02b=3, 02c=4, 02d=5.

## NEW verified claim (research pass 2)
Source: https://docs.spring.io/spring-framework/reference/integration/cache/annotations.html
- "As of 6.1, cache annotations take `CompletableFuture` and reactive return types into
  account, automatically adapting the cache interaction accordingly."
- 🔴 Flux: "the objects emitted by that Reactive Streams publisher will be collected into a
  `List` and cached whenever that list is complete".
- "the configured cache needs to be capable of `CompletableFuture`-based retrieval. The
  Spring-provided `ConcurrentMapCacheManager` automatically adapts to that retrieval style, and
  `CaffeineCacheManager` natively supports it when its asynchronous cache mode is enabled: set
  `setAsyncCacheMode(true)`."
- "annotation-driven caching is not appropriate for sophisticated reactive interactions
  involving composition and back pressure."
- @CacheEvict reactive: "performing an after-invocation evict operation whenever processing has
  completed."
❓ COULD NOT CONFIRM: whether Spring Data Redis 4.1 `RedisCache` supports CompletableFuture-based
retrieval. Stated as uncertain on the page (02d).

## 🔴 FOOTER MARKER CORRECTION (coordinator, 2026-08-26)
`<!--FOOTER-->` is INVALID MDX and broke every GitHub Pages deploy since 2026-08-23.
**Use `{/* FOOTER */}`** as the literal last line of every page. All 6 files retrofitted with
`sed -i 's|^<!--FOOTER-->$|{/* FOOTER */}|'`. Also: never put a bare `<!-- ... -->` comment in
prose anywhere — only inside a fenced code block.

## Files written (pass 2) — 2026-08-26
| # | File | Lines | Gotchas | Questions | Status |
|---|---|---|---|---|---|
| 6 | 03-keys.md | 278 | 12 | 9 | done (sidebar_position 6) |
| 7 | 03b-writing-the-key-yourself.md | 280 | 12 | 8 | done (sidebar_position 7) |
| 8 | 03c-keys-that-silently-vary.md | 242 | 11 | 6 | done (sidebar_position 8) |
| 9 | 03d-the-key-that-never-repeats.md | 274 | 13 | 9 | done (sidebar_position 9) |
| 10 | 04-null-and-sync.md | 291 | 14 | 8 | done (sidebar_position 10) — condition/unless/null only |

### New verified claims for 04
Source: annotations.html (Conditional Caching)
- condition verbatim: "If `true`, the method is cached. If not, it behaves as if the method is not
  cached (that is, the method is invoked every time no matter what values are in the cache or what
  arguments are used)." → 🔴 a false condition skips the READ too, and leaves any existing entry.
- unless verbatim: "you can use the `unless` parameter to veto the adding of a value to the cache.
  Unlike `condition`, `unless` expressions are evaluated after the method has been invoked."
  → unless is a WRITE filter only; it cannot stop a hit being served.
- Optional verbatim (full): "If an `Optional` value is present, it will be stored in the associated
  cache. If an `Optional` value is not present, `null` will be stored in the associated cache.
  `#result` always refers to the business entity and never a supported wrapper." + "Note that
  `#result` still refers to `Book` and not `Optional<Book>`. Since it might be `null`, we use SpEL's
  safe navigation operator." Documented example: `unless="#result?.hardback"`.
- sync verbatim (for 04b): "In a multi-threaded environment, certain operations might be concurrently
  invoked for the same argument (typically on startup). By default, the cache abstraction does not
  lock anything, and the same value may be computed several times, defeating the purpose of caching."
  / "you can use the `sync` attribute to instruct the underlying cache provider to lock the cache
  entry while the value is being computed. As a result, only one thread is busy computing the value,
  while the others are blocked until the entry is updated in the cache." / "This is an optional
  feature, and your favorite cache library may not support it. All `CacheManager` implementations
  provided by the core framework support it."
Source: AbstractValueAdaptingCache.java (7.0.x) — verbatim body:
  toStoreValue: null + allowNullValues -> NullValue.INSTANCE; else throws
  `IllegalArgumentException("Cache '" + getName() + "' is configured to not allow null values but
  null was provided")`. fromStoreValue: NullValue -> null.
  → nulls ARE cached by default; ValueWrapper distinguishes absent from present-and-null.

⚠️ 03c was written at exactly 300 lines and SPLIT on the concept boundary into 03c (the key
that carries too little → wrong answer) and 03d (the key that carries too much → never repeats,
plus key size, remote key conversion, and bounding the cache). Rule 1 — never sit at the cap.

### New verified claims for 03c/03d
- Precondition quote reused from strategies.html: caching "works only for methods that are
  guaranteed to return the same output (result) for a given input (or arguments) no matter how
  many times they are invoked."
- ConcurrentMap store "does not provide any management, persistence capabilities, or eviction
  contracts" (store-configuration.html) + Boot's Simple fallback quote → **neither default bounds
  a cache**: local has no eviction contract, Redis has Key Expiration = None.
- RedisCache.convertKey throws IllegalStateException if the key cannot be rendered as a String →
  a custom key type passes tests on ConcurrentHashMap and throws on Redis.
- Boot key-prefix rationale quote reused: prefix exists "so that, if two separate caches use the
  same key, Redis does not have overlapping keys and cannot return invalid values."
❓ Did NOT claim RedisCache falls back to toString() — the javadoc only names the ConversionService.

### New verified claims for 03-keys
Source: https://github.com/spring-projects/spring-framework/blob/7.0.x/spring-context/src/main/java/org/springframework/cache/interceptor/SimpleKeyGenerator.java
- Body verbatim: `if (params.length == 0) return SimpleKey.EMPTY; if (params.length == 1) { Object param =
  params[0]; if (param != null && !param.getClass().isArray()) return param; } return new SimpleKey(params);`
- 🔴 So a single ARRAY argument and a single NULL argument BOTH fall through to SimpleKey. The
  common blog claim that "a single array arg breaks the cache" is WRONG — deepEquals applies.
- Class javadoc: "Returns the parameter itself if a single non-null value is given, otherwise returns a
  SimpleKey of the parameters. No collisions will occur with the keys generated by this class."
  ⚠️ That is a NARROW promise: it means the three cases don't collide with each other. It does NOT
  mean two methods sharing a cache name can't collide — the method name is not a key input.
Source: SimpleKey.java (7.0.x) — clones the element array, hash pre-computed from
  Arrays.deepHashCode + MurmurHash3 finalisation, hashCode field is `transient` and recomputed in
  readObject, equals uses Arrays.deepEquals, toString = class name + Arrays.deepToString.
Source: https://docs.spring.io/spring-data/redis/docs/current/api/org/springframework/data/redis/cache/RedisCache.html
- `protected String convertKey(Object key)` — "Throws IllegalStateException if key cannot be converted
  to String." Conversion goes through the cache's ConversionService (getConversionService()).
  ⚠️ javadoc does NOT say toString() is the fallback — do not claim it does.
Source: https://docs.spring.io/spring-data/redis/reference/redis/redis-cache.html
- Defaults table adds: Conversion Service = "DefaultFormattingConversionService with default cache key
  converters".
- TTL: "TTL is only set and reset by a create or update data access operation." Per-entry TTL needs a
  custom `RedisCacheWriter.TtlFunction` implementation (`entryTtl(TtlFunction)`).
- Prefix: "By default, any `key` for a cache entry gets prefixed with the actual cache name followed by
  two colons (`::`)." Changeable via `prefixCacheNameWith(...)` or `computePrefixWith(cacheName -> ...)`.

### New verified claims for 03b
Source: https://github.com/spring-projects/spring-framework/wiki/Spring-Framework-6.1-Release-Notes
- 6.1 REMOVED `LocalVariableTableParameterNameDiscoverer`; no bytecode parsing of parameter names.
  Verbatim: "If you experience issues with dependency injection, property binding, SpEL expressions,
  or other use cases that depend on the names of parameters, you should compile your Java sources with
  the common Java 8+ `-parameters` flag for parameter name retention."
  Maven: `<parameters>true</parameters>` on maven-compiler-plugin. Framework now uses
  `StandardReflectionParameterNameDiscoverer`.
  → so `#argName` in a cache key depends on a compiler flag; `#p0`/`#a0` do not.

## RESUME HERE
Next file: `04b-sync-and-the-stampede.md` (sidebar_position 11).
Then: 05-redis-as-the-store,
05b-serialization-is-the-hard-part, 06-hibernate-second-level, 06b-the-query-cache, 07-invalidation,
07b-caching-in-a-cluster, 08-when-not-to-cache, 09-the-checklist.

---

## Session `0f9ee927` — 2026-08-27 — ✅ TOPIC CLOSED at 35 chunks + index

Committed `0a1d0ea2` (07d/07e/07f, 08/08b/08c/08d), `a9528fe4` (09/09b), `f3fd7b07`
(README + two placeholder repairs), boards `da809997`. Positions 1–35, unique and gap-free.
Four planned chunks split at the cap on concept lines, nothing trimmed.

### 🔴 The one question the documentation does not settle

**Does an HQL/JPQL bulk `update`/`delete` invalidate the second-level cache regions of the
affected entity?** The Hibernate 7.4 user guide's DML chapter (§13.3) does not mention the
second-level cache; Jakarta Persistence 3.2 §4.11 addresses only the persistence context.
**Not answered from memory.** `07e` and `07f` state it as unsettled and give the practice that
is correct under either answer — evict the region explicitly, after the commit — and `07d`'s
taxonomy avoids the claim. Leave it that way unless a primary source turns up.

### Verbatim quotes banked (re-usable, all primary sources)

- **Boot's cache-provider detection order** (`docs.spring.io/spring-boot/reference/io/caching.html`):
  *"Generic, JCache (JSR-107) (EhCache 3, Hazelcast, Infinispan, and others), Hazelcast,
  Infinispan, Couchbase, Redis, Caffeine, Cache2k, Simple."* Plus: *"If none of the other
  providers can be found, a simple implementation using a `ConcurrentHashMap` as the cache
  store is configured."* and, on `cache-names`, *"it fails at runtime when the cache is needed,
  but not on startup."*
- **Cache metrics are startup-only** (`…/actuator/metrics.html`): *"Only caches that are
  configured on startup are bound to the registry. For caches not defined in the cache's
  configuration, such as caches created on the fly or programmatically after the startup
  phase, an explicit registration is required."* 🔴 **`ConcurrentMapCacheManager` is absent
  from the supported-libraries list** — so the default configuration, the one that most needs
  watching because it is unbounded and per-pod, reports no metrics at all. That composition is
  the load-bearing finding of `08c`.
- **Hibernate on external writes** (introduction §8.7): *"The second-level cache is never aware
  of any changes to data which are made externally to Hibernate. Updates made via direct JDBC —
  or by some other program — are never visible in the second-level cache."*
- **`org.hibernate.Cache` javadoc**: eviction *"causes an immediate 'hard' removal outside any
  current transaction and/or locking scheme"*, and shared regions mean
  *"`evictEntityData(Class)` for any one of the entities evicts all entities mapped to the same
  region."*
- **Micrometer** (`docs.micrometer.io/…/cache.html`): *"Setting an upper bound on the miss ratio
  is better than a lower bound on the hit ratio. For both ratios, an absence of any activity
  drops the value to 0."*
- **Hibernate arguing against its own cache** (user guide §31.7): tune the database cache and
  use JDBC batching, statement caching and indexing *"prior to jumping to a second-level cache
  layer"*.

### Correction taken after the topic was already closed

`08c` originally paraphrased Spring's `ConcurrentMap` description as *"providing no management,
persistence capabilities, or eviction contracts"*; the reference actually reads *"does not
provide any management, persistence capabilities, or eviction contracts"*. Fixed in `fe783c1d`.
A closed topic is not a reason to leave an inexact quotation standing.
