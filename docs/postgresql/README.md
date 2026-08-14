---
title: "PostgreSQL — Syllabus"
sidebar_label: "Overview"
sidebar_position: 0
---

> Verified: 2026-08 against **PostgreSQL 18.4** from **Node 24.19.0** with **`pg`**.
> Examples run against `postgres:18-alpine` on `127.0.0.1:55432` (never `localhost` —
> see Node sandbox notes for the IPv6 trap).

The complete topic inventory for PostgreSQL, tiered for **mastery in fullstack
backend development**. **14 phases, 233 topics**, split into 4 parts to stay
under the 300-line file cap.

Architectural role: **the database** — the relational model, SQL, the planner,
concurrency, and the operational surface — plus the **Node-side application
layer that talks to it in raw SQL** (`pg`).

## Example policy

> **Every page carries both halves: the SQL (or shell), and the Node `pg` code
> that issues it (or what the concept means for the Node process).** A page that
> shows only a `psql` transcript is incomplete for Phases 2–13.

| | |
|---|---|
| The SQL / shell | Runnable against PostgreSQL 18.4 |
| The Node call | `pg` with `$1` placeholders, real result handling |
| The result | Actual output, not a plausible-looking one |
| Failure mode | What the error looks like from Node when it applies |

Phases 10–13 still lead with SQL or shell — but each answers *what this means for
the Node process holding the pool*.

## Version facts

| | |
|---|---|
| Target server | **PostgreSQL 18.4** |
| Local client | `psql` **18.4** |
| Driver | **`pg`** (node-postgres) on **Node 24** Active LTS |
| Container | Podman `postgres:18-alpine`, port **55432** |
| Note | Existing Node Phase 6/7 pages were measured on **PostgreSQL 17.10**. Re-check version-sensitive cross-links before treating them as authoritative on 18. |

## Parts

| # | Part | Covers | Phases | Topics |
|---|---|---|---|---|
| 1 | **[Foundations](syllabus/01-foundations.md)** | Architecture, **psql**, types, DDL | 0–3 | 63 |
| 2 | **[SQL](syllabus/02-sql.md)** | CRUD/DML, joins, aggregation, windows, CTEs | 4–6 | 49 |
| 3 | **[Node + raw `pg`](syllabus/03-node-and-pg.md)** | Driver, schema/seeding, API CRUD patterns | 7–9 | 48 |
| 4 | **[Performance & production](syllabus/04-performance-and-production.md)** | Indexes/planner, MVCC, advanced features, ops | 10–13 | 68 |

## Explanations

The explanations live in **[Explanations](./pages/README.md)** — one page per topic (or
tight group), with code, gotchas, and interview questions.

import Progress from '@site/src/components/Progress';

<Progress lang="postgresql" compact />

## Tier legend

| Badge | Meaning |
|---|---|
| <span className="db-tier t-master">Master</span> | Use confidently with no documentation open |
| <span className="db-tier t-understand">Understand</span> | Know how it works; look up signatures freely |
| <span className="db-tier t-know">Know</span> | Know what/why/when; details on demand |
| <span className="db-tier t-when">When Needed</span> | Don't study upfront |

## Tier distribution

| Tier | Topics | Share |
|---|---|---|
| <span className="db-tier t-master">Master</span> | 62 | 27% |
| <span className="db-tier t-understand">Understand</span> | 127 | 54% |
| <span className="db-tier t-know">Know</span> | 35 | 15% |
| <span className="db-tier t-when">When Needed</span> | 9 | 4% |
| **Total** | **233** | |

Master by part: Foundations 20 · SQL 14 · Node + `pg` 14 · Perf & production 14.

If you only ever finish the <span className="db-tier t-master">Master</span> set,
you can design a schema, write every query a CRUD API needs in raw SQL, drive it
from Node, and read an `EXPLAIN` when it gets slow.

## Prerequisites

1. **SQL from zero is fine** — Phase 0 starts at “what is a database server”.
2. **Node through Phase 2** (async/promises) before Part 3. Every `pg` call is a promise.
3. **Node Phase 6 (Data access)** owns pool *sizing*, transaction *propagation*,
   N+1, repository *rationale*, and ORM comparison. PG Part 3 **recaps briefly and
   links** — it does not re-own those pages.
4. **Docker/Podman basics** for local setup, or accept the given commands until
   that syllabus lands.

## Reading order

1. **Phase 1 (`psql`) pays for itself** — do not skip it to rush SQL.
2. **Part 3 can start after Phase 4 (CRUD)** if you want code running early.
3. **Phase 10 (indexes) before Phase 11 (MVCC).**

## Recap rule (Node Phase 6)

Rows that touch pool sizing, service-layer transaction propagation, N+1, or the
ORM comparison **recap briefly** — about **≤ 40 lines**, one outbound link to
Node Phase 6, and **no second full treatment**.

## Delivery waves

| Wave | Scope | Notes |
|---|---|---|
| **A — Build** | Parts 1–3 + Phase 10 | Explanations are written for the full map; Wave labels guide study order |
| **B — Produce** | Phases 11–13 | Concurrency and production ops |
| Testcontainers (Phase 9) | After Node Phase 9 | Keep both pages aligned |

## Boundary with Node (short)

| Concern | Home |
|---|---|
| Pool sizing, exhaustion, lifecycle | **Node 6** |
| Transaction propagation through services | **Node 6** |
| N+1, repository rationale, ORM trade-off | **Node 6** |
| Writing SQL through the driver; DDL/seed/bulk; CRUD patterns | **PG Part 3** |

Pending recap-length and wave-delivery wording live in
`reviews/syllabus-re-review.md` until applied.

## Reviews (historical, excluded from build)

Working records under `docs/postgresql/reviews/` in the repo (not served):

- `reviews/grok-recommendation.md`
- `reviews/audit-claude.md`
- `reviews/syllabus-re-review.md` — parked amendments to apply later
- `reviews/proposed-syllabus/` — original proposal snapshot

---

Start → [Part 1 — Foundations](syllabus/01-foundations.md)
