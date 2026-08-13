---
title: "11 · `NaN`"
sidebar_label: "11 · NaN"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0**. Script: `sandbox/js-p1/ex8-null-nan-equality.mjs`.

**`NaN` is the only value in the language that is not equal to itself.** It is
also silent: it propagates through every subsequent operation without throwing,
so it surfaces far from where it entered.

## Measured

```
  NaN === NaN        : false
  isNaN("abc")       : true <- coerces first
  Number.isNaN("abc"): false <- no coercion
  [NaN].includes(NaN): true | [NaN].indexOf(NaN): -1
  new Set([NaN,NaN]).size: 1
```

## Why `NaN !== NaN`

It is IEEE-754, not a JavaScript quirk. `NaN` means "the result of this
computation is not a number" — and two computations that both failed have no
reason to be considered the same value. `0/0` and `Math.sqrt(-1)` are both `NaN`,
and they are not the same failure.

The practical consequence is that you cannot test for it with `===`.

## Detecting it

```js
Number.isNaN(value)        // ✅ correct
Object.is(value, NaN)      // ✅ also correct
value !== value            // ✅ works, and is the historic idiom
isNaN(value)               // ❌ global — coerces first
```

```
  isNaN("abc")       : true
  Number.isNaN("abc"): false
```

**The global `isNaN` converts its argument first.** `isNaN('abc')` is `true`
because `Number('abc')` is `NaN` — but `'abc'` is a string, not `NaN`. That makes
the global version answer a different question: *"would this become NaN if
converted?"*

Almost always you want `Number.isNaN`, which returns `true` only for the actual
`NaN` value.

`value !== value` looks like a trick but is precise, and it is what
`Number.isNaN` does internally.

## Two equality algorithms disagree

```
  [NaN].includes(NaN): true | [NaN].indexOf(NaN): -1
  new Set([NaN,NaN]).size: 1
```

`includes` and `indexOf` search the same array for the same value and give
opposite answers, because they use different algorithms
([page 03](./03-equality.md)):

| Method | Algorithm | `NaN` found? |
|---|---|---|
| `indexOf`, `lastIndexOf` | strict equality (`===`) | ❌ |
| `includes` | SameValueZero | ✅ |
| `Map` / `Set` keys | SameValueZero | ✅ |
| `Object.is` | SameValue | ✅ |

So a `Set` correctly deduplicates `NaN` to one entry, and
`arr.indexOf(NaN) !== -1` is always `false`. **Use `includes` when the array
might contain `NaN`.**

## Where `NaN` comes from in real code

```js
Number('abc')            // a non-numeric form field
undefined + 1            // a missing property in arithmetic
0 / 0                    // dividing by a zero count
parseInt('')             // an empty input
Math.sqrt(-1)            // out-of-domain maths
JSON.parse('{"n":null}').n * 2   // null → 0 is fine, but undefined → NaN
```

The storefront version:

```js
// A price field is missing from one API response
const lines = [{ qty: 2, priceMinor: 49900 }, { qty: 1 }];   // no priceMinor
const total = lines.reduce((s, l) => s + l.qty * l.priceMinor, 0);
// total is NaN — and every downstream calculation stays NaN
```

Nothing threw. The discount is `NaN`, the tax is `NaN`, and the customer sees
`₹NaN`. **`NaN` never gets better on its own** — one bad input poisons the whole
chain.

## Defending against it

Validate where the value enters, not where the symptom appears:

```js
function toMinorUnits(value, field) {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error(`${field} is not a finite number: ${value}`);
  return n;
}
```

`Number.isFinite` is the check to reach for — it rejects `NaN`, `Infinity` and
`-Infinity` in one step. `!Number.isNaN(n)` lets `Infinity` through, and
`Infinity` propagates just as silently.

For a defensive total that must not break the page:

```js
const total = lines.reduce((sum, l) => {
  const line = l.qty * l.priceMinor;
  return sum + (Number.isFinite(line) ? line : 0);
}, 0);
```

That is a display-layer decision, not a substitute for validation — silently
treating a broken line as free is its own bug. Prefer to fail loudly at the
boundary and degrade only in the UI.

## `NaN` and `??`

```js
const qty = Number(input) ?? 1;    // does NOT fall back — NaN is a number
const qty = Number.isFinite(n) ? n : 1;   // correct
```

`??` falls back only on `null` and `undefined` ([page 05](./05-null-vs-undefined.md)).
`NaN` is a `number`, so it passes straight through. This is a common mistake when
converting and defaulting in one expression.

## Gotchas

**Symptom:** a total renders as `NaN` with no error anywhere.
**Cause:** `undefined` or a non-numeric string entered arithmetic, and `NaN`
propagated.
**Fix:** validate at the boundary with `Number.isFinite`. Trace back to the first
operation whose input was not a number.

**Symptom:** `value === NaN` never matches.
**Cause:** `NaN` is not equal to itself.
**Fix:** `Number.isNaN(value)`.

**Symptom:** `isNaN('abc')` returned `true` for a string.
**Cause:** the global `isNaN` coerces first.
**Fix:** `Number.isNaN`.

**Symptom:** `array.indexOf(NaN)` is `-1` although the array contains `NaN`.
**Cause:** `indexOf` uses `===`.
**Fix:** `array.includes(NaN)`, or `findIndex(Number.isNaN)`.

**Symptom:** `Number(input) ?? default` did not apply the default.
**Cause:** `NaN` is a number, so `??` does not fire.
**Fix:** check with `Number.isFinite` and choose explicitly.

**Symptom:** `NaN` appeared in JSON as `null`.
**Cause:** `JSON.stringify` has no representation for `NaN` or `Infinity`.
**Fix:** validate before serialising; a `null` in the payload hides the origin.

## Interview questions

**★ Why is `NaN !== NaN`?**
IEEE-754 defines it that way: `NaN` represents a failed computation, and two
unrelated failures are not the same value. It is the only value in JavaScript not
equal to itself, which is why `Number.isNaN` and `Object.is` exist.

**★ What is the difference between `isNaN` and `Number.isNaN`?**
The global `isNaN` coerces its argument first, so `isNaN('abc')` is `true` even
though `'abc'` is a string — it answers "would this become `NaN`?".
`Number.isNaN` returns `true` only for the actual `NaN` value; measured,
`Number.isNaN('abc')` is `false`. Use `Number.isNaN`.

**★ Why does `[NaN].includes(NaN)` return `true` but `[NaN].indexOf(NaN)` return
`-1`?**
Different equality algorithms. `indexOf` uses strict equality, under which `NaN`
is not equal to itself. `includes` uses SameValueZero, which treats `NaN` as
equal to itself — the same algorithm `Map` and `Set` use for keys, which is why
`new Set([NaN, NaN]).size` is 1.

**How do you prevent `NaN` from reaching production?**
Validate at the boundary with `Number.isFinite`, which rejects `NaN` and both
infinities. `NaN` never throws and propagates through every later operation, so
the symptom appears far from the cause — the only reliable defence is checking
where the value enters.

**Why doesn't `??` catch `NaN`?**
`??` falls back only on `null` and `undefined`, and `NaN` is of type `number`.
Use an explicit `Number.isFinite` check when converting and defaulting together.

---

← [10 · Strings are UTF-16](./10-strings-are-utf16.md) · [Phase index](./) · Next: [12 · `Symbol`](./12-symbol.md) →
