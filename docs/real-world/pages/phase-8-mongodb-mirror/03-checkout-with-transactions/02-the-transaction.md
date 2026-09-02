---
title: "The transaction: order, stock, cart and outbox stand or fall together, and the unique index is still the replay guard"
sidebar_label: "2 · The transaction"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-02 against the **MongoDB Manual (8.0)** —
> [Transactions](https://www.mongodb.com/docs/manual/core/transactions/)
> (*"Transactions either apply all data changes or roll back the changes"*;
> *"Until a transaction commits, the data changes made in the transaction are
> not visible outside the transaction"*),
> [Drivers API](https://www.mongodb.com/docs/manual/core/transactions-in-applications/)
> (*"each operation in the transaction must pass the session to each operation"*),
> [Production Considerations](https://www.mongodb.com/docs/manual/core/transactions-production-consideration/)
> (write conflicts, stale reads),
> [Transactions and Operations](https://www.mongodb.com/docs/manual/core/transactions-operations/);
> the **Node driver** —
> [Transactions](https://www.mongodb.com/docs/drivers/node/current/crud/transactions/)
> and the `withTransaction` JSDoc in
> [`src/sessions.ts`](https://github.com/mongodb/node-mongodb-native/blob/main/src/sessions.ts).
> `mongodb` is **not** installed in this repo's `node_modules`, so the driver
> claims are from its published docs and source, not a local declaration file.
> Spine: **MongoDB 8.0** (8.2 minor) · driver **`mongodb` 7.5.0** · **Node 24 LTS**.

**[Chunk 1](01-the-stock-decrement.md) ended on the gap: each stock claim is
atomic, and a cart with two products is two claims, so a crash between them
leaves one product's stock taken by an order that does not exist. The
transaction closes that gap and nothing else. It makes the order insert, every
claim, the cart clear and the two outbox documents one all-or-nothing unit —
the same five changes
[Phase 1's transaction](../../phase-1-database/06-the-checkout-transaction/01-the-transaction.md)
made, over four collections instead of five tables, because `order_items` is now
inside the order. What did *not* change is more instructive than what did: the
replay guard is still a unique index, the order is still inserted first, and
the stock guard from chunk 1 is still in the filter — inside a transaction it is
what turns a write conflict into a correct answer.**

## The five changes, and where the fifth table went

| Phase 1 step | Table | Here | Collection |
|---|---|---|---|
| Insert the order, keyed by idempotency key | `orders` | Insert the order document, `idempotencyKey` unique | `orders` |
| Lock and read the cart's products | `cart_items ⋈ products` | Read the cart, read its products from the snapshot | `carts`, `products` |
| Decrement stock | `products` | Guarded `$inc` per line — chunk 1's `claimStock`, with the session | `products` |
| Insert order items with snapshot prices | `order_items` | **Gone** — the `items` array is part of the order insert | — |
| Total, clear the cart, write outbox rows | `orders`, `cart_items`, `outbox` | Clear `carts.items`, insert two outbox documents | `carts`, `outbox` |

The earlier chapters say "five collections" when they point here; count the
table above and it is four, because
[the order document](../01-modeling-the-store/03-the-order-document.md)
absorbed `order_items`. The number of *writes* is unchanged — one order, one
claim per line, one cart clear, two outbox inserts — and it is the writes that
need to stand or fall together, not the collections.

## Why the order is still inserted first

Phase 1 inserted the order before touching stock so that a replayed request hit
the unique index before acquiring any lock. The same ordering pays here for a
different reason. Inside a transaction every write is provisional, so a replay
that claimed stock first would simply roll the claims back — no harm, but a hot
product's document was written and then unwritten, and under contention that is
a write conflict that some *other* buyer's transaction paid for. Inserting the
order first means a replay fails at its first write and never touches
`products` at all.

The idempotency guard itself is exactly what
[chapter 01 chunk 8](../01-modeling-the-store/06-constraints-that-vanish.md)
promised: a unique index, behaving under concurrency as the relational one did.

```js
await db.collection('orders').createIndex({idempotencyKey: 1}, {unique: true});
```

## The implementation

```js
// db/mongo/checkout.js — called by Phase 3's checkout service with validated input
import {ObjectId} from 'mongodb';
import {claimStock} from './products.js';

export class OutOfStockError extends Error {
  constructor(productIds) {
    super('insufficient stock');
    this.code = 'OUT_OF_STOCK';
    this.productIds = productIds;
  }
}
export class CartChangedError extends Error {
  constructor() { super('cart changed during checkout'); this.code = 'CART_CHANGED'; }
}

// chunk 4 justifies every field of this
export const TXN_OPTIONS = {
  readConcern: {level: 'snapshot'},
  writeConcern: {w: 'majority'},
  readPreference: 'primary',
  maxCommitTimeMS: 5_000,
};

export async function checkout(client, db,
  {userId, cartId, address, idempotencyKey, expectedTotalCents}) {
  const orders = db.collection('orders');

  // 0 — the common replay: answered without a transaction at all
  const seen = await orders.findOne({idempotencyKey},
    {projection: {status: 1, totalCents: 1}});
  if (seen) return {order: toOrder(seen), replay: true};

  try {
    return await client.withSession((session) =>
      session.withTransaction(async () => {
        const carts = db.collection('carts');
        const products = db.collection('products');
        const outbox = db.collection('outbox');
        const now = new Date();

        // 1 — the cart, from the transaction's snapshot
        const cart = await carts.findOne({_id: cartId, userId}, {session});
        if (!cart || cart.items.length === 0) {
          const err = new Error('cart is empty'); err.code = 'EMPTY_CART'; throw err;
        }

        // 2 — the products, for the snapshot the order carries
        const ids = cart.items.map((l) => l.productId);
        const found = await products.find(
          {_id: {$in: ids}, deletedAt: null},
          {session, projection: {name: 1, slug: 1, priceCents: 1, images: {$slice: 1}}},
        ).toArray();
        const byId = new Map(found.map((p) => [String(p._id), p]));

        // a product that vanished is treated exactly like zero stock (ch. 01·09)
        const missing = cart.items.filter((l) => !byId.has(String(l.productId)));
        if (missing.length) throw new OutOfStockError(missing.map((l) => l.productId));

        const items = cart.items.map((l) => {
          const p = byId.get(String(l.productId));
          return {productId: p._id, name: p.name, slug: p.slug,
                  coverKey: p.images?.[0]?.objectKey ?? null,
                  qty: l.qty, unitPriceCents: p.priceCents};
        });
        const totalCents = items.reduce((s, i) => s + i.qty * i.unitPriceCents, 0);
        if (totalCents !== expectedTotalCents) throw new CartChangedError();

        // 3 — the order FIRST: a concurrent replay dies here, on the unique index
        const orderId = new ObjectId();
        await orders.insertOne({
          _id: orderId, userId, status: 'paid', idempotencyKey,
          address, items, totalCents, createdAt: now, updatedAt: now,
        }, {session});

        // 4 — claim stock, one guarded write per line, sequentially
        const short = [];
        for (const line of cart.items) {
          const ok = await claimStock(db, {productId: line.productId, qty: line.qty, session});
          if (!ok) short.push(line.productId);
        }
        if (short.length) throw new OutOfStockError(short);

        // 5 — empty the cart; 6 — owe the side effects
        await carts.updateOne({_id: cartId}, {$set: {items: [], updatedAt: now}}, {session});
        const payload = {orderId: String(orderId), userId: String(userId), totalCents};
        await outbox.insertMany([
          {topic: 'order.confirmed',  payload, createdAt: now, processedAt: null, attempts: 0},
          {topic: 'order.fulfilment', payload, createdAt: now, processedAt: null, attempts: 0},
        ], {session});

        return {order: {id: String(orderId), status: 'paid', total_cents: totalCents},
                replay: false};
      }, TXN_OPTIONS),
    );
  } catch (err) {
    // a replay that raced us past step 0 lost the unique-index race in step 3
    if (err?.code === 11000) {
      const won = await orders.findOne({idempotencyKey}, {projection: {status: 1, totalCents: 1}});
      if (won) return {order: toOrder(won), replay: true};
    }
    throw err;
  }
}

const toOrder = (d) => ({id: String(d._id), status: d.status, total_cents: d.totalCents});
```

Phase 3's service calls this with the same arguments it passed the Postgres
version plus `expectedTotalCents` — the amount it just authorised — and maps the
same `{order, replay}` shape into the same 200/201. The
[endpoint](../../phase-3-express-api/07-the-checkout-endpoint.md) does not learn
which database answered.

## Gotchas

**★ `Promise.all` over the cart lines.** Chunk 1's claims were independent
writes and parallelising them was fine. Under a session it is documented
*"undefined behaviour"*. This is the single most likely regression when someone
"optimises" the loop, and it will pass a laptop test.

**★ A `DuplicateKey` inside the transaction is a hard error, not a signal to
handle inside the callback.** The insert in step 3 that loses the replay race
throws with `code: 11000`. Catching it *inside* the callback and returning the
existing order is wrong twice: the transaction is no longer in a state anything
should be committed from, and the read of the existing order would use a
session whose transaction is dead. Let it propagate; `withTransaction` aborts;
the `catch` *outside* re-reads without a session. That is why the 11000 branch
sits where it does.

**★ The cart can change between authorisation and commit, and a retry makes it
more likely.** Chunk 3's retry re-reads the cart from a fresh snapshot. If a
second tab pushed a line in between, the recomputed total is higher than the
authorised hold. Without `expectedTotalCents` the order commits for more than
the card authorised and the capture fails hours later in the worker.
`CartChangedError` is the fix, shown above; the endpoint maps it to 409 and the
client re-authorises.

**★ Nothing in the transaction creates a collection, and that is deliberate.**
Every collection this function touches exists from the migration in
[chapter 01](../01-modeling-the-store/06-constraints-that-vanish.md). The
manual's rule for *explicit* creation inside a transaction is that *"the
transaction read concern level must be `"local"`"* — and this transaction uses
`snapshot`. A fresh environment where the outbox collection was never created
is a deployment bug, not something the checkout path should paper over.

## Interview questions

**★ Chunk 1 argued the stock decrement needs no transaction. Why does checkout
need one?** Because a cart has several lines and the claims are several writes.
Each is atomic on its own; nothing makes them atomic *together*, so a crash
between claim two and claim three leaves stock taken with no order. The
transaction's job is narrow: make the order insert, the claims, the cart clear
and the outbox inserts one unit of commit. It does not replace the guard, the
unique index or the snapshot discipline — every one of those is still doing its
Phase 1 job inside the callback.

**★ Why is the order inserted before the stock is claimed, when the claims are
provisional anyway?** For the replay case. A replayed request that has slipped
past the fast path fails on the unique index at its first write and never
touches `products`. Reversed, it would decrement and then roll back hot product
documents — invisible to the customer, but a write conflict that some other
buyer's transaction absorbs and retries. Order-first keeps replays off the
contended documents entirely.

**★ Where did `order_items` go, and does the transaction get smaller or larger
for it?** Into `orders.items[]`, built once in memory from the cart. The
transaction has one fewer collection and one fewer write (no per-line insert),
and the "one line per product" constraint that was a composite primary key is
now a property of the array being constructed from a cart that
[cannot hold duplicates](../01-modeling-the-store/02b-the-cart-document.md).
The transaction is smaller; the invariant moved into code that runs once per
order.

**★ The replay fast path at step 0 is outside the transaction. Why is the
unique index still necessary?** Because step 0 is a read, and two identical
requests can both pass it before either inserts. The index is the only thing
that serialises them — one insert succeeds, the other fails with `DuplicateKey`
and the `catch` returns the winner's order. The fast path is an optimisation
that keeps replays off the transaction path; the index is the correctness.

---

← Prev: [The stock decrement](01-the-stock-decrement.md) ·
**Overview** *(not written yet)* ·
Next → [What each part is doing](02b-what-each-part-is-doing.md)
