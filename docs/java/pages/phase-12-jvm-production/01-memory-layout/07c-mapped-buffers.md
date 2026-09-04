---
title: "A mapped buffer is not charged against MaxDirectMemorySize, is not unmapped when you close the channel, and is capped at Integer.MAX_VALUE bytes — three facts that make mmap the region most likely to be missing from your memory model"
sidebar_label: "07c · Mapped buffers"
sidebar_position: 27
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the **JDK 25 `FileChannel.map(MapMode,long,long)`** and
> **`map(MapMode,long,long,Arena)`** javadoc
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/nio/channels/FileChannel.html));
> the **JDK 25 `MappedByteBuffer`** javadoc (class description, `isLoaded()`, `load()`, `force()`)
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/nio/MappedByteBuffer.html));
> and the OpenJDK `jdk-25+36` source `src/java.base/share/classes/sun/nio/ch/FileChannelImpl.java`
> (`getMappedBufferPool()` returning the pool named `"mapped"`, `getSyncMappedBufferPool()`
> returning `"mapped - 'non-volatile memory'"`, and the absence of any call to
> `Bits.reserveMemory`).
> JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9.

**A `MappedByteBuffer` looks like a direct buffer and is documented as one — *"Mapped byte buffers
otherwise behave no differently than ordinary direct byte buffers"* — but its memory comes from a
completely different place, is accounted in a completely different way, and is released on a
completely different schedule. Every one of those three differences is a production surprise, and
the middle one, that `-XX:MaxDirectMemorySize` does not apply, is the one that turns a mapped-file
cache into an unbounded memory region.**

## What `map` gives you

```java
try (FileChannel channel = FileChannel.open(path, StandardOpenOption.READ)) {
    MappedByteBuffer index = channel.map(FileChannel.MapMode.READ_ONLY, 0, Files.size(path));
    // channel can be closed here; the mapping survives it
    return lookup(index, key);
}
```

The three modes, quoted:

> - *"**Read-only:** Any attempt to modify the resulting buffer will cause a
>   `ReadOnlyBufferException` to be thrown."*
> - *"**Read/write:** Changes made to the resulting buffer will eventually be propagated to the
>   file; they may or may not be made visible to other programs that have mapped the same file."*
> - *"**Private:** Changes made to the resulting buffer will not be propagated to the file and
>   will not be visible to other programs that have mapped the same file; instead, they will cause
>   private copies of the modified portions of the buffer to be created."*

`PRIVATE` is copy-on-write, and its memory cost is therefore proportional to how much of the
mapping you *write*, not to how much you map — a distinction worth holding onto when reasoning
about footprint.

The javadoc is also unusually blunt about how little it promises:

> *"Many of the details of memory-mapped files are inherently dependent upon the underlying
> operating system and are therefore unspecified. … Whether changes made to the content or size of
> the underlying file, by this program or another, are propagated to the buffer is unspecified.
> The rate at which changes to the buffer are propagated to the file is unspecified."*

And when it is worth doing at all:

> *"For most operating systems, mapping a file into memory is more expensive than reading or
> writing a few tens of kilobytes of data via the usual `read` and `write` methods. From the
> standpoint of performance it is generally only worth mapping relatively large files into
> memory."*

## Fact 1: closing the channel does not unmap

> *"A mapping, once established, is not dependent upon the file channel that was used to create
> it. **Closing the channel, in particular, has no effect upon the validity of the mapping.**"*

This is a feature — the code above deliberately closes the channel and keeps using the buffer —
and it is also the reason try-with-resources gives you no help here at all. The `close()` you were
taught to write releases the file descriptor and releases nothing else.

## Fact 2: the mapping is released only by garbage collection

> *"The buffer and the mapping that it represents will remain valid until the buffer itself is
> garbage-collected."*

