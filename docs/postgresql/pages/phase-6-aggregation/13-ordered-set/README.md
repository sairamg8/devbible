---
title: "Ordered-set aggregates"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Scripts: `sandbox/pg-api/ex37-cte-subquery.mjs`,
> `sandbox/pg-api/ex37e-ordered-set-checks.mjs`.

**Some aggregates cannot be computed from a running total — they need the input in order
first. Those take their ordering explicitly, in `WITHIN GROUP (ORDER BY ...)`, and
percentiles are the reason you will meet them. The family costs 3.1× an `avg()` because
sorting is unavoidable, and every member has one behaviour that is not what its English
name suggests.**

| # | Chunk | In one line |
|---|---|---|
| 01 | **[Percentiles](01-percentiles.md)** | `cont` vs `disc`, several percentiles in one sort, what `NULL`s do, and why it costs 3.1× an average |
| 02 | **[mode, bool_and, hypothetical sets](02-mode-and-booleans.md)** | the tie `mode()` hides, the `NULL` `bool_and` returns for "all of nothing", and ranking a value that is not there |

## The syntax that marks the family

```sql
percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms)
```

The argument is the *fraction*; the column goes in `WITHIN GROUP`. That `ORDER BY` is the
ordering the aggregate is defined over — not the query's output order.

| Aggregate | Answers |
|---|---|
| `percentile_cont(f)` | the value at fraction `f`, interpolated |
| `percentile_disc(f)` | the first actual value at or past fraction `f` |
| `mode()` | the commonest value — ties broken by the ordering |
| `rank(x)` / `percent_rank(x)` / `dense_rank(x)` / `cume_dist(x)` | where `x` *would* rank |

`bool_and` / `bool_or` are ordinary aggregates rather than ordered-set ones, but they live
here because they answer the same shape of question and share the empty-set `NULL` rule.

## Phase gate

You are done when you can write a p95 without looking up the syntax, say why it costs more
than an average, and name what `mode()` and `bool_and` each hide.

## Where this connects

- **[GROUP BY and aggregates](../group-by/)** — the empty-set `NULL` rule these inherit
- **[Ranking functions](../ranking/)** — the window versions of `rank` and `percent_rank`,
  which rank rows that exist rather than one that does not
- **[FILTER](../filter-clause/)** — pairing a boolean aggregate with a count that
  cross-checks it
- **[Window frames](../frames/)** — the other place an explicit ordering changes the
  answer
- **[Subqueries](../11-subqueries/02-correlated-and-cost.md)** — `count()` 0 versus `sum()`
  `NULL`, the same asymmetry `bool_and` follows

---

← [Phase index](../README.md) · Start → [Percentiles](01-percentiles.md)
