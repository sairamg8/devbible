---
title: "A `Connection` is a process on another machine, and it is not thread-safe"
sidebar_label: "4 · A `Connection` is expensive"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-20 against the JDK 25 API for `java.sql.Connection`
> (docs.oracle.com/en/java/javase/25/docs/api/java.sql/), the pgJDBC
> documentation *Using the Driver in a Multithreaded or a Servlet Environment*
> (jdbc.postgresql.org/documentation/thread/), and the PostgreSQL 18 manual
> *Connections and Authentication* and *Concurrency Control*. JDK 25, JDBC 4.3,
> PostgreSQL 18, pgjdbc 42.7.13.

**"Connections are expensive" is repeated so often that it has stopped carrying
information. Here is the concrete version. Opening a PostgreSQL connection costs
a TCP handshake, usually a TLS handshake, an authentication exchange of several
round trips, and — this is the part that makes PostgreSQL different from most
databases people have used — the **fork of a new operating-system process on the
database server**, with its own memory allocation and its own catalogue caches to
populate. That process lives until the connection closes. So a `Connection` is
not a lightweight handle to a shared server; it is a one-to-one lease on a server
process. And on the client side it is *stateful* and *not thread-safe*: it
carries autocommit mode, isolation level, the current transaction, search path,
and session settings, all of which the next user of that connection inherits.
Both halves of that sentence cause production bugs, and they are different bugs.**

## What "expensive" is made of

| Phase | What happens | Rough character |
|---|---|---|
| TCP | three-way handshake | one network round trip |
| TLS | handshake, certificate verification | several round trips plus asymmetric crypto |
| Startup | protocol negotiation, `options` parameters applied | one round trip |
| Authentication | SCRAM-SHA-256 by default | **multiple** round trips by design |
| Backend | PostgreSQL **forks a process**, allocates its memory, warms catalogue caches | server-side CPU and memory, not network |
| Session setup | any `SET` your framework issues, search path, timezone | more round trips |

⛔ I am deliberately not printing a millisecond figure. There is no database on
this machine to measure one on, and any number I quoted would be invented. What
matters is the *shape*: this is many round trips plus a process fork, against a
query that is typically one round trip. On a LAN the connection costs one to two
orders of magnitude more than the query it is being opened for; across an
availability zone, more.

🔴 **The process fork is the fact that distinguishes PostgreSQL.** MySQL uses a
thread per connection; PostgreSQL uses a process. That is why `max_connections`
is small by default, why raising it is not free — each backend has its own
`work_mem` allowance and its own share of the shared-memory structures sized at
startup — and why the correct pool size for PostgreSQL is much smaller than
people's intuition says. **Topic 02 — Connection pooling with HikariCP** *(not
written yet)* owns the sizing argument; this chunk owns the reason the argument
exists.

⚠️ **PostgreSQL 18 also has a built-in connection-pooling story in the ecosystem
rather than in the server** — PgBouncer and pgpool sit in front of it precisely
because the server-side cost per connection is real. If your architecture has
hundreds of application instances, an external pooler in transaction mode is a
legitimate part of the answer, with the caveat that transaction-mode pooling
breaks session-level features including server-side prepared statements
([chunk 7](09-server-side-prepared-statements.md)) and session-scoped `SET`.

## The client-side object: stateful and not thread-safe

pgJDBC's own documentation is direct about this: **"The PostgreSQL® JDBC driver
is not thread safe."** Its reasoning is that the server is not threaded — each
connection is a separate server process — so **"any concurrent requests to the
process would have to be serialized"**, and it adds that **"The driver makes no
guarantees that methods on connections are synchronized. It will be up to the
caller to synchronize calls to the driver."**

Read that as the rule it is: **one connection, one thread, for the duration of
the work.** Not "one thread at a time" — one thread, for the whole unit of work,
because the connection carries a transaction and a transaction cannot be handed
between threads mid-flight.

The state a `Connection` carries:

| State | Set by | Survives until |
|---|---|---|
| autocommit mode | `setAutoCommit` | changed, or the connection closes |
| transaction isolation | `setTransactionIsolation` | changed |
| read-only flag | `setReadOnly` | changed |
| **an open transaction** | the first statement after `setAutoCommit(false)` | `commit()` or `rollback()` |
| session settings | `SET search_path`, `SET TIME ZONE`, `SET LOCAL` | the session or transaction ends |
| temporary tables, prepared statements, advisory locks, `LISTEN` registrations | SQL | the session ends |
| the current `Statement`'s open `ResultSet` | `executeQuery` | the statement is closed or re-executed |

