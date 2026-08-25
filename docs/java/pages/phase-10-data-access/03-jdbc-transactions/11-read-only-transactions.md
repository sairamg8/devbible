---
title: "setReadOnly is a hint in the JDBC spec and an enforced restriction on the server, and pgJDBC decides which one you get"
sidebar_label: "11 · Read-only transactions"
sidebar_position: 18
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the JDK 25 API for `java.sql.Connection`
> ([docs.oracle.com/en/java/javase/25/docs/api/java.sql/java/sql/Connection.html](https://docs.oracle.com/en/java/javase/25/docs/api/java.sql/java/sql/Connection.html)),
> the PostgreSQL 18 `SET TRANSACTION` reference page
> ([postgresql.org/docs/18/sql-set-transaction.html](https://www.postgresql.org/docs/18/sql-set-transaction.html)),
> §13.2.3 *Serializable Isolation Level*
> ([postgresql.org/docs/18/transaction-iso.html](https://www.postgresql.org/docs/18/transaction-iso.html)),
> Appendix A *Error Codes*
> ([postgresql.org/docs/18/errcodes-appendix.html](https://www.postgresql.org/docs/18/errcodes-appendix.html)),
> the pgJDBC 42.7.x source for `PgConnection` and its connection-parameter
> documentation ([github.com/pgjdbc/pgjdbc](https://github.com/pgjdbc/pgjdbc),
> [jdbc.postgresql.org/documentation/use/](https://jdbc.postgresql.org/documentation/use/)),
> and the HikariCP source for `ProxyConnection` and `PoolBase`
> ([github.com/brettwooldridge/HikariCP](https://github.com/brettwooldridge/HikariCP)).
> JDK 25, JDBC 4.3, PostgreSQL 18, pgjdbc 42.7.13, HikariCP 7.0.2. No sandbox:
> no console output, no timings.

**The JDBC javadoc calls `setReadOnly` *"a hint to the driver to enable database
optimizations"*. PostgreSQL's `READ ONLY` is not a hint at all — it refuses a
named list of commands outright, with SQLSTATE `25006`. Both statements are true,
and the bridge between them is a pgJDBC connection parameter most people have
never set: `readOnlyMode`, which decides whether `setReadOnly(true)` sends
anything to the server, and when. So "we marked it read-only" can mean full server
enforcement, or a Java boolean that does nothing, depending on configuration you
did not write.**

## What PostgreSQL enforces, exactly

The `SET TRANSACTION` reference page, word for word:

> When a transaction is read-only, the following SQL commands are disallowed:
> `INSERT`, `UPDATE`, `DELETE`, `MERGE`, and `COPY FROM` if the table they would
> write to is not a temporary table; all `CREATE`, `ALTER`, and `DROP` commands;
> `COMMENT`, `GRANT`, `REVOKE`, `TRUNCATE`; and `EXPLAIN ANALYZE` and `EXECUTE` if
> the command they would execute is among those listed. **This is a high-level
> notion of read-only that does not prevent all writes to disk.**

Three things in there catch people.

🔴 **Temporary tables are exempt.** The clause *"if the table they would write to
is not a temporary table"* attaches to the whole list of `INSERT`, `UPDATE`,
`DELETE`, `MERGE` and `COPY FROM`. A read-only transaction can freely populate a
temp table — which is exactly what a complex report often needs, and is a good
reason the restriction is drawn where it is.

🔴 **`EXPLAIN ANALYZE` is conditional, not banned.** `EXPLAIN ANALYZE SELECT ...`
is fine; `EXPLAIN ANALYZE UPDATE ...` is not, because `EXPLAIN ANALYZE` actually
runs the statement. The rule is about what the command *would execute*.

🔴 **"Does not prevent all writes to disk."** The manual says so itself. A
read-only transaction still writes WAL for things like temp table activity, still
causes hint-bit updates and page writes as a side effect of reading, and can still
call a function that writes. **`READ ONLY` is a statement-level restriction, not a
guarantee of physical read-only behaviour.** If you need the latter — for a
replica, or for safety against a rogue function — it is not the mechanism.

A violation raises SQLSTATE `25006`, `read_only_sql_transaction`, in class 25,
Invalid Transaction State.

## What `setReadOnly` does in pgJDBC

The javadoc's two constraints first: it is *"a hint to the driver"*, and 🔴 **"This
method cannot be called during a transaction."** — that is a stronger statement
than `setTransactionIsolation`'s "the result is implementation-defined", and
pgJDBC enforces it:

```java
public void setReadOnly(boolean readOnly) throws SQLException {
  checkClosed();
  if (queryExecutor.getTransactionState() != TransactionState.IDLE) {
    throw new PSQLException(
        GT.tr("Cannot change transaction read-only property in the middle of a transaction."),
        PSQLState.ACTIVE_SQL_TRANSACTION);
  }

  if (readOnly != this.readOnly && autoCommit
        && this.readOnlyBehavior == ReadOnlyBehavior.always) {
    execSQLUpdate(readOnly ? setSessionReadOnly : setSessionNotReadOnly);
  }

  this.readOnly = readOnly;
}
```

⚠️ **Look at how narrow that `if` is.** SQL is sent only when the value actually
changes, **and** autocommit is on, **and** `readOnlyBehavior` is `always`. In every
other case `setReadOnly` sets a local Java field and sends nothing — which is
precisely the javadoc's "hint", and it is the default path.

## `readOnlyMode`, the parameter that decides the meaning

pgJDBC's documented values, with its own words:

| `readOnlyMode` | Behaviour |
|---|---|
| `ignore` | *"the readOnly setting has no effect."* |
| `transaction` **(default)** | *"readOnly is set to true and autocommit is false the driver will set the transaction to readonly by sending `BEGIN READ ONLY`."* |
| `always` | *"the session will be set to `READ ONLY` if autoCommit is true. If autocommit is false the driver will set the transaction to read only by sending `BEGIN READ ONLY`."* |

The driver's own enum matches:

```java
private enum ReadOnlyBehavior { ignore, transaction, always }
```

and it defaults to `transaction`, including when the property has an unparseable
value:

```java
private static ReadOnlyBehavior getReadOnlyBehavior(@Nullable String property) {
  if (property == null) {
    return ReadOnlyBehavior.transaction;
  }
  try {
    return ReadOnlyBehavior.valueOf(property);
  } catch (IllegalArgumentException e) {
    try {
      return ReadOnlyBehavior.valueOf(property.toLowerCase(Locale.US));
    } catch (IllegalArgumentException e2) {
      return ReadOnlyBehavior.transaction;
    }
  }
}
```

So the practical matrix, on the default setting:

| Autocommit | `setReadOnly(true)` does | Enforced by the server? |
|---|---|---|
| **off** | the driver's next `BEGIN` becomes `BEGIN READ ONLY` | ✅ yes, for that transaction |
| **on** | sets a Java field, sends nothing | ❌ no |

🔴 **`setReadOnly(true)` on an autocommit connection, at the default
`readOnlyMode`, gives you no protection whatsoever.** It is a genuine hint and
nothing more. If your read path never turns autocommit off — and many do not,
because they only run `SELECT`s — then the flag you set to document intent is
doing exactly that and no more.

⚠️ Note also that the two SQL strings for `always` mode are
`SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY` and `... READ WRITE` —
**session** scope, with the same leak-to-the-next-borrower shape as the isolation
level in [chunk 8b](08b-the-level-and-the-pool.md).

## Gotchas
**⚠️ `setReadOnly(true)` on an autocommit connection**
**Symptom:** a "read-only" code path performs a write successfully, and nobody
notices until it is in production data.
**Cause:** at the default `readOnlyMode=transaction`, the driver only sends
`BEGIN READ ONLY` when autocommit is off. With autocommit on it sets a Java field
and nothing else.
**Fix:** turn autocommit off for the read transaction, or set
`readOnlyMode=always`, or issue `BEGIN TRANSACTION READ ONLY` yourself.

**⚠️ `setReadOnly` after the transaction has started**
**Symptom:** `Cannot change transaction read-only property in the middle of a
transaction.`, SQLSTATE `25001`.
**Cause:** the javadoc says the method "cannot be called during a transaction", and
pgJDBC enforces it whenever its transaction state is not `IDLE`.
**Fix:** call it before the first statement — the same ordering rule as
`setTransactionIsolation`, [chunk 8](08-setting-the-level-from-java.md).

**⚠️ Expecting `READ ONLY` to prevent all writes**
**Symptom:** a read-only transaction is used as a safety mechanism against a
function with side effects, and the side effects happen.
**Cause:** the manual is explicit — "this is a high-level notion of read-only that
does not prevent all writes to disk". It disallows a named list of commands.
**Fix:** for real write prevention, use privileges, a read-only role, or a physical
replica. `READ ONLY` documents and guards; it does not seal.

**⚠️ Assuming a read-only transaction cannot write to a temp table**
**Symptom:** a report that stages intermediate results in a temp table is
"fixed" by dropping the read-only declaration, unnecessarily.
**Cause:** temp tables are explicitly exempt — the disallowed list applies only
"if the table they would write to is not a temporary table".
**Fix:** keep the declaration. Staging into temp tables is a supported pattern
inside a read-only transaction.

**⚠️ Reading `isReadOnly()` as proof of enforcement**
**Symptom:** a test or health check asserts `connection.isReadOnly()` and concludes
writes are impossible.
**Cause:** pgJDBC's `isReadOnly` returns the local field — it does not ask the
server, and the field is set even on the paths where no SQL was sent.
**Fix:** it tells you what was requested, not what is enforced. Test by attempting
a write and expecting `25006`.

## Interview questions
**★ Is `Connection.setReadOnly(true)` enforced?**
It depends, which is the honest and unsatisfying answer. The JDBC javadoc calls it
"a hint to the driver to enable database optimizations", so the specification does
not require enforcement at all. pgJDBC's behaviour is governed by the
`readOnlyMode` connection parameter: at the default `transaction`, the driver sends
`BEGIN READ ONLY` when autocommit is off — genuine server enforcement for that
transaction — but sends nothing when autocommit is on, so the flag is only a Java
field. At `always` it will also set the session read-only when autocommit is on,
and at `ignore` it does nothing ever. So the same line of Java means different
things depending on configuration.

**★ What does PostgreSQL actually disallow in a read-only transaction?**
A named list: `INSERT`, `UPDATE`, `DELETE`, `MERGE` and `COPY FROM` if the target
is not a temporary table; all `CREATE`, `ALTER` and `DROP`; `COMMENT`, `GRANT`,
`REVOKE`, `TRUNCATE`; and `EXPLAIN ANALYZE` or `EXECUTE` when the command they
would run is on the list. Violations raise SQLSTATE `25006`,
`read_only_sql_transaction`. Two consequences worth naming: writes to temporary
tables are permitted, which makes staging in a report legal; and the manual closes
the paragraph by saying this "is a high-level notion of read-only that does not
prevent all writes to disk", so it is a command restriction, not a guarantee about
physical I/O.

**★ Why can't you call `setReadOnly` in the middle of a transaction?**
Because the access mode is a property of the transaction, so changing it partway
would mean the same transaction had two different sets of rules. The JDBC javadoc
states it as a hard constraint — "this method cannot be called during a
transaction" — which is notably stronger than the equivalent note on
`setTransactionIsolation`, where the result is merely "implementation-defined".
pgJDBC enforces it by checking its transaction state and throwing
`Cannot change transaction read-only property in the middle of a transaction.`
with SQLSTATE `25001`. The practical rule is the same for both settings: configure
the connection, then run the first statement.

**★ If you needed a genuinely read-only database session, would `READ ONLY` be
enough?**
No. It disallows a specific set of commands and the manual says plainly that it
"does not prevent all writes to disk" — reads still cause hint-bit and page
writes, temp table activity still generates WAL, and a function called from a
`SELECT` can still have side effects. If the requirement is real isolation from
writes, the tools are privileges and roles, a database or role-level
`default_transaction_read_only`, or a physical read replica. `READ ONLY` is
excellent at what it is: a cheap, enforced guard against a code path writing when
it was not meant to, and at Serializable a genuine performance instruction.

---

← Prev: [10b · autosave](10b-autosave.md) · Index: [Transactions at the JDBC level](README.md) · Next → [11b · Read-only that earns its keep](11b-read-only-that-earns-its-keep.md)
