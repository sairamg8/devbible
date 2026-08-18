---
title: "Race conditions"
sidebar_label: "03 · Race conditions"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-18 against JLS SE 25 §17.4 (the Java Memory Model —
> data races, happens-before), the JDK 25 Javadoc for
> `java.util.concurrent` (`ConcurrentHashMap`, `AtomicLong`), and the
> Oracle Java Tutorials concurrency lesson (Thread Interference, Memory
> Consistency Errors).

**A race condition is correctness that depends on timing you don't
control. The three-line method that passed every test — read a value,
decide something, write a value — silently assumes nothing moved between
its steps, and under two threads that assumption is false in exactly the
ways that charge a customer twice. The bug is not exotic: it is `count++`,
it is `if (absent) put`, and it hides because the schedule that breaks it
may arrive once a week, under load, in production only.**

This topic runs deeper than one file. The chunks:

| # | Chunk | Covers |
|---|---|---|
| 1 | **[Data race vs race condition](01-data-race-vs-race-condition.md)** | The JLS definition of a *data race*, why it differs from a semantic race, `count++` as three operations, lost updates, why these bugs hide from tests |
| 2 | **[The shapes](02-the-shapes.md)** | Check-then-act, read-modify-write, compound invariants across fields — and the double-charge bug walked end to end, from retry to reconciliation report |
| 3 | **[The cures](03-the-cures.md)** | Confinement, immutability, synchronization — choosing among the three; atomic compound operations; idempotency keys as the systems-level guard |

## Why this is a Master topic

- **It is the concurrency bug** — deadlocks announce themselves; races
  corrupt data quietly and get discovered by a reconciliation job weeks
  later. Every other topic in this phase is ultimately a tool against this
  one failure mode.
- **The vocabulary decides the fix.** Naming a bug *check-then-act* or
  *read-modify-write* tells you which repair is available — an atomic
  primitive, a lock, or a redesign. Engineers without the names re-derive
  the analysis badly under incident pressure.
- **Virtual threads changed none of it** — cheap threads mean *more*
  concurrency per service, so the discipline this topic teaches is worth
  more after JDK 21, not less.
- **It is the interview filter for senior backend roles** — "walk me
  through how a double-charge happens and how you'd prevent it" spans
  language, library and system design in one question.

## Where this connects

- **[`synchronized` and intrinsic locks](../04-synchronized-intrinsic-locks/README.md)** —
  the language's built-in cure, next topic.
- **[Immutable design](../../phase-2-classes-objects/12-immutable-design/README.md)** —
  the phase-2 design stance that removes the shared-mutable precondition
  entirely; this phase's topic 15 revisits it as strategy.
- **[`HashMap` internals](../../phase-3-generics-collections/07-hashmap-internals.md)** —
  what structural corruption looks like when an unsynchronized map is
  mutated by two threads.

---

← Prev: [Platform vs virtual threads](../02-platform-vs-virtual-threads/README.md) · Index: [Phase 6 — Concurrency](../README.md) · Next → [Data race vs race condition](01-data-race-vs-race-condition.md)
