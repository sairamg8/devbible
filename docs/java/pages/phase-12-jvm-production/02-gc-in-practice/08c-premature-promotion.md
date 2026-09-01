---
title: "Objects that were supposed to die young ending up in the old generation is a survivor-space problem, not a heap-size problem — and the JVM already publishes the age distribution it used to make the decision, so the whole diagnosis is one log tag away"
sidebar_label: "08c · Premature promotion"
sidebar_position: 34
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **HotSpot Virtual Machine Garbage Collection Tuning Guide,
> Release 25**, "Factors Affecting Garbage Collection Performance → The Young Generation →
> Survivor Space Sizing"
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/gctuning/factors-affecting-garbage-collection-performance.html));
> and the JDK 25 HotSpot sources at tag `jdk-25+36` —
> [`gc/shared/gc_globals.hpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/gc/shared/gc_globals.hpp)
> for the declared defaults, ranges and descriptions of `SurvivorRatio`, `NewRatio`,
> `MaxTenuringThreshold`, `InitialTenuringThreshold`, `TargetSurvivorRatio` and `MinSurvivorRatio`.
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**Premature promotion is the failure where objects that would have died in the young generation
get copied into the old generation instead, because the survivor space could not hold them or
because the tenuring threshold collapsed. The old generation then fills with garbage, concurrent
marking runs more often, and eventually you get the Full GC from
[03e2](03e2-the-road-to-a-full-gc.md) — for a workload whose live set never actually grew. This
page is the mechanism and the measurement;
[08c2 · Fixing premature promotion](08c2-fixing-premature-promotion.md) is what to do about it,
and the two are separated deliberately, because the most common mistake here is acting before
measuring.**

## The mechanism, in the order it happens

A young collection copies everything still reachable in eden into the *to* survivor space, along
with everything still reachable in the *from* survivor space. Each surviving object carries an
**age** — the number of collections it has lived through — stored in its header, and each copy
increments it. When an object's age reaches the current **tenuring threshold**, it is copied to
the old generation instead of to a survivor space. That is normal: it is how objects with a
genuinely long life get out of the way of the young collector.

Premature promotion is what happens when the same mechanism fires for objects that had no long
life to have. Two distinct routes get you there, and they call for different responses:

**Overflow.** The surviving set for this collection does not fit in the to-space. There is
nowhere else to put it, so the excess goes to the old generation regardless of age — an object
one collection old lands in the old generation. The tuning guide states the consequence plainly:

> *"If survivor spaces are too small, then the copying collection overflows directly into the old
> generation."*

**Threshold collapse.** Before the overflow, the JVM defends itself by *lowering* the tenuring
threshold. It picks a threshold each collection with a specific target in mind:

> *"At each garbage collection, the virtual machine chooses a threshold number, which is the
> number of times an object can be copied before it's old. This threshold is chosen to keep the
> survivors half full."*

"Half full" is `TargetSurvivorRatio`, declared in `gc_globals.hpp` with a default of **50** and
described as the *"Desired percentage of survivor space used after scavenge"*. If survivors are
overfull at threshold 15, the JVM tries a lower one, and a lower one again — and at threshold 1
every object that survives a single collection is tenured immediately. The heap has silently
become generational in name only.

The important consequence, and the reason this page exists separately from the fix: **by the time
you see promotion volume rise, the threshold has usually already collapsed**, and the collapse did
the bulk of the damage. The age distribution, not the promotion counter, is the measurement to
look at.

## The numbers the JVM is actually using

All of these come from `gc_globals.hpp` at `jdk-25+36`, with the source's own descriptions:

| Flag | Default | The source's description |
|---|---|---|
| `-XX:NewRatio` | `2` | *"Ratio of old/new generation sizes"* |
| `-XX:SurvivorRatio` | `8` | *"Ratio of eden/survivor space size"* |
| `-XX:MaxTenuringThreshold` | `15` | *"Maximum value for tenuring threshold"* |
| `-XX:InitialTenuringThreshold` | `7` | *"Initial value for tenuring threshold"* |
| `-XX:TargetSurvivorRatio` | `50` | *"Desired percentage of survivor space used after scavenge"* |
| `-XX:MinSurvivorRatio` | `3` | *"Minimum ratio of young generation/survivor space size"* |

🔴 **`MaxTenuringThreshold` is 15 because the age field in the object header is four bits.** The
declared range in the source is `range(0, markWord::max_age + 1)`. It is not a tunable number
that happens to be 15; it is the largest age the header can represent. Any advice to set it to 20
is advice that will not start the JVM. The header layout is
[01 · Memory layout → 08 · The object header](../01-memory-layout/08-the-object-header.md), and it
is worth noticing that this is one of the places where an implementation detail of the header
leaks directly into a tuning decision.

**`SurvivorRatio=8` does not mean one eighth.** The guide's worked example is explicit about the
arithmetic that everybody gets wrong:

> *"For example, `-XX:SurvivorRatio=6` sets the ratio between eden and a survivor space to 1:6. In
> other words, each survivor space will be one-sixth of the size of eden, and thus one-eighth of
> the size of the young generation (not one-seventh, because there are two survivor spaces)."*

So at the default 8, each survivor is one-eighth of eden and one-tenth of the young generation.
Two survivor spaces exist, only one of them is usable at a time, and the other is reserved as the
copy target. Halving `SurvivorRatio` roughly doubles each survivor and takes the space out of
eden, which makes young collections more frequent — the trade is always eden against survivors,
never against nothing.

**`NewRatio=2` means the young generation is one third of the heap**, not one half: the ratio is
old-to-young, so 2 means old is twice young, and young is therefore one third of the total. This
is the second denominator people invert, and it matters because it is the arithmetic that decides
whether raising `-Xmx` gives you enough extra survivor space to be worth the cost —
[08c2](08c2-fixing-premature-promotion.md).

## Reading the age distribution

The guide names the log configuration directly:

> *"You can use the log configuration `-Xlog:gc,age` can be used to show this threshold and the
> ages of objects in the new generation. It's also useful for observing the lifetime distribution
> of an application."*

In practice `-Xlog:gc+age=trace` is the tag combination that prints the per-age table on every
young collection, and it is the single most useful diagnostic in this area because it shows you
the *shape* of object lifetime rather than one aggregate. Unified logging, its tags and its
decorators are [07 · Unified logging](07-unified-logging.md) and
[07b · Decorators and runtime control](07b-decorators-and-runtime-control.md) — including the
fact that you can turn this on with `jcmd VM.log` on a running JVM and turn it off again, which
matters because the age table is verbose enough that you do not want it on permanently.

What you are reading it for is one number: **the threshold the JVM chose**. If it is sitting at
`MaxTenuringThreshold` the mechanism is healthy — objects are getting the full fifteen chances to
die. If it has settled at 1 or 2, survivor space is the constraint and everything that lives
longer than one collection is being tenured. There is no other measurement that distinguishes
those two states, and no dashboard shows it by default.

The second thing the table tells you is whether the lifetime distribution has a **tail** or a
**bump**. A steep decline across ages — most bytes at age 1, few at age 2, almost none by age 4 —
is the generational hypothesis holding, and there is nothing to fix. A bump at some middle age is
a population of objects with a real, bounded lifetime that is slightly longer than the young
collection interval: a request-scoped cache, a batch accumulating before a flush, a connection
that lives for a handful of collections. Those are the objects worth either keeping in the young
generation (bigger survivors, bigger eden) or deliberately promoting (`MaxTenuringThreshold`
lowered on purpose, so you stop paying to copy them fifteen times).

The third thing, and it is easy to miss: **the table is per collection, so a single sample proves
nothing.** Thresholds move. A service under a traffic spike can collapse its threshold for a
minute and recover; a service that has collapsed it permanently looks identical in one snapshot.
The diagnostic is the threshold's behaviour over a window, which is another argument for turning
the tag on for a period rather than reading one log line.

## Gotchas

**★ `MaxTenuringThreshold` cannot exceed 15, because the age is four bits in the object header.**
The declared range in `gc_globals.hpp` is `range(0, markWord::max_age + 1)`. Setting 20 does not
clamp quietly to 15 — it fails the range check at startup. This is one of the few places where
the object header's bit layout is directly visible as a tuning limit.

**★ The tenuring threshold is chosen per collection, not configured.**
`MaxTenuringThreshold` is a ceiling and `InitialTenuringThreshold` (default 7) is a starting
point; the actual threshold is recomputed every collection to keep survivor occupancy near
`TargetSurvivorRatio`. So "we set `MaxTenuringThreshold=15`" tells you nothing about what the JVM
is doing — only the age log does.

**★ `SurvivorRatio=8` means each survivor is one-tenth of the young generation, not one-eighth of
it.**
The guide's own worked example spells out the trap: at ratio 6 each survivor is one-sixth of
*eden* and one-eighth of the *young generation*, *"not one-seventh, because there are two survivor
spaces"*. Everyone divides by the wrong denominator once, and the sizing they compute is out by
about 25%.

**★ `NewRatio=2` gives a young generation of one third, not one half.**
The ratio is old-to-young. Two of the three parts are old. Getting this backwards makes every
downstream estimate of "how much survivor space would a bigger heap buy me" wrong by 50%.

**★ Survivor space that is too large is wasted, not safe.**
The guide gives both failure directions: too small and *"the copying collection overflows directly
into the old generation"*, too large and *"they are uselessly empty"*. The space came out of eden,
so oversized survivors buy you more frequent young collections in exchange for nothing.

**★ By the time promotion volume spikes, the threshold has usually already collapsed.**
The JVM lowers the threshold to protect survivor occupancy *before* it resorts to overflow. So
promotion rate is a lagging indicator and the age distribution is the leading one — which is
backwards from how most people instrument this.

**★ One age table proves nothing; the threshold moves.**
It is recomputed every young collection, so a service can collapse its threshold under a spike
and recover minutes later. A snapshot cannot distinguish a transient from a permanent collapse.
Read the tag over a window.

**★ The age log is verbose enough that you should turn it on and off, not ship with it.**
`-Xlog:gc+age=trace` prints a table per young collection. That is fine for a diagnostic window
and a real cost at steady state. `jcmd <pid> VM.log` lets you add and drop the output on a
running JVM, which is the reason that command exists.

**★ A bump in the age histogram is a design signal, not a tuning problem.**
Objects clustering at a middle age have a real bounded lifetime slightly longer than the
collection interval — a per-request cache, a batch buffer. You can size the young generation to
keep them, or lower the threshold to stop copying them fifteen times, but the flag choice follows
from the shape and there is no default that is right for both shapes.

**★ Copying cost is paid per collection survived, so a long threshold is not free.**
A surviving object is copied on every young collection until it is tenured. Fifteen chances to
die is fifteen potential copies. For a population that reliably lives to age 6, the default
threshold means five copies you could have avoided by promoting once — which is why "raise the
threshold so nothing gets promoted" is not a strategy.

## Interview questions

**★ Why is `MaxTenuringThreshold` capped at 15?**
Because the object age is a four-bit field in the mark word, so 15 is the largest age the header
can represent. The HotSpot source declares the flag with `range(0, markWord::max_age + 1)`, which
means a larger value fails the range check at startup rather than being clamped. It is a good
example of a tuning knob whose limit is not a policy choice at all but a consequence of the
object header layout — the same four bits that make the header cheap make the threshold bounded.

**★ What does `-XX:SurvivorRatio=8` actually give you, and what does raising it do?**
It sets the ratio of eden to *one* survivor space at 8:1, so each survivor is one-eighth the size
of eden. Because there are two survivor spaces, each is one-tenth of the young generation, not
one-eighth of it — the tuning guide calls this out explicitly with a worked example precisely
because the two-space denominator is the thing people get wrong. Raising the ratio makes
survivors smaller and eden larger: fewer young collections, but less room for survivors, so more
overflow into the old generation. Lowering it does the reverse, at the cost of more frequent
collections. The trade is always eden against survivors — the young generation as a whole does
not change, so there is no setting that improves both.

**★ You see a bump in the age histogram at age 6 rather than a clean decline. What does that tell
you and what would you do?**
It says there is a population of objects with a real, bounded lifetime that happens to be a
little longer than the interval between young collections — something like a per-request cache, a
batch that accumulates before a flush, or a connection wrapper held for a handful of collections.
The generational hypothesis is not failing; these objects genuinely live that long. What is
happening is that you are paying to copy them six times before they die, which is pure cost. Two
defensible responses: make the young generation large enough that the bump falls comfortably
inside it, so the objects die in the young generation and the copying is amortised over fewer
collections; or lower the tenuring threshold deliberately so they are promoted early and copied
once, accepting that the old generation now takes some short-lived garbage. Which is right
depends on how big that population is relative to the heap. The wrong response is to treat the
bump as a defect — a flat, steep decline is not the goal, it is just the common case.

**★ Why is the tenuring threshold a better diagnostic than the promotion rate?**
Because it is the leading indicator and promotion rate is the lagging one. The JVM defends
survivor occupancy by lowering the threshold *before* it resorts to overflowing into the old
generation, so by the time promoted bytes per second visibly spikes, the threshold has usually
already collapsed and the damage is done. The threshold also tells you *why*: a threshold sitting
at its maximum with high promotion means you have genuinely long-lived objects and the old
generation is doing its job; a threshold at 1 with the same promotion volume means survivor space
is the constraint and the generational design has effectively been switched off. Those two states
have identical promotion rates and completely different fixes, and no aggregate counter can tell
them apart.

**★ Walk through what happens, step by step, when the surviving set stops fitting in the survivor
space.**
First the JVM tries to avoid the situation: at each collection it recomputes the tenuring
threshold to keep survivor occupancy near `TargetSurvivorRatio`, 50% by default. As the surviving
set grows relative to the space, that recomputation pushes the threshold down — fewer collections
of grace before an object is tenured — so more objects leave via the front door into the old
generation and survivor occupancy comes back under target. That is the JVM working as designed,
and it is invisible unless you are logging ages. If the pressure keeps increasing, the threshold
reaches 1, at which point everything that survives one collection is promoted and there is no
further lever. Beyond that, the surviving set simply does not fit and the excess overflows
directly into the old generation regardless of age. So there are really three regimes — healthy
threshold, collapsed threshold, overflow — and only the third one produces anything you would
notice without the age log, which is why the pathology usually gets diagnosed late.

**★ Why does copying cost argue against simply maximising the tenuring threshold?**
Because every collection an object survives in the young generation is another copy of that
object. The threshold is a ceiling on how many times you are willing to pay that cost before
giving up and moving the object to the old generation. Setting it high is right when most
surviving objects die shortly after — you copy them once or twice and never pay the old-generation
cost at all. It is wrong when a substantial population reliably lives to some middle age: then
you pay the full copy cost every collection and *still* promote them in the end, which is the
worst of both. That is why the age histogram's shape, not a general preference for "keeping
things young", decides the setting.

{/* FOOTER */}
