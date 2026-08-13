---
title: "Index bloat and REINDEX"
sidebar_label: "17 · Bloat and REINDEX"
sidebar_position: 17
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex26-index-ops.mjs`.

**Every `UPDATE` of an indexed column writes a new index entry and leaves the old one dead.
`VACUUM` marks that space reusable inside the index; it does not give it back. Only
`REINDEX` rebuilds the file — and `REINDEX CONCURRENTLY` does it without locking out
writes.**

## Watching an index bloat to 4×

400 000 rows, index on `v`, then six rounds of updating a third of the rows:

```console
$ node ex26-index-ops.mjs
=== 7. index bloat and REINDEX ===
fresh index: 8792 kB
after 6 rewrites of a third of the rows: 34 MB (4.0x)
pgstatindex bloated: {"leaf_fragmentation":49.99,"avg_leaf_density":84.71}
```

**8792 kB → 34 MB.** The row count never changed. Each `UPDATE` creates a new row version,
and because the indexed column changed, a new index entry has to point at it — the old
entry stays until vacuumed, and the pages it lived on stay in the file.

`pgstatindex` (from the `pgstattuple` extension) gives the two numbers worth knowing:
**`leaf_fragmentation: 49.99`** — half the leaf pages are out of physical order, so range
scans no longer read sequentially — and `avg_leaf_density: 84.71`.

## `VACUUM` does not shrink it

```console
after VACUUM       : 34 MB ← VACUUM reclaims entries, not file size
```

This is the same asymmetry as heap `VACUUM` (see
[DELETE](../phase-4-crud/11-delete.md)): the dead entries become reusable *within* the
index, so it stops growing, but the 34 MB file stays 34 MB. Bloat is a floor, not a debt
that repays itself.

## `REINDEX` rebuilds it

```console
after REINDEX CONCURRENTLY: 9968 kB in 783 ms
pgstatindex rebuilt: {"leaf_fragmentation":0, "avg_leaf_density":90.05}
```

**34 MB → 9968 kB, fragmentation 49.99 → 0**, and writes continued throughout.

`REINDEX CONCURRENTLY` builds a new index alongside the old one, swaps them, and drops the
old — taking `SHARE UPDATE EXCLUSIVE` rather than the `ACCESS EXCLUSIVE` a plain `REINDEX`
takes. It shares the properties of
[`CREATE INDEX CONCURRENTLY`](12-concurrently.md): slower, cannot run in a transaction
block, and it can fail leaving something behind.

The rebuilt index is slightly larger than the original 8792 kB because the fill factor
differs on a rebuild versus an initial build over sorted data.

## After a failed `REINDEX CONCURRENTLY`

```console
leftovers to check for after a failed REINDEX CONCURRENTLY:
┌─────────┬───────────────┬────────────┐
│ (index) │ name          │ indisvalid │
├─────────┼───────────────┼────────────┤
│ 0       │ 'b_tab_v_idx' │ true       │
│ 1       │ 'b_tab_pkey'  │ true       │
└─────────┴───────────────┴────────────┘
a plain REINDEX takes an ACCESS EXCLUSIVE lock; CONCURRENTLY takes SHARE UPDATE EXCLUSIVE
```

Both valid here, because the rebuild succeeded. When one fails, it leaves an invalid index
named with a **`_ccnew`** suffix (or `_ccold` if the swap had already happened). Neither is
used by queries; both are maintained by writes. Same check as for a failed concurrent
build:

```sql
SELECT indexrelid::regclass AS index, indisvalid
FROM pg_index WHERE NOT indisvalid;
-- then: DROP INDEX CONCURRENTLY the_ccnew_one;
```

## What actually causes it

- **`UPDATE`s of indexed columns.** The single biggest source, as measured above.
  Updating a column that is *not* indexed can use a HOT update and skip the index
  entirely — which is a real argument for not indexing frequently-updated columns.
- **Deletes followed by inserts** with different key values, leaving gaps that never
  refill.
- **Long-running transactions**, which hold back the vacuum horizon so dead entries cannot
  be removed at all.
- **A too-high `fillfactor`** on a heavily updated table, leaving no room for HOT updates.

## Measuring it

```sql
CREATE EXTENSION pgstattuple;
SELECT * FROM pgstatindex('b_tab_v_idx');   -- leaf_fragmentation, avg_leaf_density

-- cheap proxy without the extension: size against the estimated ideal
SELECT indexrelname, pg_size_pretty(pg_relation_size(indexrelid)) AS size, idx_scan
FROM pg_stat_user_indexes ORDER BY pg_relation_size(indexrelid) DESC LIMIT 20;
```

`pgstatindex` scans the whole index, so it is not something to run continuously on a large
one. Tracking size over time per index is the cheap approach — a size that grows while the
row count does not is bloat, and needs no extension to spot.

## In SQL

```sql
REINDEX INDEX CONCURRENTLY b_tab_v_idx;   -- one index, writes continue
REINDEX TABLE CONCURRENTLY b_tab;         -- every index on the table
REINDEX INDEX b_tab_v_idx;                -- ACCESS EXCLUSIVE — maintenance window only

