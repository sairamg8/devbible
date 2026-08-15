---
title: "18 · `queueMicrotask`"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`queueMicrotask()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/queueMicrotask), [Using microtasks in JavaScript](https://developer.mozilla.org/en-US/docs/Web/API/HTML_DOM_API/Microtask_guide), [`requestAnimationFrame()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame), [`requestIdleCallback()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestIdleCallback), [`unhandledrejection`](https://developer.mozilla.org/en-US/docs/Web/API/Window/unhandledrejection_event), [`MutationObserver`](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver) — and the [HTML Standard § Microtask queue](https://html.spec.whatwg.org/multipage/webappapis.html#microtask-queue), Node.js [`process.nextTick()`](https://nodejs.org/api/process.html#processnexttickcallback-args). Documentation-validated; **no timings, no console blocks**.

The syllabus row is *`queueMicrotask` — and when it is the right tool instead of
`setTimeout(fn, 0)`*.

⚠️ **The mechanism lives elsewhere.** The drain order and the two uses MDN documents are
[03 · Microtasks vs macrotasks](../03-microtasks-vs-macrotasks/02-using-microtasks.md), at
Master depth. **This topic is the choice and its consequences** — it does not re-explain the
queue.

🔴 **One question resolves nearly every case: does the browser get to render between now and
your callback?** Microtasks say no — they all drain before the loop moves on. Tasks and frame
callbacks say yes.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 01 | **[Choosing a deferral](./01-choosing-a-deferral.md)** | The six positions you can ask for and what each promises; `queueMicrotask` versus `Promise.resolve().then` and their different error channels; why a spinner never paints behind a microtask; `requestAnimationFrame` and `requestIdleCallback`; `scheduler.postTask`/`yield`; and Node's extra two, `process.nextTick` and `setImmediate` |
| 02 | **[Microtask hazards](./02-microtask-hazards.md)** | Starvation — the deliberate loop and the realistic promise-loop version; why `await` is not a yield; errors leaving by `error` rather than `unhandledrejection`, including a deferral inside a chain detaching from its `.catch`; what a microtask cannot observe; every microtask source including `MutationObserver`; and flushing them in a test |

## Four facts worth carrying out of this topic

- **Nothing renders between your code and a microtask.** That is the whole reason to pick one —
  and the whole reason a spinner behind one never appears.
- **A throw in `queueMicrotask` is an uncaught exception**, not an unhandled rejection. Wire both
  global handlers.
- **`await` is not a yield.** Awaiting a resolved value resumes inside the same drain.
- **`process.nextTick` drains before the promise microtask queue** — Node-only, and not the same
  thing as `queueMicrotask`.

## Phase gate

Given "run this later", you can name which of `queueMicrotask`, `setTimeout(fn, 0)`,
`requestAnimationFrame` and `requestIdleCallback` you want and justify it in one sentence about
rendering.

## Where this connects

- [03 · Using microtasks deliberately](../03-microtasks-vs-macrotasks/02-using-microtasks.md) —
  the mechanism and MDN's two documented uses
- [12 · Why `0` is not `0`](../12-timers/02-why-zero-is-not-zero.md) — the task side of the same
  decision, and the nesting clamp
- [08 · Unhandled rejections](../08-error-handling/03-unhandled-rejections.md) — the other half
  of the error-channel story
- [Phase 9 · 12 · Layout thrashing](../../phase-9-dom/12-layout-thrashing/02-fixing-it.md) —
  why a measurement in a deferred callback can still be the wrong place
- [Phase 10 · 09 · The high-frequency events](../../phase-10-events/09-scroll-resize-visibility/01-the-high-frequency-events.md)
  — `requestAnimationFrame` is not a throttle for `scroll`
- **19 · Event loop: browser vs Node** *(not written yet)* — the phases behind `setImmediate` and
  `nextTick`

---

Start → [01 · Choosing a deferral](./01-choosing-a-deferral.md)
