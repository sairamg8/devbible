---
title: "$sort, $limit and $skip"
sidebar_label: "05 · $sort, $limit, $skip"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the **MongoDB Manual** (v8.0) —
> [`$sort`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/sort/): sort order `1`,
> `-1` and `{$meta: "textScore"}`; a **maximum of 32 keys**; *"the `$sort` operator can take advantage
> of an index if it's used in the first stage of a pipeline or if it's only preceded by a `$match`
> stage"*; stages needing more than **100 megabytes** write temporary files, with `allowDiskUse`
> overriding `allowDiskUseByDefault` in both directions; 🔴 **`$sort` is not a "stable sort"** —
> documents with equivalent sort keys *"are not guaranteed to remain in the same relative order"*, and
> the documented remedy is to include a field with unique values such as `_id` —
> [Pipeline Optimization](https://www.mongodb.com/docs/manual/core/aggregation-pipeline-optimization/):
> **`$sort` + `$limit` coalesce** into `{$sort: {sortKey: …, limit: Long(5)}}` when no intervening
> stage changes the document count, so the sort *"maintains only the top n results"*; **`$limit` +
> `$limit` merge to the smaller**; **`$skip` + `$skip` merge to the sum**; **`$sort` + `$skip` +
> `$limit`** raises the limit **by** the skip; `$skip` is hoisted above `$project`/`$unset`; and
> `$match` is moved above `$sort` *"to minimize the number of documents to sort"* —
> [Aggregation Pipeline Limits](https://www.mongodb.com/docs/manual/core/aggregation-pipeline-limits/)
> for `$sort` as a stage that can spill **only when it is not supported by an index**.
> **Documentation-validated; no console blocks.**

These three stages look like the simplest in the pipeline and carry more optimizer behaviour than any
of the others. Almost none of it is visible in the pipeline you wrote.

## `$sort` is either an index walk or a blocking in-memory sort

There is no third option, and which one you get decides everything about the stage's cost.

**Index-supported.** The Manual's condition is exact: `$sort` can use an index *"if it's used in the
first stage of a pipeline or if it's only preceded by a `$match` stage"*. The documents arrive already
in order, nothing accumulates, and the 100 MB limit is irrelevant.

**In-memory.** Anything else — a `$project`, `$addFields`, `$unwind`, `$group` or `$lookup` above it —
and the stage must collect every input document before it can emit the first one. It is blocking, it
holds the whole set, and it is subject to the 100 MB per-stage limit.

```js
// index-supported: $match, then $sort, with {status: 1, placedAt: -1} indexed
{ $match: { status: "paid" } },
{ $sort:  { placedAt: -1 } },

// in-memory: $addFields between them breaks the index path
{ $match:     { status: "paid" } },
{ $addFields: { margin: { $subtract: ["$total", "$cost"] } } },
{ $sort:      { placedAt: -1 } },       // ← now a blocking sort
```

The second pipeline is not wrong, and if the `$match` is selective it is perfectly fine. But it has
quietly changed category, and nothing in the source says so. **Keep `$sort` adjacent to `$match`**
whenever the sort is on a stored field — move the `$addFields` below it.

This is also why `$sort` appears twice in most real reporting pipelines: once early, index-supported,
to make `$first`/`$last` work in a `$group`, and once at the end, in memory over a handful of grouped
rows, for presentation order.

## `$sort` is not stable — and this is the pagination bug

The Manual says it outright: `$sort` is **not a "stable sort"**, and documents with equivalent sort
keys *"are not guaranteed to remain in the same relative order"* as in the input.

```js
{ $sort: { revenue: -1 } },   // ⚠️ ties break arbitrarily, and differently each run
{ $skip: 20 },
{ $limit: 10 }
```

Twelve products share a revenue of 0. Page 3 shows three of them; page 4 shows two of the same three
and misses one entirely. Nothing errors, the totals are right, and the missing row is only ever noticed
by the person looking for it.

**The fix is documented and is one field wide:** include something with unique values in the sort key.

```js
{ $sort: { revenue: -1, _id: 1 } }
```

Make this a habit for **every** sort that feeds pagination, and for every sort whose output is compared
between runs — snapshot tests included. `_id` is always available and always unique, so there is never
a reason not to.

The same reasoning is why cursor pagination beats `$skip` for anything user-facing: with a stable
tiebreaker you can say "after this `(revenue, _id)` pair" and get correctness that does not depend on
the page before it still holding the same rows.

Other `$sort` facts worth holding: **at most 32 keys**, and `{$meta: "textScore"}` as a sort value for
text search relevance rather than a field.

## The coalescences: what the server does to `$limit` and `$skip`

Four rewrites, all documented, all invisible unless you explain the pipeline.

**`$sort` + `$limit` → a top-*k* sort.** When a `$limit` follows a `$sort` with no intervening stage
that changes the document count, the optimizer folds the limit *into* the sort:

```js
// as written
{ $sort: { age: -1 } }, { $project: { age: 1, status: 1, name: 1 } }, { $limit: 5 }

// as executed
{ $sort: { sortKey: { age: -1 }, limit: Long(5) } }, { $project: { age: 1, status: 1, name: 1 } }
```

Note that `$project` did **not** block the coalescence — it does not change the document count. The
effect is large: the sort *"maintains only the top n results"* in memory rather than the whole set,
which turns a stage that might spill at 100 MB into one holding five documents. This is the single
most valuable optimization in this group, and the way to get it is simply to put a `$limit` after
your `$sort`.

**`$limit` + `$limit` → the smaller.** `{$limit: 100}, {$limit: 10}` becomes `{$limit: 10}`. So a
generic helper that appends a safety limit costs nothing when the caller already supplied a tighter
one.

**`$skip` + `$skip` → the sum.** `{$skip: 5}, {$skip: 2}` becomes `{$skip: 7}`.

**`$sort` + `$skip` + `$limit` → the limit is raised *by* the skip.**

```js
// as written
{ $sort: { age: -1 } }, { $skip: 10 }, { $limit: 5 }

// as executed
{ $sort: { sortKey: { age: -1 }, limit: Long(15) } }, { $skip: Long(10) }
```

This is the correct arithmetic and it is exactly why `$skip` does not scale: to return rows 10–15 the
server sorts and retains 15. To return rows 100,000–100,010 it retains 100,010. `$skip` is O(offset),
always, and no index changes that — the work is proportional to how deep the page is.

**`$skip` is also hoisted above `$project` and `$unset`**, so the reshaping only runs on the documents
that survive the skip.

## Pagination: what to actually write

```js
// fine for a few pages, and honest about its cost
{ $match: filter },
{ $sort:  { placedAt: -1, _id: 1 } },   // tiebreaker, always
{ $skip:  page * size },
{ $limit: size }
```

For deep pages, range ("seek") pagination instead — carry the last row's sort key forward:

```js
{ $match: { ...filter, $or: [
    { placedAt: { $lt: lastPlacedAt } },
    { placedAt: lastPlacedAt, _id: { $gt: lastId } },   // the tiebreaker, as a predicate
] } },
{ $sort: { placedAt: -1, _id: 1 } },
{ $limit: size }
```

Constant cost per page, and it cannot skip or repeat a row when the underlying data changes between
requests — which offset pagination can and does. The `$or` is the same tiebreaker logic expressed as a
filter, which is why the unique second sort key was never optional.

For "a page **and** a total count in one round trip" — the phase gate — use `$facet`, with the sort,
skip and limit in one branch and a `$count` in the other. Both branches see the same `$match`ed input,
so the count is consistent with the page.

## Gotchas

**Symptom:** the same row appears on two consecutive pages, or a row is never shown.
**Cause:** ties in the sort key and an unstable sort. Documented: `$sort` is not stable.
**Fix:** add a unique tiebreaker — `{revenue: -1, _id: 1}`. On every paginated sort, without exception.

**Symptom:** a snapshot test on an aggregation passes locally and flakes in CI.
**Cause:** the same instability. Equal keys come back in a different order.
**Fix:** the same `_id` tiebreaker.

**Symptom:** an index exists on the sort field and `$sort` still sorts in memory.
**Cause:** something other than `$match` precedes it — `$project`, `$addFields`, `$unwind`, `$group`,
`$lookup`. Index use requires the first stage, or only `$match` before it.
**Fix:** move the `$sort` up next to the `$match` and push the reshaping stage below it.

**Symptom:** "Exceeded memory limit" on a `$sort`.
**Cause:** an in-memory sort over 100 MB. `$sort` only spills when it is **not** index-supported.
**Fix:** support it with an index, or add a `$limit` after it so the coalescence turns it into a top-*k*
sort. The Manual gives exactly this advice. `allowDiskUse: true` makes it finish, slowly.

**Symptom:** deep pages get slower and slower.
**Cause:** `$skip` is O(offset), and the documented rewrite proves it — `$skip: 10, $limit: 5` becomes
a sort that retains 15.
**Fix:** range pagination on `(sortField, _id)`. No index makes `$skip` cheap.

**Symptom:** a `$limit` was added after a `$group` to make it faster, and nothing changed.
**Cause:** `$group` is blocking; a limit below it trims the result after all the work.
**Fix:** limit or `$match` the input instead. The `$sort`+`$limit` coalescence only helps a sort.

**Symptom:** two `$limit` stages in a composed pipeline and a worry about which wins.
**Cause:** none — they coalesce to the smaller.
**Fix:** none. Layering a safety limit over a caller-supplied one is free.

**Symptom:** a `$sort` on a computed field is slow no matter what index is added.
**Cause:** the field does not exist on disk, so no index can cover it, and the `$addFields` that
creates it breaks the index path anyway.
**Fix:** either store the value (compute it on write) or accept the in-memory sort and keep the input
small with `$match`.

**Symptom:** `$sort` errors about the number of keys.
**Cause:** more than the documented maximum of 32.
**Fix:** reduce the key; nothing meaningful needs 33.

**Symptom:** sorting by text relevance returns an arbitrary order.
**Cause:** sorting on a field rather than on the score.
**Fix:** `{$sort: {score: {$meta: "textScore"}}}`.

**Symptom:** the total count and the page disagree — the count says 240, the pages hold 238 rows.
**Cause:** two separate queries against a collection that changed between them.
**Fix:** `$facet`, so both branches run over one snapshot of the same input.

**Symptom:** `$limit` after `$sort` did not produce a top-*k* sort in the plan.
**Cause:** a stage between them changes the document count — a `$match`, a `$unwind`, a `$group` —
which blocks the coalescence. A `$project` does not.
**Fix:** move the count-changing stage above the `$sort`, or accept the full sort.

## Interview questions

**★ When can `$sort` use an index, and what happens when it can't?**
Only when it is the **first stage** of the pipeline or is **preceded only by `$match`** — that is the
Manual's exact condition. Then documents arrive in order and the stage costs nothing extra. Otherwise
it is a blocking in-memory sort: it must collect every input document before emitting the first, and it
is subject to the 100 MB per-stage limit, spilling to temporary files or erroring depending on
`allowDiskUseByDefault`. A single `$project` or `$addFields` between the `$match` and the `$sort` is
enough to move it from the first category to the second, silently.

**★ Why does a paginated aggregation sometimes show the same row twice?**
Because `$sort` is **not a stable sort** — documents with equivalent sort keys have no guaranteed
relative order, so two executions can interleave the ties differently. With `$skip`/`$limit` on top,
that means a row can fall on both sides of a page boundary, or on neither. The documented fix is to
include a field with unique values in the sort key, normally `_id`: `{revenue: -1, _id: 1}`.

**★ What does the optimizer do with `$sort` followed by `$limit`?**
It coalesces them into a single top-*k* sort — `{$sort: {sortKey: {age: -1}, limit: Long(5)}}` — so
long as no intervening stage changes the document count (a `$project` is fine; a `$match` or `$unwind`
is not). The sort then maintains only the top *n* results in memory instead of the whole set, which is
the difference between a stage that spills at 100 MB and one holding five documents. It is also the
Manual's own recommendation for a `$sort` that exceeds the memory limit.

**★ Why is `$skip` a bad way to paginate deeply, and what do you use instead?**
Because it is O(offset). The documented rewrite makes it explicit: `$sort`, `$skip: 10`, `$limit: 5`
executes as a sort with `limit: Long(15)` followed by the skip — the server produces and retains
`skip + limit` rows. At offset 100,000 it retains 100,010, and no index changes that. It is also
unstable against concurrent writes, so rows shift between pages. The alternative is range or "seek"
pagination: carry the last row's `(sortField, _id)` forward as an `$or` predicate, which is constant
cost per page and cannot duplicate or drop a row.

**What do adjacent `$limit` and `$skip` stages do?**
`$limit` + `$limit` coalesces to the **smaller** value; `$skip` + `$skip` coalesces to the **sum**. So
composing pipelines from fragments — a caller's limit plus a library's safety limit — costs nothing.
`$skip` is additionally hoisted above `$project` and `$unset`, so the reshaping runs only on documents
that survive it.

**How do you return a page of results and a total count in one round trip?**
`$facet`, with the `$sort`/`$skip`/`$limit` chain in one branch and `$count` in the other. Both
sub-pipelines run over the same input, so the count matches the page — which two separate queries
against a live collection cannot guarantee.

**Your `$sort` blows the memory limit. What are the options, in order?**
Support it with an index by moving it to the first stage or immediately after `$match`; add a `$limit`
so it becomes a top-*k* sort; reduce the input with a more selective `$match`. `allowDiskUse: true` is
last — it converts an error into a slow query backed by temporary files, which treats the symptom.

**Why does a report pipeline often contain two `$sort` stages?**
The first is index-supported, before a `$group`, and exists to give `$first`/`$last` meaning. `$group`
discards input order, so the second `$sort` — over the small grouped result, in memory — establishes the
order the user actually sees. They do different jobs and neither replaces the other.

---

← Prev: [The accumulators](./04b-the-accumulators.md) ·
Index: [Phase 6](./README.md) ·
Next → **`$unwind`** *(not written yet)*
