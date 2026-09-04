---
title: "The failure that actually hurts is not setup — it is the day the server render and the client cache hold the same row at two different values, and the only reliable cure is a rule about which layer owns which piece of data"
sidebar_label: "05d · When the two caches disagree"
sidebar_position: 142
description: "Data ownership between RSC and a client cache, initialData and initialDataUpdatedAt seeded from a Server Component, and choosing between seeding and hydrating."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against the TanStack Query [Advanced Server Rendering](https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr)
> and [Initial Query Data](https://tanstack.com/query/latest/docs/framework/react/guides/initial-query-data) guides,
> the Next.js [Server Actions and Mutations](https://nextjs.org/docs/app/guides/server-actions) guide
> (`lastUpdated: 2026-06-17`) and the React [Server Functions](https://react.dev/reference/rsc/use-server) reference.
> Target: **Next.js 16.3.4** App Router · **React 19.2.8** · **`@tanstack/react-query` 5.102.8** · TypeScript 7.0.2.
> Documentation-verified; **no sandbox run**.

**Two caches holding the same data will drift, and the drift is silent. The client cache refetches on focus and updates a list; the Server Component that rendered a count above that list does not, because React Query has no way to re-run a Server Component. Now the header says "12 tasks" and the list shows thirteen, and nothing errored. TanStack's guide gives the rule that prevents this in one sentence — treat Server Components as a place to prefetch, nothing more — and everything else on this page is the consequence of taking that rule seriously.**

## The canonical drift

```tsx filename="app/board/page.tsx"
import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query'
import { listTasks } from '@/lib/data/tasks'
import { Board } from './board'

export default async function BoardPage() {
  const queryClient = new QueryClient()

  // 🚩 We keep the result and render it here as well.
  const tasks = await queryClient.query({ queryKey: ['board'], queryFn: listTasks })

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <h1>{tasks.length} tasks</h1>
      <Board />
    </HydrationBoundary>
  )
}
```

The heading is server-rendered from `tasks`. The list inside `Board` is client-rendered from the cache entry `['board']`. The moment a `staleTime` expires and the window regains focus, the cache entry refetches and the list changes; the heading is frozen in a server render that will not run again until a navigation.

> *"React Query has no idea of how to revalidate the Server Component, so if it refetches the data on the client, causing React to rerender the list of posts, the `Nr of posts: {posts.length}` will end up out of sync."*
> — [Advanced Server Rendering](https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr#data-ownership-and-revalidation)

> *"This is fine if you set `staleTime: Infinity`, so that React Query never revalidates, but this is probably not what you want if you are using React Query in the first place."*
> — same section

And the rule:

> *"If you do use it, a good rule of thumb is to avoid rendering the result of `queryClient.query` on the server or passing it to another component, even a Client Component one. From the React Query perspective, treat Server Components as a place to prefetch data, nothing more."*
> — same section

The corrected page keeps the count in the same component that owns the data:

```tsx filename="app/board/page.tsx"
export default async function BoardPage() {
  const queryClient = new QueryClient()
  await queryClient.prefetchQuery({ queryKey: ['board'], queryFn: listTasks })

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Board />
    </HydrationBoundary>
  )
}
```

```tsx filename="app/board/board.tsx"
'use client'

import { useQuery } from '@tanstack/react-query'
import { listTasks } from '@/lib/data/tasks'

export function Board() {
  const { data = [] } = useQuery({ queryKey: ['board'], queryFn: listTasks })

  return (
    <>
      <h1>{data.length} tasks</h1>
      <ul>{data.map((t) => <li key={t.id}>{t.title}</li>)}</ul>
    </>
  )
}
```

Everything derived from a cached key is rendered from that key. Ownership is per **piece of data**, not per component: it is entirely fine for the board to be query-owned and the org name in the header to be RSC-owned, as long as no single fact has two renderers.

## Seeding with `initialData` instead of hydrating

`HydrationBoundary` is one of two ways to get server data into the cache. The other is to pass rows down as props and hand them to `useQuery` as `initialData`. It is simpler, needs no dehydration, and has a trap the docs name precisely:

> *"By default, `initialData` is treated as totally fresh, as if it were just fetched. This also means that it will affect how it is interpreted by the `staleTime` option."*
> — [Initial Query Data](https://tanstack.com/query/latest/docs/framework/react/guides/initial-query-data#staletime-and-initialdataupdatedat)

> *"If you configure your query observer with `initialData`, and no `staleTime` (the default `staleTime: 0`), the query will immediately refetch when it mounts"*
> — same section

The data was fetched on the server at some point before the HTML reached the browser. Telling the cache *when* is what `initialDataUpdatedAt` is for:

```tsx filename="app/board/page.tsx"
import { listTasks } from '@/lib/data/tasks'
import { Board } from './board'

export default async function BoardPage() {
  const tasks = await listTasks()
  // A JS timestamp in milliseconds, captured at the moment of the read.
  return <Board initialTasks={tasks} fetchedAt={Date.now()} />
}
```

```tsx filename="app/board/board.tsx"
'use client'

import { useQuery } from '@tanstack/react-query'
import { listTasks } from '@/lib/data/tasks'
import type { Task } from '@/lib/data/tasks'

export function Board({
  initialTasks,
  fetchedAt,
}: {
  initialTasks: Task[]
  fetchedAt: number
}) {
  const { data = [] } = useQuery({
    queryKey: ['board'],
    queryFn: listTasks,
    initialData: initialTasks,
    initialDataUpdatedAt: fetchedAt,
    staleTime: 60 * 1000,
  })

  return <ul>{data.map((t) => <li key={t.id}>{t.title}</li>)}</ul>
}
```

> *"This option allows the `staleTime` to be used for its original purpose, determining how fresh the data needs to be, while also allowing the data to be refetched on mount if the `initialData` is older than the `staleTime`."*
> — [Initial Query Data](https://tanstack.com/query/latest/docs/framework/react/guides/initial-query-data#staletime-and-initialdataupdatedat)

Two more constraints the docs state outright. First, `initialData` is written into the cache, so it must be complete data:

> *"`initialData` is persisted to the cache, so it is not recommended to provide placeholder, partial or incomplete data to this option and instead use `placeholderData`"*
> — same guide

Second, when you actually want *prefetched* semantics rather than *seeded* semantics, use the prefetch path:

> *"If you would rather treat your data as prefetched data, we recommend that you use the `query` api to populate the cache beforehand, thus letting you configure your `staleTime` independently from your `initialData`."*
> — same guide

**Choose `initialData` when** one component needs one list and you would rather pass a prop than wire a boundary. **Choose prefetch + `HydrationBoundary` when** several components across a subtree read the same keys, or when you want the freshness policy expressed once in the client factory rather than per call site.

## Gotchas

**★ Symptom: a count in the header and the list below it show different numbers, and only after the tab has been in the background.** Cause: the count was rendered from the Server Component's copy of the data, the list from the client cache; a focus refetch updated one and not the other. Fix: render everything derived from a key inside a component that reads that key.

```tsx
// server: prefetch only. client: derive the count from the query.
const { data = [] } = useQuery(boardOptions())
return <><h1>{data.length} tasks</h1><TaskList tasks={data} /></>
```

**★ Symptom: `initialData` from a Server Component refetches instantly on mount, doubling every page's requests.** Cause: `initialData` is treated as freshly fetched and `staleTime` defaults to `0`, so the query is stale the moment it exists. Fix: give it a `staleTime` and tell it when the data was really read.

```tsx
useQuery({
  queryKey: ['board'],
  queryFn: listTasks,
  initialData: initialTasks,
  initialDataUpdatedAt: fetchedAt,   // Date.now() captured on the server
  staleTime: 60 * 1000,
})
```

**★ Symptom: a skeleton row you passed as `initialData` is still in the list an hour later.** Cause: `initialData` is *persisted into the cache*; partial or placeholder shapes become real cache contents. Fix: use `placeholderData`, which is displayed but not stored.

```tsx
useQuery({ queryKey: ['board'], queryFn: listTasks, placeholderData: SKELETON_ROWS })
```

**★ Symptom: `staleTime: Infinity` "fixed" the drift, and now nothing ever updates.** Cause: it did fix it, by turning the client cache into a static store — which removes the only reason you installed it. Fix: fix the ownership instead, and keep a real `staleTime`.

```tsx
// not this
useQuery({ queryKey: ['board'], queryFn: listTasks, staleTime: Infinity })
// this: one renderer per fact, normal freshness policy
useQuery({ queryKey: ['board'], queryFn: listTasks, staleTime: 60 * 1000 })
```

## Interview questions

**★ Why does rendering a query's result in the Server Component that prefetched it cause a bug?**
Because the two renderings have different update mechanisms. The Server Component's copy is fixed at the moment of that server render and can only change through a navigation, a `refresh()`, or a cache invalidation that re-renders the route. The client cache's copy changes on focus, reconnect, interval, mutation invalidation or a socket write — none of which the framework observes. Any fact derived from both goes out of sync the first time the client refetches, silently. The guide's rule of thumb is to treat Server Components as a place to prefetch and nothing more.

**★ Explain `initialData` versus `initialDataUpdatedAt`, and why the second one matters when the data came from a Server Component.**
`initialData` seeds the cache entry and is treated as though it had just been fetched, which interacts with `staleTime`: with the default `staleTime: 0` the query is stale immediately and refetches on mount, so you paid for the data on the server and again on the client. `initialDataUpdatedAt` takes a millisecond timestamp saying when the data really was read. With a real `staleTime` set, the query can then decide correctly — serve from the seed if it is still inside the window, refetch if the server read is older than the policy allows. Without it you either refetch always, or you lie about freshness with an artificial `staleTime`.

**When would you choose `initialData` over prefetch + `HydrationBoundary`, and when the reverse?**
`initialData` when a single client component needs a single list and passing a prop is less machinery than a boundary — it needs no `dehydrate`, no per-request client on the server, and it reads naturally. Prefetch and hydrate when several components across a subtree read the same keys (they all get the entry, not just the one you passed the prop to), when the data is deep in a tree you would otherwise prop-drill through, or when you want the freshness policy defined once in the `QueryClient` factory. There is also a correctness edge: `initialData` is written to the cache, so it must never be partial.

**Why is `placeholderData` a different option from `initialData` rather than a flag on it?**
Because they have different persistence semantics, and that is a cache-correctness question, not a display question. `initialData` is written into the cache and becomes the entry other observers see and other queries can read through `getQueryData`. `placeholderData` is shown by the observer while the real fetch is in flight and is never stored. Feeding a skeleton shape to `initialData` puts a fake row into the shared cache, where it can outlive the component that rendered it.

**Someone sets `staleTime: Infinity` to stop a server/client mismatch. What have they actually done?**
Disabled the behaviour that justified the library. With `staleTime: Infinity` the query never refetches on mount, focus or reconnect, so the two copies cannot drift — and also cannot update, which means the cache is now an expensive way to hold props. If the data genuinely never changes while the app runs, `staleTime: 'static'` is the more honest expression of that (it also blocks manual `invalidateQueries`), and the real question becomes why it is in a query cache at all rather than being passed down from the server.

---

← [05c · Nested prefetch and streaming](05c-nested-prefetch-and-streaming.md) · [Chapter 8 overview](01-explanation.md) · Next → [05e · Invalidating both caches](05e-invalidating-both-caches.md)
