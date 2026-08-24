---
title: "pgJDBC's cancel is forty lines of source, and three of them explain every cancel you have seen fail"
sidebar_label: "22f2 · What pgJDBC does"
sidebar_position: 45
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the pgjdbc source at tag `REL42.7.13` —
> `org/postgresql/jdbc/PgStatement.java`, `org/postgresql/jdbc/PgConnection.java`,
> `org/postgresql/core/QueryExecutorBase.java`,
> `org/postgresql/core/v3/ConnectionFactoryImpl.java` — the pgJDBC *Connection
> Parameters* documentation (jdbc.postgresql.org/documentation/use/), the
> PostgreSQL 18 manual *Canceling Requests in Progress*
> (postgresql.org/docs/18/protocol-flow.html), and the libpq *Canceling Queries in
> Progress* documentation (postgresql.org/docs/18/libpq-cancel.html). JDK 25, JDBC
> 4.3, PostgreSQL 18, pgjdbc 42.7.13.

**[The previous chunk](22f-how-cancellation-works.md) described the protocol; this
one reads the driver. Three lines of pgjdbc source explain most of the "I called
cancel and nothing happened" reports in existence: a cancel on a statement that is
not currently executing returns silently and does nothing; a cancel sent before the
connection has received its key returns silently and does nothing; and every network
failure on the cancel path is caught, logged at `FINEST`, and thrown away — the
source comment reads "Safe to ignore". A fourth fact matters before a security
review: the cancel connection performs no TLS negotiation at all.**

## The state machine comes before the socket

`Statement.cancel()` lands in `PgStatement.cancel()`, and the first thing it does is
decide whether there is anything to cancel:

```java
// org.postgresql.jdbc.PgStatement, REL42.7.13 — abridged
public void cancel() throws SQLException {
  if (statementState == StatementCancelState.IDLE) {
    return;                                     // nothing running: silent no-op
  }
  if (!STATE_UPDATER.compareAndSet(this, StatementCancelState.IN_QUERY,
                                   StatementCancelState.CANCELING)) {
    return;                                     // someone else got there first
  }
  try (ResourceLock connectionLock = connection.obtainLock()) {
    try {
      connection.cancelQuery();
    } finally {
      STATE_UPDATER.set(this, StatementCancelState.IDLE);
      connection.lockCondition().signalAll();   // wake up killTimerTask
    }
  }
}
```

**Two silent returns, and both matter.** A statement has three states — `IDLE`,
`IN_QUERY`, `CANCELING` — and `cancel()` only proceeds from `IN_QUERY`. Cancel one a
millisecond after it finished and you get nothing: no exception, no warning, no log
at the default level.

The `compareAndSet` handles the other direction. Two threads calling `cancel()` at
once — a user clicking Stop while the query timeout fires — produce exactly one
packet, because only one can win the transition.

## The socket, and the three lines around it

`connection.cancelQuery()` is three lines (`checkClosed()`, then
`queryExecutor.sendQueryCancel()`), and `sendQueryCancel()` in `QueryExecutorBase`
writes the packet [chunk 22f](22f-how-cancellation-works.md) described:

```java
// org.postgresql.core.QueryExecutorBase, REL42.7.13 — abridged
byte[] cancelKey = this.cancelKey;
if (cancelKey == null) {
  // logged at FINEST: "Can't send cancel request since cancelKey is null.
  //                    It might be the cancel key is not received yet"
  return;
}
// Cancel signal is variable since protocol 3.2 so we use cancelKey.length + 12
cancelStream = new PGStream(pgStream.getSocketFactory(), pgStream.getHostSpec(),
                            cancelSignalTimeout, cancelKey.length + 12);
if (cancelSignalTimeout > 0) {
  cancelStream.setNetworkTimeout(cancelSignalTimeout);
}
cancelStream.sendInteger4(cancelKey.length + 12);   // length, including itself
cancelStream.sendInteger2(1234);                    // the two halves of
cancelStream.sendInteger2(5678);                    // the 80877102 code
cancelStream.sendInteger4(cancelPid);
cancelStream.send(cancelKey);
cancelStream.flush();
cancelStream.receiveEOF();                          // wait for the server to hang up
```

