---
title: "Full-text search"
sidebar_label: "Overview"
sidebar_position: 0
---

# Full-text search

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex45-search.mjs`.

**PostgreSQL's full-text search is good enough that most applications never need
a separate search server — and it is built from two conversions you have to
understand separately.** Documents become `tsvector`; queries become `tsquery`;
`@@` matches them. Everything else is detail on those three things.

Measured against 200 002 products.

| # | Chunk | What it covers |
|---|---|---|
| 01 | **[tsvector and tsquery](01-tsvector-and-queries.md)** | What `to_tsvector` produces, stemming and stop words, the four query parsers and why `to_tsquery` must never see raw user input, and prefix matching |
| 02 | **[Indexing and ranking](02-indexing-and-ranking.md)** | The `42P17` trap that stops you indexing, the expression index versus a generated `tsvector` column, weights, `ts_rank`, `ts_headline`, and what full-text search cannot find |

## Phase gate

- What does the `english` configuration do that `simple` does not?
- Why must a user's search box never be passed to `to_tsquery`?
- Why does `CREATE INDEX ... (to_tsvector(body))` fail?
- Which searches will full-text search never match, however you index it?

## Where this connects

- **[pg_trgm similarity](../06-pg-trgm.md)** is the complement: it finds
  misspellings that full-text search cannot, and cannot do stemming.
- **[Phase 10 · GIN and trigram indexes](../../phase-10-indexes/11-gin-trgm.md)**
  owns GIN's mechanics, write cost and pending list.
- **[Phase 2 · text](../../phase-2-types/03-text.md)** owns the underlying text
  types and collation.
- **[Indexing jsonb](../03-index-jsonb.md)** covers the other big GIN use case,
  and the same expression-index rule applies to both.

---

← [Phase index](../README.md) · Start → [tsvector and tsquery](01-tsvector-and-queries.md)
