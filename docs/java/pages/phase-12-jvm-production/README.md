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

🚧 **0 of 15 topics closed — but the phase is scaffolded and topic 01 is well under way.**

**All 15 topics are planned**: `_PHASE-NOTES.md` (binding: JDK 25 version spine, topic
boundaries, the phase's hard rules) and a `_plan.md` for every topic are written, so any
topic here can be picked up cold. **Topic 01 · Memory layout has 31 chunks on disk
(~7,900 lines)** and needs six more plus its index before it closes — it is deliberately
not linked below until that index exists.

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **Memory layout** *(31 chunks written; index pending)* | <span className="db-tier t-understand">Understand</span> | Heap, metaspace, stacks — "heap is fine but the process grew" |
| 02 | **GC in practice** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | G1 vs generational ZGC vs the rest, chosen by latency target |
| 03 | **Heap sizing in containers** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | `MaxRAMPercentage` and the OOMKilled loop |
| 04 | **`OutOfMemoryError`** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | Heap dumps, MAT, dominator trees — and the usual suspects |
| 05 | **Thread dumps** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | `jcmd`/`jstack` — the deadlock diagnosed in two minutes |
| 06 | **JFR, Mission Control and async-profiler** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | Always-on profiling; the regex that ate a core |
| 07 | **Logging done right** *(not written yet)* | <span className="db-tier t-master">Master</span> | SLF4J over Logback, structured JSON, MDC on every line |
| 08 | **Metrics with Micrometer** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | RED per endpoint; the histogram-vs-average lesson |
| 09 | **Distributed tracing** *(not written yet)* | <span className="db-tier t-know">Know</span> | OpenTelemetry auto-instrumentation across service, DB, queue |
| 10 | **Packaging for deploy** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | Layered jars, JRE base images, non-root, AOT/CDS (JEP 483) |
| 11 | **GraalVM native image** *(not written yet)* | <span className="db-tier t-know">Know</span> | Instant startup vs closed-world limits — where it pays |
| 12 | **Graceful shutdown** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | SIGTERM → drain → close pools; readiness interplay |
| 13 | **JVM flags that matter in 2026** *(not written yet)* | <span className="db-tier t-know">Know</span> | And the ones ergonomics retired |
| 14 | **Benchmarking with JMH** *(not written yet)* | <span className="db-tier t-know">Know</span> | Why `nanoTime` around a loop measures the JIT, not your code |
| 15 | **Checkpoint/restore (CRaC)** *(not written yet)* | <span className="db-tier t-when">When Needed</span> | Startup in milliseconds by restoring a snapshot |

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
