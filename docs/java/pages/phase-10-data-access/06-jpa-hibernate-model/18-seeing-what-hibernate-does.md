---
title: "The SQL log tells you which statements ran; it cannot tell you why one of them exists — and for a topic whose whole subject is writes nobody wrote, that is the question you actually have"
sidebar_label: "18 · Seeing what Hibernate does"
sidebar_position: 38
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 *User Guide* §28 *Statistics*, §31.2
> *Logging* and Appendix A.3 *JDBC settings* (A.3.24, A.3.25, A.3.35, A.3.36)
> ([docs.hibernate.org/orm/7.4/userguide/html_single/](https://docs.hibernate.org/orm/7.4/userguide/html_single/))
> and the Spring Boot 4.1 reference *Logging*
> ([docs.spring.io/spring-boot/reference/features/logging.html](https://docs.spring.io/spring-boot/reference/features/logging.html)).
> JDK 25, Spring Boot 4.1.1, Hibernate ORM 7.4.1.

**Everything in this topic is about work you did not write: an `UPDATE` from a setter, a
flush from a query, an extra `SELECT` from a proxy. A log of executed SQL shows you the
symptom. To see the mechanism you need instruments that report on the *persistence context* —
how many times it flushed, how many entities it wrote, how many version checks failed — and
those are a different switch from the one everybody turns on.**

## First, the SQL — which is not this chunk's subject

There are three ways to see the statements, they are not interchangeable, and the difference
between `spring.jpa.show-sql` and the `org.hibernate.SQL` logger is argued at length where it
belongs, in [topic 08 · 5 · Turning the SQL on](../08-the-n-plus-1-problem/05-turning-the-sql-on.md)
and [topic 08 · 5b · Why `show-sql` is not it](../08-the-n-plus-1-problem/05b-show-sql-is-not-the-answer.md).
The short version, and the settings, so this page is usable on its own:

```yaml
logging:
  level:
    org.hibernate.SQL: debug              # the statements, through your logging framework
    org.hibernate.orm.jdbc.bind: trace    # the bound parameter values
    org.hibernate.orm.jdbc.extract: trace # the values read back out
```

Those four logger names come verbatim from the User Guide's §31.2, which lists
`org.hibernate.SQL` for "log just the SQL" and `org.hibernate.type`,
`org.hibernate.orm.jdbc.bind` and `org.hibernate.orm.jdbc.extract` for "log JDBC bind
parameters and extracted values".

🔴 **`org.hibernate.orm.jdbc.bind` is the current name.** The name most search results still
show — `org.hibernate.type.descriptor.sql.BasicBinder` — is the Hibernate 5 spelling. Setting
it on 7.4 produces silence, which reads exactly like "parameters are not being logged", and
sends people to `show-sql` instead.

The formatting settings, all defaulting to `false` (Appendix A.3): `hibernate.format_sql`
("Enables formatting of SQL logged to the console"), `hibernate.highlight_sql` ("using ANSI
escape codes"), `hibernate.use_sql_comments` ("comments should be added to the generated
SQL"), and `hibernate.show_sql` itself ("Enables logging of generated SQL to **the
console**" — the word that disqualifies it).

The User Guide's own closing advice on all of this is worth quoting because it points past
the logger entirely: "While simple statement logging is fine, using datasource-proxy or p6spy
is even better", the named advantages being "statement execution time", "JDBC batching
logging", "database connection monitoring" and being able to "assert the number of executed
statements at test time".

## Second, the statistics — which is

`hibernate.generate_statistics` turns on a counter set that answers questions the SQL log
cannot:

```yaml
spring:
  jpa:
    properties:
      hibernate:
        generate_statistics: true
```

⚠️ It is off by default, deliberately: "By default, the statistics are not collected because
this incurs an additional processing and memory overhead."

```java
Statistics stats = entityManagerFactory
        .unwrap(SessionFactory.class)
        .getStatistics();
```

The `Statistics` interface is large — §28.1 groups it into twelve categories — and most of it
is about caches and queries. The handful that matter for *this* topic, and what each one tells
you, is [18b · The statistics you actually read](18b-the-statistics-you-actually-read.md).

The general controls are worth knowing first:

| Method | What it is for |
|---|---|
| `isStatisticsEnabled()` / `setStatisticsEnabled(boolean)` | check and toggle at runtime |
| `clear()` | "Reset all statistics" — the start of any measurement |
| `logSummary()` | "Print a summary of the current statistics into the application log" |
| `getStartTime()` | milliseconds since creation or the last `clear()` |

`clear()` then act then read is the only honest way to use these: the counters are global to
the `SessionFactory` and accumulate from startup, so an absolute reading tells you almost
nothing.

## Third, the events — for the cost of the mechanism itself

Statistics count outcomes. To see the cost of the *work*, Hibernate ships a Java Flight
Recorder integration. Appendix D lists the events, and three of them are this topic's:

- `org.hibernate.orm.FlushEvent` — a flush
- `org.hibernate.orm.PartialFlushEvent` — a partial flush
- `org.hibernate.orm.DirtyCalculationEvent` — **a dirty check calculation**

The others are `SessionOpen`/`SessionClosed`, `JdbcConnectionAcquisition`/`Release`,
`JdbcPreparedStatementCreation`/`Execution`, `JdbcBatchExecution`, and `CachePut`/`CacheGet`.

Two requirements: "the application must include the `hibernate-jfr` jar on the classpath",
and the integration "requires a JDK 17 supporting JFR events" — comfortably satisfied on
JDK 25.

`DirtyCalculationEvent` is the only instrument that measures the walk described in
[14e · What dirty checking costs](14e-what-dirty-checking-costs.md) rather than its result. If
you suspect the persistence context is too full, this is the thing that answers it.

## Two settings almost nobody knows about

**`hibernate.log_slow_query`** — Appendix A.3.33:

> Specifies a duration in milliseconds defining the minimum query execution time that
> characterizes a "slow" query. Any SQL query which takes longer than this amount of time to
> execute will be logged. A value of `0`, the default, disables logging of "slow" queries.

This is the closest thing Hibernate has to built-in timing, and it is off. Setting it to a
threshold you care about turns the SQL log from a firehose into an exception report — without
adding a proxy library.

**`hibernate.session_factory.statement_inspector`** — A.3.34, since 5.0 — takes a
`StatementInspector` implementation, "either an instance of `StatementInspector`, a `Class`
representing a class that implements `StatementInspector`, or the name of a class that
implements `StatementInspector`". Every statement passes through it before execution, so it is
the hook for counting statements, tagging them, or asserting on them in a test — the same job a
datasource proxy does, one layer higher and without a dependency.

## Flipping loggers without a restart

If Spring Boot Actuator is on the classpath, its `loggers` endpoint changes a logger's level at
runtime. That turns "reproduce it with SQL logging on" from a redeploy into a request, which
matters when the behaviour you are chasing only happens under load. It also means the levels
above are diagnostic tools rather than configuration you have to commit — including
`org.hibernate.orm.jdbc.bind`, which you should not leave on.

## Which instrument answers which question

| Question | Instrument |
|---|---|
| which statements ran, with parameters | `org.hibernate.SQL` + `org.hibernate.orm.jdbc.bind` |
| how many statements ran | statement counts, a `StatementInspector`, or a datasource proxy |
| which statements are slow | `hibernate.log_slow_query` |
| **why does this `UPDATE` exist** | dirty checking — read the entity, then `getEntityUpdateCount` |
| **how many times did we flush** | `getFlushCount()` |
| **is auto-flush firing repeatedly for nothing** | `getFlushCount()` vs `getEntityUpdateCount()` |
| **are version checks failing** | `getOptimisticFailureCount()` |
| **how expensive is the dirty check itself** | JFR `DirtyCalculationEvent` |
| when did the persistence context open and close | JFR `SessionOpen` / `SessionClosed`, and [18c](18c-open-in-view.md) |

## Gotchas

**★ `spring.jpa.show-sql` writes to standard output, not through your logging framework.** No
level, no appender, no correlation id, no way to turn it off per package. Hibernate's own
javadoc says "to the console" and means it.

**★ `org.hibernate.type` is not the parameter logger any more.** On 7.4 the bind values come
from `org.hibernate.orm.jdbc.bind`. The old name is the single most common reason people
believe parameter logging does not work.

**★ Statistics are off by default and cost something when on.** The User Guide names
"additional processing and memory overhead". Enable to diagnose; decide deliberately whether
to leave it on.

**★ The counters are `SessionFactory`-wide and cumulative.** Reading them without `clear()`
first gives you a number that includes application startup and every request since. It is not
per-transaction and it is not per-thread.

**★ `logSummary()` writes a dump into your application log.** Useful at the end of a
benchmark, disastrous on a timer in production.

**★ JFR needs an extra jar.** `hibernate-jfr` is not a transitive dependency of
`spring-boot-starter-data-jpa`; without it the events simply do not exist.

**★ `hibernate.log_slow_query` defaults to `0`, which means off.** It is the one built-in
timing instrument and it ships disabled, so nobody discovers it by reading a log.

**★ A `StatementInspector` sees every statement, including Hibernate's own.** That is what
makes it useful for counting and what makes it easy to write one that logs far more than you
expected.

**★ A SQL log answers "what ran", never "what caused it".** For a topic whose statements come
from a comparison rather than a call, that gap is the whole difficulty — which is why the
statistics matter more here than in most chapters.

**★ Turning on parameter logging changes what is in your logs.** Bound values include whatever
personal data is in those columns. It is a development and staging setting; treat leaving it
on in production as a data-handling decision, not a debugging one.

## Interview questions

**★ Why is the SQL log not enough for this topic?**
Because every statement in it looks the same whether it came from an explicit call or from
dirty checking, and it says nothing about the flushes that produced no statements at all.
The questions here — how often did we flush, how many entities were written, did a version
check fail — are counter questions, not statement questions.

**★ What are the current Hibernate logger names for SQL and parameters?**
`org.hibernate.SQL` at `debug` for the statements, and `org.hibernate.orm.jdbc.bind` at
`trace` for bound parameters — plus `org.hibernate.orm.jdbc.extract` for values read back.
The Hibernate 5 name `org.hibernate.type.descriptor.sql.BasicBinder` no longer does anything.

**★ How do you turn on Hibernate statistics and read them?**
Set `hibernate.generate_statistics=true` — in Boot, under
`spring.jpa.properties.hibernate.*` — then unwrap the `EntityManagerFactory` to a
`SessionFactory` and call `getStatistics()`. Call `clear()` before the work you want to
measure.

**★ Why are statistics off by default?**
Because collecting them costs processing and memory on every operation. The documentation
says so explicitly, which makes leaving them on a decision rather than an oversight.

**★ How would you measure the cost of dirty checking itself, rather than its results?**
With the `hibernate-jfr` integration, which emits `org.hibernate.orm.DirtyCalculationEvent`
alongside `FlushEvent` and `PartialFlushEvent`. Statistics count outcomes; JFR events measure
the work.

**★ What does the Hibernate documentation recommend over plain statement logging?**
A datasource proxy — datasource-proxy or p6spy — because it can also report statement
execution time, JDBC batching, and connection usage, and because it lets a test assert the
number of statements executed.

**★ Is there a way to log only slow statements?**
Yes — `hibernate.log_slow_query`, a threshold in milliseconds. It defaults to `0`, which
disables the feature, and it is the only timing instrument Hibernate provides without an
external proxy.

**★ How would you count statements in a test without a proxy library?**
Register a `StatementInspector` through
`hibernate.session_factory.statement_inspector`. Every statement passes through it before
execution, so it can count, tag or assert. The alternative is `getPrepareStatementCount()` from
the statistics, which counts acquisitions rather than executions.

**★ Are the statistics per request?**
No. They belong to the `SessionFactory` and accumulate for the life of the application. Any
per-operation measurement has to `clear()` first, and that makes them unsuitable for
concurrent use without care.

---

← Prev: [17b · Why update is never production](17b-why-update-is-never-production.md) · Index: [06 · The JPA/Hibernate model](README.md) · Next → [18b · The statistics you read](18b-the-statistics-you-actually-read.md)
