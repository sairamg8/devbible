---
title: "A Next.js deployment on serverless has nowhere for a worker loop to live, so you get exactly three options — a long-lived process beside the app, a cron-driven drain bounded by the invocation deadline, or a push queue that invokes a handler per message — and each of them decides your queue's latency floor"
sidebar_label: "04f · Waking the worker"
sidebar_position: 50
description: "Where the worker process actually runs, the poll loop with idle backoff, batch size and concurrency against pool max, and a graceful shutdown that returns leases instead of stranding them."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-05 against the
> [node-postgres pooling](https://node-postgres.com/features/pooling),
> [`Pool` API](https://node-postgres.com/apis/pool) and
> [pool sizing](https://node-postgres.com/guides/pool-sizing) guides, the
> [PostgreSQL 18 connection settings](https://www.postgresql.org/docs/18/runtime-config-connection.html)
> reference (`max_connections`), the Next.js
> [Self-hosting guide](https://nextjs.org/docs/app/guides/self-hosting) §`after`, and
> [Vercel · Queues concepts](https://vercel.com/docs/queues/concepts) (push mode, consumer
> isolation). Documentation-verified, **no sandbox run, no timings**.
> Target: **PostgreSQL 18.4** · `pg` 8.23.0 · Node 24.20.0 · Next.js 16.3.4.

**Everything in this topic so far has been a query. This page is the process that runs them, and it is where the design meets your deployment target: a Next.js application deployed to a serverless platform has no long-lived process at all, so "just run a worker" is not available and pretending otherwise is how a queue ends up drained by a cron job nobody documented. There are three real placements, they differ in latency floor and in operational cost, and the loop itself has four decisions — how long to sleep when the queue is empty, how many jobs to claim at once, how many to run concurrently, and what to do when the process is told to stop.**

## Where the worker actually lives

| Placement | Latency floor | Cost | When it is right |
|---|---|---|---|
| **Long-lived process** — container, VM, `node worker.js` beside the app | Your poll interval (sub-second) | A second deployable to build, monitor and roll | The default whenever you already run containers |
| **Cron-driven drain** — a Route Handler that claims and processes until near the deadline | **The cron interval** — minutes, not seconds | Almost none; it is one more route | Serverless-only deployments, modest volume, latency-tolerant work |
| **Push queue** — the platform invokes a handler per message | Sub-second, platform-managed | A managed queue product and its semantics | Serverless with volume, or fan-out across services |

🔴 The middle row is where most Next.js teams land, and its latency floor is the thing to say out loud before choosing it. A one-minute cron means "send the welcome email" happens up to a minute after signup. That is fine. It also means "unlock the user's account after payment" happens up to a minute later, which is not.

### The cron-driven drain, in full

```ts
// app/api/jobs/drain/route.ts
import { NextRequest } from 'next/server'
import { getDeadline } from '@vercel/functions'
import { Pool } from 'pg'
import { claimJobs } from '@/lib/jobs/claim'
import { runJob } from '@/lib/jobs/run'
import { dispatch } from '@/lib/jobs/dispatch'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const SAFETY_MARGIN_MS = 5_000
const workerId = () => `drain:${crypto.randomUUID().slice(0, 8)}`

export async function GET(request: NextRequest) {
  // 🔴 This route must be authenticated. See 04h.
  const auth = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  // A pool created per invocation must be disposed per invocation.
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 4 })
  const id = workerId()
  const deadline = getDeadline()
  let processed = 0

  try {
    while (true) {
      if (deadline && Date.now() > deadline.getTime() - SAFETY_MARGIN_MS) break
      const jobs = await claimJobs(pool, { batch: 4, leaseSeconds: 120, workerId: id })
      if (jobs.length === 0) break
      await Promise.all(jobs.map((job) => runJob(pool, job, id, dispatch)))
      processed += jobs.length
    }
    return Response.json({ processed })
  } finally {
    // node-postgres: "Make sure at the end of your serverless handler, after
    // everything is done, you close and dispose of the pool by calling pool.end()."
    await pool.end()
  }
}
```

Three things that route gets right and most hand-written versions do not: it stops on the *deadline* rather than on a fixed job count, it stops when the queue is empty rather than spinning, and it disposes the pool. node-postgres is explicit about the last one:

> *"Make sure at the end of your serverless handler, after everything is done, you close and dispose of the pool by calling `pool.end()`."*
> — [node-postgres · pool sizing](https://node-postgres.com/guides/pool-sizing)

### The push queue

The platform invokes a Route Handler per message, so there is no loop at all — and no auth to write, which is a real advantage:

> *"Queue consumer functions on Vercel are not accessible from the outside world."*
> *"With this configuration, the function is completely air-gapped from the internet. It has no public URL and can only be invoked by Vercel's internal queue infrastructure."*
> *"This means you don't need to add authentication or authorization logic to your consumer functions."*
> — [Vercel · Queues concepts](https://vercel.com/docs/queues/concepts)

Contrast that with the cron drain above, which is a publicly-routable URL that runs your entire queue and therefore needs the auth check on its first three lines. That asymmetry is a genuine argument for the managed product, covered in [04g](04g-broker-database-or-hosted-queue.md).

## The loop, when you do have a process

```ts
// worker.ts — a standalone long-lived process
import { Pool } from 'pg'
import { randomUUID } from 'node:crypto'
import { claimJobs, type ClaimedJob } from './lib/jobs/claim'
import { runJob } from './lib/jobs/run'
import { dispatch } from './lib/jobs/dispatch'

const CONCURRENCY = Number(process.env.WORKER_CONCURRENCY ?? 5)
const LEASE_SECONDS = Number(process.env.WORKER_LEASE_SECONDS ?? 300)

// One spare connection above concurrency, for heartbeats and outcome writes.
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: CONCURRENCY + 2 })
const workerId = `${process.env.HOSTNAME ?? 'local'}:${process.pid}:${randomUUID().slice(0, 8)}`

const IDLE_MIN_MS = 250
const IDLE_MAX_MS = 5_000

let accepting = true
const inFlight = new Set<Promise<void>>()

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function loop(): Promise<void> {
  let idleMs = IDLE_MIN_MS

  while (accepting) {
    const capacity = CONCURRENCY - inFlight.size
    if (capacity === 0) {
      await Promise.race(inFlight)
      continue
    }

    const jobs = await claimJobs(pool, { batch: capacity, leaseSeconds: LEASE_SECONDS, workerId })

    if (jobs.length === 0) {
      // Jittered exponential idle backoff: an empty queue must not
      // generate one claim query per worker per 250ms forever.
      await sleep(idleMs * (0.5 + Math.random()))
      idleMs = Math.min(IDLE_MAX_MS, idleMs * 2)
      continue
    }

    idleMs = IDLE_MIN_MS
    for (const job of jobs) start(job)
  }
}

function start(job: ClaimedJob): void {
  const p = runJob(pool, job, workerId, dispatch).finally(() => inFlight.delete(p))
  inFlight.add(p)
}
```

The empty-queue backoff matters more than it looks. Ten workers polling every 250 ms is 40 claim queries per second against your primary, permanently, whether or not there is any work — and the claim query takes a `ROW SHARE` table lock every time. Backing off to five seconds when idle drops that to two per second, and the cost is at most five seconds of latency on the first job after a quiet period, which [04fa](04fa-listen-notify-and-the-latency-floor.md) removes entirely.

## Batch size, concurrency, and pool `max` are one number seen three times

`claimJobs(batch)` decides how many rows one query claims. `CONCURRENCY` decides how many run at once. `pool.max` decides how many database connections back them. Get them out of step and the failure is silent.

> *"Maximum number of clients the pool should contain. By default this is set to 10."*
> *"If the pool is 'full' and all clients are currently checked out, requests will wait in a FIFO queue until a client becomes available by being released back to the pool."*
> — [node-postgres · `Pool`](https://node-postgres.com/apis/pool)

So a pool smaller than your concurrency does not error — it *queues*, invisibly, and your job durations grow by the wait. Meanwhile the ceiling is set at the other end:

> *"`max_connections` (integer) — Determines the maximum number of concurrent connections to the database server. The default is typically 100 connections… This parameter can only be set at server start."*
> — [PostgreSQL 18 · Connection settings](https://www.postgresql.org/docs/18/runtime-config-connection.html)

The arithmetic you must be able to do out loud: **`worker instances × pool.max` + `app instances × pool.max` must stay below `max_connections` minus the superuser reserve.** No documentation gives you a number for the left-hand side, because it is a product of your own deployment shape — state the arithmetic, never a figure.

Two rules from the same source that decide the shape:

> *"Setting the pool to a size larger than 1 is still recommended… With a pool size of 1 you are turning what is “a few things at once” into all things waiting in line one after another on the one available client in the pool."*
> *"Creating an unbounded number of pools defeats the purpose of pooling at all."*

**One pool per process, sized to concurrency plus a small margin.** The margin exists because heartbeats and outcome writes need a connection while every worker slot is busy; without it, a heartbeat can block behind the very jobs it is supposed to keep alive.

Batch size trades round trips against fairness. A batch of one is a query per job and maximum spread across workers. A batch of fifty is one query per fifty jobs and a worker that has claimed — and therefore leased — fifty jobs it will process serially, so job fifty's lease must cover forty-nine predecessors. 🔴 **Never claim a batch larger than you can process well inside the lease**, or the tail of your own batch expires under you.

## Graceful shutdown: return the leases, do not strand them

A worker killed mid-job leaves its jobs leased until expiry. That recovery is automatic but slow — recovery time equals lease length, which for a five-minute lease means five minutes of nothing happening after every deploy. A worker that shuts down *properly* can return them immediately.

```ts
const DRAIN_TIMEOUT_MS = 25_000

async function shutdown(signal: string): Promise<void> {
  console.info(`worker: ${signal} received, draining`, { workerId, inFlight: inFlight.size })
  accepting = false                                  // 1. stop claiming

  // 2. give in-flight work a bounded chance to finish
  await Promise.race([
    Promise.allSettled([...inFlight]),
    sleep(DRAIN_TIMEOUT_MS),
  ])

  // 3. hand back anything we still hold, so it is claimable NOW
  //    rather than after the lease expires.
  await pool.query(
    `UPDATE jobs
        SET status = 'pending', locked_until = NULL, locked_by = NULL
      WHERE locked_by = $1 AND status = 'running'`,
    [workerId],
  )

  await pool.end()
  process.exit(0)
}

process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('SIGINT', () => void shutdown('SIGINT'))
```

Step 3 is the part people omit, and it is the difference between a rolling deploy that is invisible and one that adds a lease-length stall to every job in flight. Note it runs *after* the drain timeout, so it only releases work that genuinely did not finish.

The orchestrator must cooperate. Next.js documents the same requirement for its own server, and the number is a good default for a worker too:

> *"When stopping the server, ensure a graceful shutdown by sending `SIGINT` or `SIGTERM` signals and waiting… Platforms should allow a configurable drain period (10-30 seconds is recommended) to ensure all background work completes."*
> — [Next.js · Self-hosting](https://nextjs.org/docs/app/guides/self-hosting)

Set `terminationGracePeriodSeconds` above `DRAIN_TIMEOUT_MS`, or the `SIGKILL` arrives mid-drain and you are back to waiting for leases.

## Gotchas

**★ Symptom: the database shows constant load with an empty queue.** Cause: a fixed short poll interval across every worker, so an idle fleet still runs claim queries continuously — each taking a table-level `ROW SHARE` lock. Fix: exponential idle backoff with jitter, resetting to the minimum the moment a claim returns work:

```ts
if (jobs.length === 0) {
  await sleep(idleMs * (0.5 + Math.random()))
  idleMs = Math.min(IDLE_MAX_MS, idleMs * 2)
  continue
}
idleMs = IDLE_MIN_MS
```

**★ Symptom: jobs at the end of a large batch time out with expired leases.** Cause: the worker claimed fifty jobs in one query, leasing all fifty at that instant, then processed them serially — so the last job's lease had to cover the previous forty-nine. Fix: claim only what you can run concurrently, `batch = CONCURRENCY - inFlight.size`, and heartbeat anything long ([04da](04da-leases-and-the-claim-lifetime.md)).

**★ Symptom: every deploy is followed by several minutes of stalled jobs.** Cause: workers are `SIGKILL`ed with leases held, so recovery waits for lease expiry. Fix: handle `SIGTERM`, stop claiming, drain, then explicitly release remaining leases with `UPDATE jobs SET status='pending' … WHERE locked_by = $1`, and raise the orchestrator's grace period above your drain timeout.

**★ Symptom: job throughput is far below concurrency and the CPU is idle.** Cause: `pool.max` is below `WORKER_CONCURRENCY`, so surplus jobs sit in node-postgres's FIFO wait queue — *"requests will wait in a FIFO queue until a client becomes available"* — which is invisible in application metrics because nothing errors. Fix: `max: CONCURRENCY + 2`, and log `pool.waitingCount` if you suspect it.

**★ Symptom: heartbeats stop landing exactly when the worker is busiest.** Cause: the pool is sized to concurrency with no margin, so a heartbeat query waits behind the jobs it exists to keep alive — and the lease expires while the worker is alive and working. Fix: the `+ 2` margin above, or a dedicated client reserved for control-plane statements.

**★ Symptom: the serverless drain route works, and after a few hours the database refuses connections.** Cause: a `Pool` created per invocation and never ended, so every invocation leaves connections behind until `max_connections` is exhausted. Fix: `await pool.end()` in a `finally`, exactly as the drain route does — this is the documented requirement for serverless handlers, not a nicety.

**Symptom: cron fires every minute, the drain takes 90 seconds, and jobs are processed twice.** Cause: overlapping invocations. Vercel warns that *"if your cron job runs longer than the interval between invocations, Vercel can trigger a second instance while the first is still running."* With `SKIP LOCKED` the second instance mostly claims different rows, so this is far less damaging than it would otherwise be — but it doubles your connection usage and can outrun the pool. Fix: bound the drain by the deadline as shown, and add an advisory lock if you need strictly one drain at a time ([04h](04h-cron-and-scheduled-work.md)).

**Symptom: two worker instances report the same `locked_by`, and lease ownership checks misfire.** Cause: `workerId` derived from hostname alone, and two pods on one node share it — or a container image bakes in a constant. Fix: include the pid and a random component, as `${HOSTNAME}:${pid}:${uuid}` does, so ownership is genuinely unique per process lifetime.

**Symptom: the worker exits cleanly in development and hangs in CI.** Cause: an idle pool keeps the Node event loop alive. Fix: `pool.end()` on shutdown — or set `allowExitOnIdle: true` on the pool for short-lived processes, which lets the event loop drain when every client is idle.

**Symptom: a job class starves because one slow kind occupies every worker slot.** Cause: a single undifferentiated queue — fifty pending video transcodes fill all five slots and the password-reset emails behind them wait. Fix: separate the claim by kind so slow work cannot consume the fast lane, which is a `WHERE kind = ANY($4)` on the claim plus a second worker deployment:

```sql
-- fast-lane worker: never claims the slow kinds
WHERE status = 'pending' AND run_at <= now()
  AND kind = ANY($4)
```

## Interview questions

**★ Your Next.js app is on a serverless platform. Where does the worker run?**
Not in the application, because there is no long-lived process to put it in — an invocation exists to answer a request and is entitled to be reclaimed afterwards. You have three real options. Run a separate long-lived worker beside the app, in a container or on a VM, which is the best answer whenever you already operate containers and gives you sub-second latency. Or drive a drain from cron: a Route Handler that claims a batch, processes until it is close to the invocation deadline, and returns — which costs nothing extra but sets your queue latency floor to the cron interval, so it is only acceptable for latency-tolerant work. Or use a push queue where the platform invokes a handler per message, which restores low latency and, on some platforms, removes the authentication problem because the consumer has no public URL at all.

**★ Why does an idle worker need backoff at all — it is doing nothing?**
It is doing nothing *useful*, but the claim query is not free. Each one is a round trip, a `ROW SHARE` table-level lock, and an index scan, and there is one per worker per interval regardless of whether any work exists. A fleet of ten workers on a fixed 250 ms interval issues forty of them per second, permanently, against the same primary that serves your users — and it does so most persistently at night, when the queue is emptiest. Exponential backoff with jitter reduces that to a trickle while idle and returns to a tight loop the instant a claim succeeds, so the only cost is a few seconds of extra latency on the first job after a quiet period. Adding jitter matters because otherwise every worker's backoff aligns and you get synchronised bursts.

**★ How do you size batch, concurrency and `pool.max` against each other?**
Concurrency is the real decision — how many jobs this process should run at once, driven by whether the work is I/O-bound or CPU-bound. `pool.max` follows it, set to concurrency plus a small margin so control-plane statements like heartbeats and outcome writes are never queued behind the jobs they manage; below concurrency, node-postgres silently queues requests in FIFO order and your job durations grow with no error anywhere. Batch follows too: claim no more than the free capacity, because every claimed job is leased from the moment of the claim, so a batch larger than you can process concurrently means the tail of your own batch expires under you. Then check the total against the server: instances times `pool.max`, plus the app's own connections, must fit under `max_connections` minus the superuser reserve.

**★ What does a correct shutdown look like, and why is releasing leases part of it?**
Stop claiming first, so no new work is taken. Wait a bounded time for in-flight jobs to finish — bounded, because one stuck job must not prevent the process exiting. Then explicitly return any lease you still hold by setting those rows back to `pending`, and close the pool. The release step is the one people omit, and it matters because without it, recovery for those jobs takes a full lease period; on a five-minute lease that is a five-minute stall after every rolling deploy, which teams then "fix" by shortening the lease and thereby introduce duplicate execution for slow jobs. The orchestrator has to cooperate: its termination grace period must exceed your drain timeout or `SIGKILL` arrives mid-drain and you are back where you started.

**Cron fires your drain route every minute and the drain sometimes takes longer than that. How bad is it?**
Much less bad than it would be without `SKIP LOCKED`, which is a good illustration of why the claim query matters. The second invocation's claims simply skip the rows the first has locked, so the two drains process disjoint work rather than duplicating it — overlap becomes extra capacity rather than a correctness problem. What it does cost is connections: two pools instead of one, each opening up to `max`, against a `max_connections` you sized for one. So bound the drain by the invocation deadline so it cannot run indefinitely, and if you need strict single-execution — because the job itself is a reconciliation sweep that must not run twice — take an advisory lock at the top of the handler and return early if you do not get it.

**A slow job kind is starving a fast one. What do you change?**
Split the lane, not the concurrency. Adding workers does not help, because the slow kind will fill the new slots too; the problem is that one queue with one claim query treats a five-minute transcode and a 200 ms email as interchangeable. Add a `kind = ANY($4)` predicate to the claim and run two deployments with different kind lists, so the fast lane has guaranteed capacity that the slow lane cannot take. A weaker version — a `priority` column in the `ORDER BY` — helps with ordering but not with occupancy, because a high-priority job still waits for a slot that a running transcode is holding. Separate pools of workers is the only thing that bounds the wait.

**Why one pool per process rather than one per job, or one per request?**
Because a pool's entire value is amortising the connection handshake and bounding concurrent connections, and both properties are lost if you keep making new ones — node-postgres puts it plainly: *"Creating an unbounded number of pools defeats the purpose of pooling at all."* A fresh pool per job pays the handshake every time and, worse, removes the bound: ten concurrent jobs with a `max` of ten each is a hundred connections rather than ten. The serverless drain route is the interesting exception, because the process may genuinely not outlive the invocation — and that is exactly why it must call `pool.end()` in a `finally`, so the connections do not outlive it either.

---

← [04ea · External effects and provider idempotency](04ea-external-effects-and-provider-idempotency.md) · Next → [04fa · `LISTEN`/`NOTIFY` and the latency floor](04fa-listen-notify-and-the-latency-floor.md)
