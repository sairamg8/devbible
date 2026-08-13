---
title: "09 · Explicit conversion"
sidebar_label: "09 · Explicit conversion"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0**. Script: `sandbox/js-p1/ex6-coercion.mjs`.

**Convert deliberately at the boundary, and the rest of your code never has to
think about coercion.** This page is the table you check when choosing between
`Number`, `parseInt` and `parseFloat` — they disagree more than people expect.

## Measured

```
  "42"     Number=42     parseInt=42     parseFloat=42     Boolean=true
  "42px"   Number=NaN    parseInt=42     parseFloat=42     Boolean=true
  ""       Number=0      parseInt=NaN    parseFloat=NaN    Boolean=false
  "  7 "   Number=7      parseInt=7      parseFloat=7      Boolean=true
  "abc"    Number=NaN    parseInt=NaN    parseFloat=NaN    Boolean=true
  null     Number=0      parseInt=NaN    parseFloat=NaN    Boolean=false
  undefined Number=NaN    parseInt=NaN    parseFloat=NaN    Boolean=false
  []       Number=0      parseInt=NaN    parseFloat=NaN    Boolean=true
  ["9"]    Number=9      parseInt=9      parseFloat=9      Boolean=true
  true     Number=1      parseInt=NaN    parseFloat=NaN    Boolean=true
```

Three rows decide which function to use:

| Input | `Number` | `parseInt` | Why they differ |
|---|---|---|---|
| `'42px'` | `NaN` | `42` | `Number` demands the **whole** string; `parseInt` reads a prefix and stops |
| `''` | `0` | `NaN` | `Number('')` is `0` by spec; `parseInt` finds no digits |
| `null` | `0` | `NaN` | `parseInt` stringifies first — `'null'` has no leading digit |

## Which to use

**`Number(x)` — the default for validation.** It is strict: any trailing garbage
gives `NaN`, which is what you want when the input is supposed to be a number.

```js
const qty = Number(input.value);
if (!Number.isFinite(qty)) throw new Error('quantity must be a number');
```

`Number.isFinite` rejects `NaN`, `Infinity` and `-Infinity` in one check — better
than `!Number.isNaN(qty)`, which lets `Infinity` through.

Guard the empty string separately, because `Number('') === 0` will silently
accept a blank field as zero:

```js
const raw = input.value.trim();
if (raw === '') throw new Error('quantity is required');
```

**`parseInt(x, 10)` — only when a trailing suffix is expected.** Parsing
`'16px'` from a computed style is its legitimate use.

**`parseFloat(x)` — same, for decimals.** No radix argument.

**`Boolean(x)` / `!!x`** — see [page 04](./04-truthiness.md). Do not use it to
normalise API data; `!!undefined` turns "missing" into "false".

**`String(x)`** — safe for everything including `null`, `undefined` and symbols.
`x.toString()` throws on `null`/`undefined`, and `'' + x` throws on a symbol
([page 12](./12-symbol.md)).

## The radix trap

```
  parseInt("08")   = 8  parseInt("0x1F") = 31  parseInt("1F",16) = 31
  ["1","2","3"].map(parseInt) = [ 1, NaN, NaN ]
  ["1","2","3"].map(Number)   = [ 1, 2, 3 ]
```

`parseInt` accepts a second argument, the radix. Two consequences:

**1. `'0x1F'` is read as hexadecimal** even without a radix — `31`. Leading-zero
strings like `'08'` are decimal in modern engines (the old octal behaviour is
gone), but **always pass the radix anyway**: `parseInt(value, 10)`. ESLint's
`radix` rule enforces it.

**2. `map(parseInt)` is broken.** `map` passes `(value, index, array)`, so the
index becomes the radix:

```js
parseInt('1', 0)   // 1   — radix 0 means "auto"
parseInt('2', 1)   // NaN — radix 1 is invalid
parseInt('3', 2)   // NaN — '3' is not a binary digit
```

Use `map(Number)`, which takes one meaningful argument. This is the canonical
example of why passing a built-in directly to `map` is risky.

## Converting at the boundary

Everything from the outside world is a string:

