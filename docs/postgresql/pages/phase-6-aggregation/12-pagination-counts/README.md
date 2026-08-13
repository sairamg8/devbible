---
title: "Counting for pagination"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex37d-pagination-counts.mjs`.

**The page is cheap; the total is not. Twenty rows cost 2.11 ms and an exact
`total: 125000` costs 48.83 ms — and the tempting one-query version, `count(*) OVER ()`,
costs 152.77 ms. This topic is about deciding which question your list endpoint is
actually being asked, because three of the four answers are nearly free.**

| # | Chunk | In one line |
|---|---|---|
| 01 | **[What "total" costs](01-what-total-costs.md)** | the four approaches measured, why the window-function version is worst, and the `limit + 1` pattern |
| 02 | **[Estimates and capped counts](02-estimates-and-caps.md)** | the planner's free estimate at 0.7% error, and the capped count that saves 23× — or nothing at all |

## The four answers

| The product needs | Use | Cost |
|---|---|---|
| A *Next* button | `limit + 1` | free, exact |
| "About 126 000 results" | planner estimate | free, ~1% here, no guarantee |
| "1000+ results" | capped count | 23× cheaper *when matches are plentiful* |
| "Page 1 of 6 250" | exact `count(*)` | full pass over every matching row |

Work down that list, not up it.

## Phase gate

You are done when you can explain why `count(*) OVER ()` defeats `LIMIT`, write the
`limit + 1` pattern without the off-by-one, and say when a capped count saves nothing.

## Where this connects

- **[count variants](../02-count-variants/README.md)** — `count(*)` vs `count(col)` vs
  `count(DISTINCT)`, and what each costs
- **[Window functions](../06-windows-intro/README.md)** — why `count(*) OVER ()` must see every row
- **[LIMIT and OFFSET](../../phase-4-crud/03-limit-offset.md)** — deep `OFFSET` at 105.85 ms,
  and keyset pagination as the fix
- **[Statistics](../../phase-10-indexes/16-statistics.md)** — what the planner's estimate is
  built from, and when it goes wrong
- **[List endpoints](../../phase-9-api-crud/02-list-endpoint.md)** — the API shape this
  feeds

---

← [Phase index](../README.md) · Start → [What "total" costs](01-what-total-costs.md)
