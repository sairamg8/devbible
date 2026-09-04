---
title: "A Zustand store created at module scope is a variable shared by every request the server process handles, so the board's store is manufactured per mount by a provider — and the only thing that changes is where the create call sits"
sidebar_label: "07e · Milestone: the scoped store"
sidebar_position: 163
description: "Chapter 8's capstone, step four: why a module-level store is cross-user data exposure on the server, createStore from zustand/vanilla behind a per-mount provider factory, the typed selector hook, and the table of what ephemeral UI state is allowed in the store and what is banned from it."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-05 against the Zustand docs — [Setup with Next.js](https://github.com/pmndrs/zustand/blob/main/docs/learn/guides/nextjs.md)
> and [`useStore`](https://github.com/pmndrs/zustand/blob/main/docs/reference/hooks/use-store.md).
> Version read from the npm registry on 2026-09-05: **zustand 5.0.15**.
> Target: **Next.js 16.3.4** App Router · **React 19.2.8** · **zustand 5.0.15**.
> Documentation-verified; **no sandbox run**.

**The three-line difference between a Zustand store that works and one that leaks across users is where the `create` call sits.** `export const useBoardUi = create(...)` at the top of a module is a module-level variable, and on the server a module is instantiated once per process and shared by every request it serves — so anything a user's render writes into it is visible to the next user's render. The fix is not a Zustand feature; it is a factory called inside a React hook, handed down through Context, one instance per mount. This page builds that and fixes the store's contents. Using it without producing a re-render storm is [07f](07f-milestone-selectors-resets-and-hydration.md).

## What the Zustand docs actually require

Three sentences from the framework's own Next.js guide, all load-bearing:

> *"**Per-request store:** A Next.js server can handle multiple requests simultaneously. This means that the store should be created per request and should not be shared across requests."*
>
> *"**No global stores** - Because the store should not be shared across requests, it should not be defined as a global variable. Instead, the store should be created per request."*
>
> *"**React Server Components should not read from or write to the store** - RSCs cannot use hooks or context. They aren't meant to be stateful. Having an RSC read from or write values to a global store violates the architecture of Next.js."*
> — [Zustand, *Setup with Next.js*](https://github.com/pmndrs/zustand/blob/main/docs/learn/guides/nextjs.md)

The third one is the reason `page.tsx` in [07c](07c-milestone-reading-filters-in-the-page.md) renders `BoardUiProvider` but never touches the store: a Server Component *cannot* read it, and the day someone makes it possible with a module-scoped `getState()`, the first bullet's leak becomes real.

## The store factory

The store is built with `createStore` from `zustand/vanilla`, not `create` from `zustand`. That is the whole trick: `create` returns a React hook bound to one store instance; `createStore` returns a plain store API you can make as many of as you like.

```ts filename="stores/board-ui-store.ts"
import { createStore } from 'zustand/vanilla'

export type DropTarget = { columnId: string; index: number }

export type BoardUiState = {
  /** The card currently under the pointer in a drag, or null. */
  draggingCardId: string | null
  /** Where a drop would land right now. Drives the placeholder, nothing else. */
  dropTarget: DropTarget | null
  /** Multi-select. Ids only — never card rows. */
  selection: Set<string>
  /** Columns the user has folded. Ids only. */
  collapsed: Set<string>
}

export type BoardUiActions = {
  beginDrag: (cardId: string) => void
  setDropTarget: (target: DropTarget | null) => void
  endDrag: () => void
  toggleSelected: (cardId: string) => void
  clearSelection: () => void
  toggleCollapsed: (columnId: string) => void
}

export type BoardUiStore = BoardUiState & BoardUiActions

export const emptyBoardUiState: BoardUiState = {
  draggingCardId: null,
  dropTarget: null,
  selection: new Set(),
  collapsed: new Set(),
}

export function createBoardUiStore(init: BoardUiState = emptyBoardUiState) {
  return createStore<BoardUiStore>()((set) => ({
    ...init,

    beginDrag: (cardId) => set({ draggingCardId: cardId, dropTarget: null }),

    setDropTarget: (target) => set({ dropTarget: target }),

    endDrag: () => set({ draggingCardId: null, dropTarget: null }),

    toggleSelected: (cardId) =>
      set((s) => {
        // A new Set every time — mutating the existing one changes nothing
        // React can observe. See 07f.
        const next = new Set(s.selection)
        next.has(cardId) ? next.delete(cardId) : next.add(cardId)
        return { selection: next }
      }),

    clearSelection: () => set({ selection: new Set() }),

    toggleCollapsed: (columnId) =>
      set((s) => {
        const next = new Set(s.collapsed)
        next.has(columnId) ? next.delete(columnId) : next.add(columnId)
        return { collapsed: next }
      }),
  }))
}

export type BoardUiStoreApi = ReturnType<typeof createBoardUiStore>
```

Four fields. Every one of them is an id, a null, or a set of ids — no card rows, no column rows, no filters, no pending mutations. That constraint is checkable: **if a field's type mentions a type that came out of the database, the field is in the wrong store.**

## The provider

```tsx filename="providers/board-ui-provider.tsx"
'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'
import { useStore } from 'zustand'
import {
  createBoardUiStore,
  type BoardUiStore,
  type BoardUiStoreApi,
} from '@/stores/board-ui-store'

const BoardUiContext = createContext<BoardUiStoreApi | null>(null)

export function BoardUiProvider({ children }: { children: ReactNode }) {
  // The lazy initialiser runs once per mount. Calling createBoardUiStore()
  // directly in the JSX would build a new store on every render.
  const [store] = useState(() => createBoardUiStore())

  return (
    <BoardUiContext.Provider value={store}>{children}</BoardUiContext.Provider>
  )
}

export function useBoardUi<T>(selector: (state: BoardUiStore) => T): T {
  const store = useContext(BoardUiContext)
  if (!store) {
    throw new Error('useBoardUi must be used inside <BoardUiProvider>')
  }
  return useStore(store, selector)
}

/** Escape hatch for event handlers: read/write without subscribing. See 07f. */
export function useBoardUiApi(): BoardUiStoreApi {
  const store = useContext(BoardUiContext)
  if (!store) {
    throw new Error('useBoardUiApi must be used inside <BoardUiProvider>')
  }
  return store
}
```

The selector parameter is mandatory, not optional. `useStore`'s documented signature makes it optional —

> *"`useStore<T, U = T>(store: StoreApi<T>, selectorFn?: (state: T) => U): U`"*
> — [Zustand, `useStore`](https://github.com/pmndrs/zustand/blob/main/docs/reference/hooks/use-store.md)

— and this wrapper deliberately removes that option, because a selector-less subscription re-renders the component on *every* store write. During a drag that is one write per `pointermove`, and the component subscribed without a selector is usually the board.

Context here carries one value that never changes: the store API object. So Context's classic problem — every consumer re-rendering because the context value changed — does not arise, and the re-render granularity comes entirely from `useStore(api, selector)`.

## What goes in, and what is banned

| Field | In the store? | Why |
|---|---|---|
| `draggingCardId` | ✅ | Meaningless after this mount; needed by three sibling components |
| `dropTarget` | ✅ | Same, and it changes ~60 times a second so it must not be a URL |
| `selection` | ✅ | Ephemeral, mount-scoped, would spam history if it were a URL |
| `collapsed` | ✅ | Ephemeral per mount; see [07](07-project-milestone-sprintdesk-board-filters-in-the-url.md) for why not `localStorage` |
| Card rows | ⛔ | Server cache owns them. A copy here is a second cache with no invalidation |
| Filters | ⛔ | URL owns them. A copy here is the "input disagrees with the address bar" bug |
| Pending moves | ⛔ | `useOptimistic` owns them, and only for the length of a transition ([07h](07j-milestone-the-drop-the-action-and-reconciliation.md)) |
| The pointer's coordinates | ⛔ | A ref, written straight to the DOM. React state at 60Hz re-renders the board |
| Column DOM rects | ⛔ | A ref map. They change on scroll and resize and nothing renders from them |

The last two are the ones that surprise people: state that changes every frame is not store state, it is ref state, and putting it in the store turns a smooth drag into a re-render storm.

## Gotchas

**★ Symptom: in production, one user occasionally sees another user's selection or collapsed columns on first paint.** Cause: the store was created at module scope — `export const useBoardUi = create(...)` — so it is a module-level variable, and on the server a module is shared by every request the process handles. The Zustand guide's rule is *"No global stores … the store should be created per request."* Fix: a factory plus a provider, exactly as above:

```ts
// 🚩 one store for the whole server process
export const useBoardUi = create<BoardUiStore>()((set) => ({ /* … */ }))
// ✅ a function that makes a store; the provider calls it per mount
export function createBoardUiStore() {
  return createStore<BoardUiStore>()((set) => ({ /* … */ }))
}
```

**★ Symptom: the store resets to empty on every render, and nothing you set ever sticks.** Cause: the factory is being called during render instead of inside a lazy initialiser — `<Ctx.Provider value={createBoardUiStore()}>` builds a new store each time. Fix: `const [store] = useState(() => createBoardUiStore())`. A `useRef` with a null check works too; `useMemo` does **not**, because React is permitted to discard a memo and re-run it, which silently recreates the store.

**★ Symptom: `Cannot read properties of null (reading 'getState')`, or the store appears empty in one subtree.** Cause: a component using the hook outside the provider — typically because it was moved into a layout, or because two modules each called `createContext` and the component imported the wrong one through a path-alias mismatch. Fix: the explicit throw in `useBoardUi`, which converts a confusing null into a message naming the provider, and exactly one module exporting the context.

**★ Symptom: a Server Component cannot import the store module — the build fails on a hook call, or on `createContext` outside a Client Component.** Cause: exactly what the guide says should not be attempted: *"React Server Components should not read from or write to the store - RSCs cannot use hooks or context."* Fix: the store is client-only by construction. If a Server Component needs a value the store holds, that value has the wrong owner — re-run the four questions in [07](07-project-milestone-sprintdesk-board-filters-in-the-url.md), and it will turn out to belong in the URL.

**★ Symptom: a field crept into the store that nobody can explain, and now two components disagree about a card's column.** Cause: the store grew a `cards` array "just for the drag", which is a second copy of server state with no invalidation protocol. Fix: enforce the type-level rule mechanically — the state type may reference only `string`, `number`, `boolean`, `null` and `Set<string>`:

```ts
// 🚩 the row type from the database has entered the store
type BoardUiState = { cards: CardRow[]; draggingCardId: string | null }
// ✅ ids only; the rows stay where the server put them
type BoardUiState = { draggingCardId: string | null; selection: Set<string> }
```

## Interview questions

**★ Why is a module-level Zustand store a *security* problem in Next.js rather than just a tidiness problem?**
Because a module in a server process is instantiated once and shared by every request that process handles. A store created at module scope therefore has one instance for all concurrent users, so anything written into it during one user's server render is readable during another's. The Zustand docs state the requirement plainly — the store must be created per request and must not be a global variable. On the client the same store is merely a bug (state surviving navigations that should reset it); on the server it is cross-user data exposure, and the two failure modes come from the same line of code.

**★ Why `createStore` from `zustand/vanilla` instead of `create` from `zustand`?**
`create` returns a React hook already bound to a single store instance, which is precisely the global you are trying to avoid. `createStore` returns a plain store API — `getState`, `setState`, `subscribe` — with no React coupling, so you can call it once per mount and pass the instance through Context, then bind it to React at the point of use with `useStore(api, selector)`. It is the same store; the difference is who owns the instance.

**★ Zustand exists to avoid Context's re-render problem. Why is this design full of Context?**
Because the two solve different problems and this design uses each for its own. Context here carries *one value that never changes* — the store API object, created once per mount — so it never triggers a re-render of its consumers. The re-render granularity comes from `useStore(api, selector)`, which subscribes each component to exactly the slice it renders. Putting the *state* in Context is what causes the classic problem: every consumer re-renders on every change because the context value changes. Putting a stable handle in Context and subscribing selectively does not.

**★ What is in this store, and what did you deliberately keep out?**
In: four fields, all ephemeral and all identifiers — the dragging card id, the current drop target, a `Set` of selected card ids, a `Set` of collapsed column ids. Out: the card rows (the server cache owns them, and a copy is a second cache with no invalidation), the filters (the URL owns them), pending moves (`useOptimistic` owns them for the duration of a transition), and anything that changes per animation frame such as pointer coordinates and element rects, which live in refs because sixty store writes a second is sixty re-renders a second. The rule I check against is that no field's type may mention a type that came from the database.

**★ When would you not reach for a store at all here?**
When one component owns the state and its children can receive it as props — that is `useState`, and it is the right answer far more often than the board makes it look. The board needs a store because the drag state is written by the card being dragged and read by every column and the drop placeholder, which are siblings several levels apart with a server-rendered component in between them; prop-drilling through that boundary is not possible, and lifting to the nearest common ancestor would re-render the entire board on every pointer move. Those two properties — sibling access across a server boundary, and a high write frequency that must not re-render everything — are what justify a store. Absent both, use state.

**★ The provider takes `key={boardId}` in the page. What would go wrong without it?**
Navigating from board A to board B under the same layout reuses the provider's component instance, so `useState(() => createBoardUiStore())` does not re-run and board B inherits A's selection and collapsed columns. It is not a Zustand behaviour at all — it is React reconciliation keeping a component with the same type and position — and the same fix applies to any per-resource provider. The alternative, a `reset()` action, is discussed and rejected in [07f](07f-milestone-selectors-resets-and-hydration.md).

---

← [07d · The filter bar](07d-milestone-the-filter-bar.md) · [Chapter 8 overview](01-explanation.md) · Next → [07f · Selectors, resets and hydration](07f-milestone-selectors-resets-and-hydration.md)
