---
title: "Almost every published fix for premature promotion was written for the Parallel collector, and on G1 the same pressure produces a completely different symptom with a completely different remedy — so the first question is not which flag but which collector, and the second is whether it is promotion at all rather than a leak wearing its costume"
sidebar_label: "08c2 · Fixing it (and G1)"
sidebar_position: 35
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **HotSpot Virtual Machine Garbage Collection Tuning Guide,
> Release 25** — "Factors Affecting Garbage Collection Performance" for the `NewRatio` /
> `NewSize` / `MaxNewSize` semantics and the survivor-sizing guidance
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/gctuning/factors-affecting-garbage-collection-performance.html));
> and the JDK 25 HotSpot sources at tag `jdk-25+36` —
> [`gc/shared/gc_globals.hpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/gc/shared/gc_globals.hpp),
> where `AlwaysTenure` is declared *"Always tenure objects in eden (ParallelGC only)"* and
> `NeverTenure` *"Never tenure objects in eden, may tenure on overflow (ParallelGC only)"*.
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**[08c](08c-premature-promotion.md) established the mechanism and the measurement. This page is
the response — and its main argument is that the response depends on the collector far more than
on the numbers. The Parallel-era fixes that fill search results do not transfer to G1, two of the
flags most often recommended are documented in the source as ParallelGC-only, and the single most
common remedy — a bigger heap — is the one that most often makes the eventual failure worse.**

## Why "just make the heap bigger" often makes it worse

The reflex response to old-generation growth is `-Xmx`. Under premature promotion it can be
actively counterproductive, and the reason is worth being precise about.

`NewRatio=2` means the young generation is one third of the heap, so a bigger heap does give you
a bigger young generation and bigger survivors. That part genuinely helps, and it is why the
advice sometimes works — which is exactly what makes it hard to argue against. But three things
come with it:

- **Concurrent marking has more to trace.** A larger old generation means every marking cycle
  scans more, so the cost of the thing you were trying to avoid goes up.
- **A Full GC, if you ever get one, is longer.** You have made the rare event rarer and worse,
  which is a bad trade for a latency-sensitive service — the whole argument of
  [01b · What the pause number leaves out](01b-what-the-pause-number-leaves-out.md).
- **In a container it may not be memory you have.** Raising `-Xmx` against an unchanged cgroup
  limit converts a GC problem into an OOMKill, and an OOMKilled process dies without a heap dump
  and without a stack trace. That arithmetic is
  [03 · Heap sizing in containers](../03-heap-sizing-in-containers/README.md), and it is the
  single most misdiagnosed production symptom in this phase.

The response that matches the diagnosis is to change the **ratio**, not the total: lower
`SurvivorRatio` so survivors can hold a collection's worth of survivors, or raise
`-XX:NewSize`/`-XX:MaxNewSize` so the whole young generation is larger relative to old. The guide
notes that setting those two to the same value fixes the young generation *"just as setting -Xms
and -Xmx to the same value fixes the total heap size"*, and that this is *"useful for tuning the
young generation at a finer granularity than the integral multiples allowed by -XX:NewRatio"*.
Both changes are free of the container arithmetic, because the process footprint does not move.

And on G1 none of that is the first move at all.

## G1 is different, and most premature-promotion advice predates it

Almost everything written about survivor sizing and tenuring thresholds was written for the
Parallel collector, where eden and the survivors are fixed contiguous spaces you size by ratio.
G1 has regions, and it **resizes the young generation between collections** to meet its pause
goal — that is what `-XX:G1NewSizePercent` and `-XX:G1MaxNewSizePercent` bound, and it is why
[03c · G1 pause time and the knobs](03c-g1-pause-time-and-the-knobs.md) argues against pinning
`-Xmn` under G1 at all. Pinning the young generation size on G1 removes the collector's main
control input and is the most common way to make G1 behave worse than its defaults.

Three consequences follow, and each of them invalidates a piece of widely-repeated advice:

- **`AlwaysTenure` and `NeverTenure` are `ParallelGC only`** — the source says so in the flag
  description itself, not in a footnote. They are not G1 knobs. Advice that offers them as
  general tuning is advice from a different collector, and on G1 they will parse and do nothing
  useful, which is worse than failing.
- **On G1, premature promotion usually presents as evacuation failure rather than quiet
  tenuring.** When G1 cannot find space for survivors it does not silently overflow into the old
  generation the way Parallel does — it fails the evacuation and recovers, which is
  [03e · G1 when it goes wrong](03e-g1-when-it-goes-wrong.md). Same underlying cause, completely
  different symptom in the log. The Parallel symptom is silent; the G1 symptom is loud.
- **The G1 fix is usually to change nothing and let the pause goal do its work.** If the young
  generation is too small for the surviving set, G1 will grow it — unless something is stopping
  it, and the usual something is a `MaxGCPauseMillis` set so aggressively that G1 keeps the young
  generation tiny to hit it. Relaxing the pause goal is then the fix, and it is the opposite of
  what the flag name suggests you should do. That argument is
  [03c3 · Tuning G1 for throughput](03c3-tuning-g1-for-throughput.md).

On ZGC the question mostly dissolves: generational ZGC has no user-visible survivor ratio to
tune, and the tuning surface is deliberately small — [04c2](04c2-zgc-memory-and-when-not-to.md).
That is a feature, not an omission, and it is one of the honest reasons to choose it.

## Ruling out the impostor first

Premature promotion is a real pathology with a real fix, and it is also **over-diagnosed**,
because it shares a graph with something far more common. The sequence that actually justifies
acting on it is:

1. Old-generation occupancy climbing **after** collection — not peak occupancy, which says
   nothing.
2. Live data size **flat** across the same window, so it is not a leak.
3. Age distribution showing a **collapsed threshold**, per [08c](08c-premature-promotion.md).

All three. Take any one away and the diagnosis fails:

- Old-generation growth with a *rising* live set is a leak, and no ratio will help. That is
  [04 · OutOfMemoryError](../04-out-of-memory-error/README.md), and the next tool is a heap dump,
  not a flag.
- Old-generation growth with a healthy threshold at 15 is just an application with genuinely
  long-lived objects — which is what the old generation is *for*. A cache that is supposed to hold
  a million entries is not a pathology because its entries reach the old generation.
- A collapsed threshold with flat old-generation occupancy is a transient, usually a load spike,
  and it will resolve itself.

The discipline this imposes is worth stating as a rule: **the promotion diagnosis requires a
negative result about leaks before it means anything.** Skipping that step is how teams spend a
day on `SurvivorRatio` for an application that was holding a reference it should have dropped.

## The fix that beats every flag

The response that outperforms all of the above is the one in
[11 · When tuning is the wrong answer](11-when-tuning-is-the-wrong-answer.md): objects that
survive one collection because a request-scoped buffer is held slightly too long are a code
problem with a code fix. A ratio change buys time proportional to the extra survivor space; a
change that stops retaining the object removes the pressure entirely and keeps removing it as
traffic grows.

The reason to know the flags anyway is that the code fix has a lead time and production does not.
Ratio changes are the thing you do this afternoon so that the code fix can ship next week — and
knowing which of them is a real remedy and which is theatre is the difference between buying a
week and burning one.

## Gotchas

**★ `AlwaysTenure` and `NeverTenure` are ParallelGC-only, by the source's own description.**
They read like general policy switches and they are not. On G1 they are not the mechanism, and
advice offering them as a fix for old-generation growth under the default collector is advice
written for a different collector — which will parse without complaint and change nothing.

**★ Pinning `-Xmn` on G1 to "fix" premature promotion usually makes it worse.**
G1 resizes the young generation to meet `MaxGCPauseMillis`; a fixed `-Xmn` removes its main
control input. The G1 equivalents are `G1NewSizePercent` / `G1MaxNewSizePercent`, and the default
answer is to change neither.

**★ An aggressive `MaxGCPauseMillis` can *cause* the promotion problem it looks like a defence
against.**
G1 keeps the young generation small to hit a tight pause goal; a small young generation means a
small survivor space; a small survivor space means overflow. Relaxing the pause goal is then the
fix, which is counter-intuitive enough that it is rarely the first thing tried.

**★ Old-generation growth is not premature promotion until you have ruled out a leak.**
Both look identical on a heap-occupancy graph. The discriminator is live data size after
collection: flat means promotion, rising means retention. Acting on the wrong one wastes a day
tuning ratios on an application that is holding a reference it should have dropped.

**★ Peak old-generation occupancy tells you nothing; occupancy *after* collection is the metric.**
The peak includes everything not yet reclaimed. The number that distinguishes a filling old
generation from a busy one is what remains once the collector has finished, and dashboards
built on the raw pool gauge routinely show the wrong one.

**★ Raising `-Xmx` treats the symptom and enlarges the eventual Full GC.**
It does give bigger survivors via `NewRatio`, so it can genuinely help — and that is what makes it
persistent advice. But it also gives concurrent marking more to trace and a compaction more to
move, and in a container it can turn a GC problem into an OOMKill, which is a strictly worse
failure because the process dies without a heap dump.

**★ Promotion also fails at the other end: G1 reports it as evacuation failure, not as tenuring.**
Parallel overflows silently into the old generation; G1 fails the evacuation and recovers. Same
cause, different log line, and someone who learned the Parallel symptom will not recognise the G1
one because the G1 one is loud while the Parallel one is silent.

**★ `NewSize` and `MaxNewSize` set to the same value pin the young generation exactly.**
The guide recommends this as the way to tune *"at a finer granularity than the integral multiples
allowed by -XX:NewRatio"*. It is the right tool on Parallel and the wrong one on G1, which is a
good illustration of how collector-specific this whole area is.

**★ Ratio changes are free of the container arithmetic; heap changes are not.**
Lowering `SurvivorRatio` redistributes space inside a young generation whose size did not change,
so the process footprint does not move and the cgroup limit is untouched. That is the practical
reason to reach for the ratio first, independent of which is theoretically better.

**★ ZGC's answer to this whole page is "there is no knob", and that is a reason to consider it.**
Generational ZGC exposes no survivor ratio and no tenuring threshold. If your team is spending
time in this area repeatedly, the smallest total-cost answer may be a collector whose tuning
surface does not include it — weighed against the footprint and CPU cost in
[04c · ZGC costs](04c-zgc-costs.md).

## Interview questions

**★ Old-generation occupancy is climbing on a service whose live set has not changed. What is
happening and how do you confirm it?**
That is the premature-promotion signature: objects that should be dying in the young generation
are being copied into the old one, so the old generation fills with garbage rather than with live
data. Confirming it takes two measurements. First, live data size after collection — if that is
flat while occupancy climbs, it is promotion and not a leak; if both climb, it is a leak and no
GC flag will help. Second, and this is the one that actually names the cause,
`-Xlog:gc+age=trace` to see the tenuring threshold the JVM has chosen. If it has collapsed from
15 to 1 or 2, survivor space cannot hold a collection's worth of survivors and the JVM has
lowered the threshold to keep survivor occupancy near `TargetSurvivorRatio`, which defaults to
50%. The fix is then a ratio change — smaller `SurvivorRatio`, or a larger young generation —
rather than a bigger heap, and on G1 it is usually neither, because G1 sizes the young generation
itself to meet the pause goal.

**★ Someone proposes fixing old-generation growth by doubling `-Xmx`. Argue both sides.**
For: `NewRatio` is a ratio, so a bigger heap does mean a bigger young generation and bigger
survivors, which is the actual constraint under premature promotion. It will genuinely reduce
promotion, and it requires no understanding of the workload. Against: it also doubles what
concurrent marking has to trace and what a compaction has to move, so if you ever do hit a Full
GC it is a longer one; in a container it raises the JVM's footprint against a cgroup limit that
did not change, converting a GC problem into an OOMKill, which is a worse failure because the
process dies without a heap dump; and it treats the symptom, so it buys time proportional to the
extra memory rather than fixing anything. The targeted change — `SurvivorRatio`, or
`NewSize`/`MaxNewSize` — costs no additional memory and addresses the measured constraint. And if
the collector is G1, the honest answer is usually to change neither and let the pause goal size
the young generation.

**★ How does premature promotion present differently on G1 than on Parallel?**
On Parallel the survivor spaces are fixed by ratio, so when the surviving set does not fit, the
excess overflows directly into the old generation and nothing in the log says anything went
wrong — the only trace is a tenuring threshold that has collapsed and an old generation filling
faster than the live set. On G1 the young generation is region-based and resized between
collections to meet `MaxGCPauseMillis`, so the same pressure shows up as evacuation failure: G1
cannot find space for survivors, the evacuation fails, and it recovers — noisily, and with a
specific log line. Same underlying cause, and someone who learned the Parallel symptom will not
recognise the G1 one because the G1 one is loud while the Parallel one is silent. It also means
the Parallel-era fixes do not transfer: `AlwaysTenure` and `NeverTenure` are documented in the
source as ParallelGC-only, and pinning `-Xmn` on G1 removes the collector's main control input.

**★ Could a pause-time goal cause a promotion problem? Explain the chain.**
Yes, and it is one of the more satisfying inversions in GC tuning. G1 meets `MaxGCPauseMillis` by
controlling how much it collects per pause, and the main lever is the size of the young
generation — a smaller young generation means less to evacuate and a shorter pause. Set the goal
aggressively enough and G1 will keep the young generation small to honour it. A small young
generation is a small survivor space; a small survivor space cannot hold the surviving set; the
tenuring threshold collapses and objects are promoted early. So a flag whose entire purpose is to
protect latency has, through two intermediate steps, filled the old generation with garbage — and
the eventual consequence is a long collection, which is precisely what the goal was set to
prevent. The fix is to relax the goal, which almost nobody tries because the flag's name argues
against it.

**★ Why do ratio changes make a better emergency response than heap changes in a container?**
Because a ratio change does not alter the process's memory footprint. Lowering `SurvivorRatio`
redistributes space inside a young generation whose total size is unchanged, so the JVM asks the
operating system for nothing new and the cgroup limit is untouched — you can apply it in a
restart without renegotiating the pod's resources, and it cannot cause an OOMKill. Raising `-Xmx`
does the opposite: it is a request for more memory from a budget somebody else owns, and if the
limit is not raised in the same change, the container's kernel kills the process rather than the
JVM throwing an `OutOfMemoryError` — no heap dump, no stack trace, just a restart and an exit
code. So even where a bigger heap would be the better long-term answer, the ratio change is the
one you can safely make at 03:00.

**★ When is a "premature promotion" diagnosis simply wrong, and what should you have checked?**
When the live set is growing, and you should have checked live data size after full collection
before touching a single ratio. A leak and premature promotion produce the same climbing
old-generation graph, and only that one measurement separates them; if live data is rising, the
application is retaining objects and every hour spent on survivor sizing is an hour not spent on
a heap dump. The second way it is wrong is when the tenuring threshold is sitting healthily at
its maximum — that means objects reaching the old generation have genuinely survived fifteen
collections, which is not premature by any definition, and the old generation is doing exactly
the job it exists for. A cache designed to hold a million entries is supposed to be in the old
generation. The failure mode in both cases is the same: a graph that looks like the pathology,
acted on without the two measurements that would have ruled it out.

{/* FOOTER */}
