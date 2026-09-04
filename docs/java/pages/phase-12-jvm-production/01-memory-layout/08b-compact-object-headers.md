---
title: "Compact object headers delete the class word by folding a 22-bit class reference into the mark word, taking every object's header from twelve or sixteen bytes to eight — a product feature in JDK 25 that you must ask for, the default in Release 27, and one that silently turns itself off if you also ask for legacy locking"
sidebar_label: "08b · Compact object headers"
sidebar_position: 31
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against **JEP 519 "Compact Object Headers"** (Release 25,
> `Closed/Delivered`) and **JEP 534 "Compact Object Headers by Default"** (Release 27,
> `Closed/Delivered`), and **JEP 450** for the size figures
> ([openjdk.org](https://openjdk.org/jeps/519)), the **JDK 25 `java` tool reference** for
> `-XX:+UseCompactObjectHeaders`
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html)),
> and the JDK 25 HotSpot source at tag `jdk-25+36` — `src/hotspot/share/oops/markWord.hpp` for
> the layout comment and `klass_bits`, `src/hotspot/share/oops/arrayOop.hpp` for the array length
> placement, and `globals.hpp` for the flag's `product` declaration
> ([github.com/openjdk/jdk](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/oops/markWord.hpp)).
> JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9.

**[08](08-the-object-header.md) described the header as a mark word plus a class word. Compact
object headers delete the second one: the class reference is folded into the mark word, and the
header becomes a single 8-byte word. This page is that layout in full — which field lost what,
what the 22-bit class pointer costs, what happens to arrays, and the two ways the flag can fail
to take effect.
[09c](09c-class-pointers-and-compact-headers.md) covers how the saving interacts with alignment
and why two published figures for it disagree.**

## The two layouts, side by side

`markWord.hpp`'s own layout comment, which is the authoritative statement for JDK 25:

```text
//  64 bits:
//  --------
//  unused:22 hash:31 -->| unused_gap:4  age:4  self-fwd:1  lock:2 (normal object)
//
//  64 bits (with compact headers):
//  -------------------------------
//  klass:22  hash:31 -->| unused_gap:4  age:4  self-fwd:1  lock:2 (normal object)
```

🔴 **Read the two rows against each other and the entire feature is visible in one field.** The
legacy layout wastes 22 bits at the top of the mark word — the comment literally calls them
`unused:22`. The compact layout puts the class reference there. Everything else is byte-for-byte
identical: the same 31-bit hash, the same 4-bit Valhalla gap, the same 4-bit age, the same
self-forwarding bit, the same 2-bit lock tag.

So compact object headers are not a redesign. **They are the JVM finally spending 22 bits it had
already reserved and never used**, and in exchange deleting the separate class word entirely.

| Configuration | Mark word | Class word | Header |
|---|---|---|---|
| 64-bit, compressed class pointers (the default) | 8 bytes | 4 bytes | **12 bytes** |
| 64-bit, `-XX:-UseCompressedClassPointers` | 8 bytes | 8 bytes | **16 bytes** |
| 64-bit, `-XX:+UseCompactObjectHeaders` | 8 bytes, class folded in | **none** | **8 bytes** |

The size figures come from **JEP 450**, not from JEP 519 — *"between 96 bits (12 bytes) and 128
bits (16 bytes)"* down to *"64 bits (8 bytes) on the target 64-bit platforms (x64 and
AArch64)"*. JEP 519's contribution was promoting the feature to product status, not measuring it.

## What a 22-bit class pointer means

`markWord.hpp` sets `klass_bits = 22` for the compact layout. Twenty-two bits of class index is
roughly four million distinct classes — comfortably beyond any real application, so the width is
not a practical constraint on class count.

What it *is* is a constraint on the class metadata region. A 22-bit encoded reference addresses a
correspondingly bounded compressed class space, which is why the feature has a hard dependency
that surprises people:

🔴 **Compact object headers require compressed class pointers.** The class reference in the mark
word *is* a compressed class pointer, narrowed from 32 bits to 22. Without compressed class
pointers there is nothing to fold in.

That dependency is why `UseCompressedClassPointers` is **deprecated in JDK 25 and obsolete in
26** ([04b](04b-the-metaspace-flags.md)): a flag that disables something the future default
layout requires cannot survive the future default. The two changes are one plan.

## Arrays lose a word too, and the length moves

An array header is the object header plus a 4-byte `int` length ([08](08-the-object-header.md)).
Under compact headers the length has to go somewhere different, and `arrayOop.hpp` says where:

> *"The `_length` field … is allocated after the mark-word when using compact headers … otherwise
> after the compressed `Klass*`."*

So the array header goes from 16 bytes (mark 8 + klass 4 + length 4) to 12 bytes (mark 8 +
length 4) — and then alignment has its say, which [08c](08c-alignment-and-padding.md) covers.

