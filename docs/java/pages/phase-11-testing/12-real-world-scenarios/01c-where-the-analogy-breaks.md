---
title: "Four of the JS-to-Java mappings are not mappings at all — there is no module registry, reset runs in the opposite direction, render and @WebMvcTest slice at different layers, and a Java Clock is a value rather than a scheduler"
sidebar_label: "01c · Where the analogy breaks"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against the **Mockito 5.23.0** javadoc, §0.3 *"Explicitly setting up
> instrumentation for inline mocking (Java 21+)"* and §48/§49, read from
> `mockito-core-5.23.0-javadoc.jar` on Maven Central; **JEP 451**
> ([openjdk.org/jeps/451](https://openjdk.org/jeps/451)) for the dynamic-agent warning text;
> the **Awaitility 4.3.0** javadoc
> ([javadoc.io](https://javadoc.io/static/org.awaitility/awaitility/4.3.0/org/awaitility/Awaitility.html));
> the **JUnit 6** user guide, *Parallel Execution*
> ([docs.junit.org](https://docs.junit.org/current/user-guide/)); and the **Spring Framework
> 7.0.x** testing reference for bean overrides and the MVC test slice.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0, Spring
> Framework 7.0.8, JUnit Jupiter 6.0.3, Mockito 5.23.0, Awaitility 4.3.0.
> ⚠️ **No sandbox and no test runs on this machine** — source and documented behaviour only.

**[01b](01b-the-js-to-java-map.md) is the translation table. This chunk is the four rows
it marked 🔴, because they are not translations — in each one the JS answer depends on a
runtime capability the JVM does not have, or the JVM has a capability that makes the JS
worry irrelevant and substitutes a different one. Every developer arriving from Jest
writes their first bad Java test on one of these four, and they do it because the mapping
looked like it worked.**

## Break 1 · There is no module registry, so testability is a design property

This is the big one, and it reframes half of what you know.

```js
// Jest: the module is replaced from OUTSIDE. paymentClient.js never consented.
jest.mock('./paymentClient');
import { charge } from './paymentClient';
charge.mockResolvedValue({ id: 'ch_1' });
```

Jest owns the module registry, so it can substitute `./paymentClient` for every importer
in the process. The code under test does not need to be written in any particular way —
it can `import` a singleton at the top of the file and call it directly, and Jest still
gets between them.

**The JVM has no equivalent hook that does not involve rewriting bytecode.** A `new
PaymentClient()` inside a method, or a `PaymentClient.charge(...)` static call, is a
direct invocation compiled into your class file. Nothing in JUnit, Spring or Mockito's
normal operating mode can get between them.

So the Java answer is not a library call, it is a design change:

```java
// The seam is a constructor parameter. That IS the mechanism.
@Service
class CheckoutService {

    private final PaymentGateway payments;

    CheckoutService(PaymentGateway payments) { this.payments = payments; }
}
```

```java
@ExtendWith(MockitoExtension.class)
class CheckoutServiceTest {
    @Mock PaymentGateway payments;
    @InjectMocks CheckoutService service;
}
```

The consequences are worth stating plainly, because they are cultural, not technical:

- **In JS you can leave a module untestable and mock around it. In Java you cannot.** The
  untestable code has to change. That feels like extra work and it is; the compensation is
  that a Java codebase's testability is visible in its constructors, which is a property
  you can review.
- **Java does have the bytecode tricks** — `mockStatic`, `mockConstruction`, mocking final
  classes — and they work, because Mockito 5's default mock maker is the inline one. They
  are covered in [02b](02b-when-the-collaborator-is-hard-to-mock.md), together with the
  refactor that removes the need for each. Treat them as `jest.mock`-shaped nostalgia with
  a real cost.
- **That cost went up on modern JDKs.** The inline mock maker attaches a Java agent to its
  own JVM, and JEP 451 (delivered in JDK 21) made that a warned-about operation, printing
  *"WARNING: Dynamic loading of agents will be disallowed by default in a future
  release"*. Mockito's own javadoc says it plainly: *"Starting from Java 21, the JDK
  restricts the ability of libraries to attach a Java agent to their own JVM. As a result,
  the inline-mock-maker might not be able to function without an explicit setup to enable
  instrumentation, and the JVM will always display a warning."* The `jest.mock` reflex is
  the one Java capability that is getting *harder* over time.

## Break 2 · Reset runs in the opposite direction

Jest tests are full of hygiene you will not need, and Java tests need hygiene Jest never
taught you. The unit of leakage moved.

**What you can stop writing.** `jest.clearAllMocks()`, `resetAllMocks()`,
`restoreAllMocks()` and the `beforeEach` that calls them exist because the module registry
and the spied objects are process-global and survive between tests. JUnit's default
lifecycle is `PER_METHOD` — a new test-class instance per test method — and
`MockitoExtension` initialises the `@Mock` fields freshly for each one. A stub written in
one test method is simply not visible in the next. There is nothing to clear.

**What you now have to worry about instead.** Spring caches the `ApplicationContext`
across test classes for the whole run, deliberately, because building one is expensive.
Everything hanging off that context is therefore shared between test *classes*:

- `@MockitoBean` stubs and recorded invocations (Spring resets bean overrides between
  test methods, but the surrounding context and its other state persist);
- `@Cacheable` caches, which will happily serve a value one test class put there;
- rows in a shared database, unless each test rolls back or truncates;
- singleton beans holding mutable fields, schedulers, connection pools.

So the JS instinct "reset everything in `beforeEach`" is not wrong in Java — it just
points at a different object. **Topic 05 · The test pyramid** owns the context cache and
`@DirtiesContext`; **topic 08 · Test data patterns** owns database cleanup. The mapping to
carry across is: *your `clearAllMocks` reflex belongs to the Spring context, not to the
mocks.*

## Break 3 · `render` and `@WebMvcTest` slice at different layers

Both are "run the thing without the whole world", and that surface similarity hides a
difference that produces a specific class of escaped bug.

`render` puts your **real component tree** into a **fake browser** (jsdom). Everything
above the DOM is real; the DOM itself is a simulation. What escapes: layout, CSS, real
paint order, actual browser event quirks.

`@WebMvcTest` puts the **real Spring MVC dispatch chain** — `DispatcherServlet`, handler
mapping, argument resolvers, validation, message converters, `@ControllerAdvice` — behind
a **mock servlet API**, with **no servlet container and no socket**. What escapes is
therefore the container's job, not the framework's:

- URI decoding and path normalisation performed by the connector before Spring sees it;
- servlet `Filter`s registered outside Spring's filter chain;
- header size limits, chunking, HTTP/2 framing, compression;
- TLS, and anything a reverse proxy in front of it would do;
- the actual bytes on the wire — you assert the serialized body, but nothing wrote it to a
  socket.

The practical rule that falls out: **URL-encoding bugs and filter-ordering bugs pass
`@WebMvcTest` the way layout bugs pass RTL.** For those you need the running-server test
(`@SpringBootTest(webEnvironment = RANDOM_PORT)`), which is the Playwright of this
analogy — slower, fewer of them, and the only place certain bugs can be caught.

## Break 4 · A Java `Clock` is a value, not a scheduler

`jest.useFakeTimers()` replaces `setTimeout`, `setInterval` and `Date` **globally**, and
`advanceTimersByTime` makes pending timers *fire*. Jest can do that because it owns the
event loop.

An injected `Clock` in Java only affects code that asks the clock what time it is. Advance
it and:

- a `@Scheduled(fixedDelay = 60000)` method does **not** run — the scheduler uses its own
  time source, not your bean's clock;
- a thread parked in `Thread.sleep` or `Future.get(timeout)` does **not** wake up;
- a `Duration`-based cache TTL inside a third-party library does **not** expire;
- `Instant.now()` written anywhere without the clock argument is untouched — and one such
  call is enough to make the test nondeterministic while looking fine.

The Java answers are different in kind, and they are answers to *different questions*:

- To test **what a scheduled method does**, call the method directly. It is a public
  method on a bean. The schedule is configuration, and you test configuration by asserting
  the cron expression, not by waiting for it.
- To test **that something eventually happened on another thread**, poll with Awaitility.
  And read its warning, because it is the failure mode nobody expects: *"IMPORTANT:
  Awaitility does nothing to ensure thread safety or thread synchronization! This is your
  responsibility! Make sure your code is correctly synchronized or that you are using
  thread safe data structures such as volatile fields or classes such as `AtomicInteger`
  and `ConcurrentHashMap`."* A test that polls a plain `boolean` field written by another
  thread can loop until timeout on a value that was set long ago, because nothing forced
  the read to see it. In JS this failure cannot occur; there is one thread.

**Chunk 07 · Async, scheduled and eventual** in this topic is the full treatment.

## The scoreboard

| | React / Jest | Java / Spring |
|---|---|---|
| Can a test replace a dependency the code did not accept? | **Yes** — module registry | **No** without bytecode instrumentation |
| Does untestable code stop you writing tests? | No | **Yes**, and that is the point |
| What leaks between tests? | Module and spy state, per file | **The Spring context**, per run |
| Does the runner parallelise by default? | Yes, worker processes | **No** — *"By default, JUnit Jupiter tests are run sequentially in a single thread"* |
| Is there real concurrency to reason about? | No — one thread | **Yes**, with memory visibility |
| Can the test framework freeze time globally? | **Yes** | No — only what reads an injected `Clock` |
| Is there a blessed "update the snapshot" button? | **Yes** (`-u`) | No |
| Can a test run a real PostgreSQL trivially? | Rarely done | **Yes** — Testcontainers is normal |

Read the "Java" column as a list of things you now have to decide on purpose. Two of them
(no module registry, no global fake timers) push design pressure into production code.
Two of them (context leakage, real threads) are new hazards Jest never taught you to look
for. One of them (Testcontainers) is a capability that makes a whole class of JS-style
mocking unnecessary.


## Where this connects

- The table these four rows come from is [01b · The JS-to-Java map](01b-the-js-to-java-map.md).
- The decision underneath all of it — mock at a boundary you own — is
  [01](01-what-to-mock-and-what-to-let-run.md); the failure modes are
  [01a](01a-the-four-failure-modes.md).
- Break 1's practical consequences, and the refactor for each shape of untestable code
  (static call, `new` in a method, final class, fat SDK client), are
  [02b · When the collaborator is hard to mock](02b-when-the-collaborator-is-hard-to-mock.md).
- Break 2's Java half — the context cache, `@DirtiesContext`, `@MockitoBean` — belongs to
  **topic 05 · The test pyramid**; the database side belongs to **topic 08 · Test data
  patterns**.
- Break 3's slice in full is **topic 06 · MockMvc**.
- Break 4's Java half is **chunk 07 · Async, scheduled and eventual** in this topic.

## Gotchas

**★ `render` has no side effects on other tests; a Spring context does, and it is cached across test classes.**
The Jest habit of treating each test file as hermetic is safe in Jest and false in Spring. Two test classes with identical context configuration share one `ApplicationContext` for the whole run, by design. If class A puts a row in the cache or leaves a record in the database, class B sees it — and the failure appears only when the classes run in a particular order, which changes between your laptop and CI.

**★ Reaching for `mockStatic` because it feels like `jest.mock` will pass code review and cost you later.**
It works — Mockito 5's default mock maker is the inline one — and it is scoped and thread-local, which the javadoc is explicit about. But it requires an agent that JDK 21+ warns about attaching, it does not survive a build that turns dynamic agent loading off, and it lets the untestable design stay untestable. It is a tool for legacy code you cannot change, not a substitute for a constructor parameter.

**★ `@MockitoBean` creates the bean if the context does not already have one — so a test can be green while the application has no such bean at all.**
This is the sharpest edge on break 2's Java side, and it has no Jest analogue because Jest cannot invent a module. The default override strategy is `REPLACE_OR_CREATE`, documented as: *"If a corresponding bean does not exist, a new bean will be created."* Delete the `@Service`, or typo the type, or mock an interface nobody implements, and the slice test still passes — it silently manufactured the collaborator it was asked to mock. The application then fails to start in production. Set `enforceOverride = true` to switch the strategy to `REPLACE`, which fails the test when the bean is missing, and make that the house default.

**★ Jest parallelises across files by default; JUnit runs everything in one thread by default — so the JS "make your tests independent" discipline arrives in Java unenforced.**
The JUnit 6 user guide is explicit: *"By default, JUnit Jupiter tests are run sequentially in a single thread; however, running tests in parallel — for example, to speed up execution — is available as an opt-in feature."* Jest's worker processes punish shared state immediately, so JS suites are pressured into independence from day one. A Java suite can accumulate order dependence for years and only discover it the week somebody enables `junit.jupiter.execution.parallel.enabled`. If you intend to parallelise later, turn it on early, while the suite is small enough for the failures to be readable.

**★ The mocked bean has no Spring AOP proxy around it, so break 3's "the slice is real Spring" reassurance has a hole in it exactly where you replaced something.**
`@MockitoBean`'s documented behaviour is that the mock *"is never wrapped in a Spring AOP proxy"*. So the moment you mock a `@Transactional`, `@Cacheable` or `@Retryable` bean to isolate the thing under test, you also removed its advice from the test — quietly, with no warning. If the ticket is about retry or caching behaviour, the collaborator has to be real and the test has to be a Spring test that lets the proxy exist.

**★ Break 1 has a fifth, subtler form: Spring's own dependency injection can hide an untestable design from you.**
Field injection (`@Autowired` on a private field) lets a class acquire ten collaborators without ever declaring a constructor, so the class *looks* injectable while being un-constructible from a plain unit test. Reflection-based test setup then papers over it. The tell is a test that needs a Spring context to instantiate a class with no I/O in it. Constructor injection makes the dependency count visible in a signature, which is precisely the review signal field injection removes.

## Interview questions

**★ You have a React developer joining the Java team. What is the one thing about mocking you make sure they hear on day one?**
That `jest.mock` has no equivalent, and that this is not a gap in the tooling — it is the reason Java designs differ. Jest owns the module registry and can substitute a dependency from outside without the code's cooperation, so a JS codebase can stay untestable indefinitely and still have tests. On the JVM the collaborator has to be handed in, normally through the constructor, or there is no seam at all. Practically that means: when a Java class is hard to test, the answer is usually to change the class, not to find a cleverer test tool. Mockito does offer `mockStatic` and `mockConstruction` for the cases where you genuinely cannot change the code, but reaching for them by reflex reproduces the JS habit while paying a JVM cost — they need an agent that JDK 21 onwards warns about attaching.

**★ In Jest you write `jest.clearAllMocks()` in `beforeEach`. What is the Java equivalent, and why is the honest answer "nothing, but…"?**
Nothing, for the mocks: JUnit's default lifecycle constructs a new test-class instance per test method and `MockitoExtension` builds fresh `@Mock` instances each time, so stub and invocation state cannot leak between test methods the way it leaks between Jest tests. The "but" is that the leakage did not disappear, it moved. Spring caches the `ApplicationContext` across test classes for the entire run, so caches, database rows, scheduler state and singleton bean fields are shared between classes. The reflex is still right; the object it should point at is the context, not the mocks — which means `@DirtiesContext` when you genuinely must, and per-test data cleanup as the normal answer.

**★ Is `@WebMvcTest` the Java equivalent of React Testing Library's `render`? Where does that comparison mislead?**
It is the closest equivalent in purpose — exercise the real request-handling stack without the real world — but the two slice at different layers, so they let different bugs through. `render` gives you the real component tree in a fake DOM, so layout and CSS escape. `@WebMvcTest` gives you the real Spring MVC dispatch chain — handler mapping, argument resolution, validation, message converters, `@ControllerAdvice` — behind a mock servlet API with no container and no socket, so what escapes is the container's job: URI decoding, filters registered outside Spring, header limits, compression, TLS. The practical consequence is that a URL-encoding bug or a filter-ordering bug passes `@WebMvcTest` exactly the way a layout bug passes RTL, and both need a heavier, rarer test — a running-server `@SpringBootTest` on one side, a real browser on the other.

**★ How do you do `jest.useFakeTimers()` in Java?**
You do not, and understanding why is the point. Jest can freeze time globally because it owns the event loop and can replace `setTimeout` and `Date` for the whole process. Java's answer is to make time an injected dependency: the class takes a `java.time.Clock`, production passes `Clock.systemUTC()`, the test passes `Clock.fixed(...)` or a small mutable clock you can advance. That covers everything that *reads* the time. It covers nothing that *schedules* on it — advancing the clock will not fire a `@Scheduled` method, will not wake a sleeping thread, and will not expire a third-party TTL. For scheduled work the Java move is to call the method directly and assert the cron expression separately; for genuinely concurrent work it is Awaitility polling, with the caveat that Awaitility explicitly does nothing about thread safety, so the state you poll must be `volatile` or an atomic.

**★ Name something Java testing can do trivially that has no comfortable JS equivalent, and something the reverse.**
Java's is running the *real* dependency: Testcontainers makes "this test talks to an actual PostgreSQL 17 with your actual schema" a five-line annotation, and the ecosystem treats it as normal rather than exotic. That removes an entire category of mocking — you do not need a fake repository layer because the real one is affordable. The reverse is `jest.mock`: replacing a dependency the code never agreed to accept. Java cannot do that without a bytecode agent, and the agent route is getting harder, since JEP 451 made dynamic agent loading a warned-about operation in JDK 21 with a stated intention to disallow it by default in a future release. The trade is legible: Java asks for the seam up front and gives you real infrastructure cheaply; JS gives you the seam for free and makes real infrastructure expensive.

**★ A Jest developer says "Java testing is so much more ceremony — I have to change the production class just to test it." Are they right?**
They are describing the cost accurately and the benefit not at all. Yes, when a Java class calls a static or does `new` inside a method, you change the class before you can test it. That is real work Jest would have saved you. What you get for it is that testability becomes a property visible in the constructor signature, reviewable, and enforced by the compiler rather than by discipline — a class with eight constructor parameters announces its own problem, whereas a JS module with eight top-level imports looks identical to one with two. It also means the test's dependency graph is the production dependency graph, so a mock cannot quietly diverge from what the application actually wires. The honest summary is that Jest lets you defer the design question indefinitely and Java makes you answer it now, and deferred design questions are how a codebase becomes untestable in the first place.

**★ You are reviewing a Spring slice test that mocks a bean, and it passes. What would make you suspicious anyway?**
Whether the bean it mocks actually exists. `@MockitoBean` defaults to a `REPLACE_OR_CREATE` strategy — *"If a corresponding bean does not exist, a new bean will be created"* — so mocking a type that no `@Component` provides produces a green test over an application that will not start. I would check that the mocked type has a real implementation in the production source set, and I would push for `enforceOverride = true` as the house default so the framework performs that check instead of the reviewer. The second thing I would look at is whether the mocked bean carries `@Transactional`, `@Cacheable` or `@Retryable`, because the override is documented as never being wrapped in a Spring AOP proxy — so if the test's name mentions retries or caching, mocking that bean has removed the very behaviour under test.

{/* FOOTER */}
