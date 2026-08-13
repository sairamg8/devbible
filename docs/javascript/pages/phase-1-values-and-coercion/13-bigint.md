---
title: "13 · `BigInt`"
sidebar_label: "13 · BigInt"
sidebar_position: 13
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0**. Scripts: `sandbox/js-p1/ex7-strings-symbols-bigint.mjs`,
> `ex4-numbers.mjs`.

**Arbitrary-precision integers, for when 2⁵³ is not enough.** `BigInt` exists
because `Number` cannot represent every integer past
`Number.MAX_SAFE_INTEGER` ([page 06](./06-numbers-are-doubles.md)). It is a
separate type with deliberately strict rules, and it will not silently mix with
`Number`.

## Measured

```
10n + 20n        : 30n
1n + 1 throws     : TypeError: Cannot mix BigInt and other types, use explicit conversions
1n == 1          : true | 1n === 1: false
5n / 2n (truncates): 2n
JSON.stringify    : TypeError: Do not know how to serialize a BigInt
```

## Creating one

```js
10n                        // literal — note the n suffix
BigInt(10)                 // from a number (must be a safe integer)
BigInt('9007199254740993') // from a string — the safe route for large values
BigInt(1.5)                // RangeError: The number 1.5 cannot be converted to a BigInt
```

Converting from a **number literal** larger than `MAX_SAFE_INTEGER` is already
too late — the literal was rounded before `BigInt` ever saw it. Convert from a
**string**.

## It will not mix with `Number`

```
1n + 1 throws     : TypeError: Cannot mix BigInt and other types, use explicit conversions
```

```js
1n + 1;            // TypeError
1n + BigInt(1);    // 2n     ✅
Number(1n) + 1;    // 2      ✅ (may lose precision — that is the point of asking)
```

This strictness is a feature. Silent mixing would mean silently losing precision
in exactly the situation you reached for `BigInt` to avoid. The `TypeError`
forces you to say which side you are willing to lose.

**Comparison operators are exempt**, because they cannot lose data:

```
1n == 1          : true | 1n === 1: false
```

```js
1n == 1;    // true  — loose equality compares mathematical value
1n === 1;   // false — different types
1n < 2;     // true  — relational comparison is allowed
```

This is the one place `==` does something `===` cannot, and it is still not a
reason to use `==` generally.

## Division truncates

```
5n / 2n (truncates): 2n
```

There are no fractions. `5n / 2n` is `2n`, not `2.5`. `BigInt` is an **integer**
type — if you need a fractional result you are in `Number` territory, or you
should be scaling by a factor (which is exactly the minor-units technique from
page 06).

## `JSON.stringify` throws

```
JSON.stringify    : TypeError: Do not know how to serialize a BigInt
```

JSON has no BigInt type, and the spec chose to throw rather than silently lose
precision. Two ways out:

```js
// 1. toJSON on the value's container
JSON.stringify({ id: 123n }, (key, value) =>
  typeof value === 'bigint' ? value.toString() : value
);   // '{"id":"123"}'

// 2. A global patch — works, but mutates a built-in; prefer the replacer
BigInt.prototype.toJSON = function () { return this.toString(); };
```

Use the **replacer**. Patching `BigInt.prototype` affects every library on the
page ([Phase 0 · 09](../phase-0-how-javascript-runs/transpilation-polyfills) on
ponyfills over polyfills).

## When you actually need it

Honestly: **rarely, and almost always for IDs you never do arithmetic on.**

| Case | Better answer |
|---|---|
| Postgres `bigint` primary key | Send it as a **string** from the API |
| Snowflake / order IDs | String |
| Money | Integer minor units in a `Number` — safe up to ~90 trillion paise |
| Cryptography, hashing, big factorials | **`BigInt` genuinely** |
| Nanosecond timestamps (`process.hrtime.bigint()`) | `BigInt` |

The rule: an **identifier** is not a number. It is never added, averaged or
sorted numerically, so a string is the correct type and it sidesteps this entire
page.

Where you cannot change the API, recover the value from the raw source text:

```js
// ES2025 reviver third argument carries the unparsed text
const { id } = JSON.parse('{"id":9007199254740993}', (key, value, ctx) =>
  key === 'id' ? BigInt(ctx.source) : value
);
// 9007199254740993n — the plain parse gives ...992
```

## Gotchas

**Symptom:** `TypeError: Cannot mix BigInt and other types`.
**Cause:** arithmetic between a `BigInt` and a `Number`.
**Fix:** convert one side explicitly — `BigInt(n)` or `Number(b)` — and be
deliberate about which precision you are giving up.

**Symptom:** `JSON.stringify` throws on an object holding a `BigInt`.
**Cause:** JSON has no BigInt type.
**Fix:** a replacer that converts `bigint` to a string.

**Symptom:** `BigInt(someHugeLiteral)` still gave the wrong value.
**Cause:** the numeric literal was rounded to a double **before** conversion.
**Fix:** `BigInt('...')` from a string.

**Symptom:** `5n / 2n` gave `2n`.
**Cause:** BigInt division truncates; there are no fractions.
**Fix:** scale up before dividing, or use `Number` if fractions are meaningful.

**Symptom:** `1n === 1` is `false` and broke a comparison.
**Cause:** different types under strict equality.
**Fix:** compare after converting, or use `==` deliberately here — it is one of
the few defensible uses.

**Symptom:** `Math.max(1n, 2n)` throws.
**Cause:** the `Math` methods only accept `Number`.
**Fix:** compare with `<`/`>` directly, or convert.

## Interview questions

**★ Why does `BigInt` exist?**
Because `Number` is a 64-bit double and can only represent integers exactly up to
2⁵³ − 1. Beyond that, distinct integers collapse onto the same value. `BigInt`
provides arbitrary-precision integers for cases where that matters — large IDs,
cryptography, nanosecond timestamps.

**★ Why can't you add a `BigInt` and a `Number`?**
Because the result would silently lose precision in exactly the situation
`BigInt` exists to prevent. `1n + 1` throws `TypeError: Cannot mix BigInt and
other types, use explicit conversions`. Comparison operators are allowed —
`1n == 1` is `true` — because comparing cannot lose data.

**★ Should you use `BigInt` for large database IDs?**
Usually not. Send IDs as **strings** from the API. An identifier is never added
or averaged, so it does not need to be numeric, and a string avoids `BigInt`'s
serialisation problem entirely. Reach for `BigInt` when you genuinely do
arithmetic on large integers.

**What happens when you `JSON.stringify` a `BigInt`?**
It throws `TypeError: Do not know how to serialize a BigInt`. JSON has no BigInt
type, and throwing was chosen over silent precision loss. Use a replacer that
converts it to a string.

**What is `1n === 1`?**
`false` — strict equality compares types, and `bigint` is not `number`.
`1n == 1` is `true`, because loose equality compares mathematical value across
those two types.

---

← [12 · Symbol](./12-symbol.md) · [Phase index](./) · Next: [14 · Value equality in practice](./14-value-equality.md) →
