---
title: "06 · Numbers are doubles"
sidebar_label: "06 · Numbers are doubles"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0**. Script: `sandbox/js-p1/ex4-numbers.mjs`.

**There is one number type and it is a 64-bit float.** No integers, no decimals.
Every price, quantity, ID and index you have ever written is an IEEE-754 double.
This page is the reason a cart total must never be stored as `19.99`.

## Measured

```
0.1 + 0.2          = 0.30000000000000004
0.1 + 0.2 === 0.3  = false
toFixed(20)        = 0.30000000000000004441
EPSILON compare    = true
MAX_SAFE_INTEGER   = 9007199254740991
MSI + 1 === MSI + 2= true
9007199254740993   = 9007199254740992
big id from JSON   = 9007199254740992
BigInt keeps it    = 9007199254740993n
```

## Why `0.1 + 0.2` is not `0.3`

Doubles store values in binary. `0.1` in binary is a repeating fraction, exactly
as `1/3` is in decimal — it cannot be represented exactly in a finite number of
bits. The stored value is very slightly off, and adding two slightly-off values
produces a visibly-off result.

`toFixed(20)` shows what is actually there: `0.30000000000000004441`. The
`0.30000000000000004` you normally see is just the shortest string that
round-trips to the same double.

**This is not a JavaScript flaw.** Python, Java, C and Go all do this. JavaScript
is simply more visible about it because it has no other numeric type to fall back
on.

### Comparing floats

```js
Math.abs((0.1 + 0.2) - 0.3) < Number.EPSILON;   // true
```

`Number.EPSILON` is the smallest difference between 1 and the next representable
double. Comparing within a tolerance works for values near 1; for very large or
very small magnitudes you need a **relative** tolerance. In practice, if you find
yourself comparing floats for equality, ask whether the value should have been an
integer instead.

## Money: the rule and the reason

```
--- money the wrong way ---
0.1 x10 summed     = 0.9999999999999999 | === 1? false
19.99 * 3          = 59.97
toFixed(2)         = 59.97

--- money the right way (minor units) ---
1999 * 3           = 5997 -> formatted ₹59.97
```

Adding `0.1` ten times does not reach `1`. The error is tiny per operation and
**accumulates** — over a cart, a tax calculation and a discount it becomes a
number a customer can see, and a reconciliation your finance team cannot close.

> **Store money as an integer number of minor units** — paise, cents. Do the
> arithmetic in integers. Divide by 100 **only** when formatting for display.

```js
// The cart, end to end
const lines = [
  { sku: 'TSHIRT-M', qty: 2, priceMinor: 49900 },   // ₹499.00
  { sku: 'MUG-01',   qty: 1, priceMinor: 24900 },   // ₹249.00
];

const subtotalMinor = lines.reduce((sum, l) => sum + l.qty * l.priceMinor, 0);
const discountMinor = Math.round(subtotalMinor * 0.10);   // round ONCE, explicitly
const totalMinor    = subtotalMinor - discountMinor;

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });
inr.format(totalMinor / 100);
```

Three things this gets right. Every intermediate value is an integer.
`Math.round` appears exactly once, at the point where a fractional value is
genuinely created, so rounding is a decision rather than an accident. And the
division by 100 happens only at the display boundary.

This is the basis of Phase 18's cart page, and it is the same convention
Stripe, PayPal and every payment API use — their amounts are integers in minor
units, for exactly this reason.

## `toFixed` is not a rounding function

```
  (1.005).toFixed(2) = 1.00
  (1.015).toFixed(2) = 1.01
  (1.025).toFixed(2) = 1.02
  (2.675).toFixed(2) = 2.67
  (8.345).toFixed(2) = 8.35
```

**`1.005` rounds down and `8.345` rounds up.** This is not a `toFixed` bug — it
is the float again. `1.005` is stored as slightly *less* than 1.005, so rounding
to two places correctly gives `1.00`. `8.345` is stored as slightly more.

Two conclusions:

1. **Never use `toFixed` to round money.** Its behaviour depends on invisible
   representation error.
2. **`toFixed` returns a string**, so `(19.99).toFixed(2) * 2` coerces back to a
   number and reintroduces the problem.

For display, use `Intl.NumberFormat` — it is locale-aware, gives you the currency
symbol and separators, and does not pretend to be arithmetic.

## Integers are safe only up to 2⁵³ − 1

```
MAX_SAFE_INTEGER   = 9007199254740991
MSI + 1 === MSI + 2= true
9007199254740993   = 9007199254740992
```

A double has 53 bits of significand, so integers above 9 007 199 254 740 991
cannot all be represented. Beyond it, distinct integers collapse onto the same
double — `MAX_SAFE_INTEGER + 1` and `+ 2` are literally the same value.

The literal `9007199254740993` in source silently becomes `...992`. Nothing
warns you.

