---
title: "The cart document: what ON CONFLICT cost when it became two writes and a loop"
sidebar_label: "3 · The cart document"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **MongoDB Manual (8.0)** —
> [Atomicity and Transactions](https://www.mongodb.com/docs/manual/core/write-operations-atomicity/)
> (*"To prevent conflicts during concurrent updates, include the expected current
> value in the update filter"*),
> [positional `$`](https://www.mongodb.com/docs/manual/reference/operator/update/positional/),
> [`$push`](https://www.mongodb.com/docs/manual/reference/operator/update/push/),
> [`$pull`](https://www.mongodb.com/docs/manual/reference/operator/update/pull/),
> [Partial Indexes](https://www.mongodb.com/docs/manual/core/index-partial/).
> Spine: **MongoDB 8.0** (8.2 minor) · driver **`mongodb` 7.5.0** · **Node 24 LTS**.

**`cart_items` was the one table in the Postgres schema whose entire purpose was
a composite unique key: `primary key (cart_id, product_id)` is what made "add to
cart again" a single safe `INSERT … ON CONFLICT DO UPDATE`. Embedded as an
array, that key does not exist, and there is no single statement that says
"increment this element or create it". The correct implementation is two writes
and a bounded retry loop — and the guard on the second write is the difference
between correct and works-on-my-laptop.**

## The document

```js
// carts
{
  _id: ObjectId("..."),
  sessionId: ObjectId("...") | null,     // exactly one of these two is set
  userId:    ObjectId("...") | null,
  items: [
    {productId: ObjectId("..."), qty: 2},
    {productId: ObjectId("..."), qty: 1},
  ],
  createdAt: ISODate("..."), updatedAt: ISODate("..."),
}
```

Two Postgres constraints came with this table and only one survives cheaply.

**"Exactly one owner"** was `check (num_nonnulls(session_id, user_id) = 1)`. It
becomes a `$jsonSchema` clause ([chunk 8](06-constraints-that-vanish.md)) —
awkward to express, because JSON Schema has no "exactly one of these is
non-null", so it is spelled as a `oneOf` over two required-field shapes.

**"One live cart per owner"** was two partial unique indexes. It survives
*exactly*, because MongoDB has partial unique indexes with the same semantics —
the Manual: when you specify both `partialFilterExpression` and a unique
constraint, *"the unique constraint only applies to documents that meet the
filter expression"*.

```js
await db.collection('carts').createIndex(
  {userId: 1}, {unique: true, partialFilterExpression: {userId: {$type: 'objectId'}}},
);
await db.collection('carts').createIndex(
  {sessionId: 1}, {unique: true, partialFilterExpression: {sessionId: {$type: 'objectId'}}},
);
```

`$type` rather than `$exists: true` is deliberate: a document with
`userId: null` *has* the field, so `$exists` would index every guest cart under
the key `null` and the second guest cart would collide. `$type: 'objectId'`
indexes only the carts that genuinely have an owner of that kind. Both operators
are on the Manual's allowed list for `partialFilterExpression`; only one of them
means what you want.

## Add to cart, in Postgres and here

The Postgres statement was one line and unconditionally safe:

```sql
insert into cart_items (cart_id, product_id, quantity) values ($1, $2, $3)
on conflict (cart_id, product_id)
do update set quantity = cart_items.quantity + excluded.quantity;
```

There is no array equivalent. `$push` always appends and cannot test for
absence in the same breath as the update it performs on a *matched* element;
the positional `$` operator can only update an element the filter already
matched. So the operation is two writes, ordered so that the common case (the
line exists) is the first one:

```js
// db/mongo/carts.js — add-or-increment a cart line
export async function addItem(db, {cartId, productId, qty}) {
  const carts = db.collection('carts');

  for (let attempt = 0; attempt < 3; attempt++) {
    // 1 — the line exists: bump it. One document, one atomic update.
    const bumped = await carts.updateOne(
      {_id: cartId, 'items.productId': productId},
      {$inc: {'items.$.qty': qty}, $currentDate: {updatedAt: true}},
    );
    if (bumped.matchedCount === 1) return;

    // 2 — the line does not exist: push it, but ONLY if it still does not.
    //     A concurrent add that won the race makes this match zero documents,
    //     so the loop goes back to step 1 and increments instead.
    const pushed = await carts.updateOne(
      {_id: cartId, 'items.productId': {$ne: productId}},
      {$push: {items: {productId, qty}}, $currentDate: {updatedAt: true}},
    );
    if (pushed.matchedCount === 1) return;
  }
  throw new Error('cart contention: add failed after 3 attempts');
}
```

Read the guard on step 2 carefully, because it carries the correctness. Without
`{$ne: productId}`, two simultaneous adds of the same product both observe "no
line", both `$push`, and the cart ends with **two lines for one product** — the
duplicate the Postgres primary key made impossible, now sitting there silently
inflating the checkout total. With the guard, the loser's filter no longer
matches, it pushes nothing, and the retry finds the line and increments it.

The loop terminates because each iteration either wins or observes someone
else's win; there is no state in which both branches can fail indefinitely
against a live cart. Three attempts is generous for a two-state race — the only
way to exhaust it is a cart being hammered by more than two concurrent writers,
which for a single shopper's session means something upstream is wrong and an
error is the right outcome.

## The rest of the cart, which is all single writes

```js
export const setQty = (db, {cartId, productId, qty}) =>
  db.collection('carts').updateOne(
    {_id: cartId, 'items.productId': productId},
    {$set: {'items.$.qty': qty}, $currentDate: {updatedAt: true}},
  );

export const removeItem = (db, {cartId, productId}) =>
  db.collection('carts').updateOne(
    {_id: cartId},
    {$pull: {items: {productId}}, $currentDate: {updatedAt: true}},
  );

export const clearCart = (db, cartId) =>
  db.collection('carts').updateOne(
    {_id: cartId},
    {$set: {items: []}, $currentDate: {updatedAt: true}},
  );
```

This is where the embed pays. In Postgres, "empty the cart" was
`delete from cart_items where cart_id = $1` — a multi-row delete whose atomicity
came from the surrounding transaction. Here it is one atomic write on one
document, which is why the
**checkout transaction** *(not written yet)*
has one fewer thing to worry about: clearing the cart cannot half-happen.

## Merge on login

The spec is explicit that a guest cart **merges** into the account cart rather
than replacing it. Two documents are involved, so this is the first operation in
the app that spans documents, and it is worth being precise about why it still
does not get a transaction.

```js
export async function mergeCarts(db, {fromCartId, intoCartId}) {
  const guest = await db.collection('carts').findOne({_id: fromCartId});
  if (!guest) return;
  for (const line of guest.items) {
    await addItem(db, {cartId: intoCartId, ...line});
    // remove as we go: a crash mid-merge leaves a source that is safe to re-run
    await db.collection('carts').updateOne(
      {_id: fromCartId}, {$pull: {items: {productId: line.productId}}},
    );
  }
  await db.collection('carts').deleteOne({_id: fromCartId});
}
```

The `$pull`-as-you-go is the whole design. Without it, a crash after three of
five lines have merged means a retry re-adds those three and the shopper's
quantities double. With it, a retry sees a source cart holding only the
unmerged remainder and does exactly the right thing. **Idempotence, not
atomicity, is what this operation actually needed** — and idempotence is cheaper,
survives more failure modes, and needs no replica set.

## Gotchas

**★ The positional `$` operator updates only the *first* matching element.**
`{'items.$.qty': …}` is exactly right when the array is set-like, and exactly
wrong the moment duplicates exist — it will increment one of two duplicate lines
forever while the other sits there unchanged, which is why a duplicate bug
presents as "the quantity is wrong" rather than "there are two lines".
Duplicates and `$` are a matched pair: prevent the first and the second cannot
happen. If an array genuinely can hold multiple matches, the operator is
`$[<identifier>]` with `arrayFilters`, not `$`.

**★ `matchedCount` is the signal, not `modifiedCount`.** Setting a cart line to
the quantity it already has matches one document and modifies zero. Branching on
`modifiedCount === 0` turns a successful no-op into a spurious "not found" — and
the bug only appears when a user re-submits the same quantity, which is exactly
what a double-clicked stepper does. `matchedCount` answers "did the filter find
it"; `modifiedCount` answers "did anything change". Know which you are asking.

**★ `$exists: true` in a partial unique index over a nullable field indexes the
nulls.** A guest cart has `userId: null`, which *exists*. Build the index with
`$exists` and the second guest cart fails with a duplicate key error on `null` —
an outage that only starts when the second anonymous visitor arrives, so it
passes every single-user test. `$type: 'objectId'` is the operator that means
what the Postgres `where user_id is not null` meant.

**★ `$pull` on a field the document does not have succeeds and reports
`modifiedCount: 0`.** Removing an item from a cart that never held it is not an
error at any layer, so a client bug that removes the wrong product id looks
identical to a successful removal. The
[cart endpoints](../../phase-3-express-api/06-cart-endpoints.md) already return
the whole cart after mutation, which is what makes this survivable — the client
reconciles against the returned state rather than trusting a status code.

**★ The retry loop hides a real failure if you widen it.** Raising `attempts`
to 20 to "make the flakiness stop" converts a contention signal into latency.
Three attempts failing means something is generating concurrent writes to one
cart — a client retrying an in-flight request, or a double-submitted form — and
the diagnosis belongs upstream. A retry bound is a detector as much as a
mitigation.

**★ Nothing stops `items` holding a `productId` that no longer exists.** The
foreign key is gone. The cart read path must therefore tolerate a missing
product rather than assume the lookup returns one line per item; the
**checkout read** *(not written yet)* treats a
missing product exactly as it treats zero stock, and the cart page renders the
line as unavailable rather than crashing on `undefined.priceCents`.

## Interview questions

**★ Add-to-cart was one `INSERT … ON CONFLICT` in Postgres. Why is it two
statements and a loop here, and is the loop actually necessary?** `ON CONFLICT`
is an upsert against a *unique index*, and there is no unique index inside an
array — the uniqueness of `(cart, product)` used to be enforced by the storage
engine and now has to be enforced by the write. `$push` cannot say "only if
absent" while also updating a matched element, and `$` cannot say "or create".
So: try the increment; if it matched nothing, push under a negative guard. The
loop *is* necessary, because the guarded push can lose the race — the guard
correctly stops it creating a duplicate, which means it matches zero documents,
and without a retry the caller would silently drop the item. The loop converts
"I lost the race" into "then increment what the winner created".

**★ Why does `mergeCarts` not get a transaction?** Because the failure it must
survive is a crash-and-retry, not an interleaving, and a transaction gives
atomicity without giving idempotence. Re-running a transactional merge after a
successful-but-unacknowledged commit doubles the quantities just as surely as
re-running a non-transactional one. The `$pull`-as-you-go version is safe under
both: a re-run sees the merged lines already gone from the source. A transaction
would cost a replica-set session, the 60-second transaction lifetime limit, and
the possibility of the callback body running more than once
(**03·03** *(not written yet)*),
in exchange for an atomicity nobody in the UI can observe.

**★ Two partial unique indexes replaced two partial unique indexes — so what
was actually lost on the cart?** Only the `CHECK` constraint. `carts_one_per_user`
and `carts_one_per_session` port across with identical semantics, because
MongoDB's `unique` + `partialFilterExpression` is the same feature. What does not
port is `check (num_nonnulls(session_id, user_id) = 1)`: JSON Schema cannot say
"exactly one of these two", so it is expressed as a `oneOf` of two shapes, which
is more verbose, harder to read, and — critically — only enforced at the
validation level the collection is configured with. The invariant survives; its
legibility does not.

**★ A shopper reports their cart total is double what it should be, and the cart
page shows the right products. Where do you look first?** Duplicate array
elements. The page renders each line and the total sums them, so two lines for
the same product at qty 1 each look like one product at qty 1 with a doubled
total, depending on how the UI groups. The cause is an unguarded `$push`
somewhere — an admin tool, a seed script, a "quick fix" endpoint — because the
guarded path cannot produce it. The confirming query is an aggregation grouping
`items.productId` per cart and matching counts greater than one; the repair is a
one-off `$group`-and-rewrite, and the real fix is auditing every `$push` in the
codebase for its negative filter.

**★ Would a `Map`-shaped `items` object keyed by product id be better than an
array?** It makes add-to-cart a genuine single atomic statement —
`{$inc: {['items.' + productId + '.qty']: qty}}` creates the key if absent — which
is a real advantage, and it is a documented modelling pattern. The cost is that
you cannot index the values: MongoDB indexes field *paths*, and dynamic keys
produce an unbounded set of paths, so any query like "which carts contain product
X" becomes a collection scan. For this app that query does not exist on carts, so
the object form is defensible; it is rejected here because it also breaks the
`$jsonSchema` validator (dynamic keys cannot be described) and makes the cart
document shape untypeable in [Phase 6](../../phase-6-typescript/README.md). The
loop is the cheaper price.

---

← Prev: [What embeds](02-what-embeds.md) ·
[Overview](README.md) ·
Next → [The order document](03-the-order-document.md)
