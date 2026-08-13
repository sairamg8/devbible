---
title: "Top-N per group"
sidebar_label: "02 · Top-N per group"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Scripts: `sandbox/pg-api/ex36-aggregation.mjs`,
> `sandbox/pg-api/ex36b-agg-plans.mjs`.

**"The three most recent orders for each customer" has three standard implementations
and no universal winner. On this table the `row_number` version was fastest, the
`LATERAL` version timed out at 30 seconds, and adding the obvious index made the winner
**slower** while multiplying its buffer reads by 132×.**

## The three shapes

```sql
-- 1. row_number + filter
SELECT user_id, id FROM (
  SELECT user_id, id,
         row_number() OVER (PARTITION BY user_id ORDER BY amount DESC NULLS LAST) rn
  FROM agg_events
) s WHERE rn <= 3;

-- 2. DISTINCT ON — top 1 only
SELECT DISTINCT ON (user_id) user_id, id
FROM agg_events ORDER BY user_id, amount DESC NULLS LAST;

-- 3. LATERAL — a correlated LIMIT per group
SELECT u.user_id, e.id
FROM (SELECT DISTINCT user_id FROM agg_events) u
CROSS JOIN LATERAL (
  SELECT id FROM agg_events e WHERE e.user_id = u.user_id
  ORDER BY amount DESC NULLS LAST LIMIT 3
) e;
```

On the small fixture all three agree, and `DISTINCT ON` is the shortest way to write
top-1:

```console
top-1 per group        : [{"team":"blue","name":"Eve","pts":9},{"team":"red","name":"Ann","pts":10}]
DISTINCT ON equivalent : [{"team":"blue","name":"Eve","pts":9},{"team":"red","name":"Ann","pts":10}]
```

`DISTINCT ON` cannot do top-**N** for N > 1 — it keeps exactly one row per key. For
anything else it is between shapes 1 and 3.

## `Run Condition` — the optimisation that makes shape 1 good

```console
--- I. top-3 per user with row_number   [no index]
Subquery Scan on s (actual rows=15000.00 loops=1)
  Buffers: shared hit=3783, temp read=1591 written=1597
  ->  WindowAgg (actual rows=15000.00 loops=1)
        Window: w1 AS (PARTITION BY user_id ORDER BY amount ROWS UNBOUNDED PRECEDING)
        Run Condition: (row_number() OVER w1 <= 3)
        Storage: Memory  Maximum Storage: 17kB
        ->  Sort (actual rows=500000.00 loops=1)
              Sort Key: user_id, amount DESC NULLS LAST
              Sort Method: external merge  Disk: 12728kB
              ->  Seq Scan on agg_events (actual rows=500000.00 loops=1)
Execution Time: 434.740 ms
  [best of 3: 434.74 ms | all: 434.7, 436.0, 443.4]
```

**`Run Condition: (row_number() OVER w1 <= 3)`** is the line to notice. The filter you
wrote in the *outer* query has been pushed **into** the window node — so `WindowAgg`
emits `actual rows=15000` rather than 500 000, stopping each partition after three rows
instead of numbering all hundred and discarding ninety-seven.

This is a PostgreSQL 15+ optimisation and it is what makes the subquery form idiomatic
rather than merely correct. It applies to monotonic window functions — `row_number`,
`rank`, `dense_rank`, `count` — where the planner can prove that once the condition fails
it will keep failing within the partition.

The `Sort` below it still processes all 500 000 rows. That is the irreducible cost:
you cannot know a row is in a user's top 3 without ordering that user's rows.

## The index that made it worse

The obvious next move is an index matching the window — `(user_id, amount DESC)`. It
backfired:

```console
--- I2. top-3 per user with row_number   [index present]
Subquery Scan on s (actual rows=15000.00 loops=1)
  Buffers: shared hit=500574
  ->  WindowAgg (actual rows=15000.00 loops=1)
        Run Condition: (row_number() OVER w1 <= 3)
        ->  Incremental Sort (actual rows=500000.00 loops=1)
              Sort Key: user_id, amount DESC NULLS LAST
              Presorted Key: user_id
              Full-sort Groups: 5000  Sort Method: quicksort  Average Memory: 27kB
              Pre-sorted Groups: 5000  Sort Method: quicksort  Average Memory: 28kB
              ->  Index Scan using agg_ev_user_amt on agg_events (actual rows=500000.00 loops=1)
                    Buffers: shared hit=500574
Execution Time: 533.671 ms
  [best of 3: 533.67 ms | all: 533.7, 537.5, 537.9]
```

