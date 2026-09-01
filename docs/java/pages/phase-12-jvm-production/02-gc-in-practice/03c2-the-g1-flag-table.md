---
title: "G1 grows the heap in any pause but shrinks it only at Remark or a Full GC, five of the flags its own tuning chapter recommends will not start a JVM without an unlock option, and two of the ones that will are settable at runtime — so the flag table's most useful column is the one Oracle does not print"
sidebar_label: "03c2 · The G1 flag table"
sidebar_position: 14
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **HotSpot Virtual Machine Garbage Collection Tuning Guide,
> Release 25** — "Garbage-First (G1) Garbage Collector → Java Heap Sizing", "Periodic Garbage
> Collections", Table 7-1 "Ergonomic Defaults G1 GC" and "Comparison to Other Collectors"
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/gctuning/garbage-first-g1-garbage-collector1.html)),
> and "Garbage-First Garbage Collector Tuning → Tuning for Throughput / Tuning for Heap Size"
> with Table 8-1
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/gctuning/garbage-first-garbage-collector-tuning.html));
> the JDK 25 `java` tool reference for `-XX:+UseStringDeduplication`, `-XX:+AlwaysPreTouch`
> and `-XX:GCTimeRatio`
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html));
> **JEP 346 · Promptly Return Unused Committed Memory from G1**
> ([openjdk.org/jeps/346](https://openjdk.org/jeps/346)) as cited by the guide; and the JDK 25
> HotSpot sources at tag `jdk-25+36` —
> [`gc/g1/g1_globals.hpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/gc/g1/g1_globals.hpp),
> [`runtime/globals.hpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/runtime/globals.hpp)
> for `StringDeduplicationAgeThreshold`, and
> [`opto/c2_globals.hpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/opto/c2_globals.hpp)
> for `ReduceInitialCardMarks`.
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**Oracle publishes two tables of G1 defaults and neither has the column that decides whether
a flag will start your JVM. This page merges them and adds it: `EXPERIMENTAL`, `DIAGNOSTIC`,
`MANAGEABLE` or plain `product`, read out of `g1_globals.hpp` at the JDK 25 GA tag. Around it
sit the three facts that make the table actionable — that G1 can only shrink the heap at a
Remark pause, that two of these flags can be changed on a running JVM, and that one of them
is not a G1 flag at all.**

## Periodic collection, for idle services

> *"If there has been no garbage collection for a long time because of application inactivity,
> the VM may unnecessarily hold on to a large amount of unused memory for a long time that
> could be used elsewhere. To avoid this, G1 can be forced to do regular garbage collection
> using the `-XX:G1PeriodicGCInterval` option during long idle periods."*
>
> *"During the Young-Only phase: G1 starts a concurrent marking using a Concurrent Start pause
> or, if `-XX:-G1PeriodicGCInvokesConcurrent` has been specified, a Full GC."*
>
> *"The `-XX:G1PeriodicGCSystemLoadThreshold` option should be used to refine what idle means
> for G1: if the average one-minute system load value as returned by the `getloadavg()` call on
> the JVM host system (for example, a container) is above this value, the VM is not considered
> idle and no periodic garbage collection will be run."*

Defaults from Table 8-1: `G1PeriodicGCInterval=0` (disabled),
`+G1PeriodicGCInvokesConcurrent`, `G1PeriodicGCSystemLoadThreshold=0.0` (check disabled). The
source adds a detail the tables do not:

```cpp
product(uintx, G1PeriodicGCInterval, 0, MANAGEABLE,
        "Number of milliseconds after a previous GC to wait before "
        "triggering a periodic gc. A value of zero disables periodically "
        "enforced gc cycles.")

product(double, G1PeriodicGCSystemLoadThreshold, 0.0, MANAGEABLE,
        "Maximum recent system wide load as returned by the 1m value "
        "of getloadavg() at which G1 triggers a periodic GC. ...")
```

**`MANAGEABLE` means writable at runtime** — through `jcmd <pid> VM.set_flag` or the
`HotSpotDiagnosticMXBean`. You can turn periodic GC on for an idle fleet without a restart,
and off again when traffic returns. Very few of G1's flags are manageable; these two are, and
that makes them unusually practical. The feature's rationale is JEP 346, *"Promptly Return
Unused Committed Memory from G1"*, which the guide cites directly.

Two cautions. `getloadavg()` on Linux inside a container reports the **host's** load average,
not the container's — the guide's parenthetical *"(for example, a container)"* is optimistic.
And the non-concurrent variant triggers a **Full GC**, so
`-XX:-G1PeriodicGCInvokesConcurrent` on a large heap converts an idle period into a
multi-second stop-the-world compaction.

## Why an idle heap stays big: G1 grows anywhere, shrinks at Remark

> *"G1 respects standard rules when resizing the Java heap, using `-XX:InitialHeapSize` as the
> initial Java heap size, `-XX:MaxHeapSize` as the maximum Java heap size,
> `-XX:MinHeapFreeRatio` for the minimum percentage of free memory, and `-XX:MaxHeapFreeRatio`
> for determining the maximum percentage of free memory after resizing. The G1 collector
> resizes the Java heap according to these options **during the Remark and Full GC pauses
> only**. This process may release memory to or allocate memory from the operating system."*
>
> *"Heap expansion may occur within any garbage collection pause. If G1 determines that the
> Java heap should be shrunk, the release of this memory occurs after the pause concurrent with
> the application after the pause."*

**G1 can grow the heap at any pause but can only *shrink* it at Remark or a Full GC.** A
service whose load has dropped will hold its peak heap until the next marking cycle completes,
and on an idle service there may be no next marking cycle — nothing is allocating, so nothing
crosses IHOP, so no Concurrent Start happens, so no Remark happens. That is exactly the state
`G1PeriodicGCInterval` exists to break out of.

The sizing flags themselves — `MinHeapFreeRatio`, `MaxHeapFreeRatio`, `InitialHeapSize`,
`MaxHeapSize`, `MaxRAMPercentage` — belong to
[03 · Heap sizing in containers](../03-heap-sizing-in-containers/README.md).

## The whole table, with the column Oracle does not print

Table 7-1 and Table 8-1 combined, with the source's classification added — the column that
decides whether the flag will start your JVM:

| Flag | Default | Class | What it controls |
|---|---|---|---|
| `MaxGCPauseMillis` | 200 (G1 ergonomic) | product | pause goal |
| `GCPauseIntervalMillis` | `<ergo>`, no goal by default | product | MMU time slice |
| `ParallelGCThreads` | `<ergo>` from CPU count | product | pause workers |
| `ConcGCThreads` | `ParallelGCThreads / 4` | product | marking threads |
| `G1UseAdaptiveIHOP` | true | product | adaptive mark start |
| `InitiatingHeapOccupancyPercent` | 45 | product | initial IHOP |
| `G1AdaptiveIHOPNumInitialSamples` | 3 | **EXPERIMENTAL** | cycles before adaptation |
| `G1ReservePercent` | 10 | product | promotion-failure buffer |
| `G1HeapRegionSize` | `<ergo>`, ~2048 regions, ergonomic max 32 MB | product | region size |
| `G1NewSizePercent` | 5 | **EXPERIMENTAL** | minimum young size |
| `G1MaxNewSizePercent` | 60 | **EXPERIMENTAL** | maximum young size |
| `G1HeapWastePercent` | 5 | product | when to stop reclaiming |
| `G1MixedGCCountTarget` | 8 | product | length of Space-Reclamation |
| `G1MixedGCLiveThresholdPercent` | 85 | **EXPERIMENTAL** | skip regions this full |
| `G1RSetUpdatingPauseTimePercent` | 10 | product | refinement in-pause budget |
| `G1UseConcRefinement` | true | **DIAGNOSTIC** | concurrent refinement on/off |
| `G1ConcRefinementThreads` | `<ergo>` | product | refinement threads |
| `G1SummarizeRSetStatsPeriod` | 0 | **DIAGNOSTIC** | remset stats period |
| `G1PeriodicGCInterval` | 0 | **MANAGEABLE** | idle-time GC |
| `G1PeriodicGCSystemLoadThreshold` | 0.0 | **MANAGEABLE** | idle definition |
| `G1PeriodicGCInvokesConcurrent` | true | product | concurrent vs Full GC |
| `ReferencesPerThread` | 1000 | product | reference-processing parallelism |
| `ParallelRefProcEnabled` | true | product | reference-processing parallelism |
| `GCTimeRatio` | 12 (G1 ergonomic) | product | heap-growth throughput goal |
| `ReduceInitialCardMarks` | true | product (**C2**, `opto/c2_globals.hpp`) | batches initial card marks |

Five of the flags the tuning guide recommends by name are locked. That is not a footnote; it
is the difference between a rollout and an outage.

⚠️ Note the last row: the guide lists `ReduceInitialCardMarks` in a table headed "Tunable
Defaults G1 GC", but it is declared in `opto/c2_globals.hpp` as *"When initializing fields, try
to avoid needless card marks"* — it is a **C2 compiler** optimisation, not a G1 one, and
turning it off affects code generation regardless of collector.

## Pushing the lever the other way

The throughput direction — raising the pause goal, spotting a `G1MaxNewSizePercent` ceiling,
pinning `-Xms` to `-Xmx`, `AlwaysPreTouch`, large pages — and G1-only string deduplication are
[03c3 · Tuning G1 for throughput](03c3-tuning-g1-for-throughput.md).

## Gotchas

**★ G1 can grow the heap at any pause but shrinks it only at Remark or Full GC.**
So a heap that ballooned during a load spike stays big until the next marking cycle finishes,
and on an idle JVM there may be no next marking cycle. That is a memory-footprint problem
with no GC symptom, and `G1PeriodicGCInterval` — which is `MANAGEABLE`, so settable at
runtime — is the documented answer.

**★ `-XX:-G1PeriodicGCInvokesConcurrent` converts idle-time cleanup into a Full GC.**
The guide: without it, periodic GC *"starts a concurrent marking using a Concurrent Start
pause"*; with it, *"a Full GC"*. On a large heap that is a multi-second stop-the-world
compaction triggered by *inactivity*, which is a spectacular way to fail a health check.

**★ `getloadavg()` inside a Linux container reports the host's load, not the container's.**
`G1PeriodicGCSystemLoadThreshold` is documented against *"the JVM host system (for example, a
container)"*, but the one-minute load average is a host-wide kernel statistic. On a busy node
your idle pod will look busy and periodic GC will never fire.

**★ `ReduceInitialCardMarks` is a C2 flag, not a G1 flag, despite the table it appears in.**
It is declared in `opto/c2_globals.hpp` as *"When initializing fields, try to avoid needless
card marks"*. Disabling it changes compiled code generation for every collector, not just G1.
Treat the guide's "Tunable Defaults G1 GC" table as a list of flags relevant to G1, not a list
of G1's own flags.

**★ A flag table is not a tuning plan.**
Both Oracle tables are reference material for interpreting behaviour you have already
measured. The chapter that contains them opens with *"The general recommendation is to use G1
with its default settings"* and the migration section says to start by *"removing all options
that affect garbage collection"*. Reading the table top to bottom looking for something to
change is the failure mode the chapter is written to prevent.

**★ `<ergo>` in Oracle's tables means "this value does not exist until the JVM starts".**
Six of the entries have no fixed default at all — region size, both thread counts, the pause
interval, the refinement thread count. Quoting one of them from a blog post is quoting
somebody else's machine. `-XX:+PrintFlagsFinal` on *your* deployment is the only source.

## Interview questions

**★ A service's heap stays at its peak size long after the load spike ended. Why, and what
would you do?**
Because G1 only shrinks the heap during a Remark pause or a Full GC — it can *expand* in any
pause, but the guide is explicit that resizing downward happens *"during the Remark and Full
GC pauses only"*. If the application is now idle, nothing is allocating, so nothing crosses
IHOP, so no Concurrent Start and no Remark pause occurs, so the heap is never returned. The
designed answer is `G1PeriodicGCInterval`, from JEP 346, which forces periodic collections
during idle periods; it is a `MANAGEABLE` flag, so it can be set on a running JVM via
`jcmd VM.set_flag` without a restart. I would set it together with
`G1PeriodicGCSystemLoadThreshold` to avoid firing on a busy machine — while remembering that
on Linux that load average is the host's, not the container's — and I would leave
`G1PeriodicGCInvokesConcurrent` at its default, because the alternative is a Full GC.

**★ What does it mean that `G1PeriodicGCInterval` is `MANAGEABLE`?**
That it is writable on a running JVM, not just at startup — through
`jcmd <pid> VM.set_flag G1PeriodicGCInterval <ms>` or the `HotSpotDiagnosticMXBean`. Very few
GC flags are; most are `product` (startup only), and a fair number are `EXPERIMENTAL` or
`DIAGNOSTIC` and additionally require an unlock. Practically it means idle-time memory return
is something you can switch on across a fleet during a memory-pressure incident and switch off
afterwards, without a rolling restart — which is a genuinely different operational category
from every other flag on this page.

**★ Someone shows you a G1 flag list from a blog and asks you to apply it. What is your
process?**
Three checks before anything is applied. First, does each flag exist on JDK 25 and will it
start — five of the ones the official tuning chapter itself recommends are `EXPERIMENTAL` or
`DIAGNOSTIC` and need an unlock option placed earlier in the command line, and at least one
name in the documentation (`G1HeapReservePercent`) is not a real flag. Second, does each flag
have a measurement behind it — the guide's own migration advice is to *"start by removing all
options that affect garbage collection"* and add back only what a reading of
`gc+phases=debug` or `gc+heap=info` justifies. Third, are any of them `<ergo>` in the default
configuration, because a hard-coded value for a flag the JVM would otherwise derive from CPU
count or heap size is a value copied from someone else's machine. In practice this reduces
most blog flag lists to `-Xmx`, `-Xms` and a pause goal.

{/* FOOTER */}
