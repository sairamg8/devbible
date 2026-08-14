---
title: "Performance Budgets & Advanced Diagnostics"
sidebar_label: "Performance Budgets & Advanced Diagnostics"
sidebar_position: 1
---

# 🚀 Performance Budgets & Advanced Diagnostics

## 1. Under-The-Hood Mechanics

A performance budget converts "we should keep the site fast" from an aspiration into an enforced, CI-gated numeric threshold — the only reliable way to prevent gradual regression across many small, individually-reasonable-seeming changes over time.

### CI-Enforced Budgets
- **Lighthouse CI** — runs Lighthouse against specified URLs on every PR/commit, failing the build if any assertion (`largest-contentful-paint`, `cumulative-layout-shift`, `total-blocking-time` as an INP proxy) exceeds a configured threshold.
- **`size-limit`/`bundlesize`** — fail the build when a specific bundle/entrypoint's byte size crosses a defined budget, independent of any runtime metric — catching bloat at the *build* stage, before it ever reaches a user's device to be measured.
- **Per-metric, per-asset-type budgets** — a single site-wide "keep it fast" budget is too coarse; separate budgets per Core Web Vital *and* per asset category (JS budget, CSS budget, image budget) localize exactly which category regressed, rather than a vague overall failure requiring investigation from scratch.

### Deep Profiling: Flame Charts & Long Task Analysis
Chrome DevTools' Performance panel renders a **flame chart** — each bar is a function call, width proportional to duration, stacked to show the call hierarchy — the tool for answering "which specific function call is responsible for this long task" once a budget/vitals check has already told you *that* something is slow.

`PerformanceObserver({ type: 'longtask' })` programmatically detects any main-thread task exceeding 50ms **in production**, on real users' devices — turning "long tasks exist somewhere" from a lab-only observation into a field-measurable, attributable signal.

### Attribution: Root-Causing a Bad Score to a Specific Element/Resource
Both the `web-vitals` library's attribution build and Chrome DevTools expose *which specific DOM element* was the LCP candidate, and *which specific elements* contributed to a CLS score — replacing "LCP is bad" with "the LCP element is `<img class="hero">`, and it took 1.2s in Resource Load Delay specifically" — the difference between a vague alert and an actionable one.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Regression Traced to a Specific Deploy Within Minutes, Not Days.
A field-data dashboard showed INP degrading gradually over two weeks, with no single obvious cause. Correlating the RUM data's timestamp axis against the deploy log (each deploy annotated on the same timeline) pinpointed the exact deploy where the regression's slope changed — that deploy's diff included a new analytics library initialized synchronously on every page load, adding a consistent ~80ms of blocking work to the very first interaction handler on every route. Without deploy-correlated field data, this would have required bisecting through two weeks of changes manually; with it, the root cause was identified within minutes of noticing the trend.

---

## 3. Production-Grade Code Example

```javascript
// lighthouserc.js — per-metric CI budget, blocking merge on regression
module.exports = {
  ci: {
    collect: { url: ['http://localhost:3000/'], numberOfRuns: 3 },
    assert: {
      assertions: {
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['error', { maxNumericValue: 300 }],
      },
    },
  },
};
```

```json
// .size-limit.json — per-asset-type bundle budgets
[
  { "path": "dist/main.*.js", "limit": "150 KB" },
  { "path": "dist/vendors.*.js", "limit": "100 KB" },
  { "path": "dist/*.css", "limit": "30 KB" }
]
```

```typescript
// lib/longTaskMonitor.ts — production long-task detection with attribution
new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.duration > 50) {
      navigator.sendBeacon('/analytics/longtask', JSON.stringify({
        duration: entry.duration,
        startTime: entry.startTime,
        attribution: (entry as any).attribution?.[0]?.name ?? 'unknown',
        deployVersion: window.__BUILD_ID__, // correlate against deploy timeline
      }));
    }
  }
}).observe({ type: 'longtask', buffered: true });
```

```typescript
// Reading LCP attribution to identify the exact culprit element/sub-phase
import { onLCP } from 'web-vitals/attribution';

onLCP((metric) => {
  console.log('LCP element:', metric.attribution.element);
  console.log('Resource load delay:', metric.attribution.resourceLoadDelay);
  console.log('Resource load time:', metric.attribution.resourceLoadTime);
});
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: A Single Site-Wide Budget Masking a Localized Regression
A blended, site-wide bundle size budget can stay under threshold even as one specific, high-value route (checkout) silently balloons — because other, larger-traffic routes' averages absorb the increase. Per-route or per-entrypoint budgets (not one global number) are what actually catch a localized regression before it reaches users of that specific route.

### ⚠️ Pitfall 2: Setting Budgets Too Loose to Ever Fail, Defeating Their Purpose
A budget set comfortably above current measured values "just to be safe" (avoiding CI friction) provides no actual regression protection — it only fails once a regression is already large enough to be obviously bad, by which point the specific change responsible is much harder to isolate than if the budget had caught it immediately. Set budgets close to current measured values, with intentional, documented headroom only for known near-term needs.

### ⚠️ Pitfall 3: Deep-Profiling in Isolation, Without Correlating Against Deploy History
Reading a flame chart or long-task report without cross-referencing *when* the regression started against the deploy timeline turns root-causing into a much slower, more speculative process — annotating deploys directly on the same timeline as field performance data (as in the scenario above) converts "something got slower recently" into "this specific commit" almost immediately.
