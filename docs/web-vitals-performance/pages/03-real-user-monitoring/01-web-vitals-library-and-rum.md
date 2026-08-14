---
title: "Real User Monitoring: The `web-vitals` Library & Reliable Beaconing"
sidebar_label: "Real User Monitoring"
sidebar_position: 1
---

# 🚀 Real User Monitoring: The `web-vitals` Library & Reliable Beaconing

## 1. Under-The-Hood Mechanics

Real User Monitoring (RUM) means measuring actual visitors' real devices, real networks, real page interactions — as opposed to lab tools' single controlled simulated run. Google's own `web-vitals` npm package is the standard, spec-compliant way to collect this data client-side, wrapping the underlying `PerformanceObserver` APIs (which have real cross-browser quirks) into one consistent callback-based interface.

```
onLCP(callback) / onINP(callback) / onCLS(callback) / onFCP(callback) / onTTFB(callback)
        │
        ▼
Each callback fires ONCE per page, at the point the metric's value is FINALIZED
(LCP/CLS finalize on first interaction or page-hidden event; INP finalizes on page-hidden/unload)
        │
        ▼
callback receives a Metric object: { name, value, rating, delta, id, navigationType, entries }
```

### Why Metrics Finalize on `visibilitychange`, Not `load`
LCP and CLS are explicitly designed to keep accumulating/updating until the user's attention genuinely shifts away (an interaction, or the tab being hidden/closed) — this is why `web-vitals`' recommended pattern relies on listening to `visibilitychange` (page hidden) as the reliable "flush now" signal, and why the callback might not fire until well after the traditional `window.onload` event, or might fire multiple times with updated `delta` values as the CLS score keeps accumulating during a long session.

### `reportWebVitals()`: The Next.js/CRA Convention
Frameworks scaffolded a `reportWebVitals(metric)` callback convention specifically to give this exact hook point a predictable name/location — the function itself does nothing framework-magic; it's simply called once per metric, same as a raw `onLCP`/`onINP`/`onCLS` callback would be.

### `navigator.sendBeacon`: Reliable Delivery During Page Unload
A `fetch()` call issued during a `visibilitychange`/`beforeunload` handler can be **cancelled** by the browser before it completes, since the page is actively navigating away — `navigator.sendBeacon()` is specifically designed to guarantee the request is queued and sent even as the page unloads, making it the correct transport for vitals data (which very often finalizes right as the user is leaving).

---

## 2. Real-World Engineering Scenario

**Scenario**: A/B Testing a Layout Change and Needing Statistically Valid Field Data to Judge the Winner.
A team ships an A/B test changing hero section layout, hypothesizing it will improve LCP. Lab testing alone can't validate this — the whole point of the change is its effect on the *real* distribution of user devices/networks. By tagging every `web-vitals` beacon with the active experiment variant (`{ ...metric, experimentVariant: 'B' }`) and aggregating server-side by variant, the team gets a statistically meaningful comparison of real LCP distributions between variants — the only trustworthy way to validate a performance hypothesis that lab tools' single controlled run cannot represent.

---

## 3. Production-Grade Code Example

```typescript
// lib/reportVitals.ts — production-grade RUM collection with sampling and experiment tagging
import { onLCP, onINP, onCLS, onFCP, onTTFB, type Metric } from 'web-vitals';

const SAMPLE_RATE = 0.1; // collect from 10% of sessions — enough for statistical significance at scale, far less bandwidth
const shouldSample = Math.random() < SAMPLE_RATE;

function sendToAnalytics(metric: Metric) {
  if (!shouldSample) return;

  const payload = JSON.stringify({
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    id: metric.id,
    navigationType: metric.navigationType,
    experimentVariant: window.__EXPERIMENT_VARIANT__ ?? null,
    url: location.pathname, // aggregate per-route, not just site-wide — a slow checkout page shouldn't hide behind a fast homepage average
  });

  if (navigator.sendBeacon) {
    navigator.sendBeacon('/analytics/vitals', payload);
  } else {
    // Fallback for browsers/contexts without sendBeacon — keepalive:true has similar unload-survival intent
    fetch('/analytics/vitals', { body: payload, method: 'POST', keepalive: true });
  }
}

onLCP(sendToAnalytics);
onINP(sendToAnalytics);
onCLS(sendToAnalytics);
onFCP(sendToAnalytics);
onTTFB(sendToAnalytics);
```

```tsx
// pages/_app.tsx — Next.js reportWebVitals convention
export function reportWebVitals(metric: NextWebVitalsMetric) {
  navigator.sendBeacon('/analytics/vitals', JSON.stringify(metric));
}
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Using `fetch()` Without `keepalive` in an Unload Handler
```typescript
// ❌ WRONG: a normal fetch() call started during page unload can be silently cancelled by the
// browser mid-flight, before the request ever reaches the server — data loss, worse for high-bounce pages
window.addEventListener('beforeunload', () => fetch('/analytics/vitals', { body: payload, method: 'POST' }));

// ✅ CORRECT: sendBeacon is purpose-built to survive unload; keepalive:true is the fetch-based fallback
navigator.sendBeacon('/analytics/vitals', payload);
```

### ⚠️ Pitfall 2: Aggregating Vitals Site-Wide Instead of Per-Route
A single site-wide LCP average can look perfectly healthy while masking one specific high-value route (checkout, a key landing page) performing badly — the homepage's fast LCP simply outnumbers checkout's slow one in the aggregate. Always segment RUM data by route/template at minimum, and ideally by device class and connection type too, since a single blended number actively hides the specific problem worth fixing.

### ⚠️ Pitfall 3: Sampling Too Aggressively for Low-Traffic Routes
A 1% sample rate is reasonable for a high-traffic homepage but produces statistically meaningless (too few data points) results for a low-traffic but high-value route like an enterprise sign-up flow — a fixed global sample rate isn't one-size-fits-all. Consider route-aware sampling rates (100% sampling on critical, lower-traffic conversion paths; lower sampling on high-traffic pages) rather than a single blanket percentage.
