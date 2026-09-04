---
title: "A service worker is a separate program with its own lifecycle that Next.js does not manage for you, and the two places you can put its file behave differently"
sidebar_label: "10f · Service workers in the App Router"
sidebar_position: 36
description: "Where the worker file lives, the scope rule and Service-Worker-Allowed, updateViaCache, the install/waiting/activate lifecycle, and why skipWaiting is not a default."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-03 against the Next.js
> [PWA guide](https://nextjs.org/docs/app/guides/progressive-web-apps),
> [`public` folder convention](https://nextjs.org/docs/app/api-reference/file-conventions/public-folder)
> and [`next` CLI reference](https://nextjs.org/docs/app/api-reference/cli/next),
> plus MDN
> [`ServiceWorkerContainer.register()`](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerContainer/register).
> Target: **Next.js 16.3.4**, App Router, Turbopack default. Documentation-verified;
> **no sandbox run**.

**Next.js has a file convention for the manifest and none at all for the service worker.
That asymmetry is the whole shape of this page: the manifest is framework-managed data, and
the service worker is a second program you are writing, deploying and versioning yourself,
running in a context with no DOM, no `window`, and a lifecycle that outlives the page that
registered it.** Nothing in the App Router — not `use cache`, not ISR, not Draft Mode — knows
it exists. This page is placement, scope and registration; the update lifecycle — the part that
produces "I deployed and nothing changed" — is [10g](10g-the-service-worker-update-lifecycle.md),
and what to actually cache is [10i](10i-offline-strategy-and-the-useoffline-boundary.md).

## What you are actually deploying

A service worker is an event-driven worker bound to an **origin and a scope**, installed
persistently by the browser, and **started and killed between events**. Three consequences that
catch people:

1. **It has no `window` and no DOM.** `self` is a `ServiceWorkerGlobalScope`. `localStorage` is
   not available; persistent state means IndexedDB or the Cache API.
2. **Module-level variables do not survive.** The browser terminates an idle worker and starts
   a fresh one for the next event. Anything you assign at the top of the file is initialised
   again on every wake — never treat it as a cache.
3. **It outlives your deploy.** An installed worker keeps running the code it was installed
   with until an update completes. A bad worker shipped once is served from the user's disk
   until you ship a good one *and* they let it activate.

That third point is why the rest of this page is mostly about the update lifecycle.

## Where the file goes: two options with different consequences

### Option A — `public/sw.js`, served from the origin root

`public/` is served from `/`, so `public/sw.js` is at `/sw.js`, and per the MDN rule the
default scope of a worker is the directory its script lives in — the root. No scope
negotiation, no header. The cost: the file is not bundled. No TypeScript, no `import` of your
own modules, no npm dependencies, and Next applies `Cache-Control: public, max-age=0` to
everything in `public/`.

```js title="public/sw.js"
// No bundling here: plain JS, no imports of app code.
const VERSION = 'v3'

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(['/offline'])))
})
```

### Option B — a bundled worker, as the Next.js guide shows

The guide registers the worker through the bundler, by handing `register()` a `URL` built
against `import.meta.url`:

```tsx title="app/components/sw-register.tsx"
'use client'

import { useEffect } from 'react'

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.register(
      new URL('../../lib/service-worker.js', import.meta.url),
      { scope: '/', updateViaCache: 'none' }
    )
  }, [])
  return null
}
```

That gets you a worker Turbopack processes as its own entry — which is what you want if the
worker imports anything. It also raises a question the documentation does not answer.

⚠️ **Unconfirmed, and it matters.** The guide passes `scope: '/'`, but a bundler-emitted asset
does not live at the origin root. MDN's rule is that a worker cannot claim a scope broader than
its own path unless the server sends a `Service-Worker-Allowed` header on the script response.
The Next.js documentation never states what URL the bundled worker is emitted at, nor whether
Next sets that header. **Check your own build output before relying on `scope: '/'` with a
bundled worker**; if the registration rejects, that rule is why, and Option A sidesteps it
entirely.

If you do need a broad scope for a script served from a subpath, the header is the documented
escape hatch:

```ts title="next.config.ts"
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Service-Worker-Allowed', value: '/' },
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ]
  },
}

export default nextConfig
```

The last three of those come straight from the PWA guide's security section. The
`Cache-Control` line is the important one: it stops an intermediary from pinning an old worker
script, which is the failure mode where users are stuck on a broken worker and no deploy fixes
it.

## `updateViaCache` — the option nobody reads

The guide passes `updateViaCache: 'none'` and moves on. Per MDN it takes three values, and they
control whether the **HTTP cache** is consulted when the browser checks for a new worker:

| Value | Main script | Imported scripts |
|---|---|---|
| `'all'` | HTTP cache first | HTTP cache first |
| `'imports'` | always network | HTTP cache first |
| `'none'` | always network | always network |

`'none'` is the right default for an app you deploy frequently, because it makes the update
check a real network request instead of a cache hit. It is also not a substitute for the
`Cache-Control` header above — `updateViaCache` governs the browser's own update check, and the
header governs every other cache between you and the user.

## Gotchas

### Registering during render instead of in an effect
**Symptom.** `ReferenceError: navigator is not defined` during build or SSR.
**Cause.** Registration is browser-only code placed in a component body, which runs on the
server too.
**Fix.** A `'use client'` leaf, registering inside `useEffect`, exactly as in the components
above — and feature-detect, because `serviceWorker` is absent in some embedded webviews:

```tsx
useEffect(() => {
  if (!('serviceWorker' in navigator)) return
  navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
}, [])
```

### A stale worker script cached by a CDN
**Symptom.** You ship the kill-switch worker and it never reaches anyone.
**Cause.** An intermediary is serving the old `/sw.js` from cache. `updateViaCache: 'none'`
governs the browser's own update check, not a proxy in front of your origin.
**Fix.** Send `Cache-Control: no-cache, no-store, must-revalidate` on the worker script, via
the `headers()` block above. Ship that header on day one, not the day you need it.

### `Service-Worker-Allowed` missing for a non-root script
**Symptom.** `register()` rejects with a `SecurityError`.
**Cause.** MDN's rule: a worker cannot claim a scope broader than its own path unless the
server says otherwise on the script response. A worker served from a bundler output directory
asking for `scope: '/'` is exactly that case.
**Fix.** Either serve it from the root (`public/sw.js`) or add the header:

```ts title="next.config.ts (excerpt)"
{ source: '/_next/static/:path*/sw.js', headers: [{ key: 'Service-Worker-Allowed', value: '/' }] }
```

Confirm the real emitted path against your own build output first — the Next.js docs do not
state it.

### Testing over `http://` on anything but localhost
**Symptom.** `SecurityError` from `register()`; nothing installs on the staging host.
**Cause.** Service workers require a secure context. `localhost` is exempt as a potentially
trustworthy origin; a plain-HTTP staging host is not.
**Fix.** `next dev --experimental-https` locally — the docs are explicit that it generates a
locally trusted `mkcert` certificate and is development-only — and real TLS everywhere else.

### Module-scope state in the worker treated as a cache
**Symptom.** A lookup table built at the top of `sw.js` is empty at random.
**Cause.** The browser terminates idle workers. The next event starts a fresh global scope.
**Fix.** Persist to the Cache API or IndexedDB and read it inside the event handler:

```js
self.addEventListener('fetch', (event) => {
  event.respondWith(
    (async () => {
      const cache = await caches.open(VERSION) // re-opened per event, cheap and correct
      return (await cache.match(event.request)) ?? fetch(event.request)
    })()
  )
})
```

## Interview questions

**★ Where should the worker file live in a Next.js project?**
`public/sw.js` if it does not need bundling: it is served from the origin root, so it gets root
scope with no header negotiation, at the cost of plain JavaScript and no imports. A bundled
worker registered with `new URL(..., import.meta.url)` — the form the Next.js guide uses — buys
you TypeScript and imports, but it is emitted somewhere under the build output, and the docs do
not state where or whether Next sends `Service-Worker-Allowed`. Verify against your own build
before assuming `scope: '/'` works.

**What is the scope rule, exactly?**
A worker's default scope is the directory of its script. It cannot claim a broader scope unless
the server sets a `Service-Worker-Allowed` header on the script response naming that wider
maximum. Violating it makes `register()` reject with a `SecurityError`, as does registering a
script that is not on a potentially trustworthy origin, or a scope that is not same-origin with
the registering page.

**What does `updateViaCache: 'none'` change?**
Whether the browser consults the HTTP cache when it checks for a new version of the worker.
`'all'` allows it for the main script and its imports, `'imports'` only for imports, `'none'`
for neither. `'none'` makes every update check a real network request. It does not affect
intermediaries — a CDN caching `/sw.js` still needs a `Cache-Control` header.

**Why can't you keep state in a module-level variable inside the worker?**
Because the browser terminates an idle service worker and starts a fresh instance for the next
event. Top-level assignments run again from scratch each time. Anything that must persist goes
in the Cache API or IndexedDB and is read inside the handler.

**Does the App Router know a service worker exists?**
No. There is a file convention for the manifest and none for the worker. Nothing in the caching
model — `use cache`, ISR revalidation, Draft Mode — is aware of it, and the worker in turn does
not understand RSC payloads unless you teach it. They are two independent caching layers that
happen to sit on the same URLs.

**Why does a service worker require HTTPS, and how do you develop against that?**
It can rewrite every response for its scope, so a network attacker who could inject one would
own the origin persistently. The API is therefore secure-context only. `localhost` is exempt as
a potentially trustworthy origin; for anything else, `next dev --experimental-https` generates a
locally trusted `mkcert` certificate for development, and the docs state plainly that production
needs properly issued certificates.

---

← [Detecting install state](10e-detecting-install-state.md) · [Chapter 12 overview](01-explanation.md) · Next → [The service worker update lifecycle](10g-the-service-worker-update-lifecycle.md)
