---
title: "A direct ByteBuffer is a tiny heap object holding a pointer to native memory that only a phantom reference will ever free, which is why -XX:MaxDirectMemorySize defaults to your heap size and why the JVM calls System.gc() behind your back to honour it"
sidebar_label: "07 · Direct buffers"
sidebar_position: 36
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the **JDK 25 `java.nio.ByteBuffer`** javadoc (class description,
> `allocateDirect(int)`)
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/nio/ByteBuffer.html));
> the **JDK 25 `java` tool reference** entry for `-XX:MaxDirectMemorySize`
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html)); and the
> OpenJDK `jdk-25+36` sources `src/java.base/share/classes/jdk/internal/misc/VM.java`,
> `src/java.base/share/classes/java/nio/Bits.java` (`reserveMemory`, `tryReserveMemory`),
> `src/java.base/share/classes/java/nio/Direct-X-Buffer.java.template`,
> `src/java.base/share/classes/jdk/internal/ref/Cleaner.java`,
> `src/jdk.unsupported/share/classes/sun/misc/Unsafe.java` (`invokeCleaner`),
> `src/hotspot/share/runtime/globals.hpp` (`MaxDirectMemorySize`) and
> `src/hotspot/share/gc/shared/gc_globals.hpp` (`DisableExplicitGC`,
> `ExplicitGCInvokesConcurrent`).
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**`ByteBuffer.allocateDirect(n)` allocates `n` bytes outside the Java heap and returns a small
heap object that owns them. Nothing in the language frees those bytes: they are released by a
phantom-reference-based `Cleaner` that only runs after the garbage collector has noticed the
buffer object is unreachable. That single indirection produces every symptom on this page —
a memory region `-Xmx` does not bound but whose default limit is derived from `-Xmx`, an
allocation path that calls `System.gc()` on your behalf, and an `OutOfMemoryError` that fires
while the heap is nearly empty.**

## What "direct" buys and what it costs

The `ByteBuffer` class documentation states the deal:

> *"Given a direct byte buffer, the Java virtual machine will make a best effort to perform
> native I/O operations directly upon it. That is, it will attempt to avoid copying the buffer's
> content to (or from) an intermediate buffer before (or after) each invocation of one of the
> underlying operating system's native I/O operations."*

The reason an intermediate copy would otherwise be needed is that a heap array can be moved by
the garbage collector at any moment, and a `read(2)` cannot have its destination relocated
mid-syscall. A heap `ByteBuffer` therefore gets copied into a temporary native buffer for every
I/O operation. A direct buffer *is* the native buffer, so the copy disappears.

And the cost, in the same paragraph:

> *"The buffers returned by this method typically have somewhat higher allocation and
> deallocation costs than non-direct buffers. The contents of direct buffers may reside outside
> of the normal garbage-collected heap, and so their impact upon the memory footprint of an
> application might not be obvious. **It is therefore recommended that direct buffers be
> allocated primarily for large, long-lived buffers that are subject to the underlying system's
> native I/O operations. In general it is best to allocate direct buffers only when they yield a
> measurable gain in program performance.**"*

That recommendation — *large, long-lived, and only when measured* — is the whole design guidance,
written by the API's authors, and it is exactly the opposite of what a per-request
`allocateDirect` in a request handler does.

## The default limit is your heap size, and nothing in the docs says so

The `java` man page for the flag is deliberately vague:

> *"`-XX:MaxDirectMemorySize=size` — Sets the maximum total size (in bytes) of the `java.nio`
> package, direct-buffer allocations. … **If not set, the flag is ignored and the JVM chooses the
> size for NIO direct-buffer allocations automatically.**"*

HotSpot's own declaration says the same thing in fewer words:

```cpp
product(uint64_t, MaxDirectMemorySize, 0,
        "Maximum total size of NIO direct-buffer allocations. "
        "Ignored if not explicitly set.")
```

Neither tells you what "automatically" means. The library does. From
`jdk.internal.misc.VM`:

```java
// A user-settable upper limit on the maximum amount of allocatable direct
// buffer memory.  This value may be changed during VM initialization if
// "java" is launched with "-XX:MaxDirectMemorySize=<size>".
//
// The initial value of this field is arbitrary; during JRE initialization
// it will be reset to the value specified on the command line, if any,
// otherwise to Runtime.getRuntime().maxMemory().
//
private static long directMemory = 64 * 1024 * 1024;
```

🔴 **The default is `Runtime.getRuntime().maxMemory()` — effectively `-Xmx`.** Three consequences
follow immediately and none of them are obvious:

- **The direct-memory budget is a second copy of your heap size, not a share of it.** A JVM with
  `-Xmx2g` and no `MaxDirectMemorySize` will let the process reach roughly 2 GB of heap *plus*
  roughly 2 GB of direct buffers before the JVM itself objects — about 4 GB of anonymous memory
  before you count stacks, metaspace and the code cache. In a container with a 3 GB limit, the
  kernel objects first.
- **Raising `-Xmx` silently raises the direct-memory ceiling too.** Tuning the heap up to reduce
  GC pressure also removes a guard rail you did not know you had.
