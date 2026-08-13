---
title: "16 · `Object.is`, `-0` and `Infinity`"
sidebar_label: "16 · Object.is, -0, Infinity"
sidebar_position: 16
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 on **Node 24.19.0**. Scripts: `sandbox/js-p1/ex8-null-nan-equality.mjs`,
> `ex9-zero-infinity.mjs`.

**`Object.is` is the fourth equality algorithm, and it differs from `===` on
exactly two values: `NaN` and `-0`.** Those two values are also the only reason
this page exists.

## Measured

```
  0 === -0            : true | Object.is(0,-0): false
  1/0 = Infinity | -1/0 = -Infinity | 0/0 = NaN
  Math.round(-0.2)    : -0 | is it -0? true
  [-0].includes(0)    : true | [-0].indexOf(0): 0
```

```
Math.max()          = -Infinity
Math.min()          = Infinity
Math.max(...[])     = -Infinity
Number.MAX_VALUE*2  = Infinity
-1/Infinity is -0?  = true
0 * -1 is -0?       = true
String(-0)          = "0"
JSON.stringify(-0)  = 0
-0 < 0              = false | -0 + 0 = 0
1/-0 === -Infinity  = true
atan2(0,-1)         = 3.141592653589793
atan2(-0,-1)        = -3.141592653589793
isFinite(Infinity)  = false | isNaN(Infinity) = false
```

## The four algorithms, side by side

| | `NaN` vs `NaN` | `0` vs `-0` | Used by |
|---|---|---|---|
| `==` | not equal | equal | `==` |
| `===` | not equal | equal | `===`, `indexOf`, `switch` |
| **SameValueZero** | **equal** | equal | `includes`, `Map`/`Set` keys |
| **SameValue** | **equal** | **not equal** | **`Object.is`** |

`Object.is` is the strictest: it is `===` with the two IEEE-754 special cases
fixed. For every other value it behaves identically to `===` — including for
objects, where it is still identity comparison.

```js
Object.is(1, 1);             // true
Object.is({}, {});           // false — identity, same as ===
Object.is(NaN, NaN);         // true  — differs from ===
Object.is(0, -0);            // false — differs from ===
```

## `-0` is a real value

IEEE-754 has a signed zero. It arises from underflow, from multiplying or
dividing by a negative, and from rounding:

```
  Math.round(-0.2)    : -0 | is it -0? true
```

```js
-0;              // -0
0 * -1;          // -0
-1 / Infinity;   // -0
Math.round(-0.2);// -0
```

It is almost entirely invisible, because it behaves like `0` everywhere you would
normally look:

```js
-0 === 0;        // true
-0 < 0;          // false
-0 + 0;          // 0
[-0].includes(0);// true
String(-0);      // '0'   ← even printing hides it
JSON.stringify(-0); // '0'
```

`String(-0)` is `'0'`, so **you cannot see it by logging the value alone**. The
two ways to detect it:

```js
Object.is(x, -0);       // direct
1 / x === -Infinity;    // the classic trick — 1/0 is Infinity, 1/-0 is -Infinity
```

### Where it actually matters

Rarely — but when it does, it is confusing:

```js
// A sort comparator returning -0 is fine (treated as 0), but…
const direction = Math.round(delta * -1);   // could be -0
if (Object.is(direction, -0)) { /* almost certainly not what you meant */ }

// Animation and geometry: -0 vs 0 can flip a sign downstream
Math.atan2(0, -1);    //  3.14159…
Math.atan2(-0, -1);   // -3.14159…  ← different result
```

`Math.atan2` is the standard example where the sign of zero genuinely changes the
answer. Outside geometry and low-level maths you can mostly ignore `-0`,
**as long as you know it exists** — otherwise a stray `-0` in a snapshot test or
a strict deep-equal is baffling.

Note `Object.is` treating `-0` as distinct means a deep-equal built on it will
report `{x: 0}` and `{x: -0}` as different. That is technically correct and
almost never what a test author wants; `node:util`'s `isDeepStrictEqual` also
distinguishes them.

## `Infinity`

```
  1/0 = Infinity | -1/0 = -Infinity | 0/0 = NaN
```

Division by zero does not throw. You get `Infinity`, `-Infinity` or — for `0/0` —
`NaN`.

