---
title: "You can buy a compressed heap larger than 32 GB by widening object alignment, and the documentation warns in its own note that you may get nothing for it — the one JVM flag whose right answer genuinely differs per application"
sidebar_label: "09b · Widening object alignment"
sidebar_position: 36
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the **JDK 25 `java` tool reference**
> ([docs.oracle.com/en/java/javase/25/docs/specs/man/java.html](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html)) —
> the entries for `-XX:ObjectAlignmentInBytes` and `-XX:+UseCompactObjectHeaders`, both
> quoted verbatim below — and **JEP 519 · Compact Object Headers** (product in JDK 25).
> JDK 25 · Spring Boot 4.1.0.
> **No sandbox** — flags, quoted documentation and arithmetic only. No captured JVM output.

**[09](09-compressed-oops.md) explained why the cliff exists. This chunk is about the one
documented lever that moves it — widening object alignment — and about why the obvious
expectation, that a bigger compressed heap must be better, is wrong often enough that the
documentation warns about it in its own note.**

The *other* compression, the one that travels with compressed oops and is constantly mistaken
for it, is in [09c · Class pointers and compact headers](09c-class-pointers-and-compact-headers.md).
Once you have decided what to set,
[09d · Verifying what the JVM chose](09d-verifying-what-the-jvm-chose.md) is how you confirm the
JVM did what you intended, which on this subject is never safe to assume.

## Buying a bigger compressed heap with `ObjectAlignmentInBytes`

If you genuinely need more than 32 GB and want to keep compression, there is a documented
lever. Increase the alignment and you increase the number of bytes each index step covers:

> *"Sets the memory alignment of Java objects (in bytes). By default, the value is set to 8
> bytes. The specified value should be a power of 2, and must be within the range of 8 and
> 256 (inclusive). This option makes it possible to use compressed pointers with large Java
> heap sizes.*
>
> *The heap size limit in bytes is calculated as:*
>
> *`4GB * ObjectAlignmentInBytes`*
>
> ***Note:** As the alignment value increases, the unused space between objects also
> increases. As a result, you may not realize any benefits from using compressed pointers
> with large Java heap sizes."*
> — JDK 25 `java` tool reference, `-XX:ObjectAlignmentInBytes`

The formula is exact and easy to apply:

| `ObjectAlignmentInBytes` | Shift | Heap limit |
|---|---|---|
| 8 (default) | 3 | 32 GB |
| 16 | 4 | 64 GB |
| 32 | 5 | 128 GB |
| 64 | 6 | 256 GB |
| 128 | 7 | 512 GB |
| 256 (max) | 8 | 1024 GB |

### What it costs, worked through

The documentation's own note is the catch, stated plainly: **you pay for the bigger range in
padding on every single object.** At 16-byte alignment, every object's size is rounded up to
a multiple of 16 rather than 8. Work an example:

| Object's real size | Padded at 8-byte alignment | Padded at 16-byte alignment | Waste |
|---|---|---|---|
| 16 bytes | 16 | 16 | 0 |
| 24 bytes | 24 | 32 | 8 bytes (33%) |
| 32 bytes | 32 | 32 | 0 |
| 40 bytes | 40 | 48 | 8 bytes (20%) |

Half the size classes are unaffected and half lose 8 bytes. Averaged over a heap of small
objects, 16-byte alignment costs on the order of **a few percent of the heap in gaps that
hold nothing**. You spent that to save 4 bytes per reference.

So the trade is: **padding on every object, in exchange for 4 bytes on every reference.**
Whether it wins depends entirely on the ratio of references to object count in your heap —
which is to say, on how reference-dense your objects are.

- A heap of small linked nodes (`HashMap.Node`, tree nodes, domain graphs) has several
  references per object. Compression is worth much more than the padding. The lever wins.
- A heap of large primitive payloads (`byte[]`, `long[]`) has almost no references relative
  to its size. Compression buys nearly nothing and the padding is pure loss. The lever
  loses, and you should simply cross the boundary uncompressed.

🔴 **This is a measure-it decision, not a default-it decision.** It is one of the very few
JVM flags where the right answer genuinely differs per application, and the documentation's
own note exists because the naive expectation is frequently wrong.

Two more consequences are easy to overlook. The flag changes **object layout**, so anything
built or captured under one alignment is not comparable to — or in some cases usable with —
anything built under another: heap dumps, CDS and AOT archives, and benchmark baselines all
inherit the alignment they were made at. And because it applies to *every* object, it
interacts with compact object headers below: a header saving that alignment rounds back up
is a saving you did not get.

## Gotchas

**★ `ObjectAlignmentInBytes` is not free space.** Every object is padded up to the new
multiple. The documentation's own note warns that *"you may not realize any benefits"* —
treat 16-byte alignment as a measured experiment, never as a default. Roughly half of all
size classes lose 8 bytes each when you go from 8 to 16.

