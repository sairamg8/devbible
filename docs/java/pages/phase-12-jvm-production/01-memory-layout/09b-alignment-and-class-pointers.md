---
title: "You can buy a compressed heap larger than 32 GB by widening object alignment, but the documentation warns in its own note that you may get nothing for it — and the compression of class pointers is a second mechanism that people keep mistaking for the first"
sidebar_label: "09b · Alignment and class pointers"
sidebar_position: 63
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the **JDK 25 `java` tool reference**
> ([docs.oracle.com/en/java/javase/25/docs/specs/man/java.html](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html)) —
> the entries for `-XX:ObjectAlignmentInBytes` and `-XX:+UseCompactObjectHeaders`, both
> quoted verbatim below — and **JEP 519 · Compact Object Headers** (product in JDK 25).
> JDK 25 · Spring Boot 4.1.0.
> **No sandbox** — flags, quoted documentation and arithmetic only. No captured JVM output.

**[09](09-compressed-oops.md) explained why the cliff exists. This chunk is about what you
can do at the edge of it: the one documented lever that moves the boundary, and the second
compression that travels with the first and is constantly confused with it. Both are places
where the obvious expectation — bigger compressed heap must be better; these are the same
feature — is wrong, and the documentation says so in its own words.**

Once you have decided what to set, [09c · Verifying what the JVM chose](09c-verifying-what-the-jvm-chose.md)
is how you confirm the JVM did what you intended, which on this subject is never safe to
assume.

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

## Compressed class pointers: the second compression with a similar name

Two different compressions travel together and are constantly confused:

- **Compressed oops** (`-XX:+UseCompressedOops`) compress *references in the heap* — object
  fields and array elements.
- **Compressed class pointers** (`-XX:+UseCompressedClassPointers`) compress the *class word
  in the object header*, from 8 bytes to 4, by placing class metadata in a bounded region —
  the **compressed class space** — carved out of metaspace.

The class word is in *every object*, so this saves 4 bytes per object across the whole heap,
independently of how many references those objects contain. It is why disabling compressed
oops hurts twice: the class pointers go with them, so a primitive-heavy heap that "should
not care" about compressed oops still pays 4 bytes per object when compression is lost.

### The compressed class space is its own exhaustion path

The compressed class space is a **reserved region with its own size limit**, distinct from
metaspace at large. That is why `OutOfMemoryError` has a separate `Compressed class space`
message: an application that generates enormous numbers of classes — heavy proxying, script
compilation, repeated redeploys leaking classloaders — can exhaust the class space while
metaspace still has room.

The three symptoms are worth telling apart, because they have different fixes:

| Message | Region | Usual cause |
|---|---|---|
| `Metaspace` | Metaspace at large | Class metadata growth; classloader leak |
| `Compressed class space` | The bounded class-pointer region | Very large class count, or too small a `CompressedClassSpaceSize` |
| `Java heap space` | The heap | Live set exceeds `-Xmx` |

[Topic 04 · `OutOfMemoryError`](../04-out-of-memory-error/_plan.md) owns the full set of
messages; [04 · Metaspace](04-metaspace.md) owns the region itself.

⚠️ **Check the current defaults on JDK 25 before setting `-XX:CompressedClassSpaceSize`.**
Its sizing interacts with `MaxMetaspaceSize` and with whether compressed class pointers are
enabled at all, and that interaction has changed across releases. Read the values off the
JDK you are actually running — [09c](09c-verifying-what-the-jvm-chose.md) shows how.

## Where compact object headers fit — and why two published numbers disagree

JEP 519's compact object headers shrink the header itself, and are a **different saving from
compressed oops**: headers versus fields. They compose. Compact headers reduce the fixed
per-object overhead; compressed oops reduce the per-reference cost inside it.

The interaction worth understanding is with **alignment**, because it explains why the two
numbers you will see quoted look inconsistent:

- **JEP 519** describes the header shrinking from **96–128 bits down to 64 bits** — that is
  4 to 8 bytes of header removed.
- The **`java` tool reference** describes the realised saving as *"4 bytes per object (on
  average)"*.

Both are correct, and the gap between them is alignment. A theoretical 8-byte header saving
on an object that is padded up to the next 8-byte boundary anyway gives back nothing; only
objects whose size crosses a boundary actually shrink. Averaged over a real heap, roughly
half the theoretical saving survives padding.

The tool reference is also unusually forward-looking about the option's future, which is
worth quoting because it tells you how to treat it today:

> *"Enables compact object headers. By default, this option is disabled. Enabling this option
> reduces memory footprint in the Java heap by 4 bytes per object (on average) and often
> improves performance.*
>
> *The feature remains disabled by default while it continues to be evaluated. In a future
> release it is expected to be enabled by default, and eventually will be the only mode of
> operation."*
> — JDK 25 `java` tool reference, `-XX:+UseCompactObjectHeaders`

🔴 **Product, but not default.** JEP 519 promoted it out of experimental in JDK 25, so it is
a supported option rather than a curiosity — but you still have to ask for it.
[08b · Compact object headers](08b-compact-object-headers.md) owns the header layout in full.

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

**★ Disabling compressed oops disables compressed class pointers too.** You lose 4 bytes per
reference *and* 4 bytes per object header. People budget for the first and are surprised by
the second — and the second hits even the workloads that were supposed to be indifferent.

**★ `Compressed class space` is a different `OutOfMemoryError` from `Metaspace`.** They have
different regions, different limits and different fixes. Raising `MaxMetaspaceSize` does not
help a class-space exhaustion, and neither does raising `-Xmx`. Read the message.

**★ Compact object headers save less than the JEP's header numbers suggest.** The JEP's
96–128 → 64 bits is the header; the tool reference's *"4 bytes per object (on average)"* is
what survives alignment padding. Quoting the first number as the heap saving overstates it,
often by half.

**★ Compact object headers are product but still off by default on JDK 25.** "It's a product
feature in 25" does not mean it is on. The tool reference is explicit — *"By default, this
option is disabled"* — and equally explicit that this is temporary: *"eventually will be the
only mode of operation."* Plan for the change; do not assume it has happened.

**★ Compact headers and a widened alignment fight each other.** Compact headers save bytes
that alignment then rounds back up. At 16-byte alignment a large fraction of the header
saving disappears into padding. If you are setting both, the combination needs measuring —
the two savings do not simply add.

**★ An article's number for `CompressedClassSpaceSize` is not your JVM's number.** These
defaults have moved across releases and are affected by other flags, including whether
compressed class pointers are enabled at all. Read them off the JDK you are running.

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

**★ What is the difference between compressed oops and compressed class pointers?**
Compressed oops compress references *in the heap* — object fields and array elements.
Compressed class pointers compress the *class word in the object header* from 8 bytes to 4,
by placing class metadata in a bounded region called the compressed class space, carved out
of metaspace. They are separate mechanisms that are enabled and disabled together in
practice, which is why turning off compressed oops costs you twice: 4 bytes per reference
and another 4 bytes per object. It is also why a primitive-heavy heap, which "should not
care" about compressed oops, still pays something when compression is lost.

**★ A service dies with `OutOfMemoryError: Compressed class space`. What is your first move,
and what is definitely not the fix?**
The first move is to read the message rather than the word "OutOfMemoryError", because it
names a specific bounded region: the compressed class space inside metaspace, which holds
class metadata addressed by compressed class pointers. Definitely not the fix: raising
`-Xmx`, which sizes the heap and is unrelated, or raising `MaxMetaspaceSize`, which sizes a
different region. The real causes are an enormous number of loaded classes — heavy dynamic
proxying, generated classes, script compilation — or a classloader leak keeping dead classes
alive, or simply a `CompressedClassSpaceSize` too small for a legitimately class-heavy
application. You distinguish a leak from legitimate growth by watching whether the
loaded-class count ever comes down.

**★ Compact object headers are a product feature in JDK 25. Should you turn them on?**
Probably worth testing, and definitely worth understanding, but the answer is "measure".
The documentation says it *"reduces memory footprint in the Java heap by 4 bytes per object
(on average) and often improves performance"*, and also that it *"remains disabled by default
while it continues to be evaluated"* and that *"eventually will be the only mode of
operation"*. So the direction of travel is clear, and the risk is mostly in tooling and in
any code that assumes a header layout. The gain is largest for heaps of many small objects
and negligible for heaps of few large ones — the same shape of argument as compressed oops.

**★ Why do JEP 519 and the `java` tool reference quote different savings for the same
feature?**
Because they measure different things. The JEP measures the header, which goes from 96–128
bits to 64 — 4 to 8 bytes. The tool reference measures the realised heap saving, *"4 bytes
per object (on average)"*, which is what remains after object alignment rounds sizes back up
to a multiple of 8. An object that would have shrunk by 8 bytes but was going to be padded to
the same size anyway saves nothing. Roughly half the theoretical saving survives, which is
exactly the gap between the two numbers.

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

{/* FOOTER */}
