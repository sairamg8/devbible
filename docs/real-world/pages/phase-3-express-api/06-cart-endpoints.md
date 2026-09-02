---
title: "Cart endpoints"
sidebar_label: "06 · Cart endpoints"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Express 5 docs and PostgreSQL 17 docs
> (`on conflict`). Concept home:
> [Express — cookies and sessions wire-up](../../../expressjs/pages/phase-8-validation-authz/05-cookies-sessions-wireup.md);
> the constraints are [the schema's](../phase-1-database/01-the-schema/02-carts-orders-reviews-outbox.md).

## The problem

The cart is the one resource that must work for *everyone* — guests
included — and survive the identity change at login. The spec's rules: a
guest cart anchors to the anonymous session, merges into the account cart on
login (never replaced, never lost), and "add the same product again" bumps
quantity. The schema built the constraints; this chapter is the endpoints
and the merge.

## The surface

| Route | Auth | Does |
|---|---|---|
| `GET /cart` | any session | the caller's cart, priced live |
| `PUT /cart/items/:productId` | any session | set quantity (0 removes) — one idempotent verb |
| `DELETE /cart` | any session | empty it |

One `PUT` instead of add/update/remove triples: *set the quantity* is
idempotent (retries are safe), covers all three intents, and matches how
the UI actually behaves (steppers set values, they don't send deltas).

## The implementation

```js
// src/services/carts.js
export function cartService({pool}) {
  async function ensureCart({userId, sessionId}) {
    // one live cart per owner — the partial unique indexes make this race-safe
    const owner = userId ? ['user_id', userId] : ['session_id', sessionId];
    const {rows: [cart]} = await q(pool).query(
      `insert into carts (${owner[0]}) values ($1)
       on conflict (${owner[0]}) where ${owner[0]} is not null
       do update set updated_at = now()
       returning id`,
      [owner[1]],
    );
    return cart.id;
  }

  return {
    async get({userId, sessionId}) {
      const cartId = await ensureCart({userId, sessionId});
      const {rows: items} = await q(pool).query(
        `select ci.product_id, ci.quantity, p.slug, p.name,
                p.price_cents, p.stock, p.deleted_at is not null as retired
           from cart_items ci join products p on p.id = ci.product_id
          where ci.cart_id = $1
          order by p.name`,
        [cartId],
      );
      return {
        items: items.map((i) => ({
          product_id: i.product_id, slug: i.slug, name: i.name,
          quantity: i.quantity, price_cents: i.price_cents,
          available: !i.retired && i.stock >= i.quantity,
        })),
        total_cents: items.reduce((s, i) => s + i.price_cents * i.quantity, 0),
      };
    },

    async setItem({userId, sessionId, productId, quantity}) {
      const cartId = await ensureCart({userId, sessionId});
      if (quantity === 0) {
        await q(pool).query(
          `delete from cart_items where cart_id = $1 and product_id = $2`,
          [cartId, productId]);
        return;
      }
      const {rowCount} = await q(pool).query(
        `insert into cart_items (cart_id, product_id, quantity)
         select $1, id, $3 from products
          where id = $2 and deleted_at is null
         on conflict (cart_id, product_id)
         do update set quantity = excluded.quantity`,
        [cartId, productId, quantity]);
      if (rowCount === 0) throw new ApiError(404, 'NOT_FOUND', 'product not found');
    },

    /** Login's other half — called by POST /auth/login after the session
     *  upgrade. Item-level merge: quantities sum, capped; guest cart dies. */
    async mergeOnLogin({userId, guestSessionId}) {
      await withTransaction(pool, async () => {
        const {rows: [guest]} = await q(pool).query(
          `select id from carts where session_id = $1`, [guestSessionId]);
        if (!guest) return;
        const accountCartId = await ensureCart({userId});
        await q(pool).query(
          `insert into cart_items (cart_id, product_id, quantity)
           select $1, product_id, quantity from cart_items where cart_id = $2
           on conflict (cart_id, product_id)
           do update set quantity =
             least(cart_items.quantity + excluded.quantity, 99)`,
          [accountCartId, guest.id]);
        await q(pool).query(`delete from carts where id = $1`, [guest.id]);
      });
    },
  };
}
```

## What to notice

- **The cart prices nothing permanently.** `GET /cart` joins live product
  prices — carts show *today's* price, and only
  [checkout snapshots it](../phase-1-database/06-the-checkout-transaction/01-the-transaction.md).
  Price-at-add-time carts require a "price changed" reconciliation UI that
  the spec never asked for.
- **`available` is computed per line, and the cart still returns.** A
  retired or out-of-stock item stays visible and flagged — silently
  dropping it is how users distrust carts. Checkout is where
  unavailability becomes an error; the cart is where it becomes
  *information*.
- **The merge sums quantities inside one transaction** — the
  [ALS transaction helper](../phase-2-node-services/02-the-data-layer.md)
  wrapping three statements, so a crash mid-login can't leave the guest
  cart half-copied and deleted. `least(…, 99)` caps the sum at the same
  bound the [validation schema](02-the-validation-boundary.md) enforces —
  the two limits are one config constant.
- **The anonymous session is real infrastructure.** `GET /cart` for a
  cookie-less visitor first creates an anonymous `sessions` row
  ([the nullable `user_id` design](../phase-1-database/01-the-schema/01-conventions-identity-catalog.md))
  and sets the same `__Host-` cookie — the auth middleware resolves it as
  `req.session` with `req.user` null. Guests are sessions without users,
  not a parallel mechanism.

## Gotchas

- **Symptom:** a user logs in on their phone and their laptop's cart items
  are gone. **Cause:** they never were there — two devices, two guest
  sessions, and only the *logging-in* device's cart merged. **Fix:**
  working as specified: the account cart is the durable one, and it now
  holds the phone's merge; the laptop's guest cart merges whenever *it*
  logs in. Explaining this shape is cheaper than inventing cross-device
  guest sync.
- **Symptom:** intermittent duplicate-key errors on `ensureCart` under
  login load. **Cause:** would happen with a select-then-insert; the
  `on conflict do update … returning` shape is *why* it doesn't — two
  racers both land on the same row. If the error appears anyway, someone
  rewrote it as a select-first "optimization". **Fix:** the upsert is the
  optimization; restore it.
- **Symptom:** cart totals disagree with checkout totals by a few cents.
  **Cause:** they can — legitimately — when a price changed between
  viewing and buying; checkout's locked read is the truth. **Fix:** the
  React cart (Phase 4) refetches after checkout failure and shows the
  price-changed line; the API's job was done by *not* pretending cart
  totals were quotes.

## Interview questions

1. **★ Why is the cart-item endpoint a single idempotent PUT instead of
   POST-add / PATCH-update / DELETE-remove?** Because the client's intent
   is "make the quantity be N" — and an idempotent *set* survives retries
   (the fetch wrapper retries on network failure) without double-adding,
   collapses three handlers into one, and makes the remove case just
   N = 0. Delta-based POSTs turn every retry into a potential duplicate.
2. **★ Walk through why the merge must be transactional.** Three steps:
   read guest items, upsert into account cart, delete guest cart. A crash
   after step 2 without a transaction leaves both carts (items doubled on
   next merge attempt); after a partial step 2, some items copied. One
   transaction makes login's cart-effect atomic: either the merged world
   or the pre-login world, never a hybrid.
3. **Why do carts show live prices when orders snapshot them?** A cart is
   *intent* — the user is still shopping, and showing stale prices
   misleads the purchase decision. An order is a *record* — mutating it
   retroactively falsifies history. Same field, different lifecycle stage,
   opposite correctness rules; the boundary is the checkout transaction.
4. **What makes guest carts safe to sweep after three days but account
   carts never?** The anchor: a guest cart's identity dies with its
   session cookie, so an aged one is unreachable garbage. An account cart
   is reachable forever by login — sweeping it deletes a real user's
   state. The [sweep job](../phase-2-node-services/05-scheduled-jobs.md)
   encodes exactly this line (`user_id is null`).

---

← Prev: [Catalog endpoints](05-catalog-endpoints.md) ·
Next → [The checkout endpoint](07-the-checkout-endpoint.md)
