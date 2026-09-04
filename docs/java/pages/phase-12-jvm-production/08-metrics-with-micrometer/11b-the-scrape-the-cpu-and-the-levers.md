---
title: "Heap is paid once per series and the scrape is paid once per series per interval forever, which is why an idle over-instrumented service costs exactly as much as a saturated one and why every lever worth pulling is pulled at registration rather than at export"
sidebar_label: "11b · The scrape, the CPU and the levers"
sidebar_position: 32
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-03 against the **Micrometer** reference · *Meter Filters* — the `DENY`/NOOP
> behaviour and the whitelisting note
> ([docs.micrometer.io](https://docs.micrometer.io/micrometer/reference/concepts/meter-filters.html));
> *Registry* — *"Meters in Micrometer are created from and held in a `MeterRegistry`"*
> ([docs.micrometer.io](https://docs.micrometer.io/micrometer/reference/concepts/registry.html));
> and the **Spring Boot 4.1 production-ready reference · Metrics** for `management.metrics.enable.*`,
> `management.metrics.distribution.*` and `withMaximumAllowableTags`
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/actuator/metrics.html)).
> 🔴 **No sandbox.** There is no published bytes-per-series constant and this page does not invent
> one — it gives you the two commands that measure yours instead. No scrape was performed and no
> JVM was run for this page. JDK 25 · Spring Boot 4.1.1 · Micrometer 1.17.0.

**[11 · Cost and overhead](11-cost-and-overhead.md) costed the heap, which is the cost you can
compute from a published table. This page is the other two — the scrape, which is the cost you
export to somebody else's budget, and the CPU, which is almost entirely in a place people do not
look. It closes with the four levers, in the order to reach for them.**

The structural fact that ties both halves together is an asymmetry: **heap is paid once per
series; the scrape is paid once per series per interval, forever.** That is why a cardinality
decision is so much more expensive than a memory estimate makes it look, and why every effective
lever acts at registration rather than at export.

## Scrape: the cost you export

600 series at a 15-second scrape interval is 3,456,000 samples a day, per instance. The backend
charges you for ingesting them, for storing them for the retention period, and again for every
query that has to walk them. None of that appears in your service's heap dump, which is exactly
why it tends to be discovered on an invoice.

There is no published byte-per-series figure to quote, and this corpus does not invent one. What
you can do instead is measure your own, which takes one command:

```bash
curl -s localhost:8080/actuator/prometheus | wc -c
curl -s localhost:8080/actuator/prometheus | grep -vc '^#'
```

The first is the payload your backend pulls every interval. The second is the number of series it
contains — `grep -v '^#'` drops the `HELP` and `TYPE` comment lines, so what remains is one line
per series. Divide, and you have your service's own bytes-per-series: a real number, for your
configuration, that no article can give you.

**★ Run both numbers before and after any change to instrumentation, and put them in the pull
request.** The heap change is invisible in a code review, and the series count is the number the
platform team will eventually come to you about. Two lines of output make an instrumentation
change reviewable.

**★ A percentile histogram is a scrape-side cost too, and proportionally a bigger one than it is a
heap cost.** [08b · Histograms and buckets](08b-histograms-and-buckets.md) counts the additional
time series per tag combination that `publishPercentileHistogram` adds; each of those is a line in
that `curl` output, on every scrape, from every instance. A histogram roughly doubles a timer's
heap; it multiplies its series count by the bucket count.

## CPU: the two paths, and why only one of them matters

The recording path is a hot-path concern and is designed to be trivial: incrementing a counter or
recording into a timer is a small number of atomic operations against a striped accumulator. It is
not free, but it is not where your CPU goes, and optimising it is almost always the wrong instinct.

**The scrape path is where the work is.** On every scrape the Prometheus registry walks every
meter in the registry, reads its current value, renders the text format and writes it out — work
proportional to the number of time series, performed on the thread serving `/actuator/prometheus`.
[09 · Exporting to Prometheus](09-exporting-to-prometheus.md) covers the pull model that makes
this true; the cost consequence is that **your metrics CPU is proportional to cardinality × scrape
frequency**, and that both of those are configuration rather than traffic.

**★ Scrape cost does not go down when traffic goes down.** An idle service with 5,000 series
renders 5,000 series every fifteen seconds exactly as a busy one does. This is the opposite of the
intuition people carry over from logging, where volume tracks traffic, and it is why an
over-instrumented service that is cheap in staging is not cheap in production merely because
production has more instances — it is *more* expensive, per instance, at the same idle load.

**★ Halving the scrape interval doubles the metrics CPU and doubles the ingest.** It is the one
cost knob that is not in your code at all, and the one most often changed by somebody who does not
own the service. A 10-second interval on a large registry is a real decision; treat a request to
"scrape more often for better resolution" as a capacity change, not a config tweak.

## The four levers, in the order to reach for them

1. **Do not create the series.** `management.metrics.enable.<name>=false`, or a `MeterFilter`
   that denies — [04c](04c-meterfilter.md). Saves heap, scrape and CPU. This is the only lever
   that saves all three, which is why it is first.
2. **Cap the tag.** `withMaximumAllowableTags`, or leave Boot's `uri` cap alone —
   [04d](04d-capping-cardinality.md). Saves all three, and bounds the worst case rather than the
   average, which matters more: an unbounded tag is unbounded in all three currencies.
3. **Turn off distribution statistics you are not reading.** Percentile histograms and client-side
   percentiles are opt-in per meter name via `management.metrics.distribution.*`; the ~7.7kb and
   ~14.3kb rows in [11](11-cost-and-overhead.md) collapse to ~1.8kb when you stop asking for them,
   and the series count collapses with them — [08d · The bucket budget](08d-the-bucket-budget.md).
4. **Only then, tune buffer length and precision** — and on Prometheus, remember that buffer
   length does nothing.

The documentation's own framing of lever 1 is worth having in mind, because it inverts the default
posture:

> *"Whitelisting only a certain group of metrics is a particularly common case for monitoring
> systems that are expensive."*

**★ On an expensive backend, the default should be deny and the exceptions should be listed.** Most
services do the reverse — publish everything, then deny the ones somebody complained about — which
means the cost of every new library that ships meter binders lands on you silently.

## Gotchas

**★ Disabling a meter at the export stage saves none of the heap.** Dropping a series in a
Prometheus `metric_relabel_config`, or filtering it in a collector, removes it from storage and
from your bill. The `Timer` is still allocated in your JVM, still holds its histogram, and still
costs its scrape rendering. The `DENY` has to happen in the registry.

**★ The scrape endpoint's cost lands on the request thread that serves it.** A very large registry
makes `/actuator/prometheus` slow, and a slow scrape endpoint on a short scrape timeout produces
gaps in your metrics precisely when the service is most heavily instrumented. Measure the endpoint
like any other — it is an HTTP endpoint on your service.

**★ A scrape timeout produces a gap, not an error you will notice.** The failed scrape shows up as
missing samples, which look like a service that was down or a target that was unhealthy. Debugging
that as an availability problem when it is a rendering-latency problem can take a long time, and
the tell is that the gaps correlate with registry size rather than with load.

**★ `grep -vc '^#'` is the series count, not the metric-name count.** One metric name with a
histogram and four tag values is dozens of lines. If your mental model of "how many metrics do we
have" comes from counting `@Timed` annotations, it is wrong by the tag-combination factor and
again by the bucket factor.

**★ Every instance pays the full scrape cost independently.** Series count is per instance;
scaling from 3 to 30 replicas multiplies ingest by ten with no change to your code. This is the
interaction that turns a "we can afford it" decision made at small scale into an incident at
large scale.

**★ Exemplars are the exception to "everything costs".** [09b · Exemplars](09b-exemplars.md) adds
one trace id per bucket, which is negligible against the bucket itself, and buys the single
highest-value link in the whole observability stack. If you are cutting costs, cut buckets and
tags; do not cut exemplars.

**★ Lever ordering matters because levers 3 and 4 do not bound anything.** Turning off a histogram
is a fixed saving on a variable problem. If the underlying issue is an unbounded tag, you have
reduced the per-series cost of an unbounded number of series, and the graph still goes up. Fix the
cardinality first.

**★ `management.metrics.enable.*` is hierarchical and prefix-matched.** `management.metrics.enable.jvm=false`
disables every meter whose name starts `jvm.`, not one meter called `jvm`. That is what makes it a
usable lever — and also what makes it easy to disable far more than you meant to, including the
memory and GC meters that [02 · GC in practice](../02-gc-in-practice/README.md) tells you to keep.

**★ Denying a meter you are alerting on removes the alert silently.** A Prometheus alert on a
series that stopped being published does not fire and does not error; `absent()` is the guard, and
almost nobody writes it. Cost-cutting a metric is a change to your alerting surface, so it belongs
in the same review as [10 · Alerting on what matters](10-alerting-on-what-matters.md).

## Interview questions

**★ What is the difference, in cost terms, between denying a meter with a `MeterFilter` and
dropping it in the scrape pipeline?**
A `MeterFilter` `DENY` makes the registry hand back a NOOP meter — *"anything recorded to it is
discarded immediately with minimal overhead"* — so the distribution statistics are never allocated
and the series is never rendered. That saves heap, scrape bytes and scrape CPU. Dropping it
downstream saves storage and query cost only; the JVM still allocates the histogram on every
instance and still renders it on every scrape. If the problem is heap or endpoint latency, only
the filter fixes it.

**★ Your metrics bill is proportional to what, exactly?**
Time series count × scrape frequency × retention — none of which are traffic. This is the trap:
teams reason about metrics the way they reason about logs, where volume follows requests. Metrics
volume follows *cardinality*, so an idle service with 5,000 series costs the same per instance as
a saturated one, and scaling out multiplies the whole bill by the instance count.

**★ How do you get a real bytes-per-series number for your own service?**
Measure it rather than look it up: `curl -s localhost:8080/actuator/prometheus | wc -c` for the
payload the backend pulls each interval, and `| grep -vc '^#'` for the number of series in it.
Dividing gives a figure that is correct for your configuration, your tag sets and your histogram
choices. Any published constant is wrong for you, because the ratio depends entirely on how many
of your series carry histogram buckets.

**★ Where does the CPU of a metrics system actually go?**
Overwhelmingly to the scrape, not the recording. Recording is a handful of atomic operations on a
striped accumulator. The scrape walks every meter in the registry, reads it and renders the text
format, on the thread serving the endpoint — work proportional to series count and repeated at the
scrape interval regardless of load. That is why an over-instrumented idle service is expensive and
a lightly-instrumented busy one is not.

**★ Your platform team asks you to cut metrics cost by half. Walk through what you do, in order.**
First measure: series count and payload size from the two `curl` commands, so the conversation has
numbers. Then lever 1 — find meter binders nobody reads and deny them by prefix; a service that
publishes every library's meters usually has a large fraction it has never queried. Then lever 2 —
audit for an unbounded tag, because if one exists nothing else matters. Then lever 3 — list which
meter names actually have a dashboard or an alert reading their histogram, and turn the histogram
off everywhere else. Only after that discuss the scrape interval and retention with the platform
team, because those are their knobs, not yours. And check every deny against the alert rules
before shipping.

**★ Why does the documentation suggest whitelisting rather than blacklisting on expensive
backends?**
Because the set of meters you did not think about grows on its own. Every dependency upgrade can
add meter binders, and a deny-list only covers the ones somebody already noticed. The quoted line
is *"Whitelisting only a certain group of metrics is a particularly common case for monitoring
systems that are expensive."* An allow-list makes the cost of a new library's instrumentation an
explicit decision instead of a silent one — at the price of having to add each genuinely useful
new meter by hand.

**★ Metrics disappear for one instance for two minutes at a time, with no errors in the log. What
do you check?**
Scrape duration against scrape timeout. A gap with no corresponding error is the signature of a
scrape that did not complete: the endpoint renders every series on the serving thread, so a large
registry, a garbage-collection pause during rendering, or a saturated thread pool all push it past
the timeout. Correlate the gaps with registry size and with GC pauses
([02 · GC in practice](../02-gc-in-practice/README.md)) rather than with request volume, because
the rendering cost does not depend on request volume.

**★ Is it ever right to reduce the scrape interval to save money?**
It is one of the few knobs that reduces ingest and CPU together without touching what you can
query about *which* dimensions — you lose resolution in time rather than detail in tags. The
constraint is your alerting: burn-rate rules with a five-minute short window
([10c](10c-multiwindow-rules-and-low-traffic.md)) need enough samples in that window to be
meaningful, so lengthening the interval past about a minute starts to make short-window alerts
noisy. Cut cardinality first; cut interval when cardinality is already justified.

{/* FOOTER */}
