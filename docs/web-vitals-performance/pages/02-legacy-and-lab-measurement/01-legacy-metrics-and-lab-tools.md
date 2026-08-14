---
title: "Legacy & Supporting Metrics + Lab Measurement Tools"
sidebar_label: "Legacy & Supporting Metrics + Lab Measurem"
sidebar_position: 1
---

# 🚀 Legacy & Supporting Metrics + Lab Measurement Tools

## 1. Under-The-Hood Mechanics

Beyond the three headline Core Web Vitals, several supporting metrics remain essential **diagnostic** signals — they don't directly factor into ranking the way LCP/INP/CLS do, but each explains *why* a Core Web Vital is bad, and lab tools are how most engineers first discover a regression before it ever shows up in field data.

### Supporting Metrics
- **FCP (First Contentful Paint)** — timestamp of the *first* rendered pixel of content (text or image), distinct from LCP (the *largest*). A large FCP-to-LCP gap usually means the LCP element specifically is slow to arrive (e.g. an unoptimized hero image) even though *something* rendered quickly.
- **TTFB (Time to First Byte)** — purely server/network: DNS lookup + connection + server processing time before the first byte of the HTML response arrives. A bad TTFB caps how good LCP can possibly be, since nothing can render before the HTML document itself starts arriving.
- **FID (First Input Delay)** — the metric INP replaced (officially retired from Core Web Vitals in March 2024). Still occasionally referenced in older documentation/dashboards; it only measured the delay before the *first* interaction was processed, missing sluggishness on subsequent interactions entirely.

### Lab Tools: Controlled, Reproducible, But Not Real-World-Representative
- **Lighthouse** — runs a single simulated page load under fixed network/CPU throttling, producing a 0-100 score per category (Performance/Accessibility/Best Practices/SEO) plus a specific list of failed audits with remediation guidance.
- **PageSpeed Insights (PSI)** — wraps Lighthouse (lab data) **and** pulls real Chrome User Experience Report field data for the same URL when available, letting you compare "how it performs in this one controlled run" against "how it actually performs for real visitors."
- **Chrome DevTools Performance Panel** — manual, interactive flame-chart recording of an actual page load or interaction session, showing exact call stacks, paint events, and long tasks — the tool for root-causing *why* a specific metric is bad, once Lighthouse/PSI have told you *that* it's bad.

---

## 2. Real-World Engineering Scenario

**Scenario**: Lighthouse Score Looking Fine While Real Users Report a Slow Site.
A team's CI-gated Lighthouse score consistently showed 92/100 performance, yet field complaints about slowness persisted. Investigating with PageSpeed Insights revealed the CrUX field data told a very different story: real users (many on mid-tier Android devices over throttled mobile networks, not Lighthouse's fixed simulated profile) experienced LCP well into "poor" territory. The gap existed because Lighthouse's specific throttling profile happened to under-represent the actual device/network mix of this site's real audience — a reminder that lab scores validate specific, controlled conditions, not universal real-world performance.

---

## 3. Production-Grade Code Example

```typescript
// lib/reportSupportingMetrics.ts — capturing FCP and TTFB alongside the Core Web Vitals
import { onFCP, onTTFB, type Metric } from 'web-vitals';

function sendToAnalytics(metric: Metric) {
  navigator.sendBeacon('/analytics/vitals', JSON.stringify(metric));
}

onFCP(sendToAnalytics);
onTTFB(sendToAnalytics);
```

```javascript
// lighthouserc.js — Lighthouse CI config, gating PRs on lab-measured regressions
module.exports = {
  ci: {
    collect: {
      url: ['http://localhost:3000/', 'http://localhost:3000/checkout'],
      numberOfRuns: 3, // median of 3 runs — reduces noise from a single unlucky/lucky run
      settings: { throttlingMethod: 'simulate', formFactor: 'mobile' },
    },
    assert: {
      assertions: {
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['error', { maxNumericValue: 300 }], // lab proxy for INP — see budgets doc
      },
    },
  },
};
```

```bash
# Comparing lab (Lighthouse) against real field data (CrUX) for the same URL
npx psi https://acme.com --key=$PSI_API_KEY --strategy=mobile
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Chasing a Perfect Lighthouse Score as the Actual Goal
Lighthouse's specific audits and scoring weights change between versions, and a page can be over-optimized for Lighthouse's particular simulated conditions without meaningfully improving real users' experience (e.g. inlining critical CSS specifically because Lighthouse's audit flags render-blocking CSS, even when the actual measured impact on real-user LCP is negligible for this specific site's traffic profile). Treat Lighthouse as a diagnostic tool pointing at real, verifiable issues — not a scoreboard to maximize for its own sake.

### ⚠️ Pitfall 2: Confusing FCP Improvements With LCP Improvements
Optimizing *something* to paint faster (a loading skeleton, a header) improves FCP but does nothing for LCP if the actual largest element (a hero image, a big text block) still arrives late — teams sometimes report "we improved FCP by 40%!" while LCP, the metric that actually matters for ranking and perceived "main content loaded" experience, is unchanged.

### ⚠️ Pitfall 3: Ignoring TTFB as "Not a Frontend Problem"
A slow TTFB (e.g. 1.2s of server processing before the first HTML byte) mathematically caps how good LCP can ever be, since the LCP timer doesn't even start counting meaningful work until the document begins arriving. Frontend teams sometimes exhaust client-side optimization budget (image compression, code splitting) while a server-side/backend/CDN-caching fix would have moved the needle far more, simply because TTFB got dismissed as someone else's problem during triage.
