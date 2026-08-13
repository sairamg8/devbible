---
title: "Semi and anti joins"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex35-joins.mjs`.

**A semi join answers "does a match exist?" without emitting the matched row — so it
cannot fan out and never needs a `DISTINCT`. Its negation, the anti join, has one
implementation that is quietly broken: `NOT IN` returns nothing at all if the subquery
yields a single NULL.**

Two chunks, split at the positive/negative seam. They behave differently enough — one has
three interchangeable spellings, the other has one that loses data — to be worth reading
separately.

| # | Chunk | In one line |
|---|---|---|
| 01 | **[Semi joins: EXISTS and IN](01-semi-joins.md)** | why `EXISTS` and `IN` plan identically, the 2.5× cost of `JOIN` + `DISTINCT`, and correlation |
| 02 | **[Anti joins and the NOT IN trap](02-anti-joins.md)** | `NOT EXISTS` vs `NOT IN` measured, why one NULL empties the result, and indexing |

## Phase gate

You are done when you reach for `EXISTS` instead of `JOIN … DISTINCT` without thinking,
and when you can explain — from the expansion of the predicate, not from memory — why
`NOT IN` over a nullable column returns nothing.

## Where this connects

- **[INNER JOIN](../inner-join/)** — the fan-out that semi joins structurally avoid
- **[LEFT JOIN](../left-join/)** — the `LEFT JOIN … IS NULL` idiom that these replace
- **[NULL semantics](../../phase-2-types/06-null.md)** — the three-valued logic behind the
  `NOT IN` trap
- **[LATERAL](../10-lateral.md)** — what to use when you need the matched row's columns,
  which a semi join cannot give you
- **[FK indexes](../../phase-10-indexes/18-fk-indexes.md)** — the index these depend on

---

← [Phase index](../README.md) · Start → [Semi joins: EXISTS and IN](01-semi-joins.md)
