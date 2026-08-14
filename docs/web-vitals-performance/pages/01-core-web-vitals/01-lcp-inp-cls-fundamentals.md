---
title: "Core Web Vitals: LCP, INP & CLS Fundamentals"
sidebar_label: "Core Web Vitals"
sidebar_position: 1
---

# 🚀 Core Web Vitals: LCP, INP & CLS Fundamentals

## 1. Under-The-Hood Mechanics

Google's Core Web Vitals are three specific, standardized metrics chosen because they each measure a genuinely distinct dimension of user-perceived experience, and because each is backed by a real browser API rather than a synthetic approximation.

```
[Largest Contentful Paint]  ──► LOADING     ──► "How long until the main content is visible?"    Good: ≤2.5s
[Interaction to Next Paint]  ──► RESPONSIVENESS ──► "How laggy do interactions feel?"                Good: ≤200ms
[Cumulative Layout Shift]    ──► VISUAL STABILITY ──► "Does content jump around unexpectedly?"        Good: ≤0.1
```

### LCP: Measured via `PerformanceObserver`
The browser tracks every "contentful" paint (images, text blocks, video posters) throughout the page's loading sequence and reports the **largest** one's render timestamp — not the *last* one, and not a fixed single frame; the LCP candidate can change multiple times as bigger elements render, finalizing once the user's first interaction or a page-hidden event occurs (interaction ends the measurement window, because at that point the user's attention has already shifted).

### INP: Measured Across the Page's Entire Lifetime, Not Just "First Input"
INP superseded First Input Delay (FID) precisely because FID only measured the **first** interaction's latency — a page could feel snappy on the very first click and then become sluggish for every subsequent one, and FID would never reflect that. INP instead observes **every** interaction (click, tap, key press) for the page's whole lifetime and reports a high-percentile (effectively the worst typical case) interaction latency — from input timestamp to the next frame the browser actually paints.

### CLS: A Cumulative Score, Not a Single Event
Each unexpected layout shift contributes a score (`impact fraction × distance fraction`) to a running session total. "Unexpected" specifically excludes shifts within 500ms of a genuine user interaction (a user clicking "expand" and content growing as a direct result isn't penalized) — only shifts the user didn't cause or couldn't anticipate count.

---

## 2. Real-World Engineering Scenario

**Scenario**: A News Site Failing Google's Core Web Vitals Assessment, Directly Affecting Search Ranking.
A high-traffic news site's article pages loaded a large hero image without dimensions reserved (bad CLS), took 4.2s for that hero image to actually paint (bad LCP, likely un-prioritized/un-preloaded), and became unresponsive for ~600ms after tapping a "read more" expander due to a heavy synchronous re-render (bad INP). Because Core Web Vitals directly factor into Google's search ranking algorithm (as a "page experience" signal), all three problems compounded into a measurable organic traffic decline — motivating a dedicated performance remediation sprint tackling each metric independently with its own fix (see the dedicated LCP/INP/CLS optimization docs below).

---

## 3. Production-Grade Code Example

```typescript
// lib/reportVitals.ts — measuring all three Core Web Vitals via the official web-vitals library
import { onLCP, onINP, onCLS, type Metric } from 'web-vitals';

function sendToAnalytics(metric: Metric) {
  const body = JSON.stringify({
    name: metric.name,          // 'LCP' | 'INP' | 'CLS'
    value: metric.value,
    rating: metric.rating,        // 'good' | 'needs-improvement' | 'poor' — Google's own thresholds, pre-computed
    id: metric.id,                  // unique per page load, for de-duplication server-side
    navigationType: metric.navigationType,
  });

  // sendBeacon survives page unload — critical since LCP/CLS often finalize right as the user navigates away
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/analytics/vitals', body);
  } else {
    fetch('/analytics/vitals', { body, method: 'POST', keepalive: true });
  }
}

onLCP(sendToAnalytics);
onINP(sendToAnalytics);
onCLS(sendToAnalytics);
```

```tsx
// PerformanceObserver, used directly for a custom LCP debugging overlay (dev-only)
if (process.env.NODE_ENV !== 'production') {
  new PerformanceObserver((list) => {
    const entries = list.getEntries();
    const lastEntry = entries[entries.length - 1]; // the LATEST candidate is the current LCP element
    console.log('Current LCP element:', (lastEntry as any).element, `${lastEntry.startTime.toFixed(0)}ms`);
  }).observe({ type: 'largest-contentful-paint', buffered: true });
}
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Measuring Vitals Only in the Lab, Never in the Field
Lighthouse (lab) runs against a single, controlled network/CPU throttle profile on one specific page load — real users span an enormous range of devices, networks, and cached states. A page can score 100 on Lighthouse while genuinely performing poorly for the 10th-percentile real user on a slow Android device over 3G. Field data (via `web-vitals` + real analytics, or CrUX) is the metric Google's ranking actually uses — lab data is a debugging tool, not the source of truth.

### ⚠️ Pitfall 2: Optimizing LCP While Ignoring That It Can Change Mid-Page-Load
Because the LCP candidate can be superseded by a later-rendering larger element, "optimizing the hero image" without checking whether some *other* element (a late-injected banner, an ad slot, a lazily-hydrated component) ends up being the actual final LCP candidate leads to fixing the wrong bottleneck entirely. Always verify the ACTUAL reported LCP element via `PerformanceObserver` or Chrome DevTools, not an assumption about which element "should" be largest.

### ⚠️ Pitfall 3: Treating Core Web Vitals "Good" Thresholds as a Ceiling to Just Barely Clear
Targeting exactly 2.5s LCP / 200ms INP / 0.1 CLS as "good enough" ignores that these thresholds are the 75th-percentile boundary between "good" and "needs improvement" — a site sitting right at the edge for its 75th percentile still has a full quarter of real visits experiencing worse. Engineering targets meaningfully inside the "good" band (e.g. LCP ≤ 1.8s) leave headroom for the inevitable variance across real-world devices/networks.
