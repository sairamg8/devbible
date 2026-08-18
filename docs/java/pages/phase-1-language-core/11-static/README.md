---
title: "static: class-level state and methods"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JLS SE 25 §8.3.1.1 (static fields), §8.4.8.2
> (hiding of class methods), §12.4 (initialization of classes), §13.4.9
> (binary compatibility of constants), §15.12.4.1 (method invocation), and
> the JDK 25 API documentation.

**A `static` member belongs to the class, not to any instance: one copy per
class, alive from class initialization until the class itself is unloaded —
which for application classes means the life of the process. That lifetime is
the whole story. It is why constants and pure utility functions are perfect as
statics, and why *mutable* static state is the single most reliable way to
make tests order-dependent, threads race, and memory "leak" in a
garbage-collected language.**

This topic runs deeper than one file. The chunks:

| # | Chunk | Covers |
|---|---|---|
| 1 | **[Class, not instance](01-class-not-instance.md)** | What `static` actually means, hiding vs overriding, the `myThread.sleep` trap, static imports |
| 2 | **[Initialization and `<clinit>`](02-initialization-clinit.md)** | When statics initialize, textual order, inlined constants, the holder idiom, init cycles and deadlocks |
| 3 | **[State, lifetime and design](03-state-lifetime-design.md)** | Why mutable static state ruins tests and threads, the good statics, classloader lifetime, the utility-class pattern |

## Why this is a Master topic

`static` looks like a storage keyword and is actually a *lifetime and
dispatch* keyword. The three most expensive misunderstandings it produces —
flaky test suites, request-thread races on shared counters, and heap dumps
dominated by a static map — are all the same misunderstanding: forgetting
that a static lives as long as the process and is visible to every thread.

## Phase gate contribution

The gate asks why `Integer.valueOf(1000) == Integer.valueOf(1000)` is what it
is — `valueOf` is a static factory over a static cache: both halves of this
topic in one line of the gate.

---

← Prev: [Methods: overloading, varargs, pass-by-value](../10-methods.md) · Index: [Phase 1 — Language core](../README.md) · Next → [`final`](../12-final.md)
