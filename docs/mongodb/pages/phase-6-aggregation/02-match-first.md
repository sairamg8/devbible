---
title: "$match first, always"
sidebar_label: "02 · $match first, always"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the **MongoDB Manual** (v8.0) —
> [Aggregation Pipeline Optimization](https://www.mongodb.com/docs/manual/core/aggregation-pipeline-optimization/):
> `$match` filters that do not depend on computed values are **moved before** projection stages
> (`$project`, `$addFields`, `$set`, `$unset`), with the documented `maxTime`/`avgTime` example
> splitting one `$match` into three; `$match` moves **before `$sort`** *"to minimize the number of
> documents to sort"*; **`$match` + `$match` coalesce** into a single `$and`; the optimizer can add
> a `$match` before `$redact`; **indexes are usable at the start of a pipeline** (or in early stages
> after the optimizer has moved `$match` forward), `$sort` can use an index *"if not preceded by a
> `$project`, `$unwind` or `$group`"*, and *"place `$match` at the beginning"* to use indexes for
> scanning matching documents — verify with **`IXSCAN`** or **`DISTINCT_SCAN`** in the plan —
> [Aggregation Pipeline Limits](https://www.mongodb.com/docs/manual/core/aggregation-pipeline-limits/)
> for the 100 MiB stage limit that an early `$match` is the cheapest way to stay under.
> **Documentation-validated; no console blocks.**

There is exactly one placement rule in aggregation that is worth memorising, and this is it.

**A pipeline can only use an index while the documents are still the collection's documents.** The
moment a stage computes, reshapes, expands or groups, the stream stops corresponding to anything on
disk, and every stage after it is a scan of whatever is in memory. `$match` first is not a
micro-optimisation — it is the difference between an `IXSCAN` over 400 documents and a `COLLSCAN`
over 40 million.

## What "first" buys you, concretely

Take a top-products report over one month of a five-year collection.

```js
// wrong: the pipeline reads every order ever placed
db.orders.aggregate([
  { $unwind: "$lines" },
  { $group: { _id: "$lines.sku", revenue: { $sum: "$lines.total" } } },
  { $match: { placedAt: { $gte: since } } },   // placedAt does not even exist here
]);
```

That last `$match` matches nothing at all — `$group` output has `_id` and `revenue`, and nothing
else. But even written against a field that survived, the shape is the failure: `$unwind` has
already multiplied five years of orders into five years of order lines, and `$group` has already
accumulated all of them.

```js
// right: the index does the work, then the pipeline does the rest
db.orders.aggregate([
  { $match: { status: "paid", placedAt: { $gte: since, $lt: until } } },
  { $unwind: "$lines" },
  { $group: { _id: "$lines.sku", revenue: { $sum: "$lines.total" } } },
]);
```

With `{status: 1, placedAt: 1}` indexed, the first stage is an `IXSCAN` and the pipeline's input is
one month of paid orders. Everything downstream is proportional to *that*, not to the collection.

The Manual's guidance is the same sentence: use `$match`, `$limit` and `$skip` to restrict the
documents entering the pipeline, and *"place `$match` at the beginning"* so indexes can be used to
scan only matching documents.

## The optimizer moves `$match` for you — until it can't

The server does not require you to write it first. It rewrites the pipeline before execution, and
`$match` reordering is the largest thing it does.

**Before projection stages.** A `$match` whose conditions do not depend on computed values is moved
ahead of `$project`, `$addFields`, `$set` and `$unset`. The documented example is worth reading
closely, because it shows the optimizer *splitting one `$match` into three*:

```js
// as written
{ $addFields: { maxTime: { $max: "$times" }, minTime: { $min: "$times" } } },
{ $project: { _id: 1, name: 1, avgTime: { $avg: ["$maxTime", "$minTime"] } } },
{ $match: { name: "Joe Schmoe", maxTime: { $lt: 20 }, avgTime: { $gt: 7 } } }

// as executed
{ $match: { name: "Joe Schmoe" } },                       // stored field → moved to the front
{ $addFields: { maxTime: …, minTime: … } },
{ $match: { maxTime: { $lt: 20 } } },                     // available after $addFields
{ $project: { _id: 1, name: 1, avgTime: … } },
{ $match: { avgTime: { $gt: 7 } } }                       // available only after $project
```

Each condition rises as far as the stage that first makes its field available, and no further.
`name` is a stored field, so it reaches the front and can meet an index. `avgTime` cannot move at
all.

**Before `$sort`.** `{$sort: {age: -1}}, {$match: {status: "A"}}` is executed as the `$match` first,
in the Manual's words, *"to minimize the number of documents to sort"*. This one is worth more than
it looks — it is also what lets the `$sort` reach an index, since a `$sort` can use one only when it
is first or preceded only by a `$match`.

**Adjacent `$match` stages coalesce.** `{$match: {year: 2014}}, {$match: {status: "A"}}` becomes
`{$match: {$and: [{year: 2014}, {status: "A"}]}}` — one predicate, one chance at a compound index.
So splitting your filter across two `$match` stages for readability costs nothing.

**Before `$redact`**, where the optimizer may add a `$match` specifically so the pipeline can start
with an index.

**The rule underneath all of them:** a condition can be hoisted only if the field it names exists in
the input to the earlier stage. That is why the discipline still matters — the optimizer is very
good at moving what it *may* move, and completely powerless over the rest.

## The four walls a `$match` cannot climb

Write the `$match` above these yourself, because nothing will move it for you.

**1. `$group`.** Group output is `_id` plus the accumulators. A `$match` on any other field matches
nothing — silently, with an empty result and no error, because a missing field is `null`.

**2. `$unwind`.** After unwinding, the unit changed. A `$match` below it is filtering *lines*, not
orders, and it runs after the multiplication has already happened. (The one documented exception:
when `$unwind` immediately follows a `$lookup` on its `as` field and is followed by a `$match` on
that field, all three coalesce *into* the `$lookup` — see topic 06.)

**3. Computed fields.** A `$match` on something `$addFields` produced cannot rise above the stage
that produced it. This is correct, not a limitation — but it means a filter on a computed value is
always a scan of whatever reached that stage, so narrow the input first.

**4. `$lookup`.** Filter the local collection *before* the join. A `$lookup` executed against a
million local documents performs a million lookups; the same `$lookup` after a `$match` that leaves
four hundred performs four hundred.

## Splitting one filter into two `$match` stages

The strongest version of this page's rule is not "put your `$match` first" — it is **put the
indexable half of your filter first**.

```js
db.orders.aggregate([
  // indexable: stored fields, meets {status: 1, placedAt: 1}
  { $match: { status: "paid", placedAt: { $gte: since } } },

  { $addFields: { margin: { $subtract: ["$total", "$cost"] } } },

  // not indexable, and now applied to a small set instead of the collection
  { $match: { margin: { $gt: 0 } } },
]);
```

Both halves are needed; only one can use an index. Written as a single `$match` at the bottom, the
whole thing scans. Written this way, the expensive predicate runs over a set the index already cut.
This is the manual version of what the optimizer does automatically in the `maxTime`/`avgTime`
example, applied where the optimizer cannot see the split.

## `$match` and `$expr`: the exception that costs you the index

`$match` accepts the full query language, including `$expr` — and `$expr` is not indexable in this
position (see [phase 5 · `$expr`](../phase-5-query-operators/05-expr.md)). A first stage of
`{$match: {$expr: {$gt: ["$paid", "$total"]}}}` is a `COLLSCAN` that *looks* like it followed the
rule. Pair it with an indexable condition, or accept that it is a batch job.

The same applies to `$regex` without an anchored prefix, `$exists: false` (which cannot use a sparse
index), and `$ne`/`$nin` on a low-selectivity field. "`$match` is first" is necessary, not
sufficient — the predicate has to be one an index can seek.

## Proving it, rather than believing it

```js
db.orders.explain("executionStats").aggregate(pipeline);
```

Look for two things in the plan.

| Look for | Means |
|---|---|
| `IXSCAN` or `DISTINCT_SCAN` | the pipeline starts at an index — the Manual names these two as the confirmation |
| `COLLSCAN` | the first stage reads the whole collection, whatever your array looked like |

And compare `executionStats.nReturned` against `totalDocsExamined`. If the pipeline returns 10 rows
after examining 4,000,000 documents, the `$match` is either not first, not indexable, or not
selective — and the ratio tells you which conversation to have.

Explain also prints the **optimized** pipeline, so it is the only honest answer to "did my `$match`
actually move?"

## Why this is also the memory answer

The 100 MiB per-stage limit and the 16 MiB result-document limit are both functions of how much data
reaches the stage that blows up. A `$group` that spills to disk over a five-year scan does not spill
over a one-month scan. Almost every "aggregation exceeded memory" incident is a missing or misplaced
`$match`, and `allowDiskUse: true` is the fix that makes the symptom quieter without touching the
cause.

## Gotchas

**Symptom:** a `$match` after `$group` returns nothing, with no error.
**Cause:** it names a field that does not exist in `$group` output — only `_id` and the accumulators
do. A missing field is `null`, so the predicate simply fails to match.
**Fix:** match on `_id` (or the accumulator's name) if the filter is on the grouped value, or move
the condition above the `$group` if it is on a stored field.

**Symptom:** the `$match` is written first and the plan still shows `COLLSCAN`.
**Cause:** the predicate is not indexable — `$expr`, an unanchored `$regex`, `$exists: false` against
a sparse index, `$ne` on a low-cardinality field — or no index covers those fields at all.
**Fix:** check which. Position is necessary but not sufficient; add the index, or add an indexable
condition alongside.

**Symptom:** an index exists on the sort field but the `$sort` still sorts in memory.
**Cause:** a `$project`, `$unwind` or `$group` precedes it. The Manual restricts `$sort` index use to
the first stage or one preceded only by `$match`.
**Fix:** move the `$sort` up next to the `$match`, before anything reshapes the stream.

**Symptom:** a `$lookup` pipeline is far slower than the same query without it.
**Cause:** the join runs once per input document and the local side was never narrowed.
**Fix:** `$match` on the local collection before the `$lookup`. Reducing the local side reduces the
number of lookups one-for-one.

**Symptom:** you split the filter across two `$match` stages "for readability" and worry it costs
something.
**Cause:** nothing — adjacent `$match` stages coalesce into a single `$and`.
**Fix:** none needed. Split freely; the optimizer merges them.

**Symptom:** a filter on a computed field was moved up "to follow the rule" and now errors or matches
nothing.
**Cause:** the field does not exist until the stage that computes it.
**Fix:** two `$match` stages — the indexable conditions above, the computed ones below. That is
exactly what the optimizer does on its own when it can see both.

**Symptom:** the pipeline is fast in staging, times out in production.
**Cause:** the same missing `$match`, against a collection two orders of magnitude larger. The plan
is identical; only the row count differs.
**Fix:** compare `totalDocsExamined` to `nReturned` on the production-sized collection, not on the
dev one. A `COLLSCAN` over 40k rows is invisible.

**Symptom:** adding `allowDiskUse: true` fixed the memory error, and now the report takes 90 seconds.
**Cause:** spilling to temporary files is a correctness fallback, not a performance feature. The
stage still processes everything, now via disk.
**Fix:** treat the memory error as a diagnosis — it is telling you the wrong volume of data reached
that stage. Fix the `$match` or the index and the flag becomes unnecessary.

**Symptom:** the `$match` uses `$or` across two fields and the index is not used.
**Cause:** `$or` needs an index on *each* branch to be served by indexes at all, and even then it is
an index-union rather than a single seek.
**Fix:** index every branch, or restructure. See
[phase 5 · logical operators](../phase-5-query-operators/02-logical-operators.md).

## Interview questions

**★ Why does `$match` belong at the start of a pipeline?**
Because indexes are usable only at the start. Once a stage computes, reshapes, expands or groups, the
stream no longer corresponds to documents on disk and every later stage is a scan of what is in
memory. An early `$match` is what turns the first stage into an `IXSCAN` and makes the cost of every
stage below it proportional to the filtered set rather than to the collection. It is also the
cheapest defence against the 100 MiB per-stage limit.

**★ The optimizer moves `$match` forward automatically. Why should you still write it first?**
Because it can only hoist a condition whose field exists in the earlier stage's input. It moves a
filter on a stored field ahead of `$project`/`$addFields`/`$set`/`$unset` and ahead of `$sort`, and it
will split one `$match` into several so each condition rises as far as it can — the Manual's
`maxTime`/`avgTime` example does exactly that. But nothing lifts a `$match` above a `$group`, a
`$unwind`, or the stage that computed the field it names. Those four walls are yours to write above.

**★ A `$match` after `$group` returns zero rows and no error. What happened?**
It names a field that does not survive the grouping. `$group` output contains `_id` and the
accumulators, nothing else, and referencing an absent field yields `null` rather than an error — so
the predicate quietly matches nothing. Either match on `_id`/the accumulator, or move the condition
above the `$group` if it is on a stored field.

**★ How do you prove a pipeline is using an index?**
Explain it, and look for `IXSCAN` or `DISTINCT_SCAN` in the plan — the Manual names those as the
confirmation, and `COLLSCAN` as the absence. Explain also prints the optimized pipeline, which is the
only way to see whether your `$match` was actually moved. Then compare `nReturned` with
`totalDocsExamined`: a wide gap means the filter is not selective at the index level even if it is
positioned correctly.

**Is writing `$match` first sufficient for index use?**
No. The predicate also has to be seekable. `$expr` is not indexable in an ordinary `$match`, an
unanchored `$regex` scans, `$exists: false` cannot use a sparse index, and `$ne`/`$nin` on a
low-cardinality field will not help even with an index present. Position is necessary; selectivity
and operator choice decide the rest.

**Does splitting a filter into two `$match` stages hurt performance?**
No — adjacent `$match` stages coalesce into a single `$and`. And splitting deliberately is often the
*right* structure: put the indexable, stored-field conditions in the first `$match`, and the
conditions on computed fields in a second one below the stage that computes them.

**Why does a `$lookup` need a `$match` above it?**
Because the join executes per input document. Narrowing the local collection from a million documents
to four hundred reduces the number of lookups by the same factor. Filtering after the join has
already paid the full cost.

**Your `$sort` has a perfectly good index and still sorts in memory. Why?**
Something reshaping precedes it. `$sort` can use an index only when it is the first stage or is
preceded only by `$match`; a `$project`, `$unwind` or `$group` in between breaks that. Move the
`$sort` up, or accept the in-memory sort and its 100 MiB ceiling.

---

← Prev: [What a pipeline is](./01-what-a-pipeline-is.md) ·
Index: [Phase 6](./README.md) ·
Next → [`$project` vs `$addFields` / `$set`](./03-project-vs-addfields.md)
