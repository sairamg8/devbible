---
title: "One dashboard panel genuinely needs a join, the other three do not — and the reason is a decision chapter 01 made, not a property of MongoDB"
sidebar_label: "15 · $lookup"
sidebar_position: 15
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-02 against the **MongoDB Manual (8.0)** —
> [`$lookup`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/lookup/)
> (*"Performs a left outer join to a collection in the same database to filter in
> documents from the foreign collection for processing. The `$lookup` stage adds
> a new array field to each input document"*; *"`$lookup` operations that perform
> equality matches with a single join perform better when the foreign collection
> contains an index on the `foreignField`"*; *"The `pipeline` cannot access fields
> from input documents. Instead, define variables for the document fields using
> the `let` option and then reference the variables in the `pipeline` stages"*),
> [`$arrayElemAt`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/arrayElemAt/).
> Counterpart:
> [02·06 — hydrating references](../02-the-catalog/04b-hydrating-references.md).
> Spine: **MongoDB 8.0** (8.2 minor) · driver **`mongodb` 7.5.0** · **Node 24 LTS**.

**Phase 1's top-products query joined four tables. The MongoDB version joins
none, and the reason is worth stating precisely because it is easy to get wrong
in an interview: it is not that MongoDB avoids joins, and it is not that
embedding removed them. It is that
[chapter 01](../01-modeling-the-store/03-the-order-document.md) decided
`orders.items[]` would snapshot the product name, slug and cover key, and
[chapter 01·10](../01-modeling-the-store/07-denormalization-and-staleness.md)
decided `products.category` would carry the category name. Both of those
decisions would have removed the same joins in Postgres. What is left is one
panel — top customers by spend — where the needed field genuinely lives in
another collection, and that panel is what this chunk is for.
[Chunk 16](06b-lookup-shape-and-alternatives.md) takes the shape the stage hands
back and the case for not using it at all.**

## The panel that needs it

`orders` carries `userId` and not an email. "Top ten customers by spend this
month" therefore has to reach into `users`:

```js
export function topCustomersPipeline({from, to, limit = 10}) {
  return [
    {$match: {createdAt: {$gte: from, $lt: to}, status: {$in: REVENUE_STATUSES}}},
    {$group: {_id: '$userId',
              orders: {$sum: 1}, spentCents: {$sum: '$totalCents'}}},
    {$sort: {spentCents: -1}},
    {$limit: limit},                       // ← reduce FIRST
    {$lookup: {
      from: 'users',
      localField: '_id',
      foreignField: '_id',
      as: 'user',
      pipeline: [{$project: {_id: 0, email: 1, deletedAt: 1}}],
    }},
    {$set: {user: {$arrayElemAt: ['$user', 0]}}},
    {$project: {_id: 0, userId: '$_id', orders: 1, spentCents: 1,
                email: {$ifNull: ['$user.email', '(deleted user)']}}},
  ];
}
```

Every line after `$group` is a decision, and the most important one is the
`$limit`.

## Reduce before you join

> *"If your pipeline passes a large number of documents to the `$lookup` query,
> the following strategies may improve performance: Reduce the number of
> documents that MongoDB passes to the `$lookup` query."*
> — [`$lookup`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/lookup/)

`$lookup` executes per input document. A `$lookup` above the `$group` runs once
per **order**; below the `$group` and the `$limit` it runs ten times. Same
result, two orders of magnitude apart, and the difference is stage ordering.

This is the N+1 problem with a pipeline stage in front of it. It does not look
like N+1 — there is no loop in the code, no `await` inside a `for` — but the
server is doing exactly what a naive repository would do, once per document,
and the only reason it is acceptable here is that N is ten.

**The rule: `$lookup` goes as late in the pipeline as the query allows, after
every stage that reduces cardinality.** The only reason to put it earlier is if
the join's result is needed *by* a reducing stage — filtering on a joined field —
and that case is worth restructuring away, usually by denormalising the field
being filtered on.

## The `foreignField` index is not optional

> *"`$lookup` operations that perform equality matches with a single join perform
> better when the foreign collection contains an index on the `foreignField`."*

and, from the same page's warning:

> *"If a supporting index on the `foreignField` does not exist, a `$lookup`
> operation that performs an equality match with a single join will likely have
> poor performance."*

Here `foreignField` is `_id`, which is indexed unconditionally, so this one is
free. It is not free in general: a lookup on `reviews.productId` needs
`{productId: 1}` on `reviews`, and without it every input document causes a
collection scan of `reviews`. Ten input documents, ten scans.

That index belongs in
[chapter 05's list](../05-indexes-and-explain/02-the-index-list.md), derived from this query — which is exactly the method that chapter
insists on: **every index comes from a query somebody wrote.**

## `localField`/`foreignField` versus `let` + `pipeline`

Two forms, and they compose:

```js
// equality form — the common case
{$lookup: {from: 'users', localField: '_id', foreignField: '_id', as: 'user'}}

// pipeline form — a join condition that is not an equality
{$lookup: {
  from: 'reviews',
  let: {pid: '$_id'},
  pipeline: [
    {$match: {$expr: {$and: [
      {$eq: ['$productId', '$$pid']},
      {$eq: ['$status', 'approved']},
    ]}}},
    {$count: 'n'},
  ],
  as: 'approvedReviews',
}}
```

The rule the Manual states, and the one that produces the most confusing
failures:

> *"The `pipeline` cannot access fields from input documents. Instead, define
> variables for the document fields using the `let` option and then reference the
> variables in the `pipeline` stages."*

Inside the sub-pipeline, `$productId` means the **foreign** collection's field
and `$$pid` means the bound local variable. Writing `$_id` inside the pipeline
does not error — it resolves against the foreign document, which has an `_id`, so
the join condition becomes "reviews whose `_id` equals their own `_id`", which is
every review. A join that matches everything is not obviously wrong in the
output; it is just slow and gives inflated counts.

Adding a `pipeline` to the equality form — as the top-customers query does — is
the way to project inside the join. Without it the whole user document travels,
including the password hash, into a stage that then throws most of it away. **A
`$lookup` without a projection is a data-exfiltration shape as much as a
performance one:** the field never reaches the API response, but it does reach
the API process's memory and any log line that dumps the intermediate document.

## Gotchas

**★ `$lookup` before a `$group`/`$limit` runs once per input document.** It is the
N+1 problem with no loop visible in the code. Push the stage as far down the
pipeline as the query allows; the only reason to hoist it is a filter on a joined
field, and that filter usually wants the field denormalised instead.

**★ Without an index on `foreignField`, each input document causes a collection
scan of the foreign collection.** The Manual states it as a warning, not a
tendency. `_id` joins are safe because `_id` is always indexed; every other join
field needs an explicit index, derived from this query.

**★ Inside a `let`/`pipeline` lookup, `$field` is the foreign document and
`$$var` is the local one.** Getting it wrong does not error when the foreign
collection happens to have a field of the same name — it silently changes the
join condition, usually to something that matches far too much.

**★ A `$lookup` without an inner projection ships the whole foreign document.**
For `users` that includes `passwordHash`. It never reaches the response, and it
does reach process memory and any debug log that serialises the intermediate
stage. Project inside the join.

## Interview questions

**★ Phase 1's top-products query joined four tables and the MongoDB version joins
none. Why?**
Not because MongoDB avoids joins, and not because embedding removed them.
Because chapter 01 decided `orders.items[]` snapshots the product name, slug and
cover key, and `products.category` carries the category name — so the fields the
report needs are already on the documents it is reading. Those same
denormalisations would have removed the same joins in Postgres, and Phase 1
already made one of them (`order_items.unit_price_cents`) for exactly the same
reason: history must not drift. The document model made the denormalisation
natural; it did not make the join unnecessary.

**★ Where does `$lookup` belong in a pipeline, and why?**
As late as the query allows, after every stage that reduces cardinality, because
the stage executes per input document. A lookup above a `$group` that collapses
50,000 orders into 200 customers runs 50,000 times instead of 200. The exception
is a lookup whose result is needed by a reducing stage — filtering on a joined
field — and that case is a signal to denormalise the filtered field rather than
to hoist the join.

**★ What is the difference between the two `$lookup` forms, and what is the
classic mistake in the pipeline form?**
The equality form (`localField`/`foreignField`) joins on one field being equal;
the pipeline form takes `let` bindings and an arbitrary sub-pipeline, which is
how you express a join condition that is not a single equality. The classic
mistake is referring to a local field as `$field` inside the sub-pipeline: field
paths there resolve against the *foreign* document, and the Manual is explicit
that the pipeline cannot access input fields. When the foreign collection happens
to have a field of the same name — `_id` always does — the join silently becomes
a self-comparison that matches everything.

---

← Prev: [`$facet` limits and shape](05b-facet-limits-and-shape.md) ·
[Overview](README.md) ·
Next → [The join's shape, and when not to join at all](06b-lookup-shape-and-alternatives.md)
