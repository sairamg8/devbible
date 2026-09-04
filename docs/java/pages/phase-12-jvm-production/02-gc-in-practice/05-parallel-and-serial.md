---
title: "Parallel and Serial are not legacy collectors, they are the two collectors that do the least work per byte reclaimed — which makes Parallel the right answer whenever throughput is the metric and Serial the right answer in a container so small that G1's bookkeeping costs more than the collection does"
sidebar_label: "05 · Parallel and Serial"
sidebar_position: 24
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **HotSpot Virtual Machine Garbage Collection Tuning Guide,
> Release 25**, chapter "The Parallel Collector" in full
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/gctuning/parallel-collector1.html)),
> "Available Collectors" and "Introduction to Garbage Collection Tuning"
> ([available-collectors](https://docs.oracle.com/en/java/javase/25/gctuning/available-collectors.html),
> [introduction](https://docs.oracle.com/en/java/javase/25/gctuning/introduction-garbage-collection-tuning.html)),
> and "Ergonomics"
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/gctuning/ergonomics.html));
> the JDK 25 `java` tool reference for `-XX:+UseSerialGC`, `-XX:+UseParallelGC`,
> `-XX:+UseAdaptiveSizePolicy`, `-XX:InitialSurvivorRatio` and `-XX:ParallelGCThreads`
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html));
> and the JDK 25 HotSpot sources at tag `jdk-25+36` —
> [`gc/parallel/parallelArguments.cpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/gc/parallel/parallelArguments.cpp)
> and [`gc/shared/gc_globals.hpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/gc/shared/gc_globals.hpp),
> which together establish that **`UseAdaptiveSizePolicy` is read by the Parallel collector and
> by nothing else** (zero references in `g1Arguments.cpp` or `serialArguments.cpp`).
> JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9.

**Both of these collectors are fully supported on JDK 25 and neither is deprecated, but they
have acquired a reputation as things you used before G1. That reputation costs real money. A
batch job, an ETL step, a CI build, a Spark executor and a nightly report all care about total
work done and not at all about pause distribution, and for those Parallel does strictly less
work than G1. Serial, meanwhile, is what a one-CPU container gets by default — so a lot of
people are running it without deciding to.**

## Serial

> *"The serial collector uses a single thread to perform all garbage collection work, which makes
> it relatively efficient because there is no communication overhead between threads. It's
> best-suited to single processor machines because it can't take advantage of multiprocessor
> hardware, although it can be useful on multiprocessors for applications with small data sets
> (up to approximately 100 MB). The serial collector is selected by default on certain hardware
> and operating system configurations, or can be explicitly enabled with the option
> `-XX:+UseSerialGC`."*

And the introduction chapter's version, which is a recommendation rather than a description:

> *"The serial collector is usually adequate for most small applications, in particular those
> requiring heaps of up to approximately 100 megabytes on modern processors. **The other
> collectors have additional overhead or complexity, which is the price for specialized
> behavior. If the application does not need the specialized behavior of an alternate collector,
> use the serial collector.**"*

The reason it is efficient is the absence of everything else: no remembered sets, no write
barrier for cross-region references, no concurrent threads, no marking bitmaps, no collection
set selection. Native memory that G1 spends on `GC` and `GCCardSet` categories, Serial does not
spend at all — which on a 256 MB container is a meaningful fraction of the limit. See
[01 · Memory layout → 11 · Native Memory Tracking](../01-memory-layout/11-native-memory-tracking.md).

**And you may already be running it.** Ergonomics selects Serial on anything that is not
server-class, and server-class means *"two or more processors and physical memory larger than or
equal to 1792 MB"* as seen by the process. A pod with `limits.cpu: "1"` gets Serial silently.
That is often correct and occasionally a disaster — see
[02 · The four collectors](02-the-four-collectors.md).

## Parallel: the throughput collector

> *"The parallel collector is also known as throughput collector, it's a generational collector
> similar to the serial collector. The primary difference between the serial and parallel
> collectors is that the parallel collector has multiple threads that are used to speed up
> garbage collection."*
>
> *"The parallel collector is enabled with the command-line option `-XX:+UseParallelGC`. By
> default, with this option, both minor and major collections are run in parallel to further
> reduce garbage collection overhead."*

Thread count, which is not the same formula G1 uses:

