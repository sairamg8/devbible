---
title: "Spring's cache abstraction caches method return values against a key, and everything that goes wrong with it goes wrong at one of those two words"
sidebar_label: "2 · The cache abstraction"
sidebar_position: 2
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the Spring Framework 7.0 reference *Cache Abstraction* —
> *Understanding the Cache Abstraction* and *Declarative Annotation-based Caching*
> ([docs.spring.io/spring-framework/reference/integration/cache/annotations.html](https://docs.spring.io/spring-framework/reference/integration/cache/annotations.html)),
> the `@Cacheable` javadoc
> ([docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/cache/annotation/Cacheable.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/cache/annotation/Cacheable.html)),
> and the Spring Boot 4.1 reference *Caching*
> ([docs.spring.io/spring-boot/reference/io/caching.html](https://docs.spring.io/spring-boot/reference/io/caching.html)).
> JDK 25, Spring Boot 4.1.0, Spring Framework 7.0.8.

**The abstraction is deliberately small: a `CacheManager` hands out named `Cache`s, an
interceptor computes a key from the method arguments, and a hit returns the stored value
instead of calling the method. Nothing in it knows what your data means. It does not know
that two arguments produce the same answer, that a `null` is a miss rather than an answer,
or that another service just changed the row — those are all yours, and each one has its
own chunk in this topic.**

## Two interfaces and one interceptor

```java
public interface CacheManager {
    Cache getCache(String name);
    Collection<String> getCacheNames();
}
```

`Cache` is the store: `get(key)`, `put(key, value)`, `evict(key)`, `clear()`. Spring's
reference states the whole scope in one sentence — the abstraction "is materialized by the
`org.springframework.cache.Cache` and `org.springframework.cache.CacheManager` interfaces"
— and that is genuinely all of it. Everything else is an AOP interceptor that decides which
`Cache` to ask and what key to ask for.

Which means the abstraction is **provider-agnostic by design and semantics-agnostic by
accident**. Swapping a `ConcurrentHashMap` for Redis does not change a single annotation,
and it changes almost every operational property you care about — serialization, TTL,
coherence, failure mode. Chunks [5](05-redis-as-the-store.md) and
[5b](05b-serialization-is-the-hard-part.md) are about that gap.

## Turning it on

```java
@Configuration
@EnableCaching
class CacheConfiguration { }
```

The reference is explicit that this is not optional:

> *"It is important to note that even though declaring the cache annotations does not
> automatically trigger their actions - like many things in Spring, the feature has to be
> declaratively enabled."*

Without `@EnableCaching` every annotation in your codebase is a comment. There is no
warning, no startup failure and no log line; the methods simply run every time, which looks
exactly like a cache with a zero percent hit rate.

⚠️ **Boot's own documentation tells you where not to put it:**

> *"Avoid adding `@EnableCaching` to the main method's application class. Doing so makes
> caching a mandatory feature, including when running a test suite."*

Put it on a small `@Configuration` class instead, so a slice test or a profile can leave it
out. Caching in tests is a source of false greens — a test asserting on database state
against a warm cache is asserting on nothing.

## What Boot picks for you, and the trap in it

If you have not defined a `CacheManager` bean, Boot detects a provider **in a fixed order**:

> Generic · JCache (JSR-107) · Hazelcast · Infinispan · Couchbase · Redis · Caffeine ·
> Cache2k · Simple

and the last entry is the one to understand:

> *"If none of the other providers can be found, a simple implementation using a
> `ConcurrentHashMap` as the cache store is configured. This is the default if no caching
> library is present in your application."*

followed by:

> *"The simple provider is not really recommended for production usage, but it is great for
> getting started and making sure that you understand the features."*

🔴 **This is the most common silent misconfiguration in the whole topic.** A service that
*intended* to cache in Redis, and whose Redis connection details are wrong or whose
starter was dropped in a dependency cleanup, does not fail to start. It falls through to
`Simple` and caches in an **unbounded `ConcurrentHashMap` inside each pod**. You get:

- no TTL, because the map has none;
- no eviction, because the map has none — the reference notes the JDK store "does not
  provide any management, persistence capabilities, or eviction contracts";
- no coherence, because each pod has its own map;
- and a heap that grows for as long as new keys arrive.

Everything looks like it is working. The hit rate is excellent. Two pods disagree, an
eviction in one pod is invisible in the other, and eventually one of them dies of memory.

**Pin it.** `spring.cache.type` forces the provider, so a misconfiguration becomes a
startup failure instead of a silent downgrade:

```yaml
spring:
  cache:
    type: redis          # never falls back to `simple`
    cache-names: products,pricing
```

`cache-names` is worth setting too, with a caveat Boot states directly:

> *"If you do so and your application uses a cache not listed, then it fails at runtime when
> the cache is needed, but not on startup."*

So it catches a typo in a cache name — at first use, not at boot. That is still far better
than the default, where a typo creates a brand-new cache nobody ever evicts.

For tests, `spring.cache.type=none` gives you a no-op manager; the framework's equivalent is
`NoOpCacheManager`, whose caches "do not store any information, causing the target method to
be invoked every time".

## `@Cacheable` — the read path

```java
@Cacheable("products")
public Product findProduct(String sku) { … }
```

On invocation the interceptor computes a key, asks the `products` cache, and on a hit
returns the stored value **without calling the method at all**. On a miss it calls the
method and stores what comes back.

Three details from the javadoc that are load-bearing:

**Multiple cache names are not a fallback chain in the way people assume.** The javadoc:
"If multiple names are specified, they will be consulted for a cache hit in the order of
definition, and they will all receive a put/evict request for the same newly cached value."
So a hit in the first cache short-circuits, but a miss writes into *every* named cache. Two
caches with different TTLs listed on one method therefore hold the same value with different
expiries, and the shorter one becomes decorative.

**`Optional` is unwrapped, and the empty case is stored.** The javadoc: "If an `Optional`
value is present, it will be stored in the associated cache. If an `Optional` value is not
present, `null` will be stored in the associated cache." That is usually what you want —
"this SKU does not exist" is a cacheable fact — but it means an empty `Optional` and a
genuine `null` are indistinguishable in the store, and both are covered by
[4 · Caching a null](04-null-and-sync.md).

**Visibility is silently enforced.** The reference:

> *"When you use proxies, you should apply the cache annotations only to methods with public
> visibility. If you do annotate protected, private, or package-visible methods with these
> annotations, no error is raised, but the annotated method does not exhibit the configured
> caching settings."*

"No error is raised" is the phrase to remember. It is the same failure as
[2b · The proxy again](02b-the-proxy-again.md), from a different direction.

## Gotchas

**★ No `@EnableCaching` means every annotation is inert, silently.** The symptom is a cache
that appears to have a zero percent hit rate, which teams debug as a key problem for a long
time before checking whether caching is on at all.

**★ Boot falls back to an unbounded per-pod `ConcurrentHashMap` rather than failing.** A
dropped starter or a bad Redis host downgrades you to `Simple` with no warning, no TTL and
no eviction. Set `spring.cache.type` explicitly in every environment.

**★ `@EnableCaching` on the application class makes caching mandatory in tests**, which is
Boot's own documented warning and a reliable source of tests that pass against a warm cache.

**★ Listing two cache names writes to both on a miss.** It is not a tiered cache. Different
TTLs on the two caches means the same value expires twice, at different times, and reads
short-circuit on whichever is listed first.

**★ A cache name that does not exist is created on demand by most providers.** So a typo in
`@Cacheable("prodcuts")` produces a perfectly functional cache that nothing else ever reads
or evicts. `spring.cache.cache-names` turns that into a runtime failure at first use.

**★ Package-private and protected methods accept the annotation and ignore it.** "No error is
raised" — the documentation says so explicitly, and it is the same class of bug as
self-invocation.

**★ `@Cacheable` on a method that returns a mutable object hands every caller the same
instance.** With a local cache there is no serialization boundary, so one caller mutating the
result corrupts the entry for everyone. A remote store accidentally protects you from this by
deserializing a fresh copy each time — which means the bug appears only after someone
"optimises" Redis away.

**★ Caching in tests turns assertions into decoration.** A repository test that writes and
then reads through a cached service asserts what the cache holds, not what the database
holds.

**★ Any `Cache` bean in the context silently switches Boot to the `Generic` provider.**
Generic is first in the detection order and is chosen when "the context defines at least one
`Cache` bean", so one hand-rolled `Cache` for one special case takes over cache management for
every other cache in the application.

**★ Defining your own `CacheManager` bean turns off the auto-configuration entirely.**
Detection runs only "if you have not defined a bean of type `CacheManager` or a `CacheResolver`
named `cacheResolver`", so after that every `spring.cache.*` property in your YAML is inert —
including the ones a colleague adds next year expecting them to apply.

**★ Cache statistics are off by default.** `spring.cache.redis.enable-statistics` defaults to
`false`, so "we have no hit-rate metric" is usually a setting rather than a missing feature.


## Interview questions

**★ What does `@Cacheable` actually do at runtime?**
An AOP interceptor around the bean computes a key from the invocation, asks the named cache
for that key, and if there is a hit it returns the stored value and never calls your method.
On a miss it calls the method and puts the result under that key. That is the whole
mechanism, and it explains most of the surprises: it is keyed on arguments so anything the
method depends on that is not an argument is invisible to it; it is an interceptor so a call
that does not go through the proxy is not intercepted; and it stores the return value, so
whatever the method returns is what every future caller gets.

**★ Why is `@EnableCaching` separate from the annotations?**
Because the annotations are metadata and the interception is infrastructure, and Spring keeps
those separable so that caching can be turned off wholesale — per profile, per test, per
environment — without editing any of the annotated code. The practical consequence is that
forgetting it produces no error at all. Boot additionally warns against putting it on the
application class, because that makes caching unconditional including in the test suite, and
a cache in a test suite is how you get assertions that pass against stale data.

**★ Boot did not find your cache provider. What happens?**
It falls through its detection order to the `Simple` provider, which is a
`ConcurrentHashMap` per application instance. Nothing fails. You get an unbounded, per-pod,
never-expiring cache with no eviction policy, and everything looks healthy until either two
pods disagree about a value or one of them runs out of heap. This is why I set
`spring.cache.type` explicitly rather than relying on detection — I want a broken
configuration to be a startup failure, not a silent downgrade to a memory leak.

**★ You annotated a package-private method and nothing is cached. Why?**
Because with proxies only public methods are advised, and the documentation is explicit that
"no error is raised" when you annotate anything else. It is the same family of failure as
self-invocation: the annotation is real, the bean is proxied, and the call path never reaches
the interceptor. I would check visibility and call path before anything else whenever a cache
appears to have a zero percent hit rate.

**★ What does listing two cache names on `@Cacheable` mean?**
Reads consult them in declaration order and stop at the first hit; a miss populates all of
them. It is not a two-tier cache and it is not a fallback — both caches get the same value.
The trap is configuring different TTLs and assuming a near/far arrangement: what you actually
built is the same value stored twice with two expiry times, and reads that only ever notice
the first one.

**★ How do you keep caching out of your tests?**
Keep `@EnableCaching` off the application class so it is not unconditional, and set
`spring.cache.type=none` in the test profile so the manager is a no-op and every target method
runs. The reason is that a cache turns an assertion about the database into an assertion about
the cache — a test that writes through a service and then reads through the same service can
be green while the write never reached the database at all.

**★ You defined your own `CacheManager` bean and your `spring.cache.redis.time-to-live`
stopped applying. Why?**
Because Boot's cache auto-configuration only runs when there is no `CacheManager` bean and no
`CacheResolver` named `cacheResolver`. Defining one takes over completely, and the properties
are read by the auto-configuration you just replaced, so they become dead configuration that
still looks live in the YAML. If I need one customised cache I would rather supply a
`RedisCacheConfiguration` bean or a `RedisCacheManagerBuilderCustomizer`, which lets the
auto-configuration keep ownership and keeps the properties meaningful.

<!--FOOTER-->
