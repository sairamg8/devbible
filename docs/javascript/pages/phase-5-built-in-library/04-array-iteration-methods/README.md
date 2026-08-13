---
title: "04 · Array iteration methods"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against MDN — [`forEach`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/forEach), [`map`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map), [`filter`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/filter), [`find`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/find), [`every`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/every). Documentation-validated.

**Eight methods, one question: what do you want back?** They all walk the array and
call your function — they differ in what they return, whether they stop early, and
(less obviously) whether they visit holes.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[Choosing a method](./01-choosing-a-method.md)** | The returns-and-stops table, why `forEach` cannot be broken out of and what MDN names instead, `map` misused as a loop, `find` vs `filter(...)[0]`, the `findIndex` `-1` trap, **`every` returning `true` for an empty array**, and the cost of chaining |
| 2 | **[Callbacks, holes and async](./02-callbacks-holes-and-async.md)** | The three-argument callback and the `map(parseInt)` bug, **the two hole families with MDN's own counts (3 visits vs 7)**, mutating while iterating, and the async trap where MDN's example prints `0` instead of `14` |

## What each returns

| Method | Returns | Stops early? |
|---|---|---|
| `forEach` | **`undefined`** | ❌ never |
| `map` | new array, same length | ❌ |
| `filter` | new array, ≤ length | ❌ |
| `find` | first match, or `undefined` | ✅ |
| `findIndex` | index, or **`-1`** | ✅ |
| `some` / `every` | boolean | ✅ |

## Three traps in one place

```js
["1","2","3"].map(parseInt);              // [1, NaN, NaN] — index arrives as radix
[].every((x) => x.inStock);               // true — vacuously
ratings.forEach(async (r) => { … });      // promises discarded; nothing awaited
```

## Phase gate

You are done with this topic when you can say why `map(parseInt)` misbehaves, what
`every` returns for an empty array and why that is a validation bug, and how to run an
async operation over every element two different ways.

## Where this connects

- [01 · Holes, `length` and sparse arrays](../01-array-creation-and-shape/02-holes-and-length.md) — where holes come from, and why the two method families disagree
- [05 · `reduce`](../README.md) — the one iteration method with no `thisArg` and a different shape
- [Phase 4 · 07 · How a method loses `this`](../../phase-4-objects-and-classes/07-this-in-methods/01-how-methods-lose-this.md) — `thisArg`, and which methods lack it

---

Start → [Choosing a method](./01-choosing-a-method.md)
