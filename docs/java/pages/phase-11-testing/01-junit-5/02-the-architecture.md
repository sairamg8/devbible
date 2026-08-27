---
title: "JUnit is three sub-projects behind one name — a Platform that launches engines, Jupiter which is the programming model you write against, and Vintage which now exists only to run your JUnit 4 backlog — and the split explains every dependency mistake people make"
sidebar_label: "02 · The architecture"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-27 against the JUnit 6.0.3 User Guide — "Overview"
> ([overview](https://docs.junit.org/6.0.3/overview.html)) and the "Dependency Metadata"
> appendix ([appendix](https://docs.junit.org/6.0.3/appendix.html)); artifact set of the
> Boot test starter read from
> [`spring-boot-starter-test-4.1.0.pom`](https://repo1.maven.org/maven2/org/springframework/boot/spring-boot-starter-test/4.1.0/spring-boot-starter-test-4.1.0.pom)
> and the managed version from
> [`spring-boot-dependencies-4.1.0.pom`](https://repo1.maven.org/maven2/org/springframework/boot/spring-boot-dependencies/4.1.0/spring-boot-dependencies-4.1.0.pom).
> JDK 25, Spring Boot 4.1.0, JUnit Jupiter 6.0.3, Spring Framework 7.0.8.

**"JUnit 5" is not one library, and the single most common build failure in this space —
tests compile, tests are green in the IDE, and Maven reports zero tests run — comes
directly from not knowing that. The user guide's own equation is
`JUnit 6.0.3 = JUnit Platform + JUnit Jupiter + JUnit Vintage`, and the three halves of it
have different jobs, different group IDs, and different reasons to be on your classpath.**

## 🔴 Your directory says "JUnit 5". Boot 4.1 resolves Jupiter 6.

This page is in a topic called `01-junit-5`, and the phase README calls it "JUnit 5",
because that is what the ecosystem calls the Jupiter programming model — `@Test` from
`org.junit.jupiter.api`, as opposed to JUnit 4's `org.junit.Test`. **The artefact your
Boot 4.1.0 project actually resolves is version 6.0.3.** `spring-boot-dependencies:4.1.0`
imports `org.junit:junit-bom` at `6.0.3`, and `spring-boot-starter-test:4.1.0` declares a
direct dependency on `org.junit.jupiter:junit-jupiter:6.0.3`.

Nothing on this page or in this topic is written against 5.x. The annotations, the
assertions and the extension model are the same API you already know — JUnit 6 is not a
rewrite — but the baseline, the artifact versions and a list of removals did change, and
that list is [02b](02b-what-junit-6-changed.md). Read it before you copy a `pom.xml` off
the internet.

## The three parts, and what each is for

**JUnit Platform** — group ID `org.junit.platform`. The guide:

> *"The JUnit Platform serves as a foundation for launching testing frameworks on the
> JVM. It also defines the `TestEngine` API for developing a testing framework that runs
> on the platform."*

This is the layer IDEs and build tools talk to. It discovers tests, builds the test tree,
runs listeners, writes reports. It knows nothing about `@Test`.

**JUnit Jupiter** — group ID `org.junit.jupiter`. The guide:

> *"JUnit Jupiter is the combination of the programming model and extension model for
> writing JUnit tests and extensions. The Jupiter sub-project provides a `TestEngine` for
> running Jupiter based tests on the platform."*

Two halves that matter enormously for dependency scoping: `junit-jupiter-api` is what you
*compile against*, `junit-jupiter-engine` is what *runs* your tests. The appendix is blunt
about the second one — `junit-jupiter-engine` is *"JUnit Jupiter test engine
implementation; only required at runtime."*

**JUnit Vintage** — group ID `org.junit.vintage`. It is a `TestEngine` that runs JUnit 3
and JUnit 4 tests on the Platform, and in 6.x the guide attaches a health warning:

> *"Note, however, that the JUnit Vintage engine is deprecated and should only be used
> temporarily while migrating tests to JUnit Jupiter or another testing framework with
> native JUnit Platform support."*

⚠️ **Vintage is not on the Boot test starter's classpath and has not been for years.** If
your project has JUnit 4 tests, adding `junit-vintage-engine` is a deliberate, temporary
act with a deprecation attached to it — not a default.

## The artifacts, and which one you actually declare

From the appendix, all at version 6.0.3:

| Artifact | Group | What it is |
|---|---|---|
| `junit-jupiter` | `org.junit.jupiter` | Aggregator — *"transitively pulls in dependencies on `junit-jupiter-api`, `junit-jupiter-params`, and `junit-jupiter-engine`"* |
| `junit-jupiter-api` | `org.junit.jupiter` | *"API for writing tests and extensions"* — the compile dependency |
| `junit-jupiter-engine` | `org.junit.jupiter` | *"only required at runtime"* |
| `junit-jupiter-params` | `org.junit.jupiter` | Support for parameterized classes and tests |
| `junit-platform-commons` | `org.junit.platform` | Shared support utilities, used by extension authors |
| `junit-platform-launcher` | `org.junit.platform` | *"typically used by IDEs and build tools"* |
| `junit-platform-suite` | `org.junit.platform` | `@Suite` aggregation across engines |
| `junit-vintage-engine` | `org.junit.vintage` | Runs JUnit 3/4 tests — deprecated |
| `junit-bom` | `org.junit` | The BOM that aligns all of the above |

🔴 **`junit-jupiter` is still the aggregate artifact** and it is still what the Boot test
starter depends on. The plan for this topic asked that to be verified rather than
assumed; it is verified — `spring-boot-starter-test:4.1.0` lists
`org.junit.jupiter:junit-jupiter:6.0.3` at compile scope.

## What you write in a Boot 4.1 project

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-test</artifactId>
    <scope>test</scope>
</dependency>
```

That is the whole thing. No version, no `junit-bom` import, no engine declaration —
`spring-boot-dependencies` pins JUnit at 6.0.3, and the starter pulls in Jupiter,
AssertJ 3.27.7, Mockito 5.23.0 and 5.23.0's `mockito-junit-jupiter`, Hamcrest 3.0,
JSONassert 1.5.3, XMLUnit 2.11.0, Awaitility 4.3.0, JSONPath 2.10.0 and `spring-test`.

⚠️ **Every one of those is a version you can override and probably should not.** The
starter's whole value is that these versions were integration-tested together by the Boot
team. Bumping Mockito alone because a blog post mentioned a newer feature is how you end
up debugging a byte-buddy/JDK mismatch instead of your application.

If you are not on Boot, the equivalent is importing the BOM and declaring the aggregate:

```xml
<dependencyManagement>
    <dependencies>
        <dependency>
            <groupId>org.junit</groupId>
            <artifactId>junit-bom</artifactId>
            <version>6.0.3</version>
            <type>pom</type>
            <scope>import</scope>
        </dependency>
    </dependencies>
</dependencyManagement>
```

## Why the split causes the "0 tests run" failure

Discovery is done by the Platform, by asking every `TestEngine` on the classpath what it
can find. If `junit-jupiter-engine` is absent, no engine claims your `@Test` methods, the
test tree is empty, and the build is *green*: zero tests, zero failures, success. Nothing
in the output says "your tests were not run" unless the build is configured to fail on an
empty test set.

The three ways to arrive there:

1. **`junit-jupiter-api` declared alone**, because someone read "you only need the API to
   compile" and stopped. True, and the engine is what runs them.
2. **The engine excluded** from `spring-boot-starter-test` in a misguided slimming
   exercise, or excluded transitively by a dependency-convergence rule.
3. **JUnit 4's `org.junit.Test` imported by accident** — the IDE's auto-import offers
   both, they have the same simple name, and only one of them is claimed by Jupiter.
   Without Vintage on the classpath, those methods are invisible.

🔴 **The diagnosis is always the same and takes ten seconds:** print the dependency tree
and check which engines are present. In Maven, `mvn dependency:tree` and look for
`junit-jupiter-engine`; in Gradle, `gradle dependencies --configuration testRuntimeClasspath`.
If the engine is not there, nothing about your test code is the problem.

## Where Spring plugs in

`spring-test` contributes `SpringExtension`, a Jupiter `Extension` — it is not a runner,
not a rule, and not a fork of the engine. `@SpringBootTest` and every `@…Test` slice are
meta-annotated with `@ExtendWith(SpringExtension.class)`, which is why you never write it
yourself. That is the extension model doing exactly the job it was designed for
([10](10-extensions.md)), and it is the reason Spring's testing support can hook the
context lifecycle without JUnit knowing Spring exists. The slices themselves are
**topic 05 · The test pyramid** *(not written yet)*.

## Gotchas

**★ Declaring `junit-jupiter-api` and nothing else, then reporting "no tests found".**
The API is a compile-time dependency. The engine is a runtime dependency and is what
turns your annotated methods into a test tree. Declare the `junit-jupiter` aggregate, or
declare both explicitly.

**★ Importing `org.junit.Test` instead of `org.junit.jupiter.api.Test`.**
The single most common cause of "my new test does not run". Same simple name, different
package, different engine. Configure the IDE to exclude `org.junit.*` from auto-import in
a Jupiter-only project, and add a Checkstyle `IllegalImport` rule if it keeps recurring.

**★ Mixing JUnit 4 assertions with Jupiter tests.**
`org.junit.Assert.assertEquals(String message, …)` takes the message *first*;
`org.junit.jupiter.api.Assertions.assertEquals(…, String message)` takes it *last*. Both
compile in a `(String, String)` call. The result is a test that asserts the message
against the expected value ([04](04-assertions.md)).

**★ Adding `junit-vintage-engine` "so the old tests still run" and never removing it.**
Vintage is deprecated in 6.x. It is a migration bridge with an expiry date, and its
presence means a second engine discovering a second test tree with different lifecycle
semantics in the same build.

**★ Overriding `junit-jupiter.version` in a Boot project.**
The property exists and Maven will honour it, but you have just left the version set Boot
tested. If you need a newer Jupiter for a specific feature, upgrade Boot instead, or
accept that you own the integration.

**★ Assuming the Platform version tracks Jupiter's minor version separately.**
In 5.x the Platform carried its own major version — Jupiter 5.x alongside Platform 1.x —
and that is gone. JUnit 6 unified them: the release notes list *"Single version number for
Platform, Jupiter, and Vintage"*, and the appendix shows all three sub-projects at 6.0.3.
Any build script that derives a Platform version from a Jupiter version by rewriting the
major number is now producing a version that does not exist.

**★ Adding `junit-platform-launcher` to application code.**
It is the API IDEs and build tools use to run tests. Depending on it from your own test
sources is a sign you are building a bespoke runner; almost always the real answer is
`@Suite` from `junit-platform-suite`, or tags ([07](07-disabling-and-conditions.md)).

**★ Excluding transitive test dependencies to "shrink the build".**
The test classpath is not shipped. Trimming it buys nothing at runtime and costs you the
next hour when a slice test fails on a `NoClassDefFoundError` for JSONPath.

## Interview questions

**★ What are the three parts of JUnit 5/6 and what does each do?**
The Platform launches test engines, defines the `TestEngine` API, builds the test tree and
owns discovery, reporting and the launcher API that IDEs and build tools use. Jupiter is
the programming model and extension model you write tests against, plus the engine that
runs them. Vintage is an engine that runs JUnit 3 and 4 tests on the Platform, and it is
deprecated in 6.x.

**★ A colleague says the build shows "Tests run: 0" but the IDE runs the tests fine. What
is your first move?**
Look at the test runtime classpath for a Jupiter engine. The IDE frequently supplies its
own engine and launcher, so it can run tests the build cannot see. `mvn dependency:tree`
or the Gradle equivalent settles it in seconds, and it is nearly always either a missing
`junit-jupiter-engine` or `@Test` imported from `org.junit`.

**★ Which JUnit artifacts do you declare in a Spring Boot 4.1 project?**
None individually. `spring-boot-starter-test` at test scope brings Jupiter, AssertJ,
Mockito, Hamcrest, JSONassert, XMLUnit, Awaitility and `spring-test`, all at versions
`spring-boot-dependencies` pins — JUnit at 6.0.3 in Boot 4.1.0.

**★ What is the difference between `junit-jupiter-api` and `junit-jupiter-engine`?**
The API holds the annotations, `Assertions`, `Assumptions` and the extension interfaces —
what your source compiles against, and what a published extension library should depend
on. The engine is the implementation that discovers and executes Jupiter tests, and the
appendix marks it as required only at runtime. Getting this wrong in one direction gives
you a compile error; in the other it gives you a silent zero-test build.

**★ Is `SpringExtension` a special integration inside the engine?**
No, and that is the point. It is an ordinary Jupiter `Extension` implementing several
callback interfaces, registered by `@ExtendWith` — which every `@…Test` annotation carries
as a meta-annotation. Spring gets the context lifecycle it needs through the same public
API any third party can use.

**★ Why is Vintage deprecated, and what should a team with 3,000 JUnit 4 tests do?**
Vintage exists to buy migration time, not to be a permanent second engine, and the guide
now says so. A team with a large JUnit 4 estate keeps Vintage while it migrates, writes
all *new* tests in Jupiter, and treats the Vintage dependency as a tracked item with an
owner — because when it is finally removed in a future major version, "we'll do it later"
becomes an unplanned emergency.

{/* FOOTER */}
