---
title: "07.1 · The pool"
sidebar_label: "01 · The pool"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`Promise.all()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/all), [`Promise.allSettled()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/allSettled), [`Promise.race()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/race) and [`Promise`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise). Documentation-validated; **nothing was run**.

`Promise.all(items.map(fn))` starts **every** task at once. For five items that is what you
want; for five thousand it opens five thousand connections, and the browser, the server or
the rate limiter will decide what happens next. **A concurrency limiter runs at most `n` at a
time and queues the rest** — and it is the most useful fifteen lines in this phase.

```js
function createLimiter(concurrency) {
  let active = 0;
  const queue = [];

  const next = () => {
    active--;
    if (queue.length) queue.shift()();          // start the longest-waiting task
  };

  return function limit(fn) {
    return new Promise((resolve, reject) => {
      const run = () => {
        active++;
        Promise.resolve()
          .then(fn)                              // fn may throw synchronously — this catches it
          .then(resolve, reject)
          .finally(next);
      };
      if (active < concurrency) run();
      else queue.push(run);
    });
  };
}

const limit = createLimiter(5);
const results = await Promise.all(urls.map((u) => limit(() => fetch(u))));
```

## The four details that make it correct

**1 · It takes a *function*, not a promise.** `limit(fetch(url))` would be wrong — the fetch
has already started by the time the limiter sees it. The task must be **deferred**: a thunk
the limiter calls when a slot frees. This is the single most common bug in a hand-written
limiter, and it is invisible because the code still runs, just without any limiting.

**2 · `Promise.resolve().then(fn)`** rather than calling `fn()` directly, so a task that
throws *synchronously* rejects the returned promise instead of throwing out of `run`
([Phase 7 · 08 · Error handling](../../phase-7-async/08-error-handling/README.md)).

**3 · `finally(next)` releases the slot on both paths.** A task that rejects must still free
its slot; forget that and the pool deadlocks after `concurrency` failures — the queue is full
of work and `active` never comes down.

**4 · `Promise.all` still composes on top.** The limiter controls *starting*; `Promise.all`
collects. Results come back **in input order** regardless of completion order, because that
is what `Promise.all` guarantees.

## Ordering: three different orders, and they are not the same

```js
const results = await Promise.all(urls.map((u) => limit(() => fetch(u))));
```

- **Start order** — the order tasks are handed to the limiter (queue is FIFO).
- **Completion order** — whatever the network decides.
- **Result order** — input order, guaranteed by `Promise.all`.

**Do not confuse the last two.** If a caller needs results as they arrive rather than all at
the end, `Promise.all` is the wrong collector — process each one in its own `.then`, or use
an async generator ([Phase 6 · 06](../../phase-6-iteration-and-destructuring/06-async-iterators/README.md)).

## Error policy is a decision, not a default

`Promise.all` rejects on the **first** rejection, and the other tasks keep running —
unwatched. That is often not what you want for a batch job:

```js
// Fail fast: the first error surfaces, the rest still run (and their results are discarded)
await Promise.all(items.map((i) => limit(() => work(i))));

// Collect everything: one entry per item, { status: "fulfilled" | "rejected" }
const settled = await Promise.allSettled(items.map((i) => limit(() => work(i))));
const failed = settled.filter((r) => r.status === "rejected");
```

**Fail fast is right when one failure invalidates the batch** — a transaction, a deploy step.
**`allSettled` is right when items are independent** — sending a hundred emails, warming a
cache. Anything else (stop *and* cancel the rest) needs explicit cancellation, which is
[07.2](./02-making-it-usable.md).

⚠️ **Neither stops the queue.** After a rejection the limiter happily starts the next queued
task, because nothing told it not to. If "stop on first error" is the requirement, say so in
the design and implement it — the default is not that.

## Why not just chunk the array?

```js
for (const batch of chunks(items, 5)) await Promise.all(batch.map(work));   // ⛔ simpler, worse
```

This is the version people write first. It runs five, **waits for all five**, then runs the
next five — so the pool sits idle from the moment the fastest task finishes until the slowest
one does. A real limiter starts the next task the instant *any* slot frees, which keeps all
`n` busy. Batching is only equivalent when every task takes the same time, which is never
true of network calls.

## Choosing the limit

There is no universal number, and **this page publishes no measurements** — the repository
does not print numbers it did not run. What you can reason about:

- **Browsers already cap connections per origin**, so a limit far above that just queues in
  the network layer instead of yours, and loses you the ability to cancel.
- **The server's rate limit is the real constraint** when there is one — match it, and handle
  `429` anyway (**08 · Retry with backoff, jitter and an `AbortSignal`** *(not written yet)*).
- **CPU-bound tasks do not benefit at all.** Nothing runs in parallel on one thread; a
  limiter over synchronous work is only a scheduler. That is Workers
  (**Phase 12 · 07 · Web Workers** *(not written yet)*).
- **Start low.** 4–8 is a sane default for network I/O; raise it only against a measurement
  from your own workload.

## Gotchas

**Symptom:** The limiter limited nothing
**Cause:** It was passed a **promise** instead of a function — the work started before the
limiter saw it.
**Fix:** `limit(() => fetch(url))`, never `limit(fetch(url))`.

**Symptom:** The queue stalled after a few failures
**Cause:** The slot is released only on success.
**Fix:** `.finally(next)` — release on both paths.

**Symptom:** A synchronously-throwing task crashed the caller
**Cause:** `fn()` called directly inside `run`.
**Fix:** `Promise.resolve().then(fn)`.

**Symptom:** Results came back in the wrong order
**Cause:** Collecting completions rather than using `Promise.all`, which preserves input
order.
**Fix:** `Promise.all` over the limited promises, or attach the index to each result.

**Symptom:** One rejection lost every other result
**Cause:** `Promise.all` rejects at the first failure.
**Fix:** `Promise.allSettled` when items are independent.

**Symptom:** Tasks kept running after the batch "failed"
**Cause:** Rejecting does not cancel anything, and the limiter keeps draining the queue.
**Fix:** Explicit cancellation — [07.2](./02-making-it-usable.md).

**Symptom:** The pool was idle half the time
**Cause:** Batching with `await Promise.all(batch)` instead of a real limiter.
**Fix:** Start the next task when any slot frees.

## Interview questions

**★ Write a function that runs at most `n` async tasks at a time.**
Keep an `active` counter and a FIFO queue of thunks. `limit(fn)` returns a promise; if
`active < n` it runs immediately, otherwise it queues. On settle — in a `finally` — decrement
and start the next queued thunk. Compose with `Promise.all` to collect.

**★ Why must the limiter take a function rather than a promise?**
A promise represents work that has **already started**. Passing one means the limiting never
happens. The limiter needs a deferred task it can start when a slot is free.

**★ What happens if a task rejects?**
Its own promise rejects, the slot is released (because release is in `finally`), and the queue
keeps draining. `Promise.all` surfaces the first rejection while the rest continue; if you
want the batch to stop, you must cancel explicitly.

**★ Why is a real limiter better than processing in chunks of `n`?**
A chunk waits for its slowest task before starting the next chunk, leaving slots idle. A
limiter starts the next task the moment any slot frees, so all `n` stay busy.

**How do you decide the concurrency limit?**
From the constraint that actually binds — the server's rate limit, or the browser's per-origin
connection cap. Start low (4–8 for network I/O) and change it against a measurement of your
own workload. For CPU-bound work, a limiter does nothing; that needs Workers.

**How do you keep the results in order?**
`Promise.all` resolves in input order regardless of completion order. If you consume
completions directly, carry the index with each result.

---

[Topic index](./README.md) · Next → [Making it usable](./02-making-it-usable.md)
