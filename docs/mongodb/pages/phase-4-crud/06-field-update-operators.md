---
title: "Field update operators"
sidebar_label: "06 · Field update operators"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-15 against the **MongoDB Manual** —
> [Field Update Operators](https://www.mongodb.com/docs/manual/reference/operator/update-field/):
> `$set` sets a field's value; `$unset` removes it; `$inc` increments by the specified amount;
> `$mul` multiplies; **`$min`** *"only updates the field if the specified value is less than the
> existing field value"*; **`$max`** *"only updates the field if the specified value is greater
> than the existing field value"*; `$rename` renames a field; **`$currentDate`** *"sets the
> value of a field to current date, either as a Date or a Timestamp"*; and `$setOnInsert` *"sets
> the value of a field if an update results in an insert of a document"* and *"has no effect on
> update operations that modify existing documents"* — with
> [Dates vs Timestamps](../phase-1-documents-and-bson/05-dates-vs-timestamps.md) for why the
> `$currentDate` type choice matters.
> **Documentation-validated; no console blocks.**

Nine operators cover almost every field-level write. The interesting ones are not `$set` — they
are the four that let the **server** decide the new value, which is what makes an update safe
under concurrency.

| Operator | What it does |
|---|---|
| `$set` | sets a field's value, creating it if absent |
| `$unset` | removes the field entirely |
| `$inc` | increments by the given amount — negative to decrement |
| `$mul` | multiplies by the given amount |
| `$min` | writes **only if** the given value is **less** than the current one |
| `$max` | writes **only if** the given value is **greater** than the current one |
| `$rename` | renames a field |
| `$currentDate` | sets a field to the current date, as a **Date** or a **Timestamp** |
| `$setOnInsert` | applies **only** when an upsert inserts; ignored on a modify |

## `$set` and `$unset`

```js
{ $set: { status: "shipped", "customer.name": "Ada" } }
{ $unset: { legacyFlag: "" } }        // the value is ignored; convention is "" 
```

**`$set` creates the field if it does not exist**, and dot paths create intermediate documents
as needed — which is convenient and is also how a typo'd path silently adds a new field instead
of updating the one you meant.

**`$unset` removes the field entirely**, which is not the same as setting it to `null`. The
difference is visible to `$exists` and matters for sparse indexes and for storage
([Phase 1](../phase-1-documents-and-bson/01-the-bson-types.md)).

## The concurrency-safe ones: `$inc` and `$mul`

```js
{ $inc: { stock: -1, viewCount: 1 } }
{ $mul: { price: Decimal128("1.2") } }
```

🔴 **This is the point of the whole page.** Read-modify-write in application code —

```js
const doc = await stock.findOne({ sku });     // read 5
await stock.updateOne({ sku }, { $set: { qty: doc.qty - 1 } });   // write 4
```

— loses updates: two concurrent requests both read 5 and both write 4, so one decrement
vanishes. `$inc` is applied by the server to the current value, atomically, so concurrent
increments all land.

**Guard the boundary in the filter, not in a branch:**

```js
db.stock.updateOne(
  { sku, qty: { $gte: 1 } },        // only if there is stock
  { $inc: { qty: -1 } },
);
// matchedCount === 0 → there was none, and nothing was written
```

The condition and the write are one operation, so nothing can change in between — a compare-and-set
without a transaction.

⚠️ **`$inc` on a `Decimal128` with a plain JavaScript number can drift the field's type toward
`double`** ([Phase 1](../phase-1-documents-and-bson/04-numbers.md)). Increment money with a
`Decimal128` value, or keep money in integer minor units.

## `$min` and `$max` — conditional writes

```js
{ $max: { highScore: 900 } }          // only if 900 beats the stored value
{ $min: { firstSeenAt: someDate } }   // only if this date is earlier
```

They are compare-and-set in one operator: the write happens **only if** the new value is greater
(`$max`) or less (`$min`) than the current one. "Record the best score", "keep the earliest
timestamp", "raise a watermark" become single atomic statements rather than read-compare-write.

They also apply to dates, which is where `$min` earns its keep — keeping the earliest of many
concurrently-reported timestamps.

## `$currentDate`

```js
{ $currentDate: { updatedAt: true } }                        // a Date
{ $currentDate: { lastSeen: { $type: "date" } } }            // explicit Date
{ $currentDate: { oplogish: { $type: "timestamp" } } }       // a Timestamp
```

The value is taken from the **server's clock**, not the client's — which removes clock skew
between application servers from your timestamps, and is the reason to prefer it over
`$set: {updatedAt: new Date()}`.

⚠️ **Choose `date`, not `timestamp`.** The BSON timestamp type is for internal MongoDB use
([Phase 1](../phase-1-documents-and-bson/05-dates-vs-timestamps.md)); `true` and
`{$type: "date"}` both give you a Date, which is what application data wants.

## `$rename`

```js
{ $rename: { "customer.fullName": "customer.name" } }
```

Useful for migrations, with two cautions: it is **not atomic across documents**, so a large
`updateMany` rename leaves the collection half-renamed while it runs — application code must
tolerate both shapes during the migration. And renaming into an existing field **overwrites**
it.

## `$setOnInsert`

Covered in [topic 05](./05-update.md), and repeated here because it belongs to this family: it
applies **only** when an upsert results in an insert and has no effect otherwise. It is what
lets one statement mean "update these fields always, and set these others only at creation".

## Combining them

One update document can carry several operators, and they apply to the same document in one
atomic write:

```js
db.products.updateOne(
  { sku },
  {
    $inc: { stock: -1, salesCount: 1 },
    $max: { lastSoldPrice: price },
    $currentDate: { updatedAt: true },
    $unset: { restockRequested: "" },
  },
);
```

⚠️ **Two operators may not touch the same field**, and one may not modify a path that another's
path passes through — for example `$set` on `a` and `$inc` on `a.b` in the same update conflict
and are rejected.

## Gotchas

**Symptom:** a counter is lower than the number of increments performed.
**Cause:** read-modify-write in application code, so concurrent updates overwrote each other.
**Fix:** `$inc`. The server applies it to the current value atomically.

**Symptom:** stock went negative.
**Cause:** the availability check was a separate read before the write.
**Fix:** put the condition in the filter — `{sku, qty: {$gte: 1}}` — and treat
`matchedCount: 0` as "none available".

**Symptom:** a typo'd dot path added a new field instead of updating one.
**Cause:** `$set` creates missing paths, including intermediate documents.
**Fix:** verify the path with `findOne` first; this is why field names are worth checking
against a real document.

**Symptom:** a `Decimal128` field became a `double` in some documents.
**Cause:** `$inc` with a plain JavaScript number.
**Fix:** increment with a `Decimal128`, or store money in integer minor units.

**Symptom:** `updatedAt` values disagree across application servers.
**Cause:** timestamps set from client clocks.
**Fix:** `$currentDate`, which uses the server clock.

**Symptom:** an update is rejected with a conflict error.
**Cause:** two operators in the same update touch the same field or overlapping paths.
**Fix:** split them, or restructure the update so each path is written once.

**Symptom:** a `$rename` migration left the collection in two shapes.
**Cause:** `updateMany` is not atomic across documents.
**Fix:** expect it — make the application read both shapes until the migration completes.

## Interview questions

**★ Why is `$inc` better than reading a value and writing it back?**
Because the server applies the increment to the current value as part of one atomic
single-document write, so concurrent increments all take effect. A read-modify-write in
application code has a window between the read and the write in which another request can do
the same thing, and one of the two updates is silently lost.

**★ How do you decrement stock without letting it go negative, and without a transaction?**
Put the condition in the filter: `updateOne({sku, qty: {$gte: 1}}, {$inc: {qty: -1}})`. The
check and the write are the same operation, so nothing can change in between, and
`matchedCount === 0` tells you there was no stock. That is compare-and-set on a single document.

**★ What do `$min` and `$max` do?**
They write conditionally: `$max` updates only if the supplied value is greater than the stored
one, `$min` only if it is less. That turns "record the highest score" or "keep the earliest
timestamp" into a single atomic statement instead of a read, a comparison and a write.

**★ Why prefer `$currentDate` over setting a date from application code?**
Because it uses the server's clock, so timestamps are consistent regardless of skew between
application servers. Prefer the `date` type — the BSON timestamp type is for MongoDB's internal
use, not for application data.

**What is the difference between `$unset` and setting a field to null?**
`$unset` removes the field; setting null leaves it present with a null value. `$exists`
distinguishes them, sparse indexes treat them differently, and a null occupies storage. Which one
is right depends on whether "absent" and "empty" mean different things in your domain.

**Can two operators in one update touch the same field?**
No — overlapping paths conflict and the update is rejected, including cases where one operator's
path passes through another's. Each path should be written by exactly one operator per update.

---

← Prev: [`updateOne` / `updateMany`](./05-update.md) ·
Index: [Phase 4](./README.md) ·
Next → **Phase 5 · Query operators and projection** *(not written yet)*
