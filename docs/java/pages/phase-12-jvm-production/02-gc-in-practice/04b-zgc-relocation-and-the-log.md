---
title: "ZGC marks everything before it moves anything, which is why it needs no reserved to-space, has no humongous objects and cannot suffer an evacuation failure — and why the number at the end of a ZGC log line is a whole concurrent cycle measured in seconds rather than a pause measured in milliseconds"
sidebar_label: "04b · Relocation and the ZGC log"
sidebar_position: 21
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against **JEP 439 · Generational ZGC** — "Relocations without additional
> heap memory", "Dense heap regions", "Large objects" and "Full garbage collections"
> ([openjdk.org/jeps/439](https://openjdk.org/jeps/439)); the **HotSpot Virtual Machine Garbage
> Collection Tuning Guide, Release 25**, chapter "The Z Garbage Collector"
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/gctuning/z-garbage-collector1.html));
> and the JDK 25 HotSpot sources at tag `jdk-25+36` —
> [`gc/z/zStat.cpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/gc/z/zStat.cpp)
> for `ZSIZE_FMT` and the `log_info(gc)` format string,
> [`gc/z/zDriver.cpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/gc/z/zDriver.cpp)
> for the `Minor Collection` / `Major Collection` names,
> [`gc/z/zGlobals.cpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/gc/z/zGlobals.cpp)
> for `ZName`, and
> [`gc/shared/gcCause.cpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/gc/shared/gcCause.cpp)
> for the ZGC cause strings.
> JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9.

**Two passes instead of one is the whole difference. Because ZGC finishes marking before it
starts relocating, it knows exactly what is live before it moves anything — so it never has to
guess how much to-space it needs, never fails to find somewhere to copy to, and never needs a
Full GC to recover. That single structural choice also removes humongous objects as a concept.
This page is that mechanism, the two other things it enables, and how to read the log line it
produces without mistaking a concurrent cycle for a pause.**

## No evacuation failure, because relocation needs no spare memory

This is the property that has no G1 analogue:

> *"Young-generation collections in other HotSpot GCs use a scavenging model where live objects
> are found and relocated in a single pass. All objects in the young generation must be relocated
> before the GC has complete knowledge about what objects were alive. GCs using this model can
> reclaim memory only after all objects have been relocated. Thus these GCs need to guess the
> amount of memory needed for the surviving objects and ensure that said amount of memory is
> available when the GC starts. If the guess is wrong then a more expensive cleanup operation is
> needed; e.g., in-place pinning of non-relocated objects, which leads to fragmentation, or a
> full GC with all application threads stopped."*
>
> *"Generational ZGC uses two passes: The first visits and marks all reachable objects, and the
> second relocates marked objects. Because the GC has complete liveness information before the
> relocation phase starts, it can partition the relocation work on a per-region granularity. As
> soon as all live objects have been relocated out of a region, i.e., the region has been
> evacuated, that region can be reused as a new target region for relocations or for allocations
> by application threads. Even when there are no more free regions to relocate objects into, ZGC
> can still proceed by compacting objects into the currently relocated regions. **This allows
> Generational ZGC to relocate and compact the young generation without using additional heap
> memory.**"*

So there is no `Evacuation Failure`, no to-space exhaustion and no promotion-failure Full GC in
ZGC, and every G1 remedy built around `G1ReservePercent` or headroom for survivors is
inapplicable. What ZGC has instead, when reclamation cannot keep up with allocation, is an
**allocation stall** — the allocating thread waits — and that is
[04c · What ZGC costs](04c-zgc-costs.md).

## Aging in place, and large objects

Two more differences from the generational model in
[01 · Memory layout → 03d](../01-memory-layout/03d-aging-and-promotion.md):

