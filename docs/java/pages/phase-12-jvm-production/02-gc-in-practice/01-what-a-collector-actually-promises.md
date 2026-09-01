---
title: "A garbage collector is a negotiation between throughput, pause time and footprint in which you get to state a preference and the JVM gets to fail to meet it, and every collector on the JDK is that same negotiation settled differently"
sidebar_label: "01 · What a collector promises"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **HotSpot Virtual Machine Garbage Collection Tuning Guide,
> Release 25**, chapters "Introduction to Garbage Collection Tuning", "Ergonomics", "The
> Parallel Collector" and "Garbage-First (G1) Garbage Collector"
> ([introduction](https://docs.oracle.com/en/java/javase/25/gctuning/introduction-garbage-collection-tuning.html),
> [ergonomics](https://docs.oracle.com/en/java/javase/25/gctuning/ergonomics.html),
> [parallel](https://docs.oracle.com/en/java/javase/25/gctuning/parallel-collector1.html),
> [g1](https://docs.oracle.com/en/java/javase/25/gctuning/garbage-first-g1-garbage-collector1.html)),
> the **JDK 25 `java` tool reference** for `-XX:MaxGCPauseMillis` and `-XX:GCTimeRatio`
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html)),
> and `src/hotspot/share/gc/shared/gc_globals.hpp` at tag `jdk-25+36`
> ([github.com/openjdk/jdk](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/gc/shared/gc_globals.hpp))
> for the shipped defaults of `MaxGCPauseMillis`, `GCPauseIntervalMillis` and `GCTimeRatio`.
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**Every conversation about "which collector should we use" goes wrong in the same place: the
participants have not agreed on what they are optimising. There are three quantities in
tension — how much CPU the application gets to keep, how long the longest stop is, and how
much memory the process holds — and no collector maximises all three. Before you can choose
a collector you have to be able to say which one you are willing to lose. This page is that
vocabulary, plus the two flags that let you state a preference and the exact sense in which
neither of them is a guarantee.**

## The three axes, and the JVM's own words for them

The tuning guide names two goals explicitly and treats the third as what is left over:

> *"The Java HotSpot VM garbage collectors can be configured to preferentially meet one of
> two goals: maximum pause-time and application throughput. If the preferred goal is met,
> the collectors will try to maximize the other. Naturally, these goals can't always be met:
> Applications require a minimum heap to hold at least all of the live data, and other
> configuration might preclude reaching some or all of the desired goals."*

And footprint:

> *"If the throughput and maximum pause-time goals have been met, then the garbage collector
> reduces the size of the heap until one of the goals (invariably the throughput goal) can't
> be met."*

The Parallel collector chapter states the priority order as an algorithm, and it is the same
order every adaptive collector in HotSpot uses:

> *"The goals are maximum pause-time goal, throughput goal, and minimum footprint goal, and
> goals are addressed in that order: The maximum pause-time goal is met first. Only after
> it's met is the throughput goal addressed. Similarly, only after the first two goals have
> been met is the footprint goal considered."*

Read that carefully, because it is the source of a whole class of surprise: **asking for a
shorter pause is asking for a bigger heap.** Footprint is the goal that gets sacrificed
first, and the collector will not tell you it did so unless you ask it with
`-Xlog:gc+ergo*=debug`.

## Throughput: `-XX:GCTimeRatio`, and the two different defaults

Throughput here is a ratio, not a rate:

> *"The throughput goal is measured in terms of the time spent collecting garbage, and the
> time spent outside of garbage collection is the application time. The goal is specified by
> the command-line option `-XX:GCTimeRatio=nnn`. The ratio of garbage collection time to
> application time is `1/(1+nnn)`. For example, `-XX:GCTimeRatio=19` sets a goal of 1/20th
> or 5% of the total time for garbage collection."*

The shipped default in `gc_globals.hpp` is:

```cpp
product(uint, GCTimeRatio, 99,
        "Adaptive size policy application time to GC time ratio")
        range(0, UINT_MAX)
```

`1/(1+99)` = **1%**, and that is what the Parallel collector aims at: *"The default value is
99, resulting in a goal of 1% of the time in garbage collection."*

G1 does not use that number. G1's tuning chapter, Table 8-1, lists **`-XX:GCTimeRatio=12`**
with its own explanation:

> *"This is the divisor for the target ratio of time that should be spent in garbage
> collection as opposed to the application. The actual formula for determining the target
> fraction of time that can be spent in garbage collection before increasing the heap is
> `1 / (1 + GCTimeRatio)`. This default value results in a target with about 8% of the time
> to be spent in garbage collection."*

So the *same flag* means "1% of wall time" under Parallel and "about 8% of wall time" under
G1, because G1 sets it ergonomically. If you carry a `GCTimeRatio` from a Parallel-tuned
service to a G1 service you are asking G1 to grow the heap eightfold more eagerly than it
was designed to. This is a specific, repeatedly-made mistake, and it is invisible unless you
check the *final* value rather than the one you set — which is `-XX:+PrintFlagsFinal`, owned
by **13 · JVM flags that matter in 2026** *(not written yet)*.

## Latency: `-XX:MaxGCPauseMillis` is a hint with a range, not a contract

The man page is unusually direct about this:

> *"`-XX:MaxGCPauseMillis=time` — Sets a target for the maximum GC pause time (in
> milliseconds). This is a soft goal, and the JVM will make its best effort to achieve it.
> The specified value doesn't adapt to your heap size. By default, for G1 the maximum pause
> time target is 200 milliseconds. The other generational collectors do not use a pause time
> goal by default."*

The ergonomics chapter explains the statistic behind "best effort", and it is not a maximum
at all:

> *"An average time for pauses and a variance on that average is maintained by the garbage
> collector. The average is taken from the start of the execution, but it's weighted so that
> more recent pauses count more heavily. If the average plus the variance of the pause-time
> is greater than the maximum pause-time goal, then the garbage collector considers that the
> goal isn't being met."*

**The goal is enforced against mean-plus-variance, not against the worst pause.** A
collector can be comfortably "meeting" a 200 ms goal while occasionally producing a 900 ms
pause, and it will report no problem, because the statistic it checks is not the one your
p99.9 cares about.

Note also the shipped default in the source, which is not 200:

```cpp
product(uintx, MaxGCPauseMillis, max_uintx - 1,
        "Adaptive size policy maximum GC pause time goal in millisecond, "
        "or (G1 Only) the maximum GC time per MMU time slice")
        range(1, max_uintx - 1)
```

`max_uintx - 1` is "effectively no goal". The 200 ms figure is a **G1 ergonomic override**,
listed in the tuning guide's Table 7-1 as `-XX:MaxGCPauseMillis=200`. That is why the same
flag, unset, means "200 ms" under G1 and "I do not have a pause goal" under Parallel. It
also means that when you read `MaxGCPauseMillis` out of `-XX:+PrintFlagsFinal` under
Parallel you will see an enormous number rather than a blank, and that number is the
sentinel, not a setting anyone chose.

G1 additionally reads the goal as one half of a **minimum mutator utilisation** pair:

> *"The `-XX:GCPauseIntervalMillis` and `-XX:MaxGCPauseTimeMillis` options provide G1 with a
> minimum mutator utilization (MMU) to fit garbage collection activity into. For every
> possible time range of `-XX:GCPauseIntervalMillis`, G1 sizes the collection pauses to at
> most use `-XX:MaxGCPauseTimeMillis` milliseconds for garbage collection pauses."*

⚠️ **`-XX:MaxGCPauseTimeMillis` in that sentence is a documentation typo.** No such flag
exists in `gc_globals.hpp`; the flag is `MaxGCPauseMillis`. Type the guide's spelling on a
JDK 25 command line and you get `Unrecognized VM option` and a failed launch. The interval
flag is real, and its shipped default is zero:

```cpp
product(uintx, GCPauseIntervalMillis, 0,
        "Time slice for MMU specification")
```

The tuning guide describes the ergonomic value instead: *"By default G1 doesn't set any
goal, allowing G1 to perform garbage collections back-to-back in extreme cases"*, and later,
*"The default value of `-XX:GCPauseIntervalMillis` is just slightly higher than
`-XX:MaxGCPauseMillis`."* Those two sentences are in tension with each other; what they
agree on, and what matters operationally, is that **nothing in the default configuration
stops G1 collecting back to back**, and the remedy when you see that is to raise
`GCPauseIntervalMillis`, not to lower the pause goal.

## Where the rest of the argument is

Three axes and two flags are the vocabulary. What they leave out — the CPU a concurrent
collector consumes, why a small pause percentage costs a large throughput percentage on a
big machine, and the parts of a real application stall that never appear in the pause
number — is [01b · What the pause number leaves out](01b-what-the-pause-number-leaves-out.md).

## Gotchas

**★ Footprint is the goal the collector sacrifices first, silently.**
The documented priority order is pause, then throughput, then footprint. If you tighten
`MaxGCPauseMillis` on an adaptive collector, the collector's first move is to grow the heap
so it can meet the goal — which in a container is exactly the resource you were trying to
protect. The tuning guide even says the footprint goal is what fails *"invariably"*.

**★ `-XX:GCTimeRatio` means two different things depending on the collector.**
The shipped default is 99 (1% of time in GC); G1 ergonomically sets it to 12 (about 8%).
Copying a `GCTimeRatio` between services running different collectors changes the heap-growth
policy by nearly an order of magnitude with no other visible symptom.

**★ `MaxGCPauseMillis` is checked against average-plus-variance, not against the worst pause.**
The ergonomics chapter defines the test explicitly. A collector "meeting" a 200 ms goal is
saying its exponentially-weighted mean plus variance is under 200 ms. Your p99.9 is a
different question, and the GC log is where you answer it, not the flag.

**★ The tuning guide's `-XX:MaxGCPauseTimeMillis` does not exist.**
It appears in the G1 chapter's MMU discussion. The real flag is `MaxGCPauseMillis`
(`gc_globals.hpp`). On JDK 25 an unrecognised `-XX:` option prints `Unrecognized VM option`
and the launch fails, so a copy-paste from that paragraph is a broken deploy, not a no-op.

**★ `MaxGCPauseMillis`'s *flag* default is `max_uintx - 1`; the 200 ms is a G1 ergonomic.**
So `-XX:+PrintFlagsFinal` under Parallel shows an astronomically large value for it. That is
the "no goal" sentinel, not a misconfiguration, and it is what the man page means by *"the
other generational collectors do not use a pause time goal by default"*.

**★ Nothing in the defaults prevents back-to-back collections under G1.**
`GCPauseIntervalMillis` ships as 0 and G1's own table records the goal as unset: *"By default
G1 doesn't set any goal, allowing G1 to perform garbage collections back-to-back in extreme
cases."* If you observe continuous collections with no application progress, the documented
remedy is to *raise* `GCPauseIntervalMillis` — a flag most people have never typed.

**★ A pause-time target does not adapt to heap size.**
The man page says so directly: *"The specified value doesn't adapt to your heap size."* A
100 ms goal that was comfortable on a 2 GB heap is a promise the collector cannot keep on a
64 GB heap with the same live set fraction, and it will respond by collecting far more often.

**★ "Throughput collector" does not mean "fast".**
It means the collector optimises the ratio of application time to GC time. On a workload
whose problem is a 4-second full GC every ten minutes, Parallel maximises exactly the metric
that is not broken.

## Interview questions

**★ What are you actually trading when you choose a garbage collector?**
Three things, and the JVM documents them in a fixed priority order: maximum pause time,
throughput (the fraction of wall time not spent in GC), and footprint (heap size, hence
process RSS). Adaptive collectors satisfy them in that order — pause first, throughput
second, footprint last — so tightening the pause goal grows the heap, and constraining the
heap costs you pause time or throughput or both. There is a fourth axis the documentation
does not put on the chart: CPU. Concurrent collectors do not do less work, they do it on
threads that run alongside the application, so on a CPU-constrained deployment a
low-latency collector can make latency worse.

**★ Is `-XX:MaxGCPauseMillis=50` a guarantee?**
No, in three distinct senses. First, the man page calls it *"a soft goal"* and says the JVM
makes *"its best effort"*. Second, the test the collector applies is average-plus-variance
against the goal, using an exponentially weighted average — so individual pauses can exceed
it substantially while the collector believes the goal is met. Third, G1's own chapter
states that it *"is not a real-time collector"* and meets targets *"with high probability
over a longer time, but not always with absolute certainty for a given pause"*. And even a
perfectly met goal does not bound your latency, because time-to-safepoint is not counted in
the pause figure at all.

**★ Someone lowers `MaxGCPauseMillis` from 200 to 20 and the service starts getting
OOMKilled. Explain.**
The pause goal has the highest priority of the three goals, so the collector's first move to
meet it is to make each collection do less work, which means collecting more often over a
smaller young generation, which means it wants more heap to keep throughput acceptable. The
footprint goal is the one that gets abandoned — the tuning guide says it fails
*"invariably"*. In a container, heap growth is committed memory, committed memory is RSS,
and RSS above the cgroup limit is an OOMKill. Nothing in the heap dump would show a leak;
the JVM did exactly what it was told.

**★ What does `-XX:GCTimeRatio=19` mean, and what is the default?**
It sets a goal that GC consumes at most `1/(1+19)` = 5% of total time. The flag's shipped
default in HotSpot is 99, i.e. 1%, which is what Parallel targets. G1 overrides it
ergonomically to 12, i.e. about 8%. The trap is that the flag is shared across collectors
but its meaning in practice is set by ergonomics, so "the default" depends on which
collector is running — and the only reliable way to know is `-XX:+PrintFlagsFinal`.

{/* FOOTER */}
