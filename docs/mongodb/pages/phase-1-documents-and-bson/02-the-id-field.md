---
title: "_id"
sidebar_label: "02 · _id"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against the **MongoDB Manual** —
> [Documents · The `_id` field](https://www.mongodb.com/docs/manual/core/document/): every
> document in a standard collection *"requires a unique `_id` field that acts as a primary
> key"*; it is *"reserved for use as a primary key"* and **immutable**; MongoDB creates a
> **unique index** on it at collection creation; the driver generates an `ObjectId` when the
> field is omitted; it may hold any BSON type **except an array**, a regular expression or
> `undefined`; it is always moved to the front of the document; time series collections are
> the exception, having no unique `_id` requirement because no index is created on it.
> **Documentation-validated; no console blocks.**

**`_id` is the one mandatory field, the one index you never create, and the one value you
cannot change.** Three sentences, and each has consequences worth knowing before you design a
collection.

## Mandatory, and filled in for you

Every document in a standard collection has an `_id`. If your insert omits it, the **driver**
generates an `ObjectId` — usually client-side, before the write is sent; if the client does
not, `mongod` adds it.

That the driver generates it is quietly useful: **you know the id before the write reaches
the server**, so you can build references, enqueue follow-up work, or return the id to a
caller without a round trip.

The Manual notes one exception: **time series collections** do not require a unique `_id`,
because MongoDB does not create an index on it there.

## The index you never create

MongoDB creates a **unique index on `_id`** when the collection is created. You do not create
it, you cannot drop it, and it is why:

- **A lookup by `_id` is the fastest query in the database** — a unique index hit.
- **Duplicate `_id` on insert fails** with a duplicate-key error, which is the cheapest
  idempotency mechanism MongoDB offers ([topic 03](./03-objectid.md) and the upsert patterns
  in later phases build on it).
- **You never need to add `{_id: 1}` yourself.** A compound index *starting* with `_id` can
  still be useful for a covered sort, but the plain single-field one already exists.

## Immutable

`_id` cannot be changed. An update touching it is rejected — the field is reserved as the
primary key, and replication and sharding both depend on it being stable.

The practical consequence: **"changing" an id means inserting a new document and deleting the
old one**, which is two writes, not atomic ([Phase 0](../phase-0-how-mongodb-runs/02-single-document-atomicity.md)),
and invalidates every reference held elsewhere. So the choice of `_id` is a decision you live
with, which is the next section.

## Choosing what goes in it

Any BSON type is allowed **except an array, a regular expression, or `undefined`** — and the
Manual warns specifically against a BSON regular expression in `_id`, to keep replication
working. If it is a subdocument, no subfield name may begin with `$`.

Four reasonable choices:

| Choice | When it fits | The cost |
|---|---|---|
| **`ObjectId`** (default) | almost always | 12 bytes, opaque to your domain |
| **A natural key** — SKU, ISBN, email | the value is genuinely unique and never changes | a natural key that *does* change is a migration; they change more often than anyone expects |
| **UUID** — stored as `binData`, not a string | ids generated elsewhere, or cross-system | random UUIDv4 scatters index inserts; store as `BinData` (16 bytes) rather than a 36-char string |
| **A compound subdocument** — `{tenant, sku}` | a natural composite key | must be written in a **fixed field order**, because BSON preserves order and whole-document equality is order-sensitive |

**Using a natural key gives you uniqueness for free**, enforced by the index you did not have
to create. That is a real gain — but only when the value is genuinely immutable. An email
address as `_id` looks elegant until the first user changes theirs.

⚠️ **A UUID stored as a string costs 36 bytes plus overhead, in every document and every
index entry**; as `binData` it is 16. On a large collection that is the difference between an
index that fits in cache and one that does not.

## It is always the first field

The Manual states that `_id` is always the first field in a document, and that a server
receiving a document with `_id` elsewhere **moves it to the front**. Mostly invisible — but it
matters for exact whole-document equality matching, where BSON field order is significant
([topic 01](./01-the-bson-types.md) and the whole-subdocument trap in Phase 0).

## Gotchas

**Symptom:** an update that sets `_id` fails.
**Cause:** `_id` is immutable — reserved as the primary key.
**Fix:** insert a new document and delete the old one, knowing that is two non-atomic writes
and that existing references break. Better: do not put mutable domain values in `_id`.

**Symptom:** a duplicate-key error on insert with no unique index defined.
**Cause:** the unique index on `_id` is created automatically.
**Fix:** it is doing its job. Use `updateOne(..., {upsert: true})` if "insert if absent" is
what you meant.

**Symptom:** an insert of many documents fails partway, and some are already written.
**Cause:** `insertMany` is ordered by default; on a duplicate `_id` it stops there.
**Fix:** decide deliberately — `{ordered: false}` to continue past failures and collect the
errors, or keep the stop-at-first behaviour.

**Symptom:** the index is much bigger than expected on a collection keyed by UUID.
**Cause:** the UUIDs are stored as 36-character strings.
**Fix:** store them as `binData` (16 bytes). Migrating means rewriting the documents, so it is
worth getting right at the start.

**Symptom:** a query on a compound `_id` subdocument matches nothing.
**Cause:** whole-subdocument equality is order- and completeness-sensitive, because BSON
preserves field order.
**Fix:** always construct the key with the same field order, or query by dot path
(`_id.tenant`) instead of by whole subdocument.

## Interview questions

**★ What is guaranteed about `_id`?**
Every document in a standard collection has one; it is unique, enforced by a unique index
MongoDB creates automatically at collection creation; it is immutable; and it is always the
first field, with the server moving it there if necessary. If you omit it, the driver
generates an `ObjectId` — usually before the write is sent, so the id is known client-side.

**★ Can you use a natural key like an email address as `_id`?**
Yes — any BSON type except an array, a regex or `undefined` is allowed, and it gives you
uniqueness for free. The catch is immutability: `_id` cannot be updated, so a "natural" key
that ever changes forces an insert-plus-delete, which is not atomic and breaks every existing
reference. Use it only for values that genuinely never change.

**★ Why store a UUID as `binData` rather than a string?**
Sixteen bytes instead of thirty-six, in every document and every index entry. On a large
collection that is the difference between an index that stays in cache and one that does not.
It is also the type the Manual points to for UUID storage.

**Why is a lookup by `_id` the fastest query available?**
Because the unique index on `_id` always exists, so it is a direct index hit with no
collection scan and no index to remember to create.

**What happens if you insert a document whose `_id` already exists?**
A duplicate-key error. That is often exactly what you want — it makes `_id` the cheapest
idempotency key available. With `insertMany`, the default ordered behaviour stops at the first
failure; `{ordered: false}` continues and reports all errors.

**Is `_id` required in every collection?**
In standard collections, yes. Time series collections are the documented exception — they do
not require a unique `_id`, because MongoDB does not index it there.

---

← Prev: [The BSON types, completely](./01-the-bson-types.md) ·
Index: [Phase 1](./README.md) ·
Next → [`ObjectId`](./03-objectid.md)
