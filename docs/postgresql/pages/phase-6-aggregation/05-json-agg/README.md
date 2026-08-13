---
title: "string_agg, array_agg, jsonb_agg"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Scripts: `sandbox/pg-api/ex36-aggregation.mjs`,
> `sandbox/pg-api/ex36e-shaping.mjs`.

**These aggregates fold a group into one *collection* rather than one number. That is
what lets a single query return a fully-shaped API response — a customer with their
orders with their line items — instead of three result sets and a stitching loop in
Node. The catch is that every one of them returns `NULL` where you expected empty, and
`[null]` where you expected `[]`.**

| # | Chunk | In one line |
|---|---|---|
| 01 | **[Arrays and strings](01-arrays-and-strings.md)** | `array_agg` and `string_agg`, ordering *inside* an aggregate, `DISTINCT` inside, and what the driver hands JavaScript |
| 02 | **[JSON shapes](02-json-shapes.md)** | `jsonb_agg`, `jsonb_build_object`, `to_jsonb`, `jsonb_object_agg`, and `json` vs `jsonb` |
| 03 | **[The empty-array trap](03-the-empty-array-trap.md)** | `[null]`, why `FILTER` alone is not the fix, the two-level payload, and shaping in SQL versus in JS |

## The family

| Aggregate | Returns | Skips `NULL` inputs? |
|---|---|---|
| `string_agg(expr, delim)` | `text` | **yes** |
| `array_agg(expr)` | array of the input type | **no** — `NULL`s are kept as elements |
| `json_agg` / `jsonb_agg(expr)` | `json` / `jsonb` array | **no** — appear as `null` |
| `jsonb_object_agg(k, v)` | `jsonb` object | key must not be `NULL` (`22023`) |

That second column is the source of most of the surprises in this topic, and the
inconsistency is real rather than something you can reason your way to.

## Phase gate

You are done when you can write a nested one-query payload — parent, children,
grandchildren — that returns `[]` rather than `[null]` for a parent with no children,
and can say why `FILTER` on its own does not achieve that.

## Where this connects

- **[FILTER](../filter-clause/)** — used here to exclude the `LEFT JOIN` `NULL` row
- **[GROUP BY and aggregates](../group-by/)** — the empty-group `NULL` rule these inherit
- **[LATERAL](../../phase-5-joins/10-lateral.md)** — how the nested payload is assembled
- **[jsonb](../../phase-2-types/08-jsonb.md)** — the type itself, its operators and indexes
- **[N+1 queries](/docs/nodejs/pages/phase-6-data-access/n-plus-1)** — the problem one
  shaped query solves

---

← [Phase index](../README.md) · Start → [Arrays and strings](01-arrays-and-strings.md)
