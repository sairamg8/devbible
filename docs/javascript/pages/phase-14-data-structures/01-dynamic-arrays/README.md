---
title: "01 · Dynamic arrays"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`Array`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array), [`push()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/push), [`shift()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/shift), [`slice()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/slice), [`splice()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/splice), [`toSorted()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/toSorted), [`Array.from()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/from), [`structuredClone()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/structuredClone) — and the V8 blog, [Elements kinds in V8](https://v8.dev/blog/elements-kinds). Documentation-validated; **no timings**.

**A JavaScript array is an object with integer-like keys and a self-maintaining `length`**, which
engines implement as a contiguous block *while they can*. Both halves of that sentence produce
consequences you will hit: the cost asymmetry between the two ends, and the permanent damage a
hole does.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The real cost of each operation](./01-the-real-cost-table.md)** | The full cost table, and the asymmetry the whole topic turns on — 🔴 **`push`/`pop` cheap at the end, `shift`/`unshift` linear at the front**; what amortised O(1) actually guarantees and why geometric growth gives it; **an O(1) queue on an array**, with the two details that make it correct — nulling the vacated slot so it does not leak, and compacting so it does not grow forever; packed versus holey elements, and why `delete arr[i]` is permanent damage |
| 2 | **[Copying, slicing and the modern methods](./02-copying-and-modern-methods.md)** | The mutating/non-mutating split, with 🔴 **`sort` and `reverse` as the trap** because they mutate *and* return; the ES2023 change-by-copy methods (`toSorted`, `toSpliced`, `with`) as the new default; **every array copy is shallow** and what to do instead — `structuredClone`, or structural sharing with `with` + spread; `at(-1)`, `Array.from({length}, fn)` (and why `new Array(n).map()` is a no-op), `flatMap`, `findLast`; and array-likes, generic methods, and the **live `HTMLCollection`** that loops forever |

## The three sentences to keep

1. **Cheap at the end, linear at the front.** A queue on `push`/`shift` is O(n²) to drain; a head
   index fixes it.
2. **`delete arr[i]` does not remove an element** — it leaves a hole, `length` lies, and the array
   never returns to the fast representation.
3. **Every array copy is shallow, and `sort`/`reverse` mutate.** `toSorted` and friends are the
   default now.

## Phase gate

You are done with this topic when you can state the cost of every common array operation and
justify it, implement an O(1) queue on an array including the leak and growth fixes, and say why
`new Array(5).map(f)` returns holes.

## Where this connects

- [Phase 13 · 01 · Big-O notation](../../phase-13-complexity/01-big-o/README.md) — where these costs get counted
- [Phase 13 · 03 · Choosing a structure](../../phase-13-complexity/03-choosing-a-structure/README.md) — when an array is the right answer at all
- **05 · Queue and deque** — the full treatment of the O(1) queue *(not written yet)*
- [Phase 5 · The built-in library](../../phase-5-built-in-library/README.md) — the array methods themselves

---

Start → [01 · The real cost of each operation](./01-the-real-cost-table.md)
