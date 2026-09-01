---
title: "A message listener annotation does four jobs and exactly one of them is your code, so the fast, exhaustive test of a consumer is a plain method call with no broker in sight — and the entire skill is knowing precisely which four things that test cannot prove"
sidebar_label: "08 · A message consumer"
sidebar_position: 35
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the **Spring AMQP** reference *Testing Support*
> ([docs.spring.io](https://docs.spring.io/spring-amqp/reference/testing.html)) for
> `TestRabbitTemplate`, `@SpringRabbitTest` and `RabbitListenerTestHarness`; the **Spring for
> Apache Kafka** reference *Testing Applications*
> ([docs.spring.io](https://docs.spring.io/spring-kafka/reference/testing.html)) for
> `@EmbeddedKafka`/`EmbeddedKafkaKraftBroker` and `KafkaTestUtils`; and the **Jakarta
> Messaging 3.1** `Message` javadoc
> ([jakarta.ee](https://jakarta.ee/specifications/messaging/3.1/apidocs/jakarta.messaging/jakarta/jms/Message.html))
> for `getJMSRedelivered`.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0, Spring
> Framework 7.0.8, JUnit Jupiter 6.0.3, Mockito 5.23.0, AssertJ 3.27.7, Testcontainers 2.0.5,
> Awaitility 4.3.0.
> ⚠️ **No sandbox, no Docker and no broker on this machine** — Java and YAML source and
> documented behaviour only, never console output or container logs.

**Ask a team how they test their Kafka consumer and you get one of two answers: "we spin up
an embedded broker" or "we don't". Both are symptoms of the same missing distinction. A
`@KafkaListener`, `@RabbitListener` or `@JmsListener` method is an **adapter** — it subscribes,
converts, invokes and acknowledges — and only the invoked part is code you wrote. Test that
part as a plain method, exhaustively, in microseconds. Then write a much smaller number of
container tests for the three things the plain method genuinely cannot see.**

## The four jobs, and which one is yours

| Job | Who does it | Testable without a broker? |
|---|---|---|
| **Subscribe** — join the group, bind the queue, set concurrency | the container, from annotation attributes and properties | No. This is configuration and it is verified by connecting. |
| **Convert** — bytes → `String`/`byte[]`/your DTO, plus headers | a message converter (Jackson, a `MessageConverter`, a `Deserializer`) | **Yes**, and this is the half everyone skips. |
| **Invoke** — call your method with the converted payload | the container's listener adapter | **Yes**, trivially — it is a method call. |
| **Acknowledge / reject** — commit the offset, ack, nack, requeue, dead-letter | the container and its error handler | No. This is [08b](08b-the-container-poison-messages-and-redelivery.md). |

Two of the four are yours to test cheaply and two are not testable at all without something
that speaks the protocol. That table *is* the boundary the chunk title promises.

## The shape that makes a consumer testable

The listener method should be a shell, for the same reason a `@Scheduled` method should be
([07b](07b-testing-a-scheduled-job.md)): it is defined by the framework's needs, not yours.

```java
@Component
public class PaymentEventsListener {

    private final PaymentEventHandler handler;

    public PaymentEventsListener(PaymentEventHandler handler) {
        this.handler = handler;
    }

    @KafkaListener(topics = "payment-events", groupId = "billing")
    void onPaymentEvent(PaymentAuthorized event,
                        @Header(KafkaHeaders.RECEIVED_KEY) String key) {
        handler.handle(new IncomingPaymentEvent(key, event));
    }
}
```

```java
@Component
public class PaymentEventHandler {

    private final LedgerService ledger;
    private final ProcessedEvents processed;

    // …constructor…

    public HandlingOutcome handle(IncomingPaymentEvent incoming) {
        if (processed.contains(incoming.key())) {
            return HandlingOutcome.DUPLICATE;      // at-least-once, see below
        }
        ledger.credit(incoming.event().accountId(), incoming.event().amount());
        processed.record(incoming.key());
        return HandlingOutcome.APPLIED;
    }
}
```

The broker annotation is the only vendor-specific line in the whole design, and swapping it
does not change a single test:

| Broker | Annotation | The shell's argument types |
|---|---|---|
| Kafka | `@KafkaListener(topics = …, groupId = …)` | payload + `@Header(KafkaHeaders.…)` |
| RabbitMQ / AMQP | `@RabbitListener(queues = …)` | payload + `@Header(…)`, or a `Message` |
| JMS / Artemis / ActiveMQ | `@JmsListener(destination = …)` | payload + `@Header(…)`, or a `jakarta.jms.Message` |

That is the point of keeping the broker generic here: the *argument* of this chunk is
identical across all three, and the moment a test needs to know which broker it is, it has
become an [08b](08b-the-container-poison-messages-and-redelivery.md) test.

## Population A · the handler, as a plain method

No Spring, no container, no waiting. Every business rule, every branch, every malformed-input
case:

```java
@ExtendWith(MockitoExtension.class)
class PaymentEventHandlerTest {

    @Mock LedgerService ledger;
    @Mock ProcessedEvents processed;
    @InjectMocks PaymentEventHandler handler;

    @Test
    void creditsTheLedgerForANewAuthorisation() {
        when(processed.contains("evt-1")).thenReturn(false);

        HandlingOutcome outcome = handler.handle(anEvent("evt-1", "acct-9", cents(2500)));

        assertThat(outcome).isEqualTo(HandlingOutcome.APPLIED);
        verify(ledger).credit("acct-9", cents(2500));
    }

    @Test
    void ignoresAnEventItHasAlreadyApplied() {
        when(processed.contains("evt-1")).thenReturn(true);

        assertThat(handler.handle(anEvent("evt-1", "acct-9", cents(2500))))
                .isEqualTo(HandlingOutcome.DUPLICATE);
        verifyNoInteractions(ledger);
    }
}
```

The second test is not an optional nicety. **Every mainstream broker delivers at least once**,
which means a redelivery is a normal event and not an error condition — Jakarta Messaging is
blunt about how little you can infer from its own redelivery flag:

> *"If a client receives a message with the `JMSRedelivered` field set, it is likely, but not
> guaranteed, that this message was delivered earlier but that its receipt was not
> acknowledged at that time."*

*Likely, but not guaranteed*, and only about the previous delivery. There is no header on any
broker that reliably answers "have I already processed this". The handler has to answer it
itself, from its own state, and the "handle the same event twice, observe the effect once"
test is the one that proves it. It costs a millisecond and it is the single most valuable
test on this page.

## Where this connects

- The payload boundary, the listener-without-a-broker trick, and the four things this
  chunk's tests cannot prove:
  [08a · The payload and the boundary](08a-the-payload-and-the-boundary.md).
- The container-level half — poison messages, redelivery, dead-letter destinations and what
  at-least-once forces you to prove:
  [08b · The container, poison messages and redelivery](08b-the-container-poison-messages-and-redelivery.md).
- The shell-plus-handler pattern, first made for scheduled jobs:
  [07b · Testing a scheduled job](07b-testing-a-scheduled-job.md).
- The catalogue of protocol-faithful doubles, including brokers:
  [04d · Doubles that run the real protocol](04d-doubles-that-run-the-real-protocol.md).
- The mock-at-a-boundary-you-own rule this whole design serves:
  [01 · What to mock and what to let run](01-what-to-mock-and-what-to-let-run.md).

## Gotchas

**★ Testing the listener method instead of the handler couples every business test to a broker annotation.**
`@KafkaListener` on the method under test means the test either loads a container or calls a method whose signature is dictated by framework header binding. Both are worse than a `handle(IncomingPaymentEvent)` call. The annotated shell exists so that the interesting tests never mention the broker, and the day the company migrates from Rabbit to Kafka, only the shell and the container tests change.

**★ Every broker in mainstream use is at-least-once, so "handled twice" is a normal input, not an error case.**
Teams write the duplicate-handling test as an afterthought or not at all, and then discover in production that a consumer rebalance replayed an hour of messages. The redelivery flag will not save you — Jakarta Messaging documents that a set `JMSRedelivered` means it is *"likely, but not guaranteed"* that the message was delivered before. Idempotency has to come from your own state, and its test is a two-call assertion in population A.

**★ The handler returning `void` throws away the only cheap observable a consumer has.**
`HandlingOutcome.APPLIED` versus `DUPLICATE` versus `IGNORED_OLD_VERSION` is one enum that makes half a dozen tests one-liners and gives production a metric dimension for free. A `void handle(...)` forces every test to assert on a mock's interactions instead, which is both weaker and more brittle.

**★ Deriving the idempotency key from the broker's message id makes the test pass and production wrong.**
A broker-assigned id changes when a producer republishes, and it is not stable across a topic migration or a dead-letter replay — so the same business event arrives with two different ids and is applied twice. The key has to be the *producer's* event identifier, carried in the payload or a header the producer sets. The test that catches the difference is one that handles the same domain event twice under two different message ids.

**★ Recording "processed" and applying the effect in separate transactions makes idempotency a coin flip.**
If the ledger credit commits and the processed-events insert does not, a redelivery double-credits; the other order loses the effect entirely. The handler test with mocks cannot see this at all, because mocks have no transaction. It is a design property to settle deliberately — same transaction, or an idempotency key enforced by a unique constraint on the effect itself — and to note in the test as a comment pointing at the integration test that actually covers it.

**★ Consuming and acknowledging are different events, and no population-A test can tell them apart.**
Your handler completing successfully is not the same as the message being acknowledged, and the gap between them is where duplicates and losses live. This is the one item on the "cannot prove" list that people believe they have covered, because the handler test is green and the handler is the thing they wrote.

## Interview questions

**★ How would you test a Kafka consumer, and how many tests would need Kafka?**
Almost none of them. I would separate the listener method from the handler: the annotated method is a one-line shell whose signature belongs to the framework, and the handler is a plain class taking a domain object and returning an outcome. Every business rule, every branch and every idempotency case is a plain JUnit test on the handler with mocked collaborators, running in microseconds — that is the bulk of the suite and none of it needs a broker. Then there is a conversion test that reads a real captured payload with the same mapper the container uses, because the failure that actually breaks consumers is a producer changing the payload, and a handler test starting from an object I constructed can never see it. And finally a very small number of tests that do need a real broker, because there are exactly four things the plain tests cannot prove: that I am subscribed at all, that the container's converter is the one I tested, what happens when the handler throws, and anything about ordering, concurrency or acknowledgement. That last group is where a container earns its runtime.

**★ Why is a "handle the same message twice" test mandatory rather than a nice-to-have?**
Because at-least-once is the delivery guarantee, so a duplicate is a normal input rather than a fault. Rebalances, redeliveries after a slow ack, retries from an upstream producer — all of them replay messages, and none of them is a bug. The tempting shortcut is to look at the broker's redelivery flag, and Jakarta Messaging is admirably honest about why that does not work: a set `JMSRedelivered` means it is *"likely, but not guaranteed"* that the message was delivered earlier, which is not a basis for deciding whether to credit an account. So the consumer has to answer "have I already applied this" from its own durable state — a processed-events table keyed by the producer's event id, a version check on the aggregate, a unique constraint that the second attempt violates harmlessly. The test is two calls and one assertion that the side effect happened once, and it is the cheapest insurance in the entire consumer.

**★ Your consumer needs to call an HTTP API for every message. How does that change the test design?**
It does not change the shape at all — it adds a collaborator to the handler, and the handler test mocks it, exactly as [03](03-mocking-an-outbound-http-api.md) describes. What it changes is the *failure* design, and that is where the interesting tests are. If the API is down, does the handler throw, causing the container to retry and eventually dead-letter, or does it swallow and acknowledge, losing the message? That is a decision, it has to be made explicitly, and it is testable in population A by making the mocked gateway throw and asserting the outcome — including asserting that the handler propagates rather than swallows, if propagation is what the container's error handling relies on. I would also check the timeout, because a consumer with an unbounded HTTP call and a container that redelivers after a fixed interval can end up processing the same message concurrently on two threads, which is the kind of thing that only shows up under load and is much easier to design out than to reproduce.

{/* FOOTER */}
