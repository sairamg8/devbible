---
title: "$setWindowFields is SQL's OVER clause with the parentheses moved, and its two window kinds answer different questions on the same data"
sidebar_label: "8 · Window functions"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-02 against the **MongoDB Manual (8.0)** —
> [`$setWindowFields`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/setWindowFields/)
> (*"Performs operations on a specified span of documents in a collection, known
> as a window"*; *"Window boundaries are inclusive. Default is an unbounded
> window, which includes all documents in the partition"*; *"The
> `$setWindowFields` stage doesn't guarantee the order of the returned
> documents"*),
> [`$sum`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/sum/),
> [`$avg`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/avg/),
> [`$expMovingAvg`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/expMovingAvg/).
> Counterpart:
> [1·09 — dashboard queries](../../phase-1-database/09-dashboard-queries.md).
> Spine: **MongoDB 8.0** (8.2 minor) · driver **`mongodb` 7.5.0** · **Node 24 LTS**.

**Phase 1's rule was that `group by` collapses rows and window functions
annotate them. That rule ports verbatim: `$group` collapses, `$setWindowFields`
annotates, and the syntax is SQL's `OVER (partition by … order by … rows
between …)` with the three parts moved into named fields. The one genuinely new
decision is that MongoDB makes you choose explicitly between counting
*documents* and counting *values* when you size the window — a distinction SQL
spells `ROWS BETWEEN` versus `RANGE BETWEEN` and that most people never
think about, and one that decides whether a seven-day moving average is over
seven days or over seven rows.**

## The shape

```js
{$setWindowFields: {
  partitionBy: <expression>,          // SQL: partition by
  sortBy: {<field>: 1 | -1, …},       // SQL: order by
  output: {
    <newField>: {
      <windowOperator>: <parameters>,
      window: {documents: [lo, hi]} | {range: [lo, hi], unit: <timeUnit>},
    },
  },
}}
```

`partitionBy` is optional and *"Default is one partition for the entire
collection"*. `sortBy` is optional in general but required for the rank and order
operators, for any bounded window, and for `$linearFill`. `output` is required.
`window` is optional, and its default matters:

> *"Window boundaries are inclusive. Default is an unbounded window, which
> includes all documents in the partition."*
> — [`$setWindowFields`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/setWindowFields/)

An omitted `window` therefore means "the whole partition", which is exactly what
SQL's bare `sum(x) over (partition by y)` means. That default is the one you want
for a share-of-total calculation and emphatically not the one you want for a
running total.

## Running total: an unbounded-to-current window

```js
{$setWindowFields: {
  sortBy: {day: 1},
  output: {
    runningCents: {
      $sum: '$revenueCents',
      window: {documents: ['unbounded', 'current']},
    },
  },
}},
```

`'unbounded'` is the first document of the partition, `'current'` is this one,
and an integer is a relative offset — negative before, positive after, `0` being
the current position. That is SQL's `rows between unbounded preceding and current
row`, and it is the reason `sortBy` is mandatory here: "preceding" is meaningless
without an order.

Omit the `window` and you get the partition total on every row instead of a
running total — a plausible-looking column of thirty identical numbers.

## Moving average: `documents` versus `range`

Two spellings of "seven-day moving average":

```js
// A: the previous six DOCUMENTS plus this one
avg7: {$avg: '$revenueCents', window: {documents: [-6, 0]}},

