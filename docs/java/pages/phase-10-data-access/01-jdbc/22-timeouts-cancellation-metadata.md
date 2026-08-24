---
title: "A timeout on the client stops you waiting; it does not stop the database working"
sidebar_label: "22 · Client-side timeouts"
sidebar_position: 39
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JDK 25 API for `java.sql.Statement`,
> `java.sql.Connection` and `java.sql.SQLTimeoutException`
> (docs.oracle.com/en/java/javase/25/docs/api/java.sql/), the pgJDBC *Connection
> Parameters* documentation (jdbc.postgresql.org/documentation/use/), the
> PostgreSQL 18 manual *Frontend/Backend Protocol → Canceling Requests in
> Progress* (postgresql.org/docs/18/protocol-flow.html), and the pgjdbc source at
> tag `REL42.7.13` (`PgConnection.java`, `PgStatement.java`, `PGStream.java`).
> JDK 25, JDBC 4.3, PostgreSQL 18, pgjdbc 42.7.13.

**There are four independent places you can put a timeout on a JDBC call, and
three of them do not stop the database doing the work. `setQueryTimeout` *asks*
the server to stop. `setNetworkTimeout` and pgJDBC's `socketTimeout` stop your
thread waiting and destroy the connection. Only PostgreSQL's own
`statement_timeout` family aborts the statement whether or not the client is
still alive, listening, or even running. That distinction — **waiting** versus
**working** — is the whole subject. A service with a five-second HTTP timeout and
no server-side bound does not have a five-second database: it has a database
quietly accumulating twenty-minute sequential scans whose results nobody is
reading, each one holding a snapshot, holding locks, and burning a CPU core.**

## Four layers, and only the last one binds

| Layer | Knob | Units | Default | Aborts work on the server? | On expiry |
|---|---|---|---|---|---|
| JDBC statement | `Statement.setQueryTimeout(int)` | **seconds** | 0 = none | **asks it to** — best effort | driver sends a cancel |
| JDBC connection | `Connection.setNetworkTimeout(Executor,int)` | **milliseconds** | 0 = none | no | **connection marked closed** |
| Driver socket | `socketTimeout`, `connectTimeout`, `loginTimeout`, `cancelSignalTimeout` | **seconds** | `0`, `10`, `0`, `10` | no | connection closed |
| PostgreSQL server | `statement_timeout`, `lock_timeout`, `transaction_timeout`, `idle_in_transaction_session_timeout`, `idle_session_timeout` | **milliseconds** | all `0` = disabled | **yes** | error, or session terminated |

This chunk covers the first three — the ones that live in your JVM. The server's
own timeouts, and how to compose all four into a stack that fails gracefully, are
[the server's own
timeouts](22d-server-side-timeouts.md), together with [the connection and socket
layers](22b-connection-and-socket-timeouts.md) that sit between them. What
actually happens on the wire when a cancel is sent is [how cancellation
works](22f-how-cancellation-works.md).

🔴 **Read the units column twice.** `setQueryTimeout` is seconds, JDBC's
`setNetworkTimeout` is milliseconds, pgJDBC's socket properties are seconds, and
every PostgreSQL GUC is milliseconds when written without a unit suffix. A literal
`5000` means five seconds in one of those places and eighty-three minutes in
another. This is a production incident waiting in a config file.

## Waiting is not working

When a client-side timeout fires, here is what has and has not happened:

- Your thread stops blocking. ✅
- Your connection is closed, or your statement throws. ✅
- The PostgreSQL backend process executing your query **keeps executing it**. ❌

A PostgreSQL backend does not continuously poll its client socket. The protocol
documentation says so while explaining why cancellation is deliberately awkward:
"we don't want to have the backend constantly checking for new input from the
frontend during query processing." A backend running a long aggregate notices a
dead client when it next tries to *write*, and a query that produces no output for
twenty minutes writes nothing for twenty minutes.

So a client-only timeout under load produces the worst possible shape. The
application gives up and retries; each retry forks another backend
([chunk 4](04-connection-is-expensive.md)); none of the abandoned ones stop; the
database's load climbs while every client-side dashboard shows fast, clean
five-second failures. **The timeout that protects the database has to be enforced
by the database.** Everything in this chunk is about protecting *you*.

