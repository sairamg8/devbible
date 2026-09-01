---
title: "There is one case where you want to waste memory on purpose — two threads writing to fields that share a cache line — and the annotation the JVM provides for it is internal, restricted to trusted classes by default, ignored on static fields, and not inherited, which is four reasons the real answer is usually `LongAdder`"
sidebar_label: "08c2 · False sharing and @Contended"
sidebar_position: 33
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the JDK 25 HotSpot source at tag `jdk-25+36` —
> `src/hotspot/share/runtime/globals.hpp` for `ContendedPaddingWidth`, `EnableContended` and
> `RestrictContended`, and `src/hotspot/share/classfile/fieldLayoutBuilder.cpp` for the
> static-field rule
> ([github.com/openjdk/jdk](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/runtime/globals.hpp)),
> and the JDK 25 source for `jdk.internal.vm.annotation.Contended` and
> `java.util.concurrent.atomic.Striped64`
> ([github.com/openjdk/jdk](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/java.base/share/classes/java/util/concurrent/atomic/Striped64.java)).
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**[08c](08c-alignment-and-padding.md) treated padding as waste the JVM minimises. This page is
the one case where padding is the point: when two threads write to two different fields that
happen to occupy the same cache line, and the hardware makes them fight over memory they do not
share. The JVM has an annotation for it, and almost everything about that annotation is a reason
not to reach for it first.**

## What false sharing is

Cache coherence works at **cache-line granularity** — 64 bytes on typical x64 hardware, not per
field and not per byte. When a core writes to any byte in a line, it must take exclusive
ownership of the whole line, invalidating every other core's cached copy.

So if thread A writes `counterA` and thread B writes `counterB`, and the two fields happen to sit
within the same 64 bytes, every write by either thread invalidates the other's cache line. The
threads never touch the same data. The program is completely correct. And the two cores spend
their time bouncing a cache line between them instead of computing.

🔴 **The defining property is that nothing in the source code suggests any interaction.** There
is no shared field, no lock, no contended object. The coupling exists only in the memory layout,
which is chosen by the JVM and never appears in the program text. That is what makes it hard to
find and satisfying to explain — sometimes too satisfying, as below.

**The severity is real.** Two threads in a tight loop on adjacent fields can run an order of
magnitude slower than the same two threads on fields in different lines, and the slowdown gets
worse with core count rather than better.

## `@Contended`, and its four disqualifications

HotSpot supports fixing this directly. From `globals.hpp`, verbatim:

```cpp
product(int,  ContendedPaddingWidth, 128, "How many bytes to pad the fields/classes marked @Contended with") range(0, 8192)
product(bool, EnableContended,   true,  "Enable @Contended annotation support")
product(bool, RestrictContended, true,  "Restrict @Contended to trusted classes")
```

**The padding is 128 bytes, not 64.** Double a typical cache line, because adjacent-line
prefetching can pull the neighbouring line in as well — padding to exactly one line is not
reliably enough, which is also a warning about hand-rolled padding sized to 64.

The annotation is `jdk.internal.vm.annotation.Contended`, with `@Retention(RUNTIME)`,
`@Target({FIELD, TYPE})` and `String value() default ""` naming a *contention group*, so several
fields can be padded as a unit rather than individually. Its javadoc carries the warning that
should govern its use:

> *"The effects of this annotation will nearly always add significant space overhead to
> objects."*

And then four rules, each of which rules out a case somebody was about to use it for:

🔴 **1 · `RestrictContended` defaults to `true`, so it does nothing in your code.** The annotation
applies only to trusted (boot classpath) classes by default. Using it from application code
requires starting the JVM with `-XX:-RestrictContended` — so the class's performance
characteristics depend on a flag that is invisible at the call site and that nobody reviewing the
code will see. A deployment that loses the flag loses the padding silently.

🔴 **2 · It is ignored for static fields.** `fieldLayoutBuilder.cpp` states it directly:
*"@Contended annotation is ignored for static fields"*. Since a shared mutable counter is very
often `static`, this rules out precisely the first case people reach for it to fix.

🔴 **3 · It is not inherited.** Annotating a superclass does nothing for a subclass's fields. Each
class's own fields are laid out under its own annotations, so a base class cannot pad on behalf
of its descendants.

🔴 **4 · It is an internal API.** `jdk.internal.vm.annotation` is not exported for ordinary use.
Depending on it couples application code to a JDK internal that carries no compatibility promise.

