---
title: "Phase 6 — REST surface and API features"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: Express 5.2.1 on Node 24.** Product surface clients depend on — Node
> handed these topics to Express on purpose.

> ✅ **Phase complete — 14 of 14 topics, 2026-08-14.** The first genuinely *outline*
> phase: nine pages averaging 36 lines, four Gotchas and one Trade-off between them, and
> **two topics with no page at all** (PATCH/bulk, hypermedia — now 10 and 11). All
> written. **Documentation-validated, not sandbox-measured** — nothing was run.
>
> 🔴 **[Page 07](07-etag-and-cache.md) carried a false claim and now says so:** it showed
> `If-Match → 412` as if Express did it. **Express does not evaluate `If-Match`** — an
> earlier run in this project measured a stale `If-Match` returning **200** on both PUT
> and GET. RFC 9110 makes precondition evaluation the origin server's job, i.e. yours.
> The block is labelled rather than replaced, and the page now shows the code you have to
> write.
>
> Where the docs stop, the pages say so: REST resource conventions, pagination design and
> bulk-endpoint shapes are **this bible's guidance** (HTTP standardises none of them), and
> **`Idempotency-Key` is still an IETF draft**, not an RFC.

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **[REST resources](01-rest-resources/README.md)** *(3 chunks)* | <span className="db-tier t-master">Master</span> | The four shapes and why nesting stops at one level; the two-question test for action vs sub-resource; and one resource designed end to end |
| 02 | **[Status mapping](02-status-mapping/README.md)** *(2 chunks)* | <span className="db-tier t-master">Master</span> | CRUD → 200/201/204/404/409, idempotency as a promise, and the three statuses about *state* — 409, 412, 428 |
| 03 | **[Pagination](03-pagination.md)** | <span className="db-tier t-master">Master</span> | Offset vs cursor; cap limits |
| 04 | **[Filter sort search](04-filter-sort-search.md)** | <span className="db-tier t-understand">Understand</span> | Allow-lists only |
| 05 | **[Versioning](05-versioning.md)** | <span className="db-tier t-understand">Understand</span> | URL / header / media type |
| 06 | **[Idempotency keys](06-idempotency-keys.md)** | <span className="db-tier t-understand">Understand</span> | Safe retries on POST |
| 07 | **[ETag and Cache-Control](07-etag-and-cache.md)** | <span className="db-tier t-understand">Understand</span> | Conditional requests; private API cache |
| 08 | **[OpenAPI](08-openapi.md)** | <span className="db-tier t-understand">Understand</span> | Contract that matches routes |
| 09 | **[Webhooks](09-webhooks.md)** | <span className="db-tier t-understand">Understand</span> | Verify in; enqueue out |
| 10 | **[PATCH and bulk](10-patch-and-bulk.md)** | <span className="db-tier t-know">Know</span> | Merge Patch vs JSON Patch; why bulk has no honest status code |
| 11 | **[Hypermedia](11-hypermedia.md)** | <span className="db-tier t-when">When Needed</span> | Links as affordances — and when they earn their cost |

## Coverage

All 14 syllabus topics. **Pages 10 and 11 were written on 2026-08-14 — PATCH/bulk
semantics and hypermedia had no pages at all.** This README had no Coverage table,
which is the same way [Phase 4](../phase-4-responses/README.md) lost content
negotiation and [Phase 5](../phase-5-errors/README.md) lost error logging.

| Syllabus topic | Page |
|---|---|
| REST resource modeling | 01 (chunks [01](01-rest-resources/01-nouns-collections-items.md) · [02](01-rest-resources/02-when-rest-stops-fitting.md) · [03](01-rest-resources/03-designing-a-surface.md)) |
| HTTP semantics and status mapping | 02 (chunks [01](02-status-mapping/01-crud-to-status.md) · [02](02-status-mapping/02-conflicts-and-preconditions.md)) |
| Pagination | 03 |
| Filtering and sorting safely | 04 |
| Search endpoints | 04 |
| API versioning strategies | 05 |
| Idempotency keys | 06 |
| ETags and conditional requests | 07 |
| `Cache-Control` on API responses | 07 |
| OpenAPI / Swagger | 08 |
| Receiving webhooks | 09 |
| Delivering webhooks from a route | 09 (cross-link — Node Phase 7 owns the job) |
| Bulk endpoints and partial updates | **10** |
| HATEOAS / hypermedia affordances | **11** |

## Phase gate

Design a small resource API with cursor pagination, a versioned mount, idempotent
POST, and an OpenAPI path that matches handlers.

---

← Syllabus: [Part 3](../../syllabus/03-api-product.md) · Start → [REST resources](01-rest-resources/README.md)
