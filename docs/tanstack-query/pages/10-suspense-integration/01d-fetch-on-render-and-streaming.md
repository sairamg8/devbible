---
title: "Fetch-on-Render vs Render-as-You-Fetch: Why a Suspense Page Is Only Fast If Something Started the Request Before Render"
sidebar_label: "01d · Fetch timing and streaming"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08 against the TanStack Query docs — [Suspense](https://tanstack.com/query/latest/docs/framework/react/guides/suspense), [Prefetching](https://tanstack.com/query/latest/docs/framework/react/guides/prefetching), [Advanced Server Rendering](https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr), [`QueryClient`](https://tanstack.com/query/latest/docs/reference/QueryClient). Documentation-validated, **no sandbox run, no timings**. Target: **@tanstack/react-query 5.102.8**.
> Validated: 2026-09-08 · claims + output provenance · session d0684ffb

# 🔄 Fetch-on-Render, Render-as-You-Fetch, and Streaming

**Suspense decides *where the loading UI lives*. It does not decide *when the request starts* — and
that is what determines whether the page feels fast.** The guide names the two strategies under the
heading *"Fetch-on-render vs Render-as-you-fetch"*, and the distinction is the difference between a
suspense page that is a genuine improvement and one that just moved the spinner up a level.

## 1. Fetch-on-render: what you get for free

The component renders, the hook runs, the request starts, the component suspends. Every
`useSuspenseQuery` does this without configuration, and it is where the waterfall from
[01b](./01b-what-suspense-mode-removes.md) comes from — the request cannot start until the
component that needs it is being rendered, and that component cannot be rendered until its parent's
data has arrived.

For a page whose data depends on a route parameter and nothing else, this is often fine. For a
nested tree it means the network is idle during exactly the periods when it should be busy.

## 2. Render-as-you-fetch: start the request earlier

The guide describes this as *"Prefetching on routing callbacks and/or user interactions events to
start loading queries before they are mounted."* Nothing about the component changes — it still
calls `useSuspenseQuery`, and it still suspends if the data is not there. The difference is that by
the time it renders, the data usually *is* there, so it never suspends and the boundary never shows
a fallback.

Prefetching in v5 uses `queryClient.query()` — 🔴 **not `prefetchQuery`, which is deprecated**:

> *"These tips replace the use of the now deprecated `prefetchQuery` and `ensureQueryData` methods."*
> *"Prefetching a query uses the `query` method."*

```ts
// routes/product.ts — a route loader, running before the route's components mount.
export async function loader({ params }: { params: { id: string } }) {
  // queryClient.query "will either resolve with the data or throw with an error" — a warm-up
  // that rejects must not take the navigation down with it.
  await queryClient
    .query({ queryKey: ['product', params.id], queryFn: () => fetchProduct(params.id) })
    .catch(() => {});
  return null;
}
```

```tsx
// Warm on intent — the user has not clicked yet, so a failure here is free to ignore.
<Link
  to={`/products/${id}`}
  onMouseEnter={() =>
    queryClient
      .query({ queryKey: ['product', id], queryFn: () => fetchProduct(id) })
      .catch(() => {})
  }
>
```

🔴 **The `.catch` is not optional.** `queryClient.query` *"will either resolve with the data or
throw with an error"* — unlike the `prefetchQuery` it replaced, which swallowed failures. An
un-`catch`ed warm-up for a page the user never visits becomes an unhandled promise rejection, and
in a route loader it can fail the navigation itself. This is the same trap
[topic 09](../09-prefetching-and-ssr/01-server-rendered-data-flow.md) documents from the SSR side.

**Prefetching is also the third answer to the suspense waterfall.** A query already in cache does
not suspend; if every key on a route is warm before render, the serialisation in
[01b](./01b-what-suspense-mode-removes.md) never happens, because nothing suspends at all.

## 3. Streaming on the server — the experimental Next.js integration

For server-rendered React the guide points at a separate package, and is explicit about its status:

> *"If you are using NextJs, you can use our **experimental** integration for Suspense on the
> Server: `@tanstack/react-query-next-experimental`."*

Wrapping the app in `ReactQueryStreamedHydration` means *"Results will then be streamed from the
server to the client as SuspenseBoundaries resolve."* The provider it documents is worth reading
closely, because two of its comments are load-bearing warnings rather than notes:

```tsx
// app/providers.tsx
'use client'

import {
  environmentManager,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query'
import * as React from 'react'
import { ReactQueryStreamedHydration } from '@tanstack/react-query-next-experimental'

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // With SSR, we usually want to set some default staleTime
        // above 0 to avoid refetching immediately on the client
        staleTime: 60 * 1000,
      },
    },
  })
}

let browserQueryClient: QueryClient | undefined = undefined

function getQueryClient() {
  if (environmentManager.isServer()) {
    // Server: always make a new query client
    return makeQueryClient()
  } else {
    // Browser: make a new query client if we don't already have one
    // This is very important, so we don't re-make a new client if React
    // suspends during the initial render. This may not be needed if we
    // have a suspense boundary BELOW the creation of the query client
    if (!browserQueryClient) browserQueryClient = makeQueryClient()
    return browserQueryClient
  }
}

export function Providers(props: { children: React.ReactNode }) {
  // NOTE: Avoid useState when initializing the query client if you don't
  //       have a suspense boundary between this and the code that may
  //       suspend because React will throw away the client on the initial
  //       render if it suspends and there is no boundary
  const queryClient = getQueryClient()

  return (
    <QueryClientProvider client={queryClient}>
      <ReactQueryStreamedHydration>
        {props.children}
      </ReactQueryStreamedHydration>
    </QueryClientProvider>
  )
}
```

Three things to take from it. **The server always makes a fresh client** — *"Server: always make a
new query client"* — because a module-scoped one on the server is shared between users' requests.
**The browser client is memoised in a module variable rather than `useState`**, and the comment
says why: React discards state from a render that suspends with no boundary above it, so a
`useState`-held client can be re-created mid-render. And **`staleTime` above zero** is the same
advice topic 09 gives: with a zero `staleTime` every server-rendered query refetches the instant it
hydrates, which throws the server work away.

⚠️ **`environmentManager.isServer()` is the current form in this snippet**, where older material
writes `typeof window === 'undefined'`. Treat the docs' spelling as authoritative for the pinned
version rather than substituting the older idiom from memory.

---

## Gotchas

**★ 🔴 Symptom: you migrated to suspense and the page is not faster — the spinner is just bigger.**
Cause: fetch-on-render is unchanged by the migration. Suspense relocated the loading UI; it did not
move the request earlier, and if anything it serialised requests that used to overlap. Fix:
prefetch on the route or on intent, which is the *render-as-you-fetch* half the docs name. The
suspense hooks are the rendering half of a two-part pattern and are frequently adopted without the
other half.

**★ 🔴 Symptom: a prefetch on hover produces "Uncaught (in promise)" errors in the console for
links the user never clicked.** Cause: `queryClient.query` *"will either resolve with the data or
throw with an error"*, unlike the `prefetchQuery` it replaced. Fix: `.catch(() => {})` on every
speculative warm-up. In a route loader the consequence is worse than a console message — an
un-caught rejection there can fail the navigation.

**★ Symptom: you reached for `prefetchQuery` because that is the API you remember.** Cause: it is
deprecated — *"These tips replace the use of the now deprecated `prefetchQuery` and
`ensureQueryData` methods"* — and no longer appears in the `QueryClient` reference at all. Fix:
`queryClient.query()`, with the `.catch` above, because the deprecation changed the error contract
as well as the name.

**★ 🔴 Symptom: server-rendered data refetches the moment the page hydrates, wasting the SSR
work.** Cause: the default `staleTime` is 0, so the query is stale on arrival and a mounting
instance refetches immediately. Fix: the `staleTime: 60 * 1000` in the provider above — the docs'
own comment is *"With SSR, we usually want to set some default staleTime above 0 to avoid
refetching immediately on the client"*.

**★ 🔴 Symptom: users intermittently see another user's data in server-rendered pages.** Cause: a
module-scoped `QueryClient` on the server, shared across requests. Fix: *"Server: always make a new
query client"* — the environment check in `getQueryClient` exists for exactly this, and it is a
security bug, not a caching bug.

**★ Symptom: the `QueryClient` is re-created mid-render in the browser and the cache appears
empty.** Cause: the client was held in `useState` in a component that suspends with no boundary
above it — React throws away that render's state. Fix: the module-variable memoisation shown above,
which is why the docs' provider looks unidiomatic. Their note states the condition precisely: it
*"may not be needed if we have a suspense boundary BELOW the creation of the query client"*.

**★ Symptom: prefetching everything on a route made the page slower.** Cause: warming six keys in a
loader means the navigation waits on six requests before the route renders, converting a fast paint
with skeletons into a slow blank. Fix: prefetch the *critical* keys and let the rest fetch on
render inside their own boundaries — prefetching is a targeting decision, not a switch to turn on.

**★ Symptom: the streaming integration behaves differently between Next.js versions.** Cause: it is
shipped as `@tanstack/react-query-next-experimental` and documented as **experimental**. Fix: pin
it deliberately and treat behaviour changes as expected rather than as bugs; for a page that must
be stable, the non-streaming `HydrationBoundary` route in
[topic 09](../09-prefetching-and-ssr/01-server-rendered-data-flow.md) is the conservative choice.

---

## Interview questions

**★ What is the difference between fetch-on-render and render-as-you-fetch, and which does
`useSuspenseQuery` give you?**
Fetch-on-render starts the request when the component renders; render-as-you-fetch starts it before,
via a route loader or an interaction handler. `useSuspenseQuery` gives you fetch-on-render out of
the box — the docs say it *"works out-of-the-box"* — and render-as-you-fetch requires you to add
prefetching. The hook is unchanged either way; what changes is whether the cache is already warm
when it runs, and therefore whether it suspends at all.

**★ Why does prefetching fix the suspense waterfall?**
Because a query whose data is already in cache returns synchronously and never suspends. The
waterfall exists only because the first hook suspends before the later hooks are called; if none of
them suspend, none of them block the others. It is a different fix from `useSuspenseQueries` —
that one makes the suspension happen once for many queries, this one removes the suspension — and
they compose.

**★ Why must a prefetch with `queryClient.query()` be caught, when `prefetchQuery` did not need to
be?**
The error contract changed with the API. `queryClient.query` *"will either resolve with the data or
throw with an error"*, where `prefetchQuery` resolved regardless. A mechanical rename therefore
converts a speculative, harmless warm-up into a rejecting promise — in a hover handler that is an
unhandled rejection, and in a route loader it can take the navigation down. This is the most
frequently missed half of the v5 prefetching migration.

**★ Why does the documented Next.js provider avoid `useState` for the `QueryClient`?**
Because React discards the state of a render that suspends when there is no suspense boundary above
the suspending code — so a `useState`-held client can be thrown away and re-created on the initial
render, losing the cache the server just hydrated. The module-variable memoisation survives that.
The docs' own note adds the condition under which the concern disappears: a suspense boundary below
the client's creation.

**★ What breaks if you server-render with the default `staleTime` of 0?**
Every hydrated query is stale on arrival, and a mounting instance refetches stale data by default —
so the client immediately re-requests everything the server just rendered. The user sees correct
content, the server work is wasted, and the origin takes double the traffic. The fix is a non-zero
default `staleTime`, which both the streaming provider and the advanced-SSR guide recommend for
exactly this reason.

---

← [Errors and reset](./01c-errors-boundaries-and-reset.md) · [Topic index](../README.md) · Next → [DevTools](../11-devtools/01-react-query-devtools.md)
