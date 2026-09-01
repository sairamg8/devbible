---
title: "Sizing a container is a subtraction, not a percentage: everything that is not heap has to fit in what the percentage left, and three of the largest terms in that sum have no default limit at all"
sidebar_label: "04 · The memory budget"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **JDK 25 `java` tool reference** — `-Xss`,
> `-XX:ReservedCodeCacheSize`, `-XX:MaxMetaspaceSize`, `-XX:MaxDirectMemorySize`,
> `-XX:NativeMemoryTracking`
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html)); the
> **JDK 25 Troubleshooting Guide**, "Native Memory Tracking"
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/troubleshoot/diagnostic-tools.html));
> and the JDK 25 HotSpot source at tag `jdk-25+36` for `MaxMetaspaceSize` and
> `CompressedClassSpaceSize`
> ([`globals.hpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/runtime/globals.hpp)).
> Every figure below is either quoted from those sources or arithmetic performed here and
> labelled as such. Nothing was measured.
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**`MaxRAMPercentage=70` is not a decision, it is the *result* of a decision you have not made
yet. The decision is: what is the other 30 percent for, and is 30 percent enough for it? That
question has a definite answer for any given service, arrived at by enumerating the non-heap
regions, bounding the ones that can be bounded, measuring the ones that cannot, and subtracting.
This page is that enumeration and that subtraction.**

## The inequality

```
container memory limit
    ≥  Java heap                       -Xmx / MaxRAMPercentage
     + metaspace                       UNBOUNDED by default
     + compressed class space          1 GB reserved, not in the man page
     + code cache                      240 MB reserved under tiered compilation
     + thread stacks                   -Xss × platform thread count
     + GC metadata                     scales with heap size and collector
     + direct byte buffers             defaults to -Xmx  (a SECOND copy)
     + memory-mapped buffers           BOUNDED BY NOTHING
     + JVM internal + symbols + NMT    small but not zero
     + native allocator slack          glibc arenas, never returned
     + anything else in the container  agents, sidecars, shells, page cache
```

Three of those lines are unbounded or surprising enough to be the reason most sizing exercises
fail, and they get their own treatment:
[04b · The direct-memory doubling](04b-the-direct-memory-doubling.md).

## What each term costs, and who sets it

| Region | Default bound | Where it is taught |
|---|---|---|
| Heap | `MaxRAMPercentage`, 25% | [03](03-maxrampercentage.md) |
| Metaspace | **none** — *"By default, the size isn't limited"* | [04b · The metaspace flags](../01-memory-layout/04b-the-metaspace-flags.md) |
| Compressed class space | 1 GB **reserved** (`CompressedClassSpaceSize`) | [04b](../01-memory-layout/04b-the-metaspace-flags.md) |
| Code cache | 240 MB reserved (48 MB with `-XX:-TieredCompilation`) | [05 · The code cache](../01-memory-layout/05-the-code-cache.md) |
| Thread stacks | 1024 KB (Linux/x64) or **2048 KB (Linux/AArch64)** per platform thread | [06d](../01-memory-layout/06d-the-thread-count-arithmetic.md) |
| Direct buffers | **equal to `-Xmx`** | [04b](04b-the-direct-memory-doubling.md) |
| Mapped buffers | **none at all** | [07c · Mapped buffers](../01-memory-layout/07c-mapped-buffers.md) |
| GC structures | collector-dependent | [11 · NMT](../01-memory-layout/11-native-memory-tracking.md) |
| Allocator slack | `MALLOC_ARENA_MAX` | [11c](../01-memory-layout/11c-the-footprint-that-is-not-in-any-region.md) |

The pattern in that table is the whole lesson: **the regions you cannot bound are the ones you
have to measure, and the regions you can bound are the ones you should bound** — not because the
bound will be hit, but because hitting a JVM limit produces a diagnosable `OutOfMemoryError` while
hitting the cgroup limit produces a 137 with no evidence.

## Reserved is not resident, and the difference is most of the table

The 240 MB code cache is reserved address space, committed as methods are compiled. A 2048 KB
thread stack is reserved address space, resident only for the pages actually touched — typically
a small fraction. `CompressedClassSpaceSize` reserves 1 GB and commits a few tens of megabytes.
If you add up the *reservations* in the table above you will conclude that no JVM can fit in
2 GiB, which is obviously false.

The rule: **budget against committed, not reserved, but remember that committed only ever goes
up** for the code cache and metaspace, and that a thread stack's touched pages stay touched. The
three numbers and how to read each is
[01f · Reserved, committed and resident](../01-memory-layout/01f-reserved-committed-and-resident.md).

## A worked subtraction

Take a 2 GiB (2048 MiB) container running an ordinary Spring Boot service. **The following is
arithmetic over documented defaults and stated assumptions. It is not a measurement, and it is
not a recommendation for your service — it is the shape of the calculation.**

Assumptions, each of which you would replace with your own measurement:

- 250 platform threads (the buildpack default assumption, and roughly a 200-thread Tomcat pool
  plus framework and JDK threads), on Linux/x64 with the default 1024 KB `-Xss`
- a committed metaspace of about 150 MiB, consistent with a large Boot application
- a committed code cache well below the 240 MiB reservation, call it 100 MiB warm
- direct-buffer usage of about 50 MiB, from the servlet container and the HTTP client
- GC and JVM internal structures of about 100 MiB

Committed non-heap, as arithmetic:

```
thread stacks (touched, not reserved) :  250 ×  ~256 KiB  ≈   64 MiB
metaspace + class space (committed)   :                       150 MiB
code cache (committed, warm)          :                       100 MiB
direct buffers (in use)               :                        50 MiB
GC structures + JVM internal          :                       100 MiB
allocator slack                       :                        50 MiB
                                                              -------
                                                              514 MiB
```

2048 − 514 = 1534 MiB, which is 74.9 percent of the limit. Take a margin for growth in metaspace
and the code cache and for the peak rather than the average, and **70 percent is the answer for
this set of assumptions** — 1434 MiB of heap, about 100 MiB of slack.

Now change one assumption. Move the same service to Linux/AArch64, where the man page gives the
`-Xss` default as **2048 KB** rather than 1024 KB. The reserved stack per thread doubles with no
configuration change, and the touched portion tends to rise with it. That single platform
migration can move the answer by several percentage points, which is why an x64-derived
`MaxRAMPercentage` should be re-validated on Graviton or Apple silicon rather than carried over.

## Bound what you can

```bash
# a diagnosable Java error instead of a silent 137
-XX:MaxMetaspaceSize=256m
-XX:MaxDirectMemorySize=256m
-XX:ReservedCodeCacheSize=128m        # only if you have measured the warm size

# make the failure loud when it does happen
-XX:+ExitOnOutOfMemoryError
```

Every one of those converts an OOMKill into an `OutOfMemoryError` with a detail message naming
the region — the seven documented messages and the two that are real but not on the list are in
[01b](../01-memory-layout/01b-oom-error-versus-oomkilled.md), and the full inventory is
**04 · `OutOfMemoryError`** *(not written yet)*.

The one to be careful with is `ReservedCodeCacheSize`: setting it too low means the JIT stops
compiling and your service silently loses several times its throughput, which is
[05b · When the code cache fills](../01-memory-layout/05b-when-the-code-cache-fills.md).

## Gotchas

**★ Metaspace is unlimited by default, so a class leak ends in an OOMKill, not an error.**
The man page: *"Sets the maximum amount of native memory that can be allocated for class
metadata. **By default, the size isn't limited.**"* In a container that is the worst possible
default — the growth is unbounded, the cgroup is not, and the kernel wins. Capping metaspace does
not fix the leak, but it converts an unattributable 137 into
`OutOfMemoryError: Metaspace`, which names the cause.

**★ `CompressedClassSpaceSize` is 1 GB by default and is not in the man page at all.**
It is a reservation, so it does not cost 1 GB of RSS, but it is a second metaspace-like region
with its own limit and its own `OutOfMemoryError: Compressed class space` message. Capping
`MaxMetaspaceSize` does not cap it.

**★ Thread count is the term people forget, and it is the term that scales with load.**
Stacks are per platform thread and are charged whether or not the thread is doing anything. An
unbounded `Executors.newCachedThreadPool()` under a traffic spike is a memory bug, not a
concurrency bug. The arithmetic is
[06d](../01-memory-layout/06d-the-thread-count-arithmetic.md); virtual threads change the shape of
this term entirely and are [06b](../01-memory-layout/06b-virtual-thread-stacks.md).

**★ `-Xss` is 2048 KB on Linux/AArch64 and 1024 KB on Linux/x64.**
An x64-to-Graviton migration doubles reserved stack per thread with no configuration change. Any
budget carried across architectures without re-checking this line is out by
`threads × 1 MiB` of address space and a smaller but real amount of resident memory.

**★ Page cache counts against the container's working set.**
A service that writes verbose logs to a file inside the container, or reads a large local data
file, generates page cache charged to the cgroup. The JVM's anonymous footprint can be perfectly
stable while `container_memory_working_set_bytes` climbs. Logging to stdout and letting the
runtime handle it moves that charge elsewhere — **07 · Logging done right** *(not written yet)*.

**★ Everything else in the container comes out of the same budget.**
A JMX exporter, an APM agent, a `sh` wrapper, a `curl` in a liveness probe, a debug `jcmd`
you ran yourself. `jcmd` in particular starts a second JVM. Running a diagnostic inside a
tightly-sized container can be what pushes it over.

**★ NMT itself costs memory and throughput.**
The Troubleshooting Guide puts the overhead at 5 to 10 percent, and the tracking data is itself
native memory. Enable it to answer a question, then turn it off — do not budget with it on and
deploy with it off.

**★ Budgeting from a load test undercounts, usually badly.**
Committed heap rises as pages are touched over hours. The code cache fills as more methods reach
the C2 threshold, which needs sustained rather than bursty traffic. Metaspace grows as lazily
loaded classes are reached, and a load test exercises a narrow path. A ten-minute test can show
half the eventual steady-state footprint.

**★ Do not budget the *reservations*.**
Adding 240 MiB of code cache, 1 GiB of class space and 250 MiB of stacks as if they were
committed gives a total that no 2 GiB container could hold, and leads to services sized several
times larger than they need. Budget committed, and use the reservations only as the ceiling on
how bad it can get.

**★ The margin is not padding — it is the growth term.**
Metaspace and the code cache ratchet upward over a process's lifetime and are never fully
returned. A budget with zero margin is correct on day one and wrong by week three. The margin is
what makes the number survive a long-running pod.

## Interview questions

**★ How do you decide what `MaxRAMPercentage` to use for a service you have never seen?**
By subtraction, not by picking a number. Run it under representative load with
`-XX:NativeMemoryTracking=summary`, let it reach steady state over hours rather than minutes, and
read the committed totals for every category that is not `Java Heap` — metaspace and class space,
code cache, thread, GC, internal, symbol, plus the direct-buffer usage from
`BufferPoolMXBean`. Add a margin for the regions that ratchet upward, subtract the total from the
container limit, and express what is left as a percentage. Then validate by running at that
setting and watching RSS against the limit for a full deployment cycle, not a load test.

**★ Which parts of a JVM's memory can you actually put a limit on, and why would you want to?**
Heap (`-Xmx` or a percentage), metaspace (`MaxMetaspaceSize`), compressed class space
(`CompressedClassSpaceSize`), the code cache (`ReservedCodeCacheSize`), direct buffers
(`MaxDirectMemorySize`) and, indirectly, thread stacks by bounding pool sizes. You cannot bound
mapped buffers, native library allocations or allocator slack. The reason to set the bounds is
diagnostic rather than protective: a JVM limit produces an `OutOfMemoryError` whose detail message
names the region, while the cgroup limit produces `SIGKILL` and no evidence at all. You are
choosing which of two failures you get.

**★ Your budget says 30 percent for the native side and the pod is still OOMKilled. Where do you
look first?**
At whether the number I budgeted is the number the process is using, which means NMT before
anything else — baseline when warm, diff across the growth window, and read which category moved.
If NMT's committed total accounts for RSS, the budget was simply too small and the category that
grew tells me which assumption was wrong. If NMT's total is well below RSS, the growth is outside
what NMT tracks: a JNI library, the glibc allocator's per-thread arenas, or page cache charged to
the cgroup. Those need `pmap`, `/proc/<pid>/smaps` and `MALLOC_ARENA_MAX` rather than a JVM flag.

**★ Why is capping metaspace good practice in a container even though the cap does not fix the
leak?**
Because it changes the failure mode from undiagnosable to diagnosable. Unbounded, a classloader
leak grows native memory until the cgroup kills the process, and the evidence — a `SIGKILL` with
no stack trace — is identical to the evidence for a dozen other causes. Capped, the JVM throws
`OutOfMemoryError: Metaspace`, which names the region, appears in your logs, can be alerted on,
and can be paired with `-XX:+ExitOnOutOfMemoryError` for a clean restart. The cap is a
diagnostic, not a defence.

**★ Two identical services, one on x64 and one on ARM, are given the same manifest and the ARM one
is OOMKilled. Give a JVM-level explanation.**
The `-Xss` default. The man page lists Linux/x64 at 1024 KB and Linux/AArch64 at 2048 KB, so every
platform thread reserves twice as much stack on the ARM node and touches correspondingly more.
With a few hundred threads that is a difference measured in hundreds of megabytes of address space
and a meaningful amount of resident memory, and nothing in the manifest changed to signal it. The
fix is either an explicit `-Xss` chosen for both platforms, a smaller thread count, or a
re-derived `MaxRAMPercentage` for the ARM deployment.

{/* FOOTER */}
