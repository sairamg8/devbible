---
title: "What windows cost"
sidebar_label: "03 · What windows cost"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex36b-agg-plans.mjs`.

**Every window function needs its input sorted by `PARTITION BY` then `ORDER BY`. That
sort is the cost, and it dominates everything else: one window over 500 000 rows took
530 ms, of which the aggregate itself is a rounding error. Two windows that can share a
sort cost 999 ms; two that cannot cost 1518 ms.**

## One window

```sql
SELECT user_id, sum(amount) OVER (PARTITION BY user_id) FROM agg_events;
```

```console
--- F. one window
WindowAgg (actual rows=500000.00 loops=1)
  Window: w1 AS (PARTITION BY user_id)
  Storage: Memory  Maximum Storage: 20kB
  Buffers: shared hit=3783, temp read=1070 written=1076
  ->  Sort (actual rows=500000.00 loops=1)
        Sort Key: user_id
        Sort Method: external merge  Disk: 8560kB
        Buffers: shared hit=3783, temp read=1070 written=1076
        ->  Seq Scan on agg_events (actual rows=500000.00 loops=1)
              Buffers: shared hit=3783
Execution Time: 530.075 ms
  [best of 3: 530.08 ms | all: 530.1, 533.7, 579.1]
```

Three things to take from that plan:

**The `Sort` is the query.** Reading the table is 3783 buffers of cached pages; the sort
wrote 8560 kB to disk and moved 1070/1076 temp blocks. Compare the plain `count(*)` over
the same table at 26.73 ms — the aggregate is not what costs 530 ms, the ordering is.

**`Storage: Memory Maximum Storage: 20kB`** is the *window's own* buffer — the rows it
must hold to evaluate the frame — and it is tiny here because the frame is the partition
and `sum` is incremental. A frame requiring random access within the partition (`RANGE`
with an offset, `nth_value`) makes this number grow, and it can spill to `Storage: Disk`.
That is a genuinely useful field to watch and it is easy to miss.

**No parallelism.** There is no `Gather` in the plan. `WindowAgg` is not parallel-aware,
so a window over a large table is single-threaded — one of the few places where more CPU
cores do not help at all.

## Two windows that can share a sort

```sql
SELECT user_id,
       sum(amount) OVER (PARTITION BY user_id),
       rank()      OVER (PARTITION BY user_id ORDER BY amount)
FROM agg_events;
```

```console
--- G. two windows, same partition
WindowAgg (actual rows=500000.00 loops=1)
  Window: w2 AS (PARTITION BY user_id)
  ->  WindowAgg (actual rows=500000.00 loops=1)
        Window: w1 AS (PARTITION BY user_id ORDER BY amount ROWS UNBOUNDED PRECEDING)
        ->  Sort (actual rows=500000.00 loops=1)
              Sort Key: user_id, amount
              Sort Method: external merge  Disk: 8560kB
              Buffers: shared hit=3783, temp read=1070 written=1076
Execution Time: 999.057 ms
  [best of 3: 999.06 ms | all: 999.1, 1023.5, 1024.0]
```

**One `Sort`, two stacked `WindowAgg` nodes.** The sort key is `user_id, amount` — which
satisfies both windows, because `PARTITION BY user_id` needs rows grouped by `user_id`
and `PARTITION BY user_id ORDER BY amount` needs them grouped by `user_id` and ordered by
`amount` within each group. The first is a **prefix** of the second, so one sort serves
them both, and `temp read=1070 written=1076` is identical to the single-window case.

And it still cost **999 ms against 530 ms** — nearly double, with no extra sorting. So
the second `WindowAgg` node is not free either; passing 500 000 rows through another
window evaluation is real work. The lesson is not "windows are free if they share a sort",
it is "sharing a sort is the *large* saving available, and there is a smaller per-window
cost on top".

## Two windows that cannot

Change the second window's partition and watch the plan double:

```sql
SELECT user_id,
       sum(amount) OVER (PARTITION BY user_id),
       rank()      OVER (PARTITION BY kind ORDER BY amount)
