---
title: "Operators, integer division and overflow"
sidebar_label: "04 · Operators and overflow"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JLS SE 25 §15.17 (multiplicative operators),
> §15.19 (shifts), §15.26.2 (compound assignment), §4.2.2 (integer
> operations), and the JDK 25 `Math` API documentation (`addExact`,
> `floorMod`, `abs`).

**Java's integer arithmetic never throws on overflow — it wraps, silently,
by specification. Division truncates toward zero, `%` takes its sign from
the dividend, and a shift by 32 is a shift by 0. Every one of these is
deterministic, documented behaviour; every one of them reads as a bug when
you meet it in a money or pagination calculation. The defense is knowing the
six rules below and reaching for the `Math.*Exact` family where wrapping
would be a lie.**

## Integer division and remainder

- `/` on integers **truncates toward zero**: `7 / 2` is `3`, `-7 / 2` is
  `-3` (not −4 — this is truncation, not floor). Fractions never round; they
  are discarded. `(int) (0.7 * 10)` problems belong to topic 05; `7 / 2 * 2`
  being `6` belongs here.
- `%` is the remainder after that truncating division, so **its sign follows
  the dividend**: `-7 % 3` is `-1`, `7 % -3` is `1`. For cyclic indexing —
  hash buckets, ring buffers, day-of-week math — a negative input therefore
  produces a negative index. **`Math.floorMod(x, n)`** gives the
  always-non-negative answer (for positive `n`) and is the correct tool
  every time the operand can be negative.
- Integer division or `%` by zero throws `ArithmeticException`. Floating
  division by zero does **not** — it yields `Infinity`/`-Infinity`/`NaN`
  (topic 05). The same expression changes failure mode with the operand
  types.

## Overflow: silent, specified, wrapping

`int` and `long` arithmetic is two's-complement modulo arithmetic (JLS
§4.2.2): `Integer.MAX_VALUE + 1` **is** `Integer.MIN_VALUE`, no exception,
no flag. The classic incidents:

- `millisPerDay * days` computed in `int` — overflows past ~24 days.
- `(low + high) / 2` in a binary search or pagination midpoint — overflows
  when the sum crosses 2³¹, producing a *negative* index. The fixed forms:
  `low + (high - low) / 2` or `(low + high) >>> 1`.
- **`Math.abs(Integer.MIN_VALUE)` is negative** — `MIN_VALUE` has no
  positive counterpart in 32 bits, so `abs` returns it unchanged. Every
  "index by `abs(hash) % n`" implementation meets this on one input in four
  billion. (`Math.absExact` throws instead; `floorMod(hash, n)` avoids the
  `abs` entirely.)

When wrapping is not acceptable — money, quantities, anything
business-visible — say so in code: **`Math.addExact` / `subtractExact` /
`multiplyExact` / `toIntExact`** throw `ArithmeticException` on overflow.
An exception is a bug report; a wrapped value is a corrupted invoice.
Widening to `long` merely moves the cliff (to 9.2 × 10¹⁸ — usually far
enough); `BigInteger` removes it.

Two adjacent facts people misfile under "overflow": integer arithmetic on
`byte`/`short`/`char` first **promotes to `int`** (so `byte + byte` is an
`int`, and assigning it back needs a cast), and `char` arithmetic is numeric
UTF-16 code-unit math — `'a' + 1` is the `int` 98, `(char) ('a' + 1)` is
`'b'`.

## The compound-assignment hidden cast

`b += 1` and `b = b + 1` are not the same statement. Compound assignment
(JLS §15.26.2) includes an **implicit cast back to the left-hand type**:

```java
byte b = 10;
b = b + 1;    // does not compile — b + 1 is an int
b += 1;       // compiles: means b = (byte) (b + 1) — including the cast
long big = 10_000_000_000L;
int i = 5;
i += big;     // compiles! i = (int) (i + big) — silently truncates
```

The second half is the trap: `+=` with a wider right-hand side compiles and
truncates where the explicit form would have been a compile error.

## Shifts and bit operations

- `<<` (left), `>>` (arithmetic right — sign-propagating), `>>>` (logical
  right — zero-filling). `-8 >> 1` is `-4`; `-8 >>> 1` is a huge positive
  number. For anything but sign-aware math, `>>>` is the one you meant.
- **Shift distance is masked**: for `int`, only the low 5 bits count, so
  `x << 32` is `x << 0` — `x`, unchanged, silently (for `long`, low 6 bits,
  `<< 64` ≡ `<< 0`). "Shift everything out" must be written as `0`.
