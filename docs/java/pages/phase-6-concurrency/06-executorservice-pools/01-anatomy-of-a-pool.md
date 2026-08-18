---
title: "Anatomy of a pool"
sidebar_label: "1 · Anatomy of a pool"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-18 against the JDK 25 Javadoc for `ThreadPoolExecutor`
> (class documentation — core/maximum pool sizes, queuing, rejected tasks),
> `Executors`, `ThreadFactory`, `LinkedBlockingQueue`, `SynchronousQueue`
> and `ArrayBlockingQueue`.

**A thread pool exists because platform threads are costly to create
(an OS thread, a stack) and fatal to create without bound. The pool
decouples "work arrives" from "a thread starts": tasks queue, a fixed set
of workers drains them, and the seven constructor arguments of
`ThreadPoolExecutor` decide the only three outcomes an arriving task can
have — run now, wait, or be rejected. Every convenience factory is just a
preset over those seven arguments, and every pool incident is one of the
presets meeting the load it didn't expect.**

## The seven arguments

```java
new ThreadPoolExecutor(
    corePoolSize,      // threads kept alive even when idle
    maximumPoolSize,   // hard ceiling on threads
    keepAliveTime,     // how long threads above core may idle...
    unit,              // ...before being reclaimed
    workQueue,         // BlockingQueue<Runnable> holding waiting tasks
    threadFactory,     // creates the threads — set the names here
    handler            // RejectedExecutionHandler — the overflow policy
);
```

Two refinements worth knowing: `allowCoreThreadTimeOut(true)` lets even
core threads die after `keepAliveTime` (a pool that scales to zero), and
`prestartAllCoreThreads()` warms the core up front instead of lazily on
first submissions.

## The admission rule — core → queue → max → reject

The part most engineers state backwards. When a task arrives
(`ThreadPoolExecutor` class Javadoc):

1. Fewer than `corePoolSize` threads running → **start a new thread**,
   even if others are idle.
2. Core full → **offer the task to the queue**.
3. Queue full and threads < `maximumPoolSize` → **start a non-core
   thread**.
4. Queue full and threads at max → **hand to the
   `RejectedExecutionHandler`**.

The consequence: **`maximumPoolSize` only matters if the queue can fill.**
With an unbounded `LinkedBlockingQueue`, step 3 is unreachable — the pool
never grows past core, no matter the backlog. A "max 200" configured next
to an unbounded queue is a comment, not a limit.

## The factories, decoded as presets

| Factory | Core / Max | Queue | The catch |
|---|---|---|---|
| `newFixedThreadPool(n)` | n / n | unbounded `LinkedBlockingQueue` | backlog grows without limit — memory is the failure mode |
| `newCachedThreadPool()` | 0 / `Integer.MAX_VALUE` | `SynchronousQueue` (no capacity) | thread count grows without limit — thread explosion under burst |
| `newSingleThreadExecutor()` | 1 / 1 | unbounded | serial and ordered, same unbounded backlog; wrapper prevents reconfiguration |
| `newScheduledThreadPool(n)` | n / (effectively core-bound) | internal delay queue | covered in [chunk 3](03-scheduling-and-sizing.md) |
| `newVirtualThreadPerTaskExecutor()` | — no pool at all | — | one virtual thread per task; [chunk 4](04-shutdown-and-virtual-threads.md) |

The pattern: each factory picks *which resource is unbounded* — memory
(fixed, single) or threads (cached). A production pool for meaningful
load usually wants the explicit constructor: bounded queue
(`ArrayBlockingQueue(capacity)`), a real max, and a rejection policy you
chose on purpose.

## Rejection policies

Four built-ins, all nested classes of `ThreadPoolExecutor`:

- **`AbortPolicy`** (default) — throw `RejectedExecutionException` at the
  submitter. Loud, honest; callers must handle it.
- **`CallerRunsPolicy`** — the *submitting* thread runs the task itself.
  Elegant backpressure: the producer slows down because it's busy doing
  the work it tried to hand off. Trap: on a server, "the caller" may be a
  request thread — or the pool's own upstream — and the task now runs
  outside the pool's thread budget.
- **`DiscardPolicy`** — drop the task silently. Almost always wrong
  outside best-effort telemetry.
- **`DiscardOldestPolicy`** — drop the queue head, retry the offer. Only
  defensible when newest-wins is the real semantics (e.g. refreshing a
  snapshot).

A custom handler is a lambda away and is the right place for a metric —
a rejection counter is the earliest warning a pool is undersized.

## Name your threads

The default factory produces `pool-N-thread-M` — useless in a thread dump
with ten pools. A `ThreadFactory` that names threads is a debugging
investment that pays at 3am:

