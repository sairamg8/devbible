---
title: "`@CachePut` and `@CacheEvict` are the write half of the abstraction, and both fail the same way — by operating on a key the reader never asks for"
sidebar_label: "2c · Put, evict and the rest"
sidebar_position: 4
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the Spring Framework 7.0 reference *Cache Abstraction →
> Declarative Annotation-based Caching* — the `@CachePut`, `@CacheEvict`, `@Caching` and
> `@CacheConfig` sections
> ([docs.spring.io/spring-framework/reference/integration/cache/annotations.html](https://docs.spring.io/spring-framework/reference/integration/cache/annotations.html)).
> JDK 25, Spring Boot 4.1.0, Spring Framework 7.0.8.

**`@Cacheable` is one annotation and three of the remaining four exist to undo it. The
recurring bug in all of them is not the annotation, it is the key: a write path that puts or
evicts a key the read path does not use produces a cache that looks maintained and is
permanently stale. Read this page as being about keys, and [3 · Keys](03-keys.md) as being
about the same thing in more detail.**

## `@CachePut` — the write-through path

```java
@CachePut(cacheNames = "products", key = "#product.sku")
public Product save(Product product) { … }
```

> *"the method is always invoked and its result is placed into the cache (according to the
> `@CachePut` options)."*

Always invoked. That is the entire difference from `@Cacheable`, and it is why `@CachePut`
belongs on a write: you want the write to happen *and* the cache to reflect it.

⚠️ **`@CachePut` and `@Cacheable` on the same method is documented as a mistake:**

> *"Using `@CachePut` and `@Cacheable` annotations on the same method is generally strongly
> discouraged because they have different behaviors."*

`@Cacheable` may skip the invocation entirely while `@CachePut` requires it, so the pair has
no coherent meaning and the resulting behaviour depends on interceptor ordering rather than
on anything you wrote.

**The subtler trap is the key.** The cache is keyed by whatever the *read* method keys by. If
`findProduct(String sku)` keys on the SKU and `save(Product product)` keys on `#product.sku`,
they agree. If `save` is left to the default key generator it keys on the whole `Product`
instance, writes an entry nobody will ever look up, and leaves the real entry stale. A
`@CachePut` that does not write the key the reader reads is **worse than no `@CachePut` at
all**, because it looks like freshness is handled.

**And `@CachePut` writes what the method returned, not what the database holds.** If `save`
returns its argument rather than the merged entity, you have cached an object whose generated
id, version and database-side defaults are not populated. In JPA that is a live hazard,
because `merge` returns a copy —
[../06-jpa-hibernate-model/13b-merge-returns-a-copy.md](../06-jpa-hibernate-model/13b-merge-returns-a-copy.md).

## `@CacheEvict` — removing one entry, or all of them

```java
@CacheEvict(cacheNames = "products", key = "#sku")
public void delete(String sku) { … }
```

> *"`@CacheEvict` demarcates methods that perform cache eviction (that is, methods that act as
> triggers for removing data from the cache)."*

Note "act as triggers". The method does not have to be about the cache, and it does not have
to return anything — eviction is a side effect attached to a business operation. That is the
right shape: the eviction lives next to the write that caused it, rather than in a separate
cache-maintenance class nobody updates.

### `allEntries = true`

```java
@CacheEvict(cacheNames = "books", allEntries = true)
public void loadBooks(InputStream batch) { … }
```

> *"This option comes in handy when an entire cache region needs to be cleared out. Rather
> than evicting each entry (which would take a long time, since it is inefficient), all the
> entries are removed in one operation."*

The legitimate use is a bulk operation whose affected keys you cannot enumerate: a batch
import, a full reindex, a configuration reload. The illegitimate use — and it is extremely
common — is **reaching for `allEntries` because working out the right key was hard**. That
converts a targeted invalidation into a full cache flush on every single write, and on a
write-moderate cache the hit rate collapses to roughly zero while the memory and network
costs stay exactly where they were.

⚠️ On a remote store, `allEntries` is also not free at the protocol level. Spring Data Redis
states that "the cache implementation defaults to use `KEYS` and `DEL` to clear the cache",
and that "`KEYS` can cause performance issues with large keyspaces" — see
[5 · Redis as the store](05-redis-as-the-store.md).

### `beforeInvocation`

This is the attribute that decides what happens when the method throws, and the default is
the surprising half.

