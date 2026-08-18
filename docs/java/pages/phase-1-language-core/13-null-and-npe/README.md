---
title: "null and NullPointerException"
sidebar_label: "13 · null and NPE"
sidebar_position: 13
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JLS SE 25 §4.1 (the null type), JEP 358
> (Helpful NullPointerExceptions, 14 — on by default since 15), the
> `java.util.Objects` JDK 25 API documentation, and jspecify.org.

**`null` is the absence of a reference, and `NullPointerException` is the JVM
refusing to dereference an absence. Tony Hoare called inventing null his
"billion-dollar mistake" — but in Java it is not going anywhere, so the
Master skill is twofold: *reading* an NPE in seconds (the JVM now tells you
exactly which expression was null), and *designing* your boundaries so nulls
die at the edge instead of travelling three layers before detonating.**

The two chunks:

| # | Chunk | Covers |
|---|---|---|
| 1 | **[Reading an NPE](01-reading-an-npe.md)** | Where NPEs actually arise, helpful messages since JEP 358, unboxing NPEs, diagnosing fast |
| 2 | **[Designing nulls out](02-designing-nulls-out.md)** | `requireNonNull` at boundaries, empty over null, `Map.get` semantics, nullness annotations and JSpecify |

## Why this is a Master topic

The NPE is Java's most common production exception, and the distance between
"where it threw" and "where the null was *created*" is the debugging cost.
Everything in chunk 2 is about collapsing that distance to zero — fail at the
boundary, with a message, in the constructor — so chunk 1's forensics are
rarely needed.

## Phase gate contribution

After this topic: given any NPE stack trace on JDK 15+, you can name the
exact null expression without opening the code — and your own classes throw
at construction time, not at use time.

---

← Prev: [`final`](../12-final.md) · Next → [Casting and `instanceof` patterns](../14-casting-instanceof.md)
