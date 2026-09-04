---
title: "An assumption aborts a test instead of failing it, which puts a third outcome — ABORTED, distinct from both SUCCESSFUL and FAILED — into your report, and the entire discipline of using assumptions is making sure nobody reads that outcome as a pass"
sidebar_label: "08 · Assumptions"
sidebar_position: 21
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-27 against the JUnit 6.0.3 User Guide — "Assumptions"
> ([assumptions](https://docs.junit.org/6.0.3/writing-tests/assumptions.html)); javadoc for
> `Assumptions`
> ([Assumptions](https://docs.junit.org/6.0.3/api/org.junit.jupiter.api/org/junit/jupiter/api/Assumptions.html))
> and `TestExecutionResult.Status`
> ([TestExecutionResult.Status](https://docs.junit.org/6.0.3/api/org.junit.platform.engine/org/junit/platform/engine/TestExecutionResult.Status.html)).
> JDK 25, Spring Boot 4.1.1, JUnit Jupiter 6.0.3, Spring Framework 7.0.9.

**An assertion says "this must be true or the code is wrong". An assumption says "this must
be true or the *question is not meaningful here*". They are opposite claims that look
identical in source, and confusing them produces the worst artefact a test suite can
produce: a green build in which the test never ran.**

## The definition, and the exception type

> *"Assumptions are typically used whenever it does not make sense to continue execution of
> a given test — for example, if the test depends on something that does not exist in the
> current runtime environment."*

> *"When an assumption is valid, the assumption method does not throw an exception, and
> execution of the test continues as usual."*

> *"When an assumption is invalid, the assumption method throws an exception of type
> `org.opentest4j.TestAbortedException` to signal that the test should be aborted instead
> of marked as a failure."*

That last sentence is the entire mechanism. There is no engine magic: an assumption is a
`throw`, and the engine's exception handling maps `TestAbortedException` to a third
outcome. The Platform names all three:

> *"`ABORTED` — Indicates that the execution of a test or container was aborted (started
> but not finished). `FAILED` — Indicates that the execution of a test or container failed.
> `SUCCESSFUL` — Indicates that the execution of a test or container was successful."*

**Aborted is not successful.** It is also not skipped: a skipped test never started
([07](07-disabling-and-conditions.md)), while an aborted test started, ran some code, and
gave up. Most CI dashboards render aborted in the same colour as skipped and count it in
neither the pass nor the fail column — which is exactly why an assumption that is
accidentally always false is invisible.

## The API

> *"All JUnit Jupiter assumptions are static methods in the
> `org.junit.jupiter.api.Assumptions` class."*

Four names, from the javadoc's method summary:

- `assumeTrue(boolean)` / `assumeTrue(BooleanSupplier)`, each with optional
  `String` or `Supplier<String>` message overloads.
- `assumeFalse(…)`, the same six shapes.
- `assumingThat(boolean, Executable)` and `assumingThat(BooleanSupplier, Executable)` —
  which do not abort anything.
- `abort()`, `abort(String)`, `abort(Supplier<String>)` — abort unconditionally.

```java
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assumptions.assumeTrue;
import static org.junit.jupiter.api.Assumptions.assumingThat;

class AssumptionsDemo {

    private final Calculator calculator = new Calculator();

    @Test
    void testOnlyOnCiServer() {
        assumeTrue("CI".equals(System.getenv("ENV")));
        // remainder of test
    }

    @Test
    void testOnlyOnDeveloperWorkstation() {
        assumeTrue("DEV".equals(System.getenv("ENV")),
            () -> "Aborting test: not on developer workstation");
        // remainder of test
    }

    @Test
    void testInAllEnvironments() {
        assumingThat("CI".equals(System.getenv("ENV")),
            () -> {
                // perform these assertions only on the CI server
                assertEquals(2, calculator.divide(4, 2));
            });

        // perform these assertions in all environments
        assertEquals(42, calculator.multiply(6, 7));
    }

}
```

The guide's own example, and the three methods do genuinely different things:

- **`assumeTrue`** aborts the rest of the test when false. Everything after it is skipped.
- **`assumingThat`** runs the supplied `Executable` only when the assumption holds, and
  then **continues with the rest of the test either way**. Nothing is aborted; the test
  still reports `SUCCESSFUL`. It is a conditional block with an unusual spelling.
- **`abort()`** is the unconditional form, useful inside an `if`/`switch` where the
  predicate does not fit an argument.

⚠️ `assumingThat` is the one people misread. A test whose environment-specific assertions
are inside `assumingThat` **passes** on machines where those assertions never execute. If
that is what you want, say so in a comment; if it is not, you wanted `assumeTrue`.

## The message is not optional in practice

`assumeTrue(condition)` with no message aborts with nothing to say. The abort reason is
what reaches the report, exactly as with `@Disabled`'s reason
([07](07-disabling-and-conditions.md)), so the no-message overload produces a test that
stopped for reasons no one can reconstruct.

```java
assumeTrue(dockerAvailable(),
    () -> "no Docker daemon on " + System.getProperty("os.name") + " — skipping");
```

Use the `Supplier` overload when building the message costs anything: it is only invoked
when the assumption fails.

## Assumption versus assertion versus condition

Three mechanisms, three different claims, and choosing wrongly is the actual subject of
this page.

| Mechanism | Claim | Outcome when it does not hold | Evaluated |
|---|---|---|---|
| `assertX` | "the code must behave this way" | `FAILED` | during the test |
| `assumeX` | "this test only means something here" | `ABORTED` | during the test |
| `@EnabledIf…` | "this test only means something here" | skipped, never started | before the test |

The second and third rows make the same claim. **Prefer the condition.** A conditional
annotation is evaluated before the class is even constructed
([07b](07b-the-built-in-conditions.md)), is visible in the source without reading the
method body, is reported with a reason, and costs nothing at run time. An assumption is
the fallback for when the fact is only knowable *inside* the test — after a fixture has
been built, after a query has come back.

The legitimate uses of an assumption are narrow:

- **A precondition on data you did not create.** A test over a shared reference dataset
  that must abort rather than fail when the dataset is empty.
- **A fact discovered mid-test.** The environment reports a capability only once you have
  connected to it.
- **A guard inside a parameterized test** where one argument is not applicable — although
  filtering the arguments in the source is usually cleaner
  ([03 · parameterized tests](../03-parameterized-tests/01-one-test-many-cases.md)).

## Failure beats abort, always

The `Assumptions` javadoc states a rule that decides several confusing reports:

> *"In direct contrast to failed assertions, failed assumptions do not result in a test
> failure; rather, a failed assumption results in a test being aborted. However, failed
> assertions and other exceptions thrown by tests take precedence over failed assumptions
> when both are thrown during the execution of a test (for example, by different lifecycle
> methods), regardless of the order they are thrown in. In such cases, the test will be
> reported as failed rather than aborted."*

Read the second half carefully: **regardless of the order they are thrown in.** If your
`@AfterEach` throws and your test aborted on an assumption, the result is `FAILED`. An
assumption cannot be used to mask a broken teardown, and a suite cannot be made green by
aborting late.

## Interoperating with JUnit 4 and AssertJ

> *"It is also possible to use methods from JUnit 4's `org.junit.Assume` class for
> assumptions. Specifically, JUnit Jupiter supports JUnit 4's
> `AssumptionViolatedException` to signal that a test should be aborted instead of marked
> as a failure."*

> *"If you use AssertJ for assertions, you may also wish to use AssertJ for assumptions. To
> do so, you can statically import the `assumeThat()` method from
> `org.assertj.core.api.Assumptions` and then use AssertJ's fluent API to specify your
> assumptions."*

The second one matters for this phase, because the rest of it assumes AssertJ
([02 · AssertJ](../02-assertj/01-why-fluent-assertions.md)). A file that already imports
`org.assertj.core.api.Assertions.assertThat` should take its assumptions from
`org.assertj.core.api.Assumptions.assumeThat` rather than mixing two fluent styles — the
outcome is identical, because AssertJ's assumptions abort in the same way.

⚠️ Two `Assumptions` classes with the same simple name is a real import hazard. A file that
statically imports `assumeTrue` from Jupiter and `assumeThat` from AssertJ is fine; a file
that imports both *classes* is asking for the wrong one.

## Gotchas

**★ Using an assumption where a condition belongs.**
`assumeTrue(System.getProperty("os.name").startsWith("Linux"))` is `@EnabledOnOs(LINUX)`
written the expensive way: the class is constructed, the fixtures are built, and then the
test gives up. The annotation is evaluated before any of that and reads better.

**★ An assumption that is never true.**
The test is aborted on every run, forever, and no dashboard column goes up. This is the
single most dangerous failure mode on this page: a test that has not executed since 2023
looks identical to one that was skipped for a good reason yesterday.

**★ Reading `assumingThat` as `assumeTrue`.**
`assumingThat` runs its block conditionally and then **carries on**, reporting success.
Assertions placed after it always run; assertions inside it may never run, and the test is
still green.

**★ `assumeTrue` with no message.**
The report shows an aborted test with nothing to explain it. Always pass the message,
preferably as a `Supplier` so it costs nothing when the assumption holds.

**★ An assumption in `@BeforeEach`.**
It aborts the test, which is legitimate — but it aborts *every* test in the class, one at a
time, with the same reason. If the fact is class-wide, it belongs in an
`ExecutionCondition` ([07e](07e-executioncondition-and-deactivation.md)) so the container is
skipped once.

**★ Expecting an aborted test to keep a failing teardown quiet.**
It cannot. A thrown exception anywhere in the test's execution takes precedence over an
aborted assumption regardless of ordering, and the result is `FAILED`.

**★ Counting aborted as passed in a quality gate.**
`ABORTED` is its own status. A gate that computes "failures == 0" passes a build where
every test aborted. Gate on executed count as well, or on aborted count being zero outside
a known list.

**★ Assuming on something the test itself controls.**
`assumeTrue(repository.count() > 0)` after the test's own `@BeforeEach` inserted the rows
is an assertion wearing a disguise: if it is false, the setup is broken and you want a
failure, not an abort.

**★ Mixing Jupiter's `Assumptions` and AssertJ's `Assumptions` by class import.**
Same simple name, two packages. Static-import the methods you use; never import both
classes into one file.

**★ Using an assumption to skip a flaky test path.**
"Abort if the external service is slow today" is a retry with extra steps, and it converts
a real intermittent failure into a silent non-result ([14 · flaky tests](14-flaky-tests.md)).

## Interview questions

**★ What is the difference between a failed assertion and a failed assumption?**
A failed assertion means the code under test is wrong, and the test is reported `FAILED`. A
failed assumption means the test is not meaningful in this environment; it throws
`org.opentest4j.TestAbortedException` and the test is reported `ABORTED` — started but not
finished. The three Platform statuses are `SUCCESSFUL`, `FAILED` and `ABORTED`.

**★ Is an aborted test the same as a skipped test?**
No. A skipped test never started: a condition disabled it before execution, and the
Launcher reports `executionSkipped` with a reason. An aborted test started, executed some
code and threw `TestAbortedException`. The difference matters when you are reasoning about
cost — an aborted test has already paid for the class construction and `@BeforeEach`.

**★ What does `assumingThat` do that `assumeTrue` does not?**
`assumingThat` executes a block only when the assumption holds and then continues with the
rest of the test method, which still reports as successful. `assumeTrue` aborts the whole
remaining test when the assumption is false. `assumingThat` never aborts anything.

**★ A test aborts on an assumption and its `@AfterEach` then throws. What is reported?**
`FAILED`. The javadoc is explicit: failed assertions and other exceptions take precedence
over failed assumptions when both occur, regardless of the order in which they are thrown.

**★ When should you use an assumption rather than a conditional annotation?**
Only when the fact is not knowable until the test is already running — a capability
discovered after connecting, a property of data the test did not create. Everything
knowable up front belongs in an `ExecutionCondition` or one of its declarative front-ends,
because those are evaluated before the class is constructed and are visible without reading
the method body.

**★ Why is a suite full of assumptions dangerous?**
Because aborted tests are counted in neither the pass nor the fail column by most tooling,
so a suite can decay to near-zero executed tests while remaining green. Assumptions need
the same governance as `@Disabled`: a reason on every one, and something watching the
executed-test count.

{/* FOOTER */}