| | no index | with index |
|---|---|---|
| Time | **434.74 ms** | 533.67 ms |
| `Buffers: shared hit` | **3783** | **500574** |
| Sort | external merge, 12728 kB to disk | `Incremental Sort`, in memory |

**The index removed the disk sort and made the query slower**, because it replaced a
sequential scan of 3783 cached pages with an **`Index Scan`** that read **500574**
buffers — 132× more.

The cause is one word in the plan: `Index Scan`, not `Index Only Scan`. The query selects
`id`, and `id` is not in `agg_ev_user_amt (user_id, amount DESC)`. So for every one of the
500 000 index entries PostgreSQL went to the heap to fetch `id` — a random-access visit
per row, against a sequential scan that reads each page once.

Two lessons, and the second is the transferable one:

- **Covering matters more than ordering here.** `CREATE INDEX … (user_id, amount DESC)
  INCLUDE (id)` would give an index-only scan and win properly. The index as built does
  the *ordering* job and fails the *fetching* job.
- **A disk sort is not automatically the thing to eliminate.** 12728 kB of sequential
  temp-file I/O beat 500 000 random heap visits. `Buffers` is what showed this; the
  timings alone (434 vs 534 ms) understate it badly, and would have looked like noise.

## LATERAL: the shape that fell off a cliff

```console
--- J. top-3 per user with LATERAL  [no index]
  -> 57014 canceling statement due to statement timeout  (statement_timeout = 30s)
```

**Over 30 seconds, against 434 ms.** With no index on `user_id`, the correlated subquery
runs 5000 times and each run is a sequential scan of the whole 500 000-row table. That is
5000 × 3783 pages of work, and it is why the script caps it rather than waiting.

With the index it becomes viable but still loses:

```console
--- J2. top-3 per user with LATERAL   [index present]
Nested Loop (actual rows=15000.00 loops=1)
  Buffers: shared hit=519354
  ->  HashAggregate (actual rows=5000.00 loops=1)   -- the DISTINCT user_id driver
        ->  Gather … Parallel Seq Scan on agg_events
  ->  Limit (actual rows=3.00 loops=5000)
        ->  Sort (actual rows=3.00 loops=5000)
              Sort Key: e.amount DESC NULLS LAST
Execution Time: 906.592 ms
  [best of 3: 906.59 ms | all: 906.6, 911.0, 922.1]
```

`loops=5000` is the tell — the inner query really did run once per user.

## The comparison, and why it contradicts the joins phase

| Approach | No index | With `(user_id, amount DESC)` |
|---|---|---|
| `row_number` + `Run Condition` | **434.74 ms** / 3783 buffers | 533.67 ms / 500574 buffers |
| `DISTINCT ON` (top-1 only) | 546.62 ms | — |
| `LATERAL` | **> 30 000 ms** (timeout) | 906.59 ms / 519354 buffers |

[Phase 5 measured `LATERAL` winning](../../phase-5-joins/10-lateral.md) for top-N per
group. Here it loses by 2× at best and catastrophically at worst. Both results are
correct, and the difference is the **number of groups relative to the table size**:

- **`LATERAL` wins when the driving set is small** and each probe is a cheap indexed
  lookup. A few hundred customers against millions of orders: 300 index probes beat
  sorting millions of rows.
- **`row_number` wins when the driving set is large.** 5000 users out of 500 000 rows
  means the `LATERAL` does 5000 probes covering the whole table anyway — at which point
  one sequential scan plus one sort is strictly less work.

The question to ask is: **how many groups, and does an index make each probe cheap?**
Roughly, if the number of groups approaches a meaningful fraction of the row count, use
`row_number`; if groups are few and well-indexed, use `LATERAL`.

There is a third consideration that decides it more often than performance does:
`LATERAL` can apply a `LIMIT` **and** an `OFFSET` per group, and can call a
set-returning function per group. `row_number` cannot page inside a group without
numbering everything first.

## Choosing

| Situation | Use |
|---|---|
| Top **1** per group, PostgreSQL only | `DISTINCT ON` — shortest, and one whole consistent row |
| Top N, many groups | `row_number()` + `WHERE rn <= N`, relying on `Run Condition` |
| Top N, few groups, indexed FK | `LATERAL` with `LIMIT` |
| Portable SQL | `row_number()` — `DISTINCT ON` is PostgreSQL-specific |
| Need per-group paging | `LATERAL` — it is the only one that takes an `OFFSET` |

And in every case: **the `ORDER BY` inside the window or the `LATERAL` needs a unique
tiebreaker**, or which rows make the top 3 is not stable.

## In Node

