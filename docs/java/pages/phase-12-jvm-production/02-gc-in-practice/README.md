---
title: "GC in practice: you do not tune a collector, you choose one and then read what it tells you — and the number it reports as a pause is not the number your users experienced"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **HotSpot Virtual Machine Garbage Collection Tuning Guide,
> Release 25** ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/gctuning/)) — its
> Ergonomics, Garbage-First, Parallel Collector and "Factors Affecting Garbage Collection
> Performance" chapters; the **JDK 25 `java` tool reference** for `-Xlog`
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html)); **JEP
> 474** (Generational ZGC), **JEP 490** (removal of non-generational ZGC), **JEP 521**
> (Generational Shenandoah) and **JEP 518** (JFR Cooperative Sampling)
> ([openjdk.org](https://openjdk.org/jeps/490)); and the JDK 25 HotSpot sources at tag
> `jdk-25+36` — `gc_globals.hpp`, `globals.hpp`, `c2_globals.hpp`, `gcOverheadChecker.cpp`,
> `safepoint.cpp`, `g1Arguments.cpp`, `zArguments.cpp` and `g1CollectedHeap.cpp`.
> 🔴 **No sandbox.** There is no JVM running behind these pages. No GC log line, pause figure,
> heap number or allocation rate here is a measurement — every quoted string is from documentation
> or from the HotSpot source, and attributed.
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**[Topic 01](../01-memory-layout/README.md) drew the map of where the bytes are. This topic is
about the process that moves them, and it makes one argument throughout: the collector is a
consumer of what your code produces, so the useful skills are *choosing* one against a latency
target and *reading* what it reports — not tuning it. The pages that look like tuning pages exist
mostly to explain why the flag you were about to copy will not help.**

Three things here contradict most published material, and each is argued from the source rather
than asserted. **Non-generational ZGC no longer exists** — JEP 490 removed it in JDK 24, so on 25
`-XX:+UseZGC` *is* generational and `-XX:-ZGenerational` will not parse. **The error that exists
to end a GC death spiral is never thrown by the default collector** — `check_gc_overhead_limit`
belongs to the adaptive size policy G1 does not use, and the tuning guide documents the 98% rule
only under "The Parallel Collector". And **the safepoint poll that bounds a counted loop's stall
is off in the compiler and switched on by G1's and ZGC's own startup code**, so exposure to the
classic time-to-safepoint spike is decided by a collector choice nobody made for that reason.

**42 chunks, ~10,650 lines, 537 gotchas and interview questions.** Read in order.
[12 · The checklist](12-the-checklist.md) is the page to open during an incident.

| # | Chunk | Tier | What it argues |
|---|---|---|---|
| 1 | **[What a collector promises](01-what-a-collector-actually-promises.md)** | <span className="db-tier t-understand">Understand</span> | Throughput, latency, footprint — you get two |
| 2 | **[What the pause number leaves out](01b-what-the-pause-number-leaves-out.md)** | <span className="db-tier t-understand">Understand</span> | The reported pause is not what the request lost |
| 3 | **[The four collectors](02-the-four-collectors.md)** | <span className="db-tier t-understand">Understand</span> | Serial, Parallel, G1, ZGC on JDK 25 — and G1 is the default |
| 4 | **[Shenandoah](02b-shenandoah-and-availability.md)** | <span className="db-tier t-understand">Understand</span> | Real, useful, and not in every JDK build |
| 5 | **[Is Shenandoah in your JDK?](02b2-is-shenandoah-in-your-jdk.md)** | <span className="db-tier t-understand">Understand</span> | How to find out, and JEP 521's generational mode |
| 6 | **[What was removed](02c-what-was-removed.md)** | <span className="db-tier t-understand">Understand</span> | CMS, PermGen, `-XX:-ZGenerational` — flags that fail the launch |
| 7 | **[Flags that still work](02c2-flags-that-still-work.md)** | <span className="db-tier t-understand">Understand</span> | The short live list, and Epsilon as a measuring instrument |
| 8 | **[G1](03-g1.md)** | <span className="db-tier t-understand">Understand</span> | Regions, concurrent marking, evacuation, the pause-time goal |
| 9 | **[Collection set and remembered sets](03b-the-collection-set-and-remembered-sets.md)** | <span className="db-tier t-understand">Understand</span> | What G1 chooses to collect, and what it costs to know |
| 10 | **[The four phases of a pause](03b2-the-four-phases-of-a-pause.md)** | <span className="db-tier t-understand">Understand</span> | Where the milliseconds in an evacuation pause go |
| 11 | **[Reference processing](03b3-reference-processing.md)** | <span className="db-tier t-understand">Understand</span> | A distinct phase that can dominate a pause |
| 12 | **[Finalization and cleaners](03b4-finalization-and-cleaners.md)** | <span className="db-tier t-understand">Understand</span> | Why finalizers were a defect and what replaced them |
| 13 | **[G1 pause-time control](03c-g1-pause-time-and-the-knobs.md)** | <span className="db-tier t-understand">Understand</span> | `MaxGCPauseMillis` is the input; `-Xmn` removes it |
| 14 | **[The G1 flag table](03c2-the-g1-flag-table.md)** | <span className="db-tier t-understand">Understand</span> | Every G1 flag worth knowing, with its default |
| 15 | **[Tuning G1 for throughput](03c3-tuning-g1-for-throughput.md)** | <span className="db-tier t-understand">Understand</span> | Relaxing the pause goal, and when that is right |
| 16 | **[Humongous allocations](03d-humongous-allocations.md)** | <span className="db-tier t-understand">Understand</span> | The half-region rule, and the array that fragments a heap |
| 17 | **[Humongous fragmentation](03d2-humongous-fragmentation.md)** | <span className="db-tier t-understand">Understand</span> | Why region size is the knob and rarely the answer |
| 18 | **[When G1 goes wrong](03e-g1-when-it-goes-wrong.md)** | <span className="db-tier t-understand">Understand</span> | To-space exhaustion and evacuation failure |
| 19 | **[The road to a Full GC](03e2-the-road-to-a-full-gc.md)** | <span className="db-tier t-understand">Understand</span> | A Full GC on G1 is always a finding |
| 20 | **[ZGC](04-zgc.md)** | <span className="db-tier t-understand">Understand</span> | Coloured pointers, load barriers, generational since 23 |
| 21 | **[Relocation and the ZGC log](04b-zgc-relocation-and-the-log.md)** | <span className="db-tier t-understand">Understand</span> | Reading a log whose phases are mostly concurrent |
| 22 | **[What ZGC costs](04c-zgc-costs.md)** | <span className="db-tier t-understand">Understand</span> | Footprint and CPU as the price of the pause |
| 23 | **[ZGC memory and when not to](04c2-zgc-memory-and-when-not-to.md)** | <span className="db-tier t-understand">Understand</span> | The cases where it is the wrong choice |
| 24 | **[Parallel and Serial](05-parallel-and-serial.md)** | <span className="db-tier t-understand">Understand</span> | Where throughput or a tiny container still wins |
| 25 | **[Parallel's adaptive sizing](05b-parallel-adaptive-sizing.md)** | <span className="db-tier t-understand">Understand</span> | The goals it balances, and what pins them |
| 26 | **[Choosing a collector](06-choosing.md)** | <span className="db-tier t-understand">Understand</span> | A decision driven by the latency target, not by fashion |
| 27 | **[Unified logging](07-unified-logging.md)** | <span className="db-tier t-understand">Understand</span> | `-Xlog` — tags, levels, and the death of `PrintGCDetails` |
| 28 | **[Decorators and runtime control](07b-decorators-and-runtime-control.md)** | <span className="db-tier t-understand">Understand</span> | `jcmd VM.log` — changing logging without a restart |
| 29 | **[Reading a GC log](07c-reading-a-gc-log.md)** | <span className="db-tier t-understand">Understand</span> | Line by line, and what healthy looks like |
| 30 | **[The other GC log lines](07c2-the-other-gc-log-lines.md)** | <span className="db-tier t-understand">Understand</span> | Concurrent cycles, humongous, and the ones that matter |
| 31 | **[Rotating and shipping GC logs](07d-rotating-and-shipping-gc-logs.md)** | <span className="db-tier t-understand">Understand</span> | Having the log when it matters, not after |
| 32 | **[Allocation rate](08-allocation-rate.md)** | <span className="db-tier t-understand">Understand</span> | The number that predicts GC pressure better than heap size |
| 33 | **[Where allocation comes from](08b-where-allocation-comes-from.md)** | <span className="db-tier t-understand">Understand</span> | Boxing, logging, string building — code nobody flags |
| 34 | **[Premature promotion](08c-premature-promotion.md)** | <span className="db-tier t-understand">Understand</span> | The tenuring threshold collapses before promotion spikes |
| 35 | **[Fixing it (and G1)](08c2-fixing-premature-promotion.md)** | <span className="db-tier t-understand">Understand</span> | Ratio, not total — and most advice predates G1 |
| 36 | **[GC overhead and the death spiral](09-gc-overhead-and-the-death-spiral.md)** | <span className="db-tier t-understand">Understand</span> | The 98% rule, and the five preconditions nobody quotes |
| 37 | **[Why G1 never throws it](09b-why-g1-never-throws-it.md)** | <span className="db-tier t-understand">Understand</span> | The safety net is not under the default collector |
| 38 | **[Safepoints](10-safepoints.md)** | <span className="db-tier t-understand">Understand</span> | The pause you measure and the pause the user gets |
| 39 | **[The counted loop](10b-what-makes-time-to-safepoint-long.md)** | <span className="db-tier t-understand">Understand</span> | A compiler flag your collector decides for you |
| 40 | **[Diagnosing it](10c-diagnosing-time-to-safepoint.md)** | <span className="db-tier t-understand">Understand</span> | Swapping, JNI critical sections, and naming the thread |
| 41 | **[When tuning is the wrong answer](11-when-tuning-is-the-wrong-answer.md)** | <span className="db-tier t-understand">Understand</span> | A flag does not add a capability; it removes a freedom |
| 42 | **[The checklist](12-the-checklist.md)** | <span className="db-tier t-understand">Understand</span> | "GC pauses went up" in seven ordered questions |

## The nine things this topic is really about

1. **The reported pause is not what the request lost.** `-Xlog:gc` measures the work done at the
   safepoint. The application also lost the time spent waiting for the last thread to arrive, and
   that number appears in no GC log and no GC-derived metric. `-Xlog:safepoint` splits `Reaching
   safepoint` from `At safepoint`, costs one line per safepoint, and is the cheapest unclaimed win
   in this phase.

2. **You choose a collector; you rarely tune one.** Ergonomics is a running control system that
   resizes the heap and the generations against a goal. Every explicit flag pins one of its inputs
   — sometimes correctly, always as a trade. The guide's own advice is not to set a maximum heap
   unless you know you need one.

3. **Most GC problems are allocation problems.** Boxing, string building, unparameterised logging,
   defensive copies and per-request buffers produce the bytes the collector is struggling with.
   The fix is code, and it keeps working as traffic grows; a flag buys headroom proportional to
   what you added.

4. **Churn and a leak look identical on every graph but one.** Live data size after collection is
   the only measurement that separates them, and they share no remediation steps. Getting it
   backwards sends the whole investigation down a branch with no exit.

5. **The generational design fails quietly before it fails loudly.** The tenuring threshold
   collapses to protect survivor occupancy well before promotion volume visibly spikes, so the age
   distribution is the leading indicator and the promotion counter is the lagging one. Nothing
   graphs the threshold by default.

6. **The death spiral's terminator is not under the default collector.** The 98%-of-time-and-2%-of-
   heap rule is implemented by the adaptive size policy that Parallel and Serial use. G1 stops on a
   *failed allocation*, not on wasted time — so a spiral whose allocations keep succeeding never
   ends, and what ends it in practice is a container limit or a probe, not the JVM.

7. **A flag's declared default and its effective value are different questions.**
   `UseCountedLoopSafepoints` is declared `false` and set to `true` by G1 and ZGC at startup, and
   the guard is `FLAG_IS_DEFAULT`, so setting it explicitly turns the protection *off*. Only
   `-XX:+PrintFlagsFinal` answers what a given JVM actually has.

8. **Removed flags fail the launch.** CMS, PermGen and `-XX:-ZGenerational` are gone, and an
   unrecognised `-XX:` option is a startup error on JDK 25 unless
   `-XX:+IgnoreUnrecognizedVMOptions` is set — which silences the next one too, converting a loud
   failure into a permanently misconfigured JVM.

9. **The instrumentation has to exist before the incident.** Allocation rate's entire value is its
   trend, a rotated GC log is the only one that survives the failure that produced it, and a
   time-in-GC alert catches a spiral whose individual pauses look ordinary. None of it changes
   behaviour under load; all of it decides whether the next incident is diagnosable.

## Where this connects

- **[01 · Memory layout](../01-memory-layout/README.md)** owns the map this topic operates on —
  generations, metaspace, the object header whose four age bits cap `MaxTenuringThreshold` at 15,
  and NMT for the footprint outside the heap.
- **[03 · Heap sizing in containers](../03-heap-sizing-in-containers/README.md)** owns sizing.
  Every "raise the heap" suggestion here defers to its arithmetic, and to the OOMKilled-versus-
  `OutOfMemoryError` distinction that decides whether you get a heap dump at all.
- **[04 · `OutOfMemoryError`](../04-out-of-memory-error/README.md)** owns what happens when the
  heap genuinely cannot be freed, and owns the heap dump that a rising live set demands.
- **[05 · Thread dumps](../05-thread-dumps/README.md)** distinguishes a GC spiral from an
  application-level infinite loop — both are 100% CPU with no throughput, and a dump settles it in
  seconds.
- **[06 · JFR and profiling](../06-jfr-and-profiling/README.md)** owns `jdk.ObjectAllocationSample`,
  which names the call site behind an allocation rate, and owns safepoint bias — which the flags
  in [10b](10b-what-makes-time-to-safepoint-long.md) move rather than remove.
- **07 · Logging done right** and **08 · Metrics with Micrometer** *(neither closed yet)* own the
  signals that tell you to start looking — including the time-in-GC fraction that a spiral
  requires and a pause percentile misses.
- **13 · JVM flags that matter in 2026** *(not written yet)* owns the live and retired flag
  inventory; this topic links to it rather than repeating it.

{/* FOOTER */}
