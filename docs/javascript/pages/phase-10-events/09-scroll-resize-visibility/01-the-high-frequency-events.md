---
title: "01 · The high-frequency events"
sidebar_label: "01 · The high-frequency events"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [`Document.scroll` event](https://developer.mozilla.org/en-US/docs/Web/API/Document/scroll_event), [`Window.resize` event](https://developer.mozilla.org/en-US/docs/Web/API/Window/resize_event), [`ResizeObserver`](https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver), [`IntersectionObserver`](https://developer.mozilla.org/en-US/docs/Web/API/IntersectionObserver), [`EventTarget.addEventListener()`](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener). Documentation-validated; **no timings**.

`scroll` and `resize` are the two events that fire far more often than your handler can afford, and
both now have a better-shaped replacement. The question is never "how do I throttle this" first —
it is "is there an observer that answers my actual question".

⚠️ **Scroll is covered in depth elsewhere.** The throttling argument, `passive`, scroll
restoration and the observer-instead-of-listener case are all in
[Phase 9 · 14 · 04 · Watching and restoring](../../phase-9-dom/14-scrolling/04-watching-and-restoring.md).
This page is the **decision**, and the resize and visibility halves.

## Pick the signal that matches the question

| The question | The answer |
|---|---|
| is this element **in view**? | `IntersectionObserver` |
| has this **element's size** changed? | `ResizeObserver` |
| has the **viewport** changed? | `resize` on `window`, or a `matchMedia` listener |
| exactly **where** is the scroll position? | `scroll` — nothing else gives a continuous value |
| has the user **stopped** scrolling? | `scrollend` |
| is the **page still visible**? | `visibilitychange` ([02](./02-visibility-and-lifecycle.md)) |

🔴 **Only the fourth row genuinely needs a high-frequency listener.** A reading-progress bar needs
the continuous number. Lazy loading, sticky-header detection, infinite scroll, reveal animations and
"which section am I in" are all `IntersectionObserver` questions, and they cost nothing per frame.

## `scroll`, in one paragraph

It fires at frame rate; MDN warns against expensive work in the handler, and specifically calls
`requestAnimationFrame` **useless as a throttle** — animation-frame callbacks fire at the same rate
as scroll events, so the documented throttle is a `setTimeout` you measure yourself. `{ passive:
true }` on a `scroll` listener changes nothing, because `scroll` reports a scroll that already
happened; passive matters for `wheel` and `touchstart`, which can cancel one. The full argument,
with the MDN quotation, is in
[Phase 9 · 14 · 04](../../phase-9-dom/14-scrolling/04-watching-and-restoring.md).

## `resize`: the window event versus `ResizeObserver`

```js
window.addEventListener('resize', () => { /* fires only for the viewport */ });
```

`resize` on `window` tells you the **viewport** changed. It says nothing about an element that got
narrower because a sidebar opened, a font loaded, or content was added — which is what you usually
want to know.

```js
const ro = new ResizeObserver((entries) => {
  for (const entry of entries) {
    const { inlineSize, blockSize } = entry.contentBoxSize[0];
    layout(entry.target, inlineSize, blockSize);
  }
});
ro.observe(chart);
```

| | `resize` on `window` | `ResizeObserver` |
|---|---|---|
| Watches | the viewport only | **any element** |
| Fires | after paint | **before paint** |
| Granularity | global | per element |
| Catches a sidebar opening | ❌ | ✅ |

**Firing before paint is the substantive difference.** A `resize` handler that re-lays-out runs
after the frame is already on screen, so the user sees one frame of the wrong layout;
`ResizeObserver` callbacks run after layout and before paint, so the correction ships in the same
frame.

### The entry properties

| Property | Box |
|---|---|
| `contentBoxSize[0]` — `inlineSize`, `blockSize` | content box — **preferred** |
| `borderBoxSize[0]` | border box |
| `devicePixelContentBoxSize[0]` | content box in **device pixels** |
| `contentRect` | content box, legacy shape |

🔴 **`contentRect` is the content box** — no padding, no border. Comparing it against a
`getBoundingClientRect()` (a border box) is an apples-to-oranges bug; use `borderBoxSize` when you
need to compare
([Phase 9 · 13 · 01](../../phase-9-dom/13-measuring-elements/01-the-four-families.md)).

Choose the box explicitly when it matters: `ro.observe(el, { box: 'border-box' })`.
`device-pixel-content-box` is the one for canvas backing stores, where CSS pixels are the wrong
unit.

### The loop error

```
ResizeObserver loop completed with undelivered notifications.
```

🔴 **The callback resized what it was observing.** The observer re-fires, resizes again, and the
browser cuts the cycle off and reports the error.

```js
// ❌ the loop
new ResizeObserver(([entry]) => {
  entry.target.style.width = `${entry.contentBoxSize[0].inlineSize + 10}px`;
});
```

MDN gives two fixes: defer the write into a `requestAnimationFrame`, or **track the size you
expect** and skip the write when the element is already that size — a `WeakMap` keyed by element,
which also avoids holding a reference
([Phase 9 · 10 · 02](../../phase-9-dom/10-removing-and-replacing/02-cleanup.md)).

Better still: **do not size elements from JavaScript.** Container queries and intrinsic sizing do
the same job in CSS with no loop to break — `ResizeObserver` is for reacting (redrawing a canvas,
re-laying-out a chart), not for laying out.

### Breakpoints belong to `matchMedia`

```js
// ❌ duplicates the stylesheet's breakpoint, and gets the scrollbar wrong
window.addEventListener('resize', () => { if (innerWidth < 768) … });

// ✅ same evaluation as the CSS
const narrow = window.matchMedia('(max-width: 767px)');
narrow.addEventListener('change', (e) => setLayout(e.matches));
setLayout(narrow.matches);
```

`innerWidth` **includes the scrollbar** while media queries use `documentElement.clientWidth`, so a
hand-written comparison disagrees with the stylesheet exactly at the boundary
([Phase 9 · 13 · 02](../../phase-9-dom/13-measuring-elements/02-viewports-and-device-pixels.md)).
`matchMedia` also fires only on the transition, not on every resize event.

## Cleanup

Observers hold their targets. Both have a `disconnect()`, and neither takes an
`AbortController` signal, so teardown is explicit:

```js
class Chart extends HTMLElement {
  #ro = new ResizeObserver(() => this.#draw());
  connectedCallback() { this.#ro.observe(this); }
  disconnectedCallback() { this.#ro.disconnect(); }
}
```

`unobserve(target)` stops watching one element; `disconnect()` stops all of them.

## Gotchas

**Symptom: the resize handler misses a sidebar opening.**
Cause — `resize` fires only for the viewport.
Fix — `ResizeObserver` on the element that actually changed.

**Symptom: "ResizeObserver loop completed with undelivered notifications" in the console.**
Cause — the callback changed the size of an observed element.
Fix — defer the write to `requestAnimationFrame`, or skip it when the element already has the
expected size. Better, size in CSS.

**Symptom: a JavaScript breakpoint disagrees with the stylesheet by a few pixels.**
Cause — `innerWidth` includes the scrollbar; media queries do not.
Fix — `matchMedia` with the same query string as the CSS.

**Symptom: the layout visibly corrects itself one frame after a resize.**
Cause — a `resize` handler runs after paint.
Fix — `ResizeObserver`, whose callback runs before paint.

**Symptom: comparing `contentRect.width` to `getBoundingClientRect().width` never matches.**
Cause — content box versus border box.
Fix — `borderBoxSize`, or compare like with like.

**Symptom: memory grows as components mount and unmount.**
Cause — observers were never disconnected.
Fix — `disconnect()` in teardown; there is no `signal` option to do it for you.

## Interview questions

**★ When do you need a `scroll` listener at all?**
Only when you need the continuous position — a progress bar, a parallax offset. Visibility
questions go to `IntersectionObserver`, size questions to `ResizeObserver`, and "has scrolling
stopped" to `scrollend`.

**★ What does `ResizeObserver` give you that the `resize` event does not?**
Per-element observation — it catches an element resized by a sidebar, a font load or new content,
not just the viewport — and its callback runs **before paint**, so the correction ships in the same
frame instead of one frame late.

**★ What causes "ResizeObserver loop completed with undelivered notifications"?**
The callback changed the size of something it observes, so the observer re-fires in a cycle. Fix by
deferring the write to `requestAnimationFrame` or by skipping the write when the size already
matches what you expect.

**★ Why use `matchMedia` instead of comparing `innerWidth`?**
Because it is the same evaluation the stylesheet uses, and it fires only on the transition.
`innerWidth` includes the scrollbar, so a hand-rolled comparison is off by its width at the
boundary.

**★ Does `{ passive: true }` help a scroll listener?**
No. `passive` lets the browser start the default action without waiting, which applies to events
that can cancel scrolling (`wheel`, `touchstart`). `scroll` reports a scroll that already happened.

**Which box does `contentRect` report?**
The content box — no padding or border. `borderBoxSize` is what compares with
`getBoundingClientRect()`.

---

[Topic index](./README.md) · [02 · Visibility and lifecycle](./02-visibility-and-lifecycle.md) →
