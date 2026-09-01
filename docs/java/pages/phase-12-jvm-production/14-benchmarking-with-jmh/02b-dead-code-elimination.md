---
title: "Dead-code elimination is not a bug in your benchmark, it is the compiler doing exactly its job on code whose result nobody wanted — and the only defence is to make somebody want it"
sidebar_label: "02b · Dead-code elimination"
sidebar_position: 3
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-01 against the **JMH samples** in the OpenJDK repository —
> `JMHSample_08_DeadCode`
> ([github.com/openjdk/jmh](https://github.com/openjdk/jmh/blob/master/jmh-samples/src/main/java/org/openjdk/jmh/samples/JMHSample_08_DeadCode.java))
> and `JMHSample_09_Blackholes`. JMH 1.37, JDK 25.
> 🔴 **No sandbox** — the expected outcomes below are the samples' own stated expectations,
> not runs performed here.

**A compiler is allowed to delete any computation whose result cannot be observed. In
production that is a gift: it is why your unused defensive copy costs nothing. In a
benchmark it is the whole failure, because the benchmark's entire purpose is to run a
computation whose result nobody wants.**

## The minimal demonstration

`JMHSample_08_DeadCode` is three methods and a helper, and the three are meant to be read
together:

```java
@State(Scope.Thread)
@BenchmarkMode(Mode.AverageTime)
@OutputTimeUnit(TimeUnit.NANOSECONDS)
public class JMHSample_08_DeadCode {

    int x;

    private int compute(int d) {
        for (int c = 0; c < 10; c++) {
            d = d * d / 42;
        }
        return d;
    }

    @Benchmark
    public void baseline() {
        // Do nothing, this is a baseline
    }

    @Benchmark
    public void measureWrong() {
        // This is wrong: result is not used and the entire computation is optimized away.
        compute(x);
    }

    @Benchmark
    public int measureRight() {
        // This is correct: the result is being used.
        return compute(x);
    }
}
```

🔴 **The `baseline()` method is not decoration — it is the diagnostic.** Its whole job is to
give you a number for "an empty benchmark method call". When `measureWrong()` lands on top
of `baseline()`, the computation is gone. The sample says exactly what to expect:
*"You can see the unrealistically fast calculation in with `measureWrong()`, while realistic
measurement with `measureRight()`."*

⚠️ **Without a baseline you cannot tell "very fast" from "not executed".** Adding one costs a
single empty method and converts an unfalsifiable result into a falsifiable one. Every
benchmark class should have one.

## Why returning the value is enough

The single-result defence is the return statement, and the mechanism is described in the
sample's own words:

> *"JMH provides the essential infrastructure to fight this where appropriate: returning the
> result of the computation will ask JMH to deal with the result to limit dead-code
> elimination (returned results are implicitly consumed by Blackholes …)"*

That is the important structural point about the harness: the generated code around your
method takes the return value and sinks it into a `Blackhole`. You do not write the sink,
which is why you cannot forget it — but note the wording, **"limit"** dead-code elimination,
not "prevent". The defence is a construction the optimiser cannot see through, not a
guarantee written into the language.

The follow-up sample adds the readability rule that people routinely get backwards:

> *"NOTE: If you are only producing a single result, it is more readable to use the implicit
> return, as in `JMHSample_08_DeadCode`. Do not make your benchmark code less readable with
> explicit Blackholes!"*

🔴 **`return` first; reach for an explicit `Blackhole` only when there is more than one
result.** See [Blackholes](06-blackholes.md).

## Partial elimination is the version that fools people

The failure is not all-or-nothing. `JMHSample_09_Blackholes` shows the half-eliminated case:

```java
@Benchmark
public int measureWrong() {
    compute(x1);            // redundant — optimized out
    return compute(x2);     // intact
}
```

with the comment *"While the `compute(x2)` computation is intact, `compute(x1)` is redundant
and optimized out."* The benchmark still returns something. It still produces a plausible
number. It measures **half the work you thought you were measuring**, and the expected
outcome is stated: *"You will see `measureWrong()` running on-par with `baseline()`"* while
both correct variants *"are measuring twice the baseline"*.

⚠️ **Any benchmark that performs several operations and returns only the last one has this
bug.** Building a list, then returning `list.size()`; parsing five documents, returning the
fifth; encoding then decoding, returning only the decode. In each case the earlier work may
be provably unobservable.

## The subtler forms

**Elimination through the fields you wrote to.** Writing results into an instance field looks
like an observation, and often is — but a field written and never read within the compiled
scope can still be optimised, and a `static` field write is a much stronger barrier than a
local. Prefer the harness's sink to inventing your own.

**Elimination of allocation.** Escape analysis can remove an object entirely, so a benchmark
of "how expensive is allocating this" can measure nothing at all if the object never escapes
and is never read. This is one of the very few places where an allocation-rate profiler
answers the question directly — see [Profilers in JMH](08-profilers-in-jmh.md).

**Elimination through inlining.** `compute()` is `private` and small, so it inlines; once
inlined, its body is exposed to the caller's optimiser and dead code inside it becomes
visible. The method boundary you assumed was a barrier is not one.

**Elimination of the exception path.** Code that only produces an observable effect by
throwing, in a benchmark that never throws, can have its throwing path pruned by profile —
so "how expensive is the validation" measures the validation's fast path only.

## Gotchas

🔴 **`Blackhole.consume()` on a value you never computed is not a defence, it is a lie.**
Consuming a stale field, or a value computed before warm-up, keeps the sink but removes the
work. Consume the *result of this invocation*.

🔴 **A `System.out.println` inside the benchmark is not a legitimate sink.** It defeats
elimination by adding I/O, locking and formatting that dwarf whatever you were measuring.
The number becomes a measurement of your console.

⚠️ **`assert` statements are disabled at runtime unless `-ea` is set**, so an assertion is
not an observation of the result. Worse, a benchmark that behaves differently under `-ea`
than without it is measuring two different programs.

⚠️ **A `volatile` field write is a real barrier — and that is the problem.** It prevents
elimination by imposing memory-ordering costs on every write, which on a nanosecond-scale
benchmark can be most of the measured time. It is a heavier sink than `Blackhole`.

⚠️ **Summing results into a local and returning the sum changes the computation.** It is a
legitimate defence — the samples call it *"Option A: merge multiple results into one and
return it"* and note it is *"OK when the computation is relatively heavyweight, and merging
the results does not offset the results much"* — but on cheap operations the addition is a
material part of the cost.

⚠️ **Dead-code elimination interacts with [constant folding](02c-constant-folding-and-loop-hoisting.md).**
If the input is constant the result may be folded to a literal, and a returned literal is
almost free even though it is technically "used". Fixing one and not the other leaves the
benchmark broken.

⚠️ **A result you return from a `SingleShotTime` benchmark is still consumed** — the sink
is in the generated harness for every mode, not just the looping ones. The mode changes how
often the method is called, not whether its result is sunk.

## Interview questions

**★ What is dead-code elimination and why does it hit benchmarks specifically?**
It is the compiler removing computations whose results cannot be observed. Benchmarks are
uniquely exposed because a benchmark's product is the *act* of computing, not the value —
so the value is genuinely unused, and the optimiser is correct to delete the work.

**★ How does JMH stop it, and what exactly does the documentation claim?**
By consuming results: returning a value makes the generated harness sink it into a
`Blackhole`. The sample's wording is *"limit dead-code elimination"* — a construction the
optimiser cannot see through, not a language-level guarantee.

**★ Why should every benchmark class have an empty `baseline()` method?**
Because it gives you the cost of an empty benchmark invocation. A result that sits on top of
the baseline is evidence the work was eliminated. Without it, "extremely fast" and "did not
run" are indistinguishable.

**★ A benchmark computes two values and returns one. What is wrong?**
The other computation may be eliminated as redundant. The blackholes sample shows precisely
this shape and expects the two-value version to run on par with the baseline while the
corrected versions measure twice it.

**★ When should you use an explicit `Blackhole` rather than returning a value?**
Only when there is more than one result to sink. The samples are explicit that a single
result should use the implicit return, and warn against making benchmark code less readable
with unnecessary explicit blackholes.

**★ Is writing the result to an instance field a reliable sink?**
Not reliably, and it introduces its own costs. A field write in an inlined, non-escaping
context can still be optimised, and making it `volatile` to guarantee the barrier adds
memory-ordering cost that can exceed the operation being measured. Use the harness's sink.

**★ Your benchmark of "allocating a small object" reports near-zero cost. What are the two
candidate explanations?**
Escape analysis eliminated the allocation because the object never escapes and is never
read, or the result is unconsumed and the whole computation was removed. Consuming the
object and checking an allocation profiler (`-prof gc`) distinguishes them.

**★ Why can inlining make dead-code elimination worse?**
Because it dissolves the method boundary you were relying on. Once the callee's body is
inlined into the caller, the optimiser sees the whole computation together and can prove
parts of it unobservable that were opaque across the call.

Next: [Constant folding and loop hoisting](02c-constant-folding-and-loop-hoisting.md).

{/* FOOTER */}
