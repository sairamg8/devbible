---
title: "count(*) FILTER (WHERE …) becomes $sum with a $cond inside it, and the else branch is a decision rather than a formality"
sidebar_label: "6 · Conditional aggregates"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-02 against the **MongoDB Manual (8.0)** —
> [`$cond`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/cond/),
> [`$switch`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/switch/),
> [`$sum`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/sum/),
> [`$avg`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/avg/),
> [`$filter`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/filter/),
> [`$sortByCount`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/sortByCount/).
> Counterpart:
> [1·09 — dashboard queries](../../phase-1-database/09-dashboard-queries.md).
> Spine: **MongoDB 8.0** (8.2 minor) · driver **`mongodb` 7.5.0** · **Node 24 LTS**.

**Phase 1's status panel was one scan and five answers, written with standard
SQL's `FILTER (WHERE …)` clause. MongoDB has no such clause and does not need
one: an accumulator takes an *expression*, and an expression can be a
conditional. The translation is mechanical. What is not mechanical is the else
branch — `0` and `null` behave identically under `$sum` and produce different
answers under `$avg`, which is one character between two legitimate business
questions. [Chunk 7](02b-the-categorical-gap.md) takes the other half of the
problem: the shorter spelling everyone reaches for first, and the gap it
reintroduces.**

## The Postgres original

```sql
select count(*) filter (where status = 'pending')   as pending,
       count(*) filter (where status = 'paid')      as paid,
       count(*) filter (where status = 'shipped')   as shipped,
       count(*) filter (where status = 'delivered') as delivered,
       count(*) filter (where status = 'cancelled') as cancelled
  from orders
 where created_at > now() - interval '30 days';
```

One scan, five answers, and — importantly — **five answers even when a status
has no orders**, because `count(*) filter (…)` over zero matching rows is `0`,
not an absent column.

## The pipeline

```js
const STATUSES = ['pending', 'paid', 'shipped', 'delivered', 'cancelled'];

const countIf = (status) => ({$sum: {$cond: [{$eq: ['$status', status]}, 1, 0]}});

export function statusCountsPipeline({from, to}) {
  return [
    {$match: {createdAt: {$gte: from, $lt: to}}},
    {$group: Object.fromEntries([
      ['_id', null],
      ...STATUSES.map(s => [s, countIf(s)]),
    ])},
    {$project: {_id: 0}},
  ];
}
```

`_id: null` groups the whole stream into one document — the aggregation
equivalent of a `select` with aggregates and no `group by`. Five accumulators,
one pass, and the same guarantee the SQL had: a status with no orders still
appears, with `0`, because `$cond`'s else branch fired for every document.

