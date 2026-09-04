---
title: "What Boot already measures"
sidebar_label: "9 · What Boot already measures"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against the Spring Boot 4.1.1 reference — *Actuator ·
> Metrics · Supported Metrics and Meters*
> (docs.spring.io/spring-boot/reference/actuator/metrics.html: the JVM, system,
> startup, logger, task-execution, HTTP server and client, Tomcat, Jetty, cache,
> data source, Hibernate, Spring Data repository, RabbitMQ, Kafka, MongoDB,
> Redis and SSL metric families with their prefixes and tags;
> `management.metrics.enable.*`; `server.tomcat.mbeanregistry.enabled`; the
> metrics endpoint's `?tag=key:value` drill-down; and the Prometheus endpoint's
> `micrometer-registry-prometheus` requirement). Spring Boot 4.1.1, Spring
> Framework 7.0.x, JDK 25.

**Most of the metrics a service needs already exist before you write a line of
instrumentation, and a surprising amount of hand-rolled monitoring code is a
reimplementation of something the actuator starter already publishes. Knowing
the catalogue is what stops you writing an error-rate counter that Logback is
already keeping.**

## The catalogue

| Family | Prefix / name | Notes |
|---|---|---|
| JVM | `jvm.*` | memory, buffer pools, GC, threads, class loading, JIT compilation time; virtual-thread statistics need `io.micrometer:micrometer-java21` |
| System | `system.*`, `process.*`, `disk.*` | CPU, file descriptors, uptime, free disk |
| Startup | `application.started.time`, `application.ready.time` | tagged with the main class's fully qualified name |
| Logging | `logback.events.*`, `log4j2.events.*` | log event counts by level |
| HTTP server | `http.server.requests` | tags `method`, `uri`, `status`, `outcome`, `exception` |
| HTTP client | `http.client.requests` | instruments clients built from `RestClient.Builder`, `WebClient.Builder` and `RestTemplateBuilder` |
| Data source | `jdbc.connections.*`, `hikaricp.*` | active/idle/max/min gauges, tagged by `DataSource` bean name |
| Caches | `cache.*` | Cache2k, Caffeine, Hazelcast, JCache, Redis; tagged by cache name and `CacheManager` bean name |
| Task execution | executor metrics | `ThreadPoolTaskExecutor` and `ThreadPoolTaskScheduler`, tagged by bean name |
| Tomcat | `tomcat.*` | requires `server.tomcat.mbeanregistry.enabled=true` |
| Jetty | thread pool, connections, SSL handshakes | bound automatically when Jetty is the server |
| Spring Data | `spring.data.repository.invocations` | tags `repository`, `method`, `state`, `exception` |
| Hibernate | `hibernate` | needs `hibernate-micrometer` and `spring.jpa.properties[hibernate.generate_statistics]=true` |
| Messaging | `rabbitmq`, `jms.message.publish`, `jms.message.process`, Kafka listener metrics | per technology |
| MongoDB | `mongodb.driver.commands`, `mongodb.driver.pool.*` | command and connection-pool metrics |
| SSL | `ssl.chain.expiry` | seconds until expiry, negative when already expired |

Three of these are worth calling out because teams routinely build them by hand.

**`logback.events`** is an error-rate metric nobody has to write. A counter of
log events by level, already tagged, already exported — the "how many errors are
we logging" dashboard panel is one query away and does not require a single
`errorCounter.increment()` call scattered through catch blocks.

**`ssl.chain.expiry`** reports seconds to expiry per certificate, per bundle,
negative once expired. That is a far better home for certificate-expiry alerting
than a health status: a metric has a *trend* and can alert at thirty days,
whereas a health status can only tell you the certificate is already a problem.

**`application.ready.time`** is the number to watch when somebody claims
startup time has not regressed. It is tagged by main class and it is recorded
every start, so the regression is visible as a step in a graph rather than an
argument about whose laptop is faster.

The one that needs a nudge is Tomcat: `tomcat.*` sits behind
`server.tomcat.mbeanregistry.enabled=true`, because registering the MBeans costs
something. Its absence is a configuration fact, not a bug.

## Turning families on and off

```properties
management.metrics.enable.jvm=true
management.metrics.enable.process=false
```

The property is prefix-matched against meter names, so
`management.metrics.enable.jvm=false` disables the whole `jvm.*` family and
`management.metrics.enable.jvm.gc=false` disables only the collection
sub-family. This is the cheapest lever for cutting export volume, and it is
worth reaching for before anything more clever — a large share of a metrics bill
is families nobody has ever queried.

