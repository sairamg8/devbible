---
title: "On PostgreSQL a failed statement poisons the whole transaction — so the loop that catches and carries on usually cannot carry on"
sidebar_label: "14c · What the database did"
sidebar_position: 42
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the PostgreSQL 18 manual *Error Codes*
> ([postgresql.org/docs/18/errcodes-appendix.html](https://www.postgresql.org/docs/18/errcodes-appendix.html)),
> *libpq — Connection Status Functions*
> ([postgresql.org/docs/18/libpq-status.html](https://www.postgresql.org/docs/18/libpq-status.html))
> and *ROLLBACK TO SAVEPOINT*
> ([postgresql.org/docs/18/sql-rollback-to.html](https://www.postgresql.org/docs/18/sql-rollback-to.html)),
> the Jakarta Persistence 3.2 `FlushModeType` javadoc
> ([jakarta.ee/specifications/persistence/3.2/apidocs](https://jakarta.ee/specifications/persistence/3.2/apidocs/jakarta.persistence/jakarta/persistence/flushmodetype))
> and the Spring Data JPA `JpaRepository` javadoc
> ([docs.spring.io/spring-data/jpa/docs/current/api/org/springframework/data/jpa/repository/JpaRepository.html](https://docs.spring.io/spring-data/jpa/docs/current/api/org/springframework/data/jpa/repository/JpaRepository.html)).
> JDK 25, Spring Framework 7.0.9, Hibernate ORM 7.4.1, PostgreSQL 18.

**[Chunk 14](14-the-caught-exception.md) argued from Spring's side: catch the
exception and the interceptor sees a normal return, so it commits. That is true,
and on PostgreSQL it is only half the story — because the *database* also
reacted to the failure, and its reaction is more drastic than Spring's. A server
error puts the connection in a **failed transaction block**, and every statement
after it is rejected until the transaction ends. So the swallow-and-continue loop
often does not quietly commit half a batch; it fails again on every remaining row
and then fails at the commit. Knowing which of the two outcomes you get is the
difference between a confusing bug and an understood one.**

## What the server does when a statement fails

PostgreSQL has three in-transaction states, and libpq names them:

> *"The status can be `PQTRANS_IDLE` (currently idle), `PQTRANS_ACTIVE` (a command
> is in progress), `PQTRANS_INTRANS` (idle, in a valid transaction block), or
> `PQTRANS_INERROR` (idle, in a failed transaction block)."*

A statement that raises an error moves the session from `PQTRANS_INTRANS` to
`PQTRANS_INERROR`, and there is no path back except ending the transaction. Every
subsequent command in that block is refused with a specific SQLSTATE, listed in
the error-code appendix under *Class 25 — Invalid Transaction State*:

| SQLSTATE | Condition name |
|---|---|
| `25P02` | `in_failed_sql_transaction` |

**So the transaction is not merely doomed; it is inert.** Reads fail too. The
`COMMIT` you eventually send is treated as a rollback.

🔴 **This is a different failure from Spring's.** Spring's interceptor would have
happily committed. PostgreSQL refuses to let it. The two mechanisms are
independent, they are both true, and only one of them is on your side.

## Which outcome you actually get

The loop from [chunk 14](14-the-caught-exception.md) has two completely different
behaviours depending on where the failure came from:

| The failure was | The transaction is | The loop | The commit |
|---|---|---|---|
| a **server** error — constraint violation, type error, deadlock | aborted, `PQTRANS_INERROR` | every later row fails with `25P02` | refused |
| a **client** error — a Java exception, a validation check, a mapping failure before any statement was sent | untouched, `PQTRANS_INTRANS` | carries on normally | **succeeds, committing partial work** |

Both are bad and they are bad in opposite ways. The first is loud, confusing and
harmless to your data. The second is silent and is the one that corrupts.

⚠️ **Do not read the loud case as "the framework protected me".** Nothing was
designed to protect you; you got a database that refuses to continue after an
error, and a different database — or a client-side failure on the same database —
gives you the silent case with the same code.

## The one escape, and why `NESTED` exists

There is exactly one documented way to leave `PQTRANS_INERROR` without ending the
transaction, and it is the savepoint. From the `ROLLBACK TO SAVEPOINT` reference:

> *"Roll back all commands that were executed after the savepoint was established
> and then start a new subtransaction at the same transaction level. The savepoint
> remains valid and can be rolled back to again later, if needed."*

and, in its notes on aborted transactions, the reference speaks of a transaction
that can be *"restored using `ROLLBACK TO SAVEPOINT`"*.

That is the whole mechanism behind
[`NESTED` propagation](11-nested-and-savepoints.md). Spring takes a `SAVEPOINT`
on entry to the inner scope, and if the inner scope fails it issues
`ROLLBACK TO SAVEPOINT`, which both undoes the bad row's statements *and* takes
the connection out of the failed state so the loop can continue.

🔴 **So "skip the bad row and keep going inside one transaction" is not a
`try`/`catch` feature. It is a savepoint feature.** A `catch` alone cannot do it
on PostgreSQL, because the `catch` has no way to tell the server the failed
statement is forgotten.

## Why JPA hides the moment of failure

There is a second reason the `catch` in a JPA loop does not catch what its author
thinks. `repository.save(...)` does not necessarily send anything to the database.
The `EntityManager` batches work and flushes it later: the Jakarta Persistence
default flush mode is `AUTO`, documented as

> *"(Default) Flushing to occur at query execution."*

with `COMMIT` meaning *"flushing to occur at transaction commit"*. Spring Data
offers `saveAndFlush`, *"saves an entity and flushes changes instantly"*, and
`flush()`, *"flushes all pending changes to the database"* — the existence of
those two methods is the clue that `save` does neither.

So in this loop:

```java
for (Row row : rows) {
    try {
        productRepository.save(Product.from(row));   // may send nothing yet
    } catch (DataAccessException ex) {
        log.warn("skipping {}", row.id());           // may never run
    }
}
```

a constraint violation on row 3 does not necessarily throw at row 3. It throws
whenever the flush happens — at the next query, or at commit, which is *after*
the loop and outside every `catch` in it. The `try`/`catch` that was written to
skip a bad row can end up catching nothing at all, and the whole batch fails from
a line that does not mention row 3.

## The trade-off

Knowing the database's half of this buys accuracy: you can predict which of the
two failure shapes a given piece of code will produce, and you stop being
surprised that "the same bug" behaves differently in two places. **What it costs
is the comfortable rule of thumb.** "Catching swallows the failure and commits
partial work" is memorable and is what [chunk 14](14-the-caught-exception.md)
teaches; the accurate version is "catching removes Spring's reason to roll back,
and whether anything is left to commit depends on whether the database aborted
the transaction and on when your persistence provider flushed". The rule of thumb
is still the right thing to design against, because the silent outcome is the one
that does damage — but it is worth knowing it is a simplification.

## Gotchas

**⚠️ Concluding from a `25P02` storm that the code is fine**
**Symptom:** a batch job fails noisily, somebody notes that nothing was committed,
and the `try`/`catch` stays.
**Cause:** the loud behaviour came from PostgreSQL aborting the transaction, not
from the code being correct.
**Fix:** the same code with a client-side failure, or on a database that does not
abort the block, commits partial work silently. Fix the `catch`, not the symptom.

**⚠️ Retrying a statement inside an aborted transaction**
**Symptom:** every retry fails identically and instantly.
**Cause:** the session is in a failed transaction block; commands are refused with
`in_failed_sql_transaction` regardless of what they are.
**Fix:** retry around the boundary, or take a savepoint before the risky statement
so there is something to roll back to.

**⚠️ Expecting a read to work after a failed write**
**Symptom:** a `SELECT` written to diagnose the failure fails too, with a
different and unrelated-looking error.
**Cause:** `25P02` applies to every command in the block, not only writes.
**Fix:** do the diagnostic read in a different transaction.

**⚠️ Wrapping `save` in `try`/`catch` and assuming the statement was sent**
**Symptom:** the `catch` block never executes, and the failure appears at the end
of the method.
**Cause:** flush mode `AUTO` — "flushing to occur at query execution" — so nothing
was sent when `save` returned.
**Fix:** if you genuinely need per-row failure at the row, `saveAndFlush` or an
explicit `flush()` makes the statement happen where you can catch it. Note that
this also removes the batching benefit.

**⚠️ Treating flush-time failures as if they had a stack trace pointing at the
cause**
**Symptom:** an exception from a commit or a query that names none of the code
that created the bad state.
**Cause:** the failing statement was queued much earlier by an entity operation
somewhere else in the method.
**Fix:** flush closer to the operation while diagnosing, then put it back.

**⚠️ Assuming this is PostgreSQL-specific in a way that makes it safe elsewhere**
**Symptom:** a design that relies on "the transaction will abort anyway".
**Cause:** the abort-on-error behaviour is the server's policy, and the loud
outcome it produces is not a guarantee your code is asking for.
**Fix:** never depend on it. Design so the `catch` is correct on its own terms —
the three shapes in [14b](14b-three-honest-options.md).

## Interview questions

**★ On PostgreSQL, what happens to a transaction after one of its statements
raises an error?**
It enters a failed transaction block and stops accepting work. libpq exposes that
state directly — `PQTRANS_INERROR`, documented as "idle, in a failed transaction
block", as distinct from `PQTRANS_INTRANS`, "idle, in a valid transaction block".
Every subsequent command in that transaction is refused with SQLSTATE `25P02`,
which the error-code appendix names `in_failed_sql_transaction` under *Class 25 —
Invalid Transaction State*, and that includes reads. The eventual `COMMIT` is
treated as a rollback. The only way out without ending the transaction is
`ROLLBACK TO SAVEPOINT`, which the reference describes as rolling back everything
after the savepoint and starting "a new subtransaction at the same transaction
level".

**★ Then does the classic "catch and continue" bug actually commit partial data
on PostgreSQL?**
Sometimes, and which time you get depends on where the failure came from. If it
was a server error — a constraint violation, a type error, a deadlock — the
transaction is already aborted, so the rest of the loop fails with `25P02` and the
commit is refused; the outcome is noisy and your data is intact. If the failure
was client-side — a Java exception, a validation check, a mapping problem, a
`null` before any statement was sent — the database never saw an error, the
transaction is perfectly healthy, and Spring's interceptor commits everything the
loop managed to write. That second case is the corrupting one, it is entirely
possible with the same code, and nothing in the code distinguishes them. So the
advice from [14](14-the-caught-exception.md) does not change; the reasoning behind
it just gets more precise.

**★ Why can `NESTED` skip a bad row when a `try`/`catch` cannot?**
Because skipping requires telling the *database* to forget the failed statement,
and only a savepoint can do that. A `catch` is a Java construct; it has no effect
on the session's transaction state, which after a server error is
`PQTRANS_INERROR` and refuses everything. `NESTED` issues a `SAVEPOINT` before the
inner scope and a `ROLLBACK TO SAVEPOINT` when it fails, which the PostgreSQL
reference defines as rolling back "all commands that were executed after the
savepoint was established" and then starting "a new subtransaction at the same
transaction level" — a valid state again, on the same physical transaction. That
is the mechanical reason [`NESTED`](11-nested-and-savepoints.md) exists at all,
and it is a better answer than "it does partial rollback" because it explains why
partial rollback needs framework support rather than a `catch`.

**★ A `try`/`catch` around `repository.save(...)` never fires, and the batch
fails at the end. Why?**
Because `save` did not send the statement. The Jakarta Persistence default flush
mode is `AUTO` — "flushing to occur at query execution" — so the persistence
provider queues the insert and issues it at the next query or at commit, whichever
comes first, and both of those are outside the loop's `catch`. Spring Data's own
API is the tell: `saveAndFlush` exists and is documented as "saves an entity and
flushes changes instantly", and a bare `flush()` exists to "flush all pending
changes to the database" — neither method would be needed if `save` already did
it. The practical consequence is that per-row error handling in a JPA loop
requires an explicit flush per row, which also gives up statement batching; if you
want per-row failure semantics, per-row *transactions* are usually the better
design ([14b](14b-three-honest-options.md)).

**★ A colleague says a failed transaction "cleans itself up" so the bug does not
matter. What is wrong with that?**
Three things. It is server policy, not an application guarantee — the code did not
ask for it and nothing in the code documents the dependency. It only covers
server-side failures, so the same method with a client-side failure commits
partial work with no signal. And it is the wrong kind of evidence: the loud
outcome hides the fact that the `catch` is still wrong, so the bug survives review
and fires later under different conditions. The correct response to a `25P02`
storm is to fix the exception handling, not to note that the data was fine this
time.

**★ You need per-row diagnostics from a failed batch. How do you get them without
the partial-commit bug?**
Give each row its own transaction and collect the failures in a returned report —
shape A in [14b](14b-three-honest-options.md): a non-transactional outer loop
calling a transactional per-row method on another bean, with the `catch` outside
every boundary. Each row's failure aborts only its own transaction, which is then
ended, so the next row starts from a clean session and there is no `25P02` at all.
If the rows genuinely must all commit together, the alternative is `NESTED` per
row inside one transaction, which uses savepoints to keep the physical transaction
usable after each failure — same diagnostics, one connection, and everything is
still atomic at the end.

---

← Prev: [14b2 · Its own transaction](14b2-its-own-transaction.md) · Index: [04 · Spring @Transactional](README.md) · Next → [15 · Read-only](15-read-only.md)
