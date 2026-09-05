---
title: "An HTTP call cannot join your transaction, so a request that times out has an unknown outcome rather than a failed one — and treating unknown as failed is the single line of reasoning that produces double charges"
sidebar_label: "04ea · External effects"
sidebar_position: 236
description: "Why external side effects break the dedupe-table pattern, provider idempotency keys and their expiry window, reconciliation when the provider has no key, email, and the obligations you owe your own webhook consumers."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against the Stripe API reference
> [Idempotent requests](https://docs.stripe.com/api/idempotent_requests) (fetched
> 2026-09-05; every rule below is quoted verbatim from it) and
> [Vercel · Queues concepts](https://vercel.com/docs/queues/concepts).
> Documentation-verified, **no sandbox run, no live API calls**.
> Target: **PostgreSQL 18.4** · Node 24.20.0 · Next.js 16.3.4.

**[04e](04e-at-least-once-and-idempotency.md) solves duplicate protection for effects your database can see: the key and the effect commit together, so no crash can separate them. That entire argument collapses the moment the effect is an HTTP call, because a payment provider cannot participate in your `COMMIT`. What you are left with is a window you cannot close from your side — and the specific way people lose money in that window is by treating a request that *timed out* as a request that *failed*. It did not fail. Its outcome is unknown, and the only three things that resolve an unknown are the provider's own idempotency key, a reconciliation query, or a human. This page is those three, in that order of preference.**

## Why the dedupe table stops working

```ts
// ❌ The shape that looks right and is not.
await client.query('BEGIN')
const claim = await client.query(CLAIM_KEY, [key, 'order.charge'])
if (claim.rowCount === 0) { await client.query('ROLLBACK'); return 'duplicate' }
await stripe.charges.create({ amount, currency: 'usd', customer })  // ⟵ outside the DB
await client.query('COMMIT')
```

Trace the failure: the charge succeeds, the process dies before `COMMIT`, the dedupe key is rolled back. The next delivery sees no key, charges again. Reverse the order — commit the key first, then charge — and a crash between them leaves a key asserting a charge that never happened, so the customer is never billed and nothing ever notices.

**There is no ordering of a database transaction and an external call that is safe**, which is the dual-write problem of [04c](04c-the-anatomy-of-a-job.md) with the second system replaced by a stranger's API. The difference is that here you cannot move the queue into the other system. You can only make the *other side* recognise a repeat.

## The three outcomes of an HTTP call

| Response | Outcome | Correct action |
|---|---|---|
| `2xx` | Succeeded | Record it, ack |
| `4xx` (validation, not rate limit) | Failed, permanently | Dead-letter — the same request will never succeed |
| `429`, `5xx`, connection reset, **timeout** | **Unknown** | Retry *with the same idempotency key*, or reconcile |

🔴 The third row is one row for a reason. A timeout and a connection reset are not failures; they are the absence of information. The request may have been received, executed and answered, with only the answer lost. Code that reads `catch (e) { return retry() }` has silently converted "I don't know" into "it didn't happen", and it is correct for a `429` and catastrophic for a timeout on `POST /charges`.

## Technique 1 — the provider's idempotency key

This is the only mechanism that genuinely closes the window, and when a provider offers it, everything else on this page is a fallback.

> *"The API supports idempotency for safely retrying requests without accidentally performing the same operation twice. When creating or updating an object, use an idempotency key. Then, if a connection error occurs, you can safely repeat the request without risk of creating a second object or performing the update twice."*
> *"Stripe's idempotency works by saving the resulting status code and body of the first request made for any given idempotency key, regardless of whether it succeeds or fails. Subsequent requests with the same key return the same result, including 500 errors."*
> — [Stripe API · Idempotent requests](https://docs.stripe.com/api/idempotent_requests)

Note the second sentence carefully: **the saved result includes failures.** Retrying with the same key after a `500` returns you the same `500`, forever. The key makes the operation repeatable, not successful — so a genuine retry of a genuinely failed request needs a *new* key, and distinguishing those two cases is your job.

```ts
// lib/jobs/handlers/charge-order.ts
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function chargeOrder(order: { id: string; amountCents: number; customerId: string }) {
  // 🔴 DETERMINISTIC. Derived from the business fact, not from the attempt.
  // `crypto.randomUUID()` here would defeat the entire mechanism, because
  // every retry would carry a fresh key and create a fresh charge.
  const idempotencyKey = `charge:${order.id}`

  const charge = await stripe.charges.create(
    { amount: order.amountCents, currency: 'usd', customer: order.customerId },
    { idempotencyKey },
  )
  return charge.id
}
```

The rules the provider states, each with a consequence you must design around:

> *"A client generates an idempotency key, which is a unique key that the server uses to recognize subsequent retries of the same request. How you create unique keys is up to you, but we suggest using V4 UUIDs, or another random string with enough entropy to avoid collisions. Idempotency keys are up to 255 characters long."*

A random UUID is only correct if you **persist it with the job** at enqueue time, so every attempt reuses it. If you generate it inside the handler, it is new on every attempt and the header does nothing. A deterministic business-derived key avoids the storage entirely and is usually the better choice.

> *"Avoid using sensitive data (for example, email addresses or personal identifiers) as idempotency keys."*

So `` `charge:${customerEmail}` `` is wrong on two counts — it leaks PII into the provider's logs *and* it is not unique per order.

> 🔴 *"You can remove keys from the system automatically after they're at least 24 hours old. We generate a new request if a key is reused after the original is pruned."*

**This is the interaction nobody checks.** If your retry schedule can deliver an attempt more than 24 hours after the first, the key has expired on their side and your "idempotent" retry creates a second charge. Your `max_attempts` × backoff must fit inside the provider's key window, or the tail attempts must be routed to a human instead. Concretely: with the `5 · 2^n` schedule capped at an hour from [04db](04db-backoff-dead-letters-and-pruning.md), ten attempts stay comfortably inside a day; twenty do not.

> *"The idempotency layer compares incoming parameters to those of the original request and errors if they're not the same to prevent accidental misuse."*

So the key must vary with the parameters. If a job's payload can change between attempts — a price recalculated, a currency corrected — the key must incorporate whatever changed, or you will get an error instead of either behaviour.

> *"We save results only after the execution of an endpoint begins. If incoming parameters fail validation, or the request conflicts with another request that's executing concurrently, we don't save the idempotent result because no API endpoint initiates the execution. You can retry these requests."*

A concurrency conflict on the same key is explicitly **retryable** — which is exactly what happens when a lease expires and two workers hit the provider with the same key at once. Treat it as transient, not permanent.

> *"All POST requests accept idempotency keys. Don't send idempotency keys in GET and DELETE requests because it has no effect. These requests are idempotent by definition."*

## Technique 2 — reconcile, when there is no key

Many APIs — internal services, older SaaS, most email providers — have no idempotency mechanism. The fallback is to make the *effect itself* findable, then ask.

The pattern has two halves. First, stamp every outbound call with your own reference in whatever metadata field the API offers:

```ts
await provider.createInvoice({
  amountCents,
  // Almost every API has SOME free-text or metadata field. Use it.
  externalReference: `order:${order.id}`,
})
```

Second, before retrying an *unknown* outcome, search for it:

```ts
// lib/jobs/handlers/create-invoice.ts
export async function createInvoiceIdempotently(order: { id: string; amountCents: number }) {
  const reference = `order:${order.id}`

  // 1. Has a previous attempt already succeeded, unknown to us?
  const existing = await provider.findInvoices({ externalReference: reference })
  if (existing.length > 0) return existing[0].id

  // 2. No. Attempt it.
  try {
    const invoice = await provider.createInvoice({ amountCents: order.amountCents, externalReference: reference })
    return invoice.id
  } catch (error) {
    if (isUnknownOutcome(error)) {
      // 3. Do NOT blindly retry. Re-run the search on the next attempt,
      //    after the backoff, by rethrowing as transient.
      throw new TransientJobError('invoice outcome unknown; will reconcile on retry')
    }
    throw error
  }
}
```

⚠️ **This is narrower than an idempotency key, and you should say so out loud when you choose it.** The search-then-create sequence has its own race: two workers can both search, both find nothing, and both create. It reduces the probability of a duplicate; it does not eliminate one. Combine it with a lease long enough that concurrent workers are rare, a dedupe row that stops your *own* double-enqueue, and a reconciliation sweep that catches what slips through.

## Technique 3 — record the attempt, reconcile out of band

For high-value effects, keep a local record of every external call so that a human, or a sweep, can settle the unknowns.

```sql
CREATE TABLE external_calls (
  key            text PRIMARY KEY,          -- 'charge:ord_8812'
  provider       text        NOT NULL,
  status         text        NOT NULL,      -- 'attempting' | 'succeeded' | 'failed' | 'unknown'
  provider_ref   text,                      -- their id, once known
  request_digest text        NOT NULL,      -- so a changed payload is detectable
  attempted_at   timestamptz NOT NULL DEFAULT now(),
  settled_at     timestamptz
);
```

The sequence — and every step is a separate transaction, deliberately:

1. `INSERT … ON CONFLICT DO NOTHING` the row as `attempting`, and **commit**. This is the one case where committing before the effect is right: the row is not a claim that the work was done, it is a claim that the work was *started*, which is exactly what you want to survive a crash.
2. Make the call with the deterministic key.
3. Commit the outcome — `succeeded` with `provider_ref`, `failed`, or `unknown`.

A row left in `attempting` after a crash is a **known unknown**, which is enormously better than an absent row. A sweep can list them, query the provider, and settle each one:

```sql
SELECT key, provider, attempted_at FROM external_calls
 WHERE status IN ('attempting', 'unknown')
   AND attempted_at < now() - interval '15 minutes'
 ORDER BY attempted_at;
```

🔴 **Alert on that query returning rows.** An unsettled external call is money in an indeterminate state, and it is the only class of failure on these pages where the correct escalation is a person rather than a retry.

## Email, specifically

SMTP has no idempotency key, and most transactional email APIs do not offer one either. What you can do:

- **Dedupe on your side** with [04e](04e-at-least-once-and-idempotency.md)'s table, keyed on the business fact — `` `receipt:${orderId}` `` — accepting that the residual window is "sent, then crashed before the key committed".
- **Make the send the last thing** in the handler and the key commit the first, so the residual failure is a *missing* email rather than a duplicate one — then let a reconciliation sweep find receipts with no `sent_at` and re-send. A missing receipt is a support ticket; a duplicate receipt at 3am is a trust problem.
- **Use the provider's own message id** if it offers one at request time, and store it, so a retry can ask "did this go out?" before sending.

There is no configuration that makes email exactly-once. Choose which side to fail on, deliberately, and write the choice down.

## The obligation you owe your own consumers

If your jobs deliver outbound webhooks, you are now the at-least-once producer and someone else has this problem. Give them what you would want:

```ts
await fetch(subscriber.url, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    // A stable id per EVENT — identical across every delivery attempt.
    'x-event-id': event.id,
    'x-event-type': event.type,
    'x-signature': sign(body, subscriber.secret),
  },
  body,
})
```

The same applies to your internal service APIs: **accept an `Idempotency-Key` header on every non-`GET` endpoint that a background job will call**, and implement it with [04e](04e-at-least-once-and-idempotency.md)'s dedupe table. It costs one table and it removes this entire page's difficulty for every caller you own.

## Gotchas

**★ Symptom: a customer is charged twice and the logs show a timeout on the first attempt.** Cause: the handler caught the timeout and retried with a fresh idempotency key — or with none — because a timeout was classified as a failure. It is not a failure; the outcome is unknown and the charge may well have gone through. Fix: classify timeouts and connection resets as *unknown*, and retry only with the identical deterministic key:

```ts
const idempotencyKey = `charge:${order.id}`   // stable across every attempt
```

**★ Symptom: the idempotency key is present, and duplicates still happen.** Cause: the key is generated inside the handler with `crypto.randomUUID()`, so every attempt sends a different one and the provider sees unrelated requests. Fix: derive it from the business fact, or generate it once at enqueue time and store it in the job payload so all attempts share it.

**★ Symptom: a duplicate charge appears only for jobs that failed for a long time.** Cause: the provider prunes keys — Stripe *"can remove keys from the system automatically after they're at least 24 hours old"* and *"generates a new request if a key is reused after the original is pruned."* Your retry budget outlived their key. Fix: cap the total retry window for external-effect jobs below the provider's key lifetime, and dead-letter into a human queue rather than retrying past it:

```sql
-- Charges get a tight budget; the tail is a person's decision, not a retry.
UPDATE jobs SET max_attempts = 8 WHERE kind = 'order.charge';
```

**★ Symptom: retrying with the same key keeps returning the same `500`, and the job never succeeds.** Cause: working as documented — *"Subsequent requests with the same key return the same result, including 500 errors."* The provider is replaying the stored failure, not re-executing. Fix: distinguish "retry the same operation" from "attempt the operation again". The first uses the same key and is for unknown outcomes; the second needs a new key and is a deliberate decision, usually after a human has confirmed nothing happened.

**★ Symptom: the provider returns an error saying the parameters do not match the original request.** Cause: *"The idempotency layer compares incoming parameters to those of the original request and errors if they're not the same."* The payload changed between attempts — a recalculated amount, a corrected currency, an added metadata field. Fix: either freeze the request body at enqueue time by snapshotting it into the payload ([04c](04c-the-anatomy-of-a-job.md)), or incorporate a digest of the body into the key so a changed body is a different operation.

**Symptom: two workers hit the provider with the same key simultaneously and one gets a conflict error.** Cause: lease expiry produced concurrent delivery, and the provider does not save a result for a request that *"conflicts with another request that's executing concurrently"*. Fix: it is documented as retryable — *"You can retry these requests"* — so classify it transient and let the backoff handle it. The deeper fix is a lease longer than the call's p99, per [04da](04da-leases-and-the-claim-lifetime.md).

**Symptom: an internal service is called twice by a job and creates two records.** Cause: you own both sides and neither implements idempotency, because "it's internal". Internal calls have exactly the same timeout semantics as external ones. Fix: accept an `Idempotency-Key` header on the internal endpoint and back it with the dedupe table from [04e](04e-at-least-once-and-idempotency.md). This is a one-afternoon change that removes the problem permanently for every future caller.

**Symptom: rows sit in `external_calls` with status `attempting` and nobody noticed for a week.** Cause: the table was built and never alerted on. An unsettled external call is the highest-severity state in the whole system and it is silent by default. Fix: alert on the age of the oldest unsettled row, not on a count, and treat a page as the correct response.

**Symptom: reconciliation-by-search creates duplicates under load.** Cause: search-then-create is not atomic; two workers can both search, both find nothing, and both create. Fix: acknowledge the limit rather than papering over it — this technique reduces duplicates, it does not remove them. Add a lease long enough to make concurrent delivery rare, and prefer a provider that supports idempotency keys when the effect is expensive enough to matter.

## Interview questions

**★ A `POST /charges` times out. What is the correct next step, and what is the common wrong one?**
The correct step is to treat the outcome as unknown and re-issue the *identical* request with the *identical* idempotency key, so the provider can recognise it as a repeat and return the original result rather than performing a second charge. The common wrong step is to treat the timeout as a failure and retry as if nothing happened — often with a freshly generated key, because the key is created inside the handler. A timeout tells you only that no response arrived; the request may have been received, executed and answered with the response lost on the way back. Any code path that maps "no response" to "did not happen" will eventually double-charge, and it will do so during exactly the network conditions where it is hardest to notice.

**★ Why does an idempotency key have to be deterministic, and where should it come from?**
Because its entire function is to let the provider recognise two requests as the same operation, which it cannot do if the two carry different keys. A key generated per attempt is indistinguishable from no key at all. It should be derived from the business fact the request represents — `charge:ord_8812` — so that every retry, every redelivery, and even a second job created by a double-clicked button all produce the same key. The alternative is to generate a random key once at enqueue time and persist it in the job payload so all attempts share it; that is equally correct and necessary when no stable business identifier exists. What is never correct is generating it at the point of the call.

**★ Why can the dedupe table not protect an external call the way it protects a database write?**
Because its guarantee comes from sharing a transaction with the effect, and an HTTP call cannot be in a transaction. With a database write, the key and the effect commit atomically, so no crash can produce a state where one exists without the other. With an HTTP call, whichever you commit first defines your failure mode: key first gives you silent losses, effect first gives you duplicates, and there is no third ordering. The best you can do locally is record that an attempt was *started*, which converts an invisible unknown into a visible one that a sweep or a human can settle. Actually closing the window requires cooperation from the other side, which is what a provider idempotency key is.

**★ Stripe replays the stored result for a reused key "including 500 errors". Why is that the right design, and what does it force you to handle?**
It is right because the guarantee being offered is "this key corresponds to exactly one execution", and replaying only successes would break it — a client retrying after a failed execution would trigger a second execution under the same key, which is precisely the thing the key exists to prevent. It forces you to separate two intentions that look the same in code. "The outcome was unknown, tell me what happened" reuses the key and is safe to automate. "That attempt genuinely failed, try the whole thing again" needs a new key, and because a new key means a new execution, it should usually be a deliberate decision rather than something a retry loop does on its own.

**★ What is the interaction between your retry budget and the provider's key expiry, and how do you get it wrong?**
The provider only remembers a key for a bounded period — Stripe documents removal *"after they're at least 24 hours old"* and states that a key reused after pruning generates a new request. So an idempotency key only protects retries that happen inside that window. You get it wrong by setting a generous `max_attempts` with exponential backoff, feeling safe because the header is present, and then having attempt fourteen land thirty hours later against a forgotten key — which the provider treats as a brand new charge. The fix is arithmetic, not vigilance: sum your backoff schedule, confirm the total is comfortably inside the provider's window, and make the last attempt dead-letter to a human rather than extend past it.

**Your provider has no idempotency mechanism at all. What do you actually build?**
Three things, and you say clearly that together they narrow the window rather than close it. First, stamp every request with your own reference in whatever metadata field exists, so the effect is findable afterwards. Second, before retrying an unknown outcome, search for that reference and adopt the existing object if it is there. Third, keep a local `external_calls` row written *before* the call, so a crash leaves a durable "we started this" marker that a reconciliation sweep can pick up and settle, with an alert on anything unsettled beyond a few minutes. The honest framing for a design review is that this converts a silent duplicate into a visible unknown, and that for effects expensive enough to matter, the right answer may be to choose a provider that supports keys.

**You are the one sending webhooks now. What do you owe your consumers?**
A stable event id that is identical across every delivery attempt, sent in a header they can read without parsing the body, so they can implement the dedupe table on their side. A signature, so they can trust it. A documented statement that delivery is at-least-once and that ordering is not guaranteed, because otherwise they will assume both. And ideally a replay endpoint, so a consumer that lost a window of events can recover without contacting you. The same obligations apply to your own internal service APIs — accepting an `Idempotency-Key` header on every non-`GET` endpoint costs one table and removes this whole class of problem for every job that calls it.

---

← [04e · At-least-once and the dedupe table](04e-at-least-once-and-idempotency.md) · Next → [04f · Waking the worker](04f-waking-the-worker.md)
