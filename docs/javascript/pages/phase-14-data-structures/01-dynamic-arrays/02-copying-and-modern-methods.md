---
title: "01.2 · Copying, slicing and the modern methods"
sidebar_label: "02 · Copying and methods"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`Array.prototype.slice()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/slice), [`Array.prototype.splice()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/splice), [`Array.prototype.toSorted()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/toSorted), [`Array.prototype.at()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/at), [`Array.from()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/from), [`structuredClone()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/structuredClone). Documentation-validated; **no timings**.

**Half the array bugs in a codebase are about who owns the array.** A method that mutates where a
copy was expected, or a "copy" that shares every element, is the same class of mistake as the
complexity traps in the previous chunk — and it is more common.

## Mutating versus non-mutating

| Mutates in place | Returns a new array |
|---|---|
| `push` `pop` `shift` `unshift` | `concat` `slice` `map` `filter` `flat` `flatMap` |
| `splice` | `toSpliced` |
| `sort` | `toSorted` |
| `reverse` | `toReversed` |
| `fill` `copyWithin` | `with` |

🔴 **`sort` and `reverse` mutate.** This is the single most common surprise in the list, because
they also *return* the array — so `const sorted = items.sort(cmp)` looks pure and has just
reordered the caller's data. In a UI framework that is a re-render bug; in a shared module it is a
bug in someone else's file.

The **ES2023 change-by-copy methods** — `toSorted`, `toReversed`, `toSpliced`, `with` — exist
exactly for this, and they are the right default now:

```js
const sorted  = items.toSorted((a, b) => a.price - b.price);   // ✅ items untouched
const swapped = items.with(0, replacement);                    // ✅ copy with one index changed
const removed = items.toSpliced(2, 1);                         // ✅ copy without index 2
```

Each is O(n) because it copies — which is the price of not mutating, and almost always worth
paying.

**`slice` versus `splice`** is worth saying out loud once, because the names are nearly identical
and the behaviours are opposite: **`slice(start, end)` copies and does not mutate; `splice(start,
count, ...items)` removes/inserts in place and returns what it removed.**

## Every copy here is shallow

```js
const copy = [...rows];
copy[0].name = "changed";       // ⚠️ rows[0].name is also "changed"
```

`[...arr]`, `arr.slice()`, `Array.from(arr)`, `arr.concat()` and the change-by-copy methods all
produce a **new array containing the same references**. The array is independent; the objects in it
are not.

For a genuinely independent structure:

```js
const deep = structuredClone(rows);       // ✅ handles nesting, Dates, Maps, Sets, cycles
```

⚠️ **`structuredClone` cannot clone functions, DOM nodes, or class identity** — it throws on
functions (`DataCloneError`) and returns plain objects for class instances. And
`JSON.parse(JSON.stringify(x))` is worse: it silently drops `undefined`, functions and symbols,
turns `Date` into a string, and throws on cycles
([Phase 5 · 09 · JSON](../../phase-5-built-in-library/09-json/README.md)).

**Most of the time you do not want a deep copy at all** — you want to replace the one item that
changed and share the rest. That is structural sharing, and it is what makes immutable updates
cheap:

```js
const next = items.with(index, { ...items[index], done: true });   // O(n) array, O(1) item
```

## The methods worth knowing that people miss

**`at(-1)`** — the last element, without `arr[arr.length - 1]`:

```js
items.at(-1);        // last
items.at(0);         // same as items[0]
```

**`Array.from` with a mapping function**, which builds packed arrays and works on anything
iterable or array-like:

```js
Array.from({ length: 5 }, (_, i) => i * 2);     // [0, 2, 4, 6, 8] — packed
Array.from(document.querySelectorAll("li"));    // NodeList → real array
Array.from(map);                                // entries
Array.from(new Set(items));                     // dedupe, back to an array
```

🔴 **`Array.from({length: n}, fn)` is the correct way to build an array of n computed values.**
`new Array(n)` is holey and `map` skips holes, so `new Array(5).map((_, i) => i)` returns five
holes — a bug that looks like a broken `map`.

**`flat` and `flatMap`** — `flat()` defaults to depth 1 and takes `Infinity`; `flatMap` is
`map` then `flat(1)`, which is the idiomatic "map to zero-or-more results":

```js
const tags = posts.flatMap((p) => p.tags ?? []);       // one pass, no empties
```

**`findLast` / `findLastIndex`** — search from the end without reversing a copy.

