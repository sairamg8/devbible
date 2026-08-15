---
title: "10 · A Promise from scratch"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`Promise`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise), [`Promise.prototype.then()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/then), [`Promise.resolve()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/resolve), [`queueMicrotask()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/queueMicrotask). Documentation-validated; **nothing was run**.

**The best cure for treating promises as magic.** The state machine is twenty lines; the
value is in the three rules around it and the resolution procedure underneath.

```js
if (this.#state !== PENDING) return;        // settle ONCE — later calls are no-ops
queueMicrotask(handle);                      // handlers are NEVER called synchronously
return new MyPromise(...);                   // then() always returns a NEW promise
```

And the distinction the second chunk is built on: **resolved ≠ fulfilled.** A promise
resolved *with another promise* is resolved and still pending — MDN's own example stays
pending for a second after being resolved.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The state machine and `then`](./01-the-state-machine.md)** | States and the one-way settle, the executor running synchronously (and a throwing executor rejecting), **why handlers must be queued as microtasks even when the value is ready**, `then` returning a new promise and MDN's four rules for its state, the **passthrough** that makes a late `.catch` work, the pending-callback list, and `catch`/`finally` derived from `then` |
| 2 | **[Resolution, thenables and the rest](./02-resolution-and-thenables.md)** | **The resolution procedure** — thenable detection, recursive adoption, the self-resolution `TypeError`, the defensive `.then` read and the `called` flag — why `resolve` unwraps and `reject` does not, the statics including `withResolvers`, and **what a real implementation adds** that this one cannot |

## The three that catch people

```js
if (settled) handler(value);          // ⛔ synchronous — ordering now depends on timing
resolve(anotherPromise);               // ⛔ stored as a value → a promise for a promise
p.then(a); p.then(b);                  // ⛔ two independent chains, not one
```

## Phase gate

You are done with this topic when you can write the state machine and `then` from an empty
file, explain why handlers are always asynchronous, describe what happens when a promise is
resolved with a thenable, and say what "resolved but not fulfilled" means.

## Where this connects

- [04 · `Promise.all`, `race`, `any`, `allSettled`](../04-promise-combinators/README.md) — the combinators, built on exactly this
- [Phase 7 · 05 · Promises](../../phase-7-async/05-promises/README.md) — the states and the API from the consumer's side
- [Phase 7 · 06 · Chaining](../../phase-7-async/06-chaining/README.md) — the passthrough rule, in practice
- [Phase 7 · 03 · Microtasks vs macrotasks](../../phase-7-async/03-microtasks-vs-macrotasks/README.md) — the queue `queueMicrotask` puts handlers on
- [Phase 6 · 09 · Two-way generators](../../phase-6-iteration-and-destructuring/09-two-way-generators/README.md) — the driver that turns `yield promise` into `await promise`
- **14 · `promisify`** *(not written yet)* — the other direction: callbacks into promises

---

Start → [The state machine and `then`](./01-the-state-machine.md)
