---
title: "Phase 10 — Indexes and the query planner"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: PostgreSQL 18.4 · Node 24 · `pg`.**

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **[What an index is](01-what-index.md)** | <span className="db-tier t-master">Master</span> | write cost |
| 02 | **[B-tree indexes](02-btree.md)** | <span className="db-tier t-master">Master</span> | default index |
| 03 | **[EXPLAIN vs EXPLAIN ANALYZE](03-explain.md)** | <span className="db-tier t-master">Master</span> | ANALYZE runs it |
| 04 | **[Seq vs index vs bitmap](04-scan-types.md)** | <span className="db-tier t-master">Master</span> | seq can be correct |
| 05 | **[Why an index is not used](05-index-not-used.md)** | <span className="db-tier t-master">Master</span> | highest-value page |
| 06 | **[Multicolumn indexes](06-multicolumn.md)** | <span className="db-tier t-understand">Understand</span> | leftmost prefix |
| 07 | **[EXPLAIN ANALYZE BUFFERS](07-explain-buffers.md)** | <span className="db-tier t-understand">Understand</span> | est vs actual |
| 08 | **[Index-only / INCLUDE scans and INCLUDE](08-index-only.md)** | <span className="db-tier t-understand">Understand</span> | INCLUDE covering |
| 09 | **[Partial indexes](09-partial.md)** | <span className="db-tier t-understand">Understand</span> | hot subsets |
| 10 | **[Expression indexes](10-expression.md)** | <span className="db-tier t-understand">Understand</span> | lower(email) |
| 11 | **[GIN jsonb arrays FTS trgm](11-gin-trgm.md)** | <span className="db-tier t-understand">Understand</span> | jsonb and LIKE |
| 12 | **[CREATE INDEX CONCURRENTLY](12-concurrently.md)** | <span className="db-tier t-understand">Understand</span> | no write lock |
| 13 | **[Unused and duplicate indexes](13-unused-indexes.md)** | <span className="db-tier t-understand">Understand</span> | pg_stat_user_indexes |
| 14 | **[pg_stat_statements](14-pg-stat-statements.md)** | <span className="db-tier t-understand">Understand</span> | real hot queries |
| 15 | **[GiST BRIN hash](15-gist-brin-hash.md)** | <span className="db-tier t-know">Know</span> | when each fits |
| 16 | **[Statistics and ANALYZE](16-statistics.md)** | <span className="db-tier t-know">Know</span> | extended stats |
| 17 | **[Index bloat REINDEX](17-bloat-reindex.md)** | <span className="db-tier t-know">Know</span> | REINDEX CONCURRENTLY |

| 18 | **[Indexing foreign key columns](18-fk-indexes.md)** | <span className="db-tier t-understand">Understand</span> | PostgreSQL does not auto-index FK columns |

## Phase gate

Move on when you can read EXPLAIN ANALYZE and explain why an index was not used.

---

← Syllabus: [Part 4](../../syllabus/04-performance-and-production.md) · Start → [What an index is](01-what-index.md)
