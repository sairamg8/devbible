---
title: "Scheduling and sizing"
sidebar_label: "3 · Scheduling and sizing"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-18 against the JDK 25 Javadoc for
> `ScheduledExecutorService` (`scheduleAtFixedRate`,
> `scheduleWithFixedDelay` — including the suppression-on-exception and
> no-concurrent-execution clauses), `ScheduledThreadPoolExecutor`, and
> `Runtime.availableProcessors`. Sizing reasoning follows the model
> popularized by *Java Concurrency in Practice* (Goetz et al., 2006),
> cited as a heuristic, not a measurement.

**Two separate skills share this chunk because they share a failure mode:
configuration that looks obviously right and is quietly wrong.
`ScheduledExecutorService` replaces `Timer` and cron-in-process for
periodic work — but one uncaught exception cancels the schedule forever,
silently. And pool sizing has a folklore answer ("2× cores!") that
dissolves the moment you ask what the threads actually do while they
wait.**

## Scheduling: the API

```java
ScheduledExecutorService ses = Executors.newScheduledThreadPool(2);

ses.schedule(() -> expireToken(id), 30, TimeUnit.MINUTES);   // one-shot delay

ses.scheduleAtFixedRate(this::pollQueue, 0, 10, TimeUnit.SECONDS);
// aims for a start every 10s, measured from schedule time

ses.scheduleWithFixedDelay(this::compact, 1, 5, TimeUnit.MINUTES);
// next run starts 5min AFTER the previous one FINISHES
```

**Fixed rate vs fixed delay** is cadence vs spacing:

- `scheduleAtFixedRate(period)` targets *starts* at `initial`,
  `initial+period`, `initial+2·period`… If a run takes longer than the
  period, the Javadoc is precise: later runs "may start late, but will
  not concurrently execute" — they queue up back-to-back, they do **not**
  overlap, and missed starts are not executed twice concurrently.
- `scheduleWithFixedDelay(delay)` measures from *completion* to next
  *start* — guaranteed breathing room, natural drift. Right for
  maintenance work where "not too often" matters more than "on the tick".

## The exception that kills the schedule

The single most important sentence in the `ScheduledExecutorService`
Javadoc: *"If any execution of the task encounters an exception,
subsequent executions are suppressed."* One escaping
`RuntimeException` and your every-10-seconds poller has silently become a
never-again poller — the returned `ScheduledFuture` holds the exception,
but nobody reads a future they scheduled at startup and dropped.

The defensive shape for every periodic task:

```java
ses.scheduleAtFixedRate(() -> {
    try {
        pollQueue();
    } catch (Exception e) {                 // Exception, not Throwable
        log.error("pollQueue tick failed — schedule continues", e);
    }
}, 0, 10, TimeUnit.SECONDS);
```

