---
title: "01 · The event model"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [Event bubbling](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Scripting/Event_bubbling), [`Event.eventPhase`](https://developer.mozilla.org/en-US/docs/Web/API/Event/eventPhase), [`addEventListener`](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener). Documentation-validated.

**An event does not fire on one element — it travels a path, twice**, and a listener anywhere
along that path can see it. Everything else in this phase depends on that.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[Three phases](./01-three-phases.md)** | Capture, target and bubble, and why bubbling is the default (a W3C compromise, not a modern choice); the events that **do not bubble** and why `focusin` exists; **`target` versus `currentTarget`**, the distinction the whole phase rests on, plus `currentTarget` being valid only during dispatch; and why `stopPropagation` is antisocial, with the ancestor-filters-instead fix |

## The three sentences to keep

1. **`target` never changes; `currentTarget` changes at every step.** Delegation wants
   `target.closest(...)`.
2. **`focus` and `blur` do not bubble** — that is what `focusin`/`focusout` are for.
3. **`preventDefault` and `stopPropagation` are unrelated.** One cancels the action, the other
   stops the journey.

## Phase gate

You are done with this topic when you can trace an event's path through capture, target and
bubble, say which of `target`/`currentTarget` you need without hesitating, and explain what
`stopPropagation` breaks in code you did not write.

## Where this connects

- [Phase 9 · 01 · What the DOM is](../../phase-9-dom/01-what-the-dom-is/README.md) — the tree the path runs through
- [Phase 3 · 04 · Arrow functions and `this`](../../phase-3-functions/04-arrow-functions-and-this/README.md) — why `this` is not the element in an arrow handler

---

Start → [01 · Three phases](./01-three-phases.md)
