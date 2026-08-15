---
title: "10 · `yield*` delegation"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-15 against MDN — [`yield*`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/yield*), [`function*`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function*) and [Iteration protocols](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols). Documentation-validated.

**`yield*` is a different operator from `yield`, not a variant of it.** `yield x` emits one
value; `yield* xs` hands control to another iterable and emits every value it produces —
MDN: it *"delegates iteration of the current generator to an underlying iterator."*

```js
function* g2() {
  yield 1;
  yield* [2, 3];      // any iterable: generator, array, string, Set, arguments…
  yield 4;
}

[...g2()];            // [1, 2, 3, 4]  — flat
```

Two properties do the real work, and both are easy to miss: **the expression evaluates to
the delegate's `return` value**, and **`next`, `throw` and `return` are all forwarded** to
the delegate, so cleanup and two-way communication pass straight through.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[What `yield*` delegates](./01-what-it-delegates.md)** | Delegation versus emission, the operands it accepts, **the completion value it evaluates to**, `next`/`throw`/`return` forwarding and what that means for a delegate's `finally`, why the `for…of`+`yield` rewrite is not equivalent, and `yield*` in async generators |
| 2 | **[Composing generators](./02-composing-generators.md)** | The four shapes — **recursive traversal**, splitting a long generator into named parts, lazy pipelines (including a `chunk` batcher), and lazy `concat` — how delegation keeps a two-way driver working, and the four cases where composing this way is the wrong call |

## The three that catch people

```js
yield walk(child);          // emits a generator OBJECT — the missing star
for (const x of it) yield x;  // relays values but not throw()/return() — cleanup can be skipped
const g = gen(); yield* g; yield* g;   // one-shot — the second delegation yields nothing
```

## Phase gate

You are done with this topic when you can write a recursive tree walk that a consumer can
`break` out of, say what `yield* inner()` evaluates to, and explain why replacing it with a
`for…of` loop is not a refactor.

## Where this connects

- [05 · Generators](../05-generators/README.md) — `yield`, suspension, and one-shot generator objects
- [09 · Two-way generators](../09-two-way-generators/README.md) — the `next`/`throw`/`return` channels that delegation forwards
- [04 · The iteration protocols](../04-iteration-protocols/README.md) — `*[Symbol.iterator]() { yield* this.items; }`, the one-liner this makes possible
- [07 · Paginating an API](../07-paginating-an-api/README.md) — `yield* page.items`, delegation inside an async generator
- **11 · Iterator helpers** *(not written yet)* — the built-in pipeline stages, and when not to hand-roll one

---

Start → [What `yield*` delegates](./01-what-it-delegates.md)
