---
title: "What stays a collection: unbounded growth, cross-parent reads, and the sweep job that disappeared"
sidebar_label: "5 · What stays a collection"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **MongoDB Manual (8.0)** —
> [Embedding vs. References](https://www.mongodb.com/docs/manual/data-modeling/concepts/embedding-vs-references/)
> (reference when *"your embedded data grows without bounds"*, when *"the child
> side of the relationship has high cardinality"*, when data *"is written at
> different rates"*),
> [TTL Indexes](https://www.mongodb.com/docs/manual/core/index-ttl/),
> [Limits and Thresholds](https://www.mongodb.com/docs/manual/reference/limits/).
> Spine: **MongoDB 8.0** (8.2 minor) · driver **`mongodb` 7.5.0** · **Node 24 LTS**.

**Five tables stay collections, and each fails the embed test for a different
reason worth naming individually. `reviews` grows without bound and is read
across parents. `sessions` is high-cardinality per user and expires
independently — and it is the one place the document model is unambiguously
better than the relational original, because a TTL index deletes an entire
scheduled job. `outbox` is a queue whose documents leave. `categories` is small
but referenced everywhere, and it is the row people most often get wrong in both
directions. `users` and `products` are the roots everything else points at.**

## `reviews` — the one everyone tries to embed

Reviews look like the definitive "part of a product". They are not, and the
Manual disqualifies them twice over.

**Unbounded growth.** Reference when *"your embedded data grows without bounds"*.
A product accumulates reviews for as long as it sells; there is no natural
ceiling, and the ceiling that does exist — 16 MiB per document — is reached as a
hard write failure with no warning. A 400-byte review body plus metadata puts
that somewhere near forty thousand reviews, which a genuinely popular product on
a long-lived store can reach. "Unlikely" is not a design.

**The access pattern runs across parents.** The admin moderation queue is *"all
reviews with `status: 'pending'`, oldest first"* — a query with no product in it
at all. Embedded, that becomes a scan of every product document plus `$unwind`
plus `$match`, which cannot use an index on the review status in any useful way
and gets slower as the catalog grows rather than as the queue grows. As a
collection it is a partial index on one field, which
**chapter 05** *(not written yet)* builds.

**Independent write rates.** Reference when data *"is written at different
rates"*. Product documents are written when an admin edits a product — rarely.
Review documents are written by customers — constantly, and by a completely
different code path. Embedding would make every review submission rewrite a
product document that the catalog is reading thousands of times an hour.

The reviews document, then, with its own bounded embed:

```js
// reviews
{
  _id: ObjectId("..."),
  productId: ObjectId("..."),
  userId: ObjectId("..."),
  orderId: ObjectId("..."),            // the verified-purchase proof
  rating: 4,
  body: "…",
  status: "pending",                   // pending|approved|rejected
  images: [{objectKey: "…"}],          // capped at 3 by the validator
  createdAt: ISODate("..."),
}
```

What the product page then needs is *two* reads instead of one — the product,
and its approved reviews — and that is the honest cost of the decision. It is
paid back at [chunk 10](07-denormalization-and-staleness.md), where the rating
average and review count are denormalised onto the product so the *catalog grid*
(the far hotter read) needs no review access at all.

## `sessions` — where the document model actually wins

The Postgres design had `sessions.expires_at`, an index on it, and a scheduled
job in [Phase 2](../../phase-2-node-services/05-scheduled-jobs.md) sweeping
expired rows. All three collapse into one index:

```js
await db.collection('sessions').createIndex(
  {expiresAt: 1}, {expireAfterSeconds: 0},
);
```

> *"'Time-to-live' (TTL) indexes are special single-field indexes that MongoDB
> can use to automatically remove documents from a collection after a certain
> amount of time or at a specific clock time."*
> — [TTL Indexes](https://www.mongodb.com/docs/manual/core/index-ttl/)

`expireAfterSeconds: 0` with an absolute date in the field is the "at a specific
clock time" form: the document is removed once `expiresAt` is in the past. The
sweep job, its schedule, its locking, its metrics and its failure mode all cease
to exist.

Three properties of the mechanism decide how the app must treat it, and all
three are documented:

- *"A background thread in `mongod` reads the values in the index and removes
  expired documents from the collection."* — it is server-side, so it keeps
  running when the app is down.
- *"The background task that removes expired documents runs every 60 seconds."*
- *"The TTL index does not guarantee that expired data is deleted immediately
  upon expiration. There may be a delay between the time that a document expires
  and the time that MongoDB removes the document from the database."*

That last one is why **the auth check still compares `expiresAt` to now**. TTL is
storage reclamation, not authorisation. A session document can outlive its expiry
by a minute or more, and a lookup that only checks for the document's existence
would extend every session by up to the sweep interval. The query is
`findOne({tokenHash, expiresAt: {$gt: new Date()}})` — same predicate the
Postgres version used, for the same reason.

The mechanism is also single-field only: *"TTL indexes are single-field indexes.
Compound indexes do not support TTL and ignore the `expireAfterSeconds`
option."* Silently ignore, which is the dangerous word.

## `outbox` — a queue, and the pattern is unchanged

```js
// outbox
{_id: ObjectId("..."), topic: "order.confirmed", payload: {...},
 createdAt: ISODate("..."), processedAt: null, attempts: 0}
```

Embedding a queue in the documents that enqueue to it is a category error: the
consumer's query is "all due work across all producers", which is the
cross-parent pattern again, and rows leave the queue on a schedule that has
nothing to do with the order's lifecycle.

What changes from Postgres is the *claiming* mechanism, not the model.
`select … for update skip locked` has no MongoDB equivalent — there are no row
locks to skip. The idiomatic claim is an atomic find-and-modify, which
single-document atomicity makes exactly as safe:

```js
// worker/outbox.js — claim one job atomically; N workers never collide
export const claimJob = (db, {leaseMs = 30_000}) =>
  db.collection('outbox').findOneAndUpdate(
    {processedAt: null, $or: [
      {leasedUntil: {$exists: false}}, {leasedUntil: {$lt: new Date()}},
    ]},
    {$set: {leasedUntil: new Date(Date.now() + leaseMs)}, $inc: {attempts: 1}},
    {sort: {createdAt: 1}, returnDocument: 'after'},
  );
```

Two workers running this concurrently cannot get the same document: the update
is atomic on one document, and the loser's filter no longer matches because
`leasedUntil` is now in the future. Note the difference in *semantics* from
`skip locked`, and it is not cosmetic: a Postgres lock is released by the
transaction ending, including a crash, whereas a lease is released by the clock.
A worker that dies mid-send leaves the job invisible until `leaseMs` elapses —
lease duration is now a tuning decision that did not exist before, and setting it
too long delays recovery while setting it too short lets two workers send the
same email. The relay itself is
[Phase 2's](../../phase-2-node-services/04-outbox-relay-and-email.md), unchanged
in shape.

## `categories` — small, referenced everywhere, and easy to get wrong twice

The spec fixes a one-level tree, so the whole collection is a few dozen tiny
documents. Two tempting wrong answers:

**Wrong answer one: embed the products into the category.** The category becomes
an unbounded array of the entire catalog. This is the *"one-to-squillions"* case
([MongoDB 3·05](../../../../mongodb/pages/phase-3-schema-design/05-one-to-squillions.md))
and it is the same 16 MiB failure as reviews, arriving faster.

**Wrong answer two: model the tree as nested subdocuments.** A one-level tree
does not need it, and a general tree modelled by nesting hits the *"100 levels of
nesting"* limit and, long before that, the impossibility of querying "all
descendants" without knowing the depth. The Manual's tree patterns exist for
this; this app needs none of them, because `parentId` on a one-level tree is
already the answer.

The right answer is a small collection plus an
[extended reference](../../../../mongodb/pages/phase-3-schema-design/06-extended-reference.md)
copied onto each product — `{_id, slug, name}` — so the catalog query filters by
`category.slug` without touching this collection at all.
[Chunk 8](07-denormalization-and-staleness.md) owns that copy and its
maintenance.

## `users` and `products` — the roots

Neither is interesting and both should be stated. `users` is referenced from
sessions, carts, orders and reviews, has its own write rate and grows forever:
a collection, obviously. `products` is the unit of query for the entire
storefront, referenced from carts, orders and reviews: a collection, obviously.
The rule about roots is that *nothing embeds a root*, and the corollary is that
every embed decision in this model was about a child, which is why the map came
out at eight.

## Gotchas

**★ A TTL index on a field that is not a BSON date does nothing, silently.**
The Manual requires the indexed field be *"either a date type or an array that
contains date type values"*. Store `expiresAt` as an ISO *string* — which is
exactly what arrives if a session is written from a JSON payload without
parsing — and the index builds successfully, reports as present, and never
deletes anything. Sessions accumulate for months before anyone notices, and the
first symptom is disk, not auth.

**★ TTL on a compound index is ignored, not rejected.**
`createIndex({userId: 1, expiresAt: 1}, {expireAfterSeconds: 0})` succeeds and
expires nothing. The Manual says compound indexes *"ignore the
`expireAfterSeconds` option"*. This is the same failure as the previous gotcha
with a different cause and identical symptoms, which is why the sessions index
list in **chapter 05** *(not written yet)* keeps the TTL index
separate from the lookup index by design and says so in a comment.

**★ Relying on TTL for authorisation extends every session by up to a minute.**
The 60-second sweep is documented; a check of the form "does the session
document exist" therefore honours expiry only approximately. The predicate goes
in the query. This is the kind of bug that never appears in testing because a
minute of extra session life is invisible unless you are looking for it.

**★ The outbox lease is a clock, not a lock.** A crashed worker's Postgres row
lock vanished the instant its connection dropped; a crashed worker's Mongo lease
persists until it expires. If jobs must resume within seconds of a worker dying,
the lease has to be short and renewed by a heartbeat — which is real machinery
the Postgres version did not need. State the recovery-time requirement before
picking `leaseMs`; do not inherit 30 seconds from an example.

**★ Deleting a category leaves every product's embedded copy pointing at
nothing.** `on delete restrict` protected this in Postgres and there is no
equivalent. The admin delete path must count products in the category first and
refuse — an application check where a constraint used to be, listed with the
others in [chunk 8](06-constraints-that-vanish.md). The failure mode without it
is a catalog filter that returns products for a category the UI no longer knows
how to name.

**★ "It fits today" is not a bound.** Reviews on a new store, images on a new
product, jobs in a new outbox all fit comfortably in a parent document at
launch. The embed test asks whether growth is *bounded by something real* — a
spec rule, a human's patience, a physical constraint — not whether the current
data is small. The three tables embedded in this model each have such a bound;
the five that stayed collections have none.

## Interview questions

**★ Reviews are obviously "part of" a product. Give three independent reasons
they are not embedded.** Unbounded growth, with a hard 16 MiB wall reached as a
write failure rather than a warning. A primary access pattern that runs *across*
products — the moderation queue is "all pending reviews", which embedded becomes
a full catalog scan plus `$unwind` that degrades with catalog size instead of
queue size. And divergent write rates: products are written by admins rarely,
reviews by customers constantly, so embedding puts a high-frequency write into
the document that the hottest read in the app is fetching. Any one of these is
disqualifying; the Manual names all three as reference conditions.

**★ What did the TTL index on `sessions` actually replace, and what did it not
replace?** It replaced an entire scheduled job: the sweep query, its cron
schedule, its advisory-lock-or-leader-election so two API instances do not both
run it, its error handling and its metrics. It runs server-side, so it keeps
working while the application is down. It did *not* replace the expiry check in
the auth path, because deletion is documented as delayed — the sweep runs every
60 seconds and the Manual explicitly disclaims immediacy. TTL is storage
reclamation; authorisation still compares `expiresAt` to now on every request.

**★ `SELECT … FOR UPDATE SKIP LOCKED` has no MongoDB equivalent. How do two
workers avoid claiming the same job, and what did the substitution cost?** An
atomic `findOneAndUpdate` that stamps a lease into the document as part of the
same operation that selects it: the write is atomic on one document, so the
second worker's filter no longer matches and it moves to the next job. The cost
is that a lock and a lease fail differently. A Postgres lock is released by the
connection dying, so a crashed worker's job is instantly available again; a lease
is released by wall-clock time, so a crashed worker's job is invisible for the
remainder of the lease. Recovery latency becomes a tuning parameter, and if it
must be short, a heartbeat that renews the lease is new machinery the relational
version never needed.

**★ Why not embed products in categories, given there are only a few dozen
categories and the catalog page is "products in a category"?** Because the child
side has enormous cardinality and no bound — this is the one-to-squillions shape,
and a category document would grow to hold the whole catalog and hit 16 MiB. It
also destroys the query the app actually runs most: the catalog is filtered by
price and sorted by price or recency *within* a category, and an embedded array
cannot be indexed, filtered and sorted the way a collection can. The right shape
is the inverse — the small, stable category data copied *onto* each product — so
the hot query touches one collection.

**★ Which of these five would you reconsider first if the app changed?**
`categories`, and the trigger is depth. The one-level rule is what makes
`parentId` sufficient; the moment the business wants arbitrary nesting, the
question reopens as a choice between the Manual's tree patterns — parent
references, child references, an array of ancestors, or a materialised path —
each with a different cost for "all descendants" versus "the breadcrumb". None
of them is nesting subdocuments, and all of them are a real design exercise the
current spec lets us skip.

{/* FOOTER */}
