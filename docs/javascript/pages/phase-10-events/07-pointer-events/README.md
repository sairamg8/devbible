---
title: "07 · Pointer events"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [Pointer events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events), [`PointerEvent`](https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent), [`Element.setPointerCapture()`](https://developer.mozilla.org/en-US/docs/Web/API/Element/setPointerCapture), [`pointercancel` event](https://developer.mozilla.org/en-US/docs/Web/API/Element/pointercancel_event), [`touch-action`](https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action). Documentation-validated; **no timings**.

The syllabus row is *the unified model over mouse and touch, capture, and a drag implementation
that does not leak listeners* — and those three are one argument: pointer events replace two event
models with one, pointer capture replaces document-level listeners, and what is left is a drag with
no teardown to forget.

🔴 **The two lines that separate a working drag from a broken one:**
`touch-action: none` in the CSS, and a `pointercancel` handler beside the `pointerup` one.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 01 | **[The unified model](./01-the-unified-model.md)** | The event list, `pointerId` / `pointerType` / `isPrimary` / pressure and tilt, `pointercancel`, `touch-action` versus `preventDefault()`, compatibility mouse events, and when to keep using `click` |
| 02 | **[A drag that does not leak](./02-a-drag-that-does-not-leak.md)** | `setPointerCapture()` and implicit release, why it beats document listeners, a full drag with threshold and `transform`, multi-touch state by `pointerId`, and making a drag accessible |

## Three facts worth carrying out of this topic

- **`pointercancel` means no `pointerup` is coming.** Cleanup that lives only in `pointerup` is the
  bug that never reproduces on a desktop.
- **Pointer capture is released implicitly**, which is exactly why the pattern cannot leak
  listeners.
- **Keep `click` for buttons.** It covers every pointer type *and* the keyboard; `pointerdown` does
  not.

## Phase gate

You can attach one listener to a table and handle clicks on any button in any row, including
buttons added later.

## Where this connects

- [02 · `addEventListener`](../02-addeventlistener/README.md) — the identity trap that the old
  document-listener drag pattern kept walking into, and the `signal` option
- [Phase 9 · 12 · Layout thrashing](../../phase-9-dom/12-layout-thrashing/02-fixing-it.md) — why a
  drag animates `transform` rather than `left`/`top`
- [Phase 9 · 14 · Scrolling](../../phase-9-dom/14-scrolling/04-watching-and-restoring.md) — the
  passive-listener default that makes `touch-action` necessary
- [Phase 9 · 15 · Focus and accessibility](../../phase-9-dom/15-focus-and-accessibility/03-aria-from-javascript.md)
  — the ARIA a custom slider owes, and the keyboard route a drag must have

---

Start → [01 · The unified model](./01-the-unified-model.md)
