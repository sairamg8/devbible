---
title: "PostgreSQL — Proposed syllabus (review)"
sidebar_label: "Proposed syllabus"
sidebar_position: 10
---

:::note Proposal — not the live syllabus
This is the **row-level PostgreSQL topic inventory** drafted for review
(2026-08-11). It lives under `docs/postgresql/reviews/proposed-syllabus/` until
approved, which keeps it out of the built site (`exclude: ['**/reviews/**']`).
After sign-off it is promoted to `docs/postgresql/syllabus/` with an overview at
`docs/postgresql/README.md`. **No explanation pages until this inventory is
approved.**
:::

> Target: **PostgreSQL 18** (verified on **18.4**) driven from **Node 24** Active
> LTS with the **`pg`** driver.
> Architectural role: **the database** — the relational model, SQL, the planner,
> concurrency, and the operational surface. Plus, by explicit instruction, the
> **Node-side application layer that talks to it in raw SQL**.

The complete topic inventory for PostgreSQL, tiered for **mastery in fullstack
backend development**. **14 phases, 228 topics**, split into 4 parts to stay
under the 300-line file cap.

## Three instructions that shaped this draft

1. **A dedicated Node + raw `pg` part.** Part 3 (Phases 7–9) is three whole
   phases on driver usage, table creation, data insertion, and the CRUD patterns
   a real API is built from — not a row bolted onto the SQL chapters.
2. **A dedicated `psql` phase.** Phase 1 is the client itself, mastered — 15
   rows, from meta-commands to scripting it in CI.
3. **Every concept gets a Node example.** See the example policy below.

## Example policy — the hard rule for this syllabus

> **Every page carries both halves: the SQL, and the Node `pg` code that issues
> it.** A page that shows only a `psql` transcript is incomplete.

Concretely, each explanation page must contain:

| | |
|---|---|
| The SQL | Runnable, executed against PostgreSQL 18.4 |
| The Node call | The `pg` code that issues it — `$1` placeholders, real result handling |
| The result | Actual output, not a plausible-looking one |
| Failure mode | What the error looks like from Node — SQLSTATE, `error.code`, `constraint` |

This is stricter than the Node and Express syllabi, and it is deliberate: the
goal is a backend reference, so a concept that cannot be reached from
application code has not been explained. Phases 10–13 (planner, concurrency,
ops) still lead with SQL or shell — but each still answers *"what does this mean
for the Node process talking to this database?"*

## Version facts — verified 2026-08-11

| | |
|---|---|
| Target server | **PostgreSQL 18.4** (`postgres:18-alpine`, confirmed via `select version()`) |
| Local client | `psql` **18.4** |
| Driver | **`pg`** (node-postgres) on **Node 24.19.0** |
| Container | Podman, `postgres:18-alpine`, per the existing sandbox convention |
| Note | Node Phase 6/7 pages were measured against **PostgreSQL 17.10**. Nothing there is known to be wrong on 18, but re-check before cross-linking a version-sensitive claim. |

## Tier legend

Same four tiers as Node.js and Express — about **effort allocation**, not
importance.

| Badge | Bar |
|---|---|
| <span className="db-tier t-master">Master</span> | Use confidently with no documentation open |
| <span className="db-tier t-understand">Understand</span> | Know how it works; look up signatures freely |
| <span className="db-tier t-know">Know</span> | Know what/why/when; details on demand |
| <span className="db-tier t-when">When Needed</span> | Don't study upfront |

## Parts

| # | Part | Covers | Phases | Topics |
|---|---|---|---|---|
| 1 | **[Foundations](01-foundations.md)** | Architecture, **psql mastered**, types, DDL | 0–3 | 63 |
| 2 | **[SQL](02-sql.md)** | CRUD/DML, joins, aggregation, windows, CTEs | 4–6 | 49 |
| 3 | **[Node + raw `pg`](03-node-and-pg.md)** | Driver, schema/seeding from Node, API CRUD patterns | 7–9 | 48 |
| 4 | **[Performance & production](04-performance-and-production.md)** | Indexes/planner, MVCC, advanced features, security & ops | 10–13 | 68 |

## Tier distribution

| Tier | Topics | Share |
|---|---|---|
| <span className="db-tier t-master">Master</span> | 60 | 26% |
| <span className="db-tier t-understand">Understand</span> | 124 | 54% |
| <span className="db-tier t-know">Know</span> | 35 | 15% |
| <span className="db-tier t-when">When Needed</span> | 9 | 4% |
| **Total** | **228** | |

Master by part: Foundations 19 · SQL 14 · Node + `pg` 14 · Perf & production 13.

