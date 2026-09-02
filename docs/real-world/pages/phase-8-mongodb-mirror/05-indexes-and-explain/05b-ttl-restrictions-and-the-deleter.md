---
title: "Four ways to declare a TTL index that never expires anything, and what the single-threaded deleter is actually doing between passes"
sidebar_label: "8 · TTL restrictions"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-02 against the **MongoDB Manual (8.0)** —
> [TTL Indexes](https://www.mongodb.com/docs/manual/core/index-ttl/)
> (*"TTL indexes are single-field indexes. Compound indexes do not support TTL and
> ignore the `expireAfterSeconds` option"*; *"If the indexed field in a document
> doesn't contain one or more date values, the document will not expire"*; *"If a
> document does not contain the indexed field, the document will not expire"*;
> *"The TTL deletion process is a single-threaded background task"*; the
> 50,000-document / one-second per-index limits; *"the process stops the current
> deletion loop every 60 seconds"*; *"After you create a TTL index, it might have a
> very large number of qualifying documents to delete at once"*),
> [`collMod`](https://www.mongodb.com/docs/manual/reference/command/collMod/),
> [`serverStatus`](https://www.mongodb.com/docs/manual/reference/command/serverStatus/).
> Spine: **MongoDB 8.0** (8.2 minor) · driver **`mongodb` 7.5.0** · **Node 24 LTS**.

**[Chunk 7](05-the-ttl-index.md) covered the index and its timing guarantee. This
chunk is the two things that go wrong in practice. First, there are four distinct
ways to end up with a declaration that looks like a TTL index and expires nothing
— and all four are silent, because the failure mode is "the collection keeps
growing", which is indistinguishable from success. Second, the deleter is a
single-threaded background task with documented per-index budgets, which is why
turning a TTL index on over a large existing collection is an operation with a
plan rather than a line in a migration.**

## Four ways to expire nothing

**1 — A compound key pattern.**

> *"TTL indexes are single-field indexes. Compound indexes do not support TTL and
> ignore the `expireAfterSeconds` option."*

`createIndex({userId: 1, expiresAt: 1}, {expireAfterSeconds: 0})` **succeeds**.
You get an ordinary compound index and nothing ever expires. There is no error and
no warning. [Chapter 01·05](../01-modeling-the-store/04-what-stays-a-collection.md)
records the same trap from the modelling side; it is worth stating twice because
it is the one that reaches production.

**2 — The field does not hold a date.**

> *"If the indexed field in a document doesn't contain one or more date values,
> the document will not expire."*

A session whose `expiresAt` was written as an ISO **string** — a JSON round trip,
a fixture, a driver misconfiguration — is permanent. The TTL thread skips it, so
the collection develops a slowly growing population of immortal documents that
nothing reports.

**3 — The field is absent.**

> *"If a document does not contain the indexed field, the document will not
> expire."*

Same outcome, different cause. A document written by an older code path that
predates the field is immortal.

**4 — The index is on `_id`.** *"The `_id` field does not support TTL indexes."*
This one at least errors.

### The defence, which the Manual itself recommends

Cases 2 and 3 are exactly what schema validation is for, and the TTL page says so
explicitly: *"Even though TTL indexes do not require schema validation, using
validation can help ensure consistent behavior by standardizing the existence and
format of the date field used for expiration."*

For this app that means the `sessions` validator
([chapter 01·08](../01-modeling-the-store/06-constraints-that-vanish.md)) carries
`expiresAt` in `required` and constrains it to `bsonType: 'date'`:

```js
await db.command({collMod: 'sessions', validator: {$jsonSchema: {
  bsonType: 'object',
  required: ['tokenHash', 'expiresAt'],
  properties: {expiresAt: {bsonType: 'date'}},
}}});
```

That converts a silent immortality into a rejected write — which is the whole
argument for validators in a database with no column types, applied to the one
place where the consequence is a collection that never stops growing.

Case 1 has no such defence. There is nothing to validate; the index is simply not
what it looks like. The only protection is a test that inserts an already-expired
document, waits, and asserts it is gone — which needs a wait longer than the
sixty-second cycle and is therefore not a unit test.

## What the deleter is actually doing

The Manual documents the loop precisely, and it explains the shape of the delays:

> *"The TTL background deletion process checks each TTL index for expired
> documents. For each TTL index, the background process deletes documents until one
> of the following conditions is met: The process deletes 50000 documents from the
> current index. The process spends one second deleting documents from the current
> index. All expired documents are deleted from the current index."*

Then it moves to the next index; one trip through all TTL indexes is a **sub-pass**,
and a **pass** completes when every candidate has been deleted from every TTL
index. Both are counted in `serverStatus`, as `metrics.ttl.passes` and
`metrics.ttl.subPasses`, alongside `metrics.ttl.deletedDocuments`.

Two more sentences change how you plan around it:

> *"The TTL deletion process is a single-threaded background task, meaning that
> TTL deletions are not concurrent and may take longer under heavy workloads or
> when processing a large amount of expired documents."*

> *"the process stops the current deletion loop every 60 seconds to prevent
> spending too much time on a single large delete."*

So the throughput ceiling is roughly "50,000 documents or one second per index per
sub-pass", **shared across every TTL index in the deployment**, single-threaded.
One collection with a large backlog therefore delays expiry in every other TTL
collection — which is a coupling that does not exist between two independent cron
jobs.

And:

> *"The delete operations initiated by the TTL task run in the foreground, like
> other deletes."*

They are ordinary writes. They take the same locks, produce the same oplog
entries, and compete with application traffic. "Background thread" describes who
schedules them, not how they execute.

Since MongoDB 6.1 the deletes may be batched, and `explain` gained a
`BATCHED_DELETE` stage for them — useful when reading a plan and wondering what
is issuing deletes nobody wrote.

## Turning a TTL index on over a large collection

The Manual leads with a warning, which is unusual enough to quote in full:

> *"After you create a TTL index, it might have a very large number of qualifying
> documents to delete at once. This large workload might cause performance issues
> on the server. To avoid these issues, plan to create the index during off hours,
> or delete qualifying documents in batches before you create the index for future
> documents."*

For a fresh collection this never arises. For the migration from Phase 2 — where
`sessions` already holds months of rows and the sweep job is being retired — it
does: the moment the index finishes building, every already-expired session
becomes a deletion candidate, and the single-threaded deleter starts working
through them at its documented budget while serving live traffic.

The order that avoids it:

1. Delete the already-expired sessions in batches, with the old sweep job or a
   one-off script, until the backlog is small.
2. **Then** create the TTL index.
3. **Then** retire the sweep job.

Which is the same shape as any large data migration, and the reason to write it
down is that "add a TTL index" reads like a one-line change.

## Changing the TTL

This is the documented exception to
[chunk 3's](02b-what-the-list-leaves-out.md) "`createIndex` never updates an index
in place" rule:

```js
// migrations/mongo/013-shorten-session-ttl.js
export async function up(db) {
  await db.command({
    collMod: 'sessions',
    index: {keyPattern: {expiresAt: 1}, expireAfterSeconds: 0},
  });
}
```

`collMod` modifies the existing index rather than dropping and recreating it, so
there is no window without an index and no window without expiry. Since MongoDB
5.1 the same command also **converts a non-TTL single-field index into a TTL
index**, which is the only way to do it: *"If a non-TTL single-field index already
exists for a field, you cannot create a TTL index on the same field because you
cannot create indexes that have the same key specification and differ only by the
options."*

The Manual's caution about shortening a TTL is the same shape as the
create-over-a-large-collection one:

> *"reducing the `expireAfterSeconds` value can make many documents eligible for
> immediate deletion, potentially causing performance issues due to the increased
> delete operations."*

and it adds a consequence worth knowing: *"Deleting many documents can fragment
storage files, additionally impacting performance."*

## Gotchas

**★ A compound TTL index is silently not a TTL index.** `createIndex` accepts
`expireAfterSeconds` on a compound key pattern and ignores it. Nothing expires, no
error is raised, and the symptom is a collection that grows forever — which looks
like a traffic increase, not a bug.

**★ A non-date value in the indexed field means the document never expires.** A
session whose `expiresAt` is an ISO string rather than a `Date` is permanent, and
so is one missing the field entirely. The Manual's own recommendation is a schema
validator requiring the field and constraining it to `bsonType: 'date'`.

**★ `createIndex` cannot change `expireAfterSeconds`; `collMod` can.** Reaching
for the drop-and-recreate procedure here is unnecessary and worse: it opens a
window with no index and no expiry. `collMod` modifies in place — and is also the
only way to convert an existing non-TTL single-field index into a TTL one, because
two indexes differing only in options cannot coexist.

**★ The deleter is single-threaded across the whole deployment.** One collection
with a large backlog delays expiry in every other TTL collection, because they
share one background task with a per-index budget of 50,000 documents or one
second. Two independent cron jobs did not have that coupling.

**★ TTL deletes run in the foreground.** *"The delete operations initiated by the
TTL task run in the foreground, like other deletes."* They take locks, generate
oplog and compete with application writes. "Background" names the scheduler, not
the execution.

**★ Creating a TTL index over an existing large collection starts a large delete
immediately.** The Manual leads its own page with this warning. Drain the backlog
in batches *before* creating the index, not after, and prefer an off-peak window.

**★ Shortening a TTL has the same effect, plus storage fragmentation.** A large
one-off delete does not return space to the filesystem tidily; the Manual
mentions `compact` or an initial sync as the remedies, both of which are
operations rather than commands.

**★ The TTL monitor stops in standalone mode if `system.local.replset` has
data.** A niche case, and exactly the one you hit when someone restarts a former
replica set member as a standalone to poke at it — expiry silently stops for the
duration.

**★ Deleting a scheduled job moves its metrics somewhere the app does not look.**
Phase 2's sweep reported deletions into the app's health kit. The equivalents
exist — `metrics.ttl.deletedDocuments`, `metrics.ttl.passes`,
`metrics.ttl.subPasses` in `serverStatus` — but they are **server** metrics, so
the app's dashboards see them only if someone wires `serverStatus` in. The signal
did not disappear; the default path to it did.

## Interview questions

**★ Someone writes `createIndex({userId: 1, expiresAt: 1}, {expireAfterSeconds:
0})`. What happens?**
It succeeds, and nothing ever expires. TTL indexes are single-field only, and the
`expireAfterSeconds` option on a compound key pattern is ignored rather than
rejected. The symptom is a collection that grows without bound, which is
indistinguishable from ordinary growth until someone looks. The fix is a
single-field TTL index on `expiresAt`, plus a separate compound index if the
`userId` lookup is a real query.

**★ How do you change a TTL from fourteen days to seven on a live collection?**
`collMod`, naming the index's key pattern and the new `expireAfterSeconds`. It is
the one documented exception to the rule that index options cannot be changed in
place, and it avoids the window with no index that a drop-and-recreate would open.
The operational caveat is that shortening a TTL makes a large backlog immediately
eligible, so the Manual recommends deleting in small batches first — and warns that
a large one-off delete fragments storage, which then needs `compact` or an initial
sync to reclaim.

**★ A TTL collection is not expiring promptly and nothing is wrong with it.
Where do you look?**
At the other TTL indexes in the deployment. The deletion process is a single
background task shared by all of them, with a per-index budget of 50,000 documents
or one second before it moves on, and it stops the loop every sixty seconds. A
different collection with a large backlog therefore starves yours of the deleter's
attention. `metrics.ttl.passes` versus `metrics.ttl.subPasses` in `serverStatus`
tells you whether passes are completing or whether the deleter is perpetually
mid-pass.

**★ You are retiring Phase 2's sweep job and adding the TTL index. In what
order?**
Drain first, then index, then retire. The Manual warns that a newly created TTL
index may immediately have a very large number of qualifying documents, and the
deleter will work through that backlog in the foreground while serving live
traffic. So: use the existing sweep to delete the already-expired sessions in
batches until the backlog is small; create the index, ideally off-peak; verify
`metrics.ttl.deletedDocuments` is advancing; then remove the job. Doing it in the
other order turns a one-line change into a self-inflicted incident.

**★ What guards against a session document that never expires?**
A schema validator, which is what the Manual itself recommends on the TTL page:
require `expiresAt` and constrain it to `bsonType: 'date'`. That converts the two
silent cases — a string value, a missing field — into rejected writes. There is no
equivalent guard for the compound-index mistake, because the declaration is
syntactically valid and semantically empty; the only detection is an integration
test that inserts an expired document and asserts it is gone after a wait longer
than the sixty-second cycle.

---

← Prev: [The TTL index](05-the-ttl-index.md) ·
Next → [Multikey indexes](06-multikey-indexes.md)