The `MappedByteBuffer` class description repeats it: *"A mapped byte buffer and the file mapping
that it represents remain valid until the buffer itself is garbage-collected."* Mechanically it is
the same `Cleaner`-based path as an ordinary direct buffer — `FileChannelImpl` registers an
unmapper — with the same three-stage delay described in
[07b · Cleaners and deterministic release](07b-cleaners-and-deterministic-release.md).

There is one aggravating difference. A mapping holds an operating-system resource — an address
space reservation, and on some platforms a reference that keeps the file alive on disk after
deletion. On Windows this is famously visible: a mapped file cannot be deleted or replaced while
the mapping exists, so a "file is in use by another process" error can persist long after the code
that mapped it returned, until a garbage collection happens to run.

## Fact 3: `-XX:MaxDirectMemorySize` does not apply

🔴 This is the one that changes a capacity plan. `ByteBuffer.allocateDirect` goes through
`Bits.reserveMemory`, which enforces the `MaxDirectMemorySize` budget. `FileChannelImpl`'s mapping
path does not call `Bits.reserveMemory` at all — mapped memory is accounted in a **separate**
buffer pool with no configurable ceiling:

```java
public static BufferPool getMappedBufferPool() {
    return new BufferPool() {
        @Override
        public String getName() {
            return "mapped";
        }
        ...
    };
}
```

There is a third pool as well, `"mapped - 'non-volatile memory'"`, for mappings backed by
persistent memory. The practical statements:

- **No JVM flag bounds mapped memory.** Not `-Xmx`, not `-XX:MaxDirectMemorySize`. The bound is
  the address space and, for resident pages, the OS.
- **You will therefore never get an `OutOfMemoryError` for mapping too much.** You get a failed
  `map` call, or you get the container's OOM killer, or you get the machine swapping.
- **Monitoring has to be per-pool.** `java.lang.management.ManagementFactory.getPlatformMXBeans(
  BufferPoolMXBean.class)` returns one bean per pool; the `"mapped"` one is the only place the
  JVM tells you about this memory. Micrometer surfaces the same beans as `jvm.buffer.count`,
  `jvm.buffer.memory.used` and `jvm.buffer.total.capacity`, tagged by pool `id`. If your dashboard
  charts only the `direct` pool, mapped memory is invisible.

## Fact 4: 2 GB, per mapping

The `size` parameter of `map(MapMode, long, long)` is a `long`, and the javadoc's constraint is
not:

> *"`size` - The size of the region to be mapped; must be non-negative and **no greater than
> `Integer.MAX_VALUE`**"*

Because `MappedByteBuffer` is a `ByteBuffer`, and a `ByteBuffer`'s `capacity()` is an `int`.
Mapping a 40 GB file therefore means twenty mappings and your own offset arithmetic — which is
exactly the boilerplate that the FFM version removes.

## Where the rest of this material lives

How pages actually become resident, what `force()` does and does not promise, and the JDK 22+
`Arena` overload that gives a mapping a lifetime you choose, are
[07d · Residency, durability and arenas](07d-mmap-residency-and-arenas.md).

## Gotchas

**★ `-XX:MaxDirectMemorySize` does not bound mapped buffers.**
The mapping path never calls `Bits.reserveMemory`; mapped memory is tracked in its own
`BufferPool` named `"mapped"` with no configurable ceiling. A service that maps files has an
unbounded native region no JVM flag constrains, and the first symptom is usually an OOMKill rather
than an `OutOfMemoryError`.

**★ Closing the `FileChannel` does not unmap.**
The javadoc says the mapping *"is not dependent upon the file channel that was used to create
it"* and that *"Closing the channel, in particular, has no effect upon the validity of the
mapping."* Correct try-with-resources on the channel gives you no cleanup of the region at all.

**★ Unmapping waits for a garbage collection you may never get.**
*"The buffer and the mapping that it represents will remain valid until the buffer itself is
garbage-collected."* A `MappedByteBuffer` is a small object producing little heap pressure, so on
a service with a large heap it can survive for a very long time — holding address space, resident
pages, and on some platforms the file itself.

