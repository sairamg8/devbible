---
title: "The dozen NMT categories nobody looks at, the four that grow without a flag to bound them, and the memory that is in your resident set without being in any category at all"
sidebar_label: "02b · The rest of the map"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the JDK 25 HotSpot source `src/hotspot/share/nmt/memTag.hpp`
> at tag `jdk-25+36`
> ([github.com/openjdk/jdk](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/nmt/memTag.hpp)),
> the **JDK 25 Troubleshooting Guide**, "Diagnostic Tools → Native Memory Tracking",
> "Table 2-1 Native Memory Tracking Memory Categories" and the arena description
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/troubleshoot/diagnostic-tools.html)),
> and the **JDK 25 `jcmd` tool reference**
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/jcmd.html)).
> JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9.

**[02](02-the-process-map.md) covered the four regions that explain most of a JVM's
footprint. This page covers the rest — including the two that grow with your heap and have no
flag at all, and the far more dangerous category of memory that is in your resident set
without appearing in any NMT category, because NMT only tracks what the JVM itself
allocates.**

## GC and GCCardSet — the collector's own memory

The Troubleshooting Guide's Table 2-1 defines them as:

> *"**GC** — Data use by the GC, such as card table, except the remembered sets"*
>
> *"**GCCardSet** — Data use by the GC's remembered sets (optional, G1 only)"*

This is the category people are most surprised by, because there is no flag for it. It scales
with heap size — a card table is proportional to the heap — and, for `GCCardSet`, with the
*shape* of your object graph: G1's remembered sets record cross-region references, so an
object graph with many long pointers between regions costs more here than a graph with
locality. A heap of a few gigabytes can carry hundreds of megabytes of collector metadata,
and none of it is inside `-Xmx`.

There is no direct command for it. NMT is the only view, which is one of the strongest
arguments for enabling NMT before you need it.

## Compiler — arenas that exist only while compiling

> *"**Compiler** — Memory tracking used by the compiler when generating code"*

C1 and C2 allocate scratch arenas during a compilation and free them when it finishes. The
category is therefore spiky rather than growing: it reflects how many compiler threads are
active *right now*. A large value in a steady-state NMT summary usually means a very large
method is being compiled, which is itself worth knowing — C2 compiling a 10,000-bytecode
generated method is a real source of both latency and memory spikes.

## Symbol — the table nobody thinks about

> *"**Symbol** — Memory for symbols"*

Every class name, method name, field name and signature in the JVM is interned into the
symbol table as a `Symbol`. It grows with the number of distinct names loaded, which means it
grows with your class count and with anything that generates classes. On a large application
it is comfortably tens of megabytes. `jcmd <pid> VM.symboltable` and `VM.stringtable` print
the statistics, including bucket counts and load factors.

## The small categories, in one pass

None of these is usually the cause of an incident, but knowing what they are stops you
staring at an unfamiliar line during one.

- **Internal** — the Troubleshooting Guide: *"Memory that does not fit the previous
  categories, such as the memory used by the command line parser, JVMTI, properties, and so
  on"*. If a JVMTI agent is attached — a profiler, a debugger, an APM agent — this is often
  where its JVM-side allocations land.
- **Other** — *"Memory not covered by another category"*. Distinct from `Internal`; in
  practice this is where direct `ByteBuffer` backing stores are accounted, which makes it the
  category to watch for an NIO or Netty leak. See
  [07 · Direct and mapped buffers](07-direct-and-mapped-buffers.md).
- **Arena Chunk** — *"Memory used by chunks in the arena chunk pool"*. The guide explains the
  mechanism: *"An arena is a chunk of memory allocated using malloc. Memory is freed from
  these chunks in bulk, when exiting a scope or leaving an area of code. … An arena malloc
  policy ensures no memory leakage. So arena is tracked as a whole and not individual
  objects."*
- **Shared class space** — *"class data sharing"*. The mapped CDS archive, and on JDK 24+ the
  AOT cache. It is a file mapping, so it is shared between JVMs on the same host and largely
  read-only — cheap per process, and one of the reasons CDS improves footprint as well as
  startup.
- **Tracing** — JFR's buffers. Bounded by the recording's `maxsize` and by the global and
  per-thread buffer settings; a default-settings recording is a few tens of megabytes.
- **Synchronization** and **Object Monitors** — inflated monitors. They grow under contention
  and shrink when monitors deflate. A steadily growing `Object Monitors` figure is a
  contention finding, not a leak.
- **String Deduplication** — the deduplication table, present only with
  `-XX:+UseStringDeduplication`. See [10 · Strings](10-strings.md).
- **JVMCI** — Graal's own allocations. Zero unless you are running the Graal JIT.
- **Logging**, **Statistics**, **Arguments**, **Module**, **Safepoint**, **Serviceability** —
  VM bookkeeping, each typically well under a megabyte. `Module` grows a little with the
  number of resolved modules; the rest are effectively constant.
