---
title: "The default cache error handler rethrows, so an unreachable Redis makes every cached method fail rather than miss — and the obvious fix, swallowing the exception, quietly converts an outage into a cache that never warms"
sidebar_label: "5d2 · When the cache is down"
sidebar_position: 17
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the Spring Framework 7.0 reference *Cache Abstraction →
> Declarative Annotation-based Caching*, Table 2 *Cache annotation settings*
> ([docs.spring.io/spring-framework/reference/integration/cache/annotations.html](https://docs.spring.io/spring-framework/reference/integration/cache/annotations.html)),
> the `SimpleCacheErrorHandler` and `CacheErrorHandler` javadoc
> ([docs.spring.io/spring-framework](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/cache/interceptor/SimpleCacheErrorHandler.html)),
> and the Spring Data Redis 4.1 reference *Redis Cache*
> ([docs.spring.io/spring-data/redis/reference/redis/redis-cache.html](https://docs.spring.io/spring-data/redis/reference/redis/redis-cache.html)).
> JDK 25, Spring Boot 4.1.0, Spring Framework 7.0, Spring Data Redis 4.1, Redis 8.

**Once the cache is out of process it can fail independently of your application, and the
framework has a documented default for what happens then: the exception is thrown at the caller.
That is a real decision with a real alternative, and both options have a failure mode that only
appears in production.**

## The cache is a failure domain

From the annotation settings table:

> *"The name of the custom cache error handler to use. By default, any exception thrown during a
> cache related operation is thrown back at the client."*

and the default implementation's javadoc:

> *"A simple `CacheErrorHandler` that does not handle the exception at all, simply throwing it
> back at the client."*

**So when Redis is unreachable, a `@Cacheable` method does not fall through to the database — it
throws.** You have taken a component whose purpose is to make the system faster and made it able
to make the system unavailable. Nothing about that is wrong by default; it is just a decision
that someone should make on purpose.

```java
@Configuration
@EnableCaching
class CacheConfig implements CachingConfigurer {

    private static final Logger log = LoggerFactory.getLogger(CacheConfig.class);

    @Override
    public CacheErrorHandler errorHandler() {
        return new CacheErrorHandler() {
            @Override public void handleCacheGetError(RuntimeException e, Cache c, Object key) {
                log.warn("cache get failed, falling through to source: {}", c.getName(), e);
            }
            @Override public void handleCachePutError(RuntimeException e, Cache c, Object key, Object v) {
                log.warn("cache put failed: {}", c.getName(), e);
            }
            @Override public void handleCacheEvictError(RuntimeException e, Cache c, Object key) {
                log.error("cache evict FAILED — stale entry may persist: {}", c.getName(), e);
            }
            @Override public void handleCacheClearError(RuntimeException e, Cache c) {
                log.error("cache clear FAILED: {}", c.getName(), e);
            }
        };
    }
}
```

Which of the two behaviours you want depends on what the cache is for:

- **An optimisation** — the database can serve the full read load, just more slowly. Swallow get
  and put errors; a cache outage becomes a latency event.
- **A load shield** — the database cannot survive the uncached read rate. Leave it throwing.
  Falling through means a thundering herd onto the database, and a database outage lasts longer
  and recovers worse than a fast failure.

🔴 **Get failures and evict failures are not symmetrical, and the code above reflects that.** A
swallowed `get` costs one query. A swallowed `evict` leaves an entry that will be served as
correct until its TTL expires — and if you kept `Key Expiration: None`
([5c](05c-expiry-and-eviction.md)), forever. Logging them at the same level is how a correctness
event gets filtered out with the noise.

⚠️ A swallowed error also hides the incident from you entirely unless you count it. Whatever the
handler does, increment a metric; a cache that has been silently failing every put for a week
looks exactly like a cache with a bad hit rate.

## Gotchas

**★ Redis being unreachable makes cached methods throw, not miss.** The default error handler
rethrows, so a cache outage is an availability event unless you decided otherwise.

**★ A swallowed evict error is a correctness bug; a swallowed get error is a performance one.**
With no TTL the first is permanent. Handle and log them differently.

**★ A `CacheErrorHandler` that only logs makes the incident invisible.** Emit a metric from it,
or a silently failing cache looks identical to an ineffective one.

**★ `handleCachePutError` swallowing means the cache never warms.** Every request is a miss and
the database takes the full load indefinitely — the "graceful degradation" configuration degrades
into no cache at all, quietly, which is exactly the state you would want an alert for.

**★ `CachingConfigurer` is an interface with default methods, so overriding one loses nothing.**
There is no need to supply a `CacheManager` or `KeyGenerator` just to install an error handler,
and supplying one you did not mean to is how a Redis cache turns back into a local map.

**★ The error handler does not see a deserialization failure any differently from a connection
failure.** Both arrive as a `RuntimeException` from the cache operation, so a "fall through on
error" policy will happily mask an entire poisoned generation of entries
([5b](05b-serialization-is-the-hard-part.md)) as a slightly disappointing hit rate.

**★ Falling through on a get error can be worse than failing.** If the cache is down because it
is overloaded, every pod simultaneously discovers that and sends its full read volume to the
database. The cache failing is precisely the moment the database is least able to help.

**★ A connection timeout is not a fast failure.** "The cache is down" usually means "the cache is
slow", and a `@Cacheable` method now takes the client timeout *before* falling through to a
database call that takes its own. Set the Redis command timeout deliberately; the default
behaviour of a cache miss is not supposed to be seconds.

## Interview questions

**★ Redis is down. What should the application do?**
Whatever you decided in advance, which is the point of the question. The default is that the
exception propagates: the error handler "does not handle the exception at all, simply throwing it
back at the client", so `@Cacheable` methods fail rather than falling through. For an ordinary
read cache in front of a database with headroom I would install a `CacheErrorHandler` that logs,
emits a metric and falls through, so a cache outage is a latency event. For a cache that is the
only reason the database survives peak, I would leave it throwing, because a herd onto the
database is a longer outage than a fast failure. In either case I would treat evict failures
differently: a failed get costs a query, a failed evict leaves a wrong answer that outlives the
incident.

**★ Your team swallowed all cache errors so a Redis outage would not take the site down. What did
that cost?**
Two things, and the second is the one that surprises people. First, evictions now fail silently,
so during any Redis disturbance entries that should have been invalidated stay — and with no TTL
they stay indefinitely, long after Redis recovers. Second, put failures are also swallowed, so if
the failure mode is "writes rejected but reads fine" — which is exactly what `maxmemory` with
`noeviction` produces — the cache never warms, every request is a miss, and the database silently
takes the full uncached load with nothing in the logs but warnings nobody reads. Swallowing is
the right default for gets; it needs a metric and an alert behind it, or you have traded a loud
problem for an invisible one.

**★ Is "fail open" or "fail closed" the right default for a cache?**
It depends on why the cache exists, and that is a question worth being able to answer for each
cache rather than for caching in general. If the cache is an optimisation — the database can
serve the uncached load, just slower — fail open, because an unavailable cache should never be an
unavailable site. If the cache is load-bearing, in the sense that the uncached read rate would
take the database down, fail closed: shedding requests fast is a shorter and more recoverable
outage than a saturated database, and it keeps the write path alive. The tell that a cache has
quietly become load-bearing is that nobody is willing to test what happens with it turned off,
which is itself the answer.

**★ How would you find out that your cache has been failing all week?**
By having counted it, which is the part people skip. Once a `CacheErrorHandler` swallows an
exception, the only trace is a log line, and log lines at WARN in a busy service are not
noticed. So the handler emits a metric per operation type, and the alert is on the rate of put
failures rather than get failures — because a cache that cannot write is indistinguishable from a
cache with a cold key space in every other signal. On the Redis side the corroborating evidence
is `INFO commandstats` rejections and `evicted_keys`; on the Spring side it is per-cache
statistics, which are off by default.

{/* FOOTER */}
