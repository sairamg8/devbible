---
title: "19 · Event loop: browser vs Node"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against the [HTML Standard § Event loops — processing model](https://html.spec.whatwg.org/multipage/webappapis.html#event-loop-processing-model), ECMAScript [§ Jobs and Agents](https://tc39.es/ecma262/multipage/executable-code-and-execution-contexts.html#sec-jobs), the Node.js guide [*The Node.js Event Loop*](https://nodejs.org/en/learn/asynchronous-work/event-loop-timers-and-nexttick), Node.js [`process.nextTick()`](https://nodejs.org/api/process.html#processnexttickcallback-args) and [`setImmediate()`](https://nodejs.org/api/timers.html#setimmediatecallback-args) — and MDN [The event loop](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Execution_model), [`requestAnimationFrame()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame). Documentation-validated; **no timings, no console blocks**.

The syllabus row is *rendering and `requestAnimationFrame` on one side; phases, `setImmediate`
and `process.nextTick` on the other* — and the reason to learn both is to know which of your
assumptions is a **language** guarantee and which is a **host** detail.

🔴 **The line runs exactly there.** ECMAScript owns the promise job queue, so "microtasks drain
before the loop continues" is true everywhere. Everything else — frames, phases, `setImmediate`,
`nextTick`, throttling — belongs to the host and does not travel.

⚠️ **The core loop is Master material** and is not repeated here:
[02 · The event loop](../02-the-event-loop/01-stack-queue-heap.md) and
[03 · The drain order](../03-microtasks-vs-macrotasks/01-the-drain-order.md). This topic adds the
two hosts and the portable subset.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 01 | **[The browser loop and the rendering steps](./01-the-browser-loop.md)** | One turn — task, microtask checkpoint, rendering step; why rendering is not once per task; `requestAnimationFrame` and `ResizeObserver` as steps of the loop rather than queues; the nested-`rAF` idiom; where everything you schedule lands; multiple task queues and browser-chosen priority |
| 02 | **[The Node loop and its phases](./02-the-node-loop.md)** | The six phases and what waits in poll; `setImmediate` versus `setTimeout(fn, 0)` — undefined at the top level, deterministic inside I/O; `process.nextTick` outside the phases and ahead of the microtask queue; no rendering, and why blocking costs more here; the thread pool |
| 03 | **[Writing code that survives both](./03-writing-for-both.md)** | The shared guarantees and the non-portable list; feature detection instead of runtime sniffing; the three portable disciplines; and testing async code without asserting on interleaving |

## Four facts worth carrying out of this topic

- **Microtasks-before-tasks is the only portable ordering fact.** It is ECMAScript's, not the
  host's.
- **The browser renders at *rendering opportunities*, not once per task** — and not at all in a
  hidden tab.
- **`setImmediate` beats `setTimeout(fn, 0)` only inside an I/O callback.** At the top level Node
  documents the order as not guaranteed.
- **`process.nextTick` drains before the promise microtask queue**, which makes it both useful
  and starve-prone. Node recommends `queueMicrotask` for new code.

## Phase gate — this closes the Understand tier of phase 7

You can predict the console order of a snippet mixing synchronous code, `setTimeout(…, 0)`,
`Promise.resolve().then` and an `await`, and explain *why* rather than reciting the answer — and
say which parts of your explanation would change in the other runtime.

## Where this connects

- [02 · The event loop](../02-the-event-loop/01-stack-queue-heap.md) and
  [03 · Microtasks vs macrotasks](../03-microtasks-vs-macrotasks/01-the-drain-order.md) — the
  machinery, at Master depth
- [18 · Choosing a deferral](../18-queuemicrotask/01-choosing-a-deferral.md) — the practical
  decision this topic justifies
- [12 · Why `0` is not `0`](../12-timers/02-why-zero-is-not-zero.md) — the clamp, throttling and
  the blocked main thread
- [17 · The other UI races](../17-race-conditions-ui/02-the-other-races.md) — what a long task
  does to a user
- [Phase 9 · 12 · Layout thrashing](../../phase-9-dom/12-layout-thrashing/02-fixing-it.md) — the
  rendering step, forced early
- [Phase 0 · How JavaScript runs](../../phase-0-how-javascript-runs/01-engine-runtime-spec.md) —
  engine versus runtime, which is this distinction at the top level

---

Start → [01 · The browser loop and the rendering steps](./01-the-browser-loop.md)
