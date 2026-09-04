---
title: "Hibernate's second-level cache is a cache of rows by identifier, not a cache of queries — so it can eliminate the load a query causes without eliminating the query, and Hibernate's own recommendation is to leave it off"
sidebar_label: "6 · The second-level cache"
sidebar_position: 19
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 *User Guide* §14 *Caching* — the chapter
> introduction, §14.2 *Configuring second-level cache mappings*, §14.3 *Entity inheritance and
> second-level cache mapping*, §14.4 *Entity cache* and §14.5 *Collection cache*
> ([docs.hibernate.org/orm/7.4/userguide/](https://docs.hibernate.org/orm/7.4/userguide/html_single/Hibernate_User_Guide.html)),
> the chapter source on the `7.4` branch
> ([github.com/hibernate/hibernate-orm](https://github.com/hibernate/hibernate-orm/blob/7.4/documentation/src/main/asciidoc/userguide/chapters/caching/Caching.adoc)),
> and Jakarta Persistence 3.2 §11.1.7 `Cacheable`
> ([jakarta.ee/specifications/persistence/3.2/](https://jakarta.ee/specifications/persistence/3.2/)).
> JDK 25, Spring Boot 4.1.1, Hibernate ORM 7.4.1, PostgreSQL 18.

**Everything before this chunk was Spring's cache abstraction: you choose what to cache, you
choose the key, and the cache sits in front of a method. Hibernate's second-level cache is a
different thing wearing a similar name. It sits *inside* the persistence layer, it is keyed by
entity identifier and nothing else, and it is populated and invalidated by Hibernate rather than
by you. Understanding that one difference explains almost every disappointed expectation people
have of it.**

## Two caches, and the first one is not optional

> *"At runtime, Hibernate handles moving data into and out of the second-level cache in response
> to the operations performed by the `Session`, which acts as a transaction-level cache of
> persistent data. Once an entity becomes managed, that object is added to the internal cache of
> the current persistence context (`EntityManager` or `Session`). The persistence context is
> also called the first-level cache, and it's enabled by default."*

So there are two, and they have completely different lifetimes:

| | First level | Second level |
|---|---|---|
| Scope | one `EntityManager` / `Session` | the `SessionFactory` (i.e. the JVM), or a cluster if the provider is distributed |
| Lifetime | the transaction | until evicted or expired |
| Optional | no | yes, and off by default |
| Guarantees | identity — the same row is the same object | none beyond the concurrency strategy you chose |

The first-level cache is why `find()` twice in one transaction issues one `SELECT`, and it is
covered in [../06-jpa-hibernate-model/11b-find-that-issues-no-sql.md](../06-jpa-hibernate-model/11b-find-that-issues-no-sql.md).
Everything below is about the second.

## Hibernate's own position, first

Before any configuration, §14.2 states the default and the recommendation in one sentence:

> *"By default, entities are not part of the second level cache and we recommend you to stick to
> this setting."*

That is not hedging. A second-level cache is a second copy of your data with a weaker consistency
model, maintained by a component that — per the chapter's own note — cannot see everything that
changes the database:

> *"Be aware that Hibernate caches are not aware of changes made to the persistent store by other
> applications. To address this limitation, you can configure a TTL (Time To Live) retention
> policy at the second-level cache region level so that the underlying cache entries expire
> regularly."*

Read that as the same argument as [5c2](05c2-choosing-and-applying-a-ttl.md), made by Hibernate:
a TTL is the only mechanism that bounds staleness introduced by writers you do not control. Any
batch job, any `UPDATE` run by a DBA, any second application on the same schema is such a writer.

## What it caches

**Entities, by identifier, in dehydrated form.**

> *"Hibernate stores cached entities in a dehydrated form, which is similar to the database
> representation. Aside from the foreign key column values of the `@ManyToOne` or `@OneToOne`
> child-side associations, entity relationships are not stored in the cache."*

"Dehydrated" means column values, not an object graph — no proxies, no collections, no identity.
Hibernate rebuilds an entity instance per session from that data. Two practical consequences: the
cache does not hold your object references, so it cannot leak a managed entity across sessions;
and an association is only present as its foreign key, so navigating one is a separate lookup
that either hits the cache again or hits the database.

**Collections, separately, and mostly as identifiers.**

> *"Hibernate can also cache collections, and the `@Cache` annotation must be on added to the
> collection property."*

> *"If the collection is made of value types (basic or embeddables mapped with
> `@ElementCollection`), the collection is stored as such. If the collection contains other
> entities (`@OneToMany` or `@ManyToMany`), the collection cache entry will store the entity
> identifiers only."*

🔴 **Caching a collection without caching its target entity gains you almost nothing** — you get
the list of ids from memory and then load every one of them. This is the single most common way
"we added a cache and it did not help" happens, and it is argued at length in
[../08-the-n-plus-1-problem/17b-the-second-level-cache.md](../08-the-n-plus-1-problem/17b-the-second-level-cache.md).

Collections are also read-through and invalidated wholesale:

> *"Collections are read-through, meaning they are cached upon being accessed for the first
> time."*

> *"The collection cache is not write-through so any modification will trigger a collection cache
> entry invalidation. On a subsequent access, the collection will be loaded from the database and
> re-cached."*

**Natural ids.** The chapter notes the second-level cache "can also load entities by their
natural id", which is the one lookup other than the primary key that the entity cache serves
directly.

## What it does not cache

**Queries.** A JPQL or Criteria query is SQL; it goes to the database. The entity cache is
consulted when an entity is loaded *by identifier* — `find()`, initialising a proxy, navigating
a `@ManyToOne`, resolving the ids in a cached collection. A query that selects rows executes
against the database and hydrates entities from the result set.

**So the second-level cache does not reduce your query count for query-shaped work.** It reduces
it for identifier-shaped work: the per-row selects of an N+1, the proxy initialisation, the
repeated `find()` of a reference entity across many transactions. If your slow endpoint is one
badly-shaped query, the second-level cache is not the tool; a fetch join or a projection is.

Query results have their own, separate, off-by-default cache with its own invalidation machinery
— [6b · The query cache](06b-the-query-cache.md) — and it is off by default for reasons the guide
states plainly.

**Anything a writer outside Hibernate changed.** Restated because it is the assumption that
breaks systems: an `UPDATE` from a migration, a report job, another service on the same schema,
or a trigger is invisible to the cache. Hibernate invalidates on *its own* writes.

## Turning it on takes three separate opt-ins

**One — a provider.** In Hibernate 6 and 7 the enablement setting is derived, not asserted:

> *"Enable or disable second level caching overall. By default, if the currently configured
> `RegionFactory` is not the `NoCachingRegionFactory`, then the second-level cache is going to be
> enabled. Otherwise, the second-level cache is disabled."*

⚠️ This is a change from the Hibernate 5 folklore that still fills search results. You do not
"set `hibernate.cache.use_second_level_cache=true` to turn it on" — you configure a region
factory, and it turns on. Setting the flag without a provider does nothing; configuring a
provider without the flag works. The wiring is [6d · Turning it on](06d-turning-it-on.md).

**Two — mark the entity**, because the default shared-cache mode caches nothing you did not
opt in.

**Three — choose a concurrency strategy**, per entity, from four with materially different
consistency guarantees.

Those two are [6c · Mapping an entity as cacheable](06c-mapping-and-strategies.md); the provider
wiring is [6d · Turning it on](06d-turning-it-on.md).

## Gotchas

**★ The second-level cache is keyed by identifier, not by query.** It reduces per-row loads, not
query counts. An endpoint that is slow because of one badly-shaped query gets nothing from it.

**★ Hibernate's own recommendation is to leave entities out of it.** §14.2 says so in a sentence.
Enabling it is a decision that needs a reason, not a default posture.

**★ It cannot see writes made outside Hibernate.** Migrations, batch jobs, DBA fixes, triggers and
other applications on the same schema all produce staleness that only a TTL bounds.

**★ A collection needs its own `@Cache` on the collection property.** The entity's annotation does
not cover its associations.

**★ A cached `@OneToMany` stores identifiers only.** Cache the collection and forget the target
entity and you have replaced one query with one query per identifier.

**★ Any modification invalidates the whole collection cache entry.** Not the changed element — the
entry. On a write-heavy association the hit rate approaches zero at full memory cost.

**★ Nothing about it is per-cluster unless the provider is.** A JCache provider backed by an
in-process store gives every pod its own second-level cache with its own staleness — see
[7b · Caching in a cluster](07b-caching-in-a-cluster.md).

## Interview questions

**★ What is the difference between the first-level and second-level cache?**
The first-level cache is the persistence context: it is per-`EntityManager`, lives for the
transaction, is always on, and gives you identity — load the same row twice in one transaction
and you get the same object. The second-level cache is per-`SessionFactory`, so it spans
transactions and, in a distributed provider, spans nodes; it is off by default; it stores
dehydrated column values rather than objects; and it gives you no identity guarantee at all,
because each session rebuilds its own instance from the cached data. They are also invalidated by
different things: the persistence context ends with the transaction, while the second-level cache
persists until Hibernate evicts it or a TTL expires it.

**★ Does the second-level cache stop a query from running?**
Not a query, no. It is consulted when Hibernate loads an entity by identifier — `find()`,
initialising a proxy, navigating a `@ManyToOne`, resolving identifiers held in a cached
collection. A JPQL or Criteria query is compiled to SQL and executed against the database, and
the entities are hydrated from the result set. That is why "add a second-level cache" is the
wrong answer to a slow report and a plausible answer to a page that loads the same fifty
reference rows on every request. Caching query *results* is a separate feature with separate
invalidation, off by default, and off for good reasons.

**★ You enabled the second-level cache and the collection still hits the database. Why?**
Two likely causes and they compound. The collection needs its own `@Cache` annotation on the
property — the entity's annotation does not cover its associations — and even with that, a
`@OneToMany` collection cache entry "will store the entity identifiers only". So if the target
entity is not itself cacheable, Hibernate reads the identifiers from the cache and then loads
each one from the database, which is not an improvement over the query it replaced. Both opt-ins
are needed, and missing the second is the usual reason a cache appears enabled and ineffective.

**★ How does the second-level cache handle a row that another application updated?**
It does not. The chapter says outright that Hibernate caches "are not aware of changes made to
the persistent store by other applications", and the mitigation it offers is a TTL on the region
so entries expire regularly. That covers a lot of real situations — a nightly batch, a Flyway
data migration, a DBA correcting a row, a second service on the same schema, a database trigger.
It is also why I would not put an entity in the second-level cache if anything outside this
application writes it, unless the staleness window a TTL gives me is explicitly acceptable.

**★ Is the second-level cache shared across your pods?**
Only if the provider is. Hibernate's cache is at the `SessionFactory` level, which is per-JVM;
whether that extends across the cluster depends entirely on the region factory you configured. A
JCache provider backed by an in-process store — the common default — gives each pod its own
second-level cache, so an eviction on the pod that handled the write leaves the other pods with
the old row and no mechanism will ever correct them except a TTL. A distributed provider like
Infinispan changes that and brings its own constraints on which concurrency strategies are
available. The question is worth asking explicitly of any deployment, because nothing in the
mapping annotations reveals the answer.

{/* FOOTER */}
