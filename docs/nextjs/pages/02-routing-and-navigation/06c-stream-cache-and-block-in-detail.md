---
title: "Stream and Cache are the two fixes that actually make a navigation instant, and both fail in ways that read as \"the fix did not apply\": a cacheLife shorter than the prerender window still fails validation, and connection() has no Cache fix at all by design"
sidebar_label: "06c · Stream and Cache in detail"
sidebar_position: 161
description: "The two constructive remediations for a blocking-route Insight in full — the Suspense patterns, the params rule, where to place the boundary, use cache and the short-lived-cache trap, the invalidation obligation it creates, and every gotcha the docs attach to each."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against [Uncached data during prerendering](https://nextjs.org/docs/messages/blocking-prerender-dynamic) and [Runtime data during prerendering](https://nextjs.org/docs/messages/blocking-prerender-runtime) (Insight message pages, no `lastUpdated` field), [Ensuring instant navigations](https://nextjs.org/docs/app/guides/instant-navigation) (`lastUpdated: 2026-08-25`), [Adopting Partial Prefetching](https://nextjs.org/docs/app/guides/adopting-partial-prefetching) (`lastUpdated: 2026-08-25`), [`instant` route segment config](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/instant) (`lastUpdated: 2026-08-03`) and [Next.js 16.3: Instant Navigations](https://nextjs.org/blog/next-16-3-instant-navigations).
> Target: **Next.js 16.3.4** (docs build). Documentation-verified — **no sandbox run**.

**A blocking-route Insight hands you up to three buttons, and the honest description of them is not "three ways to fix it" but "one refactor, one caching commitment, and one admission of defeat." This page is the first two — the ones that actually make the navigation instant. The overlay card has no room for the trade-offs; the docs state them, and they are what decides which button is right. It also carries the two failure modes that read as "the fix did not work" and are really the fix being misapplied: a `'use cache'` whose `cacheLife` is too short to reach the prerender, and a `<Suspense>` boundary inherited from a parent layout that sits too high to cover the navigation you are actually on. The third button, `instant = false`, is [06d](06d-block-and-opting-out-honestly.md).**

## Fix 1 — Stream

Choose it, per the docs, *"when the data must be fresh on every request"* (`blocking-prerender-dynamic`) or *"when the value really is per-request, but the page has parts that don't depend on it"* (`blocking-prerender-runtime`).

The blog's one-line version:

> *"**Stream** with `<Suspense>`. The user will instantly see a loading state (with more UI streaming in after)."*

The canonical shape is: extract the blocking work into a child, wrap the child.

```tsx
// app/dashboard/page.tsx
import { Suspense } from 'react'
import { TransactionList } from './transaction-list'
import { TransactionSkeleton } from './transaction-skeleton'

export default function Page() {
  return (
    <Suspense fallback={<TransactionSkeleton />}>
      <TransactionList />
    </Suspense>
  )
}
```

The docs list four patterns under this fix: wrap the existing component in place, push the data access down to the leaf, add a boundary per leaf so they stream in parallel, and use `loading.js` for the whole segment.

### The `params` rule that catches everybody

For `params` and `searchParams`, wrapping is not enough — you must **not `await` the promise in the page at all.** Pass it down.

```tsx
// app/products/[slug]/page.tsx — pass the promise, do not await it here
import { Suspense } from 'react'
import { ProductDetails } from './product-details'

export default function Page({ params }: PageProps<'/products/[slug]'>) {
  return (
    <ProductLayout>
      <Suspense fallback={<DetailsSkeleton />}>
        <ProductDetails params={params} />
      </Suspense>
    </ProductLayout>
  )
}
```

```tsx
// app/products/[slug]/product-details.tsx — the child awaits inside the boundary
export async function ProductDetails({
  params,
}: Pick<PageProps<'/products/[slug]'>, 'params'>) {
  const { slug } = await params
  const product = await getProduct(slug)
  return <Details product={product} />
}
```

> *"Don't await `params` or `searchParams` at the top of the route. Pass the promise to a child that reads it inside its own boundary, so the rest of the route stays in the shared prefetch."*

> *"Everything outside the boundary stays in the shared App Shell, and only the URL-specific region renders per navigation."*

The guide's worked example shows the pay-off precisely: after moving `await props.params` into the suspended child, *"`await props.params` and the product fetch suspend together. The product-fetch error clears, and validation moves on to the next blocker."*

### The trade-off the docs attach to Stream

> *"The shell ships immediately, but the user sees a loading state for the streamed region on every request. Design the fallback so it approximates the final layout. A generic spinner causes a layout shift when content arrives."*

### Where to put the boundary

> *"A high boundary (around the whole page) gives one loading state for everything. Less work to set up, but the user loses context about where they were going."*
> *"A low boundary (around the specific component that fetches) keeps surrounding content visible and only shows a fallback for the part that is in flight. Preferred when the surrounding shell has cached content."*

> *"A useful rule: **push the boundary as low as possible** while keeping the fallback meaningful. The cached content above the boundary becomes part of the static shell on navigation. Wrapping individual pieces or wrapping the whole page in one boundary stream the same way, but a lower boundary keeps more prerendered content visible during the navigation."*

And the warning that a passing check is not a good result:

> *"A `<Suspense>` boundary placed around the whole page body can pass validation with an empty shell, which defeats the point of an instant navigation."*

`loading.js` is the blunt-instrument version, and the docs say so:

> *"A `loading.js` file wraps the segment's `{children}` in one Suspense boundary. Parent layouts above it still prerender, but everything inside the segment sits behind the fallback. If page-level content could be prerendered (a static intro, a known title), use explicit `<Suspense>` boundaries inside `page.js` around only the dynamic parts."*

## Fix 2 — Cache

Choose it *"when the data does not need to be regenerated on every request."* The blog's one-liner:

> *"**Cache** with `'use cache'`. The user will instantly see a previously cached UI (reused between requests)."*

Mechanically: move the call into a function and make `'use cache'` the first statement of its body.

```tsx
// app/dashboard/page.tsx
async function getRecentTransactions(limit: number) {
  'use cache'
  return db.transactions.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
}
```

> *"The function still runs the underlying query, but Next.js caches the result for the configured lifetime and the surrounding route becomes prerenderable."*

> *"Arguments to the function and closed-over variables become part of the cache key, so prefer passing the values you depend on as arguments to make the contract explicit."*

The docs list four patterns here: cache the data-access function, cache the whole component, tag the cache for targeted invalidation, and set an explicit `cacheLife` profile.

### The trade-off the docs attach to Cache

> *"Freshness becomes a property of the cache configuration, not the data source. The cached response is reused until `cacheLife` revalidates or expires, or until `cacheTag` is invalidated. Plan invalidations alongside the code that mutates the data. Call `updateTag` from a Server Action when the user performed the mutation and should see fresh data on the next request, or `revalidateTag` from a route handler, cron, or webhook for stale-while-revalidate refreshes."*

That is the sentence that turns a one-line fix into a design decision: **adding `'use cache'` creates an invalidation obligation somewhere else in the codebase**, and the two functions are not interchangeable — `updateTag` for the user who just performed the mutation, `revalidateTag` for background refreshes.

### 🔴 `connection()` has no Cache fix

> *"This fix does not apply to `connection()`. The whole point of `connection()` is to opt into per-request rendering for the wrapped subtree, so caching it would defeat the purpose. Use Wrap in or move into Suspense instead."*

## Gotchas

**★ Symptom: you add `'use cache'` and the same Insight fires again on the same function.** Cause: the `cacheLife` profile is too short to be prerendered. Verbatim: *"A short profile (such as `\"seconds\"` or `\"minutes\"`) whose `revalidate` is shorter than the prerender's effective lifetime prevents the value from being included in the prerender. The segment becomes a dynamic hole instead. The cache entry still helps the Client Cache and protects upstream APIs, but the page falls back to streaming."* Fix: use a longer profile — *"To keep the page prerendered, use a profile with a longer revalidate window such as `\"default\"` (15 minutes), `\"hours\"`, or `\"days\"`."*

```tsx
import { cacheLife } from 'next/cache'

async function getFeatured() {
  'use cache'
  cacheLife('hours') // NOT 'seconds' — that value never reaches the prerender
  const res = await fetch('https://api.example.com/products?limit=3')
  return res.json()
}
```

**★ Symptom: `'use cache'` throws when the function reads `cookies()`.** Cause: the directive runs on the server with no request context. Verbatim: *"The `\"use cache\"` directive runs on the server. It can't wrap a function that uses runtime APIs such as `cookies()` or `headers()`. Read those outside the cached scope and pass the values as arguments, or use `\"use cache: private\"`."* Fix: hoist the read; the argument then becomes part of the cache key, which is exactly what you want.

```tsx
import { cookies } from 'next/headers'

async function getTopics(team: string | undefined) {
  'use cache'
  return db.topics.forTeam(team)
}

export async function TeamTopics() {
  const team = (await cookies()).get('team')?.value
  return <TopicList topics={await getTopics(team)} />
}
```

**★ Symptom: a `<Suspense>` fallback itself raises a Cache Components error.** Cause: the fallback is not deterministic. Verbatim: *"The fallback must be deterministic. Calling `Math.random()` or `Date.now()` inside the fallback raises a separate Cache Components error during prerendering."* Fix: make the placeholder static. Cached values are allowed in there — *"Cached values like timestamps or data fetches can sit directly inside the fallback."*

```tsx
// Wrong — re-derived at prerender time
<Suspense fallback={<p>Loading, ref {Math.random()}</p>}>

// Right
<Suspense fallback={<TransactionSkeleton />}>
```

**★ Symptom: an Insight fires on a data access that already sits inside a `<Suspense>` boundary.** Cause: the boundary belongs to a parent layout and is too high to cover this navigation. Verbatim: *"This error can also appear during a client-side navigation when the data access sits inside a `<Suspense>` boundary from a parent layout but that boundary is too high. It wraps the entire segment instead of only the dynamic part, so the navigation still blocks."* Fix: add a boundary next to the access, inside the page, so the segment above it stays in the shell.

```tsx
// app/store/[slug]/page.tsx — a boundary per dynamic leaf, not one at the top
import { Suspense } from 'react'

export default function ProductPage(props: PageProps<'/store/[slug]'>) {
  return (
    <div>
      <Suspense fallback={<p>Loading product...</p>}>
        <ProductInfo params={props.params} />
      </Suspense>
      <Suspense fallback={<p>Checking availability...</p>}>
        <Inventory params={props.params} />
      </Suspense>
    </div>
  )
}
```

**★ Symptom: a cookie-driven `<html data-theme>` cannot be fixed by any of the three cards.** Cause: you cannot suspend the document root. Verbatim: *"Root-element attributes (`<html lang>`, `<html dir>`, `<html data-theme>`) can't be wrapped in `<Suspense>`. You can't suspend the document root, and a boundary inside `<html>` still leaves the attribute itself server-cookie-dependent."* Fix, as prescribed: move the read to a pre-paint client script and add `suppressHydrationWarning` on `<html>` so React does not flag the script's mutation as a mismatch.

```tsx
// app/layout.tsx
export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  )
}
```

**Symptom: a fallback that renders `{children}` drags dynamic reads into the static shell.** Cause: the child page's own dynamic work propagates into what should be a static placeholder. Verbatim: *"Do not pass `{children}` through in the fallback. Child pages may include dynamic reads (for example, `/_not-found` calling `cookies()` or an uncached `fetch()`) that propagate into what should be a static fallback. Render a placeholder that doesn't include `{children}`."*

```tsx
// Wrong
<Suspense fallback={<Shell>{children}</Shell>}>{children}</Suspense>

// Right
<Suspense fallback={<Shell><SectionSkeleton /></Shell>}>{children}</Suspense>
```

**Symptom: a cached function's hit rate is far worse than expected.** Cause: closed-over variables are silently part of the key. Verbatim: *"Variables captured from the surrounding scope are automatically bound as part of the cache key. That keeps cached entries per-value, but it also means a wide closure can balloon the key surface."* Fix: pass the dependencies as arguments so the contract is explicit and reviewable.

```tsx
// Implicit key surface — whatever this closure happens to capture
async function getRows() {
  'use cache'
  return db.rows.forTeamAndRegion(team, region)
}

// Explicit key surface
async function getRows(team: string, region: string) {
  'use cache'
  return db.rows.forTeamAndRegion(team, region)
}
```

**Symptom: the cache appears cold on every other request in production.** Cause: the default cache is per-instance. Verbatim: *"The default in-memory cache is per-server-instance."* and, from the guide, *"In serverless deployments, in-memory caching with `\"use cache\"` will not persist across instances."* Fix: `'use cache: remote'`, accepting the documented trade — *"It trades a network roundtrip for a single cache shared by all servers."*

```tsx
async function getFeatured() {
  'use cache: remote'
  const res = await fetch('https://api.example.com/products?limit=3')
  return res.json()
}
```

**Symptom: `'use cache: private'` did not put the value in the static shell.** Cause: that variant caches in the browser only. Verbatim: *"The result is cached in the browser only, not on the server. **It can't be part of the static shell.**"* Fix: it can still reach the *App Shell* ahead of a click, but only if its `stale` time is at least 5 minutes — otherwise you need a server-side cache or a `<Suspense>` boundary.


## Interview questions

**★ A blocking-route Insight offers you Stream, Cache and Block. How do you decide?**
By asking what the data *is*, not what makes the box disappear. If it must be correct at the instant of the request — inventory, a live price, an auth-derived value — it cannot be in a shell, so you Stream it and design a fallback that approximates the final layout rather than a spinner. If it is the same for everyone for a while — a featured list, product copy, a nav tree — you Cache it and take on the invalidation obligation the trade-off names: `updateTag` from the mutating Server Action, `revalidateTag` from a webhook or cron. Block is for the case where request-time data high in the tree decides what the page even is, so there is no useful shell to show first — auth or tenant gating in a layout. The docs are blunt that it is not a third equal option: *"Don't use this to dismiss the error."* Block is [06d](06d-block-and-opting-out-honestly.md).

**★ You added `'use cache'` and the Insight did not clear. What is the first thing you check?**
The `cacheLife` profile. A profile whose `revalidate` window is shorter than the prerender's effective lifetime keeps the value out of the prerender entirely — the segment becomes a dynamic hole and validation still fails, even though the cache entry is genuinely working and still protecting the upstream API and the Client Cache. `'seconds'` and `'minutes'` fall into this trap; `'default'` (15 minutes), `'hours'` and `'days'` do not. The related rule for the App Shell is the same number from the other side: cached content joins the shell only when its `stale` time is at least 5 minutes. If the short profile is deliberate, the docs tell you to stop fighting it and Stream instead.

**★ Why does `connection()` have no Cache fix?**
Because caching it would negate the only thing it does. `connection()` exists to mark a subtree as per-request; wrapping it in `'use cache'` would be asking the framework to reuse the result of a call whose entire meaning is "do not reuse this." The docs name the only remaining fix — put it behind a `<Suspense>` boundary and let it stream.

**Where should a `<Suspense>` boundary go, and why is "wrap the page" wrong even though it passes?**
As low as possible while keeping the fallback meaningful. Wrapping the whole page and wrapping individual leaves stream identically as far as the protocol is concerned, but the content *above* the boundary is what becomes the static shell and stays visible during the navigation — so a high boundary trades away exactly the thing the feature exists to deliver. The docs warn that a page-body boundary *"can pass validation with an empty shell, which defeats the point of an instant navigation,"* and the design goal is stated the other way round: keep as much real cached content visible as possible and show fallbacks only where data is actually in flight.

**A page needs a cookie-driven theme on `<html>`. Which fix card applies?**
None of them, and that is a real hole rather than a trick question. `<html lang>`, `<html dir>` and `<html data-theme>` are root-element attributes; you cannot suspend the document root, and a `<Suspense>` boundary placed inside `<html>` still leaves the attribute itself dependent on a server-read cookie. The documented route out is not a Cache Components fix at all: move the read to a pre-paint client script and add `suppressHydrationWarning` to `<html>` so React does not treat the script's mutation as a hydration mismatch.


---

← [06b · The Insight catalogue](06b-instant-insights-and-the-fix-cards.md) · [Chapter 2 overview](01-explanation.md) · Next → [06d · Block, and opting out honestly](06d-block-and-opting-out-honestly.md)
