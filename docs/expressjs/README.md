---
title: "Express.js — Syllabus"
sidebar_label: "Overview"
sidebar_position: 0
---

> Verified: 2026-08 against **Express 5.2.1** on **Node 24.19.0**.

The complete topic inventory for Express.js, tiered for **mastery in fullstack
application development**. 11 phases, split into 4 parts to stay under the
300-line file cap.

Roughly **half of this syllabus is HTTP API design** that happens to be mounted
on Express. Node deliberately refused to absorb REST modeling, pagination,
versioning, idempotency, and ETags; the framework that shapes the routes is the
honest home.

## Version facts

| | |
|---|---|
| Target Express | **5.x** (this inventory verified on **5.2.1**) |
| Target Node | **24** Active LTS — same rule as the Node syllabus |
| Do not start before | Node **Phase 5** (`node:http`). Express is a thin layer over it |
| Prefer also having | Node Phase 8 before Express Phases 8–9 (auth/security *concepts*) |

## Parts

| # | Part | Covers | Phases |
|---|---|---|---|
| 1 | **[Foundations](syllabus/01-foundations.md)** | Express over `node:http`, routing, middleware | 0–2 |
| 2 | **[HTTP surface](syllabus/02-http-surface.md)** | Request parsers, responses, static files, errors | 3–5 |
| 3 | **[API product](syllabus/03-api-product.md)** | REST design, pagination/versioning/idempotency, thin layering | 6–7 |
| 4 | **[Edge & ops](syllabus/04-edge-and-ops.md)** | Validation middleware, authz at the edge, hardening, app factory | 8–10 |

## Explanations

The explanations live separately, in **[Explanations](./pages/README.md)** —
one page per topic, with code, gotchas and interview questions.

import Progress from '@site/src/components/Progress';

<Progress lang="expressjs" compact />

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
| <span className="db-tier t-master">Master</span> | 28 | 25% |
| <span className="db-tier t-understand">Understand</span> | 56 | 49% |
| <span className="db-tier t-know">Know</span> | 26 | 23% |
| <span className="db-tier t-when">When Needed</span> | 4 | 4% |
| **Total** | **114** | |

By part: Foundations 26 · HTTP surface 33 · API product 22 · Edge & ops 33.

If you only ever finish the <span className="db-tier t-master">Master</span> set, you can ship and debug a production REST API on Express. The rest is range.

## Prerequisites

1. **JavaScript** through promises and modules (same bar as Node).
2. **Node through Phase 5** — `node:http`, request bodies as streams, signals,
   graceful HTTP shutdown. Learning Express first means learning the abstraction
   without the thing it abstracts.
3. **Node Phase 8** before Express Phases 8–9 — password/JWT/session *concepts*
   live in Node; Express only mounts the middleware surface.
4. **Node Phase 7** before the “fire a job from a route” row — the queue shape
   is Node’s; Express only triggers it without blocking the response.

## Reading order

Phases are sequential through Phase 5. After that:

1. **Do not skip Phase 0–2.** Every “middleware didn’t run” bug traces back here.
2. **Phase 6 before Phase 7** — design the HTTP product surface before layering
   folders around it.
3. Prefer writing/reading **Phases 0–7** before 8–10 if Node Phase 8 pages are
   still incomplete — 8–9 cross-link those concepts.

## Boundary rule (one line)

> **Concept → Node (or DB / Redis / Docker / Nginx).**  
> **Middleware + route surface + HTTP contracts → Express.**

## Handoff from Node — coverage map

| Node handoff item | Phase |
|---|---|
| REST resource modeling | 6 |
| Middleware architecture | 2 |
| Request lifecycle | 0 |
| Controller / service / repository wiring | 7 |
| Status codes + response / error-body contracts | 4, 5, 6 |
| Pagination · filtering · sorting · searching | 6 |
| API versioning | 6 |
| Idempotency keys | 6 |
| ETags and conditional requests | 6 |
| `Cache-Control` (API, not only static) | 4 · 6 |
| Multipart uploads | 3 |
| OpenAPI | 6 |
| Webhook delivery and verification | 6 |
| Route-level authorization (RBAC, ownership) | 8 |

## Sources

- [Express 5.x documentation](https://expressjs.com/)
- [Express 5 migration guide](https://expressjs.com/en/guide/migrating-5.html)
- Node handoff: [Part 4 — Production](/docs/nodejs/syllabus/production)
- Inventory review: `reviews/verdict-claude.md` (historical; excluded from build)
