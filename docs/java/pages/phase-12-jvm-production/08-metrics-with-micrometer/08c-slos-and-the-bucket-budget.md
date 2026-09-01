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
> ([sre.google](https://sre.google/sre-book/monitoring-distributed-systems/)) and *Service Level
> Objectives* ([sre.google](https://sre.google/sre-book/service-level-objectives/)). Series counts are
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

## Three words that get used interchangeably and should not be

The SRE book defines all three, and the distinction decides who you argue with about the number:

> *"An **SLI** is a service level indicator — a carefully defined quantitative measure of some
> aspect of the level of service that is provided."*

> *"An **SLO** is a service level objective: a target value or range of values for a service level
> that is measured by an SLI. A natural structure for SLOs is thus SLI ≤ target, or lower bound ≤
> SLI ≤ upper bound."*

> *"Finally, **SLAs** are service level agreements: an explicit or implicit contract with your users
> that includes consequences of meeting (or missing) the SLOs they contain. … An easy way to tell
> the difference between an SLO and an SLA is to ask 'what happens if the SLOs aren't met?': if
> there is no explicit consequence, then you are almost certainly looking at an SLO."*

Micrometer's `serviceLevelObjectives(...)` names the **SLO's boundary**. What it actually gives you
is the raw material for an **SLI** — a countable ratio — and whether there is an SLA behind it is a
question for a contract, not a properties file.

The SRE book also gives the canonical shape of an availability SLI, which is the same shape your
latency SLI should have:

> *"It is often defined in terms of the fraction of well-formed requests that succeed, sometimes
> called yield."*

Good events over valid events. Which is exactly what the bucket ratio computes.

## Which requests count

Deciding the denominator is where most latency SLIs go wrong, and the SRE book's guidance on error
latency is the reason:

> *"It's important to distinguish between the latency of successful requests and the latency of
> failed requests. … an HTTP 500 error triggered due to loss of connection to a database or other
> critical backend might be served very quickly … On the other hand, a slow error is even worse
> than a fast error!"*

Three defensible choices, in decreasing order of how often they are right:

**Successful requests only.** The SLI is "of the requests we served correctly, how many were fast
enough". Errors are counted by a separate availability SLI, so nothing is hidden. This needs the
`outcome` tag in both the numerator and the denominator:

```promql
sum(rate(http_server_requests_seconds_bucket{le="0.5",outcome="SUCCESS"}[30m]))
  /
sum(rate(http_server_requests_seconds_count{outcome="SUCCESS"}[30m]))
```

**All requests.** Simpler, and it lets a flood of instant 500s inflate your latency SLI to near
100% while the service is down. Only acceptable alongside a strict availability SLO that would fire
first.

**A combined "good event" definition** — a request is good if it succeeded *and* was under the
boundary. This is the form that maps most directly onto an error budget, and it is one query:

```promql
sum(rate(http_server_requests_seconds_bucket{le="0.5",outcome="SUCCESS"}[30m]))
  /
sum(rate(http_server_requests_seconds_count[30m]))
```

🔴 Whichever you choose, **write it down next to the number**. An SLI whose denominator nobody can
state is a number people argue about during an incident.

## In Spring Boot, for the meter you already have

```properties
management.metrics.distribution.slo.http.server.requests=200ms,1s
management.metrics.distribution.percentiles-histogram.http.server.requests=false
```

Two boundaries, no percentile histogram: four extra series per tag combination — two SLO buckets,
and `count` and `sum` you already had. That is the whole cost of a latency SLI on your primary
meter.

⚠️ Remember what the `uri` tag does to that: `http.server.requests` is bounded at 100 URI values by
default, times methods, times outcomes. Even four series per combination is a real number when the
combination count is in the hundreds. [08d](08d-the-bucket-budget.md) is where that gets decided.

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

**★ An SLI with an unstated denominator is an argument waiting to happen.** "99.2% of requests met
the objective" is meaningless until someone says whether failed requests were in the denominator.
Put the query in the runbook, not just the panel.

**★ Including errors in a latency SLI lets an outage improve it.** Connection-refused 500s return
almost instantly, so during a total outage nearly every request falls under your latency boundary.
Pair a latency SLI with an availability SLI, or define "good" as successful *and* fast.

**★ Micrometer's option names an SLO boundary; it does not give you an SLO.** The target, the
window, the error budget and the consequence all live outside the code. The metric makes the breach
countable and nothing more.

**★ An SLO boundary on a meter with high tag cardinality is still multiplied by that
cardinality.** Two boundaries on a timer with 300 tag combinations is 600 series. Cheap relative to
a histogram, not free.

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

**★ What is the difference between an SLI, an SLO and an SLA?**
An SLI is the measurement — a carefully defined quantitative measure such as "fraction of requests
served in under 500 ms". An SLO is a target for that measurement, structured as SLI ≤ target or
bounded on both sides. An SLA is a contract that attaches consequences to missing the SLO; the
SRE book's test is to ask what happens if the objective is not met, and if there is no explicit
consequence you have an SLO, not an SLA. Micrometer's `serviceLevelObjectives` supplies the bucket
boundary, which makes the SLI countable; the target and the consequences are agreements, not
configuration.

**★ Should failed requests be in your latency SLI?**
Usually not in the numerator, and the denominator is the real decision. If you count all requests,
a total outage that returns instant 500s makes almost every request fall under your latency
boundary, so the latency SLI *improves* during the worst possible event. The two safe forms are
successful requests only — with a separate availability SLI so the failures are still counted — or
a combined definition where a good event is one that both succeeded and was fast, over all valid
requests. What matters most is that the denominator is written down somewhere other than a Grafana
query, because the number will be quoted in a review by someone who did not write it.

**★ Why is a count above a fixed boundary more stable than a percentile as a contractual number?**
Because a percentile is a property of the *distribution*, so it moves when the mix of traffic moves
even if no individual operation got slower — shifting volume between a fast endpoint and a slow one
changes the p99 without anything changing. A count above a fixed boundary only moves when requests
cross that boundary. For a number that appears in an error budget or a contract, that difference is
the whole point: you want a metric that responds to the thing it claims to measure and to nothing
else.

{/* FOOTER */}
