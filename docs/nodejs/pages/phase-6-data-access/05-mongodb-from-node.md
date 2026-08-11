---
title: "MongoDB from Node"
sidebar_label: "05 · MongoDB from Node"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0**, `mongodb` 7.5.0 against **MongoDB 8.2.12**
> (single-node replica set).

**The official driver is not a thin wrapper around Mongoose — it is the other way
round.** Everything Mongoose does, it does by calling this. Knowing the driver is
what lets you decide, later, whether you want Mongoose at all
([page 09](./09-mongoose.md)).

```bash
npm install mongodb
```

## One client, at module scope

```js
// db.js
import {MongoClient} from 'mongodb';

const client = new MongoClient(process.env.MONGO_URL, {
  maxPoolSize: 20,
  serverSelectionTimeoutMS: 5000,
});

export async function connectDatabase() {
  await client.connect();                       // fails fast at boot
  await client.db().admin().command({ping: 1});
  return client;
}
export const db = client.db('shop');
export const orders = db.collection('orders');
export const closeDatabase = () => client.close();
```

**`MongoClient` is the connection pool.** One per process, shared by everything —
the same rule as `pg.Pool` ([page 01](./01-connection-pooling.md)). Its defaults:

```console
default maxPoolSize: 100 | minPoolSize: 0 | serverSelectionTimeoutMS: 30000
  | connectTimeoutMS: 30000 | retryWrites: true | retryReads: true
```

`connect()` is optional in modern drivers — operations connect on demand — but
calling it at boot is what turns a bad URL into a failed deploy instead of a failed
request.

## The connection string is configuration

```
mongodb+srv://user:pass@cluster.example.net/shop?retryWrites=true&w=majority&maxPoolSize=20&readPreference=primaryPreferred
```

| Option | Why you care |
|---|---|
| `w=majority` | The write is acknowledged by a majority of the replica set. Without it, a failover can lose it |
| `journal=true` | Acknowledged only once on disk |
| `readPreference` | `primary` (default), `primaryPreferred`, `secondary…`, `nearest` — see [page 15](./15-read-replicas.md) |
| `readConcern` | `local` (default), `majority`, `snapshot` |
| `maxPoolSize` | Per client. Multiply by your pod count |
| `retryWrites` / `retryReads` | On by default — one automatic retry of a transient failure |
| `directConnection=true` | Talk to this node only, skipping topology discovery |

`mongodb+srv://` resolves a DNS `SRV` record to find the members, which is why a
cluster URL has no port. That also makes DNS a startup dependency — a
`querySrv EREFUSED` at boot is a resolver problem, not a Mongo problem
([Phase 5, page 13](../phase-5-http-processes/13-dns.md)).

## Reading

```js
const one = await orders.findOne({_id: id});                 // null when missing

const page = await orders
  .find({status: 'paid', totalCents: {$gt: 50_000}})
  .project({_id: 1, totalCents: 1, placedAt: 1})             // ask for less
  .sort({placedAt: -1})
  .limit(20)
  .toArray();
```

**`find()` returns a cursor, not documents.** Nothing is sent until you `toArray()`
it or iterate it — which is also the memory decision: `toArray()` on 200 000
documents cost **486 MB of RSS** against **143 MB** iterating the cursor
([page 16](./16-cursors.md)).

`countDocuments()` runs a real aggregation and is accurate;
`estimatedDocumentCount()` reads collection metadata and is instant but stale. Use
the estimate for a dashboard, the real count for a decision.

## Writing

```js
const {insertedId} = await orders.insertOne({userId, totalCents, status: 'pending', placedAt: new Date()});

const res = await orders.updateOne(
  {_id: id, status: 'pending'},                   // filter doubles as a guard
  {$set: {status: 'paid'}, $currentDate: {paidAt: true}},
);
if (res.matchedCount === 0) throw new Error('order was not pending');
```

Read the result object, always:

| Field | Means |
|---|---|
| `matchedCount` | How many documents the filter found |
| `modifiedCount` | How many actually changed — 0 when the value was already correct |
| `upsertedId` | Set only when `{upsert: true}` inserted |

`matchedCount === 0` and `modifiedCount === 0` are different failures. The first
means your filter was wrong or the row moved; the second means the write was a
no-op.

**Update operators, not whole documents.** `updateOne(filter, {$set: {...}})`
changes fields; `replaceOne` swaps the entire document and quietly deletes anything
you left out. Passing a plain object where an operator is expected now throws
rather than replacing — but `replaceOne` still does exactly what it says.

`findOneAndUpdate` gives you the document back atomically, which is how you
implement a claim/lease:

```js
const job = await jobs.findOneAndUpdate(
  {status: 'queued'},
  {$set: {status: 'running', startedAt: new Date()}},
  {sort: {priority: -1}, returnDocument: 'after'},
);
```

## `_id` and `ObjectId`

```js
import {ObjectId} from 'mongodb';

// a string from the URL will NOT match a stored ObjectId
const order = await orders.findOne({_id: new ObjectId(req.params.id)});
```

