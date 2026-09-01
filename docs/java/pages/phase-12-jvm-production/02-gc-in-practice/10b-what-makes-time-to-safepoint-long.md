---
title: "The counted loop that never polls is the classic cause, and the flag that fixes it is off by default in the compiler and switched on by G1's and ZGC's own startup code — so whether your service is exposed to it was decided by a collector choice nobody made for this reason"
sidebar_label: "10b · The counted loop"
sidebar_position: 39
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the JDK 25 HotSpot sources at tag `jdk-25+36` —
> [`opto/c2_globals.hpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/opto/c2_globals.hpp),
> where `UseCountedLoopSafepoints` is declared `product(bool, …, false, "Force counted loops to
> keep a safepoint")` and `LoopStripMiningIter` defaults to 0 with the description *"Number of
> iterations in strip mined loop"*; and
> [`gc/g1/g1Arguments.cpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/gc/g1/g1Arguments.cpp)
> and
> [`gc/z/zArguments.cpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/gc/z/zArguments.cpp),
> which contain the identical `#ifdef COMPILER2` block setting `UseCountedLoopSafepoints` to
> `true` and `LoopStripMiningIter` to `1000` when those flags are still at their defaults.
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**[10](10-safepoints.md) established that time-to-safepoint is real, unbounded and invisible in
the GC log. This page is the classic cause, and it contains the most collector-dependent gotcha in
the phase: the compiler flag that prevents it is documented as defaulting to `false`, and both G1
and ZGC turn it on for you at startup. Read only the compiler's default and you will conclude
every JVM is exposed. Observe only a default JVM and you will conclude none is. Both are wrong,
and the difference is a collector choice.
[10c](10c-diagnosing-time-to-safepoint.md) is everything else that makes it long, and how to find
out which.**

## The counted loop

The compiler inserts safepoint polls at loop back-edges — but not at all of them. A **counted
loop** with an `int` induction variable has a statically known trip count bound, and C2 has
historically been allowed to omit the poll from it, on the reasoning that it will finish
"quickly". Two billion iterations of a loop body that touches memory is not quick, and during it
the thread cannot stop. Everything else in the JVM waits.

The canonical shape is unremarkable code:

```java
// int induction variable, bounded trip count: a counted loop.
long sum = 0;
for (int i = 0; i < data.length; i++) {
    sum += transform(data[i]);          // inlined; no call, no poll
}
```

Nothing here looks dangerous, and for a small array it is not. The pathology needs three things
at once: a genuinely long trip count, a body that inlines away so there is no call boundary to
poll at, and a safepoint requested while the loop is running. The third is a matter of luck,
which is why this presents as rare unexplained latency spikes rather than as a consistent
regression — and why it survives load testing.

The flag that removes the exemption is `UseCountedLoopSafepoints`, declared in `c2_globals.hpp`:

```cpp
product(bool, UseCountedLoopSafepoints, false,
        "Force counted loops to keep a safepoint")
```

## Strip mining: the compromise

Keeping a poll in a hot inner loop costs throughput, which is why the exemption existed in the
first place. The compromise is **loop strip mining**: rewrite the loop as an outer loop over
chunks and an inner loop of `LoopStripMiningIter` iterations, and poll only on the outer
back-edge.

The trade is explicit. Time-to-safepoint becomes bounded by the time to finish at most one chunk
rather than the whole loop; the cost is one poll every N iterations instead of one per iteration,
which is small enough to be acceptable and large enough to explain why nobody polls every
iteration. `LoopStripMiningIter` is declared with a default of `0`, and
`LoopStripMiningIterShortLoop` exists alongside it — *"Loop with fewer iterations are not strip
mined"* — so short loops keep their original shape and pay nothing.

## The part that is easy to get wrong

Those two defaults — `false` and `0` — are what the compiler declares. They are not what most
JVMs run with, because the **collectors override them at startup**. `g1Arguments.cpp` contains:

```cpp
#ifdef COMPILER2
  // Enable loop strip mining to offer better pause time guarantees
  if (FLAG_IS_DEFAULT(UseCountedLoopSafepoints)) {
    FLAG_SET_DEFAULT(UseCountedLoopSafepoints, true);
    if (FLAG_IS_DEFAULT(LoopStripMiningIter)) {
      FLAG_SET_DEFAULT(LoopStripMiningIter, 1000);
    }
  }
#endif
```

`zArguments.cpp` contains the identical block, with the comment *"Enable loop strip mining by
default"*. So:

| Collector | `UseCountedLoopSafepoints` | `LoopStripMiningIter` |
|---|---|---|
| **G1** (the default) | `true` — set by `g1Arguments.cpp` | `1000` |
| **ZGC** | `true` — set by `zArguments.cpp` | `1000` |
| **Parallel** | `false` — the declared default stands | `0` |
| **Serial** | `false` — the declared default stands | `0` |

🔴 **The exposure to the classic counted-loop stall is decided by your collector choice, through a
mechanism nothing in either flag's name suggests.** A service that switches from G1 to Parallel
for throughput reasons silently loses its bounded time-to-safepoint, and the symptom — occasional
unexplained multi-hundred-millisecond stalls with a clean GC log — will not be connected to the
change that caused it.

Three further details matter:

- The guard is `FLAG_IS_DEFAULT`. Setting `-XX:-UseCountedLoopSafepoints` explicitly on G1
  **wins**, and disables the protection. The collector only fills in a value you did not supply.
- Both blocks are inside `#ifdef COMPILER2`. This is a C2 concern; C1-compiled and interpreted
  code poll normally, which is why the problem appears only once a loop is hot enough for C2 —
  and therefore usually only in production, after warm-up, under load.
- G1's comment says *"to offer better pause time guarantees"* — the collectors did this to
  protect their own pause goals. Bounded time-to-safepoint is a side effect that happens to be
  the thing you care about.

The only reliable way to know what your JVM has is `-XX:+PrintFlagsFinal`, which is the general
argument of [13 · JVM flags that matter](../13-jvm-flags-that-matter/README.md): the declared
default and the effective value are different questions, and ergonomics is the reason.

## Gotchas

**★ `UseCountedLoopSafepoints` defaults to `false` in the compiler and is set to `true` by G1 and
ZGC at startup.**
Both `g1Arguments.cpp` and `zArguments.cpp` contain the same block flipping it, plus
`LoopStripMiningIter=1000`. Quoting the compiler's declared default as "the JVM's behaviour" is
wrong for the default collector; assuming the protection is universal is wrong for Parallel and
Serial. Only `-XX:+PrintFlagsFinal` tells you what your JVM actually has.

**★ Switching from G1 to Parallel silently removes bounded time-to-safepoint.**
The override lives in the collector's own startup code, so it leaves with the collector. A
throughput-motivated collector change can therefore introduce rare multi-hundred-millisecond
stalls, and nobody will connect the two because neither flag is mentioned in the change.

**★ Setting `-XX:-UseCountedLoopSafepoints` explicitly on G1 defeats the protection.**
The override is guarded by `FLAG_IS_DEFAULT`. The collector only supplies a value you did not.
This is a real hazard for teams that inherit a long flag list and carry it across a JDK upgrade
without auditing it.

**★ The override is inside `#ifdef COMPILER2`.**
It is a C2 optimisation being constrained. Interpreted and C1-compiled code poll normally, which
is why the problem appears only after a loop is hot enough to be C2-compiled — in production,
after warm-up, under load, and not in the test that exercised the same code path.

**★ The counted-loop stall needs three coincidences, which is why it survives load testing.**
A long trip count, a body that inlines so there is no call to poll at, and a safepoint requested
during the loop. The third is luck, so the symptom is occasional unexplained spikes rather than a
reproducible regression — and a load test that never happens to collect mid-loop reports nothing.

**★ `long`-indexed loops were never exempt in the same way.**
The exemption applies to counted loops with an `int` induction variable. Changing an index from
`int` to `long` is therefore a real, if obscure, workaround — and an excellent illustration of how
far the cause sits from the symptom.

**★ Short loops are not strip mined, by design.**
`LoopStripMiningIterShortLoop` exists precisely so that loops with few iterations keep their
original shape and pay no poll cost. The mechanism is targeted at the loops that can actually
stall a safepoint, not applied indiscriminately.

**★ The collectors did this for their own pause goals, not for your latency.**
G1's comment is *"to offer better pause time guarantees"*. Bounded time-to-safepoint is the
side effect. That is worth knowing because it explains why the setting travels with the collector
rather than with anything that sounds like a latency option.

## Interview questions

**★ What is a counted loop and why does it matter for pause times?**
A counted loop is one the compiler can prove has a bounded trip count with an `int` induction
variable — the ordinary `for (int i = 0; i < n; i++)`. C2 has historically been permitted to omit
the safepoint poll from its back-edge, on the reasoning that a bounded loop finishes promptly.
For a loop over two billion elements with an inlined body, that reasoning fails: the thread
cannot reach a poll until the loop ends, so it cannot stop, so a safepoint requested during it
waits for the whole loop — and every other thread waits too, because the safepoint is global. The
result is an unexplained multi-hundred-millisecond stall with a perfectly healthy GC log, since
the GC pause figure measures work done at the safepoint and not the wait to reach it. It needs
three coincidences to bite — long trip count, a body with no call boundary, and a safepoint
requested mid-loop — which is why it presents as rare spikes and survives load testing.

**★ Is `UseCountedLoopSafepoints` on or off by default?**
Both, and the question is a good one precisely because the honest answer is conditional. The
compiler declares it `product(bool, UseCountedLoopSafepoints, false, ...)` in `c2_globals.hpp`,
so the compiler's default is off. But `g1Arguments.cpp` and `zArguments.cpp` each contain a block
that sets it to `true`, together with `LoopStripMiningIter=1000`, whenever those flags are still
at their defaults — G1's comment says it is *"to offer better pause time guarantees"*. So on the
default collector, and on ZGC, it is on; on Parallel and Serial it is off. The guard is
`FLAG_IS_DEFAULT`, so an explicit `-XX:-UseCountedLoopSafepoints` beats the collector and turns
the protection off again. The practical consequences are that quoting the declared default as
"the JVM's behaviour" is misleading, that a collector switch changes your exposure without
mentioning either flag, and that the only reliable answer for a given JVM is
`-XX:+PrintFlagsFinal`.

**★ What is loop strip mining and what does it trade?**
It is the compromise between never polling in a counted loop and polling on every iteration. The
compiler rewrites the loop as an outer loop over chunks and an inner loop of
`LoopStripMiningIter` iterations — 1000 when a collector sets it — and puts the safepoint poll on
the outer back-edge. Time-to-safepoint becomes bounded by the time to finish at most one chunk
instead of the whole loop, and the throughput cost is one poll per thousand iterations rather
than one per iteration. Short loops are excluded entirely via `LoopStripMiningIterShortLoop`, so
the cost is only paid where the risk exists. What it trades, besides that small cost, is
profiling accuracy: moving the polls moves where a safepoint-based profiler can observe the
program, so it changes the shape of safepoint bias — an argument for a profiler that does not
sample at safepoints, not an argument against strip mining.

**★ A team switches from G1 to Parallel to improve batch throughput and starts seeing occasional
one-second stalls. Explain the connection.**
The stalls are almost certainly time-to-safepoint, and the connection is a flag neither the team
nor the change description mentions. `UseCountedLoopSafepoints` is declared `false` by the
compiler; G1's startup code sets it to `true` along with `LoopStripMiningIter=1000` whenever it
finds them at their defaults. Parallel's startup code does not. So moving off G1 removed the
strip mining that was bounding time-to-safepoint, and any long counted loop in the application —
which was always there, and was always poll-free at the machine-code level — can now stall every
thread in the JVM until it finishes. The reason it is hard to diagnose is that the GC log looks
*better* after the change, not worse: Parallel's collection work may well be more efficient, and
the pause figures it reports exclude exactly the time that is now being lost. The confirming
measurement is `-Xlog:safepoint`, comparing "Reaching safepoint" against "At safepoint", and the
fix is to set `-XX:+UseCountedLoopSafepoints -XX:LoopStripMiningIter=1000` explicitly, which is
what the collector was doing implicitly all along.

**★ Why would changing a loop index from `int` to `long` fix a latency problem?**
Because the safepoint-poll exemption applies to counted loops, and a counted loop is specifically
one with an `int` induction variable that the compiler can bound. A `long`-indexed loop does not
qualify for the same treatment, so it keeps its back-edge poll, so the thread can stop, so the
safepoint is not delayed. It is a real fix and a genuinely terrible one to have to explain in a
code review, because the change looks like a pointless widening of a variable and the
justification is three layers below the source — a compiler optimisation, a poll placement, and a
global stop-the-world protocol. It is worth knowing mostly as an illustration of how far the
cause can sit from the symptom in this area, and because the better fix — enabling strip mining,
or being on a collector that enables it for you — is not always available on a JVM whose flags
you do not control.

{/* FOOTER */}
