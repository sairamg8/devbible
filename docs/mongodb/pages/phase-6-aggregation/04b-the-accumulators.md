---
title: "The accumulators"
sidebar_label: "04b · The accumulators"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the **MongoDB Manual** (v8.0) —
> [`$group`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/group/): the
> accumulators `$sum`, `$avg` — both of which **ignore non-numeric values** — `$min`, `$max`, `$push`,
> `$addToSet` (unique values), `$first`, `$last` and `$count`; and 🔴 when a pipeline **sorts and
> groups by the same field**, an index on that field lets `$group` find each group's first or last
> document quickly —
> [Aggregation Pipeline Limits](https://www.mongodb.com/docs/manual/core/aggregation-pipeline-limits/)
> for the **16 MiB** limit that applies to each **result document** (documents may exceed it *during*
> processing but not on the way out) —
> [BSON comparison order](https://www.mongodb.com/docs/manual/reference/bson-type-comparison-order/)
> for what `$min`/`$max` do across mixed types.
> **Documentation-validated; no console blocks.**

The [`$group` stage](./04-group-and-accumulators.md) decides *which documents belong together*. The
accumulators decide *what you get back about each group* — and every field that is not one of them is
discarded.

| Accumulator | What it does | The part people miss |
|---|---|---|
| `$sum` | adds the expression over the group | **ignores non-numeric values**; `{$sum: 1}` is the row count |
| `$avg` | mean of the expression | **ignores non-numeric values** — so the denominator is not the group size |
| `$min` / `$max` | lowest / highest value | uses BSON comparison order across mixed types, not just numbers |
| `$push` | an array of every value, in order | **unbounded** — the 16 MiB trap |
| `$addToSet` | an array of **unique** values | unbounded too, and **order is not guaranteed** |
| `$first` / `$last` | the first / last value **in the order documents arrive** | meaningless without a preceding `$sort` |
| `$count` | the number of documents in the group | equivalent to `{$sum: 1}` |

## `$sum` and `$avg` ignore non-numeric values

This is documented, quiet, and produces wrong numbers rather than errors. If `total` is a string on
some documents — because an import wrote `"49.99"` — then `$sum` skips those documents and returns a
revenue figure that is too low, with nothing to indicate anything happened.

`$avg` is worse, because the denominator moves too: it averages only the numeric values, so a group of
100 documents where 40 have string totals gives the mean of 60 — not a mean of 100 with 40 zeros. Both
readings are defensible; only one is what the report claims to show.

```js
// make the skip visible instead of silent
{ $group: {
    _id: "$sku",
    revenue: { $sum: "$total" },
    counted: { $sum: { $cond: [{ $isNumber: "$total" }, 1, 0] } },
    n:       { $sum: 1 },
} }
```

If `counted` and `n` differ, the revenue is wrong and you now know it. That three-line guard is
cheaper than the meeting about why finance's number and the dashboard's number disagree.

The alternative is to coerce and decide explicitly what a bad value means — `{$sum: {$toDouble:
"$total"}}` errors on an unconvertible value, and `$convert` with an `onError` lets you choose zero,
`null`, or a sentinel. Erroring loudly is usually the right choice for money.

### `{$sum: 1}` is the row count

`$sum` of a constant. It counts documents in the group, and it is the idiom you will see everywhere.
The `$count` accumulator does the same thing and reads better; both exist and neither is faster.

Do not confuse it with the **`$count` stage**, which is a different thing entirely: it collapses the
whole stream into a single `{n: <total>}` document and ends any per-group work.

## `$min` and `$max` follow BSON comparison order

They are not numeric operators. Across mixed types they use the same total ordering every comparison
in MongoDB uses — MinKey → Null → Numbers → String → Object → Array → BinData → ObjectId → Bool →
Date → Timestamp → Regex → MaxKey. So `$min` over a field that is sometimes a number and sometimes a
string returns the number, always, because numbers sort before strings — regardless of what the string
says.

Unlike `$sum` and `$avg`, they do **not** skip non-numeric values; they rank them. That is a different
failure mode from the same bad data: `$sum` under-reports, `$min` reports a value of the wrong type.

They are also the natural way to get a date range per group, since dates compare as dates:

```js
{ $group: { _id: "$customerId", firstOrder: { $min: "$placedAt" }, lastOrder: { $max: "$placedAt" } } }
```

## `$first` and `$last` are order-dependent — and this is the index case

They return the first and last value **in the order documents reached the stage**. With no preceding
`$sort` that order is unspecified — arbitrary, but stable enough to pass every test you write. This is
the classic "latest document per group":

```js
db.events.aggregate([
  { $match: { type: "login" } },
  { $sort: { userId: 1, at: -1 } },
  { $group: { _id: "$userId", lastLogin: { $first: "$at" }, lastIp: { $first: "$ip" } } },
]);
```

The `$sort` is not decoration — it is what makes `$first` mean "latest". Sort by the **group key
first**, then by the ordering field, so documents for a group arrive contiguously and in the order you
want.

🔴 **This is the one case where `$group` itself uses an index.** The Manual states that when a pipeline
sorts and groups by the same field, an index on that field lets `$group` find each group's first or
last document quickly. With `{userId: 1, at: -1}` indexed, the pipeline above does not sort the whole
matched set into memory and then scan it — the index already delivers documents in group order, so the
sort is free and the group can jump. Without that index the `$sort` is a blocking in-memory sort
subject to the 100 MiB limit, feeding a blocking `$group`: two accumulating stages back to back, which
is the shape of every "why is this report timing out" incident.

Note the sort direction has to match what the index can walk. `{userId: 1, at: -1}` serves that sort
and also its exact reverse; it does not serve `{userId: 1, at: 1}`.

## `$push` and `$addToSet` are the 16 MiB trap

Both build arrays with no bound. Each result document is subject to the 16 MiB BSON limit, and this is
where pipelines fail in production after months of working correctly.

```js
{ $group: { _id: "$customerId", orders: { $push: "$$ROOT" } } }   // ⚠️ whole documents, unbounded
```

For most customers this is fine. For the one customer with 40,000 orders, the result document exceeds
16 MiB and the pipeline errors — on that customer, on that day. The dataset that passed every test did
not have that customer yet. And because the limit applies to the **result**, not to intermediate
state, nothing warns you on the way.

Three fixes, in order of preference:

```js
// 1. push only what you need, not $$ROOT
{ $group: { _id: "$customerId", skus: { $push: "$sku" } } }

// 2. bound it — $slice after the group, or a $limit before it
{ $group: { _id: "$customerId", recent: { $push: { at: "$at", sku: "$sku" } } } },
{ $set:   { recent: { $slice: ["$recent", 10] } } }

// 3. don't accumulate at all — a count plus a second query is often the right shape
{ $group: { _id: "$customerId", n: { $sum: 1 } } }
```

Fix 2 is worth reading carefully: the `$slice` happens *after* the array was fully built, so it caps
the output but not the peak memory. It protects the 16 MiB result limit, not the 100 MB stage limit.
Only reducing the input protects both.

`$addToSet` deduplicates, which bounds it by **cardinality** rather than by document count — genuinely
safer for something like distinct SKUs per customer, still unbounded for something like distinct
session IDs. Its **order is not guaranteed**, so never index into the result; `$sortArray` afterwards
if the order matters.

## Accumulators are expressions, so they compose

Anything an accumulator takes is a full aggregation expression, which is where conditional aggregates
come from — several different totals over one pass of the data:

```js
{ $group: {
    _id: "$sku",
    revenue:  { $sum: "$total" },
    refunded: { $sum: { $cond: [{ $eq: ["$status", "refunded"] }, "$total", 0] } },
    paidOnly: { $sum: { $cond: [{ $eq: ["$status", "paid"] }, 1, 0] } },
} }
```

That is the aggregation equivalent of SQL's `SUM(CASE WHEN … THEN … END)`, and it is almost always
better than running the pipeline three times with different `$match` stages.

## Gotchas

**Symptom:** revenue is lower than the same figure computed in the application.
**Cause:** `$sum` **ignores non-numeric values**, so string totals from an import are skipped silently.
**Fix:** add a counter guarded by `$isNumber` and compare it against `{$sum: 1}`; fix the data, or
coerce with `$toDouble`/`$convert` and decide explicitly what a bad value should become.

**Symptom:** an average looks too high.
**Cause:** `$avg` ignores non-numeric values in the denominator as well as the numerator, so it is the
mean of the numeric subset rather than of the group.
**Fix:** as above — count what was actually included and make the discrepancy visible.

**Symptom:** `$min` on a price field returns a number when you expected a string, or vice versa.
**Cause:** `$min`/`$max` rank across BSON comparison order rather than skipping non-numeric values.
Numbers sort before strings, so a mixed-type field always yields a number from `$min`.
**Fix:** filter or coerce the type before grouping; do not assume `$min` behaves like `$sum` on bad
data — they fail differently on the same field.

**Symptom:** the pipeline errors with a BSON size error on one particular group.
**Cause:** `$push` — especially `$push: "$$ROOT"` — built a result document past 16 MiB. The limit is
on the result, so only a large group triggers it.
**Fix:** push individual fields rather than whole documents, `$slice` the array after the group, or
replace the accumulation with a count.

**Symptom:** `$slice` was added after a `$push` and the stage still exceeds the memory limit.
**Cause:** the array is fully built before it is sliced. `$slice` bounds the output, not the peak.
**Fix:** reduce the input with `$match`/`$limit`, or restructure so the group never accumulates
documents.

**Symptom:** `$first` returns a different document each run.
**Cause:** no `$sort` before the `$group`, so "first" is whatever happened to arrive first.
**Fix:** sort by the group key and then the ordering field — `{$sort: {userId: 1, at: -1}}` — and index
that pair, which is also what lets `$group` use an index for `$first`/`$last`.

**Symptom:** the "latest per group" pipeline is correct but times out at scale.
**Cause:** a blocking in-memory `$sort` feeding a blocking `$group`, with no index behind the sort.
**Fix:** create the compound index on the same `{groupKey, orderingField}` pair the sort uses. That is
the documented case where `$group` itself becomes index-assisted.

**Symptom:** the compound index exists and the sort still runs in memory.
**Cause:** the sort direction does not match a walk the index supports, or a reshaping stage sits
between the `$match` and the `$sort`.
**Fix:** match the index's direction pattern (or its exact reverse), and keep `$sort` immediately after
`$match`.

**Symptom:** `$addToSet` results are in a different order between runs.
**Cause:** it makes no ordering guarantee.
**Fix:** `$sortArray` afterwards if order matters, and never index into the raw result.

**Symptom:** someone used the `$count` **stage** expecting a per-group count and got one number.
**Cause:** the stage collapses the whole stream; the per-group version is the `$count` **accumulator**
or `{$sum: 1}`.
**Fix:** use the accumulator inside `$group`.

**Symptom:** three near-identical pipelines exist to compute paid, refunded and total revenue.
**Cause:** treating each total as its own query.
**Fix:** conditional accumulators — `{$sum: {$cond: [cond, "$total", 0]}}` — compute all of them in
one pass.

## Interview questions

**★ Why might a `$sum` over a numeric field return less than expected?**
Because `$sum` **ignores non-numeric values** — documented behaviour, and silent. A field that is a
string on some documents (a bad import, a half-finished migration) contributes nothing and raises no
error. `$avg` has the same behaviour, and it also shrinks the denominator, so it returns the mean of
the numeric subset rather than of the group. The defence is to count what was actually included, with
`$isNumber` inside a `$cond`, and compare that against `{$sum: 1}`.

**★ What is the risk of `$push`, and when does it bite?**
It builds an unbounded array, and each result document is subject to the 16 MiB BSON limit. Because the
limit applies to the *result*, a pipeline with `{$push: "$$ROOT"}` works until one group is large
enough — so it fails in production, on one customer, months after it was written. Push only the fields
you need, bound the array with `$slice` or an upstream `$limit`, or replace the accumulation with a
count. And note `$slice` after the group protects the 16 MiB result limit but not the 100 MB stage
limit, since the array is built first.

**★ How do you get the latest document per group, and how do you make it fast?**
`$sort` by the group key and then the timestamp descending, then `$group` with `$first`. `$first`
returns the first value **in the order documents arrive**, so without the sort it is arbitrary. To make
it fast, index the same pair of fields: the Manual states that when a pipeline sorts and groups by the
same field, an index on that field lets `$group` find each group's first or last document quickly —
which avoids a blocking in-memory sort feeding a blocking group.

**★ How do `$min`/`$max` behave on a field with mixed types, and how is that different from `$sum`?**
They rank rather than skip. `$min`/`$max` use BSON comparison order across all types — numbers sort
before strings — so `$min` on a field that is sometimes `"49.99"` returns a numeric value regardless of
what the strings hold. `$sum` and `$avg`, on the same field, silently *omit* the non-numeric documents.
Same bad data, two different wrong answers: one has the wrong type, the other has the wrong total.

**What is the difference between the `$count` stage and the `$count` accumulator?**
The stage collapses the entire stream into one document holding the total and ends per-group work. The
accumulator counts documents within each `$group` bucket and is equivalent to `{$sum: 1}`. They share a
name and do different jobs.

**How would you compute paid revenue and refunded revenue in a single pass?**
Conditional accumulators. Accumulator arguments are full aggregation expressions, so `{$sum: {$cond:
[{$eq: ["$status", "refunded"]}, "$total", 0]}}` alongside a plain `{$sum: "$total"}` gives both from
one scan — the aggregation equivalent of `SUM(CASE WHEN …)`.

**When is `$addToSet` safer than `$push`, and when is it not?**
It is bounded by the *cardinality* of the values rather than by the document count, so it is genuinely
safer for something like distinct SKUs per customer. It is no safer for high-cardinality values such as
session IDs, where every document contributes a unique entry. And it guarantees no ordering, so its
result must never be indexed into positionally.

**Does it matter whether you write `{$sum: 1}` or `{$count: {}}`?**
Not for behaviour or speed — both count documents in the group. `$count` reads more clearly; `{$sum: 1}`
is the older idiom you will meet in existing code.

---

← Prev: [`$group` — the stage](./04-group-and-accumulators.md) ·
Index: [Phase 6](./README.md) ·
Next → [`$sort`, `$limit` and `$skip`](./05-sort-limit-skip.md)
