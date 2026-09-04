---
title: "Count one layer lower and you see every statement, not just Hibernate's — datasource-proxy and p6spy exist for exactly this"
sidebar_label: "6d · Proxies and agents"
sidebar_position: 15
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 user guide §31.2 *Logging*
> ([docs.hibernate.org/orm/7.4/userguide/html_single/](https://docs.hibernate.org/orm/7.4/userguide/html_single/Hibernate_User_Guide.html))
> and the `org.hibernate.cfg.JdbcSettings` javadoc for `STATEMENT_INSPECTOR` in
> the Hibernate 7.4 source
> ([github.com/hibernate/hibernate-orm](https://github.com/hibernate/hibernate-orm/blob/7.4/hibernate-core/src/main/java/org/hibernate/cfg/JdbcSettings.java)).
> JDK 25, Spring Boot 4.1.1, Hibernate ORM 7.4.1, HikariCP 7.0.2.

**Hibernate's statistics count what Hibernate does. Most real services also issue
statements Hibernate never sees — a `JdbcClient` report, a second datasource, a
migration. Counting at the JDBC layer catches all of it, and the Hibernate
documentation recommends exactly this for exactly this reason.**

## What the documentation says

The user guide's logging section introduces the alternatives and then says
something more specific than "you can also log this way":

> *"However, there are some other alternatives like using datasource-proxy or
> p6spy. The advantage of using a JDBC Driver or DataSource proxy is that you can
> go beyond simple SQL logging: statement execution time / JDBC batching logging
> / database connection monitoring. **Another advantage of using a DataSource
> proxy is that you can assert the number of executed statements at test time.
> This way, you can have the integration tests fail when a N+1 query issue is
> automatically detected.** While simple statement logging is fine, using
> datasource-proxy or p6spy is even better."*

That is Hibernate's own documentation recommending the practice in
[chunk 6b](06b-asserting-the-count-in-a-test.md), and naming N+1 as the thing it
detects.

⛔ Neither tool is installed on the machine this page was written on and neither
was run, so nothing below reports what they printed. What follows is what they
are, where they sit, and how to choose — from their documented purpose and from
the layer they occupy.

## Where each one sits

Three different layers, three different things they can see:

| | Where it wraps | Sees |
|---|---|---|
| Hibernate `Statistics` | inside Hibernate | Hibernate's own statements, loads and fetches |
| `StatementInspector` | inside Hibernate, per statement | every SQL string Hibernate is about to execute |
| **datasource-proxy** | around the `DataSource` | every statement on that datasource, from any source |
| **p6spy** | around the JDBC *driver* | every statement on every connection through that driver |

The lower you go, the more you see and the less you know about *why*. Hibernate's
statistics can tell you a collection fetch happened; a driver-level proxy can
only tell you a `select` happened. That trade is the whole basis for choosing.

### Hibernate's own hook

Worth naming before reaching for a library, because it needs no dependency.
`hibernate.session_factory.statement_inspector` takes *"an instance of
`StatementInspector`, a `Class` representing a class that implements
`StatementInspector`, or the name of a class that implements
`StatementInspector`"*. It is handed every SQL string before execution:

```java
public class CountingInspector implements StatementInspector {

    private static final ThreadLocal<AtomicLong> COUNT =
            ThreadLocal.withInitial(AtomicLong::new);

    @Override
    public String inspect(String sql) {
        COUNT.get().incrementAndGet();
        return sql;                       // return it unchanged
    }

    public static long countAndReset() { return COUNT.get().getAndSet(0); }
}
```

`ThreadLocal` gives you the per-request or per-test isolation that Hibernate's
global `Statistics` cannot, which is the one thing it adds over
[chunk 6](06-count-do-not-read.md). Its limit is the same as statistics': it sees
nothing issued outside Hibernate.

### datasource-proxy

Wraps a `DataSource` and produces a proxy that reports every statement executed
through it, with listeners you register. Because it sits at the datasource, it
sees Hibernate, `JdbcClient`, Spring Batch and anything else sharing that bean —
which is precisely the gap in Hibernate's statistics.

Its shape in a test configuration:

```java
@TestConfiguration
class CountingDataSourceConfig {

    @Bean
    static BeanPostProcessor proxyTheDataSource(QueryCountListener listener) {
        return new BeanPostProcessor() {
            @Override
            public Object postProcessAfterInitialization(Object bean, String name) {
                return bean instanceof DataSource ds
                        ? ProxyDataSourceBuilder.create(ds)
                              .listener(listener)
                              .build()
                        : bean;
            }
        };
    }
}
```

The listener receives an execution info object and the list of query info objects
per execution, so counting is a field increment and grouping by statement type is
a switch. That is the mechanism behind every "assert the query count" library in
the Java ecosystem.

⚠️ Consult the library's current documentation for the exact API before writing
this — the builder and listener types are stable in shape but I have not verified
the 2026 signatures against a primary source.

### p6spy

Wraps the JDBC *driver* rather than a datasource: you change the JDBC URL and
driver class, and every connection made through it is intercepted. That makes it
the most complete and the most invasive of the three. It is the right choice when
you do not control the `DataSource` bean — a legacy application, a container-
managed datasource, an application server — and the wrong choice when you do,
because changing the URL is a bigger change than wrapping a bean.

## Choosing between the four

**Use Hibernate `Statistics`** when all your data access is Hibernate and you are
writing a test. It is one property, no dependency, and the load-versus-fetch
distinction gives you diagnosis, not just detection.

**Use a `StatementInspector`** when you want a per-thread or per-request count
inside Hibernate with no new dependency — for example, to log a warning when a
single request exceeds a statement budget.

**Use datasource-proxy** when part of your data access is not Hibernate, or when
you want per-execution detail (timings, batch sizes, parameters) alongside the
count, or when you want the assertion helpers its ecosystem provides.

**Use p6spy** when you cannot get at the `DataSource` bean.

## The production version of this idea

All four are diagnostics you switch on. The production form is different and
worth naming, because it is what actually catches regressions before users do.

A **JDBC-instrumenting APM agent** — the OpenTelemetry JDBC instrumentation and
every commercial equivalent — creates a span per statement inside the request's
trace. That gives you, for free and continuously, the thing this whole chapter
has been building towards: the number of database spans in a request, visible per
endpoint, over time.

**The alert that works is a ratio, not a latency**: database spans per request,
per endpoint. It should be constant for a correct fetch plan, because a correct
fetch plan issues a fixed number of statements regardless of how many rows come
back. When it starts climbing, an N+1 has appeared — and it climbs long before
the latency percentile moves, which is the whole point.

See [Topic 02 · Connection pooling with HikariCP](../02-connection-pooling/README.md)
for the pool metrics that show the same problem from the other side: a rising
connection *hold time* with a flat request rate is the same event seen at the
pool.

## Gotchas

**⚠️ Wrapping the datasource in production because it was useful in tests.**
Every statement now goes through an extra layer with a listener on it. That is a
reasonable cost for a test and a standing one in production. Decide it
deliberately.

**⚠️ Proxying the datasource *after* Hibernate already has a reference.**
Bean ordering matters. If the `EntityManagerFactory` was built with the raw
`DataSource`, Hibernate keeps using the raw one and your proxy counts nothing —
which looks like an application that issues no SQL.

**⚠️ Counting at the driver and being surprised by extra statements.**
A driver-level proxy sees connection validation queries from the pool, `SET`
statements, transaction control and driver-internal round trips. Those are real
statements and they are not your N+1. Filter by statement type before asserting.

**⚠️ Using a global counter in a concurrent test.**
Same trap as Hibernate's statistics. If you count at the datasource, make the
counter `ThreadLocal` or scope it to the connection, or parallel tests will
poison each other.

**⚠️ Treating a `StatementInspector` as a place to rewrite SQL.**
It can — it returns the string — and that is a tempting hook for adding hints or
comments. It is also a hook that runs on every statement in your application, in
the request path, and a mistake there is very hard to trace. Counting is a safe
use; rewriting is not a decision to make casually.

**⚠️ Alerting on latency instead of on statements per request.**
Latency moves late, after the arithmetic has already got bad, and it moves for
many reasons. Statements per request moves immediately, moves for exactly one
reason, and is constant when things are healthy — which makes it a far better
signal despite being a less obvious thing to graph.

**⚠️ Assuming an APM's span count is complete.**
It is complete for the instrumented driver and the sampled requests. An
unsampled request shows nothing, and a second datasource that the agent did not
instrument is invisible. Check what is actually instrumented before trusting a
flat graph.

## Interview questions

**★ Why would you count statements at the JDBC layer rather than using Hibernate's
statistics?**
Because Hibernate's statistics only see what Hibernate does, and most real
services issue statements it never sees — a `JdbcClient` report, a second
datasource, Spring Batch, a native driver call. A datasource proxy sits under all
of them and counts everything on that datasource; a driver-level proxy like p6spy
counts everything on that driver. The trade is that you lose the semantics:
Hibernate can tell you that a *collection fetch* happened, which points straight
at a fetch plan, whereas a datasource proxy can only tell you that a `select`
happened. So the honest answer is that they are complementary — statistics for
diagnosis when everything is Hibernate, a proxy for completeness when it is not.
Hibernate's own documentation recommends the proxy approach for test-time
assertions and names N+1 as what it detects.

**★ What is a `StatementInspector` and when would you use one over the other
options?**
It is a Hibernate SPI configured through
`hibernate.session_factory.statement_inspector` — as an instance, a class, or a
class name — that receives every SQL string before execution and returns it,
optionally modified. For this problem the useful property is that it is a place
to count without adding a dependency, and because you control the counter you can
make it `ThreadLocal`, which gives you the per-request or per-test isolation that
Hibernate's global `Statistics` object cannot. That makes it a good fit for
something like "log a warning when a single request exceeds a statement budget",
which is hard to build on global cumulative counters. Its limitation is the same
as statistics': it only sees Hibernate. And because it can rewrite SQL, it is a
hook to use conservatively — counting is safe, rewriting every statement in the
application is not a casual decision.

**★ How would you detect N+1 regressions in production rather than in tests?**
With a JDBC-instrumenting APM agent producing a span per statement, and an alert
on database spans per request, per endpoint — a ratio, not a latency. The reason
a ratio works is that a correct fetch plan issues a fixed number of statements
regardless of how many rows come back, so the ratio is constant when things are
healthy and starts climbing the moment an association is being resolved one row
at a time. Crucially it climbs *before* the latency percentile moves, because the
arithmetic has to get quite bad before p99 notices, which is exactly the warning
you want. The complementary signal is at the connection pool: rising connection
hold time with a flat request rate is the same event seen from the other side.

**★ What are the pitfalls of counting at the driver level?**
Mostly that it sees too much. A driver proxy counts connection validation queries
from the pool, session `SET` statements, transaction control statements and
driver-internal round trips — all real statements, none of them your bug — so an
assertion has to filter by statement type or it will be both wrong and unstable.
There is also a bean-ordering trap one layer up: if you wrap the `DataSource` but
Hibernate's `EntityManagerFactory` was built with a reference to the raw one,
your proxy counts nothing at all, which presents as an application that issues no
SQL. And any global counter has the usual concurrency problem — make it
`ThreadLocal` or scope it to the connection, or parallel tests will corrupt each
other's readings.

**★ Given four ways to count, how do you choose?**
By two questions. First: is all the data access going through Hibernate? If yes,
Hibernate's `Statistics` is the best tool, because it is one property with no
dependency and it distinguishes loads from fetches, which turns detection into
diagnosis. If no, you need a datasource proxy, because anything outside Hibernate
is invisible to statistics. Second: do you control the `DataSource` bean? If yes,
datasource-proxy wraps it cleanly and gives you per-execution detail. If no — a
container-managed datasource, an application server, a legacy configuration —
p6spy wraps the driver instead, which is more invasive but works when nothing
else can. The `StatementInspector` is the odd one out: reach for it when you
specifically want per-thread counting inside Hibernate without adding a
dependency.

---

← Prev: [6c · Making it reusable](06c-making-it-reusable.md) · Index: [08 · The N+1 problem](README.md) · Next → [7 · From a count to a call site](07-from-a-count-to-a-call-site.md)
