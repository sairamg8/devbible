---
title: "aggregate<T>() is an assertion, not a check — the same lie pool.query<Row>() tells, over a pipeline the compiler can read even less of"
sidebar_label: "19 · Running it from Node"
sidebar_position: 19
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-02 against the **MongoDB Manual (8.0)** —
> [`db.collection.aggregate()`](https://www.mongodb.com/docs/manual/reference/method/db.collection.aggregate/),
> [`aggregate` command](https://www.mongodb.com/docs/manual/reference/command/aggregate/),
> [ObjectId](https://www.mongodb.com/docs/manual/reference/method/ObjectId/).
> `mongodb` is **not** installed in this repo's `node_modules`, so every driver
> claim comes from the published driver docs and the driver source on GitHub, not
> from a local declaration file.
> Counterpart:
> [6·03·01 — the generic is an assertion](../../phase-6-typescript/03-typing-raw-pg-results/01-the-generic-is-an-assertion.md).
> Spine: **MongoDB 8.0** (8.2 minor) · driver **`mongodb` 7.5.0** · **Node 24 LTS**.

**Every pipeline in this chapter has been a value. This chunk is the module that
runs them, and it exists mostly to say one thing clearly:
`collection.aggregate<DailyRow>(pipeline)` does not check that the pipeline
produces a `DailyRow`. It is an unchecked assertion, exactly as
`pool.query<Row>(sql)` is in
[Phase 6 chapter 03](../../phase-6-typescript/03-typing-raw-pg-results/01-the-generic-is-an-assertion.md)
— and the pipeline case is worse, because a SQL string is at least a string a
human reviewer can read against the row type, while a pipeline is an array of
objects whose output shape is the composition of a dozen stages.
[Chunk 20](08b-driver-options-and-the-route.md) takes the options the driver call
needs and the route that sits above it.**

## The module

```js
// db/mongo/dashboard.js
import {revenueByDayPipeline, statusCountsPipeline,
        topProductsPipeline, dashboardPipeline} from './dashboard.pipelines.js';

const DASHBOARD_TIMEOUT_MS = 5_000;

export function dashboardRepo(db) {
  const orders = db.collection('orders');

  return {
    async overview({from, to}) {
      const [f] = await orders
        .aggregate(dashboardPipeline({from, to}), {
          maxTimeMS: DASHBOARD_TIMEOUT_MS,
          comment: 'admin:dashboard',
        })
        .toArray();

      return {
        statusCounts: f.statusCounts[0]
          ?? Object.fromEntries(STATUSES.map(s => [s, 0])),
        overview:     f.overview[0] ?? {orders: 0, revenueCents: 0},
        revenueByDay: f.revenueByDay.map(toDayRow),
        topProducts:  f.topProducts.map(toProductRow),
      };
    },
  };
}

const toDayRow = (d) => ({
  day: d.day.toISOString().slice(0, 10),      // Date -> 'YYYY-MM-DD' for the wire
  revenueCents: d.revenueCents,
  orders: d.orders,
});

const toProductRow = (p) => ({
  productId: p._id.toHexString(),             // ObjectId -> string for the wire
  slug: p.slug, name: p.name,
  units: p.units, revenueCents: p.revenueCents,
});
```

Same shape as
[Phase 2's data layer](../../phase-2-node-services/02-the-data-layer.md) and as
[the catalog repository](../02-the-catalog/04-the-catalog-repository.md): one
function per question, domain arguments in, domain shapes out, **no driver
objects escaping**. `ObjectId` and `Date` are converted at this boundary, not in
the route and not in the serialiser.

## The generic is an assertion

In TypeScript:

```ts
interface DailyRow { day: Date; revenueCents: number; orders: number }

const rows = await orders
  .aggregate<DailyRow>(revenueByDayPipeline({from, to}))
  .toArray();
// rows: DailyRow[]  — because you said so, not because anything checked
```

The driver types `aggregate<T>` so the returned cursor is an
`AggregationCursor<T>` and `toArray()` resolves to `T[]`. Nothing validates it.
The pipeline is an array of plain objects; the compiler has no model of what
`$group` does to a field set, so it cannot know that a `$project` two stages
earlier dropped `orders`, or that `day` is a `Date` rather than a string, or that
the field is called `revenueCents` and not `revenue_cents`.

This is the identical failure to `pool.query<Product>(sql)` in Phase 6, and the
identical set of remedies:

1. **A row type per pipeline, named after it and defined next to it.** Not a
   shared `Row` reused across three reports.
2. **A mapper at the boundary** — `toDayRow` above — because writing the mapper
   forces you to name every field you actually read, and a field the pipeline
   stopped producing shows up as `undefined` in one place instead of `NaN` in
   four.
3. **A `zod` parse when the cost is justified**, which
   [6·03·05b](../../phase-6-typescript/03-typing-raw-pg-results/05b-where-the-parse-earns-its-cost.md)
   argues is at the trust boundary rather than everywhere. A dashboard read by
   one admin is a fine place to pay it; the catalog's hot path is not.

The pipeline case has one extra hazard the SQL case does not. In SQL a renamed
column produces a row whose key is different, and a mapper that reads it gets
`undefined`. In a pipeline, `{$project: {revenueCents: 1}}` on a stream where the
field is called `revenue` produces documents **without the field at all**, and
`$sum` over a missing field is `0` — so the number arrives, it is wrong, and it is
plausible. The compiler is not the only thing that will not catch it; neither
will a smoke test.

## Gotchas

**★ `aggregate<T>()` checks nothing.** The generic sets the cursor's element type
and the compiler never sees the pipeline's actual output. It is the same
unchecked assertion as `pool.query<Row>()`, over an input the compiler can read
even less of.

**★ A missing field in a pipeline becomes `0`, not `undefined`, once an
accumulator touches it.** `$sum` over a field that a rename made absent is zero,
so a wrong field name produces a plausible number rather than a crash. This is
why the mapper at the boundary earns its keep: it names every field the API
actually reads, in one place.

**★ `ObjectId` and `Date` leak into the response if the repository does not
convert them.** `JSON.stringify` turns an `ObjectId` into
`{"$oid": "..."}`-ish extended JSON or a plain string depending on the
serialisation path, and a `Date` into an ISO string with a time component the
chart does not want. Convert at the repository boundary, once, so the wire format
is a decision rather than a side effect.

**★ Two `ObjectId` instances with the same bytes are not `===`.** Any
JavaScript-side join or `Map` key built from ids has to use `.toHexString()` or
`.equals()`. This bites in exactly the place the `$in`-hydration alternative
([chunk 16](06b-lookup-shape-and-alternatives.md)) puts you.

## Interview questions

**★ Does `collection.aggregate<DailyRow>(pipeline)` validate anything?**
No. It sets the element type of the returned `AggregationCursor` so that
`toArray()` resolves to `DailyRow[]`, and nothing checks that the pipeline
produces documents of that shape. It is an unchecked assertion, structurally the
same as `pool.query<Row>(sql)`. It is arguably worse, because a SQL string can at
least be read against the row type by a human reviewer, whereas a pipeline's
output shape is the composition of every stage and is not written down anywhere.

**★ What is the practical difference between a wrong field name in SQL and a
wrong field name in a pipeline?**
In SQL the wrong name is usually an error at parse time or produces a row with a
key the mapper cannot find, so it surfaces as `undefined`. In a pipeline a
reference to a non-existent field is not an error: it resolves to missing, and
the accumulators treat missing as absent — `$sum` returns `0`, `$avg` excludes it
from the denominator. So the query succeeds, the number is plausible, and nothing
in the type system, the driver or a smoke test objects. That is the argument for
a mapper at the boundary and for a parse where the cost is justified.

**★ What does the repository boundary convert, and why there rather than in the
serialiser?**
`ObjectId` to a hex string and `Date` to whatever the wire format is — here a
`YYYY-MM-DD` string, because the chart wants a day and not an instant. It happens
in the repository because that is the layer that knows the storage types exist:
one place, one decision, and no driver object escaping into the route. Doing it
in a serialiser means the conversion is implicit, applies to everything
uniformly, and produces `ObjectId` as extended JSON in some paths and a plain
string in others — a wire format nobody chose.

---

← Prev: [`$merge` and the ladder](07b-merge-and-the-ladder.md) ·
[Overview](README.md) ·
Next → [The driver options that matter](08b-driver-options-and-the-route.md)
