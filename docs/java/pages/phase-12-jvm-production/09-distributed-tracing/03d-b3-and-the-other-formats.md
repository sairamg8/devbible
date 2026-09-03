---
title: "B3 propagation, Jaeger native headers, and vendor formats survive in legacy fleets, and understanding shared span IDs versus separate span IDs is the difference between an aligned trace and an inverted waterfall"
sidebar_label: "03d · B3 and other formats"
sidebar_position: 8
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-03 against the **OpenZipkin B3 Propagation Specification** ([github.com/openzipkin/b3-propagation](https://github.com/openzipkin/b3-propagation)); the **OpenTelemetry B3 Propagator Specification** ([opentelemetry.io](https://opentelemetry.io/docs/specs/otel/context/api-propagators/#b3-requirements)); the **Jaeger Propagation Specification** ([jaegertracing.io](https://www.jaegertracing.io/docs/client-libraries/#propagation-format)); and **Spring Boot 4.1.0 reference** — *Actuator → Tracing → Propagation* ([docs.spring.io](https://docs.spring.io/spring-boot/4.1/reference/actuator/tracing.html)).
> Target: **JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8 · Micrometer Tracing 1.7.0 · OpenTelemetry Java 1.62.0**.
> 🔴 **No sandbox run** — header formats and migration behaviors verified against official upstream specifications.

**W3C Trace Context is the modern standard, but real production architectures rarely transition in a single leap. Older microservices built on Spring Cloud Sleuth, Finagle, Brave, Jaeger native libraries, AWS X-Ray, or Datadog still transmit billions of requests every day using legacy wire protocols. The most dangerous trap during a migration is not that headers fail to parse—it is the fundamental structural disagreement between systems that use shared span IDs (Zipkin/Brave) and systems that use distinct span IDs for client and server (OpenTelemetry and W3C). Knowing how B3 single and multi-header formats operate, how Datadog decimal IDs conflict with hex standards, and how Spring Boot 4.1 configures asymmetric consume and produce lists is essential for keeping multi-generation fleets observable.**

## The legacy landscape: four formats you still encounter

```
        Format             Trace ID Width      Span ID Width     Wire Representation
┌───────────────────────┬───────────────────┬─────────────────┬──────────────────────────────────────────┐
│ W3C Trace Context     │ 128-bit hex (32c) │ 64-bit hex (16c)│ traceparent: 00-{trace}-{span}-{flags}   │
│ B3 Multi-Header       │ 64/128-bit hex    │ 64-bit hex (16c)│ X-B3-TraceId, X-B3-SpanId, X-B3-Sampled  │
│ B3 Single-Header      │ 64/128-bit hex    │ 64-bit hex (16c)│ b3: {trace}-{span}-{sampled}-{parent}    │
│ Jaeger (native)       │ 64/128-bit hex    │ 64-bit hex (16c)│ uber-trace-id: {trace}:{span}:{parent}:{f│
│ Datadog               │ 64-bit uint (dec) │ 64-bit uint(dec)│ x-datadog-trace-id, x-datadog-parent-id  │
│ AWS X-Ray             │ 128-bit custom    │ 64-bit hex (16c)│ X-Amzn-Trace-Id: Root=1-{epoch}-{id};... │
└───────────────────────┴───────────────────┴─────────────────┴──────────────────────────────────────────┘
```

### 1. The B3 propagation specification

Created by OpenZipkin and made ubiquitous by Spring Cloud Sleuth (Spring Boot 1.x and 2.x), B3 defines two HTTP serializations:

#### B3 Multi-Header
Transmits context across distinct HTTP headers:
- `X-B3-TraceId`: 16 or 32 hexadecimal characters (64-bit or 128-bit).
- `X-B3-SpanId`: 16 hexadecimal characters (64-bit), representing the current operation.
- `X-B3-Sampled`: `1` (sampled/accept), `0` (not sampled/deny). If absent, downstream decides.
- `X-B3-ParentSpanId`: 16 hexadecimal characters. Optional; denotes the span that invoked this operation.
- `X-B3-Flags`: `1` indicates "Debug" mode (forces sampling regardless of rate limits).

```http
X-B3-TraceId: 4bf92f3577b34da6a3ce929d0e0e4736
X-B3-SpanId: 00f067aa0ba902b7
X-B3-Sampled: 1
X-B3-ParentSpanId: 5b8aa5a2d2c872e8
```

#### B3 Single-Header
Designed to reduce HTTP header parsing overhead and transport costs, bundling all fields into the `b3` header:
```
b3: {TraceId}-{SpanId}-{SamplingState}-{ParentSpanId}
```
Examples from the OpenZipkin specification:
- Fully qualified: `b3: 4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-1-5b8aa5a2d2c872e8`
- Without optional parent ID: `b3: 4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-1`
- Unsampled indicator only: `b3: 0`

### 2. Jaeger native (`uber-trace-id`)
Legacy Jaeger clients serialize context into a single colon-delimited header:
```http
uber-trace-id: {trace-id}:{span-id}:{parent-span-id}:{flags}
uber-trace-id: 4bf92f3577b34da6:00f067aa0ba902b7:0:1
```
All IDs are hex-encoded; flags byte `1` indicates sampled.

### 3. Datadog native
Datadog historically uses unsigned **64-bit decimal strings**, not hex:
```http
x-datadog-trace-id: 13919827391823719283
x-datadog-parent-id: 891238129381923819
x-datadog-sampling-priority: 1
```
Interoperating with Datadog requires converting 64-bit base-10 strings to base-16 hex without integer overflow in runtimes that default to signed 64-bit primitives.

## 🔴 The architectural fault line: shared vs separate span IDs

The deepest incompatibility between legacy Zipkin/Brave and modern OpenTelemetry/W3C is not header syntax—it is how client and server spans are identified.

```
Zipkin / Brave (Shared Span ID model):
Service A [Client Span: ID=X]  ──(X-B3-SpanId: X)──>  Service B [Server Span: ID=X]
                       (Both sides share the same ID X)

W3C / OpenTelemetry (Separate Span ID model):
Service A [Client Span: ID=A]  ──(traceparent: parent-id=A)──> Service B [Server Span: ID=B, parent=A]
                       (Each side generates a distinct ID)
```

In the **Shared Span ID** model (Zipkin/Brave), the client creates a span with ID `X` and sends `X-B3-SpanId: X`. The receiving server does *not* generate a new span ID; it creates its server span with ID `X` and links it to the same parent. The backend merges both halves into a single record.

In the **Separate Span ID** model (W3C/OTel), the client creates span `A`. The header transmits `parent-id: A`. The receiving server creates a new span `B` whose parent is explicitly recorded as `A`.

### The collision risk in hybrid fleets
When an OpenTelemetry SDK receives a B3 header emitted by a Brave service:
1. If the OTel B3 propagator is configured with `b3.inject()` / `b3.extract()` defaults, it generates a new span ID `B` with parent `X`.
2. If this context is subsequently sent to a legacy Brave service expecting shared IDs, the Brave service may reject parentage or create duplicate keys in storage backends (such as Elasticsearch or OpenSearch index collisions).
3. If both Brave and OTel export spans to the same collector under shared IDs, timestamps overlap and waterfall UI visualizations invert (child appears to finish before parent starts).

## Asymmetric propagation in Spring Boot 4.1

Spring Boot 4.1 separates what a service **consumes** (accepts on incoming requests) from what it **produces** (transmits on outbound HTTP calls):

```properties
# Default Boot 4.1 configuration:
# Accepts standard W3C, plus legacy B3 single and B3 multi
management.tracing.propagation.consume=W3C,B3,B3_MULTI

# Emits ONLY W3C traceparent by default
management.tracing.propagation.produce=W3C
```

### The zero-downtime fleet migration recipe

If your Boot 4.1 service calls an unmigrated Spring Boot 2.x or legacy Go service that only reads `X-B3-*` headers:

🔴 **Do NOT set `management.tracing.propagation.type=b3`.** Setting `type` replaces *both* consume and produce lists, blinding your service to incoming W3C headers from modernized services.

Instead, expand the `produce` list while keeping default `consume`:

```properties
# Accept anything, emit both W3C and B3 Multi until legacy services retire
management.tracing.propagation.consume=W3C,B3,B3_MULTI
management.tracing.propagation.produce=W3C,B3_MULTI
```

```java
package com.example.tracing.propagation;

import io.micrometer.tracing.Tracer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

@Configuration
public class LegacyPropagationConfig {

    private static final Logger log = LoggerFactory.getLogger(LegacyPropagationConfig.class);

    @Bean
    public RestClient legacyServiceClient(RestClient.Builder builder) {
        // Builder inherits auto-configured composite propagator
        // Outbound calls will include both "traceparent" and "X-B3-TraceId/SpanId"
        return builder.baseUrl("https://legacy-payment-service.internal").build();
    }
}
```

## Gotchas

### Setting propagation.type drops incoming W3C headers
**Symptom.** After configuring `management.tracing.propagation.type=b3` to support a legacy dependency, modern upstream services calling your API result in truncated, newly generated traces.  
**Cause.** `management.tracing.propagation.type` sets both consume and produce to a single format. Upstream W3C `traceparent` is ignored on ingress.  
**Fix.** Leave `type` unset; explicitly configure `management.tracing.propagation.produce=W3C,B3_MULTI`.

### Datadog decimal IDs truncated by 64-bit signed parsers
**Symptom.** A Spring Boot service extracts `x-datadog-trace-id`, but downstream Jaeger/Tempo reports trace IDs as negative numbers or corrupt hashes.  
**Cause.** Datadog IDs are unsigned 64-bit integers (`0` to `2^64 - 1`). Java's `Long.parseLong(str)` throws `NumberFormatException` for values greater than `Long.MAX_VALUE` (`9223372036854775807`).  
**Fix.** Parse unsigned decimal strings using `Long.parseUnsignedLong(str, 10)` and format to 16-character hex using `Long.toHexString()` padded with leading zeros:
```java
public static String datadogIdToHex(String datadogDecimalId) {
    long unsigned = Long.parseUnsignedLong(datadogDecimalId, 10);
    return String.format("%016x", unsigned);
}
```

### AWS X-Ray rejects traces generated without timestamp prefixes
**Symptom.** Traces initiated by Spring Boot fail to register in AWS X-Ray consoles when passing through an AWS Application Load Balancer.  
**Cause.** AWS X-Ray requires the first 32 bits (8 hex characters) of the 128-bit trace ID to represent the current Unix epoch time in seconds. Generic random 128-bit IDs violate X-Ray's indexing scheme.  
**Fix.** Use an X-Ray compatible ID generator (`AwsXrayIdGenerator`) or place an AWS API Gateway / ALB at the boundary to mint the initial root ID.

### Inverted waterfalls in mixed Zipkin and OpenTelemetry pipelines
**Symptom.** Spans in Jaeger UI render with negative execution duration or children finishing before parents start.  
**Cause.** A Brave service propagated a shared span ID `X`. An OpenTelemetry proxy accepted `X` but emitted a server span with start timestamp derived from its own clock while reusing ID `X`, clobbering the client span record.  
**Fix.** Ensure OpenTelemetry collectors and SDKs enable `b3.shared_span_id_enabled=false` or configure dedicated parent-child translation.

## Interview questions

**★ What is the difference between B3 Multi-Header and B3 Single-Header formats?**  
B3 Multi-Header serializes trace context into distinct HTTP headers (`X-B3-TraceId`, `X-B3-SpanId`, `X-B3-Sampled`, `X-B3-ParentSpanId`), providing human-readable debuggability at the expense of larger HTTP request headers. B3 Single-Header packs the entire context into a single hyphen-delimited string (`b3: {traceId}-{spanId}-{sampling}-{parentSpanId}`), minimizing network overhead and parsing cost. Both formats convey the identical distributed context model.

**★ Explain the "Shared Span ID" problem when bridging Zipkin/Brave and OpenTelemetry.**  
In Zipkin/Brave, an RPC client span and its corresponding RPC server span share the exact same 64-bit span ID (distinguished only by span kind `CLIENT` vs `SERVER`). In OpenTelemetry and W3C, every span has a globally unique span ID: the client span has ID `A`, and the downstream server span receives ID `B` with parent set to `A`. If a pipeline mixes both models without translation, spans clobber each other in storage backends, trace trees invert, or duplicate ID errors occur.

**★ Why should you configure `management.tracing.propagation.produce` rather than `type` when migrating a Spring Boot fleet?**  
Setting `management.tracing.propagation.type` overwrites both inbound consumption and outbound production to a single protocol. If you set it to `B3`, the service stops accepting W3C `traceparent` headers from upgraded callers. Configuring `produce=W3C,B3_MULTI` while leaving `consume` at its default (`W3C,B3,B3_MULTI`) enables asymmetric bridging: the service understands all inbound formats and outputs dual headers, preserving trace continuity across both old and new services.

**★ How does AWS X-Ray's trace ID format differ from W3C and B3 standards?**  
While W3C and modern B3 specify 128-bit random hexadecimal trace IDs, AWS X-Ray requires a structured 128-bit format: version `1`, followed by an 8-digit hexadecimal Unix epoch timestamp (indicating when the request entered the system), followed by a 96-bit (24-hex-character) random identifier. Traces generated without a valid epoch timestamp are rejected or mis-indexed by AWS X-Ray storage engines.

**★ How do Datadog trace IDs differ from standard hex-encoded trace IDs, and what is the parsing trap in Java?**  
Datadog represents trace and span IDs as 64-bit unsigned decimal integers as ASCII strings, whereas W3C and B3 use lowercase hexadecimal strings. In Java, 64-bit integers are signed (`long`). Standard `Long.parseLong(id)` throws `NumberFormatException` when parsing IDs greater than `Long.MAX_VALUE`. Runtimes must use `Long.parseUnsignedLong(id, 10)` to safely convert Datadog decimal IDs into 64-bit primitives and format them to hexadecimal.

---

← [03c · tracestate and baggage](03c-tracestate-and-baggage.md) · **Topic index** *(not written yet)* · Next → **03e · Propagation that breaks** *(not written yet)*
