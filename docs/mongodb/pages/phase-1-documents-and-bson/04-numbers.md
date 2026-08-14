---
title: "Numbers — int32, int64, double, Decimal128"
sidebar_label: "04 · Numbers"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-15 against the **MongoDB Manual** —
> [Model Monetary Data](https://www.mongodb.com/docs/manual/tutorial/model-monetary-data/):
> *"The binary-based floating-point arithmetic used by many modern systems (i.e., float,
> double) is unable to represent exact decimal fractions and requires some degree of
> approximation making it unsuitable for monetary arithmetic"*, the three documented models
> (decimal, scale factor, non-numeric) and that *"using the decimal type for modeling
> monetary data is preferred over the Scale Factor method"* — plus
> [BSON Types](https://www.mongodb.com/docs/manual/reference/bson-types/) and
> [Comparison/Sort Order](https://www.mongodb.com/docs/manual/reference/bson-type-comparison-order/)
> (*"MongoDB treats all numeric types as equivalent for comparison purposes"*).
> **Documentation-validated; no console blocks.**

MongoDB has four numeric types. JavaScript has one. **Every number you write from Node
becomes a BSON `double` unless you say otherwise**, and that single fact causes most numeric
surprises in a Node + MongoDB stack.

| BSON type | Alias | Range / precision | Use it for |
|---|---|---|---|
| `int` | `"int"` | 32-bit signed, ±2.1 billion | counts, small integers, when the width is part of the contract |
| `long` | `"long"` | 64-bit signed | ids from other systems, large counters, epoch milliseconds |
| `double` | `"double"` | IEEE-754 binary64 | measurements, ratios, anything where approximation is fine |
| `decimal` | `"decimal"` | IEEE-754 **decimal128**, 34 significant digits | **money**, and anything where exact decimal fractions matter |

## What Node actually sends

```js
await db.collection("orders").insertOne({
  qty: 3,          // → double, not int
  total: 19.99,    // → double, and not exactly 19.99
});
```

Both are `double`, because that is what a JavaScript number is. Two consequences:

- **`{qty: {$type: "int"}}` matches nothing**, even though every value is a whole number.
  Schema validators asserting `"int"` reject perfectly good writes for the same reason.
- **`total` is stored as the nearest binary64 value to 19.99**, which is not 19.99.

To write a specific type, wrap it:

```js
import { Int32, Long, Double, Decimal128 } from "mongodb";

await db.collection("orders").insertOne({
  qty: new Int32(3),
  externalId: Long.fromString("9007199254740993"),
  total: Decimal128.fromString("19.99"),
});
```

⚠️ **`Long.fromString`, not `Long.fromNumber`, for anything above 2^53.** A JavaScript number
cannot hold `9007199254740993` in the first place, so converting *from* a number has already
lost the value before the driver sees it. The string form is the only safe path — the same
reason `BigInt` exists in JavaScript.

## Money

The Manual is unambiguous that binary floating point is *"unsuitable for monetary
arithmetic"*, and it documents three models:

**1 · `Decimal128` — the preferred one.** Exact decimal fractions, 34 significant digits, and
server-side arithmetic works: `$inc`, `$mul`, and aggregation operators all behave exactly.

```js
{ price: Decimal128.fromString("2.099") }
```

**2 · Scale factor — integer minor units.** Store `9.99 USD` as `9990` at a scale of 1000, in
an `int` or `long`. Exact, compact, index-friendly, and every consumer must know the scale.
The Manual explicitly prefers the decimal type to this, but it remains right when you are
interoperating with a legacy integer system.

**3 · Non-numeric — a string plus an approximate double.** For when no server-side arithmetic
is needed. Rare, and it puts the burden on every reader.

🔴 **Whichever you choose, store the currency next to the amount.** A bare number is not a
monetary value, and a collection mixing currencies without a code is unfixable later.

⚠️ **`Decimal128` values arrive in Node as `Decimal128` objects, not numbers.** They do not
participate in JavaScript arithmetic — `doc.total * 2` produces `NaN`. Convert deliberately at
the edge (`.toString()` into a decimal library, or to minor units), and never by calling
`Number()` on the way in, which throws away the exactness you paid for.

## Comparison across types — the mercy and the trap

**The mercy:** *"MongoDB treats all numeric types as equivalent for comparison purposes."*
`{price: {$gt: 100}}` matches an `int`, a `long`, a `double` and a `Decimal128` alike, and
they sort together. You do not need to enumerate types in a range query.

**The traps that remain:**

- **`$type` is not comparison.** `{$type: "int"}` is a type test and matches only that type.
  Use `{$type: "number"}` — the documented alias covering all four — when you mean "any
  number".
- **Sorting equal-valued different-type values is unspecified in practice**; do not build
  logic on the ordering of `100` versus `Decimal128("100")`.
- **Arithmetic is not comparison.** `$inc` on a `double` field keeps producing doubles, so a
  field that started as a `Decimal128` and is incremented by a plain JS number can drift
  toward a double, silently changing the field's type across documents.

## Precision, concretely

A binary64 double holds integers exactly up to **2^53 − 1** (9,007,199,254,740,991). Beyond
that, consecutive integers stop being representable, so a large external id round-trips to a
different number. That is why `long` exists and why ids from other systems should be stored
as `long` or as a string, never as a plain JS number.

For fractions, the classic demonstration is that `0.1 + 0.2 !== 0.3` in binary floating point.
It applies identically to a MongoDB `double` field, in the database as well as in Node.

## Gotchas

**Symptom:** a `$type: "int"` query or an `"int"` schema validator matches nothing, or rejects
every write.
**Cause:** the values were written from JavaScript, so they are `double`.
**Fix:** wrap with `Int32`/`Long` when writing if the type is part of the contract, or assert
`"number"` instead of `"int"`.

**Symptom:** money is off by a cent after a few operations.
**Cause:** `double` cannot represent exact decimal fractions, which the Manual calls unsuitable
for monetary arithmetic.
**Fix:** `Decimal128`, or integer minor units with an explicit scale. Migrate the existing
values; the drift does not heal.

**Symptom:** `doc.total * 1.2` yields `NaN`.
**Cause:** a `Decimal128` arrives in Node as an object, not a number.
**Fix:** convert deliberately — `.toString()` into a decimal library, or work in minor units.
Do not `Number()` it, which discards the exactness.

**Symptom:** a large external id comes back different from what was sent.
**Cause:** it exceeded 2^53−1 as a JavaScript number, so precision was lost before the driver
was involved.
**Fix:** `Long.fromString(...)` or store it as a string. Never `Long.fromNumber` for values
that large.

**Symptom:** one field is a mix of `double` and `decimal` across documents.
**Cause:** `$inc` with a plain JS number, or writes from two code paths.
**Fix:** audit with `$type`, migrate, and add a `$jsonSchema` validator naming the type.

**Symptom:** a range query returns fewer documents than expected despite mixed numeric types.
**Cause:** not the numeric types — those compare as equivalent. Something in the field is a
**string** ([topic 01](./01-the-bson-types.md)).
**Fix:** audit with `$type` for `"string"`.

## Interview questions

**★ Why is money stored as `Decimal128` rather than a double?**
Because binary floating point cannot represent exact decimal fractions — the Manual calls it
unsuitable for monetary arithmetic — so values drift as they are added, multiplied and
rounded. `Decimal128` is IEEE-754 decimal with 34 significant digits, exact for decimal
fractions, and it supports server-side arithmetic. The documented alternative is integer minor
units with a scale factor, which the Manual ranks second.

**★ What type does a number written from Node become?**
A `double`, always, because that is what a JavaScript number is. That is why `$type: "int"`
queries match nothing on data written from Node, why `"int"` validators reject good writes, and
why exact integers above 2^53−1 must be written with `Long.fromString`.

**★ Does `{price: {$gt: 100}}` match a `Decimal128` price?**
Yes. The Manual says all numeric types are treated as equivalent for comparison, so a range
query spans `int`, `long`, `double` and `decimal`, and they sort together. `$type` is the
exception — it is a type test, so use the `"number"` alias when you mean any numeric type.

**Why store an external 64-bit id as a `long` or a string?**
Because a JavaScript number holds integers exactly only to 2^53−1; beyond that the value is
already wrong before it reaches the driver, so it round-trips as a different id.
`Long.fromString` avoids the lossy number entirely.

**You inherit a collection where `price` is a mix of double, decimal and string. What do you
do?**
Audit with `$type` to size each group. Migrate to one type — `Decimal128` for money — with a
script that converts the strings and doubles, being explicit about rounding. Then add a
`$jsonSchema` validator so it cannot recur. Until the migration runs, range queries are
silently missing the string rows.

**What breaks if you `$inc` a `Decimal128` field with a plain number?**
The field's type can drift toward `double` across documents, reintroducing exactly the
imprecision `Decimal128` was chosen to avoid — and it does so unevenly, so some documents stay
exact and others do not.

---

← Prev: [`ObjectId`](./03-objectid.md) ·
Index: [Phase 1](./README.md) ·
Next → [Dates vs Timestamps](./05-dates-vs-timestamps.md)
