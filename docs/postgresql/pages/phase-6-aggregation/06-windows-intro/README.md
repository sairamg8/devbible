---
title: "Window functions"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Scripts: `sandbox/pg-api/ex36-aggregation.mjs`,
> `sandbox/pg-api/ex36b-agg-plans.mjs`.

**A window function computes an aggregate *without collapsing the rows*. Each row keeps
its identity and gains a value computed over a set of related rows — its partition. That
one difference from `GROUP BY` is what makes running totals, percentages of total, and
"rank within group" expressible at all.**

| # | Chunk | In one line |
|---|---|---|
| 01 | **[OVER keeps the rows](01-over-vs-group-by.md)** | the model, `PARTITION BY`, `OVER ()`, running totals, and the same numbers two ways |
| 02 | **[Where windows run](02-where-windows-run.md)** | `42P20`, the subquery that fixes it, windows over aggregates, and the named `WINDOW` clause |
| 03 | **[What windows cost](03-what-windows-cost.md)** | every window needs sorted input — 530 ms, 999 ms, 1518 ms — and the index that halves it |

## The shape

```sql
aggregate_or_window ( args ) [ FILTER (WHERE …) ] OVER (
    [ PARTITION BY expr, … ]
    [ ORDER BY expr, … ]
    [ frame ]
)
```

Everything inside `OVER (…)` describes *which rows this row's value is computed from*.
Empty parentheses mean "all of them".

## Phase gate

You are done when you can convert a `GROUP BY` report into a per-row percentage of total
without a self-join, explain why `WHERE row_number() OVER … <= 3` is an error, and say
what a second window function costs.

## Where this connects

- **[GROUP BY and aggregates](../group-by/)** — the collapsing version of the same aggregates
- **[Ranking functions](../ranking/)** — `row_number`, `rank`, `ntile`, top-N per group
- **[lag and lead](../lag-lead/)** — reaching into neighbouring rows
- **[Window frames](../14-frames.md)** — the third line of `OVER (…)`, in full
- **[HAVING](../having/)** — the filter that runs *before* windows, which is why `42P20` exists
- **[EXPLAIN](../../phase-10-indexes/03-explain.md)** — reading `WindowAgg` and its `Sort`

---

← [Phase index](../README.md) · Start → [OVER keeps the rows](01-over-vs-group-by.md)
