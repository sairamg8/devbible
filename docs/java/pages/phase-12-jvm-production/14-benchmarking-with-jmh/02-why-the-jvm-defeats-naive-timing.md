---
title: "The JVM does not execute your method — it executes five progressively better versions of your method, chosen by counters, and a benchmark that does not say which version it measured has not said what it measured"
sidebar_label: "02 · Why the JVM defeats naive timing"
sidebar_position: 2
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-01 against the **HotSpot source** for JDK 25 —
> `src/hotspot/share/compiler/compilationPolicy.hpp` at tag `jdk-25+36`
> ([raw.githubusercontent.com](https://raw.githubusercontent.com/openjdk/jdk/jdk-25%2B36/src/hotspot/share/compiler/compilationPolicy.hpp)),
> whose header comment is the authoritative description of the tiered levels and the
> transition predicates — and the **JDK 25 `java` man page**
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html))
> for `-XX:{+|-}TieredCompilation`, `-XX:TieredStopAtLevel=n`, `-XX:CompilationMode=mode`
> and `-XX:CompileThresholdScaling`. 🔴 **No sandbox** — no JVM was run; no timing,
> compilation log or level transition below is a measurement.

**[01](01-the-benchmark-that-measured-nothing.md) said the naive benchmark measures four other
things. This page is the mechanism behind three of them. It is worth knowing in outline
even if you never write a benchmark, because it is also why your service is slow for the
first thirty seconds after a deploy.**

## Five execution levels, not two

The usual folk model is "interpreted at first, then JIT-compiled". HotSpot's own header
comment is more specific, and the extra detail is what breaks benchmarks:

> *"The system supports 5 execution levels:*
> *level 0 - interpreter (Profiling is tracked by a MethodData object, or MDO in short)*
> *level 1 - C1 with full optimization (no profiling)*
> *level 2 - C1 with invocation and backedge counters*
> *level 3 - C1 with full profiling (level 2 + All other MDO profiling information)*
> *level 4 - C2 with full profile guided optimization"*

Three of those five are C1. 🔴 **The important distinction inside C1 is not speed but
whether the code is collecting a profile**, because that profile is the input to C2, and C2
is the version whose speed you were trying to report.

The comment is equally explicit about the cost of profiling: *"level 2 is generally faster
than level 3 by about 30%, therefore we would want to minimize the time a method spends at
level 3"*. ⚠️ **Profiled code is slower than unprofiled code.** A benchmark that finishes
while the method is still at level 3 has measured a deliberately handicapped version.

## What decides when you move up

Not a fixed invocation count. The predicate is in the source, and both counters matter:

> *"`i > TierXInvocationThreshold * s || (i > TierXMinInvocationThreshold * s && i + b > TierXCompileThreshold * s)`,*
> *where `i` is the number of method invocations, `b` number of backedges and `s` is the
> scaling coefficient"*

Two things follow that people get wrong constantly.

**`s` is not a constant.** It is computed from compiler load:
`s = queue_size_X / (TierXLoadFeedback * compiler_count_X) + 1`. The thresholds therefore
*rise when the compiler queues are busy*. 🔴 **The JVM's compilation behaviour depends on how
much other compilation is happening** — which is to say, on what else your benchmark class
contains, and on the machine's core count.

**The path is not fixed either.** The policy may send a method to level 2 first rather than
level 3 when the C2 queue is long, because *"if we transitioned to level 3 we would be stuck
there until our C2 compile request makes its way through the long queue"*; it may profile in
the interpreter at level 0 instead; and a method judged *trivial* after its first C1 compile
*"is compiled at level 1 instead of 4"*. Same source, same input, different sequence of
compiled versions depending on load.

⚠️ **Compile queues are priority queues, and stale entries are dropped**: the policy computes
an event rate per queued method, takes the largest, and uses the rate *"to remove stale
methods (the ones that got on the queue but stopped being used shortly after that)"*. A
method that was hot for a moment can be queued and then never compiled at all.

## OSR — the loop gets compiled while it is still running

The naive benchmark spends its whole life inside one long-running `main` loop, so it never
returns and its *invocation* counter never grows. On-stack replacement is what rescues it,
and its trigger is the backedge counter alone:

