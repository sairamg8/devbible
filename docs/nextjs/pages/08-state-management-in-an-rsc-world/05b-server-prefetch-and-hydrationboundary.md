---
title: "The two layers coexist by treating a Server Component as a loader — prefetch into a per-request QueryClient, dehydrate it into a HydrationBoundary, and never let a QueryClient become a module singleton"
sidebar_label: "05b · Prefetch + HydrationBoundary"
sidebar_position: 31
description: "Creating a QueryClient per request and per browser session, why the provider must be a Client Component, dehydrate/HydrationBoundary, the query-key match, and the staleTime double-fetch."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-05 against the TanStack Query [Advanced Server Rendering](https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr),
> [Server Rendering & Hydration](https://tanstack.com/query/latest/docs/framework/react/guides/ssr) and
> [Important Defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults) guides.
> API surface probed against the published type declarations of **`@tanstack/query-core` 5.102.8**
> (`QueryClient` declares `query`, `fetchQuery`, `prefetchQuery`, `prefetchInfiniteQuery`; `environmentManager`
> and `isServer` are exported and re-exported by `@tanstack/react-query`).
> Target: **Next.js 16.3.4** App Router · **React 19.2.8** · **`@tanstack/react-query` 5.102.8** · TypeScript 7.0.2.
> Documentation-verified; **no sandbox run**.

**A `QueryClient` is a mutable in-memory store. On a Node server that handles many requests concurrently, a module-level `QueryClient` is one store shared by every user in the process — one customer's invoice list served to another. That single fact drives the entire App Router setup: a fresh client per server request, exactly one per browser session, a Client Component to hold the provider, and `dehydrate` + `HydrationBoundary` as the wire format between them. TanStack's guide frames the whole arrangement in one sentence: think of a Server Component as "just" another framework loader.**

## The mental model: Server Component as loader

> *"How do we take what we learned in the Server Rendering guide about passing data prefetched in framework loaders to the app and apply that to Server Components and the Next.js app router? The best way to start thinking about this is to consider Server Components as 'just' another framework loader."*
> — [Advanced Server Rendering](https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr#server-components--nextjs-app-router)

The guide also warns about a terminology trap that causes real bugs:

> *"Server Components are guaranteed to only run on the server, but Client Components can actually run in both places. The reason for this is that they can also render during the initial server rendering pass."*
> — [Advanced Server Rendering](https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr#a-quick-note-on-terminology)

A `'use client'` component containing `useQuery` **runs on the server** during SSR. That is why `getQueryClient()` needs a branch on the environment rather than a `typeof window` check buried in a component.

## Step 1 — the client factory

```ts filename="lib/query/get-query-client.ts"
import {
  QueryClient,
  defaultShouldDehydrateQuery,
  environmentManager,
} from '@tanstack/react-query'

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // With SSR, a staleTime above 0 stops every prefetched query
        // from refetching the moment it mounts in the browser.
        staleTime: 60 * 1000,
      },
      dehydrate: {
        // Include still-pending queries so they can be streamed.
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) || query.state.status === 'pending',
        // Next.js detects dynamic pages via thrown server errors and
        // redacts errors itself, so do not redact them here.
        shouldRedactErrors: () => false,
      },
    },
  })
}

let browserQueryClient: QueryClient | undefined = undefined

export function getQueryClient() {
  if (environmentManager.isServer()) {
    // Server: always a new client, so no request sees another's data.
    return makeQueryClient()
  }
  // Browser: one client for the tab's lifetime. Creating a second one
  // if React suspends during the initial render would throw the cache away.
  if (!browserQueryClient) browserQueryClient = makeQueryClient()
  return browserQueryClient
}
```

Both branches are load-bearing and for opposite reasons. On the server a shared client is a data leak; in the browser a re-created client is a cache wipe. The guide's own comment on the browser branch:

> *"Browser: make a new query client if we don't already have one. This is very important, so we don't re-make a new client if React suspends during the initial render. This may not be needed if we have a suspense boundary BELOW the creation of the query client"*
> — [Advanced Server Rendering](https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr#streaming-with-server-components)

`browserQueryClient` **is** a module singleton, and that is fine: the browser module graph is per tab, per user. The server module graph is per process, shared by every concurrent request. Same code shape, opposite consequence — which is precisely why the branch exists instead of one `let client = new QueryClient()`.

## Step 2 — the provider, which must be a Client Component

```tsx filename="app/providers.tsx"
'use client'

import { QueryClientProvider } from '@tanstack/react-query'
import { getQueryClient } from '@/lib/query/get-query-client'

export function Providers({ children }: { children: React.ReactNode }) {
  // NOTE: not useState. If React suspends on the initial render and there is
  // no Suspense boundary between here and the suspending code, React throws
  // away the state — and with it the client.
  const queryClient = getQueryClient()

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
```

```tsx filename="app/layout.tsx"
import { Providers } from './providers'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
```

`QueryClientProvider` uses context, so it cannot live in a Server Component. Wrapping `{children}` in a Client Component does **not** turn the children into Client Components — they arrive as an already-rendered `children` prop, so a Server Component page still renders on the server under this provider. This is the single most common misreading of the setup.

## Step 3 — prefetch in the Server Component, hydrate in the client

```tsx filename="app/board/[boardId]/page.tsx"
import { dehydrate, HydrationBoundary } from '@tanstack/react-query'
import { getQueryClient } from '@/lib/query/get-query-client'
import { listTasks } from '@/lib/data/tasks'
import { Board } from './board'

export default async function BoardPage({
  params,
}: {
  params: Promise<{ boardId: string }>
}) {
  const { boardId } = await params
  const queryClient = getQueryClient()

  await queryClient.prefetchQuery({
    queryKey: ['board', boardId],
    queryFn: () => listTasks(boardId),
  })

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Board boardId={boardId} />
    </HydrationBoundary>
  )
}
```

```tsx filename="app/board/[boardId]/board.tsx"
'use client'

import { useQuery } from '@tanstack/react-query'
import { listTasks } from '@/lib/data/tasks'

export function Board({ boardId }: { boardId: string }) {
  // Prefetched above, so this never suspends and never shows a loading state
  // on first paint. If the prefetch is removed, it degrades to a client fetch
  // rather than breaking — which is why useQuery beats useSuspenseQuery here.
  const { data } = useQuery({
    queryKey: ['board', boardId],
    queryFn: () => listTasks(boardId),
  })

  return <ul>{data?.map((t) => <li key={t.id}>{t.title}</li>)}</ul>
}
```

The query key must match **exactly** on both sides — same array, same order, same primitive types. `['board', boardId]` on the server and `['board', { boardId }]` on the client are two different entries, and the symptom is a page that renders correct data and then immediately refetches it.

`prefetchQuery` returns `Promise<void>` and swallows errors; `queryClient.query()` (also present on the 5.102.8 `QueryClient`) returns the data and rejects. The guide's error posture:

> *"React Query defaults to a graceful degradation strategy. This means: `dehydrate(...)` only includes successful queries, not failed ones · We can intentionally ignore the returned promise from `void queryClient.query(...)` and add `.catch(noop)` to swallow any errors, so surrounding loader code will not observe query errors"*
> — [Server Rendering & Hydration](https://tanstack.com/query/latest/docs/framework/react/guides/ssr#error-handling)

Use `await queryClient.query(...)` without the catch when the data is critical and a missing row should become a 404 or a 500.

## Gotchas

**★ Symptom: user A occasionally sees user B's data on a cold server, and it never reproduces locally.** Cause: a module-level `const queryClient = new QueryClient()` imported by a Server Component. One Node process serves concurrent requests; that client is shared by all of them. It does not reproduce with one developer clicking. Fix: branch on the environment, or scope with `cache()`.

```ts
// 🚩 leaks across requests
export const queryClient = new QueryClient()

// ✅ per request on the server, per tab in the browser
export function getQueryClient() {
  return environmentManager.isServer() ? makeQueryClient() : (browserQueryClient ??= makeQueryClient())
}
```

**★ Symptom: the page renders with correct data, then immediately refetches everything on mount.** Cause: `staleTime` defaults to `0`, so every hydrated query is stale the instant it lands. Fix: set a default `staleTime` above zero in the factory.

```ts
new QueryClient({ defaultOptions: { queries: { staleTime: 60 * 1000 } } })
```

**★ Symptom: hydrated data appears, then is replaced by a loading spinner.** Cause: the server key and the client key are not identical — a different array shape, a number on one side and a string on the other, or an object with keys in a different order. Fix: define the key once with `queryOptions` and import it on both sides.

```ts filename="lib/query/board-options.ts"
import { queryOptions } from '@tanstack/react-query'
import { listTasks } from '@/lib/data/tasks'

export const boardOptions = (boardId: string) =>
  queryOptions({ queryKey: ['board', boardId], queryFn: () => listTasks(boardId) })
```

```tsx
// server:  await queryClient.prefetchQuery(boardOptions(boardId))
// client:  const { data } = useQuery(boardOptions(boardId))
```

**★ Symptom: the cache empties whenever a Suspense boundary resolves during the first render.** Cause: the provider used `useState(() => new QueryClient())` with no Suspense boundary below the creation point, so React discarded the state when the initial render suspended. Fix: use the module-scoped `getQueryClient()` in the provider, as the code above does — that is exactly the case the guide's `NOTE` comment is warning about.

**★ Symptom: a Client Component that calls `useQuery` crashes during SSR with "No QueryClient set".** Cause: the `QueryClientProvider` is mounted below the component in the tree, or in a different layout branch. Fix: mount `Providers` in the root layout so every route is inside it — and remember that Client Components do render on the server, so "it works in the browser" is not evidence.

**★ Symptom: adding `'use client'` to `providers.tsx` turned the whole app into a client bundle — or so a reviewer claims.** Cause: a misreading. Fix: none needed, but be able to explain it — `children` is passed as an already-rendered prop, so Server Components below the provider still render on the server. The check is a build output where page components still appear as server chunks.

## Interview questions

**★ Why must `getQueryClient()` branch on server vs browser instead of just creating one client?**
Because the two environments need opposite lifetimes from the same code. On the server a `QueryClient` is a mutable store inside a process that handles many users' requests concurrently, so sharing one means one request's prefetched rows are visible to another — a data leak that will not reproduce under single-user testing. In the browser the opposite is true: the client must persist for the tab, because re-creating it discards the entire cache, and React will re-run the provider's body if the initial render suspends without a boundary below it. One branch gives you a fresh store per request and a stable store per tab.

**★ Does putting `'use client'` on the providers file force everything below it into the client bundle?**
No. `Providers` receives `children` as a prop that was already rendered on the server, so Server Components below it in the *tree* are still Server Components in the *module graph*. The rule is about imports, not nesting: a module that a Client Component `import`s becomes client code; a subtree passed in as `children` does not. This is why the standard setup mounts the provider in the root layout without any bundle-size consequence.

**★ Why does the prefetched page refetch the moment it hydrates, and what is the fix?**
`staleTime` defaults to `0`, meaning every query is stale as soon as it exists, and TanStack refetches stale queries when a new observer mounts. Hydration mounts observers. So the freshly server-rendered data is immediately considered stale and refetched — you pay for the data twice and the user may see a flash. Setting a default `staleTime` above zero on the client factory (the guide uses 60 seconds) makes the hydrated data count as fresh for that window.

**What is the difference between `prefetchQuery` and `query` on the `QueryClient`, and when does it matter?**
`prefetchQuery` resolves to `void` and does not surface errors; `query` resolves with the data and rejects on failure. It matters at the point where you decide whether missing data should degrade to a client-side loading state or should fail the route. Non-critical panels use `prefetchQuery` (or `void query(...).catch(noop)`) so a flaky dependency does not take down the page; critical data uses `await query(...)` so you can call `notFound()` or let the error boundary handle it.

**Why prefer `useQuery` over `useSuspenseQuery` in a component whose data was prefetched?**
Because it degrades gracefully. With the prefetch in place, `useQuery` has data on first render and never shows a loading state — identical to the Suspense version. If someone later deletes or breaks the prefetch, `useQuery` falls back to fetching on the client, while `useSuspenseQuery` would suspend and, in the non-streamed setup, produce a worse waterfall. The exception is the streaming setup, where the point is that the server-created promise is consumed by `useSuspenseQuery`.

---

← [05 · Client caches: do you need one?](05-tanstack-query-rtk-query-in-app-router-when-a-client-cache-s.md) · [Chapter 8 overview](01-explanation.md) · Next → [05c · Nested prefetch and streaming](05c-nested-prefetch-and-streaming.md)
