---
sidebar_position: 17
title: "TanStack Query in the App Router needs one query client per server render and exactly one in the browser — get that branch wrong in either direction and you have a data leak or a useless cache"
sidebar_label: "TanStack Query: provider and client fetching"
description: "The per-render server query client and the singleton browser client, why the provider belongs in the nearest shared layout, and useQuery versus useSuspenseQuery including enabled, isFetching and array query keys."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-03 against [How to fetch client-side data with TanStack Query](https://nextjs.org/docs/app/guides/client-side-data-fetching/tanstack-query) (docs `lastUpdated` 2026-08-25), [Client-side data fetching](https://nextjs.org/docs/app/guides/client-side-data-fetching), and TanStack Query's [Advanced SSR guide](https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr).
> Target: **Next.js 16.3.4**. Prior page: [14 · Client-side data fetching: choosing](14-client-side-data-fetching-and-when-it-is-still-correct.md).

**TanStack Query's App Router setup turns on a decision that looks like boilerplate and is not: the query client's lifetime. A fresh `QueryClient` per server render, so one user's data can never be read by another; a single reused client in the browser, so navigation preserves the cache. Getting it wrong in one direction is a cross-user data leak; getting it wrong in the other leaves you with all of the library's overhead and none of its benefit. This page is the provider and the two client-fetching hooks; the server handoff is the next one.**

## The provider

```tsx filename="app/products/providers.tsx"
'use client'

import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

let browserQueryClient: QueryClient | undefined

function getQueryClient() {
  // Keep server requests isolated and preserve the browser cache across renders.
  if (typeof window === 'undefined') return new QueryClient()
  browserQueryClient ??= new QueryClient()
  return browserQueryClient
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={getQueryClient()}>
      {children}
    </QueryClientProvider>
  )
}
```

The rule has two halves: create a **new** query client for every server render, and reuse **one** query client in the browser. The comment carried in the documented code explains why each half exists — isolating server requests from one another, and preserving the browser cache across renders.

Both halves are load-bearing and they fail in opposite directions.

**A module-level singleton on the server** is shared across every concurrent request in that process. Two users rendering the same route at the same moment share a cache keyed only by query key — which is a cross-user data leak, not a performance issue.

**A new client per render in the browser** discards the cache on every re-render of the provider, so nothing is ever reused, every navigation refetches, and the library's entire value disappears while all of its overhead remains.

`browserQueryClient ??= new QueryClient()` creates it once per browser session. `typeof window === 'undefined'` is the branch, evaluated at render time rather than at import time, because the module is evaluated in both environments.

```tsx filename="app/products/layout.tsx"
import { Providers } from './providers'

export default function Layout({ children }: LayoutProps<'/products'>) {
  return <Providers>{children}</Providers>
}
```

The placement instruction is to render the provider from the *nearest shared layout* — the closest layout that all the consuming routes have in common.

Nearest, not root. A provider in the root layout gives every route in the application a query client whether or not it uses one.

## Client fetching with `useQuery`

Reach for `useQuery` when the component itself should render its own loading and error states rather than delegating them to a boundary. The `enabled` option is the deferral mechanism: it holds the request back until the interaction has actually provided an input to query with.

```tsx filename="app/product-autocomplete.tsx"
'use client'

import { useQuery } from '@tanstack/react-query'

type Product = { id: string; name: string }

async function searchProducts(query: string): Promise<Product[]> {
  const response = await fetch(
    `/api/products?query=${encodeURIComponent(query)}`
  )
  if (!response.ok) throw new Error('Failed to fetch products')
  return response.json()
}

export function ProductAutocomplete({ query }: { query: string }) {
  const {
    data = [],
    error,
    isPending,
  } = useQuery({
    queryKey: ['product-search', query],
    queryFn: () => searchProducts(query),
    enabled: query.length > 0,
  })

  if (!query) return null
  if (error) return <p>Failed to load products.</p>
  if (isPending) return <p>Loading products...</p>

  return (
    <ul>
      {data.map((product) => (
        <li key={product.id}>{product.name}</li>
      ))}
    </ul>
  )
}
```

`enabled` is TanStack's answer to SWR's `null` key: the query exists in the cache but does not run. Note that the query key is an **array** — `['product-search', query]` — so the query parameter is part of the identity rather than being interpolated into a string.

## Suspense with `useSuspenseQuery`

```tsx filename="app/product-autocomplete.tsx"
'use client'

import { useSuspenseQuery } from '@tanstack/react-query'
import { Suspense } from 'react'

export function ProductAutocomplete({ query }: { query: string }) {
  if (!query) return null

  return (
    <Suspense fallback={<p>Loading products...</p>}>
      <ProductResults query={query} />
    </Suspense>
  )
}

function ProductResults({ query }: { query: string }) {
  const { data } = useSuspenseQuery({
    queryKey: ['product-search', query],
    queryFn: () => searchProducts(query),
  })

  return (
    <ul>
      {data.map((product) => (
        <li key={product.id}>{product.name}</li>
      ))}
    </ul>
  )
}
```

Four things the docs establish about this shape. The interactive shell stays outside the Suspense boundary, so it remains available to the user while the results are loading. Errors are not returned from the hook: if the initial request fails, `useSuspenseQuery` propagates the error to the nearest error boundary. Once a query has data, subsequent refetches of the same query keep the cached data rendered instead of falling back to the Suspense fallback again — which means background-refresh feedback has to come from `isFetching`, because the fallback will not reappear to signal it.

And the one that governs structure rather than appearance: multiple `useSuspenseQuery` calls inside a single component run sequentially. Independent queries belong in sibling components, or in a single `useSuspenseQueries` call.

`useSuspenseQuery` has no `enabled` option in this pattern — the guard is the early `return null` before the boundary. There is no "suspended but disabled" state; a suspense query either runs or is not rendered.

## Gotchas

**★ A module-level `QueryClient` shared by every server render.**
On the server, one client per process is shared across concurrent requests, so two users rendering the same route can read each other's cached data — a cross-user leak, not a performance bug. The branch `if (typeof window === 'undefined') return new QueryClient()` exists precisely to prevent it, and it must be evaluated per render rather than at module load.

**★ A new `QueryClient` on every browser render.**
The mirror-image mistake. Recreating the client on each render of the provider throws away the cache continuously, so every navigation refetches everything and the library provides nothing but overhead. `browserQueryClient ??= new QueryClient()` creates it exactly once per session.

**★ Rendering the provider from the root layout.**
The guide says to render it from the nearest shared layout, not from the top of the tree. A root provider gives every route a query client and a client-component boundary it may not need, and makes an unrelated feature's provider configuration part of the application shell.

**★ Multiple `useSuspenseQuery` calls in one component.**
They run sequentially, producing a request waterfall. Move independent queries into sibling components, or use `useSuspenseQueries`. This is the same warning the SWR guide gives about its own Suspense mode, and it catches people equally often.

**★ Reading `isPending` under `useSuspenseQuery` for background feedback.**
Suspense handles the no-data state, and after the first success a refetch keeps the cached data rendered rather than re-showing the fallback. `isFetching` is the flag that reports background activity; `isPending` will not fire for it.

**★ Interpolating a query parameter into a string query key.**
TanStack keys are arrays: `['product-search', query]`. Flattening to `` `product-search-${query}` `` still works but loses partial matching — `queryClient.invalidateQueries({ queryKey: ['product-search'] })` can no longer invalidate every search at once because there is no prefix to match on.

**★ Marking the provider file `'use client'` and then importing server-only code into the layout below it.**
`Providers` is a Client Component, but the layout that renders it is still a Server Component and `{children}` passed through it are still server-rendered. Teams sometimes conclude that everything under a `QueryClientProvider` became client code and start pulling data access into the browser. Children passed as props keep their own environment; only the provider itself is client code.

**★ Configuring different `QueryClient` defaults on the server and in the browser.**
`getQueryClient` constructs a client in two branches, which makes it easy to give one of them options the other lacks. A `staleTime` or `retry` default present only in the browser produces hydration behaviour that cannot be reproduced from a server render, and vice versa. Build the options object once and pass it to both `new QueryClient(...)` calls.

## Interview questions

**★ Why must the query client be created per render on the server but once in the browser?**
On the server, a module-level client is shared by every concurrent request in the process, so cached values keyed only by query key are visible across users — a data-isolation failure. In the browser there is exactly one user, and recreating the client on each render throws away the cache that makes the library worth having. The documented `getQueryClient` implements both with a `typeof window` branch.

**★ How do `useQuery` and `useSuspenseQuery` differ in the loading and error flow?**
`useQuery` returns `isPending` and `error` for the component to render inline, and supports `enabled` to defer the request. `useSuspenseQuery` suspends instead, so the nearest Suspense boundary provides the loading UI and the nearest error boundary receives an initial failure. After the first success, a refetch under `useSuspenseQuery` keeps the cached data rendered and is reported through `isFetching` rather than re-showing the fallback.

**★ Why are TanStack query keys arrays rather than strings?**
Because the array is structured identity, and TanStack matches on prefixes. `['product', id]` can be invalidated individually or as a group via `['product']`. Flattening the same information into one interpolated string works for exact lookups and loses every partial-match operation — invalidating all searches, all products, or all of one user's queries at once.

**★ What is the equivalent of SWR's `null` key in TanStack Query, and where does it not apply?**
The `enabled` option: `enabled: query.length > 0` keeps the query registered but not running. It applies to `useQuery`. Under `useSuspenseQuery` there is no disabled state — the documented pattern guards with an early `return null` in the parent, before the Suspense boundary, so the suspending component is simply not rendered.

**★ Why does the provider go in the nearest shared layout rather than the root?**
Because a query client and a client-component boundary are costs, and a root provider imposes both on every route in the application whether or not it fetches on the client. Scoping to the segment that owns the feature keeps the provider's configuration next to the queries it serves, and lets two unrelated features hold different defaults.

**★ Rendering a `QueryClientProvider` in a layout makes its children Client Components. True or false?**
False. `Providers` itself is a Client Component, but `{children}` are passed in as an already-rendered prop from the Server Component layout above, so they keep their own environment. Only components imported *into* a `'use client'` module cross the boundary; children passed through it do not.

---

← [SWR with Cache Components and mutations](16-swr-with-cache-components-and-mutations.md) · [Chapter 4 overview](01-explanation.md) · Next → [TanStack Query: the server handoff](18-tanstack-query-the-server-handoff.md)
