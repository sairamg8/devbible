---
title: "03 · Choosing a structure from the operations you need"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`Map`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map), [`Set`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set), [`Array`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array), [`WeakMap`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap) — and the V8 blog, [Elements kinds in V8](https://v8.dev/blog/elements-kinds). Documentation-validated; **no timings**.

**Choose from the operations, not from the data.** "A list of users" tells you nothing; "looked up
by id thousands of times, order never matters" tells you everything.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The decision table](./01-the-decision-table.md)** | The operation→structure mapping and the full comparison table (with *sublinear* rather than O(1), because that is what the spec requires); 🔴 **the array-as-lookup-table mistake** and its one-line fix; MDN's four reasons `Map` beats a plain object — **object keys coerce, so `obj[1]` and `obj["1"]` collide and every object key becomes `"[object Object]"`**, inherited keys, O(1) `size`, direct iteration; `Set` and **SameValueZero** (so objects dedupe by reference, not content); and `WeakMap` as the answer to the detached-DOM-node leak |
| 2 | **[When the array is right](./02-when-the-array-is-right.md)** | The cases arrays win — small n, order, positional access, iteration-only, and 🔴 **serialisation, because `JSON.stringify(new Map(…))` is `"{}"` silently**; the array-plus-derived-`Map` hybrid that most real code wants, and why **a stale index is worse than a linear scan**; packed versus holey elements and why **`delete arr[i]` is permanent damage**; the two structures people reach for too early (a sorted array under frequent inserts, a `Map` for three lookups); and the seven-point decision, ending with *"is n small and fixed? then pick whatever is clearest"* |

## The three sentences to keep

1. **The most frequent operation decides the structure.** A rare operation is allowed to be
   linear.
2. **A collection keyed at runtime is a `Map`; a record with known fields is an object** — object
   keys coerce to strings and inherit from the prototype.
3. **Most real code wants an array *and* a derived index** — and the index must be rebuilt where
   the data is written, because a stale index returns a wrong answer, not a slow one.

## Phase gate

You are done with this topic when you can pick a structure by listing operations and frequencies,
explain the object-key coercion trap, say what SameValueZero means for a `Set` of objects, justify
`WeakMap` in one sentence, and defend a plain array where n is small and fixed.

## Where this connects

- [01 · Big-O notation](../01-big-o/README.md) — where the "scan inside a loop" cost comes from
- [02 · The complexity classes you actually meet](../02-complexity-classes/README.md) — the classes these choices land you in
- [Phase 5 · 10 · `Map` vs `Object`](../../phase-5-built-in-library/10-map-vs-object/README.md) — the full comparison
- [Phase 8 · 04 · Leaks](../../phase-8-modules-errors/04-leaks/README.md) — why `WeakMap` exists
- [Phase 12 · 01 · DevTools](../../phase-12-browser-platform/01-devtools/README.md) — finding the detached nodes a `Map` kept alive

---

Start → [01 · The decision table](./01-the-decision-table.md)
