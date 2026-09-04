---
title: "Surefire's default include patterns never match a class called BillProperties, Gradle's includeEngines is an allow-list that silently drops any engine you forget to name, and the engine jar arrives at runtime scope where nothing in your source proves it is there — the three wiring facts behind almost every build that is green because nothing ran"
sidebar_label: "02c3 · Wiring it into the build"
sidebar_position: 8
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-08-31 against the **Maven Surefire plugin `test` mojo** documentation for
> the default `includes`
> ([maven.apache.org](https://maven.apache.org/surefire/maven-surefire-plugin/test-mojo.html));
> the **jqwik 1.10.1 user guide**, sections *Gradle*, *Maven*, *jqwik Configuration*,
> *Tagging Tests* and *Naming and Labeling Tests*
> ([jqwik.net](https://jqwik.net/docs/current/user-guide.html)); and
> `spring-boot-starter-parent-4.1.0.pom` on **Maven Central** for the compiler
> configuration Boot applies.
> Version spine: JDK 25, Spring Boot 4.1.1, Spring Framework 7.0.9, JUnit Jupiter 6.0.3.
> ⚠️ **No sandbox, no build and no test run on this machine.** Build configuration below is
> written from published plugin documentation and published POMs; none of it has been
> executed here.

**A jqwik property that is never handed to any engine produces exactly the same build output
as one that passed: nothing. That is the failure mode this chunk exists to prevent, and it
has three common causes — a class name the runner's include patterns do not match, an engine
filter that excluded jqwik without saying so, and an engine jar that is not on the runtime
classpath. All three are configuration, all three are silent, and all three are fixable in
one line once you know which one you have. This page covers all three, plus the one compiler
flag that decides whether the failure report you eventually get is readable; the settings
file, the run database and jqwik's own annotations are
[02c4 · The configuration surface](02c4-jqwiks-configuration-surface.md).**

## Cause 1 — the class name, and it is nearly always this one

Maven Surefire's `test` mojo documents its default include patterns as:

```xml
<includes>
    <include>**/Test*.java</include>
    <include>**/*Test.java</include>
    <include>**/*Tests.java</include>
    <include>**/*TestCase.java</include>
</includes>
```

`BillProperties.java` matches none of them. Surefire never scans the class, no engine is ever
offered it, and the build is green. Nothing in the output says "1 class skipped", because
from Surefire's point of view there was never a test class there at all.

Every jqwik tutorial names its classes `SomethingProperties`, because jqwik's own Gradle
sample configures Gradle to pick them up:

```groovy
test {
    useJUnitPlatform {
        includeEngines 'jqwik', 'junit-jupiter'
    }
    include '**/*Properties.class'
    include '**/*Test.class'
    include '**/*Tests.class'
}
```

Two choices on Maven, and you must make one of them deliberately:

```xml
<!-- Choice A: teach Surefire the convention -->
<plugin>
  <groupId>org.apache.maven.plugins</groupId>
  <artifactId>maven-surefire-plugin</artifactId>
  <configuration>
    <includes>
      <include>**/Test*.java</include>
      <include>**/*Test.java</include>
      <include>**/*Tests.java</include>
      <include>**/*TestCase.java</include>
      <include>**/*Properties.java</include>   <!-- the added line -->
    </includes>
  </configuration>
</plugin>
```

```java
// Choice B: adopt a name Surefire already matches, and say why in the file
class BillPropertyTests { /* jqwik properties; named *Tests so Surefire picks it up */ }
```

Choice B is fewer moving parts and survives someone else editing the POM. Choice A reads
better in a test report. What is not acceptable is neither, because the failure is invisible.

⚠️ Note that overriding `<includes>` **replaces** the defaults rather than adding to them —
if you write only `**/*Properties.java` in that block, you have just switched off every
ordinary test in the module.

## Cause 2 — an engine filter that does not name jqwik

`useJUnitPlatform` with an `includeEngines` list is an allow-list. A Gradle build that
already has `includeEngines 'junit-jupiter'` — a common thing to find, added years ago to
exclude Vintage — will not run jqwik, and will not say so. The fix is to name both, as the
sample above does. `excludeEngines` has the same trap in reverse. The engine id to use is
`jqwik`, which is what `net.jqwik.engine.JqwikTestEngine` reports.

Maven Surefire has no equivalent allow-list by default — it hands discovered classes to
every engine on the classpath — but a project that has configured `<groups>` or
`<excludedGroups>` is filtering by *tag*, and jqwik's `@Tag` is a different annotation from
Jupiter's with the same simple name (see
[02c4](02c4-jqwiks-configuration-surface.md)), so a tag-filtered build can exclude properties
for a different reason that produces an identical symptom.

## Cause 3 — the engine is not on the runtime classpath

`net.jqwik:jqwik` is an aggregator POM. It brings `jqwik-api`, `jqwik-web` and `jqwik-time`
at **compile** scope and `jqwik-engine` at **runtime** scope. Your test source references
only `jqwik-api`, so nothing you wrote will fail to compile if `jqwik-engine` disappears —
which is exactly the condition under which "unused dependency" analysers and over-eager
manual exclusions remove it. If you are declaring the modules individually rather than using
the aggregate, the guide's own explicit form is:

```groovy
testImplementation "net.jqwik:jqwik-api:1.10.1"
testImplementation "net.jqwik:jqwik-web:1.10.1"
testImplementation "net.jqwik:jqwik-time:1.10.1"
testRuntime       "net.jqwik:jqwik-engine:1.10.1"
```

`jqwik-engine` at runtime scope is the thing that registers the `TestEngine` service. Without
it you have a generator library and no engine — which is
[02c2](02c2-jqwik-without-its-engine.md), reached by accident.

## `-parameters`, and why Boot gives it to you and a standalone module does not

jqwik's failure report names the parameters it falsified. It can only use their real names
if the class was compiled with `-parameters`; the guide says so directly:

> *"The source code names of property method parameters can only be reported when compiler
> argument `-parameters` is used."*

Without it, a report identifies parameters as `arg0`, `arg1` — technically sufficient,
practically miserable when a property has four `@ForAll` parameters and you are reading a
shrunk sample at 2am.

`spring-boot-starter-parent:4.1.0` configures `maven-compiler-plugin` with
`<parameters>true</parameters>`, so a module that inherits the Boot parent already has this.
A standalone properties module — [option 1 in 02c](02c-what-to-do-about-it.md) — does
**not**, and must set it itself:

```xml
<properties>
  <maven.compiler.parameters>true</maven.compiler.parameters>
</properties>
```

On Gradle, jqwik's own sample does it explicitly:

```groovy
compileTestJava {
    // To enable argument names in reporting and debugging
    options.compilerArgs += '-parameters'
}
```

## What else comes with the dependency

Wiring it so that properties *run* is this page. Wiring it so that a failure is *reproducible*
— the configuration file, the `.jqwik-database`, and the annotations whose simple names
collide with Jupiter's — is [02c4 · jqwik's configuration surface](02c4-jqwiks-configuration-surface.md).

## Where this connects

- The three options that this wiring supports are
  [02c · What to do about it](02c-what-to-do-about-it.md); the generator-only fallback is
  [02c2 · jqwik without its engine](02c2-jqwik-without-its-engine.md).
- The engine-id and `ServiceLoader` mechanics behind cause 3 are
  [02 · An engine, not an extension](02-the-stack-problem.md).
- Surefire, Gradle and the Platform's own configuration parameters belong to
  [01 · JUnit 5](../01-junit-5/README.md), which owns build wiring for the whole phase.
- The configuration file, the run database and jqwik's own annotations are
  [02c4 · jqwik's configuration surface](02c4-jqwiks-configuration-surface.md); after-failure
  modes and seeds are [07 · Reproducibility](07-reproducibility.md), and tries versus runtime
  is [12 · The cost](12-the-cost.md).

## Gotchas

**★ Overriding Surefire's `<includes>` replaces the defaults; it does not extend them.**
Adding a `<includes>` block containing only `**/*Properties.java` switches off every
`*Test`/`*Tests` class in the module — and the build stays green, because those tests were
passing. You have to restate all four defaults alongside the new pattern. This is the second
silent-green trap on the same page, caused by fixing the first one carelessly.

**★ `includeEngines` is an allow-list, so adding jqwik to a project that already restricts engines is a two-line change, not a one-line one.**
A Gradle build with `useJUnitPlatform { includeEngines 'junit-jupiter' }` — added years ago
to keep Vintage out — will discover jqwik's engine, decline to run it, and report nothing. The
symptom is identical to the class-name problem, and so is the diagnosis: a deliberately
failing property that goes green.

**★ `jqwik-engine` is runtime-scoped, so nothing in your source code proves it is on the classpath.**
Your test file imports `net.jqwik.api.Property` and compiles perfectly against `jqwik-api`
alone. The engine is discovered by `ServiceLoader` at runtime. Any tool that reports
"declared but unused dependencies" will flag the aggregate, and any developer tidying up a
POM can remove it without a compile error anywhere. If your build has a dependency-analysis
gate, add an explicit `usedDependency` exception with a comment.

**★ Without `-parameters` a shrunk sample is labelled `arg0`, `arg1`, and the report becomes much less useful exactly when you need it most.**
It is not a failure — the values are still there — but a four-parameter property whose shrunk
sample reads `arg0: 0`, `arg1: ""`, `arg2: []`, `arg3: 3` forces you back to the source to map
positions to meanings, at the moment you are trying to understand a defect. Boot's parent POM
sets it; a standalone module does not; a Gradle build does not unless you add it. Check it
once, on the module that holds the properties.

**★ The three silent-green causes are ordered by frequency, and people diagnose them in exactly the wrong order.**
The instinct on a green build with no properties in it is to suspect the library — the newest,
least familiar thing in the change. In practice it is almost always the class name, then the
engine filter, then the classpath, and only then anything about jqwik itself. Checking in
frequency order takes about ninety seconds; starting from "is jqwik compatible with JUnit 6"
takes an afternoon and does not answer the question you actually have.

**★ Renaming a property class to end in `Tests` makes it look like an example test in every report, IDE tree and coverage tool you own.**
Choice B has a real cost that nobody mentions: the naming convention was carrying information
— *this class contains properties, read it differently* — and you have deleted it to satisfy a
pattern in a build plugin. If you take choice B, put the word back somewhere it survives:
`BillPropertyTests` rather than `BillTests`, or a `@Label("Bill · properties")` on the class,
which jqwik uses for the display name in reports.

## Interview questions

**★ A team says "we tried jqwik, it didn't work, the tests just never ran." Diagnose it over a call, without seeing the repo.**
I would ask three questions in order. What are the test classes called? If the answer is
`SomethingProperties`, that is it — Maven Surefire's documented default include patterns are
`**/Test*.java`, `**/*Test.java`, `**/*Tests.java` and `**/*TestCase.java`, none of which
matches, so the class is never scanned and no engine is ever offered it. Second: is this
Gradle, and does the build have an `includeEngines` line? If it names only `junit-jupiter`,
jqwik is excluded by an allow-list somebody wrote years ago for a different reason. Third: is
`jqwik-engine` actually on the test runtime classpath? It comes in at runtime scope through
the `net.jqwik:jqwik` aggregate, so it can be removed without breaking compilation. All three
produce identical symptoms — a green build with no properties in it — which is why the first
thing I would have them add is a property that asserts something false.

{/* FOOTER */}
