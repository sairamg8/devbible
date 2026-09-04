---
title: "useHydrateAtoms is a client hook despite its name, it seeds each atom exactly once per store, and everything that surprises people about Jotai under SSR follows from those two facts plus one more: you cannot return a promise during a server render"
sidebar_label: "04f · Jotai under SSR"
sidebar_position: 135
description: "Seeding atoms from server-rendered data with useHydrateAtoms, the once-per-store rule and what to do instead of dangerouslyForceHydrate, why async fetching atoms are the wrong tool in an App Router app, and the browser-storage guard that avoids a hydration mismatch."
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-05 against the Jotai documentation — [SSR](https://github.com/pmndrs/jotai/blob/main/docs/utilities/ssr.mdx)
> and [Next.js](https://github.com/pmndrs/jotai/blob/main/docs/guides/nextjs.mdx).
> Version confirmed from the npm registry: **`jotai` 2.20.3** (MIT).
> Target: **Next.js 16.3.4** App Router · **React 19.2.8**.
> Documentation-verified; **no sandbox run**.

**Once the `Provider` from [04e](04e-jotai-in-an-rsc-app.md) has given the store a per-request lifetime, the remaining question is how server-rendered data gets into it. The answer is `useHydrateAtoms`, and three things about it explain every subsequent surprise: it is a client-side hook despite its name, it seeds each atom exactly once per store, and it exists because the alternative — an atom that fetches — cannot return a promise during a server render. Getting all three right in an App Router app is mostly a matter of accepting that Jotai holds interaction state and Server Components hold data.**

## Seeding from the server

```tsx filename="app/[tenant]/board/hydrate-atoms.tsx"
'use client'

import { useHydrateAtoms } from 'jotai/utils'
import type { ReactNode } from 'react'
import { selectionAtom } from './atoms'

export function HydrateBoardAtoms({
  selection,
  children,
}: {
  selection: string[]
  children: ReactNode
}) {
  useHydrateAtoms([[selectionAtom, selection]])
  return children
}
```

```tsx filename="app/[tenant]/board/page.tsx"
import { BoardAtomsProvider } from './jotai-provider'
import { HydrateBoardAtoms } from './hydrate-atoms'
import { Columns } from './columns'

export default async function BoardPage(props: PageProps<'/[tenant]/board'>) {
  const { tenant } = await props.params
  const board = await getBoard(tenant)

  return (
    <BoardAtomsProvider>
      <HydrateBoardAtoms selection={board.defaultSelection}>
        <Columns columns={board.columns} />
      </HydrateBoardAtoms>
    </BoardAtomsProvider>
  )
}
```

> *"The primary use case for `useHydrateAtoms` are SSR apps like Next.js, where an initial value is e.g. fetched on the server, which can be passed to a component by props."*
> — [SSR](https://github.com/pmndrs/jotai/blob/main/docs/utilities/ssr.mdx)

> *"⚠️ Note: Although the term 'hydrate' might suggest server-side usage, this hook is designed for client-side code and should be used with the `'use client'` directive."*
> — same page

The signature takes an iterable of pairs and an options object that can name a store:

```ts
function useHydrateAtoms(
  values: Iterable<readonly [Atom<unknown>, unknown]>,
  options?: { store?: Store },
): void
```

A `Map` works as well as an array, which is the documented workaround when TypeScript widens a tuple: *"you may need to use a Map when passing the atom value to useHydrateAtoms."* With `target: ES5` an `as const` cast on the array is the alternative.

Because the wrapper renders `children` through, it composes with the `children`-slot rule from [04](04-client-state-tools-compared-react-context-zustand-jotai.md): `Columns` stays a Server Component, rendered on the server and passed in as output.

## The once-per-store rule

> *"Atoms can only be hydrated once per store. Therefore, if the initial value used is changed during rerenders, it won't update the atom value."*
> — [SSR](https://github.com/pmndrs/jotai/blob/main/docs/utilities/ssr.mdx)

This catches everyone once, and it is not a bug: hydration is *seeding*, not *syncing*. If a prop changes after the first render, the atom keeps its value, because from the store's point of view the atom already has one.

There is an escape whose name is the warning:

> *"If there is a unique need to re-hydrate a previously hydrated atom, pass the optional `dangerouslyForceHydrate` as true and note that it may behave wrongly in concurrent rendering."*
> — same page

**Prefer remounting the provider.** A new `Provider` instance is a new store, so hydration runs again — this is the third of the Provider's three documented uses, *"to clear all atoms by remounting"*. Keying it on the identity of the data expresses the intent exactly:

```tsx filename="app/[tenant]/board/page.tsx"
<BoardAtomsProvider key={board.id}>
  <HydrateBoardAtoms selection={board.defaultSelection}>
    <Columns columns={board.columns} />
  </HydrateBoardAtoms>
</BoardAtomsProvider>
```

When one board's state must genuinely be replaced by another's, the store's lifetime *should* end. Forcing a second hydration into a store that is still alive is asking for the previous board's derived atoms to survive alongside the new board's seed.

Hydrating into several stores is supported, and the shape is simply several calls:

```ts
useHydrateAtoms([[countAtom, 42], [frameworkAtom, 'Next.js']])
useHydrateAtoms([[countAtom, 17], [frameworkAtom, 'Gatsby']], { store: myStore })
```

## Async atoms: why not, in an App Router app

> *"It's important to note that you can't return promises with SSR - However, it's possible to guard against it inside the atom definition. If possible use `useHydrateAtoms` to hydrate values from the server."*
> — [Next.js, You can't return promises in server side rendering](https://github.com/pmndrs/jotai/blob/main/docs/guides/nextjs.mdx)

The documented guard:

```js
const postData = atom((get) => {
  const id = get(postId)
  if (isSSR || prefetchedPostData[id]) {
    return prefetchedPostData[id] || EMPTY_POST_DATA
  }
  return fetchData(id) // returns a promise
})
```

That works, and in an App Router codebase it is usually a sign of a misplaced responsibility. An atom that fetches is doing the job Server Components already do, and doing it worse on four counts:

| | Async atom | Server Component |
|---|---|---|
| When the request starts | after hydration | during the server render |
| Prefetchable with the route | ❌ | ✅ |
| Participates in `use cache` / tags | ❌ | ✅ |
| Waterfall risk | one per dependent atom | none — awaited server-side |
| Secrets stay on the server | ❌ the fetch runs in the browser | ✅ |

The division that holds up: **Server Components own data; Jotai owns interaction state.** Fetch on the server, hydrate the atom with the result, and let atoms carry what only the browser knows — what is selected, what is being dragged, which panel is open. See [02](02-when-rsc-data-flow-is-enough.md) for when RSC data flow is sufficient on its own.

## Browser storage

> *"Next.js still prerenders client components during static export, so browser storage APIs such as `localStorage` and `sessionStorage` are not available during the server render."*
> *"If you use `atomWithStorage` with `createJSONStorage`, avoid referencing browser storage globals directly. Use `window` behind a server guard instead"*
> — [Next.js, Browser storage](https://github.com/pmndrs/jotai/blob/main/docs/guides/nextjs.mdx)

```js filename="app/preferences/atoms.ts"
import { atomWithStorage, createJSONStorage } from 'jotai/utils'

const storage = createJSONStorage(() =>
  typeof window !== 'undefined' ? window.sessionStorage : undefined,
)

const someAtom = atomWithStorage('some-key', someInitialValue, storage)
```

The guard prevents the *crash*. It does not prevent the *mismatch*: on the server the atom reads its initial value, on the client it reads the stored one, and if the UI differs the two renders disagree. The documented answer is to keep that subtree off the server entirely:

```js filename="app/preferences/page.tsx"
import dynamic from 'next/dynamic'

const StoredPreferences = dynamic(() => import('../components/StoredPreferences'), {
  ssr: false,
})
```

This is the same constraint `getServerSnapshot` imposes in [04c](04c-usesyncexternalstore-the-escape-hatch.md), expressed in Jotai's vocabulary: a value the server cannot know must either be excluded from the server render or applied deliberately after it.

## Gotchas

**★ Symptom: `useHydrateAtoms` runs but the atom keeps its old value when the prop changes.** Cause: atoms can only be hydrated once per store, by design — hydration seeds, it does not sync. Fix: reset by remounting the provider, keyed on the identity of the data.

```tsx
<BoardAtomsProvider key={board.id}>
  <HydrateBoardAtoms selection={board.defaultSelection}>{children}</HydrateBoardAtoms>
</BoardAtomsProvider>
```

**★ Symptom: `useHydrateAtoms` throws when imported into a Server Component.** Cause: despite its name it is a client-side hook. Fix: the component that calls it carries `'use client'` and receives the values as props, rendering `children` through so the tree below stays server-rendered.

```tsx
'use client'
import { useHydrateAtoms } from 'jotai/utils'

export function HydrateBoardAtoms({ selection, children }) {
  useHydrateAtoms([[selectionAtom, selection]])
  return children
}
```

**★ Symptom: `dangerouslyForceHydrate` fixed the stale seed and introduced intermittent wrong values under load.** Cause: the documentation warns it may behave wrongly in concurrent rendering, and a re-hydrated store still holds every derived atom computed from the old seed. Fix: end the store's life instead of overwriting it.

```tsx
<BoardAtomsProvider key={board.id}>{/* new store, clean hydration */}</BoardAtomsProvider>
```

**★ Symptom: TypeScript rejects the array passed to `useHydrateAtoms`.** Cause: the array literal widens and the tuple type is lost. Fix: an `as const` cast, or a `Map`.

```ts
useHydrateAtoms([[countAtom, 42], [frameworkAtom, 'Next.js']] as const)
useHydrateAtoms(new Map([[countAtom, 42]]))
```

**★ Symptom: an async atom that fetches data throws or hangs during server rendering.** Cause: promises cannot be returned during SSR. Fix: fetch in a Server Component and hydrate the atom with the result; guard the atom if it must also work client-side.

```js
const postData = atom((get) => {
  const id = get(postId)
  if (isSSR || prefetchedPostData[id]) {
    return prefetchedPostData[id] || EMPTY_POST_DATA
  }
  return fetchData(id)
})
```

**★ Symptom: a page that used to render its list on the server now shows a spinner on every visit.** Cause: the data moved into an async atom, so the request starts after hydration instead of during the server render. Fix: move the fetch back to a Server Component and seed the atom.

```tsx
const board = await getBoard(tenant)                 // ✅ server render
<HydrateBoardAtoms selection={board.defaultSelection}>…</HydrateBoardAtoms>
```

**★ Symptom: a hydration mismatch on a component using `atomWithStorage`.** Cause: the storage global does not exist during the server render, so the server and client produced different values. Fix: guard the storage accessor, and if the UI depends on the value, render that subtree client-only.

```js
const storage = createJSONStorage(() =>
  typeof window !== 'undefined' ? window.sessionStorage : undefined,
)
```

```js
const StoredPreferences = dynamic(() => import('../components/StoredPreferences'), { ssr: false })
```

**★ Symptom: `window is not defined` at build time from an atoms module.** Cause: `createJSONStorage(() => localStorage)` evaluates the accessor during prerendering, where there is no `window`. Fix: the `typeof window !== 'undefined'` guard inside the accessor, not around the atom.

**★ Symptom: an API token seeded into an atom shows up in the page source.** Cause: `useHydrateAtoms` receives its values as props to a Client Component, and those are serialised into the RSC payload. Fix: seed only what the UI renders — the same rule as every other server-to-client prop in this chapter.

```tsx
<HydrateBoardAtoms selection={board.defaultSelection}>{children}</HydrateBoardAtoms>
{/* not: <HydrateBoardAtoms board={board}> */}
```

## Interview questions

**★ How do you get server-fetched data into an atom?**
Fetch it in a Server Component and pass it as a prop to a small Client Component that calls `useHydrateAtoms` with `[[atom, value]]` pairs and renders `children` through. The hook is client-side despite its name, so that component carries `'use client'`; because it renders `children` rather than importing the tree, everything below it stays server-rendered. The constraint to internalise is that atoms hydrate once per store: if the prop changes later, the atom does not follow. That is seeding, not syncing, and treating it as syncing is the source of most confusion about the hook.

**★ What should you do when a hydrated atom needs a new value, and why not `dangerouslyForceHydrate`?**
Remount the provider — a new `Provider` is a new store, so hydration runs cleanly, and clearing all atoms by remounting is one of the Provider's three documented purposes. Keying the provider on the identity of the data (a board id, a document id) expresses exactly the intent: this is different state, not an update to the old state. `dangerouslyForceHydrate` is discouraged by its own name and by a documented warning that it may behave wrongly in concurrent rendering; it also leaves every derived atom that was computed from the previous seed alive in the same store, which is a subtler inconsistency than the one you were trying to fix.

**★ Why should you avoid async atoms that fetch, in an App Router app?**
Two reasons. Jotai's documentation states you cannot return promises during server-side rendering, so such an atom needs a guard to work at all. More fundamentally, an atom that fetches is doing the job Server Components already do, and doing it worse: the request starts after hydration rather than during the server render, it cannot be prefetched with the route, it cannot participate in the framework's caching or tag invalidation, it produces a client-side waterfall for every dependent atom, and the fetch runs in the browser so any credential it needs must be exposed. Fetch on the server, pass the result down, hydrate the atom with it — the atom's job is client interaction state, not data loading.

**★ Why does `atomWithStorage` need a guard, and does the guard fix everything?**
It needs a guard because client components are still prerendered on the server, where `localStorage` and `sessionStorage` do not exist, so an accessor referencing them directly throws during the build or the server render. The guard — returning `window.sessionStorage` only when `typeof window !== 'undefined'` — fixes the crash. It does not fix the mismatch: on the server the atom falls back to its initial value while on the client it reads the stored one, and if any rendered output differs, hydration disagrees. When the UI genuinely depends on the stored value, the documented answer is to render that subtree client-only with `next/dynamic` and `ssr: false`, which is the same trade `getServerSnapshot` forces in plain React.

**★ How does the once-per-store rule interact with client-side navigation?**
It makes the provider's placement a functional decision rather than a stylistic one. A provider in the root layout does not remount on navigation, so its store survives — and since atoms hydrate once per store, the seed from the first route is still in place when the second route renders, which presents as stale state that no amount of re-passing props will fix. A provider mounted in the segment that owns the state unmounts on navigation, the store goes with it, and the next route hydrates fresh. Those two facts — provider lifetime and once-per-store hydration — are the same fact seen from two directions, and understanding one explains the other.

---

← [04e · Jotai in an RSC app](04e-jotai-in-an-rsc-app.md) · [Chapter 8 overview](01-explanation.md) · Next → [04g · Choosing, and when the answer is none of them](04g-choosing-a-client-state-tool.md)
