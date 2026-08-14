---
title: "09 · Scroll, resize and visibility"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [`Document.scroll` event](https://developer.mozilla.org/en-US/docs/Web/API/Document/scroll_event), [`Window.resize` event](https://developer.mozilla.org/en-US/docs/Web/API/Window/resize_event), [`ResizeObserver`](https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver), [`IntersectionObserver`](https://developer.mozilla.org/en-US/docs/Web/API/IntersectionObserver), [Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API). Documentation-validated; **no timings**.

The syllabus row is *why these need throttling or an observer, and `passive: true` on scroll* — and
the honest answer to the first half is that **most of them do not need a listener at all**. Each of
these questions has a purpose-built API that costs nothing per frame.

🔴 **The decision, in one table:** in view → `IntersectionObserver`. Element resized →
`ResizeObserver`. Viewport breakpoint → `matchMedia`. Tab still watched → `visibilitychange`.
A continuous scroll position → `scroll`, and only then.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 01 | **[The high-frequency events](./01-the-high-frequency-events.md)** | Choosing the signal, what `scroll` really costs, `resize` versus `ResizeObserver` (and firing before paint), the entry boxes, the loop error and its two fixes, `matchMedia` for breakpoints, and cleanup |
| 02 | **[Visibility and background throttling](./02-visibility-and-lifecycle.md)** | `visibilityState` and what `'hidden'` covers, the documented throttling of rAF and timers, what to stop and when to save, and combining visibility with `IntersectionObserver` |

## Three facts worth carrying out of this topic

- **`requestAnimationFrame` is not a throttle for `scroll`** — MDN calls it useless for that, since
  frame callbacks fire at the same rate. And `{ passive: true }` on `scroll` changes nothing.
- **`ResizeObserver` fires before paint**, so a correction ships in the same frame; a `resize`
  handler runs one frame late.
- **rAF stops entirely in a background tab.** Animations driven by frame counts drift; drive them
  from timestamps.

## Phase gate

You can attach one listener to a table and handle clicks on any button in any row, including
buttons added later.

## Where this connects

- [Phase 9 · 14 · Scrolling](../../phase-9-dom/14-scrolling/04-watching-and-restoring.md) — the
  full scroll-throttling argument, `passive`, and scroll restoration
- [Phase 9 · 13 · Measuring elements](../../phase-9-dom/13-measuring-elements/02-viewports-and-device-pixels.md)
  — why `innerWidth` disagrees with a media query, and content box versus border box
- [Phase 9 · 12 · Layout thrashing](../../phase-9-dom/12-layout-thrashing/02-fixing-it.md) — why
  observer callbacks force no layout where a scroll handler's reads do
- **10 · Page lifecycle** *(not written yet)* — `visibilitychange` against `pagehide`,
  `beforeunload` and the bfcache

---

Start → [01 · The high-frequency events](./01-the-high-frequency-events.md)
