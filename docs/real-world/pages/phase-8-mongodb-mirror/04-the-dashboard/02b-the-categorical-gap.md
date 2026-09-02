---
title: "Grouping by status is two lines instead of five accumulators, and it silently drops every status that had no orders — the empty-day bug on an axis $densify cannot walk"
sidebar_label: "7 · The categorical gap"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-02 against the **MongoDB Manual (8.0)** —
> [`$sortByCount`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/sortByCount/)
> (*"equivalent to the following `$group` + `$sort` sequence"*),
> [`$densify`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/densify/)
> (*"The values of the specified `field` must either be all numeric values or all
> dates"*),
> [`$filter`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/filter/),
> [`$unwind`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/unwind/).
> Spine: **MongoDB 8.0** (8.2 minor) · driver **`mongodb` 7.5.0** · **Node 24 LTS**.

**[Chunk 6](02-conditional-aggregates.md) wrote the status panel as five
conditional accumulators, which is more code than the obvious version. This
chunk is why. Grouping by `status` and pivoting in the API is two lines and is
wrong in exactly the way the naive daily grouping was wrong — a status with no
orders produces no bucket — and it is worse than the daily case because
`$densify` cannot repair a categorical axis. The chunk closes with `$filter`,
which shares SQL's `FILTER` keyword, means something completely different, and is
the operator that lets you ask a question about part of an order without
multiplying the order.**

## The shorter spelling, and what it loses

```js
{$match: {createdAt: {$gte: from, $lt: to}}},
{$group: {_id: '$status', n: {$sum: 1}}},
```

Two lines instead of five accumulators. It returns one document per status **that
occurs in the range**. On a quiet week where nothing was cancelled, the API
receives four documents where the contract promises five, and the dashboard
renders a panel with a missing row rather than a zero — or, worse, a chart whose
five-colour legend now maps colours to the wrong labels because the array shifted
up by one.

This is the same failure as [chunk 3's](01c-densify-and-fill.md) missing day, and
the same rule produces it: `$group` emits one document per distinct key **present
in its input**. Absence of data and absence of a key are indistinguishable to
the consumer.

## Why `$densify` cannot help

The daily version had a repair stage. This one does not, and the reason is
structural rather than a gap in the operator set:

> *"The values of the specified `field` must either be all numeric values or all
> dates."*
> — [`$densify` — field](https://www.mongodb.com/docs/manual/reference/operator/aggregation/densify/)

`$densify` interpolates along an **axis**: it needs a `step`, and a step needs
an ordering with arithmetic. `status` is a member of an unordered finite set;
there is no step from `paid` to `shipped`, and no amount of configuration
invents one.

More fundamentally, **the set of valid statuses is not in the data.** It is in
the application — a constant, a `$jsonSchema` `enum`, a TypeScript union. A
database stage can only interpolate between values it can see; the five statuses
that *should* exist are knowledge only the application has. So the completion has
to come from the application, one way or another.

## The two honest completions

**In the pipeline**, one accumulator per status, generated from the constant —
[chunk 6's](02-conditional-aggregates.md) version. The guarantee lives in the
database, the response always has five fields, and there is nothing for a caller
to forget.

**In the API**, seeded explicitly from the same constant:

```js
const rows = await orders.aggregate(pipeline).toArray();
const counts = Object.fromEntries(STATUSES.map(s => [s, 0]));   // seed the zeros
for (const r of rows) counts[r._id] = r.n;
return counts;
```

Three lines, and the constant is already imported. This is a perfectly good
solution.

The point is not which one wins — it is that **choosing the two-line pipeline
means accepting the three-line obligation**, and the failure mode is that the
obligation is invisible in code review. A diff showing `{$group: {_id:
'$status', n: {$sum: 1}}}` looks complete. There is no marker saying "this
returns a variable number of rows and the caller must know the full set".

A third option worth naming and rejecting: `$unionWith` against a seed
collection of statuses, as [chunk 4](01d-partitioned-spines-and-limits.md) did
for categories. It works, but it requires a collection of statuses to exist, and
creating one purely so the dashboard has something to left-join against is a
schema change to serve a formatting concern. Categories are a real collection
already; statuses are an enum.

## `$sortByCount` is the same trap with a friendlier face

> *"The `$sortByCount` stage is equivalent to the following `$group` + `$sort`
> sequence:"* `{$group: {_id: <expression>, count: {$sum: 1}}}`,
> `{$sort: {count: -1}}`
> — [`$sortByCount`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/sortByCount/)

One stage, sorted descending by count, output fields `_id` and `count`. It is
exactly right for a panel where absence means absence — "top search terms", "top
referrers", "which categories sold at all this week". It is exactly the
missing-bucket bug for a panel with a fixed row set, and its brevity makes it look
like a different mechanism from the `$group` it expands to.

The rule that separates the two cases: **does the consumer know the complete key
set in advance?** If yes, the query must return all of it. If no — if the panel
is a ranked list of whatever occurred — grouping is correct and `$sortByCount`
is the shortest correct spelling.

## `$filter` is the array operator, not the SQL clause

The name collision is unfortunate and worth naming explicitly. SQL's `FILTER` is
a conditional aggregate; MongoDB's **`$filter` is an expression that selects
elements from an array**. It is how you ask a question about part of an order's
line items without `$unwind`:

```js
// how many line items on each order are for more than one unit
multiUnitLines: {$size: {$filter: {
  input: '$items',
  as: 'i',
  cond: {$gt: ['$$i.qty', 1]},
}}},
```

`input`, `as` and `cond` — and the `$$` prefix, which is how an expression refers
to a variable it bound rather than to a field. Getting `$i` where `$$i` belongs
does not error: `$i` is a *field path*, MongoDB looks for a field literally called
`i`, finds nothing, and the condition evaluates against missing. The result is an
empty array and a count of zero, everywhere, silently.

`as` is optional and defaults to `this`, so `cond: {$gt: ['$$this.qty', 1]}` works
with no `as` at all. Naming it is worth the extra line the moment two `$filter`s
nest.

## Why `$filter` rather than `$unwind`

Reaching for `$filter` matters for correctness as well as speed. `$unwind`
multiplies documents — one output document per array element — and **any
accumulator computed on the parent after an `$unwind` is multiplied with them**.
A three-item order contributes its `totalCents` three times to a
`{$sum: '$totalCents'}` that sits below an `$unwind`. That is the classic SQL
join fan-out, and [chunk 8](04-top-products-and-unwind.md) is where it is worked
through properly.

`$filter` keeps one document per order, so every order-level accumulator in the
same `$group` keeps meaning what it says. The decision rule: **if the output has
one row per order, stay at the order level and use array expressions; if the
output genuinely has one row per line item, `$unwind`.**

The array expression family that goes with it:

| Operator | Answers |
|---|---|
| `$filter` | which elements match |
| `$size` | how many elements |
| `$map` | reshape each element |
| `$reduce` | fold the array to one value |
| `$sum` / `$avg` over an array expression | aggregate the elements of one document |
| `$anyElementTrue` / `$allElementsTrue` | does any / do all satisfy |

`{$sum: '$items.qty'}` deserves special mention: given an *array* field,
`$items.qty` evaluates to an array of the `qty` values, and `$sum` over an array
sums it. So "total units on this order" needs no `$unwind` and no `$reduce` — it
is one expression, and it is a genuinely nicer answer than SQL's.

## Gotchas

**★ `{$group: {_id: '$status'}}` omits statuses with no orders.** The categorical
version of the empty-day bug, and `$densify` cannot help — it only densifies
numbers and dates. Either use one accumulator per status, or seed the zeros from
a constant in the API and treat that seeding as part of the query rather than as
formatting.

**★ `$sortByCount` is `$group` + `$sort` and inherits the same omission.** Its
brevity makes it look like a different mechanism. It is not; the Manual states
the equivalence explicitly, and the expansion is two lines.

**★ A missing bucket does not just lose a row, it shifts every row after it.** A
consumer that indexes into the returned array — a chart mapping `data[0]` to the
first legend colour — mislabels everything below the gap. That is strictly worse
than a missing row, and it is the reason "the caller can handle it" is not a
complete answer.

**★ `$$i` and `$i` differ by one character and one is a silent no-op.** Inside
`$filter`, `$map` and `$reduce`, `$$name` is the bound variable and `$name` is a
field path. Writing the field path finds nothing, the condition evaluates against
a missing value, and the result is an empty array rather than an error.

**★ `$filter`'s `cond` must be a boolean expression, and a bare field path is
truthy.** `cond: '$$i.qty'` is not "where qty is non-zero" — MongoDB's expression
truthiness treats `0`, `null`, `false` and missing as false and everything else
as true, so it happens to work for a number and fails confusingly for the string
`"0"`, which is truthy. Write the comparison out.

**★ `$filter` on a field that is not an array errors; `$unwind` on one does
not.** `$unwind` treats a non-array value as a single-element array and passes it
through, which is forgiving. `$filter` requires an array and fails on anything
else, including missing — so a document whose `items` was never set takes the
whole aggregation down. `{$ifNull: ['$items', []]}` around the input is the
one-expression guard, and it is worth applying by reflex on any collection
without a validator enforcing the field.

**★ `$size` errors on a missing field too.** Same guard, same reason. `$size` is
also two different operators depending on context — the *query* operator
`{items: {$size: 3}}` matches documents whose array has exactly three elements
and takes a literal, while the *aggregation* operator `{$size: '$items'}` returns
the count and takes an expression. They share a name and nothing else.

**★ `$unwind` below a `$group` that sums order totals multiplies the money.**
The fan-out is silent, the number is plausibly large, and it scales with average
basket size — so it looks like growth. Keep order-level aggregates above the
`$unwind`, or compute them in a separate `$facet` branch.

## Interview questions

**★ Why can't `$densify` fix the missing-status problem the way it fixes the
missing-day problem?**
Because `$densify` interpolates along an axis and requires the densified field to
hold *"all numeric values or all dates"*. A status is a member of an unordered
finite set; there is no step from `paid` to `shipped`. More fundamentally, the
complete set of statuses is not present in the data at all — it lives in the
application as a constant or an enum — and a stage can only interpolate between
values it can see. The completion has to come from application code, either as
one accumulator per status in the `$group` or as a seeded object in the API.

**★ You see `{$group: {_id: '$status', n: {$sum: 1}}}` in a review. What do you
ask?**
Whether the consumer knows the complete key set in advance. If it does — and a
dashboard panel with five fixed rows does — then either the pipeline needs one
accumulator per status, or the API needs to seed zeros from the status constant,
and the reviewer should see that seeding in the same change. If the consumer is a
"top N tags" list where absent genuinely means absent, the grouping is correct
and `$sortByCount` is even shorter.

**★ When do you reach for `$filter` rather than `$unwind`?**
Whenever the question is about a *subset of an array within one document* rather
than about the array elements as independent rows. `$filter` preserves one
document per order, so every other accumulator in the same `$group` keeps its
meaning; `$unwind` multiplies documents and silently multiplies every
order-level aggregate along with them. Reach for `$unwind` only when the output
genuinely has one row per line item.

**★ How would you compute "total units sold" across a date range without
`$unwind`?**
`{$sum: {$sum: '$items.qty'}}` — the inner `$sum` takes the array of `qty` values
that `$items.qty` produces for one document and reduces it to that order's unit
count; the outer one is the group accumulator. One document per order throughout,
so any other accumulator in the same `$group` — order count, revenue — stays
correct. The `$unwind` version gets the same units number and quietly triples the
revenue beside it.

**★ Both `$filter` and `$size` error on a missing field. Is that good design?**
It is consistent with the rest of the expression language being strict about
types, and it is the same trade the schema validator makes: fail on the write, or
fail on the read. Given that this app *does* have a `$jsonSchema` validator
requiring `items`, the errors are unreachable in practice and the guard is
belt-and-braces. On a collection without a validator the guard is mandatory,
because a single legacy document with no `items` field takes down every
aggregation that touches it — and that is exactly the class of failure a document
database makes easy to create and hard to notice.

---

← Prev: [Conditional aggregates](02-conditional-aggregates.md) ·
[Overview](README.md) ·
Next → [Window functions](03-window-functions.md)
