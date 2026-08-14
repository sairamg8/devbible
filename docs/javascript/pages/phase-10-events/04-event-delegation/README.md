---
title: "04 · Event delegation"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [Event bubbling](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Scripting/Event_bubbling), [`closest`](https://developer.mozilla.org/en-US/docs/Web/API/Element/closest), [`matches`](https://developer.mozilla.org/en-US/docs/Web/API/Element/matches). Documentation-validated.

**The row the syllabus says pays for the phase.** Delegation is bubbling used on purpose: one
listener on an ancestor handles every descendant, because the event arrives there anyway.

> "Event delegation uses event bubbling to handle interactions on multiple child elements by
> attaching a **single listener to their parent**." — MDN

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[One listener for a whole list](./01-one-listener.md)** | Why the listener count is the **least** important reason — it survives re-renders, handles elements that do not exist yet, and centralises the behaviour; **`closest` versus `matches`** and why the click lands on the icon; routing several actions through `data-action`; the **five cases where delegation fails** (non-bubbling events, upstream `stopPropagation`, detached targets, shadow DOM retargeting, hot events); and where to attach |

## The three sentences to keep

1. **Match with `closest`, not `target`.** The click lands on the icon, not the button.
2. **`closest` walks past your container** — add a `contains` check when it matters.
3. **Delegation dies on non-bubbling events and upstream `stopPropagation`.** Those are the
   two failures you will actually meet.

## Phase gate

You are done with this topic when you can write a delegated handler with `closest` and a
containment check from memory, give a structural reason for delegation rather than the
listener count, and name the five places it fails.

## Where this connects

- [01 · The event model](../01-the-event-model/README.md) — the bubbling delegation depends on, and which events lack it
- [03 · The event object](../03-the-event-object/README.md) — `stopPropagation`, the thing that silently breaks delegation
- [Phase 8 · 04 · Leaks](../../phase-8-modules-errors/04-leaks/README.md) — the per-row listeners delegation avoids

---

Start → [01 · One listener for a whole list](./01-one-listener.md)
