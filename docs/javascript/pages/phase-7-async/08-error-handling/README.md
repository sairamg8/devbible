---
title: "08 · Error handling in async code"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [Using promises](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises), [`await`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/await), [`unhandledrejection` event](https://developer.mozilla.org/en-US/docs/Web/API/Window/unhandledrejection_event) — and the Node.js [`process`](https://nodejs.org/api/process.html) documentation. Documentation-validated.

**A rejection never crashes where it happens.** It waits inside a promise object for someone
to ask, and every bug in this topic is a version of nobody asking.

> "If a promise rejection event is not handled by any handler, it bubbles to the top of the
> call stack, and **the host** needs to surface it." — MDN

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[`try`/`catch` around `await`](./01-try-catch-around-await.md)** | Why `await` reconnects failures to the exception channel; the three things a `try` block does **not** cover; **the one case where `return await` is not redundant**; catching at the right level rather than around every `await`; and `finally` blocks with async cleanup |
| 2 | **[Rejections that vanish](./02-rejections-that-vanish.md)** | Nine ways a rejection disappears, each with its own fix — floating promises, the missing `return`, **the missing `await` that makes a function return the wrong answer**, `forEach(async …)`, the swallowing `catch`, `.then(f, g)` gaps, a terminal `.finally()`, late attachment, and the executor cases; plus the ownership rule that removes most of them |
| 3 | **[Unhandled rejections](./03-unhandled-rejections.md)** | The host-level net: the browser's `unhandledrejection`/`rejectionhandled` pair and `preventDefault()`; Node's differently-capitalised event, its **"within a turn of the event loop"** timing definition, and the default that **raises an uncaught exception**; and why an empty listener is worse than none |

## The three sentences to keep

1. **Every promise gets an owner** — `await`ed, `return`ed, or given a `.catch` in the same
   turn. If none of the three, it is floating.
2. **A missing `await` is the worst of these bugs**, because the function returns the wrong
   answer rather than merely losing an error.
3. **The global handler is an alarm, not error handling.** In Node it also decides whether
   the process lives.

## Phase gate

You are done with this topic when you can say why `try { asyncFn() }` catches nothing, name
the one place `return await` matters, list several ways a rejection vanishes silently, and
explain why an empty `unhandledRejection` listener is dangerous.

## Where this connects

- [07 · `async`/`await`](../07-async-await/README.md) — why an `async` function rejects rather than throwing
- [06 · 02 · Error propagation](../06-chaining/02-error-propagation.md) — the chain form of the same rules, and scoping a `catch` by nesting
- [05 · 02 · `then`, `catch`, `finally`](../05-promises/02-then-catch-finally.md) — the defaults that make propagation work, and the two uncatchable executor cases
- [04 · 02 · The error-first convention](../04-callbacks/02-error-first.md) — what error handling looked like before any of this

---

Start → [01 · `try`/`catch` around `await`](./01-try-catch-around-await.md)
