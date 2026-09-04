---
title: "Strict stubbing stays silent in two documented cases and neither is a bug — it will not report an unused stub in a test that already failed, and it will not flag an argument mismatch when the stubbing and the call live in the same source file — which is why the answer to a failing @BeforeEach stub is almost never LENIENT"
sidebar_label: "07b · Living with strict stubs"
sidebar_position: 30
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-28 against the **Mockito 5.23.0** sources on GitHub (tag `v5.23.0`) —
> [`Mockito`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/Mockito.java)
> §46 (`Mockito.lenient()`), the `UnnecessaryStubbingException` and `MockitoSession` javadoc,
> and the bodies of `DefaultStubbingLookupListener`, `UniversalTestListener` and `Reporter` in
> `mockito-core/src/main/java/org/mockito/internal/`.
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1,
> **Mockito 5.23.0**, JUnit Jupiter 6.0.3. **No sandbox** — every exception string on this page
> is assembled from `Reporter`'s own source, never from a console.

**[07 · Strictness](07-strictness.md) covers how strictness is configured and what it throws.
This is what it is like to live with, which is a different subject: two places the source
deliberately stays quiet, the message text you will actually be reading at 6pm, and the one
setup pattern that produces most `UnnecessaryStubbingException`s in real codebases — where the
obvious fix disarms the checking for every stub in the class, present and future.**

## 🔴 When strict stubbing deliberately says nothing

Two conditions in the source surprise people, and both are deliberate.

**A test that already failed never also reports an unnecessary stub.**
`UniversalTestListener.reportUnusedStubs` reports only when `event.getFailure() == null`, and
`MockitoExtension.afterEach` passes `context.getExecutionException().orElse(null)` straight into
`finishMocking(Throwable)` — whose javadoc explains the reasoning:

> *"When a failure is specified, certain checks are disabled to avoid confusion that may arise
> because there are multiple competing failures."*

Which is correct: a failing assertion usually explains the unused stub, and reporting both turns
one problem into two.

**A mock invoked directly from the test is never flagged for an argument mismatch.**
`DefaultStubbingLookupListener.potentialArgMismatches` fires only when the candidate stubbing
has the **same method name** *and* its `Location.getSourceFile()` **differs** from the
invocation's. The source comment says why:

> *"If stubbing and invocation are in the same source file we assume they are in the test code,
> and we don't flag it as mismatch"*

So a mismatch between two lines of your own test is your business; a mismatch between your stub
and production code is Mockito's. This is why "strict stubbing did not catch my typo" is
sometimes correct behaviour rather than a bug.

## The side effect nobody documents in the release notes

In the same listener, when a stub **is** matched under `STRICT_STUBS`, Mockito calls
`event.getInvocation().markVerified()`. That is the mechanism behind the claim that strict
stubbing lets you drop the ceremonial `verify()` of every stubbed call before
`verifyNoMoreInteractions()` — the stubbed invocations are already marked. See
[05e · verifyNoMoreInteractions](05e-verifynomoreinteractions.md), which argues you should
mostly not be calling it anyway.

## The message text, from `Reporter` rather than a console

`formatUnncessaryStubbingException` assembles:

```text
Unnecessary stubbings detected in test class: OrderServiceTest
Clean & maintainable test code requires zero unnecessary code.
Following stubbings are unnecessary (click to navigate to relevant line of code):
  1. -> at com.example.OrderServiceTest.setUp(OrderServiceTest.java:34)
Please remove unnecessary stubbings or use 'lenient' strictness. More info: javadoc for
UnnecessaryStubbingException class.
```

`potentialStubbingProblem` assembles:

```text
Strict stubbing argument mismatch. Please check:
 - this invocation of 'rateFor' method:
 - has following stubbing(s) with different arguments:
Typically, stubbing argument mismatch indicates user mistake when writing tests.
Mockito fails early so that you can debug potential problem easily.
```

The location lines above are illustrative placeholders in the shape `Reporter` produces; the
sentences around them are the library's own, verbatim.

## 🔴 The `@BeforeEach` stub used by only some tests

This is the single most common real cause of `UnnecessaryStubbingException`, and Mockito's §46
javadoc calls it out as *the* motivating case for `Mockito.lenient()`.

```java
@BeforeEach
void setUp() {
    when(pricing.rateFor(GOLD)).thenReturn(GOLD_RATE);   // used by 3 of 7 tests
    when(clock.instant()).thenReturn(FIXED);             // used by all 7
}
```

Four of the seven tests never ask for the gold rate, so the class fails. The instinct is
`@MockitoSettings(strictness = LENIENT)`, which disarms the checking for the other stub too, and
for every stub anyone adds later. **The narrower fixes, in ascending order of scope** — the same
order `UnnecessaryStubbingException`'s javadoc lists them in:

