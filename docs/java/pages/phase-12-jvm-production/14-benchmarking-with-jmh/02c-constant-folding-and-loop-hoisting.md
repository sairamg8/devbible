---
title: "If the answer never changes, the compiler will compute it once — so a benchmark with a literal input is a benchmark of returning a literal, and the IDE's two most confident suggestions both make it worse"
sidebar_label: "02c · Constant folding and hoisting"
sidebar_position: 4
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-01 against the **JMH samples** in the OpenJDK repository —
> `JMHSample_10_ConstantFold`
> ([github.com/openjdk/jmh](https://github.com/openjdk/jmh/blob/master/jmh-samples/src/main/java/org/openjdk/jmh/samples/JMHSample_10_ConstantFold.java))
> and `JMHSample_11_Loops`. JMH 1.37, JDK 25.
> 🔴 **No sandbox** — the outcomes described are the samples' own stated expectations.

**[02b](02b-dead-code-elimination.md) was about results nobody reads. This page is the
mirror image: inputs nobody varies. A computation over a constant has a constant answer, and
a compiler that can prove that is entitled to replace the whole thing with the answer.**

## The sample, and the two comments aimed at your IDE

```java
public class JMHSample_10_ConstantFold {

    // IDEs will say "Look, this field could be final". Don't. Trust. Them.
    private int x = 42;

    // IDEs will say "Oh, you can convert this field to local variable". Don't. Trust. Them. Either.
    private final int wrongX = 42;

    private int compute(int d) {
        for (int c = 0; c < 10; c++) {
            d = d * d / 42;
        }
        return d;
    }

    @Benchmark
    public int baseline()      { return 42; }                 // simply return the value

    @Benchmark
    public int measureWrong_1() { return compute(42); }        // predictable source, foldable

    @Benchmark
    public int measureWrong_2() { return compute(wrongX); }    // predictable source, foldable

    @Benchmark
    public int measureRight()   { return compute(x); }         // source is not predictable
}
```

Both wrong variants **return their result** — the dead-code defence is in place and it does
not help. The sample states the mechanism:

> *"If JVM realizes the result of the computation is the same no matter what, it can cleverly
> optimize it. In our case, that means we can move the computation outside of the internal
> JMH loop."*

🔴 **Note what the folded benchmark converges to: `baseline()`, which returns the literal 42.**
That is the same tell as dead code — the measurement collapses onto "the cost of returning a
value" — which is why the baseline method is worth its two lines.

The prescription is stated positively and is the rule to memorise: read inputs *"from
non-final instance fields of `@State` objects, computing the result based on those values,
and follow the rules to prevent DCE"*. Both halves are required. See [State](05-state.md).

## Why `final` and "convert to local" are the wrong reflexes here

The comments in the sample are unusually emphatic — *"Don't. Trust. Them."* and *"Don't.
Trust. Them. Either."* — with the qualification that matters:

> *"While this is normally fine advice, it does not work in the context of measuring
> correctly."*

⚠️ **This is the one context in Java where an IDE's most standard refactorings are actively
harmful.** `final` on a field with a constant initialiser tells the compiler the value can
never change; converting a field to a local puts the value directly in the method the
optimiser is compiling. Both convert an opaque input into a known one, which is exactly the
precondition for folding. A team benchmark suite that has been "cleaned up" by an
inspections run can silently break every benchmark in it, and nothing goes red.

🔴 **Static analysis and benchmarks disagree by construction.** If your build runs an
inspection profile over benchmark sources, exclude the benchmark module — or expect its
recommendations to invalidate your measurements.

## Hoisting: the loop version of the same idea

Folding removes work because the *answer* is invariant. Hoisting removes work because the
*computation* is invariant across loop iterations — the compiler lifts it out of the loop
and runs it once. `JMHSample_11_Loops` shows the effect at increasing repetition counts and
reports its conclusion in one line:

> *"You might notice the larger the repetitions count, the lower the "perceived" cost of the
> operation being measured. Up to the point we do each addition with 1/20 ns, well beyond
> what hardware can actually do."*

> *"This happens because the loop is heavily unrolled/pipelined, and the operation to be
> measured is hoisted from the loop. Moral: don't overuse loops, rely on JMH to get the
> measurement right."*

The sample's honest version is a method that does one addition:

```java
int x = 1;
int y = 2;

@Benchmark
public int measureRight() {
    return (x + y);
}
```

and the dishonest versions wrap `reps(n)` loops with `@OperationsPerInvocation(n)` so the
harness divides by `n`. The division is arithmetically correct; the premise — that `n`
iterations cost `n` times one iteration — is what the optimiser destroys.

⚠️ **`@OperationsPerInvocation` is not a workaround for hoisting.** It is a legitimate
annotation for the case where one invocation genuinely performs `n` indivisible operations
(a bulk API, a batch encode). Using it to justify a hand-written repetition loop reintroduces
every problem the harness exists to remove. 🔴 **The loop the sample calls acceptable is the
one JMH generates, because JMH controls what crosses its boundary.**

The sample also names the origin of the habit — *"This is the bad thing Caliper taught
everyone"* — which is why so much benchmark code found in the wild has this shape.

## The other loop transformations that will bite you

- **Unrolling and pipelining.** Independent iterations are executed in parallel by the CPU's
  out-of-order machinery, so per-iteration cost falls below the latency of the operation.
  Measuring latency requires a dependency chain; measuring throughput requires independence.
  A hand-rolled loop silently measures the second while you describe the first.
- **Loop-invariant code motion.** Anything inside the loop that does not depend on the
  induction variable moves out. If your setup accidentally sits inside the timed loop, it may
  cost nothing at all — or it may cost everything, if it *does* depend on the variable.
- **Fusing and reordering across iterations.** Consecutive iterations can be merged when the
  compiler can prove the merge is equivalent, which changes both the instruction mix and the
  cache behaviour.
- **Vectorisation.** A simple arithmetic loop may be turned into SIMD instructions, so the
  per-element cost divides by the vector width. That is a real optimisation your production
  code may also get — but only if production has the same loop, which it usually does not.

## Gotchas

🔴 **A `static final` constant is the strongest form of this bug.** It is a compile-time
constant in the class file, so it can be folded before HotSpot even sees it. Benchmark
inputs must never be `static final`.

🔴 **A constant-folded benchmark and a dead-code-eliminated benchmark produce the same
symptom — a result at baseline speed — but have different fixes.** Consuming the result does
not fix folding, and varying the input does not fix an unused result. Check both.

⚠️ **Deriving inputs from `Math.random()` inside the timed method fixes folding by adding a
new cost.** Random number generation is not free, and a shared `Random` is contended. Put
randomness in `@Setup`, store it in a non-final field, and read it in the benchmark.

⚠️ **A `@State` field initialised to a literal and never mutated is unpredictable to the
compiler only because it is *reachable* by other code.** Do not lean on that harder than
necessary: assign inputs in `@Setup` where the value comes from something the compiler cannot
see, such as a parsed parameter.

⚠️ **`@Param` values are strings the harness injects, which is the idiomatic way to make an
input genuinely opaque** — and it gives you the sweep across sizes you probably wanted
anyway.

⚠️ **Beware benchmarks whose input distribution is a single value.** Even with a non-final
field, always passing the same value trains the branch predictor and the profile in a way
production will not repeat. Not folding, but the same class of error — an unrealistically
predictable world.

⚠️ **A benchmark result that improves as you increase the internal repetition count is not
"amortising overhead better".** It is the loops sample's exact signature of hoisting and
unrolling. The right response is to delete the internal loop.

⚠️ **Escape analysis is folding's ally.** If a non-escaping object's fields are all known,
the object is scalar-replaced and its field reads become constants. A builder benchmark can
disappear this way even though every result is returned.

## Interview questions

**★ A benchmark returns `compute(42)` and reports the same time as a method returning a
literal. What happened?**
Constant folding. The input is a compile-time constant, so the entire computation has a
fixed result and the JIT hoists it out of the harness loop or replaces it with the value.
Returning the result does not help, because the returned thing is a constant.

**★ Why is `private final int x = 42;` worse than `private int x = 42;` in a benchmark?**
Because `final` promises the value never changes, which lets the compiler treat it as a
constant and fold everything derived from it. The constant-fold sample marks the `final`
field `wrongX` and expects it to measure the same as passing the literal.

**★ What does the JMH sample prescribe instead?**
Reading inputs from non-final instance fields of `@State` objects, computing from those
values, and following the dead-code rules as well. Both defences are needed; either alone
leaves a hole.

**★ Explain "1/20 of a nanosecond per addition".**
It is the loops sample's illustration that a hand-written repetition loop is unrolled,
pipelined and hoisted until the reported per-operation cost is below what the hardware can
physically do — proof that the number is an artefact rather than a measurement.

**★ Is `@OperationsPerInvocation` a legitimate annotation?**
Yes, for methods that genuinely perform `n` indivisible operations per invocation, such as a
bulk or batch API. It is not a licence to hand-roll a repetition loop: dividing by `n` is
correct arithmetic on a premise the optimiser has already invalidated.

**★ How do you tell a latency measurement from a throughput measurement in a loop?**
By whether iterations depend on each other. A dependency chain (each result feeds the next)
measures latency; independent iterations let the CPU overlap them and measure throughput.
Hand-written loops usually produce the second while the author reports the first.

**★ Your team's IDE inspection profile "cleaned up" the benchmark module. Why is that a
problem?**
Because two of its standard suggestions — make the field `final`, convert the field to a
local — are precisely what enables constant folding. The samples carry comments telling you
to refuse both, and note the advice is normally fine *outside* the context of measuring.

**★ Where should randomness live in a JMH benchmark, and why not inside the method?**
In `@Setup`, with the generated values stored in state fields. Generating random numbers
inside the timed method adds the generator's cost and, with a shared generator, its
contention to every measurement.

Next: [What JMH is](03-what-jmh-is.md).

{/* FOOTER */}
