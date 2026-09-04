---
title: "11 · Infinite scroll and lazy images"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`IntersectionObserver`](https://developer.mozilla.org/en-US/docs/Web/API/IntersectionObserver), [`<img>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/img), [Responsive images](https://developer.mozilla.org/en-US/docs/Web/HTML/Guides/Responsive_images), [`History.scrollRestoration`](https://developer.mozilla.org/en-US/docs/Web/API/History/scrollRestoration), [ARIA live regions](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Guides/Live_regions), [`content-visibility`](https://developer.mozilla.org/en-US/docs/Web/CSS/content-visibility). Documentation-validated; **no timings and no console output**.

The syllabus row is *`IntersectionObserver`, a sentinel element, `loading="lazy"`, `srcset`, and
reserving space so the layout never shifts* — the two halves of a browse page that keeps going: the
list that loads more, and the images that must not shove it around while it does.

🔴 **Almost none of the image half needs JavaScript.** Lazy loading, responsive selection and space
reservation are attributes now; the JavaScript that used to do them is a liability. The list half is
the opposite — four lines of observer, then a state machine to stop it firing three times at once.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 01 | **[The endless list](./01-the-endless-list.md)** | The sentinel and `rootMargin`; ⚠️ keeping the sentinel **outside** the list; the four-state loader and 🔴 **the in-flight guard** that stops duplicate pages; 🔴 **cursor pagination, never offsets**; the error state that is not optional; why a **"Load more" button is the better default** — the unreachable footer, no announcement, no shareable URL — and the live-region/button/URL mitigations; scroll restoration on Back; teardown |
| 02 | **[Images that do not shift](./02-images-that-do-not-shift.md)** | The one-element version with every attribute explained; 🔴 **`width`+`height` reserve the box** (MDN's aspect-ratio wording) and why that matters most for lazy images; 🔴 **never lazy-load the LCP image**, including MDN's note that an unloaded lazy image is 0×0 and may never intersect; `srcset` `w` vs `x` and the invalid mix; `sizes` defaulting to `100vw`; where JS still helps — placeholders, `error` fallbacks, priority for the first N cards; `content-visibility` |

## Three facts worth carrying out of this topic

- **The in-flight guard is the bug.** Without a `loading` state, the sentinel is still intersecting
  when the observer fires again, and the list loads the same page several times.
- **Offsets shift, cursors do not.** Paginating a changing catalogue by `?page=` duplicates and
  drops rows while the user scrolls.
- **`width` and `height` are a performance feature.** They let the browser reserve the space before
  the bytes arrive, which is most of Cumulative Layout Shift on a product grid.

## Where this connects

- [Phase 12 · 04 · `IntersectionObserver`](../../phase-12-browser-platform/04-intersectionobserver/README.md)
  — the observer mechanics this applies
- [Phase 12 · 06 · The metrics that matter](../../phase-12-browser-platform/06-performanceobserver/03-the-metrics.md)
  — LCP and CLS, the two vitals this topic is really about
- [Phase 12 · 08 · The History API](../../phase-12-browser-platform/08-history-and-routing/README.md)
  — the URL updates and scroll restoration an endless list needs
- [Phase 12 · 11 · Accessibility from JavaScript](../../phase-12-browser-platform/11-accessibility-from-javascript/README.md)
  — announcing new rows through a live region that was already in the DOM
- [01 · The product grid](../01-product-grid/README.md) — the grid this extends
- [03 · A resilient API client](../03-resilient-api-client/README.md) — the client the loader calls,
  with its `AbortSignal` and retries

---

Start → [01 · The endless list](./01-the-endless-list.md)
