---
title: "The dashboard on the aggregation pipeline"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-02 against the **MongoDB Manual (8.0)** —
> [`$densify`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/densify/),
> [`$setWindowFields`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/setWindowFields/),
> [`$facet`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/facet/),
> [`$merge`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/merge/),
> [Limits and Thresholds](https://www.mongodb.com/docs/manual/reference/limits/).
> Concept home:
> [MongoDB — the aggregation pipeline](../../../../mongodb/pages/phase-6-aggregation/README.md).
> `mongodb` is **not** installed in this repo's `node_modules`, so every driver
> claim comes from the published driver docs and the driver source on GitHub,
> not from a local declaration file.
> Spine: **MongoDB 8.0** (8.2 minor) · driver **`mongodb` 7.5.0** · **Node 24 LTS**.

Four business questions, unchanged since Phase 0: revenue by day for the last
thirty, order counts by status, top products, each product's share of its
category. The Postgres counterpart is
[1·09 — dashboard queries](../../phase-1-database/09-dashboard-queries.md), and
this chapter rebuilds every one of them as a pipeline.

The translation is closer than people expect, and it is closest exactly where
SQL had a dedicated feature:

| Phase 1 SQL | Phase 8 pipeline |
|---|---|
| `generate_series` as a date spine | `$densify` + `$fill` |
| `count(*) filter (where …)` | `$sum: {$cond: [ …, 1, 0]}` |
| `sum(…) over (partition by …)` | `$setWindowFields` with an unbounded window |
| `rank() over (order by …)` | `$rank` inside `$setWindowFields` |
| `date_trunc('day', …)` in `group by` | `$dateTrunc` in `$group._id` |
| four queries, four round trips | one `$facet`, one round trip |
| `join order_items` | nothing — `orders.items[]` is already there |

The two places it is *not* a translation are where the chapter earns its
length. **Grouping alone omits empty days in both databases, but Postgres had a
one-line fix and MongoDB needs two stages with four separate traps.** And
**`$facet`'s single-round-trip convenience buys a `COLLSCAN` if you put it
first**, which is the aggregation equivalent of the mistake this corpus keeps
naming: the index is only reachable at the top of the pipeline.

| # | Chunk | Covers |
|---|---|---|
| 1 | **[Revenue by day](01-revenue-by-day.md)** | The whole pipeline, and where in it an index stops being reachable |
| 2 | **[Dates, money and the status set](01b-dates-money-and-the-status-set.md)** | `$dateTrunc`'s UTC default, `$sum`'s silence about types, and the revenue definition written down once |
| 3 | **[`$densify`](01c-densify-and-fill.md)** | Why the naive `$group` silently omits days, `bounds: "full"` being the wrong bounds, and the fields `$densify` does not create |
| 4 | **[Partitioned spines](01d-partitioned-spines-and-limits.md)** | One spine per series, the series with no data that gets no spine, and the 500,000-document ceiling |
| 5 | **[`$fill` and ordering](01e-fill-and-ordering.md)** | Flow, level and measurement; the two stages that disclaim output order; and whether to gap-fill in Node instead |
| 6 | **[Conditional aggregates](02-conditional-aggregates.md)** | `FILTER (WHERE …)` as `$cond` inside `$sum`, `$switch` for buckets, and why the `0` branch and the `null` branch differ |
| 7 | **[Window functions](03-window-functions.md)** | `$setWindowFields`, running totals, moving averages, `$rank`, share-of-category, and the division guard that replaces `nullif` |
| 8 | **[Top products](04-top-products-and-unwind.md)** | `$unwind` over `orders.items[]`, the row multiplication it causes, `$sortByCount`, and the `$topN`/`$firstN` accumulators |
| 9 | **[`$facet`](05-facet-and-one-round-trip.md)** | Four panels in one round trip, the `COLLSCAN` it costs at the top, the banned stages, and the 16 MiB output document |
| 10 | **[`$lookup`, and why mostly you don't](06-lookup-and-why-mostly-you-dont.md)** | The one panel that genuinely joins, the `foreignField` index, and the N+1 hiding inside a "join" |
| 11 | **[Limits and materialisation](07-limits-and-materialisation.md)** | 100 MB per stage, 16 MiB per document, `$merge` into a materialised dashboard, and when precomputing beats querying |
| 12 | **[Running it from Node](08-running-it-from-node.md)** | The repository module, `maxTimeMS`, read preference, and the `aggregate` generic that checks nothing |

Chunks 1–2 and 3–5 are each **one topic split** across files: the first pair on
the boundary between "where the plan goes wrong" and "where the numbers go
wrong", the second trio on the boundary between manufacturing the spine,
partitioning it, and filling it. The README's chapter table advertised three
chunks; the topic had twelve.

## What did not need rebuilding

Phase 1's dashboard joined `order_items` to `orders` to `products` to
`categories` to get a product name onto a revenue row. Three of those four joins
are gone, and not because MongoDB is cleverer — because
[chapter 01](../01-modeling-the-store/03-the-order-document.md) decided that
`orders.items[]` snapshots `name`, `slug`, `coverKey`, `qty` and
`unitPriceCents`. The report reads history out of the order document, which is
the same reason Phase 1 computed revenue from `order_items.unit_price_cents`
rather than joining `products`. The document model did not remove the join; the
*snapshot* did, and it would have removed it in Postgres too.

The one join that survives is "top customers by spend", because `orders` carries
a `userId` and not an email — and [chunk 10](06-lookup-and-why-mostly-you-dont.md)
is about doing that one correctly.

## Where this connects

The pipeline mechanics — what a stage is, why `$match` goes first, what `$group`
accumulators do — are
[MongoDB phase 6](../../../../mongodb/pages/phase-6-aggregation/README.md) and
are never re-taught here. The documents these pipelines read are
[chapter 01's](../01-modeling-the-store/README.md). Every index that keeps the
opening `$match` off a collection scan is derived in
[chapter 05](../05-indexes-and-explain/README.md), and the `explain()` reading
that proves it is [05·15](../05-indexes-and-explain/11-the-ratio-and-the-sort-stage.md).

---

Phase index: [Phase 8 — The MongoDB mirror](../README.md) ·
← Prev chapter: **Checkout with transactions** *(index not written yet)* ·
Next chapter → [Indexes for this app's queries](../05-indexes-and-explain/README.md)
