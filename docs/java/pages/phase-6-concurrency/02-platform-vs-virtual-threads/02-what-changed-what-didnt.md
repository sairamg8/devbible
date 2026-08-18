---
title: "What changed, what didn't"
sidebar_label: "2 · What changed, what didn't"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-18 against JEP 444 (goals and non-goals), the JDK 25
> Javadoc for `java.lang.Thread` (virtual-thread notes: daemon status,
> priority, thread locals), JLS SE 25 §17 (the memory model, unchanged),
> and the JDK 25 Core Libraries virtual-threads guide (scheduling,
> observability).

**Virtual threads change the economics of blocking and nothing about the
semantics of sharing. That sentence sorts every claim you will hear about
them. "We can go back to thread-per-request" — economics, true. "The code
got faster" — economics *maybe*, and only as throughput. "We don't need to
worry about synchronization now" — semantics, flatly false: the memory
model, races, deadlocks and the interruption protocol are identical on
both thread kinds, because a virtual thread IS a thread.**

## What changed

**Blocking became free enough to design around.** The classic tax —
"a blocked thread wastes a scarce OS thread" — is gone, so the style it
forced is obsolete for I/O-bound work:

- **Thread-per-request returns.** One virtual thread owns one request
  end-to-end: blocking calls in a straight line, the whole request visible
  in one stack trace, context flowing in locals down the call chain. The
  request's concurrency is the thread count, and the thread count can be
  the request count.
- **The async detour loses its main justification.** `CompletableFuture`
  chains and reactive pipelines existed to keep threads unblocked
  (**topic 07** *(not written yet)* still matters — for *composition*, not
  for thread economy). JEP 444 is explicit that plain blocking code on
  virtual threads is the intended replacement for async style where
  hardware utilization was the only reason for it.
