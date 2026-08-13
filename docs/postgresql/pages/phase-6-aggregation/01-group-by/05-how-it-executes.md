---
title: "How it executes"
sidebar_label: "05 · How it executes"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex36b-agg-plans.mjs`.

**PostgreSQL has two ways to group: build a hash table keyed by the grouping columns,
or sort the input and walk it. Which one you get is a costing decision driven by the
estimated number of groups and by `work_mem`, and on the same query over the same
500 000 rows the difference was 59 ms against 118 ms.**

## The two strategies

| | `HashAggregate` | `GroupAggregate` |
|---|---|---|
| Mechanism | hash table, one entry per group | sort by the key, then one pass |
| Needs | memory proportional to the **number of groups** | sorted input (a `Sort`, or an ordered index scan) |
| Output order | arbitrary (hash order) | sorted by the grouping key |
| Chosen when | groups fit in `work_mem` | groups are many, or the input is already sorted |
| Spills by | partitioning into batches (PG 13+) | the sort spilling to disk |

Neither is switchable per query in production, but both can be forced for diagnosis
with `SET enable_hashagg = off` / `SET enable_sort = off`, which is how you find out
what the alternative would have cost.

## 5000 groups, default `work_mem`

```sql
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF)
SELECT user_id, count(*) FROM agg_events GROUP BY user_id;
```

```console
--- B. 5000 groups over 500k
Finalize HashAggregate (actual rows=5000.00 loops=1)
  Group Key: user_id
  Batches: 1  Memory Usage: 409kB
  Buffers: shared hit=3783
  ->  Gather (actual rows=15000.00 loops=1)
        Workers Planned: 2
        Workers Launched: 2
        ->  Partial HashAggregate (actual rows=5000.00 loops=3)
              Group Key: user_id
              Batches: 1  Memory Usage: 409kB
              Worker 0:  Batches: 1  Memory Usage: 409kB
              Worker 1:  Batches: 1  Memory Usage: 409kB
              ->  Parallel Seq Scan on agg_events (actual rows=166666.67 loops=3)
Planning Time: 0.134 ms
Execution Time: 59.573 ms
  [best of 3: 59.57 ms | all: 59.6, 62.1, 62.7]
```

Four things in that plan are worth reading on sight:

**`Partial` / `Finalize`.** Aggregation is parallelised by splitting it in two. Each
worker aggregates its own slice into a partial result — `Partial HashAggregate`, three
times (the leader plus two workers, shown as `loops=3`) — and the leader merges them in
`Finalize HashAggregate`. This works only because the aggregates involved are
*combinable*: two partial `count`s add, two partial `sum`s add, two partial `avg`s
combine as (sum, count) pairs. `count(DISTINCT x)` is **not** combinable, which is the
whole story of [what counting costs](../02-count-variants/03-what-counting-costs.md).

**`Gather` vs `Gather Merge`.** `Gather` collects worker output in whatever order it
arrives. `Gather Merge` preserves a sort order and therefore requires each worker to
produce sorted output — so seeing it tells you a `Sort` or ordered scan is underneath.

**`Batches: 1`.** The hash table fit in memory in one pass. Anything above 1 means it
spilled.

**`Memory Usage: 409kB`.** 5000 groups of a small key and a `bigint` counter. This is
what must fit in `work_mem`, and it scales with **groups**, not with rows. Grouping 500
million rows into 4 buckets needs almost nothing; grouping 500 000 rows by a UUID needs
a lot.

### `actual rows=166666.67`

Not a typo and not a fraction of a row. Under parallelism the counts are reported as an
average per loop, and 500 000 / 3 = 166 666.67. Multiply by `loops` for the real total.
PostgreSQL 18 prints two decimal places, a change from older versions that rounded and
made the arithmetic not quite work out.

## Squeeze `work_mem` and the plan changes shape

```console
--- C. 5000 groups, work_mem = 64kB
Finalize GroupAggregate (actual rows=5000.00 loops=1)
  Group Key: user_id
  Buffers: shared hit=3801, temp read=1236 written=2300
  ->  Gather Merge (actual rows=15000.00 loops=1)
        ->  Sort (actual rows=5000.00 loops=3)
              Sort Key: user_id
              Sort Method: external merge  Disk: 144kB
              ->  Partial HashAggregate (actual rows=5000.00 loops=3)
                    Group Key: user_id
                    Batches: 5  Memory Usage: 129kB  Disk Usage: 3696kB
                    Worker 0:  Batches: 5  Memory Usage: 129kB  Disk Usage: 3608kB
                    ->  Parallel Seq Scan on agg_events (actual rows=166666.67 loops=3)
Execution Time: 117.679 ms
  [best of 3: 117.68 ms | all: 117.7, 118.3, 119.8]
