---
title: "Revenue by day is four stages, and the whole design is about where in the pipeline the index stops being reachable"
sidebar_label: "1 · Revenue by day"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-02 against the **MongoDB Manual (8.0)** —
> [`$facet`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/facet/)
> (*"If the `$facet` stage is the first stage in a pipeline, the stage will
> perform a `COLLSCAN`"*),
> [`$group`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/group/),
> [`$project`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/project/),
> [Limits and Thresholds](https://www.mongodb.com/docs/manual/reference/limits/).
> Concept home:
> [MongoDB 6·02 — `$match` first](../../../../mongodb/pages/phase-6-aggregation/02-match-first.md)
> and [6·04 — `$group`](../../../../mongodb/pages/phase-6-aggregation/04-group-and-accumulators.md).
> Spine: **MongoDB 8.0** (8.2 minor) · driver **`mongodb` 7.5.0** · **Node 24 LTS**.

**The chart on the admin dashboard is a four-stage pipeline, and it is almost a
transliteration of [Phase 1's SQL](../../phase-1-database/09-dashboard-queries.md)
minus the date spine. What is worth slowing down for is not the syntax: it is
that the SQL rule "never wrap the column in a function inside `WHERE`" survives
the port completely intact, wearing different clothes. In SQL the sin was
`date_trunc('day', created_at) = $1`; in MongoDB the equivalent sin is putting
anything at all above the `$match`. Both hide the indexed field from the index.
This chunk builds the pipeline stage by stage and names, for each stage, whether
an index is still in play. The date arithmetic, the money and the status set —
the three places the *numbers* go wrong rather than the plan — are
[chunk 2](01b-dates-money-and-the-status-set.md).**

## The Postgres original, in one line

```sql
select date_trunc('day', o.created_at) as day,
       sum(o.total_cents) as revenue_cents,
       count(o.id)        as orders
  from orders o
 where o.created_at >= $1 and o.created_at < $2
   and o.status in ('paid','shipped','delivered')
 group by 1 order by 1;
```

That is [chapter 09's](../../phase-1-database/09-dashboard-queries.md) query
with the `generate_series` spine removed, because the spine is a separate
problem and gets [its own chunk](01c-densify-and-fill.md). Everything else ports
one-for-one.

## The pipeline

```js
// db/mongo/dashboard.js
const REVENUE_STATUSES = ['paid', 'shipped', 'delivered'];
const TZ = 'Europe/Berlin';                 // the STORE's timezone, not the server's

export function revenueByDayPipeline({from, to}) {
  return [
    {$match: {
      createdAt: {$gte: from, $lt: to},     // half-open, on the RAW field
      status: {$in: REVENUE_STATUSES},
    }},
    {$group: {
      _id: {$dateTrunc: {date: '$createdAt', unit: 'day', timezone: TZ}},
      revenueCents: {$sum: '$totalCents'},
      orders:       {$sum: 1},
    }},
    {$sort: {_id: 1}},
    {$project: {_id: 0, day: '$_id', revenueCents: 1, orders: 1}},
  ];
}
```

Four stages, and each one is a decision.

## `$match` first, because it is the only stage an index can serve

The Manual never says "only the first stages use indexes" in those words, but it
says it operationally, on the `$facet` page:

> *"If the `$facet` stage is the first stage in a pipeline, the stage will
> perform a `COLLSCAN`. The `$facet` stage does not make use of indexes if it is
> the first stage in the pipeline."*
> — [`$facet`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/facet/)

and, immediately after:

> *"If the `$facet` stage comes later in the pipeline and earlier stages have
> used indexes, `$facet` will not trigger a `COLLSCAN` during execution."*

Read the pair together and the rule falls out: **an index is consumed by the
stages at the top of the pipeline, and once a stage computes, reshapes or
groups, the stream no longer corresponds to anything on disk.** A `$match` in
position one is a query the storage engine answers with an index seek; the same
`$match` in position four is a predicate applied to documents that have already
been read. Same operator, different cost by a factor of the collection size.

This is why the status filter and the date range live in the *same* `$match`
rather than in two stages, and why nothing — not a `$set`, not a `$project`, not
a "just to make it readable" `$addFields` — goes above it.

## The date range is half-open and on the raw field

`{createdAt: {$gte: from, $lt: to}}` — inclusive lower, exclusive upper, and no
expression wrapped around `$createdAt`. The index derived in
**chapter 05, the index list** *(not written yet)* is
`{status: 1, createdAt: -1}` on `orders`, and it serves this `$match` as an
equality-then-range walk: the `$in` on `status` is an equality predicate (the
Manual's ESR guideline is explicit that *"When `$in` is used alone, it is an
equality operator that performs a series of equality matches"*), and the date
range walks the second key.

Wrap `createdAt` in anything — `$expr` with `$dateTrunc`, a `$where`, a
`$function` — and the server has to evaluate the expression per document, which
means fetching every document, which means the index is decorative.

This is exactly Phase 1's gotcha ("functions go on constants, not columns"), and
the reason it survives is that it was never a SQL rule in the first place: it is
a B-tree rule. Both engines store the raw value; neither stores the truncation.

## Why the truncation is legal one stage lower

The expression that is forbidden in `WHERE` is mandatory in `GROUP BY`, and the
same split holds here. By the time the stream reaches `$group`, the selection is
already done — no index is in play any more, so computing a bucket key costs
nothing an index could have saved. `$dateTrunc`'s own behaviour, and the
timezone default that makes it dangerous, is
[chunk 2](01b-dates-money-and-the-status-set.md).

## The `$sort` is on the group key, and it needs no index

`$sort` after `$group` sorts thirty documents in memory. That is fine, and it is
worth being clear about *why* it is fine: the 100 megabyte per-stage threshold
that makes late sorts scary applies to a stage sorting a whole collection, not
to a stage sorting a month of daily buckets. The rule is not "never sort late",
it is **"know how many documents the sort sees"** — and after a `$group` on a
day key, that number is bounded by the date range, not by the data.

Contrast the catalog: [02·02](../02-the-catalog/02-keyset-pagination.md) sorts
*before* any grouping, over the whole `products` collection, and there the sort
must be index-served or it is an in-memory sort over everything the filter
matched.

## `$project` renames `_id` to `day`, and the API never sees `_id`

`$group` always names its key `_id`. The Phase 3 contract publishes
`{day, revenueCents, orders}` and has never heard of `_id`, so the rename
happens in the pipeline rather than in JavaScript — one less place for the shape
to drift, and one less mapping function to keep in sync with the
[row type](../../phase-6-typescript/03-typing-raw-pg-results/01-the-generic-is-an-assertion.md)
that [chunk 12](08-running-it-from-node.md) asserts over the result.

`_id: 0` is the one exclusion you are allowed to mix with inclusions in a
`$project`; every other field in the same `$project` must be consistently
included or excluded.

## Gotchas

**★ A `$set` or `$addFields` above the `$match` costs the index.** It reads as
harmless — "compute the local day first, then filter on it" — and it converts an
index range scan into a full collection scan plus an expression evaluation per
document. `explain()` reports it plainly as a `COLLSCAN` where an `IXSCAN` used
to be (**chapter 05, reading `explain()`** *(not written yet)*). If
you find yourself wanting to filter on a computed value, either compute it at
write time and index it, or restate the filter in terms of the raw field.

**★ Two `$match` stages separated by a `$project` are not the same as one
`$match`.** MongoDB's optimiser does move `$match` stages upward where it can,
but it cannot move a `$match` above a stage that created the field it tests. A
filter on `day` written after the `$project` that creates `day` is stuck there
permanently, and it is invisible in the code because both stages read like
filters.

**★ Sorting on the *projected* field before the `$project` exists sorts on
nothing.** `$sort: {day: 1}` placed above the `$project` that creates `day` sorts
on a missing field. MongoDB does not error: a missing field compares as `null`,
so every document ties and the output order is arbitrary — and arbitrary here
means "stable enough in testing to ship". Sort on `_id` before the rename, as
the pipeline above does, or rename first and then sort.

**★ `{$count: 'orders'}` is a stage, not an accumulator.** Writing
`{$group: {_id: …, orders: {$count: 'orders'}}}` is a different thing from the
`$count` *stage*, which consumes the whole stream and emits a single document
with one field. Inside `$group` the accumulator spellings are `{$sum: 1}` and
(since MongoDB 5.0) `{$count: {}}`; the stage spelling ends your pipeline's
grouping entirely.

**★ An empty result set from this pipeline is an empty array, not a zero row.**
If no order in the range has a revenue status, `$group` produces nothing and
`.toArray()` returns `[]`. Phase 4's chart component must render an empty state
rather than crash on `data[0]`, and the API must return `[]` rather than `null` —
the contract says a list.

## Interview questions

**★ Why is `$match` first a performance rule rather than a style rule?**
Because an aggregation can only use an index for the stages at the top of the
pipeline, before any stage has reshaped the stream. The Manual states this
operationally for `$facet` — a `$facet` in position one does a `COLLSCAN`, a
`$facet` after an indexed stage does not — and the same logic governs every
stage. A `$match` in position one is a query the storage engine can answer with
an index seek; the same `$match` in position four is a predicate applied to
documents that have already been read. On a collection of any size that is the
difference between milliseconds and a full scan.

**★ In SQL you must not write `where date_trunc('day', created_at) = $1`, but
you must write `group by date_trunc('day', created_at)`. Does the same asymmetry
hold in MongoDB, and why?**
Yes, and for the same reason. The index stores raw `createdAt` values; a
predicate over a truncation of `createdAt` asks about a value the index does not
contain, so every document must be fetched and the expression evaluated. Once
the `$match` has selected the documents, no index is in play any more, so the
truncation inside `$group._id` is free. The rule is about *predicate placement*,
not about the function — and it is a B-tree rule, not a SQL one, which is why it
ported unchanged.

**★ The dashboard is slow. `explain()` shows `IXSCAN` on
`{status: 1, createdAt: -1}` followed by a `FETCH`, then `$group`. What would
you look at first?**
The ratio of `totalDocsExamined` to `nReturned` at the `FETCH`. An `IXSCAN` that
selects far more documents than the pipeline eventually groups means the index
narrowed on `status` but the date range is doing most of the work — which is the
ESR ordering question, and is
**chapter 05, the method and ESR** *(not written yet)*. It is also
worth checking that nothing has crept in above the `$match`, because that turns
the `IXSCAN` into a `COLLSCAN` and the plan shape is the first thing to read.

**★ Why sort on `_id` and rename afterwards, rather than rename and sort on the
readable name?**
Both work, but the version that renames first has one more stage between the
group and the sort, and every stage between them is a chance for someone to
insert something that breaks the sort's assumptions. More concretely: sorting on
a field that a later refactor stops creating fails silently, because a missing
sort field compares as `null` rather than raising. Sorting on `_id` — the one
field `$group` guarantees — cannot be refactored away.

**★ When is a `$sort` late in the pipeline acceptable, and when is it a bug?**
It is acceptable when you can state an upper bound on the number of documents
reaching it that does not depend on collection size — after a `$group` on a
bounded key, after a `$limit`, after a `$facet` sub-pipeline that has already
reduced. It is a bug when the sort sees the collection: then it is a blocking
in-memory sort, subject to the 100 megabyte threshold, and the fix is an index
that supplies the order rather than a stage that computes it.

---

← [Overview](README.md) ·
Next → [Dates, money and the status set](01b-dates-money-and-the-status-set.md)
