---
title: "Dates vs Timestamps"
sidebar_label: "05 · Dates vs Timestamps"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-15 against the **MongoDB Manual** —
> [BSON Types](https://www.mongodb.com/docs/manual/reference/bson-types/): BSON Date is
> *"a 64-bit integer that represents the number of milliseconds since the Unix epoch"* and is
> **signed**, so *"negative values represent dates before 1970"*; and the BSON timestamp type
> *"is for internal MongoDB use"*, is **not** associated with the regular Date type, and
> *"for most cases, in application development, use the BSON date type"* — plus
> [Comparison/Sort Order](https://www.mongodb.com/docs/manual/reference/bson-type-comparison-order/)
> for where each sits in the comparison order.
> **Documentation-validated; no console blocks.**

BSON has two time types with confusingly similar names, and **only one of them is yours.**

| | `date` (type 9) | `timestamp` (type 17) |
|---|---|---|
| What it is | signed 64-bit milliseconds since the Unix epoch | an internal MongoDB type |
| Who uses it | **your application** | the replication oplog |
| In Node | a JavaScript `Date` | a `Timestamp` object you should not be creating |
| Range | before 1970 as well as after — the value is signed | not meaningful as application time |

The Manual could not be clearer: the timestamp type *"is for internal MongoDB use"* and *"for
most cases, in application development, use the BSON date type"*. If a `Timestamp` appears in
your documents, something wrote the wrong type — most often code that reached for the name
that sounded right.

⚠️ **They also sort into different brackets**: Date sits below Timestamp in the BSON
comparison order, so a field holding both sorts into two groups regardless of the instants
they represent ([topic 01](./01-the-bson-types.md)).

## Date is UTC, always

A BSON `date` is an instant — a count of milliseconds — with **no timezone attached**. There
is no "stored in IST" and no offset field. A JavaScript `Date` is the same idea, which is why
the mapping is clean in both directions:

```js
await db.collection("events").insertOne({ at: new Date() });      // → BSON date
const doc = await db.collection("events").findOne();
doc.at instanceof Date;                                            // → true
```

**Timezone is a presentation concern**, resolved when you format for a user, not when you
store. Store the instant; format on the way out; keep the user's zone as a separate field if
your domain needs it.

🔴 **The one case that genuinely differs: a wall-clock time with no instant.** A birthday, a
shop's opening hour, a public holiday. "1990-05-04" is not an instant — storing it as a date
silently means midnight *somewhere*, and shifts a day when read in another zone. Store those
as a string (`"1990-05-04"`) or as separate parts, and be explicit that they are calendar
values.

## Querying by time

Range queries take real `Date` objects, and the ordering within the date bracket is what you
expect:

```js
await db.collection("events").find({
  at: { $gte: new Date("2026-08-01T00:00:00Z"), $lt: new Date("2026-09-01T00:00:00Z") },
});
```

⚠️ **A string will not match.** `{at: {$gte: "2026-08-01"}}` compares a string against dates —
different type brackets, so it matches nothing and reports no error. This is the same
type-bracketing rule as [topic 01](./01-the-bson-types.md) and one of the most common causes
of a report that comes back empty.

Two more practical notes:

- **Half-open ranges** (`$gte` start, `$lt` next start) avoid the millisecond-boundary bugs
  that `$lte` on an end date creates.
- **Do not build ranges from `$dateToString`-formatted values** in a filter — that computes a
  string per document and cannot use an index. Compare instants, and let the index work.

## `Date` versus `_id`'s embedded timestamp

An `ObjectId` already carries a creation time to the second ([topic 03](./03-objectid.md)), so
is a `createdAt` field redundant? **Usually not**, for three reasons:

- **Resolution.** ObjectId gives seconds; a `Date` gives milliseconds.
- **Meaning.** `createdAt` is a domain fact you control; `_id`'s timestamp is a side effect of
  id generation, and it changes meaning the day you switch `_id` type or import data.
- **Backdating.** Imported or migrated records have a real creation time that is not when
  their id was minted.

Use `_id` ranges as the cheap, index-free approximation; store an explicit `Date` whenever the
time is part of the domain.

## Storage and precision

- Milliseconds, as a **signed** 64-bit integer — so dates before 1970 are representable, which
  matters for anything historical.
- **No sub-millisecond precision.** If you need microseconds, store the extra precision
  separately and be explicit about it.
- **8 bytes**, versus 24+ for an ISO-8601 string. Dates are also comparable and indexable as
  numbers, which strings are not — a string date range works only while the format is
  fixed-width, zero-padded and UTC, and breaks silently the day one row is written in another
  format.

## Gotchas

**Symptom:** a date-range query returns nothing, with no error.
**Cause:** the filter used strings, or the stored values are strings — either way the
comparison crosses type brackets.
**Fix:** use `Date` objects on both sides. Audit stored values with `$type: "date"` versus
`"string"`.

**Symptom:** a `Timestamp` object turns up in application data.
**Cause:** something wrote the internal replication type, usually by picking the
familiar-sounding name.
**Fix:** convert to `date`. The Manual is explicit that timestamp is for internal use.

**Symptom:** dates are off by hours for some users.
**Cause:** an instant is being formatted in the server's zone, or a local-time string was
parsed without an offset.
**Fix:** store UTC instants, format at the edge with the user's zone, and always parse with an
explicit offset (`Z` or `+05:30`).

**Symptom:** a birthday shows as the previous day for some users.
**Cause:** a calendar date was stored as an instant, so it is midnight in one zone and the
previous evening in another.
**Fix:** store calendar values as strings or parts — they are not instants.

**Symptom:** an aggregation grouping by day is slow and ignores the index.
**Cause:** the filter or grouping computes a formatted string per document.
**Fix:** filter with instant ranges so the index applies, and format only in the output stage.

**Symptom:** sorting by a time field produces two separate ordered groups.
**Cause:** the field holds both `date` and `timestamp` values, which sit in different brackets.
**Fix:** migrate to one type.

## Interview questions

**★ What is the difference between BSON `date` and BSON `timestamp`?**
`date` is your application's type: a signed 64-bit count of milliseconds since the Unix epoch,
so it covers dates before 1970 and maps directly to a JavaScript `Date`. `timestamp` is an
internal MongoDB type used by the oplog, explicitly documented as being for internal use and
not associated with the regular Date type. If a `Timestamp` appears in application data, it is
a bug — and the two sort into different comparison brackets, so a mixed field sorts into two
groups.

**★ How does MongoDB store timezone?**
It does not. A BSON date is an instant in UTC with no offset attached. Timezone is a
presentation concern — store the instant, format for the user's zone at the edge, and keep the
zone as its own field if the domain needs it.

**★ When should a date *not* be stored as a `Date`?**
When it is a calendar value rather than an instant — a birthday, an opening hour, a holiday.
Storing "1990-05-04" as a date makes it midnight in some zone, and it shifts a day when read
elsewhere. Store those as a string or as parts.

**★ Why does a date-range query sometimes return nothing?**
Because one side is a string. Comparison is bracketed by BSON type, so a string never
satisfies a range against dates, and MongoDB reports no error — just an empty result. Both the
stored values and the query operands have to be real `Date` objects.

**Do you still need `createdAt` if `_id` is an ObjectId?**
Usually yes: the ObjectId timestamp is seconds-resolution, it is a by-product of id generation
rather than a domain fact, and it cannot express a backdated or imported record's real
creation time. The `_id` range remains a useful index-free approximation.

**Why is a `Date` better than an ISO-8601 string?**
Eight bytes instead of twenty-four or more, correct numeric comparison and indexing, and no
dependence on every writer using the same fixed-width UTC format. A string range works right
up until one row is written differently, and then fails silently.

---

← Prev: [Numbers — int32, int64, double, Decimal128](./04-numbers.md) ·
Index: [Phase 1](./README.md) ·
Next → [Arrays as a first-class type](./06-arrays.md)
