---
title: "A service-level objective boundary is the only way to get an exact count of requests that breached your promise, and it costs two time series where the percentile histogram everybody reaches for first costs seventy-six"
sidebar_label: "08c · SLOs"
sidebar_position: 24
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **Micrometer 1.17 reference** — *Concepts · Histograms and
> Percentiles* and *Concepts · Meter Filters · Configuring Distribution Statistics*
> ([docs.micrometer.io](https://docs.micrometer.io/micrometer/reference/concepts/histogram-quantiles.html)),
> the **Spring Boot 4.1 production-ready reference · Metrics · Per-meter Properties**
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/actuator/metrics.html)), the
> **Spring Boot 4.1.0 sources** at tag `v4.1.0` —
> [`MetricsProperties`](https://github.com/spring-projects/spring-boot/blob/v4.1.0/module/spring-boot-micrometer-metrics/src/main/java/org/springframework/boot/micrometer/metrics/autoconfigure/MetricsProperties.java)
> and
> [`PropertiesMeterFilter`](https://github.com/spring-projects/spring-boot/blob/v4.1.0/module/spring-boot-micrometer-metrics/src/main/java/org/springframework/boot/micrometer/metrics/autoconfigure/PropertiesMeterFilter.java)
> — and the **Google SRE book** — *Monitoring Distributed Systems · The Four Golden Signals*
> ([sre.google](https://sre.google/sre-book/monitoring-distributed-systems/)). Series counts are
> arithmetic on Micrometer's documented bucket counts; no JVM was run. JDK 25 · Spring Boot 4.1.0 ·
> Micrometer 1.17.0.

**A percentile answers "how slow was the nth request". An SLO answers "how many requests broke the
promise". They are different questions, only the second is stated in the same units as your
commitment, and only the second can be counted exactly. This page is that mechanism, and then the
budget it lands in — which is [08d · The bucket budget](08d-the-bucket-budget.md).**

## What an SLO boundary is

> *"`serviceLevelObjectives`: Used to publish a cumulative histogram with buckets defined by your
> SLOs. **When used in concert with `publishPercentileHistogram` on a monitoring system that
> supports aggregable percentiles, this setting adds additional buckets to the published
> histogram.** When used on a system that does not support aggregable percentiles, this setting
> causes a histogram to be published with only these buckets."*

Two behaviours in one option:

- **With** a percentile histogram, your boundaries are *added* to the generator's — you get 73
  buckets plus yours.
- **Without** one, you get *only* your boundaries, which is the cheap way to get an SLO count on a
  backend that cannot do `histogram_quantile`, or on one where you do not want to pay for
  percentiles.

Boot's own property javadoc states the consequence: *"Specific service-level objective boundaries
for meter IDs starting with the specified name. The longest match wins. **Counters will be
published for each specified boundary.**"*

```java
Timer.builder("orders.process")
    .serviceLevelObjectives(Duration.ofMillis(500))    // exactly the promise
    .register(registry);
```

```promql
# The proportion of requests that met the 500 ms objective, fleet-wide.
sum(rate(orders_process_seconds_bucket{le="0.5"}[30m]))
  /
sum(rate(orders_process_seconds_count[30m]))
```

That is an exact ratio, not an interpolation, because there is a real bucket boundary at exactly
500 ms. It is also the SRE book's third category of error made countable:

> *"The rate of requests that fail, either explicitly (e.g., HTTP 500s), implicitly … or by policy
> (for example, 'If you committed to one-second response times, any request over one second is an
> error')."*

Without an SLO boundary, "requests over one second" is something you estimate from a quantile. With
one, it is something you count.

## Why not just read it off the percentile

Because a percentile is the wrong function. `histogram_quantile(0.99, …)` interpolates within
whichever generated bucket the quantile falls into, so the answer's precision depends on where the
generator happened to put boundaries near your number — and the generator's spacing is *relative*,
so near 500 ms the neighbouring boundaries can be tens of milliseconds apart.

There is a second, larger problem. A percentile moves when your traffic *mix* moves, even if no
request got slower: shift 5% of volume from a fast endpoint to a slow one and the p99 changes. A
count above a fixed boundary does not. When the number is going to appear in a contract or on an
error budget, it has to be the one that only moves when the thing it measures moves.

## Choosing boundaries

- **Use your actual commitment**, not a round number near it. If the promise is 300 ms, the
  boundary is 300 ms, so that the count is the count of breaches and needs no explanation.
- **Add one boundary well above it** — say 3× — so that "breached badly" is distinguishable from
  "breached marginally". Two buckets is usually enough to run an error budget.
- **Do not add a ladder.** Ten SLO boundaries is a percentile histogram with worse resolution and
  a bespoke query language. If you want the distribution, turn the histogram on.
- **Set them per meter, never with `all`.** An SLO is a statement about one operation; applying one
  boundary to every timer in the process produces a bucket that means something different on each.

## Gotchas


**★ An SLO boundary on a system without aggregable percentiles replaces the histogram rather than
adding to it.** *"When used on a system that does not support aggregable percentiles, this setting
causes a histogram to be published with only these buckets."* Useful — it is how you get an exact
breach count on Datadog — but it means the same configuration produces different series on
different backends.

**★ SLO boundaries add to the generator's buckets; they do not replace them.** Turning both on and
expecting "just my boundaries" gives you 73 plus yours.

**★ Boot's SLO property takes durations for timers and bare numbers for summaries.** *"Values can
be specified as a double or, for timer and long-task timer meters, as a `Duration` value defaulting
to ms if no unit specified."* A bare `500` on a timer means 500 **milliseconds**, which is usually
what you meant and is worth being explicit about anyway.

**★ Changing an SLO boundary forks the bucket series.** The old `le` value stops and a new one
starts, so an error-budget query spanning the change has a discontinuity. Change boundaries at the
start of a budget period, not in the middle of one.

**★ An SLO in the metric is not an SLO in the organisation.** The boundary makes the breach
countable; it does not define the window, the target, or what happens when the budget is exhausted.
Publishing the bucket and never agreeing the target is a common and expensive half-measure.

## Interview questions


**★ Why does an SLO boundary give an exact count when a percentile does not?**
Because the boundary creates a real cumulative bucket at exactly the value you care about, so the
count of observations at or below it is a counted number rather than an inferred one.
`histogram_quantile` interpolates within whichever generated bucket the quantile falls into, and the
generator's boundaries are spaced relatively, so near your threshold the neighbouring boundaries can
be far apart in absolute terms. The second reason is more important in practice: a percentile moves
when the traffic mix moves even if nothing got slower, whereas a count above a fixed boundary only
moves when latency crosses that boundary.

**★ You have budget for one distribution setting on a busy timer. Which do you pick?**
Service-level objective boundaries, without a percentile histogram. Two boundaries cost two extra
series per tag combination against roughly seventy-six for the histogram, and they answer the
question that appears in an incident review — how many requests broke the promise — exactly rather
than approximately. The percentile histogram is the right second purchase, on the handful of meters
where somebody genuinely reads the distribution. Most services buy them in the opposite order
because `percentiles-histogram` is the more obvious property name.

{/* FOOTER */}
