---
title: "@Transactional on a test method means something different from @Transactional on a service method — the test's transaction is rolled back by default"
sidebar_label: "20 · Transactions in tests"
sidebar_position: 53
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Spring Framework 7.0 reference *Testing →
> TestContext Framework → Transaction management*
> ([docs.spring.io/spring-framework/reference/testing/testcontext-framework/tx.html](https://docs.spring.io/spring-framework/reference/testing/testcontext-framework/tx.html))
> and the `TestTransaction` javadoc
> ([docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/test/context/transaction/TestTransaction.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/test/context/transaction/TestTransaction.html)).
> JDK 25, Spring Framework 7.0.9, Spring Boot 4.1.1.

**The same annotation, a completely different contract. On a service method,
`@Transactional` commits unless something goes wrong. On a test method, it rolls
back unless you say otherwise — which is what makes integration tests repeatable,
and also what makes a certain class of test pass while the production code it
exercises is broken.**

## The default

> Annotating a test method with `@Transactional` causes the test to be run within
> a transaction that is, by default, automatically rolled back after completion of
> the test.

and:

> By default, test transactions will be automatically rolled back after completion
> of the test; however, transactional commit and rollback behavior can be
> configured declaratively via the `@Commit` and `@Rollback` annotations.

```java
@SpringBootTest
@Transactional
class OrderServiceTest {

    @Autowired OrderService orders;
    @Autowired OrderRepository repository;

    @Test
    void places_an_order() {
        orders.place(new NewOrder("SKU-1", 2));
        assertThat(repository.count()).isEqualTo(1);
    }   // rolled back here — the next test starts clean
}
```

This is a genuinely good default. Every test starts from the same database state
without anyone writing cleanup code, and tests can run in any order. It is also
the reason a test method carrying `@Transactional` needs to be read with different
eyes from a service method carrying the same annotation.

## When you want the commit

```java
@Test
@Commit
void seeds_reference_data() { ... }
```

`@Commit` is `@Rollback(false)`; both are available and `@Rollback(true)` is the
default. They can be applied at class level too.

The honest use for `@Commit` is narrow: verifying commit behaviour itself, or
seeding data a subsequent process will read. Reaching for it because a test "does
not work otherwise" is usually a sign that the test is fighting the rollback —
most often because the code under test spawns a thread, which is
[20b · The false positives](20b-the-false-positives.md).

Committing also means you have taken on cleanup. A committed test leaves state for
every test after it, and the failure that produces is order-dependent and
miserable to diagnose.

## Running code outside the test's transaction

> Occasionally, you may need to run certain code before or after a transactional
> test method but outside the transactional context — for example, to verify the
> initial database state prior to running your test or to verify expected
> transactional commit behavior after your test runs (if the test was configured
> to commit the transaction). `TransactionalTestExecutionListener` supports the
> `@BeforeTransaction` and `@AfterTransaction` annotations for exactly such
> scenarios.

```java
@BeforeTransaction
void checkPreconditions() { ... }     // no test transaction yet

@Test
@Transactional
void does_the_thing() { ... }

@AfterTransaction
void verifyAfterwards() { ... }       // test transaction already resolved
```

One restriction that is easy to trip over:

> methods annotated with `@BeforeTransaction` or `@AfterTransaction` are only run
> for transactional test methods.

So on a test class with a mix of transactional and non-transactional tests, these
hooks fire for some and not others. That is by design, and it is worth knowing
before you use one of them to set up shared state.

## Programmatic control with `TestTransaction`

> You can interact with test-managed transactions programmatically by using the
> static methods in `TestTransaction`. For example, you can use `TestTransaction`
> within test methods, before methods, and after methods to start or end the
> current test-managed transaction or to configure the current test-managed
> transaction for rollback or commit.

The API is six static methods, and the javadoc is precise about each:

| Method | What it does |
|---|---|
| `isActive()` | "Determine whether a test-managed transaction is currently *active*." |
| `isFlaggedForRollback()` | true for rollback, false for commit; throws `IllegalStateException` if no transaction is active |
| `flagForRollback()` | "Invoking this method will *not* end the current transaction. Rather, the value of this flag will be used to determine whether the current test-managed transaction should be rolled back or committed once it is ended." |
| `flagForCommit()` | the same, for commit |
| `end()` | "Immediately force a *commit* or *rollback* of the current test-managed transaction, according to the rollback flag." |
| `start()` | "Start a new test-managed transaction." — "Only call this method if `end()` has been called or if no transaction has been previously started." |

That combination lets a single test span more than one transaction, which is the
only way to test behaviour that depends on a commit having happened:

```java
@Test
@Transactional
void projection_is_updated_after_commit() {
    orders.place(new NewOrder("SKU-1", 2));

    TestTransaction.flagForCommit();
    TestTransaction.end();              // commits — AFTER_COMMIT listeners run here

    TestTransaction.start();            // a second transaction, rolled back at the end
    assertThat(projections.findAll()).hasSize(1);
}
```

This is the correct way to test an `AFTER_COMMIT` listener, and it is worth
knowing precisely because the usual arrangement makes those listeners
untestable — see [19 · Transactional events](19-transactional-events.md), where the
rule is that with no transaction the listener is not invoked at all, and inside a
never-committed test transaction the commit phase never arrives.

Note the ordering constraint in the javadoc: `start()` throws
`IllegalStateException` if a transaction is already active, and the flag methods
throw if one is not. The sequence has to be `flag…` → `end()` → `start()`.

## The trade-off

Rolling back gives you isolation for free and makes a suite order-independent —
easily the most valuable property an integration suite can have.

What you give up is fidelity. The test never commits, so it never exercises the
commit path: deferred constraints, `AFTER_COMMIT` listeners, anything that
depends on the data being visible to another connection, and — most commonly — the
flush that would have hit a constraint. The test runs a slightly different program
from the one production runs, and the difference is exactly where a whole family
of bugs lives. That family is [20b](20b-the-false-positives.md).

## Gotchas

**⚠️ Reading a test's `@Transactional` as if it meant the service's**
**Symptom:** confusion about why data "disappears" between tests, or an assumption
that the test proves the commit worked.
**Cause:** the TestContext framework inverts the default — test transactions roll
back unless annotated otherwise.
**Fix:** treat a test method's `@Transactional` as a different annotation with the
same name. It is set-up and teardown, not a unit of work.

**⚠️ `@Commit` used to make a stubborn test pass**
**Symptom:** the test passes, and a later test in the suite starts failing.
**Cause:** committed state leaks into every subsequent test, producing
order-dependent failures.
**Fix:** find out why rollback broke the test. The usual answer is a thread
hand-off in the code under test, which committing merely papers over.

**⚠️ `@BeforeTransaction` not running**
**Symptom:** set-up that silently does not happen for some tests in a class.
**Cause:** those hooks "are only run for transactional test methods", and the test
in question is not one.
**Fix:** use ordinary JUnit lifecycle methods for setup that must always run, and
reserve these two for genuinely transaction-relative work.

**⚠️ `TestTransaction.start()` when a transaction is already active**
**Symptom:** `IllegalStateException` from the test infrastructure.
**Cause:** the javadoc's rule — only call `start()` after `end()`, or when none was
started.
**Fix:** the sequence is `flagForCommit()` → `end()` → `start()`. Reading the
current state with `isActive()` first is cheap.

**⚠️ Expecting `flagForRollback()` to end the transaction**
**Symptom:** a test that flags for rollback and then observes its own writes.
**Cause:** the javadoc: "Invoking this method will *not* end the current
transaction." It only sets what will happen at the end.
**Fix:** call `end()` if you want the outcome to happen now.

**⚠️ A test transaction hiding a missing `@Transactional` in production code**
**Symptom:** a service method with no transaction of its own passes every test
because the *test* supplied one.
**Cause:** the test class is annotated `@Transactional`, so everything runs inside
a transaction whether the production path would or not.
**Fix:** for methods whose atomicity matters, write at least one test without the
class-level annotation, driving the service the way production does.

**⚠️ Assuming the rollback undoes everything the test did**
**Symptom:** files, messages, or rows in a second datasource surviving.
**Cause:** the rollback covers the transactional resource, and nothing else.
**Fix:** clean up non-transactional side effects explicitly. This is another
reason to keep such work out of transactions in the first place — see
[21 · What belongs in a transaction](21-what-belongs-in-a-transaction.md).

## Interview questions

**★ What does `@Transactional` mean on a test method?**
Something almost opposite to what it means on a service method. The TestContext
framework runs the test inside a transaction that "is, by default, automatically
rolled back after completion of the test", so the database is left as it was found
and tests can run in any order without cleanup code. On a service method the same
annotation commits unless a rollback rule fires. The name is shared; the contract
is not.

**★ How do you make a test commit, and when would you?**
`@Commit`, or equivalently `@Rollback(false)`, at method or class level. The
legitimate uses are narrow: verifying commit behaviour itself, seeding data that
something outside the transaction will read, or testing an `AFTER_COMMIT` listener.
Using it to make an awkward test pass is a bad sign — it usually means the code
under test is doing something the rollback cannot reach, such as work on another
thread, and committing hides that rather than fixing it. It also means the test now
leaks state into the rest of the suite.

**★ What are `@BeforeTransaction` and `@AfterTransaction` for?**
Running code around a transactional test method but outside its transaction —
verifying the initial database state before the test transaction starts, or
checking committed state after it has been resolved. The reference gives exactly
those two examples. The restriction to remember is that they "are only run for
transactional test methods", so on a mixed test class they fire selectively, which
makes them unsuitable for general setup.

**★ How would you test an `AFTER_COMMIT` listener?**
With `TestTransaction`, because the default arrangement makes it impossible: the
test transaction never commits, so the commit phase never arrives and the listener
never runs. The sequence is to do the work, call `TestTransaction.flagForCommit()`
and then `TestTransaction.end()` — which "immediately force[s] a commit or
rollback… according to the rollback flag" and therefore runs the `AFTER_COMMIT`
listeners — then `TestTransaction.start()` to open a fresh transaction for the
assertions, which is rolled back as usual at the end of the test.

**★ Does `flagForRollback()` roll the transaction back?**
No. The javadoc is explicit that it "will *not* end the current transaction.
Rather, the value of this flag will be used to determine whether the current
test-managed transaction should be rolled back or committed once it is ended." It
sets the outcome; `end()` performs it. Both flag methods throw
`IllegalStateException` if no transaction is active, and `start()` throws if one
already is, so the ordering is not optional.

**★ What is the cost of the rollback default?**
Fidelity. The test never commits, so it never exercises the commit path — deferred
constraints, transactional event listeners, visibility to other connections, and
above all the flush that would have hit a database constraint. The suite is
running a subtly different program from production, and the gap is where a
recognised family of false positives lives. That is a reason to know the failure
modes, not a reason to abandon the default, which buys isolation cheaply enough to
be worth it.

**★ A service method has no `@Transactional` and every test passes. What might be
happening?**
The test class is probably annotated `@Transactional`, so the test supplies a
transaction the production path does not have. Every repository call inside the
method then participates in the test's transaction and behaves atomically, which
is exactly what the test asserts — and in production the same method runs each
repository call in its own autocommit unit. The way to catch it is to have at
least one test that drives the service without the class-level annotation, the way
a controller would.

---

← Prev: [19b · After-commit is not durable](19b-after-commit-is-not-durable.md) · Index: [04 · Spring @Transactional](README.md) · Next → [20b · The false positives](20b-the-false-positives.md)
