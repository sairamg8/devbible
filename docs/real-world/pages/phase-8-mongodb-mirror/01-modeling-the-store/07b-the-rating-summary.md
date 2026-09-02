---
title: "The rating summary: recompute, never increment — and why that one rule makes the repair job three lines"
sidebar_label: "11 · The rating summary"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **MongoDB Manual (8.0)** —
> [`$group`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/group/),
> [`$avg`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/avg/),
> [`findOneAndUpdate`](https://www.mongodb.com/docs/manual/reference/method/db.collection.findOneAndUpdate/),
> [Aggregation Pipeline Limits](https://www.mongodb.com/docs/manual/core/aggregation-pipeline-limits/),
> [Partial Indexes](https://www.mongodb.com/docs/manual/core/index-partial/).
> Spine: **MongoDB 8.0** (8.2 minor) · driver **`mongodb` 7.5.0** · **Node 24 LTS**.

**`products.rating` is a copy of nothing. It is a *derivation* — a function of the
`reviews` collection — and that makes it a different animal from the category
copy in [chunk 10](07-denormalization-and-staleness.md). Nobody authors it, no
single document owns it, and repairing it means recomputing rather than copying.
The whole chunk turns on one decision: recompute from source, never increment.
That choice costs one extra query per review approval and buys idempotence,
self-healing, a three-line repair job, and immunity to every double-processing
and missed-decrement bug that `$inc`-maintained counters accumulate.**

## Why it exists at all

```js
// inside a product document
rating: {avg: 4.3, count: 128},        // derived from approved reviews
```

The catalog grid shows stars. Without this field, rendering 24 product cards
means aggregating the `reviews` collection for 24 products on every page of every
browse session — the single most expensive thing the storefront could do, and
precisely the cost the document model was adopted to avoid.

The three answers [chunk 10](07-denormalization-and-staleness.md) demands:

- **Owner.** Nothing. It is a pure function of the approved reviews for one
  product.
- **Repair path.** Recompute from source — on approval, and again in a nightly
  sweep.
- **Staleness budget.** Minutes, and it is a *product* decision rather than an
  engineering one: a review takes hours to clear moderation, so nobody can
  perceive a few minutes more.

## The implementation

```js
// db/mongo/reviews.js — maintain the summary where the event happens
export async function approveReview(db, reviewId) {
  const review = await db.collection('reviews').findOneAndUpdate(
    {_id: reviewId, status: 'pending'},          // the guard: idempotent approval
    {$set: {status: 'approved', approvedAt: new Date()}},
    {returnDocument: 'after'},
  );
  if (!review) return null;                       // already moderated — no-op
  await recomputeRating(db, review.productId);
  return review;
}

// recompute, not increment: the result does not depend on how many times it runs
export async function recomputeRating(db, productId) {
  const [agg] = await db.collection('reviews').aggregate([
    {$match: {productId, status: 'approved'}},
    {$group: {_id: null, avg: {$avg: '$rating'}, count: {$sum: 1}}},
  ]).toArray();

  await db.collection('products').updateOne(
    {_id: productId},
    {$set: {rating: agg ? {avg: agg.avg, count: agg.count}
                        : {avg: null, count: 0}}},
  );
}
```

Three details carry it.

**`{_id: reviewId, status: 'pending'}` in the filter, not a read-then-write.**
This is the same technique the whole model leans on — the Manual's *"include the
expected current value in the update filter"* — and here it makes double-clicking
Approve a no-op instead of a double count. `findOneAndUpdate` returns `null` when
nothing matched, which is the signal.

**The `$group` has `_id: null`.** It collapses the matched reviews to one
document. `$avg` ignores non-numeric values and `$sum: 1` counts documents, so
the pair gives both numbers in one pass over one index range.

**The empty case is handled explicitly.** With no approved reviews the pipeline
returns *no documents at all* — not a document with `count: 0` — so `agg` is
`undefined` and the `$set` must supply the zero shape. Forgetting this is the
classic aggregation-off-by-one: rejecting the last review of a product leaves the
old summary in place forever, because the code path that would have zeroed it
never ran.

## Why not `$inc`

The tempting version is one write instead of two:

```js
// DO NOT — the drift machine
await db.collection('products').updateOne(
  {_id: productId},
  {$inc: {'rating.count': 1, 'rating.sum': rating}},
);
```

It is wrong in three separate ways and each one is fatal on its own.

**It drifts on reprocessing.** If the approval is delivered twice — a retried
request, a re-run job, a change-stream consumer that resumed and replayed — the
count goes up twice. There is no way to detect this, because the counter is the
only record of itself.

**It needs a matching decrement everywhere.** Un-approval, deletion, a GDPR
erasure, an admin rejecting a previously approved review: each needs a
`$inc: {-1}` that someone must remember to write. The approval path is obvious
and gets built; the other four get missed, and every miss leaves the count
permanently one too high.

**It has no repair path short of a rebuild.** Once drifted, the only fix is to
recompute — which is the thing `$inc` was avoiding. So the "optimisation" buys one
query per approval and costs you the recompute anyway, on a worse schedule, after
a support ticket.

Recomputing costs one aggregation over one product's approved reviews, served by
a partial index that **chapter 05** *(not written yet)* builds:

```js
await db.collection('reviews').createIndex(
  {productId: 1, createdAt: -1},
  {partialFilterExpression: {status: 'approved'}},
);
```

Because that index is partial, it holds only approved reviews and stays small no
matter how much moderation history accumulates — the same argument Phase 1 made
for the outbox's partial index, applied to a different table.

## The repair job, which is just the same function

```js
// jobs/rebuild-ratings.js — the entire repair path
for await (const p of db.collection('products')
                       .find({}, {projection: {_id: 1}})) {
  await recomputeRating(db, p._id);
}
```

That is what idempotence buys. There is no reconciliation logic, no diffing, no
"which reviews changed since the last run" bookkeeping — just the same function,
run again. It can be interrupted at any point and re-run from the start; it can
run while approvals are happening; and running it more often is never wrong, only
more expensive.

For a large catalog the per-product loop becomes a single pipeline that groups
all reviews at once and writes with `$merge`, which
[chapter 04](../04-the-dashboard/README.md) develops for the dashboard's
materialised summaries. The per-product form is kept here because it is the same
code the approval path uses, and one function with two callers is worth more than
two optimal ones.

## Gotchas

**★ `$inc`-maintained aggregates have no repair path — this is the highest-leverage
rule in the chapter.** They drift, and once drifted there is nothing to compare
against. Recompute-from-source is one extra query and turns every consistency bug
into "run the job again". Any counter you cannot recompute is a counter you
cannot trust.

**★ An empty `$group` returns no documents, not a zero.** Rejecting or deleting
the last approved review of a product leaves `agg` undefined, and code that does
`{$set: {rating: {avg: agg.avg, count: agg.count}}}` throws on `undefined`, while
code that skips the update on empty leaves the stale summary in place forever.
Both failure modes are silent in a product that has reviews; both appear only on
the product that just lost its last one.

**★ Nothing recomputes the rating when a review is deleted unless you wire it
there too.** Approval is the obvious path and always gets built. Deletion,
rejection-after-approval, GDPR erasure and the bulk-moderation tool are the four
that get missed, and each leaves a permanently wrong count. The nightly sweep is
what makes those bugs *temporary* rather than permanent, which is a strong reason
to keep the sweep even after the incremental path is believed correct.

**★ Rounding the average before storing it freezes a display decision in the
data.** `Math.round(avg * 10) / 10` stores 4.3 rather than 4.2857…, which is fine
until the UI wants two decimals or a different rounding rule — and then every
document is wrong and needs a rebuild. Store the exact average and round in the
[response mapper](../../phase-3-express-api/05-catalog-endpoints.md), where a
change is one line and no data moves. The code above stores the exact value for
this reason.

**★ `rating.avg` is `null`, not `0`, for a product with no reviews.** Zero is a
rating; absence is not. Storing `0` sorts unrated products below one-star ones
and makes "average rating" arithmetic wrong the moment anyone aggregates across
products. The mapper renders `null` as "no reviews yet", and a sort by rating
must decide explicitly where nulls go rather than inheriting an accident.

**★ Recomputing inside the approval request adds a round trip to an admin
action, and that is the right place for it.** The alternative — enqueueing the
recompute — adds a queue, a worker path and a window in which the moderator sees
their own action not reflected. The recompute is one indexed aggregation over one
product; pay it inline and keep the sweep as the backstop.

**★ The aggregation is subject to the 100 MB per-stage memory limit like any
other.** For one product's reviews this is never close, but the *bulk* rebuild
form that groups all reviews at once can approach it on a large collection — the
Manual lists `$group` among the stages that can spill to disk, governed by
`allowDiskUseByDefault` and the per-command `allowDiskUse` option. The per-product
loop has no such exposure, which is a second reason to keep it as the default
shape.

## Interview questions

**★ Why recompute the rating instead of incrementing it?** Because increments
have no repair path. An `$inc`-maintained count is the only record of itself, so
once a double-processed approval or a missed deletion has drifted it, nothing can
detect the drift, let alone fix it. Recomputing from the reviews collection is
one indexed aggregation, and it makes the operation idempotent and self-healing:
run it twice, or at an arbitrary later time, and the value is correct regardless
of history. That property is what turns the repair job into three lines instead
of a reconciliation project.

**★ What is the difference between the `category` copy and the `rating` copy, and
why does it matter?** The category is a *duplicate* — there is a document that
owns it, and repair means copying the owner's value again. The rating is a
*derivation* — no document owns it, and repair means recomputing a function over
a whole set. The consequences differ: a duplicate can be repaired by a targeted
fan-out when the owner changes, while a derivation must be recomputed whenever
*any* member of its source set changes, which is why the rating has four write
paths that can invalidate it and the category has one.

**★ The approval endpoint is called twice for the same review. What happens?**
Nothing, twice. The `findOneAndUpdate` filter includes `status: 'pending'`, so
the second call matches no document and returns `null`, and the function exits
before touching the summary. That guard is the same "expected current value in
the filter" technique used for the cart push and the stock decrement — it is the
single most reusable idea in the whole port, and it is what makes almost every
write in this app safe to retry.

**★ Why is the reviews index partial on `status: 'approved'`?** Because the
storefront only ever reads approved reviews, so the index's working set is the
approved subset while the collection accumulates rejected and pending history
forever. A partial index holds only what matches, so it stays proportional to the
data that is actually queried rather than to the table. The trade the Manual is
explicit about: a query that does not contain the filter expression cannot use
the index — so the moderation queue, which reads `status: 'pending'`, needs its
own index and does not get to share this one. That is a feature: the two queries
have genuinely different working sets.

**★ You are asked to make the rating update real-time instead of "within
minutes". What changes?** Almost nothing, and that is the point of having named
the budget. The recompute already happens synchronously on approval, so the
observed staleness is already sub-second for the path that matters; the "minutes"
in the budget covers the *other* paths — deletion, bulk moderation, erasure —
which currently rely on the nightly sweep. Making those real-time means calling
`recomputeRating` from each of them, which is a one-line change per path because
the function is idempotent and has no preconditions. The sweep stays regardless,
because it is the only thing that catches a path nobody remembered.

---

← Prev: [Denormalisation & staleness](07-denormalization-and-staleness.md) ·
[Overview](README.md) ·
Next chapter → [The catalog on MongoDB](../02-the-catalog/README.md)
