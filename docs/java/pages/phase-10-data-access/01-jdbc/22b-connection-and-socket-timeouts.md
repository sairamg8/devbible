---
title: "`setNetworkTimeout` does not fail your query — it destroys your connection"
sidebar_label: "22b · Connection and socket timeouts"
sidebar_position: 40
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JDK 25 API for `java.sql.Connection`
> (`setNetworkTimeout`, `getNetworkTimeout`, `abort`) and `java.net.Socket`
> (docs.oracle.com/en/java/javase/25/docs/api/), the pgJDBC *Connection
> Parameters* documentation (jdbc.postgresql.org/documentation/use/), and the
> pgjdbc source at tag `REL42.7.13` (`PgConnection.java`, `PGStream.java`,
> `QueryExecutorBase.java`, `QueryExecutorImpl.java`). JDK 25, JDBC 4.3,
> PostgreSQL 18, pgjdbc 42.7.13.

**[The statement-level timeout](22-timeouts-cancellation-metadata.md) asks the
server to stop. The two knobs on this page do not ask anyone anything: they are
socket read timeouts, and when they fire the connection is gone. That is the whole
difference, and it is why their correct value is much larger than a query
timeout, not smaller. `Connection.setNetworkTimeout` and pgJDBC's `socketTimeout`
turn out to be literally the same thing — both end at `Socket.setSoTimeout` — so
configuring both is not layered defence but a conflict with a documented winner.
And both ship effectively disabled: pgJDBC's `socketTimeout` defaults to `0`, so
out of the box a JDBC thread will wait on a partitioned network until the
operating system's TCP timeout, which the JDK's own javadoc puts at "typically 10
minutes".**

## `setNetworkTimeout` is `SO_TIMEOUT` with a demolition charge

The javadoc's own framing is the thing to internalise. It "sets the maximum period
a `Connection` or objects created from the `Connection` will wait for the database
to reply to any one request", and on expiry "the waiting method will return with a
`SQLException`, and the `Connection` or objects created from the `Connection`
**will be marked as closed**". Any later use other than `close`, `isClosed` or
`isValid` throws. It exists, the note says, to address

> "a rare but serious condition where network partitions can cause threads issuing
> JDBC calls to hang uninterruptedly in socket reads, until the OS TCP-TIMEOUT
> (typically 10 minutes)."

and it warns that the method "is severe in it's effects, and should be given a
high enough value so it is never triggered before any more normal timeouts, such
as transaction timeouts."

🔴 **The paragraph that decides your whole configuration** is this one, quoted in
full because every ordering decision in [the server's own
timeouts](22d-server-side-timeouts.md) follows from it:

> "The `Statement.setQueryTimeout()` timeout value is independent of the timeout
> value specified in `setNetworkTimeout`. If the query timeout expires before the
> network timeout then the statement execution will be canceled. If the network is
> still active the result will be that both the statement and connection are still
> usable. However if the network timeout expires before the query timeout or if
> the statement timeout fails due to network problems, the connection will be
> marked as closed, any resources held by the connection will be released and both
> the connection and statement will be unusable."

In pgJDBC this is not an abstraction over anything clever. At `REL42.7.13`,
`PgConnection.setNetworkTimeout` delegates to the query executor, which delegates
to `PGStream.setNetworkTimeout`, which is:

```java
public void setNetworkTimeout(int milliseconds) throws IOException {
  connection.setSoTimeout(milliseconds);
  pgInput.setTimeoutRequested(milliseconds != 0);
}
```

**It is `Socket.setSoTimeout`.** Which means `setNetworkTimeout(exec, 30_000)` and
the connection property `socketTimeout=30` are the *same* underlying knob written
in different units by different layers. Setting both is not defence in depth; it
is two owners of one value, and per pgJDBC's documented precedence the URL wins
([chunk 3](03-the-jdbc-url.md)).

⚠️ **`Connection.abort(Executor)` is the related escape hatch**, and it is worth
knowing it exists. Its javadoc: "Terminates an open connection… Insures that any
thread that is currently accessing the connection will either progress to
completion or throw an `SQLException`." That is the *administrator-thread* version
of `setNetworkTimeout` — for the case where some supervising thread does hold a
reference to the connection and wants the blocked thread released now. The
javadoc also cautions that when `abort` returns, "the `Executor` that was passed
as a parameter to abort may still be executing tasks to release resources", so it
is not a synchronous kill.

## What a socket timeout actually throws

This is the part people get wrong when writing the catch block. A read timeout is
not a `SQLTimeoutException` and it does not carry a PostgreSQL SQLState, because
the server never sent one — the server, as far as your process knows, said
nothing at all. Reading `QueryExecutorImpl` at `REL42.7.13`, an `IOException` from
the stream becomes:

```java
throw new PSQLException(
  GT.tr("An I/O error occurred while sending to the backend."),
  PSQLState.CONNECTION_FAILURE, ioe);
```

So what you catch is a plain `SQLException` whose SQLState is the connection-failure
class (`08`), with the underlying `java.net.SocketTimeoutException` as its cause.
That is a meaningfully different signal from a cancelled query and deserves a
different response:

