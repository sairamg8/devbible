---
name: devbible-phase7-measurements
description: The full measured dataset for Node Phase 7 (background work and resilience) — every number and console line the 16 pages are built from, captured 2026-08-10 on Node 24.19.0
metadata:
  type: reference
---

Child of [[devbible-progress]]. **Working data, not curated** — this exists so the
Phase 7 pages can be written without rebuilding the sandbox. Once all 16 pages are
written, keep only what contradicts common advice (move it into
[[devbible-phase-findings]]) and delete the rest.

## The sandbox

Session scratchpad, outside the project: `…/scratchpad/p7/`.

| Container | Image | Port |
|---|---|---|
| `p7-pg` | `postgres:17-alpine` (17.10) | 55432 — db `shop`, user `postgres`, pw `devbible` |
| `p7-redis` | `redis:8-alpine` (**8.10.0**) | 56379 |

Versions: `pg` 8.23.0 · **`bullmq` 6.0.10** · **`ioredis` 6.0.0**. Connect with
`127.0.0.1`, never `localhost` (same `verbatim` DNS default as phases 5 and 6).

Scripts: `ex1-outbox` `ex2-skiplocked` `ex3-bullmq` `ex4-shutdown` (+`worker.mjs`)
`ex5-sync-vs-bg` `ex6-time` `ex7-overlap` `ex7b-lock`.

## Sync vs background (page 01)

HTTP server, handler doing 120 ms of **blocking CPU** vs enqueuing to BullMQ,
10 concurrent requests:

```
10 concurrent /sync    { total: 1264, p50: 761, p95: 1246 }
10 concurrent /queued  { total: 21,   p50: 18,  p95: 19 }
```

**p95 1246 ms → 19 ms.** The inline version serialises on the event loop, so request
10 waits for all nine before it. Worker with `concurrency: 2` drained all 10 after.

## Job queues, SKIP LOCKED (pages 02, 04)

20 jobs, 3 competing workers, `update … where id = (select … for update skip locked
limit 1) returning`:

```
3 workers drained 20 jobs in 94 ms
A got 8 | B got 6 | C got 6
total claims 20 | unique 20        <- no job delivered twice
same 20 jobs WITHOUT skip locked: 189 ms
```

**2× faster and provably no double delivery.** Without `SKIP LOCKED` the three
workers queue behind the same row.

Visibility timeout: a row with `locked_until = now() + 2s` was **not** claimable;
after it expired it was reclaimed, and `attempts` had incremented — that counter is
how a poison job is detected.

## BullMQ retries and DLQ (pages 04, 07)

`attempts: 4, backoff: {type:'exponential', delay:200}`, worker always throws:

```
attempt timings (ms from start): 20, 300, 810, 1610      <- gaps 280 / 510 / 800
attemptsMade: 4 | final state: failed
failedReason: SMTP 421 service unavailable
counts: { completed: 0, failed: 1, delayed: 0, waiting: 0 }
moved to DLQ: { waiting: 1 }
```

BullMQ has **no built-in DLQ** — the failed set *is* the holding area, and moving
exhausted jobs to a separate `emails.dead` queue is a few lines you write.

## Graceful shutdown and stalled jobs (page 11)

Worker with a 3 s job, `lockDuration: 5000, stalledInterval: 2000`, killed 1.2 s in.

**SIGTERM + `await worker.close()`:**
```
[worker 36224] SIGTERM — closing, will finish the in-flight job
[worker 36224] finished job 1
[worker 36224] closed after 2125 ms
SIGTERM: { completed: 1, failed: 0, active: 0, waiting: 0, delayed: 0 }
```

**SIGKILL:**
```
SIGKILL: { completed: 0, failed: 0, active: 1, waiting: 0, delayed: 0 }
```
The job sat in **`active` with nobody working it**. A fresh worker started, the stall
detector re-delivered it, and it completed. Recovery took under 9 s with those
settings.

## Dual write vs outbox (page 06)

```
dual write: enqueue failed -> redis unavailable
dual write: orders = 1 | jobs enqueued = 0   <- order exists, nothing will process it
outbox: orders = 2 | outbox rows = 1
outbox after rollback: orders = 2 | outbox rows = 1   <- neither, together
relay: published 1 event(s): {"orderId":2}
```

Relay is the same `for update skip locked` query, setting `published_at`.

## Idempotency (page 05)

```
naive job run twice      -> emails_sent = 2
idempotent job run twice -> rowCounts 1 0 | emails_sent = 1
```

`insert … (idempotency_key) values ($1) on conflict (idempotency_key) do nothing` —
the second run's `rowCount` is **0**, which is also how the job knows it was a repeat.

## Concurrency limiting (page 16)

```
Promise.all over 200 items -> peak in-flight 200
mapLimit(8) over 200 items -> peak in-flight 8, 511 ms
```

## Backoff and jitter (page 15)

500 clients, 3 attempts, `100 * 2**(n-1)`, bucketed by 100 ms:

```
no jitter  : 700ms:500                    <- all 500 retry in the same instant
full jitter: 0ms:22 100ms:67 200ms:112 300ms:122 400ms:108 500ms:62 600ms:7
             max bucket 122
```

## Timeout budgets and deadline propagation (pages 12, 13)

```
AbortSignal.timeout(300) -> aborted after 306 ms: TimeoutError |
  The operation was aborted due to timeout
budget starts at 500 ms; after a 200 ms step, downstream gets 300 ms
second call aborted after 301 ms (not a fresh 500)
deadline propagation -> [ 'db cancelled', 'cache cancelled', 'webhook cancelled' ]
abort reason: client disconnected
```

`ac.abort(new Error(...))` — `signal.reason` carries the Error through.

## Scheduled jobs: drift and overlap (page 08)

```
setInterval(100) with a 30 ms job -> 130, 230, 331, 432, 533, 634, 734, 835
8 ticks should end at 800 ms; ended at 835 ms — drift 35 ms
setInterval(100) + a 250 ms job -> 9 runs, up to 3 at once   <- overlap
with an overlap guard           -> 3 runs, max 1 at once, 6 ticks skipped
```

Cross-instance, two **explicitly checked-out clients** (pids 74 and 75):
```
instance A got the lock: true
instance B got the lock: false      <- only one instance runs the nightly job
after A unlocks, B gets it: true
```

**A trap re-confirmed here:** the first attempt used `pool.query` for both "instances"
and both got `true` — `pg_try_advisory_lock` is reentrant *within a session*, and
`pool.query` handed back the same connection. Same root cause as the phase-6
transaction scatter. Any lock/session test needs `pool.connect()`.

## Time on the server (page 10)

`TZ=Asia/Kolkata`, instant `2026-08-10T18:45:00Z`:

```
stored (UTC):              2026-08-10T18:45:00.000Z
server-local toString():   Tue Aug 11 2026 00:15:00 GMT+0530 (India Standard Time)
toISOString().slice(0,10): 2026-08-10
what the IST user sees:    2026-08-11        <- a whole day apart
```

DST: trial start `2026-03-07T12:00:00Z` + `7*24*60*60*1000` ms, rendered in
`America/New_York` → **2026-03-14, 8:00 a.m.** — started at 7:00 a.m., the arithmetic
moved the wall-clock hour across the March 8 transition.

"End of day for a user in Asia/Kolkata" (2026-08-11 midnight IST) is
**2026-08-10T18:30:00.000Z** — the previous UTC day.
