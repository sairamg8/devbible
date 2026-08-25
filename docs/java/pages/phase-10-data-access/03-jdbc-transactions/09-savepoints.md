---
title: "A savepoint lets you undo part of a transaction without ending it — which is the only reason the aborted-transaction escape hatch exists"
sidebar_label: "9 · Savepoints"
sidebar_position: 14
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the PostgreSQL 18 reference pages `SAVEPOINT`
> ([postgresql.org/docs/18/sql-savepoint.html](https://www.postgresql.org/docs/18/sql-savepoint.html))
> and `ROLLBACK TO SAVEPOINT`
> ([postgresql.org/docs/18/sql-rollback-to.html](https://www.postgresql.org/docs/18/sql-rollback-to.html)),
> the JDK 25 API for `java.sql.Connection` and `java.sql.Savepoint`
> ([docs.oracle.com/en/java/javase/25/docs/api/java.sql/java/sql/Connection.html](https://docs.oracle.com/en/java/javase/25/docs/api/java.sql/java/sql/Connection.html)),
> and the pgJDBC 42.7.x source for `PgConnection`
> ([github.com/pgjdbc/pgjdbc](https://github.com/pgjdbc/pgjdbc)).
> JDK 25, JDBC 4.3, PostgreSQL 18, pgjdbc 42.7.13. No sandbox: no console
> output, no timings.

**JDBC has no nested transactions. What it has instead is a savepoint: a named
mark inside a transaction that you can rewind to, undoing everything after it
while leaving everything before it — and the transaction itself — intact. That
last clause is the whole point and the thing people get wrong.
`rollback(savepoint)` is not a small `rollback()`. It does **not** end the
transaction, it does not release locks taken before the mark, and afterwards you
are still inside the same transaction and must still commit or roll back. The
reason to care is not elegance. It is that on PostgreSQL one failed statement
poisons an entire transaction, and a savepoint is the only mechanism that lets you
recover from a failure without throwing away the work that preceded it.**

## What the three commands do

pgJDBC's savepoint methods are thin. They send exactly the SQL you would write by
hand:

| JDBC method | SQL sent |
|---|---|
| `setSavepoint()` / `setSavepoint(name)` | `SAVEPOINT <name>` |
| `rollback(Savepoint)` | `ROLLBACK TO SAVEPOINT <name>` |
| `releaseSavepoint(Savepoint)` | `RELEASE SAVEPOINT <name>` |

The `SAVEPOINT` reference page defines the mark: *"A savepoint is a special mark
inside a transaction that allows all commands that are executed after it was
established to be rolled back, restoring the transaction state to what it was at
the time of the savepoint."*

And the two ways to consume it:

- **`ROLLBACK TO`** — undo everything after the mark, keep the mark.
- **`RELEASE`** — destroy the mark, *keep* the work. The reference page: use it
  *"to destroy a savepoint, keeping the effects of commands executed after it was
  established"*.

⚠️ `RELEASE` is not "commit this part". Nothing is committed until the transaction
commits. Releasing only says "I will not need to rewind to here again".

## 🔴 `ROLLBACK TO` does not end the transaction

This is the sentence to memorise, from the `ROLLBACK TO SAVEPOINT` page:

> Roll back all commands that were executed after the savepoint was established and
> then start a new subtransaction at the same transaction level. **The savepoint
> remains valid and can be rolled back to again later, if needed.**

Two facts in one sentence.

**The transaction continues.** You are still inside it. Locks acquired before the
savepoint are still held. Your snapshot is unchanged. Nothing has been committed
and nothing has been given up. You must still call `commit()` or `rollback()` at
the end, and forgetting to is the same leak as any other.

**The savepoint survives being used.** You can roll back to the same savepoint
repeatedly — which is what makes a per-item retry loop possible.

The same page adds the rule for savepoints created *after* the one you rewind to:
*"`ROLLBACK TO SAVEPOINT` implicitly destroys all savepoints that were established
after the named savepoint."* That is the natural behaviour — those marks refer to
work that no longer exists — but it means a `Savepoint` object you are still
holding may have become invalid without you doing anything to it.

## The shape in Java: partial failure inside a batch of work

```java
c.setAutoCommit(false);
List<Long> failed = new ArrayList<>();

for (Order order : orders) {
    Savepoint sp = c.setSavepoint();          // SAVEPOINT PGJDBC_AUTOSAVE... (a generated name)
    try {
        insertOrder(c, order);
        insertLines(c, order);
        c.releaseSavepoint(sp);               // RELEASE — keep the work, drop the mark
    } catch (SQLException e) {
        c.rollback(sp);                       // ROLLBACK TO — undo THIS order only
        failed.add(order.id());
    }
}
c.commit();                                   // everything that survived, atomically
```

Without the savepoint, the first bad order aborts the transaction and every
subsequent statement fails with a *different* error than the real one — see
[chunk 10](10-the-aborted-transaction.md). With it, one order is undone and the
loop continues.

⚠️ **The `releaseSavepoint` in the success path is not optional bookkeeping.**
Leave it out and every iteration adds a savepoint the server must keep track of
for the rest of the transaction. That is the cost discussed below, and it is why
pgJDBC has a connection parameter dedicated to exactly this problem.

## The API's sharp edges

**Savepoints require autocommit off.** The javadoc lists auto-commit mode among
`setSavepoint`'s throws conditions, and pgJDBC's message is
`Cannot establish a savepoint in auto-commit mode.` with SQLSTATE `25P01`,
`no_active_sql_transaction`. That is a sensible refusal — a savepoint inside a
one-statement transaction has nothing to mark.

⚠️ The JDBC javadoc also says *"If `setSavepoint` is invoked outside of an active
transaction, a transaction will be started at this newly created savepoint."*
That describes a driver that starts a transaction for you. pgJDBC does not take
that route: with autocommit **on** it throws, and with autocommit **off** a
transaction is already logically open, so the clause never applies as written.

🔴 **`releaseSavepoint` removes more than you named.** The javadoc: *"Removes the
specified `Savepoint` **and subsequent `Savepoint` objects** from the current
transaction. Any reference to the savepoint after it have been removed will cause
an `SQLException` to be thrown."* pgJDBC also marks the object invalid locally —
its implementation calls `pgSavepoint.invalidate()` after sending the SQL — so a
second use of the same `Savepoint` fails in the driver, not on the server.

**Rolling back to a savepoint that no longer exists is an error**, on both sides:
the reference page says *"specifying a savepoint name that has not been
established is an error"*, and the JDBC javadoc lists "the `Savepoint` object is no
longer valid" among `rollback(Savepoint)`'s throws conditions. The relevant
SQLSTATE class is 3B — `3B001`, `invalid_savepoint_specification`.

## Duplicate names: PostgreSQL keeps the old one

The `SAVEPOINT` page's compatibility note is a genuine deviation from the standard
and worth knowing before you write `setSavepoint("retry")` in a loop:

> SQL requires a savepoint to be destroyed automatically when another savepoint
> with the same name is established. In PostgreSQL, the old savepoint is kept,
> though only the more recent one will be used when rolling back or releasing.
> (Releasing the newer savepoint with `RELEASE SAVEPOINT` will cause the older one
> to again become accessible to `ROLLBACK TO SAVEPOINT` and `RELEASE SAVEPOINT`.)

So on PostgreSQL, a loop that reuses one name **accumulates** savepoints — the
standard's behaviour would have replaced them. Releasing one uncovers the previous
one, like a stack.

⚠️ **Prefer `setSavepoint()` with no name.** pgJDBC generates a unique name from an
incrementing `savepointId`, so the shadowing problem cannot arise. Use a name only
when a human will read it in a server log.

## Gotchas
**⚠️ Treating `rollback(savepoint)` as ending the transaction**
**Symptom:** a connection returned to the pool `idle in transaction`, holding
locks, after an error path that "rolled back".
**Cause:** `ROLLBACK TO SAVEPOINT` starts a new subtransaction at the same level.
The transaction is still open and still needs `commit()` or `rollback()`.
**Fix:** treat the savepoint rollback as recovery, not as cleanup. The outer
`try`/`finally` still owns ending the transaction —
[chunk 2](02-commit-rollback-and-the-shape-that-survives.md).

**⚠️ Reusing a `Savepoint` object after releasing it**
**Symptom:** an `SQLException` from `rollback(sp)` in a `finally` or a retry, on a
savepoint that was already released.
**Cause:** `releaseSavepoint` removes the named savepoint *and every subsequent
one*, and pgJDBC calls `invalidate()` on the object as well.
**Fix:** null the reference when you release it, or structure the code so release
and rollback are mutually exclusive branches — as in the loop above.

**⚠️ Reusing the same savepoint name in a loop**
**Symptom:** savepoints accumulate rather than being replaced, and releasing one
makes an older one reappear.
**Cause:** PostgreSQL deliberately deviates from the standard here — the old
savepoint is kept and merely shadowed.
**Fix:** use `setSavepoint()` with no name and let pgJDBC generate a unique one.

**⚠️ Using savepoints to fake nested transactions**
**Symptom:** a helper that "starts a nested transaction", used from code that also
starts one, with unclear ownership of the outermost commit.
**Cause:** JDBC has no nested transactions; savepoints are a rewind mechanism
inside a single one, and they share its locks, its snapshot and its commit.
**Fix:** one owner per transaction boundary. Framework-level nesting is built above
JDBC — **[Topic 04 — NESTED and savepoints](../04-spring-transactional/11-nested-and-savepoints.md)** is where that
bookkeeping lives.

## Interview questions
**★ What is a savepoint and what does rolling back to one do?**
It is a named mark inside a transaction. Rolling back to it undoes every command
executed after the mark and leaves everything before it in place. The critical part
is what it does *not* do: it does not end the transaction. The reference page says
it rolls back the commands and "then start[s] a new subtransaction at the same
transaction level", and that the savepoint itself remains valid and can be rolled
back to again. So after `rollback(savepoint)` you are still inside the transaction,
still holding every lock taken before the mark, still on the same snapshot, and you
still have to commit or roll back at the end.

**★ How does `RELEASE SAVEPOINT` differ from `ROLLBACK TO SAVEPOINT`?**
`ROLLBACK TO` discards the work done after the mark and keeps the mark. `RELEASE`
keeps the work and discards the mark — the reference page describes it as
destroying a savepoint "keeping the effects of commands executed after it was
established". Neither one commits anything; nothing in the transaction is durable
until the transaction commits. In JDBC, `releaseSavepoint` also has a wider reach
than its name suggests: the javadoc says it removes the specified savepoint *and
subsequent savepoint objects*, and pgJDBC invalidates the Java object as well, so a
later use of it throws in the driver.

**★ Why would you use a savepoint at all?**
Because on PostgreSQL a single failed statement aborts the entire transaction — no
further statement will run until the transaction ends. Without savepoints, any
recoverable error in the middle of a multi-step unit of work costs you every step
before it. A savepoint is the only mechanism that lets you undo just the failed
step and carry on. The archetype is a loop over items where one bad item should be
recorded and skipped rather than failing the whole batch: take a savepoint before
each item, release it on success, roll back to it on failure.

**★ What happens to savepoints taken after the one you roll back to?**
They are destroyed. `ROLLBACK TO SAVEPOINT` "implicitly destroys all savepoints
that were established after the named savepoint", which is the only coherent
behaviour since they mark work that no longer exists. The consequence for Java code
is that a `Savepoint` object you are still holding can become invalid without you
touching it, and using it then throws — the SQLSTATE class is 3B,
`invalid_savepoint_specification`. The same is true after a release, which removes
subsequent savepoints too.

**★ Do savepoints give you nested transactions?**
No, and the distinction matters. There is one transaction per connection at a time
in JDBC — `setAutoCommit(false)` called twice does not nest. A savepoint is a
rewind point inside that single transaction: it shares the transaction's locks, its
snapshot and its commit, and nothing it "undoes" was ever visible to anyone else
anyway. Frameworks that appear to offer nested transactions implement that
bookkeeping above JDBC, usually by mapping a nested boundary onto a savepoint,
which is why their nesting has exactly these semantics underneath.

**★ Why prefer `setSavepoint()` over `setSavepoint("name")`?**
Because PostgreSQL deviates from the SQL standard on duplicate names. The standard
says establishing a savepoint with an existing name destroys the old one;
PostgreSQL keeps the old one and merely shadows it, so releasing the newer makes
the older accessible again. In a loop that reuses one name, that means savepoints
accumulate rather than being replaced. The unnamed form sidesteps it entirely —
pgJDBC generates a unique name from an incrementing counter. Use an explicit name
only when a human is going to read it in a server log.

---

← Prev: [8b · The level and the pool](08b-the-level-and-the-pool.md) · Index: [Transactions at the JDBC level](README.md) · Next → [9b · Cursors and the cost](09b-cursors-and-the-cost.md)
