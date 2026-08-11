---
title: "Express.js — Pages"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: Express 5.x on Node 24** — examples executed on **Express 5.2.1** /
> **Node 24.19.0** before they are written down.

The explanations behind the [Express.js syllabus](../README.md). Phases are
sequential; the syllabus explains why the order is load-bearing.

import Progress from '@site/src/components/Progress';

<Progress lang="expressjs" />

## What each phase covers

| Phase | Covers |
|---|---|
| **[0 — Express over `node:http`](phase-0-express-basics/)** | What Express is, object graph, lifecycle, settings, Express 5 vs 4 |
| **[1 — Routing](phase-1-routing/)** | Verbs, params, Router, order, path-to-regexp, `router.param` |
| **[2 — Middleware](phase-2-middleware/)** | Contract, mount order, `next`, factories |
| **[3 — Requests](phase-3-requests/)** | Body parsers, limits, query parser, multipart, cookies |
| **[4 — Responses](phase-4-responses/)** | `res` discipline, static, SPA fallback, cookies out |
| **[5 — Errors](phase-5-errors/)** | Four-arg middleware, Express 5 async, error envelope |
| **[6 — REST surface](phase-6-rest-surface/)** | Resources, pagination, versioning, idempotency, OpenAPI, webhooks |
| **[7 — Layering](phase-7-layering/)** | Controller → service → repository wiring |
| **[8 — Validation & authz](phase-8-validation-authz/)** | Zod factory, authn/authz middleware |
| **[9 — Hardening](phase-9-hardening/)** | `trust proxy`, CORS, Helmet, rate limit |
| **[10 — App factory](phase-10-app-factory/)** | `createApp(deps)`, Supertest, health, shutdown |

All phases have explanation pages. The inventory remains the source of truth for
topic rows: [syllabus](../syllabus/01-foundations.md).
