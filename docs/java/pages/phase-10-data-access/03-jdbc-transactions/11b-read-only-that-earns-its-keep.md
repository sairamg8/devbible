---
title: "READ ONLY is close to free at REPEATABLE READ and a real performance instruction at SERIALIZABLE"
sidebar_label: "11b · Read-only that earns its keep"
sidebar_position: 19
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the PostgreSQL 18 manual §13.2 *Transaction Isolation*,
> including the predicate-locking and performance-recommendation paragraphs
> ([postgresql.org/docs/18/transaction-iso.html](https://www.postgresql.org/docs/18/transaction-iso.html)),
> the `SET TRANSACTION` reference page
> ([postgresql.org/docs/18/sql-set-transaction.html](https://www.postgresql.org/docs/18/sql-set-transaction.html)),
> and the HikariCP source for `ProxyConnection` and `PoolBase`
> ([github.com/brettwooldridge/HikariCP](https://github.com/brettwooldridge/HikariCP)).
> JDK 25, JDBC 4.3, PostgreSQL 18, pgjdbc 42.7.13, HikariCP 7.0.2. No sandbox:
> no console output, no timings.

**[Chunk 11](11-read-only-transactions.md) established that `setReadOnly` may or
may not reach the server. This chunk is about the case where it is worth making
sure it does. At `SERIALIZABLE`, declaring a transaction read-only is the manual's
**first** performance recommendation, because such a transaction can often avoid
taking predicate locks at all — and a transaction with no predicate locks cannot be
part of a dependency cycle, so it neither gets aborted nor causes anyone else to
be. The flag also lives in the pool's dirty-bit field, with exactly the same blind
spot the isolation level has: the pool can only undo what it saw as a method
call.**

## Where it genuinely earns its keep: Serializable

At `SERIALIZABLE`, declaring a transaction read-only is not documentation — it is a
performance instruction, and the manual's optimisation list puts it first: *"Declare
transactions `READ ONLY` when possible."*

The reason is in the predicate-locking paragraph: *"A `READ ONLY` transaction may
be able to release its SIRead locks before completion, if it detects that no
conflicts can still occur which could lead to a serialization anomaly. In fact,
`READ ONLY` transactions will often be able to establish that fact at startup and
avoid taking any predicate locks."*

**Fewer predicate locks means fewer detected dependencies means fewer `40001`
aborts — for everyone, not just for you.** A read-only Serializable transaction
that takes no predicate locks cannot participate in a cycle at all.

And the strongest form, `SERIALIZABLE READ ONLY DEFERRABLE`, is the only
configuration in which a Serializable transaction cannot be aborted at all —
[chunk 7c](07c-deferrable-and-the-limits.md).

At Repeatable Read the benefit is different and smaller: the manual notes that
read-only transactions never have serialization conflicts there anyway, so
declaring it buys enforcement and intent rather than a change in behaviour.

## The pool remembers this too

`READONLY` is one of HikariCP's six dirty bits:

```java
static final int DIRTY_BIT_READONLY   = 0b000001;
```

Its proxy sets the bit when you call the method:

```java
delegate.setReadOnly(readOnly);
isReadOnly = readOnly;
dirtyBits |= DIRTY_BIT_READONLY;
```

and on return the pool restores its own configured value:

```java
if ((dirtyBits & DIRTY_BIT_READONLY) != 0
        && proxyConnection.getReadOnlyState() != isReadOnly) {
   connection.setReadOnly(isReadOnly);
}
```

where `isReadOnly` came from `config.isReadOnly()` in `PoolBase`'s constructor.

⚠️ **Same hole as the isolation level.** The reset works because the pool
intercepted a *method call*. Issue `SET SESSION CHARACTERISTICS AS TRANSACTION
READ ONLY` through a `Statement` and no bit is set, nothing is restored, and the
next borrower of that physical connection gets `25006` on its first write.

## Three ways to declare it, and which to use

| Form | Scope | Enforced? |
|---|---|---|
| `Connection.setReadOnly(true)` | depends on `readOnlyMode` and autocommit | ⚠️ sometimes |
| `BEGIN TRANSACTION READ ONLY` / `SET TRANSACTION READ ONLY` | this transaction | ✅ always |
| `default_transaction_read_only = on` | every transaction, session or server-wide | ✅ always |

**Prefer the SQL form when it matters.** `setReadOnly` is the portable, poolable
option and is the right default for expressing intent; explicit
`BEGIN TRANSACTION READ ONLY` is the one that cannot be silently a no-op, and it
is also the only way to attach `DEFERRABLE`, for which JDBC has no API at all.

## The trade-off

| You gain | You pay |
|---|---|
| The server refuses accidental writes with `25006` | only for the commands on the list — it is not physical read-only |
| At Serializable, often no predicate locks and no aborts | nothing; this one is close to free |
| `DEFERRABLE` reports that can never be aborted | an unbounded wait at the start |
| A clear, greppable statement of intent | `setReadOnly` may be doing nothing, depending on config you did not write |
| The pool can reset it for you | only if you used the method, not raw SQL |

## Gotchas
**⚠️ Setting read-only with raw SQL on a pooled connection**
**Symptom:** an unrelated request later fails at `25006`,
`read_only_sql_transaction`, on a perfectly ordinary `INSERT`.
**Cause:** `SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY` executed through
a `Statement` is invisible to the pool's dirty-bit tracking, so it is never reset
and leaks to the next borrower.
**Fix:** use `setReadOnly()` so the pool can track it, or the per-transaction
`BEGIN TRANSACTION READ ONLY` form, which cannot leak.

**⚠️ Not declaring read-only on a Serializable report**
**Symptom:** a long reporting transaction at `SERIALIZABLE` gets aborted at
`40001` after running for a while, and drives up other transactions' abort rates
too.
**Cause:** without the declaration it takes predicate locks like any other
transaction and participates in dependency cycles. The manual's first optimisation
recommendation is to declare read-only transactions read-only.
**Fix:** declare it, and consider `DEFERRABLE` if being aborted is unacceptable.

## Interview questions
**★ When does declaring read-only actually change performance?**
At `SERIALIZABLE`, materially. The manual's first performance recommendation for
that level is to declare transactions `READ ONLY` when possible, because a
read-only transaction may release its SIRead predicate locks early and "will often
be able to establish that fact at startup and avoid taking any predicate locks" at
all. Taking no predicate locks means it cannot participate in a read/write
dependency cycle, so it neither gets aborted nor causes anyone else to be. At
Repeatable Read the benefit is smaller — read-only transactions never have
serialization conflicts there anyway — so the declaration buys enforcement and
intent rather than a behaviour change.

**★ How does a connection pool handle the read-only flag?**
The same way it handles the isolation level, and with the same blind spot.
`READONLY` is HikariCP's first dirty bit; the proxy sets it when
`setReadOnly` is called, and on return `resetConnectionState` calls `setReadOnly`
again with the pool's own configured value if the state differs. That works only
because the pool saw a method call. If you set read-only by executing
`SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY` through a `Statement`, no
bit is set, nothing is reset, and the next borrower of that physical connection
gets `25006` on an ordinary insert — a failure that appears in unrelated code,
long after the transaction that caused it finished.

**★ Which of the three ways of declaring read-only would you actually use?**
`Connection.setReadOnly(true)` for the ordinary case, because it is portable, and
because the pool can track and reset it — which the SQL forms cannot be tracked.
Explicit `BEGIN TRANSACTION READ ONLY` when it has to be enforced with certainty,
since `setReadOnly` can be a silent no-op depending on `readOnlyMode` and
autocommit, and because it is the only route to `DEFERRABLE`, for which JDBC has no
API. `default_transaction_read_only` at the database or role level when an entire
role is genuinely a reader — an analytics login, for example — where making it
impossible to forget is worth more than per-transaction control.

**★ A read-only report at SERIALIZABLE keeps getting aborted. What do you change?**
First check the declaration actually reached the server — at pgJDBC's default
`readOnlyMode`, `setReadOnly(true)` sends nothing unless autocommit is off, so a
report that never turns autocommit off is not read-only as far as PostgreSQL is
concerned. Once it is genuinely declared, the transaction can often avoid predicate
locks entirely and stop participating in cycles. If aborts still happen and are
unacceptable, escalate to `SERIALIZABLE READ ONLY DEFERRABLE`, which cannot be
aborted at all — at the cost of an unbounded wait before it starts reading. And if
the report does not actually need serializable semantics, Repeatable Read gives a
whole-transaction snapshot with no serialization conflicts for a read-only
transaction in the first place.

---

← Prev: [11 · Read-only transactions](11-read-only-transactions.md) · Index: [Transactions at the JDBC level](README.md) · Next → [12 · Row locks and FOR UPDATE](12-locking-and-select-for-update.md)
