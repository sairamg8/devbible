---
title: "Phase 6 — Concurrency"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: Java 25 (LTS).** Documentation-validated — every page names its
> sources on a `> Verified:` line (the JLS §17 memory model, the
> `java.util.concurrent` API docs, JEP 444/491/506 and the structured
> concurrency JEPs). No sandbox: pages carry Java code, never fabricated
> program output — and never fabricated thread dumps.

The deepest phase in the syllabus, on purpose. Virtual threads made concurrent
Java simple to *write* — the model underneath is unchanged, and it is the
model that pages you at 3am if you skip it.

✅ **17 of 17 written — phase complete.**

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **[Threads: lifecycle, interrupt](01-threads-lifecycle-interrupt/README.md)** | <span className="db-tier t-understand">Understand</span> | Interruption is cooperative cancellation, not a kill switch |
| 02 | **[Platform vs virtual threads](02-platform-vs-virtual-threads/README.md)** | <span className="db-tier t-master">Master</span> | Millions of cheap threads; what changed and what didn't |
| 03 | **[Race conditions](03-race-conditions/README.md)** | <span className="db-tier t-master">Master</span> | Check-then-act, read-modify-write — the double-charge bug |
| 04 | **[`synchronized` and intrinsic locks](04-synchronized-intrinsic-locks/README.md)** | <span className="db-tier t-master">Master</span> | What it guards; lock on private finals, not `this` |
| 05 | **[The Java Memory Model](05-java-memory-model/README.md)** | <span className="db-tier t-understand">Understand</span> | Visibility, happens-before, `volatile` — the flag that never stops |
| 06 | **[`ExecutorService` and pools](06-executorservice-pools/README.md)** | <span className="db-tier t-master">Master</span> | Sizing for CPU vs I/O; shutdown done right |
| 07 | **[`CompletableFuture`](07-completablefuture/README.md)** | <span className="db-tier t-understand">Understand</span> | Fan-out to three services and join; `thenCompose` vs `thenApply` |
| 08 | **[Structured concurrency](08-structured-concurrency.md)** | <span className="db-tier t-know">Know</span> | `StructuredTaskScope`: subtasks that cannot leak |
| 09 | **[Explicit locks](09-explicit-locks.md)** | <span className="db-tier t-know">Know</span> | `ReentrantLock`'s `tryLock` — the deadlock escape hatch |
| 10 | **[Atomics](10-atomics.md)** | <span className="db-tier t-understand">Understand</span> | `compareAndSet`, `LongAdder` for hot counters |
| 11 | **[Concurrent collections](11-concurrent-collections.md)** | <span className="db-tier t-understand">Understand</span> | `ConcurrentHashMap.computeIfAbsent` — the one-line cache |
| 12 | **[`ThreadLocal` and `ScopedValue`](12-threadlocal-scopedvalue/README.md)** | <span className="db-tier t-understand">Understand</span> | Request context; the pool leak; the 25-era replacement |
| 13 | **[Deadlock, livelock, starvation](13-deadlock-livelock-starvation/README.md)** | <span className="db-tier t-understand">Understand</span> | Lock ordering, and reading `BLOCKED` in a thread dump |
| 14 | **[Virtual-thread pinning](14-virtual-thread-pinning.md)** | <span className="db-tier t-know">Know</span> | What pinning is; `synchronized` pinning fixed in 24 (JEP 491) |
| 15 | **[Immutability as the first strategy](15-immutability-first-strategy/README.md)** | <span className="db-tier t-master">Master</span> | Share nothing mutable and most hazards vanish |
| 16 | **[Coordination primitives](16-coordination-primitives.md)** | <span className="db-tier t-know">Know</span> | `CountDownLatch`, `Semaphore`, `CyclicBarrier` |
| 17 | **[`wait`/`notify` — the legacy protocol](17-wait-notify-legacy.md)** | <span className="db-tier t-know">Know</span> | Recognize it in old code; never start with it |

## Phase gate

Move on when you can explain why `counter++` from two threads loses updates,
fix it three ways (`synchronized`, `AtomicLong`, confinement), and say which
you'd ship — and why virtual threads change none of it.

## Where this connects

- **[Phase 2](../phase-2-classes-objects/README.md)** topic 12 (immutable
  design) is this phase's topic 15 seen from the design side.
- **Phase 9 — Spring** runs your code on these threads: one (virtual) thread
  per request is the servlet model.
- **Phase 12 — The JVM in production** reads the thread dumps this phase
  teaches you to cause.
