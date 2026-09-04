---
title: "Every object is rounded up to a multiple of eight bytes, the JVM reorders your fields to waste as little of that as possible, and the two consequences — that field declaration order means nothing and that a one-byte array costs the same as an eight-byte one — are the whole reason object size arithmetic done on paper is wrong"
sidebar_label: "08c · Alignment and padding"
sidebar_position: 32
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **JDK 25 `java` tool reference** for
> `-XX:ObjectAlignmentInBytes`
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html)),
> and the JDK 25 HotSpot source at tag `jdk-25+36` —
> `src/hotspot/share/classfile/fieldLayoutBuilder.cpp` for field ordering and
> `src/hotspot/share/oops/arrayOop.hpp` for the array length placement
> ([github.com/openjdk/jdk](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/classfile/fieldLayoutBuilder.cpp)).
> ⚠️ `CompactFields` **no longer exists** in JDK 25's `globals.hpp`.
> JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9.

**[08](08-the-object-header.md) gave the header its bytes and
[08b](08b-compact-object-headers.md) took some of them away. This page is what happens to
everything after the header: the eight-byte boundary every object is rounded up to, the field
reordering the JVM performs to waste as little of that padding as possible, and what both mean
for arrays. Padding you insert *deliberately*, to fix contention rather than to save space, is
[08c2 · False sharing and `@Contended`](08c2-false-sharing-and-contended.md).**

## Every object is a multiple of eight

HotSpot allocates objects at addresses that are multiples of **8 bytes**, and sizes them to
multiples of 8 bytes. An object whose header and fields come to 17 bytes occupies 24. Those
7 bytes are padding, and nothing will ever use them.

Two reasons the JVM does this, and both matter:

**Hardware.** Aligned loads and stores are faster, and on some architectures unaligned access is
a fault rather than a slowdown. A `long` field that straddles a cache line costs measurably more
to read.

**Pointer compression.** If every object address is a multiple of 8, the low three bits of every
address are always zero, so they need not be stored. That is precisely what compressed oops
exploit to address 32 GB of heap with 32-bit references —
[09 · Compressed oops](09-compressed-oops.md) has the argument, and
[09b](09b-alignment-and-class-pointers.md) has the case for widening the alignment to buy a
larger compressed heap, which is a trade rather than a free win.

🔴 **So alignment is not overhead the JVM tolerates; it is a property two other subsystems depend
on.** That is why `-XX:ObjectAlignmentInBytes` is not a knob you turn for footprint: raising it
increases padding on *every* object in the heap, and the documentation warns you may get nothing
back for it.

## The JVM reorders your fields

Declaration order in the source file has essentially no relationship to memory order.
`fieldLayoutBuilder.cpp` groups fields by size and packs them to minimise padding, generally
placing the widest first — `long` and `double`, then `int` and `float`, then `short` and `char`,
then `byte` and `boolean`, then references.

Consider a class declared in the pessimal order:

```java
class Pessimal {
    boolean flag;   // 1 byte
    long id;        // 8 bytes
    boolean other;  // 1 byte
    long stamp;     // 8 bytes
}
```

Laid out naively in declaration order, each `boolean` would force 7 bytes of padding before the
following `long` — 14 wasted bytes. The JVM instead places both `long` fields first and the two
`boolean` fields together afterwards, so the padding lands at the end, where the final round-up
to 8 bytes absorbs it anyway.

🔴 **The practical consequence: reordering your field declarations for "better packing" does
nothing.** This is advice inherited from C and C++, where declaration order *is* layout order,
and it does not transfer. If you find a code comment explaining that fields are ordered for
packing reasons, it is documenting a misconception rather than a discipline.

⚠️ **`-XX:+CompactFields` no longer exists in JDK 25.** It is absent from `globals.hpp` entirely.
Guides suggesting you toggle it are describing an older JVM, and since an unrecognised `-XX:`
option is fatal at launch on JDK 25, copying it from one fails the deployment rather than doing
nothing.

