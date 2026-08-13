---
title: "06 · `sort`"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against MDN — [`Array.prototype.sort`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort), [`toSorted`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/toSorted). Documentation-validated.

**The default sort is a string sort, and `sort` mutates the array it is called on.**
Those two facts cause almost every `sort` bug, and both ship regularly because the
output looks plausible.

```js
[1, 30, 4, 21, 100000].sort();       // [1, 100000, 21, 30, 4]  ← sorted as STRINGS
const sorted = arr.sort(fn);          // `sorted` IS `arr` — not a copy
```

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The default, and the comparator](./01-the-default-and-the-comparator.md)** | Why the default compares UTF-16 code units, the negative/zero/positive contract with `NaN` counting as equal, **MDN's five consistency requirements** and why `sort(() => Math.random() - 0.5)` breaks all of them, `localeCompare` for human text, multi-key `\|\|` chains, and decorate–sort–undecorate |
| 2 | **[Stability, mutation and `toSorted`](./02-stability-and-mutation.md)** | In-place mutation returning the same reference, **stability guaranteed since ES2019** and the two-pass multi-column trick it enables, `undefined` and holes always going to the end with the comparator never called, and the ES2023 non-mutating family |

## The four rules

1. **Always pass a comparator for numbers** — `(a, b) => a - b`.
2. **Copy before sorting** anything you did not create — `toSorted` or `[...arr].sort()`.
3. **Make the comparator total and consistent** — pure, reflexive, anti-symmetric,
   transitive. Violations do not throw; they produce implementation-defined order.
4. **`undefined` and holes go last**, always, regardless of the comparator.

## Phase gate

You are done with this topic when you can explain the `[1, 100000, 21, 30, 4]` result,
say why `sort(() => Math.random() - 0.5)` is not a shuffle, and use stability to sort a
table by two columns picked in sequence.

## Where this connects

- [05 · `reduce`](../05-reduce/README.md) — the other method with no `thisArg`
- [01 · Holes, `length` and sparse arrays](../01-array-creation-and-shape/02-holes-and-length.md) — why holes sort to the end, after `undefined`
- [Phase 4 · 04 · What shallow means](../../phase-4-objects-and-classes/04-shallow-vs-deep-copy/01-what-shallow-means.md) — why in-place sorting breaks change detection, and why a sorted copy still shares its elements

---

Start → [The default, and the comparator](./01-the-default-and-the-comparator.md)