**★ `ObjectAlignmentInBytes` must be identical everywhere a heap is shared or compared.**
It changes object layout. A heap dump, a CDS or AOT archive, or a benchmark taken at one
alignment is not comparable to one taken at another, and an archive created under one
alignment is not usable under a different one.

**★ Raising alignment to reach a big heap is exactly backwards for primitive-heavy
workloads.** They gain almost nothing from compressed references and pay the full padding
cost. If your heap is mostly large arrays, cross the boundary uncompressed instead.

**★ Alignment applies to arrays too, and that is where it hurts most.** Every array is padded
to the same boundary, so a heap of many small arrays — `byte[16]` chunks, short `Object[]` nodes —
loses the padding on each one. Costing the change on your objects alone understates it.

**★ Widening alignment on a heap under 32 GB buys nothing at all.** The flag only exists to move
the compressed-oops ceiling. Below the ceiling there is nothing to move, so all you have bought is
padding. Check the heap size before the flag.

## Interview questions

**★ How would you keep compressed oops on a 60 GB heap, and what does it cost?**
Set `-XX:ObjectAlignmentInBytes=16`. The documented heap limit is
`4GB × ObjectAlignmentInBytes`, so 16-byte alignment covers 64 GB. The cost is padding:
every object's size is now rounded up to a multiple of 16 instead of 8, so about half of all
size classes lose 8 bytes each and the gaps between objects grow by a few percent of the
heap. The tool reference warns about exactly this — *"you may not realize any benefits from
using compressed pointers with large Java heap sizes"*. Whether it wins depends on how
reference-dense the objects are, so it must be measured. It also has to be set identically
anywhere a heap dump, CDS archive or benchmark is compared, because it changes layout.

**★ You inherit a service running `-Xmx36g -XX:ObjectAlignmentInBytes=16`. Critique it.**
The alignment flag is doing real work here: without it, 36 GB would be over the 32 GB
compressed-oops ceiling and compression would be off entirely. With 16-byte alignment the
limit is 64 GB, so compression survives. So the combination is coherent rather than
cargo-culted, which is already unusual. The question is whether it was measured: the heap is
only 4 GB past the boundary, so the alternative — dropping to 31 GB with default alignment
and no padding penalty — may well hold more live data. I would compare live-set-after-full-GC
between the two configurations before keeping it, and I would check whether anything in the
pipeline (a CDS archive, a stored heap dump baseline, a benchmark harness) was built under
the default alignment, because those are not comparable across the change.

**★ Someone proposes enabling compact object headers *and* raising alignment to 16 to "get
both savings". What do you say?**
That the two do not add, and may substantially cancel. Compact headers remove 4–8 bytes from
each object's header; alignment then rounds each object's total size up to the next multiple
of 16, which reclaims much of what the header gave back. The combination is not wrong, but
its benefit is entirely empirical and could easily be worse than either alone. I would also
ask what the alignment is *for* — if the heap is under 32 GB, raising alignment buys nothing
at all, since compression was never in danger, and is pure padding cost.

**★ Why is `ObjectAlignmentInBytes` capped at 256, and what does the cap imply?**
Because the compressed-oop shift is what alignment buys you, and the documented heap limit is
`4GB × ObjectAlignmentInBytes` — 256 gives a shift of 8 and a 1 TB ceiling. The implication is
that compressed oops simply do not reach past about a terabyte no matter what you set, so above
that the question does not arise and you run uncompressed. In practice the padding cost makes
anything past 16 or 32 hard to justify long before you reach the cap.

**★ You raise alignment to 16 and the heap gets *bigger*, not smaller. Explain.**
Because you paid the padding immediately and the saving is conditional. Every object is now
rounded up to a multiple of 16, which costs roughly half of all size classes 8 bytes each, while
the 4-bytes-per-reference saving only materialises if the objects are reference-dense. On a heap
of large primitive arrays there are almost no references to compress, so you took the whole cost
and got none of the benefit — which is precisely the case the documentation's own note warns
about when it says you "may not realize any benefits".

{/* FOOTER */}

**★ Why is `ObjectAlignmentInBytes` capped at 256, and what does the cap imply?**
Because the compressed-oop shift is what alignment buys you, and the documented heap limit is
`4GB × ObjectAlignmentInBytes` — 256 gives a shift of 8 and a 1 TB ceiling. The implication is
that compressed oops simply do not reach past about a terabyte no matter what you set, so above
that the question does not arise and you run uncompressed. In practice the padding cost makes
anything past 16 or 32 hard to justify long before you reach the cap.

**★ You raise alignment to 16 and the heap gets *bigger*, not smaller. Explain.**
Because you paid the padding immediately and the saving is conditional. Every object is now
rounded up to a multiple of 16, which costs roughly half of all size classes 8 bytes each, while
the 4-bytes-per-reference saving only materialises if the objects are reference-dense. On a heap
of large primitive arrays there are almost no references to compress, so you took the whole cost
and got none of the benefit — which is precisely the case the documentation's own note warns
about when it says you "may not realize any benefits".

{/* FOOTER */}