> *"OSR transitions are controlled simply with `b > TierXBackEdgeThreshold * s` predicates."*

So the loop is compiled mid-flight and execution jumps from the interpreted frame into the
compiled version. 🔴 **The measured region therefore contains a transition, and where the
transition falls inside your ten million iterations is not under your control.** Worse, an
OSR-compiled method is compiled *for the loop*, entered at a backedge, with the enclosing
method's state as it happened to be — it is not the same compilation the JIT would produce
for the method called normally a million times. The number you print is an average across
at least two qualitatively different machine-code versions.

## Profile-guided speculation, and the deoptimisation cliff

Level 4 is *"C2 with full profile guided optimization"*, and the operative word is
*speculation*: C2 emits code that is correct only while the assumptions the profile
suggested continue to hold — this call site has seen one receiver type, this branch is never
taken, this exception is never thrown. When an assumption breaks, the frame is
deoptimised back to the interpreter and the method is recompiled.

This produces two benchmark pathologies that look nothing alike:

- **The benchmark that gets faster than production.** Feed it one type, one branch, one size,
  and C2 will specialise for exactly that. Production has four types. Your number describes
  a monomorphic world that does not exist.
- **The benchmark that gets slower partway through.** Introduce the second type at iteration
  five million and the call site goes bimorphic or megamorphic, the speculative code is
  thrown away, and the remaining iterations run different code. Averaged, this reads as "a
  bit slower than expected" rather than "two distinct regimes".

⚠️ **This is also why the order of benchmark methods in one JVM matters** — the profile is
per call site, not per benchmark, which is the profile-pollution result
[01](01-the-benchmark-that-measured-nothing.md) quoted from the forking sample and which
[Forks and warmup](07-forks-and-warmup.md) turns into a rule.

## The flags people reach for, and what they actually do

The man page documents these; note what it does *not* promise.

| Flag | What it does |
|---|---|
| `-XX:{+\|-}TieredCompilation` | Turns the multi-level policy on or off. Off means one compiler, and on JDK 25 that is C2 — so *slower to warm up*, not faster. |
| `-XX:TieredStopAtLevel=n` | Caps the level. `TieredStopAtLevel=1` is the "C1 only" mode people use for fast-start CLIs. |
| `-XX:CompilationMode=mode` | Selects a whole compilation mode rather than tweaking levels. |
| `-XX:CompileThresholdScaling=scale` | *"Provides unified control of first compilation … values less than 1.0 result in earlier compilation while values greater than 1.0 delay compilation."* |
| `-XX:CompileCommand=exclude,…` | Excludes a method from compilation entirely — occasionally useful to prove a result is a JIT artefact. |

🔴 **None of these make a naive benchmark correct.** `TieredStopAtLevel=1` gives you a stable
but unrepresentative number: C1 code, no profile-guided optimisation, not what production
runs. Lowering `CompileThresholdScaling` gets you compiled sooner without telling you
*which* version you ended up in. They are diagnostic instruments, not fixes.

⚠️ **The "Client VM emulation" note is a trap for benchmark scripts.** The man page says that
mode *"will not be enabled if any of the following flags are used on the command line"* and
lists `-XX:{+|-}TieredCompilation`, `-XX:CompilationMode`, `-XX:TieredStopAtLevel`,
`-XX:{+|-}EnableJVMCI`, `-XX:{+|-}UseJVMCICompiler`. Setting one of these to "control" the
JIT can silently change an unrelated behaviour.

## What a harness has to do about all this

Everything above reduces to one requirement: **the measurement must start after the code has
reached its final compiled state, and it must be repeated in fresh processes so that state
is reached the same way each time.** That is warm-up and forking, and it is why they are
not optional extras but the two structural features of [what JMH is](03-what-jmh-is.md).

Notice the two are different defences. Warm-up handles *within-run* progression through the
levels. Forking handles *across-run* contamination — profile pollution and run-to-run
variance. Doing one without the other leaves half the problem.

## Gotchas