FROM agg_events;
```

```console
--- H. two windows, different partitions
WindowAgg  (Window: w2 AS (PARTITION BY user_id))
  Buffers: shared hit=3783, temp read=3671 written=3686
  ->  Sort
        Sort Key: user_id
        Sort Method: external merge  Disk: 17504kB
        ->  WindowAgg  (Window: w1 AS (PARTITION BY kind ORDER BY amount …))
              Buffers: shared hit=3783, temp read=1483 written=1490
              ->  Sort
                    Sort Key: kind, amount
                    Sort Method: external merge  Disk: 11864kB
                    ->  Seq Scan on agg_events (actual rows=500000.00 loops=1)
Execution Time: 1517.685 ms
  [best of 3: 1517.68 ms | all: 1517.7, 1542.0, 1558.4]
```

**Two sorts, stacked.** `kind, amount` first for the `rank()`, then the whole 500 000-row
intermediate re-sorted by `user_id` for the `sum()`. Temp I/O goes from 1070/1076 blocks
to **3671/3686** — 3.4× — and the second sort spills 17504 kB, larger than the first
because it is sorting rows that now carry an extra computed column.

The summary, all three from the same table:

| Query | Sorts | Temp blocks | Time |
|---|---|---|---|
| one window | 1 | 1070 / 1076 | **530 ms** |
| two windows, same partition | 1 | 1070 / 1076 | **999 ms** |
| two windows, different partitions | 2 | 3671 / 3686 | **1518 ms** |

> **Design rule: windows in the same query should share a `PARTITION BY` wherever the
> report allows it.** Two rankings partitioned differently is a second sort of the whole
> result, and it is the most common reason a "just one more column" change triples a
> report's runtime.

Where the report genuinely needs both, consider whether the second one belongs in a
separate query — two 530 ms queries in parallel from the application beat one 1518 ms
query, and neither of them is parallelisable inside PostgreSQL.

## Removing the sort with an index

If an index already delivers rows in the window's order, the `Sort` disappears entirely:

```console
--- F2. one window, with agg_ev_user_amt (user_id, amount DESC)
WindowAgg (actual rows=500000.00 loops=1)
  Window: w1 AS (PARTITION BY user_id)
  Storage: Memory  Maximum Storage: 20kB
  Buffers: shared hit=575
  ->  Index Only Scan using agg_ev_user_amt on agg_events (actual rows=500000.00 loops=1)
        Heap Fetches: 0
        Index Searches: 1
        Buffers: shared hit=575
Execution Time: 283.290 ms
  [best of 3: 283.29 ms | all: 283.3, 286.6, 336.1]
