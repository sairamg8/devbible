---
title: "G1 does not move humongous objects, so a heap can be a third free and still unable to satisfy a two-megabyte allocation — and the documented end state of that is two Full GCs inside one pause followed, possibly, by an OutOfMemoryError"
sidebar_label: "03d2 · Humongous fragmentation"
sidebar_position: 17
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **HotSpot Virtual Machine Garbage Collection Tuning Guide,
> Release 25**, "Garbage-First (G1) Garbage Collector → Humongous Objects" and "Garbage
> Collection Pauses and Collection Set"
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/gctuning/garbage-first-g1-garbage-collector1.html)),
> and "Garbage-First Garbage Collector Tuning → Observing Full Garbage Collections" and
> "Humongous Object Fragmentation"
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/gctuning/garbage-first-garbage-collector-tuning.html));
> and the JDK 25 HotSpot sources at tag `jdk-25+36` —
> [`gc/g1/g1HeapTransition.cpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/gc/g1/g1HeapTransition.cpp)
> for the `Humongous regions:` log format string and
> [`gc/shared/gcCause.cpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/gc/shared/gcCause.cpp)
> for the `G1 Humongous Allocation` and `G1 Compaction Pause` cause strings.
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**[03d](03d-humongous-allocations.md) established what a humongous object is and how it gets
allocated. This page is the failure it leads to, which is unusual among GC failures in that
the memory graph exonerates you: the heap has free space, the allocation still fails, and the
JVM exits. It is a *contiguity* failure, it has a specific fingerprint in the log, and the
remedies are ordered — application first, region size second, heap size last.**

## They are effectively pinned

> *"Objects in humongous regions are treated differently. G1 typically does not move these
> objects, but only determines their liveness, and if they are not live, reclaims the space
> they occupy. **G1 only moves humongous objects in a very slow last-resort collection
> effort.**"*
>
> *"Humongous objects only move in a last-resort collection effort after a first Full GC failed
> to free enough contiguous memory for another humongous object allocation in a second Full GC
> in the same pause. This process is very slow. Due to space being unavailable for allocation
> in heap regions containing the end of humongous objects, **it is still possible that G1 exits
> the VM with an out-of-memory condition**."*

Read that twice. **Two Full GCs inside one pause, and then possibly an `OutOfMemoryError`
anyway**, because the free space exists but is not contiguous.

This is the property that makes humongous pressure qualitatively different from ordinary heap
pressure. G1's answer to fragmentation everywhere else is evacuation — it copies live objects
together and the fragmentation disappears. Humongous regions are the one part of the heap
where that answer does not apply, so fragmentation there is permanent until the objects die.

## They can force a marking cycle at any moment

> *"Allocations of humongous objects may cause garbage collection pauses to occur prematurely.
> G1 checks the Initiating Heap Occupancy threshold at every humongous object allocation and
> may force a Concurrent Start young collection immediately, if current occupancy exceeds that
> threshold and no marking is currently in progress."*

So a burst of large uploads does not just consume old-generation space, it can trigger
concurrent marking cycles at a rate set by *request traffic*. The GC cause string for this is
`G1 Humongous Allocation`, from `gcCause.cpp`, and it is one of the most informative causes in
the whole log: seeing it means an *allocation*, not an occupancy threshold, drove the
collection. The corresponding cause for the Full GC that may follow is `G1 Compaction Pause`,
which the tuning guide tells you to grep for:

> *"Full GCs caused by too high heap occupancy in the old generation can be detected by finding
> the words `Pause Full (G1 Compaction Pause)` in the log. Full GCs are typically preceded by
> garbage collections that encounter an evacuation failure with `Allocation` reason."*

## The fingerprint in the log

`-Xlog:gc+heap=info` prints a per-generation region summary at every collection. The format
string in `g1HeapTransition.cpp`:

```cpp
  log_info(gc, heap)("Humongous regions: %zu->%zu",
                     _before._humongous_length, after._humongous_length);
```

so the line reads `Humongous regions: <before>-><after>`. ⚠️ Note that Eden and Survivor get a
third parenthesised number (target capacity) and Old and Humongous do not — the source uses a
different call for each pair — which is a formatting difference that breaks naive log parsers.

The guide's instruction for reading it:

> *"You can determine the number of regions occupied by humongous objects on the Java heap
> using the `gc+heap=info` logging. Y in the lines `Humongous regions: X->Y` give you the amount
> of regions occupied by humongous objects. If this number is high compared to the number of
> old regions, the best option is to try to decrease this number of objects. You can achieve
> this by increasing the region size using the `-XX:G1HeapRegionSize` option."*

Alongside it, the same guide's list of things to do when Full GCs appear, of which humongous
objects are the first item:

