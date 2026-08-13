---
title: "03.1 · Two operations, one syntax"
sidebar_label: "01 · Two operations, one syntax"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against MDN — [Spread syntax](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax). Documentation-validated.

**`...` means two entirely different things depending on where you write it**, and the
syllabus flags this deliberately. In an array literal or an argument list it consumes an
**iterable**. In an object literal it copies **own enumerable properties**. They share a
spelling and nothing else.

MDN's bottom line: *"Spread (`...`) in function/array contexts requires iterables;
object spread only needs enumerable own properties."*

## Array and call contexts need an iterable

```js
const obj = { key1: "value1" };
const array = [...obj]; // TypeError: obj is not iterable
```

Only values with a `Symbol.iterator` work here — arrays, strings, `Map`, `Set`,
`NodeList`, `arguments`, generators, and anything you have given an iterator.

```js
[...["a", "b"]];        // ["a", "b"]
[..."hi"];              // ["h", "i"]      — code POINTS
[...new Set([1, 1, 2])]; // [1, 2]
[...map];               // [[k1, v1], [k2, v2]]  — pairs
Math.max(...numbers);   // spread into an argument list
```

**Spreading a `Set` into an array is the idiomatic dedupe:**

```js
[...new Set(items)]          // or Array.from(new Set(items))
```

That is MDN's own recommended replacement for the quadratic `reduce`-plus-`includes`
version, from
[Phase 5 · 05](../../phase-5-built-in-library/05-reduce/02-when-not-to-use-it.md).

**Spreading a string yields code points**, not code units — the same reason `for...of`
handles emoji correctly and `split("")` does not
([Phase 5 · 07](../../phase-5-built-in-library/07-string-methods/01-slicing-and-splitting.md)).

## Object spread does not need an iterable

```js
const array = [1, 2, 3];
const obj = { ...array }; // { 0: 1, 1: 2, 2: 3 }
```

An array spreads **into an object** because *"all indices are enumerable own
properties"* — it is property copying, not iteration. Which is why the reverse fails and
this does not.

MDN's sharpest illustration, spreading primitives into an object:

```js
const obj = { ...true, ..."test", ...10 };
// { '0': 't', '1': 'e', '2': 's', '3': 't' }
```

`true` and `10` contribute **nothing** — boxed booleans and numbers have no own
enumerable properties — while the string contributes its indexed characters. **No error
for any of them.** Spreading a non-object into an object literal is silently a no-op,
which is precisely what makes the conditional-key idiom work:

```js
const filters = { status: "active", ...(cursor && { cursor }) };
```

When `cursor` is falsy you spread `false` or `undefined` and nothing is added
([Phase 4 · 01](../../phase-4-objects-and-classes/01-object-literals/01-shorthand-and-computed-keys.md)).

## The comparison

| | `[...x]` / `f(...x)` | `{ ...x }` |
|---|---|---|
| Requires | an **iterable** (`Symbol.iterator`) | nothing — any value |
| Uses | the **iterator protocol** | **own enumerable** properties |
| On a plain object | **`TypeError`** | copies its properties |
| On a `Map`/`Set` | its **entries/values** | **`{}`** — contents are internal slots |
| On a non-object | strings work, others `TypeError` | silently contributes nothing |
| On a class instance | `TypeError` unless iterable | fields only — **no methods** |
| Holes | visited as `undefined` | copied as `undefined` |

**The `Map`/`Set` row is the one that catches people.** `[...map]` gives you the pairs;
`{...map}` gives you `{}`, because a `Map`'s entries are internal slots rather than own
properties. Same value, same three dots, opposite outcomes.

## Both are shallow

MDN's warning, with its example:

```js
const a = [[1], [2], [3]];
const b = [...a];

b.shift().shift(); // 1

// Now array 'a' is affected:
console.log(a); // [[], [2], [3]]
```

> "Multidimensional arrays aren't safe to copy with spread. Use `structuredClone()` for
> deep copying."

