---
title: "The Observation API exists so that one instrumentation call site produces a metric, a span and a correlated log line, and the price of that leverage is a component model with six lifecycle events and five collaborators you have to be able to name"
sidebar_label: "07b · The Observation API"
sidebar_position: 20
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **Micrometer Observation reference** — *Micrometer
> Observation*, *Introduction*, *Components*
> ([docs.micrometer.io](https://docs.micrometer.io/micrometer/reference/observation/introduction.html)),
> the **Spring Boot 4.1 production-ready reference · Observability** and *· Tracing*
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/actuator/observability.html)), and
> the **Spring Framework 7 reference · Integration · Observability**
> ([docs.spring.io](https://docs.spring.io/spring-framework/reference/integration/observability.html)).
> No JVM was run for this page. JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9 ·
> Micrometer 1.17.0 / Micrometer Tracing 1.7.0.

**Micrometer states the goal in one sentence — *"Instrument code once, and get multiple benefits
out of it."* — and everything in the API follows from taking that literally. An `Observation` is
not a metric. It is a *lifecycle* that handlers subscribe to, and whether it becomes a timer, a
span, a log line or all three is a registry configuration decision made somewhere else entirely.
On Spring Boot 4 this is not an advanced option: it is how `http.server.requests` is already
produced.**

## The one-line version

The reference makes the case by showing the rewrite:

```java
// The metrics-only form
MeterRegistry registry = new SimpleMeterRegistry();
Timer.Sample sample = Timer.start(registry);
try {
    // do some work here
}
finally {
    sample.stop(Timer.builder("my.timer").register(registry));
}
```

> *"If you want to have more observation options (such as metrics and tracing — already included in
> Micrometer — plus anything else you will plug in), you need to rewrite that code to use the
> Observation API."*

```java
ObservationRegistry registry = ObservationRegistry.create();
Observation.createNotStarted("my.operation", registry).observe(this::doSomeWorkHere);
```

And what `observe` actually does, which is more than it looks:

> *"Calling `observe(() → …)` leads to starting the Observation, putting it in scope, running the
> lambda, putting an error on the Observation if one took place, closing the scope and stopping the
> Observation."*

🔴 Five things, of which two are the ones you would forget by hand: **putting it in scope** (so a
nested observation becomes a child and any log line inside picks up the trace id) and **recording
the error** (so a thrown exception becomes a failed span and a tagged metric).

## Six lifecycle events, and who listens

> *"For any `Observation` to happen, you need to register `ObservationHandler` objects through an
> `ObservationRegistry`. An `ObservationHandler` reacts only to supported implementations of an
> `Observation.Context` and can create timers, spans, and logs by reacting to the lifecycle events
> of an Observation, such as:*
> *start … stop … error … event … scope started … scope stopped"*

with, on scopes:

> *"scope started — Observation opens a Scope. **The Scope must be closed when no longer used.**
> Handlers can create thread local variables on start that are cleared upon closing of the scope."*

That is the whole extension point. Adding tracing to code that was instrumented for metrics is not
a code change; it is registering another handler.

## What Spring Boot has already wired

Two handlers, and between them they are the entire "three signals from one call" story:

> *"A `DefaultMeterObservationHandler` is automatically registered on the `ObservationRegistry`,
> which creates metrics for every completed observation."*

> *"A `TracingAwareMeterObservationHandler` is automatically registered on the
> `ObservationRegistry`, which creates spans for every completed observation."*

The other four collaborators — the registry, predicates, filters and conventions — and how Boot
picks them up from beans, are [07c · Configuring the observation
registry](07c-configuring-the-observation-registry.md).

## Writing one

```java
@Component
public class OrderProcessor {

    private final ObservationRegistry registry;

    OrderProcessor(ObservationRegistry registry) {
        this.registry = registry;
    }

    public Receipt process(Order order) {
        return Observation.createNotStarted("orders.process", registry)
            .lowCardinalityKeyValue("order.type", order.type().name())   // metric tag + span attribute
            .highCardinalityKeyValue("order.id", order.id())             // span attribute only
            .observe(() -> doProcess(order));
    }
}
```

Boot states the routing rule that makes the two methods worth distinguishing: *"Low cardinality tags
will be added to metrics and traces, while high cardinality tags will only be added to traces."*
The reasoning and the cost model are in [04a · Common tags](04a-common-tags.md).

⚠️ **`observe` swallows nothing.** It records the error on the observation and rethrows. What it
does *not* do is give you an outcome tag — the exception class ends up on the span and on the
`error` key, and if you want a low-cardinality `outcome` you still have to set it, which means
`observe(Supplier)` with a try/catch inside, or the explicit start/stop form.

## When *not* to use it

The Observation API is heavier than a `Timer`: an object per invocation, a context map, a handler
chain, and a scope open and close. For an operation that crosses a boundary — an HTTP call, a
database round trip, a queue publish — that overhead is irrelevant next to what you are measuring,
and the span is worth having. For a tight in-process loop it is not, and a plain `Timer` or nothing
at all is the right answer ([07](07-timing-your-own-code.md)).

The other case for a plain `Timer` is when you genuinely want a metric and definitely not a span —
a periodic self-check, a cache statistic, anything that would produce a span with no parent and no
diagnostic value. An observation always offers itself to every registered handler.

## Gotchas

**★ An `ObservationRegistry` that was never set makes the instrumentation a no-op.** Spring
Framework says it plainly for every instrumented component: *"setting the `ObservationRegistry`; if
not set, observations will not be recorded and will be no-ops."* This is the same failure shape as
an uninstrumented `RestClient` ([06c](06c-the-client-uri-tag.md)) — silent, and indistinguishable
from "we never instrumented it".

**★ A scope that is opened and not closed leaks thread-local state onto a pooled thread.** The
documentation states the requirement — *"The Scope must be closed when no longer used"* — because
handlers create thread locals on scope start and clear them on close. `observe(...)` closes it for
you; `openScope()` does not. On a pooled thread the leaked context attaches the *next* request to
the previous request's trace.

**★ `observe` records the error but does not give you an outcome tag.** The exception class becomes
the `error` key value, which is bounded by your dependency graph and is fine. A business-level
outcome — `declined`, `retryable`, `fraud` — is a low-cardinality key you have to set yourself, and
you cannot set it after the fact from `observe(Runnable)`.

**★ Annotating something Boot already instruments produces duplicate observations, not
overrides.** Boot: *"When you annotate methods or classes which are already instrumented … you will
get duplicate observations."* Two spans and two metric families for one operation.

**★ Everything you add as an observation-level common tag lands on your spans too.**
`management.observations.key-values.*` is applied *"to all observations as low cardinality tags"*,
which means it is exported to your tracing backend on every span. Convenient for `region`; a
mistake for anything you would not want in a trace.

**★ High-cardinality key values are free in the trace and not free in the exporter.** They are not
metric tags, so they do not multiply time series — but they are span attributes, subject to
OpenTelemetry's attribute count and value-length limits and to your span export volume. "High
cardinality is free" is true relative to metrics, not absolutely.

**★ An `Observation` created against `ObservationRegistry.NOOP` is silently inert.** Useful in
tests and in library defaults, and a trap when a component gets constructed with the no-op registry
because the real one was not injected.

## Interview questions

**★ What problem does the Observation API solve that a `Timer` does not?**
Duplication of instrumentation across signals. A `Timer` produces a metric and nothing else, so a
service that wants a metric, a span and a correlated log line for the same operation ends up with
three pieces of instrumentation at one call site that can and do drift apart. An `Observation` is a
lifecycle that handlers subscribe to: Boot registers a `DefaultMeterObservationHandler` that makes
a metric and a `TracingAwareMeterObservationHandler` that makes a span, and adding a third
behaviour later is a registry configuration change rather than a code change. Micrometer's own
framing is "instrument code once, and get multiple benefits out of it".

**★ What exactly does `observe(Runnable)` do?**
Five things, in order: starts the observation, opens a scope, runs the lambda, records an error on
the observation if one was thrown, closes the scope, and stops the observation. The two easy to
forget by hand are the scope — which is what makes a nested observation a child and what puts the
trace id into the MDC for log lines inside the block — and the error recording, which is what turns
a thrown exception into a failed span and an `error`-tagged metric. Doing it manually means
`start`, `openScope`, try/catch calling `error`, `close`, `stop`, correctly, every time.

**★ Why does the API force you to declare a key value as low or high cardinality?**
Because the two are routed to different backends with opposite economics. Low-cardinality values go
to metrics and traces; high-cardinality values go to traces only. A metrics backend charges per
distinct time series, so an unbounded value is ruinous there, while a tracing backend stores
individual spans and an unbounded attribute is often the most useful field on the span. Declaring
the class at the call site means one instrumentation can carry the order id for the trace and the
order type for both, with no way for the id to leak into a metric tag.

**★ When would you deliberately not use an Observation?**
When the operation is fine-grained enough that a context object, a handler chain and a scope
open/close per invocation is a meaningful fraction of the work — a tight in-process loop, a cheap
accessor. And when you want a metric and specifically do not want a span: a periodic self-check or
a cache statistic would produce parentless spans that add export volume and no diagnostic value.
An observation always offers itself to every registered handler, so "metrics only" is a decision
you make by not using the API rather than by configuring it away.

**★ What breaks if a scope is opened and never closed?**
Handlers create thread-local state on scope start and clear it on close, so an unclosed scope
leaves that state attached to the thread. On a pooled thread — a servlet container thread, an
executor worker — the next task picks up the previous task's trace context, so its spans are
parented into a completed trace and its log lines carry the wrong trace id. Nothing throws. This
is why `observe(...)`, which closes the scope for you, is strongly preferred over manual
`openScope()`, and why the documentation states the requirement in bold in the lifecycle list.

{/* FOOTER */}