// B: everything within six DAYS before this document, plus this one
avg7: {$avg: '$revenueCents', window: {range: [-6, 0], unit: 'day'}},
```

On a **complete** series — one document per day, which is what
[chunk 5](01e-fill-and-ordering.md)'s `$densify` + `$fill` guarantees — the two
are identical.

On a series with holes they are not, and both are wrong in different ways.
Version A counts *documents*: with three missing days its window spans ten
calendar days and divides by seven, so the "seven-day average" is a ten-day sum
over seven. Version B counts *calendar days* correctly but divides by however
many documents fell inside, so with three missing days it divides by four — the
average is over the days that exist, not over seven.

**Neither is "average daily revenue over the last seven days".** That number
requires the missing days to exist as zeros, which is the densification, which is
why the spine has to be built before this stage rather than after it. Once the
series is complete, both spellings give the same right answer and `documents` is
cheaper to reason about.

The `range` restrictions are worth knowing before you reach for it:

- *"Range windows require all `sortBy` values to be numbers."*
- *"Time range windows require all `sortBy` values to be dates."*
- *"Range and time range windows can only contain one `sortBy` field and the sort
  must be ascending."*
- *"Numeric boundary values must be integers. For example, you can use 2 hours as
  a boundary but you cannot use 1.5 hours."*
- *"For range windows, only numbers in the specified range are included in the
  window. Missing, undefined, and `null` values are excluded."*

The single-ascending-`sortBy` restriction is the one that bites: the moment the
series needs a tiebreaker in its sort, `range` windows are off the table and only
`documents` windows remain.

## `$expMovingAvg`, when the requirement is smoothing rather than a mean

```js
smoothed: {$expMovingAvg: {input: '$revenueCents', N: 7}},
```

An exponential moving average takes `N` (or `alpha`) and no `window` — it is
defined over everything up to the current document by construction. It is the
right operator when the requirement is "make the line less spiky" rather than
"tell me the seven-day mean", and it is worth offering when a stakeholder asks
for a moving average and actually wants smoothing. It is the wrong operator the
moment anyone needs to reconcile the number against a sum.

## The stage does not guarantee output order

> *"The `$setWindowFields` stage doesn't guarantee the order of the returned
> documents."*
> — [`$setWindowFields` — Behavior](https://www.mongodb.com/docs/manual/reference/operator/aggregation/setWindowFields/)

`sortBy` orders documents *within* the partition so the window has a meaning. It
says nothing about the order documents leave the stage in. So a pipeline that
computes a running total and then returns it needs an explicit `$sort` **after**
the stage, on the same key, or the chart plots a correctly-computed running total
in the wrong sequence — which looks like a bug in the arithmetic and is not.

This is the same disclaimer `$densify` carries, and the same rule applies: the
last stage before the projection is a `$sort`, always.

## Empty windows return operator-specific values

The Manual is explicit about a case that is easy to hit at the head of a series:

> *"For empty windows or windows with incompatible values (for example, using
> `$sum` on strings), the returned value depends on the operator: For `$count` and
> `$sum`, the returned value is `0`. For `$addToSet` and `$push`, the returned
> value is an empty array. For all other operators, the returned value is
> `null`."*

So the first row of a `documents: [-6, -1]` window — strictly preceding, no
current document — has an empty window: `$sum` gives `0`, `$avg` gives `null`.
A chart that divides by the `$avg` gets a null; a chart that displays the `$sum`
gets a zero that is indistinguishable from a real zero. Neither errors. If the
distinction matters, pair the aggregate with a `{$count: {}}` over the same window
and let the consumer see how many documents contributed.

## Where the stage sits in the pipeline

After the `$group`, after the `$densify`/`$fill`, before the final `$sort` and
`$project`:

```js
{$match: …},                    // indexed
{$group: …},                    // one document per day
{$set: {day: '$_id'}},
{$densify: …}, {$fill: …},      // the series is now complete
{$setWindowFields: …},          // annotate it
{$sort: {day: 1}},              // both previous stages disclaim order
{$project: {_id: 0, …}},
```

Seven stages before the projection, and the ordering constraints between them are
all one-directional: grouping must precede densification (you densify buckets,
not orders), densification must precede windowing (a window over a holed series
is wrong), and the sort must follow both. There is exactly one legal order and it
is worth writing down as a comment in the module, because every one of those
constraints is invisible when the stages are read individually.

## Gotchas

**★ Omitting `window` gives the partition total, not a running total.** The
default is unbounded in both directions, so `$sum` without a `window` puts the
same number — the whole partition's total — on every document. It looks like a
working column and it is a constant.

**★ A `documents` window over a series with holes silently changes its span.**
`[-6, 0]` means six *documents* back. With three missing days it reaches ten
calendar days into the past and still divides by seven. Densify first, or use a
`range` window and accept a different definition.

**★ A `range` window divides by the documents that exist, not by the window
width.** So a `range: [-6, 0], unit: 'day'` average over a holed series is the
mean of the days that had orders — a number that is systematically too high for a
business with quiet days. Only a complete series makes the two spellings agree.

**★ `range` windows require a single ascending `sortBy` field.** Adding a
tiebreaker to the sort — which every other part of this corpus tells you to do —
makes a `range` window illegal. The stage errors, which is the good outcome; the
bad one is silently reaching for `documents` and inheriting its hole behaviour.

**★ `$setWindowFields` disclaims output order.** Compute the running total, then
sort. Skipping the sort produces correct numbers attached to the right documents,
delivered in an order that makes the chart nonsense.

**★ At the head of a partition, `$avg` over an empty window is `null` and `$sum`
is `0`.** A zero from an empty window and a real zero are indistinguishable
downstream. If the difference matters, add a `{$count: {}}` over the same window.

**★ Rank operators and `$shift` error if you give them a `window`.** The Manual:
these operators *"use an implicit window and return an error if you specify a
`window` option"*. Copying a `window:` line from a `$sum` output field into a
`$rank` one is a natural editing mistake and the error message is about the
option, not about the operator.

**★ `$setWindowFields` was unusable inside transactions before MongoDB 5.3.** The
Manual lists it as a restriction lifted in 5.3, along with `"snapshot"` read
concern. Irrelevant on this corpus's 8.x spine and worth knowing if you meet a
pipeline written defensively around it.

**★ The whole stage is subject to the 100 megabyte per-stage threshold.** A
window over thirty daily buckets is nothing; a window over an ungrouped
`orders` collection with `partitionBy: '$userId'` holds every order in memory per
partition. `allowDiskUse` covers it ([chunk 13](07-limits-and-materialisation.md)),
but the better fix is almost always to `$group` first so the stage sees buckets
rather than rows.

## Interview questions

**★ When do you need a window function instead of `$group`?**
When the answer needs detail rows *and* an aggregate on the same line. `$group`
collapses — one output document per key; `$setWindowFields` annotates — one output
document per input document, with new fields computed over a span of neighbours.
"Revenue per day" is a group. "Revenue per day, plus the running total" is a group
followed by a window. The Phase 1 formulation ports unchanged: if the result has
one row per group, group; one row per row, window.

**★ What is the difference between a `documents` window and a `range` window, and
when does it matter?**
A `documents` window counts positions relative to the current document; a `range`
window counts values of the `sortBy` field. On a series with exactly one document
per unit they are identical. On a series with gaps they diverge: `documents`
keeps the count and stretches the span, `range` keeps the span and shrinks the
count. Neither gives "the mean over seven days including empty ones" — that needs
the empty days to exist, which is a densification, which is why gap-filling has
to happen before the window stage.

**★ Why does `$setWindowFields` require `sortBy` for a bounded window but not for
an unbounded one?**
Because an unbounded window is the whole partition and a set has no order — the
sum of everything is the same whichever way you walk it. A bounded window is
defined in terms of "preceding" and "following", which are only meaningful
against an ordering, so the stage refuses rather than picking one. The same
reasoning makes `sortBy` mandatory for the rank operators and for `$linearFill`.

**★ Your running total is right for each day but the chart is scrambled. What
happened?**
The `$sort` after `$setWindowFields` is missing. The stage explicitly does not
guarantee the order of the documents it returns — `sortBy` orders documents
*inside* the partition so the window has a meaning, not on the way out. Each
document carries a correct running total for its own day; the array they arrive
in is not ordered by day. Add an explicit `$sort` as the last computational stage.

**★ Why does the window stage have to come after the densification rather than
before?**
Because a window is defined over the documents it is given, and a series missing
its empty days is a different series. A `documents` window silently spans more
calendar time than it claims; a `range` window silently divides by fewer
documents than it should. Densifying first makes "one document" and "one day" the
same thing, at which point both window kinds agree and both mean what they say.

---

← Prev: [The categorical gap](02b-the-categorical-gap.md) ·
[Overview](README.md) ·
Next → [Rank and share of category](03b-rank-and-share-of-category.md)
