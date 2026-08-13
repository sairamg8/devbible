---
title: "04 · Truthiness"
sidebar_label: "04 · Truthiness"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0**. Script: `sandbox/js-p1/ex3-falsy.mjs`.

**Learn the eight falsy values. Everything else is truthy.** There is no third
category and no judgement involved — `if (x)` converts `x` with `ToBoolean` and
that function has exactly eight inputs that produce `false`.

## Measured

```js
// sandbox/js-p1/ex3-falsy.mjs
const candidates = [false, 0, -0, 0n, '', null, undefined, NaN,
                    '0', 'false', [], {}, ' ', -1, Infinity, function(){}, new Boolean(false)];
console.log('FALSY: ', candidates.filter(v => !v).map(name).join(', '));
console.log('TRUTHY:', candidates.filter(v => !!v).map(name).join(', '));
```

```
FALSY:  false, 0, -0, 0n, "", null, undefined, NaN
TRUTHY: "0", "false", [], {}, " ", -1, Infinity, function(){}, new Boolean(false)
```

## The eight falsy values

| Value | Note |
|---|---|
| `false` | |
| `0` | |
| `-0` | Distinct value, same falsiness |
| `0n` | BigInt zero |
| `''` | Empty string only — `' '` with a space is **truthy** |
| `null` | |
| `undefined` | |
| `NaN` | |

**That is the complete list.** If a value is not one of those eight, `if (value)`
runs the block.

## The truthy values that surprise people

| Value | Truthy because |
|---|---|
| `'0'` | A non-empty string. Length is all that matters. |
| `'false'` | Same — it is a five-character string. |
| `[]` | An object. Emptiness is irrelevant. |
| `{}` | An object. |
| `' '` | Non-empty. |
| `new Boolean(false)` | **An object wrapper** — objects are always truthy, including one wrapping `false`. |
| `-1`, `Infinity` | Non-zero numbers. |

`[]` being truthy while `[] == false` is `true` ([page 03](./03-equality.md)) is
the classic confusion. They are different operations: `if ([])` uses
`ToBoolean`, which says "object → true" and stops. `[] == false` uses the
equality algorithm, which converts the array to a primitive first. **Truthiness
never converts an object to a primitive; equality does.**

## The bug this actually causes

```js
// A product legitimately has 0 in stock, or a 0% discount, or an empty note.
function renderStock(stock) {
  if (!stock) return 'Unavailable';         // WRONG: 0 in stock says "Unavailable"
  return `${stock} left`;
}

function applyDiscount(pct) {
  const rate = pct || 0.1;                  // WRONG: a 0% discount becomes 10%
  return rate;
}

function label(note) {
  return note || 'No note';                 // WRONG: '' is a deliberate empty note
}
```

Every one of these breaks on a **valid falsy value**. The fix is to say what you
mean:

```js
function renderStock(stock) {
  if (stock == null) return 'Unavailable';  // null/undefined only
  if (stock === 0) return 'Out of stock';   // 0 is a real, different state
  return `${stock} left`;
}

const rate = pct ?? 0.1;                    // only null/undefined fall back
const text = note ?? 'No note';
```

`??` is the correct default operator whenever `0`, `''` or `false` is a
legitimate value — which, in a storefront, is most of the time. Full treatment in
[page 05](./05-null-vs-undefined.md).

## Checking emptiness correctly

Because `[]` and `{}` are truthy, these do not do what they look like:

```js
if (items) …            // always true, even for []
if (filters) …          // always true, even for {}
```

```js
if (items.length > 0) …                    // arrays
if (Object.keys(filters).length > 0) …     // plain objects
if (map.size > 0) …                        // Map / Set
if (str.trim() !== '') …                   // strings, ignoring whitespace
```

And the safe combined form when the value might be missing entirely:

```js
if (items?.length) …          // undefined → undefined (falsy); [] → 0 (falsy); [1] → 1 (truthy)
```

That idiom reads well and is correct, because `length` is a number and `0` is
falsy.

## Converting to boolean explicitly

```js
Boolean(value)   // clearest
!!value          // idiomatic, same result
```

`!!` is the common shorthand — the first `!` produces the negated boolean, the
second flips it back. Use it in code, and `Boolean()` when clarity for a reader
matters more than brevity.

**Do not use it to normalise API data.** `!!response.inStock` turns
`undefined` into `false`, which silently converts "the field is missing" into "we
know it is out of stock". Validate the shape instead.

## Gotchas

**Symptom:** a legitimate `0` is treated as missing.
**Cause:** `if (!value)` or `value || fallback` — `0` is falsy.
**Fix:** `value ?? fallback`, or compare explicitly with `=== 0`.

**Symptom:** `if (array)` is always true, even when the array is empty.
**Cause:** every object is truthy; emptiness is not consulted.
**Fix:** `array.length > 0`, or `array?.length`.

**Symptom:** `'false'` from a query string or env var behaves as `true`.
**Cause:** it is a non-empty string; `ToBoolean` does not read its contents.
**Fix:** compare explicitly: `value === 'true'`. Env vars and query params are
always strings.

**Symptom:** `if (new Boolean(false))` runs the block.
**Cause:** it is an object wrapper, and objects are truthy.
**Fix:** never use `new Boolean` — see [page 15](./15-object-wrappers.md).

**Symptom:** an empty note or an empty search term gets replaced by a default.
**Cause:** `''` is falsy and `||` fired.
**Fix:** `??`.

## Interview questions

**★ List the falsy values.**
Eight: `false`, `0`, `-0`, `0n`, `''`, `null`, `undefined`, `NaN`. Everything
else is truthy — including `'0'`, `'false'`, `[]`, `{}` and `new Boolean(false)`.

**★ Why is `[]` truthy when `[] == false` is true?**
Two different operations. `if ([])` uses `ToBoolean`, which maps every object to
`true` without inspecting it. `[] == false` uses the equality algorithm, which
converts the boolean to `0` and the array to `''` and then to `0`, giving
`0 == 0`. Truthiness never converts an object to a primitive; loose equality
does.

**★ When should you use `??` instead of `||`?**
Whenever `0`, `''` or `false` is a legitimate value. `||` falls back on any falsy
value, so a 0% discount, an empty note or a `false` flag gets silently replaced.
`??` falls back only on `null` and `undefined`.

**How do you check whether an object is empty?**
`Object.keys(obj).length === 0` for a plain object, `arr.length === 0` for an
array, `map.size === 0` for `Map`/`Set`. `if (obj)` is always true because
objects are truthy.

**Why is `''` falsy but `' '` truthy?**
`ToBoolean` on a string is "is the length zero?". A single space has length 1.
Use `str.trim() !== ''` when whitespace-only should count as empty.

---

← [03 · Equality](./03-equality.md) · [Phase index](./) · Next: [05 · `null` vs `undefined`](./05-null-vs-undefined.md) →
