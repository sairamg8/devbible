---
title: "08 · `Object.keys` / `values` / `entries` / `fromEntries`"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against MDN — [`Object.keys`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/keys), [`Object.values`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/values), [`Object.entries`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/entries), [`Object.fromEntries`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/fromEntries). Documentation-validated.

**Three methods share one definition, and the fourth undoes them.** MDN's phrase for
the first three: an object's **own, enumerable, string-keyed** properties. Those three
words decide everything they silently drop — and `Object.fromEntries` *"performs the
reverse of `Object.entries()`"*, which is how objects get the `map` and `filter` they
do not have.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[What they include and what they skip](./01-what-they-include.md)** | Own vs `for...in`, enumerable and the `false` descriptor defaults, symbols excluded, the ordering rule with MDN's `{100,2,7}` example, keys always coming back as strings, non-object coercion and the `null`/`undefined` throw, and the comparison table |
| 2 | **[Transforming objects](./02-transforming-objects.md)** | The `entries` → `map` → `fromEntries` round trip and its variants, `Map` ↔ object in one expression each, `URLSearchParams`/`FormData`/`Headers`, **the repeated-key data loss**, the seven things the round trip drops, and when to reach for something else |

## The one definition

| | Own only | Enumerable only | Strings | Symbols |
|---|---|---|---|---|
| `Object.keys` / `values` / `entries` | ✅ | ✅ | ✅ | ❌ |
| `for...in` | ❌ — walks the chain | ✅ | ✅ | ❌ |
| `Reflect.ownKeys` | ✅ | ❌ | ✅ | ✅ |

`Object.keys` and `JSON.stringify` see exactly the same set — so "what will this
serialise to?" and "what does `Object.keys` give me?" have one answer.

## Phase gate

You are done with this topic when you can say what `Object.keys` drops and why,
predict the output of `Object.entries({100:"a", 2:"b", 7:"c"})`, write a `mapValues`
in one line, and explain why converting `URLSearchParams` to an object can lose data.

## Where this connects

- [01 · Keys and enumeration order](../01-object-literals/03-keys-and-order.md) — the three-tier ordering rule these methods inherit
- [03 · `delete` and its cost](../03-existence-checks-and-delete/03-delete-and-its-cost.md) — building a new object beats deleting from one
- [04 · Shallow vs deep copy](../04-shallow-vs-deep-copy/README.md) — the round trip is shallow, and closely related to spread
- [05 · The prototype chain](../05-the-prototype-chain/README.md) — what "own" excludes, and why instance methods never appear

---

Start → [What they include and what they skip](./01-what-they-include.md)
