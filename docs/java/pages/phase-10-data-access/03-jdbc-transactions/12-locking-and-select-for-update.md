---
title: "SELECT FOR UPDATE closes the read-modify-write race by making the read itself a lock — and there are four strengths, not one"
sidebar_label: "12 · Row locks and FOR UPDATE"
sidebar_position: 20
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the PostgreSQL 18 manual §13.3.2 *Row-Level Locks*,
> including Table 13.3
> ([postgresql.org/docs/18/explicit-locking.html](https://www.postgresql.org/docs/18/explicit-locking.html)),
> the `SELECT` reference page's *The Locking Clause*
> ([postgresql.org/docs/18/sql-select.html](https://www.postgresql.org/docs/18/sql-select.html)),
> and §13.2 *Transaction Isolation*
> ([postgresql.org/docs/18/transaction-iso.html](https://www.postgresql.org/docs/18/transaction-iso.html)).
> JDK 25, JDBC 4.3, PostgreSQL 18, pgjdbc 42.7.13. No sandbox: no console
> output, no timings.

**[Chunk 5](05-read-committed-in-practice.md) left one case unsolved: a
read-modify-write where the computation genuinely has to happen in Java. The fix
is to make the read take a lock, so nobody can change the row between reading it
and writing it back. That is `SELECT ... FOR UPDATE`, and the important thing
about it is what it does *not* block. The manual: *"Row-level locks do not affect
data querying; they block only writers and lockers to the same row."* A plain
`SELECT` sails past a locked row and reads the old version, because MVCC does not
need the lock. So `FOR UPDATE` protects you from other people who also take the
lock — which makes it a protocol every writer must agree to, not a wall around the
row.**

## The idiom, first

```java
// ✅ the read takes the lock; nobody can change the row before the write
c.setAutoCommit(false);

BigDecimal balance;
try (PreparedStatement ps = c.prepareStatement(
        "SELECT balance FROM accounts WHERE id = ? FOR UPDATE")) {
    ps.setLong(1, accountId);
    try (ResultSet rs = ps.executeQuery()) {
        if (!rs.next()) throw new NoSuchAccount(accountId);
        balance = rs.getBigDecimal("balance");
    }
}

BigDecimal updated = policy.applyComplexRules(balance);   // genuinely needs Java

try (PreparedStatement ps = c.prepareStatement(
        "UPDATE accounts SET balance = ? WHERE id = ?")) {
    ps.setBigDecimal(1, updated);
    ps.setLong(2, accountId);
    ps.executeUpdate();
}
c.commit();          // ← the lock is held until here
```

The lock is taken by the `SELECT` and released **only when the transaction ends**.
Everything between those two points is inside the critical section, including the
Java. That is the whole cost model: **the length of your Java is the length of the
lock.**

⚠️ **Prefer the single statement when you can.** `UPDATE ... SET balance = balance
- ?` is cheaper and shorter than this, and needs no lock reasoning at all. Reach
for `FOR UPDATE` when the computation cannot be expressed in SQL — a rules engine,
an external rate, branching logic — not as a default.

## Four strengths, and why there are four

The manual defines each mode by what it blocks. Paraphrased tightly, with its own
words for the definitions:

**`FOR UPDATE`** — the strongest. *"Causes the rows retrieved by the `SELECT`
statement to be locked as though for update. This prevents them from being locked,
modified or deleted by other transactions until the current transaction ends."* It
blocks every other row lock mode.

**`FOR NO KEY UPDATE`** — *"Behaves similarly to `FOR UPDATE`, except that the lock
acquired is weaker: this lock will not block `SELECT FOR KEY SHARE` commands."*

**`FOR SHARE`** — *"Behaves similarly to `FOR NO KEY UPDATE`, except that it
acquires a shared lock rather than exclusive lock on each retrieved row."* Several
transactions can hold it at once; writers are blocked.

**`FOR KEY SHARE`** — the weakest. *"`SELECT FOR UPDATE` is blocked, but not
`SELECT FOR NO KEY UPDATE`. A key-shared lock blocks other transactions from
performing `DELETE` or any `UPDATE` that changes the key values, but not other
`UPDATE`."*

Table 13.3, `X` meaning the requested mode conflicts with the held mode:

| Requested ↓ / Held → | FOR KEY SHARE | FOR SHARE | FOR NO KEY UPDATE | FOR UPDATE |
|---|---|---|---|---|
| **FOR KEY SHARE** | | | | X |
| **FOR SHARE** | | | X | X |
| **FOR NO KEY UPDATE** | | X | X | X |
| **FOR UPDATE** | X | X | X | X |

🔴 **The "key" in two of the names is about foreign keys, and that is why four
modes exist rather than two.** The manual ties the strongest mode to key columns
directly: *"The `FOR UPDATE` lock mode is also acquired by any `DELETE` on a row,
and also by an `UPDATE` that modifies the values of certain columns. Currently, the
set of columns considered for the `UPDATE` case are those that have a unique index
on them that can be used in a foreign key."* Everything else — *"any `UPDATE` that
does not acquire a `FOR UPDATE` lock"* — takes the weaker `FOR NO KEY UPDATE`.

The consequence is the useful part: **updating a parent row's ordinary columns does
not block work that only depends on its key staying put.** Without the split, every
update to a customer's name would block every insert of an order referencing that
customer.

## You are usually taking these locks without asking

Two of the four modes are acquired implicitly by ordinary DML:

| Statement | Lock taken |
|---|---|
| `DELETE` | `FOR UPDATE` |
| `UPDATE` touching a key column | `FOR UPDATE` |
| `UPDATE` touching only other columns | `FOR NO KEY UPDATE` |

So an application that never writes `FOR UPDATE` is still taking row locks
constantly, and is still capable of deadlocking — which is
[chunk 13](13-deadlocks-and-timeouts.md)'s subject.

## What a lock costs, and what it does not

**No count limit.** *"PostgreSQL doesn't remember any information about modified
rows in memory, so there is no limit on the number of rows locked at one time."*
You cannot exhaust a lock table by locking too many rows — unlike engines that
escalate row locks to table locks under pressure.

**But it is a write.** *"However, locking a row might cause a disk write, e.g.,
`SELECT FOR UPDATE` modifies selected rows to mark them locked, and so will result
in disk writes."*

🔴 **That sentence deserves attention: `SELECT ... FOR UPDATE` is a `SELECT` that
writes.** It generates I/O and WAL for every row it locks. `SELECT * FROM orders
FOR UPDATE` on a large table is not a read; it is a full-table modification with a
misleading keyword. It also means a locking `SELECT` is one of the things
`READ ONLY` will not save you from performing.

**And readers are unaffected.** *"Row-level locks do not affect data querying; they
block only writers and lockers to the same row."* A plain `SELECT` of a locked row
returns immediately with the last committed version. That is not a loophole to
close — it is MVCC working — but it means `FOR UPDATE` is **opt-in for all
participants**. One code path that reads without the lock and then writes defeats
the protocol for everyone else.

## The behaviour changes at higher isolation levels

This is the sentence to carry forward, from the `FOR UPDATE` definition:

> Within a `REPEATABLE READ` or `SERIALIZABLE` transaction, however, an error will
> be thrown if a row to be locked has changed since the transaction started.

At Read Committed, `SELECT ... FOR UPDATE` **waits** for the concurrent
transaction, then locks and returns the updated row — or no row, if it was deleted.
At Repeatable Read or Serializable it **aborts with `40001`** instead, because
returning the updated row would break the snapshot
([chunk 6](06-repeatable-read.md)).

| Level | A concurrent transaction changed the row |
|---|---|
| Read Committed | wait, then lock and return the **new** version (or no row if deleted) |
| Repeatable Read / Serializable | **`40001`** — retry the whole transaction |

⚠️ So `FOR UPDATE` is not a way to avoid needing a retry loop at the higher levels.
It changes *when* the conflict is detected, not whether it exists.

## The trade-off

| You gain | You pay |
|---|---|
| The read-modify-write race is closed | the lock is held until commit — your Java is inside the critical section |
| A guarantee nobody else with the lock can interleave | plain readers are unaffected, so every writer must opt in |
| Four strengths, so you can block only what needs blocking | four strengths to choose between, and the wrong one blocks too much or too little |
| Works at Read Committed with no retry loop | at RR/SER it converts to `40001` and you need one anyway |
| No limit on rows locked | locking writes to disk; a wide `FOR UPDATE` is expensive |

## Gotchas

**⚠️ Doing slow work between the locking `SELECT` and the commit**
**Symptom:** contention and timeouts on a hot row, tracing back to a handler that
calls a payment provider while holding the lock.
**Cause:** a row lock is held until the transaction ends, so anything between the
`SELECT ... FOR UPDATE` and `commit()` is inside the critical section.
**Fix:** lock late, commit early, and keep external calls out entirely —
[chunk 15](15-where-the-boundary-belongs.md).

**⚠️ Assuming `FOR UPDATE` blocks readers**
**Symptom:** a "locked" row is read by another request, which then makes a decision
based on the pre-lock value.
**Cause:** row-level locks "block only writers and lockers to the same row". A
plain `SELECT` reads the last committed version and never waits.
**Fix:** every path that participates must use the locking read. If that cannot be
guaranteed, the invariant needs a constraint or Serializable instead.

**⚠️ Treating `SELECT ... FOR UPDATE` as a read**
**Symptom:** an unexpected write volume, WAL growth or I/O from a query that looks
like a `SELECT`; or a `25006` inside a read-only transaction.
**Cause:** locking a row modifies it to mark it locked and can cause a disk write.
**Fix:** scope it — a `WHERE` that selects the rows you will actually update, plus
a `LIMIT` where appropriate. Never `FOR UPDATE` a whole table casually.

**⚠️ Expecting `FOR UPDATE` to remove the need for retries at Repeatable Read**
**Symptom:** `40001` from a transaction that carefully locks its rows first.
**Cause:** at RR and SER, an error is thrown if a row to be locked has changed
since the transaction started — the lock request is where the conflict surfaces.
**Fix:** it is still a retry. `FOR UPDATE` at those levels moves the detection
earlier, which is useful; it does not eliminate the failure.

**⚠️ Reaching for `FOR UPDATE` when a single statement would do**
**Symptom:** two round trips, a held lock and a lot of code, for
`counter = counter + 1`.
**Cause:** the locking read is the general tool, so it gets used where the specific
one is better.
**Fix:** if the new value is an expression over the current row, write the single
`UPDATE`. Save the lock for computations that genuinely cannot be SQL.

**⚠️ Using the wrong strength**
**Symptom:** either more blocking than expected (inserts into a child table waiting
on an unrelated parent update), or less protection than expected.
**Cause:** `FOR UPDATE` blocks all four modes including `FOR KEY SHARE`, which is
what foreign-key work needs. `FOR SHARE` allows other sharers, so two holders can
both proceed to write.
**Fix:** read Table 13.3 against what you actually need to exclude. `FOR NO KEY
UPDATE` is the right choice for "I will update this row but not its key".

## Interview questions

**★ What does `SELECT ... FOR UPDATE` do, and what does it not do?**
It locks the rows the `SELECT` returns, as though for update, so no other
transaction can lock, modify or delete them until your transaction ends. What it
does *not* do is block plain readers — the manual says row-level locks "block only
writers and lockers to the same row", so an ordinary `SELECT` of a locked row
returns the last committed version immediately. That makes `FOR UPDATE` a protocol
rather than a barrier: it protects you against other transactions that also take
the lock, and one code path that reads without it and then writes defeats the
arrangement for everybody.

**★ Why are there four row-lock modes?**
Because of foreign keys. A foreign-key relationship only depends on the parent
row's key continuing to exist, not on its other columns, so blocking a child insert
because someone renamed the customer would be pure lost concurrency. The manual
draws the line explicitly: `FOR UPDATE` is taken by any `DELETE` and by an `UPDATE`
that modifies columns with a unique index usable in a foreign key, while every
other `UPDATE` takes the weaker `FOR NO KEY UPDATE`. The shared pair mirrors that
split on the reading side. Table 13.3 is the conflict matrix, and the practical rule
is to take the weakest mode that excludes what you actually need to exclude.

**★ How long is a row lock held?**
Until the transaction ends — commit or rollback. There is no way to release one
earlier, and rolling back to a savepoint does not release locks taken before the
mark. That makes the duration of the lock exactly the duration of everything you do
after the locking `SELECT`, including your Java. It is the reason "lock late, commit
early" is the rule, and the reason an HTTP call inside a transaction that holds a
row lock is one of the worst things you can do to a database's throughput.

**★ Is `SELECT ... FOR UPDATE` a read or a write?**
A write, despite the keyword. The manual says locking a row "might cause a disk
write, e.g., `SELECT FOR UPDATE` modifies selected rows to mark them locked, and so
will result in disk writes". So a locking `SELECT` over a large result set produces
I/O and WAL proportional to the rows locked, which makes an unscoped
`SELECT * FROM t FOR UPDATE` a full-table modification wearing a `SELECT`'s
clothes. It also means it is not permitted in a read-only transaction. The
compensating fact is that there is no *limit* on rows locked — PostgreSQL keeps no
in-memory lock table for rows, so there is no lock escalation to worry about.

**★ How does `FOR UPDATE` behave differently at Repeatable Read?**
At Read Committed, if the row was changed by a concurrent transaction, the locking
`SELECT` waits, then locks and returns the updated version — or returns no row if
it was deleted. At Repeatable Read or Serializable the manual says "an error will be
thrown if a row to be locked has changed since the transaction started", which is a
`40001` serialization failure. That is the only coherent choice: returning the new
version would show the transaction data from after its snapshot. The practical
consequence is that `FOR UPDATE` does not let you skip the retry loop at those
levels — it moves the conflict detection earlier, to the lock request rather than to
the write, but the transaction still has to be retried from the beginning.

**★ When should you use a row lock instead of a single `UPDATE` statement?**
Only when the new value genuinely cannot be computed by the server from the row's
current value. `UPDATE t SET n = n + 1 WHERE id = ?` needs no lock reasoning at all
and is strictly better where it applies. The locking read earns its place when the
computation needs application logic — a pricing engine, a rate fetched at startup, a
branch over several fields — because then there is no way to express the change as
an expression, and something has to hold the row still between reading it and
writing it back.

---

← Prev: [11b · Read-only that earns its keep](11b-read-only-that-earns-its-keep.md) · Index: [Transactions at the JDBC level](README.md) · Next → [12b · NOWAIT, SKIP LOCKED, scope](12b-nowait-skip-locked-and-scope.md)