**A class-level annotation** does work differently and is occasionally what you want: it groups
all un-annotated **non-static** fields into one anonymous group and pads that group as a whole,
which separates the object's fields from whatever is adjacent in memory rather than separating
them from each other.

## The JDK's own use — and the answer you should usually give

`java.util.concurrent.atomic.Striped64.Cell` is annotated
`@jdk.internal.vm.annotation.Contended`, and the class comment explains exactly why:

> *"Table entries are of class Cell; a variant of AtomicLong padded (via @Contended) to reduce
> cache contention… Atomic objects residing in arrays will tend to be placed adjacent to each
> other, and so will most often share cache lines (with a huge negative performance impact)
> without this precaution."*

That is `LongAdder`'s entire design in one sentence: an array of counters, one per contending
thread, each padded onto its own cache line, summed on read.

🔴 **So if the problem is a hot shared counter, the answer is `LongAdder`, not `@Contended` on
your own field.** It lives in trusted code where the annotation actually applies without a flag,
it has been tuned and tested, and it solves the striping problem as well as the padding one. The
trade is that reading the total must sum the cells, so it is for write-heavy, read-rare counters —
metrics, request counts, accumulators — and `AtomicLong` remains right when reads are frequent or
when you need atomic read-modify-write on the total.

## Manual padding, and why it is fragile

For application code that genuinely needs it, the supported alternative is padding by hand:
declaring unused fields to push the hot ones apart.

```java
class PaddedCounter {
    long p1, p2, p3, p4, p5, p6, p7;   // padding
    volatile long value;
    long p8, p9, p10, p11, p12, p13, p14;
}
```

⚠️ **This works, and it is unreliable in ways worth naming.** The JVM reorders fields
([08c](08c-alignment-and-padding.md)), so there is no guarantee the padding lands where you
intended. A sufficiently clever JIT may treat provably-unread fields as dead. The construction is
invisible to anyone reading the class later, who will delete it as obviously useless. And sizing
it to 64 bytes may be insufficient given that the JVM's own `ContendedPaddingWidth` is 128.

If you write it: comment it with the reason, verify the resulting layout with JOL
([08d](08d-measuring-an-object.md)), and keep the benchmark that justified it next to the class.

## Measure before you pad

⚠️ **False sharing is real, severe, and over-diagnosed.** It is an unusually satisfying
explanation — invisible in the source, blames the hardware, requires expertise to spot — which is
exactly the profile of a hypothesis people adopt without evidence.

What counts as evidence:

- A profiler showing **cache-coherence stalls** or high cross-core cache-line transfer attributed
  to specific fields. `perf c2c` on Linux is the direct measurement; async-profiler and JFR can
  point at the region (topic 06 owns the tooling).
- A **scaling curve that gets worse with more cores** on a workload with no shared state. That
  shape is close to diagnostic, because ordinary contention on a real lock scales differently.
- A **controlled experiment**: add padding, measure, remove it, measure again. If the difference
  is not reproducible, the hypothesis was wrong.

What does not count: two fields being declared next to each other and the code being slow.

## Gotchas

**★ `@Contended` does nothing in your code by default.**
`RestrictContended` is `true`, restricting the annotation to trusted classes. Application use needs
`-XX:-RestrictContended`, so the behaviour depends on a JVM flag that is invisible at the call
site — and silently disappears if a deployment drops it.

**★ `@Contended` is ignored on static fields.**
`fieldLayoutBuilder.cpp`: *"@Contended annotation is ignored for static fields"*. The shared
mutable counter people reach for it to fix is very often static, so the first instinct is the one
case it cannot help.

**★ `@Contended` is not inherited.**
Annotating a base class does not pad a subclass's fields. Layout is computed per class under its
own annotations.

**★ It is an internal annotation.**
`jdk.internal.vm.annotation.Contended` is not a supported public API, and depending on it couples
application code to a JDK internal with no compatibility promise.

**★ The padding width is 128 bytes, not one cache line.**
`ContendedPaddingWidth` defaults to 128 — double a typical 64-byte line, because adjacent-line
prefetching can pull in the neighbour. Manual padding sized to exactly 64 bytes may not be enough,
and the JVM's own choice is the hint.

**★ If the problem is a hot shared counter, use `LongAdder`.**
`Striped64.Cell` already applies `@Contended` from trusted code, where it works without a flag,
and it stripes as well as pads. Reimplementing it in application code is more fragile and rarely
faster.

