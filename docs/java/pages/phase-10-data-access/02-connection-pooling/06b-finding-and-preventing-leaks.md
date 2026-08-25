---
title: "A leaked connection makes the service fail on a schedule rather than under load, and in Spring it comes from a short list of places"
sidebar_label: "6b · Finding and preventing leaks"
sidebar_position: 17
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the HikariCP 7.0.2 source
> (`pool/ProxyLeakTask.java`, read at tag `HikariCP-7.0.2`)
> ([github.com/brettwooldridge/HikariCP](https://github.com/brettwooldridge/HikariCP)),
> the Spring Framework 7.0 reference and javadoc for
> `org.springframework.jdbc.datasource.DataSourceUtils`
> ([docs.spring.io/spring-framework/reference/7.0/data-access.html](https://docs.spring.io/spring-framework/reference/7.0/data-access/jdbc.html)),
> and the JDK 25 API for `java.sql.Connection` and try-with-resources
> ([docs.oracle.com/en/java/javase/25/](https://docs.oracle.com/en/java/javase/25/docs/api/java.sql/java/sql/Connection.html)).
> JDK 25, HikariCP 7.0.2, Spring Boot 4.1.0, Spring Framework 7.0.8.

**[Chunk 6](06-leak-detection.md) covered the detector. This chunk is the other
two thirds of the job: recognising a leak from the pool's behaviour before the
detector is even configured, and knowing the handful of places a Spring
application can actually leak from — because the list is short, and most Spring
code cannot leak at all.**

## The fingerprint: it fails on a schedule, not under load

A leak and an undersized pool look identical in a single timeout exception
([chunk 5](05-connection-is-not-available.md)). Over time they look nothing
alike, because **a leak degrades as a function of uptime rather than of load.**

| | undersized pool | leak |
|---|---|---|
| what makes it worse | more traffic | more *time* |
| `active` | at maximum only during peaks | climbs, never falls back |
| quiet period | recovers within seconds | no effect at all |
| after a restart | fine until the next peak | fine for a fixed number of requests |
| shape | tracks the traffic graph | a step function |

🔴 **The step function is the giveaway.** If the leak rate is one connection per
thousand requests and the pool holds ten, the service is perfectly healthy for
ten thousand requests and then fails completely — every time, at the same count.
That is why these incidents often look scheduled: a service that leaks slowly
fails at roughly the same time each day, which sends people hunting for a cron
job that does not exist.

⚠️ **A quiet period is the cheap test.** If overnight traffic drops to nothing
and `active` stays where it was, the connections are not busy — they are gone.

## Where a Spring application can leak

Most of it cannot. `@Transactional` methods release their connection when the
transaction ends; `JdbcTemplate`, `JdbcClient` and Spring Data repositories
release theirs at the end of each call. That covers the great majority of data
access in a typical service, which is why Spring applications leak rarely and
why, when they do, it is nearly always one of these:

**1 · A raw `dataSource.getConnection()` without try-with-resources.**

```java
var c = dataSource.getConnection();      // ⛔ leaks on any exception below
var rows = query(c);
c.close();
```

The `close()` is skipped on any thrown exception. This is the case
[topic 01 chunk 17](../01-jdbc/17-resource-handling.md) exists to prevent, and
the fix is mechanical: acquisition belongs inside the try-with-resources header.

**2 · 🔴 `DataSourceUtils.getConnection()` released with `close()`.**

```java
var c = DataSourceUtils.getConnection(dataSource);
try {
    ...
} finally {
    DataSourceUtils.releaseConnection(c, dataSource);   // ← not c.close()
}
```

`DataSourceUtils` is transaction-aware: if a transaction is in progress it hands
back the *bound* connection, which must **not** be closed, because the
transaction still needs it. `releaseConnection` knows the difference and does
nothing in that case; `close()` does not, and closes a connection the transaction
manager still owns. Outside a transaction the two happen to behave the same,
which is precisely why the bug survives testing.

**3 · A `Stream` from a repository, used outside try-with-resources.**

```java
try (var orders = orderRepository.streamAllByStatus(OPEN)) {   // ✅
    orders.forEach(this::process);
}
```

A streaming query holds its connection open for the life of the stream, and a
terminal operation does **not** close it. `forEach` on an unclosed stream leaks
the connection every time it runs — which makes this the highest-rate leak on the
list, since it usually sits inside a batch loop.

**4 · A `ResultSet` returned from the method that opened it.** The `ResultSet`
keeps its `Statement` alive, which keeps its `Connection` alive. Nothing in the
signature mentions a connection, so nothing in review flags it. Map the rows and
return the objects ([topic 01 chunk 16](../01-jdbc/16-mapping-rows-to-objects.md)).

**5 · An `ExecutorService` task that borrows and is cancelled.** If the future is
cancelled or the executor is shut down before the task's `finally` runs, the
connection is never returned. This is rare and extremely hard to reproduce, and
it is one more argument for never letting connection lifetime span a thread
boundary ([chunk 3b](03b-reducing-cm.md)).

## Reading the stack trace HikariCP gives you

The warning's stack trace is captured at the **borrow**, with HikariCP's own
frames stripped. So:

- **The top frame is the line that called `getConnection()`.** That is the
  acquisition site — the thing you need.
- **The frames below it are the call path that led there**, which tells you which
  endpoint or job is responsible.
- **It is *not* where the leak was noticed.** Nothing in the trace points at the
  missing `close()`, because a missing `close()` has no stack frame. You are
  being shown where the connection came from and left to find where it should
  have gone back.

⚠️ **The trace must survive your log pipeline.** It is a multi-line entry
following a WARN, and aggregators frequently keep the first line and drop the
rest. An alert that says "a leak was detected" and nothing else has thrown away
the entire value of the feature.

## Preventing them, in order of effectiveness

1. **Never call `dataSource.getConnection()` in application code.** Use
   `JdbcClient`, `JdbcTemplate` or a repository. The connection then has no
   lifetime you can get wrong.
2. **Where you must, acquire inside try-with-resources** — never on the line
   before it.
3. **Never let a `Connection`, `Statement`, `ResultSet` or `Stream` cross a
   method boundary upward**, and never let one cross a thread boundary at all.
4. **Turn the detector on** with a threshold above the slowest legitimate
   operation, so the next mistake costs a log line rather than an outage.

## The trade-off

Rules three and four of that list cost real expressiveness. A repository method
that cannot return a `Stream` has to materialise a list or take a callback, which
is less elegant and sometimes uses more memory. A method that cannot return a
`ResultSet` must map rows even when the caller only wanted one column. That is
the price of making connection lifetime a property of a single lexical block
rather than of a call graph — and it is worth paying, because the failure it
prevents is silent, delayed, and lands on threads that have nothing to do with
the bug.

## Gotchas

**⚠️ Chasing a cron job because the failure is punctual**
**Symptom:** the service fails at roughly the same time each day and nothing is
scheduled then.
**Cause:** a constant leak rate against a fixed pool size produces a fixed
request count to failure, which under steady daily traffic is a fixed time.
**Fix:** check whether `active` falls during quiet periods. If it does not, it is
a leak, not a schedule.

**⚠️ Calling `close()` on a connection from `DataSourceUtils.getConnection()`**
**Symptom:** works everywhere except inside a transaction, where the connection
is closed while the transaction still needs it.
**Cause:** the transaction-aware acquisition needs the transaction-aware release.
**Fix:** `DataSourceUtils.releaseConnection(connection, dataSource)`, always.

**⚠️ A repository `Stream` consumed without closing it**
**Symptom:** a fast leak confined to one job or endpoint.
**Cause:** the stream holds the connection until closed, and terminal operations
do not close it.
**Fix:** try-with-resources around the stream, every time.

**⚠️ Acquiring on the line before the `try`**
**Symptom:** a leak that only happens when something throws — so, only in
production.
**Cause:** an exception between acquisition and the `try` block skips the
`finally`.
**Fix:** acquire in the resource specification header.

**⚠️ Returning a `ResultSet`**
**Symptom:** a connection leak in code that never mentions connections.
**Cause:** the `ResultSet` keeps its `Statement` and `Connection` alive.
**Fix:** map inside the method and return domain objects.

**⚠️ Alerting on the WARN and dropping the stack trace**
**Symptom:** an alert that says a leak was detected and nothing else.
**Cause:** multi-line log entries truncated at the aggregator.
**Fix:** the stack trace *is* the diagnosis. Make sure it survives.

**⚠️ Looking for the missing `close()` in the stack trace**
**Symptom:** confusion about why the trace points at ordinary-looking code.
**Cause:** the trace is captured at the borrow; an absent `close()` has no frame.
**Fix:** read it as "this is where the connection was taken out" and then find
the path that fails to return it.

**⚠️ Restarting as the remedy**
**Symptom:** a scheduled restart quietly becomes part of the runbook.
**Cause:** a restart genuinely does fix it, for exactly as long as it takes to
leak the pool again.
**Fix:** it is a workaround with a timer on it. The stack trace is available; use
it.

**⚠️ Assuming a leak must be in your code**
**Symptom:** a careful audit finds nothing.
**Cause:** a library that takes a `DataSource` — a migration tool, a scheduler
with a JDBC store, a metrics exporter — can leak too.
**Fix:** the stack trace names the borrower regardless of who wrote it.

## Interview questions

**★ How do you recognise a connection leak from the pool's behaviour alone?**
By whether it tracks time or traffic. An undersized pool follows the traffic
graph — it saturates at peak and recovers when load drops. A leak follows uptime:
`active` climbs and never comes back down, and a quiet period changes nothing,
because a leaked connection is not busy, it is gone. The characteristic shape is
a step function — healthy for a long period, then total failure, then healthy
again after a restart for exactly the same period. The single cheapest test is to
look at `active` overnight.

**★ Why do leaks often look like a scheduled problem?**
Because a constant leak rate against a fixed pool gives a fixed number of
requests to failure, and under a repeating daily traffic pattern a fixed request
count arrives at roughly the same clock time each day. So the service fails at
about the same hour, which sends everyone looking for a batch job, a cache
expiry or a certificate rotation. Recognising the step function saves that
detour.

**★ In a Spring application, where do leaks actually come from?**
Not from `@Transactional` methods, `JdbcTemplate`, `JdbcClient` or repository
calls, all of which release connections for you — which is why Spring
applications leak rarely. The real sources are a short list: a raw
`dataSource.getConnection()` outside try-with-resources; a connection obtained
through `DataSourceUtils.getConnection()` and released with `close()` instead of
`DataSourceUtils.releaseConnection()`; a `Stream`-returning repository method
consumed without closing the stream; a `ResultSet` allowed to escape the method
that opened it; and a task on an executor that is cancelled between borrowing and
returning.

**★ Why is `DataSourceUtils.releaseConnection` different from `close`?**
Because `DataSourceUtils.getConnection` is transaction-aware. Inside a
transaction it returns the connection already bound to the thread, which the
transaction manager owns and will close when the transaction ends — so closing it
yourself ends the transaction's connection underneath it. `releaseConnection`
checks whether the connection is transaction-bound and does nothing if it is.
Outside a transaction the two behave identically, which is exactly why this bug
passes every unit test and fails in the one place that matters.

**★ What does HikariCP's leak stack trace actually point at?**
The line that called `getConnection()`, because the trace is captured at borrow
time with HikariCP's own frames removed. It does not and cannot point at the
missing `close()`, since code that does not run leaves no frame. So the correct
reading is "this is where the connection left the pool, and this is the call path
that led here" — from which you find the exit path that fails to return it. It is
also worth checking that the trace survives your log aggregation, because the
warning line alone carries none of the information.

**★ A careful audit of your code finds no leak. What next?**
Widen the search beyond your code. Anything given a `DataSource` can leak from
it: a migration tool, a scheduler with a JDBC job store, a metrics or health
exporter, a distributed-lock library, an audit framework. The stack trace names
the borrower regardless of who wrote it, which is why turning the detector on is
more productive than reading code — it removes the assumption that you are
looking in the right repository at all.

**★ Is a scheduled restart an acceptable mitigation?**
As a stopgap during an incident, yes — it works, and it buys time. As a standing
practice, no, because it hides an unbounded defect behind a timer that has to
stay ahead of the leak rate, and leak rates change with traffic. It also removes
the pressure to fix the actual bug, which is cheap to find once leak detection is
on. The honest version is to restart to restore service, turn the detector on in
the same change, and fix the line it names.

---

← Prev: [6 · Leak detection](06-leak-detection.md) · Index: [Connection pooling with HikariCP](README.md) · Next → [7 · Session state](07-session-state.md)
