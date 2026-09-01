---
title: "A Blackhole is a method whose entire job is to be impossible to optimise away, and the 500 lines of padding, volatile reads and inheritance tricks behind it are the honest measure of how hard that is"
sidebar_label: "06 · Blackholes"
sidebar_position: 11
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-01 against the **JMH `Blackhole` source** on `master`
> ([github.com/openjdk/jmh](https://github.com/openjdk/jmh/blob/master/jmh-core/src/main/java/org/openjdk/jmh/infra/Blackhole.java)) —
> 545 lines, whose class javadoc and `IMPLEMENTATION NOTES` comment are quoted below — and
> the samples `JMHSample_09_Blackholes` and `JMHSample_34_SafeLooping`.
> JMH 1.37, JDK 25. 🔴 **No sandbox** — no benchmark was run for this page.

**The one-line definition is in the class javadoc, and it is worth reading closely because
every word is doing work:**

> *"Black hole "consumes" the values, conceiving no information to JIT whether the value is
> actually used afterwards. This can save from the dead-code elimination of the computations
> resulting in the given values."*

🔴 **"Conceiving no information to JIT" — not "using the value".** A blackhole does not
consume in any useful sense; it constructs a situation the optimiser cannot see through. And
note the hedge: *"can save from"*, not "prevents".

## When to use one, and when not to

From [02b](02b-dead-code-elimination.md): a single result should be **returned**, and the
harness sinks it for you. The samples are blunt about the alternative:

> *"NOTE: If you are only producing a single result, it is more readable to use the implicit
> return, as in `JMHSample_08_DeadCode`. Do not make your benchmark code less readable with
> explicit Blackholes!"*

Explicit blackholes are for **multiple results**, and the samples offer two options:

```java
// Option A: merge multiple results into one and return it
@Benchmark
public int measureRight_1() {
    return compute(x1) + compute(x2);
}

// Option B: use explicit Blackhole objects, and sink the values there
@Benchmark
public void measureRight_2(Blackhole bh) {
    bh.consume(compute(x1));
    bh.consume(compute(x2));
}
```

with the caveat on Option A: it is *"OK when [the] computation is relatively heavyweight, and
merging the results does not offset the results much."* ⚠️ **On cheap operations the addition
is a measurable part of the answer** — that is when Option B earns its verbosity.

The `Blackhole` is *"just another `@State` object, bundled with JMH"*, which is why it can be
injected as a parameter alongside your own state ([05](05-state.md)).

## Why the implementation is 545 lines

The `IMPLEMENTATION NOTES` comment names three hazards a naive sink would hit:

> *"a) Dead-code elimination: the arguments should be used on every call, so that compilers are
> unable to fold them into constants or otherwise optimize them away along with the
> computations resulted in them."*
> *"b) False sharing: reading/writing the state may disturb the cache lines. We need to isolate
> the critical fields to achieve tolerable performance."*
> *"c) Write wall: we need to ease off on writes as much as possible, since it disturbs the
> caches, pollutes the write buffers, etc. This may very well result in hitting the memory wall
> prematurely. Reading memory is fine as long as it is cacheable."*

🔴 **(b) and (c) are why your home-made sink is worse than useless.** A `volatile` counter you
increment per call is a write on the critical path, contended across threads — it defeats
elimination *and* dominates the measurement. The blackhole is built to be undeletable **and**
cheap, and those two goals fight each other. That is the whole engineering problem.

The four compiler behaviours it leans on are listed in the same comment: superclass fields are
not reordered with subclass fields; *"Compilers are unable to predict the value of the volatile
read"*; *"Compilers' code motion usually respects data dependencies, and they would not
normally schedule the consumer block before the code that generated a value"*; and compilers
do not do aggressive inter-procedural optimisation, *"and/or break them when the target method
is forced to be non-inlineable"*.

Hence the design: pad fields to isolate cache lines; compare the incoming primitive against
*two* distinct volatile-guarded values *(both checks are never true at once)*; use the incoming
value so the sink is anchored after the code that produced it; and forbid inlining of the
blackhole methods as a safety net — *"This is why Blackhole methods are prohibited from being
inlined. This is treated specially in JMH runner code (see `CompilerHints`)."*

The comment ends with a warning that is also a good argument against writing your own:

> ***"IMPLEMENTING AN EFFICIENT / CORRECT BLACKHOLE IS NOT A SIMPLE TASK YOU CAN DO OVERNIGHT.
> IT REQUIRES A SIGNIFICANT JVM/COMPILER/PERFORMANCE EXPERTISE, AND LOTS OF TIME OVER THAT.
> ADJUST YOUR PLANS ACCORDINGLY."***

⚠️ **The object-consuming path has an extra problem the comment spells out**: a smart compiler
could fold the reference comparison to `false`, so JMH uses an inlined thread-local random to
give the sentinel object *"infinitesimal probability"* of escaping, warms the slow path so it
is not pruned, and clears the captured reference through a second alias so consumed objects
are not retained. 🔴 **A blackhole that retained everything you fed it would be a memory leak
that changed the GC behaviour of every benchmark.**

## You cannot construct one

The constructor takes a `String challengeResponse` and fails at runtime. The comment explains
the reasoning: *"Prevent instantiation by user code. Without additional countermeasures to
properly escape Blackhole, its magic is not working. The instances of Blackholes which are
injected into benchmark methods are treated by JMH, and users are supposed to only use the
injected instances."*

🔴 **`new Blackhole()` in a unit test or a hand-rolled harness produces an object with none of
the guarantees.** Take it as a parameter, always.

## `consumeCPU(long tokens)` — the other tool

`Blackhole.consumeCPU` burns a controlled amount of work. Its implementation notes are
instructive about how carefully "waste some time" has to be written:

- it seeds from previous state *"so that JIT could not memoize"*;
- it counts **backwards** because *"for the forward loop HotSpot/x86 generates "cmp" with
  immediate on the hot path, while the backward loop tests against zero with "test""*, and it
  mixes the induction variable in *"so that reversing the loop is the non-trivial
  optimization"*;
- it updates shared state only in an unlikely branch (`if (t == 42)`) to *"dodge DCE"* without
  *"furious writes"*.

⚠️ **`tokens` are not time units.** The comment admits *"non-linearity on low token counts"*
and attributes it to hardware effects. Use `consumeCPU` for *relative* backoff — simulating a
payload between operations — not to inject a known number of nanoseconds.

⚠️ Note also that `consumeCPU` is compiled with `dontinline` while `consume` is hinted
`inline` — the two have opposite requirements and JMH tells the JIT so explicitly.

## Consuming a collection safely

`JMHSample_34_SafeLooping` covers the case where the benchmark produces many values: feeding
them to a blackhole one at a time is correct, but the *loop* around the consume calls is your
loop again, with all of [02c](02c-constant-folding-and-loop-hoisting.md)'s hazards. The
sample's answer is a per-element `bh.consume(…)` over an array read from state — never a loop
whose bounds and contents the compiler can see through.

## Gotchas

🔴 **Do not add explicit blackholes to single-result benchmarks.** The samples say so
directly. The implicit return is both more readable and equally effective.

🔴 **Never construct a `Blackhole` yourself** — it is designed to fail, and if you defeat that,
its properties do not hold outside the JMH-managed instance.

⚠️ **A blackhole call is not free.** It is engineered to be cheap, but on nanosecond-scale
operations the consume shows up in the number. This is another reason to compare against a
baseline that does the same consuming.

⚠️ **`consumeCPU` is not a timer.** Token counts are non-linear at the low end by the
implementation's own admission.

⚠️ **Consuming inside your own loop reintroduces loop optimisations.** The consume defeats
dead-code elimination for each element; it does not stop the loop being unrolled or hoisted.

⚠️ **Blackholes are per-thread state.** In a multi-threaded benchmark each worker gets its own,
which is exactly what stops the sink from becoming the contention point — and another reason a
shared static sink of your own would be wrong.

⚠️ **A benchmark using an explicit `Blackhole` returns `void`**, so a reviewer cannot tell at a
glance whether every produced value is sunk. Make it obvious: one `consume` per produced value,
in the same order.

## Interview questions

**★ What does a `Blackhole` do, in the javadoc's own terms?**
It *"consumes" the values, conceiving no information to JIT whether the value is actually used
afterwards*, which *"can save from"* dead-code elimination of the computations that produced
them. It is a construction the optimiser cannot see through, not a real consumer.

**★ When should you use an explicit blackhole instead of returning a value?**
Only when a benchmark produces more than one result. For a single result, the implicit return
is sunk by the generated harness and is more readable — the samples explicitly warn against
adding unnecessary explicit blackholes.

**★ Why not just write your own sink — a static volatile field, say?**
Because a naive sink is either optimisable or expensive. JMH's notes name false sharing and the
write wall as first-order concerns, which is why the class is padded, compares against
volatile-guarded constants, and avoids writes on the hot path. The comment ends by warning
that a correct, efficient blackhole is not an overnight task.

**★ Why are `Blackhole.consume` methods prohibited from being inlined?**
As a safety net. The implementation relies on field-layout, volatile-read and code-motion
behaviours; making the method non-inlineable defends the design if one of those assumptions
fails, giving *"defense in depth"* where a point failure is a performance nuisance rather than
a correctness catastrophe.

**★ Why does the blackhole go out of its way not to retain consumed objects?**
Because retaining them would leak and would change the GC behaviour of the benchmark. It
stores through one alias and clears through another, reading the aliases from volatile fields
so alias analysis cannot prove they are the same box.

**★ What is `Blackhole.consumeCPU` for, and what is it not for?**
For burning a controlled, relative amount of CPU — for example simulating work between
operations. It is not a calibrated delay: the implementation notes non-linearity at low token
counts caused by hardware effects.

**★ Why does `consumeCPU` count its loop backwards?**
Because on HotSpot/x86 a backward loop tests against zero with `test` while a forward loop
compares against an immediate with `cmp`, producing different machine code for different
constants. Counting backwards, and mixing in the induction variable, keeps the generated code
uniform and makes reversing the loop a non-trivial optimisation.

**★ Can you construct a `Blackhole` in a test?**
No — the constructor requires a challenge-response string and fails at runtime by design. Only
the instances JMH injects into benchmark methods carry the intended guarantees.

Next: [Compiler blackholes](06b-compiler-blackholes.md).

{/* FOOTER */}
