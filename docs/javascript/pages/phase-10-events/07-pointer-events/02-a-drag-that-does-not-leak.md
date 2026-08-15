---
title: "02 · A drag that does not leak"
sidebar_label: "02 · A drag that does not leak"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [Pointer events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events), [`Element.setPointerCapture()`](https://developer.mozilla.org/en-US/docs/Web/API/Element/setPointerCapture), [`Element.releasePointerCapture()`](https://developer.mozilla.org/en-US/docs/Web/API/Element/releasePointerCapture), [`pointercancel` event](https://developer.mozilla.org/en-US/docs/Web/API/Element/pointercancel_event), [`touch-action`](https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action). Documentation-validated; **no timings**.

The syllabus row asks for *a drag implementation that does not leak listeners*, and the old way
leaked by construction: `mousedown` on the element, then `mousemove` and `mouseup` on `document`,
then remembering to remove both. Pointer capture removes the reason to do that.

## Pointer capture

`setPointerCapture(pointerId)` redirects **all** subsequent events for that pointer to one element,
even when the pointer moves outside it — off the element, off the window, over an iframe.

```js
const handle = document.querySelector('.slider-thumb');

handle.addEventListener('pointerdown', (e) => {
  handle.setPointerCapture(e.pointerId);      // everything now comes here
  handle.dataset.dragging = 'true';
});

handle.addEventListener('pointermove', (e) => {
  if (!handle.dataset.dragging) return;
  update(e.clientX);
});

function stop(e) {
  delete handle.dataset.dragging;
  // no releasePointerCapture needed — see below
}
handle.addEventListener('pointerup', stop);
handle.addEventListener('pointercancel', stop);   // 🔴 both, always
```

Three documented behaviours make this work:

- 🔴 **Capture is released implicitly after `pointerup` or `pointercancel`.** You rarely call
  `releasePointerCapture()` at all — and that is precisely why there is nothing to leak.
- **While captured, `pointerover`, `pointerenter`, `pointerleave` and `pointerout` do not fire.**
  Hover logic goes quiet during a drag, which is usually what you want; if you were relying on it,
  it is not broken, it is suppressed.
- **If you move the element in the DOM, call `setPointerCapture()` after the move**, not before.

⚠️ Touchscreen browsers may apply **implicit** pointer capture on `pointerdown` for direct
manipulation, so touch often behaves as if you had captured even when you did not. Do not rely on
that — set it explicitly, and the behaviour becomes the same across device types.

## Why this beats the document-listener pattern

```js
// ⚠️ the old shape — works, and leaks the moment anything throws
function onMouseDown() {
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}
function onUp() {
  document.removeEventListener('mousemove', onMove);   // identical references required
  document.removeEventListener('mouseup', onUp);
}
```

Everything that goes wrong with it:

- The removals need the **same function references** — the identity trap from
  [02 · `addEventListener`](../02-addeventlistener/README.md). One `.bind(this)` in the wrong place
  and the listener is permanent.
- A throw between down and up leaves both listeners attached **forever**, and each holds its
  closure — the leak from
  [Phase 9 · 10 · 02](../../phase-9-dom/10-removing-and-replacing/02-cleanup.md).
- Release the pointer outside the window and `mouseup` may never arrive.
- Two simultaneous drags share one set of document listeners.

With capture, the listeners live on the element for its lifetime, and the *pointer* is what gets
routed — nothing to add, nothing to remove.

If you do keep the document-listener shape for some reason, the modern cleanup is one
`AbortController`:

```js
const ac = new AbortController();
document.addEventListener('pointermove', onMove, { signal: ac.signal });
document.addEventListener('pointerup', () => ac.abort(), { signal: ac.signal });
```

## The full drag, with the details that matter

```css
.card { touch-action: none; }         /* the browser must not claim the gesture */
```

```js
const state = new Map();              // pointerId → drag state

card.addEventListener('pointerdown', (e) => {
  if (!e.isPrimary) return;                     // ignore extra fingers
  if (e.button !== 0 && e.pointerType === 'mouse') return;   // left button only
  card.setPointerCapture(e.pointerId);
  state.set(e.pointerId, { startX: e.clientX, startY: e.clientY, moved: false });
});

card.addEventListener('pointermove', (e) => {
  const s = state.get(e.pointerId);
  if (!s) return;
  const dx = e.clientX - s.startX;
  const dy = e.clientY - s.startY;
  if (!s.moved && Math.hypot(dx, dy) < 4) return;   // threshold: a click is not a drag
  s.moved = true;
  card.style.transform = `translate(${dx}px, ${dy}px)`;   // compositor-friendly
});

function end(e) {
  const s = state.get(e.pointerId);
  if (!s) return;
  state.delete(e.pointerId);
  if (e.type === 'pointercancel') card.style.transform = '';   // put it back
  else commit(card);
}
card.addEventListener('pointerup', end);
card.addEventListener('pointercancel', end);
```

Five decisions in there worth naming:

- **A movement threshold** (about 4 px) so a slightly shaky click is still a click.
- **`transform`, not `left`/`top`** — the compositor property, so the drag does not relayout every
  frame ([Phase 9 · 12 · 02](../../phase-9-dom/12-layout-thrashing/02-fixing-it.md)).
- **State keyed by `pointerId`**, so two cards can be dragged with two fingers.
- **`pointercancel` reverts**, `pointerup` commits. They are different outcomes, not the same
  cleanup.
- **`button !== 0` for mouse only** — touch and pen report `button: 0` too, so an unqualified check
  is fine, but being explicit documents the intent.

📌 `pointermove` already coalesces to roughly one event per frame, so wrapping the handler in
`requestAnimationFrame` adds a frame of latency without reducing work — the same argument MDN makes
about scroll in [Phase 9 · 14 · 04](../../phase-9-dom/14-scrolling/04-watching-and-restoring.md).
Keep the handler cheap instead.

## Make it work without a pointer

A drag that only works by dragging excludes keyboard and screen-reader users entirely. The minimum:

- **Keyboard equivalents** — arrow keys to move a slider thumb or reorder a list item, Home/End for
  the extremes.
- **The value in the DOM**, not only in a transform, so assistive technology can read it: a native
  `<input type="range">` where possible, or `role="slider"` with `aria-valuenow` / `aria-valuemin` /
  `aria-valuemax` ([Phase 9 · 15 · 03](../../phase-9-dom/15-focus-and-accessibility/03-aria-from-javascript.md)).
- **A non-drag route for reordering** — a menu with "move up" / "move down" beats drag-only, for
  motor-impairment reasons as much as for screen readers.

**The trade-off:** a native `<input type="range">` gives you keyboard, ARIA, touch and pointer
handling for free and costs you fine-grained visual control. Reach for the custom version only when
the design genuinely cannot be built on the native control.

## Gotchas

**Symptom: the element stays stuck to the pointer after the user scrolls.**
Cause — cleanup only in `pointerup`; a browser-claimed gesture fires `pointercancel` instead.
Fix — handle both, and decide deliberately which one commits and which reverts.

**Symptom: the drag stops when the pointer leaves the element.**
Cause — no pointer capture, so events go to whatever is under the pointer.
Fix — `setPointerCapture(e.pointerId)` in `pointerdown`.

**Symptom: dragging scrolls the page on a touchscreen.**
Cause — the browser's pan gesture wins before your code runs.
Fix — `touch-action: none` on the handle.

**Symptom: a plain click is treated as a tiny drag.**
Cause — no movement threshold.
Fix — ignore movement below a few pixels before committing to a drag.

**Symptom: the page janks while dragging.**
Cause — animating `left`/`top`, which relayouts every frame.
Fix — `transform: translate(...)`.

**Symptom: hover styles stop updating mid-drag.**
Cause — while captured, the `pointerover`/`enter`/`leave`/`out` events do not fire. This is
documented behaviour, not a bug.
Fix — drive hover state from the coordinates you already have, or from
`document.elementFromPoint()`.

**Symptom: two fingers dragging two cards move them both to the same place.**
Cause — one shared piece of drag state.
Fix — key it by `pointerId`.

## Interview questions

**★ What does `setPointerCapture()` do, and why does it prevent listener leaks?**
It routes every subsequent event for that pointer to one element, even outside its bounds — so the
listeners stay on the element and there is nothing to add or remove on `document`. Capture is
released implicitly on `pointerup`/`pointercancel`, so there is no teardown step to forget.

**★ Why must a drag handle `pointercancel`?**
Because the browser can take the pointer for its own gesture, and then **no `pointerup` arrives**.
Cleanup that lives only in `pointerup` leaves the drag stuck — a bug that never reproduces with a
mouse.

**★ Why is `touch-action: none` needed for a drag?**
The browser decides whether a touch gesture is a scroll before your handler runs, and the relevant
listeners are passive by default, so `preventDefault()` cannot claim it. `touch-action` declares
the intent in CSS, up front.

**★ Which events go quiet during pointer capture?**
`pointerover`, `pointerenter`, `pointerleave` and `pointerout`. Hover logic must be derived from
coordinates while a drag is in progress.

**★ How do you make a drag accessible?**
Provide keyboard equivalents (arrows, Home/End), expose the value in the DOM via a native control
or `role="slider"` with `aria-valuenow`, and offer a non-drag route for reordering. A drag-only
interaction excludes keyboard, screen-reader and motor-impaired users.

**Why key drag state by `pointerId`?**
Because it is stable for the lifetime of that pointer, so two fingers dragging two elements keep
separate state. Shared state is why multi-touch drags collapse onto one target.

---

← [01 · The unified model](./01-the-unified-model.md) · [Topic index](./README.md) ·
**08 · Custom events** *(not written yet)* →
