---
title: "11 · memoize"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`Map`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map), [`WeakMap`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap), [`JSON.stringify()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify), [`Function.prototype.apply()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/apply). Documentation-validated; **nothing was run**.

**Six lines, and the six lines are not the point.** The interview is what counts as "the same
call", and what stops the cache growing forever.

```js
function memoize(fn, keyOf = (args) => args[0]) {
  const cache = new Map();
  return function (...args) {
    const key = keyOf(args);
    if (cache.has(key)) return cache.get(key);     // `has`, not truthiness — 0/""/null are results
    const value = fn.apply(this, args);            // apply, so a method keeps its receiver
    cache.set(key, value);
    return value;
  };
}
```

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The key problem](./01-the-key-problem.md)** | Why `has` beats a truthy check, the four key strategies — hand-written, ⚠️ **`JSON.stringify` and its four failure modes**, nested `Map`s, `WeakMap` for object arguments — SameValueZero identity (including `NaN`), and **`this`: the shared-cache trap on a prototype method** |
| 2 | **[Bounding and invalidating](./02-bounding-and-invalidating.md)** | **Bounding with LRU** (and asking what the key space really is), TTL versus explicit invalidation, **async memoisation: cache the promise and delete it on rejection**, exposing `clear`/`delete`, the five situations where memoising is wrong, and how `useMemo` differs |

## The three that catch people

```js
if (cache.get(key)) …                    // ⛔ a cached 0 / "" / false recomputes every time
memoized({ id: 1 }); memoized({ id: 1 }); // ⛔ two objects, two keys — always a miss
const cache = new Map();                  // ⛔ no bound, no TTL — a leak with a good reputation
```

## Phase gate

You are done with this topic when you can write it with `this` forwarded and a caller-supplied
key function, explain why `JSON.stringify` is not a canonical key, bound it with LRU, and say
what an async memoise must do when the underlying call fails.

## Where this connects

- [09 · An LRU cache in O(1)](../09-lru-cache/README.md) — a bounded memoise *is* this cache, keyed on arguments
- [02 · `call`, `apply` and `bind`](../02-call-apply-bind/README.md) — forwarding the receiver into the memoised call
- [Phase 5 · 10 · `Map` vs object](../../phase-5-built-in-library/10-map-vs-object/README.md) — SameValueZero keys and insertion order
- [Phase 4 · 04 · Shallow vs deep copy](../../phase-4-objects-and-classes/04-shallow-vs-deep-copy/README.md) — why cloning state defeats every identity-based cache
- [03 · `debounce` and `throttle`](../03-debounce-throttle/README.md) — the other "wrap a function in a closure" family, and the same lifecycle questions

---

Start → [The key problem](./01-the-key-problem.md)
