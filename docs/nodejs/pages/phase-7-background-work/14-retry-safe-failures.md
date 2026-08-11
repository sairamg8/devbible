---
title: "Retry only safe, transient failures"
sidebar_label: "14 · Retry only what is safe"
sidebar_position: 14
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0**. The database-specific error codes and retry
> loop live in
> [Phase 6, page 14](../phase-6-data-access/14-retry-backoff.md); this page is the
> general rule and the HTTP side.

**Two independent questions, and both must be yes.** Is this failure transient? Is this
operation safe to repeat? Most retry bugs come from answering only the first one.

## The two questions

|  | Safe to repeat | Not safe to repeat |
|---|---|---|
| **Transient** | Retry — the whole point | **Make it idempotent first** |
| **Permanent** | Do not retry — it will fail identically | Do not retry — twice as wrong |

Three of the four squares say *do not retry*. The interesting one is the top right,
and it is where duplicate charges come from.

## Question 1 — is it transient?

A transient failure is one where the *same request*, sent again, might succeed.

**Transient:** connection refused/reset, timeouts, DNS failures, HTTP **429**, HTTP
**502/503/504**, a database serialization failure or deadlock, a leader election in
progress.

**Permanent:** HTTP **400/401/403/404/422**, a unique or check-constraint violation, a
syntax error, a validation failure, a malformed payload. These fail identically forever.

```js
const isTransient = (err) => {
  if (err.name === 'TimeoutError') return true;
  if (['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EPIPE', 'EAI_AGAIN'].includes(err.code)) return true;
  if (err.status === 429 || (err.status >= 500 && err.status <= 599)) return true;
  return false;
};
```

Retrying a permanent failure is not merely useless — it converts a clear, fast error
into a slow, ambiguous one, burns the attempt budget that a real blip would have
needed, and hides the bug. A `422` retried five times over fifteen seconds looks like
an outage in a dashboard.

Two edge cases worth naming: **HTTP 409** is usually your own concurrency conflict —
retry only if you re-read state first, not blindly. And **`ECONNRESET` on a request you
already sent** is transient at the network level but *unknown* at the application level,
which is question 2.

## Question 2 — is it safe to repeat?

This is the one that costs money.

```js
// transient failure, unsafe operation — this is how you charge twice
await withRetry(() => fetch('https://payments.example/charge', {
  method: 'POST', body: JSON.stringify({orderId, cents}),
}));
```

If the timeout fired *after* the payment provider processed the charge, the retry
charges again. **A timeout is not a failure — it is not knowing.** The request may have
succeeded entirely; you simply stopped listening.

HTTP method semantics give you a first cut, and only a first cut:

| Method | Repeatable? |
|---|---|
| `GET`, `HEAD`, `OPTIONS` | Yes — safe by definition |
| `PUT`, `DELETE` | Idempotent by definition — if the server implements them properly |
| `POST`, `PATCH` | **No**, unless made so explicitly |

"By definition" is doing a lot of work there. A `PUT` implemented as an append is not
idempotent no matter what the RFC says. Verify, do not assume.

## Making the unsafe safe

The fix is never "retry more carefully". It is to make repetition harmless, and then
retry freely.

**Provider idempotency keys** — the correct answer whenever they exist:

```js
await fetch('https://payments.example/charge', {
  method: 'POST',
  headers: {'idempotency-key': `charge:${orderId}`, 'content-type': 'application/json'},
  body: JSON.stringify({orderId, cents}),
  signal: budget.signal(),
});
```

The provider deduplicates on that key, so the retry returns the original result instead
of charging again. Note the key is **domain-derived**, so every attempt computes the
same string ([page 05](./05-job-idempotency.md)).

**Your own uniqueness constraint**, when you own the write:

```sql
insert into charges (idempotency_key, order_id, cents)
values ($1, $2, $3) on conflict (idempotency_key) do nothing
```

**Read-then-decide**, when neither is available: before retrying, ask the downstream
whether the effect already happened. Narrower window, more round trips, still not
airtight — which is why it is the last resort.

## Where the retry goes

**Do not retry at every layer.** A retry in the HTTP client, inside a retry in the
service, inside a job with `attempts: 5`, is 125 attempts against a struggling
dependency. Pick one layer — usually the outermost one that knows the operation's
meaning — and make the others fail fast.

**Retries live inside the budget** ([page 12](./12-timeout-budgets.md)):

```js
while (budget.remaining > 200) {
  try { return await call({signal: budget.signal()}); }
  catch (err) {
    if (!isTransient(err)) throw err;
    await scheduler.wait(jitteredBackoff(attempt++), {signal: shutdown.signal});
  }
}
throw new Error('budget exhausted');
```

**In a job, let the queue retry.** A retry loop *inside* a job handler and
`attempts: 5` on the job multiply, and the inner loop holds the worker slot while it
sleeps. Throw, and let the queue's backoff schedule the next attempt
([page 04](./04-retries-and-stalled-jobs.md)) — that is what it is for.

## Gotchas

**Symptom:** A customer was charged twice
**Cause:** A `POST` retried after a timeout that had actually succeeded.
**Fix:** Provider idempotency key derived from the domain; never retry an unguarded
non-idempotent write.

**Symptom:** A validation error takes 15 seconds to surface
**Cause:** Permanent failures retried.
**Fix:** Classify: 429 and 5xx retry, other 4xx fail immediately.

**Symptom:** A brief dependency blip becomes a long outage
**Cause:** Retries at several layers multiplying.
**Fix:** Retry at one layer; fail fast at the others.

**Symptom:** Retries never fire although the error looks transient
**Cause:** The classifier checks `err.code` while the library sets `err.status`, or
wraps the original error.
**Fix:** Test the classifier against real errors from that library, including wrapped
ones (`err.cause`).

**Symptom:** A worker slot is held for a minute doing nothing
**Cause:** A retry loop sleeping inside the job handler.
**Fix:** Throw and let the queue reschedule.

**Symptom:** Retrying a 409 loops forever
**Cause:** A concurrency conflict retried without re-reading state.
**Fix:** Re-read, recompute, then retry — with an attempt cap.

## Interview questions

**★ What are the two conditions for retrying?**
The failure must be transient — the same request might succeed next time — and the
operation must be safe to repeat. Both. Most incidents come from checking only the
first: a network timeout is transient, but retrying an unguarded `POST /charge`
duplicates the charge.

**★ Why is a timeout the most dangerous failure to retry?**
Because it is not a failure, it is an absence of information. The request may have
completed after you stopped waiting, so the retry is a second execution of work that
already happened.

**★ Which HTTP status codes are safe to retry?**
429 and 5xx are transient. 4xx generally are not — they will fail identically forever.
409 is a special case: retry only after re-reading and recomputing, with a cap.

**★ How do you make a non-idempotent operation retryable?**
Give it a domain-derived idempotency key: the provider's header where one exists, or a
unique constraint plus `on conflict do nothing` where you own the write. Then repetition
is harmless and retrying is free.

**Why is retrying at multiple layers a problem?**
The attempts multiply — 5 × 5 × 5 is 125 requests against a dependency that is already
struggling. Choose one layer, ideally the one that understands the operation, and make
the others fail fast.

**Should a job handler contain a retry loop?**
Usually not. The queue already retries with backoff, and an internal loop both
multiplies attempts and holds the worker slot while sleeping. Throw and let the queue
reschedule.

---

← Prev: [Deadline propagation](./13-deadline-propagation.md) · Next → [Exponential backoff and jitter](./15-backoff-and-jitter.md)
