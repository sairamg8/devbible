---
title: "03 · `==` vs `===`"
sidebar_label: "03 · Equality"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0**. Script: `sandbox/js-p1/ex2-equality.mjs`.

**`===` compares without converting. `==` converts first, and the conversion
rules are where the famous nonsense comes from.** Use `===`. This page exists so
that you can *read* `==` in other people's code and know exactly what it does —
and so you know the one case where `==` is the better choice.

## Measured

```
true   0 == false
false  0 === false
true   '' == 0
true   '0' == 0
false  '' == '0'
true   [] == false
true   [] == ![]
true   [] == 0
true   null == undefined
false  null === undefined
false  null == 0
true   null >= 0
false  null > 0
false  NaN == NaN
false  NaN === NaN
true   Object.is(NaN, NaN)
true   0 === -0
false  Object.is(0, -0)
true   '1' == 1
true   [1] == 1
true   [1,2] == '1,2'
false  {} == {}
false  undefined == false
```

Every one of those follows from a short algorithm. None of them is arbitrary.

## The `==` algorithm, in the four cases you actually hit

When the two sides have different types, `==` applies these rules in order:

| Case | Rule | Example |
|---|---|---|
| `null` and `undefined` | Equal to **each other and nothing else** | `null == undefined` → `true`; `null == 0` → `false` |
| number vs string | Convert the **string to a number** | `'0' == 0` → `0 == 0` → `true` |
| boolean on either side | Convert the **boolean to a number** first, then re-apply | `0 == false` → `0 == 0` → `true` |
| object vs primitive | `ToPrimitive` the object, then re-apply | `[] == 0` → `'' == 0` → `0 == 0` → `true` |

That is the whole thing. Work the examples through it:

- **`'' == 0`** → string vs number → `Number('')` is `0` → `0 == 0` → **true**.
- **`[] == false`** → boolean first: `false` → `0`. Now `[] == 0` → object vs
  number → `ToPrimitive([])` is `''` → `Number('')` is `0` → **true**.
- **`[] == ![]`** → `![]` is `false` (arrays are truthy), so this is `[] == false`
  → **true**. It looks like a paradox and is just two rules applied in order.
- **`[1,2] == '1,2'`** → `ToPrimitive([1,2])` calls `join(',')` → `'1,2'` →
  **true**.

## The two rows worth memorising

### `null == undefined` is `true`, and nothing else equals `null`

```
true   null == undefined
false  null == 0
false  undefined == false
```

`null` and `undefined` are `==` to each other and to **no other value** — not
`0`, not `''`, not `false`. This is the one useful behaviour of `==`, and it is
the single defensible use:

```js
if (value == null) { /* value is null OR undefined, nothing else */ }
```

That is more readable than `value === null || value === undefined`, it is
idiomatic, and ESLint's `eqeqeq` rule has a `"smart"`/`allow-null` option
specifically to permit it. Everything else about `==` is a liability.

### `null >= 0` is `true` but `null > 0` is `false`

```
true   null >= 0
false  null > 0
false  null == 0
```

This looks impossible: if `null` is not `>` 0 and not `==` 0, how can it be
`>=` 0?

Because **relational operators and equality use different algorithms.**
`>=` does *not* mean "greater than or equal" as a composite — it converts both
operands with `ToNumber`, and `Number(null)` is `0`, so `0 >= 0` is `true`.
Meanwhile `==` has that special rule saying `null` equals only `undefined`, so
it never reaches a numeric comparison at all.

**Consequence:** never let `null` reach a comparison.

```js
// looks like a bounds check, silently passes for null
if (stock >= 0) reserve(item);

// say what you mean
if (typeof stock === 'number' && stock >= 0) reserve(item);
```

A `null` stock level from an API sails through the first check.

## `NaN` and `-0`: `===` is not the whole story

```
false  NaN === NaN
true   Object.is(NaN, NaN)
true   0 === -0
false  Object.is(0, -0)
```

`===` gets exactly two values "wrong" relative to intuition: it says `NaN` is not
itself, and says `0` and `-0` are the same. There are four equality algorithms in
the language and they differ only on these two values:

| Algorithm | `NaN` vs `NaN` | `0` vs `-0` | Where it is used |
|---|---|---|---|
| `==` (loose) | not equal | equal | `==` |
| `===` (strict) | not equal | equal | `===`, `indexOf`, `switch` |
| **SameValueZero** | **equal** | equal | `includes`, `Map`/`Set` keys |
| **SameValue** | **equal** | **not equal** | `Object.is` |

This is why `[NaN].includes(NaN)` is `true` while `[NaN].indexOf(NaN)` is `-1` —
covered on [page 11](./11-nan.md).

## Objects are never `==` by content

```
false  {} == {}
```

`==` does not deep-compare. Two distinct objects are unequal under every
algorithm, because comparison is by identity
([page 02](./02-references-vs-values.md)). `==` only converts an object when the
*other* side is a primitive.

## The rule

**Use `===` everywhere, with one exception: `== null` to test for
"null or undefined".**

```jsonc
// eslint.config.js
{ "rules": { "eqeqeq": ["error", "smart"] } }
```

`"smart"` permits `== null` and comparisons between two literals of the same
type, and rejects everything else. This is the setting to ship.

## Gotchas

**Symptom:** a bounds check passes for a `null` value.
**Cause:** relational operators coerce `null` to `0`; `null >= 0` is `true`.
**Fix:** validate the type first, or check `value == null` and return early.

**Symptom:** `if (count == '0')` behaves differently from `if (count === '0')`
depending on the API response.
**Cause:** `==` converts the string to a number, so `'0' == 0` is `true` but
`'0' === 0` is `false`. A response that sometimes sends `"0"` and sometimes `0`
gives inconsistent results.
**Fix:** normalise the type at the boundary and use `===`.

**Symptom:** `if (value)` skipped a legitimate `0` or `''`.
**Cause:** truthiness, not equality — see [page 04](./04-truthiness.md).
**Fix:** compare explicitly, or use `??` for defaults.

**Symptom:** two arrays with identical contents are not equal.
**Cause:** identity comparison.
**Fix:** compare `length` and elements, or use a deep-equal helper.

**Symptom:** `switch` did not match a value you expected.
**Cause:** `switch` uses `===`, so `switch('1')` never matches `case 1:`.
**Fix:** convert before the switch.

## Interview questions

**★ What is the difference between `==` and `===`?**
`===` compares type and value with no conversion. `==` converts when the types
differ: `null`/`undefined` equal each other only; a string compared with a number
becomes a number; a boolean becomes a number first; an object is converted with
`ToPrimitive`. Use `===`.

**★ Is `==` ever the right choice?**
One case: `value == null` tests for "null or undefined and nothing else", which
is more readable than the two-way `===` check. ESLint's `eqeqeq: "smart"` allows
exactly this. Every other use is a liability.

**★ Why is `null >= 0` true when `null > 0` and `null == 0` are both false?**
Different algorithms. Relational operators convert with `ToNumber`, and
`Number(null)` is `0`, so `0 >= 0` is true. Equality has a special rule that
`null` equals only `undefined`, so it never performs a numeric comparison. This
is why a `null` value can silently pass a `>= 0` bounds check.

**★ Explain `[] == ![]`.**
`![]` evaluates first: arrays are truthy, so it is `false`. That leaves
`[] == false`. The boolean converts to `0`, giving `[] == 0`. The array converts
with `ToPrimitive` to `''`, then `Number('')` is `0`, so `0 == 0` — **true**. Two
ordinary rules, applied in order.

**How many equality algorithms does JavaScript have?**
Four. Loose (`==`) and strict (`===`) both treat `NaN` as unequal to itself and
`0` as equal to `-0`. SameValueZero (`includes`, `Map`/`Set` keys) treats `NaN`
as equal to itself. SameValue (`Object.is`) also distinguishes `0` from `-0`.

---

← [02 · References vs values](./02-references-vs-values.md) · [Phase index](./) · Next: [04 · Truthiness](./04-truthiness.md) →