**What you can still control** is how many fields there are and how wide they are. A `long` where
an `int` suffices costs 4 bytes on every instance. A boxed `Integer` where an `int` suffices costs
a whole separate object — header, padding, and a reference to reach it — which is typically 16
bytes and a pointer chase to hold 4 bytes of information. Those choices matter far more than any
ordering ever could.

### One thing class structure does affect

**Superclass fields come first.** A subclass's fields are laid out after its superclass's, and
the JVM does not interleave them. So a deep hierarchy of classes each contributing one narrow
field can waste padding at every level that a single flat class would not — the packing is per
class in the chain, not global.

It is a rare problem, and it is the one case where class *structure*, rather than field order,
has a genuine layout cost. It shows up in framework base-class hierarchies more often than in
domain code, and [08d](08d-measuring-an-object.md) will show it immediately if you suspect it.

## Arrays: why `byte[1]` costs the same as `byte[8]`

From [08](08-the-object-header.md), an array header is the object header plus a 4-byte `int`
length: **16 bytes** in the default configuration, **12 bytes** with compact headers.

Apply the 8-byte rounding to a `byte[]`:

| Array | Header | Payload | Total before padding | **Actual size** |
|---|---|---|---|---|
| `byte[1]` | 16 | 1 | 17 | **24** |
| `byte[4]` | 16 | 4 | 20 | **24** |
| `byte[8]` | 16 | 8 | 24 | **24** |
| `byte[9]` | 16 | 9 | 25 | **32** |

*(Arithmetic from the documented header sizes and the 8-byte alignment rule, for the default
64-bit configuration with compressed class pointers. It is arithmetic, not a measurement — verify
any specific case with JOL, [08d](08d-measuring-an-object.md).)*

**Everything from `byte[1]` to `byte[8]` costs 24 bytes.** The payload is free until it crosses
the boundary; the header dominates completely.

🔴 **This is why an array of many small arrays is a completely different proposition from one
large array.** A thousand `byte[8]` arrays cost 24,000 bytes plus a thousand references to reach
them — for 8,000 bytes of data. One `byte[8000]` costs 8,016 bytes, rounded to 8,024. The same
data, roughly a third of the memory, one object instead of a thousand, and one contiguous run for
the hardware prefetcher instead of a thousand pointer-chases.

The same reasoning explains why collections of small objects are so much more expensive than the
data in them suggests. A `List<Integer>` of a thousand values is a thousand boxed objects plus an
array of references; an `int[1000]` is one object. **Flattening a structure — an array of
primitives instead of a collection of small wrappers — is one of the few memory optimisations
that reliably pays**, and it improves locality at the same time.

⚠️ It also has a cost, which is why it is not automatic: primitives cannot be null, cannot carry
behaviour, and cannot be used with the generic collection APIs. The optimisation is real and it is
a design trade, not a free win.

## Gotchas

**★ Object size is not the sum of the field sizes.**
Header, field reordering, alignment padding and — for arrays — the length word all intervene.
Arithmetic on paper is reliably wrong, which is exactly why JOL exists
([08d](08d-measuring-an-object.md)).

**★ Reordering field declarations for packing does nothing.**
`fieldLayoutBuilder.cpp` groups fields by size and packs them itself. This is C and C++ advice
that does not transfer to Java, and a comment in a codebase claiming otherwise is documenting a
misconception rather than a technique.

**★ `-XX:+CompactFields` no longer exists in JDK 25.**
It is absent from `globals.hpp`. Since unrecognised `-XX:` options are fatal at launch, copying it
from an old tuning guide fails the deployment rather than doing nothing.

**★ Everything from `byte[1]` to `byte[8]` costs 24 bytes.**
A 16-byte array header plus alignment. The payload is free until it crosses the boundary, which
is why many small arrays are so much more expensive than the data they hold.

**★ A thousand small arrays cost roughly three times one large one holding the same bytes.**
Per-array header plus per-array padding plus a reference each, against one header for the whole
thing. Flattening pays in memory and in locality simultaneously.

