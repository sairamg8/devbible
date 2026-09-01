---
title: "ZGC buys sub-millisecond pauses with CPU, with heap headroom and with the loss of compressed object pointers, and when the payments fall behind it does not pause the world — it stalls the thread that tried to allocate, which is invisible in every pause metric you already collect"
sidebar_label: "04c · What ZGC costs"
sidebar_position: 22
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **HotSpot Virtual Machine Garbage Collection Tuning Guide,
> Release 25**, chapter "The Z Garbage Collector" — Setting the Heap Size, Returning Unused
> Memory to the Operating System, Using Large Pages, Enabling Transparent Huge Pages On Linux
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/gctuning/z-garbage-collector1.html));
> **JEP 439 · Generational ZGC** — "No multi-mapped memory", "Optimized barriers" and "Risks
> and Assumptions" ([openjdk.org/jeps/439](https://openjdk.org/jeps/439));
> the JDK 25 `java` tool reference for `-XX:+UseZGC`, `-XX:SoftMaxHeapSize`,
> `-XX:ZAllocationSpikeTolerance`, `-XX:ZCollectionInterval`, `-XX:ZFragmentationLimit`,
> `-XX:+ZProactive`, `-XX:+ZUncommit` and `-XX:ZUncommitDelay`
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html));
> and the JDK 25 HotSpot sources at tag `jdk-25+36` —
> [`gc/z/z_globals.hpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/gc/z/z_globals.hpp)
> (where **`ZFragmentationLimit` is 5.0, not the 25 the man page states**),
> [`gc/shared/gcCause.cpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/gc/shared/gcCause.cpp)
> and [`jfr/metadata/metadata.xml`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/jfr/metadata/metadata.xml)
> for the `jdk.ZAllocationStall` event.
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**Nothing about ZGC is free, and the bill arrives in four currencies: CPU spent on barriers
and concurrent threads, heap headroom that has to exceed the live set by an amount nobody can
compute for you, eight-byte references because coloured pointers rule out compressed oops, and
— when the first two are underpaid — allocation stalls, which delay a request without
appearing in a single pause metric. This page is each cost, the flag or the log line that
exposes it, and the specific situations in which ZGC is the wrong answer.**

## The cost that is no longer a cost: the `ps` multiplier

This one has to be corrected before anything else, because it is repeated constantly and is
wrong on JDK 25:

> *"Non-generational ZGC uses multi-mapped memory to reduce the overhead of load barriers.
> Generational ZGC instead uses explicit code in the load and store barriers."*
>
> *"For users, the main advantage of this change is that makes it easier to measure the amount of
> memory used for the heap. **With multi-mapped memory the same heap memory is mapped into three
> separate virtual address ranges, so the heap usage reported by tools such as `ps` is around
> triple the amount of memory actually used.**"*

That was **non-generational** ZGC, which does not exist on JDK 25. Generational ZGC removed
multi-mapping, so the "ZGC's RSS is three times its heap" folklore is a description of a
collector that has been deleted. Any monitoring rule, capacity model or runbook still carrying
it is wrong on this release.

## Cost one: CPU

Two distinct consumers.

**Barriers.** Every reference read runs a load barrier fast path; every reference store runs a
store barrier fast path. JEP 439 describes the optimisation effort — fast and slow paths, a
JIT-compiled medium path with a store barrier buffer, barrier patching so global values become
immediates — and its own risk section names the residual cost:

> *"One additional source of overhead is the more capable GC barriers. We expect that most of
> this will be offset by the gains of not having to frequently collect objects in the old
> generation."*

**Concurrent GC threads.** ZGC does all its expensive work while the application runs, on
threads that compete with the application for the same cores. The tuning guide is explicit that
you do not size them yourself — ZGC *"dynamically adapts to the workload by resizing generations,
scaling the number of GC threads, and adjusting tenuring thresholds"* — and `z_globals.hpp`
confirms that the two overrides are diagnostic:

```cpp
product(uint, ZYoungGCThreads, 0, DIAGNOSTIC,
        "Number of GC threads for the young generation")

product(uint, ZOldGCThreads, 0, DIAGNOSTIC,
        "Number of GC threads for the old generation")
```

