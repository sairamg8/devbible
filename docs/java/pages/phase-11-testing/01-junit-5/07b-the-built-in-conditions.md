---
title: "The org.junit.jupiter.api.condition package is a catalogue of declarative conditions that narrow rather than widen, that are never inherited, and that are silently ignored when you declare the same one twice — and on JUnit 6 its JRE half moved its default floor to Java 17"
sidebar_label: "07b · The built-in conditions"
sidebar_position: 17
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-27 against the JUnit 6.0.3 User Guide — "Conditional Test Execution"
> ([conditional-test-execution](https://docs.junit.org/6.0.3/writing-tests/conditional-test-execution.html)),
> the extension-model page of the same name
> ([extensions/conditional-test-execution](https://docs.junit.org/6.0.3/extensions/conditional-test-execution.html))
> and "Release Notes" ([release-notes](https://docs.junit.org/6.0.3/release-notes.html),
> the 6.0.0 Jupiter section); javadoc for `@EnabledForJreRange`
> ([EnabledForJreRange](https://docs.junit.org/6.0.3/api/org.junit.jupiter.api/org/junit/jupiter/api/condition/EnabledForJreRange.html))
> and `JRE`
> ([JRE](https://docs.junit.org/6.0.3/api/org.junit.jupiter.api/org/junit/jupiter/api/condition/JRE.html)).
> JDK 25, Spring Boot 4.1.0, JUnit Jupiter 6.0.3, Spring Framework 7.0.8.

**Everything in `org.junit.jupiter.api.condition` is a declarative front-end to the same
`ExecutionCondition` API that powers `@Disabled` ([07](07-disabling-and-conditions.md)).
Three rules govern all of them — they combine by short-circuiting OR on "disabled", none of
them is `@Inherited`, and most of them may be declared only once per element with any
extra declaration silently discarded — and then there is a catalogue, whose JRE half
changed its defaults in JUnit 6.**

This chunk is the three rules and the two *platform* conditions — operating system and JRE
version. The conditions driven by the surrounding environment (native image, system
properties, environment variables) and the composed-annotation pattern are
[07c · environment conditions](07c-environment-conditions.md); writing your own is
[07d · custom conditions](07d-custom-conditions.md) and
[07e · `ExecutionCondition` and deactivation](07e-executioncondition-and-deactivation.md).

## How multiple conditions combine

> *"When multiple `ExecutionCondition` extensions are registered, a test class or test
> method is disabled as soon as one of the conditions returns disabled."*

And the extension-model page says exactly what that implies:

> *"Thus, there is no guarantee that a condition is evaluated because another extension
> might have already caused a container or test to be disabled. In other words, the
> evaluation works like the short-circuiting boolean OR operator."*

Two consequences worth holding on to:

- **Conditions are ORed on "disabled", not ANDed on "enabled".** `@EnabledOnOs(LINUX)`
  plus `@EnabledOnJre(JAVA_25)` runs the test only on Linux *and* Java 25 — because each
  annotation independently votes to disable, and one veto is enough.
- **A condition with a side effect may not run.** If your custom `ExecutionCondition`
  provisions something, starts a clock or writes a file, it may be short-circuited away by
  an earlier condition on a given day and not on another. Conditions must be pure
  predicates.

## Two rules people get wrong in class hierarchies

**Nothing in this family is inherited.**

> *"`@Disabled` is not `@Inherited`. Consequently, if you wish to disable a class whose
> superclass is `@Disabled`, you must redeclare `@Disabled` on the subclass."*

> *"Conditional annotations in JUnit Jupiter are not `@Inherited`. Consequently, if you
> wish to apply the same semantics to subclasses, each conditional annotation must be
> redeclared on each subclass."*

Note how badly this pairs with `@Tag`, which **is** `@Inherited` ([06d](06d-tagging.md)).
An abstract base class annotated `@Tag("slow") @DisabledOnOs(WINDOWS)` gives its
subclasses the tag and not the condition.

**A repeated conditional annotation is silently ignored.**

> *"Unless otherwise stated, each of the conditional annotations listed in the following
> sections can only be declared once on a given test interface, test class, or test
> method. If a conditional annotation is directly present, indirectly present, or
> meta-present multiple times on a given element, only the first such annotation
> discovered by JUnit will be used; any additional declarations will be silently ignored.
> Note, however, that each conditional annotation may be used in conjunction with other
> conditional annotations in the `org.junit.jupiter.api.condition` package."*

Read "indirectly present, or meta-present" carefully: this fires when you combine a
composed annotation with an explicit one. `@TestOnMac` (itself meta-annotated
`@EnabledOnOs(MAC)`) plus a hand-written `@EnabledOnOs(LINUX)` on the same method is not
"Mac or Linux" — it is whichever JUnit finds first, and the other is discarded with no
diagnostic. The exceptions, documented as repeatable, are the system-property and
environment-variable conditions ([07b](07b-the-built-in-conditions.md)).
## Operating system and architecture

> *"A container or test may be enabled or disabled on a particular operating system,
> architecture, or combination of both via the `@EnabledOnOs` and `@DisabledOnOs`
> annotations."*

```java
@Test
@EnabledOnOs(MAC)
void onlyOnMacOs() { }

@Test
@EnabledOnOs({ LINUX, MAC })
void onLinuxOrMac() { }

@Test
@DisabledOnOs(WINDOWS)
void notOnWindows() { }

@Test
@EnabledOnOs(value = MAC, architectures = "aarch64")
void onNewMacs() { }

@Test
@DisabledOnOs(architectures = "x86_64")
void notOnX86_64() { }
```

Two attributes on one annotation, and the combination reads as an AND: `value = MAC` plus
`architectures = "aarch64"` is Apple silicon only. The `architectures` strings are the
values of the `os.arch` system property, which is a JVM- and platform-specific string —
`aarch64` and `x86_64` are the two you will meet, but nothing validates what you type.

The idiomatic use of these is a **path-separator or file-permission** test, not a business
test. If `@DisabledOnOs(WINDOWS)` is appearing on service-layer tests, the service is
reading `File.separator` or `/tmp` somewhere it should not be.

## The JRE conditions, and what JUnit 6 changed here

> *"A container or test may be enabled or disabled on particular versions of the Java
> Runtime Environment (JRE) via the `@EnabledOnJre` and `@DisabledOnJre` annotations or on
> a particular range of versions of the JRE via the `@EnabledForJreRange` and
> `@DisabledForJreRange` annotations."*

```java
@Test
@EnabledOnJre(JAVA_17)
void onlyOnJava17() { }

@Test
@EnabledOnJre({ JAVA_17, JAVA_21 })
void onJava17And21() { }

@Test
@EnabledForJreRange(min = JAVA_21, max = JAVA_25)
void fromJava21To25() { }

@Test
@DisabledForJreRange(min = JAVA_19)
void notOnJava19AndHigher() { }
```

Because the `JRE` enum is frozen at each release, JUnit also accepts bare integers:

> *"Since the enum constants defined in `JRE` are static for any given JUnit release, you
> might find that you need to configure a Java version that is not supported by the `JRE`
> enum. … you can specify arbitrary Java versions via the `versions` attributes in
> `@EnabledOnJre` and `@DisabledOnJre` and via the `minVersion` and `maxVersion`
> attributes in `@EnabledForJreRange` and `@DisabledForJreRange`."*

```java
@Test
@EnabledOnJre(versions = 26)
void onlyOnJava26() { }

@Test
@EnabledForJreRange(minVersion = 25, maxVersion = 27)
void fromJava25To27() { }
```

**Two things changed in 6.0**, both from the release notes:

> *"The `JRE` enum constants for `JAVA_8` to `JAVA_16` have been deprecated because they
> can no longer be used at runtime since `JAVA_17` is the new baseline. Please also
> manually update any values used with the `minVersion` and `maxVersion` attributes … to
> ensure that you are no longer declaring version values less than 17."*

> *"`@EnabledForJreRange` and `@DisabledForJreRange` now use `JAVA_17` as their default
> `min` value."*

🔴 **This settles a question [02b](02b-what-junit-6-changed.md) had to leave open.** The
6.0.3 user-guide prose still contains the pre-6 sentence *"The range effectively defaults
to `JRE.JAVA_8` as the lower bound and `JRE.OTHER` as the upper bound"*, which contradicts
the release notes. The javadoc for `@EnabledForJreRange` is the tie-breaker and agrees with
the release notes:

> *"[`min`] Defaults to `UNDEFINED`, which will be interpreted as `JAVA_17` if the
> `minVersion` is not set."*

> *"[`max`] Defaults to `UNDEFINED`, which will be interpreted as `OTHER` if the
> `maxVersion` is not set."*

So on JUnit 6 the implicit range is **`JAVA_17` … `OTHER`**, the user guide's prose on that
one point is stale, and `@DisabledForJreRange(max = JAVA_21)` now means 17–21 rather than
8–21. Writing the bound you mean explicitly remains the advice that is correct under every
reading.

## Gotchas

**★ Combining a composed conditional annotation with an explicit one of the same type.**
Only the first one JUnit discovers is used; the rest are silently ignored. Two
`@EnabledOnOs` on one method is not a union, it is a coin toss you cannot see.

**★ Treating two conditions as "enabled if either passes".**
They are not ORed on enabled; they are ORed on **disabled**. Any single condition
returning disabled short-circuits the rest, so multiple conditions always narrow, never
widen.

**★ A custom `ExecutionCondition` with a side effect.**
Short-circuiting means it may never be evaluated. Anything that must happen belongs in a
callback ([10 · extensions](10-extensions.md)), not in a condition.
**★ Reading `@EnabledForJreRange(max = JAVA_21)` as "Java 8 through 21".**
On JUnit 6 the default `min` is `JAVA_17`, not `JAVA_8`. The user guide's prose still says
`JAVA_8`; the javadoc and the release notes say `JAVA_17`, and they win. Write both bounds.

**★ Using a deprecated `JRE` constant that cannot run the test anyway.**
`@EnabledOnJre(JAVA_11)` compiles with a deprecation warning and can never be true — JUnit
6 requires Java 17 at runtime, so no JUnit 6 test ever executes on a JRE 11.

**★ Putting business logic in `@EnabledIf…` on a service test.**
An OS or JRE condition on a test of *your* domain logic is a signal that the domain logic
depends on the platform. Fix that instead; the condition hides it.

**★ Assuming `architectures` is validated.**
It is a plain string matched against the JVM's `os.arch`. A typo produces a condition that
is simply never true, silently.

## Interview questions

**★ How do multiple conditions combine?**
Like a short-circuiting boolean OR over "disabled". As soon as one condition returns
disabled, the element is disabled and the remaining conditions may not be evaluated at all.
The practical reading is that conditions can only ever narrow the set of tests that run.

**★ Why must a condition be free of side effects?**
Because the guide states there is no guarantee a given condition is evaluated — an earlier
condition may already have disabled the element. A condition that provisions a resource or
mutates state will do so unpredictably from run to run.
**★ What changed about the JRE conditions in JUnit 6?**
The `JRE` enum constants `JAVA_8` through `JAVA_16` are deprecated, because Java 17 is the
runtime baseline and those JREs can no longer run JUnit at all; and the default `min` for
`@EnabledForJreRange` / `@DisabledForJreRange` moved to `JAVA_17`. The javadoc states the
default as `UNDEFINED` interpreted as `JAVA_17`; the user guide's prose still says
`JAVA_8` and is stale on that point.

{/* FOOTER */}
