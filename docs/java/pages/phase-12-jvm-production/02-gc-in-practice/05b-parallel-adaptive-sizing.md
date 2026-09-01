---
title: "`-XX:+UseAdaptiveSizePolicy` is declared in the shared GC globals, defaults to true and is documented without naming a collector — and only the Parallel collector reads it, which is why setting it on a G1 command line is an elaborate way of doing nothing"
sidebar_label: "05b · Parallel's adaptive sizing"
sidebar_position: 25
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **HotSpot Virtual Machine Garbage Collection Tuning Guide,
> Release 25**, "The Parallel Collector" — Parallel Collector Ergonomics, Parallel Collector
> Generation Size Adjustments, Parallel Collector Default Heap Size, Specification of Parallel
> Collector Initial and Maximum Heap Sizes, Excessive Parallel Collector Time and
> OutOfMemoryError
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/gctuning/parallel-collector1.html));
> the JDK 25 `java` tool reference for `-XX:+UseAdaptiveSizePolicy`,
> `-XX:InitialSurvivorRatio`, `-XX:+UseGCOverheadLimit` and `-XX:+PrintFlagsFinal`
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html));
> and the JDK 25 HotSpot sources at tag `jdk-25+36` —
> [`gc/parallel/parallelArguments.cpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/gc/parallel/parallelArguments.cpp)
> (which overwrites `MinHeapFreeRatio` and `MaxHeapFreeRatio` when adaptive sizing is on) and
> [`gc/shared/gc_globals.hpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/gc/shared/gc_globals.hpp)
> for `UseAdaptiveSizePolicy`, `GCTimeLimit`, `GCHeapFreeLimit` and `GCOverheadLimitThreshold`.
> **Zero references to `UseAdaptiveSizePolicy` exist in `g1Arguments.cpp` or
> `serialArguments.cpp`.**
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**The Parallel collector resizes its own generations to meet the goals you state, and the
machinery is more interesting than its reputation: it grows four times faster than it shrinks,
it deliberately ignores `System.gc()` when gathering statistics, and switching it on — which is
the default — silently overwrites two heap-ratio flags with values that constrain nothing. This
page is that machinery, the default heap arithmetic that goes with it, and the one flag that
looks universal and is not.**

## Adaptive sizing, which is Parallel's and nobody else's

> *"When the parallel collector is selected by using `-XX:+UseParallelGC`, it enables a method of
> automatic tuning that allows you to specify behaviors instead of generation sizes and other
> low-level tuning details."*
>
> *"Statistics such as average pause time kept by the collector are updated at the end of each
> collection. The tests to determine if the goals have been met are then made and any needed
> adjustments to the size of a generation is made. **The exception is that explicit garbage
> collections, for example, calls to `System.gc()` are ignored in terms of keeping statistics and
> making adjustments to the sizes of generations.**"*

That exception is a deliberate and sensible design: an explicit collection tells the collector
nothing about the application's real behaviour, so letting it into the model would distort
every subsequent sizing decision. It also means that a monitoring agent forcing collections is
*not* corrupting Parallel's heuristics, only wasting time.

> *"Growing and shrinking the size of a generation is done by increments that are a fixed
> percentage of the size of the generation so that a generation steps up or down toward its
> desired size. Growing and shrinking are done at different rates. **By default, a generation
> grows in increments of 20% and shrinks in increments of 5%.** The percentage for growing is
> controlled by the command-line option `-XX:YoungGenerationSizeIncrement=<Y>` for the young
> generation and `-XX:TenuredGenerationSizeIncrement=<T>` for the old generation. The percentage
> by which a generation shrinks is adjusted by the command-line flag
> `-XX:AdaptiveSizeDecrementScaleFactor=<D>`. If the growth increment is X%, then the decrement
> for shrinking is X / D%."*

**Four to one.** Growth is 20%, the scale factor is 4, so shrinkage is 5%. A generation that
grew during a spike takes many collections to return, which is a footprint characteristic worth
knowing on a container.