**This is the case where the saving is largest in relative terms**, because collections of small
arrays are header-dominated. A `byte[4]` under the default layout is mostly header; under compact
headers it is meaningfully less so.

## Product, not default — and the JEP says so on purpose

JEP 519 is `Type: Feature`, `Release 25`, `Status Closed/Delivered`, and its summary is precise:
*"Change compact object headers from an experimental feature to a product feature."*

🔴 **Its Non-Goals are explicit: *"It is not a goal to make compact object headers be the default
object-header layout."*** So "product" does not mean "on". `globals.hpp` agrees —
`product(bool, UseCompactObjectHeaders, false, ...)`, a plain `product`, not `experimental`.

Two practical consequences:

**No unlock flag is needed any more.** JEP 519: *"The first option,
`-XX:+UnlockExperimentalVMOptions`, will no longer be needed once they are a product feature."*
Any instruction that pairs `-XX:+UnlockExperimentalVMOptions` with
`-XX:+UseCompactObjectHeaders` is written for JDK 24 or earlier. It will still work — the unlock
flag is harmless — but it signals a stale source.

**"Eventually" has a version.** 🔴 **JEP 534 · Compact Object Headers by Default is
`Closed/Delivered` for Release 27.** The man page's *"eventually will be the only mode of
operation"* is not vague futurology: **JDK 25 asks, JDK 27 defaults.** That is the single most
useful fact for deciding what to do about it now — see below.

## The two ways the flag fails to take effect

🔴 **It silently disables itself under legacy locking.** JEP 519: *"compact object headers are not
compatible with legacy locking. If the JVM is configured to run with both … compact object headers
are disabled."*

There is no error and no warning. A JVM started with `-XX:LockingMode=1` and
`-XX:+UseCompactObjectHeaders` gets neither, and everything appears to work — because everything
does work, just with 12-byte headers you believed were 8. `LockingMode` defaults to
`LM_LIGHTWEIGHT`, so this bites only where somebody deliberately set legacy locking, which is
usually an inherited flag nobody re-examined. ⚠️ `LM_MONITOR` and `LM_LEGACY` are both marked
*(Deprecated)* in JDK 25 and `LockingMode` is obsolete in 26, so this conflict has a limited
lifespan — but so does any startup script that still carries the flag.

**It requires compressed class pointers**, as above. Disable those and the feature cannot apply.

**The lesson is the same in both cases: verify, do not assume.** The flag being accepted at
launch is not evidence that the layout changed.
[09d · Verifying what the JVM chose](09d-verifying-what-the-jvm-chose.md) is the page for that,
and [08d · Measuring an object](08d-measuring-an-object.md) is the direct measurement — JOL will
report an 8-byte header or it will not, which settles the question in one command.

## Should you turn it on

The honest position for JDK 25, given that Release 27 makes it the default:

**Yes, for a memory-constrained service with many small objects**, after measuring. The man page
puts the average saving at *"4 bytes per object (on average)"* and adds that it *"often improves
performance"* — the second effect comes from better cache density, not from the allocation path.
A heap dominated by small objects and small arrays sees the most; a heap dominated by large
arrays and long strings sees very little, because the header is a smaller fraction of each object.

**Yes, as forward preparation.** Whatever you run on today, the layout becomes the default in
Release 27. Testing under it now converts a future default-change surprise into a decision you
already made. Anything that breaks under it — native code assuming a header offset, an agent
reading the class word directly, a serialisation trick — is better discovered on your schedule.

**Not blindly, and not without verifying it took effect.** The silent downgrade above means "we
set the flag" and "we are running compact headers" are different claims.

⚠️ **The realised saving is smaller than the theoretical one**, because alignment absorbs part of
it. [09c](09c-class-pointers-and-compact-headers.md) has that arithmetic; the short version is
that roughly half the theoretical saving survives padding on an average heap.

## Gotchas

**★ "Product feature" does not mean "default".**
JEP 519 promoted compact object headers out of experimental in JDK 25 and states in its own
Non-Goals that *"It is not a goal to make compact object headers be the default object-header
layout."* You still have to ask for it with `-XX:+UseCompactObjectHeaders`.

**★ The unlock flag is no longer needed, and its presence dates the instructions.**
JEP 519 says `-XX:+UnlockExperimentalVMOptions` *"will no longer be needed once they are a product
feature"*. Any guide pairing the two flags was written for JDK 24 or earlier.

**★ It silently disables itself under legacy locking.**
`-XX:LockingMode=1` plus `-XX:+UseCompactObjectHeaders` gives you neither a warning nor compact
headers. Nothing fails; you simply do not get the feature you configured. Verify with JOL rather
than trusting the command line.

