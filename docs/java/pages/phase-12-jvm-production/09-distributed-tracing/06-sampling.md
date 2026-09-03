---
title: "Head sampling decides trace retention at the root of the call tree to control network and storage costs, and ParentBased delegation guarantees that downstream services record consistent waterfalls rather than fragmented span islands"
sidebar_label: "06 · Sampling"
sidebar_position: 12
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-03 against the **OpenTelemetry Specification — Samplers** ([opentelemetry.io](https://opentelemetry.io/docs/specs/otel/trace/sdk/#sampler)); the **W3C Trace Context Recommendation** — section 3.2.4 *Trace-flags* ([w3.org](https://www.w3.org/TR/trace-context/)); and **Spring Boot 4.1.0 reference** — *Actuator → Tracing → Sampling* ([docs.spring.io](https://docs.spring.io/spring-boot/4.1/reference/actuator/tracing.html)).
> Target: **JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8 · Micrometer Tracing 1.7.0 · OpenTelemetry Java 1.62.0**.
> 🔴 **No sandbox run** — algorithms, probability bitmask rules, and property configurations verified against OpenTelemetry SDK and Spring Boot sources.

**At 10,000 requests per second across a 15-service microservice graph, recording every single span generates 150,000 spans every second—hundreds of gigabytes of network telemetry and massive cloud storage bills. Distributed tracing cannot scale without sampling. But sampling cannot be applied arbitrarily at every service hop: if three sequential services each independently sample at 10%, only 0.1% (one in a thousand) of end-to-end traces survive intact. Modern tracing solves this using head sampling governed by `ParentBased` delegation: the root ingress service makes the sampling decision once, writes it into the W3C `traceparent` flags, and downstream services obey that decision.**

## The sampling taxonomy: Head vs Tail

```
┌──────────────────────────────────────┬──────────────────────────────────────┐
│ Head Sampling (In-Process)           │ Tail Sampling (Collector-Level)      │
├──────────────────────────────────────┼──────────────────────────────────────┤
│ Evaluated at root span creation      │ Evaluated after full trace finishes  │
│ Zero network/memory waste on drops   │ Buffers all spans in collector RAM   │
│ Blind to final latency or errors     │ Retains 100% of errors & slow calls  │
│ Configured via Spring Boot properties│ Configured in OpenTelemetry Collector│
└──────────────────────────────────────┴──────────────────────────────────────┘
```

Head sampling happens in the application process before work begins. Its fundamental limitation is **blindness**: the sampler must decide whether to record the trace before it knows whether the request will succeed, throw a 500 error, or suffer a 10-second database timeout. Tail sampling (covered in [06b](06b-the-trace-you-needed-was-not-sampled.md)) solves this at the collector layer.

## The OpenTelemetry head samplers

OpenTelemetry provides four standard sampling strategies:

```
                      Parent context present?
                               │
               ┌───────────────┴───────────────┐
               ▼                               ▼
              YES                              NO
               │                               │
        Check Trace-Flags               Evaluate Root Sampler:
               │                        - TraceIdRatioBased(p)
      ┌────────┴────────┐               - AlwaysOn (1.0)
      ▼                 ▼               - AlwaysOff (0.0)
  Flag = 01         Flag = 00
      │                 │
    SAMPLE          DROP SPAN
 (Downstream       (Downstream
   records)          suppressed)
```

### 1. `AlwaysOn` and `AlwaysOff`
- `AlwaysOn`: Samples 100% of traces. Essential for local development and staging environments.
- `AlwaysOff`: Samples 0% of root traces. Useful for test environments or services experiencing catastrophic collector outages.

### 2. `TraceIdRatioBased(probability)`
Samples a fixed percentage (e.g. `0.10` for 10%) of root traces deterministically.
- It computes a numerical hash from the 128-bit `trace-id`.
- If the normalized value is strictly less than the probability threshold, the span is sampled.
- 🔴 **Requirement:** Trace IDs must be uniformly random. If a custom ID generator creates sequential or clustered IDs, ratio sampling skews severely.

### 3. `ParentBased(rootSampler)` — The required production standard
A composite wrapper that enforces trace coherence across distributed hops:

| Incoming Context | Condition | Action Taken |
|---|---|---|
| **Root (No parent)** | Request originated at this service | Delegates to `rootSampler` (e.g. 10% ratio) |
| **Remote Parent Sampled** | Inbound `traceparent` flag has `01` | **Always Sample** (continues existing trace) |
| **Remote Parent Not Sampled** | Inbound `traceparent` flag has `00` | **Do Not Sample** (honors caller drop) |
| **Local Parent Sampled** | In-process child span created | Inherits parent's sampled state |

Without `ParentBased`, every hop rolls its own dice. If Service A calls Service B calls Service C, and all three run independent 10% ratio samplers:
$$\text{Probability of complete trace} = 0.10 \times 0.10 \times 0.10 = 0.001 \quad (0.1\%)$$

99.9% of your traces become fragmented orphan spans. `ParentBased` guarantees that if Service A chooses to sample, Services B and C record their child spans unconditionally.

## Configuring sampling in Spring Boot 4.1

Spring Boot 4.1 auto-configures a `ParentBased` sampler wrapping a `TraceIdRatioBased` sampler when an OpenTelemetry bridge is present:

```properties
# Pinned to 10% sampling probability by default in Spring Boot
management.tracing.sampling.probability=0.10
```

### Providing a custom Sampler bean

For advanced rules (such as 100% sampling on `/api/checkout` and 1% on `/health`), register a custom `Sampler` bean:

```java
package com.example.tracing.sampling;

import io.opentelemetry.api.common.AttributeKey;
import io.opentelemetry.api.trace.TraceState;
import io.opentelemetry.sdk.trace.samplers.Sampler;
import io.opentelemetry.sdk.trace.samplers.SamplingResult;
import java.util.List;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class CustomSamplingConfiguration {

    @Bean
    public Sampler customParentBasedSampler() {
        Sampler rootRuleSampler = (context, traceId, name, spanKind, attributes, parentLinks) -> {
            // Check span name or attributes present at span creation
            if (name.contains("checkout") || name.contains("payment")) {
                return SamplingResult.recordAndSample();
            }
            // Fall back to 5% baseline sampling for general traffic
            return Sampler.traceIdRatioBased(0.05)
                .shouldSample(context, traceId, name, spanKind, attributes, parentLinks);
        };

        // Wrap in ParentBased to ensure downstream continuity
        return Sampler.parentBased(rootRuleSampler);
    }
}
```

## Gotchas

### Downstream service overrides upstream sampling decision
**Symptom.** Upstream gateway samples a request, but the database and worker spans in a downstream service are missing from the trace.  
**Cause.** The downstream service configured a raw `TraceIdRatioBased` sampler bean instead of wrapping it in `Sampler.parentBased(...)`, ignoring the inbound `01` flag.  
**Fix.** Always wrap custom samplers in `Sampler.parentBased()`.

### Calculating error rates or QPS from sampled trace counts
**Symptom.** Monitoring dashboard shows 50 requests per minute and 2 errors, but customer support reports hundreds of failed checkouts.  
**Cause.** Computing request rates or error percentages by counting exported spans under a 10% sampling rate.  
**Fix.** Use Micrometer metrics (`http.server.requests`) for throughput and error rates. Metrics record 100% of requests; traces explain individual examples.

### Adding span attributes after creation to influence samplers
**Symptom.** Custom sampler checks `attributes.get(AttributeKey.stringKey("customer.tier"))`, but the attribute is always `null` and the span is never sampled.  
**Cause.** Head samplers execute synchronously during `tracer.spanBuilder().start()`. Attributes added via `span.setAttribute()` inside the method body run *after* the sampling decision is locked.  
**Fix.** Pass attributes into the builder *before* starting the span, or propagate the value via W3C Baggage.

### Sequential trace IDs breaking ratio distribution
**Symptom.** A 10% ratio sampler records 100% of traces during one minute, then 0% for the next nine minutes.  
**Cause.** A custom ID generator used incremental counters or timestamps instead of a cryptographically uniform random generator.  
**Fix.** Use standard W3C 128-bit random ID generators (`RandomIdGenerator`).

## Interview questions

**★ What is the difference between head sampling and tail sampling?**  
Head sampling makes the sampling decision at the root ingress of a trace (when the initial span starts), using static probabilities or attributes available at creation time; unsampled spans are discarded immediately, saving network bandwidth and collector memory, but rare errors or unexpected latency spikes may be lost. Tail sampling buffers all spans across the entire distributed request at an intermediate collector, making the sampling decision after the trace finishes; it guarantees capture of 100% of errors and slow requests, but requires collector memory and higher network transport.

**★ Why is `ParentBased` sampling mandatory in distributed microservices?**  
If downstream services use independent probabilistic sampling without considering parentage, the probability of capturing an end-to-end trace drops exponentially with every network hop (e.g. $0.1^3 = 0.001$). `ParentBased` sampling ensures that if the root service decides to sample a request, all downstream services respect the incoming `traceparent` sampled flag (`01`) and record their respective child spans, ensuring unbroken waterfalls.

**★ How does `TraceIdRatioBased` determine whether a trace is sampled?**  
The sampler extracts the lower 64 bits of the 128-bit `trace-id` (an unsigned 64-bit integer), normalizes it against the maximum unsigned 64-bit value ($2^{64}-1$) to produce a ratio between `0.0` and `1.0`, and compares it to the configured sampling probability. If the normalized value is strictly less than the configured ratio, the trace is sampled. Because the decision is a mathematical function of the trace ID, any service evaluating the same trace ID arrives at the identical decision.

**★ What happens if an attribute used for a sampling decision is added after `span.start()`?**  
The attribute has zero effect on the sampling decision. OpenTelemetry head samplers evaluate `shouldSample()` once, before the span is instantiated. Attributes added after span creation (via `span.setAttribute()`) are stored on the span if sampled, but cannot retroactively change an unsampled decision.

**★ Why should business metrics never be derived from distributed tracing spans?**  
Head sampling discards a significant percentage of spans (e.g. 90% under Boot's default 10% rate). Deriving business counts (orders placed, payments processed) or SLA error rates from sampled spans produces inaccurate, sub-sampled estimates with high statistical variance. Metrics must be captured via dedicated counters and timers that record 100% of events, using traces solely for root-cause diagnosis.

---

← [05b · Custom spans and annotations](05b-custom-spans-and-annotations.md) · **Topic index** *(not written yet)* · Next → [06b · Tail sampling](06b-the-trace-you-needed-was-not-sampled.md)
