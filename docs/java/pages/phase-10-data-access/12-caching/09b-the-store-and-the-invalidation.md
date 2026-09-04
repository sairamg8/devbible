---
title: "The second half of a caching review is everything the annotation does not mention — which store you are actually on, what the entries are serialized as, when they expire, every write that must evict them, and whether anything at all would tell you it went wrong"
sidebar_label: "9b · The store and the invalidation"
sidebar_position: 35
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 — this chunk collects rules established and cited in chunks 05–08d of this topic;
> each item links to the chunk carrying the primary source. Spine sources: the Spring Boot 4.1
> reference *Caching*
> ([docs.spring.io/spring-boot/reference/io/caching.html](https://docs.spring.io/spring-boot/reference/io/caching.html)),
> the Spring Framework 7.0 reference *Cache Abstraction*
> ([docs.spring.io/spring-framework/reference/integration/cache.html](https://docs.spring.io/spring-framework/reference/integration/cache.html)),
> the Hibernate ORM 7.4 *User Guide* §14 *Caching*
> ([docs.hibernate.org/orm/7.4/userguide/](https://docs.hibernate.org/orm/7.4/userguide/html_single/Hibernate_User_Guide.html))
> and the Redis 8 documentation ([redis.io/docs](https://redis.io/docs/latest/)).
> JDK 25, Spring Boot 4.1.1, Spring Framework 7.0, Hibernate ORM 7.4.1, Redis 8, PostgreSQL 18.

**[9](09-the-checklist.md) reviews the annotation: whether it should exist, the method it sits on,
the name and the key. Everything on this page is outside the changed file, which is exactly why it
gets skipped — and why every item on it is a production incident somebody has already had.**

## 6 · The store

**Which provider are you actually on?** Detection order is Generic, JCache, Hazelcast, Infinispan,
Couchbase, Redis, Caffeine, Cache2k, Simple. `Simple` is the silent fallback and `Generic` wins on
any stray `Cache` bean ([8c](08c-what-to-measure-first.md)).

**Is `spring.cache.type` set explicitly?** It converts a silent misconfiguration into a startup
failure ([8c](08c-what-to-measure-first.md)).

**Is there a hand-written `CacheManager` bean?** Then no detection and no `spring.cache.*` property
applies, and the properties people later tune are inert ([5e](05e-changing-the-defaults-safely.md)).

**Is the cache local, and are there several instances?** Then the staleness window is the lifetime of
the process, per pod, with no coordination ([7b](07b-caching-in-a-cluster.md)).

## 7 · Serialization, if the store is remote

**What is the wire format?** The shipped default is JDK serialization, which breaks the moment a
cached class changes shape ([5b](05b-serialization-is-the-hard-part.md)).

**Does a rolling deploy have old and new pods reading each other's entries?** That makes the format a
compatibility contract between two versions of your own application
([5b](05b-serialization-is-the-hard-part.md)).

**If JSON: which serializer, and which defaults?** Boot 4 renamed the one you reach for and inverted
two of its defaults ([5b2](05b2-json-and-the-jackson-3-rename.md)).

**Is personal data now in a second store?** Deletion and export obligations follow the copy, and no
`DELETE` reaches Redis ([8b](08b-when-the-cache-is-the-wrong-risk.md)).

## 8 · Expiry

**Is there a TTL?** Boot's Redis cache configuration ships with no expiry. For every writer you do
not control, the TTL is not a backstop — it is the entire mechanism
([5c](05c-expiry-and-eviction.md), [7e](07e-the-writes-the-cache-never-sees.md)).

**What is the server's eviction policy?** Redis's default is to reject new writes rather than evict,
so no-TTL entries plus that policy compose into an outage for every client of the instance
([5c](05c-expiry-and-eviction.md)).

**Is the TTL derived from the staleness budget or from a hit-rate hope?** Backwards from the budget
is the only defensible direction ([5c2](05c2-choosing-and-applying-a-ttl.md)).

**Will everything expire at the same moment?** Entries written together expire together; that is a
synchronised miss storm ([8](08-when-not-to-cache.md)).

## 9 · Invalidation — the section that takes the longest

**Does every write path to that data evict?** Including the ones in other classes, other modules and
other services ([7](07-invalidation.md)).

**Is the eviction after the method or after the commit?** By default it is after the method, and a
concurrent reader repopulates the pre-commit value in the gap. Transaction awareness is off in every
manager, including Redis ([7](07-invalidation.md)).

**Is `beforeInvocation` set on write paths?** By default an exception in the method skips the
eviction entirely ([7c](07c-getting-the-eviction-right.md)).

**Which derived entries does this write invalidate?** Counts, summaries, lists, aggregates, and any
no-argument cache. These are the ones nobody writes an evict for
([7d](07d-the-invalidation-you-forgot.md)).

**Does a list cache need the *previous* grouping value evicted too?** Yes, and getting it means
passing it in as a parameter ([7d](07d-the-invalidation-you-forgot.md)).

**Do cascades or `ON DELETE CASCADE` delete rows with their own cache entries?** The method signature
does not name them ([7d](07d-the-invalidation-you-forgot.md)).

**Are there `@Modifying` bulk statements, `JdbcTemplate` calls or migrations against these tables?**
None of them evicts anything ([7e](07e-the-writes-the-cache-never-sees.md)).

**Does anything outside this application write these tables?** Then there is no eviction to write,
only a TTL ([7e](07e-the-writes-the-cache-never-sees.md), [7f](07f-what-hibernate-never-sees.md)).

## 10 · The Hibernate second-level cache, if it is on

**Is a region factory configured?** In Hibernate 6 and 7 it is enabled by configuring one, not by
setting a boolean ([6d](06d-turning-it-on.md)).

**Which concurrency strategy?** `NONSTRICT_READ_WRITE` admits stale updates by design
([6c](06c-mapping-and-strategies.md)).

**Does each entity and collection role have its own region?** Sharing a region means evicting one
entity evicts all of them, and they share an expiry queue ([7f](07f-what-hibernate-never-sees.md)).

**Is the query cache on?** It is off by default and usually should stay off; its shallow layout can
manufacture an N+1 with no loop in sight ([6b](06b-the-query-cache.md)).

**Is any entity mapped over a view, `@Subselect` or `@SQLSelect`?** Then it needs `@Synchronize`, or
writes to the backing tables never invalidate cached results ([7f](07f-what-hibernate-never-sees.md)).

## 11 · Failure and observability

**What happens when the cache is unreachable?** The default error handler rethrows, so a cache outage
is an application outage ([5d2](05d2-when-the-cache-is-down.md)).

**If failures are swallowed, has the fallback path been load-tested?** The database has been absorbing
a reduced load since the day the cache was added ([8b](08b-when-the-cache-is-the-wrong-risk.md)).

**Are evict failures logged at a level someone sees?** A swallowed evict failure is a permanent stale
entry when there is no TTL ([7](07-invalidation.md)).

**Are the cache metrics actually bound?** The `simple` provider is not instrumented at all, and only
caches present at startup are bound ([8c](08c-what-to-measure-first.md)).

**Is the alert an upper bound on the miss ratio?** A lower bound on the hit ratio fires whenever
traffic stops ([8d](08d-what-to-watch-once-it-is-live.md)).

**Did the database's call count for that statement actually fall?** If not, the cache is off the path
([8d](08d-what-to-watch-once-it-is-live.md)).

**Is there anything at all that would detect staleness?** No library emits it; if it matters, it is a
job somebody has to write ([8d](08d-what-to-watch-once-it-is-live.md)).

## 12 · The last question

**If this cache were deleted tomorrow, would the system survive?** If the honest answer is no, the
cache is not an optimisation — it is load-bearing infrastructure, and it should be reviewed, tested,
alerted and capacity-planned as such rather than as three lines of annotation.

## Gotchas

**★ Every item here is invisible with test-sized data and a single instance.** Key-space growth,
per-pod divergence, eviction storms and serialization compatibility all need production's shape
before they appear.

**★ The checklist cannot see the schema or the migrations.** "Should this have been an index?" is
answered in a migration file, and "who else writes this table?" is answered outside the repository
entirely.

**★ Reviewing the annotation is not reviewing the cache.** The store's configuration, the TTL, the
error handler and the serializer live in a configuration class that is not in the diff and that
nobody opened.

**★ The invalidation section is the longest and it is the one that gets time-boxed.** It is also the
only section whose failures are wrong answers rather than slow ones.

**★ A cache with no TTL turns every missed invalidation into a permanent one.** Boot's Redis defaults
give you exactly that, and the entry survives until somebody restarts something.

**★ "Nobody else writes this table" is a claim with an expiry date.** It is true until the next
service, the next migration or the next operator, and nothing will tell you when it stops being
true.

**★ Two caches over the same data invalidate independently.** An HTTP response cache, a method cache
and a second-level cache over one fact are not additive — the outermost one wins, and it is usually
the one nobody remembered.

**★ A green build proves nothing about any item here.** Every one of them is a runtime configuration
or a cross-module relationship; none is expressible as a compile-time constraint.

## Interview questions

**★ Walk me through reviewing the invalidation on a caching change.**
I start from the data rather than the diff. Which tables does the cached method read? Then: every
write to those tables, everywhere. The service methods are the easy half and they usually have their
evict. The half that gets missed is derived entries — the counts, the lists, the aggregates, the
no-argument summary — because their keys have nothing to do with the row being written. Then the
writes that never reach the cache at all: bulk `@Modifying` statements, `JdbcTemplate`, cascades and
`ON DELETE CASCADE`, migrations, and anything outside the application. For that last group there is
no eviction to write, so the TTL is the design and it needs to be short enough that the worst case is
acceptable. Finally I check *when* the eviction fires: by default it is after the method and before
the commit, which is the window where a concurrent reader writes the old value straight back.

**★ What do you want to know about the store before trusting a cache?**
Which provider is actually in use, because detection is by classpath and `Simple` is the silent
fallback. Whether `spring.cache.type` is set, which converts a wrong guess into a startup failure.
Whether anybody defined their own `CacheManager` bean, because that turns off the detection and every
`spring.cache.*` property in one move. Whether the cache is local, and if so how many instances there
are, since that changes the staleness window from a TTL into the lifetime of a process. If it is
remote: the wire format, the TTL, the server's eviction policy, and what the error handler does when
the store is unreachable. None of that is in the annotation and all of it decides how the cache
behaves.

**★ How do you decide whether a cache is an optimisation or infrastructure?**
By asking what happens if it is removed. If the system serves correctly and merely more slowly, it is
an optimisation and can be reviewed as one. If the database cannot take the load, or an endpoint
times out, or a downstream rate limit is exceeded, then the cache is load-bearing — and it needs the
treatment infrastructure gets: capacity planning, an availability target, alerting, a tested failure
mode, and a documented plan for the moment it is empty. The dangerous state is a cache that has
quietly become the second kind while still being reviewed as the first, which is the normal way this
happens, because nothing announces the transition.

**★ A team says their cache has been in production for two years without incident. What do you make
of that?**
That nothing has forced the bad path yet, not that the bad path is fine. Staleness produces no
exception, no metric and no log line — it produces a plausible answer — so two quiet years are
entirely consistent with a persistent correctness bug nobody has attributed to the cache. And the
cost side is concentrated rather than continuous: the incident arrives with a deploy, a scale-up, a
failover or a wholesale eviction, and until one of those coincides with peak load the system has
never actually been asked to run at the uncached rate. I would want to know when the fallback path
was last exercised deliberately, and whether anything at all would detect a wrong answer.

**★ What would you check about the Hibernate second-level cache that people usually miss?**
Three things. Whether each entity and collection role has its own region, because sharing one means
evicting any of them evicts all of them and they share an expiry queue. Whether any cached entity is
mapped over a view, a `@Subselect` or handwritten SQL, because those need `@Synchronize` or Hibernate
does not know which tables back them and never invalidates cached results for writes to those tables.
And whether the concurrency strategy is `NONSTRICT_READ_WRITE`, which the documentation says offers a
weaker guarantee because stale updates are possible — a strategy often chosen for throughput by
someone who did not read that sentence.

**★ What is the single most useful thing to add to a caching review that most teams do not do?**
Write down, next to each cache name, the list of writes that must invalidate it — and keep the list
in the repository rather than in the review. It takes an hour to produce, it turns an invisible
cross-module relationship into a checkable artefact, and it is the only thing that makes the next
person's bulk `UPDATE` a review comment instead of an incident. The second most useful thing is a
scheduled job that samples cached values against fresh reads and alerts on disagreement, because
nothing in any cache library can tell you the answer was wrong.

{/* FOOTER */}
