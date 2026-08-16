---
title: "Catalog endpoints"
sidebar_label: "05 · Catalog endpoints"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Express 5 docs and RFC 9110 (status codes,
> caching headers). Concept home:
> [Express — REST surface](../../../expressjs/pages/phase-6-rest-surface/README.md);
> the queries are [chapter 1·04's](../phase-1-database/04-the-catalog-query.md)
> and [1·05's](../phase-1-database/05-full-text-search.md).

## The problem

The public read surface — the endpoints every visitor hits before ever
authenticating, and the ones whose *contract* the React client (Phase 4)
and the typed client (Phase 6) build against. The database work is done;
this chapter is the HTTP: URL design, the cursor's wire format, cache
headers, and the discipline of a response shape that never surprises.

## The surface

| Route | Returns | Backed by |
|---|---|---|
| `GET /products` | paginated catalog page | 1·04's keyset query |
| `GET /products/:slug` | one product + images + approved reviews | cached read (2·08) |
| `GET /products/search?q=` | ranked matches, page-capped | 1·05's FTS query |
| `GET /categories` | the category tree | cached read, 5-min TTL |

Slugs, not ids, in public URLs: `/products/walnut-standing-desk` is
link-shareable, SEO-legible, and — because
[the schema made slugs unique](../phase-1-database/01-the-schema/01-conventions-identity-catalog.md) —
exactly as identifying. Ids stay internal.

## The implementation

```js
// src/routes/catalog.js
import express from 'express';
import {validate} from '../middleware/validate.js';
import {ApiError} from '../middleware/errors.js';
import {ListProductsQuery, ProductParams, SearchQuery} from './catalog.schemas.js';

export function buildCatalogRoutes({catalog}) {
  const router = express.Router();

  router.get('/', validate({query: ListProductsQuery}), async (req, res) => {
    const q = req.valid.query;
    const page = await catalog.list({
      categorySlug: q.category, minCents: q.min_cents, maxCents: q.max_cents,
      sort: q.sort, cursor: decodeCursor(q.cursor), limit: q.limit,
    });
    res.set('cache-control', 'public, max-age=30');
    res.json({
      items: page.items.map(productSummary),
      next_cursor: encodeCursor(page.nextCursor),   // null when exhausted
    });
  });

  router.get('/search', validate({query: SearchQuery}), async (req, res) => {
    const {q, page = 0} = req.valid.query;
    const result = await catalog.search({query: q, page});
    res.json({items: result.items.map(productSummary), has_more: result.hasMore});
  });

  router.get('/:slug', validate({params: ProductParams}), async (req, res, next) => {
    const product = await catalog.product(req.valid.params.slug);
    if (!product) return next(new ApiError(404, 'NOT_FOUND', 'product not found'));
    res.set('cache-control', 'public, max-age=60');
    res.json(productDetail(product));
  });

  return router;
}

// the wire shapes — the ONLY place a row becomes a response
function productSummary(p) {
  return {
    slug: p.slug, name: p.name, price_cents: p.price_cents,
    in_stock: p.stock > 0,                          // boolean, not the number
    cover_url: p.cover ? `/uploads/images/${p.cover}` : null,
  };
}

function productDetail(p) {
  return {
    ...productSummary(p),
    description: p.description, attributes: p.attributes,
    images: p.images.map((i) => `/uploads/images/${i.object_key}`),
    reviews: p.reviews,                             // approved only — by query
  };
}

// the cursor's wire format: opaque base64 over the {value, id} pair
export const encodeCursor = (c) =>
  c ? Buffer.from(JSON.stringify(c)).toString('base64url') : null;
export const decodeCursor = (s) => {
  if (!s) return undefined;
  try {
    const {value, id} = JSON.parse(Buffer.from(s, 'base64url').toString());
    if (typeof id !== 'number') throw new Error();
    return {value, id};
  } catch {
    throw new ApiError(400, 'BAD_CURSOR', 'invalid cursor');
  }
};
```

## The contract rules

- **`in_stock` is a boolean, not the stock count.** The exact count is
  commercially sensitive (competitors) and operationally noisy (it changes
  under the reader). The client needs one bit; ship one bit. Adding
  `stock_low: stock < 5` later is additive; *removing* an over-shared
  field is a breaking change — the general law of response design.
- **The cursor is opaque on the wire.** Clients that can read
  `{price_cents: 1999, id: 4291}` will build on it; base64url plus a
  decode-or-400 keeps the pagination internals swappable and makes cursor
  tampering a clean client error instead of a weird empty page.
- **Mapper functions are the seam.** `productSummary` is the *only* route
  from a database row to public JSON — a new column leaks nowhere unless a
  mapper ships it. (Phase 6 types these mappers; the contract becomes
  compile-checked.)
- **`cache-control` is short and honest.** 30–60 s public caching lets
  Nginx and browsers absorb the read storm — consistent with the
  [server cache's staleness budget](../phase-2-node-services/08-the-cache-layer.md),
  so worst-case product-page staleness is bounded by both layers agreeing
  on "about a minute". Search is uncached: query strings explode the key
  space for negligible hit rate.

## Gotchas

- **Symptom:** page two of "price: low to high" 400s with `BAD_CURSOR`
  after a client deploy. **Cause:** the client cached a cursor across the
  sort change — the cursor's `value` was a timestamp, the query now
  expects cents. **Fix:** by contract ([1·04's rule](../phase-1-database/04-the-catalog-query.md)),
  cursors are valid only for the exact filter+sort that minted them; the
  Phase 4 hook resets the cursor on any parameter change, and the 400 (not
  an empty 200) is what made the client bug visible.
- **Symptom:** product pages show stale prices for a minute after an admin
  edit, and support files it as a bug. **Cause:** two agreed caches doing
  their job. **Fix:** none in code — the staleness budget is a *product
  decision* recorded here; if the business rejects it, both `max-age` and
  the server TTL shrink together (they are one number in config for
  exactly this conversation).
- **Symptom:** `/products/search` latency spikes under a scraping burst
  while `/products` stays flat. **Cause:** search is uncached and
  rank-sorted — the expensive endpoint by design. **Fix:** chapter 10's
  rate limit has a per-IP search tier; the page cap
  ([1·05](../phase-1-database/05-full-text-search.md)) already bounds each
  request's cost.

## Interview questions

1. **★ Why slugs in URLs but ids in cursors?** URLs are the public,
   durable, human-facing identifier — slugs serve links and SEO and are
   unique by constraint. Cursors are internal resumption state where the
   id's total order is what matters. Each surface uses the identifier
   built for it; conflating them either leaks ids into URLs or forces
   slug-ordering into the keyset.
2. **★ Why must the cursor be opaque when base64 "isn't security"?** It
   isn't secrecy — it is *contract hygiene*. Readable structure gets
   depended on (Hyrum's law): clients build cursors by hand, and the
   pagination implementation is frozen forever. Opacity plus a strict
   decoder keeps the internals owned by the server, and the base64 is just
   the envelope.
3. **Where is the one place a schema change can leak into the public API,
   and why is that good?** The mapper functions. Concentrating the
   row→JSON transform means the public contract has a single, reviewable
   definition — "what do we expose?" is answered by reading two small
   functions, not by auditing every `res.json` in the codebase.
4. **Why is search the only uncached read?** Cache value = hit rate ×
   regeneration cost ÷ key-space size. Search's key space (every query
   string) is unbounded and its hit rate near zero outside attack traffic —
   caching it stores garbage. The catalog's key space (filters × sorts ×
   pages actually browsed) is small and hot. Cache decisions are per-shape,
   not per-API.

---

← Prev: [Authorization](04-authorization.md) ·
Next → **Cart endpoints** *(not written yet)*
