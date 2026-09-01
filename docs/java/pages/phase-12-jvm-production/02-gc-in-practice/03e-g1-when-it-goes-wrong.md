---
title: "G1 has exactly two ways to fail — it cannot find somewhere to copy an object to, or concurrent marking loses a race against the allocation rate — and both end in the same place, a stop-the-world compaction of the whole heap that G1 exists to avoid"
sidebar_label: "03e · When G1 goes wrong"
sidebar_position: 18
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **HotSpot Virtual Machine Garbage Collection Tuning Guide,
> Release 25**, "Garbage-First (G1) Garbage Collector → Evacuation Failure", "Garbage
> Collection Cycle" and "Collection Set"
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/gctuning/garbage-first-g1-garbage-collector1.html)),
> and "Garbage-First Garbage Collector Tuning → Observing Full Garbage Collections"
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/gctuning/garbage-first-garbage-collector-tuning.html));
> the JDK 25 `java` tool reference for `-XX:+ExplicitGCInvokesConcurrent` and
> `-XX:+DisableExplicitGC`
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html));
> **JEP 423 · Region Pinning for G1**
> ([openjdk.org/jeps/423](https://openjdk.org/jeps/423)) as cited by the guide; and the JDK 25
> HotSpot sources at tag `jdk-25+36` —
> [`gc/shared/gcCause.cpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/gc/shared/gcCause.cpp)
> for the cause strings and
> [`gc/g1/g1_globals.hpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/gc/g1/g1_globals.hpp)
> for `G1ReservePercent` and `G1NumCollectionsKeepPinned`.
> The example log line in "The exact log line" below is **quoted verbatim from the tuning
> guide**, not produced by any run.
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**A healthy G1 log contains young collections, occasional Concurrent Start / Remark / Cleanup
sequences, and Mixed collections. It does not contain `Evacuation Failure` and it does not
contain `Pause Full`. Those two strings are the whole of G1 pathology, they have four
distinct causes between them, and each cause has a different remedy — which is why "we saw a
Full GC, add more heap" is right about a third of the time.**

## Failure one: nowhere to copy to

G1 reclaims by evacuating. Evacuation needs a destination. When there is not one:

> *"Evacuation failure means that G1 could not move some objects during garbage collection."*
>
> *"Such an occurrence is indicated in garbage collection logs with `-Xlog:gc` logging using an
> `Evacuation Failure: <reason>` printout where `<reason>` is one or both of `Allocation` and
> `Pinned`."*
>
> *"**Allocation**: G1 could not find enough space in the destination area to move the object
> to."*
>
> *"**Pinned**: There is an object that G1 could not move because G1 found an object that has
> been locked in place, or pinned, to allow safe use of native code on it using a
> `GetPrimitiveArrayCritical()` or similar JNI call."*

### The exact log line

The tuning guide prints this example, quoted here verbatim from the guide — it is Oracle's
output, not a run of mine:

```
[9,740s][info ][gc] GC(26) Pause Young (Normal) (G1 Evacuation Pause) (Evacuation
Failure: Allocation/Pinned) 2159M->402M(3000M) 6,108ms
```

Three things to notice. `Evacuation Failure:` carries a slash-separated reason list, so
`Allocation/Pinned` means both occurred in that collection. The decimal separator is a comma,
because unified logging formats numbers in the platform locale — a real hazard for log
parsers and a real reason to pin `-Duser.language` on machines whose logs are machine-read.
And the pause is 6 seconds on a 3 GB heap, in a collection whose *type* is
`Pause Young (Normal)`; an evacuation failure turns a young collection into something an order
of magnitude more expensive without changing its name.

### What happens afterwards

> *"If G1 cannot move all objects out of a region, that region will be unavailable for
> allocation temporarily. G1 schedules these regions for immediate evacuation in the next
> garbage collections as collection set candidates."*
>
> *"Regions that experienced evacuation failure very often contain very few objects. This makes
> them very efficient regions to collect, so they are made collection set candidate regions by
> default."*

So a single evacuation failure is self-healing: the failed regions are cheap to collect and go
to the front of the queue. **A burst of them is a warning; a steady stream of them is the
problem.** And if a collection frees nothing at all:

> *"In the worst case, if garbage collection does not manage to free any space at all during a
> garbage collection, G1 will schedule a Full GC. This type of garbage collection performs
> in-place compaction of the entire heap. This might be very slow."*

### The `Allocation` reason and `G1ReservePercent`

`Allocation` means the survivors did not fit. G1 keeps a buffer against exactly this:

```cpp
product(uint, G1ReservePercent, 10,
        "It determines the minimum reserve we should have in the heap "
        "to minimize the probability of promotion failure.")
        range(0, 50)
```

Ten percent by default, and Adaptive IHOP aims to begin space reclamation *"when the old
generation occupancy is at a current maximum old generation size minus"* that reserve. Raising
it makes G1 start marking earlier and keeps more headroom for survivors; it costs you usable
heap. (⚠️ The G1 chapter calls this flag `G1HeapReservePercent`, which does not exist — see
[03c](03c-g1-pause-time-and-the-knobs.md).)

### The `Pinned` reason, and why it is new

Pinning used to be much worse. JEP 423, delivered in JDK 22, changed how G1 handles JNI
critical regions:

> *"For interoperability with unmanaged programming languages such as C and C++, JNI defines
> functions to get and then release direct pointers to Java objects. … Code within such
> function pairs is considered to run in a critical region, and the Java object available for
> use during that time is a critical object."*
>
> *"The default GC, G1, takes the latter approach, disabling GC during every critical region.
> This has a significant impact on latency: If a Java thread triggers a GC then it must wait
> until no other threads are in critical regions. … In the worst cases users report critical
> sections blocking their entire application for minutes, unnecessary out-of-memory conditions
> due to thread starvation, and even premature VM shutdown."*

The fix, in the JEP's own description:

> *"During a minor collection, treat pinned regions in the young generation as having failed
> evacuation, thus promoting them to the old generation. Do not evacuate existing pinned
> regions in the old generation."*

**So `Evacuation Failure: Pinned` is not a bug — it is the mechanism.** JEP 423 deliberately
routes pinning through the evacuation-failure path so that garbage collection no longer has to
be disabled. The cost is that a region containing a critical object gets promoted to the old
generation whether or not its contents deserve promotion.

There is a bound on how long G1 will keep trying:

```cpp
product(uint, G1NumCollectionsKeepPinned, 8, DIAGNOSTIC,
        "After how many GCs a region has been found pinned G1 should "
        "give up reclaiming it.")
```

Eight collections, and then G1 stops treating that region as a candidate. Note the
`DIAGNOSTIC` classification — changing it needs `-XX:+UnlockDiagnosticVMOptions` first.

The libraries most likely to produce this are the ones doing zero-copy native I/O. The JEP
names two that avoided critical regions entirely because of the old behaviour: *"the
maintainers of some Java libraries and frameworks have chosen not to use critical regions by
default (e.g., JavaCPP) or even at all (e.g., Netty)"*.

## The other three roads to a Full GC

Evacuation failure is one way in. Concurrent marking losing its race against the allocation
rate is the second, an external caller requesting a collection is the third, and a periodic GC
you configured is the fourth. All of them, with the cause strings that tell them apart, are
[03e2 · The road to a Full GC](03e2-the-road-to-a-full-gc.md).

## Gotchas

**★ An evacuation failure turns a young collection into something an order of magnitude more
expensive without changing its name.**
The guide's own example line is a `Pause Young (Normal)` lasting 6 seconds. If you alert on
"Full GC" you will not see it; if you alert on pause duration you will. Alert on duration.

**★ `Evacuation Failure: Pinned` is a mechanism, not a defect.**
JEP 423 deliberately routes JNI critical regions through the evacuation-failure path so that
GC no longer has to be disabled during them. The alternative, which is what pre-JDK-22 G1 did,
was blocking the whole application — the JEP reports *"critical sections blocking their entire
application for minutes"*. A few `Pinned` failures in a JNI-heavy service are the new
behaviour working.

**★ The reason field can list both reasons at once.**
`Evacuation Failure: Allocation/Pinned` means the collection hit both. Treating the string as
an enum rather than a set is a parsing bug, and diagnosing only one of the two causes is a
diagnosis bug.

**★ Unified logging formats numbers in the platform locale.**
The guide's own example prints `[9,740s]` and `6,108ms` — comma decimal separators. A log
parser expecting a dot silently mis-reads every duration in a European locale. If GC logs are
machine-read, pin the locale on the JVM command line.

**★ One evacuation failure is self-healing; a stream of them is the incident.**
Failed regions *"very often contain very few objects"*, so G1 makes them collection set
candidates by default and cleans them up cheaply in the next collections. If they are still
appearing several collections later, the heap has no headroom and the next event is a Full GC.

**★ `G1ReservePercent` is the flag that exists; `G1HeapReservePercent` is the one the G1
chapter names.**
Both appear in the same document, in different chapters. Only the former is in
`g1_globals.hpp`; the latter fails the launch. Default 10, range 0–50, plain `product` flag.

**★ What is an evacuation failure and what causes it?**
It is G1 being unable to move an object during a collection, reported in the log as
`Evacuation Failure:` followed by one or both of two reasons. `Allocation` means there was not
enough space in the destination — the survivors did not fit, so the heap has no headroom.
`Pinned` means an object was locked in place for native code, through
`GetPrimitiveArrayCritical` or a similar JNI call, and G1 cannot move a region containing one.
The immediate effect is that the region is left in place, marked as failed, and made unusable
for allocation for the moment; G1 then makes it a high-priority collection set candidate,
because such regions *"very often contain very few objects"* and are cheap to collect. A
single failure is self-correcting. Repeated failures mean the heap has no headroom, and the
end of that road is a Full GC.

**★ Why would you see `Evacuation Failure: Pinned` on a JDK 25 service that never saw it on
JDK 17?**
Because JEP 423, delivered in JDK 22, changed how G1 handles JNI critical regions. Before it,
G1 *disabled garbage collection entirely* while any thread was inside a critical region, which
in bad cases blocked the whole application for minutes. Now G1 pins the affected regions and
treats a pinned young region as having failed evacuation, promoting it to the old generation
and continuing to collect everything else. So the log message is new and the behaviour it
represents is much better than what it replaced. What it does cost you is unwanted promotion:
the contents of a pinned region go to the old generation regardless of their age.
`G1NumCollectionsKeepPinned`, a diagnostic flag defaulting to 8, bounds how many collections
G1 keeps retrying such a region.

**★ How would you tell an `Allocation` evacuation failure from a `Pinned` one, and why does
it matter?**
The log tells you directly — the reason list after `Evacuation Failure:` is one or both of
`Allocation` and `Pinned` — and they lead to completely different investigations. `Allocation`
is a headroom problem: the survivors of this collection did not fit in the destination
regions, which means the heap is running close to its live set, and the levers are heap size,
`G1ReservePercent` and starting marking earlier. `Pinned` is a JNI problem: some thread was
inside a critical region holding a direct pointer to an object, so G1 could not move that
object's region. The levers there are in the application and its libraries — which native
integrations use `GetPrimitiveArrayCritical`, and how long they hold it — and no GC flag will
help. Diagnosing a `Pinned` failure as heap pressure is a week spent adding memory that
changes nothing.

**★ What is the relationship between evacuation failure and promotion failure?**
They are the same event described from two sides. G1 evacuates by copying live objects out of
collection set regions into destination regions; for young regions with objects old enough to
tenure, the destination is the old generation, so a failure to find space there is what older
literature calls promotion failure. G1's own flag for the buffer against it says so —
`G1ReservePercent` is documented as *"the minimum reserve we should have in the heap to
minimize the probability of promotion failure"* — while the log message says
`Evacuation Failure: Allocation`. The reason the vocabulary matters is that most search
results about promotion failure predate G1 and describe CMS, where the remedies were different
and several of the flags no longer exist.

{/* FOOTER */}