-- a heavily-updated table can be given headroom
ALTER TABLE b_tab SET (fillfactor = 85);
ALTER INDEX b_tab_v_idx SET (fillfactor = 85);
```

`REINDEX ... CONCURRENTLY` needs roughly the size of the index in free disk while both
copies exist. On a large index that is a real capacity check before you start.

## From Node

Never in a request path. This belongs in a scheduled maintenance job:

```js
const client = await pool.connect();
try {
  await client.query(`SET statement_timeout = 0`);
  await client.query(`SET lock_timeout = '10s'`);
  // must be outside a transaction, exactly like CREATE INDEX CONCURRENTLY
  await client.query(`REINDEX INDEX CONCURRENTLY b_tab_v_idx`);

  const {rows} = await client.query(
    `SELECT indexrelid::regclass::text AS name FROM pg_index WHERE NOT indisvalid`);
  if (rows.length) console.error('invalid indexes left behind:', rows);
} finally {
  client.release();
}
```

A monitoring query that finds candidates:

```js
const {rows} = await pool.query(`
  SELECT s.relname AS table, s.indexrelname AS index,
         pg_size_pretty(pg_relation_size(s.indexrelid)) AS size,
         s.idx_scan, i.indisvalid
  FROM pg_stat_user_indexes s JOIN pg_index i ON i.indexrelid = s.indexrelid
  WHERE pg_relation_size(s.indexrelid) > 100 * 1024 * 1024
  ORDER BY pg_relation_size(s.indexrelid) DESC`);
console.table(rows);
```

## Trade-off

**`REINDEX CONCURRENTLY` recovers real space with almost no availability cost, and it is
still not free**: it needs disk for a second copy, it takes `SHARE UPDATE EXCLUSIVE`
(which blocks other maintenance including `VACUUM` on that table), it cannot run in a
transaction, and it can leave an invalid index if interrupted.

The deeper question is usually whether the index should exist at all. An index on a
column that is updated constantly bloats fastest, blocks HOT updates, and is the most
expensive kind to maintain — dropping it may beat reindexing it on a schedule. Check
`idx_scan` first; see [Unused and duplicate indexes](13-unused-indexes.md).

Reindexing on a fixed schedule "just in case" is mostly wasted I/O. Track size against row
count and act when the ratio moves.

## Gotchas

**Symptom:** An index keeps growing while the row count is flat
**Cause:** `UPDATE`s on the indexed column — measured 4× growth from six passes over a
third of the rows
**Fix:** `REINDEX CONCURRENTLY`; consider whether that column needs an index

**Symptom:** `VACUUM` ran and the index is the same size
**Cause:** `VACUUM` makes space reusable inside the index, it does not truncate the file
**Fix:** `REINDEX` is the only thing that shrinks it

**Symptom:** `REINDEX` blocked all queries
**Cause:** The plain form takes `ACCESS EXCLUSIVE`
**Fix:** `REINDEX INDEX CONCURRENTLY`

**Symptom:** An index named `..._ccnew` appeared
**Cause:** A failed `REINDEX CONCURRENTLY`
**Fix:** `SELECT … FROM pg_index WHERE NOT indisvalid`, then
`DROP INDEX CONCURRENTLY`

**Symptom:** Bloat returns immediately after reindexing
**Cause:** A long-running transaction holding back the vacuum horizon
**Fix:** Find it by `xact_start` in `pg_stat_activity`; set
`idle_in_transaction_session_timeout`

**Symptom:** Reindex failed with a disk-full error
**Cause:** `CONCURRENTLY` needs space for both copies at once
**Fix:** Check free space against `pg_relation_size` first

## Interview questions

**★ What causes index bloat?**
Dead index entries left by `UPDATE`s and `DELETE`s. Measured: six passes updating a third
of 400 000 rows took an index from 8792 kB to 34 MB with no change in row count.

**★ Does `VACUUM` fix it?**
No. It marks entries reusable inside the index so it stops growing; the file stays the
same size. Measured: still 34 MB after `VACUUM`. Only `REINDEX` rebuilds it — down to
9968 kB.

**★ How do you rebuild an index without downtime?**
`REINDEX INDEX CONCURRENTLY`. Measured 783 ms with writes continuing, and fragmentation
went from 49.99 to 0. It cannot run in a transaction and needs disk for a second copy.

**How do you measure bloat?**
`pgstatindex()` from `pgstattuple` gives `leaf_fragmentation` and `avg_leaf_density`.
Cheaper: track `pg_relation_size` against row count over time.

**What is left behind by a failed `REINDEX CONCURRENTLY`?**
An invalid index suffixed `_ccnew` or `_ccold` — unusable by queries, still maintained by
writes. Find it with `WHERE NOT indisvalid` and drop it.

**Which index bloats fastest?**
One on a frequently-updated column — it also prevents HOT updates, so it is worth asking
whether it should exist.

---

← [Statistics and ANALYZE](16-statistics.md) · Next → [Indexing foreign key columns](18-fk-indexes.md)
