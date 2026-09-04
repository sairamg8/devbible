---
title: "The other four meter types exist for the measurements the first three cannot express — a distribution of sizes, a task that is still running and therefore has no duration yet, and a number that already exists somewhere in the application and only needs reading"
sidebar_label: "03d · The specialised meters"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **Micrometer 1.17 reference** — *Concepts · Distribution
> summaries*, *Long task timers* and *Meters*
> ([docs.micrometer.io](https://docs.micrometer.io/micrometer/reference/concepts/distribution-summaries.html));
> and the **Micrometer 1.17.0 sources** at tag `v1.17.0` —
> [`AbstractDistributionSummaryBuilder`](https://github.com/micrometer-metrics/micrometer/tree/v1.17.0/micrometer-core/src/main/java/io/micrometer/core/instrument)
> and the percentile-histogram bucket generation in
> [`PercentileHistogramBuckets`](https://github.com/micrometer-metrics/micrometer/blob/v1.17.0/micrometer-core/src/main/java/io/micrometer/core/instrument/distribution/PercentileHistogramBuckets.java).
> JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9 · Micrometer 1.17.0.

**[03](03-the-meter-types.md) covered the three meters that answer almost every question: counter,
gauge and timer. This page is the remaining four, each of which exists because one of those three
cannot express something — a distribution that is not a duration, a task whose duration is not
known because it has not finished, and a value the application already tracks that only needs
sampling. Reaching for one of these when a timer would do is the more common mistake; not knowing
they exist is the more expensive one.**

## `DistributionSummary`

Structurally a timer without the time-unit scaling.

```java
DistributionSummary payload = DistributionSummary.builder("http.request.payload")
    .baseUnit("bytes")
    .minimumExpectedValue(64.0)        // clamp: see below
    .maximumExpectedValue(10_000_000.0)
    .register(registry);

payload.record(body.length);
```

🔴 **The clamp is not optional here in the way it is for a timer.** The reference:

> *"By default, summaries have NO minimum and maximum expected value, so we ship all 276
> predetermined histogram buckets. You should always clamp distribution summaries with a
> `minimumExpectedValue` and `maximumExpectedValue` when you intend to ship percentile
> histograms."*

There is also a `scale(double)` factor applied to each recorded sample — the documented use case
is ratios in `[0,1]`, scaled by 100 so that `maximumExpectedValue(100)` becomes meaningful and the
integer bucket generator has somewhere to put them.

## `LongTaskTimer`

The one meter type whose purpose is not obvious until you have been burned by its absence.

> *"The long task timer is a special type of timer that lets you measure time while an event being
> measured is still running. A normal `Timer` only records the duration after the task is
> complete."*

> *"Long task timers publish at least the following statistics: Active task count; Total duration
> of active tasks; The maximum duration of active tasks. Unlike a regular `Timer`, a long task
> timer does not publish statistics about completed tasks."*

The argument for it, in the reference's words:

> *"If we wanted to alert when this process exceeds a threshold, with a long task timer, we
> receive that alert at the first reporting interval after we have exceeded the threshold. With a
> regular timer, we would not receive the alert until the first reporting interval after the
> process completed, over an hour later!"*

```java
LongTaskTimer refresh = LongTaskTimer.builder("catalogue.refresh")
    .description("Nightly catalogue rebuild, in progress")
    .register(registry);

refresh.record(() -> rebuildCatalogue());
```

That asymmetry — a plain timer is blind to anything still running — is why a hung request is
invisible in `http.server.requests` until it finishes or times out. It is the metrics-side
counterpart of the thread-dump argument in
[05 · Thread dumps](../05-thread-dumps/README.md): the request that matters is the one that has
not returned.

## `FunctionCounter` and `FunctionTimer`

For wrapping a value that some other object already maintains monotonically:

```java
FunctionCounter.builder("cache.evictions", cache, c -> c.stats().evictionCount())
    .register(registry);
```

> *"Micrometer cannot guarantee the monotonicity of the count and total time functions for you. By
> using this signature, you are asserting their monotonicity based on what you know about their
> definitions."*

The same weak-reference and immutable-`Number` traps apply as for gauges:

> *"Attempting to construct a function-tracking timer with a primitive number or one of its
> `java.lang` object forms is always incorrect. These numbers are immutable."*

## `TimeGauge` and `MultiGauge`

Two further types exist and are worth knowing because they solve problems people otherwise solve
badly.

**`TimeGauge`** is a `Gauge` that knows its value is a duration. Its builder takes the unit the
source function reports in:

```java
static <T> Builder<T> builder(String name, @Nullable T obj, TimeUnit fUnits, ToDoubleFunction<T> f)
```

and the interface declares `TimeUnit baseTimeUnit()`. That is the whole point: the registry can
convert into whatever base unit the monitoring system expects, so a value your code holds in
milliseconds is exported correctly to a backend whose convention is seconds. A plain `Gauge` over
the same field exports a bare number whose unit lives only in the metric's name, which is the
[unit-in-the-name problem](03-the-meter-types.md) again.

**`MultiGauge`** registers a *set* of gauges sharing a name and differing by tags, and re-registers
them as the set changes — a gauge per queue, per partition, per tenant. Its `register` method takes
an explicit flag:

```java
public void register(Iterable<? extends Row<?>> rows, boolean overwrite)
```

and the source documents the distinction: with `overwrite` true, rows already registered are
replaced with the new values; with it false, *"previously registered rows"* are left as they are.
🔴 **The default is not to overwrite**, which is the behaviour that surprises people — re-registering
a row whose value changed does nothing unless you ask for the replacement. The other half of the
trap is that this is a dynamic set, so it is a cardinality decision on every refresh:
[04b · Cardinality](04b-cardinality.md).

## Gotchas

**★ `LongTaskTimer` values return to zero when nothing is running, and that is correct.**
The Prometheus implementation page: *"A `LongTaskTimer` only samples tasks that are running at
scrape time, so its values return to zero when no tasks are in progress."* Alerting on the
absolute duration of in-progress tasks therefore needs `for:` durations that tolerate the gaps.

**★ Using a `DistributionSummary` for a duration costs you unit scaling and portability.**
The reference is direct: in every case where you want to measure time, use a `Timer`. A summary
records raw doubles with no notion of a base time unit, so the number that reaches Prometheus is
whatever unit you happened to record in, and nothing renames it.

**★ An unclamped `DistributionSummary` with `publishPercentileHistogram` ships 276 buckets per
tag combination.** Timers are clamped by default (1 ms to 30 s); summaries are not. This is the
easiest way in the whole library to multiply your series count by a few hundred with one method
call.

**★ `FunctionCounter` over a non-monotonic function produces nonsense rather than an error.**
You asserted monotonicity by choosing the type. A function that can decrease (a cache size, say)
will make `rate()` produce spikes or drop to zero as the backend interprets the decrease as a
counter reset.

**★ Re-registering a function timer or gauge under an existing identity is ignored, with a
warning.** The documented message is *"This Gauge has been already registered … the registration
will be ignored. Note that subsequent logs will be logged at debug level."* Crucially, the docs
note this can be caused **indirectly** by a `MeterFilter` that renames or drops tags so that two
previously-distinct meters collide — so the filter you added for cardinality can silently
un-register a gauge.

**★ `TimeGauge` exists so a duration gauge carries its unit; a plain `Gauge` does not.**
The builder takes the source's `TimeUnit` and the interface exposes `baseTimeUnit()`, so the
registry converts to whatever the backend expects. A plain gauge over a millisecond field exports
a number whose unit survives only in the metric name.

**★ `MultiGauge.register` does not overwrite by default.**
The source documents both behaviours on the `overwrite` flag: false leaves previously registered
rows alone. Re-registering a changed set without passing `true` silently keeps the old values,
which reads as a stale-metrics bug somewhere else entirely.

**★ A `MultiGauge` is a cardinality decision taken repeatedly.**
Its whole purpose is a dynamic set of tag combinations. Every refresh can add series, so the
bound has to come from the data — a gauge per tenant grows with your customer list.

**★ `LongTaskTimer` and `Timer` measure the same operation and answer different questions.**
One tells you about tasks that have finished, the other about tasks that have not. Instrumenting a
long operation with both is normal and is not duplication.

**★ A distribution summary's histogram buckets are published per tag combination.**
The bucket count multiplies by cardinality, so an unclamped histogram on a meter with a dozen tag
values is the same mistake as a high-cardinality tag, arriving through a different door.

## Interview questions

**★ What is a `LongTaskTimer` and why is a plain timer not enough?**
A plain timer only records when the operation finishes, so an operation that is stuck contributes
nothing at all — the metric for a job that has been hanging for two hours is identical to the
metric for a job that never started. A `LongTaskTimer` publishes the count, total duration and
maximum duration of tasks that are *currently running*, so a threshold breach is visible at the
next reporting interval rather than after completion. Use it for scheduled jobs, migrations,
long-running imports, and anything whose duration can exceed your scrape interval.

**★ You want to record HTTP response payload sizes. Which meter, and what must you configure?**
A `DistributionSummary` with `baseUnit("bytes")`, and you must set `minimumExpectedValue` and
`maximumExpectedValue` before enabling percentile histograms. Timers are clamped by default to
1 ms–30 s; summaries have no default clamp, and the documentation warns that an unclamped summary
ships all 276 predetermined buckets — per tag combination.

**★ What is the difference between `Counter` and `FunctionCounter`, and when does the difference
matter?** A `Counter` owns its value and you increment it. A `FunctionCounter` owns nothing and
reads a monotonic value out of an object you supply, which is how you expose counters that a
third-party library already maintains (a cache's eviction count, a client's request total)
without double-counting them. The difference matters because `FunctionCounter` holds its target
weakly and trusts your monotonicity assertion — if the function can go down, the backend sees a
counter reset and the rate graph lies.

**★ When would you reach for `MultiGauge` rather than registering gauges yourself?**
When the set of things being measured is dynamic and identified by tags — a depth gauge per queue,
a lag gauge per Kafka partition, a quota gauge per tenant. Registering those by hand means keeping
your own map of name-plus-tags to gauge, handling the case where a queue disappears, and
remembering that a gauge holds a weak reference to its target so a removed entry may start
reporting `NaN`. `MultiGauge` does that bookkeeping: you hand it a set of rows, each a tag set plus
a value, and it reconciles. The detail that catches people is the `overwrite` flag on `register` —
the source documents that when it is false, previously registered rows are left as they were, so
re-registering a refreshed set without passing `true` silently keeps the old numbers and the
metrics look stale for no visible reason. The other thing to hold onto is that this is a
cardinality decision repeated on every refresh, so the set needs a bound that comes from the
domain rather than from hope.

**★ Why does `TimeGauge` exist when `Gauge` can already report a number?**
Because a duration has a unit and a bare number does not. `TimeGauge`'s builder takes the
`TimeUnit` that the source function reports in, and the interface exposes `baseTimeUnit()`, so the
registry knows how to convert the value into whatever base unit the monitoring backend expects —
Prometheus conventionally wants seconds, and a field your code holds in milliseconds would
otherwise be exported as a raw number that is wrong by a factor of a thousand to anyone reading
it. With a plain `Gauge` the only place the unit exists is the metric's name, which means it is
carried by convention and lost the moment someone renames the metric or graphs it alongside
another one. It is a small type that exists purely to stop a unit from being tribal knowledge,
which is the same reason `Timer` refuses to let you record a duration as a plain number.

{/* FOOTER */}
