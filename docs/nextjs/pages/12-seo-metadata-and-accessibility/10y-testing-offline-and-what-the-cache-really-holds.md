---
title: "Offline passes in testing and fails on a train because DevTools cannot emulate a network that answers, and because a cache keyed by URL cannot tell a document from a component stream"
sidebar_label: "10y · Testing offline and the cache"
sidebar_position: 56
description: "The two DevTools offline switches and what neither reproduces, soft navigation versus hard reload, and catching an RSC payload cached under a document URL before a user does."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-03 against the Next.js
> [offline support guide](https://nextjs.org/docs/app/guides/offline-support) and
> [`experimental.useOffline`](https://nextjs.org/docs/app/api-reference/config/next-config-js/useOffline),
> Chrome DevTools' [Debug Progressive Web Apps](https://developer.chrome.com/docs/devtools/progressive-web-apps),
> and the App Router header constants in the Next.js canary source
> (`packages/next/src/client/components/app-router-headers.ts`).
> Target: **Next.js 16.3.4**, App Router, Node >= 20.9.
> Documentation-verified; **no sandbox run**.

**"Offline works" is not one claim, it is three — a soft navigation to a prefetched route, a cold
hard reload served from a cache, and a network that is present but useless — and the tooling
tests the easiest of the three by default.** The second half of this page is the same problem seen
from the storage side: a Next.js origin answers the same URL as HTML or as a React Server
Components payload depending on request headers, so what is *in* your cache matters as much as
whether something is there. This continues
[10x](10x-reproducing-the-failures-deliberately.md); the mechanisms are
[10i](10i-offline-strategy-and-the-useoffline-boundary.md) and
[10j](10j-caching-next-asset-classes-in-a-service-worker.md).

## Testing offline honestly

There are two offline controls: the throttling preset in the **Network** panel, and the **Offline**
checkbox in the **Service Workers** pane. They are separate controls with separate state — an app
that seems stubbornly disconnected is usually one of the two still ticked.

Both are *emulation*: the browser fails the request itself, immediately. That is a close match for
a genuinely disconnected device, where DNS or TCP fails almost at once — which is the case
`experimental.useOffline` is built around, since its connectivity probe treats a `HEAD` that
resolves *or* is aborted at 200 ms as online.

🔴 **What neither switch reproduces is the network that is worse than absent**: the captive portal
in a hotel or on a train that answers every request with a 200 and a login page. Against that, a
probe expecting a response gets one, the app believes it is online, and every fetch returns someone
else's HTML. This is reasoning from the documented probe mechanism, not a documented failure mode —
treat it as a hypothesis to test on a real bad network rather than a claim from the docs. The
mitigation follows either way: never treat a 200 as proof of your origin.

Then test the two offline cases separately, because they fail for different reasons:

| Case | How to run it | What must happen |
|---|---|---|
| **Soft navigation** to a route that was prefetched | Go offline, click an in-app link | The App Shell renders — this is what `experimental.useOffline` gives you |
| **Hard reload** while offline | Go offline, press reload | Only works if a service worker answers the document request from cache |

A team that tests only the first ships an app that dies on a cold start from the home screen, which
is the single most common offline complaint and is covered in
[10i](10i-offline-strategy-and-the-useoffline-boundary.md).

## Killing the network for real

Emulation is the fast loop; it is not the last word. Two things are only testable by disconnecting
for real, and both are cheap enough to do once before a release:

- **A cold start from the home screen with no network at all.** Airplane mode on the device, then
  launch the installed app. This exercises the document request, the worker's `fetch` handler and
  the cached fallback in the order a real user meets them, with no DevTools attached to change the
  timing.
- **A slow or lossy link rather than an absent one.** Emulated throttling fails requests at the
  browser; a real degraded link times them out at the transport, which is a different code path in
  anything with a timeout — including `experimental.useOffline`'s `HEAD` probe, which is aborted at
  200 ms and counts an abort as *online*.

For the second case the useful test is not "does it work" but "what does the app claim". If the UI
says online while every request is failing, the probe is answering a question about the network
rather than about your origin.

## What the Cache Storage pane shows that no test does

Cache Storage lists your caches by name and, inside each, the stored entries keyed by request URL.
This is where the defect [10j](10j-caching-next-asset-classes-in-a-service-worker.md) warns about
becomes concrete.

A Next.js origin serves the same URL as at least two different things. `/dashboard` with no special
headers is an HTML document; `/dashboard` with the `rsc` header is a React Server Components payload
with content type `text/x-component`; a prefetch adds `next-router-prefetch` and a `_rsc` query.
A cache keyed by URL cannot tell them apart.

Select the entry for `/dashboard` and read its response headers. If `content-type` is
`text/x-component`, your worker stored an RSC payload under the document URL and the next offline
hard reload will serve a component stream to a browser expecting a document. If you see both
`/dashboard` and `/dashboard?_rsc=1a2b3c`, your matching is about to depend on `ignoreSearch`.

The pane is a snapshot; re-select the cache after any write. And assert it rather than eyeballing
it, so a regression is caught by CI rather than by a user:

```ts
// lib/sw-test-harness.ts — nothing stored under a document URL may be an RSC payload
export async function assertNoRscUnderDocumentUrls(cacheName: string) {
  const cache = await caches.open(cacheName);
  const bad: string[] = [];
  for (const request of await cache.keys()) {
    const url = new URL(request.url);
    if (url.searchParams.has('_rsc')) continue; // legitimately an RSC entry
    const response = await cache.match(request);
    const type = response?.headers.get('content-type') ?? '';
    if (type.includes('text/x-component')) bad.push(request.url);
  }
  if (bad.length) {
    throw new Error(`RSC payloads cached under document URLs: ${bad.join(', ')}`);
  }
}
```

## Gotchas

### Testing offline against `next dev`
**Symptom.** `experimental.useOffline` appears to do nothing; a soft navigation offline fails just
as hard as before you enabled it.
**Cause.** Prefetching is disabled in development, and the feature renders the *prefetched* App
Shell. There is nothing to render.
**Fix.** There is no config for this; the fix is the build:

```bash
next build && next start -p 3100
# then take the browser offline and try a soft navigation to a link that was on screen
```

### Only one of the two offline switches turned off
**Symptom.** The app is stubbornly offline after you "went back online".
**Cause.** The Network panel throttling preset and the Service Workers pane **Offline** checkbox
are independent controls.
**Fix.** Clear both, then confirm from the page rather than from the panel:

```ts
// lib/sw-test-harness.ts — navigator.onLine is a weak signal, so probe your own origin
export async function probeOrigin() {
  try {
    const res = await fetch('/api/health', { method: 'HEAD', cache: 'no-store' });
    return res.ok ? 'reachable' : `reachable, status ${res.status}`;
  } catch {
    return 'unreachable';
  }
}
```

### Concluding offline works because a link worked
**Symptom.** Offline passes in testing; users report a blank app when they open it from the home
screen on a train.
**Cause.** A soft navigation to a prefetched route is served by the router from memory. A cold
start is a document request that needs the network unless a worker answers it.
**Fix.** Run the hard-reload case as its own test and treat a passing soft navigation as evidence
of nothing about cold starts:

```ts
// e2e helper, or paste in the console: prove the document itself is cacheable offline
export async function assertDocumentServedFromCache(path: string) {
  const hit = await caches.match(new Request(path, { mode: 'navigate' }));
  if (!hit) throw new Error(`no cached document for ${path} — a cold start offline will fail`);
  const type = hit.headers.get('content-type') ?? '';
  if (!type.includes('text/html')) {
    throw new Error(`cached entry for ${path} is ${type}, not HTML`);
  }
}
```

### Reading `text/x-component` in the cache as harmless
**Symptom.** A blank page or a screen of raw text after an offline reload, only sometimes.
**Cause.** The worker cached an RSC payload under a document URL. It only bites when the browser
asks for a document and the cache answers first.
**Fix.** `assertNoRscUnderDocumentUrls()` above, run in the app during a test and in CI. The
structural fix — classify before you store — is
[10j](10j-caching-next-asset-classes-in-a-service-worker.md).

### Testing a Server Action while the worker is in the request path
**Symptom.** A form submission that appears to succeed twice, or succeeds again by itself after
the network returns.
**Cause.** A Server Action is a `POST` carrying the `next-action` header. Anything that queues or
replays failed requests will replay it, and a mutation is not idempotent. The mechanism is in
[10j](10j-caching-next-asset-classes-in-a-service-worker.md); what is new here is that it has to be
a named test case, because it only appears when connectivity returns.
**Fix.** Exclude actions from every retry path, and prove the exclusion rather than assuming it:

```js
// lib/service-worker.js — never let a Server Action into a retry path
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;           // POSTs pass straight through
  if (event.request.headers.has('next-action')) return; // belt and braces
  // …GET handling only from here
});
```

The test: go offline, submit the form, come back online, and assert exactly one row was written.

### The offline reload was served by the HTTP cache, not by your worker
**Symptom.** A hard reload offline works during testing and fails for users a day later.
**Cause.** A still-fresh entry in the browser's own HTTP cache can satisfy the navigation without
your service worker being involved at all. Your test proved the HTTP cache works, which it will
stop doing as soon as the entry goes stale.
**Fix.** Make responses that came from your cache say so, then assert on the header:

```js
// lib/service-worker.js — stamp cache hits so a test can tell them apart
async function fromCache(request) {
  const hit = await caches.match(request);
  if (!hit) return null;
  const headers = new Headers(hit.headers);
  headers.set('x-served-by', 'sw-cache');
  return new Response(await hit.blob(), { status: hit.status, headers });
}
```

```ts
// then, in the page or a Playwright test
const res = await fetch('/dashboard');
if (res.headers.get('x-served-by') !== 'sw-cache') {
  throw new Error('this response did not come from the service worker cache');
}
```

### An assertion that skips `_rsc` keys while the worker matches with `ignoreSearch`
**Symptom.** The cache audit passes and offline reloads still return a component stream.
**Cause.** `assertNoRscUnderDocumentUrls()` above skips entries carrying `_rsc`, on the assumption
that they can only ever answer an RSC request. If your `fetch` handler passes `ignoreSearch: true`
to `caches.match()`, that assumption is false: the query string stops being part of the key, and a
`?_rsc` entry becomes a candidate answer for a plain document request.
**Fix.** Do not use `ignoreSearch` on anything that can be a document, and make the audit reflect
the matching strategy you actually ship:

```ts
// strict variant: with ignoreSearch in play, nothing RSC may be in a document cache at all
export async function assertNoRscAnywhere(cacheName: string) {
  const cache = await caches.open(cacheName);
  for (const request of await cache.keys()) {
    const type = (await cache.match(request))?.headers.get('content-type') ?? '';
    if (type.includes('text/x-component')) {
      throw new Error(`RSC payload in a document cache: ${request.url}`);
    }
  }
}
```

### Trusting `navigator.onLine`
**Symptom.** The UI says "back online" and every request still fails.
**Cause.** `onLine` reports whether the device has *a* network interface, not whether your origin is
reachable. A captive portal, a VPN drop and a dead upstream all read as online.
**Fix.** Probe your own origin with `probeOrigin()` above, and let that — not the flag — drive any
UI that claims connectivity.

## Interview questions

**★ You find `content-type: text/x-component` on the cache entry for `/dashboard`. What breaks?**
An offline hard reload. The browser asks for a document, your worker matches by URL, and hands back
a React Server Components payload — so the user sees a blank page or raw text. It happens because
Next serves the same URL as HTML or as an RSC payload depending on the `rsc` request header, with
prefetches adding `next-router-prefetch` and a `_rsc` query, and a URL-keyed cache cannot tell them
apart. The fix is to classify the request before storing it, and the regression guard is a test
that walks the cache and fails on any RSC content type stored under a URL without `_rsc`.

**★ What can DevTools' offline emulation not reproduce?**
A network that answers. Both offline switches make the browser fail requests immediately, which
resembles a genuinely disconnected device well enough — DNS and TCP fail almost instantly there
too, which is what `experimental.useOffline`'s probe is tuned for. What they cannot produce is the
captive portal that returns 200 with a login page for every request, or a link so slow that every
request times out rather than failing. Both leave an app convinced it is online while nothing it
receives is yours. The guard is to verify a response actually came from your origin instead of
treating a 200 as proof.

**Why does testing a Server Action deserve its own case in a PWA test plan?**
Because it is the one request in the app that must never be retried automatically, and every
offline story is built out of retries. A Server Action is a `POST` with the `next-action` header;
if it lands in a worker's queue-and-replay path or a generic retry wrapper, a payment or a
status change happens twice when connectivity returns. The test is to go offline, submit, come
back online, and assert exactly one effect — and the code guard is to exclude non-`GET` requests
from the worker's `fetch` handling entirely.

**★ What are the three separate offline claims, and how does each one fail?**
A soft navigation to a prefetched route, which fails when nothing was prefetched — the case
`experimental.useOffline` addresses, and the case that silently never works in `next dev` because
prefetching is disabled there. A hard reload or cold start, which fails unless a service worker
answers the document request from cache, because the browser needs the network to deliver HTML.
And a network that is present but useless — a captive portal or a dead upstream — which fails
because the app believes a 200 means its origin answered. Testing only the first and calling it
"offline support" is the most common version of this mistake.

---

← [Reproducing the update bug](10x-reproducing-the-failures-deliberately.md) · [Chapter 12 overview](01-explanation.md) · Next → [Automating with Playwright](10z-automating-with-playwright-and-the-pre-release-checklist.md)
