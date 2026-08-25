---
title: "You are always in a transaction — autocommit just means somebody else decides where it ends"
sidebar_label: "1 · Autocommit"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the JDK 25 API for `java.sql.Connection`
> ([docs.oracle.com/en/java/javase/25/docs/api/java.sql/java/sql/Connection.html](https://docs.oracle.com/en/java/javase/25/docs/api/java.sql/java/sql/Connection.html)),
> the pgJDBC documentation *Issuing a Query and Processing the Result*
> ([jdbc.postgresql.org/documentation/query/](https://jdbc.postgresql.org/documentation/query/))
> and *Initializing the Driver*
> ([jdbc.postgresql.org/documentation/use/](https://jdbc.postgresql.org/documentation/use/)),
> the pgJDBC 42.7.13 source for `PgConnection` and `QueryExecutorImpl`
> ([github.com/pgjdbc/pgjdbc](https://github.com/pgjdbc/pgjdbc)), and the
> PostgreSQL 18 manual §13.2 *Transaction Isolation*
> ([postgresql.org/docs/18/transaction-iso.html](https://www.postgresql.org/docs/18/transaction-iso.html)).
> JDK 25, JDBC 4.3, PostgreSQL 18, pgjdbc 42.7.13. No sandbox: no console
> output, no timings.

**There is no such thing as a statement outside a transaction in PostgreSQL.
Autocommit is not "transactions off" — it is "one transaction per statement,
committed for you". So the question is never *whether* you are in a transaction;
it is only *where the boundary is*, and by default the boundary is drawn in the
wrong place: around each statement individually, rather than around the unit of
work you actually meant. `setAutoCommit(false)` is how you take that decision
back. Two details surprise almost everyone. `setAutoCommit(false)` sends nothing
to the server at all — pgJDBC does not issue `BEGIN` until your next statement,
so the transaction starts later than the line of Java that appears to start it.
And changing the mode while a transaction is running **commits** it, which is in
the javadoc in capitals and turns the most natural-looking cleanup line in Java
into a data-integrity bug.**

## Autocommit is the default, and the default is a decision

The `Connection` javadoc opens with it: **"By default a `Connection` object is in
auto-commit mode, which means that it automatically commits changes after
executing each statement. If auto-commit mode has been disabled, the method
`commit` must be called explicitly in order to commit changes; otherwise,
database changes will not be saved."**

Read the second sentence carefully, because it is the trap in the other
direction. Turn autocommit off, forget to call `commit()`, close the connection —
and your work is gone. The default is safe against that and unsafe against
everything else.

Here is the concrete cost of the default. A transfer between two accounts:

```java
// ❌ autocommit: two transactions, and a crash between them is a lost £100
try (Connection c = ds.getConnection()) {
    debit(c, from, amount);     // committed. permanent. done.
    credit(c, to, amount);      // if this throws, the debit has already happened
}
```

Nothing here is atomic. The debit committed the instant it finished. If
`credit` throws — a constraint violation, a network drop, the JVM being
`SIGKILL`ed — there is no rollback available, because there is nothing left to
roll back. The money has left one account and arrived nowhere.

```java
// ✅ one transaction around the unit of work
try (Connection c = ds.getConnection()) {
    c.setAutoCommit(false);
    try {
        debit(c, from, amount);
        credit(c, to, amount);
        c.commit();
    } catch (SQLException e) {
        c.rollback();
        throw e;
    }
}
```

That shape has more to it than it looks — the `rollback()` in the catch has its
own failure modes, and restoring autocommit before the connection goes back to
the pool matters. [Chunk 2](02-commit-rollback-and-the-shape-that-survives.md)
takes it apart line by line.

## When exactly does an autocommit statement commit?

The javadoc is unusually specific, and the third bullet is the one that bites:

> The commit occurs when the statement completes. The time when the statement
> completes depends on the type of SQL Statement:
>
> - For DML statements, such as Insert, Update or Delete, and DDL statements,
>   the statement is complete as soon as it has finished executing.
> - For Select statements, the statement is complete when the associated result
>   set is closed.
> - For `CallableStatement` objects or for statements that return multiple
>   results, the statement is complete when all of the associated result sets
>   have been closed, and all update counts and output parameters have been
>   retrieved.

So **an autocommit `SELECT` holds its transaction open until you close the
`ResultSet`**. If you iterate slowly, or hand the `ResultSet` to something that
does work per row, the transaction lives that long. That is the same duration
problem [where the boundary belongs](15-where-the-boundary-belongs.md) is about, arriving from a
direction nobody expects.

## Changing the mode commits — this is specified, not a driver quirk

The javadoc puts it in a NOTE:

> **NOTE:** If this method is called during a transaction and the auto-commit
> mode is changed, the transaction is committed. If `setAutoCommit` is called and
> the auto-commit mode is not changed, the call is a no-op.

pgJDBC implements it literally — this is the body of its `setAutoCommit`, before
the flag is finally assigned:

```java
if (this.autoCommit == autoCommit) {
    return;                 // no-op, per the javadoc
}
if (!this.autoCommit) {
    commit();               // turning it ON commits what is in flight
}
```

🔴 **So `setAutoCommit(true)` in a `finally` block is a commit of whatever the
failure path was about to discard**, and it is one of the most common ways to
write a silent data-integrity bug, because it is written *as cleanup*. It is safe
only when the transaction has already been ended explicitly, which leaves the
driver's transaction state `IDLE` and makes the flag change a plain flag change.
That ordering is why [chunk 2](02-commit-rollback-and-the-shape-that-survives.md)
puts the commit and rollback *before* the `finally` that restores the flag.

The rule that removes the hazard entirely: **end the transaction explicitly, then
touch the flag. Never let the flag be the thing that ends it.**

⚠️ The no-op half is worth knowing too. `setAutoCommit(false)` called twice does
not nest, does not commit and does not warn. JDBC has no nested transactions and
no reference counting — one transaction per connection at a time. The nearest
thing PostgreSQL offers is a savepoint,
[savepoints](09-savepoints.md). Frameworks that appear to nest are
doing that bookkeeping above JDBC; **Spring's propagation behaviours** *(not
written yet)* are topic 04's subject.

## Gotchas

**⚠️ `setAutoCommit(true)` used as cleanup, mid-transaction**
**Symptom:** work you expected to be discarded is present in the database after a
failure, with no `commit()` anywhere in the stack trace.
**Cause:** the javadoc NOTE — changing the mode during a transaction commits it,
and pgJDBC calls `commit()` internally to do so.
**Fix:** `commit()` or `rollback()` explicitly first; only then restore the flag.

**⚠️ Autocommit left off on a pooled connection**
**Symptom:** an unrelated later request writes, does not commit, and its work
vanishes — or worse, sits open and blocks other writers.
**Cause:** autocommit is connection state, and `close()` on a pooled connection
returns the session, it does not reset your flags.
**Fix:** restore it in a `finally`, and configure the pool's `autoCommit` default
so a connection that escapes still lands in a known state
([a `Connection` is expensive](../01-jdbc/04-connection-is-expensive.md)).

**⚠️ An autocommit `SELECT` whose `ResultSet` is never closed**
**Symptom:** sessions sitting `idle in transaction` in a service that has no
explicit transactions anywhere in its code.
**Cause:** the javadoc's completion rule — a `SELECT` completes when its
`ResultSet` closes, and the autocommit commit waits for that.
**Fix:** try-with-resources on the `ResultSet`
([resource handling](../01-jdbc/17-resource-handling.md)).

## Interview questions

**★ Why is autocommit dangerous for a multi-statement operation?**
Because it removes atomicity precisely where you need it. Each statement commits
independently, so a failure partway through leaves the earlier statements
permanently applied with nothing to roll back. The classic case is a transfer:
debit commits, credit fails, and the money is gone. It is not only exceptions —
a process kill or a network partition between the two statements has the same
effect. Autocommit is fine when the unit of work genuinely is one statement, and
wrong the moment it is two.

**★ What happens if you call `setAutoCommit(true)` while a transaction is open?**
The transaction is committed. The javadoc states it as a NOTE — if the method is
called during a transaction and the mode is changed, the transaction is committed
— and pgJDBC implements it literally by calling `commit()` before flipping the
flag. This makes `setAutoCommit(true)` in a `finally` block actively dangerous,
because it is usually written as cleanup and behaves as a commit of whatever the
failure path was about to abandon. The safe discipline is to end every
transaction explicitly with `commit()` or `rollback()` and only then restore the
flag, so the flag change is always a no-op on an idle connection.

**★ Does `setAutoCommit(false)` nest if called twice?**
No. The javadoc says a call that does not change the mode is a no-op, and pgJDBC
returns immediately when the new value equals the old one. JDBC has no nested
transactions and no reference counting — there is one transaction per connection
at a time. If you need to undo part of a transaction without abandoning all of
it, the mechanism is a savepoint, not a second `setAutoCommit(false)`.

---

Index: [Transactions at the JDBC level](README.md) · Next → [2 · commit, rollback, the shape](02-commit-rollback-and-the-shape-that-survives.md)
