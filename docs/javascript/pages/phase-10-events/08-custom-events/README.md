---
title: "08 · Custom events"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [`CustomEvent`](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent), [`CustomEvent()` constructor](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent/CustomEvent), [`EventTarget.dispatchEvent()`](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/dispatchEvent), [`EventTarget`](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget), [`AbortController`](https://developer.mozilla.org/en-US/docs/Web/API/AbortController). Documentation-validated; **no timings**.

The syllabus row is *`CustomEvent`, the `detail` payload, and decoupling components without a
framework* — and the last clause is the reason the first two matter. The DOM is already a message
bus with delegation, cancellation and cleanup built in.

🔴 **The one thing to remember:** **every option defaults to `false`.** `bubbles`, `cancelable`,
`composed` — all off, `detail` null. Almost every "my custom event doesn't fire" is a default.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 01 | **[Dispatching and listening](./01-dispatching-and-listening.md)** | The constructor and its defaults, `CustomEvent` versus `Event` versus subclassing, why `dispatchEvent()` is synchronous, the `cancelable` veto protocol, naming, where to dispatch from, and `composed` for shadow DOM |
| 02 | **[Decoupling components](./02-decoupling-components.md)** | Emit up / command down, `EventTarget` as a standalone bus, `AbortController` cleanup, when events are the wrong tool, and a component's event-contract checklist |

## Three facts worth carrying out of this topic

- **`dispatchEvent()` is synchronous.** Listeners run to completion before it returns, so a slow
  listener blocks the emitter.
- **`cancelable: true` is what makes `preventDefault()` mean anything**, and `dispatchEvent()`
  returning `false` is how the dispatcher learns it was vetoed.
- **Events go up, commands go down.** Telling a component to do something is a method call, not an
  event.

## Phase gate

You can attach one listener to a table and handle clicks on any button in any row, including
buttons added later.

## Where this connects

- [04 · Event delegation](../04-event-delegation/README.md) — why dispatching on the component's
  own element, with `bubbles: true`, is what lets a container listen once
- [02 · `addEventListener`](../02-addeventlistener/README.md) — `once`, `signal` and the identity
  trap that `AbortController` removes
- [Phase 9 · 18 · Shadow DOM](../../phase-9-dom/18-shadow-dom-and-custom-elements/03-living-with-the-boundary.md)
  — `composed: true`, without which a component's events never reach the page
- [Phase 9 · 10 · Removing and replacing](../../phase-9-dom/10-removing-and-replacing/02-cleanup.md)
  — the leak a long-lived bus causes when listeners outlive their components

---

Start → [01 · Dispatching and listening](./01-dispatching-and-listening.md)
