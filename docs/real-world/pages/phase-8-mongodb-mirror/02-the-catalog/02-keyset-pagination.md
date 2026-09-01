---
title: "Keyset pagination without row comparison: writing (price, _id) > (a, b) out by hand"
sidebar_label: "2 · Keyset pagination"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **MongoDB Manual (8.0)** —
> [`$sort`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/sort/)
> (*"`$sort` is not a stable sort"*; to guarantee consistent order, include a
> uniquely-valued field, *"typically the `_id` field"*),
> [`cursor.skip()`](https://www.mongodb.com/docs/manual/reference/method/cursor.skip/),
> [`$or`](https://www.mongodb.com/docs/manual/reference/operator/query/or/),
> [Sort and Index Use](https://www.mongodb.com/docs/manual/tutorial/sort-results-with-indexes/),
> [Limits and Thresholds](https://www.mongodb.com/docs/manual/reference/limits/)
> (100 MB in-memory sort limit).
> Spine: **MongoDB 8.0** (8.2 minor) · driver **`mongodb` 7.5.0** · **Node 24 LTS**.

**Phase 1's cursor was one line of standard SQL:
`(p.price_cents, p.id) > ($1, $2)` — a row comparison the planner evaluates
against a compound index. MongoDB has no row-value comparison. The same
predicate has to be written out as an `$or` of two clauses, and every part of it
— the operator direction, the tiebreak, the sort spec, the index — has to agree
or the query silently degrades from an index walk into a 100 MB in-memory sort.
This chunk writes it out, explains why the naive spelling is wrong, and keeps
the API contract's cursor byte-identical.**

## The argument, unchanged

Everything Phase 1 said about `OFFSET` applies verbatim to `skip()`. `skip(9800)`
produces and discards 9,800 documents, so cost grows linearly with depth; and
because it counts *current* documents, an insert or a delete shifts the boundary
and users see repeats or holes. Nothing about the document model changes that.

What changes is the *cost of the alternative*, and it is worth being honest: in
Postgres the keyset predicate was one expression that read like its meaning. Here
it is six lines that do not. That is a real tax on legibility, paid once, in one
function.

## Why the naive spelling is wrong

The obvious translation of "products after price 1999" is:

```js
// WRONG — loses or repeats every product that costs exactly 1999
{priceCents: {$gt: cursor.value}}
```

Fifty products cost 19.99. `$gt` skips all of them, including the ones this page
has not shown yet; `$gte` re-shows the ones it already did. This is the same
failure Phase 1 named, and it is why **the cursor is the sort key plus `_id`**,
not the sort key alone.

The Manual gives the underlying reason in its own words, about sorting rather
than paging:

> *"`$sort` is not a stable sort. Documents with equivalent sort keys are not
> guaranteed to maintain their relative input order."* … To ensure consistent
> ordering, include *"a field with unique values"*, *"typically the `_id`
> field"*.

An unstable sort over a non-unique key means "the fifty products at 19.99" can
come back in a different order on the next request — so even a correct-looking
`$gte` plus a client-side dedupe cannot be made to work. **A total order is not
an optimisation for keyset pagination; it is the precondition.**

## The predicate, written out

For an ascending sort on `priceCents`, "strictly after `(value, id)`" is:

```js
{$or: [
  {priceCents: {$gt: value}},                    // a later price, any id
  {priceCents: value, _id: {$gt: id}},           // the same price, a later id
]}
```

and for a descending sort both operators flip to `$lt`. As a function:

```js
// db/mongo/cursor.js — the keyset predicate, one place, both directions
export function afterCursor({key, dir}, cursor) {
  if (!cursor) return {};
  const cmp = dir === 1 ? '$gt' : '$lt';
  if (key === '_id') return {_id: {[cmp]: cursor.id}};   // sort key IS the tiebreak
  return {$or: [
    {[key]: {[cmp]: cursor.value}},
    {[key]: cursor.value, _id: {[cmp]: cursor.id}},
  ]};
}
```

The `key === '_id'` branch is not a micro-optimisation. The `newest` sort orders
by `_id` alone, and `_id` is already unique, so the two-clause form would be
redundant — and, more importantly, an `$or` prevents the planner from treating
the predicate as a single index range. One clause on a unique key is a plain
range scan on the `_id` index.

## Composing it with the filter

The keyset clause and the filter clause both want to be top-level keys, and they
can collide: if the filter already has a `$or` (it does not today, but a
"discounted or new arrivals" facet would add one), assigning `filter.$or`
overwrites it. The safe composition is `$and`:

```js
export async function listProducts(db, {
  categorySlug, minCents, maxCents, sort = 'newest', cursor, limit = 24,
} = {}) {
  const s = SORTS[sort];
  if (!s) throw new RangeError(`unknown sort: ${sort}`);

  const filter = buildFilter({categorySlug, minCents, maxCents});
  const keyset = afterCursor(s, cursor);
  const query = Object.keys(keyset).length
    ? {$and: [filter, keyset]}
    : filter;

  const sortSpec = s.key === '_id'
    ? {_id: s.dir}
    : {[s.key]: s.dir, _id: s.dir};        // the tiebreak is PART of the sort

  const docs = await db.collection('products')
    .find(query)
    .sort(sortSpec)
    .limit(limit + 1)                      // one extra row = "has next page"
    .project(CARD_PROJECTION)
    .toArray();

  const hasMore = docs.length > limit;
  const page = hasMore ? docs.slice(0, limit) : docs;
  const last = page.at(-1);
  return {
    items: page,
    nextCursor: hasMore
      ? encodeCursor({value: s.key === '_id' ? null : last[s.key], id: last._id})
      : null,
  };
}
```

Four details are load-bearing.

**`_id` appears in the sort spec with the *same direction* as the key.** The
predicate's second clause says "same price, later id", where "later" means the
sort direction — so if the sort spec's `_id` direction disagreed with the
predicate's, the query would return documents in an order the cursor cannot
resume from. Direction is one decision applied in three places: predicate, sort,
index.

**`limit(limit + 1)` answers "is there a next page" without a count.** Same
reasoning as Phase 1: `countDocuments` on the filtered set costs more than the
page it is describing.

**The projection is applied in the query, not in JavaScript.** The catalog card
needs six fields out of a document that carries a description, an attributes
subdocument and an image array; projecting server-side is the difference between
shipping a card and shipping a product page, 24 times.

**The cursor `value` is `null` for the `_id` sort**, because the id *is* the
value, and encoding it twice invites the two copies to disagree after a
refactor. What `encodeCursor` and `decodeCursor` actually do with that pair —
and why the cursor has to carry the sort's name — is
[chunk 3](02b-the-cursor-round-trip.md).

## The index this requires

Stated here because the query is meaningless without it, derived properly in
**chapter 05** *(not written yet)*:

```js
await db.collection('products').createIndex(
  {'category.slug': 1, priceCents: 1, _id: 1},
  {partialFilterExpression: {deletedAt: null}},
);
```

Equality field first, then the sort pair in the sort's direction — the Manual's
ESR guideline, and the direct counterpart of Phase 1's
`(category_id, price_cents, id)`. If the index and the sort disagree, the query
still returns correct results and quietly performs an in-memory sort, bounded by
the documented 100 MB limit; `explain()` shows a `SORT` stage, which is the
single check
**chapter 05** *(not written yet)* makes its gate.

## Gotchas

**★ `$gt` on the sort key alone loses every tie.** Fifty products at the same
price are either all skipped or all repeated, depending on whether you reached
for `$gt` or `$gte`. There is no third option that works without the `_id`
tiebreak, and the bug is invisible on seed data where prices happen to be
distinct.

**★ Assigning `filter.$or` for the keyset clobbers any `$or` the filter already
had.** Today the catalog filter has none, so the naive version works — and it
will keep working until someone adds a facet, at which point the filter silently
loses its own condition and the catalog shows products it should not. Compose
with `$and` from the start; the cost is one object.

**★ Mixed sort directions break the index, not the correctness.** A sort of
`{priceCents: 1, _id: -1}` is answerable, but no single compound index serves it
in one direction, so it becomes a full sort. This is the direct analogue of Phase
1's direction-mismatch gotcha, and the rule is the same: the tiebreak's direction
follows the sort key's.

**★ `skip()` in an aggregation pipeline is exactly as expensive as `skip()` in a
find.** Rewriting the query as a pipeline for other reasons — a `$lookup`, a
`$facet` — does not make paging cheaper, and the `$skip` stage sitting after a
`$sort` is the classic place this gets forgotten. The keyset predicate belongs
in the `$match`, before the sort, wherever the query lives.

**★ The extra document fetched for `hasMore` is also projected and also
transferred.** Harmless at 24 documents, and worth remembering if the page size
ever becomes large — the alternative, an exact count, is worse, and the
alternative-alternative of asking for `limit` and issuing a second query when the
page is full is two round trips for the same answer.

**★ Sorting on a field absent from some documents mixes missing and null.** BSON
orders missing/null before numbers, so a sort on an optional field puts every
document lacking it at one end and the cursor walks through them first. For
`priceCents` the validator makes this impossible; for any optional sort key added
later, it is the first thing to check.

## Interview questions

**★ Postgres wrote the keyset as `(price, id) > ($1, $2)`. Why does MongoDB need
five lines?** Because MongoDB has no row-value comparison: a query document
compares one field to one operand, so a lexicographic comparison over two fields
has to be decomposed into "the first field is strictly later" OR "the first field
is equal and the second is strictly later". The semantics are identical; the
spelling is worse. The practical consequence is that the direction now appears in
three places — the two `$or` clauses, the sort spec, and the index — and any
disagreement between them is a silent wrong result or a silent full sort, which
is why it lives in one function rather than at every call site.

**★ Why must `_id` be in the sort spec and not only in the cursor?** Because
`$sort` is documented as not stable: documents with equal sort keys can come back
in a different relative order on each execution. If `_id` is only in the
predicate, the query correctly excludes everything up to the boundary but the
*order* of the remaining ties is unspecified — so a document can appear on two
consecutive pages or on neither. The tiebreak has to be part of the ordering, not
just part of the boundary, and the Manual's own guidance is to include a uniquely
valued field, typically `_id`.

**★ What actually happens if the index does not match the sort?** The query is
still correct. MongoDB fetches the matching documents and sorts them in memory,
subject to the documented 100 MB limit — beyond which it either errors or spills
to disk depending on `allowDiskUseByDefault`. So the failure mode is latency and
memory, not wrong answers, which is precisely why it survives code review and
shows up in production: page one is fast because the result set is small, and the
same query on a real catalog is not. `explain()` showing a `SORT` stage is the
detector, and it is a gate rather than an investigation.

**★ The search endpoint sorts by relevance. Can it use this?** No, and
[chunk 3](03-search.md) is about why. A keyset needs a *stored, stable* sort key;
a text score is computed per query and shifts as data changes, so "after score
0.62" is not a boundary that means the same thing twice. Search therefore keeps
bounded `skip`, exactly as Phase 1 kept bounded `OFFSET`, and caps the depth
rather than pretending a score keyset is stable.

**★ Someone proposes storing a monotonically increasing `seq` on products so the
catalog can page by a single integer. Worth it?** It would make the predicate one
clause instead of two and the index one field narrower — but only for the
`newest` sort, which already pages on `_id` alone for free. For the price sorts
the tiebreak is still needed, because `seq` does not tell you where you were in
*price* order. So the proposal buys nothing the `_id` sort does not already have,
and costs a counter document that serialises every product insert. The `_id`
sort's simplicity is not a trick worth generalising; it is a property of sorting
on the unique key itself.

{/* FOOTER */}
