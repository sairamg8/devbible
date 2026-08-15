---
title: "04 · IntersectionObserver"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`IntersectionObserver`](https://developer.mozilla.org/en-US/docs/Web/API/IntersectionObserver), [Intersection Observer API guide](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API), [Lazy loading](https://developer.mozilla.org/en-US/docs/Web/Performance/Guides/Lazy_loading). Documentation-validated; **no timings and no console output**.

The syllabus row is *lazy loading, infinite scroll, and impression tracking without scroll
handlers* — three jobs that used to be one badly-throttled `scroll` listener measuring
rectangles on every frame.

🔴 **The observer asks the browser a geometry question and gets a batched answer with the
rectangles already computed.** No per-scroll work, no `getBoundingClientRect()` in a hot path,
and no forced layout. What it does *not* tell you is whether a human can actually see the
element — that is occlusion, and it is a different question.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 01 | **[The API](./01-the-api.md)** | `root`, `rootMargin` and `threshold` in full; the initial callback; the entry's precomputed rectangles; batched delivery and `takeRecords()`; `trackVisibility`/`isVisible`; why cleanup is manual |
| 02 | **[The patterns](./02-the-patterns.md)** | The declarative alternatives to check first; lazy hydration; infinite scroll with a sentinel and an in-flight guard; impressions as visibility **plus dwell**; scrollspy with negative margins; sticky detection; pausing offscreen work; reveal animations that degrade |

## Three facts worth carrying out of this topic

- **`observe()` always fires once immediately.** Branch on `isIntersecting`; the first callback
  is a status report, not an entry event.
- **`rootMargin` is the tuning knob** — a bottom margin preloads before an element appears, and
  negative margins on both sides turn the root into a line for scrollspy. `px` and `%` only.
- **Intersecting is not visible.** A covered, transparent or `opacity: 0` element still
  intersects; only version 2's `trackVisibility` answers occlusion.

## Phase gate

You can move a 500 ms computation into a Web Worker, keep the page responsive, and prove it
in the performance panel.

## Where this connects

- [03 · Timers and frames](../03-timers-and-frames/README.md) — the other half of "stop work
  nobody can see": `rAF` pauses for a hidden tab, the observer for an offscreen element
- [Phase 9 · 12 · Layout thrashing](../../phase-9-dom/12-layout-thrashing/01-the-forced-reflow.md)
  — the cost this API exists to avoid
- [Phase 10 · 09 · The high-frequency events](../../phase-10-events/09-scroll-resize-visibility/01-the-high-frequency-events.md)
  — the decision table: which question goes to which observer
- [Phase 9 · 14 · 03 · Scroll containers and sticky](../../phase-9-dom/14-scrolling/03-scroll-containers-and-sticky.md)
  — element roots, and why `position: sticky` needs a sentinel
- **Phase 18 · 11 · Infinite scroll and lazy images** *(not written yet)* — the same patterns
  applied to the storefront, accessibility included

---

Start → [01 · The API](./01-the-api.md)
