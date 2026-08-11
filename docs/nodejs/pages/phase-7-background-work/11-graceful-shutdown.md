---
title: "Graceful worker shutdown — finish the in-flight job"
sidebar_label: "11 · Graceful worker shutdown"
sidebar_position: 11
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0** — `bullmq` 6.0.10 against **Redis 8.10.0**,
> worker killed 1.2 s into a 3 s job.

**A worker gets a `SIGTERM` on every single deploy.** What it does in the next few
seconds decides whether that job completes once, twice, or not at all — and since
deploys are the most common event in a worker's life, this is the difference between a
queue that works and one that duplicates work every release.

## The two endings, measured

Same worker, same 3-second job, killed 1.2 seconds in.

**`SIGTERM` with `await worker.close()`:**

```console
[worker 36224] SIGTERM — closing, will finish the in-flight job
[worker 36224] finished job 1
[worker 36224] closed after 2125 ms
SIGTERM: { completed: 1, failed: 0, active: 0, waiting: 0, delayed: 0 }
```

It stopped claiming new jobs, spent 2125 ms finishing the one it had, acknowledged it,
and exited. **Completed exactly once.**

**`SIGKILL`:**

```console
SIGKILL: { completed: 0, failed: 0, active: 1, waiting: 0, delayed: 0 }
```

The job is stuck in `active` with nobody working it. No error, no failure, no retry
scheduled — the queue has no idea. It is recovered only when the visibility timeout
expires and the stall sweep finds it
([page 04](./04-retries-and-stalled-jobs.md)), and then it runs **from the beginning**,
including whatever it had already done.

The gap between those two outputs is the whole page.

## The handler

```js
import {Worker} from 'bullmq';

const worker = new Worker('emails', handler, {connection, concurrency: 5});

let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;            // a second SIGTERM must not restart this
  shuttingDown = true;
  console.log(`${signal} received — draining`);

  const timer = setTimeout(() => {
    console.error('drain timed out, forcing exit');
    process.exit(1);
  }, 25_000).unref();                  // must be shorter than the platform's kill timeout

  try {
    await worker.close();              // stop claiming; wait for active jobs
    await pool.end();                  // then the database
    await connection.quit();           // then Redis
    clearTimeout(timer);
    process.exit(0);
  } catch (err) {
    console.error('unclean shutdown', err);
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
```

**Order matters.** Stop taking work, finish what you have, *then* close the resources
the work needs. Closing the pool first turns every in-flight job into a failure — a
mistake that looks like graceful shutdown and behaves like `SIGKILL` with extra steps.

**The guard matters.** Orchestrators send `SIGTERM` and often a second one; without the
flag, the second call re-enters and can close the worker mid-drain.

**The timer matters.** A job that hangs would otherwise hold the process until the
platform's `SIGKILL` — and then you are in the `active`-forever case anyway. Fail
loudly and exit slightly early instead. Keep it comfortably under the platform's grace
period (Kubernetes `terminationGracePeriodSeconds`, default 30 s), and make that period
longer than your p99 job.

## Never acknowledge early

The subtler half of the same problem. Acknowledging before the work is durable is how
jobs are lost silently:

```js
// wrong — acked, then crashed, and nobody knows the email was never sent
await job.ack();
await sendReceipt(job.data.orderId);
```

At-least-once delivery only holds if acknowledgement comes **after** the effect. Ack
last and a crash means redelivery — a duplicate, which
[page 05](./05-job-idempotency.md) already handles. Ack first and a crash means silent
loss, which nothing handles.

BullMQ does this for you: the job completes when the handler's promise resolves. On a
hand-rolled database queue it is your `delete from jobs where id = $1`, and it goes
last.

## The API process is the same shape

```js
server.close();                          // stop accepting new connections
await drainInFlightRequests();           // let current responses finish
await pool.end();
```

Two Phase 5 details still apply: `server.close()` does not close keep-alive
connections, so idle sockets must be destroyed or the callback never fires; and a
readiness probe should start failing *before* the drain begins, so the load balancer
stops sending traffic you are about to refuse.

