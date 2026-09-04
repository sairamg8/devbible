---
title: "Mapping a file costs address space immediately and physical memory lazily, force() promises nothing off a local device, and since JDK 22 an Arena finally gives a mapping a lifetime you control instead of one the collector decides"
sidebar_label: "07d · Residency, force, arenas"
sidebar_position: 28
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the **JDK 25 `MappedByteBuffer`** javadoc (`isLoaded()`, `load()`,
> `force()`, class description)
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/nio/MappedByteBuffer.html));
> the **JDK 25 `FileChannel.map(MapMode,long,long,Arena)`** javadoc, added in Java 22
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/nio/channels/FileChannel.html));
> and the **JDK 25 `java.lang.foreign.Arena`** javadoc
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/foreign/Arena.html)).
> JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9.

**[07c](07c-mapped-buffers.md) covered what a mapping is and how it is accounted. This chunk
covers the two questions that decide whether mapping is the right tool: how much of a mapping is
actually in RAM at any moment, and when the mapping goes away. The first is a page-cache question
the JVM can only hint at; the second had no good answer until JDK 22 added an `Arena` overload,
and it is the single change that makes memory-mapped files safe to use in a long-running
service.**

## How pages become resident, and what shows up in RSS

A mapping costs address space immediately and physical memory lazily: pages are faulted in on
first touch, from the OS page cache. Two API methods let you interrogate and drive that, both
carefully hedged:

> *`isLoaded()` — "Tells whether or not this buffer's content is resident in physical memory. …
> **The returned value is a hint, rather than a guarantee**, because the underlying operating
> system may have paged out some of the buffer's data by the time that an invocation of this
> method returns."*

> *`load()` — "Loads this buffer's content into physical memory. This method makes a best effort
> to ensure that, when it returns, this buffer's content is resident in physical memory. Invoking
> this method may cause some number of page faults and I/O operations to occur."*

The memory-model consequence is the one people miss: **mapped file pages are file-backed, not
anonymous.** Under pressure the kernel can evict a clean file-backed page without any swap
involved, because the data is already on disk. That is genuinely different from heap or direct
memory, which is anonymous and must be swapped or must stay resident. It does *not* mean mapped
pages are free — they are counted in the process's RSS while resident, and inside a container's
memory cgroup the page cache for those pages is charged to the cgroup, so a large mapping can
still push a pod towards its limit. The difference is that this memory is reclaimable, so the
pressure usually shows up as I/O and latency rather than as an immediate kill.

`force()` is the durability side of the same story:

> *"Forces any changes made to this buffer's content to be written to the storage device containing
> the mapped file. … If the file mapped into this buffer resides on a local storage device then
> when this method returns it is guaranteed that all changes made to the buffer since it was
> created, or since this method was last invoked, will have been written to that device. **If the
> file does not reside on a local device then no such guarantee is made.** … If this buffer was
> not mapped in read/write mode … invoking this method may have no effect."*

## The modern replacement: `map` into an `Arena`

Since JDK 22 `FileChannel` has an FFM overload that fixes both the lifetime problem and the 2 GB
problem:

```java
public MemorySegment map(FileChannel.MapMode mode, long offset, long size, Arena arena)
        throws IOException
```

> *"The lifetime of the returned segment is controlled by the provided arena. For instance, if the
> provided arena is a closeable arena, the returned segment will be unmapped when the provided
> closeable arena is closed."*

```java
try (Arena arena = Arena.ofConfined();
     FileChannel channel = FileChannel.open(path, StandardOpenOption.READ)) {

    MemorySegment segment = channel.map(FileChannel.MapMode.READ_ONLY, 0, Files.size(path), arena);
    // segment.byteSize() is a long: no 2 GB limit
    return lookup(segment, key);
}   // the mapping is unmapped here, deterministically
```

Three things change: the mapping is unmapped at a point *you* choose rather than at a garbage
collection; the size is a `long`, so a 40 GB file is one segment; and access after close throws
rather than being undefined. The same javadoc keeps the warnings, because the OS has not changed:

> *"The content of a mapped memory segment can change at any time, for example if the content of
> the corresponding region of the mapped file is changed by this (or another) program. … All or
> part of a mapped memory segment may become inaccessible at any time, for example if the backing
> mapped file is truncated."*

If you need `ByteBuffer`-shaped interop for an existing API, `segment.asByteBuffer()` gives it to
you — with the same `int`-capacity restriction on that view.

## Gotchas

**★ `isLoaded()` is a hint, not an answer.**
Its own javadoc: *"The returned value is a hint, rather than a guarantee"*, and `false` *"does not
necessarily imply that the buffer's content is not resident"*. Do not build a caching policy on
it, and do not assert on it in a test.

