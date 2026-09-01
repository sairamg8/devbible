---
title: "An object earns its way into the old generation by surviving a number of collections that the JVM recalculates every cycle, and when the survivor spaces cannot hold it the promotion happens anyway — which is the most expensive thing a heap can do to you"
sidebar_label: "03d · Aging and promotion"
sidebar_position: 13
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the **HotSpot Virtual Machine Garbage Collection Tuning Guide,
> Release 25**, "Factors Affecting Garbage Collection Performance → The Young Generation →
> Survivor Space Sizing"
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/gctuning/factors-affecting-garbage-collection-performance.html)),
the **JDK 25 `java` tool reference** — `-XX:MaxTenuringThreshold`,
> `-XX:TargetSurvivorRatio`, `-XX:SurvivorRatio`
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html)),
> and the JDK 25 HotSpot source `src/hotspot/share/gc/shared/gc_globals.hpp` at tag
> `jdk-25+36`
> ([github.com/openjdk/jdk](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/gc/shared/gc_globals.hpp))
> for `InitialTenuringThreshold`, `PretenureSizeThreshold`, `AlwaysTenure` and `NeverTenure`,
> none of which appear in the man page.
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**[03](03-the-heap.md) laid out the spaces. This page is the policy that moves objects
between them: how an age is counted, how the tenuring threshold is chosen and re-chosen every
collection, and what happens when the survivor space is too small to hold the survivors —
which converts cheap young-generation garbage into expensive old-generation garbage and is
the single most common heap-shape pathology in production.**

## Aging: how an object earns promotion

An object's **age** is the number of minor collections it has survived. Each collection copies
survivors from eden and the from-space into the to-space and increments their ages. When an
object's age reaches the *tenuring threshold*, it is promoted to the old generation instead.

The threshold is not fixed. The tuning guide:

> *"At each garbage collection, the virtual machine chooses a threshold number, which is the
> number of times an object can be copied before it's old. This threshold is chosen to keep
> the survivors half full. You can use the log configuration `-Xlog:gc,age` … to show this
> threshold and the ages of objects in the new generation. It's also useful for observing the
> lifetime distribution of an application."*

Three flags participate:

> *"`-XX:MaxTenuringThreshold=threshold` — Sets the maximum tenuring threshold for use in
> adaptive GC sizing. The largest value is 15. The default value is 15 for the parallel
> (throughput) collector."*
>
> *"`-XX:TargetSurvivorRatio=percent` — Sets the desired percentage of survivor space (0 to
> 100) used after young garbage collection. By default, this option is set to 50%."*

`MaxTenuringThreshold` caps the age; `TargetSurvivorRatio` is the "half full" target the
adaptive threshold aims at. The age itself is stored in the object header — four bits, which
is exactly why the maximum is 15. See [08 · The object header](08-the-object-header.md).

`-Xlog:gc,age` is the most under-used diagnostic in this whole area. It prints the age
distribution of survivors at each collection, which is a direct empirical measurement of your
application's object lifetime distribution — the very thing the generational bet is a bet
about.

## What happens when survivor space is too small

> *"If survivor spaces are too small, then the copying collection overflows directly into the
> old generation. If survivor spaces are too large, then they are uselessly empty."*

"Overflows directly into the old generation" is **premature promotion**, and it is the most
common heap-shape pathology. Objects that would have died at age 2 are promoted at age 1
because there was nowhere to put them, and they then have to be collected by a major
collection instead of a minor one — which is orders of magnitude more expensive. A service
under a load spike can promote most of a request's working set into the old generation and
then spend the next minute doing major collections to clean it up.

The symptom is old-generation occupancy that climbs with load and falls after a full
collection, with a young-generation collection frequency that looks normal. The diagnostic is
`-Xlog:gc,age`: if the age histogram is truncated — nothing surviving past age 1 or 2 when
your objects clearly live longer — the survivors are being spilled.


## The flags that are in the source but not in the man page

Four aging-related flags are `product` flags in `gc_globals.hpp` and are absent from the
JDK 25 `java` reference entirely. Their declarations are the authoritative documentation:

```cpp
product(uint, MaxTenuringThreshold,    15,
        "Maximum value for tenuring threshold")
        range(0, markWord::max_age + 1)

product(uint, InitialTenuringThreshold,    7,
        "Initial value for tenuring threshold")
        range(0, markWord::max_age + 1)

product(uint, TargetSurvivorRatio,    50,
        "Desired percentage of survivor space used after scavenge")

product(size_t, PretenureSizeThreshold, 0,
        "Maximum size in bytes of objects allocated in DefNew "
        "generation; zero means no maximum")

product(bool, AlwaysTenure, false,
        "Always tenure objects in eden (ParallelGC only)")

product(bool, NeverTenure, false,
        "Never tenure objects in eden, may tenure on overflow "
        "(ParallelGC only)")
```

