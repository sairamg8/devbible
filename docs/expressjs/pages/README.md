---
title: "Express.js — Pages"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: Express 5.x on Node 24** — examples executed on **Express 5.2.1** /
> **Node 24.19.0** before they are written down.

:::tip ✅ Master-tier depth pass COMPLETE — session `b7f137c4` (continued `ffadd057`), 2026-08-14

**All 28 Master-tier topics rewritten to full depth and chunked.** The corpus is now
**179 files, 29,893 lines** across 11 phases, 114 of 114 syllabus topics — every page
carrying a `> Verified:` line, a tier badge, Gotchas, a Trade-off and Interview questions;
every phase README with a Coverage table; **nothing over the 300-line cap** and **zero
broken links** in a clean isolated rebuild.

**What the pass fixed.** All 28 Master topics had been sitting between 63 and 200 lines
with **not one chunked** — a flat tier curve (Master avg 139, Understand avg 144) against
a corpus where PostgreSQL's Master topics median 530 lines across chunk directories. That
is the documented tell that pages were sized to the 300-line cap rather than to the topic.
**The cap is a file-size rule, never a content budget.** Those 28 topics went from 3,829
lines to 21,190 across 2–5 chunks each, every split on a concept boundary.

**It was additive and nothing was run.** Existing prose, examples and console blocks were
kept; no sandbox was built, no output invented. New material is validated against the
Express 5 documentation, the relevant RFCs (9110, 6749, 6750, 6585, 7519, 7239) and MDN,
each named in the page's `> Verified:` line.

:::

:::info Previous pass — session `8679dc8c`, 2026-08-14

Picked up after the [Node.js audit](../../nodejs/pages/README.md) confirmed Node
complete — Express is a thin layer over `node:http`, so it was deliberately left until
the thing it abstracts was finished.

**What this pass was.** The 78 pages that existed covered all 11 phases but most were
outlines — phases 6–10 averaged 25–36 lines with almost no Gotchas and no Trade-offs.
Every page was brought to depth, **and nine syllabus topics that had no page at all were
found and written**: content negotiation (4), error logging at the edge (5), PATCH/bulk
and hypermedia (6), transaction middleware (7), type inference (8), security headers
beyond defaults (9, merged into Helmet), and feature flags plus serverless adapters (10).

**How they were found.** Every one hid behind a phase README with **no Coverage table**.
All eleven phases now have one, mapping each syllabus row to the page that covers it —
so the next gap is visible rather than invisible.

**Evidence standard.** Phases 1–10 are **documentation-validated with no sandbox runs**:
each `> Verified:` line names the Express, Node, MDN, RFC or W3C source behind its
claims, and **no console block was added or changed** — nothing was run. Where the
documentation stops, the pages say so rather than guessing, and two known-wrong console
blocks are labelled in place rather than replaced with invented output.

:::

The explanations behind the [Express.js syllabus](../README.md). Phases are
sequential; the syllabus explains why the order is load-bearing.

import Progress from '@site/src/components/Progress';

<Progress lang="expressjs" />

## What each phase covers

| Phase | Covers |
|---|---|
| **[0 — Express over `node:http`](./phase-0-express-basics/README.md)** ✅ | What Express is, object graph, lifecycle, settings, Express 5 vs 4 — **8/8 topics done** |
| **[1 — Routing](./phase-1-routing/README.md)** ✅ | Verbs, params, Router, order, path-to-regexp, `router.param` — **9/9 topics done** |
| **[2 — Middleware](./phase-2-middleware/README.md)** ✅ | Contract, mount order, `next`, factories — **9/9 topics done** |
| **[3 — Requests](./phase-3-requests/README.md)** ✅ | Body parsers, limits, query parser, multipart, cookies — **12/12 topics done** |
| **[4 — Responses](./phase-4-responses/README.md)** ✅ | `res` discipline, static, SPA fallback, cookies out, content negotiation — **12/12 topics done** |
| **[5 — Errors](./phase-5-errors/README.md)** ✅ | Four-arg middleware, Express 5 async, error envelope, edge logging — **9/9 topics done** |
| **[6 — REST surface](./phase-6-rest-surface/README.md)** ✅ | Resources, pagination, versioning, idempotency, OpenAPI, webhooks, PATCH/bulk, hypermedia — **14/14 topics done** |
| **[7 — Layering](./phase-7-layering/README.md)** ✅ | Controller → service → repository, DI, jobs from routes, transactions — **8/8 topics done** |
| **[8 — Validation & authz](./phase-8-validation-authz/README.md)** ✅ | Boundary parsing, authn, RBAC, ownership/IDOR, tenancy, type inference — **13/13 topics done** |
| **[9 — Hardening](./phase-9-hardening/README.md)** ✅ | `trust proxy`, CORS, Helmet/COOP, rate limits, CSRF, timeouts, secrets — **9/9 topics done** |
| **[10 — App factory](./phase-10-app-factory/README.md)** ✅ | `createApp(deps)`, Supertest, health/readiness, shutdown, flags/serverless — **11/11 topics done** |

All phases have explanation pages. The inventory remains the source of truth for
topic rows: [syllabus](../syllabus/01-foundations.md).
