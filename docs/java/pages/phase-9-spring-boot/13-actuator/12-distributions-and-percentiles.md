---
title: "Distributions: the percentile you cannot add up"
sidebar_label: "12 · Distributions and percentiles"
sidebar_position: 12
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-20 against the Spring Boot 4.1.1 reference — *Actuator ·
> Metrics · Per-meter Properties*
> (docs.spring.io/spring-boot/reference/actuator/metrics.html: the
> `management.metrics.distribution.percentiles-histogram` and `.percentiles`
> properties, and `.expiry` / `.buffer-length` described as accumulating
> samples in ring buffers to give greater weight to recent ones) and the
> Micrometer 1.17 reference — *Concepts · Histograms and percentiles*
> (docs.micrometer.io/micrometer/reference/concepts/histogram-quantiles.html:
> `publishPercentiles` versus `publishPercentileHistogram`, the statement that
> percentile approximations cannot be aggregated, and the list of systems
> supporting histogram-based percentile approximations). Spring Boot 4.1.1,
> Spring Framework 7.0.x, JDK 25.

**A `Timer` publishes a count, a total and a max. It does not publish a p99
unless you ask for one, and the two ways of asking are not two settings for the
same feature — they are two different products with different arithmetic.
`percentiles` computes the answer inside your process and ships a number that
cannot legitimately be combined with the same number from any other instance.
`percentiles-histogram` ships bucket counts and lets the backend compute the
answer for whatever set of instances you point at it. If your service runs on
more than one machine — and it does — the first one gives you a dashboard that
is confidently, silently wrong.**

## What a timer publishes by default

Three numbers per time series: the **count** of recordings, the **total** time,
and a **max**. That is the whole default payload, and two things about it are
worth holding onto.

The first is that `max` is not a maximum since the process started. It is a
rolling maximum over a decaying window, governed by
`management.metrics.distribution.expiry` and `.buffer-length` — the ring-buffer
mechanism the reference describes as giving greater weight to recent samples. A
max that never decayed would be a record of your worst-ever moment and would
never move again, which is useless for watching a live system.

The second is that count and total give you a **mean**, and the mean is the
least informative number in latency work. Latency distributions are not
symmetric: they are a tight body with a long right tail, and the mean sits in a
region where relatively little traffic actually is. A service with a 40 ms mean
can be timing out for one request in fifty without the mean moving enough to
notice. Every question worth asking about latency is a question about the tail,
which is why the rest of this chunk exists.

## Client-side percentiles: a real number you must not add up

```properties
management.metrics.distribution.percentiles.http.server.requests=0.5,0.95,0.99
```

Micrometer computes percentile approximations **in your process**, per meter id,
and publishes them as additional series carrying the quantile as a dimension.
The numbers are correct for that instance, over that interval.

And the Micrometer reference states the constraint plainly: *"It is not possible
to aggregate percentile approximations across tags."* That is not an
implementation gap somebody may close later. A percentile is a property of a
distribution, and the published number has already thrown the distribution away.

**The failure mode, concretely.** Ten pods behind a load balancer. Nine are idle
and serving from cache in about 6 ms; one has a poisoned connection pool and is
serving in about 3 s. Each pod publishes its own p99, so the backend now holds
nine series near `0.006` and one near `3.1`. The dashboard has to turn ten
numbers into one, and every option available to it is wrong:

| What the panel does | What it shows | Why it is wrong |
|---|---|---|
| `avg` of the ten p99s | ≈ 0.3 s | Not the p99 of anything. No request took that long, and the value changes if you scale to twenty pods |
| `max` of the ten p99s | ≈ 3.1 s | The worst *pod's* tail, not the fleet's — wildly over-reported if that pod served 1% of traffic |
| `sum` | ≈ 3.4 s | Meaningless in every dimension including units |

The true fleet p99 depends on how traffic was distributed across those pods, and
none of the ten numbers carries that information. There is no clever query that
recovers it, because the data needed to compute it was discarded before it left
the JVM.

**So client-side percentiles are honest in exactly one situation: a single
instance, read on its own.** That is a real situation — a batch job, a singleton
scheduler, a service you genuinely run one of, a local investigation — and there
they are cheap and precise enough to be the right tool. They are simply not what
belongs on a fleet dashboard, which is where they almost always end up, because
the property is one line and the graph it produces looks entirely plausible.

## Percentile histograms: buckets, because counts add

```properties
management.metrics.distribution.percentiles-histogram.http.server.requests=true
```

Instead of an answer, each instance ships **bucket counts**: how many recordings
fell under 1 ms, under 2 ms, under 5 ms and so on, up a cumulative ladder. Bucket
counts from ten instances add together to give the bucket counts of the fleet,
and the percentile is computed from that combined histogram *by the backend* —
`histogram_quantile` in Prometheus, `:percentile` in Atlas, `hs()` in Wavefront.

That is the entire difference, and it generalises well beyond this property:
**addition is defined on counts and undefined on quantiles, so the aggregation
has to happen before the computation.** Any time a monitoring number cannot be
combined across instances, look for the point where the pipeline computed
something too early.

⚠️ **Micrometer names only Prometheus, Atlas and Wavefront as supporting
histogram-based percentile approximations.** On a backend outside that set,
turning `percentiles-histogram` on ships buckets nobody will ever query — you pay
the full storage cost for data the system cannot interpret. This is the single
most-copied line in Micrometer configuration and it moves between backends
without complaint, because publishing succeeds; only the query side is missing.

