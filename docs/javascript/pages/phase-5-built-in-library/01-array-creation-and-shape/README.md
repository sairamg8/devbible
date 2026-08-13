---
title: "01 · Array creation and shape"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against MDN — [`Array.from`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/from), [`Array.of`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/of), [`Array.prototype.length`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/length), [`delete`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/delete). Documentation-validated.

**Two facts do most of the damage here.** `new Array(n)` creates **holes**, not
`undefined` values — so `.map()` over it does nothing. And `length` is a **writable**
property that is one more than the highest index, not a count of the values present.

Everything else about making an array is straightforward.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[Making arrays](./01-making-arrays.md)** | Why `Array.of` exists, `Array.from` accepting **both** iterables and array-likes where spread accepts only one, the `mapFn` second argument and its two-parameter callback, the `{length: n}` range idiom, and a table for choosing |
| 2 | **[Holes, `length` and sparse arrays](./02-holes-and-length.md)** | `length` as writable — truncating, extending with holes, `RangeError`; the three states of an index; the four ways holes are created; **which methods skip holes and which do not**; and how to normalise |

## The two rules

```js
new Array(3).map((_, i) => i);          // [ <3 empty items> ]  ← holes are skipped
Array.from({ length: 3 }, (_, i) => i); // [0, 1, 2]            ← MDN: never sparse
```

🔴 **Never create holes.** Then the whole hole-behaviour table stops mattering: use
`splice` to remove an element, `Array.from({length: n}, fn)` to allocate, and
`Array.of` wherever an argument count is dynamic.

## Phase gate

You are done with this topic when you can say why `new Array(5).map(f)` does nothing,
name three ways a hole gets created, and explain what `arr.length = 0` does that
`arr = []` does not.

## Where this connects

- [Phase 4 · 03 · `undefined`, holes and brand checks](../../phase-4-objects-and-classes/03-existence-checks-and-delete/02-undefined-holes-and-brand-checks.md) — the three-state distinction, and `delete` leaving a hole
- [Phase 4 · 04 · Shallow vs deep copy](../../phase-4-objects-and-classes/04-shallow-vs-deep-copy/README.md) — `Array.from` and spread are both shallow
- [02 · Adding and removing](../README.md) — `splice`, the correct way to remove an element

---

Start → [Making arrays](./01-making-arrays.md)