| Signal | SQLState class | Connection afterwards | Sane response |
|---|---|---|---|
| statement cancelled / timed out | `57` | usable, after a rollback | fail the request; retry only if idempotent and cheap |
| socket read timeout | `08` | **dead** | fail the request; let the pool evict; do **not** retry on the same connection |

⚠️ **`SocketTimeoutException`'s own javadoc says "the `Socket` is still valid"** —
that is true of the socket in the abstract, but it is not true of a PostgreSQL
*session* on it. The protocol is a stateful message stream; a read that timed out
mid-message leaves the driver unable to know where the next message boundary is,
which is exactly why pgJDBC closes the connection rather than trying to resume.
The documented behaviour of `socketTimeout` says so plainly: "If reading from the
server takes longer than this value, **the connection is closed**."

🔴 **A dead connection is not a dead query.** The backend on the server is still
running the statement — closing your socket does not reach in and stop it, for
the reason [the statement-level chunk](22-timeouts-cancellation-metadata.md)
covers. If a socket timeout was caused by a genuinely slow query rather than a
partition, you have now destroyed a connection *and* left the query running. That
is the strongest argument for ordering the layers correctly.

## Gotchas

**⚠️ `setNetworkTimeout` used as a general query bound**
**Symptom:** connection churn under mild load — the pool destroying and reopening
connections, each one forking a new backend process on the server.
**Cause:** the javadoc is explicit that expiry marks the connection closed and
makes both connection and statement unusable. Using it where a query timeout
belongs pays a connection teardown for every slow query.
**Fix:** query bounds belong on the statement and on the server; the network
timeout sits far above them, "high enough… so it is never triggered before any
more normal timeouts".

**⚠️ Treating a socket timeout as a retryable query timeout**
**Symptom:** a retry loop firing immediately against a database already
struggling, turning a slow period into a connection storm.
**Cause:** the two failures look similar to the application and are not similar at
all — one leaves a usable connection, the other leaves a corpse *and* a query
still running on the server.
**Fix:** branch on the SQLState class. `08` means the connection died; back off,
let the pool evict, and do not assume the work stopped.

**⚠️ Catching `SQLTimeoutException` for a socket timeout**
**Symptom:** the catch block never fires and the failure lands in the generic
handler.
**Cause:** a socket timeout produces a `PSQLException` with
`PSQLState.CONNECTION_FAILURE`, not `SQLTimeoutException` — the server sent no
error at all, so there is nothing timeout-shaped to map.
**Fix:** inspect `getSQLState()` and, if you need the detail, walk `getCause()`
for a `java.net.SocketTimeoutException`.

**⚠️ Treating `Connection.abort` as a synchronous kill**
**Symptom:** code that calls `abort` and immediately assumes every resource is
released, or shuts down the executor it passed on the next line.
**Cause:** the javadoc says the connection is marked closed on return, but "the
`Executor` that was passed as a parameter to abort may still be executing tasks to
release resources".
**Fix:** treat `abort` as "this connection is now unusable", not "the cleanup has
finished". Do not hand it an executor whose termination you are about to await.

**⚠️ Calling `abort` with a `null` executor, or on a closed connection**
**Symptom:** an unexpected `SQLException` from cleanup code that was supposed to
be the safe path.
**Cause:** the javadoc throws `SQLException` "if a database access error occurs or
the executor is null" — but calling `abort` on an already-closed connection is
documented as "a no-op", so the two cases behave differently.
**Fix:** always pass a real executor. The no-op-on-closed guarantee means you do
not need to guard the call itself.

**⚠️ Assuming `setNetworkTimeout` is available**
**Symptom:** `SQLFeatureNotSupportedException` on a driver other than pgJDBC, or a
security failure under a restrictive policy.
**Cause:** the javadoc lists `SQLFeatureNotSupportedException` "if the JDBC driver
does not support this method", and pgJDBC's implementation calls
`checkPermission(SQL_PERMISSION_NETWORK_TIMEOUT)` before doing anything.
**Fix:** prefer the `socketTimeout` connection property, which is plain
configuration, and reserve the programmatic call for the case where you genuinely
need a different bound for one region of code and restore it afterwards.

**⚠️ Tightening the network timeout on a call that is already blocked**
**Symptom:** a supervising thread lowers the timeout on a stuck connection and
nothing happens.
**Cause:** documented — "Invocation of this method has no impact on already
outstanding requests."
**Fix:** that case is precisely what `Connection.abort(Executor)` is for. The
javadoc pairs the two deliberately: `abort` for when an administrator thread has
the connection, `setNetworkTimeout` for when nothing does.

**⚠️ Forgetting to restore a scoped network timeout**
**Symptom:** a long-running report path that lowered the network timeout leaves it
lowered for every later borrower of that pooled connection.
**Cause:** it is connection state like any other
([chunk 4](04-connection-is-expensive.md)), and the javadoc explicitly sanctions
this usage — "This method can be invoked more than once, such as to set a limit
for an area of JDBC code, and to reset to the default on exit from this area."
**Fix:** read `getNetworkTimeout()` first and restore it in a `finally`, exactly
as you would an isolation level.

