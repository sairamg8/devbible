---
title: "Job retries, attempts, stalled jobs and visibility timeout"
sidebar_label: "04 · Retries and stalled jobs"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0** — `bullmq` 6.0.10 against **Redis 8.10.0**,
> `pg` 8.23.0 against PostgreSQL 17.10.

**Two different failures look identical from the queue's side: the job threw, and the
worker vanished.** The first is a retry. The second is a *stall*, and it is handled by
a completely different mechanism — which is why work sometimes runs twice even though
your retry count is 1.

## Failure 1 — the job threw

The worker is alive and reports the failure, so the queue can count attempts and
schedule the next one.

```js
await queue.add('send-receipt', {orderId: 42}, {
  attempts: 4,
  backoff: {type: 'exponential', delay: 200},
});
```

With a handler that always throws:

```console
attempt timings (ms from start): 20, 300, 810, 1610
attemptsMade: 4 | final state: failed
failedReason: SMTP 421 service unavailable
counts: { completed: 0, failed: 1, delayed: 0, waiting: 0 }
```

The gaps are **280, 510, 800 ms** — the 200/400/800 exponential schedule plus
processing. Between attempts the job sits in `delayed`, not `waiting`, which is the
state to check when a queue "looks empty" but work is clearly outstanding.

After the last attempt the job is `failed` and stays there. It is not retried again
and it does not disappear ([page 07](./07-dead-letter-queues.md)).

**`attempts: 1` means no retry at all** — it is the total, not the number of retries.

## Failure 2 — the worker vanished

Nobody reports anything. The job is checked out, and the process holding it is gone.

Same job, same worker, killed 1.2 seconds into a 3-second job:

```console
SIGKILL: { completed: 0, failed: 0, active: 1, waiting: 0, delayed: 0 }
```

**`active: 1`, with nobody working it.** No error was raised, `attemptsMade` did not
increase, and no retry was scheduled — from the queue's point of view the job is
progressing normally.

What recovers it is the **visibility timeout**: the claim has a lease, and the worker
must keep renewing it. In BullMQ that is `lockDuration`, renewed automatically while
the handler runs, with a separate `stalledInterval` sweep looking for expired locks.
Start a fresh worker and:

```console
[worker 36257] started job 1
[worker 36257] finished job 1
after recovery: { completed: 1, failed: 0, active: 0, waiting: 0, delayed: 0 }
```

Recovered and completed, with those settings (`lockDuration: 5000`,
`stalledInterval: 2000`) in under nine seconds.

On a database queue it is the same idea, spelled out:

```sql
locked_until = now() + interval '30 seconds'
```

```console
locked job claimable now?  false
after the lock expired ->  reclaimed job 41
attempts is now 1
```

The lock expires, another worker claims it, `attempts` increments. **The attempt
counter is incremented at claim time, not at failure time** — which is exactly what
makes a stalled job detectable.

## Why this matters: the timeout is the real retry limit

Here is the consequence people miss. A job whose work takes **longer than the
visibility timeout** loses its lease while still running. Another worker claims it and
starts the same work. Now two workers are doing it, and neither knows.

That is the mechanism behind "we set `attempts: 1` and it still sent two emails". It
was never a retry.

Three defences, in order:

1. **Set the timeout above your p99 job duration**, with headroom. Monitor job
   duration against it.
2. **Renew the lease from long jobs.** BullMQ renews automatically; on a database
   queue you push `locked_until` forward as you go.
3. **Be idempotent anyway** ([page 05](./05-job-idempotency.md)), because a paused
   container, a long GC or a slow API can exceed any timeout you pick.

## Configuring retries so they help

```js
await queue.add('call-webhook', {orderId: 42}, {
  attempts: 5,
  backoff: {type: 'exponential', delay: 1000},   // 1s, 2s, 4s, 8s
  removeOnComplete: {age: 3600, count: 1000},
  removeOnFail: {age: 86400 * 7},
});
```

**Backoff must be exponential and jittered.** A fixed delay retries a struggling
downstream at exactly the rate that keeps it struggling, and every job that failed
together retries together ([page 15](./15-backoff-and-jitter.md)).

