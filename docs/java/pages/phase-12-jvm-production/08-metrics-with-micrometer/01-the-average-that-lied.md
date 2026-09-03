---
title: "The mean latency on your dashboard is a number no user has ever experienced, and the reason p99 latency doubled after a deploy without the average moving is that averaging is the one operation that destroys exactly the information an incident is about"
sidebar_label: "01 · The average that lied"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **Google SRE book**, chapter 6 *Monitoring Distributed
> Systems* — "Worrying About Your Tail" and "The Four Golden Signals"
> ([sre.google](https://sre.google/sre-book/monitoring-distributed-systems/)), the
> **Prometheus practices guide** *Histograms and summaries*
> ([prometheus.io](https://prometheus.io/docs/practices/histograms/)), and the **Micrometer
> 1.17 reference** — *Concepts · Rate aggregation* and *Concepts · Histograms and percentiles*
> ([docs.micrometer.io](https://docs.micrometer.io/micrometer/reference/concepts/histogram-quantiles.html)).
> 🔴 **No sandbox.** No metric value, scrape body, dashboard or latency figure on any page in
> this topic is a captured run. Every number is either quoted from documentation with
> attribution, derived from source code that is quoted alongside it, or labelled a schematic.
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8 · Micrometer 1.17.0.

**A metric is a number that has been aggregated on purpose, and every aggregation throws
information away. The whole discipline is choosing which information to throw away so that the
number that survives is the one that answers a question at 03:00. Almost every metrics problem
in a real service is the same problem: someone aggregated in a way that destroyed the signal,
and the dashboard now shows a flat line over an outage.**

## The mean is the wrong aggregation for latency, and the SRE book says why

The Google SRE book puts the case in one sentence that is worth reading twice:

> *"If you run a web service with an average latency of 100 ms at 1,000 requests per second, 1%
> of requests might easily take 5 seconds. If your users depend on several such web services to
> render their page, the 99th percentile of one backend can easily become the median response of
> your frontend."*

Two separate claims are packed in there.

The first is arithmetic. A mean is a single number summarising a distribution, and it is
dominated by the bulk of that distribution. If 99% of your requests take 50 ms and 1% take 5
seconds, the mean is about 100 ms — the same mean you would get if every single request took a
uniform 100 ms. The two services are wildly different to use and indistinguishable on the graph.
The mean is not *wrong*; it is answering a question ("what is the total work divided by the
number of requests?") that nobody in an incident is asking.

The second claim is the one people miss. Tail latency **compounds across a call graph**. If a
page requires five backend calls and each has a 1% chance of being slow, the chance that the page
is slow is not 1% — it is roughly 5%. Fan-out turns your p99 into somebody else's p95, and your
p99.9 into somebody else's p99. The tail is not an edge case that affects few users; on a
fan-out architecture it is the *typical* user experience of a whole page load.

## What to collect instead, in the SRE book's own words

> *"The simplest way to differentiate between a slow average and a very slow 'tail' of requests
> is to collect request counts bucketed by latencies (suitable for rendering a histogram), rather
> than actual latencies: how many requests did I serve that took between 0 ms and 10 ms, between
> 10 ms and 30 ms, between 30 ms and 100 ms, between 100 ms and 300 ms, and so on? Distributing
> the histogram boundaries approximately exponentially (in this case by factors of roughly 3) is
> often an easy way to visualize the distribution of your requests."*

That paragraph, written before Micrometer existed, describes precisely what
`publishPercentileHistogram()` does — Micrometer's bucket generator uses powers of four with
one-third increments in between, which is the same idea at a different base.
[08b · Histograms and buckets](08b-histograms-and-buckets.md) shows the generator's source.

The important structural point is why buckets are the right representation: **a bucket is a
counter, and counters add.** A percentile is not a counter and does not add. That single fact
determines almost every configuration decision in this topic, and it is why
[08 · Percentiles](08-percentiles.md) exists as its own page.

## Three signals, and this topic owns exactly one

An observability stack has three kinds of output, and the mistake that costs the most time is
using one to answer a question that belongs to another.

| Signal | The unit | The question it answers | Cost model |
|---|---|---|---|
| **Metrics** (this topic) | a time series — a number per name+tags per interval | *"Is it broken, how badly, and since when?"* | per unique time series, forever |
| **Logs** (**07 · Logging done right** *(not written yet)*) | an event with a message and fields | *"What exactly happened to this one request?"* | per event volume |
| **Traces** (**09 · Distributed tracing** *(not written yet)*) | a span tree across services | *"Where in the call graph did the time go?"* | per sampled trace |

Metrics are cheap per event and expensive per *dimension*. Logs are the reverse: cheap per
dimension (add a field, nothing multiplies) and expensive per event. That asymmetry is the whole
reason [04b · Cardinality](04b-cardinality.md) is a crisis in metrics and a non-issue in logs.
Putting a user id in a log field is normal engineering. Putting a user id in a metric tag is an
outage.

The ordering also matters. Metrics come **first** in an incident because they are the only signal
that is always on, always aggregated, and cheap to query over a week. They tell you *that* p99
doubled at 14:07. They will never tell you *why*. The why comes from a trace, a flame graph
(**06 · JFR and profiling** *(not written yet)*), a GC log (**02 · GC in practice** *(not written
yet)*) or a thread dump ([05 · Thread dumps](../05-thread-dumps/README.md)). This topic's job is
to make the first step reliable, and to stop it from being the only step you can afford.

## Why "aggregate on purpose" is a design constraint, not a slogan

Micrometer's rate-aggregation page states the cost side plainly:

> *"Representing a counter without rate aggregation over some time window is rarely useful, as
> the representation is a function of both the rapidity with which the counter is incremented and
> the longevity of the service."*

A raw counter value mixes two things: how busy you were, and how long you have been up. Every
deployment resets it. The only useful reading is the *derivative* — requests per second — and
that derivative is computed by the backend, not by you. This is the shape of every metric
decision in the topic: you record something that composes (a count, a sum, a bucket), and you let
the query language do the maths that turns it into a human answer.

The corollary is uncomfortable and worth stating early: **anything you compute in the application
you can no longer recompute later.** A p99 computed inside the JVM is a fact about that JVM, for
that window, at that percentile. You cannot ask it for p95 next month, you cannot ask it about a
ten-minute window instead of five, and you cannot add it to another instance's p99. That is not a
Micrometer limitation — it is a property of quantiles, and Prometheus's own guide says the same
thing in its comparison table: aggregation of a summary's precomputed quantiles is
*"Not aggregatable."*

## The failure this topic is designed to prevent

The phase gate for this phase is *"p99 latency doubled after the deploy"*. To answer that you
need, in order:

1. A **`http.server.requests` timer** that exists at all, with a **templated** `uri` tag so the
   series is stable across deploys — [06b · The `uri` tag](06b-the-uri-tag.md).
2. **Buckets, not client-side percentiles**, so that "p99 across the fleet" is a query you can
   actually write — [08b](08b-histograms-and-buckets.md).
3. **Buckets that span your latency range**, because the default clamp is 1 ms to 30 seconds and
   a bucket set that stops below your real p99 gives you a p99 pinned at the top bucket —
   [08c · SLOs and the bucket budget](08c-slos-and-the-bucket-budget.md).
4. **Low enough cardinality that the series survived the last cost review** —
   [04b](04b-cardinality.md), [04d](04d-capping-cardinality.md).

Every one of those four is a decision made months before the incident, by someone who was not
thinking about the incident. That is what makes metrics a design topic rather than an operations
topic.

## Where the rest of this topic goes

- [02 · What Micrometer is](02-what-micrometer-is.md) — the facade, the registry, and the version
  facts that determine every package name you will type.
- [03 · The meter types](03-the-meter-types.md) — and, more usefully, which one is wrong.
- [04 · Tags](04-tags.md) through [04d](04d-capping-cardinality.md) — dimensions, the cardinality
  bomb, and the four filters that defuse it.
- [05 · RED and USE](05-red-and-use.md) — what to measure, from two published methodologies.
- [08 · Percentiles](08-percentiles.md) — the single most valuable distinction in the topic.
- [12 · The checklist](12-the-checklist.md) — instrumenting a new service, in order.

## Gotchas

**★ A flat mean over a real outage is the normal case, not a freak one.**
If 1% of requests hang for 30 seconds and the other 99% are unaffected, the mean moves by 300 ms
on a 50 ms baseline — visible if you are staring at it, invisible on a weekly graph with a y-axis
scaled for the whole month. Users notice long before the average does. This is the specific
reason "the dashboard looked fine" appears in so many post-incident reviews.

**★ `totalTime / count` is an average, and Micrometer gives it to you whether you want it or
not.** Every Micrometer timer publishes a count and a total time as separate series, so
`rate(timer_seconds_sum[5m]) / rate(timer_seconds_count[5m])` is always available. It is a
legitimate number — it is exactly the throughput-weighted mean latency — and it is a genuinely
useful *capacity* signal, because total time per second is a measure of concurrency demand. Just
never treat it as a user-experience signal.

**★ The p99 of a 10-request-per-minute endpoint is noise.** A percentile over a window that
contains 100 samples has its p99 determined by a single observation. Low-traffic endpoints need
either a much longer window, an SLO bucket ("how many exceeded 300 ms?") which is meaningful at
any volume, or no percentile at all. Chasing a p99 on a rarely-called endpoint burns time on a
number that is not measuring anything stable.

**★ Averaging p99 across instances is the single most common metrics bug in production, and it
produces a plausible number.** It does not error, it does not warn, and the graph looks
reasonable. Prometheus's own documentation labels the expression `avg(...{quantile="0.95"})`
with `// BAD!` and says *"averaging the quantiles yields statistically nonsensical values"*.
[08](08-percentiles.md) is the whole argument.

**★ A percentile also cannot be averaged over *time*.** The same objection applies to the time
axis: the average of twelve five-minute p99s is not the hourly p99. Grafana will happily draw it
when you zoom out and the panel downsamples. Zooming out on a client-side-percentile panel
silently changes what the line means.

**★ "We have a dashboard" is not the same as "we can answer a question".** A dashboard built from
the meters that happened to exist answers whatever those meters happened to measure. The test is
the other direction: write the three questions you expect to ask during an incident, then check
that each is one query away. [10 · Alerting on what matters](10-alerting-on-what-matters.md)
turns this into a procedure.

**★ Metrics cannot be retrofitted onto an incident that already happened.** Logs can sometimes be
re-parsed and traces can sometimes be re-sampled, but a time series that was never recorded has
no history at all. The cost of instrumenting after the fact is always a second incident.

## Interview questions

**★ Why is mean latency considered a poor primary signal, and what is the alternative?**
Because it summarises a distribution with a single number that is dominated by the bulk of that
distribution, so a slow tail affecting a small fraction of requests barely moves it — the SRE
book's example is a 100 ms average at 1,000 requests per second where 1% of requests take five
seconds. The alternative is a distribution: bucket the requests by latency and let the backend
compute whatever quantile you need at query time. That preserves the ability to ask for a
different percentile, a different window, or a fleet-wide aggregate later, none of which a
precomputed mean or a precomputed quantile can give you.

**★ Why does tail latency matter more in a microservice architecture than in a monolith?**
Because tail latency compounds across fan-out. A page that needs five backend calls is slow if
*any one* of them is slow, so five independent 1% tails give roughly a 5% chance of a slow page.
The SRE book states the consequence directly: the 99th percentile of one backend can become the
median response of the frontend. The more services on the critical path, the further down the
percentile ladder your per-service targets have to sit to hit the same user-facing target.

**★ When would you deliberately look at the average rather than a percentile?**
When the question is about capacity rather than experience. Total time per second — the numerator
of the average — is a direct measure of how much concurrent work the service is carrying, which
is what you compare against thread pool size or connection pool size. It is also the right signal
for cost-per-request analysis. The distinction is that the average answers "how much work is
this?" and the percentile answers "what does this feel like?", and an incident is almost always
about the second one.

**★ Metrics, logs and traces — what determines which one you reach for?**
The shape of the question. Metrics are aggregated, always-on and cheap to query over long
windows, so they answer "is something broken, how badly, since when" and are what an alert fires
on. Traces are per-request and sampled, so they answer "where in the call graph did this
particular request spend its time". Logs are per-event and detailed, so they answer "what exactly
happened in this one execution". The cost models differ in the way that matters: metrics get
expensive per dimension and logs get expensive per event, which is why a user id is fine in a log
field and catastrophic in a metric tag.

**★ Why can you not compute a fleet-wide p99 from per-instance p99s?**
Because a quantile is not a linear function of the data — it is an order statistic. Knowing that
instance A's 99th percentile is 200 ms and instance B's is 400 ms tells you nothing about where
the 99th percentile of the combined request population falls, because that depends on the
relative request volumes and on the shape of both distributions below the reported point. There
is no arithmetic that recovers it. Buckets work because a bucket is a count of observations below
a boundary, counts from different instances add, and the quantile is then interpolated from the
summed buckets — which is exactly what `histogram_quantile` over `sum by (le)` does.

**★ Your service has one instance today. Does the aggregation argument still apply?**
Yes, for two reasons. First, one instance today is two instances at the next scale-out, and the
dashboards and alerts written against a client-side percentile will keep rendering after the
scale-out while quietly meaning something else — a silent regression is worse than a broken
query. Second, even on a single instance, a client-side percentile fixes the percentile and the
decay window at instrumentation time; you cannot decide next month that you care about p99.9, or
about a one-hour window, without a redeploy. Histograms cost more series but keep both choices
open.

{/* FOOTER */}
