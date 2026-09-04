---
title: "A cache is a second copy of your data with a consistency model you now own, so the decision to add one is a decision to be wrong sometimes in exchange for being fast usually"
sidebar_label: "1 · Caching is a decision"
sidebar_position: 1
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the Spring Framework 7.0 reference *Cache Abstraction →
> Understanding the Cache Abstraction*
> ([docs.spring.io/spring-framework/reference/integration/cache/strategies.html](https://docs.spring.io/spring-framework/reference/integration/cache/strategies.html)),
> the Hibernate ORM 7.4 *User Guide* §31.7 *Caching*
> ([docs.hibernate.org/orm/7.4/userguide/](https://docs.hibernate.org/orm/7.4/userguide/html_single/Hibernate_User_Guide.html))
> and the PostgreSQL 18 documentation on `shared_buffers`
> ([postgresql.org/docs/18/runtime-config-resource.html](https://www.postgresql.org/docs/18/runtime-config-resource.html)).
> JDK 25, Spring Boot 4.1.1, Hibernate ORM 7.4.1.

**Every cache is the same bargain: you agree to serve an answer that may be out of date,
in exchange for serving it without doing the work. That bargain is fine — most systems
make it many times over — but it is a bargain, and the failure mode is not "slow", it is
"wrong". The habit worth building is to say out loud what staleness you are buying, for
which data, and who notices, before you type `@Cacheable`.**

## Name the trade in one sentence

Before the annotation, write the sentence. If you cannot finish it, you are not ready to
add the cache.

> *We will serve `<this data>` up to `<this long>` out of date, because it is read
> `<this often>` per write, and a stale answer costs `<this>`.*

Filled in for a product catalogue it reads: *we will serve product descriptions up to two
minutes out of date, because they are read thousands of times per write, and a stale
answer means a customer sees last week's blurb.* That is an easy yes.

Filled in for an account balance it reads: *we will serve balances up to two minutes out
of date, because they are read a few times per write, and a stale answer means a customer
spends money they do not have.* That is an obvious no, and the sentence made it obvious
without any argument about hit rates.

Filled in for a permissions check it reads: *we will serve authorisation decisions up to
five minutes out of date, and a stale answer means a revoked user keeps access for five
minutes.* That one is neither obvious yes nor obvious no — it is a **conversation with
whoever owns the risk**, which is exactly the outcome the sentence is for.

## What you are actually taking on

Spring's own framing is deliberately narrow. The reference calls the abstraction a way of
"reducing the number of executions based on the information available in the cache", and
then states the precondition plainly:

> *"This approach works only for methods that are guaranteed to return the same output
> (result) for a given input (or arguments) no matter how many times they are invoked."*

Read that as written. It is not "methods that are usually the same". A method whose answer
depends on the clock, on another user's writes, or on a row someone else is editing does
not satisfy it — and the abstraction will happily cache it anyway, because nothing checks.

The same page is equally direct about what the framework does **not** do for you:

> *"The caching abstraction has no special handling for multi-threaded and multi-process
> environments, as such features are handled by the cache implementation."*

So concurrency, coherence between instances, and eviction across a cluster are not
problems Spring solves on your behalf. They are problems you have chosen, and the store
you pick decides what they look like. That is the subject of
[7b · Two pods, two caches](07b-caching-in-a-cluster.md).

## Which cache do you mean?

"Add a cache" is ambiguous in a Java data-access stack, because at least six things in
the request path are already caching. Being precise about which one is being discussed
prevents most of the bad arguments.

| Layer | Scope | Lifetime | Owned by |
|---|---|---|---|
| Persistence context (first-level) | one `EntityManager` | one transaction | Hibernate, always on |
| Hibernate second-level cache | one `SessionFactory` | until evicted | you, opt-in per entity |
| Hibernate query cache | one `SessionFactory` | until invalidated | you, opt-in per query |
| Spring cache abstraction | one application | until evicted | you, opt-in per method |
| Database buffer cache | one server | until evicted | PostgreSQL |
| OS page cache / HTTP caches | machine / network | varies | not you |

Two rows on that table are routinely confused with the rest.

**The persistence context is not a performance cache.** It exists so that one row maps to
one object inside a unit of work, and skipping a `SELECT` is a side effect of that
guarantee — the argument is made in full in
[../06-jpa-hibernate-model/11b-find-that-issues-no-sql.md](../06-jpa-hibernate-model/11b-find-that-issues-no-sql.md).
It cannot help across transactions because it dies with them, and it never answers a
query.

**The database is already caching, and it is better at it than you are.** PostgreSQL holds
recently-read pages in `shared_buffers` and the operating system holds more of them in the
page cache. A repeated query against a small hot table is usually not touching a disk at
all; what it is paying is parse, plan, execute and network round-trip. That is a real cost
and worth removing — but it is a *smaller* cost than "we read from disk every time", which
is the mental model most caching proposals are built on. Hibernate's own performance
chapter puts database tuning first for exactly this reason, listing "tuning the underlying
database cache so that the working set fits into memory" ahead of adding a second-level
cache at all.

## The order that keeps you honest

Caching is the last of four moves, not the first.

**1 · Fix the query shape.** A page that issues 101 statements issues 101 statements on a
cold cache too, which is every deploy and every scale-up. Everything in
[../08-the-n-plus-1-problem/README.md](../08-the-n-plus-1-problem/README.md) changes the
statement count unconditionally; a cache changes only how often you pay it.

**2 · Index it.** A missing index makes a query slow every time it actually runs. Putting a
cache in front of it means the query still runs — on every miss, every eviction, every new
key — and now you are slow *and* stale. This is the argument the topic closes on, in
[8 · The query you should have indexed](08-when-not-to-cache.md).

**3 · Return less.** A projection that fetches four columns instead of forty is faster to
plan, faster to transfer, cheaper to map and cheaper to cache if you later do cache it.

**4 · Then cache**, for data with a genuinely high read-to-write ratio, a tolerable
staleness budget, and a key space small enough that entries are read more than once.

The order matters because steps 1–3 are *free of consistency risk* and step 4 is not. A
team that reaches step 4 first never goes back — the cache hides the symptom, the profile
goes quiet, and the underlying query stays wrong until something evicts at the worst
possible moment.

## Where the win actually comes from

It is worth being specific about what a cache removes, because it shapes what is worth
caching.

- **The round-trip.** Connection acquisition, network latency, parse, plan, execute, fetch,
  and the mapping of a result set into objects. On a small query the mapping and the
  round-trip dominate; the database work is trivial.
- **Contention.** A read that never reaches the database is a read that never competes for
  a connection from the pool, which matters far more under load than the query's own cost.
- **Downstream cost.** If the "query" is actually a call to another service or a
  computation over many rows, the cache removes something genuinely expensive rather than
  something merely repetitive.

And what a cache does **not** remove: the cost on a miss. A cache turns a uniform cost into
a bimodal one — fast on hits, unchanged on misses — which means your latency distribution
grows a second peak rather than shifting. The mean improves and the tail does not. If your
problem is described in terms of a p99, a cache is often the wrong tool, because the p99 is
made of misses.

## The read-to-write ratio is the whole argument

A cache earns its place when the same key is read many times between writes. Two shapes
fail that test and both are common.

**Write-heavy data.** Every write invalidates, so the entry is thrown away before it is
read twice. You pay memory, serialization and invalidation traffic for a hit rate near
zero.

**A large key space read once each.** A monthly report that touches every order once has no
second read to serve. Worse, it fills the cache with entries nobody will ask for again and
evicts the entries that were helping other endpoints. Caches are hurt by sequential scans in
exactly the way an LRU is hurt by them.

The shape that works is small, hot and boring: reference data, configuration, catalogues,
lookup tables, currency rates, feature flags — things read on every request and changed by a
human occasionally.

## Gotchas

**★ "The cache made it fast" and "the cache made it correct" are never the same claim, and
only one of them is ever tested.** Load tests measure the first. Nothing in a normal test
suite measures the second, because staleness is invisible unless you assert on it
deliberately.

**★ A cache added to hide a slow query removes your only signal that the query is slow.**
The profile goes quiet, the dashboard goes green, and the next person to touch that code
has no idea it was ever a problem — until an eviction storm makes every request take the
slow path at once.

**★ The persistence context is not the thing you are turning on.** People say "Hibernate
already caches" and mean the identity map, which cannot survive a transaction boundary and
never answers a query.

**★ Caching correctly is easy; *un*caching correctly is not.** Adding `@Cacheable` is one
line. Working out every code path that must evict it — including the ones written next
year, and the ones in other services, and the DBA's `UPDATE` — is the whole cost, and it
does not appear in the diff.

**★ The staleness window is not the TTL.** It is the TTL *plus* however long the write took
to reach the store that evicts, *plus* replication lag if you read from a replica, *plus*
the interval on any scheduled refresh. Teams quote the TTL and are surprised by the sum.

**★ A cache is a availability dependency you may not have priced.** If the store is remote,
your read path now fails when Redis fails, unless you wrote the fallback. A local map has
the opposite problem: it never fails, and it never agrees with the other pods.

**★ Memory is not free and its failure mode is not gradual.** An unbounded local cache is a
slow heap leak that ends in a garbage-collection death spiral, and it will look fine in
every environment whose data set is smaller than production's.

**★ "We'll add a short TTL to be safe" is usually the worst of both.** Short enough to keep
the hit rate low, long enough to serve wrong answers. If the staleness budget is genuinely
seconds, the honest question is whether the read needed caching at all.

**★ Caching the same fact at three layers means one write must invalidate three copies with
three different lifetimes.** An HTTP response cache, a method cache and a second-level cache
over the same data are not additive — the outermost one wins, and it is usually the one nobody
remembered to evict.

**★ Cache warming is a second system, not a setting.** Deciding to pre-populate on startup
means a job that reads a large slice of the database on every deploy, multiplied by the number
of pods in a rolling deploy, at exactly the moment the new version is least proven.

**★ "Cache hit rate" is not a health metric on its own.** A 99% hit rate on data nobody
should be caching is a 99% rate of serving stale answers. The metric that means something is
hit rate paired with a staleness bound you agreed in advance.


## Interview questions

**★ What are you actually trading when you add a cache?**
Correctness for latency, and the units are worth stating. I am agreeing to serve answers
that may be out of date by some window, in exchange for not doing the work that would make
them current. So the first thing I want to establish is the staleness budget for that
specific data and who is hurt when it is exceeded — a product description being two minutes
stale is nothing, an account balance being two minutes stale is a defect. If I cannot write
the sentence "we will serve this data up to X stale because it is read Y times per write
and a stale answer costs Z", I do not yet understand the change well enough to make it.

**★ Someone proposes caching to fix a slow endpoint. What do you ask first?**
Why it is slow. If it is slow because it issues a hundred queries, a cache makes the
hundred queries less frequent rather than fewer, and they all come back on the next cold
start — which is a deploy, a scale-up or an eviction, all of which happen when the system
is already stressed. If it is slow because of a missing index, a cache means the query is
still slow whenever it runs and now the answer can also be wrong. Caching is a reasonable
fourth move after fixing the fetch plan, the index and the amount of data returned; as a
first move it is usually a way of not diagnosing the problem.

**★ Why does a cache improve the mean but not the p99?**
Because the p99 is made of misses. A cache does not shift the latency distribution, it
splits it into two — a fast peak for hits and the original cost for everything else. If the
hit rate is 95%, the slowest 1% of requests are entirely misses, and they cost exactly what
they cost before, plus the cache lookup you added. That is why "our p99 is bad" and "let us
add a cache" are usually a mismatch, and why a cache can look like a huge win on an average
and change nothing a user complains about.

**★ Which caches are already running before you add one?**
In a normal Spring Boot and Hibernate service: the persistence context inside every
transaction, PostgreSQL's own buffer cache, the operating system's page cache, and whatever
HTTP caching sits in front. The second-level cache and the query cache exist but are off
unless someone turned them on. Being explicit about this matters because "we should cache
the database" is often a proposal to add a fourth copy of pages that are already in memory
twice — the cost being removed is the round-trip and the mapping, not disk I/O, and that
changes what is worth caching.

**★ What kind of data is a good cache candidate?**
Small, hot, and boring. Read far more often than it is written, small enough that entries
are read again before they are evicted, and tolerant of some staleness. Reference data,
configuration, catalogue text, currency rates, feature flags. The shapes that fail are
write-heavy data, where the entry is invalidated before it is read twice, and large key
spaces read once each — a report that scans a month of orders has no second read to serve
and will evict everything that was helping somebody else.

**★ Is caching ever a correctness improvement rather than a cost?**
Rarely, and it is worth being suspicious when someone claims it. The one honest version is
protecting a fragile dependency: if a downstream service rate-limits you or falls over under
load, a cache in front of it reduces the number of calls and can keep you serving during an
outage. But notice that is an availability argument, not a correctness one — you are
choosing to serve stale data rather than no data, which is still the same trade with the
alternative being an error page instead of a slow page.

**★ How would you decide the TTL?**
By working backwards from the staleness budget rather than forwards from the hit rate. The
budget comes from whoever owns the consequence of a wrong answer, not from engineering. Then
I would check that the TTL is not the only invalidation mechanism — a TTL alone means every
write is stale for the full window, which is usually unacceptable for anything a user just
changed. The common shape is explicit eviction on write for freshness plus a TTL as a
backstop against evictions that were missed, and the TTL exists to bound the damage of a bug
rather than to be the design.

**★ What does a cache cost that does not appear in the pull request?**
The eviction paths that do not exist yet. A `@Cacheable` is one line and self-contained; the
obligation it creates is that every future write to that data, from anywhere — this service,
another service, a migration, a manual `UPDATE` — must evict it, and nothing enforces that.
It also adds a memory budget with a non-gradual failure mode if the cache is local, a network
dependency if it is remote, a serialization format that becomes a compatibility surface, and
a cluster-coherence problem the moment there are two instances. None of that is exotic; all
of it arrives with the annotation and none of it is visible in the diff.

{/* FOOTER */}
