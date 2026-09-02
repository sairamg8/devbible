---
title: "generate_series becomes $densify, a stage that manufactures the missing days and then leaves them empty on purpose"
sidebar_label: "3 · $densify"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-02 against the **MongoDB Manual (8.0)** —
> [`$densify`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/densify/)
> (*"Creates new documents in a sequence of documents where certain values in a
> field are missing"*; *"The lower bound is inclusive"*, *"The upper bound is
> exclusive"*, *"`$densify` does not filter out documents with `field` values
> outside of the specified bounds"*),
> [`$group`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/group/).
> Counterpart:
> [1·09 — dashboard queries](../../phase-1-database/09-dashboard-queries.md).
> Spine: **MongoDB 8.0** (8.2 minor) · driver **`mongodb` 7.5.0** · **Node 24 LTS**.

**Phase 1's revenue query opened with `generate_series` and left-joined the
orders onto it. That spine existed for exactly one reason — a day with no orders
must appear on the chart as a zero, not as an absence — and dropping it was
listed as a gotcha, because the query still returns correct-*looking* results
without it. MongoDB has no left join and no series generator, so the same
requirement is met by two stages that run after the `$group`. This chunk is the
first of them: `$densify`, which manufactures the missing days and deliberately
does not put anything in them. [Chunk 4](01d-partitioned-spines-and-limits.md)
densifies more than one series at once; [chunk 5](01e-fill-and-ordering.md) is
`$fill`, which puts the numbers in.**

## What goes wrong without a spine

`{$group: {_id: {$dateTrunc: …}}}` emits one document per day **that has at
least one matching order**. Thirty days of orders with a quiet Sunday in the
middle produce twenty-nine documents. Nothing in the response says a day is
missing. Phase 4's chart receives twenty-nine points, plots them evenly spaced,
and draws a line that interpolates across the gap — so a zero-revenue Sunday
renders as a gentle slope between Saturday and Monday rather than a drop to the
floor. If the chart plots against real dates it instead shows the wrong number
of bars, which is at least visible.

Phase 1's fix was the spine plus `coalesce(sum(o.total_cents), 0)`. The MongoDB
fix is `$densify` plus `$fill`.

## The whole pipeline, so the two stages have a place to sit

```js
export function revenueByDayPipeline({from, to}) {
  return [
    {$match: {
      createdAt: {$gte: from, $lt: to},
      status: {$in: REVENUE_STATUSES},
    }},
    {$group: {
      _id: {$dateTrunc: {date: '$createdAt', unit: 'day', timezone: TZ}},
      revenueCents: {$sum: '$totalCents'},
      orders:       {$sum: 1},
    }},
    {$set: {day: '$_id'}},                    // densify wants a named field
    {$densify: {
      field: 'day',
      range: {step: 1, unit: 'day', bounds: [from, to]},
    }},
    {$fill: {
      sortBy: {day: 1},
      output: {revenueCents: {value: 0}, orders: {value: 0}},
    }},
    {$sort: {day: 1}},                        // $densify does NOT guarantee order
    {$project: {_id: 0, day: 1, revenueCents: 1, orders: 1}},
  ];
}
```

Seven stages where SQL had one query, and every added stage is load-bearing.
Note where the two new stages sit: **after `$group`**, operating on daily
buckets rather than on orders. Densifying the orders themselves would
manufacture fake orders, which is a different and much worse mistake.

## `$densify` manufactures documents; it does not fill them

The Manual's definition is the whole thing in one sentence:

> *"Creates new documents in a sequence of documents where certain values in a
> field are missing."*
> — [`$densify`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/densify/)

Note *creates*, not *completes*. The documents it manufactures carry the
densified field and the partition fields — in the Manual's own worked example,
densifying `timestamp` hourly produces entries spelled
`{ timestamp: ISODate("2021-05-18T01:00:00.000Z") }`, with none of the
`metadata` or `temp` fields the real documents carry, and the partitioned coffee
example produces `{ variety: 'Arabica Typica', altitude: 800 }` and nothing
else.

The Manual does not state that behaviour in prose anywhere I could find — it is
visible only in the documented example output — so treat it as "the manual's
examples show" rather than "the manual guarantees". Either way the practical
consequence is not in doubt: **a densified day has no `revenueCents` field at
all**, and `undefined` reaching a chart is worse than a gap, because it plots as
zero in some libraries and breaks the line in others.

That is what `$fill` is for. `$densify` alone is a half-finished spine.

## `range.step` and `range.unit`

`step` is *"The amount to increment the `field` value in each document"* and is
required. `unit` is *"Required if `field` is a date"* and takes one of
`millisecond`, `second`, `minute`, `hour`, `day`, `week`, `month`, `quarter`,
`year`. When `unit` is specified, `step` must be an integer.

The pairing is checked, and the check cuts both ways: `$densify` errors if a
date-valued field is densified without a `unit`, and *also* if a numeric field
is densified *with* one. There is no coercion, which is the right design — a
"step of 1" over dates is meaningless until you say one what.

For this app the interesting non-day case is `{step: 4, unit: 'hour'}` for an
intraday chart, which pairs with `$dateTrunc`'s `binSize: 4`. The two numbers
have to agree; a four-hour truncation densified hourly produces three empty bars
between every real one.

## `range.bounds` — and why `"full"` is the wrong answer here

`bounds` takes either an array or one of the strings `"full"` and `"partition"`.
The Manual:

> *"If `bounds` is `"full"`: `$densify` adds documents spanning the full range of
> values of the `field` being densified."*

The full range **of the values that are present**. If the store's first order in
the window was on day 5 and its last was on day 20, `"full"` densifies days 5
through 20 and the chart still starts on day 5 — which is precisely the gap the
spine was supposed to remove. A thirty-day chart needs the thirty days it asked
for, so the bounds must be the *requested* range, stated explicitly as an array:

```js
range: {step: 1, unit: 'day', bounds: [from, to]}
```

`"partition"` is `"full"` applied per partition — *"adds documents to each
partition, similar to if you had run a `full` range densification on each
partition individually"* — and has the same defect here for the same reason.
It earns its keep when the partitions genuinely have different lifespans (a
per-product series where each product has its own first and last sale), which is
not this chart.

The array's semantics are asymmetric, which matters when `from`/`to` are already
half-open from the `$match`:

> *"The lower bound is inclusive."* · *"The upper bound is exclusive."*
> — [`$densify` — `range.bounds` Behavior](https://www.mongodb.com/docs/manual/reference/operator/aggregation/densify/)

That is a gift: `[from, to)` in `$densify` is exactly `[from, to)` in the
`$match`, so the same two values serve both stages and the spine cannot
accidentally grow a thirty-first bar.

Two more sentences from the same section are worth having:

> *"The lower bound indicates the start value for the added documents,
> irrespective of documents already in the collection."*

> *"`$densify` does not filter out documents with `field` values outside of the
> specified bounds."*

The second one is the one that surprises people: `$densify` is **not** a filter.
If a document sits outside the bounds it passes straight through, un-touched and
un-densified. In this pipeline that cannot happen because the `$match` already
constrained the range — but the moment someone widens the `$match` and forgets
the bounds, extra bars appear on the chart and no stage complains.

MongoDB 8.0 also changed the degenerate case:

> *"Starting in MongoDB 8.0, `$densify` treats bounds with an equal lower and
> upper bound as an empty set and does not generate a document with the bound as
> the field value."*

So a "today only" report with `bounds: [midnight, midnight]` produces **no**
spine on 8.0 and produced a single-day spine on 7.0 and earlier. A one-day chart
needs `[midnight, tomorrowMidnight]`.

## Gotchas

**★ `bounds: "full"` densifies only the range of values that exist, so the chart
still starts at the first day with an order.** It is the most natural-looking
option and it silently fails to do the one thing the spine is for. Pass the
explicit `[from, to]` array — the same two values the `$match` uses.

**★ `$densify` creates documents without the aggregate fields, and `undefined`
is not `0`.** The manufactured day has a `day` and nothing else. Charting
libraries disagree about what to do with a missing series value; some plot zero,
some break the line, some throw. Always pair `$densify` with `$fill`
([chunk 5](01e-fill-and-ordering.md)).

**★ `$densify` on `_id` is asking for trouble; `$set` a named field first.** The
Manual's `field` restrictions say `$densify` errors if the field name begins with
`$`, and require the values to be all-numeric or all-dates. `_id` after a
`$group` on `$dateTrunc` *is* all dates, so it technically works — but every
later stage then has an `_id` that is sometimes a real group key and sometimes a
manufactured one, and the `$project` that renames it has to run after
densification instead of before. Naming the field once, at the top, keeps the
rest of the pipeline honest.

**★ `$densify` does not filter.** A document outside `bounds` passes through
untouched. Widen the `$match` without widening the bounds and the chart grows
bars nobody asked for; narrow the `$match` without narrowing the bounds and it
grows empty ones. The two ranges are one decision and should be one variable.

**★ `bounds: [x, x]` generates nothing on MongoDB 8.0 and generated one document
before it.** A "today" report written against 7.0 and deployed onto 8.0 loses its
only spine document and silently returns an empty chart on a day with no orders.
The upper bound is exclusive; a one-day range is `[midnight, midnight + 1 day]`.

**★ A date field densified without `unit` errors, and so does a numeric field
densified with one.** There is no coercion in either direction. This is the
error you hit first when you copy a numeric example onto a date series, and the
message names the field, so it is a two-minute bug — unlike everything else on
this list.

**★ `$densify`'s step and `$dateTrunc`'s `binSize` must agree.** Truncating to
four-hour bins and densifying hourly manufactures three empty points between
every real one, all of which `$fill` then dutifully zeroes. The chart is not
wrong so much as meaningless, and nothing errors.

## Interview questions

**★ Why does grouping alone omit empty days, and why is that a bug rather than a
representation choice?**
`$group` emits one document per distinct key *present in its input*, so a day
with no matching order produces no key and therefore no document. It is a bug
because the consumer — a chart — treats the returned array as a series and has
no way to distinguish "no data for this day" from "this day was not requested".
The API's contract is "thirty points for thirty days"; anything that silently
returns twenty-nine has broken it. Postgres had exactly the same behaviour and
exactly the same fix; the spine is not a MongoDB workaround.

**★ Where in the pipeline does `$densify` have to sit, and what happens if it
sits somewhere else?**
After the `$group` that creates the buckets, and before anything that reads the
series as a series. Above the `$group` it densifies *orders*, manufacturing
documents that look like orders and have no `totalCents` — which the `$group`
then counts, inflating the order count for every empty day by one. Below a
window function it arrives too late, and the window has already computed over a
series with holes.

**★ Why is `bounds: "full"` almost never what a dashboard wants?**
Because "full" means the full range of values *present in the data*, and the
whole purpose of the spine is to represent days where there is no data. If the
absence is at the edge of the window — the store had a quiet first week — "full"
starts the series at the first real order and the chart silently reports a
shorter period than the user asked for. The requested range is a parameter of
the request, so it has to be passed in, not inferred.

---

← Prev: [Dates, money and the status set](01b-dates-money-and-the-status-set.md) ·
[Overview](README.md) ·
Next → [Partitioned spines and the generation limit](01d-partitioned-spines-and-limits.md)
