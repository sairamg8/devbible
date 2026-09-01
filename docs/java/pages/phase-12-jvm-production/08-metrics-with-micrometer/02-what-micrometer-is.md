---
title: "Micrometer is SLF4J's shape applied to metrics — a facade whose implementation is chosen by what is on the classpath — and on Spring Boot 4.1 it is version 1.17.0, not 2.x, which settles every package name you are about to type"
sidebar_label: "02 · What Micrometer is"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **Micrometer 1.17 reference** — *Concepts · Purpose*,
> *Concepts · Registry*
> ([docs.micrometer.io](https://docs.micrometer.io/micrometer/reference/concepts/registry.html)),
> the **`spring-boot-dependencies:4.1.0` POM** from Maven Central
> ([repo1.maven.org](https://repo1.maven.org/maven2/org/springframework/boot/spring-boot-dependencies/4.1.0/spring-boot-dependencies-4.1.0.pom)),
> the **`micrometer-bom:1.17.0` POM**
> ([repo1.maven.org](https://repo1.maven.org/maven2/io/micrometer/micrometer-bom/1.17.0/micrometer-bom-1.17.0.pom)),
> the **`spring-boot-starter-actuator:4.1.0` POM**, and the **Spring Boot 4.1.0 reference** —
> *Actuator · Metrics · Getting Started*
> ([docs.spring.io](https://docs.spring.io/spring-boot/4.1.0/reference/actuator/metrics.html)).
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8 · Micrometer 1.17.0.

**Micrometer is a vendor-neutral instrumentation API with pluggable backends: you write against
`MeterRegistry` and a registry implementation on the classpath decides where the numbers go. The
structural analogy to SLF4J is exact and deliberate, and it has the same consequences — including
the one where nothing is exported because no implementation is present and nothing complains.
This page pins the versions, because every package and artifact name in this topic depends on
them.**

## The version facts, settled

Spring Boot 4.1.0's dependency-management POM pins these:

```xml
<micrometer.version>1.17.0</micrometer.version>
<micrometer-tracing.version>1.7.0</micrometer-tracing.version>
<opentelemetry.version>1.62.0</opentelemetry.version>
<prometheus-client.version>1.5.1</prometheus-client.version>
<prometheus-simpleclient.version>0.16.0</prometheus-simpleclient.version>
<spring-framework.version>7.0.8</spring-framework.version>
```

🔴 **Micrometer is 1.17.0. There is no Micrometer 2.x.** At the time of writing the Micrometer
documentation's own version selector lists the stable lines as 1.17, 1.16, 1.15, 1.14, 1.13 and
1.12, with 1.18 in preview. Spring Boot 4 moving to a `4.x` version number did **not** drag
Micrometer to `2.x` with it — they are separate projects on separate cadences. Every package in
this topic is therefore `io.micrometer.core.instrument.*`, `io.micrometer.core.instrument.config.*`,
`io.micrometer.observation.*` and so on, exactly as on Boot 3.

The thing that *did* change in Boot 4 is on Spring's side, and it changes imports:

| | Spring Boot 3.x | **Spring Boot 4.1** |
|---|---|---|
| `MeterRegistryCustomizer` | `org.springframework.boot.actuate.autoconfigure.metrics` | **`org.springframework.boot.micrometer.metrics.autoconfigure`** |
| metrics auto-config module | inside `spring-boot-actuator-autoconfigure` | **`spring-boot-micrometer-metrics`** |
| starter | `spring-boot-starter-actuator` only | `spring-boot-starter-actuator` **or** `spring-boot-starter-micrometer-metrics` |

`spring-boot-starter-actuator:4.1.0`'s own POM depends on `spring-boot-starter-micrometer-metrics`,
so adding the actuator starter still gives you everything. The new capability is the other
direction: **you can now have Micrometer auto-configuration without Actuator**, by depending only
on `spring-boot-starter-micrometer-metrics`. For a batch job or a message consumer that pushes to
OTLP and has no HTTP port worth exposing, that is a real reduction in surface area.

## The facade, in Micrometer's own words

> *"Micrometer is a metrics instrumentation library for JVM-based applications. It provides a
> simple facade over the instrumentation clients for the most popular monitoring systems, letting
> you instrument your JVM-based application code without vendor lock-in. It is designed to add
> little to no overhead to your metrics collection activity while maximizing the portability of
> your metrics effort."*

And on dependencies:

> *"The `micrometer-core` module aims to have minimal dependencies. It does not require any
> third-party (non-Micrometer) dependencies on the classpath at compile time for applications
> that use Micrometer, except for JSpecify."*

That is the SLF4J bargain: a library can instrument itself against `micrometer-core` and impose
essentially nothing on the application that consumes it. Spring Framework, Spring Data, Hikari,
Kafka's client and the Java HTTP client all take that bargain, which is why you get their meters
for free — see [06 · What Boot gives you free](06-what-boot-gives-you-free.md).

Two runtime dependencies are **optional and load-bearing**, and the documentation is explicit:

> *"Use of the pause detection feature requires the LatencyUtils dependency
> (`org.latencyutils:LatencyUtils`) to be available on the classpath at runtime. … If you use
> client-side percentiles, you need HdrHistogram on the classpath at runtime. If you do not use
> client-side percentiles, you may exclude HdrHistogram from your application's runtime
> classpath."*

## `MeterRegistry` is the whole API surface

> *"Meters in Micrometer are created from and held in a `MeterRegistry`. Each supported monitoring
> system has an implementation of `MeterRegistry`."*

The registry is three things at once, and keeping them distinct saves confusion later:

1. **A factory.** `registry.counter(...)`, `Timer.builder(...).register(registry)`.
2. **A cache keyed by identity.** A meter is uniquely identified by **name + tags**. Calling
   `registry.counter("orders", "status", "paid")` twice returns the *same* counter.
3. **A policy point.** `registry.config()` carries the naming convention, the common tags, the
   pause detector, and the ordered list of [`MeterFilter`s](04c-meterfilter.md).

```java
// Registry as factory, cache and policy point
MeterRegistry registry = new SimpleMeterRegistry();

registry.config()
    .commonTags("application", "checkout")
    .meterFilter(MeterFilter.denyNameStartsWith("jvm.gc.pause"));

Counter a = registry.counter("orders.placed", "channel", "web");
Counter b = registry.counter("orders.placed", "channel", "web");
// a == b : same name, same tags, same meter
```

`SimpleMeterRegistry` holds the latest value of each meter in memory and exports nowhere. Boot
auto-configures one as a fallback so `/actuator/metrics` has something to show; it disables
itself once a real backend registry is present, and can be switched off with
`management.simple.metrics.export.enabled=false`.

## Composite and global registries

`CompositeMeterRegistry` fans one meter out to several backends. Boot uses this: it
*"auto-configures a composite `MeterRegistry` and adds a registry to the composite for each of
the supported implementations that it finds on the classpath"*.

The composite has one behaviour that is a genuine trap, stated in the reference:

> *"Increments are NOOP'd until there is a registry in the composite. The counter's count still
> yields 0 at this point."*

A meter created against an empty composite is a live object that discards everything. Adding a
registry later starts recording — but nothing recorded before that moment is recoverable.

`Metrics.globalRegistry` is a static composite with static helpers (`Metrics.counter(...)`).
Boot binds its auto-configured registries into it unless you set
`management.metrics.use-global-registry=false`. The Boot reference's own instruction is blunt:

> *"Make sure to register your metrics by using the Spring-managed `MeterRegistry` and not any of
> the static methods on `Metrics`. These use the global registry that is not Spring-managed."*

The practical reason is ordering. Common tags and `MeterFilter`s are applied to the
Spring-managed registry by Boot's auto-configuration; a meter created through the static global
registry before that wiring has run misses them. And the reference is explicit that ordering
matters: *"Common tags generally have to be added to the registry before any (possibly
autoconfigured) meter binders."*

## Naming: lowercase, dot-separated, translated at the edge

> *"Micrometer employs a naming convention that separates lowercase words with a `.` (dot)
> character. … Each Micrometer implementation for a monitoring system comes with a naming
> convention that transforms lowercase dot notation names to the monitoring system's recommended
> naming convention."*

So you write `http.server.requests` and Prometheus sees underscores, Atlas sees camelCase,
Graphite sees dots. The consequence that costs people an afternoon: **the name in the code is the
name you use everywhere except in the backend's query bar.** The Boot reference spells it out for
`/actuator/metrics`:

> *"The name you use here should match the name used in the code, not the name after it has been
> naming-convention normalized for a monitoring system to which it is shipped. In other words, if
> `jvm.memory.max` appears as `jvm_memory_max` in Prometheus because of its snake case naming
> convention, you should still use `jvm.memory.max` as the selector when inspecting the meter in
> the metrics endpoint."*

## Gotchas

**★ No registry implementation on the classpath means no export, and nothing warns you.**
This is SLF4J's `NOP` problem with a different name. Boot's fallback `SimpleMeterRegistry` keeps
`/actuator/metrics` populated, so the application looks instrumented — `/actuator/metrics` lists
meters, values change — while nothing ever leaves the process. The check is
`micrometer-registry-prometheus` (or whichever) actually being a **runtime** dependency, not the
metrics endpoint returning data.

**★ Micrometer 1.17 is not "old" and 2.x does not exist.** People see Spring Boot 4 and assume a
matching major bump, then go looking for `io.micrometer` 2.x packages, find nothing, and conclude
their dependency resolution is broken. The Boot 4.1.0 POM pins `micrometer.version` to `1.17.0`,
and Micrometer's own docs list 1.17 as the current stable line. Nothing needs fixing.

**★ Boot 4 moved `MeterRegistryCustomizer`'s package and a copy-pasted Boot 3 configuration class
will not compile.** It is now
`org.springframework.boot.micrometer.metrics.autoconfigure.MeterRegistryCustomizer`. This bites
hardest when the code came from a blog post or an internal library that was not upgraded — the
`io.micrometer` imports around it are unchanged, so the failure looks arbitrary.

**★ `Metrics.globalRegistry` is not Spring-managed, and that is a correctness bug, not a style
issue.** Meters created on it bypass the common tags and `MeterFilter`s Boot applied to the
managed registry. The visible symptom is a handful of series missing the `application` or
`region` tag everything else has, which breaks exactly the dashboard queries that group by it.

**★ The same name with different tag *keys* is legal in Micrometer and a problem in Prometheus.**
The Prometheus implementation page: *"Prometheus strongly discourages users from creating meters
having the same name with a different set of tag keys."* Micrometer will register both happily.
The fix in the docs is to give both meters the full key set and use a filler value such as
`"none"` for the key that does not apply.

**★ A meter is cached by name **and tags**, so a "duplicate" registration with different tags is a
new meter, not a lookup.** This is how a cardinality bomb is built accidentally: the code looks
like one `registry.counter(...)` call, and it is one call per distinct tag value, forever.
[04b · Cardinality](04b-cardinality.md).

**★ Meters created against a composite before a registry joins it record nothing, silently.**
The documented behaviour is that increments are no-ops and `count()` stays at zero. Any
instrumentation that runs during early startup — a static initialiser, a `@PostConstruct` on a
bean built before the registries — is in that window.

**★ Not depending on Actuator is now a supported way to have metrics.**
`spring-boot-starter-micrometer-metrics` gives you the auto-configuration without the endpoint
infrastructure. Worth knowing precisely because most documentation still assumes the two are the
same dependency, so people add the whole actuator to a batch job that has no HTTP server.

## Interview questions

**★ What problem does Micrometer solve, and what does it *not* solve?**
It decouples the act of instrumenting code from the choice of monitoring backend, in the way
SLF4J decouples logging calls from a logging implementation — so a library can ship meters
without imposing Prometheus or Datadog on its consumers, and an application can change backend
without touching instrumentation. What it does not solve is *what* to measure, or the cardinality
of what you measure, or the semantics of the numbers once they reach the backend. Those are
design decisions the facade faithfully transmits, including the bad ones.

**★ How does the registry decide whether a call creates a new meter or returns an existing one?**
By meter identity, which is name plus the complete set of tags. `registry.counter("a", "k", "1")`
and `registry.counter("a", "k", "2")` are two distinct meters, two distinct time series, and two
distinct entries in the registry's memory for the process's lifetime. That identity rule is what
makes an unbounded tag value an unbounded memory leak as well as an unbounded billing line.

**★ Why does Spring Boot auto-configure a composite registry rather than a single one?**
Because backend choice is a classpath decision and there can legitimately be more than one — a
Prometheus scrape endpoint for the platform team and an OTLP push for a vendor, for instance. The
composite lets a single meter created once fan out to all of them, so instrumentation code never
knows how many destinations exist. The cost is the documented no-op window: a meter created
against a composite that is still empty records nothing.

**★ What version of Micrometer does Spring Boot 4.1 use, and why does that question matter?**
1.17.0, pinned by `spring-boot-dependencies:4.1.0` — Micrometer has no 2.x line. It matters
because it settles package names: everything stays under `io.micrometer.core.instrument`. The
package churn in Boot 4 is on the Spring side, where metrics auto-configuration moved out of
`spring-boot-actuator-autoconfigure` into a new `spring-boot-micrometer-metrics` module, taking
`MeterRegistryCustomizer` to `org.springframework.boot.micrometer.metrics.autoconfigure` with it.

**★ Why does the Boot reference tell you not to use `Metrics.counter(...)`?**
Because `Metrics` writes to a static global composite registry that Spring does not own. Boot
applies common tags, per-meter properties and `MeterFilter` beans to the *managed* registry
during auto-configuration; anything registered on the global one either misses that wiring or
races it, depending on when the class initialises. The result is a subset of your series lacking
the tags every dashboard groups by, which is a hard bug to see because the metric exists and its
value is correct.

**★ You are told metrics "aren't showing up in Grafana" but `/actuator/metrics` lists them. Where
do you look?**
At the export path, not the instrumentation. `/actuator/metrics` reads the in-memory registry, so
it is satisfied by Boot's fallback `SimpleMeterRegistry` and proves only that the meter exists.
Check in order: is a registry implementation such as `micrometer-registry-prometheus` on the
runtime classpath; is the export enabled (`management.prometheus.metrics.export.enabled`); is the
endpoint exposed (`management.endpoints.web.exposure.include`); is the scrape config pointing at
the right path and port. [09 · Exporting to Prometheus](09-exporting-to-prometheus.md) is the
ordered version of that list.

{/* FOOTER */}
