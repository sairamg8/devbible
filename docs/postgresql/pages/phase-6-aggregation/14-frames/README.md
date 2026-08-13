---
title: "Window frames"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Scripts: `sandbox/pg-api/ex37-cte-subquery.mjs`,
> `sandbox/pg-api/ex37f-frame-extras.mjs`.

**A window aggregate is computed over a *frame* — a slice of the partition, not all of it.
You get a frame whether or not you write one, and the default groups rows with equal
`ORDER BY` values together. Learning the frame clause is what turns window functions from
"running totals" into rolling time windows, centred smoothing and leave-one-out
comparisons.**

| # | Chunk | In one line |
|---|---|---|
| 01 | **[ROWS vs RANGE](01-rows-vs-range.md)** | the default frame and the peers it merges, running totals, moving averages and their partial windows, and the frame ranking functions silently ignore |
| 02 | **[RANGE offsets, GROUPS, EXCLUDE](02-range-groups-exclude.md)** | a frame measured in calendar time, counting distinct values instead of rows, and the four `EXCLUDE` options |

## The frame clause

```
{ ROWS | RANGE | GROUPS } BETWEEN <start> AND <end> [ EXCLUDE ... ]
```

Each endpoint is `UNBOUNDED PRECEDING`, `n PRECEDING`, `CURRENT ROW`, `n FOLLOWING` or
`UNBOUNDED FOLLOWING`. Omitting `BETWEEN … AND` implies `AND CURRENT ROW`.

| Frame kind | "1 preceding" counts |
|---|---|
| `ROWS` | one row back |
| `GROUPS` | one distinct ordering value back, as present in the data |
| `RANGE` (with an offset) | one unit back on the ordering scale, present or not |

**The default is `RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`** — which merges peers,
and is the reason to write `ROWS` explicitly whenever you mean rows.

## Phase gate

You are done when you can say why a running total over a non-unique ordering jumps, write a
rolling 7-day window that survives a day with no data, and explain `EXCLUDE GROUP` versus
`EXCLUDE TIES` without checking.

## Where this connects

- **[Window functions](../06-windows-intro/README.md)** — `OVER`, `PARTITION BY`, and what windows cost
- **[lag, lead, first/last_value](../08-lag-lead/README.md)** — `first_value`/`last_value` depend on the
  frame; `lag`/`lead` do not, which is why `last_value` needs an explicit one
- **[Ranking functions](../07-ranking/README.md)** — defined over the partition, and they ignore any
  frame you write
- **[Ordered-set aggregates](../13-ordered-set/README.md)** — the other place an explicit ordering
  changes the answer
- **[generate_series](../../phase-4-crud/18-generate-series.md)** — the calendar spine for
  when missing days need to exist as rows

---

← [Phase index](../README.md) · Start → [ROWS vs RANGE](01-rows-vs-range.md)