**★ It requires compressed class pointers, which is why that flag is being removed.**
The folded class reference *is* a compressed class pointer, narrowed to 22 bits.
`UseCompressedClassPointers` is deprecated in JDK 25 and obsolete in 26 precisely because the
future default layout depends on it.

**★ The size numbers belong to JEP 450, not JEP 519.**
96–128 bits down to 64 bits is JEP 450's measurement. JEP 519 is the status change. Citing 519
for the sizes is a small error that gives away second-hand sourcing.

**★ The mark word did not gain a field — it spent one it already had.**
The legacy 64-bit layout carries `unused:22`. Compact headers put the class reference there. Every
other field is identical between the layouts, which is why the change is so contained.

**★ Array headers shrink and the length field moves.**
`arrayOop.hpp`: the `_length` field goes after the mark word under compact headers and after the
compressed `Klass*` otherwise. Native code or an agent that computes the length offset from a
hard-coded header size breaks.

**★ The saving is per object, so it is largest where objects are smallest.**
Four bytes off a 16-byte object is a quarter; off a 4 KB object it is nothing. Heaps full of small
domain objects and small arrays benefit; heaps full of large buffers barely notice.

**★ Half the theoretical saving disappears into alignment.**
The header shrinks by 4 to 8 bytes, but objects are padded to an 8-byte boundary anyway, so only
objects whose size crosses a boundary actually get smaller. The man page's *"4 bytes per object
(on average)"* is the realised figure, not the structural one.

**★ Release 27 makes it the default, which changes the risk calculus today.**
This is not an optional optimisation you can ignore indefinitely. JEP 534 is `Closed/Delivered`
for Release 27, so the choice is between testing under it now or meeting it in an upgrade.

## Interview questions

**★ What are compact object headers, and what do they change?**
They fold the class reference into the mark word so the separate class word disappears, taking the
object header from 12 or 16 bytes down to 8. The mechanism is visible in `markWord.hpp`: the
legacy 64-bit layout has `unused:22` at the top, and the compact layout has `klass:22` in exactly
that position. Every other field — hash, Valhalla gap, age, self-forwarding bit, lock tag — is
unchanged.

**★ Are they on by default in JDK 25?**
No. JEP 519 made them a *product* feature in JDK 25, which means no experimental unlock flag is
needed, but the JEP's Non-Goals say explicitly that becoming the default layout is not a goal for
that release. `globals.hpp` declares `UseCompactObjectHeaders` as `product` and `false`. JEP 534,
`Closed/Delivered` for Release 27, is what makes them the default.

**★ Why does the feature require compressed class pointers?**
Because the thing folded into the mark word *is* a compressed class pointer, narrowed from 32 bits
to 22. With full 64-bit class pointers there is nothing that fits in the 22 spare bits. That
dependency is also why `UseCompressedClassPointers` is deprecated in JDK 25 and obsolete in 26 —
a flag that turns off a prerequisite of the future default layout cannot be kept.

**★ You set `-XX:+UseCompactObjectHeaders` and JOL still reports a 12-byte header. What
happened?**
Most likely the JVM is also configured for legacy locking. JEP 519 states that compact object
headers are not compatible with legacy locking and that the JVM disables them when both are
configured — with no warning. Check for `-XX:LockingMode=1` in the startup flags, and check that
compressed class pointers are enabled. The general lesson is that a flag being accepted is not
evidence that it took effect.

**★ How much memory does it actually save?**
The man page says *"4 bytes per object (on average)"*, against a structural saving of 4 to 8
bytes. The gap is alignment: objects are padded to an 8-byte boundary, so a smaller header only
reduces the object's footprint when it moves the total across a boundary. The benefit is
concentrated in heaps with many small objects, and there is often a secondary performance gain
from improved cache density.

**★ What happens to arrays?**
The header shrinks the same way, and the length field moves. `arrayOop.hpp` states that `_length`
is allocated after the mark word when using compact headers and after the compressed `Klass*`
otherwise. Arrays benefit disproportionately when they are small, because the header is a larger
fraction of a small array's footprint.

**★ Would you enable it on a production service running JDK 25?**
For a memory-constrained service with many small objects, yes — after measuring with JOL that it
actually took effect, and after a load test, since the performance effect comes from cache density
and is workload-dependent. There is also a forward-looking argument independent of the saving:
JEP 534 makes it the default in Release 27, so testing under it now turns a future upgrade
surprise into a decision made deliberately.

**★ What could break under compact headers?**
Anything that assumes a fixed header size or field offset from outside the Java language: native
code using JNI or FFM with hard-coded offsets, JVMTI agents or profilers reading the class word
directly, and tools computing array element addresses from a presumed header layout. Ordinary Java
code cannot observe the header at all, which is why the change is safe for the overwhelming
majority of applications and worth explicitly testing for the rest.

{/* FOOTER */}
