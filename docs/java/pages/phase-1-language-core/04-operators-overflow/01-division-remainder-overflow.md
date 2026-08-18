---
title: "Division, remainder and overflow"
sidebar_label: "1 · Division and overflow"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-18 against the JLS SE 25 §4.2.2 (integer operations),
> §15.17.2 (division), §15.17.3 (remainder), and the JDK 25 `Math` API
> documentation (`addExact`, `subtractExact`, `multiplyExact`, `toIntExact`,
> `absExact`, `floorDiv`, `floorMod`, `ceilDiv`).

**Integer `/` truncates toward zero, `%` takes its sign from the dividend,
and `int`/`long` arithmetic wraps modulo 2³² / 2⁶⁴ without throwing.
All three are exact, specified behaviour — and all three produce results
that look like corruption the first time negative inputs or large values
reach them. The `Math` class carries a purpose-built replacement for every
one of these traps; the skill is recognizing which expressions need one.**

## Integer division and remainder

- `/` on integers **truncates toward zero**: `7 / 2` is `3`, `-7 / 2` is
  `-3` (not −4 — this is truncation, not floor). Fractions never round; they
  are discarded. `(int) (0.7 * 10)` problems belong to
  [floating point](../05-floating-point-bigdecimal/README.md); `7 / 2 * 2`
  being `6` belongs here.
- `%` is the remainder after that truncating division, defined so that
  `(a / b) * b + (a % b) == a` always holds. Consequently **its sign follows
  the dividend**: `-7 % 3` is `-1`, `7 % -3` is `1`. For cyclic indexing —
  hash buckets, ring buffers, day-of-week math — a negative input therefore
  produces a negative index.
- **`Math.floorDiv` and `Math.floorMod`** are the floor-division pair:
  `floorDiv(-7, 2)` is `-4`, `floorMod(-7, 3)` is `2` — always non-negative
  for a positive modulus. They satisfy the same identity with each other, so
  use them *together* when quotient and remainder must agree.
- **`Math.ceilDiv`** (since 18) rounds toward positive infinity —
  "how many pages for `total` items at `pageSize` each" is
  `Math.ceilDiv(total, pageSize)`, replacing the hand-rolled
  `(total + pageSize - 1) / pageSize`, whose *addition can itself overflow*
  when `total` is near `MAX_VALUE`.
- Integer division or `%` by zero throws `ArithmeticException`. Floating
  division by zero does **not** — it yields `Infinity`/`-Infinity`/`NaN`
  ([topic 05](../05-floating-point-bigdecimal/README.md)). The same
  expression changes failure mode with the operand types — a refactor from
  `int` to `double` swaps an exception for silently-propagating `NaN`.

## Overflow: silent, specified, wrapping

`int` and `long` arithmetic is two's-complement modulo arithmetic (JLS
§4.2.2): `Integer.MAX_VALUE + 1` **is** `Integer.MIN_VALUE`, no exception,
no flag, no way to detect it after the fact from the result alone. The
classic incidents:

- `millisPerDay * days` computed in `int` — `1000 * 60 * 60 * 24` is fine
  (86.4 million) but multiply by 25 days and the product passes 2³¹.
  Durations go hugely negative after ~24.8 days — the same arithmetic that
  famously required Boeing 787 generators to be power-cycled inside 248 days
  (a 32-bit centisecond counter).
- `(low + high) / 2` in a binary search or pagination midpoint — overflows
  when the sum crosses 2³¹, producing a *negative* index. This bug sat in
  the JDK's own `Arrays.binarySearch` for years. The fixed forms:
  `low + (high - low) / 2`, or `(low + high) >>> 1` (the
  [unsigned shift](03-shifts-bitwise-strings.md) reads the wrapped bit
  pattern as the correct positive value).
- **`Math.abs(Integer.MIN_VALUE)` is negative** — `MIN_VALUE` has no
  positive counterpart in 32 bits, so `abs` returns it unchanged. Every
  "index by `abs(hash) % n`" implementation meets this on one input in four
  billion. `Math.absExact` throws instead; `floorMod(hash, n)` avoids the
  `abs` entirely and is correct for all inputs.
- Casting a `long` to `int` **discards the high 32 bits** — no check, no
  exception. `(int) System.currentTimeMillis()` is a different number every
  time the low bits wrap. **`Math.toIntExact(longValue)`** is the checked
  version, and the right default at every `long → int` boundary (JDBC ids,
  `count()` results, epoch millis).

### Saying "no wrapping" in code

When wrapping is not acceptable — money, quantities, anything
business-visible — say so: **`Math.addExact` / `subtractExact` /
`multiplyExact` / `negateExact` / `toIntExact`** throw `ArithmeticException`
on overflow. An exception is a bug report; a wrapped value is a corrupted
invoice. The JIT compiles these to the plain instruction plus an overflow
check, so they are not a performance decision, they are a correctness one.

Widening to `long` merely moves the cliff (to 9.2 × 10¹⁸ — usually far
enough); `BigInteger` removes it. The decision ladder: `int` for values
provably under 2 billion, `long` as the working default for ids, counts,
money-in-cents and epoch times, `*Exact` where a wrap must be *loud*,
`BigInteger` where the domain genuinely has no bound (crypto, arbitrary
precision — not invoices).

### When wrapping is what you want

