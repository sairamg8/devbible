---
title: "ExecutorService and pools"
sidebar_label: "06 · ExecutorService and pools"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-18 against the JDK 25 Javadoc for `ExecutorService`,
> `ThreadPoolExecutor`, `Executors`, `ScheduledThreadPoolExecutor`,
> `Future` and `ThreadFactory`, plus JEP 444 (Virtual Threads) for the
> per-task executor.

**Threads are expensive to create and dangerous to create without bound,
so Java's answer since 1.5 has been: applications submit *tasks*, an
`ExecutorService` owns the *threads*. Every serious JVM service runs on
this machinery — web server worker pools, async jobs, scheduled cleanups —
and most production concurrency incidents (silent task death, unbounded
queues eating the heap, shutdowns that hang deploys) are misuses of these
few classes, not exotic races.**

This topic runs deeper than one file. The chunks:

| # | Chunk | Covers |
|---|---|---|
| 1 | **[Anatomy of a pool](01-anatomy-of-a-pool.md)** | Why pools exist, `ThreadPoolExecutor`'s seven constructor arguments, the core→queue→max admission rule everyone gets backwards, the `Executors` factories and their traps, rejection policies, `ThreadFactory` naming |
| 2 | **[Submitting work and getting results](02-submit-and-futures.md)** | `execute` vs `submit` and the swallowed-exception trap, `Future.get` and timeouts, cancellation, `invokeAll`/`invokeAny`, the happens-before edges the executor gives you |
| 3 | **[Scheduling and sizing](03-scheduling-and-sizing.md)** | `ScheduledExecutorService` — fixed-rate vs fixed-delay, the exception that silently cancels a periodic task; sizing CPU-bound vs I/O-bound pools as reasoning, not folklore |
| 4 | **[Shutdown, and what virtual threads change](04-shutdown-and-virtual-threads.md)** | `shutdown` vs `shutdownNow` vs `close`, the drain pattern that doesn't hang deploys, try-with-resources executors, `newVirtualThreadPerTaskExecutor` and the end of pool-sizing for I/O |

## Why this is a Master topic

- **It is the unit of concurrency you actually use.** Application code
  submits tasks; frameworks (Spring's `@Async`, servlet containers,
  schedulers) are configured *as* pools. You will tune these arguments in
  production even if you never start a raw `Thread`.
- **The defaults are traps.** The convenient factories hide either an
  unbounded queue or unbounded thread creation; the default rejection
  policy throws; `submit` eats exceptions unless someone calls `get`.
  Knowing the seven constructor arguments is the difference between a
  bounded, observable system and a heap dump.
- **Shutdown is a deploy-blocking concern.** The three-method protocol and
  the await/force pattern decide whether your service stops in two seconds
  or gets SIGKILLed with tasks half-done.
- **Virtual threads rewrote one third of it.** Pooling still governs CPU
  work and bounded resources, but "size the pool for I/O concurrency" is
  now legacy reasoning — you need both models and the judgement of when
  each applies.

## Where this connects

- **[The Java Memory Model](../05-java-memory-model/README.md)** — the
  executor's submit/complete edges are the documented happens-before
  guarantees that make task handoff safe without `volatile`.
- **Topic 02 · Platform vs virtual threads** *(not written yet)* — what a
  thread costs and why millions of virtual ones are fine.
- **Topic 07 · `CompletableFuture`** *(not written yet)* — composition on
  top of executors; **topic 08 · Structured concurrency** *(not written
  yet)* — the JEP 505 successor for fan-out.
- **[try-with-resources](../../phase-5-exceptions/03-try-with-resources/README.md)** —
  `ExecutorService` is `AutoCloseable` since JDK 19; chunk 4 shows the
  idiom.

---

← Prev: [The Java Memory Model](../05-java-memory-model/README.md) · Index: [Phase 6 — Concurrency](../README.md) · Next → [Anatomy of a pool](01-anatomy-of-a-pool.md)