**★ On Windows, a live mapping blocks deleting or replacing the file.**
This is the most common way the previous gotcha becomes visible: a rotation or upgrade fails with
"the file is in use by another process" and there is no process holding it — only an unreferenced
`MappedByteBuffer` waiting for a collection. Use the `Arena` overload where the lifetime matters.

**★ One mapping cannot exceed `Integer.MAX_VALUE` bytes.**
The javadoc's own parameter constraint: *"must be non-negative and no greater than
`Integer.MAX_VALUE`"*, because `ByteBuffer.capacity()` is an `int`. Large files require chunking
with `map(...)`, or a single `MemorySegment` via the `Arena` overload, whose size is a `long`.

**★ Truncating or replacing a mapped file can crash or corrupt at an unspecified later time.**
`MappedByteBuffer`'s class description: an attempt to access an inaccessible region *"will cause an
unspecified exception to be thrown either at the time of the access or at some later time"*, and it
*"is therefore strongly recommended that appropriate precautions be taken to avoid the manipulation
of a mapped file"*. A log-rotation script that truncates a mapped file is a genuine crash risk.

**★ Micrometer's `jvm.buffer.*` metrics are per pool, and dashboards routinely chart only one.**
There are at least three pools — `direct`, `mapped`, and `mapped - 'non-volatile memory'`. Filter
on the pool `id` tag, or you are monitoring a third of the picture.

**★ Mapping a small file is slower than reading it.**
*"For most operating systems, mapping a file into memory is more expensive than reading or writing
a few tens of kilobytes of data via the usual `read` and `write` methods."* `mmap` is a large-file
technique; using it for configuration files is a pessimisation with a permanent cleanup problem
attached.

## Interview questions

**★ Is a `MappedByteBuffer` counted against `-XX:MaxDirectMemorySize`?**
No. `ByteBuffer.allocateDirect` goes through `Bits.reserveMemory`, which enforces that limit;
`FileChannelImpl`'s mapping path does not call it, and mapped memory is tracked in a separate
`BufferPool` named `"mapped"` (plus a third pool for non-volatile memory mappings). The practical
implication is that mapped memory is an unbounded native region from the JVM's point of view: you
will not get an `OutOfMemoryError` for mapping too much, you will get a failed `map`, a swapping
machine, or a container kill. Monitoring it means reading the `mapped` `BufferPoolMXBean`
specifically.

**★ When is a mapped buffer's memory released?**
When the buffer object is garbage-collected — the javadoc says the mapping *"will remain valid
until the buffer itself is garbage-collected"* — via the same `Cleaner`-based mechanism as an
ordinary direct buffer. Closing the `FileChannel` does not do it; the javadoc explicitly states
that the mapping is independent of the channel. Since JDK 22 there is a deterministic alternative:
`FileChannel.map(mode, offset, size, arena)` returns a `MemorySegment` whose mapping is unmapped
when the arena is closed.

**★ Why can you not map a 10 GB file into one `MappedByteBuffer`?**
Because `MappedByteBuffer` extends `ByteBuffer`, whose `capacity()` is an `int`, so the `map`
javadoc constrains `size` to *"no greater than `Integer.MAX_VALUE`"* even though the parameter is
declared `long`. The classic workaround is to map the file in chunks and do your own offset
arithmetic. The modern one is the `Arena` overload, which returns a `MemorySegment` whose
`byteSize()` is a `long`.

**★ A Windows deployment cannot replace a data file during an upgrade and reports it is in use, but
no process holds it. What is going on?**
An unreferenced `MappedByteBuffer` whose `Cleaner` has not run. On Windows a live file mapping
prevents the file from being deleted or replaced, and the mapping stays live until the buffer is
garbage-collected — which, because the buffer object is tiny and creates almost no heap pressure,
can be an arbitrarily long time. The correct fix is not to call `System.gc()` and hope; it is to
give the mapping an explicit lifetime with `FileChannel.map(mode, offset, size, arena)` and close
the arena when the file is no longer needed.

{/* FOOTER */}
