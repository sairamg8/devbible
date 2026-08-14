---
title: "<Suspense>"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`<Suspense>`](https://react.dev/reference/react/Suspense) (definition, props, the full
> Caveats list, and the four usage sections).
> No sandbox script backs this topic; claims are cited, not measured.

**A Suspense boundary is a place in the tree where React may show something else while
what belongs there is not ready.** It knows nothing about your data — it reacts to a
component *suspending*, which is a specific thing that only specific APIs do, and
emphatically not something a `fetch` in an effect does.

| # | Chunk | In one line |
|---|---|---|
| 01 | **[The boundary and the fallback](01-the-boundary-and-the-fallback.md)** | What suspends and what does not, the boundary as one unit, nesting as a loading sequence, and the 300 ms reveal window |
| 02 | **[State, effects and re-suspending](02-state-effects-and-resuspending.md)** | Suspending before first mount discards state; re-suspending hides content *unless* it was a transition; layout effects torn down while hidden |

**Split at 300 lines on a concept boundary** — the boundary's behaviour, then what it
does to the tree inside it.

## The two sentences that cause the most confusion

> **Suspense does not detect when data is fetched inside an Effect or event handler.**

> If Suspense was displaying content for the tree, but then it suspended again, the
> `fallback` will be shown again **unless the update causing it was caused by
> `startTransition` or `useDeferredValue`.**

The first is why a boundary can appear to do nothing. The second is why a working page
flashes back to its skeleton — and why a transition is part of the correct
implementation rather than a later optimisation.

## Where this connects

- **→ [What can actually suspend](../03-what-can-suspend.md)** — the full list, in detail.
- **→ [`use(promise)`](../04-use-promise.md)** — the caching requirement, seen here from
  the boundary's side: a promise created during render makes the retry never terminate.
- **→ [Boundary placement](../10-boundary-placement.md)** — the design decision this
  topic keeps pointing at.
- **→ [Suspense inside a transition](../11-suspense-inside-a-transition.md)** — the
  "unless" clause, in full.
- **↔ [`useTransition`](../01-usetransition/README.md)** — why `isPending` becomes your
  only feedback once fallbacks are suppressed.
- **↔ [Phase 6 · Lazy loading](../../phase-6-performance/12-lazy-loading.md)** — `lazy()`
  plus a boundary, the first Suspense most people meet.
- **↔ [Phase 4 · `useLayoutEffect`](../../phase-4-effects/12-uselayouteffect.md)** — the
  effects React tears down while content is hidden.

---

← Index: [Phase 8](../README.md) · Start → [The boundary and the fallback](01-the-boundary-and-the-fallback.md)
