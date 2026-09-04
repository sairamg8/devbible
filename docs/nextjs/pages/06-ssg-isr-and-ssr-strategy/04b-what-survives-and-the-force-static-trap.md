---
title: "A static export keeps more than teams expect — Server Components, `GET` Route Handlers as a file generator and `next/image` through a custom loader all survive — and the one flag the guide tells you to add is the one that converts a build error into a page showing the signed-out branch"
sidebar_label: "04b · What survives, and the `force-static` trap"
sidebar_position: 26
description: "The supported half of Next.js 16.3.4 static export: Server Components executing at build time, GET Route Handlers prerendered into real files, custom image loaders, client-side fetching — and why force-static is more dangerous here than anywhere else."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 for **Next.js 16.3.4** against [How to create a static export](https://nextjs.org/docs/app/guides/static-exports) (docs `lastUpdated` 2026-08-25) and [Caching and Revalidating (Previous Model)](https://nextjs.org/docs/app/guides/caching-without-cache-components) (`lastUpdated` 2026-08-25).
> Target: **Next.js 16.3.4**, App Router. Documentation-verified (T2); `next` is **not installed in this checkout**, so **no package probe and no sandbox run**. The `force-static` / `output: 'export'` interaction below is stated as **unresolved by the documentation**, not asserted.

**[04](04-full-static-export-vs-serverful-edge-distribution.md) listed the thirteen removals. The complement is the more interesting page, because it is where teams under-use the mode: Server Components still run — at build time, on the build machine, with your real data-access layer — `GET` Route Handlers are prerendered into actual files you can ship a search index or a feed from, and `next/image` keeps working through a custom loader. What you cannot keep is anything that reads the request. And the sharp edge is that the export guide's own snippet contains `export const dynamic = 'force-static'`, a flag documented to make `cookies()`, `headers()` and `useSearchParams()` return empty values rather than error — so copy-pasting it onto a page turns "this cannot be static" from a build failure into a build artifact that shows every visitor the logged-out branch.**

## Server Components run — at build time

> *"When you run `next build` to generate a static export, Server Components consumed inside the `app` directory will run during the build, similar to traditional static-site generation."*

> *"The resulting component will be rendered into static HTML for the initial page load and a static payload for client navigation between routes. No changes are required for your Server Components when using the static export, unless they consume dynamic server functions."*

That last clause is the whole rule. Your `async` components, your ORM calls, your typed data
access layer: unchanged, executed once, during the build.

```tsx
// app/changelog/page.tsx — runs on the build machine, becomes out/changelog.html
import { getReleases } from '@/lib/releases'

export default async function Changelog() {
  const releases = await getReleases() // real DB or CMS call, at build time

  return (
    <main>
      <h1>Changelog</h1>
      {releases.map((release) => (
        <article key={release.id}>
          <h2>{release.version}</h2>
          <time dateTime={release.publishedAt}>{release.publishedAt}</time>
          <p>{release.summary}</p>
        </article>
      ))}
    </main>
  )
}
```

The consequence people miss: **the build machine now needs production data credentials.** A
static export moves your database connection from a runtime secret in a serverful environment
into a CI secret. That is not worse, but it is different, and it means your CI logs and your
build cache are now in the blast radius of a data leak.

## `GET` Route Handlers survive as a file generator

This is the most under-used capability of the mode:

> *"Route Handlers will render a static response when running `next build`. Only the `GET` HTTP verb is supported. This can be used to generate static HTML, JSON, TXT, or other files from cached or uncached data. To ensure Route Handlers are prerendered, you must explicitly mark the handler as static by adding `export const dynamic = 'force-static'` when a static export is enabled."*

```ts
// app/data.json/route.ts — emits a real file named data.json at build time
export const dynamic = 'force-static'

export async function GET() {
  return Response.json({ name: 'Lee' })
}
```

The doc states this file *"will render to a static file during `next build`, producing
`data.json`"* containing `` { name: 'Lee' } ``. **The route's directory name is the emitted
filename, extension included** — `app/data.json/route.ts` gives you `data.json`, not
`data.json/index.html`. That is the mechanism behind shipping a client-side search index from
a static export:

```ts
// app/search-index.json/route.ts
import { getAllDocs } from '@/lib/docs'

export const dynamic = 'force-static'

export async function GET() {
  const docs = await getAllDocs()

  return Response.json(
    docs.map((doc) => ({
      slug: doc.slug,
      title: doc.title,
      headings: doc.headings,
      body: doc.plainText.slice(0, 2000),
    }))
  )
}
```

A Client Component then fetches `/search-index.json` at runtime and searches in the browser.
No server, full-text search, one build artifact.

What is unsupported is *"Route Handlers that rely on Request"* — no query parsing, no body, no
verb other than `GET`. A handler that touches `request.url` is an error, not a degraded result.

## Image optimization survives through a custom loader

The unsupported entry is scoped precisely: *"Image Optimization with the default `loader`"*.
The default loader is the `/_next/image` endpoint, which needs a server. Point it elsewhere and
`next/image` keeps working:

```js
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: {
    loader: 'custom',
    loaderFile: './my-loader.ts',
  },
}

module.exports = nextConfig
```

```ts
// my-loader.ts — the doc's own Cloudinary example
export default function cloudinaryLoader({
  src,
  width,
  quality,
}: {
  src: string
  width: number
  quality?: number
}) {
  const params = ['f_auto', 'c_limit', `w_${width}`, `q_${quality || 'auto'}`]
  return `https://res.cloudinary.com/demo/image/upload/${params.join(',')}${src}`
}
```

```tsx
// app/page.tsx — unchanged; src is a path *within* the image service
import Image from 'next/image'

