---
title: "12 · A collection class that iterates cleanly"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-15 against MDN — [`Set`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set), [`Map`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map), [Iteration protocols](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols) and [`JSON.stringify()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify). Documentation-validated.

**`Set` and `Map` are the specification for what a well-behaved collection looks like.**
Copy their shape and your class drops into every iterable-consuming syntax and API in the
language; invent your own and every call site has to learn it.

```js
class Playlist {
  #tracks = [];
  add(t) { this.#tracks.push(t); return this; }
  get size() { return this.#tracks.length; }        // a getter, like Set#size
  *values() { yield* this.#tracks; }
  [Symbol.iterator]() { return this.values(); }     // the default view
  toJSON() { return [...this]; }                    // or JSON.stringify gives "{}"
}

[...p];  new Set(p);  Array.from(p);  const [first] = p;   // all free
```

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The shape to copy](./01-the-shape-to-copy.md)** | What `Set` exposes and why each choice is that way — `size` as a **getter**, `values`/`keys`/`entries`, `[Symbol.iterator]` aliased to the default view, `forEach`'s `(value, key, collection)`, chainable `add` and boolean `delete`, `Symbol.toStringTag` — the full class, everything the protocol gives you free, and **when not to write the class at all** |
| 2 | **[The details that make it feel native](./02-details-that-feel-native.md)** | Views as lazy pipelines through iterator helpers, **`JSON.stringify` silently returning `{}`** and the `toJSON`/`fromJSON` pair, choosing **live versus snapshot** iteration, pure operations returning new collections, domain identity with a keying `Map`, debug output, async and disposable extensions, and a nine-point checklist |

## The three that catch people

```js
JSON.stringify(collection);        // "{}" — the iterator is never consulted
[Symbol.iterator]() { return this.#it; }   // one-shot — a stored iterator, not a fresh one
size() { … }                        // Set and Map expose `size` as a PROPERTY
```

## Phase gate

You are done with this topic when you can write a collection class that survives being
iterated twice, spread, destructured, passed to `new Set(...)` and round-tripped through
JSON — and say whether iterating it sees concurrent mutations.

## Where this connects

- [04 · The iteration protocols](../04-iteration-protocols/README.md) — the protocol this implements, and the fresh-iterator rule
- [05 · Generators](../05-generators/README.md) — `*[Symbol.iterator]()`, the one-line implementation
- [11 · Iterator helpers](../11-iterator-helpers/README.md) — what the `values()` view gets for free
- [Phase 5 · 17 · `Set`](../../phase-5-built-in-library/17-set.md) · [Phase 5 · 10 · `Map` vs object](../../phase-5-built-in-library/10-map-vs-object/README.md) — the built-ins being copied, and when to just use them
- [Phase 4 · 09 · `extends` and `super`](../../phase-4-objects-and-classes/09-extends-and-super/README.md) — why composition beats subclassing a built-in
- [Phase 5 · 09 · JSON](../../phase-5-built-in-library/09-json/README.md) — `toJSON`, and what `stringify` actually serialises

---

Start → [The shape to copy](./01-the-shape-to-copy.md)
