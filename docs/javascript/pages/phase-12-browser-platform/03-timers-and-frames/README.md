---
title: "03 · Timers and frames"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`setTimeout()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/setTimeout), [`setInterval()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/setInterval), [`requestAnimationFrame()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame), [Web Animations API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Animations_API) — and the [HTML Standard](https://html.spec.whatwg.org/multipage/timers-and-user-prompts.html#timers). Documentation-validated; **no timings and no console output**.

The syllabus row is *clamping, throttled background tabs, and `requestAnimationFrame` as the
only correct place to animate*. Underneath all three sits one distinction:

🔴 **A timer schedules against a clock; `requestAnimationFrame` schedules against the screen.**
Everything else follows. A timer's delay is a floor that clamping, throttling and a busy main
thread can all push out. A frame callback runs in the browser's rendering step, at the display's
refresh rate, and not at all when nothing is being painted.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 01 | **[Timers](./01-timers.md)** | The delay as a floor; extra arguments and the `this` trap; the 4 ms nesting clamp; the 24.8-day overflow; `setInterval`'s drift and pile-up, and the chained-`setTimeout` fix; background-tab throttling down to once a minute; cancelling, id pools, and what replaces a timer |
| 02 | **[Frames](./02-frames.md)** | Where the callback sits in the rendering step; the shared timestamp; driving by elapsed time rather than frame count; pausing in background tabs and clamping the resume delta; CSS and `Element.animate()` versus `rAF`; reads and writes inside a frame; after-paint and transition-start patterns |

## Three facts worth carrying out of this topic

- **`setTimeout(fn, 0)` chained is not zero** — from nesting level 5, delays under 4 ms become
  4 ms. And a hidden tab can put every timer on a **once-per-minute** schedule.
- **Never count ticks or frames to measure time.** Elapsed time is the difference of two
  timestamps; anything else is what you *asked for*, not what happened.
- **`rAF` is main-thread work.** CSS and the Web Animations API can be run by the compositor,
  so prefer them for anything expressible as keyframes and keep `rAF` for input-driven values,
  simulation and canvas.

## Phase gate

You can move a 500 ms computation into a Web Worker, keep the page responsive, and prove it
in the performance panel.

## Where this connects

- [Phase 7 · 03 · Microtasks versus macrotasks](../../phase-7-async/03-microtasks-vs-macrotasks/01-the-drain-order.md)
  — why a zero timer still runs after every promise callback
- [Phase 7 · 02 · The event loop](../../phase-7-async/02-the-event-loop/README.md) — the loop
  that the rendering step belongs to
- [Phase 9 · 12 · Layout thrashing](../../phase-9-dom/12-layout-thrashing/01-the-forced-reflow.md)
  — why a read after a write inside a frame callback costs a synchronous layout
- [Phase 10 · 09 · 02 · Visibility and background throttling](../../phase-10-events/09-scroll-resize-visibility/02-visibility-and-lifecycle.md)
  — the visibility signal that tells you a throttle is about to apply
- **14 · Yielding to the main thread** *(not written yet)* — `requestIdleCallback`,
  `scheduler.yield` and breaking up long tasks

---

Start → [01 · Timers](./01-timers.md)
