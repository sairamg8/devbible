---
title: "The inlining rule"
sidebar_label: "02 · The inlining rule"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Scripts: `sandbox/pg-api/ex37-cte-subquery.mjs`,
> `sandbox/pg-api/ex37b-cte-inlining.mjs`.

**Before PostgreSQL 12 every CTE was an optimization fence: it ran on its own, produced a
full intermediate result, and the outer query filtered that. Since 12 the planner folds a
qualifying CTE into the surrounding query instead. Both behaviours are still reachable, and
the gap between them on the same query is 6×.**

## Inlined: the outer filter reaches the scan

```sql
WITH e AS (SELECT * FROM agg_events)
SELECT count(*) FROM e WHERE kind = 'refund' AND amount > 800;
```

```console
  -- 9a. CTE used once — inlined (PG12+), the WHERE reaches the scan
  Finalize Aggregate (actual rows=1.00 loops=1)
    Buffers: shared hit=3783
    ->  Gather (actual rows=3.00 loops=1)
          Workers Planned: 2
          Workers Launched: 2
          Buffers: shared hit=3783
          ->  Partial Aggregate (actual rows=1.00 loops=3)
                Buffers: shared hit=3783
                ->  Parallel Seq Scan on agg_events (actual rows=4328.67 loops=3)
                      Filter: ((amount > 800) AND (kind = 'refund'::text))
                      Rows Removed by Filter: 162338
                      Buffers: shared hit=3783
  Planning Time: 0.165 ms
  Execution Time: 27.382 ms
```

**There is no CTE in the plan at all.** No `CTE e`, no `CTE Scan` — the planner rewrote the
statement as if the CTE had never been written, pushed `kind = 'refund' AND amount > 800`
down to the scan, and then parallelised it. The CTE was a name, and names cost nothing.

## `MATERIALIZED`: the same query, fenced

```sql
WITH e AS MATERIALIZED (SELECT * FROM agg_events)
SELECT count(*) FROM e WHERE kind = 'refund' AND amount > 800;
```

```console
  -- 9b. same CTE marked MATERIALIZED — a fence, filter applied after
  Aggregate (actual rows=1.00 loops=1)
    Buffers: shared hit=3783, temp written=2668
    CTE e
      ->  Seq Scan on agg_events (actual rows=500000.00 loops=1)
            Buffers: shared hit=3783
    ->  CTE Scan on e (actual rows=12986.00 loops=1)
          Filter: ((amount > 800) AND (kind = 'refund'::text))
          Rows Removed by Filter: 487014
          Storage: Disk  Maximum Storage: 21344kB
          Buffers: shared hit=3783, temp written=2668
  Planning Time: 0.156 ms
  Execution Time: 176.158 ms
```

```console
  inlined : 28.42 ms
  MATERIALIZED : 174.49 ms
```

**6.1× slower, and the plan says exactly why.** Read the two against each other:

| | Inlined | `MATERIALIZED` |
|---|---|---|
| Where the filter runs | at the scan | above the `CTE Scan`, after the fact |
| Rows the filter discards | 162338 per worker | **487014**, all in one pass |
| Rows materialized | none | **500000** |
| Storage | none | **`Disk  Maximum Storage: 21344kB`**, `temp written=2668` |
| Parallelism | 2 workers | none — a fenced CTE is not parallelised |
| Time | 27.4 ms | 176.2 ms |

The fence forces all 500 000 rows through a tuplestore that does not fit in `work_mem`, so
it spills to disk — that is what `temp written=2668` and `Storage: Disk` mean — and only
then applies a filter that would have eliminated 97% of them at the scan. It also gives up
the parallel plan, because the CTE's `Seq Scan` runs alone.

**This is the shape of the classic "my CTE got slow after we upgraded" report, in reverse.**
Pre-12 code was written knowing the fence was there; if a query relied on it to keep a
cheap intermediate result small, inlining can change the plan under it. Far more often the
fence was never wanted and the upgrade made things faster.

## What actually decides it

Measured one variable at a time, reading the verdict off the plan — an inlined CTE leaves
no `CTE <name>` node behind:

```console
=== A. what decides inlining — one variable at a time ===
1 reference, plain                                   inlined
2 references, plain                                  MATERIALIZED (fenced)
2 references, NOT MATERIALIZED                       inlined
1 reference, MATERIALIZED                            MATERIALIZED (fenced)
1 reference, VOLATILE function in the target list    MATERIALIZED (fenced)
1 reference, STABLE function (now())                 inlined
1 reference, VOLATILE in WHERE                       MATERIALIZED (fenced)
1 reference, data-modifying                          MATERIALIZED (fenced)
1 reference, contains LIMIT                          inlined
recursive, 1 reference                               MATERIALIZED (fenced)
```

A CTE is inlined when **all five** of these hold:

1. it is referenced **exactly once**,
2. it is **not** marked `MATERIALIZED`,
3. it is **not** recursive,
4. it does **not** write (no `INSERT`/`UPDATE`/`DELETE`/`MERGE`), and
5. it contains **no volatile function**.

Two of those surprise people, and both are worth dwelling on.

## `LIMIT` does not make a CTE a fence