This is the most common Mongo bug in a Node codebase: `findOne({_id: '65f…'})`
returns `null` forever, no error. And an invalid string **throws**, so validate at
the boundary:

```js
if (!ObjectId.isValid(req.params.id)) return res.status(400).json({error: 'bad id'});
```

`ObjectId` also carries its creation time — `id.getTimestamp()` — which is a free
`createdAt` for documents that forgot one.

## The types are BSON, not JSON

BSON has `Date`, `Decimal128`, `Binary`, `Long`, `ObjectId`. Two consequences:

- **`JSON.stringify` on a document does not round-trip.** `_id` becomes a string,
  `Decimal128` becomes an object. Map documents to a domain shape before they leave
  your data layer ([page 10](./10-repository-pattern.md)).
- **Never store money as a JS number.** `Decimal128`, or integer cents.

## Bulk writes

One round trip instead of `n` ([page 07](./07-n-plus-1.md)):

```js
await orders.bulkWrite([
  {updateOne: {filter: {_id: a}, update: {$set: {status: 'shipped'}}}},
  {updateOne: {filter: {_id: b}, update: {$set: {status: 'shipped'}}}},
  {insertOne: {document: {userId, totalCents: 0, status: 'draft'}}},
], {ordered: false});
```

`ordered: false` lets the server keep going after one operation fails and report
them all at the end, instead of stopping at the first. For unrelated writes that
is what you want; check `result.hasWriteErrors()`.

## Indexes belong in migrations, not in code

```js
await orders.createIndex({userId: 1, placedAt: -1});
```

Safe to call repeatedly — it is a no-op if the index exists. But **do not call it
at boot in every pod**: on a large collection an index build is an expensive
operation you have just triggered N times during a deploy. Create indexes in a
migration step ([page 11](./11-migrations.md)) and let the app assume they exist.

The `explain` output that tells you whether one is used lives in the MongoDB
section — this page stops at the Node boundary.

## Gotchas

**Symptom:** `findOne({_id: id})` always returns `null`
**Cause:** `id` is a string; the stored `_id` is an `ObjectId`.
**Fix:** `new ObjectId(id)`, guarded by `ObjectId.isValid`.

**Symptom:** `BSONError: input must be a 24 character hex string…`
**Cause:** An arbitrary URL segment passed to `new ObjectId()`.
**Fix:** Validate at the boundary and answer 400.

**Symptom:** A document lost half its fields after an update
**Cause:** `replaceOne`, or an update document without operators.
**Fix:** `updateOne` with `$set`.

**Symptom:** An update "succeeded" but nothing changed
**Cause:** `matchedCount: 0` was never checked.
**Fix:** Assert on `matchedCount` / `modifiedCount`.

**Symptom:** Writes vanish after a failover
**Cause:** Default write concern acknowledged by one node only.
**Fix:** `w=majority` in the connection string.

**Symptom:** RSS spikes to hundreds of MB on a report endpoint
**Cause:** `.toArray()` on a large result set.
**Fix:** Iterate the cursor ([page 16](./16-cursors.md)).

**Symptom:** Deploys stall while every pod builds the same index
**Cause:** `createIndex` at application boot.
**Fix:** Move it to a migration.

## Interview questions

**★ What is `MongoClient`, and how many should a process have?**
It is the connection pool and topology monitor — one per process, at module scope,
shared. Default `maxPoolSize` is 100 per client, so creating one per request opens
unbounded connections and pools nothing.

**★ Why does `findOne({_id: req.params.id})` return null?**
Because `_id` is stored as an `ObjectId` and the URL gives you a string; BSON
equality is type-strict, so they never match. Wrap it in `new ObjectId()` after
validating with `ObjectId.isValid`.

**★ What is the difference between `updateOne` and `replaceOne`?**
`updateOne` applies operators (`$set`, `$inc`) to named fields. `replaceOne`
substitutes the whole document, so any field missing from the replacement is
deleted. Most "the record lost its fields" bugs are a `replaceOne`.

**★ What does `w=majority` do and why is it not the default everywhere?**
It waits for the write to be acknowledged by a majority of replica set members, so
it survives a failover. It costs latency, which is why a single-node acknowledgement
is faster — and why an unacknowledged write can disappear when the primary steps
down.

**★ `countDocuments` vs `estimatedDocumentCount`?**
The first runs an aggregation over the collection and is accurate and slow; the
second reads collection metadata and is instant but can be stale, including after
an unclean shutdown. Estimate for display, count for decisions.

**Why is `find()` cheap even on a huge collection?**
It returns a cursor and sends nothing until you iterate. The cost appears at
`toArray()`, which materialises every document in your heap — measured 486 MB for
200 000 documents against 143 MB when iterating.

**When would you use `bulkWrite`?**
When you have many independent writes: it is one round trip instead of one per
document, and `ordered: false` lets the server complete the rest after a failure
and report all errors together.

---

← Prev: [PostgreSQL from Node](./04-postgresql-from-node.md) · Next → [Transactions](./06-transactions.md)
