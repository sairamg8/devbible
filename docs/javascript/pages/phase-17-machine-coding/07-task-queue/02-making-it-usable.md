---
title: "07.2 · Making it usable"
sidebar_label: "02 · Making it usable"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`AbortController`](https://developer.mozilla.org/en-US/docs/Web/API/AbortController), [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal), [`Promise.allSettled()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/allSettled) and [`Promise.withResolvers()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/withResolvers). Documentation-validated; **nothing was run**.

The pool in [07.1](./01-the-pool.md) is the interview answer. Four additions turn it into
something you can point at a real workload: **a map helper, cancellation, an idle signal, and
a policy for what happens when things go wrong.**

## `mapWithConcurrency` — the API callers actually want

```js
async function mapWithConcurrency(items, fn, { concurrency = 5, signal } = {}) {
  const results = new Array(items.length);
  let index = 0;

  async function worker() {
    while (index < items.length) {
      if (signal?.aborted) throw signal.reason;
      const i = index++;                       // claim a slot — single-threaded, so this is atomic
      results[i] = await fn(items[i], i, signal);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}
```

This is the **worker-pool** shape rather than the queue shape, and it is simpler: `n` workers
each pull the next index until the list runs out. `index++` is safe without a lock because
JavaScript runs one task at a time — nothing can interleave between the read and the write
([Phase 7 · 02 · The event loop](../../phase-7-async/02-the-event-loop/README.md)). **Results
land at their input index**, so ordering is preserved without `Promise.all` over individual
promises.

Which shape to reach for: **the queue** when tasks arrive over time and callers each want a
promise; **the worker pool** when you have a list up front and want the results.

## Cancellation

Two levels, and both are needed:

```js
const controller = new AbortController();

await mapWithConcurrency(urls, (u, i, signal) => fetch(u, { signal }), {
  concurrency: 5,
  signal: controller.signal,
});

controller.abort();     // stops queued work AND in-flight requests
```

- **Queued work** stops because each worker checks `signal.aborted` before claiming the next
  item.
- **In-flight work** stops only if the signal is passed *into* the task — which is why `fn`
  receives it. A limiter cannot cancel work it does not understand.

`signal.reason` is what `abort()` was given (a `DOMException` named `AbortError` by default),
so re-throwing it preserves the distinction between "cancelled" and "failed"
([Phase 11 · 03 · A fetch wrapper](../../phase-11-network-storage/03-fetch-wrapper/README.md)).

## Stop-on-first-error, done properly

"Stop the batch when one task fails" is not the default and is not free:

```js
async function mapUntilError(items, fn, { concurrency = 5 } = {}) {
  const controller = new AbortController();
  try {
    return await mapWithConcurrency(items, (item, i) => fn(item, i, controller.signal), {
      concurrency,
      signal: controller.signal,
    });
  } catch (err) {
    controller.abort(err);      // stop the siblings, with the cause
    throw err;
  }
}
```

The `catch` is what turns "one worker threw" into "everyone stops". Without it, the other
workers keep pulling items long after the caller has given up — the failure mode called out
in [07.1](./01-the-pool.md).

**Three policies, and you must name one:**

| Policy | Collector | Use when |
|---|---|---|
| Fail fast, siblings continue | `Promise.all` | rare — usually an oversight |
| Fail fast **and cancel** | the wrapper above | one failure invalidates the batch |
| Collect all outcomes | `Promise.allSettled` | items are independent |

## Knowing when it is finished

For a long-lived queue that callers push into, expose the state:

```js
class TaskQueue {
  #active = 0; #queue = []; #idle = [];
  constructor(concurrency = 5) { this.concurrency = concurrency; }

  get pending() { return this.#queue.length; }
  get active() { return this.#active; }

  onIdle() {
    if (this.#active === 0 && this.#queue.length === 0) return Promise.resolve();
    const { promise, resolve } = Promise.withResolvers();
    this.#idle.push(resolve);
    return promise;
  }
  // …push/next as in 07.1, calling every #idle resolver when both counters reach zero
}
```

`Promise.withResolvers()` is the tidy way to hand a resolver to code outside the executor —
the deferred pattern, now built in
([Phase 7 · 05 · Promises](../../phase-7-async/05-promises/README.md)). `onIdle()` is what a
shutdown path, a test, or a progress indicator needs.

**Progress reporting** belongs here too, and the honest version counts settled tasks rather
than started ones:

```js
let done = 0;
await mapWithConcurrency(items, async (item) => {
  const r = await work(item);
  onProgress?.(++done, items.length);
  return r;
});
```

## Dynamic concurrency and priority

Two extensions worth knowing exist, and worth resisting until needed:

- **Dynamic limit** — raise or lower `concurrency` at runtime (back off on `429`, speed up
  when the queue is starving). Lowering it cannot pause running tasks; it only means fewer
  are started next.
- **Priority** — replace the FIFO array with a sorted structure so urgent tasks jump the
  queue. ⚠️ **Starvation is the trap**: without an ageing rule, low-priority tasks may never
  run.

Both add real complexity. **The plain FIFO limiter is the right default**, and most codebases
never need more.

## Where this belongs

- **Paginating an API** is *not* this — that is sequential by nature
  ([Phase 6 · 07](../../phase-6-iteration-and-destructuring/07-paginating-an-api/README.md)).
  A limiter parallelises across *independent* resources.
- **Uploading many files, prefetching, image processing, fanning out to a service** — this.
- **Rate limiting** is a different constraint: "at most 5 at once" is not "at most 100 per
  minute". A queue that finishes fast can still breach a rate limit
  (**15 · A rate limiter** *(not written yet)*).
- **Retries** compose *inside* the task, so a retry does not release the slot
  (**08 · Retry with backoff, jitter and an `AbortSignal`** *(not written yet)*).

## Gotchas

**Symptom:** `abort()` stopped new tasks but not the running ones
**Cause:** The signal was never passed into the task itself.
**Fix:** Give `fn` the signal and forward it to `fetch` (or whatever else accepts one).

**Symptom:** After a failure the remaining tasks kept hitting the API
**Cause:** Nothing cancelled the siblings; rejection is not cancellation.
**Fix:** Catch at the boundary and `controller.abort(err)`.

**Symptom:** A cancelled batch looked like a genuine failure in the logs
**Cause:** The `AbortError` is handled like any other error.
**Fix:** Check `signal.aborted`/`err.name === "AbortError"` and report it as a cancellation.

**Symptom:** Progress jumped straight to 100%
**Cause:** Counting task *starts* rather than settlements.
**Fix:** Increment after `await`.

**Symptom:** A high-priority queue starved the low-priority tasks
**Cause:** Strict priority ordering with no ageing.
**Fix:** Age queued tasks, or reserve a slot for the lowest priority.

**Symptom:** Lowering `concurrency` did not slow anything down
**Cause:** Tasks already running are not affected — only the next start is.
**Fix:** Expected; cancel if you need work to stop now.

**Symptom:** The queue "finished" while tasks were still running
**Cause:** The idle check looked at the pending queue only.
**Fix:** Idle means `active === 0 && pending === 0`.

## Interview questions

**★ How do you cancel a batch of limited tasks?**
An `AbortController` at the batch level: workers check `signal.aborted` before claiming the
next item, and the signal is passed *into* each task so in-flight work (a `fetch`) aborts too.
Cancelling only the queue leaves the running tasks going.

**★ How do you stop the whole batch when one task fails?**
Catch the rejection at the boundary and abort the shared controller, then re-throw. By
default a rejection stops nothing — `Promise.all` surfaces the first error while the other
tasks keep running.

**★ What is the difference between the queue and worker-pool shapes?**
The queue hands each caller a promise and starts a queued thunk whenever a slot frees — right
when tasks arrive over time. The worker pool starts `n` loops that pull from a shared list —
simpler, and right when you have the list up front and want the results in order.

**★ Is a concurrency limiter a rate limiter?**
No. "At most 5 at once" says nothing about "at most 100 per minute". A fast queue can breach
a rate limit while never exceeding its concurrency; the two are separate mechanisms and are
often needed together.

**How do you report progress accurately?**
Count settlements, not starts — increment after the `await`. Counting starts shows 100% while
`n` tasks are still running.

**Why is `index++` safe without a lock?**
JavaScript runs one task at a time, so nothing can interleave between reading and writing the
counter. `await` yields only at explicit suspension points, and the increment is not one.

---

← Prev [The pool](./01-the-pool.md) · [Topic index](./README.md)
