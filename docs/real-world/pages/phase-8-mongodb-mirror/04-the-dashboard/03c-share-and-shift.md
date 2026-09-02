---
title: "Share-of-total and period-over-period are both divisions, and MongoDB gives you neither nullif nor a documented answer for a zero divisor"
sidebar_label: "10 · Share and $shift"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-02 against the **MongoDB Manual (8.0)** —
> [`$divide`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/divide/)
> (*"The arguments can be any valid expression as long as they resolve to
> numbers"*; *"The default return type is a `double`. If at least one operand is a
> `decimal`, then the return type is a decimal"*),
> [`$shift`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/shift/),
> [`$round`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/round/),
> [`$setWindowFields`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/setWindowFields/)
> (rank and order operators *"use an implicit window and return an error if you
> specify a `window` option"*).
> Counterpart:
> [1·09 — dashboard queries](../../phase-1-database/09-dashboard-queries.md).
> Spine: **MongoDB 8.0** (8.2 minor) · driver **`mongodb` 7.5.0** · **Node 24 LTS**.

**Two of the dashboard's most-requested numbers are ratios: what fraction of its
category a product represents, and how today compares with yesterday. Both are a
window aggregate divided by the current row, both port from SQL almost
mechanically, and both have a denominator that can be zero. Phase 1 handled that
with `nullif(x, 0)`, which turns a documented SQL error into a null. MongoDB has
no `nullif` and — this is the part worth knowing — its `$divide` reference does
not document what a zero divisor does at all. So the guard is not a translation
of Phase 1's; it is a refusal to depend on behaviour the manual does not
specify.**

## Share of category

The window aggregate first, then the division:

```js
{$setWindowFields: {
  partitionBy: '$category',
  output: {categoryCents: {$sum: '$revenueCents'}},   // no window => whole partition
}},
{$set: {
  pctOfCategory: {$cond: [
    {$gt: ['$categoryCents', 0]},
    {$round: [{$multiply: [100, {$divide: ['$revenueCents', '$categoryCents']}]}, 1]},
    null,                                             // no base — honestly null
  ]},
}},
```

The omitted `window` is doing real work: the Manual's default is *"an unbounded
window, which includes all documents in the partition"*, which is precisely
SQL's bare `sum(x) over (partition by y)`. Adding a `window` here would turn the
denominator into a running total and the percentages into nonsense that still
adds up to something.

`$round` takes `[<expression>, <place>]` and matches Phase 1's `round(…, 1)`.
Note it rounds a **double**: a percentage is a presentation value, not money, so
the rule from [chunk 2](01b-dates-money-and-the-status-set.md) about never
dividing money inside the pipeline does not apply — nothing downstream sums these
percentages, and no invoice depends on them.

## The division guard, and why it is not a translation

`$divide`'s reference documents the syntax, the operand requirement — *"The
arguments can be any valid expression as long as they resolve to numbers"* — and
the return type — *"The default return type is a `double`. If at least one
operand is a `decimal`, then the return type is a decimal"*.

It says **nothing about a zero divisor.** I could not confirm from the Manual what
`{$divide: [1, 0]}` does, so this page does not claim it. What it does instead is
guard:

```js
{$cond: [{$gt: ['$categoryCents', 0]}, <the division>, null]}
```

Writing the guard explicitly is better than relying on documented behaviour even
if the behaviour *were* documented, because it makes the business decision
visible. **A category whose window revenue is zero has no base, so the share is
honestly `null`, and the UI renders a dash rather than `0%` or `NaN`.** `0%`
would be a lie: the product did not achieve zero percent of its category, there
is no category total for it to be a percentage of.

When can `categoryCents` be zero if products in that category sold? When the
window is a period in which every order carrying that category was cancelled, and
the revenue-status filter removed all of them — so the category is present in the
stream only because something else in it contributed a zero-revenue row. It is
rare, it is real, and it is the kind of case that reaches production before it
reaches a test.

The general shape, worth internalising because it recurs in every ratio on the
dashboard:

```js
const safeRatio = (num, den) => ({$cond: [{$gt: [den, 0]}, {$divide: [num, den]}, null]});
```

A helper in the module, applied by reflex. `$gt: 0` rather than `$ne: 0` is
deliberate: a negative denominator is also not a meaningful base for a percentage,
and treating it as one produces a plausible-looking negative share.

## `$shift` for period-over-period

The panel that says "up 12% on yesterday":

```js
{$setWindowFields: {
  sortBy: {day: 1},
  output: {prevDayCents: {$shift: {output: '$revenueCents', by: -1}}},
}},
{$set: {
  deltaPct: {$cond: [
    {$gt: ['$prevDayCents', 0]},
    {$round: [{$multiply: [100, {$subtract: [
      {$divide: ['$revenueCents', '$prevDayCents']}, 1]}]}, 1]},
    null,
  ]},
}},
```

`by: -1` is the previous document, `by: 1` the next, `by: -7` the same weekday a
week back — **provided the series has exactly one document per day**, because
`$shift` counts documents, not days. That is the densification dependency again,
and it is the third correctness question in this chapter that the spine decides.

`$shift` also takes an optional `default`, returned instead of `null` when the
shift lands outside the partition. `{$shift: {output: '$revenueCents', by: -1,
default: 0}}` is tempting and is usually wrong: a zero default makes the first
day of the window look like infinite growth from nothing rather than like "no
comparison available".

`$shift` is an **order operator**, so `sortBy` is required. And like the rank
operators it uses an implicit window: the Manual lists rank operators and
`$shift` together among the operators that *"use an implicit window and return an
error if you specify a `window` option"*.

## Why the guard is needed twice

Both ratios divide by a value that comes from *outside the current row* — a
partition total in one case, a neighbouring row in the other — and both of those
sources have a documented way of being absent. `$sum` over an empty window
returns `0` (the Manual's empty-window table, quoted in
[chunk 8](03-window-functions.md)), and `$shift` past the partition edge returns
`null`. So the denominator is not merely "unlikely to be zero"; there are two
named mechanisms that produce a zero or null denominator on a perfectly healthy
dataset, and both of them fire at the edges — the first day of the window, the
category with one cancelled order — which is exactly where a demo does not look.

## Gotchas

**★ The Manual does not document `$divide` by zero, so do not rely on it.** Guard
the denominator with a `$cond` and decide what the zero-base case means. A
percentage of nothing is not zero percent; it is no answer, and `null` is the
honest encoding.

**★ Adding a `window` to the share-of-total aggregate turns it into a running
total.** The unbounded default is what makes the denominator "the whole
category". A `documents: ['unbounded', 'current']` window here gives each product
a percentage of the products ranked above it, which is a real quantity and not
the one anybody asked for — and the numbers still look like percentages.

**★ `$shift` gives `null` at the partition edge, and `default: 0` makes it
worse.** The first document has no previous and the last has no next. A null
means "no comparison"; a zero default means "grew from nothing", which renders as
an enormous positive change on the first bar of every chart.

**★ `$shift` counts documents, not calendar units.** `by: -7` is seven documents
back. On a series with holes that is not seven days ago, and nothing errors. The
densification is the precondition, not an optimisation.

**★ `$ne: 0` is a weaker guard than `$gt: 0`.** A negative denominator passes an
inequality test and produces a negative percentage of a negative base — a number
with a sign, a decimal point and no meaning. Revenue can be negative if refunds
are ever modelled as negative line items, which this app does not do today and
might.

**★ Rank operators and `$shift` error if you pass a `window`.** They use an
implicit window by definition. Copying a `window:` line from a neighbouring
`$sum` output field into a `$shift` one is a natural editing slip, and the error
names the option rather than the cause.

**★ A percentage is a double and should not be summed.** The per-product shares
within a category add to 100 only up to rounding, so a "check the shares sum to
100%" assertion in a test will fail intermittently on data with many small
products. Assert on the unrounded ratio, or on a tolerance.

## Interview questions

**★ Phase 1 used `nullif(x, 0)` to guard the division. What is the MongoDB
equivalent, and why is it not a one-for-one translation?**
There is no `nullif`. The guard is a `$cond` testing the denominator, with the
division in the then-branch and `null` in the else-branch. It is not one-for-one
because `nullif` was guarding against a *documented* SQL behaviour — division by
zero raises — whereas MongoDB's `$divide` reference does not document
zero-divisor behaviour at all. So writing the guard is not defensive programming
against a known error; it is declining to depend on unspecified behaviour. The
side benefit is that the explicit form states the business rule: a category with
no revenue has no base, so the share is `null` and the UI shows a dash.

**★ How would you add "revenue versus the same day last week"?**
`$shift` with `by: -7` over a `sortBy: {day: 1}`, then the same guarded division.
The correctness precondition is that the series has exactly one document per day,
because `$shift` counts *documents*, not days — so on a series with holes, `-7`
lands on a day that is not seven days ago. That is the densification requirement
for the third time in this chapter, and it is why the spine is built before any
annotation stage rather than after.

**★ Why does the share-of-category aggregate omit `window` when the running total
requires it?**
Because the default *is* the whole partition: *"Default is an unbounded window,
which includes all documents in the partition."* A share of total wants the
partition total, so the default is exactly right and specifying anything makes it
wrong. A running total wants everything up to the current row, so it must say so
with `documents: ['unbounded', 'current']`. The two requirements are opposite and
the syntax difference between them is one optional key, which is why omitting the
`window` from a running total produces thirty identical numbers and nobody
notices for a week.

**★ Where in this app can a zero denominator actually occur?**
Two places, both at an edge. The category total is zero when the revenue-status
filter removed every revenue-bearing order for that category in the window —
which happens on a short window with one cancelled order. And `$shift` returns
`null` for the first document in every partition, so any period-over-period
comparison has a null denominator on its first row by construction. Neither is
exotic; both are on the first screen of any short-range report.

**★ Would you use `$percentile` or `$median` here?**
They exist as accumulators and as window operators in 8.0, and they answer a
different question — "the median order value" rather than "this product's share".
They are the right tool when a mean is being distorted by a few large orders,
which is common in a storefront with both accessories and furniture. The reason
they are not on this panel is that the panel's requirement is share-of-total, and
a share is a ratio of sums by definition; swapping in a median would change the
number's meaning while leaving its label intact.

---

← Prev: [Rank and share](03b-rank-and-share-of-category.md) ·
[Overview](README.md) ·
Next → [Top products and `$unwind`](04-top-products-and-unwind.md)
