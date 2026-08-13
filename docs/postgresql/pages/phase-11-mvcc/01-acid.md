---
title: "ACID in PostgreSQL"
sidebar_label: "01 · ACID"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex27-tx-basics.mjs`.

**Four letters, four concrete mechanisms: a transaction that fails leaves nothing
behind, constraints decide what "valid" means and when it is checked, every reader
gets a consistent snapshot, and a committed transaction survives a crash because the
WAL record hit the disk before `COMMIT` returned.**

Fixture: `t_acct (id, owner, balance int NOT NULL CHECK (balance >= 0))`, two rows at
100 each.

## A — atomicity, and what "the transaction failed" means

```console
$ node ex27-tx-basics.mjs
=== 1. atomicity — a failing statement takes the earlier ones with it ===
debit 150 from ann → 23514 new row for relation "t_acct" violates check constraint "t_acct_balance_check"
credit bob → 25P02 current transaction is aborted, commands ignored until end of transaction block
balances after: [{"id":1,"balance":100},{"id":2,"balance":100}]
```

Both rows are untouched. Note **what actually enforced it**: the `CHECK` rejected the
debit, and from that moment every further statement in the transaction returned
`25P02` — including a statement that would have been perfectly valid on its own.
PostgreSQL does not "undo" the earlier work at `ROLLBACK` time so much as refuse to
let an aborted transaction do anything else.

That is why `COMMIT` on a failed transaction is not an error:

```console
=== 5. one error aborts the transaction — 25P02 until you roll back ===
the failing statement → 22012 division by zero
a perfectly valid SELECT after it → 25P02 current transaction is aborted, commands ignored until end of transaction block
COMMIT on an aborted transaction returns: ROLLBACK | ann balance: 100
```

**You sent `COMMIT` and the server answered `ROLLBACK`.** If your code assumes a
resolved `COMMIT` means the data was written, this is the case that breaks it.
See [BEGIN, COMMIT, ROLLBACK](02-begin-commit.md) for the client-side handling, and
[Savepoints](09-savepoints.md) for how to survive a statement error without losing
the whole transaction.

## C — consistency is your constraints, and you choose when they fire

Consistency is not something PostgreSQL invents; it is whatever your constraints
say. The interesting part is *when* the check happens. A `UNIQUE` constraint declared
`DEFERRABLE` can be postponed to commit time, which is the only way to do a swap:

```console
=== 2. consistency — immediate vs DEFERRABLE constraint check ===
same UPDATE with the check DEFERRED: accepted inside the transaction
rows after commit: [{"id":1,"pos":2},{"id":2,"pos":3}]
```

```sql
CREATE TABLE t_uniq (id int PRIMARY KEY, pos int NOT NULL,
  CONSTRAINT t_uniq_pos UNIQUE (pos) DEFERRABLE INITIALLY IMMEDIATE);

BEGIN;
  SET CONSTRAINTS t_uniq_pos DEFERRED;
  UPDATE t_uniq SET pos = pos + 1;   -- passes through a duplicate state, legally
COMMIT;                              -- checked here
```

Without the deferral the same `UPDATE` fails mid-statement, because row 1 becomes
`pos = 2` while row 2 still holds it. Only `UNIQUE`, `PRIMARY KEY`, `EXCLUDE` and
foreign keys can be deferred — **`CHECK` and `NOT NULL` are always immediate.**

## I — isolation is a level you pick, and the default is the weak one

```console
isolation default: read committed
```

READ COMMITTED is not "isolated" in the intuitive sense — it permits non-repeatable
reads and phantoms by design. That is the subject of
[READ COMMITTED](03-read-committed.md) and [the stronger levels](06-isolation-levels.md).
The one-line version: **PostgreSQL's default trades isolation for concurrency, and
the anomalies it allows are the source of most real transaction bugs.**

## D — durability, measured

Every change writes a WAL record before the data file is touched, and `COMMIT`
does not return until that record is flushed:

```console
=== 3. durability — WAL LSN, and the price of synchronous_commit ===
WAL lsn 2/D84F76D8 -> 2/D84F7748  (112 bytes for one UPDATE)
500 single-row commits, synchronous_commit=on: 1042.8 ms
500 single-row commits, synchronous_commit=off: 170.8 ms
same 500 inserts inside ONE transaction (sync on): 128.2 ms
```

Three numbers worth internalising:

- **Durability costs 6×.** Turning `synchronous_commit` off took 500 commits from
  1042 ms to 170 ms. What you buy is a window (up to `wal_writer_delay` × 3) in which
  a committed transaction can vanish in a crash. The database stays *consistent* —
  it is not corruption, it is lost recent commits.
- **Batching is the free version of the same win.** The same 500 inserts inside one
  transaction took 128 ms with durability fully on — faster than turning durability
  off — because there is one flush instead of 500.
- **112 bytes of WAL for a one-row `UPDATE`.** WAL volume is what replication and PITR
  actually ship, so this is the number that matters for a write-heavy design.

The rule this gives you: **before you weaken durability, check whether you are
committing too often.** One transaction per HTTP request is normal; one per row in a
loop is the bug.

## From Node

```js
// the shape every transaction takes: one client, always released
async function withTransaction(pool, fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});  // may already be aborted
    throw e;
  } finally {
    client.release();
  }
}

