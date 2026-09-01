---
title: "Every way of timing a block of code in Micrometer exists to solve a different problem, and the one that solves the problem you actually have — deciding the tags after you know how the operation ended — is the one nobody reaches for first"
sidebar_label: "07 · Timing your own code"
sidebar_position: 18
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **Micrometer 1.17 reference** — *Concepts · Timers* (recording
> blocks of code, `Timer.Sample`, the `@Timed` annotation, `@MeterTag` on method parameters) and
> *Concepts · Counters · The `@Counted` Annotation*
> ([docs.micrometer.io](https://docs.micrometer.io/micrometer/reference/concepts/timers.html)), and
> the **Spring Boot 4.1 production-ready reference · Observability — Micrometer Observation
> Annotations support**
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/actuator/observability.html)).
> No JVM was run for this page and no timings appear below. JDK 25 · Spring Boot 4.1.0 ·
> Micrometer 1.17.0.

**There are four ways to time a block of code and they are not interchangeable. Two of them force
you to fix the meter's tags before the operation runs, which is exactly backwards for the tag you
most want — the outcome. This page is about picking the right one, and about the reason
`try`/`finally` around `System.nanoTime()` is not one of the four.**

## Why not `System.nanoTime()`

```java
// Don't.
long start = System.nanoTime();
try {
    doWork();
} finally {
    timer.record(System.nanoTime() - start, TimeUnit.NANOSECONDS);
}
```

Three problems, in increasing order of how long they take to find. It is four lines where one will
do. It uses a clock that is not the registry's clock, which makes the meter untestable — Micrometer
ships a `MockClock` precisely so that step and time-window behaviour can be driven deterministically
in tests, and this code ignores it. And when someone eventually refactors, the `finally` gets
detached from the `try` and you record nothing on the exception path, which is the path you cared
about.

Micrometer's own note is the substitution: *"The sample records a start time based on the
registry's clock."*

## Form 1 · `record` around a block

```java
timer.record(() -> dontCareAboutReturnValue());
Response r = timer.recordCallable(() -> returnValue());

Runnable wrapped = timer.wrap(() -> dontCareAboutReturnValue());
Callable<Response> c  = timer.wrap(() -> returnValue());
```

> *"Wrap `Runnable` or `Callable` and return the instrumented version of it for use later."*

This is the right default. It cannot be detached from the block it measures and it records on the
exceptional path. The `wrap` variants defer execution rather than performing it, which changes what
is measured — Form 3 below.

The limitation is in the first token: `timer` already exists, so **its tags are already fixed**.

## Form 2 · `Timer.Sample`, and why it is the interesting one

```java
Timer.Sample sample = Timer.start(registry);

// do stuff
Response response = ...

sample.stop(registry.timer("my.timer", "response", response.status()));
```

> *"Note how we do not decide the timer to which to accumulate the sample until it is time to stop
> the sample. **This lets us dynamically determine certain tags from the end state of the operation
> we are timing.**"*

🔴 That is the whole reason `Timer.Sample` exists, and it is the form that answers the question
[05 · RED and USE](05-red-and-use.md) says you must be able to answer: *what is the latency of
failed requests, separately from successful ones?* You cannot answer it with form 1, because you
would have to know the outcome before starting.

The complete pattern, with the exception path handled:

```java
Timer.Sample sample = Timer.start(registry);
String outcome = "success";
try {
    return processor.process(order);
} catch (PaymentDeclinedException e) {
    outcome = "declined";
    throw e;
} catch (RuntimeException e) {
    outcome = "error";
    throw e;
} finally {
    sample.stop(Timer.builder("orders.process")
        .description("Time to process one order, end to end")
        .tag("outcome", outcome)                       // bounded: 3 values
        .tag("order.type", order.type().name())        // bounded: an enum
        .register(registry));
}
```

Two details are load-bearing. `outcome` is a small fixed set, not `e.getClass().getName()` —
[04b](04b-cardinality.md). And the `finally` is doing something a `finally` is actually good at:
it holds one statement whose correctness does not depend on the block above it.

