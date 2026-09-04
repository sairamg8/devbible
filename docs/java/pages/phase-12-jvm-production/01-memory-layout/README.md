---
title: "Memory layout: `-Xmx` bounds one region of a dozen, and almost every production memory mystery is a question about one of the other eleven"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **HotSpot Virtual Machine Garbage Collection Tuning Guide,
> Release 25** ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/gctuning/)), the
> **JDK 25 tool references** for `java`, `jcmd`, `jstack` and `jmap`
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html)), the
> **JDK 25 Troubleshooting Guide**
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/troubleshoot/)), **JEPs 122, 374,
> 387, 444, 450, 490, 491, 519 and 534** ([openjdk.org](https://openjdk.org/jeps/519)), and the
> **JDK 25 HotSpot source at tag `jdk-25+36`**
> ([github.com/openjdk/jdk](https://github.com/openjdk/jdk/tree/jdk-25%2B36)) — which is the only
> documentation for roughly a dozen flag defaults the man page omits entirely.
> 🔴 **No sandbox.** There is no JVM running behind these pages: every output shape is quoted
> from documentation and attributed, or is arithmetic shown as arithmetic. No GC log line, heap
> dump summary, NMT report or measurement here is fabricated.
> JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9.

**`-Xmx` bounds the Java heap. It does not bound metaspace, the code cache, thread stacks, direct
or mapped buffers, GC data structures, the compilers' arenas, symbol tables or the native
allocator — and the pod that was OOMKilled at 03:00 with a flat heap graph died of one of those.
This topic is the map: every region a running JVM has, what lives in it, which flag sizes it,
which command reads it, and how an object is actually laid out inside the one region everybody
already knows about. It teaches the map, not the algorithms that operate on it — GC is topic 02,
container limits are topic 03, heap dumps are topic 04.**

The recurring shape of every page here is the same, and it is worth stating once: **the JDK's
`java` man page is not the whole truth.** `CompressedClassSpaceSize` (1 GB) does not appear in it
at all. `MetaspaceSize` is described as platform-dependent and is 21 MB. `MaxDirectMemorySize` is
described as chosen "automatically" and in fact equals `-Xmx`. Nine of the eleven TLAB flags are
absent. `ExitOnOutOfMemoryError` is missing. Where these pages disagree with a widely-repeated
claim, they cite the HotSpot source at `jdk-25+36` and say which document was silent.

**46 chunks, ~11,300 lines, 691 gotchas and interview questions.** Read in order; each chunk links
to the next.

| # | Chunk | Tier | What it argues |
|---|---|---|---|
| 1 | **[Heap is not the process](01-heap-is-not-the-process.md)** | <span className="db-tier t-understand">Understand</span> | The framing for the whole phase: `-Xmx` bounds one region of many |
| 2 | **[`OutOfMemoryError` vs OOMKilled](01b-oom-error-versus-oomkilled.md)** | <span className="db-tier t-understand">Understand</span> | Two completely different failures that look identical on a dashboard |
| 3 | **[The OOM flags and what they cover](01c-the-oom-flags-and-what-they-cover.md)** | <span className="db-tier t-understand">Understand</span> | `HeapDumpOnOutOfMemoryError` fires only for heap exhaustion |
| 4 | **[Taking a heap dump on purpose](01d-taking-a-heap-dump-on-purpose.md)** | <span className="db-tier t-understand">Understand</span> | `jcmd GC.heap_dump`, and why `jmap` is experimental now |
| 5 | **[The native budget](01e-the-native-budget.md)** | <span className="db-tier t-understand">Understand</span> | Adding up everything `-Xmx` does not cover |
| 6 | **[Reserved, committed, resident](01f-reserved-committed-and-resident.md)** | <span className="db-tier t-understand">Understand</span> | Three numbers people read as one, and the misreadings each causes |
| 7 | **[The process map](02-the-process-map.md)** | <span className="db-tier t-understand">Understand</span> | Every region, who sizes it, which command shows it |
| 8 | **[The rest of the map](02b-the-rest-of-the-map.md)** | <span className="db-tier t-understand">Understand</span> | The categories nobody looks at, and the memory in no category at all |
| 9 | **[The heap](03-the-heap.md)** | <span className="db-tier t-understand">Understand</span> | Eden, two survivors and old — and why there are two, not one |
| 10 | **[The weak generational hypothesis](03b-the-weak-generational-hypothesis.md)** | <span className="db-tier t-understand">Understand</span> | The measured claim the design rests on, and the hedge nobody quotes |
| 11 | **[TLABs and allocation](03c-tlabs-and-allocation.md)** | <span className="db-tier t-understand">Understand</span> | Why `new` is a compare and an add, and why object pools usually lose |
| 12 | **[TLAB sizing and the flags](03c2-tlab-sizing-and-the-flags.md)** | <span className="db-tier t-understand">Understand</span> | Eden ÷ threads ÷ 50 — and why `InitialTLABSize` does not exist |
| 13 | **[Aging and promotion](03d-aging-and-promotion.md)** | <span className="db-tier t-understand">Understand</span> | How an object earns the old generation, and premature promotion |
| 14 | **[Metaspace](04-metaspace.md)** | <span className="db-tier t-understand">Understand</span> | Native, not heap — and "PermGen became metaspace" is a third right |
| 15 | **[The metaspace flags](04b-the-metaspace-flags.md)** | <span className="db-tier t-understand">Understand</span> | Unlimited by default; `MetaspaceSize` is a GC trigger, not a reservation |
| 16 | **[The classloader leak](04c-the-classloader-leak.md)** | <span className="db-tier t-understand">Understand</span> | Freed only when a loader dies — a leak with no leaked objects |
| 17 | **[The code cache](05-the-code-cache.md)** | <span className="db-tier t-understand">Understand</span> | 240 MB of native memory, and three segments rather than one |
| 18 | **[When the code cache fills](05b-when-the-code-cache-fills.md)** | <span className="db-tier t-understand">Understand</span> | The famous message your JVM will not print, and the compiler that comes back |
| 19 | **[Diagnosing code cache pressure](05c-diagnosing-code-cache-pressure.md)** | <span className="db-tier t-understand">Understand</span> | A regression with a healthy heap, and the four commands that find it |
| 20 | **[Thread stacks](06-thread-stacks.md)** | <span className="db-tier t-understand">Understand</span> | `-Xss`, frames, and the platform default that doubles on AArch64 |
| 21 | **[Virtual thread stacks](06b-virtual-thread-stacks.md)** | <span className="db-tier t-understand">Understand</span> | Stack chunks on the heap, and how JDK 21+ changes the arithmetic |
| 22 | **[Carriers, mounting and pinning](06c-carriers-mounting-and-pinning.md)** | <span className="db-tier t-understand">Understand</span> | What JEP 491 fixed, and the runbook flag it removed |
| 23 | **[The thread-count arithmetic](06d-the-thread-count-arithmetic.md)** | <span className="db-tier t-understand">Understand</span> | Threads × stack size, and where that lands in a container |
| 24 | **[Sizing stacks, cutting counts](06e-sizing-stacks-and-cutting-counts.md)** | <span className="db-tier t-understand">Understand</span> | Which of the two variables is actually yours to change |
| 25 | **[Direct and mapped buffers](07-direct-and-mapped-buffers.md)** | <span className="db-tier t-understand">Understand</span> | `MaxDirectMemorySize` defaults to `-Xmx` — a second copy, not a slice |
| 26 | **[Cleaners and deterministic release](07b-cleaners-and-deterministic-release.md)** | <span className="db-tier t-understand">Understand</span> | Phantom-reachability, `System.gc()`, and `Arena` as the modern answer |
| 27 | **[Mapped buffers](07c-mapped-buffers.md)** | <span className="db-tier t-understand">Understand</span> | Bounded by no JVM flag at all |
| 28 | **[Residency, force and arenas](07d-mmap-residency-and-arenas.md)** | <span className="db-tier t-understand">Understand</span> | Why mapped files inflate RSS without consuming heap |
| 29 | **[The object header](08-the-object-header.md)** | <span className="db-tier t-understand">Understand</span> | Mark word and class word, and the bias bit that has not existed since 18 |
| 30 | **[Mark word: locks and hashes](08e-the-mark-word-locking-and-hashing.md)** | <span className="db-tier t-understand">Understand</span> | Two tag bits, three states, and a hash that competes for the same 64 bits |
| 31 | **[Compact object headers](08b-compact-object-headers.md)** | <span className="db-tier t-understand">Understand</span> | JEP 519 spends 22 reserved bits; JEP 534 makes it the default in 27 |
| 32 | **[Alignment and padding](08c-alignment-and-padding.md)** | <span className="db-tier t-understand">Understand</span> | Field order means nothing, and `byte[1]` costs what `byte[8]` costs |
| 33 | **[False sharing and `@Contended`](08c2-false-sharing-and-contended.md)** | <span className="db-tier t-understand">Understand</span> | Padding on purpose — and four reasons the answer is `LongAdder` |
| 34 | **[Measuring an object](08d-measuring-an-object.md)** | <span className="db-tier t-understand">Understand</span> | JOL, because "how big is this object" has no arithmetic answer |
| 35 | **[Compressed oops](09-compressed-oops.md)** | <span className="db-tier t-understand">Understand</span> | The 32 GB cliff, and the heap that got smaller when it grew |
| 36 | **[Widening object alignment](09b-alignment-and-class-pointers.md)** | <span className="db-tier t-understand">Understand</span> | The one flag whose right answer genuinely differs per application |
| 37 | **[Class pointers and compact headers](09c-class-pointers-and-compact-headers.md)** | <span className="db-tier t-understand">Understand</span> | A second compression with a similar name, already deprecated |
| 38 | **[Verifying what the JVM chose](09d-verifying-what-the-jvm-chose.md)** | <span className="db-tier t-understand">Understand</span> | A flag being accepted is not evidence it took effect |
| 39 | **[Strings in the heap](10-strings.md)** | <span className="db-tier t-understand">Understand</span> | Compact strings, Latin-1 vs UTF-16, and where the bytes go |
| 40 | **[The pool and interning](10b-the-pool-and-interning.md)** | <span className="db-tier t-understand">Understand</span> | On the heap since Java 7, so the PermGen warning is obsolete |
| 41 | **[String deduplication](10c-string-deduplication.md)** | <span className="db-tier t-understand">Understand</span> | The collector doing what `intern()` was misused for |
| 42 | **[Native Memory Tracking](11-native-memory-tracking.md)** | <span className="db-tier t-understand">Understand</span> | The one tool that answers "where did the memory go" |
| 43 | **[The NMT baseline workflow](11b-the-nmt-baseline-workflow.md)** | <span className="db-tier t-understand">Understand</span> | `summary.diff` — the measurement you have to have taken first |
| 44 | **[The footprint outside every region](11c-the-footprint-that-is-not-in-any-region.md)** | <span className="db-tier t-understand">Understand</span> | Malloc arenas, JNI, and RSS above the JVM's own accounting |
| 45 | **[Finding it outside the JVM](11d-finding-it-outside-the-jvm.md)** | <span className="db-tier t-understand">Understand</span> | When the answer is not in any Java tool |
| 46 | **[The checklist](12-the-checklist.md)** | <span className="db-tier t-understand">Understand</span> | "The pod grew and the heap is flat" — the ordered questions |

## The eight things this topic is really about

1. **Heap is not the process.** `-Xmx` bounds one region. Metaspace, the code cache, thread
   stacks, direct and mapped buffers, GC structures and the native allocator are all outside it,
   and together they routinely exceed it. Every capacity plan built on `-Xmx` alone is wrong by
   the size of everything on this list.

2. **Two of the regions have no upper bound at all.** `MaxMetaspaceSize` is unlimited by default,
   and memory-mapped buffers are bounded by no JVM flag whatsoever. Unbounded native growth ends
   in an OOMKill rather than an `OutOfMemoryError`, which is why the most confusing production
   memory failures present as infrastructure problems.

3. **The man page is not the whole truth.** `CompressedClassSpaceSize` (1 GB) is absent from it
   entirely; `MetaspaceSize` (21 MB) is called platform-dependent; `MaxDirectMemorySize` is said
   to be chosen automatically when it actually equals `-Xmx`; nine of eleven TLAB flags are
   missing. When a default matters, the HotSpot source at `jdk-25+36` is the authority, and these
   pages cite it.

4. **Reclamation granularity decides the shape of a leak.** The heap is collected per object;
   metaspace is freed only when an entire classloader dies; the code cache unloads cold nmethods
   through the GC. Knowing which region is involved tells you what the growth curve will look
   like — smooth, stepwise, or oscillating — before you look at anything else.

5. **An object's size is not the sum of its fields.** A 12- or 16-byte header, field reordering by
   width, and rounding to an 8-byte boundary intervene. Arithmetic on paper is reliably wrong, and
   JOL is the only honest answer — which also means the answer depends on the JVM's configuration,
   not only on the class.

6. **JDK 25 has moved further than most published material.** ZGC is generational and there is no
   other kind. Biased locking has not existed since 18. CMS has not existed since 14. The method
   sweeper is gone. `UseCompressedClassPointers` is deprecated. Compact object headers are a
   product feature now and the default in 27. On a JDK where an unrecognised `-XX:` flag stops
   the JVM, pasting an old flag list is a rollout risk.

7. **A flag being accepted is not evidence that it took effect.** Compact object headers silently
   disable themselves under legacy locking. Compressed oops silently switch off above the heap
   threshold. Segmentation is ergonomic and contradicts the source's declared default. Verify the
   layout you got, do not assume the one you asked for.

8. **The order of the tools is the whole skill.** NMT to find which region grew, then the
   region-specific command — `VM.metaspace`, `VM.classloader_stats`, `Compiler.codecache`,
   `Thread.print` — and a heap dump only once you know it can answer the question. Starting with
   a heap dump is the single most common wasted step, because it does not contain metaspace, the
   code cache, thread stacks or native buffers.

## Where this connects

- **02 · GC in practice** owns the algorithms that operate on the shape in
  [03](03-the-heap.md) — G1 versus ZGC, unified logging, and when tuning is the wrong answer.
- **03 · Heap sizing in containers** owns cgroups, `MaxRAMPercentage` and the OOMKilled loop.
  The native budget in [01e](01e-the-native-budget.md) is the arithmetic it needs.
- **04 · `OutOfMemoryError`** owns every detail message and the heap-dump analysis workflow.
  [01b](01b-oom-error-versus-oomkilled.md) and [01c](01c-the-oom-flags-and-what-they-cover.md) are
  the framing; that topic is the depth.
- **05 · Thread dumps** picks up where [06](06-thread-stacks.md) leaves off, including the
  virtual-thread dump story.
- **13 · JVM flags that matter in 2026** owns the retired-flag inventory. Every page here that
  names a dead flag points there rather than repeating the list.

{/* FOOTER */}
