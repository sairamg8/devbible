---
title: "The Java Memory Model"
sidebar_label: "05 · The Java Memory Model"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-18 against JLS SE 25 §17.4 (Memory Model), §17.4.5
> (Happens-before Order), §17.5 (final Field Semantics), §17.7 (Non-Atomic
> Treatment of double and long), and the JDK 25 Javadoc for
> `java.util.concurrent` (package-level memory-consistency section).

**The Java Memory Model is the contract that says which writes a read is
allowed to see. Without synchronization, the answer is "almost anything":
the JIT reorders your statements, CPUs buffer stores, and a second thread
may see your writes late, out of order, or never. The JMM doesn't promise
sanity by default — it promises sanity *along happens-before edges*, and
every correct concurrent program is a chain of those edges. This is the
topic that explains why the stop-flag loop never stops, why double-checked
locking was broken for a decade, and what `volatile` actually buys.**

This topic runs deeper than one file. The chunks:

| # | Chunk | Covers |
|---|---|---|
| 1 | **[Reordering and visibility](01-reordering-and-visibility.md)** | Why reordering exists (JIT, store buffers), the flag that never stops, visibility vs atomicity, what a data race *is* per JLS §17.4.5 |
| 2 | **[Happens-before](02-happens-before.md)** | The edges — program order, monitor, volatile, `start`/`join` — transitivity, the "correctly synchronized ⇒ sequentially consistent" guarantee, piggybacking |
| 3 | **[`volatile` and safe publication](03-volatile-and-safe-publication.md)** | What `volatile` guarantees and what it doesn't, final-field freeze, the safe-publication idioms, double-checked locking broken and fixed |

## Why this matters even in the virtual-thread era

- **Virtual threads changed scheduling, not memory.** A million cheap
  threads share the same heap under the same JMM rules — more concurrency
  means more chances to publish an object unsafely, not fewer.
- **The failures are unreproducible by design.** A visibility bug can pass
  every test on your laptop and deadlock a size-XL instance under load,
  because the model permits both behaviours. You cannot test your way out;
  you have to reason from the edges.
- **Every tool in this phase is specified in JMM terms.** The Javadoc for
  `java.util.concurrent` defines each utility's guarantees as
  happens-before edges — "actions prior to submit() happen-before the
  task". Reading those sentences is only possible with this topic.

## Where this connects

- **[Immutable design](../../phase-2-classes-objects/12-immutable-design/README.md)** —
  immutability plus safe publication removes the need for most of this
  reasoning; that is why it is the first strategy.
- [topic 04 · `synchronized`](../04-synchronized-intrinsic-locks/README.md) supplies the
  monitor edges; [topic 10 · Atomics](../10-atomics.md) is
  `volatile` plus atomic read-modify-write.
- **[ExecutorService and pools](../06-executorservice-pools/README.md)** —
  the executor's submit/complete edges are why you rarely write `volatile`
  in application code.

---

← Prev: [`synchronized` and intrinsic locks](../04-synchronized-intrinsic-locks/README.md) · Index: [Phase 6 — Concurrency](../README.md) · Next → [Reordering and visibility](01-reordering-and-visibility.md)
