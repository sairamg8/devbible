---
title: "Inbound webhooks"
sidebar_label: "11 · Inbound webhooks"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Node.js v24 crypto docs
> (`createHmac`, `timingSafeEqual`), Express 5 docs (`express.raw`), and
> RFC 2104. Concept home:
> [Node — timing attacks](../../../nodejs/pages/phase-8-security/16-timing-attacks.md);
> the outbound mirror is [chapter 2·06](../phase-2-node-services/06-the-webhook-dispatcher.md).

## The problem

The payment provider calls back — `payment.captured`, `payment.disputed` —
and the fulfilment partner posts shipping updates. Anyone on the internet
can POST to these URLs; the endpoint's job is to accept *only* authentic,
fresh, previously-unseen events, acknowledge them fast, and do the real
work elsewhere. Every rule here is the receiving half of what
[the dispatcher](../phase-2-node-services/06-the-webhook-dispatcher.md)
demanded of *its* receiver — the two chapters are one protocol seen from
both ends.

## The rules

1. **Verify the HMAC over the raw bytes** — before parsing, before
   anything. Timestamp-bound, compared with `timingSafeEqual`.
2. **Reject stale timestamps** (5-minute window) — replay defence without
   nonce storage.
3. **Deduplicate on the sender's event id** — at-least-once delivery is
   *their* contract too; an insert-or-ignore table turns duplicates into
   no-ops.
4. **Acknowledge, then process.** 200 means "received and recorded", not
   "handled" — the handling rides the outbox, because a slow handler here
   makes the *sender* retry and re-deliver.

## The implementation

```js
// src/routes/webhooks.js — mounted BEFORE express.json (ch. 01's order)
import express from 'express';
import {createHmac, timingSafeEqual} from 'node:crypto';
import {withTransaction} from '../../db/tx.js';

function verifySignature({secret, toleranceS = 300}) {
  return (req, res, next) => {
    const ts = Number(req.get('x-provider-timestamp'));
    const sig = req.get('x-provider-signature') ?? '';

    if (!Number.isFinite(ts)
        || Math.abs(Date.now() / 1000 - ts) > toleranceS) {
      return res.status(401).json({code: 'STALE_OR_MISSING_TIMESTAMP'});
    }
    const expected = createHmac('sha256', secret)
      .update(`${ts}.`).update(req.body)        // req.body is a Buffer here
      .digest();
    const given = Buffer.from(sig.replace(/^v1=/, ''), 'hex');
    if (given.length !== expected.length
        || !timingSafeEqual(given, expected)) {
      return res.status(401).json({code: 'BAD_SIGNATURE'});
    }
    next();
  };
}

export function buildWebhookRoutes({config, pool}) {
  const router = express.Router();

  router.post('/payments',
    express.raw({type: '*/*', limit: '256kb'}),  // Buffer, not parsed JSON
    verifySignature({secret: config.PAYMENT_WEBHOOK_SECRET}),
    async (req, res, next) => {
      try {
        const event = JSON.parse(req.body);      // only AFTER verification
        await withTransaction(pool, async (tx) => {
          // 1 — dedup: first delivery wins, replays become no-ops
          const {rowCount} = await tx.query(
            `insert into webhook_events (source, event_id)
             values ('payments', $1)
             on conflict (source, event_id) do nothing`,
            [String(event.id)],
          );
          if (rowCount === 0) return;            // seen it — ack again, do nothing

          // 2 — record the work, not do the work
          await tx.query(
            `insert into outbox (topic, payload) values ($1, $2)`,
            [`payments.${event.type}`, event],
          );
        });
        res.status(200).json({received: true});
      } catch (err) { next(err); }
    });

  return router;
}
```

The dedup table is one migration —
`webhook_events (source text, event_id text, received_at timestamptz
default now(), primary key (source, event_id))` — pruned by
[the retention job](../phase-2-node-services/05-scheduled-jobs.md) on the
same 30-day line as the outbox. The actual handlers (`payments.captured`
updates order status via
[`setStatus`](../phase-2-node-services/02-the-data-layer.md); disputes page
a human) are ordinary relay handlers in the worker.

## What to notice

- **`express.raw` scoped to this router** is the whole reason for the
  [mount-order rule](01-project-structure.md) — the signature covers bytes
  no other middleware has touched.
