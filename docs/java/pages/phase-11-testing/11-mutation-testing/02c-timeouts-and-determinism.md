---
title: "PIT is deterministic except in two places, and both of them feed the numerator: a timeout is decided by comparing wall-clock times on whatever machine happened to run it, and TIMED_OUT counts as detected — so a loaded CI agent reports a better mutation score than a quiet laptop, from the same commit"
sidebar_label: "02c · Timeouts and determinism"
sidebar_position: 7
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-08-31 against pitest's [FAQ](https://pitest.org/faq/) (sections *"I'm seeing a lot
> of timeouts, what's going on?"* and *"Is it random?"*), the
> [Maven quick start](https://pitest.org/quickstart/maven/) entries for `timeoutFactor` and
> `timeoutConstant`, and pitest 1.30.0 source: `org.pitest.mutationtest.DetectionStatus`
> (`TIMED_OUT(true)`) and its `getForErrorExitCode`. Release history from the
> [GitHub releases](https://github.com/hcoles/pitest/releases) — 1.25.5 *"Single threaded mutant
> timeout detection"*.
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1, Spring Framework
> 7.0.8, JUnit Jupiter 6.0.3, Testcontainers 2.0.5.
> ⚠️ **No sandbox, no build and no timings on this machine.** The formula and the defaults are
> quoted from pitest's documentation; no measured duration on this page came from a run.

**Everybody assumes a mutation score is reproducible, because everything about the technique looks
deterministic: the same mutators produce the same mutants and the same tests either fail or do not.
Pitest's FAQ answers "Is it random?" with a flat "No." and then names two exceptions, and the more
important of the two is timeouts. A timeout is not a property of the mutant; it is a comparison
between two wall-clock measurements taken minutes apart on a shared machine. And `TIMED_OUT` is
classified as *detected*, so every spurious timeout raises the score. This chunk is about the
formula, why it misfires most on exactly the stack this phase targets, and what to do about it.**

## Determinism, and the two things that break it

The FAQ answers "Is it random?" with a flat **"No."**, then qualifies it:

> *"Given the same input Pitest will always generate the same mutants, and (with a couple of
> caveats) will always produce the same results. Pitest works hard to be fully deterministic, but
> two factors might cause the results to differ slightly between two runs with the same input."*

The two are **timeouts** — which are decided by comparing wall-clock times and are therefore
sensitive to load on the machine — and **static initializers**, whose behaviour depends on which
test first caused a class to load, and which in some circumstances force a fresh JVM.

That matters for CI: mutation score is *almost* reproducible, and the part that is not is
concentrated in a status (`TIMED_OUT`) that counts as detected. A threshold set one point below a
locally observed score can fail on a loaded build agent for reasons that have nothing to do with
your tests.

## Timeouts: the formula, and why it misfires

PIT's infinite-loop detection is a comparison against the test's unmutated runtime. From the FAQ:

> *"In order to detect infinite loops PIT measures the normal execution time of each test without
> any mutations present. When the test is run in the presence of a mutation PIT checks that the
> test doesn't run for any longer than normal time * x + y"*

`x` is the `timeoutFactor` (default **1.25**) and `y` is `timeoutConstant` (default **4000** ms).
The FAQ is candid about why the model is wrong:

> *"Test times can vary due to the order in which the tests are run. The first test in a class may
> have an execution time much higher than the others as the JVM will need to load the classes
> required for that test. […] When PIT runs the tests against a mutation the order of the tests
> will be different. Tests that previously took milliseconds may now take seconds as they now carry
> the overhead of classloading. PIT may therefore incorrectly flag the mutation as causing an
> infinite loop."*

The documented remedy is to raise `y`:

```xml
<configuration>
    <timeoutConstant>15000</timeoutConstant>
</configuration>
```

This is a much bigger deal on a Spring codebase than the FAQ's JAXB example suggests, because the
first test to touch a slice pays for a whole application context.

## Why the Spring stack makes this worse

The FAQ's mechanism is *class-loading cost moves between tests when the order changes*. On the
stack this phase targets, "class-loading cost" understates it by an order of magnitude:

- **The first test in a `@SpringBootTest` or `@WebMvcTest` class builds an application context**,
  or takes one from the context cache if a compatible one exists.
  [05 · The test pyramid](../05-the-test-pyramid/README.md) is entirely about that cost.
- **Pitest runs a different subset of tests, in a different order, for every mutant.** The cache
  hit/miss pattern is therefore different from a normal `mvn test` run, and different again between
  two mutants.
- **A Testcontainers-backed test may start a container.** [07 · Testcontainers](../07-testcontainers/README.md)'s
  singleton pattern exists to stop that happening per class; whether it holds inside pitest's
  minions depends on how the container is held.

So the "normal time" pitest measured for a slice test in the coverage pass may be the cached-context
time, while the mutated run pays for a fresh context — a difference that dwarfs `1.25x + 4s`. The
result is a run where slice tests generate timeouts en masse and the mutation score is inflated by
mutants nobody detected.

The structural fix is not a bigger `timeoutConstant`. It is **not pointing pitest at slice tests at
all**:

```xml
<configuration>
  <targetClasses>
    <param>com.example.pricing.*</param>
  </targetClasses>
  <excludedTestClasses>
    <param>*IT</param>
    <param>*IntegrationTest</param>
    <param>com.example.*.web.*Test</param>
  </excludedTestClasses>
  <timeoutConstant>15000</timeoutConstant>
</configuration>
```

⚠️ Be careful with `excludedTestClasses`, because the documentation adds a caveat:

> *"List of globs to match against test class names. Matching tests will not be run (note if a
> suite includes an excluded class, then it will 'leak' back in)."*

