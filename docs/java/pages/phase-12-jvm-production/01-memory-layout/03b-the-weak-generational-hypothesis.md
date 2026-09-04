---
title: "The entire generational heap rests on one measured claim — that most objects die young — and the tuning guide is careful to say only that a surprisingly large number of applications look that way, which means yours might be one of the ones that does not"
sidebar_label: "03b · The weak generational hypothesis"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **HotSpot Virtual Machine Garbage Collection Tuning Guide,
> Release 25**, chapters "Garbage Collector Implementation → Generations" and "Factors
> Affecting Garbage Collection Performance → The Young Generation"
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/gctuning/garbage-collector-implementation.html)),
> the **JDK 25 `java` tool reference** for `-Xlog` and `-XX:MaxTenuringThreshold`
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html)),
> and the JDK 25 HotSpot source `src/hotspot/share/gc/shared/gc_globals.hpp` at tag
> `jdk-25+36`
> ([github.com/openjdk/jdk](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/gc/shared/gc_globals.hpp)).
> JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9.

**[03](03-the-heap.md) described the shape of the heap. This page is the claim that shape is
an answer to. Generations are not a law of computer science; they are a bet on a measured
property of real programs, and the tuning guide states that property with a hedge that almost
every retelling drops. Knowing the hedge is what lets you recognise the workload where the
generational design is pure overhead — and stop tuning survivor spaces for an application that
was never going to benefit from them.**

## The claim, in the tuning guide's own words

> *"To make garbage collection fast, memory is managed in generations… These generations hold
> objects of different ages. The most important of these observed properties is the **weak
> generational hypothesis**, which states that most objects survive for only a short period of
> time."*

Two words in that sentence do the work.

**"Observed."** This is not derived from anything. It is an empirical claim about the
programs people actually write, established by measurement in the 1980s and re-established
every time somebody profiles a new class of workload. It could have been false. For some
programs it is.

**"Most."** Not all, and not "objects live for a short time" — *most objects*, weighted by
count and by bytes allocated. A program that allocates a hundred million short-lived iterators
and one long-lived 4 GB cache satisfies the hypothesis by count and by allocation volume,
while its *live set* is dominated entirely by the thing that violates it. Both facts are true
at once, and they pull tuning in opposite directions.

## The distribution the design is fitted to

The guide's Figure 3-1 is described in the text, and the description is the part worth
carrying:

> *"The x-axis shows object lifetimes measured in bytes allocated. The sharp peak at the left
> represents objects that can be reclaimed shortly after being allocated. For example,
> iterator objects are often only alive for the duration of a single loop."*

Note the x-axis. **Lifetime is measured in bytes allocated, not in seconds.** That choice is
deliberate and it matters: a garbage collector's clock is allocation, not wall time. An object
that lives for ten minutes in an idle service may survive zero collections; an object that
lives for eight milliseconds under a 2 GB/s allocation rate may survive several. When someone
says "this object is short-lived", the only question that predicts GC behaviour is *how many
bytes were allocated while it was reachable*.

This is also why the same code has completely different generational behaviour under load and
at rest, and why a heap that looks healthy in staging can promote heavily in production
without a line of code changing.

## The hedge nobody quotes

The sentence immediately after the description of the curve:

> *"Some applications have very different looking distributions, but a surprisingly large
> number possess this general shape."*

That is the honest version of the claim, and it is materially weaker than "most objects die
young" delivered as a law. The guide is saying: this shape is common enough to justify
building the default collector around it, and your application may not have it.

**A generational collector applied to a workload that does not have that shape does strictly
more work than a non-generational one would.** It pays for write barriers, for remembered
sets or card tables, for copying survivors between two spaces several times before promoting
them — and gets back nothing, because nothing died in the young generation.

## Why the payoff is so large when the claim does hold

The economics are stated flatly:

> *"The costs of such collections are, to the first order, proportional to the number of live
> objects being collected; a young generation full of dead objects is collected very quickly."*

A copying young collection walks from the roots, copies what it finds into a survivor space,
and then declares the entire source region free without ever touching a dead object. So the
cost is `O(survivors)`, and the *garbage is free*. If 98% of eden is dead at collection time,
you paid for 2% of it.

That is the whole bargain: **make the common case — an object nobody kept — cost nothing.**
Every structural feature in [03](03-the-heap.md) exists to buy it. Two survivor spaces exist so
copying never needs a free-list. Aging exists so an object is not promoted on the strength of
one lucky collection. The 8:1:1 default split exists because a small survivor is enough when
the hypothesis holds.

## The workloads where it does not hold

These are not exotic. Most systems have at least one of them somewhere.