`b` is a new array holding **the same inner arrays**. `b.shift()` removes the first inner
array from `b` only; the second `.shift()` then mutates that shared inner array, which
`a` still references.

Everything in
[Phase 4 · 04](../../phase-4-objects-and-classes/04-shallow-vs-deep-copy/README.md)
applies — including that shallow is usually the **right** default, and reaching for
`structuredClone` reflexively defeats the identity checks memoisation depends on.

## Spread versus rest — same dots, opposite direction

```js
const [first, ...rest] = arr;          // REST — collects, in a pattern
function f(...args) { … }              // REST — collects, in a parameter list
f(...args);                            // SPREAD — expands, in a call
const copy = [...arr];                 // SPREAD — expands, in a literal
```

**Rest appears on the left of an assignment or in a parameter list; spread appears on the
right or in a call.** Rest gathers many into one; spread expands one into many.

Rest has restrictions spread does not: it must be **last**, and there can be only one.
`function f(...a, b)` is a `SyntaxError`.

## Gotchas

**Symptom:** `TypeError: obj is not iterable` when spreading into an array
**Cause:** Array and call contexts require `Symbol.iterator`; plain objects have none.
**Fix:** `Object.values(obj)` / `Object.entries(obj)`, or spread into an **object**
instead.

**Symptom:** `{ ...map }` produced `{}`
**Cause:** Object spread copies **own enumerable properties**, and a `Map`'s entries are
internal slots.
**Fix:** `Object.fromEntries(map)`, or `[...map]` for the pairs.

**Symptom:** Spreading a number or boolean into an object silently did nothing
**Cause:** Boxed numbers and booleans have no own enumerable properties — MDN's
`{ ...true, ..."test", ...10 }` example.
**Fix:** Expected, and it is what makes `...(cond && { k })` work.

**Symptom:** Mutating a nested value in a spread copy changed the original
**Cause:** Spread is **shallow** — MDN: *"Multidimensional arrays aren't safe to copy with
spread."*
**Fix:** `structuredClone` for a genuinely independent graph — but first check whether
shallow was correct.

**Symptom:** Spreading a class instance lost its methods
**Cause:** Object spread copies **own** properties; methods live on the prototype.
**Fix:** Do not spread instances.

**Symptom:** `SyntaxError` from `function f(...a, b)`
**Cause:** A rest parameter must be **last**, and there can be only one.
**Fix:** Reorder the parameters.

## Interview questions

**★ Is object spread the same operation as array spread?**
No — MDN: array and call spread *"requires iterables"* while object spread *"only needs
enumerable own properties"*. So `[...obj]` throws for a plain object while `{...arr}`
works, giving `{0:1, 1:2, 2:3}`. Same syntax, different mechanism.

**★ What does `{ ...true, ..."test", ...10 }` produce?**
`{ '0': 't', '1': 'e', '2': 's', '3': 't' }` — the string contributes its indexed
characters and the boolean and number contribute nothing, silently. That silent no-op is
what makes `...(cond && { key })` a working conditional-key idiom.

**★ Why does `[...map]` differ from `{...map}`?**
`[...map]` uses the **iterator**, which yields `[key, value]` pairs. `{...map}` copies
**own enumerable properties**, and a `Map` keeps its entries in internal slots — so you
get `{}`.

**★ Is spread a deep copy?**
No, it is **shallow**. MDN's example: `const b = [...a]` then `b.shift().shift()` mutates
an inner array that `a` still holds. It recommends `structuredClone()` for deep copying —
though shallow is usually the correct default.

**What is the difference between spread and rest?**
Same three dots, opposite directions. **Rest** collects many into one and appears on the
left of an assignment or in a parameter list; **spread** expands one into many and
appears on the right or in a call. Rest must be last and there can be only one.

**How do you deduplicate an array?**
`[...new Set(items)]`. It is MDN's recommended replacement for the `reduce`-plus-
`includes` version, which is quadratic.

---

[Topic index](./README.md) · Next → [Where spread earns its place](./02-where-it-earns-its-place.md)
