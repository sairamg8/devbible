---
title: "04 · The iteration protocols"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [Iteration protocols](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols) and [`Iterator`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Iterator). Documentation-validated.

**`for...of`, spread, array destructuring, `yield*`, `new Map(...)` and `Promise.all` all
speak the same two-step protocol** — and none of them knows what an array is. Implement
one symbol-keyed method and your own object is admitted to every one of them at once.

```js
const range = {
  from: 1, to: 3,
  *[Symbol.iterator]() { for (let n = this.from; n <= this.to; n++) yield n; },
};

[...range];            // [1, 2, 3]
new Set(range);        // Set(3)
const [first] = range; // 1
```

Two protocols, and keeping them apart is the point of this topic: the **iterable**
protocol (`[Symbol.iterator]()` — *can you be iterated?*) and the **iterator** protocol
(`next()` returning `{ value, done }` — *what comes next?*).

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[Two protocols, one handshake](./01-two-protocols-one-handshake.md)** | Iterable vs iterator, the `IteratorResult` contract, `return()`/`throw()`, what is iterable already and what only looks it, every syntax and API that consumes an iterable, MDN's **three well-formedness `TypeError`s in order**, and why you must not modify a collection mid-iteration |
| 2 | **[Making your own object iterable](./02-making-your-own-object-iterable.md)** | Fresh-iterator vs iterable-iterator and the **one-shot trap**, the `function*` shorthand, putting it on a class, **`return()` as the cleanup hook that `break` and destructuring both fire**, infinite iterators and greedy consumers, `Iterator.from` and proper iterators, and how to test for iterability |

## The three things that go wrong

```js
[...{ a: 1 }];                  // TypeError — plain objects have no Symbol.iterator
[...gen]; Math.max(...gen);     // second one is empty — generators are one-shot
for (const x of it) break;      // no return() on `it` → its resource leaks silently
```

## Phase gate

You are done with this topic when you can make a class work with `for...of`, spread and
`new Set(...)` without touching any of them; say why `[Symbol.iterator]()` should return a
**new** iterator rather than `this`; and name what `break` calls on the way out of a loop.

## Where this connects

- [01 · Destructuring](../01-destructuring/README.md) — array destructuring runs the iterator, and closes it once every identifier is bound
- [02 · `for…of` vs `for…in` vs `forEach`](../02-loop-forms/README.md) — the loop that consumes this protocol, and the ones that do not
- [03 · Spread with iterables](../03-spread-with-iterables/README.md) — the same protocol, spelled `...`, and greedy about it
- **05 · Generators** *(not written yet)* — the shorthand for everything on this page
- [Phase 5 · 17 · `Set`](../../phase-5-built-in-library/17-set.md) — the built-in whose `[Symbol.iterator]()` MDN holds up as the model
- [Phase 4 · 05 · The prototype chain](../../phase-4-objects-and-classes/05-the-prototype-chain/README.md) — where a class's `[Symbol.iterator]` lives, and why helpers need `Iterator.prototype`
- [Phase 7 · 10 · Combinators](../../phase-7-async/10-combinators/README.md) — `Promise.all` takes an **iterable**, not an array

---

Start → [Two protocols, one handshake](./01-two-protocols-one-handshake.md)
