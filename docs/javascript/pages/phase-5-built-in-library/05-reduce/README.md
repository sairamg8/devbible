---
title: "05 · `reduce`"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against MDN — [`Array.prototype.reduce`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/reduce), [`Object.groupBy`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/groupBy). Documentation-validated.

**`reduce` collapses an array into one value, and MDN has a section on when not to use
it.** That is unusual for a built-in, and it is the shape of this topic: the mechanism
is small, the judgement is the hard part.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The shape that stays readable](./01-the-shape.md)** | The four-argument callback and why there is no `thisArg`, MDN's `for...of` equivalence, what an omitted `initialValue` does (accumulator becomes element 0, iteration starts at 1, **`TypeError` on an empty array**), holes skipped but `undefined` not, and the shapes worth knowing |
| 2 | **[When not to use `reduce`](./02-when-not-to-use-it.md)** | MDN's **O(N²) spread-the-accumulator anti-pattern**, its table of better-named replacements (`flat`, `Object.groupBy`, `Set`, `filter`), where `reduce` genuinely wins (scalar folds, `pipe`, promise sequencing), and the readability rule |

## The two rules

```js
[].reduce((a, b) => a + b);       // TypeError — ALWAYS pass an initial value
[].reduce((a, b) => a + b, 0);    // 0

// ❌ quadratic by construction — MDN's own anti-pattern
names.reduce((all, n) => ({ ...all, [n]: (all[n] ?? 0) + 1 }), {});
```

**Inside a `reduce` the accumulator is private** — mutating it is not an immutability
violation, and spreading it every iteration is what makes the shape quadratic.

## Phase gate

You are done with this topic when you can say what happens with no initial value on an
empty array, why `[1,2,,4]` and `[1,2,undefined,4]` reduce differently, and name three
tasks that look like `reduce` but have a better-named method.

## Where this connects

- [04 · Array iteration methods](../04-array-iteration-methods/README.md) — `reduce` is in the hole-**skipping** family, and the only one with no `thisArg`
- [01 · Holes, `length` and sparse arrays](../01-array-creation-and-shape/02-holes-and-length.md) — why a hole and a stored `undefined` reduce differently
- [Phase 4 · 01 · Keys and enumeration order](../../phase-4-objects-and-classes/01-object-literals/03-keys-and-order.md) — why `Map.groupBy` usually beats `Object.groupBy`

---

Start → [The shape that stays readable](./01-the-shape.md)
