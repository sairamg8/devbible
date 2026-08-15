---
title: "09 · Two-way generators"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-15 against MDN — [`yield`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/yield), [`Generator.prototype.return()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Generator/return) and [`Generator.prototype.throw()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Generator/throw). Documentation-validated.

[05 · Generators](../05-generators/README.md) treated a generator as a source — values come
out. **`yield` is an expression, though, and something can be sent back in.** That turns a
generator into a two-way channel with three inbound methods, and the pattern that channel
enables is the one `async`/`await` is built out of.

```js
function* dialogue() {
  const name = yield "What is your name?";
  return `Hello ${name}`;
}

const d = dialogue();
d.next();        // { value: "What is your name?", done: false }
d.next("Ada");   // { value: "Hello Ada", done: true }
```

| Method | Behaves as if… | Continues? |
|---|---|---|
| `next(v)` | the suspended `yield` evaluates to `v` | yes |
| `throw(e)` | `throw e` at the suspended position | only if it catches |
| `return(v)` | `return v` at the suspended position | only if `finally` yields |

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[Talking back — `next(value)` and `throw()`](./01-talking-back.md)** | The asymmetry and the **discarded first `next()` argument**, `throw()` injecting an error at the pause point and what happens when it is not caught, the **request/response driver** where a generator yields intentions, why that makes a flow testable without mocks, and the four cases where it beats `await` |
| 2 | **[`return()`, cleanup and the coroutine idea](./02-return-and-the-coroutine-idea.md)** | `return()` semantics, **the `finally`-that-yields case where `return()` comes back `done: false`**, a `finally` overriding the completion value, the three channels side by side, and a **working promise driver that *is* `async`/`await`** — plus where two-way generators are still used directly |

## The three that catch people

```js
g.next("first");                    // discarded — no yield is suspended yet
g.throw(err);                        // if uncaught, it is thrown to the CALLER of throw()
function* g(){ try { yield 1 } finally { yield "cleanup" } }  // return() → done: FALSE
```

## Phase gate

You are done with this topic when you can explain why the first `next()`'s argument is
discarded, say what `return()` does to a generator suspended inside a `try...finally`, and
write the ten-line driver that turns `yield promise` into `await promise`.

## Where this connects

- [05 · Generators](../05-generators/README.md) — the one-way half, and the suspension model everything here builds on
- [04 · The iteration protocols](../04-iteration-protocols/README.md) — `return()` is what `break` calls; this is the same method from the other side
- [Phase 7 · 07 · `async`/`await`](../../phase-7-async/07-async-await/README.md) — the built-in driver, and why `await` does not block
- [Phase 7 · 05 · Promises](../../phase-7-async/05-promises/README.md) — what the driver resolves and rejects
- **10 · `yield*` delegation** *(not written yet)* — how `next`, `throw` and `return` pass through a delegated generator

---

Start → [Talking back](./01-talking-back.md)
