---
title: "Observability & Monitoring: RUM, Error Tracking & Event Architecture"
sidebar_label: "Observability & Monitoring"
sidebar_position: 1
---

# 🏛️ Observability & Monitoring: RUM, Error Tracking & Event Architecture

## 1. The Decision Framework

Without deliberate observability architecture, a team's only signal for "is production actually healthy" is user complaints — a genuinely reactive, late-arriving signal compared to instrumented, proactive monitoring.

```
Synthetic testing ONLY (Lighthouse CI, staged E2E):    + Real User Monitoring (RUM):
  measures performance under CONTROLLED conditions        measures ACTUAL user experience across every
  (one specific device/network profile)                    real device/network/geography combination
  ── MISSES real-world variance (a slow device            ── the ONLY way to know what the 10th-percentile
     in a specific region with poor connectivity              real user actually experiences, not just
     might never be represented in synthetic tests)            what a controlled test environment shows
```

### Structured Logging: A Consistent Event Shape, Not `console.log` Noise
```typescript
// ❌ unstructured — not queryable, inconsistent shape across different log call sites
console.log('user clicked checkout button');

// ✅ structured — a consistent shape, QUERYABLE at scale (by event type, by user segment, by time range)
logEvent({ type: 'checkout_button_clicked', userId, cartValue, timestamp });
```
Unstructured `console.log` calls scattered through a codebase are fine for local debugging but provide essentially no value at production scale — nobody can meaningfully query "how many times did X happen last week, broken down by user segment" against a pile of inconsistent free-text log lines. A structured event shape, consistently applied, makes production behavior genuinely queryable and analyzable.

### Error Tracking: Source Maps & Release Tagging Make Errors Actionable
An error captured in production with only a minified stack trace (`at t.a (main.abc123.js:1:48291)`) is nearly useless for actually diagnosing the bug — source maps (uploaded to the error-tracking service, per the pattern covered in the [Webpack source maps doc](../../../webpack/pages/12-source-maps/01-devtool-options.md)) let the tracking service de-minify that stack trace back to original source. Release tagging (associating each captured error with the specific deploy/commit that produced it) is what makes "this error started appearing after release X" a queryable fact, not a guess.

### A Typed Event Schema: Preventing Analytics Rot
Without an enforced contract for what an analytics event's name and payload shape should look like, ad-hoc `track('Checkout Completed', {...})` calls scattered across a codebase inevitably drift — some call sites include a `currency` field, others don't; some name it `checkout_completed`, others `CheckoutComplete` — producing an analytics dataset that's inconsistent and hard to reliably query for genuine product insights.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Performance Regression Invisible to Synthetic Testing, Caught Only by Real User Monitoring.
A team's Lighthouse CI (running against a fixed, fast simulated network/device profile) showed consistently excellent scores — yet a growing volume of user complaints suggested the app felt slow for a meaningful fraction of real users. RUM data (actual field measurements from real user sessions, per the [Web Vitals RUM doc](../../../web-vitals-performance/pages/03-real-user-monitoring/01-web-vitals-library-and-rum.md)) revealed the truth Lighthouse's fixed profile had been blind to: a specific geographic region with poor average connectivity experienced significantly worse load times than Lighthouse's simulated conditions ever represented, since Lighthouse's synthetic test simply never modeled that real-world network variance. Only field data (RUM), not synthetic testing alone, could have surfaced this genuine, real-user-affecting regression.

---

## 3. Reference Implementation

```typescript
// RUM — real field data, tied to actual user sessions
import { onLCP, onINP, onCLS } from 'web-vitals';

function sendToRUM(metric: Metric) {
  navigator.sendBeacon('/analytics/vitals', JSON.stringify({
    ...metric,
    sessionId: getSessionId(),
    geography: getUserRegion(), // enables the exact "which region is actually affected" analysis
  }));
}
onLCP(sendToRUM); onINP(sendToRUM); onCLS(sendToRUM);
```

```typescript
// Error tracking — source maps uploaded, release tagged, user context attached
import * as Sentry from '@sentry/react';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  release: process.env.GIT_COMMIT_SHA, // ties every captured error to the EXACT deploy that produced it
  beforeSend(event, hint) {
    event.user = { id: getCurrentUserId() }; // context for "which users are affected"
    return event;
  },
});
```

```typescript
// A typed event schema — preventing analytics rot via a single, enforced contract
type AnalyticsEvent =
  | { name: 'checkout_completed'; payload: { orderId: string; totalCents: number; currency: string } }
  | { name: 'product_viewed'; payload: { productId: string; category: string } };

function track<E extends AnalyticsEvent>(event: E) {
  analyticsClient.send(event.name, event.payload); // every call site MUST match one of the defined event shapes
}

track({ name: 'checkout_completed', payload: { orderId: '123', totalCents: 4599, currency: 'USD' } }); // ✅ type-checked
```

---

## 4. Senior Engineer Anti-Patterns & Lessons

### ⚠️ Anti-Pattern 1: Relying Exclusively on Synthetic Performance Testing
As the scenario shows, synthetic tests validate ONE controlled condition set — they cannot represent the genuine diversity of real users' devices/networks/geographies. RUM is not optional supplementary data for a production app; it's the only source of truth for what real users actually experience.

### ⚠️ Anti-Pattern 2: Scattering Unstructured `console.log` as the Only Production Logging Strategy
Free-text console logs provide essentially zero analytical value at scale — they can't be reliably queried, aggregated, or alerted on. A structured logging/event system, even a minimal one, is necessary for production observability to be genuinely actionable rather than "grep through logs and hope."

### ⚠️ Anti-Pattern 3: Ad-Hoc Analytics Calls With No Enforced Event Schema
As covered above, unstructured analytics tracking inevitably drifts into inconsistency — different names/shapes for conceptually the same event across different call sites, eventually making the resulting dataset unreliable for genuine product decision-making. A typed event schema (even a simple discriminated union, as shown above) catches inconsistency at compile time rather than discovering it much later, as a confusing, hard-to-reconcile analytics dataset.
