---
title: "READ COMMITTED and the anomalies it allows"
sidebar_label: "03 · READ COMMITTED"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex27-tx-basics.mjs`.

**The default level takes a fresh snapshot for every statement. Inside one transaction
the same query can return different answers, new rows can appear, and an `UPDATE` can
act on a row version its own `SELECT` never saw. None of this raises an error — it is
the documented behaviour, and it is where most transaction bugs live.**

## A statement, not a transaction, is the unit of consistency

```console
$ node ex27-tx-basics.mjs
=== 7. READ COMMITTED — non-repeatable read and phantom read ===
reader, first look : 100
reader, row count  : 2
reader, same query : 999   <- non-repeatable read
reader, row count  : 3   <- phantom row
```

One transaction, four queries, no errors. Between the second and third, another
session committed an `UPDATE` and an `INSERT`:

| Anomaly | What happened | Allowed by READ COMMITTED |
|---|---|---|
| **Dirty read** | reading uncommitted data | **No** — PostgreSQL never permits this at any level |
| **Non-repeatable read** | `balance` went 100 → 999 mid-transaction | Yes |
| **Phantom read** | `count(*)` went 2 → 3 mid-transaction | Yes |

PostgreSQL does not implement READ UNCOMMITTED as a distinct level — asking for it
gives you READ COMMITTED, so **dirty reads cannot happen here at all.**

The practical consequence: if a request reads a value, makes a decision, and then reads
it again, the two reads can disagree. Any invariant you check with a `SELECT` may be
false by the time the next statement runs.

## One statement, one snapshot — however long it runs

The snapshot is fixed when the statement *starts*, not while it runs:

```console
=== 8. one statement = one snapshot, however long it runs ===
rows seen by the long statement: [0,0,0,0,0] <- all pre-update, though the UPDATE committed mid-scan
same query, next statement      : [99,99,99,99,99]
```

A `SELECT` that took 400 ms saw the pre-update value for every row, even for rows it
reached after the other session committed. **A long report is internally consistent —
it cannot show you half of one state and half of another.** The next statement in the
same transaction sees the new values immediately.

## The one that surprises people: UPDATE re-reads the row

A `SELECT` under READ COMMITTED uses its snapshot. An `UPDATE` that hits a row locked by
another transaction **waits, then re-evaluates its `WHERE` clause against the newly
committed version** — which may no longer match:

```console
=== 9. UPDATE under READ COMMITTED sees a NEWER row than the SELECT did ===
while blocked: [{"wait_event_type":"Lock","wait_event":"transactionid","q":"UPDATE t_stock SET qty = qty - 1 WHERE id = 1 AN"}]
b's UPDATE after a committed: rowCount = 0 <- the WHERE was re-evaluated against status=closed
final row: {"id":1,"qty":10,"status":"closed"}
```

Session A set `status = 'closed'` and committed. Session B's
`UPDATE … WHERE id = 1 AND status = 'open'` had already started and was waiting on the
row lock. When it woke it did **not** blindly apply its change — it re-checked the
predicate against `status = 'closed'`, found no match, and reported `rowCount: 0`.

This cuts both ways:

- **It saves you** when the predicate encodes the condition you care about. That is why
  `UPDATE … WHERE id = $1 AND status = 'open'` is a safe conditional update, and why
  checking `rowCount` is mandatory.
- **It surprises you** when your `WHERE` matches on something stable like the primary
  key. Then the update *does* apply — to a row whose other columns have changed since
  your `SELECT` read them. That is the [lost update](04-lost-update.md).

The takeaway: **put the condition in the `WHERE` clause, then trust `rowCount`.**

```js
const r = await client.query(
  `UPDATE t_stock SET qty = qty - $1 WHERE id = $2 AND status = 'open' AND qty >= $1`,
  [1, id]);
if (r.rowCount === 0) throw new Error('order not open, or not enough stock');
```

## When READ COMMITTED is the right choice

Almost always, and specifically:

- **Single-statement writes.** `UPDATE … SET qty = qty + 1` is atomic on its own; no
  stronger level adds anything.
- **Reads that tolerate being a moment stale** — which is most list and detail endpoints.
- **High-concurrency workloads**, because it never aborts a transaction with a
  serialization failure, so there is no retry loop to write.

Reach for a stronger level when a transaction reads something and then writes based on
what it read — see [REPEATABLE READ and SERIALIZABLE](06-isolation-levels.md).

## Trade-off

**READ COMMITTED gives you maximum concurrency and zero retries, and hands you the
consistency problem.** Nothing ever fails with `40001`, so there is no retry code to
write — but a read-then-write sequence silently produces wrong data instead of an
error, and it is your job to notice. The alternatives each pick a different cost: an
explicit [row lock](07-row-locks.md) serialises the writers, and
[SERIALIZABLE](06-isolation-levels.md) converts the anomaly into an error you must
retry.

## Gotchas

**Symptom:** Two identical `SELECT`s in one request return different values
**Cause:** READ COMMITTED takes a new snapshot per statement
**Fix:** Read once and pass the value along, or use `REPEATABLE READ` for the transaction

**Symptom:** `SELECT` then `UPDATE` overwrites a concurrent change with no error
**Cause:** The `UPDATE` re-reads the current row and applies your value on top
**Fix:** `SET col = col + $1`, `FOR UPDATE`, or a version predicate — see [lost update](04-lost-update.md)

**Symptom:** An `UPDATE` returns `rowCount: 0` even though the row exists
**Cause:** Correct behaviour — the `WHERE` was re-evaluated after a concurrent commit and no longer matches
**Fix:** Treat it as a real outcome ("someone else got there first"), not an impossible case

**Symptom:** A long report shows totals that do not add up
**Cause:** Multiple statements in one READ COMMITTED transaction, each with its own snapshot
**Fix:** Run the whole report in one statement, or use `REPEATABLE READ`

**Symptom:** Expecting dirty reads to be possible
**Cause:** PostgreSQL has no READ UNCOMMITTED; requesting it gives READ COMMITTED
**Fix:** None needed — uncommitted data is never visible

## Interview questions

**★ What anomalies does READ COMMITTED allow?**
Non-repeatable reads and phantom reads. Measured: `balance` 100 → 999 and `count(*)`
2 → 3 inside one transaction. It never allows dirty reads.

**★ When is a snapshot taken under READ COMMITTED?**
At the start of each statement. A statement that runs for 400 ms still sees the state
from when it began — measured, all five rows read as pre-update despite a commit
landing mid-scan.

**★ An `UPDATE` blocks on a row lock. What does it do when the lock is released?**
It re-reads the newest committed version and re-evaluates its `WHERE`. If the predicate
no longer matches it updates nothing and reports `rowCount: 0`. Measured with
`WHERE status = 'open'` after another session set `closed`.

**★ Does PostgreSQL support READ UNCOMMITTED?**
It accepts the syntax and gives you READ COMMITTED. Dirty reads are not possible in
PostgreSQL at any isolation level.

**Why can't you rely on `SELECT … ; UPDATE …` to be safe?**
Because the two statements have different snapshots and the `UPDATE` re-reads the row.
Whatever you decided from the `SELECT` may be stale by the time the write applies.

**Is READ COMMITTED ever wrong for a report?**
Yes, if the report is several statements. Each gets its own snapshot, so the parts can
disagree. One statement, or `REPEATABLE READ`, fixes it.

---

← [BEGIN COMMIT ROLLBACK](02-begin-commit.md) · Next → [Lost update](04-lost-update.md)