And excluding a test does not just save time — it removes coverage. Any mutant that only that test
covered becomes `NO_COVERAGE`, which does **not** count as detected, so the score falls. That is
the honest trade: excluding slow tests makes the run finish and makes the number lower and more
truthful.

## `TIMED_OUT` counts as detected

This is the fact that turns a performance annoyance into a measurement problem. From
`DetectionStatus` in pitest's source, the constructor argument is the `detected` flag:

```java
TIMED_OUT(true),
```

with the javadoc:

> *"A test took a long time to run when mutation was present, might indicate an that the mutation
> caused an infinite loop but we don't know for sure."*

*"we don't know for sure"* — and it is counted as a kill anyway. The reasoning is defensible: an
infinite loop caused by a mutant is a behaviour change the suite arguably did notice, in that it
stopped. But it means the least reliable status in the run feeds directly into the numerator of
your mutation score. [04 · Reading a report](04-reading-a-report.md) works through the full
classification.

## The one legitimate timeout

There is a real case, and pitest's own docs use it as the example:

> *"A mutation may time out if it causes an infinite loop, such as removing the increment from a
> counter in a for loop."*

```java
for (int i = 0; i < lines.size(); i++) {
    total = total.add(lines.get(i).amount());
}
```

The `INCREMENTS` mutator turns `i++` into `i--`, and the loop never terminates. There is no
assertion you can write that "kills" this in the ordinary sense — the test never returns — so
`TIMED_OUT` is the only sensible outcome, and calling it detected is right.

Pitest tries to avoid generating these in the first place. Three default-on filters exist for it:
`FINFINC` (*"Filters mutations to increments that may cause infinite loops"*), `FFLOOP` and
`FINFIT`. So on idiomatic loop code most of these mutants never reach a minion, and a run producing
many timeouts is usually producing *spurious* ones —
[02b3 · The filter inventory](02b3-the-filter-inventory.md).

## Detection is single-threaded since 1.25.5

Release 1.25.5 (2026-06-17) lists:

> *"#1479 Single threaded mutant timeout detection (fixes #1478)"*

That is a change in how the timeout is detected, not in the formula. I could not find documentation
explaining the failure it fixes, so I will not guess at it — the actionable point is that if you
are seeing unexplained timeouts on a pitest older than 1.25.5, upgrading is worth trying before
tuning constants. Note in particular that `gradle-pitest-plugin` 1.19.0 defaults to PIT **1.22.1**,
which predates this fix ([01b](01b-the-tool-and-its-versions.md)).

## Where this connects

- **[02 · How it works](02-how-it-works.md)** — the four design decisions, of which "insert mutants
  into a warm JVM" is the one that makes timing comparisons fragile.
- **[04 · Reading a report](04-reading-a-report.md)** — what each status counts as, and why the
  per-status counts matter more than the percentage.
- **[05 · The test pyramid](../05-the-test-pyramid/README.md)** — the context cache and slice cost
  that make the timeout formula misfire.
- **[08 · Test data patterns](../08-test-data-patterns/05b2-finding-order-dependence.md)** — pitest
  runs your tests in orders your build never uses, so it finds order dependence as a side effect.

## Gotchas

**★ Timeouts are decided by wall-clock time on the machine that ran them, so CI can invent them.**
A shared build agent under load stretches a mutated test past `normal * 1.25 + 4000ms` and pitest
records `TIMED_OUT`. Because that status counts as *detected*, the score goes **up**, and it goes
up more on the busiest agents. If your mutation score is quietly higher in CI than locally, look at
the timeout count before you celebrate.

**★ Pitest is deterministic except where it is not, and the exception is in the numerator.**
Two runs on the same commit can differ, because timeouts are timing-dependent and static
initializer behaviour depends on class-load order. `TIMED_OUT` counts as detected. So the
non-deterministic part of the run feeds directly into the score you might be gating on.

