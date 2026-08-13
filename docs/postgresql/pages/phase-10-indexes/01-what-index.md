---
title: "What an index is"
sidebar_label: "01 · What an index is"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex23-index-basics.mjs`.

**An index is a second copy of some of your columns, kept sorted, that the database
writes on every `INSERT`, `UPDATE` and `DELETE` so that some `SELECT`s can stop scanning.
You are buying read speed with write time and disk.**

## The read it buys

400 000-row table, one lookup by `email`:

```console
$ node ex23-index-basics.mjs
indexed lookup by email : 2 ms
same lookup, no index   : 48 ms
```

24× on a table small enough to fit in memory. On a table that does not fit, the gap is
the difference between one disk seek and reading the whole file.

## The write it costs

Same 200 000-row `INSERT`, three times, changing only how many indexes exist:

```console
=== 1. the write cost of an index ===
no index           insert 200000 → 1239 ms | heap 15 MB | indexes 4408 kB
1 index (email)    insert 200000 → 2266 ms | heap 15 MB | indexes 18 MB
3 indexes          insert 200000 → 4035 ms | heap 15 MB | indexes 36 MB
```

Read that carefully:

- **The heap never changes.** 15 MB of actual data in all three runs.
- **One index nearly doubled the insert time**, 1239 → 2266 ms.
- **Three indexes tripled it**, and the indexes now weigh **36 MB — 2.4× the data
  they point at.**
- The "no index" row still shows 4408 kB, because the table has a primary key. A
  `PRIMARY KEY` *is* a unique index; you are never truly at zero.

That cost is paid by every writer, forever, in exchange for the queries that use it.
An index nobody queries is pure loss — see [Unused and duplicate indexes](13-unused-indexes.md).

## Index size is not proportional to column count

Four indexes on the same 500 000-row table:

```console
=== 5. index size relative to the table ===
┌─────────┬────────────────────────┬───────────┐
│ (index) │ name                   │ size      │
├─────────┼────────────────────────┼───────────┤
│ 0       │ 'b_events_sku_idx'     │ '15 MB'   │
│ 1       │ 'b_events_sku_pat_idx' │ '15 MB'   │
│ 2       │ 'b_events_at_idx'      │ '11 MB'   │
│ 3       │ 'b_events_bucket_idx'  │ '3600 kB' │
└─────────┴────────────────────────┴───────────┘
heap: 29 MB | all indexes: 44 MB
```

A `text` key costs 15 MB; a small `int` key costs 3600 kB — **4× less for the same
number of rows.** Indexing wide columns is the expensive kind.

Total indexes here (44 MB) exceed the table itself (29 MB). That is normal and not by
itself a problem; it is a problem when the indexes are not earning it.

## In SQL

```sql
CREATE INDEX b_events_sku_idx ON b_events (sku);
DROP INDEX b_events_sku_idx;

-- what exists, and what it costs
SELECT indexrelname,
       pg_size_pretty(pg_relation_size(indexrelid)) AS size,
       idx_scan
FROM pg_stat_user_indexes
WHERE relname = 'b_events'
ORDER BY pg_relation_size(indexrelid) DESC;
```

## From Node

Index DDL belongs in a migration, not in application code. It is a one-off schema
change with a lock attached — see
[`CREATE INDEX CONCURRENTLY`](12-concurrently.md) before you run it against a live table.

```js
// in a migration, not in a request handler
await client.query(`CREATE INDEX b_events_sku_idx ON b_events (sku)`);
```

Measuring the write cost from Node is exactly the loop above — time the same bulk
`INSERT` with and without the index, on the same data:

```js
const t0 = process.hrtime.bigint();
await pool.query(`INSERT INTO w_users (email, status, created_at)
                  SELECT 'u'||g||'@example.com', 'active', now()
                  FROM generate_series(1,$1) g`, [200000]);
console.log(`${(Number(process.hrtime.bigint() - t0) / 1e6).toFixed(0)} ms`);
```

## Trade-off

**Every index is a bet that the reads it accelerates are worth more than the writes it
slows and the disk it occupies.** On a read-heavy table the bet almost always pays. On a
high-write table — an events log, a job queue, an audit trail — three indexes doubling
your ingest rate is a real production cost, and the honest answer is often to index less
and accept a slower query on the rare read path.

There is no such thing as a free index, and no such thing as a table that is
"missing indexes" in the abstract. Indexes serve *queries*. Start from the query.

## Gotchas

**Symptom:** Inserts got slower after a release, no code changed
**Cause:** A migration added indexes; every writer now maintains them
**Fix:** `pg_indexes_size('t')` vs `pg_relation_size('t')`, then check `idx_scan` in
`pg_stat_user_indexes` — drop the ones at zero

**Symptom:** The disk filled up and the table is only a few GB
**Cause:** Indexes are counted separately and can exceed the heap several times over
**Fix:** `SELECT pg_size_pretty(pg_indexes_size('t'))`; audit for duplicates

**Symptom:** "We added an index and nothing got faster"
**Cause:** The query does not match the index — a function wraps the column, the type
differs, or the predicate is not selective
**Fix:** [Why an index is not used](05-index-not-used.md)

**Symptom:** A `text` index is enormous compared to an `int` one on the same table
**Cause:** Key width, not row count, drives index size
**Fix:** Index the narrow surrogate key where you can; consider a hash of long values

## Interview questions

**★ What does an index actually cost?**
Write time on every `INSERT`/`UPDATE`/`DELETE` that touches the indexed column, plus
disk. Measured: one index took a 200 000-row insert from 1239 ms to 2266 ms; three took
it to 4035 ms, with the indexes reaching 36 MB against 15 MB of data.

**★ Is a table with no indexes at all possible?**
Only without a primary key. A `PRIMARY KEY` or `UNIQUE` constraint is implemented *as* a
unique index — that is why the "no index" measurement above still shows 4408 kB.

**★ Should you index every column you filter on?**
No. Index the columns your actual slow queries filter on, verified with
`EXPLAIN (ANALYZE, BUFFERS)`. A column with two distinct values will usually be ignored
by the planner anyway — see [Why an index is not used](05-index-not-used.md).

**Why can indexes be larger than the table?**
Each index stores its key columns plus a row pointer, with per-page overhead, and there
can be many indexes on one table. 44 MB of indexes on a 29 MB table is unremarkable.

**How do you know an index is earning its cost?**
`idx_scan` in `pg_stat_user_indexes` counts how many times the planner chose it. Zero
over a full business cycle means it is only costing you.

---

← [Phase 10 index](README.md) · Next → [B-tree indexes](02-btree.md)
