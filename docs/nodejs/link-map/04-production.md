---
title: "Link map · Node.js · Part 4 Production (phases 10–12)"
sidebar_label: "04 · Production"
sidebar_position: 5
---

# Link map · Node.js · Part 4 Production (phases 10–12)

Covers every topic row of `docs/nodejs/syllabus/04-production.md`: T10-01 to T10-23 (phase 10, observability and performance, numbered straight through its three sub-tables), T11-01 to T11-14 (phase 11, deployment) and T12-01 to T12-10 (phase 12, native and advanced). **All 47 rows have a page of ours** under `docs/nodejs/pages/phase-10-observability`, `phase-11-deployment` and `phase-12-native`.
*read* = I read the passage; *headings only* = fetched, headings and size checked. `#anchors` appear only where the id exists in the fetched HTML (none used here).

🔴 **Version note.** Node API docs are linked at `/docs/latest/`, which on 2026-10-12 is **v26.11.1**. Pages under nodejs.org/learn carry no date, so only the fetch date is given; third-party links carry theirs, or "undated" where the page shows none. `github.com` returns 403 to our fetcher, so repo docs (pino, prom-client, docker-node, node-addon-api, Node core CONTRIBUTING) are read from their jsDelivr copies; those links are copies of the repo files, not the repo pages. `0x` and `mitata` have no readable README (github 403, jsDelivr 404), so neither is a Read-this.

🔴 **Where the fetched docs matter for our pages.** `node:ffi` **exists in v26** (added v26.1.0, Stability 1 Experimental), so T12-06 is a real built-in now, not only a third-party library. `--build-snapshot` is **no longer experimental** (v25.4.0, v24.13.1). `diagnostics_channel.tracingChannel()` is **Stable since v26.8.0**. `--cpu-prof` and `--heap-prof` are **stable since v22.4.0 / v20.16.0**.

---

## Phase 10 — Observability and performance

