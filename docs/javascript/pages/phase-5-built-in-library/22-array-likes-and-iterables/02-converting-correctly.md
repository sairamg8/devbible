---
title: "2 · Converting correctly"
sidebar_label: "2 · Converting correctly"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`Array.from()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/from), [`Array.of()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/of), [Spread syntax](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax), [`Array.isArray()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/isArray), [`Array.prototype.slice()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/slice), [`Function.prototype.call()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/call), [`Array.fromAsync()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/fromAsync), [`Object.fromEntries()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/fromEntries), [`Symbol.iterator`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol/iterator). Documentation-validated; **no timings**.

## Three converters, and the one difference that decides between them

```js
Array.from(x);                        // ✅ iterables AND array-likes
[...x];                               // ✅ iterables only
Array.prototype.slice.call(x);        // ⚠️ legacy — array-likes, via duck typing
```

🔴 **`Array.from` accepts both contracts; spread accepts only iterables.** Everything else
about them is a matter of taste — this is the only case where the choice is forced:

```js
const arrayLike = { 0: "a", 1: "b", length: 2 };

[...arrayLike];            // 🔴 TypeError: arrayLike is not iterable
Array.from(arrayLike);     // ✅ ["a", "b"]
```

**So the rule is short:**

| You have | Use |
|---|---|
| something iterable, and you want an array | `[...x]` — shorter, and reads as "spread it" |
| an array-like with no `Symbol.iterator` | `Array.from(x)` — the only one that works |
| either, and you also want to map | `Array.from(x, fn)` — one pass |
| a length and a generator function | `Array.from({ length: n }, fn)` |

⚠️ **`Array.prototype.slice.call(x)` is not wrong, it is just old.** It predates both and
appears throughout pre-2015 code — recognise it, do not write it. `Array.from` says what
it means.

## `Array.from`'s second argument

```js
Array.from(nodeList, (el) => el.textContent);       // ✅ convert and map in one pass
[...nodeList].map((el) => el.textContent);          // same result, two arrays
```

**The map function is not sugar** — it avoids materialising the intermediate array, and it
is the only way to map while converting an array-like that spread cannot touch.

🔴 **And it is what makes the range idiom work:**

```js
Array.from({ length: 5 }, (_, i) => i);            // [0, 1, 2, 3, 4]
Array.from({ length: 5 }, (_, i) => i * 2);        // [0, 2, 4, 6, 8]
```

**`{ length: 5 }` is an array-like with no elements at all**, so `Array.from` walks
indices 0–4, finds `undefined` at each, and hands each to your function along with the
index. It is the closest thing JavaScript has to a `range()`.

⚠️ **The versions that look equivalent and are not:**

```js
new Array(5).map((_, i) => i);          // 🔴 [empty × 5] — map skips holes
Array(5).fill(0).map((_, i) => i);      // ✅ works, but allocates twice
Array.from({ length: 5 }, (_, i) => i); // ✅ the idiomatic one
```

**`new Array(5)` creates holes, and every array iteration method skips holes**
([01 · 02 · Holes and `length`](../01-array-creation-and-shape/02-holes-and-length.md)).
That is the whole reason the `Array.from` form exists.

## What conversion is actually for

**Three reasons, and only the first is about methods:**

1. **You want array methods** — `map`, `filter`, `reduce`, `sort`.
2. 🔴 **You want to freeze a live collection**, so that mutating the DOM does not move the
   ground under your loop ([chunk 1](./01-the-two-contracts.md)).
3. **You want to consume a one-shot iterator more than once.** A generator object, and
   most iterators, are exhausted after a single pass:

```js
const gen = numbers();
[...gen];      // ✅ [1, 2, 3]
[...gen];      // 🔴 [] — already exhausted
```

⚠️ **That third one catches people with iterator helpers and `Map`/`Set` entry
iterators too.** If a value will be traversed twice, convert once and keep the array.

**And the reason *not* to convert:** a single pass that only needs `for...of` does not
need an array at all. Converting allocates a copy of a collection you were about to walk
once — and on a lazy or infinite generator it never returns.

```js
for (const el of document.querySelectorAll(".row")) { … }   // ✅ no array needed
```

## Detecting what you have

**Checking for iterable is exact**, because the contract is a real method:

```js
const isIterable = (x) => x != null && typeof x[Symbol.iterator] === "function";
```

🔴 **Checking for array-like is not exact, and the obvious version is wrong:**

```js
const bad = (x) => typeof x?.length === "number";     // 🔴 true for every function
bad(function foo(a, b) {});                           // 🔴 true — length is its arity
bad("hello");                                         // true — a string, which may
                                                      //    or may not be what you meant
```

**A defensible version excludes functions and pins the length to a real index range:**

```js
const isArrayLike = (x) =>
  x != null &&
  typeof x !== "function" &&
  Number.isInteger(x.length) &&
  x.length >= 0;
```

⚠️ **There is no perfect test, and that is the point** — array-like is a shape a caller
*decides* to treat a value as, not a type the value declares. When you control both sides,
do not guess: accept an array, or an iterable, and document which.

### `Array.isArray` versus `instanceof Array`

```js
Array.isArray(value);        // ✅ always correct
value instanceof Array;      // ⚠️ false for an array from another realm
```

🔴 **An array created in an iframe, a Web Worker or a Node `vm` context has a *different*
`Array.prototype`**, so `instanceof` says `false` about a genuine array. `Array.isArray`
asks the internal slot and is realm-independent. Use it, always — it costs nothing and it
removes a class of bug that only appears in production.

## The related conversions

**Iterables convert into more than arrays**, and these are the same protocol viewed from
the other end:

```js
new Set(iterable);                    // dedupe
new Map(pairsIterable);               // key/value
Object.fromEntries(pairsIterable);    // ✅ takes any iterable of pairs, including a Map
Array.from(map);                      // [[k, v], …]
Array.from(map.keys());
```

**And for async sources there is a direct counterpart:**

```js
await Array.fromAsync(asyncIterable);   // the async analogue of Array.from
```

⚠️ **`Array.fromAsync` is recent** — check your targets; the fallback is a
`for await...of` loop pushing into an array.

**`Array.of` solves the other `Array` constructor trap**, and belongs beside these:

```js
Array(5);        // 🔴 an empty array of length 5
Array.of(5);     // ✅ [5]
Array(1, 2);     // [1, 2] — the constructor changes meaning with arity
```

## Gotchas

**Symptom:** `TypeError: x is not iterable` from spread
**Cause:** It is array-like only — no `Symbol.iterator`.
**Fix:** `Array.from(x)`.

**Symptom:** `Array.from(x)` returned `[]` for something with data
**Cause:** No `length` and no `Symbol.iterator` — a plain object keyed by strings.
**Fix:** `Object.values(x)` or `Object.entries(x)`.

**Symptom:** `new Array(5).map(…)` produced holes
**Cause:** The constructor creates holes, and iteration methods skip them.
**Fix:** `Array.from({ length: 5 }, (_, i) => …)`.

**Symptom:** Spreading a generator a second time gave an empty array
**Cause:** Iterators are one-shot.
**Fix:** Convert once and reuse the array.

**Symptom:** An array-like check accepted a function
**Cause:** Functions have `length` — their arity.
**Fix:** Exclude functions explicitly, or stop guessing and define the contract.

**Symptom:** `instanceof Array` was `false` for an obvious array
**Cause:** It came from another realm — an iframe, a worker, a `vm` context — with a
different `Array.prototype`.
**Fix:** `Array.isArray`.

**Symptom:** Spreading an infinite generator hung
**Cause:** Conversion is eager; the generator never ends.
**Fix:** `for...of` with a `break`, or take a bounded prefix.

**Symptom:** Converting a large `NodeList` on every event felt heavy
**Cause:** Each conversion allocates a fresh array.
**Fix:** If you only iterate once, `for...of` the collection directly.

## Interview questions

**★ When must you use `Array.from` rather than spread?**
When the value is array-like but not iterable — a plain `{length, 0, 1}` object, or an API
result shaped like one. Spread requires `Symbol.iterator`; `Array.from` accepts either
contract. `Array.from` also takes a map function, which converts and maps in one pass.

**★ How do you build `[0, 1, 2, 3, 4]`?**
`Array.from({ length: 5 }, (_, i) => i)`. `new Array(5).map(…)` does not work because the
constructor creates holes and every iteration method skips them; `Array(5).fill(0).map(…)`
works but allocates twice.

**★ Why `Array.isArray` instead of `instanceof Array`?**
`instanceof` walks the prototype chain, and an array created in another realm — an iframe,
a worker, a `vm` context — has a different `Array.prototype`, so it returns `false` for a
real array. `Array.isArray` checks the internal slot and is realm-independent.

**★ Why is there no reliable "is this array-like?" check?**
Because array-like is a shape, not a declared type. The obvious test,
`typeof x.length === "number"`, is true for every function, since a function's `length` is
its arity. You can exclude functions and require a non-negative integer length, but the
honest answer is to define the contract at the boundary instead of sniffing it.

**★ When should you not convert?**
When you iterate once. `for...of` over a `NodeList` or a generator needs no array, and
converting allocates a copy of something you were about to walk anyway. Converting an
infinite generator never returns at all.

**What are the three real reasons to convert?**
To get array methods; to **snapshot a live DOM collection** so mutation does not move the
loop underneath you; and to traverse a one-shot iterator more than once.

---

← [1 · The two contracts](./01-the-two-contracts.md) · [Topic index](./README.md) · [Phase index](../README.md) →