- **Unknown** (`mtNone`) — allocations with no tag. A large `Unknown` on a recent JDK is
  unusual and worth reporting.

## What is not on the map at all

This is the important half of the page, because the memory NMT cannot see is exactly the
memory that produces the hardest incidents. The Troubleshooting Guide states the limit
plainly:

> *"Since NMT doesn't track memory allocations by non-JVM code, you may have to use tools
> supported by the operating system to detect memory leaks in native code."*

Concretely, none of the following appears in any NMT category:

1. **The C allocator's own overhead and fragmentation.** glibc keeps per-thread arenas and
   does not necessarily return freed memory to the kernel. The JVM asked for and released the
   memory correctly; the process's RSS still went up.
2. **JNI and native library allocations.** A JDBC driver with a native component, an image
   codec, a compression library, a native TLS stack — anything that calls `malloc` directly
   rather than through the JVM's tracked allocators.
3. **JVMTI agent allocations made outside the JVM's allocators.** Profilers and APM agents
   are the common case, and they are frequently the answer when NMT's total does not explain
   RSS.
4. **The executable, the shared libraries and their relocations.** `libjvm.so` alone is tens
   of megabytes of mapped file, some of it private after relocation.
5. **Page cache for memory-mapped files.** A `MappedByteBuffer` over a large file consumes
   resident pages attributed to the cgroup, and neither `-Xmx` nor NMT accounts for them.
6. **`vfork`/`posix_spawn` transients** and anything a child process does inside the same
   cgroup.

The diagnostic consequence is simple and worth memorising: **if NMT's total is materially
below RSS, the difference is in that list**, and the next tools are `pmap -x <pid>`,
`/proc/<pid>/smaps_rollup`, and `MALLOC_ARENA_MAX`. That case is
[11c · The footprint that is not in any region](11c-the-footprint-that-is-not-in-any-region.md).

## Reading the map in practice

```bash
# arm it at startup - it cannot be enabled on a running JVM
java -XX:NativeMemoryTracking=summary -jar app.jar

# once warm, take a baseline, then diff after the growth window
jcmd <pid> VM.native_memory baseline
jcmd <pid> VM.native_memory summary.diff

# and compare the JVM's own accounting against the kernel's
grep -E '^(Rss|Pss)' /proc/<pid>/smaps_rollup
pmap -x <pid> | tail -1
```

The `jcmd` reference documents the sub-commands as *"summary"*, *"detail"*, *"baseline"*,
*"summary.diff"*, *"detail.diff"* and a *"scale"* option. `summary.diff` is the one that
matters operationally: it prints each category with a signed delta against the baseline, so
the region that grew names itself instead of having to be inferred from absolute numbers you
have no reference point for. Full treatment is
[11 · Native Memory Tracking](11-native-memory-tracking.md).

## Gotchas

**★ `GC` and `GCCardSet` have no flag, so they cannot be tuned away.**
They scale with heap size and object-graph shape. The only lever is a smaller heap or a
different collector, both of which are topic 02's business. Budgeting a container as
"`-Xmx` plus a fixed 300 MB" ignores the fact that this row grows *with* `-Xmx`.

**★ `Compiler` being large is a signal, not a leak.**
Compiler arenas are freed when a compilation completes, so a large steady value means a
compilation is in progress and is big. That usually means a very large or very deeply inlined
method, which is a performance finding worth chasing on its own terms.

**★ The `Symbol` category grows with generated classes and never shrinks quickly.**
Frameworks that synthesise classes — proxies, mappers, expression compilers — add symbols for
every name they invent. Symbols are reference-counted and reclaimed when their owning classes
unload, so a classloader leak inflates `Symbol` alongside `Class`. Seeing both grow together
is close to a positive identification.

**★ `Other`, not `Internal`, is where direct buffers usually show up.**
The two names sound interchangeable and are not. `Internal` is *"memory used by the command
line parser, JVMTI, properties, and so on"*; `Other` is *"memory not covered by another
category"*, which in practice includes NIO's direct buffer backing stores. Looking in the
wrong one delays a direct-buffer diagnosis considerably.

**★ NMT cannot be enabled on a running JVM.**
`-XX:NativeMemoryTracking` is a startup flag. `jcmd VM.native_memory` on a JVM started without
it reports that tracking is off, and there is no way to turn it on without a restart — which
means the restart destroys the state you were trying to measure. This is the single strongest
argument for running with `summary` tracking permanently in any environment where a footprint
incident is plausible.

**★ A large `Unknown` category is a bug report, not a tuning opportunity.**
`mtNone` means an allocation reached the tracker with no tag. On a modern JDK almost
everything is tagged, so a significant `Unknown` figure is unusual and there is no flag that
addresses it.

**★ `Shared class space` being non-zero is CDS working, not a leak.**
It is a read-only file mapping shared between every JVM on the host that uses the same
archive. It counts once against the page cache rather than once per process, so it is the
rare row where a bigger number is good news.

