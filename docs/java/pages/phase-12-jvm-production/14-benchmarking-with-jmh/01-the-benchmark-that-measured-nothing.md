---
title: "Every Java developer has written the same benchmark — nanoTime, a loop, a division — and it is not a slightly inaccurate measurement of your code, it is an accurate measurement of four other things"
sidebar_label: "01 · The benchmark that measured nothing"
sidebar_position: 1
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-01 against the **JMH samples** in the OpenJDK repository
> ([github.com/openjdk/jmh](https://github.com/openjdk/jmh/tree/master/jmh-samples/src/main/java/org/openjdk/jmh/samples)) —
> `JMHSample_08_DeadCode`, `JMHSample_10_ConstantFold`, `JMHSample_11_Loops`,
> `JMHSample_12_Forking`, `JMHSample_13_RunToRun` — and the JMH `README.md` on `master`.
> Latest released JMH on Maven Central: **1.37**. Version spine: JDK 25, Spring Boot 4.1.1.
> 🔴 **No sandbox** — no benchmark was run for these pages. Every number quoted below comes
> from the JMH samples' own commentary and is attributed where it appears; nothing is a
> measurement taken here.

**The hand-rolled benchmark is not a rough approximation that JMH later refines. It is a
measurement of a different thing entirely, and its error is not small and random — it is
large and systematic, and it always points the same way: the code you were proud of looks
fast, because the compiler deleted it.**

This topic exists because the failure is invisible. A wrong unit test goes red. A wrong
benchmark prints a number with three decimal places, and three decimal places are extremely
persuasive.

## The benchmark everyone writes

```java
public class Bench {
    public static void main(String[] args) {
        long start = System.nanoTime();
        for (int i = 0; i < 10_000_000; i++) {
            compute(42);
        }
        long end = System.nanoTime();
        System.out.println((end - start) / 10_000_000.0 + " ns/op");
    }

    static int compute(int d) {
        for (int c = 0; c < 10; c++) {
            d = d * d / 42;
        }
        return d;
    }
}
```

It runs. It prints a number. The number is meaningless, and it is meaningless for **four
independent reasons**, each of which alone would be enough to invalidate it. They are worth
separating, because each has its own defence and the defences are different.

## Reason 1 · Nothing reads the result, so there may be no result

`compute(42)` is called and its return value is dropped. A compiler that can prove the call
has no side effect and no observed result is entitled to delete the call. The JMH samples
name this directly:

> *"The downfall of many benchmarks is Dead-Code Elimination (DCE): compilers are smart
> enough to deduce some computations are redundant and eliminate them completely. If the
> eliminated part was our benchmarked code, we are in trouble."*

`JMHSample_08_DeadCode` shows the shape as a matched pair — `measureWrong()` calls
`compute(x)` and ignores it, `measureRight()` returns it — and tells you what you will see:

> *"You can see the unrealistically fast calculation in with `measureWrong()`, while
> realistic measurement with `measureRight()`."*

🔴 **This is not a theoretical hazard, it is the default outcome.** The loop body of the
naive benchmark above is exactly `measureWrong()`. See
[Dead-code elimination](02b-dead-code-elimination.md).

## Reason 2 · The input is a literal, so the answer is a literal

`compute(42)` takes a compile-time constant. Every operation inside is pure arithmetic on
that constant. The result is therefore knowable without running anything, and the JIT is
very good at knowing it. `JMHSample_10_ConstantFold`:

> *"If JVM realizes the result of the computation is the same no matter what, it can cleverly
> optimize it. In our case, that means we can move the computation outside of the internal
> JMH loop."*

⚠️ **Making the field `final` does not help — it hurts.** The sample carries two comments
aimed straight at your IDE's suggestions:

> *"IDEs will say "Look, this field could be final". Don't. Trust. Them."*

and, on converting a field to a local:

> *"IDEs will say "Oh, you can convert this field to local variable". Don't. Trust. Them.
> Either."*

Both refactorings are correct advice for production code and wrong for a benchmark, because
both make the input more predictable. The sample states the rule positively: read inputs
*"from non-final instance fields of `@State` objects"*. See
[Constant folding and loop hoisting](02c-constant-folding-and-loop-hoisting.md).

## Reason 3 · The loop is the thing being optimised, not the body

The ten-million-iteration loop is there to amortise timing overhead. It also hands the
optimiser a perfectly regular loop with a loop-invariant body, which is precisely the shape
loop unrolling, pipelining and hoisting exist to demolish. `JMHSample_11_Loops` is built to
show it, and its conclusion is quantitative:

> *"You might notice the larger the repetitions count, the lower the "perceived" cost of the
> operation being measured. Up to the point we do each addition with 1/20 ns, well beyond
> what hardware can actually do."*

> *"This happens because the loop is heavily unrolled/pipelined, and the operation to be
> measured is hoisted from the loop. Moral: don't overuse loops, rely on JMH to get the
> measurement right."*

🔴 **"1/20 ns per addition" is the tell that matters.** It is not a plausible-but-wrong
number; it is faster than the hardware can retire an instruction, which means the reported
cost is an artefact and not a measurement. A benchmark result that beats physics has not
found a fast path — it has found an eliminated one.

The sample also names where the habit came from: *"This is the bad thing Caliper taught
everyone."*

## Reason 4 · One JVM, one run, one profile

Even with the first three fixed, the number comes from a single JVM invocation. Two
consequences, and they are usually conflated:

**Profile pollution.** The JIT specialises code against the types and branches it has
actually seen. Run two implementations of an interface in one JVM and the call site becomes
megamorphic for both. `JMHSample_12_Forking`:

> *"JVMs are notoriously good at profile-guided optimizations. This is bad for benchmarks,
> because different tests can mix their profiles together, and then render the "uniformly
> bad" code for every test."*

The sample's two `Counter` implementations are byte-for-byte identical in behaviour and
still measure differently: *"Note that C1 is faster, C2 is slower, but the C1 is slow again!
This is because the profiles for C1 and C2 had merged together."* 🔴 The order in which you
wrote your benchmark methods changed the answer.

**Run-to-run variance.** `JMHSample_13_RunToRun` states the general case:

> *"JVMs are complex systems, and the non-determinism is inherent for them. This requires us
> to always account the run-to-run variance as the one of the effects in our experiments."*

A single run gives you one sample from a distribution you have not characterised, and no
error bar. Comparing two such numbers is not a comparison. See
[Forks and warmup](07-forks-and-warmup.md) and
[Reading the error bars](07b-reading-the-error-bars.md).

## What the number actually was

Put the four together and the printed `ns/op` is best read as: *the time this particular JVM
took to run an unrolled loop whose body may have been partly or wholly removed, in an
interpreter-then-JIT transition of unknown position, on one profile, once*. Only the last
word of that is about your code, and it is the word `once`.

⚠️ **And it is not merely noisy — it is biased in one direction.** Every mechanism above
makes the measured time *smaller*. There is no matching mechanism that inflates it, so the
naive benchmark systematically flatters whichever implementation the optimiser found easier
to delete. That is why "my version is 40× faster" survives peer review: it is the expected
output of a broken harness, not a surprising one.

## Why the fix is a harness and not discipline

You could, in principle, defend against all four by hand: consume every result, read inputs
from mutable state, avoid the loop, run many JVMs and aggregate. That list is exactly what
[JMH is](03-what-jmh-is.md) — and the reason to take the harness rather than the discipline
is that the failure mode is silent. There is no output that tells you discipline slipped.
The harness makes the defences structural: they are in generated code you did not write and
cannot forget.

## Gotchas

🔴 **A benchmark that "shows a 50× improvement" is a bug report about the benchmark.** Real
algorithmic wins on comparable code are usually within an order of magnitude. Two, three or
four orders of magnitude almost always means one side was eliminated. Check the losing side
for a consumed result before you believe the winning one.

🔴 **Warm-up by "running it a few times first" is not warm-up.** It changes *when* the JIT
compiles, not *whether* the compiled code is specialised to your benchmark's peculiar
profile. Iterating before timing removes the interpreter from the measurement and leaves
every other defect intact.

⚠️ **`System.currentTimeMillis()` is the wrong clock and `nanoTime()` is not a wall clock.**
`currentTimeMillis` has millisecond granularity at best and can move backwards when the
system clock is adjusted; `nanoTime` is monotonic but its origin is arbitrary, so only
differences mean anything and only within one JVM.

⚠️ **Timing overhead is not negligible at nanosecond scale.** A pair of `nanoTime()` calls
around a single operation measures mostly the `nanoTime()` calls. This is the real problem
the loop was trying to solve — and the loop's cure is worse than the disease, which is why
JMH solves it by calling the method in a generated time-bound loop it controls.

⚠️ **The JIT is not the only source of drift.** GC pauses, dynamic frequency scaling, the OS
scheduler, another container on the same node and page-cache state all move the number, and
none of them are visible in `ns/op`. A single run cannot distinguish them from your change.

⚠️ **Printing an average over the whole loop hides everything interesting.** Total time over
iteration count discards the distribution, so a run where 1% of operations took 200× longer
looks identical to a uniform one. If tail behaviour is what you care about, an average was
never the right statistic — see [Modes](04b-modes.md).

⚠️ **Running the benchmark from an IDE adds its own distortions.** The JMH README is explicit
that running from within an existing project or IDE is possible *"however setup is more
complex and the results are less reliable"*, and recommends the archetype-generated
standalone project instead.

⚠️ **A benchmark method that throws is not a benchmark that failed silently.** JMH declares
the opposite behaviour for its own harness — *"If the code throws the actual exception, the
benchmark execution will stop with an error"* — whereas a hand-rolled `main` that swallows
exceptions in the loop will happily time the catch block.

## Interview questions

**★ You are shown a benchmark that times a `for` loop with `System.nanoTime()` and reports
0.05 ns/op. What do you say?**
That the number is impossible before it is unlikely: no mainstream CPU retires an operation
in a twentieth of a nanosecond, so the loop body was optimised away or hoisted out. The JMH
loops sample reaches exactly this point and names unrolling, pipelining and hoisting as the
mechanism.

**★ Name the four independent defects in a hand-rolled timing loop.**
Dead-code elimination when the result is unused; constant folding when the input is a
literal or a `final` field; loop optimisations (unrolling, pipelining, hoisting) on the
timing loop itself; and single-JVM effects — profile pollution across benchmarks plus
uncharacterised run-to-run variance. Each needs a different defence.

**★ Why does making a benchmark's input field `final` make things worse?**
Because it tells the compiler the value never changes, which enables constant folding of
everything computed from it. The JMH constant-fold sample carries a comment aimed at IDE
suggestions — *"IDEs will say "Look, this field could be final". Don't. Trust. Them."* — and
prescribes non-final instance fields of a `@State` object instead.

**★ Two implementations of the same interface benchmark differently in one JVM, and the
difference disappears when each runs alone. What happened?**
Profile pollution. The shared call site saw both types, became megamorphic, and the JIT
generated uniformly worse code for both. The forking sample demonstrates this with two
identical `Counter` classes and says the profiles *"had merged together"*.

**★ Is the error in a naive benchmark random or systematic?**
Systematic, and one-directional. Every mechanism listed — elimination, folding, hoisting —
removes work, so the measured time is biased low. That is why naive benchmarks so often
"prove" a large speed-up: the harness rewards whichever side was easier to optimise away.

**★ Why is "run it a thousand times first to warm it up" insufficient?**
It only removes interpreted execution from the timed region. It does nothing about dead
code, constant folding, loop hoisting, profile pollution or run-to-run variance, and it
gives no error bar — so the surviving defects are exactly the ones that change the verdict.

**★ Why not just fix the four defects by hand instead of adopting a harness?**
Because the failure is silent: nothing in the output reveals that a defence was forgotten.
A harness makes the defences structural — they live in generated code you cannot omit — and
it aggregates across JVM launches so the result arrives with a confidence interval rather
than as a single number.

**★ What is `System.nanoTime()` actually guaranteed to give you?**
A monotonic, high-resolution time source with an arbitrary origin, meaningful only as a
difference and only within one JVM. It is not a wall clock, it is not comparable across
processes, and at single-operation scale the cost of calling it is comparable to the thing
being timed.

Next: [Why the JVM defeats naive timing](02-why-the-jvm-defeats-naive-timing.md).

{/* FOOTER */}
