---
title: "Jotai's atoms hold no values — a store does — and its provider-less default keeps one global store alive across every server request, which its own documentation calls a source of bugs and security risks"
sidebar_label: "04e · Jotai in an RSC app"
sidebar_position: 134
description: "The atom model and why granularity is free, why the implicit global store is a cross-request leak on a server, what the Provider scopes and when remounting it is the reset, and the read/write hook split that decides who re-renders."
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-05 against the Jotai documentation — [Next.js](https://github.com/pmndrs/jotai/blob/main/docs/guides/nextjs.mdx),
> [Provider](https://github.com/pmndrs/jotai/blob/main/docs/core/provider.mdx),
> [SSR](https://github.com/pmndrs/jotai/blob/main/docs/utilities/ssr.mdx).
> Version confirmed from the npm registry: **`jotai` 2.20.3** (MIT).
> Target: **Next.js 16.3.4** App Router · **React 19.2.8**.
> Documentation-verified; **no sandbox run**.

**Zustand starts from one store and asks you to select slices out of it. Jotai starts from the slices: an atom is a unit of state small enough that subscribing to it *is* the selector, so the re-render granularity problem never arises. The cost of that elegance is a default that is actively dangerous on a server. Atoms hold no values — a *store* does — and without a `Provider` Jotai uses one implicit global store, which on a Node process is shared by every request it handles. Jotai's own documentation names the consequence: bugs and security risks. The fix is one component. Seeding atoms from server-rendered data, and the SSR constraints on async atoms and browser storage, are [04f](04f-jotai-under-ssr.md).**

## The model: atoms are keys, the store is the map

> *"Atom configs don't hold values. Atom values reside in separate stores. A Provider is a component that contains a store and provides atom values under the component tree."*
> — [Provider](https://github.com/pmndrs/jotai/blob/main/docs/core/provider.mdx)

That sentence is the whole mental model, and it explains everything else on this page. An `atom(...)` call creates a *config object* — an identity, effectively a key — with no state in it. The values live in a store keyed by those configs. So:

- **Granularity is free.** Two atoms are two independent subscriptions; there is no selector to write and no shallow comparison to get wrong.
- **Derived state is a function.** A read-only atom is defined by how it computes itself from others, and it recomputes only when a dependency changes.
- **The store is the thing with a lifetime.** Which is exactly where the server problem lives.

```ts filename="app/[tenant]/board/atoms.ts"
import { atom } from 'jotai'

export const draggedIdAtom = atom<string | null>(null)
export const hoverColumnAtom = atom<string | null>(null)
export const selectionAtom = atom<string[]>([])

// Derived: recomputes only when selectionAtom changes.
export const selectionCountAtom = atom((get) => get(selectionAtom).length)

// Write-only: an action expressed as an atom.
export const toggleSelectionAtom = atom(null, (get, set, id: string) => {
  const current = get(selectionAtom)
  set(
    selectionAtom,
    current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
  )
})
```

```tsx filename="app/[tenant]/board/card.tsx"
'use client'

import { useAtomValue, useSetAtom } from 'jotai'
import { draggedIdAtom, toggleSelectionAtom } from './atoms'

export function Card({ id }: { id: string }) {
  const draggedId = useAtomValue(draggedIdAtom)   // subscribes to one atom only
  const toggle = useSetAtom(toggleSelectionAtom)  // never subscribes to anything
  return (
    <li data-dragging={draggedId === id} onClick={() => toggle(id)}>
      {id}
    </li>
  )
}
```

`useSetAtom` is the counterpart of the state/dispatch split from [04b](04b-context-re-renders-and-how-to-contain-them.md): a component that only writes never subscribes, so it never re-renders.

## 🔴 Provider-less mode is a server-side leak

> *"By default, Jotai uses an implicit global store to keep track of atom values. This is what is referred to as 'provider-less' mode. **This becomes an issue in SSR scenario because this global store is kept alive and is shared between multiple requests, which can lead to bugs and security risks.**"*
> — [Next.js, Provider](https://github.com/pmndrs/jotai/blob/main/docs/guides/nextjs.mdx)

> *"To limit the lifetime of the store to the scope of one request, you need to use a Provider at the root of your app (or a subtree if you're using Jotai only for a part of your application)."*
> — same section

This is the same defect as a module-level Zustand store ([04d](04d-zustand-in-an-rsc-app.md)), arrived at differently: Zustand's singleton is the store you created; Jotai's is the one you did not create. Provider-less mode is more dangerous precisely because nothing in the code says "global" — you just wrote `atom(0)` and used it.

The documentation is explicit about what the Provider buys:

> *"1. `Provider` will hold the state of the atoms used in its subtree instead of the global store. 2. `Provider`'s lifetime will be the same as the app itself, and since the app is recreated on each SSR request we essentially limit the lifetime of the store to a single request as well."*
> — same section

```tsx filename="app/[tenant]/board/jotai-provider.tsx"
'use client'

import { Provider } from 'jotai'
import type { ReactNode } from 'react'

export function BoardAtomsProvider({ children }: { children: ReactNode }) {
  return <Provider>{children}</Provider>
}
```

```tsx filename="app/[tenant]/board/page.tsx"
import { BoardAtomsProvider } from './jotai-provider'
import { Columns } from './columns'

export default async function BoardPage(props: PageProps<'/[tenant]/board'>) {
  const { tenant } = await props.params
  const board = await getBoard(tenant)

  return (
    <BoardAtomsProvider>
      <Columns columns={board.columns} />
    </BoardAtomsProvider>
  )
}
```

The `children` slot rule from [04](04-client-state-tools-compared-react-context-zustand-jotai.md) applies unchanged: `Provider` is a Client Component, so wrap `{children}` rather than importing the tree.

The Provider's three documented uses are worth keeping in view, because the second and third are how you reset state:

> *"Providers are useful for three reasons: 1. To provide a different state for each sub tree. 2. To accept initial values of atoms. 3. To clear all atoms by remounting."*
> — [Provider](https://github.com/pmndrs/jotai/blob/main/docs/core/provider.mdx)

An explicit store instance is also available, which is what you reach for in tests or when several trees must share one store:

```tsx
import { createStore, Provider } from 'jotai'

const myStore = createStore()

export function Root({ children }: { children: React.ReactNode }) {
  return <Provider store={myStore}>{children}</Provider>
}
```

## Gotchas

**★ Symptom: in production, one user's board occasionally shows another user's selection.** Cause: provider-less mode — the implicit global store lives in module scope and is shared across every request the Node process handles. Fix: mount a `Provider`.

```tsx
'use client'
import { Provider } from 'jotai'
export function AtomsProvider({ children }: { children: React.ReactNode }) {
  return <Provider>{children}</Provider>
}
```

**★ Symptom: state leaks between routes after a client-side navigation.** Cause: the `Provider` is mounted in the root layout, which does not remount; the store therefore outlives the route. Fix: mount it in the segment that owns the state, so remounting clears the atoms.

```tsx filename="app/[tenant]/board/page.tsx"
<BoardAtomsProvider><Columns columns={board.columns} /></BoardAtomsProvider>
```

**★ Symptom: a component re-renders on every atom write even though it only dispatches.** Cause: it used `useAtom`, which subscribes *and* returns a setter. Fix: `useSetAtom` for write-only components, `useAtomValue` for read-only ones.

```tsx
const toggle = useSetAtom(toggleSelectionAtom)     // ✅ never subscribes
const draggedId = useAtomValue(draggedIdAtom)      // ✅ read only
```

**★ Symptom: an atom defined inside a component creates fresh state on every render.** Cause: `atom()` returns a config whose identity *is* the key; a new config each render is a new key. Fix: define atoms at module scope, or memoise the config.

```ts
// ❌ function Card() { const a = atom(0); … }
export const draggedIdAtom = atom<string | null>(null)   // ✅ module scope
```

**★ Symptom: two subtrees that should share state do not.** Cause: each has its own `Provider`, and a provider holds its own store. Fix: create one store explicitly and pass it to both, or hoist a single provider above them.

```tsx
const myStore = createStore()
<Provider store={myStore}>{/* subtree A */}</Provider>
<Provider store={myStore}>{/* subtree B */}</Provider>
```

**★ Symptom: `atomWithHash` does not update when navigating with the App Router.** Cause: the documented Next.js integration for it relies on router events that the App Router no longer exposes. Fix: use the URL-as-state mechanisms in [03f](03f-url-as-state-writing-declaratively.md) and [03g](03g-url-as-state-writing-programmatically.md) instead — the query string is a better home for that state than the hash in an RSC app. Jotai's own note records the gap: *"As of Next.js 13 there have been some changes to the `Router.events.on()` which no longer expose events."*

## Interview questions

**★ How is Jotai's model different from Zustand's, and what follows from the difference?**
Zustand has one store containing an object, and components extract slices from it with selectors — so re-render granularity is something you achieve by writing good selectors and using shallow comparison when a component needs several fields. Jotai inverts this: state is decomposed into atoms up front, and subscribing to an atom *is* the selector, so granularity is the default rather than a discipline. What follows is a different failure surface: Zustand's classic mistake is an object selector that re-renders everything, and Jotai's is atom identity — an atom created in the wrong scope, or hydrated once when you expected it to update.

**★ Why is Jotai's provider-less mode unsafe in Next.js?**
Because the implicit global store lives in module scope, and module scope on a server is shared by every request the process handles. Jotai's own documentation says this directly: the global store is kept alive and shared between multiple requests, which can lead to bugs and security risks. It is the same defect as a module-level Zustand store, but harder to spot, because nothing in your code declares a global — you wrote `atom(0)` and it worked. The fix is a `Provider`, which holds the state for its subtree; since the React app is recreated per SSR request, the provider's lifetime becomes the request's.

**★ What does mounting the `Provider` at a particular level change?**
Three things the docs enumerate: it provides different state per subtree, it can accept initial values, and it clears all atoms when it remounts. That third property is the practical one in an App Router app. A provider in the root layout does not remount on navigation, so its atoms survive across routes — sometimes wanted, usually not. A provider in `page.tsx` unmounts when you navigate away, so the next route starts clean. Since `useHydrateAtoms` only hydrates once per store, remounting the provider is also the supported way to re-seed atoms with new data.

**★ What is the difference between `useAtom`, `useAtomValue` and `useSetAtom`, and why does it matter?**
`useAtom` subscribes to the atom and returns a `[value, setter]` pair; `useAtomValue` subscribes and returns only the value; `useSetAtom` returns only the setter and does not subscribe at all. The last one matters for the same reason the state/dispatch context split matters: a toolbar button that only writes should not re-render when the value changes. Using `useAtom` everywhere is the Jotai equivalent of selecting the whole store in Zustand — it works, and it quietly gives every writer a subscription it never needed.

**★ Why does an atom defined inside a component behave strangely?**
Because an atom config *is* the key its value is stored under. Calling `atom(0)` inside a component body produces a new config object on every render, so every render looks up a different key and gets fresh state — the value appears to reset constantly. Atoms belong at module scope, where their identity is stable for the lifetime of the module. When you genuinely need a per-instance atom — a list row with its own state — the config must be memoised for that instance, which is a deliberate pattern rather than something to arrive at by accident.

---

← [04d · Zustand in an RSC app](04d-zustand-in-an-rsc-app.md) · [Chapter 8 overview](01-explanation.md) · Next → [04f · Jotai under SSR: hydration, async atoms and storage](04f-jotai-under-ssr.md)
