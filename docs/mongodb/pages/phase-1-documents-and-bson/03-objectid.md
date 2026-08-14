---
title: "ObjectId"
sidebar_label: "03 · ObjectId"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-15 against the **MongoDB Manual** —
> [`ObjectId`](https://www.mongodb.com/docs/manual/reference/method/ObjectId/): 12 bytes made
> of a **4-byte timestamp** (seconds since the Unix epoch), a **5-byte random value**
> generated once per client-side process and *"re-generated if the process restarts"*, and a
> **3-byte counter** *"initialized to a random value"* and reset on process restart; for the
> timestamp and counter *"the most significant bytes appear first"* (big-endian), unlike
> other BSON values; and `ObjectId.getTimestamp()` returning *"the timestamp portion of the
> object as a Date"* — and
> [Documents](https://www.mongodb.com/docs/manual/core/document/) for driver-side generation.
> ⚠️ **The Manual states the structure; it does not state an ordering guarantee.** This page
> is explicit about the difference.
> **Documentation-validated; no console blocks.**

`ObjectId` is the default `_id` ([topic 02](./02-the-id-field.md)) and the most-used type in
MongoDB. Twelve bytes, and every byte earns its place:

| Bytes | Content | Consequence |
|---|---|---|
| **0–3** | **timestamp** — seconds since the epoch, big-endian | creation time is free; ids from the same second share this prefix |
| **4–8** | **random value**, generated once per client process | ids from different processes differ even within the same second |
| **9–11** | **counter**, starting at a random value, incrementing per id in that process | ids from *one* process within one second are ordered |

## What that buys you

**A creation timestamp with no field to store.** `getTimestamp()` returns the timestamp
portion as a `Date`, so a collection whose `_id` is an ObjectId already knows, to the second,
when each document was created:

```js
doc._id.getTimestamp();          // → Date
```

**A range query on time, with no index to add.** Because the timestamp is the *leading* four
bytes and comparison of ObjectIds is byte-wise, an ObjectId range is a time range — served by
the unique `_id` index that always exists:

```js
const since = ObjectId.createFromTime(Math.floor(Date.now() / 1000) - 3600);
db.events.find({ _id: { $gt: since } });   // documents from the last hour
```

**Distributed generation with no coordination.** Any process, on any machine, can mint an id
that will not collide — that is what the per-process random value is for. And because the
**driver** generates it before the write is sent, the id exists client-side immediately.

**Index-friendly insert order.** New ids sort near each other, so inserts land at the right
edge of the `_id` index rather than scattering it. This is the same property that makes UUIDv7
preferable to UUIDv4 in PostgreSQL, and it is why a `binData` UUIDv4 as `_id` is a
worse-behaved key than an ObjectId.

## 🔴 What it does *not* give you

This is the half people get wrong, and the Manual is worth reading carefully here: it
documents the **structure**, not an ordering guarantee.

**1 · It is not a sequence.** There is no "id 5". The counter starts at a *random* value in
each process, and there is no global sequence — so ObjectIds carry no count, no density
information, and nothing you can subtract to get "how many documents were created between
these two".

⚠️ The old trick of estimating volume from id gaps does not work, because those bits are
random per process and reset on restart.

**2 · Ordering is approximate, not strict.** Sorting by `_id` sorts by time **to the
second**, then by a random per-process value, then by that process's counter. So:

- Within **one process**, in **one second**, the order is the insertion order.
- Across **two processes**, within the same second, the order is effectively arbitrary — it
  is decided by whichever process happened to have the higher random value.
- After a **process restart**, the random value and the counter both change.

For "roughly newest first" that is fine and cheap. For anything where strict ordering is part
of the contract — a ledger, an audit sequence, "the first order wins" — **store an explicit
timestamp with the precision you need, or a real sequence, and order by that.**

**3 · One-second resolution.** The timestamp is seconds, not milliseconds. Two documents
created 10 ms apart may share the entire timestamp prefix, and a `getTimestamp()`-based
report cannot tell them apart.

**4 · It is not a secret.** An ObjectId in a URL leaks creation time and is partially
guessable within a process's sequence. Anything security-relevant needs its own random token —
`_id` is an identifier, not a capability.

## Working with them

```js
import { ObjectId } from "mongodb";

// A 24-character hex string from a URL is a string, not an ObjectId
const id = ObjectId.createFromHexString(req.params.id);   // throws if malformed
await db.collection("orders").findOne({ _id: id });
```

🔴 **The single most common MongoDB bug in a Node application** is querying with the string
form: `{_id: "652f…"}` matches nothing, because a string never equals an ObjectId — different
BSON types, and equality is type-sensitive ([topic 01](./01-the-bson-types.md)). It returns
`null`, not an error, so it reads as "not found" and is often "fixed" by adding a 404.

Validate at the edge, so a malformed id gives a 400 rather than a confusing 404:

```js
if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ error: "bad id" });
```

⚠️ **`ObjectId.isValid` is weaker than it looks** — it accepts any 12-byte string or
24-character hex value, so some inputs that are not real ids pass. It is a cheap input filter,
not a proof the document exists.

## When not to use one

- **A natural key already exists and is genuinely immutable** — use it, and get uniqueness
  free ([topic 02](./02-the-id-field.md)).
- **Ids are minted by another system** — store theirs, as `binData` if it is a UUID.
- **The id is user-facing and must not leak timing** — use a random token, or keep the
  ObjectId internal and expose a separate public id.

## Gotchas

**Symptom:** `findOne({_id: req.params.id})` returns `null` for a document that exists.
**Cause:** the id is a string from the URL; a string never equals an ObjectId.
**Fix:** `ObjectId.createFromHexString(...)`, with an `isValid` check first so bad input is a
400 rather than a 404.

**Symptom:** sorting by `_id` gives an order that is subtly wrong across servers.
**Cause:** the timestamp has one-second resolution, and within a second the order comes from a
per-process random value.
**Fix:** store an explicit timestamp (or a sequence) and sort by that when order is part of
the contract.

**Symptom:** a report built from `getTimestamp()` cannot separate events created milliseconds
apart.
**Cause:** the embedded timestamp is in seconds.
**Fix:** store a `Date` field ([topic 05](./05-dates-vs-timestamps.md)); it is milliseconds
and it is what you should be querying anyway.

**Symptom:** an "estimate the number of documents from id gaps" calculation gives nonsense.
**Cause:** the counter starts at a random value per process and resets on restart.
**Fix:** count documents. The bits are not a sequence.

**Symptom:** `ObjectId.isValid` passes something that then does not behave like an id.
**Cause:** it accepts any 24-character hex or 12-byte string.
**Fix:** treat it as an input filter only, and let the actual lookup decide existence.

## Interview questions

**★ What is inside an ObjectId?**
Twelve bytes: a 4-byte timestamp in seconds since the epoch, a 5-byte random value generated
once per client process, and a 3-byte counter that starts at a random value and increments per
id. Timestamp and counter are stored most-significant-byte first, unlike other BSON values.
That layout is why creation time is free, why distributed generation needs no coordination,
and why inserts land at the right edge of the `_id` index.

**★ Can you rely on ObjectId order?**
Only approximately. The Manual documents the structure but not an ordering guarantee. Within
one process in one second, order follows the counter and is the insertion order; across
processes in the same second it is decided by a random value; and a process restart changes
both. For "roughly newest first" it is fine and free — for anything where ordering is part of
the contract, store an explicit timestamp or a sequence.

**★ Why does `findOne({_id: "652f…"})` return null?**
Because the value is a string and the stored `_id` is an ObjectId — different BSON types, and
equality is type-sensitive, so nothing matches. It returns null rather than erroring, which is
why it so often gets mistaken for a genuine 404. Convert with
`ObjectId.createFromHexString`, guarded by `ObjectId.isValid`.

**★ How would you fetch documents created in the last hour without a `createdAt` field?**
Build an ObjectId from the timestamp — `ObjectId.createFromTime(seconds)` — and range-query
`_id` against it. Because the timestamp is the leading bytes and comparison is byte-wise, that
is a time range served by the `_id` index that already exists. The resolution is one second.

**Is an ObjectId safe to expose in a URL?**
It is not a secret. It reveals creation time to the second and is partially predictable within
a process's counter sequence. Fine as an identifier; never as an access token.

**ObjectId or UUID as `_id`?**
ObjectId unless something external requires otherwise: it is 12 bytes rather than 16, it
carries a timestamp, and its time-ordered prefix keeps index inserts at the right edge. A
random UUIDv4 scatters them — and if you must store a UUID, store it as `binData`, not as a
36-character string.

---

← Prev: [`_id`](./02-the-id-field.md) ·
Index: [Phase 1](./README.md) ·
Next → [Numbers — int32, int64, double, Decimal128](./04-numbers.md)
