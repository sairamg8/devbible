---
title: "The HTTP status a not-found page returns depends on whether the response had already started streaming — 404 if not, 200 if it had — and under Cache Components every dynamic route streams a shell first, so an in-page check can no longer produce a real 404"
sidebar_label: "04i · not-found.js and the status"
sidebar_position: 147
description: "Where not-found.js sits in the component hierarchy, how the nearest boundary is chosen, the 200-versus-404 streaming trade-off and the noindex tag that covers it, moving the check into proxy, and experimental global-not-found.js."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 against the Next.js [`not-found.js`](https://nextjs.org/docs/app/api-reference/file-conventions/not-found) reference (`lastUpdated: 2026-07-10`) and [`notFound`](https://nextjs.org/docs/app/api-reference/functions/not-found) (`lastUpdated: 2026-07-24`).
> Target: **Next.js 16.3.4** · root `app/not-found` handles global unmatched URLs since **v13.3.0** · `global-not-found.js` **experimental**, introduced **v15.4.0**. Documentation-verified — **no sandbox run**.

**[04h](04h-notfound-and-the-not-found-boundary.md) covered the throw; this is what catches it, and the part that surprises people is the status code. Next.js returns a real `404` for a non-streamed response and a `200` for a streamed one, because the status is committed the moment the response begins and cannot be changed afterwards. Checking whether a resource exists inside a `<Suspense>` boundary — which is exactly what you do to keep the shell and loading UI visible — necessarily runs after the commit. Under Cache Components every dynamic route streams a static shell first, so "check it in the page" and "return a real 404" have become mutually exclusive by default, and the documented answer is to move the check into `proxy`.**

## Where the interrupt lands

`not-found.js` is the boundary. Its position in the tree is specified:

> *"In the component hierarchy, `not-found.js` renders between `loading.js` and `page.js`. It is wrapped by the `<Suspense>` boundary from `loading.js` and the error boundary from `error.js` in the same segment."*

That ordering is the reason a not-found page can appear *inside* your loading skeleton's layout rather than replacing the whole screen, and the reason an error thrown by your not-found UI is still caught by `error.js`.

Resolution is nearest-first. Without a `not-found.tsx` alongside the route, *"the nearest parent `not-found` boundary renders, falling back to Next.js's default 404 page"*:

```
app/blog/[slug]/page.tsx
app/blog/[slug]/not-found.tsx   ← catches notFound() thrown below here
app/not-found.tsx               ← the fallback, and every unmatched URL
```

The root file does double duty:

> *"In addition to catching expected `notFound()` errors, the root `app/not-found.js` and `app/global-not-found.js` files handle any unmatched URLs for your whole application. This means users that visit a URL that is not handled by your app will be shown the exported UI."*

```tsx title="app/blog/[slug]/not-found.tsx"
export default function NotFound() {
  return (
    <section>
      <h1>Post not found</h1>
      <p>The post you're looking for doesn't exist.</p>
    </section>
  )
}
```

## What the file may and may not do

`not-found.js` takes **no props** — the reference says so of both it and `global-not-found.js`. It is a Server Component by default and may be `async`, so it can fetch:

```tsx title="app/not-found.tsx"
import Link from 'next/link'
import { headers } from 'next/headers'

export default async function NotFound() {
  const headersList = await headers()
  const domain = headersList.get('host')
  const data = await getSiteData(domain)
  return (
    <div>
      <h2>Not Found: {data.name}</h2>
      <p>Could not find requested resource</p>
      <p>
        View <Link href="/blog">all posts</Link>
      </p>
    </div>
  )
}
```

but the client-side escape hatch has a rule:

> *"If you need to use Client Component hooks like `usePathname` to display content based on the path, you must fetch data on the client-side instead."*

There is also a theming footgun in the *default* UI, before you write your own file at all:

> *"The default not found UI follows the operating system's color scheme via `prefers-color-scheme` and does not read an app-level theme (such as a class or `data-theme` attribute on `<html>`). Because it renders inside your root layout, the quickest way to match an explicit theme is to add a higher-specificity rule pair in your global stylesheet, scoped to your theme selector — for example `html[data-theme='light'] body` and `html[data-theme='dark'] body`. For full control over the markup, provide your own `not-found.js`."*

## The status code trade-off

> *"Along with serving a custom UI, Next.js will return a `200` HTTP status code for streamed responses, and `404` for non-streamed responses."*

The reference then spells out what that costs and why it is still the right default:

> *"Because the check runs inside the `<Suspense>` boundary, the response has already begun streaming as a `200`, and the status can't change once streaming has started. The `noindex` tag keeps a soft 404 out of search results. To return a real `404` status, the resource has to be checked before the response streams. With Cache Components, every dynamic route streams a static shell first, so run that check in `proxy` instead."*

| Response shape | Status | What protects you |
| --- | --- | --- |
| Not streamed — the check completed before the response began | **404** | the status itself |
| Streamed — a shell went out first, then the check ran | **200** | the injected `<meta name="robots" content="noindex" />` |

Read the Cache Components sentence carefully, because it inverts the default. **With `cacheComponents` enabled, checking existence inside the page can no longer produce a real 404**, since the shell has already been committed. If the status genuinely matters — an API contract, an uptime monitor, a partner integration, a strict SEO audit — the check moves before the response starts:

```ts title="proxy.ts"
import { NextResponse } from 'next/server'

export async function proxy(request: Request) {
  const url = new URL(request.url)
  const match = url.pathname.match(/^\/blog\/([^/]+)$/)
  if (!match) return

  const exists = await slugExists(match[1])
  if (!exists) {
    return new NextResponse(null, { status: 404 })
  }
}
```

For most sites the `noindex` tag is the part that actually mattered: the risk being managed was a crawler indexing a "not found" page as real content, and the tag closes that whether the status is 200 or 404. The proxy check costs a lookup on every request to the route, so it is worth paying only when something downstream reads the status.

## `global-not-found.js` — experimental

> *"The `global-not-found.js` file lets you define a 404 page for your entire application. Unlike `not-found.js`, which works at the route level, this is used when a requested URL doesn't match any route at all. Next.js **skips rendering** and directly returns this global page."*

It exists for two situations the reference names:

> *"Your app has multiple root layouts (e.g. `app/(admin)/layout.tsx` and `app/(shop)/layout.tsx`), so there's no single layout to compose a global 404 from."*
> *"Your root layout is defined using top-level dynamic segments (e.g. `app/[country]/layout.tsx`), which makes composing a consistent 404 page harder."*

Enable it explicitly:

```tsx title="next.config.ts"
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    globalNotFound: true,
  },
}

export default nextConfig
```

Because it bypasses your app's normal rendering, it must be self-sufficient:

> *"The `global-not-found.js` file bypasses your app's normal rendering, which means you'll need to import any global styles, fonts, or other dependencies that your 404 page requires. This includes your theme: because `global-not-found.js` bypasses your layout, the OS color scheme is the only signal the default UI sees, so apply your theme (class or attribute) inside this file."*

and *"Unlike `not-found.js`, this file must return a full HTML document, including `<html>` and `<body>` tags."* The reference adds a performance note worth taking seriously, since this page is served to bots and scanners at volume: *"A smaller version of your global styles, and a simpler font family could improve performance of this page."*

It may export `metadata` or `generateMetadata`, and the robots tag is automatic: *"Next.js automatically injects `<meta name="robots" content="noindex" />` for pages that return a 404 status code, including `global-not-found.js` pages."*

## Gotchas

**★ Symptom: monitoring reports 200s for pages that show your "not found" UI.** Cause: the check ran after streaming started, and *"the status can't change once streaming has started"*. Fix: if the status genuinely matters, check before the response begins — in `proxy.ts`. If it does not, rely on the injected `noindex` tag, which is what keeps a soft 404 out of search results.

**★ Symptom: after enabling Cache Components, every 404 became a 200.** Cause: *"With Cache Components, every dynamic route streams a static shell first"* — so a check inside the page is always after the commit. Fix: move existence checks that need a real status into `proxy.ts`; leave the rest where they are and accept the soft 404.

```ts title="proxy.ts"
const exists = await slugExists(slug)
if (!exists) return new NextResponse(null, { status: 404 })
```

**★ Symptom: `notFound()` in a deep component renders the wrong 404 page.** Cause: the interrupt travels up to the *nearest* `not-found` boundary, and without one alongside the route the nearest parent handles it — ultimately the default page. Fix: add `not-found.tsx` in the segment whose UI you want.

```
app/blog/[slug]/page.tsx
app/blog/[slug]/not-found.tsx   ← this one now catches it
app/not-found.tsx               ← the fallback, and every unmatched URL
```

**★ Symptom: `usePathname` in `not-found.tsx` throws.** Cause: `not-found.js` is a Server Component by default and takes no props. Fix: extract the path-dependent part into a Client Component the not-found page renders — the reference says path-based content must be handled client-side.

```tsx title="app/not-found.tsx"
import { SuggestedRoute } from './suggested-route' // 'use client'

export default function NotFound() {
  return (
    <div>
      <h2>Not Found</h2>
      <SuggestedRoute />
    </div>
  )
}
```

**★ Symptom: the default 404 ignores your app's light/dark toggle.** Cause: *"The default not found UI follows the operating system's color scheme via `prefers-color-scheme` and does not read an app-level theme."* Fix: either ship your own `not-found.js`, or add higher-specificity rules scoped to your theme selector, which is the documented quick fix.

```css title="app/globals.css"
html[data-theme='light'] body { color-scheme: light; }
html[data-theme='dark'] body { color-scheme: dark; }
```

**Symptom: `global-not-found.js` renders unstyled, in the wrong theme, with the wrong font.** Cause: it *"bypasses your app's normal rendering"*, so nothing from your layout applies. Fix: import global styles and fonts inside the file, apply your theme class or attribute there, and return a full HTML document.

```tsx title="app/global-not-found.tsx"
import './globals.css'
import { Inter } from 'next/font/google'
import type { Metadata } from 'next'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: '404 - Page Not Found',
  description: 'The page you are looking for does not exist.',
}

export default function GlobalNotFound() {
  return (
    <html lang="en" className={inter.className} data-theme="dark">
      <body>
        <h1>404 - Page Not Found</h1>
        <p>This page does not exist.</p>
      </body>
    </html>
  )
}
```

**Symptom: `global-not-found.tsx` exists and never renders.** Cause: it is experimental and off by default. Fix: `experimental.globalNotFound: true` in `next.config.ts`.

**Symptom: adding `not-found.tsx` to a segment changed which UI users see for a *different* route.** Cause: nearest-boundary resolution — every `notFound()` thrown anywhere below that segment now stops there instead of continuing to the root. Fix: place boundaries where you want the interruption to be caught, not merely where the folder looked convenient, and check the segments below before adding one.

**Symptom: your custom 404 is beautiful and enormous, and your logs show bots hammering it.** Cause: an unmatched URL is the most-requested page on many public sites — scanners, stale links, misconfigured integrations. Fix: keep the file cheap. The reference's own advice for `global-not-found.js` — smaller global styles, a simpler font family — applies to the root `not-found.js` for the same reason.

**Symptom: an error thrown inside `not-found.tsx` produces a blank page rather than your error UI.** Cause: `not-found.js` is wrapped by the `error.js` boundary *in the same segment* — if that segment has no `error.js`, the throw keeps travelling. Fix: keep the not-found UI free of data fetching that can fail, or ensure the segment has an `error.js`. A 404 page that can itself 500 is a bad trade.

## Interview questions

**★ Why can a page that shows your not-found UI still return HTTP 200?**
Because the status is committed when the response starts. Next.js returns 404 for non-streamed responses and 200 for streamed ones, and once streaming has started the status cannot change. Checking existence inside a `<Suspense>` boundary — which is what keeps the shell and loading UI visible — necessarily runs after the shell has been sent. The `noindex` tag is the compensation: a soft 404 stays out of search results. Under Cache Components this is the normal case, because every dynamic route streams a static shell first.

**★ You need a genuine 404 status for a route. Where does the check go?**
Before the response starts streaming, which in practice means `proxy.ts`. The reference says this directly for the Cache Components case: run the check in `proxy` instead. Anything inside the page or a component below it is too late by construction, and no amount of restructuring the page changes that — the shell has been committed. Weigh it honestly: the proxy check costs a lookup on every request to the route, so pay it only when something downstream actually reads the status.

**★ Where does `not-found.js` sit relative to `loading.js` and `error.js`, and why does that matter?**
It renders between `loading.js` and `page.js`, wrapped by the `<Suspense>` boundary from `loading.js` and the error boundary from `error.js` in the same segment. That is why a not-found page can appear inside the shell your loading skeleton established rather than replacing the entire screen, and why an error thrown *by* your not-found UI is still caught by `error.js` — which is also the reason a data-fetching not-found page is a risk, since a 404 that can itself 500 is a worse outcome than a plain one.

**★ When do you need `global-not-found.js`, and what does it cost?**
When you cannot compose a global 404 from `layout.js` plus `not-found.js` — the two named cases are an app with multiple root layouts, so there is no single layout to build from, and a root layout defined with top-level dynamic segments. It costs self-sufficiency: Next.js skips rendering entirely and returns the page directly, so it must return a full HTML document and import its own global styles, fonts and theme. It is also experimental, behind `experimental.globalNotFound`.

**★ How is a boundary chosen when `notFound()` is thrown deep in a tree?**
Nearest-first, walking up. The interrupt propagates until it meets a `not-found` boundary; the closest segment with a `not-found.js` handles it, otherwise the nearest parent, ultimately the root `app/not-found.js`, and failing that Next.js's default 404 page. The practical consequence is that adding a `not-found.tsx` to a segment silently changes the outcome for every route beneath it, so it is worth looking down the tree before adding one.

**What handles a URL that matches no route at all, and how is that different from a thrown `notFound()`?**
The root `app/not-found.js` handles both — since v13.3.0 it catches unmatched URLs for the whole application as well as explicit `notFound()` calls. The difference is where the decision is made: an unmatched URL never enters a route, so nothing rendered and nothing was checked, while a thrown `notFound()` means a route matched and then a resource inside it was missing. `global-not-found.js` separates the two, handling only the unmatched case and skipping rendering entirely.

---

← [04h · `notFound()`](04h-notfound-and-the-not-found-boundary.md) · [Chapter 2 overview](01-explanation.md) · Next → [04j · `usePathname` and `useSearchParams`](04j-usepathname-and-usesearchparams.md)
