---
title: "References and memory"
sidebar_label: "2 · References and memory"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JLS SE 25 §4.3 (reference types and values),
> §15.21.3 (reference equality operators), the JVMS SE 25 §2.5–2.6 (run-time
> data areas, frames), JEP 519 (Compact Object Headers, product in JDK 25),
> and the HotSpot documentation for compressed ordinary object pointers.

**Every non-primitive type — `String`, arrays, your classes, the wrapper
classes — is a reference type. The variable does not contain the object; it
contains a reference to an object that lives on the heap. Copying the
variable copies the pointer, `==` compares the pointer, and the object
itself carries a header that makes an `Integer` several times the size of an
`int`. This chunk is the memory model at the working level of precision —
enough to reason about aliasing, identity and cost without folklore.**

## Reference-copy semantics

```java
Order a = new Order(42);
Order b = a;            // copies the REFERENCE — one object, two variables
b.cancel();             // observable through a, too
```

Two consequences run through the whole language:

1. **Assignment and parameter passing copy references, never objects**
   ([topic 10](../10-methods.md) — Java is pass-by-value, and the value is
   the reference).
2. **`==` on references compares identity** — "same object", not "same
   content". Content equality is `equals` (Phase 2 owns that contract;
   [topic 02](../02-autoboxing-integer-cache/README.md) shows `==` on
   wrappers going wrong).

There is no "dereference operator" and no pointer arithmetic: the reference
is opaque. The only operations on it are assignment, `==`/`!=`, `null`
comparison, member access (`.`), casting and `instanceof`
([topic 14](../14-casting-instanceof/README.md)).

## Where values live — stack vs heap, said precisely

Each thread owns a stack of **frames**, one per method invocation (JVMS
§2.6). A frame holds the method's local variables and operand stack:

- **Locals and parameters** live in the current frame. A primitive local
  *is* its value in the frame; a reference local is a frame slot pointing
  into the heap.
- **Objects — all of them — live on the heap**, including arrays and the
  objects behind "small" locals. The heap is shared by every thread, which
  is exactly why Phase 6 exists.
- **Fields live inside their object**, wherever it is on the heap; static
  fields live with the class ([topic 11](../11-static/README.md)).

The one refinement worth knowing exists: the JIT's **escape analysis** may
avoid heap-allocating an object that provably never escapes a method — an
optimization, invisible to semantics, never something to design for.
Frames also die with their method — which is why returning early is free
and why a reference *outliving* its frame (stored in a field, captured by a
lambda) is what actually keeps an object alive.

## What an object costs: headers, oops, alignment

An object is its fields **plus a header** the JVM uses for identity hash,
locking and type information. The numbers, as documented for HotSpot on
64-bit JVMs:

- **Compressed ordinary object pointers ("compressed oops")** are on by
  default for heaps below ~32 GB: references stored in objects are 32 bits
  instead of 64, decoded against a base. Above that heap size, references
  fatten to 8 bytes — one reason "just give it a 40 GB heap" can *increase*
  memory pressure.
- The classic header is **12 bytes with compressed class pointers** (8-byte
  mark word + 4-byte class pointer), padded to 8-byte alignment.
  **JEP 519 (JDK 25) makes compact object headers a product option**
  (`-XX:+UseCompactObjectHeaders`), shrinking the header to 8 bytes.
- So an `Integer` is header + 4-byte `int` value + padding — **16 bytes**
  under classic headers, versus 4 bytes for the primitive, before counting
  the 4-byte reference that points at it. The "an `Integer` costs ~4× an
  `int`" rule of thumb comes from exactly this arithmetic.
- Arrays carry the same header plus a 4-byte length, then the elements —
  `long[1_000_000]` is ~8 MB plus a fixed few bytes, while
  `Long[1_000_000]` is a million references *plus* up to a million 16-byte
  boxes scattered across the heap.

The scattered part matters as much as the size: iterating a `long[]` walks
contiguous memory; iterating a `Long[]` pointer-chases. That cache-locality
story is why [`ArrayList` beats `LinkedList`](../../phase-3-generics-collections/README.md)
in Phase 3 and why primitive streams exist in Phase 4.

## Identity, `hashCode` and the header

`Object.hashCode`'s default ("identity hash") and `==` both key off the
object, not its contents — the identity hash is stored in the header the
first time it is asked for. Two facts follow:

