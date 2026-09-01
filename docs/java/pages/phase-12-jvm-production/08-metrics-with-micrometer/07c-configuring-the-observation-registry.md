---
title: "An observation is configured by five collaborators evaluated in a documented order, and knowing which one runs per meter and which one runs per invocation is the difference between a tag you can add and a tag you cannot"
sidebar_label: "07c · Configuring observations"
sidebar_position: 21
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **Micrometer Observation reference** — *Introduction* (glossary,
> usage flow) and *Components* (basic and detailed flow)
> ([docs.micrometer.io](https://docs.micrometer.io/micrometer/reference/observation/components.html)),
> the **Spring Boot 4.1 production-ready reference · Observability**
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/actuator/observability.html)), and
> the **Spring Framework 7 reference · Integration · Observability**
> ([docs.spring.io](https://docs.spring.io/spring-framework/reference/integration/observability.html)).
> No JVM was run for this page. JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8 ·
> Micrometer 1.17.0 / Micrometer Tracing 1.7.0.

**[07b](07b-observation-api.md) covered writing an observation. This page is the other half:
the four collaborators that decide whether it happens, what it is called, what it carries and what
it becomes. Two of them can do things a `MeterFilter` structurally cannot, because they run per
invocation rather than once per meter — and that is the single most useful thing to know about the
whole component model.**

## The five collaborators, in the documentation's own glossary

> *"**ObservationRegistry** — registry containing Observation related configuration (e.g. handlers,
> predicates, filters)*
> ***ObservationHandler** — handles lifecycle of an Observation (e.g. create a timer on observation
> start, stop it on observation stop)*
> ***ObservationFilter** — mutates the Context before the Observation gets stopped (e.g. add a high
> cardinality key-value with the cloud server region)*
> ***ObservationPredicate** — condition to disable creation of an Observation (e.g. don't create
> observations with given key-value)*
> ***Context** (actually `Observation.Context`) — a mutable map attached to an Observation, passed
> between handlers (that way you can pass state without doing any thread locals)*
> ***ObservationConvention** — mean to separate Observation lifecycle (starting, stopping, opening
> scopes) from adding metadata (such as observation name, key-value pairs). That way the naming of
> observations and metadata handling becomes a configuration problem (e.g. adding key-values does
> not require changing instrumentation code, but changing the convention)"*

Two of those solve problems that a `MeterFilter` explicitly cannot. `ObservationFilter` *"mutates
the Context before the Observation gets stopped"* — that is a per-invocation hook, so unlike a
`MeterFilter` it **can** derive a value from request state ([04c](04c-meterfilter.md) is emphatic
that filters cannot). And `ObservationConvention` moves naming and tagging out of the instrumented
code, which is why Spring can let you retag `http.server.requests` without touching a controller
([06b](06b-the-uri-tag.md)).

The evaluation order matters and is documented: predicates decide whether an observation is created
at all, handlers fire on each lifecycle event, and *"on Observation stop, before calling the
`ObservationHandler` onStop methods, list of `ObservationFilter` is called to optionally further
modify the `Observation.Context`."*

## What Spring Boot has already wired

Two handlers, and they are the whole "three signals from one call" story:

> *"A `DefaultMeterObservationHandler` is automatically registered on the `ObservationRegistry`,
> which creates metrics for every completed observation."*

> *"A `TracingAwareMeterObservationHandler` is automatically registered on the
> `ObservationRegistry`, which creates spans for every completed observation."*

Plus automatic bean pickup:

> *"Beans of type `ObservationPredicate`, `GlobalObservationConvention`, `ObservationFilter` and
> `ObservationHandler` will be automatically registered on the `ObservationRegistry`. You can
> additionally register any number of `ObservationRegistryCustomizer` beans to further configure the
> registry."*

So in a Boot application you write the observation and configure the *behaviour* with beans, exactly
as you do with `MeterFilter` for meters.


## How Boot picks them up

> *"Beans of type `ObservationPredicate`, `GlobalObservationConvention`, `ObservationFilter` and
> `ObservationHandler` will be automatically registered on the `ObservationRegistry`. You can
> additionally register any number of `ObservationRegistryCustomizer` beans to further configure the
> registry."*

The symmetry with metrics is deliberate: `MeterFilter` beans are auto-bound to the `MeterRegistry`
and `MeterRegistryCustomizer` beans configure it, and the observation side mirrors both. So
"configure the behaviour with beans, keep the instrumentation clean" is the same discipline on both
sides of the fence.


## Turning observations off

```properties
management.observations.enable.denied.prefix=false
management.observations.enable.spring.security=false
```

> *"The preceding example will prevent all observations with a name starting with `denied.prefix`
> or `another.denied.prefix`."*

and for anything a prefix cannot express:

```java
@Component
class MyObservationPredicate implements ObservationPredicate {
    @Override
    public boolean test(String name, Context context) {
        return !name.contains("denied");
    }
}
```

> *"Observations are only reported if all the `ObservationPredicate` beans return `true` for that
> observation."*

🔴 This is a different layer from `management.metrics.enable.*`. Denying the *metric* leaves the
observation and therefore the span running; denying the *observation* removes both.


## The one table worth memorising

| Collaborator | Runs | Sees | Can it depend on the request? |
|---|---|---|---|
| `ObservationPredicate` | before creation, every invocation | name and context | yes |
| `ObservationConvention` | at creation, every invocation | the typed context | yes |
| `ObservationHandler` | on every lifecycle event | the mutable context | yes |
| `ObservationFilter` | on stop, before `onStop` | the mutable context | yes |
| `MeterFilter` | once, at meter registration | a `Meter.Id` only | **no** |

The last row is the point. Everything above it is per invocation and can therefore derive a value
from what actually happened; the meter filter cannot, and Micrometer says so directly — *"Use cases
where dynamic behavior is desired, such as defining tags based on the context of a request etc.,
should be implemented in the instrumentation itself rather than in a `MeterFilter`. … See also
`ObservationFilter` which allows dynamic implementations."*

It also implies the cost model. A `MeterFilter` is amortised to nothing over the life of the
process. An `ObservationFilter` runs on every request, so anything it does — a lookup, a string
concatenation, a `ThreadLocal` read — is on the hot path.

## Gotchas


**★ `management.metrics.enable.*` and `management.observations.enable.*` are different layers and
people reach for the wrong one.** The first is a `MeterFilter`; the second stops the observation
entirely. If you wanted to keep the trace and drop the metric, only the first does that.

**★ An `ObservationFilter` runs on every stop, so its cost is per invocation.** Unlike a
`MeterFilter`, which runs once per meter at registration, a filter here is on the hot path. That is
the price of being able to see request state, and it is a real reason not to do expensive work
there.

**★ The `Observation.Context` is a mutable map shared across handlers, which makes handler order
observable.** The documentation offers it as the way to *"pass state without doing any thread
locals"*, which is exactly right and also means a handler that mutates the context changes what
later handlers see.


**★ `GlobalObservationConvention` beans are picked up automatically, which means a library can
rename your observations.** Any bean implementing it is registered on the registry. A dependency
that ships one has changed your metric names and span names without a line of your configuration.

**★ A predicate that returns `false` gives you a no-op observation, not an exception.** Consistent
with the rest of Micrometer: suppression is always silent, and the application code continues to
call `observe(...)` with no indication that nothing is recorded.

**★ All predicates must agree.** *"Observations are only reported if all the
`ObservationPredicate` beans return `true` for that observation."* One over-broad predicate from a
shared library suppresses observations for everybody, and the failure is a missing metric rather
than a startup error.

## Interview questions


**★ How is `ObservationFilter` different from `MeterFilter`?**
Scope and timing. A `MeterFilter` runs once per meter, at registration, and sees only a `Meter.Id`,
so it can never depend on request state — Micrometer says so explicitly and directs you to the
instrumentation instead. An `ObservationFilter` runs on every observation stop and receives the
mutable `Observation.Context`, so it can add a key value derived from what actually happened. The
trade is cost: a meter filter is amortised to nothing, an observation filter is on the hot path.

**★ On Boot 4, what is the difference between `management.metrics.enable.foo=false` and
`management.observations.enable.foo=false`?**
The first installs a `MeterFilter` that denies the meter — the observation still runs, the handlers
still fire, and the span is still produced and exported. The second stops the observation being
created at all, so you lose the metric and the span together. Since almost everything Spring
auto-instruments on Boot 4 is observation-based, choosing the wrong one produces the surprising
result of a metric disappearing while trace volume and cost stay exactly where they were.


**★ In what order are the observation collaborators evaluated, and why does the order matter?**
Predicates first — they decide whether a real observation or a no-op is created, so anything they
suppress costs nothing downstream. Then the convention, which supplies the name and the key values
at creation. Then handlers, on each lifecycle event, receiving the mutable context. Then, on stop
and *before* the handlers' `onStop` methods run, the filters, which get a last chance to modify the
context. The order matters because it tells you where to put a change: a key value that must be
visible to a handler has to be added by the convention or by a filter, not by a handler that runs
later, and anything you want suppressed cheaply belongs in a predicate rather than in a handler
that returns early.

**★ A shared internal library ships a `GlobalObservationConvention`. What should you check?**
That it does not rename observations you depend on, and that it does not add key values you did not
budget for. Boot registers any such bean automatically, and a convention controls both the
observation name — which becomes your metric name and your span name — and the low-cardinality key
values, which become metric tags and therefore time series. A library that adds one
low-cardinality key with ten values has multiplied every affected meter's series count by ten
across every service that depends on it, with no configuration change anywhere.

{/* FOOTER */}
