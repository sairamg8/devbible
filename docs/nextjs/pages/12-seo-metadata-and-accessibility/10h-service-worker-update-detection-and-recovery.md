---
title: "The browser compares your worker byte-for-byte and checks at most once a day for free, so update speed and the ability to recover are both things you build"
sidebar_label: "10h · Update detection and recovery"
sidebar_position: 14
description: "registration.update(), the byte-for-byte comparison and its blind spot, the 24-hour cache floor, why controller is null under Shift+reload, and the unregistering worker."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-03 against MDN
> [`ServiceWorkerRegistration.update()`](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/update),
> [`ServiceWorkerContainer.controller`](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerContainer/controller)
> and [`ServiceWorkerContainer.register()`](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerContainer/register),
> plus the Next.js [PWA guide](https://nextjs.org/docs/app/guides/progressive-web-apps).
> Target: **Next.js 16.3.4**, App Router. Documentation-verified; **no sandbox run**.

**Before a worker can wait, activate or claim anything, the browser has to notice it changed —
and the rule it uses is cruder than most people assume: it fetches the script URL and compares
bytes.** That has a blind spot big enough to hide a real behavioural change in, a 24-hour floor
that is the only automatic freshness guarantee you get, and one debugging habit — Shift +
reload — that produces a convincing false negative. This page is detection, plus the recovery
worker you should have committed before the incident. The lifecycle those updates flow through
is [10g](10g-the-service-worker-update-lifecycle.md).

## When the browser actually looks for a new worker

`registration.update()` fetches the script URL and, per MDN, installs the result **if it is not
byte-for-byte identical** to the current worker. Two details make that sentence more useful
than it looks.

**Byte-for-byte, not semantically.** A worker whose only change is a comment is a new worker. A
worker whose behaviour changed but whose bytes did not — because you changed a file it
`importScripts()`es, or a constant it reads from a cached response — is *not*. This is why the
version constant lives in the worker file itself and gets bumped on every deploy that changes
what the worker should do.

**The 24-hour floor.** MDN states that the fetch of the worker bypasses browser caches if the
previous fetch happened more than 24 hours ago. That is a floor, not a schedule: it guarantees
a stale worker cannot outlive a day *of cached script responses*, and it is the only automatic
guarantee you get. Everything faster than that is your `Cache-Control` header plus an explicit
`update()` call.

```tsx title="app/components/sw-register.tsx (excerpt)"
// Check for a new worker when the tab regains focus, not on a timer:
// a background tab that polls is pure battery cost.
useEffect(() => {
  const onVisible = async () => {
    if (document.visibilityState !== 'visible') return
    const reg = await navigator.serviceWorker.getRegistration()
    await reg?.update()
  }
  document.addEventListener('visibilitychange', onVisible)
  return () => document.removeEventListener('visibilitychange', onVisible)
}, [])
```

## `controller` is null more often than you expect

`navigator.serviceWorker.controller` is the worker currently controlling this page — `null`
when there is none. MDN also documents a case that ruins ad-hoc testing: **it returns `null` on
a force refresh (Shift + reload)**. So the sequence "register the worker, shift-reload to be
sure, observe that nothing is cached, conclude the worker is broken" is a false negative, and
it is exactly what a developer does when debugging.

It is also why the update detection in [10f](10f-service-workers-in-the-app-router.md) checks
`navigator.serviceWorker.controller` before treating an `installed` worker as an *update*. On
the very first registration there is no controller, the worker goes straight through to
activated, and there is nothing to prompt the user about.

## The kill switch you should write before you need it

A service worker you cannot remove is the worst outcome available. Write the unregistering
worker *first*, keep it in the repo, and know that shipping it at `/sw.js` replaces the broken
one on the next update check:

```js title="public/sw.js — the emergency replacement"
self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.map((key) => caches.delete(key)))
      await self.registration.unregister()
      const clients = await self.clients.matchAll({ type: 'window' })
      for (const client of clients) client.navigate(client.url)
    })()
  )
})
```

This only reaches users whose browser performs an update check, which is why the `Cache-Control`
header on the worker script is not optional.


## Gotchas
### Debugging with Shift + reload and concluding the worker is broken
**Symptom.** Nothing appears to be served from cache; `navigator.serviceWorker.controller` is
`null` even though the worker is activated.
**Cause.** MDN documents that `controller` returns `null` on a force refresh. A force-refreshed
document is deliberately uncontrolled so you can always get past a broken worker.
**Fix.** Test with an ordinary reload, and reserve Shift + reload for the case where you need
to bypass the worker on purpose. Assert on the registration, not the controller:

```js
const reg = await navigator.serviceWorker.getRegistration()
// `active` is truthy regardless of whether THIS document is controlled.
console.assert(Boolean(reg?.active), 'no active worker for this scope')
```

### A whitespace-only change ships as a new worker; a real change does not
**Symptom.** Either pointless update prompts, or an update that never happens after a genuine
behaviour change.
**Cause.** The update check is byte-for-byte on the worker script. Reformatting triggers it;
changing a file the worker imports, or data it reads at runtime, does not.
**Fix.** Put a version constant in the worker file and derive the cache name from it, so any
behavioural change necessarily changes the script's bytes:

```js title="public/sw.js"
// Bumped by the release script; the cache name and the update check both key off it.
const VERSION = 'sd-2026-09-03-a'
const CACHE = `sprintdesk-${VERSION}`
```

### Registering a different script URL on the next deploy
**Symptom.** Two service worker registrations for the same origin, both live.
**Cause.** Registration identity is the scope, but a changed *script URL* under the same scope
replaces the registration, while a changed **scope** creates a second one. Hashing the worker's
filename per build produces a new URL every deploy, which defeats the byte-comparison update
path entirely.
**Fix.** Keep the worker at one stable URL — `/sw.js` — forever, and version its *contents*.
Never fingerprint the service worker filename the way you would an ordinary asset.

### An `install` handler that rejects leaves a redundant worker
**Symptom.** The update prompt never appears; a new worker briefly exists and disappears.
**Cause.** If the promise passed to `waitUntil` in `install` rejects — most often because one
URL in a precache list 404s — the worker moves to `redundant` and the old one stays in charge.
One missing file fails the whole install.
**Fix.** Do not let a single optional asset fail the install. Cache the required shell with
`addAll`, and the optional extras individually, tolerating failures:

```js
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE)
      // Required: if any of these is missing, failing the install is correct.
      await cache.addAll(['/offline', '/icons/icon-192.png'])
      // Optional: never block the install on these.
      await Promise.allSettled(['/fonts/inter.woff2'].map((url) => cache.add(url)))
    })()
  )
})
```

## Interview questions

**★ You shipped a broken service worker. How do you recover?**
Deploy a replacement at the same URL whose `install` calls `skipWaiting()` and whose `activate`
deletes every cache, calls `registration.unregister()`, and navigates open clients to their own
URL. It only reaches a user whose browser performs an update check, which is why
`Cache-Control: no-cache, no-store, must-revalidate` on the worker script has to be in place
*before* the incident — a worker script pinned in a CDN is genuinely unrecoverable for the
duration of that TTL.

**★ How does the browser decide a service worker has changed?**
It fetches the script URL and compares bytes. MDN's wording is that the new worker is installed
if it is not byte-by-byte identical to the current one. That has a sharp edge in both
directions: a whitespace change is an update, and a behavioural change that lives in an
imported file or in runtime data is not. Keep a version constant inside the worker script and
bump it with every behavioural change, so the bytes always move when the behaviour does.

**Is there an automatic update check, and how fast is it?**
The only guarantee MDN states is that the worker fetch bypasses browser caches when the
previous fetch was more than 24 hours ago. That is a ceiling on staleness, not a polling
schedule. If you want faster, send `Cache-Control: no-cache, no-store, must-revalidate` on the
script and call `registration.update()` yourself — on visibility change is a reasonable trigger,
a timer in a background tab is not.

**Why is `navigator.serviceWorker.controller` null when the worker is clearly installed?**
Three reasons, and the third catches everyone. There may be no active worker; the worker may be
active but not yet claiming this document (the first load after registration, absent
`clients.claim()`); or the document was loaded with a force refresh, which MDN documents as
returning `null` deliberately, so a broken worker can never lock a developer out.

**Why must the service worker keep a stable filename across deploys?**
Because the update mechanism is "fetch this exact URL and compare it to the installed worker".
Fingerprinting the filename gives every deploy a new URL, so nothing is ever compared to
anything and you accumulate registrations instead of updating one. It is the opposite of the
rule for every other static asset in the build.

**What happens if your `install` handler rejects?**
The worker goes `redundant` and the previous one keeps control. The usual cause is a precache
list containing a URL that 404s — `cache.addAll()` rejects as a unit. Split required assets
from optional ones and settle the optional ones individually, so one missing font does not
block every future update.

---

← [10g · The service worker update lifecycle](10g-the-service-worker-update-lifecycle.md) · [Chapter 12 overview](01-explanation.md) · Next → [10i · Offline strategy and the `useOffline` boundary](10i-offline-strategy-and-the-useoffline-boundary.md)
