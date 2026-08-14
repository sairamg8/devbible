---
title: "15 · Normalising untrusted shapes"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [Optional chaining `?.`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Optional_chaining), [Nullish coalescing `??`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Nullish_coalescing), [Destructuring assignment](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Destructuring_assignment), [`Object.hasOwn()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/hasOwn), [`Number()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/Number), [`Array.isArray()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/isArray). Documentation-validated; **no timings**.

**Any value that came from outside the program has a shape you did not declare** — an API response,
a query string, `localStorage`, a config file, a `postMessage`. It will arrive with a field missing,
`null`, or the wrong type, and the only question is where you deal with that.

There are two answers, and the second is the one to build on. **Defend at every read**, which is how
a codebase ends up with `?.` two hundred times and no two components agreeing on what a missing
price means. Or **convert once, at the boundary**, so everything inward has fields that cannot be
absent.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[Reading a shape you did not define](./01-reading-a-shape-you-did-not-define.md)** | How far `?.` short-circuits and where it does not, `??` vs `||` and the `0`/`""`/`false` bug, why destructuring defaults miss `null`, the `SyntaxError` when the operators mix, absent vs explicitly-null for PATCH, and `JSON.parse` failing on a `200` |
| 2 | **[Normalising at the boundary](./02-normalising-at-the-boundary.md)** | The total normaliser and its four properties, why `Number("")` is `0` and `parseInt` is the wrong tool, Invalid Date, enums as allowlists, where the boundaries actually are, throw-vs-default, schema libraries, and why `as Product` checks nothing |

## Phase gate

You are done with this topic when you can say **why `config.port || 3000` is a bug** and describe
**one function that turns any payload into a value the rest of your code can rely on**.

## Where this connects

- [Phase 3 · 17 · `null`, `undefined` and the API boundary](../../phase-3-functions/17-closure-and-default-gotchas/01-null-undefined-and-the-api-boundary.md) — the same boundary seen from the parameter side
- [03 · Existence checks and `delete`](../03-existence-checks-and-delete/README.md) — `Object.hasOwn` vs `in` vs `!== undefined`
- [14 · Object creation patterns](../14-object-creation-patterns/02-object-create-and-dictionaries.md) — null-prototype dictionaries for data-keyed lookups
- [12 · `Object.freeze` and `seal`](../12-freeze-and-seal/README.md) — freezing the normalised result you share
- [Phase 1 · Values, types and coercion](../../phase-1-values-and-coercion/README.md) — why `Number("")` is `0` in the first place
- **16 · Prototype patterns to avoid** *(not written yet)* — prototype pollution, which a field-by-field normaliser prevents by construction

---

Start → [Reading a shape you did not define](./01-reading-a-shape-you-did-not-define.md)
