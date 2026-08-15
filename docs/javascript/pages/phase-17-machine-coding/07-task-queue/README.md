---
title: "07 · A concurrency-limited task queue"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`Promise.all()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/all), [`Promise.allSettled()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/allSettled), [`Promise.withResolvers()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/withResolvers), [`AbortController`](https://developer.mozilla.org/en-US/docs/Web/API/AbortController). Documentation-validated; **nothing was run**.

**`Promise.all(items.map(fn))` starts everything at once.** For five items that is correct;
for five thousand it is a denial-of-service attack on your own backend. A limiter runs at
most `n` at a time and queues the rest — fifteen lines, and one of the most reused pieces of
code in this phase.

```js
const limit = createLimiter(5);
const results = await Promise.all(urls.map((u) => limit(() => fetch(u))));
//                                              ^^^^^^^^ a FUNCTION, not a promise
```

That arrow is the whole trick: a promise has already started, so a limiter handed one limits
nothing.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The pool](./01-the-pool.md)** | The full limiter and its four load-bearing details — **taking a thunk**, `Promise.resolve().then(fn)` for synchronous throws, **releasing the slot in `finally`**, and composing with `Promise.all` — start versus completion versus result order, fail-fast versus `allSettled`, why chunking is worse, and how to choose the limit |
| 2 | **[Making it usable](./02-making-it-usable.md)** | The **worker-pool `mapWithConcurrency`** and when to prefer it, **cancellation at both levels** with `AbortSignal`, doing stop-on-first-error properly, `onIdle()` with `Promise.withResolvers`, honest progress reporting, dynamic concurrency and priority (and their traps), and where this belongs versus paging, rate limiting and retries |

## The three that catch people

```js
limit(fetch(url));            // ⛔ already started — limits nothing
.then(resolve, reject);       // ⛔ slot never released on failure → deadlock
controller.abort();           // ⛔ only stops the QUEUE unless the signal reaches the task
```

## Phase gate

You are done with this topic when you can write the limiter from an empty file, explain why
it must take a function, say what happens to the other tasks when one rejects, and cancel a
batch so that in-flight requests actually stop.

## Where this connects

- [Phase 7 · 09 · Sequential vs parallel](../../phase-7-async/09-sequential-vs-parallel/README.md) — the choice this sits between
- [Phase 7 · 10 · Combinators](../../phase-7-async/10-combinators/README.md) — `all` versus `allSettled`, and what each does with a rejection
- [04 · `Promise.all`, `race`, `any`, `allSettled`](../04-promise-combinators/README.md) — the combinators, implemented from scratch
- [Phase 6 · 07 · Paginating an API](../../phase-6-iteration-and-destructuring/07-paginating-an-api/README.md) — sequential by nature; not what a limiter is for
- [Phase 11 · 03 · A fetch wrapper](../../phase-11-network-storage/03-fetch-wrapper/README.md) — where the signal and the retry policy live in real code
- **08 · Retry with backoff** · **15 · A rate limiter** *(not written yet)* — the two things this is often confused with

---

Start → [The pool](./01-the-pool.md)
