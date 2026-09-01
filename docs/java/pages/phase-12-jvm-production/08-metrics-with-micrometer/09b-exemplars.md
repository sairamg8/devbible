---
title: "An exemplar is the one wire between an aggregate and an individual request, it costs almost nothing, and it has four independent preconditions every one of which fails by producing a perfectly normal histogram"
sidebar_label: "09b · Exemplars"
sidebar_position: 27
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **Spring Boot 4.1 production-ready reference · Metrics —
> Prometheus** and *· Tracing · Sampling*
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/actuator/metrics.html)), the
> **Micrometer 1.17 reference · Implementations · Prometheus** (scrape format negotiation)
> ([docs.micrometer.io](https://docs.micrometer.io/micrometer/reference/implementations/prometheus.html)),
> and the **Prometheus documentation** — *Concepts · Metric types*
> ([prometheus.io](https://prometheus.io/docs/concepts/metric_types/)).
> No JVM was run for this page and no scrape output appears below. JDK 25 · Spring Boot 4.1.0 ·
> Micrometer 1.17.0 · Micrometer Tracing 1.7.0 · Prometheus Java client 1.5.1.

**The permanent complaint about metrics is that they tell you something is wrong and nothing about
which request. The permanent complaint about traces is that you cannot find the interesting one. An
exemplar solves both by attaching a trace id to an individual observation inside a histogram bucket,
so clicking a spike takes you to a request that caused it. It is the highest-leverage line of
configuration in this topic and it is almost never switched on.**

## What Spring Boot documents

> *"Prometheus Exemplars are also supported. To enable this feature, a `SpanContext` bean should be
> present. … If you use Micrometer Tracing, this will be auto-configured for you, but you can
> always create your own if you want. **By default, only sampled traces are included as
> exemplars.** You can control this behavior using the `management.tracing.exemplars.include`
> property. **The value `all` is not supported with Prometheus.** Please check the Prometheus Docs,
> since this feature needs to be explicitly enabled on Prometheus' side, and **it is only supported
> using the OpenMetrics format.**"*

An exemplar attaches a trace id to a histogram bucket observation, so a spike in a latency panel
becomes a clickable link to one actual slow request. It is the single most useful integration
between [08](08-percentiles.md) and **Topic 09 · Distributed
tracing** *(not written yet)*, and it has four preconditions, all of which are in
that quotation: a `SpanContext` bean, sampling on for the trace in question, OpenMetrics
negotiation, and the feature enabled on the Prometheus server. Miss any one and you get a normal
histogram with no error message.


## The four preconditions, as a checklist

Every one of them fails the same way — a histogram with no exemplars, no error, no log line.

| Precondition | What satisfies it | How it fails |
|---|---|---|
| A `SpanContext` bean | Micrometer Tracing on the classpath auto-configures it | tracing not configured at all; the metric side looks fine |
| The trace is sampled | `management.tracing.sampling.probability`, or a sampler that kept it | Boot samples 10% by default, so 90% of observations can never carry one |
| OpenMetrics negotiation | the scraper sends the OpenMetrics `Accept` header | Prometheus text format silently drops them |
| Enabled on the Prometheus server | server-side configuration | scrape carries them, server discards them |
| *(and)* the meter has buckets | `publishPercentileHistogram` or SLO boundaries | exemplars attach to bucket observations |

🔴 **The sampling row is the one that catches people.** Boot's default is *"Spring Boot samples only
10% of requests to prevent overwhelming the trace backend"*, and *"by default, only sampled traces
are included as exemplars"*. So even with everything else correct, nine out of ten slow requests
leave no exemplar behind — and the interesting one is not more likely to be sampled than any other,
because head sampling decides before the request is served
(**Topic 09 · Sampling**, *not written yet*).

## Why the format matters

Boot states the constraint — *"it is only supported using the OpenMetrics format"* — and Micrometer
supplies the mechanism:

> *"By default, the `PrometheusMeterRegistry` `scrape()` method returns the Prometheus text format.
> The OpenMetrics format can also be produced. To specify the format to be returned, you can pass a
> content type to the scrape method."*

Boot's actuator endpoint honours the request's `Accept` header, so this is a scraper-side decision
rather than an application one. The practical consequence: an application that is correctly emitting
exemplars will still show none if the scrape is negotiated as plain text, and nothing anywhere
reports the mismatch.

## Why it attaches to buckets and not to counters

An exemplar is a sample *of an observation*. A histogram bucket records observations, so an exemplar
on `le="1.0"` means "here is the trace id of one request that landed in this bucket". That is why
enabling exemplars on a service with no histograms produces nothing useful: there are no bucket
observations to hang them on. It also explains the natural pairing — an SLO boundary
([08c](08c-slos-and-the-bucket-budget.md)) plus exemplars gives you "requests that breached the
promise" *and* a way to open one of them.

## What it replaces

Without exemplars, the path from "the p99 moved" to "here is a slow request" is manual and bad:
read the time window off the graph, guess an endpoint, go to the tracing backend, filter by service
and duration, hope the slow ones were sampled, and hope the clocks agree. Every step loses
candidates. With exemplars the link is exact, because the trace id was recorded by the same process
at the same instant as the observation.

The alternative in the other direction — deriving metrics from spans, so that every metric point is
by construction linked to traces — is a backend feature (span metrics), not a Micrometer one, and it
costs tracing volume rather than metric series. Exemplars are the cheaper half of that trade.

## Gotchas


**★ Exemplars have four independent preconditions and fail silently if any is missing.** A
`SpanContext` bean, a sampled trace, OpenMetrics content negotiation, and the feature enabled
server-side. The failure mode is a histogram with no exemplars — indistinguishable from not having
configured it.

**★ `management.tracing.exemplars.include=all` is not supported with Prometheus.** Boot says so
explicitly. Only sampled traces can be exemplars there.


**★ Exemplars are useless without buckets.** They attach to histogram bucket observations. A timer
with no `publishPercentileHistogram` and no SLO boundaries has nowhere to put one.

**★ Head sampling and exemplars interact badly by construction.** The decision to sample is made
before the request is served, so it cannot be correlated with the request being slow. At a 10%
default, most of the interesting observations carry no exemplar and there is nothing in the metric
to indicate that.

**★ An exemplar carries a trace id, not a trace.** If your tracing backend's retention is shorter
than your metrics retention — which it almost always is — an exemplar older than the trace
retention is a dead link.

**★ The scrape format is negotiated by the scraper, so the application cannot guarantee
exemplars.** Everything can be correct in your service and the exemplars still never leave, because
the scrape was made in Prometheus text format.

**★ Exemplar support in the deprecated simpleclient path is configured differently.** Boot: *"If
you're using the deprecated Prometheus simpleclient support and want to enable that feature, a
`SpanContextSupplier` bean should be present."* Two different bean types for two different clients;
copying the wrong one from an older article gives you a bean nothing consumes.

## Interview questions


**★ What is an exemplar and what does it take to get one?**
A trace id attached to an observation inside a histogram bucket, so a spike on a latency panel links
to one specific slow request rather than to a distribution. Four things have to line up: a
`SpanContext` bean, which Micrometer Tracing auto-configures; the trace being sampled, since Boot
only includes sampled traces and `all` is explicitly unsupported with Prometheus; the scrape being
negotiated in OpenMetrics format, because the text format cannot carry them; and the feature enabled
on the Prometheus server. Every one of those failing looks the same — a normal histogram.


**★ Why does Boot's default 10% sampling undermine exemplars, and what would you do about it?**
Because only sampled traces are eligible to become exemplars, and head sampling decides before the
request runs, so the decision is uncorrelated with whether the request turned out to be slow. At a
10% rate, roughly nine of every ten observations in your tail buckets carry no exemplar, and the
metric gives you no indication of that. The options are to raise the probability for the services
where the correlation matters and accept the trace volume; to use a parent-based sampler so that at
least whole traces are consistent; or to move to tail sampling at a collector, which decides after
the fact and can keep the slow ones — at the cost of buffering every span until the decision is made
(**Topic 09 · Sampling**, *not written yet*).

**★ You enabled exemplars, everything looks configured, and none appear. What is your diagnostic
order?**
Cheapest checks first. Does the meter have buckets at all — no histogram and no SLO boundaries means
nothing to attach to. Is the scrape negotiated as OpenMetrics; the text format drops them silently
and that is a scraper-side setting, not an application one. Is the feature enabled on the Prometheus
server, which is separate again. Is a `SpanContext` bean present, which means checking that
Micrometer Tracing is actually on the classpath and configured rather than just declared. And
finally, is anything being sampled — at the default 10% you may simply be looking at requests that
were never eligible. All five failures present identically.

{/* FOOTER */}