> *"On a machine with `<N>` hardware threads where `<N>` is greater than 8, the parallel collector
> uses a fixed fraction of `<N>` as the number of garbage collector threads. The fraction is
> approximately 5/8 for large values of `<N>`. At values of `<N>` below 8, the number used is
> `<N>`. **On selected platforms, the fraction drops to 5/16.**"*

And a warning that is easy to miss:

> *"Because multiple garbage collector threads are participating in a minor collection, some
> fragmentation is possible due to promotions from the young generation to the old generation
> during the collection. Each garbage collection thread involved in a minor collection reserves a
> part of the old generation for promotions and the division of the available space into these
> 'promotion buffers' can cause a fragmentation effect. **Reducing the number of garbage collector
> threads and increasing the size of the old generation will reduce this fragmentation
> effect.**"*

So Parallel has a fragmentation mode of its own, caused by having *more* GC threads, and the
remedy is counter-intuitive: fewer threads. `ParallelGCThreads=0` is not an option — the source
rejects it:

```cpp
    "The Parallel GC can not be combined with -XX:ParallelGCThreads=0\n");
  vm_exit(1);
```

## Parallel's goals, and their priority

> *"Maximum garbage collection pause time: The maximum pause time goal is specified with the
> command-line option `-XX:MaxGCPauseMillis=<N>`. This is interpreted as a hint that pause times
> of `<N>` milliseconds or less are desired; **by default, no maximum pause-time goal.**"*
>
> *"Throughput: … The goal is specified by the command-line option `-XX:GCTimeRatio=<N>`, which
> sets the ratio of garbage collection time to application time to `1 / (1 + <N>)`. … **The
> default value is 99, resulting in a goal of 1% of the time in garbage collection.**"*
>
> *"Footprint: The maximum heap footprint is specified using the option `-Xmx<N>`. In addition,
> the collector has an implicit goal of minimizing the size of the heap as long as the other
> goals are being met."*
>
> *"The goals are maximum pause-time goal, throughput goal, and minimum footprint goal, and goals
> are addressed in that order."*

**Parallel has no default pause goal and a 1% GC-time goal.** G1 has a 200 ms pause goal and an
8% GC-time goal. Those two sentences are the entire difference in intent between the collectors,
and they explain why moving a batch job from Parallel to G1 can cost throughput for no benefit.

## Adaptive sizing, default heap sizes and the 98% rule

