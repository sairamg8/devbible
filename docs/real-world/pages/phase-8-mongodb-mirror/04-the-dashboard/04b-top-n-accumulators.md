---
title: "Three ways to say top-N, one of which does not sort at all, and the memory limit that applies per group rather than per stage"
sidebar_label: "12 · Top-N accumulators"
sidebar_position: 12
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-02 against the **MongoDB Manual (8.0)** —
> [`$topN`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/topN/)
> (*"returns an aggregation of the top `n` elements within a group, according to
> the specified sort order. If the group contains fewer than `n` elements,
> `$topN` returns all elements in the group"*; *"`n` has to be a positive
> integral expression"*; *"Groups within the `$topN` aggregation pipeline are
> subject to the 100 MB limit pipeline limit. If this limit is exceeded for an
> individual group, the aggregation fails with an error"*),
> [`$firstN`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/firstN/),
> [`$bottomN`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/bottomN/),
> [`$sortByCount`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/sortByCount/)
> (*"equivalent to the following `$group` + `$sort` sequence"*).
> Concept home:
> [MongoDB 6·05 — `$sort`, `$limit`, `$skip`](../../../../mongodb/pages/phase-6-aggregation/05-sort-limit-skip.md).
> Spine: **MongoDB 8.0** (8.2 minor) · driver **`mongodb` 7.5.0** · **Node 24 LTS**.

**"Top twenty products" is a `$sort` plus a `$limit` and needs nothing exotic.
"Top three products *in each category*" is the question that separates the
approaches, because it is per-group, and a `$sort`+`$limit` can only be applied
once to a whole stream. MongoDB gives three answers: `$sortByCount` for the
frequency case, the `$topN` family of accumulators, and `$setWindowFields` with a
rank filter. They differ in what they can express about ties, in how much memory
they hold, and — for one pair of them — in whether they sort at all, which is the
distinction the names actively hide.**

## `$sortByCount` — the one-stage top-N by frequency

> *"The `$sortByCount` stage is equivalent to the following `$group` + `$sort`
> sequence:"* `{$group: {_id: <expression>, count: {$sum: 1}}}`,
> `{$sort: {count: -1}}`
> — [`$sortByCount`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/sortByCount/)

```js
{$unwind: '$items'},
{$sortByCount: '$items.categorySlug'},
{$limit: 10},
```

"Which categories appear on the most order lines", in three stages. The output
fields are fixed — `_id` and `count` — so it answers a frequency question only:
it counts documents, and there is no way to make it sum a quantity. The moment
the panel wants *units* rather than *lines*, `$sortByCount` is out and an
explicit `$group` with `{$sum: '$items.qty'}` is in.

Its brevity is also its trap, restated from
[chunk 7](02b-the-categorical-gap.md): it emits only the keys that occur, so it
is right for a ranked list of whatever happened and wrong for a panel with a
fixed row set.

## `$topN` and `$firstN`, and the difference the names hide

```js
{$group: {
  _id: '$items.categorySlug',
  topProducts: {$topN: {
    n: 3,
    sortBy: {lineRevenue: -1},
    output: {slug: '$items.slug', revenue: '$lineRevenue'},
  }},
}},
```

`$topN` *"returns an aggregation of the top `n` elements within a group,
according to the specified sort order. If the group contains fewer than `n`
elements, `$topN` returns all elements in the group."* Three parameters: `n`,
`sortBy`, `output`. The `output` expression decides what each element of the
result array looks like — a whole document, one field, a computed object — which
is why the accumulator can replace a `$sort` + `$group` + `$slice` sandwich.

**`$topN` sorts; `$firstN` does not.** `$firstN` takes no `sortBy` at all and
returns the first `n` elements *in the order the group encountered them*, which
is unspecified unless the stream was sorted before the `$group`. So:

| Accumulator | Sorts? | Correct when |
|---|---|---|
| `$topN` / `$bottomN` | yes, by `sortBy` | self-contained "top three by revenue" |
| `$top` / `$bottom` | yes, `n = 1` | "the single best" |
| `$firstN` / `$lastN` | **no** | only after an explicit `$sort`, as a cheaper `$topN` |
| `$first` / `$last` | **no** | the `n = 1` cases, same caveat |

Reaching for `$firstN` because it looks like a cheaper `$topN` produces a "top
products" panel that is an arbitrary list — and it will look correct on seed data,
where insertion order happens to correlate with everything.

## Constraints on `n`

> *"`n` has to be a positive integral expression."*

and, from the parameter table, it *"must be a positive integral expression that is
either a constant or depends on the `_id` value for `$group`"*.

So `n` **can** vary per group — three products for a big category, one for a
small one — expressed as a `$cond` over `$_id`. It **cannot** depend on any other
field of the group, because the accumulator has to know how much to keep before
it has seen the group.

`n` is also the only thing bounding the accumulator's memory, which is the next
section.

## The 100 MB limit is per group

> *"Groups within the `$topN` aggregation pipeline are subject to the 100 MB limit
> pipeline limit. If this limit is exceeded for an individual group, the
> aggregation fails with an error."*
> — [`$topN`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/topN/)

Per **individual group**, not per stage. So one outlier category can fail an
aggregation in which every other group is comfortably small, and the failure
arrives when that category grows rather than when the query is written.

Two consequences for the repository:

```js
// db/mongo/dashboard.js
const MAX_TOP_N = 50;
export function topPerCategory({n = 3}) {
  const k = Math.min(Math.max(1, Math.trunc(n)), MAX_TOP_N);   // clamp, don't trust
  return [/* … {$topN: {n: k, …}} … */];
}
```

**`n` taken straight from a request parameter is an unbounded memory request
wearing a number.** `?n=1000000` is a valid positive integer and the accumulator
will try. Clamp it in the repository, before the pipeline is built — the same
posture as the catalog's page-size cap in
[02·05](../02-the-catalog/04-the-catalog-repository.md).

And **the `output` expression decides how big each retained element is.**
`output: '$$ROOT'` keeps the whole document, so `n: 3` over a group of big
documents is three big documents per group; `output: {slug: '$items.slug'}` keeps
a two-field object. The difference is the difference between a bounded and an
alarming stage, and it is one line.

## Top-N-per-category: `$topN` versus a rank filter

The other way to get three per category is `$setWindowFields` with a `$rank`
partitioned by category, then a `$match`:

```js
{$setWindowFields: {
  partitionBy: '$category',
  sortBy: {revenueCents: -1},
  output: {rankInCategory: {$rank: {}}},
}},
{$match: {rankInCategory: {$lte: 3}}},
```

The two are **not** equivalent, and the difference is ties.

`$topN` returns exactly `n` elements and picks arbitrarily between equals — so
two products tied for third place produce a coin flip, and the coin may land
differently on the next run. The `$rank` version returns *everyone* at rank 3, so
a tie produces four rows.

Which is right is a product decision. A leaderboard where a tie must show as a
tie needs the rank version and a variable row count; a fixed-height panel needs
`$topN` and has to accept that the tiebreak is arbitrary — or make it
non-arbitrary by adding a deterministic secondary sort, which `$topN`'s `sortBy`
accepts and `$rank`'s does not
([chunk 9](03b-rank-and-share-of-category.md) has that restriction).

Cost differs too. `$topN` keeps `n` elements per group; the window version
materialises each partition to rank it. For a category with three products that
is nothing. For "top three products per *day* across a year" it is the difference
between a stage bounded by `3 × 365` and a stage bounded by the order volume.

## Where the plain `$sort` + `$limit` still wins

For the flat "top twenty products overall" panel, none of this is needed:

```js
{$group: {_id: '$items.productId', revenueCents: {$sum: …}}},
{$sort: {revenueCents: -1}},
{$limit: 20},
```

`$sort` immediately followed by `$limit` is the case the server coalesces into a
top-*k* sort rather than a full sort — the concept page
[6·05](../../../../mongodb/pages/phase-6-aggregation/05-sort-limit-skip.md) covers
the mechanism. It only applies when the two stages are adjacent, so a `$set`
between them removes the optimisation silently.

The rule that picks between the three approaches: **one top-N for the whole
stream is `$sort` + `$limit`; one top-N per group is `$topN`; one top-N per group
where ties must be visible is a rank filter.**

## Gotchas

**★ `$firstN` is not `$topN` with a shorter name.** `$firstN` takes no `sortBy`
and returns whatever the group saw first, which is unspecified without a prior
`$sort`. Reaching for it because it looks cheaper produces a "top products" panel
that is a list of arbitrary products, and it will look correct on seed data where
insertion order happens to correlate with revenue.

**★ `$topN`'s 100 MB limit is per group, not per stage.** One outlier group can
fail an aggregation in which every other group is small, and it fails on the day
that group grew rather than on the day the query was written.

**★ `n` from a request parameter is an unbounded memory request.** Clamp it in the
repository before the pipeline is constructed. A valid positive integer is not a
safe one.

**★ `output: '$$ROOT'` multiplies the accumulator's memory by the document
size.** Keeping whole documents when the panel needs two fields is the difference
between `n × 2 fields` and `n × the whole order`, per group. Project inside
`output`.

**★ `$topN` cannot represent ties; `$rank` + `$match` can.** `$topN: {n: 3}`
returns exactly three, choosing arbitrarily between products with equal revenue —
and arbitrarily means differently between runs. If the panel is a leaderboard
where a tie must show as a tie, the window version is correct and returns a
variable number of rows.

**★ `$sortByCount` counts documents and cannot sum a quantity.** Its output shape
is fixed at `_id` and `count`. "Top categories by units sold" is not expressible
with it; it needs a `$group` with `{$sum: '$items.qty'}`.

**★ `$sortByCount` and `$sort` disagree about stability the same way `$sort`
does.** It sorts by `count` descending and nothing else, so groups with equal
counts come back in an unspecified order — and a `$limit: 10` after it therefore
picks an unspecified ten from the tied band at the boundary. The catalog learned
this lesson as pagination
([02·02](../02-the-catalog/02-keyset-pagination.md)); it applies to any truncated
ranking.

**★ A `$set` between `$sort` and `$limit` removes the top-*k* coalescence.** The
two stages have to be adjacent for the server to fuse them. Inserting a
"harmless" computed field between them turns a bounded top-*k* sort into a full
sort of the grouped stream.

**★ `n` can depend on `$_id` and on nothing else.** "Three per big category, one
per small" is expressible as a `$cond` over the group key. "Three per category
unless the category's total revenue exceeds X" is not, because the accumulator
must know `n` before it has aggregated the group.

## Interview questions

**★ `$topN` versus `$firstN` — when is each correct?**
`$topN` takes a `sortBy` and returns the top `n` by that order, so it is
self-contained and is what "top three products" means. `$firstN` takes no sort
and returns the first `n` documents the group encountered, which is unspecified
unless the stream was sorted before the `$group` — so it is correct only as an
optimisation *after* an explicit `$sort`, where it saves the accumulator from
re-sorting. Using `$firstN` where `$topN` was meant produces an arbitrary list
that looks like a ranking, and looks right in testing.

**★ Two ways to get the top three products per category. Which do you pick?**
`$topN` inside a `$group` keeps only `n` elements per group, so its memory is
bounded by `n` times the number of groups; the `$setWindowFields` + `$rank` +
`$match` version materialises each partition to rank it. `$topN` is the default
choice. The window version wins when ties must be represented — `$topN` returns
exactly `n` and breaks ties arbitrarily, while a rank filter returns everyone at
rank 3 — and when the rank number itself has to be displayed.

**★ Why is `$topN`'s memory limit stated per group rather than per stage, and what
does that change about how you use it?**
Because the accumulator holds `n` elements *for each group it is currently
tracking*, so the risky quantity is the size of a single group's retained set,
not the total. It changes two things: `n` must be clamped rather than taken from
input, and the `output` expression must project rather than keep `$$ROOT`,
because those two numbers multiply. It also changes the failure profile — a
query that has run fine for a year fails the day one group outgrows the others,
which is a much harder incident to attribute than a query that was always slow.

**★ You need "the single highest-revenue product in each category". What is the
shortest correct spelling?**
`{$top: {sortBy: {revenueCents: -1}, output: …}}` inside a `$group` keyed on
category — the `n = 1` case of `$topN`, with no `n` parameter. Not `$first`,
which returns whichever document the group saw first, and not a `$sort` +
`$group` + `$first` sandwich, which works but sorts the entire stream to answer
a per-group question.

**★ When does a plain `$sort` + `$limit` beat all of these?**
When there is exactly one top-N to compute over the whole stream. Adjacent
`$sort` and `$limit` stages are coalesced by the server into a top-*k* sort, so
the memory held is bounded by the limit rather than by the stream — which is the
same bound `$topN` gives, without the accumulator. The moment the question
becomes per-group, `$sort` + `$limit` cannot express it at all, because a
`$limit` truncates the stream rather than each group.

---

← Prev: [`$unwind`](04-top-products-and-unwind.md) ·
[Overview](README.md) ·
Next → [`$facet` and one round trip](05-facet-and-one-round-trip.md)
