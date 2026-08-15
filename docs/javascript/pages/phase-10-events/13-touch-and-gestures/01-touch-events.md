---
title: "01 · Touch events, and why pointer events usually win"
sidebar_label: "01 · Touch events"
sidebar_position: 1
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-14 against MDN — [Touch events](https://developer.mozilla.org/en-US/docs/Web/API/Touch_events), [`TouchEvent`](https://developer.mozilla.org/en-US/docs/Web/API/TouchEvent), [`Touch`](https://developer.mozilla.org/en-US/docs/Web/API/Touch), [Pointer events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events), [`touch-action`](https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action). Documentation-validated; **no timings**.

🔴 **MDN's own recommendation, quoted:** *"To support both touch and mouse across all types of
devices, use pointer events instead."* This topic is Know-tier because touch events still appear in
existing code and in interviews — not because you should reach for them.

## The events, and the three lists

| Event | Fires |
|---|---|
| `touchstart` | a finger or stylus first contacts the surface |
| `touchmove` | a touch point moves |
| `touchend` | a finger lifts |
| `touchcancel` | the touch was interrupted — it wandered into browser UI, or the browser took the gesture |

The part that catches people is that a `TouchEvent` carries **three** different lists:

| Property | Contains |
|---|---|
| `touches` | **every** touch currently on the screen, anywhere |
| `targetTouches` | those that started on **this element** |
| `changedTouches` | 🔴 those that **changed in this event** — the ones that just started, moved or ended |

```js
el.addEventListener('touchstart', (e) => {
  for (const touch of e.changedTouches) {
    ongoing.set(touch.identifier, { x: touch.clientX, y: touch.clientY });
  }
});
```

🔴 **`changedTouches` is almost always the one you want.** On `touchend` it holds the finger that
was *lifted* — and that finger is no longer in `touches`, so code that reads `touches[0]` at the
end of a gesture reads the wrong finger or nothing at all.

Each `Touch` has an **`identifier`** that stays constant for the life of that contact — the same
role `pointerId` plays for pointer events, and the only sane key for multi-touch state.

## The comparison, honestly

| | Touch events | Pointer events |
|---|---|---|
| Covers mouse and pen | ❌ separate handlers | ✅ one model |
| Per-contact identity | `identifier` | `pointerId` |
| Cancellation signal | `touchcancel` | `pointercancel` |
| Capture outside the element | manual bookkeeping | 🔴 `setPointerCapture()` |
| Pressure, tilt, contact size | limited | ✅ `pressure`, `tiltX/Y`, `width`/`height` |
| Fires for a mouse | ❌ | ✅ |

⚠️ **Touch-event support is not a mobile detector**, and MDN says so: sites that used it that way
now serve mobile-optimised content to touchscreen laptops. Feature-detect the *interaction* you
need, or use a media query such as `(pointer: coarse)`.

The migration is nearly mechanical — `touchstart` → `pointerdown`, `changedTouches` iteration →
one event per pointer, `identifier` → `pointerId` — and it deletes the parallel mouse handlers
([07 · Pointer events](../07-pointer-events/README.md)).

## The 300 ms tap delay, and what actually removed it

Historically, mobile browsers waited after a tap before firing `click`, to see whether a second tap
was coming and the gesture was a **double-tap zoom**. The delay was widely reported as around
300 ms; treat that number as history rather than a measurement — what matters is the cause.

The fix is to tell the browser double-tap zoom is not available here, so it has nothing to wait for:

```html
<meta name="viewport" content="width=device-width, initial-scale=1">
```

```css
button, a, .tappable { touch-action: manipulation; }
```

- A **responsive viewport** removes the delay on modern browsers, because a page that already fits
  the device does not need tap-to-zoom.
- **`touch-action: manipulation`** keeps scrolling and pinch-zoom but drops double-tap zoom, which
  is exactly the gesture the wait existed for.

⚠️ **The old fix — a `touchend` handler that calls `preventDefault()` and fires the click itself —
is the thing to remove when you find it.** It breaks `label`/`input` behaviour, drag-scrolling and
keyboard equivalents, and it is unnecessary on any browser you now support. Libraries such as
FastClick exist for a problem that no longer needs solving.

## Gestures: what the platform gives you, and what it does not

The platform has **no** pinch, rotate or swipe event. What you have:

- **CSS first.** `overflow` with `scroll-snap-type` gives swipeable carousels; `touch-action`
  chooses which gestures the browser keeps; pinch-zoom is the browser's own and usually should
  stay that way.
- **Pointer events plus arithmetic**, when a gesture really is yours: track two `pointerId`s, and
  the distance between them is the pinch scale, the angle between them the rotation.

```js
const points = new Map();

el.addEventListener('pointerdown', (e) => {
  el.setPointerCapture(e.pointerId);
  points.set(e.pointerId, e);
});

el.addEventListener('pointermove', (e) => {
  if (!points.has(e.pointerId)) return;
  points.set(e.pointerId, e);
  if (points.size === 2) {
    const [a, b] = [...points.values()];
    const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    applyScale(distance);            // relative to the distance recorded at gesture start
  }
});

const end = (e) => { points.delete(e.pointerId); };
el.addEventListener('pointerup', end);
el.addEventListener('pointercancel', end);      // 🔴 both
```

**Every gesture needs a non-gesture route.** Pinch-to-zoom needs zoom buttons, swipe-to-delete needs
a visible delete control, drag-to-reorder needs move-up/move-down. A gesture is undiscoverable, not
keyboard-reachable, and hard for users with motor impairments — the accessibility argument from
[07 · 02](../07-pointer-events/02-a-drag-that-does-not-leak.md), and it applies to every gesture
you invent.

## Gotchas

**Symptom: reading `e.touches[0]` in `touchend` gives the wrong finger, or `undefined`.**
Cause — the finger that lifted is no longer in `touches`; it is in `changedTouches`.
Fix — iterate `changedTouches`.

**Symptom: a multi-touch handler confuses two fingers.**
Cause — state not keyed by `Touch.identifier` (or `pointerId`).
Fix — key by it, and delete the entry on end and cancel.

**Symptom: taps feel sluggish on mobile.**
Cause — a legacy double-tap-zoom delay on a page without a responsive viewport.
Fix — the viewport meta tag, plus `touch-action: manipulation` on tappable elements. Do not
reintroduce a FastClick-style shim.

**Symptom: the site serves the mobile layout on a touchscreen laptop.**
Cause — using touch-event support as a device detector.
Fix — media queries such as `(pointer: coarse)`, or feature-detect what you actually need.

**Symptom: the custom swipe fights the browser's scroll.**
Cause — no `touch-action`, so the browser claims the gesture first.
Fix — declare `touch-action` (`pan-y`, or `none` on the handle), and handle `pointercancel`.

**Symptom: a gesture-only feature is unusable for some people.**
Cause — no keyboard or button equivalent.
Fix — provide one. Gestures are an accelerator, never the only route.

## Interview questions

**★ Should new code use touch events?**
No — MDN recommends pointer events, which cover mouse, pen and touch in one model and add capture,
pressure and per-pointer identity. Touch events remain worth recognising in existing code.

**★ What is the difference between `touches`, `targetTouches` and `changedTouches`?**
`touches` is every contact on the screen, `targetTouches` those that began on this element, and
`changedTouches` those that changed in this event. The last is what you almost always want — on
`touchend` it is the only one holding the finger that lifted.

**★ What caused the 300 ms tap delay and what removed it?**
The browser waiting to see whether a tap was the first half of a double-tap zoom. A responsive
viewport, and `touch-action: manipulation`, remove the reason to wait; a `touchend`-plus-synthetic-
click shim is a legacy workaround that now causes its own bugs.

**★ How do you implement pinch-to-zoom?**
There is no pinch event. Track two pointers by `pointerId` and use the distance between them for
scale and the angle for rotation — and prefer letting the browser's own pinch-zoom do it where you
can.

**★ Why is touch-event support a bad mobile check?**
Touchscreen laptops support it, so the check serves them a mobile layout. Use `(pointer: coarse)`
or detect the capability you actually need.

**What must every custom gesture come with?**
A non-gesture equivalent — buttons, keyboard shortcuts, or a menu. Gestures are undiscoverable and
unreachable for keyboard and many motor-impaired users.

---

[Topic index](./README.md) · [Phase 10 index](../README.md) →
