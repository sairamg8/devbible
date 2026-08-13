---
title: "What counting costs"
sidebar_label: "03 · What counting costs"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Scripts: `sandbox/pg-api/ex36-aggregation.mjs`,
> `sandbox/pg-api/ex36b-agg-plans.mjs`, `sandbox/pg-api/ex36d-count-having.mjs`.

**Over the same 500 000 rows, counting cost between 27 ms and 209 ms depending only on
which form was used. The expensive one is `count(DISTINCT)`, for a structural reason —
it is the one aggregate here that cannot be parallelised — and the standard workaround
stops being a win the moment the right index exists.**

## The numbers

| Query | Time | Plan |
|---|---|---|
| `count(*)` | **26.73 ms** | parallel `Partial`/`Finalize Aggregate` |
| `count(1)` | 28.35 ms | identical |
| `count(id)` | 33.21 ms | identical |
| `count(amount)` | 31.25 ms | identical |
| `count(DISTINCT user_id)` | **208.87 ms** | single-threaded, external merge sort |
| `count(*) FROM (SELECT DISTINCT user_id …)` | **57.61 ms** | parallel `HashAggregate` |

All six read the same table. The spread from 26.73 ms to 208.87 ms is **7.8×**, and
none of it is I/O — every one of these plans reports `Buffers: shared hit=3783`, which
is the whole 40 MB table already in cache.

The top four are one result, not four: identical plans, identical buffers, a 6.5 ms band
with no stable ordering between them. Only the bottom two are a real difference, and the
rest of this page is about that difference.

## Why `count(DISTINCT)` is different

```console
--- D. count(DISTINCT user_id)
Aggregate (actual rows=1.00 loops=1)
  Buffers: shared hit=3783, temp read=735 written=737
  ->  Sort (actual rows=500000.00 loops=1)
        Sort Key: user_id
        Sort Method: external merge  Disk: 5880kB
        Buffers: shared hit=3783, temp read=735 written=737
        ->  Seq Scan on agg_events (actual rows=500000.00 loops=1)
Execution Time: 208.869 ms
  [best of 3: 208.87 ms | all: 208.9, 212.5, 228.6]
```

Two things are absent from that plan and both matter.

**There is no `Gather`.** Compare the plain `count(*)` plan, which has `Workers
Launched: 2` and a `Partial Aggregate` per worker. Parallel aggregation works by having
each worker produce a partial result that the leader combines — two partial counts add,
two partial sums add. **A distinct count cannot be combined that way**: worker A saw
user 7 and worker B saw user 7, and no arithmetic on their partial counts can discover
the overlap. Deduplication needs every value in one place, so PostgreSQL falls back to
a single process.

**There is no hash table either.** `count(DISTINCT)` de-duplicates by *sorting* the
input, and 500 000 values did not fit in `work_mem`, so it spilled: `Sort Method:
external merge Disk: 5880kB`, `temp read=735 written=737`. That is the difference
between 209 ms and the 58 ms the same de-duplication takes as a hash aggregate.

Note the run spread — `208.9, 212.5, 228.6` — wider than the tightly-clustered
sequential-scan counts, which is what temp-file I/O variance looks like.

## The rewrite

Move the `DISTINCT` into a subquery and count its rows:

```sql
SELECT count(*) FROM (SELECT DISTINCT user_id FROM agg_events) s;
```

```console
--- E. the DISTINCT-subquery rewrite
Aggregate (actual rows=1.00 loops=1)
  ->  HashAggregate (actual rows=5000.00 loops=1)
        Group Key: agg_events.user_id
        Batches: 1  Memory Usage: 281kB
        ->  Gather (actual rows=15000.00 loops=1)
              Workers Planned: 2
              Workers Launched: 2
              ->  HashAggregate (actual rows=5000.00 loops=3)
                    Group Key: agg_events.user_id
                    ->  Parallel Seq Scan on agg_events (actual rows=166666.67 loops=3)
Execution Time: 57.606 ms
  [best of 3: 57.61 ms | all: 57.6, 59.8, 59.8]
```

