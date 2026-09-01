---
title: "Topics 01 to 11 taught the tools — JUnit, Mockito, AssertJ, slices, MockMvc, Testcontainers — and this one answers the question you actually have on a Monday morning, which is not 'how does Mockito work' but 'I have to test this thing today, what do I write?'"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 to 2026-09-01 against the **Spring Framework 7.0.x** reference and javadoc
> (`MockRestServiceServer`, `ContentRequestMatchers`, `JsonPathRequestMatchers`, `JsonCompareMode`,
> `ResponseCreator`, the REST Clients, Resilience, Caching and Application Events chapters), the
> **Spring Boot 4.1** reference, **Spring AMQP** and **Spring Kafka** reference documentation,
> **Mockito 5.23.0** javadoc and source, **JSONassert**, **Awaitility 4.3.0**, the **JDK 25**
> javadoc (`HttpTimeoutException`, `HttpConnectTimeoutException`, `ScheduledExecutorService`) and
> **JLS §25 §13.1**, plus **RFC 9110** and **Jakarta Persistence 3.2** / **Jakarta Messaging 3.1**.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0, Spring Framework
> 7.0.8, JUnit Jupiter 6.0.3, Mockito 5.23.0, AssertJ 3.27.7, Testcontainers 2.0.5,
> Awaitility 4.3.0.
> ⚠️ **No sandbox, no Docker, no broker and no test run on this machine.** Every chunk carries
> Java source and documented behaviour. **There is no console output, no container log, no timing
> and no test transcript anywhere in this topic.**

**This topic exists because of a specific request: teach the real-world testing scenarios the way
JavaScript and React testing treat theirs — mock the module, mock the network, render the
component, wait for the async thing, assert what was sent. So it is task-shaped rather than
API-shaped. Every other topic in this phase is organised around a tool; this one is organised
around the ticket in front of you, and it links back to the tool topics rather than re-teaching
them.**

**50 chunks, ~11,818 lines, 598 gotchas and interview questions.**

## What this topic will not do

It does not re-explain `when/thenReturn`, `@WebMvcTest` or `@ServiceConnection`. Those belong to
[04 · Mockito](../04-mockito/README.md), [05 · The test pyramid](../05-the-test-pyramid/README.md),
[06 · MockMvc](../06-mockmvc/README.md), [07 · Testcontainers](../07-testcontainers/README.md) and
[08 · Test data patterns](../08-test-data-patterns/README.md). Each chunk here spends its words on
the **scenario**: the seam, the decision, the failure mode, and the assertion actually worth
making.

## Start here

- **New to the topic:** [01 · What to mock, what to let run](01-what-to-mock-and-what-to-let-run.md)
  — the one decision every other chunk depends on.
- **Coming from JavaScript or React:** [01b · The JS-to-Java map](01b-the-js-to-java-map.md), then
  [01c · Where the analogy breaks](01c-where-the-analogy-breaks.md).
- **Holding a ticket right now:** [12 · The checklist](12-the-checklist.md) — the routing table
  from ticket to chunk, and what to write before the fix.

## The chunks

### The decision underneath everything

| # | Chunk | The scenario |
|---|---|---|
| 01 | [What to mock, what to let run](01-what-to-mock-and-what-to-let-run.md) | Mock at a boundary you own; never the class under test, never a value object |
| 01a | [The four failure modes](01a-the-four-failure-modes.md) | What goes wrong when you get that decision wrong |
| 01b | [The JS-to-Java map](01b-the-js-to-java-map.md) | `jest.mock` → constructor injection; `msw` → `MockRestServiceServer`; `waitFor` → Awaitility |
| 01c | [Where the analogy breaks](01c-where-the-analogy-breaks.md) | The three places the mapping stops being true |

### A collaborator you own

