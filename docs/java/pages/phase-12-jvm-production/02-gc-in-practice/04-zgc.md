---
title: "ZGC is generational and there is no other kind on JDK 25, it does every expensive thing concurrently by putting metadata inside the pointers themselves, and it never runs out of somewhere to copy to — which is why it has no evacuation failure and no Full GC in the sense G1 has one"
sidebar_label: "04 · ZGC"
sidebar_position: 20
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **HotSpot Virtual Machine Garbage Collection Tuning Guide,
> Release 25**, chapter "The Z Garbage Collector"
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/gctuning/z-garbage-collector1.html)),
> **JEP 439 · Generational ZGC**
> ([openjdk.org/jeps/439](https://openjdk.org/jeps/439)), **JEP 474** and **JEP 490**
> ([474](https://openjdk.org/jeps/474), [490](https://openjdk.org/jeps/490));
> the JDK 25 `java` tool reference for `-XX:+UseZGC` and `-XX:SoftMaxHeapSize`
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html));
> and the JDK 25 HotSpot sources at tag `jdk-25+36` —
> [`gc/z/zStat.cpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/gc/z/zStat.cpp)
> and [`gc/z/zDriver.cpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/gc/z/zDriver.cpp)
> for the `-Xlog:gc` line format and the `Minor Collection` / `Major Collection` names, and
> [`gc/z/z_globals.hpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/gc/z/z_globals.hpp)
> for the shipped flag defaults.
> JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9.

**ZGC's entire proposition is that pause time is independent of heap size, and it achieves it
by never doing anything expensive inside a pause: marking, relocation and reference updating
all run alongside the application. The mechanism is that a ZGC pointer is not just an address
— it carries metadata bits that let a barrier decide, on every read and every write, whether
the object needs attention. Everything ZGC is good at and everything it costs follows from
that one decision.**

## Start here: it is generational, and there is only one kind

The JDK 25 chapter carries the note in a box:

> *"As of JDK 24 ZGC is a generational garbage collector. The ZGenerational option has been
> removed."*

`-XX:+UseZGC` *is* generational ZGC on JDK 25. The flag history and its exact behaviour on this
release are [02c · What was removed](02c-what-was-removed.md). Every article telling you to add
`-XX:+ZGenerational` predates JDK 23.

## What ZGC promises

> *"The Z Garbage Collector (ZGC) is a scalable low latency garbage collector. ZGC performs all
> expensive work concurrently, without stopping the execution of application threads for more
> than a millisecond. It is suitable for applications which require low latency. Pause times are
> independent of the heap size that is being used. ZGC works well with heap sizes from a few
> hundred megabytes to 16TB."*

JEP 439 puts the comparison bluntly:

> *"ZGC's pause times are consistently measured in microseconds; by contrast the pause times of
> the default garbage collector, G1, range from milliseconds to seconds."*

And the design intent, which is the sentence that should shape every ZGC command line you
write:

> *"ZGC has been designed to be adaptive and to require minimal manual configuration. During the
> execution of the Java program, ZGC dynamically adapts to the workload by resizing generations,
> scaling the number of GC threads, and adjusting tenuring thresholds. **The main tuning knob is
> to increase the maximum heap size.**"*

There is no `MaxGCPauseMillis` for ZGC, no `NewRatio`, no survivor ratio, no tenuring threshold
to set. The knob is `-Xmx`.

## Coloured pointers

> *"A colored pointer is a pointer to an object in the heap which, along with the object's
> memory address, includes metadata that encodes the known state of the object. The metadata
> describes whether the object is known to be alive, whether the address is correct, and so
> forth. ZGC always uses 64-bit object pointers and can therefore accommodate metadata bits and
> object addresses for heaps up to many terabytes. When a field in an object refers to another
> object, ZGC implements that reference with a colored pointer."*

Two consequences that decide whether ZGC is even an option:

- **ZGC always uses 64-bit pointers**, so **compressed oops are off**. On a small heap that is
  a straight increase in footprint relative to G1 — every reference is eight bytes instead of
  four. See
  [01 · Memory layout → 09 · Compressed oops](../01-memory-layout/09-compressed-oops.md).
- The colours live in the pointer, not in the object, so ZGC's state machine costs nothing per
  object and everything per *access*.

## Load barriers and store barriers

> *"A load barrier is a fragment of code injected by ZGC into the application wherever the
> application reads a field of an object that refers to another object. The load barrier
> interprets the metadata of the colored pointer stored in the field and potentially takes some
> action before the application uses the referenced object."*
>
> *"Non-generational ZGC uses both colored pointers and load barriers. Generational ZGC also
> uses store barriers to efficiently keep track of references from objects in one generation to
> objects in another generation."*
>
> *"A store barrier is a fragment of code injected by ZGC into the application wherever the
> application stores references into object fields."*

Generational ZGC redistributed the work between them:

> *"In Generational ZGC the load barriers are responsible for: Removing metadata bits from
> colored pointers and updating stale pointers to objects that the GC relocated. The store
> barriers are responsible for: Adding metadata bits to create colored pointers, maintaining the
> remembered set, which tracks old-to-young generation object pointers, and marking objects as
> being alive."*

Marking moved from the load barrier to the store barrier, and the reason is a throughput
argument worth understanding:

> *"Moving marking out of load barriers makes it easier to optimize them, which is important
> because load barriers are often more frequently executed than store barriers."*

**Every reference read in your application executes a load barrier fast path.** That is where
ZGC's throughput cost lives — not in a pause you can see, but in a few instructions on the
hottest operation a JVM performs. The JEP describes the optimisation target: *"With careful
encoding of the memory address and metadata bits, a single shift instruction (on x64) can both
check whether the pointer requires processing and remove the metadata bits."*

## The remembered set is a pair of bitmaps, not a card table

> *"Many GCs use a remembered-set technique called card table marking … Typically, one byte in
> the table corresponds to an address range spanning 512 bytes in the heap."*
>
> *"Generational ZGC, by contrast, records object field locations precisely by using bitmaps in
> which each bit represents a single potential object field address. Each old-generation region
> has a pair of remembered-set bitmaps. One of the bitmaps is active and populated by application
> threads running their store barriers, while the other bitmap is used by the GC as a read-only
> copy … These two bitmaps are atomically swapped each time a young generation collection
> starts."*
>
> *"Another benefit is that, since this allows application threads and GC threads to work on
> distinct bitmaps, it removes the need for extra memory barriers between the two types of
> threads. **Other generational collectors that use card table marking, such as G1, require a
> memory fence when cards are marked, resulting in potentially worse store barrier
> performance.**"*

That last sentence is one of the few places where a JEP directly claims a *throughput*
advantage over G1, and it is on the write path specifically.

## Where the rest of ZGC is

Why ZGC has no evacuation failure and no humongous objects, how it ages regions in place, what
`System.gc()` does differently, and how to read a ZGC log line without mistaking a cycle for a
pause are [04b · Relocation, large objects and the ZGC log](04b-zgc-relocation-and-the-log.md).
What all of it costs — CPU, footprint, and the allocation stall that replaces the pause — is
[04c · What ZGC costs](04c-zgc-costs.md).

## Gotchas

**★ ZGC disables compressed oops.**
Coloured pointers require the full 64 bits. Every reference in the heap is eight bytes instead
of four, so a live set that fits in 4 GB under G1 may not under ZGC. On small heaps this alone
can make ZGC the wrong choice.

**★ Every reference read executes a load barrier.**
That is where ZGC's throughput cost is: a few instructions on the most frequent operation in
the JVM. It does not appear in any pause metric, in `jvm.gc.pause`, or in the GC log. It
appears as a slightly lower ceiling on requests per second, which is exactly the measurement
nobody takes before switching collectors.

**★ ZGC's tuning knob is `-Xmx` and the documentation says so.**
*"The main tuning knob is to increase the maximum heap size."* There is no pause goal, no
`NewRatio`, no survivor ratio and no tenuring threshold to set — ZGC *"dynamically adapts to the
workload by resizing generations, scaling the number of GC threads, and adjusting tenuring
thresholds"*. A ZGC command line carrying generational sizing flags is carrying dead weight.

**★ ZGC is never selected ergonomically.**
`GCConfig::select_gc_ergonomically()` picks G1 or Serial and nothing else. If you believe a
service is running ZGC, confirm it from the first line of `-Xlog:gc`, which reads
`Using The Z Garbage Collector` — not `Using Z`.

**★ Generational ZGC's store barrier does not need a memory fence; G1's card marking does.**
JEP 439 claims this directly as a throughput advantage on the write path. It is one of the few
concrete, mechanism-level reasons that generational ZGC can beat G1 on a store-heavy workload
rather than only on latency.

**★ What are coloured pointers and why does ZGC need them?**
A coloured pointer is a heap reference that carries metadata alongside the address —
*"whether the object is known to be alive, whether the address is correct, and so forth"*.
ZGC needs them because it relocates objects while the application is running, so a reference
the application holds may point at an object that has already moved. Rather than stopping the
world to fix every reference, ZGC encodes the object's state in the reference and puts a
barrier on every access: the load barrier reads the colour, and if the pointer is stale it
updates it and re-colours it so subsequent accesses take the fast path. The cost is that
ZGC must use full 64-bit pointers, which means compressed oops are unavailable, and that every
reference read and every reference store executes barrier code.

**★ Why does generational ZGC add store barriers when non-generational ZGC did not need them?**
Two reasons, and one of them is a redistribution rather than an addition. The first is the
remembered set: collecting the young generation independently requires knowing which
old-generation fields point into it, and store barriers are what record that. The second is
that JEP 439 moved *marking* out of the load barrier and into the store barrier, on the
argument that *"load barriers are often more frequently executed than store barriers"* — so
the load barrier becomes cheaper and simpler (remove metadata bits, update stale pointers)
while the store barrier takes on colouring, remembered-set maintenance and marking. Net, the
hot path gets faster and the colder path does more work.

**★ Why can ZGC keep pause times independent of heap size when G1 cannot?**
Because G1's pauses are where it evacuates, and evacuation cost is proportional to the live
data in the collection set — so a bigger heap with a bigger live set means either longer pauses
or a smaller collection set and more of them. ZGC does no evacuation in a pause at all. Its
pauses are the handful of operations that genuinely require the world to stop: swapping
marking state, scanning thread stacks for roots. Those scale with the number of threads, not
with the size of the heap. Everything that scales with the heap — marking, relocation,
reference updating — runs concurrently, made safe by coloured pointers and barriers. That is
why the tuning guide can say *"Pause times are independent of the heap size that is being
used"* and support *"heap sizes from a few hundred megabytes to 16TB"* with the same
sub-millisecond claim.

**★ What did generational ZGC change about the remembered set, and why is it interesting?**
It replaced card-table marking with a pair of per-region bitmaps in which *"each bit represents
a single potential object field address"*. One bitmap is being written by application threads
running store barriers while the other is a read-only copy the GC is processing, and the two
are swapped atomically at the start of each young collection. Two benefits follow. Application
threads never wait for a bitmap to be cleared, because the GC clears the one it owns. And
because the two sets of threads work on distinct bitmaps, no memory fence is needed between
them — JEP 439 notes that *"other generational collectors that use card table marking, such as
G1, require a memory fence when cards are marked, resulting in potentially worse store barrier
performance"*. It is precision (per-field rather than per-512-bytes) bought with memory, plus a
cheaper write path.

{/* FOOTER */}
