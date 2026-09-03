---
sidebar_position: 6
title: "ISR under Cache Components ends the old choice between a loading shell and a prerendered page: an unlisted URL serves the App Shell to its first visitor and upgrades to a full prerender in the background"
sidebar_label: "6 · Better ISR"
description: "How the build splits a render into an App Shell plus param-specific prerenders, what the first and second visitor to an unlisted URL each get, why params resolve in route order, and how this maps onto the Pages Router's fallback: true."
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-03 against [Incremental Static Regeneration with Cache Components](https://nextjs.org/docs/app/guides/incremental-static-regeneration-cache-components), the [Next.js 16.3 release blog](https://nextjs.org/blog/next-16-3) and [`generateStaticParams`](https://nextjs.org/docs/app/api-reference/functions/generate-static-params).
> Target: **Next.js 16.3.4** · requires both `cacheComponents` and `partialPrefetching`.

**Prerendering a subset of a dynamic route's URLs used to force a bad choice for everything you left out: show a loading shell and never get a prerender, or skip the shell and make the first visitor wait for a full server render. 16.3 removes the choice. The build now produces an App Shell per route *alongside* the param-specific prerenders, so an unlisted URL serves the shell instantly, renders in the background with the now-known params, and hands every later visitor the upgraded result from cache. If you have used `fallback: true` in the Pages Router, this is its Cache Components successor — with one sharp new rule about the order params resolve in.**

## The trade-off it removes

> *"When you prerender only *some* of a route's pages at build time with `generateStaticParams`, the rest of the page faced a tradeoff. They could show a loading shell but never get prerendered, or skip the shell and block the first visitor. Now you get both. A page you don't prerender serves an instant loading shell on its first visit, then upgrades to the fully prerendered page in the background. Every later visitor gets the final content from the cache."*

Both flags are required, and they do different halves of the job:

> *"Cache Components produces the App Shell, while Partial Prefetching upgrades it to a full route once the params are known."*

```ts title="next.config.ts"
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
}

export default nextConfig
```

## What the build produces

> *"During build, Partial Prerendering splits each render into two parts: The **App Shell**: the generic, reusable part of the page that doesn't depend on URL data. [And] the rest of the statically renderable content: the param-specific prerenders for the URLs you list in `generateStaticParams`."*

The layout in the documented example prerenders two categories — and, critically, never awaits its own params:

```tsx title="app/[category]/layout.tsx"
import Link from 'next/link'
import { Suspense } from 'react'
import { getCategory, getTopCategories } from '../lib/data'

export async function generateStaticParams() {
  const categories = await getTopCategories()
  return categories.map((c) => ({ category: c.slug }))
}

async function CategoryHeader({
  params,
}: Pick<LayoutProps<'/[category]'>, 'params'>) {
  const { category } = await params
  const data = await getCategory(category)

  return (
    <div>
      <Link href="/">&larr; All categories</Link>
      <h1>{data?.name ?? 'Category'}</h1>
      {data?.description && <p>{data.description}</p>}
    </div>
  )
}

export default function CategoryLayout(props: LayoutProps<'/[category]'>) {
  return (
    <div>
      <Suspense fallback={<div>Loading...</div>}>
        <CategoryHeader params={props.params} />
      </Suspense>
      {props.children}
    </div>
  )
}
```

The guide spells out why, and it is the same rule as everywhere else in this topic:

> *"The `await` happens inside the boundary, so for unknown categories Next.js can still generate the App Shell. Keep the read inside the boundary even for the categories `generateStaticParams` covers. A statically known param still belongs to one URL, so awaiting it above the Suspense boundary would tie this layout's App Shell to that URL."*

A nested `generateStaticParams` receives the parent's params:

```tsx title="app/[category]/[product]/page.tsx"
export async function generateStaticParams({
  params,
}: {
  params: { category: string }
}) {
  const products = await getPopularProducts(params.category)
  return products.map((p) => ({ product: p.slug }))
}
```

and the data helpers put `'use cache'` at module level so every export is cacheable and therefore eligible for the shell:

```ts title="app/lib/data.ts"
'use cache'

const API = 'https://next-recipe-api.vercel.dev'

export async function getCategory(slug: string) {
  const res = await fetch(`${API}/categories/${slug}`)
  if (!res.ok) return null
  return res.json()
}
```

For that example the build combines into:

- `/tops/tee`, `/shorts/joggers` — fully static pages, both params known
- `/tops/[product]`, `/shorts/[product]` — category header rendered, product shows fallback
- `/[category]/[product]` — both show fallback

## What each visitor gets

- `/tops/tee` — both params prerendered, so a fully static page.
- `/tops/overshirt` — product unknown, category known: the App Shell for `/tops/[product]` with the category header already rendered; the product streams in.
- `/shoes/basketball-shoes` — neither param prerendered: the generic App Shell for `/[category]/[product]`; both stream in.

Then:

> *"After the first visit, Next.js renders these routes in the background with the now-known params. The next visitor to the same URLs gets the upgraded result."*

> *"A prefetch counts as that first visit. When a `<Link>` to an unlisted URL enters the viewport, or you call `router.prefetch`, Next.js starts the background upgrade before the click, so navigation lands on the upgraded result."*

That last sentence is the quietly important one: a listing page full of links to unlisted URLs warms them as those links scroll into view, so in practice the "first visitor pays" case is rarer than it sounds — and your background render volume is driven by viewport impressions, not clicks.

## What the upgrade produces, and the ordering rule

> *"If every data access is cached and all params are resolved, the upgrade produces a **fully static page**. If all params are resolved but the render still hits uncached data or runtime APIs (`cookies`, `headers`) wrapped in `<Suspense>` boundaries, the upgrade produces a **cached page with those fallbacks**. Params are resolved in route order. A param value not returned by `generateStaticParams` stays unresolved and prevents any deeper params from upgrading."*

The third clause is the one that produces confusing production behaviour. If `[category]` is not in `generateStaticParams`, then no `[product]` beneath it can upgrade either, no matter how well the product page is written. Upgrade coverage is therefore a property of the *whole path*, not of the leaf segment.

## Mapping from the Pages Router

| Pages Router | Cache Components |
| --- | --- |
| `fallback: true` in `getStaticPaths` | Default behaviour with `cacheComponents` — visitors get a `<Suspense>` fallback instantly and content streams in |
| `router.isFallback` | Not needed; prerendering produces a static shell you grow with `'use cache'` |
| `getStaticProps` with `revalidate` | `'use cache'` with `cacheLife` |
| `getStaticPaths` | `generateStaticParams` |

## Choosing what to prerender

> *"Every page you prerender increases build work and produces output that has to be stored and deployed. Many routes may never be visited before your next deployment, making that work unnecessary."*

The recommendation is to list the routes that benefit most — popular pages, predictable content — and let the rest be generated on demand and upgraded after their first visit.

One thing that is **not** available: the release blog says *"We're also exploring an API to control how often a page upgrades, for example based on traffic."* Explored, not shipped. There is no supported way to tune upgrade frequency in 16.3.4.

## Gotchas

**★ Awaiting `params` in the layout kills the App Shell for every unlisted URL below it.**
This is the same rule as the rest of the topic, with a bigger blast radius: a layout that awaits its own params above the boundary ties that layout's shell to one URL, so unknown categories have no generic shell to serve. The documented shape is a synchronous layout passing `props.params` into a `<Suspense>`-wrapped header. It applies even to the categories `generateStaticParams` returns.

**★ Params resolve in route order, so an unlisted parent blocks every child from upgrading.**
A product page can be perfectly structured and still never reach a fully prerendered state because its `[category]` was not in `generateStaticParams`. When auditing why some URLs never upgrade, start at the top of the path, not at the leaf.

**★ A prefetch counts as the first visit, which is both the feature and the bill.**
A `<Link>` to an unlisted URL entering the viewport, or a `router.prefetch` call, triggers the background upgrade before any click. On a long listing page that means background renders proportional to impressions. It is usually what you want — navigation lands on the upgraded result — but it is worth knowing before you look at your render counts.

**★ This behaviour is new in 16.3, so an older deployment shows the opposite symptom.**
> *"The App Shell for unlisted params is served from Next.js 16.3. Earlier versions wait for a full server render before sending the response."*

If a supposedly instant unlisted URL blocks, check the deployed Next.js version before rewriting the route.

**★ Under Cache Components, a root param with no `generateStaticParams` values fails the build outright.**
Root parameters are a special case: with Cache Components enabled each one must have at least one value or the build fails. That is a different rule from the optional `generateStaticParams` on deeper segments — see [11 · Root params](../11-root-params.md).

**★ Prerendering more is not obviously better.**
Every listed param costs build time and produces output that must be stored and deployed, often for URLs nobody visits before the next deploy. Prerender the hot and predictable set; let the tail be generated on demand and upgraded on first contact.

**★ Runtime APIs still need boundaries, and their fallbacks are what ships in the shell.**
> *"If your components access runtime APIs like `cookies` or `headers`, wrap them in `<Suspense>`. Their fallback UI is included in the static shell instead."*

An unwrapped `cookies()` read does not merely degrade the upgrade; it prevents a static shell existing at all.

**★ There is no supported knob for upgrade frequency.**
An API to control how often a page upgrades — for example based on traffic — is described as being explored. Do not design a caching strategy around it, and do not assume a fixed cadence exists; what is documented is "upgrade after the first visit, later visitors get the cached result".

**★ `loading.tsx` and inline `<Suspense>` are not equivalent placements.**
> *"`loading.tsx` puts the boundary at the segment edge, while inline `<Suspense>` lets you place it anywhere in the tree."*

A segment-edge boundary is coarse: it replaces the whole segment with one fallback. Inline boundaries are how you keep the header and description visible while only the price streams.

## Interview questions

**★ What was the trade-off before 16.3 for URLs not covered by `generateStaticParams`, and what replaced it?**
Those URLs could either show a loading shell and never be prerendered, or skip the shell and block the first visitor on a full server render. Now the first visit serves the route's App Shell instantly, Next.js renders the page in the background with the now-known params, and every later visitor gets the upgraded result from cache.

**★ Which flags does this need, and what does each contribute?**
Both `cacheComponents` and `partialPrefetching`. Cache Components produces the App Shell — the generic, reusable part of the render that does not depend on URL data. Partial Prefetching is what upgrades that shell to a full route once the params are known.

**★ Three visitors hit `/tops/tee`, `/tops/overshirt` and `/shoes/basketball-shoes` on a build where `generateStaticParams` listed `tops`, `shorts`, and one product each. What does each get?**
`/tops/tee` is fully prerendered — both params known — so it is served static. `/tops/overshirt` gets the App Shell for `/tops/[product]` with the category header already rendered, and the product streams in. `/shoes/basketball-shoes` gets the generic `/[category]/[product]` shell with both the category and product streaming in. The second and third then upgrade in the background.

**★ Why can a well-structured product page never reach a fully prerendered state?**
Because params are resolved in route order and a param value not returned by `generateStaticParams` stays unresolved, preventing any deeper param from upgrading. If the `[category]` above it was never listed, the `[product]` beneath it cannot upgrade regardless of how the page is written.

**★ Does a user have to click for the upgrade to start?**
No. A prefetch counts as the first visit — a `<Link>` to an unlisted URL entering the viewport, or an explicit `router.prefetch`, starts the background upgrade before the click, so the navigation lands on the upgraded result. The corollary is that background render volume tracks link impressions, not clicks.

**★ How does this map onto `fallback: true` from the Pages Router?**
`fallback: true` is now the default behaviour with `cacheComponents`: visitors get a `<Suspense>` fallback immediately and content streams in. `router.isFallback` is unnecessary because prerendering already produces a static shell you grow with `'use cache'`. `getStaticPaths` becomes `generateStaticParams`, and `getStaticProps` with `revalidate` becomes `'use cache'` with `cacheLife`.

**★ Should you prerender every URL you can enumerate?**
No. Every prerendered page costs build time and produces output that must be stored and deployed, and many of those URLs will never be visited before the next deployment. List the routes that benefit most — popular or predictable pages — and let the long tail be generated on demand and upgraded after its first contact with a real visitor or prefetch.

**★ Can you control how often a page upgrades?**
Not in 16.3.4. Vercel describes an API to control upgrade frequency, for example based on traffic, as something they are exploring. The documented behaviour is that a page upgrades after its first visit and subsequent visitors receive the cached, upgraded result; anything beyond that is not something the docs settle today.

{/* FOOTER */}
