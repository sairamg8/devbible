---
title: "Common tags are the only tags that multiply your entire metric surface at once, they must be installed before the first meter binder runs, and on Spring Boot 4 there are two properties for them that cover different halves of your instrumentation"
sidebar_label: "04a · Common tags"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **Micrometer 1.17 reference** — *Concepts · Naming Meters ·
> Common Tags*
> ([docs.micrometer.io](https://docs.micrometer.io/micrometer/reference/concepts/naming.html)),
> the **Spring Boot 4.1 production-ready reference** — *Metrics · Common Tags*, *Metrics ·
> Getting Started* and *Observability · Common Tags*
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/actuator/observability.html)),
> the **Spring Framework 7 reference** — *Integration · Observability*
> ([docs.spring.io](https://docs.spring.io/spring-framework/reference/integration/observability.html)),
> and **`spring-boot-dependencies:4.1.1`** for the managed versions. No JVM was run for this page.
> JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9 · Micrometer 1.17.0.

**[04 · Tags](04-tags.md) was about the tags you write at the call site. This page is about the
ones you do not: the environment dimensions applied to every meter in the process. They are the
highest-leverage and highest-blast-radius tags you will configure, they have a hard ordering
requirement that fails silently, and on Boot 4 the property you probably reach for covers only
half your metrics.**

## What they are for

> *"You can define common tags at the registry level and add them to every metric reported to the
> monitoring system. This is generally used for dimensional drill-down on the operating
> environment, such as host, instance, region, stack, and others."*

The pure form, on the registry:

```java
registry.config().commonTags("stack", "prod", "region", "us-east-1");
registry.config().commonTags(List.of(Tag.of("stack", "prod"), Tag.of("region", "us-east-1")));
```

Both lines are documented as equivalent. And:

> *"Further calls to `commonTags` append additional common tags."*

They **append**; they do not replace. Two libraries that each call `commonTags("app", …)` do not
conflict loudly — you get two `app` tags on every meter and the backend decides what that means.

## Boot 4 has two properties, and they are not aliases

The one everybody knows:

```properties
management.metrics.tags.region=us-east-1
management.metrics.tags.stack=prod
```

> *"The preceding example adds `region` and `stack` tags to all meters with a value of
> `us-east-1` and `prod`, respectively."*

The one that covers auto-instrumentation:

```properties
management.observations.key-values.region=us-east-1
management.observations.key-values.stack=prod
```

> *"Common tags are generally used for dimensional drill-down on the operating environment, such
> as host, instance, region, stack, and others. Common tags are applied to all observations as low
> cardinality tags and can be configured …"*

🔴 **Why this matters on Boot 4 specifically.** Framework 7 produces `http.server.requests`,
`http.client.requests`, `jms.message.publish`, `jms.message.process` and
`tasks.scheduled.execution` as **observations**, and Boot turns observations into meters through
`DefaultMeterObservationHandler` (*"A `DefaultMeterObservationHandler` is automatically registered
on the `ObservationRegistry`, which creates metrics for every completed observation."*). Spring
Data repository invocations, MongoDB commands and the HTTP client instrumentation are all on that
path too.

The practical rule:

| Where the meter comes from | Which property tags it |
|---|---|
| `registry.counter(...)`, `Timer.builder(...)`, your own code | `management.metrics.tags` |
| A Micrometer `MeterBinder` (JVM, system, cache, Hikari, Tomcat) | `management.metrics.tags` |
| Anything created from an `Observation` — HTTP server/client, JMS, `@Scheduled`, Spring Data | `management.observations.key-values` |

Setting only the first and then asking "why has `http_server_requests` no `region` label" is one
of the more common Boot 4 upgrade surprises. Setting both with the *same* values is harmless and
is what most services end up doing. Setting both with *different* values gives you two
inconsistent answers to the same question and no error anywhere.

## When properties are not enough: the customizer

```java
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.boot.micrometer.metrics.autoconfigure.MeterRegistryCustomizer;

@Configuration(proxyBeanMethods = false)
public class MyMeterRegistryConfiguration {

    @Bean
    public MeterRegistryCustomizer<MeterRegistry> metricsCommonTags() {
        return (registry) -> registry.config().commonTags("region", currentRegion());
    }
}
```

Boot documents the contract that makes this the right hook:

> *"You can register any number of `MeterRegistryCustomizer` beans to further configure the
> registry, such as applying common tags, **before any meters are registered with the registry**."*

⚠️ **That import is a Boot 4 package move.** `MeterRegistryCustomizer` is now in
`org.springframework.boot.micrometer.metrics.autoconfigure`, not
`org.springframework.boot.actuate.autoconfigure.metrics`. Any Boot 3 snippet you copy will not
compile — which is the good outcome. The bad outcome is copying from a blog that shows only the
class name.

You can also narrow the customizer to one registry implementation by tightening the generic:

```java
@Bean
public MeterRegistryCustomizer<GraphiteMeterRegistry> graphiteNaming() {
    return (registry) -> registry.config().namingConvention(this::name);
}
```

## The ordering requirement, and how it fails

> *"Common tags generally have to be added to the registry before any (possibly autoconfigured)
> meter binders."*

A common tag added *after* a binder has registered its meters does not apply retroactively. The
result is a process exporting JVM metrics without `region` and application metrics with it. No
exception, no warning; just every `by (region)` aggregation that spans both families quietly
returning half the data it should.

The failure modes that produce this, in order of how often they happen:

1. Calling `registry.config().commonTags(...)` from a `@PostConstruct` or an
   `ApplicationReadyEvent` listener. By then the binders have run.
2. Injecting `MeterRegistry` into a `@Component` and configuring it in the constructor. Bean
   creation order is not a guarantee you can lean on here.
3. Using `Metrics.globalRegistry` static methods instead of the injected registry. Boot warns
   about this for a different reason and it applies here too: *"Make sure to register your metrics
   by using the Spring-managed `MeterRegistry` and not any of the static methods on `Metrics`.
   These use the global registry that is not Spring-managed."*

`MeterRegistryCustomizer` exists precisely to remove this class of bug. If you are configuring
common tags anywhere else, you are relying on ordering you do not control.

## Low and high cardinality: the routing rule that lets one call site feed two signals

Spring Framework draws a line Micrometer's core meter API does not:

> *"`KeyValues` are said to be 'low cardinality' if there is a low, bounded number of possible
> values for the `KeyValue` tuple (HTTP method is a good example). **Low cardinality values are
> contributed to metrics only.** Conversely, 'high cardinality' values are unbounded (for example,
> HTTP request URIs) and are only contributed to traces."*

```java
Observation.createNotStarted("orders.process", observationRegistry)
    .lowCardinalityKeyValue("order.type", type.name())   // becomes a metric tag AND a span attribute
    .highCardinalityKeyValue("order.id", id)             // span attribute only
    .observe(this::process);
```

This is the single most useful thing the Observation API adds over registering meters directly.
The same instrumentation carries the order id *for the trace*, where storage is per span, while
the metric stays two-dimensional and cheap. Boot's own wording: *"Low cardinality tags will be
added to metrics and traces, while high cardinality tags will only be added to traces."*
[07b · The Observation API](07b-observation-api.md) is the mechanism;
**Topic 09 · Distributed tracing** *(not written yet)* is what receives the other half.

Note also what the observation-level common tags do that `management.metrics.tags` cannot: they
are *"applied to all observations as low cardinality tags"*, so `region` and `stack` end up on your
**spans** as well as your metrics. That is usually what you wanted.

## The pod name argument

The tempting common tag is instance identity — `pod`, `host`, `container`. Two reasons to resist
adding it from inside the application:

- **Prometheus already has it.** The scraper attaches `instance` and `job` from service discovery,
  along with any relabelled Kubernetes metadata. An application-supplied `pod` tag duplicates that
  and makes the application responsible for knowing its own scheduling identity.
- **Blast radius.** A common tag multiplies *every* series the process exports. If the value turns
  out to be higher-cardinality than expected — a hostname with a random suffix, a container id, a
  restart counter — you have multiplied your entire metric surface, not one meter, and the
  multiplication applies retroactively to every dashboard.

The counter-argument is real for push-based backends, which have no scraper to attach target
labels; there, instance identity has to come from somewhere and the application is the only
candidate. Know which world you are in before you copy a `commonTags("pod", …)` line between
services.

## Gotchas

**★ Common tags added after a meter binder are silently missing from that binder's meters.** No
error, no log line — just JVM metrics that cannot be joined to application metrics by region.
`MeterRegistryCustomizer` is the only hook Boot documents as running before any meters are
registered.

**★ `management.metrics.tags` does not tag observation-derived meters on Boot 4.** Everything
Framework 7 auto-instruments — HTTP server and client, JMS, `@Scheduled`, Spring Data
repositories — arrives via `DefaultMeterObservationHandler` and needs
`management.observations.key-values`.

**★ `commonTags` appends rather than replaces, so two calls with the same key give you two tags.**
This bites when a shared internal library adds common tags and the application adds its own.
Nothing fails; you get a duplicate dimension whose behaviour depends on the backend.

**★ Common tag *order* is not guaranteed, and on Graphite order is identity.** Boot states it:
*"The order of common tags is important if you use Graphite. As the order of common tags cannot be
guaranteed by using this approach, Graphite users are advised to define a custom `MeterFilter`
instead."* A hierarchical backend flattens tags into the metric name, so a reordering renames every
series.

**★ Every common tag multiplies your entire metric surface at once.** One meter with a
high-cardinality tag costs you one meter's worth of explosion. One *common* tag with a
high-cardinality value costs you every meter in the process, including the several hundred the JVM
and pool binders registered for free.

**★ `Metrics.globalRegistry` bypasses the Spring-managed registry and therefore your common tags.**
Boot's warning is about registration, but the consequence for tagging is the same: meters
registered statically are on a registry your customizers never touched.

**★ A common tag whose value is computed from the environment can differ across your fleet without
anyone noticing.** `region` read from an env var that is unset on two of forty pods yields a
literal `null`, an empty string, or a throw at startup depending on how you read it — and an empty
string on Prometheus is an absent label, which splits the series family. Fail fast at startup
instead.

**★ Observation-level common tags land on spans too, which is a feature until it is a leak.**
Anything you put in `management.observations.key-values` is exported to your tracing backend on
every span. Do not put anything there you would not put in a trace.

## Interview questions

**★ Why must common tags be configured before meter binders run, and what is the observable
symptom when they are not?**
Because a common tag is applied at meter *registration* time, not at publish time — the tag becomes
part of the meter's identity as it is created. Binders that already registered keep their untagged
identities. The symptom is a service where some metric families carry `region` and others do not,
usually split along the line of "framework-provided" versus "application-provided", so any
aggregation that spans both silently drops half its input. There is no error and no log line, which
is why `MeterRegistryCustomizer` — documented to run before any meter is registered — is the only
correct hook.

**★ On Boot 4 you set `management.metrics.tags.region` and `http_server_requests` still has no
`region` label. What is happening?**
`http.server.requests` on Framework 7 is produced through the Observation API, not registered
directly on the registry, so it is tagged by `management.observations.key-values.*` instead. The
metrics property applies to the registry; the observation property applies to observations, which
`DefaultMeterObservationHandler` then converts into meters. Everything auto-instrumented by the
framework is on the observation path, so in practice a Boot 4 service usually sets both.

**★ Why does the Observation API make you declare a key value as low or high cardinality?**
Because the two signals have opposite economics and the same call site feeds both. A metrics
backend charges per distinct time series, so an unbounded tag is ruinous; a tracing backend stores
individual spans, so an unbounded attribute costs nothing extra and is often the most valuable
field on the span. Declaring the class at the call site lets one piece of instrumentation route
the order id to the trace and the order *type* to both, with no duplicated code and no chance of
the id leaking into a metric tag.

**★ Should the pod name be a common tag?**
On a pull-based backend, usually not: Prometheus already attaches `instance` and `job` from
service discovery, so the application would be duplicating information it is worse-placed to know.
The stronger argument is blast radius — a common tag multiplies every series in the process, so if
the value is higher-cardinality than you assumed, you have multiplied your whole metric surface
rather than one meter. On a push-based backend with no scraper to attach target labels, instance
identity has to come from the application, and the answer flips.

**★ A shared library in your organisation calls `commonTags("app", "…")` and so does your service.
What happens?**
Both are applied, because further calls to `commonTags` append. You end up with two `app` tags on
every meter; what the backend does with a duplicated key is backend-specific and none of the
outcomes are good. The fix is a single owner for common tags — normally the application, via
properties or one `MeterRegistryCustomizer` — and libraries that instrument but do not configure
the registry.

**★ How would you find out, on a running service, whether a given meter carries your common
tags?**
Hit `/actuator/metrics/<meter.name>` and read the `availableTags` list, remembering that the
endpoint uses the *code* name (`jvm.memory.max`) and not the exported one (`jvm_memory_max`). If
the common tag is missing there, it is missing at registration, which points at ordering. If it is
present there but absent in the backend, the problem is downstream — a `MeterFilter` dropping it,
or a scrape relabelling rule.

{/* FOOTER */}