`DIAGNOSTIC` means `-XX:+UnlockDiagnosticVMOptions` must precede them. In practice, if you are
reaching for these the answer is more CPU.

The general shape of the trade is the tuning guide's own summary: ZGC *"provides max pause times
under a millisecond, **but at the cost of some throughput**"*, and G1's comparison section says
*"ZGC aims to provide significantly smaller pause times at further cost of throughput."*

## Cost two: headroom

> *"The most important tuning option for ZGC is setting the maximum heap size, which you can set
> with the `-Xmx` command-line option. Because ZGC is a concurrent collector, you must select a
> maximum heap size such that the heap can accommodate the live-set of your application **and
> there is enough headroom in the heap to allow allocations to be serviced while the GC is
> running**. How much headroom is needed very much depends on the allocation rate and the
> live-set size of the application. In general, the more memory you give to ZGC the better. But
> at the same time, wasting memory is undesirable, so it's all about finding a balance between
> memory usage and how often the GC needs to run."*

**"How much headroom is needed very much depends"** is the documentation declining to give you a
number, and it is correct to decline: the requirement is allocation rate multiplied by cycle
duration, and both are properties of your workload. This is the practical reason ZGC is a poor
fit for a tightly-sized container: a stop-the-world collector can run at 90% occupancy and just
pause longer, while a concurrent collector at 90% occupancy runs out of runway and stalls.

`-XX:SoftMaxHeapSize` exists to express "prefer this size, but you may exceed it":

> *"It can be used to set a soft limit on how large the Java heap can grow. ZGC will strive to
> not grow beyond this limit, but is still allowed to grow beyond this limit up to the maximum
> heap size. ZGC will only use more than the soft limit if that is needed to prevent the Java
> application from stalling and waiting for the GC to reclaim memory. For example, with the
> command-line options `-Xmx5g -XX:SoftMaxHeapSize=4g`, ZGC will use 4GB as the limit for its
> heuristics, but if it can't keep the heap size below 4GB, it is still allowed to temporarily
> use up to 5GB."*

That is the single most useful ZGC-specific flag: it gives the collector a target to aim at and
a reserve to survive a spike, which is exactly the shape of a container memory limit.

## Cost three: eight-byte references

Coloured pointers require the full 64 bits, so **compressed oops are unavailable under ZGC**.
On a heap under 32 GB, where G1 would use four-byte references, every reference in every object
doubles. A live set that comfortably fits under G1 may not fit under ZGC at the same `-Xmx`,
and the effect is largest on reference-dense data — object graphs, maps, linked structures —
and smallest on arrays of primitives. See
[01 · Memory layout → 09 · Compressed oops](../01-memory-layout/09-compressed-oops.md).

## Cost four: the allocation stall

When ZGC cannot reclaim as fast as the application allocates, it does not stop the world. It
stops the *allocating thread*. Two places expose it.

The GC cause `Allocation Stall` in `gcCause.cpp` — a collection triggered because a thread was
already waiting — alongside ZGC's other causes `Timer`, `Warmup`, `Allocation Rate`,
`Proactive` and `High Usage`.

And a JFR event, from `metadata.xml`:

```xml
<Event name="ZAllocationStall" category="Java Virtual Machine, GC, Detailed"
       label="ZGC Allocation Stall"
       description="Time spent waiting for memory to become available"
       thread="true" stackTrace="true">
```

*"Time spent waiting for memory to become available"*, with a thread and a stack trace. That
event is the only clean measurement of the cost, and it is the reason JFR is not optional on a
ZGC service — [06 · JFR and profiling](../06-jfr-and-profiling/README.md).

**An allocation stall appears in none of your existing GC dashboards.** It is not a pause, so
`jvm.gc.pause` does not see it. It is not a collection, so collection counts do not see it. It
shows up as request latency with no GC explanation — which is precisely the situation people
switch to ZGC to escape.

The knob that anticipates spikes:

> *"`-XX:ZAllocationSpikeTolerance=factor` — Sets the allocation spike tolerance for ZGC. By
> default, this option is set to 2.0. This factor describes the level of allocation spikes to
> expect. For example, using a factor of 3.0 means the current allocation rate can be expected
> to triple at any time."*