> *"You can also indicate whether the eviction should occur after (the default) or before the
> method is invoked by using the `beforeInvocation` attribute. The former provides the same
> semantics as the rest of the annotations: Once the method completes successfully, an action
> (in this case, eviction) on the cache is run. If the method does not run (as it might be
> cached) or an exception is thrown, the eviction does not occur. The latter
> (`beforeInvocation=true`) causes the eviction to always occur before the method is
> invoked."*

So by default **a method that throws does not evict**. Read that against a partially-completed
write. A `deleteProduct` that removes the row and then fails while publishing an event has
changed the database and left the cache holding the deleted product — for as long as the TTL
allows, or forever if there is none.

`beforeInvocation = true` inverts the risk rather than removing it: the entry is evicted
first, so a method that fails leaves the cache empty rather than wrong. The next read repopulates
from the database. **Empty-and-correct beats populated-and-wrong**, which is why
`beforeInvocation = true` is the right default for eviction on any operation that mutates
state, and the framework's default is the one you have to think about.

🔴 There is a second-order problem underneath both settings — the evict happens when the
*method* returns, not when the *transaction* commits. That is
[7 · Invalidation](07-invalidation.md), and it is the reason this topic exists.

## `@Caching` — several operations on one method

```java
@Caching(evict = {
    @CacheEvict("primary"),
    @CacheEvict(cacheNames = "secondary", key = "#p0")
})
public Book importBooks(String deposit, Date date) { … }
```

> *"Sometimes, multiple annotations of the same type (such as `@CacheEvict` or `@CachePut`)
> need to be specified — for example, because the condition or the key expression is different
> between different caches."*

The realistic use is one write invalidating several derived views: a price change that must
evict `products` by SKU, `pricing` by SKU, and `category-listings` by category id. Those are
three different caches with three different key expressions, and `@Caching` is the only way to
express them declaratively on one method.

It is also a good warning sign. If a single write needs five nested evictions, the caches have
been drawn along the wrong lines, and the entry that gets forgotten next year is the sixth one.

## `@CacheConfig` — shared defaults, and nothing else

```java
@CacheConfig("books")
public class BookRepositoryImpl implements BookRepository {

    @Cacheable
    public Book findBook(ISBN isbn) { … }
}
```

> *"`@CacheConfig` is a class-level annotation that allows sharing the cache names, the custom
> `KeyGenerator`, the custom `CacheManager`, and the custom `CacheResolver`. **Placing this
> annotation on the class does not turn on any caching operation.**"*

The emphasis is the framework's own point, and it is the whole trap: `@CacheConfig` looks like
`@Cacheable` at class level and is not. It supplies defaults to methods that already carry a
cache annotation. A class annotated only with `@CacheConfig` caches nothing.

It earns its place when a class has several methods on one cache — it stops the cache name
being repeated (and therefore mistyped) six times, and it puts the `keyGenerator` choice in one
place. It does not earn its place on a class with one cached method, where it just moves
information away from where it is used.

## Gotchas

**★ `@CachePut` with a default key almost never writes the key the reader reads.** The read
keys on an id; the write keys on the whole entity. Both "work". Only one is ever found.

**★ `@CachePut` caches the return value, so a method returning its own argument caches an
object the database never saw** — no generated id, no version, no database defaults, and no
symptom until something reads it and trusts those fields.

**★ `@CacheEvict` does not evict when the method throws, by default.** A half-completed write
therefore leaves the cache populated with the pre-write value. `beforeInvocation = true` is
the safer default for any state-changing method.

**★ `beforeInvocation = true` opens a window where a concurrent read repopulates the old
value.** The entry is evicted, the method has not committed yet, another thread reads,
misses, loads the *old* row from the database and caches it again. The window is small and it
is real; the fix is not another attribute, it is
[7 · Invalidation](07-invalidation.md).

**★ `allEntries = true` used as a shortcut for "I could not work out the key" destroys the
hit rate.** Every write flushes the whole cache, so you keep all the costs of caching and
lose the benefit.

**★ `allEntries` on a Redis-backed cache runs `KEYS` by default**, which the Spring Data
documentation warns "can cause performance issues with large keyspaces".

**★ `@CacheConfig` alone caches nothing**, and it reads exactly like it should. The
documentation says so in bold for a reason.

