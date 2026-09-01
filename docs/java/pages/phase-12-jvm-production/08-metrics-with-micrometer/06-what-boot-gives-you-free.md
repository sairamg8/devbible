---
title: "Spring Boot registers several hundred meters before your first line of instrumentation runs, and the ones that matter most to you are precisely the handful it leaves switched off"
sidebar_label: "06 · What Boot gives you free"
sidebar_position: 15
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **Spring Boot 4.1 production-ready reference · Metrics** —
> *Getting Started*, *Supported Metrics and Meters*, *Registering Custom Metrics*
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/actuator/metrics.html)) and
> *Observability*
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/actuator/observability.html)),
> the **Spring Framework 7 reference · Integration · Observability**
> ([docs.spring.io](https://docs.spring.io/spring-framework/reference/integration/observability.html)),
> and **`spring-boot-dependencies:4.1.0`** for artifact names. Actuator itself is Phase 9 topic 13
> — this page is about the meters, not the endpoints. No JVM was run for this page. JDK 25 ·
> Spring Boot 4.1.0 / Spring Framework 7.0.8 · Micrometer 1.17.0.

**The most common mistake in a first metrics review is instrumenting something Boot already
instruments. The second most common is assuming that because Boot instruments a category, it has
instrumented *your* instance of it. This page is the inventory, and the more useful half of it is
the list of things that are present in the documentation and absent from your running process.**

## How a registry gets chosen

> *"Spring Boot auto-configures a composite `MeterRegistry` and adds a registry to the composite
> for each of the supported implementations that it finds on the classpath. Having a dependency on
> `micrometer-registry-{system}` in your runtime classpath is enough for Spring Boot to configure
> the registry."*

So the decision is made by your dependency list, not by configuration. On Boot 4 the metrics
support is its own starter:

```xml
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-micrometer-metrics</artifactId>
</dependency>
<dependency>
  <groupId>io.micrometer</groupId>
  <artifactId>micrometer-registry-prometheus</artifactId>
</dependency>
```

*(Both artifact ids are managed by `spring-boot-dependencies:4.1.0`; the registry version comes
from the Micrometer BOM, so no `<version>` is needed. `micrometer-registry-prometheus` is the
current Prometheus Java client 1.x binding —
`micrometer-registry-prometheus-simpleclient` is the legacy 0.x one.)*

Turning registries off is per-registry or wholesale:

```properties
management.datadog.metrics.export.enabled=false
management.defaults.metrics.export.enabled=false
```

And there is a fallback you may be looking at without realising:

> *"Micrometer ships with a simple, in-memory backend that is automatically used as a fallback if
> no other registry is configured. This lets you see what metrics are collected in the metrics
> endpoint. The in-memory backend disables itself as soon as you use any other available backend."*

## The inventory

Everything below is quoted or paraphrased from Boot's *Supported Metrics and Meters* section. The
right-hand column is the part worth reading.

| Family | Prefix | Conditions and traps |
|---|---|---|
| JVM | `jvm.` | memory and buffer pools, GC, threads, classes loaded/unloaded, JVM version, JIT compilation time. **Virtual-thread statistics need `io.micrometer:micrometer-java21` on the classpath.** |
| System | `system.`, `process.`, `disk.` | CPU, file descriptors, uptime and a fixed gauge of the absolute start time, disk space available |
| Startup | `application.started.time`, `application.ready.time` | *"Metrics are tagged by the fully qualified name of the application class."* |
| Logging | `logback.events.`, `log4j2.events.` | event counts by level — the cheapest error signal you have |
| Task execution | — | *"all available `ThreadPoolTaskExecutor` and `ThreadPoolTaskScheduler` beans, as long as the underlying `ThreadPoolExecutor` is available"*, tagged by bean name |
| HTTP server | `http.server.requests` | MVC, WebFlux and Jersey. Name overridable with `management.observations.http.server.requests.name` |
| HTTP client | `http.client.requests` | ⚠️ **only for clients built from the auto-configured builders** |
| JMS | `jms.message.publish`, `jms.message.process` | `JmsTemplate` beans and `@JmsListener` methods |
| Tomcat | `tomcat.` | ⚠️ **off unless `server.tomcat.mbeanregistry.enabled=true`** |
| Jetty | — | thread pool, connectors, and SSL handshakes when `server.ssl.enabled=true` |
| Caches | `cache.` | Cache2k, Caffeine, Hazelcast, any JCache, Redis. ⚠️ **only caches configured at startup** |
| DataSource | `jdbc.connections.` | gauges for active, idle, max and min; tagged by `DataSource` bean name |
| HikariCP | `hikaricp.` | tagged by pool name, from `spring.datasource.name` |
| Hibernate | `hibernate.` | ⚠️ needs `org.hibernate.orm:hibernate-micrometer` **and** `hibernate.generate_statistics=true` |
| Spring Data | `spring.data.repository.invocations` | tagged `repository`, `method`, `state`, `exception` |
| SSL | `ssl.chain.expiry` | seconds until expiry, *"negative if the chain has already expired"* |
| MongoDB | `mongodb.driver.commands`, `mongodb.driver.pool.` | command timer plus three pool gauges |
| Kafka, RabbitMQ, Neo4j, Integration, Batch, GraphQL, Redis | various | listener/binder based; see the reference for each |

## The five things that are documented and absent

This is the half of the page that changes an audit.

**1 · Tomcat metrics.** *"Auto-configuration enables the instrumentation of Tomcat only when an
MBean Registry is enabled. By default, the MBean registry is disabled."* So your request thread
pool — the resource every request contends for — has no meters until:

```properties
server.tomcat.mbeanregistry.enabled=true
```

**2 · Hibernate statistics.** Two conditions, both easy to half-satisfy: the
`hibernate-micrometer` artifact, *and* `hibernate.generate_statistics`:

```properties
spring.jpa.properties[hibernate.generate_statistics]=true
```

**3 · Virtual-thread statistics.** Present in the list only *"for this,
`io.micrometer:micrometer-java21` has to be on the classpath"*. On a Boot 4 service running
virtual threads this is the difference between having and not having any visibility of them.

**4 · Caches created after startup.** *"Only caches that are configured on startup are bound to the
registry. For caches not defined in the cache's configuration, such as caches created on the fly or
programmatically after the startup phase, an explicit registration is required. A
`CacheMetricsRegistrar` bean is made available to make that process easier."* Dynamically named
caches — a very common pattern — are therefore invisible by default.

**5 · HTTP clients you constructed yourself.** This is the big one:

> *"Spring Boot Actuator manages the instrumentation of `RestTemplate`, `WebClient` and
> `RestClient`. For that, you have to inject the auto-configured builder and use it to create
> instances."*

```java
// instrumented: metrics AND trace propagation
@Bean
RestClient paymentsClient(RestClient.Builder builder) {
    return builder.baseUrl("https://payments.internal").build();
}

// NOT instrumented: no http.client.requests, and no traceparent header either
@Bean
RestClient brokenClient() {
    return RestClient.create();          // never do this
}
```

The consequence is doubled, because the same builders carry tracing: the Boot tracing chapter
warns *"If you create the `RestTemplate`, the `RestClient` or the `WebClient` without using the
auto-configured builders, automatic trace propagation won't work!"* One `new` costs you the metric
*and* the trace ([09 · Context
propagation](../09-distributed-tracing/03-context-propagation.md)).

## Adding your own alongside them

Inject the registry — and note which registry:

> *"Make sure to register your metrics by using the Spring-managed `MeterRegistry` and not any of
> the static methods on `Metrics`. These use the global registry that is not Spring-managed."*

When a meter depends on another bean, register it as a `MeterBinder` rather than in a constructor:

```java
@Bean
public MeterBinder queueSize(Queue queue) {
    return (registry) -> Gauge.builder("queueSize", queue::size).register(registry);
}
```

> *"Using a `MeterBinder` ensures that the correct dependency relationships are set up and that the
> bean is available when the metric's value is retrieved."*

That is not a style preference. It is the documented fix for the ordering problem behind half of
[03b · The gauge that was garbage collected](03b-the-gauge-that-was-garbage-collected.md) and for
the common-tag ordering problem in [04a](04a-common-tags.md).

## Turning things off

Per meter, by prefix, using properties:

```properties
management.metrics.enable.jvm=false
management.metrics.enable.example.remote=false
```

Or a filter, which reaches meters properties cannot name:

```java
@Bean
MeterFilter denyTomcatSessions() {
    return MeterFilter.denyNameStartsWith("tomcat.sessions");
}
```

⚠️ Think twice before denying `jvm.` to save money. Those meters are among the cheapest in the
process — a few dozen series with no unbounded tags — and they are the ones you need during the
incident that made you look at metrics cost in the first place. The expensive thing is nearly
always a percentile histogram on a well-tagged timer ([08b](08b-histograms-and-buckets.md)).

## Gotchas

**★ `new RestTemplate()` silently loses both the client metric and the trace.** No error, no
warning, no missing bean. The only symptom is an absent `http.client.requests` series for that
target and a trace that stops at your service. Grep your codebase for `new RestTemplate(`,
`RestClient.create(` and `WebClient.create(` as a five-minute audit.

**★ Tomcat metrics are off by default, so your busiest resource has no meters.** One property
fixes it. Until then, [05b · USE for a JVM service](05b-use-for-a-jvm-service.md)'s request-thread
row is empty for you.

**★ Hibernate metrics need two independent things and failing either gives you silence.** The
`hibernate-micrometer` dependency and `hibernate.generate_statistics=true`. Adding the dependency
alone is the usual half-fix.

**★ Caches created programmatically after startup are not instrumented.** The documented remedy is
a `CacheMetricsRegistrar` bean. If your cache names are derived from tenants or regions at runtime,
this is you.

**★ Virtual-thread metrics require an extra artifact.** `io.micrometer:micrometer-java21`. On a
JDK 25 service using virtual threads for request handling, its absence is the difference between
seeing pinning and mount pressure and not seeing them.

**★ `Metrics.globalRegistry` is not the Spring-managed registry.** Meters registered through the
static methods bypass your `MeterRegistryCustomizer` beans and therefore your common tags, and
`management.metrics.use-global-registry=false` changes whether Boot's registries are even added to
it.

**★ Boot's HTTP metrics are observations, so `management.metrics.enable.*` is not the whole
story.** Denying the meter leaves the observation — and therefore the span — running. Suppressing
the observation itself is `management.observations.enable.*` or an `ObservationPredicate`
([04a](04a-common-tags.md)).

**★ Annotating an already-instrumented method produces duplicate observations.** Boot says so:
*"When you annotate methods or classes which are already instrumented (for example, Spring Data
repositories or Spring MVC controllers), you will get duplicate observations."* Choose one — the
annotation or the automatic instrumentation — and disable the other.

**★ Spring Data repository metrics are on for every invocation by default.** They can be narrowed
to annotated methods with `management.metrics.data.repository.autotime.enabled=false`, which
matters because the `method` tag makes the cardinality proportional to your repository surface.

**★ The startup meters are tagged by the application class's fully qualified name, which makes
them awkward to aggregate.** `application.ready.time` is genuinely useful for tracking startup
regressions — see **Topic 10 · Packaging for deploy** *(not written yet)* — but the tag
is per-application, so a fleet-wide panel needs the tag stripped or the query pinned.

**★ The in-memory `SimpleMeterRegistry` fallback means "metrics work" locally and prove nothing.**
It disables itself as soon as a real backend is present, so a local run that shows meters in
`/actuator/metrics` tells you nothing about whether your Prometheus wiring is correct.

## Interview questions

**★ A colleague says the outbound call to the payments service has no metrics. Where do you look
first?**
At how the client was constructed. Boot instruments `RestTemplate`, `RestClient` and `WebClient`
only when they are built from the auto-configured builders, so a `RestClient.create()` or a
`new RestTemplate()` anywhere in the bean graph produces a completely uninstrumented client. There
is no error and no missing bean — the call simply happens outside the observation. The same
mistake also drops trace propagation, so if the trace for that request stops at your service, that
is confirmation rather than a second problem.

**★ Which Boot metrics are documented but disabled by default, and why does it matter?**
Tomcat's, which need `server.tomcat.mbeanregistry.enabled=true`; Hibernate's, which need both an
extra artifact and `hibernate.generate_statistics=true`; and virtual-thread statistics, which need
`micrometer-java21`. It matters because each of them covers a resource you would want during an
incident — the request thread pool, the persistence layer, and the carrier threads — and because
their absence looks identical to "we have no problem there". The audit question is not "do we have
metrics" but "which rows of the resource table are empty".

**★ Why does the documentation recommend a `MeterBinder` bean over registering a gauge in a
component constructor?**
Two reasons, and the second is the one that bites. It makes the dependency relationship explicit,
so the bean being gauged is guaranteed to exist when the value is read. And it defers registration
to a point in the lifecycle where Boot has already applied customizers and filters, which means the
meter gets your common tags. A gauge registered in a constructor can be created before common tags
are installed and can capture a reference to an object whose lifecycle you have not thought about —
which is the mechanism behind gauges that report `NaN`.

**★ You want to reduce metric cost. Is denying `jvm.*` a good first move?**
No. The JVM binders produce a bounded, tag-poor set of series that costs almost nothing and is the
first thing you will want during an incident. The cost in a typical service is concentrated in
percentile histograms on timers with several tags, where each tag combination costs dozens of
bucket series. Measure before cutting: the meter with the most *series*, not the family with the
most *names*, is what you are paying for.

**★ What is the relationship between `management.metrics.enable.*` and
`management.observations.enable.*` on Boot 4?**
The first is a meter filter — it stops a meter being registered on the registry. The second is an
observation predicate — it stops the observation from running at all. Because Boot 4's HTTP, JMS,
scheduled-task and Spring Data instrumentation is observation-based, denying the *meter* removes
the metric but leaves the observation and therefore the span. If your intent is "stop measuring
this entirely", you want the observation property; if it is "keep the trace, drop the metric", you
want the metrics one.

**★ How would you audit a service's free metrics in ten minutes?**
Hit `/actuator/metrics` and read the list of names against the documented families. Confirm the
five conditional ones are present: `tomcat.`, `hibernate.`, virtual-thread meters,
`http.client.requests` for every downstream you know about, and `cache.` entries for every cache
you know about. Then grep for `new RestTemplate(`, `RestClient.create(` and `WebClient.create(`.
Every gap that survives those two checks is either a missing dependency, a missing property, or a
client built the wrong way, and all three are one-line fixes.

{/* FOOTER */}
