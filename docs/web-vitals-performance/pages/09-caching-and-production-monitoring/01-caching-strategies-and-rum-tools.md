---
title: "Caching Strategies & Production RUM Tooling"
sidebar_label: "Caching Strategies & Production RUM Toolin"
sidebar_position: 1
---

# 🚀 Caching Strategies & Production RUM Tooling

## 1. Under-The-Hood Mechanics

Repeat-visit performance depends on layered caching, each layer intercepting a request before it needs to travel further:

```
Browser Request
        │
        ▼
HTTP Cache (Cache-Control headers) ──► served instantly from disk/memory, ZERO network round-trip
        │ (miss, or must revalidate)
        ▼
Service Worker Cache ──► served from a programmable, app-controlled cache, works even OFFLINE
        │ (miss)
        ▼
CDN Edge Cache ──► served from a geographically nearby edge node, avoiding a trip to origin
        │ (miss)
        ▼
Origin Server
```

### HTTP Caching Headers
`Cache-Control: public, max-age=31536000, immutable` on content-hashed assets (see the [Webpack caching bible](../../../webpack/pages/10-caching-strategies/01-long-term-caching.md)) tells the browser it never needs to even *ask* the server if the file changed — a full year of zero-network-cost repeat loads for that exact URL. `stale-while-revalidate` serves a cached (possibly slightly stale) response **immediately** while fetching a fresh one in the background for next time — a good fit for content that changes occasionally but where instant response matters more than always-perfectly-fresh data.

### Service Worker Caching Strategies
- **Cache-first** — check the service worker cache before the network; ideal for versioned, rarely-changing app-shell assets.
- **Network-first** — try the network, fall back to cache on failure; ideal for content that should be fresh when possible but must still work offline/on flaky connections.
- **Stale-while-revalidate** (as a service worker pattern, not just an HTTP header) — serve cached immediately, update the cache from a background network fetch for the *next* request.

### Production RUM Tooling
- **Sentry Performance** — ties performance transaction traces directly to error monitoring, so a slow trace and the error it eventually caused (or was caused by) are correlated in one tool.
- **Vercel Analytics/Speed Insights** — framework-integrated field vitals reporting with zero custom beaconing code required, tightly coupled to a specific hosting platform's deploy pipeline.
- **CrUX (Chrome User Experience Report)** — aggregate, real-Chrome-users field data Google itself collects and exposes (via PageSpeed Insights or the CrUX API/BigQuery dataset) — useful specifically because it reflects the exact data source Google's search ranking uses, not a third-party approximation of it.

---

## 2. Real-World Engineering Scenario

**Scenario**: A News Site Needing to Work Offline While Staying Fresh When Online.
A news reading app needs previously-read articles to remain accessible offline (a genuine product requirement, not just a performance nicety), while the homepage's article list should always show the latest content when a connection exists. A service worker configured with **cache-first** for individual article pages (once read, an article's content rarely needs to update) and **network-first** for the homepage's article list (freshness matters more here) serves both requirements from the same caching layer, tuned per-route rather than one blanket strategy.

---

## 3. Production-Grade Code Example

```
# HTTP caching headers, tuned per asset type
Cache-Control: public, max-age=31536000, immutable      # content-hashed JS/CSS chunks
Cache-Control: public, max-age=300, stale-while-revalidate=86400   # API responses that change occasionally
Cache-Control: no-cache, must-revalidate                  # index.html itself — always check for a new version
```

```javascript
// service-worker.js — route-specific caching strategies via Workbox
import { registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

// Article pages: cache-first — once read, rarely needs re-fetching
registerRoute(
  ({ url }) => url.pathname.startsWith('/articles/'),
  new CacheFirst({
    cacheName: 'articles',
    plugins: [new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 })],
  })
);

// Homepage article list: network-first — freshness matters, but still works offline as a fallback
registerRoute(
  ({ url }) => url.pathname === '/',
  new NetworkFirst({ cacheName: 'homepage', networkTimeoutSeconds: 3 })
);

// Static assets: stale-while-revalidate — instant response, background-refreshed for next time
registerRoute(
  ({ request }) => request.destination === 'style' || request.destination === 'script',
  new StaleWhileRevalidate({ cacheName: 'static-assets' })
);
```

```typescript
// Sentry Performance — correlating a slow transaction with any resulting error
import * as Sentry from '@sentry/react';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1, // sample 10% of transactions — full tracing on every request is costly at scale
  integrations: [Sentry.browserTracingIntegration()],
});
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: `no-cache` Misread as "Don't Cache At All"
```
❌ MISUNDERSTANDING: no-cache does NOT mean "never cache" — it means "cache it, but always
revalidate with the server before using the cached copy" (a conditional GET with If-None-Match).
Confusing this with no-store (which genuinely disables caching) leads to unintended caching
behavior in either direction.

✅ CORRECT: use `no-store` when a response must NEVER be cached (e.g. sensitive user data);
use `no-cache` when revalidation before reuse is what's actually wanted (e.g. index.html).
```

### ⚠️ Pitfall 2: A Service Worker Serving a Permanently Stale App Shell
A cache-first strategy applied to the app's own JS/HTML shell (rather than just content assets) can mean users never receive a critical bug-fix deploy, since the service worker keeps serving its own cached copy of the shell indefinitely — service worker update lifecycle (`skipWaiting()`, versioned cache names, and prompting the user to reload) needs deliberate handling, not just "add caching everywhere."

### ⚠️ Pitfall 3: 100% Transaction Sampling in Sentry Performance at Scale
Full tracing (`tracesSampleRate: 1.0`) on a high-traffic production app generates enormous data volume and cost with diminishing analytical value past a representative sample size — tune the sample rate to the traffic volume, and consider dynamic sampling (higher rates for error-adjacent or slow transactions specifically) rather than a flat rate for everything.
