---
title: "Phase 0 — PostgreSQL and its architecture"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: PostgreSQL 18.4** driven from **Node 24** with **`pg`**.
> Every example on these pages was executed against `postgres:18-alpine` on
> **127.0.0.1:55432** (user/db `devbible`). Use `127.0.0.1`, never `localhost`.

What the server actually is, before any serious SQL. The client/server cost
explains pooling; the namespace row prevents a week of `search_path` confusion.

Twelve pages, one syllabus row each. The first two are Master.

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **[What PostgreSQL is](01-what-postgresql-is.md)** | <span className="db-tier t-understand">Understand</span> | Object-relational database server — license, governance, what “relational” buys you |
| 02 | **[Client/server model](02-client-server-model.md)** | <span className="db-tier t-master">Master</span> | One OS process per connection — why connections are expensive enough to pool |
| 03 | **[Cluster → table namespace](03-namespace.md)** | <span className="db-tier t-master">Master</span> | Four levels + `search_path` |
| 04 | **[Shared buffers](04-shared-buffers.md)** | <span className="db-tier t-understand">Understand</span> | Where a row lives when you read it |
| 05 | **[WAL](05-wal.md)** | <span className="db-tier t-understand">Understand</span> | Why every change is written twice |
| 06 | **[Roles, users, groups](06-roles.md)** | <span className="db-tier t-understand">Understand</span> | One concept, three names |
| 07 | **[Local install](07-local-install.md)** | <span className="db-tier t-understand">Understand</span> | Podman/Docker, ports, volumes |
| 08 | **[Connections and auth](08-connection-and-auth.md)** | <span className="db-tier t-understand">Understand</span> | URIs, `PG*` env vars, auth modes |
| 09 | **[Process model](09-process-model.md)** | <span className="db-tier t-know">Know</span> | Postmaster, backends, workers |
| 10 | **[Version policy](10-version-policy.md)** | <span className="db-tier t-know">Know</span> | Majors, minors, five-year window, 18 |
| 11 | **[vs MySQL and SQLite](11-vs-other-databases/README.md)** | <span className="db-tier t-know">Know</span> | Differences that change design |
| 12 | **[Templates](12-templates.md)** | <span className="db-tier t-when">When Needed</span> | `template0` / `template1` / `postgres` |

## Coverage

| Syllabus topic | Page |
|---|---|
| What PostgreSQL is, object-relational, license | 01 |
| Client/server model, one process per connection | 02 |
| Cluster → database → schema → table, `search_path` | 03 |
| Shared buffers, OS page cache | 04 |
| WAL and durability | 05 |
| Roles, users, groups | 06 |
| Installing for local development | 07 |
| Connection strings, `PG*` env, auth modes | 08 |
| Postmaster, backends, background workers | 09 |
| Version policy, what 18 changed | 10 |
| PostgreSQL vs MySQL vs SQLite | 11 |
| `template0` / `template1`, `CREATE DATABASE` | 12 |

## Phase gate

Move on to Phase 1 when you can explain **why a Node process must pool
connections**, name the **four namespace levels**, and open `psql` into the
container without guessing the port.

## Where this connects

- **Phase 1 — `psql`** — the shell you use to verify every later claim.
- **Phase 7 — `pg` driver** — the same connection model from JavaScript.
- **Node Phase 6** — pool sizing and lifecycle (link out; do not re-teach here).

---

← Syllabus: [Part 1 — Foundations](../../syllabus/01-foundations.md) · Start → [What PostgreSQL is](01-what-postgresql-is.md)
