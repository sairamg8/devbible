---
title: "Tracestate carries vendor metadata across heterogeneous tracing boundaries while baggage propagates application context, and conflating the two leaks business data into tracing backends or triggers silent HTTP 431 header drops"
sidebar_label: "03c · tracestate and baggage"
sidebar_position: 7
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-03 against the **W3C Trace Context Recommendation (Level 1, 23 November 2021)** — sections 3.3 *Tracestate Header* and 3.5 *Mutating the tracestate Field* ([w3.org](https://www.w3.org/TR/trace-context/)); the **W3C Baggage Specification (W3C Working Draft / CR)** — section 3 *Baggage HTTP Header Format* ([w3.org](https://www.w3.org/TR/baggage/)); and **Spring Boot 4.1.0 reference** — *Tracing → Baggage* and `management.tracing.baggage.*` property definitions ([docs.spring.io](https://docs.spring.io/spring-boot/4.1/reference/actuator/tracing.html)).
> Target: **JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8 · Micrometer Tracing 1.7.0 · OpenTelemetry Java 1.62.0**.
> 🔴 **No sandbox run** — code and configurations verified against upstream specifications and Spring Boot sources.

**The W3C `traceparent` header solves hop-by-hop identity: trace ID, parent span ID, and the sampled flag. But real production systems need two additional pieces of context that cannot live inside that 55-character string: vendor-specific routing state (`tracestate`) and application-level business metadata (`baggage`). Tracestate belongs strictly to tracing vendors to bridge heterogeneous APM platforms without corrupting standard identifiers, while baggage belongs to application code to carry contextual attributes across thread pools and RPC boundaries without polluting method signatures. Conflating the two, or assuming baggage automatically appears in logs and spans without explicit registration, is why distributed contexts silently disappear or detonate downstream metric cardinality.**

## Tracestate: multi-vendor trace interoperability

Before W3C standardization, every APM vendor invented proprietary headers (`X-B3-TraceId`, `x-datadog-trace-id`, `X-Amzn-Trace-Id`). When a request crossed from an AWS API Gateway (X-Ray) into a Java service monitored by Datadog and then called a partner monitored by Dynatrace, tracing broke.

`traceparent` standardizes the universal trace identity, but vendors still need proprietary opaque state—such as internal sampling priorities, tenant routing tokens, or legacy parent offsets. Section 3.3 of the W3C Trace Context specification defines `tracestate` as the companion header to hold this:

> *"The main purpose of the `tracestate` HTTP header is to provide additional vendor-specific trace identification information across different distributed tracing systems and is a companion header for the `traceparent` field. It also conveys information about the request’s position in multiple distributed tracing graphs."*

```http
traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
tracestate: rojo=00f067aa0ba902b7,congo=t61rcWkgMzE
```

### Spec rules governing tracestate

1. **Format and list limits:** Comma-separated list of `key=value` pairs (`list-member`s). A list can contain at most **32** members.
2. **Key syntax:** Either a `simple-key` (lowercase ASCII `a-z`, digits `0-9`, `_`, `-`, `*`, `/`, beginning with `a-z` or `0-9`, max 256 characters) or a `multi-tenant-key` (`tenant-id@system-id`, where `tenant-id` is up to 240 characters and `system-id` up to 14 characters).
3. **Value syntax:** Up to 256 printable ASCII characters (`0x20` to `0x7E` excluding `,` and `=`).
4. **Length and truncation:** Vendors SHOULD propagate at least 512 characters. If truncation is required due to platform limits, whole entries must be dropped: entries larger than 128 characters are dropped first, followed by entries starting from the right (oldest entries).
5. **Update semantics:** Only **one** entry per key is allowed. When a tracing vendor updates its own entry or inserts a new one, the modified key MUST be moved to the beginning (left) of the list:
   > *"Modified keys MUST be moved to the beginning (left) of the list."*
6. **Coupling with traceparent:** `tracestate` has no independent lifecycle. If `traceparent` fails to parse, or if a service restarts the trace at an ingress boundary, `tracestate` MUST be discarded.

## W3C Baggage: application context across service boundaries

`tracestate` is strictly reserved for tracing platforms; application developers MUST NOT use it for business data. For application-level context, the W3C defined the **Baggage** specification (`baggage` header):

> *"The `baggage` header represents a set of user-defined properties associated with a distributed request. Libraries and platforms SHOULD propagate this header."*

Baggage passes key-value pairs (user tier, customer tenant ID, routing flags, synthetic test markers) from service to service across network boundaries without changing REST payload schemas or gRPC method signatures.

```http
baggage: userId=alice,tenantId=corp-42,tier=enterprise,region=eu-west-1;dc=fra
```

### Spec rules governing baggage

- **Header syntax:** Comma-separated list of `key=value` pairs with optional semicolon properties (`key=value;propKey=propVal`).
- **Encoding:** Keys are RFC 7230 tokens. Values use US-ASCII printable characters excluding whitespace, quotes, commas, semicolons, and backslashes. Any character outside this range (such as spaces or non-ASCII Unicode) MUST be percent-encoded (e.g. `userId=Am%C3%A9lie`).
- **Guaranteed limits:** A platform MUST propagate baggage if the string contains **64 list-members or less** and is **8192 bytes or less**.
- **Decoupled from tracing:** Baggage travels whether `traceparent` is present or absent, sampled or unsampled. It is an independent distributed context propagation mechanism.

## Tracestate vs Baggage: the architectural boundary

| Dimension | `tracestate` | `baggage` |
|---|---|---|
| **Spec** | W3C Trace Context (Level 1) | W3C Baggage |
| **Header** | `tracestate` | `baggage` |
| **Audience** | Tracing vendors and APM backends | Application business logic and middleware |
| **Content** | Opaque system tokens (`vendor=token`) | User/application properties (`tenantId=42`) |
| **Max items** | 32 members | 64 members (minimum requirement) |
| **Max size** | 512 bytes guaranteed minimum | 8192 bytes guaranteed minimum |
| **Lifecycle** | Tied to `traceparent`; deleted if trace restarts | Independent; preserved across trace restarts |
| **Position rule** | Mutated keys MUST move to head (left) | Ordering preserved; deduplication allowed |

## Baggage in Spring Boot 4.1 and Micrometer Tracing

In Spring Boot 4.1, Micrometer Tracing handles both `Baggage` propagation across network clients (`RestClient`, `WebClient`, `RestTemplate`) and in-process thread switching.

🔴 **Baggage does NOT automatically enter MDC logs or Span attributes.** By default, Micrometer Tracing ignores baggage for logging and tracing export to protect systems from high-cardinality explosions and security leaks. You must explicitly configure which baggage fields to propagate over the wire (`remote-fields`) and which to mirror into SLF4J MDC (`correlation.fields`).

### Configuration in application.properties

```properties
# Fields allowed to propagate over the network in HTTP/messaging headers
management.tracing.baggage.remote-fields=tenant-id,user-tier

# Fields copied into SLF4J MDC for log correlation
management.tracing.baggage.correlation.fields=tenant-id,user-tier

# Whether baggage updates in MDC automatically propagate downstream (default: true)
management.tracing.baggage.correlation.enabled=true
```

### Accessing baggage in Java application code

```java
package com.example.tracing.baggage;

import io.micrometer.tracing.Baggage;
import io.micrometer.tracing.BaggageManager;
import io.micrometer.tracing.Tracer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class OrderProcessingService {

    private static final Logger log = LoggerFactory.getLogger(OrderProcessingService.class);
    private final Tracer tracer;
    private final BaggageManager baggageManager;

    public OrderProcessingService(Tracer tracer, BaggageManager baggageManager) {
        this.tracer = tracer;
        this.baggageManager = baggageManager;
    }

    public void processOrder(String orderId) {
        // Read baggage received from upstream HTTP caller
        Baggage tenantBaggage = this.tracer.getBaggage("tenant-id");
        String tenantId = (tenantBaggage != null) ? tenantBaggage.get() : "default-tenant";

        log.info("Processing order {} for tenant {}", orderId, tenantId);

        // Mutate or create a new baggage field for downstream RPC calls
        try (Baggage tierBaggage = this.baggageManager.createBaggageInScope("user-tier", "enterprise")) {
            // Any RestClient or WebClient call within this scope automatically
            // serializes "baggage: user-tier=enterprise" in outbound headers
            callInventoryService(orderId);
        }
    }

    private void callInventoryService(String orderId) {
        log.debug("Invoking inventory check for order {}", orderId);
    }
}
```

## Gotchas

### Baggage exists in context but never appears in log lines
**Symptom.** Upstream sends `baggage: tenant-id=acme`, and `tracer.getBaggage("tenant-id").get()` returns `"acme"`, but SLF4J log lines output `[tenant-id=]` empty in structured JSON.  
**Cause.** Micrometer Tracing keeps `Baggage` in trace context but does not bind it to SLF4J MDC unless explicitly added to `correlation.fields`.  
**Fix.** Declare the field in `application.properties`:
```properties
management.tracing.baggage.correlation.fields=tenant-id
```

### Cardinality explosion from copying baggage into Micrometer meters
**Symptom.** After writing a custom Observation filter that copies all baggage entries into meter tags, Prometheus memory quadruples and the metrics collector times out.  
**Cause.** Baggage often carries high-cardinality IDs (`orderId=98234812`, `userId=usr_34891`). Metrics meters require bounded low-cardinality keys.  
**Fix.** Never blindly copy baggage to meter tags. Filter by strict allow-lists of low-cardinality enum values:
```java
package com.example.tracing.baggage;

import io.micrometer.observation.Observation;
import io.micrometer.observation.ObservationFilter;
import io.micrometer.tracing.BaggageManager;
import java.util.Set;
import org.springframework.stereotype.Component;

@Component
public class SafeBaggageTagFilter implements ObservationFilter {

    private static final Set<String> ALLOWED_METRIC_TAGS = Set.of("user-tier", "region");
    private final BaggageManager baggageManager;

    public SafeBaggageTagFilter(BaggageManager baggageManager) {
        this.baggageManager = baggageManager;
    }

    @Override
    public Observation.Context map(Observation.Context context) {
        for (String key : ALLOWED_METRIC_TAGS) {
            var baggage = this.baggageManager.getBaggage(key);
            if (baggage != null && baggage.get() != null) {
                context.addLowCardinalityKeyValue(io.micrometer.common.KeyValue.of(key, baggage.get()));
            }
        }
        return context;
    }
}
```

### Downstream reverse proxy returns HTTP 431 Request Header Fields Too Large
**Symptom.** Requests succeed in dev environments but fail in staging behind Nginx or Envoy with HTTP `431 Request Header Fields Too Large`.  
**Cause.** Microservices down the call tree keep appending baggage items. Because W3C baggage permits up to 8192 bytes, cumulative header sizes easily breach default proxy buffer limits (e.g. Nginx `client_header_buffer_size 1k`, Tomcat `maxHttpHeaderSize 8KB`).  
**Fix.** Audit baggage producers. Strip non-essential fields before external calls and prune expired context.

### Secret and token leakage over third-party HTTP calls
**Symptom.** API keys, session tokens, or customer email addresses attached to baggage leak into access logs of third-party payment gateways.  
**Cause.** Baggage is propagated unconditionally by auto-configured HTTP clients across all outbound endpoints if the key is listed in `remote-fields`.  
**Fix.** Never store credentials, JWTs, or PII in baggage. Restrict `remote-fields` to non-sensitive operational metadata.

## Interview questions

**★ Why does the W3C Trace Context specification define both `traceparent` and `tracestate`, rather than putting vendor state in `traceparent`?**  
`traceparent` is an immutable, fixed-width standard defining universal trace identity (version, 16-byte trace-id, 8-byte parent-id, 1-byte flags). If vendors inserted proprietary tokens into `traceparent`, length guarantees and parsing performance would collapse, and forward-compatibility would break. `tracestate` isolates vendor-specific opaque key-value pairs into a companion header with its own syntax and size limits, allowing distinct APM systems to coexist without corrupting the canonical trace graph.

**★ What is the fundamental operational difference between `tracestate` and W3C `baggage`?**  
`tracestate` is reserved exclusively for distributed tracing vendors to manage APM-specific routing, parentage, and graph positions; it is tightly coupled to `traceparent` and must be deleted if the trace is restarted. `baggage` is an application-level context mechanism intended for business and infrastructure metadata (tenant ID, request routing tags, user tiers). Baggage is independent of the tracing backend and persists across services whether tracing is enabled, disabled, sampled, or unsampled.

**★ Why does Spring Boot require distinct settings for `remote-fields` and `correlation.fields`?**  
Because network propagation and local logging serve different architectural purposes with different risks. `remote-fields` controls which baggage keys are serialized into outbound HTTP/messaging headers (governing network payload and cross-service boundaries). `correlation.fields` controls which baggage keys are injected into the local thread's SLF4J MDC (governing log records). Decoupling them allows a service to consume a remote header without polluting log records, or log a local attribute without transmitting it across external network boundaries.

**★ What happens to `tracestate` when an ingress gateway restarts a trace?**  
According to section 3.4 of the W3C Trace Context specification, when an ingress proxy or security boundary restarts a trace (`trace-id`, `parent-id`, and `trace-flags` are regenerated), the implementation SHOULD clear the incoming `tracestate`. Preserving incoming vendor state across a regenerated trace ID attaches orphaned metadata from an untrusted caller to a new trace graph, breaking correlation in the internal APM system.

**★ Why should high-cardinality baggage items never be converted to Micrometer meter tags?**  
In time-series monitoring systems like Prometheus, every unique combination of tag key-values creates a separate time-series stream stored in memory and indexed. High-cardinality values (such as order numbers, email addresses, or UUIDs) generate thousands or millions of concurrent series, causing exponential memory growth, slow dashboard queries, and JVM OutOfMemoryErrors. Baggage containing high-cardinality keys must remain in trace spans or structured logs, never in metric meter tags.

---

← [03b2 · Mutations and processing](03b2-traceparent-mutations-and-processing.md) · [Topic index](README.md) · Next → [03d · B3 and the other formats](03d-b3-and-the-other-formats.md)
