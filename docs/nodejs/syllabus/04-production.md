---
title: "Part 4 — Production"
sidebar_label: "4 · Production"
sidebar_position: 4
---

> Phases 10–12 · Observability, deployment, native and advanced

The difference between "it works on my machine" and "it works at 3 a.m. while
you're asleep".

---

## Phase 10 — Observability and performance

You cannot fix what you cannot see. This phase is what makes production
survivable.

### Logging and tracing

| Topic | Tier |
|---|---|
| **Structured logging** — JSON logs, levels, and why `console.log` doesn't scale | <span className="db-tier t-master">Master</span> |
| `pino` in practice: child loggers, redaction of secrets, serializers | <span className="db-tier t-understand">Understand</span> |
| **Correlation / request IDs** threaded through every log line via `AsyncLocalStorage` | <span className="db-tier t-master">Master</span> |
| What to log and what never to log (passwords, tokens, PII) | <span className="db-tier t-master">Master</span> |
| **OpenTelemetry**: traces, spans, metrics — the vendor-neutral standard | <span className="db-tier t-understand">Understand</span> |
| Error tracking and alerting (Sentry or equivalent) | <span className="db-tier t-understand">Understand</span> |
| **Diagnostics Channel** — the built-in pub/sub for instrumentation | <span className="db-tier t-know">Know</span> |
| `node:trace_events`, diagnostic reports (`--report-on-fatalerror`) | <span className="db-tier t-when">When Needed</span> |

### Metrics and health

| Topic | Tier |
|---|---|
| **Event loop lag** — your single most important health metric (`monitorEventLoopDelay`) | <span className="db-tier t-master">Master</span> |
| **Health checks**: liveness vs. readiness, and why conflating them causes restart loops | <span className="db-tier t-master">Master</span> |
| The four golden signals: latency, traffic, errors, saturation | <span className="db-tier t-understand">Understand</span> |
| `perf_hooks`: `performance.now()`, marks and measures, `PerformanceObserver` | <span className="db-tier t-understand">Understand</span> |
| Process metrics: RSS, heap used vs. heap total, handles | <span className="db-tier t-understand">Understand</span> |
| Exposing metrics for Prometheus | <span className="db-tier t-know">Know</span> |

### Performance work

| Topic | Tier |
|---|---|
| **Finding the bottleneck before optimizing** — measure, don't guess | <span className="db-tier t-understand">Understand</span> |
| **Caching strategy**: what to cache, TTLs, invalidation, cache stampedes | <span className="db-tier t-master">Master</span> |
| **Memory leaks**: symptoms, heap snapshots, comparing snapshots to find the retainer | <span className="db-tier t-understand">Understand</span> |
| Common leak sources: unbounded caches, unremoved listeners, closures over big objects, un-cleared timers | <span className="db-tier t-understand">Understand</span> |
| `--cpu-prof`, `--heap-prof`, the Inspector protocol, Chrome DevTools | <span className="db-tier t-understand">Understand</span> |
| **Benchmarking** with `autocannon` / `mitata` — and why microbenchmarks lie | <span className="db-tier t-understand">Understand</span> |
| GC basics: generational collection, `--max-old-space-size` | <span className="db-tier t-know">Know</span> |
| Flame graphs, `clinic.js`, `0x` | <span className="db-tier t-know">Know</span> |
| Startup time: `enableCompileCache()`, V8 snapshots, lazy requires | <span className="db-tier t-when">When Needed</span> |

---

## Phase 11 — Deployment and operations