- **`-XX:MaxRAMPercentage` has the same effect**, because it sets the same `maxMemory()` the
  default derives from. Container heap sizing therefore moves the direct limit as well.

The practical rule: **on any containerised service that uses direct buffers, set
`-XX:MaxDirectMemorySize` explicitly.** A number you chose is a bound; a number derived from
another number you tuned for a different reason is a coincidence.

## What happens inside `allocateDirect`, step by step

`Bits.reserveMemory` is the accounting gate every `allocateDirect` passes through, and it is more
interesting than it sounds:

```java
static void reserveMemory(long size, long cap) {
    ...
    // optimist!
    if (tryReserveMemory(size, cap)) {
        return;
    }
    final JavaLangRefAccess jlra = SharedSecrets.getJavaLangRefAccess();
    ...
        // Retry allocation until success or there are no more
        // references (including Cleaners that might free direct
        // buffer memory) to process and allocation still fails.
        do {
            ...
            refprocActive = jlra.waitForReferenceProcessing();
            if (tryReserveMemory(size, cap)) {
                return;
            }
        } while (refprocActive);

        // trigger VM's Reference processing
        System.gc();

        // A retry loop with exponential back-off delays.
        ...
        // no luck
        throw new OutOfMemoryError
            ("Cannot reserve "
             + size + " bytes of direct buffer memory (allocated: "
             + RESERVED_MEMORY.get() + ", limit: " + MAX_MEMORY +")");
}
```

Read that as a four-stage escalation:

1. **Optimistic reservation.** A compare-and-set against the running total. This is the fast path
   and costs almost nothing.
2. **Wait for pending reference processing.** If the budget is full, wait for the reference
   handler to work through any `Cleaner`s that are already queued — some of them may free direct
   buffers.
3. 🔴 **`System.gc()`.** If that was not enough, the JDK explicitly requests a full collection,
   because the *only* way a direct buffer's native memory gets freed is for the collector to first
   determine that the `ByteBuffer` object is unreachable. This is the single most consequential
   line on the page: **direct buffer reclamation depends on garbage collection of a tiny object.**
4. **Exponential back-off, then `OutOfMemoryError`** with the reserved total and the limit in the
   message — one of the few JVM error messages that hands you both numbers you need.

The Java-level `System.gc()` call is why direct-memory pressure produces full GCs on a heap that
is nowhere near full, and why a GC log full of `System.gc()`-triggered collections is a *direct
buffer* diagnosis, not a "someone called `System.gc()` in application code" diagnosis.

## `-XX:+DisableExplicitGC` breaks the escalation

```cpp
product(bool, DisableExplicitGC, false,
        "Ignore calls to System.gc()")
```

🔴 The flag does exactly what it says: it makes `System.gc()` a no-op. Stage 3 of the escalation
above is a `System.gc()` call, so with `-XX:+DisableExplicitGC` set, the direct-buffer allocation
path loses its ability to force reclamation. The back-off loop still runs and can still succeed if
a collection happens for other reasons, but you have removed the mechanism the JDK relies on, and
the failure mode is `OutOfMemoryError: Cannot reserve … bytes of direct buffer memory` on a JVM
with plenty of free heap and plenty of free RAM.

`-XX:+DisableExplicitGC` is widely pasted into "tuning" flag sets to stop a badly behaved library
from triggering full GCs. If you must suppress explicit collections, the safer flag is:

```cpp
product(bool, ExplicitGCInvokesConcurrent, false,
        "A System.gc() request invokes a concurrent collection; "
        "(effective only when using concurrent collectors)")
```

`-XX:+ExplicitGCInvokesConcurrent` keeps `System.gc()` *working* — so reference processing still
happens and direct buffers still get freed — while turning the resulting collection into a
concurrent one instead of a stop-the-world full GC. That is the flag people usually meant.

## Where the rest of this material lives

The reclamation machinery — the `Cleaner`, why there is no `free()`, and the supported way to
release native memory on demand — is [07b · Cleaners and deterministic release](07b-cleaners-and-deterministic-release.md).
Memory-mapped buffers, which are a different animal with different accounting, are
[07c · Mapped buffers](07c-mapped-buffers.md).

## Gotchas

**★ `-XX:MaxDirectMemorySize` defaults to `Runtime.getRuntime().maxMemory()`, i.e. to `-Xmx`.**
It is not documented on the man page, which only says the JVM chooses *"automatically"*; the
derivation is in `jdk.internal.misc.VM`. The effect is that the direct-memory budget is a second
copy of the heap size rather than a share of it, so an unbounded-looking process can reach roughly
`2 × -Xmx` of anonymous memory before the JVM complains.

**★ Raising `-Xmx` or `-XX:MaxRAMPercentage` silently raises the direct-memory ceiling.**
Both change `maxMemory()`, which the default derives from. A heap increase intended to reduce GC
pressure therefore also removes a limit that was quietly protecting the container. Set
`-XX:MaxDirectMemorySize` explicitly on anything containerised.

