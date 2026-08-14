---
title: "Phase 5 — Error handling"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: Express 5.2.1 on Node 24.19.0.**

> ✅ **Phase complete — 9 of 9 topics, 2026-08-14.** A top-up pass, not just verification:
> the six pages carried **one Gotchas section and no Trade-offs between them**, and
> **error logging at the edge had no page** (now 07). Every page now has a `> Verified:`
> line, a Trade-off, Gotchas and a full interview set.
> **Documentation-validated, not sandbox-measured** — nothing was run, so no console
> block was added or changed.
>
> Where the docs stop, the pages say so: the **operational/programmer split is a Node
> community distinction, not an Express API** (page 05), the **error envelope is this
> bible's design** — Express has no opinion on body shape (page 03), and the
> **what-never-to-log list is security reasoning**, not an upstream rule (page 07).

One funnel for failures. Express 5 forwards async rejections — you still design
the envelope.

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **[Four-arg error middleware](01-error-middleware/README.md)** *(3 chunks)* | <span className="db-tier t-master">Master</span> | Arity as the whole detection mechanism; `finalhandler` in full; and the handler design, line by line |
| 02 | **[Async errors on Express 5](02-async-errors/README.md)** *(3 chunks)* | <span className="db-tier t-master">Master</span> | Exactly what the router attaches to, the four shapes that escape it, and the habits that keep your code inside the guarantee |
| 03 | **[Error response contract](03-error-contract.md)** | <span className="db-tier t-master">Master</span> | Stable JSON; no stacks in production |
| 04 | **[Mapping to HTTP](04-mapping-to-http.md)** | <span className="db-tier t-understand">Understand</span> | 400/401/403/404/409/422/429/503 |
| 05 | **[Operational vs programmer](05-operational-vs-programmer.md)** | <span className="db-tier t-understand">Understand</span> | What to expose vs what to crash/log |
| 06 | **[404 and process errors](06-not-found-and-process.md)** | <span className="db-tier t-know">Know</span> | 404 middleware; process events stay in Node |
| 07 | **[Error logging at the edge](07-error-logging.md)** | <span className="db-tier t-know">Know</span> | What to log, what must never be logged, and why levels matter |

## Coverage

All 9 syllabus topics. **Page 07 was written on 2026-08-14 — error logging at the
edge had no page**, which this README had no Coverage table to reveal. Same gap,
same cause, as content negotiation in [Phase 4](../phase-4-responses/README.md).

| Syllabus topic | Page |
|---|---|
| Four-argument error middleware | 01 (chunks [01](01-error-middleware/01-arity-and-placement.md) · [02](01-error-middleware/02-the-default-handler.md) · [03](01-error-middleware/03-designing-the-handler.md)) |
| Express 5 async errors | 02 (chunks [01](02-async-errors/01-what-is-forwarded.md) · [02](02-async-errors/02-the-shapes-that-escape.md) · [03](02-async-errors/03-writing-async-handlers.md)) |
| Error response contract | 03 |
| Mapping operational failures to HTTP | 04 |
| A thin typed error helper (`statusCode` + `code` + `expose`) | 04 |
| Programmer vs operational at the HTTP edge | 05 |
| 404 handler | 06 |
| Process-level `uncaughtException` / `unhandledRejection` | 06 (cross-link — Node owns it) |
| Error logging at the edge | **07** |

## Phase gate

Thrown async errors, `next(err)`, and malformed JSON all produce the same public
envelope without stack traces when `NODE_ENV=production`.

---

← Syllabus: [Part 2](../../syllabus/02-http-surface.md) · Start → [Four-arg error middleware](01-error-middleware/README.md)