| Topic | Tier |
|---|---|
| **12-factor config**: environment-driven, validated at boot, fail fast on missing vars | <span className="db-tier t-master">Master</span> |
| **Boot sequence**: validate env → connect dependencies → start listening → report ready. In that order, or you accept traffic before the pool exists | <span className="db-tier t-understand">Understand</span> |
| **Dockerizing Node properly**: multi-stage builds, non-root user, `.dockerignore`, layer caching for `node_modules` | <span className="db-tier t-master">Master</span> |
| **PID 1 and signal handling** in containers — why `npm start` swallows `SIGTERM` | <span className="db-tier t-master">Master</span> |
| Environment parity: dev / staging / prod, and keeping them honest | <span className="db-tier t-understand">Understand</span> |
| **Behind a reverse proxy**: `X-Forwarded-*`, `trust proxy`, TLS termination | <span className="db-tier t-understand">Understand</span> |
| **Zero-downtime deploys**: rolling restarts, connection draining, readiness gating | <span className="db-tier t-understand">Understand</span> |
| CI/CD: test matrix across Node versions, dependency caching, build artifacts | <span className="db-tier t-understand">Understand</span> |
| Image size and hardening: distroless vs. alpine vs. slim, and the glibc/musl trade-off | <span className="db-tier t-understand">Understand</span> |
| Process managers: `pm2`, `systemd`, or letting the orchestrator own it | <span className="db-tier t-know">Know</span> |
| Scaling: vertical vs. horizontal, when `cluster` beats more replicas | <span className="db-tier t-know">Know</span> |
| Semantic release and versioning strategy | <span className="db-tier t-know">Know</span> |
| Blue/green and canary deploys | <span className="db-tier t-when">When Needed</span> |
| Serverless Node: cold starts, connection reuse, the pooling problem | <span className="db-tier t-when">When Needed</span> |

---

## Phase 12 — Native and advanced

Optional. Reach for it when you need it — but knowing it exists changes which
problems you consider solvable.

| Topic | Tier |
|---|---|
| `node:vm` — and why it is **not** a security sandbox | <span className="db-tier t-know">Know</span> |
| **WebAssembly** in Node — when it's the right answer for CPU-bound work | <span className="db-tier t-know">Know</span> |
| V8 flags and what they actually control | <span className="db-tier t-know">Know</span> |
| **Node-API (N-API)** and `node-addon-api` — stable-ABI native addons | <span className="db-tier t-when">When Needed</span> |
| C++ addons and the embedder API | <span className="db-tier t-when">When Needed</span> |
| **FFI** — calling native libraries without writing an addon | <span className="db-tier t-when">When Needed</span> |
| **WASI** | <span className="db-tier t-when">When Needed</span> |
| Custom module loaders and resolution hooks | <span className="db-tier t-when">When Needed</span> |
| Startup snapshots | <span className="db-tier t-when">When Needed</span> |
| Contributing to Node core | <span className="db-tier t-when">When Needed</span> |

---

## Where this connects

| From | To |
|---|---|
| Phase 5 (HTTP) | **Express** — a thin layer over `node:http`. Do not start it before Phase 5 |
| Phase 6 (Data access) | **MongoDB** · **PostgreSQL** |
| Phase 7 (Job queues) | **Redis** — the queue mechanics themselves |
| Phase 10 (Caching) | **Redis** |
| Phase 11 (Containers, proxy) | **Docker & Podman** · **Nginx** |

### Deliberately not here

Nobody builds an API on raw `node:http`, so **API design belongs to Express**, not
to Node. This syllabus teaches `node:http` for one reason: so that Express is not
magic and you can debug it when it misbehaves.

Express picks up: REST resource modeling · middleware architecture · request
lifecycle · controller/service/repository wiring · status code design · response
and error-body contracts · pagination · filtering, sorting, searching · API
versioning · idempotency keys · ETags and conditional requests · `Cache-Control` ·
multipart uploads · OpenAPI · webhook delivery and verification · route-level
authorization (RBAC, ownership checks).

Architecture-level resilience — circuit breakers, bulkheads, load shedding,
delivery guarantees — is learned against a real project rather than from a topic
list. Phase 7 covers the parts you implement in plain Node.

---

← Prev: [Part 3 — Application layer](03-application.md) · Index: [Node.js](../README.md)
