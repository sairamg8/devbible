---
title: "08 · Type coercion"
sidebar_label: "08 · Type coercion"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0**. Script: `sandbox/js-p1/ex6-coercion.mjs`.

**Every famous "JavaScript is broken" screenshot is this page.** The rules are
short and completely deterministic. Learn them once and the jokes stop being
mysterious — and, more usefully, you stop writing the bugs they describe.

## Measured

```
[] + {}                  -> "[object Object]" (string)
({}) + []  expression    -> "[object Object]" (string)
{} + [] as a STATEMENT -> 0 (block, then unary + on [])
[] + []                  -> "" (string)
1 + "2"                  -> "12" (string)
1 - "2"                  -> -1 (number)
"3" * "4"                -> 12 (number)
true + true              -> 2 (number)
[1,2] + [3]              -> "1,23" (string)
null + 1                 -> 1 (number)
undefined + 1            -> NaN (number)
"5" - - "2"              -> 7 (number)
```

## The rules

Coercion is three abstract operations. That is all.

**`ToPrimitive(value, hint)`** — turn an object into a primitive:

- hint `"string"` → try `toString()`, then `valueOf()`
- hint `"number"` or `"default"` → try `valueOf()`, then `toString()`
- `Symbol.toPrimitive`, if present, overrides everything

**`ToNumber`**:

| Input | Result |
|---|---|
| `undefined` | `NaN` |
| `null` | **`0`** |
| `true` / `false` | `1` / `0` |
| `''` or whitespace | `0` |
| `'42'`, `' 7 '` | `42`, `7` (trimmed) |
| `'42px'`, `'abc'` | `NaN` |
| `[]` | `0` (→ `''` → `0`) |
| `['9']` | `9` (→ `'9'` → `9`) |
| `[1,2]`, `{}` | `NaN` |

**`ToString`**: `null` → `'null'`, `undefined` → `'undefined'`, `[1,2]` →
`'1,2'` (it is `join(',')`), `{}` → `'[object Object]'`.

## `+` is the only operator that concatenates

This single asymmetry explains most of the table:

> **If either operand of `+` is a string after `ToPrimitive`, the result is
> string concatenation. Every other arithmetic operator converts to number.**

```js
1 + '2'    // '12'  — one side is a string, so concatenate
1 - '2'    // -1    — minus has no string meaning, so ToNumber both
'3' * '4'  // 12    — same
```

Work the confusing ones:

- **`[] + []`** → both `ToPrimitive` to `''` → `'' + ''` → `''`. An empty string,
  printed as nothing.
- **`[] + {}`** → `''` + `'[object Object]'` → `'[object Object]'`.
- **`[1,2] + [3]`** → `'1,2'` + `'3'` → `'1,23'`.
- **`null + 1`** → `+` finds no string, so `ToNumber(null)` is `0` → `1`.
- **`undefined + 1`** → `ToNumber(undefined)` is `NaN` → `NaN`.
- **`true + true`** → `1 + 1` → `2`.
- **`'5' - - '2'`** → the inner unary `-` makes `-2`, then `5 - (-2)` → `7`.

## The `{} + []` trick is not about coercion at all

```
({}) + []  expression    -> "[object Object]" (string)
{} + [] as a STATEMENT -> 0 (block, then unary + on [])
```

**Two different answers for the same characters**, and only one of them involves
addition.

At the start of a statement, `{}` is parsed as an empty **block**, not an object
literal. What remains is `+[]` — unary plus on an empty array — which is
`ToNumber('')`, i.e. `0`.

In expression position (inside parentheses, or after `=`), `{}` really is an
object literal and you get concatenation.

This is why the trick "works" in a browser console and not in your code: the
console evaluates a statement. It is a **parsing** curiosity, filed under
coercion because that is where people meet it.

## Where this actually bites

```js
// 1. A numeric input arrives as a string
const qty = input.value;          // '2' — form values are ALWAYS strings
const total = qty + 1;            // '21'  ← concatenation, not 3

// 2. Summing with a string seed
['10', '20'].reduce((a, b) => a + b, '');   // '1020'

// 3. A total becomes text after one bad field
const price = 100, shipping = '50';
price + shipping;                 // '10050'
```

