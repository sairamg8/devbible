---
title: "BSON"
sidebar_label: "03 · BSON"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against the **MongoDB Manual** —
> [Documents](https://www.mongodb.com/docs/manual/core/document/),
> [BSON Types](https://www.mongodb.com/docs/manual/reference/bson-types/) — and
> the **BSON specification** ([bsonspec.org](https://bsonspec.org/)).

**BSON is the binary format MongoDB uses on the wire and on disk.** It is not
"JSON but faster" — it adds types JSON does not have, preserves field order, and
prefixes lengths so a parser can skip. Each of those has a consequence you will
meet.

> "BSON is a binary representation of JSON documents, though it contains more
> data types than JSON."
>
> — MongoDB Manual, *Documents*

## What BSON adds over JSON

### 1. Real types

JSON has one number type and no date. BSON has many, and the distinctions matter:

| BSON type | Why it exists |
|---|---|
| `double` | JSON's only number — IEEE 754, so imprecise for money |
| `int` (32-bit), `long` (64-bit) | exact integers, and a size distinction JSON cannot express |
| `decimal128` | 128-bit decimal — **the correct type for money** |
| `date` | milliseconds since epoch, UTC — a real date, not a string |
| `objectId` | 12-byte identifier, the default `_id` |
| `binData` | raw bytes without base64 inflation |
| `bool`, `null`, `string`, `object`, `array` | the JSON set |
| `regex`, `timestamp`, `minKey`/`maxKey` | operational and internal uses |

The one that bites: **a JavaScript number is a `double`**. Inserting `{ price:
19.99 }` from Node stores a floating-point value with the usual representation
error. For money, use `Decimal128` (or integer minor units), exactly as
`numeric` is the answer in PostgreSQL:

```js
import { Decimal128 } from "mongodb";
await db.collection("orders").insertOne({ total: Decimal128.fromString("30.97") });
```

Also: an integer literal from Node arrives as a `double` unless wrapped in
`Int32`/`Long`. Comparisons still work across numeric types, but `$type` queries
and strict validators will not match what you expect.

### 2. Field order is preserved

BSON is an **ordered** list of fields, unlike a JSON object in most languages.
Two consequences:

- Documents that differ only in field order are **not equal** for exact-match
  queries on a whole subdocument:

  ```js
  db.c.find({ addr: { city: "Pune", pin: "411001" } })   // order-sensitive
  db.c.find({ "addr.city": "Pune", "addr.pin": "411001" })  // order-independent ✅
  ```

  **Always query nested fields by dot path**, not by whole-subdocument equality.
  This is one of the most common MongoDB surprises.

- Compound index key order and document field order are different things — but
  the ordering property is why the first form above behaves the way it does.

### 3. Length prefixes

Every document and every sub-element records its length, so a reader can skip an
element without parsing it. That is what makes projection and field access
efficient on large documents, and it is part of why BSON is sometimes *larger*
than the equivalent JSON — it stores lengths and type bytes that JSON infers.

**BSON is not primarily a compression format.** It trades a little size for
traversal speed and type fidelity.

## The 16 MiB limit

> "The maximum BSON document size is 16 mebibytes."

The manual gives the reason: to stop a single document consuming excessive RAM or
bandwidth. For larger payloads there is **GridFS**, which splits a file into
chunks across two collections.

The limit is rarely hit directly and is frequently hit *eventually*, by unbounded
arrays:

```js
// ⚠️ every event pushed to the same document, forever
db.devices.updateOne({ _id }, { $push: { readings: reading } })
```

That document grows without bound and one day exceeds 16 MiB — at which point
every write to it fails. **An unbounded array is a schema bug**, and the standard
fix is the bucket pattern: cap each document at *n* entries and start a new one.

Even well below the limit, large documents cost: the whole document is rewritten
on update and moved in the cache.

## `ObjectId` is not random

The default `_id` is a 12-byte `ObjectId`:

- **4 bytes** — seconds since the Unix epoch
- **5 bytes** — a per-process random value
- **3 bytes** — an incrementing counter

Two useful consequences:

```js
_id.getTimestamp()            // creation time, for free — no createdAt needed
db.c.find().sort({ _id: 1 })  // approximately insertion order
```

Because the timestamp leads, ObjectIds are **roughly monotonic**, so `_id`
inserts land at the right-hand edge of the index rather than scattering — the
same property that makes UUIDv7 preferable to v4 as a key in PostgreSQL.

The caveats: the timestamp has **one-second** resolution, ordering across
processes is approximate, and an ObjectId leaks a creation time to anyone who
sees it.

## Reading BSON outside MongoDB

`mongoexport` writes **Extended JSON**, which encodes BSON types in JSON:

```json
{ "_id": { "$oid": "..." }, "total": { "$numberDecimal": "30.97" }, "at": { "$date": "2026-08-14T…" } }
```

Plain `JSON.stringify` of a driver result loses those distinctions — a
`Decimal128` becomes a string, a `Date` becomes an ISO string, an `ObjectId`
becomes a hex string. That is fine for an API response and **wrong for a
backup**. Use `mongodump` (BSON) for backups, not `mongoexport`.

## Trade-off

**Type fidelity in the database, type erosion at every boundary.** BSON's types
are genuinely better than JSON's, and almost nothing outside MongoDB speaks BSON:
an HTTP response, a log line, a message queue payload all force a lossy
conversion. Preserving the distinction between `Decimal128` and a string becomes
the application's job at every edge, and the driver's defaults quietly help you
lose it.

There is a modelling cost too. Because the *client* decides the type — a Node
number is a `double` unless wrapped — the same logical field can hold `int`,
`long` and `double` values across a collection's history, with nothing to
prevent it. Schema validation with `bsonType` is the only real defence, and it is
off by default.

The workable position: **choose types deliberately at the write boundary**, use
`Decimal128` for money and real `Date`s for time, and put a validator on any
collection that will outlive the code that created it.

## Gotchas

**A subdocument equality query returns nothing.**
*Symptom:* `find({ addr: { city, pin } })` misses documents that clearly match.
*Cause:* whole-subdocument equality is order- and completeness-sensitive.
*Fix:* dot paths — `find({ "addr.city": …, "addr.pin": … })`.

**Money is slightly wrong after arithmetic.**
*Symptom:* totals drift by fractions of a cent.
*Cause:* the value is a `double`, because that is what a JS number becomes.
*Fix:* `Decimal128`, or integer minor units.

**Writes to one document start failing.**
*Symptom:* an error about document size.
*Cause:* an unbounded array grew past 16 MiB.
*Fix:* the bucket pattern; never `$push` without a bound.

**`$type` queries do not match.**
*Symptom:* documents that look numeric are not returned by `$type: "int"`.
*Cause:* they were written as `double` from a JS number.
*Fix:* wrap with `Int32`/`Long` on write, and validate.

**A restored export has lost its types.**
*Symptom:* dates are strings and decimals are approximate after a restore.
*Cause:* `mongoexport` writes JSON, not BSON.
*Fix:* `mongodump`/`mongorestore` for backups.

## Interview questions

**★ What does BSON add over JSON, and what does it cost?**
Real types (`decimal128`, `date`, `objectId`, `binData`, distinct integer
widths), preserved field order, and length prefixes that let a parser skip
elements. The cost is size — type bytes and lengths mean BSON can be larger than
the equivalent JSON — and a lossy conversion at every non-MongoDB boundary.

**★ Why does `find({ addr: { city: "Pune" } })` fail to match a document whose
`addr` has more fields?**
Whole-subdocument equality compares the entire embedded document including field
order and completeness. Querying by dot path — `"addr.city"` — matches on the
individual field and is what you almost always want.

**★ What is the document size limit and what usually causes it to be hit?**
16 MiB. It is rarely hit deliberately; the common cause is an unbounded array
grown by repeated `$push`, which eventually makes every write to that document
fail. The fix is the bucket pattern, and GridFS exists for genuinely large
payloads.

**What is inside an ObjectId, and what do you get from it?**
12 bytes: a 4-byte timestamp, 5 random bytes, and a 3-byte counter. You get the
creation time via `getTimestamp()` and approximate insertion ordering by sorting
on `_id` — and because the timestamp leads, inserts append to the index rather
than scattering.

**Why is a JavaScript number a problem for money?**
It becomes a BSON `double` — IEEE 754 — so values carry representation error.
Use `Decimal128` or integer minor units.

**What is the difference between `mongoexport` and `mongodump`?**
`mongoexport` writes Extended JSON, which is human-readable but converts types;
`mongodump` writes BSON and preserves them. Backups need `mongodump`.

---

← [02 · Single-document atomicity](./02-single-document-atomicity.md) · Next: 04 · Document, collection, database →
