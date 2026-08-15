---
title: "23 · `WeakMap` and `WeakSet`"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-15 against MDN — [`WeakMap`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap), [`WeakSet`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakSet), [`WeakRef`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakRef), [`FinalizationRegistry`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/FinalizationRegistry), [Memory management](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Memory_management). Documentation-validated; **no timings**.

**A `Map` keyed by objects keeps every one of those objects alive for as long as the map
exists.** That is usually invisible and occasionally a serious leak — a cache keyed by DOM
nodes holds every node you ever cached, long after the elements left the page.

**The weak collections are the fix, and they buy it by giving up everything that would let
you observe the garbage collector**: no iteration, no `size`, no `clear`, no way to ask
what is still in there.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The weak collections](./01-the-weak-collections.md)** | The leak they exist to prevent; the deliberately tiny API and 🔴 **why it has no iteration or `size`**; object-only keys; the four things they are genuinely good at — per-object metadata, marking visited objects, memoising by object identity, and pre-`#` privacy; the value-retention caveat that turns a weak map back into a strong one; and the `Map` versus `WeakMap` decision |
| 2 | **[`WeakRef` and `FinalizationRegistry`](./02-weakref-and-finalizationregistry.md)** | Holding a single object weakly and `deref()`; registering a cleanup callback; 🔴 **MDN's own advice to avoid both**, and the specific reasons — unspecified collection timing, callbacks that may never run, and the `deref()` that can hand you the object one moment and `undefined` the next; plus what to reach for instead |

## The one-line version

```js
const meta = new Map();       // 🔴 holds every key alive forever
const meta = new WeakMap();   // ✅ holds nothing alive; entry disappears with the key
```

**The trade is total: you can never list what is in a `WeakMap`.** If you need to
enumerate, you need a `Map` — and then you need a deletion strategy, because nothing else
will clean it up.

## Phase gate

You are done with this topic when you can say **why a `WeakMap` cannot be iterated**, and
**why `WeakRef` is documented as something to avoid**.

## Where this connects

- [17 · `Set`](../17-set.md) and [10 · `Map` vs a plain object](../10-map-vs-object/README.md) — the strong versions, and the decision these extend
- [Phase 4 · 20 · 01 · The three older patterns](../../phase-4-objects-and-classes/20-private-state-before-hash/01-the-three-older-patterns.md) — the `WeakMap` privacy pattern that `#` replaced
- [Phase 4 · 12 · `freeze` and `seal`](../../phase-4-objects-and-classes/12-freeze-and-seal/README.md) — the other thing people reach for when they want to protect an object
- **Phase 8 · The memory model** and **Phase 8 · Finding a leak** *(another chunk's topics)* — how collection actually works, and how a leak is diagnosed

---

Start → [1 · The weak collections](./01-the-weak-collections.md)