### The one that bites in real applications

```
big id from JSON   = 9007199254740992
BigInt keeps it    = 9007199254740993n
```

**`JSON.parse` corrupts large integer IDs**, because it parses numbers into
doubles. A Postgres `bigint` primary key, a Twitter/X snowflake ID, or an order
number past 2⁵³ arrives *wrong* — and it round-trips as a plausible-looking
number, so nothing throws.

Two fixes:

```js
// 1. Best: have the API send the ID as a string
JSON.parse('{"id":"9007199254740993"}').id;   // '9007199254740993'

// 2. If you cannot change the API: read the original source text in the reviver
JSON.parse('{"id":9007199254740993}', (key, value, ctx) =>
  key === 'id' ? BigInt(ctx.source) : value
).id;                                          // 9007199254740993n
```

The reviver's third argument carries `source`, the *unparsed* text — the only way
to recover digits the double has already lost. Prefer option 1: IDs are
identifiers, not quantities, and nothing good comes of doing arithmetic on them.

Use `Number.isSafeInteger(n)` to check before trusting a large value.

## Other things worth knowing

```
1/0 = Infinity | -1/0 = -Infinity | 0/0 = NaN
```

Division by zero does not throw — it gives `Infinity`. `0/0` gives `NaN`. Both
propagate silently through arithmetic, which is why a single bad input can turn
an entire total into `NaN` with no error anywhere.

`Math.round` rounds **half up toward positive infinity**, so `Math.round(-0.5)`
is `-0`, not `-1`. For symmetric rounding use `Math.trunc` or `Math.sign` with
`Math.round(Math.abs(x))`.

## Gotchas

**Symptom:** a total displays as `59.970000000000006`.
**Cause:** float arithmetic on decimal prices.
**Fix:** integer minor units throughout; format only at the edge.

**Symptom:** two amounts that should be equal fail `===`.
**Cause:** accumulated representation error.
**Fix:** compare integers. If you must compare floats, use a tolerance.

**Symptom:** `(1.005).toFixed(2)` gives `"1.00"`.
**Cause:** `1.005` is stored as slightly less than 1.005.
**Fix:** do not round money with `toFixed`. Round integer minor units with
`Math.round`, once, and format with `Intl.NumberFormat`.

**Symptom:** an ID from an API is off by one, or two records collide.
**Cause:** the ID exceeded `MAX_SAFE_INTEGER` and `JSON.parse` rounded it.
**Fix:** transmit IDs as strings. If you cannot, use a reviver with `ctx.source`
and `BigInt`. Check with `Number.isSafeInteger`.

**Symptom:** a total became `NaN` with no error thrown.
**Cause:** `undefined` or a non-numeric string entered the arithmetic, or `0/0`.
**Fix:** validate at the boundary; `NaN` propagates silently through every
subsequent operation ([page 11](./11-nan.md)).

**Symptom:** `(price).toFixed(2) * qty` gives a wrong result.
**Cause:** `toFixed` returns a **string**, which `*` coerces back to a number.
**Fix:** keep arithmetic numeric; format last.

## Interview questions

**★ Why is `0.1 + 0.2 !== 0.3`?**
Numbers are IEEE-754 doubles. `0.1` and `0.2` are repeating fractions in binary
and cannot be stored exactly, so the sum is `0.30000000000000004` —
`toFixed(20)` shows `0.30000000000000004441`. Every language with binary floats
does this; JavaScript is just more visible because it has no other numeric type.

**★ How do you handle money in JavaScript?**
Store integer minor units — paise or cents — and do all arithmetic in integers.
Round exactly once, explicitly, where a fraction is genuinely created. Divide by
100 only when formatting, with `Intl.NumberFormat`. Never use `toFixed` as a
rounding step: measured, `(1.005).toFixed(2)` is `"1.00"` and it returns a
string.

**★ What is `Number.MAX_SAFE_INTEGER` and why does it matter?**
2⁵³ − 1 = 9 007 199 254 740 991 — the largest integer where every integer below
is exactly representable. Beyond it, distinct integers collapse: `MSI + 1 === MSI + 2`
is `true`. It matters because `JSON.parse` turns a large `bigint` ID into a
double and silently corrupts it. Send IDs as strings.

**How do you compare two floats?**
Within a tolerance — `Math.abs(a - b) < Number.EPSILON` for values near 1, and a
relative tolerance for other magnitudes. Better: restructure so the values are
integers and the question does not arise.

**What happens on division by zero?**
No exception. `1/0` is `Infinity`, `-1/0` is `-Infinity`, `0/0` is `NaN`. All
three propagate silently through later arithmetic, so a single bad input can
produce `NaN` far from where it entered.

---

← [05 · null vs undefined](./05-null-vs-undefined.md) · [Phase index](./) · Next: [07 · `const` does not mean immutable](./07-const-is-not-immutable.md) →