- **Two `update` calls on the HMAC** (`` `${ts}.` `` then the buffer) avoid
  concatenating a string with a Buffer — the encoding bug that produces
  "works for ASCII payloads, fails on the first é".
- **The length check before `timingSafeEqual`** — it *throws* on unequal
  lengths, and an early return on length is not a timing leak (length is
  public: it's in the request).
- **Ack-then-process via the outbox** closes an elegant loop: an inbound
  webhook becomes an outbox row, drained by the same relay, with the same
  retries and dead-lettering, that sends *outbound* webhooks. One delivery
  machine, both directions.
- **401 bodies here bypass the error contract's neutrality rules
  deliberately** — the caller is a machine integrating against you;
  `BAD_SIGNATURE` vs `STALE_OR_MISSING_TIMESTAMP` is exactly the feedback
  their integration engineer needs, and reveals nothing an attacker didn't
  already know (they sent the request).

## Gotchas

- **Symptom:** every verification fails after "just adding logging" that
  reads `req.body`. **Cause:** a JSON body-parser slipped in front (global
  mount, or the logging middleware parsed) — `req.body` is now an object,
  and `createHmac.update(object)` throws or hashes `[object Object]`.
  **Fix:** the mount order, again; the regression test is a replayed
  known-good webhook fixture, which fails loudly the day anyone reorders
  middleware.
- **Symptom:** the provider's dashboard shows retries piling up though the
  endpoint returns 200 in your tests. **Cause:** production is slow to
  ack — usually the handler doing real work inline (the thing rule 4
  forbids) and exceeding the provider's ~10 s patience. **Fix:** the
  outbox shape above: the request path does two inserts and answers.
- **Symptom:** one event processed twice anyway. **Cause:** the dedup
  insert and the outbox insert weren't in one transaction — a crash
  between them recorded "seen" without recording the work (or vice
  versa). **Fix:** the `withTransaction` wrapper above is not decoration;
  dedup-mark and work-record commit together or not at all — the same
  atomicity argument as [the outbox itself](../phase-2-node-services/04-outbox-relay-and-email.md).
- **Symptom:** verification breaks only for one partner after they
  "upgraded". **Cause:** they moved to `v2=` signatures (new secret or
  scheme) and the code strips only `v1=`. **Fix:** verify against every
  version currently in the overlap window — the same rotation courtesy
  [the dispatcher](../phase-2-node-services/06-the-webhook-dispatcher.md)
  extends to its receivers.

## Interview questions

1. **★ Why must the 200 mean "recorded" and not "processed"?** The sender
   retries on slow or failed acks — so a slow handler *causes* the
   duplicate deliveries it then has to dedup, and a handler crash turns
   into a retry storm. Recording (two inserts) is fast and durable;
   processing rides machinery built for retries. The ack's meaning is a
   contract about *whose* retry loop owns the failure afterward: after
   200, it's yours.
2. **★ Why does dedup belong to the receiver when the sender already has
   delivery ids?** Because at-least-once is the *sender's* guarantee — the
   id is the tool, not the dedup. Only the receiver knows what "already
   handled" means on its side, and only the receiver can make
   check-and-record atomic with its own state. Every reliable-delivery
   protocol lands here: senders number, receivers remember.
3. **Why is parsing the JSON before verifying the signature dangerous
   beyond wasted CPU?** The parser becomes attacker-reachable
   attack surface: prototype-pollution payloads, pathological nesting,
   multi-megabyte bodies — all processed pre-authentication. Verification
   first means unauthenticated input touches exactly two things: an HMAC
   and a clock, both constant-time in the input's content.
4. **The provider offers "webhook signing certificates" (asymmetric)
   instead of shared secrets. What changes in this design?** Verification
   becomes `crypto.verify` against their published public key — and the
   *rotation* story improves (they rotate keys without you re-sharing a
   secret; you fetch their JWKS). The raw-body rule, timestamp window,
   dedup and ack-then-process are unchanged — the protocol's shape is
   independent of the MAC's algebra.

---

← Prev: [Rate limiting](10-rate-limiting.md) ·
Next → **OpenAPI from the schemas** *(not written yet)*
