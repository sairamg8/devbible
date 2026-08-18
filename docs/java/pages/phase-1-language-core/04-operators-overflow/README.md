---
title: "Operators, integer division and overflow"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-18 against the JLS SE 25 §4.2.2 (integer operations),
> §5.6 (numeric promotion), §15.17 (multiplicative operators), §15.18
> (additive operators), §15.19 (shifts), §15.22 (bitwise and logical
> operators), §15.26.2 (compound assignment), and the JDK 25 `Math` API
> documentation (`addExact`, `floorDiv`, `floorMod`, `ceilDiv`, `absExact`).

**Java's integer arithmetic never throws on overflow — it wraps, silently,
by specification. Division truncates toward zero, `%` takes its sign from
the dividend, a shift by 32 is a shift by 0, and `+=` hides a cast that a
plain `=` would reject. Every one of these is deterministic, documented
behaviour; every one of them reads as a bug when you meet it in a money or
pagination calculation. The defense is knowing the rules below and reaching
for the `Math.*Exact` family where wrapping would be a lie.**

This topic runs deeper than one file. The chunks:

| # | Chunk | Covers |
|---|---|---|
| 1 | **[Division, remainder and overflow](01-division-remainder-overflow.md)** | Truncation toward zero, `%` sign rules, `floorDiv`/`floorMod`/`ceilDiv`, silent wraparound, the `Math.*Exact` family, `abs(MIN_VALUE)`, when wrapping is *correct* |
| 2 | **[Promotion, casts and compound assignment](02-promotion-casts-compound.md)** | Binary numeric promotion, `byte + byte` is an `int`, `char` arithmetic, the hidden cast in `+=`, constant expressions, the ternary promotion trap |
| 3 | **[Shifts, bitwise operators and `String +`](03-shifts-bitwise-strings.md)** | `<<` / `>>` / `>>>`, the masked shift distance, `& 0xFF` sign-extension repair, flags and masks, non-short-circuit `&`/`|`, left-to-right concatenation |

## Why this is a Master topic

The operator table looks like week-one material and hides four of the most
expensive silent failures in the language: an `int` multiply that wraps a
duration negative after ~24 days in production, a `%` that goes negative on
the first negative input, a `+=` that truncates a `long` without a
diagnostic, and a `byte` that sign-extends garbage into a hex dump. None of
them throw. All of them are specified. The engineers who avoid them are the
ones who know *which* expressions to distrust.

## Phase gate contribution

The gate asks you to fix `(low + high) / 2` and to explain why `-7 % 3` is
`-1` — both live in [chunk 1](01-division-remainder-overflow.md), with the
`Math.floorMod` and `>>> 1` answers.

---

← Prev: [`var` — local-variable type inference](../03-var.md) · Index: [Phase 1 — Language core](../README.md) · Next → [Floating point and `BigDecimal`](../05-floating-point-bigdecimal/README.md)