**★ `LongAdder` is not a drop-in replacement for `AtomicLong`.**
Reading the total sums the cells, so it is for write-heavy, read-rare counters. If you read
frequently, or need an atomic read-modify-write on the total, `AtomicLong` is still correct.

**★ Manual padding fields can be reordered or eliminated.**
The JVM does not guarantee they land where you put them, and a JIT may treat provably-unread
fields as dead. Verify the achieved layout rather than trusting the declaration.

**★ Manual padding is invisible to the next maintainer.**
Seven unused `long` fields look like dead code and will be deleted by someone tidying up, silently
restoring the original performance problem. A comment and a benchmark are part of the fix, not
optional extras.

**★ False sharing is over-diagnosed.**
It causes severe, invisible slowdowns, and it is also a satisfying explanation for problems with
other causes. Require profiler evidence of coherence stalls, or a scaling curve that worsens with
core count, before padding anything.

**★ Padding costs memory on every instance, forever.**
128 bytes per contended field, on an object you may allocate by the million. The annotation's own
javadoc warns it *"will nearly always add significant space overhead"*. It is a trade of memory
for contention, and it is only worth it where the contention is measured.

## Interview questions

**★ What is false sharing, and how do you fix it?**
Two threads writing to different fields that occupy the same cache line. Coherence works at
cache-line granularity, so each write invalidates the other core's copy even though the threads
share no data — correct behaviour, destroyed performance, and nothing in the source suggesting an
interaction. The fix is to separate the fields onto different lines: `@Contended` in trusted code,
manual padding in application code, and in the common case of a contended counter, `LongAdder`,
which does exactly this internally.

**★ Why can't you just annotate your own field with `@Contended`?**
Because `RestrictContended` defaults to `true`, restricting the annotation to trusted classes, so
in application code it does nothing unless the JVM is started with `-XX:-RestrictContended`. It is
also `jdk.internal.vm.annotation.Contended` — an internal API — it is ignored on static fields,
and it is not inherited. Its own javadoc warns that it *"will nearly always add significant space
overhead"*.

**★ How does `LongAdder` beat `AtomicLong` under contention?**
By splitting the counter into an array of `Striped64.Cell` objects, one per contending thread, so
threads increment different cells rather than contending on one memory location — and by padding
each cell with `@Contended` so the cells do not share cache lines. The class comment is explicit
that arrays of atomic objects otherwise *"share cache lines (with a huge negative performance
impact)"*. The trade is that reading the total must sum the cells.

**★ When would you still choose `AtomicLong` over `LongAdder`?**
When reads are frequent relative to writes, since `LongAdder.sum()` walks the cell array and is
neither atomic nor cheap; when you need a genuine atomic read-modify-write on the total, such as
`compareAndSet` or `getAndIncrement` with a used return value; and when contention is low, where
striping buys nothing and costs an array of padded cells. `LongAdder` is a write-heavy metrics
counter, not a general-purpose atomic.

**★ Why is the JVM's contended padding 128 bytes when a cache line is 64?**
Because adjacent-line prefetching can pull the neighbouring line into cache alongside the one
requested, so two fields one line apart can still interfere. Padding to double the line width
defeats that. It is also why hand-rolled padding sized to exactly 64 bytes sometimes fails to
produce the expected improvement.

**★ How would you establish that false sharing is actually your problem?**
Direct measurement rather than inspection: a profiler showing cache-coherence stalls attributed to
specific fields — `perf c2c` on Linux is the sharp tool — or a scaling curve that gets *worse* as
cores are added on a workload with no shared state, which is close to diagnostic. Then a controlled
experiment: add padding, measure, remove it, measure again. Two fields merely being declared next
to each other is not evidence.

**★ Your colleague adds seven unused `long` fields around a hot counter and the benchmark improves.
What do you say in review?**
That the diagnosis is plausible and the implementation is fragile: field order is not guaranteed
so the padding may not land where intended, the fields may be eliminated as dead, 64 bytes may be
too narrow given the JVM pads contended fields to 128, and the next maintainer will delete it as
dead code. Ask for a comment explaining it, a JOL check of the achieved layout, and the benchmark
kept alongside the class — then ask whether `LongAdder` solves the same problem with none of the
fragility.

{/* FOOTER */}
