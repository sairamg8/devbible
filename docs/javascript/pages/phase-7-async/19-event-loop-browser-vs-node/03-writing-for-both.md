---
title: "03 · Writing code that survives both"
sidebar_label: "03 · Writing for both"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against the [HTML Standard § Event loops](https://html.spec.whatwg.org/multipage/webappapis.html#event-loop-processing-model), ECMAScript [§ Jobs and Agents](https://tc39.es/ecma262/multipage/executable-code-and-execution-contexts.html#sec-jobs), the Node.js guide [*The Node.js Event Loop*](https://nodejs.org/en/learn/asynchronous-work/event-loop-timers-and-nexttick) — and MDN [`queueMicrotask()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/queueMicrotask), [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal), [`structuredClone()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/structuredClone). Documentation-validated; **no timings, no console blocks**.

Most code that runs in both places — a shared client, a validation library, an SDK — does not
need to know which loop it is on. The trick is knowing exactly which guarantees are shared, so
you can lean on those and nothing else.

## What both runtimes guarantee

| Guarantee | Why it is safe to rely on |
|---|---|
| **One call stack; a task runs to completion** | no preemption anywhere, so no data races on shared state |
| **Microtasks drain before the loop continues** | the promise job queue is the **language's**, not the host's |
| **`.then`, `await` and `queueMicrotask` are microtasks** | same queue, same ordering, both runtimes |
| **A promise callback is never synchronous** | `Promise.resolve().then(fn)` always defers |
| **Blocking blocks everything** | one thread; the loop cannot take it back |

🔴 **The single portable ordering fact: microtasks before tasks.** ECMAScript owns promise jobs;
the host owns everything else. That is why the drain order in
[03 · The drain order](../03-microtasks-vs-macrotasks/01-the-drain-order.md) holds in both, and
why nothing about phases or frames does.

## What is not portable

| Not portable | Where it exists |
|---|---|
| `setImmediate`, `process.nextTick` | **Node only** |
| `requestAnimationFrame`, `requestIdleCallback`, rendering | **browser only** |
| Order of `setTimeout(fn, 0)` versus I/O | Node phase-dependent; meaningless in a browser |
| Ordering *between* task queues | browser-chosen |
| Timer throttling in a background tab | browser only |
| The 4 ms nesting clamp | browser (Node clamps below 1 ms instead) |
| Thread-pool sizing (`UV_THREADPOOL_SIZE`) | Node only |

⚠️ **`setTimeout(fn, 0)` is the only *task* primitive both runtimes have** — which is why it is
the portable yield, despite the clamp making it a poor one in the browser.

## Write to the shared surface

```js
// ✅ portable
queueMicrotask(fn);                 // both
setTimeout(fn, 0);                  // both — the portable task
await Promise.resolve();            // both
new AbortController();              // both
structuredClone(value);             // both
fetch(url, { signal });             // both
```

**When the runtimes genuinely differ, branch on the capability rather than the runtime.**

```js
// ✅ feature detection
const yieldToLoop =
  typeof setImmediate === 'function' ? () => new Promise((r) => setImmediate(r))
  : globalThis.scheduler?.yield     ? () => scheduler.yield()
  : () => new Promise((r) => setTimeout(r, 0));

// ❌ runtime sniffing — wrong in a bundler, a worker, an edge runtime, a test env
const isNode = typeof window === 'undefined';
```

🔴 **`typeof window === 'undefined'` is not a Node check.** It is true in a Web Worker, a service
worker and several edge runtimes, all of which have no `setImmediate`. Detect the function you
are about to call.

## The three portable disciplines

**1 · Never block, anywhere.** A long synchronous task is the same bug in both runtimes; only the
blast radius differs — one tab, or every request on the process. Chunk it, or move it off-thread
(a Worker in the browser, `worker_threads` in Node).

**2 · Yield with a task, not a microtask.** `await` on a resolved value does not let the loop
advance ([18 · Microtask hazards](../18-queuemicrotask/02-microtask-hazards.md)). If a loop must
be interruptible, it needs a real task boundary — `setTimeout(fn, 0)` portably, `setImmediate` or
`scheduler.yield()` where available.

**3 · Never encode ordering you did not ask for.** If a test only passes with a
`setTimeout(fn, 0)` in it, the code has an ordering dependency that no specification guarantees —
and it will differ across runtimes, versions and machines. Await the actual signal
([17 · The stale response](../17-race-conditions-ui/01-the-stale-response.md)).

## Testing async code across both

**Await the promise the code exposes, not the queue.** A test that "flushes microtasks" *n*
times is asserting an implementation detail; a test that awaits the returned promise asserts the
contract.

**Fake timers change the loop, so know what they replace.** They stub `setTimeout` and friends —
they do not stub microtasks, `requestAnimationFrame` (unless the library adds it), or Node's
phases. A test that advances fake time still needs an `await` to let promise callbacks run.

**Cancellation is the portable teardown.** An `AbortController` per test — aborted in the
teardown hook — stops timers, listeners and requests in both runtimes, which is exactly what
[14 · Cancellation](../14-cancellation/01-the-model.md) argues for in production code.

## Gotchas

**Symptom: code works in Node and breaks in a browser bundle.**
Cause — it used `setImmediate` or `process.nextTick`.
Fix — `queueMicrotask` for a microtask, `setTimeout(fn, 0)` for a task; feature-detect if you want
the faster path.

**Symptom: `typeof window === 'undefined'` picked the Node path inside a Web Worker.**
Cause — runtime sniffing; workers have no `window` either.
Fix — detect the API: `typeof setImmediate === 'function'`.

**Symptom: an ordering assertion passes locally and fails in CI.**
Cause — it depended on a non-guaranteed order — a timer against I/O, or two task queues.
Fix — assert on the promise the code returns, not on interleaving.

**Symptom: a chunked loop still blocks after adding `await`.**
Cause — awaiting a resolved value stays inside the same microtask drain.
Fix — yield with a task.

**Symptom: fake timers advance but the assertions still see stale state.**
Cause — the timer fired, but the promise callbacks it triggered are microtasks.
Fix — `await` after advancing the clock.

**Symptom: a library behaves differently under an edge runtime.**
Cause — it assumed browser or Node globals that the runtime does not provide.
Fix — restrict to the shared surface and feature-detect the rest.

## Interview questions

**★ Which ordering guarantee is portable across browser and Node?**
Microtasks drain before the loop continues, and a task runs to completion with no preemption. The
promise job queue belongs to ECMAScript; everything else belongs to the host.

**★ How do you yield to the loop in code that runs in both?**
`setTimeout(fn, 0)` is the portable task. Feature-detect `setImmediate` or `scheduler.yield()` for
a better one where it exists.

**★ Why is `typeof window === 'undefined'` a bad runtime check?**
Because it is also true in Web Workers, service workers and several edge runtimes, none of which
have Node's APIs. Detect the specific function instead.

**★ What does a long synchronous task cost in each runtime?**
A frozen tab in the browser — no rendering, no input. In Node, every concurrent request on the
process stalls, because the poll phase cannot progress.

**★ Your test only passes with a `setTimeout(…, 0)` in it. What does that tell you?**
That the code has an ordering dependency nothing guarantees. Await the real signal rather than a
delay.

**★ What do fake timers not fake?**
Microtasks, and anything host-specific they have not stubbed — animation frames, Node's phases.
You still need an `await` after advancing time.

**Where do the two loops actually differ in kind?**
The browser has a rendering step and frame callbacks; Node has phases and a thread pool. Neither
concept exists in the other.

---

← [02 · The Node loop](./02-the-node-loop.md) · [Topic index](./README.md)
