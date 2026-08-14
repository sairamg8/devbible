---
title: "10 · Removing and replacing"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [`Element.remove()`](https://developer.mozilla.org/en-US/docs/Web/API/Element/remove), [`Element.replaceWith()`](https://developer.mozilla.org/en-US/docs/Web/API/Element/replaceWith), [`Element.replaceChildren()`](https://developer.mozilla.org/en-US/docs/Web/API/Element/replaceChildren), [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal). Documentation-validated; **no timings**.

Removing a node from the document is one method call. **What that call does *not* do is the whole
topic:**

> Removing an element does **not** remove its event listeners, does **not** stop its observers,
> does **not** cancel timers that reference it, and does **not** make it eligible for garbage
> collection while anything still holds a reference.

A removed node is *detached*, not destroyed. It keeps its listeners, keeps its data, and can be
re-inserted and work exactly as before. That is a useful property and it is also the shape of the
most common front-end memory leak.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 01 | **[The removal and replacement API](./01-the-api.md)** | `remove`, `replaceWith`, `replaceChildren`, the legacy `removeChild`/`replaceChild`, why appending moves rather than copies, and what `cloneNode` does not copy |
| 02 | **[What removal does not clean up](./02-cleanup.md)** | Detached-node leaks, `AbortController` as the one-call teardown, observers and timers, why delegation makes removal free, and the focus you just destroyed |

## Phase gate

You can render a list from an array into the DOM with no framework, update one row without
rebuilding the list, and explain which parts are XSS-safe.

## Where this connects

- [03 · Creating and inserting](../03-creating-and-inserting/README.md) — the other direction, and
  the same "a node has one parent" rule
- [Phase 8 · 04 · Leaks](../../phase-8-modules-errors/04-leaks/README.md) — detached nodes are the
  DOM-specific leak, in full
- [Phase 10 · 04 · Event delegation](../../phase-10-events/04-event-delegation/README.md) — the
  structural fix for listener cleanup

---

Start → [01 · The removal and replacement API](./01-the-api.md)
