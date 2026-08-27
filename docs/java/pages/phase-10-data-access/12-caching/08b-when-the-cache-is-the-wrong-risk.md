---
title: "The other half of the case against caching has nothing to do with speed: some data is wrong rather than late when it is stale, the staleness window multiplies by the number of pods, and the annotation quietly adds a failure domain and an unbounded heap allocation to the read path"
sidebar_label: "8b · When the cache is the wrong risk"
sidebar_position: 31
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the Spring Framework 7.0 reference *Understanding the Cache Abstraction*
> and *Configuring the Cache Storage*
> ([docs.spring.io/spring-framework/reference/integration/cache/strategies.html](https://docs.spring.io/spring-framework/reference/integration/cache/strategies.html),
> [docs.spring.io/spring-framework/reference/integration/cache/store-configuration.html](https://docs.spring.io/spring-framework/reference/integration/cache/store-configuration.html)),
> the Spring Boot 4.1 reference *Caching*
> ([docs.spring.io/spring-boot/reference/io/caching.html](https://docs.spring.io/spring-boot/reference/io/caching.html))
> and the Hibernate ORM 7.4 *Introduction* §8.7 *The second-level cache*
> ([docs.hibernate.org/orm/7.4/introduction/](https://docs.hibernate.org/orm/7.4/introduction/html_single/Hibernate_Introduction.html)).
> JDK 25, Spring Boot 4.1.0, Spring Framework 7.0, Hibernate ORM 7.4.1, Redis 8, PostgreSQL 18.

**[8](08-when-not-to-cache.md) argues that a cache is the wrong tool for a cost you could have
removed. This chunk argues the cases where it is the wrong tool no matter how expensive the read is
— because the data cannot tolerate being late, because the topology multiplies the window, or
because the annotation adds a failure domain and a memory budget that nobody priced.**

## Data whose staleness is a correctness bug

For most data, stale means "a bit behind". For this list, stale means **wrong**, and the distinction
is not a matter of degree: there is no TTL short enough to make it acceptable, because the failure is
qualitative.

| Data | Why a stale answer is a defect, not a delay |
|---|---|
| Authorisation decisions, roles, permissions | a revoked user retains access for the staleness window |
| Account balances, credit limits, stock levels | a customer spends money or buys inventory that is not there |
| Prices at the point of sale | you are contractually bound to a number your system invented |
| Feature flags used as kill switches | the switch you flip during an incident does nothing for the TTL |
| Rate limits and quotas | the limit is enforced per pod per window instead of globally |
| Idempotency and deduplication keys | the "already processed" check misses and the work runs twice |
| Session state and CSRF or nonce checks | a value that must be single-use is served twice |
| Anything a user just changed and is looking at | read-your-own-writes is violated and it looks like data loss |

Three rows deserve more than a line.

**The kill switch fails at the worst possible time.** A feature flag cached for five minutes is a
flag that cannot be used to stop an incident, and the person flipping it will assume it worked and
move on to the next hypothesis. If flags are cached at all, the TTL is something the incident runbook
has to state, and the invalidation path has to be exercised often enough to be trusted — a path used
twice a year is a path that does not work.

**Rate limits and idempotency keys fail in a way that looks like success.** A per-pod cached counter
does not enforce a limit, it enforces the limit *times the number of pods*, silently and only under
load. A cached "already processed" check that misses re-runs the work; if the work is a payment, the
cache is now a financial defect. Neither produces an error anywhere.

**Read-your-own-writes is the one teams actually ship.** The trade sounds acceptable in the abstract
and is unacceptable in the specific: a user saves a profile, is redirected to it, and sees the old
value. Nothing is broken, no exception is thrown, and the support ticket says *"it did not save"*.
[7](07-invalidation.md) shows why even a transaction-aware cache does not close this — the window
between the commit and the after-commit eviction is exactly where that redirect lands.

⚠️ There is a fourth category that is not about correctness at all: **a cached copy of personal data
is a copy your deletion and export paths have to reach.** If a user's data must be removed on request,
every store holding a copy is in scope, and a Redis instance with no TTL holding serialized customer
objects is a copy that no `DELETE` statement touches. That is a design consequence of the annotation,
and it does not appear in the diff either.

## The staleness window is per pod, and it multiplies

With a local cache the window is not the TTL — it is the TTL, independently, on every instance, with
no coordination between them. [7b](07b-caching-in-a-cluster.md) argues this in full. The reason it
belongs on a list of reasons *not* to cache is that **the deployment topology decides whether the
annotation is correct, and the topology is not visible in the code that makes the decision.** The
same three lines are correct on one instance and wrong on three, and nothing in the diff, the tests
or a local run distinguishes them.

Spring's reference is explicit that this is not the framework's problem:

> *"The caching abstraction has no special handling for multi-threaded and multi-process
> environments, as such features are handled by the cache implementation."*

So the question to answer before the annotation is: **is one pod's answer allowed to disagree with
another pod's?** If no, a local cache is not an option, and a shared one brings the whole of
[5 · Redis as the store](05-redis-as-the-store.md) with it — a wire format, a network hop, a TTL
decision and a failure domain. If yes, say so out loud, because it is a statement about the product
rather than about the code.

⚠️ Autoscaling makes this worse in a way that is easy to miss. Each new pod starts with an empty
cache and warms it from whatever the database says *at that moment*, so a fleet that scales during
the day contains caches populated at different times with different values, and the answer a user
gets depends on which pod the load balancer chose.

## The cache that becomes an availability dependency

A remote cache is a second system in the read path. Boot's default `CacheErrorHandler` rethrows, so
an unreachable Redis turns every cached method into a failure rather than a miss
([5d2](05d2-when-the-cache-is-down.md)). **Adding `@Cacheable` to improve latency therefore lowered
your availability ceiling to the product of two systems' availabilities**, and nobody wrote that
down or put it in a design document.

The obvious fix trades it for a different failure. Swallow the exception in a custom handler and the
cache is bypassed, every request goes to the database at once — the full uncached load, which the
database has possibly never been sized for since the cache was added — and the cache never
repopulates, because the puts are failing too. Neither branch is wrong. The point is that both are
decisions, and adding an annotation is not the moment most teams realise they made one.

Two second-order versions of the same problem:

- **The serialization format is a compatibility surface between versions of your own application.**
  A rolling deploy has old and new pods reading each other's entries ([5b](05b-serialization-is-the-hard-part.md)).
  That is a deployment constraint the cache created.
- **A shared Redis is a shared blast radius.** Another application filling the instance, or a
  `KEYS`-based `clear()` from any client ([5d](05d-clearing-locking-and-failing.md)), degrades yours.

⚠️ A local cache has the mirror-image problem: it never fails, so it never appears in an availability
review — and it never agrees with the other pods either.

## Unbounded caches and the heap

The `simple` provider is a `ConcurrentHashMap`. Spring's own description of the `ConcurrentMap` store
is that it *"does not provide any management, persistence capabilities, or eviction contracts"*, and
Boot describes the provider as *"not really recommended for production usage"*. Put that together
with a key space that grows and you have a heap leak whose ending is not gradual: the application is
fine, fine, fine, and then spends its time in garbage collection and stops answering.

Four details make it worse than it sounds:

- **It looks fine everywhere except production**, because every other environment has a smaller data
  set than the one that fills the map.
- **You can be on it without choosing it.** The provider is auto-detected from the classpath, so a
  missing dependency in one deployment, or a `@Bean` gated on a profile, silently puts you on the
  `ConcurrentHashMap` while you believe you are on Redis. The mechanics are
  [8c](08c-what-to-measure-first.md).
- **Boot creates the caches on demand.** With `spring.cache.cache-names` unset the simple provider
  *"creates it for you"* for any name a method mentions, so a typo in a cache name is a new,
  unbounded, unmonitored cache rather than an error.
- **A heap dump shows you the map, not the mistake.** By the time it is diagnosable it is an
  incident, and the object graph tells you what filled the heap without telling you which key
  expression made the key space unbounded ([3d](03d-the-key-that-never-repeats.md)).

Redis moves the problem rather than removing it. Entries written with no TTL accumulate in a server
whose default policy is to reject writes rather than evict, which is the composed outage argued in
[5c](05c-expiry-and-eviction.md) — and there the failure lands on every other client of that
instance, not only on you.

## Gotchas

**★ Some data is wrong rather than late when it is stale, and no TTL fixes that.** Permissions,
balances, prices at the point of sale, kill switches, rate limits, idempotency keys and single-use
tokens are qualitative failures, not degrees of freshness.

**★ A cached kill switch cannot stop an incident.** Whoever flips the flag will believe it took
effect; the TTL decides when it actually does, and nobody in the incident channel knows the number.

**★ A per-pod rate limit is the limit times the number of pods.** It fails silently, only under
load, and produces no error anywhere.

**★ Read-your-own-writes is the staleness users report as data loss.** "It did not save" is the
support ticket for a cache working exactly as designed, and transaction awareness does not close the
window the redirect lands in.

**★ A cached copy of personal data is a copy your deletion path must reach.** No `DELETE` statement
touches Redis, and with no TTL the copy is indefinite.

**★ The deployment topology decides whether the annotation is correct, and it is not in the diff.**
One instance and three instances need different answers from identical code, and no test
distinguishes them.

**★ Autoscaling gives you caches warmed at different times.** Which value a user sees depends on
which pod the load balancer picked, which is the least debuggable form of inconsistency.

**★ Adding `@Cacheable` on a remote store lowers your availability ceiling.** The default error
handler rethrows, so a cache outage becomes an application outage unless you decided otherwise.

**★ The fallback path has never been load-tested.** If the cache is bypassed, the database takes the
full uncached load — a load it may not have been sized for since the day the cache was added.

**★ A rolling deploy makes the cache's wire format a compatibility contract between two versions of
your own application.** That constraint arrived with the annotation.

**★ A local cache never fails, so it never shows up in an availability review** — and it never agrees
with the other pods either.

**★ The `simple` provider has no eviction contract at all.** Spring says so in those words; with a
growing key space that is a heap leak with a non-gradual ending.

**★ A typo in a cache name creates a new cache rather than an error.** Boot's simple provider creates
caches on demand unless `spring.cache.cache-names` is set, so the misspelled cache is unbounded and
unmonitored.

**★ "It has worked for two years" is not evidence about a cache.** Staleness produces no exception,
no metric and no log line, so longevity means nobody measured the thing that would have shown the
problem.

## Interview questions

**★ Name data you would refuse to cache, and say why.**
Authorisation decisions, because staleness means a revoked user keeps access. Balances, credit limits
and stock levels, because staleness means someone spends money or buys inventory that does not exist.
Prices at the point of sale, because you are bound to the number you showed. Feature flags used as
kill switches, because a cached flag cannot stop an incident and whoever flips it will assume it did.
Rate limits and idempotency keys, because a per-pod stale copy silently multiplies the limit or
allows a duplicate — and neither raises an error. And anything a user has just edited and is looking
at, because read-your-own-writes failures arrive as "it did not save" rather than as a bug report
about caching. The common thread is that in each case stale is not a slower kind of correct, it is a
different answer with a different consequence.

**★ How does the number of instances change whether a cache is acceptable?**
It changes the staleness window from "the TTL" to "the TTL, independently, per pod, with no
coordination", and it changes the invalidation guarantee from "the entry is gone" to "the entry is
gone on the instance that handled the write". That means the same annotation can be correct on a
single instance and a defect on three, and nothing in the code, the diff or a local run distinguishes
those cases. Spring's reference says the abstraction has no special handling for multi-process
environments and leaves it to the implementation, so the choice is architectural: either the data
tolerates instances disagreeing, in which case say so explicitly, or it does not, in which case the
cache has to be shared and you have taken on a wire format, a network hop and a failure domain.
Autoscaling sharpens it further — new pods warm their caches at different times, so which value a
user sees depends on which pod answered.

**★ What does adding `@Cacheable` do to your availability?**
On a remote store it lowers it, and by default it does so in the harshest way: Boot's default cache
error handler rethrows, so if Redis is unreachable every cached method throws instead of missing.
Your read path now depends on two systems where it depended on one. Swallowing the exception is not a
free fix either — the cache is then bypassed for every request, the database takes the full uncached
load, and the puts fail too so it never warms back up. Both behaviours are defensible; what is not
defensible is arriving at one of them by not deciding. On a local cache the mirror image applies: it
never fails, so it never appears in an availability review, and it also never agrees with the other
instances.

**★ What is wrong with the default `simple` cache provider in production?**
It is a `ConcurrentHashMap`, and Spring's own description is that the `ConcurrentMap` store *"does
not provide any management, persistence capabilities, or eviction contracts"*, with Boot adding that
the provider is *"not really recommended for production usage"*. No eviction contract means no bound:
with a key space that grows, the map grows until the heap does not, and the failure is a
garbage-collection spiral rather than a gradual slowdown. It is also per-JVM, so with more than one
instance the staleness window is the lifetime of the process rather than any TTL. The dangerous part
is that you can end up on it without choosing it, because the provider is auto-detected from the
classpath — a missing dependency or a profile-gated bean is enough.

**★ A cache holds customer records. What obligations did that create?**
At least three that are nothing to do with performance. The records are now in a second store, so any
deletion or export obligation applies to it — and no `DELETE` against the database reaches Redis, so
without a TTL the copy is indefinite. The records travel over the wire in whatever serialization the
cache uses, which is a format decision with security as well as compatibility consequences
([5b](05b-serialization-is-the-hard-part.md)). And the store is shared infrastructure, so whoever can
read that Redis can read those records, which is a wider audience than whoever can query the table.
None of that is exotic; all of it arrives with a one-line annotation, and none of it is in the diff.

**★ Your cache is bypassed by a fallback. What are you worried about?**
That the database has never been asked to serve the full load. A cache that has been in place for a
year has been absorbing traffic that nobody has sized the database for, and the moment the fallback
engages, that traffic arrives at once — the same synchronised-miss problem as a cold start, except
the cache is not coming back to relieve it. So I would want the fallback path load-tested
deliberately rather than discovered during an incident, a circuit breaker or timeout so the cache
cannot make requests slower than not having it, and a decision about whether serving errors is better
than serving nothing for the specific endpoint. For a catalogue page, degrade. For a payment path,
failing is the right answer.

{/* FOOTER */}
