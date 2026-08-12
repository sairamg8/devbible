---
title: "Part 3 — Node + raw pg"
sidebar_label: "3 · Node + raw pg"
sidebar_position: 3
---

> **Phases 7–9 · 48 topics · 14 Master**
> The part the user asked for by name: driving PostgreSQL from Node with the raw
> `pg` driver — table creation, data insertion, and every CRUD pattern a backend
> actually needs.

This part is **raw-SQL-first on purpose**. No ORM writes the queries; you do. The
ORM comparison stays where it already is, as a Node Phase 6 row.

**Overlap with Node Phase 6 is deliberate and bounded** — see the
[boundary table](../README.md#boundary-with-node-short).
Pool sizing, transaction propagation through service layers, N+1 and the
repository pattern are *written already* in Node and are **recapped in one
paragraph with a link**, never re-explained.

---

## Phase 7 — The `pg` driver, end to end

📖 **Explanation written:** [Phase 7 — pg driver](../pages/phase-7-pg-driver/)


*16 topics.* Everything the driver does between your SQL string and a JavaScript
object. The type-parsing rows matter more than they look: `bigint` and `numeric`
arrive as **strings**, and finding that out in production is a bad day.

| Topic | Tier |
|---|---|
| **Installing and wiring `pg`** — versions, ESM imports, and the `Pool` created once at module scope | <span className="db-tier t-master">Master</span> |
| **`Pool` vs `Client`** — which one by default, and the cases that still require a dedicated `Client` *(recap; mechanics in Node Phase 6)* | <span className="db-tier t-master">Master</span> |
| **Connection configuration** — connection string vs object, `PG*` env vars, and SSL to a managed provider | <span className="db-tier t-master">Master</span> |
| **`pool.query()` with `$1` placeholders** — the safe path, every time, including `IN` lists via `= ANY($1)` | <span className="db-tier t-master">Master</span> |
| **Errors from PostgreSQL in Node** — `error.code` (SQLSTATE), `constraint`, `detail`, and mapping `23505` to a 409 | <span className="db-tier t-master">Master</span> |
| **The result object** — `rows`, `rowCount`, `fields`, `command`, and what an empty result looks like | <span className="db-tier t-understand">Understand</span> |
| **`pool.connect()` and `client.release()`** — the `finally` block, and the leak that silently exhausts the pool | <span className="db-tier t-understand">Understand</span> |
| **Type parsing** — what `pg` returns for `bigint`, `numeric`, `date`, `timestamptz`, `jsonb`, arrays | <span className="db-tier t-understand">Understand</span> |
| Overriding type parsers with `pg-types`, and the `bigint`-as-string decision | <span className="db-tier t-understand">Understand</span> |
| Prepared (named) statements — the `name` field, the plan cache, and when it backfires | <span className="db-tier t-understand">Understand</span> |
| **Query timeouts** — `statement_timeout`, `query_timeout`, `connectionTimeoutMillis`, and which one saves you | <span className="db-tier t-understand">Understand</span> |
| One `query()` is one statement — multi-statement strings, and why that restriction is a feature | <span className="db-tier t-understand">Understand</span> |
| **`pool.end()`** — closing the pool as part of graceful HTTP shutdown | <span className="db-tier t-understand">Understand</span> |
| `LISTEN`/`NOTIFY` from Node — and why it needs a dedicated long-lived `Client`, not the pool | <span className="db-tier t-know">Know</span> |
| `pg-cursor` and streaming a large result set instead of buffering it | <span className="db-tier t-know">Know</span> |
| **`pg` vs `postgres.js`** — tagged templates, performance, and when the other driver is the better tool | <span className="db-tier t-know">Know</span> |

---

## Phase 8 — Schema and data from Node

📖 **Explanation written:** [Phase 8 — Schema from Node](../pages/phase-8-schema-from-node/)


*14 topics.* Table creation and data insertion, done properly: from versioned
migration files rather than a `CREATE TABLE` buried in application startup. The
bulk-insert rows are the ones that turn a 30-second seed into a 300 ms one.

| Topic | Tier |
|---|---|
| **Creating tables from Node** — issuing DDL through the driver, and when that is legitimate versus lazy | <span className="db-tier t-master">Master</span> |
| **Migrations** — forward-only, one file per change, applied inside a transaction, recorded in a tracking table | <span className="db-tier t-master">Master</span> |
| **Seeding** — multi-row `INSERT`, `ON CONFLICT DO NOTHING`, and fixtures that are deterministic | <span className="db-tier t-master">Master</span> |
| **Bulk insert that scales** — `INSERT ... SELECT * FROM unnest($1::bigint[], $2::text[])` versus one insert per row, measured | <span className="db-tier t-master">Master</span> |
| **SQL in `.sql` files, not template literals** — loading with `node:fs`, and keeping SQL reviewable | <span className="db-tier t-understand">Understand</span> |
| **Wrapping a migration in `BEGIN`/`COMMIT`** — PostgreSQL's transactional DDL means a failed migration leaves nothing behind | <span className="db-tier t-understand">Understand</span> |
| **`CREATE TABLE IF NOT EXISTS`** for idempotent setup — and why it is not a migration system | <span className="db-tier t-understand">Understand</span> |
| Writing a minimal migration runner in Node — and knowing when to stop and adopt one | <span className="db-tier t-understand">Understand</span> |
| **`COPY FROM STDIN`** from Node via `pg-copy-streams` — the fast path for large loads | <span className="db-tier t-understand">Understand</span> |
| **A local development database in Podman/Docker** — compose file, volume, port, and a one-command reset script | <span className="db-tier t-understand">Understand</span> |
| Resetting to a known state between test runs — truncate-and-reseed vs drop-and-migrate | <span className="db-tier t-understand">Understand</span> |
| `node-pg-migrate`, `graphile-migrate`, Prisma Migrate — what each assumes about your workflow | <span className="db-tier t-know">Know</span> |
| Schema drift — verifying the live schema matches what the code expects, and failing fast at boot | <span className="db-tier t-know">Know</span> |
| Generating TypeScript types from the schema, and keeping types in step with SQL | <span className="db-tier t-know">Know</span> |

---

## Phase 9 — CRUD patterns for a real API

📖 **Explanation written:** [Phase 9 — API CRUD](../pages/phase-9-api-crud/)


*18 topics.* The phase that assembles everything: a resource, its repository, and
every query a REST endpoint needs. The dynamic-`WHERE` and allowlist rows exist
because "generic list endpoint" is where SQL injection re-enters an otherwise
parameterized codebase.

| Topic | Tier |
|---|---|
| **A repository module per resource** — plain functions taking a client, returning rows *(layering rationale: Node Phase 6)* | <span className="db-tier t-master">Master</span> |
| **`list` with filtering, sorting and pagination** — the endpoint every resource has | <span className="db-tier t-master">Master</span> |
| **Safe dynamic `WHERE`** — building predicates and a parameter array together, never concatenating values | <span className="db-tier t-master">Master</span> |
| **Sort and filter allowlists** — the injection hole a "flexible" list endpoint opens, since identifiers cannot be parameterized | <span className="db-tier t-master">Master</span> |
| **Transactions in a request** — `BEGIN`/`COMMIT`/`ROLLBACK` on one checked-out client, and the `try/catch/finally` shape | <span className="db-tier t-master">Master</span> |
| **`create`** — `INSERT ... RETURNING`, and mapping the row to a domain object | <span className="db-tier t-understand">Understand</span> |
| **`findById`** — and the not-found decision: `null` versus throwing | <span className="db-tier t-understand">Understand</span> |
| **`update`** — partial updates, `COALESCE($2, col)` versus building the `SET` list dynamically | <span className="db-tier t-understand">Understand</span> |
| **`delete`** — hard versus soft, and returning what was removed | <span className="db-tier t-understand">Understand</span> |
| **Keyset (cursor) pagination** — tuple comparison plus a matching index, versus `OFFSET` | <span className="db-tier t-understand">Understand</span> |
| **Idempotent writes** — upsert flows for an API that may be called twice | <span className="db-tier t-understand">Understand</span> |
| Passing a client through service functions so one transaction spans several repositories *(propagation: Node Phase 6)* | <span className="db-tier t-understand">Understand</span> |
| **Optimistic concurrency** — a `version` column and `WHERE version = $n`, and what a `rowCount` of 0 means | <span className="db-tier t-understand">Understand</span> |
| `SELECT ... FOR UPDATE` inside a request, and holding the lock for as short a time as possible | <span className="db-tier t-understand">Understand</span> |
| **Shaping the response in SQL (`jsonb_agg`) versus assembling it in JavaScript** — the honest trade-off | <span className="db-tier t-understand">Understand</span> |
| **Testing against a real PostgreSQL** — Testcontainers, and per-test transaction rollback for isolation | <span className="db-tier t-understand">Understand</span> |
| `created_at`/`updated_at` — a trigger versus application code, and why the trigger usually wins | <span className="db-tier t-understand">Understand</span> |
| Mapping `snake_case` columns to `camelCase` fields — and doing it in exactly one place | <span className="db-tier t-understand">Understand</span> |

---

## Where this connects

- **Node Phase 6** owns pool sizing, transaction propagation, N+1, the repository
  rationale and the ORM comparison. Every row above that touches those links out
  rather than re-teaching them.
- **Express Phase 7 (layering)** mounts these repositories behind controllers;
  Express Phase 8 validates the input before it reaches them.
- **Phase 9 → Phase 10** — `list` endpoints are where you first need an index,
  and where keyset pagination stops being theoretical.
- **Phase 9 → Phase 11** — optimistic concurrency and `FOR UPDATE` are the
  application-level face of MVCC.
- **Node Phase 9 (Testing)** — still unwritten. The Testcontainers row here
  should link to it once it lands, and be written second so the two agree.

---

← [Part 2 — SQL](./02-sql.md) · Next: [Part 4 — Performance & production](./04-performance-and-production.md) →
