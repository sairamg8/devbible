---
title: "Metaspace is native memory holding class metadata, and the sentence everyone knows about it — \"PermGen became metaspace\" — is a third right, because interned strings and class statics went to the heap instead"
sidebar_label: "04 · Metaspace"
sidebar_position: 14
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against **JEP 122 "Remove the Permanent Generation"**
> ([openjdk.org](https://openjdk.org/jeps/122)), the **JDK 25 Troubleshooting Guide** for the
> `Metaspace` and `Compressed class space` `OutOfMemoryError` messages and for the Native Memory
> Tracking output shape
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/troubleshoot/)),
> and the **JDK 25 `java` tool reference**
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html)).
> JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9.

**Metaspace is where a class's metadata lives once it is loaded: the runtime constant pool, the
method bytecode, the field and method descriptors, the vtables. It is native memory, so it sits
outside `-Xmx` and does not appear in a heap dump. This page is what the region is, what
actually moved into it when the permanent generation was removed, and why it is really two
regions with two separate out-of-memory errors. The flags are
[04b · The metaspace flags](04b-the-metaspace-flags.md); the leak is
[04c · The classloader leak](04c-the-classloader-leak.md).**

## What actually moved, and what did not

The story starts with the removal of the permanent generation. **JEP 122**, Java 8, states the
change and — crucially — that there was not one destination but two:

> *"Class metadata, interned Strings and class static variables will be moved from the
> permanent generation to either the Java heap or native memory."*

and, specifically:

> *"The proposed implementation will allocate class meta-data in native memory and **move
> interned Strings and class statics to the Java heap**."*

🔴 **Three things left PermGen and only one of them became metaspace.** This is the detail that
separates people who read the JEP from people who read a summary, and it has practical
consequences in both directions:

| Was in PermGen | Now lives in | Bounded by | Visible in a heap dump |
|---|---|---|---|
| **Class metadata** | Metaspace (native) | `-XX:MaxMetaspaceSize` — unlimited by default | ❌ No |
| **Interned strings** | The Java heap | `-Xmx` | ✅ Yes |
| **Class static variables** | The Java heap | `-Xmx` | ✅ Yes |

The consequences follow immediately. Advice from the Java 6 era — *"never call `intern()`, you
will exhaust PermGen"* — describes a JVM that has not existed since Java 7; the string pool is
on the heap now, and the modern objection to `intern()` is about cost rather than about a
separate region, which [10b](10b-the-pool-and-interning.md) argues. In the other direction, a
`static Map` that grows without bound is a *heap* problem, findable in a heap dump, even though
its variable is "class-level" and feels like it should be metadata.

## What is in it

Per loaded class, roughly: the runtime constant pool, method metadata and bytecode, field and
method descriptors, the vtable and itables, annotations, and the `Klass` structure itself.

Two properties of that list matter more than its contents.

**It is a per-class fixed cost, not a per-instance cost.** A million instances of one class add
nothing to metaspace. Ten thousand *classes* do — which is why the metric that predicts
metaspace is the loaded class count, and why frameworks that generate classes at runtime are
the interesting case.

**It is never moved.** JEP 122: *"Class meta-data will not be moved during the life of the
class."* Metaspace is not compacted the way the heap is. That is a design choice with
consequences for fragmentation, and it is half the reason reclamation works the way
[04c](04c-the-classloader-leak.md) describes.

## Two regions with one name

`jcmd <pid> VM.native_memory` reports metaspace as the **Class** category, and it has two
sub-regions under it:

```
-                     Class (reserved=1049217KB, committed=5313KB)
                            (classes #3554)
                            (  instance classes #3294, array classes #260)
                            (malloc=705KB #1953)
                            (mmap: reserved=1048512KB, committed=4608KB)
                            (  Metadata:   )
                            (    reserved=65536KB, committed=4096KB)
                            (  Class space:)
                            (    reserved=1048576KB, committed=512KB)
```

