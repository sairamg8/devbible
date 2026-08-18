---
title: "Casting and instanceof pattern matching"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JLS SE 25 §5 (conversions and contexts),
> §5.5 (casting contexts), §15.20.2 (`instanceof`), §15.16 (cast
> expressions), JEP 394 (Pattern Matching for `instanceof`, finalized in 16),
> and JEP 441 (Pattern Matching for `switch`, 21).

**Java has two unrelated things both spelled "cast". A *primitive* cast
converts a value — possibly destroying information, silently, with no runtime
check. A *reference* cast converts nothing: it is an assertion about what the
object already is, checked at run time, throwing `ClassCastException` when
you asserted wrong. `instanceof` pattern matching (`if (o instanceof User u)`)
folded the test and the assertion into one step — deleting both the
boilerplate and the class of bug where the test and the cast disagreed.**

This topic runs deeper than one file. The chunks:

| # | Chunk | Covers |
|---|---|---|
| 1 | **[Reference casts](01-reference-casts.md)** | Upcasts vs downcasts, what the JVM checks, `ClassCastException` anatomy, the boxed-numeric trap, what the compiler rejects outright |
| 2 | **[`instanceof` and flow scoping](02-instanceof-flow-scoping.md)** | JEP 394 patterns, flow scoping and the `equals` guard idiom, null-rejection, smell vs design |
| 3 | **[Primitive casts and erasure](03-primitive-casts-erasure.md)** | Silent narrowing, the boxed/primitive divide, unchecked generic casts, array covariance |

## Why this is a Master topic

Casts sit at every untyped boundary a server has — deserialization, ORM rows,
framework callbacks, caches keyed by `Object` — and the same syntax means
three different machines (checked assertion, silent bit-conversion, unchecked
erasure claim). Knowing which machine you invoked is the difference between a
crash at the boundary (good: findable) and corrupted numbers in production
(bad: silent).

## Phase gate contribution

The gate's `equals` implementations all use the negated-pattern early-return
idiom from chunk 2 — the modern form every reviewer now expects.

---

← Prev: [`null` and `NullPointerException`](../13-null-and-npe/README.md) · Index: [Phase 1 — Language core](../README.md) · Next → [Naming and idiom](../15-naming-idiom.md)
