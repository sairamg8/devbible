---
title: "HAVING vs WHERE"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Scripts: `sandbox/pg-api/ex36-aggregation.mjs`,
> `sandbox/pg-api/ex36d-count-having.mjs`.

**`WHERE` decides which rows go into the groups; `HAVING` decides which groups come
out. The rule everyone learns is "use `HAVING` for aggregates" — true, and it leaves
out the case that actually matters, which is when the same predicate is legal in both
and the two are not equally cheap.**

| # | Chunk | In one line |
|---|---|---|
| 01 | **[Filtering groups, not rows](01-groups-vs-rows.md)** | the pipeline position, what each clause may reference, `42803` vs `42703`, `HAVING` without `GROUP BY`, and the `LEFT JOIN` trap |
| 02 | **[What HAVING costs](02-what-having-costs.md)** | the predicate the planner moves for you, the one it cannot, and what each is worth measured on 500 000 rows |

## The one-line test

**Can the predicate be decided by looking at a single row?** If yes it belongs in
`WHERE`; if it needs the whole group, it belongs in `HAVING`. Where both are legal —
a predicate on the grouping key — prefer `WHERE`, for reasons chunk 02 measures.

## Phase gate

You are done when you can classify any predicate into `WHERE` or `HAVING` without
running it, explain why `HAVING count(*) > 0` after a `LEFT JOIN` matches everything,
and say which of the two `HAVING` forms the planner can rewrite into a `WHERE`.

## Where this connects

- **[GROUP BY and aggregates](../group-by/)** — what `HAVING` is filtering
- **[count variants](../count-variants/)** — the `LEFT JOIN` trap in full
- **[Window functions](../windows-intro/)** — the filter `HAVING` *cannot* express,
  and the subquery that can
- **[Semi joins](../../phase-5-joins/03-semi-anti/01-semi-joins.md)** — usually what a
  `HAVING count(…) > 0` was really trying to say

---

← [Phase index](../README.md) · Start → [Filtering groups, not rows](01-groups-vs-rows.md)
