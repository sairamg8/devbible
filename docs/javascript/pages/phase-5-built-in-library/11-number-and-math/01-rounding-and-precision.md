---
title: "1 · Rounding, precision and money"
sidebar_label: "1 · Rounding and precision"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`Math.round()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/round), [`Math.floor()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/floor), [`Math.ceil()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/ceil), [`Math.trunc()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/trunc), [`Number.prototype.toFixed()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/toFixed), [`Number.prototype.toPrecision()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/toPrecision), [`Number.EPSILON`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/EPSILON), [`Number.MAX_SAFE_INTEGER`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/MAX_SAFE_INTEGER), [`Number.isSafeInteger()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/isSafeInteger), [`BigInt`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigInt), [`Intl.NumberFormat`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat). Documentation-validated; **no timings**.

**Every JavaScript number is a 64-bit float**, including the ones you think of as integers. That
single fact produces every surprise on this page — see
[Phase 1 · Values, types and coercion](../../phase-1-values-and-coercion/README.md) for the
representation itself.

## The four rounding functions differ on negatives

```js
Math.round(2.5);    //  3
Math.round(-2.5);   // 🔴 -2   — NOT -3
Math.floor(-2.5);   // -3
Math.ceil(-2.5);    // -2
Math.trunc(-2.5);   // -2
```

🔴 **`Math.round` rounds a `.5` toward positive infinity**, not away from zero. So it is
*asymmetric*: `2.5 → 3` but `-2.5 → -2`. Averaging rounded values, or rounding a signed delta, is
where this shows up as a real discrepancy.

| Value | `round` | `floor` | `ceil` | `trunc` |
|---|---|---|---|---|
| `2.5` | 3 | 2 | 3 | 2 |
| `2.4` | 2 | 2 | 3 | 2 |
| `-2.4` | -2 | -3 | -2 | -2 |
| `-2.5` | **-2** | -3 | -2 | -2 |

**`Math.trunc` is "drop the decimals"** and is what you almost always mean for integer division:

```js
Math.trunc(7 / 2);   // 3
Math.trunc(-7 / 2);  // -3   — Math.floor would give -4
```

⚠️ **`n | 0` and `~~n` also truncate, and silently break above 2³¹.** They coerce to a 32-bit signed
integer, so `3_000_000_000 | 0` is negative. They are a micro-optimisation with a correctness cliff
— use `Math.trunc`.

## `toFixed` returns a **string**, and rounds by the bits

```js
(1.5).toFixed(2);        // "1.50"   — a string, not a number
(1.5).toFixed(2) + 1;    // "1.501"  🔴 concatenation
Number((1.5).toFixed(2)) // 1.5      — convert back explicitly
```

That is the half people remember. The half that costs money:

```js
(1.005).toFixed(2);   // 🔴 "1.00" — not "1.01"
(2.675).toFixed(2);   // 🔴 "2.67" — not "2.68"
```

**Neither is a bug.** `1.005` cannot be represented exactly in binary; the stored value is very
slightly *below* 1.005, so rounding to two places correctly gives `1.00`. `toFixed` is rounding the
number that exists, not the decimal you typed.

**There is no "fix" for this at the `toFixed` level** — any decimal fraction has the same hazard.
The answers are further up:

- **For display**, use `Intl.NumberFormat`, which is locale-aware, groups thousands, and handles
  currency (topic **20 · `Intl`** *(not written yet)*):
  ```js
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(1234.5);
  ```
- **For money, do not store floats at all.**

## Money: integers, always

🔴 **Store the smallest unit as an integer** — cents, pence, satoshi — and divide only when
displaying:

```js
const totalCents = items.reduce((n, i) => n + i.priceCents, 0);   // exact integer arithmetic
format(totalCents / 100);                                          // divide once, at the edge
```

`0.1 + 0.2 === 0.30000000000000004` is the famous demonstration, and the practical version is worse:
summing a few hundred float prices drifts by amounts an accountant will find. Integers up to
`Number.MAX_SAFE_INTEGER` are exact, which is about **9 quadrillion** — nine trillion pounds in
pence, so the range is not the constraint.

The alternatives, when integers are not enough: **`BigInt`** for exact integers beyond 2⁵³, or a
decimal library for arbitrary-precision fractions. ⚠️ `BigInt` does not mix with `Number` in
arithmetic (`1n + 1` throws) and has no fractions — it is not a money type by itself.

## Safe integers, and where the boundary bites

```js
Number.MAX_SAFE_INTEGER;              // 9007199254740991  (2⁵³ − 1)
Number.MAX_SAFE_INTEGER + 1 === Number.MAX_SAFE_INTEGER + 2;   // 🔴 true
Number.isSafeInteger(2 ** 53);        // false
```

Beyond 2⁵³ the gaps between representable integers exceed 1, so distinct values collapse together.
**Where this actually happens: 64-bit IDs from a database or an API.** A Snowflake ID or a
`bigint` primary key arriving as a JSON number **loses its last digits silently**, and two different
records can compare equal.

**The fix is at the boundary**: have the API send those IDs as **strings**, and never
`JSON.parse` them into numbers ([Phase 4 · 15 · Normalising untrusted shapes](../../phase-4-objects-and-classes/15-normalising-untrusted-shapes/README.md)).

## Comparing floats

```js
0.1 + 0.2 === 0.3;                          // false
Math.abs(0.1 + 0.2 - 0.3) < Number.EPSILON; // true
```

`Number.EPSILON` is the gap between 1 and the next representable number (~2.22 × 10⁻¹⁶).

⚠️ **An absolute epsilon only works near 1.** For large values the representable gap is much bigger
than `EPSILON`, so the comparison becomes a strict equality again; for tiny values it is far too
loose. A relative comparison scales with the magnitude:

```js
const close = (a, b, rel = 1e-9) => Math.abs(a - b) <= rel * Math.max(Math.abs(a), Math.abs(b), 1);
```

**Better still, avoid needing it.** Equality on computed floats is usually a sign that the value
should have been an integer (money, counts) or that a tolerance belongs in the domain (a distance
threshold, not a float comparison).

## `toPrecision` and exponential form

```js
(1234.5678).toPrecision(6);   // "1234.57"   — significant digits, not decimal places
(0.000123).toPrecision(2);    // "0.00012"
(123456).toPrecision(2);      // "1.2e+5"    ⚠️ switches to exponential
(1234.5678).toExponential(2); // "1.23e+3"
```

All three return **strings**, like `toFixed`. `toPrecision` counts significant digits and will
switch to exponential notation when the exponent is large — which is rarely what a UI wants, and is
the reason `Intl.NumberFormat` is the better display tool.

## Gotchas

**Symptom:** `Math.round` gave a different answer than expected for a negative number
**Cause:** It rounds `.5` toward positive infinity, so `-2.5 → -2`. It is not symmetric.
**Fix:** `Math.trunc` to drop decimals, or `Math.sign(n) * Math.round(Math.abs(n))` for away-from-zero.

**Symptom:** A total came out with a `1` appended, like `"12.001"`
**Cause:** `toFixed` returns a string, and `+` concatenated.
**Fix:** `Number(x.toFixed(2))`, or keep numbers as numbers and format only at the edge.

**Symptom:** `(1.005).toFixed(2)` is `"1.00"`
**Cause:** `1.005` is not exactly representable; the stored value is slightly below it.
**Fix:** None at this level. Store money as integer minor units and format with `Intl.NumberFormat`.

**Symptom:** Summed prices are off by a penny
**Cause:** Float accumulation.
**Fix:** Integer cents, divided once for display.

**Symptom:** Two different records have the same ID
**Cause:** A 64-bit ID was parsed as a `Number` and lost precision beyond 2⁵³.
**Fix:** Carry those IDs as strings end to end.

**Symptom:** `n | 0` produced a negative number
**Cause:** Bitwise operators coerce to 32-bit signed integers.
**Fix:** `Math.trunc`.

**Symptom:** An epsilon comparison fails for large numbers
**Cause:** `Number.EPSILON` is the gap near 1; the real gap grows with magnitude.
**Fix:** A relative tolerance — or restructure so the comparison is not on computed floats.

**Symptom:** `toPrecision` returned `"1.2e+5"`
**Cause:** It switches to exponential notation past a certain exponent.
**Fix:** `Intl.NumberFormat` for anything a user reads.

## Interview questions

**★ Why is `0.1 + 0.2 !== 0.3`?**
Numbers are IEEE-754 doubles, and `0.1` and `0.2` have no exact binary representation, so the sum is
`0.30000000000000004`. Compare with a tolerance, or avoid the situation — money should be integer
minor units.

**★ What does `Math.round(-2.5)` return, and why?**
`-2`. `Math.round` rounds a half toward **positive infinity**, not away from zero, so it is
asymmetric across zero. Use `Math.trunc` to drop decimals, or compose with `Math.sign` and
`Math.abs` for away-from-zero.

**★ Two things wrong with using `toFixed` for money?**
It returns a **string**, so any arithmetic afterwards concatenates; and it rounds the *stored binary
value*, so `(1.005).toFixed(2)` is `"1.00"`. Store integer minor units and format with
`Intl.NumberFormat`.

**★ What is `Number.MAX_SAFE_INTEGER` and when does it matter in practice?**
2⁵³ − 1. Above it, the gaps between representable integers exceed 1, so distinct values collapse —
`MAX_SAFE_INTEGER + 1 === MAX_SAFE_INTEGER + 2`. It matters for 64-bit database IDs arriving as JSON
numbers: they silently lose their last digits. Carry them as strings.

**★ How do you compare two floats correctly?**
With a tolerance, and a *relative* one — `Number.EPSILON` is the gap near 1, so an absolute epsilon
is too tight for large numbers and too loose for small ones. Better still, restructure so equality
is on integers rather than computed floats.

**What is the difference between `Math.trunc` and `Math.floor`?**
They agree on positives and differ on negatives: `trunc` drops the decimals (`-2.5 → -2`) while
`floor` goes down (`-2.5 → -3`). For integer division, `trunc` is almost always what you mean.

**Why avoid `| 0` for truncation?**
It coerces to a 32-bit signed integer, so any value beyond about 2.1 billion wraps to a wrong,
often negative, result. `Math.trunc` has no such cliff.

---

← [Topic index](./README.md) · [Phase index](../README.md) · Next: [2 · Parsing, checking and the helpers](./02-parsing-checking-helpers.md) →
