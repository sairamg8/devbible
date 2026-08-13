---
title: "Recursive CTEs"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex37-cte-subquery.mjs`.

**`WITH RECURSIVE` follows a parent pointer to arbitrary depth in one statement — a starting
set, and a rule for producing more rows from the rows you already have, repeated until the
rule produces nothing. It is the right tool for hierarchies and graphs, and the only
construct in this phase whose stopping condition lives in the data rather than in the
query.**

| # | Chunk | In one line |
|---|---|---|
| 01 | **[Walking a tree](01-walking-a-tree.md)** | anchor and recursive term, carrying depth and path, climbing versus descending, and reading `Recursive Union` / `WorkTable Scan` |
| 02 | **[Cycles, guards and limits](02-cycles-and-limits.md)** | 107 rows from an 8-row table, the three ways to stop a cycle, `CYCLE`, `SEARCH`, and the three errors |

## The shape

```sql
WITH RECURSIVE t AS (
  SELECT ... FROM tbl WHERE <starting condition>     -- anchor, runs once
  UNION ALL
  SELECT ... FROM tbl JOIN t ON <link>               -- runs on the previous iteration's rows
  WHERE t.depth < 40                                 -- the guard that is not optional
)
SELECT ... FROM t;
```

## Phase gate

You are done when you can write a breadcrumb query and a subtree aggregate without
reference, read `loops=` on a `Recursive Union` as the depth, and name three ways to stop a
cycle with the trade-off of each.

## Where this connects

- **[CTEs (WITH)](../ctes/)** — the non-recursive form, and why `RECURSIVE` also lifts the
  forward-reference restriction for every CTE in the list
- **[generate_series](../../phase-4-crud/18-generate-series.md)** — the better tool when the
  next value is a pure function of the last
- **[Timeouts](../../phase-7-pg-driver/11-timeouts.md)** — `statement_timeout` as the
  backstop for a runaway recursion, and why the driver's own timeout is not one
- **[Indexes](../../phase-10-indexes/)** — why the parent column needs one: the recursive
  term joins on it once per iteration

---

← [Phase index](../README.md) · Start → [Walking a tree](01-walking-a-tree.md)