**208.87 ms → 57.61 ms, a 3.6× improvement**, and the plan explains exactly why. The
de-duplication is now an ordinary `DISTINCT`, which the planner is free to implement as
a `HashAggregate` — and `HashAggregate` *is* parallel-safe, because each worker
de-duplicates its own slice and the leader de-duplicates the 15 000 survivors. 281 kB
of memory, no spill, three processes.

The same trick applies to `count(DISTINCT)` inside a `GROUP BY`, where it matters more,
because there the sort happens per group:

```sql
-- one distinct count per kind, the slow way
SELECT kind, count(DISTINCT user_id) FROM agg_events GROUP BY kind;
-- the same, de-duplicated once
SELECT kind, count(*) FROM (SELECT DISTINCT kind, user_id FROM agg_events) s GROUP BY kind;
```

## …and why the rewrite is not a rule

Add a btree index whose leading column is the counted column — `agg_ev_user_amt
(user_id, amount DESC)`, 4616 kB — and run both again:

```console
--- D2. count(DISTINCT user_id)   [index present]
Aggregate (actual rows=1.00 loops=1)
  Buffers: shared hit=575
  ->  Index Only Scan using agg_ev_user_amt on agg_events (actual rows=500000.00 loops=1)
        Heap Fetches: 0
Execution Time: 63.528 ms
  [best of 3: 63.53 ms | all: 63.5, 68.1, 68.5]

--- E2. the DISTINCT-subquery rewrite   [index present]
  ->  HashAggregate … ->  Parallel Seq Scan on agg_events
  Buffers: shared hit=3783
  [best of 3: 76.21 ms | all: 76.2, 80.0, 86.1]
```

**The ranking flips.** `count(DISTINCT)` drops from 208.87 ms to **63.53 ms** and is
now *faster* than the rewrite's 76.21 ms.

The reason is that the index removes the sort entirely: an index on `(user_id, …)`
already delivers rows in `user_id` order, so the distinct aggregate can walk them and
count transitions, holding one value at a time. No sort, no spill, and **575 buffers
instead of 3783** — a 6.6× reduction in pages touched, because the 4.6 MB index is
cheaper to scan than the 40 MB table. It is still single-threaded and it still wins.

The rewrite, meanwhile, did not improve at all: it was already a parallel hash
aggregate over a sequential scan, and the index does not help that plan. At 76.21 ms it
is now the slower option.

**So the rule is not "always rewrite `count(DISTINCT)`".** It is:

| Situation | Faster |
|---|---|
| No index leading with the counted column | the `DISTINCT`-subquery rewrite (3.6× here) |
| Btree index leading with the counted column | plain `count(DISTINCT)` (it becomes an index-only scan) |
| Either way | check `EXPLAIN` rather than assume — the two differ by which plan is available, not by which SQL you wrote |

## When not to count at all

Everything above optimises a question you may not need to ask. An exact count over a
large filtered set is `O(matching rows)` no matter how it is planned, and the most
common reason to run one — a "showing 1–20 of N" footer — has cheaper answers:
planner estimates, `limit + 1` for a has-more flag, or an exact count capped at some
threshold. Measured, including the `limit+1` probe at **2.37 ms** against an exact
count at 52.59 ms, on [counting for pagination](../pagination-counts/).

## Trade-off

`count(DISTINCT)` is the clearest statement of intent and, on an unindexed column at
scale, the slowest thing in this phase — single-threaded and spilling to disk. The
rewrite buys 3.6× and costs readability: a reader now has to work out that the
subquery exists purely for the planner's benefit. The index buys more than the rewrite
does and costs 4.6 MB plus write amplification on every insert. Which one is right
depends on whether that column is worth an index for other reasons; if it is not, take
the rewrite and leave a comment saying why it is written that way.

