---
title: "Next.js gives you a metric stream and nothing else — no thresholds, no dashboard, no storage — and the guide that documents it is sixteen months old and still lists a metric the web platform retired"
sidebar_label: "05 · The Web Vitals stream"
sidebar_position: 5
description: "What useReportWebVitals actually is, why the analytics guide's metric list cannot be trusted verbatim, the client-boundary confinement rule quoted from the docs, the metric object's fields, the stable-callback trap, and switching on metric.name."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against the Next.js [Analytics guide](https://nextjs.org/docs/app/guides/analytics) (`version: 16.3.4`, ⚠️ **`lastUpdated: 2025-05-13`**) and, for the metric object and the stable-callback rule, the [`useReportWebVitals` API reference](https://nextjs.org/docs/app/api-reference/functions/use-report-web-vitals) (`version: 16.3.4`, `lastUpdated: 2026-02-27`) as verified for [chapter 3 · 06b](../03-server-components-vs-client-components/06b-measuring-the-boundary.md) — reused from the corpus, not re-fetched here.
> Target: **Next.js 16.3.4**, App Router. Documentation-verified; **no sandbox run**, **no measurements**, **no metric values reproduced**. 🔴 Threshold numbers do not appear anywhere in the Next.js documentation and are not asserted on this page — see [Where the thresholds come from](#where-the-thresholds-come-from-and-why-not-from-here).

**The single most useful thing to understand about Core Web Vitals in Next.js is how little of the problem the framework claims. `useReportWebVitals` is a hook that hands you an object each time the browser finishes computing a metric. That is the entire surface. There is no threshold, no grading, no aggregation, no storage, no dashboard and no opinion — every one of those is yours to build or buy, and the documentation is honest about it by omission. Two consequences follow, and they are the reason this page exists: the pipeline you build around the hook is where all the real failure modes live, and the guide that documents the hook has not been reviewed in sixteen months, so its own metric list has drifted out of step with the web platform it reports on.**

## ⚠️ The guide is stale, and you should know which parts

The Analytics guide carries `lastUpdated: 2025-05-13`. At the time of writing that is roughly sixteen months, and it is the oldest page in this chapter's source set by a wide margin — the neighbouring API references were reviewed in 2026.

**The visible symptom is the metric list.** The guide enumerates, verbatim:

> TTFB · FCP · LCP · **FID** · CLS · **INP**

🔴 **FID is on that list and should not be acted on.** First Input Delay was replaced by Interaction to Next Paint as the responsiveness Core Web Vital by the web-vitals project; INP is on the same list, which is the tell — a current document would not need both. Two honest caveats about how far I will take that claim:

- **I did not confirm FID's retirement date against a primary source in this pass.** The corpus's chapter 3 verification reached the same conclusion the same way and recorded the same limit. Treat FID as legacy and build your dashboards on INP.
- **The staleness does not invalidate the code.** The hook, the boundary rule, the transport snippet and the Google Analytics shape are all still consistent with the current API reference. It is the *editorial* content — which metrics matter — that has drifted.

**The general lesson is worth more than the specific one.** `lastUpdated` is published on every Next.js docs page, and it is the only signal you get about whether a guide has been re-read since the ecosystem moved. Check it before you take an opinion from a guide, as opposed to an API shape from a reference.

## The hook is a subscription, not a measurement

```jsx
// app/_components/web-vitals.js
'use client'

import { useReportWebVitals } from 'next/web-vitals'

export function WebVitals() {
  useReportWebVitals((metric) => {
    console.log(metric)
  })

  return null
}
```

The component renders `null`. It exists solely to be a place where a `'use client'` directive can live. The browser computes the metrics; the hook delivers them.

> *"Next.js has built-in support for measuring and reporting performance metrics."*
> *"You can handle all the results of these metrics using the `name` property."*

**What the hook does not do**: it does not run in a build, it does not run in a test, it does not run on the server, and it does not fire for a session that closes before the metric can be finalised in the way that metric requires. It reports what real browsers on real sessions actually experienced — which is its whole value and also why it is useless the first day you ship it and valuable the first week.

## 🔴 The boundary-confinement rule, quoted

This is the load-bearing sentence on the whole page, and it is a lesson about React Server Components disguised as an analytics tip:

> *"Since the `useReportWebVitals` hook requires the `'use client'` directive, the most performant approach is to create a separate component that the root layout imports. This confines the client boundary exclusively to the `WebVitals` component."*

```jsx
// app/layout.js — stays a Server Component. No directive here.
import { WebVitals } from './_components/web-vitals'

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <WebVitals />
        {children}
      </body>
    </html>
  )
}
```

**Why this matters more than it looks.** The naive instrumentation — put `'use client'` at the top of `app/layout.js` and call the hook there — is one line shorter and converts your application's outermost layout into a Client Component. The root layout is the one module every route in the application has in common. Making it a client module is the single widest boundary change available in an App Router codebase, and you would be making it in order to measure how fast the application is.

That is not merely ironic; it is self-defeating in a specific, measurable way. Client JavaScript is main-thread work, main-thread work is what INP is made of, and INP is exactly the metric this hook exists to report. The push-down rule is argued in full in [chapter 3 · 03](../03-server-components-vs-client-components/03-composition-patterns-server-to-client-boundaries.md); what this page adds is that **the rule applies hardest to the measuring instrument itself.**

⚠️ **One thing to be careful about when you explain this to a colleague.** The documented reason is that a separate component *confines the client boundary*. Do not over-claim the mechanics beyond what the docs say — the sentence to quote is the one above, and the actionable form of it is: the file that calls the hook should contain the hook and nothing else.

## The metric object

The API reference documents the object handed to your callback:

| Field | What it carries |
|---|---|
| `id` | *"id unique to current page load"* — the join key for reconstructing a distribution |
| `name` | which metric this is: `LCP`, `INP`, `CLS`, `TTFB`, `FCP` — and, on the guide's list, the legacy `FID` |
| `value` | the measured value; **units differ by metric** |
| `delta` | the change since the last report of this metric on this page load |
| `entries` | the underlying performance entries |
| `navigationType` | how the page was reached |
| `rating` | `"good"`, `"needs-improvement"` or `"poor"` |

Two of these decide whether your pipeline is correct.

**`delta` versus `value` is not a style choice.** Several vitals are *reported repeatedly during a page's life*, refining as more information arrives — CLS accumulates, INP updates when a slower interaction happens. If your endpoint sums what it receives, you must send `delta`. If it stores the latest observation per `(id, name)`, you must send `value`. Mixing the two produces numbers that are wrong in a direction that always looks like a regression.

**`rating` is the only grading Next.js will give you**, and neither the Analytics guide nor the hook's API reference states the boundaries it uses — I could not settle that from the Next.js documentation. It is convenient for a coarse alert; it is not a substitute for storing `value` and computing your own percentiles.

## 🔴 The stable-callback rule

The API reference states this outright, and it is the most common way a self-built vitals pipeline reports numbers that are quietly too high:

> *"New functions passed to `useReportWebVitals` are called with the available metrics up to that point. To prevent reporting duplicated data, ensure that the callback function reference does not change."*

```jsx
// ❌ WRONG. The arrow function is a new reference on every render, so
// every re-render replays the metrics already collected on this page load.
'use client'
import { useReportWebVitals } from 'next/web-vitals'

export function WebVitals({ endpoint }) {
  useReportWebVitals((metric) => send(endpoint, metric))
  return null
}
```

```jsx
// ✅ RIGHT. Hoist the callback out of the component entirely, so its
// identity is fixed for the lifetime of the module.
'use client'
import { useReportWebVitals } from 'next/web-vitals'

const ENDPOINT = '/api/vitals'

function report(metric) {
  send(ENDPOINT, metric)
}

export function WebVitals() {
  useReportWebVitals(report)
  return null
}
```

**If the callback genuinely needs a value from props or state**, wrap it in `useCallback` with an exhaustive dependency list and accept that a change in those dependencies *will* replay. The safer design is to keep the component prop-less and read configuration from a module-level constant or a build-time environment variable, which is what the hoisted version above does.

## Switching on `metric.name`

> *"You can handle all the results of these metrics using the `name` property."*

```jsx
'use client'

import { useReportWebVitals } from 'next/web-vitals'

function report(metric) {
  switch (metric.name) {
    case 'LCP':
      // Largest Contentful Paint, in milliseconds.
      break
    case 'INP':
      // Interaction to Next Paint, in milliseconds.
      break
    case 'CLS':
      // Cumulative Layout Shift — unitless, and a small fraction.
      // Every consumer that expects an integer needs this scaled.
      break
    case 'TTFB':
    case 'FCP':
      // Diagnostic, not a Core Web Vital. Useful for attributing LCP.
      break
    default:
      // Includes FID on the guide's list. Do not build on it.
      break
  }
}

export function WebVitals() {
  useReportWebVitals(report)
  return null
}
```

🔴 **CLS is the one that breaks pipelines**, and it breaks them silently. It is a unitless ratio, not a duration, so it arrives as a small fraction while every other metric arrives as milliseconds. Any consumer with an integer column, an integer-typed analytics event, or a histogram bucketed in milliseconds will round it to zero and report a perfect score forever. The documented workaround is in the Google Analytics recipe on [05b](05b-shipping-the-metric-transport-analytics-and-pre-hydration-setup.md), and it is the reason that recipe multiplies CLS by 1000.

## Where the thresholds come from, and why not from here

**The Next.js documentation contains no threshold numbers.** Not on the Analytics guide, not on the hook's API reference. The familiar "good" boundaries — 2.5 s for LCP, 200 ms for INP, 0.1 for CLS — are **web.dev's**, published by the Chrome team as part of the Core Web Vitals programme.

That distinction is worth keeping straight for two reasons. First, accuracy: presenting them as Next.js documentation puts a citation on a claim that will not survive being checked. Second, and more practically, the thresholds come with definitional baggage that only their real source explains — they are defined at the **75th percentile of real page views**, which is why a green Lighthouse run on your laptop is a sample from the good tail and not a compliance statement.

The corpus already carries the web.dev thresholds, quoted and attributed, with the LCP sub-part budget and the three phases of an interaction: [chapter 3 · 06](../03-server-components-vs-client-components/06-bundle-size-implications-and-core-web-vitals-impact.md). Use that page for the numbers; use this one for the pipeline.

## What this chapter owns, and what it hands off

| Question | Where it is answered |
|---|---|
| What are the thresholds, and what is LCP made of? | [ch3 · 06](../03-server-components-vs-client-components/06-bundle-size-implications-and-core-web-vitals-impact.md) — web.dev, quoted |
| Which boundary decision caused this regression? | [ch3 · 06b](../03-server-components-vs-client-components/06b-measuring-the-boundary.md) — import chains and analyzers |
| How do I get the numbers out of real sessions? | this page, and [05b](05b-shipping-the-metric-transport-analytics-and-pre-hydration-setup.md) |
| Which Next.js lever moves each metric? | [05c](05c-the-lever-each-metric-actually-responds-to.md) |
| How much does the instrumentation itself cost? | [06](06-instrumentationts-for-opentelemetry-and-application-monitori.md) |

## Gotchas

**★ Symptom: your reported metric counts are far higher than your page-view counts, and averages look worse than the field data in Search Console.** Cause: the callback was defined inline in the component body, so every re-render passes a new function reference — and *"New functions passed to `useReportWebVitals` are called with the available metrics up to that point"*, replaying everything already collected. Fix: hoist the callback to module scope so its identity never changes:

```jsx
const report = (metric) => navigator.sendBeacon('/api/vitals', JSON.stringify(metric))

export function WebVitals() {
  useReportWebVitals(report) // stable reference, one report per metric
  return null
}
```

**★ Symptom: CLS is reported as 0 for every session, in a dashboard where every other metric looks plausible.** Cause: CLS is a unitless fraction, typically well under 1, and the sink stores integers — so it rounds to zero. Fix: scale it at the boundary where the integer requirement lives, and record that you did:

```js
const value = Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value)
// CLS is now in thousandths. Divide by 1000 when you display it.
```

**★ Symptom: adding web-vitals reporting made INP worse.** Cause: the hook was called directly in `app/layout.js`, which required `'use client'` on the root layout and converted the widest module in the application into a client module. Fix: the documented shape — a separate component that the layout imports, *"confining the client boundary exclusively to the `WebVitals` component"*:

```jsx
// app/layout.js — no 'use client' here
import { WebVitals } from './_components/web-vitals'

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <WebVitals />
        {children}
      </body>
    </html>
  )
}
```

**★ Symptom: your dashboard tracks FID because the Next.js guide lists it, and it is always green while users complain about responsiveness.** Cause: FID measures only the delay before the *first* input's handler starts. INP observes the latency of all interactions across the visit, which is why it replaced FID — and the guide listing both is a symptom of its `lastUpdated: 2025-05-13` staleness. Fix: switch the alert to `INP` and leave FID collected-but-ungraded if you want historical continuity.

**Symptom: totals drift upward over time and nobody can reproduce it.** Cause: the pipeline sends `value` but the sink sums rows. Several vitals report more than once per page load as they refine, so summing `value` double-counts. Fix: pick one contract and enforce it at the sender:

```js
// Sink sums rows → send the increment.
send({ name: metric.name, v: metric.delta, id: metric.id })

// Sink keeps the latest per (id, name) → send the absolute value.
send({ name: metric.name, v: metric.value, id: metric.id })
```

**Symptom: nothing is reported at all in development, so you assume the wiring is broken.** Cause: some vitals are only finalised on states a dev session rarely reaches, and the component renders `null`, so there is no visual confirmation of anything. Fix: prove the wiring with the documented `console.log` callback first, interact with the page, then navigate away — and only then swap in the network transport.

**Symptom: a metric arrives with no `entries`, so attribution code throws.** Cause: `entries` carries the underlying performance entries and is not guaranteed to be populated for every report of every metric. Fix: treat it as optional at the boundary rather than in a dozen call sites:

```js
const entries = Array.isArray(metric.entries) ? metric.entries : []
```

## Interview questions

**★ Why does the Next.js documentation tell you to put `useReportWebVitals` in its own component rather than in the root layout?**
Because the hook requires `'use client'`, and the directive marks a boundary, not a single call. Putting it at the top of `app/layout.js` converts the outermost layout — the one module shared by every route in the application — into a Client Component. The documentation's phrasing is that a separate component *"confines the client boundary exclusively to the `WebVitals` component"*. The self-defeating part is what you would be measuring: client JavaScript is main-thread work and main-thread work is what INP is made of, so the naive instrumentation degrades the metric it was installed to report.

**★ What does `useReportWebVitals` actually give you, and what do you still have to build?**
It gives you a callback invoked with a metric object — `id`, `name`, `value`, `delta`, `entries`, `navigationType` and `rating` — each time the browser finalises a measurement. Everything else is yours: transport, an endpoint or vendor to receive it, storage, aggregation, percentile computation, alerting, and the thresholds to grade against. Next.js publishes no thresholds at all; the familiar 2.5 s / 200 ms / 0.1 boundaries are web.dev's. Knowing that the framework's contribution stops at the callback is the difference between building a pipeline and assuming one exists.

**★ Your web-vitals numbers are worse than the field data Google reports for the same site. Name the two most likely causes.**
First, duplicate reporting from an unstable callback: the documentation states that new functions passed to the hook are called with the metrics collected so far, so an inline arrow function replays history on every re-render and inflates both counts and averages. Second, a `delta`-versus-`value` mismatch — several vitals report repeatedly as they refine, so summing `value` in the sink double-counts while summing `delta` is correct. Both produce numbers that are self-consistent and wrong, which is why they survive review.

**Why would CLS be the metric that breaks a new analytics pipeline?**
Because it is the only one that is not a duration. LCP, INP, TTFB and FCP arrive in milliseconds; CLS is a unitless layout-shift score, usually a small fraction. Any sink that expects an integer — an analytics event with an integer value, a millisecond-bucketed histogram, an integer database column — silently rounds it to zero and reports a permanent perfect score. The documented workaround is to multiply CLS by 1000 before rounding, and then to remember you did when displaying it.

**★ How would you know whether a page of the Next.js documentation is still current?**
Read the `lastUpdated` field, which every docs page publishes. It is the difference between an API reference reviewed months ago and a guide that has not been re-read in over a year. The Analytics guide is the working example: its `lastUpdated` is 2025-05-13 and it still lists FID alongside INP, which is a metric list the web platform has moved past. The code on it is still correct — the API has not changed — but its editorial judgement about which metrics matter has drifted. The general rule is to take API shapes from references and to check the date before taking an opinion from a guide.

**Is `metric.rating` enough to run an SLO on?**
No, for two reasons. The Next.js documentation does not state what boundaries `rating` uses, so you would be running a service objective on an unstated definition. And Core Web Vitals are defined at the 75th percentile of real page views, which is a property of a *distribution* — a per-observation label cannot express it. Store `value` alongside `id`, compute your own percentiles, and treat `rating` as a convenient coarse signal for a smoke alert rather than as the grade.

---

← [04b · What survives the withdrawal](04b-what-survives-the-withdrawal-proxy-and-region-placement.md) · [Chapter index](01-explanation.md) · Next → [05b · Shipping the metric](05b-shipping-the-metric-transport-analytics-and-pre-hydration-setup.md)
