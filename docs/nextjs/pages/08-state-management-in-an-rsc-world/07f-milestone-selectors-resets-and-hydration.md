---
title: "A correctly scoped store still has three ways to misbehave — a selector that returns a new reference every render, a Set mutated in place, and persisted state that makes the client's first paint disagree with the server's"
sidebar_label: "07f · Milestone: selectors and resets"
sidebar_position: 48
description: "Chapter 8's capstone, step four continued: subscribing narrowly with selectors, the v5 stable-output rule and useShallow, reading without subscribing through getState in event handlers, resetting per board by remount rather than by a reset action, and the persist-plus-SSR hydration mismatch."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-05 against the Zustand docs — [Migrating to v5](https://github.com/pmndrs/zustand/blob/main/docs/reference/migrations/migrating-to-v5.md),
> [`useShallow`](https://github.com/pmndrs/zustand/blob/main/docs/reference/hooks/use-shallow.md),
> [`useStore`](https://github.com/pmndrs/zustand/blob/main/docs/reference/hooks/use-store.md)
> and [Setup with Next.js](https://github.com/pmndrs/zustand/blob/main/docs/learn/guides/nextjs.md).
> Target: **Next.js 16.3.4** App Router · **React 19.2.8** · **zustand 5.0.15**.
> Documentation-verified; **no sandbox run**.

**Scoping the store correctly ([07e](07e-milestone-the-scoped-zustand-store.md)) stops it leaking; it does nothing about making it fast or making it reset.** Three failures remain, and all three are silent in a small demo and obvious in a board with two hundred cards: a selector whose return value has a new identity on every call, which in Zustand 5 loops rather than merely re-rendering; a `Set` updated by mutation, which notifies nobody; and a `persist`ed field that participates in the first render, which makes the client's HTML disagree with the server's. This page is those three, plus the read-without-subscribing escape hatch that makes a 60Hz drag possible at all.

## Selectors, and the v5 rule that bites

Zustand 5 tightened selector semantics to match React's, and the migration guide is explicit about the consequence:

> *"There is a behavioral change in v5 to match React default behavior. If a selector returns a new reference, it may cause infinite loops."*
>
> *"The error message will be something like this: `Uncaught Error: Maximum update depth exceeded.`"*
> — [Zustand, *Migrating to v5*](https://github.com/pmndrs/zustand/blob/main/docs/reference/migrations/migrating-to-v5.md)

So this loops:

```tsx
// 🚩 new object identity on every render → re-render → new object → …
const { draggingCardId, dropTarget } = useBoardUi((s) => ({
  draggingCardId: s.draggingCardId,
  dropTarget: s.dropTarget,
}))
```

and both of these do not:

```tsx
// ✅ two subscriptions, each returning a primitive or a stable reference
const draggingCardId = useBoardUi((s) => s.draggingCardId)
const dropTarget = useBoardUi((s) => s.dropTarget)

// ✅ one subscription, memoised by shallow comparison
import { useShallow } from 'zustand/react/shallow'

const { draggingCardId, dropTarget } = useBoardUi(
  useShallow((s) => ({ draggingCardId: s.draggingCardId, dropTarget: s.dropTarget })),
)
```

> *"`useShallow` returns a memoized version of a selector function using a shallow comparison for memoization."*
> — [Zustand, `useShallow`](https://github.com/pmndrs/zustand/blob/main/docs/reference/hooks/use-shallow.md)

For two fields, two subscriptions is simpler and has the same effect. `useShallow` earns its place when the selector *computes* something — `useShallow((s) => [...s.selection])`, which produces a new array on every call and would otherwise loop.

### Select the narrowest thing you render, not the field it comes from

The habit that keeps a drag smooth is selecting a **derived boolean** rather than the value it derives from. A column does not care what the drop target is; it cares whether it is the drop target.

```tsx filename="app/(dashboard)/boards/[boardId]/column.tsx"
'use client'
import { useBoardUi } from '@/providers/board-ui-provider'

export function Column({ columnId }: { columnId: string }) {
  // Re-renders only when this column's answer flips — not on every pointer move.
  const isTarget = useBoardUi((s) => s.dropTarget?.columnId === columnId)
  const isCollapsed = useBoardUi((s) => s.collapsed.has(columnId))
  // …
}
```

Selecting `s.dropTarget` here would re-render all four columns on every `setDropTarget`, because the object's identity changes each time. Selecting the boolean means three of the four columns compute `false === false` and do nothing.

## Reading without subscribing

An event handler that needs the current selection does not need to *subscribe* to it. `useBoardUiApi()` returns the store handle from [07e](07e-milestone-the-scoped-zustand-store.md); `getState()` reads the value at the moment of the event with no subscription and therefore no re-render cost.

```tsx
const api = useBoardUiApi()

function onCardClick(cardId: string, e: React.MouseEvent) {
  const { selection } = api.getState()
  if (e.shiftKey) {
    api.getState().toggleSelected(cardId)
  } else if (selection.size > 0) {
    api.getState().clearSelection()
  }
}
```

This is not a micro-optimisation; it is what makes the drag layer in [07g](07g-milestone-the-drag-layer.md) viable. A `pointermove` handler that read `selection` through `useBoardUi` would re-render its component on every selection change *and* would need the value threaded through a closure that React re-creates each render. `getState()` is always current and never subscribes.

**The trade-off:** a value read with `getState()` is not reactive. If what you need is to *render* something, subscribe; if what you need is to *decide* something inside a handler, read. Using `getState()` for rendering produces a component that shows stale data until something else re-renders it, and that bug is very hard to see because it is correct on first paint.

## Resetting per board

The store in [07e](07e-milestone-the-scoped-zustand-store.md) has a `clearSelection` action but no `reset()`, and that is deliberate. A `reset()` has to enumerate every field, so the day someone adds a fifth field and forgets to add it to `reset()`, board B inherits it from board A — a bug that only appears on a navigation between two boards under the same layout, which is a path nobody exercises while developing a single board.

Remounting the provider cannot forget a field:

```tsx
<BoardUiProvider key={boardId}>
```

A new `key` is a new component instance, so `useState(() => createBoardUiStore())` runs again and the old store becomes garbage along with everything in it. The rule generalises: **for per-resource state, reset by identity, not by an action.**

The exception is state you want to survive the reset — a "compact card" display preference, say, which is a property of the user rather than of the board. That belongs in a *different* provider mounted higher in the tree, without a `key`, not in a field that `reset()` is careful to skip.

## Persisted state and the first paint

The Zustand Next.js guide names the hazard directly:

> *"**SSR friendly:** Next.js applications are rendered twice, first on the server and again on the client. Having different outputs on both the client and the server will result in "hydration errors." The store will have to be initialized on the server and then re-initialized on the client with the same data in order to avoid that."*
> — [Zustand, *Setup with Next.js*](https://github.com/pmndrs/zustand/blob/main/docs/learn/guides/nextjs.md)

`persist` reads `localStorage`, which the server does not have. If a persisted field participates in the first render — collapsed columns do, they change the markup — the server renders "expanded" and the client renders "collapsed", and React reports a mismatch. The value is not wrong; the *timing* is.

Two honest fixes, and they are genuinely different:

```tsx
// A. Do not persist state that participates in the first render.
//    Collapsed columns become session-only. Simplest, and usually right.

// B. Render the server's value first, adopt the persisted one after mount.
const [hydrated, setHydrated] = useState(false)
useEffect(() => setHydrated(true), [])
const collapsed = useBoardUi((s) =>
  hydrated ? s.collapsed : emptyBoardUiState.collapsed,
)
```

B costs a visible flash: the column expands and then collapses. That is the price of restoring client-only state into server-rendered markup, and no amount of cleverness removes it — only moving the value somewhere the server can read it (a cookie, the URL) does, at which point it is no longer client state and belongs to a different owner.

## Gotchas

**★ Symptom: `Maximum update depth exceeded` the moment a component mounts.** Cause: a selector returning a fresh object or array, which v5 compares by reference and therefore treats as changed on every render. Fix: select primitives individually, or wrap the selector in `useShallow` so the comparison is by contents:

```tsx
// 🚩 loops
const [a, b] = useBoardUi((s) => [s.draggingCardId, s.dropTarget])
// ✅ stable
const [a, b] = useBoardUi(useShallow((s) => [s.draggingCardId, s.dropTarget]))
```

**★ Symptom: toggling a card's selection changes nothing on screen.** Cause: the `Set` was mutated in place, so the state value's identity did not change and no subscriber was notified. Fix: copy, mutate the copy, return the copy:

```ts
// 🚩 same Set object; nothing re-renders
toggleSelected: (id) =>
  set((s) => { s.selection.add(id); return { selection: s.selection } })
// ✅ a new Set is a new value
toggleSelected: (id) =>
  set((s) => {
    const next = new Set(s.selection)
    next.has(id) ? next.delete(id) : next.add(id)
    return { selection: next }
  })
```

**★ Symptom: dragging a card makes the whole board janky, and the profiler shows every column re-rendering.** Cause: a component subscribed without a selector, or with one that returns the whole state or a whole object, while `setDropTarget` fires on every pointer move. Fix: subscribe to the narrowest value each component actually renders, and read the rest imperatively:

```tsx
// 🚩 every column re-renders on every pointer move
const dropTarget = useBoardUi((s) => s.dropTarget)
const isTarget = dropTarget?.columnId === columnId
// ✅ only the two columns whose answer changed re-render
const isTarget = useBoardUi((s) => s.dropTarget?.columnId === columnId)
```

**★ Symptom: a component shows the selection it had when it mounted and never updates.** Cause: `getState()` used where a subscription was needed. It reads once and does not subscribe, so nothing re-renders when the value changes. Fix: `getState()` in handlers, `useBoardUi(selector)` in render. The rule is mechanical — if the value appears in JSX, it must come from the hook:

```tsx
// 🚩 renders once, then lies
const { selection } = useBoardUiApi().getState()
return <span>{selection.size} selected</span>
// ✅
const count = useBoardUi((s) => s.selection.size)
return <span>{count} selected</span>
```

**★ Symptom: a hydration mismatch warning on the board, only for returning users.** Cause: `persist` restoring a field that changes the first render's markup. Fix: option A or option B above — and pick A unless the value is genuinely worth a visible flash. The mismatch is not fixed by `suppressHydrationWarning`; that hides the warning and leaves the DOM in whichever state React decided, which is worse than the flash.

**★ Symptom: navigating from board A to board B keeps A's selection, and adding a field made it worse.** Cause: a hand-written `reset()` that enumerates fields and has fallen behind the state type. Fix: `key={boardId}` on the provider, and delete `reset()` — a remount cannot forget a field, and a function that must be kept in sync with a type eventually will not be.

**★ Symptom: TypeScript accepts `useBoardUi()` with no argument and that component re-renders constantly.** Cause: the wrapper's selector parameter was made optional to mirror `useStore`'s documented signature, which does allow omitting it. Fix: keep it required in your wrapper. The one-character difference between `selector: (s: BoardUiStore) => T` and `selector?: …` is the difference between a store that is efficient by construction and one that is efficient only when everybody remembers.

**★ Symptom: a `useShallow` selector still re-renders on every store write.** Cause: `useShallow` compares one level deep, so a selector returning `{ selection: s.selection }` is stable only while the `Set` identity is stable — and every `toggleSelected` replaces it, correctly. Fix: shallow-compare the thing that actually changes rarely, not the container. If the component renders `selection.size`, select `s.selection.size`; if it renders whether *this* card is selected, select `s.selection.has(cardId)`. Both are primitives and neither needs `useShallow` at all.

**★ Symptom: an action reads stale state inside an async callback.** Cause: destructuring state at the top of a handler and then awaiting, so the value is from before the await. Fix: read through `getState()` at the point of use, after the await, since `getState()` is always current:

```ts
// 🚩 selection as it was before the network call
const { selection } = api.getState()
await moveCards(selection)
// ✅ re-read after the await if the value matters then
await moveCards(api.getState().selection)
```

## Interview questions

**★ Why does a selector returning `{ a, b }` cause an infinite loop in v5, when the same code was fine in v4?**
v5 aligned with React's default comparison, so the subscription compares the selector's output by reference. An object literal is a new reference every call, so the value always looks changed, which schedules a render, which runs the selector again — the migration guide says exactly this and names the resulting `Maximum update depth exceeded` error. The fixes are to return a stable value (select primitives individually) or to make the comparison structural with `useShallow`, which memoises the selector using a shallow compare.

**★ When do you read the store with `getState()` and when with a selector hook?**
Selector when the value is rendered; `getState()` when the value is only consulted. A rendered value must be reactive, and `getState()` gives you a snapshot with no subscription, so a component that renders from it shows whatever was true at mount. A consulted value — "is anything selected right now, at the instant of this click?" — is better read imperatively, because subscribing would re-render the handler's component every time the value changed for no rendering benefit. In a `pointermove` handler the difference is not stylistic: subscribing would mean a re-render per frame.

**★ How do you reset this store when the user navigates from one board to another, and why not just call a `reset()` action?**
Put `key={boardId}` on the provider. A changed key gives React a new component instance, the lazy `useState` initialiser runs again, and the previous store is discarded whole. A `reset()` action has to name every field, so it is correct only until the next field is added — and the failure is invisible in development because you rarely navigate board-to-board while testing. Resetting by identity is not just less code; it is the version that cannot fall behind the type.

**★ You persist the user's collapsed columns and get a hydration warning. What are the actual options?**
Three, and two of them are honest. Stop persisting it, so the value is session-only and both renders agree — usually correct, because "which columns I folded" rarely deserves durability. Or render the server's value first and adopt the persisted one in an effect after mount, which fixes the mismatch and pays for it with a visible flash as the column collapses. The third option, `suppressHydrationWarning`, is not a fix: it silences the report while leaving the DOM in whichever state React happened to keep. If the value truly must be right on first paint, it has to be readable by the server — a cookie or the URL — which means it is no longer client state.

**★ A colleague replaces every selector in the board with `useShallow`. Is that an improvement?**
No, it is a slower default dressed as a safe one. `useShallow` adds a comparison over the selector's output on every store write; for a selector already returning a primitive, that comparison is strictly wasted work, and there is no loop for it to prevent. It earns its place exactly where a selector must build a new object or array. The better habit is to make selectors return primitives — `s.selection.has(cardId)` rather than `s.selection` — which needs no memoisation and gives finer re-render granularity at the same time.

**★ The board has four columns. What determines how many of them re-render when a card is dragged over one of them?**
The shape of the selector, not the store. `setDropTarget` writes a new object each pointer move, so a column selecting `s.dropTarget` re-renders every frame regardless of whether it is involved — four columns, sixty times a second. A column selecting `s.dropTarget?.columnId === columnId` gets a boolean, and a boolean only changes for the column the pointer left and the column it entered, so at most two components re-render per crossing and zero re-render while the pointer moves within one column. The store write frequency is identical; the render count differs by two orders of magnitude.

---

← [07e · The scoped store](07e-milestone-the-scoped-zustand-store.md) · [Chapter 8 overview](01-explanation.md) · Next → [07g · The drag layer](07g-milestone-the-drag-layer.md)
