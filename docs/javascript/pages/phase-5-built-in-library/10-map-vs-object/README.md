---
title: "10 · `Map` vs a plain object"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against MDN — [`Map`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map), [`WeakMap`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap), [`JSON.stringify`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify). Documentation-validated.

**Use a `Map` when the keys are data. Use an object when the keys are code.**

That one rule resolves nearly every case. The rest of this topic is why it works: six
documented differences that all favour `Map`, and three real costs that keep objects at
the edges of every program.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The six differences](./01-the-six-differences.md)** | MDN's comparison — accidental inherited keys, any key type vs strings and symbols, insertion order vs the *"complex"* object order, `size`, direct iteration, and add/remove performance — plus **SameValueZero** making `NaN` a usable key, and the API |
| 2 | **[Choosing, and what `Map` costs](./02-choosing-and-costs.md)** | The three costs — **it does not serialise**, no literal syntax, no structural typing — the decision table, `Map.groupBy` over `Object.groupBy`, and `WeakMap` in one paragraph |

## The short version

```js
const o = {};
"toString" in o;              // true — a key nobody added
o[1] === o["1"];              // the same property
Object.keys({1002:1, 17:1});  // ["17","1002"] — re-sorted

const m = new Map();
m.has("toString");            // false
m.set(1, "a").set("1", "b");  // two entries
m.set(NaN, "ok"); m.get(NaN); // "ok" — SameValueZero

JSON.stringify(m);            // '{}'  ← the one big cost
```

**The clearest tell:** if you are calling `delete` in a loop, or writing
`Object.keys(o).length` in a hot path, or reaching for `Object.create(null)` to keep
user-supplied keys safe — you wanted a `Map`.

## Phase gate

You are done with this topic when you can name three of MDN's six differences, say why
`JSON.stringify(map)` gives `{}` and how to serialise one without losing key types, and
explain when a `WeakMap` is required rather than a `Map`.

## Where this connects

- [Phase 4 · 01 · Keys and enumeration order](../../phase-4-objects-and-classes/01-object-literals/03-keys-and-order.md) — the *"complex"* object order `Map` avoids
- [Phase 4 · 03 · `delete` and its cost](../../phase-4-objects-and-classes/03-existence-checks-and-delete/03-delete-and-its-cost.md) — why frequent removal wants a `Map`
- [05 · When not to use `reduce`](../05-reduce/02-when-not-to-use-it.md) — `Map.groupBy` replacing the hand-written grouping fold
- [09 · `JSON.stringify`](../09-json/01-stringify.md) — why a `Map` serialises as `{}`

---

Start → [The six differences](./01-the-six-differences.md)
