---
title: "Background jobs from routes"
sidebar_label: "05 · Jobs from routes"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

**Validate, persist, enqueue, respond. Never await email/webhooks/PDF generation on the request path.**

> Verified: 2026-08-14 — **no sandbox run**. The 202 semantics are
> [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html): *Accepted* means the request
> has been accepted for processing **but the processing has not been completed**, and the
> response is *"intentionally noncommittal"* about the eventual outcome — which is
> precisely the promise this pattern makes.
> The Express-level fact that makes the anti-pattern dangerous is from
> [Phase 5](../phase-5-errors/02-async-errors.md): **Express 5 forwards rejections only
> from promises it awaited**, so a fire-and-forget call started in a handler and not
> awaited becomes an `unhandledRejection` with no request context — the failure is
> invisible rather than logged.
> Queues, outbox, retries and worker shutdown are
> [Node Phase 7](../../../nodejs/pages/phase-7-background-work/README.md); this page is
> only about the handoff at the route.

```js
await orders.create(input);          // in a transaction with outbox when needed (Node 7)
await queue.add('send-receipt', {id});
res.status(202).json({id, status: 'accepted'});
```

Cross-link Node Phase 7 for outbox, retries, and worker shutdown.

## The three ways this goes wrong

**1. Fire and forget.** The one that looks correct and is worst:

```js
router.post('/orders', async (req, res) => {
  const order = await orders.create(req.validated);
  sendReceipt(order);                    // ⛔ not awaited, not caught
  res.status(201).json(toDto(order));
});
```

The request succeeds. If `sendReceipt` rejects, Express never sees it — it did not
await that promise — so it surfaces as a process-level `unhandledRejection` with no
request id, no user, and no route. **The customer never gets a receipt and no log
line connects to their order.** This is the single most common way background work
disappears in Express apps.

**2. Awaiting the slow thing.** Correct but fragile: the request now takes as long
as the slowest remote system, and a provider outage becomes your outage. Every one
of those requests occupies a connection and an event-loop slot.

**3. Enqueue before commit.** Subtle and painful: the job is queued, a worker picks
it up in milliseconds, reads the database — and the row is not there yet, because
the transaction has not committed. Under load this is a race you lose regularly.

## Persist, then enqueue — and the honest version

Ordering matters more than it looks:

```js
router.post('/orders', async (req, res) => {
  const order = await orderService.place(req.validated, req.user.id);  // committed
  await queue.add('send-receipt', {orderId: order.id});                // then queued
  res.status(202).json({id: order.id, status: 'accepted'});
});
```

The job payload carries **an id, not a snapshot**. The worker re-reads current
state, so it cannot act on data that changed between enqueue and execution — and
the message stays small.

There is still a gap: the row commits, the enqueue fails, and nothing is scheduled.
Closing it properly needs the **outbox pattern** — write the job as a row in the
same transaction as the data, and let a relay push it to the queue
([Node Phase 7](../../../nodejs/pages/phase-7-background-work/README.md)). That is
the mechanism this page hands off to; what belongs here is knowing the gap exists
rather than pretending `await queue.add` is atomic with the commit.

## 202 means you now owe the client an answer

Returning 202 moves a promise from the provider's retry machinery to yours. The
client believes the work is scheduled, so **the schedule must be durable**, and the
client needs some way to find out how it ended:

- a **status endpoint** — `GET /orders/:id` showing `receipt: pending|sent|failed`;
- or a **callback/webhook** when it completes;
- or, at minimum, somewhere a support engineer can look.

A 202 with no way to observe the outcome is a black hole with a friendly status
code. Decide which of the three you are offering before you return it.

## Trade-off

Enqueueing keeps request latency flat and independent of every remote system you
depend on, which is the whole reason to do it. The costs are real and often
underestimated: a queue to run and monitor, jobs that need their own retries,
idempotency and dead-letter handling, and a **user-visible change** — "sent" becomes
"will be sent", which product owners sometimes have opinions about.

**Await the work when it is genuinely fast and genuinely required for the response
to be truthful** — writing the row you are about to return. Enqueue when it is slow,
remote, or merely desirable. The dividing question is not "is this slow?" but
**"if this fails, should the request have failed?"** If no, it belongs in a job.

## Gotchas

**Symptom:** A background task fails and nothing appears in the request logs  
**Cause:** Fire-and-forget — the promise was never awaited, so it surfaced as an
`unhandledRejection` with no request context  
**Fix:** Enqueue it (and await the enqueue), or attach an explicit
`.catch(logWithRequestId)` if it truly is optional

**Symptom:** A worker processes a job before the row exists  
**Cause:** Enqueued inside the transaction, ahead of the commit  
**Fix:** Commit first, then enqueue — and use an outbox when losing the job is
unacceptable

**Symptom:** Requests time out whenever a third-party provider is slow  
**Cause:** Awaiting the remote call on the request path  
**Fix:** Enqueue, return 202, and give the client a way to check the outcome

**Symptom:** A retried job acts on stale data  
**Cause:** The payload carried a snapshot of the entity  
**Fix:** Send an id; let the worker re-read current state

**Symptom:** A job runs twice and the user gets two emails  
**Cause:** At-least-once delivery, which is what queues actually offer  
**Fix:** Make the handler idempotent — Node Phase 7, and the same reasoning as
[idempotency keys](../phase-6-rest-surface/06-idempotency-keys.md)

**Symptom:** Jobs are lost during a deploy  
**Cause:** The process exited before in-flight work finished  
**Fix:** Graceful shutdown — Node Phase 5 and Phase 7 own this

## Interview questions

**★ Why 202 for queued work?**  
Accepted for processing — not necessarily completed.

**★ What is wrong with calling an async function without awaiting it in a handler?**  
Express 5 only forwards rejections from promises it awaited, so the failure escapes
as a process-level `unhandledRejection` with no request context. The request returns
200, the work silently never happened, and no log line ties back to the user.

**★ Enqueue before or after the commit, and what remains broken either way?**  
After — enqueue first and a fast worker reads a row that does not exist yet. But
committing first leaves a window where the enqueue fails and nothing is scheduled;
closing that needs an outbox written in the same transaction.

**Why send an id rather than the object in a job payload?**  
So the worker reads current state. A snapshot can be stale by the time the job runs,
and retries then act on data that has since changed.

**What do you owe a client after returning 202?**  
Durability and observability — the work must actually be scheduled, and there must be
some way to learn the outcome, whether a status field, a callback, or at minimum a
log a human can find.

**How do you decide whether to await or enqueue?**  
Ask whether a failure should have failed the request. If yes, await it — it is part
of the response's truth. If no, it is a job.


---

← Prev: [DI without a framework](04-di-without-framework.md) · Next → [Folders and DTOs](06-folders-and-dtos.md)
