---
title: "Suspending a transaction is a thread-binding operation and nothing else — the database is never told, and every lock the outer transaction took it keeps holding"
sidebar_label: "10c · What suspension costs"
sidebar_position: 28
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Spring Framework 7.0 reference *Transaction
> propagation*
> ([docs.spring.io/spring-framework/reference/data-access/transaction/declarative/tx-propagation.html](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/tx-propagation.html)),
> the `AbstractPlatformTransactionManager` javadoc
> ([docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/support/AbstractPlatformTransactionManager.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/support/AbstractPlatformTransactionManager.html)),
> the `DataSourceTransactionManager` and `JpaTransactionManager` sources
> ([github.com/spring-projects/spring-framework](https://github.com/spring-projects/spring-framework/blob/main/spring-jdbc/src/main/java/org/springframework/jdbc/datasource/DataSourceTransactionManager.java))
> and the PostgreSQL 18 manual *Client Connection Defaults*
> ([postgresql.org/docs/18/runtime-config-client.html](https://www.postgresql.org/docs/18/runtime-config-client.html))
> and *Routine Vacuuming*
> ([postgresql.org/docs/18/routine-vacuuming.html](https://www.postgresql.org/docs/18/routine-vacuuming.html)).
> JDK 25, Spring Boot 4.1.0, Spring Framework 7.0.8, PostgreSQL 18.

**"Suspend" sounds like something that happens to the transaction. It is not. It
is something that happens to the *thread*: Spring unbinds a resource holder from
a thread-local map and puts it in a box. No statement is sent to the database, so
the database has no idea anything happened — the outer transaction is still open,
still holds every lock it took, still holds its snapshot, and now sits idle inside
a transaction for however long the inner one runs. Every cost in
[chunk 10](10-requires-new.md) follows from that one fact, and so do three more
the pool arithmetic does not cover.**

## What `doSuspend` actually does

Both of the transaction managers you are likely to have do the same small thing.
`DataSourceTransactionManager`:

```java
protected Object doSuspend(Object transaction) {
    DataSourceTransactionObject txObject = (DataSourceTransactionObject) transaction;
    txObject.setConnectionHolder(null);
    return TransactionSynchronizationManager.unbindResource(obtainDataSource());
}

protected void doResume(@Nullable Object transaction, Object suspendedResources) {
    TransactionSynchronizationManager.bindResource(obtainDataSource(), suspendedResources);
}
```

`JpaTransactionManager` does the same for two resources instead of one — the
`EntityManagerHolder` keyed by the `EntityManagerFactory`, plus the
`ConnectionHolder` keyed by the `DataSource` if one is bound — and returns both in
a `SuspendedResourcesHolder`.

The base class wraps that in the ordering the javadoc describes: `suspend`
"suspends transaction synchronization first, then delegates to the `doSuspend`
template method", and `resume` "delegates to the `doResume` template method first,
then resuming transaction synchronization".

**Read the code for what is absent.** There is no `SET`, no `SAVEPOINT`, no
`COMMIT`, no `close()`, no return of the connection to the pool. The entire
operation is: take the object out of one thread-local map, hand it back later. The
`Connection` is exactly where it was, with exactly the transaction it had.

## What the server sees

Nothing. From PostgreSQL's side there is a session that issued `BEGIN`, ran some
statements, and then went quiet. That state has a name in `pg_stat_activity` —
*idle in transaction* — and it is indistinguishable from a client that walked away
mid-transaction, because mechanically it is the same thing.

So the outer transaction keeps:

| Held | Until |
|---|---|
| every row and table lock it acquired | the outer commit or rollback |
| its MVCC snapshot, and therefore its `xmin` | the outer commit or rollback |
| its transaction id, if it has written | the outer commit or rollback |
| the connection, checked out of the pool | the outer commit or rollback |

None of that is released early, and none of it is negotiable, because releasing
any of it would mean ending the transaction.

## The three costs the pool arithmetic does not cover

**Locks are held across the inner transaction's entire lifetime.** This is what
makes the single-thread self-deadlock in [chunk 10](10-requires-new.md) possible:
the inner transaction, on its own connection and in its own session, asks for a
lock the suspended outer transaction holds, and neither can move. A larger pool
does not help, because the pool was never the constraint.

**Vacuum cannot clean up behind it.** PostgreSQL's own words, in the description
of `idle_in_transaction_session_timeout`:

> *"Even when no significant locks are held, an open transaction prevents
> vacuuming away recently-dead tuples that may be visible only to this
> transaction; so remaining idle for a long time can contribute to table bloat."*

And the vacuuming chapter's first remedy for bloat is *"end long-running open
transactions"*, found by looking for a large `age(backend_xmin)` in
`pg_stat_activity`. A `REQUIRES_NEW` call is a deliberate, code-scheduled way of
making a transaction stay open longer than it needs to.

**The server may kill the outer session out from under you.**
`idle_in_transaction_session_timeout` will *"terminate any session that has been
idle (that is, waiting for a client query) within an open transaction for longer
than the specified amount of time"*. Its default is `0`, which disables it — but
it is one of the first settings a DBA turns on, precisely to stop sessions holding
locks while idle. Turn it on, and a slow inner transaction becomes a killed outer
connection. `transaction_timeout`, also `0` by default, has the same effect from
the other direction: it *"terminates any session that spans longer than the
specified amount of time in a transaction"*, and the suspended outer transaction's
clock never stopped.

⚠️ **The failure looks like a driver bug and is not.** The outer method resumes,
issues its next statement, and gets a connection error, because the server ended
the session while Spring was looking the other way. Nothing in the Java code is
wrong; the arrangement simply asked a transaction to stay open longer than the
server was configured to tolerate.

## Which propagations suspend

Two of them, and it is worth knowing which, because the costs above apply to both:

- **`REQUIRES_NEW`** — suspends the current transaction and begins a new one. The
  reference: *"the resources attached to the outer transaction will remain bound
  there while the inner transaction acquires its own resources such as a new
  database connection."*
- **`NOT_SUPPORTED`** — suspends the current transaction and runs with none. There
  is no second connection *for the transaction*, but the outer one is still held,
  and the unmanaged work still needs a connection from somewhere. See
  [12b · SUPPORTS and NOT_SUPPORTED](12b-supports-and-not-supported.md).

`REQUIRED`, `SUPPORTS`, `MANDATORY` and `NESTED` never suspend anything —
`NESTED` deliberately so, which is the whole reason it costs one connection
instead of two ([11 · NESTED and savepoints](11-nested-and-savepoints.md)).

🔴 **Not every transaction manager can suspend at all.** The `Propagation` javadoc
warns that *"actual transaction suspension will not work out-of-the-box on all
transaction managers. This in particular applies to `JtaTransactionManager`, which
requires the `jakarta.transaction.TransactionManager` to be made available to it
(which is server-specific in standard Jakarta EE)."* In a JTA environment, confirm
suspension support before writing code that depends on it.

## The trade-off

Suspension is cheap in the only sense that a benchmark would measure: it is two
hash-map operations and no network traffic. It is expensive in every sense that
matters operationally, because *not* talking to the database is exactly what makes
the outer transaction's footprint persist. **A design that suspends is a design
that has chosen to hold locks, a snapshot and a connection for the duration of
work that is not part of that transaction at all.** That is sometimes worth it —
the audit row in [chunk 10b](10b-when-requires-new-is-right.md) — and it is never
free, and the bill arrives at the database rather than in the profiler.

## Gotchas

**⚠️ Reading "suspend" as "pause and release"**
**Symptom:** a pool sized as though only one connection per thread were needed,
and surprise when it is not.
**Cause:** the word suggests the transaction stops consuming resources. It does
the opposite: it stops making progress while keeping everything.
**Fix:** read `doSuspend` once. Two lines, and neither of them touches the
connection's transaction.

**⚠️ Assuming the outer transaction's timeout stops while suspended**
**Symptom:** a `TransactionTimedOutException` on the outer transaction whose own
work took less than the timeout.
**Cause:** the deadline is wall-clock from the outer begin. Time spent inside a
suspended-and-resumed window still counts, on both Spring's side and the server's.
**Fix:** budget the outer timeout for the whole method including the inner call —
see [17b · What actually bounds it](17b-what-actually-bounds-it.md).

**⚠️ Long or slow work inside the inner transaction**
**Symptom:** lock waits and bloat that correlate with a feature nobody thinks of
as long-running.
**Cause:** the outer transaction's hold time is the inner transaction's duration
plus its own, and a remote call inside the inner method extends both.
**Fix:** keep suspended windows to a single short statement. Never make a network
call to a third party inside one.

**⚠️ `idle_in_transaction_session_timeout` set for good reasons, then blamed**
**Symptom:** connections dropped in production and not in staging, where the
setting is `0`.
**Cause:** the setting is doing exactly its job; the application is holding an
idle open transaction because it asked for one.
**Fix:** shorten the suspended window rather than raising the timeout. Raising it
re-creates the bloat problem the DBA turned it on to prevent.

**⚠️ Expecting `pg_stat_activity` to explain it**
**Symptom:** an investigation that finds "idle in transaction" sessions and
concludes the application is leaking connections.
**Cause:** a suspended outer transaction is genuinely idle in a transaction. It is
not a leak, and it is not a bug in the pool.
**Fix:** correlate with the code path. A leak shows sessions that never end; a
suspension shows them ending when the outer method does.

**⚠️ Suspending inside a loop**
**Symptom:** a batch job whose lock footprint grows with the batch size for no
apparent reason.
**Cause:** each iteration suspends and resumes the same outer transaction, which
has been open — and accumulating locks — since the first row.
**Fix:** the loop, not the annotation, is the problem. See
[10b · When REQUIRES_NEW is right](10b-when-requires-new-is-right.md).

## Interview questions

**★ What does Spring do when it "suspends" a transaction?**
It unbinds the transaction's resources from the current thread and stores them.
Concretely, `DataSourceTransactionManager.doSuspend` clears the connection holder
on the transaction object and calls
`TransactionSynchronizationManager.unbindResource(obtainDataSource())`, returning
the holder it removed; `doResume` binds that same holder back. `JpaTransactionManager`
does the same for the `EntityManagerHolder` and, if present, the `ConnectionHolder`,
returning both in a `SuspendedResourcesHolder`. The base class brackets this with
synchronization handling — `suspend` "suspends transaction synchronization first,
then delegates to the `doSuspend` template method", and `resume` reverses the
order. What is not in any of that code is a statement to the database, a commit,
or a return of the connection to the pool. Suspension is bookkeeping in a
thread-local map; the transaction on the wire is untouched.

**★ So what does the database think is happening during a `REQUIRES_NEW` call?**
That the client has gone quiet. The session issued `BEGIN` and some statements and
then stopped sending anything, which PostgreSQL reports in `pg_stat_activity` as
*idle in transaction* — the same state as a client that crashed mid-transaction or
a developer who left a `psql` session open. The transaction therefore keeps
everything an open transaction keeps: every row and table lock it acquired, its
MVCC snapshot and hence its `xmin`, its transaction id if it has written, and of
course the connection. Nothing is released early, because releasing any of it
would mean ending the transaction, which is precisely what suspension is trying
not to do.

**★ Name a cost of suspension that a bigger connection pool does not fix.**
Three, and none of them is about the pool. First, locks: the suspended outer
transaction holds them for the inner transaction's whole lifetime, which is what
makes a one-thread self-deadlock possible when the inner transaction asks for a
lock the outer one holds. Second, bloat: PostgreSQL's manual says that "even when
no significant locks are held, an open transaction prevents vacuuming away
recently-dead tuples that may be visible only to this transaction; so remaining
idle for a long time can contribute to table bloat", and the vacuuming chapter's
first remedy is to "end long-running open transactions". Third, timeouts: if the
operators have set `idle_in_transaction_session_timeout` — default `0`, disabled,
but commonly turned on — the server will "terminate any session that has been idle
within an open transaction for longer than the specified amount of time", and that
session is your outer transaction.

**★ An outer transactional method fails with a connection error right after an
inner `REQUIRES_NEW` call returns. Where do you look?**
At the server's idle and transaction timeouts before anything in Java. The
sequence is characteristic: the outer transaction was suspended, so its session
sat idle inside an open transaction for as long as the inner work took; if that
exceeded `idle_in_transaction_session_timeout`, or if total elapsed time exceeded
`transaction_timeout`, the server terminated the backend. The outer method then
resumed, issued its next statement onto a connection whose session no longer
exists, and got an error that reads like a driver or network fault. Nothing in the
application code is wrong in the ordinary sense — it simply asked a transaction to
stay open longer than the database was configured to tolerate. The fix is to
shorten the suspended window, not to raise the timeout, because the timeout is
there to prevent the bloat that the same behaviour causes.

**★ Which propagation levels suspend, and which deliberately do not?**
`REQUIRES_NEW` and `NOT_SUPPORTED` suspend. `REQUIRES_NEW` suspends in order to
begin an independent transaction on a second connection; `NOT_SUPPORTED` suspends
in order to run with no transaction at all. `REQUIRED`, `SUPPORTS` and `MANDATORY`
join whatever exists and never suspend, and `NESTED` deliberately does not —
it takes a savepoint on the *same* physical transaction and the same connection,
which is exactly why it costs one connection where `REQUIRES_NEW` costs two. When
somebody reaches for `REQUIRES_NEW` and the only requirement is partial rollback,
`NESTED` is usually the propagation that was actually wanted.

**★ Is suspension guaranteed to work?**
No, and the `Propagation` javadoc says so directly: "actual transaction suspension
will not work out-of-the-box on all transaction managers. This in particular
applies to `JtaTransactionManager`, which requires the
`jakarta.transaction.TransactionManager` to be made available to it (which is
server-specific in standard Jakarta EE)." With the local managers most
applications use — `DataSourceTransactionManager`, `JdbcTransactionManager`,
`JpaTransactionManager` — suspension is implemented and works, because it is only
a thread-local unbind. In a JTA environment, whether it works depends on what the
application server exposes, and that has to be established rather than assumed
before writing code whose correctness rests on it.

**★ Does the outer transaction's timeout keep running while it is suspended?**
Yes, on both sides, and this catches people out. Spring's deadline is set when the
outer transaction begins and is wall-clock; nothing pauses it while the thread is
busy with an inner transaction. The database's is worse, because
`transaction_timeout` "applies both to explicit transactions and to an implicitly
started transaction" and is measured from the transaction's start regardless of
whether the client is doing anything. So an outer method with a five-second
timeout, whose own statements take one second, will still time out if a
`REQUIRES_NEW` call in the middle takes five. The budget to reason about is the
whole outer method including everything it suspends for, not the sum of its own
queries.

---

← Prev: [10b · When REQUIRES_NEW is right](10b-when-requires-new-is-right.md) · Index: [04 · Spring @Transactional](README.md) · Next → [11 · NESTED and savepoints](11-nested-and-savepoints.md)
