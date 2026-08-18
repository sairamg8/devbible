---
title: "synchronized and intrinsic locks"
sidebar_label: "04 · synchronized"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-18 against JLS SE 25 §14.19 (The `synchronized`
> Statement), §17.1 (Synchronization) and §17.4.5 (Happens-before Order),
> the JDK 25 Javadoc for `Object.wait`/`notify` and `Thread`, JEP 390
> (Warnings for Value-Based Classes) and JEP 491 (Synchronize Virtual
> Threads without Pinning, delivered in JDK 24).

**Every Java object carries a monitor — a built-in lock plus a wait set —
and `synchronized` is the language syntax for holding it. It gives you two
things at once, and both matter: *mutual exclusion* (one thread in the
guarded region per lock) and *visibility* (an unlock makes everything
before it visible to the next lock of the same monitor). The keyword is
easy; the craft is in what you lock, what you guard, and what the keyword
deliberately does not give you.**

This topic runs deeper than one file. The chunks:

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The monitor](01-the-monitor.md)** | One monitor per object; synchronized methods vs blocks; `static synchronized` and the `Class` object; reentrancy; guarding *data*, not code |
| 2 | **[Visibility and happens-before](02-visibility-and-happens-before.md)** | Unlock → lock happens-before; why reads must synchronize too; `synchronized` vs `volatile`; safe publication through a lock |
| 3 | **[Choosing the lock object — and the limits](03-choosing-the-lock-object.md)** | Private final lock vs `this`; the objects you must never lock on; what `synchronized` cannot do (fairness, timeout, interruptible acquire); JIT lock elision/coarsening; virtual-thread pinning and JEP 491 |

## Why this is a Master topic

- **It is the default mutual-exclusion tool** — the one you reach for
  first, the one all frameworks assume you can read, and the one whose
  *misuse* patterns (lock on `this`, guard half the access paths) are
  practically a genre of production bug.
- **It teaches the two-sided contract** — exclusion *and* visibility.
  Engineers who know only the exclusion half write racy getters and
  can't say why `synchronized` fixed a stale read.
- **Its limits define the rest of the phase** — no timeout, no fairness,
  no interruptible acquire, no shared-read mode: each missing feature is
  the reason another topic exists (explicit locks, atomics, concurrent
  collections).
- **JDK 24 changed its cost model** — JEP 491 removed virtual-thread
  pinning inside `synchronized`, retiring advice ("rewrite to
  `ReentrantLock` for virtual threads") that interviews still quote.

## Where this connects

- **[Race conditions](../03-race-conditions/README.md)** — the bug class
  this keyword exists to prevent; `synchronized` is cure 3.
- **[Immutable design](../../phase-2-classes-objects/12-immutable-design/README.md)** —
  the alternative that makes most locks unnecessary.
- **`wait`/`notify`** — the monitor's other half (its wait set) is
  **topic 17** *(not written yet)*; this topic covers only the lock.

---

← Prev: [Race conditions](../03-race-conditions/README.md) · Index: [Phase 6 — Concurrency](../README.md) · Next → [The monitor](01-the-monitor.md)
