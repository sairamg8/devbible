---
title: "01 · The unified model"
sidebar_label: "01 · The unified model"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [Pointer events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events), [`PointerEvent`](https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent), [`pointercancel` event](https://developer.mozilla.org/en-US/docs/Web/API/Element/pointercancel_event), [`touch-action`](https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action). Documentation-validated; **no timings**.

Pointer events are one model for mouse, pen and touch. Before them, an interaction had to be
written twice — mouse handlers plus touch handlers — and the two disagreed about ordering, about
what "the same finger" meant, and about which one fired first.

## The events

| Event | Fires |
|---|---|
| `pointerdown` | the pointer enters the active-button state |
| `pointermove` | its coordinates change |
| `pointerup` | it leaves the active-button state |
| 🔴 `pointercancel` | **the browser has taken over** — no further events for this pointer |
| `pointerover` / `pointerout` | it moves into / out of the element's hit area |
| `pointerenter` / `pointerleave` | same, without bubbling through descendants |
| `gotpointercapture` / `lostpointercapture` | capture changed |

They mirror the mouse events one for one, which is what makes migration mechanical: `mousedown` →
`pointerdown`, and so on.

## The properties that mouse events never had

```js
el.addEventListener('pointerdown', (e) => {
  e.pointerId;      // identifies THIS pointer — the finger, the pen, the mouse
  e.pointerType;    // 'mouse' | 'pen' | 'touch'
  e.isPrimary;      // is this the primary pointer of its type?
  e.pressure;       // 0–1
  e.width;          // contact area in CSS pixels
  e.height;
  e.tiltX; e.tiltY; // pen angles, −90…90
});
```

- **`pointerId`** is what makes multi-touch tractable: every pointer keeps its id from `pointerdown`
  to `pointerup`, so tracking two fingers is two entries in a `Map` keyed by id.
- **`pointerType`** lets one handler behave differently per device without sniffing the user agent —
  a bigger hit area for touch, pressure for pen.
- **`isPrimary`** is the "ignore extra fingers" filter. For a mouse it is always true; for touch it
  is the first finger down on an untouched screen.
- **`width` / `height`** describe the contact patch, which is why MDN's guidance is to make targets
  large enough for the largest contact surface — a fingertip, not a cursor.

Because `PointerEvent` **extends `MouseEvent`**, everything familiar is still there: `clientX`,
`clientY`, `button`, `buttons`, `shiftKey`.

## `pointercancel` — the one with no mouse equivalent

🔴 **The browser can take a pointer away from you.** It fires `pointercancel` when it decides the
interaction is its own gesture — a pan, a pinch-zoom, a back-swipe — and after that **no `pointerup`
arrives**.

```js
el.addEventListener('pointerdown', startDrag);
el.addEventListener('pointerup', endDrag);
el.addEventListener('pointercancel', endDrag);     // ← never omit this
```

A drag implementation that cleans up only in `pointerup` leaves the element stuck mid-drag the
first time a scroll gesture wins. This is the single most common pointer-events bug, and it does
not reproduce with a mouse.

## `touch-action` decides who wins the gesture

`touch-action` is CSS, and it tells the browser which gestures it may keep for itself in that
region:

| Value | Browser keeps |
|---|---|
| `auto` (default) | everything — scroll, pinch-zoom, double-tap zoom |
| `pan-x` / `pan-y` | scrolling on that axis only |
| `manipulation` | scrolling and pinch-zoom, but not double-tap zoom |
| `none` | nothing — every gesture is yours |

```css
.draggable  { touch-action: none; }    /* a drag handle */
.carousel   { touch-action: pan-y; }   /* vertical page scroll still works */
```

🔴 **This is the fix for "my drag works with a mouse and scrolls the page on a phone".** You cannot
solve it with `preventDefault()`, because the browser decides before your handler runs — the
listener would have to be non-passive on `touchstart`, which is exactly what the passive default
prevents ([Phase 9 · 14 · 04](../../phase-9-dom/14-scrolling/04-watching-and-restoring.md)).
`touch-action` is declarative and the browser reads it up front.

⚠️ `touch-action: none` also removes the browser's ability to scroll that region **for everyone**,
so scope it to the handle rather than the container.

## Compatibility mouse events

For content written before pointer events, the browser also fires the matching mouse events —
`pointerdown` → `mousedown`, and so on. Two consequences:

- **You will see both.** Handling `pointerdown` *and* `mousedown` runs your logic twice. Pick one
  model per interaction.
- **`preventDefault()` on `pointerdown` suppresses some of them**, but MDN is specific about the
  limits: hovering pointers cannot have their mouse events prevented, and `mouseover`, `mouseout`,
  `mouseenter` and `mouseleave` are **never** prevented.

📌 `click` still fires on top of all this, from any pointer type. For simple buttons, **keep using
`click`** — it is keyboard-accessible for free (Enter and Space activate it), and pointer events
are not.

## When to reach for pointer events

**Use them for:** dragging, sliders, drawing surfaces, pinch and rotate, anything caring about
pressure or pen tilt, and anything that must behave identically for finger and mouse.

**Do not use them for:** ordinary buttons and links. `click` covers mouse, touch, pen **and
keyboard**; replacing it with `pointerdown` silently drops keyboard users, which is the same
mistake as the focusable `<div>` in
[Phase 9 · 15 · 01](../../phase-9-dom/15-focus-and-accessibility/01-what-can-hold-focus.md).

## Gotchas

**Symptom: a drag sticks to the cursor after the user scrolls on a touchscreen.**
Cause — the browser claimed the gesture and fired `pointercancel`; no `pointerup` ever came.
Fix — clean up in `pointercancel` as well as `pointerup`.

**Symptom: dragging works on desktop and scrolls the page on mobile.**
Cause — the browser's pan gesture wins before your handler runs.
Fix — `touch-action: none` on the drag handle (`pan-y` if page scrolling must still work).

**Symptom: every interaction runs twice.**
Cause — both pointer and compatibility mouse handlers are registered.
Fix — one model per interaction; `preventDefault()` on `pointerdown` suppresses some, but not the
hover-related mouse events.

**Symptom: a two-finger gesture behaves as if both fingers were one.**
Cause — the handler ignores `pointerId` and keeps a single set of coordinates.
Fix — key the state by `pointerId`, and use `isPrimary` when you deliberately want only one.

**Symptom: `pressure` is always 0 or 0.5.**
Cause — the device does not report pressure; non-pressure devices report defaults.
Fix — treat pressure as an enhancement, and check `pointerType === 'pen'` before depending on it.

**Symptom: replacing `click` with `pointerdown` broke keyboard users.**
Cause — pointer events have no keyboard equivalent.
Fix — keep `click` for activation; pointer events are for continuous interactions.

## Interview questions

**★ What problem do pointer events solve?**
One model for mouse, pen and touch, with per-pointer identity. Before them, the same interaction
needed separate mouse and touch handlers whose ordering and semantics differed.

**★ What is `pointercancel` and why does it matter?**
The browser fires it when it takes the pointer for its own gesture — a scroll or pinch — and **no
`pointerup` follows**. Any cleanup that lives only in `pointerup` leaks state, which is why drags
stick after a scroll on mobile.

**★ Why does `touch-action` exist when `preventDefault()` is available?**
The browser decides whether a gesture is its own before your listener runs, and the relevant
listeners are passive by default. `touch-action` states the intent declaratively, so the browser
knows in advance.

**★ How do you track two fingers?**
By `pointerId` — it is stable from `pointerdown` to `pointerup`, so keep a `Map` keyed by it.
`isPrimary` filters down to the single main pointer when that is what you want.

**★ Should a button use `pointerdown` instead of `click`?**
No. `click` covers every pointer type **and** the keyboard; `pointerdown` drops keyboard
activation. Pointer events are for drags, sliders and drawing.

**What are compatibility mouse events?**
Mouse events the browser fires alongside pointer events so older content keeps working.
`preventDefault()` on `pointerdown` suppresses some, but never `mouseover`, `mouseout`,
`mouseenter` or `mouseleave`, and never for hovering pointers.

---

[Topic index](./README.md) · [02 · A drag that does not leak](./02-a-drag-that-does-not-leak.md) →
