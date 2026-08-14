---
title: "04 · Callbacks"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [Callback function](https://developer.mozilla.org/en-US/docs/Glossary/Callback_function), [Introducing asynchronous JavaScript](https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Async_JS/Introducing), [Using promises](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises) — and the Node.js [Errors](https://nodejs.org/api/errors.html) guide. Documentation-validated.

**You write the function; someone else decides when it runs.** That single split of
responsibility explains the error-first convention, the pyramid, and every silent failure
in between.

> "A callback function is a function passed into another function as an argument, which is
> then invoked inside the outer function to complete some kind of routine or action." — MDN

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The pattern](./01-the-pattern.md)** | Callbacks are not inherently async — MDN's synchronous vs asynchronous split and the call site that cannot tell them apart; why run-to-completion forces the pattern at all; and where callbacks are still the only right tool |
| 2 | **[The error-first convention](./02-error-first.md)** | Why an async callback cannot `throw`, so the error travels as data; Node's convention and why the error goes **first**; the missing-`return` bug and the wrong stack trace it produces; why `try`/`catch` cannot reach an async callback; and the two rules for writing a bearable callback API — always async, called exactly once |
| 3 | **[Inversion of control](./03-inversion-of-control.md)** | The six ways a caller can break the contract, **all of them silent**; the "Zalgo" problem MDN names; called-twice and the `once` wrapper; never-called and why it leaves no evidence; and MDN's three promise guarantees read as answers to each failure |
| 4 | **[Callback hell](./04-callback-hell.md)** | MDN's `doStep1/2/3` pyramid and **why** nesting is forced — no return value to sequence on; the per-level error handling that is the real cost; why extracting named functions flattens without fixing; and when a callback still beats a promise |

## The two sentences to keep

1. **A callback says nothing about timing.** `map`'s callback and `readFile`'s callback are
   the same construct; only the documentation of the callee tells you which you have.
2. **Promises fixed the contract, not the indentation.** Flat chaining is a consequence of
   `then()` returning a new promise — the guarantees underneath are the point.

## Phase gate

You are done with this topic when you can say why a callback is not inherently
asynchronous, explain the error-first convention *and* the bug caused by a missing `return`,
name three ways a callback API can break its contract silently, and argue why extracting
named functions does not solve callback hell.

## Where this connects

- [01 · Synchronous vs asynchronous](../01-sync-vs-async/README.md) — run-to-completion, which is *why* the pattern exists
- [02 · The event loop](../02-the-event-loop/README.md) — "a job is completed when the stack is empty", which is why `try`/`catch` cannot reach a callback
- [03 · 02 · Using microtasks deliberately](../03-microtasks-vs-macrotasks/02-using-microtasks.md) — the "sometimes async" bug from the scheduling side
- [Phase 5 · 04 · Callbacks, holes and async](../../phase-5-built-in-library/04-array-iteration-methods/02-callbacks-holes-and-async.md) — synchronous callbacks in the array methods, and the `forEach(async …)` trap

---

Start → [01 · The pattern and the error-first convention](./01-the-pattern.md)
