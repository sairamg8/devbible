---
title: "The Observation API: instrument once, get metrics and traces"
sidebar_label: "14 · The Observation API"
sidebar_position: 14
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-20 against the Spring Boot 4.1.1 reference — *Actuator ·
> Observability* (docs.spring.io/spring-boot/reference/actuator/observability.html:
> Boot auto-configuring an `ObservationRegistry`; beans of type
> `ObservationPredicate`, `GlobalObservationConvention`, `ObservationFilter` and
> `ObservationHandler` being *"automatically registered on the
> `ObservationRegistry`"*; `ObservationRegistryCustomizer`; and the
> `Observation.createNotStarted(...).lowCardinalityKeyValue(...).highCardinalityKeyValue(...).observe(...)`
> example with low-cardinality key values going to metrics and traces and
> high-cardinality ones to traces only) and the Micrometer 1.17 reference —
> *Observation · Components*
> (docs.micrometer.io/micrometer/reference/observation/components.html:
> `ObservationHandler` lifecycle methods, `Observation.Context` as a Map-like
> container, and `DefaultMeterObservationHandler` producing timers, long task
> timers and counters for signalled events). Spring Boot 4.1.1, Spring Framework
> 7.0.x, JDK 25.

**Everything up to this chunk taught you to record a duration. The Observation
API asks you to record an *event* instead — this started, here is what it was,
here is how it ended — and then lets separately registered handlers turn that one
recording into a timer, a long task timer, a span and a log context. The
difference matters because a hand-written `Timer` and a hand-written span are two
instrumentations of the same call that will drift apart, and because the API
bakes the cardinality rule of [chunk 11](11-tags-filters-cardinality.md) into its
method names: low-cardinality key values go to metrics and traces, high-cardinality
ones go only to traces.**

## The problem it exists to solve

Here is the honest version of hand-rolled instrumentation for one outbound call,
if you want both a metric and a span:

```java
Timer.Sample sample = Timer.start(registry);
Span span = tracer.nextSpan().name("payment.authorisation").start();
try (Tracer.SpanInScope scope = tracer.withSpan(span)) {
    return gateway.authorise(request);
} catch (RuntimeException ex) {
    span.error(ex);
    throw ex;
} finally {
    span.end();
    sample.stop(Timer.builder("payment.authorisation")
            .tag("gateway", "primary")
            .register(registry));
}
```

Count what is wrong with it. The metric name and the span name are written twice
and will diverge on the first rename. The tag on the timer is not on the span.
The exception is recorded on the span but not on the timer, so the metric cannot
tell a fast failure from a fast success — which is the exact case you go looking
for during an incident. The `finally` has to be right, and every call site has to
repeat all of it. And the shape hard-codes that you want exactly a metric and
exactly a span: adding log correlation means editing every one of these.

The Observation API's claim is that you describe the event once and let
registered handlers decide what to produce from it:

```java
Observation.createNotStarted("payment.authorisation", observationRegistry)
        .lowCardinalityKeyValue("gateway", "primary")
        .highCardinalityKeyValue("orderId", order.id())
        .observe(() -> gateway.authorise(request));
```

`observe(...)` starts the observation, runs the block, records a thrown exception
against it and stops it — so the `try`/`catch`/`finally` shape is not something a
call site can get wrong. If no tracer is configured you still get the timer; add
tracing later and the same line starts producing spans with no edit at all.

## Low and high cardinality are part of the API

This is the design decision worth carrying away even if you never write an
`Observation` by hand. Two methods, two destinations:

| | Reaches metrics | Reaches traces |
|---|---|---|
| `lowCardinalityKeyValue` | yes | yes |
| `highCardinalityKeyValue` | no | yes |

[Chunk 11](11-tags-filters-cardinality.md) argued that an order id must never be
a metric tag, and that the thing you actually wanted was a trace span. The
Observation API is that argument turned into a type signature: the order id is
not forbidden, it is **routed**. Traces are sampled and stored per event, so a
high-cardinality value is affordable there in a way it never is on a metric that
is aggregated per series and retained indefinitely.

