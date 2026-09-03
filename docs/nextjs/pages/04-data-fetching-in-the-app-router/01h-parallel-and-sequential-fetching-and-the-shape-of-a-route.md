---
title: "Where you put an `await` decides the shape of the whole route — a dependency deserves a waterfall, an independent read never does, and one `await` at the top of a layout serialises and de-prerenders everything beneath it"
sidebar_label: "01h · parallel and sequential fetching"
sidebar_position: 1.2
description: "Parallel versus sequential data fetching in Server Components: why layouts and pages already render in parallel, how an await in the wrong place serialises a tree, Promise.all versus allSettled, the preload pattern, and why co-locating fetches beats prop drilling."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-03 for **Next.js 16.3.4** against [Fetching Data · Sequential and parallel data fetching](https://nextjs.org/docs/app/getting-started/fetching-data) (docs `lastUpdated` 2026-08-25) and [Streaming · Push dynamic access down](https://nextjs.org/docs/app/guides/streaming) (`lastUpdated` 2026-08-25).
> Target: **Next.js 16.3.4**, App Router, Node >= 20.9. Documentation-verified; **no sandbox run**.

**Because a Server Component is an async function, `await` is the only data-flow primitive you have, and it does two things at once: it orders the work and it decides what can be prerendered. Nobody writes a waterfall on purpose. They are produced by writing a component the way you would write a script — one thing after another — in a place where the framework had already arranged for those things to happen at the same time. This page is about the four decisions that follow from where an `await` goes: whether two reads overlap, whether a failure takes the page down or degrades it, whether the route can produce a static shell, and whether a component can stream independently. [01](01-fetch-in-server-components-automatic-request-deduplication.md) established that fetching the same value in several components is free; this page is why the *ancestor* should usually not be the one fetching it.**

## What is already parallel, and what is not

Two facts do a lot of work here.

**Layouts and pages render in parallel.** The docs state it directly: by default, layouts and pages are rendered in parallel, so each segment starts fetching data as soon as possible. A four-segment route does not fetch four times in series; the segments start together. This is why nesting a route more deeply does not add a round-trip per level.

**Within any one component, `await`s are sequential.** Also stated directly: within *any* component, multiple `async`/`await` requests can still be sequential if placed one after the other. The framework's parallelism ends at the component boundary; inside a function body, JavaScript semantics take over and nothing overlaps unless you make it.

```tsx
// Sequential — and this is correct, because the second call needs artist.id.
const artist = await getArtist(username)
const albums = await getAlbumsByArtist(artist.id)
```

```tsx
// Sequential — and this is a bug, because getAlbums only needs `username`,
// which was available before either call started.
const artist = await getArtist(username)
const albums = await getAlbums(username)
```

The two look identical. The difference is entirely in whether the second call reads anything the first produced, which is why waterfalls survive code review: nothing about the shape of line two says it did not need line one.

## Making independent reads overlap

Requests begin as soon as `fetch` is called, not when it is awaited. So the technique is to call first and await later.

```tsx
// app/artist/[username]/page.tsx
import { getArtist, getAlbums } from '@/lib/artists'

export default async function ArtistPage({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username } = await params

  // Initiate both. Neither is awaited yet, so both are in flight.
  const artistData = getArtist(username)
  const albumsData = getAlbums(username)

  const [artist, albums] = await Promise.all([artistData, albumsData])

  return (
    <>
      <h1>{artist.name}</h1>
      <AlbumGrid list={albums} />
    </>
  )
}
```

Wall time becomes the slower of the two rather than their sum. Note that assigning to `artistData` and `albumsData` on separate lines is not decoration — writing `Promise.all([getArtist(u), getAlbums(u)])` does the same thing, but the two-line form is what makes it obvious in review that the calls are unconditional and neither reads the other.

### `Promise.all` fails as a unit — sometimes that is wrong

The docs attach the caveat: if one request fails when using `Promise.all`, the entire operation fails. For a product page where the price is essential and the recommendations are not, that turns a degraded page into a 500.

```tsx
// Recommendations are optional; the product is not.
const [productResult, recsResult] = await Promise.allSettled([
  getProduct(id),
  getRecommendations(id),
])

if (productResult.status === 'rejected') throw productResult.reason // page cannot render
const product = productResult.value
const recommendations = recsResult.status === 'fulfilled' ? recsResult.value : []

return <ProductView product={product} recommendations={recommendations} />
```

Use `Promise.all` when every value is load-bearing and a missing one means the page is wrong. Use `Promise.allSettled` when some of them are enrichment. The choice is a product decision expressed in code, and choosing `all` by reflex is how an analytics outage takes down a checkout page.

## The `await` at the top of a layout, which costs more than latency

> *"If you `await` any of these at the top of a layout or page, everything below that point becomes dynamic"*

This is the expensive one, because it is not merely a serialisation — it removes the route's static shell. The rule covers `params`, `searchParams`, `cookies()`, `headers()` and any data fetch.

```tsx
// 🔴 app/dashboard/layout.tsx — nothing in this route can prerender.
// The nav, the shell chrome and every child are behind this await.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const theme = cookieStore.get('theme')?.value ?? 'light'
  return (
    <div data-theme={theme}>
      <Nav />
      {children}
    </div>
  )
}
```

The fix is to keep the layout synchronous and push the await into the one component that needs the value, behind a boundary:

```tsx
// app/dashboard/layout.tsx — synchronous. Nav and children stay in the static shell.
import { Suspense } from 'react'
import { cookies } from 'next/headers'
import { Nav } from './nav'
import { UserMenu } from './user-menu'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = cookies() // start the work; do not await it here

  return (
    <div>
      <Nav>
        <Suspense fallback={<UserMenuSkeleton />}>
          <UserMenu cookiePromise={cookieStore} />
        </Suspense>
      </Nav>
      {children}
    </div>
  )
}
```

```tsx
// app/dashboard/user-menu.tsx — the await happens here, inside the boundary.
import type { cookies } from 'next/headers'

export async function UserMenu({
  cookiePromise,
}: {
  cookiePromise: ReturnType<typeof cookies>
}) {
  const store = await cookiePromise
  const theme = store.get('theme')?.value ?? 'light'
  return <Menu theme={theme} />
}
```

The same applies to `params` on a dynamic route. Pass the promise, or unwrap it inline so the child still receives a plain value:

```tsx
// app/shop/[category]/page.tsx — <Hero /> paints as part of the static shell.
import { Suspense } from 'react'

export default function ShopPage({ params }: { params: Promise<{ category: string }> }) {
  return (
    <div>
      <Hero />
      <Suspense fallback={<GridSkeleton />}>
        {params.then(({ category }) => (
          <ProductGrid category={category} />
        ))}
      </Suspense>
    </div>
  )
}
```

## Where the call itself goes

Overlapping two reads is the mechanical half of the problem. The structural half — whether the call belongs in the ancestor or in the component that uses the value, and how to start work early so a deep `await` joins something already in flight — is [01i](01i-co-location-preloading-and-where-the-fetch-call-belongs.md).

## Gotchas

**★ Symptom: a page fetches three independent things and takes about as long as all three added together.** Cause: three sequential `await`s in one component body. Layouts and pages render in parallel, but within a component nothing overlaps unless you make it. Fix: start the calls, then await them together.

```tsx
const productData = getProduct(id)
const reviewsData = getReviews(id)
const stockData = getStock(id)
const [product, reviews, stock] = await Promise.all([productData, reviewsData, stockData])
```

**★ Symptom: the recommendations service has an incident and your product pages return 500.** Cause: `Promise.all` rejects as soon as any input rejects, so an optional read is now load-bearing. Fix: `Promise.allSettled`, with an explicit decision per value about whether a rejection is fatal.

```tsx
const [product, recs] = await Promise.allSettled([getProduct(id), getRecommendations(id)])
if (product.status === 'rejected') throw product.reason
const recommendations = recs.status === 'fulfilled' ? recs.value : []
```

**★ Symptom: nothing on a route prerenders, and the only recent change was reading a cookie for the theme.** Cause: `await cookies()` at the top of the layout. Awaiting `params`, `searchParams`, `cookies()`, `headers()` or a data fetch at the top of a layout or page makes everything below that point dynamic. Fix: keep the layout synchronous, pass the promise down, await it inside a `<Suspense>` boundary — shown in full above.

**★ Symptom: `Promise.all` was added and the request count did not change, only the ordering.** Cause: the two calls were genuinely dependent — the second reads a value the first produced — so the "parallel" version still awaits in sequence internally, or worse, was made parallel by passing stale data. Fix: leave a true dependency sequential, and use a boundary so the dependent part streams rather than blocking the page.

```tsx
export default async function Page({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params
  const artist = await getArtist(username)     // must resolve first
  return (
    <>
      <h1>{artist.name}</h1>
      <Suspense fallback={<PlaylistSkeleton />}>
        <Playlists artistID={artist.id} />     {/* streams after the artist resolves */}
      </Suspense>
    </>
  )
}
```

**Symptom: you parallelised the reads and the page is still slow, because the first request is the slow one.** Cause: a genuine dependency chain has a floor equal to its longest path, and `Promise.all` cannot shorten it. The docs' own advice is to ensure the data source resolves the first request quickly, since it blocks everything else. Fix: cache the blocking read if it changes infrequently, or restructure so the dependent read does not need the whole first object — often an ID is already in the URL.

**Symptom: a route with five nested segments is assumed to cost five sequential round-trips.** Cause: a mental model imported from client-side routing. Layouts and pages render in parallel by default; segments start fetching as soon as possible. Fix: nothing — but do not restructure a route to "flatten" it for a cost it never had. Measure where the `await`s are inside components instead.

**Symptom: the parallel version regressed on a cache-heavy route.** Cause: eagerly starting a request that a conditional path would not have made. `Promise.all` on values only one branch needs converts a maybe-request into an always-request, and under the Data Cache it can also populate entries nobody reads. Fix: only overlap work the component will unconditionally use; leave conditional reads inside the branch.

```tsx
const product = await getProduct(id)
// Only ask for the bundle when the product actually is one.
const bundle = product.kind === 'bundle' ? await getBundleItems(product.id) : null
```

## Interview questions

**★ In the App Router, what is already parallel and what is not?**
Layouts and pages render in parallel by default, so each route segment starts fetching as soon as possible — nesting a route more deeply does not add a serial round-trip per level. What is not parallel is anything inside a single component body: multiple `async`/`await` calls placed one after another run sequentially, exactly as they would in any JavaScript function. The framework's parallelism stops at the component boundary, so every waterfall you actually encounter lives inside one function.

**★ How do you tell a legitimate waterfall from an accidental one?**
Ask whether the second call reads a value the first produced. `getAlbums(artist.id)` after `getArtist(username)` is a real dependency and the sequencing is required. `getAlbums(username)` after `getArtist(username)` is accidental — both arguments were available before either call started. The two look identical on the page, which is why they survive review; the test is data flow, not syntax. A legitimate waterfall is still worth putting behind a `<Suspense>` boundary so the dependent half streams rather than blocking the page.

**★ Why is `await cookies()` at the top of a layout worse than the same call at the top of a leaf component?**
Because a layout wraps everything below it. Awaiting a Request-time API or a data fetch at the top of a layout or page makes everything below that point dynamic, so the route loses its static shell entirely — the nav, the chrome and every child now wait on that value, and none of it can be prerendered. The same call inside a leaf component behind a `<Suspense>` boundary costs only that component. The fix is to keep the layout synchronous, pass the promise down as a prop, and await it inside the boundary.

**★ When is `Promise.all` the wrong choice?**
When the values are not equally essential. `Promise.all` rejects as soon as any input rejects, so an optional read — recommendations, related posts, an analytics widget — becomes capable of taking the whole page down. `Promise.allSettled` lets you decide per value: throw on the ones the page cannot render without, fall back to a default for the ones that are enrichment. Reaching for `all` by reflex is how a non-critical dependency's incident becomes your incident.

**You parallelised everything and the page is still slow. What is left?**
A dependency chain has a floor equal to its longest path, and no amount of `Promise.all` shortens it. If the first read is slow and everything waits on it, the remaining moves are: cache that read if it changes infrequently, restructure so the dependent read keys on something already in the URL rather than on a field of the first response, or accept the chain and put the tail behind a `<Suspense>` boundary so the user sees the page rather than a blank one. The docs say the same thing more plainly — make sure the first request resolves quickly, because it blocks everything else.

**Why does starting a fetch on one line and awaiting it on another change anything?**
Because the request begins when `fetch` is called, not when the promise is awaited. `await` is only the point at which the current function suspends. Two calls made before either is awaited are already overlapping; two calls each awaited immediately are not. The two-line form — assign, assign, then `Promise.all` — is also more honest in review, because it makes clear that both calls are unconditional and that neither depends on the other.

---

← [01g · React.cache and connection](01g-react-cache-connection-and-non-fetch-memoization.md) · Next → [01i · co-location and preloading](01i-co-location-preloading-and-where-the-fetch-call-belongs.md)
