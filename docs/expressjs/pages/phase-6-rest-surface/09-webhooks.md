---
title: "Webhooks"
sidebar_label: "09 · Webhooks"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

**Inbound: raw body + signature + timestamp skew. Outbound: enqueue, return 202 — do not await the remote world on the request thread.**

> Verified: 2026-08-14 — **no sandbox run**. The Express half is documented:
> [`express.raw`](https://expressjs.com/en/5x/api/express/) *"parses incoming request
> payloads into a `Buffer`"*, with `type` defaulting to **`"application/octet-stream"`**
> and `limit` to `"100kb"` — **so a provider posting `application/json` will not reach it
> unless you widen `type` yourself**, which is the single most common reason webhook
> signature checks fail on first setup ([Phase 3](../phase-3-requests/06-raw-and-text.md)).
> Mount order follows from the documented content-type gate: whichever body parser matches
> first consumes the stream.
> `crypto.timingSafeEqual` is Node's, and the docs are explicit that it
> **throws if the two buffers differ in length**
> ([`node:crypto`](https://nodejs.org/api/crypto.html)) — a detail that turns a
> verification helper into a 500 when an attacker sends a short signature.
> Signature schemes themselves are per-provider; nothing here is a standard.

## Receive

1. `express.raw` on the webhook path (Phase 3)  
2. Verify HMAC (or provider scheme) with `crypto.timingSafeEqual`  
3. Reject old timestamps (replay window)  
4. Persist event id for dedupe  
5. Enqueue work; respond quickly  

## Deliver

Fire-and-forget from the route is a bug under load. Use Node Phase 7 jobs;
Express only accepts the command and returns **202**.

## Mounting raw for one path, JSON for the rest

The ordering problem is the whole setup, and it is why webhook routes are usually
the first thing mounted:

```js
// raw ONLY on the webhook path, and before any JSON parser
app.post(
  '/webhooks/stripe',
  express.raw({type: 'application/json'}),   // widen `type` — see the Verified note
  verifySignature,
  handleEvent,
);

app.use(express.json());                     // everything else, mounted after
```

If `express.json()` is mounted globally above this route, it consumes the stream
first and `req.body` arrives as a parsed object. Re-serialising it does **not**
reproduce the original bytes — key order, whitespace and number formatting are all
free to differ — so the signature fails and the cause is invisible from the error.

## Verifying safely

Three mistakes turn a signature check into decoration:

```js
import {createHmac, timingSafeEqual} from 'node:crypto';

function verify(rawBody, header, secret) {
  const expected = createHmac('sha256', secret).update(rawBody).digest();
  const received = Buffer.from(header, 'hex');

  // 1. length check FIRST — timingSafeEqual throws on a length mismatch
  if (received.length !== expected.length) return false;

  // 2. constant-time compare — never ===, which short-circuits on the first byte
  return timingSafeEqual(expected, received);
}
```

1. **Length before compare.** `timingSafeEqual` throws when the buffers differ in
   length, so an attacker sending a two-character signature causes a 500 rather
   than a rejection — and a 500 often means a retry, which means load.
2. **Constant time.** `===` on strings returns early at the first differing byte,
   which leaks how much of a guess was right.
3. **Reject old timestamps.** A signature stays valid forever unless the payload
   includes a timestamp that you check against a window (five minutes is typical).
   Without it, a captured request can be replayed indefinitely — the signature is
   still perfectly valid.

Dedupe on the provider's event id as well. Providers retry on timeouts, and *at
least once* delivery is the norm, so the same valid event will arrive twice.

## Respond fast, work later

A webhook endpoint's contract with the provider is **"received"**, not
**"processed"**. Providers time out in seconds and retry on anything slow or
non-2xx, so processing inline creates a failure loop: slow handler → provider
timeout → retry → more load → slower.

Verify, persist the event, enqueue, return 202. The actual work belongs in a job
([Node Phase 7](../../../nodejs/pages/phase-7-background-work/README.md)). This is
the same argument as outbound delivery below, from the other direction.

## Trade-off

Verify-and-enqueue makes the endpoint fast and the retry story sane, and it is
what providers assume you do. The cost is that a 202 is a promise you have not yet
kept — the provider believes the event was handled, and if your job fails, no
retry is coming from their side. **Once you return 202, the durability is yours**:
the event must be committed before you respond, and the job must have its own
retries and a dead-letter path.

Processing inline keeps the provider's retry as a free safety net, and works fine
for genuinely trivial handlers. It stops working the moment the handler touches
something slow, and the transition is not graceful.

## Gotchas

**Symptom:** Signature verification fails for every event, on a correct secret  
**Cause:** `express.json()` mounted above the webhook route consumed the stream, so
verification ran over re-serialised JSON  
**Fix:** Mount `express.raw` on the webhook path, before any global JSON parser

**Symptom:** `express.raw` yields an empty body  
**Cause:** Its `type` defaults to `application/octet-stream`; the provider sends
`application/json`  
**Fix:** `express.raw({type: 'application/json'})`

**Symptom:** A malformed signature returns 500 instead of 401  
**Cause:** `timingSafeEqual` throws when buffer lengths differ  
**Fix:** Compare lengths first and return false

**Symptom:** The same event is processed twice  
**Cause:** At-least-once delivery — providers retry on timeouts  
**Fix:** Store the provider's event id and make handling idempotent
([page 06](06-idempotency-keys.md))

**Symptom:** An old captured request is accepted months later  
**Cause:** No timestamp window — the signature never expires on its own  
**Fix:** Reject events outside a few minutes' skew, and include the timestamp in the
signed payload

**Symptom:** The provider disables your endpoint for being unreliable  
**Cause:** Inline processing exceeding their timeout, or a large body exceeding the
`100kb` default limit  
**Fix:** Verify, persist, enqueue, 202 — and raise `limit` deliberately for providers
that send large payloads

## Interview questions

**★ Why raw body for verification?**  
Signature is over exact bytes, not re-serialized JSON.

**★ Why does mount order decide whether webhooks work at all?**  
Because the first matching body parser consumes the stream. A global
`express.json()` above the route leaves you with a parsed object, and re-serialising
it cannot reproduce the original bytes — key order and formatting are not guaranteed.

**★ What goes wrong with `timingSafeEqual` on an attacker-supplied signature?**  
It throws when the buffers differ in length, so a short signature produces a 500
instead of a rejection — and providers retry 5xx, so the attacker gets amplification
for free. Compare lengths first.

**Why is a valid signature not sufficient?**  
It never expires. Without a timestamp check, a captured request replays forever.
Verify the signature *and* a freshness window, and dedupe on the event id.

**Why return 202 rather than processing inline?**  
The provider's contract is "received". They time out in seconds and retry, so a slow
handler creates a retry storm. Verify, persist, enqueue, respond — but note that once
you return 202 the durability is entirely yours.

**What does at-least-once delivery mean for your handler?**  
That it will see duplicates and must be idempotent. Dedupe on the provider's event id
rather than assuming each event arrives once.


---

← Prev: [OpenAPI](08-openapi.md) · Next → [PATCH and bulk](10-patch-and-bulk.md)