The practical consequence is that "I need the user id on this metric" stops being
an argument. Put it on the observation as a high-cardinality key value and it is
on the span you open when investigating one request, without ever becoming a
time series. That is a better outcome than either side of the original
disagreement was asking for.

## What Boot wires for you

Boot auto-configures the `ObservationRegistry`, and — in the reference's words —
beans of type `ObservationPredicate`, `GlobalObservationConvention`,
`ObservationFilter` and `ObservationHandler` are *"automatically registered on
the `ObservationRegistry`"*. `ObservationRegistryCustomizer` beans are applied to
configure it further.

That is the ordinary [auto-configuration](../05-auto-configuration/README.md)
contract: contribute a bean of a known type and Boot finds it. There is no
registry to build, no lifecycle to manage and no `@EnableObservability`.

Boot also instruments a great deal *through* this API rather than through raw
Micrometer, which is why the built-in metrics of
[chunk 09](09-what-boot-measures.md) start carrying trace context the moment a
tracer is present, without anyone re-instrumenting anything.

## Handlers are where the outputs come from

An `ObservationHandler` is notified of the observation's lifecycle — `onStart`,
`onError`, `onEvent`, `onStop`, plus scope callbacks used to attach and detach
context on the current thread — and its `supportsContext` method decides which
observations it is interested in. The `Observation.Context` it receives is
described by Micrometer as a Map-like container, which is how instrumentation
hands type-specific detail to handlers that know what to do with it.

Two handlers explain the whole model:

- **`DefaultMeterObservationHandler`** turns observations into meters: a `Timer`
  for the duration between start and stop, a `LongTaskTimer` covering
  observations currently in progress, and counters for signalled events. That is
  where the metric in the example above came from — nobody registered a timer.
- **Tracing handlers**, present once `micrometer-tracing` and a bridge to a
  concrete tracer are on the classpath, turn the same observations into spans.

The reason this is worth understanding rather than treating as machinery:
**adding an output is registering a bean, not editing instrumentation.** A
handler that logs every observation over a threshold, or writes an audit record
for observations whose name starts with `payment.`, is a `@Component` — and it
applies to every observation in the application, including Boot's own.

```java
@Component
class SlowObservationLogger implements ObservationHandler<Observation.Context> {

    private static final Logger log = LoggerFactory.getLogger(SlowObservationLogger.class);

    @Override
    public boolean supportsContext(Observation.Context context) {
        return true;
    }

    @Override
    public void onStop(Observation.Context context) {
        log.debug("observation finished: {}", context.getName());
    }
}
```

Note `supportsContext` returning `true` there. Written against a narrower
`Context` subtype it would silently never fire for plain observations, which is
the first thing to check when a handler appears to be ignored.

The rest of the API — conventions, common key values, disabling observations, and
getting context across a thread boundary —
is [the next chunk](15-observation-conventions-and-propagation.md).

## Gotchas

**Symptom:** a `highCardinalityKeyValue` is set and never appears on any metric
**Cause:** this is the design — high-cardinality key values reach traces only, low-cardinality ones reach metrics and traces
**Fix:** nothing, if you wanted a trace attribute. If you genuinely believe you need it as a metric dimension, re-read [chunk 11](11-tags-filters-cardinality.md) first, because "I need this on a metric" is usually the mistake this API is preventing

**Symptom:** an observation is created and nothing is ever recorded
**Cause:** `createNotStarted` does exactly what its name says — with no `observe(...)` and no matching `start()`/`stop()` pair there is no observation
**Fix:** prefer `observe(...)`, which starts, runs, records a thrown exception and stops in one call, so no call site can get the `finally` wrong:
```java
Observation.createNotStarted("report.generation", registry)
        .observe(() -> buildReport(month));
```

