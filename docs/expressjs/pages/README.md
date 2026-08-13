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
| **[0 — Express over `node:http`](./phase-0-express-basics/README.md)** | What Express is, object graph, lifecycle, settings, Express 5 vs 4 |
| **[1 — Routing](./phase-1-routing/README.md)** | Verbs, params, Router, order, path-to-regexp, `router.param` |
| **[2 — Middleware](./phase-2-middleware/README.md)** | Contract, mount order, `next`, factories |
| **[3 — Requests](./phase-3-requests/README.md)** | Body parsers, limits, query parser, multipart, cookies |
| **[4 — Responses](./phase-4-responses/README.md)** | `res` discipline, static, SPA fallback, cookies out |
| **[5 — Errors](./phase-5-errors/README.md)** | Four-arg middleware, Express 5 async, error envelope |
| **[6 — REST surface](./phase-6-rest-surface/README.md)** | Resources, pagination, versioning, idempotency, OpenAPI, webhooks |
| **[7 — Layering](./phase-7-layering/README.md)** | Controller → service → repository wiring |
| **[8 — Validation & authz](./phase-8-validation-authz/README.md)** | Zod factory, authn/authz middleware |
| **[9 — Hardening](./phase-9-hardening/README.md)** | `trust proxy`, CORS, Helmet, rate limit |
| **[10 — App factory](./phase-10-app-factory/README.md)** | `createApp(deps)`, Supertest, health, shutdown |

All phases have explanation pages. The inventory remains the source of truth for
topic rows: [syllabus](../syllabus/01-foundations.md).
