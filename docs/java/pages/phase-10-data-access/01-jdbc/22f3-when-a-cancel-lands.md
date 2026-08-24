---
title: "Interrupting the Java thread does not cancel the query — and on a virtual thread it destroys the connection instead"
sidebar_label: "22f3 · When a cancel lands"
sidebar_position: 46
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the PostgreSQL 18 manual *Canceling Requests in
> Progress* (postgresql.org/docs/18/protocol-flow.html), *Server Signaling
> Functions* (postgresql.org/docs/18/functions-admin.html) and the *Error Codes*
> appendix (postgresql.org/docs/18/errcodes-appendix.html), the JDK 25 API for
> `java.net.Socket`
> (docs.oracle.com/en/java/javase/25/docs/api/java.base/java/net/Socket.html) and
> `java.sql.Statement`
> (docs.oracle.com/en/java/javase/25/docs/api/java.sql/java/sql/Statement.html), and
> the pgjdbc source at tag `REL42.7.13` — `PgStatement.java`,
> `QueryExecutorBase.java`, `PGConnection.java`, `PSQLState.java`. JDK 25, JDBC 4.3,
> PostgreSQL 18, pgjdbc 42.7.13.

**[Chunk 22f](22f-how-cancellation-works.md) was the protocol and
[22f2](22f2-what-pgjdbc-actually-does.md) was the driver. This one is what you
actually do with them. Three things to take away. A cancel that succeeds arrives as
SQLState `57014` on the *original* connection, at the thread still blocked in
`executeQuery` — and it aborts the whole transaction, not just the statement.
Calling `Thread.interrupt()` on the thread running a query does **not** cancel
anything: on a platform thread it does nothing at all, and on a virtual thread the
JDK 25 javadoc says it closes the socket, which loses you the connection while the
query keeps running on the server. And when the application cannot cancel at all,
the job falls to the operator — [chunk 22f4](22f4-the-operators-tools.md).**

## Best effort, and the manual says so

This is the paragraph to remember, because it is the whole contract:

> "The cancellation signal might or might not have any effect — for example, if it
> arrives after the backend has finished processing the query, then it will have no
> effect. If the cancellation is effective, it results in the current command being
> terminated early with an error message."

> "The upshot of all this is that for reasons of both security and efficiency, the
> frontend has no direct way to tell whether a cancel request has succeeded. It must
> continue to wait for the backend to respond to the query. Issuing a cancel simply
> improves the odds that the current query will finish soon, and improves the odds
> that it will fail with an error message instead of succeeding."

Three consequences fall straight out of that, and all three surprise people:

1. **A cancelled query may still succeed.** If it finished while the cancel was in
   flight, `executeQuery` returns rows normally — handle "I cancelled it and got a
   result anyway".
2. **You cannot detect success from `cancel()`.** It returns `void` on purpose;
   there is nothing truthful it could return.
3. **The executing thread keeps waiting.** "It must continue to wait for the backend
   to respond to the query." `cancel()` does not unblock the other thread; the
   server's error response does. If the cancel is lost, that thread waits exactly as
   long as it would have without you.

⚠️ **The signal is asynchronous inside the server too.** The manual notes it "is done
by sending a special signal to the backend process that is processing the query", and
a signal is noticed at the backend's next interrupt check — sooner in a loop over
rows, later inside a long uninterruptible step.

## What a landed cancel throws

The backend ends the command with an error, and that error travels back on the
*original* connection to the thread still waiting in `executeQuery`:

| SQLState | Condition | Raised by |
|---|---|---|
| `57014` | `query_canceled` | `Statement.cancel()`, `setQueryTimeout` expiry, `statement_timeout`, `pg_cancel_backend` |
| `55P03` | `lock_not_available` | `lock_timeout` — a different condition ([chunk 22d](22d-server-side-timeouts.md)) |
| `57P01` | `admin_shutdown` | `pg_terminate_backend`, server shutdown |
| `25P02` | `in_failed_sql_transaction` | every statement *after* one of the above, until you roll back |

