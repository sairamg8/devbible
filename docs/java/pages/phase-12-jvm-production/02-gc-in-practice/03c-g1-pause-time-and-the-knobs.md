---
title: "G1 hits a pause target by resizing the young generation every collection, so almost every classic tuning flag people bring to it — `-Xmn`, `-XX:NewRatio`, a fixed `NewSize` — works by switching that mechanism off, and the tuning guide's own recommended remedies are flags that will not even parse without an unlock option it never mentions"
sidebar_label: "03c · G1 pause-time control"
sidebar_position: 13
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **HotSpot Virtual Machine Garbage Collection Tuning Guide,
> Release 25** — "Garbage-First (G1) Garbage Collector → Garbage-First Internals" (Java Heap
> Sizing, Young-Only Phase Generation Sizing, Space-Reclamation Phase Generation Sizing,
> Determining Initiating Heap Occupancy) and Table 7-1 "Ergonomic Defaults G1 GC"
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/gctuning/garbage-first-g1-garbage-collector1.html)),
> and "Garbage-First Garbage Collector Tuning" — General Recommendations, Moving to G1,
> Tuning for Latency, Tuning for Throughput, Tuning for Heap Size and Table 8-1
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/gctuning/garbage-first-garbage-collector-tuning.html));
> the JDK 25 `java` tool reference for `-XX:InitiatingHeapOccupancyPercent`,
> `-XX:G1AdaptiveIHOPNumInitialSamples`, `-XX:G1HeapWastePercent`, `-XX:G1MaxNewSizePercent`
> and `-XX:G1MixedGCCountTarget`
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html));
> and [`gc/g1/g1_globals.hpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/gc/g1/g1_globals.hpp)
> at tag `jdk-25+36` for every flag's default **and its `EXPERIMENTAL` / `DIAGNOSTIC` /
> `MANAGEABLE` classification**, which is where the documentation and the implementation
> disagree most.
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**The G1 tuning chapter's first recommendation is to change nothing, and its second is that
if you must change something, change the pause goal and the heap size. Everything after that
comes with a caveat the chapter does not always state: a large fraction of the flags it names
by name are classified `EXPERIMENTAL` or `DIAGNOSTIC` in the source and will abort the JVM
unless an unlock option precedes them. This page is how G1's pause control actually works,
every knob with its real default and its real classification, and the specific ways that
touching one turns the control loop off.**

## The recommendation, which is to stop

> *"The general recommendation is to use G1 with its default settings, eventually giving it a
> different pause-time goal and setting a maximum Java heap size by using `-Xmx` if desired."*
>
> *"G1 defaults have been balanced differently than either of the other collectors. G1's goals
> in the default configuration are neither maximum throughput nor lowest latency, but to
> provide relatively small, uniform pauses at high throughput."*
>
> *"Generally, when moving to G1 from other collectors, start by removing all options that
> affect garbage collection, and only set the pause-time goal and overall heap size by using
> `-Xmx` and optionally `-Xms`."*
>
> *"Many options that are useful for other collectors to respond in some particular way, have
> either no effect at all, or even decrease throughput and the likelihood to meet the
> pause-time target."*

That is the whole of the correct default advice, in the tuning guide's own words. What follows
exists so that when the defaults are genuinely wrong you can say *why* rather than reaching
for a flag from a 2014 blog post.

## The control loop: G1 sizes the young generation to hit the goal

> *"G1 determines an initial size for the young generation at the end of a normal young
> collection for the next mutator phase. As the mutator phase progresses, G1 refines this size
> estimate regularly."*
>
> *"The `-XX:GCPauseIntervalMillis` and `-XX:MaxGCPauseTimeMillis` options provide G1 with a
> minimum mutator utilization (MMU) to fit garbage collection activity into. For every possible
> time range of `-XX:GCPauseIntervalMillis`, G1 sizes the collection pauses to at most use
> `-XX:MaxGCPauseTimeMillis` milliseconds for garbage collection pauses. Information used for
> this calculation includes previous observations on how long it took young generations of
> similar size to evacuate, information on how many objects had to be copied during
> collection, and how interconnected these objects had been."*

(⚠️ `-XX:MaxGCPauseTimeMillis` is a typo in the guide; the flag is `MaxGCPauseMillis` — see
[01](01-what-a-collector-actually-promises.md).)

**This is the mechanism, and it is the only mechanism.** G1 has exactly one lever for making
a pause shorter: put fewer regions in the collection set, which for young collections means
make the young generation smaller. Everything else is a constraint on that lever.

Which is why the guide says this twice, in two different chapters:

> *"Avoid limiting the young generation size to particular values by using options like
> `-Xmn`, `-XX:NewRatio` and others because the young generation size is the main means for G1
> to allow it to meet the pause-time. Setting the young generation size to a single value
> overrides and practically disables pause-time control."*
>
> *"Only specifying one of these latter options to set eden size fixes young generation size to
> exactly the value passed with `-XX:NewSize` and `-XX:MaxNewSize` respectively. **This
> disables pause time control.**"*

`-Xmn` is equivalent to setting `NewSize` and `MaxNewSize` to the same value, so `-Xmn` under
G1 disables pause-time control outright. It is the single most common G1 misconfiguration and
it is usually inherited from a Parallel-collector command line where it was correct.

## The right knobs for the young generation, and their real status

The documented alternative is a *range*, not a value:

> *"The options `-XX:G1NewSizePercent` and `-XX:G1MaxNewSizePercent` constrain the minimum and
> maximum eden size, which in turn constrain garbage collection pause times."*

Table 7-1 gives the defaults: `-XX:G1NewSizePercent=5` and `-XX:G1MaxNewSizePercent=60`, *"The
size of the young generation in total, which varies between these two values as percentages of
the current Java heap in use."*

⚠️ **Both are `EXPERIMENTAL`:**

```cpp
product(uint, G1MaxNewSizePercent, 60, EXPERIMENTAL,
        "Percentage (0-100) of the heap size to use as default "
        " maximum young gen size.")
        range(0, 100)

product(uint, G1NewSizePercent, 5, EXPERIMENTAL,
        "Percentage (0-100) of the heap size to use as default "
        "minimum young gen size.")
        range(0, 100)
```

so both require `-XX:+UnlockExperimentalVMOptions` **before them on the command line**, or the
JVM prints *"Error: The unlock option must precede …"* and refuses to start. The man page says
so for one of them — *"This is an experimental flag"* under `-XX:G1MaxNewSizePercent` — and the
tuning guide, which is the document that actually recommends changing them, says so for
neither.

Note also the wording of "percentages of the current Java heap **in use**". These are not
percentages of `-Xmx`; they float with the committed heap. Pinning `-Xms` equal to `-Xmx`
therefore also stabilises what these percentages mean, which is a second, less obvious reason
that pinning is common in latency-sensitive deployments.

## IHOP: when marking starts, and why getting it wrong causes Full GCs

> *"The Initiating Heap Occupancy Percent (IHOP) is the threshold at which a Concurrent Start
> collection is triggered and it is defined as a percentage of the old generation size."*
>
> *"G1 by default automatically determines an optimal IHOP by observing how long marking takes
> and how much memory is typically allocated in the old generation during marking cycles. This
> feature is called Adaptive IHOP. If this feature is active, then the option
> `-XX:InitiatingHeapOccupancyPercent` determines the initial value as a percentage of the size
> of the current old generation as long as there aren't enough observations to make a good
> prediction of the Initiating Heap Occupancy threshold. Turn off this behavior of G1 using the
> option `-XX:-G1UseAdaptiveIHOP`. In this case, the value of
> `-XX:InitiatingHeapOccupancyPercent` always determines this threshold."*

Defaults, from Table 7-1: `-XX:+G1UseAdaptiveIHOP` and `-XX:InitiatingHeapOccupancyPercent=45`,
*"for the first few collection cycles G1 will use an occupancy of 45% of the old generation as
mark start threshold"*. How many is "the first few" is its own flag:

```cpp
product(size_t, G1AdaptiveIHOPNumInitialSamples, 3, EXPERIMENTAL,
        "How many completed time periods from concurrent start to first "
        "mixed gc are required to use the input values for prediction "
        "of the optimal occupancy to start marking.")
```

**Three samples.** That has a consequence nobody plans for: for the first three marking cycles
after every restart, G1 is running on the static 45%, not on a model of your application. A
service that restarts frequently, or that is measured immediately after deploy, is being
measured on a collector that has not finished calibrating.

The reserve that Adaptive IHOP aims at:

> *"Internally, Adaptive IHOP tries to set the Initiating Heap Occupancy so that the first
> Mixed garbage collection of the Space-Reclamation phase starts when the old generation
> occupancy is at a current maximum old generation size minus the value of
> `-XX:G1HeapReservePercent` as the extra buffer."*

⚠️ **`-XX:G1HeapReservePercent` does not exist.** The flag is `G1ReservePercent`:

```cpp
product(uint, G1ReservePercent, 10,
        "It determines the minimum reserve we should have in the heap "
        "to minimize the probability of promotion failure.")
        range(0, 50)
```

The *tuning* chapter uses the correct name in its own remedy — *"Lower the target occupancy for
when to start Space-Reclamation by increasing the buffer used in an adaptive IHOP calculation
by modifying `-XX:G1ReservePercent`"* — so the two chapters of the same guide disagree, and the
one that would fail your launch is the earlier one. Default is **10**, range 0–50, and it is a
plain `product` flag with no unlock required.

## The rest of the knobs

Periodic collection for idle services, the asymmetry between how G1 grows and shrinks the
heap, the complete ergonomic-defaults table with each flag's lock classification, the
throughput direction, and string deduplication are
[03c2 · The G1 flag table and what it costs to touch it](03c2-the-g1-flag-table.md).

## Gotchas

**★ `-Xmn` under G1 turns off the thing you chose G1 for.**
The guide says it twice, and the second time in bold terms: fixing the young generation size
*"disables pause time control"*. G1's only lever for meeting a pause target is choosing how
many young regions to collect. Take that away and the pause goal becomes decoration. This is
the most common inherited G1 misconfiguration, because `-Xmn` was correct under Parallel.

**★ Five of the flags the G1 tuning chapter recommends by name are locked.**
`G1NewSizePercent`, `G1MaxNewSizePercent`, `G1MixedGCLiveThresholdPercent` and
`G1AdaptiveIHOPNumInitialSamples` are `EXPERIMENTAL`; `G1UseConcRefinement` is `DIAGNOSTIC`.
Each needs its unlock option *earlier on the command line*. Following the guide verbatim
produces a JVM that will not start, with an error naming the flag rather than the omission.

**★ `-XX:G1HeapReservePercent` is a documentation error. The flag is `G1ReservePercent`.**
The G1 chapter uses the wrong name in its Adaptive IHOP description; the tuning chapter uses
the right one twenty pages later. Only the second will launch. Default 10, range 0–50.

**★ `G1NewSizePercent` and `G1MaxNewSizePercent` are percentages of the heap *in use*, not of
`-Xmx`.**
Table 7-1: *"percentages of the current Java heap in use"*. On a heap that grows and shrinks,
the absolute young-generation bounds move with it, so the same percentage means different
things at different times of day. Setting `-Xms` equal to `-Xmx` removes the variable.

**★ Adaptive IHOP needs three completed cycles before it is adaptive.**
`G1AdaptiveIHOPNumInitialSamples` defaults to 3. Until then G1 uses the static
`InitiatingHeapOccupancyPercent` of 45. Benchmarks and canary measurements taken in the first
minutes after a restart are measuring an uncalibrated collector, and a service that restarts
often never leaves that state.

**★ Why is `-Xmn` bad advice under G1?**
Because G1's single mechanism for meeting a pause-time goal is choosing how many young regions
to put in the collection set, and it resizes the young generation after every collection based
on a cost model built from previous pauses. `-Xmn` sets `NewSize` and `MaxNewSize` to the same
value, which fixes the young generation and, in the guide's own words, *"overrides and
practically disables pause-time control"*. The result is that `MaxGCPauseMillis` stops doing
anything and pause times become whatever the fixed young size produces. If you genuinely need
to bound the young generation, the supported way is the range `G1NewSizePercent` /
`G1MaxNewSizePercent` — both of which are experimental flags requiring
`-XX:+UnlockExperimentalVMOptions` first.

**★ What is IHOP and what goes wrong if it is too high?**
The Initiating Heap Occupancy Percent is the old-generation occupancy at which G1 starts a
concurrent marking cycle, by scheduling a Concurrent Start collection instead of a normal
young one. If it is too high, marking starts too late: the application keeps promoting into
the old generation while marking runs, the old generation fills before the Space-Reclamation
phase can begin, and G1 falls back to a stop-the-world Full GC. By default G1 adapts the
threshold from observed marking durations and allocation rates (`G1UseAdaptiveIHOP`), starting
from `InitiatingHeapOccupancyPercent=45` until it has `G1AdaptiveIHOPNumInitialSamples` — three
— completed cycles to learn from. The documented remedies when Full GCs appear are to increase
`G1ReservePercent` so adaptation aims lower, or to disable adaptation and set the threshold
manually.

**★ How would you check that a G1 flag you set is actually in effect?**
`-XX:+PrintFlagsFinal` and compare, because there are four ways a flag can fail to do what you
meant. It can be locked — five of the flags the tuning chapter recommends are `EXPERIMENTAL`
or `DIAGNOSTIC` and abort the launch without an unlock option placed *before* them. It can be
misspelled from a documentation error, as with `G1HeapReservePercent`, which does not exist.
It can be overridden by ergonomics, which is why the printed value matters more than the
supplied one. And it can be doing something other than you assume, as with `-Xmn` silently
disabling pause-time control. The printed final value plus a `gc+phases=debug` reading before
and after is the only honest verification.

{/* FOOTER */}
