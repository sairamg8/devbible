---
title: "18 · `Object` statics"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`Object`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object), [`Object.keys()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/keys), [`Object.getOwnPropertyNames()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/getOwnPropertyNames), [`Object.getOwnPropertySymbols()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/getOwnPropertySymbols), [`Reflect.ownKeys()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Reflect/ownKeys), [`Object.groupBy()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/groupBy), [`Map.groupBy()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/groupBy), [`Object.hasOwn()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/hasOwn). Documentation-validated; **no timings**.

**`Object` is not really a class you use — it is a namespace of about thirty static
functions that operate *on* objects.** They are the reflection layer of the language:
list a shape, copy it, describe it, lock it, compare it, group a list into it.

Almost every one of them has already been met somewhere in this book, because each
belongs to whatever chapter it serves — copying lives with copying, descriptors live
with descriptors. **This topic is the map**: what the whole surface is, the four
questions every one of these functions answers differently, and the two corners with
no other home — the *see-everything* family and `groupBy`.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The map, and the four axes](./01-the-map-and-the-four-axes.md)** | Why these are statics and not methods — the `Object.prototype` pollution problem they exist to dodge, and the shadowing `Object.hasOwn` was added to route around; the full inventory grouped by the job it does, with a pointer to where each one's depth lives; and the **four axes** (own vs inherited, enumerable vs not, string vs symbol, value vs descriptor) that decide, for every single one of them, what it can see |
| 2 | **[Seeing everything](./02-seeing-everything.md)** | `getOwnPropertyNames`, `getOwnPropertySymbols` and `Reflect.ownKeys` — the only way to see non-enumerable and symbol keys; what they reveal about arrays, class instances, built-ins and 🔴 **`Error`**, which is why a logged error arrives as `{}`; what symbol keys are actually for; and the own-key ordering rule every listing follows |
| 3 | **[Descriptors, and faithful copies](./03-descriptors-and-faithful-copies.md)** | The fourth axis put to work — `getOwnPropertyDescriptors` and the `Object.create` clone that keeps accessors, flags and the prototype where spread flattens all three; `defineProperties` versus `Object.assign` and the `[[Set]]`/`[[DefineOwnProperty]]` difference; why a "faithful" clone of a class with `#private` state is still broken; and where this family belongs — tooling, not feature code |
| 4 | **[Grouping, and the statics that do not exist](./04-grouping-and-the-gaps.md)** | `Object.groupBy` and `Map.groupBy` — the choice rule between them, and the two surprises in the `Object` one (a **null-prototype** result and keys **coerced to strings**); why neither one groups by `Date` and what to do instead; then the gap that sends everyone to `reduce`: there is no `Object.map`, `Object.filter`, `Object.forEach` or `Object.size`, and the `entries` round trip is what replaces them |

## The one sentence

**Every `Object` static is a different answer to "which properties count?"** — and the
four axes in [chunk 1](./01-the-map-and-the-four-axes.md) are the whole answer key.
`Object.keys` sees own, enumerable, string-keyed. `Object.getOwnPropertyNames` drops
the *enumerable* requirement. `Reflect.ownKeys` drops the *string* requirement too.
`for...in` drops the *own* requirement instead. Nothing else about them differs.

## Phase gate

You are done with this topic when you can say **why `Object.keys` is a static rather
than a method on every object**, and **which of `Object.groupBy` and `Map.groupBy` to
reach for when the grouping key is a `Date`**.

## Where this connects

- [Phase 4 · 08 · `Object.keys` / `values` / `entries` / `fromEntries`](../../phase-4-objects-and-classes/08-keys-values-entries/README.md) — the reading family, at full depth
- [Phase 4 · 04 · Shallow vs deep copy](../../phase-4-objects-and-classes/04-shallow-vs-deep-copy/README.md) — `Object.assign` and spread, and the four differences between them
- [Phase 4 · 11 · Property descriptors](../../phase-4-objects-and-classes/11-property-descriptors.md) — `defineProperty`, and the flags every static above reads
- [Phase 4 · 14 · 02 · `Object.create` and dictionaries](../../phase-4-objects-and-classes/14-object-creation-patterns/02-object-create-and-dictionaries.md) — `Object.create(null)` and what it buys
- [Phase 4 · 12 · `freeze` and `seal`](../../phase-4-objects-and-classes/12-freeze-and-seal/README.md) — the protection family
- [Phase 1 · 16 · `Object.is` and zero](../../phase-1-values-and-coercion/16-object-is-and-zero.md) — the comparison static
- [10 · `Map` vs a plain object](../10-map-vs-object/README.md) — the decision `Map.groupBy` inherits

---

Start → [1 · The map, and the four axes](./01-the-map-and-the-four-axes.md)
