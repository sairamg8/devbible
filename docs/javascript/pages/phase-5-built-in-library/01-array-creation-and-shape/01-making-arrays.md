---
title: "01.1 · Making arrays"
sidebar_label: "01 · Making arrays"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against MDN — [`Array.from`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/from), [`Array.of`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/of), [`Array()` constructor](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/Array). Documentation-validated.

Four ways to make an array, and the one everybody reaches for first — `new Array(n)`
— is the one with a trap in it.

## The literal, and `Array.of`

```js
const a = [1, 2, 3];
```

The literal is right for every case where you know the elements. Nothing to say about
it, except by contrast with the constructor:

```js
new Array(3);     // [ <3 empty items> ]  ← a length, not an element
new Array(1, 2);  // [1, 2]               ← two elements
Array.of(3);      // [3]                  ← always elements
Array.of(1, 2);   // [1, 2]
```

**`Array()` changes meaning based on how many arguments it gets.** One numeric
argument is a *length*; anything else is a list of elements. That inconsistency is the
entire reason `Array.of` exists — it always treats its arguments as elements.

This bites in exactly one shape, and it is a common one:

```js
const makeRow = (...cells) => new Array(...cells);
makeRow(3);      // [ <3 empty items> ]  ← not [3]
Array.of(3);     // [3]
```

Any time the argument count is dynamic, `new Array` is a hazard. Use `Array.of`, or a
literal.

## `Array.from` — the general converter

MDN: it *"creates a new, shallow-copied `Array` instance from an iterable or
array-like object."*

Those are **two different protocols**, and `Array.from` is the only built-in that
accepts both:

- **Iterables** — anything with `Symbol.iterator`: `Map`, `Set`, strings, generators,
  `NodeList`, `arguments`.
- **Array-likes** — an object with a `length` and indexed properties, and *no*
  iterator: `{length: 5, 0: "foo"}`, and older DOM collections.

Spread (`[...x]`) handles only the first. So for a genuine array-like with no
iterator, `Array.from` is the only option that works:

```js
[...{ length: 2, 0: "a", 1: "b" }];       // TypeError: not iterable
Array.from({ length: 2, 0: "a", 1: "b" }); // ["a", "b"]
```

### The `mapFn` second argument

```js
Array.from([1, 2, 3], (x) => x + x);
// [2, 4, 6]
```

MDN explains precisely how this differs from chaining:

> `Array.from(obj, mapFn, thisArg)` has the same result as
> `Array.from(obj).map(mapFn, thisArg)`, except that it does not create an
> intermediate array, and `mapFn` only receives two arguments (`element`, `index`)
> without the whole array, because the array is still under construction.

Two things there. **No intermediate array** — one allocation rather than two, which is
the efficiency argument. And **the callback gets two arguments, not three**: there is
no third `array` parameter, because the array does not exist yet. Code that habitually
writes `(x, i, arr) => …` gets `undefined` for `arr` here.

### The `{ length: n }` idiom

```js
Array.from({ length: 5 }, (v, i) => i);
// [0, 1, 2, 3, 4]

// Sequence generator (range)
const range = (start, stop, step) =>
  Array.from(
    { length: Math.ceil((stop - start) / step) },
    (_, i) => start + i * step,
  );

range(0, 5, 1);
// [0, 1, 2, 3, 4]
```

This is the standard way to build a range, and it works because `{ length: 5 }` is a
perfectly good array-like: it has a `length` and no indices, so every element is
missing — and MDN's guarantee handles that:

> `Array.from()` never creates a sparse array. If the `items` object is missing some
> index properties, they become `undefined` in the new array.

**That sentence is why `Array.from({length: n})` works and `new Array(n)` does not.**
The former produces `n` real `undefined` elements; the latter produces `n` holes,
which most array methods skip. So:

```js
new Array(3).map((_, i) => i);          // [ <3 empty items> ] — map SKIPPED the holes
Array.from({ length: 3 }, (_, i) => i); // [0, 1, 2]
```

A very common workaround is `new Array(3).fill().map(…)` — `fill` replaces the holes
with real `undefined` values first. It works, but `Array.from` says what it means in
one call.

