---
title: "Sync vs background — what must never happen in the request path"
sidebar_label: "01 · Sync vs background"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0** — `bullmq` 6.0.10 against **Redis 8.10.0**.

**The request path should do the minimum the user is waiting on. Everything else is a
job.** In Node this is not a style preference: one process, one event loop, and
anything slow in a handler is slow for every other request that process is serving.

## The measurement

A handler that resizes an image inline — 120 ms of blocking CPU — against one that
enqueues the work and returns `202 Accepted`. Ten concurrent requests to each:

```console
10 concurrent /sync    { total: 1264 ms, p50: 761 ms, p95: 1246 ms }
10 concurrent /queued  { total:   21 ms, p50:  18 ms, p95:   19 ms }
```

**p95 of 1246 ms against 19 ms.** Note what the sync numbers actually say: the work is
120 ms, but the tenth request waited 1.2 seconds, because it queued behind the other
nine on the event loop. A single-threaded runtime turns *slow* into *slow for
everyone* ([Phase 0](../phase-0-runtime-model/)).

The job still runs. A worker with `concurrency: 2` drained all ten afterwards. The
work did not disappear — it moved somewhere that failing does not mean a 500 in
someone's browser.

## The two different problems

They get conflated, and the fixes are different.

**Blocking the event loop** — CPU work: image resizing, PDF generation, `bcrypt`,
`JSON.parse` on 40 MB, synchronous crypto. Nothing else progresses at all, including
the health check. The queue is one fix; a worker thread
([Phase 5](../phase-5-http-processes/)) is the other, when the result is genuinely
needed in the response.

**Waiting on someone else** — I/O: a payment API, an email provider, a webhook. The
event loop is fine, but the request is held open, a connection and its memory are
held with it, and your p99 is now their p99. A queue is the fix; a timeout budget
([page 12](./12-timeout-budgets.md)) is the mitigation when you truly must wait.

## What must never be in the request path

| Work | Why it moves |
|---|---|
| Email, SMS, push | A provider outage becomes your outage |
| Webhooks to third parties | Their timeout becomes your latency |
| Image/video/PDF processing | Blocks the loop for every concurrent request |
| Report generation, exports | Unbounded by data size, not by request |
| Search index updates | Eventually consistent by nature |
| Analytics, audit fan-out | Nobody is waiting for it |
| Bulk anything — "email all users" | One request, N failures, no retry story |

The test is one question: **does the user's next screen depend on this finishing?**
"Payment charged" — yes, stay in the request. "Receipt emailed" — no, that is a job.

## What must stay

Moving work to a queue is not free, and the cost is paid in correctness.

- **Anything the response reports as done.** If the API says `201 Created`, the row
  exists before you reply.
- **Validation and authorisation.** Rejecting a request must happen while there is
  someone to reject.
- **Anything inside the transaction.** A queue is not transactional with your
  database — that is exactly what [page 06](./06-transactional-outbox.md) is about.

## The shape

```js
// handler — fast, and honest about what it has done
app.post('/orders/:id/receipt', async (req, res) => {
  const order = await orders.findById(req.params.id);       // needed now
  if (!order) return res.status(404).json({error: 'not found'});

  await queue.add('send-receipt', {orderId: order.id}, {
    jobId: `receipt:${order.id}`,          // idempotency — page 05
    attempts: 5,
    backoff: {type: 'exponential', delay: 1000},
  });

  res.status(202).json({status: 'queued'});
});
```

Three things that make this real rather than decorative:

**`202`, not `200`.** The work is accepted, not done. Lying about that is how a
frontend ends up polling for a receipt that failed silently.

**A `jobId` derived from the domain.** Enqueue twice, run once. The queue is at-least
-once delivery, so every job is written as if it will run twice
([page 05](./05-job-idempotency.md)).

**The client needs a way to find out.** A status field on the order, a polling
endpoint, a websocket, or an email. "Fire and forget" means the user learns about
failure from your support inbox.

## When a queue is the wrong answer

**Under ~50 ms of non-blocking I/O**, the operational cost of a queue — another
process, another failure mode, another thing to monitor — is not worth it.

**When the user needs the result**, a queue plus polling is a worse experience than
just waiting, unless the work is genuinely long. A 300 ms PDF should block; a 30
-second one should not.

**When you have no worker.** A queue nobody consumes is a growing Redis key and a
silent outage. If you are not ready to run and monitor a second process
([page 03](./03-worker-processes.md)), `setImmediate` and a promise you forgot to
await are *not* a substitute — they die with the process and nothing retries them.

That last one is worth stating plainly: **`res.json(); doSlowThing();` is not
background work.** It is work with no retry, no visibility, no backpressure, and a
process restart deletes it. It is the single most common fake queue.

## Gotchas

**Symptom:** Every endpoint is slow when one endpoint is busy
**Cause:** CPU work in a handler blocking the event loop for all requests.
**Fix:** Queue it, or move it to a worker thread. Measured: 120 ms of work produced a
1246 ms p95 at 10 concurrent.

**Symptom:** Checkout fails when the email provider is down
**Cause:** A third-party call inside the request path.
**Fix:** Queue the email; the order does not depend on it.

**Symptom:** Work silently disappears on deploy
**Cause:** Fire-and-forget after the response — no persistence, no retry.
**Fix:** A real queue with durable storage.

**Symptom:** The client thinks it succeeded but nothing happened
**Cause:** `200` returned for queued work, with no status anywhere.
**Fix:** `202` plus a status the client can read.

**Symptom:** Duplicate emails after a retry
**Cause:** Enqueued twice, or the job ran twice.
**Fix:** Domain-derived `jobId` and an idempotent handler
([page 05](./05-job-idempotency.md)).

**Symptom:** Jobs pile up and nothing processes them
**Cause:** No worker running, or the worker crashed.
**Fix:** Alert on queue depth and worker heartbeat, not just on error rate.

## Interview questions

**★ Why does slow work in a Node handler hurt more than in a threaded runtime?**
One event loop per process. Blocking CPU work stops every other in-flight request,
not just its own — measured, 120 ms of resizing produced a p95 of 1246 ms across 10
concurrent requests, versus 19 ms when the work was queued. A thread-per-request
server would degrade, but not serialise.

**★ How do you decide what belongs in the request?**
Ask whether the user's next screen depends on it finishing. Validation,
authorisation, and anything the response claims as done stay. Email, webhooks, media
processing, exports and fan-out go to a queue.

**★ What is wrong with doing the work after `res.json()`?**
Nothing persists it. There is no retry, no visibility, no backpressure, and a deploy
or crash loses it silently. It also still runs on the same event loop, so it still
slows other requests.

**★ What do you give up by moving work to a queue?**
Immediacy and simplicity. The response can no longer report the result, so you need a
status the client can read; the job may run twice, so it must be idempotent; and the
enqueue is not in your database transaction, so "saved but never queued" becomes
possible ([page 06](./06-transactional-outbox.md)). Plus a second process to run and
monitor.

**Queue or worker thread?**
Worker thread when the result is needed in this response and the work is CPU-bound —
you keep one request, one answer, without blocking the loop. Queue when the work can
complete later, needs retries, or must survive a restart.

**What status code should a queued action return?**
`202 Accepted`, with something the client can poll or subscribe to. `200` implies the
work is done.

---

Phase index: [Background work and resilience](./README.md) · Next → [Job queues from Node](./02-job-queues.md)
