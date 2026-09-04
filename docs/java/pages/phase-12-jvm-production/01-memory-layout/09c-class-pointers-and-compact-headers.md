---
title: "Compressed class pointers are a second, separate compression that shrinks the header's class word rather than the heap's references — and on JDK 25 the flag controlling them is already deprecated, because compact object headers are coming and they require it"
sidebar_label: "09c · Class pointers and compact headers"
sidebar_position: 37
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against **JEP 519 · Compact Object Headers** (product in JDK 25) and
> **JEP 534 · Compact Object Headers by Default** (`Closed/Delivered`, Release 27), the size
> numbers in **JEP 450**, the **JDK 25 `java` tool reference**
> ([docs.oracle.com/en/java/javase/25/docs/specs/man/java.html](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html)),
> and **HotSpot source at tag `jdk-25+36`** — `globals.hpp` for `CompressedClassSpaceSize` and
> `UseCompactObjectHeaders`, and `arguments.cpp`'s `special_jvm_flags[]` for the
> `UseCompressedClassPointers` deprecation. JDK 25 · Spring Boot 4.1.1.
> ⚠️ **`CompressedClassSpaceSize` and the deprecation are NOT in the `java` man page** — the flag
> does not appear in it at all. Both come from the source.
> **No sandbox** — flags, quoted documentation and source. No captured JVM output.

**[09b](09b-alignment-and-class-pointers.md) covered the lever that moves the compressed-oops
boundary. This chunk is about the compression people keep confusing with compressed oops: the one
that shrinks the *class word in every object header* rather than the references in the heap. It
matters more than its footnote status suggests, because it is the mechanism compact object headers
are built on — and because the flag that controls it is already on its way out.**

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

[Topic 04 · `OutOfMemoryError`](../04-out-of-memory-error/README.md) owns the full set of
messages; [04 · Metaspace](04-metaspace.md) owns the region itself.

**`-XX:CompressedClassSpaceSize` defaults to 1 GB**, and you will not find that in the `java`
man page — the flag does not appear in it at all. It is in the HotSpot source:

```cpp
product(size_t, CompressedClassSpaceSize, 1*G,
        "Maximum size of class area in Metaspace when compressed class pointers are used")
        range(1*M, LP64_ONLY(4*G) NOT_LP64(max_uintx))
```

⚠️ Its sizing interacts with `MaxMetaspaceSize`, and the interaction has changed across releases.
Read the value off the JDK you are actually running — [09d](09d-verifying-what-the-jvm-chose.md)
shows how — rather than trusting any published figure, this one included.

### 🔴 `UseCompressedClassPointers` is deprecated in JDK 25 and obsolete in 26

This changes the practical advice, so it is worth being precise. From `arguments.cpp`'s
`special_jvm_flags[]` table:

```cpp
{ "UseCompressedClassPointers", JDK_Version::jdk(25), JDK_Version::jdk(26), JDK_Version::undefined() },
```

and `globals.hpp` now labels the flag itself *"(Deprecated) Use 32-bit class pointers in 64-bit
VM."* So on **JDK 25, `-XX:-UseCompressedClassPointers` warns**; on **JDK 26 it becomes obsolete**.

🔴 **Any advice that tells you to turn compressed class pointers off is documenting a flag with a
one-release life.** The direction of travel is that compressed class pointers stop being optional
— which is consistent with compact object headers below, since those *require* them.

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

🔴 **Product, but not default — and now with a version attached to "eventually".** JEP 519
promoted the feature out of experimental in JDK 25, and is explicit in its own Non-Goals that
*"It is not a goal to make compact object headers be the default object-header layout"*. It also
confirms the unlock flag is gone: *"The first option, `-XX:+UnlockExperimentalVMOptions`, will no
longer be needed once they are a product feature."* `globals.hpp` agrees —
`product(bool, UseCompactObjectHeaders, false, ...)`, a plain `product`, not `experimental`.

