---
sidebar_position: 3
title: "Per-link prefetching buys you resolved URL data at the price of one server invocation per visible link, and the structural bug that makes it necessary is awaiting params above a Suspense boundary"
sidebar_label: "3 · Per-link prefetching and adoption"
description: "The URL-data-outside-Suspense insight and its fix, what prefetch={true} actually resolves and what it costs, hover-triggered prefetch for link-dense pages, and adopting Partial Prefetching one route at a time with prefetch = 'partial'."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-03 against [Optimizing prefetching](https://nextjs.org/docs/app/guides/optimizing-prefetching), [Adopting Partial Prefetching](https://nextjs.org/docs/app/guides/adopting-partial-prefetching), [`prefetch` route segment config](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/prefetch) and [Codemods](https://nextjs.org/docs/app/guides/upgrading/codemods).
> Target: **Next.js 16.3.4** · `prefetch` segment config is Cache Components only.

**The shared App Shell cannot contain anything that varies per link, so `params` and `searchParams` are structurally excluded from it. Two consequences follow, and they are the whole of this chunk. First: reading URL data above a `<Suspense>` boundary ties the shell to one URL and destroys the sharing — under this model an `async` page whose first line is `await params` is a bug. Second: when you genuinely need URL-dependent content painted at click time, `<Link prefetch={true}>` will resolve it, at a cost of one server invocation per visible link, best-effort, whether or not the user clicks.**

## The structural bug: URL data outside Suspense

With `partialPrefetching` on, Next.js validates each App Shell as you navigate in development. Reading `params` or `searchParams` above a boundary ties the shared shell to a single URL, and the insight names the route.

```tsx title="app/products/[slug]/page.tsx"
// Before — awaiting params at the top ties the App Shell to one URL
export default async function Page({ params }: PageProps<'/products/[slug]'>) {
  const { slug } = await params
  const product = await getProduct(slug)
  return (
    <ProductLayout>
      <Details product={product} />
    </ProductLayout>
  )
}
```

The fix is to pass the promise down without awaiting it, and await it inside the boundary:

```tsx title="app/products/[slug]/page.tsx"
// After — pass the promise down without awaiting it
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

```tsx title="app/products/[slug]/product-details.tsx"
export async function ProductDetails({
  params,
}: Pick<PageProps<'/products/[slug]'>, 'params'>) {
  const { slug } = await params
  const product = await getProduct(slug)
  return <Details product={product} />
}
```

Two details to carry into code review. The page component **stopped being `async`** — that is the visual tell. And the rule holds for params that `generateStaticParams` covers:

> *"Like `searchParams`, `params` needs a `<Suspense>` boundary, even when the values are predefined by `generateStaticParams`. A statically known param still belongs to one URL."*

Everything outside the boundary stays in the shared App Shell; only the URL-specific region renders per navigation.

## What per-link prefetching actually resolves

```tsx title="app/page.tsx"
import Link from 'next/link'

export default function Home() {
  return (
    <nav>
      <Link href="/search?q=react" prefetch={true}>React</Link>
      <Link href="/search?q=next" prefetch={true}>Next.js</Link>
    </nav>
  )
}
```

```tsx title="app/search/page.tsx"
import { Suspense } from 'react'

export default function SearchPage({ searchParams }: PageProps<'/search'>) {
  return (
    <>
      <h1>Search</h1>
      <Suspense fallback={<ResultsSkeleton />}>
        <Results searchParams={searchParams} />
      </Suspense>
    </>
  )
}

async function Results({
  searchParams,
}: {
  searchParams: PageProps<'/search'>['searchParams']
}) {
  const { q } = await searchParams
  return <ResultList items={await search(q)} />
}

async function search(q: string) {
  'use cache'
  return db.search(q)
}
```

Without the prop, the shell renders the `<h1>` and the fallback; `q` resolves after the click and the results stream in. With it, `q` is known at prefetch time — it is in the link's own `href` — the cached `search(q)` resolves, and the results paint with no fallback.

Note the dependency chain: **per-link prefetching only helps if the URL-dependent work is itself cacheable.** The prerender advances through anything static or cached and then stops:

> *"The prerender advances through anything static or cached, then stops at uncached reads and falls back to the surrounding `<Suspense>` boundary."*

An uncached `db.search(q)` produces the same fallback with or without the prop, and you paid a server invocation for it.

## The cost model

> *"Generating the per-link prefetch costs **a server invocation per prefetchable link**, so it is opt-in per link. On pages where all the content is statically renderable, Next.js serves the prefetch from the static cache instead. A page that accesses non-static data is generated per prefetch."*

and:

> *"A per-link prefetch is best-effort. It only helps the navigations where it completes before the click. On a slow connection, on a feed of many links, or on a direct visit, it may not be ready when the user navigates, and the navigation falls back to the App Shell."*

| | App Shell | Per-link prefetch with `prefetch={true}` |
| --- | --- | --- |
| Scope | One per route | One per visible `<Link prefetch={true}>` |
| Content | Route's rendered output minus per-link data | Same, plus per-link URL data resolved |
| Cost | Bounded by route count | Bounded by visible-link count |
| Role | Default prefetch | More rendered before click |

Use it when all three hold: part of the tree depends on URL data; that part has a known cache lifetime; and the traffic justifies the invocation. Skip it when the route barely depends on URL data, when the dependent content must be fresh per request, or when the route is rarely navigated to — you pay per *visible* link, not per click.

For link-dense pages the documented alternative is intent:

> *"When many links to a route are visible at once, such as a grid of cards, each `<Link prefetch={true}>` prefetches that link's content as it enters the viewport, so the grid makes one such server request per card. Prefetch on intent instead. A hover-triggered prefetch fetches only the links the user is likely to click."*

## Adopting one route at a time

You do not have to flip the global flag in one pull request. `prefetch = 'partial'` is the same behaviour scoped to a destination:

```tsx title="app/dashboard/page.tsx"
export const prefetch = 'partial'

export default function Page() {
  return <Dashboard />
}
```

Set it on the **destination**, not the link — a destination cannot know which links target it, so the segment config is where the cost ceiling lives. Adding it clears the "dynamic data during prefetching" insight for every link pointing at that route, so each destination can be audited, adopted and deployed on its own while the global flag stays off.

The loop is: audit one destination's links against the five-row table in [chunk 2](02-partial-prefetching-and-the-app-shell.md); add `export const prefetch = 'partial'`; deploy; repeat; then enable `partialPrefetching` globally and strip the exports:

```bash
npx @next/codemod@canary remove-partial-prefetch ./app
```

> *"The codemod removes only the `'partial'` value and leaves other values such as `prefetch = 'force-disabled'` in place."*

## Gotchas

**★ An `async` page or layout that awaits `params` on its first line is the bug.**
It ties the route's shared App Shell to one URL, so there is nothing shareable to prefetch and the navigation blocks. The fix is the before/after pair above: keep the page synchronous, pass the `params` promise into a `<Suspense>`-wrapped child, await it there. Make it a review rule — an `async` page component in a dynamic route is worth a second look every time.

**★ "But `generateStaticParams` covers that param" is not an exemption.**
A statically known param still belongs to exactly one URL, so awaiting it above the boundary still ties the shell to that URL. The ISR guide repeats the point for layouts: *"Keep the read inside the boundary even for the categories `generateStaticParams` covers."*

**★ The same mistake in `generateMetadata` reports under a different name.**
A `params` or `searchParams` read inside `generateMetadata` surfaces as **URL data in `generateMetadata()`**, not the page-level insight. You fix the page, the insight name changes, and it looks like a new problem. It is the same class of bug in a different function.

**★ A grid of `prefetch={true}` cards is one server invocation per card, per viewport entry.**
Not per click — per visible link. A 40-card listing wakes the server 40 times whether the user clicks one card or none. Drop the prop on grids; the default `<Link>` prefetches only the shared App Shell and carries none of this cost. Where you want more, prefetch on hover so you pay only for links the user is plausibly about to click.

**★ `prefetch={true}` in front of uncached work buys nothing and still bills you.**
The per-link prerender stops at uncached reads and falls back to the surrounding boundary, so the user sees the identical fallback either way. If you want the prop to pay off, the URL-dependent function needs `'use cache'` (or `'use cache: private'`) behind the `params` / `searchParams` read.

**★ Per-link prefetching is best-effort, so it must never be load-bearing.**
On a slow connection, on a feed of many links, or on a direct visit, the prefetch may not have completed when the user navigates, and the navigation falls back to the App Shell. Design the App Shell to be an acceptable outcome; treat the resolved version as an upgrade, never as the contract.

**★ `<Link prefetch={true}>` pointed at a route that has not adopted Partial Prefetching errors in dev.**
During an incremental migration the destination is still on legacy full prefetch, so there is nothing for the link's URL-data request to resolve against. The dev console error names the destination and offers both fixes: `export const prefetch = 'partial'` on that segment, or enabling `partialPrefetching` app-wide.

**★ `prefetch = 'force-disabled'` does not survive a per-link prefetch of an ancestor.**
> *"When Next.js performs a per-link prefetch for a segment, all downstream segments are included in the same request. Segments deeper in the tree that are configured with `'force-disabled'` will still be prefetched as part of the response."*

If a deep segment must genuinely never be prefetched, put the opt-out at or above the point links actually target, or remove `prefetch={true}` from the links that pull the ancestor.

**★ The adoption codemod reports success on a path that matched nothing.**
> *"Pass `./src/app` in a `src/` project. A wrong path reports `0 ok` instead of failing, so check the file count."*

This applies to `remove-partial-prefetch` and to `cache-components-instant-false`. Read the file count in the output, never the exit status.

**★ Per-route `'partial'` exports outlive their purpose and become folklore.**
Once the global flag is on, every one of them is redundant, but they look load-bearing to the next reader. Run the codemod as the final step of the migration and make "the flag is on, so a `'partial'` export is dead code" a review rule. Note it leaves `'force-disabled'` alone, which is the value you *do* want to keep.

## Interview questions

**★ Why can't the shared App Shell contain `searchParams`-dependent content, and what is the consequence for how you write pages?**
Because one artifact is shared by every link to the route, and `searchParams` differ per link. The consequence is a hard structural rule: never resolve URL data above a `<Suspense>` boundary. Pass the `params` / `searchParams` promise down into a boundary-wrapped child and await it there, so everything outside the boundary stays reusable across every URL of the route.

**★ Does `generateStaticParams` covering a param exempt it from that rule?**
No. A statically known param still belongs to one URL, so awaiting it above the boundary still ties that segment's shell to that URL. Both the Optimizing prefetching guide and the Cache Components ISR guide state this explicitly for pages and for layouts.

**★ What exactly does `prefetch={true}` resolve, and under what condition does it improve anything?**
It opts the link into per-link prefetching: the server renders a fresh response that resolves that link's `params`, `searchParams` and full URL, plus the cached content behind them. It improves the click only if the URL-dependent work is cacheable — the prerender advances through static and cached work and stops at uncached reads, falling back to the same `<Suspense>` boundary the user would have seen anyway.

**★ What does per-link prefetching cost, and how is that different from the App Shell's cost?**
A server invocation per prefetchable link, incurred when the link enters the viewport, regardless of click-through — unless the page is fully statically renderable, in which case the prefetch is served from the static cache. The App Shell's cost is bounded by route count; per-link prefetching's is bounded by visible-link count. That is why one is the default and the other is opt-in per link.

**★ A product grid of 40 cards has `prefetch={true}` on every card. What do you do?**
Remove it. Forty visible links means forty per-link prefetches on viewport entry, for at most one click. The default `<Link>` still prefetches the shared App Shell, so navigation stays instant for everything that does not depend on URL data; where you want the URL-dependent part resolved too, switch to a hover-triggered prefetch so the cost follows intent.

**★ How do you adopt Partial Prefetching without one enormous pull request?**
Leave the global flag off and add `export const prefetch = 'partial'` to individual destinations after auditing their links. Each adopted destination clears the insight for every link that points at it and can ship on its own. When every route in scope is adopted, enable `partialPrefetching` and remove the per-route exports with `npx @next/codemod@canary remove-partial-prefetch ./app`, checking the reported file count.

**★ Why is the `prefetch` config on the destination segment rather than on the link?**
Because a destination cannot know which links target it. The link expresses intent — should this be prefetched, and how eagerly — and the segment sets a cost ceiling that applies to any link pointing there. `'partial'` caps a `<Link prefetch={true}>` at the App Shell plus resolved URL data; `'force-disabled'` skips segment data entirely; `<Link prefetch={false}>` still wins at the link level regardless of how the destination is configured.

**★ Is `prefetch = 'force-disabled'` an absolute guarantee?**
No, on two counts. It does not prevent Next.js prefetching route metadata, and when a per-link prefetch runs for an ancestor segment, all downstream segments are included in that response — including `force-disabled` ones. It guarantees that the client will not request that segment's data *for a prefetch that targets it*, not that the data can never arrive early.

{/* FOOTER */}
