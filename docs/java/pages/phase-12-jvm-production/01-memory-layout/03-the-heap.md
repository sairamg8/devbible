---
title: "The heap is not one space but eden, two survivor spaces and an old generation, and every one of those four exists to make the common case — an object that dies almost immediately — cost nothing to collect"
sidebar_label: "03 · The heap"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the **HotSpot Virtual Machine Garbage Collection Tuning Guide,
> Release 25**, chapters "Garbage Collector Implementation → Generations" and "Factors
> Affecting Garbage Collection Performance → The Young Generation"
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/gctuning/garbage-collector-implementation.html),
> [factors-affecting…](https://docs.oracle.com/en/java/javase/25/gctuning/factors-affecting-garbage-collection-performance.html)),
> and the **JDK 25 `java` tool reference** — `-XX:NewRatio`, `-XX:NewSize`,
> `-XX:MaxNewSize`, `-XX:SurvivorRatio`, `-XX:TargetSurvivorRatio`,
> `-XX:MaxTenuringThreshold`, `-XX:MinHeapFreeRatio`, `-XX:MaxHeapFreeRatio`
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html)).
> JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9.

**A generational heap is a bet: that most objects die young, so if you segregate new objects
into a small space and collect only that space, you pay in proportion to the *survivors*
rather than to the garbage. Everything about the heap's shape — why there are two survivor
spaces and not one, why eden is eight times bigger than a survivor by default, why objects
are copied several times before being promoted — follows from that bet. This page is the
shape and the flags that control it. The bet itself, and where it fails, is
[03b · The weak generational hypothesis](03b-the-weak-generational-hypothesis.md); the
algorithms that operate on the shape are `02 · GC in practice` *(not written yet)*.**

## The four spaces, in the tuning guide's own words

> *"To optimize garbage collection, memory is managed in generations (memory pools holding
> objects of different ages). Garbage collection occurs in each generation when the
> generation fills up."*
>
> *"The vast majority of objects are allocated in a pool dedicated to young objects (the
> young generation), and most objects die there. When the young generation fills up, it
> causes a minor collection in which only the young generation is collected; garbage in
> other generations isn't reclaimed. The costs of such collections are, to the first order,
> proportional to the number of live objects being collected; a young generation full of
> dead objects is collected very quickly."*

That last sentence is the whole design in one line: **you pay for what survives, not for what
you allocated.** A young generation containing one million dead objects and ten live ones
costs the same to collect as one containing ten live objects and nothing else.

The young generation is itself three spaces:

> *"The young generation consists of eden and two survivor spaces. Most objects are initially
> allocated in eden. One survivor space is empty at any time, and serves as the destination
> of live objects in eden and the other survivor space during garbage collection; after
> garbage collection, eden and the source survivor space are empty. In the next garbage
> collection, the purpose of the two survivor spaces are exchanged. The one space recently
> filled is a source of live objects that are copied into the other survivor space. Objects
> are copied between survivor spaces in this way until they've been copied a certain number
> of times or there isn't enough space left there. These objects are copied into the old
> region. This process is also called aging."*

And promotion out of the young generation:

> *"Typically, some fraction of the surviving objects from the young generation are moved to
> the old generation during each minor collection. Eventually, the old generation fills up
> and must be collected, resulting in a major collection, in which the entire heap is
> collected. Major collections usually last much longer than minor collections because a
> significantly larger number of objects are involved."*

## Why *two* survivor spaces

This is the question that separates people who have read the shape from people who have
understood it. The answer is that a copying collector needs a destination that is guaranteed
empty.

A minor collection copies live objects out of eden **and** out of the currently-occupied
survivor space, into the other survivor space. Afterwards, eden and the source survivor are
entirely empty and can be reused with a single pointer reset — no compaction, no free lists,
no fragmentation. If there were only one survivor space you would be copying into a space
that already contains objects, which means either compacting it or maintaining free lists,
and you would lose the property that makes minor collections cheap.

The cost is that one survivor space is always empty. That is the price of never having to
compact the young generation.

## The default shape, and the flags that set it

The tuning guide's Table 4-1, verbatim:

| Option | Default Value |
|---|---|
| `-XX:NewRatio` | 2 |
| `-XX:NewSize` | 1310 MB |
| `-XX:MaxNewSize` | not limited |
| `-XX:SurvivorRatio` | 8 |

