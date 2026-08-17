---
title: "Real World — Syllabus"
sidebar_label: "Overview"
sidebar_position: 0
---

> Verified: 2026-08. Implementation track — every chapter is validated against the
> concept pages it composes and the official documentation it names.

One app, built for real, across the whole stack. This track exists so that
everything the language sections teach gets **used** somewhere you can copy from:
each chapter implements one piece of the same application and links to the
concept pages that explain the ideas it builds on.

## The app — a storefront

A product catalog with search and infinite scroll, a cart that survives login,
checkout against real inventory, orders with emails and webhooks, accounts with
sessions, review uploads with images, and an admin dashboard. The same
feature set a production PERN or MERN app needs — because that is the point.

**The stack is PERN-first by choice: raw SQL through `pg`, no ORM.** Node and
Express own the backend, React the frontend. The MongoDB phase at the end mirrors
the same data layer for the MERN variant.

## What this track is not

**Nothing here re-teaches a concept.** Connection pooling, hook rules, middleware
order, JWT trade-offs — those live in their language sections, and every chapter
links to them instead of repeating them. If a chapter and a concept page ever
disagree, the concept page wins and the chapter has a bug.

| The concept lives in | This track adds |
|---|---|
| [PostgreSQL — Node + raw pg](../postgresql/syllabus/03-node-and-pg.md) | the storefront's actual schema, queries and transactions |
| [Node.js — the runtime through production](../nodejs/README.md) | the services: boot, workers, uploads, webhooks |
| [Express — the framework](../expressjs/README.md) | the storefront API, assembled end to end |
| [React — custom hooks](../react/pages/phase-7-custom-hooks/README.md) | the hooks and screens this app actually needs |
| [JavaScript — machine coding](../javascript/pages/README.md) | app-shaped custom functions, built on those foundations |

## Parts

| # | Part | Covers | Phases |
|---|---|---|---|
| 1 | **[The backend spine](syllabus/01-backend.md)** | The app spec, the database on raw `pg`, Node services, the Express API | 0–3 |
| 2 | **[The frontend](syllabus/02-frontend.md)** | React UI and custom hooks, JavaScript custom functions, TypeScript across the stack | 4–6 |
| 3 | **[Completion](syllabus/03-completion.md)** | CSS recipes for the storefront UI, the MongoDB mirror | 7–8 |

## Explanations

The chapters live in **[Explanations](./pages/README.md)** — one page per
implementation, with the full code, its trade-offs, gotchas and interview
questions.

import Progress from '@site/src/components/Progress';

<Progress lang="realworld" compact />

## Tier distribution

| Tier | Topics |
|---|---|
| <span className="db-tier t-master">Master</span> | 36 |
| <span className="db-tier t-understand">Understand</span> | 27 |
| <span className="db-tier t-know">Know</span> | 14 |
| **Total** | **77** |

⚠️ **77, not 79** — phase 7's header and checkout-form topics were dropped on
2026-08-17 (see the [Completion syllabus](./syllabus/03-completion.md)).
Their rows are struck through rather than deleted, so the cut stays visible.

Master runs high here on purpose: an implementations track is precisely the
"use with no documentation open" material.

## Reading order

Phase 0 first, always — every later chapter refers to the spec. After that the
waves are independent: a backend developer can run 1 → 2 → 3 and stop; a
frontend developer can read phase 0 and jump to 4. Inside a phase, chapters are
sequential — later ones import code from earlier ones.

## Prerequisites

Each phase names the concept phases it assumes in its README. As a rule: the
backend phases assume Node phases 0–6 and the PostgreSQL SQL part; the frontend
phases assume JavaScript phases 0–8 and React phases 0–7.
