---
title: "14 · promisify"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against Node.js [`util.promisify`](https://nodejs.org/api/util.html#utilpromisifyoriginal), [`util.callbackify`](https://nodejs.org/api/util.html#utilcallbackifyoriginal), [`child_process.exec`](https://nodejs.org/api/child_process.html#child_processexeccommand-options-callback) and [`lib/internal/util.js`](https://github.com/nodejs/node/blob/main/lib/internal/util.js) — and MDN [`Promise()` constructor](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/Promise), [`Symbol.for()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol/for), [`Object.getOwnPropertyDescriptors()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/getOwnPropertyDescriptors). Documentation-validated; **nothing was run**.

**Ten lines that turn a callback API into a promise API — and a convention that has to hold
for them to work.**

```js
function promisify(original) {
  return function promisified(...args) {
    return new Promise((resolve, reject) => {
      original.call(this, ...args, (err, ...values) => {
        if (err) reject(err);
        else resolve(values[0]);
      });
    });
  };
}
```

Everything interesting is in what that assumes: the callback is **last**, it is
**error-first**, and it fires **once**.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[Writing it](./01-writing-it.md)** | The five-line version and the one to write under pressure; why the wrapper must be a `function`; `if (err)` as a deliberate truthiness test; what the executor's **synchronous** call buys you and the error it **swallows**; settle-once making a double callback harmless *and invisible*; one value out and the `multiArgs` option; the **registered** `promisify.custom` symbol and why `Symbol.for` matters; preserving `name`, `length` and own property descriptors |
| 2 | **[What it cannot bridge](./02-what-it-cannot-bridge.md)** | The three-question shape test; non-error-first APIs where **failure resolves and success rejects**; the browser's two-callback shape (`getCurrentPosition`) and its hand-written adapter; many-shot callbacks that belong to an async iterator; the **hang** when the original already returns a promise (Node's DEP0174); why wrapping adds no cancellation; publishing `promisify.custom` the way `child_process.exec` does; `callbackify` and its falsy-rejection rule; and why `promisifyAll` was never shipped |

## Four facts worth carrying out of this topic

- **`if (err)` is truthiness, by design.** An API that passes `0`, `''` or `false` as its first
  callback argument reports success — which is why a non-error-first API cannot be promisified
  generically.
- **A promise settles once.** That makes a double callback harmless and a progress callback
  impossible, from the same rule.
- **`Symbol.for("nodejs.util.promisify.custom")` is registered on purpose** — two copies of a
  module, or another realm, must produce the same symbol or the hook silently misses.
- **Promisifying something that already returns a promise never settles.** No error, no timeout,
  just an `await` that does not return.

## Phase gate

You are done with this topic when you can write `promisify` from an empty file, say why the
wrapper is a `function` rather than an arrow, explain what happens when the callback fires twice
or the original throws after calling it, and name three API shapes a generic promisifier cannot
handle.

## Where this connects

- [Phase 7 · 13 · Creating promises](../../phase-7-async/13-creating-promises/README.md) — the decision layer: which shapes exist, when to wrap at all, and the listener leak. This topic is the implementation half
- [10 · A Promise from scratch](../10-promise-from-scratch/README.md) — the state machine underneath `resolve`, `reject` and settle-once
- [02 · `call`, `apply` and `bind`](../02-call-apply-bind/README.md) — how the receiver survives the wrapper
- [08 · Retry with backoff, jitter and an `AbortSignal`](../08-retry-backoff/README.md) — cancellation the bridge cannot add for you
- [Phase 6 · 06 · Async iterators](../../phase-6-iteration-and-destructuring/06-async-iterators/README.md) — where a many-shot callback should go instead

---

Start → [Writing it](./01-writing-it.md)
