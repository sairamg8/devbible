---
title: "Heap sizing in containers: the JVM reads your cgroup and makes six decisions from it, and every production surprise in this topic is one of those decisions being made from a number you did not realise you had set"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **JDK 25 `java` and `jcmd` tool references**
> ([java](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html),
> [jcmd](https://docs.oracle.com/en/java/javase/25/docs/specs/man/jcmd.html)), the **JDK 25
> Troubleshooting Guide**
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/troubleshoot/diagnostic-tools.html)),
> the **HotSpot GC Tuning Guide for JDK 25**
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/gctuning/)), the JDK 25 HotSpot and
> JDK sources at tag `jdk-25+36`
> ([github.com/openjdk/jdk](https://github.com/openjdk/jdk/tree/jdk-25%2B36/src)), the **JVM Tool
> Interface specification v25**
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/jvmti.html)), the
> **Kubernetes** documentation ([kubernetes.io](https://kubernetes.io/docs/concepts/)) and the
> **Paketo `libjvm`** memory calculator sources
> ([github.com](https://github.com/paketo-buildpacks/libjvm)).
> **No sandbox** — every figure here is either quoted from those sources or arithmetic derived on
> the page and labelled as such. No console output, no measurements.
> JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9.

**Container sizing is not a tuning exercise, it is an accounting exercise with one hard
constraint. The kernel enforces a single number; the JVM divides that number among about twenty
regions using rules almost nobody has read; and the JVM's evidence disappears at the moment of
failure, because `SIGKILL` cannot be handled. This topic argues that the whole problem reduces to
four questions — what did the JVM read, what did it decide, what did that leave for everything
else, and how will you know — and that every well-known container disaster is one of those four
answered by accident.**

The single most consequential fact in the topic, and the one that is in no documentation: **the
default `-XX:MaxDirectMemorySize` is a second copy of `-Xmx`, not a slice of it.** Raising
`MaxRAMPercentage` therefore raises the worst-case native budget by exactly as much as it raises
the heap. That is [04b](04b-the-direct-memory-doubling.md), and it is the reason a topic about
heap sizing spends so much of its length outside the heap.

**16 chunks, ~3,750 lines.** Read in order; each chunk links to the next.

| # | Chunk | Tier | What it argues |
|---|---|---|---|
| 1 | **[The OOMKilled loop](01-the-oomkilled-loop.md)** | <span className="db-tier t-understand">Understand</span> | Exit 137 is `SIGKILL`, not `OutOfMemoryError`, and the kill is reactive so the timestamps lie |
| 2 | **[Container awareness](02-container-awareness.md)** | <span className="db-tier t-understand">Understand</span> | One boolean redefines "physical memory" and "available processors" — and the detection rule is two-step |
| 3 | **[cgroup v1, v2 and the hierarchy](02b-cgroup-v1-v2-and-the-hierarchy.md)** | <span className="db-tier t-understand">Understand</span> | The exact files the JVM reads, and the ancestor cgroup it may have read instead of yours |
| 4 | **[MaxRAMPercentage](03-maxrampercentage.md)** | <span className="db-tier t-understand">Understand</span> | The right knob, the 25 percent default, and why `MinRAMPercentage` is not a minimum |
| 5 | **[The ergonomics algorithm](03b-the-ergonomics-algorithm.md)** | <span className="db-tier t-understand">Understand</span> | The flat band between 250 and 500 MiB, and the flag that silently disables compressed oops |
| 6 | **[Why not `-Xmx`](03c-why-not-xmx.md)** | <span className="db-tier t-understand">Understand</span> | A build-time constant for a runtime quantity — and it disables the mechanism that would have fixed it |
| 7 | **[The memory budget](04-the-memory-budget.md)** | <span className="db-tier t-understand">Understand</span> | The inequality, region by region, with the subtraction worked out |
| 8 | **[The direct-memory doubling](04b-the-direct-memory-doubling.md)** | <span className="db-tier t-understand">Understand</span> | 🔴 The default is `-Xmx`, the man page is silent, and nothing bounds mapped files |
| 9 | **[The memory calculator](04c-the-memory-calculator.md)** | <span className="db-tier t-understand">Understand</span> | Buildpacks already size your JVM, by subtraction — and ship a 10 MiB direct limit |
| 10 | **[CPU limits and ergonomics](05-cpu-limits-and-ergonomics.md)** | <span className="db-tier t-understand">Understand</span> | `ceil(quota/period)`; shares ignored since JDK 19; no limit means the whole node |
| 11 | **[The pools sized from it](05b-the-pools-sized-from-that-number.md)** | <span className="db-tier t-understand">Understand</span> | GC workers, compiler threads, ForkJoinPool, carriers — and every one costs a stack |
| 12 | **[Requests, limits and the JVM](06-requests-limits-and-the-jvm.md)** | <span className="db-tier t-understand">Understand</span> | The JVM sees only the limit, so the request-limit gap is memory nobody reserved |
| 13 | **[Ergonomics in a small container](07-what-ergonomics-picks-in-a-small-container.md)** | <span className="db-tier t-understand">Understand</span> | Under 2 CPUs or 1792 MiB, your pod spec chose Serial GC |
| 14 | **[Getting a dump out](08-getting-a-dump-out-of-a-container.md)** | <span className="db-tier t-understand">Understand</span> | The restart deletes it, and a memory-backed `emptyDir` charges it against the limit |
| 15 | **[AlwaysPreTouch](09-alwayspretouch.md)** | <span className="db-tier t-understand">Understand</span> | Move the whole cost to second one, so a sizing mistake is a failed rollout |
| 16 | **[The checklist](10-the-checklist.md)** | <span className="db-tier t-understand">Understand</span> | Nine questions before the deploy, four at three in the morning |

## The seven things this topic is really about

1. **The JVM sees the limit and never the request.** `os::physical_memory()` returns the cgroup
   memory limit; the processor count comes from the CPU quota. `requests.memory` and
   `requests.cpu` are invisible, which makes the common "modest request, generous limit" pattern
   actively hostile to a JVM.
2. **The direct-memory ceiling is a second copy of the heap ceiling.** Documented nowhere except
   `jdk/internal/misc/VM.java`. Every heap-size change is silently a native-ceiling change of the
   same size, and mapped buffers are bounded by no flag at all.
3. **`-Xmx` does not just set the heap — it disables the mechanism that would have sized it.**
   `Arguments::set_heap_size()` guards the entire percentage path with
   `if (FLAG_IS_DEFAULT(MaxHeapSize))`, with no warning when it is skipped.
4. **Everything downstream is sized from two integers.** The memory limit and the processor
   count feed the heap, the GC worker pool, the compiler threads, the common ForkJoinPool, the
   virtual-thread carriers and the choice of collector. Get either integer wrong and six things
   are wrong at once.
5. **The unbounded regions are the dangerous ones.** Metaspace is unlimited by default, mapped
   buffers are unlimited by design, and the native allocator's slack is nobody's flag. Bounding
   what can be bounded is a diagnostic decision: a JVM limit gives you an error naming the
   region, the cgroup limit gives you a `SIGKILL` and nothing.
6. **Failure is deferred, and deferred failure is the real enemy.** Reserved becomes committed
   becomes resident over hours; the kernel kills reactively rather than at the moment you crossed
   the line. `-Xms` equal to `-Xmx` plus `AlwaysPreTouch` collapses that timeline to the first
   second, where a mistake is a failed rollout.
7. **The evidence has to be arranged before the incident.** No dump is written for an OOMKill, a
   restart wipes the container's filesystem, and the volume type that first suggests itself
   charges the dump against the limit you were investigating.

## Where this connects

- **[01 · Memory layout](../01-memory-layout/README.md)** owns *what the regions are* — heap,
  metaspace, code cache, thread stacks, direct and mapped buffers, and Native Memory Tracking.
  This topic owns the *budget across them*. Start with
  [01 · Heap is not the process](../01-memory-layout/01-heap-is-not-the-process.md) and
  [01e · The native budget](../01-memory-layout/01e-the-native-budget.md).
- **02 · GC in practice** *(not written yet)* owns *choosing and reading* a collector. This topic
  only covers what the container makes ergonomics choose for you —
  [07](07-what-ergonomics-picks-in-a-small-container.md).
- **04 · `OutOfMemoryError`** *(not written yet)* owns the message inventory, heap dumps and MAT.
  This topic owns getting the file out of the container —
  [08](08-getting-a-dump-out-of-a-container.md).
- **12 · Graceful shutdown** *(not written yet)* owns the *other* source of exit code 137: the
  `SIGKILL` the kubelet sends when the grace period expires.
- **13 · JVM flags that matter in 2026** *(not written yet)* owns the retired-flag inventory,
  including `UseContainerCpuShares`, which will not start on JDK 25.
- The Docker and Kubernetes mechanics themselves — images, manifests, scheduling — belong to the
  Docker section of this site and are linked rather than re-taught here.

{/* FOOTER */}
