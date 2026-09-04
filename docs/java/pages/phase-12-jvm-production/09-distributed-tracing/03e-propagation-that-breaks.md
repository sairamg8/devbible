---
title: "Every way context propagation breaks in a JVM service is silent, plausible, and leaves work running under detached traces, uninstrumented executors, unpropagated message queues, or contaminated worker threads"
sidebar_label: "03e · Propagation that breaks"
sidebar_position: 9
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-03 against the **Micrometer Tracing 1.7.0 Reference** — *Context Propagation* and *TaskDecorator* ([docs.micrometer.io](https://docs.micrometer.io/tracing/reference/context-propagation.html)); **Spring Boot 4.1.1 reference** — *Task Execution and Scheduling → Context Propagation* ([docs.spring.io](https://docs.spring.io/spring-boot/4.1/reference/features/task-execution-and-scheduling.html)); and **Project Reactor 3.7 / Context Propagation 1.1** documentation.
> Target: **JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9 · Micrometer Tracing 1.7.0 · OpenTelemetry Java 1.62.0**.
> 🔴 **No sandbox run** — code and failure mechanisms verified against framework specifications.

**The defining characteristic of context propagation failure is that nothing ever crashes. The HTTP request returns 200 OK, the database transaction commits, the Kafka message processes, and the logs look normal. But in your distributed tracing UI, the request abruptly stops at an intermediate boundary, or downstream operations appear as orphaned root traces that cannot be correlated with the user who triggered them. In the JVM, context travels in thread-local storage; the moment work crosses a thread boundary without explicit capture and restoration—in an executor, a reactive operator, an async message consumer, or an unmanaged HTTP client—the trace silently severs.**

## The six failure archetypes

```
  Boundary Crossed               Failure Mechanism                       Symptom in UI
┌─────────────────────────┬───────────────────────────────────────────┬────────────────────────────────────────┐
│ Hand-rolled HTTP client │ Interceptor not registered on client      │ Trace ends; downstream creates new root│
│ Raw ThreadPoolExecutor  │ ThreadLocal not copied to worker thread   │ Async block vanishes from trace        │
│ Reused pool thread      │ Scope not closed; thread-local leaks      │ Trace combines unrelated user requests │
│ Message broker (Kafka)  │ Headers not extracted on message consume  │ Async pipeline splits into disconnected│
│ Batch message consumer  │ Multiple parents forced into single parent│ 499 traces lose correlation (need Link)│
│ Reactive pipeline       │ Thread switches across .publishOn()       │ TraceId disappears mid-stream in logs  │
└─────────────────────────┴───────────────────────────────────────────┴────────────────────────────────────────┘
```

## 1. Hand-rolled HTTP clients and missing interceptors

Spring Boot auto-configures tracing interceptors on **client builders**, not on concrete instances. When code constructs a client directly using `new`, the outgoing request carries no `traceparent`:

```java
// 🔴 BROKEN: Bypasses Spring Boot's auto-configured tracing interceptor
RestTemplate restTemplate = new RestTemplate();
restTemplate.getForObject("https://order-service/api/orders", OrderDto.class);

// ✅ CORRECT: Injected builder includes W3C propagation interceptor
@Bean
public RestClient orderServiceRestClient(RestClient.Builder builder) {
    return builder.baseUrl("https://order-service").build();
}
```

If you must manage a third-party client (e.g. Apache HttpClient, OkHttp), you must manually register Micrometer's `TraceChannelInterceptor` or OpenTelemetry's client interceptor.

## 2. Uninstrumented executors and CompletableFuture

`ThreadLocal` values do not transfer to worker threads in thread pools. Spring Boot 4.1 provides `spring.task.execution.propagate-context=true`, but that flag applies **only** to the auto-configured `ThreadPoolTaskExecutor`:

```properties
# Only decorates @Async and Spring's default TaskExecutor bean
spring.task.execution.propagate-context=true
```

If application code invokes `CompletableFuture.supplyAsync(() -> ...)` without specifying an executor, tasks run on `ForkJoinPool.commonPool()`, which has no context propagation.

### Manual capture and restore with ContextSnapshot

When using custom executors or `CompletableFuture`, capture context before task submission using Micrometer's `ContextSnapshot`:

```java
package com.example.tracing.propagation;

import io.micrometer.context.ContextSnapshot;
import io.micrometer.context.ContextSnapshotFactory;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.springframework.stereotype.Service;

@Service
public class AsyncOrderService {

    private final ExecutorService customPool = Executors.newFixedThreadPool(8);
    private final ContextSnapshotFactory snapshotFactory = ContextSnapshotFactory.builder().build();

    public CompletableFuture<String> processAsync(String orderId) {
        // Capture all thread-locals (TraceContext, MDC, Baggage) on calling thread
        ContextSnapshot snapshot = this.snapshotFactory.captureAll();

        // Wrap the task so it restores context on the worker thread and clears it on exit
        return CompletableFuture.supplyAsync(
            snapshot.wrap(() -> executeInternal(orderId)),
            this.customPool
        );
    }

    private String executeInternal(String orderId) {
        // ThreadLocal span and traceId are safely restored here
        return "processed-" + orderId;
    }
}
```

## 3. Stale ThreadLocal leaks: the contaminated thread pool

The most insidious tracing bug is not losing a trace—it is **polluting** an unrelated request. In a pooled thread environment (Tomcat worker threads, Netty event loops, shared executors), if a thread opens a tracing scope and fails to close it, that span context remains bound to the thread.

```java
// 🔴 CATASTROPHIC: Scope leak across pooled threads
public void handleRequest(TraceContext context) {
    tracer.withSpan(tracer.toSpan(context)); // Returns a Scope, but ignores it!
    // When this method returns, the thread returns to the pool with stale context.
    // The next completely unrelated customer request running on this thread
    // records spans under the PREVIOUS customer's traceId!
}

// ✅ CORRECT: Always use try-with-resources
public void handleRequestSafe(Span span) {
    try (Tracer.SpanInScope ws = this.tracer.withSpan(span)) {
        doBusinessLogic();
    } // ws.close() safely restores previous scope and clears thread-local
}
```

## 4. Message queues: the severed asynchronous hop

In HTTP RPC, the server creates a `SERVER` span that is a direct child of the caller's `CLIENT` span. In asynchronous messaging (Kafka, RabbitMQ, JMS), execution is decoupled:
1. Producer publishes a message (`PRODUCER` span) and writes `traceparent` into message headers.
2. The message sits in a topic partition for minutes or hours.
3. Consumer reads the message and processes it (`CONSUMER` span).

### The batch consumer trap: multiple parents require Span Links

When a Kafka listener consumes a batch of 500 records, each record was produced by a different user request with a different `traceId`.

🔴 **You cannot set 500 parents on one Consumer span.** A span can have at most **one** parent. If a consumer naively takes the first record's trace context as the parent of the batch span, 499 other traces are completely disconnected.

The OpenTelemetry and Micrometer pattern is to use **Span Links** (`Link`):
- Create the consumer batch span as a new root span.
- Add each record's incoming trace context as a `Link` on that span.
- Process individual records inside child spans linked to their respective parent records.

```java
package com.example.tracing.propagation;

import io.micrometer.tracing.Span;
import io.micrometer.tracing.Tracer;
import java.util.List;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Component
public class BatchOrderConsumer {

    private final Tracer tracer;

    public BatchOrderConsumer(Tracer tracer) {
        this.tracer = tracer;
    }

    @KafkaListener(topics = "orders", batch = "true")
    public void consumeBatch(List<ConsumerRecord<String, String>> records) {
        // Create an independent consumer span for batch execution
        Span batchSpan = this.tracer.nextSpan().name("kafka.consume.batch").start();
        try (Tracer.SpanInScope ws = this.tracer.withSpan(batchSpan)) {
            for (ConsumerRecord<String, String> record : records) {
                // Process each message within its own span, extracted from record headers
                processRecord(record);
            }
        } finally {
            batchSpan.end();
        }
    }

    private void processRecord(ConsumerRecord<String, String> record) {
        // Extract traceparent from record.headers() and process with individual span
    }
}
```

## 5. Reactive streams: Project Reactor context loss

In Spring WebFlux and Project Reactor, operations switch threads asynchronously across Netty worker loops. Because Reactor does not use thread-local state, tracing context stored in standard `ThreadLocal` variables drops across `.publishOn()` or `.subscribeOn()`.

In Spring Boot 4.1 with Reactor 3.7, automatic context propagation must be enabled at application startup:

```java
@Configuration
public class ReactiveTracingConfig {

    @PostConstruct
    public void setupReactiveTracing() {
        // Propagates Micrometer ContextSnapshot across Reactor operator boundaries
        reactor.core.publisher.Hooks.enableAutomaticContextPropagation();
    }
}
```

## Gotchas

### CompletableFuture.supplyAsync silently drops trace context
**Symptom.** Spans exist for controller and service layers, but database calls inside `CompletableFuture` appear under a new trace or vanish completely.  
**Cause.** `CompletableFuture.supplyAsync()` runs on the uninstrumented common ForkJoinPool, which does not inherit `ThreadLocal` context.  
**Fix.** Wrap tasks using `ContextSnapshotFactory.captureAll().wrap(...)` or pass a managed `ThreadPoolTaskExecutor`.

### Spring @Async methods lack trace IDs in logs
**Symptom.** Log entries inside `@Async` annotated methods output `[traceId=]` blank.  
**Cause.** `spring.task.execution.propagate-context` is not enabled, or a custom `Executor` bean is defined without a `TaskDecorator`.  
**Fix.** Set `spring.task.execution.propagate-context=true` or configure a `ContextPropagatingTaskDecorator`.

### Cross-request trace contamination on high-throughput services
**Symptom.** Under heavy load, traces contain spans from completely different customer accounts, and logs mix order IDs across requests.  
**Cause.** A library or custom filter opened a `Tracer.SpanInScope` without closing it in a `finally` block or try-with-resources. Reused pooled threads inherit the unclosed context.  
**Fix.** Audit all `withSpan()` and `createBaggageInScope()` invocations; guarantee close execution with try-with-resources.

### Batch Kafka consumers drop all traces except the first record
**Symptom.** Out of 100 messages processed in a batch, only the first transaction is linked to its upstream producer trace in the APM UI.  
**Cause.** Setting a single parent span on the batch execution loop.  
**Fix.** Model batch consumption with OpenTelemetry Span Links rather than hierarchical parent-child relationships.

## Interview questions

**★ Why do context propagation failures never raise runtime exceptions?**  
Because distributed tracing is designed as non-invasive, out-of-band observability infrastructure. Tracing frameworks treat missing context as a normal edge condition (e.g. an incoming request from an untracked external client), gracefully initializing a new root trace instead of interrupting business transactions. Consequently, propagation bugs manifest strictly as data degradation—detached waterfalls and broken correlation—never as 500 errors.

**★ How does Micrometer's `ContextSnapshot` solve thread handoffs in Java?**  
`ContextSnapshot` queries registered `ThreadLocalAccessor` implementations to capture current thread-local state (MDC, trace contexts, security principals) into an immutable snapshot object. When the task is executed on a worker thread, the snapshot's `wrap()` method restores those values into the worker thread's thread-locals, runs the task, and restores the worker thread's prior state upon completion, preventing thread contamination.

**★ What is the difference between a child span and a span link in asynchronous pipelines?**  
A child span represents a direct parent-child relationship where a causal operation initiated a sub-operation within a single trace. A span link (`Link`) establishes a loose causal relationship between spans that may belong to different traces or where an operation has multiple parents (such as a batch processor aggregating 500 records from 500 independent traces, or a fan-in pipeline).

**★ Why does `Hooks.enableAutomaticContextPropagation()` matter in Spring WebFlux?**  
Project Reactor schedules execution across thread boundaries non-deterministically using event loops. Standard `ThreadLocal` variables cannot follow reactive publisher chains. `enableAutomaticContextPropagation()` hooks into Reactor's operator lifecycle, automatically reading and writing context between Reactor's immutable `Context` and the executing thread's `ThreadLocal` storage whenever an operator switch occurs.

**★ What happens when an unhandled exception prevents a `SpanInScope` from closing?**  
The executing thread retains the span and trace context in its `ThreadLocal` map. If that thread belongs to a thread pool (like Tomcat's HTTP worker pool), it is returned to the pool while still pointing to the failed request's context. When the pool assigns that thread to handle a subsequent, unrelated request, any spans created before context extraction inherit the old trace ID, contaminating trace integrity and leaking user IDs in log files.

---

← [03d · B3 and other formats](03d-b3-and-the-other-formats.md) · [Topic index](README.md) · Next → [05 · Wiring in Spring Boot](05-wiring-it-in-spring-boot.md)
