---
title: "Every trick in the 02 band is paid for with a Java agent the JDK has been restricting since 21, a thread-local scope that silently does not apply where you think, and a memory leak the project documents but cannot fix — so the last question of the band is not can I mock this, it is which of refactor, hand-written double or agent am I buying"
sidebar_label: "02e · The agent tax, and the table"
sidebar_position: 41
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the **Mockito 5.23.0** sources on GitHub, tag `v5.23.0` — the
> class javadoc of
> [`Mockito.java`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/Mockito.java)
> §0.2 *"Configuration-free inline mock making"*, §0.3 *"Explicitly setting up instrumentation
> for inline mocking (Java 21+)"*, §39 *"Mocking final types, enums and final methods"*, §47
> *"New API for clearing mock state in inline mocking"*, §48 *"Mocking static methods"*, §50
> *"Avoiding code generation when only interfaces are mocked"*, §53 *"Specifying mock maker
> for individual mocks"*; and the exception text in
> [`InlineDelegateByteBuddyMockMaker.java`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/internal/creation/bytebuddy/InlineDelegateByteBuddyMockMaker.java)
> at the same tag. Plus **JEP 451** ([openjdk.org/jeps/451](https://openjdk.org/jeps/451)).
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0, Spring
> Framework 7.0.8, JUnit Jupiter 6.0.3, Mockito 5.23.0.
> ⚠️ **No sandbox and no test runs on this machine** — Java source, build configuration and
> documented behaviour only. There are **no timings on this page**, because I have no way to
> measure them and the documentation does not state any.

**Four chunks of this band have each said "here is the trick, and here is the refactor that
removes the need for it". That framing is only useful if the price of the trick is legible,
and it usually is not, because the price is not paid at the call site. It is paid by the
build — an agent flag, a JVM warning, a documented memory leak, a thread-local scope that
silently does not apply to the thread your code runs on. This chunk itemises the bill and
then closes the band with the table: given the obstacle in front of you, do you refactor,
write the double yourself, or reach for the agent.**

## What "the trick" actually is, mechanically

All four tricks — final classes, `mockStatic`, `mockConstruction`, `mockSingleton` — are the
same feature. §39:

> *"This alternative mock maker which uses a combination of both Java instrumentation API and
> sub-classing rather than creating a new class to represent a mock. This way, it becomes
> possible to mock final types and methods."*

> *"Since 5.0.0, this feature is enabled by default."*

Instrumentation means an agent. §39 again, on the mechanism's requirement:

> *"This mock maker has been designed around Java Agent runtime attachment ; this require a
> compatible JVM, that is part of the JDK (or Java 9 VM)."*

So there is exactly one bill, itemised below, and everything in
[02b](02b-when-the-collaborator-is-hard-to-mock.md),
[02c](02c-construction-and-final-classes.md) and
[02d](02d-vendor-clients-and-private-methods.md) draws on it.

## Item 1 · The JDK is closing the door the agent walks through

§0.3, verbatim, and this is the line that matters most on JDK 25:

> *"Starting from Java 21, the JDK restricts the ability of libraries to attach a Java agent
> to their own JVM. As a result, the inline-mock-maker might not be able to function without
> an explicit setup to enable instrumentation, and the JVM will always display a warning."*

That is [JEP 451](https://openjdk.org/jeps/451), whose stated direction is to disallow
dynamic agent loading by default in a future release. The documented fix is to pass Mockito's
own jar as `-javaagent`; the documented stopgap is `-XX:+EnableDynamicAgentLoading`, about
which the javadoc says:

> *"Do however note that, since this option is not standardized, any future release of a JDK
> might prohibit this behaviour."*

🔴 **The build configuration for both — Gradle Kotlin/Groovy DSL and the Maven Surefire
`@{argLine}` form with its VM-crash caveat — belongs to
[`../04-mockito/02b-the-inline-mock-maker.md`](../04-mockito/02b-the-inline-mock-maker.md)
and is not repeated here.** What belongs here is the consequence for a *scenario* decision:
a test that uses one of these tricks has a dependency on a JVM launch flag. That flag lives
in the build file, so it is invisible from the test, it can be dropped by anyone editing
Surefire configuration, and it has to be re-established in every module, every IDE run
configuration that bypasses the build, and every alternative runner. A test that needs no
trick has none of that surface.

## Item 2 · The scope is thread-local, and the thread is often not yours

§48, on static mocking:

> *"When using the inline mock maker, it is possible to mock static method invocations within
> the current thread and a user-defined scope. This way, Mockito assures that concurrently
> and sequentially running tests do not interfere."*

Read as a guarantee that is exactly what you want: parallel tests cannot poison each other.
Read as a limitation it is the single most confusing failure in the band, because **the mock
applies to the thread that opened it and nothing else**. Three concrete consequences:

- Code under test that submits to an `ExecutorService`, runs through an `@Async` proxy, or
  uses a parallel stream sees the **real** static.
- A `MockedStatic` opened in `@BeforeAll` (a static method, which JUnit may run on a
  different thread from the test methods under some execution configurations) is not
  guaranteed to apply to the tests. Open it in `@BeforeEach`, or in the test method's own
  try-with-resources, and the question does not arise.
- Two open registrations for the same type on one thread are rejected. The source builds this
  message: `"For <type>, static mocking is already registered in the current thread"`,
  followed by *"To create a new mock, the existing static mock registration must be
  deregistered"*. The usual cause is a `@BeforeEach` that opens a scope and an `@AfterEach`
  that forgets to close it, which makes the *second* test in the class fail while the first
  passed.

## Item 3 · A documented memory leak with no clean fix

§47 is unusually candid, and it is the item nobody budgets for:

> *"In certain specific, rare scenarios […] inline mocking causes memory leaks. There is no
> clean way to mitigate this problem completely. Hence, we introduced a new API to explicitly
> clear mock state (only make sense in inline mocking!)."*

The API is `MockitoFramework.clearInlineMocks()`. The scenario where a suite grows large
enough for this to matter is a large module with many mocked types and a long-lived forked
JVM, and the symptom is heap pressure late in a run rather than a test failure — which is why
it gets diagnosed as "CI is flaky" rather than as this. It is another cost that does not
appear anywhere near the test that caused it.

## Item 4 · The trick is invisible in review, and the refactor is not

This one is not in any javadoc, and it is the reason the bill keeps being run up. A
`try (MockedStatic<Foo> m = mockStatic(Foo.class))` is four words in a diff. Extracting an
interface and threading a constructor parameter touches the class, the configuration, and
every existing test's construction site. The cheaper diff is not the cheaper decision, and
teams reliably choose by diff size unless somebody names the trade out loud.

## The two escape hatches worth knowing before the table

**Per-mock mock maker**, §53 — when the inline maker is the problem for one specific type:

```java
@Mock(mockMaker = MockMakers.SUBCLASS)
Foo mock;
// or
Foo mock = Mockito.mock(Foo.class, withSettings().mockMaker(MockMakers.SUBCLASS));
```

The javadoc frames it exactly that way: *"You may encounter situations where you want to use
a different mock maker for a specific test only."*

**Interfaces only**, §50 — a whole-project option that removes the instrumentation entirely:

> *"If only interfaces are supposed to be mocked, one can however choose to use a
> `org.mockito.internal.creation.proxy.ProxyMockMaker` that is based on the
> `java.lang.reflect.Proxy` API which avoids diverse overhead of the other mock makers but
> also limits mocking to interfaces."*

Activated by a `/mockito-extensions/org.mockito.plugins.MockMaker` file containing
`mock-maker-proxy`. 🔴 **This is worth taking seriously as a design constraint, not just an
optimisation.** A codebase that can run on `mock-maker-proxy` is one where every mocked
collaborator is an interface you own — which is the state every chunk in this band has been
arguing for. Switching it on makes the rule enforced by the build rather than by review, and
the compile-time cost of adopting it is exactly the list of places that were doing something
this band says not to do.

⚠️ Note that `mockito-inline` as a separate artifact is legacy. §0.2: *"starting from 5.0.0
the inline mock maker became the default mock maker and this artifact may be abolished in
future versions."* If it is in your POM, it is doing nothing and it is a liability.

## 🔴 The decision table — the point of the whole band

Given the obstacle in the left column, the middle column is the answer in the overwhelming
majority of cases. The right column is when the middle one is genuinely unavailable.

| Obstacle | Default answer | Agent-based trick is right when |
|---|---|---|
| Static call to **your own** utility | one-method interface + method reference `@Bean` ([02b](02b-when-the-collaborator-is-hard-to-mock.md)) | the utility is generated, or in a jar you consume, and you cannot introduce the interface at the call site |
| `Instant.now()` / `LocalDate.now()` | inject `java.time.Clock` | never — `Clock` is a first-class JDK seam and `mockStatic` is strictly worse |
| `UUID.randomUUID()` | inject `Supplier<UUID>` or an `IdSource` | never, same reason |
| `System.getenv` / `getProperty` | bind a `@ConfigurationProperties` type and inject it | a legacy class you cannot construct differently |
| `new Foo(...)` inside the method | inject the instance; a factory only if per-call state is real ([02c](02c-construction-and-final-classes.md)) | the constructing class is legacy code under a characterization test |
| **Final class you own** | delete `final`, or extract an interface | never — you own it |
| **Final class you do not own** | anti-corruption interface + adapter ([04](04-a-third-party-sdk.md)) | you are testing the adapter itself and there is no vendor double; even then prefer a recorded payload |
| **Vendor client, fat surface** | one narrow port in your vocabulary ([02d](02d-vendor-clients-and-private-methods.md)) | never — the mock is unverified belief, and being able to write it is not permission |
| Vendor **response DTO** | construct the real one, or deserialize a captured payload | never — mocking a value deletes the mapping under test |
| **Enum / singleton you cannot construct** | inject an interface the enum implements | legacy code you cannot change; `mockSingleton` since 5.22.0 |
| **Private method** | test through the public entry point, or extract a class ([02d2](02d2-the-private-method.md)) | there is no trick — reflection is scaffolding only |
| **Protected hook** | restructure so the hook is a collaborator | narrow legacy characterization work only |
| A one-method interface of yours | 🔴 **a lambda** — no Mockito at all | never |

Two readings of that table are worth stating explicitly. First, the number of rows where the
trick is the right answer is small, and every one of them contains the words *legacy*,
*generated*, or *cannot change*. Second, the middle column is not a list of testing
techniques — it is a list of design moves. That is the whole argument of the band: the
mocking obstacle was always a design report, and the trick is the option to ignore it.

## The third column people forget: write the double yourself

The band has been framed as trick-versus-refactor, and there is a third option that is often
better than both. Once the collaborator is a **small interface you own**, the best double is
frequently not a Mockito mock at all but a hand-written fake — an in-memory `Map`-backed
`RefundRepository`, a `Refunds` that records what it was asked to do and returns a canned
result, a `Clock` that is a value. It is cheaper to read at the call site, it has no stubbing
ceremony, it can enforce its own invariants, and it can be reused across dozens of tests.
Its cost is that it is a second implementation which can drift from the real one, and the
answer to that is a shared contract test. **Topic 04 · Mockito** owns that argument in full —
[`../04-mockito/12-mocks-vs-fakes.md`](../04-mockito/12-mocks-vs-fakes.md) and
[`../04-mockito/12c-contract-testing-a-fake.md`](../04-mockito/12c-contract-testing-a-fake.md).

## Where this connects

- The four shapes and their tricks: [02b](02b-when-the-collaborator-is-hard-to-mock.md),
  [02c](02c-construction-and-final-classes.md),
  [02d](02d-vendor-clients-and-private-methods.md), [02d2](02d2-the-private-method.md).
- The build configuration for the agent, in Maven and Gradle, with the `@{argLine}` trap:
  [`../04-mockito/02b-the-inline-mock-maker.md`](../04-mockito/02b-the-inline-mock-maker.md)
  and [`../04-mockito/02c-choosing-a-mock-maker.md`](../04-mockito/02c-choosing-a-mock-maker.md).
- The ownership rule that most of the middle column derives from:
  [01 · What to mock and what to let run](01-what-to-mock-and-what-to-let-run.md).
- Where the JS analogy makes people expect a module registry that Java does not have, which
  is why `jest.mock` reflexes end up here: [01c](01c-where-the-analogy-breaks.md).
- The ordinary case the table exists to send you back to:
  [02](02-mocking-a-class-you-own.md) and [02a](02a-building-the-test-class.md).

## Gotchas

**★ The agent requirement lives in the build file, so the test that depends on it carries no evidence that it does.**
Nothing in `try (MockedStatic<Foo> m = mockStatic(Foo.class))` says "this test needs a `-javaagent` on the forked JVM". The dependency is real and it is remote: a new module without the Surefire configuration, an IDE run configuration that bypasses Gradle, a colleague adding `<argLine>` for something else and dropping the Mockito entry. The failure then looks like a Mockito bug in one environment only.

**★ `-XX:+EnableDynamicAgentLoading` is treated as the fix and is documented as a stopgap.**
The javadoc's exact caveat is that *"since this option is not standardized, any future release of a JDK might prohibit this behaviour"*. Adding it silences the warning today and defers the work to whichever JDK upgrade removes it, at which point the build breaks with no obvious connection to the flag somebody added years earlier. The `-javaagent` form is the documented durable answer.

**★ A static mock does not apply to work the method hands to another thread, and the test failure looks like the arrangement is wrong.**
§48's *"within the current thread"* is the whole sentence. An `@Async` call, an executor submission, a `CompletableFuture.supplyAsync`, a parallel stream — all see the real static. The assertion then fails with the production value, the natural reaction is to suspect the stubbing syntax, and the actual cause is threading. An injected collaborator is visible from every thread that has the object.

**★ Opening a `MockedStatic` in `@BeforeEach` without closing it in `@AfterEach` fails the *second* test, not the first.**
The registration is per thread and per type, and a second `mockStatic` for the same type while one is live is rejected with `"For <type>, static mocking is already registered in the current thread"`. So the class passes its first test and fails everything after, which reads like an ordering problem rather than a lifecycle one. Prefer the try-with-resources inside the test method; if you must use `@BeforeEach`, the `@AfterEach` close is not optional.

**★ `MockedStatic` in `@BeforeAll` is a trap because `@BeforeAll` is static and the thread association is not something you control.**
The scope binds to whichever thread opened it. Class-level setup is not guaranteed to be the thread that runs the test methods, and JUnit's parallel execution modes make that less likely rather than more. There is no configuration that makes a static mock class-scoped; the design is per-thread by intent, because that is what makes concurrent tests safe.

**★ The inline mock maker has a documented memory leak, and the symptom is a slow or OOM-ing CI job rather than a red test.**
§47 says plainly that *"there is no clean way to mitigate this problem completely"* and offers `MockitoFramework.clearInlineMocks()`. Because the failure appears as heap pressure late in a long forked run, it is usually attributed to the CI agent, the container memory limit, or "the suite got big". If a module mocks many types and the JVM is long-lived, this belongs on the list of suspects.

**★ `mockito-inline` on a Mockito 5 classpath is dead weight that reads like a deliberate choice.**
§0.2: since 5.0.0 the inline maker is the default and *"this artifact may be abolished in future versions"*. A dependency block containing it survives code review because it looks intentional, and it makes a reader believe the project made a mock-maker decision it never made. Delete it.

**★ Choosing the trick because the diff is smaller is a decision nobody records, and it is the one being made.**
Four words versus a constructor change across a class, a configuration, and every existing test. The trick wins on effort every single time, which is precisely why the choice has to be made against a stated rule rather than in the moment. The rule the table encodes: the trick is for code you cannot change, and "would rather not change" is not that.

**★ `mock-maker-proxy` is presented as an optimisation and is really a design constraint you can enforce.**
Switching to it limits mocking to interfaces. The build then fails wherever somebody mocks a concrete vendor class, a final DTO or the class under test — which is not a regression list, it is the list of places this band says are wrong. Teams evaluate it on performance grounds, decide the saving is not worth it, and miss the enforcement, which is the larger benefit.

**★ Mocking final types silently disables `serializable()` and `extraInterfaces()`, so a class becoming final upstream breaks a test for a reason the message does not name.**
§39 lists both as *"incompatible"* with mocking final types and enums. The scenario is a vendor marking a class final in a minor release: your mock still constructs, and the failure is a serialization or missing-interface error in a test that has not changed. It is on this page because it is another cost of the inline maker that is invisible until a dependency bump triggers it.

## Interview questions

**★ Mockito 5 can mock statics, constructors and final classes out of the box. What does that capability cost, and where does the cost land?**
It is one capability, the inline mock maker, and it costs in four places that are all remote from the test. It needs a Java agent, which JDK 21 restricted and JEP 451 intends to disallow by default eventually, so the test now depends on a `-javaagent` flag configured in the build and absent from any IDE run configuration that bypasses it. Its scopes are thread-local by design, so a static mock does not apply to anything the code under test hands to another thread — which produces a failure that looks like bad stubbing. It has a memory leak the project documents and says it cannot cleanly fix, which surfaces as CI heap pressure rather than as a red test. And it is invisible in review, because the trick is four words and the alternative is a constructor change. None of those show up in the file the developer is editing, which is why the decision gets made on the wrong basis.

**★ Give me your rule for when a mocking trick is the right answer.**
When the code cannot be changed, and I mean that literally: it is generated, it is in a jar I consume, or it belongs to a team that releases on its own schedule. Everything else is a preference dressed as a constraint. The second half of the rule is what "right answer" means: even when the trick is correct, I treat it as scaffolding around a characterization test rather than as a permanent state, because the thing that made it necessary is still there and the next person pays again. The version of this I actually use in review is a question rather than a rule — what would this test look like if the collaborator were a constructor parameter? If the answer is shorter, faster and needs no agent, the refactor is the work.

**★ Your team's static mocking tests pass locally and fail in CI after a JDK upgrade. Where do you look?**
At the JVM arguments the test JVM actually receives, first and only. JDK 21 and later restrict a library attaching an agent to its own JVM, so the inline mock maker needs Mockito's jar passed as `-javaagent`, and the two places that goes wrong are a Surefire `<argLine>` that was overwritten — most often by someone adding JaCoCo or another agent without preserving `@{argLine}` — and a module that never had the configuration because it was added when only one module used mocks. The second suspect is a `-XX:+EnableDynamicAgentLoading` that used to be there and is not, or that the new JDK no longer honours. What I would not do is start by changing the tests, because the tests are the same tests; the launch configuration changed underneath them.

**★ When would you write a fake by hand instead of using Mockito at all?**
When the collaborator is a small interface I own and more than a handful of tests need it to behave, rather than to return one value. An in-memory repository backed by a `Map` reads better at fifty call sites than fifty `given(...).willReturn(...)` arrangements, it can enforce its own invariants — rejecting a duplicate id, returning what was actually saved — and it makes the tests read like the scenario instead of like a stubbing script. For a one-method interface I would go further and use a lambda, which needs no library and no annotation. The cost of a fake is drift: it is a second implementation of the contract, and if the real one changes, the fake happily keeps agreeing with the old behaviour. That is what a shared contract test is for, and if I am not willing to write one, I should not be writing the fake either.

{/* FOOTER */}
