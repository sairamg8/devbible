---
title: "HTTP status mapping"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

**Map create/read/update/delete to the status codes clients and caches
understand.**

> Verified: 2026-08-14 — **no sandbox run, and no console block in either
> chunk.** The semantics are [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html)
> §9.2 and §15, plus [RFC 6585](https://www.rfc-editor.org/rfc/rfc6585.html) §3 for
> 428 — not Express behaviour. Express supplies `res.status()` and nothing more,
> and **Express 5 restricts it to 100–999**, read from `express@5.2.1`'s
> `lib/response.js` in `sandbox/express-verify/node_modules/`. 🔴 **Express does
> not evaluate `If-Match`** — `req.fresh` returns early for any method that is not
> GET or HEAD, read from `lib/request.js`; this corpus previously shipped a page
> claiming otherwise and it is corrected on [page 07](../07-etag-and-cache.md).
> Where the RFC leaves a choice, each chunk says the recommendation is this
> bible's.

| # | Chunk | In one line |
|---|---|---|
| 01 | **[CRUD to status](01-crud-to-status.md)** | The table with bodies and headers, 200-vs-204 decided on concurrency rather than round trips, why the second DELETE must succeed, and idempotency as a promise infrastructure will hold you to |
| 02 | **[Conflicts and preconditions](02-conflicts-and-preconditions.md)** | 409, 412 and 428 — the three statuses about *state* — why the version check must be inside the `UPDATE`, and why Express's weak `ETag` cannot serve `If-Match` |

**Split on a concept boundary at the 300-line mark.** 01 is the happy path, 02 is
what happens when two clients want the same thing.

## Phase gate

You can say what a create returns and why, argue 200 versus 204 on a ground other
than taste, explain why a retried DELETE is 204, and name what Express does *not*
do about `If-Match`.

## Where this connects

- **← [Phase 1 · 01 · chunk 03](../../phase-1-routing/01-http-methods/03-405-and-method-semantics.md)**
  — the method semantics these statuses rest on.
- **← [Phase 4 · 02 · Status and headers](../../phase-4-responses/02-status-and-headers/README.md)**
  — `res.status`'s Express 5 throws, and the header timing.
- **← [01 · REST resources](../01-rest-resources/README.md)** — the route table
  these statuses fill in.
- **→ [03 · Pagination](../03-pagination.md)** — the 200 that must not be a bare
  array.
- **→ [06 · Idempotency keys](../06-idempotency-keys.md)** — what POST needs
  because it is the non-idempotent verb.
- **→ [07 · ETag and cache](../07-etag-and-cache.md)** — the validators, and the
  corrected `If-Match` claim.
- **→ [10 · PATCH and bulk](../10-patch-and-bulk.md)** — the patch formats, and
  the status that does not exist for partial success.
- **→ [Phase 5 · 03 · Error contract](../../phase-5-errors/03-error-contract/README.md)**
  — the `code` that carries the precision the status cannot.
- **→ [Phase 5 · 04 · Mapping to HTTP](../../phase-5-errors/04-mapping-to-http.md)**
  — the table that turns a driver error into one of these.

---

← Prev topic: [REST resources](../01-rest-resources/README.md) · Start → [CRUD to status](01-crud-to-status.md)
