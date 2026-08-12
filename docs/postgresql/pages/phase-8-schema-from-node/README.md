---
title: "Phase 8 — Schema and data from Node"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: PostgreSQL 18.4 · Node 24 · `pg`.**

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **[Creating tables from Node](./ddl-from-node/)** | <span className="db-tier t-master">Master</span> | when legitimate |
| 02 | **[Migrations](02-migrations.md)** | <span className="db-tier t-master">Master</span> | forward-only files |
| 03 | **[Seeding](03-seeding.md)** | <span className="db-tier t-master">Master</span> | deterministic fixtures |
| 04 | **[Bulk insert that scales](04-bulk-insert.md)** | <span className="db-tier t-master">Master</span> | unnest vs loop |
| 05 | **[SQL in .sql files](05-sql-files.md)** | <span className="db-tier t-understand">Understand</span> | reviewable SQL |
| 06 | **[Migrations in transactions](06-tx-migration.md)** | <span className="db-tier t-understand">Understand</span> | failed leaves nothing |
| 07 | **[IF NOT EXISTS is not migrations](07-if-not-exists.md)** | <span className="db-tier t-understand">Understand</span> | idempotent setup only |
| 08 | **[Minimal migration runner](08-minimal-runner.md)** | <span className="db-tier t-understand">Understand</span> | know when to stop |
| 09 | **[COPY FROM STDIN from Node](09-copy-streams.md)** | <span className="db-tier t-understand">Understand</span> | fast loads |
| 10 | **[Local dev database](10-local-dev-db.md)** | <span className="db-tier t-understand">Understand</span> | compose reset script |
| 11 | **[Reset between tests](11-test-reset.md)** | <span className="db-tier t-understand">Understand</span> | truncate vs migrate |
| 12 | **[Migration tools overview](12-migration-tools.md)** | <span className="db-tier t-know">Know</span> | what each assumes |
| 13 | **[Schema drift](13-schema-drift.md)** | <span className="db-tier t-know">Know</span> | fail fast at boot |
| 14 | **[Types from schema](14-codegen-types.md)** | <span className="db-tier t-know">Know</span> | keep TS in step |

## Phase gate

Move on when you can migrate forward-only and seed idempotently without runtime DDL in requests.

---

← Syllabus: [Part 3](../../syllabus/03-node-and-pg.md) · Start → [Creating tables from Node](./ddl-from-node/)
