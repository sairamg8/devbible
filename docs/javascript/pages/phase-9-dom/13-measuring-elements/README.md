---
title: "13 · Measuring elements"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [`Element.getBoundingClientRect()`](https://developer.mozilla.org/en-US/docs/Web/API/Element/getBoundingClientRect), [`HTMLElement.offsetWidth`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/offsetWidth), [`Element.clientWidth`](https://developer.mozilla.org/en-US/docs/Web/API/Element/clientWidth), [`Element.scrollWidth`](https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollWidth), [`Window.devicePixelRatio`](https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio). Documentation-validated; **no timings**.

There are **four** ways to ask an element how big it is, and they give four different answers. The
bugs come from not knowing which question you asked.

| Family | Box it reports | Type | Transforms? |
|---|---|---|---|
| `getBoundingClientRect()` | border box, **as rendered** | fractional `DOMRect` | **yes** |
| `offset*` | border box, as laid out | rounded integer | no |
| `client*` | padding box — no border, no scrollbar | rounded integer | no |
| `scroll*` | the full content, including overflow | rounded integer | no |

🔴 **The one-line summary:** `getBoundingClientRect()` tells you what is **on screen**; the
`offset`/`client`/`scroll` families tell you what the **layout** says. A scaled or rotated element
makes those two disagree, and that is by design.

⚠️ Everything on this page **forces layout** if you read it while writes are pending —
[12 · Layout thrashing](../12-layout-thrashing/README.md). Read in a batch, before you write.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 01 | **[The four families](./01-the-four-families.md)** | What each box includes, integers versus fractions, `offsetParent`, scroll geometry, and what `getClientRects()` returns for a wrapped inline |
| 02 | **[Viewports and device pixels](./02-viewports-and-device-pixels.md)** | Viewport-relative versus document coordinates, the three viewport widths, `visualViewport`, `devicePixelRatio` and sizing a canvas that is not blurry |

## Phase gate

You can render a list from an array into the DOM with no framework, update one row without
rebuilding the list, and explain which parts are XSS-safe.

## Where this connects

- [12 · Layout thrashing](../12-layout-thrashing/README.md) — every read here is on the forcing
  list
- [11 · Batching DOM work](../11-batching-dom-work/README.md) — a node in a fragment has no
  geometry to measure
- **14 · Scrolling** *(not written yet)* — `scrollTop` and friends, in their own right

---

Start → [01 · The four families](./01-the-four-families.md)
