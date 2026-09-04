---
title: "Distributed tracing: one request across many services, the W3C traceparent and tracestate headers that preserve its causal graph, and the sampling math that decides whether the trace you needed exists"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-03 against the **W3C Trace Context Level 1 Recommendation** ([w3.org/TR/trace-context/](https://www.w3.org/TR/trace-context/)); **W3C Baggage Specification** ([w3.org/TR/baggage/](https://www.w3.org/TR/baggage/)); **OpenZipkin B3 Propagation Specification**; **OpenTelemetry SDK and Semantic Conventions**; and **Spring Boot 4.1.1 reference** — *Actuator → Tracing* ([docs.spring.io](https://docs.spring.io/spring-boot/4.1/reference/actuator/tracing.html)).
> Target: **JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9 · Micrometer Tracing 1.7.0 · OpenTelemetry Java 1.62.0**.
> 🔴 **No sandbox run** — specifications, wire formats, sampling algorithms, and framework property configurations verified against upstream documentation.

**Distributed tracing is the observability signal that joins isolated process events into a single causal journey. When an HTTP call crosses six microservices, touches three databases, and publishes to a message broker, metrics only show that an aggregate percentile degraded, and logs sit trapped in disconnected silos. Tracing injects and extracts standard correlation headers across network hops and captures asynchronous handoffs across JVM threads. This topic covers the W3C wire standards, the mechanics of context propagation inside the JVM, how Spring Boot 4.1 auto-configures Micrometer Tracing and OTLP export, and the head and tail sampling math required to keep tracing telemetry economically viable.**

## Chunks

| # | Chunk | Tier | What it argues |
|---|---|---|---|
| 1 | **[The request that vanished](01-the-request-that-vanished.md)** | <span className="db-tier t-know">Know</span> | Six services, one slow call, and logs that cannot be joined without a trace |
| 2 | **[Traces, spans and context](02-traces-spans-and-context.md)** | <span className="db-tier t-know">Know</span> | The vocabulary: trace ID, span ID, parent ID, attributes, events, links, and status |
| 3 | **[Span kind and the shape of a trace](02b-span-kind-and-the-shape-of-a-trace.md)** | <span className="db-tier t-know">Know</span> | Client vs Server vs Producer vs Consumer, and reading the trace tree |
| 4 | **[Context propagation](03-context-propagation.md)** | <span className="db-tier t-know">Know</span> | In-process `ThreadLocal` snapshotting vs over-the-wire carrier injection/extraction |
| 5 | **[The traceparent header](03b-the-traceparent-header.md)** | <span className="db-tier t-know">Know</span> | W3C `traceparent` field by field: version, 16-byte trace ID, 8-byte parent ID, flags |
| 6 | **[Mutations and processing](03b2-traceparent-mutations-and-processing.md)** | <span className="db-tier t-know">Know</span> | The four legal `traceparent` mutations, version parsing, and Spring Boot 4.1 defaults |
| 7 | **[tracestate and baggage](03c-tracestate-and-baggage.md)** | <span className="db-tier t-know">Know</span> | W3C `tracestate` vendor routing vs W3C `baggage` application business context |
| 8 | **[B3 and other formats](03d-b3-and-the-other-formats.md)** | <span className="db-tier t-know">Know</span> | B3 single/multi, Jaeger, Datadog decimal IDs, and the shared vs separate span ID trap |
| 9 | **[Propagation that breaks](03e-propagation-that-breaks.md)** | <span className="db-tier t-know">Know</span> | Thread pool handoffs, stale `ThreadLocal` contamination, Kafka batches, and WebFlux |
| 10 | **[Wiring in Spring Boot](05-wiring-it-in-spring-boot.md)** | <span className="db-tier t-know">Know</span> | Actuator triad, Micrometer Tracing bridge (OTel vs Brave), OTLP exporter, agent comparison |
| 11 | **[Custom spans and annotations](05b-custom-spans-and-annotations.md)** | <span className="db-tier t-know">Know</span> | `@Observed`, programmatic `Observation`, `Tracer` spans, and attributes vs events |
| 12 | **[Sampling](06-sampling.md)** | <span className="db-tier t-know">Know</span> | Head sampling, `TraceIdRatioBased`, `ParentBased` delegation, and probability math |
| 13 | **[Tail sampling](06b-the-trace-you-needed-was-not-sampled.md)** | <span className="db-tier t-know">Know</span> | OTel Collector `tail_sampling`, trace-ID load-balancing routing, and memory sizing |
| 14 | **[Cost and overhead](08-cost-and-overhead.md)** | <span className="db-tier t-know">Know</span> | The four tracing taxes, `BatchSpanProcessor` queue drops, span filtering, and shutdown |

## Phase gate

You are done with this topic when, presented with an incident where a user request stalled across multiple microservices:
1. You can inspect an HTTP request and verify that the W3C `traceparent` header conforms to specification syntax.
2. You can identify why an uninstrumented thread pool or custom `RestTemplate` broke context propagation, and fix it using `ContextSnapshot` or Spring client builders.
3. You can configure Spring Boot 4.1 with `micrometer-tracing-bridge-otel` and export spans to an OTLP endpoint over HTTP or gRPC.
4. You can explain why `ParentBased` head sampling is required across microservices, and how a tail-sampling collector preserves rare errors that head sampling drops.

## Where this connects

- **[07 · Logging done right](../07-logging-done-right/README.md)** owns structured logging and MDC; tracing injects `traceId` and `spanId` into those MDC maps.
- **[08 · Metrics with Micrometer](../08-metrics-with-micrometer/README.md)** owns aggregated counters and timers; exemplars bridge metric latency percentiles to individual trace samples.
- **[05 · Thread dumps](../05-thread-dumps/README.md)** owns diagnosing what a thread is doing when a span duration shows excessive self-time without child calls.
- **[12 · Graceful shutdown](../12-graceful-shutdown/README.md)** owns cleanly draining in-flight requests and flushing the `BatchSpanProcessor` queue on SIGTERM.
- **[Phase 14 · Microservice architecture](../../phase-14-microservice-architecture/README.md)** owns service boundaries, sync vs async coupling, and correlation across services.

---

Start → [01 · The request that vanished](01-the-request-that-vanished.md)
