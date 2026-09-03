---
sidebar_position: 19
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

## Mutations

The browser half uses `useMutation` with an `onMutate` callback that writes the optimistic value and returns the previous one, and an `onError` callback that puts it back:

```tsx filename="app/activity/mark-read-button.tsx"
'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { markActivityReadAction } from './actions'
import { activityCache } from './activity-cache'

export function MarkReadButton() {
  const queryClient = useQueryClient()
  const queryKey = activityCache.key

  const markRead = useMutation({
    mutationFn: markActivityReadAction,
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData(queryKey)
      queryClient.setQueryData(queryKey, { count: 0 })
      return { previous }
    },
    onError: (_error, _variables, context) => {
      queryClient.setQueryData(queryKey, context?.previous)
    },
  })

  return <button onClick={() => markRead.mutate()}>Mark read</button>
}
```

`cancelQueries` comes first and is not optional decoration. An in-flight fetch for the same key that resolves after `setQueryData` would overwrite the optimistic value with pre-mutation data, producing a UI that flickers back to the old state for no visible reason. Cancelling first closes that race.

`getQueryData` before `setQueryData` captures the rollback value, and returning it as the mutation context is how `onError` gets hold of it — TanStack passes whatever `onMutate` returns as the third argument to `onError`.

There is no `onSettled` refetch here because the final value is known: the action sets the count to zero, and zero is what the optimistic write already put in the cache. When the server may return something you cannot predict — a generated id, a server-computed total, a normalised field — you need a refetch or an invalidation, or the browser will assert its guess indefinitely.

The contract module carries both identities, exactly as in the read path:

```ts filename="app/activity/activity-cache.ts"
export const activityCache = {
  key: ['activity', 'unread'] as const,
  tag: (userId: string) => `activity:${userId}`,
}
```

And the Server Action writes to the database and expires the tagged server read:

```ts filename="app/activity/actions.ts"
'use server'

import { updateTag } from 'next/cache'
import {
  getCurrentUserId,
  markActivityRead as markActivityReadInDatabase,
} from './data'
import { activityCache } from './activity-cache'

export async function markActivityReadAction() {
  const userId = await getCurrentUserId()
  await markActivityReadInDatabase(userId)
  updateTag(activityCache.tag(userId))
}
```

The user id comes from `getCurrentUserId()` inside the action, not from an argument. A Server Action is a public HTTP endpoint, so an id supplied by the caller would let anyone write to — and invalidate the cache of — another account.

`updateTag` is the right call here rather than `revalidateTag(tag, 'max')` because the person who clicked must not see their own change missing. `updateTag` makes the next server read wait for fresh data; `revalidateTag` with `'max'` would serve the stale value while refreshing in the background, which is correct for passive updates and wrong for the writer.

Two caches are now updated by one interaction: the browser's, optimistically and immediately, and the server's, by tag expiry so the next render reads fresh. Skipping either leaves a visible inconsistency — a stale badge after a hard reload if you skip the tag, or a button that appears to do nothing until the next navigation if you skip the optimistic write.

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

**★ Omitting `cancelQueries` from `onMutate`.**
An in-flight fetch for the same key can resolve after your optimistic `setQueryData` and overwrite it with pre-mutation data. The user sees the new value appear and then revert with no error and no obvious cause. `await queryClient.cancelQueries({ queryKey })` before reading and writing the cache closes the race.

**★ Capturing the rollback value after writing the optimistic one.**
`getQueryData` must run before `setQueryData`, or the "previous" value you return as context is the optimistic value you just wrote, and `onError` restores the failed write instead of undoing it. The order in `onMutate` is: cancel, read, write, return.

**★ Skipping the follow-up when the server's final value is not predictable.**
The documented button omits any refetch because the action's outcome is exactly the optimistic value. When the server may return a generated id, a computed total or a normalised field, the browser cache will hold your guess forever unless you invalidate or refetch after settling.

**★ Passing the user id into the Server Action from the client.**
Server Actions are public HTTP endpoints and every argument is attacker-controlled. Resolving the id server-side with `getCurrentUserId()` and building the tag from that is what stops a caller writing to another account or expiring another user's cached reads.

**★ Choosing `revalidateTag(tag, 'max')` for the writer's own mutation.**
It serves stale data while revalidating, so the person who just clicked sees their change missing on the next render. Use `updateTag` when the write must be visible immediately, and reserve `revalidateTag` with `'max'` for passive updates where an instant stale response beats a slower fresh one.

**★ Putting a `server-only` import in the shared contract module.**
It is imported by the cached server function and by the `'use client'` component that reads the query. Keep it to pure key and tag construction — anything environment-specific breaks one of the two call sites at build time.

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

**★ Walk through `onMutate` and explain the order of its four steps.**
Cancel, read, write, return. `await queryClient.cancelQueries({ queryKey })` stops an in-flight fetch that could land after the optimistic write and revert it. `queryClient.getQueryData(queryKey)` captures the pre-mutation value *before* it is overwritten. `queryClient.setQueryData(queryKey, ...)` applies the optimistic value so the UI responds immediately. Returning `{ previous }` hands that captured value to `onError` as its third argument, which is how the rollback gets its data.

**★ The documented mutation has no refetch after success. Why, and when would that be a bug?**
Because the final value is known in advance: the action marks activity read, so the count is zero, which is precisely what the optimistic write already stored. It becomes a bug the moment the server can return something unpredictable — a generated identifier, a server-computed total, a normalised or trimmed field — because then the browser cache holds a guess with nothing scheduled to correct it.

**★ Why `updateTag` rather than `revalidateTag(tag, 'max')` after a user-initiated write?**
Because the person who clicked must not see their own change missing. `updateTag` makes the next server read wait for fresh data. `revalidateTag` with `'max'` serves the stale entry while refreshing in the background, which is the right trade for passive updates driven by someone else's activity and the wrong one for the writer's own screen.

**★ Two caches now hold the same fact. What must be true of them, and what need not be?**
Their identities and their invalidation must be coordinated: the query key the browser stores under and the tag the server invalidates have to be derivable from one shared contract module, and a mutation has to address both. Their durations need not agree at all — TanStack's `staleTime`, the `cacheLife` `stale` window for the Next.js client cache, and `revalidate`/`expire` for the server cache are three independent policies chosen from three different behaviours.

**★ Why does the shared contract module carry a `tag` builder as well as a `key` builder?**
So that the two identities cannot drift. The cached read calls `cacheTag(productCache.tag(id))`, the Client Component calls `useSuspenseQuery(productCache.options(id))`, and the Server Action calls `updateTag(productCache.tag(id))` — all from one module. Hand-writing the tag string in the read and again in the action is how invalidation silently stops working after a rename.

{/* FOOTER */}
