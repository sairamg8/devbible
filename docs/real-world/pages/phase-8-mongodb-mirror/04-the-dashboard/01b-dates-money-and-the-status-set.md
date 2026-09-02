---
title: "The three things that make the revenue number wrong without making the query fail: the timezone, the accumulator's silence about types, and the status set written down twice"
sidebar_label: "2 · Dates, money, status"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-02 against the **MongoDB Manual (8.0)** —
> [`$dateTrunc`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/dateTrunc/)
> (`timezone` optional, *"The date to truncate, specified in UTC"*),
> [`$sum`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/sum/),
> [`$avg`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/avg/),
> [`db.createView()`](https://www.mongodb.com/docs/manual/reference/method/db.createView/),
> [ObjectId](https://www.mongodb.com/docs/manual/reference/method/ObjectId/).
> Counterpart: [1·07 — money and time](../../phase-1-database/07-money-and-time.md).
> Spine: **MongoDB 8.0** (8.2 minor) · driver **`mongodb` 7.5.0** · **Node 24 LTS**.

**[Chunk 1](01-revenue-by-day.md) was about the query plan — the ways the
dashboard gets *slow*. This chunk is about the ways it gets *wrong* while
staying fast, which is the more expensive failure because there is nothing to
notice. Three mechanisms account for almost all of it: `$dateTrunc` defaults to
UTC and quietly moves every bar on the chart; the accumulators skip values whose
BSON type is not numeric, so one bad document under-reports revenue with no
error; and "what counts as revenue" is a business rule that has to be written
down exactly once or two reports will disagree.**

## `$dateTrunc`, and the default that is wrong for every store not in London

The Manual's reference gives the shape:

```js
{$dateTrunc: {date: <expr>, unit: <expr>, binSize: <expr>,
              timezone: <tzExpr>, startOfWeek: <expr>}}
```

`date` and `unit` are required. `binSize` is optional and defaults to `1` —
`{unit: 'hour', binSize: 4}` gives four-hour buckets, which is how you build an
intraday chart without a second expression. `startOfWeek` is optional, applies
only when `unit` is `week`, and **defaults to Sunday**, which is wrong for most
of Europe and is a one-word fix (`startOfWeek: 'monday'`).

And `timezone` is optional. The reference describes `date` as *"The date to
truncate, specified in UTC"* and lists `timezone` as an optional Olson
identifier or UTC offset; omitted, the truncation happens in UTC.

That default is not a rounding detail. For a store in `Europe/Berlin`, UTC
midnight is 01:00 local in winter and 02:00 in summer, so **every order placed
between local midnight and the UTC boundary lands in the previous day's bar**.
The month total is unchanged. The daily chart is wrong by one to two hours of
sales on every single bar, in a way that only shows up when somebody reconciles
one specific day against the order list.

```js
const TZ = 'Europe/Berlin';               // config, next to the currency

{$group: {
  _id: {$dateTrunc: {date: '$createdAt', unit: 'day', timezone: TZ}},
  revenueCents: {$sum: '$totalCents'},
  orders:       {$sum: 1},
}}
```

The bounds have to agree with it. If `from` is computed as "UTC midnight thirty
days ago" and the grouping truncates to Berlin days, the first bucket is a
partial day — it holds Berlin-day *N* from 00:00 UTC onwards, missing the first
one or two local hours. Compute the range in the same zone as the truncation, or
the spine that [chunk 3](01c-densify-and-fill.md) builds will disagree with the
data it is filling.

## The accumulators are silent about types

`$sum` ignores values that are not numeric. So does `$avg`. There is no error,
no warning and no null: a document whose `totalCents` was written as the string
`"4999"` — a bad import, a JSON round-trip through a system that stringifies
large numbers, a migration that missed a cast — contributes **zero to the
revenue and one to the order count**, and the report is quietly short by exactly
one order.

This is the single sharpest difference from the Postgres original, and it is not
about MongoDB's aggregation framework: it is about the column type that vanished.
`total_cents bigint not null` made a string physically unstorable.
`totalCents: <anything>` is storable, so the guarantee has to move into the
`$jsonSchema` validator
([chapter 01·08](../01-modeling-the-store/06-constraints-that-vanish.md)) and
into the write path. The aggregation is downstream of that decision and cannot
recover from it.

If you want the pipeline itself to notice, the check is a cheap extra
accumulator:

```js
{$group: {
  _id: {$dateTrunc: {date: '$createdAt', unit: 'day', timezone: TZ}},
  revenueCents: {$sum: '$totalCents'},
  orders:       {$sum: 1},
  // documents whose totalCents is NOT a number — should always be 0
  malformed: {$sum: {$cond: [{$isNumber: '$totalCents'}, 0, 1]}},
}}
```

`$isNumber` returns `true` for BSON int, long, double and decimal and `false`
for everything else including missing. A non-zero `malformed` is a data
incident, and the dashboard endpoint is a perfectly good place to discover one.

## `$sum: 1` is `count(*)`, and it is not `count(o.id)`

Phase 1 wrote `count(o.id)` rather than `count(*)` because the query had a
`LEFT JOIN` against a `generate_series` spine, and `count(*)` would have counted
the spine row on a day with no orders — returning `1` where the honest answer is
`0`.

There is no left join here and therefore no phantom row, so `$sum: 1` is
correct. It is worth stating explicitly because the two queries look equivalent
and are not: **in MongoDB an empty day produces no group at all, where in Phase
1 it produced a group containing a null order.** Nothing to miscount, because
nothing is there — which is exactly the problem
[chunk 3](01c-densify-and-fill.md) exists to solve, arriving as a *missing
group* rather than a *miscounted* one.

## Cents in, cents out

Every amount in this app is an integer number of cents, settled in
[1·07](../../phase-1-database/07-money-and-time.md) and carried into the document
model unchanged. A year of revenue for this store, in cents, is far inside the
2^53 range JavaScript represents exactly, so `.toArray()` handing back a plain
`number` is safe.

What is not safe is dividing inside the pipeline. The moment someone adds
`{$divide: ['$revenueCents', 100]}` to "make the chart nicer", every total
becomes a binary double, `12.34` is not `12.34`, and the sum of the daily bars
stops equalling the monthly figure by fractions of a cent that accumulate.
**Divide in the presentation layer, never in the aggregation** — the same rule
Phase 1 applied to `numeric` versus `float8`, for the same reason.

If a report genuinely needs exact fractional arithmetic — a tax rate, a
percentage split — `$toDecimal` gives BSON `Decimal128`, and the driver hands it
back as a `Decimal128` object rather than a number, which is a deliberate
inconvenience: you cannot accidentally treat it as a float.

## The status set lives once

`REVENUE_STATUSES` is a module constant, exported, and used by every revenue
pipeline in the file. Order status is five values in this app — `pending`,
`paid`, `shipped`, `delivered`, `cancelled` — settled in
[chapter 01·04](../01-modeling-the-store/03-the-order-document.md), and three of
them are revenue.

Phase 1 solved the same problem with a SQL view:

```sql
create view revenue_orders as
  select * from orders where status in ('paid','shipped','delivered');
```

MongoDB has views too, and they are read-only collections defined by a pipeline:

```js
await db.createView('revenueOrders', 'orders', [
  {$match: {status: {$in: ['paid', 'shipped', 'delivered']}}},
]);
```

Both work. The view has one real advantage — a colleague poking at the database
directly gets the same definition — and two real costs: it is a schema object
that needs a migration to change, and querying through it means every pipeline
gets an implicit `$match` prepended, which is fine here but is a stage you did
not write when you are reading an `explain()`. For this app the exported
constant wins, because the requirement is only that the set be written down
**once**, and a constant shows up in a diff.

The incident this prevents is Phase 1's, verbatim: one report counted
`paid + shipped + delivered`, another was written before `shipped` existed and
never updated, and finance found the discrepancy.

## Two timestamps on every order, and only one belongs to the business

[Chapter 01·06](../01-modeling-the-store/05-ids-and-the-api-contract.md) already
ruled on this and the dashboard is where the ruling pays off. An ObjectId's
leading four bytes are a second-resolution Unix timestamp, so
`{_id: {$gte: ObjectId.createFromTime(seconds)}}` is a genuinely free range scan
on an index that always exists — no extra field, no extra index.

It is the right tool for an operational check ("orders in the last hour", the
health kit's outbox-backlog probe) and the wrong tool for a revenue report,
because it is *when the document was created on some host*, at one-second
resolution, and it cannot be backdated or corrected. A finance report that may
have to be restated reads `createdAt`, a real field with a real index.

## Gotchas

**★ `$dateTrunc` without `timezone` buckets by UTC midnight, and the chart is
wrong by one bar for part of every day.** The month total still reconciles,
which is what makes it survive review. Pass `timezone` explicitly and compute
the range bounds in the same zone.

**★ The timezone must be the store's, not the server's, and not the admin
user's.** `Intl.DateTimeFormat().resolvedOptions().timeZone` on the API host
gives whatever the container was configured with — usually `UTC`, occasionally
the deploy engineer's laptop — and it changes when the deployment moves. The
store's reporting timezone is a business constant and belongs in config next to
the currency. If the business genuinely wants per-admin-user timezones, that is
a *parameter* on the endpoint, and then the cache key in
[chunk 11](07-limits-and-materialisation.md) has to include it.

**★ `startOfWeek` defaults to Sunday.** A weekly revenue chart for a European
store silently starts each week a day early. One word: `startOfWeek: 'monday'`.
The same trap exists in `$dateTrunc`, `$week` and `$isoWeek` — and `$isoWeek` is
Monday-based by definition, which is the other way to fix it.

**★ `$sum` and `$avg` skip non-numeric values silently.** One malformed
`totalCents` under-reports revenue by exactly that order, with a `200 OK`. The
`$jsonSchema` validator is the real fix; the `$isNumber` counter above is how
you find out you needed one.

**★ `$avg` over a `$cond` that yields `null` and `$avg` over a `$cond` that
yields `0` give different answers.** `$avg` ignores non-numeric input, so the
`null` branch removes the document from the denominator entirely while the `0`
branch keeps it. "Average order value across all orders" and "average order
value across paid orders" are two different numbers and the only thing
distinguishing them in the pipeline is which literal you put in the else branch.
[Chunk 4](02-conditional-aggregates.md) works this through.

**★ Dividing cents inside the pipeline turns exact integers into doubles.**
`{$divide: ['$revenueCents', 100]}` is how a chart starts disagreeing with an
invoice. Format in the presentation layer.

**★ `Decimal128` does not come back as a JavaScript number.** If you reach for
`$toDecimal` to fix a rounding problem, the driver returns a `Decimal128`
instance, `JSON.stringify` turns it into an object rather than a number, and the
Phase 3 response shape changes. That is the correct behaviour and it is still a
contract change; decide it deliberately.

**★ A `db.createView()` view is not a materialised view.** It stores no data —
every query against it re-runs the pipeline. It is the equivalent of Postgres's
`create view`, not `create materialized view`; the materialised equivalent is
`$merge` into a real collection, which is
[chunk 11](07-limits-and-materialisation.md).

## Interview questions

**★ What is the difference between `count(o.id)` and `$sum: 1` here, and when
does it matter?**
`count(col)` counts non-null values; `count(*)` and `$sum: 1` count rows. It
matters exactly when a row exists that represents "no data" — which in Phase 1
was the `generate_series` spine row joined to nothing. MongoDB has no left join
against a generated series, so an empty day produces no document at all rather
than a document full of nulls. `$sum: 1` is right, and the empty-day problem
reappears one stage later as a missing group instead of a miscounted one.

**★ Where does the store's timezone belong, and what breaks if it is left
implicit?**
In configuration, as a business constant, passed explicitly into every
`$dateTrunc` and into the code computing the report's `from`/`to` bounds. Left
implicit, `$dateTrunc` buckets by UTC and the daily chart shifts by the UTC
offset — one to two hours of each local day lands in the neighbouring bar. It is
invisible in the monthly total and obvious the moment anyone reconciles a single
day, which is usually months later and usually during an audit.

**★ A revenue figure is 4,999 cents low and the query is correct. Where do you
look?**
At the *type* of `totalCents` on the orders in the range. `$sum` ignores
non-numeric values, so a single document holding `"4999"` as a string
disappears from the sum while still being counted as an order — the order count
and the revenue disagree by one order's worth. The diagnostic is a
`{$sum: {$cond: [{$isNumber: '$totalCents'}, 0, 1]}}` accumulator; the fix is
the schema validator, because the aggregation is downstream of a write that
should never have been accepted.

**★ Why not compute the report in dollars?**
Because dollars are fractional and BSON doubles are binary floating point, so
the sum of daily figures stops equalling the monthly figure. Integers of the
smallest currency unit are exact in BSON and exact in JavaScript up to 2^53,
which is far beyond this store's lifetime revenue. Formatting is a presentation
concern and belongs where the locale already lives.

**★ Would you use a MongoDB view for the revenue status filter?**
It is a legitimate choice and it does exactly what Phase 1's SQL view did: a
read-only collection defined by a pipeline, re-evaluated on every query, storing
nothing. Against it: changing the definition is a migration rather than a code
change, and the implicit prepended `$match` shows up in an `explain()` that you
did not write. For a set of three strings used by one module, an exported
constant is the smaller mechanism and gets the same guarantee — the set is
written down once.

**★ When is `ObjectId.createFromTime()` the right way to filter by time?**
When you want *insert* time at one-second resolution and you do not want to pay
for another index — operational queries, backfill scripts, "what arrived in the
last five minutes". Never for a business report: the ObjectId timestamp is
generated by whichever process built the id, cannot be backdated when history is
corrected, and conflates "when the row appeared" with "when the thing happened".
Those are the same value until the first data migration, and then they are not.

---

← Prev: [Revenue by day](01-revenue-by-day.md) ·
[Overview](README.md) ·
Next → [Gap-filling with `$densify` and `$fill`](01c-densify-and-fill.md)