For a worker there is no load balancer — the queue is the buffer. That makes worker
shutdown simpler and its failure mode quieter, which is why it gets missed.

## What the platform is doing

Understanding the sequence tells you what to configure:

1. The orchestrator sends **`SIGTERM`**.
2. It waits `terminationGracePeriodSeconds` (Kubernetes default **30 s**).
3. If the process is still alive, it sends **`SIGKILL`**. Not catchable.

So: grace period > p99 job duration > your internal drain timeout. If jobs routinely
take five minutes, either raise the grace period or make jobs checkpoint their progress
so a restart resumes rather than repeats.

**One trap that silently breaks all of this:** in a container, `node` must be PID 1 or
have an init that forwards signals. Run via a shell — `CMD npm run worker`, or
`sh -c "node worker.js"` — and the shell is PID 1, `SIGTERM` goes to the shell, and your
handler never runs. Use the exec form, `CMD ["node", "src/worker.js"]`, and verify by
sending a `SIGTERM` and watching for your own log line.

## Gotchas

**Symptom:** Duplicate work after every deploy
**Cause:** Workers killed mid-job; the stall sweep redelivers from the start.
**Fix:** Handle `SIGTERM`, `await worker.close()`, and be idempotent.

**Symptom:** Jobs sit in `active` with no worker
**Cause:** `SIGKILL` — nothing is reported.
**Fix:** Graceful shutdown; alert on active jobs older than the visibility timeout.

**Symptom:** In-flight jobs fail during shutdown with connection errors
**Cause:** The pool or Redis closed before the jobs finished.
**Fix:** Close the worker first, resources after.

**Symptom:** The `SIGTERM` handler never runs in a container
**Cause:** A shell is PID 1 and does not forward signals.
**Fix:** Exec-form `CMD ["node", "src/worker.js"]`, or an init process.

**Symptom:** Shutdown hangs until the platform force-kills
**Cause:** A job that never finishes, or an open handle keeping the loop alive.
**Fix:** A drain timeout shorter than the grace period; `.unref()` background timers.

**Symptom:** Work is silently lost, no errors anywhere
**Cause:** Acknowledging before the effect is durable.
**Fix:** Ack last, always.

**Symptom:** Long jobs are killed every deploy no matter what
**Cause:** Job duration exceeds the grace period.
**Fix:** Raise the grace period, or checkpoint progress so a restart resumes.

## Interview questions

**★ What should a worker do on `SIGTERM`?**
Stop claiming new jobs, finish the ones in flight, acknowledge them, then close the
database and queue connections, then exit — with a drain timeout shorter than the
platform's grace period. Measured: with `await worker.close()` the worker spent 2125 ms
finishing its job and completed it exactly once.

**★ What happens if a worker is `SIGKILL`ed mid-job?**
The job stays `active` with no worker and no error — verified. Nothing is retried until
the visibility timeout expires and the stall sweep recovers it, at which point it runs
again from the beginning. That is why deploys duplicate work when shutdown is not
handled.

**★ Why must acknowledgement come last?**
Because at-least-once delivery depends on it. Ack after the effect and a crash causes a
duplicate, which idempotency already handles. Ack before and a crash causes silent
loss, which nothing handles.

**★ In what order do you close things?**
Worker first, resources second. Closing the database pool before jobs have drained
turns every in-flight job into a failure — the opposite of a graceful shutdown, while
looking like one.

**Why does the `SIGTERM` handler sometimes never fire in Docker?**
Because a shell is PID 1 — `CMD npm run worker` makes `npm`/`sh` the signal recipient
and it does not forward. Use the exec form so `node` is PID 1, and test it.

**How long should the grace period be?**
Longer than p99 job duration, with the internal drain timeout below it. If jobs
legitimately take longer than any reasonable grace period, checkpoint their progress so
a restart resumes instead of repeating.

---

← Prev: [Time on the server](./10-time-on-the-server.md) · Next → [Timeout budgets](./12-timeout-budgets.md)
