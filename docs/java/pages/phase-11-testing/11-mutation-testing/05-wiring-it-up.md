---
title: "The Maven wiring is eight lines plus one unusual shape — the JUnit Platform plugin goes inside the pitest plugin's own dependencies block, not the project's — and the reason it works on Jupiter 6.0.3 is a source-read heuristic that resolves junit-platform-launcher at whatever version it finds junit-platform-engine or junit-platform-commons at, which JUnit 6's unified version numbers happen to satisfy"
sidebar_label: "05 · Wiring it up"
sidebar_position: 30
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-09-01 against the pitest
> [Maven quick start](https://pitest.org/quickstart/maven/) (installation, the `mutationCoverage` goal,
> `targetClasses`, `targetTests`, globs, `dryRun`, `failWhenNoMutations`, `testPlugin`, `skip`), the
> [FAQ](https://pitest.org/faq/) (*"What are the requirements for running PIT?"*, *"PIT found no classes
> to mutate"*, *"My tests normally run green but PIT says the suite isn't green"*), the
> [pitest-junit5-plugin README](https://github.com/pitest/pitest-junit5-plugin), and pitest 1.30.0
> source read at the `1.30.0` tag: `pitest-maven/src/main/java/org/pitest/maven/PitMojo.java` and
> `MojoToReportOptionsConverter.java` (`autoAddJUnitPlatformLauncher`, `autoAddJUnitPlatformEngine`,
> `autoAddJupiterEngine`, `findJUnitArtifact`), plus `org.pitest.help.Help`. Artifact versions from
> Maven Central `maven-metadata.xml` for `org.pitest:pitest-maven`, `org.pitest:pitest-junit5-plugin`
> and `org.junit.platform:junit-platform-launcher`.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0, Spring Framework
> 7.0.8, JUnit Jupiter 6.0.3, Mockito 5.23.0, AssertJ 3.27.7, Testcontainers 2.0.5.
> ⚠️ **No sandbox and no build on this machine.** The POM below is configuration, not a run. **No
> console output, timing or score on this page came from executing anything**, and where I could not
> confirm behaviour on this stack I say so rather than guessing.

**Getting pitest onto a Boot 4.1 build is a short POM with one shape nobody expects, and one question
that the documentation cannot settle. The unusual shape is that the JUnit Platform plugin goes inside
the pitest plugin's own `<dependencies>` block, because pitest loads test plugins from *its* classpath
rather than the project's. The unsettled question is whether an adapter last released in May 2025
drives JUnit Platform 6.0.3 — and the answer, read out of the Maven plugin's source rather than any
document, is more encouraging than the plugin's release date suggests. The surefire configuration pitest
silently inherits, and the JaCoCo interaction, are [05a2](05a2-surefire-and-jacoco.md).**

## The POM

```xml
<plugin>
  <groupId>org.pitest</groupId>
  <artifactId>pitest-maven</artifactId>
  <version>1.30.0</version>
  <dependencies>
    <dependency>
      <groupId>org.pitest</groupId>
      <artifactId>pitest-junit5-plugin</artifactId>
      <version>1.2.3</version>
    </dependency>
  </dependencies>
  <configuration>
    <targetClasses>
      <param>com.example.orders.domain.*</param>
    </targetClasses>
    <excludedTestClasses>
      <param>*IT</param>
      <param>*IntegrationTest</param>
    </excludedTestClasses>
    <timeoutConstant>15000</timeoutConstant>
    <verbose>true</verbose>
  </configuration>
</plugin>
```

The goal runs on demand rather than bound to a lifecycle phase:

```
mvn test-compile org.pitest:pitest-maven:mutationCoverage
```

**Nothing binds `mutationCoverage` to a phase for you.** `mvn test` does not run it, and neither does
`mvn verify`. That default is right — a full mutation run is not something you want on every build
([06 · The cost](06-the-cost.md)) — and it means a `<profile>` with an `<execution>` is how it gets into
CI, which also keeps the analysis configuration textually separate from the developer build. Note the
`test-compile` in front of the goal: pitest mutates compiled classes and needs the test classes present
to find tests, so invoking the goal on its own in a clean checkout finds nothing.

Two defaults worth knowing before you debug a "found nothing" run. If `targetClasses` is omitted, pitest
scans rather than guesses — *"In 1.2.0 and later versions pitest will scan your project to determine
which classes are present"* — where before 1.2.0 it assumed your classes lived in a package matching the
Maven group id. And the mojo adds Kotlin source roots on its own:
`@Parameter(property = "pit.additionalSources", defaultValue = "src/main/kotlin")`, with a matching
`pit.additionalTestSources` for `src/test/kotlin`, because *"Maven kotlin projects often add the kotlin
sources at runtime via the build helper or kotlin plugins"* and pitest's goal is often invoked directly,
so that configuration is not visible to it.

⚠️ **Do not copy the documentation's `<version>LATEST</version>`.** The quick start uses it throughout,
and Maven has deprecated `LATEST`/`RELEASE` for plugin versions; more to the point, a mutation score is
only comparable against a run with the same engine version ([04c](04c-the-score-arithmetic.md)), so
pinning is not housekeeping here — it is a precondition for the number meaning anything.

## 🔴 The plugin dependency goes in the wrong-looking place

The `pitest-junit5-plugin` README states the rule:

> *"To activate the plugin it must be placed on the classpath of the pitest tool (**not** on the
> classpath of the project being mutated)."*

In Maven that means a `<dependencies>` block **inside the `<plugin>` element**, as above — not in the
project's top-level `<dependencies>`. Pitest discovers test plugins from its own classpath through
`META-INF/services`, so a correctly-versioned dependency in the wrong block is indistinguishable from no
dependency at all, and you get the error from `org.pitest.help.Help`:

> *"No working test plugins found on classpath. PIT requires either JUnit 4 (but can run JUnit 3 tests)
> to be on the classpath, or for the JUnit5 or TestNG plugin to be installed."*

And the parameter people delete when they read the docs is a different thing:

> *"testPlugin — No longer required. Test plugins are now selected automatically."*

That sentence is about the **configuration key**, not the **artifact**. The FAQ still says
*"JUnit 5 is not supported out of the box, but a plugin can be found here"*
([01b](01b-the-tool-and-its-versions.md)).

## Why it works on Jupiter 6.0.3 — read from the plugin's source

`pitest-junit5-plugin` 1.2.3 was published on 2025-05-20 and compiles against
`junit-platform-launcher` 1.9.2 in `provided` scope, so the obvious worry is that it cannot drive Platform
6. Three facts, in order, settle most of it.

**The plugin ships no JUnit classes**, so it binds to whatever Platform is on the runtime classpath, and
every Platform type it references still exists in 6.0.3 ([01b](01b-the-tool-and-its-versions.md)).

**The launcher is resolved at *your* version, not the plugin's.** `MojoToReportOptionsConverter` does
this, with the reasoning in its own comment:

```java
/**
 * The junit 5 plugin needs junit-platform-launcher to run, but this will not be on the classpath
 * of the project. We want to use the same version that surefire (and therefore the SUT) uses, not
 * the one the plugin was built against.
 * ...
 */
private void autoAddJUnitPlatformLauncher(List<String> classPath) {
  autoAddJUnitPlatformArtifact(classPath, "junit-platform-launcher");
}
```

`autoAddJUnitPlatformArtifact` looks for any `org.junit.platform` artifact already on the project's
classpath, preferring `junit-platform-engine` and falling back to `junit-platform-commons`, then
constructs the requested artifact at **that same version** — the code comment is
`// Assume that artifact has been released with same version number as engine and commons` — and resolves
it through Maven's repository system, transitive dependencies included. There is a matching
`autoAddJupiterEngine` that adds `junit-jupiter-engine` at the version of `junit-jupiter-api` when the
engine is not already declared.

**On this stack that heuristic holds.** JUnit 6 unified its version numbers: Boot 4.1.0 manages
`org.junit:junit-bom:6.0.3`, and `junit-platform-commons`, `junit-platform-engine` and
`junit-platform-launcher` are all published at **6.0.3** on Maven Central. So pitest finds Platform
6.0.3 on the classpath and resolves the launcher at 6.0.3. (Under JUnit 5 the same code worked because
Platform artifacts shared the 1.x line with each other — the assumption is about the Platform artifacts
agreeing among themselves, not about Platform and Jupiter agreeing.)

⚠️ **What that does *not* establish.** It shows the classpath will be assembled correctly and that no
type the adapter needs was removed. It does not prove the adapter's behaviour against a Platform four
minor versions newer than the one it was compiled against, and there is an open, unreproduced issue on
the plugin claiming zero coverage on Boot 4. The honest position: verify on your own project with a dry
run before promising anything, and treat "pitest found no tests" as a wiring symptom rather than a
finding ([05c](05c-scoping-and-incremental.md)).

Before you interpret any number this build produces, there are three preconditions it has to satisfy — a
green suite, line-number debug information and something in scope — plus two switches, `dryRun` and
`verbose`, that exist to prove the wiring before you read a report. Those, and the three differently-named
ways to skip pitest, are [05a](05a-before-the-first-run.md).

## Where this connects

- **[05a · Before the first run](05a-before-the-first-run.md)** — the preconditions, `dryRun`, `verbose`, and the three ways to skip pitest.
- **[05a2 · Surefire and JaCoCo](05a2-surefire-and-jacoco.md)** — the surefire configuration pitest inherits by default, and what happens when the JaCoCo agent ends up in a minion.
- **[05b · Gradle](05b-gradle.md)** — the same build, done by a third-party plugin with different defaults.
- **[05c · Scoping and incremental analysis](05c-scoping-and-incremental.md)** — making the run finish, and what "no classes found" usually means.
- **[01b · The tool and its versions](01b-the-tool-and-its-versions.md)** — the five artifacts, the version-list hole, and the arcmutate seam.
- **[02 · How it works](02-how-it-works.md)** — the green-suite requirement and the debug-information requirement, and why both exist.
- **[04c2 · Thresholds and gates](04c2-thresholds-and-gates.md)** — the parameters that make this build fail.
- **[Phase 8 · Build and dependencies](../../phase-8-build-dependencies/README.md)** — Maven itself, which this chunk assumes.

## Gotchas

**★ The JUnit 5 plugin goes inside the pitest plugin's own `<dependencies>`, not the project's.**
Its README says the plugin *"must be placed on the classpath of the pitest tool (not on the classpath of
the project being mutated)"*. Pitest loads test plugins from its own classpath via `META-INF/services`,
so a correct dependency in the wrong block behaves exactly like a missing one, and the error names the
plugin you thought you had added.