## Memory return, large pages, and the cases where ZGC is the wrong answer

Uncommitting unused memory (and the common flag pairing that silently switches it off), large
pages and the benchmarking trap they create, a man-page default that disagrees with the source,
and the five situations in which ZGC is the wrong collector are
[04c2 · ZGC memory return, and when not to use it](04c2-zgc-memory-and-when-not-to.md).

## Gotchas

**★ The "ZGC RSS is 3× the heap" rule is obsolete on JDK 25.**
Multi-mapped memory belonged to non-generational ZGC, which was removed in JDK 24. JEP 439:
generational ZGC *"instead uses explicit code in the load and store barriers"*, and the stated
user-visible benefit is that heap usage is now measurable normally. Any alert threshold or
capacity model still tripling ZGC's heap is wrong.

**★ ZGC cannot use compressed oops.**
Coloured pointers need all 64 bits. Below the 32 GB compressed-oop boundary this is a real and
often decisive footprint regression against G1, worst on reference-dense structures.

**★ An allocation stall is invisible in every pause metric.**
It is not a stop-the-world pause, so `jvm.gc.pause`, pause histograms and collection counts all
miss it. The two things that see it are the GC cause `Allocation Stall` and the JFR event
`jdk.ZAllocationStall`, described as *"Time spent waiting for memory to become available"* with
a thread and a stack trace attached.

**★ ZGC needs headroom and the documentation will not tell you how much.**
*"How much headroom is needed very much depends on the allocation rate and the live-set size."*
The requirement is allocation rate times cycle duration. That makes ZGC a poor fit for a
tightly-sized container, because a concurrent collector cannot respond to running out of room
by pausing longer — it responds by stalling threads.

**★ `-XX:SoftMaxHeapSize` is the flag that makes ZGC container-friendly and almost nobody sets
it.**
It gives ZGC a target to aim at while leaving `-Xmx` as an emergency reserve. That is exactly
the shape of a Kubernetes memory limit, and it is the difference between a service that
occasionally exceeds its target and one that is OOMKilled.

**★ What does ZGC cost, concretely?**
Four things. CPU: every reference read runs a load barrier and every reference store runs a
store barrier, and the concurrent marking and relocation threads compete with the application
for cores — the tuning guide's own summary is *"max pause times under a millisecond, but at the
cost of some throughput"*. Footprint: coloured pointers require full 64-bit references, so
compressed oops are unavailable and every reference below the 32 GB boundary doubles relative
to G1. Headroom: a concurrent collector must be able to service allocations while it runs, and
the guide declines to give a number because it depends on allocation rate and live-set size.
And when CPU or headroom is underpaid, allocation stalls — the collector delays the allocating
thread rather than pausing the world, which is invisible in every pause-based metric.

**★ Someone says "ZGC uses three times the memory, look at `ps`". What do you say?**
That they are describing a collector that no longer exists. Non-generational ZGC used
multi-mapped memory to make load barriers cheaper, mapping the same heap into three virtual
address ranges, and JEP 439 notes that this made *"the heap usage reported by tools such as
`ps`… around triple the amount of memory actually used"*. Generational ZGC replaced
multi-mapping with explicit barrier code, and JEP 439 lists easier memory measurement as the
main user-visible benefit of doing so. Since generational ZGC has been the only ZGC since
JDK 24, on JDK 25 the multiplier is gone. ZGC does still use more memory than G1 for a real
reason — no compressed oops, plus the headroom a concurrent collector needs — but not that one.

**★ How would you detect an allocation stall in production?**
JFR, because nothing else sees it. `jdk.ZAllocationStall` is defined as *"Time spent waiting
for memory to become available"* with the stalling thread and a stack trace, which tells you
both how long and where. The secondary signal is in the GC log: the cause `Allocation Stall`
means a collection was triggered because a thread was already waiting, so its presence is
already a failure. What will not show it is any pause-derived metric — `jvm.gc.pause`, pause
histograms, collection counts — because a stall is not a stop-the-world pause. The remedy is
more heap headroom, a lower `SoftMaxHeapSize` target so the collector starts earlier, more CPU
for the concurrent threads, or a higher `ZAllocationSpikeTolerance` if the workload is bursty.

{/* FOOTER */}
