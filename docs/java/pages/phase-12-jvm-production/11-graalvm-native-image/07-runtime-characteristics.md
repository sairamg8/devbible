---
title: "A native image still has a garbage collector, a heap and a sizing policy — Serial GC by default at 80% of physical memory, G1 only on Oracle GraalVM on Linux at 25%, and a set of flags that look like HotSpot's and are not"
sidebar_label: "07 · Runtime characteristics"
sidebar_position: 13
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09 against the **GraalVM Native Image reference** — "Memory Management"
> ([graalvm.org](https://www.graalvm.org/latest/reference-manual/native-image/optimizations-and-performance/MemoryManagement/)),
> "Build Options" ([graalvm.org](https://www.graalvm.org/latest/reference-manual/native-image/overview/BuildOptions/)) and
> "Object Header Size in Native Image"
> ([graalvm.org](https://www.graalvm.org/latest/reference-manual/native-image/optimizations-and-performance/ObjectHeaderSize/)).
> Target: **JDK 25 · GraalVM 25.3.4.1 · Spring Boot 4.1.0 / Spring Framework 7.0.8**.
> Documentation-validated; **no sandbox run** — no heap size, RSS figure or pause time on this page is a measurement.

**"There is no JVM" is a useful slogan and a misleading one for memory. A native executable contains a full memory-management subsystem: a heap that grows and shrinks, generational collection, an automatic sizing policy, and a set of `-XX:` options. What it does not contain is HotSpot's collector set, HotSpot's ergonomics or HotSpot's defaults — and the two things people carry over unchanged, `-XX:MaxRAMPercentage` and the assumption that G1 is available, are exactly the two that behave differently.**

## There is a runtime, and it is not HotSpot

> *"A native image, when being executed, does not run on the Java HotSpot VM but on the runtime system provided with GraalVM. That runtime includes all necessary components, and one of them is the memory management."*

> *"Java objects that a native image allocates at run time reside in the area called "the Java heap". The Java heap is created when the native image starts up, and may increase or decrease in size while the native image runs. When the heap becomes full, a garbage collection is triggered to reclaim memory of objects that are no longer used."*

So everything topic 02's mental model gives you about generational collection still applies conceptually. What changes is the menu.

## The three collectors

| | Available | Default max heap when unset | Notes |
|---|---|---|---|
| **Serial GC** | everywhere, both distributions | **80% of physical memory** | *"the default GC in GraalVM Native Image … optimized for low memory footprint and small Java heap sizes"* |
| **G1 GC** | 🔴 **Oracle GraalVM only, Linux AMD64/AArch64 only** | **25% of physical memory** | *"a multithreaded GC that is optimized to reduce stop-the-world pauses and therefore improve latency, while achieving high throughput"* |
| **Epsilon GC** | everywhere, GraalVM 21.2+ | — | *"a no-op garbage collector that does not do any garbage collection and therefore never frees any allocated memory"* |

The availability sentence is worth quoting because it is the one people miss:

> *"Currently, G1 Garbage Collector can be used with Native Image on the Linux AMD64 and AArch64 architectures. (Not available in GraalVM Community Edition.)"*

Selection is a **build-time** decision — `--gc=serial`, `--gc=G1`, `--gc=epsilon` — not a run-time flag. You cannot switch collectors on an existing binary.

**Epsilon has one honest use case and the reference names it:** *"The primary use case for this GC are very short running applications that only allocate a small amount of memory."* A function invocation that allocates a few megabytes and exits genuinely does not need collection. Anything else will exhaust the heap and die.

### What Serial GC actually is here

> *"In its core, the Serial GC is a simple (non-parallel, non-concurrent) stop and copy GC. It divides the Java heap into a young and an old generation. Each generation consists of a set of equally sized chunks, each a contiguous range of virtual memory."*

Young objects go to eden, survivors to a survivor region, and *"alive objects in the survivor region stay in that region until they reach a certain age … at which time they are moved to the old generation."* Full collections reclaim both generations.

The policy is documented as a deliberate footprint bias:

> *"By default, the Serial GC tries to find a size for the generations that provides good throughput, but to not increase sizes further when doing so gives diminishing returns. It also tries to maintain a ratio between the time spent in young collections and in full collections to keep the footprint small."*

🔴 **Non-parallel, non-concurrent, stop-the-world.** For a latency-sensitive service with a multi-gigabyte heap, that is the headline fact of this page and the strongest argument that native image plus Community Edition is the wrong shape for such a service (**09 · When it pays** *(not written yet)*).

## 🔴 Heap sizing: the number that will surprise you

> *"If no maximum Java heap size is specified, a native image that uses the Serial GC will set its maximum Java heap size to 80% of the physical memory size. For example, on a machine with 4GB of RAM, the maximum Java heap size will be set to 3.2GB. If the same image is executed on a machine that has 32GB of RAM, the maximum Java heap size will be set to 25.6GB."*

**80%, not 25%.** A JVM under `MaxRAMPercentage` ergonomics is far more conservative. Two consequences:

- **The knob has a different name.** Serial GC's is `-XX:MaximumHeapSizePercent`; G1's is `-XX:MaxRAMPercentage` (and G1's default is 25%). Carrying `-XX:MaxRAMPercentage` across from a JVM deployment to a Serial-GC native image sets a flag the collector in use does not read.
- **The reference says "physical memory size", and I could not confirm what that means inside a container.** The Native Image reference manual does not state whether the runtime reads cgroup limits when computing this percentage. It does ship container-related JFR events (`jdk.ContainerConfiguration`, `jdk.ContainerMemoryUsage`), which suggests some awareness, but **no documentation I found settles the sizing question.** ⚠️ **Treat it as unspecified and set the heap explicitly** — `-Xmx`, or `-XX:MaximumHeapSizePercent` — in any containerised deployment. That is cheap insurance against an 80%-of-the-node heap.

And the reminder that heap is not the process — the same argument as topic 01 of this phase, restated for Substrate VM:

> *"The maximum heap size is only the upper limit for the Java heap and not necessarily the upper limit for the total amount of consumed memory, as Native Image places some data such as thread stacks, just-in-time compiled code (for Truffle runtime compilation), and internal data structures in memory that is separate from the Java heap."*

⚠️ **One more, and it is the one that gets pods OOMKilled:**

> *"Be mindful that the GC needs some extra memory when performing a garbage collection (2x of the maximum heap size is the worst case, usually, it is significantly less). Therefore, the resident set size, RSS, can increase temporarily during a garbage collection which can be an issue in any environment with memory constraints (such as a container)."*

**A container limit set to exactly the max heap size is a container that will be killed during a full GC.** Topic 03 owns the arithmetic ([`03-heap-sizing-in-containers/README.md`](../03-heap-sizing-in-containers/README.md)); this sentence is the native-image-specific input to it.

## Setting the heap

Run-time, matching the familiar spellings:

```bash
./billing-service -Xms256m -Xmx1g -Xmn128m
```

Build-time defaults baked into the binary, so the deployment does not have to remember:

```bash
native-image -R:MinHeapSize=256m -R:MaxHeapSize=1g -R:MaxNewSize=128m ...
```

Both are documented; the `-R:` form is the better choice for a container image, because the sizing travels with the artefact and cannot be forgotten by whoever writes the Deployment manifest.

**Serial GC tuning knobs**, all from the reference:

- `-XX:MaximumHeapSizePercent` — the percentage used when no max is specified.
- `-XX:MaximumYoungGenerationSizePercent` — young generation as a percentage of max heap.
- `-XX:±CollectYoungGenerationSeparately` — *"determines if a full GC collects the young generation separately or together with the old generation. If enabled, this may reduce the memory footprint during full GCs. However, full GCs may take more time."*
- `-XX:MaxHeapFree` — *"maximum total size (in bytes) of free memory chunks that remain reserved for allocations after a collection and are therefore not returned to the operating system."*
- `-H:AlignedHeapChunkSize`, `-H:MaxSurvivorSpaces`, `-H:LargeArrayThreshold` — build-time only. The last is interesting: *"the size at or above which an array will be allocated in its own heap chunk. Arrays that are considered as large are more expensive to allocate but they are never copied by the GC, which can reduce the GC overhead."*

**G1 tuning knobs** are the HotSpot ones you already know — `-XX:MaxGCPauseMillis`, `-XX:ParallelGCThreads`, `-XX:ConcGCThreads`, `-XX:InitiatingHeapOccupancyPercent`, `-XX:G1HeapWastePercent`, plus build-time `-H:G1HeapRegionSize`.

## Compressed references

> *"GraalVM supports compressed references to Java objects that are 32 bits in size instead of 64 bits. Compressed references are enabled by default and can have a large impact on the memory footprint. However, they limit the maximum Java heap size to 32 GB of memory. If more than 32 GB are needed, compressed references need to be disabled."*

Build-time only: `-H:±UseCompressedReferences`. **The 32 GB cliff is the same shape as HotSpot's compressed-oops boundary**, and the same advice applies: staying under it is almost always better than crossing it.

⚠️ **This is a different mechanism from JDK 25's compact object headers (JEP 519).** That is a HotSpot feature; `-XX:+UseCompactObjectHeaders` is a HotSpot flag. Native Image documents its own object header size separately. Do not carry the flag across — topic 01 owns header anatomy and the flag inventory lives with **13 · JVM flags that matter** *(not written yet)*.

## Direct memory and GC logging

Direct buffers exist and are bounded:

> *"Native Image may also allocate memory that is separate from the Java heap. One common use-case is a `java.nio.DirectByteBuffer` that directly references native memory."*
> `-XX:MaxDirectMemorySize` — *"the maximum size of direct buffer allocations."*

⚠️ **Do not assume HotSpot's default here.** On HotSpot, `MaxDirectMemorySize` defaults to `-Xmx` (a phase-12 fact from the `_PHASE-NOTES.md`). The Native Image reference documents the option but **does not state its default**, and I did not find one — so set it explicitly if it matters to your footprint arithmetic.

GC observability is deliberately minimal:

```bash
./billing-service -XX:+PrintGC              # "print basic information for every garbage collection"
./billing-service -XX:+PrintGC -XX:+VerboseGC   # "can be added to print further garbage collection details"
```

🔴 **There is no `-Xlog:gc*`.** The unified logging framework is a HotSpot feature. Everything topic 02 teaches about reading a G1 log applies to a JVM, not to this binary. What you get instead is `PrintGC`/`VerboseGC`, plus JFR's GC events when the image was built with `--enable-monitoring=jfr` — and those, per the JFR reference, are *"Available if Serial GC is used."* ([07b](07b-no-jit-no-jfr-no-jstack.md)).

## Gotchas

**★ Symptom: a containerised native image is OOMKilled with a heap that looks half-empty.** Cause: two candidates, and check both. The max heap defaulted to 80% of what the runtime believes physical memory to be — the reference says *"physical memory size"* and does not document cgroup awareness — and the GC needs headroom during a collection, up to *"2x of the maximum heap size … in the worst case"*. Fix: set `-R:MaxHeapSize` at build time or `-Xmx` at run time, and set the container limit meaningfully above it.

**★ Symptom: `-XX:MaxRAMPercentage` appears to be ignored.** Cause: it is G1's knob. With the default Serial GC the equivalent is `-XX:MaximumHeapSizePercent`, and G1 is unavailable on Community Edition and on non-Linux targets anyway. Fix: use the right flag for the collector you actually built with, and prefer an absolute `-R:MaxHeapSize` so the question does not arise.

**★ Symptom: `--gc=G1` was added to a build and nothing changed, or the build failed.** Cause: *"Not available in GraalVM Community Edition"*, and even on Oracle GraalVM it is Linux AMD64/AArch64 only. Fix: check the distribution first ([01b](01b-the-distribution-and-the-licence.md)). If G1 is unavailable, Serial GC's stop-the-world behaviour is a fact you have to design around, not tune away.

**★ Symptom: `-Xlog:gc*` produces nothing.** Cause: unified logging is HotSpot's; the native runtime has `-XX:+PrintGC` and `-XX:+VerboseGC`. Fix: use those, and for anything structured, build with `--enable-monitoring=jfr` and read the GC events in JMC — remembering that the JFR reference marks the GC events as available with Serial GC.

**★ Symptom: pause times are far worse than the same application on a JVM.** Cause: Serial GC is *"simple (non-parallel, non-concurrent) stop and copy"*. A heap that G1 or ZGC handled with short concurrent phases is now collected by one thread with the world stopped. Fix: reduce the heap and the allocation rate, or move to Oracle GraalVM and `--gc=G1` on Linux, or conclude that this workload wants a JVM (**09 · When it pays** *(not written yet)*).

**★ Symptom: the process holds far more RSS than the live set justifies, and never gives it back.** Cause: `-XX:MaxHeapFree` governs *"maximum total size (in bytes) of free memory chunks that remain reserved for allocations after a collection and are therefore not returned to the operating system."* Fix: set it, and consider `-XX:+CollectYoungGenerationSeparately`, which the reference notes *"may reduce the memory footprint during full GCs. However, full GCs may take more time."* That is the trade, stated.

**★ Symptom: Epsilon was chosen for start-up and the process dies under load.** Cause: it *"never frees any allocated memory"*. Fix: it is only correct for the documented case — *"very short running applications that only allocate a small amount of memory"*. Anything with a request loop needs a real collector.

**★ Symptom: crossing 32 GB of heap causes a build error or unexpected behaviour.** Cause: compressed references are on by default and *"limit the maximum Java heap size to 32 GB of memory."* Fix: `-H:-UseCompressedReferences` at build time — and then reconsider, because a 32 GB-plus heap collected by Serial GC is a combination with no good outcomes.

**★ Symptom: `-XX:+UseCompactObjectHeaders` is rejected.** Cause: it is a HotSpot flag (JEP 519), not a Native Image one. Fix: nothing to do — Native Image documents its own object header behaviour, and compressed references are the equivalent footprint lever here.

**★ Symptom: heap tuning that worked on GraalVM 21.3 or earlier behaves differently.** Cause: the reference records a policy change — *"GraalVM releases up to (and including) 21.3 use a different default configuration for the Serial GC with no survivor regions, a young generation that is limited to 256 MB, and a default collection policy that balances the time that is spent in young collections and old collections."* Fix: the old behaviour is still reachable with `-H:InitialCollectionPolicy=BySpaceAndTime`, and only under that policy does `-XX:PercentTimeInIncrementalCollection` apply. Re-tune rather than porting.

## Interview questions

**★ Which garbage collectors are available in a native image, and what decides it?**
Serial GC, G1 and Epsilon, chosen at build time with `--gc=`. Serial is the default and is available everywhere. G1 is *"Not available in GraalVM Community Edition"* and, even on Oracle GraalVM, only on Linux AMD64 and AArch64. Epsilon is a no-op collector for *"very short running applications that only allocate a small amount of memory."* Two things follow: the collector is a property of the artefact and cannot be changed at run time, and on Community Edition your only real collector is a non-parallel, non-concurrent, stop-the-world one.

**★ What is the default maximum heap size of a native image, and why is that a container problem?**
With Serial GC and no explicit setting, *"80% of the physical memory size"* — the reference's own example is 3.2 GB on a 4 GB machine and 25.6 GB on a 32 GB machine. G1's default is 25%. That is far more aggressive than HotSpot's container ergonomics, and the reference speaks of "physical memory" without documenting cgroup awareness, so on a limited container the safe assumption is that it may size against the node. Combine that with the documented GC headroom — *"2x of the maximum heap size is the worst case"* — and an unset heap in a container is a plausible OOMKill. Always set it explicitly, ideally at build time with `-R:MaxHeapSize` so it travels with the artefact.

**★ Why does `-Xlog:gc*` not work, and what do you use instead?**
Unified logging is a HotSpot subsystem and there is no HotSpot in a native executable. The Native Image runtime provides `-XX:+PrintGC` for *"basic information for every garbage collection"* and `-XX:+VerboseGC` for *"further garbage collection details"*. For anything you want to analyse rather than read, build with `--enable-monitoring=jfr` and use the GC events in JDK Mission Control — noting that the JFR reference marks the GC event family as available when Serial GC is in use.

**★ What is the relationship between compressed references and HotSpot's compressed oops or compact object headers?**
Compressed references are Native Image's equivalent of compressed oops: 32-bit rather than 64-bit object references, on by default, with a documented 32 GB heap ceiling and a build-time switch `-H:±UseCompressedReferences`. Compact object headers are something else entirely — a HotSpot feature from JEP 519, promoted to product in JDK 25 and still opt-in there — and `-XX:+UseCompactObjectHeaders` has no meaning in a native image. Confusing the three is common; the practical rule is that only one of them is yours to configure here, and it is a build-time flag.

**★ Your native service has p99 pause spikes that the JVM version did not have. What do you check?**
First, which collector: with the default Serial GC you have *"a simple (non-parallel, non-concurrent) stop and copy GC"*, so a pause proportional to live-set size on a full collection is expected, not anomalous. Second, the heap size — an oversized heap makes full collections longer, and the automatic 80% default may have given you one. Third, allocation rate, since young collections are triggered by eden filling. The remedies, in order: cut allocation, cut the heap, use `-XX:+CollectYoungGenerationSeparately` if footprint during full GCs is the issue, or move to Oracle GraalVM with `--gc=G1` on Linux. If none of those is available, the honest conclusion is that this workload belongs on a JVM.

**★ Someone reports that the process RSS never returns to baseline after a load spike. Is that a leak?**
Not necessarily. `-XX:MaxHeapFree` controls *"maximum total size (in bytes) of free memory chunks that remain reserved for allocations after a collection and are therefore not returned to the operating system"* — so by default the runtime keeps free chunks reserved rather than handing them back. Set that option if returning memory matters more than allocation speed. Before concluding leak, also account for the memory that is not heap at all: thread stacks and internal structures, which the reference explicitly says live *"in memory that is separate from the Java heap"*, and which native memory tracking can attribute ([07b](07b-no-jit-no-jfr-no-jstack.md)).

{/* FOOTER */}