🔴 **The successor JEP exists: JEP 534 · Compact Object Headers by Default is
`Closed/Delivered` for Release 27.** So the man page's *"eventually will be the only mode of
operation"* is not vague futurology — **JDK 25 asks, JDK 27 defaults.** Two more things worth
knowing before you enable it:

- It **requires compressed class pointers**, and shrinks them from 32 bits to **22**.
- 🔴 **It silently disables itself under legacy locking.** The JEP: *"compact object headers are
  not compatible with legacy locking. If the JVM is configured to run with both … compact object
  headers are disabled."* So a JVM running `-XX:LockingMode=1` plus `-XX:+UseCompactObjectHeaders`
  gets neither a warning nor compact headers — verify with
  [09d](09d-verifying-what-the-jvm-chose.md) rather than assuming the flag took.

⚠️ The **size numbers belong to JEP 450, not JEP 519** — *"between 96 bits (12 bytes) and 128 bits
(16 bytes)"* down to *"64 bits (8 bytes) on the target 64-bit platforms (x64 and AArch64)"*.
[08b · Compact object headers](08b-compact-object-headers.md) owns the header layout in full.

## Gotchas

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
option is disabled"* — and JEP 519 lists making it the default as an explicit **non-goal**.
The change has a version: **JEP 534, Release 27.** Plan for it; do not assume it has happened.

**★ Compact object headers turn themselves off under legacy locking, without telling you.**
JEP 519: *"If the JVM is configured to run with both … compact object headers are disabled."*
Setting the flag is not evidence that you got the feature — check the running JVM.

**★ `-XX:-UseCompressedClassPointers` is deprecated on 25 and obsolete on 26.** It warns today
and stops being a flag tomorrow. Advice built on disabling it has a one-release shelf life, and
compact object headers require compressed class pointers anyway.

**★ Compact headers and a widened alignment fight each other.** Compact headers save bytes
that alignment then rounds back up. At 16-byte alignment a large fraction of the header
saving disappears into padding. If you are setting both, the combination needs measuring —
the two savings do not simply add.

**★ An article's number for `CompressedClassSpaceSize` is not your JVM's number.** These
defaults have moved across releases and are affected by other flags, including whether
compressed class pointers are enabled at all. Read them off the JDK you are running.

**★ Compressed class pointers are enabled independently of compressed oops in principle, and
together in practice.** They are separate flags, but the ergonomics tie them, and a heap past the
compressed-oops ceiling loses both. Reasoning about one without the other gives the wrong number
for per-object overhead.

**★ The compressed class space is *reserved* at 1 GB, which alarms people reading NMT.** Reserved
is address space, not memory. It is the committed figure inside that region that matters, and it
is normally a small fraction of the reservation.

## Interview questions

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

**★ Why is a flag being deprecated the same release a feature that depends on it goes to product?**
Because they are the same move seen from two sides. Compact object headers require compressed
class pointers — they encode the class in 22 bits of the header — so the direction of travel is
that compressed class pointers stop being optional rather than stop existing. Deprecating
`UseCompressedClassPointers` in 25 and making it obsolete in 26 removes the ability to turn off
something the 27 default will depend on. The practical reading: do not build anything on being
able to disable it.

**★ A team enables `-XX:+UseCompactObjectHeaders` and measures no change. What would you check
first?**
Whether they actually got the feature. JEP 519 states that compact object headers are incompatible
with legacy locking and that when both are configured, compact headers are silently disabled — no
warning, no error, just the old layout. So the first check is the running JVM rather than the
launch arguments: `-XX:+PrintFlagsFinal` for the effective value, and a JOL measurement of a known
object to confirm the header size actually changed. Only after that is it worth asking the second
question, which is whether their heap is the kind that benefits — many small objects, not few
large ones — and whether alignment padding reclaimed the saving.

{/* FOOTER */}
