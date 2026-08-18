---
title: "Floating point and BigDecimal"
sidebar_label: "05 · Floating point, BigDecimal"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JLS SE 25 §4.2.3–4.2.4 (floating-point types
> and operations), the JDK 25 `BigDecimal` and `RoundingMode` API
> documentation, and IEEE 754 as the JLS incorporates it.

**`double` is a binary fraction: it cannot represent 0.1, so `0.1 + 0.2 !=
0.3` in Java exactly as in every IEEE-754 language — and unlike JavaScript,
Java gives you a real alternative. The rule this topic exists to install:
`double` for measurements, `BigDecimal` (or `long` minor units) for money —
and `BigDecimal` used *correctly*, because it has three famous traps of its
own (the `double` constructor, `equals` vs `compareTo`, and unterminated
division).**

The chunks:

| # | Chunk | Covers |
|---|---|---|
| 1 | **[IEEE-754 doubles](01-ieee-754-doubles.md)** | Why 0.1 doesn't exist, comparison and accumulation, `NaN` and signed zero, when `double` is the right tool |
| 2 | **[`BigDecimal`, correctly](02-bigdecimal-correctly.md)** | The `String` constructor rule, scale and rounding modes, `equals` vs `compareTo`, division |
| 3 | **[Money patterns](03-money-patterns.md)** | A `Money` type over `BigDecimal`, the `long`-cents alternative, database and JSON boundaries |

## Why Master tier

Money code is where this stops being trivia: a `double`-typed price is a
latent audit finding, a `BigDecimal` built from a `double` is the same
finding hidden one layer deeper, and a `HashSet<BigDecimal>` deduplicating
prices "randomly" traces straight to `equals` counting scale. The interview
version ("why not double for money?") is the entry ticket; the chunks carry
the working depth.

---

← Prev: [Operators, division and overflow](../04-operators-overflow.md) · Index: [Phase 1 — Language core](../README.md)