⚠️ `sample.stop(...)` calls `register(registry)` on every invocation. That is a lookup in a
concurrent map keyed by name and tags, not a fresh meter each time — the registry keeps *"only one
meter for each unique combination of name and tags"* — so it is cheap. It is not free, though, and
it is a very good reason not to put this pattern inside a tight loop.

## Form 3 · `wrap`, and the queue-time question

```java
executor.submit(timer.wrap(() -> reindex(document)));
```

`wrap` returns an instrumented `Runnable` or `Callable`, so the clock starts when the task *begins
executing* on a pool thread. That excludes the time the task spent queued.

Whether that is what you want depends on the question:

| Question | Measure |
|---|---|
| "How long does this work take?" — service time | `timer.wrap(task)`, submitted to the executor |
| "How long does a caller wait?" — end-to-end latency | `Timer.start(registry)` before submission, `sample.stop(...)` inside the task |

Both are legitimate and they diverge precisely when the pool is saturated, which is when you are
looking. The difference between the two is queue time, which you can also read directly from
`executor.queued` ([05b · USE for a JVM service](05b-use-for-a-jvm-service.md)) — and if you have
that meter, the service-time version is usually the more informative one, because it is not
contaminated by a signal you already have.

⚠️ `wrap` measures the wrapped task, not the submission. If the executor rejects the task, nothing
is recorded at all — no sample, no error. A rejection needs its own counter.

## When the operation outlives a scrape

A `Timer` records nothing until the operation finishes, so an operation that runs for ten minutes
is invisible for ten minutes and then appears as a single large sample. For anything that can
outlive your scrape interval, you want a `LongTaskTimer` alongside — it reports the count and
duration of tasks *currently running*:

```java
LongTaskTimer reindex = LongTaskTimer.builder("catalog.reindex")
    .description("Full catalogue reindex, in progress")
    .register(registry);

reindex.record(() -> reindexEverything());
```

The two are complementary and the documentation says to stack them: a short-task timer answers
"how long did it take", a long-task timer answers "is one running right now, and for how long".
Mechanics are in [03d · The specialised meters](03d-the-specialised-meters.md).

## The annotation family

`@Timed`, `@Counted` and `@MeterTag` do the same job declaratively, and they bring their own set of
conditions: an aspect that has to exist, a property that has to be set on Boot 4, a proxy that
self-invocation bypasses, and a parameter-to-tag mechanism that defaults to `toString()`. All of it
is [07a · The timing annotations](07a-the-timing-annotations.md).

## Choosing

| Situation | Form |
|---|---|
| A block whose tags you know up front | `timer.record(...)` / `recordCallable` |
| Tags depend on how it ended (outcome, status, declined reason) | `Timer.Sample` |
| Work handed to an executor, timed as it runs | `timer.wrap(...)` |
| Cross-cutting, uniform, no per-call tags | `@Timed` — [07a](07a-the-timing-annotations.md) |
| An operation that can outlive a scrape interval | `LongTaskTimer`, or `@Timed(longTask = true)` |
| You also want a span and log correlation from the same call site | `Observation` — [07b](07b-observation-api.md) |

## Gotchas

**★ `System.nanoTime()` is not the registry's clock, which makes the meter untestable.**
`Timer.Sample` *"records a start time based on the registry's clock"*, so a `MockClock` in a test
can drive it deterministically. Hand-rolled timing cannot be, and time-window behaviour — the
decaying max, step rotation — is precisely what you would want to test.

**★ Form 1 forces the tags to be decided before the operation runs.** Which means it cannot express
"latency of failed requests", the one distinction the SRE book explicitly asks for. Reach for
`Timer.Sample` the moment a tag depends on the outcome.

**★ Recording a duration measured with a wall-clock difference can produce a negative value.**
Subtracting `System.currentTimeMillis()` across an NTP step, or across two clocks, does it. Negative
durations are not supported by `Timer`. `Timer.Sample` avoids this by construction because it uses
a monotonic registry clock.

**★ `sample.stop(Timer.builder(...).register(registry))` does a registry lookup per call.** It is a
concurrent-map lookup, not a meter allocation, and it is fine per request. It is not fine per
iteration of a hot loop — hoist the timer if the tags are constant, and if they are not, ask whether
you should be timing at that granularity at all.

