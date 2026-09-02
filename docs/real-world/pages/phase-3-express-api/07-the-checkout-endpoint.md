---
title: "The checkout endpoint"
sidebar_label: "07 · The checkout endpoint"
sidebar_position: 7
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Express 5 docs and RFC 9110. Concept home:
> the [checkout transaction](../phase-1-database/06-the-checkout-transaction/README.md)
> it orchestrates, and
> [Node — timeout budgets](../../../nodejs/pages/phase-7-background-work/12-timeout-budgets.md).

## The problem

The one endpoint where every earlier chapter converges: authenticated
(ch. 03), validated (ch. 02), rate-limited (ch. 10), calling the payment
provider *and* [the Phase 1 transaction](../phase-1-database/06-the-checkout-transaction/README.md),
safe to replay, and honest in every failure. Its hardest question is
sequencing: **payment and database are two systems that fail
independently**, and the order of operations decides who can lose money.

## The sequencing decision

Authorize payment **before** the transaction; capture is the worker's
problem. The full analysis:

| Order | Failure between the two | Result |
|---|---|---|
| DB first, then pay | order exists, payment failed | order stuck `pending`, stock held hostage — needs a reaper |
| **Pay (authorize) first, then DB** | authorized, DB failed | a hold that auto-expires; no order, stock untouched — self-healing |
| Pay (capture) first | captured, DB failed | **customer charged for nothing** — the unacceptable row |

Authorization (a hold, not a charge) is the tool that makes "pay first"
safe: worst case is a temporary hold the provider expires. The capture —
actually taking the money — rides the outbox like every other side-effect,
after the order committed.

## The implementation

```js
// src/services/checkout.js
import {checkout as checkoutTx} from '../../db/checkout.js';   // Phase 1·06
import {withRetry} from '../../db/tx.js';
import {ApiError} from '../middleware/errors.js';

export function checkoutService({pool, payments}) {
  return {
    async place({userId, cartId, address, cardToken, idempotencyKey}) {
      const cart = await cartTotals(pool, cartId);
      if (cart.items.length === 0) {
        throw new ApiError(422, 'EMPTY_CART', 'cart is empty');
      }

      // 1 — authorize the hold; provider gets the SAME idempotency key
      const auth = await payments.authorize({
        amountCents: cart.total_cents, cardToken, idempotencyKey,
        signal: AbortSignal.timeout(8_000),
      });
      if (!auth.ok) {
        throw new ApiError(402, 'PAYMENT_DECLINED', auth.declineReason);
      }

      // 2 — the Phase 1 transaction (idempotency claim, locks, snapshot, outbox)
      try {
        const result = await withRetry(() => checkoutTx(pool, {
          userId, cartId, idempotencyKey,
          address: {...address, paymentRef: auth.reference},
        }));
        return result;                       // {order, replay}
      } catch (err) {
        // 3 — DB refused after a successful hold: release it, then rethrow
        await payments.release({reference: auth.reference, idempotencyKey})
          .catch(() => {/* release is best-effort; holds expire on their own */});
        throw err;
      }
    },
  };
}
```

```js
// src/routes/checkout.js
router.post('/', requireAuth, rateLimit('checkout'),
  validate({body: CheckoutBody, headers: IdemHeader}), async (req, res, next) => {
    try {
      const {order, replay} = await checkoutSvc.place({
        userId: req.user.id,
        cartId: req.cart.id,                 // resolved by cart middleware
        address: req.valid.body.address,
        cardToken: req.valid.body.card_token,
        idempotencyKey: req.valid.headers['idempotency-key'],
      });
      res.status(replay ? 200 : 201).json({
        order_id: order.id, status: order.status, total_cents: order.total_cents,
      });
    } catch (err) { next(err); }
  });
```

