---
title: "One fork is not a cheaper version of five forks, it is a different experiment — it cannot see profile pollution and it cannot see run-to-run variance, which are the two things a single number is least able to warn you about"
sidebar_label: "07 · Forks and warmup"
sidebar_position: 13
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-01 against the **JMH samples** `JMHSample_12_Forking` and
> `JMHSample_13_RunToRun`
> ([github.com/openjdk/jmh](https://github.com/openjdk/jmh/tree/master/jmh-samples/src/main/java/org/openjdk/jmh/samples))
> and the `Fork`, `Warmup` and `Measurement` annotation sources. JMH 1.37, JDK 25.
> 🔴 **No sandbox** — the described outcomes are the samples' own stated expectations.

**Forking and warm-up are the two structural defences from
[02](02-why-the-jvm-defeats-naive-timing.md), and they are frequently the first two things a
hurried engineer turns down. `-f 1 -wi 1 -i 1` makes a suite finish in minutes and makes its
output worthless.**

## Forking, and what it defends against

> *"JVMs are notoriously good at profile-guided optimizations. This is bad for benchmarks,
> because different tests can mix their profiles together, and then render the "uniformly bad"
> code for every test. Forking (running in a separate process) each test can help to evade this
> issue."*

and the crucial default: **"JMH will fork the tests by default."**

The demonstration uses two classes that do the same thing:

```java
public interface Counter { int inc(); }

public static class Counter1 implements Counter { private int x; public int inc() { return x++; } }
public static class Counter2 implements Counter { private int x; public int inc() { return x++; } }
```

> *"Even though those are semantically the same, from the JVM standpoint, those are distinct
> classes."*

and the expected result, in the sample's words:

> *"Note that C1 is faster, C2 is slower, but the C1 is slow again! This is because the profiles
> for C1 and C2 had merged together. Notice how flawless the measurement is for forked runs."*

🔴 **Read the sequence: the first benchmark's score changes after a later benchmark runs.**
That is the signature of profile pollution, and no amount of warm-up inside one JVM removes
it, because the call site really did see two types.

## Forking also measures the JVM's own non-determinism

> *"Forking also allows to estimate run-to-run variance. JVMs are complex systems, and the
> non-determinism is inherent for them. This requires us to always account the run-to-run
> variance as the one of the effects in our experiments. Luckily, forking aggregates the results
> across several JVM launches."*

`JMHSample_13_RunToRun` builds a workload with deliberate variance — a sleep of
`Math.random() * 1000` ms fixed per JVM in `@Setup` — and runs it at `@Fork(1)`, `@Fork(5)` and
`@Fork(20)`:

> *"Note the baseline is random within [0..1000] msec; and both forked runs are estimating the
> average 500 msec with some confidence."*

⚠️ **The single-fork run is not wrong about its own JVM.** It is a perfectly accurate
measurement of one sample from a distribution — and it has no way to tell you that the
distribution is 0–1000 ms wide. Only more forks reveal that.

🔴 **This is the argument against `@Fork(1)`, and it applies to every real benchmark**, because
address-space layout, JIT decisions under differing compiler queue load, GC heap layout and
OS scheduling all vary between launches.

## `@Fork`'s knobs, applied

From [04](04-the-annotations.md), with their working meanings:

- **`value`** — forks that count. More forks widen coverage of run-to-run variance. Cost is
  linear: total time is roughly `forks × (warmup + measurement) iterations`.
- **`warmups`** — *"number of times harness should fork and ignore the results"*. Whole JVM
  launches discarded. Useful when the very first launch on a machine is atypical (cold page
  cache, cold CPU frequency governor).
- **`jvmArgsAppend`** — the safe way to add flags. `jvmArgs` replaces the line.
- **`jvm`** — a different JVM executable, which is how you compare runtimes with one benchmark
  jar.
- **`value = 0`** — no fork. Debugging only; it reintroduces profile pollution by definition.

## Warm-up is per fork, and it is thrown away

Each fork runs `@Warmup` iterations whose results are discarded, then `@Measurement`
iterations whose results are kept, and the harness aggregates measurement iterations across
all forks.

⚠️ **Warm-up is not "let the JIT finish" — it is "let the JIT reach its final state for this
workload"**, which is not the same thing and has no completion signal. Practical evidence that
warm-up was sufficient: the measurement iterations within a fork are flat. A visible downward
trend across the first few measurement iterations means warm-up was too short and part of the
climb from [02](02-why-the-jvm-defeats-naive-timing.md)'s tier ladder landed in the score.

🔴 **Watch the per-iteration output, not just the final line.** JMH prints each iteration; a
sloped sequence is the single most useful diagnostic the harness gives you for free.

⚠️ **Iteration *time* matters as much as iteration count.** `@Warmup(iterations = 20, time = 1,
timeUnit = MILLISECONDS)` is twenty very short iterations and is not equivalent to twenty
one-second ones. Both attributes are on the same annotation and both default to "unset"
sentinels.

## The honest cost, and how to spend it

Forks multiply everything, so the suite's runtime is the product of forks, iterations and
iteration time — this is why a thorough benchmark is measured in hours, and why
[Benchmarks in CI](10-benchmarks-in-ci.md) is its own problem.

Where to spend a fixed budget, in rough priority order:

1. **Enough warm-up that the measurement iterations are flat.** Everything else is invalid
   without it.
2. **Several forks** — this is what turns a number into a number with an error bar.
3. **More measurement iterations per fork**, which tightens the within-fork estimate.

⚠️ **Adding measurement iterations to a single fork is the least valuable of the three**: it
gives a very precise estimate of one JVM launch, which is precisely the quantity you should
not trust.

## Gotchas

🔴 **`-f 1` in a script silently overrides `@Fork(5)` in the source.** All these annotations
are documented as overridable by runtime options; CI wrappers are where benchmark rigour goes
to die.

🔴 **A benchmark that scores differently depending on which sibling ran first is telling you
forks are off or set to zero.** Fix the harness before investigating the code.

⚠️ **`@Fork(0)` results must never be quoted.** It runs in the harness JVM — convenient under
a debugger, meaningless as a measurement.

⚠️ **Fork warm-ups are not free.** `warmups = 5` costs five extra JVM launches per benchmark;
use it when you have evidence the first launch is atypical, not by default.

⚠️ **More forks do not fix a wrong benchmark.** Profile pollution and run-to-run variance are
the only two things forking addresses; dead code, constant folding and a bad `@State` scope
survive any number of JVM launches.

⚠️ **Each fork pays JVM startup and full warm-up.** For a benchmark whose warm-up is minutes,
twenty forks is hours. Choose fork count deliberately rather than copying a number from a blog.

⚠️ **A machine with fewer cores than your benchmark's thread count changes the experiment, not
just the noise.** Fork count cannot compensate for an undersized host.

⚠️ **Sleeping or blocking benchmarks need forks too, but for a different reason** — as the
run-to-run sample shows, their variance may be established once per JVM at setup, so a single
fork measures one draw from that distribution and reports it with false precision.

## Interview questions

**★ Why does JMH fork by default?**
To isolate each benchmark in its own JVM so profile-guided optimisation from one benchmark
cannot contaminate another. The forking sample shows two identical `Counter` implementations
measuring differently in one JVM because *"the profiles for C1 and C2 had merged together"*.

**★ What is the second thing forking buys you?**
An estimate of run-to-run variance. JVM behaviour is non-deterministic across launches, and
forking aggregates results across several launches so the reported score carries a meaningful
error.

**★ Why is `@Fork(1)` a poor choice for a real benchmark?**
Because it gives an accurate measurement of one JVM launch with no information about how much
launches differ. The run-to-run sample's `@Fork(1)` baseline is a single draw from a 0–1000 ms
distribution; the forked runs recover the true average with confidence.

**★ What is the difference between fork warm-ups and warm-up iterations?**
`@Fork(warmups = n)` discards whole JVM launches; `@Warmup(iterations = n)` discards
iterations inside each launch. The first addresses atypical first launches, the second
addresses the JIT reaching its final state.

**★ How can you tell warm-up was too short?**
The per-iteration output slopes — the first measurement iterations are slower than the last.
A flat sequence of measurement iterations is the practical evidence that warm-up finished.

**★ Given a fixed time budget, where should it go?**
First to enough warm-up for flat iterations, then to more forks, and only then to more
measurement iterations per fork. Precision within one JVM is the least valuable thing to buy.

**★ Your benchmark's score changes when you reorder methods in the class. What is happening?**
Profile pollution across benchmarks sharing a JVM — forking is disabled or set to zero. The
call sites saw multiple receiver types and the JIT generated code that is uniformly worse for
all of them.

**★ Does forking make a flawed benchmark correct?**
No. It removes cross-benchmark contamination and exposes run-to-run variance. Dead-code
elimination, constant folding, wrong `@State` scope and an unrealistic input distribution are
untouched by it.

Next: [Reading the error bars](07b-reading-the-error-bars.md).

{/* FOOTER */}
