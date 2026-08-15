---
title: "09 · An LRU cache in O(1)"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`Map`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map), [`WeakMap`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap), [`Map.prototype.keys()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/keys), [`performance.now()`](https://developer.mozilla.org/en-US/docs/Web/API/Performance/now). Documentation-validated; **nothing was run**.

**In most languages this is a hash map plus a doubly-linked list. In JavaScript, `Map` is
already both** — it iterates in insertion order, and re-inserting a key moves it to the end.
So "most recently used" is last, and "least recently used" is `keys().next().value`.

```js
get(key) {
  if (!this.#map.has(key)) return undefined;
  const value = this.#map.get(key);
  this.#map.delete(key); this.#map.set(key, value);        // ← move to the recent end
  return value;
}
set(key, value) {
  if (this.#map.has(key)) this.#map.delete(key);            // ← without this it is FIFO, not LRU
  this.#map.set(key, value);
  if (this.#map.size > this.capacity) this.#map.delete(this.#map.keys().next().value);
}
```

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The `Map` trick](./01-the-map-trick.md)** | The twenty-line cache, **why every operation is O(1)** (including `keys().next()`), **why `delete` before `set` is mandatory**, the three design decisions in the code (`undefined` on miss, whether `has` counts as a use, evict-after-insert), and the **hash-map-plus-linked-list version with sentinel nodes** for when the question wants it |
| 2 | **[Making it real](./02-making-it-real.md)** | **TTL and lazy expiry** (and `Date.now()` going backwards), what a cache key can be — `JSON.stringify`'s instability, `WeakMap` for object identity — **the stampede and in-flight deduplication**, why a count-based capacity is a guess, LRU versus LFU/FIFO/TTL, and when not to write one at all |

## The three that catch people

```js
this.#map.set(key, value);                     // ⛔ on an existing key: updates in place → FIFO
JSON.stringify({ b, a }) !== JSON.stringify({ a, b });   // ⛔ same request, different key
ten callers, one cold key → ten fetches;        // ⛔ no in-flight map
```

## Phase gate

You are done with this topic when you can write the cache from an empty file, justify O(1) for
every operation, explain what breaks without the `delete` before `set`, and say how you would
stop ten simultaneous misses becoming ten requests.

## Where this connects

- [Phase 5 · 10 · `Map` vs object](../../phase-5-built-in-library/10-map-vs-object/README.md) — insertion order, SameValueZero keys, and why `Map` is the right store
- [Phase 6 · 04 · The iteration protocols](../../phase-6-iteration-and-destructuring/04-iteration-protocols/README.md) — why `keys().next()` is O(1) and not a scan
- [Phase 8 · 04 · Leaks](../../phase-8-modules-errors/04-leaks/README.md) — a cache holds strong references, which is the point and the risk
- [08 · Retry with backoff](../08-retry-backoff/README.md) — what should happen when a cached load fails
- **11 · `memoize`** *(not written yet)* — the same key-derivation problem, with a bounded cache underneath

---

Start → [The `Map` trick](./01-the-map-trick.md)
