---
title: "01 · Arithmetic operators"
sidebar_label: "01 · Arithmetic"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0**. Script: `sandbox/js-p2/ex1-arithmetic.mjs`.

**Six operators, and three of them have behaviour that surprises people every
time.** `%` is not modulo, `**` associates right, and `+` is two operators
wearing one symbol.

## Measured

```
--- % with negatives (remainder, NOT modulo) ---
  7 % 3 = 1
  -7 % 3 = -1
  7 % -3 = 1
  -7 % -3 = -1
  true modulo: ((-7 % 3) + 3) % 3 = 2

--- integer division ---
  7 / 2 = 3.5 | Math.trunc = 3 | Math.floor(-7/2) = -4 | Math.trunc(-7/2) = -3

--- ** is right-associative ---
  2 ** 3 ** 2 = 512 (= 2**9, not 8**2=64)
  -2 ** 2 -> SyntaxError: Unary operator used immediately before exponentiation expression. Parenthesis must be used to disambiguate operator precedence
  (-2) ** 2 = 4

--- increment ---
  i++ returns 5 then i = 6
  ++j returns 6 then j = 6
```

## `%` is remainder, not modulo

```
  -7 % 3 = -1
```

Most languages that call this "modulo" would give `2`. JavaScript's `%` follows
C: **the result takes the sign of the dividend** (the left operand), not the
divisor.

That is fine for the common case — `n % 2 === 0` works for negatives too — and
wrong the moment you use `%` to wrap an index:

```js
// Cycling through carousel slides — breaks going backwards
const next = (index + 1) % slides.length;        // ✅ fine
const prev = (index - 1) % slides.length;        // ❌ -1 at index 0

// True modulo — always non-negative for a positive divisor
const mod = (a, b) => ((a % b) + b) % b;
const prevSafe = mod(index - 1, slides.length);  // ✅ wraps to the last slide
```

The double-`%` form is the standard idiom. Measured: `((-7 % 3) + 3) % 3` is `2`.

## There is no integer division

```
  7 / 2 = 3.5 | Math.trunc = 3 | Math.floor(-7/2) = -4 | Math.trunc(-7/2) = -3
```

`/` always produces a double ([Phase 1 · 06](../phase-1-values-and-coercion/06-numbers-are-doubles.md)).
To get an integer you choose the rounding explicitly, and the choice matters for
negatives:

| | `7/2` | `-7/2` | Use for |
|---|---|---|---|
| `Math.trunc` | 3 | **-3** | dropping the fraction — usually what you want |
| `Math.floor` | 3 | **-4** | always toward −∞ — grid/tile maths |
| `Math.ceil` | 4 | -3 | pagination: `Math.ceil(total / perPage)` |
| `Math.round` | 4 | -3 | half up toward +∞ |

`Math.floor` and `Math.trunc` agree on positives and differ on negatives, which
is exactly why a page-count bug only shows up on some inputs.

`Math.ceil(total / perPage)` is the page-count formula worth memorising — it is
the one arithmetic line in a product listing that is always wrong when written
with `Math.round`.

## `**` is right-associative, and rejects a leading minus

```
  2 ** 3 ** 2 = 512
  -2 ** 2 -> SyntaxError
  (-2) ** 2 = 4
```

`2 ** 3 ** 2` is `2 ** (3 ** 2)` = `2 ** 9` = **512**. Every other arithmetic
operator groups left to right; `**` is the exception, matching mathematical
convention.

`-2 ** 2` is a **`SyntaxError`** — deliberately. The committee refused to pick a
winner between `-(2 ** 2)` = −4 and `(-2) ** 2` = 4, so it demands parentheses.
This is one of the very few places the language makes you disambiguate instead of
choosing silently, and it is a good pattern.

`**` replaces `Math.pow`. Use it.

## `+` is overloaded; the rest are not

```js
1 + '2'    // '12'  — concatenation
1 - '2'    // -1    — arithmetic
```

