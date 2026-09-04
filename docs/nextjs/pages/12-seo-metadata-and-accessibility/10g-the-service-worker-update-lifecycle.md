---
title: "A new service worker installs immediately and then waits, which is why the deploy that fixed the bug did not fix it for anyone"
sidebar_label: "10g · The service worker update lifecycle"
sidebar_position: 37
description: "install → waiting → activate, skipWaiting and clients.claim, the controllerchange reload, cache versioning, and the unregistering worker you write before you need it."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-03 against MDN
> [`ServiceWorkerContainer.register()`](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerContainer/register)
> and the Next.js [PWA guide](https://nextjs.org/docs/app/guides/progressive-web-apps).
> Target: **Next.js 16.3.4**, App Router. Documentation-verified; **no sandbox run**.

**Every other deploy you do replaces the running code the moment a user reloads. A service
worker does not, and that single asymmetry is responsible for most production service worker
incidents: the fix is on the CDN, the browser has already downloaded it, and the user is still
being served by yesterday's worker because the new one is sitting in a waiting state that a
reload does not clear.** This page is the lifecycle, the two levers that override it, the cost
of pulling each, and the reload handshake that makes an update safe. It follows
[10f](10f-service-workers-in-the-app-router.md), which covers where the file lives and how it
is registered; how the browser *detects* an update in the first place, and how you recover from
a worker you cannot remove, is [10h](10h-service-worker-update-detection-and-recovery.md).

## The lifecycle, and why your new worker is not running

This is the part that produces "I deployed and nothing changed" bug reports.

```
register()
   │
   ▼
installing ──(install handler resolves)──► installed / waiting
   │                                            │
   │ (install handler rejects)                  │ blocked while any client
   ▼                                            │ controlled by the OLD worker
 redundant                                      │ is still open
                                                ▼
                                             activating ──► activated
```

A new worker **installs immediately** and then **waits**. It does not take over while any tab
controlled by the previous worker is open — and a reload does not necessarily close that tab's
control, because the new document is claimed by the old worker before it unloads. The user
usually has to close every tab of your site.

Two levers change that, and neither is free.

```js title="public/sw.js"
self.addEventListener('install', (event) => {
  // Skip the waiting phase: activate as soon as install finishes.
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Delete every cache that is not this version's.
      const keys = await caches.keys()
      await Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key)))
      // Take control of already-open pages that the old worker was serving.
      await self.clients.claim()
    })()
  )
})
```

`skipWaiting()` plus `clients.claim()` gives you "new worker wins immediately". It also means a
page that loaded its JavaScript under worker v2 can suddenly be served assets by worker v3
mid-session — and in an App Router app that page is still doing client-side navigation, still
requesting RSC payloads for routes it has not visited, and still holding references to chunk
URLs from the previous build. If v3's cache logic no longer serves those chunk URLs, the next
navigation fails.

The conservative shape is to let the worker wait, tell the user, and reload on their command:

```tsx title="app/components/sw-register.tsx"
'use client'

import { useEffect, useState } from 'react'

export function ServiceWorkerRegistration() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    let cancelled = false

    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then((reg) => {
      if (cancelled) return
      if (reg.waiting) setWaiting(reg.waiting)
      reg.addEventListener('updatefound', () => {
        const next = reg.installing
        if (!next) return
        next.addEventListener('statechange', () => {
          // "installed" with an existing controller means: a new version is waiting.
          if (next.state === 'installed' && navigator.serviceWorker.controller) {
            setWaiting(next)
          }
        })
      })
    })

    // The controller changes exactly once per activation; reload then, not before.
    let reloading = false
    const onControllerChange = () => {
      if (reloading) return
      reloading = true
      window.location.reload()
    }
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)

    return () => {
      cancelled = true
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
    }
  }, [])

  if (!waiting) return null

  return (
    <button onClick={() => waiting.postMessage({ type: 'SKIP_WAITING' })}>
      A new version is ready — reload
    </button>
  )
}
```

with the worker side listening for the message rather than calling `skipWaiting()` on install:

```js title="public/sw.js"
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})
```

The `reloading` guard exists because `controllerchange` can fire more than once across a
session, and a reload loop is a genuinely hard bug to diagnose from a user report.


## Gotchas

### The new worker is deployed and users keep the old one
**Symptom.** A fix is live on the CDN and users still hit the old behaviour after reloading.
**Cause.** The new worker installed and is **waiting**. A reload does not release the old
worker's control; every tab of the origin has to close first.
**Fix.** Either the message-and-reload flow above, or `skipWaiting()` + `clients.claim()` if
you have accepted the mid-session-swap risk. Doing neither is a decision too, and it is the one
that produces the bug report.

### `skipWaiting()` breaks the page that is open
**Symptom.** Navigations fail after an update, until a manual reload.
**Cause.** The running page was built against the previous deploy's chunk URLs. A new worker
that no longer serves them takes over mid-session.
**Fix.** Pair `skipWaiting()` with a `controllerchange` handler that reloads once, as shown —
if you activate immediately, you must also reload immediately.

### `event.waitUntil` omitted in `install` or `activate`
**Symptom.** Caches are half-populated; old caches are not deleted.
**Cause.** Without `waitUntil`, the browser considers the handler finished when it returns
synchronously and may kill the worker mid-promise.
**Fix.** Wrap every async lifecycle body in `event.waitUntil(...)`, as in every snippet above.

### Old caches never deleted
**Symptom.** Storage grows across deploys until the browser evicts the whole origin — taking
the *current* cache with it.
**Cause.** A version-keyed cache name with no cleanup step.
**Fix.** Delete every key that is not the current version in `activate`, as shown. Version the
cache name on the deploy, not on the calendar.



## Interview questions

**★ Why does a newly deployed service worker not take effect on reload?**
Because a new worker installs and then enters a **waiting** state. It cannot activate while any
client controlled by the previous worker exists, and a reload does not break that control — the
incoming document is claimed by the old worker before the old one unloads. In practice the user
must close every tab of the origin. That is why apps ship either `skipWaiting()` plus a
`controllerchange` reload, or an explicit "new version ready" prompt that posts a message to
the waiting worker.

**★ What does `clients.claim()` do that `skipWaiting()` does not?**
`skipWaiting()` promotes the waiting worker to active. `clients.claim()` makes that active
worker take control of pages that are already open and were being served by the old one.
Without `claim()`, the new worker is active but controls nothing until the next navigation.
They are almost always used together, and using them together is what forces you to handle the
mid-session swap.

**What is `event.waitUntil` for and what breaks without it?**
It extends the lifetime of the `install` or `activate` event until a promise settles. Without
it the browser may consider the handler complete as soon as it returns and terminate the
worker, leaving a cache half-populated or old caches undeleted. Every asynchronous lifecycle
handler needs it.

---

← [Service workers in the App Router](10f-service-workers-in-the-app-router.md) · [Chapter 12 overview](01-explanation.md) · Next → [Update detection and recovery](10h-service-worker-update-detection-and-recovery.md)
