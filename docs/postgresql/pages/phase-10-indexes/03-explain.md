---
title: "EXPLAIN vs EXPLAIN ANALYZE"
sidebar_label: "03 · EXPLAIN"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex23-index-basics.mjs`.

**`EXPLAIN` shows the plan the planner would choose, using estimates. `EXPLAIN ANALYZE`
*runs the query* and adds what actually happened. The second word is not a modifier —
it is an execution.**

## The same query, both ways

```console
$ node ex23-index-basics.mjs
-- EXPLAIN (plan only, query NOT run) --
Finalize Aggregate  (cost=7316.90..7316.91 rows=1 width=8)
  ->  Gather  (cost=7316.69..7316.90 rows=2 width=8)
        Workers Planned: 2
        ->  Partial Aggregate  (cost=6316.69..6316.70 rows=1 width=8)
              ->  Parallel Seq Scan on b_events  (cost=0.00..6316.17 rows=208 width=0)
                    Filter: (bucket = 7)
```

```console
-- EXPLAIN ANALYZE (query actually run) --
Finalize Aggregate  (cost=7316.90..7316.91 rows=1 width=8) (actual time=24.754..30.021 rows=1.00 loops=1)
  Buffers: shared hit=3712
  ->  Gather  (cost=7316.69..7316.90 rows=2 width=8) (actual time=24.522..30.010 rows=3.00 loops=1)
        Workers Planned: 2
        Workers Launched: 2
        Buffers: shared hit=3712
        ->  Partial Aggregate  (cost=6316.69..6316.70 rows=1 width=8) (actual time=19.466..19.467 rows=1.00 loops=3)
              Buffers: shared hit=3712
              ->  Parallel Seq Scan on b_events  (cost=0.00..6316.17 rows=208 width=0) (actual time=0.072..19.430 rows=166.67 loops=3)
                    Filter: (bucket = 7)
                    Rows Removed by Filter: 166500
                    Buffers: shared hit=3712
Planning Time: 0.067 ms
Execution Time: 30.093 ms
```

Everything in the first output is a guess. Everything in `(actual ...)` is a fact.
`ANALYZE` also adds three lines the plain form can never have: **`Workers Launched`**
(planned ≠ launched is a real cause of surprise), **`Rows Removed by Filter`**, and
**`Execution Time`**.

## `ANALYZE` really runs it — including writes

```console
rows after plain EXPLAIN INSERT   : 0
rows after EXPLAIN ANALYZE INSERT: 1 ← ANALYZE wrote the row for real
surviving ids: 2
```

`EXPLAIN ANALYZE INSERT INTO e_proof VALUES (2)` inserted the row and **did not roll it
back**. The same is true for `UPDATE` and `DELETE`. If you want the plan for a
destructive statement without performing it, wrap it:

```sql
BEGIN;
EXPLAIN ANALYZE DELETE FROM orders WHERE created_at < '2020-01-01';
ROLLBACK;
```

## How to read the numbers

- **`cost=7316.69..7316.90`** — startup cost, then total cost, in arbitrary planner
  units. Not milliseconds. Only comparable *between plans for the same query*.
- **`actual time=0.072..19.430`** — milliseconds to first row, then to last row,
  **per loop**.
- **`loops=3`** — the node ran three times (two workers plus the leader here).
  **`actual time` and `rows` are per loop; multiply by `loops` for the total.**
  This is the single most misread part of a plan.
- **`rows=208` vs `rows=166.67`** — estimate against reality. A large gap is the thing
  to chase; see [`EXPLAIN (ANALYZE, BUFFERS)`](07-explain-buffers.md).
- **`Planning Time` vs `Execution Time`** — a query that plans in 0.067 ms and executes
  in 30 ms has a data problem; the reverse means too many partitions or joins.

`Execution Time` (30.093 ms) exceeds the top node's `actual time` (30.021 ms) because it
includes executor startup and shutdown.

## In SQL

```sql
EXPLAIN SELECT ...;                              -- estimates only, nothing runs
EXPLAIN (ANALYZE) SELECT ...;                    -- runs it
EXPLAIN (ANALYZE, BUFFERS) SELECT ...;           -- + real I/O, the option to always add
EXPLAIN (ANALYZE, BUFFERS, VERBOSE) SELECT ...;  -- + output column lists
EXPLAIN (COSTS OFF) SELECT ...;                  -- readable shape, good for docs and diffs
EXPLAIN (ANALYZE, FORMAT JSON) SELECT ...;       -- machine-readable
EXPLAIN (ANALYZE, SETTINGS) SELECT ...;          -- non-default planner GUCs in effect
```

## From Node

`EXPLAIN` is a statement like any other, so `pg` returns it as rows — one row per plan
line, in a column literally named `QUERY PLAN`:

```js
const plan = async (sql, params) =>
  (await pool.query(`EXPLAIN (ANALYZE, BUFFERS) ${sql}`, params))
    .rows.map(r => r['QUERY PLAN']).join('\n');

