---
title: "Diagnosing a Production LCP/INP Regression, End-to-End"
sidebar_label: "Diagnosing a Production LCP/INP Regression"
sidebar_position: 1
---

# 🚀 Diagnosing a Production LCP/INP Regression, End-to-End

## 1. Under-The-Hood Mechanics

A real regression investigation moves through **three genuinely different tools**, in a specific order, because each one answers a question the previous one can't:

```text
1. FIELD DATA (RUM)         "Did something actually get worse, for real users?"
   web-vitals library            ──► confirms the regression is real, not noise, and roughly WHEN it started
        │
        ▼
2. ATTRIBUTION                "WHICH element, and WHICH sub-phase of loading it, is responsible?"
   web-vitals/attribution        ──► turns "LCP is 4.1s" into "the hero <img> spent 2.8s in
                                        Resource Load Delay specifically"
        │
        ▼
3. LAB REPRODUCTION            "WHY is that specific sub-phase slow? What's the actual root cause?"
   Lighthouse / DevTools           ──► a controlled, repeatable environment where you can actually
   Performance panel                  read a flame chart, a waterfall, a network timing breakdown
```

Skipping straight to lab tools without field data + attribution first means profiling blind — Lighthouse can tell you a page is slow, but not that it got 40% slower specifically for mobile users on the checkout route starting three days ago, which is the information that actually points at a root cause instead of a generic "make everything faster" todo.

### LCP's Four Attributed Sub-Phases
The `web-vitals/attribution` build breaks a bad LCP score into four additive phases, each with a different fix category:
```text
TTFB (Time to First Byte)       — server/network slowness BEFORE any HTML arrives
Resource Load Delay              — time between the HTML parser discovering the LCP resource's URL
                                    and the browser actually STARTING to request it (often a
                                    late-discovered background-image or JS-injected <img>)
Resource Load Time                — the actual download duration for that resource once requested
Element Render Delay                — time between the resource finishing download and the
                                        browser actually PAINTING it (often blocked by long tasks
                                        or render-blocking CSS/JS)
```

---

## 2. Real-World Engineering Scenario

**Scenario**: A Silent LCP Regression, Caught by Field Data Three Days After a Deploy, Root-Caused by Attribution in Minutes.
A RUM dashboard's p75 LCP for the product page trends flat for weeks, then steps up by 900ms starting from a specific date — nobody filed a bug, because nothing "broke," the page just got measurably slower for real users. Correlating that date against the deploy log identifies the suspect release. Pulling LCP attribution data from the SAME time window shows the regression is almost entirely in `resourceLoadDelay`, not `resourceLoadTime` — meaning the hero image itself isn't slower to download, it's being **discovered later** by the browser than before. The suspect deploy's diff shows the hero image was changed from a plain `<img src="...">` (parseable immediately by the HTML preload scanner) to a JS-rendered background-image set after a client-side data fetch — the browser now can't even start requesting the image until JS has run and fetched data first. Lab reproduction (Lighthouse, throttled) confirms the same pattern, and the fix (reverting to a plain `<img>` with the URL known at HTML-parse time, or adding a `<link rel="preload">` for it) is now targeted at the ACTUAL cause instead of a guess.

---

## 3. Production-Grade Diagnostic Sequence

```typescript
// Step 1: FIELD — confirm the regression is real and get a rough timestamp/segment for it
// (this assumes RUM beaconing is already wired up — see the RUM library doc)
import { onLCP } from 'web-vitals';

onLCP((metric) => {
  navigator.sendBeacon('/analytics/vitals', JSON.stringify({
    ...metric,
    route: window.location.pathname,
    deployVersion: window.__BUILD_ID__, // critical for correlating against the deploy timeline
  }));
});
```

```typescript
// Step 2: ATTRIBUTION — once field data confirms a regression, get the sub-phase breakdown.
// Note the import path: /attribution is a SEPARATE, slightly larger build of the library,
// specifically because most production sites don't need the extra attribution payload on
// every single page load — only add it once you're actively investigating something
import { onLCP } from 'web-vitals/attribution';

onLCP((metric) => {
  const { element, resourceLoadDelay, resourceLoadTime, elementRenderDelay, timeToFirstByte } = metric.attribution;
  navigator.sendBeacon('/analytics/vitals-attribution', JSON.stringify({
    value: metric.value,
    element,                 // e.g. "img.hero-image" — the ACTUAL LCP candidate element
    timeToFirstByte,
    resourceLoadDelay,       // large value here = "discovered too late", not "too slow to download"
    resourceLoadTime,        // large value here = genuinely slow download (CDN, size, format)
    elementRenderDelay,      // large value here = something is BLOCKING paint after download
  }));
});
```

