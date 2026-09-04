---
title: "PIT computes three numbers from two denominators, and the integer percentage function refuses to return anything between 99 and 100 unless every single mutant was detected — so a run at 99.7% prints 99, a run at exactly 100% prints 100, and a project with no mutants at all prints 100 as well"
sidebar_label: "04c · The score arithmetic"
sidebar_position: 27
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-09-01 against pitest 1.30.0 source read at the `1.30.0` tag:
> `pitest-entry/src/main/java/org/pitest/mutationtest/statistics/MutationStatistics.java`
> (including `report(PrintStream)`, `getPercentageDetected`, `getTestStrength` and
> `getTotalSurvivingMutations`), `statistics/Score.java`, `statistics/MutationStatisticsPrecursor.java`,
> `org/pitest/util/PercentageCalculator.java` (both overloads in full),
> `pitest-html-report/.../MutationTotals.java`, and `org.pitest.mutationtest.DetectionStatus`.
> Metric definitions from the [Maven quick start](https://pitest.org/quickstart/maven/) entries for
> `mutationThreshold`, `coverageThreshold` and `testStrengthThreshold`, quoted verbatim.
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1, JUnit Jupiter 6.0.3.
> ⚠️ **No sandbox and no build on this machine.** Every formula below is read from published source and
> every worked figure is arithmetic performed on this page. **No score, count or console output came
> from a run.**

**"The mutation score" is three different numbers in pitest, computed from one numerator and two
denominators, and the report shows all three side by side. Which one you quote changes the answer by a
lot on any project that is not fully covered. On top of that, the function that turns the fraction into
an integer percentage has three special cases and a hard cap, so the printed number is not simply the
fraction rounded — it refuses to print 100 unless every mutant was detected, and it prints 100 for a
project with no mutants at all. This chunk is the arithmetic. The thresholds built on top of it are
[04c2](04c2-thresholds-and-gates.md).**

## Three numbers, two denominators

`MutationStatistics` carries three totals, accumulated per mutator in
`MutationStatisticsPrecursor` and summed:

```java
private final long totalMutations;
private final long totalDetected;
private final long totalWithCoverage;
```

and derives everything from them:

```java
public int getPercentageDetected() {
  return getPercentage(getTotalMutations(), getTotalDetectedMutations());
}

public int getTestStrength() {
  return getPercentage(getTotalMutationsWithCoverage(), getTotalDetectedMutations());
}

public long getTotalSurvivingMutations() {
  return getTotalMutations() - getTotalDetectedMutations();
}
```

So:

| Metric | Numerator | Denominator | Documented as |
|---|---|---|---|
| **Mutation coverage** | detected | **all** mutants | *"the fraction of killed mutations out of all mutations"* |
| **Test strength** | detected | mutants **with coverage** | *"killed / (killed + survived), excluding mutants where no coverage information is available"* |
| **Line coverage** | covered lines | all lines | *"the fraction of the project covered by tests"* |

`totalWithCoverage` comes from `DetectionStatus.hasCoverage()`, which is a single expression:

```java
public boolean hasCoverage() {
  return this != NO_COVERAGE;
}
```

**That is the entire difference between the two mutation figures: whether `NO_COVERAGE` mutants are in
the denominator.** And since `NO_COVERAGE` carries `detected = false`, they are never in the numerator
either — so on a partially covered codebase, mutation coverage is dragged down by uncovered mutants and
test strength is not.

## What the difference is worth

Take a class with 100 mutants, of which 60 are covered, 45 of those killed and 15 survived; the other 40
are `NO_COVERAGE`.

- **Mutation coverage** = 45 / 100 = 45%
- **Test strength** = 45 / 60 = 75%
- **Surviving mutants**, as `maxSurviving` counts them = 100 − 45 = **55**

Three numbers, one class, all of them correct. The first says "less than half of this class's behaviour
is constrained". The second says "of the behaviour the tests actually reach, three quarters is
constrained". The third — the one a `maxSurviving` gate compares against — counts the 40 uncovered
mutants as survivors, because `getTotalSurvivingMutations()` is total minus detected and nothing else.

**Read both mutation figures, always.** A wide gap between them is a coverage problem; a low test
strength is an assertion problem ([04](04-reading-a-report.md)). Quoting only mutation coverage on an
under-covered project makes the tests look worse than they are; quoting only test strength makes the
project look better than it is.

## The console summary, and what it prints

`MutationStatistics.report(PrintStream)` is the source of the summary line everyone quotes:

```java
out.println(">> Generated " + this.getTotalMutations()
    + " mutations Killed " + this.getTotalDetectedMutations() + " ("
    + detected + "%)");
out.println(">> Mutations with no coverage " + this.getTotalMutationsWithoutCoverage()
        + ". Test strength " + strength + "%");
out.println(">> Ran " + this.numberOfTestsRun + " tests ("
    + getTestsPerMutation() + " tests per mutation)");

out.println("Enhanced functionality available at https://www.arcmutate.com/");
```

Four things worth noticing in that source.

**"Killed" in the summary means *detected*.** The value printed is
`getTotalDetectedMutations()`, which includes `TIMED_OUT`, `RUN_ERROR`, `MEMORY_ERROR` and `NON_VIABLE`
([04d](04d-the-statuses-that-are-not-findings.md)). The word in the output is narrower than the number
behind it.

**The no-coverage count is printed too**, on the second line, next to test strength. Everything you need
to separate a coverage problem from an assertion problem is in those two lines.

**`tests per mutation` is a cost figure**, computed as `numberOfTestsRun / totalMutations`. It is the
headline version of the XML's per-mutant `numberOfTestsRun` ([04a2](04a2-the-other-output-formats.md)),
and a high value means survivors — a killed mutant stops at the first failure, a survivor runs them all
([06 · The cost](06-the-cost.md)).

**The arcmutate line is unconditional**, hard-coded in the open-source reporter. It is an advertisement,
not a warning ([01b](01b-the-tool-and-its-versions.md)).

There is also a per-mutator breakdown: `Score.report` prints `> <mutatorName>` followed by its own
generated/killed counts and a per-status tally, four statuses to a line. **That breakdown is the most
useful part of the console output** and the reason to read it rather than only the HTML — it is where
you see that your `CONDITIONALS_BOUNDARY` mutants are dying and your `EMPTY_RETURNS` mutants are not.

## 🔴 The integer percentage function refuses to print 100

`PercentageCalculator.getPercentage(long, long)` is nine lines and every one of them matters:

```java
public static int getPercentage(long total, long actual) {
  if (total == 0) {
    return 100;
  }

  if (actual == 0) {
    return 0;
  }

  if (total == actual) {
    return 100;
  }

  return Math.min(99, Math.round((100f / total) * actual));
}
```

Four behaviours, three of them surprising.

**`total == 0` returns 100.** A class, package or project with **no mutants at all** scores 100%. That
is defensible — you cannot fail to detect mutants that do not exist — and it means a package of
interfaces, a package pitest could not mutate for lack of debug information, or a `targetClasses` glob
that matched nothing all report a perfect score. The Maven plugin's `failWhenNoMutations` defaulting to
`true` is the guard against the last of those ([05 · Wiring it up](05-wiring-it-up.md)), and it is a
build failure rather than a scoring correction.

**`actual == 0` returns 0**, short-circuiting before the rounding — so a run that killed nothing prints
0 rather than a rounded fraction.

**🔴 `Math.min(99, ...)` caps everything below 100.** Unless `total == actual` exactly, the integer
percentage can never exceed 99. So:

| Detected / total | True percentage | Printed |
|---|---|---|
| 999 / 1000 | 99.9% | **99** |
| 1996 / 2000 | 99.8% | **99** |
| 1000 / 1000 | 100% | **100** |
| 0 / 1000 | 0% | **0** |
| 0 / 0 | — | **100** |

**100 in a pitest report means every single mutant was detected.** Not "rounded to 100", not
"99.6 and up". That is a genuinely useful property — it removes the ambiguity that
`Math.round` would otherwise create at the top of the range — and it is invisible unless you read the
source. It also means the jump from 99 to 100 is a jump from "at least one survivor" to "none", which is
a much bigger step than the jump from 98 to 99.

The `BigDecimal` overload of the same function, which `thresholdPrecision` switches on, applies the same
three special cases and a cap of `100 − 10^-precision` — 99.9 at precision 1. It belongs with the
thresholds it exists for: [04c2](04c2-thresholds-and-gates.md).

## Where this connects

- **[04c2 · Thresholds and gates](04c2-thresholds-and-gates.md)** — the four things a build can fail on, the order they fire in, and the documented integer blind spot.
- **[04 · Reading a report](04-reading-a-report.md)** — the statuses that decide which mutants land in `totalDetected`.
- **[04a · The HTML report](04a-the-html-report.md)** — the three summary columns, which are these three numbers.
- **[04a2 · XML, CSV and the gaps](04a2-the-other-output-formats.md)** — `numberOfTestsRun`, the per-mutant version of "tests per mutation".
- **[04b2 · The ceiling on the score](04b2-the-ceiling-on-the-score.md)** — why the achievable maximum is below 100 anyway.
- **[09 · Thresholds](../09-jacoco/04-thresholds.md)** — the same argument for coverage, and the reason a floor beats a target.
- **[06 · The cost](06-the-cost.md)** — "tests per mutation" as the number that predicts your run time.

## Gotchas

**★ A pitest integer percentage can never be between 99 and 100.**
`Math.min(99, Math.round(...))` caps everything that is not an exact `total == actual`. A run at 99.9%
prints 99. That is deliberate and useful — 100 means *every* mutant was detected — but it makes the
top of the range non-linear, and it means "we went from 99 to 100" is a much larger improvement than
"we went from 98 to 99".

**★ A project with zero mutants scores 100%.**
`getPercentage` returns 100 when `total == 0`, before anything else. So a `targetClasses` glob that
matches nothing, a module of interfaces, or classes compiled without line-number debug information all
report a perfect score. The Maven plugin's `failWhenNoMutations` defaults to `true` precisely because
this number is not a useful signal on its own.

**★ Mutation coverage and test strength differ only in whether uncovered mutants are in the denominator.**
`hasCoverage()` is `this != NO_COVERAGE`, and `NO_COVERAGE` is also not detected. So mutation coverage
punishes you for untested code and test strength does not. Quoting one without the other is how the same
report supports two opposite stories about the same project.

**★ "Killed" in the console summary is the *detected* count, not the `KILLED` count.**
`report(PrintStream)` prints `getTotalDetectedMutations()` under the word "Killed", and that total
includes `TIMED_OUT`, `RUN_ERROR`, `MEMORY_ERROR` and `NON_VIABLE`. The per-status breakdown in the
per-mutator scores is where the real `KILLED` count lives.

**★ `getTotalSurvivingMutations()` counts uncovered mutants as survivors.**
It is `getTotalMutations() - getTotalDetectedMutations()`, with no reference to coverage. On a project
with a lot of untested code that number is far larger than the survivor list you were reading, and it is
the number a `maxSurviving` gate compares against ([04c2](04c2-thresholds-and-gates.md)).

**★ The per-mutator breakdown is in the console output and not in the HTML.**
`Score.report` prints one block per mutator — generated, killed, percentage and a per-status tally. That
is the view that tells you *which operator* your tests are failing to kill, which is the most actionable
summary pitest produces, and it exists only in the console log and the XML. Capture the log.

**★ "Tests per mutation" is a cost metric masquerading as a statistic.**
It is `numberOfTestsRun / totalMutations`. A high value means many covering tests ran per mutant, which
happens when mutants survive — pitest stops at the first failure for a kill. So the number goes *down*
as your assertions improve, and it is the single best predictor of how long the next run will take.

## Interview questions

**★ What is the difference between mutation coverage and test strength?**
The denominator. Both have detected mutants as the numerator; mutation coverage divides by all mutants,
test strength divides by mutants that have coverage — pitest's `DetectionStatus.hasCoverage()` is simply
`this != NO_COVERAGE`. So test strength answers "of the behaviour my tests actually reach, how much is
constrained", and mutation coverage folds in the untested code as well. On a fully covered project they
are identical; on a partially covered one they can differ enormously, and reading only one of them lets
the same report support two opposite conclusions. Pitest prints both, side by side, in the console
summary and in every HTML summary table, which is a strong hint that it expects you to read both.

**★ Your report says 99%. How much better could it be?**
Possibly a great deal, because pitest's integer percentage caps at 99 for anything short of perfection —
`Math.min(99, Math.round(...))`, with an explicit `total == actual` branch returning 100. So 99 covers
everything from "one survivor in a thousand mutants" to "one in a hundred". The way to find out is to
read the surviving count rather than the percentage, or to set `thresholdPrecision` and get a decimal
figure, whose cap is `100 − 10^-precision` — 99.9 at precision 1. It is also why 100 in a pitest report
is a strong statement: it means every single mutant was detected, not that the number rounded up.

**★ A module reports 100% mutation coverage. What do you check before believing it?**
Whether it generated any mutants. `PercentageCalculator` returns 100 when the total is zero, before any
other logic, so a `targetClasses` glob that matched nothing, a module of interfaces and enums, or classes
compiled without line-number debug information all report a perfect score. After that, the *Active
mutators* list, because a narrow operator set produces few mutants and the ones it produces are the
easiest to kill. And then the class breakdown, because a genuine 100 on code with real branching is
close to impossible given equivalent mutants — the ceiling is below 100 on anything non-trivial.
`failWhenNoMutations` defaulting to true is the guard the tool ships for the first of these.

**★ How would you tell, from the numbers alone, whether a team's problem is coverage or assertions?**
The two mutation figures and the no-coverage count, all three of which pitest prints on two consecutive
console lines. If mutation coverage is far below test strength, the gap is uncovered mutants — a
coverage problem, and one JaCoCo already reported. If test strength is itself low, the tests reach the
code and do not constrain it — an assertion problem, which is the only thing mutation testing can tell
you that nothing else can. And if "tests per mutation" is high, the assertion problem is also costing
runtime, because every survivor runs all of its covering tests to completion. Three numbers from one
run, and they separate the two failure modes cleanly.

{/* FOOTER */}