console.log(await plan('SELECT * FROM b_events WHERE bucket = $1', [7]));
```

Two things to be careful about:

- **`EXPLAIN` cannot be parameterised itself** — the query text must be interpolated,
  so only ever build it from your own literals, never from user input.
  See [Safe dynamic WHERE](../phase-9-api-crud/safe-dynamic-where/).
- **`EXPLAIN (ANALYZE)` from Node runs the statement**, including DML. In a test that
  matters.

`FORMAT JSON` is the better choice when you want to assert on a plan in a test:

```js
const [{['QUERY PLAN']: json}] = (await pool.query(
  `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT * FROM b_events WHERE sku = $1`,
  ['sku-0250000'])).rows;
console.log(json[0].Plan['Node Type']);   // 'Index Scan'
```

## Trade-off

**`EXPLAIN` is free and lies a little; `EXPLAIN ANALYZE` is honest and costs you the
query.** On a 30-second query, or an `UPDATE` on production, that cost is real —
`EXPLAIN` alone plus `pg_stat_statements` is often the right first move, with
`EXPLAIN ANALYZE` in a transaction you roll back when you need certainty.

There is also a measurement cost: `ANALYZE` instruments every node, which inflates
`Execution Time` on plans with millions of rows passing through cheap nodes. The shape
and the row counts stay trustworthy; treat the absolute time as an upper bound.

## Gotchas

**Symptom:** `EXPLAIN ANALYZE` on a `DELETE` deleted the rows
**Cause:** `ANALYZE` executes the statement — that is what it means
**Fix:** `BEGIN; EXPLAIN ANALYZE ...; ROLLBACK;`

**Symptom:** `actual time` on an inner node looks tiny but the query is slow
**Cause:** It is **per loop**; `loops=3` (or `loops=499`) multiplies it
**Fix:** Read `loops` first, then multiply

**Symptom:** The plan in `psql` differs from what the app gets
**Cause:** Different role, `search_path`, session GUCs, or a generic plan from a
prepared statement
**Fix:** Reproduce with the same role and database; check
[prepared statements](../phase-7-pg-driver/10-prepared.md) for the generic-plan switch

**Symptom:** `cost=` numbers compared across two different queries
**Cause:** Cost units are only meaningful within one query's plan space
**Fix:** Compare `Execution Time` and `Buffers` instead

## Interview questions

**★ What is the difference between `EXPLAIN` and `EXPLAIN ANALYZE`?**
`EXPLAIN` prints the chosen plan with estimated costs and rows without running the query.
`EXPLAIN ANALYZE` executes it and adds actual times, actual rows, loop counts and
`Rows Removed by Filter`.

**★ Is `EXPLAIN ANALYZE` safe to run on an `UPDATE`?**
No — it performs the update. Measured: `EXPLAIN ANALYZE INSERT` left the row in the
table. Wrap it in a transaction you roll back.

**★ A node says `actual time=0.072..19.430 rows=166.67 loops=3`. How long did it take?**
Roughly 19.4 ms × 3 ≈ 58 ms of work across the loops, producing about 500 rows total.
Both time and rows are per loop.

**What is `cost` measured in?**
Arbitrary planner units, anchored to `seq_page_cost = 1`. Useful for comparing candidate
plans for one query; meaningless as an absolute or across queries.

**Which options do you always add?**
`BUFFERS` — it is the only size-independent measure of work done, and in PostgreSQL 18 it
is included by default with `ANALYZE`. See
[`EXPLAIN (ANALYZE, BUFFERS)`](07-explain-buffers.md).

---

← [B-tree indexes](02-btree.md) · Next → [Seq vs index vs bitmap](04-scan-types.md)