| # | Chunk | The scenario |
|---|---|---|
| 02 | [Mocking a class you own](02-mocking-a-class-you-own.md) | The everyday case: a service with a collaborator |
| 02a | [Building the test class](02a-building-the-test-class.md) | `@Mock`, `@InjectMocks`, and what the seam says about the design |
| 02b | [When it's hard to mock](02b-when-the-collaborator-is-hard-to-mock.md) | The obstacle is information about the design |
| 02c | [Construction and final classes](02c-construction-and-final-classes.md) | `new` inside the method, and `final` |
| 02d | [Vendor clients](02d-vendor-clients-and-private-methods.md) | A fat client you did not write |
| 02d2 | [The private method](02d2-the-private-method.md) | "Test this private method" — and why it wants to be its own class |
| 02e | [The agent tax, and the table](02e-the-agent-tax-and-the-decision-table.md) | What the inline mock maker costs, and refactor-vs-mock as a decision table |

### An outbound HTTP API

| # | Chunk | The scenario |
|---|---|---|
| 03 | [Mocking an outbound HTTP API](03-mocking-an-outbound-http-api.md) | `RestClient` + `MockRestServiceServer` |
| 03a | [What it does not run](03a-what-the-mock-server-does-not-run.md) | The parts of the stack a Spring-side mock skips |
| 03b | [WireMock and MockWebServer](03b-wiremock-and-mockwebserver.md) | When you need a real socket, and which to pick |
| 03c | [The error paths nobody writes](03c-the-error-paths-nobody-writes.md) | The failures that arrive **with** a status code |
| 03d | [Asserting what you sent](03d-asserting-what-you-sent.md) | The envelope: method, URI, query encoding, headers, auth |
| 03d2 | [Asserting the body](03d2-asserting-the-body.md) | `JsonCompareMode`, form and multipart, captors |
| 03e | [MockWebServer and the cost](03e-mockwebserver-and-the-cost-of-a-socket.md) | What a real socket buys and what it charges |
| 03f | [Failures with no status code](03f-the-failures-with-no-status-code.md) | Timeouts, resets, DNS, TLS — nothing came back |
| 03f2 | [When the response is wrong](03f2-when-a-response-arrives-and-is-wrong.md) | Malformed JSON, HTML with a 200, an empty 200, a redirect loop |
| 03g | [The 429 and Retry-After](03g-the-429-and-retry-after.md) | Rate limits, and retrying honestly |

### A third-party SDK, a controller, and security

| # | Chunk | The scenario |
|---|---|---|
| 04 | [A third-party SDK](04-a-third-party-sdk.md) | The anti-corruption interface |
| 04b | [The three test populations](04b-the-adapter-and-the-three-test-populations.md) | What to test where, once an adapter exists |
| 04c | [The SDK's own test double](04c-the-sdks-own-test-double.md) | Using the vendor's fake when there is one |
| 04d | [Doubles that run the protocol](04d-doubles-that-run-the-real-protocol.md) | The strongest double available, and its price |
| 05 | [A controller, end-to-end-ish](05-testing-a-controller-end-to-end-ish.md) | The React-`render` equivalent: request in, JSON out |
| 05b | [The three assertions](05b-the-three-assertions-and-the-hedge.md) | Where the slice's boundary really is |
| 06 | [Security in a test](06-security-in-a-test.md) | "As an authenticated user with role X" |
| 06b | [The 401 nobody writes](06b-the-401-and-the-tests-nobody-writes.md) | 🔴 The test everyone omits and every review asks for |
| 06c | [Method security, no request](06c-method-security-with-no-request.md) | Authorisation below the web layer |

### Async, scheduled and message-driven

| # | Chunk | The scenario |
|---|---|---|
| 07 | [Async, scheduled and eventual](07-async-scheduled-and-eventual.md) | `@Async`, the proxy, and the return types that change the answer |
| 07a | [Waiting without sleeping](07a-waiting-without-sleeping.md) | Awaitility, `SyncTaskExecutor`, Mockito's `timeout()` |
| 07b | [Testing a scheduled job](07b-testing-a-scheduled-job.md) | Call the method; never wait for the schedule |
| 07c | [Events and retries](07c-events-and-retries.md) | Listeners are synchronous by default; the retry defaults you inherit |
| 08 | [A message consumer](08-a-message-consumer.md) | The handler as a plain method — the fast, real test |
| 08a | [The payload and the boundary](08a-the-payload-and-the-boundary.md) | The four things a handler test cannot prove |
| 08b | [The container and poison messages](08b-the-container-poison-messages-and-redelivery.md) | Redelivery, and what at-least-once obliges you to prove |
| 08b2 | [Asserting the dead letter](08b2-asserting-the-dead-letter.md) | Asserting that redelivery *stopped* |

### Caching, idempotency, contracts and legacy

| # | Chunk | The scenario |
|---|---|---|
| 09 | [Caching, and the cache-hit test](09-caching-and-idempotency.md) | Asserting the cache hit did not call through |
| 09a | [The cache that outlives the test](09a-the-cache-that-outlives-the-test.md) | 🔴 Isolation, and the context-cache trap |
| 09a2 | [Keys, nulls and eviction](09a2-keys-nulls-and-eviction.md) | The default key generator, and `null` as a cached value |
| 09b | [Idempotency: the client side](09b-idempotency-and-the-double-charge.md) | Asserting a retried request did not double-charge |
| 09b2 | [The idempotent receiver](09b2-the-idempotent-receiver.md) | Insert-first, the response store, and what to key on |
| 09b3 | [Testing the receiver](09b3-testing-the-idempotent-receiver.md) | The four tests, and the JPA rollback-only trap |
| 10 | [JSON contracts and approval tests](10-json-contracts-and-approval-tests.md) | The snapshot-test analogue, and comparison modes |
| 10b | [Volatile fields and review](10b-volatile-fields-and-the-review-workflow.md) | What separates an approval test from a change-detector |
| 11 | [The legacy class with no seams](11-the-legacy-class-with-no-seams.md) | Characterization tests first |
| 11b | [Three seams for a collaborator](11b-three-seams-for-a-collaborator.md) | "Where does this object come from?" |
| 11c | [Class init, config, and the fifth answer](11c-class-init-config-and-the-fifth-answer.md) | "*When* was this value read?" — and sprouting instead of refactoring |
| 12 | [The checklist](12-the-checklist.md) | 🔴 Ticket → chunk, and what to write before the fix |

## The five things this topic is really about

1. **Mock at a boundary you own.** Not the class under test, not a value object, not a type from
   somebody else's library. Almost every bad test in this topic's catalogue traces back to
   violating one of those three.
2. **The awkwardness is the message.** A `final` class, a static call, `new` inside a method — the
   difficulty of mocking is information about the design, and a five-line refactor is usually
   cheaper than the machinery required to avoid it.
3. 🔴 **Assert what you *sent*, not only what you got back.** The request half is where silent
   breakage against a live provider lives: a missing header, an unencoded query parameter, a
   serialised field the other side stopped accepting.
4. **Test the mechanism's unhappy path, because that is why it exists.** A retry, a cache, an
   idempotency key and a dead-letter queue are all built for the case that goes wrong; a test of
   their happy path tests nothing about them.
5. **Never `Thread.sleep`.** It makes a suite slow *and* flaky at the same time, which is the only
   combination with no upside.

## Claims the documentation could not settle — stated in-page, not invented

1. **Whether a synchronous executor changes which path a `void` `@Async` exception takes** (caller
   versus `AsyncUncaughtExceptionHandler`). `07` says so explicitly and tells the reader not to
   build an error-path assertion on it.
2. **A single Spring-level exception type covering redirect-loop exhaustion** across Apache, Jetty,
   Reactor Netty and the JDK client. There is none; `03f2` says so and directs the reader to
   assert termination plus their own failure type, bounded with `@Timeout`.
3. **The inline mock maker's startup and re-transformation cost.** Mockito's javadoc quantifies
   nothing, so `02e` itemises the bill mechanically and carries a banner saying there are no
   timings because none could be measured here or cited.
4. **ApprovalTests-family library coordinates and behaviour** — Boot manages none of them, so `10b`
   flags that in one sentence and otherwise uses only what `spring-boot-starter-test` brings.
5. **`sync = true` under contention.** `09a2` declines to write a test for it, on the grounds that
   a two-thread test asserts a scheduling outcome and can pass with the annotation deleted.

## Two corrections worth knowing, caught by verifying rather than complying

- **A documentation summariser claimed `@EnableAsync` and `@EnableScheduling` are not required
  because Boot auto-configures the infrastructure. That is wrong**, and reading the raw Boot page
  settles it: the auto-configured executor is used *"for … execution of asynchronous tasks using
  `@EnableAsync`"*, and *"a scheduler can also be auto-configured if it needs to be associated
  with scheduled task execution (using `@EnableScheduling` for instance)"*.
- **The Kafka dead-letter suffix** was conflated between `@RetryableTopic` and
  `DeadLetterPublishingRecoverer`. The current `DeadLetterPublishingRecoverer` javadoc says
  `"-dlt"`; the pages use that verbatim and add a gotcha that the suffix is a default which has
  not always been the same string, so configure it explicitly.

{/* FOOTER */}
