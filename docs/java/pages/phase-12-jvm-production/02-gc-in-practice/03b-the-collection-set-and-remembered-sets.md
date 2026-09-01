---
title: "G1 can meet a pause target only because it gets to choose which regions to collect, and it can only choose because it maintains a remembered set — so the entire pause-time story rests on bookkeeping you pay for on every reference store and can watch in four log phases"
sidebar_label: "03b · Collection set and remembered sets"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **HotSpot Virtual Machine Garbage Collection Tuning Guide,
> Release 25**, chapter "Garbage-First (G1) Garbage Collector" — "Garbage Collection Pauses
> and Collection Set", "Remembered Set", "Collection Set" and "Garbage Collection Process"
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/gctuning/garbage-first-g1-garbage-collector1.html)),
> and "Garbage-First Garbage Collector Tuning" — "High Merge Heap Roots and Scan Heap Roots
> Times" and Table 8-1
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/gctuning/garbage-first-garbage-collector-tuning.html)),
> plus the JDK 25 HotSpot sources at tag `jdk-25+36` —
> [`gc/shared/gc_globals.hpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/gc/shared/gc_globals.hpp)
> for `GCCardSizeInBytes` and
> [`gc/g1/g1_globals.hpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/gc/g1/g1_globals.hpp)
> for `G1RSetUpdatingPauseTimePercent`, `G1ConcRefinementThreads` and `G1UseConcRefinement`
> (note its `DIAGNOSTIC` classification).
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**[03](03-g1.md) argued that G1's defining property is choosing its own workload. This page
is the machinery that makes the choice possible and the bill it presents: how the collection
set is selected, why a remembered set is unavoidable once you collect a subset of the heap,
what it costs on every reference store, and the four-phase pause breakdown that turns "the
pause was long" into a diagnosis. `-Xlog:gc+phases=debug` is the most useful G1 flag almost
nobody enables, and this page is what its output means.**

## The collection set: what G1 chooses to collect

> *"The collection set is the set of source regions to reclaim space during garbage
> collection. Independent of the garbage collection type, the collection set consists of
> different kinds of regions: Young generation regions, Humongous regions, Collection set
> candidate regions. These are old generation regions that G1 determined to be good candidate
> regions for garbage collection due to their high collection efficiency."*
>
> *"This efficiency is calculated from the amount of free space, where regions with little
> live data are preferred over regions that contain mostly live data, and the connectivity to
> other regions, low connectivity being preferred over high connectivity."*

That is "Garbage-First": collect the regions that are mostly garbage, because evacuating them
costs almost nothing and frees almost a whole region each. Two sources of candidates:

> *"There are two sources for old generation collection set candidate regions: from whole heap
> analysis, i.e., the marking, after G1 has recalculated information about the liveness and
> connectivity of all old generation regions, and regions that experienced evacuation failure.
> … Regions that experienced evacuation failure very often contain very few objects. This
> makes them very efficient regions to collect, so they are made collection set candidate
> regions by default."*

And a division that explains why G1 pauses vary in a bounded way:

> *"G1 discriminates between collection set candidate regions that are mandatory to collect in
> this garbage collection, and optional collection set candidate regions that will be garbage
> collected if time permits."*

The **optional collection set** is the mechanism by which G1 hits a pause target: it does the
mandatory work, checks the clock, and does as much optional work as fits. A collector that
can stop early is a collector that can meet a deadline. The Space-Reclamation phase's sizing
rules make this concrete:

> *"A minimum set of old generation regions to ensure evacuation progress. This set of old
> generation regions is determined by the number of old generation regions determined as
> collection set candidates by the marking divided by the length of the Space-Reclamation
> phase as determined by `-XX:G1MixedGCCountTarget`."*
>
> *"Additional old generation regions from the collection set candidates if G1 predicts that
> after collecting the minimum set there will be time left. Old generation regions are added
> until 80% of the remaining time is predicted to be used."*
>
> *"A set of optional collection set regions that G1 evacuates incrementally after the other
> two parts have been evacuated and there is time left in this pause."*

