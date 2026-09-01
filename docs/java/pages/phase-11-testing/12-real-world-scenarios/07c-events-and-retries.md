---
title: "An event listener and a retry policy fail in the same way and for the same reason — the annotation is inert until something enables it, and the test that would have caught that is the one asserting a count rather than an outcome"
sidebar_label: "07c · Events and retries"
sidebar_position: 34
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the **Spring Framework 7.0.x** reference *Testing · Application
> Events*
> ([docs.spring.io](https://docs.spring.io/spring-framework/reference/testing/testcontext-framework/application-events.html)),
> *Transaction-bound Events*
> ([docs.spring.io](https://docs.spring.io/spring-framework/reference/data-access/transaction/event.html))
> and *Resilience*
> ([docs.spring.io](https://docs.spring.io/spring-framework/reference/core/resilience.html));
> and the `TestTransaction` javadoc
> ([docs.spring.io](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/test/context/transaction/TestTransaction.html)).
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0, Spring
> Framework 7.0.8, JUnit Jupiter 6.0.3, Mockito 5.23.0, AssertJ 3.27.7.
> ⚠️ **No sandbox and no test runs on this machine** — Java source and documented behaviour
> only, never console output.

**[07b](07b-testing-a-scheduled-job.md) made the case that `@Scheduled` is configuration
wrapped around ordinary code. `@EventListener` and `@Retryable` are the same shape, and they
share `@Async`'s worst property: when the enabling configuration is missing, the test does not
fail — it passes for the wrong reason. This chunk is about the assertions that tell the
difference, and about the single most common reason an event test sees nothing at all.**

## Events: assert the publication, not the listener's side effect

Publishing an event and handling it are two units, and joining them in one test is the
mistake. The publisher's test mocks `ApplicationEventPublisher`; the listener's test calls
the listener method. Neither needs a context.

When you *do* want to assert at the integration level that an event was published — the
useful case is "this operation announced what it did" — Spring has purpose-built support:

```java
@SpringBootTest
@RecordApplicationEvents
class OrderServiceEventTest {

    @Test
    void submittingAnOrderPublishesExactlyOneEvent(
            @Autowired OrderService service, ApplicationEvents events) {

        service.submitOrder(anOrder().build());

        assertThat(events.stream(OrderSubmitted.class)).hasSize(1);
    }
}
```

The reference:

> *"All events published during the execution of a single test are made available via the
> `ApplicationEvents` API which allows you to process the events as a `java.util.Stream`."*

> *"`ApplicationEvents` is registered with the `ApplicationContext` as a resolvable dependency
> which is scoped to the lifecycle of the current test method. Consequently,
> `ApplicationEvents` cannot be accessed outside the lifecycle of a test method and cannot be
> `@Autowired` into the constructor of a test class."*

Two practical consequences of that scoping. The recording is per *test method*, so you do not
have to clean anything up between tests. And the injection point must be a method parameter
or an `@Autowired` field — a constructor parameter fails, which is exactly what a team using
constructor injection in test classes will try first.

The listener needs `ApplicationEventsTestExecutionListener`, which the reference notes is
*"registered by default"* and only needs declaring if you have replaced the default listener
set.

## `@TransactionalEventListener` and the test that rolls back

This is where event tests go quiet. The default phase is `AFTER_COMMIT`, and the reference is
explicit about the no-transaction case:

> *"If no transaction is running, the listener is not invoked at all, since we cannot honor
> the required semantics."*

with `fallbackExecution = true` as the documented override. The available phases are
`BEFORE_COMMIT`, `AFTER_COMMIT` (the default), `AFTER_ROLLBACK` and `AFTER_COMPLETION`.

Now combine that with the standard `@Transactional` test, which **rolls back at the end of
the method**. An `AFTER_COMMIT` listener never runs, because there is never a commit. The
test asserts the side effect, finds nothing, and the developer concludes the listener is
broken. It is not; the test made the commit impossible.

Three honest ways out, in order of preference:

1. **Do not annotate the test `@Transactional`.** Let the service's own transaction commit,
   and clean up afterwards — [08 · Test data patterns](../08-test-data-patterns/README.md)
   owns that cleanup problem.
2. **Force the commit inside the test** with `TestTransaction`, documented as *"a collection
   of static utility methods for programmatic interaction with test-managed transactions"*:
   `TestTransaction.flagForCommit(); TestTransaction.end();` — after which the listener
   fires and you can assert. It also lets you `start()` a fresh transaction to inspect the
   result.
3. **Test the listener method directly.** It is a public method taking an event object. The
   `@TransactionalEventListener` part is configuration, and what you actually want to assert
   about it is the *phase*, which is a one-line reflection or an architectural test.

## Retries: make the policy an object, not an annotation you wait on

Framework 7 has retry support in core, and the first thing to know is that, like `@Async`,
the annotation is inert on its own:

> *"The most convenient way to enable processing of the resilience annotations is to declare
> `@EnableResilientMethods` on a corresponding `@Configuration` class. Alternatively, these
> annotations can be individually enabled by defining a `RetryAnnotationBeanPostProcessor` or
> a `ConcurrencyLimitBeanPostProcessor` bean in the context."*

The defaults, which decide how long your test takes:

> *"By default, the method invocation will be retried for any exception thrown: with at most 3
> retry attempts (`maxRetries = 3`) after an initial failure, and a delay of 1 second between
> attempts."*

> *"A `@Retryable` method will be invoked at least once and retried at most `maxRetries`
> times, where `maxRetries` is the maximum number of retry attempts. Specifically, total
> attempts = 1 initial attempt + `maxRetries` attempts."*

Four attempts a second apart is three seconds of wall clock per exhaustion test. Multiply by
the number of error paths in [03c](03c-the-error-paths-nobody-writes.md) and the retry tests
become the slowest thing in the suite. The fix is not a faster machine; it is to stop testing
the policy through the proxy. `RetryPolicy` is a plain object:

```java
@Test
void givesUpAfterFourAttemptsAndRethrows() {
    RetryPolicy policy = RetryPolicy.builder()
            .includes(PaymentUnavailable.class)
            .maxRetries(3)
            .delay(Duration.ZERO)          // the whole point: no wall clock
            .build();

    when(gateway.charge(any()))
            .thenThrow(new PaymentUnavailable(), new PaymentUnavailable(),
                       new PaymentUnavailable(), new PaymentUnavailable());

    assertThatThrownBy(() -> new RetryTemplate(policy).execute(() -> gateway.charge(CHARGE)))
            .isInstanceOf(PaymentUnavailable.class);
    verify(gateway, times(4)).charge(CHARGE);
}
```

`times(4)` is the assertion the interviewer is listening for: one initial attempt plus three
retries, straight from the documented formula. And the success-after-failure case needs the
consecutive-stubbing rule from [01b](01b-the-js-to-java-map.md) — the *last* stubbed value
repeats forever, so the successful outcome must be stated explicitly as the final argument or
the retry loops on the failure until it exhausts.

Then one separate, cheap test that the annotation is wired, exactly like the `@Async` wiring
test in [07](07-async-scheduled-and-eventual.md): call the method through the bean and assert
the collaborator saw more than one attempt.

## Where this connects

- The scheduled-job half of this argument:
  [07b · Testing a scheduled job](07b-testing-a-scheduled-job.md).
- The `@Async` wiring test this chunk's retry-wiring test copies:
  [07 · Async, scheduled and eventual](07-async-scheduled-and-eventual.md).
- What a retry policy must *not* retry, and honouring `Retry-After`:
  [03g · The 429 and Retry-After](03g-the-429-and-retry-after.md) and
  [03c · The error paths nobody writes](03c-the-error-paths-nobody-writes.md).
- Consecutive stubbing, and why the last stubbed value repeats forever:
  [01b · The JS-to-Java map](01b-the-js-to-java-map.md).
- Proxy-only interception, stated for method security:
  [06c · Method security with no request](06c-method-security-with-no-request.md).
- Cleaning up after a test that was allowed to commit: **topic 08**,
  [../08-test-data-patterns/README.md](../08-test-data-patterns/README.md).

## Gotchas

**★ A `@Transactional` test can never observe an `AFTER_COMMIT` transactional listener, and nothing tells you that is why.**
The test rolls back by design, the commit never happens, and the reference is clear that *"if no transaction is running, the listener is not invoked at all"* — here a transaction *is* running, it simply never commits. The assertion fails with "expected 1 event but was 0", which reads exactly like a broken listener. Use `TestTransaction.flagForCommit()` then `end()`, or drop `@Transactional` from the test.

**★ `ApplicationEvents` cannot be constructor-injected, and constructor injection is what a careful team will try.**
*"`ApplicationEvents` … cannot be `@Autowired` into the constructor of a test class."* It is scoped to the test method, so it has to arrive as a method parameter or an `@Autowired` field. The failure is a context startup error rather than a clean message about scoping.

**★ `events.stream(X.class)` counts events published by *anything* in the context during the test, including your own test fixture.**
The recording is context-wide and method-scoped, so a builder that persists an aggregate and thereby publishes a domain event contributes to the count. An assertion of `hasSize(1)` then fails with two, and the instinct is to change the assertion to `isNotEmpty()`, which throws away the only interesting thing the test was checking. Set the fixture up before the recording matters, or assert on the event's contents rather than the bare count.

**★ `@RecordApplicationEvents` needs `ApplicationEventsTestExecutionListener`, and a custom `@TestExecutionListeners` declaration silently removes it.**
The reference says the listener is *"registered by default"* and only needs manual registration *"if using custom `@TestExecutionListener` configuration that excludes default listeners"*. A base test class that declares its own listeners without `mergeMode = MERGE_WITH_DEFAULTS` disables recording for every subclass, and the failure is an unresolvable `ApplicationEvents` dependency in a test that used to work.

**★ `@Retryable` does nothing without `@EnableResilientMethods` or a `RetryAnnotationBeanPostProcessor` bean.**
Exactly the `@EnableAsync` failure again: the annotated method runs, throws on the first attempt, and the test that expected an exception passes — while proving the retry never happened. The `verify(gateway, times(4))` assertion is what distinguishes "retried and gave up" from "never retried".

**★ Testing a retry through the proxy costs the real backoff, in wall-clock seconds, every run.**
The documented default is *"a delay of 1 second between attempts"*, so an exhaustion test costs three seconds and does it every single build. Build the `RetryPolicy` in the test with `delay(Duration.ZERO)` and drive `RetryTemplate` directly; keep exactly one proxy-level test to prove the annotation is live.

**★ `thenThrow(a, b, c)` runs out and repeats the last value, so a "fails twice then succeeds" retry test never reaches the success path.**
Mockito's consecutive stubbing keeps returning the final stub forever ([01b](01b-the-js-to-java-map.md)). Stub the success explicitly as the last argument — `thenThrow(...).thenThrow(...).thenReturn(receipt)` — or the retry exhausts and the test asserts the wrong outcome while looking correct.

**★ Retrying "any exception" is the documented default and is wrong for almost every real policy.**
*"By default, the method invocation will be retried for any exception thrown."* That includes the `IllegalArgumentException` from your own validation, which will fail identically four times. Narrow with `includes`, and write the parameterized "which exceptions are retryable" table test that stops someone widening it later — the argument [03g](03g-the-429-and-retry-after.md) makes for HTTP status codes.

**★ `includes` matches nested causes, so a narrow-looking policy can be wide.**
The reference says the supplied types *"will be matched against an exception thrown by a failed invocation as well as nested causes"*. A `PaymentUnavailable` wrapped inside some framework exception still matches — usually what you want — but so does an unrelated failure that happens to carry your type somewhere in its cause chain. If the distinction matters, the test that pins it is a parameterized one over realistic wrapped exceptions, not a single happy case.

**★ Retrying a non-idempotent operation is a correctness bug that a passing retry test actively conceals.**
`verify(gateway, times(4))` going green means the call was made four times. If that call charges a card, the test has just certified a quadruple charge. The retry test and the idempotency test are two different tests and the first one is worthless without the second.

**★ A retry inside a `@Transactional` method holds the transaction — and the database connection — across every backoff.**
Four attempts a second apart is three seconds of an open transaction and a checked-out connection per request. Nothing in the retry test reveals this, because the test has no connection pool. It is a review finding rather than a test finding, and the mitigation — retry outside the transaction boundary — is the same structural argument [03g](03g-the-429-and-retry-after.md) makes about retrying above the gateway rather than inside it.

## Interview questions

**★ A `@TransactionalEventListener` works in production but its test sees no event. What is happening?**
The test is almost certainly annotated `@Transactional`, which means the framework rolls the transaction back at the end of the method. The listener defaults to the `AFTER_COMMIT` phase, and there is no commit, so it never fires. The reference is explicit that the listener is bound to the commit and that with no transaction at all it *"is not invoked at all, since we cannot honor the required semantics"*. The fix depends on what I am trying to prove. If I want the end-to-end behaviour, I drop `@Transactional` from the test and clean up explicitly, or I use `TestTransaction.flagForCommit()` followed by `end()` to force the commit mid-test and then assert. If I only want to prove the listener's logic, I call the listener method directly with an event instance — it is a public method — and treat the phase as configuration to be asserted separately.

**★ What does `verify(gateway, times(4))` prove in a retry test, and why that number?**
It proves the policy ran to exhaustion with the configuration I think it has, and the number comes straight from the documented formula: *"total attempts = 1 initial attempt + `maxRetries` attempts"*, so `maxRetries = 3` means four calls. The reason it matters is that the exception assertion alone is ambiguous — a method that never retried at all also throws, and a method whose annotation is inert because nobody declared `@EnableResilientMethods` throws faster and greener. Only the invocation count distinguishes "retried three times and gave up" from "did not retry". I would also build the policy as a `RetryPolicy` object with `delay(Duration.ZERO)` for that test rather than going through the proxy, because the documented default delay is one second and I am not paying three seconds a build to observe a count.

**★ Your team wants to assert that submitting an order publishes an `OrderSubmitted` event. What are the options and which do you pick?**
There are three. Mock `ApplicationEventPublisher` in a unit test and verify the publish call — fastest, and it proves the service's own behaviour but nothing about whether anyone is listening. Use `@RecordApplicationEvents` with the `ApplicationEvents` parameter in a Spring test, which the reference describes as making *"all events published during the execution of a single test … available … as a `java.util.Stream`"* — this proves the event actually reached the context and lets me assert the count, which catches the duplicate-publish bug a mock verify with default `times(1)` would also catch but a lenient one would not. Or wire up the real listener and assert its side effect, which tests two units at once and is where I would stop, because that is an integration test of the listener, not of the publication. In practice I use the mock in the service's unit test and one `@RecordApplicationEvents` test per meaningful event, because the count assertion on a real stream is the one that has ever caught a bug for me — usually an event published inside a loop, or twice because of a retry.

**★ Is a passing retry test evidence that the retry is safe?**
No, and this is the question I would push back on hardest. All `verify(gateway, times(4))` proves is that the operation was attempted four times; whether that is safe depends entirely on whether the operation is idempotent, and the retry test cannot see that. If the call charges a card, creates an order, or sends an email, a green retry test has certified four charges, four orders or four emails. So the retry test always comes in a pair: one that proves the policy retried, and one that proves the downstream effect happened exactly once across those attempts — an idempotency key echoed on every attempt, or a uniqueness constraint that the second attempt hits harmlessly. The second test is the one that matters, and it is the one people skip because the first one is green.

**★ Where do you draw the line between testing an event listener and testing the thing it listens for?**
At the event object. The publisher's contract is "when this happens I emit an `OrderSubmitted` with these fields", and I test that with a mocked `ApplicationEventPublisher` or with `@RecordApplicationEvents`, asserting on the event's contents rather than on anything downstream. The listener's contract is "given an `OrderSubmitted` with these fields I do this", and I test that by calling the listener method with an event I constructed — no context, no publication, no transaction. The event type is the seam, and treating it as one keeps both tests fast and keeps their failures attributable. The one test I additionally keep at the integration level is a wiring test that the listener is actually registered, because that is a piece of configuration that can silently disappear — the same category as `@EnableAsync` and `@EnableResilientMethods`, and it fails in the same green, reassuring way.

{/* FOOTER */}