```js
Number.MAX_VALUE * 2;        // Infinity (overflow)
Math.max();                  // -Infinity  ← no arguments
Math.min();                  // Infinity
Number.POSITIVE_INFINITY;    // Infinity
```

`Math.max()` with no arguments returning `-Infinity` is the identity element, and
it is a real trap when the array you spread turns out to be empty:

```js
Math.max(...[]);             // -Infinity, not 0 and not an error
```

Like `NaN`, `Infinity` **propagates silently** through arithmetic. And it
survives a `Number.isNaN` check, which is why
`Number.isFinite` is the right validation:

```js
Number.isFinite(Infinity);   // false  ✅ rejects it
Number.isNaN(Infinity);      // false  ❌ lets it through
```

`JSON.stringify` turns both `NaN` and `Infinity` into `null`
([page 14](./14-value-equality.md)), so a bad value can cross a network boundary
disguised as an absent one.

## When to reach for `Object.is`

Honestly, seldom — but it is the right primitive inside comparison helpers:

```js
const shallowEqual = (a, b) =>
  Object.keys(a).length === Object.keys(b).length &&
  Object.keys(a).every(k => Object.hasOwn(b, k) && Object.is(a[k], b[k]));
```

Using `Object.is` here means a `NaN` field compares equal to itself, so a
component holding `NaN` in state does not re-render forever. React's own
`Object.is`-based comparison is exactly this reasoning.

For everyday code, keep using `===`.

## Gotchas

**Symptom:** a value logs as `0` but a strict comparison or snapshot fails.
**Cause:** it is `-0`; `String(-0)` is `'0'`, so logging hides it.
**Fix:** detect with `Object.is(x, -0)` or `1 / x === -Infinity`. Normalise with
`x + 0` if you want plain `0`.

**Symptom:** `Math.max(...values)` returned `-Infinity`.
**Cause:** `values` was empty, and `-Infinity` is the identity for `max`.
**Fix:** guard the empty case explicitly.

**Symptom:** a total became `Infinity` and no error was thrown.
**Cause:** division by zero or numeric overflow.
**Fix:** validate with `Number.isFinite`, which rejects `NaN` and both
infinities.

**Symptom:** `Number.isNaN` passed but the value was `Infinity`.
**Cause:** `Infinity` is not `NaN`.
**Fix:** `Number.isFinite`.

**Symptom:** an `Infinity` arrived at the server as `null`.
**Cause:** `JSON.stringify` has no representation for it.
**Fix:** validate before serialising.

**Symptom:** a deep-equal reported two identical-looking objects different.
**Cause:** one holds `0`, the other `-0`, and the comparison uses `Object.is`.
**Fix:** normalise, or use a comparison based on `===` if the distinction is
irrelevant to you.

## Interview questions

**★ What does `Object.is` do that `===` does not?**
It differs on exactly two values: `Object.is(NaN, NaN)` is `true` where `===` is
`false`, and `Object.is(0, -0)` is `false` where `===` is `true`. Everything
else, including object identity, behaves identically. It is the SameValue
algorithm — `===` with the two IEEE-754 special cases fixed.

**★ Does `-0` matter in practice?**
Rarely, but it is real. It arises from `0 * -1`, underflow and rounding —
measured, `Math.round(-0.2)` is `-0`. It behaves like `0` under `===`,
`includes`, `String()` and `JSON.stringify`, so it is invisible to logging. It
matters in geometry (`Math.atan2(0,-1)` and `Math.atan2(-0,-1)` differ in sign)
and it will make an `Object.is`-based deep-equal report a difference.

**How do you detect `-0`?**
`Object.is(x, -0)`, or the classic `1 / x === -Infinity`. You cannot see it by
logging, because `String(-0)` is `'0'`.

**Why is `Number.isFinite` better than `Number.isNaN` for validation?**
It rejects `NaN` **and** both infinities in one check. `Number.isNaN(Infinity)`
is `false`, so an overflow or a division by zero passes a `NaN`-only check and
propagates silently.

**What does `Math.max()` return with no arguments?**
`-Infinity` — the identity element for maximum. This matters because
`Math.max(...arr)` on an empty array returns `-Infinity` rather than throwing or
returning `0`.

---

← [15 · Object wrappers](./15-object-wrappers.md) · [Phase index](./) · Next: [17 · Numeric literals](./17-numeric-literals.md) →
