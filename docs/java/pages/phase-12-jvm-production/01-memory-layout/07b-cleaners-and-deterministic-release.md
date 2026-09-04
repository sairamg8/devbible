---
title: "There is no free() for a direct ByteBuffer because its native memory is released by a phantom reference the garbage collector has to notice first, and the only supported way to get deterministic release is to stop using allocateDirect"
sidebar_label: "07b · Cleaners, deterministic release"
sidebar_position: 26
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the **JDK 25 `java.nio.ByteBuffer`** javadoc (class description and
> `allocateDirect(int)`)
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/nio/ByteBuffer.html));
> and the OpenJDK `jdk-25+36` sources
> `src/java.base/share/classes/jdk/internal/ref/Cleaner.java` (class javadoc),
> `src/java.base/share/classes/java/nio/Direct-X-Buffer.java.template` (the `Cleaner.create` call
> and the attachment field `att`), and
> `src/jdk.unsupported/share/classes/sun/misc/Unsafe.java` (`invokeCleaner`, its
> `@Deprecated(since="23", forRemoval=true)` annotation and its replacement text).
> JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9.

**[07](07-direct-and-mapped-buffers.md) established that direct memory has a budget and that the
JVM calls `System.gc()` to defend it. This chunk is about *why* it has to: the release path for a
direct buffer runs through a phantom reference, a reference-handler thread and a garbage
collection, none of which you control. The consequence is that "I am finished with this buffer"
and "the memory is back" are separated by an unbounded interval — and that the supported fix is
not a smarter cleanup call, it is a different allocation API.**

## The `Cleaner`, and why there is no `free()`

A direct buffer registers its deallocator at construction:

```java
cleaner = Cleaner.create(this, new Deallocator(base, size, cap));
```

That is `jdk.internal.ref.Cleaner`, whose own javadoc explains the machinery:

> *"General-purpose phantom-reference-based cleaners. … They are lightweight because they are not
> created by the VM and thus do not require a JNI upcall to be created, and because their cleanup
> code is invoked directly by the reference-handler thread rather than by the finalizer thread.
> … A cleaner tracks a referent object and encapsulates a thunk of arbitrary cleanup code. **Some
> time after the GC detects that a cleaner's referent has become phantom-reachable, the
> reference-handler thread will run the cleaner.**"*

"Some time after the GC detects" is the load-bearing phrase. There are three separate delays
between "I am done with this buffer" and "the native memory is back": the collector has to run,
the reference has to be enqueued, and the reference handler thread has to get to it. None of them
are under your control, and all three are why a burst of short-lived direct buffers can exhaust
the limit while almost all of them are logically dead.

There is deliberately no public `free()`. The one back door is deprecated:

```java
@Deprecated(since="23", forRemoval=true)
public void invokeCleaner(java.nio.ByteBuffer directBuffer) { ... }
```

with the javadoc's own replacement instructions:

> *"@deprecated Use a `MemorySegment` allocated in an `Arena` with the appropriate temporal
> bounds. The `MemorySegment.asByteBuffer()` method wraps a memory segment as a `ByteBuffer` to
> allow interop with existing code."*

## The supported way to free native memory deterministically

If you need "allocate, use, release now" semantics, stop using `allocateDirect` and use the
Foreign Function & Memory API. An `Arena` gives the allocation an explicit lifetime, and
`asByteBuffer()` keeps every existing `ByteBuffer`-shaped API working:

```java
// Deterministic: the memory is released at the end of the try block, on this thread,
// with no dependence on the garbage collector.
try (Arena arena = Arena.ofConfined()) {
    MemorySegment segment = arena.allocate(8 * 1024 * 1024);
    ByteBuffer buf = segment.asByteBuffer();

    channel.read(buf);
    buf.flip();
    process(buf);
}   // arena.close() frees the 8 MB here
```

Compare with the version everyone writes, whose 8 MB is released at an unspecified later time:

```java
ByteBuffer buf = ByteBuffer.allocateDirect(8 * 1024 * 1024);
channel.read(buf);
buf.flip();
process(buf);
// buf is unreachable after this method returns; the 8 MB comes back
// after a GC, after the reference is enqueued, after the reference
// handler runs the Cleaner. Possibly much later.
```

`Arena.ofConfined()` is confined to the creating thread and closes deterministically; using a
segment after its arena is closed throws rather than corrupting memory, which is the safety
property `Unsafe.invokeCleaner` never had.

The third option, and often the best one, is to **not allocate per operation at all**: keep a
small pool of long-lived direct buffers and reuse them, which is precisely what the `ByteBuffer`
javadoc's *"large, long-lived buffers"* advice describes and what Netty's pooled allocator
implements.

## Gotchas

**★ Slices and duplicates do not allocate, and do not free either.**
`buf.slice()` and `buf.duplicate()` share the same native memory and keep the original buffer
reachable through an attachment. Holding a two-byte slice of a 64 MB direct buffer retains all
64 MB. This is the direct-memory analogue of the old `String.substring` retention bug, and it is
completely invisible in a heap histogram, which will show a small object.

**★ `sun.misc.Unsafe.invokeCleaner` is deprecated for removal since JDK 23.**
It still works on JDK 25, and it will not work forever. Its own javadoc names the replacement: a
`MemorySegment` allocated in an `Arena` with appropriate temporal bounds, wrapped with
`MemorySegment.asByteBuffer()` for interop.

