---
title: "03 · Deciding to use one, and the patterns"
sidebar_label: "03 · Deciding and patterns"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [Using Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers), [`Worker.terminate()`](https://developer.mozilla.org/en-US/docs/Web/API/Worker/terminate), [`WorkerGlobalScope.close()`](https://developer.mozilla.org/en-US/docs/Web/API/WorkerGlobalScope/close), [`PerformanceLongTaskTiming`](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceLongTaskTiming), [`Scheduler.postTask()`](https://developer.mozilla.org/en-US/docs/Web/API/Scheduler/postTask), [`OffscreenCanvas`](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas), [WebAssembly](https://developer.mozilla.org/en-US/docs/WebAssembly). Documentation-validated; **no timings and no console output**.

A worker is not a performance trick you sprinkle on. It buys **parallelism at the price of a copy
and a round trip**, and that trade is good for a narrow, recognisable class of work. Knowing
which class is the actual skill.

## 🔴 The decision

**Move it to a worker when all three hold:**

1. The work is **CPU-bound** — it burns the thread, rather than waiting on the network.
2. It takes **long enough to matter** — comfortably more than the 50 ms a long task is defined
   at ([06 · 03 · The metrics](../06-performanceobserver/03-the-metrics.md)).
3. Its **input and output are small relative to the work**, or can be transferred.

| Good candidates | Why |
|---|---|
| Parsing or transforming a large JSON/CSV payload | pure CPU; input can be fetched *inside* the worker |
| Image processing, filters, resizing before upload | pixels transfer as an `ArrayBuffer` |
| Client-side search indexing, fuzzy matching over thousands of rows | index built once, queries are tiny |
| Diffing, compression, hashing, encryption | small in, small out |
| WebAssembly of any weight | the reason WASM threads exist |
| Continuous canvas rendering | `OffscreenCanvas` puts the drawing there too |

| ❌ Bad candidates | Why |
|---|---|
| Anything touching the DOM | not available, by design |
| Work measured in a few milliseconds | the round trip costs more than the work |
| Passing a huge object back and forth per keystroke | two clones per keystroke |
| Waiting on `fetch` | already asynchronous — a worker adds nothing |
| Making a slow render fast | the render is the main thread's job; fix the render |

⚠️ **A worker does not make anything faster.** It makes the *main thread* free. Total work goes
up, by the cost of two copies and two task hops. What improves is responsiveness — INP,
interaction latency, whether the page answers a click while the work runs.

**Before reaching for one, check whether the cheaper tool fits:** breaking the work into chunks
that yield to the browser (`scheduler.yield`, `scheduler.postTask`, `requestIdleCallback` —
**14 · Yielding to the main thread** *(not written yet)*), doing less work (a better algorithm, an
index, pagination), or doing it on the server (**13 · What belongs on the server** *(not written
yet)*). A worker is the answer when the work is genuinely necessary, genuinely client-side and
genuinely long.

## Proving it, not guessing it

The honest sequence is: **observe a long task → attribute it → move that specific work → observe
that the long tasks are gone**.

```js
new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) report('longtask', Math.round(entry.duration));
}).observe({ type: 'longtask', buffered: true });
```

`long-animation-frame` entries name the script that caused a slow frame, which turns "the page
feels slow" into a filename ([06 · 03](../06-performanceobserver/03-the-metrics.md)). The phase
gate for this phase is exactly this loop: move a 500 ms computation into a worker, keep the page
responsive, and see it in the panel.

## The worker pool

Spinning up a worker is not free — it is a new realm, a new script parse, a new heap. For
repeated jobs, create them once and reuse them.

```js
class WorkerPool {
  #idle = []; #queue = [];
  constructor(url, size = navigator.hardwareConcurrency ?? 4) {
    for (let i = 0; i < size; i++) this.#idle.push(new Worker(url, { type: 'module' }));
  }
  run(payload, transfer = []) {
    return new Promise((resolve, reject) => {
      const job = { payload, transfer, resolve, reject };
      const worker = this.#idle.pop();
      worker ? this.#dispatch(worker, job) : this.#queue.push(job);
    });
  }
  #dispatch(worker, job) {
    worker.onmessage = ({ data }) => {
      data.ok ? job.resolve(data.value) : job.reject(new Error(data.error));
      const next = this.#queue.shift();
      next ? this.#dispatch(worker, next) : this.#idle.push(worker);
    };
    worker.onerror = (e) => { job.reject(new Error(e.message)); worker.terminate(); };
    worker.postMessage(job.payload, job.transfer);
  }
  destroy() { this.#idle.forEach((w) => w.terminate()); }
}
```

🔴 **`navigator.hardwareConcurrency` is a hint, not a budget.** It reports logical cores and says
nothing about what else the machine is doing; a phone reporting 8 does not want 8 busy threads.
Cap it — four is a sensible ceiling for most work, and one worker is usually the right answer.

**A pool needs a `destroy()`** that terminates every worker, called from the same teardown that
disposes the feature.

## Cancellation, properly

Three levels, and only the last is real:

| Approach | Stops the work? |
|---|---|
| Drop the pending promise | ❌ the worker keeps computing |
| A "cancel" message the worker checks between chunks | ✅ if the work is chunked |
| `worker.terminate()` | ✅ always, immediately |

```js
// inside the worker: cancellable because the loop yields to its own message queue
let cancelled = false;
self.onmessage = (e) => { if (e.data.type === 'cancel') cancelled = true; else run(e.data); };

async function run(job) {
  for (let i = 0; i < job.items.length; i++) {
    if (cancelled) return self.postMessage({ id: job.id, ok: false, error: 'cancelled' });
    if (i % 1000 === 0) await new Promise((r) => setTimeout(r, 0));  // let messages arrive
    process(job.items[i]);
  }
}
```

⚠️ **A tight synchronous loop in a worker never sees the cancel message** — messages are tasks,
and the worker's event loop is as blocked as any other. Either yield periodically, as above, or
accept that `terminate()` (and creating a fresh worker afterwards) is the cancellation story.

**`terminate()` then replace** is a perfectly respectable pattern for search-as-you-type: kill the
in-flight worker on each new query, start a new one. It costs a worker start-up, and it is
simpler than making every algorithm cooperatively cancellable.

## Keeping the worker's code sane

- **One entry point, a discriminated message type.** `{ type: 'index' | 'query' | 'cancel' }` and
  a `switch`, not five listeners.
- **Pure functions in shared modules, imported by both sides.** A module worker can import the
  same code the page does, so the algorithm is testable in Node without a worker at all.
- **The worker owns its data.** If the worker holds the search index, the page never posts it —
  the page posts a query and receives ids. This is the single biggest lever on message cost.
- **Feature-detect** in code that also runs server-side: `typeof Worker !== 'undefined'`, and a
  synchronous fallback path that is exercised by tests.

## Gotchas

**Symptom: moving work to a worker made no measurable difference.**
Cause — the work was not the bottleneck, or it was network-bound.
Fix — measure first with `longtask`/LoAF; parallelising a wait achieves nothing.

**Symptom: the UI is still janky although the computation is in a worker.**
Cause — the payload. Serialisation happens on the calling thread, so posting a huge object blocks
exactly the thread you were protecting.
Fix — transfer buffers, keep the data inside the worker, return summaries.

**Symptom: memory climbs as the user types.**
Cause — a worker created per query and never terminated.
Fix — a pool, or terminate the previous worker before starting the next.

**Symptom: the cancel message is ignored.**
Cause — the worker is inside a synchronous loop; messages are tasks and cannot interrupt it.
Fix — yield between chunks, or `terminate()`.

**Symptom: the app spawns a worker per core and gets slower on mobile.**
Cause — `hardwareConcurrency` treated as a target.
Fix — cap the pool; measure; most work wants one worker.

**Symptom: tests fail with `Worker is not defined`.**
Cause — no `Worker` in the Node test environment.
Fix — import the algorithm module directly and test it without a worker; feature-detect at the
call site.

## Interview questions

**★ When is a Web Worker the right tool?**
When work is CPU-bound, long enough to cause a long task, and has a small input/output relative to
its cost — parsing, image processing, indexing, crypto, WASM. Not for network waits, not for tiny
tasks, and never for DOM work.

**★ Does a worker make the application faster?**
No — it makes the main thread free. Total work increases by the copies and the round trip; what
improves is responsiveness, which is what INP measures and what the user feels.

**★ How do you decide how many workers to run?**
Start with one. `navigator.hardwareConcurrency` is a hint about logical cores, not a licence to
saturate them, and on a phone that is a good way to make everything slower. Pool and cap.

**★ How do you cancel work in a worker?**
`terminate()` is the only guaranteed cancellation. Cooperative cancellation works only if the
worker's loop yields often enough for a message to be delivered — a tight synchronous loop cannot
be interrupted.

**★ How would you keep the message cost down for a search-as-you-type feature?**
Build and keep the index **inside** the worker. The page posts a query string and receives a list
of ids; nothing large ever crosses. That, rather than the parallelism, is what makes it fast.

**Where does `OffscreenCanvas` fit?**
It transfers control of a canvas to a worker so drawing happens off the main thread — the one case
where a worker's output is pixels rather than data.

---

← [02 · The message boundary](./02-the-message-boundary.md) · [Topic index](./README.md)
