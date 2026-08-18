---
title: "NIO channels and selectors"
sidebar_label: "12 · NIO channels and selectors"
sidebar_position: 12
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-08-18 against the JDK 25 Javadoc for the
> `java.nio.channels` package (`FileChannel`, `SocketChannel`,
> `ServerSocketChannel`, `Selector`, `SelectionKey`,
> `AsynchronousFileChannel`), `java.nio.ByteBuffer` and
> `java.nio.MappedByteBuffer`, and JEP 444 (virtual threads, final in 21)
> for the concurrency-model comparison.

**NIO is the layer your frameworks are built on, not the layer you write.
Netty, Tomcat's NIO connector, Kafka's network stack and every JDK HTTP
server sit on the same three abstractions — `Buffer`s, `Channel`s and
`Selector`s — and you read this topic to understand *their* code and their
failure modes, not to hand-roll an event loop. Since virtual threads
(JDK 21), the one historical reason application code reached for selectors —
"ten thousand connections won't fit in ten thousand threads" — is gone:
plain blocking code on virtual threads scales where only selector loops
used to.**

## What NIO actually is

`java.io` streams move one byte (or one buffered chunk) at a time and only
block. `java.nio` (JDK 1.4) replaced the *model*, not just the API:

| Abstraction | Replaces | The shift |
|---|---|---|
| `ByteBuffer` | byte arrays in stream calls | an explicit, reusable window of memory with cursors |
| `Channel` | `InputStream`/`OutputStream` | bidirectional, works with buffers, *can* be non-blocking |
| `Selector` | one-thread-per-connection | one thread told *which* of N channels is ready right now |

Everyday file and network work does not need any of this —
[streams, buffers and charsets](03-streams-buffers-charsets.md) and
`HttpClient` cover it. NIO earns its place at the edges: very large files,
zero-copy transfers, and the internals of network frameworks.

## `ByteBuffer` — enough mechanics to read framework code

A buffer is an array plus three cursors, and every NIO bug you'll read
about in a framework issue tracker is one of these cursors in the wrong
place:

- **`capacity`** — the fixed size.
- **`position`** — where the next read *or* write happens.
- **`limit`** — where reads/writes must stop.

The lifecycle is a two-phase cycle. Filling: `channel.read(buf)` advances
`position` as bytes land. Draining: **`buf.flip()`** sets
`limit = position, position = 0` — now `get`s read exactly what arrived.
Then either `clear()` (empty it: `position = 0, limit = capacity` — data is
*not* erased, just abandoned) or `compact()` (move unread bytes to the
front and keep filling — the one to use with partial protocol messages).

```java
ByteBuffer buf = ByteBuffer.allocate(8192);
while (channel.read(buf) != -1) {
    buf.flip();                 // switch: filling → draining
    while (buf.hasRemaining()) {
        sink.write(buf);        // may write fewer bytes than remaining!
    }
    buf.clear();                // switch: draining → filling
}
```

`allocate` gives a heap buffer (backed by a `byte[]`); `allocateDirect`
gives native memory outside the Java heap — faster for actual I/O because
the OS can use it without copying, slower to allocate, and counted against
`-XX:MaxDirectMemorySize`, *not* `-Xmx`. Frameworks pool direct buffers for
exactly this reason; application code that allocates them per-request leaks
native memory pressure the heap profiler cannot see.

## `FileChannel` — the file cases that are genuinely NIO's

Three capabilities `Files`/streams don't give you:

- **Positional access** — `read(buf, position)` / `write(buf, position)`
  without moving a shared cursor; safe for concurrent readers of one file.
- **`transferTo` / `transferFrom`** — copy file→socket or file→file inside
  the kernel where the OS supports it (zero-copy; `sendfile` on Linux).
  This is how static-file serving avoids dragging every byte through the
  JVM heap.