> *"The reason that a Full GC occurs is because the application allocates too many objects that
> can't be reclaimed quickly enough. Often concurrent marking has not been able to complete in
> time to start a Space-Reclamation phase. **The probability to run into a Full GC can be
> compounded by the allocation of many humongous objects. Due to the way these objects are
> allocated in G1, they may take up much more memory than expected.**"*

*"Much more memory than expected"* is the wasted tail of the last region, multiplied by every
live humongous object.

## The fragmentation case, stated by the guide

> *"A Full GC could occur before all Java heap memory has been exhausted due to the necessity of
> finding a contiguous set of regions for them. Potential options in this case are increasing
> the heap region size by using the option `-XX:G1HeapRegionSize` to decrease the number of
> humongous objects, or increasing size of the heap. In extreme cases, there might not be enough
> contiguous space available for G1 to allocate the object even if available memory indicates
> otherwise. This would lead to a VM exit if that Full GC can not reclaim enough contiguous
> space. As a result, there are no other options than either decreasing the amount of humongous
> object allocations as mentioned previously, or increasing the heap."*

Two remedies from the guide, and it puts them in a definite order — **decrease the number of
humongous objects first**, and only then reach for the region size or the heap size.

## The application-side fix

Doubling the region size halves the number of humongous objects and costs you longer Object
Copy times and coarser remembered sets ([03b2](03b2-the-four-phases-of-a-pause.md)). It is a
mitigation. The actual fix is usually one of these:

- **Stream instead of buffering.** A request handler that reads an upload into a `byte[]`
  allocates one humongous object per request. A handler that copies through a fixed 8 KB
  buffer allocates nothing humongous ever.
- **Pre-size growable buffers.** `ByteArrayOutputStream` and `StringBuilder` double their
  backing array, so producing a 3 MB result allocates arrays of 1 MB, 2 MB *and* 4 MB along the
  way — three humongous objects instead of one, two of them immediately dead in the old
  generation. `new ByteArrayOutputStream(expectedSize)` removes the intermediate ones.

```java
// Three humongous arrays for one 3 MB result: 1 MB, 2 MB, 4 MB.
var out = new ByteArrayOutputStream();

// One, and it is the right size.
var out = new ByteArrayOutputStream(expectedSize);
```

- **Reuse a pooled buffer** where the lifetime is genuinely per-request and bounded.
- **Cap the size at the edge.** A request-size limit is a GC control as well as a security
  control: without one, a client chooses your allocation sizes.
- **Use a direct `ByteBuffer`** for large I/O buffers, which moves the bytes out of the heap
  entirely — with its own costs, in
  [01 · Memory layout → 07 · Direct and mapped buffers](../01-memory-layout/07-direct-and-mapped-buffers.md).

## Gotchas

**★ `ByteArrayOutputStream` and `StringBuilder` produce several humongous objects, not one.**
They grow by doubling, so building a 3 MB result allocates 1 MB, 2 MB and 4 MB arrays. Two of
those are immediately garbage — in the old generation. Pre-sizing the buffer is a one-line
change that removes them.

**★ Humongous allocation can trigger a concurrent marking cycle on its own.**
G1 checks IHOP *"at every humongous object allocation"* and may force a Concurrent Start
immediately. That makes marking frequency a function of request traffic rather than of
occupancy, and it shows up in the log with the cause `G1 Humongous Allocation`.

**★ G1 can exit with `OutOfMemoryError` while free memory exists.**
The failure is contiguity, not capacity: a humongous object needs a run of adjacent free
regions, and the guide states that *"there might not be enough contiguous space available for
G1 to allocate the object even if available memory indicates otherwise"*, leading to *"a VM
exit"*. A memory graph showing headroom is not evidence against this diagnosis;
`Humongous regions:` in `gc+heap=info` is the evidence for it.

**★ The last-resort path is two Full GCs in a single pause.**
Humongous objects move only *"after a first Full GC failed to free enough contiguous memory
for another humongous object allocation in a second Full GC in the same pause"*. The guide
calls it *"very slow"*. If you see two Full GCs back to back with no allocation between them,
this is what happened.

**★ Raising `G1HeapRegionSize` is a mitigation with a bill attached.**
Bigger regions mean fewer humongous objects and smaller remembered sets, and also more live
data to evacuate per region, which lengthens Object Copy. The guide recommends *decreasing the
number of humongous objects* first and treats the flag as the fallback. Re-read
`gc+phases=debug` afterwards to see where the time went.

**★ Evacuation fixes fragmentation everywhere in a G1 heap except the humongous regions.**
That asymmetry is the whole page. G1's answer to a fragmented old generation is to copy live
objects together; humongous objects are excluded from that answer, so their fragmentation
persists until they die. Reasoning about G1 as "a compacting collector, therefore
fragmentation is not a concern" is correct for everything except the objects most likely to
cause one.

