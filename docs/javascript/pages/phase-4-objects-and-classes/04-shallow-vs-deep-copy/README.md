---
title: "04 · Shallow vs deep copy"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against MDN — [Spread syntax](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax), [`Object.assign`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/assign), [`structuredClone()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/structuredClone), [The structured clone algorithm](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm), [`JSON.stringify`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify). Documentation-validated.

**"Copy" is not one operation.** The syllabus calls this *the row that costs teams
real money*, and the reason is that a shallow copy looks completely correct in every
test that does not mutate a nested value.

Everything convenient — spread, `Object.assign`, `slice`, `Array.from` — is
**shallow**. `structuredClone` is deep and loses types. A JSON round trip is deep
and loses seven documented things. There is no option that is simply "correct"; you
pick by what you can afford to lose.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[What shallow actually means](./01-what-shallow-means.md)** | References vs values, the table of shallow operations, the four differences between spread and `Object.assign`, why the prototype is not copied, and **why shallow is usually the right answer** |
| 2 | **[`structuredClone`](./02-structuredclone.md)** | Cycles rebuilt correctly, the supported-type list, the four things it silently loses, what throws `DataCloneError` and why throwing is better, and the `transfer` option |
| 3 | **[JSON round trips and hand-written clones](./03-json-and-hand-written.md)** | The seven documented JSON losses, when a round trip is still fine, and a deep clone with a `WeakMap` visited-map — plus what that clone still gets wrong |

## Pick by what you can lose

| Need | Use |
|---|---|
| Update one path of immutable state | **spread**, copying only the path that changed |
| Independent copy of plain data, possibly cyclic | **`structuredClone`** |
| Data that is already JSON-shaped, no cycles | JSON round trip is fine, `structuredClone` is better |
| Class instances with methods | neither — give the class a `clone()` method |
| Preserve descriptors / frozen-ness | `Object.create` + `Object.getOwnPropertyDescriptors` |
| Move a large `ArrayBuffer` | `structuredClone(v, { transfer: [buf] })` |

**The default is not "deep clone to be safe."** Immutable update patterns share
untouched branches deliberately — that reference sharing is what makes
`prev === next` a valid change check and what makes memoisation work at all.

## Phase gate

You are done with this topic when you can say why `{ ...instance }` loses methods,
name three things `structuredClone` loses and two it throws on, and write a deep
clone that terminates on a cyclic object.

## Where this connects

- [01 · Object literals](../01-object-literals/README.md) — what spread copies, and `Object.assign` triggering setters
- [03 · Existence checks and `delete`](../03-existence-checks-and-delete/README.md) — rest destructuring as the way to build an object *without* a key
- [05 · The prototype chain](../README.md) — the thing every copy operation here drops

---

Start → [What shallow actually means](./01-what-shallow-means.md)
