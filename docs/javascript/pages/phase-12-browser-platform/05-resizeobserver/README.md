---
title: "05 · ResizeObserver"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`ResizeObserver`](https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver), [`ResizeObserverEntry`](https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserverEntry), [CSS container queries](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_containment/Container_queries) — and the [Resize Observer specification](https://drafts.csswg.org/resize-observer/). Documentation-validated; **no timings and no console output**.

The syllabus row is *element-level responsiveness, and the resize-loop warning* — and the two
halves are connected. The observer exists because a component's own width is the useful
question; the loop warning exists because it is tempting to answer that question by writing a
width back.

🔴 **`ResizeObserver` is for reacting, not for laying out.** Redraw a canvas, re-fit a chart,
feed a virtualiser. If the output of the callback is a CSS length, a container query should have
produced it.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 01 | **[Element-level responsiveness](./01-element-level-responsiveness.md)** | Container queries first, and the table of what is left for JavaScript; `inlineSize`/`blockSize`; the three `box` options and when each is right; `device-pixel-content-box` for crisp canvas; the zero-size report from a hidden element; the patterns; manual cleanup and one observer for many targets |
| 02 | **[The loop, the timing and the cost](./02-the-loop-and-timing.md)** | Delivery after layout and before paint; the loop error, what the browser actually does, and why it is a `window` error event with no stack; the four fixes ranked; what observation costs; no `takeRecords()`; jsdom and feature detection |

## Three facts worth carrying out of this topic

- **The callback runs before paint**, so a correction ships in the same frame — and a slow
  callback delays that frame directly.
- **The loop error means the user saw a wrong frame.** Silencing it with
  `requestAnimationFrame` re-introduces exactly the one-frame lag the observer avoided.
- **The entry already carries every rectangle.** Measuring inside the callback forces a
  synchronous layout in the middle of the one the browser was finishing.

## Phase gate

You can move a 500 ms computation into a Web Worker, keep the page responsive, and prove it
in the performance panel.

## Where this connects

- [Phase 10 · 09 · 01 · The high-frequency events](../../phase-10-events/09-scroll-resize-visibility/01-the-high-frequency-events.md)
  — the decision table (`resize` vs `ResizeObserver` vs `matchMedia`) and the entry-box summary
- [04 · `IntersectionObserver`](../04-intersectionobserver/README.md) — the other geometry
  observer, and the same manual-cleanup rule
- [Phase 9 · 13 · Measuring elements](../../phase-9-dom/13-measuring-elements/01-the-four-families.md)
  — content box versus border box, and device pixels
- [Phase 9 · 12 · Layout thrashing](../../phase-9-dom/12-layout-thrashing/01-the-forced-reflow.md)
  — why measuring inside the callback is the expensive mistake
- **Phase 18 · 12 · Long lists without freezing** *(not written yet)* — measured row heights in
  a virtualiser

---

Start → [01 · Element-level responsiveness](./01-element-level-responsiveness.md)
