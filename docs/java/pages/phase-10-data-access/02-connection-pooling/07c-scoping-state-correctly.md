---
title: "Every session-state leak has a fix, and they are all the same fix — put the state somewhere narrower than the session"
sidebar_label: "7c · Scoping state correctly"
sidebar_position: 20
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the PostgreSQL 18 documentation for `SET`,
> `SET LOCAL`, `ALTER ROLE`, `CREATE TABLE` (`ON COMMIT`) and the advisory-lock
> functions ([postgresql.org/docs/18/](https://www.postgresql.org/docs/18/)), the
> pgjdbc connection-parameter reference
> ([jdbc.postgresql.org/documentation/use/](https://jdbc.postgresql.org/documentation/use/)),
> and the HikariCP 7.0.2 README `connectionInitSql`
> ([github.com/brettwooldridge/HikariCP](https://github.com/brettwooldridge/HikariCP)).
> JDK 25, HikariCP 7.0.2, pgjdbc 42.7.13, PostgreSQL 18, Spring Boot 4.1.1.

**[Chunk 7b](07b-what-sql-leaves-behind.md) catalogued what survives a return to
the pool. Every entry has a mechanical fix, and they are all the same move: stop
putting state in the *session*, which the pool recycles, and put it somewhere the
pool cannot recycle. This chunk is the narrower of the two places — the
**transaction**, which ends before the connection goes back.
[Chunk 7d](07d-connection-level-defaults.md) is the other one, the connection's
creation, which the pool controls. There is a trap common to every
transaction-scoped fix, and it catches almost everybody, so it comes first.**

## 🔴 The trap: all the transaction-scoped fixes need a transaction

HikariCP's `autoCommit` defaults to **true**. With autocommit on, every statement
is its own implicit transaction that commits the moment it finishes. So:

| You write | With autocommit ON, what happens |
|---|---|
| `SET LOCAL statement_timeout = '5s'` | ⛔ a warning, and **no effect** — the transaction ends immediately |
| `SELECT pg_advisory_xact_lock(42)` | ⛔ the lock is acquired and **released one statement later** |
| `CREATE TEMP TABLE t (...) ON COMMIT DROP` | ⛔ the table is created and **dropped immediately** |

⛔ **Each of these fails silently in a way that looks like it worked.** The
statement succeeds, no exception is thrown, and the protection you thought you
added is simply absent.

**The precondition for all of them is an explicit transaction.** In Spring that
means inside a `@Transactional` method; in plain JDBC it means
`connection.setAutoCommit(false)` before the statement, and a `commit()` after
([topic 01 chunk 18](../01-jdbc/18-ownership-and-leaks.md)).

## Transaction scope

### `SET LOCAL` instead of `SET`

```java
@Transactional
public List<Row> runHeavyReport(LocalDate day) {
    jdbc.sql("SET LOCAL statement_timeout = '120s'").update();
    jdbc.sql("SET LOCAL work_mem = '256MB'").update();
    return jdbc.sql(REPORT_SQL).param(day).query(Row.class).list();
}
```

`SET LOCAL` reverts at the end of the transaction — on commit *and* on rollback —
so the connection returns to the pool with the pool's own values. It covers
almost every `SET` in the catalogue: `statement_timeout`, `lock_timeout`,
`work_mem`, `search_path`, `TIME ZONE`, `role`.

⚠️ **`SET LOCAL` is reverted at the end of the transaction that ran it** — which
is not always the transaction you think you are in. A nested call with
`Propagation.REQUIRES_NEW` suspends the outer transaction and starts a new one on
the *same* connection; a `SET LOCAL` issued inside the inner transaction reverts
when the inner one ends, not when the outer one does
([chunk 3b](03b-reducing-cm.md) has the propagation background).

⚠️ **`RESET statement_timeout` is not a substitute.** It undoes a `SET`, but it is
another statement that an exception can skip — the same failure that leaked the
setting in the first place. `SET LOCAL` reverts on the rollback path too, which is
the whole point.

To confirm a `SET LOCAL` is really in effect, read it back inside the same
transaction:

```sql
SELECT current_setting('statement_timeout');
```

### Transaction-scoped advisory locks

```sql
SELECT pg_advisory_xact_lock(hashtext('nightly-rollup'));
```

🔴 **`pg_advisory_xact_lock` should be the default choice on any pooled
connection.** It is released automatically when the transaction ends, including
on rollback and including when the application crashes mid-transaction. The
session-level `pg_advisory_lock` has none of those properties and requires a
matching `pg_advisory_unlock` that an exception can skip.

⚠️ **Use the `try` variant for "only one instance should run this".**
`pg_advisory_xact_lock` *waits* for the lock, so every instance of a scheduled job
queues up and runs the work one after another — which is usually the opposite of
the intent. `pg_try_advisory_xact_lock` returns `false` immediately if the lock is
held, so the losing instances skip the run:

```sql
SELECT pg_try_advisory_xact_lock(hashtext('nightly-rollup'));
```

```java
@Transactional
public void runIfLeader() {
    Boolean got = jdbc.sql("SELECT pg_try_advisory_xact_lock(hashtext('nightly-rollup'))")
                      .query(Boolean.class).single();
    if (!got) return;          // another instance has it — do nothing
    doTheWork();
}                              // lock released here, whatever happened
```

### `ON COMMIT DROP` temporary tables

```sql
CREATE TEMP TABLE staging (id bigint, payload jsonb) ON COMMIT DROP;
```

The table disappears at the end of the transaction, so the next borrower of that
connection sees no `42P07 duplicate_table`. `ON COMMIT DELETE ROWS` is the
variant that keeps the definition and empties it — useful when the table is
created once per connection and reused, and dangerous otherwise, since the
definition still leaks.

## What Spring already does correctly

- **`@Transactional(isolation = ...)`** goes through
  `Connection.setTransactionIsolation()`, so HikariCP tracks the ISOLATION bit and
  restores the pool's value on return.
- **`@Transactional(readOnly = true)`** goes through `setReadOnly()` — tracked the
  same way.
- **`@Transactional(timeout = ...)`** applies a *statement* timeout to each
  statement in the transaction rather than a session `SET`, so it leaves no
  session footprint. How that timeout actually reaches the server is
  [topic 01 chunk 22f](../01-jdbc/22f-how-cancellation-works.md).

⚠️ That is a practical argument for using the annotation's attributes instead of
hand-written SQL: the framework is on the safe side of the tracked/untracked
boundary, and you inherit the reset for free.

## The trade-off

Transaction scope is the right answer and it is not free. `SET LOCAL` requires an
explicit transaction, so read-only work that would happily run in autocommit now
opens and commits one — a small extra round trip, and a transaction ID on the
server. `ON COMMIT DROP` means a temp table cannot be reused across transactions,
so a multi-phase job has to be one transaction or use a real table.
`pg_advisory_xact_lock` cannot hold a lock across transactions, which is
occasionally exactly what a job wants. In each case the narrower scope costs some
expressiveness, and buys the guarantee that nothing survives into a stranger's
request.

## Gotchas

**⚠️ `SET LOCAL` with autocommit on**
**Symptom:** the setting appears to be applied and has no effect; a warning
appears in the PostgreSQL log.
**Cause:** the implicit transaction ends with that statement.
**Fix:** wrap the work in `@Transactional`, or `setAutoCommit(false)` explicitly.

**⚠️ `pg_advisory_xact_lock` with autocommit on**
**Symptom:** two jobs run concurrently despite the lock.
**Cause:** the lock is released one statement after it is taken.
**Fix:** the same — an explicit transaction is the precondition.

**⚠️ `ON COMMIT DROP` with autocommit on**
**Symptom:** `relation "staging" does not exist` on the very next statement.
**Cause:** the `CREATE`'s own implicit transaction committed and dropped it.
**Fix:** the same again. All three share this precondition.

**⚠️ `pg_advisory_xact_lock` used for leader election**
**Symptom:** every instance runs the job, just one after another instead of
simultaneously.
**Cause:** the blocking variant waits for the lock rather than declining.
**Fix:** `pg_try_advisory_xact_lock`, and return early when it is `false`.

**⚠️ `SET LOCAL` inside a `REQUIRES_NEW` inner transaction**
**Symptom:** a setting intended for the whole operation disappears part way
through.
**Cause:** it reverts when the *inner* transaction ends, not the outer one.
**Fix:** issue it in the transaction whose scope you actually mean, and remember
that suspending a transaction does not suspend the connection's session state.

**⚠️ Using `RESET` to undo a `SET`**
**Symptom:** the setting leaks whenever an exception is thrown.
**Cause:** `RESET` is another statement on the happy path.
**Fix:** `SET LOCAL`, which reverts on rollback as well as commit.

**⚠️ Assuming `@Transactional(timeout = n)` sets `statement_timeout`**
**Symptom:** confusion when `current_setting('statement_timeout')` shows the
role's value instead.
**Cause:** Spring applies a per-statement JDBC query timeout, not a session
setting.
**Fix:** nothing is broken — it is the safer of the two mechanisms, precisely
because it has no session footprint.

**⚠️ `SET LOCAL search_path` for tenants**
**Symptom:** safer than plain `SET`, and still wrong on any path that forgets it.
**Cause:** transaction scope fixes the *leak*, not the *omission* — a request that
never sets it uses the pool's default schema.
**Fix:** fully qualified names, `connection.setSchema()`, or a pool per tenant.
Transaction scope alone still leaves a code path that silently reads the wrong
schema.

## Interview questions

**★ What is the general fix for pooled session-state leakage?**
Narrow the scope. Anything session-scoped is dangerous on a pooled connection,
because the pool recycles sessions; anything transaction-scoped is safe, because
the transaction ends before the connection is returned; and anything set at
connection creation is safe, because the pool controls creation. So `SET` becomes
`SET LOCAL`, `pg_advisory_lock` becomes `pg_advisory_xact_lock`, a temp table
gains `ON COMMIT DROP`, and a service-wide default moves to `ALTER ROLE ... SET`.
Every entry in the leak catalogue maps onto one of those three moves.

**★ What is the precondition every transaction-scoped fix shares?**
An actual transaction — and HikariCP defaults `autoCommit` to true, so there
often is not one. With autocommit on, each statement is its own implicit
transaction that commits immediately, so `SET LOCAL` has no effect and emits a
warning, `pg_advisory_xact_lock` releases the lock one statement later, and a
temp table declared `ON COMMIT DROP` is dropped the instant it is created. All
three fail silently in a way that looks successful, which makes this the single
most important thing to know about the fixes. In Spring the precondition is
satisfied by putting the work inside a `@Transactional` method.

**★ How would you verify a `SET LOCAL` actually took effect?**
Read it back inside the same transaction with
`SELECT current_setting('<parameter>')`. This matters more than it sounds,
because the failure mode when it did *not* take effect — autocommit was on, so
the implicit transaction had already ended — produces no exception and no visible
difference except a warning in the PostgreSQL server log, which most application
developers never see. A single read-back in a test that runs inside a real
transaction is enough to prove the mechanism works in your configuration.

**★ Which lock function would you use on a pooled connection, and why?**
`pg_advisory_xact_lock`. It is released automatically when the transaction ends,
on commit and on rollback, and even if the application dies mid-transaction —
none of which is true of `pg_advisory_lock`, whose session scope means an
exception between acquire and unlock leaves the lock held on a connection that
then returns to the pool, looking idle, blocking every future acquirer until
something eventually retires the connection. The only reason to want the
session-level variant is a lock that must span transactions, and that is a
requirement worth re-examining before satisfying it on a pooled connection.

**★ What does Spring already get right here?**
The `@Transactional` attributes go through the tracked JDBC API rather than
through SQL. `isolation` becomes `Connection.setTransactionIsolation()` and
`readOnly` becomes `setReadOnly()` — both flip one of HikariCP's six dirty bits
and are therefore restored on return. `timeout` is applied as a per-statement
JDBC query timeout rather than a session `SET`, so it leaves no session footprint
at all. That is a concrete argument for using the annotation's attributes instead
of hand-rolling the equivalent SQL: the framework sits on the safe side of the
tracked/untracked boundary and you inherit the reset.

**★ Is `SET LOCAL search_path` enough for schema-per-tenant?**
It fixes the leak but not the whole problem. Transaction scope guarantees the
setting does not survive into another request, which removes the cross-tenant
exposure caused by *leftover* state. It does nothing about the code path that
never sets the search path at all — that path still runs against whatever the
pool's default schema is, silently and with no error. So the robust answers are
fully qualified table names, `connection.setSchema()` with the pool's own default
as a safe fallback, or a pool per tenant. Scope narrowing removes one failure
mode; it does not make an implicit resolution mechanism explicit.

---

← Prev: [7b · What SQL leaves behind](07b-what-sql-leaves-behind.md) · Index: [Connection pooling with HikariCP](README.md) · Next → [7d · Connection-level defaults](07d-connection-level-defaults.md)
