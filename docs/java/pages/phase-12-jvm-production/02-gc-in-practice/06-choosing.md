---
title: "Choosing a collector is answering four questions in order — is there a latency requirement, is it being missed, is there CPU and memory to pay with, and is the collector in your JDK — and the honest answer for most services is the one the JVM already picked"
sidebar_label: "06 · Choosing a collector"
sidebar_position: 26
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **HotSpot Virtual Machine Garbage Collection Tuning Guide,
> Release 25**, "Available Collectors → Selecting a Collector"
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/gctuning/available-collectors.html)),
> "Introduction to Garbage Collection Tuning"
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/gctuning/introduction-garbage-collection-tuning.html)),
> "Ergonomics → Tuning Strategy"
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/gctuning/ergonomics.html)),
> "Garbage-First (G1) Garbage Collector → Comparison to Other Collectors" and "Garbage-First
> Garbage Collector Tuning → General Recommendations / Moving to G1 from Other Collectors"
> ([g1](https://docs.oracle.com/en/java/javase/25/gctuning/garbage-first-g1-garbage-collector1.html),
> [g1-tuning](https://docs.oracle.com/en/java/javase/25/gctuning/garbage-first-garbage-collector-tuning.html)),
> and "The Z Garbage Collector"
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/gctuning/z-garbage-collector1.html)).
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**Most collector changes are made for the wrong reason: someone read that ZGC has
sub-millisecond pauses, or that G1 is "modern", or that Parallel is "old". None of those is a
requirement. A collector choice is only defensible if you can name the number it is supposed to
move, say what it currently is, and say what you are willing to give up. This page is the order
of the questions, the documentation's own selection rules, and a decision table that starts
from the requirement rather than from the collector.**

## Question zero: do nothing

> *"Unless your application has rather strict pause-time requirements, first run your application
> and allow the VM to select a collector. If necessary, adjust the heap size to improve
> performance. If the performance still doesn't meet your goals, then use the following
> guidelines as a starting point for selecting a collector."*
>
> *"When does the choice of a garbage collector matter? For some applications, the answer is
> never. That is, the application can perform well in the presence of garbage collection with
> pauses of modest frequency and duration. However, this isn't the case for a large class of
> applications, particularly those with large amounts of data (multiple gigabytes), many threads,
> and high transaction rates."*
>
> *"Don't choose a maximum value for the heap unless you know that you need a heap greater than
> the default maximum heap size."*

**The default is a decision that has already been made competently.** G1's defaults are aimed at
*"relatively small, uniform pauses at high throughput"*, which is the correct compromise for a
web service. If nobody can state a number that is being missed, the work is finished.

## The guide's own selection rules

> *"If the application has a small data set (up to approximately 100 MB), then select the serial
> collector with the option `-XX:+UseSerialGC`."*
>
> *"If the application will be run on a single processor and there are no pause-time requirements,
> then select the serial collector with the option `-XX:+UseSerialGC`."*
>
> *"If (a) peak application performance is the first priority and (b) there are no pause-time
> requirements or pauses of one second or longer are acceptable, then let the VM select the
> collector or select the parallel collector with `-XX:+UseParallelGC`."*
>
> *"If response time is more important than overall throughput and garbage collection pauses must
> be kept shorter, then select the mostly concurrent collector with `-XX:+UseG1GC`."*
>
> *"If response time is a high priority, then select a fully concurrent collector with
> `-XX:+UseZGC`."*

and the caveat, which is why this page has more in it than that list:

> *"These guidelines provide only a starting point for selecting a collector because performance
> is dependent on the size of the heap, the amount of live data maintained by the application,
> and the number and speed of available processors."*

Note the escalation in the last two rules. G1 is for *"response time is more important than
overall throughput"*. ZGC is for *"response time is a **high priority**"*. That is a deliberate
distinction and it is much narrower than the enthusiasm around ZGC suggests.

## The four questions, in order

**1 · Is there a latency requirement, stated as a number?**
Not "it should be fast". A percentile and a threshold: p99 under 200 ms, p99.9 under 1 second.
If nobody can produce one, the answer is Parallel if the workload is a batch and G1 otherwise,
and the conversation is over.

**2 · Is that requirement being missed, and is GC the reason?**
This is the step people skip. A p99 of 400 ms with a 30 ms worst pause is not a GC problem —
see [01b · What the pause number leaves out](01b-what-the-pause-number-leaves-out.md) for the
three stalls a clean GC log hides, and [10 · Safepoints](10-safepoints.md) for the most common
one. Measure with `-Xlog:gc*` and, before changing collectors, with `-Xlog:gc+phases=debug`
([03b2](03b2-the-four-phases-of-a-pause.md)). A GC problem that turns out to be one bad
allocation site is [11 · When tuning is the wrong answer](11-when-tuning-is-the-wrong-answer.md).

**3 · Is there CPU and memory to pay with?**
A concurrent collector spends CPU it takes from the application and memory it takes from your
container limit. On a `limits.cpu: "1"` pod there is nothing to spend, and the guide's own
comparison says so from the other direction: G1 *"may exhibit higher overhead than the above
collectors, affecting throughput due to its concurrent nature"*, and *"ZGC aims to provide
significantly smaller pause times at further cost of throughput"*.

**4 · Is the collector in your JDK?**
Only relevant for Shenandoah, and it is a real question with a one-command answer —
[02b2 · Is Shenandoah in your JDK?](02b2-is-shenandoah-in-your-jdk.md).

## The decision table

Driven by the requirement, not by the collector:

| Requirement | Constraint | Collector | Why |
|---|---|---|---|
| Finish as fast as possible; pauses irrelevant | multi-core | **Parallel** | least work per byte reclaimed; no pause goal to satisfy |
| Small heap (~100 MB) or 1 CPU or tiny container | footprint | **Serial** | no remembered sets, no concurrent threads, lowest native overhead |
| Web service, p99 in the hundreds of milliseconds | any | **G1** (default) | balanced defaults; already what you are running |
| p99 in single-digit milliseconds, heap tens of GB or larger | CPU and memory headroom available | **ZGC** | pauses independent of heap size |
| Large short-lived buffers causing G1 Full GCs | CPU available | **ZGC** | no humongous-object concept at all |
| p99 in single-digit milliseconds, no spare CPU | — | **G1**, and fix the allocation | a concurrent collector will make it worse |
| Heap > 16 TB | — | none | ZGC's documented ceiling is 16 TB |
| Startup time is the metric | — | **Serial** | fewest structures to initialise; see [10 · Packaging](../10-packaging-for-deploy/README.md) |

## What to measure before and after

A collector change is an experiment, and an experiment without a control is an anecdote. The
minimum set:

- **Throughput** — requests per second at a fixed latency, or wall-clock time to completion.
  This is the number a concurrent collector is most likely to cost you, and the number nobody
  records before switching.
- **Pause distribution**, not mean pause. p99 and p99.9 of `jvm.gc.pause`, or the durations from
  the GC log. A mean pause is the least informative statistic available.
- **Resident memory**, not heap. The container is killed on RSS, and remembered sets, marking
  bitmaps and eight-byte references all live outside `-Xmx`.
- **CPU utilisation**, including `gc+cpu`'s `User`, `Sys` and `Real`.
- **Allocation stalls** if the candidate is ZGC — `jdk.ZAllocationStall` in JFR, because they
  appear in no other instrument ([04c](04c-zgc-costs.md)).

And equalise the environment. The transparent-huge-page trap in
[04c2](04c2-zgc-memory-and-when-not-to.md) can decide a G1-versus-ZGC comparison on its own.

## How to migrate

> *"Generally, when moving to G1 from other collectors, start by removing all options that affect
> garbage collection, and only set the pause-time goal and overall heap size by using `-Xmx` and
> optionally `-Xms`."*
>
> *"Many options that are useful for other collectors to respond in some particular way, have
> either no effect at all, or even decrease throughput and the likelihood to meet the pause-time
> target."*

That advice generalises to every collector change. Flags are collector-specific far more often
than they look — `-XX:+UseStringDeduplication` and `-XX:+ExplicitGCInvokesConcurrent` are G1-only,
`-XX:+UseAdaptiveSizePolicy` and `-XX:InitialSurvivorRatio` are Parallel-only,
`-XX:SoftMaxHeapSize` and `-XX:+ZUncommit` are ZGC-only, and `-Xmn` actively sabotages G1. A
migration that carries the old flag set forward is measuring two changes at once.

The full retired and inert-flag inventory is
**13 · JVM flags that matter in 2026** *(not written yet)*.

## Gotchas

**★ "Which collector should we use" is almost never the first question.**
The first question is what number is being missed. A large fraction of collector changes are
made against a p99 that GC was not responsible for, and the change costs throughput while the
real cause — time to safepoint, a non-GC stop-the-world operation, or one allocation site — goes
on doing what it was doing.

**★ The guide distinguishes "response time is more important than throughput" from "response
time is a high priority".**
The first sends you to G1, the second to ZGC. That is a narrower gate for ZGC than most
discussions assume, and it is stated in the same five-bullet list people quote when arguing
for it.

**★ A collector change on a CPU-constrained container makes latency worse.**
Concurrent collectors relocate GC work onto threads that share your quota. On a one- or two-CPU
pod there is no spare capacity, so "switch to a low-latency collector" subtracts from the
application. `gc+cpu`'s `Real` versus `User + Sys` tells you whether you already have this
problem.

**★ Nobody measures throughput before switching, and throughput is what they pay.**
Every concurrent collector's documentation says it costs throughput — the ZGC chapter in its
first sentence, G1's comparison section in as many words. A change that improves p99.9 and
costs 15% of peak requests per second may still be correct, but it should be known.

**★ Carrying the old flag set through a collector change measures two things at once.**
Flags are collector-specific more often than they appear, and several are actively harmful
across a migration — `-Xmn` disables G1's pause-time control, `-XX:SurvivorRatio` is not in
charge under Parallel's adaptive sizing, and half a dozen flags are simply inert outside their
own collector. Strip to `-Xmx`, `-Xms` and a pause goal, then add back what a measurement
justifies.

**★ The default collector is not the same on every host in your fleet.**
Ergonomics chooses G1 on a server-class machine and Serial otherwise, per process, from the CPU
count and memory the process can see. Two pods of the same image with different limits can be
running different collectors. Confirm from the first line of `-Xlog:gc` before comparing
anything.

**★ ZGC will never be chosen for you.**
There is no ergonomic path to ZGC in `GCConfig::select_gc_ergonomically()`. If you want it, you
ask for it, and if you believe you have it, verify it.

**★ "Large heap" is not by itself an argument for ZGC.**
G1 is documented for *"heap sizes up to tens of GBs or larger, with more than 50% of the Java
heap occupied with live data"*. The argument for ZGC is pause time that does not scale with the
heap, which only matters if pause time scaling with the heap is currently hurting you.

**★ A "GC problem" that is really an allocation problem follows you to the new collector.**
Changing collector changes how the garbage is collected, not how much of it there is. If the
service allocates 2 GB per second, every collector will be busy; ZGC will simply be busy
concurrently until it stalls. [11 · When tuning is the wrong answer](11-when-tuning-is-the-wrong-answer.md).

**★ Benchmarks published by anyone are about their workload.**
Live-set size, allocation rate, object graph shape, thread count, CPU count and kernel huge-page
settings all move the result, and the guide says so: performance *"is dependent on the size of
the heap, the amount of live data maintained by the application, and the number and speed of
available processors"*. The only comparison that decides anything is yours.

**★ Deciding not to change is a result, and should be written down.**
The most valuable output of a collector evaluation is often a short note saying which
alternatives were measured, what they cost, and why the default won — because otherwise the same
evaluation gets proposed again in six months.

## Interview questions

**★ How would you choose a garbage collector for a new service?**
By not choosing one, initially. The JVM picks G1 on any server-class machine and its defaults
are aimed at small uniform pauses at high throughput, which is the right compromise for a
typical service; the tuning guide's own advice is to *"first run your application and allow the
VM to select a collector"*. I would only revisit that if there is a stated latency requirement,
expressed as a percentile and a threshold, that measurement shows is being missed *because of
GC* rather than because of safepoints, non-GC stop-the-world operations or a slow dependency.
If it is genuinely GC and there is CPU and memory headroom to pay with, ZGC is the candidate;
if there is no latency requirement at all and the workload is a batch, Parallel is; if the heap
is tiny or the container has one CPU, Serial already is.

**★ A team wants to move a service from G1 to ZGC. What do you ask for?**
Four things. The requirement, as a number: which percentile, what threshold, what it is today.
Evidence that GC is the cause — GC log durations and `gc+phases` breakdowns, plus a check that
time-to-safepoint is not the real culprit. The resource budget: ZGC costs CPU for barriers and
concurrent threads, costs footprint because coloured pointers rule out compressed oops, and
needs heap headroom whose size the documentation explicitly declines to specify. And a
throughput measurement from before the change, because that is what will be paid and nobody
records it. If all four are in hand, I would run the comparison with equalised huge-page
settings, identical `-Xms`/`-Xmx`, and `jdk.ZAllocationStall` collected — because a stall is
invisible in every pause metric.

**★ When is Parallel the right answer in 2026?**
Whenever the metric is total work rather than pause distribution. Batch jobs, ETL, nightly
reports, CI builds, compilers, stream-processing executors — anything where the question is
"how long did the whole thing take". Parallel does less work per byte reclaimed than G1: no
remembered sets, no write barrier for cross-region references, no concurrent threads, no
collection-set selection. It also has no default pause goal, so it never sacrifices throughput
for a latency target nobody asked for, where G1 defaults to a 200 ms goal and an 8% GC-time
target. The guide's rule is explicit — peak performance first, and pauses of a second or more
acceptable. Nothing about it is deprecated on JDK 25.

**★ What would make you decide *against* a collector change even though it improved the metric
you were targeting?**
Three things. A throughput cost that pushes the service past its capacity headroom — improving
p99.9 by 40 ms and losing 15% of peak requests per second is a bad trade if you are at 80% of
capacity. A footprint increase that puts the container near its memory limit, because the
failure mode there is an OOMKill rather than a slow response, and remembered sets, bitmaps and
eight-byte references all live outside `-Xmx`. And a dependency that constrains deployment — in
practice that means Shenandoah, which is conditionally compiled and absent from some vendors'
JDKs, so choosing it makes the base image a correctness dependency rather than a preference.

**★ How do you make a fair comparison between two collectors?**
Equalise everything that is not the collector, and measure more than the thing you are hoping
to improve. Same JDK build, same CPU allocation, same `-Xms` and `-Xmx` (noting that equal
values disable ZGC's uncommit), same workload and same warmup. Check the kernel's transparent
huge page settings, because a common Linux default enables them for private pages but not for
shmem, and ZGC uses shmem huge pages for the heap — so the guide warns that *"all GCs but ZGC
will make use of transparent huge pages for the heap"*, which decides the benchmark on its own.
Then measure throughput, the pause distribution at p99 and p99.9 rather than the mean, resident
memory rather than heap, CPU including the `gc+cpu` breakdown, and — if ZGC is a candidate —
allocation stalls via JFR, since they are the failure mode that no pause metric can see.

**★ Someone points at a published benchmark showing collector X beating collector Y. How much
should that move you?**
Almost not at all, unless their workload resembles yours in live-set size, allocation rate,
object graph shape, thread count and CPU allocation. The tuning guide says as much when it
qualifies its own selection guidance: performance *"is dependent on the size of the heap, the
amount of live data maintained by the application, and the number and speed of available
processors"*. On top of that, published comparisons routinely measure only pause time, which
guarantees the concurrent collector wins and says nothing about the throughput and footprint it
cost; and on Linux they are frequently invalidated by huge-page settings that favour one
collector. A published benchmark is a reason to run your own, not a substitute for it.

{/* FOOTER */}
