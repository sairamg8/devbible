---
title: "Phase 3 — DDL: tables, constraints, schema design"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: PostgreSQL 18.4 · Node 24 · `pg`.** Examples measured on the sandbox where noted.

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **[CREATE TABLE](01-create-table.md)** | <span className="db-tier t-master">Master</span> | Shape you will not regret |
| 02 | **[Primary keys](02-primary-keys.md)** | <span className="db-tier t-master">Master</span> | IDENTITY over serial |
| 03 | **[Foreign keys](03-foreign-keys.md)** | <span className="db-tier t-master">Master</span> | ON DELETE actions |
| 04 | **[NOT NULL DEFAULT UNIQUE CHECK](04-constraints.md)** | <span className="db-tier t-master">Master</span> | Invariants in the schema |
| 05 | **[ALTER TABLE](05-alter-table.md)** | <span className="db-tier t-master">Master</span> | Instant vs rewrite |
| 06 | **[Modeling relationships](06-relationships.md)** | <span className="db-tier t-master">Master</span> | 1-1, 1-N, N-N |
| 07 | **[Transactional DDL](07-transactional-ddl.md)** | <span className="db-tier t-understand">Understand</span> | Wrap migrations in a transaction |
| 08 | **[Unique and NULLs](08-unique-nulls.md)** | <span className="db-tier t-understand">Understand</span> | NULLS NOT DISTINCT |
| 09 | **[Adding NOT NULL safely](09-add-not-null.md)** | <span className="db-tier t-understand">Understand</span> | Safe sequence on large tables |
| 10 | **[Schemas and tenancy](10-schemas-tenancy.md)** | <span className="db-tier t-understand">Understand</span> | search_path multi-tenant layouts |
| 11 | **[Naming conventions](11-naming.md)** | <span className="db-tier t-understand">Understand</span> | snake_case that survives |
| 12 | **[Normalization](12-normalization.md)** | <span className="db-tier t-understand">Understand</span> | 3NF then deliberate denorm |
| 13 | **[DROP CASCADE](13-drop-cascade.md)** | <span className="db-tier t-understand">Understand</span> | How not to lose tables |
| 14 | **[Sequences](14-sequences.md)** | <span className="db-tier t-understand">Understand</span> | Gaps are normal |
| 15 | **[Generated columns](15-generated-columns.md)** | <span className="db-tier t-know">Know</span> | STORED expressions |
| 16 | **[TEMPORARY and UNLOGGED](16-temp-unlogged.md)** | <span className="db-tier t-know">Know</span> | Speed vs durability |
| 17 | **[COMMENT ON](17-comments.md)** | <span className="db-tier t-know">Know</span> | Document in the catalog |
| 18 | **[Deferrable constraints](18-deferrable.md)** | <span className="db-tier t-when">When Needed</span> | Circular FKs |
| 19 | **[Table inheritance](19-inheritance.md)** | <span className="db-tier t-when">When Needed</span> | Prefer partitioning |

## Phase gate

Move on when you can design a 1-N and N-N schema with identity PKs, FKs, and CHECKs without an ORM.

---

← Syllabus: [Part 1](../../syllabus/01-foundations.md) · Start → [CREATE TABLE](01-create-table.md)