Read with the man page's definitions:

> *"`-XX:NewRatio=ratio` … For example, setting `-XX:NewRatio=3` means that the ratio between
> the young and old generation is 1:3. In other words, the combined size of the eden and
> survivor spaces will be one-fourth of the total heap size."*
>
> *"`-XX:SurvivorRatio=ratio` — Sets the ratio between eden space size and survivor space
> size. By default, this option is set to 8. … For example, `-XX:SurvivorRatio=6` sets the
> ratio between eden and a survivor space to 1:6. In other words, each survivor space will be
> one-sixth of the size of eden, and thus one-eighth of the size of the young generation (not
> one-seventh, because there are two survivor spaces)."*

So with the defaults, on a collector that uses this classic layout: the young generation is
one third of the heap (`NewRatio=2` means young:old = 1:2), and inside it a survivor is
one-eighth of eden, so the young generation divides as eden 8, survivor 1, survivor 1 — eden
is 80 percent of the young generation and each survivor is 10 percent.

The man page also gives the formula for survivor size directly:

> *"The following formula can be used to calculate the initial size of survivor space (S)
> based on the size of the young generation (Y), and the initial survivor space ratio (R):
> `S=Y/(R+2)`. The 2 in the equation denotes two survivor spaces."*

⚠️ The `-XX:NewSize` default of "1310 MB" in Table 4-1 should be read with the chapter's own
caveat, which precedes the whole discussion: *"The following discussion regarding growing and
shrinking of the heap, the heap layout, and default values uses the serial collector as an
example. While the other collectors use similar mechanisms, the details presented here may not
apply to other collectors."* In practice the young generation size is set ergonomically from
the heap size and the collector; `-XX:MaxNewSize`'s documented default of *"not limited"*
means *"the calculated value isn't limited by `-XX:MaxNewSize` unless a value for
`-XX:MaxNewSize` is specified on the command line"*. Treat the table as the serial collector's
documented defaults, not as universal constants.

## G1 changes the picture without changing the model

Everything above describes a heap laid out as three contiguous regions. G1 — the default
collector on JDK 25 — divides the heap into a few thousand equal-sized regions and labels
each one eden, survivor, old or humongous. The *generational model is identical*: eden,
survivors, aging, tenuring, promotion. What changes is that the boundaries are not contiguous
and the sizes are adjusted every collection to meet a pause-time goal, which is why setting
`-Xmn` or `-XX:NewRatio` under G1 disables the adaptive sizing that is the main reason to
choose G1 in the first place.

Humongous objects — allocations that do not fit in a single region — are a G1-specific concept
with real consequences for this map, and they belong to `02 · GC in practice`
*(not written yet)*.

## Where the rest of the heap story lives

The *policy* that moves objects between these spaces — how an age is counted, how the
tenuring threshold is chosen and re-chosen every collection, what premature promotion is and
what happens when there is nowhere to copy to — is
[03d · Aging and promotion](03d-aging-and-promotion.md). The measured claim the whole design
rests on is [03b · The weak generational hypothesis](03b-the-weak-generational-hypothesis.md),
and why allocating into eden is almost free is
[03c · TLABs and allocation](03c-tlabs-and-allocation.md).

## Gotchas

**★ There are two survivor spaces because a copying collector needs an empty destination.**
"Why not one?" is the standard follow-up and the standard wrong answer is "for redundancy".
The reason is that after a collection, eden and the from-space must be *entirely* empty so
they can be reused by a pointer reset. Copying into a partially occupied space would require
compaction or free lists, which is exactly the cost the design avoids.

**★ One survivor space is always empty, by design, and that is not waste to be optimised.**
People discover the empty space and try to reclaim it with `SurvivorRatio`. Shrinking the
survivors causes premature promotion, which costs far more than the idle space saved.

**★ `SurvivorRatio=8` means a survivor is one-eighth of *eden*, not one-eighth of the young
generation.**
The man page spells out the trap: *"each survivor space will be one-sixth of the size of eden,
and thus one-eighth of the size of the young generation (not one-seventh, because there are
two survivor spaces)"*. Getting this off by one is why hand-computed young-generation layouts
rarely match reality.

