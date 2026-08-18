---
title: "Control flow and the modern switch"
sidebar_label: "08 · Control flow, switch"
sidebar_position: 8
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against JEP 361 (Switch Expressions, final in 14),
> JEP 441 (Pattern Matching for switch, final in 21), and JLS §14.11 / §15.28.

**Java has two switches wearing one keyword. The old *statement* switch —
fall-through, `break`, no result — is a 1970s control structure with a
documented bug magnet built in. The modern *expression* switch — arrow
labels, `yield`, and compiler-checked exhaustiveness — is the readable
replacement for `if`/`else` chains over enums and sealed types, and since 21
it also pattern-matches on types. Knowing which one you are writing, and
what the compiler will and won't check for each, is the Master skill.**

This topic runs deeper than one file. The chunks:

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The modern switch](01-the-modern-switch.md)** | Arrow labels, `yield`, expression vs statement, exhaustiveness as a refactoring safety net |
| 2 | **[Patterns, null and the legacy switch](02-patterns-null-and-legacy.md)** | Type patterns and guards (21+), `case null`, fall-through's bug taxonomy, loops and labels |

## Why this is a Master topic

- The **exhaustiveness guarantee** is the highest-leverage compile-time check
  Java added in a decade: add an enum constant or a sealed subtype, and every
  switch *expression* over it fails to compile until handled. Teams that use
  `default` reflexively forfeit exactly that guarantee (chunk 1).
- Pattern switches replaced whole `instanceof`-ladder architectures — the
  visitor pattern's daily-work use cases collapsed into a language feature
  (chunk 2; Phase 2's sealed-types topic supplies the domain-modelling half).
- The legacy fall-through switch still guards a measurable share of
  production bugs — recognizing its failure shapes in old code is part of
  the skill (chunk 2).

## Phase gate contribution

After this topic, "handle every `OrderStatus`, and make the compiler prove
it" is a five-line switch expression — and you can say precisely why the
`default` arm someone proposes would weaken it.

---

← Index: [Phase 1 — Language core](../README.md)
