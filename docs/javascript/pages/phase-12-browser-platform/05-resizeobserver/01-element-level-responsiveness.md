---
title: "01 · Element-level responsiveness"
sidebar_label: "01 · Element-level responsiveness"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`ResizeObserver`](https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver), [`ResizeObserver.observe()`](https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver/observe), [`ResizeObserverEntry`](https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserverEntry), [`devicePixelContentBoxSize`](https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserverEntry/devicePixelContentBoxSize), [CSS container queries](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_containment/Container_queries), [`window.devicePixelRatio`](https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio). Documentation-validated; **no timings and no console output**.

A media query asks how big the **window** is. `ResizeObserver` asks how big **this element** is —
which is the question a component actually has, because a card does not know whether it was
dropped into a sidebar or a full-width hero.

⚠️ **The scroll/resize decision table lives elsewhere.** Which signal answers which question —
`resize` versus `ResizeObserver` versus `matchMedia` — is
[Phase 10 · 09 · 01 · The high-frequency events](../../phase-10-events/09-scroll-resize-visibility/01-the-high-frequency-events.md),
along with the entry-box table and the two documented loop fixes. **This topic is the
element-level *responsiveness* half**: when JavaScript is the right tool at all, and what to do
once you have the size.

## 🔴 First question: does this need JavaScript?

**CSS container queries answer most of it, and answer it better** — they run in the style
engine, they cannot loop, and they need no cleanup:

```css
.card-host { container-type: inline-size; }

@container (min-width: 30rem) {
  .card { grid-template-columns: 12rem 1fr; }
}
```

| The job | Use |
|---|---|
| Change **layout** at an element width | `@container` — no script |
| Scale type against a container | `clamp()` and container query units (`cqi`, `cqw`) |
| Fit a grid to available width | `repeat(auto-fit, minmax(…, 1fr))` |
| **Redraw** something at the new size (canvas, chart, map) | `ResizeObserver` |
| Feed the size to a virtualiser or a layout algorithm | `ResizeObserver` |
| Truncate or re-flow based on measured text | `ResizeObserver` |

🔴 **`ResizeObserver` is for reacting, not for laying out.** The moment a callback writes a
width or height back onto something it observes, you have built the resize loop
([02 · The loop, timing and cost](./02-the-loop-and-timing.md)). If the output of your callback
is a CSS length, the job belonged to CSS.

## The API, in the shape you actually use it

```js
const ro = new ResizeObserver((entries, observer) => {
  for (const entry of entries) {
    const { inlineSize, blockSize } = entry.contentBoxSize[0];
    redraw(entry.target, inlineSize, blockSize);
  }
});

ro.observe(chart, { box: 'content-box' });   // default
ro.unobserve(chart);
ro.disconnect();
```

**`inlineSize` and `blockSize`, not width and height.** The boxes are reported in *logical*
dimensions, so a page in a vertical writing mode gets the right answer without a special case;
in a normal horizontal English page `inlineSize` is the width.

**`box` picks what is measured**, and it is per-`observe()` call, not per-observer:

| `box` | Reports | Use it for |
|---|---|---|
| `'content-box'` (default) | content only, no padding or border | layout maths |
| `'border-box'` | the box `getBoundingClientRect()` measures | comparing against a rect |
| `'device-pixel-content-box'` | content in **device pixels** | canvas backing stores |

⚠️ **`entry.contentRect` is the legacy shape and it is the content box** — comparing it against
a `getBoundingClientRect()` (a border box) is an apples-to-oranges bug
([Phase 9 · 13 · 01 · The four families](../../phase-9-dom/13-measuring-elements/01-the-four-families.md)).

**Observing an element fires the callback once immediately** with its current size — the same
"initial observation" `IntersectionObserver` does. That is convenient: the first draw and every
later resize go through one code path, so there is no separate initialisation.

⚠️ **A `display: none` element has no box**, so the sizes come back as zero. Guard before
dividing by a width, and treat a 0×0 report as "not visible yet" rather than as a real size —
it is the usual cause of a chart rendered one pixel wide inside a collapsed tab panel.

## The canvas case, where the box actually matters

A canvas has two sizes: the CSS size it occupies, and the bitmap it draws into. Getting the
second from the first is where `devicePixelContentBoxSize` earns its name.

```js
const ro = new ResizeObserver(([entry]) => {
  const box = entry.devicePixelContentBoxSize?.[0];
  const width  = box ? box.inlineSize : Math.round(entry.contentBoxSize[0].inlineSize * devicePixelRatio);
  const height = box ? box.blockSize  : Math.round(entry.contentBoxSize[0].blockSize  * devicePixelRatio);
  canvas.width = width;            // resizing the bitmap also clears it
  canvas.height = height;
  draw();                          // so redraw every time
});
ro.observe(canvas, { box: 'device-pixel-content-box' });
```