## `Array.from` is shallow

MDN's word is *"shallow-copied"*. `Array.from(users)` gives you a new array holding
**the same objects** — everything in
[Phase 4 · 04 · Shallow vs deep copy](../../phase-4-objects-and-classes/04-shallow-vs-deep-copy/README.md)
applies. Same for `[...users]` and `users.slice()`.

## Choosing

| Situation | Use |
|---|---|
| You know the elements | a **literal** `[a, b, c]` |
| Elements from a variable-length argument list | **`Array.of(...xs)`** — never `new Array(...xs)` |
| An iterable (`Set`, `Map`, string, generator) | **spread** `[...x]` — shortest |
| An array-like with **no** iterator | **`Array.from(x)`** — spread cannot |
| Convert *and* transform in one pass | **`Array.from(x, fn)`** — no intermediate array |
| `n` slots you will immediately fill | **`Array.from({length: n}, fn)`** — never `new Array(n).map` |
| A pre-sized buffer you will index into | `new Array(n)` is *acceptable* — you are writing by index, not iterating |

## Gotchas

**Symptom:** `new Array(3)` gives an empty array of length 3 instead of `[3]`
**Cause:** A single **numeric** argument is treated as a length; any other argument
count is treated as elements.
**Fix:** `Array.of(3)`, or a literal. Use `Array.of` wherever the argument count is
dynamic.

**Symptom:** `.map()` over `new Array(n)` returns holes and never calls the callback
**Cause:** `new Array(n)` produces **holes**, and `map` skips holes while preserving
them in the output.
**Fix:** `Array.from({ length: n }, fn)` — MDN: *"`Array.from()` never creates a
sparse array."* Or `new Array(n).fill()` first.

**Symptom:** `TypeError: … is not iterable` when spreading an object with a `length`
**Cause:** Spread requires `Symbol.iterator`; an array-like has none.
**Fix:** `Array.from(x)`, which accepts both protocols.

**Symptom:** The third `array` parameter is `undefined` in an `Array.from` map callback
**Cause:** MDN: `mapFn` *"only receives two arguments (`element`, `index`) … because
the array is still under construction."*
**Fix:** Use `Array.from(x).map(fn)` if you genuinely need the whole array — at the
cost of the intermediate.

**Symptom:** Mutating an element of a "copied" array changed the original
**Cause:** `Array.from`, spread and `slice` are all **shallow** — the same objects are
referenced.
**Fix:** `structuredClone` if you need independence.

## Interview questions

**★ What is the difference between `new Array(3)` and `Array.of(3)`?**
`new Array(3)` creates an array of **length 3 containing holes**; `Array.of(3)` creates
`[3]`. The constructor changes meaning based on argument count — one number is a
length, anything else is elements — which is precisely why `Array.of` was added.

**★ Why does `new Array(5).map((_, i) => i)` not work?**
Because `new Array(5)` contains **holes**, not `undefined` values, and `map` skips
holes while preserving them in its output. `Array.from({length: 5}, (_, i) => i)`
works because MDN guarantees `Array.from` *"never creates a sparse array"*.

**★ When must you use `Array.from` rather than spread?**
When the source is an **array-like with no iterator** — an object with `length` and
indices, or an older DOM collection. Spread requires `Symbol.iterator` and throws
`TypeError` without it. `Array.from` accepts both protocols.

**★ What does `Array.from`'s second argument do that `.map()` does not?**
It maps during construction, so **no intermediate array is allocated** — and the
callback receives only `(element, index)`, with no third `array` argument, because the
array is still being built.

**How do you build a range of numbers?**
`Array.from({ length: n }, (_, i) => start + i * step)`. The `{length: n}` object is a
valid array-like with no indices, and `Array.from` fills the missing ones with real
`undefined` values rather than holes.

**Is `Array.from` a deep copy?**
No — MDN says *"shallow-copied"*. The new array holds the same object references, so
mutating an element is visible through both arrays.

---

[Topic index](./README.md) · Next → [Holes, `length` and sparse arrays](./02-holes-and-length.md)
