---
title: "Primitives vs reference types"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JLS SE 25 §4 (types, values, variables),
> §4.12.5 (initial values) and §16 (definite assignment), the JDK 25 API
> documentation for the wrapper classes, and JEP 519 (Compact Object
> Headers, product in JDK 25).

**Java has exactly two kinds of values, and every variable holds one or the
other: a primitive (the value itself — 8 built-in kinds, fixed size, no
methods, never null) or a reference (a pointer to an object on the heap).
Most of the daily surprises this phase covers — the `Long` field that
NPEs, the `==` that lies, the entity field that is "0" when nobody set it —
are this distinction leaking through code that ignored it.**

This topic runs deeper than one file. The chunks:

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The eight primitives](01-the-eight-primitives.md)** | The full table, literals and suffixes, `char` is not a character, `boolean` has no size, choosing `int` vs `long` |
| 2 | **[References and memory](02-references-and-memory.md)** | Reference-copy semantics, `==` as identity, stack vs heap precisely, object headers and compressed oops, what an `Integer` costs |
| 3 | **[Defaults, null and the wrappers](03-defaults-null-wrappers.md)** | Field defaults vs definite assignment, the `long` vs `Long` unset-field bug, wrappers as nullability contracts |

## Why Master tier

Every phase after this one stands on the distinction: `==` vs `equals`
(Phase 2), boxing in collections (Phase 3), entity fields that must
distinguish "unset" from "zero" (Phase 10), and the NPE-on-unboxing family
of production incidents. The interview versions — "`long` vs `Long`?",
"where do objects live?" — are the entry ticket; the chunks carry the
working depth.

## Phase gate contribution

The gate asks what `Integer.valueOf(1000) == Integer.valueOf(1000)`
evaluates to. Chunk 2's identity story and [topic 02's
cache](../02-autoboxing-integer-cache/README.md) together are that answer.

---

← Index: [Phase 1 — Language core](../README.md) · Next → [Autoboxing and the integer cache](../02-autoboxing-integer-cache/README.md)
