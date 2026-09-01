---
title: "$group — the stage"
sidebar_label: "04 · $group — the stage"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the **MongoDB Manual** (v8.0) —
> [`$group`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/group/): `_id` is the
> group key and **`null` or a constant produces a single document over all input**; **`$group` is a
> blocking stage**; it writes temporary files when it exceeds **100 MB** and errors if `allowDiskUse`
> is false —
> [Aggregation Pipeline Limits](https://www.mongodb.com/docs/manual/core/aggregation-pipeline-limits/)
> for `$group` among the stages that can spill and the **16 MiB** limit on each result document —
> [Pipeline Optimization](https://www.mongodb.com/docs/manual/core/aggregation-pipeline-optimization/)
> for `$group` executed by the slot-based engine from 5.2 (`queryPlanner.winningPlan.queryPlan.stage:
> "GROUP"`) when it is the first stage or all preceding stages are also SBE-compatible.
> **Documentation-validated; no console blocks.**

`$group` is where a pipeline stops being a filtered list and becomes an answer. It is also the stage
that breaks the most things, because it does three destructive things at once: it collapses many
documents into one, it discards every field you did not accumulate, and it blocks until it has seen
every input document.

```js
{ $group: { _id: "$lines.sku", revenue: { $sum: "$lines.total" }, orders: { $sum: 1 } } }
```

Read it as: *one output document per distinct `_id`, carrying only the fields named here.*

This page is the stage. The accumulators — `$sum`, `$avg`, `$push`, `$first` and the rest, each with
its own trap — are [the next page](./04b-the-accumulators.md).

## `_id` is the group key, and it is mandatory

Whatever you put in `_id` defines "same group". It can be:

**A field path** — one document per distinct value.

```js
{ $group: { _id: "$status", n: { $sum: 1 } } }
```

**A composite key**, as a document — one per distinct *combination*.

```js
{ $group: {
    _id: { customer: "$customerId", month: { $dateTrunc: { date: "$placedAt", unit: "month" } } },
    spend: { $sum: "$total" },
} }
```

Note the shape of the output: `_id` is now a subdocument, and every stage below has to say
`"$_id.customer"`, not `"$customerId"`. Forgetting that is the most common error immediately after a
composite group.

**An expression** — group by something computed, without a preceding `$addFields`.

```js
{ $group: { _id: { $toLower: "$email" }, n: { $sum: 1 } } }
```

**`null`, or any constant** — the Manual's documented way to get **one document over the entire
input**. This is the totals row:

```js
{ $group: { _id: null, revenue: { $sum: "$total" }, orders: { $sum: 1 } } }
```

`_id` cannot be omitted. `{$group: {n: {$sum: 1}}}` is an error, not an implicit total.

### The key's cardinality is the memory bill

One accumulator entry is held per distinct key, for the whole stage. Grouping by `"$status"` over a
billion documents costs almost nothing — there are six statuses. Grouping by `"$sessionId"` over a
month costs one entry per session. The key you choose, not the collection size, is what decides
whether this stage fits in memory.

Coarsening the key is therefore a real fix: `$dateTrunc` to the hour instead of grouping by an exact
timestamp collapses millions of keys into thousands.

## `$group` is blocking

It cannot emit anything until it has seen the last input document, because until then it does not
know whether another document belongs to a group. Three consequences follow, and all three surprise
people.

**No streaming, so a downstream `$limit` saves nothing.** `{$limit: 10}` after a `$group` limits the
*output*, after every input document has already been read and accumulated. To make a grouping
pipeline cheaper you must reduce what reaches it — which is [topic 02](./02-match-first.md) again.

**Memory, and the 100 MB stage limit.** With `allowDiskUseByDefault` true (the default from 6.0) the
stage spills to temporary files and keeps going, slowly; with it false, the stage errors. Neither is
a fix — both are the stage telling you the wrong volume of data arrived.

**Input order is discarded.** `$group` makes no promise about the order of its output documents. If
you sorted before grouping — which you must, for `$first`/`$last` to mean anything — that sort has
served its purpose and does not survive. Sort **again** after the group if the presentation order
matters.

### The one time `$group` itself reaches an index

Normally `$group` is pure computation over whatever it is handed. The documented exception is worth
knowing: when a pipeline **sorts and groups by the same field**, an index on that field lets `$group`
find each group's first or last document quickly, rather than sorting everything into memory first.
That mechanism, and the `$first`/`$last` idiom it exists for, are covered on
[the accumulators page](./04b-the-accumulators.md).

Separately, from 5.2 the **slot-based execution engine** can execute `$group` — when it is the first
stage, or when every preceding stage is also SBE-compatible. You confirm it in the plan by
`queryPlanner.winningPlan.queryPlan.stage: "GROUP"`. This is not something you configure; it is
something you check when a group is slower than it should be.

## Everything not accumulated is deleted

`$group` output has exactly the fields you named: `_id`, and the accumulators. Nothing else survives —
not `name`, not `createdAt`, not `_id` in its original sense.

```js
{ $group: { _id: "$customerId", spend: { $sum: "$total" } } },
{ $match: { status: "active" } },      // matches nothing — status is gone
{ $sort: { name: 1 } },                // sorts on null for everything
```

Neither line errors. A missing field is `null`, so the `$match` quietly matches nothing and the
`$sort` ties every document.

To carry a field through, accumulate it deliberately — `{name: {$first: "$customerName"}}` when it is
constant within the group — or re-join it afterwards with a `$lookup`. There is no "keep the other
fields" option, **by design**: the question "which `name`?" has no answer for a group of 40
documents. The stage forces you to say.

## Grouping twice, and `$facet`

A second `$group` over the output of the first is the standard shape for "per X, and then a total".
It is worth knowing because the instinct is to run two queries instead.

```js
db.orders.aggregate([
  { $match: { placedAt: { $gte: since } } },
  { $group: { _id: "$sku", revenue: { $sum: "$total" } } },
  { $group: { _id: null, skus: { $sum: 1 }, total: { $sum: "$revenue" }, top: { $max: "$revenue" } } },
]);
```

The second group's input is the first's output, so it sums `"$revenue"` — the accumulator's name —
not `"$total"`, which no longer exists.

`$facet` is the other tool: it runs several sub-pipelines over the **same** input and returns all
their results in one document. That is how the phase gate gets a paginated page of rows *and* a total
count in a single round trip, rather than as a rollup of one another.

```js
{ $facet: {
    rows:  [{ $sort: { revenue: -1 } }, { $skip: skip }, { $limit: 10 }],
    total: [{ $count: "n" }],
} }
```

## Gotchas

**Symptom:** `$group` errors and the message mentions `_id`.
**Cause:** `_id` was omitted. It is mandatory — there is no implicit "group everything".
**Fix:** `_id: null` for a grand total, or the key expression.

**Symptom:** output of a composite `$group` cannot be matched or sorted by the original field names.
**Cause:** the key is now a subdocument under `_id`.
**Fix:** address it as `"$_id.customer"`, or flatten it with `$set` immediately after the group.

**Symptom:** a `$match` or `$sort` after `$group` silently does nothing.
**Cause:** the field was not accumulated, so it does not exist. Missing is `null`.
**Fix:** accumulate it with `$first` if it is constant within the group, or `$lookup` it back.

**Symptom:** results come back in a different order than the `$sort` above the `$group` specified.
**Cause:** `$group` does not preserve input order in its output.
**Fix:** `$sort` **after** the `$group` for presentation order. The sort before it exists only to make
`$first`/`$last` meaningful.

**Symptom:** "Exceeded memory limit" on a `$group` that works elsewhere.
**Cause:** high group cardinality — one accumulator entry per distinct key — crossing 100 MB, with
`allowDiskUseByDefault` false on that deployment.
**Fix:** narrow the input with `$match` first, or coarsen the key (group by hour with `$dateTrunc`,
not by exact timestamp). `allowDiskUse: true` makes it finish, slowly.

**Symptom:** `{$limit: 10}` after `$group` did not make the query faster.
**Cause:** `$group` is blocking — it processes everything before emitting anything.
**Fix:** limit or `$match` the *input*. A limit above the group only trims the result set.

**Symptom:** a second `$group` sums `"$total"` and gets zero.
**Cause:** after the first group, `total` no longer exists — only `_id` and the first group's
accumulator names do.
**Fix:** sum the accumulator: `{$sum: "$revenue"}`.

**Symptom:** you need a page of rows and a total count, and the code runs two aggregations.
**Cause:** treating them as separate questions. They are two sub-pipelines over one input.
**Fix:** `$facet`, with a `rows` branch and a `$count` branch. One round trip.

**Symptom:** a `$group` that should be fast shows no `GROUP` stage in the plan.
**Cause:** the slot-based engine only executes `$group` when it is first or every preceding stage is
SBE-compatible; something upstream fell back to the classic engine.
**Fix:** check the plan for `stage: "GROUP"` and simplify what precedes the group if the difference
matters.

## Interview questions

**★ What does `$group`'s `_id` do, and what happens if you set it to `null`?**
`_id` is the group key — one output document per distinct value of it. It can be a field path, a
composite document, or any expression. Setting it to `null` (or any constant) is the documented way to
produce a **single document over the entire input**, which is how you compute a grand total. It cannot
be omitted; a `$group` without `_id` is an error.

**★ Why is `$group` described as blocking, and what follows from that?**
It cannot emit a group until it has seen every input document, since another matching document could
still arrive. Three things follow: a `$limit` after it saves no work, because everything has already
been read; it holds one accumulator entry per distinct key in memory, subject to the 100 MB stage
limit and to spilling; and it discards input order, so a `$sort` above it does not survive it.

**★ What happens to fields you don't accumulate?**
They are gone. `$group` output has `_id` and the named accumulators, nothing else — and referencing a
vanished field yields `null` rather than an error, so a later `$match` matches nothing and a later
`$sort` ties everything, both silently. That loss is inherent to the operation: for a group of 40
documents there is no single answer to "which `name`?". Carry a group-constant field explicitly with
`$first`, or re-attach it afterwards with `$lookup`.

**★ A `$group` exceeds the memory limit. What actually determines that, and what do you change?**
The **cardinality of the group key**, not the size of the collection — the stage holds one accumulator
entry per distinct key. Grouping a billion documents by `status` is trivial; grouping a month of
events by `sessionId` is not. So the fixes are to reduce the input with an early `$match`, or to
coarsen the key — `$dateTrunc` to the hour rather than grouping on an exact timestamp. Enabling
`allowDiskUse` only converts the error into a slow query backed by temporary files.

**How do you produce both per-SKU revenue and an overall total in one query?**
Group twice: by SKU, then again with `_id: null` over that output, summing the **accumulator's** name
rather than the original field, which no longer exists. When the two results need different shapes
rather than a rollup — a page of rows plus a total count — `$facet` runs both sub-pipelines over the
same input in a single round trip.

**Does `$group` ever use an index?**
Yes, in one documented case: when the pipeline sorts and groups by the same field, an index on that
field lets `$group` locate each group's first or last document quickly instead of sorting the whole
input in memory. That is the `$first`/`$last` "latest per group" idiom, and the index is what makes it
viable at scale.

**After a composite `$group`, why does `{$match: {customerId: …}}` return nothing?**
Because the field is now `_id.customer`. The composite key is a subdocument under `_id`, and the
original top-level names are not part of the output.

---

← Prev: [`$project` vs `$addFields` / `$set`](./03-project-vs-addfields.md) ·
Index: [Phase 6](./README.md) ·
Next → [The accumulators](./04b-the-accumulators.md)
