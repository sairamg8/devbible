---
title: "Phase 5 — Error handling"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: Express 5.2.1 on Node 24.19.0.**

One funnel for failures. Express 5 forwards async rejections — you still design
the envelope.

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **[Four-arg error middleware](01-error-middleware.md)** | <span className="db-tier t-master">Master</span> | `(err, req, res, next)` last in the stack |
| 02 | **[Async errors on Express 5](02-async-errors.md)** | <span className="db-tier t-master">Master</span> | Rejected handlers → error middleware |
| 03 | **[Error response contract](03-error-contract.md)** | <span className="db-tier t-master">Master</span> | Stable JSON; no stacks in production |
| 04 | **[Mapping to HTTP](04-mapping-to-http.md)** | <span className="db-tier t-understand">Understand</span> | 400/401/403/404/409/422/429/503 |
| 05 | **[Operational vs programmer](05-operational-vs-programmer.md)** | <span className="db-tier t-understand">Understand</span> | What to expose vs what to crash/log |
| 06 | **[404 and process errors](06-not-found-and-process.md)** | <span className="db-tier t-know">Know</span> | 404 middleware; process events stay in Node |

## Phase gate

Thrown async errors, `next(err)`, and malformed JSON all produce the same public
envelope without stack traces when `NODE_ENV=production`.

---

← Syllabus: [Part 2](../../syllabus/02-http-surface.md) · Start → [Four-arg error middleware](01-error-middleware.md)
