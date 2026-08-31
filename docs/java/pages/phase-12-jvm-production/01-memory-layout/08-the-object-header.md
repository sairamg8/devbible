---
title: "Every Java object carries a mark word and a class word before its first field, and on JDK 25 the mark word contains no biased-locking bit, four bits reserved for Valhalla and a self-forwarding bit the textbook diagrams do not have"
sidebar_label: "08 · The object header"
sidebar_position: 40
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against **JEP 450: Compact Object Headers (Experimental)**, sections
> *"Motivation"*, *"Description → Current object headers"*, *"Locking"* and *"GC forwarding"*
> ([openjdk.org](https://openjdk.org/jeps/450)); **JEP 374: Deprecate and Disable Biased Locking**
> (JDK 15) ([openjdk.org](https://openjdk.org/jeps/374)); **JDK-8256425 "Obsolete Biased Locking in
> JDK 18"**, resolved Fixed with fixVersion 18
> ([bugs.openjdk.org](https://bugs.openjdk.org/browse/JDK-8256425)); and the OpenJDK `jdk-25+36`
> sources `src/hotspot/share/oops/markWord.hpp` (the layout comment and the bit constants),
> `src/hotspot/share/oops/arrayOop.hpp`, `src/hotspot/share/oops/objLayout.hpp` and
> `src/hotspot/share/runtime/globals.hpp` (`LockingMode`, `UseObjectMonitorTable`,
> `UseCompactObjectHeaders`).
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**There is no such thing as a Java object that costs exactly the sum of its fields. Before the
first field sits a header the JVM uses for four unrelated jobs — garbage collection, type
identity, locking and identity hash codes — and on a 64-bit JVM it is 12 or 16 bytes depending on
configuration. Most of what you have read about its contents is a diagram from the biased-locking
era; biased locking was disabled in JDK 15 and obsoleted in JDK 18, and the JDK 25 layout has bits
in it that no blog post mentions.**

## Why there is a header at all

JEP 450 enumerates the jobs, verbatim:

> *"An object stored in the heap has metadata, which the HotSpot JVM stores in the object's header.
> … In the HotSpot JVM, object headers support many different features:*
>
> - *Garbage collection — Storing forwarding pointers and tracking object ages;*
> - *Type system — Identifying an object's class, which is used for method invocation, reflection,
>   type checks, etc.;*
> - *Locking — Storing information about associated light-weight and heavy-weight locks; and*
> - *Hash codes — Storing an object's stable identity hash code, once computed."*

Four subsystems, one 8-to-16-byte struct, and no `Object` field in any Java source file that
corresponds to any of it. That is why `sizeof` is not a question Java answers — see
[08d · Measuring an object](08d-measuring-an-object.md).

And the size, also verbatim, which is where the famous numbers come from:

> *"The size of the header is constant; it is independent of object type, array shape, and content.
> In the 64-bit HotSpot JVM, object headers occupy between 96 bits (12 bytes) and 128 bits
> (16 bytes), depending on how the JVM is configured."*

| Configuration | Mark word | Class word | Header |
|---|---|---|---|
| 64-bit, compressed class pointers (the default) | 8 bytes | 4 bytes | **12 bytes** |
| 64-bit, `-XX:-UseCompressedClassPointers` | 8 bytes | 8 bytes | **16 bytes** |
| 64-bit, `-XX:+UseCompactObjectHeaders` | 8 bytes (class pointer folded in) | — | **8 bytes** |

The third row is [08b · Compact object headers](08b-compact-object-headers.md).

## The mark word on JDK 25, from the source

Here is `markWord.hpp`'s own layout comment — the authoritative statement for JDK 25:

```text
//  32 bits:
//  --------
//             hash:25 ------------>| age:4  self-fwd:1  lock:2 (normal object)
//
//  64 bits:
//  --------
//  unused:22 hash:31 -->| unused_gap:4  age:4  self-fwd:1  lock:2 (normal object)
//
//  64 bits (with compact headers):
//  -------------------------------
//  klass:22  hash:31 -->| unused_gap:4  age:4  self-fwd:1  lock:2 (normal object)
```

Read the 64-bit row field by field, because three of the five fields are routinely mis-stated:

- **`lock:2`** — the two lowest bits, the state tag.
- **`self-fwd:1`** — a self-forwarding marker. JEP 450 explains why it exists: *"If copying an
  object to its new location fails, the GCs install a forwarding pointer to the object itself, thus
  making the object self-forwarded. With compact object headers, this would overwrite the type
  information. To address this, we indicate that an object is self-forwarded by setting the third
  bit of the object header rather than by overwriting the entire header."* In JDK 25 the bit is
  present in **both** layouts, not only the compact one.
- **`age:4`** — the GC age, the number of survivor copies this object has lived through. Four bits
  is why `-XX:MaxTenuringThreshold` cannot exceed 15.
- **`unused_gap:4`** — the source's comment is explicit: `static const int unused_gap_bits =
  LP64_ONLY(4) NOT_LP64(0); // Reserved for Valhalla.`
- **`hash:31`** — the identity hash, once computed. The constant is
  `hash_bits = max_hash_bits > 31 ? 31 : max_hash_bits`.

🔴 **There is no bias bit and no bias epoch.** Biased locking was disabled by default and its flags
deprecated by **JEP 374 in JDK 15** — *"biased locking will no longer be enabled when HotSpot is
started unless `-XX:+UseBiasedLocking` is set on the command line"* — and then obsoleted by
**JDK-8256425, "Obsolete Biased Locking in JDK 18"**, resolved Fixed against JDK 18. On JDK 25 the
flag does not appear in `globals.hpp` at all. Any mark-word diagram you find containing
`biased_lock:1` and `epoch:2` describes JDK 14 or earlier. Reproducing one in an interview is a
reliable way to date your knowledge.

## The tag bits and what they mean

`markWord.hpp` again, verbatim:

```text
//  - the two lock bits are used to describe three states: locked/unlocked and monitor.
//
//    [ptr             | 00]  locked             ptr points to real header on stack (stack-locking in use)
//    [header          | 00]  locked             locked regular object header (fast-locking in use)
//    [header          | 01]  unlocked           regular object header
//    [ptr             | 10]  monitor            inflated lock (header is swapped out, UseObjectMonitorTable == false)
//    [header          | 10]  monitor            inflated lock (UseObjectMonitorTable == true)
//    [ptr             | 11]  marked             used to mark an object
//    [0 ............ 0| 00]  inflating          inflation in progress (stack-locking in use)
```

Note that `00` has two different meanings depending on the locking implementation in use. JDK 25's
default is the newer one:

```cpp
product(int, LockingMode, LM_LIGHTWEIGHT,
        "(Deprecated) Select locking mode: "
        "0: (Deprecated) monitors only (LM_MONITOR), "
        "1: (Deprecated) monitors & legacy stack-locking (LM_LEGACY), "
        "2: monitors & new lightweight locking (LM_LIGHTWEIGHT, default)")
```

The two legacy modes are marked `(Deprecated)`; `LM_LIGHTWEIGHT` is the default and the only
non-deprecated one. JEP 450 describes what each does:

> *"**Lightweight locking** is used when the locked object's monitor is uncontended, no thread
> control methods (`wait()`, `notify()`, etc.) are called, and no JNI locking is used. In such
> cases, HotSpot atomically flips the tag bits in the object header from 01 (unlocked) to 00
> (lightweight-locked). No additional data structures are required, and no other header bits are
> used."*
>
> *"**Monitor locking** is used when the locked object's monitor is contended, thread control
> methods are used, or lightweight locking is otherwise inadequate. To indicate this state, HotSpot
> atomically flips the tags bits in the object header from 01 (unlocked) or 00 (lightweight-locked)
> to 10 (monitor-locked)."*

And why the legacy mode had to go before headers could shrink:

> *"HotSpot also supports the legacy stack-locking mechanism. This spiritual predecessor to
> lightweight locking associates the locked object with the locking thread by copying the object
> header to the thread's stack and overwriting the object header with the pointer to the header
> copy. This is problematic for compact object headers because it overwrites the object header and
> thus loses crucial type information. Therefore, compact object headers are not compatible with
> legacy locking. If the JVM is configured to run with both legacy locking and compact object
> headers then compact object headers are disabled."*

That paragraph is worth remembering because it is a silent-downgrade rule: combine
`-XX:LockingMode=1` with `-XX:+UseCompactObjectHeaders` and you get ordinary headers with no
error.

## The class word

JEP 450, verbatim:

> *"The class word comes after the mark word. It takes one of two shapes, depending on whether
> compressed class pointers are enabled … The class word is never overwritten, which means that an
> object's type information is always available, so no additional steps are required to check a
> type or invoke a method. Most importantly, the parts of the runtime that need that type
> information do not have to cooperate with the locking, hashing, and GC subsystems, which can
> change the mark word."*

That last sentence is the design argument for having two words instead of one: the mark word is
volatile — locking, hashing and GC all rewrite it — and the class word is immutable, so every
virtual call and `instanceof` can read it without coordinating with anything. Compact object
headers give that property up in exchange for four bytes, which is why it took a decade of Project
Lilliput to do safely.

The pointer itself points into metaspace, at the `Klass` structure, which is *not* the same thing
as the `java.lang.Class` object on the heap. Compressed class pointers and their encoding belong
to [09 · Compressed oops](09-compressed-oops.md).

HotSpot caches the resulting geometry in one place so that hot paths load one value instead of
three flags:

```cpp
class ObjLayout {
public:
  enum Mode {
    // +UseCompactObjectHeaders (implies +UseCompressedClassPointers)
    Compact,
    // +UseCompressedClassPointers (-UseCompactObjectHeaders)
    Compressed,
    // -UseCompressedClassPointers (-UseCompactObjectHeaders)
    Uncompressed,
    // Not yet initialized
    Undefined
  };
```

Three modes, and the comment on `Compact` states a hard dependency: compact object headers
**imply** compressed class pointers.

## Arrays carry a third word

`arrayOop.hpp` documents the layout:

```text
// The layout of array Oops is:
//
//  markWord
//  Klass*    // 32 bits if compressed but declared 64 in LP64.
//  length    // shares klass memory or allocated after declared fields.
```

and explains where the length actually goes:

```cpp
// The _length field is not declared in C++.  It is allocated after the
// mark-word when using compact headers (+UseCompactObjectHeaders), otherwise
// after the compressed Klass* when running with compressed class-pointers
// (+UseCompressedClassPointers), or else after the full Klass*.
```

So an array header is the object header plus a 4-byte `int` length: **16 bytes** in the default
configuration, **12 bytes** with compact headers. That per-array overhead is why `byte[1]` costs
the same as `byte[8]` after alignment, and why an array of many small arrays is a very different
proposition from one large array — a point [08c · Alignment and padding](08c-alignment-and-padding.md)
develops.

## The identity hash code lives in the header, and only once

`Object.hashCode()`'s default implementation returns an *identity* hash that must stay stable for
the object's lifetime, including across garbage collections that move the object. It cannot be
derived from the address, therefore, so HotSpot computes it lazily on first request and stores it
in the mark word's 31 hash bits.

Three consequences follow:

- **An object that has never been hashed has no hash stored.** Calling
  `System.identityHashCode(o)` on it mutates the header. This is a write to a field you did not
  know existed, on an object you may be treating as immutable.
- **The hash and the lock state compete for the same word.** Under the legacy stack-locking mode
  the mark word is displaced onto the locking thread's stack, so a hash request on a
  stack-locked object has to find the displaced header. Under `LM_LIGHTWEIGHT` the header stays in
  place for the uncontended case, which is one of the reasons the newer mode was needed.
- **Identity hash is 31 bits, not 32.** The source computes
  `hash_bits = max_hash_bits > 31 ? 31 : max_hash_bits`, so the value is always non-negative in
  practice. Do not write code that depends on that.

## Gotchas

**★ Any mark-word diagram with a `biased_lock` bit is from JDK 14 or earlier.**
JEP 374 disabled biased locking by default in JDK 15 and deprecated all its flags; JDK-8256425
obsoleted it in JDK 18. On JDK 25 `UseBiasedLocking` does not exist in `globals.hpp` at all. The
JDK 25 64-bit layout is `unused:22 hash:31 | unused_gap:4 age:4 self-fwd:1 lock:2`.

**★ The `age` field is 4 bits, which is why `MaxTenuringThreshold` stops at 15.**
It is not an arbitrary limit and no flag raises it. If you find advice to set
`-XX:MaxTenuringThreshold=32`, it cannot work — the field cannot hold the value.

**★ Four bits of the mark word are reserved for Project Valhalla and are not spare.**
`markWord.hpp`: `unused_gap_bits = LP64_ONLY(4) … // Reserved for Valhalla`. JEP 450's risks
section says the same. Treating them as free space in your mental model will make the compact
layout's arithmetic look wrong.

**★ `-XX:LockingMode` is deprecated in JDK 25 in two of its three values.**
The flag's own help text marks `LM_MONITOR` and `LM_LEGACY` as `(Deprecated)`. Setting
`-XX:LockingMode=1` to "restore old behaviour" also silently disables compact object headers if
you asked for them, because JEP 450 states the two are incompatible.

**★ `System.identityHashCode()` writes to the object.**
The identity hash is computed lazily and stored in the mark word on first request. Calling it —
directly, or indirectly by putting the object in an `IdentityHashMap`, or through a default
`hashCode()` — mutates the header of an object you may believe is immutable, and interacts with
whatever the locking subsystem is doing to the same word.

**★ The `Klass*` in the header does not point at a `java.lang.Class`.**
It points into metaspace, at HotSpot's internal `Klass` structure. The `java.lang.Class` object is
a separate heap object reachable from it. Confusing the two makes metaspace and heap accounting
come out wrong.

**★ Array headers are 16 bytes by default, not 12.**
The `int` length is a third component after the mark and class words. Any calculation of
`new byte[n]`'s footprint that starts from 12 is 4 bytes short before alignment even applies.

**★ "The header is 12 bytes" is only true with compressed class pointers enabled.**
JEP 450's own range is *"between 96 bits (12 bytes) and 128 bits (16 bytes), depending on how the
JVM is configured"*. Disable `UseCompressedClassPointers` — which some very large-heap
configurations still do — and every object grows by four bytes.

**★ The header is per *object*, so object count matters more than object size.**
JEP 450: *"Experiments conducted as part of Project Lilliput show that many workloads have average
object sizes of 256 to 512 bits (32 to 64 bytes). This implies that more than 20% of live data can
be taken by object headers alone."* Replacing a million tiny wrapper objects with one array is a
footprint change of a different order from making each wrapper smaller.

## Interview questions

**★ What is in a Java object header?**
Two words on a 64-bit JVM. The mark word — 8 bytes, mutable — holds the identity hash code once
computed, the GC age, a self-forwarding bit, and two tag bits describing the lock state; on JDK 25
it also reserves four bits for Project Valhalla. The class word — 4 bytes with compressed class
pointers, 8 without — holds a pointer into metaspace to the `Klass` structure and is never
overwritten, which is what lets the runtime do type checks and virtual dispatch without
coordinating with the locking, hashing or GC subsystems. Arrays add a third component, a 4-byte
`int` length.

**★ How big is an object header, and why is that not one number?**
JEP 450 gives the range verbatim: *"In the 64-bit HotSpot JVM, object headers occupy between 96
bits (12 bytes) and 128 bits (16 bytes), depending on how the JVM is configured."* It is 12 bytes
with compressed class pointers, which is the default, and 16 bytes without them. With
`-XX:+UseCompactObjectHeaders` on JDK 25 it is 8. Arrays add 4 more for the length in every
configuration.

**★ Where is the biased-locking bit?**
Nowhere, on any supported JDK. JEP 374 disabled biased locking by default in JDK 15 and deprecated
all its options; JDK-8256425, "Obsolete Biased Locking in JDK 18", removed it. JDK 25's
`markWord.hpp` shows `unused:22 hash:31 | unused_gap:4 age:4 self-fwd:1 lock:2` for a normal
64-bit object — no bias bit, no epoch. The motivation JEP 374 gives is that the gains had
evaporated for modern code and *"Biased locking introduced a lot of complex code into the
synchronization subsystem"*, which was blocking work such as Project Lilliput.

**★ Why is `MaxTenuringThreshold` capped at 15?**
Because the object's survivor age is stored in a 4-bit field of the mark word, and 4 bits hold 0
to 15. It is a header layout constraint, not a tuning heuristic, and no flag changes it. This is a
nice example of how the header shapes things people think of as GC policy.

**★ Why are the mark word and class word separate, and what does folding them together cost?**
Because they have opposite mutability. The mark word is rewritten constantly — locking, identity
hashing and GC forwarding all use it — while the class word is written once. JEP 450 makes the
argument explicitly: because the class word is never overwritten, *"the parts of the runtime that
need that type information do not have to cooperate with the locking, hashing, and GC
subsystems"*. Compact object headers fold the compressed class pointer into the mark word, which
means locking can no longer overwrite the word (hence the removal of legacy stack-locking as an
option) and GC self-forwarding needs a dedicated bit instead of overwriting the header.

**★ What happens to the mark word when you `synchronized` on an object?**
It depends on the lock state. In the uncontended case under JDK 25's default `LM_LIGHTWEIGHT`
mode, HotSpot atomically flips the tag bits from `01` (unlocked) to `00` (lightweight-locked) and
touches nothing else — JEP 450: *"No additional data structures are required, and no other header
bits are used."* If the monitor becomes contended, or `wait()`/`notify()` is used, or JNI locking
is involved, the lock inflates: the tag bits become `10` and an `ObjectMonitor` is created. In the
legacy stack-locking mode, which is deprecated in JDK 25, the whole header was copied to the
locking thread's stack and replaced with a pointer to that copy — which is precisely why that mode
is incompatible with compact headers.

**★ Why can the identity hash code not just be the object's address?**
Because `Object.hashCode()`'s contract requires the value to be stable for the object's lifetime,
and a moving collector relocates objects. So HotSpot computes an identity hash on first request and
stores it in the mark word's 31 hash bits, where it survives relocation. The side effect worth
knowing is that the first call to `System.identityHashCode(o)` — or anything that reaches the
default `hashCode()`, including inserting into an `IdentityHashMap` — *writes* to the object's
header.

**★ Why does the header dominate footprint for some applications and not others?**
Because it is a fixed cost per object, so what matters is object *count*, not total bytes. JEP 450
quotes Project Lilliput's measurement that typical workloads average 32 to 64 bytes per object,
*"which implies that more than 20% of live data can be taken by object headers alone"*. An
application holding a few large arrays pays almost nothing; one holding tens of millions of small
domain objects, boxed numbers or linked-list nodes pays a fifth of its heap for metadata. That is
the entire economic case for compact object headers.

{/* FOOTER */}