Master sits at **26%**, inside the brief's 25–30% band. Understand is at 54% —
higher than Express's 49%, because PostgreSQL has a large surface you must be
able to reason about but rarely type from memory (isolation levels, index types,
replication).

If you only ever finish the <span className="db-tier t-master">Master</span> set,
you can design a schema, write every query a CRUD API needs in raw SQL, drive it
from Node, and read an `EXPLAIN` when it gets slow.

## Sizing

**228 topics ≈ 150–170 explanation pages** at Node's realised topic-to-page
ratio (211 pages / 248 topics ≈ 0.85, with grouping). That is the largest
technology in the bible after Node itself.

Worth stating plainly before approval: this is a **big** commitment. Two ways to
cut it if you want a smaller target — both are your call, and I have not applied
either:

- **Drop Part 4 to a later pass.** Parts 1–3 (160 topics) are everything needed
  to *build* the backend; Part 4 is what you need when it is slow or in
  production.
- **Demote Phase 12** (advanced features) to a reference appendix rather than
  full pages.

## Prerequisites

1. **SQL from zero is assumed** — this syllabus does not require prior database
   knowledge. Phase 0 starts at "what is a database server".
2. **Node through Phase 2** (async/promises) before Part 3. Every `pg` call is a
   promise.
3. **Node Phase 6 (Data access)** is written and cross-links here — see the
   boundary section below.
4. **Docker/Podman basics** for Phase 0's local setup, or accept the given
   commands on faith until that syllabus lands.

## Reading order

Phases are sequential, with two useful shortcuts:

1. **Phase 1 (`psql`) pays for itself immediately** — do not skip it to get to
   SQL faster. Every later phase is verified in that shell.
2. **Part 3 can start right after Phase 4 (CRUD)** if you want code running
   early. Phases 5–6 (joins, aggregation) then make Phase 9 richer rather than
   blocking it.
3. **Phase 10 (indexes) before Phase 11 (MVCC)** — locking makes more sense once
   you know what a scan is doing.

## Boundary with the Node syllabus — needs your ruling

The scope rule so far has been: *data access in Node covers Node-side concerns
only; the database itself belongs to the PostgreSQL syllabus.* Node Phase 6
already owns these written pages:

> connection pooling and sizing · parameterized queries · driver lifecycle ·
> **`pg`, `Pool` vs `Client`, placeholders, typed results** · transaction
> propagation through service layers · N+1 · drivers vs query builders vs ORMs ·
> repository pattern · migrations as code · Prisma/Drizzle · retry/backoff ·
> read replicas · cursors

Your instruction for a dedicated Node + `pg` part **deliberately overlaps that**.
I have resolved it this way rather than duplicating:

| Concern | Home | Why |
|---|---|---|
| Pool *sizing*, exhaustion, leaks, lifecycle | **Node 6** (written) | Runtime resource management |
| Transaction *propagation* through service layers | **Node 6** (written) | Settled 2026-08-10; do not re-split |
| N+1, repository pattern, ORM trade-off | **Node 6** (written) | Application architecture |
| **Writing the actual SQL through the driver** | **PG Part 3** (new) | The thing you do all day; barely covered by one Node row |
| **DDL, seeding, bulk load, migrations from Node** | **PG Part 3** (new) | Not covered anywhere today |
| **CRUD/pagination/filtering/upsert query patterns** | **PG Part 3** (new) | Not covered anywhere today |

Part 3 pages **link back** to the Node pages for pool and transaction-propagation
mechanics instead of re-explaining them. The genuinely duplicated rows are Phase
7's `Pool` vs `Client` and placeholder rows, kept because Part 3 is unreadable
without them — they should be written as a **short recap plus a link**, not a
second full treatment.

**This is a relaxation of the boundary rule and it needs your explicit
sign-off** — the scope-boundaries rule makes "pick the layer" the
default, and I am proposing an exception on your instruction.

## Open questions for you

1. **Approve the boundary exception above?** (Or should Part 3 shrink and Node 6
   grow instead?)
2. **228 topics — accept, or apply one of the two cuts under Sizing?**
3. **Which ORM stance?** This draft is deliberately **raw-SQL-first**, with
   Prisma/Drizzle left in Node 6 as a comparison row. Confirm that is right.
4. **`pgvector`** is one Know row in Phase 12. Given AI features are common now,
   should it be a bigger section?

## Process after approval

1. Promote the four part files to `docs/postgresql/syllabus/`.
2. Add `docs/postgresql/README.md` (overview + progress) and the sidebar entry.
3. Add `postgresql` to `src/data/progress.js` with all phases at `pages: 0`.
4. **Stop.** Explanation pages only after approval, one phase at a time.

---

Start → [Part 1 — Foundations](01-foundations.md)
