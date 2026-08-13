---
title: "Ranking functions"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Scripts: `sandbox/pg-api/ex36-aggregation.mjs`,
> `sandbox/pg-api/ex36b-agg-plans.mjs`.

**`row_number`, `rank` and `dense_rank` differ only in what they do about ties, and that
difference decides whether your leaderboard shows two players in first place or
arbitrarily picks one. `ntile` divides into buckets and has an uneven-division rule worth
knowing before a report claims equal-sized quartiles.**

| # | Chunk | In one line |
|---|---|---|
| 01 | **[The four functions](01-the-four-functions.md)** | `row_number` vs `rank` vs `dense_rank`, `percent_rank`, `ntile` and its remainder rule |
| 02 | **[Top-N per group](02-top-n-per-group.md)** | three ways to write it, `Run Condition`, and the measured comparison — including the index that made it **slower** |

## The tie behaviour in one table

Four players, two tied on 10 points:

| name | pts | `row_number` | `rank` | `dense_rank` |
|---|---|---|---|---|
| Ann | 10 | 1 | 1 | 1 |
| Bob | 10 | **2** | **1** | **1** |
| Cid | 7 | 3 | **3** | **2** |
| Dee | 5 | 4 | 4 | 3 |

`row_number` always counts 1,2,3,4. `rank` gives ties the same number and then *skips*.
`dense_rank` gives ties the same number and does *not* skip.

## Phase gate

You are done when you can pick between the three without looking them up, and can write
"top 3 per customer" and say which of the three implementations to reach for based on one
question about the data.

## Where this connects

- **[Window functions](../windows-intro/)** — the `OVER` mechanics these are built on
- **[lag and lead](../lag-lead/)** — the other window-only function family
- **[DISTINCT ON](../../phase-4-crud/12-distinct-on.md)** — the PostgreSQL shortcut for top-**1**
- **[LATERAL](../../phase-5-joins/10-lateral.md)** — the join-shaped alternative, and where
  it won instead
- **[Window frames](../14-frames.md)** — why ranking functions ignore the frame clause

---

← [Phase index](../README.md) · Start → [The four functions](01-the-four-functions.md)