## Interview questions

**★ Why is `setNetworkTimeout` described in its own javadoc as "severe"?**
Because on expiry it does not fail the statement, it destroys the connection: "the
`Connection` or objects created from the `Connection` will be marked as closed",
and any subsequent use other than `close`, `isClosed` or `isValid` throws. It
exists for one specific condition the javadoc names — a network partition leaving
threads hung in socket reads until the OS TCP timeout, typically ten minutes — and
that condition is rare. Using it as a general query bound means paying for a
connection teardown and re-establishment, including a new backend process fork on
the server, every time a query is merely slow. The javadoc's own instruction is to
set it high enough that it never fires before more normal timeouts.

**★ What is the relationship between `setNetworkTimeout` and pgJDBC's
`socketTimeout`?**
They are the same underlying knob. Reading pgjdbc at `REL42.7.13`,
`PgConnection.setNetworkTimeout` delegates down through the query executor to
`PGStream.setNetworkTimeout`, whose entire body is
`connection.setSoTimeout(milliseconds)` plus a flag on the input stream — so it is
the socket's `SO_TIMEOUT`. The `socketTimeout` connection property is that same
value supplied as configuration, in seconds rather than milliseconds. The
practical consequence is that setting both is not layered defence, it is a
conflict: pgJDBC documents that a property present in both the URL and a
`Properties` object takes the URL's value, so a `setNetworkTimeout` call in code
can be silently overridden by a URL the deployment platform supplied.

**★ A socket read timeout fires. What exception do you get, and is the connection
reusable?**
You get a `PSQLException` — an ordinary `SQLException` — with the
connection-failure SQLState class `08` and the `java.net.SocketTimeoutException`
as its cause. You do not get `SQLTimeoutException`, and you do not get
PostgreSQL's `57014`, because the server never sent an error; from your process's
point of view it simply stopped speaking. The connection is not reusable: pgJDBC's
documentation for `socketTimeout` says "the connection is closed", and the JDBC
javadoc for `setNetworkTimeout` says the connection and everything created from it
are marked closed. That is correct behaviour rather than defeatism — the protocol
is a stateful message stream, and a read that timed out mid-message leaves the
driver with no way to find the next message boundary.

**★ What does `Connection.abort` do that `setNetworkTimeout` does not?**
`abort` is initiated by a *third party*. `setNetworkTimeout` is a standing bound
that fires on its own when a reply does not arrive; `abort` is a method some
supervising thread calls, on a connection it holds a reference to, to release
whichever thread is currently blocked on it. The javadoc pairs them explicitly,
saying `setNetworkTimeout` "will cover cases where there is no administrator
thread, or it has no access to the connection". It also settles a related
question: changing the network timeout on an in-flight call does nothing, because
"invocation of this method has no impact on already outstanding requests" — so
`abort` really is the only lever once a thread is already stuck. `abort` marks the
connection closed and ensures any thread currently using it either completes or
throws, but it is not synchronous: on return, the executor you passed may still be
running cleanup tasks.

**★ Why should the network timeout be larger than every other timeout rather than
smaller?**
Because it is the only one whose expiry is destructive, and because it is
detecting a different failure. The javadoc spells out both halves. On ordering:
"If the query timeout expires before the network timeout then the statement
execution will be canceled. If the network is still active the result will be that
both the statement and connection are still usable. However if the network timeout
expires before the query timeout… the connection will be marked as closed… and
both the connection and statement will be unusable." On intent: it is there for
network partitions, not slow queries. Invert the order and every query in the band
between the two values destroys a connection instead of returning an error, so a
temporary slowdown becomes connection churn — new backend process forks on a
database that was already struggling, which makes more queries slow, which
destroys more connections.

**★ Is a socket that timed out on read still valid?**
The socket is; the database session on it is not, and conflating the two is the
mistake. `SocketTimeoutException`'s javadoc says the exception is raised "though the
Socket is still valid", true at the TCP level — you could read again. But the
PostgreSQL wire protocol is a stream of length-prefixed messages, and a read that
timed out partway through one leaves the driver unable to say where the next message
begins or which of your requests the pending bytes belong to. There is no
resynchronisation point. That is why both pgJDBC's documented `socketTimeout`
behaviour and JDBC's `setNetworkTimeout` contract close the connection rather than
attempt to continue, and why a retry has to happen on a fresh connection.

**★ Does a network timeout stop the query?**
No, and this is the trap that makes ordering matter. Closing your socket does not
reach into the server and abort anything; the backend keeps executing until it
finishes or until it next tries to write output and discovers nobody is listening.
So a network timeout that fired because a query was genuinely slow — rather than
because the network broke — has achieved the worst of both worlds: you destroyed a
connection, you will pay to fork a new backend to replace it, and the original
query is still running and still holding its snapshot and locks. Only the server's
own `statement_timeout`, or a cancel that actually arrives, stops the work.

---
← Prev: [22 · Client-side timeouts](22-timeouts-cancellation-metadata.md) · Index: [JDBC](README.md) · Next → [22c · pgJDBC's timeout properties](22c-pgjdbc-timeout-properties.md)
