---
title: "Propagation is two separate mechanisms wearing one name — carrying context across threads inside a process, and serialising it into headers between processes — and almost every broken trace is a failure of the first one, not the second"
sidebar_label: "03 · Context propagation"
sidebar_position: 4
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-01 against the **OpenTelemetry "Traces" concept page**, section *Context
> Propagation* ([opentelemetry.io](https://opentelemetry.io/docs/concepts/signals/traces/)), the
> **Micrometer Context Propagation reference**
> ([github.com/micrometer-metrics/context-propagation](https://github.com/micrometer-metrics/context-propagation/blob/main/docs/modules/ROOT/pages/purpose.adoc)),
> the **Micrometer Tracing 1.7 glossary** and *Configuring with Micrometer Observation*
> ([docs.micrometer.io](https://docs.micrometer.io/tracing/reference/configuring.html)), and the
> **Spring Boot 4.1 reference — Actuator · Tracing and Observability**
> ([docs.spring.io](https://docs.spring.io/spring-boot/4.1/reference/actuator/tracing.html)).
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8 · Micrometer 1.17.0 / Micrometer Tracing
> 1.7.0 · OpenTelemetry Java 1.62.0.

**"Context propagation" is used for two jobs that share nothing but a word. In-process
propagation is the problem of a `ThreadLocal` surviving a hop onto another thread. Wire
propagation is the problem of turning four fields into an HTTP header and back. The second one
is a solved, standardised, boring problem. The first one is where your traces actually break,
and it breaks silently.**

## The definition, and what it hides

OpenTelemetry:

> *"Context Propagation is the core concept that enables Distributed Tracing. With Context
> Propagation, Spans can be correlated with each other and assembled into a trace, regardless of
> where Spans are generated."*

Micrometer Tracing's glossary is more explicit that there are two boundaries:

> *"**Tracing context**: For distributed tracing to work, the tracing context (trace identifier,
> span identifier, and so on) must be propagated through the process (for example, over threads)
> and over the network."*

🔴 **"through the process (for example, over threads) *and* over the network."** Two mechanisms.
This page covers both and the split; [03b](03b-the-traceparent-header.md) covers the wire format
in detail and [03e](03e-propagation-that-breaks.md) covers every way the in-process half fails.

## Mechanism 1 · in-process, and why it is a `ThreadLocal`

Nothing in Java passes an implicit parameter down a call stack. So every tracing library stores
the current span in a thread-local, and "the current span" means "the span in the thread-local
of the thread you are on right now".

That gives you the property you want — code five frames deep can create a child span without
anyone having threaded a parameter through — and the property you did not want: **the moment
execution moves to another thread, the current span is gone.** Not wrong; absent. The new thread
has a different thread-local, and it is empty.

Micrometer models this with an explicit contract. From the Context Propagation reference:

> *"`ThreadLocalAccessor` — contract to assist with access to a `ThreadLocal` value. …
> `ContextRegistry` — registry for instances of `ThreadLocalAccessor` and `ContextAccessor`. …
> `ContextSnapshot` — holder of contextual values that provides methods to capture and to
> propagate."*

And the library's own statement of what it is for:

> *"The library is not limited to context propagation from imperative to reactive. It can assist
> in asynchronous scenarios to propagate `ThreadLocal` values from one thread to another."*

The pattern is always the same three steps: **capture** a snapshot on the originating thread,
**carry** it to the target thread, **restore** it into thread-locals there and close the scope
afterwards. Spring Boot wraps this for the common cases — a task decorator for executors, a
Reactor operator for reactive chains — and those wrappers are opt-in properties, which is
exactly why the default is a broken trace across a thread pool.

Micrometer Tracing additionally requires two accessors to be registered by hand if you create
spans or baggage outside the Observation API:

> *"The `ObservationAwareSpanThreadLocalAccessor` is required to propagate manually created
> spans (not the ones that are governed by Observations). The `ObservationAwareBaggageThreadLocalAccessor`
> is required to propagate baggage created by the user."*

## Mechanism 2 · over the wire, and the two verbs

Across a process boundary there is no shared memory, so the context is serialised into the
carrier — HTTP headers, message headers, gRPC metadata. Every tracing library names the two
operations the same way:

- **inject** — take the current span context and write it into an outgoing carrier.
- **extract** — read an incoming carrier and reconstruct a span context, which becomes the
  parent of the span this service is about to create.

The format is standardised: [W3C `traceparent`](03b-the-traceparent-header.md), plus
`tracestate`, plus optionally B3 for older fleets ([03d](03d-b3-and-the-other-formats.md)).

**The critical asymmetry: extraction is nearly always automatic and injection nearly always is
not.** Any instrumented server framework extracts on the way in, because it owns the entry
point. Injection happens in whatever client object you built, and if you built it yourself the
instrumentation was never applied. Spring Boot says this outright:

> *"To automatically propagate traces over the network, use the auto-configured
> `RestTemplateBuilder`, `RestClient.Builder` or `WebClient.Builder` to construct the client."*
>
> *"If you create the `RestTemplate`, the `RestClient` or the `WebClient` without using the
> auto-configured builders, automatic trace propagation won't work!"*

🔴 That warning is the single highest-yield sentence in Spring Boot's tracing chapter. `new
RestTemplate()` inside a `@Configuration` class is the most common cause of a trace that stops
at one service, and it produces no error at all.

## How the two mechanisms compose on one request

```text
inbound HTTP ──► extract traceparent  ──► set current span (thread-local)
                                             │
                                             ├─ business code creates child spans
                                             │  (reads the thread-local)
                                             │
                                             ├─ @Async / executor submit
                                             │    └─ NEW THREAD, empty thread-local
                                             │       unless a snapshot was captured
                                             │
                                             └─ outbound HTTP
                                                  └─ inject traceparent from thread-local
```

*(Schematic of the control flow, not a captured run.)*

Read the diagram for the failure modes rather than the happy path. There are exactly two places
context is lost: **the thread hop where nothing captured a snapshot**, and **the outbound call
whose client was not instrumented**. Everything in [03e](03e-propagation-that-breaks.md) is a
variation on one of those two.

## Spring Boot's opt-ins, by name

Boot ships the wrappers but does not always enable them. From the observability reference:

> *"Observability support relies on the Context Propagation library for forwarding the current
> observation across threads and reactive pipelines. By default, `ThreadLocal` values are not
> automatically reinstated in reactive operators. This behavior is controlled with the
> `spring.reactor.context-propagation` property, which can be set to `auto` to enable automatic
> propagation."*
>
> *"If you're working with `@Async` methods and the `AsyncTaskExecutor` is auto-configured, you
> have to opt-in for context propagation using the `spring.task.execution.propagate-context`
> property."*
>
> *"If you are configuring the `AsyncTaskExecutor` yourself, then you need to register a
> `ContextPropagatingTaskDecorator` bean."*

```properties
spring.reactor.context-propagation=auto
spring.task.execution.propagate-context=true
```

```java
import org.springframework.core.task.support.ContextPropagatingTaskDecorator;

@Configuration(proxyBeanMethods = false)
class ContextPropagationConfiguration {

    @Bean
    ContextPropagatingTaskDecorator contextPropagatingTaskDecorator() {
        return new ContextPropagatingTaskDecorator();
    }
}
```

*(Both properties and the decorator bean are quoted from the Spring Boot 4.1 observability
reference.)*

⚠️ **Note what the third quote implies.** The decorator bean is only wired into executors Boot
itself creates. Every `ThreadPoolExecutor` you constructed with `new` — and there are always
several — is unaffected by all three settings.

## Gotchas

**★ Extraction is automatic; injection usually is not.** Server frameworks extract because they
own the entry point. Outgoing calls are injected by instrumented client objects, and a client
you constructed yourself was never instrumented. Boot states the rule flatly: build clients from
the auto-configured `RestClient.Builder`, `RestTemplateBuilder` or `WebClient.Builder`, or
propagation *"won't work"*.

**★ Losing context is silent by construction.** There is no error for "no current span". The
API's contract for that case is to behave as a no-op or to start a fresh root. So the symptom is
a trace that is shorter than reality, or two traces where there should be one, and neither shows
up in a health check.

**★ `spring.task.execution.propagate-context` only covers Boot's auto-configured executor.**
An executor you built yourself needs a `ContextPropagatingTaskDecorator` applied explicitly. The
property looks global and is not.

**★ Reactive propagation is off by default.** `spring.reactor.context-propagation` must be set to
`auto`; otherwise *"`ThreadLocal` values are not automatically reinstated in reactive
operators"*. A WebFlux service with no other change will produce fragmented traces once any
operator switches scheduler.

**★ Manually created spans need their own accessor.** The Micrometer Tracing reference says
`ObservationAwareSpanThreadLocalAccessor` *"is required to propagate manually created spans (not
the ones that are governed by Observations)"*. If you use the `Tracer` API directly and rely on
Boot's defaults, your spans are the ones that do not survive a thread hop.

**★ A snapshot restored without a closed scope is a leak on a pooled thread.** Restoring
thread-locals on a worker and not clearing them leaves the next unrelated task on that thread
inside a stale span. The result is worse than a missing trace: unrelated work is attributed to
someone else's request. Every restore is a try-with-resources.

**★ Virtual threads do not fix this.** A virtual thread is still a thread with its own
thread-locals, and one task per virtual thread means the values are correctly scoped — but only
if the context was carried into the virtual thread when it was started. Structured concurrency's
inheritance rules and `ScopedValue` are a different mechanism from Micrometer's snapshot; see
[Phase 6 · `ThreadLocal` and `ScopedValue`](../../phase-6-concurrency/12-threadlocal-scopedvalue/README.md).

**★ Propagation is a per-hop property, so one bad service breaks everything downstream of it.**
If service C does not forward the headers, then D, E and F are all missing from the trace even
though they are perfectly instrumented. The service you must fix is the last one that appears,
not the first one that is absent.

## Interview questions

**★ What are the two distinct problems that "context propagation" refers to?**
Carrying the current span across threads inside one process, and serialising the span context
into headers between processes. The first is a `ThreadLocal` problem solved by capture/restore —
Micrometer's `ContextSnapshot` and `ThreadLocalAccessor` — and the second is a wire-format
problem solved by the W3C `traceparent` header. Micrometer Tracing's glossary names both
explicitly: the context must be propagated *"through the process (for example, over threads) and
over the network"*. In practice the wire half almost always works and the thread half almost
always is where traces break.

**★ Why is the current span held in a `ThreadLocal` at all?**
Because Java has no implicit call-stack parameter. Instrumentation deep inside a library needs to
know its parent span without every intermediate frame passing it along, and a thread-local is the
only mechanism that gives ambient access without changing every signature. The cost of that
choice is precisely the failure mode of the whole topic: the ambient value is scoped to a thread,
so any handoff to another thread loses it unless something explicitly copies it.

**★ Why does `new RestTemplate()` break a trace, and how would you notice?**
Because the tracing instrumentation for outgoing HTTP is applied by Boot's auto-configured
builders, not by the class itself. A hand-constructed client has no interceptor to inject the
`traceparent` header, so the downstream service sees no incoming context and starts a brand new
trace. You notice it as a trace that ends at your service, plus a separate root trace in the
downstream service for the same work — never as an error. Boot's reference states the rule
directly: build clients from the auto-configured builders or propagation *"won't work"*.

**★ You enabled `spring.task.execution.propagate-context=true` and traces still break across your
executor. Why?**
Because that property applies to Boot's auto-configured `AsyncTaskExecutor` only. If the code is
submitting to an executor created with `new ThreadPoolExecutor(...)` or
`Executors.newFixedThreadPool(...)`, nothing has decorated its tasks. The fix is to register a
`ContextPropagatingTaskDecorator` on that executor, or to wrap the submitted task with a captured
`ContextSnapshot` yourself.

**★ What is the risk of restoring a context snapshot on a pooled thread and forgetting to close
the scope?**
Cross-request contamination. The pooled thread keeps the restored thread-locals after your task
finishes, so the next task that runs on it — an entirely unrelated request — creates its spans as
children of your span and writes your trace id into its log lines. That is materially worse than
a missing trace, because the data is wrong rather than absent, and it will send an investigation
in a confidently incorrect direction.

**★ If the trace stops at service C, which service do you fix?**
C, not D. The last service that appears in the trace is the one that failed to inject context
into its outgoing call, because extraction on the receiving side is nearly always automatic. D
being absent is a symptom; D is probably instrumented correctly and is emitting a completely
separate root trace that nobody has connected to this one.

**★ Do virtual threads make propagation easier or harder?**
Neither, and treating them as a fix is a mistake. A virtual thread still has its own
thread-locals, so context must still be carried across the boundary when the task is started; the
capture/restore requirement is unchanged. What does change is the cost calculus — with one
virtual thread per task there is no pooling, so the stale-context-on-a-reused-worker hazard
disappears, but the "context never arrived" hazard is exactly as present as before.

{/* FOOTER */}
