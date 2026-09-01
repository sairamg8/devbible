---
title: "Three preconditions decide whether a pitest run means anything — a green suite, line-number debug information, and something actually in scope — and two switches exist to prove all three before you read a report: dryRun generates every mutant without running one, and verbose prints the only authoritative list of what will actually be applied"
sidebar_label: "05a · Before the first run"
sidebar_position: 31
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-09-01 against the pitest
> [Maven quick start](https://pitest.org/quickstart/maven/) entries for `dryRun`, `verbose`, `features`,
> `failWhenNoMutations`, `skip` and the globs section, quoted verbatim; the
> [Basic concepts](https://pitest.org/quickstart/basic_concepts/) debug-information requirement; the
> [FAQ](https://pitest.org/faq/) entries *"PIT found no classes to mutate / no tests to run"* and
> *"My tests normally run green but PIT says the suite isn't green"*; and pitest 1.30.0 source read at
> the `1.30.0` tag: `org.pitest.help.Help`, `pitest-maven/.../PitMojo.java` (`skip` with property
> `skipPitest`, `skipTests`, `shouldRun()`, `execute()`'s plugin and mutator logging) and
> `org/pitest/util/PercentageCalculator.java`.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0, Spring Framework
> 7.0.8, JUnit Jupiter 6.0.3.
> ⚠️ **No sandbox and no build on this machine.** Behaviour is read from published source and
> documentation. **No console output, count or score on this page came from a run.**

**[05](05-wiring-it-up.md) is the POM. This chunk is everything between "the plugin is declared" and
"the report means something", and it is where most first attempts at mutation testing are lost. Three
preconditions have to hold before a single number is interpretable, and two of them fail in ways that
look like findings rather than like configuration. Pitest ships two switches specifically for proving
the wiring before you read anything, and almost nobody uses them first.**

## Prove the wiring before you trust a number

**`dryRun`**, added in 1.17.3, does the whole pipeline except the part that takes the time:

> *"Introduced in 1.17.3, dry run mode configures pitest to gather coverage for all tests, and generate
> all mutants, without running any tests against the mutants. This mode can be useful when first setting
> up pitest to iron out any problems pitest has with the test suite."*

```
mvn -Dpit.dryRun=true test-compile org.pitest:pitest-maven:mutationCoverage
```

If a dry run reports mutants and coverage, then the classpath is right, the test plugin loaded, the tests
were discovered and the debug information is present. Everything that fails for *wiring* reasons fails
here, cheaply. Everything that goes wrong afterwards is about mutants and assertions.

**`verbose`** prints what pitest is actually going to do:

> *"features — List of pitest features to enable or disable. Available options are shown in the console
> output when verbose logging is enabled. Additional features may be added by pitest plugins."*

`PitMojo.execute()` also logs, unconditionally, the tool-classpath plugins it found, the shared
client-classpath plugins, and an `"Available mutators : "` line built from every registered operator
name. Those three log lines answer "is my test plugin loaded" and "which operators exist on this
classpath" before any mutant is generated — and the second question is one the build file cannot answer
([03d](03d-optional-mutators.md)).

Leave `verbose` on for the first few runs. Turn it off when the report is boring.

## Precondition 1 · A green suite

Pitest performs a normal coverage run first and refuses to continue if anything fails, with the message
in `org.pitest.help.Help`:

> *"%s tests did not pass without mutation when calculating line coverage. Mutation testing requires a
> green suite."*

This is structural, not fussiness: the entire signal is *"a test failed while the mutant was loaded"*,
and that reading is worthless if tests were already failing ([02](02-how-it-works.md)).

The interesting case is a suite that is green under surefire and red under pitest. The FAQ lists four
causes:

> *"PIT is picking up tests that are not included/are excluded in the normal test config"*

> *"Some tests rely on an environment variable or other property set in the test config, but not set in
> the Pitest config"*

> *"Tests or code under test use reflection without filtering synthetic fields"*

> *"The tests have a hidden order dependency that is not revealed during the normal test run"*

and adds one more:

> *"If you are using an unusual or custom JUnit runner this can also sometimes cause problems. To make
> things fast PIT does some tricky stuff to split your tests into small independent units."*

🔴 **The fourth is a genuine finding, not an obstacle.** Pitest runs your tests in orders your build never
produces, so a test that passes only because another ran first will fail under it. That is a real defect
in the suite, and the fix belongs in
[08 · Finding order dependence](../08-test-data-patterns/05b2-finding-order-dependence.md) rather than in
a pitest setting. The other four are configuration differences to reconcile — usually by moving whatever
surefire is configuring into pitest's own `jvmArgs`, `environmentVariables` or exclusions, or by letting
pitest inherit them ([05a2](05a2-surefire-and-jacoco.md)).

## Precondition 2 · Line-number debug information

> *"In order to do this PIT requires that the following debug information is present in the bytecode:
> Line numbers; Source file name"*

with dedicated errors for both failures — *"No classes found with line number debug information. All
classes should be compiled with source and line number debug information."* and *"The class %s does not
contain source debug information."*

Maven and Gradle emit debug information by default, so this bites exactly one kind of build: one that has
deliberately turned it off. `-g:none` to shrink jars, or a shading or obfuscation step that strips
`LineNumberTable`, produces a release build where pitest refuses to run and JaCoCo reports no line
coverage — and since that configuration usually lives in a release profile, it surfaces in CI and never
locally ([02](02-how-it-works.md)).

## Precondition 3 · Something in scope

`failWhenNoMutations` defaults to `true`, and that default is protecting you from a flattering number
rather than being strict for its own sake. `PercentageCalculator.getPercentage` returns **100** when the
mutant total is zero ([04c](04c-the-score-arithmetic.md)), so a scope that matched nothing would otherwise
report a perfect mutation score.

The FAQ's three documented causes of an empty run:

> *"Incorrect classpath; Incorrect filters; Incorrect mutable code path"*

and the glob rule that produces the second of them:

> *"Globs are pretty simple and will work as expected as long as you match packages (like
> com.your.package.root.want.to.mutate*). But if you match exact class names, inner classes won't be
> included. If you need them you'll have to either add a '*' at the end of the glob to also match them
> (com.package.Class* instead of com.package.Class) or to add another rule for it (com.package.Class.* in
> addition to com.package.Class)."*

Lambdas and anonymous classes compile to synthetic members, so an exact-name glob on a class that uses
either can silently skip most of what the class does — and the run will not fail, because it found
*something*.

## Skipping it

Three switches, and their names do not match:

| To skip | Use | Note |
|---|---|---|
| This module | `<skip>true</skip>` in `<configuration>` | The **property** is `-DskipPitest=true`, not `-Dskip` |
| Everything, with the tests | `-DskipTests` | `shouldRun()` reports *"Test execution should be skipped (-DskipTests)."* |
| Nothing, but check the wiring | `-Dpit.dryRun=true` | Generates mutants, runs none of them |

The mojo declares `@Parameter(property = "skipPitest", defaultValue = "false") private boolean skip;` —
element `skip`, property `skipPitest`. `-Dskip=true` does nothing, which is a five-minute mistake the
first time and a much longer one on a CI job nobody watches.

## Where this connects

- **[05 · Wiring it up](05-wiring-it-up.md)** — the POM these preconditions apply to.
- **[05a2 · Surefire and JaCoCo](05a2-surefire-and-jacoco.md)** — the surefire configuration pitest inherits, which is where several "green under Maven, red under pitest" differences are reconciled.
- **[05c · Scoping and incremental analysis](05c-scoping-and-incremental.md)** — the globs that decide what is in scope, and how to make the run finish.
- **[02 · How it works](02-how-it-works.md)** — why the green suite and the debug information are structural requirements rather than preferences.
- **[04c · The score arithmetic](04c-the-score-arithmetic.md)** — the zero-mutant 100% that `failWhenNoMutations` exists to prevent.
- **[08 · Finding order dependence](../08-test-data-patterns/05b2-finding-order-dependence.md)** — the one "pitest broke my suite" cause that is a real defect.
- **[09 · Line coverage needs debug info](../09-jacoco/03c-line-coverage-needs-debug-info.md)** — the same requirement, for the same reason, one topic earlier.

## Gotchas

**★ Run `dryRun` before you interpret anything.**
It gathers coverage and generates every mutant without running the tests against them, which is exactly
the subset of the pipeline that fails for wiring reasons. If a dry run reports mutants and coverage, the
classpath, the test plugin and the debug information are all fine — and if it does not, nothing you read
in a full run's report is about your tests.

**★ A green build and a green pitest coverage pass are different things.**
The FAQ lists four causes for the divergence: different test inclusion or exclusion, environment
variables or system properties set only in the surefire configuration, reflection over synthetic fields,
and hidden order dependence that the normal run happens not to expose. Only the last is a defect in the
tests, and it is a real one.

**★ Order dependence surfaces as "pitest cannot run my suite" and is a finding, not an obstacle.**
Pitest splits tests into small independent units and runs them in orders your build never produces, so a
test that quietly depends on a row inserted by an earlier test fails under it. The temptation is to
exclude the offending class; the correct response is to fix the dependency, because pitest has just told
you something no other tool in the build was going to.

**★ Turning off debug information to shrink jars silently disables pitest.**
`-g:none`, or a shading step that strips `LineNumberTable`, leaves a build where JaCoCo reports no line
coverage and pitest refuses to run with *"No classes found with line number debug information"*. Because
that setting usually lives in a release profile, it appears in CI and never on a developer machine.

**★ `failWhenNoMutations` defaults to `true`, and that default is protecting you from a fake 100%.**
`PercentageCalculator.getPercentage` returns 100 when the total is zero, so a `targetClasses` glob that
matches nothing would otherwise produce a perfect score. Failing the build turns a configuration mistake
into a visible error. Setting it to `false` for one legitimately empty module is fine; setting it
globally hides real misconfiguration.

**★ A `targetClasses` glob written as an exact class name excludes that class's inner classes.**
*"if you match exact class names, inner classes won't be included"* — the remedy is a trailing `*` or a
second rule. Lambdas and anonymous classes compile to synthetic members, so an exact-name glob on a class
that uses either can skip most of what it does, and the run will not fail because it still found
something.

**★ The `skip` element and the `skipPitest` property have different names.**
`@Parameter(property = "skipPitest", defaultValue = "false") private boolean skip;`. So the POM element
is `<skip>` and the command-line switch is `-DskipPitest=true`. `-Dskip=true` does nothing, and
`-DskipTests` skips pitest as well as the tests, which `shouldRun()` reports as *"Test execution should
be skipped (-DskipTests)."*

**★ The console logs which plugins were found and which mutators exist, on every run.**
`PitMojo.execute()` logs each tool-classpath plugin it discovered, each shared client-classpath plugin,
and an `"Available mutators : "` line assembled from every registered operator. That is how you confirm
the JUnit Platform plugin actually loaded, and it costs nothing — it is not gated on `verbose`.

**★ "Available mutators" is not "active mutators".**
The startup log lists every operator registered on the classpath; the *Active mutators* block at the
bottom of each HTML source page lists the ones that ran ([04a](04a-the-html-report.md)). A plugin that
adds operators changes the first list immediately and the second only if you name them.

## Interview questions

**★ PIT reports that your suite is not green, but `mvn test` passes. What is going on?**
Pitest runs its own coverage pass before generating any mutants and refuses to continue if anything
fails, because its whole signal is "a test failed while the mutant was loaded" and that reading is
worthless if tests were already failing. The FAQ gives four causes for the divergence: pitest is picking
up tests your normal configuration includes or excludes differently; some tests depend on an environment
variable or system property set in the surefire configuration and not in pitest's; code or tests use
reflection without filtering synthetic fields; or the suite has a hidden order dependency that the normal
run happens not to expose. The last is the interesting one — pitest splits tests into small independent
units and runs them in orders your build never produces, so it is a genuine finding about the suite
rather than a pitest problem, and excluding the class to make the run start throws away the information.

**★ You have added pitest and the run reports no classes to mutate. How do you diagnose it?**
The FAQ narrows it to three causes — incorrect classpath, incorrect filters, incorrect mutable code path
— and I would take them in that order. Classpath first: pitest is a bytecode mutator, it does not compile
anything, so nothing works unless the goal is invoked after `test-compile`. Then filters: the glob rules
say an exact class name does not match inner classes, so `com.example.PricingService` misses its lambdas
and anonymous classes while `com.example.PricingService*` does not; and if `targetClasses` is omitted
entirely, pitest scans the output directory, which it has only done since 1.2.0 — before that it guessed
from the Maven group id, so an inherited config may be compensating for behaviour that no longer exists.
Then the mutable code path. And I would do all of that under `-Dpit.dryRun=true`, which exercises exactly
this part of the pipeline without paying for the mutation phase.

**★ Why does PIT need line-number debug information, and when is that a problem?**
Because it mutates bytecode but reports against source: it has to map a mutated instruction back to a
line to use the per-test line coverage it gathered and to render a report at all, so it needs
`LineNumberTable` and the source file name. Maven and Gradle emit both by default, so the only builds
that hit it are ones that deliberately strip them — `-g:none` to shrink a jar, or a shading or
obfuscation step in a release profile. The failure mode is nasty because it is profile-specific: the
developer build is fine, and CI reports *"No classes found with line number debug information"*. It is
the same requirement JaCoCo has for line coverage, for the same reason.

**★ What are the two switches you would use on the first ever pitest run, and why those?**
`dryRun` and `verbose`. `dryRun` gathers coverage and generates every mutant without running the tests
against them, so it exercises the entire failure-prone part of the setup — classpath, test-plugin
loading, test discovery, debug information, scope globs — without paying for the mutation phase, which is
the expensive part. `verbose` prints the available features and, together with the mojo's unconditional
startup logging of discovered plugins and available mutators, tells me what pitest actually has on its
classpath rather than what the POM says. Between them they answer every "why did it find nothing"
question, and they answer it in seconds rather than after a long run whose report I would have
misinterpreted.

{/* FOOTER */}
