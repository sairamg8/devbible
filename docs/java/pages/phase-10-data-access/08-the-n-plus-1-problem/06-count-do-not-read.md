---
title: "Stop reading the SQL log and start counting it — Hibernate keeps the numbers for you, and two of them name the bug directly"
sidebar_label: "6 · Count, do not read"
sidebar_position: 12
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 *A Short Guide to Hibernate 7*
> §8.17 *Collecting statistics*
> ([docs.hibernate.org/orm/7.4/introduction/html_single/](https://docs.hibernate.org/orm/7.4/introduction/html_single/Hibernate_Introduction.html))
> and the `org.hibernate.stat.Statistics` interface in the Hibernate 7.4 source
> ([github.com/hibernate/hibernate-orm](https://github.com/hibernate/hibernate-orm/blob/7.4/hibernate-core/src/main/java/org/hibernate/stat/Statistics.java)).
> JDK 25, Spring Boot 4.1.1, Hibernate ORM 7.4.1.

**N+1 is defined by a number, so the diagnostic should produce a number.
Hibernate already keeps that number — and it keeps a pair of counters whose
*difference* is close to a direct measurement of the bug. This chunk is what
those counters are and how to read them; [chunk 6b](06b-asserting-the-count-in-a-test.md)
turns them into a test that fails the build.**

## Switch it on

One property. The Hibernate guide states it plainly: *"We may ask Hibernate to
collect statistics about its activity by setting this configuration property"* —
`hibernate.generate_statistics`, set to `true` to enable collection.

In a Boot application:

```yaml
spring:
  jpa:
    properties:
      hibernate:
        generate_statistics: true
```

⚠️ It is not free. Every statement, load and cache access updates counters, so
this is a development and test setting, and in production it is something you
turn on deliberately — or expose as metrics, which is the honest production
answer and is covered below.

## The object

Statistics hang off the `SessionFactory`. From a Spring application you reach it
by unwrapping the `EntityManagerFactory`:

```java
@Component
class HibernateStats {

    private final Statistics statistics;

    HibernateStats(EntityManagerFactory emf) {
        this.statistics = emf.unwrap(SessionFactory.class).getStatistics();
    }

    long statements() { return statistics.getPrepareStatementCount(); }
    void reset()      { statistics.clear(); }
}
```

The guide's own example uses the same route:

```java
long failedVersionChecks =
        sessionFactory.getStatistics().getOptimisticFailureCount();
```

## The counters that matter here

There are dozens on the interface. Four of them are about this problem, and
their javadoc from the 7.4 source is quoted verbatim:

| Method | Javadoc | What it tells you |
|---|---|---|
| `getPrepareStatementCount()` | *"The number of prepared statements that were acquired."* | **the total round trips** — the closest thing to the number in "101 queries" |
| `getQueryExecutionCount()` | *"The global number of executed queries."* | HQL/JPQL/criteria queries only, not proxy initialisations |
| `getEntityFetchCount()` | *"The global number of entity fetches."* | to-one associations resolved with their own select |
| `getCollectionFetchCount()` | *"The global number of collections fetched."* | collections initialised with their own select |

### The load/fetch pair is the direct measurement

This is the part most people never learn, and it is the reason to use statistics
rather than counting log lines.

Hibernate keeps **two** counters for entities and **two** for collections:

- `getEntityLoadCount()` — *"The global number of entity loads"*
- `getEntityFetchCount()` — *"The global number of entity fetches"*
- `getCollectionLoadCount()` — *"The global number of collections loaded"*
- `getCollectionFetchCount()` — *"The global number of collections fetched"*

**"Load" counts how many were materialised. "Fetch" counts how many needed their
own extra statement to do it.** An association that arrived as part of a join
fetch is loaded but not fetched. An association that had to go back to the
database on its own is both.

So:

- `collectionFetchCount == 0` after your unit of work means **no collection
  caused a secondary select**, which is what a correct fetch plan looks like.
- `collectionFetchCount == N` means exactly the bug — one secondary select per
  parent.
- The same reading applies to `entityFetchCount` for `@ManyToOne` and
  `@OneToOne`.

That is a far sharper instrument than a raw statement count, because it tells you
not just *how many* but *which kind* — and therefore which fix to reach for.

```java
statistics.clear();
service.summarise();

long statements  = statistics.getPrepareStatementCount();
long collFetches = statistics.getCollectionFetchCount();   // ← the N in N+1
long entFetches  = statistics.getEntityFetchCount();       // ← the to-one N
```

If `collFetches` is large, you need a fetch plan for a collection —
[chunk 8](08-join-fetch.md) or [chunk 9](09-entity-graph.md). If `entFetches` is
large, you have a to-one that is lazy-and-unfetched or eager-and-unjoined —
[chunk 4](04-the-shapes-it-hides-in.md) shape 2.

### Why `getQueryExecutionCount()` is not the one to use

It counts *queries* — HQL, JPQL and criteria executions. A lazy collection
initialising itself is not a query in that sense; it is a collection load. So an
endpoint with a textbook N+1 can show `queryExecutionCount == 1` while issuing
101 statements. Use it to count how many queries your code *asked for*, and
`getPrepareStatementCount()` to count how many the database actually *received*.
**The gap between those two numbers is where N+1 lives**, and comparing them is
a good first look at an unfamiliar service.

## Per-entity and per-collection detail

Once the aggregate numbers say something is wrong, two accessors narrow it down
without touching a log:

```java
CollectionStatistics lines =
        statistics.getCollectionStatistics("com.example.Order.lines");

EntityStatistics customer =
        statistics.getEntityStatistics("com.example.Customer");
```

The collection role is the fully-qualified entity name plus the field name, and
the entity name is the fully-qualified class name unless you renamed it with
`@Entity(name = …)`. This is the fastest way to answer "which association is
doing it" in an application with many.

There is also `logSummary()`, which dumps the whole set of counters in one go —
useful at the end of a test run to see everything at once.

## In production: metrics, not statistics

Reading counters by hand is a development activity. In production the same
numbers belong on a dashboard, and the guide says this is supported directly:

> *"Hibernate's statistics enable observability. Both Micrometer and SmallRye
> Metrics are capable of exposing these metrics."*

With Micrometer on the classpath, Boot binds Hibernate's statistics into the
metrics registry, so `collectionFetchCount` and the rest become time series you
can graph and alert on. That converts this chapter's whole argument into
something continuous: **a rising `collection fetch` rate that is not matched by a
rising request rate is an N+1 appearing**, and it is one of the very few
performance regressions you can alert on before a user notices.

⚠️ Statistics collection is not free, so treat enabling it in production as a
decision with a cost, and measure that cost on your own workload rather than
assuming either way.

## Gotchas

**⚠️ Forgetting `clear()` before the code you are measuring.**
The counters are cumulative over the whole `SessionFactory` from startup. Without
a reset you are reading the total for everything the application has ever done,
including context loading and schema validation.

**⚠️ Using `getQueryExecutionCount()` as "how many queries ran".**
It counts HQL/JPQL/criteria executions, not statements. A perfect N+1 can report
1. `getPrepareStatementCount()` is the statement count.

**⚠️ Reading the counters while other threads are working.**
They are global to the `SessionFactory`, not per-request or per-thread. In a
concurrent application the number you read includes everything every other thread
did in the same window, which is exactly why the assertion in
[chunk 6b](06b-asserting-the-count-in-a-test.md) belongs in a single-threaded
test rather than in a running service.

**⚠️ Leaving `generate_statistics` on by default in production.**
Every statement and every load updates counters. Enable it deliberately, or
expose the numbers through Micrometer where the cost is a considered trade rather
than an accident.

**⚠️ Expecting statistics to see non-Hibernate statements.**
A `JdbcClient` call, a second datasource or a native driver call does not touch
these counters. If part of your data access is outside Hibernate, count at the
JDBC layer instead — [chunk 6c](06d-proxies-and-agents.md).

**⚠️ Getting the collection role wrong and reading zeros.**
`getCollectionStatistics` wants the *role*, which is the fully-qualified owning
entity name plus a dot plus the field name — `com.example.Order.lines`, not
`lines` and not `OrderLine`. A wrong role returns an object full of zeros rather
than an error, which reads like "no problem here".

**⚠️ Assuming `entityFetchCount` of zero means no to-one N+1.**
It means no to-one association needed a secondary select *in this window*. If a
previous unit of work already loaded those entities into the same persistence
context or the second-level cache, the fetch never happens and the counter stays
flat — while a cold call would have shown N. Measure from a clear context.

## Interview questions

**★ How do you enable and read Hibernate's statistics?**
Set `hibernate.generate_statistics` to `true` — in Boot, as
`spring.jpa.properties.hibernate.generate_statistics`. The counters then hang off
the `SessionFactory`, which you reach from Spring by unwrapping the
`EntityManagerFactory`:
`emf.unwrap(SessionFactory.class).getStatistics()`. The object exposes a large
set of counters; `clear()` resets them, and `logSummary()` dumps them all. Two
practical points: the counters are cumulative from startup and global to the
factory, so you must reset before the code you are measuring and you must not be
sharing the factory with other active threads; and collection costs something on
every statement, so it is a development and test setting unless you have decided
to pay for it.

**★ Which statistic actually measures N+1?**
`getCollectionFetchCount()` and `getEntityFetchCount()`, and the reason is the
distinction Hibernate draws between *load* and *fetch*. Load counts how many
entities or collections were materialised; fetch counts how many of them required
their own additional statement to do it. So an association that arrived as part
of a join fetch increments load and not fetch, whereas one that had to go back to
the database on its own increments both. That means a collection fetch count of
zero after a unit of work is precisely what a correct fetch plan looks like, and
a count equal to the number of parents is precisely the bug. It is sharper than a
raw statement count because it tells you which *kind* of association caused it,
and therefore whether you need a fetch plan for a collection or for a to-one.

**★ Why is `getQueryExecutionCount()` misleading here?**
Because it counts queries in the HQL/JPQL/criteria sense — things your code
asked for — and a lazy collection initialising itself is not one of those. So a
method with a textbook 101-statement N+1 can report a query execution count of 1,
which reads like a clean bill of health. The statement count is
`getPrepareStatementCount()`, documented as the number of prepared statements
acquired. The genuinely useful move is to look at both: query execution count is
how many queries your code requested, prepared statement count is how many the
database received, and the gap between them is exactly the work the framework did
on your behalf without being asked. A large gap is the signature of this bug.

**★ Statistics are global to the `SessionFactory`. What does that stop you
doing?**
It stops you attributing statements to a request in a running, concurrent
application. The counters are process-wide and cumulative, so between your reset
and your read every other thread's work is also being counted, and there is no
per-session or per-request view to filter to. That is why the reliable use of
statistics is in a single-threaded integration test, where you control what
happens between `clear()` and the read. For production the answer is different:
bind the statistics into Micrometer, which the Hibernate guide names as a
supported route, and watch *rates* rather than absolute counts — a collection
fetch rate rising without a matching rise in request rate is an N+1 appearing,
and that signal survives concurrency because it is aggregate by design.

**★ You inherit a service and want a five-minute assessment of its fetching. What
do you do?**
Turn on `generate_statistics`, exercise the main endpoints against data with
realistic fan-out, and compare two numbers: query execution count against
prepared statement count. If they are close, the code is getting what it asks
for. If prepared statements vastly exceed query executions, the framework is
issuing statements you did not request, and `getCollectionFetchCount()` and
`getEntityFetchCount()` tell you whether that is collections or to-ones. Then use
`getCollectionStatistics(role)` to name the specific association. That whole
sequence is four numbers and no log reading, and it gives you the shape of the
problem before you have opened a single entity class. Only then is it worth
turning on `org.hibernate.SQL` to see the actual statements.

**★ Can you use this as a continuous production signal rather than a one-off
check?**
Yes, and it is one of the few performance regressions where that genuinely works.
With Micrometer bound to Hibernate's statistics — which the guide names as
supported, alongside SmallRye Metrics — the counters become time series, and the
useful alert is not on an absolute number but on a ratio: statements per request,
or collection fetches per request. Both should be roughly constant for a given
endpoint, because a correct fetch plan issues a fixed number of statements
regardless of how many rows come back. When that ratio starts climbing, either
someone removed a fetch plan or the data grew into a path that never had one.
Alerting on a ratio rather than a latency percentile is what lets you catch it
before it becomes an incident, since the latency does not move until the
arithmetic has already got bad.

---

← Prev: [5b · Why show-sql is not it](05b-show-sql-is-not-the-answer.md) · Index: [08 · The N+1 problem](README.md) · Next → [6b · Asserting the count](06b-asserting-the-count-in-a-test.md)
