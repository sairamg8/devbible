---
title: "The transaction"
sidebar_label: "1 · The transaction"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span> · Chapter 1 of
[The checkout transaction](README.md)

> Verified: 2026-08 against PostgreSQL 17 documentation — transactions,
> `select … for update`, `insert … on conflict`, `returning`.

## The problem

Checkout must make five changes stand or fall together: read the cart, claim
the stock, create the order with snapshot prices, empty the cart, and record
that an email and a webhook are owed. Any partial subset is a corrupt state —
stock claimed with no order, an order with no email ever sent. That is the
definition of a transaction, and this is the app's biggest one.

## The steps, in order — and why this order

1. **Insert the order first, keyed by the idempotency key.** If this checkout
   already happened, the unique index says so *now*, before any stock is
   touched — the replay path exits having changed nothing.
2. **Lock the cart's product rows in id order** (`for update`). Ordered
   locking is the deadlock rule chunk 2 defends.
3. **Decrement stock** — the `check (stock >= 0)` constraint turns overselling
   into a catchable error on exactly the raced row.
4. **Insert order items with prices read inside the lock** — the snapshot the
   spec fixed, taken at the only moment it is race-free.
5. **Total the order, empty the cart, write the outbox rows.** All bookkeeping,
   all inside the same commit.

## The implementation

```js
// db/checkout.js — called by POST /checkout (Phase 3) with validated input
import {withTransaction} from './tx.js'; // Phase 2's helper — begin/commit/rollback

export class OutOfStockError extends Error {
  constructor(productIds) {
    super('insufficient stock');
    this.code = 'OUT_OF_STOCK';
    this.productIds = productIds;
  }
}

export function checkout(pool, {userId, cartId, address, idempotencyKey}) {
  return withTransaction(pool, async (tx) => {
    // 1 — claim the idempotency key; a replay stops here
    const {rows: [order]} = await tx.query(
      `insert into orders (user_id, status, address, total_cents, idempotency_key)
       values ($1, 'pending', $2, 0, $3)
       on conflict (idempotency_key) do nothing
       returning id`,
      [userId, address, idempotencyKey],
    );
    if (!order) {
      const {rows: [existing]} = await tx.query(
        `select id, status, total_cents from orders where idempotency_key = $1`,
        [idempotencyKey],
      );
      return {order: existing, replay: true};
    }

    // 2 — read the cart and lock its products, id order = lock order
    const {rows: items} = await tx.query(
      `select ci.product_id, ci.quantity, p.price_cents, p.stock
         from cart_items ci
         join products p on p.id = ci.product_id
        where ci.cart_id = $1
        order by ci.product_id
          for update of p`,
      [cartId],
    );
    if (items.length === 0) throw new Error('cart is empty');

    // 3 — fail with the full list, not just the first shortage
    const short = items.filter((i) => i.stock < i.quantity);
    if (short.length > 0) {
      throw new OutOfStockError(short.map((i) => i.product_id));
    }
    for (const i of items) {
      await tx.query(
        `update products set stock = stock - $1 where id = $2`,
        [i.quantity, i.product_id],
      );
    }

    // 4 — snapshot prices into order_items
    for (const i of items) {
      await tx.query(
        `insert into order_items (order_id, product_id, quantity, unit_price_cents)
         values ($1, $2, $3, $4)`,
        [order.id, i.product_id, i.quantity, i.price_cents],
      );
    }

    // 5 — total, clear the cart, owe the side-effects
    const totalCents = items.reduce(
      (sum, i) => sum + i.quantity * Number(i.price_cents), 0,
    );
    await tx.query(
      `update orders set total_cents = $1, status = 'paid' where id = $2`,
      [totalCents, order.id],
    );
    await tx.query(`delete from cart_items where cart_id = $1`, [cartId]);
    await tx.query(
      `insert into outbox (topic, payload)
       values ('order.confirmed', $1), ('order.fulfilment', $1)`,
      [{orderId: order.id, userId, totalCents}],
    );

    return {order: {id: order.id, status: 'paid', total_cents: totalCents},
            replay: false};
  });
}
```

The payment step is deliberately outside this chapter: the mocked provider
(spec §out-of-scope) is called by the endpoint *before* this function, and its
authorization id travels in `address.paymentRef`. Capturing real money inside
a database transaction couples two systems that fail independently — the
endpoint chapter (Phase 3) sequences them and explains that boundary.

## What to notice

- **`on conflict do nothing … returning`** returns a row only when the insert
  happened — the empty result *is* the replay signal, with no separate
  existence check racing the insert.
- **`for update of p`** locks only the product rows, not the cart items —
  lock what you will write.
- **The stock check reads `i.stock` from the locked read** — no re-query,
  no window for it to change: the lock is held until commit.
- **`status = 'paid'` happens in step 5**, not at insert — a `pending` row
  with the key claimed is what a crash mid-transaction leaves *visible to
  nobody*, since the transaction never committed. Chunk 2 walks every crash
  point.
- **Two outbox rows, one payload** — the email and the fulfilment webhook
  are separate deliveries with separate retry lives (Phase 2).

## Gotchas

- **Symptom:** replays return `{replay: true}` but with `status: 'pending'`
  and total 0. **Cause:** the first attempt crashed *after* claiming the key
  but before committing — impossible: the claim rolled back with it. The
  actual cause is a client retrying while the first request is still
  in flight, reading the uncommitted claim as absent and… also impossible —
  the second insert blocks on the first's uncommitted key until it resolves.
  This "bug report" is chunk 2's worked example of trusting the isolation
  model: the anomaly cannot occur, and the investigation should look at the
  client's key generation instead.
- **Symptom:** `numeric` maths went wrong — `total_cents` is a string
  concatenation like `"19992999"`. **Cause:** `bigint` columns arrive in
  Node as strings ([the pg types page](../../../../nodejs/pages/phase-6-data-access/04-postgresql-from-node.md));
  `+` on strings concatenates. **Fix:** the explicit `Number(i.price_cents)`
  in the reduce — and chapter 07 sets the pool-level parser so cents come
  back as numbers everywhere.
- **Symptom:** `cannot use for update with a left join` style errors after a
  refactor. **Cause:** `for update of p` requires `p` to be a plain joined
  table; outer joins can't lock their nullable side. **Fix:** keep the cart
  read an inner join — a cart item whose product vanished violates the FK
  anyway.

## Interview questions

1. **★ Why insert the order before touching stock?** The idempotency claim
   must be the first write: a replay then exits before acquiring locks or
   changing anything, and a crash before commit rolls the claim back cleanly.
   Claim-late designs let a replayed request redo real work before
   discovering it already happened.
2. **★ Why does the stock check not need a re-read after locking?** `for
   update` blocks any concurrent writer until this transaction ends, and the
   row values returned by the locking select are the current committed state
   at lock acquisition. Between that read and the update, nothing can touch
   the row — the read *is* current for the lock's lifetime.
3. **Why `on conflict do nothing` + select, rather than `do update` returning
   the existing row?** `do update … returning` would work but takes a row
   lock on the existing order and rewrites identical values — a replay should
   be read-only. `do nothing` keeps the replay path lock-free on the order
   row; the follow-up select sees the committed original.
4. **Why is the cart cleared inside the transaction instead of by the client
   after success?** The cart's emptiness is part of the checkout's truth — a
   crash after commit with a client-side clear leaves a paid order *and* a
   full cart, inviting double checkout. Server state changes travel together.

---

Next → [Concurrency and failure](02-concurrency-and-failure.md) ·
Topic index: [The checkout transaction](README.md)
