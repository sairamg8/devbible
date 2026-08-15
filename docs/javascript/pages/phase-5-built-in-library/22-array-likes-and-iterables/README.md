---
title: "22 · Array-likes and iterables"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [Indexed collections](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Indexed_collections), [Iteration protocols](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols), [`Array.from()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/from), [Spread syntax](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax), [`arguments`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/arguments), [`NodeList`](https://developer.mozilla.org/en-US/docs/Web/API/NodeList), [`HTMLCollection`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCollection). Documentation-validated; **no timings**.

**"Array-like" and "iterable" are two different contracts, and neither implies the
other.** Almost every "why can't I call `.map` on this?" and every
`TypeError: x is not iterable` comes from treating them as one idea.

| | Requires | Gives you |
|---|---|---|
| **Array-like** | a `length` property and indexed keys | `x[0]`, `x.length`, a `for` loop |
| **Iterable** | a `[Symbol.iterator]` method | `for...of`, spread, destructuring, `Promise.all` |

🔴 **Neither gives you array *methods*.** `map`, `filter` and `reduce` live on
`Array.prototype`, and nothing on this page inherits from it. That is why the answer is
almost always "convert it first" — and which converter you reach for depends on which
contract the value satisfies.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The two contracts](./01-the-two-contracts.md)** | What each contract actually requires; the grid of which built-in and DOM types satisfy which; 🔴 **a string is both — and the two views disagree**, because indexing gives UTF-16 code units while iterating gives code points; `arguments` and why it exists; and **live versus static** DOM collections, including the removal loop that never terminates |
| 2 | **[Converting correctly](./02-converting-correctly.md)** | `Array.from` versus spread versus the legacy `slice.call`, and the one case where they genuinely differ; `Array.from`'s map function and the range idiom; `arguments` versus rest parameters; how to detect what you actually have — and why `typeof x.length === "number"` accepts every function; `Array.isArray` versus `instanceof Array`; and when converting is the wrong move |

## The one-line summary

**Spread needs an iterable. `Array.from` accepts either.** That single asymmetry decides
which one you can use:

```js
[...{ length: 2 }];          // 🔴 TypeError — not iterable
Array.from({ length: 2 });   // ✅ [undefined, undefined]

[...new Set([1, 2])];        // ✅ iterable
Array.from(new Set([1, 2])); // ✅ also fine — Array.from takes both
```

## Phase gate

You are done with this topic when you can say **why `[...document.forms]` and
`[...{length: 3}]` behave differently**, and **why removing elements while looping over a
live `HTMLCollection` can never finish**.

## Where this connects

- [01 · Array creation and shape](../01-array-creation-and-shape/README.md) — `Array.from` and `Array.of` at Master depth
- [17 · `Set`](../17-set.md) and [10 · `Map` vs a plain object](../10-map-vs-object/README.md) — iterable, but not array-like
- [20 · 03 · `Segmenter`](../20-intl/03-text-collator-list-plural-segmenter.md) — the correct character count that neither string view gives you
- [Phase 1 · 10 · Strings are UTF-16](../../phase-1-values-and-coercion/10-strings-are-utf16.md) — why a string's two views disagree
- [Phase 3 · 02 · 02 · Rest, destructuring and `arguments`](../../phase-3-functions/02-parameters/02-rest-destructuring-arguments.md) — the parameter side
- [Phase 9 · 07 · 01 · The two families](../../phase-9-dom/07-traversal/01-the-two-families.md) — `NodeList` and `HTMLCollection` in the DOM
- **Phase 6 · The iteration protocols** *(another chunk's topic)* — how to make your own object iterable

---

Start → [1 · The two contracts](./01-the-two-contracts.md)
