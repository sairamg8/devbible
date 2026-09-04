---
title: "Put a stable store handle in Context and subscribe to its contents with useSyncExternalStore, and the fan-out never fires — this is the selector API Context lacks, and it is what every client-state library actually is"
sidebar_label: "04c · useSyncExternalStore, the escape hatch"
sidebar_position: 132
description: "A sixty-line store with per-selector subscriptions, the two rules useSyncExternalStore enforces — a cached getSnapshot and a getServerSnapshot that matches the server — and why omitting the third argument throws under App Router server rendering."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against the React reference — [`useSyncExternalStore`](https://react.dev/reference/react/useSyncExternalStore),
> [`useContext`](https://react.dev/reference/react/useContext).
> Target: **React 19.2.8** · **Next.js 16.3.4** App Router.
> Documentation-verified; **no sandbox run**.

**Context's fan-out fires when the context *value* changes. So do not change it. Put a store handle in the context — created once, never replaced — and let components subscribe to the store's contents through `useSyncExternalStore` with their own selectors. The context value is now permanently stable, the fan-out never fires at all, and each component re-renders only when the slice it asked for changes. That is the selector API Context does not have, and it is, structurally, what Zustand and Jotai are. Sixty lines gets you there, and writing them once is the cheapest way to understand what you are buying when you install the library instead.**

## The store

Plain JavaScript. No React, no framework, no directive — which is the first thing worth noticing, because it means the store is testable without a renderer.

```ts filename="app/[tenant]/board/drag-store.ts"
export type DragState = { draggedId: string | null; hoverColumn: string | null }

export function createDragStore(initial: DragState) {
  let state = initial
  const listeners = new Set<() => void>()

  return {
    getSnapshot: () => state,
    getServerSnapshot: () => initial,   // stable; identical on server and first client render
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    set(next: Partial<DragState>) {
      state = { ...state, ...next }
      listeners.forEach((l) => l())
    },
  }
}

export type DragStore = ReturnType<typeof createDragStore>
```

`getSnapshot` returns the *same object* until `set` replaces it. That is not an implementation detail — it is the contract React enforces, and the next section is what happens when you break it.

## The provider holds a handle, not a value

```tsx filename="app/[tenant]/board/drag-store-provider.tsx"
'use client'

import { createContext, useContext, useState, useSyncExternalStore } from 'react'
import { createDragStore, type DragState, type DragStore } from './drag-store'

const DragStoreContext = createContext<DragStore | null>(null)

export function DragStoreProvider({
  initial,
  children,
}: {
  initial: DragState
  children: React.ReactNode
}) {
  // Created once per mount. The context value never changes, so the
  // context fan-out never fires.
  const [store] = useState(() => createDragStore(initial))
  return <DragStoreContext.Provider value={store}>{children}</DragStoreContext.Provider>
}

export function useDragSlice<T>(selector: (s: DragState) => T): T {
  const store = useContext(DragStoreContext)
  if (!store) throw new Error('useDragSlice must be used within DragStoreProvider')

  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.getSnapshot()),
    () => selector(store.getServerSnapshot()),
  )
}
```

Three details carry the whole design:

1. **`useState(() => createDragStore(initial))`** — the *lazy initialiser* form. `useState(createDragStore(initial))` would construct a store on every render and throw it away, which is a subtle allocation bug; worse, a `useRef` assigned in the body has the same problem in a different shape. The lazy form runs the factory once per mount.
2. **The context value is the store object**, whose identity never changes. Every consumer of `DragStoreContext` is therefore never re-rendered *by the context*.
3. **The selector runs inside `getSnapshot`**, so React compares the *selected* value, not the whole state. A card comparing `s.draggedId === id` re-renders only when its own boolean flips.

```tsx filename="app/[tenant]/board/card.tsx"
'use client'

import { useDragSlice } from './drag-store-provider'

export function Card({ id }: { id: string }) {
  // Re-renders only when THIS card's dragging status flips.
  const isDragging = useDragSlice((s) => s.draggedId === id)
  return <li data-dragging={isDragging}>{id}</li>
}
```

Two hundred cards, one pointer move, at most two re-renders — the card that stopped being dragged and the card that started. Under plain Context it is two hundred.

## The two rules React enforces

### `getSnapshot` must be cached

> *"This error means your `getSnapshot` function returns a new object every time it's called … React will re-render the component if `getSnapshot` return value is different from the last time. This is why, if you always return a different value, you will enter an infinite loop and get this error."*
> — [`useSyncExternalStore`, Troubleshooting](https://react.dev/reference/react/useSyncExternalStore)

So a selector returning a **primitive** is always safe, and a selector returning an **object literal** always loops:

```tsx
// ❌ a new object on every call → "The result of getSnapshot should be cached"
const { isDragging, isHovered } = useDragSlice((s) => ({
  isDragging: s.draggedId === id,
  isHovered: s.hoverColumn === columnId,
}))

// ✅ two primitive subscriptions
const isDragging = useDragSlice((s) => s.draggedId === id)
const isHovered = useDragSlice((s) => s.hoverColumn === columnId)
```

There are three ways out, all in real use: select primitives (clearest); return a stable reference held by the store itself; or compare with a shallow-equality function instead of `Object.is`, which is exactly what Zustand's `useShallow` provides. The existence of a first-class API for the third option is a fair signal that this trap is common.

### `getServerSnapshot` is not optional here

> *"**optional** `getServerSnapshot`: A function that returns the initial snapshot of the data in the store. It will be used only during server rendering and during hydration of server-rendered content on the client. The server snapshot must be the same between the client and the server, and is usually serialized and passed from the server to the client. **If you omit this argument, rendering the component on the server will throw an error.**"*
> — [`useSyncExternalStore`, Parameters](https://react.dev/reference/react/useSyncExternalStore)

In the App Router every Client Component is server-rendered for the initial HTML, so "optional" is true of React and false of your app. And the harder constraint is what it must *return*:

> *"Make sure that `getServerSnapshot` returns the same exact data on the initial client render as it returned on the server. For example, if `getServerSnapshot` returned some prepopulated store content on the server, you need to transfer this content to the client. One way to do this is to emit a `<script>` tag during server rendering that sets a global like `window.MY_STORE_DATA`, and read from that global on the client in `getServerSnapshot`. Your external store should provide instructions on how to do that."*
> — [`useSyncExternalStore`, Adding support for server rendering](https://react.dev/reference/react/useSyncExternalStore)

In an App Router app there is a much simpler transfer than a `<script>` tag: **props**. The server-rendered parent passes the initial state into the provider, so the provider's `initial` is the same object on both sides, and `getServerSnapshot` returns it unchanged.

```tsx filename="app/[tenant]/board/page.tsx"
import { getBoard } from '@/data/board'
import { DragStoreProvider } from './drag-store-provider'
import { Columns } from './columns'

export default async function BoardPage(props: PageProps<'/[tenant]/board'>) {
  const { tenant } = await props.params
  const board = await getBoard(tenant)

  return (
    <DragStoreProvider initial={{ draggedId: null, hoverColumn: null }}>
      <Columns columns={board.columns} />
    </DragStoreProvider>
  )
}
```

### Anything browser-only must not be in the server snapshot

The rule above rules out `localStorage`, `window`, `Date.now()`, `Math.random()` and anything user-specific inside `getServerSnapshot`. A theme store reading `localStorage` on the client and defaulting on the server produces a hydration mismatch every time.

```ts filename="app/theme-store.ts"
export function createThemeStore(serverDefault: 'light' | 'dark') {
  let state = serverDefault
  const listeners = new Set<() => void>()

  return {
    getSnapshot: () => state,
    getServerSnapshot: () => serverDefault,        // ✅ never reads localStorage
    subscribe(l: () => void) {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    // Called from an effect after hydration — a deliberate, single update.
    hydrateFromBrowser() {
      const stored = window.localStorage.getItem('theme')
      if (stored === 'light' || stored === 'dark') {
        state = stored
        listeners.forEach((l) => l())
      }
    },
  }
}
```

The flash is real and it is the price of a value the server cannot know. What you are buying is a *deliberate* update after hydration instead of an *accidental* mismatch during it — and a mismatch is worse, because React may discard the server HTML for that subtree.

## When to stop and install something

This file is the point of the exercise, not the destination. Once you have written it, the honest comparison to `zustand` ([04d](04d-zustand-in-an-rsc-app.md)) is:

| Concern | Sixty lines above | An installed store |
|---|---|---|
| Selector subscriptions | ✅ | ✅ |
| Shallow comparison for object selectors | ❌ write it | ✅ `useShallow` |
| Devtools / time-travel | ❌ | ✅ middleware |
| Persistence | ❌ | ✅ middleware |
| Immer-style updates | ❌ | ✅ middleware |
| Documentation a new hire has already read | ❌ | ✅ |
| Dependency, and its upgrade path | ✅ none | ❌ one |

Write it by hand when the store is small, private to one feature, and unlikely to grow. Install one the moment you find yourself adding the second row of that table.

## Gotchas

**★ Symptom: `The result of getSnapshot should be cached to avoid an infinite loop`.** Cause: the snapshot function returns a new object each call, so React sees a change on every render. Fix: select a primitive, or return a stable reference.

```tsx
// ❌ useSyncExternalStore(sub, () => ({ dragged: store.getSnapshot().draggedId }))
useSyncExternalStore(sub, () => store.getSnapshot().draggedId, () => null)   // ✅ primitive
```

**★ Symptom: `Uncaught Error` during server rendering as soon as a component calls `useSyncExternalStore`.** Cause: `getServerSnapshot` was omitted, and rendering on the server throws without it. Fix: supply it, returning the same value the client will produce on its first render.

```tsx
useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot)
```

**★ Symptom: a hydration mismatch on a component that reads `localStorage` through the store.** Cause: `getServerSnapshot` returned the stored value on the client and a default on the server, so the two renders disagreed. Fix: return the same neutral value in both places and update after hydration.

```ts
getServerSnapshot: () => serverDefault     // never reads localStorage
```

**★ Symptom: the provider re-creates the store on every render, so state resets whenever a parent updates.** Cause: `createStore()` called eagerly in the component body. Fix: lazy initial state, so the factory runs once per mount.

```tsx
const [store] = useState(() => createDragStore(initial))   // ✅ not createDragStore(initial)
```

**★ Symptom: a component subscribes but never re-renders when the store changes.** Cause: `set` mutated the existing state object instead of replacing it, so `getSnapshot` returns the same reference and React concludes nothing happened. Fix: replace the object.

```ts
// ❌ set(next) { Object.assign(state, next); listeners.forEach(l => l()) }
set(next: Partial<DragState>) {
  state = { ...state, ...next }              // ✅ new reference
  listeners.forEach((l) => l())
}
```

**★ Symptom: `subscribe` is called again after every re-render, and listeners pile up.** Cause: the `subscribe` function identity changes each render — typically because it was written as an inline arrow in the hook call. Fix: pass a stable reference; a method on the store object created once is already stable.

> *"My `subscribe` function gets called after every re-render"*
> — [`useSyncExternalStore`, Troubleshooting](https://react.dev/reference/react/useSyncExternalStore)

```tsx
// ❌ useSyncExternalStore((cb) => store.subscribe(cb), …)
useSyncExternalStore(store.subscribe, getSnapshot, getServerSnapshot)   // ✅ stable
```

**★ Symptom: `useDragSlice` returns `null` in a component mounted through a portal.** Cause: the portal's React tree position is still inside the provider, but a portal rendered from a different route segment may not be. Fix: throw a named error in the hook so the boundary problem is immediate rather than a silent `null`.

```tsx
const store = useContext(DragStoreContext)
if (!store) throw new Error('useDragSlice must be used within DragStoreProvider')
```

**★ Symptom: the store survives a client-side navigation and shows the previous route's drag state.** Cause: the provider is mounted in a layout, which does not remount on navigation. Fix: mount it in the page (or the segment that owns the state), so navigating away unmounts it.

## Interview questions

**★ What does `useSyncExternalStore` change about the Context picture?**
It moves the subscription out of React's context machinery into the store's own. The context value becomes a stable handle — created once, never replaced — so the fan-out never fires at all; each component then subscribes to the store with its own selector and re-renders only when that selector's result changes. This is exactly the selector API Context lacks, and it is why every mature client-state library ends up here. It also imposes two rules: `getSnapshot` must return a cached value or you get an infinite-loop error, and `getServerSnapshot` is mandatory under server rendering and must produce the same value on the server and on the first client render.

**★ Why is `getServerSnapshot` effectively mandatory in the App Router?**
Because Client Components are still rendered on the server for the initial HTML, and the documentation is explicit that omitting `getServerSnapshot` makes rendering on the server throw. The stronger constraint is what it must return: the same exact data on the initial client render as it returned on the server, because any difference is a hydration mismatch. That rules out reading `localStorage`, `window`, `Date.now()` or anything user-specific inside it. The workable pattern is a neutral default from `getServerSnapshot` — usually the value the server passed into the provider as a prop — with the real browser-only value arriving through a normal store update after hydration, which is a deliberate flash rather than an accidental mismatch.

**★ A selector returns `{ isDragging, isHovered }` and the app hangs. What happened?**
The snapshot function returns a new object on every call, so React compares it against the previous result, finds them different, re-renders, calls the snapshot again, and loops — which is the documented cause of *"The result of getSnapshot should be cached"*. There are three fixes and they are all in use. Return a primitive per subscription, which means two hook calls instead of one and is usually clearest. Memoise the derived object so the same reference is returned while the inputs are unchanged. Or compare with a shallow-equality function instead of `Object.is`, which is what Zustand's `useShallow` provides — and its existence is a good signal that this trap is common enough to warrant a first-class API.

**★ Why does the store live in a plain module with no `'use client'`, while the provider has one?**
Because the store is not a React component and contains no hooks — it is a closure over a variable and a `Set` of listeners, so it can be imported by anything, including a test file with no renderer. The directive belongs on the file that calls `createContext` and `useSyncExternalStore`, which is the provider. Keeping the two apart has a practical payoff beyond tidiness: the store's logic is unit-testable without React, and the same store factory can be instantiated per request on the server if you ever need to, which is the seam the next two pages build on.

**★ Why `useState(() => createStore())` rather than `useRef` or a module-level constant?**
A module-level constant is the auth leak the next page is about: on a server, module scope is shared across every request the process handles. `useRef(createStore())` still calls the factory on every render — it just throws the result away — which allocates needlessly and, if the factory has side effects such as opening a socket, is a real bug. `useState` with a lazy initialiser is the only one of the three that calls the factory exactly once per mount and keeps the value for the component's lifetime. The `useState` setter is simply never used, which looks odd for about a week and then stops.

**★ When is sixty lines of your own store the right answer, and when is it not?**
It is right when the store is small, owned by one feature, and unlikely to grow — a drag layer, a wizard's step state, a canvas viewport. You get selectors, no dependency, and code every reader can follow in one sitting. It stops being right the moment you want the second row of the comparison table: shallow-comparing object selectors, devtools, persistence, immer-style updates, or a pattern a new hire has already seen elsewhere. Each of those is a middleware in an installed store and a small research project by hand. The value of writing it once is that you then know exactly what the library is doing, which makes its failure modes legible instead of magical.

---

← [04b · Context re-renders, and containing them](04b-context-re-renders-and-how-to-contain-them.md) · [Chapter 8 overview](01-explanation.md) · Next → [04d · Zustand in an RSC app](04d-zustand-in-an-rsc-app.md)
