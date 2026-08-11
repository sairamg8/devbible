---
title: "Worker processes — separate from the API, sharing code"
sidebar_label: "03 · Worker processes"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0** — `bullmq` 6.0.10 against **Redis 8.10.0**.

**A worker is the same codebase started with a different entry point.** Not a
different repository, not a different service, not a copy of your models. One
deployable artifact, two commands.

## One repository, two entry points

```json
{
  "scripts": {
    "start":  "node src/api.js",
    "worker": "node src/worker.js"
  }
}
```

```js
// src/worker.js
import {Worker} from 'bullmq';
import {sendReceipt} from './domain/receipts.js';     // the same module the API imports
import {pool} from './db.js';
import {connection} from './redis.js';

const worker = new Worker('emails', async (job) => {
  await sendReceipt(job.data.orderId);
}, {connection, concurrency: 5});

worker.on('failed', (job, err) =>
  console.error({jobId: job?.id, attempts: job?.attemptsMade, err: err.message}));
```

The domain logic lives in `domain/receipts.js` and both entry points import it. That
is the whole architecture, and it is why the repository pattern from
[Phase 6, page 10](../phase-6-data-access/10-repository-pattern.md) pays here: if
business logic is decoupled from the transport, "run it from a job instead of a
request" is an import.

**Why a separate process, not a `Worker` inside the API?** Three reasons, in order of
how much they will bite you:

1. **CPU isolation.** A job that blocks the loop blocks every HTTP request in that
   process ([page 01](./01-sync-vs-background.md)). Separate processes, separate
   loops.
2. **Independent scaling.** A nightly export needs four workers and one API instance.
   Coupled, you scale both.
3. **Independent failure and deploy.** A worker OOM should not drop live requests, and
   a worker can be drained and restarted on its own schedule.

## What differs between the two

Same code, genuinely different runtime concerns.

| | API process | Worker process |
|---|---|---|
| Triggered by | HTTP | Polling / blocking pop on the queue |
| Health check | HTTP endpoint | Heartbeat, or queue-lag metric |
| Shutdown | Stop accepting, drain requests | Stop claiming, **finish the in-flight job** |
| Scaling signal | Request rate, latency | Queue depth, oldest-job age |
| DB pool size | Per instance, sized for concurrency | Sized for `concurrency`, not for CPUs |
| Timeouts | Request deadline | Job deadline, usually longer |

That pool row is a real trap: workers with `concurrency: 25` and a default `pg` pool
of 10 will queue internally forever, and workers plus API instances share the
database's `max_connections` budget
([Phase 6, page 01](../phase-6-data-access/01-connection-pooling.md)).

## Concurrency inside one worker

`concurrency` is how many jobs one process runs at once — not threads, just how many
promises are in flight on that event loop:

```js
new Worker('emails', handler, {connection, concurrency: 5});
```

For I/O-bound jobs, raise it: a worker calling an email API spends its life waiting,
and 20 concurrent is fine. For CPU-bound jobs, **`concurrency` above 1 buys nothing** —
the work is on one event loop either way. Scale CPU work with more processes, or run
the job body in a worker thread ([Phase 5](../phase-5-http-processes/)).

The bound is not optional. `concurrency` is the backpressure that stops a worker
pulling 500 jobs and opening 500 outbound connections
([page 16](./16-concurrency-limiting.md)).

## Running more than one

**Multiple processes on one machine** — the queue already distributes work, so
`cluster` buys nothing here. Start N worker processes; the exclusive claim
([page 02](./02-job-queues.md)) keeps them from colliding. Verified with three
competing workers: 20 jobs, 20 claims, 20 unique.

**Separate queues per workload.** One worker consuming `emails` and `video-encoding`
means a backlog of video starves the receipts. Split by latency expectation, not by
domain:

```js
new Worker('critical', handler, {connection, concurrency: 10});  // receipts, password resets
new Worker('bulk',     handler, {connection, concurrency: 2});   // exports, encoding
```

**Deploy them as separate units.** Same image, different command:

```yaml
# pseudo-config — the shape, not any one platform
services:
  api:    {image: shop:1.4.0, command: ["node", "src/api.js"],    replicas: 3}
  worker: {image: shop:1.4.0, command: ["node", "src/worker.js"], replicas: 2}
```

Same image is what keeps the code identical. A worker running last week's build while
the API runs today's produces jobs whose payload the consumer does not understand.

## Observability, because a worker has no users

An API tells you it is broken through error rates. A worker fails silently — nobody is
watching a queue that stops draining.

Alert on these four:

- **Queue depth**, and the **age of the oldest waiting job**. Age is the better signal:
  depth 10 000 draining fast is fine, depth 3 stuck for an hour is not.
- **Failure rate** and the size of the dead-letter queue
  ([page 07](./07-dead-letter-queues.md)).
- **Worker heartbeat.** A crash-looping worker shows as zero completions, not as
  errors.
- **Job duration p95**, against the visibility timeout. Jobs approaching the timeout
  are about to be delivered twice.

## Gotchas

**Symptom:** API latency spikes while a big job runs
**Cause:** The worker is in the API process.
**Fix:** Separate process, separate event loop.

**Symptom:** Workers idle while the queue grows
**Cause:** All workers blocked on one slow job type in a shared queue.
**Fix:** Separate queues by latency expectation, with their own workers.

**Symptom:** `timeout exceeded when trying to connect` in the worker
**Cause:** `concurrency` above the database pool size.
**Fix:** Size the pool to concurrency, and count workers × pool against
`max_connections`.

**Symptom:** Raising `concurrency` does not speed up CPU-bound jobs
**Cause:** One event loop — concurrency is not parallelism.
**Fix:** More processes, or a worker thread per job.

**Symptom:** Jobs fail with "unknown field" after a deploy
**Cause:** API and worker running different builds.
**Fix:** One image, two commands; make payload changes backward-compatible for one
deploy.

**Symptom:** Nobody noticed the queue stopped for six hours
**Cause:** Monitoring based on errors, not on progress.
**Fix:** Alert on oldest-job age and completion rate.

## Interview questions

**★ Why run workers as separate processes rather than inside the API?**
CPU isolation first — a blocking job stops every HTTP request sharing that event loop.
Then independent scaling (queue depth and request rate are different signals) and
independent failure and deploy. The cost is another process to run and monitor.

**★ How do the API and the workers share code?**
Same repository, same image, different entry point — `node src/api.js` versus `node
src/worker.js`, both importing the same domain modules. Different images or different
repos is how the two ends up on incompatible payload versions.

**★ What does `concurrency` on a worker actually control?**
How many jobs that one process has in flight on its event loop. It helps I/O-bound
work substantially and CPU-bound work not at all, since there is still one loop. It
also has to be matched to the database pool size, or jobs queue waiting for a
connection.

**★ How do you know a worker fleet is healthy?**
Oldest-waiting-job age and completion rate, not error rate — a stopped worker produces
no errors. Add queue depth, dead-letter size, and job duration p95 against the
visibility timeout.

**Do you need `cluster` for workers?**
No. The queue already distributes work through its exclusive claim, so N independent
processes is simpler and works across machines too.

**How should queues be split?**
By latency expectation. Receipts and password resets on a fast queue, exports and
video on a bulk one, each with its own workers — otherwise a backlog of slow work
starves the work users are waiting on.

---

← Prev: [Job queues](./02-job-queues.md) · Next → [Retries, attempts and stalled jobs](./04-retries-and-stalled-jobs.md)