```js
// URL query parameters
const params = new URLSearchParams(location.search);
const page  = Number(params.get('page') ?? 1);
const min   = Number(params.get('minPrice') ?? 0);

// localStorage
const raw = localStorage.getItem('cart');
const cart = raw ? JSON.parse(raw) : { items: [] };

// A form
const form = new FormData(event.target);
const qty = Number(form.get('qty'));
```

Note `params.get()` returns `null` when the key is absent, and
`Number(null)` is `0` — so `?? 1` must come **before** the `Number()` call, not
after. Getting that order wrong turns a missing page number into page 0.

For anything non-trivial, a schema validator (Zod, Valibot) does conversion and
validation together and gives you one place to look when the shape changes.

## Numbers to strings

```js
const n = 1234.5678;
String(n);                  // '1234.5678'
n.toFixed(2);               // '1234.57'  — string, and see page 06 on rounding
n.toString(2);              // '10011010010.1001…' — binary
(255).toString(16);         // 'ff'
n.toLocaleString('en-IN');  // '1,234.568'
new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n);
```

For anything user-visible use `Intl.NumberFormat` — it handles grouping,
decimals and currency per locale. `toFixed` is for a fixed decimal string, not
for money ([page 06](./06-numbers-are-doubles.md)).

## Gotchas

**Symptom:** an empty input was accepted as `0`.
**Cause:** `Number('')` is `0`.
**Fix:** check for an empty string before converting.

**Symptom:** `['1','2','3'].map(parseInt)` gives `[1, NaN, NaN]`.
**Cause:** `map` passes the index as the radix.
**Fix:** `map(Number)`, or `map(s => parseInt(s, 10))`.

**Symptom:** `Number('42px')` is `NaN` where `parseInt` gave `42`.
**Cause:** `Number` requires the entire string to be numeric.
**Fix:** that strictness is usually what you want — use `parseInt` only when a
suffix is expected.

**Symptom:** `TypeError: Cannot read properties of null (reading 'toString')`.
**Cause:** `null.toString()`.
**Fix:** `String(value)`, which handles `null` and `undefined`.

**Symptom:** a missing query parameter became `0`.
**Cause:** `params.get()` returns `null`, and `Number(null)` is `0`.
**Fix:** apply `?? default` before converting.

**Symptom:** `Number.isNaN` passed but the value was `Infinity`.
**Cause:** `Infinity` is not `NaN`.
**Fix:** `Number.isFinite`, which rejects both.

## Interview questions

**★ What is the difference between `Number` and `parseInt`?**
`Number` converts the whole string or returns `NaN` — `Number('42px')` is `NaN`.
`parseInt` reads a leading integer prefix and ignores the rest —
`parseInt('42px')` is `42`. They also disagree on the empty string:
`Number('')` is `0`, `parseInt('')` is `NaN`. Use `Number` for validation;
`parseInt` only when a suffix is expected.

**★ Why does `['1','2','3'].map(parseInt)` return `[1, NaN, NaN]`?**
`map` calls the callback with `(value, index, array)`, and `parseInt`'s second
parameter is the radix. So it evaluates `parseInt('1',0)` = 1,
`parseInt('2',1)` = NaN (radix 1 is invalid) and `parseInt('3',2)` = NaN ('3' is
not binary). Use `map(Number)`.

**★ Why should you always pass a radix to `parseInt`?**
Because the radix is inferred otherwise, and `'0x'`-prefixed strings are read as
hexadecimal — `parseInt('0x1F')` is `31`. Passing `10` makes the intent explicit
and immune to input you did not anticipate. ESLint's `radix` rule enforces it.

**How do you safely convert a value that might be `null` to a string?**
`String(value)` — it handles `null`, `undefined` and symbols. `value.toString()`
throws on `null`/`undefined`, and `'' + value` throws on a symbol.

**Where should conversion happen?**
Once, at the boundary. Form values, query parameters, `localStorage`, `dataset`
and environment variables are always strings; parse and validate them on the way
in so the rest of the code works with real types.

---

← [08 · Type coercion](./08-type-coercion.md) · [Phase index](./) · Next: [10 · Strings are UTF-16](./10-strings-are-utf16.md) →
