---
title: "01 · Destructuring"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against MDN — [Destructuring](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Destructuring), [Default parameters](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Default_parameters). Documentation-validated.

**Pattern-matching on the left-hand side of an assignment.** Array patterns match by
**position**, object patterns match by **name**, and every other rule follows from that
one distinction.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The patterns](./01-the-patterns.md)** | Renaming (objects only, and it reads backwards), **defaults applying to `undefined` but not `null`**, nesting and why the intermediate name is not bound, rest as the idiomatic "omit a key", the swap, why assigning without declaring needs parentheses, and the `TypeError` on `null`/`undefined` |
| 2 | **[In parameters and loops](./02-in-parameters-and-loops.md)** | The options object and the **`= {}` everyone forgets**, `for...of` over `Object.entries` and `Map`, `Promise.all` as the case for array patterns, **destructuring detaching methods from `this`**, the effect on `fn.length`, and when not to destructure |

## The three that bite

```js
const { c = 2 } = { c: null };   // c is null — defaults are for `undefined` ONLY
function f({ a }) {}  f();       // TypeError — needs `= {}`
const { start } = timer;  start(); // TypeError — destructuring detaches `this`
```

## Phase gate

You are done with this topic when you can say why a `null` from an API bypasses your
defaults, why `function f({ a }) {}` throws when called with no arguments, and why
destructuring an object's methods breaks them.

## Where this connects

- [Phase 3 · 02 · Parameters](../../phase-3-functions/02-parameters/README.md) — the parameter scope, and how destructuring affects `fn.length`
- [Phase 4 · 03 · `delete` and its cost](../../phase-4-objects-and-classes/03-existence-checks-and-delete/03-delete-and-its-cost.md) — rest destructuring as the right way to omit a key
- [Phase 4 · 07 · How a method loses `this`](../../phase-4-objects-and-classes/07-this-in-methods/01-how-methods-lose-this.md) — destructuring as one of the four loss modes
- [Phase 5 · 10 · `Map` vs a plain object](../../phase-5-built-in-library/10-map-vs-object/README.md) — why `for (const [k, v] of map)` needs no adapter

---

Start → [The patterns](./01-the-patterns.md)
