---
title: "One-to-squillions"
sidebar_label: "05 · One-to-squillions"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-15 against the **MongoDB Manual** —
> [Embedding vs. References](https://www.mongodb.com/docs/manual/data-modeling/concepts/embedding-vs-references/):
> reference when **"your embedded data grows without bounds"**, when *"the child side of the
> relationship has high cardinality"*, when the combined size *"takes up too much memory or
> transfer bandwidth for your application"* and when data *"is written at different times in a
> write-heavy workload"* — and
> [BSON Types](https://www.mongodb.com/docs/manual/reference/bson-types/) with
> [Documents](https://www.mongodb.com/docs/manual/core/document/) for the document model.
> The **16 MiB maximum document size** is the constraint this topic exists for, recorded in
> [Phase 0 · BSON](../phase-0-how-mongodb-runs/03-bson.md). TTL facts from
> [TTL Indexes](https://www.mongodb.com/docs/manual/core/index-ttl/): the indexed field must be
> a date type or an array of dates; *"the background task that removes expired documents runs
> every 60 seconds"*; *"the TTL index does not guarantee that expired data is deleted
> immediately upon expiration"* and expired data *"may exist for some time beyond the 60 second
> period"*; and `expireAfterSeconds` must be within 0 and 2147483647 inclusive.
> **Documentation-validated; no console blocks.**

**One-to-squillions is the case with no upper bound at all.** Log lines per server. Events per
device. Messages in a conversation. Views on a video. Reviews on a popular product.

The answer is short: **reference from the many side, and never hold the collection in the
parent.** The rest of this page is why the alternatives fail, because they fail late.

## Why the array fails, and when

```js
// ❌ the shape that eventually breaks
{ _id: "device-7", name: "Sensor A", events: [ /* one per reading, forever */ ] }
```

**Every write rewrites a bigger document.** A `$push` to a large array is not a cheap append —
the document is rewritten, so cost grows with the array. What was a millisecond becomes tens.

**Every read pays for the whole document** unless it projects. "What is this device called?"
drags megabytes across the wire and through the cache.

**The index becomes enormous.** An index on an embedded array is multikey with one entry per
element ([Phase 1](../phase-1-documents-and-bson/06-arrays.md)), so a device with a million
events contributes a million entries.

🔴 **And then it stops.** At 16 MiB, **every write to that document fails.** Not gradually —
the reads that were slow are still slow, and the writes are now errors. The affected documents
are the most active ones, which is to say the ones that matter most, and the fix at that point
is migrating live data under load.

⚠️ **This failure arrives long after the decision.** Development data never reaches it; the
first year of production may not. That is exactly why boundedness is question one in
[topic 02](./02-embed-vs-reference.md) rather than something to revisit later.

## The shape that works

```js
// events — one document per event, referencing its parent
{ _id: ObjectId("…"), deviceId: "device-7", at: ISODate(), type: "reading", value: 21.4 }
```

```js
db.events.createIndex({ deviceId: 1, at: -1 });    // the defining index
db.events.find({ deviceId: "device-7" }).sort({ at: -1 }).limit(50);
```

What this buys:

- **Constant write cost.** Each event is one small insert. The parent is never touched, so it
  never grows and is never rewritten.
- **Cheap parent reads.** The device document stays small.
- **Pagination that works.** `{deviceId, at}` compound index serves "latest 50", and range
  pagination on `at` stays flat at any depth ([Phase 2](../phase-2-mongosh/03-cursors.md)).
- **Independent lifecycle.** Events can be archived, expired or moved to cold storage without
  touching devices.

**Paginate by range, not by `skip`.** `{deviceId, at: {$lt: lastSeen}}` with a limit uses the
index; `skip(10000)` walks ten thousand entries first.

## Keep the *useful* summary on the parent

Referencing does not mean the parent knows nothing. Store the small, bounded facts the UI
needs:

```js
{
  _id: "device-7",
  name: "Sensor A",
  eventCount: 1_284_113,                       // maintained with $inc
  lastEvent: { at: ISODate(), type: "reading", value: 21.4 },   // most recent only
}
```

This is the **subset pattern**: a bounded, denormalised slice on the parent — the last event, a
count, the top three — with the full collection referenced. It gives the list view its data in
one read while keeping the parent small.

🔴 **The bounded part is the whole point.** `lastEvent` is one document; `recentEvents` capped
at 20 via `$push` with `$slice` is fine. An array with no cap is the failure above, wearing a
different name.

⚠️ **Maintained counters are derived data.** They drift when a write path forgets, so funnel
writes through one place and reconcile periodically. A drifted `eventCount` is a display bug;
a drifted counter used for business logic is worse.

## Expiring what you no longer need

Squillions of children usually have a retention policy, and a **TTL index** enforces it without
a cron job:

```js
db.events.createIndex({ at: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });   // 90 days
```

MongoDB removes expired documents in the background. Three documented facts to hold onto:

- **The indexed field must be a date type** — or an array of dates. A date stored as a string
  silently never expires ([Phase 1](../phase-1-documents-and-bson/05-dates-vs-timestamps.md)).
- **The background task runs every 60 seconds**, and *"the TTL index does not guarantee that
  expired data is deleted immediately upon expiration"* — expired data *"may exist for some
  time beyond the 60 second period"* depending on the instance's workload.
- `expireAfterSeconds` must be between **0 and 2147483647** inclusive.

So TTL is a retention policy, **not a privacy guarantee with a deadline**. If data must be gone
by an exact moment, delete it explicitly.

## Gotchas

**Symptom:** writes to a few specific documents start failing after a long time in production.
**Cause:** those documents hit 16 MiB — the popular ones, with the biggest embedded arrays.
**Fix:** migrate the array out to its own collection. Prevent it next time by treating
"unbounded" as a design-time answer, not a monitoring alert.

**Symptom:** appending to an array gets slower as it grows.
**Cause:** `$push` rewrites the document, so cost scales with size.
**Fix:** separate collection, constant-cost inserts.

**Symptom:** reading a parent transfers far more data than the page needs.
**Cause:** a large embedded array being fetched whole.
**Fix:** reference the children; project explicitly.

**Symptom:** deep pagination through children is slow.
**Cause:** `skip()` walks everything it skips.
**Fix:** range pagination on the sort field, with a compound index on `{parentId, sortField}`.

**Symptom:** a TTL index does not delete anything.
**Cause:** the field is not a BSON date — commonly an ISO string.
**Fix:** store a real `Date`. Also expect deletion to lag expiry; it is a background process.

**Symptom:** the parent's `childCount` is wrong.
**Cause:** a write path that inserts children without `$inc`.
**Fix:** one write path, plus periodic reconciliation. Treat it as derived.

## Interview questions

**★ What is one-to-squillions and how do you model it?**
A relationship with no upper bound on the child count — events per device, messages in a
conversation, views on a video. You reference from the many side: one document per child
carrying a `parentId`, with a compound index on `{parentId, sortField}`. The parent is never
touched by a child insert, so writes stay constant-cost and the parent stays small.

**★ What exactly goes wrong if you embed instead?**
Three things get worse gradually and one fails suddenly. `$push` rewrites the document so
appends slow down; every read of the parent pays for the whole array; the multikey index grows
by one entry per element. Then at 16 MiB every write to that document fails outright — on your
busiest documents, with the only fix being a migration of live data.

**★ Why can the parent still hold some of the children's data?**
Because the subset pattern keeps a *bounded* slice — the last event, a count, the top three —
which lets a list view render in one read while the full collection stays referenced. The
requirement is the cap: a "recent items" array capped with `$push`/`$slice` is fine, an
uncapped one is the same failure under a friendlier name.

**★ How do you expire old children?**
A TTL index — `createIndex({at: 1}, {expireAfterSeconds: N})` — which deletes in the
background with no cron job. Two caveats: deletion lags expiry rather than happening exactly
at it, and the field must be a real BSON date, so a date stored as a string silently never
expires.

**How do you paginate a squillion children?**
By range on an indexed sort field — `{parentId, at: {$lt: lastSeen}}` with a limit — served by
a compound index. `skip()` degrades linearly with depth because the server still walks past
everything skipped.

**Is a maintained `childCount` on the parent a good idea?**
Yes for read-heavy list views, with the caveat that it is derived data: it drifts whenever a
write path forgets to update it, so writes should funnel through one place and a periodic
reconciliation should exist. Counting on demand is exact but costs a query per parent, which is
what makes it awkward for lists.

---

← Prev: [One-to-many](./04-one-to-many.md) ·
Index: [Phase 3](./README.md) ·
Next → [The extended reference pattern](./06-extended-reference.md)
