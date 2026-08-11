---
title: "Part 1 — Foundations"
sidebar_label: "1 · Foundations"
sidebar_position: 1
---

> Phases 0–2 · Express over `node:http`, routing, middleware

The mental model everything else hangs off. Express is not a framework that
replaces Node — it is a routing and middleware layer on top of `http.Server`.
If that sentence is fuzzy, stay in this part.

---

## Phase 0 — Express over `node:http`

Why Express exists, what objects you are actually holding, and the request path
from socket to `res.end`.

📖 **Explanation written:** [Phase 0 — Express over node:http](../pages/phase-0-express-basics/)

| Topic | Tier |
|---|---|
| **What Express is and is not** — router + middleware over `node:http`, not a language and not an application architecture | <span className="db-tier t-master">Master</span> |
| **`app` vs `Router` vs `http.Server`** — the object graph: who listens, who mounts, who owns the stack | <span className="db-tier t-master">Master</span> |
| **The request lifecycle** end to end: accept → middleware chain → handler → response (or error middleware) | <span className="db-tier t-master">Master</span> |
| Application instantiation: `express()`, `app.listen` vs listening on a prebuilt `http.Server` | <span className="db-tier t-understand">Understand</span> |
| **Application settings** (grouped) — `app.set` / `app.get`: `x-powered-by`, `etag`, `strict routing`, `case sensitive routing`, `query parser`, `env`, `trust proxy`; which defaults you should change | <span className="db-tier t-understand">Understand</span> |
| **Express 5 vs 4** — path matching rewrite, rejected promises → `next(err)`, removed deprecated APIs; what breaks on upgrade | <span className="db-tier t-understand">Understand</span> |
| When **not** to use Express — Fastify / Hono trade-offs for greenfield high-throughput APIs | <span className="db-tier t-know">Know</span> |
| Reading Express docs and source shape — where settings, router, and application live | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** you can draw the object graph and point to where a
request is lost if nobody calls `next` and nobody writes a response.

---

## Phase 1 — Routing and path matching

How URLs become handlers. Order is load-bearing; Express will not warn you.

📖 **Explanation written:** [Phase 1 — Routing](../pages/phase-1-routing/)

| Topic | Tier |
|---|---|
| **HTTP method routing** — `app.get` / `post` / `put` / `patch` / `delete` / `all`, and method mismatch → 404 not 405 by default | <span className="db-tier t-master">Master</span> |
| **Route params, query strings, wildcards** — `req.params`, `req.query`, splat/rest patterns under Express 5 | <span className="db-tier t-master">Master</span> |
| **`express.Router()` composition** — modular routers, `router.use`, mounting at a prefix | <span className="db-tier t-master">Master</span> |
| Nested routers and multi-level prefixes — how mount paths concatenate | <span className="db-tier t-understand">Understand</span> |
| **Route ordering pitfalls** — `/:id` before `/export`, static segments vs params, why “the wrong handler ran” | <span className="db-tier t-understand">Understand</span> |
| Express 5 **path-to-regexp** changes — what old `:name?` / regex routes need after upgrade (SPA `*` catch-all: see Phase 4) | <span className="db-tier t-understand">Understand</span> |
| `router.param(name, handler)` — resolve a route parameter once for every route that uses it (load + 404 once) | <span className="db-tier t-know">Know</span> |
| `app.route(path)` chaining multiple methods on one path | <span className="db-tier t-know">Know</span> |
| Host-based routing and `app.mountpath` awareness | <span className="db-tier t-when">When Needed</span> |

**Gate — move on when:** you can explain why a catch-all route registered too
early steals traffic, and how to structure routers so feature modules mount cleanly.

---

## Phase 2 — Middleware architecture

The whole framework is a stack of functions. Order, `next`, and termination are
the job.

📖 **Explanation written:** [Phase 2 — Middleware](../pages/phase-2-middleware/)

| Topic | Tier |
|---|---|
| **The middleware contract** — `(req, res, next) => void`, and what “calling next” actually means | <span className="db-tier t-master">Master</span> |
| **Execution order and mounting** — application-level vs router-level vs route-level; first registered runs first | <span className="db-tier t-master">Master</span> |
| **`next()` vs `next(err)` vs never calling `next`** — hang, double-send, and silent drop | <span className="db-tier t-master">Master</span> |
| Writing middleware as a **factory** — `(options) => (req, res, next) => …` so config is not global | <span className="db-tier t-understand">Understand</span> |
| Middleware that **must run first / last** — body parser before routes, error handler after routes (four-arg) | <span className="db-tier t-understand">Understand</span> |
| Mutating `req` / `res` safely — attaching `req.user`, timing fields, and avoiding clobbering core properties | <span className="db-tier t-understand">Understand</span> |
| Built-in middleware map — what Express ships vs what you install | <span className="db-tier t-know">Know</span> |
| Evaluating **third-party middleware** — maintenance, Express 5 support, and “does this need to be middleware at all?” | <span className="db-tier t-know">Know</span> |
| Terminating early — sending a response without `next`, and why calling `next` after `res.json` is a bug | <span className="db-tier t-understand">Understand</span> |

**Gate — move on when:** you can place body parser, auth, route, and error
middleware in the only order that works, and diagnose a hang as “forgot `next`”
vs “forgot to send”.

---

## Counts (this part)

| Tier | Count |
|---|---|
| Master | 9 |
| Understand | 10 |
| Know | 6 |
| When Needed | 1 |
| **Total** | **26** |

---

← Index: [Express.js](../) · Next → [Part 2 — HTTP surface](02-http-surface.md)
