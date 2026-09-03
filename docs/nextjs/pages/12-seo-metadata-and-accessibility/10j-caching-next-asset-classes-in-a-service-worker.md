---
title: "A Next.js origin serves six kinds of request over one set of URLs, and a service worker that does not classify them will hand HTML to the router and an RSC payload to the browser"
sidebar_label: "10j · Caching Next asset classes in a worker"
sidebar_position: 19
description: "Immutable build output, /_next/image, document navigations, RSC payloads and the _rsc query, Server Actions, and Route Handlers — one fetch handler that tells them apart."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-03 against the Next.js
> [PWA guide](https://nextjs.org/docs/app/guides/progressive-web-apps),
> [prefetching guide](https://nextjs.org/docs/app/guides/prefetching),
> [`public` folder convention](https://nextjs.org/docs/app/api-reference/file-conventions/public-folder),
> and the Next.js source file
> `packages/next/src/client/components/app-router-headers.ts` (canary, read 2026-09-03).
> Target: **Next.js 16.3.4**, App Router. Documentation-verified; **no sandbox run**.

**The single most damaging assumption in a hand-written service worker is that a URL identifies
a response. In an App Router application it does not: `/board` is a full HTML document to the
browser and a React Server Component payload to the router, and the only thing separating them
is a request header.** A cache keyed on URL alone will store whichever it saw first and serve
it to whichever asks next — HTML into a client-side navigation, or a `text/x-component` body
into a browser tab. Both fail in ways that look nothing like a caching bug. This page is the
classification you have to do first, and the strategy that fits each class. The minimum
implementation that avoids the whole problem is in
[10i](10i-offline-strategy-and-the-useoffline-boundary.md); how much you may cache before the
browser takes it all away is [10k](10k-service-worker-cache-budget-and-eviction.md).

## The six request classes

| Class | How you recognise it | Strategy |
|---|---|---|
| Build output | path starts `/_next/static/` | **cache-first**, never revalidate — content-hashed |
| Optimised images | path is `/_next/image` | cache-first with a bounded cache |
| `public/` assets | your own known paths | cache-first, versioned with the deploy |
| Document navigation | `request.mode === 'navigate'` | network-first, offline fallback |
| RSC payload | `rsc` request header, and/or a `_rsc` query param | **do not cache** unless you have a reason |
| Server Action | `POST` with a `next-action` header | 🔴 never cache, never replay |
| Route Handler / API | your own `/api/**` paths | your call; usually network-first |

The header names are not guesses. `packages/next/src/client/components/app-router-headers.ts`
defines `RSC_HEADER = 'rsc'`, `ACTION_HEADER = 'next-action'`,
`NEXT_ROUTER_PREFETCH_HEADER = 'next-router-prefetch'`,
`RSC_CONTENT_TYPE_HEADER = 'text/x-component'` and `NEXT_RSC_UNION_QUERY = '_rsc'`. The last one
is the interesting one: prefetch requests carry a `_rsc` query parameter whose purpose is to
make them **URL-distinct** from the document, precisely because intermediate caches key on URL.

## The classifier

```js title="public/sw.js"
const VERSION = 'sd-2026-09-03-a'
const STATIC_CACHE = `sd-static-${VERSION}`
const PAGES_CACHE = `sd-pages-${VERSION}`
const OFFLINE_URL = '/offline'

function classify(request) {
  const url = new URL(request.url)

  if (url.origin !== self.location.origin) return 'cross-origin'
  if (request.method !== 'GET') {
    // Server Actions are POSTs carrying next-action. So are ordinary form posts.
    return request.headers.has('next-action') ? 'server-action' : 'mutation'
  }
  if (url.pathname.startsWith('/_next/static/')) return 'immutable'
  if (url.pathname === '/_next/image') return 'image'
  // An RSC request and a document request share a pathname. Header first, query second.
  if (request.headers.get('rsc') === '1' || url.searchParams.has('_rsc')) return 'rsc'
  if (request.mode === 'navigate') return 'document'
  if (url.pathname.startsWith('/api/')) return 'api'
  return 'other'
}
```

Two things about that function. It checks the method **before** anything else, because a
Server Action and a page share a URL and only the method and header tell them apart. And it
checks the `rsc` header **before** `request.mode`, because a prefetch is neither a navigation
nor an ordinary subresource and would otherwise fall through to `'other'`.

## The handler

```js title="public/sw.js (continued)"
self.addEventListener('fetch', (event) => {
  const kind = classify(event.request)

  // Never intervene in a mutation. A replayed Server Action is a duplicated order.
  if (kind === 'server-action' || kind === 'mutation' || kind === 'cross-origin') return

  if (kind === 'immutable') {
    event.respondWith(cacheFirst(event.request, STATIC_CACHE))
    return
  }

  if (kind === 'document') {
    event.respondWith(networkFirstDocument(event.request))
    return
  }

  // 'rsc', 'image', 'api', 'other': straight to the network for now. Adding any of
  // these is a separate decision with its own invalidation story.
})

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  const hit = await cache.match(request)
  if (hit) return hit
  const response = await fetch(request)
  // Only store a real, complete response. An opaque or error response poisons the cache.
  if (response.ok && response.type === 'basic') cache.put(request, response.clone())
  return response
}

async function networkFirstDocument(request) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(PAGES_CACHE)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    const cache = await caches.open(PAGES_CACHE)
    return (await cache.match(request)) ?? (await caches.match(OFFLINE_URL)) ?? Response.error()
  }
}
```

Notice that `'rsc'` is classified and then deliberately **not** cached. Classifying it is not
optional even so — without the branch it would be indistinguishable from a document or an
`'other'` subresource, which is how the wrong body gets served.

## Why `/_next/static/` is the one safe cache-first case

Everything under `/_next/static/` is content-addressed: the filename contains a hash of the
contents, so a given URL's bytes never change. That is what makes cache-first correct there and
almost nowhere else — there is no staleness to reason about, only storage to reclaim. The
deployment-side consequences of that immutability, including what happens to a client holding
URLs from a previous build, are in
[immutable static assets across deployments](../16-deployment-scaling-and-observability/18-immutable-static-assets-across-deployments.md).

The mirror image is `public/`: those files are **not** content-addressed, and Next serves them
with `Cache-Control: public, max-age=0`. Cache-first on `public/` means you have taken
responsibility for invalidating them, and the only lever you have is a cache-name version bump.

## Gotchas

### Matching with `ignoreSearch: true`
**Symptom.** A soft navigation renders a blank page, or a browser tab displays raw
`text/x-component` output.
**Cause.** `cache.match(request, { ignoreSearch: true })` collapses `/board` and
`/board?_rsc=abc123` into one entry. The two are different content types.
**Fix.** Never ignore the query on an App Router origin. Match on the full request and classify
explicitly:

```js
// Wrong on an App Router origin:
// const hit = await cache.match(request, { ignoreSearch: true })
const hit = await cache.match(request)
```

### Caching by `url.pathname` instead of by request
**Symptom.** The same failure as above, with no query parameter to blame — a prefetch that used
only the `rsc` header, not `_rsc`.
**Cause.** The RSC variant and the HTML variant of a route share a pathname. The distinguishing
signal is a header, which a pathname key throws away.
**Fix.** Key the cache on the `Request`, and branch on `request.headers.get('rsc')` before you
decide the entry is a document.

### A Server Action replayed by the worker
**Symptom.** Duplicate records after a flaky connection.
**Cause.** A `fetch` handler that retries failed requests indiscriminately. A Server Action is a
`POST` and is not idempotent.
**Fix.** Return early from the handler for anything that is not a `GET`, as in the classifier
above. Retrying framework mutations is the job of `experimental.useOffline`, which retries once
on reconnect rather than in a loop — see
[offline Server Actions and testing](../07-error-handling-loading-states-and-resilience/12b-offline-server-actions-and-testing.md).

### Cache-first on `public/`
**Symptom.** A replaced logo or PDF never updates for existing users.
**Cause.** `public/` files are not content-hashed; the URL is stable across content changes and
Next serves them with `max-age=0`, which the Cache API does not consult once you have stored
the response yourself.
**Fix.** Either version the filename (`/logo.v2.svg`) or keep those paths out of the cache-first
branch. Cache-first is only free where the URL contains a content hash.

## Interview questions

**★ Why is a URL not a sufficient cache key in an App Router application?**
Because a route's HTML document and its RSC payload share a URL and differ by a request header —
`rsc` in Next 16 — with prefetches additionally carrying a `_rsc` query parameter. A cache keyed
on URL, or matched with `ignoreSearch: true`, will store one and serve it in place of the other.
The symptoms are a blank soft navigation or raw `text/x-component` rendered in a tab, neither of
which looks like a caching bug.

**What is the `_rsc` query parameter for?**
It exists to make a prefetch request URL-distinct from the document request for the same route,
so caches that key on URL — CDNs, proxies, and your service worker — do not conflate them. The
constant is named `NEXT_RSC_UNION_QUERY` in the Next.js source, which is a fair description of
its job.

**★ Which Next.js paths are safe to cache with a cache-first strategy, and why only those?**
`/_next/static/**`. Those filenames contain a content hash, so a given URL's bytes never change
and there is no staleness to reason about — only storage to reclaim. Everything else, including
`public/`, has a stable URL with mutable content; Next even serves `public/` with
`Cache-Control: public, max-age=0`. Cache-first there means you have silently taken on
invalidation with no mechanism to perform it.

**★ Should a service worker retry a failed Server Action?**
No. It is a `POST` and it is not idempotent; a retry is a duplicated mutation. The classifier
should return early for any non-`GET` request, and specifically for a `POST` carrying the
`next-action` header. Retrying framework requests on reconnect is what
`experimental.useOffline` does, once, at the framework layer that knows what is in flight.

---

← [10i · Offline strategy and the `useOffline` boundary](10i-offline-strategy-and-the-useoffline-boundary.md) · [Chapter 12 overview](01-explanation.md) · Next → [10k · Cache budget and eviction](10k-service-worker-cache-budget-and-eviction.md)