- **`map()`** — memory-map a region as a `MappedByteBuffer`: the file
  *becomes* memory, paged in on access. The right tool for random access
  into multi-GB files (index files, database segments — this is Kafka's
  and Lucene's storage trick).

```java
try (FileChannel ch = FileChannel.open(path, StandardOpenOption.READ)) {
    MappedByteBuffer map = ch.map(FileChannel.MapMode.READ_ONLY, 0, ch.size());
    byte b = map.get(someOffset);          // no read() call — a page fault
}
```

The historical trap: the mapping lives until the buffer is
garbage-collected — there was no reliable unmap, so on Windows the file
stayed locked and un-deletable. JDK 22+ code has a clean exit:
`FileChannel.map(mode, offset, size, arena)` ties the mapping's lifetime to
an FFM `Arena`, so closing the arena unmaps deterministically — see
[the Foreign Function & Memory API](13-ffm-api.md).

## Non-blocking sockets and the `Selector` loop

The shape every framework implements, and the reason you should be glad it
does:

```java
Selector selector = Selector.open();
ServerSocketChannel server = ServerSocketChannel.open();
server.bind(new InetSocketAddress(8080));
server.configureBlocking(false);                    // mandatory before register
server.register(selector, SelectionKey.OP_ACCEPT);

while (true) {
    selector.select();                              // block until something is ready
    Iterator<SelectionKey> it = selector.selectedKeys().iterator();
    while (it.hasNext()) {
        SelectionKey key = it.next();
        it.remove();                                // you must remove it yourself
        if (key.isAcceptable()) { /* accept, register OP_READ */ }
        else if (key.isReadable()) { /* read — maybe HALF a message */ }
        else if (key.isWritable()) { /* drain what write() couldn't take */ }
    }
}
```

What the skeleton hides is why this is framework territory:

- **Partial everything.** A read may deliver half a message; a write may
  accept 0 bytes when the socket send buffer is full. Every connection
  needs a hand-written state machine carrying its half-parsed input and
  its unflushed output between events.
- **`OP_WRITE` discipline.** A socket is writable almost always, so
  registering interest permanently makes `select()` spin at 100% CPU. You
  register it only after a short write, and deregister once drained.
- **Bookkeeping traps.** Selected keys must be removed manually, cancelled
  keys linger until the next `select`, and `wakeup()` is needed to nudge a
  blocked selector when another thread changes registrations.

Netty exists because getting all of this right — plus buffer pooling,
backpressure and TLS — is a project, not a class.

**Virtual threads changed the default answer.** The selector loop was how
one machine held 10k+ connections when each platform thread cost ~1 MB of
stack. A [virtual thread](../phase-6-concurrency/02-platform-vs-virtual-threads/README.md)
costs so little that thread-per-connection *blocking* code now scales to
the same connection counts with none of the state-machine complexity — the
JDK parks the virtual thread on I/O and internally multiplexes carriers
(watch the [pinning caveats](../phase-6-concurrency/14-virtual-thread-pinning.md)).
New server code should be blocking-on-virtual-threads first; selectors
remain for the frameworks and for protocols that genuinely need explicit
readiness control.

## The asynchronous channels, briefly

`AsynchronousFileChannel` and `AsynchronousSocketChannel` (NIO.2, JDK 7)
are the callback/`Future` flavor: `read` returns immediately and completes
a `CompletionHandler` later. They never displaced selectors in frameworks
and virtual threads undercut them for applications; recognize them in
older codebases rather than choosing them for new ones.

## When you will actually touch NIO

- **Memory-mapping a huge file** for random access — the one API here with
  no simpler substitute.
- **`transferTo`** when profiling shows file-copy or file-serving dragging
  bytes through the heap.
- **Reading framework code or its stack traces** — `select()`,
  `SelectionKey`, `ByteBuffer.flip()` in a Netty or Tomcat frame should
  now be legible.
- **Writing a custom protocol server** — at which point the practical
  advice is: use Netty, or blocking code on virtual threads.

## Gotchas

**Symptom:** after `channel.read(buf)`, `buf.get()` returns garbage or `BufferUnderflowException`
**Cause:** no `flip()` — position is still at the end of what was written, so reads start past the data
**Fix:** `flip()` between filling and draining; it is the single most-forgotten call in NIO

**Symptom:** data silently lost on a socket under load
**Cause:** `write(buf)` returned without writing everything (send buffer full) and the return value was ignored
**Fix:** loop `while (buf.hasRemaining())`, or in a selector loop stash the buffer and register `OP_WRITE`

**Symptom:** selector thread at 100% CPU doing nothing
**Cause:** `OP_WRITE` interest left registered on writable sockets, or selected keys never removed so stale events re-fire
**Fix:** register `OP_WRITE` only while a write is pending; always `it.remove()` in the loop

**Symptom:** `OutOfMemoryError: Direct buffer memory` while the heap is nearly empty
**Cause:** direct buffers live outside `-Xmx`, capped by `-XX:MaxDirectMemorySize`, and are only reclaimed when their Java objects are GC'd — allocation-per-request outruns collection
**Fix:** pool direct buffers (or let the framework's allocator do it); raise the cap only once the leak is ruled out

**Symptom:** memory-mapped file cannot be deleted (Windows) or disk space isn't freed until the JVM exits
**Cause:** the mapping outlives the channel and dies only at GC of the `MappedByteBuffer`
**Fix:** on JDK 22+, map with an `Arena` and close it for deterministic unmap; earlier, scope mappings narrowly and null the reference

**Symptom:** `IllegalBlockingModeException` at `register(...)`
**Cause:** the channel is still in blocking mode — registration requires non-blocking
**Fix:** `configureBlocking(false)` before `register`

## Interview questions

**★ What do `flip()`, `clear()` and `compact()` each do to the cursors?**
`flip`: `limit = position, position = 0` — switch from filling to draining. `clear`: `position = 0, limit = capacity` — abandon contents and refill from scratch. `compact`: copy the *unread* remainder to the front, set `position` after it — keep unconsumed bytes while making room to read more; the one a protocol parser needs.

**★ Heap vs direct `ByteBuffer` — the actual trade?**
Heap buffers are cheap to allocate and GC-managed but I/O may copy them to native memory anyway; direct buffers let the OS read/write in place but allocate slowly and consume native memory budgeted by `-XX:MaxDirectMemorySize`. Rule frameworks follow: pool direct buffers for the I/O edge, heap for everything else.

**★ Why can a selector-based server not just call `channel.write(buf)` and move on?**
Non-blocking `write` writes only what the socket send buffer accepts — possibly zero bytes. The unwritten remainder must be kept per-connection and flushed when the selector reports `OP_WRITE`; forgetting this drops bytes exactly and only under load.

**★ Do virtual threads make selectors obsolete?**
For application code, mostly yes: blocking thread-per-connection code on virtual threads reaches the connection counts that once required an event loop, with straight-line control flow. The JDK itself and network frameworks still use selectors underneath — the model moved into the platform rather than disappearing.

**★ What does `transferTo` buy over a read/write loop?**
The kernel can move bytes source→destination without surfacing them into user space (`sendfile`) — no heap buffers, fewer copies, fewer context switches. Falls back to an internal loop where the OS can't do it, so it's never worse.

**★ You see `epoll` and a spinning thread in a Netty bug report — what class of bug is that?**
A selector wakeup/interest-set bug: either an interest op (usually `OP_WRITE`) that is always ready, a key never removed from the selected set, or the historical "epoll spurious wakeup returns 0" JDK bug frameworks work around by rebuilding the selector after N zero-returns.

---

← Prev: [Console I/O and Scanner](11-console-io-scanner.md) · Index: [Phase 7 — I/O, time and the everyday stdlib](README.md) · Next → [Foreign Function & Memory API](13-ffm-api.md)
