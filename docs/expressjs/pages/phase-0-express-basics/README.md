---
title: "Phase 0 — Express over node:http"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: Express 5.x on Node 24 — Active LTS as of August 2026.**
> Every example on these pages was executed on **Express 5.2.1** and
> **Node 24.19.0**. APIs used are available on that pair.

Express is not a second language and not an application architecture. It is a
routing and middleware layer on top of `node:http`. If that sentence is fuzzy,
stay in this phase.

Seven pages, in order. The first three are load-bearing.

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **[What Express is](01-what-express-is.md)** | <span className="db-tier t-master">Master</span> | Router + middleware over `http.Server` — not a language, not a full stack |
| 02 | **[app, Router, and http.Server](02-app-router-server.md)** | <span className="db-tier t-master">Master</span> | Three objects: who mounts, who listens, who owns the stack |
| 03 | **[The request lifecycle](03-request-lifecycle.md)** | <span className="db-tier t-master">Master</span> | Accept → middleware chain → handler → response (or error middleware) |
| 04 | **[Creating an app](04-creating-an-app.md)** | <span className="db-tier t-understand">Understand</span> | `express()`, `listen`, and listening on a prebuilt server |
| 05 | **[Application settings](05-application-settings.md)** | <span className="db-tier t-understand">Understand</span> | `app.set` defaults you should know: `x-powered-by`, `etag`, `query parser`, `trust proxy` |
| 06 | **[Express 5 vs 4](06-express-5-vs-4.md)** | <span className="db-tier t-understand">Understand</span> | Path matching rewrite, async errors to `next`, removed APIs |
| 07 | **[When not to use Express](07-when-not-to-use-express.md)** | <span className="db-tier t-know">Know</span> | Fastify / Hono trade-offs — and when Express still wins |

## Coverage

| Syllabus topic | Page |
|---|---|
| What Express is and is not | 01 |
| `app` vs `Router` vs `http.Server` | 02 |
| The request lifecycle | 03 |
| Application instantiation | 04 |
| Application settings (grouped) | 05 |
| Express 5 vs 4 | 06 |
| When not to use Express | 07 |
| Reading Express docs and source shape | 01 · 07 |

## Phase gate

Move on to Phase 1 when you can **draw the object graph** and point to where a
request is lost if nobody calls `next` and nobody writes a response — and name
what Express 5 broke about `app.get('*')`.

## Where this connects

- **Node Phase 5** — `node:http` is the substrate. Do not start here without it.
- **Phase 1 — Routing** — how URLs become handlers once the app exists.
- **Phase 2 — Middleware** — the stack that *is* the framework.
- **Phase 5 — Errors** — Express 5 async forwarding, four-arg middleware in depth.

---

← Syllabus: [Part 1 — Foundations](../../syllabus/01-foundations.md) · Start → [What Express is](01-what-express-is.md)