**★ `force()` guarantees nothing on a network filesystem.**
*"If the file does not reside on a local device then no such guarantee is made."* It also *"may
have no effect"* for read-only and private mappings. Durability over NFS or a cloud filesystem
needs a different design, not a `force()` call.

**★ Mapped memory is charged to the container's memory cgroup while resident.**
It is file-backed and therefore reclaimable, which makes it *softer* than heap or direct memory —
the kernel can drop clean pages without swapping — but it is not free. A large mapping inside a
tight pod limit shows up as page-cache pressure, extra I/O and latency, and can still contribute
to a kill.

**★ `load()` is not free and is not a promise either.**
Its javadoc says it *"makes a best effort"* and that *"Invoking this method may cause some number
of page faults and I/O operations to occur."* Calling it on a large mapping at startup turns a lazy
cost into an eager one — sometimes exactly what you want for latency, sometimes a several-minute
startup and a resident set you did not budget for.

**★ A segment from a closed `Arena` throws; a buffer whose cleaner has run is undefined.**
This is the safety argument for the FFM overload. The arena tracks temporal bounds and enforces
them at access time, so a use-after-close is an exception. The old `Unsafe.invokeCleaner` route
freed the memory and left every existing reference to it dangling.

**★ `Arena.ofConfined()` binds the segment to one thread.**
Accessing a confined arena's segment from another thread throws. If the mapping genuinely has to
be shared, `Arena.ofShared()` exists, at the cost of a more expensive close — but reaching for it
by default gives away the cheapest property of the API.

**★ `segment.asByteBuffer()` reintroduces the `int` capacity limit.**
The `MemorySegment` itself can be larger than 2 GB, but the moment you take a `ByteBuffer` view of
it for interop with an existing API, you are back inside `ByteBuffer`'s `int`-sized world. Plan the
interop boundary accordingly.

**★ An `Arena` that outlives the code that maps is no better than a `Cleaner`.**
`Arena.global()` never closes and `Arena.ofAuto()` is managed by the garbage collector — using
either one reproduces exactly the non-determinism you switched away from. The determinism comes
from a *closeable* arena actually being closed, usually by try-with-resources.

## Interview questions

**★ How is mapped memory different from direct memory in terms of RSS and container limits?**
Direct memory is anonymous: it must be resident or swapped, and it counts fully and permanently
against the container. Mapped file memory is file-backed: pages fault in on access from the page
cache and clean pages can be dropped by the kernel under pressure without any swap, because the
data is already on disk. So mapped memory is reclaimable in a way direct memory is not — but it is
still charged to the memory cgroup while resident, so a large mapping in a tight pod shows up as
page-cache pressure, extra I/O and latency, and it can still contribute to an OOMKill. "It is only
page cache" is a half-truth people use to dismiss real memory.

**★ What does `force()` actually promise?**
Less than its name suggests. It promises that, for a file on a *local* storage device, all changes
made since the buffer was created or since the last `force()` will have been written to that device
by the time it returns. For a file that does not reside on a local device *"no such guarantee is
made"*, and for read-only or private mappings it *"may have no effect"*. Durability over a network
filesystem is not something a `force()` call buys you.

**★ When would you choose `mmap` over ordinary channel reads?**
For large files with random access patterns that you read repeatedly — an index, a memory-mapped
database file, a large read-mostly dataset — where letting the OS page cache do the caching beats
managing your own buffers. The javadoc's own guidance is that mapping *"is more expensive than
reading or writing a few tens of kilobytes"* and is *"generally only worth mapping relatively large
files"*. For sequential streaming of a large file, plain reads with a reused buffer are simpler and
carry none of the lifetime problems on this page.

**★ How do you unmap a memory-mapped file deterministically on JDK 25?**
Use the `FileChannel.map(mode, offset, size, arena)` overload added in Java 22, which returns a
`MemorySegment` rather than a `MappedByteBuffer`. Its javadoc states that *"The lifetime of the
returned segment is controlled by the provided arena … if the provided arena is a closeable arena,
the returned segment will be unmapped when the provided closeable arena is closed."* Wrap the arena
in try-with-resources and the mapping is gone at a point you chose, on your thread, with
use-after-close throwing instead of being undefined. The `MappedByteBuffer` route has no equivalent
— its javadoc says the mapping lasts *"until the buffer itself is garbage-collected"*.

**★ You map a 4 GB index at startup and RSS immediately shows only a few megabytes. Is the mapping
working?**
Yes, and this is the expected behaviour. A mapping reserves address space eagerly and faults pages
in lazily on first touch, so RSS reflects only the pages you have actually read. If you want the
pages resident up front — to move the I/O cost out of the request path — `load()` makes a
best-effort attempt and will *"cause some number of page faults and I/O operations"*. If you want
to know whether they are resident, `isLoaded()` gives you a hint and explicitly not a guarantee,
because the OS may page data out between the check and the method returning.

{/* FOOTER */}
