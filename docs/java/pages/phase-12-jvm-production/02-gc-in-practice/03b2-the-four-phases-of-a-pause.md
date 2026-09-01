---
title: "A G1 pause is long for exactly one of four reasons and each has a different fix, so `-Xlog:gc+phases=debug` converts the entire question from an argument into a lookup — which is why it is the most valuable G1 flag that almost nobody enables"
sidebar_label: "03b2 · The four phases of a pause"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **HotSpot Virtual Machine Garbage Collection Tuning Guide,
> Release 25** — "Garbage-First (G1) Garbage Collector → Garbage Collection Process"
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/gctuning/garbage-first-g1-garbage-collector1.html))
> and "Garbage-First Garbage Collector Tuning" → "Reference Object Processing Takes Too Long",
> "High Merge Heap Roots and Scan Heap Roots Times", "Mixed Collections Take Too Long" and
> Table 8-1
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/gctuning/garbage-first-garbage-collector-tuning.html)),
> the JDK 25 `java` tool reference for `-XX:+ParallelRefProcEnabled` and
> `-XX:SoftRefLRUPolicyMSPerMB`
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html)),
> and [`gc/shared/gc_globals.hpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/gc/shared/gc_globals.hpp)
> at tag `jdk-25+36` for `GCCardSizeInBytes`.
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**"The pause was 400 ms" is not a diagnosis, it is a measurement, and the gap between the two
is one command-line flag wide. G1 divides every collection into four named phases with named
sub-phases, prints their timings on request, and each dominant sub-phase points at a
different remedy. This page is the map from sub-phase to cause to documented fix, plus the
one phase that ordinary Java code fills without anyone realising they are writing GC work.**

## The four phases of a pause, and the tags that show them

> *"A garbage collection consists of four phases."*
>
> *"The **Pre Evacuate Collection Set** phase performs some preparatory work for garbage
> collection: disconnecting TLABs from mutator threads, selecting the collection set for this
> collection … and other small preparatory work."*
>
> *"During **Merge Heap Roots** G1 creates a single unified remembered set for later easier
> parallel processing from the collection set regions. This removes many duplicates from the
> individual remembered sets that would otherwise be needed to be filtered out later in a more
> expensive way."*
>
> *"The **Evacuate Collection Set** phase represents the bulk of the work: G1 starts moving
> objects starting from the roots. A root reference is a reference from outside the collection
> set, either from some VM internal data structure (external roots), code (code roots) or from
> the remainder of the Java heap (heap roots, determined by the remembered sets). For all
> roots, G1 copies the referenced object in the collection set to its destination, processes
> its references into the collection set as new roots until there are no more roots."*
>
> *"The **Post Evacuate Collection Set** consists of clean-up work including reference
> processing and setup for the following mutator phase."*

There is a fifth thing that is not a phase but happens between the third and fourth:

> *"G1 may optionally repeat main evacuation phases for optional collection sets."*

That is the optional collection set from
[03b](03b-the-collection-set-and-remembered-sets.md) being evacuated in extra passes while
time remains — visible in the log as repeated evacuation work within a single collection.

And the two logging levels that expose all of it:

> *"Individual timing for these phases can be observed with `-Xlog:gc+phases=debug` logging in
> the Ext Root Scanning, Code Root Scan, Scan Heap Roots, and Object Copy sub-phases
> respectively."*
>
> *"These phases correspond to the phases printed with `-Xlog:gc+phases=info` logging."*

**`info` gives you the four phases. `debug` gives you the sub-phases, which is where the
answer is.** The cost of `debug` is a handful of extra lines per collection; on a service
doing ten collections a minute that is nothing, and it is the difference between tuning and
guessing.

## The lookup table

A long pause is long for one of four reasons, and `gc+phases=debug` tells you which without
any argument:

| Dominant sub-phase | What it means | Documented direction |
|---|---|---|
| `Object Copy` | too much survived the collection set | smaller young generation via `G1NewSizePercent` / `G1MaxNewSizePercent`, or fewer surviving objects |
| `Scan Heap Roots` / `Merge Heap Roots` | remembered sets are large or numerous | larger `G1HeapRegionSize`, or finer `GCCardSizeInBytes` |
| `Ext Root Scanning` / `Code Root Scan` | very many threads, JNI globals or compiled-code roots | reduce thread count; see [01 · Memory layout → 06d](../01-memory-layout/06d-the-thread-count-arithmetic.md) |
| `Reference Processing` (in Post Evacuate) | the application's `Reference` usage | `ReferencesPerThread`, `ParallelRefProcEnabled` |

Note that the first two rows point in *opposite* directions on the same flag.
`G1HeapRegionSize` up reduces cross-region references and shrinks remembered sets, but the
guide immediately warns that *"larger regions may mean more live objects to evacuate per
region, increasing the time for other phases"* — you are moving time from Merge/Scan into
Object Copy. There is no setting that reduces both; there is a setting that puts the cost
where you can afford it.

The guide sets a threshold for the remembered-set row that is worth remembering as a number:

> *"If a significant amount of time of the garbage collection, i.e. more than 60%, is spent in
> these two phases, one option could be decreasing the granularity of the remembered set
> entries by decreasing the value of the `-XX:GCCardSizeInBytes` option: finer granularity
> decreases the amount of work to find references, at the cost of some additional memory."*

## The Object Copy row, and where the guide sends you

Object Copy is the phase that is supposed to dominate — it is the actual work — so
"dominating" here means "longer than your budget", not "largest". The guide's directions are
about *reducing what has to be copied*:

> *"Normal young and, in general any young collection roughly takes time proportional to the
> size of the young generation, or more specifically, the number of live objects within the
> collection set that needs to be copied. If the Evacuate Collection Set phase takes too long,
> in particular, the Object Copy sub-phase, decrease `-XX:G1NewSizePercent`. This decreases
> the minimum size of the young generation, allowing for potentially shorter pauses."*
>
> *"Another problem with sizing of the young generation may occur if application performance,
> and in particular the amount of objects surviving a collection, suddenly changes. This may
> cause spikes in garbage collection pause time. It might be useful to decrease the maximum
> young generation size by using `-XX:G1MaxNewSizePercent`."*

⚠️ Both of those flags are `EXPERIMENTAL` in `g1_globals.hpp` and require
`-XX:+UnlockExperimentalVMOptions` *before* them on the command line — see
[03c · Pause-time control and the knobs](03c-g1-pause-time-and-the-knobs.md), which is also
where the Mixed-collection variants of this diagnosis live.

## Mixed collections have their own diagnostic lines

For a Mixed collection, "was the pause long because of young regions or old regions" is
answerable directly:

> *"You can obtain information about how much time evacuation of either young or old
> generation regions contribute to the pause-time by enabling the `gc+ergo+cset=debug` log
> output. Look for the following log message:"*
>
> *"`Added young regions to CSet. [...] predicted eden time: 4.86ms, predicted base time:
> 9.98ms, target pause time: 200.00ms, [...]`"*
>
> *"Eden time and base time together give the predicted young region time, that is the time G1
> expects evacuating the young generation will take"*
>
> *"The log message for predicting old region time looks as follows:"*
>
> *"`Finish choosing collection set old regions. [...] predicted initial time: 147.70ms,
> predicted optional time: 15.45ms, [...]`"*
>
> *"Here, predicted initial time represents predicted old region time, i.e. the time G1 expects
> evacuating the minimum set of old generation regions will take."*

(Those two lines are the tuning guide's own examples, quoted for their *shape*; the numbers in
them are Oracle's, from the guide, not from any run of yours or mine.)

The reason this matters: if predicted old region time is 147 ms against a 200 ms target, the
mandatory old-region set alone has consumed three quarters of the budget before a single
young region is considered. That is a `G1MixedGCCountTarget` problem, not a
`MaxGCPauseMillis` problem, and no amount of lowering the pause goal will fix it.

## The phase people forget

Post Evacuate is mostly Reference Processing, and the population it processes is created by
ordinary application code that nobody thinks of as GC work — `WeakHashMap`, `ThreadLocal`,
soft-reference caches, every direct `ByteBuffer`. It has its own flags, its own
counter-intuitive defaults and its own migration story, and it is
[03b3 · Reference processing and the finalization tail](03b3-reference-processing.md).

## The spurious spike that is not your fault

> *"Spurious high Scan Heap Roots times in combination with the application allocating large
> objects may be caused by an optimization that tries to reduce concurrent remembered set
> updates work by batching them. If the application that created such a batch happens just
> before a garbage collection, this might have a negative impact on Merge Heap Roots time. Use
> `-XX:-ReduceInitialCardMarks` to disable this optimization and potentially avoid this
> situation."*

`ReduceInitialCardMarks` defaults to on (Table 8-1: *"This batches together concurrent
remembered set update (refinement) work for initial object allocations"*). This is worth
knowing mainly so that a single anomalous Merge Heap Roots time in an otherwise clean log
does not send you on a two-day investigation.

## Gotchas

**★ `-Xlog:gc+phases=debug` is the diagnostic that turns "the pause was long" into "the pause
was long because X".**
Four phases and their sub-phases, each with its own timing and its own remedy. Enabling it
costs a few lines per collection and it is the difference between tuning and guessing. Most
teams have never turned it on.

**★ `gc+phases=info` and `gc+phases=debug` are not the same diagnostic.**
`info` prints the four top-level phases; the sub-phases that actually identify the cause —
Ext Root Scanning, Code Root Scan, Scan Heap Roots, Object Copy — only appear at `debug`.
Enabling `info` and concluding "Evacuate Collection Set is slow" tells you the collection was
doing collection work.

**★ Raising `G1HeapRegionSize` trades Merge/Scan time for Object Copy time.**
The guide says both halves: larger regions mean *"fewer cross-region references"* and also
*"more live objects to evacuate per region, increasing the time for other phases"*. If you
change it, re-read `gc+phases=debug` afterwards, because the dominant sub-phase may have
moved rather than shrunk.

**★ A predicted old-region time near the pause target means `G1MixedGCCountTarget`, not
`MaxGCPauseMillis`.**
`gc+ergo+cset=debug` prints the prediction before the collection happens. If the *minimum*
old-region set is already most of the budget, lowering the pause goal cannot help — the
mandatory floor exists to guarantee progress. Spreading reclamation over more Mixed
collections is the lever.

**★ One anomalous Merge Heap Roots spike after a large allocation is a documented
optimisation artefact.**
`ReduceInitialCardMarks` batches refinement work for newly allocated objects; if a batch lands
just before a collection, Merge Heap Roots takes the hit. `-XX:-ReduceInitialCardMarks`
disables it. Do not restructure an application over a single outlier.

**★ Pre Evacuate Collection Set disconnects every thread's TLAB.**
That is documented as part of the phase. On a service with a very large number of threads
this is not free, and it is another reason thread count is a GC parameter — see
[01 · Memory layout → 03c · TLABs and allocation](../01-memory-layout/03c-tlabs-and-allocation.md).

## Interview questions

**★ A G1 pause is 400 ms and the target is 200 ms. What is the first command you run?**
Add `-Xlog:gc+phases=debug` and look at which of the four phases dominates. Pre Evacuate is
preparatory and should be negligible. Merge Heap Roots or Scan Heap Roots dominating points at
remembered set size — the documented remedies are a different `G1HeapRegionSize` or a finer
`GCCardSizeInBytes`, and the guide gives 60% of pause time as the threshold at which the
second is worth considering. Object Copy dominating means too much survived the collection,
which is a young-generation sizing or an application-allocation question. Post Evacuate
dominating is usually Reference Processing, which has its own parallelisation controls.
Without this breakdown every subsequent action is a guess, and the flag costs nothing to
enable.

**★ What are the four phases of a G1 collection and what happens in each?**
Pre Evacuate Collection Set does preparation: disconnecting TLABs from mutator threads and
selecting this collection's collection set. Merge Heap Roots builds one unified remembered
set from the per-region ones, deduplicating so the later scan is cheaper and parallelisable.
Evacuate Collection Set is the bulk of the work: starting from external roots, code roots and
heap roots found via the remembered sets, G1 copies live objects out of the collection set and
follows their references transitively. Post Evacuate Collection Set does cleanup, including
reference processing and preparation for the next mutator phase. G1 may repeat evacuation for
the optional collection set if time remains. Each phase has its own sub-phase timings under
`-Xlog:gc+phases=debug`, and knowing which phase dominates is the whole of G1 pause
diagnosis.

**★ Why does raising `G1HeapRegionSize` sometimes make pauses worse?**
Because it trades one phase against another. Larger regions mean fewer cross-region
references, so remembered sets are smaller and Merge Heap Roots and Scan Heap Roots get
cheaper. But each region now holds more objects, so evacuating one copies more, and Object
Copy gets more expensive. The guide states both halves. Which way the net moves depends on
which phase was dominant before, which is why the honest procedure is: read
`gc+phases=debug`, change the flag, read it again, and expect the dominant sub-phase to have
moved rather than the total to have simply dropped.

**★ How would you tell whether a long Mixed collection was caused by the young part or the old
part?**
`-Xlog:gc+ergo+cset=debug`. G1 prints its predictions before the collection: a line beginning
`Added young regions to CSet` carrying predicted eden time, predicted base time and the target
pause time, and a line beginning `Finish choosing collection set old regions` carrying
predicted initial time — the minimum old-region set — and predicted optional time. Comparing
predicted old-region time against the target tells you immediately whether the mandatory
old-region floor is eating the budget, in which case the lever is `G1MixedGCCountTarget` to
spread reclamation over more collections, or `G1MixedGCLiveThresholdPercent` and
`G1HeapWastePercent` to stop collecting expensive regions at all.

{/* FOOTER */}
