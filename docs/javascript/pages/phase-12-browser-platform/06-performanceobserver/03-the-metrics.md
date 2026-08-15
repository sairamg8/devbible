---
title: "03 · The metrics that matter: LCP, INP, CLS and long tasks"
sidebar_label: "03 · The metrics"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`LargestContentfulPaint`](https://developer.mozilla.org/en-US/docs/Web/API/LargestContentfulPaint), [`LayoutShift`](https://developer.mozilla.org/en-US/docs/Web/API/LayoutShift), [`PerformanceEventTiming`](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceEventTiming), [`PerformanceLongTaskTiming`](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceLongTaskTiming), [`PerformanceLongAnimationFrameTiming`](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceLongAnimationFrameTiming), [`Navigator.sendBeacon()`](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/sendBeacon) — and web.dev's Core Web Vitals documentation ([LCP](https://web.dev/articles/lcp), [INP](https://web.dev/articles/inp), [CLS](https://web.dev/articles/cls)). Documentation-validated; **no timings and no console output**.

Three metrics describe what a page feels like: **does it load** (LCP), **does it respond** (INP),
**does it hold still** (CLS). Each is an entry type on the timeline, and each has a rule about
*when the value is final* that is more important than the code to observe it.

## The thresholds

| Metric | Good | Poor | Measures |
|---|---|---|---|
| **LCP** — Largest Contentful Paint | ≤ **2.5 s** | > 4.0 s | when the main content appeared |
| **INP** — Interaction to Next Paint | ≤ **200 ms** | > 500 ms | how quickly the page responds |
| **CLS** — Cumulative Layout Shift | ≤ **0.1** | > 0.25 | how much content jumped |

🔴 **These are judged at the 75th percentile of real page views**, split by mobile and desktop —
not on your laptop, and not as an average. A metric that is fine on average and terrible at p75
is a metric that is terrible for a quarter of your users. **INP replaced FID** as the
responsiveness Core Web Vital in March 2024; code still reporting `first-input` alone is
measuring the old thing.

## LCP — the value is the *last* candidate

```js
let lcp;
new PerformanceObserver((list) => {
  const entries = list.getEntries();
  lcp = entries[entries.length - 1];      // 🔴 the latest candidate wins
}).observe({ type: 'largest-contentful-paint', buffered: true });
```

The browser emits a new entry whenever a bigger element paints, so the metric is **the last
entry you receive**, and it stops being updated at the first user interaction (a click or a key
press). Report it when the page is hidden, not on `load`.

The entry names the culprit — which is what makes it actionable:

| Field | Use |
|---|---|
| `element` | the actual DOM node; log a selector, not the node |
| `url` | for an image candidate, what to preload |
| `size` | intrinsic size the candidate was scored on |
| `renderTime` / `loadTime` | ⚠️ `renderTime` is 0 for a cross-origin image without `Timing-Allow-Origin` |

**Almost always the fix is not JavaScript.** LCP is usually a hero image discovered late, a font
that blocks text, or a server that answers slowly — `fetchpriority="high"`, a `preload`, and not
lazy-loading the above-the-fold image are the actual remedies.

## CLS — a score, in session windows

```js
let cls = 0, windowValue = 0, first = 0, last = 0;

new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.hadRecentInput) continue;                 // user-initiated: not counted
    if (windowValue && entry.startTime - last < 1000 && entry.startTime - first < 5000) {
      windowValue += entry.value; last = entry.startTime;
    } else {
      windowValue = entry.value; first = last = entry.startTime;
    }
    cls = Math.max(cls, windowValue);                   // the metric is the worst window
  }
}).observe({ type: 'layout-shift', buffered: true });
```

Three rules do all the work, and hand-rolling them wrong is the usual reason a dashboard
disagrees with real-user data:

- **Shifts within 500 ms of a user input are excluded** — `hadRecentInput`. Opening an accordion
  is not a layout bug.
- **Shifts group into session windows**: a gap of 1 second ends a window, and no window runs
  longer than 5 seconds.
- **CLS is the *largest* window, not the sum of everything.** A long page that shifts a little
  many times is not scored as one enormous shift.

`entry.sources` names the elements that moved, with their previous and current rectangles —
the single most useful field, and the one people forget to log.

## INP — every interaction, and the tail is the metric

INP is derived from `event` entries: the time from a user's input to the **next paint** that
reflects it. Not the handler's duration — the whole path, including the rendering the handler
caused.

```js
new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.interactionId) worst = Math.max(worst, entry.duration);
  }
}).observe({ type: 'event', buffered: true, durationThreshold: 40 });
```

⚠️ **`durationThreshold` defaults to 104 ms and cannot go below 16 ms.** Set it explicitly if you
want the smaller interactions; leave it high if you only care about the bad ones.

🔴 **The reported value is not the average — it is close to the worst.** For most pages INP is
the slowest interaction; on pages with a great many interactions a high percentile is used
instead, so one catastrophic click is not averaged into invisibility. Only events with an
`interactionId` count as interactions; scrolls and hovers do not.

**The three parts of an interaction, and where the time usually is:**

| Phase | What it is | Typical cause of slowness |
|---|---|---|
| Input delay | before the handler runs | the main thread is busy with something else |
| Processing | your handler | expensive work in an event handler |
| Presentation delay | handler end → next paint | a huge re-render, or layout thrashing |

**The last column is why "my handler is fast" does not mean the interaction is.** Yield to let
the browser paint before doing the heavy part — the topic is **14 · Yielding to the main thread**
*(not written yet)*.

## Long tasks, and the frame-level replacement

```js
new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) report('longtask', entry.duration);
}).observe({ type: 'longtask', buffered: true });
```

A `longtask` entry is any task over **50 ms** — long enough that an interaction arriving during
it is already late. The trouble is attribution: the entry tells you a long task happened and
almost nothing about whose code it was.

**`long-animation-frame` (LoAF) is the useful version**, where supported. It reports slow
*frames* and carries a `scripts` array naming each contributing script — its source URL and
character position, its duration, and how much of it was forced style and layout:

```js
if (PerformanceObserver.supportedEntryTypes.includes('long-animation-frame')) {
  new PerformanceObserver((list) => {
    for (const frame of list.getEntries()) {
      for (const s of frame.scripts) report({ src: s.sourceURL, ms: s.duration });
    }
  }).observe({ type: 'long-animation-frame', buffered: true });
}
```

`blockingDuration` on the frame is the part that would have delayed an interaction — the number
to correlate with INP.

## Reporting: the page is closing, and `fetch` will be cancelled

🔴 **`unload` is not reliable and using it disables the back/forward cache.** The documented
place to report is `visibilitychange` → `'hidden'`, which fires on tab switch, app switch and
close.

```js
function flush() {
  if (document.visibilityState !== 'hidden') return;
  po.takeRecords();                                   // drain anything pending
  navigator.sendBeacon('/vitals', JSON.stringify(metrics));
  metrics.length = 0;                                 // may be called more than once
}
document.addEventListener('visibilitychange', flush);
```

**`sendBeacon` survives the page going away** where a `fetch` is cancelled — the queued request
is handed to the browser to deliver. It is fire-and-forget: no response, no retry
(**Phase 11 · 20 · `sendBeacon` and keepalive** *(not written yet)*, and
[Phase 10 · 10 · 02 · Shutdown](../../phase-10-events/10-page-lifecycle/02-shutdown.md)).

⚠️ **Hidden is not gone.** A page can be restored from the back/forward cache and keep running,
so `flush` must be idempotent — and after a bfcache restore the metrics start again for what the
user experiences as a new page view.

## 🔴 Use the `web-vitals` library

Everything above is worth understanding and mostly **not worth maintaining**. The session-window
arithmetic, the INP percentile, the bfcache resets and the interaction-stops-LCP rule are all
edge cases that Google's `web-vitals` library already encodes, and it is the implementation the
Chrome User Experience Report is built to agree with.

```js
import { onLCP, onINP, onCLS } from 'web-vitals';
onCLS(send); onINP(send); onLCP(send);
```

**Write the observers yourself for what the library does not cover** — your own marks and
measures, long animation frames, route-transition timings. Hand-roll the Core Web Vitals only if
you enjoy discovering that your numbers do not match anybody else's.

## Gotchas

**Symptom: reported LCP is much smaller than the field data says.**
Cause — the first candidate was reported instead of the last, or it was read at `load`.
Fix — keep the latest entry and report on `visibilitychange`.

**Symptom: CLS is far higher than real-user data.**
Cause — every shift was summed, `hadRecentInput` was not skipped, or session windows were not
applied.
Fix — the windowing rules above, or the library.

**Symptom: `renderTime` is 0 for the LCP image.**
Cause — a cross-origin image without `Timing-Allow-Origin`.
Fix — add the header, or fall back to `loadTime`.

**Symptom: no `event` entries for ordinary clicks.**
Cause — `durationThreshold` defaults to 104 ms, so faster interactions are not reported.
Fix — set `durationThreshold` explicitly (16 ms is the floor).

**Symptom: metrics never arrive from mobile users.**
Cause — reporting on `unload`, or with `fetch`, when the page is being backgrounded.
Fix — `visibilitychange` → hidden, and `sendBeacon`.

**Symptom: long-task entries exist but nobody can tell which code caused them.**
Cause — `longtask` attribution is deliberately vague.
Fix — `long-animation-frame` where supported; its `scripts` array names source URLs.

**Symptom: the numbers look fine but users complain.**
Cause — averages. A good mean hides a bad p75.
Fix — report distributions, and treat the 75th percentile as the number.

## Interview questions

**★ What are the three Core Web Vitals and what does each measure?**
LCP — when the largest piece of content painted (loading), good at ≤ 2.5 s. INP — how long from
an interaction to the next paint (responsiveness), good at ≤ 200 ms, and it replaced FID in 2024.
CLS — the worst burst of unexpected layout shift (visual stability), good at ≤ 0.1. All judged at
the 75th percentile of real page views.

**★ Why is LCP the last entry rather than the first?**
The browser emits a candidate whenever something larger paints; only the final candidate is the
largest contentful paint. It stops updating at the first user interaction, so the value is
finalised then or when the page is hidden.

**★ Why is CLS not simply the sum of every layout shift?**
Because a long-lived page would accumulate an unbounded score. Shifts are grouped into session
windows — capped at 5 seconds and broken by a 1-second gap — and the metric is the largest
window. Shifts within 500 ms of a user input are excluded entirely.

**★ Your click handler runs in 5 ms but INP is 400 ms. How?**
INP spans input delay, processing and **presentation delay**. The main thread may have been busy
before the handler ran, or the re-render and layout the handler triggered took the rest. Measure
all three phases before optimising the handler.

**★ How do you send metrics reliably?**
On `visibilitychange` to `'hidden'`, with `navigator.sendBeacon`. `unload` is unreliable and
disables the back/forward cache, and a `fetch` in flight is cancelled when the page goes away.
Make the flush idempotent — the page may be restored from bfcache.

**★ Would you implement these observers yourself?**
For the Core Web Vitals, no — `web-vitals` encodes the windowing, percentile and bfcache rules
that make numbers comparable with CrUX. Hand-write observers for what it does not cover: your own
measures, LoAF attribution, route transitions.

---

← [02 · Marks and measures](./02-marks-and-measures.md) · [Topic index](./README.md)
