---
sidebar_position: 18
title: "The TanStack server handoff dehydrates a query that has not resolved yet — an unawaited prefetch, a shouldDehydrateQuery override, and a queryFn that is different on the server"
sidebar_label: "TanStack Query: the server handoff"
description: "Providing initial data from a Server Component with an unawaited prefetchQuery, dehydrating pending queries into a HydrationBoundary, overriding queryFn on the server, and the shared query-options contract with staleTime."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-03 against [How to fetch client-side data with TanStack Query](https://nextjs.org/docs/app/guides/client-side-data-fetching/tanstack-query) (docs `lastUpdated` 2026-08-25) and TanStack Query's [Advanced SSR guide](https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr).
> Target: **Next.js 16.3.4**. Requires **TanStack Query 5.40.0 or later** to dehydrate pending queries. Prior page: [17 · TanStack Query: provider and client fetching](17-tanstack-query-in-the-app-router-provider-and-hydration.md).

**The interesting half of TanStack Query in the App Router is that the server hands over a query that has not finished. `prefetchQuery` is started and deliberately not awaited, so rendering is not blocked; `dehydrate` is then told to serialize *pending* queries as well as settled ones; and React streams the resolution through the RSC payload to a `<HydrationBoundary>` in the browser. Three lines make that work and each is silently wrong by default — the default `dehydrate` drops pending queries entirely, and the shared `queryFn` fetches a relative URL that has no meaning on the server.**

## The server handoff: dehydrate a *pending* query

> *"TanStack Query 5.40.0 or later can dehydrate pending queries. Start `prefetchQuery` without awaiting it, then pass the dehydrated state to `<HydrationBoundary>`. Override `queryFn` on the server because the Route Handler's relative URL only resolves in the browser"*

```tsx filename="app/products/[id]/page.tsx"
import { Suspense } from 'react'
import {
  defaultShouldDehydrateQuery,
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query'
import { getProduct } from './data'
import { productCache } from './product-cache'
import { ProductView } from './product-view'

export default function Page({ params }: PageProps<'/products/[id]'>) {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      {params.then(({ id }) => (
        <ProductData id={id} />
      ))}
    </Suspense>
  )
}

function ProductData({ id }: { id: string }) {
  const queryClient = new QueryClient()

  // Not awaited, so rendering is not blocked.
  void queryClient.prefetchQuery({
    ...productCache.options(id),
    queryFn: () => getProduct(id),
  })

  return (
    <HydrationBoundary
      state={dehydrate(queryClient, {
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) ||
          query.state.status === 'pending',
      })}
    >
      <ProductView id={id} />
    </HydrationBoundary>
  )
}
```

Three details, each of which is a bug if you omit it.

**`void queryClient.prefetchQuery(...)`** starts the query without awaiting. The comment says why: *"Not awaited, so rendering is not blocked."* The `void` is there so a linter does not flag the floating promise.

**The `shouldDehydrateQuery` override.** By default `dehydrate` only serializes *settled* queries, so an unawaited prefetch would be dropped entirely and the browser would fetch from scratch. Adding `|| query.state.status === 'pending'` is what carries the in-flight query across.

**`queryFn` is overridden on the server.** The shared query options define `queryFn` as a `fetch` of a relative URL, which only resolves in a browser. On the server it is replaced with a direct call to `getProduct(id)` — the same function the Route Handler calls. That is also, incidentally, how this pattern avoids the "Server Component fetching its own Route Handler" mistake.

## The shared query contract

```ts filename="app/products/[id]/product-cache.ts"
import { queryOptions } from '@tanstack/react-query'

export type Product = { id: string; name: string }

export const productCache = {
  key: (id: string) => ['product', id] as const,
  options: (id: string) =>
    queryOptions({
      queryKey: productCache.key(id),
      queryFn: async (): Promise<Product> => {
        const res = await fetch(`/api/products/${id}`)
        if (!res.ok) throw new Error('Failed to fetch product')
        return res.json()
      },
      staleTime: 30_000,
    }),
}
```

> *"The server and Client Component must use the same query key. Keep the key and query options together so both call sites share the same identity."*

> *"The query function fetches a Route Handler so it can run on the client. The `staleTime` prevents an immediate client refetch by keeping the hydrated data fresh for 30 seconds. Choose a duration based on how quickly the data can change."*

Without `staleTime`, TanStack Query treats hydrated data as stale and refetches on mount — the same default SWR has, and the same wasted round trip. Unlike SWR, TanStack expresses the fix as a duration rather than a switch.

> *"Larger features can place query options in a separate client-facing module as long as every caller imports the key from the same cache contract."*

```tsx filename="app/products/[id]/product-view.tsx"
'use client'

import { useSuspenseQuery } from '@tanstack/react-query'
import { productCache } from './product-cache'

export function ProductView({ id }: { id: string }) {
  const { data } = useSuspenseQuery(productCache.options(id))

  return <h1>{data.name}</h1>
}
```

> *"As with SWR, `params.then()` resolves the `id` inside `<Suspense>`, and `ProductData` prefetches below the boundary."*
## Gotchas

**★ Awaiting `prefetchQuery` on the server.**
It blocks the Server Component until the data resolves, which removes the streaming behaviour the surrounding Suspense boundary was there to provide. The documented call is `void queryClient.prefetchQuery(...)` with the comment *"Not awaited, so rendering is not blocked."*

**★ Calling `dehydrate` without the `shouldDehydrateQuery` override.**
The default only serializes settled queries, so an unawaited prefetch is silently dropped from the dehydrated state and the browser refetches from scratch. The page works; the handoff simply never happened. The override is `defaultShouldDehydrateQuery(query) || query.state.status === 'pending'`, and it requires TanStack Query 5.40.0 or later.

**★ Leaving the browser `queryFn` in place on the server.**
The shared options fetch a relative URL, which has no meaning on the server. Override `queryFn` with a direct call to the same function the Route Handler uses — which also avoids the separate mistake of a Server Component fetching its own endpoint over HTTP.

**★ Omitting `staleTime` on hydrated data.**
TanStack Query considers data stale by default, so the browser refetches immediately on mount and the server's work is discarded. The documented options set `staleTime: 30_000`; choose the number from how fast the data actually changes, not by copying it.

**★ Building the query key in the page and again in the Client Component.**
The dehydrated state is matched to a query by key, so two hand-written keys that differ in any element — an extra segment, a number where a string was used, a different order — mean the hydration boundary carries data no hook ever reads. Export one `key` builder and one `options` builder and import both at every call site.

**★ Putting a server-only import in the shared query-options module.**
It is imported by the Server Component that prefetches *and* by the `'use client'` component that reads. The guide allows splitting options into a separate client-facing module *"as long as every caller imports the key from the same cache contract"* — but whatever holds the key must be importable from both sides, which means no `server-only`, no database client, and no client-only APIs.

## Interview questions

**★ What does "dehydrate a pending query" mean, and why is the default not enough?**
`dehydrate` normally serializes only settled queries. The App Router pattern deliberately starts `prefetchQuery` without awaiting it so rendering is not blocked, which leaves the query in a `pending` state at dehydration time — and therefore dropped. Overriding `shouldDehydrateQuery` with `defaultShouldDehydrateQuery(query) || query.state.status === 'pending'` carries the in-flight query into the RSC payload, where React resolves it. It requires TanStack Query 5.40.0 or later.

**★ Why is `queryFn` overridden on the server?**
Because the shared query options define it as a `fetch` of a relative Route Handler URL, and a relative URL only resolves in a browser. On the server the prefetch calls `getProduct(id)` directly — the same function the Route Handler itself calls — which both makes the prefetch work and avoids a Server Component issuing an HTTP request to its own application.

**★ What is `staleTime` doing in the shared query options?**
Preventing an immediate refetch after hydration. Without it, TanStack Query treats the hydrated value as stale and fetches again on mount, discarding the work the server just did. `staleTime: 30_000` keeps it fresh for thirty seconds; the right number comes from how quickly the data can change.

**★ Why does the documented page use `params.then(...)` rather than `await params`?**
So the page component itself does not become async and block. The returned promise keeps the Suspense fallback visible until the route parameters resolve, and `ProductData` — which does the prefetching — renders below that boundary. It is the same technique the SWR guide uses, for the same reason.

**★ Why does the shared contract keep the key and the options together?**
Because the key is the join between the server-side dehydrated state and the browser-side hook, and a hand-written duplicate is the one thing that silently breaks the handoff. Colocating `key` and `options` means both call sites derive the identity from the same function. For larger features the guide permits a separate client-facing options module *"as long as every caller imports the key from the same cache contract."*

**★ The hydrated data appears and is then immediately replaced by a client fetch. What did you forget?**
`staleTime`. TanStack Query treats data as stale by default, so a hook mounting with hydrated data refetches at once, throwing away the server's work and producing a visible flash if the values differ. Setting `staleTime` on the shared options — 30 seconds in the documented example — defines a window in which the hydrated value is accepted as fresh.

{/* FOOTER */}