🔴 **All four causes of `57014` are indistinguishable from the SQLState alone.** A
user pressing Stop, a client-side query timeout, a server-side `statement_timeout`
and a DBA running `pg_cancel_backend` produce the same code, because from the
backend's point of view they are the same event. If you need to tell them apart you
must carry that knowledge yourself.

```java
volatile boolean userAskedToStop = false;      // set just before ps.cancel()

try (ResultSet rs = ps.executeQuery()) {
    return map(rs);
} catch (SQLException e) {
    if (PSQLState.QUERY_CANCELED.getState().equals(e.getSQLState())) {   // "57014"
        conn.rollback();                       // the transaction is aborted, not just the statement
        throw userAskedToStop ? new StoppedByUser(e) : new QueryTookTooLong(e);
    }
    throw e;
}
```

⚠️ **`SQLTimeoutException` is not what arrives** — the timeout is realised as a cancel,
so what comes back is the server's `57014`. [Chunk 22](22-timeouts-cancellation-metadata.md)
has that in full; [chunk 21c](21c-what-pgjdbc-throws.md) maps pgjdbc's exceptions.

🔴 **Roll back, or poison the pool.** After `57014` the *transaction* is aborted; every
following statement fails with `25P02` until a rollback
([chunk 19g](19g-locks-and-long-transactions.md)). Forget it and the connection returns
to the pool in that state, and one cancelled report becomes twenty broken requests
([chunk 22e](22e-setting-the-timeouts.md)).

**But the connection itself is fine.** That is the difference from a socket timeout,
where the driver's javadoc calls the effect severe, the connection is marked closed,
and the query keeps running unmolested ([chunk 22b](22b-connection-and-socket-timeouts.md)).
A cancel costs you a transaction; a network timeout costs a connection *and* leaves
the work running.

## `Thread.interrupt()` is not a cancel, and on JDK 25 it is worse

The instinct is to treat a blocked JDBC call like any other blocking operation and
interrupt the thread. It does not work, and the reason matters.

**On a platform thread: nothing happens.** The thread is inside a blocking socket
read. `Thread.interrupt()` sets the interrupt flag, and for anything not waiting in
`Object.wait`, `Thread.sleep` or a `java.util.concurrent` blocking call that is the
end of it. The flag sits set; the read blocks on.

**On a virtual thread: the socket dies.** The JDK 25 javadoc for
`Socket.getInputStream()` says so:

> "The socket uses the system-default socket implementation and a virtual thread is
> reading from the input stream. In that case, interrupting the virtual thread will
> cause it to wakeup and close the socket. The read method will then throw
> `SocketException` with the interrupt status set."

`getOutputStream()` carries the identical wording for writes. So on JDK 25 with
virtual threads, interrupting a thread that is blocked reading a query result
**closes the connection**. The thread wakes, which feels like a win — but nothing
was cancelled. The backend is still executing the query, and it will not find out
its client is gone until it next tries to write output. You have traded a working
connection for a query that still runs. That is the `setNetworkTimeout` outcome
[chunk 22b](22b-connection-and-socket-timeouts.md) calls a demolition charge, arrived
at by accident.

⚠️ **What is confirmed and what is not.** The javadoc guarantee is scoped to "the
system-default socket implementation". pgjdbc obtains its socket from a
`SocketFactory`, which by default is the system default — but a TLS connection layers
an `SSLSocket` over it, and **I could not confirm from the JDK 25 documentation
whether the same interrupt behaviour holds through that wrapper.** Treat the
plaintext case as documented and the TLS case as untested.

⚠️ **pgjdbc defers interrupts of its own.** In `killTimerTask()` at `REL42.7.13`, when
the executing thread must wait for an in-flight cancel it catches
`InterruptedException`, records it in a local flag, **keeps waiting**, and re-interrupts
only once the state reaches `IDLE`. That is correct — abandoning the wait would reopen
the race [chunk 22f2](22f2-what-pgjdbc-actually-does.md) describes — but an interrupt is
not even promptly *observed* there.

