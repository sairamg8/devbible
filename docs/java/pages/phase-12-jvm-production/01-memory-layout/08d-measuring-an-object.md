---
title: "\"How big is this object?\" has no answer until you say which JVM, because the size depends on header mode, compressed oops and alignment — so the only honest way to answer it is to ask the running JVM, which is exactly what JOL does"
sidebar_label: "08d · Measuring an object"
sidebar_position: 34
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the **OpenJDK JOL project**
> ([github.com/openjdk/jol](https://github.com/openjdk/jol)) — the `org.openjdk.jol:jol-core`
> coordinates, the `ClassLayout` / `GraphLayout` / `VM` entry points, the `jol-cli` executable
> jar, and the project's own claim that it is *"much more accurate than other tools relying on
> heap dumps, specification assumptions, etc."* because it uses `Unsafe`, JVMTI and the
> Serviceability Agent — and against the **JDK 25 `java` tool reference**
> ([docs.oracle.com/en/java/javase/25/docs/specs/man/java.html](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html))
> for the flags that change layout. JDK 25 · Spring Boot 4.1.0.
> **No sandbox** — this page shows the API and describes the report's structure. It contains
> **no captured JOL output and no measured byte counts**; every size discussed is arithmetic
> from documented rules, shown as such.

**The question "how many bytes is a `Long`?" is asked constantly and is not well formed. The
answer depends on whether compressed oops are on, whether compressed class pointers are on,
whether compact object headers are enabled, and what the object alignment is — four settings
that vary between the JVM on your laptop and the JVM in production. Guessing at object sizes is
therefore not a shortcut; it is a source of wrong numbers. JOL exists because the only reliable
answer comes from asking the JVM that is actually going to run the code.**

This chunk closes the object-layout sequence: [08](08-the-object-header.md) described the header,
[08b](08b-compact-object-headers.md) the JDK 25 change to it, and
[08c](08c-alignment-and-padding.md) the padding rules. This one is how you *check* all three
instead of believing them.

## Why arithmetic is not enough

You can compute an object's size by hand from the rules in the previous three chunks: header,
plus fields in their declared sizes, plus padding to the alignment. The result will often be
right and will sometimes be wrong, for reasons that are all invisible in the source code:

- **Field reordering.** The JVM lays out fields to minimise padding, not in declaration order.
  Your hand calculation assumed an order the JVM did not use.
- **Superclass boundaries.** Fields inherited from a superclass are laid out first and the
  subclass's fields start after them, which can introduce padding in the middle that a flat
  calculation misses.
- **The four layout flags.** Compressed oops, compressed class pointers, compact object headers
  and `ObjectAlignmentInBytes` each change the answer, and they differ between environments.
- **Array headers differ from object headers.** An array carries a length field the object does
  not, which people routinely forget when costing a collection.

That last point compounds badly. A `HashMap` entry is an object with references; the table is an
array of references; the keys and values are objects with their own arrays. A per-entry estimate
that is wrong by 8 bytes is wrong by 80 MB across ten million entries.

## `ClassLayout`: the shallow answer

`ClassLayout` reports the layout of one object — its header, its fields in the order the JVM
actually chose, the padding between them, and the total instance size. It does **not** follow
references; a `String` field is reported as the reference, not as the string.

```java
import org.openjdk.jol.info.ClassLayout;

System.out.println(ClassLayout.parseClass(Order.class).toPrintable());
System.out.println(ClassLayout.parseInstance(anOrder).toPrintable());
```

The printed report is a table with one row per field plus rows for the header and for any
padding, and the columns are the offset, the size, the type, a description of what occupies that
slot, and — when parsing an instance rather than a class — the value. It ends with the instance
size and a count of bytes lost to internal and external padding.

⚠️ **The report's exact wording and column set belong to the JOL version you run**, and this page
deliberately does not reproduce a sample: a JOL report is machine output, and a fabricated one
would be worse than none. Run it and read yours.

The two entry points differ in a way that matters:

- **`parseClass`** works from the class alone. Field *values* are unavailable, but the layout is.
- **`parseInstance`** works from a live object, so it can show values — and for classes whose
  layout depends on the instance, such as arrays, it is the one that gives a real size.

## `GraphLayout`: the deep answer

`ClassLayout` answers "how big is this object". `GraphLayout` answers the question you usually
actually have: **"how big is this object and everything it holds"**.

```java
import org.openjdk.jol.info.GraphLayout;

GraphLayout g = GraphLayout.parseInstance(anOrder);
System.out.println(g.totalSize());        // bytes for the whole reachable graph
System.out.println(g.toFootprint());      // per-class breakdown of that graph
System.out.println(g.toPrintable());      // every object, with addresses
```

`toFootprint()` is the most useful of the three in practice, because it decomposes the graph by
class: how many instances of each type, and how many bytes each type contributes. That converts
"this cache entry is bigger than I expected" into "82% of it is `String`", which is an actionable
finding and points straight at
[10 · Strings in the heap](10-strings.md).

🔴 **Beware what "reachable" means.** `GraphLayout` follows every reference, so measuring an
object that holds a reference to a service, a `Logger`, a `Spring` bean or a `ClassLoader` will
happily walk half the application. When a "small" object measures in the megabytes, the first
hypothesis is not that it is huge — it is that it references something shared. Reading
`toFootprint()`'s class breakdown identifies the culprit immediately.

This is the same distinction as **shallow versus retained size** in a heap analyser, and it has
the same trap: shared structure is counted for whoever you measured. [Topic 04's](../04-out-of-memory-error/_plan.md)
dominator tree is the equivalent tool for a whole heap, and it handles sharing properly, which is
why it — not JOL — is what you use on a real dump.

## `VM`: the configuration the numbers came from

Before trusting a size, establish what JVM produced it:

```java
import org.openjdk.jol.vm.VM;

System.out.println(VM.current().details());
```

This reports the layout-relevant configuration — address size, object alignment, whether
references and class pointers are compressed, and the header sizes in effect. 🔴 **Print this
alongside any size you record**, because a size without its configuration is not a measurement,
it is a number. That is the same discipline as
[09d · Verifying what the JVM chose](09d-verifying-what-the-jvm-chose.md), applied to layout.

## Running it without adding a dependency

You do not have to put JOL on your application's classpath. The project publishes an executable
jar, `jol-cli-$version-full.jar`, on Maven Central:

```bash
java -jar jol-cli.jar <mode> [args]
```

That matters for two reasons. First, you can point it at your production JVM's exact
configuration — same JDK, same flags — without shipping a diagnostic library in your artifact.
Second, when you *do* use it as a library, the project recommends adding `Premain-Class` and
`Launcher-Agent` manifest attributes so that agent attachment works, because JOL's accuracy comes
from `Unsafe`, JVMTI and the Serviceability Agent rather than from guessing.

## What to do with the answer

Measuring is the easy part; the reason to measure is usually one of three decisions:

1. **Is this collection worth restructuring?** A `HashMap<Long, Long>` of ten million entries
   costs vastly more than the eighty megabytes its payload suggests, because every key and value
   is a boxed object with a header and every entry is a node object. `GraphLayout.toFootprint()`
   makes that concrete and is the argument for a primitive-specialised collection.
2. **Is this cache entry the size I assumed?** Cache sizing is almost always done in entries and
   almost always should be done in bytes. Measuring one representative entry converts the two.
3. **Did that refactor cost anything?** Splitting a class, adding a field, or changing a `long`
   to a `Long` all change layout. Measuring before and after — on the same JVM configuration —
   turns an argument into a number.

What JOL is *not* for is exploring a production heap. It measures objects you hand it, in a JVM
you are running. For "what is in this heap", the tool is a heap dump and an analyser, and that is
[topic 04](../04-out-of-memory-error/_plan.md).

## Gotchas

**★ An object size is meaningless without the JVM configuration that produced it.** Compressed
oops, compressed class pointers, compact object headers and `ObjectAlignmentInBytes` all change
it. Record `VM.current().details()` with any size you write down, or the number is not
reproducible.

**★ A size measured on your laptop may not hold in production.** Different heap size can mean
different compressed-oops state; different flags can mean different header mode. This is not
hypothetical — the 32 GB boundary from [09](09-compressed-oops.md) is exactly a case where the
production JVM lays objects out differently from the development one.

**★ `GraphLayout` follows every reference and will walk your whole application.** An object
holding a `Logger`, a Spring bean or a `ClassLoader` reference measures enormous. The number is
correct and the question was wrong. Read `toFootprint()` to see what it dragged in.

**★ `GraphLayout` counts shared structure for whoever you measured.** Two objects sharing a large
array each report it in full, so summing per-object graph sizes double-counts. This is the same
shallow-versus-retained trap as in a heap analyser, and a dominator tree is what handles it
properly.

**★ Field order in the report is not declaration order.** The JVM reorders fields to minimise
padding, and superclass fields are laid out before subclass fields. Hand arithmetic that assumes
source order will disagree with reality, usually by a few bytes and occasionally by more.

**★ Arrays have a different header from objects.** They carry a length field. Costing a collection
by counting only its elements' object sizes understates it by one array header plus the reference
slots plus padding — per array, and a nested structure has many.

**★ `parseClass` cannot show values, and for arrays cannot show a real size.** An array's size
depends on its length, which is a property of the instance. Use `parseInstance` for anything whose
size is not fixed by its class.

**★ JOL is a measurement tool, not a heap tool.** It measures objects you hand it in a JVM you
control. It is the wrong instrument for "what is filling this production heap" — that is a heap
dump and an analyser.

**★ Do not ship `jol-core` in your production artifact by reflex.** The CLI jar measures the same
objects without adding a dependency that reaches for `Unsafe` and JVMTI. If you do use it as a
library, the project's guidance about the `Premain-Class` and `Launcher-Agent` manifest attributes
exists because agent attachment is what makes it accurate.

**★ Padding is reported and is easy to ignore.** JOL tells you how many bytes were lost to
internal and external padding. On a class instantiated millions of times, reordering fields —
which the JVM already tries to do — or removing one field can move that number materially. It is
the only place the cost of a badly shaped small class becomes visible.

**★ Boxed primitives are two allocations' worth of overhead each, not zero.** `Long` is an object
with a header, and a `Map<Long, Long>` allocates one per key and one per value plus a node. This
is the measurement that most often surprises people and most often justifies a primitive
collection.

## Interview questions

**★ How much memory does a `java.lang.Long` occupy?**
The honest answer is that the question is underspecified: it depends on whether compressed class
pointers are enabled, whether compact object headers are on, and what the object alignment is.
The structure is a header plus a `long` field, padded to the alignment — so you can compute it
once those are known, and the number differs between a JVM with default settings and one with
`-XX:+UseCompactObjectHeaders` or a widened alignment. That is the whole reason JOL exists: you
ask the JVM that will actually run the code rather than quoting a number. The practical point
behind the question is usually that boxing is not free, and a `Map<Long, Long>` costs far more
than sixteen bytes per entry.

**★ What is the difference between `ClassLayout` and `GraphLayout`?**
`ClassLayout` gives the shallow layout of a single object: header, fields in the order the JVM
chose, padding, and the instance size. It does not follow references — a `String` field is
reported as the reference slot. `GraphLayout` walks everything reachable from an instance and
reports the total, with `toFootprint()` breaking it down by class. It is the difference between
shallow and retained size in a heap analyser, and it has the same trap: shared structure is
counted in full for whoever you measured, so summing graph sizes across objects double-counts.

**★ You measure a small domain object with `GraphLayout` and it reports 40 MB. What happened?**
It followed a reference into something large and shared — most commonly a service, a repository,
a `Logger`, a Spring bean or a `ClassLoader` held as a field. The number is arithmetically
correct: everything it reported really is reachable from that object. The question was wrong.
`toFootprint()`'s per-class breakdown identifies the culprit in one read, and the finding is often
itself useful, because a domain object holding a reference to a service is frequently a design
problem as well as a measurement problem.

**★ Why can't you just calculate object sizes by hand from the field types?**
Because three things the source does not show you affect the result. The JVM reorders fields to
minimise padding rather than following declaration order, and lays superclass fields out before
subclass ones, which can introduce padding you did not account for. Arrays carry a length field
that objects do not. And four JVM settings — compressed oops, compressed class pointers, compact
object headers, and object alignment — each change the answer and vary between environments. Hand
arithmetic is a good sanity check and a bad source of truth.

**★ Why does JOL claim to be more accurate than reading a heap dump?**
Because of how it gets its information. The project says it is *"much more accurate than other
tools relying on heap dumps, specification assumptions, etc."* on the grounds that it uses
`Unsafe`, JVMTI and the Serviceability Agent to inspect the live JVM's actual layout, rather than
inferring sizes from a dump format or from what the specification permits. The trade-off is scope:
JOL tells you the truth about objects you hand it in a JVM you are running, while a heap dump
tells you about every object in a production heap. They answer different questions and the right
tool depends on which one you have.

**★ You want to decide whether to replace a `HashMap<Long, Long>` with a primitive-specialised
map. How would you make the case?**
Measure rather than argue. Build a representative instance and run `GraphLayout.parseInstance` on
it, then read `toFootprint()` for the per-class breakdown — it will show the boxed `Long` keys and
values and the node objects separately from the payload, which makes the overhead per entry
explicit instead of theoretical. Record `VM.current().details()` alongside it so the number is
reproducible and so nobody can dismiss it as a laptop artefact. Then extrapolate to the real entry
count. The resulting number is usually large enough that the decision makes itself, and having it
in bytes rather than in intuition is what carries the argument.

**★ A colleague reports an object size from their laptop and it disagrees with production.
Explain.**
Almost certainly a layout-flag difference rather than a mistake. The most likely candidate is
compressed oops: a laptop JVM with a small heap has them on, and a production JVM with a heap over
32 GB has them off, which changes every reference field from 4 bytes to 8 and the class word too.
Compact object headers being enabled in one place and not the other would do it as well, as would
a non-default `ObjectAlignmentInBytes`. The way to settle it is to print `VM.current().details()`
in both environments and compare — which is why recording that alongside any measurement is the
habit worth having.

{/* FOOTER */}