If either operand of `+` is a string after `ToPrimitive`, `+` concatenates. No
other arithmetic operator has a string meaning, so they all coerce to number.
This is the single most common source of "why is my total a string", and it is
covered in full in
[Phase 1 · 08](../phase-1-values-and-coercion/08-type-coercion.md).

**Unary `+`** is a terse `Number()`:

```js
+'42';        // 42
+'';          // 0
+new Date();  // timestamp
```

It is fine in dense code and worse than `Number()` for readability. Note it
**throws** on a `BigInt` — `+1n` is a `TypeError` — while `Number(1n)` works.

## `++` and `--`

```
  i++ returns 5 then i = 6
  ++j returns 6 then j = 6
```

Postfix returns the value **before** incrementing; prefix returns it after. Both
mutate.

**Use them as statements, never inside a larger expression.** `arr[i++] = arr[++j]`
is legal and unreadable, and it is precisely what ESLint's `no-plusplus` rule
exists to discourage. In a `for` header it is idiomatic and fine.

`++` on a non-number coerces: `let s = '5'; s++` gives `6` as a number. That is
occasionally a hidden fix and more often a hidden bug.

## Gotchas

**Symptom:** a wrap-around index goes negative.
**Cause:** `%` takes the sign of the dividend — `(0 - 1) % 5` is `-1`.
**Fix:** `((a % b) + b) % b`.

**Symptom:** `2 ** 3 ** 2` gave 512 where 64 was expected.
**Cause:** `**` is right-associative.
**Fix:** parenthesise when the order matters: `(2 ** 3) ** 2`.

**Symptom:** `SyntaxError: Unary operator used immediately before exponentiation
expression`.
**Cause:** `-2 ** 2` is deliberately ambiguous.
**Fix:** `(-2) ** 2` or `-(2 ** 2)` — say which you mean.

**Symptom:** a page count is one too low.
**Cause:** `Math.round` or `Math.floor` instead of `Math.ceil`.
**Fix:** `Math.ceil(total / perPage)`.

**Symptom:** an index is off by one only for negative values.
**Cause:** `Math.floor` and `Math.trunc` differ on negatives — measured `-4` vs
`-3`.
**Fix:** pick deliberately; `trunc` drops the fraction, `floor` goes toward −∞.

**Symptom:** adding two values concatenated them.
**Cause:** one was a string and `+` concatenates.
**Fix:** convert at the boundary with `Number()`.

**Symptom:** `+someBigInt` throws.
**Cause:** unary `+` refuses `BigInt`.
**Fix:** `Number(bigint)`, accepting the precision loss deliberately.

## Interview questions

**★ What does `-7 % 3` return, and why?**
`-1`. JavaScript's `%` is a *remainder*, not a modulo — the result takes the sign
of the dividend, following C. For a true modulo that is always non-negative, use
`((a % b) + b) % b`, which gives `2`.

**★ What is `2 ** 3 ** 2`?**
`512`. `**` is right-associative, so it is `2 ** (3 ** 2)` = `2 ** 9`. It is the
only right-associative arithmetic operator; every other one groups left to right.

**★ Why is `-2 ** 2` a `SyntaxError`?**
Because `-(2 ** 2)` and `(-2) ** 2` give different answers (−4 and 4) and the
committee refused to pick one silently. The grammar requires parentheses so the
author states the intent.

**How do you do integer division?**
There is none — `/` always yields a double. Choose the rounding:
`Math.trunc` drops the fraction, `Math.floor` rounds toward −∞, `Math.ceil`
toward +∞. They agree on positives and differ on negatives, so a bug from
picking the wrong one often only shows on negative input.

**What is the difference between `i++` and `++i`?**
Postfix returns the value before incrementing, prefix after — measured, `i++`
returned 5 and left `i` as 6, while `++j` returned 6. Both mutate. Use them as
standalone statements or in a `for` header, never nested inside a larger
expression.

---

[Phase index](./) · Next: [02 · Assignment](./02-assignment.md) →
