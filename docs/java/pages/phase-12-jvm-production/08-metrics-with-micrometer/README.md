---
title: "Metrics with Micrometer: a metric is a number you can afford to keep for a year, and every hard problem in this topic comes from the same place — the tag you added is a multiplication, not a column, and it is paid in your heap, on every scrape, from every instance, forever"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 → 2026-09-03 against the **Micrometer** reference — *Concepts*, *Meter
> Filters*, *Timers* (including the *Memory Footprint Estimation* section), *Counters*, *Gauges*,
> *Registry* and *Naming Meters* ([docs.micrometer.io](https://docs.micrometer.io/micrometer/reference/));
> the **Spring Boot 4.1 production-ready reference** — *Metrics*, *Supported Metrics and Meters*
> and the `management.metrics.*` properties
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/actuator/metrics.html)); the
> **Prometheus** exposition-format and instrumentation documentation
> ([prometheus.io](https://prometheus.io/docs/)); the **OpenTelemetry** semantic conventions for
> HTTP metrics; and the **Google SRE Workbook**, chapter 5 *Alerting on SLOs*
> ([sre.google](https://sre.google/workbook/alerting-on-slos/)).
> 🔴 **No sandbox.** No latency, throughput, cardinality or memory figure on these pages is a
> measurement. Every kilobyte estimate is Micrometer's own published one, quoted and attributed;
> every alert expression is the Workbook's. JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9 ·
> Micrometer 1.17.0.

**Logging asks "what happened to this one request?" and tracing asks "where in the call graph did
the time go?". Metrics ask the question you can afford to ask about every request for a year:
"how many, how often, how slow, and is it getting worse?" The price of that affordability is that
a metric has no memory of individuals — and almost every mistake in this topic is somebody trying
to get an individual back out of an aggregate by adding one more tag.**

Four findings here contradict what most teams believe about their own metrics, and each is read
out of documentation rather than asserted. **A gauge holds a weak reference to the thing it
measures**, so the object it was watching can be collected and the metric silently becomes `NaN` —
the meter is still there, still scraped, and reports nothing. **A percentile computed inside your
application cannot be aggregated with the same percentile from another instance**, which means the
p99 on a dashboard fed by ten pods is, at best, an average of ten p99s and is not a p99 of
anything. **`publishPercentileHistogram` is one method call that adds dozens of time series per
tag combination**, and the bucket count is a budget nobody sets deliberately. And **a timer is the
most memory-consuming meter Micrometer has** — the reference publishes the formula, and the
documented range for a single timer spans about 0.1kb to about 14.3kb depending on two flags most
services never look at.

The through-line is cardinality. [04 · Tags](04-tags.md) introduces it as a modelling decision,
[04b · Cardinality](04b-cardinality.md) shows it is a multiplication, [08d · The bucket
budget](08d-the-bucket-budget.md) shows histograms multiply it again, and
[11 · Cost and overhead](11-cost-and-overhead.md) prices the result. Read in that order and the
last page is arithmetic; read the last page first and it is a surprise.

**33 chunks, ~8,372 lines, 493 gotchas and interview questions.** Read in order.
[12 · The checklist](12-the-checklist.md) is the page to keep.

| # | Chunk | Tier | What it argues |
|---|---|---|---|
| 1 | **[The average that lied](01-the-average-that-lied.md)** | <span className="db-tier t-understand">Understand</span> | The mean is a number no user has experienced |
| 2 | **[What Micrometer is](02-what-micrometer-is.md)** | <span className="db-tier t-understand">Understand</span> | SLF4J's shape applied to metrics; the backend is a classpath decision |
| 3 | **[The meter types](03-the-meter-types.md)** | <span className="db-tier t-understand">Understand</span> | Five you will use, and the two sentences telling you which not to |
| 4 | **[The gauge that was collected](03b-the-gauge-that-was-garbage-collected.md)** | <span className="db-tier t-understand">Understand</span> | A weak reference, and the metric that quietly became `NaN` |
| 5 | **[Counter vs gauge](03c-counter-versus-gauge.md)** | <span className="db-tier t-understand">Understand</span> | Two different promises to the backend; only one supports `rate()` |
| 6 | **[The specialised meters](03d-the-specialised-meters.md)** | <span className="db-tier t-understand">Understand</span> | Distribution summaries, long task timers, and when each is right |
| 7 | **[Rate aggregation](03e-rate-aggregation-and-the-step-registry.md)** | <span className="db-tier t-understand">Understand</span> | Cumulative to Prometheus, per-interval to Datadog — and it matters |
| 8 | **[Tags](04-tags.md)** | <span className="db-tier t-understand">Understand</span> | A dimension you group by, not a word glued into the name |
| 9 | **[Common tags](04a-common-tags.md)** | <span className="db-tier t-understand">Understand</span> | Installed before the first binder, or missing from most meters |
| 10 | **[Cardinality](04b-cardinality.md)** | <span className="db-tier t-understand">Understand</span> | 🔴 A multiplication, paid in your heap and again in the backend |
| 11 | **[`MeterFilter`](04c-meterfilter.md)** | <span className="db-tier t-understand">Understand</span> | The only place to change a metric without changing its code |
| 12 | **[Capping cardinality](04d-capping-cardinality.md)** | <span className="db-tier t-understand">Understand</span> | Boot's 100-value cap, logged once, and how to raise it safely |
| 13 | **[RED and USE](05-red-and-use.md)** | <span className="db-tier t-understand">Understand</span> | Are users suffering, and which resource is causing it |
| 14 | **[USE for a JVM service](05b-use-for-a-jvm-service.md)** | <span className="db-tier t-understand">Understand</span> | Pools and queues, not disks and busses |
| 15 | **[What Boot gives you free](06-what-boot-gives-you-free.md)** | <span className="db-tier t-understand">Understand</span> | Several hundred meters before your first line of code |
| 16 | **[The URI tag](06b-the-uri-tag.md)** | <span className="db-tier t-understand">Understand</span> | The templated path, and its four documented fallbacks |
| 17 | **[The client URI tag](06c-the-client-uri-tag.md)** | <span className="db-tier t-understand">Understand</span> | 🔴 No handler pattern to normalise it — the cardinality bomb Boot cannot defuse |
| 18 | **[Timing your own code](07-timing-your-own-code.md)** | <span className="db-tier t-understand">Understand</span> | `Timer.record`, `Timer.Sample`, and the try/finally |
| 19 | **[The timing annotations](07a-the-timing-annotations.md)** | <span className="db-tier t-understand">Understand</span> | 🔴 `@Timed` and the five conditions that make it do nothing |
| 20 | **[The Observation API](07b-observation-api.md)** | <span className="db-tier t-understand">Understand</span> | One call site, three signals — metric, span and correlated log |
| 21 | **[Configuring observations](07c-configuring-the-observation-registry.md)** | <span className="db-tier t-understand">Understand</span> | Five collaborators, evaluated in a documented order |
| 22 | **[Percentiles](08-percentiles.md)** | <span className="db-tier t-understand">Understand</span> | 🔴 A client-side percentile cannot be added to another one |
| 23 | **[Histograms and buckets](08b-histograms-and-buckets.md)** | <span className="db-tier t-understand">Understand</span> | One method call, seventy-three series per tag combination |
| 24 | **[SLOs and the bucket budget](08c-slos-and-the-bucket-budget.md)** | <span className="db-tier t-understand">Understand</span> | The only way to get an exact count of breaches of a promise |
| 25 | **[The bucket budget](08d-the-bucket-budget.md)** | <span className="db-tier t-understand">Understand</span> | One decision with four inputs, decided once |
| 26 | **[Exporting to Prometheus](09-exporting-to-prometheus.md)** | <span className="db-tier t-understand">Understand</span> | Pull, and every operational property that follows from it |
| 27 | **[Exemplars](09b-exemplars.md)** | <span className="db-tier t-understand">Understand</span> | The one wire between an aggregate and an individual request |
| 28 | **[Alerting on what matters](10-alerting-on-what-matters.md)** | <span className="db-tier t-understand">Understand</span> | An alert is a claim a human should stop what they are doing |
| 29 | **[Burn-rate alerts](10b-burn-rate-alerts.md)** | <span className="db-tier t-understand">Understand</span> | How fast you are spending the budget, not whether a line was crossed |
| 30 | **[Multi-window rules and low traffic](10c-multiwindow-rules-and-low-traffic.md)** | <span className="db-tier t-understand">Understand</span> | The short window, the recording rules, and services too quiet to alert on |
| 31 | **[Cost and overhead](11-cost-and-overhead.md)** | <span className="db-tier t-understand">Understand</span> | 🔴 The published memory formula — 0.1kb to 14.3kb per timer |
| 32 | **[The scrape, the CPU and the levers](11b-the-scrape-the-cpu-and-the-levers.md)** | <span className="db-tier t-understand">Understand</span> | Paid per series per interval forever; the four levers in order |
| 33 | **[The checklist](12-the-checklist.md)** | <span className="db-tier t-understand">Understand</span> | Instrumenting a new service, in the order that works |

## The boundary with the rest of the phase

This topic owns **aggregate numbers over time** — meters, tags, RED and USE, percentiles, and the
registry. It does not own the other two signals, and says so once rather than re-teaching them:

- **[07 · Logging done right](../07-logging-done-right/README.md)** owns the log — one event, one
  reader, at 03:00.
- **09 · Distributed tracing** owns the span tree, and is where a high-cardinality attribute
  belongs when a tag would be wrong.
- **[Phase 9 · Spring Boot](../../phase-9-spring-boot/README.md)** taught Actuator itself; this
  topic links to it rather than re-teaching endpoints.

## If you read four pages

**[04b · Cardinality](04b-cardinality.md)**, because it is the mistake that takes a metrics backend
down. **[08 · Percentiles](08-percentiles.md)**, because the p99 on your dashboard is probably not
a p99. **[11 · Cost and overhead](11-cost-and-overhead.md)**, because it is the rare observability
number you can compute before you deploy. And **[12 · The checklist](12-the-checklist.md)**,
because the ordering in it is the difference between two irreversible decisions costing minutes
and costing a metric rename.

{/* FOOTER */}
