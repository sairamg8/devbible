---
title: "Creating custom spans and decorating them with attributes and events turns black-box application logic into actionable traces, but reckless span creation adds memory pressure and over-instrumentation noise"
sidebar_label: "05b · Custom spans and annotations"
sidebar_position: 11
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-03 against the **Micrometer Observation 1.17.0 documentation** ([docs.micrometer.io](https://docs.micrometer.io/micrometer/reference/observation.html)); **Micrometer Tracing 1.7.0 Reference** — *Creating Spans manually* ([docs.micrometer.io](https://docs.micrometer.io/tracing/reference/manual-span-creation.html)); and **OpenTelemetry Semantic Conventions 1.30** ([opentelemetry.io](https://opentelemetry.io/docs/specs/semconv/)).
> Target: **JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9 · Micrometer Tracing 1.7.0 · OpenTelemetry Java 1.62.0**.
> 🔴 **No sandbox run** — APIs and aspect behaviors verified against upstream source definitions.

**Framework auto-instrumentation provides boundary visibility: the moment an HTTP request reaches a controller, the moment a database query executes, and the moment an outbound REST call leaves the process. But complex workflows—order validation, cryptographic signing, PDF generation, or batch calculation—often show up in trace waterfalls as an opaque five-second gap between two database calls. Custom instrumentation fills this gap. In modern Spring Boot, you do this through Micrometer's dual-purpose `Observation` API, declarative `@Observed` annotations, or direct `Tracer` span management. The art of custom instrumentation is restraint: distributed tracing is not a profiler, and turning every private method into a span destroys tracing performance.**

## The decision rule: when does code earn a span?

Before creating a span, ask what question it answers at 03:00 during an outage:

```
        Is it a distinct business phase or I/O boundary?
                         │
         ┌───────────────┴───────────────┐
         ▼                               ▼
        YES                              NO
         │                               │
Does it take >1ms or cross           Is it a point-in-time milestone
   a thread/network boundary?        within an existing operation?
         │                               │
   ┌─────┴─────┐                   ┌─────┴─────┐
   ▼           ▼                   ▼           ▼
  YES          NO                 YES          NO
   │           │                   │           │
Create a    Do not create       Add a Span    Do nothing; let
CHILD SPAN   a span; use JFR     EVENT         profilers measure CPU
```

🔴 **Do not use spans to profile method execution time.** That is what JFR, Mission Control, and async-profiler exist for. A span costs heap allocation, context propagation, timing capture, and network egress serialization. Creating 5,000 sub-millisecond spans in an in-memory loop will spike JVM garbage collection and overwhelm your APM collector.

## Approach 1: Declarative instrumentation with `@Observed`

Spring Boot 4.1 promotes the Micrometer Observation API as the standard abstraction. Decorating a bean method with `@Observed` automatically creates **both** a metric timer (`http.server.requests`-style meter) and a tracing span.

### 1. Register the Aspect bean
`@Observed` requires an `ObservedAspect` bean in your application configuration:

```java
package com.example.tracing.custom;

import io.micrometer.observation.ObservationRegistry;
import io.micrometer.observation.aop.ObservedAspect;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class ObservationConfig {

    @Bean
    public ObservedAspect observedAspect(ObservationRegistry observationRegistry) {
        return new ObservedAspect(observationRegistry);
    }
}
```

### 2. Annotate the service method

```java
package com.example.tracing.custom;

import io.micrometer.observation.annotation.Observed;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class FraudCheckService {

    private static final Logger log = LoggerFactory.getLogger(FraudCheckService.class);

    @Observed(name = "fraud.evaluation",
              contextualName = "evaluate-fraud-risk",
              lowCardinalityKeyValues = {"risk.tier", "tier-1"})
    public boolean evaluateRisk(String accountId, long amountCents) {
        log.info("Evaluating risk for account {}", accountId);
        // Business logic executing inside child span "evaluate-fraud-risk"
        return amountCents < 100_000L;
    }
}
```

## Approach 2: Programmatic Observation API

When logic is dynamic, programmatic `Observation` provides full type-safe control over metrics, tags, and lifecycle:

```java
package com.example.tracing.custom;

import io.micrometer.observation.Observation;
import io.micrometer.observation.ObservationRegistry;
import org.springframework.stereotype.Service;

@Service
public class DocumentGenerationService {

    private final ObservationRegistry registry;

    public DocumentGenerationService(ObservationRegistry registry) {
        this.registry = registry;
    }

    public byte[] generateInvoicePdf(String invoiceId, String customerTier) {
        return Observation.createNotStarted("invoice.render", this.registry)
            .contextualName("render-invoice-pdf")
            .lowCardinalityKeyValue("customer.tier", customerTier)
            .highCardinalityKeyValue("invoice.id", invoiceId)
            .observe(() -> {
                // Operation executes within span; exceptions automatically recorded
                return renderPdfInternal(invoiceId);
            });
    }

    private byte[] renderPdfInternal(String invoiceId) {
        return new byte[0]; // rendering logic
    }
}
```

## Approach 3: Low-level Tracer API for span events and attributes

When you do not want metric timers created and need direct access to OpenTelemetry semantics:

```java
package com.example.tracing.custom;

import io.micrometer.tracing.Span;
import io.micrometer.tracing.Tracer;
import org.springframework.stereotype.Service;

@Service
public class PaymentProcessingService {

    private final Tracer tracer;

    public PaymentProcessingService(Tracer tracer) {
        this.tracer = tracer;
    }

    public void processPayment(String transactionId, long amount) {
        Span childSpan = this.tracer.nextSpan()
            .name("payment.settlement")
            .tag("payment.transaction_id", transactionId)
            .tag("payment.currency", "EUR")
            .start();

        try (Tracer.SpanInScope ws = this.tracer.withSpan(childSpan)) {
            // Span Event: timestamped milestone within the span (zero duration)
            childSpan.event("fraud_check_passed");

            executeSettlement(transactionId, amount);

            childSpan.event("ledger_updated");
        } catch (Exception ex) {
            childSpan.error(ex); // Marks span status as ERROR and attaches exception
            throw ex;
        } finally {
            childSpan.end(); // 🔴 MUST be called to stop clock and export
        }
    }

    private void executeSettlement(String txId, long amount) {}
}
```

## Span attributes vs span events: the structural rule

| Capability | Span Attribute (Tag) | Span Event (Annotation) |
|---|---|---|
| **What it represents** | Property of the entire operation | Instantaneous point-in-time occurrence |
| **Duration** | Spans the entire operation lifetime | Zero duration (timestamped moment) |
| **Indexing** | Indexed for search/filtering in APM | Attached to span timeline; rarely indexed |
| **Examples** | `http.status_code=200`, `user.id=42` | `cache.miss`, `retry.attempt_2`, `lock.acquired` |
| **Cardinality rule** | Must be bounded; avoid unbounded PII | Free-form details within single trace |

## Gotchas

### @Observed does nothing when called from the same class (`this.method()`)
**Symptom.** You added `@Observed` to a private or helper method, but neither spans nor metric timers are recorded.  
**Cause.** Spring AOP relies on proxy delegates. Direct self-invocation (`this.helperMethod()`) bypasses the proxy aspect.  
**Fix.** Extract the logic to a separate Spring `@Service` bean, or use programmatic `Observation.createNotStarted()`.

### Missing `ObservedAspect` bean silently ignores `@Observed`
**Symptom.** Code builds cleanly with `@Observed`, but no observations or spans are emitted at runtime.  
**Cause.** Spring Boot 4.1 does not auto-configure the `ObservedAspect` bean automatically.  
**Fix.** Define an `@Bean public ObservedAspect observedAspect(ObservationRegistry r)` in configuration.

### Forgetting `span.end()` in manual instrumentation
**Symptom.** Custom spans never show up in Jaeger or Tempo, and thread memory slowly leaks over time.  
**Cause.** Manual spans are not recorded or queued for export until `span.end()` is invoked. If an exception bypasses `end()`, the span vanishes.  
**Fix.** Always place `span.end()` in a `finally` block or use `observation.observe()`.

### Creating thousands of sub-millisecond spans in a loop
**Symptom.** High GC pause times, collector timeouts, and span export buffer overflow warnings (`Spans dropped: buffer full`).  
**Cause.** Iterating over a collection of 10,000 items and opening a span for each calculation.  
**Fix.** Instrument the entire batch operation as one span; record milestones or failures using span events or attributes.

## Interview questions

**★ How does Micrometer's `Observation` API unify metrics and distributed tracing?**  
Prior to Micrometer Observation, developers instrumented code twice: once with `Timer.record()` for Prometheus metrics and again with `tracer.nextSpan()` for distributed tracing. The `Observation` abstraction provides a single API: when an observation starts and stops, registered `ObservationHandler` implementations react. The metric handler updates timers and counters, while the tracing handler creates, decorates, and ends tracing spans.

**★ Why does calling an `@Observed` method from within the same class fail to produce a span?**  
Spring's declarative annotations (`@Observed`, `@Transactional`, `@Async`) operate via dynamic AOP proxies. When an external caller invokes a method on an injected Spring bean, the call passes through the proxy interceptor where the aspect opens the span. An internal method call via `this.` invokes the target instance directly, completely bypassing the proxy and rendering the annotation inert.

**★ When should you use a Span Event instead of a child Span?**  
A child span should be reserved for operations that have measurable duration and represent a distinct logical or I/O boundary. If you want to record an instantaneous milestone—such as a cache miss, an optimistic lock retry attempt, or the arrival of a webhook—creating a sub-millisecond span creates unnecessary overhead. A Span Event attaches a timestamped marker directly to the active span without increasing tree depth or span count.

**★ What is the difference between high-cardinality and low-cardinality tags in Micrometer Observation?**  
Low-cardinality tags have bounded, predictable values (e.g. `http.status_code`, `payment.method`); they are attached to **both** metrics meters and tracing spans. High-cardinality tags have unbounded values (e.g. `user.id`, `order.uuid`, `ip.address`); they are attached **only** to tracing spans and suppressed from metric meters to prevent destroying the metrics backend's time-series index.

**★ What happens to a manually created span if an exception is thrown before `span.end()`?**  
The span clock never stops, the span is never exported to the telemetry collector, and the span context remains unclosed. If the code opened a `Tracer.SpanInScope` without try-with-resources, the thread retains the unclosed context, contaminating subsequent requests. Manual tracing must always follow the `try (SpanInScope ws) { ... } catch (ex) { span.error(ex); throw ex; } finally { span.end(); }` contract.

---

← [05 · Wiring in Spring Boot](05-wiring-it-in-spring-boot.md) · [Topic index](README.md) · Next → [06 · Sampling](06-sampling.md)
