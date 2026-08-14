---
title: "05 · Promises"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`Promise`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise), [`then`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/then), [`catch`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/catch), [`finally`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/finally), [Using promises](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises). Documentation-validated.

**A state machine that runs forwards exactly once, and one method that reads it.**

> "A `Promise` is an object representing the eventual completion or failure of an
> asynchronous operation. Essentially, a promise is a returned object to which you attach
> callbacks, **instead of passing callbacks into a function**." — MDN

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The three states](./01-the-three-states.md)** | pending / fulfilled / rejected, **settled**, and the one-shot irreversible transition that answers the callback trust table; why **"resolved" is not "fulfilled"** and how a resolved promise can still be pending; why state and value are unreadable from JavaScript; and **thenables** — promise is a shape, not a class |
| 2 | **[`then`, `catch` and `finally`](./02-then-catch-finally.md)** | `then`'s two handlers and the guarantee that they *always* run asynchronously; the **identity and thrower defaults** that are the entire error-propagation mechanism; `catch` as `then(undefined, fn)` and the fact that handling **restores** the chain; the two errors `catch` cannot catch; and `finally`'s transparency — plus the throw that destroys the original error |
| 3 | **[Returning a value vs a promise](./03-value-vs-promise.md)** | MDN's six outcomes for a handler's return; **adoption** — a returned promise is flattened, never nested; the **forgotten `return`** and the floating promise it creates; returning from `catch` on purpose vs by accident; thenable assimilation; and how `async` functions apply the identical rule |

## The three sentences to keep

1. **The transition happens once and cannot be undone.** That is what replaces every guard a
   callback API needs.
2. **`catch` is `then(undefined, fn)`, and a missing handler is a `(x) => { throw x; }`.**
   Error propagation is not a special rule — it is the default handler doing its job.
3. **Return a value and it is wrapped; return a promise and it is adopted.** Which is why
   forgetting the `return` breaks the chain silently.

## Phase gate

You are done with this topic when you can explain why a resolved promise can still be
pending, derive rejection propagation from the default `onRejected`, say what `finally`
does and does not change, and spot the forgotten `return` in a nested chain.

## Where this connects

- [04 · Callbacks](../04-callbacks/README.md) — the contract failures each promise guarantee answers
- [03 · Microtasks vs macrotasks](../03-microtasks-vs-macrotasks/README.md) — the queue a `then` handler runs on
- [02 · The event loop](../02-the-event-loop/README.md) — why a handler can never run synchronously
- [Phase 5 · 09 · JSON](../../phase-5-built-in-library/09-json/README.md) — `response.json()` is itself a promise, the usual second link in a chain

---

Start → [01 · The three states](./01-the-three-states.md)
