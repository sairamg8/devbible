---
title: "Full-text product search"
sidebar_label: "05 · Full-text search"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against PostgreSQL 17 documentation — full text search
> (`tsvector`, `tsquery`, `websearch_to_tsquery`, `ts_rank`), GIN indexes.
> Concept home: [PostgreSQL — beyond tables](../../../postgresql/pages/phase-12-beyond-tables/README.md).

## The problem

The search box. Users type `walnut desk`, `keybord` (yes, misspelled), or
`"mechanical keyboard" -wireless`, and expect relevant products fast. The spec
put search inside PostgreSQL — this chapter is what that buys and what it
honestly does not.

## The design choices

**Postgres FTS, not an external engine.** Elasticsearch/Meilisearch buy typo
tolerance, faceting and relevance tuning — at the cost of a second system to
run, secure, and keep in sync (a harder problem than it sounds; the sync job
is a distributed-systems commitment). Postgres FTS is *already consistent* —
the [schema](01-the-schema/01-conventions-identity-catalog.md) generates the
`search` column from the row itself — and covers "find products by words" well.
The honest line: when search quality becomes a product feature (typo
correction, learned ranking), that is the day the external engine earns its
keep, and the interface built here survives the swap.

**`websearch_to_tsquery` for user input.** It accepts what users actually
type — quoted phrases, `-exclusions`, bare words — and **never throws on
malformed input**, unlike `to_tsquery`, which fails on an unbalanced quote.
User-facing search must parse user syntax; `to_tsquery` is for query builders.

**Rank in SQL, cap the depth.** Results order by `ts_rank` — computed, not
stored, so keyset pagination's stable-cursor assumption (chapter 04) does not
hold. The spec's answer: search returns at most 10 pages. Deep pagination of
search results is a crawler pattern, not a shopper one, and the cap keeps the
implementation honest instead of pretending rank-keysets are stable.

## The implementation

```js
// db/search.js
export async function searchProducts(pool, {query, limit = 24, page = 0}) {
  if (page >= 10) return {items: [], hasMore: false}; // the honest cap

  const {rows} = await pool.query(
    `select p.id, p.name, p.slug, p.price_cents, p.stock,
            ts_rank(p.search, q) as rank,
            (select object_key from product_images i
              where i.product_id = p.id order by i.position limit 1) as cover
       from products p,
            websearch_to_tsquery('english', $1) q
      where p.search @@ q
        and p.deleted_at is null
      order by rank desc, p.id
      limit $2 offset $3`,
    [query, limit + 1, page * limit],
  );
  const hasMore = rows.length > limit;
  return {items: hasMore ? rows.slice(0, limit) : rows, hasMore};
}
```

- The lateral-style `websearch_to_tsquery(…) q` computes the query **once**
  and reuses it in both the match and the rank — repeating the call in both
  places is the common copy-paste that doubles parse work.
- `@@` is the match operator; it is what the GIN index (chapter 10)
  accelerates. `ts_rank` itself is *not* indexable — the index finds the
  matching rows, ranking sorts only those.
- Bounded `offset` is acceptable here precisely because it is bounded: at
  most `10 × 24` rows deep, the discard cost is capped and the instability
  window is a page browse, not a crawl.

The weighting refinement, when name matches should beat description matches —
the migration replaces the generated column:

```sql
-- 015_search_weights.sql
alter table products drop column search;
alter table products add column search tsvector
  generated always as (
    setweight(to_tsvector('english', name), 'A') ||
    setweight(to_tsvector('english', description), 'B')
  ) stored;
```

`ts_rank` reads the weights with no query change — `A` matches outrank `B`.

## What Postgres FTS does not do

Say it before users discover it: **no typo tolerance** (`keybord` finds
nothing — `pg_trgm` similarity is the in-Postgres patch for word-level
fuzziness, at real query cost), **English stemming only as configured** (the
`'english'` config stems `desks → desk`; multilingual catalogs need a config
per language), and **no "did you mean"**. Each is either a `pg_trgm`
augmentation, an accepted gap, or the trigger to move engines — a decision
for product data, not this chapter.

## Using it in the app

`GET /search?q=` (Phase 3) validates the query string (non-empty, length-capped
— zod's job, not SQL's) and calls this. The search box (Phase 4) debounces
through [`useDebounce`](../../syllabus/02-frontend.md); the worker keeps
nothing in sync because the generated column made sync impossible to forget.

## Gotchas

- **Symptom:** searching a quoted phrase with an apostrophe 500s with a
  `tsquery` syntax error. **Cause:** somewhere `to_tsquery` crept in —
  it throws on user syntax. **Fix:** `websearch_to_tsquery` end to end; it
  degrades malformed input instead of throwing.
- **Symptom:** search is fast in dev, slow in production at 100k products.
  **Cause:** no GIN index — dev's seed of 200 rows never needed it, so the
  sequential scan hid. **Fix:** chapter 10's
  `create index … using gin (search)`; `EXPLAIN` should show
  `Bitmap Index Scan` on it.
- **Symptom:** products edited seconds ago rank oddly or don't match.
  **Cause:** expectation drift — people assume search has indexing lag
  because external engines do. **Fix:** none needed — the generated column
  updates in the same transaction as the edit; if it *doesn't* match, the
  words genuinely don't stem to the query. `select to_tsvector('english',
  name)` on the row shows what the index actually holds.
- **Symptom:** two-letter searches return nothing. **Cause:** default text
  search configs drop stop words and very short tokens. **Fix:** by design
  for prose — if SKU/model-number search matters, that is a `pg_trgm` or
  exact-match branch on the input shape, not an FTS config fight.

## Interview questions

1. **★ Why start with Postgres search instead of Elasticsearch?** Because the
   hardest part of external search is not the engine, it is the sync — every
   write must reach two systems that fail independently. The generated column
   makes staleness *structurally impossible*, at the price of weaker
   linguistics. Start where consistency is free; move when search quality is
   a product requirement someone can name.
2. **★ Why `websearch_to_tsquery` over `to_tsquery`?** `to_tsquery` parses an
   operator language (`walnut & desk`) and throws on anything malformed —
   which user input reliably is. `websearch_to_tsquery` parses what search
   boxes receive (phrases, minus-exclusion, bare words) and never errors on
   it. User input goes to the parser designed for user input.
3. **Why can't search results use chapter 04's keyset pagination?** The
   keyset invariant needs a *stored, stable* sort key; `ts_rank` is computed
   per query and shifts as data changes, so "after rank 0.62" is not a stable
   boundary. Bounded offset accepts tiny instability over ten pages; a rank
   keyset would pretend a stability it doesn't have.
4. **Where do the `A`/`B` weights act — index time or query time?** Index
   time: `setweight` stamps each lexeme in the stored `tsvector`. `ts_rank`
   reads those stamps at query time. That is why changing the weighting
   scheme is a migration (rebuild the column), not a query tweak.

---

← Prev: [The catalog query](04-the-catalog-query.md) ·
Next → [The checkout transaction](06-the-checkout-transaction/README.md)
