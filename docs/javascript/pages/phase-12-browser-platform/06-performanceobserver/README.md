---
title: "06 · PerformanceObserver and the metrics that matter"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`PerformanceObserver`](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceObserver), [Performance Timeline API](https://developer.mozilla.org/en-US/docs/Web/API/Performance_Timeline), [User Timing API](https://developer.mozilla.org/en-US/docs/Web/API/Performance_API/User_timing) — and web.dev's Core Web Vitals documentation. Documentation-validated; **no timings and no console output**.

The syllabus row is *LCP, INP, CLS, `performance.now`, marks and measures, and the long-task
entry*. They are one topic because they are one mechanism: the browser writes everything it did
onto a single timeline, and `PerformanceObserver` reads it as it grows.

🔴 **The point of this API is not profiling — DevTools does that better.** The point is
**measuring real users on real devices**, where the p75 lives. A profile tells you why one
session was slow; the observer tells you how many sessions are.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 01 | **[The timeline](./01-the-timeline.md)** | `performance.now()` and the monotonic clock; the entry shape and the types worth knowing; `observe({type, buffered})` versus `entryTypes`, and why `buffered` is load-bearing; `supportedEntryTypes`, `takeRecords`, `disconnect`; why polling loses entries; cross-origin zeros and `Timing-Allow-Origin` |
| 02 | **[Marks and measures](./02-marks-and-measures.md)** | `mark()`/`measure()` and the options form; `detail` as the thing that makes a number actionable; why `measure()` can throw in production; reading them back with an observer; clearing them; what is worth instrumenting, and `Server-Timing` |
| 03 | **[The metrics that matter](./03-the-metrics.md)** | The LCP / INP / CLS thresholds and the p75 rule; LCP as the *last* candidate; CLS session windows and `hadRecentInput`; INP's three phases and `durationThreshold`; `longtask` versus `long-animation-frame` attribution; reporting with `sendBeacon` on `visibilitychange`; when to use `web-vitals` instead |

## Three facts worth carrying out of this topic

- **`buffered: true` or you miss the early entries.** Analytics loads after first paint; without
  it, an observer starts from an empty future — and it only works with the `type` form.
- **Every metric has a "when is it final" rule.** LCP is the last candidate before an
  interaction; CLS is the largest session window, not a sum; INP is the tail, not an average.
- **Report on `visibilitychange` with `sendBeacon`.** `unload` is unreliable and disables the
  back/forward cache, and an in-flight `fetch` is cancelled when the page goes away.

## Phase gate

You can move a 500 ms computation into a Web Worker, keep the page responsive, and prove it
in the performance panel.

## Where this connects

- [01 · DevTools beyond `console.log`](../01-devtools/02-the-panels.md) — the panel that draws
  the same events, and where your marks and measures appear
- [03 · Timers and frames](../03-timers-and-frames/README.md) — the same clock, and the frame
  budget these metrics are measured against
- [Phase 9 · 12 · Layout thrashing](../../phase-9-dom/12-layout-thrashing/01-the-forced-reflow.md)
  — the usual source of presentation delay inside an interaction
- [Phase 10 · 10 · 02 · Shutdown](../../phase-10-events/10-page-lifecycle/02-shutdown.md) — the
  lifecycle events a reporter must hook, and the bfcache
- **14 · Yielding to the main thread** *(not written yet)* — the fix for a long task once you
  have found it

---

Start → [01 · The timeline](./01-the-timeline.md)
