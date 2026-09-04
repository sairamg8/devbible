---
title: "Distributed tracing imposes measurable CPU, memory, network, and storage taxes on a JVM fleet, and surviving high throughput requires active budget controls, span filtering, and exporter batch tuning"
sidebar_label: "08 · Cost and overhead"
sidebar_position: 14
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-03 against the **OpenTelemetry SDK Specification — BatchSpanProcessor** ([opentelemetry.io](https://opentelemetry.io/docs/specs/otel/trace/sdk/#batching-processor)); **OpenTelemetry Semantic Conventions**; and **Spring Boot 4.1.1 reference** — *Actuator → Tracing* ([docs.spring.io](https://docs.spring.io/spring-boot/4.1/reference/actuator/tracing.html)).
> Target: **JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9 · Micrometer Tracing 1.7.0 · OpenTelemetry Java 1.62.0**.
> 🔴 **No sandbox run** — buffer configurations, drop policies, and tuning properties verified against OpenTelemetry SDK specifications.

**Distributed tracing is not free. Every span created incurs a tax across four distinct physical resources: CPU cycles to read system clocks and serialize headers, JVM heap memory to buffer span attributes, network bandwidth to transmit protobuf payloads to collectors, and disk I/O in backend storage engines. In high-throughput architectures, unconstrained tracing can degrade application throughput and overwhelm network interfaces. Keeping tracing sustainable requires understanding the asynchronous `BatchSpanProcessor` queue, tuning exporter thresholds, and knowing exactly what telemetry to discard before it enters your pipelines.**

## The four taxes of distributed tracing

```
┌───────────────┬───────────────────────────────────┬──────────────────────────────────────────┐
│ Tax           │ Physical Mechanism                │ Mitigation / Control Lever               │
├───────────────┼───────────────────────────────────┼──────────────────────────────────────────┤
│ **CPU**       │ Clock reads, AOP proxy intercept, │ Restrict spans to I/O boundaries;        │
│               │ context handoffs, Protobuf encode │ suppress internal helper spans           │
├───────────────┼───────────────────────────────────┼──────────────────────────────────────────┤
│ **Memory**    │ Heap allocations for Span objects,│ Bounded ring buffer (`maxQueueSize`);    │
│               │ attribute maps, in-flight queues  │ avoid storing large payload strings      │
├───────────────┼───────────────────────────────────┼──────────────────────────────────────────┤
│ **Network**   │ Continuous OTLP span transmission │ Batch compression (gzip); local OTel     │
│               │ to collectors (HTTP or gRPC)      │ DaemonSet collectors to minimize cross-AZ│
├───────────────┼───────────────────────────────────┼──────────────────────────────────────────┤
│ **Storage**   │ Disk space and indexing in APM    │ Head/Tail sampling; shorter retention for│
│               │ backends (Tempo, Jaeger, ES)      │ successful spans vs error spans          │
└───────────────┴───────────────────────────────────┴──────────────────────────────────────────┘
```

## The heart of tracing memory: the `BatchSpanProcessor`

Spans are never transmitted synchronously over the network as they finish. Halting an application thread to make an HTTP call to a collector would add network latency to every business transaction.

Instead, the OpenTelemetry SDK processes spans asynchronously using a **`BatchSpanProcessor`**:

```
App Thread:
span.end() ──> [Enqueues to in-memory ring buffer] ──> Returns immediately (< 1 µs)
                               │
                        (Bounded Queue)
                               │
Exporter Background Thread:
                     Wakes on batch size or timer:
                     Flushes batch of spans via OTLP ──> OpenTelemetry Collector
```

### The specification contract on buffer overflow

The OpenTelemetry SDK specification dictates how the `BatchSpanProcessor` handles queue exhaustion:

> *"The processor MUST NOT block the caller when the queue is full. If the queue is full, the processor MUST drop the span."*

When an application experiences sudden traffic surges, or when the downstream collector slows down:
1. The queue fills to `maxQueueSize`.
2. New spans arriving from application threads are **dropped on the floor**.
3. The SDK emits an internal log warning: `Span processor queue is full; dropping spans`.
4. Downstream services that receive requests still see `sampled=1` in `traceparent`, recording their spans normally.
5. **The visual symptom in APM:** A trace with a missing root span or random gaps in the waterfall.

### Spring Boot / OpenTelemetry queue tuning properties

```properties
# Maximum number of spans held in the memory buffer before dropping (default: 2048)
otel.bsp.max.queue.size=4096

# Maximum number of spans exported in a single OTLP batch (default: 512)
otel.bsp.max.export.batch.size=512

# Delay interval between batch flush attempts in milliseconds (default: 5000)
otel.bsp.schedule.delay=2000

# Network timeout for the export RPC in milliseconds (default: 30000)
otel.bsp.export.timeout=5000
```

## What to drop first: the survival checklist

When tracing overhead threatens cluster stability or drives excessive infrastructure bills, apply these reductions in order:

### 1. Drop health checks and infrastructure polling
Kubernetes liveness and readiness probes (`/actuator/health`, `/livez`) execute every few seconds against every pod, generating millions of meaningless spans. Suppress them using an `ObservationPredicate`:

```java
package com.example.tracing.tuning;

import io.micrometer.observation.Observation;
import io.micrometer.observation.ObservationPredicate;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.server.observation.ServerRequestObservationContext;

@Configuration
public class TracingFilterConfig {

    @Bean
    public ObservationPredicate ignoreHealthChecks() {
        return (name, context) -> {
            if (context instanceof ServerRequestObservationContext serverContext) {
                String uri = serverContext.getCarrier().getRequestURI();
                return !uri.startsWith("/actuator/health") && !uri.equals("/favicon.ico");
            }
            return true;
        };
    }
}
```

### 2. Strip unbounded attributes and payload dumps
Never attach full JSON request/response bodies or raw SQL query schemas to span attributes. A 10 KB JSON payload attached to every span increases network serialization and storage volume by orders of magnitude. Keep span attributes restricted to identifiers and status codes.

### 3. Eliminate sub-millisecond child spans
If an algorithm executes 2,000 internal calculations in memory, do not create spans around them. A trace is not a call-tree profiler. Use JFR and async-profiler for CPU bottlenecks.

### 4. Enable OTLP compression
Verify that OTLP exporters enable gzip compression. Protobuf span batches compress exceptionally well due to repetitive attribute keys and service metadata, reducing network egress bandwidth by over 70%.

## Shutdown and data loss

When a JVM receives a termination signal (`SIGTERM` during Kubernetes pod evictions), Spring Boot begins graceful shutdown. 

If the container terminates before the `BatchSpanProcessor` flushes its remaining queue, the in-flight spans are lost forever. OpenTelemetry registers a JVM shutdown hook (`tracerProvider.shutdown()`) that attempts a final flush within a bounded timeout. Ensure your Kubernetes `terminationGracePeriodSeconds` provides sufficient buffer (at least 15–30 seconds) for Spring's graceful shutdown and exporter draining to complete.

## Gotchas

### Spans dropped silently under heavy burst traffic
**Symptom.** Under flash-sale loads, APM dashboards show broken traces where the entry controller span is missing, but downstream service spans exist.  
**Cause.** The gateway's `BatchSpanProcessor` queue reached `maxQueueSize` (2048) and dropped the root span, but forwarded the `traceparent` header with `sampled=1`.  
**Fix.** Increase `otel.bsp.max.queue.size` to 8192, decrease `otel.bsp.schedule.delay` to flush more frequently, and scale out the collector tier.

### Pod OOMKilled caused by unbounded span buffering
**Symptom.** Containers crash with exit code 137 during collector outages.  
**Cause.** Using an unconstrained or poorly configured queue where memory grew faster than GC could reclaim it.  
**Fix.** Rely on standard bounded queues (`BatchSpanProcessor`), never unbounded buffers; ensure `maxQueueSize` matches container memory limits.

### Network egress bill exceeds compute bill
**Symptom.** Cloud provider bill reveals massive cross-AZ network egress charges for telemetry traffic.  
**Cause.** Pods in one availability zone sending uncompressed OTLP traces directly to collectors in another availability zone.  
**Fix.** Deploy OpenTelemetry Collector agents as Kubernetes `DaemonSets` (one on each node); pods transmit over `localhost` or node-local networks, and the DaemonSet batches, compresses, and routes across zones.

## Interview questions

**★ How does the `BatchSpanProcessor` protect application thread latency?**  
The `BatchSpanProcessor` decouples span recording from network I/O. When an application thread calls `span.end()`, the processor inserts the span into a high-speed, bounded in-memory ring buffer and immediately returns control to the application thread. A dedicated background daemon thread wakes up periodically or when the batch size threshold is reached to batch, serialize, and transmit the spans to the remote collector via OTLP, ensuring business threads never block on network transport.

**★ What happens when the `BatchSpanProcessor` in-memory queue reaches capacity?**  
According to the OpenTelemetry specification, the processor must drop incoming spans rather than block application threads or allocate unbounded memory. When the queue overflows, new spans are discarded, resulting in telemetry gaps (such as missing parent spans). Systems monitor queue health using internal SDK metrics like `otel.sdk.traces.spans.dropped` to alert when buffer capacities need tuning.

**★ Why does a dropped root span produce a confusing trace waterfall?**  
When the root ingress service drops its own span due to an exporter buffer overflow, it has already injected the `traceparent` header (with `sampled=1`) into outbound HTTP requests. Downstream services receive the header, see that sampling is enabled, and record their child spans normally. When the APM backend renders the trace, the child spans appear with an unknown parent ID, rendering the trace as an orphaned waterfall with no top-level entry point.

**★ What are the primary techniques for reducing tracing storage costs without sacrificing error detection?**  
First, filter out high-frequency infrastructure traffic (health checks, metric scrapes) at the application layer. Second, strip large text payloads (HTTP bodies, query dumps) from span attributes. Third, implement adaptive head sampling (e.g. 5–10% baseline for normal requests). Fourth, implement tail sampling at the OpenTelemetry Collector layer to retain 100% of traces containing HTTP 5xx codes or span errors while downsampling successful 200 OK responses to 1%.

---

← [06b · Tail sampling](06b-the-trace-you-needed-was-not-sampled.md) · [Topic index](README.md) · Next topic → [10 · Packaging for deploy](../10-packaging-for-deploy/README.md)
