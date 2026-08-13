---
title: "Index-only scans, INCLUDE and the visibility map"
sidebar_label: "08 · Index-only scans"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex25-index-kinds.mjs`.

**An index-only scan answers the query from the index and never touches the table — but
only if every selected column is in the index *and* the visibility map says the heap
pages are all-visible. `VACUUM` is what sets that bit, which is why a freshly loaded
table does not get index-only scans.**

## It needs `VACUUM`, not just a covering index

400 000 rows, index on `user_id`, query selects only `user_id` — perfectly covered:

```console
$ node ex25-index-kinds.mjs
-- covered query, table never vacuumed --
Bitmap Heap Scan on i_orders (actual time=0.377..1.738 rows=6020.00 loops=1)
  Recheck Cond: ((user_id >= 100) AND (user_id <= 400))
  Heap Blocks: exact=64
  Buffers: shared hit=66 read=7
  ->  Bitmap Index Scan on i_orders_user_idx (actual time=0.344..0.345 rows=6020.00 loops=1)
Execution Time: 2.300 ms

visibility map pages: 0
```

`relallvisible = 0`. The index has the data, but PostgreSQL still has to check the heap
to know whether each row is visible to this transaction, so it does not bother with an
index-only scan.

```console
after VACUUM, relallvisible = 2893 of 2944 pages

-- same query after VACUUM --
Index Only Scan using i_orders_user_idx on i_orders (actual time=0.021..0.814 rows=6020.00 loops=1)
  Index Cond: ((user_id >= 100) AND (user_id <= 400))
  Heap Fetches: 0
  Index Searches: 1
  Buffers: shared hit=10
Execution Time: 1.231 ms
```

**73 buffers → 10. `Heap Fetches: 0`.** The heap was never opened.

`Heap Fetches` is the number to watch. It is not all-or-nothing: a partly-visible table
gives an index-only scan that still visits the heap for some rows.

## One write undoes it

```console
after ONE update, heap fetches on the covered query: 58 (was 0)
```

A single `UPDATE` dirtied one page, clearing its all-visible bit — and the scan went from
0 heap fetches to 58. **On a table with steady writes, index-only scans are partial by
nature.** Autovacuum restores the bits; falling behind on autovacuum quietly removes this
optimisation.

## `INCLUDE`: payload columns that are not part of the key

Add one column the index does not have and the index-only scan disappears:

```console
-- add one column that is not in the index --
Bitmap Heap Scan on i_orders → 1.811 ms | hit=73
with INCLUDE (amount) only: Index Only Scan using i_orders_user_inc_idx → 1.526 ms | hit=3 read=24
```

```sql
CREATE INDEX i_orders_user_inc_idx ON i_orders (user_id) INCLUDE (amount);
```

`amount` is stored in the index leaves but is **not** part of the sort key. It can be
*returned*, never *searched* or *ordered*:

```console
WHERE amount = 42.0 — searchable in a KEY column, not in an INCLUDE column:
  (user_id, amount) present : ->  Parallel Seq Scan on i_orders → 41.302 ms
  only INCLUDE (amount)     : ->  Parallel Seq Scan on i_orders → 40.835 ms
```

Neither helps here — `amount` is not the leading column in either — but the
`ORDER BY` case shows the difference plainly:

```console
  ORDER BY an INCLUDE column — note the explicit Sort node:
Limit (actual time=0.070..0.072 rows=5.00 loops=1)
  ->  Sort (actual time=0.069..0.070 rows=5.00 loops=1)
        Sort Key: amount
        Sort Method: top-N heapsort  Memory: 25kB
        ->  Index Only Scan using i_orders_user_inc_idx on i_orders
              Index Cond: (user_id = 42)
              Heap Fetches: 0
```

The index served the equality and supplied `amount` without a heap fetch — then
PostgreSQL had to **`Sort`** it. A key column would have come out pre-sorted.

## `INCLUDE` versus a wider key

```console
index sizes — key only / INCLUDE / two-column key:
┌─────────┬─────────────────────────┬───────────┐
│ (index) │ name                    │ size      │
├─────────┼─────────────────────────┼───────────┤
│ 0       │ 'i_orders_user_amt_idx' │ '12 MB'   │
│ 1       │ 'i_orders_user_idx'     │ '3056 kB' │
│ 2       │ 'i_orders_user_inc_idx' │ '12 MB'   │
└─────────┴─────────────────────────┴───────────┘
```

**Identical size here.** `INCLUDE` is often described as the cheaper option; on this data
it was not. The honest reasons to choose `INCLUDE` over a wider key are:

- The extra column has **no B-tree operator class** (you cannot key on it at all).
- The index is **`UNIQUE`** and adding the column to the key would change what is unique
  — this is the case where `INCLUDE` is not merely preferable but the only correct answer.
- The extra column is only ever *returned*, so keeping it out of the key keeps the
  internal pages narrower and the tree shallower.

Both are 4× the key-only index. A covering index is not free.

## In SQL

```sql
CREATE INDEX ON i_orders (user_id) INCLUDE (amount);
CREATE UNIQUE INDEX ON users (email) INCLUDE (display_name);  -- uniqueness still on email alone

