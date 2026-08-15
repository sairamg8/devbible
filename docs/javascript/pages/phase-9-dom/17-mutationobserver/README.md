---
title: "17 · MutationObserver"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-14 against MDN — [`MutationObserver`](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver), [`MutationObserver.observe()`](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver/observe), [`MutationRecord`](https://developer.mozilla.org/en-US/docs/Web/API/MutationRecord), [`MutationObserver.takeRecords()`](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver/takeRecords). Documentation-validated; **no timings**.

The syllabus row is *"reacting to DOM changes you do not control, without polling"* — and that
second half is the whole justification. Before `MutationObserver` the options were a `setInterval`
that checked, or the synchronous mutation events that were deprecated for wrecking performance.

🔴 **The one-line summary:** it is a Know-tier tool because the right answer is almost always a more
specific one — `IntersectionObserver`, `ResizeObserver`, a custom element's `connectedCallback`, or
simply reacting where your own code makes the change. Reach for `MutationObserver` when the change
comes from somewhere you cannot edit.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 01 | **[The API](./01-the-api.md)** | `observe()` options and the three `TypeError`s, what a `MutationRecord` does and does not carry, batched microtask delivery, `takeRecords()` before `disconnect()`, and not leaking the observer |
| 02 | **[When to use it](./02-when-to-use-it.md)** | The decision table against the other observers, the cases where it genuinely is the answer, the cheaper alternatives in order, and how to keep the cost down |

## Three facts worth carrying out of this topic

- **A record has `oldValue`, never a new value** — and only if you asked for it. Read the current
  value off `record.target`.
- **`disconnect()` discards the queue.** `takeRecords()` first when the last batch matters, and
  before making your own changes inside the callback.
- **Scope is everything.** `document.body` with `subtree: true` and `attributes: true` is a
  callback on nearly every change in the app; a container plus `attributeFilter` is almost free.

## Phase gate

You can render a list from an array into the DOM with no framework, update one row without
rebuilding the list, and explain which parts are XSS-safe.

## Where this connects

- [12 · Layout thrashing](../12-layout-thrashing/02-fixing-it.md) — observer callbacks are
  delivered outside the read/write problem, unlike a scroll handler
- [11 · Batching DOM work](../11-batching-dom-work/02-not-freezing-the-page.md) — coalescing the
  reaction when mutations arrive in storms
- [10 · Removing and replacing](../10-removing-and-replacing/02-cleanup.md) — a connected observer
  keeps its target alive; `disconnect()` belongs in every teardown
- [Phase 10 · 04 · Event delegation](../../phase-10-events/04-event-delegation/README.md) — the
  reason you rarely need to watch for nodes just to bind listeners to them
- **18 · Shadow DOM and custom elements** *(not written yet)* — `connectedCallback` and
  `attributeChangedCallback`, the scoped alternative

---

Start → [01 · The API](./01-the-api.md)
