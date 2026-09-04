---
title: "A pitest build can fail on four independent gates that fire in a fixed order, a threshold of zero means the gate is off rather than always-pass, the integer percentages they compare have a blind spot pitest's own documentation works through in four numbered cases, and maxSurviving — the steadiest gate of the four — counts uncovered mutants as survivors"
sidebar_label: "04c2 · Thresholds and gates"
sidebar_position: 28
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-09-01 against the pitest
> [Maven quick start](https://pitest.org/quickstart/maven/) entries for `mutationThreshold`,
> `coverageThreshold`, `testStrengthThreshold` and `thresholdPrecision` — including *The integer
> threshold blind spot* section with all four numbered cases, quoted verbatim — the
> [command line quick start](https://pitest.org/quickstart/commandline/)'s identical section, and
> pitest 1.30.0 source read at the `1.30.0` tag: `pitest-maven/src/main/java/org/pitest/maven/PitMojo.java`
> (`mutationThreshold`, `coverageThreshold`, `testStrengthThreshold`, `maxSurviving`,
> `thresholdPrecision` and all four `throwErrorIf…` methods in `execute()`), and
> `org/pitest/util/PercentageCalculator.java`'s `BigDecimal` overload.
> Gradle behaviour from `PitestPluginExtension.groovy` on the gradle-pitest-plugin `master` branch.
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1, JUnit Jupiter 6.0.3.
> ⚠️ **No sandbox and no build on this machine.** Parameter behaviour is read from published source and
> documentation; the worked cases below are pitest's own, quoted. **No build outcome on this page came
> from a run.**

**[04c](04c-the-score-arithmetic.md) is how the numbers are computed. This chunk is what happens when
you gate a build on them. There are four independent gates, not one; they fire in a fixed order so the
first failure is the only one you see; a threshold of `0` disables a gate rather than setting an
always-satisfied one; and pitest's own documentation contains a rare thing — a worked demonstration, in
four numbered cases, of why its default integer percentages let coverage regress silently. The fix it
ships for that, `thresholdPrecision`, does not exist in the Gradle plugin.**

## The four gates

`PitMojo.execute()` runs them in this order, each throwing `MojoFailureException`:

```java
final Optional<CombinedStatistics> result = analyse();
if (result.isPresent()) {
  throwErrorIfTestStrengthBelowThreshold(result.get().getMutationStatistics());
  throwErrorIfScoreBelowThreshold(result.get().getMutationStatistics());
  throwErrorIfMoreThanMaximumSurvivors(result.get().getMutationStatistics());
  throwErrorIfCoverageBelowThreshold(result.get().getCoverageSummary());
}
```

| Parameter | Default | Compares |
|---|---|---|
| `testStrengthThreshold` | `0` (off) | detected / mutants with coverage |
| `mutationThreshold` | `0` (off) | detected / all mutants |
| `maxSurviving` | `-1` (off) | total − detected, as a **count** |
| `coverageThreshold` | `0` (off) | covered lines / all lines |

Two structural facts fall out of that ordering.

**The first failing gate is the only one reported.** Each method throws, so a build that is below both
its mutation threshold and its coverage threshold fails on test strength or mutation score and says
nothing about coverage. Fixing one gate can therefore reveal another, which reads to a team like the
build getting worse.

**Test strength is checked before mutation score.** That is the more forgiving metric first
([04c](04c-the-score-arithmetic.md)), so on an under-covered project the failure you see is usually the
mutation-score one — the harsher number — even though the friendlier gate ran first and passed.

## A threshold of zero is *off*, not *always satisfied*

Every percentage gate is guarded the same way:

```java
BigDecimal threshold = new BigDecimal(this.mutationThreshold);
if (threshold.compareTo(BigDecimal.ZERO) != 0) {
  ...
}
```

and `maxSurviving` the analogous way:

```java
if ((this.maxSurviving >= 0)
    && (result.getTotalSurvivingMutations() > this.maxSurviving)) {
```

So `<mutationThreshold>0</mutationThreshold>` disables the gate, and `<maxSurviving>0</maxSurviving>`
enables the strictest possible one — *zero survivors allowed*. The two parameters read the same and
behave oppositely at the value `0`, which is the kind of asymmetry that survives a code review.

Note also that the three percentage thresholds are declared as `String` on the mojo and parsed into
`BigDecimal`, which is how they accept decimal values when `thresholdPrecision` is set; `maxSurviving`
is a plain `int`.

## 🔴 The integer blind spot, in pitest's own words

The Maven and command-line pages carry an identical section, which is unusual enough to be worth
quoting in full — documentation that argues against its own default:

> *"The coverageThreshold, mutationThreshold, and testStrengthThreshold parameters default to integer
> percentages. This creates a blind spot where coverage can silently regress without triggering a build
> failure."*

with a project of 10,000 lines, 6,147 covered (61.47%) and `coverageThreshold` set to 61:

> *"(i.) Lose 97 covered lines (6,147 -> 6,050): actual = 60.50% -> rounds to 61% -> build PASSES. A
> silent regression of nearly 100 lines."*

> *"(ii.) Add 163 untested lines: actual = 60.50% -> rounds to 61% -> build PASSES. 163 lines with no
> tests, no problem."*

> *"(iii.) Add 164 untested lines: actual = 60.49% -> rounds to 60% -> build FAILS. Just 1 line
> difference from the scenario above."*

> *"(iv.) Add 50 covered lines (6,147 -> 6,197): actual = 61.97% -> rounds to 62% -> jumps a whole
> percent. A single percentage point jump for 50 lines."*

and the conclusion:

> *"With integer thresholds, the blind spot is approximately 1 full percentage point. In a project with
> 10,000 lines, that means up to ~100 lines of coverage can silently drift without the threshold
> noticing."*

Everything in that section applies to `mutationThreshold` and `testStrengthThreshold` exactly as it
applies to `coverageThreshold` — the parameters share the rounding, and cases (i) and (iii) become
"lose 100 killed mutants" and "add 164 mutants nothing kills".

## `thresholdPrecision`, and the second percentage function

> *"thresholdPrecision — Number of decimal places to use when computing and comparing threshold values
> for mutationThreshold, coverageThreshold, and testStrengthThreshold. Defaults to 0 (integer
> percentages, fully backward compatible)."*

> *"With thresholdPrecision=1, the project above would report coverage as 61.4 instead of 61, and a
> threshold of 61.5 would correctly catch a drop to 61.1."*

```xml
<configuration>
  <coverageThreshold>61.5</coverageThreshold>
  <thresholdPrecision>1</thresholdPrecision>
</configuration>
```

Setting it switches every percentage to `PercentageCalculator`'s `BigDecimal` overload, which mirrors
the integer version's three special cases — `total == 0` gives 100, `actual == 0` gives 0,
`total == actual` gives 100 — and then applies its own cap:

```java
BigDecimal cap = new BigDecimal(100)
    .subtract(BigDecimal.ONE.movePointLeft(precision))
    .setScale(precision, RoundingMode.UNNECESSARY);
return result.min(cap);
```

`100 − 10^-precision`: **99.9** at precision 1, **99.99** at precision 2. The rule from
[04c](04c-the-score-arithmetic.md) generalises — the only way to print 100 at any precision is
`total == actual`. The rounding is `RoundingMode.HALF_UP`, explicitly, which is not Java's default
`HALF_EVEN`; anything recomputing pitest's percentages elsewhere has to match it.

⚠️ `thresholdPrecision` also changes the numbers **printed** in the HTML report and the console, because
`MutationTotals`'s `...Label` methods and `MutationStatistics.report` both switch on it. Turning it on to
make a gate finer changes every percentage in the report as a side effect.

## Why `maxSurviving` is the steadiest gate, and its sharp edge

A percentage moves whenever the denominator moves, and the denominator moves for reasons that have
nothing to do with your tests: a pitest upgrade that adds a default operator, a filter behaving
differently, a refactoring that changes how much bytecode exists, an extracted constant that removes an
`INLINE_CONSTS` mutant ([03d2c](03d2c-inline-constants.md)). A **count** moves only when mutants are
added or killed.

That, plus the equivalent-mutant ceiling ([04b2](04b2-the-ceiling-on-the-score.md)), is why
`maxSurviving` set at the current number — so the count can only go down — is the gate that survives
contact with a real project.

🔴 **The sharp edge:** `getTotalSurvivingMutations()` is `getTotalMutations() - getTotalDetectedMutations()`,
with no reference to coverage, and `NO_COVERAGE` carries `detected = false`. So the number the gate
compares against is **survivors plus uncovered mutants**. On a partially covered codebase that is far
larger than the survivor list in the report, and a limit set by counting the red entries on the HTML page
will fail immediately. Set it from the number in the failure message:

```
Had <n> surviving mutants, but only <limit> survivors allowed
```

⚠️ Note also that `maxSurviving` is **not documented** on either quick-start page. It exists on the mojo
with `defaultValue = "-1"` and the property name `maxSurviving`, and the Gradle plugin exposes it as
`Property<Integer> maxSurviving` — but you will not find it in the parameter reference.

⚠️ One more reason to prefer it: the Gradle plugin's three percentage thresholds are `Property<Integer>`
and it has **no `thresholdPrecision` property at all**, so the blind spot below is not fixable from
Gradle and `maxSurviving` is the only gate there that is narrower than a full percentage point
([05b · Gradle](05b-gradle.md)).

## Where this connects

- **[04c · The score arithmetic](04c-the-score-arithmetic.md)** — the three numbers these gates compare, and the integer function's cap at 99.
- **[04b2 · The ceiling on the score](04b2-the-ceiling-on-the-score.md)** — why a percentage gate has to be set with headroom, and pitest's own warning about it.
- **[04 · Reading a report](04-reading-a-report.md)** — the statuses that decide what counts as detected.
- **[05 · Wiring it up](05-wiring-it-up.md)** — where these parameters go in a POM, and `failWhenNoMutations`.
- **[05b · Gradle](05b-gradle.md)** — the integer-only thresholds and the aggregator's own copies.
- **[09 · Thresholds](../09-jacoco/04-thresholds.md)** and **[09 · The ratchet](../09-jacoco/04c-the-ratchet.md)** — the same argument for coverage, including the ratchet pattern `maxSurviving` implements naturally.
- **[06 · The cost](06-the-cost.md)** — whether a gate belongs in the build at all.

## Gotchas

**★ `mutationThreshold` of 0 disables the gate; `maxSurviving` of 0 is the strictest possible gate.**
The percentage gates are guarded by `threshold.compareTo(BigDecimal.ZERO) != 0`, so zero means "not
configured". `maxSurviving` is guarded by `>= 0`, so zero means "no survivors allowed". Two parameters in
the same block, both set to `0`, doing opposite things.

**★ The four gates fire in a fixed order and only the first failure is reported.**
Test strength, then mutation score, then `maxSurviving`, then coverage. Each throws. So fixing the
mutation score can surface a coverage failure that was there all along, which looks to a team like the
build getting worse after an improvement.

**★ The integer thresholds have a one-percentage-point blind spot, and pitest documents it in detail.**
Its own worked example: on 10,000 lines with a threshold of 61, losing 97 covered lines still passes,
and adding 163 untested lines still passes, while adding 164 fails. The documentation's own summary is
that *"up to ~100 lines of coverage can silently drift without the threshold noticing"*. The same applies
to mutation score and test strength.

**★ `thresholdPrecision` changes the printed numbers as well as the comparison.**
`MutationTotals`'s `...Label` methods and `MutationStatistics.report` both switch between the integer and
`BigDecimal` forms on this setting, so turning on precision to make a gate finer also changes every
percentage in the HTML report and the console summary. Two reports produced with different
`thresholdPrecision` values are not comparable at a glance.

**★ The rounding is `HALF_UP`, not Java's default `HALF_EVEN`.**
The `BigDecimal` overload specifies `RoundingMode.HALF_UP` explicitly, and the integer overload uses
`Math.round`, which also rounds halves up. Anything recomputing pitest's percentages elsewhere — a
dashboard, a spreadsheet, a script over the XML — has to match that, or it will disagree with pitest at
the boundary and someone will spend an afternoon on it.

**★ `maxSurviving` counts `NO_COVERAGE` mutants as survivors.**
`getTotalSurvivingMutations()` is total minus detected, and `NO_COVERAGE` is not detected. On a
partially covered project the gate's number is much larger than the survivor list you were reading. Take
the limit from the failure message, not from the report.

**★ `maxSurviving` is undocumented on both quick-start pages.**
It is a real `@Parameter` on `PitMojo` with `defaultValue = "-1"`, and the Gradle plugin exposes it too,
but neither the Maven nor the command-line parameter reference mentions it. If you are arguing for a
count-based gate, cite the source rather than the docs.

**★ `coverageThreshold` gates *line* coverage, measured by pitest, not by JaCoCo.**
It is documented as *"the fraction of the project covered by tests"* and it uses the coverage pitest
gathered in its own pre-pass. That number can differ from your JaCoCo report — different scope, different
filters, different exclusions — so a build with a JaCoCo gate at 80% and a pitest `coverageThreshold` at
80% has two gates on two measurements of the same idea ([09 · Thresholds](../09-jacoco/04-thresholds.md)).

## Interview questions

**★ What can a pitest build fail on, and in what order?**
Four independent gates, checked in this order by the Maven mojo: `testStrengthThreshold`,
`mutationThreshold`, `maxSurviving`, then `coverageThreshold`. Each throws a `MojoFailureException`, so
only the first failure is reported and the others are invisible until it is fixed. Three of them are
percentages with a default of `0` that means *disabled*; the fourth is a count with a default of `-1`
that means disabled, so `maxSurviving = 0` is the strictest gate in the tool while `mutationThreshold =
0` is no gate at all. Separately, `failWhenNoMutations` defaults to true, so an empty or badly-filtered
scope fails the build before any of the four are reached.

**★ Would you gate a build on a mutation score percentage?**
Reluctantly, and with headroom, and probably not as the primary gate. Percentages move when the
denominator moves, and the denominator moves for reasons unrelated to the tests: a pitest upgrade that
adds a default operator, a filter behaving differently, a refactoring that changes how much bytecode
exists. On top of that, the integer thresholds have a documented blind spot of roughly one percentage
point — pitest's own docs work through a case where losing 97 covered lines still passes — and
equivalent mutants put an uncomputable ceiling below 100. I would use `maxSurviving`, set at the current
count so it can only ratchet down, and treat the percentage as a number a person reads. If a percentage
gate is required, I would set `thresholdPrecision` to at least 1 so the gate is a tenth of a point wide
rather than a full point — and note that Gradle cannot do that at all.

**★ Explain pitest's "integer threshold blind spot" to someone who thinks a threshold of 61 means 61%.**
It means "the rounded integer must be at least 61", and rounding is `HALF_UP`, so anything from 60.50%
upwards satisfies it. Pitest's documentation works the example: on a 10,000-line project at 61.47%, you
can lose 97 covered lines and still pass, or add 163 untested lines and still pass — but adding 164
fails, one line later. So the gate has a dead zone about a percentage point wide in which quality can
drift with no signal, and the failure, when it comes, looks arbitrary because a single line flipped it.
`thresholdPrecision` narrows the dead zone to `10^-precision`; using a count-based gate removes it.

**★ You set `maxSurviving` to the number of survivors in the HTML report and the build fails immediately. Why?**
Because `maxSurviving` does not count survivors as the report displays them. It compares against
`getTotalSurvivingMutations()`, which is total mutants minus detected mutants, and `NO_COVERAGE` mutants
are not detected — so they are counted as survivors by the gate and shown as a separate category in the
report. On a partially covered project the gate's number can be several times the survivor list. The fix
is to take the limit from the failure message, which prints the actual figure, and then to decide whether
you want a gate whose number includes uncovered code at all — if not, the honest instrument is
`testStrengthThreshold`, whose denominator excludes uncovered mutants.

**★ A team gates on `mutationThreshold` and their build starts failing after a dependency upgrade with no code change. What are the candidates?**
Anything that moved the denominator. A pitest engine upgrade can add or change default operators, or
change filter behaviour so mutants that used to be filtered are now generated. A compiler or Lombok
upgrade changes what bytecode exists to mutate. A new pitest plugin on the classpath registers additional
operators and, if the build uses `ALL`, silently expands it. A JUnit or Spring upgrade can change which
tests pitest can run at all, turning killed mutants into no-coverage ones. And on a shared CI agent, a
slower machine produces more timeouts, which counts as *detected* and would push the score the other way
— so if the score fell, that is not it. The first thing to compare is the *Active mutators* list and the
per-status counts from the two runs, not the percentages.

{/* FOOTER */}
