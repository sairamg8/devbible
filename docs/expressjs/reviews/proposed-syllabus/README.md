---
title: "Express.js — Proposed syllabus (review)"
sidebar_label: "Proposed syllabus"
sidebar_position: 10
---

:::note Proposal — not the live syllabus
This is the **row-level Express.js topic inventory** drafted for review
(2026-08-11). It lives under `docs/expressjs/reviews/proposed-syllabus/` until
approved. After approval it should be promoted to `docs/expressjs/syllabus/`
with an Express overview at `docs/expressjs/README.md`. **No explanation pages
until that inventory is signed off.**

**2026-08-11 update:** Claude’s verdict (`../verdict-claude.md`) applied
**additively** — six rows, one tier flip, README sizing/sequencing notes. Nothing
removed from the earlier draft; historical review files are left untouched.
:::

> Target: **Express 5.x** (verify on **5.2.1+**) on **Node 24** Active LTS.  
> Architectural role: **HTTP edge** — routing, middleware, request/response
> contracts, API product surface, and the app factory that wires the rest of
> the stack. Not the place to re-teach Node, databases, Redis, or Docker.

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
| Target Express | **5.x** (path-to-regexp rewrite, async errors auto-forward to `next`) |
| Target Node | **24** Active LTS — same rule as the Node syllabus |
| Do not start before | Node **Phase 5** (`node:http`). Express is a thin layer over it |
| Prefer also having | Node Phase 8 (auth/security concepts) before Express Phases 8–9 |

## Parts

| # | Part | Covers | Phases |
|---|---|---|---|
| 1 | **[Foundations](01-foundations.md)** | Express over `node:http`, routing, middleware | 0–2 |
| 2 | **[HTTP surface](02-http-surface.md)** | Request parsers, responses, static files, errors | 3–5 |
| 3 | **[API product](03-api-product.md)** | REST design, pagination/versioning/idempotency, thin layering | 6–7 |
| 4 | **[Edge & ops](04-edge-and-ops.md)** | Validation middleware, authz at the edge, hardening, app factory | 8–10 |

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

Master sits at **25%** — inside the brief’s 25–30% band. Prefer demoting further
over promoting if a review pass feels crowded.

**Sizing:** ~114 topics ≈ **~90 explanation pages** at Node’s realised ratio.
That investment is intentional (API product + edge), not accidental bloat.

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
3. Phases 8–10 can parallelize with building; still finish the Master rows before
   calling the API “production-ready”.

### Sequencing vs unfinished Node Phase 8

Express Phases **8–9** cross-link Node Phase 8 rows that may still be unwritten
(validation, rate limit, security headers). Two honest options:

1. Finish Node Phase 8 pages first, then Express from 0.
2. **Preferred:** write Express **Phases 0–7** first (depend only on Node Phase 5
   / thin Phase 7 job links); **hold Express 8–10** until Node 8 lands.

Option 2 keeps both tracks moving without broken theory links.

## Boundary rule (one line)

> **Concept → Node (or DB / Redis / Docker / Nginx).**  
> **Middleware + route surface + HTTP contracts → Express.**

## Handoff from Node — coverage map

Every item Node promised under “Express picks up” has an explicit row:

| Node handoff item | Phase / row |
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
| `Cache-Control` (API, not only static) | 4 (static) · 6 (API) |
| Multipart uploads | 3 |
| OpenAPI | 6 |
| Webhook delivery and verification | 6 |
| Route-level authorization (RBAC, ownership) | 8 |

## Sources used for this proposal

- `instructions.md` — tiers, granularity, process
- `docs/nodejs/syllabus/04-production.md` — Express handoff list
- Scope boundaries memory — Node vs Express line
- Prior reviews: `../syllabus-review.md`, **`../verdict-claude.md`** (applied additively)
- Express 5 migration notes (path matching, async error forwarding; verified on 5.2.1 in Claude’s audit)

## Process after approval

1. Promote these four part files to `docs/expressjs/syllabus/`.
2. Add `docs/expressjs/README.md` (overview + progress) and sidebar entry.
3. **Stop.** Explanation pages only after the inventory is approved, one phase
   at a time.

---

Start → [Part 1 — Foundations](01-foundations.md)
