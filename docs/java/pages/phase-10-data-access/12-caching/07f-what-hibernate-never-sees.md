---
title: "Hibernate's documentation says outright that the second-level cache is never aware of changes made externally to Hibernate, and the two remedies it offers are explicit invalidation and a TTL — one of which is unavailable exactly when you need it"
sidebar_label: "7f · What Hibernate never sees"
sidebar_position: 29
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 *User Guide* §14 *Caching*, §14.8 *Managing the
> cached data* and §13.3 *Hibernate Query Language for DML*
> ([docs.hibernate.org/orm/7.4/userguide/](https://docs.hibernate.org/orm/7.4/userguide/html_single/Hibernate_User_Guide.html)),
> the Hibernate ORM 7.4 *Introduction* §8.7 *The second-level cache*
> ([docs.hibernate.org/orm/7.4/introduction/](https://docs.hibernate.org/orm/7.4/introduction/html_single/Hibernate_Introduction.html)),
> the `SynchronizeableQuery`, `Synchronize` and `Cache` javadoc
> ([docs.jboss.org/hibernate/orm/7.4/javadocs](https://docs.jboss.org/hibernate/orm/7.4/javadocs/org/hibernate/query/SynchronizeableQuery.html))
> and the Jakarta Persistence 3.2 specification §4.11 *Bulk Update and Delete Operations*
> ([jakarta.ee/specifications/persistence/3.2](https://jakarta.ee/specifications/persistence/3.2/jakarta-persistence-spec-3.2.html)).
> JDK 25, Spring Boot 4.1.0, Hibernate ORM 7.4.1, PostgreSQL 18.

**[7e](07e-the-writes-the-cache-never-sees.md) is the same problem for the Spring cache abstraction,
where at least you can see the annotation that is missing. Hibernate's second-level cache is worse in
one specific way: nothing in your code declares it at the point of use, so a stale entity arrives
through an ordinary `findById` in a method that contains no caching vocabulary at all. Hibernate's
documentation is unusually blunt about the boundary, and it is worth reading as written.**

## The sentence to know by heart

> *"The second-level cache is never aware of any changes to data which are made externally to
> Hibernate. Updates made via direct JDBC — or by some other program — are never visible in the
> second-level cache. When such updates occur, we might need to explicitly invalidate cached data.
> Alternatively, in cases where the program is able to tolerate somewhat stale data, an expiry policy
> might be an acceptable solution."*

and the user guide's version, which arrives before any configuration is discussed:

> *"Be aware that Hibernate caches are not aware of changes made to the persistent store by other
> applications. To address this limitation, you can configure a TTL (Time To Live) retention policy
> at the second-level cache region level so that the underlying cache entries expire regularly."*

Both passages offer exactly two remedies — explicit invalidation, or a TTL — and **only the second is
available when you do not control the writer.** That is the whole practical content of this chunk: if
anything other than this `SessionFactory` writes those tables, the region needs an expiry policy, and
that policy is configured in the cache provider's own configuration file rather than anywhere in your
Java code ([6d](06d-turning-it-on.md)).

The same guide is equally direct about why it is off by default:

> *"By nature, a second-level cache tends to undermine the ACID properties of transaction processing
> in a relational database. We don't use a distributed transaction with two-phase commit to ensure
> that changes to the cache and database happen atomically. So a second-level cache is often by far
> the easiest way to improve the performance of a system, but only at the cost of making it much more
> difficult to reason about concurrency. And so the cache is a potential source of bugs which are
> difficult to isolate and reproduce."*

## Explicit invalidation: two APIs, very different granularity

Jakarta Persistence gives you entities and nothing else:

```java
entityManager.getEntityManagerFactory().getCache().evict(Person.class);
```

Hibernate's own `Cache` gives you four axes:

> *"Hibernate is much more flexible in this regard as it offers fine-grained control over what needs
> to be evicted. The `org.hibernate.Cache` interface defines various evicting strategies: entities
> (by their class or region), entities stored using the natural-id (by their class or region),
> collections (by the region, and it might take the collection owner identifier as well), queries (by
> region)."*

```java
session.getSessionFactory().getCache().evictQueryRegion("query.cache.person");
```

Three things follow that are easy to get wrong.

**Eviction is a `SessionFactory`-level operation and the javadoc is explicit that it ignores your
transaction:**

> *"None of the operations of this interface respect any isolation or transactional semantics
> associated with the underlying caches. In particular, eviction via the methods of this interface
> causes an immediate 'hard' removal outside any current transaction and/or locking scheme."*

So the ordering problem from [7](07-invalidation.md) applies here in full — an evict issued inside an
uncommitted transaction is visible to everyone immediately, and a concurrent reader repopulates the
region from the pre-write rows. The answer is the same: evict after the commit, and evict again if
you care.

**It is per-JVM unless the provider is distributed.** `getCache().evict(...)` on one pod clears that
pod's regions. With a local JCache provider the other pods are untouched
([7b](07b-caching-in-a-cluster.md)).

**A collection region is separate from its owner's region.** Evicting `Publisher` does not evict
`Publisher.books`; the guide lists the regions as "one for each mapped entity hierarchy or collection
role", with `Author`, `Book`, `Author.books` and `Book.authors` as separate examples. A parent whose
children changed needs the collection role evicted by name.

**And the reverse trap exists if you shared a region.** `@Cache(region = "…")` lets several entities
land in one region, which sounds tidy and is the Hibernate equivalent of the catch-all `"lookups"`
cache from [7e](07e-the-writes-the-cache-never-sees.md):

> *"If multiple entities or roles are mapped to the same cache region, they share policies and even
> the same FIFO-type expiry queue (if any). This sounds useful, but comes with the downside that
> `evictEntityData(Class)` for any one of the entities evicts all entities mapped to the same region.
> It's therefore much more common to have a distinct region for each entity and role."*

There is also a refresh primitive with no equivalent in Spring's abstraction, argued in
[6b2](06b2-cache-modes-and-when-its-right.md); the user guide motivates it in exactly the terms of
this chunk:

> *"This behavior is particularly useful in cases when the underlying data may have been updated via a
> separate process and is a far more efficient alternative to the bulk eviction of the region via
> `SessionFactory` eviction."*

## Native SQL, and the tables Hibernate does not know about

Native SQL goes *through* Hibernate and may still not be understood by it. Hibernate tracks which
**query spaces** — usually tables — a statement touches, and uses that set for two separate jobs:

> *"When auto-flush is enabled, in-memory changes to every dirty entity whose state belongs to any
> query space which affects a given query must be flushed before the query is executed. Conversely,
> when changes to an entity whose state is stored in a given query space are flushed to the database,
> every cached query result set for a query affected by that query space must be immediately
> invalidated."*

Read the second half carefully: **query-cache invalidation is driven entirely by the query-space set.**
If Hibernate does not know a table is involved, no cached result over that table is ever invalidated.

> *"Usually, the query spaces are automatically determined by the mapping, but sometimes they must be
> specified explicitly using `@Synchronize`."*

The `@Synchronize` javadoc names the cases where the mapping is not enough:

> *"If Hibernate is not aware that a certain table holds state mapped by an entity class or
> collection, then modifications might not be automatically synchronized with the database before a
> query is executed against that table, and the query might return stale data."*

listing them as an entity or collection that **maps a database view**, one **persisted using
handwritten SQL** via `@SQLSelect` and friends, or one mapped with **`@Subselect`**.

```java
@Entity
@Subselect("select p.id as id, count(b.id) as book_count from publisher p left join book b on …")
@Synchronize({"publisher", "book"})       // without this, writes to book never invalidate
class PublisherStats { … }
```

Those three mappings are exactly what people reach for when the cached read is a report — which is
precisely the shape [7d](07d-the-invalidation-you-forgot.md) identifies as the most invalidated
thing in the system. The overlap is not a coincidence: the harder a read is to express, the more
likely it is mapped in a way Hibernate cannot introspect, and the more likely somebody cached it.

On the writing side, `NativeQuery` exposes the same set programmatically —
`addSynchronizedQuerySpace`, `addSynchronizedEntityClass`, `addSynchronizedEntityName` — and the
javadoc for the first states both effects:

> *"Add a query space. The effect of this call is to: force an auto-flush if any entity associated
> with the current session and mapped to the given query space has pending changes which have not yet
> been synchronized with the database, and if the result set of this query is cached, mark it for
> invalidation when any entity mapped to the given query space is synchronized with the database in
> any session."*

## The bulk-DML question I could not settle

An HQL or JPQL bulk `update`/`delete` is not external to Hibernate — it is issued through the
`EntityManager` — so the "changes made externally" sentence does not cover it. The specification
addresses the persistence context and stops there:

> *"The persistence context is not synchronized with the result of the bulk update or delete."*

⚠️ **The 7.4 user guide's DML chapter does not say whether the second-level cache regions of the
affected entity are invalidated, and I could not find a statement in the reference documentation that
settles it either way.** Do not build a design on an assumption in either direction. The safe
practice, which is correct under both answers, is to evict the affected regions yourself after the
statement — and after the commit, not before it:

```java
@Transactional
public void deactivateStale(Instant before) {
    repository.deactivateOlderThan(before);           // @Modifying bulk update
    TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
        @Override public void afterCommit() {
            sessionFactory.getCache().evictEntityData(Product.class);
        }
    });
}
```

The same reasoning applies to `StatelessSession` work and to anything issued through
`Session.doWork`: if you cannot point at documentation saying the cache was invalidated, evict.

## Gotchas

**★ Hibernate says outright that its second-level cache never sees external writes**, and offers
exactly two remedies — explicit invalidation, or a region-level TTL. Only the second one works when
you do not control the writer.

**★ The stale value arrives through code containing no caching vocabulary.** A plain `findById` in a
plain service returns a cached row; unlike `@Cacheable`, there is nothing at the call site to
remind a reader that a cache is involved.

**★ A region-level TTL is configured in the provider's file, not in your Java or your
`application.yaml`.** It is therefore invisible to everyone reading the entity, and it is the one
setting that bounds the damage.

**★ JPA's `Cache` interface can only evict entities.** Collections, natural ids and query regions
need Hibernate's `org.hibernate.Cache`, reached by unwrapping.

**★ A collection role is its own region.** Evicting `Publisher` does not evict `Publisher.books`; the
guide lists them as separate regions with separate policies.

**★ Cache eviction through the `SessionFactory` is not transactional**, and the javadoc says so:
eviction *"causes an immediate 'hard' removal outside any current transaction and/or locking
scheme"*. It has the same ordering hazard as `@CacheEvict` ([7](07-invalidation.md)) and wants the
same after-commit treatment.

**★ Sharing a region between entities makes every eviction wholesale.** `evictEntityData(Class)` for
one of them evicts all of them, and they share one expiry queue — which is why the javadoc says a
distinct region per entity and role is *"much more common"*.

**★ It is also per-JVM unless the provider is distributed.** With a local JCache provider, evicting
on one pod leaves the other pods holding the old entity ([7b](07b-caching-in-a-cluster.md)).

**★ Query-cache invalidation is driven entirely by query spaces.** A table Hibernate does not
associate with the query is a table whose writes never invalidate the cached result — silently, and
forever if there is no TTL.

**★ `@Subselect`, `@SQLSelect` and view-backed entities need `@Synchronize`.** Those are exactly the
mappings used for report-shaped reads, which are exactly the reads people cache.

**★ Whether HQL bulk DML invalidates the affected regions is not stated in the 7.4 documentation.**
Evict explicitly rather than assuming, in either direction.

**★ `NONSTRICT_READ_WRITE` admits stale reads by design.** The guide says plainly that it *"offers a
weaker consistency guarantee since stale updates are possible"*, so a strategy chosen for throughput
has quietly widened the window this whole chunk is about ([6c](06c-mapping-and-strategies.md)).

## Interview questions

**★ Hibernate's second-level cache is enabled and someone runs a `psql` `UPDATE`. What happens?**
The cache keeps serving the old row for as long as the entry lives, and nothing in Hibernate will
ever notice. The documentation is unusually direct — the second-level cache is *"never aware of any
changes to data which are made externally to Hibernate"*, and updates made via direct JDBC or by
another program *"are never visible"*. The two remedies it offers are explicit invalidation through
the `Cache` interface and a TTL expiry policy at the region level, and only the second one is
available when you do not control the writer. That is why "is anything else writing these tables?" is
the first question I ask before marking an entity `@Cache`.

**★ What is `@Synchronize` for, and how does it relate to caching?**
It tells Hibernate which tables hold the state of an entity when the mapping cannot say so — an entity
over a database view, one using `@Subselect`, or one loaded with handwritten SQL. Hibernate uses that
set of tables, the query spaces, for two things: deciding when a pending change must be auto-flushed
before a query runs, and deciding which cached query results to invalidate when a change to those
tables is flushed. Without the annotation Hibernate has no idea those tables are involved, so a query
against the view can return stale data and cached results for it are never invalidated. It matters
for caching specifically because view-backed and handwritten-SQL mappings are exactly what people use
for the report-shaped reads they most want to cache.

**★ How do you evict a single collection from the second-level cache?**
Through Hibernate's own `Cache` interface rather than JPA's, because JPA's `evict` takes an entity
class and a collection role is not one. Hibernate's interface evicts entities by class or region,
natural-id data, collections by region — optionally with the owner's identifier — and query regions
by name. The trap is assuming that evicting the owning entity also clears its collections: the guide
describes regions as one per mapped entity hierarchy *or collection role*, with `Author` and
`Author.books` as separate examples, so a parent whose children changed needs the collection role
named explicitly.

**★ Does a JPQL bulk `update` invalidate the second-level cache?**
I could not confirm that from the Hibernate 7.4 documentation, and I would not answer it from memory,
because the consequence of being wrong is silent stale data. What is documented is narrower: the
specification says the persistence context is not synchronised with the result of a bulk update or
delete, and the Hibernate documentation says the second-level cache never sees changes made
externally to Hibernate — which a JPQL statement is not. So the honest position is that it is
unsettled, and the practice that is correct under either answer is to evict the affected regions
explicitly after the commit. That costs a cold region and buys certainty.

**★ Why is a stale second-level cache harder to diagnose than a stale `@Cacheable`?**
Because there is nothing at the call site. A `@Cacheable` method announces itself in the source, so a
developer chasing a wrong value has a visible thing to suspect. The second-level cache is enabled by
a region factory in configuration and opted into by a `@Cache` annotation on the entity, and the read
that returns the stale value is an ordinary `findById` in an ordinary service. Add that the region's
expiry policy lives in the cache provider's own configuration file rather than in the application's
properties, and you have a wrong answer whose cause is spread across three files that the person
debugging has no reason to open.

**★ You are asked to enable the second-level cache on a table another team also writes to. What do
you say?**
No, or not without a TTL short enough that their writes are tolerable for that long — and I would want
the product owner to agree the number, not engineering. The documentation removes any ambiguity here:
Hibernate is never aware of changes made externally, so there is no invalidation to write and no
event to hook. The only bound is expiry. If the staleness budget turns out to be seconds, the cache
is not buying much, and the conversation should turn to why the read is expensive in the first place
— which is [8 · When not to cache](08-when-not-to-cache.md).

{/* FOOTER */}
