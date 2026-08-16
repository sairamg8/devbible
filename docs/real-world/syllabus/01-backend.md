---
title: "Part 1 — The backend spine"
sidebar_label: "1 · Backend spine"
sidebar_position: 1
---

> Phases 0–3 · The app spec, the database on raw `pg`, Node services, the Express API

The order is the build order: agree on what the app is, put the data model under
it, stand up the services around it, then expose the API. Raw SQL through `pg`,
no ORM — that choice is deliberate and each chapter names what it costs.

---

## Phase 0 — The app

The spec every other chapter refers back to. Small on purpose — it exists so no
chapter has to re-explain what a "cart" or an "order" means here.

| Topic | Tier |
|---|---|
| **The storefront spec** — features, roles (guest, customer, admin), and the flows: browse → cart → checkout → order → review | <span className="db-tier t-master">Master</span> |
| **Architecture and data model overview** — the services, the tables, who owns what, and where each language section's share begins | <span className="db-tier t-master">Master</span> |
| How to read this track — waves, chapter shape, and the links-not-duplicates rule | <span className="db-tier t-know">Know</span> |

---

## Phase 1 — The database (raw SQL + `pg`)

The storefront's PostgreSQL layer. Concepts live in
[PostgreSQL Parts 2–3](../../postgresql/syllabus/02-sql.md); these chapters are
the schema and queries this app actually runs.

| Topic | Tier |
|---|---|
| **The schema**: users, products, categories, carts, orders, order_items — keys, constraints, generated columns | <span className="db-tier t-master">Master</span> |
| **Migrations as plain SQL** — a small runner, forward-only, run at deploy | <span className="db-tier t-master">Master</span> |
| Seed data and realistic fixtures | <span className="db-tier t-understand">Understand</span> |
| **The catalog query** — filtering, sorting, and keyset pagination | <span className="db-tier t-master">Master</span> |
| Full-text product search: `tsvector`, GIN, ranking | <span className="db-tier t-understand">Understand</span> |
| **The checkout transaction** — stock decrement, `SELECT … FOR UPDATE`, retry on serialization failure | <span className="db-tier t-master">Master</span> |
| **Money and time** — `numeric`, `timestamptz`, price snapshots in order_items | <span className="db-tier t-master">Master</span> |
| JSONB for product attributes — when it earns its place over columns | <span className="db-tier t-understand">Understand</span> |
| Dashboard queries: aggregates and window functions | <span className="db-tier t-understand">Understand</span> |
| **Indexes for this app's queries** — and reading `EXPLAIN ANALYZE` on them | <span className="db-tier t-master">Master</span> |
| Soft delete, audit columns, `updated_at` triggers | <span className="db-tier t-know">Know</span> |
| `LISTEN`/`NOTIFY` for order events and cache invalidation | <span className="db-tier t-know">Know</span> |

**Gate — deliverable:** the schema migrated from zero, seeded, and every catalog
and checkout query running under `EXPLAIN ANALYZE` with an index it actually uses.

---

## Phase 2 — Node services

The processes around the API. Concepts live in
[Node Phases 3–7 and 10–11](../../nodejs/README.md); these chapters assemble them
into the storefront's services.

| Topic | Tier |
|---|---|
| **The API boot, assembled** — env schema → `pg` pool → server → readiness, failing fast in order | <span className="db-tier t-master">Master</span> |
| **The data layer over raw `pg`** — query modules, a `withTransaction` helper, driver types kept out of business logic | <span className="db-tier t-master">Master</span> |
| **The upload service** — stream product and review images to a disk/S3-shaped sink, size limits mid-stream, cleanup on every exit path | <span className="db-tier t-master">Master</span> |
| **The outbox relay and email worker** — order confirmation without dual-write, correct at-least-once delivery | <span className="db-tier t-master">Master</span> |
| Scheduled jobs — the abandoned-cart sweep and nightly reconciliation, drift-safe | <span className="db-tier t-understand">Understand</span> |
| The webhook dispatcher — signing, retries with backoff, a dead-letter table | <span className="db-tier t-understand">Understand</span> |
| The search indexer job — keeping `tsvector` columns fresh | <span className="db-tier t-know">Know</span> |
| The cache layer — in-process TTL with a Redis-shaped interface, stampede-safe | <span className="db-tier t-understand">Understand</span> |
| The health and metrics kit — one module shared by API and workers | <span className="db-tier t-understand">Understand</span> |
| The ops CLI — seed, migrate, requeue, with `util.parseArgs` | <span className="db-tier t-know">Know</span> |

**Gate — deliverable:** API and worker booting from the same code base, an order
placed while the email worker is stopped delivers exactly once when it restarts.

---

## Phase 3 — The Express API

The storefront's HTTP surface. Concepts live in
[Express phases 0–10](../../expressjs/README.md) — especially
[validation and authorization](../../expressjs/pages/phase-8-validation-authz/README.md)
and [the app factory](../../expressjs/pages/phase-10-app-factory/README.md);
these chapters are the endpoints themselves.

| Topic | Tier |
|---|---|
| **Project structure** — the app factory, routers → controllers → services → data, and what lives where | <span className="db-tier t-master">Master</span> |
| **The validation boundary** — zod schemas for params, query and body; parse, don't validate | <span className="db-tier t-master">Master</span> |
| **Auth** — signup, login, sessions as the default, and the JWT + refresh variant | <span className="db-tier t-master">Master</span> |
| **Authorization** — RBAC plus ownership: my orders vs. the admin's | <span className="db-tier t-master">Master</span> |
| **Catalog endpoints** — the pagination, filter and sort contract | <span className="db-tier t-master">Master</span> |
| Cart endpoints — guest carts and merging on login | <span className="db-tier t-understand">Understand</span> |
| **The checkout endpoint** — idempotency keys orchestrating the Phase 1 transaction | <span className="db-tier t-master">Master</span> |
| The uploads endpoint — busboy into the Phase 2 upload service | <span className="db-tier t-understand">Understand</span> |
| **The error contract** — error classes, problem-details bodies, one central handler | <span className="db-tier t-master">Master</span> |
| Rate limiting login and checkout | <span className="db-tier t-understand">Understand</span> |
| Inbound webhooks — verifying the payment provider's signature | <span className="db-tier t-understand">Understand</span> |
| OpenAPI generated from the zod schemas | <span className="db-tier t-know">Know</span> |

**Gate — deliverable:** the full browse → cart → checkout flow exercised end to
end against the running API, including a replayed checkout that does not
double-charge.

---

← Index: [Real World](../README.md) · Next → [Part 2 — The frontend](02-frontend.md)