`12 + key.length` is exactly the four protocol fields: 4 of length, 4 of code, 4 of
PID, then the key. Three things around it decide how cancellation behaves.

**A new `PGStream` means a brand new socket.** Not a pooled one, not a spare — a
fresh TCP connection, with a DNS lookup if the name is not cached and a handshake
every time, over the same network that just made you time out.
[Chunk 4](04-connection-is-expensive.md) covers why a PostgreSQL connection is
expensive; a cancel pays the TCP part of that bill, not the fork or the login.

**`cancelSignalTimeout` bounds both halves of it.** pgJDBC documents it as: "Cancel
command is sent out of band over its own connection, so cancel message can itself
get stuck. This property controls 'connect timeout' and 'socket timeout' used for
cancel commands. The timeout is specified in seconds." Default 10. The property and
its neighbours are [chunk 22c](22c-pgjdbc-timeout-properties.md); the code above is
*why* it has to exist — the cancel does a `connect()` and then a blocking read.

**`receiveEOF()` is the only reply there is.** The driver reads no status byte —
the protocol sends none. It waits for the server to close the socket, and that
closure means the request was processed.

## The `IOException` that disappears

The whole block sits inside a `try` whose `catch` is two lines:

```java
} catch (IOException e) {
  // Safe to ignore.
  LOGGER.log(Level.FINEST, "Ignoring exception on cancel request:", e);
}
```

🔴 **Every network failure on the cancel path is silent.** Connection refused,
connection reset, a firewall dropping the SYN, `cancelSignalTimeout` expiring on the
read — each produces one `FINEST` log line, and `cancel()` returns normally. Above
the driver, a cancel that never reached the server looks exactly like one that did.

This is defensible: the manual says the frontend "has no direct way to tell whether
a cancel request has succeeded" anyway, so there is nothing honest to report. But it
changes how you debug. **The only way to see a cancel leave is to raise
`org.postgresql` to `FINEST`**, which logs `FE=> CancelRequest(pid=…,ckey=…)` before
sending.

## Waiting is deliberate, and it closes a race

`receiveEOF()` costs the cancelling thread a round trip, and pgjdbc spends it on
purpose. In `cancel()` above, the state returns to `IDLE` only *after*
`cancelQuery()` comes back. On the other side, the executing thread's
`killTimerTask` refuses to release the statement until that state is `IDLE`, waiting
on the connection's lock condition in a loop if it must — the source notes the
ordering matters "in case we need to wait for the cancel task".

The property this buys is worth naming: **a timeout's cancel can never still be in
flight when the connection begins its next statement.** Without it you would have
the hazard the protocol warns about, where a late cancel lands on an innocent
successor query.

⚠️ **It is not free, and the bill arrives during incidents.** A statement whose
timeout fires does not return to your code until the cancel round trip finishes or
`cancelSignalTimeout` expires — so on a failing network a five-second query timeout
can take fifteen seconds to surface.

## The cancel connection is not encrypted

🔴 **`sendQueryCancel()` never calls `enableSSL`.** The cancel stream is built
straight from `pgStream.getSocketFactory()`. Compare the login path in
`ConnectionFactoryImpl`, which negotiates GSS encryption, then SSL, then sends the
startup packet; the cancel path negotiates nothing. So with the default socket
factory, **the process ID and secret cancel key cross the network in clear text even
when every byte of query traffic is TLS-encrypted.**

This is not a pgjdbc eccentricity. PostgreSQL's own C library had the same behaviour
and deprecated an API over it: libpq's documentation says `PQcancel` and
`PQgetCancel` are "deprecated due to not sending the cancel requests in an encrypted
manner, even when the original connection specified `sslmode` or `gssencmode` to
require encryption", and that the replacement `PQcancelCreate` makes the cancel
connection "with these same requirements".