export default function Page() {
  return <Image alt="turtles" src="/turtles.jpg" width={300} height={300} />
}
```

You did not remove the resizing cost, you moved it to a vendor. That is often correct — an
image CDN is better at this than `/_next/image` — but it belongs in the cost comparison in
[04c](04c-when-export-wins-and-what-a-server-buys.md), not in the "static is free" column.

## Client-side everything survives, with two constraints

> *"If you want to perform data fetching on the client, you can use a Client Component with SWR to memoize requests."*

Anything you were going to render per-request on the server, you can render per-visit on the
client. The two constraints are real, though:

1. **The API is now public.** A server-rendered page could call an internal service with a
   secret. A browser cannot. Whatever the client fetches must be reachable from the internet,
   CORS-permissive for your origin, and safe to expose.
2. **Client Components are prerendered to HTML at build.** The guide is explicit:

> *"Client Components are prerendered to HTML during `next build`. Because Web APIs like `window`, `localStorage`, and `navigator` are not available on the server, you need to safely access these APIs only when running in the browser."*

```tsx
'use client'

import { useEffect, useState } from 'react'

export default function ThemeToggle() {
  // 🔴 `localStorage.getItem('theme')` as an initial value crashes the build,
  //    because this component is prerendered on the build machine.
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    const stored = window.localStorage.getItem('theme')
    if (stored === 'dark' || stored === 'light') setTheme(stored)
  }, [])

  return (
    <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
      {theme}
    </button>
  )
}
```

See [ch4 · client-side data fetching](../04-data-fetching-in-the-app-router/14-client-side-data-fetching-and-when-it-is-still-correct.md)
and [ch4 · SWR in the App Router](../04-data-fetching-in-the-app-router/15-swr-in-the-app-router-fallbacks-keys-and-mutations.md)
for the fetching patterns themselves.

## 🔴 The guard rail the guide tells you to disable

The export guide says unsupported features fail loudly:

> *"Attempting to use any of these features with `next dev` will result in an error, similar to setting the `dynamic` option to `error` in the root layout."*

`dynamic = 'error'` is documented as *causing an error if any component uses Request-time APIs
or uncached data*. That is exactly the behaviour you want in a mode where the request does not
exist.

Now put it beside the *other* thing the guide tells you to write. `force-static` is documented
in [Caching and Revalidating (Previous Model)](https://nextjs.org/docs/app/guides/caching-without-cache-components) as forcing prerendering by:

> *"forcing `cookies`, `headers()` and `useSearchParams()` to return empty values"*

Those are opposite behaviours, and the flag carrying the dangerous one is the flag the
static-export guide puts in its recommended snippet.

```tsx
// app/account/page.tsx — 🔴 this ships the signed-out page to everyone, silently
export const dynamic = 'force-static'