## Gotchas

**Symptom:** a query with `count(DISTINCT)` is far slower than the row count suggests,
and does not get faster on a bigger machine
**Cause:** distinct aggregates cannot be parallelised — partial counts from different
workers cannot be combined without seeing the values — so the plan is single-threaded
**Fix:** rewrite as `count(*) FROM (SELECT DISTINCT col …)`, which the planner can
implement as a parallel `HashAggregate`. Measured 208.87 ms → 57.61 ms

**Symptom:** `temp read=…written=…` and `Sort Method: external merge` in a plan whose
query does not mention sorting
**Cause:** `count(DISTINCT)` de-duplicates by sorting, and the input exceeded `work_mem`
**Fix:** the rewrite above, an index on the column, or `SET LOCAL work_mem` for that
statement — in that order of preference

**Symptom:** the `DISTINCT`-subquery rewrite made a query slower
**Cause:** an index already let `count(DISTINCT)` run as an ordered index-only scan
(575 buffers, no sort); the rewrite forces a sequential scan instead
**Fix:** measure both. With the index present the plain form was 63.53 ms and the
rewrite 76.21 ms — the opposite of the unindexed case

**Symptom:** timings vary wildly between runs of the same count
**Cause:** the plan spills to disk, and temp file I/O is far less predictable than a
cached sequential scan. Measured spread: 208.9 / 212.5 / 228.6 ms
**Fix:** compare `Buffers` and `temp read/written` rather than wall-clock when judging
two plans

**Symptom:** `count(*)` on a big table is slow and someone suggests an index to fix it
**Cause:** an unfiltered `count(*)` must visit every row; PostgreSQL has no stored row
count, because MVCC means the answer depends on the asking transaction
**Fix:** an index-only scan on a narrow index can reduce the pages read, but the work
is still proportional to the rows. If the count is for a UI, do not compute it exactly

## Interview questions

**★ Why is `count(DISTINCT x)` so much slower than `count(x)`?**
Two reasons visible in the plan. It cannot be parallelised — partial distinct counts
from separate workers cannot be combined without seeing the underlying values — and it
de-duplicates by sorting, which spills to disk when the input exceeds `work_mem`.
Measured 208.87 ms vs 31.25 ms on 500 000 rows.

**★ How would you speed up `count(DISTINCT user_id)`?**
Either rewrite it as `count(*) FROM (SELECT DISTINCT user_id …)`, which the planner can
run as a parallel hash aggregate — 208.87 ms → 57.61 ms — or add a btree index leading
with `user_id`, which turns it into an ordered index-only scan at 63.53 ms and 575
buffers instead of 3783.

**★ Is the `DISTINCT`-subquery rewrite always faster?**
No. With a suitable index present it was *slower* — 76.21 ms against 63.53 ms — because
the plain form became an index-only scan while the rewrite stayed on a sequential scan.
The rewrite wins when no index leads with that column.

**★ Why can't PostgreSQL just keep a row count for `count(*)`?**
Because under MVCC the correct answer depends on the asking transaction's snapshot —
different transactions legitimately see different row counts at the same instant. A
single stored counter would also serialise every insert and delete.

**Two plans for the same count: one 58 ms, one 209 ms, both reading `shared hit=3783`.
What does that tell you?**
That the difference is not I/O — the table is fully cached in both — so it is CPU and
temp-file work. Here the slow plan added a 5880 kB external merge sort and gave up
parallelism. Comparing buffers first is what isolates that.

**Is `count(*)` slower than `count(1)`?**
No — measured 26.73 ms vs 28.35 ms, identical plans and buffers. The folklore is
imported from other engines. Nor is there a measurable penalty for counting a nullable
column here: `count(amount)` at 31.25 ms beat `count(id)` at 33.21 ms.

---

← [The LEFT JOIN trap and fan-out](02-left-join-and-fan-out.md) ·
Next topic → [HAVING vs WHERE](../having/)
