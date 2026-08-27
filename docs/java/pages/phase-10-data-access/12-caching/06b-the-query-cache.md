---
title: "The query cache is off by default because Hibernate must track every commit against every table a cached query touched, and its default layout can manufacture an N+1 out of a code path that contains no loop"
sidebar_label: "6b · The query cache"
sidebar_position: 20
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 *User Guide* §14.6 *Query cache*, *Query cache
> regions*, *Query cache layout* and §14.7 *Managing the cached data*
> ([docs.hibernate.org/orm/7.4/userguide/](https://docs.hibernate.org/orm/7.4/userguide/html_single/Hibernate_User_Guide.html)),
> the chapter source on the `7.4` branch
> ([github.com/hibernate/hibernate-orm](https://github.com/hibernate/hibernate-orm/blob/7.4/documentation/src/main/asciidoc/userguide/chapters/caching/Caching.adoc))
> and `org.hibernate.cfg.CacheSettings`
> ([docs.hibernate.org/orm/7.4/javadocs/](https://docs.hibernate.org/orm/7.4/javadocs/org/hibernate/cfg/CacheSettings.html)).
> JDK 25, Spring Boot 4.1.0, Hibernate ORM 7.4.1, PostgreSQL 18.

**[6](06-hibernate-second-level.md) argued that the second-level cache is keyed by identifier and
does not stop a query running. The query cache is the feature that would — and Hibernate ships it
disabled, explains why in the chapter, and then documents a default layout that turns a query
cache hit into a burst of per-identifier loads. It is the one caching feature in this topic whose
honest default answer is "no".**

## Hibernate's stated reason for the default

> *"Aside from caching entities and collections, Hibernate offers a query cache too. This is
> useful for frequently executed queries with fixed parameter values."*

and immediately:

> *"Caching of query results introduces some overhead in terms of your application's normal
> transactional processing. For example, if you cache results of a query against `Person`,
> Hibernate will need to keep track of when those results should be invalidated because changes
> have been committed against any `Person` entity. That, coupled with the fact that most
> applications simply gain no benefit from caching query results, leads Hibernate to disable
> caching of query results by default."*

Two claims there, and both are worth separating.

**The overhead is on writes, not reads.** Enabling the query cache adds bookkeeping to every
commit that touches a queryable table, whether or not any query against it is cached. That cost
is paid by code paths that get no benefit.

**"Most applications simply gain no benefit"** is the stronger claim, and the mechanism is the
key. A query cache is keyed by the query *and its parameter values*, so it hits only when the
same query runs with the same arguments. The phrase in the first quote is "fixed parameter
values" — a dropdown list, a lookup by a code, a query with no parameters at all. A search
filtered by a user-supplied date range has effectively unbounded key cardinality, which is
[3d · The key that never repeats](03d-the-key-that-never-repeats.md) arriving in a different
framework.

## Two opt-ins, again

**One — the setting.** `hibernate.cache.use_query_cache`, documented as *"Enable or disable second
level caching of query results. The default is false."*

```xml
<property name="hibernate.cache.use_query_cache" value="true"/>
```

**Two — per query.**

> *"As mentioned above, most queries do not benefit from caching or their results. So by default,
> individual queries are not cached even after enabling query caching. Each particular query that
> needs to be cached must be manually set as cacheable. This way, the query looks for existing
> cache results or adds the query results to the cache when being executed."*

```java
// Jakarta Persistence
List<Country> rows = em.createQuery("select c from Country c order by c.name", Country.class)
        .setHint("org.hibernate.cacheable", true)
        .getResultList();

// Hibernate native
List<Country> rows = session.createSelectionQuery("from Country order by name", Country.class)
        .setCacheable(true)
        .getResultList();
```

In Spring Data JPA the equivalent is `@QueryHints` on the repository method; the repository
itself is **[Topic 09 · Spring Data JPA](../09-spring-data-jpa/README.md)**.

⚠️ The query cache also depends on the second-level cache being configured, because of what it
stores. That is the next section.

## The two regions, and one of them must not expire

> *"This setting creates two new cache regions:"*
> `default-query-results-region` — *"Holding the cached query results."*
> `default-update-timestamps-region` — *"Holding timestamps of the most recent updates to
> queryable tables. These are used to validate the results as they are served from the query
> cache."*

That second region is the invalidation mechanism. Hibernate records, per table, when it last
committed a change; a cached result set is only served if its own timestamp is newer than the
last-update timestamp of every table it touched. **So invalidation is at table granularity**: one
`INSERT` into `person` invalidates every cached query that reads `person`, regardless of whether
the new row would have matched.

The guide's warning about that region is emphatic, and the reason follows from the mechanism:

> *"If you configure your underlying cache implementation to use expiration, it's very important
> that the timeout of the underlying cache region for the `default-update-timestamps-region` is
> set to a higher value than the timeout setting of any of the query caches. In fact, we
> recommend that the `default-update-timestamps-region` region is not configured for expiration
> (time-based) or eviction (size/memory-based) at all. Note that an LRU (Least Recently Used)
> cache eviction policy is never appropriate for this particular cache region."*

🔴 **Lose a timestamp entry and the cached results that depended on it become unverifiable — the
guarantee that made the query cache safe is gone.** This is why the query cache is not something
you can safely bolt onto a JCache provider with a global default configuration: the default
configuration of most providers is exactly the size-bounded LRU the guide says is never
appropriate. It interacts directly with the missing-cache strategy in
[6d · Turning it on](06d-turning-it-on.md), where caches created on the fly are described as
possibly *"unlimited size and no eviction"* — the opposite failure, and here the *safe* one.

## The layout that manufactures an N+1

The most consequential detail is how entities are stored in a cached result.

> *"An entity or collection in the query cache can either be represented with all its fetched data
> (`FULL` cache layout), or with just the identifier or collection owner key (`SHALLOW` cache
> layout). With the identifier or collection owner key, Hibernate ORM can then consult an entity
> or collection cache to retrieve the final entity data. The shallow query cache layout is hence
> only effective for entities/collections for which such a second level cache exists, and only if
> there is a very high cache hit rate i.e. few cache invalidations. Whenever a shallow cached
> entity/collection can not be found in the second level cache, Hibernate ORM will load the data
> from the database by identifier or collection owner key respectively, which can lead to a lot of
> additional queries if the second level cache does not have a high cache hit rate."*

and the default:

> *"The default query cache layout `AUTO` will choose `SHALLOW` for entities and collections that
> are cacheable and `FULL` otherwise, because query caching of entity or collection data is
> generally only advisable for high cache hit rates."*

Follow that through. A cacheable entity plus `AUTO` gives `SHALLOW`, so the query cache stores a
list of identifiers. On a hit, Hibernate resolves those identifiers through the entity cache. If
those entity cache entries were evicted — a write, a region expiry, memory pressure, a restart of
this pod — Hibernate falls back to loading each one **by identifier**, one at a time.

**That is an N+1 created entirely by the caching layer, on a code path with no loop in it and no
lazy association being dereferenced.** Nothing in your code changed; the trigger is a cache
eviction somewhere else. It is the hardest shape in this whole area to attribute, and it is
covered from the N+1 side in
[../08-the-n-plus-1-problem/17b-the-second-level-cache.md](../08-the-n-plus-1-problem/17b-the-second-level-cache.md).

A third layout exists for polymorphic loads: *"Since loading polymorphic entities might involve
querying multiple tables, it is possible to store the discriminator of an entity along with the
identifier (`SHALLOW_WITH_DISCRIMINATOR` cache layout) to potentially avoid costly queries in
case of a second level cache miss."*

You can override the layout globally with `hibernate.cache.query_cache_layout` — which the
javadoc marks `@Incubating`, so treat it as subject to change — or per entity or collection with
`@QueryCacheLayout`.

The cache modes that let you refresh a region rather than evict it, and the four conditions under
which the query cache is actually the right tool, are
[6b2 · Cache modes, and when the query cache is right](06b2-cache-modes-and-when-its-right.md).

## Gotchas

**★ The query cache is off by default and the guide's reason is that most applications gain
nothing.** Turning it on is a claim about your query shapes, and the claim is usually false.

**★ The overhead lands on writes.** Every commit against a queryable table has to update the
timestamps region, including commits from code that never reads a cached query.

**★ Invalidation is per table, not per row.** One insert into `person` invalidates every cached
query that reads `person`, including ones the new row could not possibly have matched.

**★ It needs two opt-ins**, the global setting and `setCacheable(true)`/`org.hibernate.cacheable`
per query. Enabling only the setting caches nothing and still pays the write overhead.

**★ An LRU policy on `default-update-timestamps-region` is documented as never appropriate.**
Losing a timestamp destroys the validation that makes cached results safe, and most providers'
default region configuration is exactly that.

**★ The timestamps region must outlive every query cache region.** If it expires sooner the
validation data is gone before the data it validates.

**★ The default `AUTO` layout is `SHALLOW` for cacheable entities**, so a query cache hit stores
identifiers and resolves them through the entity cache — and falls back to one load per identifier
when that cache misses.

**★ That fallback is an N+1 with no loop in the code.** The trigger is an eviction elsewhere, so
nothing in the change history of the endpoint explains it.

**★ `hibernate.cache.query_cache_layout` is `@Incubating`.** The knob that fixes the layout
problem globally is explicitly not a stable API.

## Interview questions

**★ Why is Hibernate's query cache disabled by default?**
The guide gives two reasons and they are different in kind. The mechanical one is overhead: to
serve a cached result safely, Hibernate has to know when any table that query touched was last
modified, so enabling the feature adds bookkeeping to every commit against a queryable table —
paid by write paths that gain nothing. The judgement one is that "most applications simply gain no
benefit", and that follows from the key: a cached query hits only when the same query runs with
the same parameter values, so it works for fixed-parameter lookups and does nothing for a search
screen with user-supplied filters. Off by default is the right default because the second
condition is rarely met.

**★ How does Hibernate know a cached query result is still valid?**
Through the `default-update-timestamps-region`, which holds the timestamp of the most recent
update to each queryable table. A cached result carries its own timestamp, and it is served only
if it is newer than the last-modification timestamp of every table involved. Two things follow.
Invalidation is at table granularity, so any commit against `person` invalidates every cached
query over `person`. And the timestamps region is load-bearing for correctness rather than
performance — the guide says it should not be configured for expiration or eviction at all, and
that an LRU policy is never appropriate for it, because losing an entry there removes the
evidence the cache needed to decide whether a result was stale.

**★ How can a cache create an N+1 that did not exist before?**
Through the query cache's default layout. `AUTO` chooses `SHALLOW` for entities that are
cacheable, which means the query cache stores identifiers rather than data and resolves them
through the entity cache on read. If those entity cache entries have been evicted — a write, a
region expiry, another node restarting — Hibernate loads each one by identifier, which the guide
warns "can lead to a lot of additional queries". The code contains no loop and no lazy
dereference, and nothing in the endpoint changed, so it is the hardest version of this bug to
attribute. Setting the layout to `FULL` for that entity avoids it at the cost of duplicating the
data in two caches.

{/* FOOTER */}
