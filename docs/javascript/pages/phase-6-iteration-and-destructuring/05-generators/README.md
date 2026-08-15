---
title: "05 · Generators"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`function*`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function*), [`yield`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/yield), [Iteration protocols](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols) and [`Iterator`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Iterator). Documentation-validated.

**A generator is a function that can pause in the middle and resume later with everything
still in place.** Calling it runs no code at all — MDN: it *"returns a new `Generator`
object … suspended … initially at the very beginning of the function body"* — and each
`next()` advances it to the following `yield`.

Two things fall out of that, and they are the whole topic:

```js
function* ids() { let n = 1; while (true) yield n++; }   // an infinite sequence, free to define

const bag = { items: [1, 2], *[Symbol.iterator]() { yield* this.items; } };
[...bag];                                                 // the protocol, in one line
```

It is **the shorthand for [04 · The iteration protocols](../04-iteration-protocols/README.md)**,
and it is **the way to express a sequence you do not want to build**.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[Pause and resume](./01-pause-and-resume.md)** | Why calling it runs nothing, what `next()` returns at a `yield` and at a `return`, why `for...of` discards the return value, generator objects being **one-shot iterable iterators**, every place `function*` can be written, **`yield` only working directly in the body** (the `forEach` trap), `next(value)` and its asymmetry, and `return()`/`throw()` making `finally` a reliable cleanup hook |
| 2 | **[Lazy sequences, and what they are for](./02-lazy-sequences.md)** | Pull-based evaluation and constant intermediate memory, the `map`/`filter`/`take` pipeline over an infinite source, the built-in **iterator helpers**, recursive tree traversal with `yield*`, stateful sequences without a class, and — just as important — **the five situations where a generator is the wrong tool** |

## The three that catch people

```js
function* g() { items.forEach((x) => { yield x; }); }   // SyntaxError — not directly in the body
const it = g(); [...it]; [...it];                       // second one is empty — one-shot
[...naturals()];                                        // hangs — spread is greedy, source is infinite
```

## Phase gate

You are done with this topic when you can explain why calling a generator function logs
nothing, make a class iterable with a single `*[Symbol.iterator]()`, and say what
`take(5)` over an infinite generator actually computes.

## Where this connects

- [04 · The iteration protocols](../04-iteration-protocols/README.md) — what a generator implements for you, and the hand-written version it replaces
- [02 · `for…of` vs `for…in` vs `forEach`](../02-loop-forms/README.md) — the loop that drives it, and why the callback methods cannot
- [03 · Spread with iterables](../03-spread-with-iterables/README.md) — a greedy consumer, and what that means for an unbounded generator
- **06 · Async iterators** *(not written yet)* — `async function*` and `for await…of`
- **09 · Two-way generators** · **10 · `yield*` delegation** · **11 · Iterator helpers** *(not written yet)* — the Know-tier depth on everything introduced here
- [Phase 7 · 02 · The event loop](../../phase-7-async/02-the-event-loop/README.md) — why `yield` suspends the generator and not the thread
- [Phase 3 · Functions, scope and closures](../../phase-3-functions/README.md) — the closed-over state a generator keeps alive between `next()` calls

---

Start → [Pause and resume](./01-pause-and-resume.md)