> *"When relocating objects out of the young generation, the number of live objects and the
> amount of memory they occupy will differ across regions. … ZGC analyzes the density of
> young-generation regions in order to determine which regions are worth evacuating and which
> regions are either too full or too expensive to evacuate. The regions that are not selected
> for evacuation are aged in place: Their objects remain at their locations and the regions are
> either kept in the young generation as survivor regions or promoted into the old generation.
> The objects in the surviving regions get a second chance to die in the hope that, by the time
> the next young-generation collection starts, enough objects will have died to make more of
> these regions eligible for evacuation."*
>
> *"ZGC already handles large objects well. By decoupling virtual memory from physical memory
> and over-reserving virtual memory, ZGC can usually dodge the fragmentation problems that
> sometimes make it difficult to allocate large objects when using G1. In Generational ZGC we
> take this a step further by allowing large objects to be allocated in the young generation.
> Given that regions can be aged without relocating them, there is no need to allocate large
> objects in the old generation just to prevent expensive relocations. Instead, they can be
> collected in the young generation if they are short-lived or be cheaply promoted to the old
> generation if they are long-lived."*

**ZGC has no humongous-object problem**, and the second quotation explains *why* rather than
just asserting it: G1 puts large objects in the old generation because it would otherwise have
to relocate them, and ZGC does not have to, because a region can be aged without being moved.
Everything in [03d · Humongous allocations](03d-humongous-allocations.md) simply does not
apply. For a service whose GC problem is megabyte buffers, this is a stronger argument for
switching than any pause number.

Note also what "aged in place" costs: a region that is too full or too expensive to evacuate is
*kept*, contents and all, including the garbage in it. ZGC trades some retained garbage for not
having to copy — the same kind of trade as G1's `G1MixedGCLiveThresholdPercent`, made
automatically.

## `System.gc()` does something different under ZGC

> *"When the old generation is collected, there will be pointers from objects in the young
> generation to objects in the old generation. These pointers are considered roots of the
> old-generation object graph. Objects in the young generation mutate often, so young-to-old
> generation pointers are not tracked. Instead these pointers are found by running a
> young-generation collection along with the old-generation marking phase."*
>
> *"This extra young-generation collection will still execute as a normal young-generation
> collection and leave live objects in the surviving regions. One effect of this is that
> surviving objects in the young generation will not be subject to the reference processing and
> class unloading done when collecting the old generation. This could be observed by an
> application that, for example, releases the last reference to an object graph, invokes
> `System.gc()`, and then expects some weak reference to be cleared or enqueued or some class to
> be unloaded. To mitigate this, **when a GC is requested explicitly by application code then an
> extra young-generation collection is done first**, before the old-generation collection starts,
> to promote all surviving objects into the old generation."*

Two things follow. A `System.gc()` under ZGC is *more* work than it looks — an extra young
collection, then the young-plus-old marking pass. And a test that asserts "after `System.gc()`
this weak reference is cleared" or "this class is unloaded" is testing collector-specific
behaviour, and JEP 439 documents exactly the scenario in which it would have failed without
this mitigation.

Note also the asymmetry it reveals: ZGC tracks **old-to-young** pointers in the remembered set
and does *not* track young-to-old, because *"objects in the young generation mutate often"*.
Collecting the old generation therefore requires a young collection to run alongside it, which
is why a `Major Collection` in the log is genuinely a major event.

## Reading a ZGC log

The `-Xlog:gc` line is built by a different code path from G1's, and the differences matter.
From `zStat.cpp`:

```cpp
#define ZSIZE_FMT  "%zuM(%.0f%%)"

log_info(gc)("%s (%s)", name(), GCCause::to_string(cause));                  // at start

log_info(gc)("%s (%s) " ZSIZE_FMT "->" ZSIZE_FMT " %.3fs",                   // at end
             name(), GCCause::to_string(cause),
             ZSIZE_ARGS(used_at_start()), ZSIZE_ARGS(used_at_end),
             duration.seconds());
```

and `zDriver.cpp` supplies the names:

```cpp
static const ZStatPhaseCollection ZPhaseCollectionMinor("Minor Collection", true  /* minor */);
static const ZStatPhaseCollection ZPhaseCollectionMajor("Major Collection", false /* minor */);
```

Five things a G1 reader gets wrong on sight:

1. **`Minor Collection` / `Major Collection`, not `Pause Young` / `Pause Full`.** The presence
   of both strings is direct evidence that ZGC is generational.
2. **Heap sizes carry a percentage**, `%zuM(%.0f%%)`, which G1's format does not.
3. **The duration is in seconds (`%.3fs`), not milliseconds.** A ZGC line reading `1.234s` next
   to a G1 line reading `1.234ms` is three orders of magnitude apart, and a dashboard that
   strips the unit is wrong by that much.
4. **That duration is the whole cycle, not a pause.** ZGC's cycle is almost entirely concurrent;
   the pauses inside it are sub-millisecond and are logged separately under `gc+phases`. Reading
   the `gc` line as a pause time is the single most common ZGC log misreading.
5. **There are two lines per collection.** `register_start` logs `<name> (<cause>)` with no
   sizes; `register_end` logs the same prefix plus sizes and duration. A parser keying on the
   name alone double-counts every collection. There is a third possibility —
   `<name> (<cause>) Aborted` — when the cycle is abandoned.

The first line of the log names the collector, and ZGC's name is not the short one you expect:
`zGlobals.cpp` defines `ZName` as `"The Z Garbage Collector"`, so the startup line reads
`Using The Z Garbage Collector`. See [02 · The four collectors](02-the-four-collectors.md).

ZGC-specific causes from `gcCause.cpp` — `Timer`, `Warmup`, `Allocation Rate`,
`Allocation Stall`, `Proactive`, `High Usage` — are covered in
[07b · Reading a GC log](07c-reading-a-gc-log.md), and `Allocation Stall` in particular is
[04c](04c-zgc-costs.md).

## Gotchas

**★ The number at the end of a ZGC `gc` line is seconds and is not a pause.**
G1 prints `%.3fms` for a stop-the-world pause; ZGC prints `%.3fs` for a mostly-concurrent
cycle. Comparing the two numbers directly — which every "ZGC vs G1" spreadsheet does at least
once — compares a pause against a cycle and gets the unit wrong as well.

**★ There is no evacuation failure and no promotion-failure Full GC in ZGC.**
Relocation is a second pass with complete liveness information, so ZGC can compact into
regions it is already relocating and needs no reserved to-space. Every G1 remedy involving
`G1ReservePercent`, to-space exhaustion or Full GC is inapplicable. What replaces them is the
allocation stall — [04c](04c-zgc-costs.md).

**★ ZGC has no humongous-object concept.**
Large objects are allocated in the young generation and benefit from ZGC's decoupling of
virtual from physical memory. For a service whose GC problem is megabyte buffers, this is the
strongest single argument for switching, and it is almost never the one people cite.

**★ "Aged in place" means garbage is retained on purpose.**
A young region that is too dense to be worth evacuating is kept as-is and either stays a
survivor region or is promoted whole. Its dead objects go with it. This is a deliberate trade
of footprint for CPU, and it is one of the reasons a ZGC heap sits higher than its live set.

**★ `System.gc()` under ZGC runs an extra young collection first.**
JEP 439 documents the behaviour and its reason: without it, objects surviving in the young
generation would escape the reference processing and class unloading of an old-generation
collection. The practical consequence is that a `System.gc()` is more expensive than it looks,
and that a test asserting weak-reference clearing after `System.gc()` behaves differently here
than under G1.

**★ ZGC tracks old-to-young references and not young-to-old.**
Which is why collecting the old generation requires running a young collection alongside it —
that is how young-to-old roots are found. A `Major Collection` therefore costs strictly more
than a `Minor Collection` plus an old-generation pass, and treating them as independent when
reading a log is wrong.

**★ Each ZGC collection produces at least two `gc` lines.**
One at start with the name and cause only, one at end with sizes and duration, and possibly an
`Aborted` variant instead. A log parser that counts occurrences of `Minor Collection` counts
each collection twice.

**★ ZGC's startup line is `Using The Z Garbage Collector`.**
`ZName` is a full sentence where every other collector's `name()` is a single word. A fleet-wide
grep for `Using Z` finds nothing.