**Symptom:** a custom `ObservationHandler` bean is registered and never called
**Cause:** `supportsContext` returned false for the contexts in play, typically because the handler was declared against a specific `Context` subtype while the observations carry plain contexts
**Fix:** implement `ObservationHandler<Observation.Context>` and discriminate inside `onStop` on the name, or narrow the generic type deliberately and know which instrumentation produces that context

**Symptom:** adding `micrometer-tracing` changes nothing — observations still produce only metrics
**Cause:** the tracing handlers need a bridge to a concrete tracer and an exporter, not just the API artifact
**Fix:** add the bridge and exporter your platform expects. The quietness is by design: the Observation API is built to work with no tracer present, so a missing tracer looks like normal operation rather than a failure

**Symptom:** renaming an observation breaks a dashboard nobody connected to it
**Cause:** the observation name becomes the meter name, so it is a published contract in exactly the sense [chunk 10](10-custom-metrics.md) describes
**Fix:** treat observation names with the same care as metric names — register the new one alongside the old for a deprecation window, migrate the queries, then remove the old one

## Interview questions

**★ What problem does the Observation API solve that a `Timer` does not?**
A `Timer` records a duration. An observation records an event — start, key
values, outcome, stop — and lets independently registered handlers turn it into a
timer, a long task timer, a span or anything else. The concrete pain it removes
is maintaining two instrumentations of one call: a hand-written timer and a
hand-written span duplicate the name, disagree about tags, drift on the first
rename, and typically only one of them records the exception, which is the case
you most need during an incident.

**★ What is the difference between a low-cardinality and a high-cardinality key value?**
Where they are sent. Low-cardinality key values reach both metrics and traces;
high-cardinality ones reach traces only. That is the cardinality rule from the
metrics chunks encoded in the API rather than left to discipline: an order id or
a user id is not forbidden, it is routed to the place where per-event data is
affordable, because traces are sampled and stored individually while a metric is
aggregated per series and kept indefinitely.

**★ Where do the timer and the span actually come from?**
From handlers, not from the observation. `DefaultMeterObservationHandler` creates
the meters — a timer for the completed duration, a long task timer for
in-progress observations, counters for signalled events — and tracing handlers
create spans once `micrometer-tracing` and a bridge are present. The instrumented
code neither knows nor cares which are registered, which is the point: you add an
output by adding a bean rather than by editing every call site.

**★ What does Spring Boot auto-configure here, and why does that matter?**
An `ObservationRegistry`, plus the registration onto it of every
`ObservationPredicate`, `GlobalObservationConvention`, `ObservationFilter` and
`ObservationHandler` bean it finds, and any `ObservationRegistryCustomizer`
beans. It matters because it means a single `@Component` can change the telemetry
of the whole application — including the parts Boot instruments itself, which is
most of them — rather than only the code you wrote.

**★ A colleague wants every observation over two seconds written to a log with its key values. What do you tell them to build?**
An `ObservationHandler` bean. It is notified on `onStop` with the context, which
carries the name and the key values collected during the observation, so the
whole feature is one `@Component` and no change to any instrumented method. Two
details decide whether it works: `supportsContext` must return true for the
contexts actually in play — declaring the handler against a narrow `Context`
subtype is the usual reason one never fires — and the handler applies to Boot's
own observations too, so it needs to be selective about what it logs or it will
be very noisy.

**★ Why is "instrument once" more than a slogan here?**
Because the alternative is demonstrable: two parallel instrumentations of the
same call, with two names, two sets of tags and one of them missing the error
path. They agree while someone is watching and diverge the moment a method is
renamed or a tag is added on one side. Recording the event once and deriving
outputs from it removes an entire class of drift — and it also means adding
tracing to an existing codebase is a dependency change rather than an
instrumentation project.

---

← Prev: [Buckets, SLOs and cost](13-configuring-distributions.md) · Index: [Actuator](README.md) · Next → [Conventions, filtering and propagation](15-observation-conventions-and-propagation.md)
