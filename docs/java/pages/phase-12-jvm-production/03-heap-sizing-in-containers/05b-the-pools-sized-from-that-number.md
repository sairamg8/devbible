---
title: "One integer decides how many GC threads, compiler threads, ForkJoinPool workers and virtual-thread carriers your JVM creates, so a wrong processor count is simultaneously a CPU problem and a memory problem — every one of those threads costs a stack"
sidebar_label: "05b · The pools sized from it"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the JDK 25 HotSpot source at tag `jdk-25+36` —
> [`gc/shared/workerPolicy.cpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/gc/shared/workerPolicy.cpp),
> [`compiler/compilerDefinitions.cpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/compiler/compilerDefinitions.cpp);
> the **JDK 25 `java` tool reference** for `-XX:ConcGCThreads`, `-XX:CICompilerCount`,
> `-XX:+UseDynamicNumberOfCompilerThreads`, `-Xss`
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html)); and the
> JDK 25 javadoc for
> [`java.lang.Thread`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Thread.html)
> and
> [`java.util.concurrent.ForkJoinPool`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/ForkJoinPool.html).
> Arithmetic below is derived here and labelled.
> JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9.

**The processor count is not just a CPU-side number. Every pool it sizes is a pool of *platform
threads*, and every platform thread reserves a stack — 1024 KB on Linux/x64, 2048 KB on
Linux/AArch64. So a JVM that thinks it has 64 processors in a pod entitled to half of one is
paying twice: it is throttled on CPU *and* it has committed stack memory for threads it will
never usefully run. This is why the CPU chapter of a container-sizing topic ends in the memory
budget.**

## Who reads the number

### GC worker threads

`WorkerPolicy::nof_parallel_worker_threads`, with its own explanation, verbatim:

```cpp
    // For very large machines, there are diminishing returns
    // for large numbers of worker threads.  Instead of
    // hogging the whole system, use a fraction of the workers for every
    // processor after the first 8.  For example, on a 72 cpu machine
    // and a chosen fraction of 5/8
    // use 8 + (72 - 8) * (5/8) == 48 worker threads.
    uint ncpus = (uint) os::initial_active_processor_count();
    threads = (ncpus <= switch_pt) ?
              ncpus :
              (switch_pt + ((ncpus - switch_pt) * num) / den);
```

with `switch_pt` = 8 and `num` = 5. So `ParallelGCThreads` equals the processor count up to 8, and
grows more slowly beyond it. **Derived from that formula, with the denominator of 8 that the
source's own example uses:**

