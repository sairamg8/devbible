---
title: "Six counters answer every question this topic raises, and the most useful reading is not any one of them but the ratio between two"
sidebar_label: "18b · The statistics you read"
sidebar_position: 39
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 *User Guide* §28.1 *`org.hibernate.stat.Statistics`
> methods* (§28.1.1–§28.1.10), §28.2 *Query statistics max size* and Appendix A.20
> ([docs.hibernate.org/orm/7.4/userguide/html_single/](https://docs.hibernate.org/orm/7.4/userguide/html_single/))
> and Spring Boot 4.1's `HibernateMetricsAutoConfiguration`
> ([github.com/spring-projects/spring-boot](https://github.com/spring-projects/spring-boot/blob/main/module/spring-boot-hibernate/src/main/java/org/springframework/boot/hibernate/autoconfigure/metrics/HibernateMetricsAutoConfiguration.java)).
> JDK 25, Spring Boot 4.1.0, Hibernate ORM 7.4.1.

**`Statistics` exposes something like sixty methods across twelve categories. For the
questions this topic raises — why did that write happen, why is this transaction slow, is
optimistic locking doing anything — six of them are enough, and the diagnostic value is
mostly in comparing them to each other.**

## The six

| Method | §28.1 says | What it tells you here |
|---|---|---|
| `getFlushCount()` | "the global number of flush operations executed (either manual or automatic)" | how many times the dirty check walked the context |
| `getEntityUpdateCount()` | "the global number of entity updates" | how many `UPDATE`s dirty checking produced |
| `getEntityInsertCount()` / `getEntityDeleteCount()` | inserts / deletes | the other two write actions |
| `getOptimisticFailureCount()` | "the number of Hibernate `StaleObjectStateException`s or Jakarta Persistence `OptimisticEntityLockException`s that occurred" | whether `@Version` is catching anything |
| `getPrepareStatementCount()` | "the number of JDBC prepared statements that were acquired by Hibernate" | statement volume, including the ones you did not write |
| `getEntityLoadCount()` | "the global number of entity loads" | how much is going into the persistence context |

Note that `getFlushCount()` counts manual and automatic flushes together — so a high number
does not distinguish an over-eager auto-flush from a `saveAndFlush` in a loop. The JFR
`FlushEvent` does.

## The readings that mean something

A single counter is rarely informative. Ratios are.

**`getFlushCount()` ≫ `getEntityUpdateCount()` + inserts + deletes.**
Repeated flushes producing nothing. Almost always auto-flush firing before overlapping
queries in a method that loaded a lot and modified little —
[15b · What triggers a flush](15b-what-triggers-a-flush.md) — and the cost is the walk
described in [14e](14e-what-dirty-checking-costs.md). Fixes, in order of preference: load
less, or set `FlushModeType.COMMIT` on the queries that do not need to see the pending work.

**`getEntityUpdateCount()` > 0 in a read path.**
Something is modifying entities in a method that is supposed to read. Usual causes: a
`@PostLoad` or a getter assigning to a mapped field, a normaliser, or an audit field being
touched on every load. See [14c · What counts as a change](14c-what-counts-as-a-change.md).

**`getEntityLoadCount()` ≫ the number of entities you meant to load.**
Lazy associations being walked one row at a time. That is topic 08's subject entirely —
[topic 08 · The N+1 problem](../08-the-n-plus-1-problem/README.md) — and the counter is a
symptom, not the diagnosis.

**`getPrepareStatementCount()` ≫ the statements you can name.**
Either the same N+1, or `@DynamicUpdate` producing a new statement string per dirty-field
combination — [14d · The shape of the UPDATE](14d-the-shape-of-the-update.md).

**`getOptimisticFailureCount()` climbing steadily.**
Real contention. Two questions follow: are the retries succeeding, and is the entity the
right granularity? See [16c · Beyond `@Version`](16c-beyond-version.md).

**`getOptimisticFailureCount()` at exactly zero on a system with concurrent editors.**
Either there is no contention, or the version is not reaching the client and back and the
check is passing vacuously — the silent failure described in
[16b · When the check fails](16b-when-the-version-check-fails.md).

## Measuring one operation

The counters are `SessionFactory`-wide and cumulative from startup, so they only answer a
question if you bracket the work:

```java
Statistics stats = sessionFactory.getStatistics();
stats.clear();

service.doTheThing();

long flushes = stats.getFlushCount();
long updates = stats.getEntityUpdateCount();
long statements = stats.getPrepareStatementCount();
```

⚠️ **This is only valid in a test, or under a load generator you control.** The counters are
shared across every thread in the application; `clear()` in one request zeroes them for all
of them, and another thread's work lands in your reading. It is a diagnostic instrument, not
a per-request metric.

This bracketing is also the shape of the assertion topic 08 builds a test around —
[topic 08 · 6b · Asserting the count in a test](../08-the-n-plus-1-problem/06b-asserting-the-count-in-a-test.md).

## Query statistics, and the cap on them

`getQueryStatistics(String)` takes a query string; `getQueries()` returns the ones being
tracked. §28.1.2 attaches a bound: "The maximum number of queries tracked by the Hibernate
statistics is given by the `hibernate.statistics.query_max_size` property."

That cap has a consequence worth knowing: on an application generating many distinct query
strings — dynamic criteria queries, or `IN` clauses with varying arity — the tracked set is a
truncated sample, not the whole picture. `getQueryExecutionMaxTime()` and
`getQueryExecutionMaxTimeQueryString()` name the slowest tracked query, and
`getQueryPlanCacheHitCount()` / `getQueryPlanCacheMissCount()` show whether that query-string
variety is also costing you plan-cache misses.

## Getting them out without writing code

Spring Boot binds them to Micrometer for you. `HibernateMetricsAutoConfiguration` — in Boot 4
this lives in the `spring-boot-hibernate` module — is documented as "Auto-configuration for
metrics on all available Hibernate `EntityManagerFactory` instances **that have statistics
enabled**", and it binds Micrometer's `HibernateMetrics` to the `MeterRegistry` for each one,
tagged with the factory's name.

Two conditions, and the first is the one people miss: the metrics appear only if
`hibernate.generate_statistics` is on. Without it the auto-configuration binds a `Statistics`
that is not collecting, and every meter reads zero. A `MeterRegistry` must also be present.

`Statistics.logSummary()` — "Print a summary of the current statistics into the application
log" — is the no-infrastructure alternative. It belongs at the end of a benchmark, not on a
schedule.

## Gotchas

**★ Zero metrics with the auto-configuration present means statistics are off.** The binding
succeeds; the counters simply never move. Check `hibernate.generate_statistics` first, and
`isStatisticsEnabled()` second.

**★ The counters are global and cumulative.** No per-request, per-transaction or per-thread
breakdown exists. `clear()` affects every thread.

**★ `getFlushCount()` does not separate automatic from manual flushes.** The documentation
says "either manual or automatic". Use JFR's `FlushEvent` if you need to know which.

**★ `getPrepareStatementCount()` counts statements Hibernate *acquired*, not statements
executed.** With batching, one acquired statement can carry many rows. Do not read it as a
round-trip count.

**★ Query statistics are capped by `hibernate.statistics.query_max_size`.** On an application
with high query-string variety you are looking at a sample.

**★ `getOptimisticFailureCount()` counts Hibernate's exception types.** It is documented as
counting `StaleObjectStateException` and `OptimisticEntityLockException` — the Hibernate-level
events, before Spring's translation.

**★ Enabling statistics in production is a real cost with a real benefit; enabling it and
never looking is only the cost.** Wire the meters to a dashboard or turn it off.

**★ A zero optimistic-failure count is ambiguous.** It means either no contention or no
protection, and only reading how the version travels to the client can tell you which.

**★ `logSummary()` is a lot of output.** It is a snapshot dump of the whole `Statistics`
object, not a line.

**★ Counters do not attribute anything to a call site.** They tell you a bad ratio exists.
Finding the method responsible needs the SQL log, a datasource proxy, or a bracketed test —
which is why the instruments are complementary rather than ranked.

## Interview questions

**★ Which statistics matter for diagnosing dirty checking and flushing?**
`getFlushCount()`, `getEntityUpdateCount()`, `getEntityInsertCount()` and
`getEntityDeleteCount()` for the writes, `getEntityLoadCount()` for what is going into the
context, `getPrepareStatementCount()` for statement volume, and
`getOptimisticFailureCount()` for version conflicts.

**★ What does a flush count much higher than the write counts tell you?**
That auto-flush is running repeatedly and finding nothing — typically a method that loaded
many entities and then issued several queries overlapping the same tables. The cost is the
dirty-check walk, not the SQL.

**★ How do you attribute a statistics reading to one operation?**
`clear()`, run the operation, read. And only in a test or a controlled load run, because the
counters are `SessionFactory`-wide and shared across threads.

**★ You added the Micrometer Hibernate metrics and everything reads zero. Why?**
Because the auto-configuration only produces meaningful values for factories "that have
statistics enabled". `hibernate.generate_statistics` is off by default, so the meters bind to
a `Statistics` that never counts.

**★ Is `getPrepareStatementCount()` a round-trip count?**
No. It counts prepared statements Hibernate acquired. Batching sends many rows through one
statement, so the number of round trips can be far lower.

**★ Why might query statistics be incomplete?**
Because tracking is capped by `hibernate.statistics.query_max_size`. An application producing
many distinct query strings will only have some of them tracked.

**★ What does an optimistic-failure count of zero tell you?**
Nothing on its own. It is consistent with no contention and equally consistent with the
version never reaching the client and back, so every check passes against a version read in
the same transaction.

**★ When would you reach for JFR instead of these counters?**
When you need the cost rather than the outcome: `DirtyCalculationEvent` for the walk itself,
`FlushEvent` and `PartialFlushEvent` to distinguish flush kinds, and
`JdbcBatchExecution` to see batching actually happening.

---

← Prev: [18 · Seeing what Hibernate does](18-seeing-what-hibernate-does.md) · Index: [06 · The JPA/Hibernate model](README.md) · Next → [18c · open-in-view](18c-open-in-view.md)
