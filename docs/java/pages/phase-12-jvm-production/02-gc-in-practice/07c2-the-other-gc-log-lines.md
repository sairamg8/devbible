---
title: "Four more tags carry the answers the summary line cannot: `gc+cpu` distinguishes a slow collector from a starved machine, `gc+heap` prints region counts in two inconsistent formats, the shutdown summary reveals G1's region size, and ZGC's line is a different shape in four separate ways"
sidebar_label: "07c2 · The other GC log lines"
sidebar_position: 30
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the JDK 25 HotSpot sources at tag `jdk-25+36` —
> [`gc/shared/gcTraceTime.cpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/gc/shared/gcTraceTime.cpp)
> for the `gc+cpu` format string,
> [`gc/g1/g1HeapTransition.cpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/gc/g1/g1HeapTransition.cpp)
> for the region summary's two call sites,
> [`gc/z/zStat.cpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/gc/z/zStat.cpp)
> and [`gc/z/zGlobals.cpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/gc/z/zGlobals.cpp)
> for ZGC's line and `ZName`, and
> [`memory/universe.cpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/memory/universe.cpp)
> for the startup banner; and the **HotSpot Virtual Machine Garbage Collection Tuning Guide,
> Release 25** — "Unusual System or Real-Time Usage" and "Observing Full Garbage Collections"
> ([g1-tuning](https://docs.oracle.com/en/java/javase/25/gctuning/garbage-first-garbage-collector-tuning.html))
> and "Class Metadata"
> ([other-considerations](https://docs.oracle.com/en/java/javase/25/gctuning/other-considerations.html)),
> whose example output is quoted **verbatim from the guide**.
> 🔴 **No log output on this page was produced by running anything** — every example is a format
> string from the JDK source or a line quoted from Oracle's documentation.
> JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9.

**[07c](07c-reading-a-gc-log.md) covered the one line per collection that `-Xlog:gc` produces.
This page is the four other lines worth knowing by sight, and each of them answers a question
the summary line cannot: was the machine starved, is the young generation being resized, what
is the humongous count, what region size did ergonomics pick, and which collector is this
anyway.**

## `gc+cpu`: user, system, real

```cpp
log_info(gc, cpu)("User=%3.2fs Sys=%3.2fs Real=%3.2fs", user_time, system_time, real_time);
```

The tuning guide's own example, quoted verbatim: *"An example for such output is
`User=0.19s Sys=0.00s Real=0.01s`."* And its reading:

> *"For every garbage collection pause, the `gc+cpu=info` log output contains a line including
> information from the operating system with a breakdown about where during the pause-time has
> been spent."*
>
> *"User time is time spent in VM code, system time is the time spent in the operating system,
> and real time is the amount of absolute time passed during the pause. If the system time is
> relatively high, then most often the environment is the cause."*
>
> *"Another situation to look out for is real time being a lot larger than the sum of the others
> this may indicate that the VM did not get enough CPU time on a possibly overloaded machine."*

Three readings, three different investigations:

| Pattern | Meaning | Where to go |
|---|---|---|
| `User` ≫ `Real` | healthy parallel collection on several threads | nothing to do |
| `Real` ≫ `User + Sys` | CPU starvation — the threads were runnable, not scheduled | CPU quota, noisy neighbours, throttling |
| `Sys` high | the environment: heap resizing, THP coalescing, or the log write | `-Xms` = `-Xmx`, `AlwaysPreTouch`, disable THP, `-Xlog:async` |

The guide names all three environmental causes of high system time, and the third is the one
nobody expects: *"Writing the log output may stall for some time because of some background task
intermittently taking up all I/O bandwidth for the hard disk the log is written to."* The GC log
can be the pause. [07d · Rotating and shipping GC logs](07d-rotating-and-shipping-gc-logs.md).

## `gc+heap`: the region summary

`g1HeapTransition.cpp`, and note that there are two different call sites:

```cpp
    ls.print("%s regions: %zu->%zu(%zu)", msg, before_length, after_length, capacity);
    ...
  log_info(gc, heap)("Old regions: %zu->%zu", _before._old_length, after._old_length);
  log_info(gc, heap)("Humongous regions: %zu->%zu",
                     _before._humongous_length, after._humongous_length);
```

⚠️ **Eden and Survivor print three numbers; Old and Humongous print two.** Eden's third value is
the target capacity in regions for the *next* mutator phase, which is how you watch G1 resizing
the young generation. Old and Humongous have no such target, so they get before-and-after only.
A parser written against the Eden line mis-reads the Humongous one — and the Humongous count is
the number you most need. The guide's own instruction:

> *"You can determine the number of regions occupied by humongous objects on the Java heap using
> the `gc+heap=info` logging. Y in the lines `Humongous regions: X->Y` give you the amount of
> regions occupied by humongous objects."*

At `trace` level each of the four is followed by a `Used:`/`Waste:` pair; Eden's is hard-coded to
`" Used: 0K, Waste: 0K"` because after a collection eden is empty by construction. The `Waste:`
figure for Humongous is the wasted tail of each object's last region — the loss described in
[03d · Humongous allocations](03d-humongous-allocations.md), made numeric.

This is also the tag that answers the throughput question in
[03c3](03c3-tuning-g1-for-throughput.md): *"the combined percentage of Eden regions and Survivor
regions is close to `-XX:G1MaxNewSizePercent` percent of the total number of regions"* means the
young generation is being capped rather than sized.

## `gc,heap,exit`: the shutdown summary

The tuning guide's "Class Metadata" section prints this, **verbatim from the guide** and
described there as *"typical output"*:

```
[0,296s][info][gc,heap,exit] Heap
[0,296s][info][gc,heap,exit] garbage-first heap total 514048K, used 0K [0x00000005ca600000, 0x00000005ca8007d8, 0x00000007c0000000)
[0,296s][info][gc,heap,exit] region size 2048K, 1 young (2048K), 0 survivors (0K)
[0,296s][info][gc,heap,exit] Metaspace used 2575K, capacity 4480K, committed 4480K, reserved 1056768K
[0,296s][info][gc,heap,exit] class space used 238K, capacity 384K, committed 384K, reserved 1048576K
```

Three things worth extracting.

**`region size 2048K` is where you read G1's chosen region size**, which determines the humongous
threshold. The guide also notes that *"the currently selected heap region size is printed at the
beginning of the log"*, so you have two chances to see it.

**The Metaspace line's four values are defined by the guide**: *"the `used` value is the amount of
space used for loaded classes. The `capacity` value is the space available for metadata in
currently allocated chunks. The `committed` value is the amount of space available for chunks.
The `reserved` value is the amount of space reserved (but not necessarily committed) for
metadata."* Note `reserved=1048576K` on the class space line: that is the 1 GB
`CompressedClassSpaceSize` default, reserved but not committed — the distinction that
[01 · Memory layout → 01f](../01-memory-layout/01f-reserved-committed-and-resident.md) is about.

**This output appears at JVM exit**, which is exactly when a crash-looping container is producing
it and nobody is capturing it. If the process is killed by SIGKILL — an OOMKill — there is no exit
and no summary.

## ZGC's line is a different shape entirely

From `zStat.cpp`:

```cpp
#define ZSIZE_FMT  "%zuM(%.0f%%)"

log_info(gc)("%s (%s) " ZSIZE_FMT "->" ZSIZE_FMT " %.3fs", ...);
```

Four differences from G1, each of which breaks a habit: the titles are `Minor Collection` and
`Major Collection`; the heap figures carry a percentage; the duration is **seconds**; and it is
a whole mostly-concurrent **cycle**, not a pause. Full treatment in
[04b · Relocation and the ZGC log](04b-zgc-relocation-and-the-log.md).

## The first line: which collector

```cpp
log_info(gc)("Using %s", _collectedHeap->name());
```

`Using Serial`, `Using Parallel`, `Using G1`, `Using Epsilon` — and `Using The Z Garbage
Collector`, because `ZName` is defined in `zGlobals.cpp` as a full sentence where every other
collector's `name()` returns one word. [02 · The four collectors](02-the-four-collectors.md).

This line is worth putting in a fleet-wide check. Collector selection is ergonomic and per
process, so two pods of the same image with different CPU limits can be running different
collectors, and nothing else in the logs would say so.

## Gotchas

**★ Eden and Survivor region lines have three numbers; Old and Humongous have two.**
Two different call sites in `g1HeapTransition.cpp`. The Humongous count — the one that matters
for [03d2](03d2-humongous-fragmentation.md) — is on the two-number form, so a parser written
against the Eden line silently mis-reads it.

**★ The third number on the Eden line is a *target*, not a measurement.**
It is the capacity in regions G1 has chosen for the next mutator phase. Watching it move is
watching G1's pause-time control loop work; treating it as "how much eden there was" is wrong.

**★ `%.3fms` under G1 versus `%.3fs` under ZGC.**
Same position on the line, different unit, and different meaning — pause versus cycle. Any
dashboard that ingests both collectors' logs through one regex is wrong by three orders of
magnitude on half its data.

**★ `Real` greatly exceeding `User + Sys` is the environment, not the collector.**
It is the tuning guide's own diagnostic for *"the VM did not get enough CPU time on a possibly
overloaded machine"*. No GC flag fixes it. Enable `gc+cpu=info` before changing any GC option.

**★ High `Sys` time can be the GC log's own write.**
The guide lists it as one of three environmental causes, alongside heap resizing and transparent
huge pages: *"Writing the log output may stall for some time because of some background task
intermittently taking up all I/O bandwidth."* Diagnosing a GC problem from a log that is causing
the GC problem is a real failure mode, and `-Xlog:async` is the fix.

**★ The region size is printed once, at the start of the log, and it determines the humongous
threshold.**
`region size 2048K` in the `gc,heap,exit` summary, and the same figure at startup. Everything in
[03d · Humongous allocations](03d-humongous-allocations.md) depends on it, and it is derived
from `-Xmx` rather than chosen.

**★ The `gc,heap,exit` summary is only printed on a clean exit.**
A container killed by the kernel's OOM killer receives SIGKILL and never runs shutdown, so the
one place that summarises the heap and metaspace is missing precisely when you most want it.
`jcmd GC.heap_info` while the process is alive is the substitute.

**★ `reserved` on the class space line is the 1 GB `CompressedClassSpaceSize` default.**
It is address space, not memory. Alerting on it, or including it in a container memory
calculation, produces a number a gigabyte too large.

**★ The startup collector line is worth checking fleet-wide.**
Collector selection is ergonomic and per process. Two pods of the same image with different
resource limits can be running G1 and Serial respectively, and only this line says so.

**★ `Waste:` at trace level is the humongous tail loss, quantified.**
Each region-summary line at `gc+heap=trace` carries `Used:` and `Waste:`. For the Humongous
line, `Waste:` is the unusable tail of every humongous object's last region — the cost described
abstractly in [03d](03d-humongous-allocations.md), as an actual number.

## Interview questions

**★ How would you tell from a GC log that the machine was CPU-starved rather than the collector
being slow?**
`-Xlog:gc+cpu=info`, which prints `User=…s Sys=…s Real=…s` per collection. Healthy parallel
collection has user time well above real time, because several threads ran concurrently. The
tuning guide's diagnostic is the opposite pattern: *"real time being a lot larger than the sum
of the others … may indicate that the VM did not get enough CPU time on a possibly overloaded
machine"*. High system time points somewhere else again — heap resizing, transparent huge pages,
or a stalled write of the log file itself. None of the three is fixed by a GC flag, which is why
this is one of the first tags to enable rather than one of the last.

**★ You are writing a GC log parser. What will break it?**
Four things, all documented. The platform locale: Oracle's own examples print `[9,740s]` and
`6,108ms`, so the decimal separator is not always a dot. The two-line-per-collection shape at
debug level, since `log_start` and `log_end` both print the title and cause. The inconsistency
between region summary lines — Eden and Survivor carry a third parenthesised value, Old and
Humongous do not. And the collector: ZGC's line uses different titles, adds a percentage to each
heap figure, and prints seconds rather than milliseconds for something that is a cycle rather
than a pause. A parser written against a G1 log on an English-locale machine will mis-read a
ZGC log on a European one in four separate ways.

**★ Where do you read G1's region size, and why does it matter?**
From the log: the region size is printed at the beginning of the log and again in the
`gc,heap,exit` summary as a line like `region size 2048K`. It matters because it is not
configured, it is derived — ergonomics targets roughly 2048 regions from `-Xmx`, rounded to a
power of two — and because the humongous threshold is exactly half of it. So the region size
tells you which of your application's objects bypass eden and go straight into the old
generation as unmovable runs of whole regions. Changing `-Xmx` changes the region size, which
changes the threshold, which can reclassify a whole category of buffers without any code change.

**★ What can `gc+heap=info` tell you that `gc` cannot?**
Where the heap went, by generation, in regions rather than megabytes. Three specific answers.
Whether humongous allocation is a problem — the `Humongous regions: X->Y` line is the count the
tuning guide tells you to compare against the old-region count. Whether the young generation is
being capped rather than sized — if Eden plus Survivor regions sit near `G1MaxNewSizePercent` of
the total, that flag is the throughput constraint. And whether the young generation is being
resized at all, since Eden's third number is G1's target for the next mutator phase and watching
it move is watching the pause-time control loop work. None of that is derivable from the
whole-heap before-and-after figures on the summary line.

**★ Why might the `gc,heap,exit` summary be missing from a container's logs exactly when you
need it?**
Because it is emitted during JVM shutdown, and a container killed by the kernel OOM killer gets
SIGKILL, which cannot be handled — the process is gone without running any shutdown code. So the
one output that summarises the heap layout, the region size, metaspace and class space is
absent from precisely the failure people most want to investigate. The substitutes are
`jcmd <pid> GC.heap_info` and `jcmd <pid> VM.metaspace` taken while the process is alive, or a
periodic collection of them, which is the argument for capturing this state proactively rather
than hoping for a graceful exit. The OOMKilled-versus-`OutOfMemoryError` distinction itself is
[01 · Memory layout → 01b](../01-memory-layout/01b-oom-error-versus-oomkilled.md).

{/* FOOTER */}