| Processors | `ParallelGCThreads` |
|---|---|
| 1 | 1 |
| 2 | 2 |
| 4 | 4 |
| 8 | 8 |
| 16 | 13 |
| 64 | 43 |
| 72 | 48 *(the source's own worked example)* |

Note `os::initial_active_processor_count()` — the value captured at JVM startup, not a live read.

`ConcGCThreads` follows from it; the man page: *"Sets `threads` to approximately 1/4 of the number
of parallel garbage collection threads. The default value depends on the number of CPUs available
to the JVM."*

### JIT compiler threads

> *"`-XX:CICompilerCount=threads` — Sets the number of compiler threads to use for compilation. By
> default, the number of compiler threads is selected automatically depending on the number of
> CPUs and memory available for compiled code."*

`-XX:+UseDynamicNumberOfCompilerThreads` is *"enabled by default"* and creates compiler threads up
to that limit on demand, which softens the cost but does not remove it. There is also
`CICompilerCountPerCPU`, and the source warns if you set both:
*"The VM option CICompilerCountPerCPU overrides CICompilerCount."*

### The common ForkJoinPool

Every parallel stream, every `CompletableFuture` without an explicit executor, and a good deal of
library code runs on `ForkJoinPool.commonPool()`. Its parallelism derives from the available
processor count, and the javadoc gives the general rule for a default-constructed pool:
*"Creates a `ForkJoinPool` with parallelism equal to `Runtime.availableProcessors()`"*. The common
pool is configurable through the system property
`java.util.concurrent.ForkJoinPool.common.parallelism`, which the javadoc describes as *"the
parallelism level, a non-negative integer"* while noting *"Usage is discouraged. Use
`setParallelism(int)` instead."* ⚠️ The often-repeated "common pool parallelism is
`availableProcessors() - 1`" is not stated in the JDK 25 javadoc; treat the exact off-by-one as
unconfirmed and read the value at runtime with `ForkJoinPool.getCommonPoolParallelism()`.

### The virtual thread scheduler

From the `Thread` javadoc's implementation note, verbatim:

> *"`jdk.virtualThreadScheduler.parallelism` — The number of platform threads available for
> scheduling virtual threads. **It defaults to the number of available processors.**"*
>
> *"`jdk.virtualThreadScheduler.maxPoolSize` — The maximum number of platform threads available to
> the scheduler. **It defaults to 256.**"*

So virtual threads do not escape this: their carriers are platform threads and the carrier count
is the processor count. The stack cost of carriers versus virtual threads is
[06b · Virtual thread stacks](../01-memory-layout/06b-virtual-thread-stacks.md) and
[06c · Carriers, mounting and pinning](../01-memory-layout/06c-carriers-mounting-and-pinning.md).

### Everything above the JDK

Web servers, HTTP clients, message-broker clients and connection pools very often derive a default
from `Runtime.availableProcessors()`. Netty's event-loop group and Reactor's schedulers are the
common examples in a Spring stack. Those are not JDK behaviour and their formulas differ by
version, so read the library rather than assuming — but the input is the same integer.

## The double cost, as arithmetic

**Derived here; not measured.** A pod with `requests.cpu: 500m`, no CPU limit, on a 64-core node.
The JVM sees 64 processors, so:

```
ParallelGCThreads      8 + (64-8) × 5/8   =  43 threads
ConcGCThreads          ≈ 43 / 4           =  10 threads
common FJP workers     ≈ 64               =  64 threads
VT carriers            = 64               =  64 threads (if virtual threads are used)
compiler threads       ergonomic, several

stack address space at 1 MiB each, GC + FJP alone:  ~117 MiB reserved
the same on Linux/AArch64 at 2 MiB each:            ~234 MiB reserved
```

Reserved, not resident — most of those stacks are barely touched, and
[01f](../01-memory-layout/01f-reserved-committed-and-resident.md) matters here. But the touched
portion is real, the thread structures are real, and the *CPU* cost is entirely real: 43 GC
workers contending for half a CPU's worth of quota turns a 10 ms young collection into something
much worse, because the parallel phase cannot proceed until all workers have been scheduled.

Setting `-XX:ActiveProcessorCount=1` in that pod changes all five numbers at once. It is one flag.

## Gotchas

**★ GC threads are the pool most sensitive to a wrong count, because they synchronise.**
A parallel GC phase does not finish until every worker finishes. Under a CPU quota, workers are
descheduled mid-phase and the pause stretches to whatever the slowest worker's scheduling delay
was. This is why over-provisioned GC threads under a quota produce *longer* pauses, not shorter
ones — exactly the opposite of the intuition that made someone raise the count.

**★ `os::initial_active_processor_count()` is captured once.**
The GC worker calculation reads the *initial* value. A CPU limit that changes later does not
resize the GC worker pool. `Runtime.availableProcessors()` will report the new value and the JVM's
own pools will not follow it.

**★ Virtual threads do not remove the processor-count problem, they relocate it.**
Carrier parallelism defaults to the available processor count and the pool can grow to 256. A
service that replaced a 200-thread platform pool with virtual threads has fewer stacks but the
same wrong carrier count if the processor count is wrong, and it can now create far more
*runnable* work than the quota supports.

**★ Compiler threads are created lazily but count against the same budget.**
`UseDynamicNumberOfCompilerThreads` is on by default, so a container that never gets hot may never
create the full complement. That makes the cost invisible in a short test and present in
production.

**★ `ParallelGCThreads` grows sub-linearly, which hides the problem.**
64 processors gives 43 GC threads, not 64, so the number looks less alarming than the processor
count that produced it. It is still 43 threads in a pod entitled to half a CPU.

**★ Setting `ParallelGCThreads` by hand instead of fixing the processor count fixes one pool out
of five.**
The common ForkJoinPool, the compiler threads, the virtual-thread carriers and every library that
read `availableProcessors()` are all still wrong. `-XX:ActiveProcessorCount` is the single point
of correction; per-pool flags are for when you have a specific reason to deviate from it.

**★ `CICompilerCountPerCPU` and `CICompilerCount` conflict, and the JVM warns.**
`warning("The VM option CICompilerCountPerCPU overrides CICompilerCount.")`. If both appear in an
inherited `JAVA_OPTS`, the one you did not intend is winning.

**★ A processor count of 1 changes JVM behaviour beyond pool sizes.**
Spin-then-block strategies, biased-ish fast paths and several adaptive heuristics behave
differently at one CPU, and ergonomics may choose a different collector entirely —
[07 · What ergonomics picks in a small container](07-what-ergonomics-picks-in-a-small-container.md).
`-XX:ActiveProcessorCount=1` is therefore a bigger change than the number suggests; verify rather
than assume it is a pure downsizing.

**★ Framework pools usually do not read the same number you fixed.**
`-XX:ActiveProcessorCount` changes `Runtime.availableProcessors()`, so libraries that call it *do*
follow. Libraries that read a system property, a configuration file or `nproc` in an entrypoint
script do not. Tomcat's `maxThreads`, for instance, is a fixed default rather than a
processor-derived one.

## Interview questions

**★ Name everything in a JVM whose size depends on the processor count.**
GC worker threads (`ParallelGCThreads`, computed as the count up to 8 and then 8 plus five eighths
of the remainder), concurrent GC threads (roughly a quarter of that), JIT compiler threads
(`CICompilerCount`, chosen from CPU count and code-cache size, created lazily because
`UseDynamicNumberOfCompilerThreads` is on by default), the common ForkJoinPool's parallelism, and
the virtual-thread scheduler's parallelism — which the `Thread` javadoc says defaults to the
number of available processors, with a maximum pool size of 256. Above the JDK, most web servers
and NIO clients derive their event-loop counts from `Runtime.availableProcessors()` too.

**★ Why is a too-high processor count a memory problem as well as a CPU problem?**
Because every one of those pools is made of platform threads, and every platform thread reserves a
stack — 1 MiB on Linux/x64 and 2 MiB on Linux/AArch64 by default. Forty-three GC workers plus
sixty-odd ForkJoinPool workers plus carriers is well over a hundred threads that exist purely
because the JVM misread the container. Most of that is reserved address space rather than resident
memory, so it will not by itself cause an OOMKill, but the touched pages and per-thread structures
are real and they come out of the same budget as everything else in
[04 · The memory budget](04-the-memory-budget.md).

**★ Under a CPU quota, does adding GC threads make pauses shorter?**
No, usually longer. A parallel GC phase completes only when every worker completes. Under a quota
the workers compete for a fixed slice of CPU time within each scheduling period, so adding workers
does not add throughput — it adds contention and increases the chance that some worker is
descheduled mid-phase, which stretches the pause to include its scheduling delay. Under a quota
the right move is fewer GC threads matched to the entitlement, which is what a correct processor
count gives you for free.

**★ You cannot change the pod spec. What one flag would you add to a JVM in a pod with a CPU
request and no limit?**
`-XX:ActiveProcessorCount`, set to the request rounded to an integer. It is checked before any
container logic and, in the man page's words, *"is honored even if `UseContainerSupport` is not
enabled"*, so it works regardless of what the detection concludes. It corrects GC workers,
compiler threads, the common ForkJoinPool, virtual-thread carriers and every library reading
`availableProcessors()` in one place — which is why it beats setting `ParallelGCThreads` by hand.

{/* FOOTER */}
