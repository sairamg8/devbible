---
title: "01 · Two pointers"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 — algorithmic material at the standard treatment; JavaScript specifics against MDN ([`Array.prototype.sort()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort), [`Array.prototype.splice()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/splice), [`String.prototype.normalize()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/normalize)). Documentation-validated; **no timings**.

**Two cursors instead of two loops.** The pattern comes in two shapes — converging from the ends,
and moving the same way at different speeds — and each has a precondition that is the real content
of the topic.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[Opposite ends](./01-opposite-ends.md)** | The converging template and 🔴 **the discard argument that makes it correct** — and why it requires sorted input; two-sum, and why 🔴 **choosing two pointers for *unsorted* two-sum is the classic wrong answer** (sorting destroys the indices asked for); three-sum with **all three duplicate skips**, plus the `[...nums].sort((a,b) => a-b)` trap that silently produces `[1, 10, 9]`; palindromes with the three JavaScript-specific caveats (code units, normalisation, locale); and the recognition rule |
| 2 | **[Same direction](./02-same-direction.md)** | The **read/write** in-place rewrite and its invariant, with `arr.length = write` as the forgotten final step; 🔴 **why `splice` inside a loop is both a correctness and a performance bug**; deduplication and the `write - 1` vs `read - 1` subtlety; **fast and slow** — middle of a list, Floyd's cycle detection with the one-line proof and the `fast?.next` guard everyone gets wrong; and merging two sorted inputs, where `<=` is stability and both drain loops are required |

## The three sentences to keep

1. **Converging pointers need sorted input** — the "discard this element" argument is what makes
   them O(n), and it only holds when the array is ordered.
2. **Unsorted two-sum is a hash-map problem**, because sorting destroys the indices the question
   asks for.
3. **Read/write pointers replace `splice` in a loop**, which skips elements *and* is quadratic.

## Phase gate

You are done with this topic when you can justify discarding a pointer's element rather than only
reciting the loop, name why unsorted two-sum is not this pattern, write the in-place filter with
its truncation step, and give the one-line reason Floyd's fast pointer must catch the slow one.

## Where this connects

- [02 · Sliding window](../02-sliding-window/README.md) — same-direction pointers with a maintained window
- [04 · Hash-map patterns](../04-hash-map-patterns/README.md) — what unsorted two-sum actually needs
- [Phase 13 · 01 · Big-O notation](../../phase-13-complexity/01-big-o/README.md) — why two nested-looking pointers are linear
- [Phase 14 · 01 · Dynamic arrays](../../phase-14-data-structures/01-dynamic-arrays/README.md) — why `splice` costs what it does

---

Start → [01 · Opposite ends](./01-opposite-ends.md)