Wrapping is not a defect to route around everywhere: `hashCode()`
implementations (`31 * result + field`) *rely* on modular arithmetic —
overflow there is harmless and universal, which is why `HashMap` works.
Checksums, PRNGs (`java.util.Random`'s LCG), and sequence-number deltas
(`(int) (a - b)` comparing wrapped counters) are all deliberate modulo
arithmetic. The distinction to write down in review: **is this value a
quantity (never wrap) or a bit pattern (wrap freely)?**

## Gotchas

**Symptom:** duration or size arithmetic goes hugely negative in production
**Cause:** `int` multiplication wrapped — `1000 * 60 * 60 * 24 * 30` exceeds 2³¹ while every factor looks tiny
**Fix:** compute in `long` — and make the *first* factor long (`1000L * 60 * ...`): promotion happens [per operation, left to right](02-promotion-casts-compound.md), so a trailing `L` can be too late

**Symptom:** binary search / pagination crashes with a negative index on very large datasets only
**Cause:** `(low + high) / 2` overflowed the sum
**Fix:** `low + (high - low) / 2` or `(low + high) >>> 1` — and this is a canonical interview follow-up

**Symptom:** `abs(hash) % buckets` throws `ArrayIndexOutOfBoundsException` roughly never — then once
**Cause:** `hash == Integer.MIN_VALUE`; `Math.abs` returned it unchanged (negative)
**Fix:** `Math.floorMod(hash, buckets)` — no `abs` needed, correct for all inputs

**Symptom:** cyclic index computed with `%` breaks only for negative inputs
**Cause:** `%` takes the dividend's sign: `-1 % 7` is `-1`, not `6`
**Fix:** `Math.floorMod(-1, 7)` — `6`. Use it anywhere the left operand can go negative (deltas, differences of timestamps)

**Symptom:** `-7 / 2` gives −3 where the spec/product math expected −4
**Cause:** Java division truncates toward zero; floor division is a different operation
**Fix:** `Math.floorDiv(-7, 2)` — −4. Pair it with `floorMod` so quotient and remainder agree

**Symptom:** page-count arithmetic `(total + pageSize - 1) / pageSize` overflows for huge totals
**Cause:** the rounding-up *addition* crossed `MAX_VALUE` before the division could bring it back down
**Fix:** `Math.ceilDiv(total, pageSize)` (since 18) — no intermediate sum, and it names the intent

**Symptom:** an id or timestamp is "sometimes negative, sometimes wrong" after a `long → int` assignment
**Cause:** the explicit `(int)` cast silently kept only the low 32 bits
**Fix:** `Math.toIntExact(value)` — throws instead of truncating; or keep the value a `long`, which is usually the real fix

**Symptom:** division that "worked for years" starts throwing `ArithmeticException: / by zero` after a type refactor — or worse, stops throwing
**Cause:** integer and floating-point division have different failure modes; changing operand types changed which one you get
**Fix:** treat any `/` or `%` in a refactor that touches numeric types as a review point — check both the zero case and the negative case

## Interview questions

**★ What happens when an `int` overflows?**
It wraps modulo 2³² — `MAX_VALUE + 1` is `MIN_VALUE`, silently, by
specification. No exception, no flag. Where wrapping is unacceptable, use
the `Math.addExact` family (throws `ArithmeticException`) or widen to
`long`/`BigInteger`.

**★ Fix `(low + high) / 2` and explain why.**
The sum can exceed `Integer.MAX_VALUE` and wrap negative even when both
inputs are valid indexes. `low + (high - low) / 2` keeps every intermediate
in range; `(low + high) >>> 1` reinterprets the wrapped bit pattern
correctly via unsigned shift. This exact bug lived in the JDK's own binary
search.

**★ What does `-7 % 3` evaluate to, and what do you use for cyclic indexing?**
`-1` — the remainder takes the dividend's sign because division truncates
toward zero and `(a/b)*b + a%b == a` must hold. `Math.floorMod(-7, 3)`
gives `2`, the always-non-negative answer for a positive modulus; it (with
`floorDiv`) is the right tool whenever operands can be negative.

**★ Why is `Math.abs` not guaranteed non-negative?**
Two's complement: `Integer.MIN_VALUE` (−2³¹) has no positive counterpart in
32 bits, so `abs` returns it unchanged. `Math.absExact` throws instead;
better designs avoid needing `abs` at all (e.g., `floorMod` for bucketing).

**★ When is silent wrapping the *correct* behaviour?**
When the value is a bit pattern, not a quantity: `hashCode` accumulation
(`31 * h + x`), checksums, PRNG state, and wrapped-counter deltas all
depend on modular arithmetic. The review question is whether the value is
business-meaningful — if it is, wrapping is corruption; if it's a hash, it's
the algorithm.

**Integer vs floating division by zero?**
Integer `/` and `%` throw `ArithmeticException`; floating-point produces
`Infinity` or `NaN` and keeps computing
([topic 05](../05-floating-point-bigdecimal/README.md)). A refactor that
changes operand types can therefore change an exception into
silently-propagating `NaN`.

**How do you safely narrow a `long` to an `int`?**
`Math.toIntExact` — it throws `ArithmeticException` if the value doesn't
fit, where the cast `(int)` silently keeps the low 32 bits. At API
boundaries (JDBC, stream `count()`), prefer keeping the `long`.

**What's the difference between `floorDiv`, `ceilDiv` and `/`?**
Three rounding modes for the same division: `/` truncates toward zero,
`floorDiv` rounds toward negative infinity, `ceilDiv` (since 18) toward
positive infinity. They only differ when the mathematical quotient is
negative (`/` vs `floorDiv`) or fractional (`ceilDiv` vs both). Pagination
wants `ceilDiv`; cyclic math wants `floorDiv`+`floorMod`.

---

← Prev: [Overview](README.md) · Next → [Promotion, casts and compound assignment](02-promotion-casts-compound.md)