```bash
# Step 3: LAB REPRODUCTION — confirm the field-identified pattern under controlled conditions
# where you can actually attach DevTools and read a flame chart/waterfall
npx lighthouse https://staging.acme.com/products/123 \
  --throttling-method=simulate --only-categories=performance --view
```

```text
# In Chrome DevTools' Performance panel, with the SAME throttling profile as the Lighthouse run:
# 1. Record a page load
# 2. Find the LCP marker on the timeline (a labeled marker in newer DevTools versions)
# 3. Look at the Network track for the LCP element's actual resource — is its request
#    starting late (confirming resourceLoadDelay) or just taking a long time once started
#    (confirming resourceLoadTime)?
```

```tsx
// Step 4: FIX — targeted at the ACTUAL attributed sub-phase, not a generic "optimize images" pass
// ❌ BEFORE: hero image only discoverable after a client fetch resolves — late resourceLoadDelay
function ProductHero({ productId }: { productId: string }) {
  const { data } = useQuery({ queryKey: ['product', productId], queryFn: () => fetchProduct(productId) });
  return <div style={{ backgroundImage: `url(${data?.heroImageUrl})` }} />; // URL unknown until JS + fetch complete
}

// ✅ AFTER: server-rendered plain <img>, URL present in the INITIAL HTML — the browser's
// preload scanner can discover and start requesting it immediately, before ANY JS runs
function ProductHero({ heroImageUrl }: { heroImageUrl: string }) {
  return <img src={heroImageUrl} alt="" fetchPriority="high" />;
}
```

```typescript
// Step 5: CONFIRM IN FIELD — the loop isn't done at "the fix looks right in the lab";
// deploy, then verify the SAME field-data dashboard from Step 1 actually recovers
onLCP((metric) => {
  navigator.sendBeacon('/analytics/vitals', JSON.stringify({ ...metric, deployVersion: window.__BUILD_ID__ }));
});
// Watch the p75 trend for the days following the fix's deploy — a lab-verified fix that
// doesn't show up in the field data warrants re-investigation (real device/network
// distribution can behave differently than any single lab configuration)
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Jumping Straight to Lighthouse Without Field Data First
```text
❌ Lighthouse tells you THIS page, on THIS one simulated run, scores X — it says nothing about
whether real users' actual experience changed, for which segment (device/route/geography), or
when. "Let's just run Lighthouse and see what it says" on an undirected page often surfaces
pre-existing, already-known tradeoffs rather than an actual NEW regression worth chasing.

✅ CORRECT: field data first (Step 1) tells you IF and WHEN something got worse; only then
does a targeted lab investigation (Step 3) make sense, aimed at reproducing a SPECIFIC,
confirmed regression rather than fishing for anything Lighthouse happens to flag.
```

### ⚠️ Pitfall 2: Treating `resourceLoadDelay` and `resourceLoadTime` as the Same Problem
Optimizing image compression/format (fixes `resourceLoadTime`) does nothing for a `resourceLoadDelay` problem (the resource is discovered too late to even start downloading promptly) — these are different bugs with different fixes, and the attribution breakdown (Step 2) is specifically what tells you which one you actually have before you spend effort on the wrong fix category.

### ⚠️ Pitfall 3: Using the `/attribution` Build on Every Production Page Load by Default
```typescript
// ⚠️ The attribution build carries extra payload/overhead versus the base web-vitals import —
// appropriate for an ACTIVE investigation, but shipping it as the permanent default RUM
// collection code on every page for every user is unnecessary ongoing cost
import { onLCP } from 'web-vitals/attribution'; // fine temporarily, reconsider as the permanent default

// ✅ CORRECT: base web-vitals for permanent, always-on RUM collection; attribution build
// enabled temporarily (a feature flag, a sampled percentage of sessions, or a debug build)
// specifically while investigating a confirmed regression
```

### ⚠️ Pitfall 4: Declaring Victory at "The Lab Numbers Look Better" Without Step 5
A fix that improves a local/staging Lighthouse score can still fail to move the real field p75 — a lab run is one configuration (one throttling profile, one device simulation), while field data is the actual distribution of real users' devices and networks. Closing the investigation only once the SAME field dashboard that flagged the regression shows recovery is what actually confirms the fix worked for real users, not just in the specific conditions a lab tool happened to simulate.
