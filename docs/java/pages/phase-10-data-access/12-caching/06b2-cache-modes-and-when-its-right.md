---
title: "Hibernate has the force-refresh primitive that Spring's cache abstraction lacks, and four conditions that between them decide whether the query cache is a win — almost nothing satisfies all four"
sidebar_label: "6b2 · Cache modes, and when it is right"
sidebar_position: 21
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 *User Guide* §14.6 *Query cache regions* and
> §14.7 *Managing the cached data* — the cache-modes table and the region eviction section
> ([docs.hibernate.org/orm/7.4/userguide/](https://docs.hibernate.org/orm/7.4/userguide/html_single/Hibernate_User_Guide.html)),
> and the chapter source on the `7.4` branch
> ([github.com/hibernate/hibernate-orm](https://github.com/hibernate/hibernate-orm/blob/7.4/documentation/src/main/asciidoc/userguide/chapters/caching/Caching.adoc)).
> JDK 25, Spring Boot 4.1.0, Hibernate ORM 7.4.1, PostgreSQL 18.

**Two things finish the query cache. Hibernate exposes read and write participation as separate,
per-operation modes, which gives it a proper force-refresh that Spring's `condition` attribute
cannot express. And the feature has four preconditions that have to hold together — state them
explicitly and the honest answer for most queries becomes obvious.**

## Refreshing a region without evicting it

For the case where the data changed underneath you:

> *"If you require fine-grained control over query cache expiration policies, you can specify a
> named cache region for a particular query."*

and then:

> *"When using `CacheStoreMode.REFRESH` or `CacheMode.REFRESH` in conjunction with the region you
> have defined for the given query, Hibernate will selectively force the results cached in that
> particular region to be refreshed. This behavior is particularly useful in cases when the
> underlying data may have been updated via a separate process and is a far more efficient
> alternative to the bulk eviction of the region via `SessionFactory` eviction."*

The mode table is worth memorising because the names are not self-explanatory:

| Hibernate | Jakarta Persistence | Description |
|---|---|---|
| `CacheMode.NORMAL` | `CacheStoreMode.USE` + `CacheRetrieveMode.USE` | *"Default. Reads/writes data from/into the cache"* |
| `CacheMode.REFRESH` | `CacheStoreMode.REFRESH` + `CacheRetrieveMode.BYPASS` | *"Doesn't read from cache, but writes to the cache upon loading from the database"* |
| `CacheMode.PUT` | `CacheStoreMode.USE` + `CacheRetrieveMode.BYPASS` | *"Doesn't read from cache, but writes to the cache as it reads from the database"* |
| `CacheMode.GET` | `CacheStoreMode.BYPASS` + `CacheRetrieveMode.USE` | *"Read from the cache, but doesn't write to cache"* |
| `CacheMode.IGNORE` | `CacheStoreMode.BYPASS` + `CacheRetrieveMode.BYPASS` | *"Doesn't read/write data from/into the cache"* |

`REFRESH` is the "force refresh" primitive that
[4 · Condition, unless and null](04-null-and-sync.md) says `condition` cannot give you in the
Spring abstraction — here it exists, properly, and it repopulates rather than merely bypassing.

## When it is actually right

Narrow, and worth stating positively because "never" is not true:

- The query has **no parameters, or parameters from a small fixed set** — the enumeration query, a
  lookup by a status code, the list of countries.
- The underlying tables are **written rarely**, because a single commit against any table the
  query reads invalidates it.
- The entities involved are **also in the entity cache with a high hit rate**, or you have set the
  layout to `FULL` so a query hit does not depend on them.
- You have a **`default-update-timestamps-region` configured without expiry or eviction**.

If all four hold, the query cache is a genuine win. If the first one does not, nothing else
matters — you are caching keys that will never be asked for again.

## Evicting, when refresh is not enough

> *"Because the second level cache is bound to the `EntityManagerFactory` or the `SessionFactory`,
> cache eviction must be done through these two interfaces."*

> *"Jakarta Persistence only supports entity eviction through the `jakarta.persistence.Cache`
> interface"*, while *"Hibernate is much more flexible in this regard as it offers fine-grained
> control over what needs to be evicted"* — the `org.hibernate.Cache` interface evicts *"entities
> (by their class or region)"*, *"entities stored using the natural-id (by their class or
> region)"*, *"collections (by the region, and it might take the collection owner identifier as
> well)"* and *"queries (by region)"*.

Note the asymmetry: queries can only be evicted **by region**. There is no "evict this one cached
query result", which is why naming a region per query is not merely an expiry-tuning device — it
is the only granularity of eviction you get.

## Gotchas

**★ A query cache hit still constructs entities.** It saves the database round trip, not the
hydration, so a query returning ten thousand rows is still ten thousand objects on every hit.

**★ Caching a query whose results feed a mutation is a correctness hazard.** Table-granularity
invalidation happens at commit; within the same transaction you may still be reading your own
pre-write cached result unless the persistence context covers you.

**★ `CacheMode` and the Jakarta pair are the same knob described twice.** `CacheMode.GET` is
`CacheStoreMode.BYPASS` plus `CacheRetrieveMode.USE`; mixing vocabularies in one codebase is how
someone ends up setting one of the two halves and assuming both.

**★ `REFRESH` bypasses the read but still writes.** That is the point, and it means calling it on
a hot path is not a free "check the cache is right" — every call goes to the database.

**★ Query results can only be evicted by region.** If you want to invalidate one cached query, you
must have given it its own region name in advance; there is no per-result eviction.

**★ Jakarta Persistence's `Cache` interface only evicts entities.** Collections, natural-id
entries and query regions need `org.hibernate.Cache`, which means unwrapping to a Hibernate type.

**★ Region-per-query is a design decision, not a tuning detail.** It is simultaneously your
expiry granularity and your eviction granularity, and it cannot be retrofitted to a cached result
that is already stale.

**★ Bulk eviction is the blunt instrument the guide warns against.** It is documented as the less
efficient alternative to `REFRESH`, and it leaves a hole that concurrent requests race to fill.

## Interview questions

**★ When would you enable the query cache?**
When four things hold together. The query has no parameters or a small fixed set of them, so the
key space is bounded. The tables it reads are written rarely, because one commit invalidates
everything cached over that table. The entities it returns are either in the entity cache with a
genuinely high hit rate or the layout is pinned to `FULL`, so a query hit does not degrade into
per-identifier loads. And the timestamps region is configured without expiry or eviction. A
reference-data lookup meets all four; almost nothing else does. Given how narrow that is, my
default answer is that a Spring-level `@Cacheable` on a method returning a DTO is usually the
better tool — it caches what the caller actually wanted, with a key I control.

**★ What does `CacheMode.REFRESH` do, and how is it different from evicting?**
It bypasses the cache on read but still writes what it loaded back into the cache, so the entry is
replaced rather than removed. The guide recommends it specifically for the case where the
underlying data was changed by a separate process, and calls it "a far more efficient alternative
to the bulk eviction of the region". The difference matters under load: an eviction leaves a hole
that every concurrent request then races to fill, while a refresh replaces the value in place. It
is also the thing people try to build with Spring's `condition` attribute and cannot, because
`condition` only bypasses — it never repopulates.

**★ Does a query cache hit avoid the cost of building the entities?**
No, and this is where the benefit is often overestimated. What it avoids is the round trip and the
database work; the result still has to be turned into managed entities in the current persistence
context, and with the default `SHALLOW` layout it may first have to fetch each entity's data from
the entity cache. So a cached query returning ten thousand rows still allocates ten thousand
objects on every hit. If the expensive part of your endpoint is object construction rather than
the database, the query cache moves nothing — and a projection into a DTO, cached at the Spring
level, moves both.

**★ How do you invalidate a single cached query result?**
You do not — and that is worth knowing before you design around it. Hibernate's `Cache` interface
evicts query results by *region*, not by result, so the finest granularity available is whatever
region you assigned the query when you made it cacheable. If a query lives in the default
`default-query-results-region` along with everything else, invalidating it means invalidating all
of them. That makes "give this query its own region" a decision you have to take up front, and it
is the main practical reason to use named query regions at all.

**★ Why does `CacheMode` exist alongside `CacheStoreMode` and `CacheRetrieveMode`?**
Because Jakarta Persistence split one Hibernate concept into two orthogonal ones — whether you
read from the cache and whether you write to it — and Hibernate kept its original enum as the
combination. `CacheMode.GET` is retrieve-USE plus store-BYPASS, `CacheMode.PUT` is the reverse,
`REFRESH` is store-REFRESH plus retrieve-BYPASS, and `IGNORE` bypasses both. The practical value
is that once you see them as two independent switches, the useful combinations stop looking
arbitrary: "warm the cache without trusting it" and "read the cache but do not pollute it" are
both things you want occasionally, and both are one setting away.

{/* FOOTER */}
