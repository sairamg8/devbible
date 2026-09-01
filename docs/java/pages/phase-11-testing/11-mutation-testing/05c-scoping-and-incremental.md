---
title: "Making a mutation run finish has two instruments and neither is a diff: class-name globs, which cut the mutation phase and not the coverage pass, and an experimental history file whose five documented optimisations pitest itself says introduce error into the analysis — while the git-aware scoping everyone actually wants is a commercial plugin"
sidebar_label: "05c · Scoping and history"
sidebar_position: 35
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-09-01 against pitest's
> [Incremental analysis](https://pitest.org/quickstart/incremental_analysis/) page — all five
> optimisations, the dependency caveat and the `withHistory` warning, quoted verbatim — the
> [Maven quick start](https://pitest.org/quickstart/maven/) entries for `targetClasses`, `targetTests`,
> `excludedClasses`, `excludedTestClasses`, `excludedMethods`, `historyInputFile`, `historyOutputFile`,
> `withHistory`, `extraFeatures` and the globs section; the
> [command line quick start](https://pitest.org/quickstart/commandline/) for
> `--historyInputLocation`/`--historyOutputLocation` and `--mutableCodePaths`; and the
> [FAQ](https://pitest.org/faq/) entry *"PIT is taking forever to run"*. Gradle equivalents from
> `PitestPluginExtension.groovy` on the gradle-pitest-plugin `master` branch.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0, JUnit Jupiter 6.0.3,
> Testcontainers 2.0.5.
> ⚠️ **No sandbox and no build on this machine.** Behaviour is read from pitest's documentation and the
> plugins' source. **No timing, speed-up figure or run outcome on this page came from executing
> anything.**

**A full mutation run on a repository is not something most teams can put in a build, and pitest's own
FAQ says as much: *"The most effective way to use mutation testing is usually to limit analysis to the
code that you are changing."* The open-source tool gives you two instruments for that and neither is what
that sentence implies. Globs narrow *which classes are mutated* and do almost nothing for the coverage
pass in front of it. The history file skips analysis it can infer, and pitest's own page says four of its
five optimisations *"introduce a degree of potential error into the analysis"*. The git-aware scoping the
FAQ sentence is really describing is arcmutate's, and it costs money.**

## The scoping parameters, and which phase each one cuts

| Parameter | Cuts | Effect |
|---|---|---|
| `targetClasses` | mutation phase | Which classes are mutated |
| `excludedClasses` | mutation phase | Classes never mutated |
| `excludedMethods` | mutation phase | Methods never mutated, by glob |
| `targetTests` | coverage + mutation | Which tests are available at all |
| `excludedTestClasses` | coverage + mutation | Tests not run — *and* coverage removed |
| `mutableCodePaths` | mutation phase | Which classpath entries count as mutable code |

🔴 **The distinction in the middle column is the one that matters, and it is the reason "I scoped it to
one package and it is still slow" is such a common complaint.** Pitest runs a full per-test line-coverage
pass before generating any mutants ([02](02-how-it-works.md)), and `targetClasses` does not touch it. A
narrow `targetClasses` makes the mutation phase cheap and leaves the prologue exactly as expensive as it
was — which on a suite with Testcontainers and `@SpringBootTest` classes is most of the wall-clock time
([07 · Testcontainers](../07-testcontainers/README.md),
[05 · The test pyramid](../05-the-test-pyramid/README.md)).

To cut the prologue you have to cut *tests*, with `targetTests` or `excludedTestClasses`:

```xml
<configuration>
  <targetClasses>
    <param>com.example.orders.domain.*</param>
  </targetClasses>
  <targetTests>
    <param>com.example.orders.domain.*Test</param>
  </targetTests>
  <excludedTestClasses>
    <param>*IT</param>
    <param>*IntegrationTest</param>
  </excludedTestClasses>
</configuration>
```

⚠️ **And that is not free.** Every excluded test removes coverage, so mutants that only it covered become
`NO_COVERAGE` — not detected — and the mutation score falls ([04c](04c-the-score-arithmetic.md)). That is
the honest trade and it is worth stating in the same breath as the speed-up: **excluding slow tests makes
the run finish and makes the number lower and more truthful**, because what remains is what your fast
tests actually verify.

Two documented traps in the exclusion parameters:

> *"List of globs to match against test class names. Matching tests will not be run (note if a suite
> includes an excluded class, then it will "leak" back in)."*

so a `@Suite`, a `ClassPathSuite` or a `@SelectPackages` aggregator re-introduces tests you excluded by
name. And the glob rule from [05a](05a-before-the-first-run.md): an exact class name does not match inner
classes, so `com.example.PricingService` misses its lambdas while `com.example.PricingService*` does not.

The FAQ adds one more cause of a slow run that is nobody's fault but yours:

> *"One thing to watch out for that can slow PIT down are tests on the classpath that are not normally
> run. Some teams have very slow exhaustive tests or performance tests that are not run by their build
> scripts. As PIT examines the entire classpath it will try to run these so may not even start running
> mutations for several hours."*

The other instrument — the history file, whose five documented optimisations pitest itself says
introduce error into the analysis, and the git-aware scoping that is not in the open-source tool at all —
is [05c2](05c2-incremental-analysis.md).

## The order to try things

From the FAQ's *"PIT is taking forever to run"*, plus what the rest of this topic has established:

1. **Narrow `targetClasses`** to the code where a survivor would actually matter. Cheapest change, biggest
   change in signal-to-noise, and it costs you nothing true.
2. **Exclude the slow tests** with `excludedTestClasses`. This is the one that cuts the coverage pass. Accept
   that the score falls.
3. **Raise `threads`.** *"Using more threads. The optimum number will vary, but will generally be between
   1 and the number of CPUs on your machine."* There is also a `+auto_threads` feature that sets it from
   the core count ([02b3](02b3-the-filter-inventory.md)).
4. **Add a history file** ([05c2](05c2-incremental-analysis.md)), as a cached artefact, once you have
   accepted that some statuses will be inferred.
5. **Cap mutants per class** with `+CLASSLIMIT(limit[42])` — the FAQ's *"Limit the number of mutations per
   class. This will give you a less complete picture however."*
6. **Write unit tests for the class**, if its only coverage is slow integration tests. This is the real
   fix and the slowest to apply ([05 · The test pyramid](../05-the-test-pyramid/README.md)).

## Where this connects

- **[05 · Wiring it up](05-wiring-it-up.md)** — the POM these parameters go in, and the glob rules.
- **[05a · Before the first run](05a-before-the-first-run.md)** — `failWhenNoMutations`, which is what stops an over-aggressive glob reporting a fake 100%.
- **[05b2 · Gradle isolation](05b2-gradle-isolation-and-gaps.md)** — `enableDefaultIncrementalAnalysis` and the `withHistory` alias.
- **[02 · How it works](02-how-it-works.md)** — the coverage pass that globs do not cut.
- **[04 · Reading a report](04-reading-a-report.md)** — a status carried forward from a previous run looks exactly like one measured today.
- **[04c2 · Thresholds and gates](04c2-thresholds-and-gates.md)** — why gating on a partly-inferred report is a bad idea.
- **[06 · The cost](06-the-cost.md)** — the arithmetic behind all of this, and the honest verdict on when to pay it.
- **[01b · The tool and its versions](01b-the-tool-and-its-versions.md)** — arcmutate, and which "pitest features" are commercial.

## Gotchas

**★ `targetClasses` does not make the coverage pass any faster.**
Pitest runs a full per-test line-coverage analysis before it generates a single mutant, and that pass is
scoped by which *tests* run, not by which classes are mutated. Narrowing `targetClasses` to one package
makes the mutation phase cheap and leaves the prologue untouched — which on a suite with container-backed
and `@SpringBootTest` classes is most of the wall-clock time.

**★ Excluding slow tests lowers your mutation score, and that is correct.**
Dropping `*IntegrationTest` removes the coverage those tests provided, so mutants they covered become
`NO_COVERAGE`, which is not detected. The number falls — to something closer to "what my fast tests
actually verify", which is the number you wanted. Treating the drop as a regression is the mistake.

**★ `excludedTestClasses` leaks if a suite class references the excluded test.**
Pitest's documentation is explicit: *"note if a suite includes an excluded class, then it will 'leak' back
in"*. A `@Suite`, a `ClassPathSuite` or a `@SelectPackages` aggregator re-introduces tests you excluded by
name, and the exclusion appears simply not to have worked.

**★ Tests that your build never runs are still on the classpath, and pitest will run them.**
The FAQ warns that exhaustive or performance tests excluded from the build scripts *"may not even start
running mutations for several hours"*, because pitest examines the whole classpath. `excludedClasses` —
or, since 1.3.0, `excludedTestClasses` — is the documented remedy, and this is worth checking first on any
project where the run seems not to start.

**★ Capping mutants per class buys speed by making the report incomplete on purpose.**
The FAQ is candid: *"Limit the number of mutations per class. This will give you a less complete picture
however."* `+CLASSLIMIT(limit[42])` truncates rather than samples, so what you lose is not random. It is a
reasonable emergency measure and a bad steady state.

## Interview questions

**★ Your mutation run takes four hours. What do you change first, and why not the history file?**
`targetClasses`, narrowed to the code where a survivor would actually matter — a pricing engine, not a
package of `record`s. It is the cheapest change and it costs nothing true, because a mutation score
averaged over trivial classes was never carrying information anyway. Then `excludedTestClasses` for the
integration tests, which is the change that actually cuts the coverage pass — and I would say out loud
that the score will fall, because excluded tests take their coverage with them and the mutants they
covered become `NO_COVERAGE`. The history file comes later because it trades correctness for speed:
pitest's own documentation says four of its five optimisations *"introduce a degree of potential error
into the analysis"*, so it is the right tool for a fast local loop and the wrong one for the number you
report.

**★ You scope pitest to one package and the run is barely faster. Explain.**
Because `targetClasses` only cuts the mutation phase. Pitest gathers per-test line coverage in a full run
of the suite before it generates any mutants, and that pass is scoped by which tests execute, not by
which classes are mutated. If the suite's cost is a dozen `@SpringBootTest` classes and a Testcontainers
PostgreSQL, narrowing the mutated classes leaves all of that in place. The parameters that cut the
prologue are `targetTests` and `excludedTestClasses` — and they have a real cost, since removing a test
removes its coverage and turns the mutants it covered into no-coverage results.

**★ Pitest seems to hang for hours before it reports any mutations. What is happening?**
Almost certainly the coverage pass, running tests your build never runs. The FAQ names this directly:
pitest examines the entire classpath, so exhaustive suites or performance tests that your build scripts
exclude are picked up and executed, and *"may not even start running mutations for several hours"*. The
documented remedy is to exclude them by name. It is worth checking before anything else, because the
symptom — no output for a long time — reads as pitest being slow at mutation testing when in fact it has
not started mutation testing yet, and because the diagnosis is one `-Dpit.dryRun=true` run away
([05a](05a-before-the-first-run.md)).

{/* FOOTER */}
