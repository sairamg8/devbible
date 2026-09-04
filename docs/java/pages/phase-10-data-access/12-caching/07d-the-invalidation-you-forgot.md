---
title: "Every `@CacheEvict` in the codebase names a key somebody was thinking about, so the entries that go stale are the ones nobody connected to the write — the count, the list, the far side of the association and the row a cascade deleted"
sidebar_label: "7d · The invalidation you forgot"
sidebar_position: 27
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the Spring Framework 7.0 reference *Cache Abstraction →
> Declarative Annotation-based Caching*, *The `@CacheEvict` Annotation* and *The `@Caching`
> Annotation*
> ([docs.spring.io/spring-framework/reference/integration/cache/annotations.html](https://docs.spring.io/spring-framework/reference/integration/cache/annotations.html)),
> the `CacheEvict` javadoc
> ([docs.spring.io/spring-framework](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/cache/annotation/CacheEvict.html))
> and the Hibernate ORM 7.4 *Introduction* §2 *Bidirectional associations* and §8.7 *The
> second-level cache*
> ([docs.hibernate.org/orm/7.4/introduction/](https://docs.hibernate.org/orm/7.4/introduction/html_single/Hibernate_Introduction.html)).
> JDK 25, Spring Boot 4.1.1, Spring Framework 7.0, Hibernate ORM 7.4.1, PostgreSQL 18.

**[7](07-invalidation.md) is about an eviction firing at the wrong instant and
[7c](07c-getting-the-eviction-right.md) is about firing it at two better ones. Both assume you
wrote the eviction. This chunk is about the entries for which nobody wrote one — and they are the
majority, because evictions are authored by reading the write path while staleness is produced by
every read path the write path never mentions.**

## The asymmetry that produces every bug in this chunk

You write `@CacheEvict(key = "#profile.id")` because you are looking at a method that changes
profile 42, and the key you can see from there is 42. The cache, meanwhile, contains entries keyed
by whatever every `@Cacheable` method in the application happened to be keyed by: `"active"`,
`"tenant-7"`, `SimpleKey.EMPTY`, a department id, a permission-set hash, a date range. **None of
those keys mention profile 42, and nothing in the language, the type system or the build connects
them.**

So the discipline is inverted from how it is usually taught. Do not ask "what does this write
invalidate?" — you will answer with the row you are holding. Ask **"which cached answers could
change as a result of this row changing?"**, and the only honest way to answer is to have the list
of cached answers in front of you. What follows is the taxonomy of what is on that list and never
gets evicted. The writes that never reach the cache at all — bulk statements, migrations, other
programs — are [7e](07e-the-writes-the-cache-never-sees.md).

## 1 · The derived entry

The cache holds something computed *from* the row, under a key that is not the row's key.

```java
@Cacheable(cacheNames = "departmentHeadcount", key = "#departmentId")
public long headcount(long departmentId) { … }

@Cacheable(cacheNames = "orgSummary")      // SimpleKey.EMPTY — one entry, no arguments
public OrgSummary summary() { … }
```

An employee moves department. The write path evicts `employees::#id`, correctly. It does not evict
`departmentHeadcount::7`, `departmentHeadcount::9`, or `orgSummary`, because the method that moved
the employee never saw those numbers and the author never thought about them.

The tell for this family is a `@Cacheable` method whose **return type is not the entity and whose
key is not the entity's identifier** — a count, a total, a top-N list, a report, a rendered
summary. Every one of those is a fan-in: many rows contribute to one entry, so many writes must
invalidate it, and each of those writes lives in a different file.

The no-argument case is worth naming separately. `@Cacheable("orgSummary")` with no parameters
produces a single entry under `SimpleKey.EMPTY` ([3 · Keys](03-keys.md)), which reads as harmless
because there is only one of them. It is the most dependent entry in the system: *every* write to
any contributing table makes it wrong.

## 2 · The collection entry

The most common instance of the derived entry, and worth separating because it looks so harmless:

```java
@Cacheable("products")
public Product byId(long id) { … }

@Cacheable("productsByCategory")
public List<Product> inCategory(String category) { … }
```

Publishing a product evicts `products::#id`. `productsByCategory::"toys"` still holds the old list
— and it is stale in **three** different ways, each of which needs a different write to notice it:

1. an existing member's fields changed;
2. a new row should have appeared in the list;
3. a row should have **left** the list, because its category changed.

Case 3 is the one that gets missed. Evicting the *new* category is obvious from the method
arguments; evicting the **old** one requires knowing what the value was before the write.

```java
@Caching(evict = {
    @CacheEvict(cacheNames = "products",           key = "#product.id"),
    @CacheEvict(cacheNames = "productsByCategory", key = "#product.category"),
    @CacheEvict(cacheNames = "productsByCategory", key = "#previousCategory")
})
public Product recategorise(Product product, String previousCategory) { … }
```

> *"Sometimes, multiple annotations of the same type (such as `@CacheEvict` or `@CachePut`) need to
> be specified — for example, because the condition or the key expression is different between
> different caches. `@Caching` lets multiple nested `@Cacheable`, `@CachePut`, and `@CacheEvict`
> annotations be used on the same method."*

⚠️ `#previousCategory` has to be a **parameter**. A `key` expression sees the arguments, the target
and — after invocation only — `#result`; it cannot see a value the body computed, and it cannot see
`#result` at all under `beforeInvocation = true` ([7c](07c-getting-the-eviction-right.md)). Cache
invalidation has just changed the signature of a business method, and that is a real cost worth
weighing against not caching the list.

## 3 · The far side of an association

A bidirectional association has two entities and one foreign key, and the cached read is usually on
the side that does not own it.

```java
@Cacheable(cacheNames = "publishers", key = "#id")
public PublisherView withBooks(long id) { … }   // the view embeds publisher.books
```

Moving a book to a different publisher is a write to `Book.publisher` — the owning side. Nothing in
that method mentions a publisher *view*, and there are **two** publishers to invalidate, not one:
the old one lost a book and the new one gained one. Hibernate makes the same point about its own
cache when explaining why you should maintain both sides in memory:

> *"For example, if the collection `Publisher.books` was stored in the second-level cache, we must
> also modify the collection, to ensure that the second-level cache remains synchronized with the
> database."*

The general rule: **a cached value that transitively contains another entity inherits every write
path of that entity.** Caching an aggregate is caching the write paths of everything inside it, and
the annotation shows you none of them. This is the concrete reason a DTO assembled from three
entities is a worse cache candidate than any one of the three — it has three times the
invalidation surface and one key.

## 4 · Cascades, orphans and the row nobody deleted

`cascade = REMOVE` and `orphanRemoval = true` delete rows that your method body never names. If
those child rows have their own cached entries — and they do, if anything caches them by id — there
is a delete with no corresponding eviction, and the surviving entry is a cached object for a row
that no longer exists. The read then returns a plausible-looking value that no `SELECT` would ever
produce again, which is strictly worse than a `null`, because a `null` has a code path.

A database-level `ON DELETE CASCADE` is the same failure with less warning: the rows disappear
without Hibernate issuing a statement for them at all, so even a statement log shows nothing.

⚠️ And note what `@CacheEvict` on the delete method can and cannot express. It can evict the parent
key you passed in. It cannot enumerate the children, because the method signature does not contain
them — so either the service loads the children in order to evict them, which is work the cascade
existed to avoid, or the child cache gets cleared wholesale, or it goes stale.

## 5 · The entry a `@CachePut` refreshed into the wrong shape

A subtler one. `@CachePut` always runs the method and always writes the result, which makes it look
like the safe way to keep a cache warm across a write. It only works when the value the write path
returns is **identical in shape** to the value the read path caches.

```java
@Cacheable(cacheNames = "products", key = "#id")
public ProductDetail detail(long id) { … }          // rich view

@CachePut(cacheNames = "products", key = "#product.id")
public Product save(Product product) { … }          // the entity
```

Same cache, same key, two different types. The write does not go stale — it goes **wrong**, and the
next read either gets a `ClassCastException` or, on a serializing store, a deserialization failure
([5b](05b-serialization-is-the-hard-part.md)). This is the failure that [2c](02c-put-evict-and-the-rest.md)
argues from the write side; from the invalidation side the lesson is that `@CachePut` is only an
invalidation strategy when one method owns the cache's value type, and that is a constraint nothing
enforces.

## Gotchas

**★ Evictions are written from the write path and staleness comes from the read paths.** The key
you can see while writing the eviction is the row you are holding; the keys that go stale belong to
methods in other files, written by other people.

**★ Any `@Cacheable` whose key is not the entity's identifier is a fan-in.** Counts, totals, lists,
summaries and reports are contributed to by many rows, so each one needs invalidating from many
unrelated write paths.

**★ A no-argument `@Cacheable` is the most fragile entry in the system.** One entry under
`SimpleKey.EMPTY` looks trivial and is invalidated by every write to every table it reads.

**★ A list cache goes stale three ways and only one of them is a field change.** A member's data
changing, a new member appearing, and a member leaving all invalidate it — and the last one needs
the *previous* value of the grouping column.

**★ A `key` expression cannot see a value the method computed.** Evicting the old grouping key means
passing it in as a parameter, so cache invalidation has changed a business method's signature — and
`#result` is unavailable entirely when `beforeInvocation = true`.

**★ A write to the owning side invalidates two keys on the unowned side.** The old parent lost a
child and the new parent gained one; the method arguments name only the new one.

**★ Caching an aggregate inherits the write paths of everything inside it.** A DTO assembled from
three entities has three invalidation surfaces and one key, and the annotation shows none of that.

**★ `cascade = REMOVE`, `orphanRemoval` and `ON DELETE CASCADE` delete rows your method never
names.** Cached entries for those rows survive the delete, and a cached object for a deleted row is
worse than a miss because no code path treats it as absent.

**★ Evicting cascaded children means loading them, which is the work the cascade avoided.** The
choice is real: pay the load, clear the child cache wholesale, or serve stale children.

**★ `@CachePut` and `@Cacheable` on the same cache must agree on the value type.** Two methods
writing different shapes under the same key produce a class-cast or deserialization failure on the
next read, not a stale value.

**★ Nothing on this list produces an error at the time of the mistake.** Every failure here is a
successful response containing an old value, which is why the discovery mechanism is a user report
and the detection mechanism has to be built deliberately
([7e](07e-the-writes-the-cache-never-sees.md)).

## Interview questions

**★ You have added `@Cacheable` to a `findById`. What else in the application must now change?**
Every write path that can change that row, and every *other* cached method whose answer depends on
it. The first is usually done; the second almost never is. Concretely: the list method cached under
a category or status, the count or summary cached with no arguments at all, the aggregate view that
embeds the entity, and any cache keyed on something derived from it. The annotation is one line and
the obligation it creates is a list I have to enumerate by hand, because nothing in the type system
or the build connects a `@Cacheable` to the writes that invalidate it.

**★ Why is a cached `List` harder to invalidate than a cached entity?**
Because it is invalidated by three different kinds of write instead of one. A member's fields
changing makes the list's contents stale; a new row appearing makes the list incomplete; and a row
whose grouping value changed makes it wrong in two places at once — it must leave the old list and
join the new one. That third case is the one that gets missed, because evicting the new key is
obvious from the method arguments and evicting the old key requires knowing what the value was
before the write. In practice that means reading the previous value or passing it in as a
parameter, so caching the list has changed the signature of the method that writes. That is usually
the moment to ask whether the list needed caching.

**★ What is wrong with caching a rich DTO assembled from several entities?**
Its invalidation surface is the union of the write paths of every entity inside it, and its key
mentions only one of them. A `PublisherView` containing books is invalidated by a write to a book,
by a book moving publisher — which invalidates two keys — by an author rename if the view shows
authors, and by anything a cascade removes. None of those write paths has any syntactic connection
to the cache. A cache of individual entities by id has a much smaller invalidation surface, at the
cost of assembling the view on every read; that is usually the better trade, and if assembly is the
expensive part the honest fix is to make assembly cheaper rather than to freeze its output.

**★ You cache a parent by id and the delete cascades to children. What breaks?**
The children's cache entries. The delete method's `@CacheEvict` can name the parent key because it
is an argument; it cannot name the children, because the signature does not contain them and the
whole point of the cascade was not to load them. So the child entries survive a delete of the rows
they describe, and the next read returns a fully-formed object for a row that no longer exists —
which is worse than a miss, because every caller has a branch for "not found" and none has a branch
for "found, but it was deleted". A database-level `ON DELETE CASCADE` is the same problem with even
less visibility, since Hibernate issues no statement for those rows at all.

**★ Is `@CachePut` a way to avoid invalidation?**
Only under a condition nobody writes down: that the value the write path produces is the same type,
and the same shape, as the value the read path caches. If `detail(id)` caches a rich projection and
`save(product)` puts the entity under the same cache and key, the cache now holds two incompatible
shapes and the next read fails on a cast or on deserialization rather than merely being stale. When
the shapes do match, `@CachePut` is genuinely better than an evict because it leaves the cache warm
and removes the stale-repopulation race from [7](07-invalidation.md) — but the precondition is that
exactly one method owns that cache's value type, and nothing enforces it.

{/* FOOTER */}
