---
title: "Browser storage is evicted per origin and all at once, so every cache you write to needs a bound and every response you store needs a reason"
sidebar_label: "10k · Cache budget and eviction"
sidebar_position: 41
description: "Opaque responses and padded quota, bounding the /_next/image cache, navigator.storage.persist(), never caching authenticated documents, and when Serwist is the better answer."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-03 against the Next.js
> [PWA guide](https://nextjs.org/docs/app/guides/progressive-web-apps) (its Serwist
> recommendation) and MDN's
> [`StorageManager.persist()`](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist)
> and [`StorageManager.estimate()`](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/estimate).
> Target: **Next.js 16.3.4**, App Router. Documentation-verified; **no sandbox run**.

**Every service worker tutorial ends at "and now it works offline". The failure that follows,
weeks later, is that the origin hits its storage quota and the browser deletes the whole
thing — not the least useful entries, the entire origin — taking the offline fallback out with
the megabytes of thumbnails that caused it.** Eviction is all-or-nothing, so a cache with no
bound is not "generous", it is a scheduled outage for the feature it was supposed to provide.
This page is the budget side of [10j](10j-caching-next-asset-classes-in-a-service-worker.md):
what to refuse to store, how to bound what you do store, and what to reach for instead of
hand-rolling all of it.

## Storage is finite and eviction is all-or-nothing

Browsers evict per origin, and they do not evict selectively — losing the quota means losing
the offline fallback along with the megabyte of images that caused the problem. Two
consequences:

- **Bound every cache you write to.** A `/_next/image` cache with no cap grows with every
  distinct `w` and `q` combination a user encounters.
- **Ask for persistence if the app genuinely needs it.** `navigator.storage.persist()` requests
  that the origin's storage not be cleared under pressure, and `navigator.storage.estimate()`
  reports usage and quota. Both are advisory: the browser decides, and Safari's behaviour here
  is its own topic — see [10p](10p-ios-and-safari-limits.md).

```js title="public/sw.js (excerpt)"
async function putBounded(cacheName, request, response, maxEntries) {
  const cache = await caches.open(cacheName)
  await cache.put(request, response)
  const keys = await cache.keys()
  // Oldest-first: keys() returns insertion order.
  for (const key of keys.slice(0, Math.max(0, keys.length - maxEntries))) {
    await cache.delete(key)
  }
}
```

## When to reach for a library instead

