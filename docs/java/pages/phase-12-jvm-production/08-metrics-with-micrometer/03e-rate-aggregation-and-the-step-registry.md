---
title: "Micrometer publishes the same counter as a cumulative total to Prometheus and as a per-interval rate to Datadog, and knowing which one you are looking at is the difference between reading your dashboard and guessing at it"
sidebar_label: "03e · Rate aggregation"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **Micrometer 1.17 reference** — *Concepts · Rate Aggregation*
> and *Concepts · Counters · Function-tracking Counters*
> ([docs.micrometer.io](https://docs.micrometer.io/micrometer/reference/concepts/rate-aggregation.html)),
> and the **Prometheus documentation** — *Querying · Functions* (`rate`, `irate`, `increase`) and
> *Concepts · Metric types*
> ([prometheus.io](https://prometheus.io/docs/prometheus/latest/querying/functions/)).
> No JVM was run for this page. The worked arithmetic below is quoted from the Micrometer *Rate
> Aggregation* page, not measured. JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9 ·
> Micrometer 1.17.0 · Prometheus Java client 1.5.1.

**[03c](03c-counter-versus-gauge.md) argued that a counter is a promise. This page is what the
promise buys, who spends it, and where. The same `counter.increment()` produces a
monotonically-rising total on a Prometheus scrape and a per-interval value on a Datadog push,
because Micrometer knows which style the backend wants and switches. Almost every "why does this
counter keep resetting" question, and every "why is my rate too high", is answered by one of the
two paragraphs below.**

## Server-side: the backend does the differentiation

> *"Monitoring systems that perform server-side rate math expect absolute values to be reported at
> each publishing interval. For example, the absolute count of all increments to a counter since
> the beginning of the application is sent on each publishing interval."*

Prometheus is the canonical example. Your process holds one ever-increasing number per meter;
every scrape takes a snapshot of it; the *server* differentiates. The instrumentation is
stateless with respect to time, which is why a scrape that is missed costs you nothing — the next
scrape still carries the full total.

This is the source of the three guarantees `rate()` provides, and it is worth reading the
function definition rather than a summary of it:

> *"`rate(v range-vector)` calculates the per-second average rate of increase of the time series
> in the range vector. **Breaks in monotonicity (such as counter resets due to target restarts)
> are automatically adjusted for.** Also, the calculation extrapolates to the ends of the time
> range, allowing for missed scrapes or imperfect alignment of scrape cycles with the range's
> time period."*

> *"`rate` should only be used with counters (for both floats and histograms). It is best suited
> for alerting, and for graphing of slow-moving counters."*

`increase()` carries the identical reset clause and adds one warning of its own:

> *"`increase(v range-vector)` calculates the increase in the time series in the range vector.
> Breaks in monotonicity (such as counter resets due to target restarts) are automatically
> adjusted for. The increase is extrapolated to cover the full time range as specified in the
> range vector selector, **so that it is possible to get a non-integer result even if a counter
> increases only by integer increments.**"*

🔴 That last clause surprises people every time. `increase(orders_placed_total[5m])` legitimately
returns `247.3`. It is not a bug and it is not rounding error; it is extrapolation to the window
edges. Anyone who reports "our order count is fractional" has found this, not a defect.

## Client-side: the step value, and the reset that is not a reset

The other family of backends wants rates already computed, either because they prefer them or
because their query language cannot do the arithmetic:

> *"Micrometer efficiently maintains rate data by means of a step value that accumulates data for
> the current publishing interval. When the step value is polled (when publishing, for example),
> if the step value detects that the current interval has elapsed, it moves current data to
> 'previous' state. This previous state is what is reported until the next time current data
> overwrites it."*

> *"The value returned by the poll function is always rate per second \* interval."*

So on a **step registry** — Datadog, StatsD, Influx, New Relic, the OTLP registry in delta mode —
`counter.count()` is the count *for a window*, not since start, and it goes back to zero every
interval by design. This is the single most common false alarm in Micrometer's issue tracker,
and the answer is always the same paragraph.

It also explains a test failure that looks like a Micrometer bug. Asserting on
`registry.get("x").counter().count()` against a `SimpleMeterRegistry` configured with step-mode
counting will give you the current step's value, not the lifetime total. `SimpleMeterRegistry`'s
default is cumulative, which is why the same assertion passes locally and fails against a
step-configured registry.

## The worked arithmetic, quoted

The documentation does the algebra for a timer, and it is worth copying because it explains why
`count` and `totalTime` are shipped as *separate* statistics rather than as an average:

> *"Suppose we configure publishing at 10-second intervals and we saw 20 requests that each took
> 100ms. Then, for the first interval:*
> *count = 10 seconds \* (20 requests / 10 seconds) = 20 requests*
> *totalTime = 10 seconds \* (20 \* 100 ms / 10 seconds) = 2 seconds"*

> *"The `count` statistic is meaningful by itself: It is a measure of throughput. `totalTime`
> represents the total latency of all requests in the interval. Additionally, consider:
> totalTime / count = 2 seconds / 20 requests = 0.1 seconds / request = 100 ms / request"*

*(Those figures are Micrometer's worked example, reproduced verbatim — not a measurement of any
system.)*

The point the page then makes is the one that matters for aggregation:

> *"Micrometer reported '20 requests' for count on every 10-second interval. The monitoring system
> sums these six 10-second intervals and arrives at the conclusion that there are 120 requests /
> minute. **Note that it is the monitoring system doing this summation, not Micrometer.**"*

Two separate statistics that both sum cleanly is what makes the average latency *recomputable at
any window*. Ship a pre-computed average instead and you can never widen the window, because the
mean of a set of means is not the mean. That is the same argument [08 ·
Percentiles](08-percentiles.md) makes about client-side percentiles, one step earlier in the
pipeline.

## Order of operations: rate first, then sum

Prometheus states the rule for `irate` and the reason applies to `rate` equally:

> *"Note that when combining `irate()` with an aggregation operator (e.g. `sum()`) or a function
> aggregating over time (any function ending in `_over_time`), always take an `irate()` first,
> then aggregate. Otherwise `irate()` cannot detect counter resets when your target restarts."*

```promql
# right — each series is reset-corrected before the fleet is summed
sum(rate(orders_placed_total[5m]))

# wrong — the sum across pods is not monotonic, because a pod restarting
# makes the sum drop, and there is no per-series reset left to detect
rate(sum(orders_placed_total)[5m:])
```

The wrong form is not a syntax error and it does not always look wrong. It looks wrong for
exactly as long as your rolling deploy takes, which is when you are most likely to be staring at
the graph.

## Two shapes that are neither counter nor gauge

**A number somebody else already counts.** A cache, a driver or a pool exposes a monotonic
accessor and you do not own the increment site. Polling it on a schedule and incrementing a
`Counter` by the delta is re-implementing the registry badly: you would have to hold the previous
value, handle the source resetting, and pick a poll interval that does not beat against the
publish interval — and you would have to get it right on both cumulative and step registries.
Micrometer's answer:

> *"Micrometer also provides a more infrequently used counter pattern that tracks a monotonically
> increasing function (a function that stays the same or increases over time but never decreases).
> Some monitoring systems, such as Prometheus, push cumulative values for counters to the backend,
> but others publish the rate at which a counter is incrementing over the push interval. **By
> employing this pattern, you let the Micrometer implementation for your monitoring system choose
> whether to rate-normalize the counter, and your counter remains portable across different types
> of monitoring systems.**"*

```java
FunctionCounter.builder("cache.evictions", cache, c -> c.stats().evictionCount())
    .description("Entries evicted since this instance started")
    .baseUnit("entries")
    .register(registry);
```

🔴 The monotonicity contract moves to you, and nothing checks it:

> *"Micrometer cannot guarantee the monotonicity of the function for you. By using this signature,
> you assert its monotonicity based on what you know about its definition."*

Point a `FunctionCounter` at something that can decrease — `queue.size()`, `pool.getActive()`,
`map.size()` — and you have published a series *typed* as a counter that breaks the counter
contract. `rate()` will read every decrease as a restart and add the whole new value back in. The
result is not noisy: it is confidently, silently biased upward, forever. The only defence is
reading the javadoc of the method you are wrapping and looking for the word *"since"*.

**A duration you read rather than accumulate** — time since the last successful sync, seconds
until a certificate expires. `TimeGauge`, because the base unit has to travel with the value.
Spring Boot ships one: *"The metric `ssl.chain.expiry` gauges the expiry date of each certificate
chain in key stores and trust stores in seconds. This number will be negative if the chain has
already expired."* Mechanics in [03d](03d-the-specialised-meters.md).

## What is explicitly not a rate

Micrometer names the exceptions, and they are the ones people try to rate anyway:

> *"Not all measurements are reported or best viewed as a rate. For example, gauge values and the
> active task count long task timers are not rates."*

A `LongTaskTimer`'s active-task count is a population, not an accumulation. `rate()` on it is
category error, and it is a tempting one because the meter's name contains "timer".

## Gotchas

**★ `increase()` returning a non-integer is documented behaviour, not a bug.** Verbatim: *"so that
it is possible to get a non-integer result even if a counter increases only by integer
increments."* Do not "fix" it with `round()` in an alert expression — you will make the alert less
accurate at exactly the boundary where extrapolation is doing useful work.

**★ On a step registry, `counter.count()` is the previous interval, not the lifetime total.** The
step value moves current to previous when the interval elapses and reports previous *"until the
next time current data overwrites it"*. Code that reads `count()` to make a business decision is
reading a monitoring artefact.

**★ `sum()` then `rate()` loses reset detection.** The aggregate of several series is not
monotonic when one of the underlying targets restarts, and there is no per-series break left for
the function to correct. Always `rate()` innermost. Prometheus states this for `irate()` and the
mechanism is identical for `rate()`.

**★ `irate()` and `rate()` are not interchangeable.** *"`irate` should only be used when graphing
volatile, fast-moving counters. Use `rate` for alerts and slow-moving counters, as brief changes
in the rate can reset the FOR clause and graphs consisting entirely of rare spikes are hard to
read."* An alert built on `irate` will flap.

**★ A `FunctionCounter` over a non-monotonic function fails upward and never errors.** Registration
succeeds, the scrape succeeds, the graph is wrong high. Nothing in Micrometer, Prometheus or your
dashboard will ever tell you. The check is a code review of the wrapped accessor, not a runtime
one.

**★ Re-registering a `FunctionCounter` is ignored with the same one-shot warning as a gauge.**
*"WARNING: This FunctionCounter has been already registered … the registration will be ignored.
Note that subsequent logs will be logged at debug level."* And, as with gauges, a `MeterFilter`
that renames or drops a tag can collapse two distinct function counters into one identity.

**★ A `FunctionCounter` over a boxed number can never change.** *"Attempting to construct a
function-tracking counter with a primitive number or one of its `java.lang` object forms is always
incorrect. These numbers are immutable."* You get a flat line, not an error.

**★ The rate window and the scrape interval interact.** `rate(x[1m])` with a 60-second scrape has
roughly two points to work with and will be jumpy and occasionally empty; the usual guidance is a
range at least four times the scrape interval. This is a query-side decision that no amount of
instrumentation quality can compensate for.

**★ Averaging `totalTime/count` across instances is fine; averaging per-instance averages is
not.** Because both statistics are shipped separately and both sum, `sum(rate(t_sum)) /
sum(rate(t_count))` is the true fleet mean. `avg(t_sum / t_count)` weights a pod serving three
requests the same as one serving thirty thousand.

**★ Restart cliffs still appear on the raw series, and dashboards often show the raw series.**
`rate()` repairs the *derived* value; the panel showing `orders_placed_total` itself will still
show a sawtooth on every deploy. That panel should almost never exist —
*"Representing a counter without rate aggregation over some time window is rarely useful."*

## Interview questions

**★ Why does Micrometer ship `count` and `totalTime` separately instead of shipping the average?**
Because separate sums are recomputable at any window and an average is not. The monitoring system
can sum six ten-second `count` values to get a per-minute throughput and six `totalTime` values to
get per-minute total latency, then divide — and the answer is exact. If Micrometer shipped a
per-interval mean, widening the window would require averaging the means, which is only correct
when every interval had identical traffic. It is the same reason percentiles must be shipped as
histograms rather than as numbers.

**★ What exactly does `rate()` do that you would have to do yourself?**
Three things, all documented. It differentiates — you asked for per-second and the series is
cumulative. It repairs breaks in monotonicity, so a pod restart does not produce a large negative
value. And it extrapolates to the edges of the range, so a missed or misaligned scrape does not
punch a hole in the result. Re-implementing those in application code is exactly the work
`FunctionCounter` exists to save you, and it is why the meter type is a contract rather than a
label.

**★ Your counter "resets to zero" every minute on Datadog but not on Prometheus. What is
happening?**
Nothing is wrong. Datadog's registry is a step registry: Micrometer accumulates into a step value
for the publishing interval, moves it to "previous" when the interval elapses, and reports that.
The value is per-interval by design, and the documented poll semantics are "rate per second times
interval". Prometheus is a server-side-rate system, so the same meter is exported as a cumulative
total and Prometheus does the differentiation. The instrumentation code is identical; the export
style is the registry's decision.

**★ Someone writes `rate(sum(orders_placed_total)[5m:])`. What breaks and when?**
Reset detection. Summing across pods first produces a series that is not monotonic — when one pod
restarts, the fleet sum drops by that pod's accumulated total — and by the time `rate()` sees the
data there is no per-target break left to correct. The result is a rate that dips or goes negative
during every rolling deploy. Prometheus documents the rule for `irate()` and the mechanism is the
same: aggregate the rates, never rate the aggregate.

**★ When would you use `FunctionCounter` rather than `Counter`, and what have you taken
responsibility for?**
When the count already exists on an object you do not control — a cache's `evictionCount()`, a
driver's request total. You take responsibility for monotonicity: Micrometer states that it
cannot guarantee it and that using the signature is an assertion. If the function can decrease,
the series is typed as a counter but violates the contract, and every decrease is silently read as
a restart and added back. The failure is invisible and biased upward, which is why the check has
to happen at code-review time.

**★ Why is `increase()` allowed to return `247.3` requests?**
Because it extrapolates to the boundaries of the range vector rather than reporting only the
samples that happen to fall inside it. The documentation says so explicitly. Samples land at
scrape times that do not align with your query window, so the honest answer to "how many in the
last five minutes" involves interpolating at both ends. Rounding it in an alert makes the alert
less accurate near the threshold, which is the only place it matters.

**★ What measurements are explicitly not rates?**
Gauge values and the active-task count of a `LongTaskTimer`, per Micrometer's own list. Both are
populations observed at an instant rather than accumulations over an interval, so
differentiating them is a category error. The `LongTaskTimer` case is the trap, because the meter
is called a timer and its duration statistics *do* behave like accumulations while its active
count does not.

{/* FOOTER */}
