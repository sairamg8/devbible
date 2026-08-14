---
title: "02 · Viewports and device pixels"
sidebar_label: "02 · Viewports and device pixels"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [`Window.innerWidth`](https://developer.mozilla.org/en-US/docs/Web/API/Window/innerWidth), [`Element.clientWidth`](https://developer.mozilla.org/en-US/docs/Web/API/Element/clientWidth), [`Window.scrollY`](https://developer.mozilla.org/en-US/docs/Web/API/Window/scrollY), [`VisualViewport`](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport), [`Window.devicePixelRatio`](https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio), [`Window.matchMedia()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/matchMedia), [`Document.elementFromPoint()`](https://developer.mozilla.org/en-US/docs/Web/API/Document/elementFromPoint). Documentation-validated; **no timings**.

## Two coordinate systems

Everything geometric is in one of two systems, and mixing them is the most common positioning bug
there is:

| System | Origin | APIs |
|---|---|---|
| **Viewport** | top-left of the visible area; **moves when you scroll** | `getBoundingClientRect()`, `clientX`/`clientY` on events, `elementFromPoint()` |
| **Document** | top-left of the page; fixed | `scrollY` + a rect, `pageX`/`pageY` on events |

```js
const r = el.getBoundingClientRect();
const inDocument = { top: r.top + window.scrollY, left: r.left + window.scrollX };
```

🔴 **Which one you need depends on the CSS**, not on preference:

- Positioning a `position: fixed` overlay → **viewport** coordinates, used as-is.
- Positioning a `position: absolute` element in the document flow → **document** coordinates.

A tooltip that is correct at the top of the page and drifts as you scroll is this mistake, every
time.

⚠️ `document.elementFromPoint(x, y)` takes **viewport** coordinates and returns the topmost element
there — so it pairs with a rect or with `clientX`/`clientY`, never with `pageX`/`pageY`.

## The three viewport widths

```js
window.innerWidth;                      // includes the classic scrollbar
document.documentElement.clientWidth;   // excludes it
window.visualViewport.width;            // what is visible AFTER pinch-zoom
```

The gap between the first two is the scrollbar, which is how you measure it:

```js
const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
```

That number is the reason a page "jumps" when a modal sets `overflow: hidden` on the body: the
scrollbar disappears and the content widens by 15-ish pixels. The fix is to add the measured width
back as padding while the modal is open — or `scrollbar-gutter: stable` in CSS, which reserves the
space and needs no JavaScript at all.

🔴 **CSS media queries use the `clientWidth` number, not `innerWidth`.** A JavaScript breakpoint
check written with `window.innerWidth` disagrees with the matching `@media (min-width: …)` by the
scrollbar width, right at the boundary. **Do not reimplement breakpoints in JavaScript** — ask CSS:

```js
if (window.matchMedia('(min-width: 768px)').matches) { /* … */ }
```

That is the same evaluation the stylesheet uses, so the two can never disagree.

## `visualViewport` — pinch-zoom and the mobile keyboard

`window.innerWidth`/`innerHeight` describe the **layout** viewport. When the user pinch-zooms, or
an on-screen keyboard slides up, what is *actually visible* is the **visual** viewport, and only
`visualViewport` reports it:

```js
const vv = window.visualViewport;
vv.width; vv.height; vv.offsetTop; vv.offsetLeft; vv.scale;
vv.addEventListener('resize', reposition);
vv.addEventListener('scroll', reposition);
```

The everyday case is mobile: a keyboard opens, `innerHeight` does not change on some platforms,
and a `position: fixed` bottom bar ends up behind the keyboard. Repositioning from
`visualViewport.height` and `offsetTop` is the fix, and it is the only API that reports it.

## `devicePixelRatio` — CSS pixels are not device pixels

```js
window.devicePixelRatio;   // 1 on a classic display, 2 or 3 on high-density, fractional under zoom
```

Every measurement on these pages is in **CSS pixels**. The ratio is how many device pixels one CSS
pixel covers. It matters in exactly two places.

**1 · Canvas, which is otherwise blurry.** A canvas has a *drawing-buffer* size (its `width`/
`height` attributes) and a *display* size (its CSS width/height). If the buffer is not scaled by
the ratio, the browser upscales it and the result is soft:

```js
const dpr = window.devicePixelRatio || 1;
const { width, height } = canvas.getBoundingClientRect();

canvas.width = Math.round(width * dpr);      // buffer in device pixels
canvas.height = Math.round(height * dpr);
canvas.style.width = `${width}px`;           // display size stays in CSS pixels
canvas.style.height = `${height}px`;
ctx.scale(dpr, dpr);                         // draw in CSS-pixel coordinates
```

After `ctx.scale`, all your drawing code keeps using CSS-pixel numbers, which is the point.
⚠️ **Setting `canvas.width` resets the entire 2D context state** — transforms, styles, everything —
so the `scale` call must come *after* it, and re-running the resize means re-applying context
state.

**2 · Choosing an image.** A 1× asset on a 2× screen is visibly soft; `srcset`/`sizes` is the
declarative answer and should be preferred over reading the ratio in JavaScript.

🔴 **`devicePixelRatio` is not constant.** It changes when the user zooms, or drags the window to a
monitor with different density. There is no `dprchange` event; the documented pattern is a media
query that re-registers itself:

```js
function onDprChange() {
  const mq = matchMedia(`(resolution: ${devicePixelRatio}dppx)`);
  mq.addEventListener('change', onDprChange, { once: true });
  resizeCanvas();
}
onDprChange();
```

Each match is only true for the current ratio, so the listener is re-armed for the new one each
time — which is why `{ once: true }` and the re-registration are both required.

## Gotchas

**Symptom:** A tooltip is correct at the top of the page and wrong once scrolled
**Cause:** Viewport coordinates used to position an absolutely positioned element.
**Fix:** Add `window.scrollY`/`scrollX`, or make the tooltip `position: fixed`.

**Symptom:** A JavaScript breakpoint disagrees with the CSS one near the boundary
**Cause:** `window.innerWidth` includes the scrollbar; media queries use the `clientWidth` number.
**Fix:** `window.matchMedia('(min-width: 768px)').matches`.

**Symptom:** The page shifts sideways when a modal opens
**Cause:** Hiding body overflow removes the scrollbar and widens the content.
**Fix:** Add the measured scrollbar width as padding, or `scrollbar-gutter: stable`.

**Symptom:** A fixed bottom bar hides behind the mobile keyboard
**Cause:** `innerHeight` describes the layout viewport, not what is visible.
**Fix:** `visualViewport` — its `height` and `offsetTop`, with its own `resize`/`scroll` events.

**Symptom:** Canvas output is blurry on a retina screen
**Cause:** The drawing buffer is in CSS pixels while the display is device pixels.
**Fix:** Multiply the buffer size by `devicePixelRatio`, keep the CSS size, then `ctx.scale(dpr, dpr)`.

**Symptom:** After resizing the canvas, all drawing styles are wrong
**Cause:** Assigning `canvas.width`/`height` resets the 2D context state.
**Fix:** Re-apply the transform and styles after every resize.

**Symptom:** Canvas is crisp until the window is moved to another monitor
**Cause:** `devicePixelRatio` changed, and nothing re-ran the sizing.
**Fix:** The re-arming `matchMedia('(resolution: Ndppx)')` listener.

**Symptom:** `elementFromPoint` returns the wrong element or `null`
**Cause:** It was given document coordinates, or a point outside the viewport.
**Fix:** Pass viewport coordinates — a rect's `left`/`top`, or `clientX`/`clientY`.

## Interview questions

**★ `window.innerWidth` versus `document.documentElement.clientWidth`?**
`innerWidth` includes the classic scrollbar, `clientWidth` excludes it — and the difference *is*
the scrollbar width. CSS media queries use the `clientWidth` number, which is why a JavaScript
breakpoint written with `innerWidth` disagrees with the stylesheet at the boundary.

**★ How do you convert a rect to document coordinates?**
Add the scroll offsets: `rect.top + window.scrollY`, `rect.left + window.scrollX`. Rects are
viewport-relative, so they change as you scroll.

**★ What is `visualViewport` for?**
The **visual** viewport — what is actually visible after pinch-zoom or when a mobile keyboard is
open. `innerHeight` reports the layout viewport, so a fixed bottom bar ends up behind the keyboard
without it.

**★ Why is a canvas blurry on a high-density screen, and how do you fix it?**
Its drawing buffer is sized in CSS pixels while the screen has more device pixels per CSS pixel.
Set `canvas.width/height` to the CSS size **times `devicePixelRatio`**, keep the CSS size for
display, and `ctx.scale(dpr, dpr)` so drawing code stays in CSS pixels. Note that assigning
`canvas.width` resets the context state.

**★ Is `devicePixelRatio` stable?**
No — it changes with zoom and when the window moves to a different display, and there is no change
event. The documented pattern is a `matchMedia('(resolution: Ndppx)')` listener that re-registers
itself for the new ratio.

**★ Should you check breakpoints in JavaScript?**
Only through `matchMedia`, so the same evaluation as the stylesheet is used. Comparing
`innerWidth` against a number duplicates the breakpoint and gets the scrollbar wrong.

**Why does the page jump when a modal opens?**
Setting `overflow: hidden` on the body removes the scrollbar, so the content gets wider. Pad by the
measured scrollbar width, or use `scrollbar-gutter: stable`.

---

← [01 · The four families](./01-the-four-families.md) · [Topic index](./README.md) ·
**14 · Scrolling** *(not written yet)* →