Catch-log-continue is the correct policy at this boundary — it is the
compartment pattern of
[phase 5's global handler](../../phase-5-exceptions/08-global-handler.md),
one compartment per tick. Let `Error` escape (a broken JVM should not
keep ticking); catch `Exception`.

## Sizing: reason from what threads do

Threads exist to keep CPUs busy. Size from the ratio of waiting to
computing — the *Java Concurrency in Practice* heuristic:

```
N_threads ≈ N_cpu × U_target × (1 + W/C)
```

- `N_cpu` — `Runtime.getRuntime().availableProcessors()` (container-aware
  in modern JDKs: it reflects cgroup CPU limits, not the host's cores).
- `U_target` — the fraction of CPU this pool is *entitled to* (a service
  has other pools, GC, the OS).
- `W/C` — wait-to-compute ratio per task.

The two poles fall out:

- **CPU-bound** (`W/C ≈ 0`): `N_cpu` threads, maybe `+1` to cover page
  faults and stray stalls. More threads add context-switching and cache
  pressure, not throughput.
- **I/O-bound** (`W/C` large): a task computing 5ms then waiting 95ms has
  `W/C = 19`; on 8 entitled cores that reasons to ~160 threads. The
  number explodes with the wait ratio — which is exactly the regime where
  pooling platform threads stops making sense and virtual threads take
  over ([chunk 4](04-shutdown-and-virtual-threads.md)).

Two bounds trump the formula in practice: **downstream capacity** (a pool
of 160 hammering a database with a 20-connection pool just moves the
queue) and **memory** (each platform thread reserves stack). And the
formula's inputs are estimates — treat the result as a starting point to
adjust against observed queue depth and utilization, not a constant to
enshrine.

## Sizing the *queue* is part of sizing the pool

From [chunk 1](01-anatomy-of-a-pool.md): the queue absorbs bursts; its
capacity is your latency budget expressed in tasks. A bounded queue of
1,000 in front of a pool draining 100 tasks/sec means accepting up to ~10
seconds of backlog before rejecting — say that sentence about your own
numbers and the right capacity usually becomes obvious. Unbounded queues
don't remove the trade-off; they move it to the heap.

## Gotchas

**Symptom:** heartbeat/poller ran fine for days, then never again; no error in the logs at the time it stopped
**Cause:** one tick threw; per the Javadoc, subsequent executions are suppressed — the exception is parked in the ignored `ScheduledFuture`
**Fix:** try/catch-Exception-and-log inside every periodic task; alert on "time since last successful tick", not on errors

**Symptom:** a 10s-period fixed-rate task occasionally runs several times back-to-back
**Cause:** a slow tick overran the period; fixed-rate schedules the missed starts immediately after (never concurrently)
**Fix:** if spacing matters more than cadence, use `scheduleWithFixedDelay`; if cadence matters, make ticks idempotent and fast

**Symptom:** scheduled tasks fire minutes late under load
**Cause:** the scheduled pool's few threads are occupied by long-running task bodies — scheduling threads are workers too
**Fix:** keep scheduled bodies short: hand real work to a separate executor (`ses` ticks, `workers` execute)

**Symptom:** service in a container sized "cores × 2" runs far more threads than its CPU quota can drive
**Cause:** sizing used the host's core count from documentation or an env var; `availableProcessors()` already reflects the cgroup limit
**Fix:** size from `availableProcessors()` at runtime; re-check after changing container CPU limits

**Symptom:** raising an I/O-bound pool from 50 to 300 threads made p99 latency worse, not better
**Cause:** the bottleneck was downstream (DB connection pool, rate-limited API) — extra threads just queue inside the driver and add contention
**Fix:** size against the narrowest downstream bound; scale the pool only with the resources it feeds

**Symptom:** batch box with a CPU-bound pool of 64 on 8 cores shows high system time, mediocre throughput
**Cause:** 8× oversubscription — context switches and cache eviction eat the cycles the extra threads were meant to use
**Fix:** `N_cpu` (+1) for pure compute; parallelism beyond cores only helps when threads *wait*

## Interview questions

**★ Fixed rate vs fixed delay — and what happens when a task overruns its period?**
Fixed rate targets start times on a fixed cadence; overruns cause
subsequent starts to run late back-to-back, never concurrently. Fixed
delay guarantees a gap between completion and next start, letting the
schedule drift. Cadence for metrics emission; spacing for compaction-style
maintenance.

**★ Why did the team's scheduled job stop and how do you make that impossible?**
An execution threw; `ScheduledExecutorService` suppresses all subsequent
executions and stores the throwable in the un-read future. Wrap every
periodic body in try/catch-Exception with logging, and monitor freshness
(time since last success) rather than error counts.

**★ Derive a pool size for tasks that compute 2ms and wait 38ms, on 4 entitled cores.**
`W/C = 19`, so ~4 × (1+19) = 80 threads to keep 4 cores busy — then cap
it by what the downstream can take and note that at this wait ratio,
virtual threads (no sizing at all) are the modern answer.

**★ Why is "availableProcessors" the right input in containers?**
Modern JDKs make it cgroup-aware: it returns the container's effective CPU
limit, not the host cores. Hardcoding host-derived numbers oversizes pools
exactly where the quota is smallest.

**★ Your scheduled pool runs the ticks, and the ticks do heavy work. What's wrong?**
The scheduler's threads are its workers; long bodies delay every other
scheduled task sharing the pool. Separate concerns: tick cheaply on the
scheduled pool, submit the body to a sized worker pool.

**★ How do you choose a bounded queue's capacity?**
Express it as latency: capacity ÷ drain rate = worst-case queueing delay
you're choosing to accept before rejecting. Pick the delay budget first,
derive capacity, and alert on sustained depth well under it.

---

← Prev: [Submitting work and getting results](02-submit-and-futures.md) · Next → [Shutdown, and what virtual threads change](04-shutdown-and-virtual-threads.md)
