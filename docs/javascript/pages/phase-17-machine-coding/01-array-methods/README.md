---
title: "01 · map, filter, reduce, forEach on Array.prototype"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`Array.prototype.map()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map), [`reduce()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/reduce), [`every()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/every), [`includes()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/includes), [`flat()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/flat), [Iterative methods](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array#iterative_methods). Documentation-validated; **no timings**.

**Anyone can write a `map` that works on `[1, 2, 3]`.** The interview is about the details that
separate that from the real one — and each method in this topic hides exactly one.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The callback contract](./01-the-callback-contract.md)** | The three callback arguments and `thisArg` (and why an **arrow callback ignores it**); `Object(this)` and `length >>> 0` for genericity; 🔴 **`if (i in o)` rather than a `!== undefined` check**, because a hole and a stored `undefined` are different things; why `map` preserves length and `filter` compacts; `forEach` returning `undefined` and being unbreakable; and 🔴 **`reduce` detecting its initial value by argument count** — the single most-probed detail here — plus the exact `TypeError` on an empty array |
| 2 | **[The rest of the family](./02-the-rest-of-the-family.md)** | 🔴 **`[].every(f)` is `true`** (vacuous truth) and why short-circuiting must be a real early return; `indexOf` vs `includes` differing on **both `NaN` and holes**; `flat`, which 🔴 **removes empty slots at any depth**, and why `Array.isArray` beats `instanceof` (realms); `sort`'s stringifying default comparator and its ES2019 stability; and ⚠️ **why you should never actually ship a prototype polyfill** — with the `flatten`→`flat` rename as the reason |

## The three sentences to keep

1. **`i in o` is the hole check.** A hole is not an `undefined`, and the callback skips one but not
   the other.
2. **`reduce` detects its seed by argument count** — `reduce(f, undefined)` did pass one.
3. **`[].every(f)` is `true` and `[].some(f)` is `false`.** Vacuous truth, and it is what the pair
   is asked about.

## Phase gate

You are done with this topic when you can write `map`, `filter`, `reduce` and `forEach` from an
empty file with holes, `thisArg` and the empty-`reduce` `TypeError` handled — and name the one
edge case each of `every`, `includes` and `flat` hides.

## Where this connects

- [Phase 5 · The built-in library](../../phase-5-built-in-library/README.md) — using these methods rather than building them
- [Phase 14 · 01 · Dynamic arrays](../../phase-14-data-structures/01-dynamic-arrays/README.md) — holes, packed vs holey, and why they exist
- [02 · `call`, `apply` and `bind`](../02-call-apply-bind/README.md) — the `callbackFn.call(thisArg, …)` line, implemented
- [Phase 13 · 01 · 02 · Reading a bound](../../phase-13-complexity/01-big-o/02-reading-a-bound.md) — the cost of each of these in a loop

---

Start → [01 · The callback contract](./01-the-callback-contract.md)
