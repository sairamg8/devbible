---
title: "The index this app decided not to build, and the reason createIndex refuses to update one in place"
sidebar_label: "3 · What the list leaves out"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-02 against the **MongoDB Manual (8.0)** —
> [`db.collection.createIndex()`](https://www.mongodb.com/docs/manual/reference/method/db.collection.createIndex/),
> [Partial Indexes](https://www.mongodb.com/docs/manual/core/index-partial/)
> (*"To use the partial index, a query must contain the filter expression (or a
> modified filter expression that specifies a subset of the filter expression) as
> part of its query condition"*),
> [Text Indexes](https://www.mongodb.com/docs/manual/core/indexes/index-types/index-text/)
> (*"Text indexes can consume significant RAM"*; *"Building a text index is
> similar to building a large multikey index but takes longer than building an
> ordered (scalar) index on the same data"*),
> [`collMod`](https://www.mongodb.com/docs/manual/reference/command/collMod/),
> [`$indexStats`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/indexStats/).
> Spine: **MongoDB 8.0** (8.2 minor) · driver **`mongodb` 7.5.0** · **Node 24 LTS**.

**An index that exists leaves a line in a migration and a row in `getIndexes()`.
An index that was *considered and rejected* leaves nothing at all, so a later
reader cannot tell a decision from an oversight and will either re-litigate it or
quietly add it. This chunk is the written-down absence — the one query shape this
app serves without a dedicated index and the condition under which that changes —
plus the operational fact that makes editing
[chunk 2's migration](02-the-index-list.md) in place impossible.**

## The query shape this list deliberately does not serve

**Category + price range + newest-first.** Its predicates are
E (`category.slug`), R (`priceCents` between bounds), S (`_id` descending) — and
ESR wants `{'category.slug': 1, _id: -1, priceCents: 1}`, a fourth catalog index
on `products`.

It is not in the list, and that is a decision rather than an oversight. The
filter-plus-newest combination is a small fraction of catalog traffic; the
existing `{'category.slug': 1, _id: -1}` index serves the equality and the sort,
and the price range is applied as a filter on the fetched documents. The cost is
visible in `explain()` as `totalDocsExamined` exceeding `nReturned`
([the ratio chunk](11-the-ratio-and-the-sort-stage.md)), and the trigger to add the index is
that ratio getting bad on real traffic — not a hunch.

The arithmetic behind "small fraction" is worth doing explicitly rather than
asserting, because it is the whole justification:

- With **ESR** (`{'category.slug': 1, _id: -1, priceCents: 1}`) the sort is free
  and the price range is applied while walking, so the index scan touches every
  product in the category and the filter discards the out-of-range ones.
- With **ERS** (`{'category.slug': 1, priceCents: 1, _id: -1}`) the range narrows
  first, so far fewer entries are touched — and the `_id` order is gone, so a
  blocking `SORT` appears.
- With **what this app actually has** (`{'category.slug': 1, _id: -1}`) the sort
  is free, the range is a filter, and the difference from the ESR index is that
  the filter runs on *fetched documents* rather than on *index keys*.

The last option is strictly worse than ESR and strictly cheaper to maintain. What
decides it is how many documents get fetched and thrown away, which is the
category size times the fraction outside the price range — a number that depends
on real catalog data and real user behaviour, not on the query text.

**So the decision is deferred to evidence, and the evidence is named.** That is
the honest version of "we did not add it".

## Writing the absence down

Phase 1 kept a short list of indexes it deliberately omitted —
`products.stock`, `orders.status` alone, `users.role` — for exactly this reason.
The MongoDB list is the same plus this fourth catalog shape, and the mechanism
that makes it necessary is that **an absent index leaves no trace anywhere in the
system**. `getIndexes()` shows what exists. Nothing shows what was rejected.

The two failure modes when it is not written down:

1. Someone adds it "to be safe", and `products` now maintains eight indexes on
   every price update instead of seven, forever, for a query shape nobody
   measured.
2. Someone hits the slow query, assumes the index list was carelessly built, and
   distrusts the rest of it.

`$indexStats` is the tool for the opposite direction — finding indexes that exist
and are never used:

```js
await db.collection('products').aggregate([{$indexStats: {}}]).toArray();
// one document per index, with an `accesses.ops` counter and `accesses.since`
```

It is the MongoDB counterpart of Phase 1's
`pg_stat_user_indexes.idx_scan = 0`, with the same caveat: the counters reset
when the server restarts, so a zero on a recently-restarted node means nothing.
Read it after a full traffic cycle, on a node that has been up for it.

## `createIndex` will not update an index in place

`createIndex` is **idempotent when the specification matches exactly**: calling it
again with the same keys and the same options is a no-op. Calling it again with
the same keys and *different* options is an **error**, not a silent update.

That is a feature. It means a migration cannot quietly change an index's
semantics, and it means the difference between two environments cannot be
"someone re-ran the migration after editing it".

The consequence for this app: **the migration in
[chunk 2](02-the-index-list.md) is safe to re-run and unsafe to edit.** An index
whose options need to change gets a new migration that drops and recreates it:

```js
// migrations/mongo/012-tighten-cart-index.js
export async function up(db) {
  await db.collection('carts').dropIndex('userId_1');
  await db.collection('carts').createIndex(
    {userId: 1},
    {unique: true, partialFilterExpression: {userId: {$type: 'objectId'}}});
}
```

and the drop is the risky half. Between the two statements the collection has no
index on `userId`, so every cart lookup is a collection scan and — because the
old index was unique — the uniqueness constraint is briefly unenforced. On a busy
system that window is where a duplicate gets in, and it is then impossible to
build the unique index again without cleaning up first.

The documented exception is TTL: `expireAfterSeconds` **can** be changed in
place, and the mechanism is `collMod` rather than `createIndex`. That is
[the TTL chunk](05b-ttl-restrictions-and-the-deleter.md).

## Why the text index is its own migration file

Phase 1 put `create index concurrently` in a separate no-transaction migration,
because a concurrent build cannot run inside a transaction. MongoDB has no
migration transaction to break, so the reason here is different and simpler:
**a text index is the most expensive index in the list to build.** The Manual
warns that text indexes *"can consume significant RAM"*, that they contain *"one
index entry for each unique stemmed word in each indexed field for each
document"*, and that *"Building a text index is similar to building a large
multikey index but takes longer than building an ordered (scalar) index on the
same data"*.

Separating it means a failed or aborted text-index build does not obscure whether
the cheap indexes landed, and it means the expensive step can be scheduled
independently. It is a diagnosability and scheduling decision, not a correctness
one.

The mechanics of building any of these against a live replica set — the commit
quorum, the locks taken at the start and end, and why the rolling procedure is
specifically dangerous for the unique indexes in the list — are
[the live-build chunk](13-building-indexes-live.md).

## Gotchas

**★ A partial index is only used by a query that carries its filter.** The
Manual: *"To use the partial index, a query must contain the filter expression
(or a modified filter expression that specifies a subset of the filter
expression) as part of its query condition."* So every catalog query must include
`deletedAt: null`, and an admin query that omits it silently gets a collection
scan rather than an error. The predicate and the index are one decision written
in two files.

**★ `createIndex` with the same keys and different options errors.** It does not
update. A migration that "tightens" an existing index by adding `unique: true`
to its call fails everywhere the old index already exists — which is every
environment except a fresh database, so it passes CI and fails in staging.

**★ Dropping an index to recreate it leaves a window with no index.** For a
non-unique index that window is a performance problem. For a unique index it is a
**correctness** window: the constraint is unenforced, and a duplicate written
during it makes the recreate fail with a duplicate-key error and no obvious way
forward except finding and deleting the offending document.

**★ `$indexStats` counters reset on restart.** A zero `accesses.ops` on a node
that restarted an hour ago says nothing about whether the index is used. Read it
on a node that has been up for a full traffic cycle — a week including a month-end
if the app has monthly reports.

**★ "It is only a small fraction of traffic" is a claim, not a fact.** The
argument for omitting the fourth catalog index rests on the shape being rare and
on categories being small enough that the discarded fetches do not matter. Both
are measurable and neither was measured at design time. Writing the trigger
condition down — the docs-examined ratio on real traffic — is what turns the
assertion into a decision with an expiry date.

**★ An unused index still costs every write.** The tax is not "when the index is
queried", it is "when the collection is written". Seven indexes on `products`
means seven B-tree maintenance operations per price update, which is why the
rejected list matters as much as the accepted one.

## Interview questions

**★ There is no index for "category plus price range, newest first". Is that a
bug?**
No — it is a recorded decision. That shape is a minority of catalog traffic, the
existing `{'category.slug': 1, _id: -1}` index serves its equality and its sort,
and the price range is applied as a filter over the fetched documents. The cost
shows up as `totalDocsExamined` exceeding `nReturned`, and the trigger to add the
fourth index is that ratio on real traffic. What matters is that the absence is
written down, because an absent index leaves no evidence and a later reader
cannot otherwise tell a decision from an oversight.

**★ What happens if you re-run the index migration?**
Nothing, provided every specification is unchanged: `createIndex` with identical
keys and identical options is a no-op. If any option differs — a new
`partialFilterExpression`, `unique` added, a different collation — the call errors
rather than updating in place. That is deliberate and useful: it means an index's
semantics cannot drift silently, and it means changing one is an explicit
drop-and-recreate in a new migration, with the drop being the part that needs care
on a live system.

**★ You need to add `unique: true` to an existing index on a live collection.
Walk through it.**
You cannot modify it, so it is a drop and a recreate — and between the two the
constraint is unenforced and the queries that used the index are scanning. The
safe order is: first check the data actually satisfies uniqueness (an aggregation
grouping by the key and matching counts above one), because the recreate will fail
otherwise and you will have dropped a working index for nothing; then create the
*new* unique index under a different name first, so the collection is never
without one; then drop the old. Creating first also means the duplicate-key
failure, if there is one, happens while the old index is still doing its job.

**★ How do you find indexes nobody uses?**
`$indexStats`, which returns one document per index with an `accesses.ops`
counter and the time the counter started. It is the counterpart of Postgres's
`pg_stat_user_indexes`, and it carries the same trap: the counters are per-process
and reset on restart, so a low count on a recently-restarted node is evidence of
nothing. Read it on a node with a long uptime, across a full business cycle, and
cross-check against the query list before dropping anything — an index used once a
month by a report is still used.

**★ Why is the text index in its own migration file, when MongoDB has no
transactional DDL to worry about?**
Because it is the expensive one. The Manual warns text indexes consume
significant RAM, hold one entry per unique stemmed word per indexed field per
document, and take longer to build than a scalar index on the same data. Isolating
it means a build that fails or is aborted does not leave you wondering whether the
cheap indexes were created, and it means the slow step can be scheduled for a
quiet window independently of the rest of the migration.

---

← Prev: [The index list](02-the-index-list.md) ·
Next → [Unique indexes](03-unique-and-partial.md)
