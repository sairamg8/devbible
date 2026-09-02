---
title: "No equivalent at all: ten foreign keys and one generated column, and what now holds them up"
sidebar_label: "9 · What has no equivalent"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **MongoDB Manual (8.0)** —
> [Data Modeling](https://www.mongodb.com/docs/manual/data-modeling/),
> [Embedding vs. References](https://www.mongodb.com/docs/manual/data-modeling/concepts/embedding-vs-references/),
> [`countDocuments`](https://www.mongodb.com/docs/manual/reference/method/db.collection.countDocuments/),
> [Transactions](https://www.mongodb.com/docs/manual/core/transactions/),
> [Text Indexes](https://www.mongodb.com/docs/manual/core/indexes/index-types/index-text/).
> Spine: **MongoDB 8.0** (8.2 minor) · driver **`mongodb` 7.5.0** · **Node 24 LTS**.

**There is no referential integrity in MongoDB. Not a weaker version, not one you
configure — none. The Postgres schema had ten foreign keys with four different
`ON DELETE` behaviours, and every one of them is gone. That sounds worse than it
is, and it is worse in exactly one place, so this chunk goes key by key: two
needed no replacement because the document model dissolved the dependency, seven
became explicit code in paths that already existed, and one — deleting a
category — now carries a race the constraint did not have. The generated
`tsvector` column is the eleventh casualty and is here for the same reason: what
it gave was not a value but an impossibility.**

## The ten keys

| Foreign key | What it prevented | What replaces it |
|---|---|---|
| `sessions.user_id → users` cascade | Orphan sessions; a deleted user still logged in | Explicit `deleteMany({userId})` in the user-deletion path |
| `carts.user_id → users` cascade | Orphan carts | Same deletion path |
| `carts.session_id → sessions` cascade | Guest cart outliving its session | A TTL-driven sweep, below |
| `products.category_id → categories` restrict | Deleting a category that has products | Count-then-refuse — **the one with the race** |
| `product_images.product_id` cascade | Orphan image rows | **Free** — embedded |
| `cart_items.product_id → products` cascade | Cart lines naming deleted products | Checkout treats a missing product as out of stock |
| `order_items.product_id` restrict | Losing order history to a product delete | **Unnecessary** — the order snapshots what it renders |
| `orders.user_id → users` restrict | Losing order history to a user delete | Soft delete of users, which the app already does |
| `reviews.product_id → products` cascade | Reviews for products that no longer exist | Fan-out delete, or filter them out on read |
| `reviews.order_id → orders` cascade | Reviews for orders that never existed | Server-side check in the review-creation path |

Two of the ten needed no replacement, because the document model removed the
*dependency* rather than the constraint —
[the images are inside the product](02-what-embeds.md) and
[the order snapshots its own line data](03-the-order-document.md). Those are the
good news rows, and they are the reason the invoice is survivable.

## The cascade, written out

`ON DELETE CASCADE` was one word in the DDL and is now a function with an
ordering decision in it:

```js
// db/mongo/users.js — what "delete a user" now means, explicitly
export async function deleteUser(db, userId) {
  // order matters: sessions first, so the user cannot act during the delete
  await db.collection('sessions').deleteMany({userId});
  await db.collection('carts').deleteMany({userId});
  await db.collection('reviews').deleteMany({userId});
  await db.collection('users').updateOne(
    {_id: userId},
    {$set: {deletedAt: new Date(), email: `deleted+${userId}@invalid`}},
  );
}
```

Three things the constraint used to decide, now decided here.

**Order.** Postgres cascaded in dependency order and the application never
thought about it. Here, deleting sessions *first* is a security property: any
other order leaves a window in which the user's token still resolves while their
carts and reviews are disappearing underneath them.

**Atomicity.** These are five writes across four collections and they are not
atomic. A crash halfway leaves a user with no sessions but an intact cart. That
is recoverable and mostly harmless, which is why this does not get a transaction;
if it did, it would be for the reason
[chapter 03](../03-checkout-with-transactions/README.md) gives, and it would inherit the
60-second lifetime limit for an operation that may touch thousands of reviews.
The safer construction is a background reconciliation that deletes children of
soft-deleted users, so a crash delays rather than corrupts.

**`orders` is missing from the list on purpose.** `on delete restrict` protected
order history, and the replacement is that the user row is *soft* deleted — the
email is scrambled so the unique index frees up for a re-registration, and the
orders keep pointing at a row that still exists. This is the same soft-delete
policy [Phase 1·11](../../phase-1-database/11-soft-delete-and-audit.md) argued
for; the difference is that Postgres would have *stopped* a hard delete and
MongoDB will happily perform one.

## The restrict, and its race

```js
// db/mongo/categories.js — the restrict, in code
export async function deleteCategory(db, categoryId) {
  const inUse = await db.collection('products')
    .countDocuments({'category._id': categoryId, deletedAt: null}, {limit: 1});
  if (inUse > 0) throw new ConflictError('category has products');
  await db.collection('categories').deleteOne({_id: categoryId});
}
```

`{limit: 1}` is the point of that count: the question is "any?", not "how many?",
and an unbounded `countDocuments` on a large catalog reads far more than the
answer needs.

**The check is not atomic with the delete.** A product can be created against the
category between the count and the `deleteOne`, leaving a product whose embedded
`category` names a document that no longer exists. The Postgres constraint had no
such window. The honest options, in order of cost:

1. **Accept it and detect it.** A scheduled job (Phase 2) lists products whose
   `category._id` has no matching category and reports them. Cheap, and the
   window is milliseconds on an admin-only action.
2. **Make the write side check too.** Product creation verifies the category
   exists — which does not close the race, it only makes both sides narrow.
3. **A transaction.** This *does* close it, at the cost of a replica-set session
   for an operation performed a few times a year. It is the correct answer if
   orphaned products would be user-visible; here they are not, because the
   catalog filters by `category.slug` and an orphan simply stops appearing under
   any category.

Option 1 is chosen. What matters is that the race is named: a port that claims
parity with a constraint it did not reproduce is a port that will be believed.

## Reviews of deleted products

`reviews.product_id → products on delete cascade` has the awkward property that
the fan-out is unbounded — a product with 40,000 reviews means a 40,000-document
delete. Two workable designs, and the choice is about *when* you pay:

```js
// A — fan out at delete time. Simple, and can be slow enough to time out.
await db.collection('reviews').deleteMany({productId});

// B — filter at read time, sweep in the background. The catalog already
//     soft-deletes products, so reviews of a soft-deleted product are
//     unreachable through the product page anyway.
await db.collection('products').updateOne(
  {_id: productId}, {$set: {deletedAt: new Date()}},
);
```

B is what this app does, and it falls out of the soft-delete policy rather than
being a separate decision — which is the general shape of the answer to "what
replaces cascade": **an app that soft-deletes rarely needs cascade, because
nothing is actually being removed.** Where a hard delete is genuinely required —
a GDPR erasure — the fan-out is unavoidable and belongs in a job with a batch
size, not in a request.

## The generated column

`search tsvector generated always as (…) stored` had a property no MongoDB
feature reproduces, and it is not the search quality — it is that **the search
data could not disagree with the source data, because it was derived from it by
the storage engine.** Drift was structurally impossible.

The MongoDB replacement is a text index over the source fields:

```js
await db.collection('products').createIndex(
  {name: 'text', description: 'text'},
  {weights: {name: 10, description: 1}, default_language: 'english'},
);
```

which is maintained by the server on every write and is therefore *equally*
consistent — the port is fine. What is lost is narrower and worth stating
precisely: Postgres stored the derived value as a **column**, so it could be
selected, inspected, and reasoned about (`select to_tsvector(...)` on a row shows
exactly what the index holds). A text index is not readable that way, so
diagnosing "why does this product not match this query" loses a tool.

The larger loss arrives if search ever moves to Atlas Search or an external
engine, at which point the derived data lives in a different system and the sync
problem — the one the generated column made impossible — comes back in full.
[Chapter 02](../02-the-catalog/README.md) makes that decision explicitly rather
than drifting into it.

## Gotchas

**★ Nothing stops a `productId` in a cart, order or review from naming a product
that does not exist.** Every read that joins on one must tolerate the miss.
Concretely: the checkout read
([03·02](../03-checkout-with-transactions/02-the-transaction.md)) treats a
missing product exactly as it treats zero stock, and the cart page renders the
line as unavailable rather than dereferencing `undefined.priceCents`. The
Postgres FK meant these branches were dead code; here they are the only defence.

**★ `deleteMany` is not atomic and reports partial progress.** The Manual is
explicit that a multi-document write is atomic per document and *"the operation
as a whole is not atomic"*. A `deleteMany` interrupted by a stepdown or a client
timeout has deleted some documents, and the returned `deletedCount` on error is
not something to reason from. Make delete paths re-runnable — every one in this
chunk is, because deleting an already-deleted document is a no-op.

**★ An unbounded `countDocuments` used as an existence check is a scan.** Without
`{limit: 1}` it counts every match, which on a large collection is exactly the
work you were trying to avoid asking for. This is the same class of mistake as
`select count(*)` where `exists` was meant, and it is easier to make here because
`countDocuments` reads like a cheap call.

**★ Do not emulate foreign keys with change streams.** It is technically
possible — watch `products`, delete the dependent reviews — and it produces a
system where referential integrity is *eventually* maintained by a process that
can be down, lagging, or resuming from an expired token
(**chapter 06** *(not written yet)*). A constraint that holds *usually*
is worse than no constraint, because code starts assuming it. If integrity must
hold, it holds in the write path or in a transaction; change streams are for
reactions, not invariants.

**★ Scrambling the email on soft delete is what frees the unique index.** Without
it, a user who deletes their account can never re-register with the same address,
because the unique index still holds their row. This was true in Postgres too and
is easy to forget when the delete becomes application code — there is no
constraint failing loudly to remind you at design time, only a support ticket
eighteen months later.

**★ The guest cart's cascade is the one with no owner at all.** `carts.session_id
→ sessions on delete cascade` relied on the session row disappearing. Sessions
are now removed by a
[TTL index](04-what-stays-a-collection.md), which is a background thread that
deletes documents and does *not* run application code — so nothing cascades to
the cart. A guest cart therefore outlives its session unless something sweeps it,
and the sweep is a scheduled job matching carts whose `sessionId` no longer
resolves. TTL removed one job and quietly created another; the net is still a win,
but it is not free.

## Interview questions

**★ Ten foreign keys, zero replacements available. Is that fatal?** No, and the
breakdown is what makes the answer honest. Two of the ten protected relationships
that the document model dissolved — the images are inside the product, the order
snapshots what it renders — so the constraint had nothing left to protect. Seven
moved into application paths that already existed and already did the check as
belt and braces; what changed is that the braces are now the only thing holding
it up, and a "quick admin script" that bypasses the application bypasses the
integrity too. One, the category delete, now has a race the constraint did not,
and the right move is to name it and detect it rather than claim parity.

**★ `ON DELETE CASCADE` was one word. What did writing it out force you to
decide?** Order, atomicity, and scope. Order, because deleting sessions before
carts is a security property and any other sequence leaves a window where the
user's token still works. Atomicity, because five writes across four collections
can be interrupted — and the answer here is to make the operation re-runnable
rather than transactional, since a transaction would inherit the 60-second
lifetime limit for an operation that might touch thousands of reviews. Scope,
because `orders` deliberately is *not* in the list: order history survives, which
is what `on delete restrict` used to guarantee and what soft-deleting the user
now guarantees instead.

**★ Why not use a transaction to make `deleteCategory` atomic and be done with
it?** Because it would work, and it would be the wrong reflex to build in. A
transaction requires a replica set, holds a session, is subject to the 60-second
runtime limit, and can have its callback re-executed on a transient error — real
machinery, justified when the invariant is user-visible and the operation is hot.
This one is an admin action performed a handful of times a year whose failure
mode is a product that stops appearing under any category filter. The rule worth
extracting: reach for a transaction when the *consequence* of the race is
unacceptable, not when the race exists.

**★ What did the generated `tsvector` column give that a text index does not?**
Two things, one of which does not matter. The one that does not: consistency —
the text index is maintained by the server on write, so it cannot drift either.
The one that does: **inspectability.** The `tsvector` was a column, so you could
select it and see exactly what the index held, which is how you answer "why does
this product not match this query". A text index has no such view. And the
strategic loss arrives if search moves out to a separate engine, where the
derived data leaves the database entirely and the sync problem the generated
column made structurally impossible comes back.

**★ Someone proposes maintaining referential integrity with change streams. Why
is that worse than nothing?** Because a constraint that holds *usually* is more
dangerous than one that does not exist. Code written against "usually" makes
assumptions — no null checks on the joined document, no handling of the orphan
branch — and those assumptions are false exactly when the stream is down, lagging
or resuming past an expired oplog window. An explicit application check is weaker
than a constraint but it is *honest* about being weak, so the surrounding code
stays defensive. Change streams are for reactions with an at-least-once story,
not for invariants.

**★ The TTL index deleted the session sweep job. What did it quietly create?**
A guest-cart sweep. `carts.session_id → sessions ON DELETE CASCADE` depended on
the session row's deletion running through the database's constraint machinery;
a TTL background thread deletes documents and triggers nothing. So guest carts
now outlive their sessions until something removes them. It is still a net win —
one job replaced by a simpler job — but it is the clearest small example of the
phase's general pattern: a feature that removes work usually moves some of it,
and the port is only correct if you go looking for where.

---

← Prev: [Constraints that vanish](06-constraints-that-vanish.md) ·
[Overview](README.md) ·
Next → [Denormalisation & staleness](07-denormalization-and-staleness.md)