🔴 **In a pooled application every one of those rows is a leak surface.** You
borrow a connection, change something, close it — and the *next* borrower gets
your setting. The catastrophic instance of this is an open transaction, which is
serious enough to be **Topic 03's** subject:
**returning a connection mid-transaction** *(not written yet)*.
The quieter instances are just as real: a `SET search_path` that survives, a
`setReadOnly(true)` never reset, an isolation level raised for one query and
inherited by everything after it.

```java
// ❌ this changes the connection for whoever borrows it next
try (Connection c = ds.getConnection()) {
    c.setTransactionIsolation(Connection.TRANSACTION_SERIALIZABLE);
    doOneSensitiveThing(c);
}   // returned to the pool, still SERIALIZABLE

// ✅ restore what you changed, in a finally
try (Connection c = ds.getConnection()) {
    int previous = c.getTransactionIsolation();
    try {
        c.setTransactionIsolation(Connection.TRANSACTION_SERIALIZABLE);
        doOneSensitiveThing(c);
    } finally {
        c.setTransactionIsolation(previous);
    }
}
```

⚠️ A good pool mitigates some of this — HikariCP applies its configured
`autoCommit`, `transactionIsolation` and `readOnly` to connections it hands out —
but "the pool probably resets it" is not a property you should be relying on for
correctness. Reset what you change.

## What sharing a connection across threads actually looks like

It does not throw a helpful exception. Two threads issuing statements on one
pgJDBC connection interleave protocol messages on a single socket, and the
failure modes are:

- a `ResultSet` that returns another thread's rows, or ends early;
- `SQLException` with a protocol-level message about an unexpected message type,
  which reads like a driver bug and is not;
- a connection permanently poisoned so every subsequent statement fails;
- one thread's `commit()` committing the other thread's uncommitted work.

That last one is the reason this is a correctness issue and not a performance
issue. **Never store a `Connection` in a field, a static, or a `ThreadLocal` you
manage yourself.** Get it, use it, close it, in one method or one clearly-scoped
unit of work.

⚠️ **`Statement` and `ResultSet` inherit the restriction** — they belong to their
connection and are no more shareable than it is. One `Statement` also holds at
most one open `ResultSet` at a time: re-executing it silently closes the previous
one, which is a trap when a loop reuses a statement while still reading rows.

## The one legitimate cross-thread call

`Statement.cancel()` is the deliberate exception. Its javadoc says the method
**"can be used by one thread to cancel a statement that is being executed by
another thread"** — and pgJDBC implements it by opening a *separate* connection
to send PostgreSQL's cancel request, which is why `cancelSignalTimeout` exists as
a connection property. That is the shape of a safe cross-thread interaction: not
sharing the connection, but signalling out of band.
[Chunk 22](22-timeouts-cancellation-metadata.md) covers it.

## The trade-off

Treating a connection as expensive pushes you toward holding it for as short a
time as possible — which is right — but taken too far it produces the opposite
bug: a unit of work split across three borrowings, so that what should have been
one transaction is three, and a failure halfway leaves the database in a state no
single rollback can fix. **The correct scope is the transaction, not the
statement.** Borrow once for the unit of work, do everything, commit, release.
Holding it *longer* than that — across an HTTP call to a payment provider, across
user think-time — is the other failure, and in PostgreSQL an idle-in-transaction
connection is a genuine operational incident
([Topic 03 — long transactions](../03-jdbc-transactions/README.md)).

## Gotchas

**⚠️ A `Connection` held in a field or a singleton**
**Symptom:** works in development with one user, produces impossible `ResultSet`
contents and protocol errors under concurrency.
**Cause:** two threads on one connection, which the driver explicitly does not
support.
**Fix:** connections are method-scoped. If a class needs database access, it
holds a `DataSource`, never a `Connection`.

**⚠️ Session state left behind on a pooled connection**
**Symptom:** a query behaves differently depending on which request ran before
it — a different search path, an unexpected isolation level, a read-only failure
on a write.
**Cause:** something set session state and did not restore it.
**Fix:** restore in a `finally`, or prefer `SET LOCAL` inside a transaction so
the setting dies at commit.

