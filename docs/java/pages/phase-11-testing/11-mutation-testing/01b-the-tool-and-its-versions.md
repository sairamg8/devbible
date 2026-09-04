---
title: "PIT is five separately-versioned artifacts pretending to be one tool: an engine at 1.30.0 whose version list has a deliberate hole in it, a JUnit Platform plugin at 1.2.3 that has not shipped since May 2025, a third-party Gradle plugin two engine-releases behind, and a commercial add-on whose advertisement is printed by the open-source console reporter"
sidebar_label: "01b · The tool and its versions"
sidebar_position: 2
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-08-31 against Maven Central's `maven-metadata.xml` for `org.pitest:pitest`,
> `pitest-maven`, `pitest-command-line` and `pitest-junit5-plugin`
> ([repo1.maven.org](https://repo1.maven.org/maven2/org/pitest/)); the
> [pitest GitHub releases](https://github.com/hcoles/pitest/releases) (1.30.0 published
> 2026-08-27); the [pitest FAQ](https://pitest.org/faq/); the
> [pitest-junit5-plugin README](https://github.com/pitest/pitest-junit5-plugin) and the published
> `pitest-junit5-plugin-1.2.3.pom` and jar; the
> [gradle-pitest-plugin 1.19.0 release notes](https://github.com/szpak/gradle-pitest-plugin/releases);
> and pitest's own `pitest-parent` POM (`asm.version`, `maven.compiler` `release`).
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1, JUnit Jupiter
> 6.0.3.
> ⚠️ **No sandbox and no build on this machine.** Artifact facts here come from published POMs,
> published jars and release notes — never from a run.

**Before any of the interesting material about mutants and scores, you have to get the tool onto
the classpath, and PIT is not one artifact. It is an engine, a Maven plugin, a command-line entry
point, a separately-versioned JUnit Platform plugin, a third-party Gradle plugin maintained by
somebody else on a different release cadence, and a commercial extension called arcmutate whose
existence leaks into the open-source tool's console output. Every one of those seams has produced
a real support question, and three of them matter specifically on the Spring Boot 4 / Jupiter 6
stack this phase targets.**

## The tool: PIT

The JVM's mutation testing system is **PIT**, published as `org.pitest:pitest`. From its own FAQ:

> *"PIT began life as a spike to run JUnit tests in parallel, using separate classloaders to
> isolate static state. […] So PIT originally stood for Parallel Isolated Test. Now it stands for
> PIT."*

The current release is **1.30.0**, published 2026-08-27. The version number has a wrinkle worth
knowing about, because it will look like you are misreading Maven Central. Pitest's own release
note for 1.30.0 says:

> *"Note, version bump from 1.25.x series made due to mislabelling of release as 1.29.10."*

So the version list on Central runs `… 1.25.8, 1.25.9, 1.29.10, 1.30.0`. There is no 1.26, 1.27,
1.28 or 1.29.0–1.29.9. A tool that alerts you to "20 versions behind" is comparing against a gap
that never existed.

## The five artifacts

| Artifact | Current | What it is |
|---|---|---|
| `org.pitest:pitest` | 1.30.0 | The engine — mutators, minion protocol, `DetectionStatus` |
| `org.pitest:pitest-maven` | 1.30.0 | The Maven plugin — goal `mutationCoverage` |
| `org.pitest:pitest-command-line` | 1.30.0 | Standalone CLI entry point |
| `org.pitest:pitest-junit5-plugin` | **1.2.3** | 🔴 Separately versioned, separately released, and still required for JUnit Platform tests |
| `info.solidsoft.gradle.pitest:gradle-pitest-plugin` | 1.19.0 | The Gradle plugin — **third party**, by Marcin Zajączkowski, released 2026-03-29 |

The engine, the Maven plugin and the CLI move together and share a version number; the other two
do not, and that is where the sharp edges are.

## 🔴 The JUnit Platform plugin is still a separate artifact, and it is old

`pitest-junit5-plugin`'s `maven-metadata.xml` lists **1.2.3** as the newest version and stamps
`lastUpdated` as **2025-05-20**. The engine has shipped more than a dozen releases since. Two
statements from primary sources settle whether it is still needed:

The FAQ, on requirements:

> *"JUnit 5 is not supported out of the box, but a plugin can be found here"*

And pitest's own error catalogue, `org.pitest.help.Help`, which is what you actually see when it
is missing:

> *"No working test plugins found on classpath. PIT requires either JUnit 4 (but can run JUnit 3
> tests) to be on the classpath, or for the JUnit5 or TestNG plugin to be installed."*

⚠️ **What *is* obsolete is the `testPlugin` configuration parameter, not the artifact.** The Maven
quick-start documents it as:

> *"testPlugin — No longer required. Test plugins are now selected automatically."*

Those two facts are routinely conflated into "you don't need the JUnit 5 plugin any more", which
is wrong. You add the dependency; you no longer name it in configuration. And per the plugin's own
README, it must go on **pitest's** classpath, not your project's:

> *"To activate the plugin it must be placed on the classpath of the pitest tool (**not** on the
> classpath of the project being mutated)."*

In Maven that means a `<dependencies>` block *inside the `<plugin>` element*, which is an unusual
enough shape that people get it wrong — see [chunk 05](05-wiring-it-up.md).

## What the plugin actually contains

This matters because there is a widely-repeated explanation of the Boot 4 problems that the
artifact itself contradicts. Unpacking `pitest-junit5-plugin-1.2.3.jar` gives nineteen entries: a
manifest, the Maven descriptor, one `META-INF/services` file, and seven classes, all under
`org/pitest/junit5/`. **There are no shaded or relocated JUnit classes in it.** Its POM declares
`junit-platform-launcher` at 1.9.2 in `provided` scope — compiled against, deliberately not
shipped — and the class files are major version 52 (Java 8), matching the POM's
`maven.compiler.target` of `1.8`.

The consequence: the plugin binds to whatever JUnit Platform is on the runtime classpath. Its
compiled code references exactly these Platform types —

`Launcher`, `LauncherFactory`, `LauncherDiscoveryRequestBuilder`, `LauncherDiscoveryRequest`,
`TestExecutionListener`, `TestIdentifier`, `TagFilter`, `PostDiscoveryFilter`,
`DiscoverySelectors`, `ClassSelector`, `UniqueIdSelector`, `DiscoverySelector`, `Filter`,
`MethodSource`, `TestExecutionResult`, `TestExecutionResult.Status`, and
`org.junit.platform.commons.PreconditionViolationException`

— and **every one of those class files is present in `junit-platform-commons`,
`junit-platform-engine` and `junit-platform-launcher` 6.0.3**, verified by listing those jars.
No type the plugin needs was removed in JUnit 6. That is a necessary condition for it to work on
Boot 4.1, not a sufficient one, and [chunk 05](05-wiring-it-up.md) states exactly what remains
unproven.

## The Gradle plugin is not from the pitest project

`info.solidsoft.gradle.pitest:gradle-pitest-plugin` is maintained separately. Version **1.19.0**
(2026-03-29) is the current release, and its own notes describe it modestly:

> *"This version is just a refreshed variant of 1.15.0, compatible with latest Gradle version
> (8.14/9.0). No PIT 1.19.0 features parity was developed."*

Its stated requirements and defaults:

> *"Java 17+ and Gradle 8.4+ are the minimal supported versions."*

> *"PIT 1.22.1 by default"*

So a Gradle build that does not set `pitestVersion` runs **PIT 1.22.1**, four minor releases
behind the engine's 1.30.0 — including behind 1.25.7's JaCoCo interaction fix and 1.25.8's Java 25
`BigDecimal`/`BigInteger` mutator fix. Pinning `pitestVersion` explicitly is not optional
housekeeping on this stack.

Also note that the plugin's Maven Central coordinates are stale: `maven-metadata.xml` under
`info/solidsoft/gradle/pitest/gradle-pitest-plugin/` stops at 1.15.0 with a `lastUpdated` in 2023.
1.19.0 is published to the **Gradle Plugin Portal**, and the release notes list "Releasing also to
Maven Central (not just only to Gradle Plugins)" under *Missing features*. Looking the plugin up on
Central and concluding it is abandoned is a mistake the artifact repository invites.

## The JVM baselines, from the POMs

| Thing | Requirement | Source |
|---|---|---|
| PIT engine, runtime | Java 11+ | Release note 1.18.0: *"Update minimum supported Java runtime to 11"* |
| PIT engine, compiled | `<release>11</release>` | `pitest-parent` POM |
| Bytecode library | ASM **9.10.1**, shaded to `org.pitest.reloc.asm` | `pitest-parent` `asm.version`, `pitest`'s shade `<relocation>` |
| `pitest-junit5-plugin` | pitest 1.19.4+ | Plugin README, 1.2.3 notes |
| JUnit Platform 6 / Jupiter 6 | Java 17+ | JUnit's *Upgrading to JUnit 6.0* |
| `gradle-pitest-plugin` 1.19.0 | Java 17+, Gradle 8.4+ | Its release notes |

ASM 9.10 introduced `Opcodes.V27`; ASM 9.7.1 introduced `V24` and 9.8 `V25`. So the class-file
format emitted by a JDK 25 compiler is comfortably within what pitest's bundled ASM can read —
which is the *bytecode-parsing* half of "does it work on Java 25". The other half is the JVM
launching behaviour of the forked minions, and pitest's documentation does not publish a maximum
supported JDK. I could not find any statement in pitest's docs or release notes naming Java 25 as
supported or unsupported; the only mention of 25 anywhere in the release notes is 1.25.8's *"Fix
BigDecimal and BigInteger mutators for java 25"*, which implies the maintainer is testing against
it but is not a support statement.

## The arcmutate seam

Pitest's console reporter ends its summary with a line hard-coded in
`MutationStatistics.report(PrintStream)`:

```java
out.println("Enhanced functionality available at https://www.arcmutate.com/");
```

**arcmutate** is a commercial extension by CDG that adds Kotlin support, Spring-aware filtering,
extended operators, and — the one you will want — git integration that restricts analysis to
changed lines. Its documentation is explicit that it is licensed software, with free licences
available for open-source projects. Several capabilities that read like core features in blog
posts and in pitest's own Maven docs are arcmutate's: the `+GIT(from[HEAD~1])` and
`+arcmutate_history(...)` feature strings in the `extraFeatures` example on the Maven quick-start
page are described there as *"arcmutate's git integration and history implementations"*.

That is not a criticism — it is a fact you need before you plan a CI integration around
change-based analysis, because the free tool's answer to the same problem is different and weaker
([chunk 05c](05c-scoping-and-incremental.md)).

## Where this connects

- **[01 · Testing the tests](01-testing-the-tests.md)** is the argument; this chunk is the
  hardware.
- **[05 · Wiring it up](05-wiring-it-up.md)** turns this table into a POM, and says what is and is
  not confirmed about Jupiter 6.0.3.
- **[05b · Gradle](05b-gradle.md)** does the same for the third-party plugin.
- **[Phase 8 · Build and dependencies](../../phase-8-build-dependencies/README.md)** owns Maven and
  Gradle themselves; this topic wires a plugin into a build it assumes you understand.

## Gotchas

**★ The version list on Maven Central has a hole in it, and it is not your repository proxy.**
`1.25.9` is followed by `1.29.10` and then `1.30.0`. Dependency-update bots will present this as a
huge jump. Pitest's release note explains it as a correction to a mislabelled release; nothing was
yanked and nothing is missing.

**★ "Test plugins are now selected automatically" does not mean the JUnit 5 plugin is bundled.**
The `testPlugin` *parameter* is obsolete; the `pitest-junit5-plugin` *dependency* is not. Deleting
it because the docs say "no longer required" produces the `NO_TEST_PLUGIN` error, whose text names
the plugin you just removed. Read the sentence as being about the configuration key it appears
under, because that is where it appears.

**★ The JUnit 5 plugin goes inside the plugin's own `<dependencies>`, not the project's.**
A `pitest-junit5-plugin` dependency in the project's top-level `<dependencies>` puts it on the
classpath of the code under test, which is the one place its README says not to put it. Pitest
loads test plugins from its own classpath via `META-INF/services`, so a correctly-versioned
dependency in the wrong block is indistinguishable from no dependency at all.

**★ A stale `pitest-junit5-plugin` does not look stale — it looks like zero coverage.**
When the platform launcher and the plugin disagree, the failure mode is not a `ClassNotFoundError`
during startup. Pitest completes its scan, reports the classes it found and the mutants it
generated, and then reports that nothing is covered and no tests ran. That is a configuration
failure wearing the costume of a test-quality finding, and it is the shape reported in the
plugin's open issue #113.

**★ The Gradle plugin's default PIT version is not the current PIT version.**
`gradle-pitest-plugin` 1.19.0 defaults to PIT 1.22.1. A Gradle build that omits `pitestVersion`
silently runs an engine from early 2026 — before the JaCoCo bytecode-transformation fix and before
the Java 25 `BigDecimal` mutator fix. Always set it.

**★ The Gradle plugin looks abandoned on Maven Central and is not.**
Central's metadata for it stops at 1.15.0 (2023). It publishes to the Gradle Plugin Portal, and
publishing to Central is listed in its own release notes as a missing feature. Judging its
maintenance from Central alone gets the wrong answer by three years.

**★ Half the "PIT features" you read about in blog posts are arcmutate's and cost money.**
Git-diff-scoped analysis, Kotlin mutation, Spring-aware filtering and the accelerator are
commercial. The open-source tool has globs, an incremental history file, and nothing that
understands your VCS. Plan the CI story against the free feature set unless someone has bought a
licence.

**★ The pitest project is small, and issue reports are not documentation.**
The engine has one principal maintainer. Its issue tracker contains detailed, confident,
well-formatted reports that have never been reproduced — including at least one where the
maintainer asked whether it had been written by an LLM and closed the accompanying pull request
when nobody answered. Treat GitHub issues as leads and the docs, the POMs and the source as
evidence.

## Interview questions

**★ Is the pitest JUnit 5 plugin still needed, or has it been absorbed into the core?**
Still needed. It is published separately as `org.pitest:pitest-junit5-plugin`, currently 1.2.3, and
pitest's own error message for a missing test plugin names it explicitly. What changed is that you
no longer set the `testPlugin` configuration parameter to `junit5` — the Maven docs say test
plugins are selected automatically now — and that the Maven and Gradle plugins auto-resolve a
matching `junit-platform-launcher` at runtime instead of you pinning one. The dependency still has
to be declared, and it has to be declared on pitest's classpath rather than the project's.

**★ Why is the JUnit 5 plugin on a completely different version line from the engine?**
It is a small adapter — seven classes — that translates between pitest's `TestPluginFactory` SPI
and the JUnit Platform `Launcher` API, and it changes only when one of those two APIs changes. Its
README documents the compatibility matrix in the other direction, as a minimum pitest version per
plugin release (1.2.3 requires pitest 1.19.4+). The practical hazard of that arrangement is that a
plugin whose newest release predates your JUnit version by a year still resolves cleanly, because
neither Maven nor the plugin has any way to express "this needs Platform 6".

**★ What does PIT bundle, and why does that matter for JDK support?**
It shades ASM — 9.10.1 in 1.30.0 — relocated to `org.pitest.reloc.asm` so it cannot clash with
whatever ASM your build, your Spring version or your other agents drag in. That matters because
ASM is the component that has to understand the class-file format your JDK emits: ASM 9.8 added
the Java 25 constant, 9.10 the Java 27 one. It also means upgrading ASM in your own build does
nothing for pitest, and that a pitest release note bumping ASM is the thing to look for when a new
JDK's class files appear in your project.

**★ A colleague says pitest doesn't work on Spring Boot 4. How would you check?**
By separating three claims that get merged. First, does the engine run on JDK 25 — bytecode-wise
yes, since its ASM understands the format, and the maintainer has shipped a Java 25 mutator fix.
Second, does the JUnit Platform plugin work against Platform 6.0.3 — every Platform type it
references still exists in 6.0.3, so nothing is removed, but the plugin is compiled against 1.9.2
and there is an open, unreproduced issue claiming zero coverage on Boot 4. Third, does the build
wiring get the right launcher onto pitest's classpath — which the Maven plugin does by copying the
version of `junit-platform-engine` or `junit-platform-commons` it finds in the project. The honest
answer is that the first is settled, the third is settled by reading the plugin's source, and the
second is the one to verify on your own project before you promise anything.

**★ What is arcmutate and when does it become relevant?**
A commercial set of pitest plugins from CDG: Kotlin support, extended mutation operators,
Spring-aware filtering, an accelerator, and git integration that limits analysis to lines changed
between two refs. It becomes relevant the moment you want mutation testing in pull requests,
because the open-source tool has no notion of a diff — its scoping tools are class-name globs and
an incremental history file. Free licences exist for open-source projects. The tell that it is in
the room is the "Enhanced functionality available at arcmutate.com" line that pitest's own console
reporter prints.

{/* FOOTER */}
