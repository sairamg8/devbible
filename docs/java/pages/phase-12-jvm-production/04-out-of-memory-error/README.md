---
title: "OutOfMemoryError is one exception class covering nine unrelated failures across six regions of memory, and the word after the colon decides which of your tools are relevant and which are a wasted afternoon"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **JDK 25 Troubleshooting Guide**
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/troubleshoot/troubleshooting-memory-leaks.html)),
> the **JDK 25 `java`, `jcmd` and `jmap` tool references**
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html)), the
> **HotSpot Garbage Collection Tuning Guide, Release 25**
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/gctuning/)), **JEP 506 · Scoped
> Values** ([openjdk.org](https://openjdk.org/jeps/506)), the **Eclipse Memory Analyzer
> documentation** ([help.eclipse.org](https://help.eclipse.org/latest/topic/org.eclipse.mat.ui.help/)),
> and the **JDK 25 HotSpot and JDK source at tag `jdk-25+36`**
> ([github.com/openjdk/jdk](https://github.com/openjdk/jdk/tree/jdk-25%2B36)) — which is the only
> documentation for the OOM hook function, the pre-allocated error pool, three heap-dump flags and
> two detail messages that Oracle's documentation does not mention at all.
> 🔴 **No sandbox.** There is no JVM running behind these pages: no heap dump, no MAT screenshot, no
> dominator tree, no retained size, no stack trace and no timing was produced by running anything.
> Every output shape is quoted from documentation and attributed, or is presented as a schematic.
> JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9.

**Nine different things can print `java.lang.OutOfMemoryError` on a JDK 25 JVM. They share a class
name and nothing else: not a cause, not a fix, not even the same evidence — one of them takes the
process down through the fatal-error handler and writes an `hs_err` log instead of throwing, two of
them fire none of the JVM's OOM flags at all, and four of them are absent from Oracle's enumerated
list. Two respond to more heap. The rest are metaspace, a bounded klass-pointer sub-region, the
native heap, a third-party library's allocator, direct buffers, thread creation and a hard VM limit
on array length. Everything in this topic follows from reading the word after the colon.**

Three corrections carry most of the value here, and each contradicts something widely published:

1. 🔴 **The Troubleshooting Guide documents seven detail messages, not eight.** `Direct buffer
   memory` and the native-thread failure are real and are *not on that list* — and the direct-buffer
   message is not the string everybody quotes. It is
   `Cannot reserve N bytes of direct buffer memory (allocated: A, limit: L)`, from `java.nio.Bits`.
   Two more, `C heap space` and
   `Java heap space: failed reallocation of scalar replaced objects`, are pre-allocated by HotSpot
   and enumerated nowhere.
2. 🔴 **All four OOM flags live in one function and fire once per JVM lifetime.**
   `report_java_out_of_memory` is guarded by a compare-and-swap on a `static int` that is never
   reset. One heap dump, ever. And `-XX:+ExitOnOutOfMemoryError` calls `os::_exit(3)` — exit code 3,
   *"quick exit with no cleanup hooks run"*, so no shutdown hooks, no graceful drain.
3. 🔴 **`GC overhead limit exceeded` can only be produced by Parallel GC.** G1 — the JDK 25 default
   — Serial and ZGC take the out-parameter that carries the verdict and never set it. On most
   services the absence of that message means nothing at all.

**23 chunks, ~6,000 lines.** Read in order; each chunk links to the next.

| # | Chunk | Tier | What it argues |
|---|---|---|---|
| 1 | **[Error, not exception](01-it-is-an-error-not-an-exception.md)** | <span className="db-tier t-understand">Understand</span> | The type hierarchy is a warning label, and the trace names the victim |
| 2 | **[The trace-less OOM](01b-the-error-with-no-stack-trace.md)** | <span className="db-tier t-understand">Understand</span> | Four pre-allocated errors, a countdown that never refills |
| 3 | **[The seven messages](02-the-seven-documented-messages.md)** | <span className="db-tier t-understand">Understand</span> | The documented list, and the three that are about the heap |
| 4 | **[The four native messages](02b-the-four-native-messages.md)** | <span className="db-tier t-understand">Understand</span> | Metaspace, class space, swap and JNI — where `-Xmx` hurts |
| 5 | **[Parallel GC only](02c-gc-overhead-limit-is-parallel-only.md)** | <span className="db-tier t-understand">Understand</span> | G1 cannot print it, so its absence proves nothing |
| 6 | **[Not on the list](02d-the-messages-that-are-not-on-the-list.md)** | <span className="db-tier t-understand">Understand</span> | Four real messages Oracle never enumerated, quoted from source |
| 7 | **[The message decides the fix](02e-the-message-decides-the-fix.md)** | <span className="db-tier t-understand">Understand</span> | The routing table from the colon to the first command |
| 8 | **[The hooks are one function](03-the-oom-hooks-are-one-function.md)** | <span className="db-tier t-understand">Understand</span> | One CAS, one dump per JVM, `os::_exit(3)`, no shutdown hooks |
| 9 | **[Which failures trigger them](03b-which-failures-actually-trigger-them.md)** | <span className="db-tier t-understand">Understand</span> | The call-site inventory, and arming the flags at runtime |
| 10 | **[Getting a heap dump](03c-getting-a-heap-dump.md)** | <span className="db-tier t-understand">Understand</span> | Five routes, five different defaults for unreachable objects |
| 11 | **[The dump you could not take](03d-the-dump-you-could-not-take.md)** | <span className="db-tier t-understand">Understand</span> | The pause, the disk, the analysis machine and the lawyer |
| 12 | **[Reading a dump in MAT](04-reading-a-dump-in-mat.md)** | <span className="db-tier t-understand">Understand</span> | The histogram is the wrong view; the dominator tree is the right one |
| 13 | **[Shallow vs retained](04b-shallow-versus-retained.md)** | <span className="db-tier t-understand">Understand</span> | Why retained sizes do not sum, and must not |
| 14 | **[Leak suspects and GC roots](04c-leak-suspects-and-paths-to-gc-roots.md)** | <span className="db-tier t-understand">Understand</span> | A published algorithm with a ten-percent threshold and an exclusion list |
| 15 | **[OldObjectSample](04d-old-object-sample-instead-of-a-dump.md)** | <span className="db-tier t-understand">Understand</span> | The allocation site a heap dump structurally cannot contain |
| 16 | **[The usual suspects](05-the-usual-suspects.md)** | <span className="db-tier t-understand">Understand</span> | Unbounded cache, unbounded queue, static field, missing `hashCode` |
| 17 | **[ThreadLocal on a pool](05b-threadlocal-on-a-pooled-thread.md)** | <span className="db-tier t-understand">Understand</span> | Weak key, strong value, and a thread that never dies |
| 18 | **[Classloader leak in a dump](05c-finding-a-classloader-leak-in-a-dump.md)** | <span className="db-tier t-understand">Understand</span> | The wrong tool for measuring it, the only tool for fixing it |
| 19 | **[Listeners and registrations](05d-listeners-callbacks-and-forgotten-registrations.md)** | <span className="db-tier t-understand">Understand</span> | Every register is a promise to deregister, and `remove(this::x)` misses |
| 20 | **[When it is not a leak](06-when-it-is-not-a-leak.md)** | <span className="db-tier t-understand">Understand</span> | Live set after full GC, under stable load, after warm-up |
| 21 | **[References and caches](07-references-and-caches.md)** | <span className="db-tier t-understand">Understand</span> | A soft cache is sized by `-Xmx`, not by you |
| 22 | **[Finalizers and cleaners](07b-finalizers-and-cleaners.md)** | <span className="db-tier t-understand">Understand</span> | Two collections, one daemon thread, and `Cleaner` is still not timely |
| 23 | **[The checklist](08-the-checklist.md)** | <span className="db-tier t-understand">Understand</span> | Error line to fix in nine steps; the dump is number six |

## The six things this topic is really about

1. **The detail message names the region, and the region decides the tool.** Two of nine mean "add
   heap". For six of them a heap dump physically cannot contain the answer, because the HPROF format
   holds only the Java heap. Reading the message costs zero seconds and eliminates seven
   possibilities.
2. **The evidence is created once, at the start.** The OOM hooks fire once per process; the
   trace-bearing error pool holds four. By the tenth `OutOfMemoryError` there is no dump, no trace
   and nothing new. Find error number one.
3. **The documentation and the implementation disagree in two directions.** The man page says
   `HeapDumpOnOutOfMemoryError` covers only heap exhaustion; on JDK 25 `metaspace.cpp` calls the
   same hook with a comment naming the flag. Conversely the guide's `GC.class_histogram filename=`
   example does not work, its `MaxMetaSpaceSize` spelling does not exist, and its
   `UseCompressedClassPointers` advice targets a flag that is obsolete in JDK 26. Configure for the
   documented contract; know the implemented behaviour.
4. **Shallow size is a property of the class; retained size is a property of the data.** Everything
   in leak analysis is that one distinction, which is why the default histogram view is useless and
   the dominator tree is decisive.
5. **Every leak is an unintended reference, and there are only about seven places it lives.** A
   collection nobody bounded, a queue absorbing backpressure, a static field, a `ThreadLocal` on a
   borrowed thread, a classloader nobody released, a listener nobody removed, and a key with no
   `hashCode`. Four code-review questions catch most of them.
6. **Most of the diagnosis had to be configured before the incident.** GC logs, a durable
   `HeapDumpPath`, JFR and Native Memory Tracking are all launch-time decisions, and NMT cannot even
   be attached to a running JVM. The step that improves the next incident is the flag list at the
   end of [08 · The checklist](08-the-checklist.md).

## Where this connects

- **[01 · Memory layout](../01-memory-layout/README.md)** owns *where the bytes are* — the heap
  generations, [metaspace](../01-memory-layout/04-metaspace.md), the
  [code cache](../01-memory-layout/05-the-code-cache.md),
  [thread stacks](../01-memory-layout/06-thread-stacks.md),
  [direct buffers](../01-memory-layout/07-direct-and-mapped-buffers.md) and
  [Native Memory Tracking](../01-memory-layout/11-native-memory-tracking.md). It also owns the
  framing this topic assumes: the
  [`OutOfMemoryError`-versus-OOMKilled distinction](../01-memory-layout/01b-oom-error-versus-oomkilled.md),
  the [OOM flags as documented](../01-memory-layout/01c-the-oom-flags-and-what-they-cover.md), the
  [decision to take a dump](../01-memory-layout/01d-taking-a-heap-dump-on-purpose.md) and the
  [classloader-leak mechanism](../01-memory-layout/04c-the-classloader-leak.md).
  ⚠️ Where that topic follows the man page on which failures trigger a heap dump, this one follows
  the JDK 25 source — see [03b](03b-which-failures-actually-trigger-them.md).
- **02 · GC in practice** *(not written yet)* owns reading a collector and its log, which is where
  step 5 of the checklist — the post-collection live set — is actually performed.
- **03 · Heap sizing in containers** *(not written yet)* owns the cgroup arithmetic behind "raising
  `-Xmx` is a regression for a native failure", and the OOMKill loop.
- **05 · Thread dumps** *(not written yet)* owns `Thread.print`, which pairs with the native-thread
  message and with `Thread` as a GC root.
- **06 · JFR, JMC and async-profiler** *(not written yet)* owns JFR generally; this topic uses only
  `jdk.OldObjectSample` and `jdk.FinalizerStatistics`.
- **12 · Graceful shutdown** *(not written yet)* owns the machinery that
  `-XX:+ExitOnOutOfMemoryError` deliberately bypasses.
- **13 · JVM flags that matter** *(not written yet)* owns the retired-flag inventory and
  `-XX:+PrintFlagsFinal`, which is how a reader confirms that the two undocumented OOM flags exist
  on their build.

{/* FOOTER */}
