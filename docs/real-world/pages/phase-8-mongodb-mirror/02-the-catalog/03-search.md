---
title: "Search: $text where the tsvector was, with the same honest gaps and one new hard limit"
sidebar_label: "4 · Search"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **MongoDB Manual (8.0)** —
> [Text Indexes](https://www.mongodb.com/docs/manual/core/indexes/index-types/index-text/)
> (*"A collection can have at most one text index"*; *"A text index can contain
> up to 32 fields"*),
> [`$text`](https://www.mongodb.com/docs/manual/reference/operator/query/text/)
> (*"A query can specify only one `$text` expression"*; *"You cannot use `hint()`
> to specify an index when using `$text`"*),
> [Assign Weights](https://www.mongodb.com/docs/manual/core/indexes/index-types/index-text/control-text-search-results/)
> (*"The weight of an indexed field indicates the significance of the field
> relative to the other indexed fields, with higher weights resulting in higher
> scores"*; default weight **1**),
> [`$meta`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/meta/).
> Spine: **MongoDB 8.0** (8.2 minor) · driver **`mongodb` 7.5.0** · **Node 24 LTS**.

**[Phase 1's search chapter](../../phase-1-database/05-full-text-search.md) chose
Postgres FTS over an external engine on one argument: the sync problem is harder
than the engine, and a generated `tsvector` column makes staleness structurally
impossible. The identical argument selects MongoDB's built-in text index — it is
maintained by the server on write, so it cannot drift — and the identical gaps
apply: no typo tolerance, no "did you mean", stemming only in the configured
language. What is genuinely new is a hard limit Postgres does not have: **one
text index per collection**, which decides more about this chapter than
relevance tuning does. And the Manual itself now recommends something else.**

## What the Manual says before anything else

The text-index page opens with a recommendation, and honesty requires leading
with it:

> *"MongoDB offers an improved full-text search solution, MongoDB Search, and
> vector search solution, MongoDB Vector Search. We recommend using MongoDB
> Search indexes or MongoDB Vector Search indexes instead of text indexes."*
> — [Text Indexes](https://www.mongodb.com/docs/manual/core/indexes/index-types/index-text/)

That recommendation points at **Atlas Search**, which runs a Lucene index
alongside the cluster and is not available on a self-managed `mongod`. So the
decision this app faces is the same shape as Phase 1's and has one more option
in it:

| Option | Consistency | Quality | Cost |
|---|---|---|---|
| `$text` + text index | Server-maintained, cannot drift | Stemming, weights, phrases; **no typo tolerance** | Free; one index per collection |
| **Atlas Search** (`$search`) | Managed sync, eventually consistent | Analyzers, fuzzy matching, faceting, highlighting | Atlas only; a second index to reason about |
| External engine | Your sync problem | Whatever you build | A second system to run and secure |

This chapter implements the first, for exactly the reason Phase 1 gave:
**start where consistency is free, and move when search quality is a product
requirement someone can name.** The interface built here survives the swap
because `searchProducts` is one function.

## The index

```js
// migrations/mongo/003-text-index.js
await db.collection('products').createIndex(
  {name: 'text', description: 'text'},
  {
    name: 'products_text',
    weights: {name: 10, description: 1},
    default_language: 'english',
  },
);
```

This is the direct counterpart of Phase 1's weighted `tsvector`:

```sql
setweight(to_tsvector('english', name), 'A') ||
setweight(to_tsvector('english', description), 'B')
```

and it has the same property — **weights are an index-time decision**. The
Manual: *"The weight of an indexed field indicates the significance of the field
relative to the other indexed fields, with higher weights resulting in higher
scores"*, with a default of 1. Changing the weighting is therefore a rebuild of
the index, exactly as changing `setweight` was a rebuild of the generated column.
The two systems make the same trade for the same reason.

## The query

```js
// db/mongo/search.js
export async function searchProducts(db, {query, limit = 24, page = 0}) {
  if (page >= 10) return {items: [], hasMore: false};   // the honest cap

  const docs = await db.collection('products')
    .find(
      {$text: {$search: query}, deletedAt: null},
      {projection: {...CARD_PROJECTION, score: {$meta: 'textScore'}}},
    )
    .sort({score: {$meta: 'textScore'}})
    .skip(page * limit)
    .limit(limit + 1)
    .toArray();

  const hasMore = docs.length > limit;
  return {items: hasMore ? docs.slice(0, limit) : docs, hasMore};
}
```

**`$meta: 'textScore'` appears twice, in the projection and in the sort.** That
is the form the Manual documents, and the two occurrences are not redundant in
the documented shape: the projection materialises the score under a name and the
sort orders by it. (Recent MongoDB versions accept the `$meta` sort without the
projection; this page keeps the documented two-part form because the app wants
the score in the response anyway, for the "relevance" debug view.)

**`deletedAt: null` sits alongside `$text` in the same filter**, so soft-deleted
products cannot surface through search — the standing filter rule from
[chunk 1](01-the-filter-document.md), applied to the one query most likely to
forget it.

**Bounded `skip`, and the same cap Phase 1 chose.** A text score is *computed per
query*, so it is not a stable keyset value — "after score 0.62" does not mean the
same thing after a write, and the scores are not even comparable between two
different search strings. Deep pagination of search results is a crawler
behaviour, not a shopper one, so the cap keeps the implementation honest rather
than pretending a score keyset is stable. Within ten pages the `skip` cost is
bounded and the instability window is a browse, not a crawl.

## What `$search` accepts, and why it does not throw

Phase 1 chose `websearch_to_tsquery` specifically because it *never throws on
malformed input*, unlike `to_tsquery`. `$text.$search` has the same property for
the same reason — it is a parser designed for search boxes — and it accepts
roughly the same vocabulary:

| User types | `$text` behaviour |
|---|---|
| `walnut desk` | *"Performs logical `OR` on terms unless you specify an exact phrase"* |
| `"standing desk"` | Exact phrase (the quotes must survive JSON escaping) |
| `desk -wireless` | *"Prefix a term with hyphen-minus (`-`) to exclude documents"* |
| `keybord` | Nothing. Stemming is not spelling correction |
| `desks` | Matches `desk` — *"`$text` matches the complete stemmed word"* |
| `blue` | Does **not** match `blueberry`; `blueberries` does match `blueberry` |

That last row is the stemming rule stated precisely, and it is the one users
notice: there is **no prefix matching**. A shopper typing `walnu` gets nothing,
which is a real product gap that neither Postgres FTS nor `$text` closes.

## The new hard limit

> *"A collection can have at most one text index."*

Postgres allows as many `tsvector` columns and GIN indexes as you want — a
product could have a customer-facing search index and a separate admin index over
internal notes, with different configurations. MongoDB permits one per
collection, covering up to 32 fields with per-field weights.

For this app it is not binding: one index over `name` and `description` is what
the search box needs. It becomes binding the moment two *different* searches are
wanted over the same collection — the storefront's, and an admin search over
`attributes` or internal fields with different weights — because the second
`createIndex` fails. The available answers, in order of ugliness: fold the extra
fields into the one index and accept shared weights; move the admin's data into a
separate collection; or move search to Atlas Search, which does not have this
limit. Knowing the constraint before designing the second search feature is worth
more than any of the workarounds.

## Gotchas

**★ `$text` requires the index to exist, and the failure is a query error, not a
slow scan.** This is a genuine difference from every other index in the app: a
missing compound index makes the catalog slow, a missing text index makes search
*fail*. That is arguably better — it cannot ship silently — but it means the
index creation is a hard deploy dependency, and a fresh environment without the
migration has a broken search endpoint rather than a sluggish one.

**★ You cannot `hint()` a text query.** The Manual: *"You cannot use `hint()` to
specify an index when using `$text`."* Combined with one-index-per-collection
this is consistent — there is nothing to choose between — but it removes the
usual escape hatch when the planner does something unexpected in a compound
`$text` + filter query.

**★ Sorting by anything other than the score throws away the ranking, and it
still costs the text scan.** `$text` + `.sort({priceCents: 1})` is legal and
sometimes wanted ("cheapest matching product"), but it cannot use both the text
index for matching and a B-tree for ordering, so the matched set is sorted in
memory against the documented 100 MB limit. On a broad query — one common word —
the matched set can be most of the catalog.

**★ A quoted phrase has to survive JSON.** `$search: '"standing desk"'` needs
literal double quotes *inside* the string. Building the search string by
concatenation, or letting a client library re-escape it, silently degrades the
phrase into two OR'd terms and the results get much worse without anything
failing. Pass the user's raw input straight through; it is already the syntax.

**★ Stop words and short tokens vanish, exactly as in Postgres.** A two-letter
search returns nothing, and a search for `the desk` matches on `desk` alone. This
is correct for prose and wrong for SKUs and model numbers — if those matter, the
answer is an exact-match branch on the input shape (a regex-anchored lookup on a
`sku` field with its own index), not a fight with the text configuration.

**★ The score is not comparable across queries, and should not be shown.**
`textScore` is computed from term frequency and field weights for *this* search
string; a 1.5 on one query and a 1.5 on another mean nothing in common. It is
fine as a debug field and wrong as "97% match" in the UI.

**★ Multi-language catalogs need one index and one language.** `default_language`
is per index, and `$language` per query selects the *stemmer*, not a per-document
language — a field-level `language` override exists on documents, which is the
mechanism to use, and it is a real design exercise rather than a config flip.
Phase 1 had the identical constraint with `to_tsvector('english', …)`.

**★ Adding the text index to a large collection is a long build.** It generates
one index entry per unique stemmed word per indexed field per document, so it is
one of the biggest indexes the collection will have and one of the slowest to
build. The migration that creates it is not the migration that also does
something time-sensitive.

## Interview questions

**★ Why the built-in text index rather than Atlas Search, when the Manual itself
recommends Atlas Search?** For the same reason Phase 1 chose Postgres FTS over
Elasticsearch: the hard part of external search is not the engine, it is the
sync — every write has to reach two systems that fail independently. A text index
is maintained by the server in the same write, so staleness is structurally
impossible. Atlas Search is genuinely better at search (fuzzy matching, analyzers,
faceting, highlighting) and is the right answer the day search quality is a
product requirement someone can name — and it also constrains deployment to
Atlas, which is a decision about hosting, not about search. Start where
consistency is free, and keep the interface one function wide so the move is
cheap.

**★ Why can't search use the keyset pagination from
[chunk 2](02-keyset-pagination.md)?** Because a keyset needs a stored, stable
sort key, and a text score is computed per query. "After score 0.62" is not a
boundary that means the same thing after a write, and scores are not comparable
between two different search strings at all. So search keeps bounded `skip` and
caps depth at ten pages — the same conclusion Phase 1 reached about `ts_rank`,
for the same reason. The honest framing is that the cap is not a limitation of
the database; it is an admission that ranked results have no stable order to
resume from.

**★ What is the one-text-index-per-collection limit going to cost you, and when?**
Nothing today — one index over `name` and `description` serves the only search
the app has. It binds the moment a second, differently-weighted search is wanted
over the same collection: an admin search over internal notes and attributes, say,
which would want different weights and probably different fields. The second
`createIndex` fails outright. The workarounds are to fold everything into one
index with shared weights, split the data into another collection, or move to
Atlas Search — and the value of knowing the limit now is that it changes how you
model the *second* search feature rather than forcing a rescue afterwards.

**★ How do `$text`'s query semantics compare to `websearch_to_tsquery`?** Closely
enough that the client code does not change. Both are parsers designed for search
boxes: bare terms are OR'd, quoted strings are exact phrases, a leading hyphen
excludes, and neither throws on malformed input — which was Phase 1's whole reason
for choosing `websearch_to_tsquery` over `to_tsquery`. The differences are in the
ranking model, not the syntax: Postgres exposes `ts_rank` with configurable
normalisation, while `$text` exposes a `textScore` computed from term frequency
and index-time field weights that you cannot tune per query.

**★ Search returns nothing for `walnu` and the product manager calls it a bug. Is
it?** It is a gap, not a bug. Text indexes store complete stemmed words, so
`$text` has no prefix matching and no typo tolerance — a search for `blue` does
not match `blueberry`. The three honest responses are: accept it and add a
type-ahead over a small curated list of product names in the client; add a
prefix-anchored regex branch for short inputs, which can use an ordinary index on
`name` and is a different query rather than a search-config tweak; or move to
Atlas Search, where fuzzy matching is a query option. What you cannot do is
configure your way to it, and saying so early is more useful than trying.

{/* FOOTER */}