**Not everything deserves a retry.** A `422` from a payment provider will be a `422`
forever; retrying it five times over 15 seconds turns a clear failure into a slow
mystery. Fail permanently on non-transient errors
([page 14](./14-retry-safe-failures.md)):

```js
import {UnrecoverableError} from 'bullmq';

new Worker('webhooks', async (job) => {
  const res = await fetch(job.data.url, {method: 'POST', body: JSON.stringify(job.data.payload)});
  if (res.status >= 400 && res.status < 500 && res.status !== 429) {
    throw new UnrecoverableError(`permanent ${res.status}`);   // no further attempts
  }
  if (!res.ok) throw new Error(`transient ${res.status}`);      // retried
}, {connection});
```

**Bound the job itself.** A handler with no internal timeout can hang forever, holding
its slot and eventually stalling ([page 12](./12-timeout-budgets.md)):

```js
const res = await fetch(url, {signal: AbortSignal.timeout(10_000)});
```

## Gotchas

**Symptom:** A job ran twice although `attempts: 1`
**Cause:** It was not a retry — the job outlived its visibility timeout and was
redelivered as stalled.
**Fix:** Raise `lockDuration` above p99 duration, renew the lease, and make the job
idempotent.

**Symptom:** A job sits in `active` forever with no worker
**Cause:** The worker was `SIGKILL`ed; nothing reports that.
**Fix:** Rely on the stall sweep; alert on active jobs older than the timeout.

**Symptom:** The queue looks empty but work is outstanding
**Cause:** Jobs are in `delayed`, waiting out their backoff.
**Fix:** Check `delayed` and `failed` counts, not just `waiting`.

**Symptom:** A permanent error retries five times
**Cause:** Every throw is treated as transient.
**Fix:** `UnrecoverableError` (or its equivalent) for 4xx and validation failures.

**Symptom:** Retries make a downstream outage worse
**Cause:** Fixed-delay backoff with no jitter across many jobs.
**Fix:** Exponential with jitter; cap attempts.

**Symptom:** `attempts` climbs with no failures logged
**Cause:** The counter increments at claim time and the worker keeps dying.
**Fix:** Look for OOM kills and unhandled rejections in the worker, not in the handler.

**Symptom:** Redis memory grows steadily
**Cause:** Completed and failed jobs retained forever.
**Fix:** `removeOnComplete` / `removeOnFail` with age and count.

## Interview questions

**★ What is a stalled job and how does it differ from a failed one?**
A failed job threw — the worker was alive, reported it, and the queue counted the
attempt and scheduled a retry. A stalled job's worker vanished, so nothing was
reported: measured, a `SIGKILL`ed worker left the job in `active` with no error and no
attempt increment. Only the expiring visibility timeout recovers it.

**★ Why did a job run twice when retries were disabled?**
Because the second run was not a retry. The job exceeded its visibility timeout, the
lease expired, and another worker legitimately claimed it while the first was still
running. Retries and redelivery are separate mechanisms — which is why idempotency is
mandatory regardless of retry settings.

**★ What is a visibility timeout, and how do you choose it?**
The lease on a claimed job. Set it comfortably above p99 job duration, renew it from
long-running handlers, and monitor duration against it — jobs approaching the timeout
are about to be processed twice.

**★ Should every failure be retried?**
No. Transient failures — network errors, 5xx, 429, timeouts — yes. Permanent ones — 4xx,
validation errors, a missing record — no; retrying turns a clear error into a slow one
and burns the attempt budget. BullMQ spells this as `UnrecoverableError`.

**Where does a job go between retries?**
Into a `delayed` state until its backoff elapses, then back to `waiting`. A queue that
appears empty while work is outstanding usually has everything in `delayed` or
`failed`.

**How does a database queue implement the same thing?**
`locked_until` on the row, set at claim time along with `attempts`. Expired locks are
claimable again, and the incremented `attempts` is how a poison job is spotted.

---

← Prev: [Worker processes](./03-worker-processes.md) · Next → [Job idempotency](./05-job-idempotency.md)
