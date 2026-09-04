---
title: "A client cache earns its place in the App Router only when the browser must fetch on its own initiative — polling, focus, sockets, infinite lists and offline queues — and for a plain CRUD screen the honest answer is that you do not need one"
sidebar_label: "05 · Client caches: do you need one?"
sidebar_position: 30
description: "What TanStack Query and RTK Query do that the RSC / fetch / use cache layer structurally cannot, what you pay for adding a second cache, and the decision table for when the answer is no."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-05 against the TanStack Query [Advanced Server Rendering](https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr)
> and [Important Defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults) guides,
> the Redux Toolkit [Setup with Next.js](https://redux-toolkit.js.org/usage/nextjs) guide, and the Next.js
> [Server Actions and Mutations](https://nextjs.org/docs/app/guides/server-actions) guide (`lastUpdated: 2026-06-17`).
> Target: **Next.js 16.3.4** App Router · **React 19.2.8** · **`@tanstack/react-query` 5.102.8** ·
> **`@reduxjs/toolkit` 2.12.0** · `react-redux` 9.3.0 · TypeScript 7.0.2.
> Documentation-verified; **no sandbox run**.

**Every argument for a client cache in the App Router reduces to one question: does the browser ever need to fetch this data on its own initiative, without a user navigation and without a Server Action? If it does — a five-second poll, a refetch when the tab regains focus, a socket push, page eleven of an infinite list, a mutation queued while the laptop lid was shut — the framework has nothing that does that job, and TanStack Query or RTK Query is the right tool. If it does not, you are about to ship a second cache that stores the same rows the server already cached, invalidated by a second mechanism that knows nothing about `revalidateTag`, and every screen in your app gets a little worse. TanStack's own guide says to start without it.**

## The framework's caches are server-side and navigation-driven

The App Router's data layer has three moving parts, none of which run a fetch in the browser:

| Layer | Lives | Populated by | Invalidated by |
|---|---|---|---|
| `fetch` / `use cache` entries | Server | A server render | `revalidateTag`, `updateTag`, `revalidatePath`, time |
| The RSC Payload for a route | Server render output | A navigation or a Server Action response | A new navigation, `refresh()`, `router.refresh()` |
| Client Router Cache | Browser | Prefetch and navigation | Navigation, `router.refresh()` |

Every one of those is driven by something *the framework* initiates: a route request, a Server Action round trip, a prefetch on link hover. There is no framework API that says *"re-read this list every eight seconds while the user stares at it"*. That is the gap, and it is a structural gap, not a missing feature.

The Next.js docs describe the action round trip precisely:

> *"When a Server Action triggers an immediate revalidation, Next.js does the work inside one HTTP request: it runs the action, then re-renders the current route server-side."*
> — [Server Actions and Mutations](https://nextjs.org/docs/app/guides/server-actions#a-single-response-carries-data-and-ui)

Note the trigger: *a Server Action*. Something the user did. Everything the framework offers is a response to an event that already went through React's action mechanism or the router.

## The six jobs a client cache actually does

Each of these is a job the server layer cannot do at all, not a job it does worse.

### 1 · Interval polling

TanStack Query's defaults page states it plainly:

> *"Queries can optionally be configured with a `refetchInterval` to trigger refetches periodically, which is independent of the `staleTime` setting."*
> — [Important Defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults)

```tsx
'use client'

import { useQuery } from '@tanstack/react-query'

export function BuildStatus({ buildId }: { buildId: string }) {
  const { data } = useQuery({
    queryKey: ['build-status', buildId],
    queryFn: () => fetch(`/api/builds/${buildId}/status`).then((r) => r.json()),
    refetchInterval: (query) =>
      query.state.data?.state === 'running' ? 3_000 : false,
  })

  return <span data-state={data?.state}>{data?.state ?? 'unknown'}</span>
}
```

The equivalent without a client cache is a `setInterval` calling `router.refresh()`, which re-renders and re-streams **the whole route** every three seconds to update one badge. That is not a smaller solution; it is a much larger one.

### 2 · Refetch on window focus and on reconnect

> *"Stale queries are refetched automatically in the background when: New instances of the query mount · The window is refocused · The network is reconnected"*
> — [Important Defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults)

Three browser-lifecycle events, none of which the framework observes. If your board must be right when a user comes back from Slack forty minutes later, this behaviour is the entire reason to install the library.

### 3 · Socket-fed data read through the same key

A websocket delivers a message; the UI has to re-render with it. Without a cache you keep a `useState` next to the socket and thread it down. With one, the socket writes into the same keyed entry every component already reads:

```tsx
'use client'

import { useEffect } from 'react'
import { useQueryClient, useQuery } from '@tanstack/react-query'

type Task = { id: string; title: string; status: string }

export function useLiveBoard(boardId: string) {
  const queryClient = useQueryClient()

  useEffect(() => {
    const socket = new WebSocket(`wss://sprintdesk.example/boards/${boardId}`)
    socket.onmessage = (event) => {
      const task: Task = JSON.parse(event.data)
      queryClient.setQueryData<Task[]>(['board', boardId], (current) =>
        (current ?? []).map((t) => (t.id === task.id ? task : t)),
      )
    }
    return () => socket.close()
  }, [boardId, queryClient])

  return useQuery<Task[]>({ queryKey: ['board', boardId] })
}
```

`setQueryData` is a synchronous write into the cache that every observer of that key sees. There is no server round trip, which is the whole point — the server already told you.

### 4 · Infinite lists that survive navigation away and back

An infinite scroll is *accumulated* client state: pages 1..n concatenated, plus the cursor. Navigate to a detail page and back with pure RSC data flow and you are at page 1 again, at the top. `useInfiniteQuery` keeps the accumulated pages under one key, and TanStack keeps them:

> *"Query results that have no more active instances of `useQuery`, `useInfiniteQuery` or query observers are labeled as 'inactive' and remain in the cache in case they are used again at a later time. By default, 'inactive' queries are garbage collected after **5 minutes**."*
> — [Important Defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults)

Five minutes of retained scroll depth, for free. Offset pagination in the URL — `?page=4` read by a Server Component — is a genuinely better answer when the list is paginated rather than infinite, and it is free. Infinite scroll is the case where it is not.

### 5 · Mutation queues, retry and offline

`useMutation` gives you retry, an in-flight registry (`useIsMutating`), and — with the persist adapter — a queue that survives a reload. Server Actions have none of that by design: the Next.js dispatcher runs them one at a time and drops the rest of your plan on the floor if you try to parallelise.

> *"Next.js dispatches Server Actions one at a time per client. If a user triggers three actions in quick succession, the second waits for the first to finish, then the third waits for the second."*
> — [Server Actions and Mutations](https://nextjs.org/docs/app/guides/server-actions#sequential-dispatch-on-the-client)

⚠️ Next.js 16.3 does ship an **experimental** `useOffline` config under which *"a Server Action interrupted by a connectivity drop stays pending and completes when the network returns"* ([Forms guide](https://nextjs.org/docs/app/guides/forms), `lastUpdated: 2026-08-25`). It is marked experimental in that sentence; treat it as a thing to watch, not a thing to build a delivery-driver app on today.

### 6 · One keyed entry shared across routes without a round trip

A "current org" summary rendered in the sidebar on every route, refreshed once. RSC gives you that too — via `use cache` on the server — but every navigation still asks the server. A client cache answers from memory. Whether that difference matters is a latency question with an actual number attached, and you should measure it rather than assume it.

## What you pay

Adding a client cache to an App Router app is not free, and the costs are systematic:

- **Two invalidation systems that do not know about each other.** `revalidateTag('board')` expires a server cache entry. It does not touch `queryClient`'s `['board', id]`. You will end up calling both, from two places, forever.
- **Two copies of the same rows in the response.** Prefetched-and-dehydrated data ships inside the RSC payload *and* is re-serialised into the hydration boundary.
- **The provider is a Client Component**, so everything below the point where you mount it is inside a client boundary for context purposes — see [05b](05b-server-prefetch-and-hydrationboundary.md) for why that matters less than it sounds, and where it genuinely bites.
- **A second source of truth to keep in sync with the server render.** This is the failure that actually hurts, and it has its own chunk: [05d](05d-when-the-two-caches-disagree.md).

TanStack says the same thing in its own guide, and it is worth quoting at full length because it is the most useful sentence in the entire document:

> *"It's hard to give general advice on when it makes sense to pair React Query with Server Components and not. **If you are just starting out with a new Server Components app, we suggest you start out with any tools for data fetching your framework provides you with and avoid bringing in React Query until you actually need it.** This might be never, and that's fine, use the right tool for the job!"*
> — [Advanced Server Rendering](https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr#data-ownership-and-revalidation)

Redux's guide draws the same line for its own library:

> *"only use Redux for globally shared, mutable data · use a combination of Next.js state (search params, route parameters, form state, etc.), React context and React hooks for all other state management."*
> — [Redux Toolkit Setup with Next.js](https://redux-toolkit.js.org/usage/nextjs)

## The decision table

| Screen | Client cache? | Why |
|---|---|---|
| CRUD list + create/edit/delete forms | **No** | Server Action + `updateTag` or `refresh()` gives read-your-own-writes in one round trip |
| Filterable, sortable, paginated table | **No** | Put the filters in the URL; the Server Component is the query |
| Dashboard that must stay current unattended | **Yes** | `refetchInterval` — nothing framework-side polls |
| Anything fed by a websocket | **Yes** | `setQueryData` from the socket handler |
| Infinite scroll with a preserved position | **Yes** | Accumulated pages under one key, retained for `gcTime` |
| Offline-capable / flaky-network mutations | **Yes** | Mutation queue + persist adapter |
| Search-as-you-type against a big index | **Maybe** | Debounced `useQuery` with `placeholderData` is nicer than a navigation per keystroke |
| "We already have RTK Query from the SPA" | **Yes, keep it** | Migration cost beats rewrite cost; see [05f](05f-rtk-query-and-the-redux-question.md) |
| A Redux store added *now* to hold server rows | **No** | Redux's own docs say client-only fetching, mutable data only |

For the "No" rows the framework-native replacements are [`refresh()`](10-refresh.md), the invalidation family in [10b](10b-refresh-against-the-alternatives.md), and the React 19 action hooks in **`useActionState` and `useOptimistic`** — chunk 06 of this chapter, which starts at [06](06-useoptimistic-and-useactionstate-as-framework-native-alterna.md).

## Gotchas

**★ Symptom: you installed TanStack Query for a screen whose only requirement was "the list should update after I add a row."** Cause: that requirement is satisfied by a Server Action that calls `updateTag`, because the action's response already carries the re-rendered route. Fix: delete the query and let the round trip do it.

```tsx
// app/board/actions.ts
'use server'

