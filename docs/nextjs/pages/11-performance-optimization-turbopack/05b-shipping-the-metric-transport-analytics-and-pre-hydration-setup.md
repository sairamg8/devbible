---
title: "Getting the metric out of the browser is the half that fails: `sendBeacon` exists because a normal `fetch` on a closing page is not delivered, and the analytics wiring around it has three documented details that are easy to get wrong"
sidebar_label: "05b · Shipping the metric"
sidebar_position: 121
description: "navigator.sendBeacon with the fetch keepalive fallback, the Google Analytics event shape including the CLS x1000 scale and non_interaction, what a receiving endpoint must store to compute percentiles, and instrumentation-client.js as the pre-hydration setup slot."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against the Next.js [Analytics guide](https://nextjs.org/docs/app/guides/analytics) (`version: 16.3.4`, ⚠️ `lastUpdated: 2025-05-13` — see [05](05-core-web-vitals-tuning-lcp-inp-cls-auditing-workflows.md) on what that staleness affects). `instrumentation-client.js` timing rules reused from the corpus's chapter 16 verification of [`instrumentation-client.js`](https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation-client) (`version: 16.3.4`, `lastUpdated: 2026-07-28`) — not re-fetched here.
> Target: **Next.js 16.3.4**. Documentation-verified; **no sandbox run**, **no measurements**. `navigator.sendBeacon` semantics are a browser API, not a Next.js API — where this page explains *why* it is used, the authority is the web platform, and that is said in the text.

**[05](05-core-web-vitals-tuning-lcp-inp-cls-auditing-workflows.md) ended with a metric object in a callback. This page is the rest of the journey, and it is where a home-grown vitals pipeline actually breaks — not in the hook, which is three lines, but in the transport, where the most valuable measurements are the ones taken as the user leaves. That is the whole reason the documentation reaches for `navigator.sendBeacon` before `fetch`: a request issued from a page that is being torn down is not reliably sent, and the metrics that finalise last — CLS after the final shift, INP after the slowest interaction — are precisely the ones issued then. The rest of the page is the analytics wiring the documentation spells out, three details of which will silently corrupt your data if you skip them, and `instrumentation-client.js`, which is the only documented place to have your analytics SDK ready before any of this fires.**

## The transport, verbatim

The Analytics guide gives this shape, comment included:

```js
useReportWebVitals((metric) => {
  const body = JSON.stringify(metric)
  const url = 'https://example.com/analytics'

  // Use `navigator.sendBeacon()` if available, falling back to `fetch()`.
  if (navigator.sendBeacon) {
    navigator.sendBeacon(url, body)
  } else {
    fetch(url, { body, method: 'POST', keepalive: true })
  }
})
```

⚠️ **That snippet defines the callback inline**, which is exactly what the API reference warns against — *"ensure that the callback function reference does not change"*. Written into a real component it must be hoisted:

```jsx
// app/_components/web-vitals.js
'use client'

import { useReportWebVitals } from 'next/web-vitals'

const ANALYTICS_URL = '/api/vitals'

function report(metric) {
  const body = JSON.stringify(metric)

  if (navigator.sendBeacon) {
    navigator.sendBeacon(ANALYTICS_URL, body)
  } else {
    fetch(ANALYTICS_URL, { body, method: 'POST', keepalive: true })
  }
}

export function WebVitals() {
  useReportWebVitals(report)
  return null
}
```

### Why a beacon and not a `fetch`

The Next.js guide does not explain the choice; it just makes it. The reason is a web-platform one, and it is worth stating precisely because it also explains the fallback's `keepalive` flag.

**A page that is unloading stops being a place where work happens.** A `fetch` issued from a `visibilitychange` or unload path competes with the browser's decision to tear the document down, and there is no guarantee it is sent. `navigator.sendBeacon` exists specifically to hand the request to the browser's networking stack with a promise to deliver it independently of the page's lifetime; `fetch(..., { keepalive: true })` is the same guarantee expressed on `fetch`, which is why the fallback sets it and why a fallback that forgets it is worse than no fallback.

🔴 **This is not a micro-optimisation.** Several vitals are finalised late by design — CLS accumulates until the page stops shifting, INP updates whenever a slower interaction happens. Under a plain `fetch`, the sessions you lose are not random: you lose the ones with the most shifts and the slowest interactions. **The bias runs entirely in the direction of making your site look good**, which is the worst possible kind of measurement error because nothing about the resulting dashboard looks broken.

⚠️ Two constraints the browser imposes that the Next.js guide does not mention, and that you will meet: `sendBeacon` returns a boolean rather than a promise — it tells you the request was *queued*, never that it arrived — and both it and `keepalive` fetches are subject to a payload size limit. A full `metric` object with its `entries` array can be larger than you expect. Trim before you send:

```js
function report(metric) {
  // Send the fields the sink needs, not the whole object. `entries` can be
  // large, and both sendBeacon and keepalive fetches are size-limited.
  const body = JSON.stringify({
    id: metric.id,
    name: metric.name,
    value: metric.value,
    delta: metric.delta,
    rating: metric.rating,
    navigationType: metric.navigationType,
    path: window.location.pathname,
  })

  if (!navigator.sendBeacon || !navigator.sendBeacon(ANALYTICS_URL, body)) {
    fetch(ANALYTICS_URL, { body, method: 'POST', keepalive: true })
  }
}
```

Note the second condition: `sendBeacon` returning `false` means the browser refused to queue it, and falling through to the `keepalive` fetch is a real recovery rather than a decorative one.

## The Google Analytics shape, and its three traps

The guide's GA recipe is short, and every line of it is load-bearing:

> *"`value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value)` // values must be integers"*
> *"`event_label: metric.id`, // id unique to current page load"*
> *"`non_interaction: true`, // avoids affecting bounce rate."*

```jsx
// app/_components/web-vitals.js
'use client'

import { useReportWebVitals } from 'next/web-vitals'

function report(metric) {
  window.gtag('event', metric.name, {
    // Values must be integers, and CLS is a fraction — scale it.
    value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
    event_label: metric.id, // id unique to current page load
    non_interaction: true, // avoids affecting bounce rate
  })
}

export function WebVitals() {
  useReportWebVitals(report)
  return null
}
```

**Trap 1 — `metric.value * 1000` is not optional and not a rounding convenience.** GA's event `value` must be an integer. CLS is a unitless fraction that in a healthy page is well under `0.1`, so `Math.round` alone maps every acceptable CLS to `0` and every terrible one to `0` as well. Scaling to thousandths first is what makes the metric representable at all. **Whoever builds the report must know the units changed** — a CLS of `0.08` arrives in GA as `80`, and the "good" boundary of `0.1` becomes `100`. Write it down next to the dashboard, because this is the single fact most likely to be lost between the person who instrumented and the person who reads it.

**Trap 2 — `event_label: metric.id` is what makes percentiles possible.** The guide says why: *"If you use Google Analytics, using the `id` value can allow you to construct metric distributions manually (to calculate percentiles, etc.)"* The `id` is unique to the current page load, so it is the key that lets you group a session's reports and count each page load once. Without it you have a bag of numbers with no way to tell one slow session's five reports from five slow sessions.

**Trap 3 — `non_interaction: true` protects a *different* metric.** In GA, an event that is not marked non-interaction counts as engagement and therefore stops the session being classified as a bounce. Instrument every page view with several vitals events and you will drive your bounce rate to near zero, quietly, and business reporting will be wrong in a way that has nothing to do with performance. This flag is the fix, and it is one word.

## What the receiving endpoint has to store

If you are not using a vendor, the endpoint is yours, and its schema decides which questions you can answer later. Core Web Vitals are graded at the **75th percentile of real page views** — a definition from web.dev, not from Next.js — so a schema that stores averages has thrown away the answer before you asked the question.

```ts
// app/api/vitals/route.ts
import { after } from 'next/server'

export async function POST(request: Request) {
  const metric = await request.json()

  // Respond immediately; the beacon does not wait, and neither should the user.
  after(async () => {
    await insertVital({
      metricId: metric.id, // group by this to count page loads once
      name: metric.name,
      value: metric.value, // store raw; do not pre-aggregate
      rating: metric.rating,
      path: metric.path,
      navigationType: metric.navigationType,
      receivedAt: new Date(),
    })
  })

  return new Response(null, { status: 204 })
}
```

Three schema decisions worth making deliberately:

1. **Store raw observations, never an average.** You cannot recover a percentile from a mean. Storage is cheap; a re-instrumentation is not.
2. **Store the path, and store it normalised.** A dynamic route reported as `/orders/8f2c-…` produces one row per order and no aggregate. Map it to `/orders/[id]` at the sender or at ingest.
3. **Keep `id` as a column.** It is the only thing that lets you say "the 75th percentile *of page loads*" rather than "of reports", and those differ whenever a metric reports more than once — which is most of them.

⚠️ **Return `204` and do no work on the request path.** A vitals endpoint that blocks on a database write turns your performance instrumentation into a source of server load proportional to traffic, on the same infrastructure whose performance you are measuring.

## `instrumentation-client.js` — the pre-hydration slot

The Analytics guide names the file, and it is the correct place for the *setup* half of any of the above:

> *"Next.js provides a `instrumentation-client.js|ts` file that runs before your application's frontend code starts executing. This is ideal for setting up global analytics, error tracking, or performance monitoring tools."*

**The timing is the point.** From the file convention's own reference: it runs after the HTML document loads, **before hydration**, and therefore before any interaction. That window is exactly where an analytics SDK needs to be initialised, because an SDK that becomes ready after hydration has already missed the earliest interactions — and INP is made of interactions.

```ts
// instrumentation-client.ts
// Runs after the document loads and before hydration.
// Synchronous, top-level work only.
window.__vitalsQueue = []
window.__appVersion = process.env.NEXT_PUBLIC_BUILD_ID
initAnalyticsSdkSynchronously()
```

🔴 **Two documented constraints, and both are absolute:**

> *"Only synchronous, top-level code is guaranteed to complete before hydration. Asynchronous work started here (a `Promise`, `import()`, or top-level `await`) is not awaited and may resolve after hydration has begun, so treat it as fire-and-forget."*

> *"Next.js monitors initialization time in development and will log warnings if it takes longer than 16ms, which could impact smooth page loading."*

Read them together and the design rule falls out: **this file has a 16 ms budget and no way to wait.** Anything you `await` here has left the guarantee. So the pattern that works is a synchronous queue, drained later:

```ts
// instrumentation-client.ts — synchronous, tiny, and it does not block.
window.__vitalsQueue = []

// Fire-and-forget by design: this may resolve after hydration, and that is fine
// because the queue above already exists for anything reported in the meantime.
import('./lib/analytics').then((m) => {
  m.init()
  m.drain(window.__vitalsQueue)
})
```

⚠️ The 16 ms figure is a **development-mode warning threshold**, not a production budget the framework enforces. It is a signal that you have put too much in the file — it does not mean production silently fails at 17 ms. Treat it as a lint rule with a good justification behind it: 16 ms is roughly one frame.

The full contract of `instrumentation-client.ts`, alongside `register()` and `onRequestError`, is [chapter 16 · 04](../16-deployment-scaling-and-observability/04-telemetry-sentry-logtail-datadog-integration-via-instrumenta.md). What it costs at boot is [06](06-instrumentationts-for-opentelemetry-and-application-monitori.md) in this chapter.

## Gotchas

**★ Symptom: your field data looks better than your users' complaints, and better than Search Console.** Cause: the transport uses a plain `fetch` without `keepalive`, so reports issued as the page unloads are dropped — and the vitals that finalise late are CLS and INP, the two that are worst on the worst sessions. The loss is biased toward good-looking data. Fix: use the documented beacon-first transport, and treat a `false` return as a real fallback trigger:

```js
if (!navigator.sendBeacon || !navigator.sendBeacon(url, body)) {
  fetch(url, { body, method: 'POST', keepalive: true })
}
```

**★ Symptom: every CLS event in Google Analytics has a value of `0`.** Cause: GA event values must be integers and CLS is a fraction below 1, so `Math.round(metric.value)` maps the entire useful range to zero. Fix: the documented scale, and a note wherever the number is displayed:

```js
value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value)
// CLS is now in thousandths: the web.dev "good" boundary of 0.1 reads as 100.
```

**★ Symptom: bounce rate collapsed to near zero in the same week vitals reporting shipped.** Cause: GA events count as engagement unless flagged, and you are now firing several per page view. Fix: `non_interaction: true` on every vitals event — the guide's own comment is *"avoids affecting bounce rate."* Add it, and be prepared to explain the discontinuity in historical reports rather than assuming the old numbers were wrong.

**★ Symptom: some reports arrive truncated or never arrive, especially on pages with many layout shifts.** Cause: the payload was the whole `metric` object including `entries`, and both `sendBeacon` and `keepalive` fetches are size-limited by the browser. Fix: send a projection, not the object:

```js
const body = JSON.stringify({
  id: metric.id, name: metric.name, value: metric.value,
  delta: metric.delta, rating: metric.rating, path: normalisePath(),
})
```

**★ Symptom: the vitals table has millions of rows and you still cannot answer "what is our p75 LCP".** Cause: rows are keyed by report, not by page load, and several metrics report repeatedly — so a percentile over rows over-weights the sessions that reported most, which are the ones that shifted most. Fix: keep `metric.id`, and take one observation per `(id, name)` before computing the percentile:

```sql
SELECT percentile_cont(0.75) WITHIN GROUP (ORDER BY v)
FROM (SELECT metric_id, MAX(value) AS v FROM vitals
      WHERE name = 'LCP' GROUP BY metric_id) AS per_page_load;
```

**Symptom: the vitals endpoint shows up in your own slow-route list.** Cause: it writes to the database on the request path, so it scales with traffic and adds load to the system you are measuring. Fix: acknowledge immediately and do the write afterwards, as in the `after()` handler above — the beacon never reads your response anyway.

**Symptom: a dev-server warning says client instrumentation took longer than 16 ms.** Cause: `instrumentation-client.ts` is doing real work, and *"Next.js monitors initialization time in development and will log warnings if it takes longer than 16ms."* Fix: leave only synchronous setup in the file and move the rest behind a fire-and-forget dynamic import, as in the queue pattern above.

**Symptom: an SDK initialised in `instrumentation-client.ts` with `await` is undefined when the first metric fires.** Cause: *"Only synchronous, top-level code is guaranteed to complete before hydration"* — an `await` or `import()` there is fire-and-forget and may resolve after hydration. Fix: create the synchronous queue at top level and drain it when the SDK resolves; never assume ordering between the two.

**Symptom: per-route dashboards show hundreds of routes, most with one page view.** Cause: the sender recorded `window.location.pathname` literally, so every dynamic segment value became its own route. Fix: normalise to the route pattern before sending, or map it at ingest against your known route list.

## Interview questions

**★ Why does the documented web-vitals transport prefer `navigator.sendBeacon` over `fetch`?**
Because the most important reports are issued as the page is going away. CLS keeps accumulating until the page stops shifting and INP updates whenever a slower interaction happens, so both are typically finalised near the end of a visit — and a request started while the document is being torn down is not reliably sent. `sendBeacon` hands the request to the browser to deliver independently of the page's lifetime, and the documented fallback expresses the same guarantee on `fetch` via `keepalive: true`. The subtle part is the direction of the error: without it, the sessions you drop are the ones with the most shifts and the slowest interactions, so the data does not merely get noisier, it gets systematically flattering.

**★ Walk me through the three things the Google Analytics recipe does that a naive implementation would miss.**
It multiplies CLS by 1000 before rounding, because GA event values must be integers and CLS is a fraction under 1 — without it every CLS event is zero. It sets `event_label` to `metric.id`, which the guide describes as unique to the current page load, so that you can group reports by page load and construct real distributions rather than averaging a bag of numbers. And it sets `non_interaction: true`, because otherwise every vitals event counts as engagement and your bounce rate quietly goes to zero — a business metric broken by a performance instrument.

**★ Where does analytics SDK initialisation belong in a Next.js app, and what are its constraints?**
`instrumentation-client.ts`, which the documentation describes as running before your application's frontend code starts executing and as ideal for setting up global analytics, error tracking or performance monitoring. It runs after the document loads and before hydration, which is the window you want because an SDK that is ready after hydration has already missed the earliest interactions. The two constraints are hard: only synchronous top-level code is guaranteed to complete before hydration — anything asynchronous is explicitly fire-and-forget — and Next.js warns in development if initialisation exceeds 16 ms. So the correct shape is a tiny synchronous setup, typically a queue, with the heavy SDK loaded asynchronously and draining the queue when it arrives.

**You are asked to compute p75 LCP from a table of vitals reports. What is the trap?**
That reports are not page loads. Several vitals report more than once per page load as they refine, and the number of reports correlates with how bad the page was, so a percentile taken over raw rows over-weights exactly the worst sessions and moves your p75 in a direction that has nothing to do with a code change. The fix is to collapse to one observation per `metric.id` first — which is why keeping `id` in the schema matters — and take the percentile over page loads. The 75th percentile itself is the definition Core Web Vitals uses, and that definition comes from web.dev, not from Next.js.

**Your vitals endpoint appears in your own slow-endpoint report. What went wrong and what do you change?**
It is doing work on the request path — almost always a synchronous database insert — so it scales linearly with traffic and adds load to the very system whose performance you are measuring. Nothing about the beacon requires a meaningful response: `sendBeacon` returns a boolean about queuing and never inspects what comes back. So the endpoint should return `204` immediately and do the write afterwards, and the payload should be a projection of the metric rather than the whole object, since `entries` can be large and both `sendBeacon` and `keepalive` fetches are size-limited.

**What does it mean that `sendBeacon` returns `false`, and what should your code do about it?**
It means the browser declined to queue the request — commonly because the payload exceeded the size limit — and it is the only feedback the API gives you, since a successful return says the request was queued, never that it arrived. Treating the return value as meaningful is what makes the documented fallback real rather than decorative: if the beacon was not queued, fall through to `fetch` with `keepalive: true`. And if you see it returning `false` at any volume, the fix is upstream: send fewer fields.

---

← [05 · The Web Vitals stream](05-core-web-vitals-tuning-lcp-inp-cls-auditing-workflows.md) · [Chapter index](01-explanation.md) · Next → [05c · The lever each metric responds to](05c-the-lever-each-metric-actually-responds-to.md)