1. **Move the stub to the tests that use it.** Almost always right. A stub in `@BeforeEach` used
   by three of seven tests is not shared setup, it is three tests' setup in the wrong place.
2. **`lenient().when(...)`** on that one stubbing, if it genuinely is shared background that
   only some paths reach.
3. **`@Mock(strictness = LENIENT)`** on the collaborator, if nearly every stub on it is
   background.
4. **`@MockitoSettings(strictness = LENIENT)`** on the class — the blunt instrument, and worth a
   comment saying why, exactly like `@Disabled` without a reason in
   [07 · Disabling and conditions](../01-junit-5/07-disabling-and-conditions.md).

## `MockitoSession` — the same checks without JUnit 5

If you are not on the extension — a JUnit 4 module, a TestNG suite, a plain `main` — the
mechanism is available directly:

```java
MockitoSession session = Mockito.mockitoSession()
        .initMocks(this)
        .strictness(Strictness.STRICT_STUBS)
        .startMocking();
try {
    // the test
} finally {
    session.finishMocking();
}
```

`finishMocking()` is what runs the unused-stub report, and `finishMocking(Throwable)` is the
overload the extension uses to suppress it after a failure. Forgetting the `finally` means the
report never runs and the session leaks its listener into the next test.

⚠️ **The JUnit 4 runner aggregates differently, and its javadoc says so:** *"Mockito JUnit Runner
triggers UnnecessaryStubbingException only when none of the test methods use the stubbings."*
That aggregation is the **runner's**, not the extension's — `MockitoExtension`'s session is per
test method. A test class ported from the JUnit 4 runner to `MockitoExtension` can therefore
start failing on stubs that were fine before, and nothing about the stubs changed.

## Gotchas

**★ Assuming an unused stub will be reported when the test failed.**
It will not — `reportUnusedStubs` runs only when `getFailure()` is null. Fix the assertion, run
again, and the stubbing report you never saw appears.

**★ Assuming strict stubbing catches every argument mismatch.**
It skips mismatches where the stubbing and the invocation are in the **same source file**, by
design, on the assumption that both are test code.

**★ Reaching for `LENIENT` to fix a `@BeforeEach` stub that only some tests use.**
It disarms checking for every stub in the class, present and future. Move the stub, or use
`lenient()` on that one stubbing.

**★ Forgetting `session.finishMocking()` in a `finally`.**
The unused-stub report never runs and the listener leaks into the next test.

**★ Porting a class from the JUnit 4 runner to `MockitoExtension` and expecting the same
verdict.** The runner reports an unnecessary stub only when *no* test method used it; the
extension's session is per method.

**★ Deleting a stub to silence the exception without asking why it was unused.**
The exception is evidence that the test and the code disagree about what gets called. Deleting
the stub removes the evidence and keeps the disagreement.

## Interview questions

**★ Your test fails an assertion, and you expected an unnecessary-stubbing report too. Why is
there none?**
`UniversalTestListener.reportUnusedStubs` reports only when `event.getFailure() == null`, and
the extension passes the execution exception into `finishMocking(Throwable)`. The javadoc gives
the reason: *"certain checks are disabled to avoid confusion that may arise because there are
multiple competing failures."*

**★ Why did strict stubbing not flag an obvious argument mismatch?**
Because the stubbing and the invocation were in the **same source file**.
`DefaultStubbingLookupListener` skips those deliberately — *"we assume they are in the test code,
and we don't flag it as mismatch"*.

**★ How do strict stubs interact with `verifyNoMoreInteractions()`?**
When a stub is matched under `STRICT_STUBS`, Mockito calls `markVerified()` on the invocation, so
stubbed calls do not count as unverified afterwards. That removes the ceremonial `verify()` of
every stubbed call — though [05e](05e-verifynomoreinteractions.md) argues you should rarely be
calling `verifyNoMoreInteractions` in the first place.

**★ A `@BeforeEach` stub is used by three of seven tests and the class now fails. What do you do?**
Move it into the three tests that use it — it was never shared setup. If it genuinely is shared
background that only some paths reach, `lenient()` that one stubbing. Escalate to
`@Mock(strictness = LENIENT)` or `@MockitoSettings` only as the scope genuinely widens, which is
the order `UnnecessaryStubbingException`'s own javadoc presents.

**★ How do you get strict stubbing without JUnit 5?**
`Mockito.mockitoSession().initMocks(this).strictness(STRICT_STUBS).startMocking()`, with
`finishMocking()` in a `finally`. That is the same machinery the extension drives; the extension
is a thin lifecycle wrapper over it.

{/* FOOTER */}
