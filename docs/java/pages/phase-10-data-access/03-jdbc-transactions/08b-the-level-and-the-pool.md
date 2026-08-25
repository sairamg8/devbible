---
title: "A pooled connection remembers the isolation level you set — and if you set it with SQL, the pool cannot undo it"
sidebar_label: "8b · The level and the pool"
sidebar_position: 13
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the HikariCP source for `ProxyConnection` and
> `PoolBase` ([github.com/brettwooldridge/HikariCP](https://github.com/brettwooldridge/HikariCP)),
> the pgJDBC 42.7.x source for `PgConnection`
> ([github.com/pgjdbc/pgjdbc](https://github.com/pgjdbc/pgjdbc)),
> and the PostgreSQL 18 `SET TRANSACTION` reference page
> ([postgresql.org/docs/18/sql-set-transaction.html](https://www.postgresql.org/docs/18/sql-set-transaction.html)).
> JDK 25, JDBC 4.3, PostgreSQL 18, pgjdbc 42.7.13, HikariCP 7.0.2. No sandbox:
> no console output, no timings.

**The isolation level is session state, and a pooled `close()` does not close the
session — it hands it to the next borrower with your settings intact. Pools deal
with this by tracking what you changed and putting it back, and HikariCP does it
with a six-bit dirty field. The catch is that the tracking works by intercepting
**method calls**. Set the level with `Connection.setTransactionIsolation()` and
the pool knows and resets it. Set the same level by executing
`SET SESSION CHARACTERISTICS` through a `Statement` and the pool sees a statement
like any other — no bit is set, nothing is reset, and every future borrower of that
physical connection inherits a level it never asked for.**

## The pool changes everything

A pooled `Connection` is a proxy. `close()` returns the underlying session to the
pool; it does not close a socket. So every piece of session state you changed —
autocommit, read-only, schema, **isolation level** — is still set when the next
borrower gets that session.

HikariCP tracks this with a bit field. From `ProxyConnection`:

```java
static final int DIRTY_BIT_READONLY   = 0b000001;
static final int DIRTY_BIT_AUTOCOMMIT = 0b000010;
static final int DIRTY_BIT_ISOLATION  = 0b000100;
static final int DIRTY_BIT_CATALOG    = 0b001000;
static final int DIRTY_BIT_NETTIMEOUT = 0b010000;
static final int DIRTY_BIT_SCHEMA     = 0b100000;
```

and its `setTransactionIsolation` override sets one:

```java
delegate.setTransactionIsolation(level);
transactionIsolation = level;
dirtyBits |= DIRTY_BIT_ISOLATION;
```

On return, `PoolBase.resetConnectionState` acts on it:

```java
if ((dirtyBits & DIRTY_BIT_ISOLATION) != 0
        && proxyConnection.getTransactionIsolationState() != transactionIsolation) {
   connection.setTransactionIsolation(transactionIsolation);
   resetBits |= DIRTY_BIT_ISOLATION;
}
```

Read the target of that reset carefully. `transactionIsolation` here is the
**pool's** configured value, initialised in `PoolBase`'s constructor from
`config.getTransactionIsolation()`. And when the pool has not been configured with
one, HikariCP adopts whatever the first connection reported:

```java
defaultTransactionIsolation = connection.getTransactionIsolation();
if (transactionIsolation == -1) {
   transactionIsolation = defaultTransactionIsolation;
}
```

🔴 **So the pool restores the level to the pool's value, not to "whatever it was
before you borrowed it".** Those are usually the same thing, and the difference
matters the moment anything else has moved the session default.

## The hole: raw SQL is invisible to the pool

This is the important consequence, and it is the reason this page spends so long
on the mechanism.

```java
// ⚠️ HikariCP never sees this. No dirty bit. No reset on return.
try (Statement s = c.createStatement()) {
    s.execute("SET SESSION CHARACTERISTICS AS TRANSACTION ISOLATION LEVEL SERIALIZABLE");
}
```

The pool's proxy intercepts **method calls**, not SQL. A `SET SESSION
CHARACTERISTICS` you execute yourself changes the session's default level, sets no
dirty bit, and survives `close()`. Every future borrower of that physical
connection runs at `SERIALIZABLE` until the connection is retired — and they will
get `40001` failures from code that never asked for the level and has no retry
path.

**The per-transaction `SET TRANSACTION` form does not have this problem**, because
its scope ends with the transaction. That is one more reason to prefer it.

⚠️ The same hole exists for anything else set by SQL rather than by a JDBC method:
`SET search_path`, `SET statement_timeout`, `SET application_name`. If the pool
did not see the method call, the pool cannot undo it.

## Gotchas
**⚠️ Using raw `SET SESSION CHARACTERISTICS` on a pooled connection**
**Symptom:** unrelated endpoints start failing at `40001`, hours later, on some
requests and not others.
**Cause:** the pool proxies method calls, not SQL. No dirty bit was set, so the
session default was never reset, and it leaks to every subsequent borrower of that
physical connection.
**Fix:** either call `setTransactionIsolation()` so the pool can track it, or use
the per-transaction `SET TRANSACTION` form, which cannot leak.

**⚠️ Setting the level on every borrow "to be safe"**
**Symptom:** an extra round trip on every single database operation in the
service.
**Cause:** `setTransactionIsolation` is not a local flag — pgJDBC sends a
statement. And if the value differs from the pool's, the pool sends another one on
return.
**Fix:** configure the pool's `transactionIsolation` once for the common case, and
change it in code only for the transactions that genuinely need something else.

**⚠️ Raising `default_transaction_isolation` server-wide to fix one endpoint**
**Symptom:** `40001` from every write path in the application, none of which has a
retry loop.
**Cause:** the level is a property of a transaction, and a global default applies
it to every transaction, including all the ones that were correct at Read
Committed.
**Fix:** set it per transaction. A server-wide change is appropriate only when the
whole application is designed for that level, retry path included.

## Interview questions
**★ What does a connection pool do to the isolation level?**
It makes it leak, unless something resets it. `close()` on a pooled connection
returns the session; it does not close it, so the isolation level you set is still
set for the next borrower. HikariCP handles this with a dirty-bit field — its
proxy's `setTransactionIsolation` sets `DIRTY_BIT_ISOLATION`, and on return
`resetConnectionState` calls `setTransactionIsolation` again with the pool's own
configured value if the current state differs. Note what that means: it restores
the level to the **pool's** value, adopted from the first connection when nothing
was configured, rather than to whatever it happened to be before your borrow.

**★ Why is changing the level with raw SQL more dangerous than calling the JDBC
method?**
Because the pool's proxy intercepts method calls, not SQL. If you execute
`SET SESSION CHARACTERISTICS AS TRANSACTION ISOLATION LEVEL SERIALIZABLE` through
a `Statement`, no dirty bit is set, nothing is reset on return, and the session
default stays changed for every future borrower of that physical connection. They
inherit a level they did not ask for, and they hit `40001` in code that has no
retry path — hours later, on some requests and not others, which makes it a
miserable thing to diagnose. The per-transaction `SET TRANSACTION` form is safe by
construction because its scope ends at commit. The same hazard applies to any
other session state set by SQL, such as `search_path` or `statement_timeout`.

**★ Where should the decision about isolation level live?**
With the unit of work, not with the application. A level is a property of what a
particular transaction needs: a report needs a whole-transaction snapshot, a
single-row update does not, and an invariant over a set may need Serializable.
Setting `default_transaction_isolation` server-wide, or configuring the pool to
something strict, applies the cost and the new failure mode to every transaction —
including all the ones that were correct at Read Committed and have no retry loop.
The reasonable arrangement is to leave the default at Read Committed, configure the
pool only if the whole service genuinely runs at one level, and raise it explicitly
and per transaction where it is needed.

---

← Prev: [8 · Setting the level](08-setting-the-level-from-java.md) · Index: [Transactions at the JDBC level](README.md) · Next → [9 · Savepoints](09-savepoints.md)