> *"If the collector decides to grow a generation at startup, then there's a supplemental
> percentage is added to the increment. This supplement decays with the number of collections and
> has no long-term effect. The intent of the supplement is to increase startup performance. There
> isn't supplement to the percentage for shrinking."*
>
> *"If the maximum pause-time goal isn't being met, then the size of only one generation is shrunk
> at a time. If the pause times of both generations are above the goal, then the size of the
> generation with the larger pause time is shrunk first."*
>
> *"If the throughput goal isn't being met, then the sizes of both generations are increased. Each
> is increased in proportion to its respective contribution to the total garbage collection time.
> For example, if the garbage collection time of the young generation is 25% of the total
> collection time and if a full increment of the young generation would be by 20%, then the young
> generation would be increased by 5%."*

Note the asymmetry between the two goals: **a missed pause goal shrinks one generation; a missed
throughput goal grows both.** That is the priority order from
[01 · What a collector promises](01-what-a-collector-actually-promises.md) implemented as an
algorithm.

## The flag that looks universal and is not

⚠️ **`-XX:+UseAdaptiveSizePolicy` is a Parallel-collector flag.** It is declared in the shared
`gc_globals.hpp` with a default of `true`, which makes it look universal, and the man page's
description — *"Enables the use of adaptive generation sizing. This option is enabled by
default. To disable adaptive generation sizing, specify `-XX:-UseAdaptiveSizePolicy` and set the
size of the memory allocation pool explicitly"* — does not scope it. But `parallelArguments.cpp`
is the only collector argument file that reads it; `g1Arguments.cpp` and `serialArguments.cpp`
contain zero references. Setting `-XX:-UseAdaptiveSizePolicy` under G1 does nothing at all.
(G1's own sizing is [03c · G1 pause-time control](03c-g1-pause-time-and-the-knobs.md).)

There is a second-order effect worth knowing, straight from the source, because it changes what
two other flags mean:

```cpp
  if (UseAdaptiveSizePolicy) {
    // We don't want to limit adaptive heap sizing's freedom to adjust the heap
    // unless the user actually sets these flags.
    if (FLAG_IS_DEFAULT(MinHeapFreeRatio)) {
      FLAG_SET_DEFAULT(MinHeapFreeRatio, 0);
    }
    if (FLAG_IS_DEFAULT(MaxHeapFreeRatio)) {
      FLAG_SET_DEFAULT(MaxHeapFreeRatio, 100);
    }
```

**Under Parallel with the default adaptive sizing, `MinHeapFreeRatio` becomes 0 and
`MaxHeapFreeRatio` becomes 100** unless you set them yourself — which is to say, they stop
constraining anything. Anyone reasoning about heap growth under Parallel from those flags'
documented defaults is reasoning about values the collector overwrote at startup, and
`-XX:+PrintFlagsFinal` will show the overwrite.

The related flag `-XX:InitialSurvivorRatio` is also Parallel-specific, and the man page says so
while telling you what disabling adaptive sizing implies:

> *"Sets the initial survivor space ratio used by the throughput garbage collector (which is
> enabled by the `-XX:+UseParallelGC` option). Adaptive sizing is enabled by default with the
> throughput garbage collector … and the survivor space is resized according to the application
> behavior, starting with the initial value. If adaptive sizing is disabled (using the
> `-XX:-UseAdaptiveSizePolicy` option), then the `-XX:SurvivorRatio` option should be used to set
> the size of the survivor space for the entire execution of the application."*

So `-XX:SurvivorRatio` is only fully in charge under Parallel once adaptive sizing is off. The
heap shape those flags describe is
[01 · Memory layout → 03 · The heap](../01-memory-layout/03-the-heap.md).

## Default heap sizes

> *"Unless the initial and maximum heap sizes are specified on the command line, they're
> calculated based on the amount of memory on the machine. The default maximum heap size is
> one-fourth of the physical memory while the initial heap size is 1/64th of physical memory.
> **The maximum amount of space allocated to the young generation is one third of the total heap
> size.**"*
>
> *"If you know how much heap your application needs to work well, then you can set `-Xms` and
> `-Xmx` to the same value. If you don't know, then the JVM will start by using the initial heap
> size and then growing the Java heap until it finds a balance between heap usage and
> performance."*

and the guide's own verification instruction, which is the habit this whole topic wants you to
form:

> *"Other parameters and options can affect these defaults. To verify your default values, use
> the `-XX:+PrintFlagsFinal` option and look for `-XX:MaxHeapSize` in the output. For example, on
> Linux you can run the following:
> `java -XX:+PrintFlagsFinal <GC options> -version | grep MaxHeapSize`"*

