---
title: "07 · Comparison operators"
sidebar_label: "07 · Comparison"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0**. Script: `sandbox/js-p2/ex8-comparison.mjs`.

**`<`, `>`, `<=` and `>=` use a completely different algorithm from `==` and
`===`.** They never special-case `null`, they compare two strings
lexicographically rather than numerically, and they quietly succeed on objects
where you would want an error.

## Measured

```
--- strings compare lexicographically by CODE UNIT ---
  '2' > '10'        = true <- string compare, not numeric
  'Z' < 'a'         = true (code units: Z=90, a=97)
  'é' > 'z'         = true
  localeCompare     = [ 'a', 'b', 'é', 'Z' ]
  plain sort()      = [ 'Z', 'a', 'b', 'é' ]

--- Dates ---
  d1 < d2  = false | d1 > d2 = false | d1 == d2 = false | d1 === d2 = false
  +d1 === +d2 = true | getTime equal = true
  d1 <= d2 && d1 >= d2 = true <- both true, yet == is false

--- objects never compare usefully ---
  {} < {}   = false | {} > {} = false | {} <= {} = true

--- NaN poisons every comparison ---
  NaN < 1 = false | NaN > 1 = false | NaN >= 1 = false

--- mixed types coerce to number ---
  '10' > 9  = true | '10' > '9' = false
  true > 0  = true | null >= 0 = true | undefined >= 0 = false
```

## The rule

Relational comparison converts both operands with `ToPrimitive` using hint
`"number"`, then:

- **If both results are strings** → compare **lexicographically**, code unit by
  code unit.
- **Otherwise** → convert both with `ToNumber` and compare numerically.
- **If either is `NaN`** → the result is `false`. Always.

There is **no** `null`/`undefined` special case here, which is why `null >= 0` is
`true` while `null == 0` is `false`
([Phase 1 · 03](../phase-1-values-and-coercion/03-equality.md)).

## Two strings compare as text, not numbers

```
  '2' > '10'        = true
  '10' > 9          = true
  '10' > '9'        = false
```

`'2' > '10'` is `true` because `'2'` sorts after `'1'` — the comparison stops at
the first differing character and never looks at length.

Note the pair: `'10' > 9` is `true` (one side is a number, so both convert to
numbers) but `'10' > '9'` is `false` (both strings, so text comparison). **The
same values give opposite answers depending on whether one is already a number.**

This is why numeric data arriving as strings — form values, query parameters,
`dataset` attributes — must be converted at the boundary
([Phase 1 · 09](../phase-1-values-and-coercion/09-explicit-conversion.md)).

## Sorting human-readable text needs `Intl`

```
  'Z' < 'a'         = true
  'é' > 'z'         = true
  plain sort()      = [ 'Z', 'a', 'b', 'é' ]
  localeCompare     = [ 'a', 'b', 'é', 'Z' ]
```

Code-unit order puts **every** uppercase letter before every lowercase one, and
dumps accented characters after `z`. A product list sorted with a bare `sort()`
shows `Zebra` before `apple` and `éclair` last.

```js
products.sort((a, b) => a.name.localeCompare(b.name, 'en'));
// or, faster for large lists — build the collator once
const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });
products.sort((a, b) => collator.compare(a.name, b.name));
```

`numeric: true` also fixes `'item2'` vs `'item10'`, which plain comparison gets
backwards.

## Dates compare, but do not equal

```
  d1 < d2  = false | d1 > d2 = false | d1 == d2 = false
  d1 <= d2 && d1 >= d2 = true
```

Two `Date` objects for the same instant are **not** `==` or `===` — they are
distinct objects, compared by identity. But `<` and `>` convert via
`ToPrimitive` with hint `"number"`, reaching `valueOf()` and the timestamp, so
relational comparison works correctly.

Hence the measured oddity: `d1 <= d2 && d1 >= d2` is `true` while `d1 == d2` is
`false`. Both are correct under their own algorithm.

**Always compare timestamps:**

