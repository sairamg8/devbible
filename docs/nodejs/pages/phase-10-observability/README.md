---
title: "Phase 10 — Observability and performance"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target runtime: Node 24 — the Active LTS as of August 2026.**
> Built-in APIs on these pages were executed on **Node 24.19.0**. Package-backed
> tools (`pino`, OpenTelemetry exporters, `prom-client`, `autocannon`, `clinic`/`0x`)
> keep open VERIFY markers until a version is pinned and remeasured.

**You cannot fix what you cannot see.** This phase is logs, traces, metrics, health,
and the performance workflow that turns a 3 a.m. page into a measured change.

## Logging and tracing

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **[Structured logging](./01-structured-logging.md)** | <span className="db-tier t-master">Master</span> | One JSON object per event — not a sentence you print |
| 02 | **[pino in practice](./02-pino-in-practice.md)** | <span className="db-tier t-understand">Understand</span> | Child loggers, redaction, serializers |
| 03 | **[Correlation IDs](./03-correlation-ids.md)** | <span className="db-tier t-master">Master</span> | Request ids through every line via AsyncLocalStorage |
| 04 | **[What to log](./04-what-to-log.md)** | <span className="db-tier t-master">Master</span> | What never to log: passwords, tokens, raw PII |
| 05 | **[OpenTelemetry](./05-opentelemetry.md)** | <span className="db-tier t-understand">Understand</span> | Vendor-neutral traces, spans, metrics |
| 06 | **[Error tracking](./06-error-tracking.md)** | <span className="db-tier t-understand">Understand</span> | Cluster exceptions; alert on rate of new issues |
| 07 | **[Diagnostics Channel](./07-diagnostics-channel.md)** | <span className="db-tier t-know">Know</span> | Built-in pub/sub for instrumentation |
| 08 | **[Trace events and reports](./08-trace-events-and-reports.md)** | <span className="db-tier t-when">When Needed</span> | Low-level traces and fatal diagnostic dumps |

## Metrics and health

| # | Page | Tier | In one line |
|---|---|---|---|
| 09 | **[Event loop lag](./09-event-loop-lag.md)** | <span className="db-tier t-master">Master</span> | Idle p50 is the resolution; max is the smoke alarm |
| 10 | **[Health checks](./10-health-checks.md)** | <span className="db-tier t-master">Master</span> | Liveness ≠ readiness — or you buy restart storms |
| 11 | **[Golden signals](./11-golden-signals.md)** | <span className="db-tier t-understand">Understand</span> | Latency, traffic, errors, saturation |
| 12 | **[perf_hooks](./12-perf-hooks.md)** | <span className="db-tier t-understand">Understand</span> | Monotonic clocks, marks, GC observer |
| 13 | **[Process metrics](./13-process-metrics.md)** | <span className="db-tier t-understand">Understand</span> | RSS vs heapUsed vs handles |
| 14 | **[Prometheus metrics](./14-prometheus-metrics.md)** | <span className="db-tier t-know">Know</span> | Pull `/metrics`, low-cardinality labels |

## Performance work

| # | Page | Tier | In one line |
|---|---|---|---|
| 15 | **[Finding the bottleneck](./15-finding-the-bottleneck.md)** | <span className="db-tier t-understand">Understand</span> | Measure the full resource, then change one thing |
| 16 | **[Caching strategy](./16-caching-strategy.md)** | <span className="db-tier t-master">Master</span> | TTL, invalidation, and stampede control |
| 17 | **[Memory leaks](./17-memory-leaks.md)** | <span className="db-tier t-understand">Understand</span> | Two snapshots and a retainer path |
| 18 | **[Common leak sources](./18-common-leak-sources.md)** | <span className="db-tier t-understand">Understand</span> | Caches, listeners, closures, timers |
| 19 | **[CPU and heap profiling](./19-cpu-heap-profiling.md)** | <span className="db-tier t-understand">Understand</span> | `--cpu-prof`, `--heap-prof`, Inspector |
| 20 | **[Benchmarking](./20-benchmarking.md)** | <span className="db-tier t-understand">Understand</span> | Load tests vs microbenchmarks that lie |
| 21 | **[GC basics](./21-gc-basics.md)** | <span className="db-tier t-know">Know</span> | Generations and `--max-old-space-size` |
| 22 | **[Flame graphs](./22-flame-graphs.md)** | <span className="db-tier t-know">Know</span> | Clinic / 0x when the call table is opaque |
| 23 | **[Startup time](./23-startup-time.md)** | <span className="db-tier t-when">When Needed</span> | Compile cache, lazy imports, time-to-ready |

## Where this connects

- **[Phase 0](../phase-0-runtime-model/README.md)** — one thread, blocking, the thread pool  
- **[Phase 2](../phase-2-async/README.md)** — AsyncLocalStorage for correlation  
- **[Phase 6](../phase-6-data-access/README.md)** — pool wait as saturation  
- **[Phase 7](../phase-7-background-work/README.md)** — queues, drain, timeout budgets  
- **Phase 11** (deployment, when written) — boot order, probes, containers  

