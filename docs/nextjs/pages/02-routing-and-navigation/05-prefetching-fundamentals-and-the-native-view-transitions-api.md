---
title: "Prefetching is only enabled in production, which is why half the reports that it is broken come from developers watching next dev — and how much of a route gets fetched depends on whether it is static, dynamic, or dynamic with a loading.js boundary"
sidebar_label: "05 · Prefetching fundamentals"
sidebar_position: 5
description: "What prefetching actually fetches, the viewport and intent triggers and the four-rule scheduler, static versus dynamic routes and their client-cache TTLs, the Next.js 16 layout-deduplication trade, and why development behaves differently."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against the Next.js [Prefetching guide](https://nextjs.org/docs/app/guides/prefetching) (`lastUpdated: 2026-08-25`), [Linking and Navigating](https://nextjs.org/docs/app/getting-started/linking-and-navigating) (`lastUpdated: 2026-08-25`), the [Link Component](https://nextjs.org/docs/app/api-reference/components/link) reference (`lastUpdated: 2026-08-25`) and the [version 16 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16) (`lastUpdated: 2026-08-25`).
> Target: **Next.js 16.3.4**. Documentation-verified — **no sandbox run**.

**Prefetching is the reason a Next.js navigation can feel instant despite the route being rendered on a server: by the time the click happens, the payload is already in the browser. Three facts decide whether it works for you. It runs **only in production** — the reference says so twice, and it is the single most common reason someone concludes prefetching is broken while staring at `next dev`. How *much* of a route is fetched depends on whether the route is static, dynamic, or dynamic with a `loading.js` boundary, and a dynamic route with no boundary is skipped entirely. And since Next.js 16 the shape of the traffic has changed: layout deduplication and incremental prefetching produce **more individual requests at much lower total transfer**, which is a deliberate trade you will see in the network panel before anyone tells you about it.**

## What is actually being fetched

> *"When navigating between routes, the browser requests assets for the page like HTML and JavaScript files. Prefetching is the process of fetching these resources *ahead* of time, before you navigate to a new route."*

Route-based code splitting is the precondition:

> *"Next.js automatically splits your application into smaller JavaScript chunks based on routes. Instead of loading all the code upfront like traditional SPAs, only the code needed for the current route is loaded. This reduces the initial load time while other parts of the app are loaded in the background. By the time you click the link, the resources for the new route have already been loaded into the browser cache."*

The payload differs between the first load and later ones:

> *"During the initial navigation, the browser fetches the HTML, JavaScript, and React Server Components (RSC) Payload. For subsequent navigations, the browser will fetch the RSC Payload for Server Components and JS bundle for Client Components."*

So a prefetch of a route you have not visited is fetching the RSC payload — the serialised output of the Server Components — plus the client JavaScript that route needs. It is not an HTML page and it is not a data API call; it is the rendered server tree.

The payoff is the client-side transition: *"When navigating to the new page, there's no full page reload or browser loading spinner."*

## What triggers it

> *"Next.js prefetches automatically in production. As each `<Link>` enters the viewport, Next.js prefetches the route behind it and schedules the work so a page full of links doesn't flood the network."*

The `<Link>` reference adds the second trigger and the retry:

> *"Prefetching happens when a `<Link />` component enters the user's viewport (initially or through scroll). Next.js prefetches and loads the linked route (denoted by the `href`) and its data in the background to improve the performance of client-side navigations. If the prefetched data has expired by the time the user hovers over a `<Link />`, Next.js will attempt to prefetch it again."*

The queue that keeps a link-heavy page from saturating the network is documented as four ordered rules:

> *"Next.js maintains a small task queue, which prefetches in the following order:"*
> 1. *"Links in the viewport"*
> 2. *"Links showing user intent (hover or touch)"*
> 3. *"Newer links replace older ones"*
> 4. *"Links scrolled off-screen are discarded"*

> *"The scheduler prioritizes likely navigations while minimizing unused downloads."*

Rules 3 and 4 are the ones worth remembering, because they explain behaviour that looks like a bug: a link you scrolled past may never have been prefetched at all, and a prefetch that started can be superseded by a newer one. Nothing here guarantees that a given link *will* be warm — prefetching is best-effort scheduling, not a promise.

## Static versus dynamic

This is the table that decides how a route behaves, and it is stated without Cache Components in play:

> *"Without Cache Components, a static route is prefetched in full, while a dynamic route is skipped unless it has a `loading.js` boundary."*

| | **Static page** | **Dynamic page** |
| --- | --- | --- |
| **Prefetched** | Yes, full route | No, unless `loading.js` |
| **Client Cache TTL** | 5 min (default) | Off, unless enabled |
| **Server roundtrip on click** | No | Yes, streamed after shell |

The `<Link>` reference says the same thing from the prop's point of view:

> *"**`\"auto\"` or `null` (default)**: Prefetch behavior depends on whether the route is static or dynamic. For static routes, the full route will be prefetched (including all its data). For dynamic routes, the partial route down to the nearest segment with a `loading.js` boundary will be prefetched."*

And the payload table makes the `loading.js` effect concrete:

| **Context** | **Prefetched payload** | **Client Cache TTL** |
| --- | --- | --- |
| No `loading.js` | Entire page | 5 min (`staleTimes.static`) |
| With `loading.js` | Layout to first loading boundary | Off by default (`staleTimes.dynamic`) |

The rationale for skipping is explicit, and it is about server cost rather than bandwidth:

> *"By skipping or partially prefetching dynamic routes, Next.js avoids unnecessary work on the server for routes the users may never visit. However, waiting for a server response before navigation can give the users the impression that the app is not responding."*

Which is why `loading.js` is the recommended intervention, not a `prefetch` prop:

> *"We recommend adding `loading.tsx` to dynamic routes to enable partial prefetching, trigger immediate navigation, and display a loading UI while the route renders."*

```tsx title="app/blog/[slug]/loading.tsx"
export default function Loading() {
  return <LoadingSkeleton />
}
```

Adding that one file changes a dynamic route from *"not prefetched, click blocks on the server"* to *"layout and skeleton already in the browser, navigation is immediate, content streams in"*.

The adjacent fix is `generateStaticParams`, for the case where a route could have been static and was not:

> *"If a dynamic segment could be prerendered but isn't because it's missing `generateStaticParams`, the route will fallback to dynamic rendering at request time."*

## The client cache

> *"Next.js stores prefetched React Server Component payloads in memory, keyed by route segments. When navigating between sibling routes (e.g. `/dashboard/settings` → `/dashboard/analytics`), Next.js reuses the parent layout and only fetches the updated leaf page."*

Segment-keyed, not URL-keyed. That is why moving between siblings under a shared layout is cheap, and it is the same property that Next.js 16 generalised into prefetching itself.

## 🔴 Next.js 16 changed the shape of the traffic

> *"**Next.js 16** includes a complete overhaul of the routing and navigation system, making page transitions leaner and faster. This optimizes how Next.js prefetches and caches navigation data:"*
> *"**Layout deduplication**: When prefetching multiple URLs with a shared layout, the layout is downloaded once."*
> *"**Incremental prefetching**: Next.js only prefetches parts not already in cache, rather than entire pages."*

> *"These changes require **no code modifications** and are designed to improve performance across all apps."*
> *"However, you may see more individual prefetch requests with much lower total transfer sizes. We believe this is the right trade-off for nearly all applications."*

Read the last sentence as a prediction about your monitoring. A dashboard that counts requests will show a regression; one that measures bytes will show an improvement. Both are the same change. The upgrade guide invites reports if the request count causes real problems, which is a fair signal that it is a known cost rather than an oversight.

Because fine-grained prefetching means many small responses, 16.3 added a correction — **prefetch inlining**, which bundles small segment responses into one request and is on by default. That is a whole subject and it has its own page: [13 · Prefetch inlining](13-prefetch-inlining.md).

## 🔴 Development does not prefetch

Both primary sources state it, in different words:

> *"**Prefetching is only enabled in production**."*
> *"Automatic prefetching runs only in production."*

Everything downstream of that is why people think prefetching is broken:

- **Every navigation blocks in `next dev`.** Nothing is warm, so every click waits on the dev server, which is also compiling on demand. The app feels slower locally than it will in production, and the instinct is to go looking for a prefetch bug that does not exist.
- **`useLinkStatus` always fires locally and may never fire in production.** If the route is prefetched, the pending state is skipped — so a loading hint you tuned in development can be invisible to users. That trap is [13b · Prefetch control and link status](13b-prefetch-control-and-link-status.md).
- **`useSearchParams` does not suspend in development.** *"In development, routes are rendered on-demand, so `useSearchParams` doesn't suspend and things may appear to work without `Suspense`"* — and then the production build fails. See [04j](04j-usepathname-and-usesearchparams.md).

The through-line: `next dev` renders on demand and does not prefetch, so **any behaviour that depends on prerendering or on a warm cache is untested by your local experience.** Verify prefetching against a production build, and use the dev tools' static/dynamic indicator to check what a route is: *"In development mode, you can use the Next.js Devtools to identify if the route is static or dynamic."*

## What makes a transition slow anyway

Four documented causes, and none of them is "prefetching is off":

1. **Dynamic routes without `loading.tsx`** — nothing is prefetched, so the click waits on the server.
2. **Dynamic segments without `generateStaticParams`** — a route that could have been prerendered falls back to request-time rendering.
3. **Slow networks** — *"On slow or unstable networks, prefetching may not finish before the user clicks a link. This can affect both static and dynamic routes. In these cases, the `loading.js` fallback may not appear immediately because it hasn't been prefetched yet."*
4. **Hydration not completed** — *"`<Link>` is a Client Component and must be hydrated before it can prefetch routes. On the initial visit, large JavaScript bundles can delay hydration, preventing prefetching from starting right away."* React's Selective Hydration mitigates it; reducing bundle size and moving logic to the server fixes it.

The fourth is the one that hides. Prefetching on the very first page a user lands on is gated on that page's JavaScript being ready, so a heavy landing page produces slow *first* navigations no matter how well the rest of the app is configured.

## Where the rest of this subject lives

This page is the mechanism. Four adjacent pages own the parts it deliberately does not re-teach:

| Question | Page |
| --- | --- |
| How do I turn prefetching up, down or off per link or per destination? | [13b · Prefetch control and link status](13b-prefetch-control-and-link-status.md) |
| Why are there so many small prefetch requests, and what are `maxSize` / `maxBundleSize`? | [13 · Prefetch inlining](13-prefetch-inlining.md) |
| What changes when Partial Prefetching and the App Shell are enabled? | [10 · Instant Navigations](10-instant-navigations/README.md) |
| How do I prefetch a route with no visible link? | [04f · Prefetching by hand](04f-prefetching-by-hand-and-ejecting-from-link.md) |

One forward pointer from the guide, because it reframes the default: with [`partialPrefetching`](https://nextjs.org/docs/app/api-reference/config/next-config-js/partialPrefetching) enabled — which requires Cache Components — `<Link>` defaults to prefetching a per-route **App Shell** rather than the full page, *"so a page with many links makes fewer prefetch requests than prefetching each route in full."* The static/dynamic table above is the pre-Cache-Components model.

## Gotchas

**★ Symptom: nothing is prefetched and the network panel is empty, in `next dev`.** Cause: *"Prefetching is only enabled in production."* Fix: there is nothing to fix in the code — test against a production build.

```bash
next build && next start
```

**★ Symptom: analytics records page views for pages nobody visited.** Cause: an impure layout or page. *"If your layouts or pages are not pure and have side-effects (e.g. tracking analytics), Next.js might run them when the route is prefetched, not when the user visits the page."* Fix: move the side effect into a Client Component effect, which only runs on a real visit.

```tsx title="app/ui/analytics-tracker.tsx"
'use client'

import { useEffect } from 'react'
import { trackPageView } from '@/lib/analytics'

export function AnalyticsTracker() {
  useEffect(() => {
    trackPageView()
  }, [])

  return null
}
```

```tsx title="app/dashboard/layout.tsx"
import { AnalyticsTracker } from '@/app/ui/analytics-tracker'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <AnalyticsTracker />
      {children}
    </div>
  )
}
```

**★ Symptom: a dynamic route feels slow to navigate to even though every other route is instant.** Cause: a dynamic route with no `loading.js` is not prefetched at all — the click waits for a server render. Fix: add `loading.tsx`, which enables partial prefetching of the layout down to the boundary and makes the navigation immediate.

```tsx title="app/blog/[slug]/loading.tsx"
export default function Loading() {
  return <LoadingSkeleton />
}
```

**★ Symptom: after upgrading to Next.js 16, prefetch request counts went up and someone filed a performance regression.** Cause: layout deduplication and incremental prefetching split the work into smaller pieces — *"you may see more individual prefetch requests with much lower total transfer sizes."* Fix: measure bytes, not requests. If the request count is genuinely a problem, prefetch inlining is the dial, and it is already on by default — see [13](13-prefetch-inlining.md).

**★ Symptom: a route that should be static is being treated as dynamic and skipped.** Cause: a dynamic segment with no `generateStaticParams`, so it falls back to dynamic rendering at request time. Fix: enumerate the params at build time.

```tsx title="app/blog/[slug]/page.tsx"
export async function generateStaticParams() {
  const posts = await fetch('https://.../posts').then((res) => res.json())
  return posts.map((post: { slug: string }) => ({ slug: post.slug }))
}
```

**★ Symptom: an infinite-scroll table with hundreds of links saturates the network.** Cause: every `<Link>` entering the viewport is a prefetch candidate; the scheduler bounds it, but hundreds of rows still generate work for routes nobody will open. Fix: opt those links out, or defer to hover so only likely destinations are warmed.

```tsx title="app/ui/hover-prefetch-link.tsx"
'use client'

import Link from 'next/link'
import { useState } from 'react'

export function HoverPrefetchLink({ href, children }: { href: string; children: React.ReactNode }) {
  const [active, setActive] = useState(false)
  return (
    <Link href={href} prefetch={active ? null : false} onMouseEnter={() => setActive(true)}>
      {children}
    </Link>
  )
}
```

**★ Symptom: the first navigation after a cold load is slow, and every one after it is instant.** Cause: *"`<Link>` is a Client Component and must be hydrated before it can prefetch routes"* — a heavy landing bundle delays hydration and therefore delays the first prefetch. Fix: shrink the entry bundle and move work to the server; the guide names `@next/bundle-analyzer` and the Server/Client Components split as the two levers.

**★ Symptom: a link you scrolled past was never prefetched.** Cause: the scheduler discards links scrolled off-screen and lets newer links replace older ones. Fix: nothing, usually — that is the scheduler doing its job. If a specific destination must be warm regardless of scroll position, prefetch it explicitly with `router.prefetch` ([04f](04f-prefetching-by-hand-and-ejecting-from-link.md)).

**Symptom: a prefetched dynamic route is re-fetched on every hover.** Cause: the Client Cache TTL for dynamic routes is *"Off, unless enabled"* — only static prefetches get the 5-minute default. Fix: configure [`staleTimes`](https://nextjs.org/docs/app/api-reference/config/next-config-js/staleTimes) deliberately if a short-lived dynamic cache is acceptable for your data, and accept the staleness that buys.

**Symptom: replacing `<Link>` with `<a>` "for simplicity" made the whole app feel slower.** Cause: an `<a>` is invisible to prefetching and produces a full document load. The guide's own example labels the two lines: `{/* Prefetched when the link is hovered or enters the viewport */}` above the `<Link>`, `{/* No prefetching */}` above the `<a>`. Fix: keep `<Link>`.

**Symptom: a `<Link>` behind a proxy rewrite prefetches the wrong route.** Cause: the display URL and the real route differ and Next.js will not call the proxy to resolve it. Fix: `<Link as="/dashboard" href={resolvedPath}>` — see [04](04-navigation-mechanics-link-userouter-redirect-notfound.md).

**Symptom: users on flaky connections still see a blank pause on navigation despite `loading.js`.** Cause: *"the `loading.js` fallback may not appear immediately because it hasn't been prefetched yet."* Fix: give immediate local feedback with `useLinkStatus` rather than assuming the skeleton will be there — [13b](13b-prefetch-control-and-link-status.md) covers the hook and its layout-shift trap.

## Interview questions

**★ What does a prefetch actually download?**
For a route the user has not visited, the RSC payload — the serialised output of that route's Server Components — plus the JavaScript chunk for its Client Components, because Next.js code-splits per route. On the very first navigation of a session the browser also fetches HTML. It is not a rendered HTML page for a client-side transition, and it is not your data API; it is the server's render output, which is why an impure layout can have its side effects executed by a prefetch.

**★ Why do people think prefetching is broken?**
Because they are watching `next dev`. Both primary sources state that prefetching is only enabled in production, so locally every navigation blocks on the dev server. The same environment difference explains two adjacent surprises: `useLinkStatus` always shows a pending state locally and may never show one in production, and `useSearchParams` does not suspend in development but fails the production build without a `Suspense` boundary. Anything that depends on prerendering or a warm cache is untested by local experience.

**★ How much of a route gets prefetched?**
It depends on the route. A static route is prefetched in full, including its data, and its payload sits in the Client Cache for five minutes by default. A dynamic route is skipped entirely — unless it has a `loading.js` boundary, in which case the partial route from the layout down to that boundary is prefetched, with the client cache off by default. The reason for skipping is server cost: Next.js avoids rendering routes users may never visit. With Partial Prefetching and Cache Components enabled the model changes to a per-route App Shell.

**★ A dynamic route feels unresponsive on click. What is the first thing you add, and why is it not a `prefetch` prop?**
`loading.tsx` in that route's folder. Without it the route is not prefetched at all, so the click waits for a full server render before anything changes on screen. With it, the layout and the skeleton are already in the browser, the navigation commits immediately, and the content streams into the `<Suspense>` boundary Next.js wraps the page in. A `prefetch` prop cannot help, because the framework's reason for skipping was the server cost of rendering a route nobody may visit — `loading.js` changes what there is to prefetch, not how eagerly it is fetched.

**★ Next.js 16 raised our prefetch request count. Is that a regression?**
Not by itself. The 16 routing overhaul introduced layout deduplication — a shared layout is downloaded once when prefetching several URLs — and incremental prefetching, which fetches only the parts not already in cache. The upgrade guide predicts exactly this outcome: more individual prefetch requests at much lower total transfer, described as the right trade-off for nearly all applications. Judge it on bytes. If request volume is a genuine cost on your infrastructure, prefetch inlining bundles small segment responses and is already enabled by default.

**★ Why does a page that renders analytics in a layout produce inflated page views?**
Because a prefetch renders the route on the server. An impure layout that calls a tracking function at module or render time runs during that render, so the event fires for a route the user may never open. The documented fix is to move the side effect into a Client Component's `useEffect`, which runs only when the component actually mounts in the browser — a real visit — or into a Server Action triggered from a Client Component.

**★ Describe the prefetch scheduler.**
A small task queue with four ordered rules: links in the viewport first, then links showing user intent through hover or touch, newer links replacing older ones, and links scrolled off-screen discarded. Its purpose is to prioritise likely navigations while minimising unused downloads — which also means prefetching is best-effort. A given link may never be prefetched because it was superseded or scrolled past, so code that assumes a route is warm is assuming something the scheduler never promised.

**Your first navigation after a cold load is always slow. Where do you look?**
At hydration, not at prefetching configuration. `<Link>` is a Client Component and cannot prefetch until it has hydrated, so a large entry bundle delays every prefetch on the landing page. React's Selective Hydration reduces the damage; the real fixes are the two the guide names — analyse and shrink the bundle, and move work from client to server so there is less to hydrate.

**Why is the Client Cache keyed by route segment rather than by URL?**
So that navigating between siblings can reuse what is already there. Moving from `/dashboard/settings` to `/dashboard/analytics` reuses the cached parent layout and fetches only the changed leaf. Keying by URL would make every distinct URL a cache miss for content that is identical, and it is the same insight Next.js 16 generalised into layout deduplication across *prefetches*, not just navigations.

---

← [04k · Query state in practice](04k-query-state-in-practice.md) · [Chapter 2 overview](01-explanation.md) · Next → **05b · The native View Transitions API** *(not written yet)*
