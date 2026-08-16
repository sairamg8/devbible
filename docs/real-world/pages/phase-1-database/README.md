---
title: "Phase 1 — The database"
sidebar_label: "Overview"
sidebar_position: 0
---

> The storefront's PostgreSQL layer, raw SQL through `pg`. Concepts live in the
> [PostgreSQL section](../../../postgresql/README.md); these chapters are the
> schema and queries this app actually runs, against the eleven-table map fixed
> in [Phase 0](../phase-0-the-app/02-architecture-and-data-model.md).

**Prerequisites:** PostgreSQL [Part 2 — SQL](../../../postgresql/syllabus/02-sql.md)
and [Part 3 — Node + raw pg](../../../postgresql/syllabus/03-node-and-pg.md).

| # | Chapter | Tier | In one line |
|---|---|---|---|
| 01 | **[The schema](01-the-schema/README.md)** | <span className="db-tier t-master">Master</span> | All eleven tables as DDL — keys, constraints, enums, and the invariants the database holds so the app can't break them |
| 02 | **[Migrations as plain SQL](02-migrations.md)** | <span className="db-tier t-master">Master</span> | A 60-line runner: ledger table, advisory lock, one transaction per file, forward-only |
| 03 | **[Seed data and fixtures](03-seeds-and-fixtures.md)** | <span className="db-tier t-understand">Understand</span> | Reference data in migrations, a deterministic upsert seed, and per-test factories — three problems, three owners |
| 04 | **[The catalog query](04-the-catalog-query.md)** | <span className="db-tier t-master">Master</span> | Filter + sort + keyset pagination in one parameterized shape — cursor = order by = index |
| 05 | **[Full-text product search](05-full-text-search.md)** | <span className="db-tier t-understand">Understand</span> | `websearch_to_tsquery` + weighted `tsvector` — and the honest list of what FTS won’t do |
| 06 | **[The checkout transaction](06-the-checkout-transaction/README.md)** | <span className="db-tier t-master">Master</span> | Cart → order atomically: idempotency claim first, ordered locks, price snapshot, outbox rows — and the crash map |
| 07 | **[Money and time](07-money-and-time.md)** | <span className="db-tier t-master">Master</span> | Integer cents that survive the whole stack; `timestamptz` instants, compared in SQL, localized only at the edge |
| 08 | **[JSONB for product attributes](08-jsonb-attributes.md)** | <span className="db-tier t-understand">Understand</span> | The column-vs-jsonb line, indexed containment filters, and promotion when an attribute earns a range |
| 09 | **[Dashboard queries](09-dashboard-queries.md)** | <span className="db-tier t-understand">Understand</span> | `generate_series` spines, `filter` counts, window shares — and the cache→matview→replica ladder |
| 10 | **Indexes for this app's queries** | <span className="db-tier t-master">Master</span> | *(not written yet)* |
| 11 | **Soft delete and audit columns** | <span className="db-tier t-know">Know</span> | *(not written yet)* |
| 12 | **LISTEN/NOTIFY** | <span className="db-tier t-know">Know</span> | *(not written yet)* |

## Phase gate

The gate from the syllabus: the schema migrated from zero, seeded, and every
catalog and checkout query running under `EXPLAIN ANALYZE` with an index it
actually uses.

## Where this connects

Phase 2's data layer wraps these queries in modules; Phase 3's endpoints call
those modules; Phase 8 rebuilds this exact layer on MongoDB.
