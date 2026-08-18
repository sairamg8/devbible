---
title: "IEEE-754 doubles"
sidebar_label: "1 · IEEE-754 doubles"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JLS SE 25 §4.2.3 (floating-point types) and
> §4.2.4 (operations), and the JDK 25 `Double` API documentation
> (`compare`, `equals`, `isNaN`).

**A `double` stores a sign, an exponent and 52 bits of binary fraction. Any
value that is not a sum of powers of two — 0.1, 0.2, 0.3 — is stored as the
nearest representable neighbour, and arithmetic on approximations yields
approximations. Nothing here is a Java quirk; it is IEEE 754, which the JLS
adopts wholesale. What *is* Java-specific: the comparison traps around
`NaN`, the difference between `==` and `Double.equals`, and the API to
handle each correctly.**

## Why `0.1 + 0.2 != 0.3`

0.1 in binary is `0.0001100110011...` repeating — it terminates in decimal
only because 10 has 5 as a factor; in base 2 it never does. So `0.1` is
really "the closest double to 0.1", `0.2` likewise, and their sum lands on a
double that is *not* the closest double to 0.3. The JLS specifies the
comparison `0.1 + 0.2 == 0.3` evaluates to `false`.

Two shapes this takes in services:

- **Accumulation drift**: summing thousands of `double` amounts compounds
  representation error; totals disagree with the ledger by fractions of a
  cent — which is a reconciliation incident, not a rounding preference.
- **Boundary flips**: `if (total >= 100.0)` where `total` is
  `99.99999999999999` — the discount that applies for one customer and not
  another with "the same" cart.

`float` is the same story with 23 fraction bits — worse precision (~7
decimal digits vs ~15). In backend code `float` earns its place only in
bulk storage of tolerant data (embeddings, telemetry); default to `double`.

## Comparing doubles

- `==` on computed values is a coin toss weighted by luck — two routes to
  "the same" number land on different neighbours. Compare with a tolerance:
  `Math.abs(a - b) < 1e-9` (choose epsilon by the scale of your data — an
  absolute epsilon is wrong for very large/small magnitudes; relative error
  is the robust form).
- **`NaN` breaks everything ordered**: `NaN == NaN` is `false` (the only
  value not equal to itself — a legitimate self-test idiom, but
  `Double.isNaN(x)` says what you mean); every `<`, `>`, `<=`, `>=` with
  `NaN` is `false`, so `NaN` silently fails *both* branches' conditions and
  slides through range checks.
- **The boxed world disagrees on purpose**: `Double.compare` and
  `Double.equals` treat `NaN` as equal to itself and greater than
  everything, and `0.0` as greater than `-0.0` — so sorting and
  `HashSet`/`HashMap` behave sanely. Consequence: `d1 == d2` and
  `Double.valueOf(d1).equals(d2)` can disagree at exactly `NaN` and `±0.0`.
- `Infinity` arithmetic is total: `1.0 / 0` is `Infinity` (no exception —
  unlike integer division), `Infinity - Infinity` is `NaN`, `0.0 / 0.0` is
  `NaN`. A `NaN` born anywhere propagates through every later operation —
  find the birth, not the symptom.

## When `double` is the right tool

Everything that is a *measurement*: latencies, percentages, scores,
coordinates, ratios, ML features, metrics (Phase 12's histograms are
doubles). Fifteen significant digits of relative precision with hardware
speed is exactly right for quantities whose last digits are noise anyway.
The line: **if two humans would reconcile the value to the cent, it is not
a measurement** — go to [chunk 2](02-bigdecimal-correctly.md).

## Gotchas

**Symptom:** `0.1 + 0.2 == 0.3` is false; a printed total shows `…000004` digits
**Cause:** binary floating point — 0.1 and 0.2 are stored as nearest representable doubles; errors are inherent, printing just reveals them
**Fix:** for money, don't use `double` at all (chunks 2–3); for display of measurements, format to intended precision (`String.format("%.2f", x)`)