Every one is `+` finding a string. The fix is always the same: **convert at the
boundary**, not at the point of use.

```js
const qty = Number(input.value);
if (!Number.isFinite(qty)) throw new Error('quantity must be a number');
```

Form fields, `URLSearchParams`, `localStorage`, environment variables and
`dataset` values are **all strings**, always. That is the source of nearly every
real coercion bug.

## Template literals always use hint `"string"`

```js
`${obj}`     // ToPrimitive(obj, 'string') → toString first
'' + obj     // ToPrimitive(obj, 'default') → valueOf first
```

For most objects both reach `'[object Object]'`. For a `Date` they differ, which
is why `date + ''` gives a date string —
[Phase 0 · 12](../phase-0-how-javascript-runs/reading-the-spec) has the measured
version.

## Controlling coercion on your own objects

```js
class Money {
  #minor;
  constructor(minor) { this.#minor = minor; }
  valueOf()  { return this.#minor; }                     // arithmetic
  toString() { return `₹${(this.#minor / 100).toFixed(2)}`; }   // display
  toJSON()   { return { minor: this.#minor }; }          // serialisation
}

const price = new Money(49900);
price * 2;          // 99800     — valueOf
`${price}`;         // '₹499.00' — toString
JSON.stringify({ price });   // '{"price":{"minor":49900}}'
```

Defining `Symbol.toPrimitive` instead gives you one method that receives the hint
and controls all three cases explicitly. Prefer it when the behaviour must be
unambiguous.

## Gotchas

**Symptom:** adding two numbers produced a concatenated string.
**Cause:** one was a string — usually a form value, query param or env var.
**Fix:** `Number()` at the boundary, validate with `Number.isFinite`.

**Symptom:** a total became `NaN`.
**Cause:** `undefined` reached arithmetic (`ToNumber(undefined)` is `NaN`), and
`NaN` propagates through everything after.
**Fix:** validate the shape before computing.

**Symptom:** `null` in arithmetic silently behaved as `0`.
**Cause:** `ToNumber(null)` is `0` — unlike `undefined`.
**Fix:** check `== null` first. A `null` price silently becoming free is worse
than a `NaN` you can see.

**Symptom:** an object printed as `[object Object]`.
**Cause:** default `ToString`.
**Fix:** `JSON.stringify` for debugging, or define `toString`.

**Symptom:** `'2' > '10'` is `true`.
**Cause:** two strings compare **lexicographically** — no numeric conversion
happens when both sides are already strings.
**Fix:** convert both to numbers first.

## Interview questions

**★ Explain `[] + {}` versus `{} + []`.**
`[] + {}` is `''` + `'[object Object]'` = `'[object Object]'`. `{} + []` as a
*statement* is not addition at all: `{}` parses as an empty block, leaving
unary `+[]`, which is `ToNumber('')` = `0`. Measured both: `"[object Object]"`
as an expression, `0` as a statement. It is a parsing question wearing a
coercion costume.

**★ Why is `1 + '2'` `'12'` but `1 - '2'` `-1`?**
`+` is overloaded: if either operand is a string after `ToPrimitive`, it
concatenates. No other arithmetic operator has a string meaning, so `-`, `*`,
`/` and `%` always apply `ToNumber` to both sides.

**★ What is `ToPrimitive`?**
The abstract operation that converts an object to a primitive. It takes a hint:
`"string"` tries `toString` then `valueOf`; `"number"` and `"default"` try
`valueOf` then `toString`. `Symbol.toPrimitive` overrides both. The operator
chooses the hint — `+` uses `"default"`, template literals use `"string"`,
arithmetic uses `"number"`.

**What does `ToNumber` do with `null` versus `undefined`?**
`null` becomes `0`; `undefined` becomes `NaN`. That asymmetry means a missing
value fails loudly while a `null` quietly behaves as zero — which is how a
`null` price becomes a free item.

**How do you avoid coercion bugs?**
Convert at the boundary. Every form value, query parameter, `localStorage` entry
and environment variable is a string; parse and validate once on the way in, so
the rest of the code works with real types.

---

← [07 · const is not immutable](./07-const-is-not-immutable.md) · [Phase index](./) · Next: [09 · Explicit conversion](./09-explicit-conversion.md) →
