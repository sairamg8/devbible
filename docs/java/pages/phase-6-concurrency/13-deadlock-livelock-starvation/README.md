---
title: "Deadlock, livelock, starvation"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-18 against the JDK 25 Javadoc for `Thread.State` and
> `java.lang.management.ThreadMXBean`, the JDK Troubleshooting Guide
> (jstack / `jcmd Thread.print`), and the Oracle concurrency tutorial's
> liveness pages.

**A deadlock is the honest failure mode of locking: two threads each hold
what the other needs, and both wait forever — no exception, no log line,
just requests that never return. The cure is a discipline (acquire locks
in one global order), and the diagnosis is a skill (read `BLOCKED` in a
thread dump). Livelock and starvation are the quieter siblings: threads
that stay busy but make no progress, and threads that make progress —
eventually, sometimes, maybe.**

The chunks:

| # | Chunk | Covers |
|---|---|---|
| 1 | **[Deadlock and lock ordering](01-deadlock-and-lock-ordering.md)** | The four Coffman conditions in Java terms, the two-lock inversion, the global-ordering rule (and the `identityHashCode` tie-break), open calls, resource deadlocks — pools and connections, not just monitors |
| 2 | **[Reading the dump; livelock and starvation](02-dumps-livelock-starvation.md)** | Taking a dump, `BLOCKED` vs `WAITING`, the JVM's own deadlock detector, `ThreadMXBean`, virtual-thread dumps — then livelock's polite collision and starvation's unfairness |

## Why diagnosis comes before theory

- **Deadlocks ship.** They pass tests (the interleaving needs load) and
  then freeze a subset of production threads; the service degrades rather
  than dies, which is worse — health checks pass while throughput decays.
- **The dump is the whole truth.** Unlike races, a deadlock is fully
  visible post-hoc: the dump names both threads, both monitors, and both
  stack traces, and the JVM will even say "Found one Java-level deadlock".
  Knowing that output cold turns a 3am mystery into a two-minute read.
- **The fix is architectural, not local.** You can't `catch` a deadlock;
  you prevent it with ordering discipline or escape it with timeouts
  ([topic 09 · Explicit locks](../09-explicit-locks.md)).

## Where this connects

- **[`synchronized` and intrinsic locks](../04-synchronized-intrinsic-locks/README.md)** —
  the lock semantics that make circular wait possible.
- **[ExecutorService and pools](../06-executorservice-pools/02-submit-and-futures.md)** —
  thread-starvation deadlock: the pool-sized variant that needs no locks
  at all.
- **[Reading a stack trace fast](../../phase-5-exceptions/05-reading-stack-traces/README.md)** —
  the same scan skills, pointed at threads instead of exceptions.

---

← Prev: [`ScopedValue` — the 25-era replacement](../12-threadlocal-scopedvalue/02-scopedvalue.md) · Index: [Phase 6 — Concurrency](../README.md) · Next → [Deadlock and lock ordering](01-deadlock-and-lock-ordering.md)
