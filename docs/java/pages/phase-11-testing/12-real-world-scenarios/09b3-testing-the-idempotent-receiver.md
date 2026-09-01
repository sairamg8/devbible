---
title: "The four tests an idempotent receiver needs, and why the one everybody writes first — two threads and a latch — is flaky in the exact direction that lets the duplicate charge through"
sidebar_label: "09b3 · Testing the receiver"
sidebar_position: 44
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the **Jakarta Persistence 3.2** javadoc for
> [`PersistenceException`](https://jakarta.ee/specifications/persistence/3.2/apidocs/jakarta.persistence/jakarta/persistence/persistenceexception),
> whose rollback rule is quoted verbatim below; **Stripe**'s *Idempotent requests* API
> reference ([docs.stripe.com](https://docs.stripe.com/api/idempotent_requests)) for the
> 24-hour retention contract; and **RFC 9110** §9.2.2
> ([rfc-editor.org](https://www.rfc-editor.org/rfc/rfc9110.txt)).
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0, Spring
> Framework 7.0.8, JUnit Jupiter 6.0.3, Mockito 5.23.0, AssertJ 3.27.7.
> ⚠️ **No sandbox and no test runs on this machine** — Java source, SQL and documented
> behaviour only, never console output or a query log.

**[09b2](09b2-the-idempotent-receiver.md) argued the design: insert the key first and let the
unique constraint arbitrate, because it is the only thing in the system that is atomic across
two connections. This chunk is the test suite for it, and the interesting part is not the
first test — it is the third, where the obvious approach produces a test that passes against
the broken implementation most of the time. Plus the transaction boundary that makes a
correct implementation throw at commit, which is the failure people spend an afternoon on.**

## The tests, in the order they earn their place

### 1 · The second call is a no-op that still answers

```java
@Test
void aReplayedKeyDoesNotChargeAgainAndReturnsTheOriginalResponse() {
    given(processor.charge(any())).willReturn(new ChargeResponse("ch_1", "succeeded"));

    ChargeResponse first  = service.charge("idem-42", aChargeRequest().build());
    ChargeResponse second = service.charge("idem-42", aChargeRequest().build());

    verify(processor, times(1)).charge(any());       // 🔴 the side effect happened once
    assertThat(second).isEqualTo(first);             // 🔴 and the caller still got an answer
}
```

Both assertions are load-bearing and they fail differently: the first fails when
deduplication is missing, the second fails when deduplication was implemented as "ignore the
duplicate", which leaves the retrying client with nothing to act on.

### 2 · The same key with different parameters is rejected

```java
@Test
void reusingAKeyWithADifferentAmountIsAnError() {
    service.charge("idem-42", aChargeRequest().minorUnits(9000).build());

    assertThatThrownBy(() -> service.charge("idem-42", aChargeRequest().minorUnits(100).build()))
            .isInstanceOf(IdempotencyKeyReused.class);

    verify(processor, times(1)).charge(any());
}
```

### 3 · The concurrent duplicate — without threads

🔴 **Do not write this test with an `ExecutorService` and a latch.** A two-thread test that
asserts exactly one charge is asserting a scheduling outcome: it can pass against the broken
check-then-act version whenever the threads happen not to interleave, which is most of the
time on a fast machine and almost never on a loaded CI agent. It is flaky in the direction
that lets the bug through.

The deterministic version simulates the *state* the race produces rather than the race:

```java
@Test
void aRequestArrivingWhileAnotherIsInFlightIsRejectedRatherThanCharged() {
    records.insertInProgress("payments", "idem-42", hashOf(request));   // the other request, mid-flight

    assertThatThrownBy(() -> service.charge("idem-42", request))
            .isInstanceOf(IdempotentRequestInProgress.class);

    verifyNoInteractions(processor);
}
```

That test fails against the check-then-act implementation for a reason that is not timing
dependent: check-then-act finds no *completed* record and charges. It is the same bug,
detected deterministically.

⚠️ It needs a real database with the real constraint, which means Testcontainers —
**topic 07 · Testcontainers** owns that, and the argument against proving a unique constraint
on H2 is the same one that topic makes at length. A constraint that exists only in a
migration nobody ran in the test is not a constraint.

### 4 · The expiry window, through an injected `Clock`

```java
@Test
void aKeyOlderThanTheRetentionWindowIsTreatedAsNew() {
    service.charge("idem-42", request);
    clock.advance(Duration.ofHours(25));                   // the MutableClock from 01b

    service.charge("idem-42", request);

    verify(processor, times(2)).charge(any());
}
```

The retention window is a documented promise to your clients, so it is worth a test that
fails when somebody changes it. A wall-clock version of this test would take a day to run,
which is why the `Clock` is injected — [01b](01b-the-js-to-java-map.md)'s `MutableClock`
earning its keep again.

## 🔴 The transaction trap that makes the correct implementation incorrect

Catching the constraint violation *inside* the transaction that caused it does not work, and
the reason is documented in the Jakarta Persistence javadoc for `PersistenceException`:

> *"All instances of `PersistenceException`, except for instances of `NoResultException`,
> `NonUniqueResultException`, `LockTimeoutException`, and `QueryTimeoutException`, cause the
> current transaction, if one is active and if the persistence context has been joined to it,
> to be marked for rollback."*

A duplicate-key insert produces an `EntityExistsException`, which is none of those four. So
the transaction is marked rollback-only the moment the violation happens, your `catch` block
runs and returns the replayed response quite happily, and then the commit fails — the caller
sees a rollback error rather than the replay. The test for the replay passes only if it
crosses a real transaction boundary, which is one more reason the duplicate-path test needs a
real database rather than a mocked repository.

The structural fix is that the insert-and-catch happens in its **own** transaction, separate
from the one doing the work, so a violation rolls back nothing that matters.

## Where this connects

- The design these tests exercise — insert-first, the response store, the parameter hash and
  the retention window: [09b2 · The idempotent receiver](09b2-the-idempotent-receiver.md).
- The client side, and the two-attempts-one-key test:
  [09b · Idempotency and the double charge](09b-idempotency-and-the-double-charge.md).
- The `MutableClock` the expiry test needs:
  [01b · The JS-to-Java map](01b-the-js-to-java-map.md).
- The same "did the second call reach the collaborator" assertion without the money:
  [09 · Caching, and the cache-hit test](09-caching-and-idempotency.md).
- **Topic 07 · Testcontainers** owns running the real database that makes the unique
  constraint real, and the argument against proving a constraint on a substitute database.
- **Topic 04 · Mockito** owns `verify`, `times(n)` and `verifyNoInteractions` —
  [`../04-mockito/05-verification.md`](../04-mockito/05-verification.md) and
  [`../04-mockito/05e-verifynomoreinteractions.md`](../04-mockito/05e-verifynomoreinteractions.md).
- **Topic 08 · Test data patterns** owns the `aChargeRequest()` builder.

## Gotchas

**★ A two-thread test for the race is flaky in the direction that lets the bug through.**
It asserts a scheduling outcome. On a fast machine the interleaving that exposes check-then-act rarely happens, so the test passes against the broken code and everybody concludes the implementation is fine. Simulate the *state* — pre-insert an in-progress record — and the failure becomes deterministic.

**★ Catching the duplicate-key violation inside the same transaction leaves that transaction marked rollback-only, and the commit fails after your replay logic succeeded.**
The Jakarta Persistence javadoc is explicit: all `PersistenceException` instances except `NoResultException`, `NonUniqueResultException`, `LockTimeoutException` and `QueryTimeoutException` *"cause the current transaction […] to be marked for rollback"*. The `catch` block runs, the replay is computed, and the commit throws. The insert-and-catch needs its own transaction.

**★ A duplicate-path test against a mocked repository proves nothing, because the constraint is the mechanism.**
Mocking the repository to throw `DuplicateKeyException` tests your `catch` block, which is worth something, and it does not test that the constraint exists, that it covers the right columns, or that the migration creating it ran. Those are the parts that fail in production. The test needs a real database — **topic 07 · Testcontainers**.

**★ The expiry window is a promise, and without an injected `Clock` there is no way to test it.**
A test that waits 24 hours does not exist, so the window goes untested and the retention job's off-by-one gets discovered by a client whose legitimate retry was treated as new. Inject the `Clock`, advance it past the window, and assert that the processor is called a second time.

**★ A test asserting only `verify(processor, times(1))` passes against an implementation that swallows the duplicate and answers nothing.**
The call-count assertion detects a missing deduplication. It does not detect a deduplication that returns `null`, a default, or an empty body to the second caller — and that caller is a client waiting for a charge id in order to finish an order. `assertThat(second).isEqualTo(first)` is the second half, and it fails for a completely different reason from the first half, which is what makes both worth writing.

**★ Pre-inserting the in-progress record only proves anything if the insert goes through the same table and constraint production uses.**
The deterministic concurrency test works by setting up the state the race produces. If the test's setup writes through a mocked repository, or through a schema created by `ddl-auto` rather than by the migration, then the state it creates is not the state production would be in and the test proves nothing about the constraint. Set it up with the same repository, against the same migrated schema.

## Interview questions

**★ Your idempotency test passes against a mocked repository. What is it not proving?**
That there is a constraint. Mocking `insertInProgress` to throw `DuplicateKeyException` proves my catch block does the right thing with an exception I invented, which is worth having. It does not prove that a unique constraint exists on the table, that it covers scope *and* key rather than key alone, that the migration creating it ran in this environment, or that the database I use in production enforces it the same way. Those are the parts that break. So the duplicate path needs a real database — Testcontainers, with the real migrations applied — and running it on H2 with a compatibility mode is the same false comfort as any other constraint test on a substitute database.

**★ Where does a transaction boundary go wrong in an idempotent receiver?**
In two places, and the first one surprises people. If I catch the duplicate-key violation inside the same transaction that caused it, that transaction is already marked rollback-only — the Jakarta Persistence javadoc says every `PersistenceException` except four specific query-related ones marks the current transaction for rollback — so my catch block computes a perfectly good replayed response and then the commit throws. The insert-and-catch has to be in its own transaction. The second place is the ordering of the record and the side effect: if the side effect is a database write, the record and the write commit together and a rollback removes both, which is correct. If the side effect is an outbound call to somebody else, it cannot be part of my transaction at all, and that is exactly why the record needs an in-progress state — so a crash between the call and the completion leaves evidence that something was started, rather than a clean slate that invites a second attempt.

**★ How would you test that two concurrent identical requests produce one charge?**
Not with two threads, which is the instinctive answer and the wrong one. A test that launches two threads at a latch and asserts exactly one invocation is asserting a scheduling outcome: on a fast machine the interleaving that exposes check-then-act rarely occurs, so the test passes against the broken implementation, and it is flaky in the direction that lets the bug through rather than the direction that annoys people into fixing it. What I do instead is simulate the state the race produces rather than the race itself — pre-insert an in-progress record for the key, then call the service once and assert it is rejected as in-progress with `verifyNoInteractions(processor)`. That fails deterministically against check-then-act, because check-then-act looks for a *completed* record, finds none, and charges. It needs a real database with the real constraint and the real migrations, which is Testcontainers, because the whole mechanism under test is a unique constraint and a mock of the repository would only be testing my own catch block.

{/* FOOTER */}
