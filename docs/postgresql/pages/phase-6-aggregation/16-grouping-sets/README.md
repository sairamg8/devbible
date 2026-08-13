---
title: "GROUPING SETS, ROLLUP, CUBE"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Scripts: `sandbox/pg-api/ex37-cte-subquery.mjs`,
> `sandbox/pg-api/ex37g-grouping-sets-cost.mjs`.

**One `GROUP BY` gives one level of aggregation; a report usually wants several. `GROUPING
SETS` asks for a list of them in one statement, `ROLLUP` and `CUBE` are shorthands for the
two common collections, and `GROUPING()` is what stops the subtotal rows being confused with
real `NULL`s. The "one scan" advantage is real but conditional — measured here, three
ordinary `GROUP BY`s beat it.**

| # | Chunk | In one line |
|---|---|---|
| 01 | **[Sets, ROLLUP, CUBE](01-sets-rollup-cube.md)** | the three forms and what they expand to, `MixedAggregate`, and the like-for-like benchmark where one scan loses |
| 02 | **[GROUPING and labels](02-grouping-and-labels.md)** | the subtotal `NULL` that is indistinguishable from a data `NULL`, and the one function that separates them |

## The three forms

| Form | Expands to | Sets over n columns |
|---|---|---|
| `GROUPING SETS ((a,b), (a), ())` | exactly what you list | as listed |
| `ROLLUP (a, b)` | `((a,b), (a), ())` — drops from the right | n + 1 |
| `CUBE (a, b)` | `((a,b), (a), (b), ())` — every subset | 2ⁿ |

`()` is the empty grouping set: the grand total.

## The two things to remember

1. **A subtotal row marks its rolled-up columns with `NULL`** — the same `NULL` a real
   missing value produces. `GROUPING(col)` returns 1 for the former, 0 for the latter.
2. **Grouping sets are not parallelised.** Measured on a cached 500 000-row table: the same
   three sets took 293.67 ms in one scan versus 170.22 ms as three parallel `GROUP BY`s.

## Phase gate

You are done when you can expand `ROLLUP` and `CUBE` into grouping sets from memory, say why
`GROUPING()` is not optional on a nullable column, and explain when one scan is *not* the
faster choice.

## Where this connects

- **[GROUP BY and aggregates](../01-group-by/README.md)** — the single-level form, and the `NULL` rules
  these inherit
- **[count variants](../02-count-variants/README.md)** — what the aggregate inside each set costs
- **[FILTER](../04-filter-clause/README.md)** — the other way to get several aggregations from one scan,
  when the *columns* differ rather than the grouping
- **[Subqueries](../11-subqueries/03-in-exists-and-not-in.md)** — `NOT IN`, the other bug that
  waits for the first `NULL`
- **[Window functions](../06-windows-intro/README.md)** — totals alongside detail rows without collapsing
  them, which is often what a report actually wanted

---

← [Phase index](../README.md) · Start → [Sets, ROLLUP, CUBE](01-sets-rollup-cube.md)
