---
title: "03.2 · Where spread earns its place"
sidebar_label: "02 · Where it earns its place"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against MDN — [Spread syntax](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax), [`Function.prototype.apply`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/apply). Documentation-validated.

The patterns worth knowing, and the two places spread is the wrong tool.

## Replacing `apply`

```js
Math.max(...numbers);           // ✅
Math.max.apply(null, numbers);  // the pre-ES6 equivalent
```

Spread replaced `apply` for its most common use — passing an array as an argument list —
and it composes where `apply` did not: you can mix spread with fixed arguments and use
several in one call.

```js
f(a, ...middle, b, ...rest);    // impossible with apply
new Date(...dateParts);         // apply cannot be used with `new` at all
```

That last line matters: `apply` cannot construct, so before spread you needed
`Reflect.construct` or a `bind` trick. `apply` remains useful only when you need to set
`this` at the same time.

🔴 **The argument-count limit.** Spreading a very large array into a call passes each
element as a separate argument, and engines cap argument counts:

```js
Math.max(...hugeArray);      // RangeError: Maximum call stack size exceeded
arr.push(...hugeArray);      // same hazard
```

The limit is engine-specific and this corpus measures nothing, so the practical rule is:
**for arrays that could be large, do not spread into a call.** Use a `reduce`, a loop, or
chunking:

```js
const max = hugeArray.reduce((m, n) => (n > m ? n : m), -Infinity);
for (const x of hugeArray) arr.push(x);
```

## Merging and overriding

```js
const config = { ...defaults, ...userOptions };   // later wins
const arr = [...a, ...b];                          // concat
const withExtra = [...items, newItem];             // non-mutating push
const atFront = [newItem, ...items];               // non-mutating unshift
```

**Later spreads win**, which makes `{ ...defaults, ...overrides }` the standard options
idiom. Two cautions from
[Phase 4 · 01](../../phase-4-objects-and-classes/01-object-literals/02-methods-accessors-and-spread.md):

- It is a **replace**, not a deep merge. If both objects have a nested `options`, the
  second wins **whole**, and keys present only in the first are gone.
- **A spread placed after an explicit key overrides it** — `{ ...a, x: 1, ...b }` lets
  `b.x` win over the `x: 1` you wrote. Almost always a bug.

For arrays, `[...a, ...b]` and `a.concat(b)` are equivalent for the common case; `concat`
is safer for very large arrays since it takes the array as a value rather than as
arguments.

## Immutable updates

The pattern that makes spread central to React, Redux and every immutable-state
codebase:

```js
// object: change one key
setState((s) => ({ ...s, filters: { ...s.filters, status: "active" } }));

// array: replace one element by index
const next = [...items.slice(0, i), updated, ...items.slice(i + 1)];
// or, in a modern runtime
const next = items.with(i, updated);

// array: remove one
const next = items.filter((x) => x.id !== id);
```

Each level that **changes** is copied one level; every untouched branch is **shared by
reference**, deliberately. That sharing is what makes `prev.items === next.items` a valid
"did this change?" test — the argument from
[Phase 4 · 04 · What shallow means](../../phase-4-objects-and-classes/04-shallow-vs-deep-copy/01-what-shallow-means.md),
and the reason deep-cloning state is actively harmful.

`with`, `toSpliced`, `toSorted` and `toReversed` cover several of these more clearly than
a slice sandwich; prefer them where available.

## Converting iterables

```js
[...map.keys()];          // an array from an iterator
[...set];                 // Set → array
[...document.querySelectorAll("li")];  // NodeList → array, for map/filter
[...formData.entries()];
[..."héllo"];             // code points
```

`NodeList` is the everyday one: it has `forEach` but not `map`, `filter` or `reduce`, so
spreading it into a real array is how you get the array methods.

**Where `Array.from` is the better choice:**

- The source is an **array-like without an iterator** — `{length: 2, 0: "a"}`, some older
  DOM collections. Spread throws; `Array.from` works.
- You want to **map while converting** — `Array.from(x, fn)` allocates no intermediate
  array.
