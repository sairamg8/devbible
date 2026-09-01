---
title: "Being the receiver of a retried request is the harder half, because the naive implementation is a check-then-act race that passes every sequential test you can write and duplicates under exactly the concurrency that a retrying client produces"
sidebar_label: "09b2 · The idempotent receiver"
sidebar_position: 43
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against **Stripe**'s *Idempotent requests* API reference
> ([docs.stripe.com](https://docs.stripe.com/api/idempotent_requests)) — every Stripe sentence
> below is verbatim from it, and it is used here as the reference implementation of a
> documented idempotent receiver; **RFC 9110** §9.2.2
> ([rfc-editor.org](https://www.rfc-editor.org/rfc/rfc9110.txt)); and the **Jakarta
> Persistence 3.2** javadoc for
> [`PersistenceException`](https://jakarta.ee/specifications/persistence/3.2/apidocs/jakarta.persistence/jakarta/persistence/persistenceexception),
> quoted verbatim for the rollback rule.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0, Spring
> Framework 7.0.8, JUnit Jupiter 6.0.3, Mockito 5.23.0, AssertJ 3.27.7.
> ⚠️ **No sandbox and no test runs on this machine** — Java source, SQL and documented
> behaviour only, never console output or a query log.

**[09b](09b-idempotency-and-the-double-charge.md) was your service retrying somebody else.
This is your service being retried — by a client following the same advice, by a broker with
at-least-once delivery, or by a webhook sender that did not get a 200 fast enough. The
assumption to start from is that **every request you serve may arrive more than once**, and
the design question is not whether to deduplicate but where the deduplication is atomic. The
obvious implementation is not, and the reason it survives review is that it passes every
sequential test anyone writes for it.**

## The assumption, stated plainly

Three independent sources of duplicates, and you get all three whether you plan for them or
not:

- **A client retrying a `POST`**, exactly as [09b](09b-idempotency-and-the-double-charge.md)
  told it to. RFC 9110 says a client may repeat a request *"if a communication failure occurs
  before the client is able to read the server's response"* — so a duplicate arriving is
  correct client behaviour, not a client bug.
- **A message broker**, essentially all of which are at-least-once by default. Redelivery
  after a consumer crash, after an acknowledgement is lost, or after a visibility timeout
  expires is normal operation. **Chunk 08 · A message consumer** in this topic owns the
  consumer-side testing; the deduplication argument is the same one.
- **A webhook sender**, which retries on any non-2xx and on a timeout, and whose timeout is
  usually shorter than you think.

🔴 **"We do not retry" is not a property you control.** The proxy in front of you may, the
client library may, the user pressing the button twice certainly will.

## The implementation that fails, and why it passes its tests

```java
@Transactional
public ChargeResponse charge(String idempotencyKey, ChargeRequest request) {
    Optional<IdempotencyRecord> existing = records.findByKey(idempotencyKey);   // check
    if (existing.isPresent()) {
        return existing.get().response();
    }
    ChargeResponse response = processor.charge(request);                        // act
    records.save(new IdempotencyRecord(idempotencyKey, response));
    return response;
}
```

Sequentially it is perfect. Call it twice and the second call returns the stored response
without touching the processor, and a test asserting `verify(processor, times(1))` passes.

Concurrently it is a check-then-act race: two requests both find nothing, both charge, and one
of the two `save` calls fails afterwards — by which time the money has moved twice. And a
retrying client is a **concurrency generator**: the retry fires because the first response was
slow, which means the first request is very likely still in flight.

## The implementation that works: let the database decide

```sql
CREATE TABLE idempotency_record (
    key            VARCHAR(255) NOT NULL,
    scope          VARCHAR(64)  NOT NULL,
    request_hash   VARCHAR(64)  NOT NULL,
    status         VARCHAR(16)  NOT NULL,   -- IN_PROGRESS | COMPLETED
    response_body  TEXT,
    response_code  INT,
    created_at     TIMESTAMP    NOT NULL,
    CONSTRAINT pk_idempotency PRIMARY KEY (scope, key)
);
```

**Insert first, then work.** The unique constraint is the only thing in the system that is
atomic across concurrent requests, so it is the thing that must decide:

```java
public ChargeResponse charge(String key, ChargeRequest request) {
    try {
        records.insertInProgress(scopeOf(request), key, hash(request));   // may violate the PK
    }
    catch (DuplicateKeyException e) {
        return replayOrConflict(scopeOf(request), key, hash(request));    // somebody got there first
    }
    ChargeResponse response = processor.charge(request);
    records.complete(scopeOf(request), key, response);
    return response;
}
```

Four design points fall out of that shape, and Stripe's documented behaviour is the reference
for each.

**1 · Store the response, not just the key.** *"Stripe's idempotency works by saving the
resulting status code and body of the first request made for any given idempotency key,
regardless of whether it succeeds or fails. Subsequent requests with the same key return the
same result, including `500` errors."* A store that only records "seen" can suppress the
duplicate but cannot answer it — and the client that retried needs an answer, not a silence.

**2 · Compare the parameters.** *"The idempotency layer compares incoming parameters to those
of the original request and errors if they're not the same to prevent accidental misuse."*
Same key, different amount, is a client bug, and answering it with the original response hides
that bug behind a plausible success. Hash the request and store the hash — that is what
`request_hash` is for.

**3 · Do not record a result for work that never started.** *"We save results only after the
execution of an endpoint begins. If incoming parameters fail validation, or the request
conflicts with another request that's executing concurrently, we don't save the idempotent
result because no API endpoint initiates the execution. You can retry these requests."* A
validation failure cached under the key means a client that fixes its payload gets the old
error forever.

**4 · Expire the keys, and say how long.** *"You can remove keys from the system automatically
after they're at least 24 hours old. We generate a new request if a key is reused after the
original is pruned."* Twenty-four hours is a documented, testable contract; "forever" is an
unbounded table.

## Where this connects

- The client side: deriving the key, persisting it, and the two-attempts-one-key test:
  [09b · Idempotency and the double charge](09b-idempotency-and-the-double-charge.md).
- The unknown-outcome vocabulary that makes a client retry in the first place:
  [03f · The failures with no status code](03f-the-failures-with-no-status-code.md).
- The 409-on-replay decision, from the other side of the wire:
  [03c · The error paths nobody writes](03c-the-error-paths-nobody-writes.md).
- The vendor double that validates the key's *presence* and never its semantics, which is why
  an adapter suite built on it has no coverage here:
  [04c · The SDK's own test double](04c-the-sdks-own-test-double.md).
- The four tests for this design — the sequential no-op, the parameter mismatch, the
  deterministic concurrency test, and the expiry window — plus the transaction boundary that
  makes a correct implementation throw at commit:
  [09b3 · Testing the idempotent receiver](09b3-testing-the-idempotent-receiver.md).
- Cache-hit tests, which are the same "did the second call reach the collaborator" assertion
  without the money: [09](09-caching-and-idempotency.md) and
  [09a](09a-the-cache-that-outlives-the-test.md).
- At-least-once delivery and the consumer-side testing of a redelivered message is
  [08 · A message consumer](08-a-message-consumer.md) in this topic.
- **Topic 07 · Testcontainers** owns running the real database that makes the constraint real.

## Gotchas

**★ Check-then-act deduplication passes every sequential test and fails under exactly the concurrency a retrying client creates.**
The client retries *because the first response was slow*, which means the first request is very probably still in flight. So the duplicate arrives during the window the naive implementation cannot see. A test that calls the method twice in sequence cannot detect this, and that is the test everybody writes.

**★ Deduplicating without storing the response leaves the retrying client with nothing.**
A store that records only "this key was seen" can suppress the second charge and cannot answer the second request. The client that retried is waiting for a charge id. Stripe's contract is explicit about saving *"the resulting status code and body"* and replaying it, *"including 500 errors"* — the response is part of the record, not a bonus.

**★ Accepting the same key with different parameters hides a client bug behind a plausible success.**
Same key, different amount, means the client reused a key it should not have. Replaying the original response tells it the new amount was charged, which it was not. Storing a hash of the request and rejecting a mismatch — *"compares incoming parameters to those of the original request and errors if they're not the same"* — is what turns that into a visible error.

**★ Recording a result for a request that failed validation makes the error permanent for that key.**
Stripe's rule is that results are saved *"only after the execution of an endpoint begins"*, and that a validation failure or a concurrent conflict is not saved because *"no API endpoint initiates the execution. You can retry these requests."* An implementation that writes the record before validating gives a client that corrects its payload the old 400 forever.

**★ An unscoped key is a cross-tenant collision waiting to happen.**
If two clients can each choose `"order-1"` as a key, the second one gets the first one's response. The key must be unique within a scope — the API key, the tenant, the merchant — and the unique constraint must be on the pair. A single-column primary key on `key` is the version that works until you have two customers.

**★ An idempotency table with no expiry is an unbounded table that eventually becomes the incident.**
Stripe publishes a 24-hour window and states what happens after it: *"We generate a new request if a key is reused after the original is pruned."* That is a contract clients can rely on and a bound on the table. Deciding not to expire is a decision to keep every key forever, including the ones from a load test.

**★ "We do not retry" is not a property of your system.**
Even if your own clients never retry, the load balancer in front of you may, an HTTP library's default retry policy may, a browser refresh will, and a queue redelivery certainly will. The receiver has to be idempotent regardless of what the senders promise, because the senders are not all yours.

## Interview questions

**★ How do you make a `POST` endpoint idempotent, and how do you test it?**
The client sends a key, and the server makes the *first write of that key* the thing that decides, rather than a read. Concretely: a table with a unique constraint on the scope plus the key, an insert of an in-progress row as the very first action, and a catch of the duplicate-key violation that replays or rejects. Everything else — the charge, the response — happens after that insert has succeeded. The tests are four. The sequential one, asserting the processor was called once *and* that the second caller still received the original response, because deduplication that answers with silence is not deduplication. A same-key-different-parameters test, which should be an error rather than a replay. A concurrency test written deterministically by pre-inserting an in-progress record rather than by launching threads. And an expiry test through an injected clock. The third one needs a real database, because the unique constraint is the mechanism and mocking the repository tests only my catch block.

**★ Why not check whether the key exists and then do the work?**
Because it is check-then-act, and the gap between the check and the write is exactly where the duplicate lands. The reason that is not a theoretical concern is that a retrying client retries *because the first response was slow* — the original request is still in flight when the retry arrives, so the duplicate is concurrent by construction rather than by bad luck. The implementation passes every sequential test, which is why it survives review. The fix is to make the database's unique constraint the arbiter: insert first, and treat the violation as "somebody else is handling this". The constraint is the only thing in the system that is atomic across two connections.

{/* FOOTER */}