**★ "ZGC pauses are under a millisecond" is a claim about pauses, not about latency.**
Pause time is not the only way a collector delays a request. ZGC's replacement mechanism —
stalling an allocating thread when reclamation cannot keep up — does not stop the world and
does not appear in the pause figure at all. [04c](04c-zgc-costs.md).

## Interview questions

**★ Why does ZGC not have evacuation failure or to-space exhaustion?**
Because it separates marking from relocation. Collectors like G1 evacuate in a single pass and
must therefore reserve enough space in advance for objects they have not yet finished
discovering; if that guess is wrong they fail and fall back to pinning or a Full GC. ZGC marks
everything first, so before it moves a single object it knows exactly what is live and where.
That lets it relocate region by region and reuse each region the moment it is empty, and JEP
439 notes that *"even when there are no more free regions to relocate objects into, ZGC can
still proceed by compacting objects into the currently relocated regions"*. The result is
relocation *"without using additional heap memory"*. The failure mode it has instead is the
allocation stall, which delays a thread rather than stopping the world.

**★ You are reading a ZGC log and a G1 log side by side. What must you not do?**
Compare the numbers at the end of the `gc` lines. G1's is a stop-the-world pause printed with
`%.3fms`; ZGC's is a whole mostly-concurrent cycle printed with `%.3fs`. They differ in unit
and in meaning. ZGC's actual pauses are sub-millisecond and appear under the `gc+phases` tag,
not on the top-level line. The other differences are that ZGC's collections are named
`Minor Collection` and `Major Collection` rather than `Pause Young` and `Pause Full`, its heap
figures carry a percentage as well as a size, its GC causes are a different set — `Timer`,
`Warmup`, `Allocation Rate`, `Allocation Stall`, `Proactive`, `High Usage` — and each
collection produces two lines rather than one.

**★ A service allocates 4 MB response buffers and is suffering G1 Full GCs. Argue for ZGC.**
The specific reason, not the general one. Under G1 a 4 MB buffer is humongous on any heap up
to about 32 GB, which means it is allocated directly into the old generation as a run of whole
regions, is not evacuated, wastes the tail of its last region, and can force a marking cycle at
every allocation — and a heap full of them fragments in a way G1's compaction does not fix,
ending in Full GCs and possibly an `OutOfMemoryError` with free space on the graph. ZGC has no
humongous concept at all: JEP 439 says it *"can usually dodge the fragmentation problems that
sometimes make it difficult to allocate large objects when using G1"* and that generational ZGC
allows *"large objects to be allocated in the young generation"*, so a short-lived buffer dies
young where it should. What I would check before switching is CPU headroom and heap size,
because ZGC costs both — and that the throughput loss from load barriers plus the loss of
compressed oops is acceptable.

**★ What does "aged in place" mean and what does it cost?**
It means ZGC decides, per young region, whether evacuating it is worth the copying — regions
that are too densely populated or too expensive are left exactly where they are and simply
relabelled, either staying in the young generation as survivors or being promoted whole into
the old generation. The benefit is that ZGC copies far less than a strict copying collector
would, and that large objects need no special handling because a region containing one can be
promoted without moving it. The cost is retained garbage: whatever dead objects were in that
region travel with it, so a ZGC heap holds more floating garbage than its live set implies.
JEP 439's phrasing is that the surviving objects *"get a second chance to die"* — which is a
fair description of both the benefit and the cost.

**★ Why does collecting ZGC's old generation require a young collection at the same time?**
Because ZGC's remembered set only tracks old-to-young pointers. Young-to-old pointers are not
tracked, and JEP 439 gives the reason — *"objects in the young generation mutate often"*, so
maintaining that direction would be expensive for little benefit. But those young-to-old
pointers are roots of the old-generation object graph and must be found before the old
generation can be marked. ZGC finds them by running a young collection alongside the
old-generation marking phase and passing the pointers it discovers to the old marking process.
The practical consequence is that a `Major Collection` in the log is doing both generations,
and comparing its duration against a `Minor Collection` is not comparing like with like.

{/* FOOTER */}