| Workload | Why it violates the hypothesis | What you see |
|---|---|---|
| **In-memory cache** (`Caffeine`, an LRU map, a warmed lookup table) | Entries are created to be kept. Survival is the *purpose*. | Steady promotion; old generation grows to the cache's size and stops |
| **HTTP session state held in the JVM** | Lifetime is a user's session, which is minutes — thousands of collections | Survivors every cycle, tenuring threshold pinned low |
| **Object pools** (connections, buffers, reusable DTOs) | Deliberate immortality; the pool exists so objects are *not* garbage | Constant old-generation occupancy, and pooled objects that outlive their usefulness |
| **Batch jobs with a large working set** | The whole point is holding a big structure while iterating | Young collections that copy almost everything, then promote it anyway |
| **Streaming windows / aggregation buffers** | Objects live exactly one window, which is long relative to allocation rate | Sawtooth promotion synchronised to the window |
| **Anything that reads a large file into memory** | The parsed graph survives by construction | A single spike that promotes wholesale |

The tell in all six cases is the same: **the survivor age histogram is flat or rising instead
of collapsing**, and old-generation occupancy rises with load rather than with time.

## Measuring whether it holds for *your* application

You do not have to reason about this. One flag answers it:

```bash
java -Xlog:gc,age:file=gc-age.log:time,uptime -jar app.jar
```

`-Xlog:gc,age` prints the survivor age histogram at every young collection: how many bytes are
at age 1, age 2, and so on, plus the tenuring threshold the JVM chose for that cycle.

Read it as a shape, not as numbers:

- **Collapsing** — most bytes at age 1, an order of magnitude less at age 2, essentially
  nothing by age 4. The hypothesis holds. The default configuration is right and there is
  nothing to tune.
- **Flat** — comparable bytes at every age up to the threshold. Objects are surviving on
  purpose. Something in the application is holding them, and enlarging the young generation
  will make each collection copy more of them.
- **Rising, with the threshold pinned at 1** — the survivor space cannot hold one cycle's
  survivors, so the JVM has lowered the threshold to the floor and is promoting everything
  immediately. This is premature promotion, and [03d](03d-aging-and-promotion.md) is the page
  for it.

The cost of the flag is one line of log per young collection. There is no reason not to have
run it once on any service you own.

## What the answer changes

If the histogram collapses, **stop**. The generational design is doing its job, and the
knobs in [03](03-the-heap.md) are not your problem — go and measure something else.

If it does not collapse, the useful question is *why*, and it is an application question, not
a flag question:

1. **Is something caching that should not be?** An unbounded `Map` used as a cache is the
   single most common answer, and it is not a GC problem.
2. **Is the working set genuinely large?** Then size the old generation for it and accept
   that young collections will copy. A larger *survivor* space (a lower `-XX:SurvivorRatio`)
   can help genuinely medium-lived objects die in the young generation instead of being
   promoted, but only if they actually die within a few collections.
3. **Is the object lifetime tied to a request or a window?** Then the shape is intrinsic, and
   the right response is to reduce *allocation* — reuse buffers, avoid intermediate
   collections, stream instead of materialising — rather than to re-shape the heap around it.

A flag never fixes a violated hypothesis. It only decides who pays for it.

## Why the collectors went generational anyway

The most interesting evidence for the hypothesis is that the collector built explicitly to
*not* need it changed its mind. ZGC was originally non-generational: a single space, concurrent
marking and relocation, no young/old split at all. On JDK 25 there is no such mode —
generational ZGC became the default in JDK 23 and the non-generational mode was **removed** in
JDK 24, so `-XX:+UseZGC` *is* generational ZGC.

The reasoning is exactly the economics above: even a collector that can mark and relocate
concurrently still pays proportionally to the live set it traverses, and traversing the young
generation separately and far more often is cheaper than traversing everything at one rate.
Concurrency changes *when* you pay; generations change *how much*.

⚠️ The algorithms themselves belong to `02 · GC in practice` *(not written yet)*. What belongs
here is the conclusion: **every production collector on JDK 25 is generational, so the
hypothesis is not one collector's assumption — it is the platform's.**

## Gotchas

**★ "Most objects die young" is a claim about your program, not about Java.**
It is an observed property of typical workloads, quoted by the tuning guide as such, with the
explicit caveat that *"some applications have very different looking distributions"*. Treating
it as an invariant leads to tuning that assumes a shape the application does not have.

**★ Object lifetime is measured in bytes allocated, not in seconds.**
The guide's own axis. An object's chance of surviving a collection depends on the allocation
rate while it is reachable, which is why the same object is "short-lived" at 3 a.m. and
"medium-lived" at peak. Any lifetime intuition expressed in milliseconds is untethered from
what the collector actually does.

