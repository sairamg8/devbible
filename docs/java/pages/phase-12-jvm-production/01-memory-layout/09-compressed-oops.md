---
title: "Compressed oops make a 64-bit JVM store 32-bit references, which is why a heap that crosses 32 GB can hold less data than it did at 31 GB — the one place in the JVM where asking for more memory gives you less"
sidebar_label: "09 · Compressed oops"
sidebar_position: 35
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the **JDK 25 `java` tool reference**
> ([docs.oracle.com/en/java/javase/25/docs/specs/man/java.html](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html)) —
> the entry for `-XX:-UseCompressedOops`, quoted verbatim below — and the **HotSpot Java
> Virtual Machine Garbage Collection Tuning Guide** for JDK 25
> ([docs.oracle.com/en/java/javase/25/gctuning/](https://docs.oracle.com/en/java/javase/25/gctuning/)).
> JDK 25 · Spring Boot 4.1.1.
> **No sandbox** — this page carries Java source, quoted documentation and arithmetic you can
> redo. It contains no captured JVM output.

**A 64-bit JVM does not store 64-bit references. On any heap the JVM believes fits, every
reference in every object field and every array slot is squeezed into 32 bits, and the
missing bits are reconstructed on each access. This is the single largest memory saving in
the JVM and nobody asked for it. It is also the reason for the most counter-intuitive
result in the whole of Java performance: a service given a 33 GB heap can run out of memory
where the same service on 31 GB did not.**

The mechanism is worth understanding precisely, because the failure mode is silent. Nothing
logs "you have crossed the compressed-oops boundary". The heap simply gets less efficient,
GC gets more expensive, and someone concludes that "the app needs even more memory".

This chunk owns the **mechanism and the cliff**. The levers you can pull —
`ObjectAlignmentInBytes` and the separate compression of class pointers — are in
[09b · Alignment and class pointers](09b-alignment-and-class-pointers.md), and the commands
that tell you what your JVM actually chose are in
[09d · Verifying what the JVM chose](09d-verifying-what-the-jvm-chose.md).

## What an oop is, and why compressing it pays

An **oop** is an *ordinary object pointer* — HotSpot's term for a reference. On a 64-bit
machine the natural size is 8 bytes. References are also, by a wide margin, the most common
thing in a Java heap: every non-primitive field, every element of every `Object[]`, and the
class word in every object header is a reference or a reference-shaped word.

Consider an ordinary domain object:

```java
class Order {
    long id;              // 8 bytes, a primitive — unaffected
    Customer customer;    // a reference
    Instant placedAt;     // a reference
    List<Line> lines;     // a reference
    String currency;      // a reference
}
```

Four of its five fields are references. At 8 bytes each that is 32 bytes of pointer per
`Order`; at 4 bytes each it is 16. On a heap holding ten million orders, the difference is
160 MB in that one class — before counting the `Line` objects, the `String`s, and the
backing arrays of the lists, all of which are also mostly references.

The saving is not only footprint. Smaller objects mean **more objects per cache line**, and
cache behaviour dominates the runtime of pointer-chasing code such as tree and map
traversal. Compressed oops routinely buy throughput as well as space, which is why the JVM
turns them on without being asked.

## The trick: a reference is not an address, it is an index

Thirty-two bits addresses 4 GB. Yet compressed oops work on heaps far larger than that, and
the reason is **object alignment**.

Every Java object starts at an address that is a multiple of the alignment, 8 bytes by
default. That means the low three bits of every object address are always zero — they carry
no information. So HotSpot does not store the address. It stores the address **shifted
right by three bits**, which is to say the object's index in units of 8 bytes.

That is the whole idea. Thirty-two bits of *index*, at 8 bytes per index step, addresses
`2^32 × 8` bytes = **32 GB**. The `java` tool reference states the consequence directly:

> *"Disables the use of compressed pointers. By default, this option is enabled, and
> compressed pointers are used. This will automatically limit the maximum ergonomically
> determined Java heap size to the maximum amount of memory that can be covered by
> compressed pointers. By default this range is 32 GB."*
> — JDK 25 `java` tool reference, `-XX:-UseCompressedOops`

Read that second sentence carefully, because it is doing something people miss: if you let
ergonomics choose the heap size, **ergonomics will cap it to stay inside compressed-oops
range**. The JVM would rather give you a smaller heap than give up compression.

The same entry is explicit that this is a 64-bit-only concern — *"This option works only for
64-bit JVMs"* — which on JDK 25 means every JVM, since the 32-bit x86 port was removed in
this release.

## The three encoding modes, cheapest first

Decoding a compressed oop back to a real address is `base + (oop << shift)`. HotSpot picks
the cheapest form of that expression the heap placement allows, and the three cases have
genuinely different costs:

| Mode | Condition | Decode | Cost |
|---|---|---|---|
| **Unscaled / 32-bit** | The whole heap fits below the 4 GB line | `oop` — used as-is | Free. No shift, no add |
| **Zero-based** | The heap fits below the alignment × 4 GB line (32 GB by default) and the base can be zero | `oop << 3` | One shift |
| **Base + shift** | The heap had to be mapped higher | `base + (oop << 3)` | A shift and an add, plus a null check on the encode side |

Two consequences follow, and both are practical:

**A very small heap gets the free mode.** Under about 4 GB HotSpot can often map the heap
low enough that the compressed value *is* the address and no arithmetic happens at all.
This is a quiet argument for small heaps in small containers that has nothing to do with GC.

**"Zero-based" is not automatic — it depends on where the OS let the JVM map the heap.**
The JVM asks for a heap placed so that the base can be zero. If the address space is
fragmented, or ASLR or an `-Xmx` close to the ceiling gets in the way, it falls back to the
base+shift form, which adds an instruction to every dereference. This is a real and
invisible few-percent difference between two identical processes on two hosts, and it is
why the mode is something you *observe* rather than something you deduce.

The null case is worth a sentence because it is where the encode side costs something.
A Java `null` is the compressed value zero, and in base+shift mode zero must not decode to
`base` — so encoding and decoding carry a null check that the zero-based mode does not need.
That is the concrete reason "zero-based" is named as a distinct, better mode rather than
being lumped in with base+shift at base 0.

## The 32 GB cliff, and why it is a cliff and not a slope

Cross the boundary and compression is turned off entirely. Every reference in the heap
doubles from 4 bytes to 8. The header's class word also grows, since compressed *class*
pointers go with them — see
[09b](09b-alignment-and-class-pointers.md) for that second mechanism.

This is not a gentle degradation — it is a step. The arithmetic is worth doing explicitly,
because it is the fact that surprises people:

- A 31 GB heap with compressed oops holds objects whose reference fields cost 4 bytes each.
- A 33 GB heap without them holds the same objects with 8-byte reference fields.

For a reference-dense workload — object graphs, linked structures, maps of maps — the
per-object growth commonly lands in the **10–20%** range once alignment padding is included.
A heap 6% larger, holding objects up to 20% larger, **stores less live data than it did
before.** People then raise `-Xmx` again, which makes it worse, and the loop continues.

🔴 **The practical rule: do not size a heap between roughly 32 GB and about 40 GB.** Below
32 you get compression; above 40 or so the extra raw capacity has finally outrun the
efficiency you gave up. The band in between is strictly worse than the bottom of it.

There is a second cost that people forget to count. More heap is not free for the collector
either: a larger live set means more to mark, more to copy and larger remembered sets. So
crossing the cliff can raise GC cost at the same time as it lowers effective capacity.
**Topic 02 · GC in practice** *(not written yet)* owns that side of the argument.

## When the cliff does not matter

The steepness of the cliff is a property of **your object graph**, not of the JVM, and it is
worth knowing which side of that you are on before you plan around it.

A heap dominated by large primitive payloads — `byte[]` buffers, `long[]` columns, off-heap
caches with small on-heap handles — has very few references relative to its size. Such a
workload can cross 32 GB and barely notice. A heap dominated by small linked structures —
`HashMap` nodes, tree nodes, domain graphs, parsed documents — is almost all references, and
for it the cliff is severe.

That is the question to answer first. If you do not know which describes your heap,
[08d · Measuring an object](08d-measuring-an-object.md) is how you find out, and a heap
histogram from [topic 04](../04-out-of-memory-error/README.md) will tell you what the heap is
mostly made of.

## Gotchas

**★ Raising `-Xmx` from 31 GB to 33 GB can reduce how much your application can hold.**
Compression switches off at the boundary, every reference doubles, and the extra 2 GB of
raw heap does not cover the loss. This is the phase's most counter-intuitive result and it
is entirely mechanical. If you must exceed 32 GB, jump well past it — or raise
`ObjectAlignmentInBytes` instead ([09b](09b-alignment-and-class-pointers.md)).

**★ Ergonomics will silently cap your heap to stay under the compressed-oops ceiling.**
The tool reference says so: the option *"will automatically limit the maximum ergonomically
determined Java heap size"*. If you did not set `-Xmx` and are wondering why a 128 GB
machine gave the JVM about 32 GB, this — not a bug — is why.

**★ "Zero-based" is not guaranteed by staying under 32 GB.** It also requires the OS to map
the heap at a usable address. Two identical containers can end up in different encoding
modes, and the base+shift mode costs an extra instruction plus a null check on every
dereference. Only the `gc+heap+coops` log tells you which you got.

**★ Nothing warns you when you cross the boundary.** There is no `[WARNING]`, no startup
banner in the default log configuration, and no metric that flips. The only evidence is the
`gc+heap+coops` log tag, which you have to have asked for. Bake it into your standard
startup logging if your heap is anywhere near the boundary —
[09d](09d-verifying-what-the-jvm-chose.md) has the command.

**★ Compressed oops do nothing for primitive-heavy heaps.** A heap that is mostly `byte[]`,
`long[]` or off-heap buffers has almost no references to compress. Crossing 32 GB costs
such a workload very little — and, symmetrically, raising alignment would cost it real
padding for no gain.

**★ Compressed oops apply to the heap only.** They say nothing about the size of a thread
stack frame, a direct `ByteBuffer`, or metaspace. "We enabled compressed oops and RSS did
not move" usually means the growth was never in the heap — see
[11c · The footprint that is not in any region](11c-the-footprint-that-is-not-in-any-region.md).

**★ There is no 32-bit JVM to fall back to.** The 32-bit x86 port was removed in JDK 25, and
the tool reference notes compression *"works only for 64-bit JVMs"*. "Just run the 32-bit VM
for small services" stopped being advice several releases ago.

**★ A heap dump taken from a compressed JVM does not report 8-byte references.** Sizes in an
analyser reflect the layout the dumping JVM used. Comparing a dump from a 30 GB heap with
one from a 40 GB heap and concluding that objects "grew" is comparing two different layouts,
not two different workloads.

**★ Two services with identical code and identical `-Xmx` can differ measurably in
throughput.** If one landed in zero-based mode and the other in base+shift, every reference
dereference in the second costs a little more. It is small, it is real, and it looks exactly
like noise until you check the log.

## Interview questions

**★ What are compressed oops and why does the JVM enable them by default?**
On a 64-bit JVM, a reference would naturally occupy 8 bytes. Compressed oops store it in 4
by exploiting object alignment: because every object starts on an 8-byte boundary, the low
three bits of its address are always zero and carry no information, so HotSpot stores the
address shifted right by three — effectively an index in 8-byte units — and reconstructs
the address on access. It is on by default because references dominate a typical Java heap,
so the saving is large, and because smaller objects fit more per cache line, which usually
makes it a throughput win as well as a footprint win.

**★ Why is 32 GB the limit, and what exactly happens at that point?**
Thirty-two bits of index at 8 bytes per step covers `2^32 × 8` bytes = 32 GB. Past that the
index cannot reach the whole heap, so HotSpot turns compression off and every reference
becomes a full 8-byte pointer — and compressed class pointers go with it, so the header's
class word grows too. It is a cliff rather than a slope: the change is all-or-nothing at the
boundary, not proportional to how far over you are.

**★ A team raises `-Xmx` from 31 GB to 34 GB and their service starts hitting
`OutOfMemoryError`. Explain.**
They crossed the compressed-oops boundary. Below it, every reference field and array slot
cost 4 bytes; above it, 8. For a reference-dense object graph the per-object growth is
commonly 10–20% once alignment padding is counted, while the heap only grew by about 10%.
The result is a heap that holds less live data than the smaller one did. The fix is either
to go back under 32 GB, to jump far enough past it that the extra capacity outweighs the
loss, or to raise `-XX:ObjectAlignmentInBytes` so compression survives at the larger size.

**★ What are the three compressed-oops encoding modes and why do you care?**
Unscaled, where the whole heap sits below 4 GB and the compressed value is the address —
decoding is free. Zero-based, where the base is zero and decoding is a single shift.
Base-plus-shift, where the heap could not be mapped low enough and decoding costs a shift
and an add, plus a null check because compressed zero means `null` and must not decode to
the base address. You care because the last one is a small but real per-dereference cost,
and which you get depends on where the OS mapped the heap, not just on the size you
requested — two identical containers can differ.

**★ You have a service whose heap is almost entirely large byte arrays. How much does
crossing 32 GB cost it?**
Very little. Compressed oops save 4 bytes per *reference*, and a heap of large `byte[]`
buffers has very few references relative to its size — the payload is primitives. The
cliff's steepness is a property of the object graph, not of the JVM. The corollary matters
more: that same workload would pay the full padding cost of raising `ObjectAlignmentInBytes`
and get almost nothing back, so the "keep compression on a big heap" trick is exactly wrong
for it.

**★ Does enabling compressed oops reduce the process's resident memory?**
It reduces the *heap's* consumption per unit of live data, which may or may not show up as
lower RSS depending on whether the heap was committed and touched. It does nothing at all
for thread stacks, metaspace, the code cache, direct byte buffers or native allocations. If
a process is growing and the heap is flat, compression is not the lever — the growth is
outside the heap and needs Native Memory Tracking to locate.

**★ Your team wants a 64 GB heap for a caching service. Walk through the decision.**
First establish what the heap is made of, because that decides everything. If it is large
primitive payloads, cross the boundary without ceremony — the loss is small and the extra
capacity is real. If it is reference-dense structures, you have three options: stay under
32 GB and scale out instead; raise `ObjectAlignmentInBytes` to 16 so compression covers
64 GB, accepting padding on every object; or go to 64 GB uncompressed and accept roughly
10–20% larger objects. All three are defensible; what is not defensible is landing at
34 GB by accident, which is the worst of every option. Then verify the outcome with
`-Xlog:gc+heap+coops` rather than assuming the flag did what you intended.

**★ How would you detect that a production JVM had silently lost compressed oops?**
Nothing alerts on it, so you have to look — [09d](09d-verifying-what-the-jvm-chose.md) is the
full set of commands. `-Xlog:gc+heap+coops=info` at startup reports the
heap base and shift and is the direct evidence; `jcmd <pid> VM.flags` on a running process
shows whether `UseCompressedOops` ended up true. Indirectly, you would see the live set after
a full GC grow for no change in traffic, and average object sizes in a heap histogram rise
against a previous dump. The direct check is the one to build into your startup logging.

{/* FOOTER */}
