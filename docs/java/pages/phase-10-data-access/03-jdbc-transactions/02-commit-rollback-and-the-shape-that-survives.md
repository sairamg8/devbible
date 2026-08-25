---
title: "`rollback()` in a catch block is the easiest place in Java to lose the exception that told you why"
sidebar_label: "2 · commit, rollback, the shape"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the JDK 25 API for `java.sql.Connection`
> ([docs.oracle.com/en/java/javase/25/docs/api/java.sql/java/sql/Connection.html](https://docs.oracle.com/en/java/javase/25/docs/api/java.sql/java/sql/Connection.html))
> and `java.lang.Throwable.addSuppressed`, the pgJDBC 42.7.13 source for
> `PgConnection` ([github.com/pgjdbc/pgjdbc](https://github.com/pgjdbc/pgjdbc)),
> and the PostgreSQL 18 manual Appendix A *Error Codes*
> ([postgresql.org/docs/18/errcodes-appendix.html](https://www.postgresql.org/docs/18/errcodes-appendix.html)).
> JDK 25, JDBC 4.3, PostgreSQL 18, pgjdbc 42.7.13. No sandbox: no console
> output, no timings.

**Ending a transaction looks like two methods and is really four rules. `commit`
and `rollback` both throw if the connection is in autocommit mode — that is in
the javadoc's throws clause, and pgJDBC's message is `Cannot commit when
autoCommit is enabled.` with SQLSTATE `25P01`. Both are silent no-ops when no
transaction is open, so "the rollback ran" proves nothing. `rollback()` can
itself throw, and when it throws inside a `catch` block written the obvious way
it replaces the exception that explains the failure with one that does not. And a
connection returned to the pool with an open transaction is not a leak you find
later — it is a lock somebody else is already waiting on. The shape below is
written once and then reused; the reason it is shaped that way is every one of
those four.**

## Both methods throw in autocommit mode

The javadoc for `commit()` lists among its `SQLException` causes: **"if a
database access error occurs, this method is called while participating in a
distributed transaction, if this method is called on a closed connection or this
`Connection` object is in auto-commit mode"**. `rollback()` has the identical
clause.

pgJDBC implements the check as its first action:

```java
public void commit() throws SQLException {
    checkClosed();
    if (autoCommit) {
        throw new PSQLException(GT.tr("Cannot commit when autoCommit is enabled."),
            PSQLState.NO_ACTIVE_SQL_TRANSACTION);
    }
    if (queryExecutor.getTransactionState() != TransactionState.IDLE) {
        executeTransactionCommand(commitQuery);
    }
}
```

Two things to take from that beyond the exception.

**`PSQLState.NO_ACTIVE_SQL_TRANSACTION` is SQLSTATE `25P01`**, listed in the
manual's error-code appendix under Class 25 — Invalid Transaction State. If you
are translating exceptions by SQLSTATE
([retrying and translating](../01-jdbc/21e-retrying-and-translating.md)), that is
the code this shows up as, and it means a bug in your code rather than a
condition to retry.

🔴 **`commit()` when no transaction is open is a no-op, not an error** — the state
check means the driver sends nothing. And `rollback()` behaves the same way, with
a detail worth staring at:

```java
if (queryExecutor.getTransactionState() != TransactionState.IDLE) {
    executeTransactionCommand(rollbackQuery);
} else {
    // just log for debugging
    LOGGER.log(Level.FINE, "Rollback requested but no transaction in progress");
}
```

So a `rollback()` you believed was undoing something, on a connection whose
transaction has already ended, **succeeds silently and does nothing**. That is
the right behaviour — there is nothing to undo — but it means "the rollback ran"
is not evidence that anything was rolled back.

## The shape

```java
try (Connection c = ds.getConnection()) {
    boolean previousAutoCommit = c.getAutoCommit();
    c.setAutoCommit(false);
    try {
        debit(c, from, amount);
        credit(c, to, amount);
        c.commit();
    } catch (SQLException | RuntimeException e) {
        try {
            c.rollback();
        } catch (SQLException rollbackFailure) {
            e.addSuppressed(rollbackFailure);
        }
        throw e;
    } finally {
        c.setAutoCommit(previousAutoCommit);
    }
}
```

Every line of that is defending against something specific:

| Line | Defends against |
|---|---|
| `catch (SQLException \| RuntimeException e)` | a `NullPointerException` in your mapping code leaving the transaction open |
| the nested `try` around `rollback()` | the rollback throwing and replacing the real exception |
| `addSuppressed` | losing the rollback failure entirely instead |
| `throw e` rather than a new exception | the caller still sees the cause |
| `finally { setAutoCommit(...) }` **after** the commit/rollback | the flag change being a commit — [chunk 1](01-autocommit-is-a-transaction-you-did-not-choose.md) |
| try-with-resources on the `Connection` | the connection not returning to the pool at all |

⚠️ **Catch `Throwable`? No.** Catching `SQLException | RuntimeException` covers
what realistically happens inside a unit of work. If you want belt and braces,
`catch (Throwable t)` with a rethrow is defensible, but note that
try-with-resources will close the connection regardless, and a well-configured
pool rolls back an unclean connection on return — which is a safety net, not a
design.

## Why `rollback()` in a `catch` block is where exceptions go to die

This is the version almost everyone writes first:

```java
// ❌ if rollback() throws, the SQLException that explains the failure is gone
} catch (SQLException e) {
    c.rollback();
    throw e;
}
```

`rollback()` throws for real reasons: the connection is already dead, the socket
timed out, the server terminated the session
([timeouts and cancellation](../01-jdbc/22b-connection-and-socket-timeouts.md)).
And those are *correlated* with the reasons the transaction failed in the first
place — a connection killed mid-transaction fails your statement and then fails
your rollback. So the case where you most need the original exception is exactly
the case where you lose it, and what reaches your logs is a connection error
instead of the constraint violation that actually explains the incident.

`addSuppressed` is the language's answer to this. The suppressed throwable is
printed by the standard stack-trace format under a `Suppressed:` heading and is
retrievable with `getSuppressed()`, so you keep both and neither is invented.

⚠️ **Do not swallow the rollback failure.** `catch (SQLException ignored) {}`
around the rollback is the other common shape, and it hides the fact that the
connection is broken. Attach it; do not discard it.

🔴 **The failure this whole shape exists to prevent is returning a connection to
the pool mid-transaction** — `close()` hands back a live session, not a closed
socket, and an open transaction on it holds its locks and pins its snapshot until
something ends it. [The four clocks](13b-the-four-clocks.md) has the server side;
[ownership and leaks](../01-jdbc/18-ownership-and-leaks.md) has the hard part,
finding the code responsible.

## Gotchas

**⚠️ `rollback()` inside `catch`, unguarded**
**Symptom:** production logs full of connection-level exceptions and none of the
constraint violations or deadlocks that caused them.
**Cause:** the rollback threw and replaced the original exception.
**Fix:** nest the rollback in its own `try` and `addSuppressed`.

**⚠️ Calling `commit()` on an autocommit connection**
**Symptom:** `Cannot commit when autoCommit is enabled.`, SQLSTATE `25P01`, often
from a helper that assumes its caller turned autocommit off.
**Cause:** the transaction boundary is owned by two different pieces of code and
neither of them is sure.
**Fix:** one owner per unit of work. A helper takes a `Connection` and never
touches its transaction state.

**⚠️ Catching only `SQLException`**
**Symptom:** a `NullPointerException` in row mapping escapes with the transaction
still open.
**Cause:** the rollback path is only wired to one exception type.
**Fix:** `catch (SQLException | RuntimeException e)`, and rely on
try-with-resources plus the pool as the final backstop.

**⚠️ Treating a successful `rollback()` as proof something was undone**
**Symptom:** a test that "passes" because the rollback did not throw, over a
connection whose transaction had already ended.
**Cause:** pgJDBC skips the `ROLLBACK` entirely when its transaction state is
`IDLE`, logging at `FINE` and returning normally.
**Fix:** assert on the data, not on the absence of an exception.

**⚠️ Returning a connection without committing**
**Symptom:** writes that disappear; sessions `idle in transaction`; unrelated
requests blocking.
**Cause:** an early `return` inside the transaction body, or an exception path
with no rollback.
**Fix:** the shape above, with the commit as the last statement of the `try` so
an early `return` cannot skip past it.

## Interview questions

**★ Write the correct try/catch shape for a JDBC transaction, and justify each
part.**
Borrow the connection with try-with-resources; record the previous autocommit
value and set it false; do the work; `commit()` as the last statement of the
`try`. Catch `SQLException | RuntimeException` so a mapping bug does not escape
with the transaction open. Inside the catch, call `rollback()` in a nested `try`
and attach any failure with `addSuppressed`, then rethrow the original. Restore
autocommit in a `finally` — after the commit or rollback, never as the thing that
ends the transaction. The justification is that every one of those guards
corresponds to a real failure: the rollback can throw, the flag change is a
commit, a runtime exception is as capable of abandoning a transaction as a SQL
one, and a connection returned mid-transaction poisons the pool.

**★ What happens if `rollback()` throws?**
Whatever you wrote determines it, and the naive version loses information. If
`rollback()` is called directly in a catch block and throws, its exception
propagates and the original one — the constraint violation, the deadlock, the
serialization failure — is discarded. That is the worst possible trade, because
rollback failures correlate strongly with the failures that triggered them: a
connection killed mid-transaction fails the statement *and* the rollback, so the
incident report shows a connection error and hides the real cause. Wrap the
rollback in its own try and call `addSuppressed` on the original exception, which
keeps both and prints both in the standard stack-trace format.

**★ What happens if you call `commit()` with autocommit on?**
It throws. The javadoc's throws clause names auto-commit mode explicitly, and
pgJDBC raises `Cannot commit when autoCommit is enabled.` with
`PSQLState.NO_ACTIVE_SQL_TRANSACTION`, which is SQLSTATE `25P01` — Class 25,
Invalid Transaction State. It is not a retryable condition; it means two pieces
of code disagree about who owns the transaction boundary. The fix is structural:
one owner per unit of work, and helpers that accept a `Connection` without ever
touching its transaction state.

**★ Is `commit()` on a connection with no open transaction an error?**
No. pgJDBC checks its transaction state first and sends nothing when it is
`IDLE`, so the call succeeds and is a no-op. `rollback()` does the same thing,
logging at `FINE` that a rollback was requested with no transaction in progress.
This matters for tests and for defensive cleanup code: a rollback returning
normally proves nothing about whether anything was undone. Assert on the data.

**★ Why does restoring autocommit belong in `finally` rather than after the
commit?**
Because the `finally` runs on every path, including the one where an exception
was thrown, and the connection is about to go back to the pool on all of them.
Putting it only after the successful commit leaves the failure path returning a
connection with autocommit off, which the next borrower inherits — and that
borrower will write, never call `commit()`, and lose the work. The ordering
constraint is the other half of the answer: it has to come *after* the explicit
commit or rollback, because if a transaction is still open when the flag flips,
the flag flip commits it.

**★ Why catch `RuntimeException` as well as `SQLException`?**
Because the transaction is open across your code, not just across JDBC calls. A
`NullPointerException` while mapping a row, an `IllegalStateException` from a
validation helper, an arithmetic failure in the amount calculation — none of them
are `SQLException`, and all of them leave the transaction open if the rollback
path only listens for `SQLException`. Try-with-resources will still close the
connection, and a well-configured pool will roll back an unclean connection on
return, but relying on that means relying on configuration for correctness. Catch
both, roll back, rethrow.

---

← Prev: [1 · Autocommit](01-autocommit-is-a-transaction-you-did-not-choose.md) · Index: [Transactions at the JDBC level](README.md) · Next → [3 · What isolation means](03-what-isolation-actually-means.md)
