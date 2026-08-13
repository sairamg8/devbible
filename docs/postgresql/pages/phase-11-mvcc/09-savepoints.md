---
title: "Savepoints and partial rollback"
sidebar_label: "09 · Savepoints"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex27-tx-basics.mjs`.

**A savepoint is a marker you can roll back to without losing the whole transaction.
It is the only way to survive a statement error inside a transaction, and it is what
"nested transactions" compile down to — PostgreSQL has no real nesting.**

## Rolling back part of a transaction

```console
$ node ex27-tx-basics.mjs
=== 10. savepoints — partial rollback and recovering from an error ===
rows: [{"id":1,"v":"keep"},{"id":3,"v":"after"}]
```

```sql
BEGIN;
  INSERT INTO t_sp VALUES (1,'keep');
  SAVEPOINT sp1;
  INSERT INTO t_sp VALUES (2,'discard');
  ROLLBACK TO SAVEPOINT sp1;      -- row 2 is gone, row 1 survives
  INSERT INTO t_sp VALUES (3,'after');
COMMIT;
```

Rows 1 and 3 committed, row 2 did not. `ROLLBACK TO SAVEPOINT` discards everything after
the marker and **leaves the transaction open and usable** — unlike a plain `ROLLBACK`,
which ends it.

## The real use: surviving an error

Without a savepoint, one failed statement poisons the transaction — every later
statement returns `25P02` ([shown here](02-begin-commit.md)). A savepoint is the only
escape:

```console
duplicate insert → 23505 duplicate key value violates unique constraint "t_sp_pkey"
rows: [1,3,4,5]
```

```js
await client.query('SAVEPOINT risky');
try {
  await client.query(`INSERT INTO t_sp VALUES ($1, $2)`, [id, val]);
} catch (e) {
  if (e.code !== '23505') throw e;              // only the expected failure
  await client.query('ROLLBACK TO SAVEPOINT risky');
  // transaction is healthy again — carry on
}
await client.query(`INSERT INTO t_sp VALUES (5,'still works')`);
await client.query('COMMIT');
```

The insert failed with `23505`, the rollback to savepoint cleared the aborted state, and
the transaction went on to commit rows 4 and 5. Two rules:

- **The savepoint must be taken *before* the statement that might fail.** After the
  error it is too late — you cannot issue `SAVEPOINT` in an aborted transaction.
- **Check the error code.** Catching everything turns a connection failure or a
  deadlock into a silently skipped statement.

For the specific case of "insert unless it exists", prefer
[`ON CONFLICT`](../phase-4-crud/06-on-conflict.md) — it does the same job in one statement
with no savepoint and no round trips.

## RELEASE, and what happens after it

```console
ROLLBACK TO a released savepoint → 3B001 savepoint "s" does not exist
```

`RELEASE SAVEPOINT s` discards the marker while **keeping** the work done after it —
it is a merge into the enclosing transaction, not an undo. Once released, the name is
gone and rolling back to it is `3B001`.

Names are reusable: `SAVEPOINT s` twice creates a second marker shadowing the first, and
`ROLLBACK TO s` targets the most recent. That is convenient in loops and confusing
everywhere else — prefer distinct names.

## What savepoints cost

Every savepoint that writes creates a **subtransaction with its own transaction id**:

```console
=== 11. the cost of one savepoint per statement ===
2000 inserts plain                     : 599.8 ms
2000 inserts wrapped in SAVEPOINT/RELEASE: 1362.5 ms
top-level xid: 46128 | xmin per row: [{"id":0,"xmin":"46128"},{"id":1,"xmin":"46129"},{"id":2,"xmin":"46130"},{"id":3,"xmin":"46131"},{"id":4,"xmin":"46132"}]
backend_xid seen by pg_stat_activity: {"bx":"46128","bm":"46128"}
```

Two measured facts:

- **Wrapping every statement in `SAVEPOINT`/`RELEASE` cost 2.3× — 599 ms to 1362 ms.**
  Part is the extra round trips, part is subtransaction bookkeeping.
- **Each writing savepoint burns a real xid.** Rows inserted under four savepoints
  carry `xmin` 46129, 46130, 46131, 46132 while the top-level transaction is 46128.
  Five transaction ids consumed by one transaction — which is why savepoint-per-row
  patterns also accelerate [XID consumption](16-xid-wraparound.md).

`pg_stat_activity.backend_xid` shows only the top-level id (46128), so a transaction
burning subtransaction ids looks perfectly ordinary from the outside.

There is a second, sharper cliff: **past 64 subtransactions per session the subxid cache
overflows**, and other backends must consult the on-disk subtransaction log to test
visibility. On a busy server that shows up as `SubtransSLRU` / `SubtransBuffer` waits
across sessions that have nothing to do with yours. The rule that avoids it: keep
savepoints few and coarse.

## ORMs turn nested transactions into savepoints

Every ORM offering nested transactions implements them this way — an outer
`BEGIN`, inner `SAVEPOINT`s. Two consequences worth knowing:

- An inner "transaction" that commits has only been `RELEASE`d. If the outer transaction
  later rolls back, the inner work goes with it. **There is no such thing as committing
  the inner transaction independently.**
- Code that loops "one nested transaction per record" produces one subtransaction per
  record and hits both costs above.

## Trade-off

**Savepoints buy error recovery with round trips, transaction ids and subtransaction
bookkeeping.** Used sparingly — around the one statement that can legitimately fail —
they cost nothing worth measuring. Used per statement they cost 2.3× (measured), one xid
each, and risk the 64-subtransaction cliff. Where a single statement can express the
recovery (`ON CONFLICT DO NOTHING`, `WHERE NOT EXISTS`), that is strictly better: no
savepoint, no extra round trip, no subtransaction.

## Gotchas

**Symptom:** `25P02` continues even after catching the error
**Cause:** No savepoint was taken before the failing statement
**Fix:** `SAVEPOINT` first, then `ROLLBACK TO SAVEPOINT` in the catch block

**Symptom:** `3B001 savepoint "s" does not exist`
**Cause:** It was released, rolled back past, or never created in this transaction
**Fix:** Do not reuse names across releases; take the savepoint before the risky statement

**Symptom:** Bulk insert with per-row savepoints is far slower than expected
**Cause:** Round trips plus subtransaction overhead — measured 2.3×
**Fix:** `ON CONFLICT`, or validate in one statement and let the transaction fail wholesale

**Symptom:** `SubtransSLRU` waits across unrelated sessions
**Cause:** A session exceeded 64 subtransactions, overflowing the subxid cache
**Fix:** Fewer, coarser savepoints; never one per row

**Symptom:** An ORM's inner transaction "committed" but the data is missing
**Cause:** It was a savepoint release; the outer transaction rolled back afterwards
**Fix:** Understand nesting as savepoints — only the outermost commit is real

**Symptom:** XIDs consumed far faster than the transaction count suggests
**Cause:** Each writing savepoint takes its own xid — measured 5 for one transaction
**Fix:** Reduce savepoint use in hot paths

## Interview questions

**★ What does `ROLLBACK TO SAVEPOINT` do that `ROLLBACK` does not?**
It undoes only the work after the marker and leaves the transaction open and usable.
Plain `ROLLBACK` ends the transaction entirely.

**★ How do you continue a transaction after a statement error?**
Take a savepoint before the risky statement and roll back to it in the catch block.
Measured: after a `23505`, the transaction went on to insert two more rows and commit.

**★ What does `RELEASE SAVEPOINT` do?**
Discards the marker but keeps the work — it merges into the enclosing transaction.
Afterwards `ROLLBACK TO` that name fails with `3B001`.

**★ Do savepoints have a runtime cost?**
Yes. Measured 2.3× on 2000 inserts, and each writing savepoint consumes its own
transaction id (rows carried `xmin` 46129–46132 under a top-level 46128). Past 64
subtransactions the subxid cache overflows and other sessions pay for it.

**★ Does PostgreSQL support nested transactions?**
No. `BEGIN` inside a transaction warns (`25001`) and is ignored. ORMs implement nesting
with savepoints, so an inner "commit" is just a `RELEASE`.

**When should you not use a savepoint?**
When a single statement can express the recovery — `ON CONFLICT DO NOTHING` beats a
savepoint plus a caught `23505` on both round trips and overhead.

---

← [SKIP LOCKED](08-skip-locked.md) · Next → [Table locks and DDL](10-table-locks-ddl.md)