import { updateTag } from 'next/cache'

export async function addTask(formData: FormData) {
  await db.task.create({ data: { title: String(formData.get('title')) } })
  updateTag('board')  // expires the tag AND ships a fresh render in this response
}
```

**★ Symptom: a `setInterval(() => router.refresh(), 3000)` makes the whole page flicker and the server CPU climb.** Cause: `router.refresh()` re-requests the entire route's RSC payload; you asked for one badge and got a full render. Fix: poll the one thing, with a client query against a Route Handler.

```tsx
'use client'

import { useQuery } from '@tanstack/react-query'

export function QueueDepth() {
  const { data } = useQuery({
    queryKey: ['queue-depth'],
    queryFn: () => fetch('/api/queue/depth').then((r) => r.json()),
    refetchInterval: 5_000,
  })
  return <output>{data?.depth ?? '—'}</output>
}
```

**★ Symptom: you reach for a client cache to "avoid refetching on every navigation", then find navigations got slower.** Cause: the framework already prefetches route payloads on link hover and serves cached segments from the client router cache; adding a query means the browser waits for hydration, mounts the observer, then fetches. Fix: measure the navigation before optimising it, and prefer `use cache` on the server read.

**★ Symptom: `useQuery` inside a Server Component throws.** Cause: it is a hook; Server Components have no hooks and no context. Fix: the query lives in a `'use client'` component; the Server Component prefetches. That split is the whole content of [05b](05b-server-prefetch-and-hydrationboundary.md).

**★ Symptom: three mutations fired with `Promise.all` from a click handler take three times as long as expected.** Cause: they are Server Actions, and the client dispatcher is serial by design — this is documented behaviour, not a bug. Fix: do the parallel work inside one action, or move the reads to a Route Handler that a client query can hit concurrently.

```ts
'use server'

