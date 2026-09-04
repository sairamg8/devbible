---
title: "Zustand's default store is module state, and module state on a server is shared across every request that process handles — so the pattern that makes it correct in Next.js is a store factory behind a provider, not the create() call in the README"
sidebar_label: "04d · Zustand in an RSC app"
sidebar_position: 133
description: "The Zustand 5.0.15 store model, selector subscriptions and useShallow, and the per-request store factory the maintainers document for Next.js — plus why a module-level singleton holding user data is a cross-request leak rather than a style preference."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-05 against the Zustand documentation — [Setup with Next.js](https://github.com/pmndrs/zustand/blob/main/docs/learn/guides/nextjs.md),
> [Initialize state with props](https://github.com/pmndrs/zustand/blob/main/docs/learn/guides/initialize-state-with-props.md),
> [`useShallow`](https://github.com/pmndrs/zustand/blob/main/docs/reference/hooks/use-shallow.md).
> Version confirmed from the npm registry: **`zustand` 5.0.15** (MIT).
> Target: **Next.js 16.3.4** App Router · **React 19.2.8**.
> Documentation-verified; **no sandbox run**.

**Zustand is the sixty lines from [04c](04c-usesyncexternalstore-the-escape-hatch.md) with the edges finished: a closure holding state, a set of listeners, and a hook that subscribes with a selector. Everything in its README works because a `create()` call produces a module-level store, and module scope is exactly the right lifetime in a browser. On a server it is exactly the wrong one — module scope is shared by every request the process handles, so a singleton holding one user's data is visible to the next user's render. The maintainers say this in the first paragraph of their own Next.js guide, and the fix is a store *factory* behind a provider, which is also what makes state reset correctly across client-side navigation.**

## The store model

```ts filename="app/[tenant]/board/board-store.ts"
import { createStore } from 'zustand/vanilla'

export type BoardState = {
  draggedId: string | null
  hoverColumn: string | null
  selection: string[]
}

export type BoardActions = {
  startDrag: (id: string) => void
  hover: (columnId: string | null) => void
  endDrag: () => void
  toggleSelection: (id: string) => void
}

export type BoardStore = BoardState & BoardActions

export const defaultBoardState: BoardState = {
  draggedId: null,
  hoverColumn: null,
  selection: [],
}

export const createBoardStore = (initState: BoardState = defaultBoardState) =>
  createStore<BoardStore>()((set) => ({
    ...initState,
    startDrag: (id) => set({ draggedId: id }),
    hover: (columnId) => set({ hoverColumn: columnId }),
    endDrag: () => set({ draggedId: null, hoverColumn: null }),
    toggleSelection: (id) =>
      set((s) => ({
        selection: s.selection.includes(id)
          ? s.selection.filter((x) => x !== id)
          : [...s.selection, id],
      })),
  }))
```

Note `zustand/vanilla` and `createStore`, not `zustand` and `create`. `create` produces a store *and* a bound React hook in one step, which is what makes it a module-level singleton. `createStore` produces only the store, so you decide its lifetime — which is the entire point of this page.

## 🔴 Why a module-level store is wrong on a server

The Zustand documentation states the problem before it states the API:

> *"Keep in mind that Zustand store is a global variable (AKA module state) making it optional to use a `Context`."*
> — [Setup with Next.js](https://github.com/pmndrs/zustand/blob/main/docs/learn/guides/nextjs.md)

> *"**Per-request store:** A Next.js server can handle multiple requests simultaneously. This means that the store should be created per request and should not be shared across requests."*
> — same page

> *"**No global stores** - Because the store should not be shared across requests, it should not be defined as a global variable. Instead, the store should be created per request."*
> — same page

Read that as a security statement, because it is one. A module-level `create()` runs **once per Node process**, not once per request. If anything ever writes user-scoped data into it during server rendering — a workspace, a session, a name in a header — that value stays in memory and is present when the next request renders. The bug does not look like a leak; it looks like an intermittently wrong name in the corner of the page, reported by one user and reproducible by nobody.

Two more constraints from the same page, each with its own consequence:

> *"**SSR friendly:** Next.js applications are rendered twice, first on the server and again on the client. Having different outputs on both the client and the server will result in 'hydration errors.'"*

> *"**SPA routing friendly:** Next.js supports a hybrid model for client side routing, which means that in order to reset a store, we need to initialize it at the component level using a `Context`."*

That third one is the reason the provider is not merely a safety measure: a module-level store *never resets*, so navigating from one board to another carries the previous board's drag state and selection with you.

And the rule that removes a whole category of confusion:

> *"**React Server Components should not read from or write to the store** - RSCs cannot use hooks or context. They aren't meant to be stateful. Having an RSC read from or write values to a global store violates the architecture of Next.js."*
> — same page

## The provider factory

```tsx filename="app/[tenant]/board/board-store-provider.tsx"
'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'
import { useStore } from 'zustand'
import {
  createBoardStore,
  defaultBoardState,
  type BoardState,
  type BoardStore,
} from './board-store'

export type BoardStoreApi = ReturnType<typeof createBoardStore>

export const BoardStoreContext = createContext<BoardStoreApi | undefined>(undefined)

export function BoardStoreProvider({
  children,
  initState = defaultBoardState,
}: {
  children: ReactNode
  initState?: BoardState
}) {
  const [store] = useState(() => createBoardStore(initState))
  return <BoardStoreContext.Provider value={store}>{children}</BoardStoreContext.Provider>
}

export function useBoardStore<T>(selector: (store: BoardStore) => T): T {
  const boardStoreContext = useContext(BoardStoreContext)
  if (!boardStoreContext) {
    throw new Error('useBoardStore must be used within BoardStoreProvider')
  }
  return useStore(boardStoreContext, selector)
}
```

This is the documented shape, with one deliberate change. The Zustand guide's example uses `useState(() => createCounterStore())`; the reference note beside it explains why the guard matters:

> *"In this example, we ensure that this component is re-render-safe by checking the value of the reference, so that the store is only created once. This component will only be rendered once per request on the server, but might be re-rendered multiple times on the client if there are stateful client components located above this component in the tree, or if this component also contains other mutable state that causes a re-render."*
> — [Setup with Next.js, Providing the store](https://github.com/pmndrs/zustand/blob/main/docs/learn/guides/nextjs.md)

The change is the `initState` prop, which comes from the [Initialize state with props](https://github.com/pmndrs/zustand/blob/main/docs/learn/guides/initialize-state-with-props.md) guide:

> *"In cases where dependency injection is needed, such as when a store should be initialized with props from a component, the recommended approach is to use a vanilla store with React.context."*

That is how server-rendered data becomes the store's initial state without a hydration mismatch — the seed is a prop, so it is identical on both renders by construction.

## Seeding from the server

```tsx filename="app/[tenant]/board/page.tsx"
import { getBoard } from '@/data/board'
import { BoardStoreProvider } from './board-store-provider'
import { Columns } from './columns'

export default async function BoardPage(props: PageProps<'/[tenant]/board'>) {
  const { tenant } = await props.params
  const board = await getBoard(tenant)

  return (
    <BoardStoreProvider
      initState={{ draggedId: null, hoverColumn: null, selection: board.defaultSelection }}
    >
      <Columns columns={board.columns} />
    </BoardStoreProvider>
  )
}
```

Three properties of this arrangement, all consequences of choices made earlier:

1. **No hydration mismatch is possible.** The server renders the provider with `initState`; the client hydrates the same component with the same serialised prop, so the first client snapshot equals the server snapshot by construction. This is the `getServerSnapshot` rule from [04c](04c-usesyncexternalstore-the-escape-hatch.md), satisfied structurally rather than by discipline.
2. **The store's lifetime is the page's.** Mounted in `page.tsx` it unmounts on navigation, so the next board starts clean. Mounted in `layout.tsx` it would survive navigation between sibling routes — sometimes exactly what you want for a persistent side panel, and a bug for a per-board drag layer.
3. **`initState` is serialised into the RSC payload.** Same warning as [04](04-client-state-tools-compared-react-context-zustand-jotai.md): seed the fields the UI renders, not the row you fetched.

## Selectors, and the object-selector trap

```tsx filename="app/[tenant]/board/card.tsx"
'use client'

import { useBoardStore } from './board-store-provider'

export function Card({ id }: { id: string }) {
  // A primitive selector: this card re-renders only when its own flag flips.
  const isDragging = useBoardStore((s) => s.draggedId === id)
  const startDrag = useBoardStore((s) => s.startDrag)   // stable function reference
  return (
    <li data-dragging={isDragging} onPointerDown={() => startDrag(id)}>
      {id}
    </li>
  )
}
```

An object selector re-renders on every store change, for the reason [04c](04c-usesyncexternalstore-the-escape-hatch.md) explains: a new object each call is never equal under `Object.is`. Zustand ships the fix as a first-class hook.

```tsx
import { useShallow } from 'zustand/react/shallow'

const { isDragging, isHovered } = useBoardStore(
  useShallow((s) => ({ isDragging: s.draggedId === id, isHovered: s.hoverColumn === columnId })),
)
```

> *"`useShallow` is a React Hook that lets you optimize re-renders."*
> *"`useShallow` returns a memoized version of a selector function using a shallow comparison for memoization."*
> — [`useShallow`](https://github.com/pmndrs/zustand/blob/main/docs/reference/hooks/use-shallow.md)

Signature, for the record: `useShallow<T, U = T>(selectorFn: (state: T) => U): (state: T) => U`.

## Gotchas

**★ Symptom: one user occasionally sees another user's workspace name, and nobody can reproduce it.** Cause: a module-level `create()` store was written to during server rendering, and module scope persists across requests in the same Node process. Fix: a factory plus a provider, so the store's lifetime is one mount.

```ts
// ❌ export const useBoardStore = create<BoardStore>()(...)   // one per process
export const createBoardStore = (init: BoardState) => createStore<BoardStore>()(/* … */)
```

**★ Symptom: navigating from one board to another keeps the previous board's selection.** Cause: the store is module-level, or the provider is mounted in a layout, which does not remount on navigation. Fix: mount the provider in the segment that owns the state.

```tsx filename="app/[tenant]/board/page.tsx"
<BoardStoreProvider initState={init}><Columns columns={board.columns} /></BoardStoreProvider>
```

**★ Symptom: the store resets whenever an ancestor client component re-renders.** Cause: the factory was called eagerly — `useState(createBoardStore(init))` rather than `useState(() => createBoardStore(init))`, or assigned in the component body. Fix: the lazy initialiser.

```tsx
const [store] = useState(() => createBoardStore(initState))
```

**★ Symptom: every card re-renders on every pointer move despite using a selector.** Cause: the selector returns a new object, so shallow-inequality is guaranteed. Fix: primitives, or `useShallow`.

```tsx
const isDragging = useBoardStore((s) => s.draggedId === id)                  // ✅
// or
const flags = useBoardStore(useShallow((s) => ({ a: s.draggedId, b: s.hoverColumn })))
```

**★ Symptom: `useBoardStore((s) => s)` works and the app is unusably slow.** Cause: selecting the whole state means every component subscribes to every change — the exact behaviour the library exists to avoid. Fix: select the narrowest value each component actually reads.

```tsx
// ❌ const { count, incrementCount } = useCounterStore((state) => state)
const count = useCounterStore((s) => s.count)
const incrementCount = useCounterStore((s) => s.incrementCount)
```

**★ Symptom: a hydration error on first load after seeding the store from `localStorage`.** Cause: the client's initial state differed from the server's, because the server cannot read `localStorage`. Fix: seed from a server-provided prop and apply the browser value in an effect after mount, accepting one deliberate update.

```tsx
useEffect(() => {
  const saved = window.localStorage.getItem('board-selection')
  if (saved) store.getState().restoreSelection(JSON.parse(saved))
}, [store])
```

**★ Symptom: a Server Component imports the store and calls `getState()`.** Cause: treating the store as an ambient global. Fix: Server Components must not read or write the store at all — fetch on the server and pass the value down as a prop or as `initState`.

```tsx
// ❌ const { selection } = boardStore.getState()   // in a Server Component
const board = await getBoard(tenant)               // ✅ fetch, then seed
```

**★ Symptom: `useBoardStore must be used within BoardStoreProvider` in a modal.** Cause: the modal is rendered through a portal or a parallel route slot that sits outside the provider's subtree. Fix: move the provider above the slot, or pass the store instance explicitly to the portal's own provider.

**★ Symptom: a `set` call updates one field and silently drops the rest of a nested object.** Cause: `set` merges shallowly at the top level only, so replacing a nested object replaces it wholesale. Fix: spread the nested level explicitly, or use the immer middleware.

```ts
set((s) => ({ filters: { ...s.filters, status: 'blocked' } }))
```

**★ Symptom: an action captured a stale value from a closure.** Cause: the action read a variable from the enclosing scope instead of the current state. Fix: use the functional form of `set`, which receives the live state.

```ts
// ❌ toggle: () => set({ open: !open })
toggle: () => set((s) => ({ open: !s.open }))
```

## Interview questions

**★ Why is a module-level Zustand store a bug in a Next.js app rather than a style preference?**
Because module scope on a server is process scope, not request scope. A `create()` call runs once when the module is first imported by the Node process, and every request that process subsequently handles renders against that same object. Any user-scoped value written into it during a server render is therefore visible to the next request's render. The Zustand maintainers state this first in their own Next.js guide: the store should be created per request and should not be shared across requests, and therefore should not be a global variable. The failure is intermittent and cross-user, which makes it both a security issue and one of the hardest classes of bug to reproduce.

**★ What does the provider give you beyond request isolation?**
Reset semantics. Next.js does client-side routing, so a module-level store never unmounts and never resets — navigating from one board to another carries the previous board's drag state, selection and open panels with it. A store created inside a provider mounted at the right level lives exactly as long as that subtree, so navigation resets it for free. It also gives you dependency injection: the same provider can be seeded with different initial state per route, and a test can mount it with a fixture instead of monkey-patching a module.

**★ Where should the provider be mounted, and what does the choice change?**
At the lowest level that owns the state. In `page.tsx` for state belonging to that page — a board's drag layer, a wizard's step — because the page unmounts on navigation and the state resets. In a `layout.tsx` for state that should deliberately survive navigation between its children, such as a persistent side panel or an audio player. Getting it wrong in the layout direction produces stale state after navigation; getting it wrong in the page direction loses state a user expected to persist. It is the same "render providers as deep as possible" rule as [04](04-client-state-tools-compared-react-context-zustand-jotai.md), with an added semantic dimension.

**★ How do you seed a Zustand store with server-rendered data without a hydration mismatch?**
Pass the initial state to the provider as a prop from a Server Component, and have the provider hand it to the store factory. The server renders the provider with that prop and the client hydrates the same component with the same serialised prop, so the first client snapshot equals the server snapshot by construction rather than by discipline — which is exactly the `getServerSnapshot` requirement satisfied structurally. What you must not do is seed from anything the server cannot see: `localStorage`, `window`, the current time. Those are applied after mount, in an effect, as one deliberate update.

**★ Why does `useBoardStore((s) => s)` defeat the purpose of the library?**
Because the value of a selector-based store is that each component subscribes to a narrow slice and re-renders only when that slice changes. Selecting the entire state object means every component subscribes to every change, and — worse — the returned object is a new reference on each store update, so even components whose fields did not change re-render. You have reimplemented Context with extra steps. The discipline is one selector per value read, returning a primitive where possible, and `useShallow` when a component genuinely needs several fields together.

**★ What is `useShallow` for, and why does the library need it at all?**
Because a selector returning an object literal produces a new reference on every call, and the store compares results by reference — so the component re-renders on every store change, and under `useSyncExternalStore` semantics an uncached snapshot can loop outright. `useShallow` returns a memoised version of the selector that compares its result shallowly, so `{ a: 1, b: 2 }` and a freshly built `{ a: 1, b: 2 }` are treated as equal. Its existence is the tell that this is the single most common mistake with selector stores; the alternative — one primitive selector per value — is often clearer and needs no import.

**★ Why must a Server Component never read the store?**
Because Server Components cannot use hooks or context, are not stateful, and render on a server where the store is either absent or shared across requests. Reading `store.getState()` from an RSC therefore either fails or silently reads another request's data — and the maintainers describe it as violating the architecture rather than merely being unsupported. The correct direction of flow is the reverse: the Server Component fetches, passes values down as props, and a Client Component seeds the store with them. Data flows server-to-client through props; the store is a purely client-side concern.

---

← [04c · useSyncExternalStore, the escape hatch](04c-usesyncexternalstore-the-escape-hatch.md) · [Chapter 8 overview](01-explanation.md) · Next → [04e · Jotai in an RSC app](04e-jotai-in-an-rsc-app.md)
