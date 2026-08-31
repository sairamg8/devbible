---
title: "The three SQLStates everyone expects to be portable are portable — and the two that are not are exactly the two nobody checks, including a 40001 that means the opposite thing on each engine"
sidebar_label: "01h2 · What a violation raises"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the **H2 `org.h2.api.ErrorCode` javadoc**
> ([h2database.com/javadoc](https://www.h2database.com/javadoc/org/h2/api/ErrorCode.html)) — the
> constants `DUPLICATE_KEY_1` (23505), `NULL_NOT_ALLOWED` (23502),
> `REFERENTIAL_INTEGRITY_VIOLATED_CHILD_EXISTS_1` (23503), `CHECK_CONSTRAINT_VIOLATED_1` (23513)
> and `DEADLOCK_1` (40001) were read there directly — the **PostgreSQL 18 manual**, *Error Codes*
> ([errcodes-appendix](https://www.postgresql.org/docs/18/errcodes-appendix.html)) and
> *Transaction Isolation*
> ([transaction-iso](https://www.postgresql.org/docs/18/transaction-iso.html)) — and **Spring
> Framework 7.0.8 source read at tag `v7.0.8`**:
> [`SQLStateSQLExceptionTranslator.java`](https://github.com/spring-projects/spring-framework/blob/v7.0.8/spring-jdbc/src/main/java/org/springframework/jdbc/support/SQLStateSQLExceptionTranslator.java)
> and
> [`SQLExceptionSubclassTranslator.java`](https://github.com/spring-projects/spring-framework/blob/v7.0.8/spring-jdbc/src/main/java/org/springframework/jdbc/support/SQLExceptionSubclassTranslator.java).
> Version spine: JDK 25, Spring Boot 4.1.0, Spring Framework 7.0.8, Testcontainers 2.0.5,
> **H2 2.4.240**, PostgreSQL JDBC 42.7.11, JUnit Jupiter 6.0.3.
> ⚠️ **No Docker, no PostgreSQL and no sandbox on this machine.** Nothing here is a query log, a
> timing or a test run.

**[01h](01h-isolation-and-locking.md) covered what a transaction protects. This page covers what
happens when the protection fires — the SQLState, the exception, and the branch in your code that
inspects it. The divergence here has an unusual shape: *most* of the error surface really is
portable, and that is why the two cases that are not blindside people. A handler keyed on the wrong
number is dead code that its own test reports as covered.**
## What the engine actually raises

### The failure a conflict produces is a different failure

This is the divergence with the most code hanging off it, and it is fully documented on both
sides.

On PostgreSQL at `REPEATABLE READ` or above, losing a write race is a **rollback with a
serialization failure**:

> *"if the first updater commits (and actually updated or deleted the row, not just locked it)
> then the repeatable read transaction will be rolled back with the message*
> `ERROR: could not serialize access due to concurrent update`*"*

On H2 the same contention is a **wait, then a timeout**:

> *"If multiple connections concurrently try to lock or update the same row, the database waits
> until it can apply the change, but at most until the lock timeout expires."*

Different event, different exception, different code path, and — this is the part that catches
people — different meaning for the same SQLState:

| Condition | PostgreSQL 18 | H2 2.4.240 |
|---|---|---|
| unique violation | `23505` `unique_violation` | `23505` `DUPLICATE_KEY_1` |
| not-null violation | `23502` `not_null_violation` | `23502` `NULL_NOT_ALLOWED` |
| foreign key violation | `23503` `foreign_key_violation` | `23503` `REFERENTIAL_INTEGRITY_VIOLATED_*` |
| **check constraint violation** | **`23514`** `check_violation` | **`23513`** `CHECK_CONSTRAINT_VIOLATED_1` |
| exclusion constraint | `23P01` `exclusion_violation` | no exclusion constraints |
| **serialization failure** | **`40001`** `serialization_failure` | — |
| **deadlock** | **`40P01`** `deadlock_detected` | **`40001`** `DEADLOCK_1` |

The three everyone expects to be portable are portable. The two that are not are exactly the two
nobody checks.

**Check constraints.** A handler keyed on PostgreSQL's `23514` is dead code on H2, which sends
`23513`:

```java
catch (DataIntegrityViolationException ex) {
    if (ex.getCause() instanceof SQLException sql && "23514".equals(sql.getSQLState())) {
        throw new BusinessRuleViolation("quantity must be positive");   // never reached on H2
    }
    throw ex;
}
```

The test that covers this branch on H2 falls through to the `throw ex`, so it asserts
`DataIntegrityViolationException` — and passes, because that *is* what gets thrown. The branch
you wanted to test was never entered.

**Retry logic, which is the same trap with the sign flipped.** Spring Framework 7.0.8 translates
`40001` in one line:

```java
static boolean indicatesCannotAcquireLock(@Nullable String sqlState) {
    return "40001".equals(sqlState);
}
```

`40001` maps to `CannotAcquireLockException` on both engines. But `40001` *means* a serialization
failure on PostgreSQL and a **deadlock** on H2, and a PostgreSQL deadlock is `40P01`, which is
class `40` but not `40001`, so it becomes the parent `PessimisticLockingFailureException`
instead. Therefore:

```java
@Retryable(retryFor = CannotAcquireLockException.class, maxAttempts = 3)
public void transfer(...) { ... }
```

retries **deadlocks** on H2 and **serialization failures** on PostgreSQL, and does not retry a
PostgreSQL deadlock at all. A green test "proving we retry on conflict" proved it for a different
conflict than the one production will hit.

Note also what Spring's translation hides. `SQLStateSQLExceptionTranslator` groups the whole
class-`23` prefix into `DataIntegrityViolationException` and, per its own source,
`indicatesDuplicateKey` returns true for `"23505"`. So `DuplicateKeyException` is genuinely
portable — which is exactly why teams conclude the error surface as a whole is portable, and get
blindsided by the two cases that are not.


## The message text, and the code that reads it

Even where the SQLState agrees, the *shape* of the exception does not. pgJDBC exposes structured
server fields:

```java
// Compiles and runs only against PostgreSQL. There is no H2 equivalent accessor.
catch (DataIntegrityViolationException ex) {
    if (ex.getMostSpecificCause() instanceof PSQLException psql) {
        String constraint = psql.getServerErrorMessage().getConstraint();   // "uk_account_email"
        ...
    }
}
```

H2's integrity-violation exceptions carry no constraint accessor, so the only way to identify
*which* constraint fired on H2 is to parse the message — and the message format is H2's. Any code
that distinguishes "duplicate email" from "duplicate external id" is therefore written against one
engine's error surface, and the test that covers it is a test of that engine.

The practical consequence: the branch is unreachable in the test if the test runs on the other
engine, and a `catch` that falls through to a rethrow still satisfies an
`assertThatThrownBy(...).isInstanceOf(DataIntegrityViolationException.class)` assertion. The
assertion is about the *supertype*, so it passes whether or not the specific branch ran.

## Gotchas

**★ SQLState `40001` means "serialization failure" on PostgreSQL and "deadlock" on H2.**
And a PostgreSQL deadlock is `40P01`, not `40001`. Spring's
`SQLStateSQLExceptionTranslator.indicatesCannotAcquireLock` returns true only for `"40001"`, so
`@Retryable(retryFor = CannotAcquireLockException.class)` retries different events on the two
engines and misses a PostgreSQL deadlock entirely. If you retry on lock conflicts, retry on
`PessimisticLockingFailureException` — the parent — and run the test on the engine you deploy.

**★ A check-constraint violation is `23514` on PostgreSQL and `23513` on H2.**
A handler keyed on `23514` is dead code under H2. Worse, the test still passes: the branch falls
through, rethrows a `DataIntegrityViolationException`, and that is what the test asserted. A
completely unreached branch looks covered.

**★ The three portable codes are the reason the two non-portable ones are missed.**
`23505`, `23502` and `23503` are identical on both engines, so the first three times anyone checks,
the error surface looks portable and the checking stops. That is the general mechanism behind most
of this catalogue: a divergence hides best inside a large region of agreement.

**★ Spring's translation deliberately hides both divergences, which is usually right and occasionally fatal.**
`SQLStateSQLExceptionTranslator` groups the whole class-`23` prefix into
`DataIntegrityViolationException`, so `23513` and `23514` both arrive as the same Spring exception.
Class `40` groups into `PessimisticLockingFailureException`, so `40001` and `40P01` both arrive as
lock failures. Program against Spring's hierarchy and you are portable. The moment you reach past
it for a raw SQLState — which is the only way to distinguish a check violation from a foreign-key
violation — you are engine-specific and the test will not tell you.

**★ `DuplicateKeyException` really is portable, and the source says why in one line.**
`indicatesDuplicateKey` returns true for `"23505"`, or `"23000"` plus a vendor error code from a
known list. Both engines send `23505`, so `catch (DuplicateKeyException e)` behaves the same. This
is worth knowing precisely because it is the case people generalise from.

**★ PostgreSQL has exclusion constraints and H2 has no equivalent, so `23P01` has no counterpart at all.**
An `EXCLUDE USING gist (room WITH =, during WITH &&)` — the standard way to forbid overlapping
bookings — cannot exist in the H2 schema. The migration does not run, the constraint is absent, and
a test asserting that an overlapping booking is rejected fails on H2 for a reason unrelated to your
code. The usual outcome is that the test is deleted.

**★ A retry test that passes proves the retry fires for *some* exception, not the right one.**
The way these tests are usually written is to make a repository stub throw
`CannotAcquireLockException` and assert the method is called three times. That verifies Spring
Retry's configuration and nothing about which database condition produces that exception. The
mapping from a real conflict to a Spring exception is the part that diverges, and a stubbed
exception skips exactly that step.

**★ Parsing a constraint name out of an exception message is engine-specific and looks portable in review.**
`ex.getMessage().contains("uk_account_email")` reads like plain string handling and is in fact a
dependency on one vendor's message format. pgJDBC offers a structured accessor —
`getServerErrorMessage().getConstraint()` — and H2 offers none, so there is no way to write this
once. If you must distinguish constraints, prefer catching the violation and re-checking the
business condition explicitly, which is portable and readable.

**★ H2 reports a lock timeout, not a deadlock, for most contention — and its `DEADLOCK_1` is a different event.**
H2's `LOCK_TIMEOUT_1` fires when a connection cannot acquire a lock within the timeout; its
`DEADLOCK_1` (40001) fires when the engine has actually detected a deadlock. Because most H2
contention resolves as a timeout, the `40001` path is rarely exercised even on H2 — so a
`CannotAcquireLockException` handler can be untested on *both* engines while looking covered on
one.

## Interview questions

**★ A retry mechanism keyed on `CannotAcquireLockException` passes its test. Why might it still be wrong?**
Because Spring derives that exception from SQLState `40001` and only `40001` — the source is one
line, `return "40001".equals(sqlState)`. On PostgreSQL `40001` is `serialization_failure`; on H2
`40001` is a deadlock. And PostgreSQL signals a deadlock as `40P01`, which falls through to the
parent `PessimisticLockingFailureException` and is therefore not retried at all. So the test proved
the retry fires for the conflict *H2* produces. Retry on `PessimisticLockingFailureException`, and
run the test on the engine you deploy with two real connections.

**★ Which SQLStates are portable between H2 and PostgreSQL, and which are not?**
`23505` unique violation, `23502` not-null and `23503` foreign key are the same on both. Check
constraints are not: PostgreSQL uses `23514`, H2 uses `23513`. Exclusion constraints are `23P01` on
PostgreSQL and do not exist in H2 at all. And the class-40 codes are inverted: `40001` is a
serialization failure on PostgreSQL and a deadlock on H2, while a PostgreSQL deadlock is `40P01`.
The portable majority is the problem — it convinces people the whole surface is portable, and the
two exceptions are in the two branches that get written least often and reviewed least carefully.

**★ How can a `catch` branch be dead code and still show as covered by a passing test?**
Because the test asserts on the exception type that gets rethrown, not on the branch. Write a
handler that checks for SQLState `23514` and throws a domain exception, run it on H2 where the code
is `23513`, and the condition is false, so control falls to the rethrow. The test —
`assertThatThrownBy(...).isInstanceOf(DataIntegrityViolationException.class)` — passes, because
that is what came out. Coverage tooling may even mark the `catch` block as executed. The fix on the
test side is to assert on the *domain* exception you meant to produce; the fix on the engine side
is to run it on the engine that will produce the code.

**★ Should application code branch on SQLStates at all?**
Sparingly, and never as the first choice. Spring's `DataAccessException` hierarchy already gives
you `DuplicateKeyException`, `DataIntegrityViolationException`, `CannotAcquireLockException` and
`PessimisticLockingFailureException`, and those are portable because the translation is
SQLState-class based. Reach past the hierarchy only when you need a distinction it does not make —
telling a check violation from a foreign-key violation, or telling *which* unique constraint fired
— and when you do, accept that you have written engine-specific code and test it on that engine.
The alternative that is usually better: catch the broad violation and re-derive the business reason
with an explicit query, which is portable and says what it means.

**★ Why does the error surface make a good interview question about testing in general?**
Because it is the cleanest case where the *test itself* is complicit. Every other divergence in
this catalogue produces a wrong answer that a sufficiently paranoid assertion could catch. Here the
assertion is on a supertype, so the assertion is *correct* — the exception really is a
`DataIntegrityViolationException` — while the behaviour you cared about never happened. It teaches
the habit of asking what an assertion excludes, not just what it includes: an assertion that would
also pass if the interesting code were deleted is not evidence about that code.

{/* FOOTER */}
