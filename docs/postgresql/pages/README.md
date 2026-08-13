---
title: "PostgreSQL — Pages"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: PostgreSQL 18.4 · Node 24 · `pg`.** Phase 0–1 (and other key
> examples) were executed against the sandbox before writing; remaining pages
> follow the same patterns and measured conventions.

The explanations behind the [PostgreSQL syllabus](../README.md).

import Progress from '@site/src/components/Progress';

<Progress lang="postgresql" />

## Phases

| Phase | Covers |
|---|---|
| **[0 — Architecture](./phase-0-architecture/README.md)** | Client/server, namespace, WAL, roles, install, connections |
| **[1 — `psql`](./phase-1-psql/README.md)** | Meta-commands, scripting, `\copy`, SQLSTATE |
| **[2 — Types](./phase-2-types/README.md)** | Integers, numeric, text, timestamptz, NULL, jsonb |
| **[3 — DDL](./phase-3-ddl/README.md)** | Tables, keys, FKs, constraints, relationships |
| **[4 — CRUD](./phase-4-crud/README.md)** | SELECT/INSERT/UPDATE/DELETE, RETURNING, parameters |
| **[5 — Joins](./phase-5-joins/README.md)** | INNER/LEFT, EXISTS, set ops, LATERAL |
| **[6 — Aggregation](./phase-6-aggregation/README.md)** | GROUP BY, windows, CTEs |
| **[7 — `pg` driver](./phase-7-pg-driver/README.md)** | Pool, placeholders, errors, types |
| **[8 — Schema from Node](./phase-8-schema-from-node/README.md)** | Migrations, seeds, bulk load |
| **[9 — API CRUD](./phase-9-api-crud/README.md)** | Repositories, list/filter, transactions |
| **[10 — Indexes](./phase-10-indexes/README.md)** | EXPLAIN, B-tree, partial/expression, INCLUDE |
| **[11 — MVCC](./phase-11-mvcc/README.md)** | Isolation, locks, vacuum, lost update |
| **[12 — Beyond tables](./phase-12-beyond-tables/README.md)** | jsonb deep-dive, FTS, triggers, extensions |
| **[13 — Ops](./phase-13-ops/README.md)** | Grants, backups, TLS, managed Postgres |

Inventory (topic rows): [syllabus](../syllabus/01-foundations.md).
