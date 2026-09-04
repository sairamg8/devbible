---
title: "The Maven plugin silently inherits five things from your surefire configuration — including argLine, which means every agent you attached for surefire is attached to every one of pitest's forked minions — and pitest defends itself against exactly one of those agents by rewriting JaCoCo's Instrumenter to return the bytecode it was handed"
sidebar_label: "05a2 · Surefire and JaCoCo"
sidebar_position: 32
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-09-01 against pitest 1.30.0 source read at the `1.30.0` tag:
> `pitest-maven/src/main/java/org/pitest/maven/SurefireConfigConverter.java` (every `convert…` method),
> `pitest-maven/.../PitMojo.java` (`parseSurefireConfig` and `parseSurefireArgLine`, both
> `defaultValue = "true"`; `skipFailingTests`), `MojoToReportOptionsConverter.convert()`, and
> `pitest/src/main/java/org/pitest/mutationtest/jacoco/DisableJacocoTransformation.java` and
> `DisableJacocoTransformer.java` in full. Release notes for 1.25.6 and 1.25.7 from the
> [pitest GitHub releases](https://github.com/hcoles/pitest/releases). `jvmArgs`, `avoidCallsTo` and
> `excludedTestClasses` semantics from the
> [Maven quick start](https://pitest.org/quickstart/maven/).
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1, Spring Framework
> 7.0.8, JUnit Jupiter 6.0.3.
> ⚠️ **No sandbox and no build on this machine.** Everything below is read from published source and
> release notes. **No console output, coverage figure or run outcome on this page came from a run.**

**Two things happen to a Maven build the moment pitest is added, and neither is in the POM you wrote.
The plugin reads your surefire configuration and copies five settings out of it — by default, without
saying so — and one of those five is `argLine`, which is where the JaCoCo agent lives on almost every
Spring project. That means pitest's forked minions are launched with your coverage agent attached,
hundreds of times, and pitest ships a specific defence against that one agent: it rewrites JaCoCo's
`Instrumenter.instrument` method inside each minion so it hands back the bytecode it was given. Knowing
which of your build's behaviour pitest inherited is the difference between debugging your tests and
debugging your build.**

## What pitest copies from surefire

`SurefireConfigConverter.update` runs five conversions:

```java
convertExcludes(option, configuration);
convertGroups(option, configuration);
convertTestFailureIgnore(option, configuration);
convertEnvironmentVariables(option, configuration);

if (parseArgLine) {
  convertArgLine(option, configuration);
}
```

| Surefire setting | Becomes | Notes |
|---|---|---|
| `<excludes>` | `excludedTestClasses` | Filenames converted to class globs — `.java` stripped, `/` replaced with `.` |
| `<groups>` / `<excludedGroups>` | pitest's `TestGroupConfig` | Only if pitest's own group config is empty |
| `<testFailureIgnore>` | `skipFailingTests` | Your "ignore failures" setting becomes pitest's |
| `<environmentVariables>` | pitest's environment variables | Copied wholesale into the minions |
| `<argLine>` | pitest's `argLine` | **Appended** to whatever pitest already had |

Both switches default to on:

```java
@Parameter(defaultValue = "true")
private boolean parseSurefireConfig;

@Parameter(defaultValue = "true")
private boolean parseSurefireArgLine;
```

and the mojo's own javadoc hedges: *"When set will try and create settings based on surefire
configuration. This may not give the desired result in some circumstances."*

Three details are worth knowing precisely.

**Excludes are merged, not replaced.** `convertExcludes` builds the surefire-derived list and then appends
`option.getExcludedTestClasses()`, so pitest's own exclusions and surefire's both apply. The conversion is
`filename.replace(".java", "").replace("/", ".")`, so `**/*IT.java` becomes a class-name glob.

**Groups are copied only if pitest has none.** `convertGroups` checks whether pitest's existing
`TestGroupConfig` is empty first — configure `includedGroups`/`excludedGroups` in pitest and surefire's
are ignored entirely, rather than merged.

**`argLine` is expanded afterwards.** `MojoToReportOptionsConverter.convert` runs
`replacePropertyExpressions` over the resulting `argLine`, logging *"Replacing properties in argLine"* —
because surefire `argLine` values routinely contain `${...}` placeholders, which is exactly how the JaCoCo
agent gets in.

## 🔴 The JaCoCo `argLine`, and what pitest does about it

The standard JaCoCo wiring sets a property that surefire's `argLine` references, so the agent is attached
to the test JVM ([09 · The `argLine` trap](../09-jacoco/02b-the-argline-trap.md)). Because pitest copies
`argLine` by default, that agent is attached to **every pitest minion** as well — a JVM that is forked
repeatedly and, inside which, pitest rewrites classes after they load.

Two bytecode transformers on the same classes is a genuine hazard, and pitest addresses it directly.
`DisableJacocoTransformation`'s javadoc:

```java
/**
 * Jacoco instrumentation can cause subtle issues with coverage tracking.
 * In case the user hasn't disabled it, we prevent the issue by transforming
 * its instrumentation classes to return unmodified bytecode.
 */
```

The implementation is precise and worth reading, because its precision is also its limit.
`DisableJacocoTransformer.shouldInclude` matches exactly one class name:

```java
private boolean shouldInclude(final String className) {
  return className.equals("org/jacoco/core/instr/Instrumenter");
}
```

and when it matches, `JacocoClassVisitor` replaces one method — `instrument([B)[B` — with a body that
returns its argument:

```java
if (name.equals("instrument") && desc.equals("([B)[B")) {
  MethodVisitor mv = super.visitMethod(access, name, desc, signature, exceptions);
  mv.visitCode();
  mv.visitVarInsn(Opcodes.ALOAD, 1);
  mv.visitInsn(Opcodes.ARETURN);
  mv.visitMaxs(1, 1);
  mv.visitEnd();
  return null;
}
```

Push argument 1, return it. JaCoCo's instrumenter still runs; it just hands back what it was given.

This shipped as release **1.25.7** — *"#1484 Disable jacoco transformations at bytecode level"* — with a
related fix in **1.25.6**, *"#1481 Auto disable quarkus jacoco extension"*. Both are recent, and both are
reasons to be on a current engine.

⚠️ **What I can and cannot say about the scope of that defence.** The matcher is an exact string equality
on `org/jacoco/core/instr/Instrumenter`. I could not establish from pitest's documentation which JaCoCo
deployment shapes present a class under exactly that name at runtime, and the JaCoCo agent's own classes
are relocated into an `org.jacoco.agent.rt.internal_*` package, which is a different name. So: pitest has
a targeted defence against a class named `org/jacoco/core/instr/Instrumenter`, it was added recently, and
I am not going to claim it covers every way JaCoCo can be attached. The safe configuration does not depend
on the answer.

## The safe configuration: do not run both agents at once

Whatever the transformer covers, running a coverage agent inside a mutation-testing minion is paying for
instrumentation nobody reads. Pitest gathers its own line coverage in its own pre-pass
([02](02-how-it-works.md)); JaCoCo's output from inside a minion is meaningless. Two ways to keep them
apart:

**Separate the executions.** Run JaCoCo in the normal test phase and pitest as its own goal or profile
([05](05-wiring-it-up.md)) — different Maven invocations, so `argLine` is only relevant to one of them.

**Turn off the inheritance for the pitest run.**

```xml
<configuration>
  <parseSurefireArgLine>false</parseSurefireArgLine>
  <jvmArgs>
    <jvmArg>-Xmx2g</jvmArg>
  </jvmArgs>
</configuration>
```

⚠️ And know what you lose. `parseSurefireArgLine=false` drops **everything** in that `argLine`, not just
the agent — the `--add-opens` flags a library needs, a `-D` system property a test reads, a locale or
timezone setting. If your tests depend on any of it, they will fail in the coverage pass and pitest will
stop with *"Mutation testing requires a green suite"* ([05a](05a-before-the-first-run.md)). Restate the
parts you need in pitest's own `jvmArgs`.

`parseSurefireConfig=false` is the bigger hammer: it also drops the excludes, groups, environment
variables and `testFailureIgnore` mapping, which usually makes things worse rather than better.

## The other inheritance worth checking: `testFailureIgnore`

`convertTestFailureIgnore` maps surefire's `<testFailureIgnore>` onto pitest's `skipFailingTests`. That is
a sensible mapping and an alarming one: a build configured to tolerate failing tests hands pitest
permission to do the same, which quietly weakens the green-suite guarantee that makes "a test failed" mean
"the mutant was detected" ([02](02-how-it-works.md)). If your build sets `testFailureIgnore`, know that
pitest inherits it, and know why the guarantee exists before deciding that is fine.

## Where this connects

- **[05 · Wiring it up](05-wiring-it-up.md)** — the POM, and why the goal is not bound to a phase.
- **[05a · Before the first run](05a-before-the-first-run.md)** — the green-suite requirement, and the FAQ's list of surefire/pitest divergences this inheritance exists to reduce.
- **[04d · The statuses that are not findings](04d-the-statuses-that-are-not-findings.md)** — `RUN_ERROR`, which is what an agent that cannot survive being forked hundreds of times produces.
- **[09 · The `argLine` trap](../09-jacoco/02b-the-argline-trap.md)** — how the JaCoCo agent gets into `argLine` in the first place.
- **[09 · How JaCoCo works](../09-jacoco/01b-how-jacoco-works.md)** — agent-based instrumentation, which is the other bytecode transformer in the room.
- **[02 · How it works](02-how-it-works.md)** — pitest's own coverage pass, which is why JaCoCo's is redundant inside a minion.
- **[01b · The tool and its versions](01b-the-tool-and-its-versions.md)** — 1.25.6 and 1.25.7, and the Gradle plugin's default engine version, which predates both.

## Gotchas

**★ Pitest copies your surefire `argLine` into every minion, by default.**
`parseSurefireArgLine` defaults to `true`, and `MojoToReportOptionsConverter` even expands `${...}`
placeholders in it. So every agent, `--add-opens`, system property and memory setting you configured for
surefire is applied to hundreds of short-lived forked JVMs. Most of the time that is what you want; when
it is not, the symptom is a wall of `RUN_ERROR`, which counts as *detected* and therefore raises your
mutation score.

**★ The JaCoCo agent and pitest are two bytecode transformers on the same classes.**
Pitest ships a defence — `DisableJacocoTransformer` replaces `org.jacoco.core.instr.Instrumenter`'s
`instrument([B)[B` with a method that returns its argument — added in 1.25.7 as *"Disable jacoco
transformations at bytecode level"*. It is a targeted fix on an exact class name, not a general
guarantee, and the cleaner arrangement is to not attach a coverage agent to a mutation run at all.

**★ `parseSurefireArgLine=false` drops the whole `argLine`, not just the agent.**
Everything in it goes: `--add-opens`, system properties your tests read, locale and timezone settings,
heap sizes. If any of those matter, the coverage pass fails and pitest stops with *"Mutation testing
requires a green suite"* — which looks like a test problem and is a configuration one. Restate what you
need in pitest's own `jvmArgs`.

**★ Surefire's `<excludes>` are merged into `excludedTestClasses`, and the conversion is textual.**
`convertExcludes` strips `.java` and replaces `/` with `.` to turn a filename pattern into a class glob,
then appends pitest's own exclusions. So a surefire exclusion you forgot about is silently narrowing
pitest's test set — and every excluded test removes coverage, turning mutants into `NO_COVERAGE` and
lowering the score for a reason that is not in the pitest configuration
([02c](02c-timeouts-and-determinism.md)).

**★ Surefire's groups are copied only when pitest has none of its own.**
`convertGroups` checks that pitest's `TestGroupConfig` has no included or excluded groups before copying.
Set either `includedGroups` or `excludedGroups` on pitest and surefire's are ignored entirely — not
merged — so a partial pitest group configuration silently discards the surefire one.

**★ `testFailureIgnore` becomes `skipFailingTests`.**
A build configured to tolerate failing tests hands pitest the same permission, which weakens the
green-suite guarantee that makes "a test failed" mean "the mutant was detected". It is a defensible
mapping and worth noticing, because the inherited setting is invisible in the pitest configuration.

**★ `jvmArgs` configures the minions, not Maven's own JVM.**
Raising Maven's heap does nothing for a `MEMORY_ERROR`, because the failure is in a forked child. The
Gradle plugin makes the distinction explicit with a second property, `mainProcessJvmArgs`
([05b](05b-gradle.md)); Maven has only the one, and it is the children's.

**★ Running JaCoCo inside a pitest run is paying for coverage nobody reads.**
Pitest gathers its own per-test line coverage in a pre-pass, which is the coverage it uses. Whatever a
JaCoCo agent records inside a minion — where classes are being rewritten between tests — is not a number
anyone will look at, and it is instrumentation cost on every one of hundreds of forks.

**★ The JaCoCo and Quarkus fixes are both recent, and the Gradle plugin's default engine predates them.**
1.25.7 disabled JaCoCo transformations and 1.25.6 auto-disabled the Quarkus JaCoCo extension.
`gradle-pitest-plugin` 1.19.0 defaults to PIT 1.22.1, which is before both. Pin `pitestVersion`
([05b](05b-gradle.md)).

## Interview questions

**★ What does the pitest Maven plugin take from your surefire configuration, and why does it matter?**
Five things, all by default: `<excludes>` become `excludedTestClasses` after a textual filename-to-class
conversion and are merged with pitest's own; `<groups>`/`<excludedGroups>` become pitest's group config,
but only if pitest has none; `<testFailureIgnore>` becomes `skipFailingTests`; `<environmentVariables>`
are copied; and `<argLine>` is appended to pitest's, with `${...}` placeholders expanded. It matters
because none of it is visible in the pitest configuration you wrote. The exclusions silently change which
tests provide coverage, and therefore the score; the `testFailureIgnore` mapping quietly weakens the
green-suite guarantee; and the `argLine` copy means every agent attached for surefire is attached to
every one of pitest's forked minions. Both switches — `parseSurefireConfig` and `parseSurefireArgLine` —
default to true, and the mojo's own javadoc says this *"may not give the desired result in some
circumstances"*.

**★ Can you run JaCoCo and PIT in the same build?**
Yes, and the sane arrangement is to keep them in separate invocations rather than to rely on them
coexisting. The problem is that the standard JaCoCo wiring puts its agent into surefire's `argLine`, and
pitest copies `argLine` into every minion by default, so the coverage agent is attached to hundreds of
short-lived forked JVMs where pitest is also rewriting classes after they load. Pitest ships a targeted
defence — since 1.25.7 it transforms `org.jacoco.core.instr.Instrumenter` so its `instrument` method
returns the bytecode it was handed, with the javadoc *"Jacoco instrumentation can cause subtle issues
with coverage tracking"* — but that is an exact class-name match rather than a general guarantee, and in
any case the coverage it would gather inside a minion is meaningless, since pitest uses its own coverage
pass. So: JaCoCo on the test phase, pitest as its own goal or profile, and `parseSurefireArgLine=false`
plus explicit `jvmArgs` if the two must share an invocation.

**★ A pitest run produces hundreds of run errors on a project where the tests pass. Where do you look?**
At the minions' JVM arguments, before anything else. `RUN_ERROR` is the fallback branch of pitest's
exit-code switch — the child JVM died for a reason that was neither a timeout nor an out-of-memory — and
the most common cause on a Maven build is something in the inherited surefire `argLine`: an agent that
does not tolerate being attached to hundreds of short-lived processes, a JVM flag that was valid on the
JDK the build was written for and not on the one CI uses, or a `${...}` property that expanded to nothing.
I would set `parseSurefireArgLine=false`, restate only the flags the tests genuinely need in pitest's
`jvmArgs`, and re-run. And I would note that the reported mutation score was meaningless throughout,
because `RUN_ERROR` counts as detected.

**★ You turn off `parseSurefireArgLine` and now pitest says the suite is not green. What happened?**
You removed more than the agent. That `argLine` typically carries `--add-opens` flags for reflective
libraries, system properties tests read, locale or timezone settings, and heap sizes — and dropping it
drops all of them, so tests that pass under surefire fail in pitest's coverage pass, which stops the run
with *"Mutation testing requires a green suite"*. The fix is to restate the parts you actually need in
pitest's own `jvmArgs`, which is also a useful exercise: it makes explicit what your test suite depends
on, which is usually more than anyone remembers. Turning off `parseSurefireConfig` instead would be worse
— that also drops the excludes, the groups and the environment variables.

{/* FOOTER */}
