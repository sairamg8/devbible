---
title: "03 · The event object"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`preventDefault`](https://developer.mozilla.org/en-US/docs/Web/API/Event/preventDefault), [`stopPropagation`](https://developer.mozilla.org/en-US/docs/Web/API/Event/stopPropagation), [`stopImmediatePropagation`](https://developer.mozilla.org/en-US/docs/Web/API/Event/stopImmediatePropagation), [`cancelable`](https://developer.mozilla.org/en-US/docs/Web/API/Event/cancelable). Documentation-validated.

**Three independent decisions, and treating them as one is the mistake:** where the event came
from, whether the browser should still act, and whether other listeners should still run.

> "The event **continues to propagate as usual**, unless one of its event listeners calls
> `stopPropagation()` or `stopImmediatePropagation()`." — MDN, on `preventDefault`

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[Target, default and propagation](./01-target-default-propagation.md)** | The three decisions kept apart, and why `return false` is not a fourth; the two cases where `preventDefault()` **silently does nothing** (non-cancelable events, passive listeners); `stopPropagation` versus `stopImmediatePropagation` and why the latter can disable an unrelated feature depending on load order; the cooperative alternatives using `defaultPrevented` and `closest`; and `isTrusted`, `eventPhase`, `composedPath` |

## The three sentences to keep

1. **`preventDefault` and `stopPropagation` are independent.** One cancels the action, the
   other stops the journey.
2. **`preventDefault` does nothing on a non-cancelable event or in a passive listener** — and
   it warns at most.
3. **`stopImmediatePropagation` also stops listeners on the same element**, so registration
   order decides who wins. Never in shared code.

## Phase gate

You are done with this topic when you can state the difference between the two stop methods,
name both conditions under which `preventDefault` is a no-op, and rewrite a `stopPropagation`
into something that suppresses nothing.

## Where this connects

- [01 · The event model](../01-the-event-model/README.md) — the journey these methods interrupt
- [02 · `addEventListener`](../02-addeventlistener/README.md) — `passive`, which makes `preventDefault` a no-op

---

Start → [01 · Target, default and propagation](./01-target-default-propagation.md)
