---
title: "loading.tsx is nothing but a Suspense boundary Next.js writes for you, which is why it covers the page and every segment below it and is structurally incapable of covering the layout in its own folder"
sidebar_label: "01d · loading.tsx"
sidebar_position: 102
description: "What loading.tsx actually wraps, why a slow layout defeats it, the 200 status code streaming forces, and when to write a manual Suspense boundary instead."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against [`loading.js`](https://nextjs.org/docs/app/api-reference/file-conventions/loading) (`lastUpdated: 2026-06-08`) and [`layout.js` › Interaction with loading.js](https://nextjs.org/docs/app/api-reference/file-conventions/layout#interaction-with-loadingjs) (`2026-05-27`).
> Target: **Next.js 16.3.4** · `loading` introduced in v13.0.0. Documentation-verified — **no sandbox run**.

**`loading.tsx` is sugar. Putting the file in a folder makes Next.js wrap that segment's page — and everything nested below it — in a React `Suspense` boundary whose fallback is your component. Everything surprising about it is a consequence of *where* that boundary is placed in the composition stack: it is inside the layout, so it cannot cover the layout; it is outside `page.tsx`, so it covers the whole page rather than the slow part of it; and because a fallback rendering is what starts the response streaming, the HTTP status code is already committed by the time your page decides it wanted to be a 404.**

## What it wraps, exactly

> *"In the same folder, `loading.js` will be nested inside `layout.js`. It will automatically wrap the `page.js` file and any children below in a `<Suspense>` boundary."*
> *"In the component hierarchy, `loading.js` wraps `not-found.js`, `page.js`, and nested `layout.js` files in a `<Suspense>` boundary. It does **not** wrap the `layout.js`, `template.js`, or `error.js` in the same segment."*
> — [`loading.js` › Instant Loading States](https://nextjs.org/docs/app/api-reference/file-conventions/loading#instant-loading-states)

```
app/dashboard/
├── layout.tsx    ← NOT covered by this segment's loading.tsx
├── template.tsx  ← NOT covered
├── error.tsx     ← NOT covered
├── loading.tsx   ← the boundary starts here
├── page.tsx      ← covered
└── reports/
    ├── layout.tsx  ← covered (a nested layout IS below the boundary)
    └── page.tsx    ← covered
```

The file itself takes no props at all:

> *"Loading UI components do not accept any parameters."*

```tsx title="app/dashboard/loading.tsx"
import { CardSkeleton } from '@/app/ui/skeletons'

export default function Loading() {
  return (
    <div className="grid gap-4">
      <CardSkeleton />
      <CardSkeleton />
      <CardSkeleton />
    </div>
  )
}
```

It is a Server Component by default and *"can also be used as a Client Component through the `"use client"` directive"* — worth knowing, but a fallback that needs client JavaScript defeats the point of an instant skeleton.

## Why the fallback is instant

> *"The Fallback UI is prefetched, making navigation immediate unless prefetching hasn't completed."*
> *"Navigation is interruptible, meaning changing routes does not need to wait for the content of the route to fully load before navigating to another route."*
> *"Shared layouts remain interactive while new route segments load."*

The fallback is part of what the router prefetches, so the skeleton is already in the client when the click happens. That is the difference between `loading.tsx` and a spinner you render from client state: the spinner needs a round trip to know it should exist.

## The slow-layout trap

This is the single most common "my loading.tsx does nothing" report, and the docs are unusually direct about it:

> *"Because `loading.js` sits below `layout.js` in the component hierarchy, it cannot show a fallback for uncached or runtime data access in the layout itself, such as calling `cookies()`, `headers()`, or making uncached fetches."*
> *"**Without Cache Components:** The navigation will block until the layout finishes rendering, and the `loading.js` fallback will not be shown."*
> *"**With Cache Components:** `loading.js` is treated as a regular `<Suspense>` boundary rather than a special prefetch marker. Uncached or runtime data access in the layout must be explicitly wrapped in its own `<Suspense>` boundary, otherwise Next.js guides you with a build-time error. The static shell streams immediately, and the uncached content swaps in as it resolves."*
> — [`layout.js` › Interaction with `loading.js`](https://nextjs.org/docs/app/api-reference/file-conventions/layout#interaction-with-loadingjs)

Note the second bullet carefully: with Cache Components enabled the failure mode changes from *silently slow* to *a build-time error*, which is a genuine improvement — the framework tells you instead of letting the navigation hang.

Both fixes are documented:

```tsx title="app/dashboard/layout.tsx — fix 1: bound the layout's own work"
import { Suspense } from 'react'
import { NavSkeleton } from './nav-skeleton'
import { DashboardNav } from './dashboard-nav'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense fallback={<NavSkeleton />}>
        <DashboardNav />
      </Suspense>
      <main>{children}</main>
    </>
  )
}
```

Fix 2 is to move the uncached fetch out of `layout.tsx` and into `page.tsx`, where `loading.tsx` can cover it.

## `loading.tsx` versus a hand-written boundary

`loading.tsx` is coarse by construction: one boundary, wrapping the whole page. When half the page is fast and half is slow, that is the wrong granularity — the fast half is held hostage.

```tsx title="app/dashboard/page.tsx"
import { Suspense } from 'react'
import { PostFeed, Weather } from './components'

export default function Posts() {
  return (
    <section>
      <Suspense fallback={<p>Loading feed...</p>}>
        <PostFeed />
      </Suspense>
      <Suspense fallback={<p>Loading weather...</p>}>
        <Weather />
      </Suspense>
    </section>
  )
}
```

The docs describe the mechanism plainly: *"`<Suspense>` works by wrapping a component that performs an asynchronous action (e.g. fetch data), showing fallback UI (e.g. skeleton, spinner) while it's happening, and then swapping in your component once the action completes."* The two benefits it lists are **streaming server rendering** (*"Progressively rendering HTML from the server to the client"*) and **selective hydration** (*"React prioritizes what components to make interactive first based on user interaction"*).

Use `loading.tsx` for the route-level skeleton and inline boundaries for the panels inside it. They compose.

## Streaming commits the status code

The consequence nobody anticipates until an SEO audit lands on their desk:

> *"When streaming, a `200` status code will be returned to signal that the request was successful."*
> *"The server can still communicate errors or issues to the client within the streamed content itself, for example, when using `redirect` or `notFound`. Because the response headers have already been sent to the client, the status code of the response cannot be updated."*
> *"For example, when a 404 page is streamed to the client, Next.js includes a `<meta name="robots" content="noindex">` tag in the streamed HTML. This prevents search engines from indexing that URL even if the HTTP status is 200."*
> *"Some crawlers may label these responses as "soft 404s". In the streaming case, this does not lead to indexation because the page is explicitly marked `noindex` in the HTML."*
> — [`loading.js` › Status Codes](https://nextjs.org/docs/app/api-reference/file-conventions/loading#status-codes)

And the precise trigger, from the collapsed detail block on the same page:

> *"The response body starts streaming when a Suspense fallback renders (for example, a `loading.tsx`) or when a Server Component suspends under a `Suspense` boundary. Place `notFound()` before those boundaries and before any `await` that may suspend."*

> *"If you need a 404 status, for compliance or analytics, ensure the resource exists before the response body is streamed, so that the server can set the HTTP status code. You can run this check in `proxy` to rewrite missing slugs to a not-found route, or produce a 404 response."*

`proxy.ts` is Next.js 16's successor to `middleware.ts`; this chapter covers it in [07 · The proxy.ts layer](07-the-proxyts-layer-successor-to-middlewarets-request-intercep.md).

## Where it does not work at all

| Deployment | Streaming supported |
|---|---|
| Node.js server | Yes |
| Docker container | Yes |
| Static export | **No** |
| Adapters | Platform-specific |

Transcribed from the *Platform Support* table on the `loading.js` reference. A static export has no server to stream from, so `loading.tsx` has nothing to do.

The docs also record a browser-side quirk, worth knowing before you chase a phantom:

> *"Some browsers buffer a streaming response. You may not see the streamed response until the response exceeds 1024 bytes. This typically only affects "hello world" applications, but not real applications."*

## Gotchas

**★ Symptom: `loading.tsx` exists, navigation is slow, and the skeleton never appears.** Cause: the segment's `layout.tsx` awaits `cookies()`, `headers()` or an uncached fetch. `loading.tsx` is *inside* that layout, so the navigation blocks before the boundary is ever reached. Fix — give the layout's own work its own boundary (shown above), or move the fetch into `page.tsx`.

**★ Symptom: the whole page waits for its slowest widget even though most of it is ready.** Cause: `loading.tsx` is one boundary around everything. Fix — keep `loading.tsx` for the route shell and add inline boundaries per panel:

```tsx
<Suspense fallback={<FeedSkeleton />}>
  <PostFeed />
</Suspense>
<Suspense fallback={<WeatherSkeleton />}>
  <Weather />
</Suspense>
```

**★ Symptom: an SEO tool reports your 404s as returning HTTP 200 "soft 404s".** Cause: the response began streaming — a `loading.tsx` fallback rendered — before `notFound()` was called, and headers cannot be rewritten after the first byte. Fix — either accept it (Next.js injects `noindex`, which keeps it out of the index), or do the existence check before anything can suspend:

```ts title="proxy.ts"
import { NextResponse, type NextRequest } from 'next/server'
import { postExists } from '@/app/lib/posts'

export async function proxy(request: NextRequest) {
  const match = request.nextUrl.pathname.match(/^\/blog\/([^/]+)$/)
  if (match && !(await postExists(match[1]))) {
    return new NextResponse('Not found', { status: 404 })
  }
  return NextResponse.next()
}
```

**Symptom: adding a `loading.tsx` made the layout stop being interactive during navigation.** Cause: it did not — but a fallback that replaces too much of the screen looks that way. The documented behaviour is *"Shared layouts remain interactive while new route segments load."* Fix — put the `loading.tsx` in the segment whose content is actually changing, not at the root, so the persistent chrome stays visible.

**Symptom: the loading skeleton flashes on a navigation that resolves in 40 ms.** Cause: nothing is wrong; the boundary is doing its job. Fix — if the flash is worse than the wait, delay the skeleton in CSS rather than removing the boundary:

```css title="app/globals.css"
.skeleton { animation: appear 0s 120ms forwards; opacity: 0 }
@keyframes appear { to { opacity: 1 } }
```

**Symptom: `loading.tsx` never fires on a statically exported site.** Cause: streaming is not supported for `output: 'export'`. Fix — there is no fix within static export; if you need streamed loading states you need a Node.js server or a platform adapter that supports streaming.

**Symptom: the fallback appears only on the first navigation into a section, never again.** Cause: the boundary lives inside a layout that does not remount, so React does not re-enter the pending state. Fix — move the boundary into a `template.tsx`, which is keyed per navigation. See [01c](01c-layout-vs-template.md).

**Symptom: `Loading` receives `params` as `undefined` and you built the skeleton around it.** Cause: `loading.tsx` takes no props at all — no `params`, no `searchParams`, no `children`. Fix — make the skeleton content-independent, or move the data-shaped part of it into the page under an inline boundary where the props do exist.

**Symptom: metadata appears missing when a page streams.** Cause: it is not missing — Next.js chooses per user agent. *"For bots that only scrape static HTML, and cannot execute JavaScript like a full browser, such as Twitterbot, Next.js resolves `generateMetadata` before streaming UI, and metadata is placed in the `<head>` of the initial HTML."* Fix — verify with a crawler-shaped request rather than the browser's view-source, and remember streaming *"is server-rendered, it does not impact SEO"*.

## Interview questions

**★ What does `loading.tsx` actually compile to?**
A `Suspense` boundary placed by the framework. Adding the file to a folder makes Next.js wrap that segment's `page.js`, its `not-found.js`, and every nested `layout.js` and page below it in `<Suspense fallback={<Loading />}>`. It does not wrap the `layout.js`, `template.js` or `error.js` in the same segment, because those are its ancestors in the composition order.

**★ Why does a slow layout make `loading.tsx` useless, and what are the two documented fixes?**
Because the boundary is nested inside the layout, so the layout has to finish rendering before the boundary exists. Without Cache Components the navigation simply blocks and the fallback is never shown; with Cache Components enabled Next.js raises a build-time error instead of letting it happen silently. The fixes are to wrap the layout's runtime data access in its own `Suspense` boundary with its own fallback, or to move that fetch down into `page.js` where the automatic boundary covers it.

**★ You call `notFound()` in a page and the response is HTTP 200. Explain.**
The response started streaming before the call. Streaming begins as soon as a Suspense fallback renders or a Server Component suspends under a boundary, and once headers are on the wire the status cannot change — so the 404 arrives as part of the body of an already-committed 200. Next.js compensates by injecting `<meta name="robots" content="noindex" />` so the URL is not indexed, which is why the "soft 404" a crawler reports does not actually hurt you. If a real 404 status is required for compliance or analytics, the existence check has to happen before anything suspends — in `proxy.ts`, or before the first `await` in the route.

**When would you not use `loading.tsx` and write `Suspense` by hand instead?**
Whenever the granularity is wrong. `loading.tsx` gives you exactly one boundary around the whole page, so a page with one slow panel and four fast ones shows a full-page skeleton for the sake of the slow one. Inline boundaries let each panel stream independently, and let you give each a fallback shaped like the content it replaces. In practice you use both: `loading.tsx` for the route shell during navigation, inline boundaries for the panels within it.

**Is a `loading.tsx` fallback rendered on the server or the client?**
On the server, by default — it is a Server Component, and its HTML is part of the streamed response. It is also prefetched along with the route, which is what makes it appear instantly on click rather than after a round trip. You *can* mark it `'use client'`, but a fallback that waits for JavaScript is no longer an instant loading state.

**Does streaming hurt SEO?**
No. The docs state that because streaming is server-rendered it does not impact SEO, and that Next.js detects user agents: for crawlers that cannot run JavaScript it resolves `generateMetadata` before streaming so the metadata is in the initial HTML, and for everything else it may stream metadata. The one real consequence is the status code, which is a separate problem from indexing and is handled by the injected `noindex`.

---

← [01c · Layout vs template](01c-layout-vs-template.md) · [Chapter 2 overview](01-explanation.md) · Next → [01e · Error and not-found boundaries](01e-error-and-not-found-boundaries.md)
