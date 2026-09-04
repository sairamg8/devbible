---
title: "A percentile computed inside your application is a number you cannot add to any other number, so the moment you run two instances the p99 on your dashboard stops being the p99 of anything"
sidebar_label: "08 · Percentiles"
sidebar_position: 22
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **Micrometer 1.17 reference** — *Concepts · Histograms and
> Percentiles*
> ([docs.micrometer.io](https://docs.micrometer.io/micrometer/reference/concepts/histogram-quantiles.html))
> and *Concepts · Timers*, the **Google SRE book** — *Monitoring Distributed Systems · Worrying
> About Your Tail* ([sre.google](https://sre.google/sre-book/monitoring-distributed-systems/)), and
> the **Prometheus documentation** — *Querying · Functions* (`histogram_quantile`)
> ([prometheus.io](https://prometheus.io/docs/prometheus/latest/querying/functions/)).
> No JVM was run for this page and no latency figures appear below. JDK 25 · Spring Boot 4.1.1 ·
> Micrometer 1.17.0 · Prometheus Java client 1.5.1.

**[01 · The average that lied](01-the-average-that-lied.md) argued that you need a percentile. This
page argues that *where* the percentile is computed decides whether it is a number or a decoration.
There are exactly two options, Micrometer names both, and one of them silently stops being correct
the moment you scale past a single instance.**

## The two options, and the sentence that decides between them

> *"Timers and distribution summaries support collecting data to observe their percentile
> distributions. There are two main approaches to viewing percentiles:"*

**Percentile histograms.**

> *"Micrometer accumulates values to an underlying histogram and ships a predetermined set of
> buckets to the monitoring system. The monitoring system's query language is responsible for
> calculating percentiles off of this histogram. Currently, only Prometheus, Atlas, and Wavefront
> support histogram-based percentile approximations, through `histogram_quantile`, `:percentile`,
> and `hs()`, respectively. **If you target Prometheus, Atlas, or Wavefront, prefer this approach,
> since you can aggregate the histograms across dimensions (by summing the values of the buckets
> across a set of dimensions) and derive an aggregable percentile from the histogram.**"*

**Client-side percentiles.**

> *"Micrometer computes a percentile approximation for each meter ID (set of name and tags) and
> ships the percentile value to the monitoring system. **This is not as flexible as a percentile
> histogram because it is not possible to aggregate percentile approximations across tags.**
> Nevertheless, it provides some level of insight into percentile distributions for monitoring
> systems that do not support server-side percentile calculation based on a histogram."*

Two sentences, one decision. If your backend can do `histogram_quantile`, use histograms. Client-side
percentiles exist for backends that cannot.

## Why "cannot be aggregated" is a hard fact and not a caveat

A percentile is an order statistic. To find the 99th percentile of a set you need the *set*, or a
structure that preserves enough of its shape. Given only "instance A's p99 is 400 ms" and
"instance B's p99 is 120 ms", there is no arithmetic that yields the p99 of the combined traffic —
not the mean, not the max, not a weighted mean.

- **The mean of two p99s is not a p99 of anything.** It is not even bounded by the true value in a
  predictable direction.
- **The max of the two is an upper bound, not the answer.** If A served 10 requests and B served a
  million, the true fleet p99 is essentially B's, and taking A's max is wrong by an order of
  magnitude.
- **Weighting by request count does not fix it.** You would be weighting *quantiles*, which is
  still not an operation on the underlying distributions.

The same argument applies across *tags*, not just across instances — which is worse, because it
looks like it should work. Given a client-side p99 per `uri`, there is no way to compute the p99
across all URIs. The moment your dashboard has a "all endpoints" panel next to a per-endpoint
breakdown, one of them is fabricated.

**A histogram has none of this problem** because buckets are counters. Summing bucket counts across
instances or tags gives you the bucket counts of the union, exactly, and the quantile is then
computed from that. The aggregation is addition, and addition composes.

## The SRE book reaches the same conclusion from the other end

> *"The simplest way to differentiate between a slow average and a very slow 'tail' of requests is
> to collect request counts bucketed by latencies (suitable for rendering a histogram), rather than
> actual latencies: how many requests did I serve that took between 0 ms and 10 ms, between 10 ms
> and 30 ms, between 30 ms and 100 ms, between 100 ms and 300 ms, and so on? Distributing the
> histogram boundaries approximately exponentially (in this case by factors of roughly 3) is often
> an easy way to visualize the distribution of your requests."*

And the reason tails matter at all, which is the argument for percentiles in the first place:

> *"If you run a web service with an average latency of 100 ms at 1,000 requests per second, 1% of
> requests might easily take 5 seconds. If your users depend on several such web services to render
> their page, the 99th percentile of one backend can easily become the median response of your
> frontend."*

*(That is the SRE book's illustration, quoted; not a measurement of anything.)*

## What each option looks like

```java
Timer.builder("orders.process")
   .publishPercentiles(0.5, 0.95)        // client-side: two extra series, non-aggregable
   .publishPercentileHistogram()         // histogram: bucket series, aggregable
   .serviceLevelObjectives(Duration.ofMillis(100))
   .minimumExpectedValue(Duration.ofMillis(1))
   .maximumExpectedValue(Duration.ofSeconds(10))
   .register(registry);
```

On Prometheus, the histogram form is queried server-side:

```promql
histogram_quantile(0.99,
  sum by (le, uri) (rate(orders_process_seconds_bucket[5m])))
```

Note `by (le, uri)`: Prometheus is explicit that *"since the `le` label is required by
`histogram_quantile()` to deal with classic histograms, it has to be included in the `by` clause."*
Dropping `le` from a `sum by` is the single most common way this query silently returns nothing
useful.

## Do not enable both

> *"For those monitoring systems, where percentiles can be approximated using the histogram, it is
> usually unnecessary to also publish client-side percentiles (`publishPercentiles`) since in those
> scenarios client-side percentiles are redundant and also non-aggregable across dimensions (unlike
> histograms). **Prometheus Java Client (1.x) does not support having both under the same metric
> name.**"*

That last sentence is a hard constraint on Boot 4, which manages Prometheus client 1.5.1. Enabling
`percentiles` and `percentiles-histogram` for the same meter is not a wasteful configuration — it is
an unsupported one.

## Do not configure them in a library

> *"Since shipping percentiles to the monitoring system generates additional time series, it is
> generally preferable to not configure them in core libraries that are included as dependencies in
> applications. Instead, applications can turn on this behavior for some set of timers and
> distribution summaries by using a meter filter."*

The reason is that the cost is paid by every consumer of the library, multiplied by their tag
cardinality, and none of them chose it. The mechanism for the application to opt in per meter is a
`MeterFilter` ([04c](04c-meterfilter.md)); the budget arithmetic is
[08b · Histograms and buckets](08b-histograms-and-buckets.md).

## What the `max` statistic is, and is not

Every Micrometer timer publishes a `max` without any configuration, and it is tempting to treat it
as a free p100. It is not:

> *"The maximum statistical value for basic `Timer` implementations, such as `CumulativeTimer` and
> `StepTimer`, is a time window maximum (`TimeWindowMax`). It means that its value is the maximum
> value during a time window. If no new values are recorded for the time window length, the max is
> reset to 0 as a new time window starts. The time window size until values are fully expired is
> the `expiry` multiplied by the `bufferLength` in `DistributionStatisticConfig`. `expiry` defaults
> to the step size of the meter registry unless it's explicitly set to a different value, and
> `bufferLength` defaults to 3."*

So the max decays, and a quiet endpoint's max falls to zero — which reads as "latency improved" and
means "no traffic". It is still useful: a max is the one statistic that cannot hide an outlier,
and unlike a client-side percentile it *can* be aggregated across dimensions with `max()`, because
the max of maxima is the true max.

Micrometer also notes that percentiles are windowed in the same way — *"Percentiles are also time
window percentiles (`TimeWindowPercentileHistogram`)"* — so a client-side p99 is a p99 over a
decaying window, not over all time.

## Gotchas

**★ Averaging percentiles across instances produces a number with no meaning.** Not an
approximation — a number that is not the p99 of anything and is not bounded in a known direction
relative to the truth. If your Grafana panel does `avg(http_server_requests_seconds{quantile="0.99"})`
across pods, delete it.

**★ Aggregating client-side percentiles across *tags* fails the same way, and looks more
reasonable.** "The p99 across all endpoints" cannot be derived from per-endpoint client-side p99s.
Only a histogram supports that question.

**★ Enabling `percentiles` and `percentiles-histogram` on the same meter is unsupported on the
Prometheus 1.x client.** Micrometer states it. Pick the histogram on Prometheus, Atlas or
Wavefront; pick client-side percentiles only where the backend cannot compute them.

**★ `publishPercentileHistogram` does nothing on a backend that does not support aggregable
percentiles.** *"`publishPercentileHistogram` has no effect on systems that do not support
aggregable percentile approximations. No histogram is shipped for these systems."* So the same
configuration is free on Datadog and expensive on Prometheus.

**★ `sum by (...)` without `le` breaks `histogram_quantile`.** Prometheus requires the `le` label to
be preserved through the aggregation. The query does not error; it returns something wrong or
nothing.

**★ A timer's `max` decays to zero when traffic stops.** Time-window max with a default
`bufferLength` of 3 and an `expiry` defaulting to the registry step. A falling max means "recently
quiet", not "recently faster".

**★ Client-side percentiles are windowed too.** `TimeWindowPercentileHistogram` — so the number is a
percentile over a decaying window with the same `expiry` and `bufferLength` semantics, not over the
publishing interval and certainly not over all time.

**★ A p99 from a single instance is a p99 of that instance's traffic, which may not be
representative.** Uneven load balancing, sticky sessions, or a canary receiving 5% of traffic all
break the assumption that any one pod's distribution resembles the fleet's.

**★ Percentiles configured in a shared library are a cost imposed on every consumer.** Micrometer
recommends against it explicitly. The application should turn them on per meter with a filter.

**★ A percentile cannot answer "how many requests breached the SLO".** It answers "how slow is the
nth request". If your commitment is 500 ms, you want the count above a 500 ms bucket boundary, not a
p99 that happens to be near it — [08c](08c-slos-and-the-bucket-budget.md).

**★ Histogram quantiles are approximations bounded by bucket width.** `histogram_quantile`
interpolates within whichever bucket the quantile falls into, so the answer's precision is a
function of where you put your boundaries. That is a design input, not an error to be eliminated.

## Interview questions

**★ Why can you not average the p99s of ten instances to get the fleet p99?**
Because a percentile is an order statistic over a set of observations, and once you have collapsed
the set into a single number you have thrown away everything needed to combine it with another set.
The mean of two p99s is not the p99 of the union and is not even bounded in a known direction
relative to it; the max is an upper bound that is badly wrong when the instances serve very
different volumes; and weighting by request count still weights quantiles rather than
distributions. Histograms avoid the problem entirely because buckets are counters, and summing
counters across instances gives you exactly the bucket counts of the union.

**★ When is a client-side percentile the right choice?**
When the backend cannot compute one for you. Micrometer's guidance is explicit: prefer percentile
histograms on Prometheus, Atlas and Wavefront because those can aggregate; use client-side
percentiles for systems with no server-side histogram-quantile support, where a non-aggregable
approximation is better than nothing. It is a fallback, not an alternative, and on Prometheus's 1.x
Java client enabling both under the same metric name is not even supported.

**★ Your `histogram_quantile` query returns nothing sensible. What do you check first?**
Whether `le` survived the aggregation. Prometheus requires the `le` label for classic histograms and
says so, so `sum by (uri) (rate(..._bucket[5m]))` — which drops `le` — produces garbage rather than
an error. After that, whether the meter actually has a histogram at all: `publishPercentileHistogram`
has no effect on backends that do not support aggregable percentiles, and a `MeterFilter` that
rebuilt the `DistributionStatisticConfig` without merging can have removed it.

**★ Why does the SRE book recommend collecting bucketed counts instead of latencies?**
Because buckets are the smallest structure that preserves enough of the distribution's shape to
answer tail questions while still being cheap and aggregable. Storing individual latencies is
unbounded; storing a mean throws the tail away; storing a precomputed percentile throws away the
ability to combine. Bucketed counts are counters, so they sum across instances, across tags and
across time windows, and any quantile can be interpolated from them afterwards. The book's
suggestion of roughly exponential boundaries is the practical form, because latency distributions
are heavy-tailed and linear buckets waste resolution where nothing happens.

**★ Is a timer's `max` a free p100?**
No, on two counts. It is a *time-window* max that resets when no values are recorded for the window
— `bufferLength` defaults to 3 and `expiry` to the registry's step — so a quiet endpoint's max
decays to zero, which looks like an improvement and means silence. And it is the maximum of a
window, not of all time. What it is genuinely good for is that it cannot hide an outlier, and unlike
a client-side percentile it aggregates correctly: `max()` of per-instance maxima is the true fleet
maximum.

**★ A library you maintain records timers. Should you enable percentile histograms in it?**
No. Micrometer recommends against configuring percentiles in libraries because the extra time series
are paid for by every application that depends on you, multiplied by whatever tag cardinality each
of them has, and none of them opted in. Ship the timers with no distribution configuration and let
applications enable histograms per meter with a `MeterFilter`. The same reasoning applies to your
own service's internal shared modules.

**★ Two teams disagree: one wants p99 alerts, the other wants "requests slower than 500 ms" alerts.
Who is right?**
The second, for alerting; the first, for capacity and trend. A percentile answers "how slow is the
nth request", which drifts with your traffic mix and gives you a threshold you have to keep
re-tuning. An SLO-boundary count answers "how many requests breached the promise", which is stated
in the same units as the promise and does not move when traffic composition changes. Micrometer
supports the second directly through `serviceLevelObjectives`, which adds a bucket at exactly your
boundary so the count is exact rather than interpolated.

{/* FOOTER */}