**★ A cache is a hypothesis violation by design, and that is not a bug.**
The correct response to "my cache is promoted to the old generation" is *yes, that is what a
cache is*. Size the old generation for it. The bug case is the cache you did not know you had.

**★ The hypothesis holding by *count* says nothing about your live set.**
Ninety-nine percent of objects dying young is fully compatible with a 6 GB retained heap. The
histogram tells you about the flow; occupancy after a full collection tells you about the
stock. They are different measurements and they answer different questions.

**★ A flat age histogram is not automatically bad.**
It means objects survive deliberately. If that matches what the application is for — a session
store, a warmed cache, a batch working set — then the heap is behaving correctly and the only
question is whether it is sized for it. "Flat is bad" is a heuristic for request-scoped
services, not a law.

**★ Enlarging the young generation when the hypothesis fails makes pauses worse, not better.**
More eden means more allocation between collections, but if survival is high, each collection
copies proportionally more. You have traded frequency for duration and usually lost, because
duration is what your p99 measures.

**★ Objects that die *immediately* may never be allocated at all.**
Escape analysis can scalar-replace an object whose reference never escapes its method, so the
allocation the hypothesis is about does not happen. This means a microbenchmark "proving" that
short-lived allocation is free may be measuring the JIT deleting the allocation rather than the
collector reclaiming it cheaply.

**★ `-Xlog:gc,age` is nearly free and almost nobody turns it on.**
One line per young collection. It is the only direct measurement of the assumption every other
heap decision rests on, and it costs nothing to have been running for a week before the
incident.

## Interview questions

**★ What is the weak generational hypothesis, and what does the JVM do with it?**
The observed property that most objects survive only a short time. HotSpot exploits it by
segregating new allocation into a young generation and collecting only that generation most of
the time. Because a copying collector's cost is proportional to the live objects it copies —
the tuning guide's *"proportional to the number of live objects being collected"* — collecting
a space that is mostly dead is nearly free, and the garbage costs nothing at all.

**★ The guide hedges the hypothesis. What is the hedge, and why does it matter?**
*"Some applications have very different looking distributions, but a surprisingly large number
possess this general shape."* It matters because for the applications with a different shape,
the generational machinery — write barriers, card tables, copying between survivor spaces,
aging — is overhead paid for a benefit that never arrives. Recognising that case stops you
tuning survivor ratios for a workload whose objects were always going to survive.

**★ How would you determine whether the hypothesis holds for a service you have just
inherited?**
Run it with `-Xlog:gc,age` and read the survivor age histogram over a representative load
period. Bytes concentrated at age 1 and falling off sharply means it holds. Bytes spread
evenly across ages, or a tenuring threshold pinned at 1, means objects are surviving —
at which point the question becomes what is retaining them, which is an application question
answered with a heap dump, not a flag.

**★ Why is object lifetime measured in bytes allocated rather than in time?**
Because collections are triggered by allocation, not by the clock. The number of collections
an object must survive is a function of how many bytes were allocated during its life. Two
identical objects with identical wall-clock lifetimes have entirely different promotion
outcomes at different load levels, so bytes-allocated is the unit that actually predicts
behaviour.

**★ Your service holds a 4 GB in-memory cache and someone says GC tuning will fix your long
pauses. What do you say?**
That the cache is a deliberate violation of the assumption the young generation exploits, so
no young-generation tuning will help: those objects are alive and will be copied and promoted
whatever the survivor ratio is. The real options are to size the old generation for the live
set and choose a collector whose pauses do not scale with it, to bound the cache, or to move
it out of the heap entirely. Tuning `-Xmn` here reshapes the cost, it does not remove it.

**★ ZGC was designed to be non-generational. Why is it generational now?**
Because concurrency and generations solve different halves of the problem. Concurrent marking
and relocation reduce *pause* time, but total work still scales with the live set traversed,
and traversing everything at one frequency wastes effort on objects that are overwhelmingly
long-lived. Generational ZGC became the default in JDK 23 and the non-generational mode was
removed in JDK 24, so on JDK 25 there is no non-generational option — the strongest available
evidence that the hypothesis pays even for a collector that did not need it to be correct.

**★ Can the hypothesis hold and your application still have a heap problem?**
Yes, and it is the common case. The hypothesis is about the *flow* of objects; a leak is about
the *stock*. A service can discard 99.9% of what it allocates and still add a megabyte a minute
to a static list. Young-generation health tells you nothing about old-generation retention,
which is why the diagnostic for a suspected leak is occupancy after a full collection, not the
age histogram.

{/* FOOTER */}
