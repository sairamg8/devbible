---
title: "One text index per collection, weights fixed at index time, and a documented inability to help with sorting — which is why search's ten-page cap survived the port"
sidebar_label: "10 · The text index"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-02 against the **MongoDB Manual (8.0)** —
> [Text Indexes](https://www.mongodb.com/docs/manual/core/indexes/index-types/index-text/)
> (*"A collection can have only **one** text index, but that index may include
> multiple fields"*; *"Text indexes can't cover a query"*; *"Text indexes are
> always sparse"*; *"Text indexes can consume significant RAM"*),
> [Text Index Restrictions](https://www.mongodb.com/docs/manual/core/indexes/index-types/index-text/text-index-restrictions/)
> (*"If a query includes a `$text` expression, you cannot use `hint()` to specify
> which index to use for the query"*; *"Text indexes cannot improve performance for
> sort operations. This restriction applies to both single-field and compound text
> indexes"*; *"Text indexes only support binary comparison, and do not support the
> collation option"*; the compound-text-index rules).
> Counterpart:
> [02·04 — search](../02-the-catalog/03-search.md), which chose this design;
> and [1·05 — full-text search](../../phase-1-database/05-full-text-search.md).
> Spine: **MongoDB 8.0** (8.2 minor) · driver **`mongodb` 7.5.0** · **Node 24 LTS**.

**[Chapter 02·04](../02-the-catalog/03-search.md) built search on a text index and
argued the design; this chunk is the *index* half — what the declaration commits
you to, and which of Phase 1's search decisions survive because of it. Two
restrictions carry most of the weight. **A collection may have exactly one text
index**, which makes "weights" an index-time decision that a query cannot
override, exactly as Phase 1's `setweight` was baked into a stored `tsvector`. And
**a text index cannot help a sort**, which is the documented reason the search
endpoint keeps its ten-page cap rather than paginating properly.**

## The index

```js
// migrations/mongo/005-text-index.js
await db.collection('products').createIndex(
  {name: 'text', description: 'text'},
  {name: 'products_text',
   weights: {name: 10, description: 1},
   default_language: 'english'});
```

The direct counterpart of Phase 1's weighted generated column:

```sql
setweight(to_tsvector('english', name), 'A') ||
setweight(to_tsvector('english', description), 'B')
```

and the correspondence is closer than it looks. In both systems the weighting is
**index-time**: Postgres stored the weighted vector in a column, MongoDB stores
the weights in the index specification, and in neither can a query say "this time,
weight the description higher". Changing the weighting is a rebuild in both.

The explicit `name: 'products_text'` is worth the line. MongoDB's generated name
for a text index concatenates every indexed field and the string `_text`, which
gets long and changes if you add a field — and the name is what `dropIndex` and
`hint` take.

## One text index per collection

> *"A collection can have at most one text index."*
> — [Text Index Restrictions](https://www.mongodb.com/docs/manual/core/indexes/index-types/index-text/text-index-restrictions/)

Not one per field — one per **collection**. So a requirement for two different
search behaviours over the same collection ("search names only" and "search names
and descriptions") is not expressible as two indexes.
[Chapter 02·04](../02-the-catalog/03-search.md) already listed the workarounds in
order of ugliness; the index-level statement of the constraint is simply that
**the text index is a collection-wide singleton and its field set and weights are
one global decision.**

Postgres had no such limit: several `tsvector` columns with several GIN indexes is
ordinary. This is the sharpest capability regression in the whole phase's index
story, and it is worth naming rather than routing around quietly.

The Manual's own note points at the escape hatch — Atlas Search *"supports
multiple full-text search indexes on a single collection"* — which is the same
answer chapter 02 reached from the product side, and which is unavailable on a
self-managed deployment.

## The text index cannot help a sort

> *"Text indexes cannot improve performance for sort operations. This restriction
> applies to both single-field and compound text indexes."*

This is the restriction that explains the search endpoint's shape. Chapter 02's
`searchProducts` sorts by relevance:

```js
.sort({score: {$meta: 'textScore'}})
.skip(page * limit).limit(limit + 1)
```

The score is computed per matching document at query time, so there is nothing
for an index to have pre-sorted — and the Manual generalises that to sorting of
any kind under a text query. **Every `$text` query with a sort is a blocking
sort.**

Which makes the ten-page cap a structural decision rather than a product whim:

```js
if (page >= 10) return {items: [], hasMore: false};
```

`skip(page * limit)` on a blocking sort means the server materialises and sorts
**every** matching document before discarding the skipped ones, so page 500 costs
exactly what page 1 costs plus the discarding. Capping the depth bounds the damage.
Phase 1 capped it for the same reason: `ts_rank` is also computed per row, so
Postgres's GIN index could not supply relevance order either.

**Keyset pagination is not available here.** The cursor technique from
[02·02](../02-the-catalog/02-keyset-pagination.md) needs a stored, indexed sort
key to compare against, and a relevance score is neither stored nor indexed. That
is why the catalog paginates by cursor and search paginates by page number — two
different mechanisms in one API, for a reason that lives in the index.

## The other properties, and what each costs

**Always sparse.** *"Text indexes are always sparse. MongoDB ignores the `sparse`
option when creating text indexes. MongoDB does not add a text index entry for
documents that lack the text index field, have null values, or have empty
arrays."* Good news for size; it also means a product with no `description` is
still indexed on `name`, and a product with neither is absent from the index
entirely and unfindable by search.

**Cannot cover a query.** *"Text indexes can't cover a query."* So every `$text`
match fetches the document. That is fine for a search result page, which needs the
document anyway, and it removes covered queries
([chunk 11](08-covered-queries.md)) from the toolbox for search entirely.

**Cannot be hinted.** *"If a query includes a `$text` expression, you cannot use
`hint()` to specify which index to use for the query."* Since there is at most one
text index, there is nothing to choose — but it also means the diagnostic
technique of forcing a plan ([chunk 16](12-hint-and-the-plan-cache.md)) is
unavailable for the one query shape where you might most want it.

**Binary comparison only, no collation.** *"Text indexes only support binary
comparison, and do not support the collation option."* Language-aware behaviour
comes from `default_language` and the stemmer, not from a collation — and on a
collection with a non-simple default collation you must pass
`{collation: {locale: 'simple'}}` explicitly to create the index at all.

**Expensive to build and to maintain.** *"Text indexes can consume significant
RAM. They contain one index entry for each unique stemmed word in each indexed
field for each document."* And they *"impact write performance because MongoDB
must add an index entry for each unique stemmed word in each indexed field of new
documents"* — so editing a product description is a far heavier write than
editing its price. That asymmetry is why
[chunk 3](02b-what-the-list-leaves-out.md) puts the text index in its own
migration.

## Compound text indexes, and the rule that makes them useful

A text key may be combined with ordinary ascending or descending keys, with three
restrictions:

- *"A compound text index cannot include any other special index types, such as
  multikey or geospatial index fields."*
- *"If the compound text index includes keys **preceding** the text index key, to
  use `$text`, the query predicate must include **equality match conditions** on
  the preceding keys."*
- *"When you create a compound text index, all text index keys must be listed
  adjacently in the index specification document."*

The middle one is the useful one. `{'category.slug': 1, name: 'text',
description: 'text'}` would let a search be scoped to one category **provided
every search query supplies an equality on `category.slug`** — which turns an
optional filter into a mandatory one. This app's search has no category filter
today, so the plain text index is right; if a scoped search is ever added, the
compound form is the tool and the mandatory-equality rule is its price.

Note also what the first restriction forbids: a compound text index cannot include
a multikey key, so "search within a product's tags array plus its name" is not one
index.

## Gotchas

**★ One text index per collection, not per field.** Two different search
behaviours over `products` cannot be two indexes. The field set and the weights
are a single global decision, and changing either is a rebuild of the most
expensive index in the app.

**★ Weights are index-time and a query cannot override them.** Exactly as Phase
1's `setweight` was baked into the stored vector. "Boost the description for this
one query" is not expressible; it is a different index, and there is only one.

**★ A text index cannot improve a sort, so every sorted `$text` query blocks.**
The relevance score is computed per matching document at query time, so there is
nothing pre-ordered to walk. This is documented for *any* sort under a text query,
not just relevance sorts.

**★ Keyset pagination is impossible for search.** The sort key is a computed score
— not stored, not indexed — so there is no value for a cursor to compare against.
Search paginates by page number with a depth cap, and the API therefore has two
pagination mechanisms for a reason that is an index property.

**★ `skip` on a text search re-does the whole sort every page.** The blocking sort
sees every matching document regardless of the page requested, so deep pages cost
the full sort plus the discarding. The ten-page cap is the bound.

**★ A product with no indexed text fields is absent from the index.** Text indexes
are always sparse, so a product missing both `name` and `description` is simply
unfindable by search — no error, no empty match, just absence.

**★ `hint()` is unavailable on `$text` queries.** The one diagnostic that forces a
plan does not work on the one query shape where the plan is least obvious. What
remains is `explain()` on the query as written.

**★ A text index does not support collation, and needs `{locale: 'simple'}` on a
collated collection.** If the collection has a non-simple default collation, the
`createIndex` call must say `simple` explicitly or it fails. Easy to hit on a
collection created with a language collation for other reasons.

**★ Editing a description is a much heavier write than editing a price.** The
index holds one entry per unique stemmed word per indexed field per document, so
a description rewrite rewrites dozens of index entries. Bulk content edits should
be planned like a migration, not run in a request handler loop.

**★ A compound text index makes its preceding keys mandatory.** If `category.slug`
precedes the text keys, every `$text` query must supply an equality on it or the
index is unusable — so an "optional category filter" becomes a required one, and
the unscoped search silently stops working.

## Interview questions

**★ What is the single most limiting property of MongoDB text indexes, and how
does it compare to Postgres FTS?**
That a collection can have at most one text index. Postgres places no such limit —
several `tsvector` columns with several GIN indexes over one table is ordinary —
so a requirement for two search behaviours over the same data is a routine schema
addition there and is not expressible here. The consequences are that the indexed
field set and the weights become one collection-wide decision, and that changing
either is a rebuild of the most expensive index in the deployment. Atlas Search
lifts the restriction; a self-managed deployment lives with it.

**★ Why does the search endpoint cap at ten pages when the catalog paginates by
cursor?**
Because the sort key is different in kind. The catalog sorts on a stored, indexed
field, so a keyset cursor can carry the last row's value and the next page is a
range scan. Search sorts on a relevance score computed per matching document at
query time — nothing stores it and, per the Manual, a text index cannot improve
sort performance at all. So every sorted `$text` query is a blocking sort over the
full match set, `skip` discards from the front of that sorted set, and deep pages
cost the same as shallow ones plus the discarding. The cap bounds the cost. Phase 1
capped it for exactly the same reason with `ts_rank`.

**★ Weights are given at index creation. What follows from that?**
That relevance tuning is a schema change, not a query parameter. A stakeholder
asking to "weight the product name more heavily for this search box" is asking for
an index rebuild, and — because there is only one text index per collection — a
rebuild that changes behaviour for every other consumer of search too. This is
identical to Phase 1's stored `setweight` vector, which is a good illustration
that the constraint is about full-text indexing rather than about MongoDB.

**★ When would you use a compound text index, and what does it cost?**
When search must always be scoped by an equality — search within a category,
search within a tenant. The index is `{scope: 1, field: 'text'}` and the cost is
stated in the restrictions: with keys preceding the text key, a `$text` query
*must* include equality conditions on those keys. So the scope stops being
optional. An app whose search is sometimes scoped and sometimes not cannot use the
compound form for both, and — since there is only one text index — cannot have one
of each.

**★ A product is not appearing in search results and the query is correct. What
do you check?**
Whether it is in the index at all. Text indexes are always sparse and add no entry
for documents lacking the indexed fields, holding null, or holding empty arrays —
so a product whose `name` and `description` are both missing or null is simply
absent. After that, the stemming: `$text` matches stemmed words in the index's
`default_language`, so a term the stemmer maps differently, or content in another
language, will not match. And note you cannot `hint()` a `$text` query, so the
diagnostic is `explain()` on the query as written plus inspecting the document.

**★ Why is the text index in its own migration file?**
Because it is the expensive one to build and the expensive one to maintain: one
index entry per unique stemmed word per indexed field per document, significant
RAM, and a build the Manual says takes longer than a scalar index over the same
data. Separating it means a failed build does not obscure whether the cheap
indexes landed, and it lets the slow step be scheduled independently. It also
makes the write-cost asymmetry visible in the codebase — editing a description is
a far heavier operation than editing a price, and the migration file is where that
fact is recorded.

---

← Prev: [Multikey indexes](06-multikey-indexes.md) ·
Next → [Covered queries](08-covered-queries.md)
