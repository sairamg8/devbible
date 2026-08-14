---
title: "The BSON types, completely"
sidebar_label: "01 · The BSON types"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against the **MongoDB Manual** —
> [BSON Types](https://www.mongodb.com/docs/manual/reference/bson-types/),
> [Comparison/Sort Order](https://www.mongodb.com/docs/manual/reference/bson-type-comparison-order/)
> — and the **BSON specification** ([bsonspec.org](https://bsonspec.org/)).
> **Documentation-validated; no console blocks.**

[Phase 0](../phase-0-how-mongodb-runs/03-bson.md) introduced BSON as the format. This page
is the type system itself, and the two rules that decide whether your queries match what you
think they match: **every value carries its type**, and **comparison is bracketed by type.**

## The types

| Type | Alias / number | What it is for |
|---|---|---|
| Double | `"double"` / 1 | IEEE-754 float — **what a JavaScript number becomes** |
| String | `"string"` / 2 | UTF-8 |
| Object | `"object"` / 3 | an embedded document |
| Array | `"array"` / 4 | ordered list — a first-class type ([topic 06](./06-arrays.md)) |
| Binary data | `"binData"` / 5 | raw bytes, with a subtype byte (UUIDs live here) |
| ObjectId | `"objectId"` / 7 | the 12-byte default `_id` ([topic 03](./03-objectid.md)) |
| Boolean | `"bool"` / 8 | true / false |
| Date | `"date"` / 9 | **signed** 64-bit ms since the Unix epoch, UTC |
| Null | `"null"` / 10 | present, with no value |
| Regular expression | `"regex"` / 11 | a stored pattern |
| 32-bit integer | `"int"` / 16 | exact integer |
| Timestamp | `"timestamp"` / 17 | **internal replication type — not for your data** ([topic 05](./05-dates-vs-timestamps.md)) |
| 64-bit integer | `"long"` / 18 | exact integer, large range |
| Decimal128 | `"decimal"` / 19 | 128-bit decimal — **the money type** ([topic 04](./04-numbers.md)) |
| MinKey / MaxKey | `"minKey"` / −1, `"maxKey"` / 127 | internal sentinels below and above every other value |

Deprecated and best avoided in new data: `undefined`, `symbol`, `dbPointer`, and JavaScript
code types. You will meet them only in data written years ago.

## Rule 1 — the value carries the type

There is no schema deciding what `price` is. Each document decides for itself, so one
collection can hold `{price: 100}` (double), `{price: "100"}` (string),
`{price: Decimal128("100")}`, `{price: null}` and a document with no `price` at all.

MongoDB will not stop you. **Schema validation exists and is worth using**, but it is opt-in
— the default is that a typo'd write succeeds.

## Rule 2 — comparison is bracketed by type

This is the rule behind most surprises. When MongoDB compares values of *different* types,
it orders them by type first, using a fixed sequence — lowest to highest:

**MinKey → Null → Numbers → Symbol/String → Object → Array → BinData → ObjectId → Boolean →
Date → Timestamp → Regular Expression → JavaScript → MaxKey**

Two consequences do all the damage:

**`{price: {$gt: 100}}` never matches `"150"`.** Strings sort *above* all numbers, so a
string is not "greater than the number 100" in the sense the query means — the comparison is
between brackets, and range queries only match within the type bracket you asked about. The
document is skipped silently. No error, and a total that is quietly wrong.

**Sorting a mixed field groups by type.** `sort({price: 1})` returns all the nulls, then all
the numbers, then all the strings — not one interleaved ordering.

⚠️ **The one exception, and it is a mercy:** *"MongoDB treats all numeric types as equivalent
for comparison purposes."* `int`, `long`, `double` and `decimal` compare and sort together, so
`{$gt: 100}` matches `Decimal128("150")` and `NumberLong(150)` alike. Mixed *numeric* types
are a correctness problem for arithmetic and for `$type` queries, not for comparison.

## Null, missing, and the difference that matters

Three states people conflate:

| Document | `{price: null}` matches? | `{price: {$exists: true}}` matches? |
|---|---|---|
| `{price: 100}` | no | yes |
| `{price: null}` | **yes** | **yes** |
| `{}` (no `price`) | **yes** | no |

**`{price: null}` matches both the explicit null and the missing field.** That is deliberate,
and it is why "find the documents with no price" needs `$exists: false` if you mean *absent*,
or the null query if you mean *absent or empty*.

For sorting, the Manual is explicit: *"non-existent fields are treated as if they were
null"*, so `{}` and `{price: null}` sort together. And a detail worth remembering because it
looks wrong: **an empty array `[]` sorts before a null or a missing field.**

## Finding the mess you already have

`$type` filters by BSON type, and it is the tool for auditing a collection:

```js
// documents where price is a string — the ones your range query is missing
db.orders.countDocuments({ price: { $type: "string" } });

// anything that is not a number at all
db.orders.find({ price: { $not: { $type: ["double", "int", "long", "decimal"] } } });
```

The remedy is the usual pair: **fix the data** with a migration that coerces the stragglers,
then **fix the door** with schema validation so the next one is rejected rather than stored.

## Gotchas

**Symptom:** a range query returns fewer documents than a manual count of the collection
suggests.
**Cause:** some values are stored as strings, and comparison is type-bracketed — strings sort
above all numbers, so they cannot satisfy a numeric range.
**Fix:** audit with `$type`, migrate the stragglers, add schema validation. Do **not** "fix"
it by querying for the string form too; that entrenches the mess.

**Symptom:** `{status: null}` returns documents that have no `status` field at all.
**Cause:** a null equality match also matches missing fields, by design.
**Fix:** `$exists: false` for genuinely absent, `{$eq: null, $exists: true}` for explicitly
null — and decide which one your domain actually means.

**Symptom:** a `$type: "int"` query matches nothing, though the values are plainly whole
numbers.
**Cause:** they were written from JavaScript, so they are `double` ([topic 04](./04-numbers.md)).
**Fix:** query `"double"`, or write them with `Int32`/`Long` if the integer type is meant to
be part of the contract.

**Symptom:** a sort produces values grouped in a strange order.
**Cause:** the field holds several BSON types, and sorting is by type bracket first.
**Fix:** make the field one type. The sort is behaving exactly as documented.

**Symptom:** documents with `[]` appear before the null ones in an ascending sort.
**Cause:** documented behaviour — an empty array sorts before null and before a missing field.
**Fix:** none needed; know it, and do not "correct" it with a special case.

## Interview questions

**★ Why doesn't `{price: {$gt: 100}}` match a document where price is `"150"`?**
Because MongoDB's comparison is bracketed by BSON type, and strings sort above every number
in the comparison order. A range query on numbers only matches values in the numeric bracket,
so a string price is skipped — silently, with no error, which is what makes it dangerous. The
fix is to find them with `$type` and migrate, then add schema validation.

**★ What is the difference between a field that is `null` and one that is missing?**
To an equality query on null, none — `{price: null}` matches both. To `$exists`, everything:
a missing field fails `$exists: true`. For sorting, the Manual says non-existent fields are
treated as null, so they sort together. Knowing which of the two your query means is usually
the difference between a right and a wrong answer.

**★ Do `int`, `long`, `double` and `Decimal128` compare with each other?**
Yes — the Manual says all numeric types are treated as equivalent for comparison, so a `$gt`
matches across them and they sort together. The distinctions still matter for precision, for
`$type` queries and for schema validation, but not for comparison.

**What is the BSON comparison order, roughly, and why do you need it?**
MinKey, null, numbers, string, object, array, binData, ObjectId, boolean, date, timestamp,
regex, JavaScript, MaxKey. You need it to predict what a range query matches and how a mixed
field sorts — both of which are otherwise mystifying.

**How would you audit a collection for type drift?**
`$type` queries per field: count the documents whose value is not in the expected type set.
Then migrate and add a `$jsonSchema` validator, so the audit is a one-off rather than a
recurring chore.

**Where does an empty array sort?**
Before null and before a missing field. It is documented, it surprises people, and it matters
whenever "no tags" is a real state in your data.

---

← Index: [Phase 1](./README.md) ·
Next → [`_id`](./02-the-id-field.md)
