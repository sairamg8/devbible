---
title: "-Xmx bounds one region of a JVM process out of roughly twenty, and the specification itself says so in a paragraph almost nobody reads"
sidebar_label: "01 · Heap is not the process"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the **JVM Specification, Java SE 25, §2.5 Run-Time Data
> Areas** ([docs.oracle.com](https://docs.oracle.com/javase/specs/jvms/se25/html/jvms-2.html)),
> the **JDK 25 `java` tool reference** — `-Xmx`, `-Xms`
> ([docs.oracle.com/en/java/javase/25/docs/specs/man/java.html](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html)),
> the **JDK 25 Troubleshooting Guide**, "Native Memory Tracking → NMT Memory Categories"
> ([diagnostic-tools](https://docs.oracle.com/en/java/javase/25/troubleshoot/diagnostic-tools.html)),
> and the JDK 25 HotSpot source `src/hotspot/share/nmt/memTag.hpp` at tag `jdk-25+36`
> ([github.com/openjdk/jdk](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/nmt/memTag.hpp)).
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**Almost every production Java memory incident that takes more than an hour to diagnose
starts with somebody treating `-Xmx` as the size of the process. It is not. It is the
maximum size of *one* region — the Java object heap — and a running HotSpot JVM has around
twenty regions, of which the heap is merely the largest and the only one most people can
name. This page establishes the map. It is the framing the rest of Phase 12 leans on: once
you can name the regions and say who sizes each, "the pod grew and the heap is flat" stops
being a mystery and becomes a lookup.**

## What `-Xmx` actually promises

The JDK 25 `java` tool reference is precise and narrow:

> *"`-Xmx size` — Specifies the maximum size (in bytes) of the memory allocation pool in
> bytes. This value must be a multiple of 1024 and greater than 2 MB."*

"The memory allocation pool" is the Java object heap and nothing else. The specification is
even clearer about what that heap is for — JVMS §2.5.3:

> *"The Java Virtual Machine has a heap that is shared among all Java Virtual Machine
> threads. The heap is the run-time data area from which memory for all class instances and
> arrays is allocated."*

Class instances and arrays. That is the complete list. Every byte a JVM spends on anything
that is not a class instance or an array — the `Class` metadata describing them, the machine
code the JIT emitted to manipulate them, the stack frames of the threads running that code,
the remembered sets the collector needs to trace them — is spent somewhere `-Xmx` does not
reach.

`-Xms` is the other half of the same knob and is equally often misread:

> *"`-Xms size` — Sets the minimum and initial size (in bytes) of the heap. This value must
> be a multiple of 1024 and greater than 1 MB."*

Minimum *and* initial. Setting `-Xms` equal to `-Xmx` fixes the heap's committed size for
the life of the process, which removes one variable from a footprint investigation. It
removes exactly one.

## The specification names six areas, and `-Xmx` covers one of them

JVMS §2.5 enumerates the run-time data areas an implementation must provide. Reading them
in order is the fastest cure for the "heap is the process" assumption:

| JVMS area | Per-thread? | Where HotSpot puts it | Bounded by |
|---|---|---|---|
| **pc register** (§2.5.1) | yes | a machine register / thread struct | nothing you can set |
| **JVM stacks** (§2.5.2) | yes | native memory, one mapping per platform thread | `-Xss` × thread count |
| **Heap** (§2.5.3) | no | the Java heap | **`-Xmx`** |
| **Method area** (§2.5.4) | no | **metaspace — native memory** | `-XX:MaxMetaspaceSize` |
| **Run-time constant pool** (§2.5.5) | no | inside the method area | as above |
| **Native method stacks** (§2.5.6) | yes | native memory | platform / `-Xss` |

The method area row is the one that surprises people, because the specification itself
hedges:

> *"The method area is created on virtual machine start-up. Although the method area is
> logically part of the heap, simple implementations may choose not to either garbage
> collect or compact it. This specification does not mandate the location of the method area
> or the policies used to manage compiled code."*

"Logically part of the heap" is why Java 7 and earlier had PermGen *inside* the heap's
address space. "Does not mandate the location" is the licence HotSpot used in Java 8 to move
it out into native memory entirely. Both readings are conforming.
[04 · Metaspace](04-metaspace.md) tells that story properly.

Note also what the specification does **not** mention: the code cache. JIT-compiled machine
code is not a run-time data area at all in JVMS terms — §2.5.4 says only that the spec "does
not mandate ... the policies used to manage compiled code". The code cache is a pure HotSpot
implementation region, which is exactly why it is invisible to people whose model of the JVM
came from a specification summary. [05 · The code cache](05-the-code-cache.md) covers it.

Two more sentences from §2.5 are worth banking, because they explain why a JVM's address
space looks so strange in `pmap`:

> *"The memory for the heap does not need to be contiguous."*
>
> *"Because the Java Virtual Machine stack is never manipulated directly except to push and
> pop frames, frames may be heap allocated. The memory for a Java Virtual Machine stack does
> not need to be contiguous."*

The first is why G1 and ZGC can back one logical heap with many mappings. The second is the
specification-level permission that virtual threads rely on: their frames live in `StackChunk`
objects on the Java heap rather than on a native stack, which is
[06b · Virtual thread stacks](06b-virtual-thread-stacks.md).

## The regions HotSpot actually has

The authoritative list is not in any tutorial; it is the set of memory tags Native Memory
Tracking uses to classify every reservation the VM makes. In JDK 25 that enumeration lives
in `src/hotspot/share/nmt/memTag.hpp` and reads, verbatim:

```cpp
f(mtJavaHeap,       "Java Heap")   /* Java heap                                 */ \
f(mtClass,          "Class")       /* Java classes                              */ \
f(mtThread,         "Thread")      /* thread objects                            */ \
f(mtThreadStack,    "Thread Stack")                                                \
f(mtCode,           "Code")        /* generated code                            */ \
f(mtGC,             "GC")                                                          \
f(mtGCCardSet,      "GCCardSet")   /* G1 card set remembered set                */ \
f(mtCompiler,       "Compiler")                                                    \
f(mtJVMCI,          "JVMCI")                                                       \
f(mtInternal,       "Internal")                                                    \
f(mtOther,          "Other")       /* memory not used by VM                     */ \
f(mtSymbol,         "Symbol")                                                      \
f(mtNMT,            "Native Memory Tracking")                                      \
f(mtClassShared,    "Shared class space")      /* class data sharing            */ \
f(mtChunk,          "Arena Chunk")                                                 \
f(mtTracing,        "Tracing")                                                     \
f(mtLogging,        "Logging")                                                     \
f(mtStatistics,     "Statistics")                                                  \
f(mtArguments,      "Arguments")                                                   \
f(mtModule,         "Module")                                                      \
f(mtSafepoint,      "Safepoint")                                                   \
f(mtSynchronizer,   "Synchronization")                                             \
f(mtServiceability, "Serviceability")                                              \
f(mtMetaspace,      "Metaspace")                                                   \
f(mtStringDedup,    "String Deduplication")                                        \
f(mtObjectMonitor,  "Object Monitors")                                             \
f(mtNone,           "Unknown")                                                     \
```

Exactly one of those lines — `mtJavaHeap` — is what `-Xmx` bounds. Every other line is a
place your resident set can grow while your heap dashboard shows a flat sawtooth.
[02 · The process map](02-the-process-map.md) walks each one and says who sizes it.

The Troubleshooting Guide reproduces a subset of this list as "Table 2-1 Native Memory
Tracking Memory Categories", with a warning that is easy to miss and worth heeding:

> *"Table 2-1 describes native memory categories used by NMT. These categories may change
> with a release."*

That is not boilerplate. `GCCardSet`, `String Deduplication` and `Object Monitors` are
comparatively recent additions, and the documentation table is already behind the JDK 25
header shown above. When a category name in a blog post does not exist in your output,
check the header for your JDK before concluding something is wrong.

## What this framing buys you

Three things that recur for the rest of the phase:

1. **A memory symptom has a *region*, and the region selects the tool.** Heap → GC log and
   heap dump. Metaspace → `jcmd VM.metaspace` and classloader statistics. Code → `jcmd
   Compiler.codecache`. Thread stacks → a thread dump and arithmetic. Everything else →
   Native Memory Tracking.
2. **A limit belongs to a region.** `-Xmx`, `-XX:MaxMetaspaceSize`, `-XX:ReservedCodeCacheSize`,
   `-Xss`, `-XX:MaxDirectMemorySize` are five different ceilings on five different things.
   Raising the wrong one is the single most common wasted deploy in a memory incident.
3. **The process has no single limit inside the JVM at all.** There is no `-XX:MaxProcessSize`.
   The only ceiling on the whole process is imposed from outside — a cgroup limit, an
   `ulimit`, the machine's RAM — which is why the JVM can be killed without ever throwing.
   That asymmetry is the subject of
   [01b · `OutOfMemoryError` versus OOMKilled](01b-oom-error-versus-oomkilled.md).

## Gotchas

**★ `-Xmx` is a ceiling on one region, not a budget for the process.**
Setting `-Xmx` equal to a container's memory limit guarantees that if the heap ever actually
grows to its maximum, the process is over the limit by the size of everything else. The JVM
will be killed before it ever throws `OutOfMemoryError`, so you lose the diagnostic the JVM
was prepared to give you.

**★ `-Xms` equal to `-Xmx` does not make the process size predictable.**
It makes the *heap's committed* size predictable, which is genuinely useful — it removes heap
growth as a variable. It says nothing about metaspace, the code cache or thread stacks, all
of which still grow over the life of the process. A service that is stable for an hour and
killed at hour six is usually growing one of those.

**★ `Runtime.getRuntime().maxMemory()` reports the heap, not the process.**
So does `MemoryMXBean.getHeapMemoryUsage()`, so does the Micrometer `jvm.memory.max` gauge
with `area=heap`. Building a container-sizing formula out of them measures one region and
calls it the answer. `jvm.memory.*` with `area=nonheap` is closer but still only covers the
pools the JVM exposes through `MemoryPoolMXBean` — not thread stacks, not GC structures, not
the C allocator.

**★ The code cache does not appear in JVMS at all, so a spec-derived mental model has a
240 MB hole in it.**
JVMS §2.5 lists six run-time data areas and explicitly declines to mandate how compiled code
is managed. Everything you know about the code cache comes from HotSpot documentation and
HotSpot source, not from the specification — which is why "the JVM has heap, stack and
method area" is a correct but dangerously incomplete answer in production.

**★ NMT's category list is versioned, and the documentation table lags the source.**
The Troubleshooting Guide's Table 2-1 says outright that *"these categories may change with
a release"*, and on JDK 25 it omits several tags that `memTag.hpp` defines. Read the header
for your exact JDK before deciding a category is missing or misnamed.

**★ "The method area" and "metaspace" are not synonyms in a precise conversation.**
The method area is the specification's abstraction; metaspace is HotSpot's implementation of
most of it. Some of what JVMS puts in the method area — the string constants and the class
statics — lives on the Java heap in HotSpot, not in metaspace. That distinction is exactly
what JEP 122 changed, and it is the detail interviewers use to separate people who read the
spec from people who read a summary. See [04 · Metaspace](04-metaspace.md).

**★ Reserved is not committed and committed is not resident.**
Three different numbers, all reported by different tools, all routinely conflated in the
same sentence. This trips up almost every first reading of an NMT report and has its own
page: [01f · Reserved, committed and resident](01f-reserved-committed-and-resident.md).

**★ Counting "twenty regions" is a rhetorical device, not a constant.**
`memTag.hpp` on JDK 25 defines twenty-seven tags including `Unknown`, and some of them will
be zero in any given process (`JVMCI` without Graal, `String Deduplication` without it
enabled). The point is the order of magnitude and the fact that you can enumerate them — not
a number to quote.

## Interview questions

**★ What, exactly, does `-Xmx` bound?**
The maximum size of the Java object heap — in the man page's words, *"the memory allocation
pool"* — which JVMS §2.5.3 defines as *"the run-time data area from which memory for all
class instances and arrays is allocated"*. It bounds nothing else: not class metadata, not
JIT-compiled code, not thread stacks, not GC bookkeeping, not direct buffers, not the C
allocator. In Native Memory Tracking terms it is a limit on the `Java Heap` category and on
no other category.

**★ Which parts of a JVM's memory are *not* covered by `-Xmx`?**
Metaspace and the compressed class space, the JIT code cache, every platform thread's stack
and native method stack, the GC's own metadata (card tables, remembered sets, mark bitmaps),
the compilers' arenas, the symbol and string tables, JFR buffers, direct and mapped
`ByteBuffer`s, the class-data-sharing or AOT archive mapping, and whatever the C allocator
holds on to. NMT gives most of those a category of their own; the last one it cannot see at
all.

**★ Why does the specification say the method area is "logically part of the heap" when
HotSpot puts it in native memory?**
Because JVMS §2.5.4 deliberately declines to mandate a location: it says the method area is
logically part of the heap but that the specification *"does not mandate the location of the
method area or the policies used to manage compiled code"*. Java 7 and earlier took the
literal reading and implemented it as PermGen, a heap generation inside `-Xmx`. JEP 122 took
the licence and moved class metadata to native memory in Java 8. Both are conforming
implementations of the same paragraph, which is why the answer to "where does class metadata
live" changed without the specification changing.

**★ Name the run-time data areas the JVM specification defines, and say which are per-thread.**
Six: the pc register, JVM stacks, the heap, the method area, the run-time constant pool, and
native method stacks. The pc register, the JVM stack and the native method stack are
per-thread — *"created when a thread is created and destroyed when the thread terminates"*.
The heap, the method area and the run-time constant pool (which lives inside the method area)
are shared across all threads. The per-thread ones are why thread count multiplies into your
footprint and the shared ones are why they do not.

**★ Where does the code cache fit into that list?**
It does not, and that is the interesting part. JVMS says nothing about where compiled code
lives — §2.5.4 explicitly leaves *"the policies used to manage compiled code"* to the
implementation. The code cache is a HotSpot construct: a separately reserved native region,
240 MB by default under tiered compilation, split into three segments. It is one of the two
regions (with metaspace) that most often surprise a team that sized a container from `-Xmx`.

**★ How would you enumerate the memory regions of a JVM you had never seen before, with only
a shell and a PID?**
Start it, or restart it, with `-XX:NativeMemoryTracking=summary` and run
`jcmd <pid> VM.native_memory summary`. The output is organised by exactly the category list
in `memTag.hpp`, with reserved and committed for each, so it *is* the enumeration — you do
not have to know the regions in advance, the tool names them. Compare its total against the
process's RSS from `ps` or `/proc/<pid>/status`; the gap is memory the JVM did not allocate
through its own tracked paths, which is the pointer to JNI or the allocator.

**★ Why is "the JVM has a heap, a stack and a method area" an incomplete answer in a
production context?**
Because it is the specification's model, and the specification deliberately does not describe
the regions that cause most production incidents. It omits the code cache, says nothing about
GC metadata, does not distinguish metaspace from the compressed class space, and has no
concept of direct buffers or of the native allocator underneath everything. It is the right
answer to "what does JVMS define"; it is the wrong answer to "why is my pod being killed".

{/* FOOTER */}
