---
title: "Phase 4 — CRUD and DML"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: PostgreSQL 18.4 · Node 24 · `pg`.**

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **[The SELECT shape](01-select-shape.md)** | <span className="db-tier t-master">Master</span> | list FROM WHERE ORDER LIMIT |
| 02 | **[WHERE predicates](02-where-predicates.md)** | <span className="db-tier t-master">Master</span> | BETWEEN IN LIKE ILIKE |
| 03 | **[LIMIT and OFFSET](03-limit-offset.md)** | <span className="db-tier t-master">Master</span> | OFFSET degrades |
| 04 | **[INSERT](04-insert.md)** | <span className="db-tier t-master">Master</span> | single multi-row SELECT |
| 05 | **[RETURNING](05-returning.md)** | <span className="db-tier t-master">Master</span> | ids without second query |
| 06 | **[ON CONFLICT](06-on-conflict.md)** | <span className="db-tier t-master">Master</span> | upsert |
| 07 | **[UPDATE](07-update.md)** | <span className="db-tier t-master">Master</span> | SET WHERE FROM RETURNING |
| 08 | **[Parameterized queries](08-parameters.md)** | <span className="db-tier t-master">Master</span> | never string-build values |
| 09 | **[Logical query processing order](09-logical-order.md)** | <span className="db-tier t-understand">Understand</span> | FROM before SELECT |
| 10 | **[ORDER BY](10-order-by.md)** | <span className="db-tier t-understand">Understand</span> | NULLS FIRST LAST |
| 11 | **[DELETE](11-delete.md)** | <span className="db-tier t-understand">Understand</span> | soft vs hard |
| 12 | **[DISTINCT and DISTINCT ON](12-distinct-on.md)** | <span className="db-tier t-understand">Understand</span> | PostgreSQL DISTINCT ON |
| 13 | **[MERGE](13-merge.md)** | <span className="db-tier t-understand">Understand</span> | SQL-standard upsert |
| 14 | **[TRUNCATE vs DELETE](14-truncate.md)** | <span className="db-tier t-understand">Understand</span> | speed and FKs |
| 15 | **[Expressions and CASE](15-expressions.md)** | <span className="db-tier t-understand">Understand</span> | CASE COALESCE |
| 16 | **[String functions](16-string-functions.md)** | <span className="db-tier t-understand">Understand</span> | lower trim split_part |
| 17 | **[Date/time functions](17-datetime-functions.md)** | <span className="db-tier t-understand">Understand</span> | date_trunc extract |
| 18 | **[generate_series and helpers](18-generate-series.md)** | <span className="db-tier t-understand">Understand</span> | test data |
| 19 | **[VALUES and unnest](19-values-unnest.md)** | <span className="db-tier t-understand">Understand</span> | bulk param bridge |
| 20 | **[Row constructors and keyset](20-tuple-comparison.md)** | <span className="db-tier t-understand">Understand</span> | keyset primitive |

## Phase gate

Move on when you can INSERT...RETURNING, UPDATE with WHERE, and parameterize every user value.

---

← Syllabus: [Part 2](../../syllabus/02-sql.md) · Start → [The SELECT shape](01-select-shape.md)
