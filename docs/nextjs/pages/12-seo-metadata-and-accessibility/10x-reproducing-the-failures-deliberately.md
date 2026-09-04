---
title: "The bug that defines a production PWA — every user stranded on the build you replaced last Tuesday — takes two builds and one open tab to reproduce, and no audit that loads a page once can ever see it"
sidebar_label: "10x · Reproducing the update bug"
sidebar_position: 55
description: "Forcing the waiting-worker bug with two builds, forcing the skipWaiting chunk failure, and the harness that tells you which build is actually answering a tab."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-03 against MDN
> [`ServiceWorkerRegistration.update()`](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/update),
> Chrome DevTools' [Debug Progressive Web Apps](https://developer.chrome.com/docs/devtools/progressive-web-apps),
> the Next.js [offline support guide](https://nextjs.org/docs/app/guides/offline-support), and the
> App Router header constants in the Next.js canary source
> (`packages/next/src/client/components/app-router-headers.ts`).
> Target: **Next.js 16.3.4**, App Router, Node >= 20.9.
> Documentation-verified; **no sandbox run**.

**A service worker bug is a bug across two builds. It is not a property of a single page load,
which is why no audit — the deleted Lighthouse PWA category included — has ever caught one, and why
the engineer assigned to fix it usually cannot reproduce it.** The reproduction is not hard, it is
just unfamiliar: build twice, keep one tab open across the change, and ask the worker which build
is answering rather than looking at the screen. This page does that for both halves of the
lifecycle — the new worker that waits forever, and the `skipWaiting()` that swaps out from under a
running page. Everything here runs against a production build on a clean origin
([10w](10w-a-testable-environment-https-and-a-production-build.md)); the mechanisms are
[10g](10g-the-service-worker-update-lifecycle.md) and
[10h](10h-service-worker-update-detection-and-recovery.md). Offline and cache-content testing is the
next page, [10y](10y-testing-offline-and-what-the-cache-really-holds.md).

## Reproducing "everyone is stuck on the old build"

The bug is that a new worker installs and then **waits** — indefinitely, while any tab from the old
version remains open. Users experience it as a fix that shipped and never arrived. It requires two
builds to see at all.

Give the worker a version marker so the two builds differ by something you can read:

```js
// lib/service-worker.js
const BUILD = 'v1'; // change to 'v2' for the second build
const CACHE = `sprintdesk-${BUILD}`;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(['/offline'])));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE).map((n) => caches.delete(n))),
    ),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'WHICH_BUILD') {
    event.source?.postMessage({ build: BUILD });
  }
});
```

The procedure, with **Update on reload turned off** — that checkbox exists precisely to suppress
this behaviour, and leaving it on is why most engineers have never seen the bug on their own
machine:

1. `next build && next start -p 3100`, load the app, confirm a worker is controlling the page.
2. Leave the tab open.
3. Change `BUILD` to `v2`, `next build && next start -p 3100` again.
4. Reload the tab **once**.
5. The Service Workers pane now lists two versions: one activated, one waiting.

Step 5 is the bug, reproduced. Ask the page which build is answering it, rather than trusting the
UI to look different:

```ts
// lib/sw-test-harness.ts — which build is actually serving this tab?
export function askControllerForBuild(): Promise<string> {
  return new Promise((resolve, reject) => {
    const controller = navigator.serviceWorker.controller;
    if (!controller) return reject(new Error('no controller — nothing is being served by a worker'));
    const channel = new MessageChannel();
    channel.port1.onmessage = (event) => resolve(event.data.build);
    controller.postMessage('WHICH_BUILD', [channel.port2]);
    setTimeout(() => reject(new Error('worker did not answer')), 2000);
  });
}
```

If that returns `v1` after step 4, every user with a tab open is in the same position, and the
recovery paths in [10h](10h-service-worker-update-detection-and-recovery.md) are what you ship.

You do not have to wait for the browser's own update check to run this. MDN describes `update()`
precisely:

> *"It fetches the worker's script URL, and if the new worker is not byte-by-byte identical to the
> current worker, it installs the new worker."*

MDN adds that the fetch bypasses browser caches if the previous fetch occurred over 24 hours ago —
which is the only concrete timing rule available, and the reason a worker script must be served
with `no-cache` headers if you want updates faster than a day.

```ts
// lib/sw-test-harness.ts — force one update check and report the lifecycle state
export async function forceUpdateCheck() {
  const registration = await navigator.serviceWorker.ready;
  await registration.update();
  return {
    installing: registration.installing?.state ?? null,
    waiting: registration.waiting?.state ?? null,
    active: registration.active?.state ?? null,
  };
}
```

A non-null `waiting` is the bug, in one call, with no checkbox involved.

## Reproducing the opposite failure: `skipWaiting()` and the chunk that vanished

The reflex fix for the bug above is `self.skipWaiting()` plus `clients.claim()`, and it introduces
a second bug that is harder to see because it needs a *user action* after the swap. The open tab is
running JavaScript built for `v1`. The new worker activates under it and starts answering for the
new build, whose `/_next/static/chunks/` filenames are different. The moment that page lazily loads
anything, it asks for a chunk URL the new build does not serve.

Reproduce it on purpose with a route that defers a chunk until a click:

```tsx
// app/reports/page.tsx — a chunk that is not fetched until the user asks for it
'use client';
import { useState, lazy, Suspense } from 'react';

const HeavyChart = lazy(() => import('../../components/HeavyChart'));

export default function ReportsPage() {
  const [show, setShow] = useState(false);
  return (
    <>
      <button onClick={() => setShow(true)}>Show chart</button>
      {show && (
        <Suspense fallback={<p>Loading chart…</p>}>
          <HeavyChart />
        </Suspense>
      )}
    </>
  );
}
```

1. Load `/reports` on build `v1`. **Do not click the button.**
2. Ship `v2` with `skipWaiting()` in the worker's `install` handler.
3. Reload nothing. Wait for the new worker to activate and claim the tab.
4. Now click the button.

The dynamic import requests a `v1` chunk filename that `v2` does not have. Whether the browser
surfaces that as a failed import or a rejected promise depends on your error boundaries — but the
page is broken and the user did nothing wrong. This is why `skipWaiting()` is not a fix on its own;
the fix is to prompt the user and reload the page under the new worker, which is
[10h](10h-service-worker-update-detection-and-recovery.md).

## Gotchas

### The two builds are byte-identical, so nothing installs
**Symptom.** You change the app, rebuild, reload — and the Service Workers pane shows no new
worker at all.
**Cause.** The browser compares the **worker script**, not the app. If your version constant lives
in a file the worker never imports, the emitted worker bytes are unchanged and there is nothing to
install.
**Fix.** Put a value the build actually varies into the worker script itself, and let the bundler
inline it:

```js
// lib/service-worker.js — the constant has to be in the worker, not near it
const BUILD = process.env.NEXT_PUBLIC_BUILD_ID ?? 'dev';
const CACHE = `sprintdesk-${BUILD}`;
```

```bash
# give every build a distinct id so the worker script always differs
NEXT_PUBLIC_BUILD_ID=$(git rev-parse --short HEAD) next build && next start -p 3100
```

### The worker script is served with a cacheable `Cache-Control`
**Symptom.** A new worker is deployed and the browser keeps fetching the old script for hours.
**Cause.** The update check fetches the script through the HTTP cache. MDN's one concrete rule is
that the fetch bypasses browser caches only if the previous fetch occurred over 24 hours ago —
so a cacheable worker script means updates arrive on the browser's schedule, not yours.
**Fix.** Serve the worker with no-store headers. The Next PWA guide's own example does exactly
this for the worker path:

```ts
// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
```

⚠️ The guide registers a **bundled** worker via `new URL('../lib/service-worker.js', import.meta.url)`
while this header rule targets the literal path `/sw.js`. The docs never state the emitted URL of a
bundled worker, so confirm the served path in the Service Workers pane's **Source** line before
trusting the rule to apply. Also register with `updateViaCache: 'none'`, which per MDN keeps the
main script and its imports out of the HTTP cache regardless.

### Expecting `clients.claim()` to reload the page
**Symptom.** The new worker claims the tab and the page still shows old data.
**Cause.** `clients.claim()` makes the active worker the controller of existing clients. It does
not navigate, re-render, or discard anything the page already loaded.
**Fix.** If the page must be running new code, reload it deliberately — and only after telling the
user, because a reload under their fingers loses form state:

```ts
// lib/sw-update-prompt.ts — reload once, when the controller actually changes
export function reloadOnControllerChange() {
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });
}
```

The `reloading` guard is not optional: without it, a controller change during a reload can loop.

### Reproducing an update with only one build
**Symptom.** "I cannot reproduce it" on a bug half your users are reporting.
**Cause.** A waiting worker requires two byte-different worker scripts. Rebuilding the same source
produces an identical script and the browser installs nothing.
**Fix.** Change something the bundler will emit — the `BUILD` constant above is enough. A
whitespace-only change also produces a byte-different script, which is worth knowing in the other
direction: it means a trivial edit ships a "new" worker to every user.

## Interview questions

**★ How do you reproduce the "users are stuck on the old build" bug on your own machine?**
Two production builds whose worker scripts differ by at least one byte, and one tab kept open
across the change — with **Update on reload** turned off, because that checkbox forces install and
activation on every reload and therefore suppresses the exact state you are trying to see. Load
build one, leave the tab open, build two, reload once: the Service Workers pane then lists an
activated worker and a waiting one, and the page is still being served by the old one. Asking the
controller which build it is, over a `MessageChannel`, turns "the UI looks the same" into a fact.

**★ Why must a service worker script be served with no-store headers?**
Because the update check is an HTTP fetch like any other, and MDN's only concrete guarantee is that
the fetch bypasses browser caches if the previous fetch occurred over 24 hours ago. Serve the
script with a normal cacheable policy and your deploy reaches users when the HTTP cache lets it,
which can be a day later. The Next PWA guide's headers example sets
`Cache-Control: no-cache, no-store, must-revalidate` on the worker path for exactly this reason, and
registering with `updateViaCache: 'none'` keeps the script and its imports out of the HTTP cache
regardless of headers.

**★ What does `clients.claim()` actually do, and what does it not do?**
It makes the newly activated worker the controller of clients that were loaded before it existed —
so their subsequent requests go through the new worker. It does not reload those pages, re-render
them, or replace the JavaScript they are already running. That gap is the whole `skipWaiting()`
hazard: the page keeps executing old code while a new worker answers for a new build. If you need
the page on new code, you reload it, and you do that in response to `controllerchange` with a guard
against looping.

**You rebuilt and the browser installed nothing. What are the two likely reasons?**
Either the worker script is byte-for-byte identical to the installed one — which happens whenever
your version marker lives in a file the worker does not import, because the browser compares the
worker script and not your application — or the browser served the script from the HTTP cache and
never saw the new bytes. The first is fixed by putting a per-build value inside the worker script;
the second by no-store headers on the worker path plus `updateViaCache: 'none'` at registration.

**★ Why is `skipWaiting()` not simply the fix, and how would you demonstrate the problem?**
Because it swaps the worker underneath a page whose JavaScript came from the previous build. The
demonstration needs a chunk that is not fetched until the user acts: load a route with a lazy
import, do not trigger it, ship a new build with `skipWaiting()`, let the new worker activate and
claim the tab, then trigger the import. The request goes to a chunk filename the new build does not
serve. The page was fine until the user clicked something, which is why this failure is
under-reported and hard to attribute.

---

← [A testable environment](10w-a-testable-environment-https-and-a-production-build.md) · [Chapter 12 overview](01-explanation.md) · Next → [Testing offline and the cache](10y-testing-offline-and-what-the-cache-really-holds.md)