**★ `-XX:+DisableExplicitGC` disables the JDK's own direct-buffer reclamation trigger.**
`Bits.reserveMemory` calls `System.gc()` when the budget is exhausted; the flag makes that a
no-op. The result is `OutOfMemoryError: Cannot reserve … bytes of direct buffer memory` on a JVM
with a nearly empty heap. If you need to tame explicit collections, use
`-XX:+ExplicitGCInvokesConcurrent`, which keeps the call working and makes the collection
concurrent.

**★ A GC log full of `System.gc()`-triggered collections may be direct-buffer pressure, not
application code.** The call is made by the JDK's own NIO allocation path. Grepping the codebase
for `System.gc()` and finding nothing does not exonerate direct buffers — it points at them.

**★ `OutOfMemoryError: Direct buffer memory` is not a heap problem and a heap dump barely helps.**
The heap objects involved are a few dozen bytes each; the megabytes are native. What the heap dump
*can* tell you is how many live `DirectByteBuffer` instances exist and what is retaining them,
which is usually the actual answer — a cache, a pool, or a collection of un-flushed writers.

**★ The limit counts *capacity*, not resident memory.**
`Bits.tryReserveMemory` says so in a comment: *"-XX:MaxDirectMemorySize limits the total capacity
rather than the actual memory usage, which will differ when buffers are page aligned."* So the
accounting number and the RSS number legitimately disagree, and page-aligned allocation
(`-Dsun.nio.PageAlignDirectMemory=true`) widens the gap.

**★ Direct buffer exhaustion can happen while the heap is almost empty, and that is the normal
case.** The `ByteBuffer` object is tiny, so a heap full of them creates almost no heap pressure
and therefore triggers almost no collections. The less heap pressure your application has, the
worse its direct-buffer reclamation gets — a genuinely counter-intuitive coupling.

**★ Netty, Kafka clients, gRPC and most NIO frameworks allocate direct memory you did not ask
for.** "We do not use direct buffers" is almost never true of a Spring Boot service. Netty in
particular has its own allocator and its own `io.netty.maxDirectMemory` accounting, which may or
may not be charged against the JDK's limit depending on how it is configured.

## Interview questions

**★ What does `-XX:MaxDirectMemorySize` default to?**
To `Runtime.getRuntime().maxMemory()` — in practice, to `-Xmx`. The `java` man page only says the
JVM *"chooses the size … automatically"*; the actual derivation is a comment and an assignment in
`jdk.internal.misc.VM`. The consequence worth stating in an interview is that the direct budget is
a *second* copy of the heap size rather than a slice of it, so a JVM can legitimately reach around
twice `-Xmx` in anonymous memory before the JVM itself raises an error — which is how a container
gets OOMKilled with a healthy-looking heap.

**★ Why does the JVM call `System.gc()` when you allocate a direct buffer?**
Because the native memory behind a direct buffer is freed by a phantom-reference `Cleaner`, and a
`Cleaner` only runs after the collector has determined that the `ByteBuffer` object is
unreachable. So when `Bits.reserveMemory` cannot fit a new allocation inside
`MaxDirectMemorySize`, its escalation is: retry optimistically, wait for pending reference
processing, then explicitly call `System.gc()` to force the collector to notice the garbage
buffers, then back off and retry, and only then throw. The whole reclamation path is coupled to
garbage collection of an object that is a few dozen bytes in size.

**★ What breaks if you set `-XX:+DisableExplicitGC`?**
Direct buffer reclamation, among other things. That flag makes `System.gc()` a no-op, and
`System.gc()` is exactly what the NIO allocation path calls when it runs out of direct-memory
budget. You get `OutOfMemoryError: Cannot reserve … bytes of direct buffer memory` on a JVM with
free heap and free RAM. If the goal was to stop a library from triggering long stop-the-world
pauses, the right flag is `-XX:+ExplicitGCInvokesConcurrent`, which keeps the call effective and
makes the resulting collection concurrent.

**★ Your service throws `OutOfMemoryError: Direct buffer memory` but the heap is at 30%. Explain
the mechanism.**
The two facts are causally linked, not coincidental. A `DirectByteBuffer` is a tiny heap object
holding a pointer to a large native allocation, so a large amount of dead *native* memory creates
almost no *heap* pressure — and therefore triggers almost no garbage collections, and therefore the
`Cleaner`s never run and the native memory is never released. A low heap utilisation makes direct
buffer reclamation worse, not better. The fixes are to bound the buffers (pool and reuse them), to
allocate them with an `Arena` so they are freed deterministically, or to check whether
`-XX:+DisableExplicitGC` has removed the JDK's own escalation.

**★ You are told "we don't use direct buffers". How do you check?**
You do not take that at face value, because the frameworks do. Netty's default allocator, most
Kafka and gRPC clients, and the JDK's own socket and file channel implementations all use direct
memory. The direct way to check is the `BufferPoolMXBean` for the `"direct"` pool, which reports
the count, total capacity and memory used — Micrometer exposes it as `jvm.buffer.*` — and it will
show a non-zero figure on essentially every network-facing JVM.

{/* FOOTER */}
