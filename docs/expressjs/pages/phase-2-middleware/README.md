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
| 01 | **[The middleware contract](01-middleware-contract/README.md)** *(3 chunks)* | <span className="db-tier t-master">Master</span> | `(req, res, next) => void` — the three legal endings, arity as part of the contract, the factory convention, and seven things Express permits that you should not do |
| 02 | **[Execution order](02-execution-order/README.md)** *(2 chunks)* | <span className="db-tier t-master">Master</span> | One mechanism not four; why the familiar app→router→route order flips if you mount first; and how to see the order and stop it drifting |
| 03 | **[next semantics](03-next-semantics/README.md)** *(3 chunks)* | <span className="db-tier t-master">Master</span> | Four interpretations of one argument, including two magic strings; the hang with no status code; and the double-send whose stack points at the victim |
| 04 | **[Middleware factories](04-middleware-factories.md)** | <span className="db-tier t-understand">Understand</span> | `(options) => (req, res, next) => …` |
| 05 | **[First and last](05-first-and-last.md)** | <span className="db-tier t-understand">Understand</span> | Body parser early; error middleware last |
| 06 | **[Mutating req and res](06-mutating-req-res.md)** | <span className="db-tier t-understand">Understand</span> | Attach `req.user` safely; do not clobber core fields |
| 07 | **[Built-in and third-party](07-builtin-and-third-party.md)** | <span className="db-tier t-know">Know</span> | What ships with Express vs what you install |

> 🔴 **Master-tier depth pass complete for this phase** (session `ffadd057`,
> 2026-08-14). Topics 01–03 were written at 102–152 lines with none chunked — sized
> to the 300-line cap rather than to the topic — and have been rewritten to full
> depth as `NN-topic/` directories: **01 is 3 chunks (750 lines), 02 is 2 chunks
> (508), 03 is 3 chunks (799)**. Still no runs; the new mechanism claims are read
> from the installed `express@5.2.1` and `router@2.2.0` source, cited by function.

## Coverage

| Syllabus topic | Page |
|---|---|
| Middleware contract | 01 (chunks [01](01-middleware-contract/01-the-shape-and-the-endings.md) · [02](01-middleware-contract/02-middleware-that-composes.md) · [03](01-middleware-contract/03-what-middleware-must-not-do.md)) |
| Execution order and mounting | 02 (chunks [01](02-execution-order/01-the-four-levels.md) · [02](02-execution-order/02-ordering-in-practice.md)) |
| `next` / `next(err)` / hang | 03 (chunks [01](03-next-semantics/01-what-you-can-pass.md) · [02](03-next-semantics/02-the-hang.md) · [03](03-next-semantics/03-double-send-and-guards.md)) |
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

← Syllabus: [Part 1 — Foundations](../../syllabus/01-foundations.md) · Start → [The middleware contract](01-middleware-contract/README.md)
