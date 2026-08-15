---
title: "12 · Timers"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`setTimeout()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/setTimeout), [`setInterval()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/setInterval), [`clearTimeout()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/clearTimeout), [`Performance.now()`](https://developer.mozilla.org/en-US/docs/Web/API/Performance/now), [`requestAnimationFrame()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame) — and the [HTML Standard § Timers](https://html.spec.whatwg.org/multipage/timers-and-user-prompts.html#timers), [Node.js `timers`](https://nodejs.org/api/timers.html). Documentation-validated; **no timings, no console blocks**.

The syllabus row is *`setTimeout`/`setInterval`, the minimum-delay clamp, drift, why `0` is not
`0`, and clearing them correctly* — five things that are really one thing:

🔴 **A timer's delay is the earliest moment the callback becomes eligible to run. It is never a
promise about when it runs.** The task queue, a 4 ms clamp, background throttling and your own
blocked main thread all sit between the two, and every classic timer bug is a program that
mistook the request for a guarantee.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 01 | **[The API, and clearing it correctly](./01-the-api.md)** | The four functions, browser IDs versus Node `Timeout` objects, `unref`/`refresh`, extra arguments, the `this` trap, delay coercion and the 24.8-day overflow, the string form and CSP, safe clearing, stale IDs, teardown and tying a timer to an `AbortSignal` |
| 02 | **[Why `0` is not `0`](./02-why-zero-is-not-zero.md)** | "Wait at least *n* ms, then **queue a task**"; microtasks always winning; the nesting clamp at 4 ms after five levels; inactive-tab and intensive throttling; a blocked main thread; and the one job `setTimeout(fn, 0)` is honestly for |
| 03 | **[Drift, and repeating work properly](./03-drift-and-repeating-work.md)** | `setInterval` versus a self-rescheduling `setTimeout`, overlapping async callbacks and out-of-order responses, cadence versus counting drift, the self-correcting scheduler, `performance.now()` versus `Date.now()`, why animation belongs to `rAF`, re-entrancy and teardown |

## Four facts worth carrying out of this topic

- **A timer callback is a *task*.** Every pending microtask runs first, so
  `setTimeout(fn, 0)` is always later than a `.then` — and an unbounded microtask chain can
  starve it forever.
- **The 4 ms clamp is in the specification.** Once timers nest more than five deep, a requested
  delay under 4 ms becomes 4 ms, which caps a `setTimeout(…, 0)` loop at roughly 250 iterations
  per second.
- **Never count ticks — read a clock.** Background tabs are clamped to at least a second and
  may be throttled far harder, so a counter driven by tick count loses time it can never
  recover.
- **A pending timer is a strong reference.** It keeps its callback, and everything the callback
  closes over, alive until it fires or is cleared.

## Phase gate

You can predict the console order of a snippet mixing synchronous code, `setTimeout(…, 0)`,
`Promise.resolve().then` and an `await`, and explain *why* rather than reciting the answer.

## Where this connects

- [03 · Microtasks vs macrotasks](../03-microtasks-vs-macrotasks/01-the-drain-order.md) — the
  drain order that decides where a timer callback lands
- [02 · The event loop](../02-the-event-loop/01-stack-queue-heap.md) — the machinery a timer
  hands its callback to
- [11 · Promise anti-patterns](../11-anti-patterns/01-explicit-construction.md) — including
  `setTimeout(…, 0)` used to paper over a race
- [Phase 8 · 04 · The four leaks](../../phase-8-modules-errors/04-leaks/02-the-four-leaks.md) —
  the forgotten interval, in the leak catalogue
- [Phase 10 · 09 · Visibility and lifecycle](../../phase-10-events/09-scroll-resize-visibility/02-visibility-and-lifecycle.md)
  — the documented throttling of timers and `rAF` in a hidden tab
- **14 · Cancellation** and **15 · Timeouts, retries, backoff and jitter** *(not written yet)* —
  what a timer becomes once it has an `AbortSignal` attached
- **Phase 12 · 03 · Timers and frames** *(not written yet)* — the frame side of the same story

---

Start → [01 · The API, and clearing it correctly](./01-the-api.md)
