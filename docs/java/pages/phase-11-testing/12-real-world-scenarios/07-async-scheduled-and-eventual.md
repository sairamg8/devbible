---
title: "Testing something that happens on another thread is three separate questions wearing one coat — does the work do the right thing, does the wiring actually run it off-thread, and does the caller behave while it is pending — and every flaky async test in your suite is one of the three being answered by accident"
sidebar_label: "07 · Async, scheduled and eventual"
sidebar_position: 60
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the **Spring Framework 7.0.x** reference *Task Execution and
> Scheduling*
> ([docs.spring.io](https://docs.spring.io/spring-framework/reference/integration/scheduling.html)),
> the `SyncTaskExecutor` javadoc
> ([docs.spring.io](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/core/task/SyncTaskExecutor.html)),
> the **Spring Boot 4.1** reference *Task Execution and Scheduling*
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/features/task-execution-and-scheduling.html)),
> the **Awaitility 4.3.0** usage guide ([github.com](https://github.com/awaitility/awaitility/wiki/Usage))
> and `Awaitility` javadoc
> ([javadoc.io](https://javadoc.io/static/org.awaitility/awaitility/4.3.0/org/awaitility/Awaitility.html)),
> and the **AssertJ 3.27.7** `AbstractCompletableFutureAssert` javadoc
> ([javadoc.io](https://www.javadoc.io/static/org.assertj/assertj-core/3.27.7/org/assertj/core/api/AbstractCompletableFutureAssert.html)).
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0, Spring
> Framework 7.0.8, JUnit Jupiter 6.0.3, Mockito 5.23.0, AssertJ 3.27.7, Awaitility 4.3.0.
> ⚠️ **No sandbox and no test runs on this machine** — Java source and documented behaviour
> only, never console output.

**A React developer's async reflex is `await waitFor(...)`, and [01c](01c-where-the-analogy-breaks.md)
already said why that reflex mistranslates: Jest owns the event loop and Java does not. This
chunk is the constructive half. The move that fixes async testing is not a better waiting
library — it is refusing to write one test that answers three questions. Split them, and two
of the three stop being async tests at all.**

## The three questions, and which of them needs a thread

Take one method:

```java
@Service
public class ReceiptService {

    private final ReceiptRenderer renderer;
    private final MailGateway mail;

    public ReceiptService(ReceiptRenderer renderer, MailGateway mail) {
        this.renderer = renderer;
        this.mail = mail;
    }

    @Async
    public void emailReceipt(OrderId id) {
        Receipt receipt = renderer.render(id);
        mail.send(receipt.recipient(), receipt.subject(), receipt.body());
    }
}
```

Three things could be wrong, and they are unrelated:

| Question | The failure it catches | What the test needs |
|---|---|---|
| **1 · Does the body do the right thing?** | Wrong recipient, unrendered template, missing null check | Nothing. Call the method. No Spring, no thread. |
| **2 · Is it actually asynchronous?** | `@Async` on a `private` method, self-invocation, missing `@EnableAsync`, the wrong executor | A Spring context with the async infrastructure in it, and exactly one assertion |
| **3 · Does the caller behave while it is pending?** | Checkout blocking on the mail server; a transaction held open across an HTTP call | A test of the caller, with the async bean mocked |

Almost every team writes one test that tries to be all three: `@SpringBootTest`, call
`emailReceipt`, `Thread.sleep(500)`, verify the mail gateway. It is slow, it is flaky, and
when it fails you cannot tell which of the three broke. Worse — as the next section shows —
it can *pass* while question 2's answer is "no".

## Question 1 is not an async test, and it is the one that finds bugs

`@Async` is metadata. The bytecode of `emailReceipt` is an ordinary method body. So the test
of the body is an ordinary unit test — [02](02-mocking-a-class-you-own.md)'s pattern, no
Spring, microseconds:

```java
@ExtendWith(MockitoExtension.class)
class ReceiptServiceTest {

    @Mock ReceiptRenderer renderer;
    @Mock MailGateway mail;

    @Test
    void sendsTheRenderedReceiptToTheOrderContact() {
        ReceiptService service = new ReceiptService(renderer, mail);
        when(renderer.render(ORDER_ID)).thenReturn(
                new Receipt("ada@example.com", "Your receipt", "…"));

        service.emailReceipt(ORDER_ID);   // runs on THIS thread — no proxy exists

        verify(mail).send("ada@example.com", "Your receipt", "…");
    }
}
```

`new ReceiptService(...)` is not a proxy, so `@Async` does nothing here and the call is
synchronous. That is not a limitation of the test; it is the whole reason the test is fast
and deterministic. **The correct number of asynchronous tests for the body of an async
method is zero.**

## Question 2 is one test for the whole application, not one per method

`@Async` is implemented by a bean post-processor that `@EnableAsync` registers. The
Framework reference is explicit about the interception model:

> *"The default advice mode for processing `@Async` annotations is `proxy` which allows for
> interception of calls through the proxy only. Local calls within the same class cannot get
> intercepted that way. For a more advanced mode of interception, consider switching to
> `aspectj` mode in combination with compile-time or load-time weaving."*

And Spring Boot does **not** turn it on for you. Boot auto-configures the *executor*, not the
annotation processing — the reference lists what the auto-configured `AsyncTaskExecutor` is
used for and the first entry is:

> *"Execution of asynchronous tasks using `@EnableAsync`, unless a bean of type
> `AsyncConfigurer` is defined."*

Read that as a conditional. There is an executor waiting; `@EnableAsync` is what starts
routing calls to it. If the `@Configuration` class carrying `@EnableAsync` is not in the
context your test loaded, no proxy is created, the annotation is inert, and every call runs
on the caller's thread. **Nothing fails.** A test that calls the method and verifies the
mock passes — perfectly, instantly, and while proving the opposite of what it claims.

This is the single nastiest property of async testing in Spring: the broken configuration
produces *greener* tests than the working one.

So write one test that asserts the wiring, once, for the application:

```java
@SpringBootTest
class AsyncWiringTest {

    @Autowired ReceiptService receipts;
    @MockitoBean MailGateway mail;
    @MockitoBean ReceiptRenderer renderer;

    @Test
    void asyncMethodsRunOffTheCallingThread() {
        Thread callingThread = Thread.currentThread();
        AtomicReference<Thread> executingThread = new AtomicReference<>();
        when(renderer.render(any())).thenAnswer(inv -> {
            executingThread.set(Thread.currentThread());
            return new Receipt("ada@example.com", "s", "b");
        });

        receipts.emailReceipt(ORDER_ID);

        await().atMost(Duration.ofSeconds(2))
               .untilAtomic(executingThread, notNullValue());
        assertThat(executingThread.get()).isNotSameAs(callingThread);
    }
}
```

One test. It fails the day someone deletes `@EnableAsync`, restructures the configuration
classes, or makes `emailReceipt` package-private. Repeating it per async method buys nothing
because there is only one thing that can be broken.

The cheaper cousin, which catches the same class of mistake without a thread, is a plain
context assertion:

```java
@Test
void theServiceBeanIsProxied() {
    assertThat(AopUtils.isAopProxy(receipts)).isTrue();
}
```

That one catches "the annotation is inert" but not "the annotation is on a self-invoked
method", so it is a supplement, not a replacement.

## Question 3 belongs to the caller, and the async bean is just a mock

The caller's contract is *"I hand this off and return"*. That is not tested by watching a
thread; it is tested by mocking `ReceiptService` and verifying the checkout path does not
wait for it, does not depend on its result, and does not fail when it throws:

```java
@Test
void checkoutSucceedsEvenIfTheReceiptEmailBlowsUp() {
    doThrow(new MailUnavailable()).when(receipts).emailReceipt(any());

    assertThatNoException().isThrownBy(() -> checkout.confirm(basket));
    verify(orders).markConfirmed(any());
}
```

⚠️ Note the honest asymmetry here: in production that exception never reaches `confirm` at
all, because a `void` `@Async` method's exception is swallowed by the proxy (see below). The
test is deliberately *harsher* than production. That is the right way round — it also
documents the behaviour if the annotation is ever removed.

## Return types decide what you can assert, and `void` decides that you cannot

The reference draws the line precisely:

> *"When an `@Async` method has a `Future`-typed return value, it is easy to manage an
> exception that was thrown during the method execution, as this exception is thrown when
> calling `get` on the `Future` result."*

> *"With a `void` return type, however, the exception is uncaught and cannot be transmitted.
> You can provide an `AsyncUncaughtExceptionHandler` to handle such exceptions."*

> *"By default, the exception is merely logged."*

Translate that into test rules:

- **`void`** — `assertThatThrownBy(() -> service.emailReceipt(id))` can never pass through a
  proxy, no matter what the body throws. To test the failure path you either test the body
  directly (question 1) or you register your own `AsyncUncaughtExceptionHandler` and assert
  that *it* was called. If you have no handler, the reference tells you the exception is
  merely logged — which means the only production evidence of a failure is a log line, and
  that is a design decision worth surfacing in review, not a testing problem.
- **`CompletableFuture<Receipt>`** — AssertJ has first-class support and it is better than
  Awaitility here, because the future *is* the completion signal:

```java
@Test
void completesWithTheRenderedReceipt() {
    CompletableFuture<Receipt> future = receipts.renderAsync(ORDER_ID);

    assertThat(future).succeedsWithin(Duration.ofSeconds(2))
                      .extracting(Receipt::recipient)
                      .isEqualTo("ada@example.com");
}
```

and for the failure path, `failsWithin(Duration)` — documented as returning
*"the exception that caused the failure for further (exception) assertions, the exception can
be any of `InterruptedException`, `ExecutionException`, `TimeoutException` or
`CancellationException`"*. Note `ExecutionException` in that list: your business exception is
the **cause**, so the assertion is `.withCauseInstanceOf(MailUnavailable.class)`, not
`isInstanceOf`.
## Where this connects

- Why `jest.useFakeTimers` has no equivalent and a `Clock` is not a scheduler:
  [01c · Where the analogy breaks](01c-where-the-analogy-breaks.md).
- Waiting for the eventual result without a `sleep`, and the executor swap that removes the
  wait entirely: [07a · Waiting without sleeping](07a-waiting-without-sleeping.md).
- `@Scheduled`, application events and retry policies — the other three things on this
  chunk's title: [07b · Testing a scheduled job](07b-testing-a-scheduled-job.md).
- An outbound HTTP call made from an `@Async` method, and why `MockRestServiceServer` is the
  wrong tool for it: [03a](03a-what-the-mock-server-does-not-run.md).
- The everyday collaborator-mocking pattern question 1 reuses:
  [02 · Mocking a class you own](02-mocking-a-class-you-own.md).
- Slice choice and `@MockitoBean` mechanics: **topic 05**,
  [../05-the-test-pyramid/README.md](../05-the-test-pyramid/README.md).

## Gotchas

**★ A missing `@EnableAsync` makes async tests pass, not fail.**
Without the annotation processing in the context, no proxy is created and the "async" call runs inline on the test thread — so the mock is already verified by the time `verify` runs, with no waiting and no flakiness. The suite goes green and stays green while production has silently become synchronous, holding a request thread open across a mail server call. This is why the wiring assertion in question 2 has to exist as its own test: it is the only test in the suite that fails when the annotation disappears.

**★ Self-invocation defeats `@Async` completely, and the reference says so in one sentence people read past.**
*"Local calls within the same class cannot get intercepted that way."* A public `process()` that calls `this.emailReceipt(id)` bypasses the proxy entirely; the annotation on `emailReceipt` is decoration. It is the same rule that governs `@Transactional`, `@Cacheable` and `@Retryable`, and [06c](06c-method-security-with-no-request.md) makes the same point for method security. Move the annotated method onto a different bean, or accept `aspectj` mode and its weaving cost.

**★ `@Async` on a `private` or `final` method is silently ignored by a JDK-proxied bean and behaves differently under CGLIB.**
The interception model is proxy-based, so the method has to be visible and overridable through the proxy. A `private` helper carrying `@Async` is never intercepted at all. This produces exactly the same symptom as the missing `@EnableAsync` — everything works, synchronously — and it is easy to introduce by narrowing a method's visibility during a tidy-up.

**★ `assertThatThrownBy` can never test a `void` `@Async` method's failure path.**
The reference is unambiguous — with a `void` return type *"the exception is uncaught and cannot be transmitted"*. The test cannot see it, the caller cannot see it, and by default *"the exception is merely logged"*. If your `@Async` void methods have no `AsyncUncaughtExceptionHandler`, the failure path has no observer at all in production either, and the test you cannot write is telling you something about the design.

**★ `succeedsWithin` unwraps the value but `failsWithin` gives you an `ExecutionException` wrapper.**
The javadoc lists what you get back: *"the exception can be any of `InterruptedException`, `ExecutionException`, `TimeoutException` or `CancellationException`"*. Your `MailUnavailable` is the **cause** of the `ExecutionException`, so `.withCauseInstanceOf(MailUnavailable.class)` passes and `.isInstanceOf(MailUnavailable.class)` fails — with a message about the wrong exception type that reads like the production code threw the wrong thing.

**★ Boot's auto-configured executor is shared, so a test that saturates it makes unrelated tests wait.**
The reference notes the auto-configured `ThreadPoolTaskExecutor` *"uses 8 core threads that can grow and shrink according to the load"*, and that the same `applicationTaskExecutor` also serves Spring MVC async request handling, WebSocket channels and JPA bootstrap. A test that submits a hundred tasks and never drains them is not isolated from the rest of the context. Define a dedicated executor bean for the work you are testing, or bound it with `spring.task.execution.pool.*` in the test profile.

**★ `@Async` does not work from `@PostConstruct`, and a test of startup behaviour will not tell you why.**
The reference states it plainly: *"You can not use `@Async` in conjunction with lifecycle callbacks such as `@PostConstruct`. To asynchronously initialize Spring beans, you currently have to use a separate initializing Spring bean that then invokes the `@Async` annotated method on the target."* The bean is still being created when the callback runs, so the proxy is not yet in play. A context-load test passes; the work simply happened on the startup thread.

**★ A `@MockitoBean` stubbed from the test thread and invoked from an executor thread is a memory-visibility question nobody asks.**
Mockito's own guidance on concurrent verification is that the feature *"should be used rarely - figure out a better way of testing your multi-threaded system."* Stubbing in the test method and invoking on a pool thread generally works because the executor submission itself establishes a happens-before edge — but building the assertion around it means your test's correctness now depends on the executor's internals. Capture into an `AtomicReference` and assert on that instead, which is what the wiring test above does.

## Interview questions

**★ Your `@Async` test passes locally and in CI. How would you convince me it proves the method is actually asynchronous?**
I would argue that it probably does not, and I would show why. `@Async` is proxy-based, and the proxy only exists if `@EnableAsync` put the post-processor in the context — Boot auto-configures the executor but not the annotation processing; its own reference lists the executor as being used for *"execution of asynchronous tasks using `@EnableAsync`"*. If that configuration is not loaded, the call runs inline, the mock is satisfied before `verify` executes, and the test passes faster and more reliably than the working version. So a passing verify proves nothing about asynchrony. The test that does prove it captures `Thread.currentThread()` inside the collaborator's stub and asserts it is not the test thread — one such test for the whole application, because there is only one thing that can be broken. Everything else about the method's behaviour I test by calling it directly on a plain instance, where `@Async` is inert by construction and the test is deterministic.

**★ How do you test that a failure inside a fire-and-forget async method is handled?**
First by testing the body directly, without the proxy, which is where the exception is actually visible and where the branch logic lives. Then, if the question is really "does the application notice", by asserting on the `AsyncUncaughtExceptionHandler`, because that is the only observer the framework offers for a `void` `@Async` method — the reference says the exception *"is uncaught and cannot be transmitted"* and that by default *"the exception is merely logged"*. Registering a test handler that records what it received turns an invisible path into an assertable one. If the application has no handler at all, my answer to the interviewer is that the failure is untestable because it is also unobservable in production, and the fix is a design change — either a handler that increments a metric, or changing the signature to `CompletableFuture` so the caller can decide.

**★ Would you rather return `void` or `CompletableFuture` from an async method, and does testability influence that?**
It influences it heavily, and in the same direction as the operational argument. A `void` `@Async` method is a hole in the system: the caller cannot know whether the work succeeded, the framework documents that the exception *"cannot be transmitted"*, and the only default record is a log line. That is untestable in the same way it is unobservable — the two are the same property. `CompletableFuture` gives the caller a handle, gives me `succeedsWithin`/`failsWithin` as first-class AssertJ assertions, and gives production something to attach a timeout, a fallback or a metric to. I would still choose `void` for genuinely fire-and-forget work where a failure is acceptable and already covered by a handler that alerts — audit logging, cache warming — but I would want that decision to be explicit rather than the result of nobody thinking about the return type.

**★ A test does `@SpringBootTest`, calls an async method, sleeps, and verifies a mock. Rewrite it and justify each change.**
I would delete it and write three things. The behaviour of the method body becomes a plain Mockito unit test with `new` construction and no Spring at all, because `@Async` is inert without a proxy and that makes the test deterministic and sub-millisecond. The claim that the call is asynchronous becomes one context test for the whole application that captures the executing thread and asserts it differs from the caller's — not per method, because there is only one piece of configuration that can break. And the caller's obligation, that it hands off and does not block or fail, becomes a test of the caller with the async bean mocked. What I have removed is the sleep, which is simultaneously too short for a loaded CI runner and pure dead time everywhere else, and the conflation, which is what made the original failure impossible to diagnose.

{/* FOOTER */}
