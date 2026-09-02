---
title: "$fill decides what a manufactured day is worth, and the answer is different for a flow, a level and a measurement"
sidebar_label: "5 · $fill and ordering"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-02 against the **MongoDB Manual (8.0)** —
> [`$fill`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/fill/)
> (*"populates `null` and missing field values within documents"*; `linear`
> *"returns an error if there are repeated values in the `sortBy` field in a
> single partition"*),
> [`$locf`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/locf/),
> [`$linearFill`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/linearFill/),
> [`$densify`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/densify/)
> (*"`$densify` does not guarantee sort order of the documents it outputs"*),
> [`$setWindowFields`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/setWindowFields/)
> (*"The `$setWindowFields` stage doesn't guarantee the order of the returned
> documents"*).
> Spine: **MongoDB 8.0** (8.2 minor) · driver **`mongodb` 7.5.0** · **Node 24 LTS**.

**`$densify` manufactured the missing days and left them empty.
`$fill` is the stage that decides what they are worth — and the whole of its
difficulty is that the correct answer depends on what kind of quantity the
series holds. A flow gets zero, a level gets the previous value, a measurement
gets interpolated, and getting it wrong produces a chart that looks more
plausible than the truth. This chunk also settles the two ordering disclaimers
that catch everyone, and answers the question this whole three-chunk detour
invites: why not just do it in JavaScript?**

## `$fill` puts the zeros in

```js
{$fill: {
  sortBy: {day: 1},
  output: {revenueCents: {value: 0}, orders: {value: 0}},
}}
```

The Manual's definition:

> *"populates `null` and missing field values within documents"*
> — [`$fill`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/fill/)

**Both** null and missing, which is why one stage covers both the days
`$densify` invented (where the field is absent) and any real bucket whose
aggregate came out null. Each entry in `output` takes **either** a `value` — a
fixed expression — **or** a `method`, and never both.

For revenue the answer is `{value: 0}`: a day with no orders earned nothing.
That is the direct translation of Phase 1's `coalesce(sum(o.total_cents), 0)`,
and the correspondence is exact — `coalesce` is a fill with a constant.

## Flow, level, measurement

The two `method` options exist for a different shape of question, and reaching
for them on a revenue series is a real bug rather than a stylistic one.

**`locf` — last observation carried forward.** *"Sets values for the numeric
field in the document to the field's last known non-`null` value in the
document's partition."* Correct for a quantity that **persists between
observations**: a stock count, a price, an inventory position, an exchange rate.
If nothing was recorded on Tuesday, Tuesday's stock is Monday's stock, and
carrying it forward is literally correct.

Two behaviours worth having: *"If a field contains only `null` or missing values
in a partition, `locf` sets the field to `null` for that partition"*, and null
or missing values appearing **before** the first non-null value in sort order
stay null — there is nothing to carry forward yet. So a `locf`-filled stock
series has nulls at the head, which the consumer must handle.

**`linear` — linear interpolation** between the surrounding non-null values.
Correct for a quantity that is **measured** and varies continuously between
samples: a sensor reading, a temperature. It fills proportionally, it can fill
several consecutive nulls, and values not bracketed by non-nulls on both sides
stay null. It also *"returns an error if there are repeated values in the
`sortBy` field in a single partition"*.

**`value` — a constant.** Correct for a quantity that **accumulates during an
interval**: revenue, order count, units sold, page views. If nothing happened,
the answer is zero, and no amount of surrounding data changes that.

The rule that separates them:

| Kind | Example in this app | Fill |
|---|---|---|
| Flow — accumulates over the interval | `revenueCents`, `orders`, units sold | `{value: 0}` |
| Level — persists until changed | `products.stock`, `priceCents` | `{method: 'locf'}` |
| Measurement — sampled continuously | none in this app; a sensor feed | `{method: 'linear'}` |

Revenue and order counts are flows. `locf` on a revenue series reports Sunday's
revenue as equal to Saturday's, produces a chart whose shape looks right, and
will survive review.

## `sortBy` is not optional as often as it looks

`sortBy` is *"Required if `method` is specified in output; otherwise optional"*.
The pipeline above specifies it anyway, with a `{value: 0}` fill that does not
need it, and that is deliberate: adding a `locf` field to an existing `$fill`
six months later without noticing that `sortBy` is missing is an error you would
rather have already avoided.

`sortBy` orders documents **within** a partition so `locf` and `linear` know
which value is "previous" and which two bracket a hole. It does **not** promise
anything about the stage's output order — which is the next section.

## Two stages that disclaim their output order

> *"`$densify` does not guarantee sort order of the documents it outputs. To
> guarantee sort order, use `$sort` on the field you want to sort by."*
> — [`$densify` — Order of Output](https://www.mongodb.com/docs/manual/reference/operator/aggregation/densify/)

The Manual's own partitioned example demonstrates it: the generated
`Arabica Typica` documents at altitudes 1000–1600 appear *after* every `Gesha`
document in the printed output, not interleaved in altitude order.

And the same disclaimer, in almost the same words, on the stage
[chunk 7](03-window-functions.md) adds next:

> *"The `$setWindowFields` stage doesn't guarantee the order of the returned
> documents."*
> — [`$setWindowFields` — Behavior](https://www.mongodb.com/docs/manual/reference/operator/aggregation/setWindowFields/)

So the `$sort: {day: 1}` at the end of the pipeline is not belt-and-braces, it
is required — and it must come **after** both stages. A pipeline that sorts
before densifying produces points in an arbitrary order, which on a line chart
draws a scribble and on a bar chart draws the right bars in the wrong places.

The trap is that neither stage *randomises*; both produce a stable order that
happens to be right for small inputs. Three days of test data come back in order.
Thirty days with a partition do not.

## Why not fill the gaps in JavaScript?

It is a real option and it is not obviously worse: build a `Map` from the
twenty-nine returned documents, walk the thirty days the API asked for, emit
zeroes for the misses. Six lines, no new stages, no `$densify` semantics to
remember.

```js
// the version that is NOT wrong, if you choose this route
function fillDays(rows, from, to, tz) {
  const byDay = new Map(rows.map(r => [r.day.toISOString(), r]));
  const out = [];
  for (const day of eachLocalDay(from, to, tz)) {   // NOT: +24h in a loop
    out.push(byDay.get(day.toISOString())
             ?? {day, revenueCents: 0, orders: 0});
  }
  return out;
}
```

Two arguments decide it for the pipeline.

**The spine and the aggregate have to agree about what a day is.** Doing the
truncation in `$dateTrunc(timezone)` and the iteration in JavaScript means two
independent implementations of "the store's calendar day". A loop that adds 24
hours is wrong twice a year: in a zone with daylight saving, one local day is 23
hours long and one is 25, so the JavaScript spine drifts off the `$dateTrunc`
buckets and two consecutive days collide on the same key. `eachLocalDay` above
has to be written against a real timezone library to be correct, at which point
the "six lines" claim is gone.

**Anything downstream in the pipeline sees the holes.** [Chunk 7](03-window-functions.md)
computes a seven-day moving average over this series, and a moving average over a
series with holes is wrong in a way that is very hard to see: a
`documents: [-6, 0]` window means "the six preceding *documents*", so with three
missing days it silently spans ten calendar days. The densification has to happen
*before* the window function, which means it has to happen in the pipeline.

Where the JavaScript version does win: when the API layer already owns the
calendar (it does — it computed `from` and `to`), the result is a single flat
series, and nothing downstream in the pipeline reads it as a series. That is the
"orders by status" panel, which needs its own version of this same fix and
cannot use `$densify` at all — the missing keys there are *strings*, not points
on a numeric or date axis, and `$densify` only densifies numbers and dates. See
[chunk 6](02-conditional-aggregates.md).

## Gotchas

**★ `$fill` with `locf` on a revenue series repeats yesterday's number.** It is
the wrong method for a flow, it produces a plausible-looking chart, and it will
survive review because the shape looks right. Zero-fill flows; carry levels
forward.

**★ `locf` leaves the head of the series null.** Values before the first
non-null in sort order have nothing to carry forward, so they stay null — and if
a whole partition is null, `locf` leaves the field null for that partition. A
stock chart filled with `locf` therefore still needs a null-safe consumer, which
is the opposite of what "fill" suggests.

**★ `$fill` with `linear` errors on repeated `sortBy` values.** If two documents
share a `day` — which happens the moment a second grouping key sneaks into
`$group._id` and the `$set` that flattens it forgets to carry it — the stage
fails outright rather than guessing. That is the good outcome; the bad one is
discovering the duplicate grouping key in production.

**★ `value` and `method` are mutually exclusive per output field.** `{value: 0,
method: 'locf'}` is not "zero unless there is a previous value"; it is an error.
The "zero at the head, carry forward after" behaviour has to be built from a
`locf` fill followed by a second `$fill` with `{value: 0}`, or from a `$set` with
`$ifNull`.

**★ The `$sort` must come after `$densify` and after `$setWindowFields`, not
before.** Both stages explicitly disclaim output ordering, and both produce a
stable-looking order on small inputs. A pipeline that sorts first passes its unit
test with three days of data and scrambles at thirty.

**★ The `$fill` `sortBy` and the final `$sort` are two different things.**
`sortBy` orders documents *within* the fill's partition so `locf`/`linear` know
which value is previous; it does not promise anything about the stage's output
order. With `{value: 0}` fills `sortBy` is not even required — and omitting it,
then adding a `locf` field six months later, is how a subtly wrong series ships.

**★ Gap-filling in JavaScript with a 24-hour loop is wrong twice a year.** In a
daylight-saving zone one local day is 23 hours and one is 25, so a
`+86_400_000` loop drifts off the `$dateTrunc` buckets and produces one day that
never matches and one that matches twice. If you fill in Node, iterate with a
timezone-aware calendar, not with milliseconds.

**★ Densifying and then `$facet`-ing is the wrong order.** If several panels need
the same spine, densify inside each sub-pipeline: a `$facet` sub-pipeline receives
whatever reached the `$facet`, and daily revenue buckets are already the wrong
granularity for the other panels. [Chunk 9](05-facet-and-one-round-trip.md) works
through what `$facet` can and cannot share.

**★ `$densify` cannot fill a missing *category* of a categorical axis.** It
densifies numeric and date fields only. The status-counts panel's missing
statuses are strings and need a different fix entirely
([chunk 6](02-conditional-aggregates.md)) — which is worth knowing before
spending an afternoon trying to make `$densify` do it.

## Interview questions

**★ Walk through why `$densify` and `$fill` are two stages instead of one.**
They answer different questions. `$densify` decides *which documents should
exist* — a pure function of the range, the step and the partition, with no
reference to the data's other fields. `$fill` decides *what value a missing field
should take* — a function of a constant or of the surrounding data, which is why
it also repairs `null`s in documents that were always there. Separating them
means you can densify without filling (rare) or fill without densifying (common:
a series with recorded-but-null readings). The cost of the separation is that
forgetting the second stage is easy and silent.

**★ When would `locf` be the right fill for this app?**
For a stock-level chart. `products.stock` is a level: if no movement was recorded
on Tuesday, Tuesday's stock is Monday's stock. Revenue and order counts are
flows — quantities accumulated *during* an interval — and the correct value for
an interval with no events is zero. Getting this backwards produces a chart that
looks more plausible than the truth, which is the worst kind of wrong, and no
stage will tell you.

**★ Why must the densification happen before the moving average rather than
after?**
Because a windowed aggregate over a series with holes silently computes over the
wrong window. A `documents: [-6, 0]` window means "the six preceding
*documents*"; if three days are missing, that window spans ten calendar days and
the "seven-day average" is nothing of the sort. Densifying first makes documents
and days the same thing again. The alternative is a `range: [-6, 0], unit: 'day'`
window, which counts calendar days directly and is robust to holes — but it still
divides by however many documents fell inside, so the average is over the days
that exist rather than over seven.

**★ Could you skip `$densify` and gap-fill in Node? What do you lose?**
You can, and for a flat single series with nothing downstream it is defensible.
You lose two things. The calendar is then implemented twice — once by
`$dateTrunc(timezone)`, once by JavaScript date arithmetic — and the two disagree
on the daylight-saving boundaries where a local day is 23 or 25 hours long. And
any downstream pipeline stage, a running total or a moving average, runs *before*
your JavaScript and therefore sees the holes. Fill in the pipeline when anything
in the pipeline depends on the series being complete; fill in Node when nothing
does and the calendar is already the API's problem.

**★ Both `$densify` and `$setWindowFields` say they do not guarantee output
order. Why would a stage ever not preserve order, and what is the practical
rule?**
Because both stages partition their input and process partitions independently —
there is no requirement that the partitions be re-interleaved, and interleaving
them would cost a merge the stage does not need. The practical rule is
unconditional: **any pipeline whose consumer cares about order ends with an
explicit `$sort`, placed after every stage that disclaims ordering**, naming
every field the consumer iterates by. Relying on observed order is the same class
of bug as relying on an unstable `$sort` for pagination — it works until the data
grows.

---

← Prev: [Partitioned spines](01d-partitioned-spines-and-limits.md) ·
[Overview](README.md) ·
Next → [Conditional aggregates](02-conditional-aggregates.md)
