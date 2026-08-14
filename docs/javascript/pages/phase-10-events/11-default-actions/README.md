---
title: "11 · Default actions you should not block"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [`Event.preventDefault()`](https://developer.mozilla.org/en-US/docs/Web/API/Event/preventDefault), [`Event.cancelable`](https://developer.mozilla.org/en-US/docs/Web/API/Event/cancelable), [`EventTarget.addEventListener()`](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener), [`touch-action`](https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action). Documentation-validated; **no timings**.

The syllabus row is *the passive-listener warning, and what breaks when you `preventDefault` a
scroll* — a short topic with a long tail, because every default action you cancel is a capability
the user had a moment ago.

🔴 **The rule:** cancel a default only when you are **replacing** it with something the user can
still reach — including by keyboard. Cancelling to "clean up" the interaction is how pages lose Tab
navigation, zoom, text selection and ⌘-click.

## Chunk

| # | Chunk | Covers |
|---|---|---|
| 01 | **[What `preventDefault` costs](./01-what-preventdefault-costs.md)** | `cancelable` and the silent no-op, the passive default on `wheel`/`touchstart` and why it exists, the do-not-block list, the link-interception guards every router needs, where cancelling *is* correct, and cancelling narrowly |

## Three facts worth carrying out of this topic

- **`preventDefault()` on a non-cancelable event does nothing** — no throw, at most a warning.
  `scroll` is the one people try.
- **`wheel`, `mousewheel`, `touchstart` and `touchmove` are passive by default** on window,
  document and body, so cancelling them needs `{ passive: false }` — and `touch-action` is usually
  the better answer.
- **`dragover` is the inversion:** its default is to *reject* a drop, so cancelling is how a target
  accepts one.

## Phase gate

You can attach one listener to a table and handle clicks on any button in any row, including
buttons added later.

## Where this connects

- [03 · The event object](../03-the-event-object/README.md) — `preventDefault()` versus
  `stopPropagation()`, which do unrelated things
- [07 · Pointer events](../07-pointer-events/01-the-unified-model.md) — `touch-action` as the
  declarative alternative to cancelling a gesture
- [06 · Keyboard events](../06-keyboard-events/02-building-a-shortcut.md) — the keys a shortcut must
  never steal, Tab above all
- [Phase 9 · 14 · Scrolling](../../phase-9-dom/14-scrolling/04-watching-and-restoring.md) — why
  `passive` on a `scroll` listener changes nothing

---

Start → [01 · What `preventDefault` costs](./01-what-preventdefault-costs.md)
