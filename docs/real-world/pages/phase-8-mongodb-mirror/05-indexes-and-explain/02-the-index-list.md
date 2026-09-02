---
title: "The whole index list for this app, with the query each one exists for written next to it"
sidebar_label: "2 · The index list"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-02 against the **MongoDB Manual (8.0)** —
> [`db.collection.createIndex()`](https://www.mongodb.com/docs/manual/reference/method/db.collection.createIndex/),
> [Compound Indexes](https://www.mongodb.com/docs/manual/core/indexes/index-types/index-compound/),
> [Partial Indexes](https://www.mongodb.com/docs/manual/core/index-partial/),
> [ESR guideline](https://www.mongodb.com/docs/manual/tutorial/equality-sort-range-guideline/).
> Counterpart: [1·10 — indexes](../../phase-1-database/10-indexes.md), whose
> migration `014_indexes.sql` this file replaces.
> Spine: **MongoDB 8.0** (8.2 minor) · driver **`mongodb` 7.5.0** · **Node 24 LTS**.

**[Chunk 1](01-the-method-and-esr.md) gave the method. This is the output: one
migration file, every index in it, and for each one the chapter and query it was
derived from. Read it as a table of evidence rather than a schema — if a line
here has no query beside it, the line is wrong. The properties that need
explaining in their own right — unique, partial, collation, TTL, multikey, text —
each get a chunk after this one; here they are shown in place so the list is
whole. What the list deliberately omits, and why `createIndex` refuses to update
an index in place, are [the next chunk](02b-what-the-list-leaves-out.md).**

## The migration

```js
// migrations/mongo/004-indexes.js
export async function up(db) {
  // ── uniqueness: the constraints Phase 1 declared, now indexes ───────────
  await db.collection('products').createIndex({slug: 1}, {unique: true});
  await db.collection('categories').createIndex({slug: 1}, {unique: true});
  await db.collection('orders').createIndex({idempotencyKey: 1}, {unique: true});
  await db.collection('sessions').createIndex({tokenHash: 1}, {unique: true});
  await db.collection('reviews')
    .createIndex({orderId: 1, productId: 1}, {unique: true});
  await db.collection('users').createIndex(
    {email: 1}, {unique: true, collation: {locale: 'en', strength: 2}});
  await db.collection('carts').createIndex(
    {userId: 1}, {unique: true, partialFilterExpression: {userId: {$type: 'objectId'}}});
  await db.collection('carts').createIndex(
    {sessionId: 1},
    {unique: true, partialFilterExpression: {sessionId: {$type: 'objectId'}}});

  // ── the catalog (chapter 02) ────────────────────────────────────────────
  // filter on category, sort by price + tiebreak — E, S
  await db.collection('products').createIndex(
    {'category.slug': 1, priceCents: 1, _id: 1},
    {partialFilterExpression: {deletedAt: null}});
  await db.collection('products').createIndex(
    {'category.slug': 1, priceCents: -1, _id: -1},
    {partialFilterExpression: {deletedAt: null}});
  // filter on category, sort newest-first (ObjectId carries the timestamp)
  await db.collection('products').createIndex(
    {'category.slug': 1, _id: -1},
    {partialFilterExpression: {deletedAt: null}});
  // no category filter: the bare sort pairs
  await db.collection('products').createIndex(
    {priceCents: 1, _id: 1},  {partialFilterExpression: {deletedAt: null}});
  await db.collection('products').createIndex(
    {priceCents: -1, _id: -1}, {partialFilterExpression: {deletedAt: null}});

  // ── the product page and its reviews (chapter 02) ───────────────────────
  await db.collection('reviews').createIndex(
    {productId: 1, createdAt: -1},
    {partialFilterExpression: {status: 'approved'}});

  // ── the order history and the dashboard (chapters 01, 04) ───────────────
  await db.collection('orders').createIndex({userId: 1, createdAt: -1, _id: -1});
  await db.collection('orders').createIndex({status: 1, createdAt: -1});

  // ── review eligibility: did this user buy this product? (chapter 01·04) ─
  // multikey on the second key: items is an array
  await db.collection('orders').createIndex({userId: 1, 'items.productId': 1});

  // ── the worker's outbox poll (chapter 01·05) ────────────────────────────
  await db.collection('outbox').createIndex(
    {leasedUntil: 1, createdAt: 1},
    {partialFilterExpression: {processedAt: null}});

  // ── session expiry: the TTL index that deleted a scheduled job ──────────
  await db.collection('sessions').createIndex(
    {expiresAt: 1}, {expireAfterSeconds: 0});
}
```

```js
// migrations/mongo/005-text-index.js — its own file, see the note below
export async function up(db) {
  await db.collection('products').createIndex(
    {name: 'text', description: 'text'},
    {name: 'products_text', weights: {name: 10, description: 1},
     default_language: 'english'});
}
```

## The derivations that teach the most

**`{'category.slug': 1, priceCents: 1, _id: 1}` is
[chapter 02's keyset query](../02-the-catalog/02-keyset-pagination.md) made
physical.** Equality on the category, then *exactly* the `sort` pair with matching
directions. That is ESR with no R at all — the price filter, when present, is a
separate query shape, discussed below. A keyset page on this index is one descent
plus a walk, and `explain()` shows an `IXSCAN` with **no `SORT` stage**. A `SORT`
under a keyset query means the index and the sort disagree, and the whole point of
chapter 02 is lost.

**There are two price indexes, not one, because direction is part of the
index.** `{priceCents: 1, _id: 1}` serves `price_asc` and its exact mirror;
`price_desc` needs `{priceCents: -1, _id: -1}`. A single-key index would serve
both directions, but the tiebreak makes these compound, and a compound index
serves its declared direction pattern and its exact reverse — not an arbitrary
mix. This is the same rule Phase 1's `(created_at desc, id desc)` obeyed.

**`newest` needs only `{'category.slug': 1, _id: -1}`.** Because chapter 02's
`SORTS` table maps `newest` to `_id` rather than `createdAt` — an ObjectId leads
with a timestamp — the newest-first sort is served by a two-key index instead of
Phase 1's three-column `(category_id, created_at desc, id desc)`. That is a
genuine simplification the document model bought, and it is the only one in this
list.

**`{status: 1, createdAt: -1}` on `orders` is the dashboard's index and `$in`
is why status comes first.** The revenue `$match` filters
`status: {$in: ['paid','shipped','delivered']}` and ranges on `createdAt`; the
Manual is explicit that a bare `$in` is an equality operator, so it is the E and
the date range is the R. Put the date first and the equality cannot narrow, and
every revenue query becomes a range scan filtered afterwards.

**`{userId: 1, createdAt: -1, _id: -1}` on `orders` serves the order history**,
which [chapter 01·04](../01-modeling-the-store/03-the-order-document.md) fixed as
`find({userId}).sort({createdAt: -1, _id: -1}).limit(20)`. Equality, then the
full sort pair. It also serves the top-customers `$group` in
[04·15](../04-the-dashboard/06-lookup-and-why-mostly-you-dont.md) only
incidentally — that pipeline's `$match` is on `createdAt`, not `userId`, so it
uses the `{status: 1, createdAt: -1}` index instead and groups afterwards.

**`{leasedUntil: 1, createdAt: 1}` partial on `processedAt: null` is the
outbox lease**, and it is the closest thing in the list to Phase 1's
`outbox_due_idx`. The poll from
[chapter 01·05](../01-modeling-the-store/04-what-stays-a-collection.md) is a
`findOneAndUpdate` filtering on `processedAt: null` plus a `leasedUntil` clause,
sorted by `createdAt`. Because the index is partial, **it holds only unprocessed
rows and stays at working-set size forever** — processed jobs leave the index the
moment they stop being interesting, no matter how much history the collection
carries. That is exactly the argument Phase 1 made, and it is the strongest
single case for partial indexes in the app.

**`{productId: 1, createdAt: -1}` partial on `status: 'approved'`** serves both
the product page's review list and the rating recompute in
[01·11](../01-modeling-the-store/07b-the-rating-summary.md). Same argument: the
storefront only ever reads approved reviews, so moderation history never enters
the index.

## Gotchas

**★ A compound index serves its declared direction pattern and its exact mirror,
and nothing in between.** `{priceCents: 1, _id: 1}` serves
`sort({priceCents: 1, _id: 1})` and `sort({priceCents: -1, _id: -1})` — the
pattern and its reverse. It does **not** serve `sort({priceCents: 1, _id: -1})`,
a mix of the two. The catalog needs two price indexes because ascending price and
descending price are separate sorts, each carrying a tiebreak in the matching
direction.

**★ `_id: 1` at the end of a compound index is not redundant.** It looks like it,
because `_id` is already uniquely indexed. It is not: without it the compound
index cannot supply the tiebreak order, so the keyset query's `sort` is only
partly served and a `SORT` stage appears. The `_id` key in the compound index and
the `_id` index are different structures serving different queries.

**★ The dashboard's `{status: 1, createdAt: -1}` and the history's
`{userId: 1, createdAt: -1, _id: -1}` are not interchangeable.** Neither is a
prefix of the other, and a query filtering on `userId` cannot use the status
index at all. Two access patterns, two indexes; merging them into
`{userId: 1, status: 1, createdAt: -1}` would serve the history and stop serving
the dashboard, because the dashboard has no `userId` predicate to supply the
prefix.

**★ Indexing `category.slug` rather than `category._id` is a consequence of the
extended reference.** [Chapter 01's](../01-modeling-the-store/07-denormalization-and-staleness.md)
`products.category = {_id, slug, name}` exists so the catalog filter is an
indexed equality on a value the URL already carries. Index the field the query
uses; indexing `category._id` instead would force the route to resolve a slug to
an id first, which is the round trip the denormalisation removed.

**★ Every index in this list is maintained on every write to its collection.**
`products` carries seven, so a price update rewrites seven index entries. That is
the cost side of the ledger and it is the reason the deliberately-omitted list
exists at all.

## Interview questions

**★ Walk me through deriving the catalog's main index from the query.**
The query filters `category.slug` for equality and `deletedAt: null` as a
standing condition, sorts by `priceCents` with `_id` as a tiebreak, and paginates
by keyset. Equality first gives `category.slug`; the sort pair follows in the
query's order and direction, giving `{'category.slug': 1, priceCents: 1, _id:
1}`; and the standing condition becomes a `partialFilterExpression` rather than a
fourth key, because every query of this shape carries it and a partial index stays
smaller. There is no range predicate in this shape, so ESR degenerates to ES.

**★ Why are there two price indexes rather than one?**
Because direction is part of a compound index. `{priceCents: 1, _id: 1}` supplies
ascending price with an ascending tiebreak, and its exact reverse; descending
price with a descending tiebreak is a different key pattern and needs its own
index. A single-key index can be walked either way, but the keyset tiebreak makes
these compound, and a compound index only serves order-compatible sort patterns.

**★ Why does `status` come before `createdAt` on the orders dashboard index when
the date range is far more selective?**
Because `$in` is an equality operator by the Manual's own definition, and ESR puts
equality first so that the remaining key stays in sorted order within the matched
range. Putting `createdAt` first would give the ERS ordering, which the Manual
allows when the range is very selective and an in-memory sort is acceptable — and
here it is not obviously acceptable, because the dashboard's `$group` benefits
from the documents arriving in date order. If profiling showed the status
equality selecting too much, ERS would be the documented alternative to try.

**★ Which single index in this list would you defend hardest, and why?**
The outbox's `{leasedUntil: 1, createdAt: 1}` with
`partialFilterExpression: {processedAt: null}`. It is the one where the partial
predicate changes the index's *asymptotics* rather than just its size: the working
set is the handful of unprocessed jobs, and rows leave the index the moment they
are processed, so the index stays constant-sized while the collection grows
without bound. Every other partial index in the list is a useful economy; that one
is the difference between a queue that stays fast for years and one that degrades.

---

← Prev: [The method and ESR](01-the-method-and-esr.md) ·
Next → [What the list leaves out](02b-what-the-list-leaves-out.md)
