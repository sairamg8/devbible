---
title: "Part 3 — API product (proposed)"
sidebar_label: "3 · API product"
sidebar_position: 3
---

:::note Proposal
Part of the Express proposed syllabus under `reviews/proposed-syllabus/`.
Not live content until promoted to `docs/expressjs/syllabus/`.
:::

> Phases 6–7 · REST surface features, then thin controller/service/repository wiring

This is what Node deliberately refused to absorb: **API design on HTTP**. Phase 6
is the product surface clients depend on. Phase 7 is only the Express-side
wiring into services — not a second data-access or architecture course.

**Stays in Node:** repository *mechanism*, transactions, pools, job queues,
retries, outbox (Phases 6–7 of Node).  
**Stays project-based:** circuit breakers, bulkheads, full clean-architecture tours.

---

## Phase 6 — REST surface and HTTP API features

Resource modeling and the features every public API eventually needs. Each
Node handoff bullet that is “API product” lands here.

| Topic | Tier |
|---|---|
| **REST resource modeling** — nouns, collections vs items, relation URLs, and when RPC-style routes are honest | <span className="db-tier t-master">Master</span> |
| **HTTP semantics and status mapping** — create/read/update/delete → 200/201/204/404/409; idempotent methods | <span className="db-tier t-master">Master</span> |
| **Pagination** at the API layer — offset vs cursor, `limit` caps, total counts trade-off, Link headers optional | <span className="db-tier t-master">Master</span> |
| **Filtering and sorting safely** — allow-lists for fields/operators; never pass raw query objects to the database layer | <span className="db-tier t-understand">Understand</span> |
| Search endpoints — full-text vs filter, debounce expectations, and not blocking the event loop on huge scans | <span className="db-tier t-understand">Understand</span> |
| **API versioning strategies** — URL prefix vs header vs media type; compatibility and deprecation | <span className="db-tier t-understand">Understand</span> |
| **Idempotency keys** for unsafe requests — `Idempotency-Key` header, store outcome, replay safe responses | <span className="db-tier t-understand">Understand</span> |
| **ETags and conditional requests** — `ETag`, `If-None-Match`, `If-Match` for caches and lost-update control | <span className="db-tier t-understand">Understand</span> |
| **`Cache-Control` on API responses** — private/no-store for authenticated JSON; what CDNs may cache | <span className="db-tier t-understand">Understand</span> |
| **OpenAPI / Swagger** — generating or writing a contract, keeping it honest with the routes | <span className="db-tier t-understand">Understand</span> |
| **Receiving webhooks** — raw body, signature verification (HMAC), timestamp skew, replay protection | <span className="db-tier t-understand">Understand</span> |
| Delivering webhooks from a route — enqueue work, return 202; **cross-link Node Phase 7** for the job itself | <span className="db-tier t-know">Know</span> |
| HATEOAS / hypermedia affordances — when links in responses earn their complexity | <span className="db-tier t-when">When Needed</span> |
| Bulk endpoints and partial updates (`PATCH` semantics, JSON Patch) | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** you can design a small resource API with cursor
pagination, a versioned mount path, an idempotent POST, and a documented OpenAPI
path that matches the handlers.

---

## Phase 7 — Layering at the Express edge

Folders and function boundaries so routes stay thin. **Not** a rewrite of Node’s
repository or transaction pages — those stay whole in Node. Express covers
where the HTTP layer stops and the service starts.

| Topic | Tier |
|---|---|
| **Controller → service → repository wiring** — controllers parse HTTP and call services; services own rules; repositories own queries (types do not leak upward) | <span className="db-tier t-master">Master</span> |
| Domain vs transport — keep Express types (`Request`, `Response`) out of domain functions | <span className="db-tier t-understand">Understand</span> |
| Avoiding fat controllers — validation and auth as middleware; one use-case per handler | <span className="db-tier t-understand">Understand</span> |
| Dependency injection without a framework — pass `deps` into routers/factories (pairs with Phase 10 `createApp`) | <span className="db-tier t-understand">Understand</span> |
| Triggering **background work from a route** — validate, persist, enqueue, respond; never await the slow side-effect | <span className="db-tier t-understand">Understand</span> |
| Folder structure that scales — feature folders vs layer folders; pick one and stay consistent | <span className="db-tier t-know">Know</span> |
| Transaction *middleware* that begins/commits per request — thin wrapper; **mechanism lives in Node Phase 6** | <span className="db-tier t-know">Know</span> |
| DTO mapping at the edge — API shapes vs persistence shapes | <span className="db-tier t-know">Know</span> |

**Gate — deliverable:** a resource module whose handlers are under ~20 lines,
services are unit-testable without `req`/`res`, and one slow side-effect is
enqueued rather than awaited on the request path.

---

## Counts (this part)

| Tier | Count |
|---|---|
| Master | 4 |
| Understand | 12 |
| Know | 5 |
| When Needed | 1 |
| **Total** | **22** |

---

← Prev: [Part 2 — HTTP surface](02-http-surface.md) · Next → [Part 4 — Edge & ops](04-edge-and-ops.md)
