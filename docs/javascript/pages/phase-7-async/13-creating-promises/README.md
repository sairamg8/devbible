---
title: "13 · Creating promises"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`Promise()` constructor](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/Promise), [`Promise.resolve()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/resolve), [`Promise.reject()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/reject), [`Promise.try()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/try), [`AbortController`](https://developer.mozilla.org/en-US/docs/Web/API/AbortController) — and ECMAScript [§ Promise Objects](https://tc39.es/ecma262/multipage/control-abstraction-objects.html#sec-promise-objects), Node.js [`util.promisify`](https://nodejs.org/api/util.html#utilpromisifyoriginal). Documentation-validated; **no timings, no console blocks**.

The syllabus row is *`new Promise`, `resolve`/`reject`, and promisifying a callback API
correctly*. [05 · Promises](../05-promises/01-the-three-states.md) covered what a promise **is**;
this topic is about the one time you build one by hand.

🔴 **The constructor has exactly one legitimate use: bridging a non-promise API — a callback, an
event, a timer — into the promise world.** Everything else it is used for is the
explicit-construction anti-pattern, and every rule below exists to make that one use safe.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 01 | **[The executor, and the rules it obeys](./01-the-executor.md)** | The executor runs synchronously; settle-once; a throw rejects only while pending; the `async`-executor trap; `resolve` adopts thenables while `reject` never does; chaining cycles; the discarded return value and the silent hang; and `Promise.resolve`/`reject`/`try` instead of the constructor |
| 02 | **[Promisifying a callback API](./02-promisifying.md)** | Error-first callbacks and `util.promisify` (with `this`, sync throws and multi-value results); two-callback APIs and non-`Error` failure values; event-based APIs, the listener leak and the internal-`AbortController` fix; what cannot be promisified; and cancellation that actually cancels |

## Four facts worth carrying out of this topic

- **The executor is synchronous.** Only settlement is deferred — wrapping blocking work in
  `new Promise` does not stop it blocking.
- **`resolve` adopts, `reject` does not.** `resolve(promise)` follows it; `reject(promise)`
  rejects with the promise object as the reason.
- **`new Promise(async …)` is always a bug.** The async executor's rejection is discarded and
  the outer promise stays pending forever.
- **A wrapper owns cleanup as well as settlement.** Register listeners with `{ signal }` from an
  internal `AbortController` and abort it the moment you settle.

## Phase gate

You can wrap an event-based API in a promise that settles once, removes every listener it
added, and rejects with the signal's reason when an external `AbortSignal` fires.

## Where this connects

- [05 · Promises](../05-promises/03-value-vs-promise.md) — what returning a value versus a
  promise does, the other side of `resolve`'s adoption
- [06 · Flattening](../06-chaining/01-flattening.md) — the same adoption rule inside a chain
- [08 · Rejections that vanish](../08-error-handling/02-rejections-that-vanish.md) — why you
  always reject with an `Error`
- [11 · The explicit-construction anti-pattern](../11-anti-patterns/01-explicit-construction.md)
  — what this topic is the sanctioned exception to
- [12 · Timers](../12-timers/01-the-api.md) — the `delay(ms, { signal })` helper, the smallest
  honest use of the constructor
- **14 · Cancellation** · **21 · Thenables** · **Phase 6 · 06 · Async iterators** ·
  **Phase 17 · 14 · `promisify`** *(not written yet)*

---

Start → [01 · The executor, and the rules it obeys](./01-the-executor.md)
