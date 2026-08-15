---
title: "14 · Debugging events"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-14 against MDN — [`Event.eventPhase`](https://developer.mozilla.org/en-US/docs/Web/API/Event/eventPhase), [`Event.composedPath()`](https://developer.mozilla.org/en-US/docs/Web/API/Event/composedPath), [`Event.defaultPrevented`](https://developer.mozilla.org/en-US/docs/Web/API/Event/defaultPrevented), [`Event.isTrusted`](https://developer.mozilla.org/en-US/docs/Web/API/Event/isTrusted), [`Document.elementsFromPoint()`](https://developer.mozilla.org/en-US/docs/Web/API/Document/elementsFromPoint). ⚠️ `getEventListeners`, `monitorEvents` and `$0` are **DevTools console utilities, not web APIs**. Documentation-validated; **no timings**.

The syllabus row is *`getEventListeners`, `monitorEvents`, event-listener breakpoints, and finding
what stole your click* — the closing topic of the phase, and the one that turns everything before it
into a diagnosis procedure.

🔴 **There are only seven things that can be wrong**, and the chunk works through them in the order
that eliminates them fastest.

## Chunk

| # | Chunk | Covers |
|---|---|---|
| 01 | **[Finding what stole your click](./01-finding-what-stole-your-click.md)** | The seven suspects in order, the DevTools console utilities, event-listener breakpoints, the capture-versus-bubble logger that isolates `stopPropagation()`, `elementsFromPoint` for overlays, and why a synthesised event is not a real one |

## Three facts worth carrying out of this topic

- **`getEventListeners($0)` in the console settles "is anything even listening"** in one line — but
  it is DevTools only, never page code.
- **Capture on `document` sees the event before anyone can stop it.** If capture fires and bubble
  does not, `stopPropagation()` is the culprit.
- **`isTrusted: false` means script dispatched it**, and untrusted events do not carry user
  activation — which is why a synthetic click can behave differently from a real one.

## Phase gate

You can attach one listener to a table and handle clicks on any button in any row, including
buttons added later.

## Where this connects

- [01 · The event model](../01-the-event-model/README.md) — the capture/target/bubble phases the
  capture-logger technique depends on
- [03 · The event object](../03-the-event-object/README.md) — `target` versus `currentTarget`,
  `preventDefault()` versus `stopPropagation()`
- [04 · Event delegation](../04-event-delegation/README.md) — the fix for the commonest cause, a
  listener attached to an element that was replaced
- [11 · Default actions](../11-default-actions/01-what-preventdefault-costs.md) — passive listeners,
  and why a cancel can be silently ignored

---

Start → [01 · Finding what stole your click](./01-finding-what-stole-your-click.md)