## `setQueryTimeout` — the only client knob that asks the server to stop

The JDK 25 javadoc is precise, and its precision is mostly about what it does
*not* promise. It "sets the number of seconds the driver will wait for a
`Statement` object to execute", "**By default there is no limit**", "zero means
there is no limit", and "if the limit is exceeded, an `SQLTimeoutException` is
thrown". Then three qualifications:

> "A JDBC driver must apply this limit to the `execute`, `executeQuery` and
> `executeUpdate` methods."

> "JDBC driver implementations may also apply this limit to `ResultSet` methods
> (consult your driver vendor documentation for details)."

> "In the case of `Statement` batching, it is implementation defined as to whether
> the time-out is applied to individual SQL commands added via the `addBatch`
> method or to the entire batch."

⚠️ **The `ResultSet` note matters more than it looks.** With a fetch size set,
`rs.next()` crossing a fetch boundary issues a fresh round trip to the server
([chunk 12](15-fetch-size-and-streaming.md)) — and whether your query timeout
covers *that* round trip is, by the specification, the driver's choice. A
statement that returns its first row in 40 ms and then streams for six minutes is
not bounded by `setQueryTimeout` in any portable way.

⚠️ **And the batch note means a 30-second timeout on a 10,000-row batch is
ambiguous.** Per command or per batch changes the effective bound by four orders
of magnitude. Do not reason about batch deadlines from this method; bound them on
the server instead.

```java
try (PreparedStatement ps = c.prepareStatement(SQL)) {
    ps.setQueryTimeout(5);          // seconds — 1 is the smallest value that is not "off"
    ps.setString(1, sku);
    try (ResultSet rs = ps.executeQuery()) { ... }
}
```

🔴 **The API cannot express sub-second timeouts.** `setQueryTimeout(int seconds)`
takes an `int` and `0` already means "no limit", so 250 ms is unrepresentable —
and an accidental integer division that produces `0` silently *disables* the
timeout rather than tightening it. Reading pgjdbc at `REL42.7.13`,
`setQueryTimeout(int seconds)` is nothing but `setQueryTimeoutMs(seconds * 1000L)`,
and `setQueryTimeoutMs` is a public driver extension on
`org.postgresql.jdbc.PgStatement`:

```java
// driver-specific: reachable only by unwrapping, and it ties you to pgJDBC
ps.unwrap(org.postgresql.jdbc.PgStatement.class).setQueryTimeoutMs(250);
```

The portable alternative for a sub-second bound is the server:
`SET LOCAL statement_timeout = 250` — see [the server's own
timeouts](22d-server-side-timeouts.md).

⚠️ **`setQueryTimeout` is set on the `Statement`, so it is lost when the statement
is.** A framework that creates a fresh `PreparedStatement` per call and never
touches the method has no query timeout at all, no matter what you configured
elsewhere. That is the gap pgJDBC's `queryTimeout` *connection property* exists to
close — see below.
## Gotchas