### T10-01 · Structured logging — JSON, levels, why `console.log` doesn't scale — Master · ✅ written `docs/nodejs/pages/phase-10-observability/01-structured-logging.md`
- **Read this:** [Structured logging in production](https://docs.railway.com/guides/structured-logging-production) · docs.railway.com · undated; defines it as one single-line JSON object per log line, with the `level` field, a message and filterable attributes, using Pino for Node (*read*) · covers our angle: **partial** — vendor guide aimed at Railway's log viewer; "why `console.log` doesn't scale" is not argued · fetched 2026-10-12
- **Also good:** [XI. Logs](https://12factor.net/logs) · 12factor.net · undated; a process writes its event stream unbuffered to stdout and the environment collects it (*read*) · fetched 2026-10-12
- *Not opened:* openobserve.ai structured-logging field guide (search hit only).
- **Our delta:** the `console.log` scaling argument (sync stdout, no levels, no parseable fields) is ours.

### T10-02 · `pino` in practice — child loggers, redaction, serializers — Understand · ✅ written `docs/nodejs/pages/phase-10-observability/02-pino-in-practice.md`
- **Read this:** [pino docs/redaction.md](https://cdn.jsdelivr.net/gh/pinojs/pino@main/docs/redaction.md) · jsDelivr copy of pinojs/pino · `redact.paths` with a custom `censor`; paths use `a.b.c`, `a[*].b` and `*` wildcards and are case sensitive; non-wildcard paths add about 2% to `JSON.stringify` while wildcards cost more (*read*) · covers our angle: **partial** — redaction only · fetched 2026-10-12
- **Also good:** [pino docs/child-loggers.md](https://cdn.jsdelivr.net/gh/pinojs/pino@main/docs/child-loggers.md) · jsDelivr copy · a child logger pins `"module":"foo"` onto every line from one module (*read*) · [pino docs/api.md](https://cdn.jsdelivr.net/gh/pinojs/pino@main/docs/api.md) · jsDelivr copy · `logger.child(bindings, [options])` pins key-value pairs to every line and shares the parent's output stream (*read*; ≈7.2k words, look up only) · fetched 2026-10-12
- **Our delta:** whether redact paths carry into children, and the serializers section, are **not confirmed** from what I read; check api.md on the pinned pino.

### T10-03 · Correlation / request IDs via `AsyncLocalStorage` — Master · ✅ written `docs/nodejs/pages/phase-10-observability/03-correlation-ids.md`
- **Read this:** [Keep Express Correlation IDs with AsyncLocalStorage](https://oneuptime.com/blog/post/2026-09-11-express-async-local-storage-correlation/view) · oneuptime.com · Sep 11, 2026; middleware makes a UUID, sets an `X-Correlation-ID` header and wraps `next` in `run(store, next)`; the log function reads `getStore()` (*read*) · covers our angle: **partial** — Express-flavoured, uses `console.log` not a pino mixin · fetched 2026-10-12
- **Also good:** [Asynchronous context tracking](https://nodejs.org/docs/latest/api/async_context.html) · nodejs.org · v26.11.1; headings list `run`, `getStore`, `enterWith`, `exit`, `withScope` and a "Context loss" troubleshooting section (*headings only*, the page is the reference for the API) · fetched 2026-10-12
- **Our delta:** wiring the store into the logger (pino mixin or child), and the `enterWith` leak risk, are ours.

### T10-04 · What to log and what never to log — Master · ✅ written `docs/nodejs/pages/phase-10-observability/04-what-to-log.md`
- **Read this:** [Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html) · OWASP · undated; its "Data to exclude" list names access tokens, authentication passwords, database connection strings, encryption keys, and session ids (consider hashing) and sensitive PII (*read*); also has "Which events to log" and "Event attributes" sections (*headings only*) · covers our angle: full · fetched 2026-10-12

### T10-05 · OpenTelemetry — traces, spans, metrics — Understand · ✅ written `docs/nodejs/pages/phase-10-observability/05-opentelemetry.md`
- **Read this:** [Getting Started by Example (Node.js)](https://opentelemetry.io/docs/languages/js/getting-started/nodejs/) · opentelemetry.io · needs Node 20+; `NodeSDK` with `getNodeAutoInstrumentations()` creates a span per Express request and must be set up before application code (*read*) · covers our angle: **partial** — traces and metrics in practice; the vendor-neutral argument is not made · fetched 2026-10-12
- **Also good:** [Traces](https://opentelemetry.io/docs/concepts/signals/traces/) · [Metrics](https://opentelemetry.io/docs/concepts/signals/metrics/) · opentelemetry.io · the concept pages, ≈3.4k and ≈2.8k words (*headings only*; the metrics page covers aggregation of measurements) · fetched 2026-10-12

### T10-06 · Error tracking and alerting (Sentry or equivalent) — Understand · ✅ written `docs/nodejs/pages/phase-10-observability/06-error-tracking.md`
- **Read this:** [Sentry for Node.js](https://docs.sentry.io/platforms/javascript/guides/node/) · docs.sentry.io · undated; lists error monitoring, tracing, profiling and logs as features of the Node SDK (*read* the overview only) · covers our angle: **partial** — one vendor; "or equivalent" and alert-rule design are not covered; pricing not confirmed · fetched 2026-10-12
- **Our delta:** alerting on symptoms not causes, and what to send (no PII), are ours.

### T10-07 · Diagnostics Channel — Know · ✅ written `docs/nodejs/pages/phase-10-observability/07-diagnostics-channel.md`
- **Read this:** [Diagnostics Channel](https://nodejs.org/docs/latest/api/diagnostics_channel.html) · nodejs.org · v26.11.1; the module is Stable (since v19.2.0 / v18.13.0), named channels carry arbitrary messages; `tracingChannel()` is marked Stable from v26.8.0; `boundedChannel()` is listed (*read*) · covers our angle: full · fetched 2026-10-12

### T10-08 · `node:trace_events`, diagnostic reports — When Needed · ✅ written `docs/nodejs/pages/phase-10-observability/08-trace-events-and-reports.md`
- **Read this (1/2):** [Diagnostic report](https://nodejs.org/docs/latest/api/report.html) · nodejs.org · v26.11.1; `--report-on-fatalerror` writes a report when the runtime dies on a fatal error such as out of memory; also `--report-uncaught-exception` and `--report-on-signal` (*read*) · covers our angle: full for reports · fetched 2026-10-12
- **Read this (2/2):** [Trace events](https://nodejs.org/docs/latest/api/tracing.html) · nodejs.org · v26.11.1; enabled by `--trace-event-categories` or the `node:trace_events` module, with categories such as `node.async_hooks` (*read*) · covers the trace_events angle: full · fetched 2026-10-12

### T10-09 · Event loop lag (`monitorEventLoopDelay`) — Master · ✅ written `docs/nodejs/pages/phase-10-observability/09-event-loop-lag.md`
- **Read this:** [perf_hooks.monitorEventLoopDelay](https://nodejs.org/docs/latest/api/perf_hooks.html) · nodejs.org · v26.11.1; returns an `ELDHistogram` (a Histogram that records event loop delay) with `enable()` and `disable()`; the page also lists `eventLoopUtilization()` (*read*) · covers our angle: **partial** — the API, not "your single most important health metric" · fetched 2026-10-12
- **Also good:** [Don't Block the Event Loop](https://nodejs.org/learn/asynchronous-work/dont-block-the-event-loop) · nodejs.org/learn · ≈6.1k words; the model of one event loop plus a worker pool, and why blocking either hurts every client (*read* the opening) · fetched 2026-10-12

### T10-10 · Health checks — liveness vs readiness — Master · ✅ written `docs/nodejs/pages/phase-10-observability/10-health-checks.md`
- **Read this:** [Health Endpoint Monitoring pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/health-endpoint-monitoring) · learn.microsoft.com · undated; shallow checks for liveness so a dependency outage doesn't cause needless restarts, deep checks of dependencies for readiness (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Configure Liveness, Readiness and Startup Probes](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/) · kubernetes.io · the mechanics: the kubelet restarts on failed liveness and marks the Pod ready when readiness succeeds (*read*) · fetched 2026-10-12

### T10-11 · The four golden signals — Understand · ✅ written `docs/nodejs/pages/phase-10-observability/11-golden-signals.md`
- **Read this:** [Monitoring Distributed Systems](https://sre.google/sre-book/monitoring-distributed-systems/) · sre.google (SRE book) · defines latency, traffic, errors and saturation, and says to focus on these four if you can measure only four (*read*) · covers our angle: full · fetched 2026-10-12

### T10-12 · `perf_hooks` — `performance.now()`, marks, measures, `PerformanceObserver` — Understand · ✅ written `docs/nodejs/pages/phase-10-observability/12-perf-hooks.md`
- **Read this:** [Performance measurement APIs](https://nodejs.org/docs/latest/api/perf_hooks.html) · nodejs.org · v26.11.1; supports the Web High Resolution Time, Performance Timeline and User Timing APIs; opening example uses `PerformanceObserver` with `getEntries()` (*read*); `performance.mark`, `measure`, `now` appear in the headings · covers our angle: full · fetched 2026-10-12

### T10-13 · Process metrics — RSS, heap used vs total, handles — Understand · ✅ written `docs/nodejs/pages/phase-10-observability/13-process-metrics.md`
- **Read this:** [process.memoryUsage()](https://nodejs.org/docs/latest/api/process.html) · nodejs.org · v26.11.1; returns `rss`, `heapTotal`, `heapUsed`, `external`, `arrayBuffers` in bytes (*read*) · covers our angle: **partial** — handles: only `process.getActiveResourcesInfo()` appears in the headings · fetched 2026-10-12
- **Also good:** [Understanding and Tuning Memory](https://nodejs.org/learn/diagnostics/memory/understanding-and-tuning-memory) · nodejs.org/learn · ≈2.3k words; covers monitoring with `process.memoryUsage()` (*headings only*) · fetched 2026-10-12

### T10-14 · Exposing metrics for Prometheus — Know · ✅ written `docs/nodejs/pages/phase-10-observability/14-prometheus-metrics.md`
- **Read this:** [prom-client README](https://cdn.jsdelivr.net/npm/prom-client/README.md) · jsDelivr copy of the npm package readme · `collectDefaultMetrics()` adds process metrics plus Node ones such as event loop lag, active handles and GC; serve `await registry.metrics()` to scrapes; a cluster-mode section warns that a worker's registry shows only that worker (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Exposition formats](https://prometheus.io/docs/instrumenting/exposition_formats/) · prometheus.io · the text format is line oriented, one sample per line (*read*) · fetched 2026-10-12

### T10-15 · Finding the bottleneck before optimizing — Understand · ✅ written `docs/nodejs/pages/phase-10-observability/15-finding-the-bottleneck.md`
- **Read this:** [Profiling Node.js Applications](https://nodejs.org/learn/getting-started/profiling) · nodejs.org/learn · ≈2.5k words; a worked case: run with `--prof`, then process the tick file (`isolate-0x...-v8.log`) with the bundled tick processor (*read*) · covers our angle: **partial** — a profiler walkthrough, not the "measure, don't guess" method · fetched 2026-10-12
- **Also good:** [Poor Performance (Overview)](https://nodejs.org/learn/diagnostics/poor-performance) · nodejs.org/learn · ≈1k words (*headings only*) · fetched 2026-10-12
- **Our delta:** the method (baseline, hypothesis, one change, re-measure) is ours.

### T10-16 · Caching strategy — TTLs, invalidation, stampedes — Master · ✅ written `docs/nodejs/pages/phase-10-observability/16-caching-strategy.md`
- **Read this:** [Caching challenges and strategies](https://builder.aws.com/content/3K9TeXp6strMiJ4vhakpRD7BQWO/caching-challenges-and-strategies) · builder.aws.com (Amazon Builders' Library article; the aws.amazon.com link redirects here) · undated; when to consider caching, being deliberate and empirical about size, expiration and eviction policy, and alarming on cache metrics (*read*) · covers our angle: **partial** — the page has no jitter discussion (searched, none found); stampedes not treated in depth · fetched 2026-10-12
- **Also good:** [Cache stampede](https://en.wikipedia.org/wiki/Cache_stampede) · Wikipedia · undated; mitigation sections: locking, external recomputation, probabilistic early expiration (*headings only*) · fetched 2026-10-12
- **Our delta:** TTL jitter and in-process single-flight of in-flight promises are ours; no primary page was read for them.

### T10-17 · Memory leaks — symptoms, heap snapshots, finding the retainer — Understand · ✅ written `docs/nodejs/pages/phase-10-observability/17-memory-leaks.md`
- **Read this:** [Using Heap Snapshot](https://nodejs.org/learn/diagnostics/memory/using-heap-snapshot) · nodejs.org/learn · load a snapshot into Chrome DevTools to check retainer size and compare several snapshots; warns the main thread stops while it is taken and it can double heap use; routes: `--heapsnapshot-signal=SIGUSR2`, `writeHeapSnapshot` (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Using Heap Profiler](https://nodejs.org/learn/diagnostics/memory/using-heap-profiler) · nodejs.org/learn · allocation timeline and sampling heap profiler, for allocations over time (*read* the intro) · fetched 2026-10-12

### T10-18 · Common leak sources — caches, listeners, closures, timers — Understand · ✅ written `docs/nodejs/pages/phase-10-observability/18-common-leak-sources.md`
- **Read this:** [Memory management](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Memory_management) · MDN · undated; reachability is what keeps objects alive, circular references discussed, `WeakMap` and `WeakSet` as tools (*read*) · covers our angle: **partial** — none of the four named sources is catalogued; no single authoritative page found (searched: Node leak causes, blogs only, not opened)
- **Also good:** [Events: emitter.setMaxListeners](https://nodejs.org/docs/latest/api/events.html) · nodejs.org · v26.11.1; the default warning above 10 listeners "helps finding memory leaks" (*read*) · fetched 2026-10-12
- **Our delta:** the four-source catalogue and a fix per source are ours.

### T10-19 · `--cpu-prof`, `--heap-prof`, the Inspector protocol, Chrome DevTools — Understand · ✅ written `docs/nodejs/pages/phase-10-observability/19-cpu-heap-profiling.md`
- **Read this:** [Command-line API: --cpu-prof, --heap-prof](https://nodejs.org/docs/latest/api/cli.html) · nodejs.org · v26.11.1; both flag families are stable since v22.4.0 / v20.16.0; output is a `.cpuprofile` or `.heapprofile` file, with `-dir` and `-name` options (*read*) · covers our angle: **partial** — flags only; opening the file in DevTools is not shown · fetched 2026-10-12
- **Also good:** [Inspector](https://nodejs.org/docs/latest/api/inspector.html) · nodejs.org · v26.11.1; ≈3.2k words (*headings only*) · fetched 2026-10-12
- *Not opened:* Chrome DevTools performance and memory docs (both returned 200).

### T10-20 · Benchmarking — `autocannon` / `mitata`, and why microbenchmarks lie — Understand · ✅ written `docs/nodejs/pages/phase-10-observability/20-benchmarking.md`
- **Read this (1/2):** [autocannon README](https://cdn.jsdelivr.net/npm/autocannon/README.md) · jsDelivr copy · an HTTP/1.1 load tool; `-c` connections (default 10), `-p` pipelining (default 1), `-d` duration (default 10 s) (*read*) · covers our angle: full for autocannon · fetched 2026-10-12
- **Read this (2/2):** [microbenchmarks fairy tale](https://mrale.ph/blog/2012-12-15-microbenchmarks-fairy-tale.html) · mrale.ph (V8 engineer) · Dec 15, 2012; shows how loop-invariant code motion removes work from a timed loop (*read*) · covers the "lie" angle: full, but 2012 and V8 has changed since; use the idea, not the numbers · fetched 2026-10-12
- *Checked, not chosen:* mitata — github 403, jsDelivr README 404, npm registry JSON is not a readable doc.

### T10-21 · GC basics — generational collection, `--max-old-space-size` — Know · ✅ written `docs/nodejs/pages/phase-10-observability/21-gc-basics.md`
- **Read this:** [Understanding and Tuning Memory](https://nodejs.org/learn/diagnostics/memory/understanding-and-tuning-memory) · nodejs.org/learn · New Space for short-lived objects, survivors promoted to Old Space, and `--max-old-space-size` caps the Old Space (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Trash talk: the Orinoco garbage collector](https://v8.dev/blog/trash-talk) · v8.dev · Jan 3, 2019; how V8's GC went from stop-the-world to mostly parallel and concurrent (*read* the opening) · fetched 2026-10-12

### T10-22 · Flame graphs, `clinic.js`, `0x` — Know · ✅ written `docs/nodejs/pages/phase-10-observability/22-flame-graphs.md`
- **Read this:** [Flame Graphs](https://www.brendangregg.com/flamegraphs.html) · brendangregg.com · undated; the x-axis is the stack population sorted alphabetically (not time), the y-axis is stack depth, wider frames appeared in more samples (*read*) · covers our angle: **partial** — how to read one; no Node tooling · fetched 2026-10-12
- **Also good:** [Node.js Flame Graphs](https://nodejs.org/learn/diagnostics/flame-graphs) · nodejs.org/learn · Linux `perf record` with `--perf-basic-prof` and `--interpreted-frames-native-stack` (*read* one passage) · [clinic README](https://cdn.jsdelivr.net/npm/clinic/README.md) · jsDelivr copy · `clinic doctor`, then `clinic bubbleprof` for I/O issues; benchmark with autocannon or wrk (*read*) · fetched 2026-10-12
- *Checked, not chosen:* clinicjs.org/documentation (renders client-side, no text); `0x` — github 403, no readable README.

### T10-23 · Startup time — `enableCompileCache()`, V8 snapshots, lazy requires — When Needed · ✅ written `docs/nodejs/pages/phase-10-observability/23-startup-time.md`
- **Read this:** [node:module — Module compile cache](https://nodejs.org/docs/latest/api/module.html) · nodejs.org · v26.11.1; `module.enableCompileCache()` uses `NODE_COMPILE_CACHE` if set, else a dir under `os.tmpdir()`; sections on portable and read-only caches (*read*) · covers our angle: **partial** — lazy requires and snapshots are not on this page · fetched 2026-10-12
- **Also good:** [Command-line API: --build-snapshot](https://nodejs.org/docs/latest/api/cli.html) · nodejs.org · v26.11.1; building snapshots is no longer experimental (v25.4.0, v24.13.1), the blob loads with `--snapshot-blob` (*read*) · fetched 2026-10-12
- **Our delta:** lazy `require` is ours; no page found (searched compile cache plus lazy require; only compile-cache results).

---

## Phase 11 — Deployment and operations

### T11-01 · 12-factor config — env-driven, validated at boot, fail fast — Master · ✅ written `docs/nodejs/pages/phase-11-deployment/01-twelve-factor-config.md`
- **Read this:** [III. Config](https://12factor.net/config) · 12factor.net · undated; config is everything that varies between deploys and belongs in the environment; the litmus test is whether the codebase could be open-sourced without leaking credentials (*read*) · covers our angle: **partial** — "validated at boot, fail fast" is not on the page · fetched 2026-10-12
- **Also good:** [Node.js, the difference between development and production](https://nodejs.org/learn/getting-started/nodejs-the-difference-between-development-and-production) · nodejs.org/learn · opens by saying Node has no separate development and production modes, with a section on why `NODE_ENV` is an antipattern (*read* the opening) · fetched 2026-10-12
- **Our delta:** schema validation of `process.env` at startup is ours.

### T11-02 · Boot sequence — validate, connect, listen, ready — Understand · ✅ written `docs/nodejs/pages/phase-11-deployment/02-boot-sequence.md`
- **Read this:** none found — tried: web search "Node.js app startup order validate env connect database listen readiness" (blogs and tool pages only, none opened), 12factor.net, kubernetes.io.
- **Also good:** [Configure Liveness, Readiness and Startup Probes](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/) · kubernetes.io · a Pod is marked ready only once the readiness probe succeeds, which is why "listening" and "ready" can be separate steps (*read*) · fetched 2026-10-12
- **Our delta:** the four-step order and the pool-before-listen reasoning are ours.

### T11-03 · Dockerizing Node — multi-stage, non-root, `.dockerignore`, layer cache — Master · ✅ written `docs/nodejs/pages/phase-11-deployment/03-dockerizing-node.md`
- **Read this:** [docker-node: Best Practices](https://cdn.jsdelivr.net/gh/nodejs/docker-node@main/docs/BestPractices.md) · jsDelivr copy of the Node.js Docker team's doc · has a "Non-root User" section and a multi-stage example that copies built `node_modules` without the toolchain (*read*) · covers our angle: **partial** — `.dockerignore` and the `package.json`-first layer ordering are not confirmed on this page · fetched 2026-10-12
- **Also good:** [Multi-stage builds](https://docs.docker.com/build/building/multi-stage/) · docs.docker.com · `COPY --from` brings only the final artifact into the last stage (*read*) · [Docker build cache](https://docs.docker.com/build/cache/) · docs.docker.com · every instruction is a layer and a changed layer rebuilds (*read* one passage) · fetched 2026-10-12

### T11-04 · PID 1 and signals — why `npm start` swallows `SIGTERM` — Master · ✅ written `docs/nodejs/pages/phase-11-deployment/04-pid1-and-signals.md`
- **Read this:** [docker-node: Best Practices](https://cdn.jsdelivr.net/gh/nodejs/docker-node@main/docs/BestPractices.md) · jsDelivr copy · a Node process as PID 1 will not respond to `SIGINT` and similar signals; `docker run --init` adds a tini init; use `CMD ["node","index.js"]` so `SIGTERM` reaches Node instead of npm swallowing it (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Building good containers](https://cdn.jsdelivr.net/gh/nodeshift/nodejs-reference-architecture@main/docs/development/building-good-containers.md) · jsDelivr copy of the Node.js reference architecture · Node and npm do not expect to run as PID 1 (zombie reaping); avoid npm to start the app (*read*) · fetched 2026-10-12

### T11-05 · Environment parity — dev, staging, prod — Understand · ✅ written `docs/nodejs/pages/phase-11-deployment/05-environment-parity.md`
- **Read this:** [X. Dev/prod parity](https://12factor.net/dev-prod-parity) · 12factor.net · undated; three gaps (time, personnel, tools) and keeping each small, with the warning against different backing services in dev and prod (*read*) · covers our angle: full · fetched 2026-10-12

### T11-06 · Behind a reverse proxy — `X-Forwarded-*`, `trust proxy`, TLS — Understand · ✅ written `docs/nodejs/pages/phase-11-deployment/06-reverse-proxy.md`
- **Read this:** [Express behind proxies](https://expressjs.com/en/guide/behind-proxies/) · expressjs.com · `trust proxy` defaults to false, so the client IP is the socket address; `true` takes the left-most `X-Forwarded-For` entry; accepts subnets such as `loopback` (*read*) · covers our angle: **partial** — TLS termination is not on the page · fetched 2026-10-12
- **Our delta:** TLS termination and `X-Forwarded-Proto` handling are ours.

### T11-07 · Zero-downtime deploys — rolling restarts, draining, readiness gating — Understand · ✅ written `docs/nodejs/pages/phase-11-deployment/07-zero-downtime-deploys.md`
- **Read this:** [Performing a Rolling Update](https://kubernetes.io/docs/tutorials/kubernetes-basics/update/update-intro/) · kubernetes.io · updates without downtime need several instances; by default at most one Pod is unavailable and one extra is created during the update (*read*) · covers our angle: **partial** — draining and readiness gating are not on this page · fetched 2026-10-12
- **Also good:** [Pod Lifecycle](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/) · kubernetes.io · default `terminationGracePeriodSeconds` is 30 seconds and a `preStop` hook runs inside that window (*read*) · [IX. Disposability](https://12factor.net/disposability) · 12factor.net · on `SIGTERM` a web process stops listening, lets current requests finish, then exits (*read*) · fetched 2026-10-12

### T11-08 · CI/CD — Node version matrix, dependency caching, artifacts — Understand · ✅ written `docs/nodejs/pages/phase-11-deployment/08-cicd.md`
- **Read this:** [Building and testing Node.js (GitHub Actions)](https://docs.github.com/en/actions/tutorials/build-and-test-code/nodejs) · docs.github.com · a matrix strategy over `node-version` entries, `x` matching the latest minor and patch (*read*) · covers our angle: **partial** — caching and artifacts: not confirmed from the passages I read · fetched 2026-10-12
- **Also good:** [actions/setup-node README](https://cdn.jsdelivr.net/gh/actions/setup-node@main/README.md) · jsDelivr copy (github.com is 403) · inputs `node-version`, `node-version-file` and a package-manager `cache` option (*read* the inputs block) · fetched 2026-10-12

### T11-09 · Image size and hardening — distroless, alpine, slim, glibc vs musl — Understand · ✅ written `docs/nodejs/pages/phase-11-deployment/09-image-size-hardening.md`
- **Read this:** [docker-node README](https://cdn.jsdelivr.net/gh/nodejs/docker-node@main/README.md) · jsDelivr copy · documents the `alpine` and `slim` variants and warns that Debian (glibc) applications generally will not run under Alpine (musl), with `gcompat` as a partial workaround (*read*) · covers our angle: **partial** — distroless is not covered · fetched 2026-10-12
- **Also good:** [Distroless images](https://cdn.jsdelivr.net/gh/GoogleContainerTools/distroless@main/README.md) · jsDelivr copy · only the app and its runtime dependencies, no package manager or shell (*read*) · fetched 2026-10-12
- *Not opened:* Docker Security Cheat Sheet (OWASP, returned 200).

### T11-10 · Process managers — `pm2`, `systemd`, or the orchestrator — Know · ✅ written `docs/nodejs/pages/phase-11-deployment/10-process-managers.md`
- **Read this:** [PM2 cluster mode](https://pm2.keymetrics.io/docs/usage/cluster-mode/) · pm2.keymetrics.io · `instances: "max"` with `exec_mode: "cluster"` starts as many processes as possible (*read*) · covers our angle: **partial** — pm2 only; the systemd and orchestrator options are not covered · fetched 2026-10-12
- **Also good:** [Building good containers](https://cdn.jsdelivr.net/gh/nodeshift/nodejs-reference-architecture@main/docs/development/building-good-containers.md) · jsDelivr copy · lists "use a process manager" as a container recommendation, for PID 1 reasons (*read*) · fetched 2026-10-12
- *Not opened:* the systemd.service man page (man7.org returned 200; freedesktop.org returned 418).

### T11-11 · Scaling — vertical vs horizontal, when `cluster` beats replicas — Know · ✅ written `docs/nodejs/pages/phase-11-deployment/11-scaling.md`
- **Read this:** [Cluster](https://nodejs.org/docs/latest/api/cluster.html) · nodejs.org · v26.11.1; Stable; the default distribution is round-robin from the primary (except on Windows); says to use `worker_threads` when process isolation is not needed (*read*) · covers our angle: **partial** — "cluster vs more replicas" is not discussed · fetched 2026-10-12
- *Not opened:* 12factor.net/concurrency.
- **Our delta:** the replicas-vs-cluster decision is ours.

### T11-12 · Semantic release and versioning strategy — Know · ✅ written `docs/nodejs/pages/phase-11-deployment/12-semantic-release.md`
- **Read this (1/2):** [Semantic Versioning 2.0.0](https://semver.org/) · semver.org · MAJOR for incompatible API changes, MINOR for compatible features, PATCH for compatible fixes (*read*) · covers the versioning angle: full · fetched 2026-10-12
- **Read this (2/2):** [semantic-release docs](https://semantic-release.gitbook.io/semantic-release) · semantic-release.gitbook.io · automates releases from a formalized commit message convention, integrates with CI (*read*) · covers the tooling angle: full · fetched 2026-10-12
- *Not opened:* conventionalcommits.org v1.0.0 (returned 200).

### T11-13 · Blue/green and canary deploys — When Needed · ✅ written `docs/nodejs/pages/phase-11-deployment/13-blue-green-canary.md`
- **Read this (1/2):** [Blue Green Deployment](https://martinfowler.com/bliki/BlueGreenDeployment.html) · martinfowler.com · undated; test in the idle environment, switch the router, switch back to roll back (*read*) · covers blue/green: full · fetched 2026-10-12
- **Read this (2/2):** [Canary Release](https://martinfowler.com/bliki/CanaryRelease.html) · martinfowler.com · undated; roll the change out to a small subset of users before everyone (*read*) · covers canary: full · fetched 2026-10-12

### T11-14 · Serverless Node — cold starts, connection reuse, the pooling problem — When Needed · ✅ written `docs/nodejs/pages/phase-11-deployment/14-serverless-node.md`
- **Read this (1/2):** [Lambda execution environment lifecycle](https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtime-environment.html) · docs.aws.amazon.com · objects declared outside the handler stay initialized when an environment is reused; has a cold-starts-and-latency section (*read*) · covers cold starts and connection reuse: full · fetched 2026-10-12
- **Read this (2/2):** [Using Lambda with Amazon RDS](https://docs.aws.amazon.com/lambda/latest/dg/services-rds.html) · docs.aws.amazon.com · proxies are recommended for production; a database proxy pools connections so high concurrency does not exhaust them (*read*) · covers the pooling problem: full · fetched 2026-10-12
- **Also good:** [How To: Reuse Database Connections in AWS Lambda](https://jeremydaly.com/reuse-database-connections-aws-lambda/) · jeremydaly.com · Sep 29, 2017, so old; the freeze-and-thaw idea behind reuse (*read*) · fetched 2026-10-12
- **Our delta:** AWS-specific; the generic "one client per instance, pool size 1" advice is ours.

---

## Phase 12 — Native and advanced

### T12-01 · `node:vm` — and why it is not a security sandbox — Know · ✅ written `docs/nodejs/pages/phase-12-native/01-node-vm.md`
- **Read this:** [VM (executing JavaScript)](https://nodejs.org/docs/latest/api/vm.html) · nodejs.org · v26.11.1; the page states the module "is not a security mechanism" and not to run untrusted code with it (*read*) · covers our angle: full · fetched 2026-10-12

### T12-02 · WebAssembly in Node — CPU-bound work — Know · ✅ written `docs/nodejs/pages/phase-12-native/02-webassembly.md`
- **Read this:** [Node.js with WebAssembly](https://nodejs.org/learn/getting-started/nodejs-with-webassembly) · nodejs.org/learn · ≈1.4k words; WebAssembly compiles from C/C++, Rust and AssemblyScript, a binary `.wasm` module plus a text format (*read* the opening) · covers our angle: **partial** — "when it is the right answer for CPU-bound work" is not argued · fetched 2026-10-12
- *Not opened:* MDN WebAssembly Concepts (returned 200).

### T12-03 · V8 flags and what they control — Know · ✅ written `docs/nodejs/pages/phase-12-native/03-v8-flags.md`
- **Read this:** [Command-line API (V8 options)](https://nodejs.org/docs/latest/api/cli.html) · nodejs.org · v26.11.1; a V8 options section lists `--max-old-space-size`, `--max-semi-space-size`, `--jitless`, `--stack-trace-limit`, and `--v8-options` prints the rest (*read* the headings and flag list) · covers our angle: **partial** — a reference, not "what they actually control" · fetched 2026-10-12
- **Also good:** [V8: v8.setFlagsFromString](https://nodejs.org/docs/latest/api/v8.html) · nodejs.org · v26.11.1; changing flags at runtime (*headings only*) · fetched 2026-10-12

### T12-04 · Node-API (N-API) and `node-addon-api` — When Needed · ✅ written `docs/nodejs/pages/phase-12-native/04-node-api.md`
- **Read this:** [C/C++ addons with Node-API](https://nodejs.org/docs/latest/api/n-api.html) · nodejs.org · v26.11.1; ≈34k words, look up only; sections on ABI stability, build tools (node-gyp, CMake.js), prebuilt binaries and a version matrix (*headings only*) · covers our angle: full for stable-ABI, but not a tutorial · fetched 2026-10-12
- **Also good:** [node-addon-api README](https://cdn.jsdelivr.net/gh/nodejs/node-addon-api@main/README.md) · jsDelivr copy · header-only C++ wrapper classes over the C Node-API, with a C++ object model and exception handling (*read*) · fetched 2026-10-12

### T12-05 · C++ addons and the embedder API — When Needed · ✅ written `docs/nodejs/pages/phase-12-native/05-cpp-addons.md`
- **Read this (1/2):** [C++ addons](https://nodejs.org/docs/latest/api/addons.html) · nodejs.org · v26.11.1; ≈7.2k words; examples for arguments, callbacks, object factories and wrapped objects (*headings only*) · covers addons: full · fetched 2026-10-12
- **Read this (2/2):** [C++ embedder API](https://nodejs.org/docs/latest/api/embedding.html) · nodejs.org · v26.11.1; a `node::Environment` has exactly one `v8::Isolate` and one `uv_loop_t` (*read*) · covers the embedder angle: full · fetched 2026-10-12

### T12-06 · FFI — native libraries without an addon — When Needed · ✅ written `docs/nodejs/pages/phase-12-native/06-ffi.md`
- **Read this:** [FFI](https://nodejs.org/docs/latest/api/ffi.html) · nodejs.org · v26.11.1; `node:ffi` added v26.1.0, Stability 1 Experimental; loads dynamic libraries and calls symbols, and the page calls the API unsafe (a bad pointer or signature can crash the process) (*read*) · covers our angle: full · fetched 2026-10-12
- **Our delta:** the flag is **not confirmed**: the v26.11.1 page says it "can be disabled with --no-experimental-ffi", while earlier v26 pages in the search results gate it behind `--experimental-ffi`. Re-check on the pinned version.

### T12-07 · WASI — When Needed · ✅ written `docs/nodejs/pages/phase-12-native/07-wasi.md`
- **Read this:** [WebAssembly System Interface (WASI)](https://nodejs.org/docs/latest/api/wasi.html) · nodejs.org · v26.11.1; Stability 1 Experimental, and `node:wasi` does not provide the file system sandboxing some WASI runtimes offer (*read*) · covers our angle: full · fetched 2026-10-12

### T12-08 · Custom module loaders and resolution hooks — When Needed · ✅ written `docs/nodejs/pages/phase-12-native/08-custom-loaders.md`
- **Read this:** [node:module — Customization hooks](https://nodejs.org/docs/latest/api/module.html) · nodejs.org · v26.11.1; synchronous hooks via `module.registerHooks()` are Stability 1.2 (release candidate) and the page recommends them for simplicity; async hooks via `module.register()` have `resolve` and `load` with a Caveats section (*read*) · covers our angle: full · fetched 2026-10-12
- **Our delta:** the runtime deprecation of `module.register()` in v26.0.0 is noted in `01-foundations.md` (T01-16); I did not re-verify it here.

### T12-09 · Startup snapshots — When Needed · ✅ written `docs/nodejs/pages/phase-12-native/09-startup-snapshots.md`
- **Read this:** [Command-line API: --build-snapshot](https://nodejs.org/docs/latest/api/cli.html) · nodejs.org · v26.11.1; the snapshot build is no longer experimental (v25.4.0, v24.13.1), writes a blob at exit that loads with `--snapshot-blob` (*read*) · covers our angle: **partial** — the user-land API is separate · fetched 2026-10-12
- **Also good:** [V8: Startup Snapshot API](https://nodejs.org/docs/latest/api/v8.html) · nodejs.org · v26.11.1; lists `addSerializeCallback`, `addDeserializeCallback`, `setDeserializeMainFunction`, `isBuildingSnapshot` (*headings only*) · fetched 2026-10-12

### T12-10 · Contributing to Node core — When Needed · ✅ written `docs/nodejs/pages/phase-12-native/10-contributing-to-node.md`
- **Read this:** [CONTRIBUTING.md](https://cdn.jsdelivr.net/gh/nodejs/node@main/CONTRIBUTING.md) · jsDelivr copy (github.com is 403) · sections on issues, pull requests, an AI use policy and the Developer's Certificate of Origin (*read*) · covers our angle: **partial** — the how-to is in the two guides below · fetched 2026-10-12
- **Also good:** [Guide for first-time contributors](https://cdn.jsdelivr.net/gh/nodejs/node@main/doc/contributing/first-contributions.md) · jsDelivr copy · points to `good first issue` and `help wanted` labels (*read*) · [Pull requests](https://cdn.jsdelivr.net/gh/nodejs/node@main/doc/contributing/pull-requests.md) · jsDelivr copy · fork, branch, code, commit, rebase, test, push, open the PR (*headings only*) · fetched 2026-10-12
