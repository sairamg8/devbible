---
title: "A G1 Full GC has four distinct causes and the GC log names which one in the cause string, so the three seconds spent reading it decides between adding heap, reducing humongous allocations, buying CPU, and telling a monitoring agent to stop calling `System.gc()`"
sidebar_label: "03e2 · The road to a Full GC"
sidebar_position: 19
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **HotSpot Virtual Machine Garbage Collection Tuning Guide,
> Release 25**, "Garbage-First Garbage Collector Tuning → Observing Full Garbage Collections"
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/gctuning/garbage-first-garbage-collector-tuning.html)),
> "Garbage-First (G1) Garbage Collector → Garbage Collection Cycle" and "Periodic Garbage
> Collections"
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/gctuning/garbage-first-g1-garbage-collector1.html)),
> and "Other Considerations → Explicit Garbage Collection"
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/gctuning/other-considerations.html));
> the JDK 25 `java` tool reference for `-XX:+ExplicitGCInvokesConcurrent`,
> `-XX:+DisableExplicitGC` and `-XX:ConcGCThreads`
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html));
> the **JDK 25 `jcmd` tool reference** for `GC.class_histogram`, `GC.heap_dump` and `GC.run`
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/jcmd.html));
> and [`gc/shared/gcCause.cpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/gc/shared/gcCause.cpp)
> at tag `jdk-25+36` for the exact cause strings.
> JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9.

**"We saw a Full GC" is not a diagnosis, and the four things it can mean have four different
fixes, only one of which is "add heap". The GC cause string in the log distinguishes them
completely and unambiguously, because HotSpot hard-codes one string per cause. This page is
the four roads, their cause strings, and the specific remedy each one has.**

## What a Full GC actually is

> *"As backup, if the application runs out of memory while gathering liveness information, G1
> performs an in-place stop-the-world full heap compaction (Full GC) like other collectors."*
>
> *"In the worst case, if garbage collection does not manage to free any space at all during a
> garbage collection, G1 will schedule a Full GC. This type of garbage collection performs
> in-place compaction of the entire heap. This might be very slow."*

Everything in G1 — regions, remembered sets, the optional collection set, adaptive IHOP —
exists so that this never has to happen. When it does, none of it applies: the pause is not
bounded by `MaxGCPauseMillis`, it is not incremental, it is not concurrent, and its duration
scales with the live set.

The string to grep for:

> *"Full GCs caused by too high heap occupancy in the old generation can be detected by finding
> the words `Pause Full (G1 Compaction Pause)` in the log. Full GCs are typically preceded by
> garbage collections that encounter an evacuation failure with `Allocation` reason."*

## Road one: evacuation failure

Covered in [03e · When G1 goes wrong](03e-g1-when-it-goes-wrong.md). The signature is one or
more `Evacuation Failure: Allocation` lines in the collections immediately before the Full GC.

## Road two: marking lost the race

> *"The reason that a Full GC occurs is because the application allocates too many objects that
> can't be reclaimed quickly enough. Often concurrent marking has not been able to complete in
> time to start a Space-Reclamation phase. The probability to run into a Full GC can be
> compounded by the allocation of many humongous objects. Due to the way these objects are
> allocated in G1, they may take up much more memory than expected."*
>
> *"The goal should be to ensure that concurrent marking completes on time. This can be achieved
> either by decreasing the allocation rate in the old generation, or giving the concurrent
> marking more time to complete."*

The signature is old-generation occupancy climbing across collections with no completed
Concurrent Start / Remark / Cleanup sequence in between. The guide's four options, in its own
order:

1. **Reduce humongous objects.** *"You can determine the number of regions occupied by
   humongous objects … using the `gc+heap=info` logging. … If this number is high compared to
   the number of old regions, the best option is to try to decrease this number of objects. You
   can achieve this by increasing the region size using the `-XX:G1HeapRegionSize` option."*
   That is [03d2 · Humongous fragmentation](03d2-humongous-fragmentation.md).
2. **Increase the heap.** *"This typically increases the amount of time marking has to
   complete."* Note the mechanism — a bigger heap does not mark faster, it gives marking more
   runway before the old generation fills.
3. **Increase `-XX:ConcGCThreads`.** *"Increase the number of concurrent marking threads by
   setting `-XX:ConcGCThreads` explicitly."* ⚠️ On a CPU-limited container this is advice you
   cannot take; the default is `ParallelGCThreads / 4`, which on a 2-CPU pod is one thread.
   See [01b](01b-what-the-pause-number-leaves-out.md).
4. **Start marking earlier.** *"Lower the target occupancy for when to start Space-Reclamation
   by increasing the buffer used in an adaptive IHOP calculation by modifying
   `-XX:G1ReservePercent`; or, disable the adaptive calculation of the IHOP by setting it
   manually using `-XX:-G1UseAdaptiveIHOP` and `-XX:InitiatingHeapOccupancyPercent`."*

## Road three: something asked for it

> *"Other causes than Allocation Failure for a Full GC typically indicate that either the
> application or some external tool causes a full heap collection. If the cause is
> `System.gc()`, and there is no way to modify the application sources, the effect of Full GCs
> can be mitigated by using `-XX:+ExplicitGCInvokesConcurrent` or let the VM completely ignore
> them by setting `-XX:+DisableExplicitGC`. External tools may still force Full GCs; they can
> be removed only by not requesting them."*

The cause *is* the diagnosis, and `gcCause.cpp` hard-codes one string per cause. The ones that
name a caller:

| Cause string | Who did it |
|---|---|
| `System.gc()` | application or a library |
| `Heap Inspection Initiated GC` | `jcmd GC.class_histogram`, or a tool that calls it |
| `Heap Dump Initiated GC` | `jcmd GC.heap_dump` without `-all` |
| `JvmtiEnv ForceGarbageCollection` | a JVMTI agent — APM, profiler, debugger |
| `Diagnostic Command` | `jcmd GC.run` |
| `G1 Periodic Collection` | you, via `G1PeriodicGCInterval` |

**A monitoring agent calling `GC.class_histogram` every minute is a Full GC every minute**, and
the symptom — regular multi-second pauses at a fixed interval — looks exactly like a tuning
problem while being entirely a configuration one. The `jcmd` man page confirms the cost:
`GC.class_histogram` is *"Impact: High --- depends on Java heap size and content"*, and
`GC.run` simply *"Calls `java.lang.System.gc()`"*.

Two cautions on the mitigations. `-XX:+ExplicitGCInvokesConcurrent` is documented as *"disabled
by default and can be enabled only with the `-XX:+UseG1GC` option"*. And
`-XX:+DisableExplicitGC` — *"This option is disabled by default, meaning that calls to
`System.gc()` are processed. If processing of calls to `System.gc()` is disabled, then the JVM
still performs GC when necessary"* — silently breaks code that depends on `System.gc()` for
correctness. The guide names the classic case and its own fix:

> *"One of the most commonly encountered uses of explicit garbage collection occurs with the
> distributed garbage collection (DGC) of Remote Method Invocation (RMI). Applications using
> RMI refer to objects in other virtual machines. Garbage cannot be collected in these
> distributed applications without occasionally invoking garbage collection of the local heap,
> so RMI forces full collections periodically. The frequency of these collections can be
> controlled with properties, as in the following example:"*

```
java -Dsun.rmi.dgc.client.gcInterval=3600000
     -Dsun.rmi.dgc.server.gcInterval=3600000 ...
```

> *"This example specifies explicit garbage collection once per hour instead of the default
> rate of once per minute."*

**Once per minute by default.** Any service still using RMI — which includes anything exposing
JMX over RMI to a monitoring system — is doing a full collection every minute unless somebody
changed that property.

## Road four, which is not a failure: a periodic Full GC you configured

If `-XX:G1PeriodicGCInterval` is set and `-XX:-G1PeriodicGCInvokesConcurrent` is set, the idle
cleanup is a Full GC by design, with the cause `G1 Periodic Collection`. The default is the
concurrent variant, so this only happens if someone chose it. See
[03c2 · The G1 flag table](03c2-the-g1-flag-table.md).

## Gotchas

**★ "Increase the heap" fixes a marking race by buying time, not by marking faster.**
The guide's phrasing is *"This typically increases the amount of time marking has to
complete."* Understanding the mechanism matters because it tells you when it will *not* work:
if marking is slow because there is one `ConcGCThreads` thread on a throttled container,
doubling the heap doubles the runway and also doubles the work.

**★ `-XX:ConcGCThreads` is the documented remedy you often cannot use.**
It defaults to a quarter of `ParallelGCThreads`, which is bounded by the CPUs visible to the
process. On a 2-CPU pod that is one marking thread and raising the flag just oversubscribes
the quota. In that situation the real remedy is more CPU or less allocation.

**★ A Full GC whose cause is not `Allocation Failure` was requested by something.**
`System.gc()`, `Heap Inspection Initiated GC`, `Heap Dump Initiated GC`,
`JvmtiEnv ForceGarbageCollection` and `Diagnostic Command` all name a caller. Before tuning
anything, read the cause — a monitoring agent taking a class histogram on a schedule is a
common and entirely fixable source of regular Full GCs.

**★ RMI forces a full collection once a minute by default.**
`sun.rmi.dgc.client.gcInterval` and `sun.rmi.dgc.server.gcInterval` default to 60000 ms, and
the guide's own example raises them to an hour. Anything exposing JMX over RMI to a monitoring
system is affected, which is a lot of services that would not describe themselves as "using
RMI".

**★ `-XX:+DisableExplicitGC` can break code that is relying on `System.gc()` for correctness.**
RMI's distributed GC is the canonical case; direct `ByteBuffer` reclamation under memory
pressure is another, since the JDK calls `System.gc()` before failing a direct allocation.
Prefer `-XX:+ExplicitGCInvokesConcurrent`, which honours the request cheaply, over ignoring
it — or set the RMI intervals, which is the targeted fix.

**★ `-XX:+ExplicitGCInvokesConcurrent` only works under G1.**
Man page: *"This option is disabled by default and can be enabled only with the
`-XX:+UseG1GC` option."* Carrying it into a ZGC or Parallel command line is another inert flag.

**★ A Full GC is not always a failure.**
If `G1PeriodicGCInterval` is set with `-XX:-G1PeriodicGCInvokesConcurrent`, the idle-time
collection is a Full GC by configuration, with the cause `G1 Periodic Collection`. Check the
cause before you investigate.

**★ A Full GC pause is not bounded by `MaxGCPauseMillis`.**
The pause goal constrains how many regions go into a collection set. A Full GC has no
collection set — it compacts the entire heap in place — so the goal does not apply and the
duration scales with the live set. This is why a service with a well-behaved 50 ms p99 can
produce a single four-second pause with no warning in any pause metric.

**★ `jcmd GC.heap_dump` triggers a Full GC unless you pass `-all`.**
The `jcmd` man page: `GC.heap_dump` will *"Request a full GC unless the `-all` option is
specified"*. So taking a heap dump to investigate a pause problem creates a pause. It is
usually the right trade, but know that you caused it before you find it in the log ten minutes
later. Heap dumps are [04 · OutOfMemoryError](../04-out-of-memory-error/README.md).

**★ Class unloading only happens at Remark, so a marking race is also a metaspace problem.**
If concurrent marking never completes, the Remark pause that performs class unloading never
runs. A service that is failing to complete marking cycles will show metaspace growth as a
secondary symptom, and chasing it as an independent classloader leak wastes the investigation.

**★ The order of the guide's four remedies is not arbitrary.**
Humongous objects first, because they compound everything else and are usually an application
bug. Heap second, because it is cheap and reversible. `ConcGCThreads` third, because it costs
CPU you may not have. IHOP last, because a manually pinned IHOP disables the adaptation that
was the point. Reaching for the fourth first is common and rarely helps.

## Interview questions

**★ You see a Full GC in a G1 log. Walk through your diagnosis.**
Read the cause first, because it partitions the problem. If the cause names a caller —
`System.gc()`, `Heap Inspection Initiated GC`, `Heap Dump Initiated GC`,
`JvmtiEnv ForceGarbageCollection`, `Diagnostic Command` — then something requested it, usually
a monitoring agent, a heap dump, or RMI's distributed GC, and the fix is to stop requesting it,
raise `sun.rmi.dgc.*.gcInterval`, or add `-XX:+ExplicitGCInvokesConcurrent`. If the cause is
`G1 Periodic Collection` it was configured. Otherwise it is a genuine failure, and there are
two shapes. Preceded by `Evacuation Failure: Allocation`, the heap had nowhere to copy to:
check headroom, consider `G1ReservePercent`. Preceded by rising old-generation occupancy and
no completed marking cycle, concurrent marking lost the race: check `Humongous regions:` in
`gc+heap=info` first, because humongous allocation compounds it, then consider more heap, more
`ConcGCThreads`, or an earlier IHOP.

**★ What does it mean that a Full GC is "in-place compaction of the entire heap"?**
That G1 abandons its normal region-selection model and does what a single-generation
stop-the-world collector does: mark the whole heap, then slide live objects together in place
to eliminate fragmentation, then update every reference. It is not incremental, it is not
concurrent, it is not bounded by `MaxGCPauseMillis`, and its duration scales with the *live
set*, so on a large heap with a large live set it is seconds. It is the failure state of the
entire design — every mechanism in G1, from regions to remembered sets to the optional
collection set, exists to avoid ever needing it. That is why a Full GC in a G1 log is a signal
to investigate rather than a number to tune.

**★ A monitoring agent runs `jcmd GC.class_histogram` every minute. What are you looking at in
the GC log?**
A Full GC every minute, with the cause `Heap Inspection Initiated GC` — the histogram forces a
collection so that its counts are accurate, and the `jcmd` man page rates its impact as *"High
--- depends on Java heap size and content"*. The same is true of `GC.heap_dump` without
`-all`, which shows up as `Heap Dump Initiated GC`, and of a JVMTI agent calling
`ForceGarbageCollection`. This is worth knowing because the symptom — regular multi-second
pauses at a fixed interval — looks exactly like a GC tuning problem, and no amount of tuning
touches it. The cause string is the whole diagnosis, which is one more argument for having
`-Xlog:gc` on in production before you need it.

**★ Why is "add more heap" only sometimes the right response to a Full GC?**
Because it addresses one of the four causes. If concurrent marking is losing a race against
the old-generation allocation rate, more heap genuinely helps — the guide's phrasing is that
it *"increases the amount of time marking has to complete"*, so it buys runway. If the cause
is humongous fragmentation it helps only incidentally, by raising the region size and hence
the threshold, and the guide lists it as the last option after reducing the allocations. If
the cause is `System.gc()` from a tool, more heap does nothing at all — it makes each Full GC
slower. And if the cause is an evacuation failure on a CPU-starved container, more heap gives
the same one marking thread more work to do. The cause string decides, which takes about three
seconds to read.

**★ A service using JMX over RMI shows a multi-second pause every 60 seconds. What is
happening?**
RMI's distributed garbage collector forces a full collection periodically to detect remote
objects that are no longer referenced, and the guide states the default rate as *"once per
minute"*. The GC cause will be `System.gc()`. The targeted fix is to raise
`sun.rmi.dgc.client.gcInterval` and `sun.rmi.dgc.server.gcInterval` — the guide's own example
sets both to 3600000, one hour, and notes they *"can be set as high as `Long.MAX_VALUE` to make
the time between explicit collections effectively infinite"*, at the cost of remote objects
being retained longer. The blunt alternatives are `-XX:+ExplicitGCInvokesConcurrent`, which
turns the request into a concurrent cycle, or `-XX:+DisableExplicitGC`, which ignores it and
in this specific case genuinely breaks the mechanism DGC depends on.

**★ Why would a marking race show up as a metaspace problem?**
Because class unloading happens in the Remark pause, which is part of a completed concurrent
marking cycle. If the old generation fills before marking finishes, there is no Remark, so no
class unloading, so class metadata accumulates. A service that is failing to complete marking
cycles will therefore show metaspace growth alongside its heap problem, and the two look
independent. Treating the metaspace growth as a classloader leak — taking dumps, hunting
dangling loaders — is a plausible and completely wasted investigation. The tell is that the
metaspace growth stops the moment marking cycles start completing again.

{/* FOOTER */}