**★ Timing something that takes nanoseconds tells you about the timer, not the code.** A meter
records into shared state; at sufficiently fine granularity the measurement dominates the
measurement. Time operations that cross a boundary — I/O, a lock, a pool, a network hop — and use
a profiler for anything smaller ([06 · JFR and profiling](../06-jfr-and-profiling/README.md)).

**★ `timer.wrap` excludes queue time, which is sometimes the whole story.** A task that takes 40 ms
to run and waits 6 seconds in a saturated executor reports 40 ms. If your latency complaint is
about caller-observed time, start the sample before submission.

**★ A rejected task records nothing.** `wrap` instruments execution; a `RejectedExecutionException`
happens before execution. Pair any wrapped submission with a rejection counter, or you have a
failure mode with no signal at all.

**★ A `Timer` publishes only on completion, so a long operation looks like nothing then a spike.**
For anything that can outlive a scrape interval, add a `LongTaskTimer`. Otherwise a job that hangs
forever is indistinguishable from a job that was never started.

**★ Building the timer inside `sample.stop(...)` is a lookup, not an allocation — but a lookup on a
hot path is still a cost.** Hoist it when the tags are constant; when they are not, that is the
price of having the outcome tag and it is usually worth paying once per request.

**★ Two nested timers around the same work measure overlapping intervals, and the outer one is not
the sum of the inner ones.** That is what a trace is for. If you find yourself building a
timer hierarchy to explain where time went, you want spans
([09](../09-distributed-tracing/README.md)), not more meters.

## Interview questions

**★ Why does `Timer.Sample` exist when `timer.record(Runnable)` is shorter?**
Because `record` requires the `Timer` — and therefore its complete tag set — to exist before the
block runs, and the single most valuable tag on a latency metric is the outcome, which is not known
until afterwards. `Timer.Sample` separates starting the clock from choosing the meter, so you can
call `sample.stop(...)` against a timer tagged `outcome=success` or `outcome=declined` depending on
how the operation actually ended. Micrometer's documentation calls this out explicitly as the
reason for the API. Without it you cannot report the latency of failed requests separately, which
the four-golden-signals guidance treats as mandatory.

**★ What is wrong with `long start = System.nanoTime()` and a `finally` block?**
Functionally, less than people assume — it will produce roughly the right number. What is wrong is
that it uses a clock the registry does not know about, so the meter cannot be driven by a
`MockClock` in a test and its time-window behaviour is untestable; it is verbose enough that the
`finally` drifts away from the `try` under refactoring, at which point the exception path stops
being recorded; and it invites the variant that uses `currentTimeMillis()`, which can go backwards
across an NTP correction and produce a negative duration, which `Timer` does not support.

**★ You want to time an async task submitted to an executor. What do you use and what are you
measuring?**
`timer.wrap(runnable)` before submission, which produces an instrumented `Runnable` that times the
task *as it executes* — so the measurement excludes queue time. If you want to include queue time
you must start a `Timer.Sample` before submission and stop it inside the task, which measures
end-to-end latency from the caller's point of view. Both are legitimate and they answer different
questions; the queue-time-excluded version is service time, and the difference between the two is
`executor.queued` doing its work ([05b](05b-use-for-a-jvm-service.md)).

**★ Why does a `Timer` alone give you no visibility of an operation that is still running?**
Because a timer is written on completion: the sample only enters the histogram when `stop` is
called. An operation that has been running for twenty minutes has contributed nothing to any
series, so a hung job and a job that never started look identical on a dashboard. `LongTaskTimer`
exists for exactly this gap — it reports the number of tasks currently in flight and their
accumulated duration — and the documented pattern is to stack the two, since they answer different
questions and their series names differ.

**★ You have a timer around a database call and a timer around the enclosing service method. Is
that useful?**
Marginally, and it gets less useful with every layer you add. Two timers tell you the inner
duration and the outer duration; they do not tell you where the difference went, because the outer
timer is not decomposed. Once you want that decomposition you want spans, which are hierarchical by
construction and carry the parent-child relationship the metrics cannot express. Metrics answer
"how often and how long, in aggregate"; traces answer "where did this particular request spend its
time". Building a timer tree is an attempt to make the first tool do the second tool's job.

{/* FOOTER */}
