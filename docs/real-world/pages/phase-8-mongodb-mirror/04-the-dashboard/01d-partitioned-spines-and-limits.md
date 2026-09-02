---
title: "One spine per series, and the ceiling that stops a densification from eating the server"
sidebar_label: "4 · Partitioned spines"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-02 against the **MongoDB Manual (8.0)** —
> [`$densify`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/densify/)
> (`partitionByFields` restrictions; *"`$densify` returns an error if it
> generates more documents than the limit set by the
> `internalQueryMaxAllowedDensifyDocs` parameter. By default, this limit is
> 500,000 documents"*),
> [`$unionWith`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/unionWith/).
> Spine: **MongoDB 8.0** (8.2 minor) · driver **`mongodb` 7.5.0** · **Node 24 LTS**.

**The single-series chart in [chunk 3](01c-densify-and-fill.md) needed no
partition. The moment the dashboard grows a second dimension — revenue by day
*per category*, units by day *per product* — the spine has to be built once per
series, and the stage that does it introduces two things worth understanding
before they bite: a partition is defined by the data, so a series with no data
gets no spine at all, and the number of documents `$densify` manufactures is the
product of the range and the partition count, against a hard 500,000 ceiling.**

## `partitionByFields` is how you get one spine per series

```js
{$unwind: '$items'},
{$group: {
  _id: {day: {$dateTrunc: {date: '$createdAt', unit: 'day', timezone: TZ}},
        category: '$items.categorySlug'},
  revenueCents: {$sum: {$multiply: ['$items.qty', '$items.unitPriceCents']}},
}},
{$set: {day: '$_id.day', category: '$_id.category'}},
{$densify: {
  field: 'day',
  partitionByFields: ['category'],
  range: {step: 1, unit: 'day', bounds: [from, to]},
}},
{$fill: {
  partitionByFields: ['category'],
  sortBy: {day: 1},
  output: {revenueCents: {value: 0}},
}},
{$sort: {category: 1, day: 1}},
```

Three things changed from the single-series version and all three are required.

**`$densify` partitions.** The Manual calls each group *a partition*, and the
gap-filling happens independently inside each one — so a quiet Sunday for
`desks` is filled for `desks` without borrowing anything from `chairs`.

**`$fill` partitions too, with the same key.** They are separate stages with
separate options, and it is entirely possible to densify per category and fill
globally. With `{value: 0}` fills nothing goes wrong, because a constant does
not care which partition it lands in. With a `locf` fill it goes badly wrong:
the "last known value" is then the last known value *across all categories in
sort order*, which is a number from a different series. Keep the two partition
keys identical, and if you can, derive them from one constant.

**`$sort` includes the partition key.** `$densify` does not guarantee output
order at all, and after partitioning that means both the day order *and* the
grouping of a category's documents are arbitrary. The final sort has to name
both fields, in the order the consumer wants to iterate them.

## The restrictions on `partitionByFields`

Worth knowing before you hit them, because two of the three produce errors that
name a field rather than a cause:

- `$densify` errors if any name in the array *"Evaluates to a non-string
  value"*. The array holds **field names**, not expressions — `['category']`,
  not `['$category']`.
- It errors if any name *"Begins with `$`"*, which is the same mistake caught a
  second way.
- New in MongoDB 8.1 — so ahead of this corpus's 8.2 spine and worth stating —
  it errors if `field` *"shares its prefix with any field in the
  `partitionByFields` array"*. That rules out `field: 'timestamp'` with
  `partitionByFields: ['timestamp']` and also with `['timestamp.hours']`, and
  the reverse. On 8.0 the same pipeline was accepted and did something
  ill-defined; the newer error is an improvement you may meet as a
  "why did this stop working after the upgrade".

The `field` restrictions from [chunk 3](01c-densify-and-fill.md) still apply per
partition: all values must be dates or all numeric, and the `unit`/`step` pairing
is checked.

## A partition with no documents gets no spine

This is the limit of what densification can do, and it is structural rather than
incidental. `$densify` partitions **the stream it is given**. A category that
sold nothing at all in the entire window contributes no documents to that stream,
so there is no partition for `$densify` to notice, so there is no spine, so the
category is absent from the chart entirely — not a flat zero line, *nothing*.

The gap-filling stage cannot fix this because the missing information is not in
the orders. It is in `categories`, a collection this pipeline never reads.

The fix is to seed one zero-valued document per category before the
densification, which is what `$unionWith` is for:

```js
// after the $group, before the $set/$densify
{$unionWith: {
  coll: 'categories',
  pipeline: [
    {$project: {_id: 0, day: from, category: '$slug', revenueCents: 0}},
  ],
}},
```

Every category now has at least one document at `from`, so every category has a
partition, so every category gets a full spine. The seed row's own value is `0`
and it sits on the lower bound, which `$densify` treats as inclusive — so the
seed *is* the first bar, not an extra one.

The cheaper alternative, and often the right one: the API layer already has the
category list (it renders the filter menu from it), so it can merge the missing
series in JavaScript after the query. That is the same trade
[chunk 5](01e-fill-and-ordering.md) works through for the single-series case, and
it comes out differently here — the category list is genuinely a different query,
so doing it in Node costs nothing in duplicated logic.

## The document-generation limit

> *"`$densify` returns an error if it generates more documents than the limit set
> by the `internalQueryMaxAllowedDensifyDocs` parameter. By default, this limit
> is 500,000 documents."*
> — [`$densify` — Document Generation Limit](https://www.mongodb.com/docs/manual/reference/operator/aggregation/densify/)

Thirty daily buckets are nowhere near it. A `step: 1, unit: 'second'` densify
over a single day is 86,400 — still fine. Over a year it is 31.5 million, and
the stage errors rather than filling memory, which is the right failure.

**The number that matters is the product.** Per-category daily densification over
a year with forty categories is 14,600 documents. Per-*product* hourly
densification over a year is 8,760 hours times the product count, and it crosses
500,000 at fifty-seven products — a number this store passed before it launched.
The dimension that grows is almost never the one you sized the query against.

The parameter is tunable and tuning it is almost always the wrong move: if a
chart needs half a million points, the chart is wrong. Coarsen the bucket, or
limit the partitions to the top *N* series (`$sortByCount` then `$limit` before
the densification, which is [chunk 8](04-top-products-and-unwind.md)'s pattern),
and densify only those.

## Gotchas

**★ `partitionByFields` takes field names, not expressions.** `['$category']`
errors because the name begins with `$`; `[{$toLower: '$category'}]` errors
because it evaluates to a non-string. If the partition key needs computing,
compute it in a `$set` above the `$densify` and partition by the resulting field
name. Note this differs from `$fill`, which accepts **either** `partitionBy` (an
expression) **or** `partitionByFields` (an array of names), and errors if you
pass both.

**★ Densifying per partition and filling globally is silently wrong with `locf`
and silently fine with `value`.** The two stages have independent partition
options, so the bug only appears when someone later switches a fill from a
constant to a carried-forward value — at which point one series inherits
another's last number. Set both partition keys from the same constant.

**★ A partition with zero documents gets no spine.** `$densify` partitions the
stream it was handed; a category that sold nothing in the whole window
contributes no documents and therefore no partition. "All categories, including
the dead ones" is a `$unionWith` against `categories` or a merge in the API
layer — not a densification option.

**★ The generation limit multiplies across partitions, and the partition count
is the thing that grows.** A query sized against forty categories breaks when
someone repoints it at products. The failure is at least loud — the stage errors
— but it happens in production, on the day the catalog crossed the threshold,
not in review.

**★ The final `$sort` must name the partition key as well as the series key.**
`$densify` disclaims output ordering entirely. Sorting only by `day` gives you
correctly ordered days with the categories interleaved arbitrarily, which a
consumer that groups by walking the array will silently mangle.

**★ `$unionWith` seed rows must project the exact field set the main pipeline
produces.** A seed missing `orders` and a real bucket carrying it produce a
series where some points have the field and some do not — the same
`undefined`-versus-zero problem the spine exists to solve, reintroduced by the
fix for it. Either project every field on the seed, or let the downstream
`$fill` supply the missing ones (it will, because `$fill` fills missing fields,
not just null ones).

## Interview questions

**★ `$densify` returns an error about a document limit. What actually
happened?**
The stage tried to generate more than `internalQueryMaxAllowedDensifyDocs`
documents, 500,000 by default. In practice that means the `step`/`unit`
combination is far finer than the range warrants — per-second densification over
a month, or a numeric `step` of `1` over a range of millions — or that a
partitioned densification is multiplying a reasonable per-partition count by an
unreasonable number of partitions. The fix is essentially never to raise the
parameter: it is to ask whether a chart with half a million points is the right
chart, and to coarsen the bucket or cut the series count first.

**★ How would you produce "revenue by day, per category, including categories
that sold nothing"?**
Densification gets you the first two: group by `(day, category)`, then
`$densify` on `day` with `partitionByFields: ['category']` and explicit bounds.
It cannot get you the third, because a category with no sales contributes no
documents and therefore no partition for `$densify` to fill. That needs the
category list from the `categories` collection — a `$unionWith` producing one
zero-valued seed document per category at the lower bound, or a merge in the API
layer against the list it already has for the filter menu.

**★ Why do `$densify` and `$fill` each have their own partition option, and when
does the duplication matter?**
Because they are independent stages and either can be used without the other —
`$fill` is perfectly useful on a series that has all its documents but some null
values, and that series may want a different partitioning than a densification
would. The duplication matters the moment a fill stops being a constant: a
`locf` fill partitioned differently from the densification carries a value
forward across a series boundary, producing a number that belongs to a different
category and looks entirely plausible.

**★ You need "units sold per day for the top 20 products". Where does the
densification go?**
After the top-20 has been selected, never before. Rank the products first —
group by product, sum units, sort, limit 20 — then re-derive the daily series for
just those twenty and densify with `partitionByFields: ['productId']`. Densifying
first means manufacturing a spine for every product in the catalog, which is the
partition-count explosion the generation limit exists to stop, and then throwing
almost all of it away.

---

← Prev: [`$densify`](01c-densify-and-fill.md) ·
[Overview](README.md) ·
Next → [`$fill`, ordering, and whether to do it in Node](01e-fill-and-ordering.md)
