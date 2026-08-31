---
title: "Native Memory Tracking is the only tool that accounts for the JVM's memory by subsystem rather than by heap, which makes it the answer to \"the heap is flat and the pod keeps getting killed\" — and it costs 5–10% throughput, so you turn it on to answer a question and then turn it off"
sidebar_label: "11 · Native Memory Tracking"
sidebar_position: 68
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the **JDK 25 Troubleshooting Guide**, "Diagnostic Tools" and the
> Native Memory Tracking sections
> ([docs.oracle.com/en/java/javase/25/troubleshoot/](https://docs.oracle.com/en/java/javase/25/troubleshoot/)) —
> the mode names, the `jcmd VM.native_memory` subcommands, the documented overhead and the
> category list below are all taken from it — and the **JDK 25 `java` tool reference**
> ([docs.oracle.com/en/java/javase/25/docs/specs/man/java.html](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html))
> for `-XX:NativeMemoryTracking`. JDK 25 · Spring Boot 4.1.0.
> **No sandbox** — this page gives the commands and describes what each reports. It contains
> **no captured NMT output**; where a report's structure is shown it is described in prose or
> presented as an explicitly labelled schematic.

**Every other memory tool in this phase answers a question about the heap. `-Xmx` bounds it, GC
logs describe it, heap dumps enumerate it. Native Memory Tracking is the one that answers the
question the heap tools cannot: *where is the rest of it?* When a container is killed while the
heap graph is flat and boring, NMT is how you stop guessing — it accounts for the JVM's own
memory by subsystem, with a baseline you can diff against.**

It is also the tool people leave switched on, which is a mistake the documentation warns about
explicitly. Everything below assumes you are turning it on deliberately, for a bounded
investigation.

This chunk owns **what NMT covers and how to read a report**. The technique that actually finds
things — baseline, wait, diff — and what it costs are in
[11b · The NMT baseline workflow](11b-the-nmt-baseline-workflow.md).

## What it does and does not cover

The troubleshooting guide is precise about the scope, and the boundary is the most important
thing on this page:

> Native Memory Tracking *"tracks internal memory usage for a Java HotSpot VM. It does not track
> memory allocations by non-JVM code."*

Read that second sentence as a feature, not a limitation. It gives you a clean split:

- **What NMT accounts for** is the JVM's own allocation — heap, class metadata, threads,
  generated code, GC structures, the compiler, symbols, and so on.
- **What it does not account for** is everything a native library allocates: a JDBC driver's
  native side, a compression or crypto library, an image codec, a native agent, the allocator's
  own overhead.

So when RSS substantially exceeds what NMT reports as committed, **that gap is itself the
finding.** It says "the growth is in native code the JVM did not allocate", which is a completely
different investigation with completely different tools —
[11c · The footprint that is not in any region](11c-the-footprint-that-is-not-in-any-region.md)
owns it.

## Turning it on

NMT must be enabled at startup. It cannot be attached to a running JVM, which is the single most
inconvenient thing about it and the reason to think about it *before* an incident:

```bash
-XX:NativeMemoryTracking=off       # the default
-XX:NativeMemoryTracking=summary   # by subsystem — what you want almost always
-XX:NativeMemoryTracking=detail    # additionally by call site and virtual memory region
```

The tool reference's own descriptions of the modes:

> `summary` — *"Tracks memory usage only by JVM subsystems, such as Java heap, class, code, and
> thread."*
>
> `detail` — *"In addition to tracking memory usage by JVM subsystems, track memory usage by
> individual `CallSite`, individual virtual memory region and its committed regions."*

🔴 **Start with `summary`.** It answers "which subsystem is growing", which is the question you
actually have. `detail` answers "which call site allocated it", which is a JVM-engineering
question you rarely need and which costs more.

Because it is a startup flag, the practical pattern for a service you may one day need to debug
is to **decide in advance**: either accept the overhead permanently (rarely justified), or make
`-XX:NativeMemoryTracking=summary` a one-line change your deployment can apply to a single
replica quickly. A flag you cannot turn on until the next release is not a diagnostic tool.

## Reading it

Once enabled, `jcmd` queries it. The documented subcommands:

```bash
jcmd <pid> VM.native_memory                  # summary data
jcmd <pid> VM.native_memory summary          # explicitly, by subsystem
jcmd <pid> VM.native_memory detail           # by call site and region (detail mode only)
jcmd <pid> VM.native_memory baseline         # remember the current numbers
jcmd <pid> VM.native_memory summary.diff     # change since the baseline
jcmd <pid> VM.native_memory detail.diff      # change since the baseline, by call site
```

Every category is reported with two numbers, and confusing them is the most common misreading of
an NMT report:

| Number | Means |
|---|---|
| **Reserved** | Address space claimed. Costs virtual address space, not physical memory. |
| **Committed** | Backed by the OS and countable against a memory limit. |

🔴 **Reserved is not memory you are using.** A JVM routinely reserves far more than it commits —
the heap reserves `-Xmx` up front and commits toward it — and a reserved figure that looks
alarming next to a container limit is almost always harmless. **Compare *committed* against a
cgroup limit**, never reserved. This single distinction resolves a large fraction of "NMT says
we're using 12 GB" panics.

## The categories, and what each one tells you

The troubleshooting guide's category list, with what a growing number in each actually means:

| Category | The guide's description | If it grows |
|---|---|---|
| **Java Heap** | *"The heap where objects live"* | Ordinary heap growth — go to [topic 04](../04-out-of-memory-error/_plan.md) |
| **Class** | *"Class meta data"* | Metaspace: class count growing, or a classloader leak. See [04 · Metaspace](04-metaspace.md) |
| **Thread** | *"Memory used by threads, including thread data structure, resource area, handle area"* | Thread count × stack size. See [06 · Thread stacks](06-thread-stacks.md) |
| **Code** | *"Generated code"* | The JIT's code cache. See [05 · The code cache](05-the-code-cache.md) |
| **GC** | *"Data used by the GC (such as card table, except remembered sets)"* | A function of heap size and collector choice |
| **GCCardSet** | *"Data used by the GC's remembered sets (optional, G1 only)"* | G1's remembered sets — grows with cross-region references |
| **Compiler** | *"Memory tracking used by the compiler when generating code"* | Transient; compilation activity |
| **Internal** | *"Memory that doesn't fit previous categories (command line parser, JVMTI, properties)"* | Often JVMTI — check for an attached agent |
| **Other** | *"Memory not covered by another category"* | 🔴 Where **direct `ByteBuffer`s** commonly land |
| **Symbol** | *"Memory for symbols"* | Symbol table growth, usually alongside Class |
| **Native Memory Tracking** | *"Memory used by NMT"* | NMT's own accounting — it tracks itself |
| **Arena Chunk** | *"Memory used by chunks in the arena chunk pool"* | Internal arenas |
| **Logging** | *"Memory used by logging"* | Unified logging structures |
| **Arguments** | *"Memory for arguments"* | Small and constant |
| **Module** | *"Memory used by modules"* | Module system structures |

Two of these are worth calling out because they are where investigations usually land.

**`Thread`** is the one that catches people who scaled a pool. It is roughly thread count
multiplied by committed stack, and it is entirely outside the heap — so a service that raised a
thread pool from 200 to 2000 grew its footprint by a large amount that `-Xmx` neither bounds nor
reports. [06 · Thread stacks](06-thread-stacks.md) has the arithmetic.

**`Other`** is where direct byte buffers usually show up, and it is the category people skip
because the name suggests it is a rounding error. A leaked `ByteBuffer.allocateDirect` — an NIO
buffer, a Netty pool, a memory-mapped file — grows here and nowhere else.
[07 · Direct and mapped buffers](07-direct-and-mapped-buffers.md) owns it.

## Gotchas

**★ NMT cannot be enabled on a running JVM.** It is a startup flag. If you did not set it before
the incident, you cannot get NMT data about that incident — you can only restart with it on and
wait for the problem to recur. Decide your policy before you need it.

**★ Reserved is not committed, and only committed counts against a container limit.** A JVM
reserves address space generously; the heap reserves `-Xmx` up front. Reading the reserved
column and comparing it to a memory limit produces alarm about nothing. Compare *committed*.

**★ NMT does not see native library allocations.** The guide says so directly: it *"does not
track memory allocations by non-JVM code"*. A JDBC driver's native side, a compression library,
an image codec and the allocator's own overhead are all invisible. When RSS exceeds NMT's
committed total, that gap is the finding, not a bug in the tool.

**★ NMT's total will not equal RSS, and it is not supposed to.** Beyond native libraries, there
is the allocator's fragmentation, the binary and its mappings, and pages that are committed but
never touched. Expecting the numbers to reconcile exactly leads people to distrust a tool that is
working correctly.

**★ The `Other` category is not a rounding error.** Direct byte buffers commonly land there, so
the category with the least informative name is frequently the one holding your leak. Do not skip
it because it sounds like noise.

**★ `Internal` growing often means an agent.** JVMTI structures are accounted there, so a
profiler, an APM agent or a debugger attached to the process shows up in a category whose name
gives no hint of it.

**★ `detail` mode's call sites are JVM internals, not your code.** They name the C++ call sites
inside HotSpot that allocated the memory. That is exactly right for a JVM bug and nearly useless
for an application leak, which is another reason `summary` is the right default.

**★ `jcmd` must be able to reach the process.** Same user or sufficient privilege, and a shared
PID namespace. In a container that usually means running `jcmd` *inside* it — which requires the
JDK tools to be present, an argument against a bare-JRE base image that
[topic 10](../10-packaging-for-deploy/_plan.md) has to weigh.

**★ NMT tracks the JVM, not the container.** If something else in the pod is using memory — a
sidecar, a log shipper — NMT will never mention it, and the container can still be killed.
Establish what else shares the limit before blaming the JVM.

**★ `GCCardSet` appears only for G1.** The guide marks it *"(optional, G1 only)"*. A report from
a ZGC or Parallel process that lacks the category is not missing data; it is a different
collector with different structures.

## Interview questions

**★ What problem does Native Memory Tracking solve that a heap dump cannot?**
A heap dump enumerates Java objects on the heap. NMT accounts for the JVM's memory by
*subsystem* — heap, class metadata, threads, code cache, GC structures, compiler, symbols and so
on — which is the only way to answer "the heap is flat and the process is still growing". That
question is common in containers, where the process is killed by the kernel for exceeding a
cgroup limit rather than by the JVM throwing `OutOfMemoryError`, and where the growth is
therefore by definition somewhere `-Xmx` does not bound.

**★ How do you enable it, and what is the catch?**
`-XX:NativeMemoryTracking=summary` or `=detail` at startup. The catch is exactly that: it is a
startup flag and cannot be attached to a running JVM, so you cannot get NMT data about an
incident you did not anticipate. That makes it a policy decision rather than a reactive tool —
either you accept the overhead permanently, which is rarely justified, or you make sure you can
restart one replica with the flag quickly.

**★ What is the difference between reserved and committed in an NMT report, and which one
matters?**
Reserved is address space claimed; committed is memory actually backed by the OS. Only committed
counts against a container's memory limit or contributes to RSS. This matters because a JVM
reserves generously — the heap reserves `-Xmx` up front and commits toward it — so the reserved
figure is routinely several times the real usage and looks alarming next to a limit. Comparing
reserved against a cgroup limit is one of the most common misreadings of the tool.

**★ NMT's committed total is 1.2 GB but the container's RSS is 1.8 GB. What is your conclusion?**
That roughly 600 MB is being allocated by something that is not the JVM, because the
documentation is explicit that NMT *"does not track memory allocations by non-JVM code"*. That is
a finding, not a discrepancy. The candidates are native libraries — a JDBC driver's native side,
a compression or crypto library, an image codec — a native agent, the allocator's own
fragmentation and arenas, and anything else sharing the container. The next tools are outside the
JVM: `pmap`, the allocator's own statistics, or `jemalloc`/`malloc` tuning, and the first
question is whether anything else in the pod shares that limit.
[11c](11c-the-footprint-that-is-not-in-any-region.md) is that investigation.

**★ When would you use `detail` rather than `summary`?**
Rarely, and only when `summary` has already told you which subsystem is growing and you need to
know which call site inside the JVM allocated it. That is a JVM-engineering question — chasing a
suspected HotSpot bug, or understanding an unusual internal structure — because the call sites
`detail` reports are HotSpot's own C++ call sites, not your application's Java frames. For an
application-level leak it adds cost and no useful resolution.

**★ A colleague says NMT shows 3 GB reserved for the heap so the container needs 4 GB. Respond.**
That reserved is address space, not memory. The JVM reserves the full `-Xmx` range at startup so
the heap can grow contiguously, but only the committed portion is backed by physical pages and
only that counts against the container limit. The right number to size against is committed, plus
the committed totals of the non-heap categories — Thread, Class, Code, GC, Other — plus a margin
for what NMT cannot see at all, which is native library allocation. Sizing from reserved would
over-provision every container in the fleet.

**★ Your NMT summary shows the `Thread` category at 800 MB. Is that a leak?**
Not necessarily — it is arithmetic before it is a leak. The Thread category is roughly the number
of threads multiplied by the committed portion of each stack, plus per-thread JVM structures, and
it lives entirely outside the heap so `-Xmx` neither bounds nor reports it. Eight hundred
megabytes is what a few thousand platform threads legitimately cost. The question is whether the
thread count is intended: a pool that was raised without anyone costing the memory looks
identical to a leak in this number. Counting threads is the next step, and if the count is both
high and intended, virtual threads are the structural answer rather than a smaller stack size.
{/* FOOTER */}