```js
const {rows} = await pool.query(
  `SELECT user_id, id, amount FROM (
     SELECT user_id, id, amount,
            row_number() OVER (PARTITION BY user_id
                               ORDER BY amount DESC NULLS LAST, id) AS rn
     FROM agg_events
     WHERE created_at >= $1
   ) s
   WHERE rn <= $2
   ORDER BY user_id, rn`,
  [since, perUser],
);
```

`WHERE created_at >= $1` on the inner query is doing the heavy lifting — it shrinks what
gets sorted, which is the only real lever. `, id` in the window's `ORDER BY` is the unique
tiebreaker. And `rn <= $2` as a parameter still gets the `Run Condition` treatment.

## Trade-off

`row_number` + filter is the portable, predictable choice and it always sorts the whole
input — you pay for ordering rows you will discard, mitigated but not removed by
`Run Condition`. `LATERAL` pays per group instead, which is a bargain with few groups and
a disaster with many, and it is the only form that supports per-group offsets. `DISTINCT
ON` is the cleanest for top-1 and does not generalise. Pick by group count first,
portability second.

## Gotchas

**Symptom:** a top-N-per-group query is fine in staging and hangs in production
**Cause:** a `LATERAL` whose correlated column is not indexed — each probe becomes a full
scan, once per group. Measured: over 30 s at 5000 groups against 434 ms for `row_number`
**Fix:** index the correlated column, or switch to `row_number` when groups are numerous

**Symptom:** you added the index the window's `ORDER BY` suggested and the query got
slower
**Cause:** it became an `Index Scan` rather than an `Index Only Scan`, because a selected
column is not in the index — 500574 buffers against 3783
**Fix:** `INCLUDE` the selected columns, or leave it on the sequential scan. Compare
`Buffers`, not milliseconds — the timings hid this

**Symptom:** which rows appear in the top 3 changes between runs
**Cause:** the window's `ORDER BY` is not unique, so `row_number` among tied rows is
arbitrary
**Fix:** append a unique tiebreaker to the window's `ORDER BY`

**Symptom:** `DISTINCT ON` cannot be made to return two rows per group
**Cause:** it is defined as one row per key
**Fix:** `row_number()` or `LATERAL` for N > 1

**Symptom:** the plan sorts 500 000 rows to return 15 000
**Cause:** inherent — a row's rank within its partition is not knowable without ordering
the partition. `Run Condition` limits what the *window* emits, not what the sort processes
**Fix:** filter before the window (a `WHERE` on the inner query), or provide a covering
ordered index

**Symptom:** you need rows 4–6 per group and `row_number` makes it awkward
**Cause:** `rn BETWEEN 4 AND 6` works but defeats `Run Condition`'s early stop only
partially
**Fix:** `LATERAL` with `LIMIT 3 OFFSET 3` — it is the only form that offsets per group

## Interview questions

**★ Three ways to write "top 3 per customer" — which is fastest?**
It depends on the number of groups. Measured with 5000 groups over 500 000 rows:
`row_number` + filter at 434.74 ms, `LATERAL` at over 30 s without an index and 906.59 ms
with one. With few groups and an indexed correlation, `LATERAL` wins instead — which is
what the joins phase measured.

**★ What is `Run Condition` in a window plan?**
A PostgreSQL 15+ optimisation that pushes an outer `WHERE rn <= N` into the `WindowAgg`
node, so it stops numbering each partition after N rows. Measured: the node emitted 15 000
rows instead of 500 000. It applies to monotonic window functions.

**★ You add an index matching the window's `PARTITION BY`/`ORDER BY` and the query gets
slower. What happened?**
It became an `Index Scan` rather than an `Index Only Scan` because a selected column is
not in the index, so every row cost a heap visit — 500574 buffers against 3783. Fix with
`INCLUDE`, or accept the sequential scan. A disk sort is not automatically worse than
random heap access.

**★ When can you use `DISTINCT ON` and when can you not?**
Top-1 per key only, and PostgreSQL only. It returns one whole consistent row per key with
the shortest syntax. For N > 1, or for portable SQL, use `row_number()`.

**Why does `LATERAL` collapse without an index on the correlated column?**
Because the inner query runs once per group — `loops=5000` in the plan — and without an
index each run is a full table scan. That turns a 3783-page read into 5000 of them.

**Which form supports per-group pagination?**
`LATERAL`, because it can take `LIMIT n OFFSET m` inside the correlated subquery. A
`row_number` filter can express `rn BETWEEN 4 AND 6` but must still number the rows before
it.

---

← [The four functions](01-the-four-functions.md) · Next topic → [lag and lead](../lag-lead/)