⚠️ **Check this against the driver version you actually ship** rather than treating
it as permanent. It is the kind of thing that gets fixed, and the check is a
one-minute read of `sendQueryCancel` in your own jar's sources. Meanwhile, state the
exposure accurately in reviews, keep the database port unreachable from anywhere
that has no business cancelling queries, and prefer server-enforced timeouts
([chunk 22d](22d-server-side-timeouts.md)), which put no key on the wire at all.

## Gotchas

**⚠️ Reading "cancel returned normally" as "the query was cancelled"**
**Symptom:** a cancel button that reports success while the query runs on.
**Cause:** three independent silent paths — the `IDLE` short-circuit, the null
`cancelKey` check, and the swallowed `IOException` — all end with `cancel()`
returning normally.
**Fix:** the only evidence lives on the executing thread. Report success when *it*
reports `57014`, never when `cancel()` returns
([chunk 22f3](22f3-when-a-cancel-lands.md)).

**⚠️ Debugging a cancel at `INFO` or `DEBUG`**
**Symptom:** hours spent on packet captures because the application logs are empty.
**Cause:** both interesting messages — the outgoing `FE=> CancelRequest` and the
ignored `IOException` — are logged at `FINEST`, the lowest level
`java.util.logging` has.
**Fix:** turn `org.postgresql` up to `FINEST` on one instance before reaching for
`tcpdump`. It answers "did we even try?" in one line.

**⚠️ Closing the `Statement` from the cancelling thread**
**Symptom:** an `SQLException` out of `cancel()` itself, or a race where the worker
thread blows up on a statement someone else closed.
**Cause:** `cancel()` on a closed `Statement` is an error by specification, and
closing belongs to the owner, not the canceller.
**Fix:** one thread owns the lifecycle ([chunk 17](17-resource-handling.md)); the
canceller only ever calls `cancel()`.

**⚠️ `cancelSignalTimeout` left unconsidered on a flaky network**
**Symptom:** a query timeout that itself hangs — the very thread the timeout was
meant to release is now stuck inside the cancel.
**Cause:** the cancel opens a fresh socket and then blocks in `receiveEOF()`, and
the executing thread is not released until that returns. If the network fault that
caused the timeout is still there, the cancel crosses the same broken network.
**Fix:** keep it at or below its default of 10 seconds, and remember that a slow
timeout can be the cancel rather than the query
([chunk 22c](22c-pgjdbc-timeout-properties.md)).

**⚠️ A cancel issued before the connection has finished starting up**
**Symptom:** a cancel very early in a connection's life that does nothing, with no
error anywhere.
**Cause:** `sendQueryCancel()` returns immediately if `cancelKey` is null, logging
"It might be the cancel key is not received yet". Before `BackendKeyData` arrives
there is literally nothing to send.
**Fix:** nothing to fix in normal code — but know this is a documented no-op rather
than a lost packet, so do not go hunting the network for it.

## Interview questions

**★ Walk me through what happens inside the driver when `setQueryTimeout(5)` fires.**
At execution time `startTimer()` schedules a `StatementCancelTimerTask` on the
connection's timer for five seconds out and sets the state to `IN_QUERY`. When the
task fires, `cancelIfStillNeeded` first compare-and-swaps the task reference to null
— if the statement already finished and cleared it, the cancel is abandoned — and
otherwise calls `PgStatement.cancel()`. That moves `IN_QUERY` to `CANCELING`, takes
the connection lock, and calls `connection.cancelQuery()`, which calls
`sendQueryCancel()`. There the driver opens a new `PGStream` bounded by
`cancelSignalTimeout`, writes the length, the `1234`/`5678` code, the PID and the
key, flushes, and blocks in `receiveEOF()` until the server closes the socket. The
`finally` then restores `IDLE` and signals the condition the executing thread may be
waiting on. All the while the original thread is still inside `executeQuery`; what
wakes it is the server ending the command with `57014`.

