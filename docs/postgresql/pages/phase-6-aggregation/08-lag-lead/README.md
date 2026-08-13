---
title: "lag, lead, first_value, last_value"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex36-aggregation.mjs`.

**These four reach into other rows of the partition and return a value from them. `lag`
and `lead` count rows relative to the current one; `first_value`, `last_value` and
`nth_value` index into the *frame*. That distinction is not academic — it is why
`last_value` famously returns the current row.**

| # | Chunk | In one line |
|---|---|---|
| 01 | **[lag and lead](01-lag-and-lead.md)** | offsets and defaults, partition boundaries, the day-over-day pattern, and the gap that silently corrupts it |
| 02 | **[first_value, last_value, nth_value](02-first-and-last.md)** | the default-frame trap, the fix, and when to reach for these instead of `lag` |

## The four in one line each

| Function | Returns |
|---|---|
| `lag(expr, offset = 1, default = NULL)` | `expr` from the row `offset` rows **before** this one |
| `lead(expr, offset = 1, default = NULL)` | `expr` from the row `offset` rows **after** this one |
| `first_value(expr)` | `expr` from the **first row of the frame** |
| `last_value(expr)` | `expr` from the **last row of the frame** — usually not what you want |
| `nth_value(expr, n)` | `expr` from the nth row of the frame |

`lag` and `lead` ignore the frame entirely. The other three are defined by it.

## Phase gate

You are done when you can write a day-over-day change column, say why the first row of
each partition is `NULL`, and explain without checking why `last_value` needs an explicit
frame while `first_value` does not.

## Where this connects

- **[Window functions](../windows-intro/)** — the `OVER` mechanics
- **[Window frames](../14-frames.md)** — the frame clause these depend on, in full
- **[Ranking functions](../ranking/)** — the other window-only family
- **[generate_series](../../phase-4-crud/18-generate-series.md)** — the calendar spine that
  fixes the gap problem
- **[CROSS JOIN](../../phase-5-joins/07-cross-join.md)** — how that spine is joined on

---

← [Phase index](../README.md) · Start → [lag and lead](01-lag-and-lead.md)