Note the shape: a **mandatory** floor sized to guarantee progress, a **predicted** middle
sized to 80% of the remaining budget, and an **optional** tail evacuated only if the clock
allows. The mandatory floor is why a Mixed collection can exceed the pause target — progress
is guaranteed ahead of the deadline.

## Where evacuated objects go

> *"For non-humongous regions, the destination region for an object is determined from the
> source region of that object: Objects of the young generation (eden and survivor regions)
> are copied into survivor or old regions, depending on their age. Objects from old regions
> are copied to other old regions."*
>
> *"Objects in humongous regions are treated differently. G1 typically does not move these
> objects, but only determines their liveness, and if they are not live, reclaims the space
> they occupy. G1 only moves humongous objects in a very slow last-resort collection effort."*

Humongous objects are effectively pinned. That is
[03d · Humongous allocations](03d-humongous-allocations.md), and it is the reason a heap can
be half free and still fail to satisfy an allocation.

## Remembered sets, and why they cost you

To evacuate a region you must find every reference into it from outside the collection set.

> *"To evacuate the collection set G1 manages a remembered set: the set of locations outside
> the collection set that contain references into the collection set. When an object from the
> collection set moves during garbage collection, any other references to that object from
> outside the collection set need to be changed to point to the new location of the object."*
>
> *"The remembered set entries represent approximate locations to save memory: often
> references close together reference objects close together, so that a single remembered set
> entry covers multiple locations. G1 uses cards to represent remembered set entries, small
> logical partitions of the heap. **By default, these are 512 byte sized areas.** Remembered
> set entries are compressed references of these cards."*

The card size is a real flag with a real default:

```cpp
product(uint, GCCardSizeInBytes, 512,
        "Card table entry size (in bytes) for card based collectors")
        range(128, NOT_LP64(512) LP64_ONLY(1024))
```

Remembered sets are the running cost of region-based collection: memory to hold them, a write
barrier on every reference store to maintain them, and concurrent *refinement* threads to
process the resulting queues. They are also the reason G1 uses more memory than Parallel at
the same heap size, and they show up under `GC` and `GCCardSet` in Native Memory Tracking —
see [01 · Memory layout → 12 · The checklist](../01-memory-layout/12-the-checklist.md).

G1 does not maintain them everywhere or eagerly:

> *"G1 manages the remembered sets on the basis of groups of regions: a single remembered set
> covers multiple regions that are advantageous to collect at the same time to reduce memory
> overhead."*
>
> *"The remembered sets are created mostly lazily: between the Remark and Cleanup pause G1
> rebuilds the remembered set of all marking collection set candidate regions. G1 always
> maintains remembered sets for young generation regions as they are collected at every
> collection, in addition to other interesting regions."*

## Refinement: the cost you can move but not remove

The write barrier does not update the remembered set inline; it enqueues work, and
*refinement* threads drain the queue concurrently. Whatever they do not finish is done in the
pause. That trade has a knob:

> *"`-XX:G1RSetUpdatingPauseTimePercent=10` — The concurrent remembered set update
> (refinement) work can be controlled with this option. Refinement tries to schedule work
> concurrently so that at most `-XX:G1RSetUpdatingPauseTimePercent` percent of the maximum
> pause time goal is spent in the garbage collection pause in the Update RS phase, processing
> remaining work."*
>
> *"Increasing this value potentially decreases the refinement work scheduled concurrently to
> the application, conversely decreasing this value potentially increases the amount of
> refinement work performed concurrently to the application."*

and two more controls, whose flag *classifications* matter as much as their values:

```cpp
product(uint, G1RSetUpdatingPauseTimePercent, 10,
        "A target percentage of time that is allowed to be spend on "
        "processing remembered set update buffers during the collection pause.")
        range(0, 100)

product(bool, G1UseConcRefinement, true, DIAGNOSTIC,
        "Control whether concurrent refinement is performed. "
        "Disabling effectively ignores G1RSetUpdatingPauseTimePercent")

product(uint, G1ConcRefinementThreads, 0,
        "The number of parallel remembered set update threads. "
        "Will be set ergonomically by default.")
```

⚠️ **`G1UseConcRefinement` is a `DIAGNOSTIC` flag**, so `-XX:-G1UseConcRefinement` is rejected
unless `-XX:+UnlockDiagnosticVMOptions` precedes it on the command line — and the tuning
guide recommends it for throughput without mentioning either fact. The guide's advice, with
its own caveat attached, is:

> *"Concurrent refinement can be completely disabled using the `-XX:-G1UseConcRefinement`
> option. This completely moves all concurrent refinement work into the garbage collection
> pause, leaving all CPU resources for the application while it is running. At the same time,
> all refinement work will be performed in the pause, potentially significantly increasing
> latency."*
>
> *"Disabling concurrent refinement can be an option when targeting highest throughput, pause
> times are already very low, and the value of the Pending Cards line of `gc+phase=debug`
> logging and the Scan Heap Roots times are low. Otherwise the increase in pause times
> decreases overall throughput."*

The flag-status trap is covered generally in
[02c2 · Flags that still work](02c2-flags-that-still-work.md) and specifically for G1 in
[03c · Pause-time control and the knobs](03c-g1-pause-time-and-the-knobs.md).

## Watching the bill arrive

The four phases of a G1 pause, the sub-phase timings that say which of them is expensive, and
the reference-processing phase that ordinary application code fills without anyone noticing
are [03b2 · Reading the four phases of a pause](03b2-the-four-phases-of-a-pause.md).

## Gotchas

**★ Remembered sets are a per-store cost, not just a memory cost.**
Maintaining them requires a write barrier on reference stores and concurrent refinement
threads to drain the resulting queues. That is throughput you are paying continuously,
whether or not a collection is happening, and it is a large part of why G1 is slower than
Parallel on allocation-heavy benchmarks.

**★ A Mixed collection can exceed the pause goal by design.**
The old-region part of the collection set has a *mandatory* floor — candidates divided by
`G1MixedGCCountTarget` — chosen *"to ensure evacuation progress"*, and it is selected before
the time prediction is consulted. Progress outranks the deadline. If your Mixed pauses
overshoot and your Young pauses do not, this is why, and the lever is
`G1MixedGCCountTarget`, not `MaxGCPauseMillis`.

**★ `-XX:-G1UseConcRefinement` is a diagnostic flag and needs an unlock.**
`g1_globals.hpp` declares it `DIAGNOSTIC`, so the option is rejected without a preceding
`-XX:+UnlockDiagnosticVMOptions`. The tuning guide recommends it for throughput and mentions
neither the classification nor the unlock, so following the guide verbatim produces a JVM
that will not start.

**★ Disabling concurrent refinement moves the work into the pause; it does not delete it.**
The guide is explicit — *"all refinement work will be performed in the pause, potentially
significantly increasing latency"* — and gives three preconditions before it is even worth
trying: you are targeting highest throughput, pauses are already very low, and Pending Cards
and Scan Heap Roots times are already low. Two out of three is not enough.

**★ Humongous regions are in the collection set but are not evacuated.**
The guide: G1 *"typically does not move these objects, but only determines their liveness"*,
and moves them only *"in a very slow last-resort collection effort"*. So a heap dominated by
humongous regions has a collection set G1 cannot compact, which is exactly the fragmentation
failure in [03e · When G1 goes wrong](03e-g1-when-it-goes-wrong.md).

**★ Regions that failed evacuation become high-priority candidates, which looks like a
recovery and is one.**
The guide notes such regions *"very often contain very few objects"* and are therefore
efficient, so they are candidates *"by default"*. After an evacuation failure you should
expect the next few collections to clean up cheaply. If they do not, the problem is not
transient.

