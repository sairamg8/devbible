---
title: "Scoping a mutation run is two separate decisions that look like one: targetClasses narrows what is mutated and does nothing at all for the full per-test coverage pass in front of it, and only excluding tests cuts that — which buys the run time back by removing coverage, so the score falls, and the lower number is the more truthful one"
sidebar_label: "05c · Scoping and history"
sidebar_position: 35
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-09-01 against the pitest
> [Maven quick start](https://pitest.org/quickstart/maven/) entries for `targetClasses`, `targetTests`,
> `excludedClasses`, `excludedTestClasses`, `excludedMethods`, `threads`, `maxMutationsPerClass` and the
> globs section, quoted verbatim; the
> [command line quick start](https://pitest.org/quickstart/commandline/) for `--mutableCodePaths` and
> `--dependencyDistance`; the [FAQ](https://pitest.org/faq/) entry *"PIT is taking forever to run"*; and
> the `+auto_threads` and `+CLASSLIMIT` feature strings from pitest 1.30.0's feature declarations.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0, JUnit Jupiter 6.0.3,
> Testcontainers 2.0.5.
> ⚠️ **No sandbox and no build on this machine.** Behaviour is read from pitest's documentation and the
> plugins' source. **No timing, speed-up figure or run outcome on this page came from executing
> anything.**

**A full mutation run on a repository is not something most teams can put in a build, and pitest's own
FAQ says as much: *"The most effective way to use mutation testing is usually to limit analysis to the
code that you are changing."* The open-source tool gives you two instruments for that and neither is what
that sentence implies. This chunk is the first of them — the globs — and the fact that decides whether
they help: **a glob over classes cuts the mutation phase and leaves the full per-test coverage pass in
front of it exactly as expensive as it was.** Cutting that pass means cutting tests, which means removing
coverage, which means the score falls. That trade is the whole subject.**

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

## The two narrower instruments, and one that is gone

**`excludedMethods`** is a glob over method names — *"Methods matching the globs will be excluded from
mutation"* — and it is the right tool for a category rather than a class. `toString`, `hashCode` and
`equals` are the usual candidates: they generate mutants that a value-object test suite kills by accident
or leaves alive forever, and neither outcome is informative. The command-line documentation's own example
is `--excludedMethods hashCode,equals`.

**`mutableCodePaths`** decides which classpath entries count as production code:

> *"List of classpaths which should be considered to contain mutable code. If your build maintains
> separate output directories for tests and production classes this parameter should be set to your code
> output directory in order to avoid mutating test helper classes etc."*

with the default — *"anything not defined within a jar or zip file"* — and the reassurance that
*"PIT will always attempt not to mutate test classes even if they are defined on a mutable path."* On a
standard Maven or Gradle layout you never touch this; on a build with generated sources, an in-project
test-support module or an unusual output layout, it is what stops pitest mutating your builders.

⚠️ **`maxDependencyDistance` no longer exists.** Both quick-start pages still document it at length —
filtering tests by how far they are from the mutated class — with a one-line note at the top:
*"Removed in 1.9.0"*. A configuration inherited from an older project may still set it; on 1.30.0 that
parameter does nothing.

## Threads, and the cap of last resort

The FAQ's list for *"PIT is taking forever to run"* names threads first among the things you control:

> *"Using more threads. The optimum number will vary, but will generally be between 1 and the number of
> CPUs on your machine."*

`threads` defaults to 1 — *"By default a single thread will be used"* — which is a conservative default
on any modern machine. There is also a feature that sets it for you, `+auto_threads`, which the Maven
docs describe as enabling *"the automatic setting of the number of threads based on the number of cores
reported by the current machine"* ([02b3](02b3-the-filter-inventory.md)).

⚠️ Threads multiply minions, and minions are JVMs. On a Spring codebase where each minion may build an
application context, raising `threads` to the core count can trade a long run for an out-of-memory one
([04d](04d-the-statuses-that-are-not-findings.md)).

The last resort is to make the analysis deliberately incomplete:

> *"Limit the number of mutations per class. This will give you a less complete picture however."*

which since 1.2.3 is the `CLASSLIMIT` feature rather than a parameter — `+CLASSLIMIT(limit[42])`. It
truncates rather than samples, so what you lose is not random: it is whatever came last in the class.
Reasonable as an emergency measure on one enormous generated class, bad as a steady state.

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

**★ `threads` defaults to 1, and raising it can turn a slow run into an out-of-memory one.**
*"By default a single thread will be used."* Raising it is the FAQ's first suggestion and usually the
right one — `+auto_threads` will set it from the core count — but each thread means another forked JVM,
and on a codebase where minions build Spring application contexts the memory cost multiplies with them.
A wave of `MEMORY_ERROR`, which counts as detected, is the signature.

**★ `maxDependencyDistance` is documented at length and was removed in 1.9.0.**
Both quick-start pages still describe the distance filter in full, with *"Removed in 1.9.0"* as a one-line
note above it. An inherited configuration that sets it is configuring nothing on 1.30.0 — and the run is
slower than whoever wrote that line expected, for a reason not visible in the build file.

**★ `excludedMethods` is the right instrument for `equals`, `hashCode` and `toString`.**
Those methods generate mutants that a value-object suite either kills by accident or leaves alive
permanently, and neither outcome carries information — pitest even ships `FSEQUIVEQUALS` to filter the
`equals` identity shortcut ([04b](04b-equivalent-mutants.md)). Excluding them by method glob is more
precise than excluding whole classes, which is what people reach for instead.

**★ Pitest tries not to mutate test classes, but `mutableCodePaths` is what makes that reliable.**
The documentation says *"PIT will always attempt not to mutate test classes even if they are defined on a
mutable path"*, and the default treats anything not in a jar or zip as mutable. On a build with generated
sources or an in-project test-support module, that default can put your builders and object mothers in
scope — which produces survivors in code whose behaviour no test should be asserting on.

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

**★ Your report is full of survivors in `equals`, `hashCode` and `toString`. What is the right response?**
`excludedMethods`, with those three names — the command-line docs use `--excludedMethods hashCode,equals`
as their own example. The reason it is the right instrument rather than excluding the classes is
precision: a value object's `equals` generates mutants that either die by accident to any test that
compares two instances, or survive forever because nobody asserts on `toString`'s exact output, and
neither outcome tells you anything about the tests. Pitest already ships one filter for a slice of this —
`FSEQUIVEQUALS` removes the mutant on the `if (this == other) return true` identity shortcut, because it
only affects performance — which is a signal that the maintainer considers this category noise too.
Excluding whole value-object classes instead would also remove the mutants on their real logic, which is
often where the interesting behaviour is.

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

**★ Is there a configuration that makes a mutation run fast without making it less honest?**
Only one, and it is not a pitest setting: narrowing `targetClasses` to the code where a survivor would
actually matter. That costs nothing true, because a score averaged over `record`s, DTOs and mappers was
diluting the only part of the number carrying information anyway. Everything else on the list trades
something real. Excluding tests removes coverage, so mutants become `NO_COVERAGE` and the score falls —
truthfully, but it falls. Raising threads spends memory and can convert a slow run into a wave of
`MEMORY_ERROR`, which counts as detected and therefore *raises* the score while measuring less. A history
file substitutes inference for measurement. `CLASSLIMIT` truncates the report on purpose. And the real
fix — writing unit tests for a class whose only coverage is a slow integration test — makes the run
faster *and* the measurement better, which is why it is last on the list of things to configure and first
on the list of things to do.

{/* FOOTER */}
