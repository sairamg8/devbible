---
title: "12 · Long lists without freezing"
sidebar_label: "Overview"
sidebar_position: 12
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`content-visibility`](https://developer.mozilla.org/en-US/docs/Web/CSS/content-visibility), [`contain-intrinsic-size`](https://developer.mozilla.org/en-US/docs/Web/CSS/contain-intrinsic-size), [`Scheduler.yield()`](https://developer.mozilla.org/en-US/docs/Web/API/Scheduler/yield), [`DocumentFragment`](https://developer.mozilla.org/en-US/docs/Web/API/DocumentFragment), [`Element: scroll` event](https://developer.mozilla.org/en-US/docs/Web/API/Element/scroll_event), [`ResizeObserver`](https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver), [`position`](https://developer.mozilla.org/en-US/docs/Web/CSS/position), [`overflow-anchor`](https://developer.mozilla.org/en-US/docs/Web/CSS/overflow-anchor), [`aria-setsize`](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-setsize). Documentation-validated; **no timings and no console output**.

The syllabus row is *windowing/virtualisation written from scratch, and the point at which it beats
rendering everything* — and the second half is the one that matters. Virtualisation is the answer
everybody reaches for and the one with the highest cost, because it is the only fix that takes rows
out of the document.

🔴 **The shape of this topic: earn it, build it, then live with it.** Chunk 01 is the four cheaper
fixes and the signals that say you have outgrown them. Chunk 02 writes the windowed list. Chunk 03
is variable heights and the honest list of what stops working once the rows are gone.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 01 | **[Why a long list freezes](./01-why-a-long-list-freezes.md)** | 🔴 **the build freeze vs the scroll freeze** — different causes, different fixes; don't render it at all (paginate, search, export); cheaper rows (delegation, flatten, image dimensions); one `DocumentFragment` insert and why ⛔ **`innerHTML +=` in a loop is quadratic**; 🔴 **`content-visibility: auto` + `contain-intrinsic-size`**, the near-free win that keeps rows findable and focusable; chunking with `scheduler.yield()` (⚠️ **limited availability — feature-detect**); 🔴 **the point at which windowing wins**, as signals rather than an invented row count |
| 02 | **[A windowing list from scratch](./02-windowing-from-scratch.md)** | viewport / **empty sizer** / transformed layer, and why each exists; the `windowFor()` maths with **overscan**; a scroll loop coalesced into one `requestAnimationFrame`; ⚠️ **read `scrollTop` and nothing else** — cache the viewport height via `ResizeObserver`; a **node pool** with the early-return path that writes a single transform; ⚠️ **recycled-node state bleed**, the wrong-row-selected bug; 🔴 **`aria-setsize` / `aria-posinset`** with MDN's own rationale |
| 03 | **[Variable heights, and what windowing breaks](./03-what-windowing-breaks.md)** | the three options for unknown heights — fix them by design, estimate/measure/correct, or don't window; **prefix sums + binary search** instead of division; 🔴 **the correction jump** and anchoring by hand (⚠️ browser scroll anchoring cannot help — the rows above do not exist, and `overflow-anchor` is not Baseline); then **what breaks**: find-in-page, selection, printing, **focus**, screen-reader continuous reading, sticky headers inside a transformed layer, `:nth-child` striping, deep links; and what to check before adopting a library |

## Three facts worth carrying out of this topic

- **There are two freezes, not one.** A long task building the nodes, and ongoing style/layout across
  a huge document while scrolling. A fix that addresses one does nothing for the other.
- **`content-visibility: auto` is the fix to try first.** It skips rendering work for off-screen
  content while MDN guarantees the content stays available to find-in-page, tab order, focus and the
  accessibility tree — the exact things windowing destroys.
- **Windowing is a trade, not an optimisation.** You buy a small DOM with find-in-page, selection,
  printing, focus stability and easy accessibility. Make that trade deliberately, and mitigate it.

## Where this connects

- [11 · Infinite scroll and lazy images](../11-infinite-scroll-and-lazy-images/README.md) — the other
  half of a long browse page; loading fewer rows is the fix that comes before making many rows fast
- [01 · The product grid](../01-product-grid/README.md) — the grid this makes survivable at scale
- [Phase 9 · 11 · Batching DOM work](../../phase-9-dom/11-batching-dom-work/README.md) and
  [Phase 9 · 12 · Layout thrashing](../../phase-9-dom/12-layout-thrashing/README.md) — the insert and
  the read/write discipline every fix here depends on
- [Phase 10 · 04 · Event delegation](../../phase-10-events/04-event-delegation/README.md) — one
  listener, not one per row; mandatory once nodes are recycled
- [Phase 12 · 14 · Yielding to the main thread](../../phase-12-browser-platform/14-yielding-to-the-main-thread.md)
  — `scheduler.yield()` and the alternatives behind chunk 01's fix 4
- [Phase 12 · 05 · `ResizeObserver`](../../phase-12-browser-platform/05-resizeobserver/README.md) —
  measuring the viewport and the rows without touching layout in a scroll handler
- [Phase 12 · 11 · Accessibility from JavaScript](../../phase-12-browser-platform/11-accessibility-from-javascript/README.md)
  — the set attributes, roles and focus management a virtual list cannot skip

---

Start → [01 · Why a long list freezes](./01-why-a-long-list-freezes.md)
