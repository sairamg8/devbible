---
title: "Outbound client discipline"
sidebar_label: "08 · Outbound client discipline"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS).

**Every platform calls a payment provider, an email service and an SMS gateway.
None of them are always up. The discipline is the same for all three: one shared
client, a deadline, bounded retries with backoff, `Retry-After` honoured, and an
idempotency key on anything that spends money.**

This page is the calling side. The receiving side — being a good upstream —
is Phase 7.

## One client per dependency

```js
// clients/payments.js — constructed once, at module load
import { Agent, fetch } from 'undici';        // undici's fetch: the per-call
                                              // dispatcher option, page 07
const dispatcher = new Agent({ connections: 16, keepAliveTimeout: 10_000 });
const BASE = process.env.PAYMENTS_URL;

export function paymentsFetch(path, init = {}, deadline) {
  return fetch(`${BASE}${path}`, {
    ...init,
    dispatcher,
    signal: deadline ?? AbortSignal.timeout(5000),
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${process.env.PAYMENTS_KEY}`,
      'user-agent': `orders-api/${process.env.APP_VERSION}`,
      ...init.headers,
    },
  });
}
```

A shared module gives you one place for the pool bound, the auth header, the
default deadline and the metrics — and it means a burst of payment traffic
cannot exhaust the connections your email client needs
([page 07](07-keep-alive-and-agents.md)). A `user-agent` naming your service and
version is what lets the provider tell you which deploy started misbehaving.

## Retry only what is safe to retry

| Outcome | Retry? |
|---|---|
| `ECONNREFUSED`, `ENOTFOUND`, `ECONNRESET` before any byte was sent | ✅ nothing happened |
| 502 / 503 / 504 | ✅ upstream says it did not process this |
| 429 | ✅ **after** `Retry-After` |
| Timeout on a **read** (GET) | ✅ |
| Timeout on a **write** (POST/PATCH) | ⚠️ only with an idempotency key — the state is *unknown*, not failed |
| 400, 401, 403, 404, 409, 422 | ❌ retrying cannot change the answer |

Retrying a 4xx is pure load. Retrying a non-idempotent write without a key is how
a customer gets charged twice.

## Backoff, and honouring `Retry-After`

```js
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const backoff = (n) => Math.round((2 ** n) * 100 * (0.5 + Math.random()));   // jitter

async function call(url, options = {}, { retries = 3, deadlineMs = 5000 } = {}) {
  const deadline = AbortSignal.timeout(deadlineMs);
  for (let attempt = 0; ; attempt++) {
    let res;
    try {
      res = await fetch(url, { ...options, signal: AbortSignal.any([deadline, AbortSignal.timeout(2000)]) });
    } catch (err) {
      if (attempt >= retries || deadline.aborted) throw err;
      await sleep(backoff(attempt)); continue;
    }
    if (res.status === 429 || res.status >= 500) {
      if (attempt >= retries) return res;
      const after = Number(res.headers.get('retry-after'));
      await res.body.cancel();                                   // release the connection
      await sleep(Number.isFinite(after) && after > 0 ? after * 1000 : backoff(attempt));
      continue;
    }
    return res;
  }
}
```

```console
$ node retry.mjs
  attempt 1: 429, honouring Retry-After -> waiting 1000 ms
  attempt 2: 429, honouring Retry-After -> waiting 1000 ms
