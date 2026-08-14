---
title: "You might not need an effect"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect).
> No sandbox script backs this topic; claims are cited, not measured.

> Effects are an escape hatch from the React paradigm. They let you "step
> outside" of React and synchronize your components with some external system
> like a non-React widget, network, or the browser DOM. **If there is no external
> system involved** (for example, if you want to update a component's state when
> some props or state change), **you shouldn't need an Effect.**

react.dev's own page works through twelve cases. **Four of them are already
covered in depth in Phase 3**, because they are state-shape problems rather than
effect problems — this topic links there rather than restating them. The rest are
here.

## The two principles everything reduces to

> - **You don't need Effects to transform data for rendering.** Transform all the
>   data at the top level of your components. That code will automatically re-run
>   whenever your props or state change.
> - **You don't need Effects to handle user events.** In the Buy button click
>   event handler, you know exactly what happened. By the time an Effect runs, you
>   don't know *what* the user did.

The second sentence is the sharper one. **An effect has lost the information
about what caused it.** That is not a limitation to work around — it is the
defining property that makes effects wrong for event logic.

| # | Chunk | In one line |
|---|---|---|
| 01 | **[Logic that belongs to an event](01-logic-that-belongs-to-an-event.md)** | Shared handler logic, and the POST that stays next to the POST that moves |
| 02 | **[Chains of effects](02-chains-of-effects.md)** | Four effects waking each other, why it cannot be replayed, and the snapshot trap in the fix |
| 03 | **[State that belongs elsewhere](03-state-that-belongs-elsewhere.md)** | Notifying the parent, passing data upward, and subscribing to an external store |

**Split at 300 lines on concept boundaries.** Chunk 01 is *when* a single action
runs, chunk 02 is a cascade of them, chunk 03 is *where the state lives*.

## All twelve cases, and where each is answered

| # | Case | The fix | Covered in |
|---|---|---|---|
| 1 | Updating state based on props or state | calculate during render | [Phase 3 · 06](../../phase-3-state/06-derived-state.md) |
| 2 | Caching expensive calculations | `useMemo`, not state | [Phase 3 · 06](../../phase-3-state/06-derived-state.md) |
| 3 | Resetting all state when a prop changes | a different `key` | [Phase 3 · 07](../../phase-3-state/07-resetting-state-with-key.md) |
| 4 | Adjusting some state when a prop changes | set state during render — or restructure so you need not | [Phase 3 · 16](../../phase-3-state/16-updating-state-during-render.md) |
| 5 | Sharing logic between event handlers | extract a function, call it from both | **[01](01-logic-that-belongs-to-an-event.md)** |
| 6 | Sending a POST request | depends on what caused it | **[01](01-logic-that-belongs-to-an-event.md)** |
| 7 | Chains of computations | calculate in one event handler | **[02](02-chains-of-effects.md)** |
| 8 | Initializing the application | module level, outside the component | [04 · 03](../04-cleanup/03-when-cleanup-is-not-the-answer.md) |
| 9 | Notifying parent components about state changes | do both updates in the same event | **[03](03-state-that-belongs-elsewhere.md)** |
| 10 | Passing data to the parent | pass it down instead | **[03](03-state-that-belongs-elsewhere.md)** |
| 11 | Subscribing to an external store | `useSyncExternalStore` | **[03](03-state-that-belongs-elsewhere.md)**, then [16](../16-external-store.md) |
| 12 | Fetching data | a legitimate effect — but needs cleanup | [07](../07-fetching-data.md), [08](../08-race-conditions.md) |

**Only case 12 survives as an effect**, and even there react.dev's advice is to
prefer a framework or library mechanism. That ratio is the point of the page.

## The recap, verbatim

> - If you can calculate something during render, you don't need an Effect.
> - To cache expensive calculations, add `useMemo` instead of `useEffect`.
> - To reset the state of an entire component tree, pass a different `key` to it.
> - To reset a particular bit of state in response to a prop change, set it during
>   rendering.
> - Code that runs because a component was *displayed* should be in Effects, the
>   rest should be in events.
> - If you need to update the state of several components, it's better to do it
>   during a single event.
> - Whenever you try to synchronize state variables in different components,
>   consider lifting state up.
> - You can fetch data with Effects, but you need to implement cleanup to avoid
>   race conditions.

**"Code that runs because a component was *displayed*"** is the one-line test.
Everything on this page is that sentence applied twelve times.

## Where this connects

- **← [What an effect is for](../01-what-an-effect-is-for.md)** — the
  effects-versus-events distinction this topic applies case by case.
- **← [Phase 3 · Derived state](../../phase-3-state/06-derived-state.md)** —
  cases 1–4 in full, including the cost of the antipattern in rendered frames.
- **→ [Fetching data in an effect](../07-fetching-data.md)** — the one case that
  stays, and why it is still the weakest option.
- **→ Phase 7 · Custom hooks** — where the extracted `useData`-style hook belongs
  once the effect is unavoidable.

---

← Index: [Phase 4](../README.md) · Start → [Logic that belongs to an event](01-logic-that-belongs-to-an-event.md)