**★ A cancel is not working in production. How do you find out why?**
Eliminate the three silent paths in order. Was the statement actually executing?
`PgStatement.cancel()` returns immediately when the state is `IDLE`, so a cancel a
moment too late is a no-op. Did the driver have a key to send? `sendQueryCancel()`
bails out if `cancelKey` is null. Did the packet get out? Turn `org.postgresql` up
to `FINEST` — the driver logs `FE=> CancelRequest(pid=…,ckey=…)` before sending, and
logs any `IOException` from the attempt at the same level with the comment "Safe to
ignore", which is where a firewall or pooler dropping the new inbound connection
shows up. If the packet left and the query still ran, check `pg_stat_activity` for
that PID, and check whether a pooler rather than PostgreSQL owns that PID and key.

**★ Why does pgJDBC block in `receiveEOF()` rather than firing and returning?**
Because the socket closing is the only event the protocol offers, and waiting for it
closes a race. The manual says "for security reasons, no direct reply is made to the
cancel request message" — the server processes the request and then closes the
connection, so EOF means "processed". pgjdbc uses that as a synchronisation point:
`cancel()` restores the `IDLE` state only in a `finally` after `cancelQuery()`
returns, and on the executing side `killTimerTask` waits on the connection's lock
condition until the state is `IDLE` again. The property that buys is that a
timeout's cancel can never still be in flight when the connection starts its next
statement — precisely the hazard where a late cancel kills an innocent successor.
The cost is one round trip, bounded by `cancelSignalTimeout`, and a timed-out
statement that does not return to your code until it completes.

**★ A colleague says "our cancels are fine, the connection uses TLS". Your answer?**
That those are two different connections and only one is encrypted. Reading pgjdbc
at `REL42.7.13`, `sendQueryCancel()` constructs its `PGStream` directly from the
socket factory and never performs SSL or GSS negotiation, unlike the login path in
`ConnectionFactoryImpl`, which does both before sending the startup packet. So the
process ID and secret cancel key go out in clear text on a fresh socket even when
every byte of query traffic is encrypted. It is not a pgjdbc quirk: libpq had the
same behaviour and deprecated its old cancel API over it, describing
`PQcancel`/`PQgetCancel` as deprecated "due to not sending the cancel requests in an
encrypted manner, even when the original connection specified `sslmode` or
`gssencmode` to require encryption". The mitigations are network-level, and
architectural — a server-enforced `statement_timeout` never puts a key on the wire.

**★ Why does the driver swallow the `IOException`, and what does that cost you?**
Because there is nothing honest to report. The protocol gives the frontend "no
direct way to tell whether a cancel request has succeeded", so even a perfectly
transmitted cancel proves nothing; propagating a transmission failure would imply a
certainty the mechanism does not have, and `cancel()` is often running on a timer
thread with no caller to receive it anyway. The cost is diagnostic. A firewall
dropping the new connection, a `cancelSignalTimeout` expiring, a refused connect —
all collapse into one `FINEST` line reading "Ignoring exception on cancel request".
From the application's point of view a cancel that never left the machine looks
exactly like one the server received and acted on. Hence the debugging order: raise
`org.postgresql` to `FINEST` first, reach for a packet capture second.

**★ Two threads call `cancel()` on the same statement at the same moment.**
One packet is sent. `PgStatement.cancel()` is a compare-and-set from `IN_QUERY` to
`CANCELING`, so the first thread to make that transition proceeds and the second
observes the CAS fail and returns silently — the source comment reads "Not in query,
there's nothing to cancel". The winner takes the connection lock, sends the request,
and in a `finally` restores `IDLE` and signals the lock condition so any thread
waiting inside `killTimerTask` can proceed. This is a common real situation rather
than a contrived one: a user pressing Stop at the moment a query timeout fires is
exactly this race, and the design makes it boring. The only practical consequence is
for instrumentation — a counter incremented per `cancel()` call will overcount the
packets actually sent.

---
← Prev: [22f · How cancellation works](22f-how-cancellation-works.md) · Index: [JDBC](README.md) · Next → [22f3 · When a cancel lands](22f3-when-a-cancel-lands.md)
