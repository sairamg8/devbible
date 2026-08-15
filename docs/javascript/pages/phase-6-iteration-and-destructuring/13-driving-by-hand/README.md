---
title: "13 · Driving an iterator by hand"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-08-15 against MDN — [Iteration protocols](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols), [`Generator.prototype.next()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Generator/next) and [`Generator.prototype.return()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Generator/return). Documentation-validated.

**`for...of` is better than a manual loop at everything except four things.** This topic is
those four — and the cleanup obligation you take on the moment you stop using it.

```js
const it = source[Symbol.iterator]();
let r;
try {
  while (!(r = it.next()).done) use(r.value);
  const completion = r.value;          // the value `for...of` throws away
} finally {
  it.return?.();                       // YOUR job now, not the loop's
}
```

The four: you need the **completion value**; you need **lookahead**; you are driving
**several iterators at once**; or the consumer is a **callback or state machine** with no
loop to put `for...of` in.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[When `for...of` is not enough](./01-when-for-of-is-not-enough.md)** | The four cases, reading the completion value, a **`Peekable` wrapper** that forwards `return()`, the frame-driven `next()`-per-tick shape, and the cleanup you now own — including what to do when `next()` throws |
| 2 | **[Multi-iterator algorithms](./02-multi-iterator-algorithms.md)** | **`zip`**, **`merge` of two sorted streams**, **`interleave`**, and **`runsOf`** (streaming group-by), the four rules they share — one iterator per source, hold the result not the value, advance only what you consumed, close everything in `finally` — and when not to hand-roll any of them |

## The three that catch people

```js
while (!it.next().done) use(it.next().value);   // consumes two per turn
for (const x of it) { } // …then reuse `it`     // exhausted; one-shot
break;                                           // manual loop = no return() = leak
```

## Phase gate

You are done with this topic — and with phase 6 — when you can read a generator's `return`
value, write a `peek()` that does not lose cleanup, and merge two sorted streams while
closing both sources on an early exit.

## Where this connects

- [04 · The iteration protocols](../04-iteration-protocols/README.md) — `next()`, `return()` and the result object being driven directly here
- [05 · Generators](../05-generators/README.md) — the completion value, and why `for...of` discards it
- [09 · Two-way generators](../09-two-way-generators/README.md) — `next(value)` and `throw()`, the other reasons to drive by hand
- [11 · Iterator helpers](../11-iterator-helpers/README.md) — `chunks`/`windows`, already built, so do not hand-roll them
- [06 · Async iterators](../06-async-iterators/README.md) — the same algorithms when every `next()` returns a promise

---

Start → [When `for...of` is not enough](./01-when-for-of-is-not-enough.md)