It is a widespread belief — *"I put a `LIMIT` in the CTE so it only reads 10 rows first"*.
The CTE is still inlined. What protects the meaning is that the `Limit` node stays *below*
the outer filter:

```console
  -- LIMIT inside the CTE — filter sits above the Limit, so semantics are preserved
    Aggregate
      ->  Subquery Scan on e
            Filter: (e.kind = 'refund'::text)
            ->  Limit
                  ->  Index Scan using agg_events_pkey on agg_events
```

```console
LIMIT inside an inlined CTE stays a LIMIT: [{"n":5}]
  10 rows survive the CTE, then the filter -> 5, NOT "first 10 rows with id>5"
```

**Inlining is a rewrite that must not change the answer.** Ten rows are taken, then
filtered down to five — the planner will not push the filter past the `Limit`, because that
would produce a different result. So a `LIMIT` inside a CTE gives you correct semantics and
no cost guarantee, which is the opposite of what it is usually assumed to give.

## Volatile means volatile, not "a function call"

`random()` in the target list fences. `random()` in the `WHERE` fences. `now()` does
**not** — it is `STABLE`, returning the same value for the whole statement, so evaluating
it once or a hundred times is indistinguishable and the rewrite is safe.

The rule is not "does it call a function" but **"could re-evaluating this change the
answer"**. That is the same volatility classification that decides whether an expression
can be indexed at all — an index expression must be `IMMUTABLE`, which is why
`created_at::date` is rejected with `42P17`
([measured in phase 10](../../phase-10-indexes/10-expression.md)).

| Class | Re-evaluation | CTE inlined? | Indexable? |
|---|---|---|---|
| `IMMUTABLE` | always same answer | yes | yes |
| `STABLE` | same within one statement | yes | no |
| `VOLATILE` | may differ per call | **no** | no |

## Trade-off

Inlining is why a CTE now costs nothing to write and is safe to use for readability
everywhere — the abstraction is free. The price is that the abstraction is *only*
readability: the boundary a CTE draws on the page is not one the executor respects, so a
CTE cannot be used to control execution order and cannot be assumed to keep an intermediate
result small. When you do fence it, you pay the full materialization — every row, spilled
to disk if it does not fit `work_mem`, and no parallelism above it.

## Gotchas

**Symptom:** a CTE that was fast on PostgreSQL 11 is slow on 12+, or vice versa
**Cause:** the CTE used to be an unconditional optimization fence and now is inlined
**Fix:** compare `EXPLAIN (ANALYZE, BUFFERS)` on both shapes and add `MATERIALIZED` only if
the fenced plan is genuinely better

**Symptom:** `MATERIALIZED` made a query several times slower
**Cause:** the fence stops the outer `WHERE` reaching the scan, materialises every row, and
loses parallelism. Measured: 500 000 rows into a tuplestore that spilled 21344 kB to disk,
28.42 ms → 174.49 ms
**Fix:** drop the keyword unless the query depends on the fence

**Symptom:** a `LIMIT` inside a CTE does not restrict what the outer query scans
**Cause:** the CTE is inlined; `LIMIT` never made it a fence
**Fix:** it does not need one — the `Limit` node stays below the outer filter, so the
answer is right. If you want the fence for cost reasons, say `MATERIALIZED`

**Symptom:** a CTE using `random()` or `clock_timestamp()` will not inline however it is
written
**Cause:** volatile functions are excluded from inlining because re-evaluation could change
the answer
**Fix:** nothing to fix — that is the correct behaviour. If you wanted one evaluation, you
already have it

## Interview questions

**★ Is a CTE an optimization fence in PostgreSQL?**
Not since 12, and only conditionally. A CTE is inlined when it is referenced exactly once,
is not marked `MATERIALIZED`, is not recursive, does not write, and contains no volatile
function. Otherwise it is materialized. Before 12 it was always a fence.

**★ What does `MATERIALIZED` cost when it is not needed?**
Measured on 500 000 rows: 28.42 ms inlined versus 174.49 ms fenced — 6.1×. The plan shows
why: the filter moves from the scan to above the `CTE Scan` (487 014 rows discarded after
materialization instead of at the scan), all 500 000 rows go through a tuplestore that
spills 21344 kB to disk, and the parallel plan is lost.

**★ Does putting a `LIMIT` in a CTE make it a fence?**
No. The CTE is still inlined and the `Limit` stays below the outer filter, so the answer is
unchanged — 10 rows taken, then filtered to 5, not "the first 10 rows matching the filter".
A `LIMIT` protects semantics, not cost.

**★ Why does `random()` prevent inlining but `now()` does not?**
`random()` is `VOLATILE` — re-evaluating it per reference could produce different values,
so inlining could change the answer. `now()` is `STABLE`: constant for the whole statement,
so evaluating it once or many times is indistinguishable.

**How do you tell from a plan that a CTE was inlined?**
It leaves no trace — no `CTE <name>` node and no `CTE Scan`. That test answers only whether
there was a fence; see [the next chunk](03-references-and-hints.md) for why that is not the
same question as whether the optimization happened.

---

← [Naming a subquery](01-naming-a-subquery.md) · Next → [References, hints and the plan](03-references-and-hints.md)