VACUUM i_orders;   -- sets the visibility map; without it, no index-only scan
SELECT relallvisible, relpages FROM pg_class WHERE relname = 'i_orders';
```

## From Node

The application-side shape is: **select fewer columns**. `SELECT *` guarantees a heap
visit; naming the two columns you need can turn the same query into an index-only scan.

```js
// heap visit for every row
await pool.query(`SELECT * FROM i_orders WHERE user_id BETWEEN $1 AND $2`, [100, 400]);

// index-only, given (user_id) INCLUDE (amount) and a vacuumed table
await pool.query(`SELECT user_id, amount FROM i_orders WHERE user_id BETWEEN $1 AND $2`,
                 [100, 400]);
```

Verify with `Heap Fetches` rather than assuming:

```js
const p = await pool.query(
  `EXPLAIN (ANALYZE, BUFFERS) SELECT user_id, amount FROM i_orders WHERE user_id = $1`, [42]);
const text = p.rows.map(r => r['QUERY PLAN']).join('\n');
console.log(text.match(/Heap Fetches: (\d+)/)?.[1]);   // '0' is the goal
```

## Trade-off

**A covering index buys the heap visit back at the price of a much larger index** — 12 MB
against 3056 kB here, on every write. And the benefit is conditional on `VACUUM` keeping
up: one update took `Heap Fetches` from 0 to 58, so on a write-heavy table you pay the
full index cost and collect only part of the benefit.

`INCLUDE` versus a wider key is a narrower decision than usually presented. Prefer
`INCLUDE` when the column cannot be a key, or when the index is unique and the key must
stay exactly as it is. Otherwise measure — on this table they were the same size, and the
key form could also serve `ORDER BY`.

## Gotchas

**Symptom:** Covering index exists, plan still shows a heap scan
**Cause:** Visibility map empty — the table has never been vacuumed
**Fix:** `VACUUM t`, then re-check; confirm with `relallvisible` in `pg_class`

**Symptom:** `Index Only Scan` with a large `Heap Fetches`
**Cause:** Recent writes cleared the all-visible bits
**Fix:** Let autovacuum catch up, or tune it for that table. Large `Heap Fetches` means
you are getting the index-only *plan* without the index-only *benefit*

**Symptom:** `ORDER BY` on an `INCLUDE` column still sorts
**Cause:** `INCLUDE` columns are payload, not sort key
**Fix:** Put it in the key if you need ordering

**Symptom:** Adding `INCLUDE` did not shrink the index versus a composite key
**Cause:** For a fixed-width trailing column there may be no saving at all
**Fix:** Measure with `pg_relation_size` before assuming

**Symptom:** Index-only scans work in staging, not production
**Cause:** Production has continuous writes; staging is static
**Fix:** Compare `Heap Fetches`, not the node name

## Interview questions

**★ What is an index-only scan and what does it require?**
The query is answered from the index alone. It requires every referenced column to be in
the index *and* the heap pages to be marked all-visible in the visibility map. Measured:
73 buffers before `VACUUM`, 10 after, with `Heap Fetches: 0`.

**★ Why does `VACUUM` affect it?**
`VACUUM` sets the visibility-map bits. Without them PostgreSQL must check each row's
visibility in the heap. Measured: `relallvisible` went from 0 to 2893 of 2944 pages.

**★ What is the difference between `INCLUDE (c)` and adding `c` to the key?**
`INCLUDE` columns are stored in the leaves only — returnable, not searchable or
sortable. Measured: `ORDER BY` an `INCLUDE` column produced an explicit `Sort` node. Use
`INCLUDE` when the column has no B-tree opclass, or when the index is unique and the key
must not change.

**What does `Heap Fetches` tell you?**
How many rows still needed a heap visit. Non-zero means the visibility map is stale — one
`UPDATE` took it from 0 to 58 in the measurement above.

**Does a covering index make `SELECT *` fast?**
No — `*` pulls columns that are not in the index, forcing the heap visit. Naming columns
is what enables the optimisation.

---

← [EXPLAIN ANALYZE BUFFERS](07-explain-buffers.md) · Next → [Partial indexes](09-partial.md)
