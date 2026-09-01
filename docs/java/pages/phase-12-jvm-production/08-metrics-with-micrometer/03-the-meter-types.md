---
title: "There are five meter types you will actually use and the documentation tells you which ones not to use in two imperative sentences — never count what you can time, and never gauge what you can count"
sidebar_label: "03 · The meter types"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **Micrometer 1.17 reference** — *Concepts · Meters*,
> *Counters*, *Gauges*, *Timers*, *Distribution summaries*, *Long task timers*
> ([docs.micrometer.io](https://docs.micrometer.io/micrometer/reference/concepts/meters.html)),
> and the **Micrometer 1.17.0 sources** at tag `v1.17.0` —
> [`AbstractTimerBuilder`](https://github.com/micrometer-metrics/micrometer/blob/v1.17.0/micrometer-core/src/main/java/io/micrometer/core/instrument/AbstractTimerBuilder.java).
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8 · Micrometer 1.17.0.

**A meter type is a claim about how the number composes over time and across instances, and
choosing the wrong one produces a series that looks fine and cannot be queried usefully. The
documentation is unusually prescriptive here, and the two rules it states in bold are the whole
decision procedure for four of the five types.**

## The catalogue

> *"Micrometer supports a set of `Meter` primitives, including `Timer`, `Counter`, `Gauge`,
> `DistributionSummary`, `LongTaskTimer`, `FunctionCounter`, `FunctionTimer`, and `TimeGauge`.
> Different meter types result in a different number of time series metrics. For example, while
> there is a single metric that represents a `Gauge`, a `Timer` measures both the count of timed
> events and the total time of all timed events."*

| Meter | Records | Series it produces | Use when |
|---|---|---|---|
| `Counter` | monotonic increments, **positive only** | 1 | something happened, and you want the rate |
| `Gauge` | a sampled current value | 1 | a level with a natural bound: queue depth, pool size |
| `Timer` | short durations, **non-negative** | ≥ 3 (`count`, `sum`, `max`) | anything measured in time |
| `DistributionSummary` | a distribution of non-time values | ≥ 3 | payload sizes, batch sizes, ratios |
| `LongTaskTimer` | duration of tasks **still running** | ≥ 3 | anything long enough to outlive a scrape |
| `FunctionCounter` / `FunctionTimer` | monotonic values read from an external object | 1 / 2 | wrapping a third-party library's own counters |
| `TimeGauge` | a gauge whose value is a duration | 1 | a lag or age you can read, not accumulate |

## The two rules, verbatim

From the counters page:

> *"Never count something you can time with a `Timer` or summarize with a `DistributionSummary`!
> Both `Timer` and `DistributionSummary` always publish a count of events in addition to other
> measurements."*

From the gauges page:

> *"Never gauge something you can count with a `Counter`!"*

and

> *"Gauges are useful for monitoring things with natural upper bounds. We do not recommend using a
> gauge to monitor things like request count, as they can grow without bound for the duration of
> an application instance's life."*

Those two sentences eliminate most wrong answers. A separate `orders.count` counter beside an
`orders.duration` timer is redundant — the timer already has a count, and now you have two series
that can disagree when one increment path is missed. An `AtomicLong` gauge counting requests is
worse: a gauge is only *sampled*, so every increment between two scrapes is invisible, and the
value is a running total that resets on restart with no rate semantics.

## `Counter`

```java
Counter retries = Counter.builder("http.client.retries")
    .description("Outbound calls retried after a failure")
    .baseUnit("calls")          // optional; part of the naming convention on some backends
    .tags("target", "payments") // low cardinality only
    .register(registry);

retries.increment();      // by 1
retries.increment(3.0);   // by n; must be positive
```

The counter's value is meaningless on its own and useful as a derivative. Micrometer says so:

> *"When building graphs and alerts off of counters, you should generally be most interested in
> measuring the rate at which some event occurs over a given time interval. … Building dashboards
> and alerts of the rate of a counter per some interval of time disregards the longevity of the
> app, letting you see aberrant behavior long after the application has started."*

[03c · Counter versus gauge, and what `rate()` needs](03c-counter-versus-gauge.md) has the
mechanics of why that works and what a step registry does differently.

## `Gauge`

A gauge does not store a value; it stores a **reference and a function**, and calls the function
when the registry samples it.

```java
Gauge.builder("queue.depth", workQueue, Queue::size)
    .description("Items awaiting processing")
    .register(registry);
```

> *"Micrometer takes the stance that gauges should be sampled and not be set, so there is no
> information about what might have occurred between samples. Any intermediate values set on a
> gauge are lost by the time the gauge value is reported to a metrics backend, so there is little
> value in setting those intermediate values in the first place."*

> *"Think of a `Gauge` as a 'heisen-gauge': a meter that changes only when it is observed."*

The reference is held **weakly**, which is a design decision with a failure mode severe enough to
get its own page — [03b · The gauge that was garbage collected](03b-the-gauge-that-was-garbage-collected.md).

There is also a `MultiGauge` for a bounded-but-changing set of rows (one gauge per status value
from a `GROUP BY`, for example), and a `TimeGauge` for values that are durations, which the
registry scales to the backend's base time unit.

## `Timer`

```java
Timer checkout = Timer.builder("checkout.duration")
    .description("End-to-end checkout")
    .tags("channel", "web")
    .register(registry);

checkout.record(Duration.ofMillis(elapsed));
checkout.record(() -> doWork());              // Runnable
String s = checkout.recordCallable(() -> compute());   // Callable, may throw
```

Three facts from the reference that shape how you use it:

> *"All implementations of `Timer` report at least the total time and the count of events as
> separate time series but other time series can also be reported depending on what is supported
> by the backend (max, percentiles, histograms). While you can use timers for other use cases,
> note that **negative values are not supported**, and recording many longer durations could
> cause overflow of the total time at `Long.MAX_VALUE` nanoseconds (292.3 years)."*

> *"A `Timer` is really a specialized distribution summary that is aware of how to scale durations
> to the base unit of time of each monitoring system and has an automatically determined base
> unit. In every case where you want to measure time, you should use a `Timer` rather than a
> `DistributionSummary`."*

And the one that surprises people reading a dashboard:

> *"The maximum statistical value for basic `Timer` implementations, such as `CumulativeTimer` and
> `StepTimer`, is a time window maximum (`TimeWindowMax`). It means that its value is the maximum
> value during a time window. If no new values are recorded for the time window length, the max is
> reset to 0 as a new time window starts. The time window size until values are fully expired is
> the expiry multiplied by the `bufferLength` in `DistributionStatisticConfig`. `expiry` defaults
> to the step size of the meter registry unless it's explicitly set to a different value, and
> `bufferLength` defaults to 3."*

So `_max` is a *decaying* maximum, not an all-time one. It goes down. That is deliberate — the
reference explains it is *"used to capture maximum latency in a subsequent interval after heavy
resource pressure triggers the latency and prevents metrics from being published"* — but a
falling max on a graph is not evidence that anything improved.

The timer's default bucket clamp is in the source, not the prose. From `AbstractTimerBuilder` at
`v1.17.0`:

```java
private static final Duration DEFAULT_MINIMUM_EXPECTED_DURATION = Duration.ofMillis(1);

private static final Duration DEFAULT_MAXIMUM_EXPECTED_DURATION = Duration.ofSeconds(30);
```

[08c · SLOs and the bucket budget](08c-slos-and-the-bucket-budget.md) is where that becomes a
number of time series.

## Gotchas

**★ A `Timer` already gives you a counter, so adding one is a bug waiting to diverge.**
`${name}_seconds_count` *is* the throughput series. A separate hand-maintained counter will
eventually be incremented on one code path and not another — typically the exception path — and
then two graphs disagree and nobody knows which is right.

**★ `Counter.increment(n)` requires `n` positive; there is no decrement.** If you find yourself
wanting to decrement, you wanted a gauge (a level) or two counters (ins and outs, so the backend
can subtract the rates and you keep both signals).

**★ `_max` on a timer falls back to zero when traffic stops.** It is a time-window maximum with a
default `bufferLength` of 3 and an `expiry` that defaults to the registry's step. A quiet
endpoint's max decays to zero, which reads as "latency improved" and means "no requests".

**★ Recording a negative duration into a `Timer` is unsupported.** It happens more often than it
should, from subtracting timestamps taken from two different clocks, or from
`System.currentTimeMillis()` across an NTP step. Use `Timer.Sample` / `Timer.start(registry)`,
which uses the registry's clock — [07 · Timing your own code](07-timing-your-own-code.md).

**★ Total time on a `Timer` overflows at `Long.MAX_VALUE` nanoseconds — 292.3 years.**
Not a concern for request latency. It is a concern if someone uses a `Timer` to accumulate
uptime, session lifetimes, or anything measured in days on a long-lived instance.

**★ A gauge with no strong reference to its target reports `NaN` or vanishes.**
The failure is silent and delayed, which is why it gets its own page —
[03b](03b-the-gauge-that-was-garbage-collected.md).

## Interview questions

**★ You need to know how many orders were placed and how long placing one takes. How many meters?**
One — a `Timer`. It publishes count and total time as separate series, so throughput and latency
both come out of the same instrumentation. Micrometer states the rule as "never count something
you can time". Adding a separate counter creates a second thing to maintain that can disagree with
the first, and gains nothing.

**★ When is a gauge the right answer, and when is it a trap?**
Right when the quantity is a *level* with a natural bound that you can read on demand: queue
depth, pool size, connections in use, cache entries. A trap when the quantity is an *event count*,
because a gauge is only sampled — everything between two scrapes is lost — and because a running
total has no rate semantics and resets on restart. The documentation's own phrasing, "never gauge
something you can count", is the test.

**★ Why does `_max` on a Micrometer timer go down?**
Because it is a `TimeWindowMax`: a decaying maximum over a ring buffer whose length defaults to 3
and whose expiry defaults to the registry's step size. When no new values are recorded for the
window, it resets. The design intent is to surface a latency spike in the interval *after* the
pressure that caused it, when publishing may have been disrupted — but the consequence for a
reader is that a falling max means "recently quiet", not "recently faster".

{/* FOOTER */}
