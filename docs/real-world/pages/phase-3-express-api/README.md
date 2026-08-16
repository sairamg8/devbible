---
title: "Phase 3 — The Express API"
sidebar_label: "Overview"
sidebar_position: 0
---

> The storefront's HTTP surface: every endpoint the spec implies, assembled
> from Phase 1's queries and Phase 2's services. Concepts live in the
> [Express section](../../../expressjs/README.md) — especially
> [validation and authorization](../../../expressjs/pages/phase-8-validation-authz/README.md)
> and [the app factory](../../../expressjs/pages/phase-10-app-factory/README.md);
> these chapters are the endpoints themselves.

**Prerequisites:** Express phases 0–8; Phase 1 and Phase 2 of this track.

| # | Chapter | Tier | In one line |
|---|---|---|---|
| 01 | **[Project structure](01-project-structure.md)** | <span className="db-tier t-master">Master</span> | The factory, the layer rules, and a mount order five chapters depend on |
| 02 | **[The validation boundary](02-the-validation-boundary.md)** | <span className="db-tier t-master">Master</span> | Parse, don’t validate: strict schemas, coercion only for query strings, bounds on everything |
| 03 | **[Auth](03-auth/README.md)** | <span className="db-tier t-master">Master</span> | Sessions as the default (hashed opaque tokens, `__Host-` cookies) and the JWT variant compared on this app’s facts |
| 04 | **[Authorization](04-authorization.md)** | <span className="db-tier t-master">Master</span> | Role gates as middleware, ownership as a WHERE clause, domain predicates in the insert — and 404 vs 403 policy |
| 05 | **[Catalog endpoints](05-catalog-endpoints.md)** | <span className="db-tier t-master">Master</span> | Slugs in URLs, opaque cursors, mapper functions as the contract seam, honest cache headers |
| 06 | **[Cart endpoints](06-cart-endpoints.md)** | <span className="db-tier t-understand">Understand</span> | One idempotent PUT, live prices, and the transactional merge-on-login that never loses items |
| 07 | **[The checkout endpoint](07-the-checkout-endpoint.md)** | <span className="db-tier t-master">Master</span> | Authorize → commit → capture-by-outbox, one idempotency key across both systems, the failure map |
| 08 | **[The uploads endpoint](08-the-uploads-endpoint.md)** | <span className="db-tier t-understand">Understand</span> | busboy straight into the service, batch failure undoes, rows after storage, immutable serving |
| 09 | **[The error contract](09-the-error-contract.md)** | <span className="db-tier t-master">Master</span> | One wire shape (RFC 9457), one classify funnel, unknowns say nothing, constraint names as contract |
| 10 | **[Rate limiting](10-rate-limiting.md)** | <span className="db-tier t-understand">Understand</span> | Token buckets per surface, login’s dual IP+email keys, 429 through the error contract |
| 11 | **[Inbound webhooks](11-inbound-webhooks.md)** | <span className="db-tier t-understand">Understand</span> | Raw-body HMAC first, timestamp window, receiver-side dedup, ack-then-process via the outbox |
| 12 | **OpenAPI from the schemas** | <span className="db-tier t-know">Know</span> | *(not written yet)* |

## Phase gate

The gate from the syllabus: the full browse → cart → checkout flow exercised
end to end against the running API, including a replayed checkout that does
not double-charge.

## Where this connects

Phase 4's React screens consume these endpoints; Phase 6 types them end to
end; the Nginx section will front them when its serving phases are written.