```

**59.57 ms → 117.68 ms**, and the plan now spills twice over.

`Batches: 5` with `Disk Usage: 3696kB` is the hash aggregate spilling. Since
PostgreSQL 13 it partitions the input and processes it in batches rather than blowing
past `work_mem` — strictly better than the pre-13 behaviour of exceeding the limit, but
still I/O. Then `Sort Method: external merge Disk: 144kB` spills again to feed
`Gather Merge`, because the top node became a `GroupAggregate` and needs ordered input.
`temp read=1236 written=2300` is the same story in buffer terms.

Note what did *not* happen: the planner did not simply keep the hash plan and let it
spill. It re-costed the whole shape and chose sort-based finalisation. Low `work_mem`
changes which plan wins, not just how the winner behaves.

**`work_mem` is per sort or hash node per worker**, not per query and not per connection. This plan has three hash aggregates and three sorts live at once, so the real peak is a multiple of the setting. That is why raising `work_mem` globally to fix one report is how a server runs out of memory under concurrency — raise it only where it is needed:

```sql
SET LOCAL work_mem = '64MB';   -- inside a transaction, reverts on commit
```

## The same squeeze, with an index available

Now add `agg_ev_user_amt (user_id, amount DESC)` — 4616 kB — and repeat both:

```console
--- B2. 5000 groups, default work_mem, index present
Finalize HashAggregate … ->  Parallel Seq Scan on agg_events
  Buffers: shared hit=3783
  [best of 3: 83.22 ms | all: 83.2, 86.2, 94.4]

--- C2. 5000 groups, work_mem = 64kB, index present
Finalize GroupAggregate (actual rows=5000.00 loops=1)
  Group Key: user_id
  Buffers: shared hit=577
  ->  Gather Merge (actual rows=5548.00 loops=1)
        ->  Partial GroupAggregate (actual rows=1849.33 loops=3)
              Group Key: user_id
              ->  Parallel Index Only Scan using agg_ev_user_amt on agg_events
                    Heap Fetches: 0
                    Index Searches: 1
                    Buffers: shared hit=577
  [best of 3: 85.19 ms | all: 85.2, 85.7, 86.1]
```

**At default `work_mem` the index changes nothing** — B2 is the *same plan* as B, right
down to `Buffers: shared hit=3783`. A hash aggregate over a parallel sequential scan is
already the cheapest option, and reading 4616 kB of index to avoid it buys nothing.

That B2 clocked 83.22 ms against B's 59.57 ms is **not** an effect of the index. The
plans are byte-for-byte identical and read exactly the same pages; the 40% gap is
run-to-run variance on a shared machine. It is the single best argument on this page
for **comparing `Buffers` before comparing milliseconds** — buffers said "identical
work" while the clock said "40% worse", and buffers were right.

**At 64 kB the index genuinely helps**: 117.68 ms → **85.19 ms**, and `Buffers: shared
hit` collapses from 3801 to **577**, a 6.6× reduction in pages touched. There is no
`Sort` node and no spill anywhere, because an index on `(user_id, …)` already delivers
rows in `user_id` order, so `GroupAggregate` streams them and holds one group at a time.

That is the shape worth carrying: **`GroupAggregate` over an ordered index scan uses
O(1) memory regardless of group count.** It is the plan you want when the grouping key
is high-cardinality — group by `user_id` on a table with millions of users and the hash
table, not the scan, is the problem.

`Heap Fetches: 0` confirms a genuine index-only scan: the visibility map was current, so
no heap page was consulted. Details on
[index-only scans](../../phase-10-indexes/08-index-only.md).

## Few groups is not automatically cheaper

```console
--- A. 4 groups over 500k
Finalize GroupAggregate (actual rows=4.00 loops=1)
  Group Key: kind
  Buffers: shared hit=3803
  ->  Gather Merge (actual rows=12.00 loops=1)
        ->  Sort (actual rows=4.00 loops=3)
              Sort Key: kind
              Sort Method: quicksort  Memory: 25kB
              ->  Partial HashAggregate (actual rows=4.00 loops=3)
                    Group Key: kind
                    Batches: 1  Memory Usage: 32kB
                    ->  Parallel Seq Scan on agg_events (actual rows=166666.67 loops=3)
  [best of 3: 58.59 ms | all: 58.6, 60.5, 93.8]