await withTransaction(pool, async (c) => {
  await c.query('UPDATE t_acct SET balance = balance - $1 WHERE id = $2', [10, 1]);
  await c.query('UPDATE t_acct SET balance = balance + $1 WHERE id = $2', [10, 2]);
});
```

`pool.connect()`, not `pool.query()` — the reason is measured in
[BEGIN, COMMIT, ROLLBACK](02-begin-commit.md). The `.catch()` on `ROLLBACK` matters
because the transaction may already be aborted; a throwing cleanup path would mask the
original error.

## Trade-off

**ACID is not free and PostgreSQL lets you sell parts of it.** `synchronous_commit
= off` buys 6× write throughput for a window of lost commits. A weaker isolation
level buys concurrency for anomalies you then have to handle in application code.
Deferring constraints buys legal intermediate states at the cost of finding out about
violations at `COMMIT`, where the error is harder to attribute to a statement. Each of
these is a legitimate choice — as long as it is a choice, and not something you
inherited from a default.

## Gotchas

**Symptom:** `COMMIT` succeeded but the data is not there
**Cause:** The transaction was already aborted; `COMMIT` was silently downgraded to `ROLLBACK`
**Fix:** Check the `command` on the result, or never swallow a statement error inside a transaction

**Symptom:** Every statement after the first failure returns `25P02`
**Cause:** Correct behaviour — an aborted transaction accepts nothing but `ROLLBACK`
**Fix:** Roll back, or wrap the risky statement in a [savepoint](09-savepoints.md)

**Symptom:** Writes are slow and the disk is busy with tiny flushes
**Cause:** One transaction per row — 500 commits means 500 WAL flushes
**Fix:** Batch into one transaction (measured 1042 ms → 128 ms) before touching `synchronous_commit`

**Symptom:** A swap `UPDATE` fails on a unique constraint
**Cause:** The constraint is checked per row, and the intermediate state is a duplicate
**Fix:** Declare it `DEFERRABLE` and `SET CONSTRAINTS ... DEFERRED` inside the transaction

**Symptom:** Recent commits are missing after a power loss, but the database starts cleanly
**Cause:** `synchronous_commit = off` — the documented trade, not corruption
**Fix:** Turn it back on for anything you cannot recompute

## Interview questions

**★ What does atomicity actually do when a statement fails mid-transaction?**
It aborts the transaction. PostgreSQL does not selectively undo the failed statement —
every later command returns `25P02` until you end the transaction, and the rollback
discards all of it. Measured: a failed `CHECK` on the debit made the subsequent credit
return `25P02`, and both balances stayed at 100.

**★ Can `COMMIT` return successfully without committing anything?**
Yes. On an aborted transaction the server executes it as a rollback and reports the
command as `ROLLBACK`. Measured directly.

**★ What is the cost of `synchronous_commit = off`, precisely?**
You lose the guarantee that a committed transaction survives a crash — up to a few
hundred milliseconds of recent commits can disappear. You do **not** risk corruption or
inconsistency. Measured 6× faster on 500 single-row commits (1042 ms → 170 ms).

**★ You need to swap two values in a unique column. How?**
Declare the constraint `DEFERRABLE` and defer it inside the transaction, so it is
checked at commit rather than per row. `CHECK` and `NOT NULL` cannot be deferred.

**Which is faster: 500 commits with durability off, or one transaction with it on?**
One transaction with durability on — measured 128 ms against 170 ms. Commit frequency
usually matters more than the durability setting.

**Does PostgreSQL implement isolation with locks?**
Not for readers. It uses [MVCC](05-mvcc.md): writers create new row versions and
readers follow a snapshot, so readers never block writers. Locks appear for
[writer-writer conflicts](07-row-locks.md).

**How much WAL does a single-row `UPDATE` generate?**
Measured 112 bytes for one small row. It scales with row size and index count, which is
why WAL volume — not just query time — is a design constraint for write-heavy tables.

---

← [Phase index](README.md) · Next → [BEGIN COMMIT ROLLBACK](02-begin-commit.md)
