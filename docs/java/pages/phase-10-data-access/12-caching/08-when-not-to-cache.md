---
title: "A cache in front of a query that needs an index does not make the query faster — it makes it rarer, and it removes the signal that would have told you to fix it, so you end up slow, stale and blind at exactly the moment the cache is empty"
sidebar_label: "8 · When not to cache"
sidebar_position: 30
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the PostgreSQL 18 documentation *11.1 Introduction* (indexes) and
> *14.1 Using EXPLAIN*
> ([postgresql.org/docs/18/indexes-intro.html](https://www.postgresql.org/docs/18/indexes-intro.html),
> [postgresql.org/docs/18/using-explain.html](https://www.postgresql.org/docs/18/using-explain.html)),
> the Hibernate ORM 7.4 *User Guide* §31.7 *Caching*
> ([docs.hibernate.org/orm/7.4/userguide/](https://docs.hibernate.org/orm/7.4/userguide/html_single/Hibernate_User_Guide.html)),
> the Hibernate ORM 7.4 *Introduction* §8.7 *The second-level cache*
> ([docs.hibernate.org/orm/7.4/introduction/](https://docs.hibernate.org/orm/7.4/introduction/html_single/Hibernate_Introduction.html))
> and the Spring Framework 7.0 reference *Understanding the Cache Abstraction*
> ([docs.spring.io/spring-framework/reference/integration/cache/strategies.html](https://docs.spring.io/spring-framework/reference/integration/cache/strategies.html)).
> JDK 25, Spring Boot 4.1.0, Hibernate ORM 7.4.1, PostgreSQL 18.

**[1 · Caching is a decision](01-caching-is-a-decision.md) opened this topic by putting caching
fourth in a list of four moves. This chunk is the case for the first three, and it is not an
aesthetic preference: a cache in front of a fixable query buys latency with correctness, leaves the
defect in place, and destroys the evidence that the defect exists. Every failure mode below has the
same shape — the cache works, and that is the problem.**

## The query you should have indexed

Here is the mechanism, stated precisely, because "add an index instead" is usually asserted rather
than argued.

**A cache does not make a query faster. It makes the query rarer.** On a hit you skip the work
entirely; on a miss you pay exactly what you paid before, plus a cache lookup and a cache write. The
per-execution cost of the statement is untouched. An index changes that per-execution cost, for
every execution, forever:

> *"With no advance preparation, the system would have to scan the entire `test1` table, row by row,
> to find all matching entries. If there are many rows in `test1` and only a few rows (perhaps zero
> or one) that would be returned by such a query, this is clearly an inefficient method. But if the
> system has been instructed to maintain an index on the `id` column, it can use a more efficient
> method for locating matching rows. For instance, it might only have to walk a few levels deep into
> a search tree."*

Five consequences follow, and each of them is a reason to reach for the index first.

**1 · The index helps every caller, including the ones you did not cache.** The report, the export,
the admin screen, the migration, the other service reading the same table, and the `COUNT` your
pagination issues ([`../09-spring-data-jpa/05-pageable-and-sort.md`](../09-spring-data-jpa/05-pageable-and-sort.md)).
The cache helps one method signature.

**2 · The index has no consistency model.** PostgreSQL maintains it inside the same transaction as
the write, so an indexed read is exactly as correct as an unindexed one. A cache is a second copy
with a staleness window you now own, and every chunk from [7](07-invalidation.md) onwards is the bill
for that.

**3 · The index's cost is bounded and it is a write cost, not a correctness cost.**

> *"After an index is created, the system has to keep it synchronized with the table. This adds
> overhead to data manipulation operations. Indexes can also prevent the creation of heap-only
> tuples. Therefore indexes that are seldom or never used in queries should be removed."*

That is a real cost and it is the honest counter-argument. Note what it is *not*: it never returns a
wrong answer, it never needs invalidating, and it does not change behaviour when a process restarts.

**4 · The misses are not spread evenly.** A cache's benefit is distributed across ordinary traffic;
its cost is concentrated. Every entry is cold at the same moments — a deploy, a rolling restart, a
scale-up, a TTL expiry wave, a wholesale eviction ([7e](07e-the-writes-the-cache-never-sees.md)), a
Redis failover. At those moments *every* request runs the unindexed query at once, against a
database that has also just lost whatever was warm in `shared_buffers`. **A cache over a slow query
converts a steady load into a synchronised burst of the worst case**, which is why the incident
happens during the deploy rather than at peak.

**5 · You lose the signal.** The slow query stops appearing in the p50, the endpoint's dashboard
goes green, and the next person to read that code has nothing telling them the statement is a
sequential scan over a growing table. The defect does not stop growing — the table does not stop
growing — it just stops being visible until it is too large to fix quickly.

Hibernate's performance chapter puts the same ordering in its own words, and it is worth noting that
this is the ORM's documentation arguing *against* reaching for its own cache:

> *"Although the second-level cache can reduce transaction response time since entities are retrieved
> from the cache rather than from the database, there are other options to achieve the same goal, and
> you should consider these alternatives prior to jumping to a second-level cache layer: tuning the
> underlying database cache so that the working set fits into memory, therefore reducing Disk I/O
> traffic. optimizing database statements through JDBC batching, statement caching, indexing can
> reduce the average response time, therefore increasing throughput as well. database replication is
> also a very valuable option to increase read-only transaction throughput."*

**The diagnostic is one command and it is not optional.** Before `@Cacheable`, get the statement and
run `EXPLAIN` on it. *"You can use the `EXPLAIN` command to see what query plan the planner creates
for any query."* If the plan is a sequential scan over a large table for a selective predicate, or a
sort with no matching index, the answer is a migration, not an annotation
([`../11-flyway-migrations/08a2-adding-indexes-and-enum-values.md`](../11-flyway-migrations/08a2-adding-indexes-and-enum-values.md)).
PostgreSQL's own framing of whose job this is leaves no room for delegation to a cache:

> *"Just as it is the task of the author to anticipate the items that readers are likely to look up,
> it is the task of the database programmer to foresee which indexes will be useful."*

## The N+1 a cache papers over

The second shape is a page that is slow not because one statement is slow but because there are a
hundred of them. A cache in front of the *outer* method makes the hundred statements infrequent
rather than fewer, and every property of the previous section applies with more force: on a cold
cache the endpoint issues all hundred, and it issues them concurrently across every pod that just
started.

This bible's topic 8 already argues the specific version — that Hibernate's second-level cache is
not an N+1 fix — in
[`../08-the-n-plus-1-problem/17b-the-second-level-cache.md`](../08-the-n-plus-1-problem/17b-the-second-level-cache.md),
and it is worth being clear that 12 does not soften it. The cache can eliminate the *load* a query
causes without eliminating the *query* ([6](06-hibernate-second-level.md)); the fetch plan is the
fix, and it is unconditional. The order is: fix the fetch plan, then measure again
([`../08-the-n-plus-1-problem/14-choosing-a-fix.md`](../08-the-n-plus-1-problem/14-choosing-a-fix.md)).

⚠️ There is a sharper version of this trap. A cache **inside** the loop — `@Cacheable` on the method
the loop calls — genuinely does reduce the statement count, which makes it look like the right fix.
It reduces it to the number of *distinct* keys, which is unbounded, non-deterministic, and different
in production from in your test. An `@EntityGraph` reduces it to one.

## The cache that cannot win: hit rate as arithmetic

Every request through a cached method pays a lookup. Every miss additionally pays a write. So the
expected cost is the miss rate times the original work, plus a lookup on every request, plus a write
on every miss. **A cache with a low hit rate is not neutral — it is a net loss**, and on a remote
store the loss is measured in network round trips: a miss on Redis costs a `GET` and a `SET` in
addition to the query it was meant to replace.

Two shapes guarantee a low hit rate, and both are common enough that they deserve naming rather than
measuring.

**A key space larger than the cache, read once each.** A report keyed by a date range, a search
keyed by free text, a lookup keyed by a request id ([3d](03d-the-key-that-never-repeats.md)). There
is no second read to serve. Worse, the entries evict the ones that were working for other endpoints,
so the cache you added made two other features slower.

**Write-heavy data.** If the entry is invalidated before it is read a second time, you have paid
serialization, memory and eviction traffic for nothing. The read-to-write ratio is the entire
argument for a cache and it is almost never stated in the pull request that adds one.

## The rest of the list

Three more categories are reasons to say no regardless of how fast the query is — data whose
staleness is a correctness bug, the staleness window multiplying per pod, the cache becoming an
availability dependency, and the heap. Those are
[8b · When the cache is the wrong risk](08b-when-the-cache-is-the-wrong-risk.md). What to measure
before you say yes is [8c · What to measure first](08c-what-to-measure-first.md).

## Gotchas

**★ A cache does not make a query faster, it makes it rarer.** Every miss pays the original cost plus
a lookup and a write; the per-execution cost of the statement is exactly what it was.

**★ Cache misses are synchronised, and they synchronise with your riskiest moments.** Deploys,
rolling restarts, scale-ups, TTL waves and failovers make every entry cold at once, so the unindexed
query runs concurrently across every pod against a database whose buffers are also cold.

**★ An index helps callers you never thought about; a cache helps one method.** The report, the
export, the migration, the count query behind your pagination and the other service on the same table
all benefit from the index and none of them benefit from the cache.

**★ An index never returns a wrong answer.** Its cost is write overhead and disk, both bounded and
both documented; it needs no invalidation and it survives a restart.

**★ The index is also the thing a cache miss needs.** Adding the index does not stop you adding the
cache later, and it makes the cache's worst case survivable — which is the opposite of the ordering
most proposals arrive in.

**★ Caching an N+1 makes it periodic rather than absent.** On a cold cache the endpoint still issues
every statement, and it does so on every pod that just started.

**★ A cache *inside* the loop looks like a fix and is not.** It reduces the statement count to the
number of distinct keys, which is unbounded and differs between your test and production; a fetch
plan reduces it to one.

**★ A low hit rate is a net loss, not a neutral outcome.** You added a lookup to every request and a
write to every miss, and on a remote store both are network round trips.

**★ A large key space read once each also evicts other endpoints' working entries.** The feature you
added made two unrelated features slower, and nothing attributes the regression to it.

**★ The read-to-write ratio is the entire argument for a cache and it is almost never in the pull
request.** If nobody can state how many reads happen per write for that key, nobody has established
that the cache can hit.

**★ `EXPLAIN` costs nothing and settles the argument.** A sequential scan over a large table for a
selective predicate is a migration, not an annotation, and no amount of discussion about hit rates
changes that.

## Interview questions

**★ An endpoint is slow. Someone proposes caching it. What do you ask?**
Why it is slow, and I want the statement and its plan before I accept any answer. If the query is a
sequential scan over a growing table, the cache does not make that statement faster — it makes it
less frequent, and it still runs at full cost on every miss. If it is slow because it issues a
hundred statements, the cache makes the hundred periodic rather than absent. Both of those are
fixable defects with unconditional fixes, and putting a cache in front of either one leaves the
defect in place while removing the metric that would have shown it. Caching is a reasonable fourth
move after the fetch plan, the index and the amount of data returned; as a first move it is usually a
way of not diagnosing the problem.

**★ Why is an index better than a cache for a slow query, specifically?**
Four reasons, none of them about raw speed. It applies to every caller of that table rather than one
method signature, including the report and the migration you did not think about. It has no
consistency model — PostgreSQL maintains it in the same transaction as the write, so an indexed read
is exactly as correct as an unindexed one, whereas a cache is a second copy whose invalidation is now
your problem. Its cost is a write overhead that the documentation states plainly and that never
manifests as a wrong answer. And it has no cold state, so it does not turn a deploy into a
synchronised burst of the worst case. The cache's genuine advantage is that it can remove work an
index cannot — a downstream service call, an expensive aggregation, a computation over many rows —
and that is exactly when it is the right tool.

**★ Why do caching incidents happen during deploys?**
Because a cache's benefit is spread across ordinary traffic and its cost is concentrated at the
moments every entry is cold — a deploy, a rolling restart, a scale-up, a Redis failover, a TTL wave,
a wholesale eviction. At those moments every request takes the slow path simultaneously, on every
pod, against a database whose own buffer cache has usually just lost the same working set. If the
slow path was slow because of a missing index, the system has been running for months on a hit rate
that concealed a query it cannot survive at full volume. Nothing in the steady state warns you, which
is precisely why the cache was a bad answer to that problem.

**★ Someone says "the cache is fine, we have a 95% hit rate". What is your reply?**
That the remaining 5% is what the system has to survive, and that a hit rate says nothing about the
distribution of the misses. If they are spread evenly it is a good number; if they arrive together
because everything expired or a pod restarted, then 95% describes the good times and tells you
nothing about the bad ones. I would also want to know what the miss costs — a 95% hit rate over a
query that takes a sequential scan is a system that has not yet been asked to run that scan at full
volume. And separately, a high hit rate on data that should not be cached is a high rate of serving
stale answers, so the number is only meaningful next to a staleness bound somebody agreed to.

**★ When is a low hit rate not just disappointing but actively harmful?**
Always, and it is arithmetic rather than opinion. Every request through the cached method pays a
lookup; every miss additionally pays a write. On a remote store both are network round trips added to
work you were doing anyway. So a cache that rarely hits has strictly increased the cost of the path
it was added to. A large key space read once each is worse still, because the entries you will never
read again evict the entries that were serving other endpoints — the cache you added to speed up one
feature made two unrelated ones slower, and no dashboard will attribute that to your change.

**★ Is a cache ever the right answer to a slow read?**
Yes, when the work being removed is not something a query plan can improve. A call to a downstream
service that rate-limits you, an aggregation over millions of rows that is genuinely correct and
genuinely expensive, a computation whose inputs change once a day, an external API you pay per call
for. In those cases the cache removes real work rather than deferring a fixable defect, and the
conversation moves straight to the part that matters: the staleness budget, who owns it, and what
invalidates the entry. The test I apply is whether I could make the underlying operation
substantially cheaper by changing the schema, the fetch plan or the amount of data returned. If yes,
do that first; if no, cache it and write down the trade.

{/* FOOTER */}