```js
if (+deliveryDate === +expectedDate) …          // or .getTime()
if (orderDate < cutoff) …                        // relational is fine as-is
```

## Objects compare without error, which is the trap

```
  {} < {}   = false | {} > {} = false | {} <= {} = true
```

`{} <= {}` is **`true`** — and that is not a bug. Both objects `ToPrimitive` to
the string `'[object Object]'`, and `'[object Object]' <= '[object Object]'` is
true because the strings are equal.

So comparing objects is silently meaningless rather than an error. If a
comparison is ever reached with objects on both sides, you have a bug that will
not announce itself. Compare a field.

## `NaN` makes every comparison false

```
  NaN < 1 = false | NaN > 1 = false | NaN >= 1 = false
```

All three are `false`, including `>=`. This means `!(a < b)` is **not**
equivalent to `a >= b` when `NaN` is possible — a real source of inverted
conditions in sorting and filtering.

Guard with `Number.isFinite` before comparing anything derived from user input
([Phase 1 · 11](../phase-1-values-and-coercion/11-nan.md)).

## Gotchas

**Symptom:** numbers sort as `1, 10, 2`.
**Cause:** they are strings, compared lexicographically — or `sort()` with no
comparator, which stringifies.
**Fix:** convert to numbers, or `sort((a, b) => a - b)`.

**Symptom:** `'10' > 9` and `'10' > '9'` disagree.
**Cause:** one comparison is numeric, the other textual, depending on whether
either side is already a number.
**Fix:** convert at the boundary so comparisons are always same-type.

**Symptom:** a name list sorts `Z` before `a`.
**Cause:** code-unit comparison.
**Fix:** `localeCompare` or `Intl.Collator`.

**Symptom:** two dates for the same instant are not equal.
**Cause:** they are distinct objects; `==`/`===` compare identity.
**Fix:** compare `+date` or `.getTime()`. Relational `<`/`>` already work.

**Symptom:** a comparison between objects always takes the same branch.
**Cause:** both stringify to `'[object Object]'` — measured, `{} <= {}` is
`true`.
**Fix:** compare a specific field.

**Symptom:** an inverted condition behaves differently from the original.
**Cause:** `NaN` makes both `<` and `>=` false, so negation is not equivalent.
**Fix:** validate with `Number.isFinite` first.

**Symptom:** a `null` passed a `>= 0` bounds check.
**Cause:** relational comparison converts `null` to `0`; there is no special
case.
**Fix:** check the type explicitly.

## Interview questions

**★ Why is `'2' > '10'` true?**
Both operands are strings, so the comparison is lexicographic by code unit —
`'2'` sorts after `'1'` and the comparison stops there. If either side were a
number both would convert numerically: measured, `'10' > 9` is `true` while
`'10' > '9'` is `false`.

**★ Why can two Dates satisfy `d1 <= d2 && d1 >= d2` while `d1 == d2` is false?**
Different algorithms. Relational operators call `ToPrimitive` with hint
`"number"`, reaching `valueOf()` and comparing timestamps — so both are true.
Equality compares object identity, and they are two distinct objects. Compare
`+d1 === +d2`.

**★ What does `{} <= {}` return?**
`true`. Both objects convert to the string `'[object Object]'`, which is `<=`
itself. Object comparison is silently meaningless rather than an error, which
makes it a bug that never announces itself.

**How do you sort user-visible names correctly?**
`localeCompare` or `Intl.Collator`, not the default comparison. Code-unit order
puts all uppercase before lowercase and accented characters after `z` — measured,
plain `sort()` gave `['Z','a','b','é']` where the collator gave
`['a','b','é','Z']`.

**Why is `!(a < b)` not the same as `a >= b`?**
Because `NaN` makes every relational comparison `false`, including `>=`. With
`a` as `NaN`, `!(a < b)` is `true` while `a >= b` is `false`. Validate with
`Number.isFinite` before comparing.

---

← [06 · Spread and rest](./06-spread-and-rest.md) · [Phase index](./) · Next: [08 · Conditionals](./08-conditionals.md) →