**★ Boxing costs an object, not a few bytes.**
An `Integer` is a header plus a 4-byte value padded to 16 bytes, plus the reference that reaches
it. A collection of a million boxed integers is roughly an order of magnitude larger than the
equivalent `int[]`, and every read is a pointer chase.

**★ Superclass fields are laid out before subclass fields, per class in the chain.**
A deep hierarchy each contributing one narrow field can waste padding at every level. It is the
one case where class structure, rather than field order, has a real layout cost.

**★ Alignment is what makes compressed oops possible, so it is not free to change.**
The low three bits of every address are zero *because* of 8-byte alignment, and that is what a
32-bit reference exploits. Widening alignment adds padding to every object in the heap in exchange
for addressing more of it — a trade worked through in
[09b](09b-alignment-and-class-pointers.md), never a pure win.

**★ The size depends on the JVM's configuration, not only on the class.**
Header mode, compressed class pointers and compressed oops all change the answer. Any stated size
for an object is incomplete without the configuration it was measured under, which is why
[08d](08d-measuring-an-object.md) reports both together.

## Interview questions

**★ Why is an object's size not the sum of its fields?**
Because of the header, field reordering and alignment. Every object is rounded up to a multiple of
8 bytes, the JVM packs fields by size rather than by declaration order, and arrays carry an
additional 4-byte length word. The only reliable way to answer "how big is this object" is to ask
the running JVM with JOL, because the answer also depends on header mode and whether compressed
oops are in use.

**★ Does declaring fields in a particular order improve memory layout in Java?**
No. `fieldLayoutBuilder.cpp` groups fields by width and packs them to minimise padding regardless
of source order. The intuition comes from C and C++, where declaration order is layout order. What
does help is having fewer and narrower fields — an `int` instead of a `long`, a primitive instead
of a boxed wrapper, which avoids an entire extra object.

**★ Why does `byte[1]` occupy the same memory as `byte[8]`?**
Because the array header is 16 bytes in the default 64-bit configuration — mark word, class word
and a 4-byte length — and objects are rounded to a multiple of 8. 16 + 1 rounds to 24, and so does
16 + 8. The payload is free until it crosses the next boundary, which is why collections of small
arrays cost so much more than the data they contain.

**★ Why does the JVM align objects to 8 bytes rather than packing them tightly?**
Partly for hardware reasons — aligned access is faster and, on some architectures, mandatory — and
partly because alignment is what makes compressed oops possible: if every address is a multiple of
8, the low three bits are always zero and need not be stored, which is how 32-bit references
address 32 GB of heap. Tight packing would save a few bytes per object and cost the entire
reference-compression scheme.

**★ Would you widen `-XX:ObjectAlignmentInBytes` to get a bigger compressed heap?**
Only with measurement, because it adds padding to every object in the heap and the documentation
itself warns you may gain nothing. It is the one JVM flag whose right answer genuinely differs per
application; the deciding factor is the heap's object size distribution, which has to be measured
rather than reasoned about. [09b](09b-alignment-and-class-pointers.md) works the trade through.

**★ A service holds ten million small records in a `List` of a small class. How would you reduce
its footprint?**
Attack the per-object overhead rather than the fields. Each record costs a 12- or 16-byte header
plus alignment padding plus a reference from the list's backing array, before any data. Options in
order: replace boxed fields with primitives; flatten the records into parallel primitive arrays or
a single `byte[]` with a fixed record layout, which removes ten million headers at once; and, if
the objects must stay, enable compact object headers ([08b](08b-compact-object-headers.md)) for
4 bytes each on average. Measure with JOL's `GraphLayout` before and after, because the retained
size, not the shallow size, is what matters here.

**★ How would you find out whether a class's layout is wasting padding?**
Run JOL's `ClassLayout` against it, which prints every field with its offset and marks the gaps
explicitly. Gaps in the middle usually mean a deep superclass chain, since packing happens per
class in the hierarchy; a gap at the end is the final round-up to 8 bytes and is unavoidable. The
answer is a measurement, not a reading of the source file, because the source order is not the
layout order.

{/* FOOTER */}
