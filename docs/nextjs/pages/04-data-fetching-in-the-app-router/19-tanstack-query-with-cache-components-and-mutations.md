---
sidebar_position: 37
title: "TanStack Query reads the clock, Cache Components forbids reading the clock during a prerender — so caching the server read means building the dehydrated state by hand"
sidebar_label: "TanStack Query with Cache Components"
description: "Caching the server read behind 'use cache' with cacheLife and cacheTag, why dehydrate() raises a current-time prerender error, a hand-built prerenderable hydration state, and coordinating optimistic mutations with updateTag."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-03 against [How to fetch client-side data with TanStack Query](https://nextjs.org/docs/app/guides/client-side-data-fetching/tanstack-query) (docs `lastUpdated` 2026-08-25), [Client-side data fetching](https://nextjs.org/docs/app/guides/client-side-data-fetching), [`cacheComponents`](https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheComponents), [`cacheLife`](https://nextjs.org/docs/app/api-reference/functions/cacheLife), [`cacheTag`](https://nextjs.org/docs/app/api-reference/functions/cacheTag), [`updateTag`](https://nextjs.org/docs/app/api-reference/functions/updateTag), and the error references [`blocking-prerender-current-time`](https://nextjs.org/docs/messages/blocking-prerender-current-time) and [`blocking-prerender-current-time-client`](https://nextjs.org/docs/messages/blocking-prerender-current-time-client).
> Target: **Next.js 16.3.4**. Requires `cacheComponents: true` and **TanStack Query 5.40.0 or later**. Prior page: [18 · TanStack Query: the server handoff](18-tanstack-query-the-server-handoff.md).

**Turning on Cache Components breaks the TanStack Query handoff in a way that is hard to guess from first principles. `dehydrate()` stamps every query with the moment it was serialized, which means it calls `Date.now()`. A prerender has no "now" — the whole point is that the output is reusable across requests at different times — so Next.js raises a current-time prerender error rather than silently baking a build timestamp into a page served for the next year. The fix is not to avoid caching. It is to make the timestamp itself a cached, tagged value that advances only when the data does, and then to assemble the dehydrated state by hand around it.**

## Caching the server read

The server-side function that feeds the prefetch is an ordinary cached read. Wrap it in `'use cache'`, choose a `cacheLife` profile, and tag it so a mutation can invalidate it later:

```ts filename="app/products/[id]/data.ts"
import { cacheLife, cacheTag } from 'next/cache'
import type { Product } from './product-cache'

export async function getProduct(id: string): Promise<Product> {
  'use cache'
  cacheLife('max')
  cacheTag(`product:${id}`)

  const product = await db.product.findUnique({ where: { id } })
  if (!product) throw new Error('Product not found')
  return product
}
```

`cacheLife('max')` is only defensible because the tag gives writes a way to refresh the entry. Time is not what keeps this value correct; `updateTag` is. On a read with no invalidation path, `max` is a permanently stale value.

Within the chosen profile the three durations aim at different caches. `stale` governs how long the Next.js **client** cache may reuse a prefetched RSC payload. `revalidate` and `expire` govern the Next.js **server** cache. Neither has anything to do with TanStack Query's `staleTime`, which governs a third, entirely separate browser cache — the guide is explicit that the two do not need to match. Pick each from the behaviour you want at that layer and stop trying to reconcile them.

The cache directives themselves are covered in **chapter 5, the cache directives** *(not written yet)*.

## Extend the contract to carry a tag

The shared module that already owns the query key becomes the owner of the server tag as well:

```diff filename="app/products/[id]/product-cache.ts"
 export const productCache = {
   key: (id: string) => ['product', id] as const,
+  tag: (id: string) => `product:${id}`,
   // ...
 }
```

The cached function then calls `cacheTag(productCache.tag(id))` instead of writing the string itself. One module now defines both identities — the array the browser caches under and the string the server invalidates — so a rename changes both at once.

That module is imported from a Server Component and from a `'use client'` component, so it must stay free of server-only and client-only imports. Nothing but pure key and tag construction goes in it.

## Client Components are prerendered too

With `cacheComponents` enabled, Next.js prerenders Client Components as well as Server Components. That is what brings TanStack Query into contact with the current-time restriction: creating active query state involves reading the clock, and a prerender has no legitimate value to give it.

Keeping a query that the initial render needs behind a `Suspense` boundary lets Next.js defer that work to request time instead of attempting it during the prerender, which is what avoids the `blocking-prerender-current-time-client` error.

## Why `dehydrate()` itself fails

The same restriction catches the server side of the handoff. TanStack's `dehydrate()` records a `dehydratedAt` timestamp and a per-query `updatedAt`, both from `Date.now()`. During a Cache Components prerender that produces a `blocking-prerender-current-time` error.

Think about why the restriction is right rather than inconvenient. A prerendered page may be served for as long as its cache profile allows. If a build-time `Date.now()` were baked into the dehydrated state, every visitor for that entire window would receive query metadata claiming the data was fetched at build time — and TanStack would compute staleness against a moment that has receded arbitrarily far into the past. Next.js refuses to guess which timestamp you meant.

## The prerenderable hydration helper

The remedy is to cache the timestamp under the *same tags as the data*, so the two advance together, and then to construct the dehydrated state manually rather than letting `dehydrate()` read the clock:

```tsx filename="app/lib/hydrate.ts"
import 'server-only'

import { cacheLife, cacheTag } from 'next/cache'
import {
  defaultShouldDehydrateQuery,
  QueryClient,
  type DehydratedState,
  type QueryKey,
} from '@tanstack/react-query'

type HydratedQuery = {
  queryKey: QueryKey
  data: unknown
}

type HydrationOptions = {
  tags: string[]
}

async function getHydrationUpdatedAt(tags: string[]) {
  'use cache'
  cacheTag(...tags)
  cacheLife('max')
  return Date.now()
}

export async function dehydrate(
  queries: HydratedQuery[],
  options: HydrationOptions
): Promise<DehydratedState> {
  const updatedAt = await getHydrationUpdatedAt(options.tags)

  const queryClient = new QueryClient()

  for (const query of queries) {
    queryClient.setQueryData(query.queryKey, query.data, { updatedAt })
  }

  return {
    mutations: [],
    queries: queryClient
      .getQueryCache()
      .getAll()
      .filter((query) => defaultShouldDehydrateQuery(query))
      .map((query) => ({
        dehydratedAt: updatedAt,
        queryHash: query.queryHash,
        queryKey: query.queryKey,
        state: query.state,
        ...(query.meta ? { meta: query.meta } : {}),
      })),
  }
}
```

The trick is `getHydrationUpdatedAt`. It is a cached function whose entire body is `Date.now()`, tagged with the same tags as the data reads and given a `cacheLife('max')` profile. Inside a cached scope the clock read is legal, because its result becomes part of a cache entry with a defined lifetime rather than a value frozen into a prerender. When a mutation invalidates those tags, the cached timestamp is discarded alongside the cached data, so the next render produces a new pair — and `<HydrationBoundary>` sees a `dehydratedAt` newer than whatever the browser holds, which is what makes it overwrite the client's copy.

Note also that this helper takes data that is **already resolved**, unlike the pending-query pattern from the previous page. The two approaches trade against each other: the pending-query dehydration streams and does not block, while this one awaits the cached read and gains a server cache with tag invalidation.

Calling it from the segment that owns the data:

```tsx filename="app/products/[id]/page.tsx"
import { HydrationBoundary } from '@tanstack/react-query'
import { dehydrate } from '@/app/lib/hydrate'
import { getProduct } from './data'
import { productCache } from './product-cache'
import { ProductView } from './product-view'

async function ProductData({ id }: { id: string }) {
  const product = await getProduct(id)
  const state = await dehydrate(
    [{ queryKey: productCache.key(id), data: product }],
    { tags: [productCache.tag(id)] }
  )

  return (
    <HydrationBoundary state={state}>
      <ProductView id={id} />
    </HydrationBoundary>
  )
}
```

The tags passed to `dehydrate` are the same tags the underlying `getProduct` read was given. That is the invariant the whole helper rests on: the timestamp must advance whenever the hydrated data changes. It suits tag-driven server data precisely because both sides key on the same tags. For time-driven server data the guide's advice is to derive the data and the hydration timestamp from one cached snapshot rather than maintaining two unrelated time windows that will drift.

## Gotchas

**★ Calling TanStack's `dehydrate()` directly with Cache Components enabled.**
It reads `Date.now()` for `dehydratedAt` and for each query's `updatedAt`, and a prerender has no current time to give it, so Next.js raises a `blocking-prerender-current-time` error. The remedy is the hand-built helper: cache the timestamp under the same tags as the data with `'use cache'`, then assemble the `DehydratedState` yourself.

**★ Caching the hydration timestamp under different tags from the data.**
The helper is correct only because the timestamp and the data are invalidated by the same event. Tag the timestamp with something else — a generic `hydration` tag, or nothing — and it will keep its old value after a mutation, so `<HydrationBoundary>` will not consider the incoming state newer and will leave the browser's stale copy in place.

**★ Using the helper for time-driven rather than tag-driven data.**
If the server read refreshes on a `revalidate` schedule rather than on a tag, a separately-cached timestamp advances on its own schedule and the two drift. Derive the data and its timestamp from the same cached snapshot instead, so there is one moment of truth rather than two unrelated windows.

**★ Rendering a Client Component query needed by the initial view outside a Suspense boundary.**
With `cacheComponents` on, Client Components are prerendered too, and creating active query state reads the current time — producing a `blocking-prerender-current-time-client` error. A boundary lets Next.js defer that work to request time instead of attempting it during the prerender.

**★ Setting `cacheLife('max')` on a read with no `cacheTag` and no mutation path.**
`max` means the server cache is expected to be refreshed by invalidation rather than by time. Without a tag and an `updateTag` call, the entry has no mechanism to ever change. Lifetime and invalidation are one decision, not two independent knobs.

**★ Trying to keep TanStack's `staleTime` in step with `cacheLife`.**
They govern different caches — TanStack's browser cache versus the Next.js server and client caches — and the guide states plainly that they need not match. What must be coordinated across layers is identity and invalidation, not duration. Coupling the numbers creates a maintenance burden with no correctness benefit.

**★ Putting a `server-only` import in the shared contract module.**
It is imported by the cached server function and by the `'use client'` component that reads the query. Keep it to pure key and tag construction — anything environment-specific breaks one of the two call sites at build time.

**★ Reusing one `QueryClient` across requests instead of creating it per request.**
The helper builds a throwaway client precisely so the dehydrated state is assembled in isolation. A `QueryClient` created once at module scope on the server is shared by every request the process handles, so one visitor's query data can be serialized into another visitor's page. The symptom is intermittent and user-specific, which makes it very hard to reproduce; the rule is that any server-side `QueryClient` is created inside the request, never hoisted to module scope.

## Interview questions

**★ Why does `dehydrate()` fail under Cache Components, and what does the failure protect you from?**
It stamps the dehydrated state with `Date.now()` — a `dehydratedAt` for the state and an `updatedAt` per query. A prerendered page can be served for the whole length of its cache profile, so a build-time timestamp would tell every visitor in that window that the data was fetched at build time, and TanStack would compute staleness against a moment receding ever further into the past. Next.js raises `blocking-prerender-current-time` rather than baking in a value that is wrong for all but the first request.

**★ Explain the prerenderable hydration helper in one paragraph.**
It replaces `dehydrate()` with a hand-built `DehydratedState`. The only clock read lives in a small cached function, `getHydrationUpdatedAt`, wrapped in `'use cache'` with `cacheLife('max')` and tagged with the same tags as the data reads. That makes the timestamp a cache entry with a defined lifetime rather than a prerender constant. The helper then creates a throwaway `QueryClient`, calls `setQueryData` with that `updatedAt` for each query, filters through `defaultShouldDehydrateQuery`, and maps the results into entries carrying `dehydratedAt`, `queryHash`, `queryKey`, `state` and optional `meta`.

**★ Why must the timestamp share the data's tags?**
Because `<HydrationBoundary>` only overwrites the browser's query when the incoming state is newer. Sharing tags means one mutation invalidates the data and the timestamp together, so the next render produces both a new value and a newer `dehydratedAt`. Tag them differently and the timestamp survives the mutation, the boundary judges the incoming state no newer than what the browser already has, and the stale client value stays on screen.

**★ When is this helper the wrong tool?**
When the server data refreshes on time rather than on tags. A separately cached timestamp then advances on its own schedule, unrelated to when the data actually changed, and the two drift apart in both directions. For time-driven data, derive the data and the timestamp from the same cached snapshot so there is a single moment of truth.

**★ What changes for Client Components once `cacheComponents` is enabled?**
They are prerendered as well. That matters for TanStack Query because creating active query state reads the current time, which is exactly what a prerender cannot supply — producing `blocking-prerender-current-time-client`. Placing a query the initial view depends on behind a `Suspense` boundary lets Next.js defer that work to request time.

**★ Why does the shared contract module carry a `tag` builder as well as a `key` builder?**
So that the two identities cannot drift. The cached read calls `cacheTag(productCache.tag(id))`, the Client Component calls `useSuspenseQuery(productCache.options(id))`, and the Server Action calls `updateTag(productCache.tag(id))` — all from one module. Hand-writing the tag string in the read and again in the action is how invalidation silently stops working after a rename.

**★ Why does the helper build a throwaway `QueryClient` rather than reuse one?**
Because a `QueryClient` held at module scope on the server outlives the request that created it and is shared by every subsequent request in that process. Query data written for one visitor would then be visible to the assembly of another visitor's dehydrated state. Creating it inside the helper scopes it to the single render that needs it, which is the same per-request-instantiation rule that governs any server-side store.

---

← [TanStack Query: the server handoff](18-tanstack-query-the-server-handoff.md) · [Chapter 4 overview](01-explanation.md) · Next → [Mutations with Cache Components](19b-tanstack-query-mutations-with-cache-components.md)