**Symptom:** threshold logic (`>= 100.0`) flips inconsistently for values that print as 100.0
**Cause:** the computed value is a neighbour of 100.0; printing rounded it, the comparison didn't
**Fix:** compare with tolerance, or restate the rule in exact arithmetic (cents as `long`, `BigDecimal`)

**Symptom:** a value fails both `if (x < limit)` and `else` sanity checks; totals turn entirely into `NaN`
**Cause:** `NaN` — every ordered comparison with it is false, and it propagates through all arithmetic
**Fix:** validate at the source (`Double.isNaN`/`isInfinite` — or `Double.isFinite` for both at once) where division and parsing happen; a `NaN` deep in a sum means the bug was upstream

**Symptom:** `list.contains(x)` or a `HashSet` dedupe behaves differently from a hand-written `==` loop for the same values
**Cause:** collections use `Double.equals` (NaN equals NaN, `0.0` ≠ `-0.0`); primitives use IEEE `==` (the opposite on both)
**Fix:** know which world each comparison lives in; normalize `-0.0` (`+ 0.0`) and reject `NaN` before storing into keyed collections

**Symptom:** summing a large array gives a slightly different total depending on order or parallelization
**Cause:** floating addition is not associative — `(a+b)+c != a+(b+c)` in general; parallel reduction reorders
**Fix:** accept it for measurements (document the tolerance); use exact types where it can't be accepted. Deterministic order for reproducibility

**Symptom:** switching a field from `double` to `float` "to save space" broke totals at the 7th digit
**Cause:** `float` has ~7 decimal digits of precision; aggregation noise now exceeds the data's meaningful digits
**Fix:** `double` is the default for a reason; `float` only for bulk tolerant data, never in arithmetic paths

## Interview questions

**★ Why does `0.1 + 0.2 != 0.3`?**
Doubles are binary fractions; 0.1 and 0.2 repeat infinitely in base 2, so
each is stored as the nearest representable value, and their sum isn't the
double nearest 0.3. It is IEEE-754 behaviour common to every mainstream
language — the fix is exact decimal types where exactness is the
requirement.

**★ How do you compare two doubles correctly?**
Never `==` on computed values. Use a tolerance — absolute
(`|a−b| < ε`) for known magnitudes, relative for wide ranges — and handle
`NaN` explicitly since all its comparisons are false. In sorted or hashed
collections, remember `Double.compare`/`equals` define a different (total)
order than the primitive operators.

**★ What is special about `NaN`?**
It is unordered: not equal to itself, and every `<`/`>`/`==` with it is
false — so it evades both branches of range checks and turns downstream
arithmetic into more `NaN`. `Double.isNaN` tests it; boxed
`equals`/`compare` deliberately treat it as equal to itself so collections
work.

**★ When is `double` the correct choice — and what is the line?**
Measurements: metrics, scores, coordinates, ratios — quantities with noise
in the last digits, where hardware-speed approximate arithmetic is exactly
right. The line is reconciliation: values audited to the cent (money,
quantities billed) need exact decimal representation instead.

**Why do `d1 == d2` and `Objects.equals(d1, d2)` sometimes disagree?**
Boxed `Double.equals` compares bit patterns per the total order: `NaN`
equals `NaN` (primitives: false) and `0.0` differs from `-0.0` (primitives:
equal). The boxed rules exist so hashing and sorting are consistent.

**What does `1.0 / 0` do, versus `1 / 0`?**
Floating: `Infinity` — arithmetic is total, continues silently, and
`0.0/0.0` gives `NaN`. Integer: throws `ArithmeticException`. A type
refactor can therefore convert a loud failure into silent propagation.

---

← Index: [Floating point and BigDecimal](README.md) · Next → [`BigDecimal`, correctly](02-bigdecimal-correctly.md)
