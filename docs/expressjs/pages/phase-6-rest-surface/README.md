---
title: "Phase 6 — REST surface and API features"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: Express 5.2.1 on Node 24.** Product surface clients depend on — Node
> handed these topics to Express on purpose.

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **[REST resources](01-rest-resources.md)** | <span className="db-tier t-master">Master</span> | Nouns, collections, when RPC is honest |
| 02 | **[Status mapping](02-status-mapping.md)** | <span className="db-tier t-master">Master</span> | CRUD → 200/201/204/404/409 |
| 03 | **[Pagination](03-pagination.md)** | <span className="db-tier t-master">Master</span> | Offset vs cursor; cap limits |
| 04 | **[Filter sort search](04-filter-sort-search.md)** | <span className="db-tier t-understand">Understand</span> | Allow-lists only |
| 05 | **[Versioning](05-versioning.md)** | <span className="db-tier t-understand">Understand</span> | URL / header / media type |
| 06 | **[Idempotency keys](06-idempotency-keys.md)** | <span className="db-tier t-understand">Understand</span> | Safe retries on POST |
| 07 | **[ETag and Cache-Control](07-etag-and-cache.md)** | <span className="db-tier t-understand">Understand</span> | Conditional requests; private API cache |
| 08 | **[OpenAPI](08-openapi.md)** | <span className="db-tier t-understand">Understand</span> | Contract that matches routes |
| 09 | **[Webhooks](09-webhooks.md)** | <span className="db-tier t-understand">Understand</span> | Verify in; enqueue out |

## Phase gate

Design a small resource API with cursor pagination, a versioned mount, idempotent
POST, and an OpenAPI path that matches handlers.

---

← Syllabus: [Part 3](../../syllabus/03-api-product.md) · Start → [REST resources](01-rest-resources.md)
