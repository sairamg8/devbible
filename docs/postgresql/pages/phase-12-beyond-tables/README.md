---
title: "Phase 12 — Beyond plain tables"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: PostgreSQL 18.4 · Node 24 · `pg`.**

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **[jsonb operators](./jsonb-operators/)** | <span className="db-tier t-master">Master</span> | arrow and containment |
| 02 | **[When a column beats JSON](02-column-vs-json.md)** | <span className="db-tier t-master">Master</span> | early decision |
| 03 | **[Indexing jsonb](03-index-jsonb.md)** | <span className="db-tier t-understand">Understand</span> | GIN path ops |
| 04 | **[Building JSON in SQL](04-build-json-sql.md)** | <span className="db-tier t-understand">Understand</span> | jsonb_build_object |
| 05 | **[Full-text search](./full-text/)** | <span className="db-tier t-understand">Understand</span> | tsvector |
| 06 | **[pg_trgm fuzzy](06-pg-trgm.md)** | <span className="db-tier t-understand">Understand</span> | ILIKE without full scan |
| 07 | **[Views](07-views.md)** | <span className="db-tier t-understand">Understand</span> | named queries |
| 08 | **[Triggers](08-triggers.md)** | <span className="db-tier t-understand">Understand</span> | updated_at |
| 09 | **[Extensions](09-extensions.md)** | <span className="db-tier t-understand">Understand</span> | CREATE EXTENSION |
| 10 | **[Set-returning functions in FROM](10-srf.md)** | <span className="db-tier t-understand">Understand</span> | unnest jsonb_to_recordset |
| 11 | **[Materialized views](11-matviews.md)** | <span className="db-tier t-know">Know</span> | REFRESH CONCURRENTLY |
| 12 | **[PL/pgSQL functions](12-plpgsql.md)** | <span className="db-tier t-know">Know</span> | when logic belongs in DB |
| 13 | **[LISTEN NOTIFY](13-listen-notify.md)** | <span className="db-tier t-know">Know</span> | at-most-once |
| 14 | **[Partitioning](14-partitioning.md)** | <span className="db-tier t-know">Know</span> | when big enough |
| 15 | **[Procedures vs functions](15-procedures.md)** | <span className="db-tier t-when">When Needed</span> | tx control |
| 16 | **[Foreign data wrappers](16-fdw.md)** | <span className="db-tier t-when">When Needed</span> | postgres_fdw |
| 17 | **[pgvector](17-pgvector.md)** | <span className="db-tier t-when">When Needed</span> | embeddings |

## Phase gate

Move on when you can choose columns vs jsonb and know when FTS/partitioning is justified.

---

← Syllabus: [Part 4](../../syllabus/04-performance-and-production.md) · Start → [jsonb operators](./jsonb-operators/)