**⚠️ A client timeout with no server timeout**
**Symptom:** every dashboard shows fast, clean failures, and the database is at
100% CPU running queries nobody is waiting for.
**Cause:** the client stopped waiting; the backend never stopped working, and it
only discovers the dead client when it next tries to write output.
**Fix:** a server-side `statement_timeout` is mandatory
([the server's own timeouts](22d-server-side-timeouts.md)). The client-side one is
a convenience on
top of it, never a substitute.

**⚠️ Reading `5000` as five seconds**
**Symptom:** a "5-second" bound that never fires, or one so large it is
effectively infinite.
**Cause:** `setQueryTimeout` and every pgJDBC socket property are **seconds**;
`setNetworkTimeout` is **milliseconds**; PostgreSQL GUCs are milliseconds when
written without a unit suffix.
**Fix:** write the unit into the name in Java (`queryTimeoutSeconds`,
`networkTimeoutMillis`) and into the literal in SQL (`'5s'`, `'2min'`).

**⚠️ Expecting `setQueryTimeout` to express 250 ms**
**Symptom:** `setQueryTimeout(millis / 1000)` producing `0` after integer
division — meaning *no limit at all*, the exact opposite of the intent.
**Cause:** the API takes whole seconds and `0` is the sentinel for "unlimited".
**Fix:** `SET LOCAL statement_timeout = 250` inside the transaction, or the
driver-specific `PgStatement.setQueryTimeoutMs` via `unwrap`.

**⚠️ Relying on `setQueryTimeout` to bound a streaming read**
**Symptom:** a query with a fetch size that returns its first row instantly and
then holds a thread for minutes, despite a query timeout being set.
**Cause:** the javadoc requires the limit only on `execute`, `executeQuery` and
`executeUpdate`; applying it to `ResultSet` methods is explicitly optional.
**Fix:** bound the work on the server, and treat a long-running cursor as a
deliberate design ([chunk 12](15-fetch-size-and-streaming.md)) with its own
supervision rather than something a statement timeout covers.

**⚠️ Assuming a batch timeout means what you think**
**Symptom:** a 30-second timeout on a 10,000-statement batch that either fires
almost immediately or never fires at all, depending on the driver.
**Cause:** documented as implementation-defined — "it is implementation defined as
to whether the time-out is applied to individual SQL commands added via the
`addBatch` method or to the entire batch".
**Fix:** do not reason about batch deadlines from `setQueryTimeout`. Bound the
batch on the server, or chunk the batch small enough that either reading of the
timeout is acceptable.

**⚠️ `setQueryTimeout` never called because the framework owns the `Statement`**
**Symptom:** a codebase where every hand-written DAO sets a timeout and the
repository layer, the health check and the metrics exporter have none.
**Cause:** the setting lives on the `Statement` object, so anything that creates
its own statements bypasses it entirely.
**Fix:** set pgJDBC's `queryTimeout` *connection* property so the driver applies a
default to every statement it creates, and treat per-statement calls as overrides
([the connection and socket layers](22b-connection-and-socket-timeouts.md)).

**⚠️ Setting the timeout after `execute` has been called**
**Symptom:** a timeout that is visibly configured and demonstrably never fires on
the first execution.
**Cause:** the value is read when execution starts — pgjdbc's `startTimer()` is
called inside the execute path and schedules its cancel task from the field's
value at that instant. Setting it afterwards affects only later executions.
**Fix:** configure the statement fully before executing it, which is also the
right shape for a `PreparedStatement` you intend to reuse.

**⚠️ Catching `SQLTimeoutException` and expecting it on PostgreSQL**
**Symptom:** a `catch (SQLTimeoutException e)` branch that never runs, with the
timeout instead landing in the generic `SQLException` handler.
**Cause:** the JDBC javadoc says the exception is thrown when the limit is
exceeded, but the JDK's own class documentation adds that it "does not correspond
to a standard SQLState", and pgJDBC surfaces the server's cancellation error
instead — `SQLTimeoutException` does not appear in `PgStatement.java` or
`QueryExecutorImpl.java` at tag `REL42.7.13`.
**Fix:** branch on the SQLState, not the exception class — `57014` is the one that
means cancelled. [How cancellation works](22f-how-cancellation-works.md) has the
full table.

## Interview questions

**★ You set a five-second timeout on the client and the query still runs for
twenty minutes on the server. Explain.**
Because a client-side timeout only stops the client waiting. The PostgreSQL
backend executing the query is a separate process that does not poll its client
socket during execution — the protocol documentation says cancel requests were
made deliberately cumbersome precisely so the backend need not check for frontend
input while working. If the client closes the socket, the backend discovers this
the next time it tries to write results, which for a long aggregate or a
no-rows-yet sequential scan may be many minutes away. Meanwhile the query holds
its snapshot, holds any locks it took, and consumes CPU and I/O. Under retry
pressure it compounds: each retry forks another backend and none of the abandoned
ones stop. The only real fix is a bound the server enforces itself.

**★ Name the layers a JDBC timeout can live at and say what each one actually
does.**
`Statement.setQueryTimeout(int seconds)` is JDBC-level: the driver arranges for
the statement to be cancelled after N seconds, which in pgJDBC means sending a
cancel request out of band on a second connection.
`Connection.setNetworkTimeout(Executor, int millis)` is a socket read timeout with
a severe consequence — the javadoc says the connection and everything created from
it are marked closed on expiry. pgJDBC's `socketTimeout` property is that same
mechanism expressed in seconds as configuration; reading the driver source, both
end at `Socket.setSoTimeout`. And PostgreSQL's `statement_timeout` family is
server-side, enforced by the backend regardless of the client. Only that last
group aborts work; the first three only stop you waiting for it.

**★ What exactly does the JDBC specification promise `setQueryTimeout` covers?**
Less than most people assume. It requires a driver to apply the limit to
`execute`, `executeQuery` and `executeUpdate` — and that is the whole mandatory
contract. Two further notes make everything else optional: drivers "may also apply
this limit to `ResultSet` methods (consult your driver vendor documentation for
details)", and for batching "it is implementation defined as to whether the
time-out is applied to individual SQL commands added via the `addBatch` method or
to the entire batch". So a query that returns its first row quickly and then
streams for minutes through `rs.next()`, and a large batch, are both outside the
guaranteed scope. The default is also worth stating: "By default there is no
limit", and zero means no limit — the API ships unbounded.

**★ Why can't you express a 250-millisecond query timeout through the JDBC API?**
Because `Statement.setQueryTimeout` takes an `int` number of seconds and zero is
already reserved as the sentinel for "no limit", so anything under a second either
rounds to zero — which disables the timeout entirely, the opposite of the intent —
or is unrepresentable. The escape routes are both non-portable in different ways.
pgJDBC exposes `setQueryTimeoutMs(long)` on its own `PgStatement`, reachable via
`unwrap`; the driver's own `setQueryTimeout` is literally implemented as
`setQueryTimeoutMs(seconds * 1000L)`. Or you use `SET LOCAL statement_timeout =
250` inside the transaction, which is PostgreSQL-specific SQL but has the much
larger advantage of being enforced by the server rather than merely requested by
the client.

**★ How would you bound the statements issued by a library you do not control?**
With pgJDBC's `queryTimeout` connection property rather than the `Statement` API.
The JDBC method is set on the statement object, so any component that creates its
own statements — an ORM, a framework health check, a metrics exporter — bypasses
whatever your own DAOs do. The driver documents `queryTimeout` as "the timeout
value in seconds that the driver will wait for a query to execute if not
explicitly set by `Statement.setQueryTimeout(int)`", which is exactly the
default-with-override shape you want: the driver applies it to everything, and
code that genuinely needs a different bound still calls the setter. Then backstop
it with a server-side `statement_timeout` on the application's role, because that
one binds even if the driver is replaced.

**★ Is `SQLTimeoutException` a reliable way to detect a query timeout?**
No, and this is worth knowing before you write the catch block. The
`setQueryTimeout` javadoc does say `SQLTimeoutException` is thrown when the limit
is exceeded, but the exception's own class documentation adds that it "does not
correspond to a standard SQLState", which is the hint that it is a driver-side
construct rather than something the wire protocol carries. On PostgreSQL the
timeout is realised by cancelling the statement, and what comes back is the
server's own error — reading pgjdbc at `REL42.7.13`, `SQLTimeoutException` does
not appear in `PgStatement.java` or in `QueryExecutorImpl.java` at all. The
portable habit is to branch on `SQLException.getSQLState()`, where `57014` means
the query was cancelled, rather than on the exception subclass.

**★ Why does setting a timeout on a `Statement` after calling `execute` have no
effect on that execution?**
Because the value is captured when execution begins. In pgjdbc the execute path
calls `startTimer()`, which reads the statement's current timeout field and, if it
is non-zero, schedules a cancel task on the connection's timer for that many
milliseconds before handing the query to the executor; the task is cancelled again
in a `finally` when execution returns. Changing the field afterwards changes what
the *next* execution schedules, not the one already in flight. The general lesson
is that `Statement` configuration — timeout, fetch size, max rows — is read at
execution time, so it must be set on a statement before it is used, which matters
most for a `PreparedStatement` that is reused across calls with different needs.

---
← Prev: [21e · Retrying and translating](21e-retrying-and-translating.md) · Index: [JDBC](README.md) · Next → [22b · Connection and socket timeouts](22b-connection-and-socket-timeouts.md)
