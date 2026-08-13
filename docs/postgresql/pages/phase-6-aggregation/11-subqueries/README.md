---
title: "Subqueries"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Scripts: `sandbox/pg-api/ex37-cte-subquery.mjs`,
> `sandbox/pg-api/ex37c-correlated-cost.mjs`.

**A subquery is a query used as a value, a set, or a table. Which of those three it is
decides everything else: how many rows it may return, whether it runs once or once per
outer row, and — for the negated set forms — whether a single `NULL` quietly empties your
result.**

| # | Chunk | In one line |
|---|---|---|
| 01 | **[Scalar and row subqueries](01-scalar-and-row.md)** | one row one column, the `21000` that only fires in production, row constructors, and where a subquery may appear |
| 02 | **[Correlated subqueries](02-correlated-and-cost.md)** | `SubPlan … loops=5000`, an N+1 inside one statement, and what it really costs once vacuum state is controlled |
| 03 | **[IN, EXISTS, NOT IN](03-in-exists-and-not-in.md)** | three spellings of one question, and the negation that returns nothing when a `NULL` appears |

## The three kinds

| Kind | Returns | Runs |
|---|---|---|
| **Scalar** — in the target list or as a value | exactly 1 row × 1 column | once, if uncorrelated |
| **Set** — with `IN` / `ANY` / `EXISTS` | any number of rows | once, as a semi join |
| **Table** — in `FROM`, alias required | any rows × any columns | once |

Add a reference to an outer column and any of them becomes **correlated**, which changes
the cost class entirely.

## Phase gate

You are done when you can spot a correlated subquery in a plan without being told, say why
`NOT IN` and `NOT EXISTS` differ, and explain why `count()` returns 0 where `sum()` returns
`NULL`.

## Where this connects

- **[CTEs (WITH)](../ctes/)** — the same job with a name attached, and the inlining rule
- **[Semi and anti joins](../../phase-5-joins/semi-anti/)** — `EXISTS` beating `JOIN` +
  `DISTINCT` by 2.5×, and the `NOT IN` trap from the join side
- **[LATERAL](../../phase-5-joins/10-lateral.md)** — the derived table that *can* see its
  siblings, and the top-N-per-group pattern
- **[NULL](../../phase-2-types/06-null.md)** — the three-valued logic behind the `NOT IN` trap
- **[Tuple comparison](../../phase-4-crud/20-tuple-comparison.md)** — row constructors and
  keyset pagination
- **[N+1 queries](/docs/nodejs/pages/phase-6-data-access/n-plus-1)** — the same algorithm
  with round trips attached

---

← [Phase index](../README.md) · Start → [Scalar and row subqueries](01-scalar-and-row.md)
