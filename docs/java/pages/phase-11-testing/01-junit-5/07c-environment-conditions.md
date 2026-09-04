---
title: "The environment-driven conditions read a property, a variable or the presence of a native image, and each of them has the same failure mode: when the thing they read is absent the test is disabled, so a condition nobody sets is a test nobody runs"
sidebar_label: "07c · Environment conditions"
sidebar_position: 18
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-27 against the JUnit 6.0.3 User Guide — "Conditional Test Execution"
> ([conditional-test-execution](https://docs.junit.org/6.0.3/writing-tests/conditional-test-execution.html));
> javadoc for `TestExecutionListener`
> ([TestExecutionListener](https://docs.junit.org/6.0.3/api/org.junit.platform.launcher/org/junit/platform/launcher/TestExecutionListener.html)).
> JDK 25, Spring Boot 4.1.1, JUnit Jupiter 6.0.3, Spring Framework 7.0.9.

**[07b](07b-the-built-in-conditions.md) covered the conditions that read the platform — the
OS and the JRE — which are facts about the machine that nobody has to remember to set.
This chunk covers the ones that read the *environment*: a system property, an environment
variable, or a GraalVM native image. They are far more useful and far more dangerous,
because every one of them silently disables the test when the thing it reads is missing,
and "missing" is the default state of a variable that only one CI job sets.**

## Native image

> *"A container or test may be enabled or disabled within a GraalVM native image via the
> `@EnabledInNativeImage` and `@DisabledInNativeImage` annotations. These annotations are
> typically used when running tests within a native image using the Gradle and Maven
> plug-ins from the GraalVM Native Build Tools project."*

```java
@Test
@DisabledInNativeImage
void neverWithinNativeImage() { }
```

The realistic use is the inverse of what people assume: you do not usually *enable* tests
only in a native image, you *disable* the handful that use reflection, dynamic proxies or
resource loading that the closed-world image does not support, so that the native test run
is green and meaningful rather than green because it never ran.

## System properties and environment variables

> *"A container or test may be enabled or disabled based on the value of the named JVM
> system property via the `@EnabledIfSystemProperty` and `@DisabledIfSystemProperty`
> annotations. The value supplied via the `matches` attribute will be interpreted as a
> regular expression."*

```java
@Test
@EnabledIfSystemProperty(named = "os.arch", matches = ".*64.*")
void onlyOn64BitArchitectures() { }

@Test
@DisabledIfSystemProperty(named = "ci-server", matches = "true")
void notOnCiServer() { }

@Test
@EnabledIfEnvironmentVariable(named = "ENV", matches = "staging-server")
void onlyOnStagingServer() { }

@Test
@DisabledIfEnvironmentVariable(named = "ENV", matches = ".*development.*")
void notOnDeveloperWorkstation() { }
```

⚠️ **`matches` is a regular expression, and it is a full match, not a search** — the
guide's own `.*64.*` example only makes sense that way. `matches = "true"` therefore does
not match `"TRUE"` or `" true"`. And an **absent** property or variable disables the test:
there is nothing to match against.

These four are the exception to the declared-once rule:

> *"`@EnabledIfSystemProperty` and `@DisabledIfSystemProperty` are repeatable annotations.
> Consequently, these annotations may be declared multiple times on a test interface, test
> class, or test method."*

The same sentence appears for the environment-variable pair. Repeated declarations are
each evaluated, so — consistent with the short-circuiting-OR-on-disabled rule — two
`@EnabledIfSystemProperty` annotations mean **both** must match.

## `disabledReason`, on every one of them

> *"If you wish to provide details about why they might be disabled, every annotation
> associated with these built-in conditions has a `disabledReason` attribute available for
> that purpose."*

```java
@Test
@DisabledOnOs(value = WINDOWS, disabledReason = "uses POSIX file permissions")
void setsOwnerOnlyPermissions() { }
```

That string lands in the same `executionSkipped(TestIdentifier, String reason)` callback
as `@Disabled`'s reason ([07](07-disabling-and-conditions.md)). Without it, the report says
a test was skipped and leaves the reader to infer why from the annotation — which they
cannot do, because the report does not carry the annotation.

## Composed annotations

> *"Note that any of the conditional annotations listed in the following sections may also
> be used as a meta-annotation in order to create a custom composed annotation."*

```java
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
@Test
@EnabledOnOs(MAC)
@interface TestOnMac {
}
```

This is the guide's own example and it folds `@Test` in as well, so `@TestOnMac` *is* a
test. It is also the construct that walks straight into the declared-once rule: a method
annotated `@TestOnMac` and `@EnabledOnOs(LINUX)` has two `@EnabledOnOs` — one meta-present,
one directly present — and one of them is discarded without a word. That rule, and the
short-circuiting-OR rule it interacts with, are stated in
[07b](07b-the-built-in-conditions.md).

## Gotchas

**★ `matches = "true"` failing against `TRUE`.**
`matches` is a regular expression evaluated as a full match. Case, whitespace and partial
values all fail. Use `matches = "(?i)true"` or `.*true.*` deliberately, not by accident.

**★ An unset environment variable enabling a test.**
It disables it. `@EnabledIfEnvironmentVariable` with nothing to read is a disabled test —
which is exactly the "condition that is never true" failure: the test has never run and
nothing in the build says so.

**★ Forgetting `disabledReason`.**
Every built-in condition has the attribute and almost nobody sets it. The report then shows
a skip with no explanation, which is indistinguishable from a bare `@Disabled`.
**★ A condition that is true in exactly one CI job, and nowhere else.**
`@EnabledIfEnvironmentVariable(named = "RUN_NIGHTLY", matches = "true")` is a disabled test
in every other run, including every developer's. If that job is ever renamed, retired or
silently broken, the test stops running and nothing goes red. Every environment-gated test
needs a run that actually sets the variable, and somebody who would notice if it stopped.

**★ Gating a test on a system property that Surefire never forwards.**
The condition reads the *test JVM's* properties. A `-D` on the Maven command line does not
reach a forked Surefire JVM unless it is passed through `systemPropertyVariables` or
`argLine`; the property is absent in the fork, and the test disables itself while the
build log shows you setting it.

**★ Using `@DisabledInNativeImage` as a substitute for making the code native-friendly.**
Every test you exclude from the native image run is behaviour the native image is not
tested for. That is sometimes the right trade, but it must be a decision with a
`disabledReason`, not a way of getting the native build green.

**★ A composed annotation that hides a condition from the reader.**
`@IntegrationTest` that quietly means `@EnabledIfEnvironmentVariable(...)` is convenient
until somebody wonders why their new integration test never runs. Name the annotation after
what it gates, and set `disabledReason` inside it.

## Interview questions

**★ Which conditional annotations are repeatable, and what does repeating them mean?**
The system-property and environment-variable pairs — `@EnabledIfSystemProperty`,
`@DisabledIfSystemProperty`, `@EnabledIfEnvironmentVariable`,
`@DisabledIfEnvironmentVariable`. Each declaration is evaluated, and because any single
"disabled" verdict wins, repeating an `@EnabledIf…` means every one of them must match.
All the others follow the declared-once rule and silently ignore extra declarations.

**★ How is `matches` interpreted?**
As a regular expression, matched against the whole value of the named property or
variable. If the property is not set at all, the condition disables the test.

**★ Why is `disabledReason` worth setting on a condition that looks self-explanatory?**
Because the annotation is not in the report. All the reader gets is a skipped test and a
reason string; if you did not supply one, they get a skipped test. The attribute exists on
every built-in condition precisely so that the report can explain itself.
**★ What is the practical difference between `@Disabled` and an environment condition?**
`@Disabled` is a statement about the test ("this test cannot currently tell the truth").
An environment condition is a statement about where the test is meaningful ("this test
needs a staging server"). The first should be temporary and carry a ticket; the second is
permanent and must be paired with a run that satisfies it, or it is a `@Disabled` that
nobody can see.

**★ You inherit a suite where a third of the tests are gated on environment variables. How
do you find out which of them ever run?**
Run the suite with the conditions deactivated —
`-Djunit.jupiter.conditions.deactivate=*` ([07e](07e-executioncondition-and-deactivation.md)) — and compare
the executed-test count with a normal run. Anything that only appears in the deactivated
run has been disabled in practice, whatever the annotation claims.

{/* FOOTER */}
