---
title: "Writing a benchmark, running it, and — the step everyone skips — deciding whether to believe it: the review checklist for a JMH result someone is about to make a decision with"
sidebar_label: "11 · The checklist"
sidebar_position: 19
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-01 — this page consolidates the sources cited across the topic: the **JMH
> samples** and **annotation sources** on `master`
> ([github.com/openjdk/jmh](https://github.com/openjdk/jmh)), the JMH `README.md`, and the
> **HotSpot compilation policy** header for JDK 25. JMH 1.37, JDK 25.
> 🔴 **No sandbox** — nothing on this page was run.

**A benchmark has three phases and the third one has no tooling. Writing it is a skill,
running it is a command, and believing it is a judgement — which is why this page is a
checklist and not a procedure.**

## Before writing: is a microbenchmark the right instrument?

- [ ] **Do you know this code is on the critical path?** If the answer comes from intuition
      rather than a profile of the running service, stop and profile first
      ([09](09-what-a-microbenchmark-cannot-tell-you.md)).
- [ ] **Is the question "which of these two", not "how fast is the system"?** JMH answers the
      first. Load testing answers the second.
- [ ] **Is the unit of work bigger than the harness overhead** — several cycles per call
      ([03](03-what-jmh-is.md))? If not, benchmark a batch.

## Writing

- [ ] **Standalone module**, generated from the archetype, depending on the application's jars
      ([03b](03b-project-setup.md)).
- [ ] **Inputs in non-final instance fields of a `@State` object**, assigned in `@Setup`, never
      literals and never `static final` ([02c](02c-constant-folding-and-loop-hoisting.md)).
- [ ] **Every result consumed** — returned for a single value, explicit `Blackhole` only for
      several ([02b](02b-dead-code-elimination.md), [06](06-blackholes.md)).
- [ ] **No loop inside the benchmark method.** If one invocation must do N operations, use
      `batchSize` or `@OperationsPerInvocation` honestly ([04b](04b-modes.md)).
- [ ] **A `baseline()` method** that does nothing, or the trivial version of the operation, so
      "very fast" can be distinguished from "did not run".
- [ ] **`Scope.Thread` unless the shared object is the subject** ([05](05-state.md)).
- [ ] **The right mode for the question** — `Throughput`, `AverageTime`, `SampleTime`,
      `SingleShotTime` ([04b](04b-modes.md)).
- [ ] **`@Param` sweep over sizes and shapes**, so a ranking that flips is visible.
- [ ] **No `Level.Invocation` fixture** unless the invocation exceeds a millisecond and you have
      read all four warnings ([05b](05b-fixture-levels.md)).

## Running

- [ ] **Several forks** — never `-f 1` for a result you will quote ([07](07-forks-and-warmup.md)).
- [ ] **Enough warm-up that measurement iterations are flat**; confirm with `-prof comp`
      ([08](08-profilers-in-jmh.md)).
- [ ] **`-prof gc` attached at least once**, and `gc.alloc.rate.norm` recorded.
- [ ] **A quiet machine**: no build, no IDE indexing, no other container.
- [ ] **Options recorded with the results** — JMH version, JDK build, mode, threads, forks,
      iteration times, JVM args ([10](10-benchmarks-in-ci.md)).

## Believing it — the review questions

- [ ] **Does the score have an error term, and do the intervals separate?** Overlap means no
      demonstrated difference ([07b](07b-reading-the-error-bars.md)).
- [ ] **Is the result physically possible?** Sub-nanosecond arithmetic, or a result on top of
      the baseline, means elimination ([01](01-the-benchmark-that-measured-nothing.md)).
- [ ] **Is the improvement suspiciously large?** Two or more orders of magnitude is usually a
      broken losing side, not a brilliant winning one.
- [ ] **Did the *slow* side get faster when you changed the fast side?** Profile pollution —
      check forking.
- [ ] **Does the benchmarked code appear in `-prof stack`?**
- [ ] **Did allocation per operation change in the direction the story requires?**
- [ ] **Would the ranking survive a different input size, a second implementation class, or a
      polymorphic call site?**
- [ ] **What fraction of production time does this code hold?** Multiply before quoting.

## Reviewing someone else's benchmark

The JMH README asks for exactly this — *"Your benchmarks should be peer-reviewed"* — and the
highest-yield checks are structural rather than statistical:

1. Where does the input come from? (Literal or `final` → folding.)
2. What happens to the result? (Dropped → elimination.)
3. Is there a loop in the method? (→ hoisting and unrolling.)
4. What is the `@State` scope, and does anything write to shared state?
5. How many forks, and did the command line override the annotations?
6. Is the mode right for the claim being made?
7. Is there a baseline, and where does it sit relative to the results?

🔴 **Six of those seven are answerable from the diff alone**, without running anything. That is
why benchmark review is worth doing and why it is so rarely done.

## The five sentences to take away

1. A hand-rolled timing loop measures dead code, folded constants, an unrolled loop and one
   JVM's luck — and its error is systematically optimistic.
2. JMH is a code generator, not a library; its defences are structural because you cannot
   forget to write code you never wrote.
3. Warm-up and forking address different problems — within-run compilation state and
   across-run contamination — and neither substitutes for the other.
4. Allocation per operation is the most portable number a benchmark produces; timing is the
   least.
5. A benchmark tells you which implementation is cheaper in isolation. Whether that matters is
   a question for a profile, and whether to ship it is a question for a load test.

## Gotchas

🔴 **The checklist is not a substitute for the baseline method.** Every structural check can
pass while the computation is still eliminated; the baseline is what makes that visible.

🔴 **A benchmark that has never been reviewed by a second person should be treated as a draft.**
The README asks for peer review before publishing results, and the failure modes are exactly
the ones authors are blind to.

⚠️ **Benchmarks committed without their run configuration cannot be reproduced.** Store the
command line next to the code.

⚠️ **A green benchmark suite is not evidence of performance.** It is evidence that the
benchmarked operations, in isolation, did not change measurably.

⚠️ **Optimising to a benchmark eventually optimises the benchmark.** Revisit whether the
benchmarked operation still resembles what production does.

⚠️ **Do not delete a benchmark that stopped showing a difference.** That it no longer
distinguishes two implementations is itself a result worth keeping.

## Interview questions

**★ Give the shortest useful benchmark review checklist.**
Where does the input come from, what happens to the result, is there a loop in the method,
what is the `@State` scope, how many forks, is the mode right for the claim, and is there a
baseline. Almost all of it is answerable from the diff.

**★ What single addition most improves a benchmark class?**
A `baseline()` method. It converts "surprisingly fast" — which is unfalsifiable — into
"indistinguishable from doing nothing", which is a diagnosis.

**★ A colleague reports a 200× speed-up. What do you say?**
That it is a bug report about the benchmark until proven otherwise. Two orders of magnitude on
comparable code usually means the losing side ran and the winning side was eliminated or
folded. Check the baseline and the consumed results first.

**★ What must be stored alongside a benchmark result for it to be comparable later?**
JMH version, JDK build, the full option line (mode, threads, forks, iteration counts and
times), JVM args, and the host. A bare score is not comparable to anything.

**★ Which single measurement transfers best from benchmark to production?**
Allocation per operation. It is a property of the code rather than of the machine; the cost of
that allocation still depends on the collector and heap size.

**★ How do you know warm-up was sufficient?**
The measurement iterations are flat rather than sloping, and `-prof comp` shows only a small
fraction of total compiler time inside the measurement window. Some background compilation at
steady state is expected.

**★ You have one afternoon and a performance question. What is the order of work?**
Profile the running service to locate the cost; write a small JMH benchmark of the candidate;
run it with several forks and `-prof gc`; check the intervals separate; then load test the
change before believing anything about the system.

**★ Why does this topic end with "believing it" as a separate phase?**
Because JMH removes the mechanical errors and cannot remove the interpretive ones. The harness
has no way to tell you that the code is off the critical path, that the input is unrealistic,
or that a significant difference is too small to matter.

That is the end of topic 14. The next topic in the phase is **Checkpoint/restore with CRaC**
*(not written yet)*.

{/* FOOTER */}
