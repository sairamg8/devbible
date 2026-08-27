---
title: "A JUnit test is an executable claim about behaviour whose only failure mechanism is an uncaught exception, which is why the name, the arrangement and the single reason to fail matter more than any assertion library you pick"
sidebar_label: "01 · What a test is for"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-27 against the JUnit 6.0.3 User Guide — "Writing Tests"
> ([intro](https://docs.junit.org/6.0.3/writing-tests/intro.html)), "Definitions"
> ([definitions](https://docs.junit.org/6.0.3/writing-tests/definitions.html)) and
> "Exception Handling"
> ([exception-handling](https://docs.junit.org/6.0.3/writing-tests/exception-handling.html));
> version spine read from `spring-boot-dependencies:4.1.0`
> ([POM on Maven Central](https://repo1.maven.org/maven2/org/springframework/boot/spring-boot-dependencies/4.1.0/spring-boot-dependencies-4.1.0.pom)).
> JDK 25, Spring Boot 4.1.0, JUnit Jupiter 6.0.3, Spring Framework 7.0.8.

**Everything JUnit does reduces to one mechanism: it invokes your method, and if the
method returns normally the test passed. There is no "pass" API. A test fails when an
exception escapes — an `AssertionError` from an assertion, or a `NullPointerException`
from a bug, and Jupiter does not distinguish between them. Once you internalise that,
the rest of this topic is about controlling *when* the method is invoked, *what* is set
up around it, and *what the report says* when it does not return.**

## The one rule that governs pass and fail

The user guide states it without qualification:

> *"In JUnit Jupiter, if an exception is thrown from a test method, a lifecycle method,
> or an extension and not caught within that test method, lifecycle method, or
> extension, the framework will mark the test or test class as failed."*

And the corollary that surprises people who came from other ecosystems:

> *"It's important to note that specifying a `throws` clause in the test method has no
> effect on the outcome of the test. JUnit Jupiter does not interpret a `throws` clause
> as an expectation or assertion about what exceptions the test method should throw."*

So `void loadsTheFile() throws IOException` is a convenience for the compiler, not a
declaration that an `IOException` is acceptable. If one is thrown, the test fails.

Assertions are not a separate mechanism bolted on top:

> *"Assertions in JUnit Jupiter are implemented using exceptions. The framework provides
> a set of assertion methods in the `org.junit.jupiter.api.Assertions` class, which throw
> `AssertionError` when an assertion fails."*

⚠️ **Jupiter itself does not care which one you threw.** The guide is explicit: *"JUnit
Jupiter itself does not differentiate between failed assertions (`AssertionError`) and
other types of exceptions. All uncaught exceptions lead to a test failure. However,
Integrated Development Environments (IDEs) and other tools may distinguish between these
two types of failures by checking whether the thrown exception is an instance of
`AssertionError`."* That distinction — "this expectation was wrong" versus "this code
blew up" — is an IDE convention built on the exception's type, not a JUnit concept.

## Container and test: what the report is actually a tree of

The platform has exactly two node kinds, and the guide defines them:

> *"**Container** — a node in the test tree that contains other containers or tests as
> its children (e.g. a test class). **Test** — a node in the test tree that verifies
> expected behavior when executed (e.g. a `@Test` method)."*

That is why a failing `@BeforeAll` reports differently from a failing `@Test`: one kills
a container and everything beneath it, the other kills one leaf. It is also why
`@Nested`, `@ParameterizedTest` and `@RepeatedTest` all produce *containers* whose
children are the actual tests — the guide notes that with the exception of `@Test`,
every testable annotation *"create[s] a container in the test tree that groups tests"*.

## A test is a claim, and the name is where the claim lives

The failure report shows you a name and a stack trace. Six months later that name is the
only thing standing between a red build and a bisect. So the name states the *behaviour*,
not the method being called:

```java
class DiscountPolicyTest {

    private final DiscountPolicy policy = new DiscountPolicy();

    @Test
    void appliesNoDiscountBelowTheThreshold() {
        Money total = policy.apply(Money.of("49.99"), CustomerTier.STANDARD);

        assertEquals(Money.of("49.99"), total);
    }

    @Test
    void appliesTenPercentAtExactlyTheThreshold() {
        Money total = policy.apply(Money.of("50.00"), CustomerTier.STANDARD);

        assertEquals(Money.of("45.00"), total);
    }
}
```

`appliesTenPercentAtExactlyTheThreshold` failing tells you what broke. `testApply2`
failing tells you to open the file. The information is the same; the cost of extracting
it is not, and you pay that cost at the worst possible moment.

## Three phases, and the blank line that separates them

```java
@Test
void refundsTheFullAmountWhenCancelledWithinTheWindow() {
    Order order = anOrder().placedAt(NOON).totalling("120.00").build();   // arrange

    Refund refund = refundService.cancel(order, NOON.plusHours(2));        // act

    assertEquals(Money.of("120.00"), refund.amount());                     // assert
}
```

The blank lines are load-bearing. A reader scanning a hundred tests uses them to find the
one line that exercises the system. When the *act* section is three statements long, the
test is asserting on a workflow, and the failure will not say which of the three broke.

⚠️ **Where the arrange section goes is the whole of the lifecycle argument**
([03](03-the-lifecycle.md)): shared setup moves to `@BeforeEach`, and it stops being
visible in the test that depends on it. That is a trade, not a win.

## One reason to fail

A test with four unrelated assertions is four tests sharing a name, and JUnit will stop
at the first failure — the second, third and fourth are not evaluated, so you fix one
thing, re-run, and discover the next. If the assertions genuinely belong to one claim,
`assertAll` reports them together ([04b](04b-assertall.md)). If they do not, they are
separate tests.

The `Money` example above has the shape you want: one behaviour, one arrangement, one
assertion, one name that says which rule of the business is being defended.

## Verifying behaviour, not implementation

```java
// Verifies behaviour: survives any rewrite that keeps the rule.
@Test
void closesTheAccountWhenTheBalanceReachesZero() {
    account.withdraw(account.balance());

    assertTrue(account.isClosed());
}
```

A test that instead reached into the object and asserted on an internal flag, or verified
that `closeInternal()` was called exactly once, breaks the day someone renames the flag —
even though the account still closes. That distinction is what makes a suite worth
keeping, and it is the argument that
**topic 04 · Mockito** *(not written yet)* picks up as "never mock the class under test".

## What this topic covers, and what it hands off

This topic owns the **engine**: lifecycle, assertions, `@Nested`, `@Tag`, `@TempDir`,
extensions, execution order, parallelism and timeouts. Three things it deliberately does
not own:

- **Assertion style and failure messages** are **topic 02 · AssertJ** *(not written yet)*
  — `02-assertj/`. Jupiter's own assertions are taught here because you must be able to
  read them; the JUnit team themselves recommend a third-party library (see
  [04](04-assertions.md)).
- **`@ParameterizedTest` and every argument source** are **topic 03 · Parameterized
  tests** *(not written yet)* — `03-parameterized-tests/`. This topic names the annotation
  where the engine's behaviour depends on it and stops there.
- **Mocking** is **topic 04 · Mockito** *(not written yet)*; **Spring slices and
  `@MockitoBean`** are **topic 05 · The test pyramid** *(not written yet)*.

## Gotchas

**★ Adding `throws Exception` and believing you have handled the exception.**
You have satisfied `javac`. The test still fails if the exception is thrown. The only way
to say "this call is supposed to throw" is `assertThrows` ([05](05-assertthrows.md)).

**★ A test that cannot fail.**
Code that calls the system under test and asserts nothing passes forever, including after
the method is deleted and replaced with `return null`. It is worse than no test, because
coverage counts it — see **topic 09 · JaCoCo** *(not written yet)* and **topic 11 ·
mutation testing** *(not written yet)*, which is the tool that actually detects this.

**★ Catching the exception and calling `fail()` in the `catch`.**
The JUnit 3 idiom. It inverts the reading order, loses the original stack trace unless
you pass the cause, and does nothing `assertThrows` does not do better.

**★ Naming the test after the method under test.**
`add()` has one name and fifteen behaviours. Once two tests are both called `testAdd`
plus a number, the report has stopped being readable, and no display-name generator will
rescue it ([06](06-naming-and-display-names.md)).

**★ Asserting in a loop over a collection of cases.**
The first failure ends the loop, the report names the test rather than the case, and you
learn one input at a time. That is exactly what `@ParameterizedTest` exists for —
**topic 03** *(not written yet)*.

**★ Sharing mutable state between tests through a static field.**
Jupiter gives you a fresh instance per test method by default ([03](03-the-lifecycle.md)),
which protects instance fields and does nothing for `static` ones. A static `List` that
accumulates across tests makes the suite order-dependent, and it will pass locally and
fail on the build server ([11](11-execution-order.md)).

**★ Writing the test after the fix, from the fix.**
A test derived from the patch asserts what the patch does, which is not the same as
asserting what the requirement is. Write it from the bug report, watch it fail, then fix.

**★ Treating the test as throwaway code.**
It is the code that runs most often and is read under the most pressure. A duplicated
40-line setup block in twelve tests is twelve places to edit when the constructor gains
an argument — **topic 08 · test data patterns** *(not written yet)*.

## Interview questions

**★ How does JUnit decide a test passed?**
It does not decide anything positive. It invokes the method; if the method returns
normally, the node is reported as successful. Failure is the presence of an uncaught
`Throwable`, not the absence of a "pass" call. Everything else — assertions, assumptions,
timeouts — is a way of producing or not producing that `Throwable`.

**★ Does `AssertionError` mean something different to JUnit than `NullPointerException`?**
Not to the engine. The guide says Jupiter *"does not differentiate between failed
assertions (`AssertionError`) and other types of exceptions"*. IDEs and reporting tools
draw the distinction themselves by checking `instanceof AssertionError`, which is why a
failed assertion often renders with an expected/actual diff and a `NullPointerException`
does not.

**★ What does a `throws` clause on a test method mean?**
Nothing, as far as the outcome goes. It lets you call a checked-exception-throwing method
without a `try`. It is not an expectation. The guide states this explicitly because
JUnit 4's `@Test(expected = …)` trained a generation to think otherwise.

**★ What is the difference between a container and a test in the platform's model?**
A container is a node with children — a test class, a `@Nested` class, the invocation
group generated by `@ParameterizedTest`. A test is a leaf that verifies behaviour. The
distinction decides what a failure takes down with it: a failing container's children are
never executed, a failing test affects nothing else.

**★ Why is "one assertion per test" usually advice about reasons to fail rather than
about counting?**
Because JUnit stops at the first thrown exception, every assertion after the first
failure is unevaluated. If four assertions describe four independent claims, you learn
about them one build at a time. If they describe one claim from four angles, group them
with `assertAll` and learn about all four at once. The number is a proxy; the real
question is how many independent reasons this test has to be red.

**★ Why does the test name matter more than the assertion message?**
Because the name is in the report, the CI summary, the flaky-test dashboard and the git
history, and it is present whether or not anyone supplied a message. A good name makes a
message unnecessary for most failures; a message cannot repair a name.

**★ You inherit a suite where every test is named `test1`…`testN`. What do you do first?**
Not renaming. First establish that the tests can fail — pick two, break the production
code they cover and confirm they go red. A suite with unreadable names very often also
contains tests that assert nothing, and renaming those makes them look trustworthy
without making them useful.

{/* FOOTER */}
