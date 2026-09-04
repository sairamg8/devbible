---
title: "Prefetching does not have to happen at the top of the route and does not have to be awaited — colocated HydrationBoundaries and dehydrated pending queries let the cache fill while the page streams, at the cost of a server-side waterfall you have to see to avoid"
sidebar_label: "05c · Nested prefetch and streaming"
sidebar_position: 141
description: "Multiple HydrationBoundary elements, the cache()-scoped single client, the server-side waterfall a nested prefetch creates, dehydrating pending queries for streaming, serializeData/deserializeData, and the experimental prefetch-less package."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-05 against the TanStack Query [Advanced Server Rendering](https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr)
> and [Server Rendering & Hydration](https://tanstack.com/query/latest/docs/framework/react/guides/ssr) guides,
> and the Next.js [Server Actions and Mutations](https://nextjs.org/docs/app/guides/server-actions) guide
> (`lastUpdated: 2026-06-17`). Package versions read from the npm registry on 2026-09-05.
> Target: **Next.js 16.3.4** App Router · **React 19.2.8** · **`@tanstack/react-query` 5.102.8**
> (`@tanstack/react-query-next-experimental` 5.102.8) · TypeScript 7.0.2.
> Documentation-verified; **no sandbox run**.

**One `HydrationBoundary` at the top of a route is the tutorial shape, not the required one. Every Server Component in the tree may create its own `QueryClient`, prefetch what its own subtree reads, and dehydrate it into its own boundary — they merge into the single client-side cache rather than fighting over it. The two things that go wrong are both invisible in a local dev run: a nested prefetch that a parent `await`s becomes a server-side request waterfall, and a prefetch you forgot to await produces an empty `dehydrate()` unless you have opted pending queries into dehydration — which, once you have, is also the mechanism that lets the data stream.**

## Multiple boundaries, colocated with the components that read

> *"As you can see, it's perfectly fine to use `<HydrationBoundary>` in multiple places, and create and dehydrate multiple `queryClient` for prefetching."*
> — [Advanced Server Rendering](https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr#nesting-server-components)

```tsx filename="app/board/[boardId]/page.tsx"
import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query'
import { listTasks } from '@/lib/data/tasks'
import { Board } from './board'
import { ActivityPanel } from './activity-panel'

export default async function BoardPage({
  params,
}: {
  params: Promise<{ boardId: string }>
}) {
  const { boardId } = await params
  const queryClient = new QueryClient()

  await queryClient.prefetchQuery({
    queryKey: ['board', boardId],
    queryFn: () => listTasks(boardId),
  })

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Board boardId={boardId} />
      <ActivityPanel boardId={boardId} />
    </HydrationBoundary>
  )
}
```

```tsx filename="app/board/[boardId]/activity-panel.tsx"
import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query'
import { listActivity } from '@/lib/data/activity'
import { ActivityFeed } from './activity-feed'

// A Server Component that owns its own prefetch and its own boundary.
export async function ActivityPanel({ boardId }: { boardId: string }) {
  const queryClient = new QueryClient()

  await queryClient.prefetchQuery({
    queryKey: ['activity', boardId],
    queryFn: () => listActivity(boardId),
  })

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ActivityFeed boardId={boardId} />
    </HydrationBoundary>
  )
}
```

On the client both dehydrated payloads are hydrated into the one `QueryClient` supplied by `QueryClientProvider`. They do not conflict, because hydration writes keyed entries into a shared cache.

### The waterfall this creates

`BoardPage` awaits `listTasks` before it returns the JSX that contains `ActivityPanel`, so `listActivity` cannot start until `listTasks` has finished. The guide draws it as:

```text
1. |> getPosts()
2.   |> getComments()
```

*(Illustrative diagram taken verbatim from the guide — it is a sequence sketch, not program output.)*

> *"If the server latency to the data is low, this might not be a huge issue, but is still worth pointing out. In Next.js, besides prefetching data in `page.tsx`, you can also do it in `layout.tsx`, and in parallel routes. Because these are all part of the routing, Next.js knows how to fetch them all in parallel."*
> — [Advanced Server Rendering](https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr#nesting-server-components)

Three ways out, in order of preference: kick both prefetches off in the parent without awaiting the first, move the second into a parallel route slot so the router runs them concurrently, or hoist the shared one into `layout.tsx`.

```tsx
// Both requests in flight before either is awaited.
const tasks = queryClient.prefetchQuery({ queryKey: ['board', boardId], queryFn: () => listTasks(boardId) })
const activity = queryClient.prefetchQuery({ queryKey: ['activity', boardId], queryFn: () => listActivity(boardId) })
await Promise.all([tasks, activity])
```

## The single-client alternative, scoped with `cache()`

```ts filename="lib/query/server-client.ts"
import { QueryClient } from '@tanstack/react-query'
import { cache } from 'react'

// cache() is scoped per request, so we don't leak data between requests
export const getServerQueryClient = cache(() => new QueryClient())
```

> *"The benefit of this is that you can call `getQueryClient()` to get a hold of this client anywhere that gets called from a Server Component, including utility functions. The downside is that every time you call `dehydrate(getQueryClient())`, you serialize the entire `queryClient`, including queries that have already been serialized before and are unrelated to the current Server Component which is unnecessary overhead."*
> — [Advanced Server Rendering](https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr#alternative-use-a-single-queryclient-for-prefetching)

The guide is explicit that a **new client per Server Component is the recommended approach** and the shared one is the alternative. Take the shared one when your `queryFn`s are not `fetch`-based and therefore not deduped by Next.js, and you are willing to pay duplicated serialisation to avoid duplicated requests.

## Streaming: prefetch without awaiting

Since TanStack Query v5.40.0 a still-pending query can be dehydrated, which is what this override in the client factory enables:

```ts
dehydrate: {
  shouldDehydrateQuery: (query) =>
    defaultShouldDehydrateQuery(query) || query.state.status === 'pending',
}
```

With that in place the page starts the fetch and returns immediately:

```tsx filename="app/board/[boardId]/page.tsx"
import { dehydrate, HydrationBoundary } from '@tanstack/react-query'
import { getQueryClient } from '@/lib/query/get-query-client'
import { listTasks } from '@/lib/data/tasks'
import { Board } from './board'

// Not async: nothing is awaited.
export default function BoardPage({ params }: { params: { boardId: string } }) {
  const queryClient = getQueryClient()

  void queryClient.prefetchQuery({
    queryKey: ['board', params.boardId],
    queryFn: () => listTasks(params.boardId),
  })

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Board boardId={params.boardId} />
    </HydrationBoundary>
  )
}
```

```tsx filename="app/board/[boardId]/board.tsx"
'use client'

import { useSuspenseQuery } from '@tanstack/react-query'
import { listTasks } from '@/lib/data/tasks'

export function Board({ boardId }: { boardId: string }) {
  // Consumes the promise created on the server.
  const { data } = useSuspenseQuery({
    queryKey: ['board', boardId],
    queryFn: () => listTasks(boardId),
  })
  return <ul>{data.map((t) => <li key={t.id}>{t.title}</li>)}</ul>
}
```

What makes this legal is a React capability, not a TanStack one:

> *"This works in NextJs and Server Components because React can serialize Promises over the wire when you pass them down to Client Components."*
> — [Advanced Server Rendering](https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr#streaming-with-server-components)

`useQuery` also picks the promise up, but with a consequence worth knowing:

> *"Note that you could also `useQuery` instead of `useSuspenseQuery`, and the Promise would still be picked up correctly. However, NextJs won't suspend in that case and the component will render in the `pending` status, which also opts out of server rendering the content."*
> — [Advanced Server Rendering](https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr#streaming-with-server-components)

So the rule inverts between the two setups. **Awaited prefetch → `useQuery`**, because it degrades gracefully if the prefetch is later removed. **Un-awaited streaming prefetch → `useSuspenseQuery`**, because suspending is the mechanism that keeps the content server-rendered.

⚠️ If you also use the persist adapter, restrict what it writes: *"We don't want to save promises into the storage, so we only persist successful queries"* — pass `dehydrateOptions: { shouldDehydrateQuery: defaultShouldDehydrateQuery }` to `PersistQueryClientProvider`.

## Non-JSON data across the boundary

The dehydrated payload is serialised into the RSC stream. Anything that is not JSON — `Date`, `Temporal`, `Decimal`, `Map` — arrives on the other side as whatever JSON made of it. Configure both directions:

```ts filename="lib/query/get-query-client.ts"
import { QueryClient } from '@tanstack/react-query'
import { deserialize, serialize } from '@/lib/query/transformer'

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      hydrate: { deserializeData: deserialize },
      dehydrate: { serializeData: serialize },
    },
  })
}
```

The `queryFn` on the server must then produce the serialised shape (`() => listTasks(boardId).then(serialize)`), so that both sides of the boundary hold the same representation.

## The experimental prefetch-less route

`@tanstack/react-query-next-experimental` (**5.102.8**, published in lockstep with the core packages) removes prefetching entirely: wrap the tree in `ReactQueryStreamedHydration` and call `useSuspenseQuery` in Client Components. The guide is candid about the trade:

> *"This package will allow you to fetch data on the server (in a Client Component) by just calling `useSuspenseQuery` in your component. Results will then be streamed from the server to the client as SuspenseBoundaries resolve. If you call `useSuspenseQuery` without wrapping it in a `<Suspense>` boundary, the HTML response won't start until the fetch resolves. This can be what you want depending on the situation, but keep in mind that this will hurt your TTFB."*
> — [Advanced Server Rendering](https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr#experimental-streaming-without-prefetching-in-nextjs)

And on why the recommended path is still prefetching: the prefetch-less approach *"will only flatten the waterfalls on the initial page load but ends up the same deep waterfall as the original example on page navigations"*. The word **experimental** is in the package name; treat it accordingly.

## Gotchas

**★ Symptom: `dehydrate()` returns an empty state and nothing is hydrated.** Cause: the query failed, and `dehydrate` only includes successful queries by default; or the prefetch was never awaited while pending dehydration was not enabled. Fix: either await the prefetch, or opt pending queries in.

```ts
dehydrate: {
  shouldDehydrateQuery: (query) =>
    defaultShouldDehydrateQuery(query) || query.state.status === 'pending',
}
```

**★ Symptom: dates from the server arrive as strings and every comparison in the client component is wrong.** Cause: the dehydrated payload is JSON; nothing revives it. Fix: configure a transformer on both sides of the boundary.

```ts
new QueryClient({
  defaultOptions: {
    dehydrate: { serializeData: serialize },
    hydrate: { deserializeData: deserialize },
  },
})
```

**★ Symptom: server errors from a prefetch are swallowed and the page silently renders a loading state forever.** Cause: `prefetchQuery` and `void query(...).catch(noop)` are deliberately graceful — `dehydrate` drops failed queries, so the client re-runs them from scratch. Fix: for critical data, await `query()` and handle it.

```ts
try {
  await queryClient.query(boardOptions(boardId))
} catch {
  notFound()
}
```

**★ Symptom: adding a colocated prefetch to a child Server Component made TTFB worse.** Cause: the parent awaits its own prefetch before rendering the child, so the two requests are serial. Fix: start both before awaiting either.

```ts
await Promise.all([
  queryClient.prefetchQuery(boardOptions(boardId)),
  queryClient.prefetchQuery(activityOptions(boardId)),
])
```

**★ Symptom: the streaming setup renders a spinner on the server instead of content.** Cause: the client component uses `useQuery`, which does not suspend, so Next.js renders it in `pending` and — per the guide — opts that subtree out of server rendering. Fix: use `useSuspenseQuery` in the streaming setup specifically.

```tsx
const { data } = useSuspenseQuery(boardOptions(boardId))
```

**★ Symptom: with the persist adapter enabled, storage fills with unusable entries after switching on streaming.** Cause: pending queries are now dehydratable, and the persister is writing promises. Fix: restrict what the persister dehydrates.

```tsx
<PersistQueryClientProvider
  client={queryClient}
  persistOptions={{ persister, dehydrateOptions: { shouldDehydrateQuery: defaultShouldDehydrateQuery } }}
>
  {children}
</PersistQueryClientProvider>
```

**★ Symptom: using the `cache()`-scoped single client, the RSC payload grows on every nested boundary.** Cause: `dehydrate(getServerQueryClient())` serialises the *entire* client each time, including entries already sent by an ancestor boundary. Fix: use a fresh `new QueryClient()` per prefetching Server Component — the recommended shape — and keep the shared client only for the case where request deduplication matters more than payload size.

## Interview questions

**★ How do multiple `HydrationBoundary` elements interact, and when would you use more than one?**
Each boundary hydrates the dehydrated state it is given into the one `QueryClient` from context; they merge rather than compete. You use several when prefetching is colocated with the components that need it — an activity Server Component prefetching activity, nested inside a page Server Component prefetching the board. The trade-off is that awaiting a parent's prefetch before rendering the child creates a server-side waterfall, which you flatten by starting both promises before awaiting, or by moving the prefetch into a layout or a parallel route slot so Next.js can run them concurrently.

**★ What does enabling pending-query dehydration buy you, and what does it require?**
It lets a Server Component start a fetch and return immediately, streaming the data to the client as it resolves instead of blocking the Suspense boundary until it does. It requires opting pending queries into dehydration via `shouldDehydrateQuery`, and it works because React can serialise the promise across the RSC boundary. The natural consumer on the client is `useSuspenseQuery`, which uses the streamed promise; `useQuery` will pick it up too but renders in the pending status first, opting that content out of server rendering.

**Why does the recommendation flip between `useQuery` and `useSuspenseQuery` depending on how you prefetched?**
Because the two setups fail differently. With an awaited prefetch the data is already in the dehydrated state, so `useQuery` never shows a loading state, and if someone later deletes the prefetch it degrades to a client fetch rather than a suspended tree. With an un-awaited streaming prefetch, suspending *is* the mechanism — `useSuspenseQuery` consumes the server-created promise and keeps the content server-rendered, while `useQuery` renders pending and opts that subtree out of SSR entirely.

**When is a `cache()`-scoped single `QueryClient` the right call on the server?**
When your `queryFn`s are not built on `fetch` — a database client, an ORM, a gRPC stub — so Next.js's request deduplication does not apply, and the same key would otherwise be fetched by two different Server Components in the same render. The shared client dedupes it. You accept in exchange that every `dehydrate()` call re-serialises the whole cache, so the RSC payload grows with each boundary. With `fetch`-based reads, the framework already dedupes and the fresh-client-per-component shape is strictly better.

**Explain the graceful-degradation posture of prefetching, and when you should break it.**
By default `dehydrate` includes only successful queries and prefetch helpers swallow errors, so a failed server prefetch produces a page that renders loading states and retries on the client — nothing crashes, and a flaky dependency cannot take the route down. Break it when the data is what the page *is*: an unknown board id should be a 404, not a permanent spinner. That means `await queryClient.query(...)` without a catch and letting the error reach `notFound()` or the error boundary.

**Your page uses `Decimal` amounts from the ORM and the client renders `[object Object]`. Walk through the fix.**
The dehydrated cache crosses the boundary as JSON, so a `Decimal` becomes whatever its JSON form is. The fix is symmetric: `dehydrate.serializeData` converts to a wire form on the server, `hydrate.deserializeData` reconstructs on the client, and the server `queryFn` must produce the serialised shape so both sides of the boundary agree on the representation. Doing only one half gives you a cache whose contents differ between server and client, which shows up as a hydration mismatch rather than a clean error.

**Why is `@tanstack/react-query-next-experimental` not the default recommendation despite being simpler?**
Because it only flattens request waterfalls on the initial page load. On client-side navigations it reproduces the deep component-then-data waterfall the prefetching approach eliminates: the JS for a component loads, the component mounts, only then does its query start, and a nested component repeats the cycle. The guide accepts it as a reasonable trade if you value iteration speed, do not have deeply nested queries, or already parallelise with `useSuspenseQueries` — but the package is named experimental for a reason.

---

← [05b · Prefetch + HydrationBoundary](05b-server-prefetch-and-hydrationboundary.md) · [Chapter 8 overview](01-explanation.md) · Next → [05d · When the two caches disagree](05d-when-the-two-caches-disagree.md)
