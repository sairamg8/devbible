---
title: "$lookup always returns an array because it is a left outer join, and the shortest way to flatten it quietly turns the join into an inner one"
sidebar_label: "16 · The join's shape"
sidebar_position: 16
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-02 against the **MongoDB Manual (8.0)** —
> [`$lookup`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/lookup/)
> (*"Performs a left outer join to a collection in the same database"*; *"The
> `$lookup` stage adds a new array field to each input document. The new array
> field contains the matching documents from the foreign collection"*),
> [`$unwind`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/unwind/)
> (`preserveNullAndEmptyArrays`),
> [`$arrayElemAt`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/arrayElemAt/),
> [`$ifNull`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/ifNull/),
> [`$in` (query)](https://www.mongodb.com/docs/manual/reference/operator/query/in/).
> Counterpart:
> [02·06 — hydrating references](../02-the-catalog/04b-hydrating-references.md).
> Spine: **MongoDB 8.0** (8.2 minor) · driver **`mongodb` 7.5.0** · **Node 24 LTS**.

**[Chunk 15](06-lookup-and-why-mostly-you-dont.md) placed the stage and indexed
it. This chunk is about what comes out and what to do with it — which sounds like
plumbing and contains the chapter's most consequential one-character bug. The
stage is a **left outer** join, so it always adds an array, and the array is empty
when nothing matched. The three ways to flatten that array are not equivalent:
one of them silently discards exactly the rows the left join was there to keep,
and the resulting panel disagrees with every other panel on the same screen.**

## The output is always an array

> *"The `$lookup` stage adds a new array field to each input document. The new
> array field contains the matching documents from the foreign collection."*
> — [`$lookup`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/lookup/)

Even for a one-to-one join on `_id`. There is no "single document" mode, because
the general case is one-to-many and the stage does not know which case you are
in. So every `$lookup` is followed by a flattening step, and there are three:

```js
{$set: {user: {$arrayElemAt: ['$user', 0]}}}                       // keeps non-matches
{$unwind: {path: '$user', preserveNullAndEmptyArrays: true}}       // same, verbosely
{$unwind: '$user'}                                                 // DROPS non-matches
```

The third one is the trap. `$lookup` is a **left outer** join — a customer whose
user document was hard-deleted still appears, with `user: []` — and a bare
`$unwind` then removes exactly those rows, silently converting the left join into
an inner join.

On the top-customers panel that means a departed customer's spend vanishes from
the report while remaining in the overview panel's revenue total, so two numbers
on the same screen disagree by an amount that is invisible until someone adds
them up. Nothing errors, and the discrepancy is proportional to how long the
store has been running.

`$arrayElemAt` on an empty array yields **missing**, not `null`, which is why the
projection uses `$ifNull` rather than a comparison:

```js
{$set: {user: {$arrayElemAt: ['$user', 0]}}},
{$project: {…, email: {$ifNull: ['$user.email', '(deleted user)']}}},
```

That chain — lookup, take first, default — is the shape to memorise. The
`'(deleted user)'` label is a product decision made visible in the pipeline,
which is better than the same decision being made implicitly by a missing
`preserveNullAndEmptyArrays`.

## History and current values on the same row

A joined field is a **current** value. The rest of the row, for anything read out
of `orders.items[]`, is **history**. Putting them side by side without saying so
produces a report whose columns describe different moments.

The concrete case: `orders.items[].name` is the product name at the time of the
order; a name fetched by `$lookup` from `products` is today's. A product renamed
last month shows one name if the report reads the snapshot and another if it
joins. Both are defensible; a table with both and no labels is not.

The fix is naming, in the projection:

```js
{$project: {
  nameAtOrder:  '$items.name',              // history — the snapshot
  currentName:  '$product.name',            // today — the join
}}
```

If only one is wanted, the choice follows from the report's purpose: a sales
report is about what was sold, so it reads the snapshot and needs no join at all;
a catalog-health report is about what exists now, so it reads `products` and
should not be built on `orders` in the first place.

## Cross-database is not available

The Manual says *"to a collection in the same database"*. There is no
cross-database `$lookup`, which matters for this app only as a boundary
statement: an analytics store, if one ever exists, is not joinable from here, and
the answer would be the same as it was in Phase 1 — the
[outbox](../01-modeling-the-store/04-what-stays-a-collection.md) relaying into
whatever the other system reads.

## `$lookup` versus `$in`, for hydration

The catalog faced the same choice in
[02·06](../02-the-catalog/04b-hydrating-references.md) and answered it the other
way: fetch the ids, then one `find({_id: {$in: ids}})` in the repository.

| | `$lookup` | `$in` in the repository |
|---|---|---|
| Round trips | one | two |
| Consistency | one point in time | two reads, may disagree |
| Server work | per input document | one indexed multi-key fetch |
| Result shape | joined, ready | two lists to zip in JS |
| Projection | needs an inner `pipeline` | ordinary `find` projection |
| Readability | pipeline grows | pipeline stays about aggregation |

For ten customers after a `$limit`, `$lookup` wins on simplicity and consistency
and the cost difference is invisible. For hydrating a page of twenty-four catalog
cards the catalog went the other way, because the hydration was a *different*
concern from the query and keeping it in the repository kept the pipeline
readable.

Neither is a rule. The one thing that is a rule: **whichever you choose, the
number of foreign documents fetched must be bounded by the page, not by the
collection.** A `$lookup` after a `$limit` is bounded. A `$in` built from the ids
of a page is bounded. A `$lookup` before the `$group` is not, and neither is a
`find` whose `$in` array came from an unbounded result.

## Gotchas

**★ A bare `$unwind` after `$lookup` turns a left join into an inner join.** Rows
with no match have an empty array and `$unwind` drops them. Use `$arrayElemAt`, or
`$unwind` with `preserveNullAndEmptyArrays: true`, and decide deliberately what a
missing foreign document should render as. The symptom is two panels on the same
dashboard disagreeing about a total.

**★ `$arrayElemAt` on an empty array yields missing, not `null`.** So
`{$eq: ['$user', null]}` is true for it (missing and null compare equal) but
`$user.email` is missing rather than null, and a `$project` that includes it
simply omits the field. `$ifNull` handles both cases; an equality check on the
parent does not.

**★ The joined field is a current value and the snapshot is history.** Mixing
them on one row without naming which is which produces a report where two columns
describe different moments. Name them `nameAtOrder` and `currentName`, or pick
one and say why.

**★ `$lookup` cannot cross databases.** *"to a collection in the same database"*.
Not a limitation this app hits, and a hard boundary to know before designing
around it.

**★ `$lookup` inside a `$facet` branch is legal and multiplies by the branch
count.** Nothing stops it, and each branch that does it pays the per-document
cost independently over the same input. Hoisting it above the `$facet` is worse,
because cardinality is highest there. Usually the right answer is that only one
panel needed the join, and that panel should be its own pipeline.

**★ Deleted users are not the same as soft-deleted users.** This app soft-deletes
(`users.deletedAt`), so the lookup *does* find the document and the email is
present. Excluding those is an inner `$match` in the lookup's pipeline — and
whether the panel should show a departed customer's historical spend is a product
question with a defensible answer either way. It should not be decided by
whichever `$unwind` spelling somebody typed.

**★ A `$lookup` on a one-to-many relationship makes the array grow with the
data.** `$lookup` from `products` into `reviews` puts every review on the product
document, in memory, before any stage can reduce it. The pipeline form with an
inner `$limit` or `$count` is the bounded version — join to a *number* of reviews,
not to the reviews.

**★ Zipping two lists in JavaScript needs a `Map`, not a nested `find`.** The
`$in` alternative is only cheaper than `$lookup` if the join in the API layer is
a hash join. `results.map(r => users.find(u => u._id.equals(r.userId)))` is
quadratic and reintroduces the cost the single query saved — and `ObjectId`
comparison needs `.equals()` or a string key, because two `ObjectId` instances
holding the same bytes are not `===`.

## Interview questions

**★ `$lookup` returns an array even for a one-to-one join. Why, and what is the
correct way to flatten it?**
Because `$lookup` is a left outer join and the general case is one-to-many: the
array is the set of matching foreign documents, and it is empty when there is no
match. Flatten with `{$arrayElemAt: ['$field', 0]}` or with `$unwind` and
`preserveNullAndEmptyArrays: true`, both of which keep the non-matching rows. A
bare `$unwind` drops them, which converts the left join into an inner join and
makes the panel's totals disagree with every other panel on the screen.

**★ When would you hydrate with `$in` in the repository instead of `$lookup`?**
When the hydration is a separate concern from the query and keeping it out of the
pipeline keeps the pipeline readable — which is the call
[02·06](../02-the-catalog/04b-hydrating-references.md) made for the catalog. The
trade is one extra round trip and a second read that may see a different instant,
against a simpler pipeline and an ordinary projection. For a small bounded set
after a `$limit`, `$lookup` is simpler and consistent. The invariant either way is
that the number of foreign documents fetched is bounded by the page rather than
by the collection.

**★ A report shows total revenue of X on one panel and the customer spends sum to
less than X on another. What do you check first?**
The flattening after the `$lookup` on the customers panel. A bare `$unwind`
converts the left outer join into an inner join, so every order belonging to a
customer whose user document is gone drops out of that panel while remaining in
the revenue total. The difference is exactly the spend of users who no longer
have documents, which grows over time and is zero on a fresh database — so it
passes every test written before the first hard delete.

**★ Your report needs both the product's name at order time and its name today.
How do you express that?**
Read the first from `orders.items[].name` — the snapshot the order document
already carries — and the second from a `$lookup` into `products`, and give them
different field names in the projection. The important part is that these are two
different facts, not two spellings of one, and a report that shows one under an
ambiguous label will be misread the first time a product is renamed. If only one
is needed, the report's purpose picks it: sales reports read history, catalog
reports read the catalog.

**★ Why is a `$lookup` from `products` into `reviews` risky in a way that a
lookup into `users` is not?**
Cardinality. The `users` join is one-to-one, so the array added to each document
has at most one element. The `reviews` join is one-to-many and unbounded: a
popular product's entire review history is materialised into an array on one
document, in memory, before any later stage can reduce it — and the document has
a 16 MiB ceiling if it ever reaches the output. The bounded form uses the
pipeline variant with an inner `$count` or `$limit`, so the join produces a number
or a page rather than a collection.

---

← Prev: [`$lookup`](06-lookup-and-why-mostly-you-dont.md) ·
[Overview](README.md) ·
Next → [Limits and materialisation](07-limits-and-materialisation.md)