**★ "Test plugins are now selected automatically" is about the parameter, not the artifact.**
The obsolete thing is the `testPlugin` configuration key. The `pitest-junit5-plugin` dependency is still
required — the FAQ still says JUnit 5 *"is not supported out of the box"*. Those two sentences live on
different pages and are routinely merged into a wrong conclusion.

**★ Do not use `<version>LATEST</version>`, whatever the quick start says.**
It appears in every example on pitest's Maven page. Beyond Maven having deprecated it for plugins, a
mutation score is only comparable against a run with the same engine version, because a pitest upgrade
can add default operators and change filter behaviour. Pinning the version is part of making the number
mean something.

**★ Pitest resolves `junit-platform-launcher` at the version it finds on *your* classpath, not the plugin's.**
`autoAddJUnitPlatformArtifact` prefers `junit-platform-engine`, falls back to `junit-platform-commons`,
and constructs the launcher at that artifact's version — the source comment is *"Assume that artifact has
been released with same version number as engine and commons"*. On Boot 4.1 that yields 6.0.3, because
JUnit 6 publishes all the Platform artifacts on one version line. It is also why manually pinning a
launcher version is usually unnecessary and occasionally harmful: if you declare one, the auto-add step
returns early and yours is used.

## Interview questions

**★ Walk me through adding PIT to a Spring Boot 4.1 Maven build.**
The plugin itself, pinned to a version — `org.pitest:pitest-maven:1.30.0` — and then the one shape people
get wrong: `org.pitest:pitest-junit5-plugin` goes in a `<dependencies>` block *inside* the plugin
element, because pitest loads test plugins from its own classpath via `META-INF/services`, and the
plugin's README says explicitly that it must not go on the project's classpath. Then a `targetClasses`
glob so the run is scoped to code worth measuring, `excludedTestClasses` for the slow integration tests,
and `verbose` on for the first few runs so I can see the active mutators and features. Then I would run
it once with `-Dpit.dryRun=true` to prove the wiring before interpreting any result. I would not copy the
documentation's `<version>LATEST</version>`, both because Maven deprecated it and because a mutation
score is only comparable against a run with the same engine version.

**★ Does the pitest JUnit 5 plugin work with JUnit 6, and how would you check?**
The evidence says probably yes, and the way to check is a dry run on your own project. The plugin is
seven classes with no shaded JUnit types, compiled against `junit-platform-launcher` 1.9.2 in `provided`
scope, so it binds to whatever Platform is on the runtime classpath — and every Platform type it
references still exists in 6.0.3. More importantly, the Maven plugin does not use the version the
adapter was built against: `MojoToReportOptionsConverter` finds an `org.junit.platform` artifact on the
project's classpath, prefers `junit-platform-engine` and falls back to `junit-platform-commons`, and
resolves `junit-platform-launcher` at that same version. JUnit 6 publishes all of those on one version
line, so on Boot 4.1 it resolves 6.0.3. What none of that proves is behaviour, and there is an open,
unreproduced issue claiming zero coverage on Boot 4 — so `dryRun` first, and treat "no tests found" as a
wiring symptom.

{/* FOOTER */}
