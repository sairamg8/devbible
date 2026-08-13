---
title: "MERGE"
sidebar_label: "Overview"
sidebar_position: 0
---

# `MERGE`

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Scripts: `sandbox/pg-api/ex14-crud.mjs`,
> `sandbox/pg-api/ex55-merge-returning.mjs`.

**`MERGE` is the SQL-standard statement for synchronising one table from another —
insert, update and delete in a single pass. It is not a drop-in replacement for
`ON CONFLICT`, and for concurrent upsert it is the wrong tool.**

| # | Chunk | What it covers |
|---|---|---|
| 01 | **[Three actions in one statement](01-three-actions.md)** | The `WHEN` branches and why order decides which fires, `USING` a table / subquery / `VALUES` list, the `unnest` bridge, and `WHEN NOT MATCHED BY SOURCE` |
| 02 | **[`RETURNING` and `merge_action()`](02-returning-and-merge-action.md)** | The claim this page had wrong: `MERGE` **does** support `RETURNING`. `merge_action()` for the per-action breakdown, its `42601` scope rule, and PG18's `old.`/`new.` aliases |
| 03 | **[Against `ON CONFLICT`](03-vs-on-conflict.md)** | Why `MERGE` is not concurrency-safe for upsert, the situation→statement table, where `MERGE` genuinely wins, version availability, and the source-duplicate rule |

## Phase gate

- Which `WHEN` branch fires when two of them match, and how do you control it?
- How do you find out how many rows a `MERGE` inserted versus updated?
- Why is `ON CONFLICT` safe for concurrent upsert when `MERGE` is not?
- What does `21000 MERGE command cannot affect row a second time` mean?

## Where this connects

- **[`INSERT … ON CONFLICT`](../06-on-conflict.md)** is the PostgreSQL-specific upsert
  and the right tool in a request path.
- **[`VALUES` and `unnest`](../19-values-unnest.md)** supplies the array-parameter
  technique that lets one `MERGE` carry any number of application rows.
- **[`DISTINCT` and `DISTINCT ON`](../12-distinct-on.md)** is how you deduplicate a
  source before merging it.
- **[The result object](../../phase-7-pg-driver/06-result-object.md)** explains why
  `rowCount` and `command` behave the way they do here.

---

← [`DISTINCT` and `DISTINCT ON`](../12-distinct-on.md) · Start → [Three actions in one statement](01-three-actions.md)
