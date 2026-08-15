---
title: "08 · Early exit inside iteration"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`forEach`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/forEach), [`some`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/some), [`every`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/every), [`find`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/find), [`toReversed`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/toReversed) and [`Iterator`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Iterator). Documentation-validated.

**Some of JavaScript's iteration constructs can stop in the middle and some cannot**, and
the two groups look alike at the call site. MDN on the one everyone reaches for:

> "There is no way to stop or break a `forEach()` loop other than by throwing an
> exception. If you need such behavior, the `forEach()` method is the wrong tool."

```js
users.forEach((u) => { if (found) return; });   // `return` is CONTINUE — the loop runs on
for (const u of users) { if (found) break; }    // stops, and closes the iterator
const hasAdmin = users.some((u) => u.isAdmin);  // stops at the first admin
```

The second half of the topic is the same idea one level up: a chained pipeline is eager at
every stage, so **asking a narrower question is what makes the work smaller** —
`find` over `filter(...)[0]`, `some` over `filter(...).length > 0`.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[What can stop, and what cannot](./01-what-can-stop.md)** | The full table of constructs, why `return` in a `forEach` callback is `continue`, `some`/`every` as short-circuiting loops, why throwing to escape `forEach` is control flow in a costume, **`break` closing the iterator** (and what that releases), labelled breaks versus extracting a function, and `forEach` not awaiting promises |
| 2 | **[The cost of chaining](./02-the-cost-of-chaining.md)** | The four substitutions worth memorising, **`reverse()` mutating a read**, what three eager stages actually cost, lazy chaining with iterator helpers and `take`, where array methods still win, why `reduce` is not the escape hatch, and what you can reason about without a profiler |

## The three that catch people

```js
items.forEach((x) => { if (x.done) return; });   // not a break
list.reverse().find(fn);                          // mutates the caller's array
arr.filter(f).map(g).slice(0, 10);                // three passes to produce ten results
```

## Phase gate

You are done with this topic when you can name every array method that short-circuits,
explain what `break` does beyond ending the loop, and rewrite a `filter().map().slice()`
chain so the work is proportional to the output instead of the input.

## Where this connects

- [02 · `for…of` vs `for…in` vs `forEach`](../02-loop-forms/README.md) — the loop forms themselves, in depth
- [04 · The iteration protocols](../04-iteration-protocols/README.md) — what `break` calls on the way out, and why that matters for resources
- [05 · Generators](../05-generators/README.md) — laziness as the general answer to "stop when you have enough"
- [Phase 5 · 04 · Array iteration methods](../../phase-5-built-in-library/04-array-iteration-methods/README.md) — choosing between the methods, and callbacks with holes
- [Phase 5 · 05 · When not to use `reduce`](../../phase-5-built-in-library/05-reduce/02-when-not-to-use-it.md) — the quadratic spread-accumulator
- [Phase 5 · 13 · Non-mutating counterparts](../../phase-5-built-in-library/13-non-mutating-counterparts.md) — `toReversed`, `toSorted`, `with`
- [Phase 13 · Complexity and real costs](../../phase-13-complexity/README.md) — passes, allocations and what actually shows up in a profile

---

Start → [What can stop, and what cannot](./01-what-can-stop.md)
