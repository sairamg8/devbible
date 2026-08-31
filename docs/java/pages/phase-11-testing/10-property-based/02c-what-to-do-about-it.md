---
title: "There are exactly four things a team on Spring Boot 4.1 can do about jqwik's Platform version, one of them is not really an option, and the one to reach for first is a five-minute spike whose only job is to make a deliberately-failing property go red"
sidebar_label: "02c · What to do about it"
sidebar_position: 6
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-08-31 against the **jqwik 1.10.1 user guide**, sections *How to Use*,
> *Using Arbitraries Directly* and *jqwik Configuration*
> ([jqwik.net](https://jqwik.net/docs/current/user-guide.html)); the **Maven Surefire
> `test` mojo** documentation for default include patterns
> ([maven.apache.org](https://maven.apache.org/surefire/maven-surefire-plugin/test-mojo.html));
> `spring-boot-starter-parent-4.1.0.pom` and `spring-boot-dependencies-4.1.0.pom` on
> **Maven Central**; and `net.jqwik:jqwik-spring`'s `maven-metadata.xml` and
> `jqwik-spring-0.12.0.pom` on Maven Central.
> Version spine: JDK 25, Spring Boot 4.1.0, Spring Framework 7.0.8, JUnit Jupiter 6.0.3,
> AssertJ 3.27.7.
> ⚠️ **No sandbox, no build and no test run on this machine.** The build files below are
> written from published POMs and documented plugin defaults; none of them has been executed
> here, and the whole point of option 0 is that you execute one of them yourself.

**[02b](02b-the-version-collision.md) laid out the collision and
[02b2](02b2-what-the-evidence-shows.md) laid out how far the evidence goes. This chunk is
the decision. There are four responses available to a team on Boot 4.1 — prove it, isolate
it, downgrade, or use jqwik without its engine — and they are not equally good. One is a
five-minute experiment that converts every "probably" in the last two chunks into a fact
about your build; one is the architecture you want anyway; and one is closed off by Spring's own
baseline. The fourth — using jqwik's generators without its engine, and what that costs —
is [02c2](02c2-jqwik-without-its-engine.md).**

## Option 0 — prove it, in one commit, before anything else

Do not read further options until you have run this. It costs less than the meeting about it.

Add the dependency to the existing test scope:

```xml
<dependency>
  <groupId>net.jqwik</groupId>
  <artifactId>jqwik</artifactId>
  <version>1.10.1</version>
  <scope>test</scope>
</dependency>
```

Then write a property that **must** fail, in a class whose *file name* the runner will
actually pick up:

```java
package com.example.spike;

import net.jqwik.api.ForAll;
import net.jqwik.api.Property;

import static org.assertj.core.api.Assertions.assertThat;

/** Deliberately failing. Delete once the engine has been proven to run. */
class JqwikSmokeTests {                       // "Tests", not "Properties" — see below

    @Property
    void thisMustGoRed(@ForAll int anInt) {
        assertThat(anInt).isEqualTo(4711);
    }
}
```

Three outcomes, and each one tells you something different:

- **Red, with jqwik's own report block** — a table of `tries`, `checks`, `generation`,
  `seed`, and a `Shrunk Sample` section. This is the outcome you want, and it proves far
  more than "the dependency resolved": discovery ran, execution ran, falsification was
  detected, and *shrinking* ran, which exercises most of the engine.
- **An exception during discovery or execution** — typically a `NoSuchMethodError` or a
  `ServiceConfigurationError` naming an `org.junit.platform` type. That is the
  incompatibility, stated directly. Stop, and go to option 1 or the fallback in [02c2](02c2-jqwik-without-its-engine.md).
- **🔴 Green** — the dangerous outcome. Green means the property never ran. Diagnose in this
  order: (1) the class name does not match the runner's include patterns; (2) the build
  filtered the engine out; (3) `jqwik-engine` is not on the test runtime classpath. All three
  are covered in [02c3 · Wiring it into the build](02c3-wiring-it-into-the-build.md).

Alongside it, resolve the Platform version explicitly so the number is in the PR
description rather than in someone's head:

```
mvn dependency:tree -Dincludes=org.junit.platform
```

## Option 1 — isolate the properties in a module that does not import Boot's BOM

This is the recommendation, and not only as a workaround. Property-based testing pays on
pure domain logic — parsers, money, date arithmetic, comparators, state machines — which is
exactly the code that has no business depending on Spring in the first place. Putting the
properties in a module that cannot see Spring is a constraint you want.

The mechanism is simple: Boot's version management arrives through
`spring-boot-starter-parent` (or an imported `spring-boot-dependencies`). A module that
declares neither is not subject to `junit-bom:6.0.3`, and can import
`org.junit:junit-bom:5.14.4` instead, giving `junit-platform-*` at `1.14.4` — precisely what
jqwik declares.

```xml
<!-- domain-properties/pom.xml : a leaf test module, NOT inheriting spring-boot-starter-parent -->
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <parent>
    <groupId>com.example</groupId>
    <artifactId>example-aggregator</artifactId>   <!-- a plain aggregator, no Boot parent -->
    <version>1.0.0-SNAPSHOT</version>
  </parent>
  <artifactId>domain-properties</artifactId>

  <properties>
    <maven.compiler.release>25</maven.compiler.release>
    <maven.compiler.parameters>true</maven.compiler.parameters>
  </properties>

  <dependencyManagement>
    <dependencies>
      <dependency>
        <groupId>org.junit</groupId>
        <artifactId>junit-bom</artifactId>
        <version>5.14.4</version>      <!-- Platform 1.14.4 — jqwik's declared floor -->
        <type>pom</type>
        <scope>import</scope>
      </dependency>
    </dependencies>
  </dependencyManagement>

  <dependencies>
    <dependency>
      <groupId>com.example</groupId>
      <artifactId>domain</artifactId>   <!-- the pure module under test; no Spring -->
      <version>${project.version}</version>
    </dependency>
    <dependency>
      <groupId>net.jqwik</groupId>
      <artifactId>jqwik</artifactId>
      <version>1.10.1</version>
      <scope>test</scope>
    </dependency>
    <dependency>
      <groupId>org.assertj</groupId>
      <artifactId>assertj-core</artifactId>
      <version>3.27.7</version>
      <scope>test</scope>
    </dependency>
  </dependencies>
</project>
```

Two things this buys beyond avoiding the collision. First, the *next* Boot upgrade cannot
break your properties, because they are no longer coupled to Boot's dependency management at
all — and given the maintainer's stated uncertainty about a Platform 6 release, that
insulation is the whole ballgame. Second, the module physically cannot import
`org.springframework`, so nobody can accidentally write a property that needs a context and
discover halfway through that `SpringExtension` is unavailable.

The cost is honest and worth stating: a second Maven module, a second JUnit version in the
reactor, and a domain module that must actually be separable. If your domain logic lives in
`@Service` classes with `@Autowired` collaborators, this option is blocked until you extract
it — which is a good change, but it is not a free one.

## Option 2 — downgrade JUnit across the project (do not)

Setting `<junit-jupiter.version>5.14.4</junit-jupiter.version>` in a Boot-parented POM does
resolve Platform back to `1.14.4`, and it is closed off from above. The Spring Framework 7.0
release notes list **JUnit 6** among 7.0's baseline upgrades, and Boot 4.1 sits on Framework
7.0.8. Downgrading puts every Spring test in the project — slices, `MockMvcTester`,
`@MockitoBean`, the whole TestContext framework — onto a JUnit version Spring no longer
supports, in exchange for removing a risk confined to one library. It converts a question
mark into a certainty, in the wrong direction. The argument is developed in
[02b2](02b2-what-the-evidence-shows.md).

## The fourth option, and the one that is not an option

If option 0 goes green-that-means-nothing or throws, and option 1 is blocked because the
domain logic is not separable, there is still a degraded mode: use jqwik's arbitraries as a
plain generator library from inside ordinary Jupiter tests. It works, it is documented, and
it costs you shrinking and seed reproducibility. That, plus why `net.jqwik:jqwik-spring` is
not a route on this stack and what I could not settle about alternative libraries, is
[02c2 · jqwik without its engine](02c2-jqwik-without-its-engine.md).

## Where this connects

- The collision itself and the primary sources for it are
  [02b · The version collision](02b-the-version-collision.md); how far the evidence goes is
  [02b2 · What the evidence shows](02b2-what-the-evidence-shows.md).
- The generator-only fallback, jqwik-spring, and the alternatives question are
  [02c2 · jqwik without its engine](02c2-jqwik-without-its-engine.md).
- The build wiring every option needs — Surefire's include patterns, `-parameters`,
  `junit-platform.properties`, and the file jqwik writes into your working directory — is
  [02c3 · Wiring it into the build](02c3-wiring-it-into-the-build.md).
- Once it runs, start at [03 · Writing a property](03-a-property.md).
- The shrinking that option 3 gives up is [06 · Shrinking](06-shrinking.md); the seed
  machinery it also gives up is [07 · Reproducibility](07-reproducibility.md).

## Gotchas

**★ The smoke property must fail, not pass — a passing smoke test cannot distinguish "ran and passed" from "never ran".**
This is the single most important sentence on the page. `@Property void alwaysTrue(@ForAll int i) { assertThat(i).isEqualTo(i); }`
is green whether the engine executed it a thousand times or never looked at the class, and
teams have adopted jqwik, written forty properties and discovered months later that Surefire
never picked up a single one. A deliberately-failing property makes "did not run" and
"passed" distinguishable, which is the only thing you are trying to establish. Delete it in
the same PR that adds the first real property.

**★ Isolating the properties into their own module is only possible if the domain logic is already separable, and finding out that it is not is itself the finding.**
If your `PriceCalculator` cannot be constructed without a Spring context, option 1 is blocked
— and the reason it is blocked is that the code with laws worth asserting is entangled with
code that has no laws. That is a design report, not an obstacle. The extraction it forces
(pure calculation class, thin `@Service` that wires it) is the same extraction the
property-based testing literature has always argued for, arrived at from the build side.

**★ A second JUnit version in the same Maven reactor is legal and confusing, and it needs a comment.**
Maven resolves dependencies per module, so `domain-properties` on `junit-bom:5.14.4` and
`api-service` on Boot's `6.0.3` coexist without conflict. What does not coexist is the mental
model of the next person, who will see two JUnit versions in `mvn dependency:tree` output and
assume it is a mistake. Put the reason in the POM as a comment naming the jqwik constraint
and the release note, or somebody will "fix" it.

**★ `mvn dependency:tree` without `-Dincludes` is useless for this and everybody runs it that way.**
A Boot service's dependency tree is hundreds of lines and the JUnit Platform entries are
buried three levels down under `spring-boot-starter-test` and under `jqwik`. Run
`mvn dependency:tree -Dincludes=org.junit.platform` and you get four lines, one of which will
say something like `junit-platform-commons:jar:6.0.3:test (version managed from 1.14.4)`.
That parenthetical is the entire finding, and it is invisible in the unfiltered output.

**★ Putting the properties in their own module means they are not in the module Sonar, JaCoCo and your default `mvn test` are pointed at.**
A separate module has separate reports. Coverage attributed to `domain` from tests in
`domain-properties` requires the aggregate report configuration, and a CI job whose test
stage runs `mvn -pl api-service test` will not run your properties at all. This is the
option-1 version of the green-build-that-ran-nothing failure, and it deserves the same
treatment: a deliberately-failing property, once, to prove the module is in the pipeline.

## Interview questions

**★ Walk me through how you would introduce jqwik to an existing Spring Boot 4.1 codebase, from first commit to first real property.**
Commit one is a spike and contains exactly two things: the `net.jqwik:jqwik:1.10.1` test
dependency and a single deliberately-failing property in a class named to match the runner's
include patterns. Its acceptance criterion is that CI goes **red** with a jqwik report block
showing a shrunk sample — that proves discovery, execution, falsification and shrinking all
work against JUnit Platform 6.0.3, which nothing in the documentation of either project
guarantees. If it goes green, I debug the wiring, not the library. Commit two moves the
properties into a module that does not inherit `spring-boot-starter-parent` and imports
`org.junit:junit-bom:5.14.4`, so jqwik gets the Platform 1.14.4 it declares and the next Boot
upgrade cannot break it. Commit three deletes the smoke property and adds the first real one,
against pure domain code — bill splitting, a parser, a comparator. At no point do I add jqwik
to the module that has Spring in it, because `SpringExtension` is a Jupiter extension and
jqwik is not Jupiter.

**★ Your architect asks why the property tests live in a separate Maven module. Answer without mentioning version conflicts.**
Because properties are about laws, and laws live in the domain, not in the wiring. A module
that contains no Spring cannot contain a property that needs a database or an HTTP request,
which means the constraint enforces the thing we would otherwise have to enforce in review:
that a property is a statement about a pure function. It also makes the module's dependency
list a specification — if `domain-properties` needs to depend on `spring-context` to compile,
that is a signal the domain logic has leaked into the framework layer and should be pulled
back out. The version isolation is a genuine second benefit, but I would sell it on the first
one, because the first one survives whatever the library situation looks like in two years.

**★ Option 0 comes back green. Talk me through the diagnosis.**
Green on a property that asserts `anInt == 4711` means it never executed, so I am debugging
discovery, not jqwik. First, the class file name against the runner's include patterns —
Surefire's documented defaults are `**/Test*.java`, `**/*Test.java`, `**/*Tests.java` and
`**/*TestCase.java`, so `BillProperties.java` is never handed to any engine. That is the cause
in most cases and it is invisible because nothing reports a skip. Second, engine filtering:
under Gradle, `useJUnitPlatform { includeEngines 'junit-jupiter' }` silently excludes every
other engine, and jqwik's own documentation shows you have to name `'jqwik'` there. Third,
classpath: `jqwik-engine` is a *runtime*-scoped dependency of the `net.jqwik:jqwik`
aggregator, so nothing in your test source references it and an IDE or a dependency-pruning
plugin can drop it while the code still compiles. Only after all three would I suspect the
Platform 6 question, and I would settle that with
`mvn dependency:tree -Dincludes=org.junit.platform` rather than by guessing.

{/* FOOTER */}