Three things worth extracting from that block.

**The threshold starts at 7, not at 15.** `InitialTenuringThreshold` is 7; `MaxTenuringThreshold`
is the ceiling the adaptive algorithm may raise it to. An object therefore needs to survive
seven collections before its first opportunity to be promoted under the initial policy, and
the threshold moves from there in whichever direction keeps survivor occupancy near
`TargetSurvivorRatio`, which is 50 percent.

**The range is literally `markWord::max_age + 1`.** The constraint on both threshold flags is
written in terms of the maximum age representable in the mark word. This is the four-bit age
field of the object header, stated in the source as the reason for the limit — see
[08 · The object header](08-the-object-header.md). It is not a tunable policy number that
someone happened to pick.

**`PretenureSizeThreshold` and the tenure booleans are collector-specific and easy to
misapply.** `PretenureSizeThreshold` names "DefNew", the serial collector's young generation;
`AlwaysTenure` and `NeverTenure` are documented as *"(ParallelGC only)"*. On G1 — the JDK 25
default — none of them does what a blog post from 2013 says it does, and none of them is in
the man page, which is a reasonable signal about how much you should be reaching for them.

## Reading `-Xlog:gc,age`

This is the measurement that turns aging from theory into a number. Enable it and every young
collection prints the tenuring threshold it chose and a histogram of survivor bytes by age.

```
-Xlog:gc,age=debug:file=/var/log/gc-age.log:uptime,level,tags
```

You are looking for two things. First, **where the mass sits**: if almost all survivor bytes
are at age 1 and there is nothing at age 2 or beyond, your objects die between the first and
second collection and the generational assumption is working perfectly. If there is a large
volume at every age up to the threshold, you have a population of medium-lived objects — a
request-scoped cache, a batch accumulator — and those are the objects that will be promoted.

Second, **whether the threshold has collapsed**. A tenuring threshold that the JVM has driven
down to 1 or 2 means survivor space cannot hold the survivors at the current threshold, so
the JVM lowered it to shed them into the old generation. That is the adaptive algorithm
telling you, in a log line, that your survivor spaces are too small for your allocation
pattern.

## Evacuation failure: when there is nowhere to copy to

Everything above assumes the destination has room. When it does not — the survivor space is
full *and* the old generation cannot accept the promotion — the collection fails partway
through. Under G1 this is logged as "to-space exhausted"; the collector must then abandon the
evacuation, leave objects where they are, and typically fall back to a much more expensive
collection.

This is the worst outcome in the whole aging story, because it combines the cost of a failed
copy with the cost of the fallback. It is also the clearest possible signal that the heap is
too small for the live set rather than badly shaped: a shape problem promotes early, a size
problem cannot promote at all.

## Gotchas

**★ `MaxTenuringThreshold` cannot exceed 15 because the age lives in four header bits.**
*"The largest value is 15."* This is not an arbitrary limit and it will not be raised: the
object header has four bits for the age field. Setting a higher value is silently clamped.

**★ Premature promotion looks like an old-generation leak and is not one.**
Old-generation occupancy rises under load and a full GC clears it. That pattern is not
retention; it is survivors overflowing because the survivor spaces are too small for the
current allocation rate. `-Xlog:gc,age` distinguishes them in one collection's worth of
output.

**★ `-Xlog:gc,age` is nearly free and almost nobody enables it.**
It prints the survivor age histogram at each young collection, which is a direct measurement
of your application's object lifetime distribution. It is the only cheap way to know whether
the generational assumption actually holds for your workload, and it costs a line of log per
collection.

**★ "Minor" and "major" are about *which generation*, not about *duration*.**
A minor collection of a very large young generation with many survivors can take longer than a
major collection of a mostly-empty old generation. The names describe scope. The tuning
guide's own claim is careful — *"Major collections usually last much longer"* — and "usually"
is doing real work in that sentence.

## Interview questions

**★ Walk me through what happens to an object from `new` to being collected in the old
generation.**
It is allocated in eden, almost certainly by a pointer bump inside its thread's TLAB. At the
next young collection, if it is still reachable it is copied into the empty survivor space and
its age becomes 1; eden is then empty. At each subsequent young collection it is copied to the
other survivor space and its age increases. When its age reaches the tenuring threshold — up
to 15, chosen adaptively to keep survivors about half full — it is copied into the old
generation instead. From then on it is only reclaimed by a collection that covers the old
generation, which happens far less often and costs far more.

