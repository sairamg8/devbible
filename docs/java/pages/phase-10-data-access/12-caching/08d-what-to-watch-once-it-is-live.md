---
title: "Once a cache is running, every meter you have describes the cache and none of them describes the thing you traded away — so you alert on the miss ratio rather than the hit ratio, you verify against the database's own call counts, and you build the staleness check yourself because nothing can emit it"
sidebar_label: "8d · What to watch once it is live"
sidebar_position: 33
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the Micrometer 1.17 reference *Micrometer Cache Instrumentations*
> ([docs.micrometer.io/micrometer/reference/reference/cache.html](https://docs.micrometer.io/micrometer/reference/reference/cache.html)),
> the Spring Boot 4.1 reference *Metrics → Supported Metrics and Meters* (*Cache Metrics*,
> *Hibernate Metrics*, *Spring Data Repository Metrics*)
> ([docs.spring.io/spring-boot/reference/actuator/metrics.html](https://docs.spring.io/spring-boot/reference/actuator/metrics.html)),
> the Hibernate ORM 7.4 *User Guide* §14.9 *Caching statistics*
> ([docs.hibernate.org/orm/7.4/userguide/](https://docs.hibernate.org/orm/7.4/userguide/html_single/Hibernate_User_Guide.html))
> and the PostgreSQL 18 documentation *F.32 pg_stat_statements*
> ([postgresql.org/docs/18/pgstatstatements.html](https://www.postgresql.org/docs/18/pgstatstatements.html)).
> JDK 25, Spring Boot 4.1.0, Hibernate ORM 7.4.1, Micrometer 1.17, PostgreSQL 18.

**[8c](08c-what-to-measure-first.md) is the evidence you gather before the annotation.
This is the evidence afterwards — and its defining feature is an absence: every meter available to
you reports on the cache's own behaviour, and the property the cache put at risk has no meter at
all, in any library, by construction.**

## Alert on the miss ratio, not the hit ratio

Micrometer's own guidance inverts the metric people reach for, and the reason is a degenerate case
rather than a philosophy:

> *"In a real-world scenario, we tune caches according to how we evaluate the tradeoff between
> storage and load efficiency. You could create an alert based on some upper bound for the rate at
> which misses occur or on a lower bound for the hit ratio. Setting an upper bound on the miss ratio
> is better than a lower bound on the hit ratio. For both ratios, an absence of any activity drops
> the value to 0."*

A lower-bound alert on hit ratio fires when traffic stops, because zero requests give a ratio of
zero. So the alert meant to tell you the cache stopped working also fires every night, every deploy,
and every time traffic shifts elsewhere — and an alert that fires routinely is an alert nobody reads
when it matters. An upper bound on the miss ratio degrades toward zero in exactly the same
situation, which is the harmless direction.

Micrometer's counters are built for this shape deliberately:

> *"Micrometer uses a function-tracking counter to monitor such things as hits and misses, giving you
> a notion not only of hits and misses over the total life of the cache (the basic metric exposed
> from Guava's `CacheStats`, for example) but hits and misses inside a given interval."*

The interval matters more than the lifetime figure. A cache's lifetime hit ratio is dominated by
whenever it was last warm; the rate over the last few minutes is what tells you the fleet just
restarted, a key space started growing, or an eviction went wholesale
([7e](07e-the-writes-the-cache-never-sees.md)).

## Verify against the database, not against the cache

The cache's own meters can look entirely healthy while the cache is on the wrong path. Two failure
modes present as a full cache with no reduction in database work:

- **A self-invocation.** The proxy is never entered, so neither the cache nor its meters see the
  call at all ([2b](02b-the-proxy-again.md)).
- **A key that never repeats.** Every call is a miss followed by a write, so the cache fills, the
  entries are real, and nothing is ever read twice ([3d](03d-the-key-that-never-repeats.md)).

The check that catches both is the database's own count of that statement. `pg_stat_statements`
*"provides a means for tracking planning and execution statistics of all SQL statements executed by
a server"*, with one row per distinct normalised statement — so the question "did the call count for
this query fall after we added the cache?" has an exact answer that does not depend on any meter
your application exposes.

Hibernate gives you the in-process version of the same number:

> *"If you enable the `hibernate.generate_statistics` configuration property, Hibernate will expose
> a number of metrics via `SessionFactory.getStatistics()`. Hibernate can even be configured to
> expose these statistics via JMX."*

Boot binds them given the right artifact:

> *"If `org.hibernate.orm:hibernate-micrometer` is on the classpath, all available Hibernate
> `EntityManagerFactory` instances that have statistics enabled are instrumented with a metric named
> `hibernate`. … To enable statistics, the standard JPA property `hibernate.generate_statistics` must
> be set to true."*

```yaml
spring:
  jpa:
    properties:
      "[hibernate.generate_statistics]": true
```

⚠️ **Both switches are required and neither is implied by enabling the second-level cache.** Turning
on a region factory does not turn on statistics, and turning on statistics without
`hibernate-micrometer` leaves them reachable only through `SessionFactory.getStatistics()` or JMX.

The statistics do expose per-region cache counts —
`statistics.getDomainDataRegionStatistics(region)` yields `getHitCount()` and `getMissCount()` — but
the number to look at first is the **statement count**, because that is the one that says whether the
cache changed the work rather than whether it changed its own ratio
([`../06-jpa-hibernate-model/18b-the-statistics-you-actually-read.md`](../06-jpa-hibernate-model/18b-the-statistics-you-actually-read.md)).

Boot also instruments the layer above without being asked: *"Auto-configuration enables the
instrumentation of all Spring Data Repository method invocations. By default, metrics are generated
with the name, `spring.data.repository.invocations`."* That gives you per-repository-method call
counts and timings, which is often the fastest way to see that a cached service method stopped
calling its repository — or did not.

## Watch the endpoint's tail, not the cache's latency

A cache splits the latency distribution rather than shifting it ([1](01-caching-is-a-decision.md)):
a fast peak for hits, the original cost for everything else, plus the lookup you added to every
request. So the mean improves by construction and tells you almost nothing, while the tail is made
almost entirely of misses and is therefore the number that reflects what a struggling user
experiences.

This is also why "the cache is fast" is not the claim to test. The cache's own timer measures the
store; the question is what the endpoint costs, including the misses, including the cache lookup on
the hit path, and including whatever the fallback does when the store is unreachable
([5d2](05d2-when-the-cache-is-down.md)).

## The meter that does not exist

🔴 **There is no metric for "this answer was wrong."** No cache library emits one and none could: the
cache returned exactly the value it was given, and it has no access to the value that would have been
correct. Every meter in this chunk describes throughput, ratios and latency — the things the cache
was supposed to improve — and none of them describes correctness, which is the thing the cache put at
risk.

If staleness matters enough to detect, the mechanism has to be built:

```java
@Scheduled(fixedDelayString = "PT5M")
void auditFreshness() {
    for (long id : sampleOfHotKeys()) {
        Product cached = catalogue.byId(id);            // through @Cacheable
        Product fresh  = repository.findById(id).orElse(null);   // straight to the database
        if (!Objects.equals(cached, fresh)) {
            meterRegistry.counter("cache.staleness", "cache", "products").increment();
            log.warn("stale cache entry for product {}", id);
        }
    }
}
```

Four things about that job are worth stating, because it is easy to build a version that lies:

- **The fresh read must genuinely bypass the cache**, which means a different method, or a repository
  call, not the cached one with a flag. It must also bypass the persistence context, so it needs its
  own transaction ([`../06-jpa-hibernate-model/11b-find-that-issues-no-sql.md`](../06-jpa-hibernate-model/11b-find-that-issues-no-sql.md)).
- **A disagreement is not automatically a bug.** An entry younger than the agreed staleness budget is
  behaving as designed; the alert threshold is the budget from [1](01-caching-is-a-decision.md), not
  zero.
- **It runs per pod**, which is a feature: with a local cache it is the only thing that will ever show
  you that two instances disagree ([7b](07b-caching-in-a-cluster.md)).
- **It must not repopulate what it is auditing.** Reading through the cached path is fine — that is
  the point — but the fresh read must not be `@CachePut`-annotated or the audit becomes the
  invalidation.

Almost nobody has this job, which is the honest explanation for why cache bugs are discovered by
users. It is also a useful forcing function at design time: if nobody is willing to build the check,
that is information about how much the freshness was really worth.

## Gotchas

**★ A lower-bound alert on hit ratio fires when traffic stops.** Micrometer says an upper bound on
the miss ratio is the better shape, because for both ratios an absence of activity drops the value to
zero.

**★ The lifetime hit ratio is dominated by history.** Use the rate over an interval; that is what
Micrometer's function-tracking counters exist for, and it is what shows a fleet restart or a growing
key space.

**★ A healthy-looking cache can be entirely off the path.** A self-invocation and a never-repeating
key both produce a full cache, plausible meters, and no reduction in database work.

**★ The check that catches both is the database's call count, not any application meter.**
`pg_stat_statements` has one row per normalised statement, so "did this query get called less?" has an
exact answer.

**★ Hibernate statistics need two things and the second-level cache implies neither.**
`hibernate.generate_statistics` must be true *and* `hibernate-micrometer` must be on the classpath
before anything reaches your registry.

**★ Reading the region hit ratio before the statement count is the wrong order.** The statement count
says whether the cache changed the work; the ratio only says whether the cache is busy.

**★ The mean improves by construction and means nothing.** A cache splits the distribution, so the
tail is the number that reflects a user's worst experience — and the tail is made of misses.

**★ The cache's own timer measures the store, not the endpoint.** A fast Redis and a slow endpoint
are entirely compatible, especially once the fallback path is involved.

**★ No library can emit a staleness metric.** The cache returned what it was given and has no access
to the correct value; every meter you have describes what the cache was supposed to improve and none
describes what it put at risk.

**★ A freshness audit that reads through the cached path twice proves nothing.** The comparison read
must bypass the cache and the persistence context, in its own transaction.

**★ A freshness audit with a zero-disagreement threshold will page you constantly.** An entry younger
than the agreed staleness budget is behaving correctly; the budget is the threshold.

**★ A freshness audit is per pod, and that is the point.** With a local cache it is the only
instrument that will ever reveal that two instances disagree.

## Interview questions

**★ Why does Micrometer recommend alerting on the miss ratio rather than the hit ratio?**
Because of the degenerate case. A hit ratio is hits over total requests, so with no requests it is
zero — a lower-bound alert on hit ratio fires every time the system goes quiet, at night, during a
deploy, whenever traffic moves elsewhere. An upper-bound alert on the miss ratio degrades in the
harmless direction under exactly the same conditions. The documentation states it directly: an upper
bound on the miss ratio is better than a lower bound on the hit ratio, because for both ratios an
absence of activity drops the value to zero. It is a small point that prevents a lot of alert
fatigue, and alert fatigue is how a real cache regression gets ignored.

**★ How would you tell whether a cache you added is actually being used?**
Not from the hit rate, which can look entirely plausible while the cache sits off the path. I would
look at the database's view: the call count for that normalised statement in `pg_stat_statements`,
or Hibernate's statement count with `generate_statistics` enabled, before and after. If the statement
count has not moved, the cache is not being consulted — the two usual causes being a self-invocation,
so the proxy was never entered, and a key that never repeats, so every call is a miss followed by a
write. Both produce a cache full of real entries and no reduction in database work, and neither is
visible from the cache's own meters. Boot's `spring.data.repository.invocations` metric gives the
same signal one layer up and requires no configuration at all.

**★ Your cache has a good hit rate and the endpoint's p99 has not improved. Explain.**
Because the p99 is made of misses. A cache does not shift the latency distribution, it splits it into
a fast peak for hits and the original cost for everything else, plus the lookup you added to every
request. If the hit rate is high, the slowest requests are almost entirely misses and they cost what
they always cost. So the mean improves, the dashboard looks better, and the users who were
complaining are still complaining. That is the diagnostic signature of a cache applied to a problem
whose real cause is the cost of the underlying operation — which means the fix is in the plan, the
fetch or the amount of data returned, and the cache was treating the symptom.

**★ How do you monitor for staleness?**
You build it, because nothing emits it. A cache library cannot report a stale answer, since it has no
idea what the correct value was — it returned exactly what it was given. So if staleness is a risk
worth detecting, the mechanism is a scheduled job that samples hot keys, reads each value both
through the cache and directly from the database in a fresh transaction, and alerts when they
disagree by more than the agreed budget. Three details decide whether the job is honest: the fresh
read must genuinely bypass both the cache and the persistence context; the threshold must be the
staleness budget rather than zero, or it pages constantly on entries behaving as designed; and the
audit must not itself write to the cache. It runs per pod, which is a feature — with a local cache it
is the only instrument that ever shows two instances disagreeing.

**★ What metrics do you enable on day one for a service with a Hibernate second-level cache?**
`hibernate.generate_statistics` set to true and `hibernate-micrometer` on the classpath, because
neither is implied by turning the cache on and without both there is nothing to look at. Then the
number I actually watch is the statement count per request rather than the region hit ratio, because
the statement count answers whether the cache changed the amount of work while the ratio only says
whether the cache is busy. Alongside that, `pg_stat_statements` on the database for the outside view,
Boot's Spring Data repository invocation metrics for the layer above, and the endpoint's tail
latency. The region hit and miss counts are worth having — the `CacheRegionStatistics` object exposes
them per region — but as a diagnostic once something looks wrong, not as the headline.

**★ Is a high cache hit rate good news?**
Only in combination with something else. It says the cache is being consulted and that keys repeat,
which rules out the two silent failure modes, so it is genuinely useful. What it does not say is
whether the data should have been cached at all: a high hit rate on authorisation decisions is a high
rate of serving possibly-stale authorisation decisions. It also says nothing about the distribution
of the misses — a good average ratio is compatible with every entry expiring simultaneously, which is
the state that produces incidents. So I read it as one input next to the staleness budget somebody
agreed, the miss-rate alert, and the endpoint's tail.

{/* FOOTER */}