- `&`, `|`, `^`, `~` are bitwise on integers — and `&`/`|` on `boolean` are
  the **non-short-circuit** logical operators: `check1() & check2()` runs
  both sides always. Almost every `&` between boolean expressions in
  application code is a typo for `&&` — except when someone *wanted* both
  side effects, which deserves a comment.

## String `+` and evaluation order

`+` with any `String` operand is concatenation, and expressions evaluate
**left to right**: `"total: " + 1 + 2` is `"total: 12"`, while
`1 + 2 + " total"` is `"3 total"`. Precedence didn't change — `+` stayed
left-associative; the *operation* changed mid-expression the moment a
`String` joined. Parenthesize the arithmetic:
`"total: " + (subtotal + tax)`. (Loop-concatenation cost is topic 06's
`StringBuilder` story.)

## Gotchas

**Symptom:** duration or size arithmetic goes hugely negative in production
**Cause:** `int` multiplication wrapped — `1000 * 60 * 60 * 24 * 30` exceeds 2³¹ while every factor looks tiny
**Fix:** compute in `long` (make the *first* factor long: `1000L * 60 * ...`) — the promotion happens per-operation, left to right, so a trailing `L` can be too late

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

**Symptom:** `i += longValue` compiles and corrupts data; `i = i + longValue` on the same types doesn't compile
**Cause:** compound assignment carries a hidden narrowing cast back to the left-hand type
**Fix:** treat a compound assignment mixing widths as a review flag; widen the variable or make the cast explicit and justified

**Symptom:** `x << 32` "does nothing"
**Cause:** shift distance is masked to 5 bits for `int` (6 for `long`) — 32 masks to 0
**Fix:** never compute a shift distance that can reach the type's width; special-case it to 0

**Symptom:** both sides of a `&` between boolean method calls execute, one with side effects that "shouldn't have happened"
**Cause:** `&`/`|` on booleans are non-short-circuit; only `&&`/`||` skip the right side
**Fix:** `&&`/`||` unless both evaluations are genuinely required — then comment it

**Symptom:** `"id: " + a + b` logs concatenated digits instead of a sum
**Cause:** left-to-right evaluation turned everything after the `String` into concatenation
**Fix:** parenthesize: `"id: " + (a + b)`

## Interview questions

**★ What happens when an `int` overflows?**
It wraps modulo 2³² — `MAX_VALUE + 1` is `MIN_VALUE`, silently, by
specification. No exception, no flag. Where wrapping is unacceptable, use
`Math.addExact`-family methods (throw `ArithmeticException`) or widen to
`long`/`BigInteger`.

**★ Fix `(low + high) / 2` and explain why.**
The sum can exceed `Integer.MAX_VALUE` and wrap negative even when both
inputs are valid indexes. `low + (high - low) / 2` keeps every intermediate
in range; `(low + high) >>> 1` reinterprets the wrapped bit pattern
correctly via unsigned shift.

**★ What does `-7 % 3` evaluate to, and what do you use for cyclic indexing?**
`-1` — the remainder takes the dividend's sign because division truncates
toward zero. `Math.floorMod(-7, 3)` gives `2`, the always-non-negative
answer for a positive modulus; it (with `floorDiv`) is the right tool
whenever operands can be negative.

**★ Why is `Math.abs` not guaranteed non-negative?**
Two's complement: `Integer.MIN_VALUE` (−2³¹) has no positive counterpart in
32 bits, so `abs` returns it unchanged. `Math.absExact` throws instead;
better designs avoid needing `abs` (e.g., `floorMod` for bucketing).

**★ Why does `b += 1` compile where `b = b + 1` doesn't, for a `byte`?**
Arithmetic promotes `byte` to `int`, so the explicit form needs a cast.
Compound assignment is *defined* to include that cast back to the target
type — convenient for `byte`, dangerous when the right-hand side is wider
(`int += long` truncates silently).

**`>>` vs `>>>`?**
Arithmetic vs logical right shift: `>>` propagates the sign bit (keeps
negatives negative), `>>>` fills with zeros (treats the bits as unsigned).
They differ only for negative values — which is exactly when picking the
wrong one matters.

**Integer vs floating division by zero?**
Integer `/` and `%` throw `ArithmeticException`; floating-point produces
`Infinity` or `NaN` and keeps computing (topic 05). A refactor that changes
operand types can therefore change an exception into silently-propagating
`NaN`.

**What does `'a' + 1` evaluate to, and why?**
The `int` 98 — `char` promotes to `int` in arithmetic. Getting `'b'`
requires the cast `(char) ('a' + 1)`. Useful for range checks and offsets;
surprising in string building, where `"" + c + 1` concatenates instead.

---

← Prev: [`var` — local-variable type inference](03-var.md) · Next → [Floating point and `BigDecimal`](05-floating-point-bigdecimal/README.md)