🔴 **`devicePixelRatio` is not a reliable multiplier on its own** — it changes when the window
moves between monitors or the user zooms, and fractional ratios round differently from the
browser's own layout. `device-pixel-content-box` is the browser telling you the exact number of
device pixels it laid out, which is the only way to get a canvas that is not blurry at a
fractional zoom ([Phase 9 · 13 · 02 · Viewports and device pixels](../../phase-9-dom/13-measuring-elements/02-viewports-and-device-pixels.md)).

**Assigning `canvas.width` resets the drawing surface** — the transform, the styles, the pixels.
Always redraw in the same callback, and set the 2D context's scale after resizing, never before.

## Patterns worth having

**A chart or map that must re-layout.** Observe the container, not the canvas — the canvas is
sized *by* you, so observing it is one step closer to the loop.

```js
new ResizeObserver(([e]) => chart.setSize(e.contentBoxSize[0].inlineSize)).observe(container);
```

**A virtualised list that needs real row heights.** Measure rows as they render, cache the
heights by key in a `Map`, and never write a height back onto an observed row; the scroller
consumes the cache. The long-list treatment is **Phase 18 · 12 · Long lists without freezing**
*(not written yet)*.

**Text that must fit.** Observe the container, compare `scrollWidth` to `clientWidth` on the
text node, and toggle a class — a boolean, not a computed length, so nothing you write can
change what you measured.

**A `<textarea>` that grows.** This is the one case where writing a height in the callback is
normal, and it is safe only because the element you write is *not* the element you observe, or
because you guard the write. Prefer `field-sizing: content` in CSS where it is available.

## Cleanup, and the shape that leaks

Observers hold their targets, and **there is no `AbortSignal` option** — `addEventListener`'s
`signal` has no equivalent here.

```js
class Panel extends HTMLElement {
  #ro = new ResizeObserver(() => this.#layout());
  connectedCallback()    { this.#ro.observe(this); }
  disconnectedCallback() { this.#ro.disconnect(); }
}
```

**One observer for many elements beats one observer per element.** The callback receives an
array, so a single observer batches a hundred rows into one call; a hundred observers produce a
hundred calls in the same frame. `unobserve(target)` drops one, `disconnect()` drops all.

## Gotchas

**Symptom: a chart renders at 0 × 0 inside a collapsed tab or an accordion.**
Cause — the element is `display: none`, so it has no box and the reported sizes are zero.
Fix — guard on a zero size and redraw when it becomes non-zero; the observer will tell you.

**Symptom: the canvas is blurry at 125% zoom or on an external monitor.**
Cause — the bitmap was sized from CSS pixels times `devicePixelRatio`, which rounds differently
from the browser's layout and changes when the window moves.
Fix — observe with `box: 'device-pixel-content-box'` and use `devicePixelContentBoxSize`.

**Symptom: the canvas goes blank on every resize.**
Cause — assigning `canvas.width`/`height` clears the surface and resets the context transform.
Fix — redraw inside the same callback, and re-apply the scale after the assignment.

**Symptom: a comparison against `getBoundingClientRect()` is always a few pixels out.**
Cause — `contentRect`/`contentBoxSize` are the content box; the rect is the border box.
Fix — observe with `box: 'border-box'`, or compare like with like.

**Symptom: JavaScript is being used to switch a component's layout at a width.**
Cause — the job belongs to a container query.
Fix — `container-type: inline-size` and `@container`; keep the observer for redrawing.

**Symptom: a hundred rows produce a hundred callbacks per frame.**
Cause — one observer per row.
Fix — one observer, `observe()` per row; the callback receives them batched in one array.

## Interview questions

**★ Why would you use `ResizeObserver` rather than the `resize` event?**
Because `resize` only reports the viewport. An element gets narrower when a sidebar opens, a
font loads, or content is added, and none of those change the window. `ResizeObserver` watches
the element, and its callback runs before paint, so the correction ships in the same frame.

**★ Container queries do element-level responsiveness in CSS. What is left for the observer?**
Everything that is not a style: redrawing a canvas or chart at the new size, feeding a
virtualiser real measurements, deciding a boolean like "is this text truncated". If the output
of your callback is a CSS length, CSS should have done it.

**★ Which box do you observe for a canvas, and why?**
`device-pixel-content-box`, read from `devicePixelContentBoxSize`. It is the exact device-pixel
size the browser laid out, so the bitmap matches the screen at fractional zoom and after a move
to a different-density monitor — which multiplying by `devicePixelRatio` does not reliably do.

**★ Why are the entry sizes called `inlineSize` and `blockSize`?**
They are logical dimensions, tied to the writing mode rather than to the screen axes. In a
horizontal writing mode `inlineSize` is the width; in a vertical one it is the height, and the
same code keeps working.

**★ What do you do about cleanup?**
Call `disconnect()` (or `unobserve`) in teardown. There is no `signal` option, so an observer
whose component has gone still holds its targets and its closure.

**Your chart renders one pixel wide inside a hidden tab. Why?**
The element is not rendered, so its boxes are zero. Wait for the observer to report a non-zero
size instead of drawing on mount.

---

[Topic index](./README.md) · [02 · The loop, timing and cost](./02-the-loop-and-timing.md) →
