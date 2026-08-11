---
title: "Outbound side-effects as jobs — email, webhooks, notifications"
sidebar_label: "09 · Outbound side-effects"
sidebar_position: 9
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 on **Node 24.19.0** — the queue mechanics on this page are the ones
> measured in pages [02](./02-job-queues.md), [04](./04-retries-and-stalled-jobs.md)
> and [06](./06-transactional-outbox.md).

**Every call that leaves your process to a system you do not control belongs on the
queue.** Email, SMS, push, webhooks, CRM syncs, Slack alerts. Not because they are
slow — because their availability becomes yours the moment they are in the request
path. This is the pattern; it is not a tour of any vendor's SDK.

## The rule

```js
// no
app.post('/orders', async (req, res) => {
  const order = await orders.create(req.body);
  await sendgrid.send({to: order.email, template: 'receipt', data: order});   // ← their uptime, your endpoint
  res.status(201).json(order);
});
```

```js
// yes
app.post('/orders', async (req, res) => {
  const order = await orders.createWithOutboxEvent(req.body);   // one transaction — page 06
  res.status(201).json(order);
});
```

Three things go wrong with the first version, and only the first is about latency:

1. **Their p99 is your p99.** An email API that occasionally takes 4 seconds makes
   checkout occasionally take 4 seconds.
2. **Their outage is your outage.** They 503; your checkout 500s, for an order that was
   already created and paid for.
3. **There is no retry.** The one attempt you get is inside a request nobody will
   repeat.

## The four properties an outbound job needs

**Idempotent, keyed by the domain** ([page 05](./05-job-idempotency.md)). Retries and
redelivery are guaranteed, and "we emailed the customer four times" is a support
ticket:

```js
const key = `order-receipt:${orderId}`;
```

Use the provider's own support where it exists — most payment and messaging APIs take
an idempotency key or an explicit message id — because that closes the window your own
table cannot.

**Bounded** ([page 12](./12-timeout-budgets.md)). A hung outbound call holds a worker
slot until the visibility timeout, then the job runs again while the first is still
hanging:

```js
const res = await fetch(url, {
  method: 'POST',
  body: JSON.stringify(payload),
  headers: {'content-type': 'application/json', 'idempotency-key': key},
  signal: AbortSignal.timeout(10_000),
});
```

**Classified.** A 4xx from a provider will be a 4xx forever — a malformed address, an
unsubscribed recipient. Fail it permanently instead of burning five attempts
([page 14](./14-retry-safe-failures.md)):

```js
if (res.status === 429 || res.status >= 500) throw new Error(`transient ${res.status}`);
if (!res.ok) throw new UnrecoverableError(`permanent ${res.status}: ${await res.text()}`);
```

**Recorded.** Write down what you sent and when, in your own database — not because the
provider lacks a dashboard, but because "did the customer get the receipt?" is a
question you must answer from your own data, and because that record *is* the
idempotency guard.

## Webhooks you send are the hard case

Outbound webhooks are the one place where the naive version fails fastest, because the
receiver is someone else's laptop-grade endpoint.

- **Sign the payload.** HMAC over the body with a per-subscriber secret, plus a
  timestamp so a captured request cannot be replayed. Phase 8 covers the crypto.
- **One job per subscriber**, never one job that loops over subscribers. Otherwise one
  slow receiver delays everyone else's delivery and a retry re-sends to subscribers who
  already got it.
- **Include an event id** and let receivers deduplicate — you are asking them to be
  idempotent for exactly the reasons on [page 05](./05-job-idempotency.md).
- **Retry generously, then disable.** A partner down for two hours deserves retries
  over hours; an endpoint 404ing for a week should be switched off with a notification,
  not retried forever.
- **Never follow redirects to internal addresses.** A subscriber URL is user-controlled
  input, and an unvalidated one is SSRF — Phase 8.

## Fan-out

"Notify everyone" is one job that enqueues N jobs, not one job that does N things:

```js
// dispatcher — cheap, fast, retry-safe
new Worker('order.paid', async (job) => {
  const subs = await subscriptions.forEvent('order.paid');
  for (const s of subs) {
    await deliveries.add('deliver', {subscriptionId: s.id, orderId: job.data.orderId},
      {jobId: `deliver:${s.id}:${job.data.orderId}`});
  }
}, {connection});
```

One failing subscriber then fails one job. A single job looping over 500 subscribers
fails as a unit, and its retry re-delivers to the 400 that already succeeded.

## Testing without sending anything

The provider call belongs behind one function, for the same reason database calls do
([Phase 6, page 10](../phase-6-data-access/10-repository-pattern.md)):

```js
export function makeMailer(client) {
  return {sendReceipt: (to, order) => client.send({to, template: 'receipt', data: order})};
}
```

The handler takes `{mailer}` and the test passes a fake. No SDK in your domain code, no
network in your unit tests, and swapping providers touches one file.

## Gotchas

**Symptom:** Checkout fails when the email provider is down
**Cause:** The provider call is in the request path.
**Fix:** Queue it; the order does not depend on the email.

**Symptom:** Customers receive four copies of one email
**Cause:** Retries or redelivery of a non-idempotent send.
**Fix:** Domain-derived key, a `sent` record checked first, and the provider's
idempotency key.

**Symptom:** Worker slots exhausted, queue backing up
**Cause:** Outbound calls with no timeout, hanging.
**Fix:** `AbortSignal.timeout` on every outbound call.

**Symptom:** A malformed address retries five times
**Cause:** 4xx treated as transient.
**Fix:** Classify: 429 and 5xx retry, other 4xx fail permanently.

**Symptom:** One slow webhook subscriber delays all deliveries
**Cause:** One job looping over subscribers.
**Fix:** Fan out to one job per subscriber.

**Symptom:** "Did we send it?" cannot be answered
**Cause:** No local record; only the provider knows.
**Fix:** Record every send in your own database — it doubles as the idempotency guard.

**Symptom:** A webhook URL reaches an internal service
**Cause:** User-supplied URL, unvalidated, redirects followed.
**Fix:** Validate and pin the destination; do not follow redirects. Phase 8.

## Interview questions

**★ Why do outbound calls belong on a queue?**
Because a third party's latency and availability become yours in the request path.
Queuing decouples them: their outage delays a job instead of failing a checkout, and
the job gets retries the request never could.

**★ What makes an outbound job correct rather than just asynchronous?**
Four things: idempotent on a domain-derived key (with the provider's idempotency
support where it exists), bounded by a timeout, error-classified so permanent failures
do not retry, and recorded locally so you can answer what was sent.

**★ How do you send webhooks to many subscribers?**
A dispatcher job that enqueues one delivery job per subscriber, each with a derived
`jobId`. One job looping over all of them fails as a unit and re-delivers to
subscribers that already succeeded on retry.

**★ Which outbound failures should be retried?**
429 and 5xx — transient. Other 4xx are permanent: a malformed address or a rejected
payload will fail identically forever, so they should go to the dead-letter queue on
the first failure.

**How do you test code that sends email?**
Put the provider behind one small module and inject it, then pass a fake in tests. The
SDK never appears in domain code, unit tests never touch the network, and changing
provider is a one-file change.

**What is special about webhooks you send?**
The destination is user-controlled input, so it is an SSRF vector and must be validated
and never redirect-followed; the payload needs signing with a timestamp so it cannot be
forged or replayed; and receivers need an event id so they can deduplicate the
retries you will inevitably send.

---

← Prev: [Scheduled and recurring jobs](./08-scheduled-jobs.md) · Next → [Time on the server](./10-time-on-the-server.md)
