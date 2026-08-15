---
title: "16 · Concurrency limiting"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`Promise.all()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/all), [`Promise.allSettled()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/allSettled), [Connection management in HTTP/1.x](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Connection_management_in_HTTP_1.x), [Iteration protocols](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols), [`AbortSignal.throwIfAborted()`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/throwIfAborted) — and Node.js [`http.Agent` § `maxSockets`](https://nodejs.org/api/http.html#agentmaxsockets). Documentation-validated; **no timings, no console blocks**.

The syllabus row is *running N tasks at a time over a large list without exhausting the target*.

🔴 **`Promise.all` does not control concurrency — `.map` already started everything.** The
combinator decides how you *wait*; the fan-out decided how much runs. Bounding it is a separate
piece of code, and it is nine lines.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 01 | **[Why unbounded parallelism breaks](./01-why-unbounded-breaks.md)** | What gives first — per-origin connection caps, HTTP/2 stream limits, 429s, `EMFILE` and Node's unlimited default agent, memory, and the rest of the page starving; `Promise.all`'s fail-fast discarding 9 999 successes; the sequential / unbounded / bounded table; how to choose N; and what a limiter is *not* (backpressure, dedup, fairness) |
| 02 | **[The bounded pool](./02-the-bounded-pool.md)** | The batching trap and its sawtooth; the worker pool over a **shared iterator**, results by index, order preserved; fail-fast versus per-item outcomes and `AggregateError`; cancelling versus stopping early; streaming without accumulating; in-flight deduplication; and when to reach for a library |

## Four facts worth carrying out of this topic

- **The list length is data.** `Promise.all` over three known requests is fine; over "however
  many rows came back" it is a latent incident.
- **A shared iterator is the queue.** N workers doing `for…of` over one iterator each pull the
  next untaken item — that is the entire pool.
- **Batching is not pooling.** Every batch waits for its slowest member, so concurrency
  sawtooths from N down to 1.
- **Write results by index.** Completion order is not input order; `results[i] = …` keeps the
  output aligned.

## Phase gate

You can write "run N at a time" from an empty file, explain why the iterator must be created
once and shared, keep the results in input order, and make one item's failure report rather than
abort the run.

## Where this connects

- [09 · Sequential vs parallel `await`](../09-sequential-vs-parallel/README.md) — the opposite
  mistake: an accidental waterfall
- [10 · Combinators](../10-combinators/README.md) — `all` versus `allSettled`, and what happens
  to the losers
- [14 · Cancellation](../14-cancellation/01-the-model.md) — the signal threaded into every task,
  which is what makes "stop early" actually stop
- [15 · The wrapper](../15-timeouts-retries-backoff/02-the-wrapper.md) — why the retry belongs
  inside the task, so N workers do not become a burst of 3N
- [Phase 8 · 04 · The four leaks](../../phase-8-modules-errors/04-leaks/02-the-four-leaks.md) —
  the in-flight map that is never cleared
- **22 · Async work and backpressure** · **Phase 6 · 04 · The iteration protocols** ·
  **Phase 8 · 16 · `AggregateError`** · **Phase 17 · 07 · A concurrency-limited task queue**
  *(not written yet)*

---

Start → [01 · Why unbounded parallelism breaks](./01-why-unbounded-breaks.md)
