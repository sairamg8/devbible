---
title: "05 · `null` vs `undefined`"
sidebar_label: "05 · null vs undefined"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0**. Script: `sandbox/js-p1/ex8-null-nan-equality.mjs`.

**Two ways to say "no value", and the language treats them differently in ways
that matter.** The short version: `undefined` is *absence the engine produced*;
`null` is *absence you chose*.

| | `undefined` | `null` |
|---|---|---|
| Means | Nothing was assigned | Deliberately empty |
| Produced by | The engine | Only by you (and some APIs) |
| `typeof` | `'undefined'` | `'object'` (the historic bug) |
| Triggers a default parameter | **Yes** | **No** |
| `JSON.stringify` | **Dropped** | Kept as `null` |
| Common source | Missing property, no return, unpassed argument | An API column that is genuinely empty |

## Where each one comes from

`undefined` appears without you writing it:

```js
let x;                          // declared, unassigned
({}).missing;                   // absent property
((a) => a)();                   // parameter not passed
(() => {})();                   // function with no return
[1, 2].find(n => n > 5);        // no match
```

`null` almost always came from *somewhere specific* — a database `NULL`, a JSON
payload, `document.querySelector` with no match, or your own code saying "this is
empty on purpose".

## The distinction that has teeth: default parameters

```
  f(undefined) = 1 | f(null) = null | f(0) = 0 | f() = 1
  destructuring default with null: null
  destructuring default with undefined: dflt
```

```js
const f = (qty = 1) => qty;
f();            // 1     — nothing passed
f(undefined);   // 1     — default fires
f(null);        // null  — default does NOT fire
f(0);           // 0     — default does not fire
```

**Defaults fire only on `undefined`.** This is true for function parameters and
for destructuring defaults alike. It is a frequent source of "why is my default
not applying?" when an API sends `null` for an absent field:

```js
// API sends { "coupon": null }
function priceWith({ coupon = 'NONE' }) { return coupon; }
priceWith({ coupon: null });   // null, not 'NONE'
```

The fix is to normalise at the boundary — convert the API's `null`s to
`undefined`, or handle `null` explicitly with `??`.

## `??` vs `||`

```
  value 0          ||-> FALLBACK   ??-> 0
  value ''         ||-> FALLBACK   ??-> 
  value false      ||-> FALLBACK   ??-> false
  value null       ||-> FALLBACK   ??-> FALLBACK
  value undefined  ||-> FALLBACK   ??-> FALLBACK
  value NaN        ||-> FALLBACK   ??-> NaN
```

`||` falls back on any **falsy** value. `??` falls back only on **`null` and
`undefined`**.

```js
const qty      = input.qty ?? 1;          // a legitimate 0 survives
const note     = input.note ?? '';        // a deliberate '' survives
const featured = input.featured ?? true;  // an explicit false survives
```

**Default to `??`.** Reach for `||` only when you genuinely want every falsy
value to fall back — which is rare, and worth a comment when it happens.

One row deserves attention: `??` does **not** fall back on `NaN`. `NaN` is a
number, so `NaN ?? 1` is `NaN`. If a parsed value could be `NaN`, guard it with
`Number.isNaN` rather than relying on the default ([page 11](./11-nan.md)).

> **Syntax note:** `a ?? b || c` is a `SyntaxError`. Mixing `??` with `||` or
> `&&` requires explicit parentheses, deliberately — the precedence would
> otherwise be ambiguous to readers. Write `(a ?? b) || c`.

## The `== null` idiom

```
true   null == undefined
false  null === undefined
false  null == 0
false  undefined == false
```

`null` and `undefined` are loosely equal to each other and to **nothing else**.
That makes one `==` genuinely useful:

```js
if (value == null) { /* null or undefined, and nothing else */ }
```

This is the exception to "always use `===`" from [page 03](./03-equality.md), and
ESLint's `eqeqeq: "smart"` permits exactly it.

## Which should you write?

**Prefer `undefined` for absence in your own code; accept `null` at the
boundary.**

- Do not assign `undefined` explicitly — just omit the property. That is what
  `undefined` means.
- Use `null` when you must **explicitly signal emptiness** in a payload,
  because `JSON.stringify` drops `undefined` and keeps `null`:

```js
JSON.stringify({ coupon: undefined });   // '{}'          — field vanishes
JSON.stringify({ coupon: null });        // '{"coupon":null}' — field says "cleared"
```

That difference is load-bearing in a `PATCH` request. `undefined` means "do not
touch this field"; `null` means "set this field to empty". Choosing the wrong
one either fails to clear a coupon or silently wipes one.

- Normalise inbound data once, at the edge, so the rest of your code deals with
  one convention rather than both.

## Gotchas

**Symptom:** a default parameter does not apply for a value from an API.
**Cause:** the API sent `null`; defaults fire only on `undefined`.
**Fix:** `value ?? fallback`, or normalise `null` to `undefined` at the boundary.

**Symptom:** a `0` quantity or `false` flag is replaced by a default.
**Cause:** `||` falls back on all falsy values.
**Fix:** `??`.

**Symptom:** a field disappears from a request body.
**Cause:** it was `undefined`, and `JSON.stringify` omits those.
**Fix:** use `null` when the field must be transmitted as "cleared".

**Symptom:** `Cannot read properties of null` from `document.querySelector`.
**Cause:** the DOM query found nothing and returned `null` — not `undefined`.
**Fix:** check before use, or `?.`. Note `?.` short-circuits on both, so it
covers this case.

**Symptom:** `SyntaxError` when mixing `??` with `||`.
**Cause:** the grammar forbids it without parentheses.
**Fix:** parenthesise explicitly.

**Symptom:** `typeof value === 'object'` passed for `null`.
**Cause:** the `typeof null` bug ([page 01](./01-the-eight-types.md)).
**Fix:** `value !== null &&` in the guard.

## Interview questions

**★ What is the difference between `null` and `undefined`?**
`undefined` is absence produced by the engine — an unassigned variable, a missing
property, an unpassed argument, a function with no return. `null` is absence you
assigned deliberately. They behave differently in three places that matter:
default parameters fire only on `undefined`, `JSON.stringify` drops `undefined`
but keeps `null`, and `typeof null` is `'object'`.

**★ When does a default parameter fire?**
Only on `undefined` — measured: `f(undefined)` returned the default while
`f(null)` returned `null` and `f(0)` returned `0`. The same rule applies to
destructuring defaults, which is why `null` from an API bypasses them.

**★ What is the difference between `??` and `||`?**
`||` falls back on any falsy value — `0`, `''`, `false`, `NaN` included. `??`
falls back only on `null` and `undefined`. Use `??` unless you specifically want
every falsy value to fall back.

**Why is `value == null` acceptable when `==` is otherwise discouraged?**
Because `null` and `undefined` are loosely equal to each other and to nothing
else, so the check is exact and more readable than the two-way `===` version.
ESLint's `eqeqeq: "smart"` permits it for this reason.

**Which should you use in your own APIs?**
`undefined` (by omission) for "not provided"; `null` for "explicitly cleared".
The distinction matters most in a `PATCH` body, where `undefined` should mean
"leave alone" and `null` should mean "set to empty" — and `JSON.stringify`'s
behaviour makes exactly that encoding work.

---

← [04 · Truthiness](./04-truthiness.md) · [Phase index](./) · Next: [06 · Numbers are doubles](./06-numbers-are-doubles.md) →
