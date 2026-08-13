---
title: "03 · Existence checks and `delete`"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against MDN — [`in`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/in), [`Object.hasOwn`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/hasOwn), [`Object.prototype.hasOwnProperty`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/hasOwnProperty), [`delete`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/delete) — and V8's [Fast properties in V8](https://v8.dev/blog/fast-properties). Documentation-validated.

**"Does this object have that property?" has four answers, and they disagree on
purpose.** They differ on two axes — whether the prototype chain counts, and
whether a property holding `undefined` counts as present — and picking the wrong
one produces a bug that only shows up for one input.

Then there is `delete`, which removes an own property and does none of the four
other things people expect it to do.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[`in` and `Object.hasOwn`](./01-in-and-hasown.md)** | The prototype-chain axis: why `in` finds `toString`, where `in` is the *right* answer, why it throws on primitives, and the two documented cases where `hasOwnProperty` is broken |
| 2 | **[`undefined`, holes and brand checks](./02-undefined-holes-and-brand-checks.md)** | The `undefined` axis: `!== undefined` conflating two states, `?.`/`??` as value rather than existence checks, `??` vs `||`, the three states of an array index, and `#field in obj` |
| 3 | **[`delete` and what it really costs](./03-delete-and-its-cost.md)** | What `delete` removes and what it cannot touch, why `true` is uninformative, strict-mode `TypeError`, holes in arrays, the memory misconception, V8's documented shape cost stated precisely, and the four alternatives |

## The decision table

| Check | Own | Inherited | Exists but `undefined` |
|---|---|---|---|
| `"k" in obj` | ✅ | ✅ | ✅ |
| `Object.hasOwn(obj, "k")` | ✅ | ❌ | ✅ |
| `obj.hasOwnProperty("k")` | ✅ | ❌ | ✅ |
| `obj.k !== undefined` | ✅ | ✅ | ❌ |

**`Object.hasOwn` by default for data. `in` for feature detection. `!== undefined`
only when `undefined` and missing mean the same thing to you.**

## Phase gate

You are done with this topic when you can say why `"toString" in {}` is `true`, why
`Object.hasOwn` is recommended over `hasOwnProperty` (two distinct reasons), and
what `delete arr[3]` does to `arr.length`.

## Where this connects

- [01 · Object literals](../01-object-literals/README.md) — `Object.create(null)`, which is exactly the case `hasOwnProperty` cannot handle
- [05 · The prototype chain](../README.md) — what `in` is walking, and what `delete` unshadows
- [Phase 5 · The built-in library](../../../syllabus/02-data-and-async.md) — `Map`, which is what you wanted whenever you were about to `delete` in a loop

---

Start → [`in` and `Object.hasOwn`](./01-in-and-hasown.md)