The client mints the `Idempotency-Key` (a UUID per checkout *attempt*, kept
across retries of that attempt — Phase 4's checkout form owns this), and
the same key flows to the payment provider, so a retried request cannot
double-authorize either.

## The failure map, endpoint edition

| Failure | Status | Customer sees | System state |
|---|---|---|---|
| Validation | 400 | field errors | nothing happened |
| Not logged in | 401 | login wall | nothing |
| Card declined | 402 | decline reason | expired hold only |
| Empty cart / stock gone | 422 / 409 | actionable message | hold released |
| Provider timeout | 504 | "try again" — same key | provider dedups the retry |
| DB down mid-flight | 503 | "try again" — same key | hold released or expiring |
| Replay of a success | 200 | the original order | untouched — [the replay path](../phase-1-database/06-the-checkout-transaction/01-the-transaction.md) |

Two details carry it: **the client retries with the *same* key** (that is
what makes every 5xx row safe), and **`OutOfStockError` maps to 409 with
the product ids** so the UI can mark exactly which cart lines to fix —
[chunk 1·06](../phase-1-database/06-the-checkout-transaction/01-the-transaction.md)
defined the error class; this phase's chapter 09 maps it.

## Gotchas

- **Symptom:** double charges reported — but the orders table has one
  order. **Cause:** the client regenerated the idempotency key per *retry*
  instead of per *attempt*, so the provider saw two authorizations; the DB
  deduped, the release only covered the second. **Fix:** the key's
  lifecycle rule (mint on form-submit intent, reuse until success or
  user-visible abandonment) — and reconciliation (Phase 2's scheduled job)
  catches orphaned holds by listing provider authorizations without
  matching orders.
- **Symptom:** checkout hangs 30 s then 504s when the provider is degraded.
  **Cause:** no budget on the authorize call — or one, unshrunk, at every
  layer. **Fix:** the 8 s `AbortSignal.timeout` *inside* whatever the
  route's overall budget is — [deadline propagation](../../../nodejs/pages/phase-7-background-work/13-deadline-propagation.md):
  the outer budget owns the request; inner calls get strictly less.
- **Symptom:** load test shows stock oversold — the constraint "failed".
  **Cause:** it didn't; the test asserted on cart reads (unlocked,
  optimistic) instead of order rows. The transaction's locked path is the
  only stock truth. **Fix:** assert on `order_items` sums vs initial
  stock; re-read [the concurrency chunk](../phase-1-database/06-the-checkout-transaction/02-concurrency-and-failure.md)
  before "fixing" isolation levels.

## Interview questions

1. **★ Why authorize-then-commit-then-capture instead of charging
   up front?** Charging first creates the one unrecoverable failure —
   money taken, no order. Authorization is reversible by design (release,
   or expiry), so the risky window between the two systems holds only a
   reversible artifact; the irreversible step (capture) happens *after*
   the order is durable, delivered at-least-once by the outbox.
2. **★ Why does the same idempotency key go to both the provider and the
   database?** Each system dedups its own side: the DB's unique index
   collapses replayed orders, the provider collapses replayed
   authorizations. One key means one retry story — any partial failure
   retries the *whole* operation safely, because both sides recognize it.
   Two keys would let a retry pair a fresh authorization with a replayed
   order.
3. **Why 402/409/422 distinctions instead of one 400?** The client's
   *recovery* differs: 402 → try another card; 409 (stock, with ids) →
   edit those cart lines; 422 (empty) → go shopping. Status codes are the
   machine-readable half of the error contract — collapsing them moves the
   distinction into prose the client must parse, i.e. nowhere.
4. **The provider's authorize succeeded but your release failed and the
   process died. Who cleans up?** Nobody, deliberately — holds expire
   (that is why step 1 is an authorization), and the reconciliation job
   reports orphans in the meantime. Building a durable release queue for
   an artifact that self-destructs would be machinery without a failure
   mode to justify it.

---

← Prev: [Cart endpoints](06-cart-endpoints.md) ·
Next → [The uploads endpoint](08-the-uploads-endpoint.md)
