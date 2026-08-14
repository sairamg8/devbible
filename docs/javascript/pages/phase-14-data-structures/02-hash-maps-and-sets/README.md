---
title: "02 · Hash maps and hash sets"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`Map`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map), [`Set`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set), [SameValueZero](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Equality_comparisons_and_sameness#same-value-zero_equality), [`Object.create()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/create) — and the specification requirement MDN quotes. Documentation-validated; **no timings**.

**`Map` and `Set` are the hash table; you should be using them.** The implementation below exists
to explain *why* lookup is O(1) average and O(n) worst — not as something to ship.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[Using the built-ins](./01-using-the-built-ins.md)** | The API and what each guarantee is worth — 🔴 **the spec requires *sublinear*, not O(1)**; insertion order as a real guarantee, and why re-`set`ting a key does **not** move it (the LRU operation is delete-then-set); **SameValueZero** in a table against `===` and `Object.is`, so `NaN` deduplicates and **objects compare by reference**; `Object.create(null)` when an object must be a dictionary; and the patterns that come up constantly — get-or-create, set algebra (and why the obvious intersection is quadratic), counting |
| 2 | **[How hashing works](./02-how-hashing-works.md)** | Hash → bucket → compare, with a working `HashMap` and the three JavaScript details that matter in it — **`Math.imul`** for 32-bit multiplication, `>>> 0` for an unsigned index, and a resize that **rehashes everything**; collisions, chaining vs open addressing, and 🔴 **where the O(1)-average/O(n)-worst split comes from**, including hash-collision denial of service; load factor and the 0.75 threshold; and **four named ways the toy differs from a real `Map`** — object keys by identity, SameValueZero, insertion order, and the spec not requiring a hash table at all |

## The three sentences to keep

1. **Sublinear is the guarantee; hash table is the implementation.** Say both.
2. **SameValueZero means objects compare by reference** — a `Set` of records does not deduplicate
   them; key by id with a `Map`.
3. **O(1) is average, not worst.** Every key in one bucket is a linear scan, which is why hash
   seeds are randomised.

## Phase gate

You are done with this topic when you can implement a hash map with chaining and resizing from an
empty file, explain load factor and why a resize must rehash, name what SameValueZero changes, and
list the ways your implementation differs from the built-in.

## Where this connects

- [Phase 13 · 03 · Choosing a structure](../../phase-13-complexity/03-choosing-a-structure/README.md) — when to reach for these at all
- [Phase 5 · 10 · `Map` vs `Object`](../../phase-5-built-in-library/10-map-vs-object/README.md) — the full comparison
- [01 · Dynamic arrays](../01-dynamic-arrays/README.md) — the same geometric-growth amortisation argument
- [03 · Frequency maps and grouping](../03-frequency-and-grouping/README.md) — the pattern these structures exist for in practice

---

Start → [01 · Using the built-ins](./01-using-the-built-ins.md)