Container-aware sizing supersedes the "physical memory" wording; that is
[03 · Heap sizing in containers](../03-heap-sizing-in-containers/README.md).

## The 98% rule lives here

> *"The parallel collector throws an `OutOfMemoryError` if too much time is being spent in garbage
> collection (GC). If more than 98% of the total time is spent in garbage collection and less
> than 2% of the heap is recovered, then an `OutOfMemoryError`, is thrown. This feature is
> designed to prevent applications from running for an extended period of time while making
> little or no progress because the heap is too small. If necessary, this feature can be disabled
> by adding the option `-XX:-UseGCOverheadLimit` to the command line."*

Note *"the parallel collector"*, and note that the two thresholds are separate flags with
separate defaults in `gc_globals.hpp` — `GCTimeLimit` at 98 and `GCHeapFreeLimit` at 2, plus a
`GCOverheadLimitThreshold` of 5 consecutive collections. The full treatment is
[09 · GC overhead and the death spiral](09-gc-overhead-and-the-death-spiral.md).

## Gotchas

**★ `-XX:+UseAdaptiveSizePolicy` does nothing under G1 or Serial.**
It is declared in shared GC globals, defaults to true, and the man page does not scope it — but
`parallelArguments.cpp` is the only collector that reads it. `-XX:-UseAdaptiveSizePolicy` on a
G1 command line is an inert flag that makes the line look considered.

**★ Under Parallel, `MinHeapFreeRatio` and `MaxHeapFreeRatio` are overwritten at startup.**
If adaptive sizing is on (the default) and you have not set them, `parallelArguments.cpp` sets
them to 0 and 100 — the values that constrain nothing. Their documented defaults are not what
your JVM is using, and `-XX:+PrintFlagsFinal` shows the difference.

**★ The young generation is one third of the heap under Parallel by default.**
*"The maximum amount of space allocated to the young generation is one third of the total heap
size."* That is `NewRatio=2` expressed as a fraction, and it is a real default rather than an
ergonomic one — unlike G1, where the young generation floats between 5% and 60%.

**★ Parallel grows generations four times faster than it shrinks them.**
20% growth increments, a decrement scale factor of 4, so 5% shrink increments. A heap that
expanded during a load spike takes several times as many collections to come back down. On a
container this reads as "the JVM never gives memory back", and it is a deliberate
hysteresis rather than a bug.

**★ `System.gc()` is excluded from Parallel's sizing statistics.**
*"Explicit garbage collections … are ignored in terms of keeping statistics and making
adjustments to the sizes of generations."* So a tool forcing collections is wasting time but
not poisoning the heuristics — which is a genuinely useful thing to know when deciding how
urgently to remove it.

**★ A missed pause goal shrinks one generation; a missed throughput goal grows both.**
The asymmetry is documented and is the priority order implemented literally. It also means the
two goals can fight: tightening the pause goal shrinks generations, which makes collections
more frequent, which misses the throughput goal, which grows them again. Setting both
aggressively produces oscillation.

**★ `-XX:SurvivorRatio` is only fully in charge under Parallel with adaptive sizing off.**
With it on — the default — survivor space *"is resized according to the application behavior,
starting with the initial value"* given by `InitialSurvivorRatio`. Setting `SurvivorRatio` and
expecting it to hold for the process lifetime requires `-XX:-UseAdaptiveSizePolicy` as well,
which the man page states and almost nobody does.

**★ There is a startup growth supplement that decays.**
*"If the collector decides to grow a generation at startup, then there's a supplemental
percentage is added to the increment. This supplement decays with the number of collections and
has no long-term effect."* Measurements taken in the first seconds of a Parallel JVM's life are
measuring a different sizing policy from the steady state.

**★ The 98% rule belongs to Parallel, not to every collector.**
The guide attributes it to *"the parallel collector"* and the man page to *"the parallel GC"*.
Expecting `GC Overhead limit exceeded` to save you from a death spiral under G1 or ZGC is
expecting a feature that is not there.

**★ "One-fourth of physical memory" is not what a containerised JVM does.**
The Parallel chapter's default heap arithmetic predates container awareness; on JDK 25 the
relevant knob is `-XX:MaxRAMPercentage` against the cgroup limit. Quote the chapter for the
*ratio* if you like, but not for the memory it is a ratio of.

