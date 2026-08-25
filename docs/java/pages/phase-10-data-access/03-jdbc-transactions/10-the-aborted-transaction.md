---
title: "One failed statement poisons the whole transaction, and every statement after it reports a different error than the real one"
sidebar_label: "10 · The aborted transaction"
sidebar_position: 16
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the PostgreSQL 18 source for `src/backend/tcop/postgres.c`
> ([github.com/postgres/postgres, REL_18_STABLE](https://github.com/postgres/postgres/blob/REL_18_STABLE/src/backend/tcop/postgres.c)),
> Appendix A *Error Codes*
> ([postgresql.org/docs/18/errcodes-appendix.html](https://www.postgresql.org/docs/18/errcodes-appendix.html)),
> and the `ROLLBACK TO SAVEPOINT` reference page
> ([postgresql.org/docs/18/sql-rollback-to.html](https://www.postgresql.org/docs/18/sql-rollback-to.html)).
> JDK 25, JDBC 4.3, PostgreSQL 18, pgjdbc 42.7.13. No sandbox: no console
> output, no timings.

**This is the most confusing PostgreSQL error a Java developer meets, and the
reason it is confusing is that it *hides the real one*. When any statement in a
transaction fails, PostgreSQL puts the whole transaction into an aborted state, and
from that moment every further statement is rejected before it is even parsed with:**

```
current transaction is aborted, commands ignored until end of transaction block
```

**SQLSTATE `25P02`, `in_failed_sql_transaction`. So a `catch` block that logs a
failure and carries on turns one real error into a cascade of identical fake ones,
and whichever statement your logging happens to surface is almost certainly not the
one that broke. The only escape that does not throw away the transaction is a
savepoint.**

## What the server actually does

From `exec_simple_query` in PostgreSQL 18's `postgres.c`:

```c
/*
 * If we are in an aborted transaction, reject all commands except
 * COMMIT/ABORT.  It is important that this test occur before we try
 * to do parse analysis, rewrite, or planning, since all those phases
 * try to do database accesses, which may fail in abort state.
 */
if (IsAbortedTransactionBlockState() &&
    !IsTransactionExitStmt(parsetree->stmt))
    ereport(ERROR,
            (errcode(ERRCODE_IN_FAILED_SQL_TRANSACTION),
             errmsg("current transaction is aborted, "
                    "commands ignored until end of transaction block"),
             errdetail_abort()));
```

Three things to take from that, and each one explains a symptom.

**The check runs before parse analysis.** So the statement is not compiled, not
planned and not executed. A statement with a *syntax error* in an aborted
transaction reports `25P02`, not a syntax error — the server never got far enough
to notice. That is why "fixing" the query the log points at changes nothing.

**The comment says why.** Parse analysis, rewriting and planning all do database
access, and database access is not safe in abort state. This is not a policy
choice about strictness; it is that the machinery genuinely cannot run.

**The same block appears four times.** `exec_simple_query`, `exec_parse_message`,
`exec_bind_message`, `exec_execute_message` — so it fires whether you used a plain
`Statement` or a `PreparedStatement`, and at parse, bind or execute. There is no
protocol path around it.

## What is still allowed

`IsTransactionExitStmt` permits **`COMMIT`, `PREPARE`, `ROLLBACK` and
`ROLLBACK TO SAVEPOINT`**. Everything else is refused.

That short list is the whole design. An aborted transaction can only be *ended* —
or rewound to a savepoint, which is the exception this chunk is really about.

⚠️ Note that `COMMIT` is on the allowed list. That does **not** mean an aborted
transaction can commit its work; an aborted transaction has nothing to commit. It
means the server will accept the command as a way of ending the block rather than
adding a second, more confusing error on top of the first. *(I could not confirm
from the primary documentation what command tag the server reports in that case, so
this page does not claim one.)*

## What it looks like from Java

Here is the shape that produces the cascade, and it is written this way in real
codebases because it looks defensive:

```java
// ❌ this turns one real error into N fake ones
c.setAutoCommit(false);
for (Order order : orders) {
    try {
        insertOrder(c, order);          // order #3 violates a unique constraint (23505)
    } catch (SQLException e) {
        log.warn("skipping order {}", order.id(), e);   // logged once, correctly
    }
}
c.commit();
```

Order 3 fails with `23505`, `unique_violation` — the real problem, and it is
logged correctly. Then orders 4 through 500 each fail with `25P02`, and each is
logged as a warning too. Your log now contains one true line buried under 497
copies of *"current transaction is aborted"*, and the `commit()` at the end
succeeds in ending a transaction that saved nothing.

🔴 **The diagnostic rule that follows: when you see `25P02`, the error you are
looking at is never the error you need. Search backwards in the log for the first
statement that failed with something else.**

⚠️ It gets worse with connection pooling, because a transaction left aborted and
returned to the pool is a session in `idle in transaction (aborted)` state —
[chunk 13b](13b-the-four-clocks.md) — holding whatever it held.

## The savepoint escape hatch

Rolling back to a savepoint is on the permitted list, and it clears the aborted
state back to the point of the mark. That is the entire mechanism behind
"continue after a failure":

```java
// ✅ the failure is contained to one iteration
c.setAutoCommit(false);
for (Order order : orders) {
    Savepoint sp = c.setSavepoint();
    try {
        insertOrder(c, order);
        c.releaseSavepoint(sp);
    } catch (SQLException e) {
        c.rollback(sp);                 // ROLLBACK TO SAVEPOINT — the transaction lives
        log.warn("skipping order {}: {}", order.id(), e.getSQLState());
    }
}
c.commit();
```

Now order 3's `23505` is real, orders 4 onward run normally, and the commit saves
every order that worked. The savepoint mechanics — including the release on the
success path, which is not optional — are [chunk 9](09-savepoints.md).

⚠️ **One thing this does not fix: `40001`.** A serialization failure aborts the
transaction, and rolling back to a savepoint does not make the conflict go away.
The whole transaction must be retried from the beginning
([chunk 14](14-retrying-safely.md)); a savepoint would only let you re-run the
statement into the same conflict.

## Gotchas
**⚠️ Debugging the statement named in the `25P02`**
**Symptom:** hours spent on a query that turns out to be fine.
**Cause:** the aborted-state check runs before parse analysis, so the reported
statement was never even compiled. It failed because a *previous* statement failed.
**Fix:** find the first error in the transaction that is not `25P02`. That is the
bug.

**⚠️ `catch (SQLException e) { log.warn(...); }` inside a transaction loop**
**Symptom:** one real error and hundreds of identical "current transaction is
aborted" warnings, and a commit that saves nothing.
**Cause:** the transaction was already dead after the first failure; every
subsequent iteration was rejected.
**Fix:** either let the first failure end the transaction, or take a savepoint per
iteration so a failure is genuinely recoverable.

**⚠️ Retrying the failed statement in place**
**Symptom:** the retry fails with `25P02` rather than with the original error.
**Cause:** the transaction is aborted; nothing but `COMMIT`, `PREPARE`, `ROLLBACK`
and `ROLLBACK TO SAVEPOINT` will run in it.
**Fix:** roll back to a savepoint taken before the statement, or roll back the
whole transaction and start again.

**⚠️ Expecting `commit()` to save the good part of an aborted transaction**
**Symptom:** the commit returns without throwing and none of the data is there.
**Cause:** an aborted transaction has nothing to commit. `COMMIT` is accepted as a
way of *ending* the block, not as a way of keeping anything.
**Fix:** if partial success is a requirement, it must be built with savepoints
while the transaction is still alive — after the abort it is too late.

**⚠️ Returning an aborted connection to the pool**
**Symptom:** a session sitting in `idle in transaction (aborted)`, holding locks
and blocking cleanup.
**Cause:** the transaction was never ended — the code caught the exception, logged
it, and let the connection go out of scope.
**Fix:** the standard shape from
[chunk 2](02-commit-rollback-and-the-shape-that-survives.md): roll back in the
catch, restore state in the finally, close in try-with-resources.

**⚠️ Assuming `PreparedStatement` avoids it**
**Symptom:** switching to prepared statements does not change the cascade.
**Cause:** the same check appears in `exec_parse_message`, `exec_bind_message` and
`exec_execute_message`, not only in the simple-query path. Parse, bind and execute
are all refused.
**Fix:** there is no protocol-level workaround. Savepoints or a new transaction.

## Interview questions
**★ What is SQLSTATE 25P02 and when do you see it?**
It is `in_failed_sql_transaction`, and the message is "current transaction is
aborted, commands ignored until end of transaction block". You see it on every
statement issued after some earlier statement in the same transaction failed.
PostgreSQL puts the transaction into an aborted state on any error, and from then
on it rejects everything except `COMMIT`, `PREPARE`, `ROLLBACK` and `ROLLBACK TO
SAVEPOINT`. The rejection happens before parse analysis, so the statement is not
even compiled — which is why a statement with a genuine syntax error will report
`25P02` instead of the syntax error.

**★ Why is it such a confusing error?**
Because it is never the real problem, and it is loud. A `catch` block that logs and
continues produces one accurate error followed by hundreds of identical
`25P02`s, so whichever line your alerting surfaces is almost certainly a statement
that was fine. Engineers then debug the innocent query. The rule to internalise is
that `25P02` is a *consequence*: when you see it, search backwards for the first
error in that transaction with a different SQLSTATE, because that is the one that
poisoned it.

**★ How do you recover from a failed statement without losing the whole
transaction?**
A savepoint, and only a savepoint. Take one before the statement that might fail;
if it fails, `rollback(savepoint)` — which is on the short list of commands still
permitted in an aborted transaction — and the transaction returns to the state at
the mark and is usable again. Release the savepoint on the success path so they do
not accumulate. That is exactly what a loop over items with per-item error handling
needs, and without it the first bad item costs you the whole batch.

**★ Does using `PreparedStatement` instead of `Statement` avoid the cascade?**
No. The same aborted-state check appears in the extended-protocol handlers as well
as the simple-query one — parse, bind and execute all carry it — so there is no
protocol path that gets through. It is also worth noting the check is the *first*
thing that happens, before any parsing or planning, which is why the error is so
uninformative: the server deliberately does not look at your statement, because
looking at it would require database access that is not safe in abort state.

**★ Can you commit the successful part of a transaction that later aborted?**
No. An aborted transaction has nothing to commit — the server accepts `COMMIT` as a
way of ending the block rather than piling a second error on top of the first, but
no work survives. If partial success is a requirement, it has to be designed in
while the transaction is still healthy, with a savepoint per unit so that a failure
rolls back only that unit. After the abort there is no mechanism, because the state
you would want to keep is exactly the state the abort discarded.

**★ Does rolling back to a savepoint help with a serialization failure?**
No, and this is a useful boundary case. A `40001` does abort the transaction like
any other error, so `25P02` follows it in the same way — but the conflict that
caused it is a property of your snapshot, and rewinding to a savepoint does not give
you a new one. Re-running the statement would meet the same conflict. Serialization
failures need the whole transaction retried from the beginning, on a fresh snapshot,
which is a different mechanism from savepoint recovery even though both are reached
from the same `catch`.

---

← Prev: [9b · Cursors and the cost](09b-cursors-and-the-cost.md) · Index: [Transactions at the JDBC level](README.md) · Next → [10b · autosave](10b-autosave.md)
