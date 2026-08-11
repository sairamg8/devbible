---
title: "OpenTelemetry — traces, spans, and metrics as a vendor-neutral standard"
sidebar_label: "05 · OpenTelemetry"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS).

**OpenTelemetry is how you instrument once and export to many backends — traces, metrics, and logs with one vocabulary.**

Vendor SDKs lock you in. OTel is the portable layer: your code creates spans; the
collector decides whether that becomes Jaeger, Tempo, Honeycomb, or something else.

## The three signals

| Signal | Answers | Unit of work |
|---|---|---|
| **Traces** | Where did this request spend time across services? | Span tree with one trace id |
| **Metrics** | How is the system behaving in aggregate? | Counters, histograms, gauges |
| **Logs** | What exact events happened? | Still your logger; correlate via trace id |

[Page 01](./01-structured-logging.md) stays. OTel does not replace structured logs.

## Spans are the core idea

A **span** is one unit of work with a start, an end, attributes, and optional status.
A **trace** is a tree of spans sharing a trace id.

```js
// Setup is separate; this is the API shape
import {trace, SpanStatusCode} from '@opentelemetry/api';

const tracer = trace.getTracer('orders-api');

async function checkout(orderId) {
  return tracer.startActiveSpan('checkout', async (span) => {
    span.setAttribute('order.id', orderId);
    try {
      await reserveInventory(orderId);
      await charge(orderId);
      span.setStatus({code: SpanStatusCode.OK});
    } catch (err) {
      span.recordException(err);
      span.setStatus({code: SpanStatusCode.ERROR, message: err.message});
      throw err;
    } finally {
      span.end();
    }
  });
}
```

Auto-instrumentation for HTTP, `fetch`, and DB drivers covers the boring edges.
**Manual spans belong on business operations** — `checkout`, `refund`, `reindex`.

## Context propagation

The join key across processes is **W3C Trace Context** (`traceparent` / `tracestate`).
That is the standardized cousin of [page 03](./03-correlation-ids.md).

## Sampling is not optional

Full traces for 100% of traffic at scale is how you melt a backend and a budget.

| Strategy | Use when |
|---|---|
| Head-based ratio (e.g. 5%) | Steady baseline cost control |
| Always sample errors / slow requests | You care about failures more than happy path |
| Tail sampling (collector) | Decide after you know duration/status |

## What OTel does not fix

- **Bad names and missing attributes** — `span1` helps nobody.
- **Synchronous heavy work in instrumentation** — keep attributes small.
- **No SLOs** — you still need golden signals (page 11).
- **Security of attribute values** — do not put tokens or PII on spans
  ([page 04](./04-what-to-log.md)).

## Minimal adoption path

1. Deploy a **collector** (or vendor OTLP endpoint) outside the app.
2. Enable **auto-instrumentation** for HTTP and your DB driver.
3. Add **manual spans** for two or three critical business paths.
4. Inject **trace id into logs**.
5. Turn on **sampling** before production traffic hits full volume.

## Gotchas

**Symptom:** Every service has its own trace ids; nothing joins
**Cause:** Propagation headers stripped by a proxy or not injected on egress
**Fix:** Allow `traceparent` through the mesh; verify client instrumentation

**Symptom:** Trace backend bill explodes after enabling OTel
**Cause:** 100% sampling with high-cardinality attributes
**Fix:** Sample; drop user ids from span names

**Symptom:** Spans show HTTP 200 while the business operation failed
**Cause:** Never setting span status on caught domain errors
**Fix:** `recordException` + error status on failures you handle

**Symptom:** Auto-instrumentation doubled latency
**Cause:** Exporting spans synchronously or chatty batch settings
**Fix:** Async batch exporter; tune batch size; sample

**Symptom:** Local dev requires five containers before hello world responds
**Cause:** Treating collector + backend as mandatory for unit work
**Fix:** No-op tracer in test; optional exporter when endpoint is set

**Symptom:** Span attributes contain authorization headers
**Cause:** Capturing raw HTTP headers into attributes
**Fix:** Allowlist attributes; never mirror full header maps

## Interview questions

**★ What problem does OpenTelemetry solve that a single-vendor APM agent does not?**
Portable instrumentation. You write against a standard API and change backends without
rewriting application code.

**★ What is the difference between a trace and a span?**
A span is one operation with timing and attributes. A trace is the tree of spans for
one request sharing a trace id.

**Why sample traces?**
Because full retention does not scale in cost or signal. Keep a representative subset
plus preferential sampling for errors and slow requests.

**How do OTel traces connect to your existing JSON logs?**
Put `trace_id` / `span_id` on each log line from the active context.

**Is OpenTelemetry a replacement for pino?**
No. Logs, metrics, and traces answer different questions.

---

← Prev: [What to log](./04-what-to-log.md) · Next → [Error tracking](./06-error-tracking.md)
