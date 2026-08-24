---
title: "Row locks are unlimited, which is exactly why a big batch hurts — the cost is the length of the transaction, not the size of a lock table"
sidebar_label: "19g · Locks and long transactions"
sidebar_position: 19.6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JDK 25 API for `java.sql.Statement`
> ([docs.oracle.com/en/java/javase/25/docs/api/java.sql/](https://docs.oracle.com/en/java/javase/25/docs/api/java.sql/)),
> the PostgreSQL 18 manual §20.11 *Client Connection Defaults*
> ([postgresql.org/docs/18/runtime-config-client.html](https://www.postgresql.org/docs/18/runtime-config-client.html)),
> §20.12 *Lock Management*
> ([postgresql.org/docs/18/runtime-config-locks.html](https://www.postgresql.org/docs/18/runtime-config-locks.html)),
> Appendix A *Error Codes*
> ([postgresql.org/docs/18/errcodes-appendix.html](https://www.postgresql.org/docs/18/errcodes-appendix.html))
> and §13.2 *Transaction Isolation*
> ([postgresql.org/docs/18/transaction-iso.html](https://www.postgresql.org/docs/18/transaction-iso.html)),
> the pgJDBC *Connection Parameters* documentation
> ([jdbc.postgresql.org/documentation/use/](https://jdbc.postgresql.org/documentation/use/))
> and `PGProperty`, and the pgJDBC 42.7.x source for `PgStatement` and
> `QueryExecutorImpl`
> ([github.com/pgjdbc/pgjdbc](https://github.com/pgjdbc/pgjdbc)). JDK 25,
> JDBC 4.3, PostgreSQL 18, pgjdbc 42.7.13. No sandbox: no timings, no console
> output.

**Under an explicit transaction a batch holds every row lock it took until you
commit — ten thousand `UPDATE`s means ten thousand rows locked at once, where ten
thousand autocommit updates held one at a time. The instinct is to go looking for
a limit that is about to be exceeded, and there is none: PostgreSQL's manual says
flatly that the number of rows that can be locked "is unlimited", because row
locks live in tuple headers rather than in the shared lock table that
`max_locks_per_transaction` sizes. That is the point. Nothing fails, so nothing
warns you, and the cost is paid entirely in *duration* — other writers queued
behind those rows, cleanup of dead tuples held back for the life of the
transaction, and a deadlock window that grows with the batch and takes a full
second to be noticed. Every fix here is the same fix: shorter transactions,
consistent lock ordering, and a bounded chunk size.**


## A batch holds its locks for the length of the batch

Under an explicit transaction every row a batch touches stays locked until
`commit()`. That is ordinary transaction semantics, but batching changes the
magnitude: a batch of ten thousand `UPDATE`s holds ten thousand row locks
simultaneously, where ten thousand autocommit updates held one at a time.

Two things follow. **Lock-ordering deadlocks become reachable** between
concurrent batches touching an overlapping set of rows in different orders —
sorting each batch by primary key before executing it is the standard, cheap
defence. And **the batch is now a long transaction**, with everything that
implies for cleanup and for other writers queued behind those rows.

⚠️ **Row locks are not the thing `max_locks_per_transaction` limits**, and this
is worth stating because the parameter's name invites the mistake. The manual is
explicit: the shared lock table sizes "objects (e.g., tables) per server process",
and "this is *not* the number of rows that can be locked; that value is
unlimited." A million-row `UPDATE` batch does not exhaust the lock table. The
cost of holding a million row locks is paid in transaction duration and in what
other sessions have to wait for, not in a lock-table slot.

⚠️ **Deadlock detection is deliberately slow.** `deadlock_timeout` is "the amount
of time to wait on a lock before checking to see if there is a deadlock
condition", defaulting to one second, "because the check for deadlock is
relatively expensive". So two mutually-deadlocked batches sit still for a second
before either learns about it, and the loser gets `40P01`. The manual's advice —
"ideally the setting should exceed your typical transaction time" — is an
uncomfortable fit for long batch transactions, which is one more reason to keep
them short.

⚠️ **`lock_timeout` is the bound that fits lock contention**, because it "abort[s]
any statement that waits longer than the specified amount of time while attempting
to acquire a lock", and the limit "applies separately to each lock acquisition
attempt". Note the interaction the manual points out: "if `statement_timeout` is
nonzero, it is rather pointless to set `lock_timeout` to the same or larger value,
since the statement timeout would always trigger first."

⚠️ **Even an `INSERT`-only batch can block.** Inserting a row that would violate a
unique constraint makes the second transaction wait on the first one's
uncommitted tuple until it commits or rolls back — so two concurrent batches
loading overlapping natural keys serialise against each other even though neither
is updating anything. Sorting by key and keeping chunks small helps here for the
same reason it helps with deadlocks.

## `autosave` is the escape hatch for a poisoned transaction

When a batch fails inside a longer transaction you normally lose the whole
transaction, because of `25P02`. pgJDBC's `autosave` parameter changes that: its
documented behaviour is that "in `autosave=always` mode, JDBC driver sets a
savepoint before each query, and rolls back to that savepoint in case of
failure."

For a batch the granularity is coarser than "each query" and that is worth
knowing: `QueryExecutorImpl`'s batch path calls
`sendAutomaticSavepoint(queries[0], flags)` **once, before the loop**, not per
entry. So a failed batch inside a transaction leaves the outer transaction
usable, but the batch itself is still all-or-nothing.
`shouldCreateAutomaticSavepoint` also declines when no transaction is active, so
`autosave` does nothing at all under plain autocommit.

It costs an extra round of statement traffic per batch and it is not free at
scale — but it is the difference between a poisoned transaction and a retryable
one.


## Gotchas

**⚠️ Concurrent batches deadlocking on row order**
**Symptom:** `40P01` deadlock detections that only appear under load, on a code
path that has no explicit locking.
**Cause:** two transactions each holding thousands of row locks, acquired in
different orders.
**Fix:** sort each batch by primary key before executing, and chunk so no single
transaction holds locks for long.


**⚠️ Batching under `REPEATABLE READ` or `SERIALIZABLE` without a retry loop**
**Symptom:** long batches occasionally fail with `40001` and the job simply dies.
**Cause:** those levels abort a transaction rather than block it — "could not
serialize access due to concurrent update" or "due to read/write dependencies
among transactions" — and the manual is explicit that "applications using this
level must be prepared to retry transactions due to serialization failures", with
serialization failures always returning `SQLSTATE 40001`. A batch is a single
transaction with a large read/write set, so it is a larger target than the
individual statements it replaced, and the whole chunk is what has to be retried.
**Fix:** a generalised `40001` retry around the chunk — the manual recommends
exactly that, "a generalized way of handling serialization failures" — plus
smaller chunks so a retry is cheap.

**⚠️ Blaming the lock table for a huge `UPDATE` batch**
**Symptom:** an attempt to raise `max_locks_per_transaction` to make a
million-row batch work.
**Cause:** it sizes the *object* lock table; the manual says plainly that it "is
not the number of rows that can be locked; that value is unlimited."
**Fix:** the problem is transaction duration and contention, so the fix is
chunking, not a lock-table setting.


**⚠️ Expecting `autosave` to save the successful entries**
**Symptom:** `autosave=always` is switched on, the transaction survives, and the
batch still wrote nothing.
**Cause:** the driver takes one savepoint for the whole batch, before the loop —
not one per entry. The rollback target is the start of the batch.
**Fix:** `autosave` protects the *surrounding* transaction, not the batch's
partial work. If you need partial progress, use smaller committed chunks.

## Interview questions

**★ Does a big batch risk exhausting PostgreSQL's lock table?**
No, and the confusion is worth clearing up because it sends people to the wrong
setting. `max_locks_per_transaction` sizes the shared table of *object* locks —
tables, indexes, and similar — and the manual states directly that it "is not the
number of rows that can be locked; that value is unlimited", because row locks
are recorded in the tuple headers rather than in shared memory. What a
million-row batch actually costs is transaction duration: every one of those rows
is unavailable to other writers until commit, cleanup of dead tuples is held
back for the life of the transaction, and the deadlock window grows. The fix is
therefore always chunking, never a lock-table parameter.


**★ Two nightly jobs both batch-update the same table and occasionally deadlock.
What do you change?**
First, sort. A deadlock needs two transactions acquiring the same locks in
different orders, so ordering every batch by primary key before executing removes
the cycle at source — it is a one-line change and it is the real fix. Second,
chunk smaller and commit per chunk, which shortens the window in which any lock
is held and reduces the number of rows either job has locked at once. Third, set
`lock_timeout` on those connections so a blocked job fails fast and retryably
instead of waiting; note the manual's caveat that this is pointless if
`statement_timeout` is set to the same or a lower value, since that would fire
first. And expect a delay before the error: `deadlock_timeout` defaults to one
second, because "the check for deadlock is relatively expensive", so the pair
sits blocked for at least that long before one of them gets `40P01`.


**★ What are the operational risks of making batches bigger?**
Four, and they are independent. Lock duration: under a transaction, every row the
batch touches stays locked until commit, so a big batch is a long transaction
that blocks other writers and holds back cleanup. Deadlock surface: two
concurrent batches holding thousands of row locks in different orders will
eventually deadlock, which is why sorting each batch by key is standard practice.
Memory: the driver accumulates every entry's parameter list in a client-side
`ArrayList` until you call `executeBatch`, so the batch lives in your heap in
full. And blast radius: a failure at entry 9999 discards all ten thousand, so
retry cost scales with batch size. The usual answer to all four is the same — a
fixed chunk size in the low thousands, committed per chunk, with an idempotent
statement so a retry after a partial run is safe.


**★ What does `autosave=always` actually buy you around a batch?**
It stops a failed batch from poisoning a longer transaction. Without it, the
first error puts the session in `25P02` and every subsequent statement in that
transaction fails until rollback — so a batch in the middle of a larger unit of
work takes the whole unit with it. With `autosave=always`, pgJDBC issues a
`SAVEPOINT` beforehand and rolls back to it, leaving the outer transaction
usable. Two limits are worth stating in the same breath: for a batch the driver
takes one savepoint for the whole batch rather than one per entry, so it does not
preserve the batch's partial work; and it does nothing under plain autocommit,
because `shouldCreateAutomaticSavepoint` declines when no transaction is active.
It is also not free — it adds statement traffic to every query in the mode — so
it is a targeted fix, not a default.


---

**Continue:** [19h · When to use `COPY` instead](19h-copy-instead-of-batching.md)

---
<!--FOOTER-->
