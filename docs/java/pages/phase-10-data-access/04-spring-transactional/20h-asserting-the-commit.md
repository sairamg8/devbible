---
title: "The only place a rollback can be observed is from outside the transaction that was rolled back — which is why the assertion belongs in @AfterTransaction or after TestTransaction.end()"
sidebar_label: "20h · Asserting the commit"
sidebar_position: 60
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Spring Framework 7.0 reference *Testing →
> TestContext Framework → Transaction management*
> ([docs.spring.io/spring-framework/reference/testing/testcontext-framework/tx.html](https://docs.spring.io/spring-framework/reference/testing/testcontext-framework/tx.html)),
> the `TestTransaction`
> ([.../test/context/transaction/TestTransaction.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/test/context/transaction/TestTransaction.html)),
> `@Commit` ([.../test/annotation/Commit.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/test/annotation/Commit.html))
> and `TransactionSynchronization`
> ([.../transaction/support/TransactionSynchronization.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/support/TransactionSynchronization.html))
> javadocs.
> JDK 25, Spring Framework 7.0.9, Spring Boot 4.1.1.

**"The order was rolled back" is not something you can see from inside the
transaction that was rolled back. Nothing has happened yet — the writes are pending
and visible only to you. The claim only becomes observable once the boundary closes,
so the assertion has to live somewhere the boundary has already closed: after
`TestTransaction.end()`, in an `@AfterTransaction` method, or in a genuinely separate
transaction.**

## Why the obvious test proves nothing

Here is the rollback test almost everyone writes first:

```java
@Test
@Transactional                              // ⛔ the test's transaction
void rolls_back_when_payment_fails() {
    assertThatThrownBy(() -> orders.place(badCard))
            .isInstanceOf(PaymentDeclinedException.class);

    assertThat(repository.count()).isZero();   // ⛔ proves nothing
}
```

Three separate problems, and each one alone is enough to make the test worthless:

1. **The service participated in the test's transaction.** Under `REQUIRED`, `place()`
   did not start a boundary of its own — it joined the one the test opened. So there
   was no commit and no rollback of the service's work; there was one open transaction
   the whole time.
2. **The count is read from inside that transaction.** Whatever the service wrote is
   visible to it, and whatever it did not write is absent. The assertion cannot
   distinguish "rolled back" from "never written".
3. **If the service *had* rolled back**, the test transaction would now be
   rollback-only and the assertion would be reading a doomed transaction — the subject
   of [9 · Marked rollback-only](09-marked-rollback-only.md).

The test passes. It would also pass if `place()` had no `@Transactional` at all, or if
the exception were thrown before any write. It is a test of `assertThatThrownBy`.

## Shape one: `@AfterTransaction`

The reference names this exact use case:

> Occasionally, you may need to run certain code before or after a transactional test
> method but outside the transactional context — for example, to verify the initial
> database state prior to running your test or to verify expected transactional commit
> behavior after your test runs (if the test was configured to commit the
> transaction).

```java
@AfterTransaction
void verifyFinalDatabaseState() {
    // logic to verify the final state after transaction has rolled back
}
```

That comment is the reference's own. `@AfterTransaction` runs **after** the
test-managed transaction has been resolved, so a read there is a read from a fresh
connection state and sees only committed data. For JUnit Jupiter with
`SpringExtension` the method can take injected parameters, which is how you get a
`DataSource` or a `JdbcTemplate` in without a field:

```java
@AfterTransaction
void nothing_survived(@Autowired JdbcTemplate jdbc) {
    assertThat(JdbcTestUtils.countRowsInTable(jdbc, "orders")).isZero();
}
```

⚠️ The restriction from [20](20-transactions-in-tests.md) applies: "methods annotated
with `@BeforeTransaction` or `@AfterTransaction` are only run for transactional test
methods". On a mixed class they fire for some tests and not others, silently. And the
hook has no idea which test it is running after, so a class with several tests needs
the assertion to be true for all of them — which usually means one test class per
scenario, or the next shape instead.

## Shape two: `TestTransaction`, so the assertion runs after a real commit

The reference's own example is a two-phase test, and it is the template for every
"did this really commit" assertion:

```java
@Test
public void transactionalTest() {
    // assert initial state in test database:
    assertNumUsers(2);

    deleteFromTables("user");

    // changes to the database will be committed!
    TestTransaction.flagForCommit();
    TestTransaction.end();
    assertFalse(TestTransaction.isActive());
    assertNumUsers(0);

    TestTransaction.start();
    // perform other actions against the database that will
    // be automatically rolled back after the test completes...
}
```

Note the `assertFalse(TestTransaction.isActive())` in the middle. That is not
decoration — it is the assertion that the boundary really closed, and without it the
following `assertNumUsers(0)` could still be an inside-the-transaction read. Copy
that line.

For a **rollback** claim the sequence inverts, and the important part is that the
failure must happen inside a boundary the *service* owns:

```java
@Test
void a_declined_payment_leaves_nothing_behind() {
    // no @Transactional on this test: place() opens its own boundary and closes it
    assertThatThrownBy(() -> orders.place(badCard))
            .isInstanceOf(PaymentDeclinedException.class);

    // a completely separate read, after the service's transaction resolved
    assertThat(JdbcTestUtils.countRowsInTable(jdbc, "orders")).isZero();
    assertThat(JdbcTestUtils.countRowsInTable(jdbc, "order_lines")).isZero();
}
```

🔴 **Assert on the child rows too.** A rollback test that only counts the aggregate
root passes even when a cascade half-committed, and half-committed children are the
failure this whole family of tests exists to catch.

## Shape three: a synchronization that records the outcome

Where you want the *outcome* rather than its effects — "did this commit or roll back"
— `TransactionSynchronization.afterCompletion(int status)` is handed it directly, and
the constants are documented:

| Constant | Javadoc |
|---|---|
| `STATUS_COMMITTED` | "Completion status in case of proper commit." |
| `STATUS_ROLLED_BACK` | "Completion status in case of proper rollback." |
| `STATUS_UNKNOWN` | "Completion status in case of heuristic mixed completion or system errors." |

```java
List<Integer> outcomes = new ArrayList<>();
// registered from inside the boundary, e.g. from a stubbed collaborator
TransactionSynchronizationManager.registerSynchronization(
    new TransactionSynchronization() {
        @Override public void afterCompletion(int status) { outcomes.add(status); }
    });
...
assertThat(outcomes).containsExactly(TransactionSynchronization.STATUS_ROLLED_BACK);
```

This is the sharpest available answer to "did the boundary roll back", because it does
not depend on any row being present or absent. It is also the one that distinguishes
*one* boundary from *two*: a `REQUIRES_NEW` inner call produces two completions, a
participating call produces one.

⚠️ Do not assert *inside* the callback. Its javadoc says exceptions there "will be
logged but not propagated" — an `AssertionError` thrown in `afterCompletion` vanishes
into a log line and the test passes. Collect and assert afterwards.

## Gotchas

**⚠️ A rollback assertion made from inside the test's own transaction**
**Symptom:** a green rollback test that would pass with no `@Transactional` on the
service at all.
**Cause:** under `REQUIRED` the service joined the test's transaction, so nothing
committed and nothing rolled back; the read sees the same pending state either way.
**Fix:** assert after the boundary closes — `@AfterTransaction`, after
`TestTransaction.end()`, or from a test that is not transactional at all.

**⚠️ Omitting `assertFalse(TestTransaction.isActive())`**
**Symptom:** a two-phase test that silently degrades to a one-phase one.
**Cause:** if `end()` did not run — a branch, an early return, an exception — the
following assertion is an inside-the-transaction read again.
**Fix:** keep the reference's own `isActive()` check between `end()` and the
assertion.

**⚠️ A rollback test that counts only the aggregate root**
**Symptom:** a half-committed cascade goes undetected.
**Cause:** the parent row is absent and the assertion is satisfied, while child rows or
a join table survived.
**Fix:** assert on every table the operation touches, including join tables.

**⚠️ Asserting inside `afterCompletion`**
**Symptom:** the test passes even though the assertion is false.
**Cause:** the javadoc: exceptions in `afterCompletion` "will be logged but not
propagated". An `AssertionError` disappears.
**Fix:** record the status in the callback, assert in the test method.

## Interview questions

**★ Write me a test that proves a service rolls back when payment is declined. What is
wrong with the obvious one?**
The obvious one annotates the test `@Transactional`, calls the service, catches the
exception and asserts the row count is zero. It proves nothing, for three reasons.
Under `REQUIRED` the service joined the test's transaction rather than opening its
own, so there was neither a commit nor a rollback of its work. The count is read from
inside that same transaction, so it cannot distinguish "rolled back" from "never
written". And if the service *had* marked the transaction rollback-only, the assertion
would be reading a doomed transaction. The honest version drops the class-level
annotation so the service owns its boundary, and reads the tables afterwards on a
plain `JdbcTemplate` — asserting on the child tables as well as the root, because a
half-committed cascade is the actual failure being hunted.

**★ Where can a rollback assertion legally live?**
Anywhere the boundary has already closed. Three places: an `@AfterTransaction` method,
which the reference documents for exactly this — "to verify expected transactional
commit behavior after your test runs"; after a `TestTransaction.end()`, which
"immediately force[s] a commit or rollback of the current test-managed transaction";
or in a test with no test-managed transaction at all, where the service's own boundary
opens and closes inside the call. What does not work is any read taken while the
transaction under test is still open, because uncommitted state is fully visible to
its own transaction and to nothing else.

**★ In the reference's `TestTransaction` example, what is the
`assertFalse(TestTransaction.isActive())` line doing?**
Asserting that the boundary actually closed, which the assertion after it depends on.
`end()` is documented to "immediately force a commit or rollback of the current
test-managed transaction, according to the rollback flag", but if it was skipped — a
branch, an early return, a swallowed exception — the following read is once again an
inside-the-transaction read and the test silently degrades to the useless shape. It is
one line and it converts a subtle false positive into a clear failure, which is why the
reference has it in the example rather than in the prose.

**★ How would you assert that a boundary rolled back without looking at any row?**
Register a `TransactionSynchronization` from inside the boundary and record the
argument to `afterCompletion(int status)`, then compare it against
`STATUS_ROLLED_BACK` — "Completion status in case of proper rollback" — after the call
returns. It is the sharpest form of the assertion because it does not depend on which
tables were touched or on any row being absent, and it is the only easy way to
distinguish one boundary from two: a `REQUIRES_NEW` inner call produces two
completions where a participating call produces one. The one rule is not to assert
inside the callback: `afterCompletion`'s exceptions are documented as "logged but not
propagated", so a failed assertion there vanishes and the test passes.

---

← Prev: [20g · Asserting the settings](20g-asserting-the-settings.md) · Index: [04 · Spring @Transactional](README.md) · Next → [20i · Committing, and what participates](20i-committing-and-what-participates.md)
