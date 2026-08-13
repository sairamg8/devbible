---
title: "01 · The eight types"
sidebar_label: "01 · The eight types"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0**. Script: `sandbox/js-p1/ex1-types.mjs`.

**Seven primitives and one object type. That is the entire type system.**
Everything else — arrays, dates, regexes, `Map`, your classes — is an object.

| Type | Primitive? | `typeof` | Example |
|---|---|---|---|
| **string** | ✅ | `'string'` | `'sku-1'` |
| **number** | ✅ | `'number'` | `42`, `1.5`, `NaN`, `Infinity` |
| **boolean** | ✅ | `'boolean'` | `true` |
| **undefined** | ✅ | `'undefined'` | `undefined` |
| **null** | ✅ | **`'object'`** ← the bug | `null` |
| **symbol** | ✅ | `'symbol'` | `Symbol('id')` |
| **bigint** | ✅ | `'bigint'` | `10n` |
| **object** | ❌ | `'object'` / `'function'` | `{}`, `[]`, `new Date()`, `() => {}` |

## Measured

```js
// sandbox/js-p1/ex1-types.mjs
const values = [42, 'text', true, undefined, null, Symbol('s'), 10n,
                {}, [], function(){}, new Date(), /re/];
for (const v of values) { /* prints typeof for each */ }
```

```
typeof 42                     -> number
typeof text                   -> string
typeof true                   -> boolean
typeof undefined              -> undefined
typeof null                   -> object
typeof Symbol(s)              -> symbol
typeof 10                     -> bigint
typeof [object Object]        -> object
typeof                        -> object
typeof function(){}           -> function
typeof Thu Aug 13 2026 …      -> object
typeof /re/                   -> object
```

Two rows do not behave the way the table above would suggest.

## `typeof null === 'object'` is a bug, and it is permanent

In the first implementation, values were tagged with a type in their low bits,
and objects used tag `000`. `null` was the null pointer — all zero bits — so it
read as an object. It was proposed as a fix and rejected, because too much code
already depends on it.

**There is no way to detect `null` with `typeof`.** Use a direct comparison:

```js
const isNull      = (v) => v === null;
const isObjectish = (v) => typeof v === 'object' && v !== null;   // the guard you write constantly
```

That `&& v !== null` is not defensive noise — without it, every "is this an
object" check treats `null` as an object and then throws on the first property
access.

## `typeof function` is `'function'`, and functions are still objects

`function` is not a ninth type. Functions are objects that happen to be
callable, and `typeof` reports them specially because "can I call this?" is asked
constantly:

```js
if (typeof options.onSettled === 'function') options.onSettled();
```

They are objects in every other respect — they hold properties, have a
prototype, and are compared by reference.

## `typeof` cannot tell objects apart

Array, Date, RegExp and a plain object all report `'object'`. To distinguish
them:

```
   [object Null]
   [object Array]
   [object Date]
   [object RegExp]
   [object Object]
```

```js
const tag = (v) => Object.prototype.toString.call(v).slice(8, -1);
tag(null);       // 'Null'   ← unlike typeof, this one is correct
tag([]);         // 'Array'
tag(new Date()); // 'Date'
```

In practice you rarely need the tag. Use the purpose-built checks:

| Question | Use |
|---|---|
| Is it an array? | `Array.isArray(v)` — **always**, works across realms |
| Is it null? | `v === null` |
| Is it a plain object? | `typeof v === 'object' && v !== null && !Array.isArray(v)` |
| Is it callable? | `typeof v === 'function'` |
| Is it a Date? | `v instanceof Date` (same realm) or the tag |

`Array.isArray` exists because `instanceof Array` fails across realms — an array
from an iframe or a Node `vm` context has a different `Array` constructor, so
`instanceof` says `false` while the value is genuinely an array.

## Why "primitive" matters

It is not trivia. It decides three things you rely on daily:

1. **Copy semantics.** Primitives are copied on assignment; objects are shared.
   That is [page 02](./02-references-vs-values.md), and it is the single most
   consequential distinction in the language.
2. **Equality.** Primitives compare by value, objects by identity —
   `{a:1} === {a:1}` is `false`.
3. **Immutability.** Primitives cannot be changed at all.
   `'abc'.toUpperCase()` returns a *new* string; the original is untouched.
   Every string method is non-mutating for this reason.

## Gotchas

**Symptom:** `TypeError: Cannot read properties of null` after a `typeof v ===
'object'` guard.
**Cause:** `typeof null` is `'object'`, so `null` passed the guard.
**Fix:** `typeof v === 'object' && v !== null`.

**Symptom:** `Array.isArray` and `instanceof Array` disagree.
**Cause:** the array came from another realm (iframe, `vm`, worker) with its own
`Array` constructor.
**Fix:** always `Array.isArray`.

**Symptom:** a string method appeared not to work — `s.toUpperCase()` and `s` is
unchanged.
**Cause:** strings are primitives and immutable; the method returns a new string.
**Fix:** use the return value: `s = s.toUpperCase()`.

**Symptom:** `typeof v === 'object'` is `false` for something you built with
`class`.
**Cause:** you are checking the class itself, not an instance — a class is a
function.
**Fix:** check the instance, or use `typeof v === 'function'` for the class.

## Interview questions

**★ How many types does JavaScript have?**
Eight: seven primitives — string, number, boolean, undefined, null, symbol,
bigint — and object. Arrays, dates, regexes, `Map` and class instances are all
objects. Functions are objects too; `typeof` reports `'function'` as a
convenience because callability is checked so often.

**★ Why is `typeof null === 'object'`?**
A bug from the original implementation: values carried a type tag in their low
bits, objects used tag `000`, and `null` was the all-zero null pointer, so it
read as an object. A fix was proposed and rejected because existing code depends
on it. Detect `null` with `v === null`.

**★ How do you check whether something is an array?**
`Array.isArray(v)`. `typeof` reports `'object'` for arrays, and `instanceof
Array` fails across realms — an array from an iframe or a `vm` context has a
different constructor. `Array.isArray` works regardless.

**What is the practical difference between a primitive and an object?**
Copy semantics, equality and mutability. Primitives are copied on assignment,
compared by value, and immutable. Objects are shared by reference, compared by
identity, and mutable. That single distinction is behind most "why did this
change?" bugs and behind immutable state updates in React.

**How would you distinguish a Date from a plain object?**
`Object.prototype.toString.call(v)` gives `'[object Date]'`, or `v instanceof
Date` within one realm. `typeof` reports `'object'` for both and cannot help.

---

[Phase index](./) · Next: [02 · Primitives are copied, objects are shared](./02-references-vs-values.md) →