## `http.server.requests`, and the tag that saves you

The HTTP server timer is the metric you will spend the most time with, and its
`uri` tag is the reason it works: the value is the **URI template**
(`/orders/{id}`), not the actual path (`/orders/91f2…`). Without that
substitution every distinct order id would be a distinct time series, which is
the cardinality failure in
[the cardinality chunk](11-tags-filters-cardinality.md) at industrial scale.

This has a direct consequence: **a request that does not match a handler
mapping has no template to report.** Boot handles that by tagging unmatched
requests as `NOT_FOUND` or `root` rather than by their literal path, which is
what stops a scanner spraying random URLs from creating a million series. If you
write a custom URI tag provider, preserving that behaviour is the whole job.

The `outcome` tag deserves a mention too: it buckets the status into
`SUCCESS`, `CLIENT_ERROR`, `SERVER_ERROR` and so on, which is usually what a
dashboard actually wants and saves a status-range expression in every query.

## Reading them: the metrics endpoint

`/actuator/metrics` lists meter names, `/actuator/metrics/{name}` describes one
including its available tags, and a drill-down narrows it:

```
/actuator/metrics/http.server.requests?tag=status:500&tag=uri:/orders/{id}
```

That endpoint is a **debugging tool, not a monitoring interface.** It reports
what the in-memory registry currently holds for *this instance*, with no history
and no aggregation across instances. It is excellent for answering "does this
meter exist and what tags does it have" and useless as a dashboard source. Do
not build automation on it.

## Exporting them: Prometheus as the worked example

```xml
<dependency>
  <groupId>io.micrometer</groupId>
  <artifactId>micrometer-registry-prometheus</artifactId>
  <scope>runtime</scope>
</dependency>
```

```properties
management.endpoints.web.exposure.include=health,prometheus
```

Both steps are required and people consistently do only one. The dependency
creates the registry, which is what makes the `prometheus` endpoint *exist* —
gate 1 from [exposure and access](02-exposure-access-and-ports.md) — and the
endpoint then still has to be *exposed*. The symptom of doing only the first is
a 404 with the dependency plainly in the POM, which is why this specific
confusion is so durable.

⚠️ **The scrape endpoint is not public data.** Metric names describe your
architecture, `uri` tags enumerate your entire API surface, `jdbc.connections`
tags name your data sources, and a badly chosen custom tag can carry
identifiers. It belongs on the management port, reachable only from your
monitoring system — see [locking it down](18-locking-it-down.md).

## The trade-off

Free instrumentation is free to *emit* and not free to *store*. The default set
is broad, and on a per-instance basis in a large fleet it is a real line on a
monitoring bill — the JVM family alone is dozens of series per instance before
you have measured anything about your application.

The right response is not to disable things reflexively but to disable families
you have never queried, which `management.metrics.enable.*` makes a one-line
change. The wrong response, which is common, is to leave everything on and then
economise on retention — because the families you kept are the ones you never
look at, and the retention you cut is the history you need during an incident.

## Gotchas

**Symptom:** `/actuator/prometheus` is 404 even though the registry dependency is in the POM
**Cause:** the dependency makes the endpoint *exist*; exposure is a separate gate and still defaults to `health` only
**Fix:** do both:
```properties
management.endpoints.web.exposure.include=health,prometheus
```

**Symptom:** `tomcat.*` metrics are missing while every other family is present
**Cause:** Tomcat's metrics come from its MBeans, and the MBean registry is off by default because registering it costs something
**Fix:**
```properties
server.tomcat.mbeanregistry.enabled=true
```

**Symptom:** two `DataSource` beans and the connection-pool metrics cannot be told apart
**Cause:** they are tagged by bean name, and the bean names are `dataSource` and `dataSource2` because nobody named them
**Fix:** name the beans after what they are — `ordersDataSource`, `reportingDataSource` — because the bean name is part of a published metric contract, not an internal detail

**Symptom:** an outbound HTTP dependency has no `http.client.requests` metrics
**Cause:** the client was constructed directly rather than from the auto-configured builder, so it was never instrumented
**Fix:** build it from the injected builder, which is also how it picks up your configured timeouts and interceptors:
```java
@Bean
RestClient paymentsClient(RestClient.Builder builder) {
    return builder.baseUrl("https://payments.internal").build();
}
```

