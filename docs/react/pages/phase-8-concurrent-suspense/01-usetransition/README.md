---
title: "startTransition and useTransition"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`useTransition`](https://react.dev/reference/react/useTransition) and
> [`startTransition`](https://react.dev/reference/react/startTransition).
> No sandbox script backs this topic; claims are cited, not measured.

**A transition is a state update you have told React it may take its time over, throw
away, and restart.** It is not a delay, not a debounce and not a speed-up — it changes
what React is *allowed to do* with the render, and everything else in this phase follows
from that permission.

| # | Chunk | In one line |
|---|---|---|
| 01 | **[Marking an update as non-urgent](01-marking-an-update-non-urgent.md)** | The API, the synchronous marking window that silently swallows async updates, and why interruption makes purity non-negotiable |
| 02 | **[`isPending`, and which tool](02-ispending-and-which-tool.md)** | Why `isPending` is often your only feedback, and the one question that picks between the three APIs |

**Split at 300 lines on a concept boundary** — what a transition *is*, then how you
observe it and choose it.

## The two sentences to keep

> The function you pass to `startTransition` is called immediately, marking all state
> updates that happen while it executes as Transitions. **If you try to perform state
> updates in a `setTimeout`, for example, they won't be marked as Transitions.**

> You can wrap an update into a Transition **only if you have access to the `set`
> function of that state.** If you want to start a Transition in response to some prop or
> a custom Hook value, try `useDeferredValue` instead.

The first is how transitions silently fail. The second is how you pick the right API.

## Where this connects

- **→ [Suspense inside a transition](../11-suspense-inside-a-transition.md)** — why
  fallbacks are suppressed, which is what makes `isPending` load-bearing.
- **→ [Async transitions](../09-async-transitions.md)** — the `await` limitation in full.
- **→ [`useDeferredValue`](../08-usedeferredvalue.md)** — the answer when you do not own
  the setter.
- **↔ [Phase 7 · Purity](../../phase-7-custom-hooks/04-rules-of-react-beyond-hooks/01-purity-and-idempotence.md)**
  — interruption means a component may render several times per visible update, and some
  of those renders are discarded.
- **↔ [Phase 3 · Automatic batching](../../phase-3-state/04-automatic-batching.md)** — a
  different mechanism that is often confused with this one.

---

← Index: [Phase 8](../README.md) · Start → [Marking an update as non-urgent](01-marking-an-update-non-urgent.md)