export async function archiveMany(ids: string[]) {
  await Promise.all(ids.map((id) => db.task.update({ where: { id }, data: { archived: true } })))
  updateTag('board')
}
```

## Interview questions

**★ The framework already caches `fetch` results and re-renders on mutation. What can TanStack Query do that it structurally cannot?**
Initiate a fetch from the browser without a navigation or a Server Action. Everything the App Router's data layer does is a response to a router event or an action round trip: the server renders, the cache is consulted, the payload ships. Nothing in the framework observes window focus, network reconnect, a timer, or a websocket message. Those four triggers, plus accumulated client state like infinite-scroll pages and a persisted mutation queue, are the entire honest case for a client cache. Everything else people cite — "avoids refetching", "shares data across components" — is already true of the server layer.

**★ A colleague wants to put the task list in Redux so several components can read it. Argue the other side.**
Those components can read it because a Server Component fetched it and passed it as props, or because they are below a `use cache`-backed read that the framework dedupes. Putting server rows in Redux means the rows now have two homes with independent lifetimes, and mutating them requires you to update both the server cache (so the next navigation is right) and the store (so the current screen is right). Redux's own Next.js guide recommends the store hold *"globally shared, mutable data"* only and that RTK Query fetch *"on the client only"*, with server fetching done by `async` RSCs. Shared read-only server data is exactly what the store should not hold.

**Where does URL state fit between "no cache" and "client cache"?**
It is the answer to most of what people think they need a cache for. Filters, sort order, page number, selected tab and search text belong in `searchParams`, where they survive reload, back/forward and being pasted into Slack, and where the Server Component reads them directly as its query input. A client cache holding filter state gives you none of those properties and one extra copy to reconcile.

**When is offset pagination in the URL better than `useInfiniteQuery`, and when is it worse?**
Better whenever the list is genuinely paginated: `?page=4` is shareable, cacheable per page on the server, and needs no client state at all. Worse when the interaction is a continuous scroll, because the accumulated pages and the scroll position are client state by definition — a navigation away and back with pure URL state restarts you at page 1, and no amount of server caching fixes that.

**Your app polls a build status every three seconds. Why is `router.refresh()` on a timer the wrong implementation?**
Because it re-requests the RSC payload for the entire current route, running every server read in that tree, streaming a full payload, and reconciling the whole client tree — to update a single badge. It also fights any Suspense fallbacks in the route. A `useQuery` with `refetchInterval` against a small Route Handler touches one endpoint and re-renders one component.

**You keep TanStack Query for the socket-fed board but the rest of the app is pure RSC. Is that a coherent architecture?**
Yes, and it is the recommended shape. The library's own guide frames Server Components as *"a place to prefetch data, nothing more"* and explicitly supports mixing prefetched and non-prefetched queries in one tree. Scope the cache to the screens whose requirements the framework cannot meet, and let the CRUD screens stay framework-native. What is *not* coherent is a global rule ("all data goes through Query") applied to screens that only ever fetch on navigation.

---

← [04 · Client state tools compared](04-client-state-tools-compared-react-context-zustand-jotai.md) · [Chapter 8 overview](01-explanation.md) · Next → [05b · Server prefetch and HydrationBoundary](05b-server-prefetch-and-hydrationboundary.md)
