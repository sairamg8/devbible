---
title: "There is no bytes-per-second figure that makes an allocation rate 'too high' — the number only means something against eden size, promotion rate, the live set and yesterday's value — and in a real service almost all of the volume comes from code nobody would flag in review"
sidebar_label: "08b · Where allocation comes from"
sidebar_position: 33
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **HotSpot Virtual Machine Garbage Collection Tuning Guide,
> Release 25**, "Factors Affecting Garbage Collection Performance → The Young Generation"
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/gctuning/factors-affecting-garbage-collection-performance.html));
> the JDK 25 HotSpot sources at tag `jdk-25+36` —
> [`jfr/metadata/metadata.xml`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/jfr/metadata/metadata.xml)
> for `ObjectAllocationSample` and its `weight` field, and
> [`gc/shared/gc_globals.hpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/gc/shared/gc_globals.hpp)
> for `UseEpsilonGC`'s `EXPERIMENTAL` classification; and the Micrometer `JvmGcMetrics` binder
> source on GitHub (`micrometer-core`, `main` branch as of this date) for
> `jvm.gc.live.data.size` and `jvm.gc.memory.promoted` and their verbatim descriptions.
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**A measured allocation rate is a number without a verdict. This page is the four comparisons
that turn it into one, and then the list of places the bytes actually come from — which is
consistently boxing, logging, string building and per-request buffers rather than anything that
would be flagged in a code review as a performance concern.**

## What counts as "high"

Nothing on this page will give you a bytes-per-second threshold, because there is not one. The
useful comparisons are relative, and there are four:

**Against eden.** Allocation rate divided by eden size is your collection frequency. A collection
every few seconds is unremarkable; several per second means the young generation is small
relative to the workload, and the question becomes whether that is costing you throughput
(raise the pause goal — [03c3](03c3-tuning-g1-for-throughput.md)) or nothing at all.

**Against promotion.** If promotion rate is a significant fraction of allocation rate, objects
are surviving that should not be. The old generation is filling with things that were supposed
to die young, which is [08c · Premature promotion](08c-premature-promotion.md) and eventually
[03e2 · The road to a Full GC](03e2-the-road-to-a-full-gc.md).

**Against the live set.** `jvm.gc.live.data.size` is *"Size of long-lived heap memory pool after
reclamation"* — what remains once the collector has done its work. Allocation rate high and live
data flat is healthy churn. Both climbing together is the leak signature, and no GC flag
addresses it — [04 · OutOfMemoryError](../04-out-of-memory-error/README.md).

**Against yesterday.** A rate that doubles after a deploy is the most actionable GC signal there
is, because it points at a specific change rather than at a configuration. This is the argument
for graphing allocation rate continuously even when nothing is wrong: the value of the metric is
almost entirely in its trend.

## Where the allocation comes from

Almost always ordinary code, not obviously wasteful code:

- **Boxing.** `Map<String, Integer>`, a `List<Long>`, any stream of primitives that passes
  through a generic API. Each box is a small object with a header, and the header is a
  significant fraction of it — [01 · Memory layout → 08 · The object header](../01-memory-layout/08-the-object-header.md).
- **Streams and lambdas on hot paths.** Every intermediate operation allocates, and a stream
  inside a per-request loop multiplies by request rate.
- **String building.** Concatenation in a loop, `String.format`, and every `toString()` a logger
  calls on an argument.
- **Logging that is not parameterised.** Building a message that is then discarded allocates the
  message anyway — [07 · Logging done right](../07-logging-done-right/README.md).
- **Defensive copies.** `new ArrayList<>(other)` in a getter called once per request is a copy
  per request.
- **Per-request buffers.** And if they are large, they are also
  [03d · Humongous allocations](03d-humongous-allocations.md).
- **Serialisation.** JSON and protobuf libraries allocate intermediate structures; the volume is
  proportional to payload size times request rate.
- **Collections sized by default.** An `ArrayList` that grows to 10,000 elements allocates and
  abandons roughly a dozen backing arrays on the way.

The fix for all of them is code, not flags, and that argument is
[11 · When tuning is the wrong answer](11-when-tuning-is-the-wrong-answer.md).

## The measurement that names the line of code

`jdk.ObjectAllocationSample` carries the allocated class, the thread and a stack trace, plus the
field that makes it aggregatable:

> *"The relative weight of the sample. Aggregating the weights for a large number of samples, for
> a particular class, thread or stack trace, gives a statistically accurate representation of the
> allocation pressure"*

Sorting recorded samples by summed weight and reading the top few stack traces is normally a
five-minute exercise, and it normally identifies one or two call sites responsible for most of
the volume. The event is `throttle="true"`, which is what makes leaving it on acceptable. JFR is
[06 · JFR and profiling](../06-jfr-and-profiling/README.md).

## Epsilon: total allocation as one number

Run the workload under `-XX:+UnlockExperimentalVMOptions -XX:+UseEpsilonGC` with a fixed heap and
the JVM will exit when the heap is exhausted. The heap size divided by the time to exhaustion is
the allocation rate, uncontaminated by any collector's behaviour; the total allocated for a fixed
unit of work is a single number you can assert on in a regression test. It is the only
measurement in this area that is not perturbed by the thing being measured.
[02c2 · Flags that still work](02c2-flags-that-still-work.md).

## Gotchas

**★ Allocation rate rising while live data stays flat is healthy.**
It is churn: the application is producing more garbage and the collector is keeping up. Both
rising together is the leak signature. Watching allocation rate without watching
`jvm.gc.live.data.size` cannot tell them apart, and they call for completely different responses.

**★ There is no universal "too high" allocation rate.**
It only means something relative to eden size, to promotion rate, to the live set, and to
yesterday. A number quoted from an article is about somebody else's heap, live set and hardware.

**★ Logging is a major allocator and does not look like one.**
An unguarded `log.debug("..." + obj)` builds the string whether or not the level is enabled.
Multiply by request rate and it can dominate a service's allocation profile while appearing
nowhere in a code review as a performance concern. Parameterised logging exists for exactly
this.

**★ Epsilon gives you total allocation as a single number.**
Fixed heap, no collection, run until exit: heap size over elapsed time is the rate, and the
total for a fixed unit of work is a regression-testable figure. It is the only measurement here
that is not perturbed by the collector.

**★ Boxing is the allocation nobody sees, because it has no `new` in it.**
`map.put(key, count + 1)` on a `Map<String, Integer>` allocates an `Integer` per call. So does
every autoboxed value crossing a generic boundary. There is no syntax at the call site to draw
attention to it, which is why it survives review and shows up at the top of an allocation
profile.

**★ Growable collections allocate a chain of abandoned arrays.**
Doubling growth means reaching 10,000 elements allocates about a dozen backing arrays and
discards all but the last. Pre-sizing removes them, and if the final array is large enough it
also removes a humongous allocation.

**★ The most valuable allocation metric is its trend, not its value.**
An absolute figure invites a fruitless argument about whether it is high. A step change
correlated with a deploy is a defect report with a timestamp on it. Graph it continuously even
when nothing is wrong, because that is the only way to have the "before" value.

**★ Promotion rate is the number that predicts a future Full GC.**
Allocation rate says how busy the young generation is; promotion rate says how fast the old
generation is filling, which is what concurrent marking has to keep up with. A service whose
promotion rate climbs is heading for the failure in
[03e2](03e2-the-road-to-a-full-gc.md), often days before anything looks wrong.

**★ A fixed allocation rate with a growing live set is worse than a growing allocation rate.**
The first means retention is increasing — every collection has more to copy and the old
generation is filling — and it ends in an `OutOfMemoryError`. The second means throughput cost
and nothing else. The metric people watch is usually the wrong one of the two.

**★ Serialisation volume scales with payload size *and* request rate.**
Both multiply, so a change that doubles average response size and coincides with a traffic
increase quadruples allocation. It is worth graphing allocation rate against request rate rather
than alone, because the ratio is the number that should be stable.

## Interview questions

**★ Your allocation rate doubled after a deploy but pause times did not change. Is that a
problem?**
Possibly not, and the way to tell is the survival rate. If promotion rate and live data size are
unchanged, the extra allocation is pure churn — more short-lived objects, collected almost for
free, showing up as more frequent but not longer collections. That costs some throughput and
nothing else. If promotion rate rose with allocation rate, the new objects are surviving, which
means the old generation is filling faster, which means concurrent marking has less runway and
Full GCs become more likely later — a problem that has not manifested yet. And pause times not
changing is itself informative: it says the per-collection survivor volume is stable, so the
extra objects really are dying young.

**★ Where does allocation come from in a typical service, and how do you find out?**
Ordinary code. Boxing in generic collections, streams and lambdas on hot paths, string building
and `String.format`, unguarded logging that constructs messages which are then discarded,
defensive copies in getters, per-request buffers, growable collections that were not pre-sized,
and serialisation libraries building intermediate structures. None of it looks wasteful in
review. The way to find out is JFR's `jdk.ObjectAllocationSample`, which carries the allocated
class and a stack trace and is throttled and weighted specifically so that aggregating it
*"gives a statistically accurate representation of the allocation pressure"*. Sorting by summed
weight and reading the top five stack traces is usually a five-minute exercise that identifies
one or two call sites responsible for most of the volume.

**★ What would you graph on a GC dashboard, given four panels?**
Allocation rate, promotion rate, live data size and pause distribution — in that order of
importance, which is the opposite of how most dashboards are built. Allocation rate tells you how
hard the collector is being worked and is the metric that moves when someone deploys. Promotion
rate tells you how fast the old generation is filling, which predicts Full GCs before they
happen. Live data size distinguishes churn from a leak: allocation up with live data flat is
healthy, both up together is not. Pause distribution — p99 and p99.9, never the mean — is the
symptom, and it is the panel that gets built first and explains the least, because it tells you
that something is wrong without telling you what changed.

**★ A service has a stable allocation rate and a slowly growing live set. What is happening and
how urgent is it?**
Retention is increasing: the application is not allocating more, it is *keeping* more. Every
collection has more to copy, so pauses lengthen gradually; the old generation fills, so
concurrent marking has less runway; and eventually either the heap is exhausted or the collector
spends all its time failing to reclaim. It is more urgent than a rising allocation rate, because
a rising allocation rate is a throughput cost with a stable ceiling and this has no ceiling below
`-Xmx`. The distinguishing measurement is `jvm.gc.live.data.size` after full collections, and
the next step is a heap dump rather than a GC flag —
[04 · OutOfMemoryError](../04-out-of-memory-error/README.md).

**★ How would you make allocation a regression-testable property of a service?**
Epsilon. Run a fixed unit of work — a benchmark, a replayed request set — under
`-XX:+UnlockExperimentalVMOptions -XX:+UseEpsilonGC` with a fixed heap, and the JVM exits when
the heap is exhausted; the bytes allocated for that unit of work is then a single deterministic
number, uncontaminated by any collector's behaviour or by machine speed. Assert on it with a
tolerance, and a change that doubles allocation fails the build rather than being discovered in
production three weeks later. JFR's allocation events give you the same information with more
detail and less determinism, which makes them the right tool for investigating and the wrong one
for gating.

**★ Why is boxing worth calling out specifically?**
Because it is invisible at the call site and it is everywhere. `map.put(key, count + 1)` on a
`Map<String, Integer>` allocates an `Integer`; a `List<Long>` allocates a `Long` per element;
every primitive crossing a generic boundary is boxed. There is no `new` to notice in review, and
the objects are individually tiny, so the problem is entirely one of volume — and the object
header is a large fraction of each one, so the overhead ratio is poor. It also interacts with
the caches: a boxed collection is a collection of pointers to scattered objects rather than a
contiguous array of values. It shows up at the top of allocation profiles far more often than
anyone expects, and the fix is usually a primitive-specialised collection or a plain array.

{/* FOOTER */}
