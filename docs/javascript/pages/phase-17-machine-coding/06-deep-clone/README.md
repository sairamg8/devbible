---
title: "06 · Deep clone"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`structuredClone()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/structuredClone), [Structured clone algorithm](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm), [`Object.getOwnPropertyDescriptors()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/getOwnPropertyDescriptors). Documentation-validated; **nothing was run**.

**"Write a deep clone" is a memory test, not a recursion test.** The recursion is four
lines; the interview is `Date`, `RegExp`, `Map`, `Set`, cycles, prototypes — and knowing
that the platform ships one that already does most of it.

```js
if (seen.has(value)) return seen.get(value);   // cycles AND shared references
const out = Object.create(Object.getPrototypeOf(value));
seen.set(value, out);                          // ← register BEFORE recursing
for (const key of Reflect.ownKeys(value)) out[key] = deepClone(value[key], seen);
```

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[Writing it](./01-writing-it.md)** | The full implementation and **why each of its five blocks exists** — `null` before `typeof`, the `WeakMap` for cycles and shared references, `Date`/`RegExp`'s internal state, **registering the clone before recursing**, `Reflect.ownKeys` and the prototype — what it still cannot do (accessors, descriptors, `#private`), and the full loss table for `JSON.parse(JSON.stringify(x))` |
| 2 | **[Use `structuredClone`](./02-use-structuredclone.md)** | What the built-in clones (`Map`, `Set`, `Date`, typed arrays, `Blob`, cycles), **the four things it cannot do** — functions and DOM nodes throwing `DataCloneError`, no prototype chain, no descriptors — the `transfer` option, a chooser table, and ⚠️ **why deep cloning "to be safe" is usually the wrong call** |

## The three that catch people

```js
JSON.parse(JSON.stringify({ when: new Date() }));   // a STRING, and nothing warns you
structuredClone({ fn() {} });                        // DataCloneError — thrown, not dropped
structuredClone(new Playlist());                     // plain object — the methods are gone
```

## Phase gate

You are done with this topic when you can write the clone from an empty file with cycles
handled, list what `JSON.parse(JSON.stringify())` silently destroys, name the four things
`structuredClone` cannot do — and say why a shallow copy is usually the right answer anyway.

## Where this connects

- [Phase 4 · 04 · Shallow vs deep copy](../../phase-4-objects-and-classes/04-shallow-vs-deep-copy/README.md) — when shallow is correct, and why deep defeats memoisation
- [Phase 5 · 09 · JSON](../../phase-5-built-in-library/09-json/README.md) — what `stringify` drops, and `toJSON`
- [Phase 6 · 12 · A collection class](../../phase-6-iteration-and-destructuring/12-a-collection-class/README.md) — the `toJSON`/`fromJSON` pair a cloneable class needs
- [Phase 4 · 11 · Property descriptors](../../phase-4-objects-and-classes/11-property-descriptors.md) — the metadata a clone loses
- **12 · Deep equality** *(not written yet)* — the same traversal, asking a different question

---

Start → [Writing it](./01-writing-it.md)