import { cookies } from 'next/headers'

export default async function Account() {
  const session = (await cookies()).get('sd_session')?.value // blanked -> undefined
  if (!session) return <SignInPrompt />                      // ...so this is the only branch
  return <AccountView session={session} />
}
```

**What the documentation does and does not settle.** It states the export-mode error behaviour
for unsupported features under `next dev`. It states `force-static`'s blanking behaviour. It
**does not state which wins** when a page segment carries an explicit `force-static` under
`output: 'export'`. The guide only ever prescribes `force-static` for **Route Handlers**, never
for pages. I could not confirm the page-segment interaction and will not guess it.

The safe practice does not depend on resolving it:

```tsx
// Pages under output: 'export' — say what you mean, and make being wrong a build failure.
export const dynamic = 'error'
```

```ts
// Route Handlers under output: 'export' — force-static is required here by the guide.
// Keep it to files that read nothing from the request.
export const dynamic = 'force-static'
```

⚠️ Both are the pre-Cache-Components API. `v16.0.0` removes `dynamic`, `dynamicParams`,
`revalidate` and `fetchCache` when `cacheComponents` is enabled — see
[ch4 · the segment config surface](../04-data-fetching-in-the-app-router/03b-the-segment-config-surface.md)
and [ch5 · choosing a cache directive](../05-caching-ppr-and-cache-components/10-the-three-cache-directives/01-choosing-a-directive.md).
The static-export guide in 16.3.4 is still written against the previous model, and I could not
find documentation of what `output: 'export'` plus `cacheComponents: true` does together.

## Gotchas

**★ Symptom: an authenticated-looking page in a static export renders its signed-out state for every visitor, and nothing errored.** Cause: `export const dynamic = 'force-static'` on that segment, documented as forcing `cookies`, `headers()` and `useSearchParams()` to return empty values. The auth check took the anonymous branch at build time, and that HTML is the artifact. Fix: `export const dynamic = 'error'` on page segments, so a request-time read fails the build instead of producing plausible wrong HTML — and confine `force-static` to the `GET` Route Handlers where the guide actually requires it.

**★ Symptom: `force-static` spreads across the codebase after one person adds a Route Handler.** Cause: the export guide's only code snippet containing a segment config shows `force-static`, so it is what gets copied. Fix: put the two-line rule in the repository — `error` on pages, `force-static` on `GET` Route Handlers — and enforce it with a lint rule or a review checklist, because the difference between them is invisible in a diff and catastrophic in behaviour.

**★ Symptom: `next build` crashes with a `localStorage is not defined` or `window is not defined` style failure in a Client Component that "obviously runs in the browser".** Cause: Client Components are prerendered to HTML during `next build`; module scope and the initial render execute on the build machine. Fix: move every browser-API read into `useEffect` as in the `ThemeToggle` above, so it runs only after hydration, and give `useState` a server-safe initial value.

**★ Symptom: the search index Route Handler emits `search-index.json/index.html` instead of `search-index.json`.** Cause: the emitted filename comes from the route *directory* name, and the handler was placed at `app/search-index/route.ts` rather than `app/search-index.json/route.ts`. Fix: put the extension in the directory name — `app/<name>.<ext>/route.ts` — which is exactly what the doc's `app/data.json/route.ts` example is demonstrating.

**★ Symptom: `next/image` renders images at full source resolution and Lighthouse complains about payload.** Cause: item 10 of the unsupported list — the default loader needs the `/_next/image` endpoint. Fix: either the custom-loader config above pointed at an image service, or `images: { unoptimized: true }` plus correctly sized source assets. Do not leave the default in place and assume the CDN will handle it; nothing is handling it.

**★ Symptom: images 404 after switching to a custom loader, with URLs like `https://res.cloudinary.com/demo/image/upload/f_auto,c_limit,w_640,q_auto/hero.jpg`.** Cause: with a custom loader, `src` is no longer a path in `public/` — it is a path *within the image service*, concatenated by your loader. Fix: either upload the assets to the service under the same paths, or make the loader map local paths to service paths explicitly. The loader is the whole contract; nothing validates it at build time.