```

**530.08 ms → 283.29 ms, and the disk sort is gone.** `Buffers` drops from 3783 to
**575** and `temp read/written` disappears completely, because the index is both narrower
than the table and already in `user_id` order.

This is the single most effective thing you can do about window cost, and it has a
precise condition: **the index's leading columns must match `PARTITION BY` followed by
`ORDER BY`.** An index on `(user_id, amount DESC)` serves `PARTITION BY user_id ORDER BY
amount DESC` and also the weaker `PARTITION BY user_id`; it does **not** serve
`PARTITION BY kind`.

The `Incremental Sort` node is the partial version of this: when an index provides the
partition key but not the ordering key, PostgreSQL sorts within each partition group
rather than sorting everything. You can see it in the
[ranking](../ranking/) plans.

## Trade-off

Windows buy expressiveness that would otherwise cost a self-join or a second round trip,
and they charge a full sort of the input — single-threaded, spilling to disk past
`work_mem`. On a paginated page of 20 rows this is invisible. On a full-table report it is
the dominant cost, and the levers are, in order: filter harder before the window, make
the windows share a partition, add an index matching `PARTITION BY` + `ORDER BY`, raise
`work_mem` for that statement. Adding CPU is not on the list, because `WindowAgg` does not
parallelise.

## Gotchas

**Symptom:** a report got much slower after one extra window column was added
**Cause:** the new window partitions differently, so the whole intermediate result is
sorted a second time. Measured 999 ms → 1518 ms, temp blocks 1070 → 3671
**Fix:** align the partitions if the report allows it, or move the second window into a
separate query

**Symptom:** a window query is slow and adding CPU cores does not help
**Cause:** `WindowAgg` is not parallel-aware — there is no `Gather` in the plan
**Fix:** reduce the input, or provide an ordered index so the sort disappears. Parallelism
is not available here

**Symptom:** `Sort Method: external merge Disk: …` under a `WindowAgg`
**Cause:** the sort exceeded `work_mem` and spilled
**Fix:** an index matching `PARTITION BY` + `ORDER BY` removes the sort entirely —
measured 530 ms → 283 ms and 3783 → 575 buffers. Failing that, `SET LOCAL work_mem`

**Symptom:** an index on the partition column did not remove the sort
**Cause:** the index's leading columns must match `PARTITION BY` **then** `ORDER BY`; an
index on `(kind)` does nothing for `PARTITION BY user_id`
**Fix:** match the column order. Look for `Incremental Sort` — it means the index gave a
prefix and PostgreSQL is sorting the rest per group

**Symptom:** `Storage: Disk` on the `WindowAgg` node itself, not the sort
**Cause:** the frame requires holding many rows — a wide `RANGE`/`GROUPS` frame, or
`nth_value`/`last_value` over the whole partition
**Fix:** narrow the frame if the report allows, or raise `work_mem` for the statement

**Symptom:** two windows look identical but the plan has two `WindowAgg` nodes
**Cause:** they are identical — PostgreSQL uses one node per distinct window *definition*,
and stacks them; two nodes over one sort is the expected shape for two definitions
**Fix:** nothing to fix. Two nodes over **one** `Sort` is the good case; two `Sort`s is
the one to worry about

## Interview questions

**★ What dominates the cost of a window function?**
The sort of its input by `PARTITION BY` then `ORDER BY`. Measured: one window over
500 000 rows took 530 ms, of which the scan was 3783 cached buffers and the sort spilled
8560 kB to disk. A plain `count(*)` over the same table is 27 ms.

**★ Two window functions in one query — when is the second one cheap?**
When its window definition shares a sort with the first, i.e. one partition/order spec is
a prefix of the other. Measured: same partition → one `Sort`, 999 ms; different partitions
→ two `Sort`s, 1518 ms and 3.4× the temp I/O. "Cheap" is relative — the second window
still cost 470 ms even sharing a sort.

**★ Can window functions run in parallel?**
No. `WindowAgg` is not parallel-aware, so there is no `Gather` in the plan and extra cores
do not help. This is one of the few PostgreSQL operations with no parallel path.

**★ How do you make a window query avoid its sort?**
Provide a btree index whose leading columns are `PARTITION BY` followed by `ORDER BY`.
Measured: `(user_id, amount DESC)` turned a 530 ms plan with an 8560 kB disk sort into a
283 ms index-only scan with 575 buffers and no temp I/O.

**What does `Storage: Memory Maximum Storage: 20kB` on a `WindowAgg` mean?**
It is the window's own row buffer — how much it must retain to evaluate the frame. Small
for incremental aggregates over the whole partition; it grows for frames needing random
access, and can become `Storage: Disk`.

**You need two rankings partitioned differently in one report. What are the options?**
Accept the second sort; or split into two queries the application runs concurrently,
since neither parallelises internally and 2 × 530 ms overlapped beats 1518 ms serial; or
pre-aggregate one of the rankings if it is over a coarser grain.

---

← [Where windows run](02-where-windows-run.md) · Next topic → [Ranking functions](../ranking/)
