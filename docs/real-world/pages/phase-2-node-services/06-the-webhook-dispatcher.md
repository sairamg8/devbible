---
title: "The webhook dispatcher"
sidebar_label: "06 · Webhook dispatcher"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Node.js v24 docs (`crypto.createHmac`,
> `fetch`/undici, `AbortSignal.timeout`) and RFC 2104 (HMAC). Concept home:
> [Node — outbound side-effects as jobs](../../../nodejs/pages/phase-7-background-work/09-outbound-side-effects.md),
> [outbound client discipline](../../../nodejs/pages/phase-5-http-processes/08-outbound-client-discipline.md),
> [timing attacks](../../../nodejs/pages/phase-8-security/16-timing-attacks.md).

## The problem

The fulfilment partner wants an HTTP POST when an order is paid. Their server
is sometimes down, sometimes slow, occasionally behind a redeploy — and they
need to know a request genuinely came from this app and wasn't replayed by
whoever sniffed one. Outbound webhooks are the mirror image of the inbound
kind Phase 3 receives: this side signs and retries; theirs verifies and
deduplicates.

## The design choices

**It is an outbox handler, not a new system.** The
[relay](04-outbox-relay-and-email.md) already provides claiming, retries with
backoff, dead-lettering and shutdown. Webhook delivery is one more `handlers`
entry — the whole point of building the relay once.

**Sign the body, timestamp the signature.** An HMAC over
`timestamp + "." + body` with a shared secret proves origin *and* binds the
signature to a moment — the receiver rejects stale timestamps, which kills
replay without storing nonces. This is the widely adopted shape (Stripe-style)
partners already know how to verify.

**Delivery is judged by status code only.** 2xx is delivered; anything else
is a retry. The dispatcher never parses the partner's body — coupling retry
logic to a partner's response format is how integrations rot.

**One timeout, no surprises.** `AbortSignal.timeout(10_000)` per attempt —
and, per the [outbound-client discipline](../../../nodejs/pages/phase-5-http-processes/08-outbound-client-discipline.md),
note the platform default (undici's ~5-minute header/body timeouts) is not a
substitute for an explicit budget.

## The implementation

```js
// worker/handlers/order-fulfilment.js
import {createHmac} from 'node:crypto';

export function fulfilmentHandler({config, orders}) {
  const endpoint = config.FULFILMENT_WEBHOOK_URL;
  const secret = config.FULFILMENT_WEBHOOK_SECRET;

  return async ({orderId}) => {
    const order = await orders.byIdWithItems(orderId);
    const body = JSON.stringify({
      // the partner's contract: stable field names, ids as strings
      event: 'order.paid',
      orderId: String(orderId),
      items: order.items.map((i) => ({
        productId: String(i.product_id), quantity: i.quantity,
      })),
      shippingAddress: order.address,
    });

    const timestamp = Math.floor(Date.now() / 1000);
    const signature = createHmac('sha256', secret)
      .update(`${timestamp}.${body}`)
      .digest('hex');

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-store-timestamp': String(timestamp),
        'x-store-signature': `v1=${signature}`,
        // relay retries reuse the outbox id — the partner's dedup key
        'x-store-delivery': String(order.outboxId ?? orderId),
        'user-agent': 'storefront-webhooks/1.0',
      },
      body,
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      // read a little for the log, never for logic
      const snippet = (await res.text().catch(() => '')).slice(0, 200);
      throw new Error(`fulfilment responded ${res.status}: ${snippet}`);
    }
  };
}
```

Registered beside the email handler:

```js
// worker/main.js (excerpt)
const relay = createRelay({pool, signal, handlers: {
  'order.confirmed': orderConfirmedHandler({mailer, orders}),
  'order.fulfilment': fulfilmentHandler({config, orders}),
}});
```

## What to notice

- **The retry policy came for free** — a thrown error re-enters the relay's
  attempts/backoff/dead-letter bookkeeping. This handler contains *zero*
  retry code, which is exactly the layering the outbox bought.
- **`x-store-delivery` makes the partner's dedup possible.** At-least-once
  delivery (the relay's contract) means the partner *will* see duplicates;
  a stable delivery id turns "process this twice" into "recognize and skip".
  It mirrors what this app's own inbound webhook endpoint demands of
  *its* senders (Phase 3).
- **The body is built from the database, not from the outbox payload.** The
  payload carries ids; the handler re-reads current truth. A retried
  delivery three hours later ships the order's real state, and the payload
  schema in the outbox stays minimal.
- **Version-prefixed signature (`v1=`)** costs nothing today and is the
  difference between "rotate the scheme" and "break every partner" later.
  Secret rotation works the same way: sign with the new secret, and the
  partner verifies against both during the overlap window.

## Gotchas

- **Symptom:** the partner reports "invalid signature" on every delivery,
  but the secret matches. **Cause:** they verified over a *re-serialized*
  body — their framework parsed JSON and re-stringified with different key
  order/whitespace. **Fix:** their side must HMAC the **raw request bytes**;
  this is the number-one webhook integration failure, and the partner doc
  this chapter implies must say it in bold. (Phase 3's inbound endpoint has
  the same rule, enforced by reading the raw body before any parser.)
- **Symptom:** deliveries dead-letter during the partner's nightly deploy
  window. **Cause:** eight attempts across the relay's backoff curve span
  ~2 hours — shorter than their downtime that night. **Fix:** `requeue`
  (chapter 10) after the window, and if it recurs, raise `MAX_ATTEMPTS`
  for this topic — the relay reads per-topic overrides from config; the
  budget is a business decision about how stale a fulfilment may arrive.
- **Symptom:** a security review asks "what if the webhook URL is
  attacker-controlled?" **Cause:** it is config, not user input — but the
  question stands for the day partners self-register URLs. **Fix:** that
  feature imports the [SSRF defences](../../../nodejs/pages/phase-8-security/12-ssrf.md)
  wholesale: allow-listed schemes/ports, resolved-address checks, no
  redirects followed. Named now so self-serve URLs don't ship without it.

## Interview questions

1. **★ Why does the signature cover a timestamp as well as the body?** The
   HMAC alone proves origin but not freshness — a captured request replays
   forever. Binding the timestamp into the signed string lets the receiver
   enforce a tolerance window (e.g. 5 minutes) with no nonce storage;
   changing either the body or the claimed time breaks the MAC.
2. **★ Why judge success by status code and never the response body?**
   Status is the one field with agreed semantics; bodies are partner
   implementation detail that changes without notice. Parsing them for
   "success" strings couples the retry loop to another team's refactors —
   the definition of an integration that breaks on their deploy, not yours.
3. **Why re-read the order in the handler instead of shipping the state in
   the outbox payload?** Retries deliver late — hours, after an incident.
   State captured at enqueue time can be stale (address corrected, order
   cancelled); rebuilding from the database ships the truth as of delivery.
   Payload-as-pointer also keeps the outbox rows small and schema-stable.
4. **The partner asks for exactly-once delivery. What do you tell them?**
   That nobody has it to sell: between any send and its acknowledgement, a
   crash forces a choice between maybe-lost and maybe-duplicated, and this
   system chose duplicates on purpose. What they get instead is a stable
   delivery id and at-least-once — which composes into effectively-once on
   their side with a dedup table. That is the industry answer, not a
   shortcut.

---

← Prev: [Scheduled jobs](05-scheduled-jobs.md) ·
Next → [The search indexer job](07-the-search-indexer.md)