The Next.js PWA guide names [Serwist](https://github.com/serwist/serwist) as one option for
full service-worker-based offline caching, with Next.js integration examples for both Turbopack
and webpack. That is a reasonable read of the trade-off: precache manifests generated from the
build, route-based strategies and cache expiry are a lot of correctness to hand-roll, and the
classification above is the part you still have to understand either way — a library that
caches the wrong request class is exactly as broken as your own code doing it.

⚠️ Serwist is **not** pinned in this corpus, so nothing here watches its version. Treat any
version-specific detail you find elsewhere as unverified.


## Asking for persistence, and reading the budget

`navigator.storage.persist()` requests persistent storage for the origin. Per MDN it resolves
to a boolean, the browser may decline for its own reasons, and a `true` result means storage
will not be cleared except by explicit user action. It is a request, not a setting — write the
code so a `false` is unremarkable.

```tsx title="app/components/request-persistence.tsx"
'use client'

import { useEffect } from 'react'

export function RequestPersistence() {
  useEffect(() => {
    // Only ask once the user has committed to the app — a cold-visit request is
    // more likely to be declined and buys nothing.
    if (!navigator.storage?.persist) return
    void navigator.storage.persist()
  }, [])
  return null
}
```

`navigator.storage.estimate()` is the companion: it reports the origin's current usage and the
quota the browser is currently willing to give it. Both numbers are advisory and both move, so
treat the ratio as a signal to prune rather than a number to display:

```ts
async function shouldPrune(threshold = 0.8) {
  const { usage = 0, quota = 0 } = (await navigator.storage?.estimate?.()) ?? {}
  return quota > 0 && usage / quota > threshold
}
```

## Unregistering a worker does not delete its caches

The Cache API is **origin-scoped storage**, not part of the registration. Removing the worker
with `registration.unregister()` leaves every cache it created exactly where it was, counting
against the same quota, with nothing left running to clean them up. That is why the emergency
worker in [10h](10h-service-worker-update-detection-and-recovery.md) deletes all caches
*before* it unregisters — the order matters, because after unregistering there is no worker to
run the deletion.


## Gotchas

### Caching an opaque cross-origin response
**Symptom.** The cache fills far faster than the bytes you stored, and eviction hits early.
**Cause.** A no-cors response is opaque: status `0`, unreadable body, and browsers charge it
against quota at a padded size. Storing fonts or images from a third-party CDN this way is the
usual route in.
**Fix.** Filter on `response.type === 'basic'` and `response.ok` before `cache.put`, as in
`cacheFirst` above. If you must cache a third-party asset, self-host it instead — then it is
`basic`, and it is also covered by your CSP.

### An unbounded image cache
**Symptom.** The origin's storage quota is exhausted and the browser evicts everything,
including the offline fallback.
**Cause.** `/_next/image` responses vary by `url`, `w` and `q`, so a gallery generates a large
number of distinct cache keys.
**Fix.** Bound it, as in `putBounded` above, and pick a limit you can justify — the failure mode
of "too small" is a network fetch, and the failure mode of "too large" is losing the entire
cache.

### Caching a document response that carries a `Set-Cookie`
**Symptom.** Two users on a shared device, or one user across a logout, see the other's page.
**Cause.** A cached HTML response carries whatever personalisation the server rendered into it,
and the Cache API has no notion of a session.
**Fix.** Do not cache authenticated documents. Restrict the document cache to routes you know
are public, by allowlist rather than by exclusion:

```js
const PUBLIC_DOCUMENT_PATHS = ['/', '/pricing', '/docs', '/offline']

function isCacheableDocument(url) {
  return PUBLIC_DOCUMENT_PATHS.some(
    (path) => url.pathname === path || url.pathname.startsWith(`${path}/`)
  )
}
```


### Orphaned caches from a worker you removed
**Symptom.** Storage usage stays high after you decided to drop the service worker entirely.
**Cause.** `unregister()` removes the registration. `caches` is separate origin storage and
survives it.
**Fix.** Delete first, unregister second — never the other way round:

```js
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.map((key) => caches.delete(key))) // first
      await self.registration.unregister()                     // then
    })()
  )
})
```

### `caches.match()` used where you meant one cache
**Symptom.** A stale entry from a previous deploy's cache is served even though the current
cache was rebuilt.
**Cause.** `caches.match(request)` searches **every** cache in the origin, oldest included. It
is a convenience that quietly defeats version-keyed cache names.
**Fix.** Open the specific cache and match against it; reserve the global form for the one
place it is genuinely what you want, such as a last-resort offline fallback lookup:

```js
const cache = await caches.open(CACHE)   // this deploy's cache only
const hit = await cache.match(request)
```

## Interview questions

**Why filter on `response.type === 'basic'` before caching?**
To keep opaque cross-origin responses out. A no-cors response has status `0` and an unreadable
body, and browsers charge it against the origin's quota at a padded size — so it is both useless
to you and disproportionately expensive. If you need a third-party asset offline, self-host it.

**What happens when a browser evicts your origin's storage?**
It goes as a unit. You do not lose the least useful entries; you lose the cache, including the
offline fallback that was the point of the exercise. That is why every write path is bounded and
why `navigator.storage.persist()` exists — though it is a request, not a guarantee.
**When would you use Serwist rather than writing the worker yourself?**
When you need a build-generated precache manifest, per-route strategies and cache expiry —
that is a lot of correctness to hand-roll, and the Next.js PWA guide names it as an option with
integration examples for both bundlers. It does not remove the need to understand request
classification: a library configured to cache the wrong class is exactly as broken as your own
code doing it. Note that it is not pinned in this corpus, so nothing here tracks its version.

**Your worker caches documents and a logged-out user sees a logged-in page. What went wrong?**
A personalised HTML response was written to the Cache API, which has no concept of a session.
The fix is an allowlist of genuinely public routes for the document cache, not an exclusion list
— exclusion lists are wrong by omission the first time someone adds a route.

**What does `navigator.storage.persist()` actually promise?**
Per MDN it resolves to a boolean, the browser may decline, and a `true` result means the
origin's storage will not be cleared except by explicit user action. It is a request whose
answer depends on browser-specific rules, so treat `false` as the normal case and keep the
caches bounded regardless. Ask for it after the user has committed to the app, not on a cold
first visit.

**★ Does removing a service worker free the space its caches used?**
No. The Cache API is origin-scoped storage independent of the registration, so `unregister()`
leaves every cache in place with nothing running to clean it up. Delete the caches first and
unregister second — after unregistering, there is no worker left to run the deletion.

**What is wrong with `caches.match(request)`?**
Nothing, if you meant it: it searches every cache in the origin. That is usually not what you
meant, because it will happily return an entry from a previous deploy's version-keyed cache and
undo the whole point of versioning the name. Open the specific cache and match against that.

---

← [Caching Next asset classes in a worker](10j-caching-next-asset-classes-in-a-service-worker.md) · [Chapter 12 overview](01-explanation.md) · Next → [Web Push: the subscription flow](10l-web-push-the-subscription-flow.md)
