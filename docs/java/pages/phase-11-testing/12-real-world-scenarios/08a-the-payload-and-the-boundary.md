---
title: "The handler test starts from an object you constructed, so it is structurally incapable of catching the failure that actually breaks consumers — the producer changed the payload — and that gap, plus three others, is the exact specification of what a container test is for"
sidebar_label: "08a · The payload and the boundary"
sidebar_position: 36
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the **Spring AMQP** reference *Testing Support*
> ([docs.spring.io](https://docs.spring.io/spring-amqp/reference/testing.html)) for
> `TestRabbitTemplate` and `RabbitListenerTestHarness`; the **Spring for Apache Kafka**
> reference *Testing Applications*
> ([docs.spring.io](https://docs.spring.io/spring-kafka/reference/testing.html)) for
> `@EmbeddedKafka` and `EmbeddedKafkaKraftBroker`; and the **Spring Boot 4.1** reference
> *Testing · Auto-configured tests* for `@JsonTest` and `JacksonTester`
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/testing/spring-boot-applications.html)).
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0, Spring
> Framework 7.0.8, JUnit Jupiter 6.0.3, Mockito 5.23.0, AssertJ 3.27.7, Testcontainers 2.0.5.
> ⚠️ **No sandbox, no Docker and no broker on this machine** — Java and YAML source and
> documented behaviour only, never console output or container logs.

**[08](08-a-message-consumer.md) put every business rule of a consumer into plain, broker-free
method calls. This chunk closes the two gaps that leaves: the bytes on the wire, which the
handler test never sees, and the precise list of things no test without a broker can prove.
The second list is short, and it is the only justification a container test needs.**

## Population B · the conversion, which is where the real bugs are

The handler test starts from a `PaymentAuthorized` object that *you* constructed, so it can
never catch the failure that actually breaks consumers in production: the producer changed
the payload and the converter no longer produces the object you assumed.

So take a **real captured payload** — a byte-for-byte copy of something the producer emitted,
stored under `src/test/resources` — and assert the conversion, using the same mapper
configuration the container uses:

```java
@JsonTest
class PaymentAuthorizedConversionTest {

    @Autowired JacksonTester<PaymentAuthorized> json;

    @Test
    void readsTheProducersCurrentPayload() throws Exception {
        PaymentAuthorized event = json.readObject(
                new ClassPathResource("payloads/payment-authorized-v3.json"));

        assertThat(event.accountId()).isEqualTo("acct-9");
        assertThat(event.amount()).isEqualTo(cents(2500));
        assertThat(event.authorisedAt()).isEqualTo(Instant.parse("2026-03-15T10:04:00Z"));
    }

    @Test
    void toleratesFieldsAddedByTheProducerAfterThisVersionShipped() throws Exception {
        assertThatNoException().isThrownBy(() -> json.readObject(
                new ClassPathResource("payloads/payment-authorized-v4-with-extras.json")));
    }
}
```

Two properties worth naming. The second test pins **forward compatibility** — a consumer that
throws on an unknown field will stop dead the day the producer adds one, and the failure will
present as a poison-message storm rather than as a deserialization bug. And the payload files
are the same artefact chunk [10](10-json-contracts-and-approval-tests.md) is about, used from
the other side: producers pin what they emit, consumers pin what they accept, and the pair is
a contract even without a contract-testing tool.

⚠️ `@JsonTest` configures Boot's own JSON mapper. If your container is configured with a
different `MessageConverter` or a raw `Deserializer`, that test is asserting the wrong
mapper — build the converter the way the listener factory builds it, or accept that this
particular assertion moved into the container test.

## The middle ground: invoke the listener without a broker

Between "call the handler" and "run a container" there is a third option almost nobody knows
exists: ask the framework to hand you the listener the container would have invoked, and
invoke it directly. Spring AMQP ships exactly that, and its description is the clearest
statement of the technique in any of the messaging projects:

> *"The `TestRabbitTemplate` is provided to perform some basic integration testing without
> the need for a broker. It discovers all the listener containers in the context, whether
> declared as `@Bean`, `<bean/>` or using the `@RabbitListener` annotation."*

> *"It currently only supports routing by queue name."*

The template extracts the listener from the container and calls it on the test thread — so
the annotation, the argument binding and the converter all participate, but no socket, no
acknowledgement and no error handler do. Spring AMQP also offers `RabbitListenerTestHarness`
via `@RabbitListenerTest`, which *"wraps the listener in a Mockito Spy"* so you can verify the
listener method itself, with two documented constraints worth knowing before you design
around it: *"final `@RabbitListener` methods cannot be spied or advised"* and *"only listeners
with an `id` attribute can be spied or advised"*.

Kafka's equivalent is different in kind — `@EmbeddedKafka` with `EmbeddedKafkaKraftBroker`
runs a real broker in-process rather than bypassing one, and since Kafka 4.0 that is
KRaft-only: *"Since Kafka 4.0 has fully transitioned to KRaft mode, only the
`EmbeddedKafkaKraftBroker` implementation is now available"*, and *"as of version 4.0, all
ZooKeeper-related properties have been removed from the `@EmbeddedKafka` annotation"*. That
puts it on the far side of the boundary, alongside Testcontainers, in
[08b](08b-the-container-poison-messages-and-redelivery.md).

## 🔴 The four things a handler test cannot prove

This is the list to keep. Everything above is fast and exhaustive and none of it says anything
about:

1. **That you are subscribed at all.** A typo in the topic name, a queue that was never
   declared, a `groupId` that collides with another service and steals its partitions — all
   compile, all pass every test above, and all mean zero messages arrive.
2. **That the converter in the running container is the one you tested.** Listener container
   factories are configured separately from the application's `ObjectMapper`; a consumer can
   pass its `@JsonTest` and still receive a `String` because nobody set a converter on the
   factory.
3. **What happens when the handler throws.** Retry, requeue, dead-letter, infinite
   redelivery, stalled partition — that behaviour lives entirely in the container's error
   handler and is invisible to a method call.
4. **Ordering, concurrency and acknowledgement.** Two consumer threads, partition assignment,
   whether the ack happens before or after your database commit. Each is a real source of
   production bugs and none is reachable from population A.

Items 3 and 4 are the whole of [08b](08b-the-container-poison-messages-and-redelivery.md).
Items 1 and 2 are cheap to cover with a single smoke test against a container that publishes
one message and asserts one side effect — one such test per listener, not one per branch.

## Where this connects

- The handler-as-a-plain-method half of the argument:
  [08 · A message consumer](08-a-message-consumer.md).
- Items 3 and 4 of the list above, in full:
  [08b · The container, poison messages and redelivery](08b-the-container-poison-messages-and-redelivery.md).
- Container mechanics, `@ServiceConnection`, the singleton pattern and the runtime cost:
  **topic 07**, [../07-testcontainers/README.md](../07-testcontainers/README.md).
- Captured payloads as pinned contracts, and the comparison modes that make pinning useful:
  [10 · JSON contracts and approval tests](10-json-contracts-and-approval-tests.md).
- Waiting for a listener to have run, without a `sleep`:
  [07a · Waiting without sleeping](07a-waiting-without-sleeping.md).
- The catalogue of protocol-faithful doubles, including brokers:
  [04d · Doubles that run the real protocol](04d-doubles-that-run-the-real-protocol.md).

## Gotchas

**★ A consumer that throws on an unknown JSON field turns a producer's additive change into an outage.**
Additive changes are the ones producers consider safe and ship without asking. If your DTO is configured to fail on unknown properties, every one of those messages becomes a poison message at once, and the symptom is a stalled partition or an exploding dead-letter queue rather than anything that says "new field". Pin the tolerance with a test against a payload that has extra fields.

**★ `@JsonTest` may not be testing the converter your listener container actually uses.**
The listener container factory has its own converter or deserializer, configured in its own `@Bean`. It is entirely possible for the `@JsonTest` conversion test to pass while the running consumer receives a raw `String`, or uses a mapper with different date handling. If the converter is configured on the factory, the conversion assertion has to be built from the factory's converter — or moved into the container test where the real one runs.

**★ A hand-written expected payload proves nothing about the producer.**
If the JSON in your test was typed by the same person who wrote the DTO, it agrees with the DTO by construction. Capture the payload from the real producer — a staging topic, a log, the producer team's own fixture — and commit that file. The value of the test is entirely in the provenance of the bytes.

**★ A missing field deserialises to `null` and the test that would have caught it asserts only on the fields that are present.**
The forward-compatibility test proves extra fields are tolerated; nothing proves that a *removed* field is noticed. If the producer drops `authorisedAt`, the record gets `null`, the handler credits the ledger anyway, and the failure appears three services downstream. Assert on every field the handler depends on, and consider a compact-constructor null check on the record so the failure lands at conversion time with the payload in the message.

**★ `RabbitListenerTestHarness` cannot spy a `final` listener method or one without an `id`.**
Both constraints are documented — *"final `@RabbitListener` methods cannot be spied or advised"* and *"only listeners with an `id` attribute can be spied or advised"* — and both are easy to trip over after a Kotlin migration or a tidy-up that removed "unused" ids. The failure is that stubbing silently applies to nothing, so the test passes without the arrangement ever taking effect.

**★ `TestRabbitTemplate` invokes the listener on the test thread, which quietly changes everything thread-bound.**
That is what makes it fast and deterministic, and it also means the listener runs inside the test's transaction, sees the test's `SecurityContextHolder`, and cannot exhibit any concurrency behaviour. It also *"only supports routing by queue name"*, so exchange-and-binding logic is not covered. Treat it as a fast conversion-and-invocation test, not as evidence the messaging works.

**★ An `@EmbeddedKafka` test written before Kafka 4 will not start on this stack.**
*"As of version 4.0, all ZooKeeper-related properties have been removed from the `@EmbeddedKafka` annotation"* and only `EmbeddedKafkaKraftBroker` remains. Copied configuration from a 2023 blog post fails at annotation-attribute level, and the error does not say "this attribute was removed in a major version".

**★ A `groupId` collision is invisible to every test and catastrophic in a shared environment.**
Two services with the same consumer group split the partitions between them, so each sees roughly half the messages and neither errors. Nothing in a unit test, a conversion test or even a single-consumer container test reproduces it. It belongs on the "cannot prove" list, and the mitigation is a naming convention plus a startup assertion, not a test.

**★ Deserialisation failures never reach your handler, so no handler test can cover them.**
When the converter throws, the container's error handler owns the outcome — and for Kafka that path is explicitly non-retryable, since `DeserializationException` is one of the exceptions the `DefaultErrorHandler` treats as fatal and sends straight to the recoverer. A poison payload is therefore an [08b](08b-the-container-poison-messages-and-redelivery.md) concern even though it looks like a conversion concern.

## Interview questions

**★ Where exactly do you draw the line between the fast test and the container test?**
At the four jobs the annotation performs. Subscribing and acknowledging are the container's, and neither is observable from a method call, so they belong on the far side. Invoking is trivially testable — it is a method call. Converting is testable without a broker *provided* the test uses the same converter the container is configured with, which is a real caveat because listener container factories are configured independently of the application's `ObjectMapper`. So my line is: everything about what the code *does* with a message goes in the fast tests; everything about how a message *arrives and departs* goes in the container tests. Stated as a rule of thumb, if the test would still make sense with the broker annotation deleted, it belongs in the fast set.

**★ A colleague says the consumer is fully tested because the handler has 100% coverage. What do you say?**
That the coverage number is measuring the half of the system that was never in doubt. The handler is ordinary code and testing it is easy; what breaks consumers in production is the parts that have no branches to cover — a topic name typo, a `groupId` collision with another service, a converter that was never wired onto the listener factory, an error handler that retries a poison message forever and stalls a partition. None of those appear in a coverage report because they are configuration, not statements. I would keep the handler tests, add a conversion test against a payload captured from the real producer, and add one smoke test per listener that publishes a message through a real broker and asserts one side effect. That last test has terrible coverage-per-second and catches the failures that matter most, which is a good illustration of why the number is a floor and not a target — the argument **topic 09 · JaCoCo** makes at length.

**★ Why capture a payload from the producer rather than write the JSON in the test?**
Because a payload I wrote agrees with my DTO by construction — I wrote both from the same mental model, so the test is a tautology. The whole value of the fixture is its provenance: bytes that a real producer actually emitted encode the field names it really uses, the date format it really writes, the nulls it really sends and the fields it has quietly added since the integration was designed. That is the only artefact in my test suite that carries information I did not already have. It also gives the consumer-side half of a contract for free — the producer pins what it emits and I pin what I accept — which gets you most of the value of consumer-driven contract testing without adopting a tool, at the cost that the fixture has to be refreshed deliberately rather than automatically.

**★ How would you test that your consumer tolerates a schema change, before the producer ships it?**
By asking the producer team for the new payload and adding it as a second fixture, then asserting the conversion succeeds and the fields the handler depends on are still populated. That is a genuine pre-deployment test and it costs one file. Two things I would want to be honest about. First, tolerance is directional — extra fields are safe if the mapper is configured to ignore unknowns, but a *removed* or *renamed* field silently becomes `null`, and the only way to catch that is to assert on every field the handler reads rather than the two the test author cared about. Second, this only covers the payload; a change to the producer's *semantics* with an unchanged shape — the same field now meaning gross rather than net — passes every assertion I can write, and the mitigation is a version field in the envelope that the consumer refuses to interpret when it moves.

{/* FOOTER */}
