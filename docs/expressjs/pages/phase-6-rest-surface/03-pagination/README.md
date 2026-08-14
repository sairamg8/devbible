---
title: "Pagination"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

**Always cap `limit`. Prefer cursor pagination for large or volatile lists;
offset is simpler and drifts.**

> Verified: 2026-08-14 — **no sandbox run, and no console block in either
> chunk.** Pagination is **not an Express feature**: there is no helper and no
> convention in the framework. What the docs supply is the warning the whole topic
> rests on — *"as `req.query`'s shape is based on user-controlled input, all
> properties and values should be validated before trusting"*
> ([request reference](https://expressjs.com/en/5x/api/request.html)). The `Link`
> header is [RFC 8288](https://www.rfc-editor.org/rfc/rfc8288.html), and
> `res.links`'s append behaviour is read from `express@5.2.1`'s `lib/response.js`
> in `sandbox/express-verify/node_modules/`. **The deep-offset and keyset cost
> arguments are database properties**, covered with measured evidence in
> [PostgreSQL's pages](../../../../postgresql/pages/README.md) — nothing here was
> measured. The design recommendations are this bible's.

| # | Chunk | In one line |
|---|---|---|
| 01 | **[Offset and its drift](01-offset-and-its-drift.md)** | Why offset is *incorrect* and not merely slow, where it is still fine, why an exact total costs more than the page, and the four ways a `limit` cap is bypassed |
| 02 | **[Cursors that work](02-cursors-that-work.md)** | A cursor as a position in a total order, why the tie-breaker is not optional, what may and may not go in the token, `hasMore` without a second query, and the three failures that still happen |

**Split on a concept boundary at the 300-line mark.** 01 is the problem, 02 is
the answer and its own edges.

## Phase gate

You can give the correctness argument against offset without mentioning speed,
say what a cursor must encode and why, and name what
`Math.min(Number(req.query.limit) || 20, 100)` still lets through.

## Where this connects

- **← [01 · REST resources · chunk 03](../01-rest-resources/03-designing-a-surface.md)**
  — why a list endpoint must never return a bare array.
- **← [Phase 1 · 02 · chunk 03](../../phase-1-routing/02-params-and-query/03-shape-and-trust.md)**
  — `req.query` values are `string | string[]`, which is why `limit` needs a
  schema and not a `Number()`.
- **← [Phase 3 · 03 · chunk 03](../../phase-3-requests/03-size-limits/03-what-it-does-not-protect.md)**
  — a byte limit says nothing about `?limit=1000000`.
- **→ [04 · Filter, sort, search](../04-filter-sort-search.md)** — the allow-list
  for sort columns, which cursor encoding depends on.
- **→ [07 · ETag and cache](../07-etag-and-cache.md)** — caching a paginated
  response.
- **→ [11 · Hypermedia](../11-hypermedia.md)** — the next-page URL as the one piece
  of hypermedia that always pays.
- **→ [Phase 4 · 02 · chunk 02](../../phase-4-responses/02-status-and-headers/02-headers-and-timing.md)**
  — `res.links` appends where `res.set` replaces.
- **→ [Phase 8 · 03 · Coercion traps](../../phase-8-validation-authz/03-coercion-traps.md)**
  — `z.coerce.number()` accepting `''` as `0`, and friends.
- **→ [PostgreSQL · keyset pagination](../../../../postgresql/pages/README.md)** —
  where the cost claims were actually measured.

---

← Prev topic: [Status mapping](../02-status-mapping/README.md) · Start → [Offset and its drift](01-offset-and-its-drift.md)
