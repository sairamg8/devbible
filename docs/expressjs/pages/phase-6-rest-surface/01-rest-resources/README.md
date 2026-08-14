---
title: "REST resource modeling"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

**Resources are nouns. Collections are lists of them. Prefer `/orders/12/items`
over `/getOrderItems`.**

> Verified: 2026-08-14 — **deliberately not an Express question, and no sandbox
> run backs any chunk in this topic.** Express has no resource model: it matches
> paths to handlers and stops there, which is exactly why the discipline has to
> come from you. The Express mechanics referenced throughout — mounting, `req.params`,
> `mergeParams`, `res.location`, `res.links` — are read from `router@2.2.0` and
> `express@5.2.1` in `sandbox/express-verify/node_modules/` and cited in the phases
> that own them. Standards cited: [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html)
> for method and status semantics, [RFC 8288](https://www.rfc-editor.org/rfc/rfc8288.html)
> for `Link`. **Everything else is this bible's guidance**, and each chunk says so
> — treat the conventions as defaults with reasons, not rules with citations.

| # | Chunk | In one line |
|---|---|---|
| 01 | **[Nouns, collections, items](01-nouns-collections-items.md)** | The four shapes, why nesting stops at one level (three costs, one of them a security bug), the small naming decisions, and what an id in a URL leaks |
| 02 | **[When REST stops fitting](02-when-rest-stops-fitting.md)** | Five shapes that are not CRUD, the two-question test for action versus sub-resource, and an honest account of what going RPC costs |
| 03 | **[Designing a surface](03-designing-a-surface.md)** | One resource end to end — routes, statuses, the presenter, canonical URLs — and the route table that reveals what the code hides |

**Split on concept boundaries at the 300-line mark.** 01 is the model, 02 is its
edge, 03 is the whole thing built once.

## Phase gate

You can say how deep to nest and give the three reasons, apply the test that
decides between `POST /orders/7/cancel` and a sub-resource, and explain why a
list endpoint must never return a bare array.

## Where this connects

- **← [Phase 1 · 03 · Router composition](../../phase-1-routing/03-router-composition/README.md)**
  — mounting, `mergeParams`, and the router-per-resource shape.
- **← [Phase 1 · 04 · Route ordering](../../phase-1-routing/04-route-ordering.md)** —
  why `/users/export` is captured by `/users/:id`.
- **← [Phase 4 · 01 · res methods](../../phase-4-responses/01-res-methods/README.md)**
  — `res.location`, and why a presenter beats `res.json(row)`.
- **→ [02 · Status mapping](../02-status-mapping.md)** — the status for each
  operation, in full.
- **→ [03 · Pagination](../03-pagination.md)** — what goes in the envelope chunk 03
  insists on.
- **→ [05 · Versioning](../05-versioning.md)** — why URL shape and field names are
  the expensive decisions.
- **→ [06 · Idempotency keys](../06-idempotency-keys.md)** — the mechanism the
  non-idempotent rows of the route table need.
- **→ [08 · OpenAPI](../08-openapi.md)** — the route table, stated once.
- **→ [10 · PATCH and bulk](../10-patch-and-bulk.md)** — the shapes with no honest
  status code.
- **→ [11 · Hypermedia](../11-hypermedia.md)** — how far to take `Link`.
- **→ [Phase 8 · 07 · Ownership](../../phase-8-validation-authz/07-ownership.md)** —
  the authorization the URL implies and does not perform.

---

← Index: [Phase 6](../README.md) · Start → [Nouns, collections, items](01-nouns-collections-items.md)
