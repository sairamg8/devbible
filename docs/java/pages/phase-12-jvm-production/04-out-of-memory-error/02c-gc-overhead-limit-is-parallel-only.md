---
title: "GC overhead limit exceeded can only be thrown by Parallel GC, so on a JDK 25 service running the default G1 the absence of that message proves nothing — the collector will thrash silently until an ordinary Java heap space arrives instead"
sidebar_label: "02c · Parallel GC only"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **JDK 25 `java` tool reference**, `-XX:+UseGCOverheadLimit`
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html)), the
> **JDK 25 Troubleshooting Guide**
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/troubleshoot/troubleshooting-memory-leaks.html)),
> and the **JDK 25 HotSpot source at tag `jdk-25+36`** —
> `gc/shared/gc_globals.hpp`, `gc/shared/gcOverheadChecker.hpp`, `gc/shared/memAllocator.cpp`
> (`Allocation::check_out_of_memory`), `gc/parallel/parallelScavengeHeap.cpp`,
> `gc/g1/g1CollectedHeap.cpp`, `gc/serial/serialHeap.cpp` and `gc/z/zCollectedHeap.cpp`
> ([github.com/openjdk/jdk](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/gc/shared/memAllocator.cpp)).
> JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9.

**Every article about `GC overhead limit exceeded` presents it as a general JVM behaviour. It is
not. The check is implemented in Parallel GC's allocation path and nowhere else; G1, Serial and
ZGC accept the out-parameter that carries the verdict and never set it. On JDK 25, where G1 is
the default, that means a service can spend an hour with the collector consuming almost all of
its CPU and never see this message — it will eventually die of plain `Java heap space`, or get
OOMKilled first. The absence of the message is not evidence of health; on most JDK 25 services it
is evidence of nothing at all.**

## Where the message is decided

There is exactly one place in HotSpot that chooses between the two heap messages,
`MemAllocator::Allocation::check_out_of_memory` in `gc/shared/memAllocator.cpp`:

```cpp
const char* message = _overhead_limit_exceeded ? "GC overhead limit exceeded" : "Java heap space";
if (!_thread->is_in_internal_oome_mark()) {
  // -XX:+HeapDumpOnOutOfMemoryError and -XX:OnOutOfMemoryError support
  report_java_out_of_memory(message);
  ...
```

`_overhead_limit_exceeded` comes from a `bool*` out-parameter threaded through
`CollectedHeap::mem_allocate(size_t, bool* gc_overhead_limit_was_exceeded)`. Every collector
implements that signature. Only one of them ever writes `true` into it.

**Parallel GC** — `parallelScavengeHeap.cpp` — has the full machinery, including its own comment:

```cpp
// In general gc_overhead_limit_was_exceeded should be false so
// set it so here and reset it to true only if the gc time
// limit is being exceeded as checked below.
*gc_overhead_limit_was_exceeded = false;
```

**G1**, **Serial** and **ZGC** each mention `gc_overhead_limit_was_exceeded` exactly once in their
heap implementation — in the function signature. Serial's implementation is the clearest
statement of intent:

```cpp
HeapWord* SerialHeap::mem_allocate(size_t size,
                                   bool* gc_overhead_limit_was_exceeded) {
  return mem_allocate_work(size,
                           false /* is_tlab */);
}
```

The parameter is accepted and dropped on the floor. ZGC does the same. G1 takes it and routes
around it entirely.

The `java` man page corroborates, and it is the only place in Oracle's documentation that says so:

> *"Enables the use of a policy that limits the proportion of time spent by the JVM on GC before
> an `OutOfMemoryError` exception is thrown. This option is enabled, by default, and **the
> parallel GC will throw an `OutOfMemoryError`** if more than 98% of the total time is spent on
> garbage collection and less than 2% of the heap is recovered."*

The Troubleshooting Guide's description does not repeat the qualifier, which is why the folklore
exists.

## What this changes operationally

| | Parallel GC | G1 (default), Serial, ZGC |
|---|---|---|
| Thrashing produces `GC overhead limit exceeded` | yes | **no** |
| Thrashing produces… | that message, before the heap is technically full | nothing, until `Java heap space` |
| `-XX:-UseGCOverheadLimit` does anything | yes | no |
| A "we never see that message" claim means | the check has not fired | **nothing** |

🔴 **The consequence for alerting.** On Parallel GC the JVM gives you a free, if late, "this
service is dead" signal. On G1 — the JDK 25 default — you have to build that signal yourself,
because the JVM will not. A collector spending 98 percent of wall clock in GC on G1 simply keeps
going: every pause is long, every request times out, and the heap never quite reaches the point
where an allocation cannot be satisfied. In a container the usual ending is not an
`OutOfMemoryError` at all but a failed liveness probe or an OOMKill, both of which arrive with no
Java-side evidence.

So the metric to alert on is GC time as a fraction of wall clock, which comes from the GC log or
from Micrometer's collector meters, not from the exception text:

```
-Xlog:gc*:file=/var/log/gc.log:uptime,level,tags:filecount=5,filesize=20M
```

Reading that log is **02 · GC in practice** *(not written yet)*; the point here is that on JDK 25
it is the *only* source for the condition this message was invented to report.

## The three thresholds, and which of them you can change

```cpp
product(bool,  UseGCOverheadLimit,        true, "...")
product(uint,  GCTimeLimit,               98,   "Limit of the proportion of time spent in GC before "
                                                "an OutOfMemoryError is thrown (used with GCHeapFreeLimit)")
product(uint,  GCHeapFreeLimit,           2,    "Minimum percentage of free space after a full GC before an "
                                                "OutOfMemoryError is thrown (used with GCTimeLimit)")
develop(uintx, GCOverheadLimitThreshold,  5,    "Number of consecutive collections before gc time limit fires")
```

