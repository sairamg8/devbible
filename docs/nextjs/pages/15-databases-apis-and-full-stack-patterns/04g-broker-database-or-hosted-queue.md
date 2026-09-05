---
title: "The choice between Postgres, a Redis broker and a hosted queue is not a feature comparison — it is one question, whether the enqueue can share a transaction with the write that caused it, because that is the only property you cannot rebuild on top of the others"
sidebar_label: "04g · Broker, database, or hosted"
sidebar_position: 239
description: "What a shared transaction boundary buys you, what a Postgres queue costs your primary, BullMQ's real strengths and its long-lived-process requirement, hosted queues, and the hybrid that is usually right."
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-05 against the BullMQ documentation —
> [Queues](https://docs.bullmq.io/guide/queues),
> [Workers](https://docs.bullmq.io/guide/workers),
> [Connections](https://docs.bullmq.io/guide/connections),
> [Graceful shutdown](https://docs.bullmq.io/guide/workers/graceful-shutdown),
> [Stalled jobs](https://docs.bullmq.io/guide/workers/stalled-jobs),
> [Idempotent jobs](https://docs.bullmq.io/patterns/idempotent-jobs) (all fetched
> 2026-09-05) — and [Vercel · Queues concepts](https://vercel.com/docs/queues/concepts).
> Documentation-verified, **no sandbox run, no benchmarks, no throughput figures**.
> Target: **BullMQ 6.3.4** · PostgreSQL 18.4 · Node 24.20.0 · Next.js 16.3.4.

**Every comparison of queue technologies you will read is a feature list, and feature lists are the wrong tool here, because almost every feature on them can be rebuilt in a weekend on top of any of the others. Priorities, delays, retries, dead letters — all of those are columns and queries. There is exactly one property that cannot be rebuilt, and it is the one nobody puts in the comparison table: whether the act of enqueueing can be part of the same transaction as the change that made the job necessary. Postgres has it. A broker cannot have it, by construction. A hosted queue cannot have it either. Everything else on this page is about what you pay for that property, and about the specific, real reasons to give it up.**

## The property that decides it

```ts
// Postgres: one COMMIT. There is no state where the order is paid and no job exists.
await client.query('BEGIN')
await client.query(`UPDATE orders SET status = 'paid' WHERE id = $1`, [id])
await client.query(`INSERT INTO jobs (kind, payload) VALUES ('order.paid', $1)`, [payload])
await client.query('COMMIT')

// Any external queue: two systems, no shared commit, and no safe ordering.
await client.query(`UPDATE orders SET status = 'paid' WHERE id = $1`, [id])
await queue.add('order.paid', { orderId: id })   // ⟵ may not happen; may happen twice
```

The second form is the dual write from [04c](04c-the-anatomy-of-a-job.md), and there is no ordering of those two lines that is correct. That is not a criticism of BullMQ or of any hosted product; it is a consequence of the two systems having independent commit protocols. **The standard workaround — a transactional outbox — is itself a job table in Postgres**, which means that if you choose a broker and then choose to be correct, you end up running both.

| | Transactional enqueue | Needs new infra | Runs without a long-lived process | Fan-out to independent consumers |
|---|---|---|---|---|
| **Postgres table** | ✅ | ❌ none | ⚠️ only via cron drain | ⚠️ hand-rolled |
| **BullMQ (Redis)** | ❌ | ✅ Redis | ❌ workers are long-lived | ✅ |
| **Hosted queue** | ❌ | ❌ managed | ✅ push mode | ✅ consumer groups |

## What a Postgres queue actually costs

Be honest about this or the recommendation is worthless.

- **Write churn on your primary.** Every job is an insert, one or more updates, and eventually a delete — on the same instance serving user reads. That is dead tuples, autovacuum work, WAL volume and, if you have replicas, replication traffic. A queue is one of the highest-churn tables an application has.
- **Connection budget.** Workers hold connections from the same `max_connections` as your app ([04f](04f-waking-the-worker.md)). Every worker you add is capacity taken from the request path.
- **No consumer groups.** "Deliver this event to the search indexer *and* the analytics pipeline *and* the webhook fan-out, independently, each with its own retries" is a `consumer` column and three times the rows, hand-built and hand-maintained.
- **No built-in scheduling primitives.** Rate limiting, priorities, job dependencies, repeatable schedules — all achievable, all code you now own.
- **Blast radius.** The queue's failure and the application's failure are the same failure. That is a virtue for consistency and a liability for isolation.

Against that, what you get is: transactional enqueue, one thing to operate, one thing to back up, and the ability to answer any question about the queue in SQL during an incident. For most applications that trade is overwhelmingly correct, and the honest triggers for changing your mind are in the decision section below.

## BullMQ — what a real broker buys

BullMQ is the mature Redis-backed option in Node, and its strengths are the things a table does badly.

```ts
// lib/queue/index.ts — the producer
import { Queue } from 'bullmq'

export const emailQueue = new Queue('email', {
  connection: { host: process.env.REDIS_HOST!, port: Number(process.env.REDIS_PORT ?? 6379) },
})

// A named job with a payload…
await emailQueue.add('receipt', { orderId: 'ord_8812' })

// …and one that waits before becoming eligible.
await emailQueue.add('reminder', { orderId: 'ord_8812' }, { delay: 5000 })
```

> *"The code above will add a job named paint to the queue, with payload `{ color: 'red' }`. This job will now be stored in Redis in a list waiting for some worker to pick it up and process it. Workers may not be running when you add the job, however as soon as one worker is connected to the queue it will pick the job and process it."*
> — [BullMQ · Queues](https://docs.bullmq.io/guide/queues)

```ts
// worker.ts — the consumer. This process must stay alive.
import { Worker, type Job } from 'bullmq'

const worker = new Worker(
  'email',
  async (job: Job) => {
    if (job.name === 'receipt') await sendReceipt(job.data.orderId)
    return 'sent'
  },
  { connection: { host: process.env.REDIS_HOST!, port: Number(process.env.REDIS_PORT ?? 6379) },
    concurrency: 5 },
)

worker.on('failed', (job, error) => console.error('job failed', { id: job?.id, error }))

process.on('SIGTERM', async () => { await worker.close() })
```

> *"Workers are the actual instances that perform some job based on the jobs that are added in the queue… The worker duty is to complete the job, if it succeeds the job will be moved to the "completed" status. If the worker throws an exception during its processing, the job will automatically be moved to the "failed" status."*
> — [BullMQ · Workers](https://docs.bullmq.io/guide/workers)

`worker.close()` is the equivalent of [04f](04f-waking-the-worker.md)'s drain, and the documentation is precise about what it does and does not promise:

> *"The above call will mark the worker as closing so it will not pick up new jobs, and at the same time it will wait for all the current jobs to be processed (or failed). This call will not timeout by itself, so you should make sure that your jobs finalize in a timely manner."*
> — [BullMQ · Graceful shutdown](https://docs.bullmq.io/guide/workers/graceful-shutdown)

Its lease equivalent is the **stalled job** mechanism, and it has a Node-specific failure mode worth knowing:

> *"When a job reaches a worker and starts to be processed, BullMQ will place a lock on this job to protect the job from being modified by any other client or worker. At the same time, the worker needs to periodically notify BullMQ that it is still working on the job."*
> *"if the CPU is very busy (due to the process being very CPU intensive), the worker may not have time to renew the lock and tell the queue that it is still working on the job, which is likely to result in the job being marked as `stalled`. A stalled job is moved back to the waiting status and will be processed again by another worker, or if it has reached its maximum number of stalls, it will be moved to the failed set."*
> — [BullMQ · Stalled jobs](https://docs.bullmq.io/guide/workers/stalled-jobs)

🔴 That is the heartbeat from [04da](04da-leases-and-the-claim-lifetime.md), running on the same single-threaded event loop as your job. A CPU-bound processor blocks its own lock renewal and gets its job reassigned *while still running it* — duplicate execution caused by your own synchronous code. The mitigation is BullMQ's sandboxed processors, or not doing CPU-bound work on the event loop.

And the constraint that decides whether BullMQ is available to you at all:

> *"Classes that need blocking Redis commands, such as `Worker` and `QueueEvents`, will create duplicated connections internally, so the client or adapter must support `duplicate()`."*
> — [BullMQ · Connections](https://docs.bullmq.io/guide/connections)

**Blocking commands require a process that stays connected.** BullMQ workers are not a shape you can host inside a serverless function invocation; you need a container or a VM. If you already run one, that cost is near zero. If your entire deployment is serverless, it is a new deployment target, a new pipeline and a new thing to page someone about.

What you get for it is real: concurrency and global concurrency, rate limiting, priorities, LIFO, job schedulers and repeatable jobs, flows (parent/child job trees), deduplication, `QueueEvents` for cross-process notifications, and a Prometheus metrics integration. Rebuilding four of those on a table is a quarter of engineering time.

⚠️ BullMQ's own Guide navigation now lists a **PostgreSQL backend** page immediately before *Queues*, and the *Queues* page's pager confirms it. I could not retrieve that page's content on 2026-09-05, so I make no claim about what the backend supports or whether it offers transactional enqueue — check it directly before assuming either way.

Note also what BullMQ tells you about the same problem this topic keeps returning to:

> *"In order to take advantage of the ability to retry failed jobs, your jobs should be designed with failure in mind. This means that it should not make a difference to the final state of the system if a job successfully completes on its first attempt, or if it fails initially and succeeds when retried."*
> — [BullMQ · Idempotent jobs](https://docs.bullmq.io/patterns/idempotent-jobs)

Idempotency is your job in every one of these systems. [04e](04e-at-least-once-and-idempotency.md) does not become optional because you bought a broker.

## Hosted queues

The managed option removes the infrastructure and hands you the semantics. From [Vercel · Queues concepts](https://vercel.com/docs/queues/concepts):

- **Durability is stated:** *"Every message is synchronously written to three separate availability zones before the publish call returns."*
- **Consumers can be unreachable from the internet:** *"Queue consumer functions on Vercel are not accessible from the outside world."* … *"This means you don't need to add authentication or authorization logic to your consumer functions."* — a genuine advantage over a cron-triggered drain route, which is a public URL that runs your queue.
- **Delivery is at-least-once**, with the visibility timeout and 32-attempt backoff behaviour covered in [04da](04da-leases-and-the-claim-lifetime.md) and [04db](04db-backoff-dead-letters-and-pruning.md).
- **There is no dead-letter queue:** *"Vercel Queues doesn't have a built-in dead-letter queue. Instead, you handle poisoned messages at the application level using the SDK's `retry` handler."*
- **Deployment coupling is explicit:** *"On Vercel, topics are partitioned by deployment ID by default. In push mode, Vercel delivers messages back to the same deployment that published them."*
- **Delays are bounded:** *"Delays can be set from 0 seconds up to 7 days, but cannot exceed the message's TTL."*

⚠️ Vercel Queues is documented as **Beta**. Treat the semantics as stable enough to design against and the API surface as subject to change; do not build a hard dependency on a beta product for the path that moves money.

## The decision

**Start with Postgres.** It is the only option with transactional enqueue, it adds nothing to operate, and for the overwhelming majority of applications the volume never becomes the problem people worry about in advance.

**Move to a broker when a measurement says so**, not when the architecture diagram looks tidier:

- Queue write rate is measurably affecting user-facing query latency on the primary, and partial indexes and pruning have not fixed it.
- You need genuine fan-out — several independent consumer groups each getting a copy, each with their own retry state.
- You need scheduling primitives (rate limiting, job trees, repeatable schedules) whose hand-built versions are now a meaningful fraction of your codebase.
- You already run Redis and a long-lived worker deployment, so the marginal cost is one dependency rather than a new operational surface.

**Choose a hosted queue when** your deployment is serverless-only, you want consumers with no public URL, and you can accept at-least-once delivery with no transactional enqueue and no DLQ.

## The hybrid, which is usually the right answer at scale

You do not have to choose. Keep the transactional guarantee *and* get the broker's features:

```text
Server Action ──BEGIN─┬─ UPDATE orders
                      └─ INSERT INTO outbox     ──COMMIT──▶
                                                            relay ──▶ BullMQ / SQS / Queues
                                                                          └──▶ consumers
```

The outbox insert is transactional, so nothing is ever lost or invented. A relay process claims unpublished rows with `SKIP LOCKED` ([04d](04d-postgres-as-a-queue-skip-locked.md)) and publishes them. The relay is at-least-once, so consumers still need idempotency — which they needed anyway. The cost is one extra process and one extra table; the benefit is that "did this event happen" is answered by your database and nothing else.

## Gotchas

**★ Symptom: a broker was adopted for reliability, and events now go missing occasionally.** Cause: the enqueue is a dual write — `COMMIT` then `queue.add()` — and the gap between them is unrecoverable. The queue is more reliable than before *at delivering what it received*, and the problem was never delivery. Fix: put an outbox row in the transaction and relay it, per the hybrid above. Adding a broker to a dual write makes the dual write faster, not safer.

**★ Symptom: BullMQ jobs are processed twice under load, with no crashes in the logs.** Cause: a CPU-bound processor blocked the event loop long enough that the worker could not renew its lock, so the job was marked stalled and reassigned *while still running*. Fix: move CPU-bound work off the event loop — BullMQ's sandboxed processors, or a separate service — and yield often in anything synchronous. This is the Node-specific version of "the lease was shorter than the job" from [04da](04da-leases-and-the-claim-lifetime.md).

**★ Symptom: you cannot deploy BullMQ workers on your serverless platform.** Cause: workers rely on blocking Redis commands and therefore on a connection that persists — *"Classes that need blocking Redis commands, such as `Worker` and `QueueEvents`, will create duplicated connections internally"*. There is no invocation-shaped version of that. Fix: either run a container for the workers, or stay on the Postgres queue with a cron drain ([04f](04f-waking-the-worker.md)), or use a hosted push queue. Do not attempt to run a `Worker` inside a Route Handler.

**★ Symptom: `worker.close()` hangs during deploys and the orchestrator eventually kills the pod.** Cause: it is documented behaviour — *"This call will not timeout by itself, so you should make sure that your jobs finalize in a timely manner."* One long job holds the whole shutdown. Fix: bound it yourself, and let the stalled mechanism recover anything that did not finish:

```ts
process.on('SIGTERM', async () => {
  await Promise.race([worker.close(), new Promise((r) => setTimeout(r, 25_000))])
  process.exit(0)
})
```

**Symptom: the queue table's write rate is blamed for slow user queries, and moving to Redis does not help as much as expected.** Cause: the queue was one contributor among several, and the actual cost was unpruned history plus missing partial indexes. Fix: measure before migrating — [04i](04i-queue-observability.md) — and try the cheap fixes first: a partial index on `status = 'pending'`, batched pruning, and moving the reaper out of the claim query.

**Symptom: a hosted queue's messages stop being delivered after a deploy.** Cause: deployment partitioning — *"topics are partitioned by deployment ID by default. In push mode, Vercel delivers messages back to the same deployment that published them."* The old deployment must stay alive to drain, or those messages wait. Fix: understand the partitioning model before relying on it, and keep payloads compatible across deployments regardless ([04c](04c-the-anatomy-of-a-job.md)).

**Symptom: two independent consumers were added to one Postgres queue and each job is now processed by whichever worker got there first.** Cause: a single `jobs` table has one claim, so consumers compete rather than each receiving a copy — there are no consumer groups. Fix: either add a `consumer` column and insert one row per consumer at enqueue time, or accept that this is the point at which a broker's fan-out is genuinely buying you something.

## Interview questions

**★ Why is "can the enqueue join my transaction" the deciding question rather than throughput?**
Because throughput is a problem you can measure and solve later, and it usually never arrives; the transaction boundary is a correctness property you either have from the start or spend the project reconstructing. Without it, every mutation that schedules work has a window in which the data changed and nobody was told, or was told about something that then rolled back — and no retry logic inside the request closes that window, because the process doing the retrying is the thing that might die. Every other difference between these systems is a feature you could build: priorities are a column, delays are a timestamp, retries are a counter. The shared commit is the one thing you cannot add on top, and its standard workaround, the transactional outbox, *is* the Postgres queue.

**★ You already run Redis. Is BullMQ now the obvious choice?**
It removes the strongest objection — the new operational surface — but not the deciding one. You still cannot enqueue inside your Postgres transaction, so anything whose loss matters needs an outbox, and once you have the outbox you are running both systems. What BullMQ genuinely buys is the feature set: real rate limiting, job flows with parent/child dependencies, repeatable schedules, priorities, global concurrency, and per-queue metrics — several weeks of work each if you hand-build them on a table. So the honest decision rule is: if you need those features, BullMQ plus an outbox is a good architecture; if you only need "run this later, reliably", the table alone is fewer moving parts with a stronger guarantee.

**★ What is a stalled job in BullMQ, and why is it more dangerous in Node than the equivalent in Postgres?**
It is BullMQ's lease expiry: the worker holds a lock on the job and must periodically renew it, and a job whose lock is not renewed is *"moved back to the waiting status and will be processed again by another worker"*. The Node-specific danger is that the renewal is a timer on the same single-threaded event loop as your processor, so a CPU-bound job blocks its own heartbeat — the worker is alive and working, but cannot say so, and the queue hands the job to someone else while the first is still running it. A Postgres worker has the same failure available to it, but it is far less likely to arrive by accident, because the heartbeat is a separate query and typical handlers are I/O-bound. The general lesson is that any lease renewal running in the same execution context as the work is only as reliable as that context's responsiveness.

**★ When is a hosted queue clearly better than either?**
When your deployment is serverless-only and the consumer's public exposure matters. A cron-driven drain route is a URL on the internet that runs your entire queue, so it must authenticate correctly, forever, including after every refactor — whereas Vercel documents its consumers as *"completely air-gapped from the internet"* with *"no public URL"*, which removes an entire category of mistake. You also get multi-AZ durability stated as a guarantee and consumer groups for free. What you give up is the transactional enqueue, the dead-letter queue (there is none; you handle poisoned messages in the retry handler), and the ability to answer questions about the queue in SQL.

**Your team wants to migrate off the Postgres queue because "a database is not a queue". What do you ask for?**
A measurement and a named requirement. The measurement: which user-facing query got slower, by how much, and is the queue's write rate the cause — because the usual culprits are an unpruned table and a missing partial index, both of which are an afternoon's work rather than a migration. The named requirement: which specific capability is missing — genuine fan-out to independent consumer groups, rate limiting, job dependency graphs — because "it feels wrong" is not a requirement and the migration costs you the one guarantee that is hard to get back. If both answers are real, the right destination is usually the hybrid rather than a straight swap: keep the outbox in Postgres so the enqueue stays transactional, and let the broker be the delivery mechanism.

**What does the outbox-plus-relay architecture actually cost?**
One table, one long-lived process, and an extra hop of latency between the commit and the broker — plus the ongoing obligation that consumers be idempotent, since the relay is at-least-once. It also gives you a second place to watch: unpublished outbox rows are their own backlog metric, and a stalled relay is invisible unless you alert on the age of the oldest unpublished row. What you get is that your database is the single source of truth for whether an event happened, so recovery after any broker incident is a question you can answer with a query rather than by reasoning about what was in flight.

---

← [04fa · `LISTEN`/`NOTIFY` and the latency floor](04fa-listen-notify-and-the-latency-floor.md) · Next → [04h · Cron and scheduled work](04h-cron-and-scheduled-work.md)