**`Object.groupBy` / `Map.groupBy`** — [03 · Frequency maps and
grouping](../03-frequency-and-grouping/README.md).

## Array-likes are not arrays

`arguments`, a `NodeList`, an `HTMLCollection` and a string all have `length` and indices but not
`Array.prototype`. MDN notes the array methods are **generic** — `push()` *"only expects the `this`
value to have a `length` property and integer-keyed properties"* — which is why the old
`Array.prototype.slice.call(arguments)` trick worked.

Use `Array.from(x)` or `[...x]` today. ⚠️ They differ: spread requires the value to be **iterable**,
while `Array.from` also accepts plain array-likes. An object with `length` and indices but no
`Symbol.iterator` works with `Array.from` and throws with spread.

🔴 **A live `HTMLCollection` updates as the DOM changes**, so iterating it while inserting elements
is an infinite loop. Copy it first — this is a real bug, not a theoretical one
([Phase 9 · The DOM](../../phase-9-dom/README.md)).

## Gotchas

**Symptom:** Sorting a prop reorders the parent's state
**Cause:** `sort` mutates in place and also returns the array.
**Fix:** `toSorted`, or `[...items].sort(cmp)`.

**Symptom:** Editing a copied array changes the original's objects
**Cause:** Every array copy is shallow — same element references.
**Fix:** `structuredClone` for a deep copy, or replace only the changed item with `with` + spread.

**Symptom:** `structuredClone` throws `DataCloneError`
**Cause:** The value contains a function, a DOM node, or another non-cloneable.
**Fix:** Clone only the data, or copy field by field.

**Symptom:** `new Array(5).map((_, i) => i)` returns holes
**Cause:** The array is holey and `map` skips holes.
**Fix:** `Array.from({ length: 5 }, (_, i) => i)`.

**Symptom:** `slice` and `splice` behave unexpectedly
**Cause:** They are opposites — `slice` copies, `splice` mutates.
**Fix:** Read the name carefully; prefer `toSpliced` when you want a copy.

**Symptom:** Spreading an array-like throws "is not iterable"
**Cause:** Spread needs `Symbol.iterator`; `Array.from` does not.
**Fix:** `Array.from(x)`.

**Symptom:** A loop over `getElementsByTagName` never ends
**Cause:** An `HTMLCollection` is live and grows as you insert.
**Fix:** `Array.from(collection)` first.

**Symptom:** A deep copy loses `Date`s and `undefined` fields
**Cause:** `JSON.parse(JSON.stringify(x))`.
**Fix:** `structuredClone`.

## Interview questions

**★ Which array methods mutate?**
`push`, `pop`, `shift`, `unshift`, `splice`, `sort`, `reverse`, `fill`, `copyWithin`. The trap is
`sort`/`reverse`, because they return the array too — so `const sorted = items.sort(cmp)` reads as
pure and has reordered the caller's data. ES2023 added `toSorted`, `toReversed`, `toSpliced` and
`with` as copying equivalents.

**★ Is `[...arr]` a deep copy?**
No — a new array holding the same references. Mutating an element still affects the original. Use
`structuredClone` for a true deep copy, though it cannot clone functions or DOM nodes and loses
class identity.

**★ `slice` vs `splice`?**
`slice(start, end)` copies a range and does not mutate. `splice(start, count, ...items)` removes
and inserts **in place** and returns what it removed. Nearly identical names, opposite behaviour.

**★ Why does `new Array(5).map(f)` do nothing?**
The array is holey — five empty slots, not five `undefined`s — and `map` skips holes.
`Array.from({length: 5}, f)` builds a packed array and calls `f` for each index.

**★ How do you turn a `NodeList` into an array, and why does spread sometimes fail?**
`Array.from(x)` or `[...x]`. Spread requires the value to be **iterable**; `Array.from` also
accepts plain array-likes with `length` and indices. Array methods themselves are generic — MDN
notes `push` *"only expects the `this` value to have a `length` property and integer-keyed
properties."*

**★ How do you update one item immutably without copying everything deeply?**
`items.with(i, { ...items[i], done: true })` — a new array (O(n)) with one new object, sharing the
rest. Structural sharing, not a deep clone.

**Why is a live `HTMLCollection` dangerous?**
It reflects the DOM as it changes, so inserting elements while iterating it can loop forever. Copy
to an array first.

---

← [01 · The cost table](./01-the-real-cost-table.md) · [Topic index](./README.md) ·
Next → [Phase index](../README.md)