🔴 **What to do instead.** Keep a reference to the `Statement` and call `cancel()`
from the other thread. That is exactly what the method is for, and the javadoc says
so: "This method can be used by one thread to cancel a statement that is being
executed by another thread." Interruption is for your own code; cancellation is for
the database.

```java
Future<Report> f = executor.submit(() -> run(ps));
try {
    return f.get(5, TimeUnit.SECONDS);
} catch (TimeoutException e) {
    ps.cancel();          // the right lever
    // NOT f.cancel(true) — that interrupts, which cancels nothing on the server
    throw e;
}
```

## Gotchas

**⚠️ Using `Future.cancel(true)` to stop a query**
**Symptom:** the future completes, the thread is freed, and the database keeps
working — or on virtual threads, the connection is gone too.
**Cause:** `cancel(true)` interrupts. On a platform thread the interrupt does not
break a socket read at all; on a virtual thread the JDK 25 javadoc says the socket is
closed and the read throws `SocketException`. Neither tells the server anything.
**Fix:** call `Statement.cancel()`, and treat the `Future` as a way to stop *waiting*
rather than a way to stop working.

**⚠️ Not rolling back after catching `57014`**
**Symptom:** a clean error for the cancelled request, then a flood of `25P02` from
requests that did nothing wrong.
**Cause:** the cancel aborts the transaction, not just the statement, and the
connection goes back to the pool in that state.
**Fix:** `rollback()` in the catch block before release, and give the pool a
connection-test query for the ones that slip through.

**⚠️ Treating `57014` as "the user cancelled"**
**Symptom:** an analytics dashboard reporting mass user cancellations during an
incident that was actually a `statement_timeout`.
**Cause:** four different causes share the code, and the wire carries no distinction.
**Fix:** set a flag before calling `cancel()` and interpret `57014` against it.
Without the flag, the honest label is "stopped", not "cancelled by user".

**⚠️ Using cancellation to undo a write**
**Symptom:** an `UPDATE` you cancelled turns out to have committed.
**Cause:** the cancel is racy in both directions. Arriving after the backend
finished, "it will have no effect" — and in autocommit the work is already durable.
**Fix:** bound writes with an explicit transaction you can roll back, and check the
outcome rather than inferring it from having asked for a cancel.

**⚠️ Building a cancel endpoint with no `Statement` reference**
**Symptom:** a "Stop" button that can only be implemented by killing backends.
**Cause:** the executing thread wrapped the statement in try-with-resources and
nobody else can reach it.
**Fix:** register the in-flight `Statement` in a map keyed by request id for the
duration of the call, and remove it in a `finally`. Ownership stays with the
executing thread ([chunk 17](17-resource-handling.md)); only the reference is shared.

**⚠️ Cancelling a statement whose results you are still streaming**
**Symptom:** a cancel during a large fetch that seems to do nothing for a long time.
**Cause:** with a fetch size set, the backend produces a batch and then waits for
you; it is idle, not executing, so there may be nothing to cancel at that instant,
and the statement's state is not `IN_QUERY` between fetches
([chunk 15](15-fetch-size-and-streaming.md)).
**Fix:** stop consuming and close the `ResultSet`, which is what actually ends a
streaming read; cancellation is for a statement that is genuinely working.

## Interview questions

**★ A cancel lands. What does the application see, and what state is the connection
in?**
The thread still blocked in `executeQuery` gets an `SQLException` whose SQLState is
`57014`, `query_canceled` — the server ended the command early with an error and sent
it down the original connection. The connection itself is healthy: this was a
server-side abort, not a network failure, and the session survives. The *transaction*
does not. It is aborted, so every subsequent statement on that connection fails with
`25P02`, `in_failed_sql_transaction`, until you roll back. So the handling is: catch,
check the SQLState, `rollback()`, then translate to something meaningful for the
caller. Contrast this with a socket read timeout, where the driver marks the
connection closed, the server was never told anything, and the query carries on
running — a cancel costs you a transaction, a network timeout costs you a connection
and leaves the work in place.

