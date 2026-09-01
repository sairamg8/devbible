---
title: "JDK 25 ships four supported collectors and one experimental non-collector, G1 is the default on anything the JVM calls a server, and the two collectors most tutorials still discuss — CMS and non-generational ZGC — no longer exist"
sidebar_label: "02 · The four collectors"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **HotSpot Virtual Machine Garbage Collection Tuning Guide,
> Release 25**, chapters "Introduction to Garbage Collection Tuning", "Ergonomics" and
> "Available Collectors"
> ([introduction](https://docs.oracle.com/en/java/javase/25/gctuning/introduction-garbage-collection-tuning.html),
> [ergonomics](https://docs.oracle.com/en/java/javase/25/gctuning/ergonomics.html),
> [available-collectors](https://docs.oracle.com/en/java/javase/25/gctuning/available-collectors.html)),
> the **JDK 25 `java` tool reference** for `-XX:+UseSerialGC`, `-XX:+UseParallelGC`,
> `-XX:+UseG1GC`, `-XX:+UseZGC`
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html)),
> **JEP 474** and **JEP 490**
> ([openjdk.org/jeps/474](https://openjdk.org/jeps/474),
> [openjdk.org/jeps/490](https://openjdk.org/jeps/490)),
> and the JDK 25 HotSpot sources at tag `jdk-25+36` —
> [`gc/shared/gcConfig.cpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/gc/shared/gcConfig.cpp),
> [`gc/shared/gc_globals.hpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/gc/shared/gc_globals.hpp)
> and [`memory/universe.cpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/memory/universe.cpp).
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**The collector list is the single most out-of-date thing in circulating Java material. CMS
was removed in JDK 14 and its flags now fail a launch; non-generational ZGC was removed in
JDK 24 and its flag now warns and is ignored; the "four collectors" that appear in most
articles are Serial, Parallel, CMS and G1, which has been wrong for eleven releases. This
page is the list as JDK 25 actually ships it, the one-line reason each collector exists, and
how to find out in one command which one your process is running.**

## The list, from the guide's own count

> *"In the Java platform, there are currently four supported garbage collection alternatives
> and all but one of them, the serial GC, parallelize the work to improve performance."*

Four: **Serial, Parallel, G1, ZGC**. The source agrees, and adds two entries that are not
"supported alternatives" in the same sense — the `IncludedGCs` table in `gcConfig.cpp` is
the definitive enumeration of everything the flag parser knows about:

```cpp
static const IncludedGC IncludedGCs[] = {
   EPSILONGC_ONLY_ARG(IncludedGC(UseEpsilonGC,    CollectedHeap::Epsilon,    epsilonArguments,    "epsilon gc"))
        G1GC_ONLY_ARG(IncludedGC(UseG1GC,         CollectedHeap::G1,         g1Arguments,         "g1 gc"))
  PARALLELGC_ONLY_ARG(IncludedGC(UseParallelGC,   CollectedHeap::Parallel,   parallelArguments,   "parallel gc"))
    SERIALGC_ONLY_ARG(IncludedGC(UseSerialGC,     CollectedHeap::Serial,     serialArguments,     "serial gc"))
SHENANDOAHGC_ONLY_ARG(IncludedGC(UseShenandoahGC, CollectedHeap::Shenandoah, shenandoahArguments, "shenandoah gc"))
         ZGC_ONLY_ARG(IncludedGC(UseZGC,          CollectedHeap::Z,          zArguments,          "z gc"))
};
```

Six entries, of which **Epsilon is an experimental no-op** and **Shenandoah is conditionally
compiled** — the `_ONLY_ARG` macros are build-time switches, and Oracle's JDK builds do not
define `INCLUDE_SHENANDOAHGC`. Shenandoah gets its own page,
[02b · Shenandoah and availability](02b-shenandoah-and-availability.md), because "is it in
your JDK" is a real question with a real answer and no article ever asks it.

⚠️ **The "Available Collectors" chapter opens by saying there are three.** Its first
sentence is *"The Java HotSpot VM includes three different types of collectors, each with
different performance characteristics"* — and then the chapter lists four. The count is
stale; the four sections beneath it are correct, and the introduction chapter's "four" is
correct. When the tuning guide contradicts itself, prefer the enumeration over the count.

## What each one is for, verbatim

**Serial** — `-XX:+UseSerialGC`

> *"The serial collector uses a single thread to perform all garbage collection work, which
> makes it relatively efficient because there is no communication overhead between threads.
> It's best-suited to single processor machines because it can't take advantage of
> multiprocessor hardware, although it can be useful on multiprocessors for applications with
> small data sets (up to approximately 100 MB). The serial collector is selected by default
> on certain hardware and operating system configurations, or can be explicitly enabled with
> the option `-XX:+UseSerialGC`."*

**Parallel** — `-XX:+UseParallelGC`

> *"The parallel collector is also known as throughput collector, it's a generational
> collector similar to the serial collector. The primary difference between the serial and
> parallel collectors is that the parallel collector has multiple threads that are used to
> speed up garbage collection. The parallel collector is intended for applications with
> medium-sized to large-sized data sets that are run on multiprocessor or multithreaded
> hardware."*

**G1** — `-XX:+UseG1GC`, and the default

> *"G1 is a mostly concurrent collector. Mostly concurrent collectors perform some expensive
> work concurrently to the application. This collector is designed to scale from small
> machines to large multiprocessor machines with a large amount of memory. It provides the
> capability to meet a pause-time goal with high probability, while achieving high
> throughput."*
>
> *"**G1 is selected by default on most hardware and operating system configurations**, or can
> be explicitly enabled using `-XX:+UseG1GC`."*

**ZGC** — `-XX:+UseZGC`

> *"ZGC provides max pause times under a millisecond, but at the cost of some throughput. It
> is intended for applications, which require low latency. Pause times are independent of
> heap size that is being used. ZGC works well for heap sizes from a few hundred megabytes to
> 16TB."*

⚠️ The man page gives a different lower bound for the same collector — *"Supports heap sizes
from 8MB to 16TB"* — against the tuning guide's *"a few hundred megabytes"*. Both are
official; they are answering different questions (what the implementation accepts, versus
where it performs). Neither is a reason to run ZGC on an 8 MB heap.

## How the default is chosen

Ergonomics chapter:

> *"Garbage-First (G1) Collector on server-class machines, Serial Collector otherwise."*
>
> *"The VM considers machines as server-class if the VM detects two or more processors and
> physical memory larger than or equal to 1792 MB."*

The source is a six-line function, and it is worth reading because it makes the fallback
order explicit:

```cpp
void GCConfig::select_gc_ergonomically() {
  if (os::is_server_class_machine()) {
#if INCLUDE_G1GC
    FLAG_SET_ERGO_IF_DEFAULT(UseG1GC, true);
#elif INCLUDE_PARALLELGC
    FLAG_SET_ERGO_IF_DEFAULT(UseParallelGC, true);
#elif INCLUDE_SERIALGC
    FLAG_SET_ERGO_IF_DEFAULT(UseSerialGC, true);
#endif
  } else {
#if INCLUDE_SERIALGC
    FLAG_SET_ERGO_IF_DEFAULT(UseSerialGC, true);
#endif
  }
}
```

Note what is *not* in there: **ZGC is never selected ergonomically.** You get ZGC only by
asking for it. Note also that "two or more processors" in a container means the cgroup CPU
quota, so a pod with `limits.cpu: "1"` and 2 GB of memory is **not** a server-class machine
and silently gets the **Serial** collector. That single fact accounts for a large share of
"why is our small service so slow under load" reports, and it is the reason
[03 · Heap sizing in containers](../03-heap-sizing-in-containers/README.md) insists on
checking what you actually got.

## Which collector am I running? One line.

`universe.cpp` logs the choice at startup:

```cpp
log_info(gc)("Using %s", _collectedHeap->name());
```

so **the first line of any `-Xlog:gc` output names the collector**. The names come from each
heap's `name()` override, and they are not uniform:

| Collector | `-Xlog:gc` prints |
|---|---|
| Serial | `Using Serial` |
| Parallel | `Using Parallel` |
| G1 | `Using G1` |
| ZGC | `Using The Z Garbage Collector` |
| Epsilon | `Using Epsilon` |

ZGC is the odd one out because `ZCollectedHeap::name()` returns the constant `ZName`, defined
in `zGlobals.hpp` as `"The Z Garbage Collector"`. If you are grepping startup logs for the
collector across a fleet, that string is why your regex misses the ZGC hosts.

On a live process the equivalent is `jcmd <pid> VM.flags`, which prints the flags the VM
actually settled on, including the ergonomic `-XX:+UseG1GC` nobody typed.

## What is no longer on the list

CMS, non-generational ZGC and a shelf of collector-specific flags that people still paste
were all removed between JDK 14 and JDK 24, and on JDK 25 the consequences of carrying them
range from a warning line to a JVM that will not start. That is
[02c · What was removed, and what it costs you](02c-what-was-removed.md).

## The guide's own selection advice

Worth reading before the decision table in [06 · Choosing](06-choosing.md), because the
first sentence is the one people skip:

> *"Unless your application has rather strict pause-time requirements, first run your
> application and allow the VM to select a collector."*
>
> *"If the application has a small data set (up to approximately 100 MB), then select the
> serial collector with the option `-XX:+UseSerialGC`."*
>
> *"If (a) peak application performance is the first priority and (b) there are no pause-time
> requirements or pauses of one second or longer are acceptable, then let the VM select the
> collector or select the parallel collector with `-XX:+UseParallelGC`."*
>
> *"If response time is more important than overall throughput and garbage collection pauses
> must be kept shorter, then select the mostly concurrent collector with `-XX:+UseG1GC`."*
>
> *"If response time is a high priority, then select a fully concurrent collector with
> `-XX:+UseZGC`."*

And the caveat immediately after, which is the reason this topic exists at all:

> *"These guidelines provide only a starting point for selecting a collector because
> performance is dependent on the size of the heap, the amount of live data maintained by the
> application, and the number and speed of available processors."*

## Gotchas

**★ ZGC is never chosen ergonomically.**
`select_gc_ergonomically()` picks G1 on a server-class machine and Serial otherwise. There is
no configuration in which the JVM decides to use ZGC on your behalf. If you believe you are
running ZGC, check the first line of `-Xlog:gc`.

**★ A 1-CPU container is not a server-class machine, so it gets Serial.**
The threshold is *"two or more processors and physical memory larger than or equal to
1792 MB"*, evaluated against what the process can see, which under cgroups is the quota.
A `limits.cpu: "1"` pod gets the single-threaded collector and every collection is a full
stop with one thread doing the work. This is a common and completely invisible cause of poor
tail latency in small services.

**★ Grepping startup logs for `Using G1` will miss every ZGC host.**
ZGC's heap name is the constant `ZName = "The Z Garbage Collector"`, so the line reads
`Using The Z Garbage Collector`. Serial, Parallel, G1 and Epsilon all print their short
names. Match on `Using ` and capture the remainder.

**★ The "Available Collectors" chapter says three and then lists four.**
The introduction chapter's *"four supported garbage collection alternatives"* is the correct
count for JDK 25. Do not use the "three" sentence as evidence for anything.

**★ "The default collector" is not a fixed answer across your fleet.**
It is G1 on server-class hardware and Serial otherwise, decided per process at startup from
the CPU count and memory visible to that process. Two pods of the same image with different
resource limits can be running different collectors, and nothing in the application logs
would say so.

**★ The ZGC lower heap bound differs between the two official documents.**
Tuning guide: *"from a few hundred megabytes to 16TB"*. Man page: *"Supports heap sizes from
8MB to 16TB"*. If you are quoting a lower bound in a design document, quote which source you
took it from — they are not the same claim.

## Interview questions

**★ Which garbage collectors ship with JDK 25, and which is the default?**
Four supported collectors: Serial, Parallel, G1 and ZGC. G1 is the default — the tuning
guide's words are *"G1 is selected by default on most hardware and operating system
configurations"* — but only on what the VM classifies as a server-class machine, meaning two
or more processors and at least 1792 MB of physical memory as seen by the process; otherwise
the default is Serial. Two more collectors exist in the source: Epsilon, an experimental
no-op used for measurement, and Shenandoah, which is conditionally compiled and absent from
Oracle's builds. CMS is not on the list; it was removed in JDK 14.

**★ How do you find out which collector a running JVM is using?**
Three ways, in increasing intrusiveness. If `-Xlog:gc` was enabled at startup, the first line
is `Using <name>` — HotSpot logs it from `universe.cpp` as
`log_info(gc)("Using %s", _collectedHeap->name())`. On a live process, `jcmd <pid> VM.flags`
prints the flags the VM settled on, including ergonomic ones nobody typed. Offline, running
`java -XX:+PrintFlagsFinal -version` with the same options shows which `Use*GC` flag ends up
true. What you should not do is infer it from the deployment manifest, because if no
collector flag is present the answer depends on the CPU and memory the process actually saw.

**★ Two identical pods of the same image behave differently under load. One of them has much
worse tail latency. What GC-related explanation would you check first?**
Whether they are running the same collector. Collector selection is ergonomic and per
process: server-class means two or more processors and at least 1792 MB visible, so a pod
with a 1-CPU limit falls below the threshold and gets Serial, while its sibling with a 2-CPU
limit gets G1. Serial does every collection stop-the-world on one thread, which is exactly a
tail-latency profile. Nothing in the image, the manifest's env vars or the application logs
would show the difference; the first line of `-Xlog:gc` would.

{/* FOOTER */}
