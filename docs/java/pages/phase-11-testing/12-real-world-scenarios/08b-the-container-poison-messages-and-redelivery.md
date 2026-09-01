---
title: "A container test exists to answer one question a method call cannot — what happens to a message the handler refuses — and the answer is decided by defaults you did not choose, one of which retries ten times with no delay at all"
sidebar_label: "08b · The container and poison messages"
sidebar_position: 66
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the **Spring for Apache Kafka** reference *Handling
> Exceptions*
> ([docs.spring.io](https://docs.spring.io/spring-kafka/reference/kafka/annotation-error-handling.html))
> and the `DeadLetterPublishingRecoverer` javadoc
> ([docs.spring.io](https://docs.spring.io/spring-kafka/api/org/springframework/kafka/listener/DeadLetterPublishingRecoverer.html));
> the **Spring AMQP** reference *Resilience: Recovering from Errors and Broker Failures*
> ([docs.spring.io](https://docs.spring.io/spring-amqp/reference/amqp/resilience-recovering-from-errors-and-broker-failures.html));
> the **Spring Boot 4.1** reference *Testcontainers · Service Connections*
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/testing/testcontainers.html));
> and the **Jakarta Messaging 3.1** `Message` javadoc
> ([jakarta.ee](https://jakarta.ee/specifications/messaging/3.1/apidocs/jakarta.messaging/jakarta/jms/Message.html)).
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0, Spring
> Framework 7.0.8, JUnit Jupiter 6.0.3, Mockito 5.23.0, AssertJ 3.27.7, Testcontainers 2.0.5,
> Awaitility 4.3.0.
> ⚠️ **No sandbox, no Docker and no broker on this machine** — Java and YAML source and
> documented behaviour only. 🔴 **No container logs, no run output, no timings anywhere on
> this page.**

**[08a](08a-the-payload-and-the-boundary.md) ended with four things no broker-free test can
prove. This chunk is the third of them: what the container does with a message your handler
would not accept. It is the highest-value container test you can write, because the behaviour
is entirely governed by framework defaults, those defaults differ wildly between brokers, and
the one Spring picks for Kafka retries ten times with zero delay before giving up.**

## Where the container comes from — and where it does not

Everything about starting a broker in a test belongs to
[**topic 07 · Testcontainers**](../07-testcontainers/README.md): the container lifecycle,
`@ServiceConnection`, the singleton pattern, reuse, the startup cost and the
"it passed on H2" argument all live there and are not repeated here. The only fact this page
needs from Boot is which container types wire themselves up, because it decides what the
test's first ten lines look like. From the Boot reference — *"the following service connection
factories are provided in the `spring-boot-testcontainers` jar"*:

| `ConnectionDetails` | Matched on |
|---|---|
| `KafkaConnectionDetails` | *"Containers of type `KafkaContainer`, `ConfluentKafkaContainer` or `RedpandaContainer`"* |
| `RabbitConnectionDetails` | *"Containers of type `RabbitMQContainer`"* |
| `ActiveMQConnectionDetails` | *"Containers named `symptoma/activemq` or `ActiveMQContainer`"* |
| `ArtemisConnectionDetails` | *"Containers of type `ArtemisContainer`"* |

So the broker's address never appears in your test, and the whole of this page is about what
you do *after* that line.

## The shape of every container test on this page

Three steps, and the middle one is the one people get wrong:

1. **Publish** a message — with a template, or by producing directly.
2. **Wait** for an observable consequence, with a bound. Never a `sleep`; see
   [07a](07a-waiting-without-sleeping.md). The consequence must be something durable — a row,
   a counter, a message on another destination — because the *processing* itself happens on a
   container thread you do not control.
3. **Assert** on that consequence, and on nothing else.

```java
@SpringBootTest
@Testcontainers
class PaymentEventsContainerTest {

    @Autowired KafkaTemplate<String, PaymentAuthorized> template;
    @Autowired LedgerRepository ledger;

    @Test
    void aPublishedEventIsAppliedToTheLedger() {
        template.send("payment-events", "evt-1", anEvent("acct-9", cents(2500)));

        await().alias("ledger credited")
               .atMost(Duration.ofSeconds(10))
               .untilAsserted(() -> assertThat(ledger.balanceOf("acct-9")).isEqualTo(cents(2500)));
    }
}
```

One test of this shape per listener covers items 1 and 2 from
[08a](08a-the-payload-and-the-boundary.md)'s list — that you are subscribed at all, and that
the container's converter is the one you think. It is a smoke test and it should stay one:
every additional *business* case belongs in the plain handler tests, where it costs
microseconds instead of a container start.

## A poison message is not one thing

The word covers three failures with different causes and completely different handling, and
conflating them is why teams believe their dead-letter configuration works when it does not.

| Kind | Where it fails | Can it ever succeed on retry? |
|---|---|---|
| **Unparseable** — malformed bytes, wrong schema, wrong serializer | in the converter, before your code | Never |
| **Invalid** — parses fine, violates a business rule (negative amount, unknown account) | in your handler, deterministically | Never |
| **Transient** — parses fine, valid, but the database or an API is down | in your handler, non-deterministically | Usually, yes |

Only the third should be retried. The first two must go to a dead-letter destination on the
**first** failure, because retrying them is pure cost and, with the default Kafka
configuration, a very fast loop. Spring for Kafka already knows this about the first kind:
the reference lists the exceptions the `DefaultErrorHandler` treats as fatal and passes
straight to the recoverer without retrying, and `DeserializationException`,
`MessageConversionException`, `ConversionException`, `MethodArgumentResolutionException`,
`NoSuchMethodException` and `ClassCastException` are all on it.

The second kind is yours. Nothing in the framework can tell a `ValidationException` from a
`DataAccessResourceFailureException` — you have to say so, and that classification is a
first-class piece of behaviour with a first-class test.

## 🔴 The default that surprises everyone

Spring for Kafka's `DefaultErrorHandler` ships with

> *"the default configuration (`FixedBackOff(0L, 9)`)"*

which is **nine retries with a zero-millisecond back-off** — ten delivery attempts, as fast as
the consumer thread can make them. For a transient database outage that is ten attempts
inside a few milliseconds, all of which fail, followed by a dead-letter. For an invalid
message it is nine wasted attempts. Neither is what anyone would have chosen; both are what
you get if nobody configures the error handler.

The reference shows the alternative in the same breath — *"for a record listener, this will
retry a delivery up to 2 times (3 delivery attempts) with a back off of 1 second, instead of
the default configuration"* — and that one-second back-off is exactly the thing that makes a
container test slow. Configure the back-off from a property so the test can set it to zero
and production can set it to something humane:

```yaml
app:
  consumer:
    retry:
      attempts: 3
      backoff: 1s
```

```yaml
# src/test/resources/application-test.yml
app:
  consumer:
    retry:
      attempts: 3
      backoff: 0s
```

Then the exhaustion test costs nothing in wall clock and still exercises the real path — the
same argument [07c](07c-events-and-retries.md) makes about `@Retryable`'s one-second default.

## Redelivery is not a rewind

The most misunderstood part of Kafka's error handling is what a "retry" actually does to the
rest of the batch. The reference spells it out:

> *"As an example, if the `poll` returns six records (two from each partition 0, 1, 2) and the
> listener throws an exception on the fourth record, the container acknowledges the first
> three messages by committing their offsets. The `DefaultErrorHandler` seeks to offset 1 for
> partition 1 and offset 0 for partition 2. The next `poll()` returns the three unprocessed
> records."*

Two consequences that a handler test can never show you. Records the handler already
processed successfully are committed and **not** replayed — good. But records *after* the
failing one, in other partitions, are re-fetched and **re-delivered** — so a handler that
succeeded on record five in the first poll may be invoked with record five again. That is a
duplicate arriving through a path nobody models, and the only defence is the idempotency the
handler was supposed to have anyway.

For AMQP the failure mode is worse and older, and the reference states it directly:

> *"Prior to 2.8.x, RabbitMQ had no definition of dead letter behavior. Consequently, by
> default, a message that is rejected or rolled back because of a business exception can be
> redelivered endlessly."*

The two documented levers:

> *"Alternatively, you can throw a `AmqpRejectAndDontRequeueException`. Doing so prevents
> message requeuing, regardless of the setting of the `defaultRequeueRejected` property."*

> *"Another alternative is to set the container's `defaultRequeueRejected` property to
> `false`. This causes all failed messages to be discarded. When using RabbitMQ 2.8.x or
> higher, this also facilitates delivering the message to a dead letter exchange."*

Note the word **discarded** in the second. Without a dead-letter exchange bound to the queue,
`defaultRequeueRejected = false` does not save the message anywhere — it deletes it. The
container test that distinguishes "dead-lettered" from "silently dropped" is therefore not
optional, and it is the same test in both cases apart from the assertion.

And JMS gives you a flag that cannot be trusted as a decision input:

> *"If a client receives a message with the `JMSRedelivered` field set, it is likely, but not
> guaranteed, that this message was delivered earlier but that its receipt was not
> acknowledged at that time."*

*Likely, but not guaranteed.* Any logic of the form "if redelivered, skip" is built on a
maybe.

## Where this connects

- The handler-as-a-plain-method argument and the four jobs of a listener annotation:
  [08 · A message consumer](08-a-message-consumer.md).
- The payload boundary and the full "cannot prove" list this chunk discharges:
  [08a · The payload and the boundary](08a-the-payload-and-the-boundary.md).
- Asserting the dead-letter record, proving the stream kept moving, and what at-least-once
  costs: [08b2 · Asserting the dead letter](08b2-asserting-the-dead-letter.md).
- 🔴 Container lifecycle, `@ServiceConnection`, singletons, reuse and startup cost:
  **topic 07**, [../07-testcontainers/README.md](../07-testcontainers/README.md). This page
  deliberately does not re-teach any of it.
- Bounding the wait without a `sleep`, and `alias`/`failFast`:
  [07a · Waiting without sleeping](07a-waiting-without-sleeping.md).
- The same "make the backoff a property so the test can zero it" move for HTTP retries:
  [07c · Events and retries](07c-events-and-retries.md).
- Which exceptions are retryable at all, argued for status codes:
  [03g · The 429 and Retry-After](03g-the-429-and-retry-after.md).

## Gotchas

**★ `FixedBackOff(0L, 9)` is the default and it is ten attempts with no delay whatsoever.**
The reference names the default configuration explicitly. A transient database blip therefore consumes all ten attempts in the time it takes the consumer thread to loop, and the message is dead-lettered before the database has finished failing over. Nobody chooses this; everybody who has not configured an error handler has it.

**★ `defaultRequeueRejected = false` without a dead-letter exchange deletes the message.**
The AMQP reference says it *"causes all failed messages to be discarded"* and only *facilitates* dead-lettering when a DLX exists. The configuration change and the exchange binding are two separate acts, and doing only the first turns an infinite-redelivery bug into a silent data-loss bug — which looks like a fix, because the log noise stops.

**★ A Rabbit consumer with no dead-letter configuration at all can redeliver a business failure forever.**
*"By default, a message that is rejected or rolled back because of a business exception can be redelivered endlessly."* The consumer stays healthy, the queue depth stays flat, CPU stays busy, and one message is processed several thousand times a second. Throwing `AmqpRejectAndDontRequeueException` for non-retryable failures is the documented escape, *"regardless of the setting of the `defaultRequeueRejected` property"*.

**★ Retrying a message that can never succeed is not slow, it is a spin loop.**
An invalid message with a zero back-off is retried as fast as the thread runs, and with an unbounded policy it never stops. The classification of exceptions into retryable and terminal is the fix, and it is your code — Spring only pre-classifies conversion failures, listing `DeserializationException`, `MessageConversionException` and `ClassCastException` among those it treats as fatal.

**★ `JMSRedelivered` is documented as a hint, not a fact.**
*"Likely, but not guaranteed."* Consumers that branch on it — skipping work on redelivery — are correct most of the time and wrong exactly when it matters. Idempotency has to be derived from the producer's event identifier and your own state, never from a transport flag.

**★ Kafka's error handler re-delivers records the handler already saw in the same poll.**
The documented seek behaviour re-fetches the unprocessed records of other partitions, so a record that succeeded earlier in the batch can arrive again. It is not a bug and there is no configuration that avoids it; it is simply another route by which at-least-once becomes visible, and the handler's idempotency is what absorbs it.

**★ A container test with a one-second back-off and three attempts costs three seconds every run, per test.**
That is the real reason teams stop writing them. Make the back-off a configuration property, set it to zero in the test profile, and the exhaustion path becomes affordable — the exact same move as zeroing a `RetryPolicy` delay in [07c](07c-events-and-retries.md).

**★ Zeroing the back-off in tests hides every bug that only appears with a real delay.**
A consumer whose retries take a second apart holds a database connection, a lock or a transaction for three seconds; with the delay set to zero, none of that pressure exists and the test cannot see it. The zeroed configuration is the right default for the suite and the wrong basis for concluding the retry policy is safe — that conclusion comes from reading the production values, not from a green test.

**★ `@ServiceConnection` matches on container *type*, so a generic container will not be wired up.**
The Boot reference lists the matches precisely: `KafkaConnectionDetails` for *"containers of type `KafkaContainer`, `ConfluentKafkaContainer` or `RedpandaContainer`"*, `RabbitConnectionDetails` for *"containers of type `RabbitMQContainer`"*. A `GenericContainer` running the same image gets no connection details at all, and the application quietly connects to `localhost` instead — which is topic 07's territory but bites first on a messaging test.

## Interview questions

**★ What is a poison message and what should happen to one?**
It is a message the consumer cannot process, and the first thing I would do is refuse to treat it as one category. There are three: unparseable — bad bytes, wrong schema, wrong serializer, failing in the converter before my code runs; invalid — parses fine but violates a business rule, failing deterministically in my handler; and transient — perfectly good, failing because a database or an API is momentarily unavailable. Only the third should ever be retried, because the first two will fail identically on every attempt. Spring for Kafka already classifies the first group, treating `DeserializationException`, `MessageConversionException` and `ClassCastException` among others as fatal and sending them straight to the recoverer. The second group is mine to classify, and getting it wrong is expensive because the default error handler is `FixedBackOff(0L, 9)` — nine retries with zero delay — so an unretryable message burns ten attempts as fast as the thread can run. What should happen is: retry the transient ones with a bounded, backed-off policy; dead-letter the other two on the first failure, with the cause attached; and keep consuming either way.

**★ Your consumer dead-letters correctly in the test but in production one message was processed forty thousand times. What happened?**
Almost certainly RabbitMQ with requeue-on-reject and no dead-letter exchange, which the Spring AMQP reference describes exactly: *"by default, a message that is rejected or rolled back because of a business exception can be redelivered endlessly."* The consumer looks healthy, the queue depth looks flat, and one message loops. The other candidate is Kafka with a custom error handler configured with an unbounded or very large `BackOff` and a zero delay, which is a spin rather than a loop but produces the same log volume. The fix in the Rabbit case is either throwing `AmqpRejectAndDontRequeueException` for terminal failures — documented as preventing requeue *"regardless of the setting of the `defaultRequeueRejected` property"* — or setting `defaultRequeueRejected` to false, and in that case I would be very careful to bind a dead-letter exchange first, because on its own that setting *"causes all failed messages to be discarded"* and I would have swapped an infinite loop for silent data loss.

**★ How many container tests should a consumer have, and what are they?**
Few, and each one has to name a thing no plain test can reach. One smoke test that publishes a message and asserts a durable side effect, which proves I am subscribed, that the converter is wired, and that the acknowledgement path works. One poison-message test that asserts the dead-letter record with its cause header. One test that publishes a good message after a bad one and asserts the good one was processed, because dead-lettering and continuing are separate behaviours. If the consumer has ordering or concurrency requirements, one test per requirement, and I would want to say out loud that those are the least reliable tests in the suite. Everything else — every branch, every business rule, every idempotency case — is a plain handler test, because a container test costs orders of magnitude more per assertion and does not cover anything extra about the logic.

{/* FOOTER */}
