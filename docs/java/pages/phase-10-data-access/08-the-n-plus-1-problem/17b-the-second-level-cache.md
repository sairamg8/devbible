---
title: "The second-level cache can genuinely collapse the N queries, and it is still not the fix — because it needs three separate opt-ins to work at all, and does nothing on the cold cache that is exactly when the page is slow"
sidebar_label: "17b · The second-level cache"
sidebar_position: 58
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 *User Guide* §14 *Caching* — §14.1
> configuration, §14.2 *Configuring second-level cache mappings*, §14.4 *Entity cache*,
> §14.5 *Collection cache*, §14.6 *Query cache* and the query cache layout section — and
> §31.7 *Caching*
> ([docs.hibernate.org/orm/7.4/userguide/](https://docs.hibernate.org/orm/7.4/userguide/html_single/Hibernate_User_Guide.html)),
> plus Jakarta Persistence 3.2 §11.1.7 `Cacheable`
> ([jakarta.ee/specifications/persistence/3.2/](https://jakarta.ee/specifications/persistence/3.2/)).
> JDK 25, Spring Boot 4.1.0, Hibernate ORM 7.4.1.

**This is the one entry in the "not a fix" section that actually works. Warm the second-level
cache and the N per-row selects genuinely stop reaching the database. What it costs is not a
detail: three separate opt-ins that people routinely get half-right, a set of invalidation and
staleness properties you now own, and the fact that its benefit is exactly inverted against
when you need it — a cold cache after a deploy is the moment the page is slowest, and the
moment the cache does nothing.**

## Hibernate's own position

Before anything else, §14.2 states the default and the recommendation in one sentence:

> *"By default, entities are not part of the second level cache and **we recommend you to stick
> to this setting**."*

And §31.7 lists what to do first, in order, before reaching for one at all:

> *"tuning the underlying database cache so that the working set fits into memory, therefore
> reducing Disk I/O traffic. optimizing database statements through JDBC batching, statement
> caching, indexing can reduce the average response time… database replication is also a very
> valuable option to increase read-only transaction throughput."*

A second-level cache is presented as what you do **after** the database is tuned, not as a way
to avoid tuning it. That framing is the single most useful thing to take from the chapter,
because "add a cache" is almost always proposed as an alternative to understanding the query.

## What it would take to fix an N+1 with it

Three opt-ins, and the second and third are the ones that get missed.

**1 · Turn the cache on.** `hibernate.cache.use_second_level_cache` plus a provider — JCache,
Infinispan, Ehcache. In Boot that is `spring.jpa.properties.hibernate.cache.*` and a provider
dependency.

**2 · Mark the entity cacheable.** The default `jakarta.persistence.sharedCache.mode` is
`ENABLE_SELECTIVE` — "entities are not cached unless explicitly marked as cacheable (with the
`@Cacheable` annotation)" — and the guide calls it the "Default and recommended value". So
`@Cacheable` plus `@org.hibernate.annotations.Cache(usage = …)` on `OrderLine`.

**3 · Mark the *collection* cacheable, separately.** §14.5:

> *"Hibernate can also cache collections, and the `@Cache` annotation must be on added to the
> collection property."*

```java
@OneToMany(mappedBy = "order")
@org.hibernate.annotations.Cache(usage = CacheConcurrencyStrategy.READ_WRITE)
private List<OrderLine> lines = new ArrayList<>();
```

**And here is the detail that decides whether any of this helps:**

> *"If the collection contains other entities (`@OneToMany` or `@ManyToMany`), **the collection
> cache entry will store the entity identifiers only.**"*

So a cached collection gives you a list of ids. Hibernate then has to turn those ids into
entities — from the **entity** cache if `OrderLine` is cached, and from the database if it is
not. **Caching the collection and forgetting the entity converts one query per parent into one
query per parent's-worth-of-children-by-id, which is not an improvement.** This is the single
most common way the "just add a cache" fix is applied and measured as ineffective.

## What you have taken on

**A concurrency strategy, chosen per entity.** §14.2 lists four. `read-only` for data that never
changes. `read-write`, which "provides consistent access to single entity, but not a serializable
transaction isolation level". `nonstrict-read-write`, where "there might be occasional stale
reads upon concurrent access". `transactional`, which "provides serializable transaction
isolation level" and needs JTA. §31.7 recommends `READ_WRITE` as a default and is explicit that
`NONSTRICT_READ_WRITE` "offers a weaker consistency guarantee since stale updates are possible".

**Collection cache invalidation, which is coarse.** §14.5: *"The collection cache is not
write-through so any modification will trigger a collection cache entry invalidation. On a
subsequent access, the collection will be loaded from the database and re-cached."* Add one line
to an order and that order's whole cached collection is thrown away. On a write-heavy
association the cache is invalidated faster than it is populated, and you have paid for it in
memory and in complexity for a hit rate near zero.

**A documented staleness hole on bidirectional associations.**
`hibernate.cache.auto_evict_collection_cache` "enables or disables the automatic eviction of a
bidirectional association's collection cache entry when the association is changed just from the
owning side. **This is disabled by default**, as it has a performance impact to track this
state. However, if your application does not manage both sides of bidirectional association
where the collection side is cached, the alternative is to have stale data in that collection
cache." So the "keep both sides in step" discipline from topic 07
([../07-relationships-fetch/02c-keeping-both-sides-in-step.md](../07-relationships-fetch/02c-keeping-both-sides-in-step.md))
stops being hygiene and becomes a correctness requirement the moment you cache a collection.

**Cluster coherence.** §31.7 notes that with clustering "the second-level cache entries are
spread across multiple nodes", and that with Infinispan distributed caching "only `READ_WRITE`
and `NONSTRICT_READ_WRITE` are available for read-write caches". Multi-instance deployments
change which strategies are even available to you.

## The query cache makes it worse before it makes it better

The query cache is a separate feature (off by default; `hibernate.cache.use_query_cache`, plus
`org.hibernate.cacheable` per query) and it has a property that is directly an N+1 hazard.

The guide describes the cache *layout*: an entity in the query cache is stored either with all
its data (`FULL`) or "with just the identifier or collection owner key" (`SHALLOW`), and the
default `AUTO` chooses `SHALLOW` for entities and collections that are cacheable. Then:

> *"The shallow query cache layout is hence only effective for entities/collections for which
> such a second level cache exists, and only if there is a very high cache hit rate i.e. few
> cache invalidations. **Whenever a shallow cached entity/collection can not be found in the
> second level cache, Hibernate ORM will load the data from the database by identifier or
> collection owner key respectively, which can lead to a lot of additional queries** if the
> second level cache does not have a high cache hit rate."*

A query cache hit whose entity cache has since been invalidated therefore produces **a load per
identifier** — an N+1 created by the caching layer, on a code path that has no loop in it and no
lazy association being dereferenced. It is the hardest version of this bug to find, because
nothing in your code changed and the trigger is a cache eviction.

## The argument that actually settles it

**A cache changes the mean and leaves the tail.** The page that N+1s at 101 statements still
issues 101 statements on a cold cache — after every deploy, every eviction, every new instance
joining the pool, and for every key that has not been requested yet. Those are exactly the
moments a system is under stress: a restart during an incident, a scale-up under load, a cache
region that just expired.

So a cache is not a fix for N+1 in the sense the rest of this topic means "fix". It is a way of
making a known cost less frequent. It does not change what the endpoint does; it changes how
often the endpoint does it. Every other fix in this topic — a fetch join, a graph, a batch size,
a projection — changes the statement count **unconditionally**, cold or warm.

Which does not make caching wrong. It makes it a *second* decision, taken after the fetch plan
is right, for data with a genuinely high read-to-write ratio. **Fix the fetch plan, then decide
whether to cache.** A cache applied to a correctly-fetched query is a real improvement; a cache
applied to an N+1 is a way of not knowing you have one.

## Gotchas

**★ Caching the collection without caching the target entity does almost nothing.** The
collection cache entry stores identifiers only, so the ids come from memory and the entities
still come from the database.

**★ `ENABLE_SELECTIVE` is the default, so `@Cacheable` is not optional.** Enabling the
second-level cache in configuration and forgetting the annotation caches nothing at all, and the
symptom is that the cache appears to be working (no errors) and helping (no measurable change).

**★ A warm cache can make an N+1 test pass.** The statement-count assertion from
[6b · Asserting the count](06b-asserting-the-count-in-a-test.md) counts statements Hibernate
executed; cache hits do not execute any. A test suite with a shared cache and a fixture that ran
earlier can be green over a genuine N+1. Assert on a cold cache, or disable the second-level
cache in the test profile.

**★ Any modification invalidates the whole collection cache entry.** Not the changed element —
the entry. One insert throws away the cached collection for that parent.

**★ `hibernate.cache.auto_evict_collection_cache` is off by default and its absence means
stale reads.** If your code sets only the owning side of a bidirectional association and the
inverse side is cached, the cached collection is wrong and nothing tells you.

**★ The query cache's default `SHALLOW` layout can manufacture an N+1.** A query cache hit whose
entities have been evicted loads them by identifier — "a lot of additional queries", from a code
path that contains no loop.

**★ `nonstrict-read-write` permits stale *updates*, not just stale reads.** The guide's wording
in §31.7 is "stale updates are possible". It is the cheap-looking strategy and the one whose
failure mode is data, not latency.

**★ Concurrency strategy is fixed at the root of an inheritance hierarchy.** `@Cacheable` can be
overridden per subclass since 5.3, but "the Hibernate cache concurrency strategy… is still
defined at the root entity level and cannot be overridden".

**★ It hides the bug from everyone who comes after you.** A cached N+1 is invisible in
production metrics on a warm system, so the next person to touch the query has no signal that it
was ever a problem — until they change something that evicts.

## Interview questions

**★ Can the second-level cache fix an N+1?**
It can genuinely stop the N queries reaching the database, which is more than most of the things
in this section can claim. It cannot stop them being *issued* on a cold cache, so it moves the
cost rather than removing it, and the moments it fails to help — a fresh deploy, a scale-up, an
eviction storm — are exactly the moments the system is already under pressure. I would treat it
as a second-order optimisation applied after the fetch plan is right, never as the fix. A cache
in front of a correct query is a tuning decision; a cache in front of an N+1 is a way of not
finding out.

**★ You enabled the second-level cache and the collection is still hitting the database. Why?**
Most likely two things. The collection needs its own `@Cache` annotation on the property — the
entity's annotation does not cover it. And even with that, the collection cache entry for a
`@OneToMany` "will store the entity identifiers only", so if the target entity is not itself
cacheable, Hibernate reads ids from the cache and then loads every one of them from the database.
Both opt-ins are needed, and missing the second is the usual cause of a cache that appears
enabled and ineffective.

**★ How can a cache create an N+1 that did not exist before?**
Through the query cache's default layout. `AUTO` selects `SHALLOW` for cacheable entities, meaning
the query cache stores identifiers rather than data, and resolves them through the entity cache
on read. If those entity cache entries have been evicted — a write, a region expiry, a restart of
another node — Hibernate falls back to loading each one by identifier, which the guide warns "can
lead to a lot of additional queries". The code contains no loop and no lazy dereference, which
makes it the hardest shape in this topic to attribute.

**★ Your N+1 regression test is green in CI and the bug is in production. What would you check?**
Whether a cache is making the test pass. Statement-count assertions count what Hibernate executed,
and a second-level cache hit executes nothing — so a test running after a fixture that warmed the
cache, or in a suite sharing a `SessionFactory`, can be green over a genuine N+1. I would disable
the second-level cache in the test profile outright, so that the assertion measures the fetch plan
rather than the cache hit rate. The same reasoning applies to the persistence context: a test that
loads the parents and then asserts must not have already initialised the associations.

**★ What does the second-level cache cost that people do not budget for?**
Invalidation semantics that are now yours. A concurrency strategy per entity with real
consistency differences between them, including one — `nonstrict-read-write` — where the guide
says stale *updates* are possible. Collection cache entries that are invalidated wholesale on any
modification, so a write-heavy association gets a hit rate near zero for real memory cost. A
documented staleness hole on bidirectional associations unless you either manage both sides
rigorously or enable an eviction setting that is off by default for performance reasons. And in a
cluster, restrictions on which strategies are even available. None of that is exotic; all of it
arrives with the decision.

**★ Hibernate recommends leaving entities out of the cache by default. Do you agree?**
Yes, and for the reason its own performance chapter gives: the alternatives should be exhausted
first. Tuning the database so the working set is in memory, indexing, JDBC batching, and read
replicas all reduce response time without adding a second copy of your data with its own
consistency model. A second-level cache earns its place for data with a high read-to-write ratio
that is expensive to fetch and tolerant of some staleness — reference data, catalogues,
configuration. Reaching for it to fix a query shape is solving the wrong problem with the most
expensive available tool.

**★ Does the second-level cache help a report that reads a month of orders once?**
No, and it is worth being precise about why: it can only help on a second read. A monthly report
touches each order once, so every lookup is a miss, and you have paid the cost of populating the
cache with data nobody will read again before it is evicted — plus, if the orders are being
written, the invalidation traffic. Caches earn their place on a high read-to-write ratio for the
*same* keys. A sequential scan over a large key space is the shape they help least, and it is the
shape most likely to evict everything that was helping other endpoints.

**★ What does `@Cache(include = "non-lazy")` do and when would you want it?**
It excludes lazy properties from the second-level cache entry; the guide gives the default as
`all`, meaning lazy properties *are* cached. You want `non-lazy` on an entity that has a large
lazy column — the whole point of making the column lazy was to stop moving it around, and the
default puts a copy of it in every cache node. It is a small setting with a large effect on memory,
and it is easy to miss because the two features are documented in different chapters and were
decided by different people at different times.

---

← Prev: [17 · Initialize loops](17-initialize-loops.md) · Index: [08 · The N+1 problem](README.md) · Next → [18 · Fetching belongs to the call site](18-fetching-belongs-to-the-call-site.md)