🔴 **"The JIT kicks in after 10,000 invocations" is folklore with a number attached.** The
threshold is a family of `Tier?` thresholds scaled by a load-dependent coefficient, and both
invocations and backedges feed the predicate. Quoting a single number implies a determinism
the policy explicitly does not have.

🔴 **Disabling tiered compilation to "get to C2 faster" gets there slower.** Without the
tiered policy the method has to accumulate its counters in the interpreter until it
qualifies for C2 directly; the level-3 stage exists precisely to give C2 a profile early.

⚠️ **A benchmark that reaches level 4 and then deoptimises has no single answer to report.**
If a run contains a regime change, the mean is a summary of two populations. This is exactly
what [`Mode.SampleTime` and percentiles](04b-modes.md) exist to expose.

⚠️ **Trivial methods may never reach C2 at all** — the policy compiles them at level 1 when
C1 decides more optimisation would yield the same code. Benchmarking a one-line getter and
concluding something about C2 is a category error.

⚠️ **Machine load changes the compilation path, so a busy CI agent does not run the same
experiment as your laptop.** The scaling coefficient is a function of compiler queue length
and compiler thread count — both of which depend on the host and on what else it is doing.

⚠️ **Level 3 code is roughly 30% slower than level 2 by the policy's own reckoning, and it is
the level you are most likely to be stuck in during a short benchmark.** Short warm-ups do
not merely fail to reach the fast version; they concentrate measurement in the slowest
compiled one.

⚠️ **The interpreter is not "the same code, just slower".** It has no inlining and no
escape analysis, so allocations that vanish in compiled code are real allocations in
interpreted code. Interpreted timings mislead about allocation behaviour as well as speed.

## Interview questions

**★ How many execution levels does HotSpot have, and what is at each?**
Five, per the compilation policy header: level 0 interpreter with MDO profiling, level 1 C1
fully optimised without profiling, level 2 C1 with invocation and backedge counters, level 3
C1 with full profiling, level 4 C2 with full profile-guided optimisation. Three of the five
are C1, differing in how much profiling they carry.

**★ Why is level 3 slower than level 2?**
Because level 3 carries full profiling instrumentation. HotSpot's own comment puts it at
about 30%, and says the policy tries to minimise the time a method spends there — it is a
cost paid to give C2 a good profile.

**★ What triggers OSR, and why does it matter to a benchmark?**
The backedge counter alone: `b > TierXBackEdgeThreshold * s`. It matters because a
long-running timing loop never returns, so the method is compiled and entered mid-loop. The
timed region then spans an interpreted phase, a transition and a compiled phase, and the
reported average mixes them.

**★ Is the compilation threshold a constant?**
No. The predicate is scaled by `s = queue_size_X / (TierXLoadFeedback * compiler_count_X) + 1`,
so thresholds rise as the compiler queues get busy. Compilation behaviour depends on machine
load and compiler thread count, not only on your code.

**★ What is deoptimisation, and how can it show up in a benchmark result?**
C2 emits code valid only under profile-derived assumptions; when one breaks, the frame falls
back to the interpreter and the method is recompiled. In a benchmark it appears as a regime
change partway through a run — often invisible in a mean, visible in percentiles or as
inflated run-to-run variance.

**★ Would `-XX:TieredStopAtLevel=1` make benchmarks more reliable?**
More *stable*, not more reliable. You get C1 code with no profile-guided optimisation, which
is reproducible but is not what production executes. It is a diagnostic — useful to show that
a result depends on C2 — not a way to make a naive benchmark valid.

**★ Why do warm-up and forking solve different problems?**
Warm-up addresses progression through the levels *within* a run, so measurement starts at the
final compiled state. Forking addresses contamination *across* runs — profile pollution
between benchmark methods and run-to-run variance of the JVM itself. Neither substitutes for
the other.

**★ Your benchmark is faster than the same code in production. Give a JIT-level explanation.**
The benchmark presents one receiver type, one branch direction and one input size, so C2
speculates aggressively and the call sites stay monomorphic. Production is polymorphic, so
the speculative code is either never generated or repeatedly invalidated. The benchmark
measured a specialisation that production never gets.

Next: [Dead-code elimination](02b-dead-code-elimination.md).

{/* FOOTER */}
