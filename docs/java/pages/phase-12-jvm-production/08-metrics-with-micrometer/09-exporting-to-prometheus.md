---
title: "Prometheus pulls, which means your process holds every number until somebody asks for it, and every operational property of your metrics — what a restart costs, what a missed scrape costs, what a batch job cannot do — follows from that one design decision"
sidebar_label: "09 · Exporting to Prometheus"
sidebar_position: 26
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **Spring Boot 4.1 production-ready reference · Metrics —
> Prometheus, Simple, Metrics Endpoint**
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/actuator/metrics.html)) and
> *Observability — OpenTelemetry Support*
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/actuator/observability.html)), the
> **Micrometer 1.17 reference · Implementations · Prometheus**
> ([docs.micrometer.io](https://docs.micrometer.io/micrometer/reference/implementations/prometheus.html))
> and *Concepts · Rate Aggregation*, and **`spring-boot-dependencies:4.1.1`** for artifact and
> client versions. Actuator endpoint exposure is Phase 9 topic 13 —
> [02 · Exposure, access and ports](../../phase-9-spring-boot/13-actuator/02-exposure-access-and-ports.md).
> No JVM was run for this page and no scrape output appears below. JDK 25 · Spring Boot 4.1.1 ·
> Micrometer 1.17.0 · Prometheus Java client 1.5.1.

**A push-based backend receives what your process decided to send. A pull-based one comes and takes
a snapshot of state your process is holding. That difference is not a deployment detail — it
determines whether a missed interval loses data, whether a short-lived process can be measured at
all, and why the same `Counter.increment()` means two different things depending on which registry
is installed.**

## The model

> *"Prometheus is a dimensional time series database with a built-in UI, a custom query language,
> and math operations. Prometheus is designed to operate on a pull model, periodically scraping
> metrics from application instances, based on service discovery."*

Your process holds a cumulative value per meter; the scraper takes a snapshot; the server
differentiates at query time ([03e](03e-rate-aggregation-and-the-step-registry.md)). Three
consequences follow immediately:

- **A missed scrape costs almost nothing.** The next snapshot still carries the full total, and
  `rate()` extrapolates over the gap.
- **A process restart is a documented event**, because a counter reset to zero is part of the
  counter contract and `rate()` repairs it.
- **A process that exits before it is scraped is invisible.** There is nothing to pull from. This is
  the one real gap in the model, and it has a specific answer below.

## Wiring it

```xml
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-actuator</artifactId>
</dependency>
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-micrometer-metrics</artifactId>
</dependency>
<dependency>
  <groupId>io.micrometer</groupId>
  <artifactId>micrometer-registry-prometheus</artifactId>
</dependency>
```

> *"Spring Boot provides an actuator endpoint at `/actuator/prometheus` to present a Prometheus
> scrape with the appropriate format. **By default, the endpoint is not available and must be
> exposed.**"*

```properties
management.endpoints.web.exposure.include=health,prometheus
management.server.port=8081
```

*(The exposure and management-port mechanics belong to
[Phase 9 · Actuator](../../phase-9-spring-boot/13-actuator/02-exposure-access-and-ports.md); the
point here is only that the endpoint is off until you say otherwise.)*

And the scraper side, quoted:

```yaml
scrape_configs:
- job_name: "spring"
  metrics_path: "/actuator/prometheus"
  static_configs:
  - targets: ["HOST:PORT"]
```

⚠️ **`micrometer-registry-prometheus` is the current binding, over the Prometheus Java client 1.x.**
Micrometer: *"there are two versions of it and Micrometer supports both. If you want to use the
'new' client (1.x), use `micrometer-registry-prometheus` but if you want to use the 'legacy' client
(0.x), use `micrometer-registry-prometheus-simpleclient`."* Boot 4.1 manages client `1.5.1`; the
simpleclient path is legacy and Boot describes its exemplar support as *"the deprecated Prometheus
simpleclient support"*.

## What the registry actually does

There is no exporter thread. The registry holds the meters and renders them on demand:

> *"The `PrometheusMeterRegistry` has a `scrape()` function that knows how to supply the `String`
> data necessary for the scrape. All you have to do is wire it to an endpoint."*

Boot wires it to `/actuator/prometheus` for you. Outside Boot you would hang it off any HTTP server,
which is worth knowing because it tells you exactly how much machinery is involved: one method, one
route.

The format is negotiable:

> *"By default, the `PrometheusMeterRegistry` `scrape()` method returns the Prometheus text format.
> The OpenMetrics format can also be produced. To specify the format to be returned, you can pass a
> content type to the scrape method."*

That matters for exactly one feature.

## Exemplars, in one line

The Prometheus registry can attach a trace id to individual histogram observations, turning a spike
on a latency panel into a link to one real slow request. It has four independent preconditions and
fails silently if any is missing — [09b · Exemplars](09b-exemplars.md).

## The gap: processes too short-lived to scrape

> *"For ephemeral or batch jobs that may not exist long enough to be scraped, you can use Prometheus
> Pushgateway support to expose the metrics to Prometheus."*

```xml
<dependency>
  <groupId>io.prometheus</groupId>
  <artifactId>prometheus-metrics-exporter-pushgateway</artifactId>
</dependency>
```

```properties
management.prometheus.metrics.export.pushgateway.enabled=true
```

> *"When the Prometheus Pushgateway dependency is present on the classpath and the
> `management.prometheus.metrics.export.pushgateway.enabled` property is set to `true`, a
> `PrometheusPushGatewayManager` bean is auto-configured. This manages the pushing of metrics to a
> Prometheus Pushgateway."*

🔴 The Pushgateway is for **jobs, not services**. A long-running service pushing to it loses
everything the pull model gives you — target-attached `instance` and `job` labels, up/down
detection, and the guarantee that a stale value stops appearing when the process dies. A Pushgateway
holds the last value it was given until something deletes it, which is exactly right for "the
nightly reconciliation finished at 03:14" and exactly wrong for "the order service's request rate".

## The other backends, and the trap they set

The same instrumentation code exports to Datadog, StatsD, Influx or OTLP by changing a dependency.
What changes with it is the *meaning of the exported number*, because those are step registries:
Micrometer accumulates into a step value, rotates it when the interval elapses, and reports the
previous interval — *"the value returned by the poll function is always rate per second \*
interval"*. So "we moved from Prometheus to Datadog and all the counters look like they reset every
minute" is the documented behaviour, not a regression
([03e](03e-rate-aggregation-and-the-step-registry.md)).

Boot's OpenTelemetry chapter is unusually blunt about where metrics belong in that stack:

> *"The choice of metrics in the Spring portfolio is Micrometer, which means that metrics are not
> collected and exported through the OpenTelemetry's `SdkMeterProvider`. Spring Boot doesn't provide
> a `SdkMeterProvider` bean."*

> *"However, Micrometer metrics can be exported via OTLP to any OpenTelemetry capable backend using
> the `OtlpMeterRegistry`."*

So OTLP is available as a *Micrometer registry*, not as an OpenTelemetry SDK pipeline — which also
means: *"Micrometer's OTLP registry doesn't use the `Resource` bean, but setting
`OTEL_RESOURCE_ATTRIBUTES`, `OTEL_SERVICE_NAME` or `management.opentelemetry.resource-attributes`
works."*

## The endpoint you will actually use while debugging

`/actuator/metrics` is not a scrape format and is not for Prometheus. It is for you:

> *"Navigating to `/actuator/metrics` displays a list of available meter names. You can drill down to
> view information about a particular meter by providing its name as a selector — for example,
> `/actuator/metrics/jvm.memory.max`."*

> *"The name you use here should match the name used in the code, not the name after it has been
> naming-convention normalized for a monitoring system to which it is shipped."*

and the aggregation rule, which surprises everyone once:

> *"The reported measurements are the sum of the statistics of all meters that match the meter name
> and any tags that have been applied."*

So `/actuator/metrics/jvm.memory.max` returns a *sum across memory areas*, and narrowing it needs
`?tag=area:nonheap&tag=id:Metaspace`.

## Gotchas

**★ The Prometheus endpoint is not exposed by default.** One property. Until then the dependency is
present, the registry exists, and the scrape 404s.

**★ A Pushgateway value outlives the process that pushed it.** The gateway holds the last value
until it is deleted, so a crashed job's metrics keep being scraped and look current. This is why the
Pushgateway is for jobs with a defined end, not for services.

**★ Pushing from a service throws away target labels and up/down detection.** `instance`, `job` and
any relabelled service-discovery metadata come from the scrape configuration. A pushed metric has
whatever labels the pusher invented.

**★ `/actuator/metrics` uses the code name and sums across tags.** `jvm.memory.max`, not
`jvm_memory_max`, and the value is a sum over every matching meter until you narrow it with `tag=`
parameters. Reading it as "the max heap" is wrong.

**★ Switching registries changes what a counter's exported value means.** Cumulative on Prometheus,
per-interval on step registries. Dashboards and alerts do not port between them unchanged.

**★ The scrape happens on a request thread and renders every meter.** A process with hundreds of
thousands of series has a scrape that is slow and allocates; if scrape duration approaches the
scrape interval you have a metrics problem that presents as a monitoring gap
([04b](04b-cardinality.md)).

**★ The in-memory `SimpleMeterRegistry` is a silent fallback.** *"Micrometer ships with a simple,
in-memory backend that is automatically used as a fallback if no other registry is configured."*
So `/actuator/metrics` working locally proves nothing about your Prometheus wiring.

**★ Exposing the scrape on the application port exposes it to your users.** Metric names and tags
leak endpoint inventories, tenant names and internal service names. A separate `management.server.port`
or a network policy is the minimum ([Phase 9 · Actuator ·
19](../../phase-9-spring-boot/13-actuator/19-securing-the-endpoints.md)).

**★ `micrometer-registry-prometheus-simpleclient` is the legacy 0.x binding.** It still exists and
still works; new services should be on `micrometer-registry-prometheus`, and Boot's exemplar
documentation refers to the simpleclient path as deprecated.

## Interview questions

**★ Why does Prometheus pull rather than push, and what does that buy you?**
Because the scraper then owns the schedule, the target list and the identity of each target, which
makes several operational problems disappear. The scraper knows whether a target answered, so
up/down detection is free; it attaches `instance` and `job` from service discovery, so the
application does not have to know its own identity; and because the application holds a cumulative
value rather than emitting deltas, a missed scrape costs nothing — the next one still carries the
full total, and `rate()` extrapolates over the gap. The cost is that a process which exits before
being scraped is invisible, which is what the Pushgateway exists for.

**★ When is a Pushgateway the right answer, and when is it a mistake?**
Right for a job with a defined end that may not live long enough to be scraped — a nightly batch, a
migration, a cron task. Wrong for anything long-running, because pushing discards everything the
pull model provides: the gateway holds the last value it received until something deletes it, so a
crashed job's metrics continue to be scraped and look current; there is no up/down signal; and the
labels are whatever the pusher invented rather than what service discovery knows. The failure is
particularly nasty because a dead service's metrics look alive.

**★ You migrate a service from Prometheus to Datadog and every counter appears to reset each
minute. What happened?**
Nothing broke. Datadog's registry is a step registry, so Micrometer accumulates into a step value
for the publishing interval, rotates it to "previous" when the interval elapses, and reports that —
the documented poll semantics are "rate per second times interval". Prometheus is a
server-side-rate system, so the same meter is exported cumulatively there and Prometheus does the
differentiation. The instrumentation is identical; only the export style changed, and dashboards
written against one style do not port to the other.

**★ Why does `/actuator/metrics/jvm.memory.max` return a number that is not your maximum heap?**
Because the endpoint sums the statistics of every meter matching the name and any tags supplied, and
`jvm.memory.max` has one series per memory area and pool. The returned value is therefore the sum of
the maximum footprints of heap and non-heap areas together. Narrowing it requires the tag selectors
— `?tag=area:heap`, or `?tag=area:nonheap&tag=id:Metaspace` — and the name you pass is the code name
with dots, not the snake-cased exported one.

**★ Your scrape is taking a long time. What does that tell you and what do you do?**
That the registry has a great many series to render, since the scrape walks every meter and builds
the response on a request thread. It is a cardinality symptom before it is a performance symptom:
check `scrape_samples_scraped` per target for a rising trend against flat traffic, then look at the
top meter names by series count. If scrape duration approaches the scrape interval you start losing
samples, so a metrics problem becomes a monitoring outage. The fixes are the cardinality ones —
bound the offending tag, reconsider percentile histograms — not a longer timeout.

**★ Where does OTLP fit for metrics in a Spring Boot 4 service?**
As a Micrometer registry, not as an OpenTelemetry SDK pipeline. Boot states that the Spring
portfolio's choice for metrics is Micrometer and that it does not provide an `SdkMeterProvider`
bean, so metrics do not flow through OpenTelemetry's metrics API. What you get instead is
`OtlpMeterRegistry`, which exports Micrometer's meters over OTLP to any OTel-capable backend. One
practical wrinkle: that registry does not use Boot's `Resource` bean, so resource attributes have to
come from `OTEL_RESOURCE_ATTRIBUTES`, `OTEL_SERVICE_NAME` or
`management.opentelemetry.resource-attributes`.

{/* FOOTER */}
