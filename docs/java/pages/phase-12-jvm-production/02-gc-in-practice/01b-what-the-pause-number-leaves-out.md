---
title: "The number at the end of a GC log line is the duration of one VM operation, and a service can be crippled by garbage collection while every one of those numbers looks fine — because CPU contention, safepoint arrival and non-GC stop-the-world operations are all outside it"
sidebar_label: "01b · What the pause number leaves out"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **HotSpot Virtual Machine Garbage Collection Tuning Guide,
> Release 25** — "Introduction to Garbage Collection Tuning", "Garbage-First (G1) Garbage
> Collector" (Table 7-1, Ergonomic Defaults) and "Garbage-First Garbage Collector Tuning"
> ("Unusual System or Real-Time Usage")
> ([introduction](https://docs.oracle.com/en/java/javase/25/gctuning/introduction-garbage-collection-tuning.html),
> [g1](https://docs.oracle.com/en/java/javase/25/gctuning/garbage-first-g1-garbage-collector1.html),
> [g1-tuning](https://docs.oracle.com/en/java/javase/25/gctuning/garbage-first-garbage-collector-tuning.html)),
> the **JDK 25 `java` tool reference** for `-XX:ParallelGCThreads` and `-XX:ConcGCThreads`
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html)),
> and the JDK 25 HotSpot sources at tag `jdk-25+36` —
> [`gc/shared/gc_globals.hpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/gc/shared/gc_globals.hpp)
> for `ParallelGCThreads`, `ConcGCThreads` and `HeapSizePerGCThread`, and
> [`gc/shared/gcTraceTime.cpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/gc/shared/gcTraceTime.cpp)
> for the `gc+cpu` log format string.
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**[01](01-what-a-collector-actually-promises.md) gave you three axes and two flags for
stating a preference. This page is the part the flags do not cover: the CPU a concurrent
collector takes from the application, the reason a 1%-of-wall-time pause figure costs 20% of
a 32-core machine's throughput, and the three distinct stalls that a healthy-looking GC log
cannot show you. Almost every "our GC log looks fine but latency is terrible" incident is
one of the things on this page.**

## The fourth axis nobody puts on the chart: CPU

Concurrent collectors do not make GC work disappear. They move it off the pause and onto
cores that the application would otherwise have had. The G1 chapter says so plainly:

> *"G1 performs parts of its work at the same time as the application runs. It trades
> processor resources which would otherwise be available to the application for shorter
> collection pauses."*
>
> *"This is most visible in the use of one or more garbage collection threads active while
> the application runs. Thus, compared to throughput collectors, while garbage collection
> pauses are typically much shorter with the G1 collector, application throughput also tends
> to be slightly lower."*

This is the fact that makes "just switch to ZGC" wrong in a container with a 1-CPU limit.
There are no spare cores there; a concurrent collector's work lands on the same quota the
request handlers are using, and the p99 you were trying to fix gets worse. The cost side of
that trade is [04b · What ZGC costs](04c-zgc-costs.md); the sizing side is
[03 · Heap sizing in containers](../03-heap-sizing-in-containers/README.md).

## How many threads is "concurrent", exactly

Both thread counts ship as `0`, meaning *decide ergonomically*:

```cpp
product(uint, ParallelGCThreads, 0,
        "Number of parallel threads parallel gc will use")
        range(0, INT_MAX)

product(uint, ConcGCThreads, 0,
        "Number of threads concurrent gc will use")

product(size_t, HeapSizePerGCThread, ScaleForWordSize(32*M),
        "Size of heap (bytes) per GC thread used in calculating the "
        "number of GC threads")
```

G1's Table 7-1 spells out the derivation:

> *"`-XX:ParallelGCThreads=<ergo>` — The maximum number of threads used for parallel work
> during garbage collection pauses. This is derived from the number of available threads of
> the computer that the VM runs on in the following way: if the number of CPU threads
> available to the process is fewer than or equal to 8, use that. Otherwise add five eighths
> of the threads greater than to the final number of threads."*
>
> *"At the start of every pause, the maximum number of threads used is further constrained by
> maximum total heap size: G1 will not use more than one thread per
> `-XX:HeapSizePerGCThread` amount of Java heap capacity."*
>
> *"`-XX:ConcGCThreads=<ergo>` — The maximum number of threads used for concurrent marking
> work. By default, this value is `-XX:ParallelGCThreads` divided by 4."*

Two things follow that matter more than the arithmetic.

**The count is derived from CPUs available to the process, not to the host.** On a modern
JDK in a container that is the cgroup CPU quota, so a pod with `limits.cpu: 2` gets a small
number of GC threads whether the node has 8 cores or 96. That is usually correct. It stops
being correct the moment someone sets a large `-Xmx` on a small CPU allocation, because then
the *heap* is big enough to need many GC threads and the *quota* will not give them any
time.

**`ConcGCThreads` is a quarter of `ParallelGCThreads`, and `ParallelGCThreads` is at most
the CPU count.** With two CPUs available, `ParallelGCThreads` is 2 and `ConcGCThreads`
rounds to 1. One concurrent marking thread on a heap that is filling quickly is the exact
setup that produces a G1 Full GC — concurrent marking cannot finish before the old
generation fills. The tuning guide's remedy for observing Full GCs includes *"Increase the
number of concurrent marking threads by setting `-XX:ConcGCThreads` explicitly"*, which on a
CPU-starved container is advice you cannot take. See
[03d · When G1 goes wrong](03e-g1-when-it-goes-wrong.md).

## `gc+cpu` is the tag that proves it

Every collection emits a CPU-time breakdown when `-Xlog:gc+cpu=info` is on. The format string
in `gcTraceTime.cpp` is:

```cpp
log_info(gc, cpu)("User=%3.2fs Sys=%3.2fs Real=%3.2fs", user_time, system_time, real_time);
```

and the tuning guide gives the reading:

> *"User time is time spent in VM code, system time is the time spent in the operating
> system, and real time is the amount of absolute time passed during the pause. If the
> system time is relatively high, then most often the environment is the cause."*
>
> *"Another situation to look out for is real time being a lot larger than the sum of the
> others this may indicate that the VM did not get enough CPU time on a possibly overloaded
> machine."*

That last sentence is the single highest-value line in the whole tuning guide for container
work. **`Real` much greater than `User + Sys` means the GC threads were runnable and not
scheduled.** The collector did a small amount of work over a long wall-clock interval. No
amount of GC tuning fixes that; the fix is CPU, or fewer neighbours, or a lower CPU
throttling ratio.

The guide also lists the environmental causes of a high `Sys`:

> *"The VM allocating or giving back memory from the operating system memory may cause
> unnecessary delays. Avoid the delays by setting minimum and maximum heap sizes to the same
> value using the options `-Xms` and `-Xmx`, and pre-touching all memory using
> `-XX:+AlwaysPreTouch`."*
>
> *"Particularly in Linux, coalescing of small pages into huge pages by the Transparent Huge
> Pages (THP) feature tends to stall random processes, not just during a pause."*
>
> *"Writing the log output may stall for some time because of some background task
> intermittently taking up all I/O bandwidth for the hard disk the log is written to."*

The third one deserves emphasis: **the GC log can itself be the pause.** Logging is
synchronous by default, so a `write()` that blocks on a saturated disk blocks the VM thread
inside the safepoint. `-Xlog:async` exists for exactly this, and it is
[07c · Rotating and shipping GC logs](07c-rotating-and-shipping-gc-logs.md).

## Why any of this matters at all: Amdahl

The introduction chapter's argument for why a percentage-of-time figure understates the
damage:

> *"Amdahl's law (parallel speedup in a given problem is limited by the sequential portion
> of the problem) implies that most workloads can't be perfectly parallelized; some portion
> is always sequential and doesn't benefit from parallelism. … The red line is an
> application spending only 1% of the time in garbage collection on a uniprocessor system.
> This translates to more than a 20% loss in throughput on systems with 32 processors. The
> magenta line shows that for an application at 10% of the time in garbage collection … more
> than 75% of throughput is lost when scaling up to 32 processors."*

A stop-the-world pause is the sequential portion. Its cost is not "1% of the machine"; it is
1% of *every core*, because during it no core is doing application work. That asymmetry —
small percentage, large throughput loss on a big machine — is the reason concurrent
collectors exist at all, and it is why the same GC configuration that was fine on a 4-core
VM can be a visible regression after a move to a 64-core node.

## "Not a real-time collector"

The single most important sentence for anyone about to promise an SLA on a pause figure:

> *"The Garbage-First collector is not a real-time collector. It tries to meet set pause-time
> targets with high probability over a longer time, but not always with absolute certainty
> for a given pause."*

ZGC's documentation is more confident — *"ZGC performs all expensive work concurrently,
without stopping the execution of application threads for more than a millisecond"* — but it
is a statement about *pauses*, and pauses are not the only way a collector adds latency. ZGC
can stall an allocating thread when it cannot reclaim memory fast enough; that stall does
not appear as a pause anywhere, and it is [04b](04c-zgc-costs.md).

## The three stalls a healthy GC log cannot show you

**1 · Time to safepoint.** The duration printed at the end of a `-Xlog:gc` line is the
duration of the VM operation. It does not include the time the JVM spent waiting for the
last application thread to arrive at a safepoint. A thread in a long counted loop, or
blocked in a JNI critical section, extends the real application stall without extending the
GC number. `-Xlog:safepoint` prints it as a separate field called `Reaching safepoint`, and
that is [10 · Safepoints](10-safepoints.md).

**2 · Non-GC safepoints.** Deoptimisation, class redefinition, `Thread.print`, heap
inspection, revoking of stale metadata and a long list of other VM operations stop the world
without producing a single line under the `gc` tag. A profiler or an APM agent that takes a
thread dump every ten seconds is stopping your application every ten seconds, and no amount
of reading the GC log will reveal it.

**3 · Concurrent-phase CPU contention.** Covered above: the collector is running, the
application is running, and they are fighting over the same quota. The application threads
are not stopped — they are just slower, uniformly, for the duration of a marking cycle. This
shows up as a periodic latency bulge whose period matches the concurrent cycle, and it is
invisible in any metric derived only from pause durations, including Micrometer's
`jvm.gc.pause`.

## Gotchas

**★ A concurrent collector does not reduce GC work; it relocates it onto your cores.**
On a machine with spare CPU that is a free win. On a container with `cpu: "1"` it is a
straight subtraction from the application's quota, and the observable result of "switching to
a low-latency collector" is higher latency.

**★ `Real` much greater than `User + Sys` in `gc+cpu` is a scheduling problem, not a GC problem.**
The tuning guide names it: *"real time being a lot larger than the sum of the others … may
indicate that the VM did not get enough CPU time on a possibly overloaded machine."* Every
hour spent tuning collector flags in that state is wasted. Enable `-Xlog:gc+cpu=info` before
you change a single GC option.

**★ `ConcGCThreads` defaults to a quarter of `ParallelGCThreads`, which is capped by your CPU quota.**
On a 2-CPU container that is one concurrent marking thread. Concurrent marking that cannot
keep up with the allocation rate is the direct cause of G1 Full GCs, and the documented
remedy — raise `ConcGCThreads` — is the one you cannot afford on that pod.

**★ The GC log write is inside the safepoint.**
Unified logging is synchronous by default. If the log's filesystem stalls, the VM stalls, and
the stall is attributed to garbage collection because that is what was running. `-Xlog:async`
moves the write to a separate thread with a bounded buffer.

**★ `jvm.gc.pause` cannot see concurrent-phase slowdown.**
Micrometer's timer records the duration of pause notifications; a concurrent marking cycle
that steals 25% of the CPU for four seconds produces no pause and no metric. If your latency
graph has a bulge whose period matches the GC cycle but whose pause metric is flat, that is
what you are looking at.

**★ Non-GC safepoints do not appear under the `gc` tag at all.**
A ten-second thread-dump loop from an APM agent, JVMTI class retransformation, or a
`GC.class_histogram` from a well-meaning colleague all stop the world. Only
`-Xlog:safepoint` sees them; the GC log is silent.

**★ Setting a large `-Xmx` on a small CPU allocation is a specific misconfiguration, not just
generous.**
The GC thread count is bounded by CPUs available to the process; the *work* is bounded by
heap size. A 12 GB heap on a 1-CPU pod gives one or two GC threads a large live set to walk,
which turns every collection into a long one. Heap and CPU have to be sized together.

**★ "The GC log looks clean" is not evidence that GC is not the problem.**
It is evidence that no VM operation ran long. It says nothing about time-to-safepoint,
nothing about non-GC safepoints, and nothing about CPU contention during concurrent phases.
Three of the most common GC-caused latency incidents are invisible in a clean `-Xlog:gc`.

## Interview questions

**★ Why does a stop-the-world pause hurt more on a 32-core machine than a 1-core machine?**
Because the pause is the sequential fraction of the workload in Amdahl's law. During it,
every core is idle with respect to application work, so a pause that costs 1% of wall time
costs 1% of the *whole machine's* capacity, and the throughput lost scales with the core
count. The tuning guide models this: 1% of time in GC on a uniprocessor becomes *"more than
a 20% loss in throughput on systems with 32 processors"*, and 10% becomes more than 75%. It
is the strongest single argument for moving GC work off the pause and onto concurrent
threads — and the reason a configuration that was fine on a small VM can regress badly after
a move to bigger nodes.

**★ Your p99 latency is 400 ms and the GC log shows no pause longer than 30 ms. Where do you
look next?**
Three places, in order. First, time-to-safepoint: the GC log's duration excludes the time
spent bringing threads to a safepoint, and `-Xlog:safepoint` prints "Reaching safepoint"
separately. Second, non-GC safepoints — deoptimisation, thread dumps, heap inspections and
class retransformation all stop the world without appearing under the `gc` tag at all.
Third, non-pause GC effects: concurrent GC threads competing for CPU, visible as `Real`
greatly exceeding `User + Sys` in `gc+cpu`, or under ZGC an allocation stall, which delays a
thread without stopping the world. Only after all three would I look outside the JVM.

**★ How many garbage collection threads will G1 use, and why does the answer matter in
Kubernetes?**
`ParallelGCThreads` — the stop-the-world workers — is ergonomic: the CPU thread count if
that is 8 or fewer, otherwise 8 plus five eighths of the excess, further capped at one thread
per `HeapSizePerGCThread` of heap capacity. `ConcGCThreads` — the concurrent markers — is a
quarter of that. In Kubernetes the CPU thread count is the cgroup quota, so a 2-CPU pod gets
about two pause workers and one marking thread regardless of node size. That is fine until
someone raises `-Xmx` without raising the CPU request: the work grows with heap and the
workers do not, so pauses lengthen and concurrent marking starts losing races against the
allocation rate.

**★ What does `-Xlog:gc+cpu=info` tell you that `-Xlog:gc` does not?**
It breaks each collection into user, system and real time. High system time points at the
environment — heap resizing, transparent huge pages, or the log write itself — rather than at
the collector. Real time much greater than user plus system means the GC threads were
runnable but not scheduled, which is CPU starvation and is not fixable by any GC flag. And
when user time is many times real time, the collection genuinely parallelised, which is the
healthy case. It is one extra tag and it changes the diagnosis more often than any other.

**★ Why can a service with a perfectly clean GC log still be having a garbage collection
problem?**
Because the GC log records the duration of VM operations, and an application stall has three
other components. Time to safepoint is charged to the application but printed only under the
`safepoint` tag. Stop-the-world operations that are not collections — dumps, deoptimisation,
JVMTI work — are printed under other tags or not at all. And concurrent GC phases do not stop
anything; they take CPU, so the application runs uniformly slower for the length of a cycle
with no pause recorded anywhere. Diagnosing GC from `-Xlog:gc` alone is reading one of four
relevant instruments.

{/* FOOTER */}