`GCTimeLimit` and `GCHeapFreeLimit` are `product` flags: you can make the check fire earlier —
say `-XX:GCTimeLimit=90 -XX:GCHeapFreeLimit=5` on a Parallel-GC batch job — and turn a hopeless
grind into a fast, diagnosable failure. Almost nobody knows this option exists, because every
article stops at "you can disable it with `-XX:-UseGCOverheadLimit`".

`GCOverheadLimitThreshold` is `develop`, which is a compile-time constant in a release build. That
is precisely why the Troubleshooting Guide writes *"the last five (compile-time constant)
consecutive garbage collections"*.

There is also a near-miss state the checker tracks and never reports to you:

```cpp
bool gc_overhead_limit_near() {
  return _gc_overhead_limit_count >= (GCOverheadLimitThreshold - 1);
}
```

The JVM knows it is one collection away from throwing. It does not tell you.

## Gotchas

**★ On JDK 25's default collector this message cannot be produced.**
G1 is the default. G1 never sets the flag that selects the message. A service that has never
logged `GC overhead limit exceeded` may still have spent hours GC-bound. Do not read its absence
as a clean bill of health.

**★ `-XX:-UseGCOverheadLimit` is a no-op on G1, Serial and ZGC.**
It is a real `product` flag and it parses everywhere, so it looks like it worked. It only affects
a code path Parallel GC executes. Adding it to a G1 command line changes nothing and gives the
team the false impression that a decision was made.

**★ The message string is lowercase and the documentation heading is not.**
HotSpot sets `"GC overhead limit exceeded"`; the guide's heading reads `GC Overhead limit
exceeded`. A case-sensitive alert rule copied from the documentation never matches.

**★ Raising `GCTimeLimit` / `GCHeapFreeLimit` to fire *earlier* is the option nobody uses.**
Both are `product` flags. On a Parallel-GC batch process, `-XX:GCTimeLimit=90` converts a job that
would have crawled for another forty minutes into one that fails fast with a message naming the
cause. The standard advice only ever mentions disabling the check.

**★ You cannot change the "five consecutive collections".**
`GCOverheadLimitThreshold` is `develop`. Passing it on the command line fails flag parsing on a
product build — or is silently ignored under `-XX:+IgnoreUnrecognizedVMOptions`.

**★ The heap need not be full when this is thrown.**
The rule is about *time in GC* and *fraction recovered*, not about an allocation failing. A
Parallel-GC service can throw it while `jcmd GC.heap_info` still shows free space, which reads as
a contradiction if you assume every OOM means "no room left".

**★ A JVM that switched collectors changed its failure mode without anyone noticing.**
Migrating from Parallel to G1 — which is what happens by default the moment ergonomics stop
choosing Parallel, or when someone drops an old `-XX:+UseParallelGC` — silently removes this
diagnostic. The service does not get healthier; it gets quieter.

**★ The checker knows when it is one collection from firing and never says so.**
`gc_overhead_limit_near()` exists for the collector's own sizing decisions. There is no log, no
JFR event and no flag that surfaces it. If you want early warning you must compute GC-time
fraction yourself.

## Interview questions

**★ A candidate says "if the JVM spends 98 percent of its time in GC it throws `GC overhead limit
exceeded`". What is wrong with that?**
The collector. That check lives in Parallel GC's allocation path — `parallelScavengeHeap.cpp` is
the only heap implementation that ever writes `true` into the
`gc_overhead_limit_was_exceeded` out-parameter, and `memAllocator.cpp` uses that boolean to pick
between `"GC overhead limit exceeded"` and `"Java heap space"`. G1, Serial and ZGC take the
parameter and ignore it. Since G1 is the default on JDK 25, the statement is false for most
services: they thrash and then die of `Java heap space`, or get killed by the kernel first. The
`java` man page has the qualifier — *"the parallel GC will throw an OutOfMemoryError"* — and the
Troubleshooting Guide's description does not, which is where the folklore comes from.

**★ Your G1 service was GC-bound for forty minutes before it died, and nothing in the log said so.
What should have been in place?**
GC-time-as-a-fraction-of-wall-clock as a monitored metric, because the JVM will not raise it for
you on G1. Concretely: permanent rotated `-Xlog:gc*`, and an alert on the ratio of collector time
to elapsed time derived from it or from Micrometer's GC meters. Alerting on heap utilisation would
not have fired either, because a thrashing heap is at high utilisation *by design* between
collections. The failure mode you are looking for is "collections are frequent, long, and
reclaiming almost nothing" — three quantities all present in the GC log and none present in the
exception text.

**★ Is `-XX:-UseGCOverheadLimit` ever the right thing to add?**
Rarely, and only on Parallel GC, and only when you have consciously decided that a long GC-bound
stall is preferable to a restart — a batch job near the end of a run that will finish if left
alone, for instance. It has no effect at all on G1, Serial or ZGC, so adding it there is
cargo-culting. The much more interesting and almost unused option is the opposite direction:
`GCTimeLimit` and `GCHeapFreeLimit` are ordinary `product` flags, so on Parallel GC you can make
the check fire *sooner* and convert a hopeless grind into a fast failure with a message that names
the cause.

**★ How can a JVM throw `GC overhead limit exceeded` while the heap still has free space?**
Because the condition is about throughput, not about capacity. The documented rule is more than
about 98 percent of time in GC, less than 2 percent of the heap recovered, for five consecutive
collections — none of which requires an allocation to have failed. The intent is to stop a process
that is technically making progress but practically dead, and the design decision is that dying
early with a named cause is more useful than continuing. That is also why the message is a
*lateness* signal: by the time it appears the service has been unusable for a while.

{/* FOOTER */}
