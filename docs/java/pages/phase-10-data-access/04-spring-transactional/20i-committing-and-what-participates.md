---
title: "Committing in a test is a debt you take on, and the propagation of the code under test decides how much of it the rollback was ever paying"
sidebar_label: "20i · Committing, and what participates"
sidebar_position: 61
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Spring Framework 7.0 reference *Testing → TestContext
> Framework → Transaction management*
> ([docs.spring.io/spring-framework/reference/testing/testcontext-framework/tx.html](https://docs.spring.io/spring-framework/reference/testing/testcontext-framework/tx.html)),
> the `@Commit` ([.../test/annotation/Commit.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/test/annotation/Commit.html))
> and `@Rollback` ([.../test/annotation/Rollback.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/test/annotation/Rollback.html))
> javadocs.
> JDK 25, Spring Framework 7.0.8, Spring Boot 4.1.0.

**The rollback default is free isolation, and [20h](20h-asserting-the-commit.md) showed
the assertions it makes possible. This chunk is the other side: what you owe when you
turn it off, and the fact that it was never covering as much as it looked — a service
boundary that does not participate in the test's transaction was always committing for
real, whatever the test was annotated with.**

## `@Commit` is a debt, not a switch

`@Commit` is documented as a direct replacement for `@Rollback(false)`:

> `@Commit` can be used as direct replacement for `@Rollback(false)`; however, it
> should **not** be declared alongside `@Rollback`. Declaring `@Commit` and
> `@Rollback` on the same test method or on the same test class is unsupported and may
> lead to unpredictable results.

and both are class- or method-level, with the method-level declaration "potentially
overriding class-level default commit or rollback semantics". `@Rollback`'s default
value is `true`.

What committing buys is the only way to test the things a rollback hides: deferred
constraints, `AFTER_COMMIT` listeners, visibility from a second connection. What it
costs is that **you now own the cleanup**, and the cost is not symmetric with the
benefit — a committed test that fails partway leaves half its data behind and the next
twenty tests fail for reasons that have nothing to do with them.

If you commit, clean up in a way that runs even when the test fails: an
`@AfterTransaction` method, an `@Sql` script with `executionPhase = AFTER_TEST_METHOD`,
or a JUnit extension. Not the last lines of the test method, which a failure skips.

## What actually participates, propagation by propagation

The test-managed rollback only covers work that ran inside the test's transaction. Which
work that is depends entirely on the propagation of the boundary the code under test
declares — and the answers are not all "it joins":

| Propagation on the service method | Inside a `@Transactional` test | What the test's rollback covers |
|---|---|---|
| `REQUIRED` | joins the test's transaction | everything |
| `SUPPORTS` | joins the test's transaction | everything |
| `MANDATORY` | joins the test's transaction | everything — ⚠️ and it would have **thrown** in production if the caller had none |
| `NESTED` | a savepoint inside the test's transaction | everything — the outer rollback discards the savepoint too |
| `REQUIRES_NEW` | a **separate physical transaction** | ⛔ nothing — it commits for real and survives the test |
| `NOT_SUPPORTED` | the test's transaction is **suspended** | ⛔ nothing — the work runs unmanaged, usually autocommit |
| `NEVER` | ⛔ **throws** — a transaction is active | the test fails outright, which is at least loud |

The reference's warning names the first two as the safe pair:

> Spring-managed and application-managed transactions typically participate in
> test-managed transactions. However, you should use caution if Spring-managed or
> application-managed transactions are configured with any propagation type other than
> `REQUIRED` or `SUPPORTS`.

⚠️ **`MANDATORY` is the row worth staring at.** It participates, so the test is green
and the rollback is complete — and the whole point of `MANDATORY` is to throw when
there is no caller transaction. A `@Transactional` test supplies one, so the test can
never observe the failure the annotation exists to produce. If a controller then calls
that method without a boundary, production throws
`IllegalTransactionStateException` on a path every test covered. The test for a
`MANDATORY` method has to be non-transactional and has to assert the throw.

## Test-managed, Spring-managed, application-managed

The reference draws a three-way distinction that explains most of the confusing
outcomes in this area, and ends with a warning that is easy to skim past:

> Test-managed transactions are transactions that are managed declaratively by using
> the `TransactionalTestExecutionListener` or programmatically by using
> `TestTransaction`… You should not confuse such transactions with Spring-managed
> transactions (those managed directly by Spring within the `ApplicationContext`
> loaded for tests) or application-managed transactions (those managed programmatically
> within application code that is invoked by tests). Spring-managed and
> application-managed transactions typically participate in test-managed transactions.
> However, you should use caution if Spring-managed or application-managed transactions
> are configured with any propagation type other than `REQUIRED` or `SUPPORTS`.

That last sentence is the one to memorise. A service method annotated
`REQUIRES_NEW` called from a `@Transactional` test **commits for real** — it is a
physically separate transaction, so the test's rollback cannot touch it. The row
survives the test and pollutes the suite, and the symptom appears in a different test
file. `NOT_SUPPORTED` and `NEVER` behave surprisingly for the same reason: the test's
transaction is suspended or rejected rather than joined.

⚠️ **This is the honest reason a `REQUIRES_NEW` service is awkward to test**, and it
generalises: the more a boundary refuses to participate, the less the test-managed
rollback protects you, and the more explicit cleanup you owe. See
[10 · `REQUIRES_NEW`](10-requires-new.md).

Where there are several managers, the listener needs to be told which one:

> If there are multiple instances of `PlatformTransactionManager` within the test's
> `ApplicationContext`, you can declare a qualifier by using `@Transactional("myTxMgr")`
> or `@Transactional(transactionManager = "myTxMgr")`, or `TransactionManagementConfigurer`
> can be implemented by an `@Configuration` class.

## Gotchas

**⚠️ `@Commit` and `@Rollback` on the same class or method**
**Symptom:** unpredictable commit behaviour, often differing between class and method.
**Cause:** explicitly unsupported — "Declaring `@Commit` and `@Rollback` on the same
test method or on the same test class is unsupported and may lead to unpredictable
results."
**Fix:** pick one. `@Commit` *is* `@Rollback(false)`.

**⚠️ Cleaning up a committed test in the last lines of the test method**
**Symptom:** one failing test poisons the twenty after it.
**Cause:** a failed assertion skips everything below it, including the cleanup.
**Fix:** `@AfterTransaction`, or an `@Sql` script with
`executionPhase = AFTER_TEST_METHOD`, both of which run regardless of outcome.

**⚠️ A `REQUIRES_NEW` service method under a `@Transactional` test**
**Symptom:** rows that survive a test the framework rolled back correctly.
**Cause:** the reference's warning — "use caution if Spring-managed or
application-managed transactions are configured with any propagation type other than
`REQUIRED` or `SUPPORTS`". A `REQUIRES_NEW` boundary commits independently.
**Fix:** expect it, and clean up explicitly. This is a property of the production
design, not a testing mistake.

**⚠️ `@Commit` on an enclosing class, inherited by a `@Nested` class you forgot about**
**Symptom:** an inner test class commits without saying so anywhere in its own source.
**Cause:** `@Commit` "will be inherited from an enclosing test class by default", and a
class-level declaration "defines the default commit semantics for all test methods
within the test class hierarchy or nested class hierarchy".
**Fix:** put `@Rollback` on the nested class if it should not commit, and treat a
class-level `@Commit` as a decision about every nested class beneath it.

**⚠️ A `MANDATORY` service method covered only by transactional tests**
**Symptom:** every test passes; production throws `IllegalTransactionStateException`
from a controller path.
**Cause:** the test supplied the caller transaction that `MANDATORY` requires, so the
one failure the annotation exists to cause can never happen in the suite.
**Fix:** at least one non-transactional test that calls the method with no boundary and
asserts the exception.

**⚠️ A `NOT_SUPPORTED` method assumed to be covered by the test rollback**
**Symptom:** rows that survive a rolled-back test, as with `REQUIRES_NEW`, but with no
second transaction to blame.
**Cause:** the test's transaction is suspended for the duration, so the work runs
unmanaged — typically autocommit, one statement at a time.
**Fix:** expect it and clean up. Suspension is exactly what was asked for.

## Interview questions

**★ When is `@Commit` the right answer, and what does it cost?**
It is right when the thing under test only happens at commit: a `DEFERRABLE INITIALLY
DEFERRED` constraint, an `AFTER_COMMIT` event listener, or visibility to a second
connection. It is documented as "a direct replacement for `@Rollback(false)`" and must
not be combined with `@Rollback` on the same method or class, which is "unsupported and
may lead to unpredictable results". What it costs is the property the rollback default
exists for: the database is no longer reset, so you own the cleanup — and it has to be
cleanup that runs when the test *fails*, which the last lines of the test method are
not. An `@AfterTransaction` method or an `@Sql` script in the `AFTER_TEST_METHOD`
phase both qualify.

**★ Why does the reference warn about propagation types other than `REQUIRED` or
`SUPPORTS` in tests?**
Because those are the two that participate in the test-managed transaction, and
participation is what makes the rollback cover the service's work. The exact wording is
"you should use caution if Spring-managed or application-managed transactions are
configured with any propagation type other than `REQUIRED` or `SUPPORTS`". A
`REQUIRES_NEW` method is a physically separate transaction that commits for real, so
the test's rollback cannot touch its rows and they survive into the rest of the suite —
with the symptom appearing in some unrelated test file. `NOT_SUPPORTED` suspends the
test transaction and `NEVER` rejects it outright. None of that is a bug; it is the
documented consequence of asking for a boundary that does not join.

**★ Which propagations actually participate in a test-managed transaction, and what
happens to the rest?**
`REQUIRED` and `SUPPORTS` join it, which is why the reference names exactly those two
as the safe pair and says to "use caution" with anything else. `MANDATORY` also joins,
and `NESTED` runs as a savepoint inside it — both are covered by the rollback.
`REQUIRES_NEW` is a separate physical transaction that commits for real and survives
the test. `NOT_SUPPORTED` suspends the test's transaction, so the work runs unmanaged
and also survives. `NEVER` throws outright, because a transaction is active. The
practical consequence is that "the test rolls everything back" is true only for a
subset of your service methods, and the exceptions are the ones that leak rows into
other test files.

**★ A service method is annotated `@Transactional(propagation = MANDATORY)` and every
test passes. What is not being tested?**
The only thing `MANDATORY` does. Its whole purpose is to throw
`IllegalTransactionStateException` when it is called with no caller transaction —
that is the contract, and it is a design statement that this method must never be an
entry point. A `@Transactional` test supplies exactly the caller transaction that
suppresses it, so the suite covers every path *except* the one the annotation exists
for. The missing test is a non-transactional one that calls the method directly and
asserts the exception, which is also the test that documents the contract to the next
person.

**★ How do you clean up after a test that commits, so that a failure does not poison the
rest of the suite?**
Not in the test method. A failed assertion skips everything below it, so cleanup written
at the end of the method is exactly the cleanup that does not run on the day it matters.
Three shapes do run regardless of outcome: an `@AfterTransaction` method, which the
reference documents as running outside the transactional context after the test; an
`@Sql` script declared with `executionPhase = AFTER_TEST_METHOD`, ideally with
`transactionMode = ISOLATED` so the deletion is itself committed; or a JUnit extension.
The declarative ones are better because they are visible at the top of the class rather
than buried, which matters when someone later adds a test to it.

**★ Is committing in a test ever the *default* you want for a whole class?**
Rarely, and it is worth being able to say why rather than just refusing. Both `@Commit`
and `@Rollback` can be declared at class level, where they define "the default commit
semantics for all test methods within the test class hierarchy or nested class
hierarchy" — so a class-level `@Commit` is a coherent thing to write for a test class
whose entire subject is commit-time behaviour: deferred constraints, `AFTER_COMMIT`
listeners, a projection updated after commit. What makes it defensible there is that
every method in the class needs it and the cleanup can be declared once for all of them.
What makes it indefensible as a general default is that it removes order-independence
from the whole suite, and order-dependent failures are the most expensive kind to
diagnose because the failing test is not the broken one.

---

← Prev: [20h · Asserting the commit](20h-asserting-the-commit.md) · Index: [04 · Spring @Transactional](README.md) · Next → [20j · The fixture and the real database](20j-the-fixture-and-the-real-database.md)
