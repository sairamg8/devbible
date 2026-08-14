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

Seven topics, in order. The first three are load-bearing.

> 🔴 **Master-tier depth pass in progress** (session `ffadd057`, 2026-08-14).
> Express's Master topics were all written at 63–200 lines with none chunked —
> sized to the 300-line cap rather than to the topic. They are being rewritten to
> the depth they deserve, splitting into `NN-topic/` directories on concept
> boundaries. **Topic 01 is done** (4 chunks, ~950 lines, up from 121); topics 02
> and 03 are next. Nothing was re-run: the mechanism claims are read from the
> installed `express@5.2.1` and `router@2.2.0` source, cited by file and function.

| # | Topic | Tier | In one line |
|---|---|---|---|
| 01 | **[What Express is](01-what-express-is/README.md)** *(4 chunks)* | <span className="db-tier t-master">Master</span> | Router + middleware over `http.Server` — the mapping problem, the app-is-a-function mechanism, what it delegates, and where it stops |
| 02 | **[app, Router, and http.Server](02-app-router-server.md)** | <span className="db-tier t-master">Master</span> | Three objects: who mounts, who listens, who owns the stack |
| 03 | **[The request lifecycle](03-request-lifecycle.md)** | <span className="db-tier t-master">Master</span> | Accept → middleware chain → handler → response (or error middleware) |
| 04 | **[Creating an app](04-creating-an-app.md)** | <span className="db-tier t-understand">Understand</span> | `express()`, `listen`, and listening on a prebuilt server |
| 05 | **[Application settings](05-application-settings.md)** | <span className="db-tier t-understand">Understand</span> | `app.set` defaults you should know: `x-powered-by`, `etag`, `query parser`, `trust proxy` |
| 06 | **[Express 5 vs 4](06-express-5-vs-4.md)** | <span className="db-tier t-understand">Understand</span> | Path matching rewrite, async errors to `next`, removed APIs |
| 07 | **[When not to use Express](07-when-not-to-use-express.md)** | <span className="db-tier t-know">Know</span> | Fastify / Hono trade-offs — and when Express still wins |

## Coverage

| Syllabus topic | Page |
|---|---|
| What Express is and is not | 01 (chunks [01](01-what-express-is/01-the-mapping-problem.md) · [04](01-what-express-is/04-the-boundary.md)) |
| `app` vs `Router` vs `http.Server` | 02 |
| The request lifecycle | 03 |
| Application instantiation | 04 |
| Application settings (grouped) | 05 |
| Express 5 vs 4 | 06 |
| When not to use Express | 07 |
| Reading Express docs and source shape | 01 (chunks [02](01-what-express-is/02-the-app-is-a-function.md) · [03](01-what-express-is/03-what-express-delegates.md)) · 07 |

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

← Syllabus: [Part 1 — Foundations](../../syllabus/01-foundations.md) · Start → [What Express is](01-what-express-is/README.md)