**★ `Humongous regions:` has two numbers; `Eden regions:` has three.**
`g1HeapTransition.cpp` uses `log_regions()` with a capacity argument for Eden and Survivor and
a plain two-value `log_info` for Old and Humongous. A log parser written against the Eden line
silently mis-parses the Humongous one.

**★ A request-size limit is a garbage collection control.**
Without one, the size of the largest object your JVM allocates is chosen by whoever is calling
you. Every argument on this page about staying under the humongous threshold is void if a
client can send a 50 MB body. This is one of the few places where a security control and a GC
control are literally the same configuration line.

**★ Pooling large buffers moves the problem rather than solving it, unless the pool is
bounded.**
A pool of humongous buffers is a set of permanently live humongous regions. That is often the
right trade — permanently live is much better than repeatedly allocated and abandoned — but it
must be sized deliberately, because an unbounded pool under a load spike is the fragmentation
scenario with extra steps.

**★ "Increase the heap" is the guide's last option, not its first.**
Its ordering is: decrease the number of humongous allocations, then increase the region size,
then increase the heap. A bigger heap does raise the region size and therefore the threshold,
so it does help — but it helps by side effect, costs the most, and leaves the allocation
pattern in place to reappear at the next scale.

## Interview questions

**★ A service gets `OutOfMemoryError: Java heap space` while the heap graph shows 30% free.
What would you check?**
Humongous fragmentation. A humongous object needs a *contiguous* run of free regions, and G1
does not move humongous objects except in a last-resort path, so a heap can have plenty of
free regions scattered among pinned humongous ones and still be unable to satisfy a large
allocation. The tuning guide says exactly this: *"there might not be enough contiguous space
available for G1 to allocate the object even if available memory indicates otherwise"*, and
that this *"would lead to a VM exit"*. The evidence is in `-Xlog:gc+heap=info` — a high
`Humongous regions:` count relative to old regions — and in the GC causes, where you would
expect `G1 Humongous Allocation` and then `Pause Full (G1 Compaction Pause)`. The fix order
the guide gives is: reduce the number of humongous allocations, then increase the region size,
then increase the heap.

**★ Where do humongous allocations come from in a typical Spring service?**
Almost always from buffering something whose size is set by a client. Reading a multipart
upload or a request body into a `byte[]`; serialising a large response into a
`ByteArrayOutputStream`; building a big string with `StringBuilder`; a database driver
materialising a large `BLOB`; a JSON library buffering before writing. Growable buffers are
the worst offenders because they double, so producing a 3 MB result allocates 1 MB, 2 MB and
4 MB arrays and discards two of them straight into the old generation. The fixes are ordinary
engineering rather than GC work: stream rather than buffer, pre-size buffers whose final size
you can estimate, and enforce a request-size limit at the edge so a client cannot choose your
allocation size.

**★ Would you raise `G1HeapRegionSize` to fix humongous pressure?**
As a mitigation, and after trying to reduce the allocations. Doubling the region size doubles
the threshold, so a whole class of objects stops being humongous, and it also reduces
cross-region references and therefore remembered set size. What it costs is more live data per
region to evacuate, which lengthens the Object Copy sub-phase, and coarser granularity in
choosing a collection set, which makes each Mixed collection less precise. The guide's own
order is to decrease the number of humongous objects first and use the flag second, and
whichever you do, the honest check is `-Xlog:gc+phases=debug` before and after to see whether
the time moved rather than disappeared. Note also that the ergonomic ceiling is 32 MB but the
settable ceiling on 64-bit is 512 MB — the man page's *"1 MB to 32 MB"* is wrong.

**★ Why does humongous fragmentation not get fixed by G1's compaction, when G1 is a compacting
collector?**
Because compaction in G1 means *evacuation* — copying live objects out of chosen regions into
other regions — and humongous objects are explicitly excluded from it. The guide says G1
*"typically does not move these objects, but only determines their liveness"*, and moves them
only in a last-resort path after a Full GC has already failed to find contiguous space. So the
mechanism that removes fragmentation from the rest of the heap is not applied to the objects
that create the worst fragmentation. It is the single most counter-intuitive thing about G1
for anyone who has internalised "evacuating collectors do not fragment".

**★ You see two consecutive `Pause Full (G1 Compaction Pause)` entries with no application
activity between them. What does that mean?**
It is the documented humongous last-resort path. G1 ran a Full GC, it did not free a
contiguous run of regions large enough for a pending humongous allocation, and so it ran a
second Full GC *in the same pause* — this time permitted to move humongous objects, which the
guide describes as *"very slow"*. It is the most expensive thing a G1 heap can do, and the
next event after it is either a successful allocation or a VM exit with an out-of-memory
condition. Seeing it means the diagnosis is settled: this is humongous fragmentation, not
general heap pressure, and the remedy is to stop making objects that big.

{/* FOOTER */}