**⚠️ Opening a connection per statement inside a loop**
**Symptom:** a batch job whose runtime is dominated by connection setup, and a
`too_many_connections` failure that takes the whole database down with it.
**Cause:** the borrow was scoped to the statement instead of the job.
**Fix:** one connection for the loop; and if the loop writes,
[batch it](19-batch-updates.md).

**⚠️ Reusing one `Statement` while its `ResultSet` is still being read**
**Symptom:** a `ResultSet` that closes underneath you, with an exception about a
closed result set that points at code that never closed anything.
**Cause:** a `Statement` supports one open `ResultSet`; re-executing it closes
the previous.
**Fix:** a separate `Statement` per concurrent result, or read one fully before
starting the next.

**⚠️ Sizing the pool by "number of application threads"**
**Symptom:** hundreds of PostgreSQL backends, memory pressure on the database,
and worse throughput than a much smaller pool.
**Cause:** each connection is a server process; more of them past the point of
CPU and disk saturation makes the database slower, not faster.
**Fix:** size for the database's capacity, not the application's thread count —
[Topic 02 — Connection pooling with HikariCP](../02-connection-pooling/README.md).

## Interview questions

**★ Why is a PostgreSQL connection expensive, specifically?**
Because it is not just a socket. Opening one costs a TCP handshake, usually a TLS
handshake, a multi-round-trip SCRAM authentication exchange, and then — the part
specific to PostgreSQL — the server forks a new backend *process* dedicated to
that connection, allocates its private memory and warms its catalogue caches. That
process exists for the life of the connection. So the cost is not only latency at
open time; it is a per-connection resident cost on the database server, which is
why `max_connections` is conservative, why raising it has memory consequences, and
why the right pool size for PostgreSQL is usually far smaller than people expect.

**★ Is `java.sql.Connection` thread-safe?**
No, and pgJDBC says so explicitly — the driver documentation states the driver is
not thread safe and that the caller must synchronize calls. But synchronizing is
the wrong conclusion: a connection carries an open transaction, so the correct
rule is one connection per thread for the whole unit of work, not one thread at a
time. Sharing one across threads does not produce a clean exception; it produces
interleaved protocol messages, result sets containing another thread's rows,
protocol-level errors that look like driver bugs, and — worst — one thread's
`commit()` committing another thread's uncommitted work. Practically: never put a
`Connection` in a field or a static. Hold a `DataSource` instead.

**★ What state does a `Connection` carry, and why does that matter in a pooled
application?**
Autocommit mode, transaction isolation, the read-only flag, an open transaction if
one is in flight, session settings like `search_path` and timezone, temporary
tables, session-level prepared statements, advisory locks and `LISTEN`
registrations. It matters because in a pool `close()` does not destroy any of
that — it hands the same physical session to the next borrower. So a request that
raises the isolation level, or sets a search path, or leaves a transaction open,
changes the behaviour of an unrelated request later. The discipline is to restore
whatever you change in a `finally`, and to prefer `SET LOCAL` for anything
transaction-scoped so it is undone at commit automatically.

**★ Why can't you hand a connection between threads mid-transaction?**
Because the transaction is server-side state attached to that one backend process,
and the client-side driver keeps its own protocol state in step with it. There is
no handoff protocol: the second thread cannot know what the first had sent but not
yet read, and the two threads' messages interleave on one socket. Even if it
worked mechanically, it would break the thing a transaction is for — one thread
could commit work another thread was still deciding about. The only sanctioned
cross-thread interaction is `Statement.cancel()`, which the javadoc explicitly
allows and which pgJDBC implements by opening a *separate* connection to send a
cancel request, rather than by touching the busy one.

**★ How long should you hold a connection?**
For exactly the unit of work that has to be atomic, and no longer. Shorter is a
bug: splitting one logical operation across three borrowings turns one transaction
into three, and a failure in the middle leaves state that no single rollback
repairs. Longer is also a bug, and in PostgreSQL a particularly expensive one — a
connection sitting idle inside an open transaction holds its snapshot, which
prevents vacuum from reclaiming dead tuples and causes table bloat, and holds any
locks it took. Never hold one across a call to an external service or across user
think-time. The rule that covers both failure modes: the borrow scope is the
transaction scope.

---

← Prev: [3 · The JDBC URL](03-the-jdbc-url.md) · Index: [JDBC](README.md) · Next → [5 · `PreparedStatement` and injection](05-preparedstatement-and-injection.md)