**Symptom:** a metrics bill grows steadily with no change in traffic
**Cause:** every new instance publishes the full default family set, so the cost scales with fleet size rather than with request volume
**Fix:** disable families nobody queries — start with the ones no dashboard or alert references:
```properties
management.metrics.enable.jvm.gc.pause=false
```

**Symptom:** Hibernate metrics are absent despite JPA being in use
**Cause:** two separate prerequisites — `hibernate-micrometer` on the classpath, and Hibernate's statistics collection enabled
**Fix:**
```properties
spring.jpa.properties[hibernate.generate_statistics]=true
```

**Symptom:** a scanner hitting random URLs appears to have created thousands of time series
**Cause:** a custom URI tag provider replaced Boot's, and it reports the literal request path instead of `NOT_FOUND` for unmatched requests
**Fix:** restore the behaviour — unmatched requests must collapse to a constant tag value, or your metric cardinality is controlled by whoever is scanning you

**Symptom:** somebody built a dashboard on `/actuator/metrics` and it shows a fraction of the traffic
**Cause:** that endpoint reports the calling instance's in-memory registry only, so a load-balanced request lands on one instance and reports that instance's numbers
**Fix:** point dashboards at the exported metrics in the monitoring backend, where cross-instance aggregation happens; the metrics endpoint stays a debugging aid

## Interview questions

**★ What instrumentation do you get without writing any?**
JVM memory, GC, threads and class loading; process and system CPU, uptime and
file descriptors; `application.started.time` and `application.ready.time`;
`http.server.requests` with method, URI template, status and outcome tags;
`http.client.requests` for clients built from the auto-configured builders;
connection-pool metrics per `DataSource`; cache statistics; task-executor
metrics; log-event counts by level; and SSL certificate expiry. The two most
under-used are `logback.events`, which is an error-rate metric nobody has to
write, and `ssl.chain.expiry`, which gives certificate alerting a trend instead
of a boolean.

**★ Why does `http.server.requests` tag the URI template rather than the path?**
Because tagging the actual path would make every distinct identifier a distinct
time series, which destroys a metrics backend within hours of production
traffic. The template `/orders/{id}` collapses all of them into one series while
preserving the thing you actually want to compare — the endpoint. It also
means unmatched requests need special handling, which Boot does by tagging them
as `NOT_FOUND` rather than by their literal path, so that a scanner cannot
inflate your cardinality from the outside.

**★ Is `/actuator/metrics` a monitoring interface?**
No. It reports what *this instance's* in-memory registry currently holds, with
no history and no cross-instance aggregation, so a load-balanced query returns
one instance's view at random. It is a debugging tool: confirm a meter exists,
inspect its available tags, drill down with `?tag=key:value`. Monitoring is the
registry export — a Prometheus scrape or a push registry — where retention and
aggregation are the backend's responsibility.

**★ How do you expose Prometheus metrics, and what is the security consideration?**
Add `micrometer-registry-prometheus` at runtime scope, which creates the registry
and therefore the endpoint, then expose the endpoint. Both steps are required and
doing only the first is the standard cause of a 404 with the dependency clearly
present. The security consideration is that the scrape output is not innocuous:
metric names describe your architecture, `uri` tags enumerate your entire API
surface, and data source tags name your databases. It belongs on the management
port, reachable only from the monitoring system.

**★ An outbound dependency has no client metrics. What is the likely cause?**
The client was constructed directly — `RestClient.create()` or a `new` —
instead of from the injected auto-configured builder. Instrumentation is applied
by the builder, so a hand-built client is invisible not just to metrics but to
tracing, and usually to your configured timeouts as well. Injecting
`RestClient.Builder` and building from it is the habit that makes all three work
at once.

**★ Your metrics bill is growing and traffic is flat. Where do you look first?**
At fleet size and the default families, because per-instance families scale with
instances rather than with requests: every new pod publishes the entire JVM,
system, cache and pool set whether or not anyone queries it. The first lever is
`management.metrics.enable.*` to switch off families no dashboard and no alert
references, which is a one-line change per family. Cardinality is the other and
larger cause, but it shows up as growth *with* traffic or with a deploy, not
with a flat graph and a rising bill.

---

← Prev: [Micrometer and meter types](08-metrics.md) · Index: [Actuator](README.md) · Next → [Custom metrics, filters and distributions](10-custom-metrics.md)
