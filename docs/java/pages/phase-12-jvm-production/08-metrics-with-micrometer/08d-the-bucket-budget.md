---
title: "The number of time series a timer produces is one decision with four inputs, three of which are configuration and one of which is a MeterFilter that silently deletes the other three when you forget to call merge"
sidebar_label: "08d · The bucket budget"
sidebar_position: 25
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **Micrometer 1.17 reference** — *Concepts · Histograms and
> Percentiles* and *Concepts · Meter Filters · Configuring Distribution Statistics*
> ([docs.micrometer.io](https://docs.micrometer.io/micrometer/reference/concepts/meter-filters.html)),
> the **Spring Boot 4.1 production-ready reference · Metrics · Per-meter Properties**
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/actuator/metrics.html)), and the
> **Spring Boot 4.1.0 sources** at tag `v4.1.0` —
> [`MetricsProperties`](https://github.com/spring-projects/spring-boot/blob/v4.1.0/module/spring-boot-micrometer-metrics/src/main/java/org/springframework/boot/micrometer/metrics/autoconfigure/MetricsProperties.java)
> and
> [`PropertiesMeterFilter`](https://github.com/spring-projects/spring-boot/blob/v4.1.0/module/spring-boot-micrometer-metrics/src/main/java/org/springframework/boot/micrometer/metrics/autoconfigure/PropertiesMeterFilter.java),
> whose javadoc supplies the prefix-matching rules quoted below. All series counts are arithmetic
> on Micrometer's documented bucket counts, shown with their working; no JVM was run. JDK 25 ·
> Spring Boot 4.1.0 · Micrometer 1.17.0.

**[08b](08b-histograms-and-buckets.md) established that a percentile histogram costs seventy-six
series per tag combination and [08c](08c-slos-and-the-bucket-budget.md) that an SLO boundary costs
one. This page is how you set those numbers, which happens in three different places that all feed
the same `DistributionStatisticConfig` — and how one of them can destroy the work of the other
two.**

## Lever 1 · the clamp

> *"`minimumExpectedValue`/`maximumExpectedValue`: Controls the number of buckets shipped by
> `publishPercentileHistogram` and controls the accuracy and memory footprint of the underlying
> HdrHistogram structure."*

Note that it does two things: fewer *exported series*, and a smaller *in-process* structure. Both
matter, and the second is the one people forget when they widen the range "just in case".

```java
Timer.builder("orders.process")
    .publishPercentileHistogram()
    .minimumExpectedValue(Duration.ofMillis(5))
    .maximumExpectedValue(Duration.ofSeconds(2))
    .register(registry);
```

Choose the range from what the operation actually does, not from what it might do on its worst day.
Values outside the clamp are **not lost** — they still contribute to `count`, `sum` and `max`, and
they land in the overflow bucket for quantile purposes. What you lose is resolution beyond the
edges, which is resolution you were not going to use.

The `MeterFilter` convenience forms are `maxExpected(Duration/long)` — *"Governs the upper bound of
percentile histogram buckets shipped from a timer or summary"* — and `minExpected`.

## Lever 2 · the filter

The general mechanism, and the line that must not be omitted:

```java
new MeterFilter() {
    @Override
    public DistributionStatisticConfig configure(Meter.Id id, DistributionStatisticConfig config) {
        if (id.getName().startsWith("orders")) {
            return DistributionStatisticConfig.builder()
                    .percentilesHistogram(true)
                    .maximumExpectedValue((double) Duration.ofSeconds(2).toNanos())
                    .build()
                    .merge(config);          // ← not optional
        }
        return config;
    }
};
```

> *"Generally, you should create a new `DistributionStatisticConfig` with only the pieces you wish
> to configure and then merge it with the input configuration. This lets you drop down on
> registry-provided defaults for distribution statistics and to chain multiple filters together,
> each configuring some part of the distribution statistics (for example, you might want a 100ms SLO
> for all HTTP requests but only percentile histograms on a few critical endpoints)."*

🔴 **Forgetting `.merge(config)` discards the registry defaults — including the 1 ms to 1 minute
clamp.** The filter that was supposed to be a small tuning change then ships the full 276-bucket
generator for every matching meter, quadrupling the bucket count and enlarging every HdrHistogram
in the process. Nothing warns you; the only symptom is the scrape getting bigger.

Scope the filter so it applies where you meant:

```java
registry.config().meterFilter(
    MeterFilter.forMeters(id -> id.getName().startsWith("orders"), histogramConfig));
```

## Lever 3 · the properties

Spring Boot exposes the same knobs as prefix-matched properties, applied by `PropertiesMeterFilter`:

```properties
management.metrics.distribution.percentiles-histogram.http.server.requests=true
management.metrics.distribution.maximum-expected-value.http.server.requests=2s
management.metrics.distribution.minimum-expected-value.http.server.requests=5ms
```

Two matching rules that are documented in `MetricsProperties`' own javadoc and are easy to miss:

> *"The longest match wins, the key `all` can also be used to configure all meters."*

So `percentiles-histogram.all=true` plus `percentiles-histogram.jvm=false` behaves as you would
hope, and `http.server` loses to `http.server.requests`. The `all` key is a convenience and a
loaded gun: it is the one-line form of the 36,480-series calculation above, applied to *every*
timer and distribution summary in the process, including the ones Micrometer's binders registered.

The values accept durations for timers:

> *"Values can be specified as a double or, for timer and long-task timer meters, as a `Duration`
> value defaulting to ms if no unit specified."*

`expiry` and `buffer-length` are also here, and they control the decay window rather than the
buckets — the same `expiry` × `bufferLength` window that makes a timer's `max` fall back to zero
([08](08-percentiles.md)).



## The budget, decided once

The four levers interact, so decide the number rather than the settings:

```
series(one timer) ≈ (buckets_from_generator + buckets_from_SLOs + 3)
                    ×  ∏(tag value counts)
                    ×  ∏(common tag value counts)
```

- **No histogram, no SLOs**: 3 series per combination (`count`, `sum`, `max`).
- **SLOs only** (two boundaries): 5 per combination. This is the cheap, high-value configuration
  and it is the one most services should start from.
- **Percentile histogram, default clamp**: ~76 per combination.
- **Percentile histogram, default clamp, two SLOs**: ~78.
- **Percentile histogram with the clamp destroyed** (a filter that forgot `.merge`): ~279.

*(Arithmetic on Micrometer's documented 276-bucket generator and 73-bucket default clamp, not a
measurement.)*

🔴 **Start with SLO boundaries, add percentile histograms only where someone will read them.** An
SLO count is five series and answers the question you will be asked in the incident review. A
percentile histogram is seventy-six and answers a question you will ask three times a year. Most
services have this exactly backwards because `percentiles-histogram` is the option with the
obvious name.


## An audit you can run today

The budget is not hypothetical; it is countable from the scrape you already expose.

1. **Count the series per meter name.** From `/actuator/prometheus`, group the lines by metric name
   and sort by count. The top five names are your entire cost conversation.
2. **Divide by the tag-combination count** to recover the per-combination series figure. Around 3
   means no distribution config. Around 76 means a percentile histogram with the default clamp.
   Around 279 means a filter forgot to merge.
3. **For each expensive meter, ask who reads it.** A percentile histogram nobody has queried in six
   months is the cheapest thing you will ever delete.
4. **Check `/actuator/metrics/<name>`** for the `availableTags` list, so you know the multiplier
   rather than guessing it.

The arithmetic beats intuition every time, because the cost is a product of numbers that are each
individually reasonable.

## Gotchas


**★ Forgetting `.merge(config)` in a `MeterFilter` silently removes the default clamp.** 276
buckets instead of 73, plus a larger HdrHistogram per meter. No error, no log line; the scrape
simply grows.

**★ The clamp controls in-process memory as well as exported series.** *"Controls the accuracy and
memory footprint of the underlying HdrHistogram structure."* Widening `maximumExpectedValue` to an
hour "to be safe" costs heap in every instance, per tag combination.

**★ Values outside the clamp are not discarded.** They still contribute to `count`, `sum` and `max`.
The clamp costs you bucket resolution outside the range, not data.

**★ The property matching is longest-prefix, and `all` participates.** A blanket `all=true` with a
narrower `false` beneath it works; two overlapping prefixes do not do what you expect unless you
know the longest one wins.



**★ Boot's property matching is per-prefix, not per-meter, so a prefix can catch more than you
meant.** `management.metrics.distribution.percentiles-histogram.http=true` matches
`http.server.requests` **and** `http.client.requests`, doubling a decision you thought you were
making once.

**★ `expiry` and `buffer-length` are in the same property family but do not affect bucket count.**
They control the decay window — the same `expiry` × `bufferLength` product that makes a timer's
`max` fall back to zero. Changing them to "fix" cost does nothing except change your statistics'
memory.

**★ A filter and a property can both configure the same meter, and the result is a merge, not a
winner.** `PropertiesMeterFilter` is `@Order(0)`; your unordered filter bean runs after it and, if
it merges correctly, adds to what the property did. If it does not merge, it silently replaces it.

**★ The clamp is per meter type, not global.** Micrometer clamps *timers* to 1 ms – 1 minute by
default; a `DistributionSummary` has no natural unit and its defaults are different. Copying a
timer's clamp values onto a summary is meaningless.

## Interview questions


**★ What does `.merge(config)` do in a `MeterFilter`'s `configure` method, and what happens without
it?**
It combines the partial configuration you built with everything already in effect — the registry's
defaults and any earlier filter's contribution. Without it you return a config containing only the
fields you set, which means every default is discarded, including the 1 ms to 1 minute clamp. A
filter written to add one percentile can therefore take a timer from 73 buckets to 276 and enlarge
its in-process HdrHistogram, with no error and no log line. The documented pattern is explicitly
"configure only the pieces you want, then merge".

**★ How would you decide `minimumExpectedValue` and `maximumExpectedValue` for a timer?**
From the operation's real distribution, not its worst conceivable case. The lower bound should sit
just below the fastest response you care about resolving, and the upper bound just above the slowest
you would still want quantile resolution for — usually your timeout. Values outside the range are
not lost; they still count toward `count`, `sum` and `max`, so a wide range buys you nothing except
buckets and heap. The instinct to set the maximum to an hour "in case something hangs" is exactly
backwards: a hang shows up in `max` and in the long-task timer, not in a bucket you will never look
at.

**★ Why is `management.metrics.distribution.percentiles-histogram.all=true` dangerous?**
Because the `all` key applies the setting to every timer and distribution summary the process has,
including the several hundred that Micrometer's JVM, cache, pool and HTTP binders registered.
Each one gains roughly 76 series per tag combination, and several of them are already
well-tagged. It is the single line most likely to turn a metrics bill into an incident, and the
alternative — naming the four or five meters where a percentile actually informs a decision — takes
five minutes.


**★ How do the four levers interact, and which one is dangerous?**
The generator produces boundaries; the expected-value clamp decides how many of them are shipped;
SLO boundaries add more on top; and Boot's properties or a `MeterFilter` are how the first three
get set. The dangerous one is the clamp, because it is the only one that can be removed by
accident — a `MeterFilter` returning a freshly built `DistributionStatisticConfig` without
`.merge(config)` discards the registry defaults, including the 1 ms to 1 minute range, taking a
meter from 73 buckets to 276 and enlarging its in-process HdrHistogram. Nothing logs it; the scrape
just grows.


**★ How would you find out which meter is responsible for most of a service's metric cost?**
Count the lines in the Prometheus scrape, grouped by metric name. The distribution is always
extremely skewed and the top few names account for nearly everything. Then divide each name's
series count by its tag-combination count, which `/actuator/metrics/<name>` gives you through
`availableTags`, to recover the per-combination figure: roughly 3 means no distribution statistics,
roughly 76 means a percentile histogram with the default clamp, and roughly 279 means the clamp was
lost. That last case points straight at a `MeterFilter` missing a `.merge(config)`, which is
otherwise undetectable.

{/* FOOTER */}