```

58.59 ms for 4 groups against 59.57 ms for 5000 — effectively **the same**, despite a
1250× difference in group count. **The scan dominates.** Both plans read the same ~3783
buffers, and the aggregation itself is cheap either way.

The 4-group plan even pays for a `Sort`, and it is still free — because it sorts *four
rows per worker*, after the partial aggregate has already collapsed 166 666 rows down to
4. That is the ordering to internalise: **partial aggregation happens before the gather,
so everything above it operates on group counts, not row counts.** A `Sort` high in an
aggregate plan is usually harmless; a `Sort` below the aggregate is the one that costs.

The corollary is where grouping performance actually comes from: **if the query is a
sequential scan, the grouping is not your problem.** Reducing what reaches the aggregate
— a `WHERE` an index can serve, a narrower time range, a pre-aggregated rollup table —
is worth far more than any tuning of the aggregate node.

## Trade-off

`HashAggregate` is fast and unordered; `GroupAggregate` is memory-flat and ordered but
needs sorted input. You do not choose directly — you choose indirectly, through which
indexes exist and what `work_mem` is, and the planner re-decides whenever the estimates
move. The practical consequence is that **an aggregate query has no single performance
profile**: the same SQL was 59 ms or 118 ms depending on a server setting nobody on the
team may remember changing. Capture `EXPLAIN (ANALYZE, BUFFERS)` for the aggregates that
matter, and compare buffers rather than milliseconds.

## Gotchas

**Symptom:** an aggregate query is fast in staging and slow in production on the same
data volume
**Cause:** different `work_mem`, so production spilled (`Batches: 5`, `Disk Usage:`)
while staging did not
**Fix:** compare `Batches:` and `temp read/written` between the two plans, not the
timings. Raise with `SET LOCAL work_mem` for that statement, not globally

**Symptom:** raising `work_mem` fixed the report and the server later ran out of memory
**Cause:** `work_mem` is per sort/hash node **per worker**, and this plan had six of
them; multiply again by concurrent connections
**Fix:** `SET LOCAL work_mem` inside the transaction that needs it, so it reverts on
commit. Leave the global default alone

**Symptom:** two runs of the same query differ by 40% and you conclude something changed
**Cause:** wall-clock variance on a shared machine. Measured here: identical plans,
identical `Buffers: shared hit=3783`, 59.57 ms and 83.22 ms
**Fix:** compare `Buffers` first. If the buffer counts match, the plans are doing the
same work and the difference is noise

**Symptom:** `actual rows=166666.67` — a fractional row count
**Cause:** parallel plans report rows per loop as an average; multiply by `loops`
**Fix:** nothing to fix. `166666.67 × 3 = 500000`

**Symptom:** grouping by a high-cardinality column falls over on memory as the table
grows
**Cause:** `HashAggregate` memory scales with the number of **groups**, now in the
millions
**Fix:** provide a btree index whose leading column is the grouping key, so the planner
can stream a `GroupAggregate` over an ordered index scan in constant memory — measured
at 577 buffers against 3801

**Symptom:** you added an index on the grouping column and nothing got faster
**Cause:** at generous `work_mem` a hash aggregate over a parallel sequential scan is
already cheapest; the index only wins when memory is the binding constraint
**Fix:** check whether the query is scanning the whole table at all. If it is, the win
is in the `WHERE` clause, not the aggregate

## Interview questions

**★ What decides whether PostgreSQL uses `HashAggregate` or `GroupAggregate`?**
Cost, driven mainly by the estimated number of groups against `work_mem`, and by whether
sorted input is already available. Hash needs memory proportional to the group count;
sort-based needs ordered input but constant memory. An index on the grouping key makes
the second nearly free.

**★ What does `Batches: 5` mean in a `HashAggregate` node?**
The hash table did not fit in `work_mem`, so PostgreSQL partitioned the input and
processed it in five passes, spilling to disk (`Disk Usage: 3696kB` here). Since PG 13 it
spills rather than exceeding the limit. `Batches: 1` means it fit.

**★ Why can aggregation be parallelised at all, and which aggregate breaks it?**
Because `count`, `sum`, `min`, `max` and `avg` are combinable — workers produce partial
results and the leader merges them (`Partial`/`Finalize`). `count(DISTINCT x)` is not
combinable, because deduplication needs every value in one place.

**★ `work_mem` is 4 MB and the plan has three sorts across two workers. How much memory
can this query use?**
Up to `work_mem` per node per worker — well over 20 MB for one query, before you multiply
by concurrency. This is why global increases are dangerous and `SET LOCAL` is the tool.

**★ Two runs of the same query, same plan, 59 ms and 83 ms. What do you conclude?**
Nothing about the query. Both read `shared hit=3783`, so they did identical work; the
difference is machine noise. Comparing buffers before milliseconds is what keeps you
from chasing it.

**You group 500 000 rows into 4 buckets and into 5000 buckets. Which is faster?**
Neither, meaningfully — 58.59 ms and 59.57 ms. Both read the same buffers and the
sequential scan dominates. Grouping cost is usually scan cost; optimise what reaches the
aggregate.

**What does `Heap Fetches: 0` tell you?**
The index-only scan never consulted a heap page, because the visibility map showed the
pages all-visible. A non-zero value means the table needs vacuuming for this plan to pay
off.

---

← [Ordinals, aliases and DISTINCT](04-ordinals-and-distinct.md) ·
Next topic → [count variants](../count-variants/)
