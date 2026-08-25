---
title: "PostgreSQL accepts all four isolation levels and implements three — READ UNCOMMITTED is silently READ COMMITTED"
sidebar_label: "4 · Three levels, four names"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the PostgreSQL 18 manual §13.2 *Transaction Isolation*
> ([postgresql.org/docs/18/transaction-iso.html](https://www.postgresql.org/docs/18/transaction-iso.html))
> and the `SET TRANSACTION` reference page
> ([postgresql.org/docs/18/sql-set-transaction.html](https://www.postgresql.org/docs/18/sql-set-transaction.html)),
> the JDK 25 API for `java.sql.Connection`
> ([docs.oracle.com/en/java/javase/25/docs/api/java.sql/java/sql/Connection.html](https://docs.oracle.com/en/java/javase/25/docs/api/java.sql/java/sql/Connection.html)),
> and the pgJDBC 42.7.x source for `PgConnection`
> ([github.com/pgjdbc/pgjdbc](https://github.com/pgjdbc/pgjdbc)).
> JDK 25, JDBC 4.3, PostgreSQL 18, pgjdbc 42.7.13. No sandbox: no console
> output, no timings.

**`connection.setTransactionIsolation(Connection.TRANSACTION_READ_UNCOMMITTED)`
does not throw, does not warn, and does not do what the constant's name says. The
manual states it plainly: *"in PostgreSQL, you can request any of the four
standard transaction isolation levels, but internally only three distinct
isolation levels are implemented, i.e., PostgreSQL's Read Uncommitted mode
behaves like Read Committed."* The request is accepted at every layer — the
driver maps the constant to a SQL name, the server accepts the name, and the
level is even reported back to you as Read Uncommitted. Nothing anywhere tells
you that the behaviour you asked for is not the behaviour you got. There are
three levels on PostgreSQL, and the fourth name is an alias with a misleading
javadoc attached.**

## Why there is nothing weaker than Read Committed to offer

This is not laziness, and the manual says why: *"this is because it is the only
sensible way to map the standard isolation levels to PostgreSQL's multiversion
concurrency control architecture."*

Under MVCC, a write does not overwrite a row. It writes a **new version** of the
row and leaves the old one in place, marked with the transaction that superseded
it. A reader picks a version by asking "which version was committed as of my
snapshot?" — so reading is not *permitted* to see uncommitted data, it has no
mechanism by which it could. There is no in-place buffer holding a half-written
value for a reader to peek at.

Dirty reads exist on engines that mutate rows in place and use locks to keep
readers out. Read Uncommitted on those engines means "skip the read lock" — a
real, cheaper mode. On PostgreSQL there is no read lock to skip and no in-place
mutation to observe, so there is nothing cheaper to sell you. Read Uncommitted
is free of dirty reads because dirty reads are not implementable.

## What actually happens when you ask for it

Follow the call down. pgJDBC's `setTransactionIsolation` translates the constant
to a SQL keyword through a plain switch:

```java
protected @Nullable String getIsolationLevelName(int level) {
  switch (level) {
    case Connection.TRANSACTION_READ_COMMITTED:   return "READ COMMITTED";
    case Connection.TRANSACTION_SERIALIZABLE:     return "SERIALIZABLE";
    case Connection.TRANSACTION_READ_UNCOMMITTED: return "READ UNCOMMITTED";
    case Connection.TRANSACTION_REPEATABLE_READ:  return "REPEATABLE READ";
    default:                                      return null;
  }
}
```

`TRANSACTION_READ_UNCOMMITTED` has a case. It produces the string
`READ UNCOMMITTED`, which the driver splices into a `SET SESSION CHARACTERISTICS`
statement and sends. `SET TRANSACTION`'s reference page lists `READ UNCOMMITTED`
among the accepted keywords, so the server takes it without complaint — and, per
that same page, *"PostgreSQL treats this as `READ COMMITTED`"*.

**Four accepts, zero warnings, one silent downgrade.** The constant is honoured
syntactically at every hop and honoured semantically at none.

## The level you read back is the level you asked for, not the one you have

`getTransactionIsolation()` does not return a cached flag. pgJDBC asks the
server:

```java
final ResultSet rs = execSQLQuery("SHOW TRANSACTION ISOLATION LEVEL");
...
if ("READ UNCOMMITTED".equals(level)) {
  return Connection.TRANSACTION_READ_UNCOMMITTED;
}
```

🔴 **That branch exists, and it is not dead code.** The driver would have no
reason to map the string `READ UNCOMMITTED` back to a constant unless the server
can report it — the setting is remembered as what you requested, even though the
engine behaves as Read Committed underneath. So a health check, an admin page, or
a log line that prints `getTransactionIsolation()` will faithfully report
`TRANSACTION_READ_UNCOMMITTED` on a connection that is giving you Read Committed
semantics.

⚠️ **This makes the round trip useless as a correctness check.** Reading the level
back proves the `SET` was accepted. It does not prove the level means what its
name means, and on this one value it definitely does not.

## The mapping, end to end

| You pass | Driver sends | Server accepts | You actually get |
|---|---|---|---|
| `TRANSACTION_READ_UNCOMMITTED` | `READ UNCOMMITTED` | yes | **Read Committed** |
| `TRANSACTION_READ_COMMITTED` | `READ COMMITTED` | yes | Read Committed |
| `TRANSACTION_REPEATABLE_READ` | `REPEATABLE READ` | yes | Repeatable Read (snapshot isolation) |
| `TRANSACTION_SERIALIZABLE` | `SERIALIZABLE` | yes | Serializable (SSI) |
| `TRANSACTION_NONE` | — | — | **throws** |

`TRANSACTION_NONE` is the one that fails, and it fails in the driver rather than
the server. It falls through the switch to `return null`, and pgJDBC raises:

```
Transaction isolation level 0 not supported.
```

with `PSQLState.NOT_IMPLEMENTED`. That is correct behaviour, and the javadoc
warns about it too — *"Note that `Connection.TRANSACTION_NONE` cannot be used
because it specifies that transactions are not supported."* But note the
asymmetry it creates: **the one constant that is meaningless throws loudly, and
the one constant that is misleading passes quietly.**

## What this means for portable code

If you write against several databases, the level is one of the few knobs with
identical syntax and non-identical meaning everywhere, and Read Uncommitted is
the worst case of it.

- On an engine that implements it, Read Uncommitted really does expose
  uncommitted data. Code that "works" there may be reading garbage that a
  rollback erases.
- On PostgreSQL, the same call gets you Read Committed, which is stronger.

So a codebase that migrated *to* PostgreSQL will find its Read Uncommitted paths
quietly become correct, and a codebase that migrates *away* will find them
quietly become wrong. Neither migration produces an error message.

⚠️ **The honest use of `TRANSACTION_READ_UNCOMMITTED` on PostgreSQL is: none.**
There is no case where it is preferable to writing `TRANSACTION_READ_COMMITTED`,
because the two are the same behaviour and only one of them describes it. If you
find it in a codebase, it is either copied from another engine's tuning advice or
it is somebody who wanted "fast reads" and picked the lowest-sounding constant.

`DatabaseMetaData.supportsTransactionIsolationLevel(int)` — which the javadoc
points you to — answers *"will this level be accepted?"*, not *"is this level
distinct?"*. On a database that maps two names onto one implementation, an
affirmative answer for both is not a contradiction. The metadata API has no way
to express "supported, but as an alias".

## The trade-off

There is no trade-off to reason about here, and that is the point worth taking
away. You are not choosing between four levels with four cost profiles. You are
choosing between **three**, and the fourth name buys nothing:

| Level | Distinct on PostgreSQL? | What it costs |
|---|---|---|
| Read Uncommitted | ❌ alias for the next row | nothing — you paid for Read Committed |
| Read Committed | ✅ the default | per-statement snapshot; read-modify-write races are yours to solve |
| Repeatable Read | ✅ | one snapshot per transaction; `40001` on write conflicts |
| Serializable | ✅ | predicate-lock tracking; `40001` from dependency cycles |

## Gotchas

**⚠️ Setting `TRANSACTION_READ_UNCOMMITTED` expecting faster reads**
**Symptom:** a "performance fix" that changes nothing measurable, and a code
comment claiming dirty reads are acceptable here.
**Cause:** the constant is accepted end to end and behaves as Read Committed.
There was never a cheaper mode to get.
**Fix:** delete the call. If reads are slow, the problem is the query, the plan
or the [fetch size](../01-jdbc/15-fetch-size-and-streaming.md) — not the level.

**⚠️ Asserting on `getTransactionIsolation()` in a test**
**Symptom:** a test asserting the connection is at `TRANSACTION_READ_UNCOMMITTED`
passes, and the reader concludes dirty reads are in play.
**Cause:** the value round-trips faithfully. `SHOW TRANSACTION ISOLATION LEVEL`
reports what was requested, and pgJDBC maps the string back to the constant.
**Fix:** the assertion is valid as a check that the `SET` reached the server, and
invalid as a check of semantics. Test the behaviour, not the setting.

**⚠️ Passing `TRANSACTION_NONE`**
**Symptom:** `Transaction isolation level 0 not supported.` from a config-driven
call site where the level came from a property file and defaulted to zero.
**Cause:** `TRANSACTION_NONE` means "transactions are not supported" and is not
a level you may request; the driver's switch returns `null` and it throws.
**Fix:** validate the configured value against the four real constants before
passing it, and fail at startup with a message naming the property.

**⚠️ Porting isolation advice from another engine's tuning guide**
**Symptom:** a runbook that recommends Read Uncommitted for reporting queries.
**Cause:** on lock-based engines that advice is real — it skips read locks and
stops reporting from blocking writers. PostgreSQL's readers never block writers
at any level, so the advice has no target.
**Fix:** for long reports, the PostgreSQL-shaped answer is
`SERIALIZABLE READ ONLY DEFERRABLE` or plain Repeatable Read, covered in
[chunk 11](11-read-only-transactions.md).

## Interview questions

**★ How many isolation levels does PostgreSQL implement, and how many can you
request?**
You can request four; three are implemented. Read Uncommitted is accepted and
behaves exactly as Read Committed. The manual gives the reason as an architectural
one: MVCC never mutates a row in place, so a reader selects a committed version
rather than reading through a lock, and there is no mechanism by which a dirty
read could occur. Read Uncommitted on a lock-based engine is a genuinely cheaper
mode because it skips a read lock; here there is no read lock to skip, so there
is nothing weaker to sell.

**★ What happens if a Java developer calls
`setTransactionIsolation(TRANSACTION_READ_UNCOMMITTED)`?**
Nothing visible, which is the problem. pgJDBC has a switch case for the constant
and turns it into the SQL keyword `READ UNCOMMITTED`, which the server accepts —
it is a documented keyword on the `SET TRANSACTION` page — and then treats as
Read Committed. No exception, no warning, no log line at anything above FINE. The
call site is left believing it opted into weaker isolation and it is running at
the default. The only constant that throws is `TRANSACTION_NONE`, which fails in
the driver with "Transaction isolation level 0 not supported."

**★ If you read the level back with `getTransactionIsolation()`, what do you
see?**
`TRANSACTION_READ_UNCOMMITTED`. The method is not a cached getter — pgJDBC runs
`SHOW TRANSACTION ISOLATION LEVEL` against the server and maps the returned
string back to a constant, and it has an explicit branch for `READ UNCOMMITTED`.
The server remembers the level you requested even though it does not behave
differently for it. So the round trip confirms the `SET` was delivered and tells
you nothing about semantics, which makes it a poor thing to assert on in a test
that is really about concurrency behaviour.

**★ Is PostgreSQL non-conformant for not implementing Read Uncommitted?**
No. The standard defines the lower levels by the phenomena they must *not*
allow, and describes only the minimum protection each level provides. Read
Uncommitted permits dirty reads; it does not require them. Providing something
stronger than the floor is explicitly allowed, and Table 13.1 in the manual
records it as "Allowed, but not in PG". The same licence is what lets PostgreSQL
forbid phantom reads at Repeatable Read.

**★ Should `TRANSACTION_READ_UNCOMMITTED` ever appear in a PostgreSQL codebase?**
No. It is behaviourally identical to `TRANSACTION_READ_COMMITTED` and only one of
the two names describes what you get, so the other is a comment that lies. If you
find it, it almost always arrived by one of two routes: copied from tuning advice
written for a lock-based engine, where Read Uncommitted really does avoid
blocking; or chosen by someone reaching for the lowest-sounding constant to make
reads faster. Neither reason survives contact with MVCC — readers never block
writers here at any level.

---

← Prev: [3 · What isolation means](03-what-isolation-actually-means.md) · Index: [Transactions at the JDBC level](README.md) · Next → [5 · Read Committed](05-read-committed-in-practice.md)
