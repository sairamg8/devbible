---
title: "11 · Iterator helpers"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-15 against MDN — [`Iterator`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Iterator), [`Iterator.from()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Iterator/from), [`Iterator.prototype.map()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Iterator/map) and [`Iterator.prototype.take()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Iterator/take). Documentation-validated.

**The array methods, made lazy.** MDN: *"The main advantage of iterator helpers over array
methods is that they are lazy, meaning that they only produce the next value when
requested. This avoids unnecessary computation and also allows them to be used with
infinite iterators."*

```js
function* fibonacci() {
  let current = 1, next = 1;
  while (true) { yield current; [current, next] = [next, current + next]; }
}

fibonacci().map((x) => x ** 2).take(5).toArray();   // five squares, five values pulled
users.values().filter((u) => u.active).map((u) => u.name).take(10).toArray();
```

This is what makes [05.2 · Lazy sequences](../05-generators/02-lazy-sequences.md) a
built-in rather than a pattern you hand-write — and the answer to the chaining cost in
[08.2](../08-early-exit/02-the-cost-of-chaining.md).

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The helper set, and how laziness works](./01-the-helper-set.md)** | Every method split into **intermediate** (lazy, chainable) and **terminal** (forces the pipeline), how one `next()` pulls a value through the whole stack, `take`/`drop` including **`take`'s `RangeError`**, the `chunks`/`windows` pair with no array equivalent, and which terminals short-circuit |
| 2 | **[Using them well](./02-using-them-well.md)** | Which values have the helpers and why **`arr.take(3)` does not exist**, `Iterator.from()` and *proper iterators*, the helpers-versus-array-methods table, **the one-shot trap**, how they pair with generators, what they deliberately do not do (no async, no `sort`, no indexing), and closing the source through a pipeline |

## The three that catch people

```js
[1, 2, 3].take(2);                 // an array is iterable, not an iterator — use .values()
users.values().filter(f);           // nothing runs — no terminal call
const c = xs.values().map(f); c.toArray(); c.toArray();   // second is [] — one-shot
```

## Phase gate

You are done with this topic when you can say which helpers force evaluation, explain why
`arr.map(f).take(3)` fails while `arr.values().map(f).take(3)` works, and choose between an
array chain and an iterator chain for a given source.

## Where this connects

- [05 · Generators](../05-generators/README.md) — the custom sources these stages run over
- [04 · The iteration protocols](../04-iteration-protocols/README.md) — `Iterator.prototype`, proper iterators, and closing the source
- [08 · Early exit inside iteration](../08-early-exit/README.md) — the eager-chain cost these fix, and the short-circuiting terminals
- [10 · `yield*` delegation](../10-yield-delegation/README.md) — hand-written stages, and which of them `chunks()`/`windows()` now replace
- [Phase 5 · 04 · Array iteration methods](../../phase-5-built-in-library/04-array-iteration-methods/README.md) — the eager originals

---

Start → [The helper set](./01-the-helper-set.md)