Parallel's automatic generation sizing — which is the only place `-XX:+UseAdaptiveSizePolicy`
does anything, and which silently overwrites two other flags at startup — plus the default heap
arithmetic and the GC-overhead `OutOfMemoryError` that only this collector throws, are
[05b · Parallel's adaptive sizing](05b-parallel-adaptive-sizing.md).

## Where each one still wins

| Situation | Collector | Why |
|---|---|---|
| Batch job, ETL, nightly report | Parallel | no pause requirement; least work per byte reclaimed |
| Spark / Flink executor, map-reduce task | Parallel | throughput is the SLA |
| CI build, compiler, code generator | Parallel | wall-clock time is the metric |
| Container under ~512 MB with 1 CPU | Serial | no remembered sets, no concurrent threads, lowest native overhead |
| Short-lived CLI or serverless function | Serial | startup and footprint dominate; the process may never collect twice |
| Heap under ~100 MB | Serial | the guide's own recommendation |
| Anything with a latency SLO | not these | [06 · Choosing](06-choosing.md) |

## Gotchas

**★ Parallel has no default pause-time goal; G1 has 200 ms.**
*"By default, no maximum pause-time goal."* Moving a service from Parallel to G1 therefore
introduces a constraint that was not there, and the collector will shrink the young generation
and collect more often to satisfy it. On a batch job that is a pure throughput loss.

**★ More Parallel GC threads can cause old-generation fragmentation.**
Each thread reserves its own promotion buffer in the old generation, and *"the division of the
available space into these 'promotion buffers' can cause a fragmentation effect"*. The guide's
remedy is fewer threads and a larger old generation, which is the opposite of the reflex.

**★ `-XX:ParallelGCThreads=0` aborts the JVM under Parallel.**
`parallelArguments.cpp` exits with *"The Parallel GC can not be combined with
-XX:ParallelGCThreads=0"*. Zero means "ergonomic" for the flag's *default*, but explicitly
passing 0 is rejected.

**★ On some platforms Parallel uses 5/16 of the hardware threads, not 5/8.**
*"On selected platforms, the fraction drops to 5/16."* The guide does not say which. If a thread
count does not match your arithmetic, `-XX:+PrintFlagsFinal` is the answer rather than the
formula.

**★ Serial is what a 1-CPU container gets by default, whether or not anyone chose it.**
Ergonomics requires *"two or more processors and physical memory larger than or equal to 1792
MB"* for G1. Below that threshold every collection is single-threaded and stop-the-world. On a
small service that is efficient; on one with a latency SLO it is a silent regression that no
manifest records.

**★ Serial's advantage is what it does not have, and that is invisible in `-Xmx`.**
No remembered sets, no card table maintenance for cross-region references, no marking bitmaps,
no concurrent threads. All of that is native memory and CPU that G1 spends outside the heap. On
a 256 MB container the difference is a real fraction of the limit, and Native Memory Tracking
is where you see it.

**★ "Parallel is the old collector" is a reputation, not a fact.**
It is fully supported on JDK 25, is one of the four collectors the tuning guide documents, and
is explicitly recommended by the guide for the case where *"peak application performance is the
first priority"* and pauses of a second or more are acceptable. Nothing about it is deprecated.

**★ Parallel's GC-time goal is 1% and G1's is about 8%.**
Both are `GCTimeRatio`, 99 versus 12. It means the two collectors will grow the heap at very
different points, and it is the second reason a Parallel-tuned command line behaves oddly under
G1.

## Interview questions

**★ When would you deliberately choose the Parallel collector on JDK 25?**
Whenever the metric is total work done rather than the distribution of pause times: batch jobs,
ETL, nightly reports, CI builds, compilers, Spark or Flink executors, anything measured in
wall-clock time to completion. Parallel does strictly less work per byte reclaimed than G1 — no
remembered sets, no write barrier for cross-region references, no concurrent threads, no
collection-set selection — and it has no default pause goal, so it never trades throughput for
a latency target nobody asked for. The tuning guide's own rule is *"If (a) peak application
performance is the first priority and (b) there are no pause-time requirements or pauses of one
second or longer are acceptable, then … select the parallel collector"*. It is not a legacy
choice; it is the specialised choice for a workload without a latency SLO.

**★ Why might Serial be the right collector for a small container?**
Because most of G1's cost is fixed rather than proportional. Remembered sets, card sets,
marking bitmaps, per-region metadata, refinement threads and concurrent marking threads all
exist whether the heap is 4 GB or 200 MB, and none of it is inside `-Xmx` — it is native memory
that counts against a container limit and CPU that counts against a quota. Serial has none of
it: one thread, no barriers for cross-region references, no bookkeeping. The guide is direct
about the threshold, recommending Serial for heaps *"up to approximately 100 megabytes"* and
adding that *"if the application does not need the specialized behavior of an alternate
collector, use the serial collector"*. The caveat is that every collection is a full
stop-the-world on one thread, so this is a footprint argument, never a latency one.

**★ A Parallel-collector service is fragmenting its old generation. What is a
counter-intuitive fix?**
Reduce `ParallelGCThreads`. Each GC thread participating in a minor collection reserves its own
promotion buffer in the old generation, and the guide states that *"the division of the
available space into these 'promotion buffers' can cause a fragmentation effect"*, with the
remedy being to *"reduce the number of garbage collector threads and increase the size of the
old generation"*. It is counter-intuitive because more GC threads normally means shorter
collections, and because fragmentation is usually reasoned about as a property of the object
graph rather than of the collector's parallelism. It also does not arise under G1, which
evacuates rather than promoting into per-thread buffers.

**★ A service in a `limits.cpu: "1"` pod has terrible tail latency. What collector is it
running?**
Almost certainly Serial, unless someone set a flag. Collector selection is ergonomic and the
server-class test is *"two or more processors and physical memory larger than or equal to 1792
MB"* evaluated against what the process can see, which under cgroups is the quota. One CPU
fails the test, so the JVM chooses Serial: every collection is stop-the-world and
single-threaded, which is exactly a tail-latency profile. Nothing in the image, the manifest or
the application logs says so; the first line of `-Xlog:gc` does. The fix is either to give the
pod a second CPU — which changes the collector as a side effect — or to accept Serial and size
the heap so its collections stay short.

{/* FOOTER */}
