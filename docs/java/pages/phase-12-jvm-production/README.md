---
title: "Phase 12 — The JVM in production"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: Java 25 (LTS).** Documentation-validated — every page names its
> sources on a `> Verified:` line (the HotSpot GC tuning guide, the JDK 25
> tool references for `jcmd`/`jstack`/JFR, the Micrometer and OpenTelemetry
> docs, the Spring Boot production-ready reference). No sandbox: pages carry
> flags and code, never fabricated GC logs, dumps or metrics.

The payoff of Phase 0's mental model: memory, GC, and the observability tools
that come *with* the JVM. This is the phase that turns "the service is slow"
from a mystery into a flame graph.

🚧 **11 of 15 topics closed** *(counted off disk, 2026-09-03)*. Topics 01–08, 10, 14 and 15 are
complete — 189 chunks and seven indexes for 01–07, 33 chunks for 08, 29 for 10, 19 for 14 and 13
for 15, each with an index — and are linked below. The remaining four are 09 and 12 (part-written,
chunks on disk without an index) and 11 and 13 (planned, `_plan.md` only).

**All 15 topics are planned**: `_PHASE-NOTES.md` (binding: JDK 25 version spine, topic
boundaries, the phase's hard rules) and a `_plan.md` for every topic are written, so any
topic here can be picked up cold. A topic still shown as *(in progress)* has chunks on disk
but no index yet, and is deliberately not linked until it has one.

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **[Memory layout](01-memory-layout/README.md)** | <span className="db-tier t-understand">Understand</span> | Heap, metaspace, stacks — "heap is fine but the process grew" |
| 02 | **[GC in practice](02-gc-in-practice/README.md)** | <span className="db-tier t-understand">Understand</span> | G1 vs generational ZGC vs the rest, chosen by latency target |
| 03 | **[Heap sizing in containers](03-heap-sizing-in-containers/README.md)** | <span className="db-tier t-understand">Understand</span> | `MaxRAMPercentage` and the OOMKilled loop |
| 04 | **[`OutOfMemoryError`](04-out-of-memory-error/README.md)** | <span className="db-tier t-understand">Understand</span> | Heap dumps, MAT, dominator trees — and the usual suspects |
| 05 | **[Thread dumps](05-thread-dumps/README.md)** | <span className="db-tier t-understand">Understand</span> | `jcmd`/`jstack` — the deadlock diagnosed in two minutes |
| 06 | **[JFR, Mission Control and async-profiler](06-jfr-and-profiling/README.md)** | <span className="db-tier t-understand">Understand</span> | Always-on profiling; the regex that ate a core |
| 07 | **[Logging done right](07-logging-done-right/README.md)** | <span className="db-tier t-master">Master</span> | SLF4J over Logback, structured JSON, MDC on every line |
| 08 | **[Metrics with Micrometer](08-metrics-with-micrometer/README.md)** | <span className="db-tier t-understand">Understand</span> | RED per endpoint; the histogram-vs-average lesson — 33 chunks, 493 ★ |
| 09 | **Distributed tracing** *(in progress)* | <span className="db-tier t-know">Know</span> | OpenTelemetry auto-instrumentation across service, DB, queue |
| 10 | **[Packaging for deploy](10-packaging-for-deploy/README.md)** | <span className="db-tier t-understand">Understand</span> | Layered jars, JRE base images, non-root, AOT/CDS (JEP 483) |
| 11 | **GraalVM native image** *(not written yet)* | <span className="db-tier t-know">Know</span> | Instant startup vs closed-world limits — where it pays |
| 12 | **Graceful shutdown** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | SIGTERM → drain → close pools; readiness interplay |
| 13 | **JVM flags that matter in 2026** *(not written yet)* | <span className="db-tier t-know">Know</span> | And the ones ergonomics retired |
| 14 | **[Benchmarking with JMH](14-benchmarking-with-jmh/README.md)** | <span className="db-tier t-know">Know</span> | Why `nanoTime` around a loop measures the JIT, not your code |
| 15 | **[Checkpoint/restore (CRaC)](15-checkpoint-restore-crac/README.md)** | <span className="db-tier t-when">When Needed</span> | Startup in milliseconds by restoring a snapshot |

## Phase gate

Move on when: for "p99 latency doubled after the deploy", you have an ordered
plan — metrics first, then GC log, then a flame graph, then a thread dump —
and can say what each would show if it were the culprit.

## Where this connects

- **[Phase 0](../phase-0-platform-jvm/README.md)** is the model these tools
  observe; topic 08 there previews the GC story.
- **[Phase 6](../phase-6-concurrency/README.md)** causes the thread states
  topic 05 reads.
- **Phase 16 — Resilience** consumes topics 08–09 as the fleet's nervous
  system; the [Docker section](../../../docker/README.md) owns the container
  side.
