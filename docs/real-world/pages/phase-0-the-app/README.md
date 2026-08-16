---
title: "Phase 0 — The app"
sidebar_label: "Overview"
sidebar_position: 0
---

> The spec every other chapter refers back to. Read this phase first — it is
> short on purpose, and nothing later re-explains what is fixed here.

Three pages, in order:

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **[The storefront spec](01-the-storefront-spec.md)** | <span className="db-tier t-master">Master</span> | What the app does: roles, entities, flows, and the non-functionals that force the engineering |
| 02 | **[Architecture and the data model](02-architecture-and-data-model.md)** | <span className="db-tier t-master">Master</span> | Two processes plus PostgreSQL and object storage; eleven tables; who owns what |
| 03 | **[How to read this track](03-how-to-read-this-track.md)** | <span className="db-tier t-know">Know</span> | The chapter shape, the links-not-duplicates rule, reading order |

## Coverage

| Syllabus topic | Page |
|---|---|
| The storefront spec — features, roles, flows | 01 |
| Architecture and data model overview | 02 |
| How to read this track | 03 |

## Phase gate

Move on when you can answer, without looking: what may a guest do that a
customer's session survives? why does an order never join back to
`products.price`? which process sends the confirmation email, and what
guarantees it is not lost?

## Where this connects

Everything — this phase is the root. The first implementations begin in
**Phase 1 · The database**, whose chapters build the eleven tables named here.
