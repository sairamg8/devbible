---
title: "insertOne and insertMany"
sidebar_label: "01 · insert"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-15 against the **MongoDB Manual** —
> [`db.collection.insertMany()`](https://www.mongodb.com/docs/manual/reference/method/db.collection.insertMany/):
> `ordered` **defaults to `true`**, where an error stops the operation and *"remaining documents
> in the queue are not processed"*, while `ordered: false` *"continues inserting remaining
> documents even if errors occur"* and documents *"may be reordered by `mongod` for
> performance"*; the return value carries `acknowledged` and `insertedIds`; there is **no limit
> on the number of documents** in the array, with automatic batching according to
> `maxWriteBatchSize` (**100,000 documents per batch**) — and
> [Documents](https://www.mongodb.com/docs/manual/core/document/) for driver-side `_id`
> generation.
> **Documentation-validated; no console blocks.**

```js
db.orders.insertOne({ customerId: 42, total: Decimal128("79.98") });
db.orders.insertMany([ { … }, { … }, { … } ]);
```

Both create the collection and the database if they do not exist
([Phase 2](../phase-2-mongosh/02-navigating.md)), and both let the **driver generate `_id`**
when you omit it — client-side, before the write is sent, so the id is available immediately
([Phase 1](../phase-1-documents-and-bson/02-the-id-field.md)).

## The one option that matters: `ordered`

**`ordered` defaults to `true`.** On the first error, the operation stops and the remaining
documents are never processed. Everything before the failure is already written — **there is no
rollback**, because atomicity is per document
([Phase 0](../phase-0-how-mongodb-runs/02-single-document-atomicity.md)).

```js
// documents 1 and 2 inserted, 3 fails, 4 and 5 never attempted
db.orders.insertMany([d1, d2, badDoc, d4, d5]);
```

**`ordered: false` continues past failures**, attempting every document and reporting all the
errors at the end. The documented trade is that documents *"may be reordered by `mongod` for
performance"* — so it is faster, and insertion order is not preserved.

| | `ordered: true` (default) | `ordered: false` |
|---|---|---|
| On error | stops; the rest are skipped | continues; all errors reported |
| Order | as given | may be reordered |
| Speed | slower | faster |
| Use when | later documents depend on earlier ones | bulk loading independent documents |

🔴 **Neither is a transaction.** In both cases the successful documents stay written. The
question `ordered` answers is *"how much of the batch do I want attempted?"*, not *"all or
nothing?"* — for that you need an actual transaction, and it is usually the wrong tool for a
bulk load.

## Partial failure is the normal case

Plan for it, because the most common cause is a duplicate `_id` or a unique-index violation —
which is exactly what you get when a retry re-sends a batch that half-succeeded.

**The idiom that makes retries safe:**

```js
try {
  await db.collection("orders").insertMany(docs, { ordered: false });
} catch (err) {
  // err.writeErrors — one entry per failed document, with its index and code
  const fatal = err.writeErrors?.filter((e) => e.code !== 11000);   // 11000 = duplicate key
  if (fatal?.length) throw err;
  // duplicates only: the documents are already there, so this retry succeeded in effect
}
```

**Duplicate-key errors on a retry are success, not failure.** If your documents carry
deterministic `_id`s — derived from the source data rather than generated — a re-run inserts
what is missing and rejects what is already there, which is idempotency for free
([topic 05](./05-update.md) covers the upsert version).

## Batching is automatic

There is **no limit on the number of documents** you can pass. The driver batches according to
`maxWriteBatchSize` — **100,000 documents per batch** — so 250,000 documents become three
batches transparently.

That is a reason not to hand-roll your own chunking loop for correctness. It remains
worthwhile for **memory and back-pressure**: building an array of a million documents in
application memory before calling `insertMany` is a client-side problem the batching does not
solve.

## The return value

```js
{ acknowledged: true, insertedIds: { '0': ObjectId("…"), '1': ObjectId("…") } }
```

- **`acknowledged`** is `true` when the write ran with write concern, `false` when write
  concern was disabled — a write you did not wait for is a write you cannot claim happened.
- **`insertedIds`** is keyed by the document's **position in your input array**, which is how
  you correlate results and errors back to your own data.

⚠️ **With `ordered: false` the *insertion* order may differ from your array order**, but the
keys in `insertedIds` and the `index` in each write error still refer to your original
positions. That is what makes error handling tractable.

## Gotchas

**Symptom:** a bulk insert failed and half the documents are in the collection.
**Cause:** `ordered: true` stops at the first error, and earlier documents are already
committed — there is no rollback.
**Fix:** expect partial writes. Use deterministic `_id`s so a retry is idempotent, or a
transaction if all-or-nothing is genuinely required.

**Symptom:** a retry of a failed batch fails entirely with duplicate-key errors.
**Cause:** the first attempt wrote some documents.
**Fix:** `ordered: false` and treat code 11000 as already-done. Re-raise anything else.

**Symptom:** documents come back in a different order than they were inserted.
**Cause:** `ordered: false` allows `mongod` to reorder for performance.
**Fix:** if order matters, keep `ordered: true`, or store an explicit sequence field and sort by
it — insertion order is not a guarantee to rely on anyway.

**Symptom:** the client runs out of memory on a large import.
**Cause:** the whole input array was materialised before the call. Driver batching does not
help with that.
**Fix:** stream the source and insert in chunks you control.

**Symptom:** `insertMany` succeeded but the data is not there.
**Cause:** an unacknowledged write concern — `acknowledged: false`.
**Fix:** do not disable write concern for data you care about.

**Symptom:** a typo'd collection name silently created a new collection.
**Cause:** inserts create collections implicitly.
**Fix:** check names before running scripts; see
[Phase 2](../phase-2-mongosh/02-navigating.md).

## Interview questions

**★ What does the `ordered` option do?**
It defaults to `true`, meaning the insert stops at the first error and the remaining documents
are not attempted — while everything before the failure stays written, because there is no
rollback. `ordered: false` continues past errors, reports all of them together, and is faster,
with the documented caveat that MongoDB may reorder the documents for performance.

**★ A bulk insert half-succeeded. What is the right recovery?**
Re-run it with `ordered: false` and treat duplicate-key errors (code 11000) as already-done
rather than as failures, re-raising anything else. That works cleanly when the documents carry
deterministic `_id`s derived from the source data, which makes the whole import idempotent.

**★ Is `insertMany` atomic?**
No. Atomicity in MongoDB is per document, so a multi-document insert can partially succeed under
either `ordered` setting. If you truly need all-or-nothing you need a transaction — which for a
bulk load is usually the wrong tool, since idempotent retries are cheaper and more robust.

**Do you need to batch large inserts yourself?**
Not for correctness: there is no limit on the array length and the driver batches automatically
at `maxWriteBatchSize`, 100,000 documents per batch. You may still want to chunk for memory and
back-pressure reasons, because building a million-document array client-side is your problem,
not the driver's.

**What does `insertedIds` give you, and why is it keyed that way?**
The generated `_id` for each document, keyed by its position in your input array — the same
indexing used by the write errors. That correspondence is what lets you map successes and
failures back onto your own data even when `ordered: false` has reordered the actual inserts.

**What does `acknowledged: false` mean?**
The write ran with write concern disabled, so the server never confirmed it. You cannot claim
the data is stored; for anything that matters, leave write concern on.

---

← Index: [Phase 4](./README.md) ·
Next → [`find` and the query document](./02-find-and-the-query-document.md)
