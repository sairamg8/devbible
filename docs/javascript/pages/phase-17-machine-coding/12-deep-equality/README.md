---
title: "12 · Deep equality"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`Object.is()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/is), [Equality comparisons and sameness](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Equality_comparisons_and_sameness), [`Object.hasOwn()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/hasOwn), [`Reflect.ownKeys()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Reflect/ownKeys). Documentation-validated; **nothing was run**.

**The same traversal as [06 · Deep clone](../06-deep-clone/README.md), asking a different
question** — and, like the clone, it is a memory test rather than a recursion test. There is
no structural equality in the language, which is exactly why this gets asked.

```js
if (Object.is(a, b)) return true;                            // NaN equals itself; +0 ≠ -0
if (Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) return false;
if (seen.get(a) === b) return true;                          // cycles: track PAIRS
if (keysA.length !== keysB.length) return false;             // or {a:1} equals {a:1,b:2}
```

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[Writing it](./01-writing-it.md)** | The full implementation and its seven decisions — **`Object.is` versus `===` versus SameValueZero**, the prototype check, **pair-tracking for cycles**, `Date`/`RegExp`'s internal state, key counts with `Reflect.ownKeys` and `Object.hasOwn` — plus **why `Set` and `Map` with object members are genuinely hard** (and quadratic) |
| 2 | **[What "equal" means](./02-what-equal-means.md)** | The nine-row **policy checklist** every implementation answers, the two comparisons the language already gives you, short-circuits that are always right, **the four places to not ask at all**, why `JSON.stringify` answers a different question, shallow equality as the usual right answer, and a test checklist |

## The three that catch people

```js
deepEqual({}, []);                    // ⛔ true without a prototype check
deepEqual({ a: undefined }, {});      // ⛔ true without a key-count check
deepEqual(state, nextState);          // ⛔ in a render path — immutable updates make this `===`
```

## Phase gate

You are done with this topic when you can write it with cycles and `Date`/`Map`/`Set` handled,
state your policy on `NaN`, `-0`, prototypes and `undefined` keys — and explain why a shallow
comparison is usually the better tool.

## Where this connects

- [06 · Deep clone](../06-deep-clone/README.md) — the same walk, the same special cases
- [Phase 1 · Values and coercion](../../phase-1-values-and-coercion/README.md) — `==` vs `===` vs `Object.is`, and where SameValueZero applies
- [Phase 4 · 04 · Shallow vs deep copy](../../phase-4-objects-and-classes/04-shallow-vs-deep-copy/README.md) — why immutable updates turn deep equality into `===`
- [Phase 5 · 09 · JSON](../../phase-5-built-in-library/09-json/README.md) — what a stringify comparison silently changes
- [11 · `memoize`](../11-memoize/README.md) — the same identity problem, from the caching side

---

Start → [Writing it](./01-writing-it.md)
