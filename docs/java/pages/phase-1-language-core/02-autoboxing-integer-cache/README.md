---
title: "Autoboxing and the integer cache"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JLS SE 25 §5.1.7 (boxing conversion,
> including the guaranteed cache range) and §15.25 (conditional operator
> typing), and the JDK 25 `Integer.valueOf` / `Long.valueOf` /
> `Character.valueOf` API documentation.

**Autoboxing lets primitives and wrappers substitute for each other so
smoothly that code stops showing where the conversions are — and every
conversion is a place where reference semantics (`==` is identity, `null`
exists) and value semantics silently swap. The result is Java's most
reliable interview question *because* it is Java's most reliable production
bug: wrapper comparison that works for small numbers and fails for big ones,
and arithmetic that NPEs.**

This topic runs deeper than one file. The chunks:

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The mechanics and the cache](01-mechanics-and-cache.md)** | What the compiler inserts, the JLS-guaranteed cache ranges for every wrapper, `-XX:AutoBoxCacheMax`, the `==` rules table, `equals` across wrapper types |
| 2 | **[Unboxing NPEs and overload ambushes](02-unboxing-npes-overloads.md)** | The ternary that NPEs by *typing*, `Map.get`, comparisons, `List.remove(int)`, comparator traps |
| 3 | **[Boxing at scale](03-boxing-at-scale.md)** | Accumulator loops, boxed collections, primitive streams, when to care and when not to |

## Why Master tier

The cache bug's production shape — ids compared with `==`, green in tests
with ids 1–3, silently never matching with real ids — is the canonical
"works in the test, fails with real data" incident. The unboxing NPE family
is the other half: absence (`null`) meeting arithmetic. Both are decided at
the exact line where a box appears or disappears, which is why the mechanics
deserve chunk-level depth.

## Phase gate contribution

The gate asks what `Integer.valueOf(1000) == Integer.valueOf(1000)`
evaluates to and why — chunk 1 is that answer, with the JLS section to cite.

---

← Prev: [Primitives vs reference types](../01-primitives-vs-references/README.md) · Index: [Phase 1 — Language core](../README.md) · Next → [`var` — local-variable type inference](../03-var.md)