**★ Setting `-Xmn` or `-XX:NewRatio` under G1 turns off the thing you chose G1 for.**
G1 resizes the young generation every collection to hit its pause target. Fixing the young
size makes that impossible, and the usual outcome is worse pause times than the defaults.
Fix the young generation only when you have a measurement that says the adaptive sizing is
wrong, and expect to own the number afterwards.

**★ The tuning guide's Table 4-1 describes the *serial* collector.**
The chapter says so before the table: the discussion of heap layout and default values *"uses
the serial collector as an example"* and *"the details presented here may not apply to other
collectors"*. Quoting `NewSize = 1310 MB` as a universal JVM default is a common and confusing
error; the young generation is sized ergonomically in practice.

**★ A survivor space that is uselessly large is a real cost, not just tidiness.**
The tuning guide: *"If survivor spaces are too large, then they are uselessly empty."* That
space is committed heap that could have been eden, so a too-large survivor makes minor
collections *more frequent* by shrinking the allocation buffer, while the survivors it was
sized for never materialise.

**★ Objects are not always allocated in eden.**
Very large allocations can go straight to the old generation on some collectors, and under G1
anything larger than half a region is a humongous allocation placed directly in old-generation
regions. "Everything is born in eden" is a good first approximation and a wrong one at the
sizes where it matters.

## Interview questions

**★ Why does the young generation have two survivor spaces?**
Because the collector copies live objects rather than compacting in place, and a copying
collector needs a destination it can assume is empty. A minor collection evacuates eden and
the occupied survivor into the empty survivor; afterwards eden and the source survivor are
entirely free and are reused by resetting a pointer, with no compaction and no free lists.
With one survivor space you would be copying into occupied memory, which reintroduces exactly
the cost the generational design exists to avoid. The price is that one survivor is always
idle, and that price is deliberate.

**★ Why are minor collections cheap?**
Because their cost is proportional to the *live* set, not to the size of the space. The tuning
guide states it directly: *"The costs of such collections are, to the first order,
proportional to the number of live objects being collected; a young generation full of dead
objects is collected very quickly."* A copying collector touches only survivors — it walks
from the roots, copies what it finds, and then declares the whole source space free. Objects
that died are never visited at all, so allocating and discarding a million short-lived objects
costs almost nothing at collection time.

**★ What does `-XX:SurvivorRatio=8` actually mean?**
That each survivor space is one-eighth the size of eden. Since there are two survivors, the
young generation divides into eden : survivor : survivor as 8 : 1 : 1, so eden is 80 percent
of the young generation and each survivor is 10 percent. The man page is explicit that this is
*"one-eighth of the size of the young generation (not one-seventh, because there are two
survivor spaces)"*, which is the off-by-one almost everyone makes the first time.

**★ Does G1 still have eden and survivor spaces?**
Yes — the generational model is unchanged. What changes is the layout: instead of three
contiguous spaces, the heap is divided into a few thousand equal-sized regions and each region
is labelled eden, survivor, old or humongous. Objects are still allocated in eden regions,
still copied to survivor regions and aged, still promoted to old regions at the tenuring
threshold. The benefit of the region layout is that the collector can choose *which* regions
to collect, and resize the generations every cycle to meet a pause-time goal — which is
precisely why pinning the young size with `-Xmn` under G1 is usually counterproductive.

**★ Someone sets `-Xmn` to half the heap to "reduce GC". Argue against it.**
It will reduce the *frequency* of young collections, because eden is bigger, but each one has
more to scan and more survivors to copy, so individual pauses grow. It also halves the old
generation, so if the live set is large the application will run closer to the old
generation's capacity and do more major collections — the expensive kind. And under G1 it
disables the adaptive resizing that is supposed to be hitting the pause target. The right
process is to measure with `-Xlog:gc*` and `-Xlog:gc,age`, decide whether the problem is
frequency or duration, and only then change a size — usually not this one.

**★ Where do the interned strings and class statics live, since they used to be in PermGen?**
On the Java heap, in the old generation in practice, since Java 8. JEP 122 moved class
*metadata* to native memory but explicitly moved *"interned Strings and class statics"* to the
Java heap. This is the detail most people get wrong: they remember "PermGen became metaspace"
and assume everything in PermGen moved to metaspace. Two of the three things did not. See
[04 · Metaspace](04-metaspace.md).

{/* FOOTER */}