flaky -> 200 "ok after 3 attempts" in 2056 ms
```

Four things that code does deliberately:

- **Jitter.** `0.5 + Math.random()` spreads retries. Without it, every instance
  that failed at the same moment retries at the same moment, and the upstream's
  recovery is met with a synchronised thundering herd.
- **An overall deadline**, checked between attempts, so three retries cannot
  outlive the caller's budget ([page 06](06-outbound-timeouts.md)).
- **`res.body.cancel()` before sleeping.** A discarded 429 response still holds a
  pooled connection until its body is consumed.
- **`Retry-After` wins over the computed backoff.** It is the upstream telling you
  when it will be ready; ignoring it is how a rate limit becomes a ban. It may
  also be an HTTP date rather than seconds — parse both if the provider sends them.

Retries multiply load exactly when a dependency is least able to take it. Three
attempts is a normal ceiling; beyond that, fail and let the caller decide. When
retries stop helping at all, the answer is a circuit breaker — Phase 7.

## Idempotency keys

```js
const key = crypto.randomUUID();               // per logical operation, NOT per attempt
const opts = {
  method: 'POST',
  headers: { 'Idempotency-Key': key, 'content-type': 'application/json' },
  body: JSON.stringify({ amount: 4200 }),
};
```

```console
$ node retry.mjs
charge 1 -> 201 {"chargeId":"ch_1","amount":4200} | replay: null
charge 2 -> 200 {"chargeId":"ch_1","amount":4200} | replay: true
charge 3 -> 201 {"chargeId":"ch_2","amount":4200} | replay: null
```

The second call carries the same key and gets the **same `chargeId`** back rather
than creating a second charge. The third uses a fresh key and creates a real
second charge. Stripe, Adyen and every serious payment API implement this; use it.

The rule that gets broken: **generate the key once per logical operation and reuse
it across every retry.** A key regenerated inside the retry loop makes each attempt
a distinct operation, which is the exact bug the mechanism exists to prevent. Store
it with the work — if the operation is driven by a job, the key belongs in the job
row, so a redelivery three hours later still deduplicates.

For providers without idempotency support, the fallback is to record your intent
first (a row with a unique constraint), call, then record the outcome — the
transactional outbox pattern, Phase 7.

## Failing well

- **Do not call third parties on the request path** when you can avoid it. Sending
  a receipt email is a job, not part of the checkout response — the customer's
  purchase should not fail because a mail provider is slow.
- **Log `err.cause?.code` and the status**, or every outage looks like
  `TypeError: fetch failed` ([page 05](05-fetch.md)).
- **Have a defined behaviour when the dependency is down** — degrade, queue, or
  refuse — and decide it before the incident.

## Gotchas

**Symptom:** A customer is charged twice after a network blip
**Cause:** A timed-out POST was retried without an idempotency key, or with a new
key per attempt.
**Fix:** One key per logical operation, persisted with the work.

**Symptom:** An upstream recovers, then immediately falls over again
**Cause:** Synchronised retries with no jitter.
**Fix:** Randomised exponential backoff.

**Symptom:** A rate limit escalates to a temporary ban
**Cause:** `Retry-After` ignored.
**Fix:** Honour it, and treat it as authoritative over your backoff.

**Symptom:** Retrying a 404 or 422 forever
**Cause:** Retry logic keyed on "not 2xx".
**Fix:** Retry only 429, 5xx and transport errors.

**Symptom:** Connection count climbs during an upstream incident
**Cause:** Discarded error responses whose bodies were never consumed.
**Fix:** `res.body.cancel()` on every path that abandons a response.

**Symptom:** Checkout fails whenever the email provider is slow
**Cause:** A non-essential third-party call on the request path.
**Fix:** Enqueue it.

## Interview questions

**★ Which failures are safe to retry?**
Transport failures where nothing was sent, 502/503/504, and 429 after its
`Retry-After`. Reads are always safe. A write that timed out is *unknown* — it may
have succeeded — so it is only retryable behind an idempotency key. 4xx other than
429 is never retryable, because the request itself is the problem.

**★ What is an idempotency key and where does it come from?**
A caller-generated unique value sent with a write, which the provider uses to
deduplicate. It must be generated once per logical operation and reused across
every retry — verified above: the same key returned the same `chargeId`, a fresh
key created a second charge. Regenerating it per attempt defeats the whole thing.

**★ Why does backoff need jitter?**
Because failures are correlated. Every instance that hit the outage retries on the
same schedule, so a deterministic backoff produces synchronised bursts precisely
as the upstream is recovering. Randomising spreads them.

**★ Why should retries share one deadline?**
Otherwise three attempts at 5 s each is a 15 s worst case, long after the caller
gave up. Check the overall deadline between attempts and stop when it has passed.

**Why not call a payment or email provider directly from a request handler?**
Its availability becomes yours. Anything not needed to answer the request belongs
in a queue, where a retry costs a job redelivery rather than a failed checkout.

**What replaces retries when an upstream is properly down?**
A circuit breaker — stop calling, fail fast, probe occasionally. Retrying a dead
dependency adds load to the thing you need to recover.

---

← Prev: [Keep-alive and agents](07-keep-alive-and-agents.md) · Next → [HTTPS and TLS](09-https-and-tls.md)
