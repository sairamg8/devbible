---
title: "A partial index is smaller, cheaper and self-documenting, and it silently refuses to serve any query that does not repeat its predicate"
sidebar_label: "5 · Partial indexes"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-02 against the **MongoDB Manual (8.0)** —
> [Partial Indexes](https://www.mongodb.com/docs/manual/core/index-partial/)
> (*"Partial indexes only index the documents in a collection that meet a
> specified filter expression"*; the closed operator list; *"MongoDB does not use
> the partial index for a query or sort operation if using the index results in an
> incomplete result set"*; *"To use the partial index, a query must contain the
> filter expression (or a modified filter expression that specifies a subset of
> the filter expression) as part of its query condition"*; *"You cannot specify
> both the `partialFilterExpression` option and the `sparse` option"*;
> *"`_id` indexes cannot be partial indexes"*).
> Counterpart: [1·10 — indexes](../../phase-1-database/10-indexes.md), whose
> `where deleted_at is null` clauses these replace.
> Spine: **MongoDB 8.0** (8.2 minor) · driver **`mongodb` 7.5.0** · **Node 24 LTS**.

**Postgres's partial index and MongoDB's `partialFilterExpression` are the same
idea and carry the same bargain: the index is smaller, cheaper to maintain and
documents the query it serves — and a query that does not repeat the predicate
cannot use it. In Postgres that is a well-known trap. In MongoDB it is the same
trap with a shorter operator list, so a filter you could express as a `WHERE`
clause may not be expressible as a `partialFilterExpression` at all.**

## What may appear in a `partialFilterExpression`

The Manual gives a closed list:

- equality (`field: value` or `$eq`)
- `$exists: true`
- `$gt`, `$gte`, `$lt`, `$lte`
- `$type`
- `$and`, `$or`, `$in`
- `$geoWithin`, `$geoIntersects`

Note what is **not** there: `$ne`, `$exists: false`, `$not`, `$regex`, `$expr`,
`$size`, `$mod`. So "index everything except the cancelled orders" is not
expressible as a partial filter — it has to be inverted into an `$in` over the
statuses you do want, which then has to be updated whenever a status is added.
That coupling is a real cost and worth knowing before designing a partial index
around a negation.

Postgres has no such restriction: `where status <> 'cancelled'` is a perfectly
ordinary partial index predicate. This is one of the few places in the phase
where MongoDB's version of a Postgres feature is strictly less expressive, and
saying so plainly is more useful than working around it silently.

## The predicate is a coupling, and it points at the queries

> *"MongoDB does not use the partial index for a query or sort operation if using
> the index results in an incomplete result set. To use the partial index, a query
> must contain the filter expression (or a modified filter expression that
> specifies a subset of the filter expression) as part of its query condition."*

This is the price of every partial index in
[chunk 2's list](02-the-index-list.md), and it is paid silently. A catalog query
that omits `deletedAt: null` does not error and does not warn; it simply cannot
use the `{'category.slug': 1, priceCents: 1, _id: 1}` index and falls back to a
collection scan with entirely correct results.

The defence is structural rather than vigilant: **the filter belongs in one
builder that every query goes through.**
[Chapter 02](../02-the-catalog/01-the-filter-document.md) already does this —
`buildFilter` always emits `deletedAt: null`, and no route composes a products
filter by hand. The rule to state is that **a partial index and the function that
builds its predicate are one artefact in two files**, and changing either without
the other degrades the plan without changing a result.

"A subset of the filter expression" is the useful loophole and it is worth
getting the direction right. An index partial on
`{status: {$in: ['approved', 'featured']}}` **is** usable by a query filtering
`status: 'approved'`, because that query asks for fewer documents than the index
holds. The reverse — an index partial on `'approved'`, a query on the `$in` —
cannot be used, because the index does not contain the featured ones and the
result would be incomplete.

The Manual's own example makes the same point from the other side: an index
partial on `{password: {$exists: true}}` cannot serve
`find({name: 'Ned Stark', password: {$exists: false}})`, because that query
*"matches more documents … than the index covers"*.

## The partial indexes in this app, and what each buys

| Index | Filter | What the filter buys |
|---|---|---|
| `products` catalog indexes ×5 | `deletedAt: null` | soft-deleted products never enter the index; the index tracks the *live* catalog, not its history |
| `reviews {productId, createdAt}` | `status: 'approved'` | moderation history — rejected and pending reviews — never enters the index the storefront reads |
| `outbox {leasedUntil, createdAt}` | `processedAt: null` | the index is **working-set sized forever**; rows leave it when processed |
| `carts` ×2 | `$type: 'objectId'` | correctness, not economy — without it the unique constraint is wrong |

The first three are economies. The fourth is the only one where the partial
filter is load-bearing for **correctness**
([chunk 4](03-unique-and-partial.md)), and separating the two cases matters: an
economy can be reconsidered when traffic changes, a correctness filter cannot be
removed at all.

The outbox row deserves the emphasis it gets in
[chunk 2](02-the-index-list.md): its partial filter changes the index's
**asymptotics**. The queue's working set is the handful of unprocessed jobs while
the collection accumulates months of history; rows leave the index at the moment
they stop being interesting, so the index stays constant-sized and stays hot in
cache no matter how large the collection grows. The `products` filters change a
constant factor — worthwhile, but a different kind of win.

## A partial index also documents its query

This is the underrated half of the bargain and Phase 1 made the same point. An
index declared as

```js
await db.collection('reviews').createIndex(
  {productId: 1, createdAt: -1},
  {partialFilterExpression: {status: 'approved'}});
```

says, in the migration file, that the app reads reviews **by product, newest
first, approved only**. The three-part statement is the query. A non-partial
index on the same keys would say only the first two thirds and leave the reader
guessing whether the status filter is applied in the app, in the index, or not at
all.

That matters more in MongoDB than in Postgres, because there is no schema file
listing the collections and their constraints. The index list *is* the schema
documentation, and a partial filter is the part of it that records intent.

## Restrictions worth knowing before you hit them

- *"You cannot specify both the `partialFilterExpression` option and the `sparse`
  option."* Partial supersedes sparse, and the Manual recommends partial *"for
  more precise control over which documents to index"*. Sparse is the older,
  cruder mechanism — presence of the index field only — and this app uses none.
  The one thing sparse can express that partial can express too:
  `partialFilterExpression: {field: {$exists: true}}` is exactly a sparse index,
  written in the newer vocabulary.
- *"`_id` indexes cannot be partial indexes."*
- *"Shard key indexes cannot be partial indexes."* Not a constraint this app hits,
  and one to remember before designing a shard key around a partial index.
- Since MongoDB 7.3, *"you cannot create equivalent indexes, which are partial
  indexes with the same index keys and the same partial expressions that use a
  collation"* — you cannot, for instance, keep two indexes differing only in the
  letter case of a string inside the partial filter. Where such pairs already
  exist from an older version, the Manual says *"the indexes are retained but only
  the first equivalent index is used in queries"*.
- Partial indexes **can** be TTL indexes, and the combination expires only the
  documents matching the filter. This app does not need it — the session TTL
  applies to every session — but it is the tool for "expire only the abandoned
  ones".

## Gotchas

**★ A query that omits the partial predicate gets a collection scan, silently.**
No error, no warning, correct results. The only symptom is `explain()` showing
`COLLSCAN` where the index name should be. Keep the predicate in one builder that
every query uses, and treat "the index and the filter-builder" as one artefact.

**★ `$ne`, `$not` and `$exists: false` are not allowed in a
`partialFilterExpression`.** The operator list is closed and shorter than
Postgres's `WHERE`. A filter naturally expressed as a negation has to be inverted
into an `$in` over the values you want — which then needs maintaining as the value
set grows, and a forgotten update makes the index silently exclude documents the
queries expect to find in it.

**★ A partial filter is a *subset* rule, and the direction matters.** A query
asking for fewer documents than the index holds can use it; a query asking for
more cannot. Index on `$in: ['approved','featured']`, query on `'approved'`:
usable. Index on `'approved'`, query on the `$in`: not usable, and again silently.

**★ `partialFilterExpression` and `sparse` are mutually exclusive.** If you are
reaching for `sparse` at all, reach for partial instead — it does everything
sparse does, plus filtering on fields other than the index key.

**★ The index and the query must agree *after* the query builder runs, not in the
source.** A filter assembled conditionally — `if (categorySlug) filter[...] = ...`
— can produce a predicate that carries `deletedAt: null` on one path and not on
another. The plan then differs between two requests that look identical in the
route, which is a very confusing performance report.

**★ A partial index over a mutable predicate field means documents enter and
leave the index on update.** Approving a review inserts an index entry;
un-approving it removes one. That is correct and it is a write cost that a
non-partial index does not have — an update touching only `status` still does
index work.

**★ Two partial indexes on the same keys with different filters are two
indexes.** They both get maintained, both cost writes, and — since 7.3 — cannot
differ only by collation-sensitive case in the filter. If you find yourself
creating a family of them, the question is whether the field belongs in the index
key instead.

## Interview questions

**★ What is the cost of a partial index?**
A coupling. The index is only usable by queries whose predicate contains the
filter expression, or a subset of it, and MongoDB enforces that silently — a query
that omits the predicate falls back to a collection scan with correct results and
no warning. So the index and the function that builds its query predicate become
one artefact spread over two files, and the discipline is that no query composes
the filter by hand.

**★ You want "index every order that is not cancelled". How do you express it?**
Not as a negation — `$ne` is not on the allowed operator list for
`partialFilterExpression`, and neither is `$not` or `$exists: false`. You invert
it into an `$in` over the four statuses you do want. The cost is that the index
now encodes the status enum, so adding a sixth status means editing the index —
and forgetting to means the new status's documents are silently unindexed while
every query still returns the right answer, just slowly.

**★ Which partial index in this app would you keep if you could only keep one?**
The outbox's `processedAt: null` filter, because it is the only one that changes
the index's growth rate rather than its constant factor. The queue's working set
is the handful of unprocessed jobs while the collection accumulates months of
history; the partial filter means rows leave the index the moment they stop being
interesting, so the index stays small forever and stays hot in cache. The catalog
filters are worthwhile economies; that one is the difference between a queue that
degrades over months and one that does not.

**★ An index is partial on `status: 'approved'` and a query filters
`status: {$in: ['approved', 'pending']}`. Will it be used?**
No. The query asks for a superset of what the index contains, so using it would
return an incomplete result and MongoDB declines. The rule runs one way only: a
query may narrow relative to the index's filter, never widen. The mirror case — an
index partial on the `$in` and a query on `'approved'` alone — is fine, because
that query wants a subset of the indexed documents.

**★ How is a partial index different from a sparse index, and which should you
reach for?**
Sparse indexes include or exclude documents solely on the presence of the indexed
field. Partial indexes take a filter expression that can reference fields *other*
than the index key and can test conditions other than existence. Partial is
strictly more expressive, the two options cannot be combined, and the Manual
recommends partial for precise control. A sparse index is exactly
`partialFilterExpression: {field: {$exists: true}}` written in the older
vocabulary, so there is no reason to use `sparse` in new code.

**★ What does a partial index tell a reader that a plain index does not?**
The query. `{productId: 1, createdAt: -1}` says the app reads reviews by product,
newest first. Adding `partialFilterExpression: {status: 'approved'}` says it reads
*approved* reviews by product, newest first — a complete statement of the access
pattern in one declaration. That documentation value is worth more in MongoDB than
in Postgres, because there is no schema file listing collections and constraints:
the index list is the schema documentation, and the partial filter is the part of
it that records intent rather than mechanism.

---

← Prev: [Unique indexes](03-unique-and-partial.md) ·
Next → [Collation](04-collation-and-case.md)