## Interview questions

**★ You set `-XX:-UseAdaptiveSizePolicy` on a G1 service. What happens?**
Nothing. The flag is declared in the shared GC globals with a default of `true`, and the man
page describes it without naming a collector, so it looks universal — but only the Parallel
collector reads it. `g1Arguments.cpp` and `serialArguments.cpp` contain no references to it at
all. G1 has its own generation-sizing machinery driven by the pause-time goal, and the way to
constrain it is `G1NewSizePercent` and `G1MaxNewSizePercent`, or, if you are willing to disable
pause-time control entirely, `-Xmn`. This is a good example of why `-XX:+PrintFlagsFinal`
verifying that a flag was *set* is not the same as verifying it had an *effect*.

**★ How do the default goals differ between Parallel and G1, and why does that matter when
migrating?**
Parallel has no pause-time goal at all and targets 1% of time in GC (`GCTimeRatio=99`). G1
targets a 200 ms pause and about 8% of time in GC (`GCTimeRatio=12` ergonomically). So moving
from Parallel to G1 introduces a pause constraint the workload never had, which G1 satisfies by
sizing the young generation smaller and collecting more often, and simultaneously relaxes the
GC-time goal by a factor of eight, which changes when the heap grows. Both changes cost
throughput. That is why the guide's migration advice is to *"start by removing all options that
affect garbage collection"* and set only `-Xmx`, `-Xms` and a pause goal — and why, for a
workload with no latency requirement, the right migration may be not to migrate.

**★ Explain how Parallel decides to resize a generation.**
At the end of every collection — except explicit ones, which are excluded from the statistics —
it updates its averages and tests the three goals in priority order. If the maximum pause-time
goal is being missed, it shrinks exactly one generation, choosing the one with the larger pause
time. If the throughput goal is being missed, it grows both, each in proportion to its share of
total collection time, so a young generation responsible for a quarter of GC time gets a
quarter of a full 20% increment, that is 5%. If both goals are met it shrinks toward the
footprint goal. Growth uses 20% steps and shrinkage uses 20/4 = 5% steps, controlled by
`YoungGenerationSizeIncrement`, `TenuredGenerationSizeIncrement` and
`AdaptiveSizeDecrementScaleFactor`, and there is an additional decaying supplement to growth
during startup.

**★ Why does a Parallel-collector JVM appear reluctant to give memory back?**
Because the resize increments are asymmetric by design: 20% up, 5% down. A generation that
expanded to meet a throughput goal during a load spike needs roughly four times as many
collections to shrink back as it took to grow, and if the workload is idle there may be few
collections happening at all. On top of that, adaptive sizing overwrites `MinHeapFreeRatio`
to 0 and `MaxHeapFreeRatio` to 100 at startup unless you set them, which removes the free-ratio
constraints that would otherwise force shrinkage. If footprint return matters, setting those
two flags explicitly is the lever — and being explicit is required, because the moment you set
them the collector stops overriding them.

**★ You set `-XX:SurvivorRatio=8` under Parallel and the survivor spaces are not that size.
Why?**
Because adaptive sizing is on by default and resizes the survivor spaces according to observed
behaviour, using `InitialSurvivorRatio` as a starting point rather than `SurvivorRatio` as a
fixed value. The man page spells out the requirement: *"If adaptive sizing is disabled (using
the `-XX:-UseAdaptiveSizePolicy` option), then the `-XX:SurvivorRatio` option should be used to
set the size of the survivor space for the entire execution of the application."* So the flag
you want depends on whether adaptive sizing is on, and pinning the ratio means turning adaptive
sizing off — which also means taking responsibility for the generation sizes it was managing.

**★ Does `GC overhead limit exceeded` protect a G1 service?**
No. Both the tuning guide and the man page attribute the mechanism to the parallel collector
specifically — *"the parallel GC will throw an `OutOfMemoryError` if more than 98% of the total
time is spent on garbage collection and less than 2% of the heap is recovered"*. Under G1 or
ZGC a service can spend almost all of its time collecting and never receive that error; it will
simply become unresponsive, and what eventually kills it is either an ordinary
`Java heap space` error or, in a container, the OOM killer. That is a strong argument for
alerting on GC *time fraction* as a metric rather than relying on the JVM to notice.

{/* FOOTER */}
