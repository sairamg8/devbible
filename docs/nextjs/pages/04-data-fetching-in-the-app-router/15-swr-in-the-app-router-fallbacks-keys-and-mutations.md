---
sidebar_position: 15
title: "SWR in the App Router hinges on one string: the fallback key and the useSWR key must match exactly, or the server's data is silently ignored and the browser fetches anyway"
sidebar_label: "SWR: fetching and the server handoff"
description: "Fetching with useSWR inline and under Suspense, providing initial data from a Server Component through SWRConfig fallback with an unawaited promise, the shared key contract, and why SWR treats fallback data as stale."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-03 against [How to fetch client-side data with SWR](https://nextjs.org/docs/app/guides/client-side-data-fetching/swr) (docs `lastUpdated` 2026-08-25), [Client-side data fetching](https://nextjs.org/docs/app/guides/client-side-data-fetching), and the [SWR documentation](https://swr.vercel.app/docs/getting-started).
> Target: **Next.js 16.3.4**. Requires **SWR 2.3.0 and React 19** for the server-provided fallback pattern. Prior page: [14 · Client-side data fetching: choosing](14-client-side-data-fetching-and-when-it-is-still-correct.md).

**SWR's App Router story has one sharp edge. Fetching in the browser is unremarkable. Providing initial data from a Server Component is where it becomes interesting: since SWR 2.3.0 with React 19, a Server Component can put an *unawaited promise* into `<SWRConfig fallback>`, React serializes it into the RSC payload, and only the component reading that key suspends. The sharp edge is that the fallback key and the `useSWR` key are matched by exact string equality, and a mismatch is not an error — SWR quietly ignores the fallback and fetches from the browser, which reads as a performance problem rather than a bug.**

## Browser-only fetching

```tsx filename="app/product-autocomplete.tsx"
'use client'

import useSWR from 'swr'

type Product = { id: string; name: string }

async function fetcher(url: string): Promise<Product[]> {
  const response = await fetch(url)
  if (!response.ok) throw new Error('Failed to fetch products')
  return response.json()
}

export function ProductAutocomplete({ query }: { query: string }) {
  const {
    data = [],
    error,
    isLoading,
  } = useSWR(
    query ? `/api/products?query=${encodeURIComponent(query)}` : null,
    fetcher
  )

  if (!query) return null
  if (error) return <p>Failed to load products.</p>
  if (isLoading) return <p>Loading products...</p>

  return (
    <ul>
      {data.map((product) => (
        <li key={product.id}>{product.name}</li>
      ))}
    </ul>
  )
}
```

> *"A conditional key delays the request until the interaction provides an input."*

Passing `null` as the key is SWR's idiom for "not yet". It is not the same as passing an empty string, which is a valid key and will fire a request.

## Suspense mode, and the two loading booleans

```tsx filename="app/product-autocomplete.tsx"
'use client'

import { Suspense } from 'react'
import useSWR from 'swr'

export function ProductAutocomplete({ query }: { query: string }) {
  if (!query) return null

  return (
    <Suspense fallback={<p>Loading products...</p>}>
      <ProductResults query={query} />
    </Suspense>
  )
}

function ProductResults({ query }: { query: string }) {
  const { data } = useSWR(
    `/api/products?query=${encodeURIComponent(query)}`,
    fetcher,
    { suspense: true }
  )

  return (
    <ul>
      {data.map((product) => (
        <li key={product.id}>{product.name}</li>
      ))}
    </ul>
  )
}
```

> *"With an unconditional key, SWR defines `data` after Suspense resolves. Handle request errors with the nearest error boundary."*

> *"The `isLoading` value is `true` when a request is running and there is no loaded data to display. The `isValidating` value is `true` whenever a request is running, including background revalidation."*

> *"With `suspense: true`, Suspense handles the initial no-data state. Later revalidation for the same key keeps the current data rendered instead of showing the Suspense fallback again. Use `isValidating` to provide background refresh feedback."*

So the two booleans partition cleanly: `isLoading` is "nothing to show yet", `isValidating` is "a request is in flight". Under Suspense the first is handled for you and the second is the only one you still render.

> *"**Good to know:** Independent Suspense reads can start in parallel when they render in sibling components. Multiple Suspense reads in one component run sequentially."*

Note also the structure of the outer component: the interactive shell stays *outside* the boundary. *"Keep the interactive shell outside the boundary so it remains available while the results load."* Wrapping the input in the same boundary as the results would blank the input every time the query changes.

## Server-provided initial data

> *"Use the server-provided data pattern when the initial render needs the data and SWR should continue managing it in the browser. With SWR 2.3.0 and React 19, a Server Component can provide fallback data before the client takes over."*

```tsx filename="app/products/[id]/page.tsx"
import { Suspense } from 'react'
import { SWRConfig } from 'swr'
import { getProduct } from './data' // some server-side function
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
  return (
    <SWRConfig
      value={{
        fallback: {
          // Not awaited: only components that read this key suspend
          [productCache.key(id)]: getProduct(id),
        },
      }}
    >
      <ProductView id={id} />
    </SWRConfig>
  )
}
```

> *"Scope `<SWRConfig>` to the route segment that owns the data. The provider keeps the `fallback` close to its consumer and avoids adding feature data to a shared layout."*

> *"In the page example, the Promise returned by `params.then()` keeps the fallback visible until the route parameters resolve. `ProductData` then creates a separate, unawaited `getProduct(id)` Promise for the SWR `fallback`. React passes that Promise through the React Server Component payload, and the component reading the matching key suspends until the data resolves."*

Both promises are deliberate. `params.then(...)` renders the children only once params resolve, without the page component itself becoming async and blocking. `getProduct(id)` is left unawaited so that only the component reading that key waits on it.

### The key contract

```ts filename="app/products/[id]/product-cache.ts"
export const productCache = {
  key: (id: string) => `/api/products/${id}`,
}
```

```tsx filename="app/products/[id]/product-view.tsx"
'use client'

import useSWR from 'swr'
import { productCache } from './product-cache'

type Product = { id: string; name: string }

async function fetcher(url: string): Promise<Product> {
  const response = await fetch(url)
  if (!response.ok) throw new Error('Failed to fetch product')
  return response.json()
}

export function ProductView({ id }: { id: string }) {
  const { data } = useSWR(productCache.key(id), fetcher, { suspense: true })

  return <h1>{data.name}</h1>
}
```

> *"The fallback and Client Component must use the same SWR key. Define the key once so both call sites share the same identity."*

> *"**Good to know:** The `fallback` key and the `useSWR` key must match exactly. If they drift, SWR ignores the fallback value and fetches on the client."*

There is no warning, no error, no dev-mode notice. The page still works. It simply does a client round trip you thought you had eliminated, and the regression is invisible in every test that only asserts the rendered output.

### The key is also a URL

> *"The SWR key points to a Route Handler with a `GET` method. The Route Handler can call the same `getProduct` function that provides the fallback, while the browser uses the URL for revalidation and polling."*

That dual role is elegant and worth stating plainly: the same string is SWR's cache identity *and* the endpoint the browser hits to refresh it. The Route Handler and the server-side fallback call the same function, so there is one implementation of "get a product" with two entry points.

## Fallback data is stale by default

> *"The `fallback` provides the hook's initial value. By default, SWR treats fallback data as stale and starts a browser revalidation after hydration."*

> *"SWR does not provide a time-based freshness window for fallback data. Setting `revalidateIfStale: false` skips revalidation when the hook mounts with cached data. This setting applies to every mount, unlike TanStack Query's `staleTime`."*

This is the single largest behavioural difference from TanStack Query. TanStack's `staleTime` is a *duration*: fresh for 30 seconds, then refetch. SWR's `revalidateIfStale: false` is a *switch*: never revalidate on mount, ever. There is no middle setting.

> *"Focus, reconnect, polling, and `mutate` can still revalidate the key. To refresh on a schedule, set `refreshInterval`."*

So `revalidateIfStale: false` does not freeze the data — it only removes the on-mount revalidation. Focus and reconnect revalidation remain on unless you turn them off separately.
## Gotchas

**★ A fallback key that does not exactly match the `useSWR` key.**
SWR ignores the fallback and fetches from the browser. Nothing warns, nothing errors, the page renders correctly — it just does a round trip you thought you had removed, and no output assertion will catch it. Define the key once in a shared module and call it from both sides.

**★ Awaiting `getProduct(id)` before putting it in `fallback`.**
The pattern depends on the promise being unawaited: React serializes it into the RSC payload and only the component reading that key suspends. Awaiting it blocks the `ProductData` component and everything around it, which is the behaviour the Suspense boundary was there to avoid.

**★ Using an empty string instead of `null` for a conditional key.**
`null` tells SWR not to fetch. `''` is a valid key and fires a request against a URL you did not intend. In an autocomplete this means a request on every render before the user has typed anything.

**★ Expecting `revalidateIfStale: false` to behave like a `staleTime`.**
It is a switch, not a duration: it disables on-mount revalidation permanently, on every mount, not for a window. The docs draw the contrast explicitly against TanStack Query's `staleTime`. If you want a time window in SWR, you have to build it.

**★ Assuming `revalidateIfStale: false` freezes the data.**
It only removes revalidation on mount. *"Focus, reconnect, polling, and `mutate` can still revalidate the key."* If you genuinely want no background traffic, disable those individually.

**★ Reading `isLoading` under `suspense: true` and rendering nothing.**
With Suspense handling the initial no-data state, `isLoading` is not the signal you want for background refreshes — `isValidating` is. Rendering a spinner on `isLoading` under Suspense produces UI that never appears, so a background refresh gives the user no feedback at all.

**★ Wrapping the interactive control in the same Suspense boundary as the results.**
The documented autocomplete deliberately keeps the input outside the boundary: *"Keep the interactive shell outside the boundary so it remains available while the results load."* Inside it, every keystroke unmounts the input, and focus and cursor position go with it.

**★ Multiple `suspense: true` reads inside one component.**
They run sequentially. *"Independent Suspense reads can start in parallel when they render in sibling components. Multiple Suspense reads in one component run sequentially."* Split them into siblings if they are independent.

**★ Reusing one `<SWRConfig>` in the root layout for every feature's fallback.**
The guide says to *"Scope `<SWRConfig>` to the route segment that owns the data"* so the provider stays next to its consumer. A root-level provider accumulates every feature's keys, makes the layout depend on data it does not render, and turns any fallback change into a change to the whole application's shell.

**★ Building the SWR key inline in the component instead of importing it.**
Writing the template literal `/api/products/${id}` inline at the `useSWR` call site looks harmless and is the mechanism by which keys drift. The moment the server-side fallback is written with a trailing slash, a query parameter, or a different casing, the two stop matching. One exported builder, imported at both call sites, removes the failure mode entirely.

## Interview questions

**★ What exactly happens if the `SWRConfig` fallback key and the `useSWR` key differ by one character?**
SWR ignores the fallback and fetches on the client after hydration. There is no error and no warning; the page renders the correct data, just one round trip later. That is why both guides insist on defining the key once in a shared contract module rather than writing the string twice.

**★ Why is the `getProduct(id)` promise passed to `fallback` without being awaited?**
Because React serializes an unawaited promise through the RSC payload, and only the component that reads the matching key suspends on it. Awaiting it in `ProductData` would block that component and its subtree, which defeats the point of streaming the value in behind a boundary.

**★ What are the two promises in the documented page component doing?**
`params.then(({ id }) => <ProductData id={id} />)` keeps the Suspense fallback visible until route parameters resolve, without making the page component itself async and blocking. `getProduct(id)`, created inside `ProductData` and left unawaited, is the SWR fallback value that only the consuming component waits on. They solve different problems at different levels.

**★ Distinguish `isLoading` from `isValidating`, and say which matters under Suspense.**
`isLoading` is true when a request is running *and there is no data to display*. `isValidating` is true whenever a request is running, including background revalidation. Under `suspense: true`, Suspense already handles the no-data case and later revalidations keep the current data rendered rather than re-showing the fallback — so `isValidating` is the one to render background-refresh feedback from.

**★ How does SWR's `revalidateIfStale: false` differ from TanStack Query's `staleTime`?**
`staleTime` is a duration: data is considered fresh for that long, then refetched. `revalidateIfStale: false` is a switch that applies to every mount forever — SWR *"does not provide a time-based freshness window for fallback data."* It also only affects on-mount revalidation; focus, reconnect, polling and `mutate` still revalidate the key.

**★ Why does the SWR key double as a Route Handler URL?**
Because the browser needs an endpoint to revalidate and poll against, and the cache identity has to be a string anyway. Making them the same string means one implementation — the Route Handler calls the same `getProduct` function that supplies the server-side fallback — with two entry points, and no third string to keep in sync.

**★ Why does the guide scope `<SWRConfig>` to a route segment rather than the root layout?**
So the fallback lives next to the component that consumes it. A root-level provider means feature data is declared in the application shell, every fallback change touches the layout, and the layout ends up depending on data it does not render. Segment scoping keeps the declaration and the consumer in the same directory.

**★ A conditional SWR key is `null`, not `''`. Why does that distinction matter?**
`null` is SWR's signal not to fetch at all, which is what an autocomplete needs before the user has typed. An empty string is a perfectly valid key, so SWR will fire a request against it — producing a request on first render against a URL that is missing its query, and a cache entry keyed on nothing.

{/* FOOTER */}
