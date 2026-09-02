---
title: "The stock decrement needs no transaction: the guard in the filter is the lock"
sidebar_label: "1 · The stock decrement"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **MongoDB Manual (8.0)** —
> [Atomicity and Transactions](https://www.mongodb.com/docs/manual/core/write-operations-atomicity/)
> (*"write operations are atomic on the single-document level, even if modifying
> multiple values"*; *"To prevent conflicts during concurrent updates, include the
> expected current value in the update filter"*; a multi-document write *"as a
> whole is not atomic"* and *"other operations may interleave"*),
> [`$inc`](https://www.mongodb.com/docs/manual/reference/operator/update/inc/),
> [`findOneAndUpdate`](https://www.mongodb.com/docs/manual/reference/method/db.collection.findOneAndUpdate/),
> [Retryable Writes](https://www.mongodb.com/docs/manual/core/retryable-writes/).
> Concept home:
> [MongoDB 0·02 — single-document atomicity](../../../../mongodb/pages/phase-0-how-mongodb-runs/02-single-document-atomicity.md).
> Spine: **MongoDB 8.0** (8.2 minor) · driver **`mongodb` 7.5.0** · **Node 24 LTS**.

**[Phase 1's checkout](../../phase-1-database/06-the-checkout-transaction/01-the-transaction.md)
spent half its design budget on the stock race: `SELECT … FOR UPDATE` in
ascending product-id order, a `check (stock >= 0)` constraint behind it, a
deadlock-avoidance convention, and a retry loop for when the convention leaks.
On MongoDB, the stock decrement for one product needs none of that. It is a
single-document write with the expected value in the filter, and it is atomic by
construction. This chunk establishes that first, because the rest of the chapter
is about the things it does *not* solve — and starting from "we need a
transaction" would skip the most important lesson in the port.**

## What Postgres was buying

Four mechanisms, doing three different jobs:

| Mechanism | Job |
|---|---|
| `select … for update` | Serialise buyers of the same product |
| `order by product_id` | Prevent deadlock between overlapping carts |
| `check (stock >= 0)` | Make overselling impossible even if code forgets |
| The JS `stock < qty` check | Give the user a friendly error |

The first two exist entirely because Postgres's tool for "read a value and act on
it" is a pessimistic lock, and pessimistic locks acquired in different orders
deadlock.

## What MongoDB does instead

One write. The guard is in the filter:

```js
// db/mongo/products.js — claim stock for one product, atomically
export async function claimStock(db, {productId, qty, session}) {
  const res = await db.collection('products').updateOne(
    {_id: productId, deletedAt: null, stock: {$gte: qty}},   // ← the guard
    {$inc: {stock: -qty}},
    {session},
  );
  return res.matchedCount === 1;      // false = not enough stock, nothing changed
}
```

The Manual states the technique in general terms:

> *"To prevent conflicts during concurrent updates, include the expected current
> value in the update filter."*
> — [Atomicity and Transactions](https://www.mongodb.com/docs/manual/core/write-operations-atomicity/)

and the guarantee that makes it work:

> *"In MongoDB, write operations are atomic on the single-document level, even if
> modifying multiple values."*

**The filter and the update are evaluated as one operation on one document.**
There is no window between "stock is sufficient" and "stock is decremented" for
another writer to occupy — not a narrow window, none. Two buyers racing the last
unit both submit `{stock: {$gte: 1}}` with `{$inc: {stock: -1}}`; exactly one
matches, the other's `matchedCount` is 0, and the loser is told immediately.

Compare the two designs directly:

| | Postgres | MongoDB |
|---|---|---|
| Concurrency control | Pessimistic — the loser waits at the lock | Optimistic — the loser fails immediately |
| Deadlock possible | Yes, hence the ordering rule | **No** — no locks are held across statements |
| Enforcement of "never negative" | `check (stock >= 0)` | The `$gte` guard, with `minimum: 0` in the validator as a backstop |
| Lock ordering convention needed | Yes, and it must be observed by every future code path | **None** |
| Cost under contention on a hot product | A queue; latency grows | An immediate failure; the caller decides |

The third row deserves care. The `$jsonSchema` validator's `minimum: 0` on
`stock` does act as a backstop, because `validationLevel: 'strict'` applies
validation to updates as well as inserts — so an ungarded `$inc` that would drive
stock negative is rejected by the server, exactly as the `CHECK` constraint
rejected it. The guard gives the friendly answer; the validator makes the
invariant true. That is the same belt-and-braces split Phase 1 argued for, with
different braces.

## Where the deadlock rule went

It did not move. It ceased to exist for this operation.

Postgres's deadlock hazard came from *holding* locks on several rows while
waiting for another. `claimStock` holds nothing between calls: each write is
independent and complete. Two checkouts containing `{keyboard, desk}` and
`{desk, keyboard}` cannot deadlock, in either order, because neither is waiting
on the other's resource.

That is a genuine and underappreciated advantage of optimistic
compare-and-swap, and it comes with the matching disadvantage: **nothing is
serialised, so nothing is all-or-nothing.** A cart with two products becomes two
independent writes, and a crash between them leaves one product's stock claimed
and the other's not. That is precisely the gap
[chunk 2](02-the-transaction.md) fills, and it is worth naming now so the
transaction is introduced as the answer to a specific problem rather than as the
default posture.

## The compensating alternative, and why it loses

Before reaching for a transaction, the honest alternative is to keep the
per-document atomicity and compensate on failure:

```js
// the saga shape — correct, and worse here
const claimed = [];
for (const line of cart.items) {
  if (await claimStock(db, line)) claimed.push(line);
  else {
    for (const c of claimed) {                  // give it all back
      await db.collection('products').updateOne(
        {_id: c.productId}, {$inc: {stock: c.qty}},
      );
    }
    throw new OutOfStockError([line.productId]);
  }
}
```

This works, needs no replica set, and has no 60-second limit. It loses for one
reason: **the compensation itself can fail.** A crash between the failed claim
and the refund leaves stock permanently claimed by an order that never existed —
inventory that leaks a little on every failure, with no error anywhere and no way
to reconstruct what was owed. Making the compensation durable means recording the
intent somewhere first, which is a transaction with extra steps and a worse
failure surface.

The rule that decides it: **compensation is the right pattern when the systems
being coordinated genuinely cannot share a transaction** — the payment provider,
in this app's case, which is why
[Phase 3's checkout endpoint](../../phase-3-express-api/07-the-checkout-endpoint.md)
authorises before the database and releases after a failure. It is the wrong
pattern when they *can*, and five collections in one MongoDB deployment can.

## Retryable writes make the single write safe on its own

One more property the single-document form has for free:

> *"Retryable writes allow MongoDB drivers to automatically retry certain write
> operations a single time"* after network errors or a failover, and
> `updateOne` is on the retryable list. Retryable writes are enabled by default
> in drivers compatible with MongoDB 4.2 and later.
> — [Retryable Writes](https://www.mongodb.com/docs/manual/core/retryable-writes/)

So a `claimStock` whose response is lost to a network blip is retried by the
driver with exactly-once semantics for that write — the server recognises the
retry and does not apply the `$inc` twice. This is a guarantee that
`UPDATE products SET stock = stock - 1` never had over a `pg` connection, where a
lost response leaves the client genuinely unable to tell whether the decrement
happened.

The caveat that will matter in **chunk 3** *(not written yet)*:
**writes inside a transaction are not individually retryable.** The transaction as
a whole is retried instead, which is a different mechanism with different
consequences.

## Gotchas

**★ `matchedCount === 0` is the out-of-stock signal, and `modifiedCount` is
not.** A guard that fails matches nothing and modifies nothing, so both are zero
and either would appear to work — until someone claims a quantity of zero, which
matches the document and modifies nothing. Branch on `matchedCount`, and reject
`qty < 1` at the validation boundary so the degenerate case never arrives.

**★ `$inc` with a negative value and no guard will happily go negative — unless
the validator stops it.** Without `minimum: 0` in `$jsonSchema`, a stray
`$inc: {stock: -100}` produces `stock: -87` and nothing complains; the catalog
then shows the product as out of stock and the admin screen shows a negative
number. Postgres's `CHECK` made this impossible from day one; here it is
impossible only if the validator was written, which is why
[chapter 01 chunk 8](../01-modeling-the-store/06-constraints-that-vanish.md)
treats the validator as schema rather than as documentation.

**★ Reading the stock and then updating it is the bug this whole chunk exists to
prevent.** `const p = await findOne(...); if (p.stock >= qty) await updateOne(...)`
reintroduces the exact race Postgres needed `FOR UPDATE` for, in a database that
gave you the answer for free. It is written constantly, because it reads like the
business rule. The rule to internalise: **if a write depends on a value, that
value belongs in the write's filter.**

**★ `$inc` on a missing field creates it.** `{$inc: {stock: -1}}` on a document
with no `stock` field sets it to `-1` rather than failing. The guard
`{stock: {$gte: qty}}` prevents it here — a missing field does not satisfy
`$gte` — which is one more reason the guard is not optional even when the caller
"knows" the stock is sufficient.

**★ Restocking must not be a guarded write.** `claimStock` returns stock with
`{$inc: {stock: +qty}}` and *no* `$gte` condition, because there is no upper
bound to guard against. Copy-pasting the guarded form into a restock path
produces an update that silently does nothing when the filter does not match, and
the inventory quietly fails to come back.

**★ A hot product still serialises, just inside the storage engine.** Optimistic
concurrency does not make contention free: WiredTiger takes a document-level
write lock for the duration of the update, so a thousand concurrent buyers of one
product still queue — briefly, at storage-engine speed, without deadlock risk.
The difference from `FOR UPDATE` is that the lock is not held across statements
or across a network round trip, which is what made the Postgres queue long enough
to notice.

**★ Optimistic concurrency turns a waiting user into a failing user.** In
Postgres, the second buyer of the last-but-one unit *waited* and then succeeded.
Here they fail immediately with `matchedCount: 0` and the caller must decide
whether to retry. For stock that is the right behaviour — if there is no stock,
waiting will not create any — but the same pattern applied to a value that
another writer is about to *increase* produces spurious failures, and the fix
there is a bounded retry, not a pessimistic lock.

## Interview questions

**★ Phase 1 needed `SELECT … FOR UPDATE`, an ordering convention and a `CHECK`
constraint for the stock decrement. Why does MongoDB need none of them?** Because
the operation is a single-document write, and MongoDB guarantees single-document
writes are atomic including their filter. Putting the condition in the filter
(`stock: {$gte: qty}`) makes the read and the write one indivisible operation, so
there is no window to lock against. No locks are held across statements, so no
deadlock is possible and no ordering convention is needed. The `CHECK` constraint's
job — making the invariant true regardless of code — is done by `minimum: 0` in
the collection's validator, which applies to updates under `validationLevel:
'strict'`.

**★ What did the app lose by moving from pessimistic to optimistic concurrency?**
Waiting. In Postgres, a buyer who arrived second on a product that still had
stock *queued* behind the first and then succeeded. Here they fail immediately
and the caller decides whether to retry. For stock this is the right shape —
losing a race for the last unit means there is nothing to wait for — but for any
value another writer is about to increase, optimistic failure is spurious and the
caller must retry. The general trade: pessimistic locking converts contention
into latency, optimistic control converts it into failures, and which you want
depends on whether waiting can change the answer.

**★ Why not use compensation for the whole checkout and avoid transactions
entirely?** Because the compensation can fail. A crash between a failed claim and
the refund of the already-claimed products leaks inventory permanently, with no
error and no record of what was owed. Making the compensation durable means
writing the intent down before acting — which is a transaction with more moving
parts and a worse failure surface. Compensation is the right pattern when the
coordinated systems genuinely cannot share a transaction, which is exactly the
case for the payment provider and exactly not the case for five collections in
one deployment.

**★ The response to a `claimStock` call is lost to a network error. What
happened to the stock?** Exactly one decrement, or none — the driver retries the
write once by default, and the server's retryable-write machinery recognises the
retry so the `$inc` is not applied twice. That is a stronger guarantee than the
`pg` equivalent, where a lost response after `UPDATE products SET stock = stock -
1` leaves the client genuinely unable to distinguish success from failure. The
caveat that matters later: writes *inside* a transaction are not individually
retryable; the transaction as a whole is retried instead.

**★ What is the single sentence to take from this chunk into every other write in
the app?** If a write depends on a value, that value belongs in the write's
filter. Every safe write in this port is an instance of it — the cart's guarded
`$push`, the review approval's `status: 'pending'`, the outbox lease's expiry
comparison, and this stock guard. The unsafe version is always the same shape:
read the value into JavaScript, decide, then write — which is a race in every
database and merely more obviously so in one without row locks.

---

← **Overview** *(not written yet)* ·
Next → [The transaction](02-the-transaction.md)
