---
title: "$facet turns four dashboard queries into one round trip, and pays for it with a COLLSCAN the moment it is the first stage"
sidebar_label: "13 · $facet"
sidebar_position: 13
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-02 against the **MongoDB Manual (8.0)** —
> [`$facet`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/facet/)
> (*"Input documents are passed to the `$facet` stage only once, enabling various
> aggregations on the same set of input documents"*; *"Each sub-pipeline within
> `$facet` is passed the exact same set of input documents"*; *"If the `$facet`
> stage is the first stage in a pipeline, the stage will perform a `COLLSCAN`"*),
> [Aggregation Pipeline Stages](https://www.mongodb.com/docs/manual/reference/mql/aggregation-stages/).
> Concept home:
> [MongoDB 6·04 — `$group`](../../../../mongodb/pages/phase-6-aggregation/04-group-and-accumulators.md).
> Spine: **MongoDB 8.0** (8.2 minor) · driver **`mongodb` 7.5.0** · **Node 24 LTS**.

**Phase 1's `GET /admin/stats` ran four separate queries and assembled the JSON
in the API. That is four round trips, four index traversals of overlapping
document sets, and — the part nobody thinks about — four different points in
time, so the revenue total and the order count are from different instants.
`$facet` collapses all of it into one stage: one scan, one snapshot, one
response. It has three costs, each of which is a hard rule rather than a
tendency: no index if it is first, a fixed list of stages that may not appear
inside it, and a single output document holding every panel. This chunk takes the
first two; [chunk 14](05b-facet-limits-and-shape.md) takes the third, along with
the shape the driver actually hands back.**

## The stage

```js
export function dashboardPipeline({from, to}) {
  return [
    {$match: {createdAt: {$gte: from, $lt: to}}},        // ONE indexed scan
    {$facet: {
      statusCounts: [
        {$group: Object.fromEntries([
          ['_id', null], ...STATUSES.map(s => [s, countIf(s)]),
        ])},
        {$project: {_id: 0}},
      ],
      revenueByDay: [
        {$match: {status: {$in: REVENUE_STATUSES}}},
        {$group: {_id: {$dateTrunc: {date: '$createdAt', unit: 'day', timezone: TZ}},
                  revenueCents: {$sum: '$totalCents'}, orders: {$sum: 1}}},
        {$set: {day: '$_id'}},
        {$densify: {field: 'day', range: {step: 1, unit: 'day', bounds: [from, to]}}},
        {$fill: {sortBy: {day: 1}, output: {revenueCents: {value: 0}, orders: {value: 0}}}},
        {$sort: {day: 1}},
        {$project: {_id: 0, day: 1, revenueCents: 1, orders: 1}},
      ],
      topProducts: [
        {$match: {status: {$in: REVENUE_STATUSES}}},
        {$unwind: '$items'},
        {$group: {_id: '$items.productId',
                  name: {$first: '$items.name'}, slug: {$first: '$items.slug'},
                  units: {$sum: '$items.qty'},
                  revenueCents: {$sum: {$multiply: ['$items.qty', '$items.unitPriceCents']}}}},
        {$sort: {revenueCents: -1}},
        {$limit: 20},
      ],
      overview: [
        {$match: {status: {$in: REVENUE_STATUSES}}},
        {$group: {_id: null, orders: {$sum: 1}, revenueCents: {$sum: '$totalCents'}}},
        {$project: {_id: 0}},
      ],
    }},
  ];
}
```

Four panels, one round trip. The result is a **single document** with four array
fields.

## The shared `$match` is the whole design

> *"Input documents are passed to the `$facet` stage only once, enabling various
> aggregations on the same set of input documents."*
> — [`$facet`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/facet/)

The date range is filtered once, using the index, and every sub-pipeline receives
the same documents. That is the saving: one index traversal instead of four, and
one consistent set of documents rather than four reads that may disagree if an
order is written between them.

The status filter is *not* shared, because the panels disagree about it — the
status-counts panel wants every status, the other three want revenue statuses
only. So each sub-pipeline re-states its own `$match`, and those re-statements
are **not** index-served; they filter an in-memory stream. That is the right
trade: the expensive predicate (the date range, which selects a small slice of a
growing collection) is indexed once, and the cheap predicate (a status
comparison on already-loaded documents) is repeated.

The general rule: **hoist the selective predicate above the `$facet`; leave the
cheap discriminating predicates inside it.**

## The `COLLSCAN` rule

> *"If the `$facet` stage is the first stage in a pipeline, the stage will perform
> a `COLLSCAN`. The `$facet` stage does not make use of indexes if it is the first
> stage in the pipeline."*

> *"If the `$facet` stage comes later in the pipeline and earlier stages have used
> indexes, `$facet` will not trigger a `COLLSCAN` during execution."*

This is stated on the `$facet` page and it is the clearest statement in the
Manual of the general principle this chapter keeps returning to: an index is
reachable only at the top of the pipeline. A `$facet` in position one reads every
document in `orders`, forever, regardless of how selective the `$match` stages
inside its branches are — because those are inside branches, and a branch's
`$match` cannot be hoisted out past the fan-out.

The `$match` above the `$facet` is therefore not a nicety. It is the difference
between a report that scans a month and one that scans the collection.

## What may not appear inside a `$facet`

The Manual lists the stages that are disallowed in a sub-pipeline:

`$collStats` · `$facet` · `$geoNear` · `$indexStats` · `$merge` · `$out` ·
`$planCacheStats` · `$search` · `$searchMeta` · `$vectorSearch`

Three of those matter here.

**`$out` and `$merge` cannot be inside.** They are terminal stages — they write —
and a branch cannot write. So a pipeline that computes four panels *and*
materialises one of them has to be two pipelines, which is
[chunk 16](07-limits-and-materialisation.md)'s problem.

**`$facet` cannot nest.** No hierarchy of panels; one level only.

**`$search` cannot be inside.** Atlas Search must be the first stage of a
pipeline, so a dashboard combining a search-driven panel with aggregate panels
cannot use `$facet` for both. `$searchMeta` and Atlas Search's own `facet`
collector are the Atlas-specific answer; on a self-managed deployment there is no
answer and it is two queries.

## Gotchas

**★ A `$facet` as the first stage is a guaranteed `COLLSCAN`.** The Manual says so
directly. No `$match` inside a branch rescues it, because a branch's stages run
after the fan-out. Hoist the selective filter above the stage.

**★ `$out` and `$merge` cannot appear inside a `$facet`.** Computing panels and
materialising one of them is two pipelines. The error is clear; the surprise is
architectural, because it means a "compute once, serve many" design cannot be
one aggregation.

**★ Predicates inside a branch are not index-served.** They filter the stream the
`$facet` was handed. Moving a selective predicate into a branch "to keep the
branches independent" turns an index seek into a per-document comparison,
repeated once per branch.

**★ Every branch re-walks the same documents.** `$facet` saves the *scan*, not the
*work*: four branches over the same 5,000 documents do four traversals of an
in-memory stream. It is still far cheaper than four queries, and it is not free —
a facet with twelve branches over a wide date range is a stage doing twelve
passes, and the per-stage 100 MB threshold applies to it as a whole.

**★ Nested `$facet` is disallowed.** A dashboard that grows sub-panels has to
flatten them into more sibling branches, which raises the 16 MiB pressure and the
per-stage work at the same time. At some point the answer is two endpoints.

**★ A `$sort` inside a branch does not benefit from an index.** The documents
reaching the branch are already an in-memory stream, so every branch sort is a
blocking sort bounded by the 100 MB threshold. Sorting inside a branch is fine
after a `$group`; sorting a branch's raw input is a smell.

## Interview questions

**★ What does `$facet` actually save, and what does it not save?**
It saves the round trips and the repeated *index traversal*: the documents are
selected once, by the stages above it, and passed to every sub-pipeline. It also
saves consistency — all panels see the same set of documents rather than four
reads at four instants. It does **not** save the per-branch work: each
sub-pipeline processes the full input stream independently, so four branches do
four passes over the same in-memory documents. The saving is real and it is
about I/O and consistency, not about CPU.

**★ Why is a `$facet` in the first position guaranteed to scan the collection?**
Because an index can only be consumed by the stages at the top of the pipeline,
and a `$facet` fans the stream out into independent branches — a predicate inside
a branch is applied to documents that have already been read. The Manual states
it as a rule for this stage specifically, and the same reasoning is why the
general advice is `$match` first. The consequence is that the `$match` above a
`$facet` is doing all of the index work for every panel.

**★ Why does the pipeline hoist the date `$match` above the `$facet` but leave
the status `$match` inside each branch?**
Because they cost different things. The date range is selective and indexed:
running it once above the stage means one index seek for the whole dashboard.
The status filter is a comparison on documents already in memory, and the panels
disagree about which statuses they want — the counts panel needs all five, the
revenue panels need three. Hoisting the shared expensive predicate and repeating
the cheap divergent one is the correct split, and it generalises: hoist what an
index can serve, repeat what it cannot.

**★ You need the dashboard *and* you need it materialised nightly. Can one
pipeline do both?**
No — `$out` and `$merge` are on the list of stages disallowed inside a `$facet`,
and they must be the last stage of their pipeline. So the nightly job runs its
own pipeline per materialised panel, ending in `$merge`, and the live endpoint
either reads the materialised collection or runs the facet. That separation is
[chunk 16](07-limits-and-materialisation.md)'s subject, and the constraint is
what forces the two code paths to exist.

**★ How do you tell whether the `$facet` is helping, on a live system?**
Compare the plan, not the wall clock. `explain()` on the faceted pipeline should
show a single `IXSCAN` for the shared `$match` and no `COLLSCAN`; the four
separate queries would show four traversals of the same index. If the faceted
version reports a `COLLSCAN`, something moved above the `$match` or the `$match`
was dropped, and the single round trip is now the most expensive of the two
designs. Reading that output is
[05·13](../05-indexes-and-explain/10-explain-verbosity-and-stages.md).

---

← Prev: [Top-N accumulators](04b-top-n-accumulators.md) ·
[Overview](README.md) ·
Next → [The 16 MiB ceiling and the shape that comes back](05b-facet-limits-and-shape.md)
