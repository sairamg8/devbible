---
title: "The standard set, written out"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> ([`useState`](https://react.dev/reference/react/useState),
> [`useRef`](https://react.dev/reference/react/useRef),
> [`useEffect`](https://react.dev/reference/react/useEffect),
> [`useSyncExternalStore`](https://react.dev/reference/react/useSyncExternalStore),
> [`useEffectEvent`](https://react.dev/reference/react/useEffectEvent),
> [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect),
> [ref callbacks](https://react.dev/reference/react-dom/components/common),
> [`createPortal`](https://react.dev/reference/react-dom/createPortal)) and MDN
> (`matchMedia`, `Window: storage`, `IntersectionObserver`).
> **No code on these pages was executed** — every implementation is written against the
> documented contracts and every claim is cited. There are no console blocks.
> No sandbox script backs this topic; claims are cited, not measured.

**Ten hooks every codebase reinvents, each with the gotcha that makes the naive version
wrong. In almost every case the fix is a rule from earlier in this phase, not a trick —
which is the point of putting this topic seventh rather than first.**

| # | Chunk | Hooks | The recurring theme |
|---|---|---|---|
| 01 | **[Value helpers](01-value-helpers.md)** | `useToggle` · `usePrevious` · `useDebounce` | Snapshots and updater functions; "previous render" is not "previous value" |
| 02 | **[Browser state](02-browser-state.md)** | `useLocalStorage` · `useMediaQuery` | The browser is an external store — subscribe, cache the snapshot, serve the server |
| 03 | **[Listeners](03-events-and-the-dom.md)** | `useEventListener` · `useOnClickOutside` | Handlers through `useEffectEvent`; portals break `contains` |
| 04 | **[Observing an element](04-observing-an-element.md)** | `useIntersectionObserver` | A ref object is not reactive; ref callbacks with React 19 cleanup are |
| 05 | **[Timers and lifecycle](05-timers-and-lifecycle.md)** | `useInterval` · `useIsMounted` | The stale-closure dilemma, and a hook you should delete |

**Split at 300 lines on concept boundaries** — grouped by what the hook talks to, not
alphabetically, because the failure modes cluster that way.

## The four gotchas behind the ten

Read the pages for the specifics; these are the patterns they keep landing on.

1. **A caller's inline function is a new value every render.** Put it in a dependency
   array and the hook re-subscribes forever; leave it out naively and it goes stale.
   `useEffectEvent` is the documented resolution
   ([Phase 7 · 06 · 01](../06-designing-a-hooks-api/01-the-name-and-the-arguments.md)).
2. **A ref is not reactive.** Assigning `ref.current` neither re-renders nor re-runs
   effects, so any hook that waits for a node via a ref object has a silent hole in it.
3. **The browser has no notification for what you just did.** `localStorage` does not
   tell the document that wrote to it; you must emit the change yourself.
4. **Cleanup is usually the mechanism, not the tidy-up.** In `useDebouncedValue` the
   `clearTimeout` *is* the debounce; in `useInterval` the `clearInterval` is what keeps
   `StrictMode` honest.

## Where this connects

- **← [Designing a hook's API](../06-designing-a-hooks-api/README.md)** — the naming and
  signature rules these ten are worth reading against.
- **← [Share logic, not state](../03-share-logic-not-state/README.md)** — `useLocalStorage`
  is that topic's worked example, fixed here.
- **← [Rules of React beyond hooks](../04-rules-of-react-beyond-hooks/README.md)** — why
  the popular `usePrevious` is a purity violation, not just a style choice.
- **↔ [Phase 4 · Cleanup](../../phase-4-effects/04-cleanup/README.md)** and
  **[Race conditions](../../phase-4-effects/08-race-conditions.md)** — the two effect
  contracts most of these depend on.
- **↔ [Phase 5 · `useSyncExternalStore`](../../phase-5-refs-context-reducers/15-usesyncexternalstore.md)**
  — the reference treatment of chunk 02's base.
- **→ [Hooks that wrap effects](../08-hooks-that-wrap-effects/README.md)** — the general rules
  these are ten instances of.

---

← Index: [Phase 7](../README.md) · Start → [Value helpers](01-value-helpers.md)