**★ Per-request `allocateDirect` is an antipattern the javadoc explicitly warns against.**
*"It is therefore recommended that direct buffers be allocated primarily for large, long-lived
buffers … In general it is best to allocate direct buffers only when they yield a measurable gain
in program performance."* A short-lived direct buffer pays the higher allocation cost, pays the
higher deallocation cost, and holds native memory hostage until a GC notices.

**★ A `Cleaner` is not a finalizer and is not a destructor.**
Its javadoc calls it *"a lightweight and more robust alternative to finalization"* and says the
thunk runs *"some time after the GC detects that a cleaner's referent has become
phantom-reachable"*. There is no ordering guarantee, no timing guarantee, and no guarantee it runs
at all before the process exits. Never put anything with a correctness requirement in one.

**★ Cleanup runs on the reference-handler thread, so a slow cleaner delays every other cleaner.**
The javadoc is explicit: *"Nontrivial cleaners are inadvisable since they risk blocking the
reference-handler thread and delaying further cleanup and finalization."* If you write your own
`Cleaner`-based resource, keep the thunk to a `free`.

**★ Using a segment after its `Arena` is closed throws; using a buffer after `invokeCleaner` is
undefined.** This is the strongest practical argument for the FFM replacement. The arena tracks
temporal bounds and enforces them; `Unsafe.invokeCleaner` freed the memory and left every existing
reference to it dangling, so a use-after-free crashed the JVM instead of throwing.

**★ `Arena.ofConfined()` is confined to one thread, and that is usually what you want.**
Handing a segment from a confined arena to another thread and accessing it there throws. If a
buffer genuinely has to be shared across threads, `Arena.ofShared()` exists, at the cost of a more
expensive close. Reaching for a shared arena by default gives up the cheapest property of the API.

## Interview questions

**★ How do you free a direct buffer immediately?**
With `allocateDirect`, you cannot — there is no public API, and `sun.misc.Unsafe.invokeCleaner` has
been deprecated for removal since JDK 23. The supported answer is to stop using `allocateDirect`
for that allocation and use the FFM API instead: allocate a `MemorySegment` in an `Arena`, call
`segment.asByteBuffer()` if you need a `ByteBuffer`-shaped view for an existing API, and let
`arena.close()` — typically via try-with-resources — release the memory deterministically on your
own thread. That is the exact replacement `Unsafe.invokeCleaner`'s deprecation text recommends.

**★ When should you use a direct buffer at all?**
When the `ByteBuffer` javadoc's own three conditions hold: the buffer is large, it is long-lived,
and it is used for native I/O — plus its fourth condition, that you measured a gain. The benefit is
avoiding a copy into a temporary native buffer on every I/O call, which the JVM would otherwise
have to make because the collector can relocate a heap array mid-syscall. For a small, short-lived
buffer the higher allocation and deallocation costs dominate and a heap buffer is strictly better.

**★ Why is holding a `slice()` of a direct buffer dangerous?**
Because a slice does not copy: it shares the same native memory and keeps the parent buffer
reachable through an attachment, so the entire original allocation stays alive for as long as the
slice does. Caching a 16-byte header sliced out of a 64 MB read buffer retains all 64 MB of native
memory, and a heap histogram will show only a small `DirectByteBuffer` object, so the retention is
invisible in the tool people reach for first.

**★ How does a direct buffer's memory actually get freed, mechanically?**
At construction the buffer registers a `Deallocator` with a `jdk.internal.ref.Cleaner`, which is a
`PhantomReference` subclass. When the collector determines the `DirectByteBuffer` object is
phantom-reachable, the reference is discovered during reference processing, and the JVM's
reference-handler thread runs the cleaner's thunk, which calls `freeMemory` and then
`Bits.unreserveMemory` to give the capacity back to the accounting total. Three separate events
have to happen in order — a collection, reference discovery, and the handler thread getting
scheduled — which is why the javadoc only promises the cleanup happens *"some time after"* the GC
notices.

**★ Why did the JDK move from finalizers to `Cleaner`s for this?**
The `jdk.internal.ref.Cleaner` javadoc gives both reasons: cleaners are lighter, because they are
not created by the VM and need no JNI upcall, and their code runs directly on the reference-handler
thread rather than on the finalizer thread; and they are more robust, because they use phantom
references, *"the weakest type of reference object, thereby avoiding the nasty ordering problems
inherent to finalization"*. A finalizable object is resurrectable and its `finalize` can run
arbitrary code including code that makes the object reachable again; a phantom reference cannot
give you the referent back at all.

**★ Your team wants to pool direct buffers instead of allocating them. What are you actually
buying?** You are buying determinism. A pooled buffer's native memory is never released, so it
never depends on a collection, never triggers the `System.gc()` escalation in `Bits.reserveMemory`,
and never contributes to a direct-memory `OutOfMemoryError`. You are trading it for a fixed
resident footprint and for the bookkeeping burden of returning buffers correctly — a leaked
checkout is now a leak your pool must detect rather than one the GC eventually cleans up. This is
the trade Netty's pooled allocator makes, and it is what the `ByteBuffer` javadoc's *"large,
long-lived buffers"* advice describes.

{/* FOOTER */}