- You are building `n` slots — `Array.from({length: n}, fn)`, from
  [Phase 5 · 01](../../phase-5-built-in-library/01-array-creation-and-shape/01-making-arrays.md).

Otherwise spread is shorter and reads better.

## Where spread is the wrong tool

**1. Inside a loop that builds an array.** Each spread copies everything accumulated so
far, so the loop becomes quadratic — the same shape MDN documents as the `reduce`
anti-pattern ([Phase 5 · 05](../../phase-5-built-in-library/05-reduce/02-when-not-to-use-it.md)):

```js
// ❌ quadratic by construction
let out = [];
for (const x of items) out = [...out, transform(x)];

// ✅ linear
const out = items.map(transform);
```

**2. Copying anything with identity.** A class instance loses its methods; a `Map` or
`Set` spread into an object gives `{}`; a `Date` gives `{}`. Use the type's own
constructor (`new Map(old)`, `new Date(old)`) or a `clone()` method.

And the standing caution: spread is **shallow**, so a nested object is shared. That is
usually correct — reach for `structuredClone` only when you genuinely need an independent
graph.

## Gotchas

**Symptom:** `RangeError: Maximum call stack size exceeded` from `Math.max(...arr)` or
`arr.push(...other)`
**Cause:** Spread passes each element as a separate **argument**, and engines cap
argument counts.
**Fix:** `reduce` for the max, a loop or `concat` for the append. Do not spread
potentially large arrays into a call.

**Symptom:** A merge lost keys from the first object
**Cause:** Object spread **replaces** nested objects wholesale — it is not a deep merge.
**Fix:** Spread each level you want merged: `{ ...a, opts: { ...a.opts, ...b.opts } }`.

**Symptom:** An explicit key was overridden by a later spread
**Cause:** Later entries win, including spreads placed after explicit keys.
**Fix:** Put spreads first: `{ ...defaults, x: 1 }`.

**Symptom:** A loop that builds an array with spread gets slower as it grows
**Cause:** Each iteration copies the whole accumulated array — quadratic by construction.
**Fix:** `map`, or `push` into an array you build once.

**Symptom:** Spreading a `Date`, `Map` or class instance produced `{}` or a
method-less object
**Cause:** Their state is in internal slots or on the prototype, neither of which is an
own enumerable property.
**Fix:** The type's own constructor, or a `clone()` method.

**Symptom:** `[...arrayLike]` throws while `Array.from(arrayLike)` works
**Cause:** Spread needs `Symbol.iterator`; `Array.from` accepts array-likes too.
**Fix:** `Array.from`.

## Interview questions

**★ How does spread replace `apply`?**
`f(...args)` does what `f.apply(null, args)` did, and composes better — you can mix
spread with fixed arguments, use several spreads in one call, and use it with **`new`**,
which `apply` cannot do at all. `apply` is now only for setting `this` at the same time.

**★ What is the hazard of `Math.max(...hugeArray)`?**
Spread passes each element as a separate **argument**, and engines cap argument counts —
so a large array gives `RangeError`. Use `reduce` for the max, or a loop/`concat` for
appends.

**★ Why is `out = [...out, x]` inside a loop a problem?**
Each iteration copies the entire accumulated array, so the loop does work proportional to
n² for a linear task. It is the array form of the `reduce` spread anti-pattern MDN
documents. Use `map`, or `push` into one array.

**★ When should you use `Array.from` instead of spread?**
When the source is an **array-like with no iterator** (spread throws), when you want to
**map while converting** without an intermediate array, or when building `n` slots with
`Array.from({length: n}, fn)`.

**Why is spread central to immutable state updates?**
Because it copies only the level you are changing and **shares** every untouched branch
by reference — which is exactly what makes `prev.items === next.items` a valid change
check, and therefore what makes memoisation work.

**Why does `{ ...defaults, ...overrides }` sometimes lose configuration?**
Because it is a **replace**, not a deep merge: a nested object in `overrides` wins whole,
discarding keys that existed only in `defaults`. Spread each level you intend to merge.

---

← [Two operations, one syntax](./01-two-operations-one-syntax.md) · [Topic index](./README.md) · Next → [Phase index](../README.md)
