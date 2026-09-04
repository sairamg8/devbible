---
title: "Configuring distributions: buckets, SLOs and what they cost"
sidebar_label: "13 · Buckets, SLOs and cost"
sidebar_position: 13
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-20 against the Spring Boot 4.1.1 reference — *Actuator ·
> Metrics · Per-meter Properties*
> (docs.spring.io/spring-boot/reference/actuator/metrics.html:
> `management.metrics.distribution.slo` publishing a cumulative histogram with
> buckets defined by your service-level objectives,
> `.minimum-expected-value`/`.maximum-expected-value` described as publishing
> fewer histogram buckets by clamping the range of expected values, and the
> per-meter-name-prefix matching of all `management.metrics.*` keys) and the
> Micrometer 1.17 reference — *Concepts · Histograms and percentiles*
> (docs.micrometer.io/micrometer/reference/concepts/histogram-quantiles.html:
> *"By default, the generator yields 276 buckets, but Micrometer includes only
> those within the range set by minimumExpectedValue and maximumExpectedValue,
> inclusive"*, `serviceLevelObjectives`) and the Micrometer
> `io.micrometer.core.instrument.config.MeterFilter` and
> `DistributionStatisticConfig` javadoc. Spring Boot 4.1.1, Spring Framework
> 7.0.x, JDK 25.

**Buckets are published per time series, not per meter — so turning on a
histogram does not add a few hundred series to your monitoring bill, it
multiplies the cardinality you already have by the bucket count. That single
fact reorders the whole decision: clamping the range is not tuning, it is the
precondition for affording histograms at all, and SLO boundaries are not a
lesser option but the correct one for every question that already contains a
threshold.**

## The cost is a multiplication

[The previous chunk](12-distributions-and-percentiles.md) argued for histograms
on correctness grounds. This is the bill.

Micrometer's default bucket generator, in its own words, *"yields 276 buckets,
but Micrometer includes only those within the range set by
`minimumExpectedValue` and `maximumExpectedValue`, inclusive."* Those buckets are
attached to **each series the meter already produces**. If `http.server.requests`
carries four hundred series from its `uri`, `method`, `status` and `outcome`
tags, an unclamped histogram does not take you to seven hundred series — it takes
you to four hundred multiplied by the surviving bucket count.

That is why this sits directly after
[cardinality](11-tags-filters-cardinality.md) rather than being a footnote to it.
A tag decision made casually costs you linearly today and becomes a large
multiplier the day somebody enables histograms — and the person enabling
histograms is usually not the person who added the tag, six months earlier, for a
dashboard nobody kept.

## Clamping is the precondition, not the tuning

```properties
management.metrics.distribution.minimum-expected-value.http.server.requests=1ms
management.metrics.distribution.maximum-expected-value.http.server.requests=10s
```

Read this as two declarations rather than two numbers: *I do not care about
sub-millisecond resolution*, and *anything past ten seconds is simply "too slow"
and does not need to be distinguished from anything else that is too slow*. Both
are almost always true, and together they remove most of the 276 buckets before
a single one is published.

Clamping is not lossy in the way it sounds. Recordings outside the range are
still counted, still included in count, total and max, and still land in the
outermost bucket — what you lose is the *resolution* to say whether something
took 14 s or 40 s, which was never a distinction you were going to act on
differently.

⚠️ Clamp too aggressively and you get the opposite failure: if the maximum is
below your typical latency, every recording lands in the overflow bucket and the
histogram carries no information at all while still costing what a histogram
costs. The range wants to bracket the behaviour you are trying to see, not the
behaviour you wish you had.

## SLO boundaries: cheap, exact, and usually the right answer

```properties
management.metrics.distribution.slo.http.server.requests=100ms,300ms,1s
```

This publishes a cumulative histogram with **your** boundaries instead of
Micrometer's generated ladder, and it is under-used relative to how well it fits
what teams actually want to know.

An SLO is not a percentile. "99% of checkout requests complete within 300 ms" is
a statement about **how many requests fell in a bucket** — and a bucket boundary
at exactly 300 ms answers it by counting. Exactly. Aggregably. With three series
instead of dozens. Asking the same question through a p99 answers it by
approximating a quantile from buckets and then comparing the approximation to
your threshold, which is a longer route to a less certain answer.

**The practical rule: if you can name the thresholds you care about, name them.**
Reach for the full `percentiles-histogram` only when you need to know what the
tail value *is*, rather than whether it is under a number — which in practice is
a capacity-planning question rather than an alerting one, asked occasionally
rather than evaluated every fifteen seconds.

`slo` and `percentiles-histogram` compose, incidentally: setting SLO boundaries
on a meter that also publishes a generated histogram adds your boundaries to the
generated ladder rather than replacing it. That is occasionally what you want and
is more often an accident that pays for both.

## The property keys are prefixes, not names

Every key under `management.metrics.distribution.*` is matched as a **meter-name
prefix**, which is convenient and occasionally expensive:

```properties
# matches http.server.requests AND http.client.requests
management.metrics.distribution.percentiles-histogram.http=true

# matches only the server side
management.metrics.distribution.percentiles-histogram.http.server.requests=true
```

The first line looks like a tidy generalisation of the second and costs roughly
twice as much, because your outbound `RestClient` instrumentation lives under
`http.client.requests` with its own tag cardinality. These properties reward
being verbose: the longer key does exactly one thing, and the shorter one does
whatever the meter naming happens to make it do.

## Doing it in code

Per-meter properties cover meters you can name. For meters you create, the
builder carries the same knobs directly:

```java
Timer.builder("payment.authorisation")
        .publishPercentileHistogram()
        .serviceLevelObjectives(Duration.ofMillis(300), Duration.ofSeconds(1))
        .minimumExpectedValue(Duration.ofMillis(1))
        .maximumExpectedValue(Duration.ofSeconds(10))
        .register(registry);
```

And for meters you do **not** own — a library's timer, or a policy that must
apply across a whole family — a `MeterFilter` reaches all of them at
registry-configuration time:

```java
@Bean
MeterFilter slosForOutboundCalls() {
    return new MeterFilter() {
        @Override
        public DistributionStatisticConfig configure(Meter.Id id,
                DistributionStatisticConfig config) {
            if (!id.getName().startsWith("http.client.requests")) {
                return config;
            }
            return DistributionStatisticConfig.builder()
                    .serviceLevelObjectives(
                            (double) Duration.ofMillis(200).toNanos(),
                            (double) Duration.ofSeconds(1).toNanos())
                    .build()
                    .merge(config);
        }
    };
}
```

⚠️ Two things in that snippet are the whole reason it is shown. `merge(config)`
keeps whatever else was configured — drop it and you silently replace the
existing distribution settings rather than adding to yours. And
`DistributionStatisticConfig` boundaries for a `Timer` are **nanoseconds**, which
is why the durations are converted. Passing `200` meaning milliseconds gives you
a bucket at 200 nanoseconds, every recording lands above the top boundary, and
the resulting panel is a flat line that looks exactly like a working metric with
no traffic.

## `DistributionSummary` takes the same knobs

Everything above applies to `DistributionSummary`, with one difference: its
boundaries are plain numbers in the summary's base unit rather than durations.

```properties
management.metrics.distribution.slo.upload.size=1048576,10485760
management.metrics.distribution.maximum-expected-value.upload.size=104857600
```

That is why the type exists separately from `Timer` rather than being a timer
with different units. Payload sizes, batch sizes and basket values have tails
worth watching for the same reason latency does — "the mean upload is 200 kB"
hides the 200 MB one that filled a disk, and it hides it in exactly the way a
mean latency hides a timeout.

## The trade-off

Everything here buys tail visibility with storage, and the exchange rate is poor
if you are careless. A generated histogram on a meter with a few hundred series
is a large multiplication in exchange for a question you may only ask during an
incident. A client-side percentile is nearly free and is a lie on any fleet
dashboard. An SLO histogram is cheap and answers only the questions you thought
of in advance.

The honest position is that **no setting gives you arbitrary tail queries
cheaply**, and configuring as though one did is how monitoring bills grow without
anybody making a decision. Decide which thresholds matter, encode those as SLO
buckets on the handful of meters carrying user-facing latency, clamp the range on
anything that gets a generated histogram, and leave everything else publishing
count, total and max — which is, after all, enough to spot most outages.

## Gotchas

**Symptom:** enabling a histogram on one meter noticeably raises the whole monitoring bill
**Cause:** buckets are published *per time series*, so the bucket count multiplies the meter's existing tag cardinality rather than adding to it
**Fix:** clamp the range before enabling anything, so the 276 generated buckets collapse to the ones you would look at:
```properties
management.metrics.distribution.minimum-expected-value.http.server.requests=1ms
management.metrics.distribution.maximum-expected-value.http.server.requests=10s
```

**Symptom:** a clamped histogram shows everything in one bucket and no shape at all
**Cause:** `maximum-expected-value` is below typical latency, so every recording overflows into the top bucket
**Fix:** bracket the behaviour you actually have — check the meter's `max` first, then set the ceiling above it, rather than setting the ceiling to the latency you wish you had

**Symptom:** `management.metrics.distribution.percentiles-histogram.http=true` costs about twice what was expected
**Cause:** the key is a meter-name **prefix**, so it matches `http.client.requests` as well as `http.server.requests`
**Fix:** name the meter precisely — `...percentiles-histogram.http.server.requests=true` — and add the client side deliberately if you want it

**Symptom:** an SLO histogram configured through a `MeterFilter` puts every recording in the overflow bucket
**Cause:** `DistributionStatisticConfig` boundaries for a `Timer` are in nanoseconds and millisecond values were passed
**Fix:** convert explicitly — `Duration.ofMillis(200).toNanos()` — and check that the lowest boundary is not already above your typical recording

**Symptom:** adding a `MeterFilter` for SLOs silently removes percentile settings configured elsewhere
**Cause:** the returned `DistributionStatisticConfig` replaced the incoming one instead of merging with it
**Fix:** always end the builder with `.merge(config)`, which is what makes a filter additive rather than authoritative

**Symptom:** SLO buckets are configured but the "percentage under 300 ms" panel still shows an approximation
**Cause:** the query is still computing a quantile and comparing it to a threshold, rather than dividing the 300 ms bucket count by the total count
**Fix:** query the bucket directly. The entire reason to define SLO boundaries is that the answer becomes a ratio of two counts, which is exact — computing a quantile first throws that exactness away

**Symptom:** a `DistributionSummary` configured with `slo=100ms,300ms` reports nothing useful
**Cause:** summary boundaries are plain numbers in the meter's base unit; a duration string is not a byte count
**Fix:** express the boundaries in the unit you set with `baseUnit(...)` — `1048576,10485760` for bytes — and keep the unit visible in the property so the next reader can tell what the numbers mean

## Interview questions

**★ Why is enabling a histogram sometimes described as a cardinality decision rather than a metrics one?**
Because buckets are published per time series. The cost is the bucket count
multiplied by the meter's existing tag cardinality, so a meter with four hundred
series does not gain a few hundred series when you enable histograms — it gains
hundreds of times four hundred. That makes it the same conversation as tagging: a
tag added casually is a linear cost today and a multiplier later, and the person
who pays is usually not the person who added it.

**★ What do `minimum-expected-value` and `maximum-expected-value` actually do?**
They clamp which of the generated buckets are published. Micrometer's default
generator yields 276 buckets and includes only those within the declared range,
so declaring 1 ms to 10 s removes most of them before anything is shipped.
Recordings outside the range are not lost — they still count toward count, total
and max, and land in the outermost bucket — what you lose is resolution in a
region where you would not act differently anyway. Reading them as declarations
rather than tuning knobs is what makes them easy to set correctly.

**★ When would you prefer SLO boundaries to a percentile histogram?**
Whenever the question already contains a threshold, which covers most alerting.
"99% of requests under 300 ms" is a counting question: a boundary at 300 ms turns
it into one count divided by another — exact, aggregable across instances, and a
handful of series rather than dozens. Percentiles answer the harder question of
what the tail value *is*, which matters for capacity planning and is asked
occasionally rather than evaluated on every scrape.

**★ How do you apply distribution settings to a meter you did not create?**
A `MeterFilter` bean, overriding `configure(Meter.Id, DistributionStatisticConfig)`.
It runs at registry-configuration time and sees every meter, including those
registered by libraries, so it is the only way to impose policy on
instrumentation whose source you are not going to change. The part that must not
be forgotten is `.merge(config)` on the way out — without it the filter replaces
the incoming configuration instead of adding to it, which quietly undoes settings
made through properties elsewhere.

**★ Someone passes `200` to `serviceLevelObjectives` on a timer, meaning 200 ms. What happens?**
They get a bucket boundary at 200 nanoseconds. Every recording is above it, the
cumulative histogram carries no information, and the panel renders as a clean
flat line — which is the dangerous part, because a broken histogram looks
identical to a healthy one with no traffic. `DistributionStatisticConfig` works
in nanoseconds for timers, so the value has to be converted explicitly, and the
habit worth forming is to sanity-check that the lowest boundary is below the
meter's typical recording before trusting the graph.

**★ Why does `DistributionSummary` have its own configuration rather than reusing the timer's?**
Because its boundaries are quantities, not durations — bytes, items, currency —
so a value like `300ms` is not merely inconvenient there, it is meaningless. The
deeper reason the type exists at all is that non-time quantities have tails worth
watching for exactly the same reason latency does: a mean upload size hides the
one enormous upload that filled a disk in precisely the way a mean latency hides
a timeout.

---

← Prev: [Distributions and percentiles](12-distributions-and-percentiles.md) · Index: [Actuator](README.md) · Next → [The Observation API](14-the-observation-api.md)
