---
title: "03 · Spread with iterables"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against MDN — [Spread syntax](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax). Documentation-validated.

**`...` is two different operations wearing one syntax.** In an array literal or an
argument list it consumes an **iterable**. In an object literal it copies **own
enumerable properties**. MDN's summary: *"Spread (`...`) in function/array contexts
requires iterables; object spread only needs enumerable own properties."*

```js
[...{ a: 1 }];   // TypeError — not iterable
{ ...[1, 2] };   // { 0: 1, 1: 2 }  — works, because indices are own properties
[...map];        // [[k, v], …]     — the iterator
{ ...map };      // {}              — no own enumerable properties
```

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[Two operations, one syntax](./01-two-operations-one-syntax.md)** | The iterable requirement vs property copying, MDN's `{ ...true, ..."test", ...10 }` example and why silent no-ops make the conditional-key idiom work, the full comparison table, the shallow-copy warning, and spread versus rest |
| 2 | **[Where spread earns its place](./02-where-it-earns-its-place.md)** | Replacing `apply` (including with `new`), **the argument-count `RangeError`**, merging and its replace-not-merge semantics, immutable updates and why the sharing is the point, converting iterables, and the two places spread is wrong |

## The two traps

```js
Math.max(...hugeArray);            // RangeError — each element is an ARGUMENT
let out = [];
for (const x of xs) out = [...out, f(x)];   // quadratic by construction
```

## Phase gate

You are done with this topic when you can say why `[...obj]` throws while `{...arr}`
works, why `{...map}` is `{}`, and why building an array with spread inside a loop is
quadratic.

## Where this connects

- [01 · Destructuring](../01-destructuring/README.md) — rest, the same dots pointing the other way
- [02 · Loop forms](../02-loop-forms/README.md) — `for...of` uses the same iterator protocol spread does
- [Phase 4 · 01 · Methods, accessors and spread](../../phase-4-objects-and-classes/01-object-literals/02-methods-accessors-and-spread.md) — what object spread copies, and `Object.assign` triggering setters
- [Phase 4 · 04 · Shallow vs deep copy](../../phase-4-objects-and-classes/04-shallow-vs-deep-copy/README.md) — why shallow is usually correct
- [Phase 5 · 01 · Making arrays](../../phase-5-built-in-library/01-array-creation-and-shape/01-making-arrays.md) — when `Array.from` beats spread

---

Start → [Two operations, one syntax](./01-two-operations-one-syntax.md)
