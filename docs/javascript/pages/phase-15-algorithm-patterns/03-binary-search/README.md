---
title: "03 · Binary search"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 — algorithmic material at the standard treatment; JavaScript specifics against MDN ([`Number.MAX_SAFE_INTEGER`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/MAX_SAFE_INTEGER), [`Number.EPSILON`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/EPSILON), [`Array.prototype.sort()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort)). Documentation-validated; **no timings**.

**Everyone can describe binary search and most people cannot write it correctly under pressure.**
One template with one invariant removes the whole class of off-by-one bugs — and the second half of
the topic is the version with no array in it at all.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The template that avoids off-by-one](./01-the-template.md)** | Why it is hard — **eight combinations of three binary choices, two of which work**, and the broken ones fail only at boundaries; the half-open `[lo, hi)` template and its invariant; 🔴 **`lowerBound` and `upperBound` differing by one character**, and the table of six questions they answer — including **counting occurrences in O(log n)**; the preconditions, including 🔴 **that binary search is not automatically a win** because the enabling sort costs more than the scan; and rotated arrays, where the decision is *which half is sorted* |
| 2 | **[Searching over an answer](./02-searching-over-an-answer.md)** | Binary search with **no array** — the predicate must be **monotonic**, and that is the only requirement; the ship-capacity worked example with its bounds derived from the problem and its **O(n log(sum))** complexity; the three recognition signals and the family table; 🔴 **why `>>` must become `Math.floor` here** (answer ranges exceed 2³¹ and `>>` goes negative), what breaks above `MAX_SAFE_INTEGER`, and ⚠️ **`Math.max(...arr)` throwing `RangeError`**; plus fixed-iteration search for real-valued answers |

## The three sentences to keep

1. **One template: half-open `[lo, hi)`, `while (lo < hi)`, `hi = mid`.** Derive everything else
   from `lowerBound` and `upperBound`.
2. **Binary search over an answer needs only a monotonic predicate** — no array, and the
   complexity is O(check × log(range)).
3. **`>>` is 32-bit signed.** Safe for array indices, wrong for answer ranges.

## Phase gate

You are done with this topic when you can write `lowerBound` and `upperBound` from memory and say
what each returns for a missing value, count occurrences in O(log n), recognise an
answer-space problem from its three signals, and name the two numeric traps JavaScript adds.

## Where this connects

- [01 · Two pointers](../01-two-pointers/README.md) — the other pattern that requires sorted input
- [Phase 13 · 02 · The complexity classes](../../phase-13-complexity/02-complexity-classes/README.md) — why log n barely grows, and when the sort defeats the point
- [Phase 5 · 06 · `sort`](../../phase-5-built-in-library/06-sort/README.md) — the comparator that must match the search
- [Phase 1 · Values, types and coercion](../../phase-1-values-and-coercion/README.md) — 32-bit coercion and `MAX_SAFE_INTEGER`

---

Start → [01 · The template that avoids off-by-one](./01-the-template.md)