What buckets cost, how to clamp them, and the cheaper option that answers most
real questions are the subject of
[the next chunk](13-configuring-distributions.md) — the cost is not incidental,
and it is large enough that "just turn on histograms" is not advice.

## Gotchas

**Symptom:** the fleet p99 on the dashboard is far lower than what users report, and lower than the worst pod's behaviour
**Cause:** client-side `percentiles` are being averaged across instances, and the average of ten p99s is not a p99 of anything
**Fix:** switch that meter to buckets and let the backend compute the quantile:
```properties
management.metrics.distribution.percentiles-histogram.http.server.requests=true
management.metrics.distribution.percentiles.http.server.requests=
```

**Symptom:** `percentiles-histogram` is enabled, the series count rises sharply, and no percentile query works
**Cause:** the backend does not support histogram-based percentile approximations — Micrometer names only Prometheus, Atlas and Wavefront
**Fix:** turn it off for that registry and use `slo` boundaries instead, which are ordinary cumulative counts any backend can graph; or keep client-side `percentiles` if the deployment really is a single instance

**Symptom:** the `max` on a timer drops back down after an incident, so the incident vanishes from the graph
**Cause:** `max` is a decaying rolling maximum governed by `expiry` and `buffer-length`, not an all-time high-water mark
**Fix:** nothing to work around — this is deliberate. If the spike must still be visible next week, it has to live in bucket counts, because counts do not decay

**Symptom:** a p99 on a low-traffic endpoint jumps wildly between scrapes
**Cause:** a percentile over a handful of samples is dominated by which samples landed in the interval — a p99 of twelve recordings *is* one recording
**Fix:** aggregate over a longer window in the query, or accept that low-traffic endpoints are watched by error rate and `max` rather than by tail latency, which is usually the honest answer

**Symptom:** both `percentiles` and `percentiles-histogram` are set on the same meter and nobody remembers why
**Cause:** copy-paste from two different tutorials; they are alternatives, not a pair, and you are paying for both
**Fix:** on a fleet, keep the histogram and delete the client-side percentiles. This particular duplication survives code review because each line is correct in isolation — it is only wrong together

## Interview questions

**★ A timer is publishing to Prometheus. What do you actually get, before you configure anything?**
Count, total time and a max, per time series — not a percentile, not a
distribution, not a histogram. Count and total give you a mean, which for latency
is close to useless because the distribution is heavily right-skewed and the mean
sits where comparatively little traffic is. Everything interesting about latency
lives in the tail, and reaching it means opting in to either client-side
percentiles or a histogram, which are different features with different
arithmetic.

**★ What is wrong with averaging p99 across instances?**
A percentile is a property of a distribution and the published p99 has already
discarded the distribution. Nine idle pods reporting 6 ms and one broken pod
reporting 3 s average to roughly 300 ms — a number no request experienced, and
one that changes if you scale the deployment rather than if the service changes.
Taking the max instead gives you the worst pod's tail, which over-reports badly
if that pod served a small share of traffic. The fleet p99 is not recoverable
from per-instance percentiles at all, which is why Micrometer states outright
that percentile approximations cannot be aggregated.

**★ Then why does the client-side option exist?**
Because it is correct for one instance, it is cheap, and it works on every
backend rather than the three that understand histogram buckets. A batch job, a
singleton scheduler, a local profiling session or a genuinely single-instance
service are all cases where the in-process approximation is exactly the right
tool. The mistake is not using it — it is using it on a horizontally scaled
service and then reading the aggregate as if it meant something.

**★ How does `percentiles-histogram` make the number aggregable?**
By shipping bucket counts instead of an answer. Each instance reports how many
recordings fell below each boundary; counts from different instances add, so the
backend reconstructs the fleet's distribution and computes the quantile from
that — `histogram_quantile` in Prometheus, `:percentile` in Atlas, `hs()` in
Wavefront. The principle worth taking away is more general than the property:
move the aggregation before the computation, because addition is defined on
counts and undefined on quantiles.

**★ Why does `max` on a timer go back down?**
Because it is a decaying rolling maximum over a recent window, controlled by
`expiry` and `buffer-length`, rather than a high-water mark. That is deliberate:
an all-time max would record your worst-ever second and then never move again,
which tells you nothing about the present. The consequence to internalise is
that `max` is a live signal and a poor historical record — if a spike needs to
still be visible next week, it has to be in counts.

**★ Your service runs on one instance today but will be scaled out next quarter. Which do you configure?**
Histograms, if the backend supports them, because the alternative is a dashboard
that is right today and quietly wrong the day somebody changes a replica count —
with no error, no alert and no visible transition. That is the worst shape a
monitoring bug can take. If the backend cannot do histogram quantiles, define
SLO boundaries instead, since bucket counts aggregate correctly on any backend
and survive the scale-out unchanged.

**★ A team says "we have p99 dashboards, so we have tail visibility". What would you check?**
Three things, in order. Whether the p99 is client-side or histogram-derived, and
if client-side, how many instances are behind it. Whether the meter has enough
traffic per interval for a p99 to mean anything, because a p99 over a dozen
samples is a single sample wearing a statistical hat. And whether anyone has ever
compared the dashboard against a known slow request — a percentile pipeline that
is wrong tends to look completely normal, which is why it goes unnoticed for
years.

---

← Prev: [Tags, filters and cardinality](11-tags-filters-cardinality.md) · Index: [Actuator](README.md) · Next → [Configuring distributions](13-configuring-distributions.md)
