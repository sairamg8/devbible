---
title: "Because the filter lives in the URL, the framework can render the destination with that filter resolved before the click — and because each such link costs a server invocation, prefetch={true} is a per-link decision, not a default"
sidebar_label: "03d · Prefetching, and opting out"
sidebar_position: 122
description: "What Partial Prefetching resolves from a link's URL data, the difference between the App Shell and a route's static shell, the four prefetch values, and the two documented ways to opt a route out of prerendering."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-05 against [Caching](https://nextjs.org/docs/app/getting-started/caching) (`lastUpdated: 2026-08-25`),
> [`Link`](https://nextjs.org/docs/app/api-reference/components/link) (`lastUpdated: 2026-08-25`),
> [`useSearchParams`](https://nextjs.org/docs/app/api-reference/functions/use-search-params) (`lastUpdated: 2026-07-14`) and
> [Next.js encountered URL data in a Client Component outside of Suspense](https://nextjs.org/docs/messages/blocking-prerender-client-hook).
> Target: **Next.js 16.3.4** App Router · **React 19.2.8**.
> Documentation-verified; **no sandbox run**.

**This is the payoff that makes URL state genuinely faster than client state rather than merely more correct: a filter in the query string is knowable to the router *before the user clicks*, so the framework can render the destination tree with those `searchParams` already resolved and have the filtered results sitting in the browser at click time. Nothing equivalent is possible for `useState`, because nothing outside the component knows what value is coming. The catch is stated in the same paragraph of the docs that promises the benefit — each such link costs a server invocation — which turns `prefetch={true}` into a judgement about which one or two links a user is actually likely to click.**

## The default is the App Shell; URL-dependent content is opt-in

> *"With Partial Prefetching enabled, the router prefetches each route's App Shell by default. The App Shell includes static content and session data derived from `cookies()` and `headers()`. To also prefetch cached content that depends on a link's **URL data**, such as `searchParams` or dynamic `params`, set `prefetch={true}` on that link."*
> — [Caching, Prefetching](https://nextjs.org/docs/app/getting-started/caching#prefetching)

So there are two artefacts and they are easy to conflate:

| | Static shell | App Shell |
|---|---|---|
| What it is | What a route prerenders when its inputs are known | The reusable, URL-independent version of the same shell |
| Param-specific content | Present, when `generateStaticParams` supplied the params | Left behind its `Suspense` fallbacks |
| Filled in later by | — | ISR, after the first visit |
| Prefetched by default | — | ✅ with Partial Prefetching |

> *"When a route's dynamic params are known, the shell contains that concrete content, and any remaining uncached or runtime data still streams behind its `<Suspense>` fallback. When the params aren't known, the reusable, URL-independent version is the **App Shell**: the same static shell with the param-specific parts left behind their fallbacks."*
> — [Caching, Prerendering](https://nextjs.org/docs/app/getting-started/caching#prerendering)

The consequence for URL state: the default prefetch gets you the frame — nav, header, filter bar, skeletons — but not the *filtered list*, because the list depends on the link's query string, and that is exactly what `prefetch={true}` unlocks.

## What `prefetch={true}` actually renders

> *"With `<Link prefetch={true}>` pointing at a Partial Prefetching route, Next.js renders that route's component tree again at prefetch time, this time with the destination URL resolved. The same rules apply, but more of the tree resolves now that its `searchParams` and `params` are in scope"*
> — [Caching, Prefetching](https://nextjs.org/docs/app/getting-started/caching#prefetching)

Three things can ride that render, and the list is exhaustive:

> *"`use cache` called with values extracted from runtime APIs (passed as arguments) joins the per-link prefetch"*
> *"`use cache: private` executes on the server, reads runtime data directly, and caches the result in the browser as part of the per-link prefetch"*
> *"`<Suspense>` fallbacks stay in the prefetched UI while uncached content streams at request time"*
> — same section

And the concrete promise:

> *"When a `<Link>` to `/search?q=shoes` is prefetched, the framework resolves `searchParams` from the link's URL, so the cached `search` result is included in the runtime prerender before the click. The browser then reuses it until its `stale` time passes or the `searchParams` change."*
> — same section

**Read the first bullet twice.** Nothing uncached joins a prefetch. If none of the destination's query-derived data has a lifetime, `prefetch={true}` renders the same fallbacks the default would and the click still waits on the server. Prefetching amplifies a cache; it is not a cache. The caching half is [03c](03c-caching-query-driven-routes.md), and it comes first.

## The cost, stated by the docs

> *"This per-link prefetch includes cached content that resolves after the destination URL is known. It costs a server invocation per prefetchable link."*
> — [Caching, Prefetching](https://nextjs.org/docs/app/getting-started/caching#prefetching)

A filter bar is precisely the place where this bites, because filter bars have many links and users click one of them:

```tsx filename="app/[tenant]/board/filter-bar.tsx"
import Link from 'next/link'

export function FilterBar({ active }: { active: string }) {
  return (
    <nav aria-label="Filter by status">
      {/* the default view, and the one most users return to */}
      <Link href="?status=open" prefetch={true} aria-current={active === 'open' ? 'page' : undefined}>
        Open
      </Link>
      {/* the long tail — leave these on the default */}
      <Link href="?status=blocked" aria-current={active === 'blocked' ? 'page' : undefined}>Blocked</Link>
      <Link href="?status=done" aria-current={active === 'done' ? 'page' : undefined}>Done</Link>
      <Link href="?status=archived" aria-current={active === 'archived' ? 'page' : undefined}>Archived</Link>
    </nav>
  )
}
```

Twelve chips all marked `prefetch={true}`, all in the viewport, is twelve server renders before the user has done anything at all.

## The four values of `prefetch`

> *"**`"auto"` or `null` (default)**: Prefetch behavior depends on whether the route is static or dynamic. For static routes, the full route will be prefetched (including all its data). For dynamic routes, the partial route down to the nearest segment with a `loading.js` boundary will be prefetched."*
> *"**`true`**: The full route is prefetched for both static and dynamic routes. With Partial Prefetching enabled, the prefetch includes the App Shell and cached content that depends on the link's URL data."*
> *"`false`: Prefetching will never happen both on entering the viewport and on hover."*
> — [`Link`, `prefetch`](https://nextjs.org/docs/app/api-reference/components/link#prefetch)

And a default that changes under a config flag:

> *"**With Partial Prefetching enabled** (`partialPrefetching: true`): the default changes. `auto` prefetches the per-route App Shell (the route's static and cached content) instead of the full page."*
> — same section

Two operational facts from the same section that explain most "prefetching does not work" reports:

> *"Prefetching happens when a `<Link />` component enters the user's viewport (initially or through scroll)."*

> *"**Prefetching is only enabled in production**."*

That second sentence means you cannot evaluate any of this in `next dev`. A filter bar that feels instant locally proves nothing.

## Giving the user feedback during the navigation

A prefetched click is instant; an unprefetched one is not, and the honest thing is to say so. `useLinkStatus` reports the pending state of the enclosing `<Link>`:

```tsx filename="app/ui/link-spinner.tsx"
'use client'

import { useLinkStatus } from 'next/link'

export function LinkSpinner() {
  const { pending } = useLinkStatus()
  return <span aria-hidden className={`link-hint ${pending ? 'is-pending' : ''}`} />
}
```

```tsx filename="app/[tenant]/board/filter-bar.tsx"
<Link href="?status=blocked">
  Blocked
  <LinkSpinner />
</Link>
```

> *"To improve perceived performance, you can use the `useLinkStatus` hook to show immediate feedback while the transition is in progress."*
> — [Linking and Navigating](https://nextjs.org/docs/app/getting-started/linking-and-navigating)

> *"You can 'debounce' the hint by adding an initial animation delay (e.g. 100ms) and starting as invisible (e.g. `opacity: 0`). This means the loading indicator will only be shown if the navigation takes longer than the specified delay."*
> — same section

```css filename="app/globals.css"
.link-hint {
  opacity: 0;
}
.link-hint.is-pending {
  animation: link-hint-in 150ms 100ms forwards;
}
@keyframes link-hint-in {
  to { opacity: 1; }
}
```

`useLinkStatus` covers `<Link>` navigations only. For a filter driven by `router.replace` there is no enclosing link, and the pending state comes from a transition instead — see [03e](03e-url-as-state-reading-from-a-client-component.md).

## Opting a route out on purpose

Sometimes the route is genuinely per-request and the shell is not worth chasing — an admin audit log, an internal report whose entire body depends on who is asking. Two documented escapes, and they are not interchangeable.

**Wait for the request, semantically:**

```tsx filename="app/admin/audit/page.tsx"
import { connection } from 'next/server'
import { AuditFilters } from './audit-filters'

export default async function Page() {
  await connection()
  return (
    <>
      <AuditFilters />
      <h1>Audit log</h1>
    </>
  )
}
```

> *"Previously, setting `export const dynamic = 'force-dynamic'` on the page was used to force dynamic rendering. Prefer using `connection()` instead, as it semantically ties dynamic rendering to the incoming request."*
> — [`useSearchParams`, Dynamic Rendering](https://nextjs.org/docs/app/api-reference/functions/use-search-params#dynamic-rendering)

**Or accept a blocking route**, the escape hatch offered when a client navigation hook genuinely cannot be wrapped:

```tsx filename="app/admin/audit/page.tsx"
export const instant = false
```

— one of the two documented fixes on [Next.js encountered URL data in a Client Component outside of Suspense](https://nextjs.org/docs/messages/blocking-prerender-client-hook), where the other is *"Wrap in or move into Suspense"*. Reach for it as a commented decision, never to silence an insight you did not read.

## Gotchas

**★ Symptom: adding `prefetch={true}` to every filter chip made the page slower and the server hotter.** Cause: each prefetchable link with resolved URL data costs a server invocation, and every chip in the viewport fires on render. Fix: prefetch the likely next click only.

```tsx
<Link href="?status=open" prefetch={true}>Open</Link>   {/* likely next click */}
<Link href="?status=blocked">Blocked</Link>              {/* default */}
<Link href="?status=archived">Archived</Link>            {/* default */}
```

**★ Symptom: prefetch is configured, the link has `prefetch={true}`, and the click is still slow.** Cause: nothing on the destination had a cache lifetime, so there was nothing for the prefetch render to resolve — only `use cache` results, `use cache: private` results and `Suspense` fallbacks join a prefetch. Fix: give the query-derived data a lifetime first.

```tsx
async function search(q: string | string[] | undefined) {
  'use cache'                 // ✅ now there is something for the prefetch to carry
  return db.tasks.search(q)
}
```

**★ Symptom: prefetching "does not work" and you have spent an afternoon on it in `next dev`.** Cause: prefetching is only enabled in production. Fix: measure it in a production build, and never conclude anything about navigation speed from the dev server.

```bash
next build && next start
```

**★ Symptom: prefetched results are stale after a mutation.** Cause: the browser reuses the prefetched entry until its `stale` window elapses or the `searchParams` change; a server-side mutation does not reach into it. Fix: invalidate on the server side of the action so the next render produces a fresh payload — the choice of which invalidation function is in [10b](10b-refresh-against-the-alternatives.md).

**★ Symptom: a colleague "fixed" a prerender insight with `export const dynamic = 'force-dynamic'` and the whole route stopped prerendering.** Cause: the route-level flag is a sledgehammer that opts the entire tree out, including parts that had nothing to do with the query string. Fix: prefer `await connection()` when you mean "wait for the request", and a `Suspense` seam when you mean "this one leaf is request-time".

```tsx
// ❌ export const dynamic = 'force-dynamic'
import { connection } from 'next/server'

export default async function Page() {
  await connection()            // ✅ tied to the request, scoped to this page
  return <AuditLog />
}
```

**★ Symptom: a spinner flashes on every single filter click, including the instant ones.** Cause: the pending indicator renders immediately, so a 30 ms navigation still paints it. Fix: delay the indicator's animation so it only becomes visible if the navigation is genuinely slow — the `100ms` delay pattern above.

**★ Symptom: `useLinkStatus` returns `pending: false` for a filter change you drive with `router.replace`.** Cause: the hook reports the status of an enclosing `<Link>`, and there is no link in that interaction. Fix: get the pending state from the transition that wraps the navigation instead — [03e](03e-url-as-state-reading-from-a-client-component.md).

## Interview questions

**★ A colleague says "URL state is slower than client state because it hits the server". Is that true?**
Not in the App Router, and often the opposite. A URL-state navigation can be prefetched: with `<Link prefetch={true}>` the framework renders the destination tree with the target URL's `searchParams` already resolved, so a cached result for that filter can be in the browser before the click. Client state cannot be prefetched at all, because nothing outside the component knows what value the user is about to choose. What *is* true is that URL state costs a round trip when the result is neither cached nor prefetched, and that per-link prefetching costs a server invocation per link — so it is a caching problem, not a location problem.

**★ What is the difference between the "static shell" and the "App Shell"?**
The static shell is what a specific route prerenders when its inputs are known — for a route whose dynamic params come from `generateStaticParams`, it includes the concrete param-specific content, with any remaining uncached data still behind its fallbacks. The App Shell is the reusable, URL-independent version: the same shell with the param-specific parts left behind their fallbacks, used when the params are not known ahead of time, with ISR filling in the concrete versions after the first visit. The distinction matters because Partial Prefetching prefetches the App Shell by default, which is why prefetching content that depends on a link's query string needs the explicit `prefetch={true}` opt-in.

**★ You enabled `prefetch={true}` and the navigation is still slow. What did you get wrong?**
Probably nothing about the link. A prefetch render can only carry what has a lifetime: `use cache` results resolvable from the link's URL data, `use cache: private` results cached in the browser, and `Suspense` fallbacks. If none of the destination's data is cached, the prefetch renders the same fallbacks a default prefetch would and the click still waits on the server. `prefetch={true}` amplifies a cache; it is not a cache. The other possibility is the opposite failure: you set it on every link in a filter bar and the resulting server invocations are themselves why the app feels slow.

**★ Why can you not evaluate prefetching in development?**
Because prefetching is only enabled in production — the docs state it in bold. In `next dev` routes are compiled and rendered on demand, so a navigation's cost is dominated by compilation rather than by data, and no prefetch is issued to hide it. Any conclusion drawn from the dev server about navigation speed, prefetch behaviour, or whether a `Suspense` boundary is doing its job is unreliable in both directions: things appear to work that will fail in production, and things appear slow that will be instant.

**★ How do you show a user that a filter change is in flight?**
For a `<Link>`-driven filter, `useLinkStatus` inside the link gives you a `pending` boolean scoped to that link, so the chip they clicked can show its own indicator rather than a global bar. Render the indicator with a delayed animation — invisible for the first ~100 ms — so it never flashes on a prefetched click that completes in 30 ms. For a filter driven by `router.push`/`router.replace` there is no enclosing link and `useLinkStatus` will not help; the pending state has to come from the transition wrapping the navigation.

**★ When is opting the route out of prerendering the right answer, and how do you do it?**
When the route is genuinely per-request and there is no meaningful shell to produce — an admin audit view, an internal report, anything where the entire body depends on who is asking. `await connection()` at the top of the page is preferred because it ties the decision to the incoming request semantically, rather than the older `export const dynamic = 'force-dynamic'` flag which opts out the whole tree including parts that would have prerendered fine. For a client navigation hook that genuinely cannot be wrapped, `export const instant = false` is the documented blocking-route escape. All three are decisions to be commented, not reflexes for silencing a dev-overlay insight.

---

← [03c · Caching query-driven routes](03c-caching-query-driven-routes.md) · [Chapter 8 overview](01-explanation.md) · Next → [03e · Reading the URL from a client component](03e-url-as-state-reading-from-a-client-component.md)
