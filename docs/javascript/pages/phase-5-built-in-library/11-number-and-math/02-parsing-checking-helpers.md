---
title: "2 · Parsing, checking and the helpers"
sidebar_label: "2 · Parsing and checking"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`Number()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/Number), [`parseInt()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/parseInt), [`parseFloat()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/parseFloat), [`Number.isNaN()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/isNaN), [`isNaN()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/isNaN), [`Number.isFinite()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/isFinite), [`Number.isInteger()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/isInteger), [`Math.random()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/random), [`Math.max()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/max), [`Math.min()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/min), [`Math.hypot()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/hypot), [`Crypto.getRandomValues()`](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/getRandomValues), [`Crypto.randomUUID()`](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID). Documentation-validated; **no timings**.

## Three ways to turn a string into a number, and they disagree

```js
Number("42");       // 42
Number("42px");     // 🔴 NaN     — the WHOLE string must be numeric
Number("");         // 🔴 0       — empty is zero
Number(null);       // 🔴 0
Number(undefined);  // NaN
Number(" 42 ");     // 42        — whitespace is trimmed

parseInt("42px");   // 42        — reads a prefix and stops
parseInt("px42");   // NaN       — nothing numeric at the start
parseFloat("1.5e3");// 1500
+"42";              // 42        — identical to Number()
```

| | Whole string required | `""` | Trailing junk | Decimals |
|---|---|---|---|---|
| `Number(x)` / `+x` | ✅ | `0` | `NaN` | ✅ |
| `parseInt(x, 10)` | ❌ | `NaN` | ignored | ❌ truncates |
| `parseFloat(x)` | ❌ | `NaN` | ignored | ✅ |

**Choose by whether a prefix should count.** A CSS value (`"12px"`) wants `parseInt`; a form field
that must be a number wants `Number` plus a check. 🔴 **`Number("")` being `0` is the trap** — an
empty input becoming a real zero, which is the normalising bug in
[Phase 4 · 15](../../phase-4-objects-and-classes/15-normalising-untrusted-shapes/02-normalising-at-the-boundary.md).

⚠️ **Always pass `parseInt`'s radix.** Without it, a leading `0x` is read as hexadecimal:

```js
parseInt("0x10");       // 16
parseInt("0x10", 10);   // 0   — stops at the "x"
```

Modern engines no longer treat a leading `0` as octal, so `parseInt("08")` is `8` — but the radix
argument still costs nothing and removes the question.

## The `Number.*` predicates exist because the globals coerce

```js
isNaN("abc");         // 🔴 true  — coerces to NaN first
Number.isNaN("abc");  // false     — it is a string, not NaN

isFinite("42");        // 🔴 true  — coerces
Number.isFinite("42"); // false
```

🔴 **Use the `Number.` versions, always.** The globals answer "would this be NaN/finite *after
coercion*", which is almost never the question. `Number.isNaN` is the only reliable NaN test
because `NaN !== NaN`.

```js
Number.isInteger(5.0);   // true — 5.0 and 5 are the same value
Number.isInteger("5");   // false — no coercion
```

**A complete numeric check at a boundary** is a conversion plus a finiteness test — which also
rejects `Infinity`, `NaN`, `""` and `null` in one step:

```js
const toNumber = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
```

## `Math.random`, and when it is not good enough

```js
Math.random();   // [0, 1) — never exactly 1
```

**A random integer in an inclusive range**, which is the formula worth memorising because
off-by-ones here are silent:

```js
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
randomInt(1, 6);   // 1..6 inclusive
```

The `+ 1` is what makes `max` reachable; without it `randomInt(1, 6)` never returns 6.

🔴 **`Math.random` is not cryptographically secure**, and MDN says so explicitly. Anything an
attacker benefits from predicting — a token, a password-reset code, a session ID, a shuffle in a
game with stakes — must use the Web Crypto API:

```js
crypto.randomUUID();                          // a v4 UUID
crypto.getRandomValues(new Uint32Array(1));   // raw secure bytes
```

⚠️ **A shuffle written as `arr.sort(() => Math.random() - 0.5)` is not uniform**, and it is not a
matter of degree — the comparator is inconsistent, so the result depends on the sort algorithm.
Fisher–Yates is the correct shuffle, and it is short:

```js
for (let i = a.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  [a[i], a[j]] = [a[j], a[i]];
}
```

## Clamping, `min`/`max`, and the empty-array trap

```js
const clamp = (n, lo, hi) => Math.min(Math.max(n, lo), hi);
clamp(15, 0, 10);   // 10
```

`Math.min` and `Math.max` take **variadic arguments, not an array**, so an array needs spreading —
and that brings two hazards:

```js
Math.max(...[3, 1, 2]);   // 3
Math.max(...[]);          // 🔴 -Infinity   — and Math.min(...[]) is Infinity
```

🔴 **The empty case is the bug.** `Math.max(...prices)` on an empty cart returns `-Infinity`, which
then formats as `"-∞"` or poisons a total. Guard the length, or use a `reduce` with a real initial
value.

⚠️ **Spreading a very large array can exceed the engine's argument limit** and throw
`RangeError: Maximum call stack size exceeded`. MDN documents this caveat; the fix is a reduce:

```js
const max = arr.reduce((m, n) => (n > m ? n : m), -Infinity);
```

## The `Math` members worth knowing exist

| | |
|---|---|
| `Math.abs`, `Math.sign` | magnitude and direction (`sign` gives `-1`, `0`, `1`, and `-0` for `-0`) |
| `Math.hypot(a, b)` | `√(a² + b²)` without intermediate overflow — the right distance helper |
| `Math.pow(a, b)` / `a ** b` | the operator is idiomatic now |
| `Math.cbrt`, `Math.log2`, `Math.log10` | exact-ish versions of things people write by hand |
| `Math.PI`, `Math.E` | constants |

⚠️ **`Math.max()` and `Math.min()` with no arguments return `-Infinity` and `Infinity`** — the
identity values. That is correct and is the reason the empty-spread case behaves as it does.

## Gotchas

**Symptom:** An empty form field saved as `0`
**Cause:** `Number("")` is `0`, and `Number(null)` is too.
**Fix:** Check for absence before converting; `Number.isFinite` after.

**Symptom:** `"12px"` became `12` where it should have been rejected
**Cause:** `parseInt` reads a numeric prefix and stops.
**Fix:** `Number()` when the whole string must be numeric.

**Symptom:** `parseInt("0x10")` returned `16`
**Cause:** No radix, so a `0x` prefix is read as hex.
**Fix:** Always pass `10`.

**Symptom:** `isNaN(value)` was true for a plain string
**Cause:** The global coerces first.
**Fix:** `Number.isNaN`, and `Number.isFinite` instead of global `isFinite`.

**Symptom:** A random integer never produced the maximum
**Cause:** Missing `+ 1` — `Math.random()` never reaches 1.
**Fix:** `Math.floor(Math.random() * (max - min + 1)) + min`.

**Symptom:** A "random" token turned out to be predictable
**Cause:** `Math.random` is not cryptographically secure.
**Fix:** `crypto.randomUUID()` or `crypto.getRandomValues()`.

**Symptom:** A shuffle is visibly biased
**Cause:** `sort(() => Math.random() - 0.5)` uses an inconsistent comparator.
**Fix:** Fisher–Yates.

**Symptom:** A maximum came out as `-Infinity`
**Cause:** `Math.max(...[])` returns the identity value.
**Fix:** Guard for an empty array, or `reduce`.

**Symptom:** `RangeError: Maximum call stack size exceeded` from `Math.max(...arr)`
**Cause:** Spreading a very large array exceeds the argument limit.
**Fix:** `arr.reduce(...)`.

## Interview questions

**★ What is the difference between `Number("42px")` and `parseInt("42px")`?**
`Number` requires the entire string to be numeric and gives `NaN` otherwise; `parseInt` reads a
numeric prefix and stops, giving `42`. Use `parseInt` for values with units, `Number` for input that
must be wholly numeric — and remember `Number("")` is `0`.

**★ Why use `Number.isNaN` rather than the global `isNaN`?**
The global coerces its argument first, so `isNaN("abc")` is `true` even though a string is not
`NaN`. `Number.isNaN` tests the value as it is. The same applies to `Number.isFinite` versus global
`isFinite`.

**★ Write a random integer between min and max inclusive.**
`Math.floor(Math.random() * (max - min + 1)) + min`. The `+ 1` is what makes `max` reachable, since
`Math.random()` returns `[0, 1)`.

**★ When is `Math.random` not acceptable?**
Whenever predicting the value benefits someone — tokens, password-reset codes, session identifiers,
anything with stakes. It is explicitly not cryptographically secure; use `crypto.randomUUID` or
`crypto.getRandomValues`.

**★ What is wrong with `arr.sort(() => Math.random() - 0.5)`?**
The comparator is inconsistent, so the result is not a uniform shuffle and depends on the sort
algorithm. Use Fisher–Yates, which is a five-line loop.

**What does `Math.max()` return with no arguments, and why does it matter?**
`-Infinity`, the identity value (`Math.min()` gives `Infinity`). It matters because
`Math.max(...emptyArray)` hits exactly that case and produces `-Infinity` where code expected a real
maximum.

**Why pass a radix to `parseInt`?**
Without it, a leading `0x` is interpreted as hexadecimal, so `parseInt("0x10")` is `16`. Modern
engines no longer treat a leading `0` as octal, but passing `10` costs nothing and removes the
question entirely.

---

← [1 · Rounding and precision](./01-rounding-and-precision.md) · [Topic index](./README.md) · [Phase index](../README.md) →