```java
ThreadFactory tf = Thread.ofPlatform()
        .name("order-worker-", 0)     // order-worker-0, order-worker-1...
        .daemon(false)
        .factory();                    // JDK 21+ builder; pre-21: implement ThreadFactory
```

Set an `UncaughtExceptionHandler` here too if you use `execute` — it is
the only place `execute`'s escaping exceptions surface
([chunk 2](02-submit-and-futures.md)).

## Gotchas

**Symptom:** pool configured `max=200` never runs more than 8 threads while the backlog climbs
**Cause:** unbounded queue — admission never reaches step 3, so non-core threads are never created
**Fix:** bounded queue sized as deliberate backlog budget; the max becomes reachable and rejection becomes your overload signal

**Symptom:** OutOfMemoryError hours into an incident; heap dump is millions of queued `Runnable`s
**Cause:** `newFixedThreadPool`'s unbounded queue absorbed a downstream slowdown until memory ran out
**Fix:** bounded queue + explicit rejection policy; alert on queue depth long before capacity

**Symptom:** burst traffic creates thousands of threads, then the process dies unable to create more
**Cause:** `newCachedThreadPool` — `SynchronousQueue` has no capacity, so every submission with no idle thread starts a new one up to `Integer.MAX_VALUE`
**Fix:** explicit `ThreadPoolExecutor` with a real max; or virtual threads if the tasks are I/O-bound ([chunk 4](04-shutdown-and-virtual-threads.md))

**Symptom:** under overload, requests slow to a crawl but nothing is rejected or logged
**Cause:** `CallerRunsPolicy` pushed work onto request threads — the "pool" silently annexed the caller's capacity
**Fix:** if backpressure is intended, document and bound it; otherwise abort with a metric and shed load explicitly

**Symptom:** tasks occasionally vanish under load; no exception anywhere
**Cause:** `DiscardPolicy` (or `DiscardOldestPolicy`) chosen "to be safe" — rejection is silent by design
**Fix:** discard only where loss is semantically fine; even then, count the discards

**Symptom:** pool sized `core=0` with a bounded queue barely runs tasks while the queue sits full
**Cause:** with zero core threads, work waits in the queue until it fills before non-core threads spin up (admission order: queue *before* extra threads)
**Fix:** keep `corePoolSize ≥ 1`; `allowCoreThreadTimeOut(true)` if scale-to-zero is the goal

**Symptom:** thread dump full of `pool-3-thread-17` — nobody knows which subsystem is stuck
**Cause:** default `ThreadFactory` names
**Fix:** named factory per pool (`payments-`, `email-`); the dump becomes self-documenting

## Interview questions

**★ Walk a task through `ThreadPoolExecutor` admission.**
Under core → new thread (even if some idle). Core full → queue. Queue
full and under max → new non-core thread. Queue full at max → rejection
handler. Corollary: an unbounded queue makes `maximumPoolSize` dead
configuration.

**★ Why is `newFixedThreadPool` dangerous in production despite the sensible name?**
Its queue is unbounded: any sustained arrival rate above service rate
grows the backlog without limit — latency climbs unboundedly and the heap
eventually fills with queued tasks. Bounded queue + rejection policy makes
overload visible and survivable instead.

**★ Fixed vs cached pool — which unbounded resource does each trade?**
Fixed bounds threads and unbounds memory (queue). Cached bounds nothing
on threads (max `Integer.MAX_VALUE`, zero-capacity handoff queue) and
holds no backlog. Fixed fails by heap under sustained overload; cached
fails by thread explosion under burst.

**★ When is `CallerRunsPolicy` a good idea, and what's the failure mode?**
Batch/pipeline systems where the producer *should* slow to the consumer's
pace — it converts overflow into backpressure with no lost work. Failure
mode: in request-serving systems the "caller" is a request or event-loop
thread; the policy silently moves heavy work onto threads with other
responsibilities and can deadlock a pool that submits to itself.

**★ You must process tasks strictly in submission order. What do you use and what do you give up?**
`newSingleThreadExecutor()` — one thread, FIFO queue, and the wrapper
can't be reconfigured wider later. You give up parallelism and inherit
the unbounded-queue caveat; for ordered-by-key parallelism, shard to
several single-threaded executors by key hash.

**★ Where do you put a metric that tells you a pool is undersized *before* users do?**
A custom `RejectedExecutionHandler` counting rejections, plus gauges on
`getQueue().size()` and `getActiveCount()`. Queue depth trending up at
stable arrival rate is the leading indicator; rejections are the alarm.

---

← Prev: [ExecutorService and pools](README.md) · Next → [Submitting work and getting results](02-submit-and-futures.md)
