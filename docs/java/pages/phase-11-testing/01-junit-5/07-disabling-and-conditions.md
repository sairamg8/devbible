---
title: "@Disabled is one implementation of ExecutionCondition and nothing more, which explains why disabling a method still instantiates the class and runs @BeforeAll, why the reason string is the only part of it that has any long-term value, and why a disabled test is a decision you have deferred rather than made"
sidebar_label: "07 · Disabling and conditions"
sidebar_position: 16
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-27 against the JUnit 6.0.3 User Guide — "Disabling Tests"
> ([disabling-tests](https://docs.junit.org/6.0.3/writing-tests/disabling-tests.html)),
> "Conditional Test Execution"
> ([conditional-test-execution](https://docs.junit.org/6.0.3/writing-tests/conditional-test-execution.html))
> and the extension-model page of the same name
> ([extensions/conditional-test-execution](https://docs.junit.org/6.0.3/extensions/conditional-test-execution.html));
> javadoc for `@Disabled`
> ([Disabled](https://docs.junit.org/6.0.3/api/org.junit.jupiter.api/org/junit/jupiter/api/Disabled.html))
> and `TestExecutionListener`
> ([TestExecutionListener](https://docs.junit.org/6.0.3/api/org.junit.platform.launcher/org/junit/platform/launcher/TestExecutionListener.html)).
> JDK 25, Spring Boot 4.1.0, JUnit Jupiter 6.0.3, Spring Framework 7.0.8.

**There is one mechanism here, not two. `@Disabled` is not special-cased in the engine: it
is handled by a built-in `ExecutionCondition` called `DisabledCondition`, exactly like
`@EnabledOnOs` and exactly like a condition you write yourself. Once you know that, the
surprising behaviours stop being surprising — the class is still constructed, `@BeforeAll`
still runs, the reason string is the only thing that reaches a human, and a second
`@Disabled`-family annotation on the same element may be silently ignored.**

This chunk is `@Disabled` itself and the discipline around it. The rules that govern the
whole condition family — how several conditions combine, why none of them is inherited,
and the built-in catalogue — are
[07b · the built-in conditions](07b-the-built-in-conditions.md), and writing your own is
[07d · custom conditions](07d-custom-conditions.md) and
[07e · `ExecutionCondition` and deactivation](07e-executioncondition-and-deactivation.md).

## The one sentence that defines the family

> *"Entire test classes or individual test methods may be disabled via the `@Disabled`
> annotation, via one of the annotations discussed in Conditional Test Execution, or via a
> custom `ExecutionCondition`."*

> *"The `ExecutionCondition` extension API in JUnit Jupiter allows developers to either
> enable or disable a test class or test method based on certain conditions
> programmatically. The simplest example of such a condition is the built-in
> `DisabledCondition` which supports the `@Disabled` annotation."*

`@Disabled` is a condition that is always disabled. `@EnabledOnOs(LINUX)` is a condition
that consults `os.name`. Your own `ExecutionCondition` is a condition that consults
whatever you like. They are registered the same way, evaluated at the same point, and
combine by the same rule.

## `@Disabled`, and what it does not stop

```java
@Disabled("Disabled until bug #99 has been fixed")
class DisabledClassDemo {

    @Test
    void testWillBeSkipped() {
    }

}
```

```java
class DisabledTestsDemo {

    @Disabled("Disabled until bug #42 has been resolved")
    @Test
    void testWillBeSkipped() {
    }

    @Test
    void testWillBeExecuted() {
    }

}
```

Class level is total:

> *"When `@Disabled` is applied at the class level, all test methods within that class are
> automatically disabled as well."*

Method level is emphatically **not**:

> *"If a test method is disabled via `@Disabled`, that prevents execution of the test
> method and method-level lifecycle callbacks such as `@BeforeEach` methods, `@AfterEach`
> methods, and corresponding extension APIs. However, that does not prevent the test class
> from being instantiated, and it does not prevent the execution of class-level lifecycle
> callbacks such as `@BeforeAll` methods, `@AfterAll` methods, and corresponding extension
> APIs."*

The same paragraph appears verbatim in the `@Disabled` javadoc and again in the
conditional-execution guide for *every* built-in condition, which is how much the JUnit
team wants you to read it. Concretely: a class whose ten test methods are each
`@Disabled` still starts your Testcontainers container, still boots your Spring context,
still constructs the test class ten times, and still contributes its `@BeforeAll` cost to
the build. Only `@Disabled` **on the class** makes the container inert. This is the
mechanism behind the trap in [03 · the lifecycle](03-the-lifecycle.md).

## The reason string is the whole feature

> *"`@Disabled` may be declared without providing a reason; however, the JUnit team
> recommends that developers provide a short explanation for why a test class or test
> method has been disabled … Some development teams even require the presence of issue
> tracking numbers in the reason for automated traceability, etc."*

The reason is not decoration; it is the payload that reaches the report. The Launcher's
listener contract is explicit about it:

> *"`executionSkipped(TestIdentifier testIdentifier, String reason)` — Called when the
> execution of a leaf or subtree of the `TestPlan` has been skipped. … `reason` — a
> human-readable message describing why the execution has been skipped."*

A bare `@Disabled` produces a skip with no explanation, in a report read by someone who
was not in the room. Six months later nobody can tell whether the test was flaky, whether
the feature was pulled, or whether it was disabled "for five minutes" during a rebase.
The rule that survives contact with a team: **the reason names an issue and the issue
exists.**

```java
@Disabled("flaky under parallel execution — JIRA-4821")
@Test
void reconcilesConcurrentRefunds() { }
```

## What "skipped" actually looks like to the report

> *"The `TestIdentifier` may represent a test or a container. In the case of a container,
> no listener methods will be called for any of its descendants."*

> *"A skipped test or subtree of tests will never be reported as started or finished."*

So `@Disabled` on a class produces **one** skipped container, not one skipped test per
method — the descendants are never announced at all. `@Disabled` on ten methods produces
ten skipped tests. Two ways of doing what looks like the same thing, with different
numbers in the CI dashboard, and a "skipped test count" alert that only fires for one of
them.

This is also the difference from tag exclusion ([06e](06e-tag-expressions-and-filtering.md)):
a filtered-out test is never in the plan and is never reported; a disabled test is in the
plan and is reported as skipped with a reason.

## `@Disabled` is not inherited

> *"`@Disabled` is not `@Inherited`. Consequently, if you wish to disable a class whose
> superclass is `@Disabled`, you must redeclare `@Disabled` on the subclass."*

An abstract base class carrying `@Disabled` disables the base class's own tests — of which
there are usually none, since an abstract class is not a test class — and disables nothing
in the subclasses that actually run. The same rule holds for every conditional annotation
([07b](07b-the-built-in-conditions.md)) and is the exact opposite of `@Tag`, which **is**
`@Inherited` ([06d](06d-tagging.md)). One base class, two annotations, two inheritance
behaviours.

## The discipline: a disabled test is a deferred decision

`@Disabled` is a tool with exactly one honest use: **this test is temporarily not able to
tell the truth, and here is the ticket.** Every other use rots.

- A test disabled because it is flaky is a bug report you have muted
  ([14 · flaky tests](14-flaky-tests.md)).
- A test disabled because the feature changed should have been **deleted or rewritten** —
  the version control history keeps the old one if you ever want it back.
- A test disabled because "it fails on the build server" is the most expensive of all: the
  build server is the environment that matters, and the test was right.

Two practices that keep the graveyard small:

1. **Every `@Disabled` carries an issue key**, and a periodic sweep closes or deletes.
   Cheap to enforce in review; grep-able in CI.
2. **Prefer a real condition to a disable.** "Does not run on Windows" is
   `@DisabledOnOs(WINDOWS)`, which is a permanent, documented, reported fact about the
   test. `@Disabled("windows")` is a hole in every developer's local run.

And the reason to be careful with the second: a conditional annotation that is almost
always false is a disabled test wearing a costume. If `@EnabledIfEnvironmentVariable(named
= "RUN_NIGHTLY", matches = "true")` is set nowhere, the test has never run and nothing
says so.

## Running the disabled tests anyway

Conditions can be switched off for a run without touching the code:

> *"Sometimes it can be useful to run a test suite without certain conditions being active.
> For example, you may wish to run tests even if they are annotated with `@Disabled` in
> order to see if they are still broken. To do this, provide a pattern for the
> `junit.jupiter.conditions.deactivate` configuration parameter to specify which conditions
> should be deactivated (i.e., not evaluated) for the current test run."*

```
-Djunit.jupiter.conditions.deactivate=org.junit.*DisabledCondition
```

That is the guide's own example, and it is the single most useful thing on this page for
an actual codebase: a scheduled "do the disabled tests still fail?" job costs one system
property and turns the graveyard back into information. `*` deactivates every condition.
Full details of the mechanism and of the pattern syntax are in
[07e](07e-executioncondition-and-deactivation.md).
## Gotchas

**★ `@Disabled` on every method to "turn off" an expensive class.**
The class is still instantiated and `@BeforeAll`/`@AfterAll` and their extension callbacks
still run, so the container still starts and the context still boots. Put `@Disabled` on
the class.

**★ A bare `@Disabled` with no reason.**
It compiles, it skips, and it tells the next reader nothing. The reason string is the only
part of the annotation that reaches the report — `executionSkipped` takes it as its
`reason` parameter.

**★ Expecting a disabled class to report ten skipped tests.**
It reports one skipped container; the listener contract says no listener methods are
called for any descendant of a skipped container. Dashboards that count skipped *tests*
will show the number dropping when someone consolidates ten method-level disables into one
class-level disable.

**★ Assuming `@Disabled` is inherited.**
It is not, and neither is any conditional annotation — the javadoc says so in as many
words. A `@Disabled` abstract base class does not disable its subclasses, while a
`@Tag` on the same base class *does* apply to them.

**★ Disabling a flaky test instead of diagnosing it.**
The flake is still in production code or in the test's shared state; you have only stopped
being told about it. [14 · flaky tests](14-flaky-tests.md) is the alternative.

**★ Leaving a disabled test in the tree for a year.**
It no longer compiles against the intent of the code, it is never run, and it will be
"fixed" by deleting it anyway. Delete it now, while the history still explains why.

**★ `@Disabled` on a `@Nested` class, expecting the outer class to skip too.**
Disabling flows down the container tree, never up. The enclosing class's `@BeforeAll` and
its other nested classes are unaffected
([06c](06c-nesting-lifecycle-and-limits.md)).

## Interview questions

**★ Is `@Disabled` handled specially by the engine?**
No. It is implemented by a built-in `ExecutionCondition` — `DisabledCondition` — which the
guide names as the simplest example of the API. Everything true of conditions in general is
true of `@Disabled`: evaluation point, short-circuiting, non-inheritance, and the ability to
deactivate it by configuration parameter.

**★ A test method is `@Disabled`. What still executes?**
The test class is still instantiated, and class-level lifecycle callbacks — `@BeforeAll`,
`@AfterAll` and the corresponding extension APIs — still run. What is prevented is the test
method itself and the method-level callbacks: `@BeforeEach`, `@AfterEach` and their
extension equivalents.

**★ What is the difference between skipping a test and filtering it out?**
A skipped test is in the test plan: the Launcher reports `executionSkipped` with a
human-readable reason, and the test appears in the report. A filtered test — excluded by a
tag expression — was removed by a post-discovery filter and is not in the plan at all, so
nothing is reported for it.


**★ When is `@Disabled` the right answer, and when is it not?**
Right: a test that cannot currently tell the truth, with a ticket in the reason string and
a date by which it is fixed or deleted. Wrong: environment-dependence (use a condition,
which is documented and reported), flakiness (fix the shared state), and "the feature
changed" (delete the test — git remembers it).

**★ How would you check whether your disabled tests still fail?**
Run the suite with `-Djunit.jupiter.conditions.deactivate=org.junit.*DisabledCondition`.
The guide gives this exact example. Nothing in the source changes, `DisabledCondition` is
simply not evaluated, and the disabled tests execute for real.

{/* FOOTER */}
