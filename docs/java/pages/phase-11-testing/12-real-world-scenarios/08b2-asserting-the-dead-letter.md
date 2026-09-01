---
title: "Dead-lettering and continuing to consume are two behaviours that fail independently, so they need two assertions — and the second one, publishing a good message after the poison one, is the test that maps onto the incident people actually have"
sidebar_label: "08b2 · Asserting the dead letter"
sidebar_position: 67
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the **Spring for Apache Kafka** `DeadLetterPublishingRecoverer`
> javadoc
> ([docs.spring.io](https://docs.spring.io/spring-kafka/api/org/springframework/kafka/listener/DeadLetterPublishingRecoverer.html)),
> the reference *Handling Exceptions*
> ([docs.spring.io](https://docs.spring.io/spring-kafka/reference/kafka/annotation-error-handling.html))
> and *Testing Applications*
> ([docs.spring.io](https://docs.spring.io/spring-kafka/reference/testing.html)) for
> `KafkaTestUtils`; and the **Awaitility 4.3.0** `ConditionFactory` javadoc
> ([javadoc.io](https://javadoc.io/static/org.awaitility/awaitility/4.3.0/org/awaitility/core/ConditionFactory.html)).
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0, Spring
> Framework 7.0.8, JUnit Jupiter 6.0.3, Mockito 5.23.0, AssertJ 3.27.7, Testcontainers 2.0.5,
> Awaitility 4.3.0.
> ⚠️ **No sandbox, no Docker and no broker on this machine** — Java source and documented
> behaviour only. 🔴 **No container logs, no run output, no timings anywhere on this page.**

**[08b](08b-the-container-poison-messages-and-redelivery.md) established what the container
does with a message the handler refuses. This chunk is the assertions: how you prove the
message reached the dead-letter destination with its cause attached, how you prove the
consumer did not wedge, and what at-least-once delivery obliges every one of these tests to
assume.**

## Asserting that a message was dead-lettered

The dead-letter destination is just another destination, so the assertion is: consume from it,
in the test, with a bound.

For Kafka the naming is a documented default rather than a convention you invent. The
`DeadLetterPublishingRecoverer` javadoc describes its default constructor as creating

> *"an instance with the provided template and a default destination resolving function that
> returns a `TopicPartition` based on the original topic (appended with `"-dlt"`) from the
> failed record and the same partition as the failed record."*

with the consequence the reference draws out: the dead-letter topic *"must have at least as
many partitions as the original topic"*. And the recoverer enriches the record with headers
whose names are worth asserting on, because they are what an on-call engineer will read —
`KafkaHeaders.DLT_EXCEPTION_FQCN`, `DLT_EXCEPTION_MESSAGE`, `DLT_EXCEPTION_STACKTRACE`,
`DLT_ORIGINAL_TOPIC`, `DLT_ORIGINAL_PARTITION`, `DLT_ORIGINAL_OFFSET`,
`DLT_ORIGINAL_TIMESTAMP` and `DLT_ORIGINAL_CONSUMER_GROUP`.

```java
@Test
void anUnprocessableEventIsDeadLetteredWithItsCause() {
    template.send("payment-events", "evt-bad", anEventWithUnknownAccount());

    await().alias("dead-letter record")
           .atMost(Duration.ofSeconds(10))
           .untilAsserted(() -> {
               ConsumerRecord<String, byte[]> dlt =
                       KafkaTestUtils.getSingleRecord(dltConsumer, "payment-events-dlt");
               assertThat(dlt.key()).isEqualTo("evt-bad");
               assertThat(header(dlt, KafkaHeaders.DLT_EXCEPTION_FQCN))
                       .isEqualTo(UnknownAccountException.class.getName());
               assertThat(header(dlt, KafkaHeaders.DLT_ORIGINAL_TOPIC))
                       .isEqualTo("payment-events");
           });
}
```

`KafkaTestUtils.getSingleRecord(consumer, topic)` is documented as *"Poll the consumer,
expecting a single record for the specified topic"* and as failing *"if exactly one record is
not received"*, which is the assertion you want — one dead-letter record, not one-or-more.

The AMQP equivalent declares the dead-letter exchange and queue in the test's configuration
and drains it with a `RabbitTemplate` receive, with the same `await` bound around it. The
mechanics differ; the shape of the test does not.

## The assertion nobody writes: that the consumer kept going

Dead-lettering is only half the requirement. The other half is that the consumer **did not
stop** — that message *n+1* was processed after message *n* was rejected. A test that only
asserts the dead-letter record passes just as happily when the container has wedged itself on
a stalled partition, which is the actual production incident.

```java
@Test
void aPoisonMessageDoesNotStopTheStream() {
    template.send("payment-events", "evt-bad", anEventWithUnknownAccount());
    template.send("payment-events", "evt-good", anEvent("acct-9", cents(2500)));

    await().alias("stream continued past the poison message")
           .atMost(Duration.ofSeconds(15))
           .untilAsserted(() -> assertThat(ledger.balanceOf("acct-9")).isEqualTo(cents(2500)));
}
```

Two messages, one assertion, and it is the single most valuable container test in the file —
it fails when the retry policy is unbounded, when the error handler is misconfigured, when
the dead-letter topic has too few partitions for the recoverer to publish to, and when
someone catches an exception in the handler and rethrows it as something the classification
does not cover.

## What at-least-once obliges you to prove

Every assertion on this page rests on a delivery guarantee that is weaker than people design
for. At-least-once means the broker will redeliver rather than risk losing a message, and it
follows that four properties are requirements rather than nice-to-haves:

1. **The effect is idempotent.** Not "the handler is idempotent" — the *effect*. A ledger
   credit guarded by a processed-events row, a unique constraint the second attempt hits, an
   upsert keyed by the producer's event id. Tested in [08](08-a-message-consumer.md)'s
   population A, in microseconds, and it is the cheapest test in the file.
2. **Terminal failures terminate.** A message that can never succeed must stop being retried,
   or the consumer spends its life on it. This is the classification argument from
   [08b](08b-the-container-poison-messages-and-redelivery.md).
3. **Ordering assumptions are written down.** Redelivery reorders. Kafka's documented seek
   behaviour re-fetches unprocessed records from other partitions, so a handler that assumed
   "event B always arrives after event A" is relying on something the broker never promised
   across partitions. If order matters, it matters within a partition key, and the key choice
   is a design decision with a test.
4. **The acknowledgement boundary is deliberate.** Whether the offset commits before or after
   your database transaction decides whether a crash produces a duplicate or a loss. Both are
   defensible; neither is defensible by accident. This is the one property on the list that
   has no cheap test — it is a design review item, and the honest thing to write in the test
   file is a comment saying which one was chosen.

## The cost, and how to keep it

A container test is expensive in a way a handler test is not, and being explicit about the
budget is what stops the whole category being abandoned after the suite gets slow.

- **Container startup** is topic 07's problem and topic 07's solution — the singleton pattern
  and reuse are exactly what stop each test class paying for a new broker. Read
  [../07-testcontainers/README.md](../07-testcontainers/README.md) before adding the second
  test class.
- **Back-off is yours.** Three attempts a second apart is three seconds per exhaustion test.
  Make it a property, zero it in the test profile, and accept the trade named in the gotchas
  below.
- **Waiting is bounded by you.** Every `await` gets an explicit `atMost` and an `alias`; a
  default ten-second timeout multiplied by a handful of failing container tests is a minute
  of CI spent learning nothing.
- **The count is small on purpose.** One smoke test, one dead-letter test, one keeps-going
  test per listener. Everything else belongs in population A.

## Where this connects

- What the container actually does with a refused message, and the defaults that decide it:
  [08b · The container and poison messages](08b-the-container-poison-messages-and-redelivery.md).
- The handler tests that discharge obligation 1 at microsecond cost:
  [08 · A message consumer](08-a-message-consumer.md).
- The conversion boundary and the "cannot prove" list:
  [08a · The payload and the boundary](08a-the-payload-and-the-boundary.md).
- 🔴 Container lifecycle, singletons, reuse, startup cost:
  **topic 07**, [../07-testcontainers/README.md](../07-testcontainers/README.md).
- `alias`, `failFast` and bounding the wait:
  [07a · Waiting without sleeping](07a-waiting-without-sleeping.md).
- Test data for the messages themselves: **topic 08**,
  [../08-test-data-patterns/README.md](../08-test-data-patterns/README.md).

## Gotchas

**★ The dead-letter topic must have at least as many partitions as the original, or the recoverer cannot publish.**
The default resolver targets *"the same partition as the original record"*, so a one-partition DLT behind a six-partition topic fails to publish for five sixths of the traffic. The failure happens inside the error handler, which is the least visible place in the whole pipeline.

**★ The dead-letter suffix is a default, not a law, and it has not always been the same string.**
The current javadoc documents `"-dlt"`. Configuration copied from an older codebase, or a team that adopted `@RetryableTopic`'s conventions, may be pointing a monitor at a topic nothing publishes to. Configure the destination resolver explicitly and assert the name in the test rather than trusting either the default or your memory of it.

**★ A test that asserts the dead-letter record and nothing else passes on a wedged consumer.**
Dead-lettering the poison message and continuing to consume are two separate behaviours. Publish a good message after the bad one and assert its effect; that is the test that fails when the partition has stalled.

**★ Consuming from the dead-letter topic in the test requires a consumer that is not in the application's group.**
Sharing the application's `groupId` means the test's consumer and the application's container compete for partitions, and the test's assertion becomes a race it usually loses. Give the test consumer its own group and start it from the earliest offset, or the record you are asserting on may have been read by something else.

**★ Asserting only that "something was dead-lettered" does not prove the classification worked.**
A message dead-lettered after ten futile retries and one dead-lettered immediately as terminal are the same record on the same topic. The difference is visible in `DLT_EXCEPTION_FQCN`, so assert on the exception type rather than on the record's existence — otherwise the test passes when someone widens the retryable set and the consumer starts burning ten attempts on validation failures.

**★ A test consumer left polling from the earliest offset sees records from earlier tests in the same class.**
Container reuse and a shared broker mean the dead-letter topic accumulates. `getSingleRecord` is documented to fail *"if exactly one record is not received"*, which turns leakage from a previous test into a confusing failure in this one. Use a distinct key per test and assert on it, or a fresh topic name per test class.

**★ Publishing the good message before the poison one tests nothing about wedging.**
The order matters and it is easy to write backwards. If the good message is processed first, its effect is asserted regardless of what the poison message later does to the consumer. The poison message must come first.

**★ Awaiting the ledger effect without a `failFast` on the dead-letter topic wastes the full timeout on every genuine failure.**
When the good message has been dead-lettered too — because the classification is wrong — the ledger assertion can never pass, and the test spends its entire `atMost` window discovering that. A `failFast` that asserts the dead-letter topic holds no record for the *good* key turns fifteen seconds into an immediate, correctly-named failure.

**★ The acknowledgement boundary has no cheap test, and pretending otherwise is worse than admitting it.**
Whether the offset commits before or after the database transaction determines whether a crash duplicates or loses, and reproducing a crash at the right instant in a test is not practical. Write down which behaviour was chosen and why, next to the tests, and treat it as a review item. A test that claims to cover it usually only covers the happy path with different words.

## Interview questions

**★ How do you assert that a message ended up on a dead-letter queue?**
By consuming from it, because it is just another destination. For Kafka the topic name has a documented default — the recoverer resolves *"the original topic (appended with `-dlt`) … and the same partition as the failed record"* — and `KafkaTestUtils.getSingleRecord(consumer, topic)` is documented to fail *"if exactly one record is not received"*, which gives me the exactly-one assertion I want rather than at-least-one. I would also assert on the headers the recoverer adds, particularly `DLT_EXCEPTION_FQCN` and `DLT_ORIGINAL_TOPIC`, because those are what an on-call engineer reads and because asserting the exception type proves the *classification* worked, not merely that something failed. The test consumer needs its own consumer group, or it competes with the application's container for partitions. And I would never let that be the only assertion — I publish a good message after the bad one and assert it was processed, because dead-lettering and continuing are two different behaviours and a stalled consumer passes the first test.

**★ Why is "the consumer kept consuming" a separate assertion from "the message was dead-lettered"?**
Because they fail independently and the second one failing is the actual outage. Dead-lettering can succeed while the consumer is left in a state where it cannot make progress — a partition it has seeked back to and cannot get past, an error handler that throws inside itself, a dead-letter topic with too few partitions so the publish fails and the record is retried again. In every one of those cases an assertion on the dead-letter record can still pass, because at least one record did get there before the wheels came off, or because the assertion ran on an earlier attempt. The test that catches it publishes a valid message after the poison one and asserts *its* effect: if the stream is stalled, the good message is never processed and the wait times out. It is two lines more than the test people write and it is the one that maps onto the incident.

**★ What does at-least-once delivery actually oblige your consumer to prove?**
Four things, and only one of them is usually written down. The effect has to be idempotent — not the handler, the *effect*, because a handler that checks a flag it then fails to commit in the same transaction is not idempotent at all. Terminal failures have to actually terminate, or a message that can never succeed becomes the consumer's whole workload. Ordering assumptions have to be explicit, because redelivery reorders and Kafka's documented seek behaviour re-delivers unprocessed records from other partitions, so any "B always follows A" assumption across partitions was never guaranteed. And the acknowledgement boundary relative to the database commit has to be a decision: commit-then-process risks loss, process-then-commit risks duplicates, and both are fine as long as the one you picked is the one your idempotency assumes. The first two are cheap to test, the third is a design test, and the fourth I would be honest about — it is a review item, not a test.

**★ Why would you deliberately set the retry back-off to zero in tests, and what do you lose?**
Because the alternative is paying the production back-off in wall-clock seconds on every build, per exhaustion test, and the observable behaviour I am asserting — that the message was retried the configured number of times and then dead-lettered with the right cause — does not depend on how long the gaps were. Making the back-off a configuration property and zeroing it in the test profile keeps the real code path and removes the dead time. What I lose is everything that only shows up *because* of the delay: a database connection or a transaction held open across three seconds of retries, a lock contended for longer than expected, an upstream timeout that fires during the gap. None of that is visible with a zero back-off, so a green test is not evidence the production timing is safe — that conclusion has to come from reading the configured values and thinking about what the handler holds while it waits.

{/* FOOTER */}
