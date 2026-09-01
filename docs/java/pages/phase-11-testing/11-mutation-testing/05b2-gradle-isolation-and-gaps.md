---
title: "Gradle's pitest plugin inherits nothing from the test task, splits JVM arguments across two properties for two different JVMs, and carries an incubating flag that exists because pitest stopped shading junit-platform-launcher — and it has no thresholdPrecision at all, so the one gate Maven can make finer than a percentage point, Gradle cannot"
sidebar_label: "05b2 · Gradle isolation"
sidebar_position: 34
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-09-01 against the
> [gradle-pitest-plugin README](https://github.com/szpak/gradle-pitest-plugin) on `master` — the *Test
> system properties*, *Plugin configuration* and *Multi-module projects support* sections and the
> debugging FAQ entry, quoted verbatim — and its source on the same branch:
> `src/main/groovy/info/solidsoft/gradle/pitest/PitestPluginExtension.groovy` (the
> `addJUnitPlatformLauncher` javadoc and `@Incubating` annotation, every threshold declaration,
> `historyInputLocation`, `historyOutputLocation`, `enableDefaultIncrementalAnalysis`, `setWithHistory`,
> `maxSurviving`, `reportAggregatorProperties`). Threshold semantics and the integer blind spot from the
> [Maven quick start](https://pitest.org/quickstart/maven/); `maxSurviving`'s comparison from pitest
> 1.30.0's `statistics/MutationStatistics.getTotalSurvivingMutations`.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0, JUnit Jupiter 6.0.3.
> ⚠️ **No sandbox and no build on this machine.** Everything below is read from the plugin's published
> README and source. **No build output, error message from a run, score or timing on this page came from
> executing anything.**

**[05b](05b-gradle.md) is the plugin and its versions. This chunk is the part that decides whether the
run works at all. Gradle's plugin makes an isolation choice opposite to Maven's — it inherits *nothing*
from the `test` task, where the Maven plugin copies surefire's configuration by default — which means
every system property, JVM flag and environment variable your tests need has to be restated. It also
splits JVM arguments across two properties for two different JVMs, carries an incubating flag whose
failure mode is an alarming error message that is really a missing jar, and lacks the one setting that
makes a percentage gate precise.**

## `addJUnitPlatformLauncher` — the flag that exists because of a shading change

This has no Maven equivalent and is the most Gradle-specific thing in the plugin. From its own javadoc in
`PitestPluginExtension`:

> *"Starting with PIT 1.14.0 (with pitest-junit-plugin 1.2.0+) that dependency is no longer shaded and
> has to be explicitly added to avoid: "Minion exited abnormally due to UNKNOWN_ERROR" or
> "NoClassDefFoundError: org.junit.platform.launcher.core.LauncherFactory". This feature is enabled by
> default if junit-platform is found on the testImplementation classes."*

> *"PLEASE NOTE. This feature is experimental and might not work as expected in some corner cases. In
> that situation, just disable it and add required dependency 'junit-platform-launcher' in a proper
> version to 'testRuntimeOnly' manually."*

The property is annotated `@Incubating`. Two things follow.

**Those two error messages are wiring failures with alarming names.** *"Minion exited abnormally due to
UNKNOWN_ERROR"* is a missing launcher, not a broken test — and it presents as `RUN_ERROR`, which counts
as *detected* and therefore **raises** your mutation score
([04d](04d-the-statuses-that-are-not-findings.md)). A build in this state can report an excellent number.

**Maven solves the same problem differently.** The Maven plugin resolves `junit-platform-launcher` at the
version it finds `junit-platform-engine` or `junit-platform-commons` at, in code, with a comment
explaining the assumption ([05](05-wiring-it-up.md)); Gradle's plugin adds it from `testImplementation`,
heuristically, behind an incubating flag. If it misbehaves, the documented fallback is explicit:

```groovy
dependencies {
    testRuntimeOnly 'org.junit.platform:junit-platform-launcher:6.0.3'
}

pitest {
    addJUnitPlatformLauncher = false
}
```

6.0.3 is the version Boot 4.1.0 manages, and JUnit 6 publishes every Platform artifact on that same line.

## Two JVM argument properties, not one

Maven has `jvmArgs` for the minions and nothing else. Gradle has two, and the README explains why:

> *"`mainProcessJvmArgs` - JVM arguments to be used when launching the main PIT process; make a note that
> PIT itself launches another Java processes for mutation testing execution and usually `jvmArgs` should
> be used to for example increase maximum memory size"*

So `jvmArgs` is the minions — the JVMs that produce `MEMORY_ERROR`
([04d](04d-the-statuses-that-are-not-findings.md)) — and `mainProcessJvmArgs` is the PIT process itself.
The README's debugging entry uses the latter to attach a debugger to PIT:

```groovy
pitest {
    mainProcessJvmArgs = ['-agentlib:jdwp=transport=dt_socket,server=y,suspend=y,address=5005']
}
```

Raising memory on the wrong one changes nothing, and the symptom — memory errors that persist after you
"increased the heap" — looks like a pitest bug.

## 🔴 Nothing is inherited from the `test` task

This is the largest behavioural difference between the two build integrations, and the README states it
plainly:

> *"PIT executes tests in a JVM independent of the JVM used by Gradle to execute tests. If your tests
> require some system properties, you have to pass them to PIT as the plugin won't do it for you"*

with the example:

```groovy
test {
    systemProperty 'spring.test.constructor.autowire.mode', 'all'
}

pitest {
    jvmArgs = ['-Dspring.test.constructor.autowire.mode=all']
}
```

Compare Maven, where `parseSurefireConfig` and `parseSurefireArgLine` both default to `true` and the
plugin copies surefire's excludes, groups, environment variables, `testFailureIgnore` and `argLine`
without being asked ([05a2](05a2-surefire-and-jacoco.md)). The two plugins have made opposite choices,
and each choice creates the opposite hazard: on Maven you inherit an agent you did not want, on Gradle you
lose a property you needed.

**The Gradle symptom is a red coverage pass.** Pitest runs your suite once before generating mutants, so
a missing system property fails tests there and the run stops with *"Mutation testing requires a green
suite"* ([05a](05a-before-the-first-run.md)) — an error that reads as a test problem and is a
configuration one. On a Spring project the usual suspects are the property in the example above,
`--add-opens` flags, a fixed timezone or locale, and anything set through `test { environment ... }`.

There is a compensating advantage worth naming: because nothing is inherited, a Gradle pitest run is
*explicit*. Everything the minions get is written in the `pitest` block, which makes the run reproducible
and makes the JaCoCo-agent collision essentially impossible unless somebody adds it deliberately.

## What the Gradle plugin does not have

`PitestPluginExtension` declares:

```groovy
final Property<Integer> mutationThreshold
final Property<Integer> coverageThreshold
final Property<Integer> testStrengthThreshold
...
final Property<Integer> maxSurviving
```

**All `Integer`, and there is no `thresholdPrecision` property at all.** So a Gradle build cannot express
`61.5`, and the blind spot pitest's own documentation works through in four numbered cases — roughly one
full percentage point wide — is not fixable there ([04c2](04c2-thresholds-and-gates.md)). That makes
`maxSurviving` not merely the better gate on Gradle but the only one narrower than a percentage point.

Two Gradle-only additions balance that.

**`enableDefaultIncrementalAnalysis`**, the plugin's own history switch, with a Maven-compatible alias:

```groovy
/**
 * Alias for enableDefaultIncrementalAnalysis.
 *
 * To make migration from PIT Maven plugin to PIT Gradle plugin easier.
 */
void setWithHistory(Boolean withHistory) {
    this.enableDefaultIncrementalAnalysis.set(withHistory)
}
```

so `withHistory = true` works in a Gradle build even though the underlying property has a different name
([05c](05c-scoping-and-incremental.md)). `historyInputLocation` and `historyOutputLocation` are
`RegularFileProperty`, with `String` setters provided for convenience.

**The aggregator plugin**, for multi-module builds:

> *"It is possible to aggregate pitest report for multi-module project using plugin
> `info.solidsoft.pitest.aggregator` and task `pitestReportAggregate`."*

with its own copies of three gates — `reportAggregator { testStrengthThreshold; mutationThreshold;
maxSurviving }` — and the settings that make it work: `outputFormats = ["XML"]`,
`exportLineCoverage = true`, `timestampedReports = false` ([04a2](04a2-the-other-output-formats.md)). The
README notes the nested-property syntax quirk: *"simpler Groovy syntax (testStrengthThreshold = 50) does
not seem to be supported for nested properties"*, so those need `.set(...)`.

## Where this connects

- **[05b · Gradle](05b-gradle.md)** — the plugin, its versions, and the build file this chunk configures.
- **[05 · Wiring it up](05-wiring-it-up.md)** — Maven's launcher resolution, done in source rather than heuristically.
- **[05a2 · Surefire and JaCoCo](05a2-surefire-and-jacoco.md)** — Maven's inheritance, the opposite choice to this one.
- **[05a · Before the first run](05a-before-the-first-run.md)** — the green-suite requirement that a missing system property trips.
- **[04c2 · Thresholds and gates](04c2-thresholds-and-gates.md)** — the integer blind spot, and what `maxSurviving` actually counts.
- **[04d · The statuses that are not findings](04d-the-statuses-that-are-not-findings.md)** — `RUN_ERROR` and `MEMORY_ERROR`, the two statuses this chunk's failures produce.
- **[05c · Scoping and incremental analysis](05c-scoping-and-incremental.md)** — the history file behind `enableDefaultIncrementalAnalysis`.

## Gotchas

**★ Nothing is inherited from the `test` task.**
The README is explicit: *"If your tests require some system properties, you have to pass them to PIT as
the plugin won't do it for you"*. That is the opposite of Maven, where `parseSurefireConfig` and
`parseSurefireArgLine` both default to true. On Gradle, a `systemProperty` on the test task is simply
absent under pitest, and the symptom is a failing coverage pass reported as *"Mutation testing requires a
green suite"*.

**★ `jvmArgs` and `mainProcessJvmArgs` are different JVMs and easy to swap.**
`jvmArgs` configures the forked mutation-testing processes — the ones that run out of memory — and
`mainProcessJvmArgs` configures the PIT process itself. Raising memory on the wrong one changes nothing,
and the README calls this out precisely because *"PIT itself launches another Java processes for mutation
testing execution"*.

**★ `addJUnitPlatformLauncher` is `@Incubating`, and the errors it prevents look like test failures.**
Its javadoc names them: *"Minion exited abnormally due to UNKNOWN_ERROR"* and *"NoClassDefFoundError:
org.junit.platform.launcher.core.LauncherFactory"*, caused by pitest no longer shading
`junit-platform-launcher` since 1.14.0. Those present as `RUN_ERROR`, which counts as detected and
therefore *raises* the mutation score. The documented fallback is to disable the flag and add
`junit-platform-launcher` to `testRuntimeOnly` yourself.

**★ The auto-add is conditional on finding junit-platform on `testImplementation`.**
Its javadoc says the feature *"is enabled by default if junit-platform is found on the testImplementation
classes"*. A project that puts JUnit on a different configuration — a custom source set, a platform
declared only on `testRuntimeOnly`, an internal test-support module that brings JUnit transitively — may
not trip the condition, and gets the missing-launcher error with the flag apparently enabled.

**★ Gradle has no `thresholdPrecision`, so its percentage gates are a full point wide.**
All three thresholds are `Property<Integer>`. Pitest's own documentation works through the resulting blind
spot in four numbered cases and concludes that *"up to ~100 lines of coverage can silently drift without
the threshold noticing"* on a 10,000-line project. Maven can narrow that with `thresholdPrecision`;
Gradle cannot, which makes `maxSurviving` the only precise gate available.

**★ `maxSurviving` on Gradle counts the same thing it counts on Maven — including uncovered mutants.**
The property is Gradle-side plumbing over pitest's own gate, which compares against
`getTotalMutations() - getTotalDetectedMutations()`, and `NO_COVERAGE` is not detected. So the number is
survivors *plus* uncovered mutants, and a limit set from the report's red entries fails immediately.

**★ `withHistory` on Gradle is an alias, not the real property.**
`setWithHistory` delegates to `enableDefaultIncrementalAnalysis`, and the plugin's own comment says the
alias exists *"To make migration from PIT Maven plugin to PIT Gradle plugin easier"*. Useful to know when
searching the plugin's source or its issue tracker for behaviour, because the name in the documentation
and the name in the code differ.

**★ Report aggregation needs XML, `exportLineCoverage` and untimestamped reports.**
`pitestReportAggregate` from `info.solidsoft.pitest.aggregator` will not work from HTML output. The
README's own example sets `outputFormats = ["XML"]`, `exportLineCoverage = true` and
`timestampedReports = false` before the aggregator's thresholds are usable — and the same "each class
reported once" caveat applies as on Maven ([04a2](04a2-the-other-output-formats.md)).

**★ The aggregator's nested thresholds need `.set(...)`.**
The README says so in a comment on its own example: *"simpler Groovy syntax (testStrengthThreshold = 50)
does not seem to be supported for nested properties"*. Assigning them the ordinary way inside
`reportAggregator { }` silently does not configure the gate, which is the worst failure mode a gate has.

## Interview questions

**★ A Gradle build runs pitest and reports "Minion exited abnormally due to UNKNOWN_ERROR". What is it?**
Almost certainly a missing `junit-platform-launcher`. The plugin's own javadoc names that message and
`NoClassDefFoundError: org.junit.platform.launcher.core.LauncherFactory` together, and explains the cause:
since PIT 1.14.0 with pitest-junit5-plugin 1.2.0+, the launcher is no longer shaded into the adapter and
has to be on the classpath explicitly. The plugin's `addJUnitPlatformLauncher` flag adds it automatically
when it finds junit-platform on `testImplementation`, but it is `@Incubating` and its own documentation
says it *"might not work as expected in some corner cases"*. The documented fix is to disable the flag and
add `junit-platform-launcher` to `testRuntimeOnly` at the right version — 6.0.3 on Boot 4.1. The reason to
care beyond the error itself is that these failures present as `RUN_ERROR`, which pitest classifies as
detected, so a build in this state reports an inflated mutation score.

**★ Your Gradle tests set a system property and pass; under pitest they fail. Why?**
Because the Gradle plugin inherits nothing from the `test` task. Its README is explicit: PIT executes
tests in an independent JVM, and *"If your tests require some system properties, you have to pass them to
PIT as the plugin won't do it for you"* — the example given is exactly this, restating a
`test { systemProperty ... }` as `pitest { jvmArgs = ['-D...'] }`. That is the reverse of Maven, where the
plugin copies surefire's `argLine` and environment variables by default and the risk runs the other way.
The failure surfaces during pitest's coverage pass, so what you actually see is *"Mutation testing
requires a green suite"*, which looks like a test problem and is a configuration one.

**★ How would you gate a Gradle build on mutation results?**
With `maxSurviving`, set at the current count so it can only ratchet down. On Maven I would argue for it
anyway, because a count moves only when mutants are added or killed while a percentage moves whenever the
denominator does; on Gradle the argument is stronger, because all three percentage thresholds are
`Property<Integer>` and there is no `thresholdPrecision`, so a percentage gate carries the full one-point
blind spot pitest's own documentation describes. I would also remember that `maxSurviving` counts
`NO_COVERAGE` mutants as survivors — it compares against total minus detected — so the limit has to come
from an actual run rather than from counting red entries in the report.

**★ Maven inherits the surefire configuration and Gradle inherits nothing. Which is the better design?**
They trade the same problem in opposite directions and both are defensible. Maven's inheritance means
your tests usually just work under pitest, at the cost of dragging in things you did not intend — most
importantly the JaCoCo agent, which arrives through `argLine` and ends up attached to hundreds of forked
minions, and `testFailureIgnore`, which quietly weakens pitest's green-suite guarantee. Gradle's isolation
means nothing surprising is attached, at the cost of every system property, `--add-opens` flag and
environment variable having to be restated in the `pitest` block, with the failure showing up as a red
coverage pass. If I had to pick, the explicit version is easier to reason about six months later — you
can read the `pitest` block and know exactly what the minions get — and the Maven default is easier on day
one. What matters more than the choice is knowing which one you are on, because the debugging is
completely different.

**★ A team sets `reportAggregator { mutationThreshold = 40 }` and the gate never fires. What happened?**
The assignment did not take. The plugin's own README annotates its example with the reason — *"simpler
Groovy syntax (testStrengthThreshold = 50) does not seem to be supported for nested properties"* — so the
aggregator's thresholds have to be set with `.set(40)`. It is the worst failure mode a gate can have,
because nothing errors: the build passes, the threshold reads as configured in the build file, and
nobody discovers it until someone deliberately regresses the suite and the build stays green. The general
lesson is that a gate is not configured until you have seen it fail once on purpose.

{/* FOOTER */}
