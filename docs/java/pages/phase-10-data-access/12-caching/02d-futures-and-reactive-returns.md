---
title: "The cache annotations understand `CompletableFuture`, `Mono` and `Flux` — and the `Flux` case buffers your entire stream into one cache entry"
sidebar_label: "2d · Futures and reactive returns"
sidebar_position: 5
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the Spring Framework 7.0 reference *Cache Abstraction →
> Declarative Annotation-based Caching* — the `CompletableFuture`/reactive notes under
> `@Cacheable`, `@CachePut`, `@CacheEvict` and *Synchronized Caching*
> ([docs.spring.io/spring-framework/reference/integration/cache/annotations.html](https://docs.spring.io/spring-framework/reference/integration/cache/annotations.html)).
> JDK 25, Spring Boot 4.1.1, Spring Framework 7.0.9.

**Since Spring Framework 6.1 the cache annotations adapt to asynchronous return types instead
of caching the wrapper, which is the behaviour you want in two of the three cases. The third
— `Flux` — is documented to collect the whole stream into a `List` and cache that as a single
entry, which turns an innocent-looking annotation on a streaming method into a memory
problem.**


## What each return type does

```java
@Cacheable("books")
public CompletableFuture<Book> findBook(ISBN isbn) { … }

@Cacheable("books")
public Mono<Book> findBook(ISBN isbn) { … }

@Cacheable("books")
public Flux<Book> findBooks(String author) { … }
```

| Return type | What is stored | What a hit returns |
|---|---|---|
| `CompletableFuture<T>` | the completed `T` | a `CompletableFuture<T>` |
| `Mono<T>` | the emitted `T` | a `Mono<T>` backed by a `CompletableFuture` |
| `Flux<T>` | **a pre-collected `List<T>`** | a `Flux<T>` replayed from that list |

The first two are unsurprising and genuinely useful — without them, annotating an async method
caches the *wrapper*, which is a bug that produces a cache full of already-consumed futures.

## `sync = true` works here too

> *"Such `CompletableFuture` and reactive adaptation also works for synchronized caching,
> computing the value only once in case of a concurrent cache miss"*

```java
@Cacheable(cacheNames = "foos", sync = true)
public CompletableFuture<Foo> executeExpensiveOperation(String id) { … }
```

That is a better fit than it looks: an async method is often async precisely because it is
expensive, and expensive plus concurrent is the stampede case that
[4 · Caching a null, and `sync`](04-null-and-sync.md) is about.

## Two conditions the documentation attaches

**1 · The store must support future-based retrieval.**

> *"In order for such an arrangement to work at runtime, the configured cache needs to be
> capable of `CompletableFuture`-based retrieval. The Spring-provided
> `ConcurrentMapCacheManager` automatically adapts to that retrieval style, and
> `CaffeineCacheManager` natively supports it when its asynchronous cache mode is enabled: set
> `setAsyncCacheMode(true)` on your `CaffeineCacheManager` instance."*

Caffeine's async mode is **off by default**, so the common production setup — Caffeine, no
customisation — is not the setup the documentation describes.

⚠️ I could not confirm from the Spring Data Redis 4.1 documentation whether `RedisCache`
supports `CompletableFuture`-based retrieval. If you are combining a reactive stack with a
Redis-backed cache, verify that against your own version rather than assuming it from this
page.

**2 · It is deliberately coarse.**

> *"annotation-driven caching is not appropriate for sophisticated reactive interactions
> involving composition and back pressure. If you choose to declare `@Cacheable` on specific
> reactive methods, consider the impact of the rather coarse-granular cache interaction which
> simply stores the emitted object for a `Mono` or even a pre-collected list of objects for a
> `Flux`."*

That is the framework telling you its abstraction is a key-value lookup wearing reactive
clothes. Back pressure does not survive it: a cached `Flux` is replayed from a list that was
fully materialised regardless of what the subscriber asked for.

## The write annotations follow

> *"As of 6.1, `@CachePut` takes `CompletableFuture` and reactive return types into account,
> performing the put operation whenever the produced object is available."*

> *"As of 6.1, `@CacheEvict` takes `CompletableFuture` and reactive return types into account,
> performing an after-invocation evict operation whenever processing has completed."*

Read the `@CacheEvict` wording carefully: the evict happens when **processing completes**, not
when the method returns the publisher. On a reactive path the method returns almost
immediately and the eviction happens later — so an eviction you believed was synchronous with
the call is now genuinely asynchronous with it, and any code that reads straight after the call
can read the pre-eviction value. That is the same class of problem as
[7 · Invalidation](07-invalidation.md), made wider by the return type.

## Gotchas

**★ Annotating a `Flux`-returning method buffers the entire stream into a `List` before
anything is cached.** Documented behaviour, not a bug. On a large or unbounded stream it is an
out-of-memory condition with an annotation on it.

**★ A cached `Flux` is not a stream any more.** It is a replay of a fully materialised list, so
back pressure and incremental delivery are gone on every hit and present on every miss — two
different behaviours from one method.

**★ Caffeine's asynchronous cache mode is off by default.** The documented arrangement requires
`setAsyncCacheMode(true)`, which means the default Boot-autoconfigured Caffeine manager is not
the one the reference is describing.

**★ Before 6.1 this all cached the wrapper.** Code carried over from an older baseline may have
been caching completed futures or cold publishers — a cold `Mono` cached and re-subscribed by
every caller re-executes the work every time, which is a cache with a 100% hit rate and no
benefit.

**★ A reactive `@CacheEvict` completes after the method returns.** The eviction is tied to the
publisher terminating, so "evict then read" is not ordered the way the code reads.

**★ `unless` on an async method still cannot be combined with `sync = true`.** The sync
restrictions are unchanged by the return type, and they are the ones in
[4 · `sync` and the stampede](04-null-and-sync.md).

## Interview questions

**★ What happens if you put `@Cacheable` on a method returning `Mono` or `Flux`?**
Since Spring 6.1 the annotations adapt to asynchronous return types, so a `Mono` caches the
emitted object and reads back as a `Mono`. `Flux` is the one to be careful with: the
documentation says the emitted objects are "collected into a `List` and cached whenever that
list is complete", so the whole stream is buffered before anything is stored and the entire
list becomes one entry. That is fine for a small bounded result and catastrophic for a large
one. The reference is also explicit that annotation-driven caching "is not appropriate for
sophisticated reactive interactions involving composition and back pressure", which I read as
a recommendation to cache the underlying lookup rather than the stream.

**★ Why did Spring need to special-case these return types at all?**
Because the abstraction stores whatever the method returned, and for an async method that is a
container rather than a value. Caching a `CompletableFuture` that has already been consumed, or
a cold `Mono` that re-executes on every subscription, produces a cache that reports hits and
delivers no benefit — or worse, hands every caller the same terminal publisher. Since 6.1 the
annotations unwrap the container, store the value when it becomes available, and rebuild a
container on the way out, which is the only interpretation that makes the annotation mean what
it looks like it means.

**★ Would you put `@Cacheable` on a `Flux`?**
Only on one I know is small and bounded, and I would rather cache the underlying lookup. The
documentation is explicit that the emitted objects are collected into a `List` and cached as
one entry, so the streaming property is gone on hits and the memory cost is the whole result
set on misses. The framework itself says annotation-driven caching "is not appropriate for
sophisticated reactive interactions involving composition and back pressure". If the point of
returning a `Flux` was to avoid materialising the result, annotating it undoes the reason it
exists.

**★ What breaks if the cache store cannot do future-based retrieval?**
The documentation says the arrangement needs a cache "capable of `CompletableFuture`-based
retrieval", names `ConcurrentMapCacheManager` as adapting automatically, and says
`CaffeineCacheManager` supports it only with `setAsyncCacheMode(true)`. Since that flag is off
by default, the realistic failure is a team enabling reactive caching on a Caffeine manager
they configured for the synchronous case and getting behaviour that does not match the
reference. I would verify the specific store rather than assume — and for Redis specifically I
could not settle it from the 4.1 documentation.

{/* FOOTER */}
