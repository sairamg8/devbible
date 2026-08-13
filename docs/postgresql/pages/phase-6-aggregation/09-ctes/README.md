---
title: "CTEs (WITH)"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Scripts: `sandbox/pg-api/ex37-cte-subquery.mjs`,
> `sandbox/pg-api/ex37b-cte-inlining.mjs`.

**`WITH` binds a name to a subquery for the length of one statement. That makes a
four-step report read as four named steps instead of four levels of nesting — and it is
almost the entire feature. The part that is not obvious is what the name does to the
*plan*: since PostgreSQL 12 a qualifying CTE is folded into the surrounding query rather
than executed as a boundary, and the keyword that restores the boundary costs 6× here.**

| # | Chunk | In one line |
|---|---|---|
| 01 | **[Naming a subquery](01-naming-a-subquery.md)** | the shape, chaining, scope and forward references, shadowing a table, where `WITH` may be attached, and CTE vs view vs temp table |
| 02 | **[The inlining rule](02-the-inlining-rule.md)** | inlined vs fenced on the same query, what `MATERIALIZED` costs, and why `LIMIT` and `now()` are not fences |
| 03 | **[References, hints and the plan](03-references-and-hints.md)** | referenced twice runs once, the hint the planner ignores, and why "no `CTE` node" is not the whole answer |

## The rule in one box

A CTE is **inlined** — folded into the outer query, no boundary — when all five hold:

1. referenced **exactly once**
2. not marked `MATERIALIZED`
3. not recursive
4. does not write (`INSERT`/`UPDATE`/`DELETE`/`MERGE`)
5. contains **no volatile function**

Otherwise it is materialized into a tuplestore. `NOT MATERIALIZED` asks for inlining but is
**ignored** when inlining would change the answer.

## Phase gate

You are done when you can look at a plan and say whether a CTE was inlined, explain why
`MATERIALIZED` made a query slower rather than faster, and say what happens to a CTE
referenced twice — without guessing.

## Where this connects

- **[Data-modifying CTEs](../10-modifying-ctes/README.md)** — the `INSERT`/`UPDATE`/`DELETE`
  variant, which is always a fence and has its own snapshot rules
- **[Recursive CTEs](../15-recursive-cte/README.md)** — `WITH RECURSIVE`, the other always-fenced form
- **[Subqueries](../11-subqueries/README.md)** — the same job without the name, and when a
  correlated one becomes an N+1 inside a single statement
- **[DELETE](../../phase-4-crud/11-delete.md)** — why `DELETE` needs a CTE to get a `LIMIT`
- **[Expression indexes](../../phase-10-indexes/10-expression.md)** — the volatility classes
  that decide inlining decide indexability too
- **[The result object](../../phase-7-pg-driver/06-result-object.md)** — why `SELECT *`
  through a long CTE chain can lose columns in the driver

---

← [Phase index](../README.md) · Start → [Naming a subquery](01-naming-a-subquery.md)
