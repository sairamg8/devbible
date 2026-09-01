---
title: "Denormalisation with a budget: the category on the product, and the three questions every copy must answer"
sidebar_label: "10 · Denormalisation & staleness"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **MongoDB Manual (8.0)** —
> [Embedding vs. References](https://www.mongodb.com/docs/manual/data-modeling/concepts/embedding-vs-references/)
> (data *"sensitive to staleness"* is *"data that requires frequent updates to
> ensure that all occurrences of the data are consistent"*),
> [`$lookup`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/lookup/)
> (*"will likely have poor performance if a supporting index on the `foreignField`
> does not exist"*),
> [Atomicity and Transactions](https://www.mongodb.com/docs/manual/core/write-operations-atomicity/).
> Spine: **MongoDB 8.0** (8.2 minor) · driver **`mongodb` 7.5.0** · **Node 24 LTS**.

**Two fields in the product document are copies of data that lives elsewhere:
`category`, copied from the `categories` collection, and `rating`, derived from
the `reviews` collection. Both exist so the app's hottest query — the catalog
grid — reads exactly one collection. Neither is free, and the cost is not
storage: a copy has an **owner**, a **repair path** and a **staleness budget**,
and a field that cannot name all three is a bug waiting for its first rename.
This chunk covers the category copy and the general rule;
[chunk 11](07b-the-rating-summary.md) covers the derived aggregate, which is a
different species with a different failure mode.**

## The rule, first

Every denormalised field must answer three questions, and one that cannot answer
all three does not go in the document:

1. **Who owns the truth?**
2. **What repairs the copy, and is that repair idempotent?**
3. **How stale may it be before someone cares, and who decided that number?**

Applied to the fields this model actually has:

| Field | Owner | Repair | Budget |
|---|---|---|---|
| `products.category.name` | `categories` | Fan-out `updateMany` on rename | Seconds |
| `products.rating` | derived from `reviews` | Recompute on approval + nightly sweep | Minutes |
| `orders.items[].unitPriceCents` | **nobody** | **none — must never be repaired** | **∞** |
| `orders.items[].name` | **nobody** | **none — must never be repaired** | **∞** |

The bottom two rows are why [chunk 4](03-the-order-document.md) exists as its own
chunk. **A denormalised field whose repair path is "never touch it" is not a
cache of somebody else's data — it is original data that happens to have been
copied from somewhere**, and it belongs in a different mental category entirely.
Confusing the two is how a well-meaning consistency job rewrites history.

## The category, an extended reference

```js
// inside a product document
category: {_id: ObjectId("..."), slug: "desks", name: "Desks"},
```

The Manual calls this the **extended reference** pattern — the reference plus the
few fields the reader actually needs — and
[MongoDB 3·06](../../../../mongodb/pages/phase-3-schema-design/06-extended-reference.md)
covers the mechanism. What this chunk supplies is why it is here rather than a
`$lookup`.

The [catalog query](../../phase-1-database/04-the-catalog-query.md) *filters* by
category slug and *displays* the category name. Without the copy, every catalog
page is a `$lookup` into `categories` — which the Manual warns *"will likely have
poor performance if a supporting index on the `foreignField` does not exist"*,
and which even indexed runs once per input document. Worse, the filter would have
to resolve the slug to an id first, so the pipeline becomes lookup-then-match
instead of match-on-an-index, and the compound keyset index that
**chapter 05** *(not written yet)* builds stops applying at all.

The three answers:

- **Owner.** The `categories` collection. The copy is derived, never authored.
- **Repair path.** A fan-out `updateMany` on rename, below — idempotent.
- **Staleness budget.** Seconds. A renamed category shows its old name on product
  cards until the fan-out completes.

Only `name` is actually stale-able. `_id` is immutable, and `slug` is a
unique-indexed public identifier the app treats as immutable too — changing a
slug is a new URL and a redirect, a deliberate and admin-visible act. The copy
therefore has exactly one volatile field, which is what keeps the budget small.

```js
// db/mongo/categories.js — the rename, and its fan-out
export async function renameCategory(db, categoryId, name) {
  await db.collection('categories').updateOne({_id: categoryId}, {$set: {name}});
  const res = await db.collection('products').updateMany(
    {'category._id': categoryId},
    {$set: {'category.name': name}},
  );
  return {productsUpdated: res.modifiedCount};
}
```

Two properties of that `updateMany` decide how it must be operated.

**It is not atomic.** The Manual: a multi-document write modifies each document
atomically but *"the operation as a whole is not atomic"*, and *"other operations
may interleave"*. During the fan-out, some cards show the old name and some the
new.

**It is idempotent**, because it sets an absolute value rather than adjusting a
relative one, so a crash halfway is repaired by running it again. That
combination — non-atomic but idempotent — is the shape every denormalisation
repair should have, and it is the reason `$set` to a computed absolute beats any
incremental maintenance.

For a category with six figures of products the fan-out is a long-running write
and belongs in a
[background job](../../phase-2-node-services/05-scheduled-jobs.md), with the
category document itself updated immediately so the source of truth is never
behind its copies.

## What is deliberately not denormalised

Absences are decisions, and each of these was considered and rejected for a
different reason.

**`stock` is not copied anywhere.** It changes on every checkout, so any copy is
stale within seconds — and the copy would be read to make a purchasing decision,
which is the worst possible combination of volatility and consequence. The
catalog's `in_stock` boolean is computed from the product document at read time,
in the mapper, exactly as it was in Postgres.

**The cover image is not copied into the cart.** The cart page shows thumbnails,
which tempts a `coverKey` on each cart line. But a cart is short-lived, its
products are looked up at checkout anyway, and a stale thumbnail is visible to
the one person who least wants surprises. The cart page fetches what it needs
with one `find({_id: {$in: ids}})` — one round trip for the whole cart, which is
the number that matters.

**The user's display name is not copied into reviews.** Reviews render an author
name and copying it would remove a lookup — but a display-name change must
propagate (users expect it to), reviews are unbounded per user, and the fan-out
would be both large and frequent. Extended references are for data that is small,
hot and *rarely* changing; profile fields fail the third test.

## Gotchas

**★ Denormalised fields used for *filtering* must be the immutable ones.** The
catalog filters on `category.slug` and displays `category.name`, and that is not
an accident: during a rename fan-out the display flickers between old and new,
which is harmless, whereas a filter on a mid-fan-out field would make products
vanish from their own category page. Volatile copies are display-only; filters
bind to the copy's immutable fields.

**★ A fan-out over a large collection inside a request will time out.** A
category with 100,000 products is a job, not an admin round trip. The source
document is updated immediately and the copies follow, which means the system is
briefly inconsistent *by design* — and the alternative, holding the request open,
is inconsistent anyway, just with a worse experience and a timeout at the end.

**★ Denormalising to avoid a `$lookup` you have not measured is speculation.**
The copies here are justified by one specific query on one specific page: the
catalog grid, which runs on every browse and returns 24 documents. A `$lookup` on
the *product detail* page — one document, already cached for a minute — would be
entirely acceptable. The pattern is not "avoid lookups", it is "avoid lookups on
the hot path", and which path is hot is a fact about the app, not about MongoDB.

**★ An extended reference makes the referenced collection harder to change.**
Adding a field to `categories` that product cards need is now a backfill across
`products`, not a schema change in one place. The copy is small on purpose —
`_id`, `slug`, `name` — because every field added to it is a field the fan-out
must maintain forever, and the fourth field is always the one added without
updating the rename path.

**★ `updateMany` reports `modifiedCount`, and zero is ambiguous.** Renaming a
category to the name it already has modifies nothing and returns zero, which is
indistinguishable from "the fan-out matched no products". If the job logs
`modifiedCount` as its success signal, a no-op rename looks like a failure and a
genuinely failed match looks like a no-op. Log `matchedCount` alongside it.

**★ Every denormalised field needs a *detector*, not just a repair.** The repair
job answers "make it right"; nothing answers "is it right" unless you write it.
For the category copy the detector is one `$lookup` from `products` into
`categories` and a `$match` on name inequality — cheap enough to run nightly and
the only thing that will tell you the rename path was bypassed by a script.

## Interview questions

**★ Why is `category` copied onto every product when there are only a few dozen
categories that would fit in application memory?** They would, and an in-process
category cache is a legitimate alternative. The copy wins because of the
*filter*, not the display: with the copy, "products in this category" is an
indexed equality predicate on `category.slug` that composes into the same
compound index as the sort, so filter and sort are served by one index scan.
Resolving the slug to an id in application code first works for the filter but
leaves the query's correctness depending on a second source of truth, where a
cache miss or a stale entry produces a wrong result set rather than a stale
label. Copying puts the filter and the sort in one index in one collection.

**★ Three things must be nameable for any denormalised value. What are they, and
what breaks when one is missing?** Owner, repair path, staleness budget. Missing
owner means two places can author the value and they will diverge with no way to
adjudicate. Missing repair path means the first inconsistency is permanent — the
`$inc` failure that [chunk 11](07b-the-rating-summary.md) is built around.
Missing budget means nobody agreed how stale is acceptable, so the first support
ticket becomes an argument instead of a decision, and it is resolved by someone
making the write synchronous and slow.

**★ `orders.items[].name` is a copy of `products.name`. Why does it not appear
in this chunk's maintenance story at all?** Because it is not a copy in the same
sense. It has no owner — it is an assertion about what was bought at the moment
it was bought — and its repair path is explicitly *never repair it*.
Denormalised display data and immutable historical data look identical in the
document and must never be treated the same: a consistency job that refreshes the
first would destroy the second. That is why the order is argued in its own chunk,
and why the invariant is written as a comment next to the array, where a future
maintainer will actually encounter it.

**★ When is `$lookup` the right answer in this app?** On reads that are neither
hot nor repeated. The product detail page fetches one document and is cached for
a minute, so joining its approved reviews — or, more simply, issuing a second
`find` — costs once per cached minute rather than 24 times per browse. The
**dashboard** *(not written yet)* uses `$lookup` freely for the same
reason: it runs on demand for one admin. Denormalisation buys latency on the hot
path and costs maintenance forever; spending it anywhere else is a bad trade.

**★ A category is renamed and, an hour later, some cards still show the old name.
What went wrong and how do you find out?** Either the fan-out job failed partway,
or the rename path updated only the `categories` document — a script, an admin
tool, or a migration that bypassed `renameCategory`. The diagnostic is the
detector: one aggregation joining products to their category and matching where
`category.name` differs from the source. The general lesson is that a
denormalised field without a detector has no observable health, and the detector
is almost always one `$lookup` and a `$match` on inequality.

**★ Is denormalisation a MongoDB thing?** No, and treating it as one is how it
gets over-applied. Postgres has materialised views, summary columns maintained by
triggers, and the same three questions apply to each. What MongoDB changes is the
*default*: the absence of cheap joins moves the break-even point, so copies that
would not have been worth it relationally become worth it here. The reasoning is
identical; only the threshold moved.

{/* FOOTER */}
