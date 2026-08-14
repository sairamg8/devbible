---
title: "Phase 2 — Middleware architecture"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: Express 5.2.1 on Node 24.19.0.**

> ✅ **Phase complete — 9 of 9 topics, 2026-08-14.** Every page carries a `> Verified:`
> line naming the Express documentation behind its claims. **Documentation-validated,
> not sandbox-measured** — nothing was run, so no console block was added or changed.
> Page 06 is the one place the docs stop short: there is **no documented reserved-name
> list** for `req`/`res`, so its Verified line says the request and response references
> *are* the list rather than pretending a rule exists.

The whole framework is a stack of functions. **Order, `next`, and termination**
are the job.

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **[The middleware contract](01-middleware-contract.md)** | <span className="db-tier t-master">Master</span> | `(req, res, next) => void` — continue, finish, or error |
| 02 | **[Execution order](02-execution-order.md)** | <span className="db-tier t-master">Master</span> | App → router → route; first registered runs first |
| 03 | **[next semantics](03-next-semantics.md)** | <span className="db-tier t-master">Master</span> | `next()` vs `next(err)` vs hang vs double-send |
| 04 | **[Middleware factories](04-middleware-factories.md)** | <span className="db-tier t-understand">Understand</span> | `(options) => (req, res, next) => …` |
| 05 | **[First and last](05-first-and-last.md)** | <span className="db-tier t-understand">Understand</span> | Body parser early; error middleware last |
| 06 | **[Mutating req and res](06-mutating-req-res.md)** | <span className="db-tier t-understand">Understand</span> | Attach `req.user` safely; do not clobber core fields |
| 07 | **[Built-in and third-party](07-builtin-and-third-party.md)** | <span className="db-tier t-know">Know</span> | What ships with Express vs what you install |

## Coverage

| Syllabus topic | Page |
|---|---|
| Middleware contract | 01 |
| Execution order and mounting | 02 |
| `next` / `next(err)` / hang | 03 |
| Writing middleware factories | 04 |
| Must run first / last | 05 |
| Mutating req/res | 06 |
| Built-in map | 07 |
| Evaluating third-party | 07 |
| Terminating early / next after send | 03 |

## Phase gate

You can place body parser, auth, routes, and error middleware in the only order
that works, and diagnose a hang as “forgot `next`” vs “forgot to send.”

## Where this connects

- **Phase 0** — lifecycle map  
- **Phase 1** — routers as stacks  
- **Phase 3** — body parsers as middleware  
- **Phase 5** — four-arg error middleware in depth  
- **Phase 8–9** — validation and security mounts  

---

← Syllabus: [Part 1 — Foundations](../../syllabus/01-foundations.md) · Start → [The middleware contract](01-middleware-contract.md)
