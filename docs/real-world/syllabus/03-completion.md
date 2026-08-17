---
title: "Part 3 — Completion"
sidebar_label: "3 · Completion"
sidebar_position: 3
---

> Phases 7–8 · CSS recipes for the storefront UI, the MongoDB mirror

The finishing layers: the styling the screens from Phase 4 actually need, and
the same data layer rebuilt on MongoDB for the MERN variant.

---

## Phase 7 — CSS recipes for the storefront

Concepts live in the [CSS section](../../css/README.md); these chapters are the
storefront's stylesheet, component by component.

:::warning Scope cut — 2026-08-17

**The header and navigation** and **the checkout form** were **dropped** on the
user's instruction: *"i do not need that checkout form in css / that header and
navigation as well"*, because *"it was css i know how to build those, they are
not worth for writing topics"*.

Both are standard flex and grid work whose mechanisms already have homes in the
[CSS section](../../css/README.md) — a bar shell is
[CSS 4·06](../../css/pages/phase-4-flexbox/06-flexbox-patterns/01-bars-and-shells.md)
and form-state styling is
[CSS 1·09](../../css/pages/phase-1-selectors/09-form-state-pseudo-classes.md).
The four topics that remain are the ones with traps a concept page does not
cover on its own.

**Phase 7 is 4 topics, not 6.** Reinstating either needs a new instruction.

:::

| Topic | Tier | |
|---|---|---|
| **The product grid** — Grid + container queries, from phone to wide desktop | <span className="db-tier t-master">Master</span> | |
| ~~The header and navigation~~ | — | 🚫 **dropped** |
| ~~The checkout form~~ | — | 🚫 **dropped** |
| Skeleton loaders and spinners — perceived speed while the hooks fetch | <span className="db-tier t-understand">Understand</span> | |
| Dark mode — the token layer, honouring the three viewer states | <span className="db-tier t-understand">Understand</span> | |
| The overlay layer — toasts and modals that never fight the stacking context | <span className="db-tier t-understand">Understand</span> | |

---

## Phase 8 — The MongoDB mirror (MERN)

The Phase 1 data layer, rebuilt on MongoDB. Deliberately last: the running stack
is PERN by choice, and this phase exists so the MERN variant is a rewrite of one
layer, not a different book. Driver concepts live in
[MongoDB](../../mongodb/README.md) and
[Node Phase 6 — Data access](../../nodejs/pages/phase-6-data-access/README.md).

| Topic | Tier |
|---|---|
| **Modeling the store as documents** — embed vs. reference, and where each table landed | <span className="db-tier t-understand">Understand</span> |
| The catalog on MongoDB — filters, sort, pagination with the same API contract | <span className="db-tier t-understand">Understand</span> |
| **Checkout with transactions** — the stock decrement, sessions, and the write-concern trade | <span className="db-tier t-understand">Understand</span> |
| The dashboard on the aggregation pipeline | <span className="db-tier t-understand">Understand</span> |
| Indexes for this app's queries — and reading `explain()` | <span className="db-tier t-understand">Understand</span> |
| Change streams where `LISTEN`/`NOTIFY` was | <span className="db-tier t-know">Know</span> |

**Gate — deliverable:** the Phase 3 API passing its own end-to-end flow against
the Mongo data layer with no route or contract change.

---

## Where this connects

| From | To |
|---|---|
| Phase 1 | **PostgreSQL** — every concept this schema leans on |
| Phase 2 | **Node.js** phases 3–7, 10–11 — streams, processes, jobs, boot |
| Phase 3 | **Express** — the whole framework section |
| Phase 4 | **React** phases 0–7 — components, state, effects, custom hooks |
| Phase 5 | **JavaScript** phase 17 — the from-scratch foundations |
| Phase 7 | **CSS** — grid, container queries, theming |
| Phase 8 | **MongoDB** — driver, transactions, aggregation |
| Deployment | **Docker Phase 9** already containerizes this exact stack — no chapter here duplicates it |

### Deliberately not here

Redis chapters (the cache and rate-limit interfaces in Phases 2–3 are
Redis-shaped, and the Redis section will own the real implementations when it is
written), Nginx serving and TLS (its section owns that), CI/CD pipelines
(Docker and Git sections), and any framework not already in the stack.

---

← Prev: [Part 2 — The frontend](02-frontend.md) · Index: [Real World](../README.md)
