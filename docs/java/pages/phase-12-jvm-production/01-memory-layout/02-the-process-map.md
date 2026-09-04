---
title: "Every region a running JVM has, what lives in it, which flag sizes it and which command shows it — the lookup table the rest of this phase assumes you have"
sidebar_label: "02 · The process map"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the JDK 25 HotSpot source `src/hotspot/share/nmt/memTag.hpp`
> at tag `jdk-25+36`
> ([github.com/openjdk/jdk](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/nmt/memTag.hpp)),
> the **JDK 25 Troubleshooting Guide**, "Diagnostic Tools → Native Memory Tracking" including
> "Table 2-1 Native Memory Tracking Memory Categories" and its sample output
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/troubleshoot/diagnostic-tools.html)),
> the **JDK 25 `java` tool reference**
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html)),
> and the **JDK 25 `jcmd` tool reference**
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/jcmd.html)).
> JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9.

**This is the lookup table. Every later topic in this phase reads one region of it, and
every memory incident resolves to "this region grew". For each region the three questions
that matter are the same: what is stored there, which flag bounds it, and which command
shows it. Answer those three and a footprint investigation becomes mechanical instead of
speculative.**

## The map

| Region (NMT category) | What is in it | Sized by | Shown by |
|---|---|---|---|
| **Java Heap** | class instances and arrays | `-Xmx` / `MaxRAMPercentage` | `jcmd GC.heap_info`, `-Xlog:gc*` |
| **Class** | class metadata: metaspace + compressed class space | `MaxMetaspaceSize`, `CompressedClassSpaceSize` | `jcmd VM.metaspace` |
| **Thread** | per-thread VM structures, handle and resource areas | thread count | `jcmd Thread.print` |
| **Thread Stack** | the native stacks themselves | `-Xss` × platform threads | `jcmd Thread.print`, `pmap` |
| **Code** | JIT output, stubs, adapters, interpreter | `ReservedCodeCacheSize` | `jcmd Compiler.codecache` |
| **GC** | card tables, mark bitmaps, task queues | the collector + heap size | NMT only |
| **GCCardSet** | G1's remembered sets | G1 ergonomics | NMT only |
| **Compiler** | C1/C2 arenas during compilation | `CICompilerCount` | NMT only |
| **Symbol** | the symbol table and the string table's keys | class and string count | `jcmd VM.stringtable`, `VM.symboltable` |
| **Internal** / **Other** | command-line parsing, JVMTI, properties, everything else | nothing | NMT only |
| **Arena Chunk** | the arena chunk pool | nothing | NMT only |
| **Shared class space** | the mapped CDS / AOT archive | the archive's size | `-Xlog:cds` |
| **Tracing** | JFR buffers | JFR settings | `jcmd JFR.check` |
| **Logging**, **Statistics**, **Arguments**, **Module**, **Safepoint**, **Serviceability** | small VM bookkeeping | nothing | NMT only |
| **Synchronization**, **Object Monitors** | inflated monitors | contention | NMT only |
| **String Deduplication** | the dedup table | `UseStringDeduplication` | `-Xlog:stringdedup` |
| **JVMCI** | Graal's own allocations | using Graal | NMT only |
| **Unknown** | untagged allocations | nothing | NMT only |

Four of those rows account for essentially all of the variance between two JVMs running the
same code: **Java Heap**, **Class**, **Thread Stack** and **Code**. The rest are either
constant, tiny, or a consequence of one of the four. Start there.

## Java Heap

The only region `-Xmx` bounds. Everything created with `new` and every array lives here,
along with `String` contents, boxed primitives, lambdas' captured state, and — since Java 8 —
interned strings and class static fields, which used to live in PermGen. Virtual thread
stacks live here too, as `StackChunk` objects, which is the single biggest change to this map
since JDK 21; see [06b · Virtual thread stacks](06b-virtual-thread-stacks.md).

The internal shape — eden, two survivor spaces, old generation, humongous regions — is
[03 · The heap](03-the-heap.md). Which collector manages that shape is
**02 · GC in practice** *(not written yet)*.

Read it with `jcmd <pid> GC.heap_info`, which the `jcmd` reference describes simply as
*"Provides generic Java heap information"* at *"Impact: Medium"*, or continuously with
`-Xlog:gc*`.

## Class — metaspace and the compressed class space, which are two things

The `Class` category is the one people misread, because it contains two separately sized
sub-regions. The Troubleshooting Guide's own sample output shows the structure — this is the
documentation's example, not a run of anything:

```
-                     Class (reserved=1069839KB, committed=22543KB)
                            (classes #3554)
                            (  instance classes #3294, array classes #260)
                            (malloc=783KB #7965)
                            (mmap: reserved=1069056KB, committed=21760KB)
                            (  Metadata:   )
                            (    reserved=20480KB, committed=18944KB)
                            (    used=18267KB)
                            (    free=677KB)
                            (    waste=0KB =0.00%)
                            (  Class space:)
                            (    reserved=1048576KB, committed=2816KB)
                            (    used=2454KB)
                            (    free=362KB)
                            (    waste=0KB =0.00%)
```

**Metadata** is metaspace proper: method bytecode, constant pools, method tables, annotations,
everything about a class that is not a pointer target. **Class space** is the compressed class
space, a separate contiguous reservation that holds only `Klass` structures so that a
compressed 32-bit class pointer in an object header can address them. Its reservation defaults
to 1 GB — the `reserved=1048576KB` in the sample above — and it has its own
`OutOfMemoryError: Compressed class space`, distinct from `OutOfMemoryError: Metaspace`.

The count lines are the diagnostic that matters: `classes #3554` with `instance classes #3294,
array classes #260`. A classloader leak shows up here as a class count that only ever rises.
[04 · Metaspace](04-metaspace.md) is the full treatment; `jcmd <pid> VM.metaspace` is the
command.

## Thread and Thread Stack — two categories because they are two costs

```
-                    Thread (reserved=24685KB, committed=1205KB)
                            (thread #24)
                            (stack: reserved=24576KB, committed=1096KB)
                            (malloc=78KB #132)
                            (arena=30KB #46)
```

`Thread` covers the VM's per-thread bookkeeping — the `JavaThread` object, handle areas,
resource areas — and is small, on the order of tens of kilobytes per thread. `Thread Stack`
is the native stack, and it is not small: the `java` man page gives the `-Xss` defaults as
1024 KB on Linux/x64 and macOS/x64, and **2048 KB** on Linux/AArch64 and macOS/AArch64.

The sample above is the shape to learn: 24 threads, `stack: reserved=24576KB` — exactly
24 × 1024 KB — and `committed=1096KB`. Reserved scales linearly with thread count; committed
scales with how deep those threads' stacks have actually gone. A service with a 400-thread
pool reserves 400 MB of address space on x64 and 800 MB on AArch64, and commits a small
fraction of it. [06 · Thread stacks](06-thread-stacks.md) works the arithmetic.

Note that `-Xss` reduces the *reservation*, not the commitment, so lowering it saves address
space and virtual size rather than RSS — unless you lower it far enough to cause
`StackOverflowError`, which is a very expensive way to save nothing.

## Code — the JIT's output

```
-                      Code (reserved=248022KB, committed=7890KB)
                            (malloc=278KB #1887)
                            (mmap: reserved=247744KB, committed=7612KB)
```

That `reserved=248022KB` is the default 240 MB code cache plus a little malloc, and
`committed=7890KB` is what a barely warmed-up JVM has actually filled. The reservation is
free; the commitment grows as methods are compiled and shrinks only when nmethods are
unloaded. A long-running service with a large codebase and a lot of reflection or generated
proxies can commit a substantial fraction of 240 MB.

[05 · The code cache](05-the-code-cache.md) covers the segments, the "CodeCache is full"
condition and what it costs. `jcmd <pid> Compiler.codecache` — *"Prints code cache layout and
bounds"*, impact Low — is the command.

## The rest of the map

The collector's own memory, the compiler arenas, the symbol table, the dozen small
categories, what is *not* on the map at all, and how to read a full NMT report against a
`pmap` are [02b · The rest of the map](02b-the-rest-of-the-map.md).

## Gotchas

**★ `Class` in an NMT summary is two sub-regions with two different limits.**
`Metadata:` is metaspace, bounded by `-XX:MaxMetaspaceSize`. `Class space:` is the compressed
class space, bounded by `-XX:CompressedClassSpaceSize` and defaulting to a 1 GB *reservation*.
They throw different `OutOfMemoryError` detail messages and are raised by different flags.
Reading the combined `Class` total and setting `MaxMetaspaceSize` from it will size the wrong
thing.

**★ The 1 GB compressed class space reservation frightens people who read `reserved`.**
In the documentation's own sample it is `reserved=1048576KB, committed=2816KB`. A gigabyte of
address space, under three megabytes of it committed. It is not a gigabyte of memory and never
was. See [01f · Reserved, committed and resident](01f-reserved-committed-and-resident.md).

**★ `Thread` and `Thread Stack` are different categories and people quote the wrong one.**
`Thread` is per-thread VM bookkeeping and is small. `Thread Stack` is the stacks and is
usually the second- or third-largest reserved region in the process. A footprint estimate
built from the `Thread` line will be low by an order of magnitude.

