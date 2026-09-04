---
title: "RED tells you whether your users are suffering and USE tells you which resource is causing it, and the reason you need both is that a service with perfect utilisation graphs can be failing every request while a service with a clean error rate can be four minutes from a thread-pool deadlock"
sidebar_label: "05 · RED and USE"
sidebar_position: 13
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **Google SRE book**, *Monitoring Distributed Systems · The Four
> Golden Signals* ([sre.google](https://sre.google/sre-book/monitoring-distributed-systems/)),
> **Brendan Gregg's "The USE Method"**
> ([brendangregg.com](https://www.brendangregg.com/usemethod.html)), **Grafana Labs' write-up of
> Tom Wilkie's GrafanaCon EU talk on the RED Method**, which quotes him directly
> ([grafana.com](https://grafana.com/blog/2018/08/02/the-red-method-how-to-instrument-your-services/)),
> the **Spring Boot 4.1 production-ready reference · Metrics**
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/actuator/metrics.html)), and the
> **Micrometer 1.17.0 sources** (`ExecutorServiceMetrics`, `JvmGcMetrics`) and **HikariCP's
> `MicrometerMetricsTracker`** for meter names. No JVM was run for this page; no metric values
> appear below. JDK 25 · Spring Boot 4.1.1 · Micrometer 1.17.0.
>
> ⚠️ RED has no specification document with the standing of Gregg's page or the SRE book. The
> quotations below are Tom Wilkie's words as reported by Grafana Labs, and are labelled as such.

**Instrumenting "everything" produces a service with four hundred meters and no answer to "is it
broken". These three checklists exist to make the first twenty meters the right twenty. RED is
about your users, USE is about your machines, and the golden signals are the superset that
contains both — you use all three, on different objects, for different questions.**

## The four golden signals

The SRE book is unambiguous about the priority:

> *"The four golden signals of monitoring are latency, traffic, errors, and saturation. If you can
> only measure four metrics of your user-facing system, focus on these four."*

**Latency.** And immediately the subtlety that most implementations miss:

> *"It's important to distinguish between the latency of successful requests and the latency of
> failed requests. For example, an HTTP 500 error triggered due to loss of connection to a database
> or other critical backend might be served very quickly; however, as an HTTP 500 error indicates a
> failed request, factoring 500s into your overall latency might result in misleading
> calculations. On the other hand, a slow error is even worse than a fast error! Therefore, it's
> important to track error latency, as opposed to just filtering out errors."*

**Traffic.** *"A measure of how much demand is being placed on your system, measured in a
high-level system-specific metric."*

**Errors.** Note the third category:

> *"The rate of requests that fail, either explicitly (e.g., HTTP 500s), implicitly (for example,
> an HTTP 200 success response, but coupled with the wrong content), or **by policy** (for example,
> 'If you committed to one-second response times, any request over one second is an error')."*

**Saturation.** *"How 'full' your service is. A measure of your system fraction, emphasizing the
resources that are most constrained."* And the operationally useful part:

> *"Note that many systems degrade in performance before they achieve 100% utilization, so having
> a utilization target is essential. … **Latency increases are often a leading indicator of
> saturation.** Measuring your 99th percentile response time over some small window (e.g., one
> minute) can give a very early signal of saturation."*

## RED: the golden signals minus the hard one

Tom Wilkie's argument for a separate acronym, as reported by Grafana Labs:

> *"The USE Method doesn't really apply to services; it applies to hardware, network disks, things
> like this. We really wanted a microservices-oriented monitoring philosophy, so we came up with
> the RED Method."*

- **Rate** — requests per second.
- **Errors** — how many of those are failing.
- **Duration** — how long they take.

> *"Everyone should understand the error rate, the request rate, and then some distribution of
> latency for those requests. You model this for every single service in your architecture, and
> this gives you a nice, consistent view of how your architecture is behaving. Giving this kind of
> consistency across services allows you to scale your operational team, and allows you to put
> people on call for code they didn't write."*

That last clause is the real argument. RED is a *uniformity* discipline, not a completeness one:
its value is that every service in the estate has the same three panels in the same order, so an
on-call engineer who has never seen your code can still triage it.

Wilkie is explicit that RED is the golden signals with saturation removed, and that removal is
deliberate — saturation is the hard, service-specific one.

## USE: the same discipline pointed at resources

> *"For every resource, check utilization, saturation, and errors."*

With Gregg's definitions, which are more precise than most people's paraphrase:

> *"**resource**: all physical server functional components (CPUs, disks, busses, …)*
> ***utilization**: the average time that the resource was busy servicing work*
> ***saturation**: the degree to which the resource has extra work which it can't service, often
> queued*
> ***errors**: the count of error events"*

and the units:

> *"utilization: as a percent over a time interval … saturation: as a queue length … errors:
> scalar counts."*

🔴 The most valuable paragraph on Gregg's page is the one people skip:

> *"**Does Low Utilization Mean No Saturation?** A burst of high utilization can cause saturation
> and performance issues, even though utilization is low when averaged over a long interval. This
> may be counter-intuitive! I had an example where a customer had problems with CPU saturation
> (latency) even though their monitoring tools showed CPU utilization was never higher than 80%.
> The monitoring tool was reporting five minute averages, during which CPU utilization hit 100% for
> seconds at a time."*

That is the same argument as [01 · The average that lied](01-the-average-that-lied.md), applied to
resources instead of latency, and it is why saturation is a separate signal rather than "high
utilisation".

Wilkie's summary of how the two fit together:

> *"It's like the RED Method is about caring about your users and how happy they are, and the USE
> Method is about caring about your machines and how happy they are. It's really just two
> different views on the same system. They're complimentary."*

## RED, in a Spring Boot service, costs you nothing

All three come out of a single meter you already have. `http.server.requests` is a `Timer`, so it
publishes a count and a total; it is tagged with `outcome`, `status`, `method`, `uri` and
`exception` ([06 · What Boot gives you free](06-what-boot-gives-you-free.md)).

```promql
# Rate — requests per second, per endpoint
sum by (uri) (rate(http_server_requests_seconds_count[5m]))

# Errors — the fraction failing, which is the number you alert on
sum by (uri) (rate(http_server_requests_seconds_count{outcome="SERVER_ERROR"}[5m]))
  /
sum by (uri) (rate(http_server_requests_seconds_count[5m]))

# Duration — the mean is always available; the p99 needs a histogram (08b)
sum by (uri) (rate(http_server_requests_seconds_sum[5m]))
  /
sum by (uri) (rate(http_server_requests_seconds_count[5m]))
```

*(Series names follow Prometheus's snake-case naming convention applied to the meter name; check
your own scrape rather than assuming the suffix, since it depends on the registry and the base
unit.)*

Two things to do immediately, both straight out of the SRE book:

**Split latency by outcome, do not filter errors out.** A fast 500 flatters your p99 and a slow 500
is the worst case of all. Because `outcome` is already a tag, this is a query change, not an
instrumentation change:

```promql
histogram_quantile(0.99, sum by (le, uri, outcome) (rate(http_server_requests_seconds_bucket[5m])))
```

**Add the "by policy" error.** If your commitment is 500 ms, requests slower than that are errors
even when they return 200. A `serviceLevelObjectives(Duration.ofMillis(500))` boundary on the timer
gives you the bucket to count them from — [08c · SLOs and the bucket
budget](08c-slos-and-the-bucket-budget.md).

## What USE looks like on a JVM

Gregg's resource list is hardware. For a Spring Boot service the resources are the bounded pools
your requests contend for — the connection pool, the request threads, the task executors, the heap
— and Boot instruments most of them already. The resource-by-resource table, the saturation metric
that actually predicts incidents, and the order in which you read RED and USE during a live
incident are [05b · USE for a JVM service](05b-use-for-a-jvm-service.md).

## Gotchas

**★ Filtering errors out of your latency graph is worse than including them.** The SRE book asks
for the opposite: track error latency *separately*. A fast 500 lowers your p99 and looks like an
improvement; a slow 500 is the most expensive request you serve. Split by `outcome`, do not
exclude.

**★ RED omits saturation, and that is the signal that gives you warning.** Rate, errors and
duration are all *lagging* — they move when users are already affected. Saturation moves first.
A dashboard with only RED is a dashboard that tells you about outages, not about impending ones.

**★ Utilisation averaged over five minutes hides the saturation that caused the latency.** Gregg's
own worked case: a customer with CPU saturation whose tooling never showed utilisation above 80%,
because it reported five-minute averages over intervals in which utilisation hit 100% for seconds.
Resolution is part of the measurement.

**★ "Errors by policy" is a category most services never implement.** A 200 that took nine seconds
is a failed request by any user-facing definition. It requires an SLO boundary on the timer, and
without one you cannot count them.

**★ Rate without errors is a trap during an outage.** A service returning 500s instantly can show
*higher* request rate and *lower* duration than a healthy one, because failing is fast and clients
retry. Rate going up is not automatically good news.

**★ Applying RED to a resource, or USE to a service, produces nonsense in both directions.** There
is no meaningful "utilisation" of an HTTP endpoint and no meaningful "request rate" of a heap.
Wilkie's framing — users versus machines — is the test for which checklist you are holding.

**★ RED per *service* is not enough once one service has several distinct workloads.** An endpoint
serving a 3 ms cache lookup and an endpoint doing a 4-second report share a service-level p99 that
describes neither. Tag by `uri` and apply RED per endpoint, which Boot already gives you.

**★ Neither method tells you what to alert on.** They tell you what to *measure*. The SRE book's
own guidance — page on symptoms, not causes — is a separate decision, and it is
[10 · Alerting on what matters](10-alerting-on-what-matters.md).

## Interview questions

**★ What are the four golden signals and which one does RED drop?**
Latency, traffic, errors and saturation. RED keeps rate (traffic), errors and duration (latency) and
drops saturation. The drop is deliberate: saturation is service-specific and hard to define
uniformly, whereas the other three can be derived identically for every HTTP service in an estate,
which is what makes a common dashboard possible. The cost of the omission is that RED is entirely
composed of lagging indicators — they move once users are already affected.

**★ Why does the SRE book insist on separating the latency of successful and failed requests?**
Because failures distort latency in both directions and the distortion is invisible in an
aggregate. A connection-refused 500 returns in microseconds and drags your p99 *down*, so an
outage can look like a performance improvement. Conversely a timeout-driven 504 is the slowest
request you serve, and if you filter errors out of the graph you have deleted your worst case. The
guidance is to track error latency separately, not to exclude it — and since `outcome` is already a
tag on `http.server.requests`, doing so is a query change rather than an instrumentation change.

**★ What is an "error by policy" and how would you measure one?**
A request that succeeded technically but violated a commitment — the SRE book's example is a
one-second response-time commitment, under which any request over one second is an error. You
measure it by putting a service-level objective boundary at that latency on the timer, which makes
Micrometer publish a cumulative histogram bucket at exactly that value; the count of requests above
it is then the error count. Without the SLO boundary you cannot compute it accurately from
percentiles, because a percentile answers "how slow is the nth request", not "how many requests
were slower than X".

**★ Your rate graph went up and your duration graph went down during an incident. What is
happening?**
Almost certainly failing fast. A service returning 500s from a connection-refused path answers in
microseconds, which pulls the duration aggregate down, and clients retrying failed requests push
the observed rate up. Both signals move in the direction that looks like an improvement. This is
exactly why errors is one of the three and why the error *ratio* rather than the error count is
what belongs on a dashboard — the ratio moves unambiguously.

**★ Is it enough to apply RED at the service level?**
Only for a service whose endpoints have similar work profiles. Once one endpoint serves a
millisecond cache lookup and another builds a four-second report, a service-level p99 describes
neither of them and any threshold you pick is wrong for both. The fix is free in Spring Boot,
because `http.server.requests` already carries a templated `uri` tag, so RED per endpoint is a
`by (uri)` clause. It is not free in cardinality terms, which is the trade
[04b](04b-cardinality.md) makes explicit.

{/* FOOTER */}