**★ `Tracing` grows if you leave a JFR recording running with an unbounded `maxsize`.**
A continuous recording with no size cap keeps buffering. Set `maxsize` or `maxage` on any
recording that is meant to run indefinitely, and remember that the disk repository is a
separate cost from the in-memory buffers.

**★ `Object Monitors` growing steadily is a contention signal.**
Monitors inflate under contention and are deflated later. A category that only ever rises
means monitors are being inflated faster than they are cleaned up, which is a lock-contention
finding — the memory is a symptom, not the problem.

**★ NMT's own overhead is charged to NMT, which confuses a first reading.**
The `Native Memory Tracking` category shows `tracking overhead` as a line item, and the
Troubleshooting Guide notes *"NMT memory usage is also tracked by NMT"*. That row grows with
the number of tracked allocations, so a `detail`-level run charges itself considerably more
than a `summary` run.

**★ The malloc header NMT adds is per-allocation, not per-category.**
*"memory usage for NMT adds 2 machine words to all malloc memory as a malloc header"*. On a
process with millions of small allocations that is a real number, and it is one of the reasons
enabling NMT changes the footprint you are trying to measure. Compare NMT-on against NMT-on,
never NMT-on against NMT-off.

**★ `pmap` and NMT disagree by construction and both are right.**
`pmap` shows mappings, including the executable, every shared library, the CDS archive and
guard pages; NMT shows what the JVM allocated, tagged by purpose. Neither is a superset of
the other. Use NMT to find the region and `pmap`/`smaps` to find what NMT cannot see.

## Interview questions

**★ Why is there no flag for the GC's own memory?**
Because it is not a budget you can choose; it is a function of the heap you asked for and the
collector you chose. A card table is a fixed fraction of the heap. G1's remembered sets record
cross-region references and therefore depend on your object graph, which the JVM cannot know
in advance. The only levers are heap size and collector choice, and both are decisions you
make for other reasons. Practically this means the GC row has to be *measured*, per
application, with NMT — it cannot be derived.

**★ NMT reports a 1.4 GB total and `ps` reports 1.9 GB RSS. Where is the difference?**
In something NMT does not track, because the guide is explicit that it *"doesn't track memory
allocations by non-JVM code"*. The candidates are glibc `malloc` arena fragmentation, a JNI
or native library allocating directly, a JVMTI agent, the mapped executable and shared
libraries, and page cache for memory-mapped files. The next tools are `pmap -x` and
`/proc/<pid>/smaps_rollup`, not any JVM command — and the fact that the gap exists at all is
already a diagnosis, because it rules out every JVM-side region in one step.

**★ Why can NMT's total also be *higher* than RSS?**
Because NMT reports committed memory and RSS reports resident memory, and committed pages
that have never been touched are not resident. A JVM that has committed a large heap it has
not yet used will show a committed total well above its RSS. So the two numbers can differ in
either direction for entirely different reasons, which is why "NMT total minus RSS" needs a
sign before it means anything.

**★ You suspect a direct `ByteBuffer` leak. Which NMT category do you watch?**
`Other` — *"memory not covered by another category"* — rather than `Internal`, which is
command-line parsing, JVMTI and properties. Better still, do not rely on NMT alone for this
one: `java.nio` exposes a `BufferPool` MXBean with count, total capacity and memory used for
the `direct` and `mapped` pools, which Micrometer surfaces as `jvm.buffer.*`. That is a
cheaper and more direct signal than an NMT diff.

**★ How do you prepare a service so that a future footprint incident is diagnosable?**
Start it with `-XX:NativeMemoryTracking=summary`, because the flag cannot be added to a
running JVM and adding it means restarting away the evidence. Take an NMT baseline as part
of a warm-up or readiness step so that a later `summary.diff` has something to compare
against. Record RSS and heap committed as separate time series. And accept the documented
*"5-10 percent JVM performance drop"* as the price, or measure it on your workload and decide
deliberately — but decide before the incident, not during it.

**★ What is an arena, in NMT's sense, and why is it tracked as a whole?**
The Troubleshooting Guide defines it: *"An arena is a chunk of memory allocated using malloc.
Memory is freed from these chunks in bulk, when exiting a scope or leaving an area of code.
These chunks can be reused in other subsystems to hold temporary memory … An arena malloc
policy ensures no memory leakage. So arena is tracked as a whole and not individual objects."*
The consequence is that `arena=` figures in an NMT report tell you how much scratch space a
subsystem is holding, not what is inside it — which is why a large `Compiler` arena means "a
compilation is running" rather than "something leaked".

**★ Which two categories can grow without any flag bounding them, and what do you do about
it?**
`GC` and `GCCardSet`. Card tables scale as a fixed fraction of heap size; G1's remembered sets
scale with the number of cross-region references, which is a property of your object graph.
Neither has a knob. The only responses are a smaller heap, a different collector, or reducing
cross-region pointer density in the application — and in practice the response is simply to
*budget* for them, having measured them with NMT, rather than to assume the non-heap cost is a
constant that does not grow with `-Xmx`.

{/* FOOTER */}
