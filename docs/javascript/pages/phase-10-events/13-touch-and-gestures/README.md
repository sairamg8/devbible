---
title: "13 · Touch and gestures"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-14 against MDN — [Touch events](https://developer.mozilla.org/en-US/docs/Web/API/Touch_events), [`TouchEvent`](https://developer.mozilla.org/en-US/docs/Web/API/TouchEvent), [Pointer events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events), [`touch-action`](https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action). Documentation-validated; **no timings**.

The syllabus row is *multi-touch, the historical 300 ms delay, and why pointer events usually
suffice* — and the tier says the rest: know what touch events are, recognise them in old code, and
write pointer events instead.

🔴 **MDN's recommendation, verbatim:** *"To support both touch and mouse across all types of
devices, use pointer events instead."*

## Chunk

| # | Chunk | Covers |
|---|---|---|
| 01 | **[Touch events, and why pointer events usually win](./01-touch-events.md)** | The four events, `touches` versus `targetTouches` versus `changedTouches`, `Touch.identifier`, the honest comparison with pointer events, the tap-delay history and what actually removed it, and building a gesture from two pointers |

## Three facts worth carrying out of this topic

- **`changedTouches` is the list you want** — on `touchend` the finger that lifted is not in
  `touches` at all.
- **The tap delay was double-tap-zoom detection.** A responsive viewport and
  `touch-action: manipulation` remove it; a FastClick-style shim is a legacy bug source.
- **Touch support is not a mobile detector** — touchscreen laptops support it. Use
  `(pointer: coarse)`.

## Phase gate

You can attach one listener to a table and handle clicks on any button in any row, including
buttons added later.

## Where this connects

- [07 · Pointer events](../07-pointer-events/README.md) — the model to use instead, with capture,
  `pointercancel` and per-pointer identity
- [11 · Default actions](../11-default-actions/01-what-preventdefault-costs.md) — why cancelling
  touch defaults is passive-blocked, and `touch-action` as the declarative alternative
- [Phase 9 · 14 · Scrolling](../../phase-9-dom/14-scrolling/03-scroll-containers-and-sticky.md) —
  scroll snapping, which gives you swipeable carousels with no gesture code

---

Start → [01 · Touch events, and why pointer events usually win](./01-touch-events.md)