Generating the accumulators from the `STATUSES` constant rather than typing five
lines is not cleverness; it is the same discipline as
[chunk 2's](01b-dates-money-and-the-status-set.md) `REVENUE_STATUSES`. Adding a
sixth status touches one array and the dashboard follows.

## `$cond` has two spellings and they are the same thing

```js
{$cond: [<if>, <then>, <else>]}                            // array form
{$cond: {if: <expr>, then: <expr>, else: <expr>}}          // object form
```

The array form is shorter and reads well for a one-line predicate. The object
form is worth switching to the moment the condition itself is more than one
operator, because a three-element array whose first element is a nested
`{$and: [...]}` is genuinely hard to read at a glance and impossible to review in
a diff.

Both are **expressions**, not stages: they can appear anywhere an expression can,
including inside `$project`, `$set`, `$group` accumulators, `$sort` keys and
window operators.

## The else branch: `0` versus `null`

Under `$sum` the two are equivalent, because `$sum` ignores non-numeric input and
adding zero changes nothing. Under `$avg` they are two different questions:

```js
// average value of PAID orders — the null branch removes the others
avgPaidCents: {$avg: {$cond: [{$eq: ['$status', 'paid']}, '$totalCents', null]}},

// average value of ALL orders, counting unpaid as zero — a different number
avgAllCents:  {$avg: {$cond: [{$eq: ['$status', 'paid']}, '$totalCents', 0]}},
```

`$avg` skips non-numeric values, so the `null` branch drops the document out of
the denominator entirely while the `0` branch keeps it in. The first is "average
paid order value"; the second is "average revenue per order placed". Both are
legitimate business questions and only the else branch distinguishes them, which
makes this the easiest place in the whole dashboard to answer the wrong question
correctly.

The same asymmetry hits `$min`, `$max`, `$stdDevPop` and `$stdDevSamp`, all of
which ignore non-numeric input. It does **not** hit `$push` or `$addToSet`, which
happily collect `null`s — a `$push` with a `null` else branch produces an array
full of holes rather than a short array.

## `$switch` where the condition has more than two arms

`$cond` is two-way. For a bucketing question — order-value bands, a five-status
set collapsed into three UI groups — `$switch` states it once:

```js
uiGroup: {$switch: {
  branches: [
    {case: {$in: ['$status', ['paid', 'shipped']]},  then: 'in_progress'},
    {case: {$eq: ['$status', 'delivered']},          then: 'complete'},
    {case: {$eq: ['$status', 'cancelled']},          then: 'cancelled'},
  ],
  default: 'pending',
}},
```

Branches are evaluated in order and the first match wins, exactly like a `CASE`
expression. **`default` is optional and omitting it is a runtime error, not a
null**: if no branch matches and there is no `default`, the operation fails. That
is the opposite of SQL, where a `CASE` with no `ELSE` yields `NULL`, and it is
the right choice — a bucketing that silently produced nulls for unanticipated
values would put an `undefined` key on a dashboard.

For revenue bands the same shape works on a numeric field, and it is worth
comparing against `$bucket`, which is a *stage* that groups documents into
boundaries you supply and emits one document per bucket. `$switch` labels each
document and leaves the grouping to you; `$bucket` does both and gives you no
control over the output shape. For a panel that has to return every band whether
or not it has orders, `$switch` plus a generated accumulator set is the version
that cannot lose a band.

## Conditional sums of money

The same operator, a money field instead of `1`:

```js
grossCents:     {$sum: {$cond: [{$in: ['$status', REVENUE_STATUSES]}, '$totalCents', 0]}},
cancelledCents: {$sum: {$cond: [{$eq: ['$status', 'cancelled']},      '$totalCents', 0]}},
```

Two panels, one scan of the same documents. This is where the `FILTER`
translation earns most: the alternative is two `$match`-ed pipelines and two
round trips, or one `$facet` whose sub-pipelines each re-walk the same stream
([chunk 10](05-facet-and-one-round-trip.md)).

## Gotchas

**★ `$sum: '$isPaid'` over a boolean field sums to zero.** `$sum` ignores
non-numeric values and BSON booleans are not numbers. The mistake is natural for
anyone coming from a language where `true + true === 2`, it produces no error,
and the panel reads `0`. The spelling that works is
`{$sum: {$cond: ['$isPaid', 1, 0]}}`.

**★ The else branch of a `$cond` inside `$avg` chooses the denominator.** `null`
excludes the document from the average, `0` includes it as a zero. Two different
business questions, one character apart, both plausible on a dashboard.

**★ `$switch` with no `default` errors when nothing matches.** Not a null, an
error — the aggregation fails and the endpoint 500s. This is good behaviour and
it means adding a sixth order status without touching the `$switch` takes the
dashboard down rather than mislabelling a bar. Always supply a `default`, and
make it a value the UI can render.

**★ Five accumulators cost one pass; five queries cost five.** The reason the
`FILTER` pattern exists at all is that it is one scan. Splitting the status panel
into five `countDocuments` calls is the version that gets written when the
pipeline feels awkward, and it is five index traversals where one would do — plus
five separate points in time, so the five numbers no longer necessarily sum to
the same total.

## Interview questions

**★ Translate `count(*) filter (where status = 'paid')` into an aggregation and
explain why the else branch is `0`.**
`{$sum: {$cond: [{$eq: ['$status', 'paid']}, 1, 0]}}`. The accumulator runs for
every document in the group, so each document contributes either `1` or the else
value; `0` is the identity for addition, so non-matching documents contribute
nothing while still being *seen*. That "still being seen" is what guarantees the
field exists in the output even when nothing matches — which is exactly the
property `count(*) filter` has and `group by status` does not.

**★ Why does the else branch matter under `$avg` but not under `$sum`?**
Because `$avg` has a denominator. Both accumulators ignore non-numeric input, so
a `null` else branch makes the document invisible to the accumulator entirely —
under `$sum` that is indistinguishable from adding zero, under `$avg` it removes
one from the count of contributing documents. `$avg` with a `null` else is
"average over matching documents"; with a `0` else it is "average over all
documents, treating non-matching as zero". Choose deliberately and name the
output field so the choice is visible.

**★ What does `$switch` do that a chain of nested `$cond`s does not?**
Nothing, functionally — it is exactly a flattened `$cond` chain. What it does is
make the chain readable and make the missing default an error instead of a
silently nested else. A three-deep nested `$cond` is a diff nobody reviews
properly; a `$switch` with three branches and a default is a table.

---

← Prev: [`$fill` and ordering](01e-fill-and-ordering.md) ·
[Overview](README.md) ·
Next → [The categorical gap, and `$filter`](02b-the-categorical-gap.md)
