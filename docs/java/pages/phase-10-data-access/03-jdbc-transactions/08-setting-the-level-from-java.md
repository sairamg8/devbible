---
title: "setTransactionIsolation on pgJDBC changes the whole session, not the transaction — which is a problem when the connection came from a pool"
sidebar_label: "8 · Setting the level"
sidebar_position: 12
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the JDK 25 API for `java.sql.Connection`
> ([docs.oracle.com/en/java/javase/25/docs/api/java.sql/java/sql/Connection.html](https://docs.oracle.com/en/java/javase/25/docs/api/java.sql/java/sql/Connection.html)),
> the PostgreSQL 18 `SET TRANSACTION` reference page
> ([postgresql.org/docs/18/sql-set-transaction.html](https://www.postgresql.org/docs/18/sql-set-transaction.html)),
> Appendix A *Error Codes*
> ([postgresql.org/docs/18/errcodes-appendix.html](https://www.postgresql.org/docs/18/errcodes-appendix.html)),
> and the pgJDBC 42.7.x source for `PgConnection`
> ([github.com/pgjdbc/pgjdbc](https://github.com/pgjdbc/pgjdbc)).
> JDK 25, JDBC 4.3, PostgreSQL 18, pgjdbc 42.7.13. No sandbox: no console
> output, no timings.

**There is a gap between what `Connection.setTransactionIsolation()` looks like it
does and what pgJDBC actually sends. The method name says *connection*, the
javadoc is deliberately vague, and the SQL the driver emits is
`SET SESSION CHARACTERISTICS AS TRANSACTION ISOLATION LEVEL ...` — which changes
the **session default for every future transaction on that physical connection**,
not the current one. On a bare `Connection` that distinction is academic. On a
pooled connection it is a bug waiting for the next borrower, and whether the pool
cleans up depends on *how* you set the level: through the JDBC method, or with raw
SQL that the pool never sees.**

## Four places the level can come from

| Where | Scope | Set by |
|---|---|---|
| `default_transaction_isolation` | every new transaction, server- or role-wide | `postgresql.conf`, `ALTER DATABASE`, `ALTER ROLE` |
| `SET SESSION CHARACTERISTICS AS TRANSACTION ISOLATION LEVEL ...` | every future transaction **on this session** | SQL — and by `Connection.setTransactionIsolation()` |
| `SET TRANSACTION ISOLATION LEVEL ...` | **this transaction only** | SQL, inside an open transaction |
| `BEGIN TRANSACTION ISOLATION LEVEL ...` | this transaction only | SQL, as part of starting it |

Only the bottom two are per-transaction, and **JDBC has an API for neither of
them.**

## What `setTransactionIsolation` actually does

pgJDBC's implementation, in full:

```java
public void setTransactionIsolation(int level) throws SQLException {
  checkClosed();

  if (queryExecutor.getTransactionState() != TransactionState.IDLE) {
    throw new PSQLException(
        GT.tr("Cannot change transaction isolation level in the middle of a transaction."),
        PSQLState.ACTIVE_SQL_TRANSACTION);
  }

  String isolationLevelName = getIsolationLevelName(level);
  if (isolationLevelName == null) {
    throw new PSQLException(GT.tr("Transaction isolation level {0} not supported.", level),
        PSQLState.NOT_IMPLEMENTED);
  }

  String isolationLevelSQL =
      "SET SESSION CHARACTERISTICS AS TRANSACTION ISOLATION LEVEL " + isolationLevelName;
  execSQLUpdate(isolationLevelSQL);
}
```

🔴 **`SET SESSION CHARACTERISTICS`.** Not `SET TRANSACTION`. The call you wrote to
configure *this* unit of work has reconfigured the session, and it stays that way
until something changes it back or the physical connection is closed.

Two more things fall out of that code.

**It is a round trip.** `execSQLUpdate` sends a statement to the server. Setting
the level is not a local flag assignment, so doing it on every borrow costs a
network round trip on every borrow.

**It throws if a transaction is open**, with SQLSTATE `25001`,
`active_sql_transaction`. The JDBC javadoc only says *"If this method is called
during a transaction, the result is implementation-defined"* — a permission slip
for drivers to do anything. pgJDBC's choice is to refuse, which is the good
outcome: a driver that silently ignored it would be far worse.

⚠️ Remember from [chunk 1](01-autocommit-is-a-transaction-you-did-not-choose.md)
that pgJDBC does not send `BEGIN` until your first statement. So `IDLE` is true
right up until you execute something, and the practical rule is:
**`setAutoCommit(false)` then `setTransactionIsolation(...)` then your first
statement.** Reverse the last two and you get the exception.

## The server has its own version of the same rule

The `SET TRANSACTION` reference page: *"the isolation level cannot be changed after
the first query or data-modification statement (`SELECT`, `INSERT`, `DELETE`,
`UPDATE`, `MERGE`, `FETCH`, or `COPY`) has been executed."*

That is the same list that decides where a Repeatable Read snapshot is taken
([chunk 6](06-repeatable-read.md)), and it is not a coincidence: the level cannot
change once a snapshot exists, because the snapshot's rules would change under it.

So there are **two** independent guards and they fire at different moments:

| Guard | Fires when | You see |
|---|---|---|
| pgJDBC | the driver's transaction state is not `IDLE` | `Cannot change transaction isolation level in the middle of a transaction.` (`25001`) |
| PostgreSQL | a query or data-modification statement has run in this transaction | a server error from `SET TRANSACTION` |

## Setting it per transaction, which is what you usually want

Since JDBC has no API for the per-transaction forms, you issue the SQL yourself.
The cleanest place is as part of starting the transaction:

```java
// ✅ per-transaction, one round trip, nothing left behind on the session
c.setAutoCommit(false);
try (Statement s = c.createStatement()) {
    s.execute("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
}
// ... the unit of work ...
c.commit();
```

That works because `setAutoCommit(false)` has not yet sent `BEGIN`, and pgJDBC
sends it before this statement — so `SET TRANSACTION` runs *inside* the
transaction, which is where it must be.

⚠️ **The same SQL executed while autocommit is on does nothing.** The reference
page: *"If `SET TRANSACTION` is executed without a prior `START TRANSACTION` or
`BEGIN`, it emits a warning and otherwise has no effect."* A warning, not an
error — so a `Statement.execute()` of it returns normally, your logs are silent
unless you are reading `SQLWarning`s, and the transaction that follows runs at the
default level. This is a genuinely nasty one because the code *looks* correct.

## Gotchas
**⚠️ `setTransactionIsolation` after the first statement**
**Symptom:** `Cannot change transaction isolation level in the middle of a
transaction.`, SQLSTATE `25001`, in code that reads perfectly sensibly.
**Cause:** pgJDBC refuses once its transaction state is not `IDLE`, and the server
refuses once a query has run in the transaction.
**Fix:** order it `setAutoCommit(false)` → `setTransactionIsolation(...)` → first
statement. The driver has not sent `BEGIN` yet at that point.

**⚠️ Executing `SET TRANSACTION ISOLATION LEVEL ...` while autocommit is on**
**Symptom:** nothing at all. No exception, and the transaction runs at the default
level.
**Cause:** the reference page — without a prior `BEGIN` it "emits a warning and
otherwise has no effect", and a warning does not throw.
**Fix:** turn autocommit off first, or use `BEGIN TRANSACTION ISOLATION LEVEL ...`
as one statement. If you want to know about warnings at all, read
`Connection.getWarnings()`.

**⚠️ Assuming `getTransactionIsolation()` is cheap**
**Symptom:** a health check or a logging interceptor that calls it per request
adds a round trip per request.
**Cause:** pgJDBC implements it by running `SHOW TRANSACTION ISOLATION LEVEL`
against the server — see [chunk 4](04-postgresql-has-three-levels.md).
**Fix:** do not poll it. If you need to know what you set, remember what you set.

## Interview questions
**★ What SQL does `Connection.setTransactionIsolation()` send on PostgreSQL?**
`SET SESSION CHARACTERISTICS AS TRANSACTION ISOLATION LEVEL <name>` — a
**session-level** change, not a transaction-level one. That surprises people,
because the method is on `Connection` and is usually called immediately before a
single unit of work, so it reads as if it configures that unit of work. On a
dedicated connection the distinction rarely bites. On a pooled connection it means
the setting outlives your borrow unless something resets it. It is also a real
statement sent to the server, so the call costs a round trip.

**★ When may the isolation level be changed?**
Only before the transaction has done anything. pgJDBC throws
`Cannot change transaction isolation level in the middle of a transaction.` with
SQLSTATE `25001` when its transaction state is not `IDLE`, and PostgreSQL itself
refuses once the first query or data-modification statement — `SELECT`, `INSERT`,
`DELETE`, `UPDATE`, `MERGE`, `FETCH` or `COPY` — has run. The JDBC javadoc is
weaker than both: it only says the result is "implementation-defined" during a
transaction, which is a licence for a driver to ignore the call silently. The safe
ordering on pgJDBC is `setAutoCommit(false)`, then set the level, then run the
first statement — which works because the driver has not sent `BEGIN` yet.

**★ How do you set the level for one transaction only?**
With SQL, because JDBC has no API for it. Either `SET TRANSACTION ISOLATION LEVEL
...` as the first statement inside an open transaction, or
`BEGIN TRANSACTION ISOLATION LEVEL ...` as the statement that opens it. Both scope
the level to that transaction and leave nothing behind on the session, which makes
them the right default for a pooled connection. The trap is running
`SET TRANSACTION` while autocommit is on: without a prior `BEGIN` the server emits
a warning and does nothing, and since a warning is not an exception the code looks
like it worked.

---

← Prev: [7c · DEFERRABLE and its limits](07c-deferrable-and-the-limits.md) · Index: [Transactions at the JDBC level](README.md) · Next → [8b · The level and the pool](08b-the-level-and-the-pool.md)
