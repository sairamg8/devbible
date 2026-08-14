---
title: "Status and headers"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

**Status is part of the contract. Headers are fixed once the body starts. Useful
APIs pick 201/204/400/401/403/404/409 deliberately — not always 200.**

> Verified: 2026-08-14 on **Express 5.2.1**. `res.status`'s two guards and the
> header helpers (`set`, `append`, `vary`, `links`, `attachment`, `type`, `get`)
> are read from `express@5.2.1`'s `lib/response.js` in
> `sandbox/express-verify/node_modules/`, quoted per chunk by function.
> Cross-checked against the
> [response reference](https://expressjs.com/en/5x/api/response.html), the
> [Express 5 migration guide](https://expressjs.com/en/guide/migrating-5.html) for
> the status-range restriction, and
> [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html) §15 for status
> semantics. **Reading source is not a run: nothing was executed for this topic
> and neither chunk carries a console block.** Where the RFC leaves a choice open
> — 400 vs 422, when to use 404 for a resource that exists — the page says that
> the recommendation is this bible's.

**At 63 lines this was the thinnest page in the entire Express corpus**, and its
subject is the part of a response every cache, proxy, SDK generator and retry
policy actually reads.

| # | Chunk | In one line |
|---|---|---|
| 01 | **[Status as contract](01-status-as-contract.md)** | The two new Express 5 throws, the codes worth being deliberate about, the three that generate arguments, and why "200 with `{success:false}`" costs real things |
| 02 | **[Headers and timing](02-headers-and-timing.md)** | Why a late `res.set` fails **silently** while a late `res.send` throws; every header helper precisely; and the headers error responses usually lose |

**Split on a concept boundary at the 300-line mark.** 01 is what to say, 02 is
when you can still say it.

## Phase gate

You can explain why `res.status` now throws, when 404 is the right answer for a
resource that exists, and what happens if you set a header after the first write.

## Where this connects

- **← [01 · res methods](../01-res-methods/README.md)** — the terminal methods,
  and the `res.send` behaviour that fires after the status is chosen.
- **→ [03 · Response shapes](../03-response-shapes.md)** — the body that goes with
  the status.
- **→ [04 · Headers already sent](../04-headers-already-sent.md)** — the failure
  chunk 02's timeline ends on.
- **→ [09 · Content negotiation](../09-content-negotiation.md)** — `res.format`,
  and the `Vary` that goes with it.
- **→ [Phase 1 · 01 · chunk 03](../../phase-1-routing/01-http-methods/03-405-and-method-semantics.md)**
  — 405 and the `Allow` header Express never sends.
- **→ [Phase 5 · 04 · Mapping to HTTP](../../phase-5-errors/04-mapping-to-http.md)**
  — the error-to-status table, and `err.headers`.
- **→ [Phase 6 · 02 · Status mapping](../../phase-6-rest-surface/02-status-mapping.md)**
  — CRUD operations to status codes.
- **→ [Phase 6 · 07 · ETag and cache](../../phase-6-rest-surface/07-etag-and-cache.md)**
  — `Cache-Control` and the conditional-request headers.
- **→ [Phase 8 · 07 · Ownership](../../phase-8-validation-authz/07-ownership.md)** —
  why cross-tenant access answers 404.

---

← Prev topic: [res methods](../01-res-methods/README.md) · Start → [Status as contract](01-status-as-contract.md)
