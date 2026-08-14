---
title: "Phase 1 — Routing and path matching"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: Express 5.2.1 on Node 24.19.0.** Examples below were executed on that pair.

> ✅ **Phase complete — 9 of 9 topics, 2026-08-14.** Every page carries a `> Verified:`
> line naming the Express documentation behind its claims. **Documentation-validated,
> not sandbox-measured**: this pass ran nothing, so no console block was added or
> changed. Where the docs settle a point the page did not make, the Verified line says
> so — the `app.head`-before-`app.get` caveat on 01, the `qs`-vs-`simple` contradiction
> in Express's own docs on 02, the splat-is-an-array consequence on 05, and the sub-app
> `mount` event on 07.

How URLs become handlers. **Order is load-bearing** — Express will not warn you
when the wrong route wins.

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **[HTTP methods](01-http-methods.md)** | <span className="db-tier t-master">Master</span> | `get`/`post`/… and why wrong method is 404, not 405 |
| 02 | **[Params and query](02-params-and-query.md)** | <span className="db-tier t-master">Master</span> | `req.params`, `req.query`, arrays, Express 5 splats |
| 03 | **[Router composition](03-router-composition.md)** | <span className="db-tier t-master">Master</span> | Modular routers, mounts, `mergeParams` |
| 04 | **[Route ordering](04-route-ordering.md)** | <span className="db-tier t-understand">Understand</span> | Static segments before params — or `/export` becomes an id |
| 05 | **[Path matching on Express 5](05-path-matching-express5.md)** | <span className="db-tier t-understand">Understand</span> | Why `*` and `:id?` throw; legal patterns |
| 06 | **[router.param](06-router-param.md)** | <span className="db-tier t-know">Know</span> | Load a resource once for every route that needs it |
| 07 | **[app.route and hosts](07-app-route-and-hosts.md)** | <span className="db-tier t-know">Know</span> | Chain methods on one path; host-aware mounting |

## Coverage

| Syllabus topic | Page |
|---|---|
| HTTP method routing | 01 |
| Params, query, wildcards | 02 |
| `express.Router()` composition | 03 |
| Nested routers and prefixes | 03 |
| Route ordering pitfalls | 04 |
| Express 5 path-to-regexp | 05 |
| `router.param` | 06 |
| `app.route` chaining | 07 |
| Host-based routing / `mountpath` | 07 |

## Phase gate

You can explain why a catch-all or `/:id` registered too early steals traffic, and
structure feature modules as mounted routers with clean prefixes.

## Where this connects

- **Phase 0** — object graph and lifecycle  
- **Phase 2** — middleware on routers vs app  
- **Phase 4** — SPA `/*splat` fallback with static files  
- **Phase 6** — versioning prefixes as mounts  

---

← Syllabus: [Part 1 — Foundations](../../syllabus/01-foundations.md) · Start → [HTTP methods](01-http-methods.md)
