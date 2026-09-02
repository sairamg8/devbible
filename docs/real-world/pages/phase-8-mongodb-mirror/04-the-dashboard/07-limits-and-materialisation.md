---
title: "Three hard numbers govern every pipeline in this chapter, they fail in three different ways, and allowDiskUse addresses exactly one of them"
sidebar_label: "17 · The three limits"
sidebar_position: 17
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-02 against the **MongoDB Manual (8.0)** —
> [Limits and Thresholds](https://www.mongodb.com/docs/manual/reference/limits/)
> (*"The maximum BSON document size is 16 mebibytes"*; *"Starting in MongoDB 6.0,
> the `allowDiskUseByDefault` parameter controls whether pipeline stages that
> require more than 100 megabytes of memory to execute write temporary files to
> disk by default"*; *"MongoDB limits the number of aggregation pipeline stages
> allowed in a single pipeline to 1000"*),
> [`cursor.sort()`](https://www.mongodb.com/docs/manual/reference/method/cursor.sort/)
> (*"If the memory footprint of these `k` results exceeds 100 megabytes, MongoDB
> automatically writes temporary files to disk"*),
> [`cursor.allowDiskUse()`](https://www.mongodb.com/docs/manual/reference/method/cursor.allowDiskUse/).
> Counterpart:
> [1·09 — the performance posture](../../phase-1-database/09-dashboard-queries.md).
> Spine: **MongoDB 8.0** (8.2 minor) · driver **`mongodb` 7.5.0** · **Node 24 LTS**.

**Phase 1 ended its dashboard chapter with an escalation ladder — cache, then
materialised view, then read replica — and the point of stating it was that each
rung is chosen rather than stumbled into. The same ladder exists here with
MongoDB rungs, and there is one thing on top of it that Postgres did not have to
say out loud: three hard numeric limits that decide, before any of the ladder
matters, whether the pipeline runs at all. This chunk is those numbers, which
stages can actually reach them, and the one option that relaxes exactly one of
them. [Chunk 18](07b-merge-and-the-ladder.md) is the ladder itself, and `$merge`
— the stage that turns a query into a table.**

## The three limits, in one place

| Limit | Applies to | On exceeding |
|---|---|---|
| **16 MiB** | each result document | errors |
| **100 MB** | each stage's working memory | spills to disk, or errors, per `allowDiskUseByDefault` |
| **1000** | stages in one pipeline | errors |

The Manual's wording for the second:

> *"Starting in MongoDB 6.0, the `allowDiskUseByDefault` parameter controls
> whether pipeline stages that require more than 100 megabytes of memory to
> execute write temporary files to disk by default."*
> — [Limits and Thresholds](https://www.mongodb.com/docs/manual/reference/limits/)

Three things follow, and each has been a production surprise somewhere.

**They are different limits with different failure modes.** A pipeline can be
comfortably under 100 MB of working memory per stage and still fail on a 16 MiB
output document — the classic being a `$facet` whose branches sum past the
ceiling ([chunk 14](05b-facet-limits-and-shape.md)). And a pipeline returning
three documents can exhaust a stage.

**`allowDiskUse` relaxes only the second.** It has no effect on the document size
limit, because that is a BSON constraint on what can be sent, not a memory
constraint on how it is computed.

**The default changed in 6.0**, so the same pipeline that errored on 4.4 spills
to disk on 8.0 — quietly getting slower rather than loudly failing, which is
better for availability and worse for noticing.

## Which stages actually approach the limits

Not all of them. The ones with unbounded working sets, in this chapter's
pipelines:

- **`$group`** — holds one accumulator set per distinct key. Bounded when the key
  is a day in a range or a five-element status set; unbounded when the key is
  `$userId` or `$items.productId` over a long window.
- **`$sort`** without an index — a blocking sort. The Manual on `cursor.sort()`:
  *"If the memory footprint of these `k` results exceeds 100 megabytes, MongoDB
  automatically writes temporary files to disk unless the query specifies
  `cursor.allowDiskUse()` with a value of `false` (in which case, the query
  fails)."* Note the number is **100 megabytes**, not the 32 MB figure that
  circulates from older versions.
- **`$setWindowFields`** — holds a partition. Bounded on daily buckets, unbounded
  when partitioned by user over raw orders.
- **`$push` / `$addToSet` accumulators** — the sharpest one, because they grow the
  *output* rather than the working set, so they hit the 16 MiB document limit
  rather than the memory threshold.

`$match`, `$project`, `$set`, `$limit`, `$unwind` and `$lookup` stream. They can
make the *stream* enormous but they do not accumulate.

## The `$push` trap

```js
// looks harmless; is a time bomb
{$group: {
  _id: {$dateTrunc: {date: '$createdAt', unit: 'day', timezone: TZ}},
  revenueCents: {$sum: '$totalCents'},
  orderIds: {$push: '$_id'},          // "so we can drill down"
}},
```

One day's `orderIds` array grows with the day's order count. At a few thousand
orders a day it is fine; the array is one document's field and ObjectIds are 12
bytes. The failure is not gradual — the document is under the ceiling until the
day it is not, and then the whole report errors rather than that one day
degrading.

The fix is to not carry the drill-down in the summary:

```js
{$group: {
  _id: {$dateTrunc: {date: '$createdAt', unit: 'day', timezone: TZ}},
  revenueCents: {$sum: '$totalCents'},
  orders: {$sum: 1},                  // a count, not the ids
}},
```

and let the drill-down be its own query with its own `$match` on the day and its
own pagination. A summary that also carries its own detail is a summary with an
unbounded row.

If a bounded sample genuinely helps — "three example orders per day" — that is
`$topN` with a clamped `n` ([chunk 12](04b-top-n-accumulators.md)), which is
bounded by construction.

## `allowDiskUse`, and why it is not the fix

```js
db.collection('orders').aggregate(pipeline, {allowDiskUse: true});
```

It permits a stage to spill temporary files rather than erroring. What it does
not do:

- raise the 16 MiB document ceiling;
- make the pipeline fast — disk spilling is the slow path by construction;
- bound anything. A stage that needed 400 MB still needs it, now on disk.

It is the right option for a nightly job that legitimately processes a year of
orders, and the wrong option for an endpoint an admin refreshes. **On a live
endpoint, needing `allowDiskUse` is a design signal, not a configuration
gap:** either the `$match` above is not selective enough, or a `$group` key is
unbounded, or the work belongs in a precomputed collection.

## Gotchas

**★ `allowDiskUse` does not raise the 16 MiB document limit.** They are different
constraints — one on working memory, one on what BSON can carry. Setting the flag
because "the pipeline hit a limit" fixes half the possible causes and silently
does nothing for the other half.

**★ `$push` in a `$group` grows the output document without bound.** It hits the
16 MiB ceiling, not the memory threshold, so `allowDiskUse` does not help. And it
fails all at once: the report works until the day one group's array crosses the
line, then the whole aggregation errors.

**★ The in-memory sort limit is 100 megabytes, not 32.** The 32 MB figure is
widely repeated and is not what the 8.0 manual documents. Quoting the wrong
number in a design review is how a pipeline gets rewritten to avoid a limit it
was nowhere near.

**★ The 1000-stage limit sounds unreachable and is not, if pipelines are
generated.** Building a `$facet` branch per category, or an accumulator per
status in a loop over a growing enum, is how a generated pipeline creeps toward
it. The failure is at least loud.

## Interview questions

**★ Name the limits an aggregation can hit, and say which one `allowDiskUse`
addresses.**
Three: 16 mebibytes per result document, roughly 100 megabytes of working memory
per stage, and 1000 stages per pipeline. `allowDiskUse` addresses only the
second, by permitting a stage to spill temporary files instead of erroring. It
does nothing for the document-size ceiling, which is a BSON limit on what can be
returned, and nothing for the stage count. Since MongoDB 6.0 the spilling is the
default behaviour anyway, controlled by `allowDiskUseByDefault` — so on a modern
deployment the symptom of an oversized stage is usually slowness rather than an
error.

**★ Which stages in this chapter's pipelines can actually exhaust memory?**
The accumulating ones: `$group`, whose working set is one accumulator set per
distinct key; a `$sort` that no index can serve, which is a blocking sort; and
`$setWindowFields`, which holds a partition. `$match`, `$project`, `$set`,
`$limit`, `$unwind` and `$lookup` stream and do not accumulate — though `$unwind`
can make the stream that the accumulating stages downstream have to handle much
larger. The practical question for each `$group` is whether its key is bounded by
the request (a day in a range) or by the data (a user id).

**★ A pipeline works in staging and errors in production with a document-size
error. What is the most likely cause?**
A `$push` or `$addToSet` accumulator whose array grows with the data, or a
`$facet` branch without a `$limit`. Both build the *output* rather than the
working set, so `allowDiskUse` is irrelevant and staging — with less data —
stays under the ceiling. The fix is to make the unbounded thing bounded: replace
`$push` of ids with a count and a separate drill-down query, or with `$topN` and
a clamped `n`; give every facet branch an explicit limit.

**★ You are asked to add `allowDiskUse: true` to a dashboard endpoint that
started timing out. What do you say?**
That it will probably stop the errors and will not fix the problem, and that the
need for it is diagnostic. A live endpoint reaching 100 megabytes in a single
stage means one of three things: the leading `$match` is not selective enough, a
`$group` key is unbounded over the requested range, or the work is genuinely too
big to do per request and belongs in a `$merge`-maintained rollup read cheaply.
Setting the flag converts a loud failure into a slow success, which is the right
call for a batch job and the wrong one for a page.

---

← Prev: [The join's shape](06b-lookup-shape-and-alternatives.md) ·
[Overview](README.md) ·
Next → [Materialising with `$merge`](07b-merge-and-the-ladder.md)
