---
title: "Spring Boot 4.1 auto-configures distributed tracing via Micrometer Tracing bridges and OTLP exporters, but tracing remains completely inert until an explicit bridge artifact is added to the build"
sidebar_label: "05 · Wiring in Spring Boot"
sidebar_position: 10
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-03 against the **Spring Boot 4.1.0 reference documentation** — *Actuator → Tracing* ([docs.spring.io](https://docs.spring.io/spring-boot/4.1/reference/actuator/tracing.html)); the **Micrometer Tracing 1.7.0 Reference Manual** ([docs.micrometer.io](https://docs.micrometer.io/tracing/reference/)); and the **OpenTelemetry Java Instrumentation release notes** ([github.com/opentelemetry/opentelemetry-java-instrumentation](https://github.com/opentelemetry/opentelemetry-java-instrumentation)).
> Target: **JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8 · Micrometer Tracing 1.7.0 · OpenTelemetry Java 1.62.0**.
> 🔴 **No sandbox run** — dependency coordinates and property defaults verified against Spring Boot 4.1 dependencies BOM and source configurations.

**Adding `spring-boot-starter-actuator` to a Spring Boot 4.1 application provides metrics and health endpoints, but distributed tracing remains completely dormant. Spring Boot separates the tracing API (`micrometer-tracing`) from the tracer implementation. Without an explicit tracer bridge on the classpath—either OpenTelemetry or Brave—and an exporter to transmit completed spans to a collector, no trace IDs are generated, no spans are recorded, and HTTP headers are forwarded without modification. Understanding the dependency triad (Actuator, Bridge, Exporter), what Spring auto-instruments out of the box, and how Micrometer Tracing contrasts with the standalone OpenTelemetry Java agent is the foundation of production JVM observability.**

## The dependency triad

To enable distributed tracing in Spring Boot 4.1, your build requires three coordinated components:

```
┌─────────────────────────────────┐
│ spring-boot-starter-actuator    │ ──> Provides ObservationRegistry & auto-configuration
└─────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│ micrometer-tracing-bridge-otel  │ ──> Implements Tracer API via OpenTelemetry SDK
│   (or bridge-brave)             │     (alternative: micrometer-tracing-bridge-brave for Zipkin)
└─────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│ opentelemetry-exporter-otlp     │ ──> Serializes spans via OTLP (HTTP/protobuf or gRPC)
└─────────────────────────────────┘
```

### Maven dependencies for OpenTelemetry and OTLP

```xml
<dependencies>
    <!-- 1. Core Actuator for Observation auto-configuration -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-actuator</artifactId>
    </dependency>

    <!-- 2. Micrometer Tracing OpenTelemetry bridge -->
    <dependency>
        <groupId>io.micrometer</groupId>
        <artifactId>micrometer-tracing-bridge-otel</artifactId>
    </dependency>

    <!-- 3. OTLP exporter for OpenTelemetry Collector / Tempo / Jaeger -->
    <dependency>
        <groupId>io.opentelemetry</groupId>
        <artifactId>opentelemetry-exporter-otlp</artifactId>
    </dependency>
</dependencies>
```

*(For Brave/Zipkin fleets, replace the bridge with `io.micrometer:micrometer-tracing-bridge-brave` and add `io.zipkin.reporter2:zipkin-reporter-brave`.)*

## What auto-instruments itself in Spring Boot 4.1

Once the bridge and exporter are present, Spring Boot's `ObservationAutoConfiguration` hooks into the application context:

1. **Inbound HTTP:** Spring MVC (`DispatcherServlet`) and Spring WebFlux filters automatically create `SERVER` spans, extract incoming `traceparent` headers, and set span status based on HTTP response codes.
2. **Outbound HTTP:** Injected client builders—`RestClient.Builder`, `WebClient.Builder`, and `RestTemplateBuilder`—automatically register client request interceptors that inject `traceparent` and create `CLIENT` spans.
3. **Database (JDBC):** Raw `DataSource` beans are **not** traced by default. Tracing SQL queries requires adding `net.ttddyy.observation:datasource-micrometer-spring-boot-starter` or using an R2DBC observation wrapper.
4. **Messaging:** Spring Kafka and Spring RabbitMQ provide opt-in observation:
   ```properties
   # Enables Producer and Consumer spans for Spring Kafka
   spring.kafka.template.observation-enabled=true
   spring.kafka.listener.observation-enabled=true
   ```
5. **Scheduled tasks:** `@Scheduled` execution time is tracked, but child trace correlation requires explicit `ObservationRegistry` wrapping.

## Configuration properties in application.properties

```properties
# Application identity attached as "service.name" on every span
spring.application.name=order-service

# 🔴 Default sampling probability in Spring Boot is 0.10 (10%)
# For staging or development, set to 1.0 (100%) to see every trace
management.tracing.sampling.probability=0.10

# OTLP trace exporter endpoint (defaults to http://localhost:4318/v1/traces)
management.otlp.tracing.endpoint=http://otel-collector.monitoring.svc:4318/v1/traces

# Transport protocol: "http" (default in Boot 4.1) or "grpc"
management.otlp.tracing.transport=http

# Include traceId and spanId in SLF4J MDC log lines
logging.pattern.level=%5p [${spring.application.name:},%X{traceId:-},%X{spanId:-}]
```

## The two ways in Java: Micrometer Tracing vs OTel Java Agent

In enterprise Java environments, teams face a choice: use Spring Boot's built-in Micrometer Tracing, or attach the external `opentelemetry-javaagent.jar` at JVM startup.

```
┌─────────────────────────────────┬─────────────────────────────────┐
│ Micrometer Tracing (In-Process) │ OpenTelemetry Java Agent (-jar) │
├─────────────────────────────────┼─────────────────────────────────┤
│ Native Spring Boot lifecycle    │ Zero-code bytecode modification │
│ Zero runtime reflection penalty │ Instruments 100+ 3rd-party libs │
│ GraalVM Native Image compatible │ Incompatible with Native Image  │
│ Only instruments Spring beans   │ Instruments raw unmanaged calls │
│ JDK 25: No dynamic agent flags  │ JDK 25: Requires JVM agent flag │
└─────────────────────────────────┴─────────────────────────────────┘
```

### The JDK 25 Java Agent constraint
On **JDK 25**, the JVM enforces strict boundaries around dynamic agent loading (JEP 451). While statically attaching an agent via command-line (`-javaagent:opentelemetry-javaagent.jar`) is supported, ByteBuddy bytecode transformations must support JDK 25 class file versions. Micrometer Tracing avoids bytecode rewriting entirely by instrumenting through standard Spring bean decorators and delegates, ensuring forward compatibility.

```java
package com.example.tracing.wiring;

import io.micrometer.observation.ObservationRegistry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

@Configuration
public class TracingClientConfiguration {

    private static final Logger log = LoggerFactory.getLogger(TracingClientConfiguration.class);

    @Bean
    public RestClient inventoryClient(RestClient.Builder builder) {
        // Builder automatically attaches ObservationClientHttpRequestInterceptor
        return builder.baseUrl("https://inventory.internal").build();
    }

    @Bean
    public CommandLineRunner verifyTracingSetup(ObservationRegistry registry) {
        return args -> {
            log.info("Tracing initialized with ObservationRegistry: {}", registry.getClass().getSimpleName());
        };
    }
}
```

## Gotchas

### Actuator starter present but zero spans exported
**Symptom.** Actuator endpoints work and Prometheus metrics scrape successfully, but no trace data ever reaches Jaeger or Tempo.  
**Cause.** `spring-boot-starter-actuator` contains no tracer implementation. Without `micrometer-tracing-bridge-otel` (or brave) and an exporter, `Tracer` beans are never created.  
**Fix.** Add `micrometer-tracing-bridge-otel` and `opentelemetry-exporter-otlp` to your build file.

### 90% of requests missing in development testing
**Symptom.** Developers testing an endpoint notice that 9 out of 10 requests produce no traces in the APM collector.  
**Cause.** Spring Boot defaults `management.tracing.sampling.probability` to `0.10` (10%).  
**Fix.** In `application-dev.properties`, override the sampler to 100%:
```properties
management.tracing.sampling.probability=1.0
```

### OTLP connection refused on default gRPC port
**Symptom.** Application fails to send spans with `ConnectException: Connection refused: localhost/127.0.0.1:4317`.  
**Cause.** OpenTelemetry collector exposes HTTP on port `4318` and gRPC on port `4317`. Spring Boot 4.1 defaults to HTTP transport (`http://localhost:4318/v1/traces`). If an older deployment sets endpoint port to `4317` without changing `transport=grpc`, communication fails.  
**Fix.** Align endpoint and transport:
```properties
management.otlp.tracing.endpoint=http://otel-collector:4318/v1/traces
management.otlp.tracing.transport=http
```

### SQL statements absent from trace waterfalls
**Symptom.** Traces show HTTP controller execution and downstream REST calls, but zero database spans appear despite heavy JPA/Hibernate activity.  
**Cause.** Spring Boot does not wrap JDBC `DataSource` beans for tracing by default due to potential JDBC proxy performance overhead.  
**Fix.** Include `net.ttddyy.observation:datasource-micrometer-spring-boot-starter` in dependencies.

## Interview questions

**★ Why does adding `spring-boot-starter-actuator` not enable distributed tracing by default?**  
Spring Boot separates the vendor-neutral tracing abstraction (`micrometer-tracing`) from the concrete tracer runtime (`OpenTelemetry` or `Brave`) and the transport layer (`OTLP` or `Zipkin`). This design prevents tying your application to a specific APM vendor. Without an explicit bridge artifact on the classpath, Spring Boot disables tracing auto-configuration to avoid runtime overhead and memory allocations.

**★ What is the default tracing sampling probability in Spring Boot, and why?**  
The default is `0.10` (10%). In production microservice architectures processing thousands of requests per second, recording 100% of traces generates massive network bandwidth, collector CPU pressure, and cloud storage bills. A 10% head-sample rate provides statistically significant visibility into p95/p99 latencies and error rates while reducing observability infrastructure costs by 90%.

**★ Compare Micrometer Tracing with the OpenTelemetry Java Agent.**  
Micrometer Tracing is an SDK-level framework library built directly into Spring Boot. It uses standard proxies, decorators, and delegates, requiring zero bytecode manipulation. It supports GraalVM Native Image and executes with minimal startup penalty. The OpenTelemetry Java Agent runs as an external JVM agent (`-javaagent`), instrumenting class bytecode at load time. The agent provides broader out-of-the-box coverage for unmanaged third-party libraries, but increases JVM startup time and memory footprint, cannot run in GraalVM native binaries, and requires explicit dynamic agent permissions on modern JDKs.

**★ How does Spring Boot 4.1's OTLP exporter communicate with telemetry backends?**  
Spring Boot 4.1 uses OpenTelemetry's OTLP exporter, which by default sends telemetry over HTTP/protobuf (`management.otlp.tracing.transport=http`) to the `/v1/traces` endpoint (default: `http://localhost:4318/v1/traces`). It can also be configured to use binary gRPC on port 4317. Spans are batched in memory and flushed asynchronously to prevent blocking application worker threads.

**★ Why do custom RestTemplate instances fail to propagate traces in Spring Boot?**  
Tracing propagation across HTTP calls relies on client request interceptors (`ObservationClientHttpRequestInterceptor`) that extract trace context from the local thread and inject W3C `traceparent` headers into the outbound HTTP request. Spring Boot auto-configures these interceptors on `RestTemplateBuilder`, `RestClient.Builder`, and `WebClient.Builder`. Creating an instance via `new RestTemplate()` bypasses Spring's bean post-processors and builders, producing an uninstrumented client.

---

← [03e · Propagation that breaks](03e-propagation-that-breaks.md) · [Topic index](README.md) · Next → [05b · Custom spans and annotations](05b-custom-spans-and-annotations.md)
