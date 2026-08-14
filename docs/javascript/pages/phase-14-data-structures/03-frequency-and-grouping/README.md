---
title: "03 · Frequency maps and grouping"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`Map`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map), [`Object.groupBy()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/groupBy), [`Map.groupBy()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/groupBy), [`Intl.Segmenter`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Segmenter), [`Array.prototype.reduce()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/reduce). Documentation-validated; **no timings**.

**Count the things, then answer the question from the counts.** The syllabus calls this the single
most useful pattern in interview problems, and it is two lines. Grouping is the same pattern with
the items kept instead of tallied.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The frequency map](./01-the-frequency-map.md)** | The two-line map and why `??` not `\|\|`; what the counts then answer in one pass — duplicates, most frequent, first non-repeating — and ⚠️ **why sorting to find one maximum is the reflex to unlearn**; top-K as sort vs heap, and saying which you would use; **anagrams and the canonical-key idea** that generalises to every "group by a derived key" problem; counting characters correctly (`length` counts UTF-16 code units); and 🔴 **the `reduce`-with-object-spread version that is quadratic** |
| 2 | **[Grouping, and the built-ins](./02-grouping-built-ins.md)** | The four-line `groupBy` worth knowing; `Object.groupBy` and its two surprises — 🔴 **a null-prototype result** (so `hasOwnProperty` throws) and **keys coerced to strings**, collapsing every object into `"[object Object]"`; `Map.groupBy` for arbitrary keys, with MDN's own rule for choosing; why grouping by `Date` objects still fails; grouping into sums and `Set`s where the built-ins cannot help; and multi-level grouping, including the same quadratic trap and the composite-key alternative |

## The three sentences to keep

1. **`new Map()`, one pass, `?? 0`** — that is the whole frequency pattern.
2. **Reduce each item to a canonical key, then group by it.** Anagrams, case-insensitive matching
   and "same shape" problems are one idea.
3. **`Object.groupBy` coerces keys to strings and returns a null-prototype object.** Use
   `Map.groupBy` for anything not string-ish.

## Phase gate

You are done with this topic when you can write the frequency map and the grouping helper from an
empty file, find the most frequent element in one pass without sorting, name both `Object.groupBy`
surprises, and spot the object-spread quadratic in a counting `reduce`.

## Where this connects

- [02 · Hash maps and hash sets](../02-hash-maps-and-sets/README.md) — the structure this pattern is built on
- [Phase 13 · 01 · 02 · Reading a bound](../../phase-13-complexity/01-big-o/02-reading-a-bound.md) — the spread-in-a-reduce quadratic
- [Phase 5 · 05 · `reduce`](../../phase-5-built-in-library/05-reduce/README.md) — when `reduce` earns its place
- [Phase 1 · Values, types and coercion](../../phase-1-values-and-coercion/README.md) — code units, code points and grapheme clusters

---

Start → [01 · The frequency map](./01-the-frequency-map.md)
