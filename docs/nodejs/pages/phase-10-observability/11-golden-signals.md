---
title: "The four golden signals — latency, traffic, errors, saturation"
sidebar_label: "11 · Golden signals"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0**. The signals are operational practice; the
> Node hooks below are what you actually instrument in this runtime.

**Latency, traffic, errors, and saturation are the four numbers that tell you whether
a service is healthy — everything else is either a breakdown of these or a distraction.**

They come from Google's SRE workbook. You do not need their entire stack. You need
these four on every customer-facing Node service before you invent custom dashboards.

## The four

| Signal | What it is | Node-shaped examples |
|---|---|---|
| **Latency** | How long successful *and* failed work takes | HTTP handler duration histograms; outbound `fetch` times |
| **Traffic** | Demand on the system | Requests/sec, jobs enqueued/sec, messages consumed/sec |
| **Errors** | Rate of failed work | 5xx rate, failed jobs, unhandled rejections count |
| **Saturation** | How full a constrained resource is | Event loop lag, pool wait, heap ratio, queue depth, CPU |

**Latency without separating success and failure lies.** A handler that fails in 2 ms
and succeeds in 200 ms will look "fast" if you average them. Histogram **by status
class** (2xx / 4xx / 5xx) or at least success vs error.

**Saturation is the leading indicator.** Traffic and latency go bad *after* the loop,
the pool, or the queue is full. Event loop lag (page 09),
pool checkout wait ([Phase 6](../phase-6-data-access/01-connection-pooling.md)), and
queue depth ([Phase 7](../phase-7-background-work/02-job-queues.md)) are saturation.

## Minimal instrumentation map

```js
// pseudo-code — one place that records all four for HTTP
function onRequestFinished({method, route, status, seconds, loopLagMs, poolWaiting}) {
  metrics.httpDuration.observe({method, route, status}, seconds);     // latency
  metrics.httpRequests.inc({method, route, status});                  // traffic + errors
  metrics.loopLag.set(loopLagMs);                                     // saturation
  metrics.poolWaiting.set(poolWaiting);                               // saturation
}
```

You do not need perfect cardinality on day one. **route** should be the template
(`/orders/:id`), never the raw URL, or Prometheus dies from unique label values.

## What "good" looks like for alerts

| Signal | Prefer alerting on |
|---|---|
| Latency | p99 (or p95) above SLO burn, not average |
| Traffic | Sudden drop *or* spike vs baseline (both can be incidents) |
| Errors | Error ratio (errors / traffic), not absolute count alone |
| Saturation | Thresholds with headroom (pool 80%, lag max, queue depth) |

Page 14 covers exporting these as Prometheus metrics. Page 06 covers error trackers —
those cluster *exceptions*; golden-signal errors are the **rate**, including expected
4xx if they are part of your SLO.

## Where this stops

Golden signals do not replace:

- **Traces** for multi-service latency ([page 05](./05-opentelemetry.md))  
- **Logs** for "what happened on this order" ([page 01](./01-structured-logging.md))  
- **Business metrics** (checkout conversion) — useful, but not substitute health  

## Gotchas

**Symptom:** Dashboard green while users complain
**Cause:** Average latency and no saturation metrics
**Fix:** Percentiles + loop lag / pool wait / queue depth

**Symptom:** Prometheus cardinality explosion
**Cause:** High-cardinality labels (`userId`, full path, raw exception message)
**Fix:** Low-cardinality labels only; put ids in logs and traces

**Symptom:** Error rate alert fires on a deploy that added input validation
**Cause:** Counting all 4xx as errors in the SLO
**Fix:** Define error classes deliberately; often only 5xx + selected 4xx

**Symptom:** Traffic looks fine, latency terrible
**Cause:** Saturation (loop, DB, downstream) ignored
**Fix:** Put saturation on the same board as latency

## Interview questions

**★ Name the four golden signals and one Node metric for each.**
Latency: request duration histogram. Traffic: QPS. Errors: 5xx ratio. Saturation:
event loop lag or pool wait time.

**★ Why is average latency a bad primary alert?**
Averages hide the long tail. One slow percentile class can ruin UX while the mean
looks healthy.

**What is saturation for a Node API process?**
How close you are to a limit: event loop delay, thread pool, connection pool,
memory, or downstream concurrency — not just "CPU 100%".

**How do golden signals relate to SLOs?**
SLOs are usually stated in latency and availability (inverse of errors) over traffic.
Saturation explains *why* you are about to miss them.

**Do you put `userId` on a Prometheus metric?**
No. That is unbounded cardinality. Logs and traces carry identity; metrics carry
aggregates.

---

← Prev: Health checks · Next → perf_hooks
