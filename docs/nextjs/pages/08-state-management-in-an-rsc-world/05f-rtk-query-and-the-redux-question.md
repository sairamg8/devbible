---
title: "RTK Query is a cache bolted to a Redux store, and that changes the App Router answer — Redux's own documentation says the store must be created per request, must never be read by a Server Component, and should hold globally shared mutable data rather than server rows"
sidebar_label: "05f · RTK Query and Redux"
sidebar_position: 144
description: "createApi and generated hooks, the per-request makeStore, why RSCs must not touch the store, the client-only recommendation for RTK Query, the Pages-Router-only SSR workflow, and the verdict on adding Redux now."
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-05 against the Redux Toolkit [Setup with Next.js](https://redux-toolkit.js.org/usage/nextjs)
> guide and the RTK Query [Server Side Rendering](https://redux-toolkit.js.org/rtk-query/usage/server-side-rendering)
> page. Package versions read from the npm registry on 2026-09-05.
> Target: **Next.js 16.3.4** App Router · **React 19.2.8** · **`@reduxjs/toolkit` 2.12.0** ·
> **`react-redux` 9.3.0** · TypeScript 7.0.2.
> Documentation-verified; **no sandbox run**.

**RTK Query is not a standalone cache. It is a slice inside a Redux store, its endpoints generate hooks, and its data lives wherever the store lives. In an App Router app that constraint is load-bearing, because the store cannot be a module-level singleton on a server that handles concurrent requests, cannot be read by a Server Component, and — per Redux's own guide — should not be the home of server data at all. If you already have RTK Query from a single-page app, keeping it through a migration is the right call. Adding Redux to a new App Router app so that it can hold rows the server already fetched is the wrong one, and the Redux documentation says so before anyone else does.**

## The shape: endpoints in, hooks out

```ts filename="lib/api/board-api.ts"
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

export type Task = { id: string; title: string; status: string }

export const boardApi = createApi({
  reducerPath: 'boardApi',
  baseQuery: fetchBaseQuery({ baseUrl: '/api/' }),
  tagTypes: ['Task'],
  endpoints: (build) => ({
    listTasks: build.query<Task[], string>({
      query: (boardId) => `boards/${boardId}/tasks`,
      providesTags: (result) =>
        result
          ? [...result.map(({ id }) => ({ type: 'Task' as const, id })), { type: 'Task', id: 'LIST' }]
          : [{ type: 'Task', id: 'LIST' }],
    }),
    renameTask: build.mutation<Task, { id: string; title: string }>({
      query: ({ id, title }) => ({ url: `tasks/${id}`, method: 'PATCH', body: { title } }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Task', id }],
    }),
  }),
})

export const { useListTasksQuery, useRenameTaskMutation } = boardApi
```

Two structural differences from TanStack Query fall out of this:

- **The cache key is the endpoint plus its argument**, not a hand-written array. `useListTasksQuery(boardId)` cannot mismatch a "prefetch key" because there is no separate key to get wrong.
- **Invalidation is declarative.** `providesTags` and `invalidatesTags` describe the graph once; a mutation expires exactly what it should. There is no `invalidateQueries` call at each call site — which is a genuine advantage over the two-call pattern in [05e](05e-invalidating-both-caches.md).

The price is that all of it lives in a Redux store, and a Redux store in the App Router has rules.

## The four problems the App Router creates for Redux

The Redux guide names them up front, and every piece of the setup below exists to solve one of them:

> *"**Per-request safe Redux store creation**: A Next.js server can handle multiple requests simultaneously. This means that the Redux store should be created per request and that the store should not be shared across requests."*
> — [Redux Toolkit Setup with Next.js](https://redux-toolkit.js.org/usage/nextjs#introduction)

The other three are SSR-friendly hydration (the same content must render on both sides), SPA routing support (route-specific data must reset on navigation while global data persists), and compatibility with the App Router's server caching.

And the recommendations that follow from RSCs specifically:

> *"**No global stores** - Because the Redux store is shared across requests, it should not be defined as a global variable. Instead, the store should be created per request. · **RSCs should not read or write the Redux store** - RSCs cannot use hooks or context. They aren't meant to be stateful. Having an RSC read or write values from a global store violates the architecture of the Next.js App Router. · **The store should only contain mutable data** - We recommend that you use your Redux sparingly for data intended to be global and mutable."*
> — [Redux Toolkit Setup with Next.js](https://redux-toolkit.js.org/usage/nextjs#the-app-router-architecture-and-redux)

## The setup, in three files

```ts filename="lib/store.ts"
import { configureStore } from '@reduxjs/toolkit'
import { boardApi } from './api/board-api'

export const makeStore = () =>
  configureStore({
    reducer: { [boardApi.reducerPath]: boardApi.reducer },
    middleware: (getDefault) => getDefault().concat(boardApi.middleware),
  })

export type AppStore = ReturnType<typeof makeStore>
export type RootState = ReturnType<AppStore['getState']>
export type AppDispatch = AppStore['dispatch']
```

No `store` is exported — only a factory and the types inferred from it. That is the whole defence against the cross-request leak, and it is enforced by there being nothing to import.

```ts filename="lib/hooks.ts"
import { useDispatch, useSelector, useStore } from 'react-redux'
import type { RootState, AppDispatch, AppStore } from './store'

export const useAppDispatch = useDispatch.withTypes<AppDispatch>()
export const useAppSelector = useSelector.withTypes<RootState>()
export const useAppStore = useStore.withTypes<AppStore>()
```

```tsx filename="app/store-provider.tsx"
'use client'

import { useState } from 'react'
import { Provider } from 'react-redux'
import { makeStore, type AppStore } from '@/lib/store'

export function StoreProvider({ children }: { children: React.ReactNode }) {
  // The lazy initializer runs only on the first render, so the store is
  // created exactly once even if this component re-renders.
  const [store] = useState<AppStore>(makeStore)

  return <Provider store={store}>{children}</Provider>
}
```

⚠️ Note the divergence from the TanStack setup in [05b](05b-server-prefetch-and-hydrationboundary.md): Redux's guide uses `useState` with a lazy initializer, TanStack's warns against `useState` because a suspended initial render discards it. Both are the documented recommendation for their own library; do not port one pattern onto the other. The Redux guide explains its choice as re-render safety:

> *"In this example code we are ensuring that this client component is re-render safe. The lazy initializer passed to `useState` runs only on the first render, so the store is created exactly once."*
> — [Redux Toolkit Setup with Next.js](https://redux-toolkit.js.org/usage/nextjs#providing-the-store)

And on why the provider must be a Client Component:

> *"Any component that interacts with the Redux store (creating it, providing it, reading from it, or writing to it) needs to be a client component. This is because **accessing the store requires React context, and context is only available in client components.**"*
> — same section

## Seeding the store from a Server Component

There is no `HydrationBoundary` equivalent. Server data enters as a prop and is dispatched into a slice inside the same lazy initializer:

```tsx filename="app/store-provider.tsx"
'use client'

import { useState } from 'react'
import { Provider } from 'react-redux'
import { makeStore, type AppStore } from '@/lib/store'
import { initializeBoard } from '@/lib/features/board/board-slice'
import type { Task } from '@/lib/api/board-api'

export function StoreProvider({
  initialTasks,
  children,
}: {
  initialTasks: Task[]
  children: React.ReactNode
}) {
  const [store] = useState<AppStore>(() => {
    const store = makeStore()
    store.dispatch(initializeBoard(initialTasks))
    return store
  })

  return <Provider store={store}>{children}</Provider>
}
```

That path seeds a **slice**, not the RTK Query cache. Preloading the RTK Query cache from the server is the thing the docs say is not available yet:

> *"We recommend using RTK Query for data fetching **on the client only**. Data fetching on the server should use `fetch` requests from `async` RSCs. … In the future, RTK Query may be able to receive data fetched on the server via React Server Components, but that is a future capability that will require changes to both React and RTK Query."*
> — [Redux Toolkit Setup with Next.js](https://redux-toolkit.js.org/usage/nextjs#rtk-query)

🔴 **This is the single biggest practical difference from TanStack Query in the App Router.** TanStack has a documented server-prefetch-and-hydrate path; RTK Query's App Router story is client-only fetching, with the server-rendered data coming from RSCs on a separate track.

## The SSR workflow that exists is Pages Router

RTK Query does have a server-rendering story, and it is worth knowing exactly what it covers so you do not go looking for it in `app/`:

> *"RTK Query supports Server Side Rendering (SSR) with Next.js via rehydration in combination with `next-redux-wrapper`. The workflow is as follows: Set up `next-redux-wrapper` · In `getStaticProps` or `getServerSideProps`: Pre-fetch all queries via the `initiate` actions, e.g. `store.dispatch(api.endpoints.getPokemonByName.initiate(name))` · Wait for each query to finish using `await Promise.all(dispatch(api.util.getRunningQueriesThunk()))` · In your `createApi` call, configure rehydration using the `extractRehydrationInfo` option"*
> — [RTK Query · Server Side Rendering](https://redux-toolkit.js.org/rtk-query/usage/server-side-rendering)

`getStaticProps` and `getServerSideProps` are Pages Router APIs. The App Router has neither. The guide also suggests `store.dispatch(api.util.resetApiState())` once a render is sent to the client, *"to ensure that no rogue timers are left running"* — again in that Pages Router lifecycle.

## Living with the App Router's caches

The Redux guide's own advice on framework caching is short and correct:

> *"If you have an application that accepts login you may have routes (e.g. the home route, `/`) that render different data based on the user you will need to disable the route cache by using the `dynamic` export from the route handler … After a mutation you should also invalidate the cache by calling `revalidatePath` or `revalidateTag` as appropriate."*
> — [Redux Toolkit Setup with Next.js](https://redux-toolkit.js.org/usage/nextjs#caching)

Which lands you back in the two-invalidation problem of [05e](05e-invalidating-both-caches.md): `invalidatesTags` expires the RTK Query cache in the browser, and a `revalidateTag` or `revalidatePath` from a Server Action expires the framework cache. Neither triggers the other.

## The verdict

| | TanStack Query | RTK Query |
|---|---|---|
| Cache lives in | Its own `QueryClient` | The Redux store |
| Server prefetch → client cache | Documented: `dehydrate` + `HydrationBoundary` | Not available in the App Router; docs say client-only |
| Key management | Hand-written arrays, must match | Endpoint + argument, generated |
| Invalidation | `invalidateQueries` per call site | `providesTags` / `invalidatesTags`, declarative |
| Extra runtime cost | The library | The library, plus a store, plus a provider, plus middleware |
| Right answer if you already have it | Keep it | Keep it |
| Right answer for a new App Router app that wants a client cache | Reasonable | Only if you already want Redux for other reasons |

Adding Redux **now**, to an App Router app, so that it can hold data the server already fetched, contradicts the recommendation its own maintainers publish: *"only use Redux for globally shared, mutable data"* and *"use a combination of Next.js state (search params, route parameters, form state, etc.), React context and React hooks for all other state management."*

## Gotchas

**★ Symptom: one user's board data appears for another user, only in production.** Cause: a module-level `export const store = configureStore(...)` — a single store shared by every concurrent request in the Node process. Fix: export a factory and nothing else, so there is no store to import.

```ts
// 🚩 export const store = configureStore({ reducer })
// ✅
export const makeStore = () => configureStore({ reducer: { /* … */ } })
export type AppStore = ReturnType<typeof makeStore>
```

**★ Symptom: a Server Component calling `store.getState()` returns state from someone else's request, or nothing at all.** Cause: RSCs have no context and no hooks; any store they can reach is a global one, which is the leak above. Fix: read on the server with a normal async function and pass the result down as a prop.

```tsx
// app/board/page.tsx — a Server Component
export default async function BoardPage() {
  const tasks = await listTasks()            // plain server read, no store
  return <StoreProvider initialTasks={tasks}><Board /></StoreProvider>
}
```

**★ Symptom: the store resets on every re-render of the provider, and in-flight RTK Query subscriptions restart.** Cause: `makeStore()` called in the component body rather than through `useState`'s lazy initializer, so every render builds a new store. Fix: the lazy initializer.

```tsx
const [store] = useState<AppStore>(makeStore)   // not useState(makeStore())
```

**★ Symptom: you cannot find the App Router equivalent of `dehydrate`/`HydrationBoundary` for RTK Query.** Cause: it does not exist; the documented SSR workflow is `next-redux-wrapper` with `getServerSideProps`, both Pages Router. Fix: fetch on the server in the RSC and seed a slice through a prop, keeping RTK Query for client-initiated reads.

```tsx
const [store] = useState<AppStore>(() => {
  const s = makeStore()
  s.dispatch(initializeBoard(initialTasks))
  return s
})
```

**★ Symptom: a mutation updates the screen but a later navigation shows the old data.** Cause: `invalidatesTags` expired the RTK Query cache only; the framework's `use cache` entry is untouched. Fix: invalidate the server tag from a Server Action as well.

```ts
'use server'
import { updateTag } from 'next/cache'
export async function renameTask(id: string, title: string) {
  await db.task.update({ where: { id }, data: { title } })
  updateTag('board')
}
```

**★ Symptom: a logged-in home route serves one user's rendered page to the next.** Cause: the route was cached because nothing in it opted out. Fix: opt the route out explicitly.

```ts
// app/page.tsx
export const dynamic = 'force-dynamic'
```

**★ Symptom: route-specific data from the previous page is still in the store after navigating.** Cause: the store lives in a layout above both routes, so it is not re-created on navigation — one of the four problems the guide names. Fix: reset that slice when the route's own component mounts, or key the provider by route where the whole store is route-scoped.

```tsx
'use client'
import { useEffect } from 'react'
import { useAppDispatch } from '@/lib/hooks'
import { resetBoard } from '@/lib/features/board/board-slice'

export function BoardScope({ boardId }: { boardId: string }) {
  const dispatch = useAppDispatch()
  useEffect(() => { dispatch(resetBoard(boardId)) }, [boardId, dispatch])
  return null
}
```

## Interview questions

**★ Why can a Redux store not be a module-level singleton in an App Router app when it can be in a SPA?**
Because the module graph has a different scope in each. In a SPA the module graph is the tab: one user, one session, one store, and a global is exactly right. On a Next.js server the module graph belongs to the process, which serves many users' requests concurrently — a module-level store is one mutable object shared by all of them, so one request's data is readable by another. The guide's fix is to export only a `makeStore` factory and infer `RootState` and `AppDispatch` from its return type, leaving nothing importable to leak.

**★ Redux's own docs say RSCs should not read or write the store. What is the reasoning, and what do you do instead?**
Two reasons. Mechanically, RSCs have no hooks and no context, and `react-redux` reaches the store through context, so the only store an RSC could reach is a global one — the leak above. Architecturally, RSCs are meant to be stateless functions of their inputs; making one read mutable global state breaks the model the App Router is built on. Instead the RSC does the read directly (a database call, a `fetch`) and passes the result down as a prop, which a Client Component can dispatch into a slice if it needs to be mutable from there.

**★ How does RTK Query's App Router story differ from TanStack Query's, in one sentence each?**
TanStack Query has a documented path from a server prefetch into the client cache — prefetch into a per-request `QueryClient`, `dehydrate` it, hydrate it under a `HydrationBoundary`. RTK Query does not: its documented server-rendering workflow uses `next-redux-wrapper` with `getServerSideProps`, which are Pages Router APIs, and the App Router guidance is to use RTK Query for client-only fetching with server data coming from `async` RSCs.

**What does RTK Query do better than TanStack Query in this architecture?**
Key and invalidation management. The cache key is the endpoint plus its serialised argument, generated rather than hand-written, so the class of bug where a server prefetch key and a client query key differ by one character does not exist. Invalidation is declarative through `providesTags` and `invalidatesTags`, so a mutation expires exactly the entries it should without an `invalidateQueries` call at every call site. In an app that already has Redux, those are real advantages.

**Why do the two libraries' providers use different store-creation patterns — `useState` in one, a module-scoped function in the other?**
Because they are defending against different failures. Redux's provider uses `useState` with a lazy initializer to be re-render safe: the store is created once even if the component re-renders because of other state above it. TanStack's guide warns against `useState` for the `QueryClient`, because if the initial render suspends with no Suspense boundary below the creation point, React throws the state away and the cache with it — so it uses a module-scoped browser singleton behind an environment check instead. Each is the documented recommendation for its own library, and copying one into the other reintroduces the failure it was written to avoid.

**A team wants Redux in a new App Router app "so all the data is in one place." What is your response?**
That the data is already in one place — the server — and Redux would make a second. The Redux maintainers' own recommendation for App Router apps is to use the store only for globally shared, mutable data and to reach for search params, route params, form state, context and hooks for everything else; server rows are exactly what it says not to put there. If the app already runs Redux from an earlier SPA, keeping it through a migration is sound. Adding it now to cache server data means you own two caches, two invalidation systems, and a store you must remember never to touch from a Server Component.

---

← [05e · Invalidating both caches](05e-invalidating-both-caches.md) · [Chapter 8 overview](01-explanation.md) · Next → [06 · useActionState](06-useoptimistic-and-useactionstate-as-framework-native-alterna.md)