*(Shape quoted from the JDK 25 Troubleshooting Guide's NMT examples. The numbers are that
document's, not a measurement of any service.)*

- **Metadata** — the general metaspace: bytecode, constant pools, annotations, descriptors,
  vtables, and everything about a class that is not a pointer to it.
- **Class space** — the *compressed class space*, holding the `Klass` structures that
  compressed class pointers in object headers point into. It exists only when
  `UseCompressedClassPointers` is on, which it is by default on 64-bit heaps.
  [09c](09c-class-pointers-and-compact-headers.md) owns the pointer compression itself.

🔴 **`reserved=1048576KB` is the giveaway: the compressed class space reserves 1 GB by
default.** Reserved, not committed — address space, not RAM, as
[01f](01f-reserved-committed-and-resident.md) sets out — but it is a fixed 1 GB carve-out of the
process's virtual address space that shows up in every `pmap` and alarms everyone who meets it
for the first time.

## Two regions means two out-of-memory errors

This is the most useful fact on the page for diagnosis:

| Message | Region exhausted | Bounded by |
|---|---|---|
| `java.lang.OutOfMemoryError: Metaspace` | General metaspace | `-XX:MaxMetaspaceSize` |
| `java.lang.OutOfMemoryError: Compressed class space` | The class space only | `-XX:CompressedClassSpaceSize` |

Both are on the JDK 25 Troubleshooting Guide's documented list. The second is the surprising
one, and it is why *"I raised `MaxMetaspaceSize` and it still died"* is a real support ticket:
the exhausted region was the other one, and it has its own flag with its own default.

⚠️ **Neither is the common outcome.** Because `MaxMetaspaceSize` is unlimited by default
([04b](04b-the-metaspace-flags.md)), most metaspace problems in containers never reach either
error — they grow native memory until the kernel kills the process, which
[01b](01b-oom-error-versus-oomkilled.md) covers.

## The count that tells you what is happening

Everything diagnostic about this region reduces to one number and its trend:

```
(classes #3554)
(  instance classes #3294, array classes #260)
```

[02](02-the-process-map.md) makes the same point from the map's side. **A class count that only
ever rises is the signature of a problem**; a count that rises and falls with deployments and
plateaus under steady load is a healthy application. The size follows the count, because the
cost is per class.

Array classes are worth a glance: they are generated per element type and dimension, so a large
`array classes` figure usually just reflects a lot of distinct array types and is not
interesting on its own.

## Gotchas

**★ "PermGen became metaspace" is a third right.**
JEP 122 moved class metadata to native memory, and interned strings and class statics to the
Java heap. The two-thirds it gets wrong are exactly what decides whether a given growth problem
is bounded by `-Xmx` or by nothing at all.

**★ Metaspace cost is per class, not per instance.**
A million objects of one class add nothing. The predictor is loaded class count, which is why
runtime class generation — proxies, CGLIB-style subclasses, scripting engines — is the
interesting failure mode and why "we have a lot of objects" is not.

**★ A heap dump does not contain metaspace.**
It contains objects. It cannot tell you how much metaspace is in use, though it is the right
tool for finding *why* a leaked classloader is still reachable — see
[01d](01d-taking-a-heap-dump-on-purpose.md) and [04c](04c-the-classloader-leak.md).

**★ There are two metaspace out-of-memory errors, and the second names a region most people
have never heard of.**
`Metaspace` and `Compressed class space` are bounded by different flags. Raising
`MaxMetaspaceSize` does nothing for the second.

**★ The 1 GB in NMT's `Class` line is reserved address space, not memory in use.**
It is the compressed class space's default reservation. Reading `reserved` as consumption is one
of the most common misreadings of NMT output, and it makes every JVM look like it is using a
gigabyte it has not touched.

**★ Interned strings and class statics are on the heap, and always have been since Java 8.**
So "we intern a lot of strings, will metaspace blow up" has the wrong region in the question.
The pool is heap-resident and bounded by `-Xmx`.

**★ Metadata is never moved, so metaspace does not compact.**
JEP 122 states it directly. Elastic metaspace can return memory to the OS
([04b](04b-the-metaspace-flags.md)), which is not the same thing as defragmenting.

## Interview questions

**★ Where did PermGen go?**
It was removed in Java 8 by JEP 122, and its contents went to two different places: class
metadata moved to native memory as metaspace, while interned strings and class static variables
moved to the Java heap. The common summary "PermGen became metaspace" is only a third right, and
the part it gets wrong determines which limit applies and which tool can see the growth.

**★ What is actually stored in metaspace?**
Per-class metadata: the runtime constant pool, method bytecode and descriptors, field
descriptors, vtables and itables, annotations, and the `Klass` structure. Not object instances,
not static field *values*, not interned strings. The cost scales with the number of loaded
classes, not with the number of objects.

**★ Why does NMT show a gigabyte in the `Class` category on a service that has just started?**
Because the compressed class space reserves 1 GB of address space by default, and NMT reports
both reserved and committed. Reserved is address space the JVM has claimed but not necessarily
touched; committed is what is actually backed by memory. Reading the reserved column as usage is
the standard misreading.

**★ You see `OutOfMemoryError: Compressed class space`. What is that, and how is it different
from `OutOfMemoryError: Metaspace`?**
Metaspace has two sub-regions. The general metadata region is bounded by `MaxMetaspaceSize`; the
compressed class space, which holds the `Klass` structures that compressed class pointers refer
to, is bounded separately by `CompressedClassSpaceSize`, default 1 GB. The two errors name
different regions with different flags, so the fix for one does nothing for the other — and
either way, thousands of classes is the underlying fact worth explaining.

**★ A service has a million live objects and metaspace is growing. Are those related?**
Almost certainly not. Metaspace holds per-class metadata, so instance count does not drive it.
Growing metaspace means the loaded *class* count is growing — runtime-generated classes,
repeated redeploys, or a classloader that is never released — which is a different investigation
entirely, starting with `jcmd VM.classloader_stats`.

**★ Why is metaspace never compacted?**
Because JEP 122 guarantees class metadata is not moved during the life of the class. Structures
in metaspace are referenced directly by pointers from object headers, from JIT-compiled code and
from the runtime, so moving them would require the kind of pointer-rewriting machinery the heap
has and metaspace deliberately does not. The design instead reclaims whole per-classloader
arenas at once.

{/* FOOTER */}