- **Capacity limits moved.** The pool size was an accidental global
  throttle. With threads unlimited, *nothing* throttles you by default —
  the new limit is whatever your downstreams tolerate, and it must be
  expressed deliberately ([chunk 3](03-using-them-well.md)'s semaphore).
- **Fan-out got a natural shape.** Call three services concurrently by
  starting three virtual threads and joining — cheap enough to do per
  request, at every level. Structured concurrency (**topic 08** *(not
  written yet)*) turns that shape into an API with cancellation.

**Throughput, not speed.** A virtual thread runs bytecode at exactly
platform speed — same JIT, same everything. What improves is *utilization
under blocking*: more concurrent requests in flight per unit of hardware.
Latency of a single request does not drop; JEP 444's non-goals say this in
so many words. If a benchmark shows single-task code "getting faster" on
virtual threads, the benchmark is measuring something else.

## What didn't change

**The memory model.** JLS §17 knows nothing of carriers. Data races,
visibility, happens-before (**topic 05** *(not written yet)*) apply
unchanged — two virtual threads incrementing a shared counter lose updates
exactly as platform threads do (**topic 03** *(not written yet)*). Virtual
threads *multiply* the number of threads you run, which makes discipline
about shared state more load-bearing, not less —
[immutability first](../../phase-2-classes-objects/12-immutable-design/README.md)
scales; fine-grained locking of hotter hot spots does not.

**Locks and deadlocks.** `synchronized` means the same thing, blocks the
same way, deadlocks the same way (**topic 13** *(not written yet)*). A
lock-ordering bug ported to virtual threads is the same bug with more
threads available to hit it.

**Interruption and lifecycle.** The
[cooperative protocol](../01-threads-lifecycle-interrupt/02-interruption.md)
is identical — same flag, same `InterruptedException` contract, same
states from `Thread.getState()`. Three fixed properties differ, all
consequences of "cheap and plentiful": a virtual thread is **always a
daemon** (`setDaemon(false)` throws `IllegalArgumentException` — it can
never hold the JVM open), its **priority is fixed** at `NORM_PRIORITY`
(`setPriority` is a no-op on it), and its **default name is empty**.

**`ThreadLocal` works — its habits don't.** Thread locals function on
virtual threads (JEP 444 kept compatibility), but two pool-era habits
turn toxic: caching *expensive-to-create* objects in a `ThreadLocal`
(amortized over a long-lived worker before; now created once per task and
multiplied by a million threads) and expecting reuse (a per-task thread
dies with its locals — nothing is "warm"). The replacement design —
`ScopedValue`, immutable one-way context — is **topic 12** *(not written
yet)*.

## Observability: better traces, different dumps

- **Stack traces describe requests again.** The request's whole story is
  one synchronous stack — the debugging regression of async style
  reverses. Exception handling is ordinary `try`/`catch` around blocking
  calls; everything [phase 5](../../phase-5-exceptions/README.md) taught
  applies without translation.
- **Traditional thread dumps don't scale to the new counts.** A flat dump
  of two million threads is unreadable; `jcmd Thread.dump_to_file` gained
  a JSON format that groups virtual threads by structured-concurrency
  scope (JEP 444's observability section). Profilers and APMs needed — and
  by now largely shipped — virtual-thread awareness; check yours before
  trusting its thread counts.
- **Metrics keyed to pool health go quiet.** Queue depth and active-worker
  gauges were the early-warning system for saturation. Their replacements
  are in-flight request counts and semaphore permits — the explicit limits
  chunk 3 introduces.

## Gotchas

**Symptom:** after migrating to virtual threads, a low-frequency "impossible" data corruption becomes a weekly event
**Cause:** the race was always there; thread count went from 200 to 200,000 and the interleaving window gets hit proportionally more often
**Fix:** virtual threads are a *load amplifier* for existing races — fix the sharing (immutability, confinement, locks), don't blame the thread kind

**Symptom:** team removes `synchronized` blocks "because virtual threads made them unnecessary"
**Cause:** category error — cheap blocking changed the cost of *waiting*, not the need for mutual exclusion
**Fix:** every synchronization decision survives the migration verbatim; only *pooling* decisions are up for review

**Symptom:** single-user latency test shows zero improvement on virtual threads; migration declared a failure
**Cause:** wrong metric — virtual threads buy concurrent capacity under blocking, not per-request speed
**Fix:** benchmark throughput at high concurrency with realistic downstream latency; that is the axis JEP 444 targets

**Symptom:** memory profile shows millions of short-lived `SimpleDateFormat`/buffer instances after migration
**Cause:** `ThreadLocal` caches sized for "one per pool worker" now allocate one per task-thread
**Fix:** share immutable/thread-safe objects (`DateTimeFormatter`), pool genuinely expensive resources explicitly, or scope context with `ScopedValue` (**topic 12** *(not written yet)*)

**Symptom:** service with virtual threads accepts unbounded work and falls over downstream — the database, not the JVM, dies first
**Cause:** the thread pool was the accidental backpressure; nothing replaced it
**Fix:** explicit limits at the resource: bounded connection pools plus a semaphore around the constrained call ([chunk 3](03-using-them-well.md))

**Symptom:** ops dashboard "thread count" alert fires permanently after rollout
**Cause:** the alert assumed platform-thread economics where 10k threads meant a leak
**Fix:** re-key saturation monitoring to in-flight work and carrier-pool health; thread count is no longer a scarcity signal

**Symptom:** shutdown hook waits on a "background" virtual thread that was silently abandoned at exit
**Cause:** virtual threads are always daemons — they never hold the JVM open, and daemons are dropped without cleanup
**Fix:** work that must complete before exit runs on a platform thread, or shutdown explicitly joins the virtual threads it cares about (executor `close()`)

## Interview questions

**★ "Virtual threads make Java faster." Refine that claim until it's true.**
They make *blocking cheap*, which raises *throughput* of I/O-bound
workloads: more concurrent requests per box because waiting threads no
longer consume OS threads. Per-request latency and CPU-bound performance
are unchanged — same JIT, same bytecode speed, and JEP 444 lists "faster
code" among its non-goals.

**★ Which concurrency bugs do virtual threads eliminate?**
None. Races, visibility failures, deadlocks, livelocks and lost updates
are memory-model and coordination phenomena, identical on both kinds.
Virtual threads typically *surface* latent bugs faster by multiplying
thread count. What they eliminate is a *resource* problem — thread
scarcity — and the architectural contortions it forced.

**★ Why is a virtual thread forcibly a daemon with a fixed priority?**
Both properties only ever made sense for scarce, long-lived, kernel-
scheduled threads. Millions of cheap threads can't each hold the JVM open
(shutdown semantics belong to explicit joins/executors), and priorities
are meaningless under a scheduler that switches at blocking points rather
than time-slicing. The API enforces the semantics: `setDaemon(false)`
throws, `setPriority` is a no-op.

**★ Your service moved to virtual threads and the DBA reports connection storms. What happened and what's the fix?**
The old worker pool capped concurrent requests — and thereby concurrent
connection demand — by accident. Virtual threads removed the cap; every
spike now reaches the database at full width. Fix: make the limit
explicit at the constrained resource — the connection pool stays bounded,
and a `Semaphore` (or bulkhead) gates entry to the DB-touching section so
excess load queues in cheap parked threads instead of storming the pool.

**★ How does `ThreadLocal` behave on virtual threads, and when does it become a problem?**
It works — each virtual thread has its own values. It becomes a problem
through pool-era usage patterns: locals as caches for expensive objects
(now one instance per task × millions of tasks) and locals as reusable
scratch state (per-task threads never reuse). Request-context propagation
migrates to `ScopedValue` — immutable, explicitly scoped, designed for
the million-thread world.

**★ What did thread dumps and monitoring have to change for virtual threads?**
Flat dumps listing every thread stop being readable at virtual-thread
counts; `jcmd` gained a JSON thread-dump format grouping virtual threads
(by structured-concurrency scope) for tooling to consume. Saturation
metrics move from pool gauges (queue depth, active workers) to explicit
in-flight-work measures, since no pool exists to observe.

---

← Prev: [What a thread costs](01-what-a-thread-costs.md) · Index: [Platform vs virtual threads](README.md) · Next → [Using them well](03-using-them-well.md)
