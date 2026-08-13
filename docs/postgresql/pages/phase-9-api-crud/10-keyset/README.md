---
title: "Keyset (cursor) pagination"
sidebar_label: "Overview"
sidebar_position: 0
---

# Keyset (cursor) pagination

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex43-keyset-patch.mjs`.

**Instead of counting rows to skip, remember the last row you sent and ask for
what comes after it.** The query then starts at the right place in the index
rather than walking to it — measured at **1.23 ms against 295.87 ms** at the same
depth in a 500 000-row table.

| # | Chunk | What it covers |
|---|---|---|
| 01 | **[The tuple comparison](01-the-tuple-comparison.md)** | Why `OFFSET` gets slower with depth, the `(created_at, id) < ($1, $2)` form and the index that matches it, and the hand-written `OR` version that looks equivalent and is 160× slower |
| 02 | **[Cursors and the traps](02-cursors-and-traps.md)** | Encoding the cursor, mixed sort directions the tuple form cannot express, nullable sort columns that silently truncate the walk, and when `OFFSET` is still the right answer |

## Phase gate

- Why does `OFFSET 499980` read half a million rows to return twenty?
- What has to be true of the sort key for keyset pagination to be correct?
- Why is `(a, b) < ($1, $2)` faster than `a < $1 OR (a = $1 AND b < $2)`?
- What breaks when the sort column is nullable?

## Where this connects

- **[list with filtering, sorting and pagination](../02-list-endpoint.md)**
  assembles this with filters and sorting, and covers the tiebreaker that makes
  any sort total.
- **[Phase 4 · LIMIT and OFFSET](../../phase-4-crud/03-limit-offset.md)** owns the
  statement-level treatment of deep offsets and drift.
- **[Phase 4 · Tuple comparison](../../phase-4-crud/20-tuple-comparison.md)** owns
  the row-constructor operator itself.
- **[Phase 10 · Indexes](../../phase-10-indexes/)** explains why the index column
  order has to match the `ORDER BY`.

---

← [Phase index](../README.md) · Start → [The tuple comparison](01-the-tuple-comparison.md)
