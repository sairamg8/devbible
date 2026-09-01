---
title: "An object bigger than half a G1 region is allocated straight into the old generation as a run of whole regions that G1 will not move, so a service that reads megabyte payloads can fragment a heap into a Full GC and then into an OutOfMemoryError while the heap graph still shows free space"
sidebar_label: "03d · Humongous allocations"
sidebar_position: 16
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **HotSpot Virtual Machine Garbage Collection Tuning Guide,
> Release 25**, "Garbage-First (G1) Garbage Collector → Humongous Objects", "Heap Layout",
> "Garbage Collection Pauses and Collection Set" and Table 7-1
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/gctuning/garbage-first-g1-garbage-collector1.html)),
> and "Garbage-First Garbage Collector Tuning → Humongous Object Fragmentation" and "Observing
> Full Garbage Collections"
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/gctuning/garbage-first-garbage-collector-tuning.html));
> the JDK 25 `java` tool reference for `-XX:G1HeapRegionSize`
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html));
> and the JDK 25 HotSpot sources at tag `jdk-25+36` —
> [`gc/g1/g1CollectedHeap.hpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/gc/g1/g1CollectedHeap.hpp)
> for `is_humongous()` and `humongous_threshold_for()`,
> [`gc/g1/g1HeapTransition.cpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/gc/g1/g1HeapTransition.cpp)
> for the `Humongous regions:` log format, and
> [`gc/g1/g1_globals.hpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/gc/g1/g1_globals.hpp),
> in which **`G1EagerReclaimHumongousObjects` no longer exists** despite the tuning guide
> naming it twice.
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**Humongous allocation is the one G1 pathology that an application programmer can cause with
a single ordinary line of Java and never suspect. A large `byte[]`, a `StringBuilder` that
grew, a `ByteArrayOutputStream` that doubled — anything past half a region size — skips eden
entirely, lands in the old generation as a run of whole regions, and cannot be moved. The
threshold is derived from `-Xmx`, so it changes when someone edits a memory limit, and the
end state is a `Full GC` or an `OutOfMemoryError` on a heap that still reports free space.**

## The rule, and the correction

The guide:

> *"Humongous objects are objects larger or equal the size of half a region. The current region
> size is determined ergonomically as described in the Ergonomic Defaults for G1 GC section,
> unless set using the `-XX:G1HeapRegionSize` option."*

⚠️ **"larger or equal" is wrong. The test is strictly greater than.** From
`g1CollectedHeap.hpp`, with the JDK's own comment explaining why:

```cpp
  // Returns "true" iff the given word_size is "very large".
  static bool is_humongous(size_t word_size) {
    // Note this has to be strictly greater-than as the TLABs
    // are capped at the humongous threshold and we want to
    // ensure that we don't try to allocate a TLAB as
    // humongous and that we don't allocate a humongous
    // object in a TLAB.
    return word_size > _humongous_object_threshold_in_words;
  }

  // Returns the humongous threshold for a specific region size
  static size_t humongous_threshold_for(size_t region_size) {
    return (region_size / 2);
  }
```

An object of *exactly* half a region is not humongous. The reason is a TLAB invariant, not
tidiness: TLABs are capped at the threshold, so if "equal to half a region" were humongous a
maximum-size TLAB would itself be a humongous allocation. TLABs are
[01 · Memory layout → 03c](../01-memory-layout/03c-tlabs-and-allocation.md).

## The threshold is a function of `-Xmx`, which means it moves

Region size is ergonomic:

> *"`-XX:G1HeapRegionSize=<ergo>` — The size of the heap regions. The default value is based on
> the maximum heap size and it is calculated to render roughly 2048 regions, with a maximum
> ergonomically determined value of 32 MB. A size given by the user must be a power of 2, and
> valid values range from 1 to 512 MB."*

Since region size must be a power of two and ergonomics targets about 2048 regions, the
humongous threshold for a given heap is `region_size / 2`, and both are step functions of
`-Xmx`:

| `-Xmx` | ~`Xmx/2048` | Region size (power of 2) | Humongous above |
|---|---|---|---|
| 1 GB | 512 KB | 512 KB | 256 KB |
| 4 GB | 2 MB | 2 MB | 1 MB |
| 8 GB | 4 MB | 4 MB | 2 MB |
| 32 GB | 16 MB | 16 MB | 8 MB |
| 128 GB | 64 MB | **32 MB** (ergonomic cap) | 16 MB |

(The middle two columns are arithmetic from the documented rule, not measurements. The
authoritative value for your JVM is printed in the log: *"The currently selected heap region
size is printed at the beginning of the log."*)

**Read the last row carefully.** Past about 64 GB the ergonomic cap of 32 MB binds, so region
count grows instead of region size, and the humongous threshold stops rising at 16 MB.

And read the whole table as an operational hazard: **halving a container's memory limit halves
the region size and halves the humongous threshold.** A 1.5 MB response buffer that was an
ordinary old-generation object on an 8 GB heap becomes humongous on a 4 GB one. Nothing in the
application changed; someone edited a Kubernetes manifest.

## What happens to a humongous object

> *"Every humongous object gets allocated as a sequence of contiguous regions in the old
> generation. The start of the object itself is always located at the start of the first region
> in that sequence. **Any leftover space in the last region of the sequence will be lost for
> allocation until the entire object is reclaimed.**"*

So a 2.1 MB array on a 2 MB region size occupies two whole regions — 4 MB — and wastes 1.9 MB
until the array dies. Sizes just over a multiple of the region size are the worst case.

> *"An application always allocates into a young generation, that is, eden regions, **with the
> exception of humongous objects that are directly allocated as belonging to the old
> generation**."*

That single exception is why the weak generational hypothesis does not protect you here: a
humongous object that dies immediately still went into the old generation, and old-generation
garbage is only reclaimed by marking or a Full GC.

> *"Generally, humongous objects can be reclaimed only at the end of marking during the Remark
> pause, or during Full GC if they became unreachable. There is, however, a special provision
> for humongous objects for arrays of primitive types for example, `bool`, all kinds of
> integers, and floating point values. G1 opportunistically tries to reclaim humongous objects
> if they are not referenced by many objects at any garbage collection pause."*

**Eager reclaim** is the escape hatch, and its scope is narrow: *arrays of primitive types*,
not referenced by many objects. A humongous `Object[]`, a large `HashMap` table, or a
primitive array that half the application holds a reference to does not qualify and waits for
a Remark pause.

⚠️ **The guide then names a flag that does not exist on JDK 25.** It says the behaviour *"is
enabled by default but you can disable it with the option
`-XX:-G1EagerReclaimHumongousObjects`"*, and repeats it in the comparison section. Searching
`g1_globals.hpp` at tag `jdk-25+36` finds no such flag — only `G1EagerReclaimRemSetThreshold`,
an `EXPERIMENTAL` flag defaulting to 0. On JDK 25 `-XX:-G1EagerReclaimHumongousObjects` is an
unrecognised option and **the JVM will not start**. Eager reclaim itself is still in the
product; only the switch is gone.

## And then it gets worse

Humongous objects are not evacuated, which means a heap full of them cannot be compacted,
which is how a service reaches a Full GC and then an `OutOfMemoryError` with free space on the
graph. That, the `Humongous regions:` diagnostic and the application-side fixes are
[03d2 · Humongous fragmentation](03d2-humongous-fragmentation.md).

## Gotchas

**★ The threshold is *strictly greater than* half a region, not "greater or equal".**
The guide says *"larger or equal"*; `g1CollectedHeap.hpp` says `word_size > region_size / 2`,
with a comment explaining that the strictness exists so a maximum-size TLAB is not itself
humongous. An object of exactly half a region is a normal object.

**★ Halving `-Xmx` halves the humongous threshold.**
Region size is chosen to give roughly 2048 regions, so it scales with the heap, and the
threshold is half of it. A buffer that was ordinary on an 8 GB heap can be humongous on a
4 GB one. Reducing a container's memory limit is therefore a *GC behaviour* change, not only a
capacity change, and nothing in the application or its logs says so.

**★ `-XX:-G1EagerReclaimHumongousObjects` does not exist on JDK 25 and will stop the JVM.**
The tuning guide names it twice. It is not in `g1_globals.hpp` at tag `jdk-25+36`. An
unrecognised `-XX:` option prints `Unrecognized VM option` and aborts the launch. Eager
reclaim is still in the product; the switch is gone.

**★ Eager reclaim only applies to arrays of primitive types.**
The guide's list is *"`bool`, all kinds of integers, and floating point values"*, and only when
the object is *"not referenced by many objects"*. A humongous `Object[]`, the backing table of
a large `HashMap`, or a `byte[]` held by several caches all fall outside it and wait for a
Remark pause.

**★ A humongous object that dies instantly still went into the old generation.**
Humongous allocation bypasses eden, so the generational hypothesis provides no protection.
Ten thousand short-lived 2 MB buffers are ten thousand old-generation allocations, and the old
generation is only cleaned by marking or a Full GC.

**★ The tail of the last region is wasted until the whole object dies.**
The guide: *"Any leftover space in the last region of the sequence will be lost for allocation
until the entire object is reclaimed."* An object one byte over a region boundary wastes
nearly a whole region. Sizes just above a multiple of the region size are the pathological
case, and `2 MB + header` on a 2 MB region size is exactly that.

**★ What is a humongous object in G1, and what is special about it?**
An object strictly larger than half a G1 region — the source is explicit that the comparison is
`>` rather than `>=`, so that a maximum-size TLAB is not itself humongous. It is special in
four ways. It is allocated directly into the old generation rather than eden, so the
generational hypothesis never applies to it. It occupies a run of whole contiguous regions,
and the unused tail of the last region is *"lost for allocation until the entire object is
reclaimed"*. It is not evacuated — G1 determines its liveness but does not move it, except in a
last-resort path involving two Full GCs in one pause. And every humongous allocation causes G1
to check IHOP and possibly start a concurrent marking cycle immediately.

**★ How is the humongous threshold determined, and why does that make it an operational
hazard?**
Region size is set ergonomically to produce roughly 2048 regions from `-Xmx`, rounded to a
power of two, with an ergonomic maximum of 32 MB; the threshold is half of that. So it is a
step function of the heap size: about 1 MB on a 4 GB heap, 2 MB on 8 GB, 8 MB on 32 GB. The
hazard is that it moves when the heap moves. Halving a pod's memory limit halves the region
size, which halves the threshold, which can reclassify an entire category of the
application's buffers as humongous — with no code change, no configuration change inside the
JVM, and no line in any application log. The first symptom is usually `Humongous regions:`
climbing in `gc+heap=info` and Full GCs appearing.

**★ Why does the humongous threshold use a strict inequality when the documentation says
"larger or equal"?**
Because of TLABs. A thread-local allocation buffer is capped at the humongous threshold, so if
"exactly half a region" counted as humongous, a maximum-size TLAB request would itself be a
humongous allocation — the JDK source says so in a comment right above the test: *"this has to
be strictly greater-than as the TLABs are capped at the humongous threshold and we want to
ensure that we don't try to allocate a TLAB as humongous and that we don't allocate a humongous
object in a TLAB."* It is a boundary case that matters only if you are computing whether a
specific object size crosses the line, which is exactly what someone sizing a buffer to stay
under the threshold is doing.

**★ Why does eager reclaim only cover primitive arrays?**
Because a primitive array contains no references, so G1 can determine that reclaiming it
requires no marking of anything else — there is no outgoing edge to follow and no risk of
freeing something that still transitively keeps other objects alive. The guide's list is
*"arrays of primitive types for example, `bool`, all kinds of integers, and floating point
values"*, and the second condition is that the object is *"not referenced by many objects"*,
which keeps the remembered-set work bounded. A humongous `Object[]` or a large `HashMap`'s
backing table fails the first condition, so it can only be reclaimed at a Remark pause or a
Full GC. Practically this means a large `byte[]` buffer is the *best-case* humongous object
and a large array of objects is the worst.

{/* FOOTER */}
