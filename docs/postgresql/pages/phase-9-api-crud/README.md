---
title: "Phase 9 — CRUD patterns for a real API"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: PostgreSQL 18.4 · Node 24 · `pg`.**

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **[Repository module per resource](./01-repository/README.md)** | <span className="db-tier t-master">Master</span> | plain functions |
| 02 | **[list with filter sort page](02-list-endpoint.md)** | <span className="db-tier t-master">Master</span> | every resource |
| 03 | **[Safe dynamic WHERE](./03-safe-dynamic-where/README.md)** | <span className="db-tier t-master">Master</span> | param array |
| 04 | **[Sort and filter allowlists](./04-allowlists/README.md)** | <span className="db-tier t-master">Master</span> | identifier injection |
| 05 | **[Transactions in a request](./05-transactions-request/README.md)** | <span className="db-tier t-master">Master</span> | try catch finally |
| 06 | **[create INSERT RETURNING](06-create.md)** | <span className="db-tier t-understand">Understand</span> | map to domain |
| 07 | **[findById](07-find-by-id.md)** | <span className="db-tier t-understand">Understand</span> | null vs throw |
| 08 | **[Partial updates](08-update-partial.md)** | <span className="db-tier t-understand">Understand</span> | COALESCE vs dynamic SET |
| 09 | **[delete hard vs soft](09-delete-soft-hard.md)** | <span className="db-tier t-understand">Understand</span> | return removed |
| 10 | **[Keyset pagination](./10-keyset/README.md)** | <span className="db-tier t-understand">Understand</span> | tuple + index |
| 11 | **[Idempotent writes](11-idempotent-writes.md)** | <span className="db-tier t-understand">Understand</span> | upsert flows |
| 12 | **[Passing client through services](12-client-propagation.md)** | <span className="db-tier t-understand">Understand</span> | one TX many repos |
| 13 | **[Optimistic concurrency](13-optimistic.md)** | <span className="db-tier t-understand">Understand</span> | version column |
| 14 | **[SELECT FOR UPDATE](14-for-update.md)** | <span className="db-tier t-understand">Understand</span> | short locks |
| 15 | **[Shape in SQL vs JS](15-shape-sql-vs-js.md)** | <span className="db-tier t-understand">Understand</span> | jsonb_agg decision |
| 16 | **[Testing against real PostgreSQL](16-testing-real-pg.md)** | <span className="db-tier t-understand">Understand</span> | after Node Phase 9 |
| 17 | **[created_at updated_at](17-timestamps-trigger.md)** | <span className="db-tier t-understand">Understand</span> | trigger usually wins |
| 18 | **[snake_case to camelCase](18-snake-camel.md)** | <span className="db-tier t-understand">Understand</span> | one mapping place |

## Phase gate

Move on when list/filter/sort is allowlisted and transactions use try/catch/finally release.

---

← Syllabus: [Part 3](../../syllabus/03-node-and-pg.md) · Start → [Repository module per resource](./01-repository/README.md)