**★ Reserved thread stack scales with thread count even for idle threads.**
A pool of 400 threads that are all parked reserves 400 stacks. The commitment is small
because parked threads have shallow stacks, but the address space and the `vm.max_map_count`
consumption are real, and the JVM will throw `unable to create native thread` when the OS
refuses the next one.

**★ On AArch64 the default `-Xss` is double the x64 value.**
1024 KB on Linux/x64 and macOS/x64; **2048 KB** on Linux/AArch64 and macOS/AArch64, per the
man page. A service migrated from x64 to Graviton or Apple silicon doubles its thread-stack
reservation with no configuration change at all, which is a genuinely surprising cause of a
footprint regression after a "no-code" platform migration.

**★ The `Code` reservation is 240 MB by default and looks alarming in a small container.**
It is reserved, not committed — the documentation's sample shows `reserved=248022KB,
committed=7890KB`. Lowering `ReservedCodeCacheSize` to make the number look better trades a
free reservation for a real risk of the code cache filling. Judge the row by `committed`.

**★ `jcmd GC.heap_info` is rated "Impact: Medium", not free.**
It is far cheaper than a dump but it is not a passive read. On a very large heap it is
noticeable. Fine to run during an incident, not something to poll every second from a
monitoring agent.

## Interview questions

**★ Walk me through the memory regions of a JVM and say who sizes each.**
Java heap, sized by `-Xmx` or `MaxRAMPercentage`. Class metadata, which is metaspace sized by
`MaxMetaspaceSize` plus a separate compressed class space sized by `CompressedClassSpaceSize`.
Thread stacks, sized by `-Xss` multiplied by the number of platform threads. The code cache,
sized by `ReservedCodeCacheSize` and split into three segments. GC metadata — card tables,
mark bitmaps, G1's remembered sets — which has no flag and scales with heap size and object
graph shape. Compiler arenas, transient. The symbol and string tables. JFR buffers if
recording. The CDS or AOT archive mapping. And underneath all of it the C allocator, which is
not a JVM region at all. `-Xmx` bounds the first of those and nothing else.

**★ Which four regions explain most of the difference between two JVMs' footprints?**
Java heap, class metadata, thread stacks and the code cache. Heap because it is the biggest
and the most configurable; class metadata because it scales with how many classes the
application and its frameworks load, which varies enormously; thread stacks because they
scale with a number most people do not control deliberately; and the code cache because it
scales with how much code actually gets hot. The rest of the categories are either constant,
small, or a function of one of these four.

**★ What is the difference between the `Metadata` and `Class space` lines in an NMT report?**
`Metadata` is metaspace: the bytecode, constant pools, method tables and annotations for
loaded classes, allocated in per-classloader arenas and bounded by `MaxMetaspaceSize`, which
is unlimited by default. `Class space` is the compressed class space, a single contiguous
reservation — 1 GB by default — that holds only `Klass` structures, so that the 32-bit class
pointer in an object header can address them with a shift and an add. They exhaust separately
and produce different `OutOfMemoryError` detail messages.

**★ Your service moved from x64 to ARM and its memory usage went up with no code change.
Why?**
Most likely thread stacks. The JDK 25 man page gives the default `-Xss` as 1024 KB on
Linux/x64 and 2048 KB on Linux/AArch64 — double. A service with a few hundred platform
threads reserves twice the stack address space on the new platform, and commits more of it
too since page granularity and frame sizes differ. Setting `-Xss` explicitly makes the
configuration portable and removes the surprise.

**★ How would you tell a classloader leak from a plain heap leak using only NMT?**
A heap leak grows the `Java Heap` committed figure and leaves `Class` flat. A classloader
leak grows `Class` — both the `Metadata` and `Class space` sub-lines — and grows the
`classes #` count monotonically, usually taking `Symbol` up with it, while the Java heap may
look entirely healthy. Take a baseline with `jcmd VM.native_memory baseline`, wait, and read
`summary.diff`: the categories that moved name the failure without any further work.

**★ Someone shows you an NMT summary where `reserved` is 5.7 GB and asks whether the JVM
needs a bigger container. What do you say?**
That the reserved column is address space and answers no question they are asking. In the
documentation's own example, reserved is 5.7 GB and committed is 351 MB — the compressed
class space alone reserves a gigabyte and commits under three megabytes, and the code cache
reserves 240 MB and commits under eight. The number to compare against the container limit is
the process's RSS, which is lower still than committed, because committed pages that have
never been touched are not resident.

{/* FOOTER */}
