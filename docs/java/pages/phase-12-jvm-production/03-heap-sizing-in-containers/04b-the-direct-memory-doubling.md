---
title: "MaxDirectMemorySize defaults to a second copy of -Xmx rather than a slice of it, the man page does not say so, and the consequence is that raising MaxRAMPercentage silently raises your worst-case native budget by the same amount"
sidebar_label: "04b · The direct-memory doubling"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **JDK 25 `java` tool reference** —
> `-XX:MaxDirectMemorySize`, `-XX:+DisableExplicitGC`
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html)), which
> is **silent on the default**; the JDK 25 source at tag `jdk-25+36` —
> [`jdk/internal/misc/VM.java`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/java.base/share/classes/jdk/internal/misc/VM.java),
> [`java/nio/Bits.java`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/java.base/share/classes/java/nio/Bits.java),
> [`sun/nio/ch/FileChannelImpl.java`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/java.base/share/classes/sun/nio/ch/FileChannelImpl.java),
> [`hotspot/share/runtime/globals.hpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/runtime/globals.hpp);
> and the **`java.lang.Runtime`** javadoc
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Runtime.html)).
> Arithmetic below is derived here and labelled; nothing was measured.
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**Almost every container-sizing model treats the heap ceiling as the one big number and the
native side as a fixed overhead. That model is wrong in a specific and expensive way: the
direct-memory ceiling is not a fixed overhead, it is a *copy* of the heap ceiling, and it moves
whenever the heap ceiling moves. Raising `MaxRAMPercentage` from 25 to 70 on a 4 GiB container
does not raise the worst case by 1.8 GiB; it raises it by 3.6 GiB. This is the single most
consequential sizing fact in the phase, and the man page does not contain it.**

## What the man page says, and what it does not

> *"`-XX:MaxDirectMemorySize=size` — Sets the maximum total size (in bytes) of the `java.nio`
> package, direct-buffer allocations. … **If not set, the flag is ignored and the JVM chooses
> the size for NIO direct-buffer allocations automatically.**"*

"Automatically" is doing an enormous amount of work in that sentence. The HotSpot flag itself is
no help either — `globals.hpp` declares it with a default of zero and the note *"Ignored if not
explicitly set"*. Neither source tells you what the automatic value is.

## Where the real default is written

`jdk/internal/misc/VM.java`, verbatim:

> *"The initial value of this field is arbitrary; during JRE initialization it will be reset to
> the value specified on the command line, if any, **otherwise to
> `Runtime.getRuntime().maxMemory()`**."*

`Runtime.getRuntime().maxMemory()` is documented as *"the maximum amount of memory that the Java
virtual machine will attempt to use"* — the heap ceiling. So:

```
MaxDirectMemorySize (default)  ==  -Xmx
```

**Not a share of `-Xmx`. Not carved out of it. A second, independent ceiling of the same size,
on memory that lives entirely outside the heap.** State this explicitly wherever you repeat it:
the `java` man page does not document it, and the authoritative source is the JDK's own
`VM.java`.

## The arithmetic, and why it matters more than it looks

**Derived here from the rule above, not measured.** A 4 GiB container:

| `MaxRAMPercentage` | Heap ceiling | Default direct ceiling | Worst-case sum | vs limit |
|---|---|---|---|---|
| 25 (default) | 1.0 GiB | 1.0 GiB | 2.0 GiB | 50% |
| 50 | 2.0 GiB | 2.0 GiB | 4.0 GiB | 100% |
| 70 | 2.8 GiB | 2.8 GiB | 5.6 GiB | **140%** |
| 75 | 3.0 GiB | 3.0 GiB | 6.0 GiB | **150%** |

At 70 percent, the two ceilings *the JVM is willing to honour* already exceed the container limit
by 40 percent, before metaspace, the code cache, thread stacks or GC structures are counted at
all. There is nothing in the JVM that will stop you reaching that state; the kernel will.

## Why it usually does not bite, and exactly when it does

`MaxDirectMemorySize` is a **ceiling, not a reservation**. An ordinary web service allocates tens
of megabytes of direct buffers and never approaches it, which is why this configuration survives
in production everywhere. The default is not "usually fine" so much as "usually untested".

It bites when something in the stack allocates direct memory in proportion to load or data:

- **Netty** — and therefore Spring WebFlux, gRPC, the Reactor Netty HTTP client, Cassandra and
  Elasticsearch clients. Netty allocates pooled direct buffers per arena and keeps its own
  accounting of the total; ⚠️ I could not confirm from a primary source how it derives its
  default ceiling, so treat "Netty inherits the JVM's default" as plausible but unverified and
  set both limits explicitly.
- **Kafka clients**, whose fetch and produce buffers are direct.
- **Off-heap caches** — Ehcache off-heap tiers, Chronicle Map, Caffeine with an off-heap layer.
- **Lucene / Elasticsearch**, which is mostly mapped rather than direct, and therefore worse —
  see below.
- **Any code calling `ByteBuffer.allocateDirect` in a request path** without pooling.

In all of those the failure is not gradual. Direct memory is charged to the cgroup as soon as it
is touched, and the JVM's own limit is never reached, so what you get is an OOMKill.

## The reclamation path, and the flag that breaks it

Direct buffers are freed by a `Cleaner` — a `PhantomReference` — which means **they are released
by garbage collection, not by scope exit**. `Bits.reserveMemory` knows this and escalates before
giving up: an optimistic CAS on the reserved total, then a wait on reference processing, then

```java
System.gc(); // trigger VM's Reference processing
```

then an exponential back-off, and only then

```java
throw new OutOfMemoryError("Cannot reserve " + size + " bytes of direct buffer memory (allocated: ..., limit: ...)");
```

Two consequences for a container. First, **`-XX:+DisableExplicitGC` disables the JDK's own
direct-buffer reclamation trigger**, turning a recoverable pause into an `OutOfMemoryError`; if
you need to neutralise a rogue `System.gc()`, use `-XX:+ExplicitGCInvokesConcurrent` instead.
Second, a roomy heap means infrequent collections, which means cleaners run late, which means
direct memory sits allocated for longer — **a larger heap can increase your direct-memory
footprint**. The full mechanism is
[07 · Direct and mapped buffers](../01-memory-layout/07-direct-and-mapped-buffers.md) and
[07b · Cleaners and deterministic release](../01-memory-layout/07b-cleaners-and-deterministic-release.md).

One more precision from `Bits`, verbatim: *"`-XX:MaxDirectMemorySize` limits the total **capacity**
rather than the actual memory usage, which will differ when buffers are page aligned."* The limit
counts what you asked for; the kernel charges what was mapped, rounded up to pages. Your cgroup
sees the larger number.

## Mapped buffers are bounded by nothing

`FileChannel.map` does **not** go through `Bits.reserveMemory` at all — `FileChannelImpl` contains
no call to it — and mapped memory is exposed through *separate* pools
(`getMappedBufferPool()`, named `"mapped"`, and `getSyncMappedBufferPool()`, named
`"mapped - 'non-volatile memory'"`) rather than through `Bits.BUFFER_POOL`, named `"direct"`.

**There is no JVM flag that bounds memory-mapped buffers.** Not `MaxDirectMemorySize`, not
`-Xmx`, not anything. Resident mapped pages are charged to the cgroup like any other page, and
they are reclaimable — the kernel can evict clean file-backed pages under pressure, which is why
mapped-heavy workloads sometimes survive where anonymous-heavy ones would not — but they still
count toward the working set, and dirty pages are not reclaimable until written back. The details
are [07c · Mapped buffers](../01-memory-layout/07c-mapped-buffers.md) and
[07d · mmap residency and arenas](../01-memory-layout/07d-mmap-residency-and-arenas.md).

## What to set

```bash
-XX:MaxRAMPercentage=70
-XX:MaxDirectMemorySize=256m     # measured, and now decoupled from the heap
```

Setting `MaxDirectMemorySize` explicitly in a container is close to unconditionally correct. It
costs nothing when unused, it breaks the coupling between the heap ceiling and the native ceiling,
and it converts an unattributable OOMKill into
`OutOfMemoryError: Cannot reserve N bytes of direct buffer memory`,
whose message includes the allocated total and the limit.

Monitor it with `BufferPoolMXBean`, surfaced by Micrometer as `jvm.buffer.memory.used`,
`jvm.buffer.count` and `jvm.buffer.total.capacity`, tagged by the pool names above —
**08 · Metrics with Micrometer** *(not written yet)*. The `"direct"` pool is bounded and
alertable; the `"mapped"` pool is not bounded and is the one to watch most closely.

## Gotchas

**★ The default is `-Xmx`, so tuning the heap tunes the native ceiling too.**
Every heap-size change is silently a direct-memory-ceiling change of equal size. Any sizing model
that treats the native side as a constant is wrong the moment somebody edits `MaxRAMPercentage`.

**★ `OutOfMemoryError: Direct buffer memory` is not the message.**
The real string from `Bits` is
`Cannot reserve N bytes of direct buffer memory (allocated: …, limit: …)`.
Alerting on the folklore string matches nothing. Note also that this message is
**not** one of the seven the Troubleshooting Guide enumerates —
[01b](../01-memory-layout/01b-oom-error-versus-oomkilled.md).

**★ `-XX:+HeapDumpOnOutOfMemoryError` does not fire for this.**
The man page limits it to *"`OutOfMemoryError` exceptions caused by Java Heap exhaustion"*. A
direct-buffer OOME produces no dump, and a heap dump would not show the native bytes anyway —
only the small `DirectByteBuffer` objects pointing at them.
[01c · The OOM flags](../01-memory-layout/01c-the-oom-flags-and-what-they-cover.md).

**★ Netty maintains its own direct-memory accounting, separate from the JVM's.**
Netty tracks and limits pooled direct memory itself and exposes system properties to control it,
so a container can hold two or three different opinions about the direct ceiling: the JVM's
default (equal to `-Xmx`), your explicit `MaxDirectMemorySize`, and Netty's own. ⚠️ The exact
Netty property names and their defaults are outside what this page verified — check the Netty
version you actually ship — but the structural point stands: make them agree deliberately rather
than by accident.

**★ A bigger heap can *increase* direct-memory usage.**
Fewer collections means cleaners run less often means buffers stay allocated longer. Raising the
heap to reduce GC pressure and then being OOMKilled on native memory is a recognised and
counterintuitive outcome.

**★ `-XX:+DisableExplicitGC` in a container is close to a bug.**
It disables the escalation path in `Bits.reserveMemory`, so direct allocations that would have
succeeded after a collection now throw. `-XX:+ExplicitGCInvokesConcurrent` gets the intended
effect — no long stop-the-world from a library's `System.gc()` — without disabling reclamation.

**★ The direct limit counts capacity, the kernel counts pages.**
Page-aligned allocations mean the process's charged memory exceeds the JVM's accounted total.
Budget for the kernel's number, which is the larger one.

**★ Mapped files can push a container over its limit with no JVM flag in sight.**
A service that memory-maps a large index has resident pages charged to its cgroup that no JVM
setting bounds and no JVM metric labels as "heap". Watch the `"mapped"` buffer pool and
`/proc/<pid>/smaps`, and prefer a `MemorySegment` in an `Arena` where the lifetime can be made
explicit.

**★ `sun.misc.Unsafe.invokeCleaner` is deprecated for removal since JDK 23.**
The escape hatch for freeing a direct buffer deterministically is going away; its own javadoc
points at *"a `MemorySegment` allocated in an `Arena` with the appropriate temporal bounds"*
instead. Do not build a container-sizing strategy on `invokeCleaner`.

## Interview questions

**★ What is the default value of `-XX:MaxDirectMemorySize`?**
`-Xmx` — the same value as the maximum heap size. The man page does not say so; it says only that
"the JVM chooses the size automatically". The authoritative source is `jdk/internal/misc/VM.java`,
which states that the field is reset during JRE initialization to the command-line value if one
was given and *otherwise to `Runtime.getRuntime().maxMemory()`*. The important word is
"otherwise": it is a second ceiling equal to the heap ceiling, not a portion of it, so the JVM's
own worst case is twice the heap size before any other region is counted.

**★ Why does that matter specifically in a container?**
Because container sizing is a subtraction against a hard limit, and this term moves with the
number you are tuning. If you raise `MaxRAMPercentage` from 25 to 70 on a 4 GiB container, the
heap ceiling goes from 1 GiB to 2.8 GiB and the direct ceiling goes with it, so the two together
are now 5.6 GiB against a 4 GiB limit. On a service that actually uses direct memory — anything on
Netty, so WebFlux, gRPC, most modern clients — you have created a configuration the JVM will
happily drive into an OOMKill. The remedy is one flag: set `MaxDirectMemorySize` explicitly and
break the coupling.

**★ Does `-XX:MaxDirectMemorySize` bound memory-mapped files?**
No, and nothing else does either. `FileChannelImpl` does not call `Bits.reserveMemory`, and mapped
buffers are reported through separate `BufferPoolMXBean` pools named `"mapped"` and
`"mapped - 'non-volatile memory'"` rather than through the `"direct"` pool that the limit governs.
So a service that maps large files has an unbounded, uncapped region of its footprint that the JVM
will never complain about. The mitigations are structural — map less, map in windows, or use
`FileChannel.map(mode, offset, size, Arena)` so the unmapping is deterministic rather than waiting
on garbage collection.

**★ A service throws `Cannot reserve … bytes of direct buffer memory` even though `MaxDirectMemorySize`
is generous. What could be happening?**
Most likely the cleaners are not running. Direct buffers are freed via a `PhantomReference`-based
`Cleaner` on the reference handler thread, so release depends on garbage collection reaching them.
If the heap is large and collections are rare, dead buffers accumulate. `Bits.reserveMemory` tries
to compensate by calling `System.gc()` before it throws — unless `-XX:+DisableExplicitGC` is set,
which removes that safety net entirely. So I would check for `DisableExplicitGC` first, then look
at whether a `DirectByteBuffer` is being retained by something reachable, which is a heap question
after all: the small on-heap objects are visible in a heap dump even though the native bytes are
not.

**★ Would you always set `MaxDirectMemorySize` in a container?**
Yes, with the caveat that the value has to come from measurement. It costs nothing when the
service does not use direct memory, it decouples the native ceiling from heap tuning so that
future heap changes do not silently move it, and when it is exceeded you get a Java-level error
naming the region and reporting the allocated total and the limit, instead of a `SIGKILL` with no
evidence. The measurement comes from `BufferPoolMXBean` for the `"direct"` pool under peak load,
with a margin.

{/* FOOTER */}
