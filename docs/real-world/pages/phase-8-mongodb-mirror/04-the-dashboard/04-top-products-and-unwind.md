---
title: "$unwind is the join fan-out with a different name, and every order-level aggregate below it is multiplied by the basket size"
sidebar_label: "11 · $unwind"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-02 against the **MongoDB Manual (8.0)** —
> [`$unwind`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/unwind/)
> (*"Deconstructs an array field from the input documents to output a document
> for each element"*; *"If you specify a path for a field that does not exist in
> an input document or the field is an empty array, `$unwind`, by default,
> ignores the input document and will not output documents for that input
> document"*),
> [`$topN`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/topN/)
> (*"`n` has to be a positive integral expression"*; the 100 MB per-group limit),
> [`$firstN`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/firstN/),
> [`$sortByCount`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/sortByCount/).
> Concept home:
> [MongoDB 6·05 — `$sort`, `$limit`, `$skip`](../../../../mongodb/pages/phase-6-aggregation/05-sort-limit-skip.md).
> Spine: **MongoDB 8.0** (8.2 minor) · driver **`mongodb` 7.5.0** · **Node 24 LTS**.

**Phase 1 got line items by joining `order_items` to `orders`, and Phase 1's
gotcha list did not mention fan-out because the join was in a CTE whose only
aggregates were per-product. Move the same query to MongoDB and `$unwind` puts
the fan-out right next to the order-level fields, where it is one line away from
multiplying the revenue by the average basket size. This chunk is about that
trap, about the documents `$unwind` silently drops, and about where in the
pipeline the stage may safely go. The accumulators that answer "top N" without a
second pass — `$topN`, `$firstN`, `$sortByCount` — are
[chunk 12](04b-top-n-accumulators.md).**

## What `$unwind` does

> *"Deconstructs an array field from the input documents to output a document for
> each element. Each output document is the input document with the value of the
> array field replaced by the element."*
> — [`$unwind`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/unwind/)

An order with three line items becomes three documents. Each carries **the whole
order** — `_id`, `userId`, `status`, `createdAt`, `totalCents` — with `items`
replaced by one element rather than the array.

That last clause is the entire problem. `totalCents` is now present three times.

## The fan-out, shown

```js
// WRONG — revenue is multiplied by the number of line items per order
{$match: {createdAt: {$gte: from, $lt: to}, status: {$in: REVENUE_STATUSES}}},
{$unwind: '$items'},
{$group: {
  _id: '$items.productId',
  units:        {$sum: '$items.qty'},        // correct: per line item
  orderRevenue: {$sum: '$totalCents'},       // WRONG: per line item, ×basket size
}},
```

`units` is right — `qty` genuinely belongs to the line item. `orderRevenue` is
wrong by a factor equal to the average number of line items per order, and it is
wrong *upward*, so it looks like the store is doing well.

The correct line-item revenue is computed from line-item fields:

```js
revenueCents: {$sum: {$multiply: ['$items.qty', '$items.unitPriceCents']}},
```

`unitPriceCents` is the price snapshot from
[chapter 01·04](../01-modeling-the-store/03-the-order-document.md). Using it
rather than today's `products.priceCents` is the same decision Phase 1 made and
for the same reason: history must not drift with the price list.

**The rule to carry:** after an `$unwind`, the document no longer represents an
order. It represents a line item. Every accumulator has to be re-read with that
in mind, and the ones that reference order-level fields are the suspects.

Sum-of-order-totals and per-product revenue therefore cannot share a `$group`.
They can share a pipeline via `$facet` ([chunk 13](05-facet-and-one-round-trip.md)),
where one branch unwinds and the other does not.

## What `$unwind` drops

> *"If you specify a path for a field that does not exist in an input document or
> the field is an empty array, `$unwind`, by default, ignores the input document
> and will not output documents for that input document."*

Missing field, `null`, empty array — all three produce **no output document at
all**. So an order with `items: []` disappears from every downstream count. A
`{$sum: 1}` after an `$unwind` counts line items and silently excludes empty
orders from the denominator of anything.

This app should never have an order with no items — the checkout transaction
([chapter 03](../03-checkout-with-transactions/02-the-transaction.md)) writes the
items and the order together, and the validator requires the array. Which is
exactly why the behaviour is worth knowing: the day it *does* happen, the
dashboard will not report it, and the discrepancy will show up as "the order
count on the overview panel does not match the order count on the products
panel".

The option that keeps them:

```js
{$unwind: {path: '$items', preserveNullAndEmptyArrays: true}},
```

*"If `path` is missing or is an empty array, `$unwind` omits the output field
from the output document"* while still emitting the document; if the value is
`null`, the field stays `null`. For a top-products panel that is not what you
want — an empty order contributes nothing to product revenue and would `$group`
under a `null` `_id`. For a reconciliation query it is exactly what you want.

`includeArrayIndex: 'i'` adds the element's position, which is `null` for
non-array and preserved-empty inputs. It is the only way to recover "this was the
second line on the order" after unwinding, and it is occasionally the difference
between a debuggable report and a mystery.

One asymmetry to note: **`$unwind` on a non-array value passes it through as a
single-element array**, whereas `$filter` and `$size` error on the same input.
`$unwind` is the forgiving one, which is not always a favour.

## Where `$unwind` goes in the pipeline

Below the indexed `$match`, always. An `$unwind` at the top of a pipeline is a
collection scan that also multiplies the collection, which is the worst
combination available. Above the `$match` there is no index; below it the fan-out
applies only to the documents that survived the filter.

And below any order-level aggregate you still need. The pattern that keeps both:

```js
{$match: {…}},                       // indexed, once
{$facet: {
  overview:    [{$group: {_id: null, orders: {$sum: 1},
                          revenueCents: {$sum: '$totalCents'}}}],
  byProduct:   [{$unwind: '$items'}, {$group: {…}}, {$sort: …}, {$limit: 20}],
}},
```

Which is [chunk 13](05-facet-and-one-round-trip.md)'s subject, and is the one
place where `$facet`'s "same input documents to every sub-pipeline" property is
exactly what you want rather than a limitation.

## Gotchas

**★ Any accumulator over an order-level field below an `$unwind` is multiplied by
the basket size.** `{$sum: '$totalCents'}` after unwinding a three-line order
counts that order's total three times. The number is plausible, it is wrong
upward, and it scales with average basket size — so it looks like growth. This is
the SQL join fan-out with a shorter name.

**★ `$unwind` drops documents with a missing, null or empty array.** No error, no
warning, no output document. An order with `items: []` vanishes from every count
downstream, and the symptom is two panels on the same dashboard disagreeing about
the order count.

**★ `preserveNullAndEmptyArrays` keeps the document but removes the field.** The
Manual: if `path` is missing or an empty array, the stage *"omits the output
field from the output document"*. So a following `$group` on `$items.productId`
buckets those documents under `null` — you kept the order and invented a product.
Filter them out explicitly after preserving, or do not preserve.

**★ `$unwind` on a non-array passes it through; `$filter` and `$size` error.**
Three operators over the same field with three different tolerances for bad data.
`$unwind`'s forgiveness means a document whose `items` was accidentally written
as an object rather than an array flows through and groups under a nonsense key.

**★ An `$unwind` above the `$match` is a scan and a multiplication.** The index is
only reachable at the top of the pipeline, and `$unwind` is the one stage that
makes the stream *larger* — putting it first maximises the number of documents
every later stage has to touch.

**★ `$unwind` on a nested path unwinds one level.** `$unwind: '$items'` gives one
document per item; if items themselves held arrays, a second `$unwind` is
required and the multiplication compounds. This app has no such nesting today,
and the day a `items[].options[]` array appears the report's cardinality changes
without the report changing.

## Interview questions

**★ What does `$unwind` do to the meaning of a document, and what has to be
re-checked afterwards?**
It changes the document's referent: before the stage a document is an order,
after it a document is a line item that happens to carry a copy of its order's
fields. Everything downstream has to be re-read against that. Accumulators over
line-item fields (`qty`, `unitPriceCents`) are correct; accumulators over
order-level fields (`totalCents`, `$sum: 1` as an order count) are multiplied by
the basket size. It is exactly the SQL join fan-out, and the reason it catches
more people here is that in SQL the multiplied columns come from a different
table and are visibly on the other side of a join.

**★ An order with an empty `items` array — what does the top-products pipeline
report about it?**
Nothing at all. `$unwind` by default emits no document for a missing field, a
null, or an empty array, so the order leaves the pipeline entirely. If a panel
elsewhere counts orders without unwinding, the two panels disagree, and the
difference is exactly the number of empty orders. `preserveNullAndEmptyArrays`
keeps the document but strips the field, which then groups under `null` — so
preserving without a subsequent filter trades a missing row for a fictional
product.

**★ Where does `$unwind` belong relative to `$match`, and why is it not just a
performance preference?**
Below the `$match`, because the index is only reachable by the stages at the top
of the pipeline and because `$unwind` is the one stage that makes the stream
bigger. Putting it first means scanning the collection *and* multiplying it
before any filter has run, so every subsequent stage sees basket-size times the
collection. It is a performance rule that turns into a correctness rule the
moment a stage has a memory limit — which every stage does, at 100 megabytes.

**★ Why can a top-products panel and an order-count panel not share a
`$group`?**
Because they need documents at different granularities: one row per line item and
one row per order. A single pipeline can only be at one granularity at a time
below an `$unwind`. The way to keep both in one round trip is `$facet`, whose
sub-pipelines each receive the same input documents and can then diverge — one
branch unwinding, one not — which is the one situation where `$facet`'s
same-input rule is a feature rather than a constraint.

---

← Prev: [Share and `$shift`](03c-share-and-shift.md) ·
[Overview](README.md) ·
Next → [Top-N accumulators](04b-top-n-accumulators.md)