**★ Spring's context cache makes "normal time" unrepresentative for slice tests.**
The coverage pass measures a test that may have hit a warm context; the mutated run may build a
fresh one because pitest selected a different subset of tests. That is not a `1.25x` difference,
it is a several-second one, and `timeoutConstant` at its 4000 ms default does not absorb it. The
symptom is a wave of timeouts concentrated in classes covered by slice tests.

**★ Raising `timeoutConstant` fixes the false positives and makes real infinite loops expensive.**
Every genuinely hanging mutant now burns the full new constant before being recorded. With
`timeoutConstant` at 30000 and a handful of loop mutants that the `FINFINC` filter did not catch,
you have added minutes to the run. Raise it to what the slowest legitimate test needs, not to a
number that makes the problem go away.

**★ Excluding slow tests lowers your mutation score, and that is correct.**
Dropping `*IntegrationTest` removes the coverage those tests provided, so mutants they covered
become `NO_COVERAGE` — which is *not* detected. The number falls. It falls to something closer to
"what my fast tests actually verify", which is the number you wanted; treating the drop as a
regression is the mistake.

**★ `excludedTestClasses` leaks if a suite class references the excluded test.**
Pitest's documentation is explicit: *"note if a suite includes an excluded class, then it will
'leak' back in"*. A `@Suite` class, a `ClassPathSuite`, or a `@SelectPackages` aggregator will
re-introduce tests you excluded by name, and the exclusion appears not to have worked.

**★ A run with many timeouts and a good score is a run you should not report.**
The two facts are causally linked, not coincidental. Before quoting a mutation score, look at the
`TIMED_OUT` count relative to `KILLED`. If timeouts are a meaningful fraction, the score is
measuring your build agent's load, and the honest move is to fix the timeouts and re-run.

**★ Pitest exercises your suite in orders your build never uses, so it surfaces order dependence.**
For every mutant it runs a different subset of tests, fastest first, in a fresh minion. A test that
passes only because another test ran first will fail in some of those subsets — and pitest will
record that as a kill, crediting a test with detecting a mutant it never saw. Order-dependent
suites do not just fail under pitest; they lie under it.
[08 · Finding order dependence](../08-test-data-patterns/05b2-finding-order-dependence.md) is the
fix.

## Interview questions

**★ Where do PIT's timeouts come from, and are they findings?**
From a heuristic: a test is considered stuck if it runs longer than `normal time * timeoutFactor +
timeoutConstant`, with defaults 1.25 and 4000 ms, measured against the unmutated run. Sometimes
that is a genuine finding — the classic is a mutant that removes the increment from a loop
counter, which really does hang. Often it is not, because pitest runs the tests in a different
order under mutation and the class-loading cost lands on a different test. Since `TIMED_OUT` counts
as detected, a run full of spurious timeouts reports a better score than the suite deserves, and
the documented remedy is to raise `timeoutConstant`.

**★ Your team's mutation score is 4 points higher in CI than on any developer machine. Explain.**
Almost certainly timeouts. CI agents are shared and slower, mutated tests exceed the timeout
threshold more often, and `TIMED_OUT` is classified as detected by `DetectionStatus`, so it lands
in the numerator. A secondary candidate is a different mutant set — a different pitest version, a
different `mutators` configuration, or filters behaving differently because the CI build compiles
with different debug or `-parameters` settings. Compare the per-status counts, not the percentage.

**★ Is a mutation score reproducible enough to gate a build on?**
Nearly. Pitest's FAQ says it works hard to be fully deterministic and names two exceptions:
timeouts, which depend on wall-clock measurements and therefore on machine load, and static
initializers, whose behaviour depends on class-load order and can force a fresh JVM. Both
exceptions land in the detected column, so the variation is one-directional — the score drifts
upward under load. In practice that means a threshold works if it is set with headroom and if the
timeout count is small, and that a `maxSurviving` limit is a steadier gate than a percentage
because it counts things rather than dividing them.

**★ Why does mutation testing find order-dependent tests?**
Because it runs your tests in orders your build never produces. For each mutant it selects only the
covering tests and runs them fastest-first in a forked minion, so a test that quietly depends on a
row inserted by an earlier test, or on static state left behind, will run in isolation and behave
differently. The insidious part is that the failure is recorded as a kill rather than reported as a
broken test, so an order-dependent suite silently inflates the mutation score instead of announcing
the problem. A deterministic, isolated suite is a prerequisite for the technique, not a nicety.

**★ You inherit a pitest configuration with `timeoutConstant` set to 60000. What does that tell you?**
That someone met a wall of spurious timeouts and turned the dial rather than diagnosing them. It is
a legitimate documented remedy, but at 60 seconds every genuine infinite-loop mutant that the
`FINFINC`/`FFLOOP` filters missed costs a full minute, so the run is probably far slower than it
needs to be. The questions to ask are which tests were timing out — almost always Spring slices or
container-backed tests whose "normal time" was measured against a warm context — and whether those
tests should be in pitest's scope at all.

{/* FOOTER */}
