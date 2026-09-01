---
title: "Every JMH annotation is a default that three other things can override — the class, the method and the command line — so the question is never 'what does @Warmup mean' but 'which @Warmup won'"
sidebar_label: "04 · The annotations"
sidebar_position: 7
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-01 against the **JMH annotation sources** on `master` —
> `Benchmark`, `Warmup`, `Measurement`, `Fork`, `BenchmarkMode`, `OutputTimeUnit`
> ([github.com/openjdk/jmh](https://github.com/openjdk/jmh/tree/master/jmh-core/src/main/java/org/openjdk/jmh/annotations)) —
> whose javadocs are the primary source for the placement and override rules below.
> JMH 1.37, JDK 25. 🔴 **No sandbox** — no benchmark was built or run for this page.

**JMH's annotations look like configuration and behave like defaults. Nearly every one of
them carries the same javadoc sentence — it may be placed on the method or on the class, and
it *"may be overridden with the runtime options"* — which means a benchmark's real settings
are never visible in one place.**

## `@Benchmark`, and the rules it enforces

> *"`Benchmark` annotates the benchmark method. JMH will produce the generated benchmark code
> for this method during compilation, register this method as the benchmark in the benchmark
> list, read out the default values from the annotations, and generally prepare the
> environment for the benchmark to run."*

The javadoc then lists constraints, because the method is a wrapper the harness generates
code around:

> *"Method should be public"* ·
> *"Arguments may only include either `State` classes, which JMH will inject while calling
> the method …, or JMH infrastructure classes, like `Control`, or `Blackhole`"* ·
> *"Method can only be synchronized if a relevant `State` is placed on the enclosing class."*

🔴 **And the escape hatch, which is the answer to half of all "can I benchmark X" questions:**
*"If you want to benchmark methods that break these properties, you have to write them out as
distinct methods and call them from `Benchmark` method."* Your real code keeps whatever
signature it has; the `@Benchmark` method is a thin public wrapper that calls it.

⚠️ **Exceptions are failures, not results.** *"Benchmark method may declare Exceptions and
Throwables to throw. Any exception actually raised and thrown will be treated as benchmark
failure."* You may declare `throws` freely — but a benchmark that throws in production
conditions will be reported as failed, not as slow.

## The placement rule, stated once and applying everywhere

Almost every JMH annotation repeats this, verbatim in `Warmup`, `Measurement` and `Fork`:

> *"This annotation may be put at `Benchmark` method to have effect on that method only, or at
> the enclosing class instance to have the effect over all `Benchmark` methods in the class.
> This annotation may be overridden with the runtime options."*

They are also `@Inherited`, so a base class's settings apply to subclasses. 🔴 **Three
layers, and the command line wins.** A results table that does not match the annotations is
usually a command line you forgot, not a JMH bug — which is why the harness prints the
effective configuration for every benchmark it runs, and why you should read it.

## `@Warmup` and `@Measurement`

Same four attributes, from the sources:

| Attribute | Meaning | Default in the annotation |
|---|---|---|
| `iterations()` | number of iterations | `BLANK_ITERATIONS = -1` |
| `time()` | time for each iteration | `BLANK_TIME = -1` |
| `timeUnit()` | unit for that time | `TimeUnit.SECONDS` |
| `batchSize()` | *"number of benchmark method calls per operation"* | `BLANK_BATCHSIZE = -1` |

🔴 **The `-1` defaults are not "zero iterations" — they are "unset".** `BLANK_*` is a sentinel
meaning *fall through to the harness default or the command line*. Reading `-1` as a value is
a genuine misreading of these sources; the constants exist so JMH can tell "the author said
nothing" from "the author said one".

⚠️ **Warm-up iterations are run and thrown away.** They are not a shorter version of the
measurement — they exist so the tier ladder from
[02](02-why-the-jvm-defeats-naive-timing.md) has finished climbing before anything is
recorded. Too few and you are timing level 3.

⚠️ **`batchSize` belongs with `SingleShotTime`-style work-based measurement**, where one
"operation" is a batch of calls; see [Modes](04b-modes.md) and
`JMHSample_26_BatchSize`. It is not a way to make a fast operation measurable in the
time-based modes.

## `@Fork` — the annotation with the most surprising surface

From the source:

| Attribute | Javadoc |
|---|---|
| `value()` | *"number of times harness should fork, zero means "no fork""* |
| `warmups()` | *"number of times harness should fork and ignore the results"* |
| `jvm()` | *"JVM executable to run with"* |
| `jvmArgs()` | *"JVM arguments to replace in the command line"* |
| `jvmArgsPrepend()` | *"JVM arguments to prepend in the command line"* |
| `jvmArgsAppend()` | *"JVM arguments to append in the command line"* |

🔴 **`@Fork(0)` means "run in the harness JVM", and it is a debugging setting, not a fast
setting.** It removes exactly the defence against profile pollution that
[Forks and warmup](07-forks-and-warmup.md) exists for. It is useful under a debugger or a
profiler that cannot follow a forked process — and its results should never be quoted.

⚠️ **`warmups()` is whole *forks* discarded, not iterations.** It is the JVM-level analogue of
warm-up: run and throw away entire JVM launches, then keep the rest.

🔴 **`jvmArgs()` replaces; `jvmArgsAppend()` adds.** Using `jvmArgs` to "add a flag" silently
discards whatever the harness or the command line had set, which is how a benchmark ends up
running without the heap settings you thought you had. Prefer `jvmArgsAppend`.

⚠️ **`jvm()` selecting a different executable is how you compare JDKs honestly** — same
benchmark jar, same harness, two JVM binaries — but remember the benchmark jar itself was
compiled once, at one bytecode level.

## `@BenchmarkMode` and `@OutputTimeUnit`

`@BenchmarkMode(Mode.…)` selects what is measured; `@OutputTimeUnit(TimeUnit.…)` only selects
how the answer is *printed*. ⚠️ **Changing `@OutputTimeUnit` never changes a measurement**,
and choosing a unit far from the true scale produces results that are technically correct and
practically unreadable — nanosecond-scale work reported in seconds is a column of zeroes.

`@BenchmarkMode` accepts several modes at once, and `Mode.All` exists but is described in the
source as *"Meta-mode: all the benchmark modes. This is mostly useful for internal JMH
testing."* — not something to put in a real suite. The semantics of each mode are
[the next page](04b-modes.md).

## Gotchas

🔴 **A settings row in the output that contradicts your annotations is the command line
winning.** Every one of these annotations is explicitly overridable at runtime; CI wrappers
that pass `-f`, `-wi`, `-i` or `-bm` will beat the source.

🔴 **`@Fork(1)` in every sample is for the samples' sake, not yours.** The samples pass `-f 1`
to keep demonstrations short, and they say so in their run instructions. Copying `@Fork(1)`
into a real benchmark discards run-to-run variance information.

⚠️ **Putting `@Warmup`/`@Measurement` on the class and then again on one method is legal and
easy to misread.** The method wins for that method only, and nothing warns you that two
benchmarks in the same class ran different schedules.

⚠️ **A non-public `@Benchmark` method fails at generation time.** So does a benchmark method
taking arbitrary arguments — only `@State` objects and JMH infrastructure types such as
`Blackhole` and `Control` may be injected.

⚠️ **`synchronized` on a benchmark method is allowed only when a relevant `State` is on the
enclosing class**, per the javadoc. Benchmarking a synchronized method usually means wrapping
it, not annotating it.

⚠️ **`@Inherited` means an abstract benchmark base class silently configures its children.**
Useful for a house standard; confusing when a single subclass needs different warm-up and the
reader cannot see the base.

⚠️ **Declaring `throws` is free; throwing is not.** Benchmarks that legitimately exercise a
failure path must catch the exception inside the method and consume it, or they will be
reported as failures.

## Interview questions

**★ What are the constraints on a `@Benchmark` method?**
It must be public; its arguments may only be `@State` classes or JMH infrastructure types such
as `Blackhole` and `Control`; and it may be `synchronized` only if a relevant `State` is on
the enclosing class. Code that cannot meet these is called from a wrapper method instead.

**★ Where can `@Warmup` be placed, and what beats it?**
On the benchmark method (that method only) or on the enclosing class (all its benchmarks),
and it is `@Inherited`. Runtime options override all of it — the javadocs say so for every
one of these annotations.

**★ What does `iterations() default -1` mean?**
Unset, not zero. `BLANK_ITERATIONS`/`BLANK_TIME`/`BLANK_BATCHSIZE` are sentinels that let JMH
distinguish "the author said nothing" from an explicit value, so the harness default or the
command line can supply one.

**★ What is the difference between `@Fork(value = …)` and `@Fork(warmups = …)`?**
`value` is how many forks are run and counted; `warmups` is how many forks are run and
discarded — JVM-level warm-up, distinct from `@Warmup` iterations inside a fork.

**★ Why is `jvmArgsAppend` usually the right choice over `jvmArgs`?**
Because `jvmArgs` *replaces* the JVM argument line while `jvmArgsAppend` adds to it. Using
`jvmArgs` to add one flag silently drops everything else that was configured.

**★ When is `@Fork(0)` appropriate?**
Only for debugging — attaching a debugger or a tool that cannot follow forked processes. It
runs the benchmark in the harness JVM, giving up isolation from profile pollution, so its
numbers should never be reported.

**★ Does `@OutputTimeUnit` affect the measurement?**
No, only the presentation. It converts the reported score's units; the measurement mode and
schedule are unchanged. Picking a unit far from the true scale just makes the table
unreadable.

**★ Is `Mode.All` a good default for a suite?**
No. The enum's own javadoc calls it a meta-mode *"mostly useful for internal JMH testing"*.
Pick the mode that answers your question — throughput, average time, sampled time or single
shot.

Next: [Modes](04b-modes.md).

{/* FOOTER */}
