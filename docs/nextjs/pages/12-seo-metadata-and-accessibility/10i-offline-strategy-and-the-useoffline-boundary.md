---
title: "`useOffline` and a service worker solve two different halves of offline, and a team that conflates them ships the one that does not fix their bug"
sidebar_label: "10i · Offline strategy and the `useOffline` boundary"
sidebar_position: 18
description: "Why experimental.useOffline stops at the document request, what a service worker has to answer instead, and the offline fallback page that is the honest minimum."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-03 against the Next.js
> [offline support guide](https://nextjs.org/docs/app/guides/offline-support),
> [`useOffline` hook](https://nextjs.org/docs/app/api-reference/functions/use-offline),
> [`experimental.useOffline`](https://nextjs.org/docs/app/api-reference/config/next-config-js/useOffline)
> and [PWA guide](https://nextjs.org/docs/app/guides/progressive-web-apps).
> Target: **Next.js 16.3.4**, App Router.
> 🔴 `experimental.useOffline` is experimental and the docs say it is **not recommended for
> production**.

**There are two completely separate offline problems and they have nothing in common except
the word. One is "the user is already in my app and the connection dropped" — `useOffline`
answers that, by keeping framework requests pending and retrying them. The other is "the user
opened the app with no connection at all" — nothing in the framework can answer that, because
the browser needs a network to fetch the HTML in the first place, and a service worker is the
only thing that sits in front of that request.** Choosing the wrong one is a whole sprint spent
on a feature that does not touch the reported bug. The Next.js offline guide draws the line
itself:

> *"A full page reload while offline still fails because the browser needs the network to deliver the HTML"*

## The boundary, precisely

| Situation | Covered by `experimental.useOffline` | Needs a service worker |
|---|---|---|
| Soft navigation via `<Link>` to a **prefetched** route | ✅ shell renders, dynamic content waits and retries | — |
| Soft navigation to a route that was never prefetched | ❌ nothing to render | ✅ if the shell is precached |
| A Server Action fired from the page you are on | ✅ pending, retried on reconnect | — |
| **Reloading the current URL** | ❌ | ✅ the only mechanism |
| Cold start from the home screen icon | ❌ | ✅ the only mechanism |
| A static asset request after the JS is running | partially — it is a framework fetch or it is not | ✅ deterministic |

Read the two ✅-only-with-a-worker rows again, because they are the ones users report. Nobody
files "my soft navigation stalled"; they file "I opened the app on the train and got the
dinosaur."

`useOffline` also cannot help before hydration. Its documented return value is `false` during
server rendering and as the initial value before hydration completes — so on a cold load there
is no moment at which the hook could tell you anything, even if the HTML had arrived.

## Why the framework cannot fix the reload

A soft navigation is a `fetch()` the App Router controls. It can hold that promise open,
retry it, and resolve it later — which is exactly what the flag does, with a `HEAD`-request
polling loop behind it. A document request is not yours: the browser makes it before any of
your JavaScript exists, and there is nothing in the page to keep it pending because there is no
page yet.

A service worker is different in kind. It is installed persistently, it is started by the
browser *for* the navigation request, and it can answer that request from the Cache API without
a network round trip. That is the entire reason it is the documented answer to this gap.

The two are complementary, not alternatives:

- **Service worker** — get *a* document on screen with no network.
- **`useOffline`** — once a document is on screen, keep the app coherent while the network is
  gone, and tell the user which of "slow" and "offline" they are looking at.

Chapter 7 covers the second half in detail:
[network resilience and `useOffline`](../07-error-handling-loading-states-and-resilience/12-network-resilience-and-useoffline.md)
and [offline Server Actions and testing](../07-error-handling-loading-states-and-resilience/12b-offline-server-actions-and-testing.md).

## The honest minimum: an offline fallback document

Before any clever caching, ship the thing that turns a browser error page into your own UI.
Two pieces.

A static route to fall back to:

```tsx title="app/offline/page.tsx"
export const metadata = { title: 'Offline — SprintDesk' }

export default function OfflinePage() {
  return (
    <main>
      <h1>You are offline</h1>
      <p>
        SprintDesk needs a connection to load this page. Your unsaved work is still here — try
        again once you are back online.
      </p>
    </main>
  )
}
```

And a worker that precaches it and serves it when a **navigation** fails:

```js title="public/sw.js"
const VERSION = 'sd-2026-09-03-a'
const CACHE = `sprintdesk-${VERSION}`
const OFFLINE_URL = '/offline'

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE)
      // `reload` bypasses the HTTP cache so we precache the current deploy's HTML.
      await cache.add(new Request(OFFLINE_URL, { cache: 'reload' }))
    })()
  )
})

self.addEventListener('fetch', (event) => {
  // Only document navigations. Everything else falls through to the network.
  if (event.request.mode !== 'navigate') return

  event.respondWith(
    (async () => {
      try {
        return await fetch(event.request)
      } catch {
        const cache = await caches.open(CACHE)
        const fallback = await cache.match(OFFLINE_URL)
        return fallback ?? Response.error()
      }
    })()
  )
})
```

That is roughly thirty lines and it changes the worst experience your app has. Note what it
does *not* do: it does not cache real pages, so it cannot serve stale content, and it cannot
get the RSC/HTML confusion wrong. Ship this first and add caching only when you have a specific
reason.

`{ cache: 'reload' }` on the precache matters. Without it the browser may satisfy the precache
from its own HTTP cache and you pin a previous deploy's HTML inside the new worker's cache — a
version skew that only appears offline, which is the hardest place to notice it.

## Gotchas

### Enabling `experimental.useOffline` to fix "the app doesn't work offline"
**Symptom.** The flag is on, the banner works in testing, and the original bug report — "I
reloaded on the train and got an error page" — is unchanged.
**Cause.** The flag covers soft navigations into prefetched routes and Server Actions from the
current page. A document request is out of scope by construction.
**Fix.** Add a service worker with a navigation fallback, as above. Keep the flag if you want
the in-app behaviour, but do not expect it to answer a reload.

### The offline page itself needs the network
**Symptom.** The fallback renders, then throws or shows a spinner forever.
**Cause.** `app/offline/page.tsx` reached for data — a Server Component `fetch`, an image from
a third-party host, a font from a CDN. The precached HTML is served, and then the page tries to
complete itself over a network that is not there.
**Fix.** Make the fallback fully self-contained: no data fetching, no remote assets, and
precache anything it references.

```js title="public/sw.js (excerpt)"
await cache.addAll([
  new Request(OFFLINE_URL, { cache: 'reload' }),
  '/icons/icon-192.png',
  '/fonts/inter-subset.woff2',
])
```

### Precaching the offline page without `{ cache: 'reload' }`
**Symptom.** After a deploy, the offline page shows old branding or links to a route that no
longer exists.
**Cause.** `cache.add()` may be satisfied from the browser's HTTP cache, so the new worker
precaches the *previous* deploy's HTML.
**Fix.** Construct the `Request` with `cache: 'reload'`, as shown, so the precache always comes
from the network.

### Testing offline behaviour against `next dev`
**Symptom.** The prefetched-shell behaviour the offline guide describes does not happen.
**Cause.** Prefetching is disabled in development, and the prefetched App Shell is what renders
during an offline soft navigation. In dev there is no shell.
**Fix.** Build and start a production server, then toggle offline. This applies to the service
worker too — the assets it precaches are the production build's, not the dev server's.

### Treating the service worker cache as the framework cache
**Symptom.** `revalidatePath()` runs, the origin is correct, and users still see old content.
**Cause.** Two independent cache layers on the same URLs. `use cache`, ISR and
`revalidatePath()` operate on the server; the Cache API lives on the user's disk and has never
heard of any of them. Nothing on the server can invalidate it.
**Fix.** Invalidate from the worker, keyed on the deploy — delete non-current cache versions in
`activate` (see [10g](10g-the-service-worker-update-lifecycle.md)) — and never cache a document
you expect the server to be able to revalidate.

### Caching document responses while Draft Mode is in play
**Symptom.** An editor's draft preview leaks to a normal visitor, or an editor cannot escape
the published version.
**Cause.** Draft Mode is distinguished by a cookie, not by a URL. A service worker that caches
navigation responses keyed on URL will store whichever variant it saw first and serve it to
everyone on that device.
**Fix.** Do not cache navigations at all when the draft cookie may be present. Detect it in the
worker and pass straight through:

```js title="public/sw.js (excerpt)"
self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return
  // Draft Mode sets a cookie; never serve a cached document to a preview session.
  const isPreview = event.request.headers.get('cookie')?.includes('__prerender_bypass')
  if (isPreview) return
  // ...network-first with the offline fallback
})
```

⚠️ The cookie **name** is an implementation detail of Draft Mode that the documentation does
not promise; verify it against your own deployment before relying on it, and prefer scoping
previews to a distinct hostname where you can. Draft Mode itself is covered in
[Draft Mode: CMS preview that bypasses every cache layer](../04-data-fetching-in-the-app-router/10-draft-mode-cms-preview-that-bypasses-every-cache-layer.md).

### Assuming the flag helps a cold start from the home screen
**Symptom.** Launching the installed app offline shows a browser error, despite `useOffline`.
**Cause.** A launch from the home screen is a document request for `start_url`. It is the reload
case with a different trigger.
**Fix.** Precache `start_url` — not just `/offline` — if you want the installed app to open
offline at all, and accept that what opens is a shell.

## Interview questions

**★ What exactly does `experimental.useOffline` cover, and what does it not?**
It covers soft navigations into prefetched routes and Server Action calls from the page you are
already on: those requests are kept pending and retried when connectivity returns, with a
`HEAD`-request polling loop deciding when that is. It does not cover a full page reload,
because the browser fetches the HTML before any of your JavaScript exists. The documented answer
to that gap is a service worker.

**★ Why can a service worker answer a request the framework cannot?**
Because it is installed persistently and the browser starts it *for* the navigation request,
before and independently of the page. It can respond from the Cache API with no network. The
App Router can only hold open a `fetch()` it issued itself, and on a cold load it has not issued
anything — there is no page yet.

**What does `useOffline()` return during SSR and before hydration, and why does that matter
here?**
`false`, in both cases, per its documented return table. So it cannot participate in a cold
start at all: at the moment the offline experience is decided, the hook has no signal to give.
That is another way of stating the same boundary.

**★ What is the smallest useful offline implementation for a Next.js app?**
A static `app/offline/page.tsx` with no data fetching or remote assets, precached by the worker
with `{ cache: 'reload' }`, plus a `fetch` handler that intercepts only
`request.mode === 'navigate'` and falls back to it when the network throws. Roughly thirty
lines, no cache-versioning subtleties, no risk of serving stale pages — and it replaces the
browser's error page, which is the actual complaint.

**Why `{ cache: 'reload' }` when precaching?**
Because `cache.add()` is allowed to be satisfied from the browser's HTTP cache, which means a
freshly installed worker can precache the previous deploy's HTML. The skew only shows up
offline, where nobody is watching. `cache: 'reload'` forces the precache to come from the
network.

**Can `revalidatePath()` clear a service worker cache?**
No, and the assumption that it can is a recurring production incident. Server-side caching —
`use cache`, ISR, `revalidatePath()` — and the Cache API are separate layers with separate
lifetimes, and the second one lives on the user's disk. The only invalidation you have is the
worker deleting its own caches during `activate`.

**Why must offline behaviour be tested against a production build?**
Prefetching is disabled in development, and the prefetched App Shell is precisely what renders
during an offline soft navigation. The service worker half has the same problem from the other
direction: what it precaches is the production build's asset set.

**★ You cache navigation responses and an editor complains their draft preview leaked to a
colleague. What happened?**
Draft Mode is selected by a cookie, not by the URL, so two very different documents share one
cache key. Whichever the worker saw first is what it serves to everyone on that device. The
fix is to never cache a navigation when the preview cookie is present — and, more robustly, to
serve previews from a hostname the production worker does not control.

**The installed app still fails to open offline even though `/offline` is precached. Why?**
Launching from the home screen is a document request for `start_url`, and you only precached
`/offline`. Either precache `start_url` itself, or accept that the launch falls back to the
offline page — which is a legitimate choice, but it should be a choice rather than a surprise.

{/* FOOTER */}