**★ What is premature promotion and how would you detect it?**
Objects being promoted to the old generation before they would naturally have died, because
the survivor spaces could not hold them — the tuning guide's *"if survivor spaces are too
small, then the copying collection overflows directly into the old generation"*. It converts
cheap young-generation garbage into expensive old-generation garbage, so major collection
frequency rises with load. Detect it with `-Xlog:gc,age`: a healthy application shows a
distribution of survivor ages, while an application suffering premature promotion shows the
histogram truncated at a very low age with a large volume at that age. The fix is a larger
young generation or larger survivors — not a larger old generation, which treats the symptom.

**★ Why is `MaxTenuringThreshold` capped at 15?**
Because the object's age is stored in the mark word of its header in a four-bit field, and
four bits hold 0 to 15. It is a data-layout constraint, not a policy choice, which is why the
documentation states *"The largest value is 15"* flatly with no discussion. It also means the
age field is one of the things competing for space when the header shrinks —
[08b · Compact object headers](08b-compact-object-headers.md).


**★ The tenuring threshold starts at 7, not 15.**
`InitialTenuringThreshold` is 7 in `gc_globals.hpp`; `MaxTenuringThreshold` is 15 and is only
a ceiling. Explanations that say "objects are promoted after 15 collections by default" are
wrong twice over: the initial value is 7, and the value is recalculated every collection
rather than being a default at all.

**★ `PretenureSizeThreshold`, `AlwaysTenure` and `NeverTenure` do not apply to G1.**
Their own source comments restrict them: `PretenureSizeThreshold` is about the "DefNew"
generation, and the two booleans are marked *"(ParallelGC only)"*. On the JDK 25 default
collector they are not the knob anyone thinks they are, and none of the three is documented
in the `java` man page.

**★ A collapsed tenuring threshold in `-Xlog:gc,age` is a diagnosis, not a curiosity.**
When the JVM drives the threshold down to 1 or 2, it is saying it cannot keep survivor
occupancy near `TargetSurvivorRatio` at any higher value. That is premature promotion being
chosen deliberately by the JVM because the alternative — overflowing the survivor space — is
worse. Enlarge the young generation or the survivors; do not raise `MaxTenuringThreshold`,
which is not the binding constraint.

**★ `TargetSurvivorRatio` is a target for *occupancy after* a collection, not a size.**
Its source description is *"Desired percentage of survivor space used after scavenge"*,
default 50. It is the input to the adaptive threshold calculation, not a way to make the
survivor space bigger — that is `SurvivorRatio`, which is a different flag with a confusingly
similar name.

**★ Evacuation failure is a size problem wearing a shape problem's clothes.**
Premature promotion means the survivors went somewhere expensive; evacuation failure means
there was nowhere for them to go at all. The responses are different — the first wants a
bigger young generation, the second wants a bigger heap or less live data — and reading the
second as the first leads to shrinking the old generation, which makes it worse.

**★ Raising `MaxTenuringThreshold` almost never helps.**
The threshold is adaptive and usually sits well below the maximum; raising the ceiling changes
nothing because the ceiling was not binding. In the rare case where it is binding, the effect
is to keep objects circulating between survivor spaces for longer, which costs a copy per
object per collection. Copying is not free — it is the *only* thing a young collection pays
for.



**★ What is the default tenuring threshold?**
There is not one in the sense the question implies. `InitialTenuringThreshold` is 7 and
`MaxTenuringThreshold` is 15, but the JVM recalculates the threshold at every young
collection, aiming to keep survivor space about half occupied — `TargetSurvivorRatio`,
default 50. So the operative threshold is a moving number that depends on your allocation
rate and survival rate, and the two flags are the starting point and the ceiling rather than
the value.

**★ Why is the tenuring threshold recalculated rather than fixed?**
Because the right value depends on the workload and the workload changes. If survivors are
comfortably fitting, a higher threshold keeps short-to-medium-lived objects out of the old
generation, which is where collection is expensive. If survivors are overflowing, a lower
threshold sheds them deliberately rather than letting the copy fail. Fixing the threshold
would mean choosing one of those regimes permanently for an application that moves between
them with load.

**★ You see "to-space exhausted" in a G1 log. What is it and what do you do?**
The collector ran out of space to evacuate live objects into: neither the survivor regions nor
the old generation could take them, so the evacuation could not complete and G1 had to fall
back to a far more expensive collection. It means the heap is too small for the live set at
the current allocation rate, not that the generations are badly proportioned. The responses
are more heap, a lower allocation rate, or less retained data — and specifically *not*
shrinking the old generation to enlarge the young one, which is the instinct and makes it
worse.

**★ Where is an object's age stored, and why does that matter?**
In the mark word of its object header, in a four-bit field — which is why both threshold flags
are declared with `range(0, markWord::max_age + 1)` and why the documented maximum is 15. It
matters beyond trivia because the header is a scarce, contended resource: the same word holds
the identity hash code and the locking state, and every proposal to shrink the header has to
find room for the age field. That is exactly the trade-off JEP 519's compact object headers
had to make.

{/* FOOTER */}
