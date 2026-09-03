---
title: "With `useOffline`, a dropped connection stops being an error and becomes a pending state"
sidebar_label: "12 · Network resilience and `useOffline`"
sidebar_position: 14
description: "The experimental useOffline flag, exactly what it covers, why the hook beats navigator.onLine, and the loading state that now means two different things."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-03 against the Next.js
> [Handling connectivity drops guide](https://nextjs.org/docs/app/guides/offline-support)
> and the [Next.js 16.3 release post](https://nextjs.org/blog/next-16-3).
> Target: **Next.js 16.3.4**, App Router.
> 🔴 **Experimental and subject to change; the docs say it is not recommended for production.**

**Normally a network failure during a soft navigation, an RSC data fetch or a Server Action
throws in the client, and you build a fallback that asks the user to try again.** With
`experimental.useOffline` enabled, none of that reaches your code: Next.js keeps the request
**pending** and retries it once the connection returns. The awaited promise eventually
resolves with the server's response. No try/catch, no retry loop, no reconnection handler.
The catch — and it is a real one — is that a pending request looks exactly like a slow server,
so the feature ships with a hook whose only job is to let you tell the user which of the two
they are looking at.

## Enabling it

The guide pairs it with Cache Components and Partial Prefetching, because those decide what is
available to render while offline:

```ts filename="next.config.ts"
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    useOffline: true,
  },
}

export default nextConfig
```

Cache Components lets you put the Suspense boundary as close as possible to the uncached data,
with the **App Shell** rendered around it. Partial Prefetching makes that App Shell the unit a
`<Link>` prefetches — **and that prefetch is what makes the shell available offline at all.**

Without Cache Components, a route-level `loading.tsx` does the same job: it gives Next.js a
boundary to prefetch as the route's shell. The hook, the banner and Server Action retry all
behave identically.

## What it covers, and what it does not

| Covered — stays pending and retries | Not covered |
|---|---|
| Soft navigations into **prefetched** routes | A **full page reload** while offline |
| RSC data fetches | `fetch()` you issue in a Client Component |
| Prefetches | React Query / SWR — their own retry policy applies |
| Server Actions called from the current page | |

🔴 **A full page reload while offline still fails**, because the browser needs the network to
deliver the HTML. Genuine full-offline loads require a service worker — that is the PWA guide's
territory, not this flag's.

## The hook, and why it beats `navigator.onLine`

```tsx filename="app/offline-banner.tsx"
'use client'

import { useOffline } from 'next/offline'

export function OfflineBanner() {
  const isOffline = useOffline()
  if (!isOffline) return null

  return (
    <div role="status">
      Offline. Pending requests will retry once you are back online.
    </div>
  )
}
```

`useOffline()` returns `true` when the browser fires an `offline` event **or when a navigation,
prefetch or Server Action fetch fails**. It flips back to `false` when a background
connectivity check succeeds.

That second trigger is the whole point. **`navigator.onLine` only reflects the OS network
interface**, so a device connected to WiFi with no upstream internet still reports `true` —
the single most common false negative in connectivity detection. `useOffline` observes actual
request outcomes, so a captive portal or a dead uplink registers.

⚠️ **It returns `false` during server-side rendering and initial hydration.** The first
accurate value is whatever the browser reports after the app mounts, so never render a
connectivity-dependent branch as though the first value were authoritative.

Note `role="status"` on the banner. A connectivity change that is only visible is a
connectivity change a screen reader user does not learn about.

## Making the loading state say which kind of wait it is

Because a pending request renders the ordinary Suspense fallback, "loading" now means either
*the server is slow* or *you have no network*. Make the fallback itself offline-aware:

```tsx filename="app/dashboard/connectivity-fallback.tsx"
'use client'

import { useOffline } from 'next/offline'

export function ConnectivityFallback() {
  const isOffline = useOffline()
  return (
    <p>
      {isOffline
        ? 'Waiting for connection to load this section...'
        : 'Loading...'}
    </p>
  )
}
```

```tsx filename="app/dashboard/page.tsx"
import { Suspense } from 'react'
import { ConnectivityFallback } from './connectivity-fallback'

export default function Dashboard() {
  return (
    <section>
      <h1>Live metrics</h1>
      <Suspense fallback={<ConnectivityFallback />}>
        <MetricsTable />
      </Suspense>
    </section>
  )
}
```

Navigate offline and the shell renders from the prefetch while the fallback explains the wait.
Restore the connection and the table streams in — Next.js retried on its own.

The guide's recommendation is both: a **banner in the root layout** for app-wide state, and an
offline-aware **Suspense fallback** where the content is actually loading.

The pattern extends to parameterized routes. `/chats/[id]` renders its shared App Shell when
you navigate to `/chats/42` offline, and the messages behind its Suspense boundary load when
the connection returns. If the route also prefetches its **per-link URL data** ahead of the
click, those messages render immediately, offline, without waiting for reconnection.

## Gotchas

### Expecting a full page reload to work offline

**Symptom.** Soft navigation offline works; pressing refresh gives the browser's error page.

**Cause.** A reload needs the network to deliver the HTML. The flag covers soft navigations
into prefetched routes and Server Actions from the current page — not cold loads.

**Fix.** If genuine offline loading is a requirement, that is a **service worker**, via the PWA
guide. This flag is not a substitute.

### Rendering a connectivity branch on the first value

**Symptom.** A brief flash of the wrong state, or a hydration mismatch.

**Cause.** `useOffline()` returns `false` during SSR and initial hydration. The first accurate
value arrives after mount.

**Fix.** Treat the initial `false` as *unknown*. The banner pattern above is safe precisely
because `false` renders nothing.

### Assuming `fetch()` in a Client Component is covered

**Symptom.** Some requests retry themselves and others throw, in the same app.

**Cause.** The flag covers navigations, RSC fetches, prefetches and Server Actions. Direct
`fetch()` in a Client Component, and anything through React Query or SWR, stays under that
library's own retry policy.

**Fix.** Keep the two models straight: framework-issued requests are the framework's to retry;
yours are yours.

### Leaving the generic loading fallback in place

**Symptom.** Users report the app "hanging" when they are simply offline.

**Cause.** A pending request renders the ordinary Suspense fallback, which is
indistinguishable from a slow server.

**Fix.** Make the fallback offline-aware, and add a root-layout banner.

### A silent banner

**Symptom.** Sighted users see the offline state; screen reader users do not.

**Cause.** The banner is inserted into the DOM with nothing announcing it.

**Fix.** `role="status"`, as in the example. The state change is exactly the kind of ambient
update a live region exists for.

## Interview questions

**Q. What does `experimental.useOffline` change?**
A failed navigation, RSC data fetch, prefetch or Server Action no longer throws when the
network is down. Next.js keeps it pending and retries when the connection returns.

**Q. What is *not* covered?**
Full page reloads while offline, direct `fetch()` in Client Components, and client data
libraries like React Query or SWR, which keep their own retry policy.

**Q. Why is `useOffline()` better than `navigator.onLine`?**
`navigator.onLine` only reflects the OS network interface, so a device on WiFi with no upstream
internet still reports online. `useOffline` also flips true when an actual navigation, prefetch
or Server Action fetch fails.

**Q. What does it return during SSR and hydration?**
`false`. The first accurate value comes after the app mounts, so treat the initial value as
unknown rather than authoritative.

**Q. Why does the guide enable Cache Components and Partial Prefetching alongside it?**
Cache Components lets the Suspense boundary sit next to the uncached data with the App Shell
around it; Partial Prefetching makes that shell the unit a `<Link>` prefetches — and the
prefetch is what makes the shell renderable offline.

**Q. What if you are not using Cache Components?**
A route-level `loading.tsx` gives Next.js the same boundary to prefetch as the route's shell.

**Q. What is the UX problem the hook exists to solve?**
A pending request renders the normal loading state, so "offline" and "slow server" look
identical. The hook lets the fallback say which it is.

**Q. What would you need for genuine full-offline loading?**
A service worker — the Progressive Web Apps guide, not this flag.

**Q. On a route like `/chats/[id]`, what renders offline?**
The shared App Shell. The messages behind the Suspense boundary load on reconnect — unless the
route also prefetched its per-link URL data, in which case they render immediately.

---

**Next:** [12b · Retrying Server Actions, and testing any of this](12b-offline-server-actions-and-testing.md)
