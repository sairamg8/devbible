---
title: "PIT's Gradle integration is not part of pitest: it is a separately maintained third-party plugin whose default PIT version is four minor releases behind the engine, whose targetClasses default is Maven's pre-1.2.0 behaviour, whose README pins a JUnit 5 adapter three releases old, and which looks abandoned on Maven Central because it publishes somewhere else entirely"
sidebar_label: "05b · Gradle"
sidebar_position: 33
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-09-01 against the
> [gradle-pitest-plugin README](https://github.com/szpak/gradle-pitest-plugin) on `master` (quick start,
> plugin configuration, test system properties, multi-module support, `pitestReportAggregate`, the PIT
> test-plugins section and the versions section), quoted verbatim, and its source on the same branch:
> `src/main/groovy/info/solidsoft/gradle/pitest/PitestPlugin.groovy`
> (`DEFAULT_PITEST_VERSION`, the `pitest-command-line` and `pitest-junit5-plugin` dependency wiring) and
> `PitestPluginExtension.groovy` (every property declaration, `setWithHistory`, `addJUnitPlatformLauncher`
> and its javadoc). Release facts from the
> [gradle-pitest-plugin releases](https://github.com/szpak/gradle-pitest-plugin/releases) and Maven
> Central metadata for `info.solidsoft.gradle.pitest:gradle-pitest-plugin`.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0, JUnit Jupiter 6.0.3.
> ⚠️ **No sandbox and no build on this machine.** The Gradle below is configuration read from the
> plugin's own README and source. **No build output, score or timing on this page came from a run.**

**PIT's Gradle integration is not part of pitest. It is `info.solidsoft.pitest`, maintained separately by
Marcin Zajączkowski, released on its own cadence, and — this is the fact that changes what you write —
its default PIT version is not the current PIT version. Almost everything in [05](05-wiring-it-up.md)
carries over, because the plugin passes your configuration through to the same engine. What does not
carry over is worth knowing precisely: a different mechanism for the JUnit Platform plugin, an incubating
flag that exists because pitest stopped shading a jar, and integer-only thresholds.**

## The build file

```groovy
plugins {
    id 'java'
    id 'info.solidsoft.pitest' version '1.19.0'
}

pitest {
    pitestVersion = '1.30.0'
    junit5PluginVersion = '1.2.3'

    targetClasses = ['com.example.orders.domain.*']
    excludedTestClasses = ['*IT', '*IntegrationTest']
    timeoutConstInMillis = 15000
    outputFormats = ['HTML', 'XML']
    timestampedReports = false
    verbose = true
}
```

```
gradle pitest
```

> *"After the measurements a report created by PIT will be placed in
> `${PROJECT_DIR}/build/reports/pitest` directory."*

The task is not wired into `check` or `build`; the README shows `build.dependsOn 'pitest'` as an explicit
opt-in, with a warning worth repeating: *"when making `pitest` depend on another task, it must be
referred to by name. Otherwise, Gradle will resolve `pitest` to the configuration and not the task."*

The plugin sets several things for you — *"To make life easier `taskClasspath`, `mutableCodePaths`,
`sourceDirs`, `reportDir`, `verbosity` and `pitestVersion` are automatically set by the plugin"* — and
`targetClasses` defaults to `"${project.group}.*"`, which is the pre-1.2.0 Maven behaviour rather than the
scanning behaviour Maven now has ([05](05-wiring-it-up.md)). On a project whose group id does not match
its package root, that default finds nothing.

## 🔴 Pin `pitestVersion`, always

`PitestPlugin.groovy`:

```groovy
public final static String DEFAULT_PITEST_VERSION = '1.22.1'
```

The current engine is **1.30.0**. A Gradle build that omits `pitestVersion` therefore runs an engine that
predates:

- **1.25.5** — *"Single threaded mutant timeout detection"* ([02c](02c-timeouts-and-determinism.md))
- **1.25.6** — *"Auto disable quarkus jacoco extension"*
- **1.25.7** — *"Disable jacoco transformations at bytecode level"* ([05a2](05a2-surefire-and-jacoco.md))
- **1.25.8** — *"Fix BigDecimal and BigInteger mutators for java 25"* ([03d3b](03d3b-the-experimental-operators.md))

On JDK 25 with JaCoCo in the build — which is this phase's stack exactly — three of those four are
directly relevant. The plugin's own release notes are candid about the relationship:

> *"This version is just a refreshed variant of 1.15.0, compatible with latest Gradle version (8.14/9.0).
> No PIT 1.19.0 features parity was developed."*

and its README states the general rule and the escape hatch:

> *"Every gradle-pitest-plugin version by default uses a predefined PIT version. Usually this the latest
> released version of PIT available at the time of releasing a plugin version. It can be overridden by
> using `pitestVersion` parameter"*

> *"Please be aware that in some cases there could be some issues when using non default PIT versions."*

⚠️ Also note where the plugin lives. Maven Central's metadata for
`info.solidsoft.gradle.pitest:gradle-pitest-plugin` stops at 1.15.0 with a 2023 timestamp; 1.19.0 is on the
**Gradle Plugin Portal**, and publishing to Central is listed in the plugin's own notes under missing
features. Looking it up on Central and concluding it is abandoned gets the answer wrong by three years
([01b](01b-the-tool-and-its-versions.md)).

## The JUnit 5 plugin: a property, not a dependency block

Maven needs the adapter inside the pitest plugin's own `<dependencies>` ([05](05-wiring-it-up.md)). Gradle
does it with one line, and the README says exactly what it does:

> *"//adds dependency to org.pitest:pitest-junit5-plugin and sets "testPlugin" to "junit5"
> junit5PluginVersion = '1.0.0'"*

`PitestPlugin` adds `org.pitest:pitest-junit5-plugin:${junit5PluginVersion}` to the `pitest`
configuration — the tool classpath — alongside `org.pitest:pitest-command-line:${pitestVersion}`. Note
that the Gradle plugin uses the **command-line** artifact, not `pitest-maven`.

⚠️ **The README's example says `1.0.0`, and the current release is 1.2.3.** The README's version guidance
is historical — *"PIT 1.9.0 requires pitest-junit5-plugin 1.0.0+. JUnit Jupiter 5.8 (JUnit Platform 1.8)
requires pitest-junit5-plugin 0.15+, while 5.7 (1.7) requires 0.14"* — and stops well short of JUnit 6.
Set `junit5PluginVersion = '1.2.3'` and treat the README's number as an example rather than a
recommendation.

For any other pitest plugin, the mechanism is a dependency on the `pitest` configuration:

```groovy
dependencies {
    pitest 'org.example.pit.plugins:pitest-custom-plugin:0.42'
}
```

Three further differences change what a Gradle build has to say explicitly — the incubating flag that
adds `junit-platform-launcher`, the *two* JVM-argument properties, and the fact that nothing at all is
inherited from the `test` task — together with the one capability the plugin does not have at all. Those
are [05b2](05b2-gradle-isolation-and-gaps.md).

## Where this connects

- **[05b2 · Gradle isolation](05b2-gradle-isolation-and-gaps.md)** — the incubating launcher flag, the two JVM-argument properties, the nothing-is-inherited rule, and the missing `thresholdPrecision`.
- **[05 · Wiring it up](05-wiring-it-up.md)** — the Maven equivalent, and the launcher resolution done in source rather than heuristically.
- **[05a · Before the first run](05a-before-the-first-run.md)** — the preconditions, which are identical on both build tools.
- **[05a2 · Surefire and JaCoCo](05a2-surefire-and-jacoco.md)** — Maven's inheritance, which Gradle deliberately does not do.
- **[05c · Scoping and incremental analysis](05c-scoping-and-incremental.md)** — `enableDefaultIncrementalAnalysis` and the history file.
- **[04c2 · Thresholds and gates](04c2-thresholds-and-gates.md)** — the integer blind spot Gradle cannot narrow.
- **[04d · The statuses that are not findings](04d-the-statuses-that-are-not-findings.md)** — `RUN_ERROR`, which is what a missing launcher looks like.
- **[01b · The tool and its versions](01b-the-tool-and-its-versions.md)** — the five artifacts, and why this plugin looks abandoned on Maven Central.
- **[09 · Wiring it up (Gradle)](../09-jacoco/02c-wiring-it-up-gradle.md)** — the coverage plugin that will be in the same build.

## Gotchas

**★ The Gradle plugin's default PIT version is not the current PIT version.**
`DEFAULT_PITEST_VERSION = '1.22.1'` against an engine at 1.30.0. A build that omits `pitestVersion` runs
an engine from before the JaCoCo bytecode-transformation fix (1.25.7), the Quarkus JaCoCo fix (1.25.6),
the single-threaded timeout detection change (1.25.5) and the Java 25 `BigDecimal`/`BigInteger` fix
(1.25.8). On JDK 25 with JaCoCo in the build, three of those matter directly. Always set it.

**★ `targetClasses` defaults to `"${project.group}.*"`, which is Maven's pre-1.2.0 behaviour.**
Maven now scans the output directory when the parameter is omitted; the Gradle plugin still guesses from
the group id. On a project whose group does not match its package root, the default finds nothing — and
`failWhenNoMutations` turns that into a build failure rather than a fake 100%, which is the one mercy in
the situation.

**★ The README's `junit5PluginVersion` example is 1.0.0 and the current release is 1.2.3.**
Its compatibility guidance is historical, phrased in terms of Jupiter 5.7 and 5.8, and does not reach
JUnit 6. Copying the example verbatim pins an adapter three releases old for no reason. Set 1.2.3 and
verify with a dry run.

**★ `build.dependsOn 'pitest'` must use the task name as a string.**
The README warns that *"when making `pitest` depend on another task, it must be referred to by name.
Otherwise, Gradle will resolve `pitest` to the configuration and not the task."* The plugin creates both a
`pitest` configuration and a `pitest` task, and the unquoted reference resolves to the wrong one.

**★ The plugin looks abandoned on Maven Central and is not.**
Central's metadata stops at 1.15.0 with a 2023 timestamp. 1.19.0 is published to the Gradle Plugin
Portal, and publishing to Central appears in the plugin's own release notes under missing features.
Judging its maintenance from Central alone gets the wrong answer by three years.

## Interview questions

**★ What is different about running PIT from Gradle rather than Maven?**
Four things that change what you write. The plugin is third-party — `info.solidsoft.pitest`, maintained
separately from pitest — and its default PIT version is 1.22.1 against a current engine of 1.30.0, so
`pitestVersion` has to be pinned or you silently run an engine from before the JaCoCo, Quarkus, timeout
and Java 25 fixes. The JUnit Platform adapter is added with a `junit5PluginVersion` property rather than a
dependency block, and there is an incubating `addJUnitPlatformLauncher` flag that exists because pitest
stopped shading `junit-platform-launcher` in 1.14.0. Nothing is inherited from the `test` task — the
README says so explicitly — where the Maven plugin copies surefire's excludes, groups, environment
variables and `argLine` by default. And the thresholds are integers with no `thresholdPrecision`, so the
one gate Maven can make finer, Gradle cannot.

**★ Someone checks Maven Central, sees gradle-pitest-plugin last published in 2023, and says the Gradle integration is dead. Are they right?**
No. The plugin publishes to the Gradle Plugin Portal, where 1.19.0 was released in 2026; Central's
metadata genuinely does stop at 1.15.0, and "Releasing also to Maven Central (not just only to Gradle
Plugins)" appears in the plugin's own release notes under missing features. What *is* fair to say is that
it tracks the engine loosely — its 1.19.0 notes describe the release as *"just a refreshed variant of
1.15.0, compatible with latest Gradle version"* with *"No PIT 1.19.0 features parity"* — which is exactly
why `pitestVersion` must be pinned rather than inherited, and why a new pitest feature may need
configuring through a generic mechanism rather than a named property.

{/* FOOTER */}