**★ Halving `GCCardSizeInBytes` doubles the card table.**
The guide offers it as the remedy when Merge and Scan Heap Roots exceed 60% of pause time,
and names the price only as *"some additional memory"*. The card table is a fixed fraction of
heap size — one entry per card — so halving the card size doubles it, in native memory outside
`-Xmx`. On a container that is a real number and belongs in the arithmetic in
[03 · Heap sizing in containers](../03-heap-sizing-in-containers/README.md).

## Interview questions

**★ Why is it called Garbage-First?**
Because the collection set is chosen by predicted efficiency, and the most efficient region to
collect is the one with the least live data in it — the one that is mostly garbage. The guide
puts it as *"G1 reclaims space in the most efficient areas first (that is the areas that are
mostly filled with garbage, therefore the name)"*, and describes the efficiency calculation as
combining *"the amount of free space, where regions with little live data are preferred"* with
connectivity, *"low connectivity being preferred over high connectivity"*. It matters because
it means G1's cost is proportional to what survives, not to heap size, at old-generation
granularity as well as young.

**★ What is a remembered set and why does G1 need one?**
It is the set of locations outside the collection set that hold references into it. G1 collects
a subset of regions, so before it can move an object it must find and update every reference
to that object from regions it is not collecting — otherwise those references would dangle.
The set is kept approximately, using 512-byte cards (`GCCardSizeInBytes`) rather than exact
addresses, and it is maintained by a write barrier on every reference store plus concurrent
refinement threads. The costs are memory (visible in NMT as `GC` and `GCCardSet`), throughput
(the barrier), and pause time (the Merge Heap Roots and Scan Heap Roots phases). It is the
price of being able to choose your collection set.

**★ Why does G1 use more memory than Parallel for the same `-Xmx`?**
Because region-based collection needs bookkeeping that whole-generation collection does not.
Remembered sets and their card sets are the largest part — one per group of regions, sized by
how interconnected the heap is — plus marking bitmaps, the collection set candidate data, and
per-region metadata. None of that lives in the Java heap, so it does not appear in `-Xmx`; it
appears in the process's resident size, under the `GC` and `GCCardSet` categories in Native
Memory Tracking. On a container with a tight memory limit this is a real line item, and it is
one of the reasons Serial or Parallel can be the right answer for a small service.

**★ How does G1 decide how many old regions to put into a Mixed collection?**
In three parts. A mandatory minimum, computed as the number of marking-identified candidate
regions divided by `G1MixedGCCountTarget` (default 8), whose purpose is *"to ensure evacuation
progress"* regardless of timing. Then additional candidates added while G1 predicts that
*"after collecting the minimum set there will be time left"*, up to 80% of the remaining
predicted budget. Then an optional set evacuated incrementally afterwards only if the clock
still allows. The consequence is that a Mixed collection has a floor it will pay even if that
overshoots the pause target, and the way to lower that floor is to spread reclamation over
more collections with a larger `G1MixedGCCountTarget`.

**★ Your `gc+phases` output shows Merge Heap Roots and Scan Heap Roots consuming most of the
pause. What are the options and what do they cost?**
The guide gives two directions and both are trades. Increasing `G1HeapRegionSize` reduces
cross-region references and therefore remembered set size, but *"larger regions may mean more
live objects to evacuate per region, increasing the time for other phases"* — you are moving
time from Merge/Scan into Object Copy. Decreasing `GCCardSizeInBytes` makes each card cover
less heap so less scanning is wasted, *"at the cost of some additional memory"* — which is a
larger card table, in native memory, proportional to heap size. Before either, I would check
whether the interconnectedness is an application property worth changing: a very large
long-lived object graph that is constantly mutated by young objects is what generates
cross-region references in the first place.

{/* FOOTER */}