- Identity survives GC moving the object (the JVM preserves the stored
  hash), so `==` and identity-hash are stable for an object's lifetime.
- Nothing about `==` ever looks at fields. Two `new Order(42)` objects are
  `!=` forever; making them "equal" is Phase 2's `equals`/`hashCode`
  contract, not the language's job.

## Gotchas

**Symptom:** two variables "of the same object" — mutation through one surprises the reader of the other
**Cause:** reference assignment copied the pointer, not the object; both name one heap object
**Fix:** expected semantics — internalize it. Where sharing must not happen, copy explicitly (Phase 2's defensive-copy discipline)

**Symptom:** `a == b` is false for two objects that print identically
**Cause:** `==` on references is identity; equal content is irrelevant
**Fix:** `equals` (null-safe: `Objects.equals`) for content comparison — and Phase 2's contract when it's your own class

**Symptom:** memory usage several times the "sum of the data" estimate
**Cause:** each boxed value/small object pays a 12–16-byte header plus alignment padding plus a reference to reach it
**Fix:** primitive arrays or primitive streams for bulk numerics; estimate with header+padding arithmetic, or measure with a heap dump (Phase 12) rather than guessing

**Symptom:** raising the heap from 30 GB to 36 GB made GC and memory *worse*
**Cause:** crossing the ~32 GB line disables compressed oops — every stored reference doubles to 8 bytes
**Fix:** stay below the compressed-oops ceiling, or jump far enough past it to pay for the fatter pointers; check with `-Xlog:gc+init`

**Symptom:** an object is "leaked" though the method that made it returned long ago
**Cause:** a reference outlived the frame — stored in a static, a field, a listener list, or captured by a long-lived lambda
**Fix:** reachability is liveness (Phase 0's GC model): find the surviving reference path, not the allocation site

**Symptom:** assuming `boolean[]` packs to bits, capacity math is 8× off
**Cause:** HotSpot stores one byte per `boolean` element; the JLS never promised bits
**Fix:** `BitSet` or a `long`-based bitmap when bit density is the point

## Interview questions

**★ What is the difference between a primitive and a reference type?**
A primitive variable holds the value itself — one of 8 built-in kinds, fixed
size, no methods, never `null`. A reference variable holds a pointer to a
heap object. Assignment copies the value in both cases — which for
references means copying the pointer, so two variables can name one object.

**★ Where do objects and variables live in memory?**
Locals and parameters in the thread's stack frame; objects — all of them —
on the shared heap; instance fields inside their object; statics with the
class. Escape analysis may elide a heap allocation the JIT can prove never
escapes — an invisible optimization, not a semantic.

**★ What does an object actually cost in memory?**
Header (12 bytes classic with compressed class pointers, 8 with JDK 25's
compact headers) + fields + padding to 8-byte alignment — so an `Integer` is
~16 bytes plus the reference pointing at it, versus 4 bytes for an `int`.
For bulk data the locality cost of pointer-chasing boxed values dwarfs even
the size difference.

**★ What are compressed oops and when do they stop applying?**
On 64-bit HotSpot, references stored in objects are compressed to 32 bits
(decoded against a heap base) while the heap fits under ~32 GB. Past that,
references are 8 bytes — a heap sized just over the line can hold *less*
live data than one just under it.

**Why is `==` on references almost always a code smell outside null checks?**
It compares identity, which is rarely the business question; content
equality is `equals`. The exceptions — interned constants, enum values
(Phase 2), sentinel objects — are exactly the cases where identity *is* the
semantic.

**Can two objects have the same `hashCode` but not be `==`?**
Yes, trivially (hash collisions), and default identity hashes can collide
too. The reverse is the contract that matters: `==` objects always share a
hash. Phase 2 builds the `equals`/`hashCode` pairing on this.

**Does the JVM ever allocate objects on the stack?**
Semantically never — the model says heap. The JIT's escape analysis can
scalar-replace a non-escaping object (no allocation at all), which behaves
like stack allocation from the outside but is an optimization detail you
neither control nor observe in correct code.

---

← Prev: [The eight primitives](01-the-eight-primitives.md) · Index: [Primitives vs reference types](README.md) · Next → [Defaults, null and the wrappers](03-defaults-null-wrappers.md)
