---
title: "Exposing metrics for Prometheus"
sidebar_label: "14 · Prometheus metrics"
sidebar_position: 14
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 on **Node 24.19.0**. Exposition shape is the Prometheus text
> format; wire a registry library when you adopt one.

{/* VERIFY: pin prom-client (or equivalent) version and show /metrics scrape body */}

**Prometheus pulls numbered facts from an HTTP endpoint on a schedule. Your job is to
expose low-cardinality time series that map to the golden signals — not to log every
event as a metric.**

## Pull, not push (usually)

Prometheus **scrapes** `GET /metrics` on each pod. You do not open a connection to
Prometheus per request. Pushgateway exists for short-lived jobs; API servers almost
always use pull.

```js
// pseudo-code — registry from your metrics library
import http from 'node:http';

const server = http.createServer(async (req, res) => {
  if (req.url === '/metrics') {
    res.setHeader('content-type', 'text/plain; version=0.0.4; charset=utf-8');
    res.end(await registry.metrics());
    return;
  }
  res.writeHead(404).end();
});
```

Keep `/metrics` off the public internet — internal listener, NetworkPolicy, or
sidecar scrape only.

## Metric types you will actually use

| Type | Use for |
|---|---|
| **Counter** | Requests total, errors total — only goes up |
| **Gauge** | Lag ms, heap used, pool waiting, queue depth |
| **Histogram** | Latency and payload sizes — enables p50/p95/p99 |
| **Summary** | Client-side quantiles (less common than histograms in modern setups) |

```js
// pseudo-code
httpRequestsTotal.inc({method: 'GET', route: '/orders/:id', status: '200'});
httpDuration.observe({route: '/orders/:id'}, 0.023);
loopLagMax.set(lag.max / 1e6);
heapUsed.set(process.memoryUsage().heapUsed);
```

## Label rules that save the cluster

**Do** label by: method, route **template**, status class, instance, version.  
**Do not** label by: `userId`, `orderId`, full URL, exception message, email.

One unique `orderId` per request × days of retention = Prometheus out of memory.
Identity belongs in **logs and traces**, not metric labels
([page 11](./11-golden-signals.md)).

## Default Node process metrics

Most registries ship process collectors: heap, RSS, event loop lag, active handles,
GC. Turn them on once at boot; do not reimplement badly.

Map to golden signals:

| Signal | Series |
|---|---|
| Latency | `http_request_duration_seconds` histogram |
| Traffic | `http_requests_total` |
| Errors | same counter filtered by `status=~"5.."` |
| Saturation | loop lag, pool wait, heap ratio, queue depth |

## Gotchas

**Symptom:** Prometheus OOMs or scrape takes seconds
**Cause:** High-cardinality labels or unbounded histogram buckets
**Fix:** Delete bad labels; use bounded buckets appropriate to your SLOs

**Symptom:** Rate() is empty after deploy
**Cause:** Counter reset without recording; or label set changed so series are "new"
**Fix:** Accept resets; use `rate()`/`increase()` which handle restarts; keep labels stable

**Symptom:** `/metrics` blocks the event loop under scrape
**Cause:** Expensive computation or huge registry serialization on the main thread
**Fix:** Cheap gauges; avoid per-scrape full heap walks beyond what the library does

**Symptom:** Double-counting with multiple registry instances
**Cause:** Module loaded twice or metrics registered in middleware *and* framework plugin
**Fix:** One registry singleton per process

**Symptom:** Public clients can scrape internal metrics
**Cause:** Metrics bound on the same port as the API without auth
**Fix:** Separate port or mesh-only scrape path

## Interview questions

**★ Why does Prometheus scrape instead of your app pushing every request?**
Pull keeps service discovery, failure detection, and timestamps with the collector.
Short-lived jobs are the push exception.

**★ What is metric cardinality and why does `userId` as a label hurt?**
Each unique label combination is a separate time series. Unbounded ids create
unbounded series and kill storage and query performance.

**Counter vs gauge for request count?**
Counter — total requests only increase (resets on process restart are fine with rate).

**Histogram vs timing logs for latency SLOs?**
Histograms aggregate cheaply across instances. Logs answer one request. You want both.

**Where should `/metrics` be exposed?**
Internal only — not on the public API hostname without protection.

---

← Prev: [Process metrics](./13-process-metrics.md) · Next → [Finding the bottleneck](./15-finding-the-bottleneck.md)
