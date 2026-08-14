---
title: "14 · Scrolling"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [`Window.scrollTo()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/scrollTo), [`Element.scrollTop`](https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollTop), [`Element.scrollIntoView()`](https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollIntoView), [`scroll-behavior`](https://developer.mozilla.org/en-US/docs/Web/CSS/scroll-behavior), [`overflow`](https://developer.mozilla.org/en-US/docs/Web/CSS/overflow), [`overscroll-behavior`](https://developer.mozilla.org/en-US/docs/Web/CSS/overscroll-behavior), [`position`](https://developer.mozilla.org/en-US/docs/Web/CSS/position), [`Document.scroll` event](https://developer.mozilla.org/en-US/docs/Web/API/Document/scroll_event), [`History.scrollRestoration`](https://developer.mozilla.org/en-US/docs/Web/API/History/scrollRestoration), and the CSS Overflow 3 [viewport propagation rule](https://drafts.csswg.org/css-overflow-3/#overflow-propagation). Documentation-validated; **no timings**.

Scrolling looks like one API and is really four questions: **how do I move the position**, **how do
I land on an element**, **which element actually scrolls**, and **how do I put the reader back
where they were**. Each has a different answer, and mixing them up is where the bugs live.

🔴 **The one-line summary:** describe *what you want on screen* (`scrollIntoView`) rather than
*which pixel offset you want* (`scrollTo`), and let CSS — `scroll-margin`, `scroll-padding`,
`scroll-behavior`, `overscroll-behavior` — handle the adjustments you would otherwise compute by
hand.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 01 | **[Moving the scroll position](./01-moving-the-scroll-position.md)** | `scrollTo` / `scrollBy` / `scroll`, the writable `scrollTop`, the returned Promise, `behavior` versus CSS `scroll-behavior`, and `prefers-reduced-motion` |
| 02 | **[Landing on an element](./02-landing-on-an-element.md)** | `scrollIntoView` options and their asymmetric defaults, `container`, `scroll-margin` / `scroll-padding` for sticky headers, `scrollend`, and why scrolling is not focusing |
| 03 | **[Scroll containers and sticky](./03-scroll-containers-and-sticky.md)** | Which `overflow` values scroll, viewport propagation, `overscroll-behavior` and scroll chaining, locking the page behind a modal, and why `position: sticky` silently fails |
| 04 | **[Watching and restoring](./04-watching-and-restoring.md)** | The `scroll` event and what MDN really says about throttling it, `passive`, `IntersectionObserver` instead, scroll anchoring, `history.scrollRestoration` and the bfcache |

## Three facts worth carrying out of this topic

- **`behavior: 'auto'` is not `'instant'`.** `auto` defers to the CSS `scroll-behavior`, so under
  `html { scroll-behavior: smooth }` even a scroll *restore* animates. Pass `'instant'` when you
  mean it.
- **`scrollIntoView()` defaults to `block: 'start'`** — it moves elements that were already
  visible. `{ block: 'nearest' }` is the option you want nine times out of ten.
- **`overflow: hidden` is still scrollable from code**; `overflow: clip` is not. That difference is
  what carousels are built on, and what makes a scroll lock work.

## Phase gate

You can render a list from an array into the DOM with no framework, update one row without
rebuilding the list, and explain which parts are XSS-safe.

## Where this connects

- [13 · Measuring elements](../13-measuring-elements/README.md) — `scrollTop`, `scrollHeight` and
  the ~1 px tolerance an at-bottom check needs
- [12 · Layout thrashing](../12-layout-thrashing/README.md) — every geometry read in a scroll
  handler is on the forcing list
- [11 · Batching DOM work](../11-batching-dom-work/README.md) — the observer-instead-of-listener
  argument, and virtualising a list too long to scroll
- [10 · Removing and replacing](../10-removing-and-replacing/README.md) — `AbortController` for
  taking a scroll listener off again
- **15 · Focus and accessibility from JavaScript** *(not written yet)* — the other half of "put the
  reader where they need to be"

---

Start → [01 · Moving the scroll position](./01-moving-the-scroll-position.md)