**★ A `@CacheEvict` on a method nobody calls looks like invalidation coverage.** Cache
maintenance written on a service method that the batch job bypasses — because the batch writes
through the repository directly — is the single most common source of permanently stale
entries.

**★ Eviction has to cover writes made by code you do not own.** Another service, a migration,
a support engineer's `UPDATE`. No annotation anywhere in your codebase evicts those, and
nothing tells you.

**★ `@Caching` with many nested evictions is a design smell rather than a feature.** It means
one fact is stored in several caches under several keys; the failure mode is that a new write
path updates four of them.

## Interview questions

**★ When would you use `@CachePut` rather than `@CacheEvict` on a write?**
When the method already returns the new state and the entry is expensive to rebuild — writing
through means the next reader gets a hit instead of paying a reload. But it only works if the
`@CachePut` key is exactly the key the reader uses, and if the returned object really is the
persisted state rather than the argument that was passed in. When either is uncertain, evicting
is the safer default: a miss costs one query, whereas a write-through that puts the wrong
object under the right key is a stale answer with no expiry until something else evicts it.

**★ Can you put `@Cacheable` and `@CachePut` on the same method?**
The framework will let you and the documentation says not to — "generally strongly discouraged
because they have different behaviors". `@Cacheable` may skip the invocation entirely,
`@CachePut` requires it, so the combination has no consistent meaning and what happens depends
on ordering rather than intent. If you want "read from cache but refresh on demand", that is
two methods, or one method plus a `condition`, not two annotations fighting over one
invocation.

**★ What does `beforeInvocation` do and which value would you choose?**
It decides whether the eviction happens before the method runs or after it returns
successfully. The default is after, which means an exception leaves the cache untouched — so a
write that got halfway through leaves the old value cached and served. I default to
`beforeInvocation = true` on anything that mutates state, because the two failure modes are not
symmetric: evicting too eagerly costs one cache miss, and evicting too late serves wrong data
until the TTL expires. It does not solve the underlying problem, which is that the evict is
tied to the method returning rather than to the transaction committing.

**★ What is wrong with `allEntries = true` on every write?**
It is correct and it is the end of the cache's usefulness. Every write clears every entry, so
the hit rate tracks the write rate downwards while you keep paying for memory, serialization
and, on a remote store, the flush itself — which Spring Data Redis implements with `KEYS` and
`DEL` by default and warns about on large keyspaces. `allEntries` is right when the affected
keys genuinely cannot be enumerated, like a bulk import or a reload. When it is being used
because working out the key was fiddly, the fiddly key is the actual task.

**★ How do you handle one write that invalidates several caches?**
`@Caching` with several nested `@CacheEvict` entries, each with its own cache name and key
expression, is the declarative answer. But I would treat needing it as information: it means
one fact is materialised in several places, and the risk is not this write path, it is the next
one. Somebody adds a second way to change a price and updates three of the four evictions. At
that point I would rather have one place that publishes "this SKU changed" and one listener
that owns the invalidation, so a new write path cannot forget a cache it does not know about.

**★ Why does `@CacheConfig` exist if it does not enable caching?**
It is purely a place to put shared defaults — the cache name, the key generator, the cache
manager, the cache resolver — so that a class with several cached methods declares them once.
The documentation is explicit that "placing this annotation on the class does not turn on any
caching operation", which matters because it looks like a class-level `@Cacheable` and reads
like one. On a class with a single cached method it adds nothing and moves information away
from the method that uses it.

**★ You have `@CacheEvict` on the service method and entries are still stale. Where would you
look?**
At the write paths that do not go through that method. In practice that is a batch job calling
the repository directly, a second service writing to the same table, a Flyway migration, or a
manual fix applied during an incident. None of them execute your annotation and none of them
produce an error. This is the argument for invalidating on an event rather than on a method:
an annotation covers the call sites that existed when it was written, and the ones added later
are exactly the ones nobody remembers to check.

**★ Is there a case for no eviction at all — TTL only?**
Yes, and it is cleaner than it looks, provided the staleness budget really tolerates the full
TTL. TTL-only invalidation has one enormous advantage: it cannot be forgotten by a write path
that does not know the cache exists, which is the failure mode that actually bites. The cost is
that the data is stale for the whole window after every write, including a write the user just
made and is watching for. So it works for reference data changed by a human occasionally, and
it fails for anything a user edits and immediately re-reads.

{/* FOOTER */}