**★ Symptom: a client-side fetch that worked when the page was server-rendered now fails with a CORS error, or exposes an internal token in the bundle.** Cause: server-rendered pages call internal services with server-only secrets; a static export moves that call into the browser. Fix: put the data behind a public, CORS-configured endpoint with its own authorization model — or emit it at build time as a `GET` Route Handler file, which is usually the better answer for anything that is the same for every visitor.

**★ Symptom: CI secrets sprawl after the move to static export.** Cause: Server Components now run on the build machine, so the build needs the production database or CMS credentials that used to live only in the runtime environment. Fix: give CI a read-only, scoped credential rather than reusing the runtime one, and treat build logs and build caches as data-bearing artifacts. This is a real security consequence of "there is no server" that gets discussed as if it were purely a cost change.

**Symptom: `revalidate` inside a `GET` Route Handler in an export appears to be accepted.** Cause: nothing in the config rejects it, and ISR is item 9 on the unsupported list — there is no runtime to honour it. Fix: delete it. Regeneration in this mode means a rebuild, triggered by a webhook, full stop. Note also that Route Handlers have not been cached by default since `v15.0.0-RC`, so a handler you assume is cached is not — see [ch4 · Route Handlers and their caching model](../04-data-fetching-in-the-app-router/01d-route-handlers-and-their-caching-model.md).

## Interview questions

**★ What still runs on the server in a static export?**
The build. Server Components execute during `next build` on the build machine — the docs say so explicitly — so your data-access layer, `async` components and database queries all work exactly as written. What does not exist is anything needing the *request*, because there is no runtime moment when a user asks for the page. That single distinction generates all thirteen unsupported items, and it also generates the underappreciated consequence: the build machine now holds production data credentials.

**★ Are Route Handlers usable in a static export?**
Partially, and the nuance is the useful part. `GET` handlers marked `export const dynamic = 'force-static'` are prerendered into real files — the doc's example emits `data.json` — which makes them a build-time file generator for search indexes, feeds, manifests and OpenAPI documents. The route directory name becomes the filename, extension and all. What is unsupported is *"Route Handlers that rely on Request"*: no query, no body, no verb but `GET`.

**★ Why is `force-static` more dangerous in a static export than anywhere else?**
Because the export guide instructs you to write it. Everywhere else it is an opt-in override somebody chose deliberately; here it appears in the recommended snippet, so it propagates by copy-paste onto segments that were never Route Handlers. Its documented behaviour is to blank `cookies`, `headers()` and `useSearchParams()` rather than error — converting "this cannot be static" from a build failure into a build artifact showing the logged-out branch. The docs do not state which behaviour wins for a page segment under `output: 'export'`, so the defensive answer is `dynamic = 'error'` on pages and never generalising the Route Handler snippet.

**★ Does a static export mean no dynamic data?**
No, and this is where the mode is genuinely competent. Route transitions are client-side, so an export behaves like an SPA after first paint, and Client Components can fetch anything at runtime. The rule is only about what can be computed *before* the request. Personalisation, auth and freshness move to the client, where they cost a loading state, a bundle, and a publicly reachable API — not where they become impossible.

**★ How would you ship full-text search from a static export?**
Emit the index as a build artifact with a `GET` Route Handler at `app/search-index.json/route.ts` marked `force-static`, then fetch and search it in a Client Component. That keeps the expensive part — walking every document — at build time where it costs one CI minute, and makes the runtime part a single cached static file plus browser CPU. The alternative, a hosted search API, reintroduces a runtime dependency and a per-query bill for a corpus that only changes at deploy time.

**★ A Client Component reads `localStorage` for its initial state and the build fails. Explain the mechanism, not just the fix.**
"Client Component" describes where the component becomes *interactive*, not where it first renders. Next.js prerenders Client Components to HTML during `next build` so there is markup to serve and hydrate; that prerender runs in Node, where `window`, `localStorage` and `navigator` do not exist. So module scope and the first render must be browser-free, and the browser-only read belongs in `useEffect`, which never runs during prerendering. The same mechanism applies in serverful mode — static export just makes it unavoidable, because every route is prerendered.

---

← [04 · Static export: what it removes](04-full-static-export-vs-serverful-edge-distribution.md) · [Chapter 6 overview](01-explanation.md) · Next → [04c · When export wins, and what a server buys](04c-when-export-wins-and-what-a-server-buys.md)
