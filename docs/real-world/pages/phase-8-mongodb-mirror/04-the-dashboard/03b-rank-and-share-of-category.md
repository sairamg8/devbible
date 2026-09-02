---
title: "rank() OVER (ORDER BY …) ports directly, and the thing that does not port is SQL's habit of never choosing which rank you meant"
sidebar_label: "9 · Rank and share"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-02 against the **MongoDB Manual (8.0)** —
> [`$rank`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/rank/)
> (*"When used with the `$rank` operator, `sortBy` can only take one field as its
> value"*; *"If multiple documents occupy the same rank, `$rank` places the
> document with the subsequent value at a rank with a gap"*),
> [`$denseRank`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/denseRank/),
> [`$documentNumber`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/documentNumber/),
> [`$shift`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/shift/),
> [`$divide`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/divide/),
> [`$setWindowFields`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/setWindowFields/).
> Counterpart:
> [1·09 — dashboard queries](../../phase-1-database/09-dashboard-queries.md).
> Spine: **MongoDB 8.0** (8.2 minor) · driver **`mongodb` 7.5.0** · **Node 24 LTS**.

**Phase 1's top-products query did two things at once: it ranked every product
by revenue, and it put each product's share of its category on the same row.
`rank() over (order by …)` and `sum(…) over (partition by category_id)` both have
exact counterparts here. This chunk builds the whole pipeline and then spends its
length on the half that does not port: SQL lets you write `rank()` without ever
deciding what a tie means, and MongoDB gives you three operators and makes you
name one. [Chunk 10](03c-share-and-shift.md) takes the share-of-category
division and the period-over-period comparison, both of which need a guard SQL
supplied for free.**

## The Postgres original

```sql
select p.name, p.slug, c.name as category, s.units, s.revenue_cents,
       rank() over (order by s.revenue_cents desc) as overall_rank,
       round(100.0 * s.revenue_cents
             / nullif(sum(s.revenue_cents) over (partition by p.category_id), 0), 1)
         as pct_of_category
  from sold s
  join products p   on p.id = s.product_id
  join categories c on c.id = p.category_id
 order by s.revenue_cents desc
 limit 20;
```

Two joins vanish in the port, because
[`orders.items[]`](../01-modeling-the-store/03-the-order-document.md) already
snapshots the product name and slug and
[`products.category`](../01-modeling-the-store/07-denormalization-and-staleness.md)
already carries the category name. That is a decision from chapter 01 paying off,
not a property of MongoDB.

## The pipeline

```js
export function topProductsPipeline({from, to, limit = 20}) {
  return [
    {$match: {createdAt: {$gte: from, $lt: to}, status: {$in: REVENUE_STATUSES}}},
    {$unwind: '$items'},
    {$group: {
      _id: '$items.productId',
      name:        {$first: '$items.name'},
      slug:        {$first: '$items.slug'},
      category:    {$first: '$items.categorySlug'},
      units:       {$sum: '$items.qty'},
      revenueCents:{$sum: {$multiply: ['$items.qty', '$items.unitPriceCents']}},
    }},
    {$setWindowFields: {
      sortBy: {revenueCents: -1},
      output: {overallRank: {$rank: {}}},
    }},
    {$setWindowFields: {
      partitionBy: '$category',
      output: {categoryCents: {$sum: '$revenueCents'}},   // no window => whole partition
    }},
    {$set: {
      pctOfCategory: {$cond: [
        {$gt: ['$categoryCents', 0]},
        {$round: [{$multiply: [100, {$divide: ['$revenueCents', '$categoryCents']}]}, 1]},
        null,                                             // no base — honestly null
      ]},
    }},
    {$sort: {revenueCents: -1}},
    {$limit: limit},
    {$project: {_id: 0, productId: '$_id', name: 1, slug: 1, category: 1,
                units: 1, revenueCents: 1, overallRank: 1, pctOfCategory: 1}},
  ];
}
```

**Two `$setWindowFields` stages, not one.** They could be merged — the stage
accepts several output fields — but only if they share a `partitionBy`, and these
do not: the rank is global and the category total is per category. The Manual
notes you *"can include one or more `$setWindowFields` stages in an aggregation
operation"*, and two stages with different partitions is the ordinary way to say
what SQL says with two different `OVER` clauses on one line.

**The `$limit` comes after the ranks, not before.** A rank computed over twenty
documents is a rank within those twenty, which is only the same thing as the real
rank if the twenty were already the top twenty — and if they were, you did not
need the rank. Same for the category total: limiting first makes
`pctOfCategory` a share of the top twenty rather than of the category.

## Three rank operators, and SQL's habit of not choosing

```
sortBy values:   7    9    9    10
$denseRank:      1    2    2     3      ← no gap
$rank:           1    2    2     4      ← gap where the tie consumed a slot
$documentNumber: 1    2    3     4      ← no ties, position only
```

That table is the Manual's own worked example, restated. The wording:

> *"If multiple documents occupy the same rank, `$rank` places the document with
> the subsequent value at a rank with a gap"*
> — [`$rank`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/rank/)

`$rank` is SQL's `RANK()`, `$denseRank` is `DENSE_RANK()`, `$documentNumber` is
`ROW_NUMBER()`. Which one a dashboard wants is a product question, and the answer
is usually `$rank`: two products that genuinely tied on revenue should both read
"2nd", and the next product being "4th" is the honest consequence.

`$documentNumber` is the one to be careful with. It never ties, which means that
when two documents *do* tie on the sort key, which of them gets the lower number
is decided by whatever order the stage happened to see them in. **A
`$documentNumber` over a non-unique sort is not reproducible between runs.** If
the number is going to be shown to a user or used as a pagination key, the
`sortBy` needs a unique tiebreaker — the same rule
[02·02](../02-the-catalog/02-keyset-pagination.md) established for the catalog,
for exactly the same reason.

Except that `$rank` will not let you add one:

> *"When used with the `$rank` operator, `sortBy` can only take one field as its
> value."*

So `$rank` and `$denseRank` are single-key by construction, and
`$documentNumber` is the operator that accepts a compound `sortBy` and therefore
the only one that can be made deterministic.

## Nulls and missing values get ranked, not skipped

The Manual is explicit, and the behaviour changed recently enough to matter:

> *"Documents with a `null` value for a `sortBy` field or documents missing the
> `sortBy` field are assigned a rank based on the BSON comparison order."*

> *"Starting in MongoDB 8.0, `null` and missing field values in `$denseRank` and
> `$rank` `sortBy` operations are treated the same when calculating rankings. This
> change makes the behavior of `denseRank` and `rank` consistent with `$sort`."*

So a product whose `revenueCents` came out missing — which the `$group` above
cannot produce, but a hand-written pipeline can — does not vanish from the
ranking. It gets a rank, positioned by BSON type ordering, and on 8.0 it shares
that rank with explicit nulls. On 7.0 and earlier the two were ranked
differently, which is a genuine behavioural difference across an upgrade.

## Gotchas

**★ `$limit` before the window stage computes the rank over the wrong set.** The
rank is a property of the whole ranked population; a rank over the first twenty
documents is a rank within those twenty. The same error makes `pctOfCategory` a
share of the top twenty rather than of the category. Rank first, limit last.

**★ Two `OVER` clauses with different partitions need two
`$setWindowFields` stages.** One stage has one `partitionBy` for all its output
fields. Merging a global rank and a per-category total into one stage silently
partitions the rank by category — every category then has its own "rank 1", and
the panel looks almost right.

**★ `$documentNumber` over a non-unique sort is not reproducible.** Ties are
broken by whatever order the stage saw the documents in, which is not specified.
Two runs of the same report can assign different numbers to the same two
products. Add a unique tiebreaker to the `sortBy` — which is possible for
`$documentNumber` and *not* possible for `$rank`, whose `sortBy` accepts only one
field.

**★ `$rank` and `$denseRank` accept exactly one `sortBy` field.** So "rank by
revenue, ties broken by name" is not expressible with `$rank`. If deterministic
tie-breaking is required, the operator is `$documentNumber` with a compound sort,
and you lose the shared-rank semantics.

**★ Nulls and missing sort values are ranked, not excluded, and 8.0 changed how.**
Before 8.0 `null` and missing were ranked differently by `$rank`/`$denseRank`; on
8.0 they are treated the same, consistent with `$sort`. A report that produced
stable ranks on 7.0 can shift by one across the upgrade if any document is
missing the sort field.

**★ Rank operators and `$shift` error if you pass a `window`.** They use an
implicit window by definition. Copying a `window:` line from a neighbouring
`$sum` output field into a `$rank` one is a natural editing slip and the error
names the option rather than the cause.

**★ `$first` inside `$group` picks an arbitrary document unless the stream is
sorted.** `name: {$first: '$items.name'}` is fine here only because the name is
snapshotted per line item and every line item for a product carries the name it
had *at the time of that order*. Two orders placed either side of a rename
therefore hold different names, and `$first` picks whichever the group saw first.
That is a real ambiguity, and the honest fix if it matters is `{$last: …}` over a
`$sort` by `createdAt`, or looking the current name up in `products`
([chunk 12](06-lookup-and-why-mostly-you-dont.md)) and deciding deliberately
whether the report wants history or the catalog.

## Interview questions

**★ Why must the `$limit` come after the window stages rather than before?**
Because a rank and a partition total are properties of a population, and limiting
changes the population. A `$rank` computed after `$limit: 20` ranks those twenty
against each other — which is the identity function on an already-sorted list and
tells you nothing. `pctOfCategory` after a limit is a share of the surviving
twenty, not of the category. The pipeline computes over everything and truncates
last, which is also why this query is expensive and why
[chunk 13](07-limits-and-materialisation.md) discusses materialising it.

**★ `$rank`, `$denseRank`, `$documentNumber` — which does this dashboard want and
why?**
`$rank`, matching SQL's `RANK()`. Two products that tied on revenue should both
read second, and the next one reading fourth is the truthful consequence of two
products occupying second place. `$denseRank` would say third, which implies the
tie did not consume a position. `$documentNumber` would break the tie
arbitrarily, and arbitrarily means differently on different runs unless the sort
is unique — which `$rank` cannot be anyway, since its `sortBy` takes only one
field.

**★ Why does this pipeline need two `$setWindowFields` stages?**
Because a stage has one `partitionBy` shared by all of its output fields, and the
two computations partition differently: the overall rank is over every product,
the category total is over the products in one category. SQL writes this as two
`OVER` clauses on one `select` line, which hides that they are two different
windowings. Merging them into one MongoDB stage does not error — it silently
partitions the rank by category, so every category grows its own rank 1.

**★ `name: {$first: '$items.name'}` — is that safe?**
Only if you have decided what it means. The name is snapshotted on each line item
at order time, so two orders placed either side of a product rename carry
different names, and `$first` returns whichever document the group encountered
first — unspecified without a sort. For a sales report that is arguably fine
(any historical name identifies the thing that sold), but it should be a
decision: `$last` over a `createdAt` sort gives the most recent snapshot
deterministically, and a `$lookup` into `products` gives today's catalog name.
The one thing not to do is leave it ambiguous and be surprised when the report
changes after a rename.

---

← Prev: [Window functions](03-window-functions.md) ·
[Overview](README.md) ·
Next → [Share of category and period-over-period](03c-share-and-shift.md)