**★ Why doesn't `Thread.interrupt()` stop a JDBC query, and what changes with virtual
threads on JDK 25?**
On a platform thread it does nothing useful. The thread is blocked in a socket read,
which is not one of the operations that responds to interruption — `interrupt()` sets
the flag and the read carries on. On a virtual thread the JDK 25 `Socket` javadoc
documents different behaviour: where "the socket uses the system-default socket
implementation and a virtual thread is reading from the input stream… interrupting
the virtual thread will cause it to wakeup and close the socket. The read method will
then throw `SocketException` with the interrupt status set." That sounds better and
is arguably worse. Your thread is freed, but nothing was cancelled — the backend is
still executing, and it will not notice the dead client until it next tries to write
output — and you have destroyed a pooled connection to achieve it. The right lever is
`Statement.cancel()`, which the javadoc explicitly designs for one thread stopping
another's statement. One honest caveat: the javadoc's guarantee names the
system-default socket implementation, and I have not confirmed the behaviour through
an `SSLSocket` wrapper.

**★ Design a "Stop this report" button end to end.**
The hard part is not the cancel, it is the reference. When a request starts, put the
`PreparedStatement` into a concurrent map keyed by request id and remove it in a
`finally`; the executing thread still owns the lifecycle and closes it, and the map
holds a borrowed reference only. The Stop endpoint looks up that id, sets a flag
recording that the user asked, and calls `cancel()` — never `Future.cancel(true)`,
which interrupts and cancels nothing on the server. The executing thread then either
returns rows, because the cancel lost the race and that is a documented outcome, or
throws `57014`, at which point it rolls back and reports "stopped", using the flag to
decide whether to say "by you" or "took too long". Two things to design around: the
cancel opens a new connection to the database, so the Stop path needs the database to
be reachable, and this only works while the process holding the statement is alive —
for anything longer-lived, record the backend PID from `getBackendPID()` so an
operator can use `pg_cancel_backend` instead.

**★ Your service reports thousands of successful cancels and the database is still
saturated. What are the candidate explanations?**
Start by distrusting "successful", because nothing in the stack can actually observe
that. `cancel()` returns `void`, the protocol makes "no direct reply" to a cancel
request, and pgjdbc swallows any `IOException` from the attempt at `FINEST`. So
"successful" almost certainly means "we called the method". From there the candidates
are: the packets never left, because a firewall, proxy or pooler is dropping new
inbound connections that do not begin with a StartupMessage; the packets arrived too
late, and the manual is explicit that a cancel arriving after the backend finished
"will have no effect"; the PID and key belong to a pooler rather than a real backend;
or the cancels landed correctly and the saturation is from *abandoned* work whose
clients timed out without cancelling at all, which is the pattern
[chunk 22](22-timeouts-cancellation-metadata.md) describes. The measurement that
settles it is server-side: count `57014` in the PostgreSQL log and compare it with
your count of cancels issued.

**★ Why is `57014` on its own not enough to decide whether to retry?**
Because it means "somebody stopped this", and the right response depends entirely on
who. A user pressing Stop should not be retried at all — they asked for it to end. A
client-side query timeout probably should not be retried immediately either, since the
query is likely to be just as slow the second time and a retry adds load to a database
that is already struggling. A server-side `statement_timeout` says the same thing more
authoritatively. Only an operator's `pg_cancel_backend` during an unrelated incident
looks like something a later retry might succeed at. The SQLState cannot distinguish
any of these, so a retry policy keyed on `57014` alone is guessing. Contrast `55P03`,
`lock_not_available`, which carries real information: the statement was fine but
something else held a lock, so a retry with jitter and a small cap is reasonable
([chunk 21e](21e-retrying-and-translating.md)). The practical answer is to record your
own intent — a flag set before `cancel()`, a deadline the application tracks — and let
that, not the SQLState, drive the decision.

---
← Prev: [22f2 · What pgJDBC does](22f2-what-pgjdbc-actually-does.md) · Index: [JDBC](README.md) · Next → [22f4 · The operator's tools](22f4-the-operators-tools.md)
