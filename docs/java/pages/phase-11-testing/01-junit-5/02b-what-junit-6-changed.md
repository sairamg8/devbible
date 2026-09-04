---
title: "JUnit 6 is not a rewrite of the Jupiter programming model but it is a hard Java 17 baseline, a unified version number and a long list of removals — and the removals are exactly the APIs a five-year-old test module is most likely to still be using"
sidebar_label: "02b · What JUnit 6 changed"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-27 against the JUnit 6.0.3 User Guide — "Release Notes"
> ([release-notes](https://docs.junit.org/6.0.3/release-notes.html), the 6.0.0 section)
> and "Overview / Supported Java Versions"
> ([overview](https://docs.junit.org/6.0.3/overview.html)); managed version read from
> [`spring-boot-dependencies-4.1.0.pom`](https://repo1.maven.org/maven2/org/springframework/boot/spring-boot-dependencies/4.1.0/spring-boot-dependencies-4.1.0.pom).
> JDK 25, Spring Boot 4.1.1, JUnit Jupiter 6.0.3, Spring Framework 7.0.9.

**JUnit 6.0.0 was released on 30 September 2025 and Boot 4.1.0 manages 6.0.3. If you have
been writing Jupiter tests, essentially none of your test code changes: `@Test`,
`@BeforeEach`, `Assertions`, `@Nested`, `@ExtendWith` and the callback interfaces are the
same types in the same packages with the same semantics. What changed is the runtime
floor, the version numbering, a handful of ordering guarantees, and a removal list that
bites build infrastructure and custom extensions rather than tests.**

## The baseline

> *"JUnit requires Java 17 (or higher) at runtime. However, you can still test code that
> has been compiled with previous versions of the JDK."*

Read the second sentence carefully. The **JVM running the tests** must be 17+; the
`--release` level of your production classes is a separate question. Testing a library
still compiled for Java 11 is fine, as long as the test JVM is 17 or newer. On this
phase's stack — JDK 25 — the constraint is invisible.

Two consequences the release notes spell out:

- *"The `JRE` enum constants for `JAVA_8` to `JAVA_16` have been deprecated because they
  can no longer be used at runtime since `JAVA_17` is the new baseline."* Anything
  matching `@EnabledOnJre(JAVA_11)` is now a deprecated constant naming a JRE that cannot
  run the test in the first place.
- *"`@EnabledForJreRange` and `@DisabledForJreRange` now use `JAVA_17` as their default
  `min` value."*

⚠️ **The 6.0.3 user guide text on JRE conditions still says the range "effectively
defaults to `JRE.JAVA_8` as the lower bound".** That sentence contradicts the release
notes' statement about the new `JAVA_17` default. I could not reconcile the two from the
documentation alone, so treat the default as unsettled and **write the bound you mean
explicitly** — `@EnabledForJreRange(min = JAVA_21)` rather than relying on either
answer. That advice is correct under both readings.

## One version number

The release notes list *"Single version number for Platform, Jupiter, and Vintage"* and
*"Platform artifacts now use the same version number as Jupiter and Vintage artifacts."*
`junit-platform-commons`, `junit-jupiter-api` and `junit-vintage-engine` are all 6.0.3.
The `1.x` Platform line is over.

The practical fallout is in build files that hard-coded two properties:

```xml
<!-- 5.x era: two coordinated but different numbers -->
<junit.jupiter.version>5.11.4</junit.jupiter.version>
<junit.platform.version>1.11.4</junit.platform.version>
```

```xml
<!-- 6.x: import the BOM and stop tracking either -->
<dependency>
    <groupId>org.junit</groupId>
    <artifactId>junit-bom</artifactId>
    <version>6.0.3</version>
    <type>pom</type>
    <scope>import</scope>
</dependency>
```

## Removals that hit real projects

The 6.0.0 notes list a long set of removals. The ones with a realistic chance of being in
your repository:

- 🔴 **`junit-platform-runner` is gone.** That is the module that provided the JUnit 4
  `JUnitPlatform` runner — `@RunWith(JUnitPlatform.class)`, the bridge that let a JUnit 4
  runner execute Jupiter tests in tools that only understood JUnit 4. Any class still
  carrying that annotation will not compile.
- 🔴 **`MethodOrderer.Alphanumeric` is removed.** Its replacement is
  `MethodOrderer.MethodName` (see [11](11-execution-order.md)). This one appears in
  copy-pasted "run my tests in order" snippets constantly.
- **`junit-platform-jfr` is gone**; the Flight Recorder events moved into
  `junit-platform-launcher`.
- **`junit-platform-suite-commons` is gone**, folded into `junit-platform-suite`.
- **Support for Maven Surefire/Failsafe below 3.0.0 has been removed.** An old Surefire
  pinned in a parent POM stops working.
- **The `junit.jupiter.tempdir.scope` configuration parameter is no longer supported**
  ([09](09-tempdir-and-resources.md)).
- **`InvocationInterceptor.interceptDynamicTest(Invocation, ExtensionContext)`** is
  removed — an extension-author concern.
- **`junit-jupiter-migrationsupport` is deprecated** (not yet removed) *"and will be
  removed in the next major version"*. That is the module providing `@Ignore` support and
  selected JUnit 4 rules.
- **Legacy field/method search semantics are gone.** The notes:
  *"JUnit now always adheres to standard Java semantics regarding whether a given field or
  method is visible or overridden according to the rules of the Java language."* The
  `junit.platform.reflection.search.useLegacySemantics` escape hatch no longer exists.

## Behaviour changes you can actually observe

**`@Nested` classes are now ordered deterministically.** *"For consistency with test
methods, `@Nested` classes declared in the same enclosing class or interface are now
ordered in a deterministic but intentionally nonobvious way."* If a suite was accidentally
depending on declaration order of nested classes, it was already broken; now it is broken
differently, and consistently.

**`@TestMethodOrder` is inherited by `@Nested` classes.** *"`@TestMethodOrder`
annotations specified on a test class are now inherited by its `@Nested` inner classes,
recursively."* This is a real semantic change: a class-level `@TestMethodOrder` that used
to stop at the outer class now applies all the way down. `MethodOrderer.Default` and
`ClassOrderer.Default` were added so a nested class can opt back out
([11](11-execution-order.md)).

**Invalid enum-valued configuration parameters now fail rather than being ignored.**
Discovery or execution fails for a bad value of, among others,
`junit.jupiter.execution.parallel.mode.default`, `junit.jupiter.execution.timeout.mode`,
`junit.jupiter.tempdir.cleanup.mode.default` and
`junit.jupiter.testinstance.lifecycle.default`. A typo in `junit-platform.properties` that
5.x silently swallowed is now a build failure — which is an improvement, arriving as a
surprise.

**Control characters in display names are replaced.** *"Non-printable control characters
in display names are now replaced with alternative representations. For example, `\n` is
replaced with `<LF>`."* ([06](06-naming-and-display-names.md).)

**Stack traces are pruned to the test method.** *"Stack traces are now pruned up to the
test method or lifecycle method."* Less framework noise in a failure report by default.

**CSV parsing switched from univocity-parsers to FastCSV**, with knock-on changes to
malformed-input handling, the removal of `@CsvFileSource`'s `lineSeparator` attribute, and
stricter rejection of characters after a closing quote. That is **topic 03 ·
Parameterized tests** *(not written yet)* territory; it is listed here because it is the
one area where 6.0 genuinely changed observable behaviour for ordinary test code.

## New things worth knowing about

- **JSpecify nullability annotations across every module** — *"All JUnit modules now use
  JSpecify nullability annotations to indicate which method parameters, return types, etc.
  can be null."* Kotlin and null-checking tools now see accurate nullability on the JUnit
  API.
- **`CancellationToken`** — execution can be cancelled cooperatively through the
  `Launcher`, and `--fail-fast` on the ConsoleLauncher is built on it.
- **`ExtensionContext.Store.computeIfAbsent(…)`** replaces the deprecated
  `getOrComputeIfAbsent(…)` family ([10b](10b-writing-one.md)).
- **Kotlin `suspend` functions** are supported as test and lifecycle methods.

## What did *not* change

The list is longer than the list above, and it is the reason this topic does not need a
migration chapter: `@Test`, `@BeforeEach`, `@BeforeAll`, `@AfterEach`, `@AfterAll`,
`@Nested`, `@Tag`, `@Disabled`, `@DisplayName`, `@TempDir`, `@Timeout`, `@TestInstance`,
`@ExtendWith`, `@RegisterExtension`, every `Assertions` method, every `Assumptions`
method, the eight lifecycle callback interfaces, `ParameterResolver`,
`ExecutionCondition`, `InvocationInterceptor`, and the parallel-execution configuration
parameters are all present with unchanged semantics. Code written against Jupiter 5.10
compiles and behaves the same on 6.0.3 unless it touches something on the removal list.

## Gotchas

**★ Reading a "JUnit 5" tutorial and copying its dependency block.**
It will pin `junit-jupiter` at a 5.x version and very likely add a separate
`junit-platform` version property. On Boot 4.1 you declare no version at all; off Boot,
you import `junit-bom:6.0.3`.

**★ `@RunWith(JUnitPlatform.class)` left on a class from the migration era.**
`junit-platform-runner` was removed in 6.0.0. The class does not compile. It was already
unnecessary the moment your build tool learned to talk to the Platform directly.

**★ `@TestMethodOrder(MethodOrderer.Alphanumeric.class)`.**
Removed. Use `MethodOrderer.MethodName`. And then ask why the tests need an order at all
([11](11-execution-order.md)).

**★ A class-level `@TestMethodOrder` that now leaks into `@Nested` classes.**
In 5.x it stopped at the declaring class. In 6.x it is inherited recursively. A nested
class whose methods happened to run in a workable order can start running in `@Order`
order — where every method has the default order value — with different results.

**★ A typo in `junit-platform.properties` that used to be ignored.**
`junit.jupiter.execution.parallel.mode.default = concurent` was silently ignored in 5.x
and fails discovery in 6.x. Good change; still a build that suddenly goes red on an
upgrade with an error message about a configuration parameter nobody remembers setting.

**★ Assuming Vintage will keep the JUnit 4 estate alive indefinitely.**
Vintage is deprecated in 6.x and `junit-jupiter-migrationsupport` is deprecated *"and
will be removed in the next major version"*. The JUnit 4 exit has a schedule now.

**★ `@EnabledOnJre(JAVA_11)` and friends.**
Deprecated constants for JREs that cannot run JUnit 6 at all. If the intent was "skip on
old Java", the condition is dead code; if the intent was a version range, state the bound
explicitly with `min`/`max` or the numeric `minVersion`/`maxVersion` attributes.

**★ Extensions compiled against 5.x that call `Store.getOrComputeIfAbsent(…)`.**
Still present but deprecated in favour of `computeIfAbsent(…)`. They still work; they will
not forever, and the new methods have better behaviour with non-nullable types.

**★ A parent POM pinning Surefire 2.22.x.**
Support for Surefire/Failsafe below 3.0.0 was removed in 6.0.0. This is the upgrade
blocker most likely to be outside the module you are actually upgrading.

## Interview questions

**★ Is JUnit 6 a rewrite?**
No. It is a maintenance major: a Java 17 runtime baseline, one version number across
Platform/Jupiter/Vintage, JSpecify nullability annotations, and a batch of removals of
things deprecated during 5.x. The programming model — annotations, assertions, extension
interfaces — is unchanged, which is why the ecosystem still says "JUnit 5" when it means
"the Jupiter model".

**★ What Java version does JUnit 6 require?**
Java 17 or higher at runtime. The guide adds that you can still test code compiled with
earlier JDKs — the constraint is on the JVM executing the tests, not on the bytecode
level of the classes under test.

**★ Name three things removed in 6.0.0 that would break a real project.**
`junit-platform-runner` (so `@RunWith(JUnitPlatform.class)` no longer compiles),
`MethodOrderer.Alphanumeric`, and support for Maven Surefire/Failsafe below 3.0.0. The
`junit.jupiter.tempdir.scope` configuration parameter is a fourth.

**★ What changed about `@Nested` classes in 6.0?**
Two things. They are now ordered deterministically relative to their siblings — the same
"deterministic but intentionally nonobvious" algorithm already used for methods — and a
`@TestMethodOrder` on an enclosing class is now inherited by nested classes recursively.
`MethodOrderer.Default` and `ClassOrderer.Default` exist so a nested class can revert to
default ordering when its enclosing class specifies an orderer.

**★ Why does a bad value in `junit-platform.properties` now fail the build?**
Because 6.0 made invalid values of the enum-based configuration parameters — parallel
mode, timeout mode, temp-dir cleanup mode, test instance lifecycle and others — fail
discovery or execution instead of being ignored. Silently ignoring a misspelled parallel
mode meant a suite that people believed was running in parallel and was not.

**★ Your team is on Boot 4.1 and someone proposes pinning JUnit to the newest release on
junit.org. What do you say?**
That the version to run is the one `spring-boot-dependencies` manages — 6.0.3 for Boot
4.1.0 — because that is the combination Boot's own test suite validated against
`spring-test`, Mockito and AssertJ. Overriding it is a supportable decision only if there
is a specific defect or feature driving it and someone owns the consequences.

{/* FOOTER */}
