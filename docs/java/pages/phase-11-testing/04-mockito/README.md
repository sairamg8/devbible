---
title: "Mockito's API is small and learnable in an afternoon; the hard part is knowing what deserves a mock at all, because every mock is a claim that some collaborator's real behaviour does not matter here — and a wrong claim produces a test that passes forever while the code beneath it breaks"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-27 → 2026-08-28 against the **Mockito 5.23.0** sources and javadoc on GitHub
> (tag [`v5.23.0`](https://github.com/mockito/mockito/tree/v5.23.0)) — `Mockito.java`'s numbered
> sections are the primary narrative source, with `MockSettings`, `ArgumentCaptor`, `InjectMocks`,
> `MockitoExtension` and the classes in `mockito-core/src/main/java/org/mockito/internal/` read
> directly for behaviour the javadoc leaves implicit.
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1,
> **Mockito 5.23.0**, JUnit Jupiter 6.0.3, AssertJ 3.27.7.
> **No sandbox** — every exception string on these pages is assembled from Mockito's own
> `Reporter` source, never captured from a console, and no test was run.

**A mock is not a testing tool, it is a design assertion. `when(repo.find(42)).thenReturn(order)`
says: *the real repository's behaviour is irrelevant to what I am proving here.* When that is true
the test is fast, focused and honest. When it is false — when the thing you replaced was the thing
that could actually be wrong — you get a test that passes forever, including on the day the query
breaks. Roughly half of this topic is the API and half is learning to tell those two cases apart.**

The API half is genuinely deep, because Mockito's surface hides a lot: stubbing has five distinct
vocabularies and one of them silently invokes real code, argument matchers have a rule about mixing
that produces an exception three lines later, captors have a lifetime, and strict stubbing has two
documented cases where it deliberately says nothing.

The judgement half returns to one question — **would this test still catch the bug if I had not
mocked that?** — and it has a whole arc of its own: [10](10-never-mock-the-class-under-test.md)
through [12e](12e-running-both-halves.md), ending in the technique that keeps a hand-written fake
from drifting into fiction.

🔴 **Boundary.** This topic is **plain Mockito**. `@MockitoBean`, `@MockitoSpyBean` and `@TestBean`
— Mockito inside a Spring context, and what the container does to a mock — belong to
[05 · The test pyramid](../05-the-test-pyramid/06-bean-overriding.md), which also carries the fact
that Boot 4 **removed** `@MockBean` and `@SpyBean`.

**57 chunks, ~14,100 lines, 758 interview questions.** Read in order; each chunk links to the next.

| # | Chunk | Tier | What it argues |
|---|---|---|---|
| 1 | **[What a mock is for](01-what-a-mock-is-for.md)** | <span className="db-tier t-master">Master</span> | A mock is a claim that a collaborator's real behaviour does not matter here |
| 2 | **[Mock, stub, spy, fake](01b-mock-stub-spy-fake.md)** | <span className="db-tier t-master">Master</span> | Four words people use interchangeably and four different things |
| 3 | **[Creating mocks](02-creating-mocks.md)** | <span className="db-tier t-master">Master</span> | `mock()`, `@Mock`, and the extension that initialises them |
| 4 | **[The inline mock maker](02b-the-inline-mock-maker.md)** | <span className="db-tier t-master">Master</span> | The default since 5.0, and what it made possible |
| 5 | **[Choosing a mock maker](02c-choosing-a-mock-maker.md)** | <span className="db-tier t-master">Master</span> | Subclass vs inline, and when the choice is forced |
| 6 | **[Stubbing](03-stubbing.md)** | <span className="db-tier t-master">Master</span> | `when`/`thenReturn`, and the one form that runs real code |
| 7 | **[Consecutive stubbing](03b-consecutive-stubbing.md)** | <span className="db-tier t-master">Master</span> | Different answers on successive calls, and the last one repeating |
| 8 | **[Answers](03c-answers.md)** | <span className="db-tier t-master">Master</span> | Computing a return value from the arguments |
| 9 | **[AdditionalAnswers](03d-additional-answers.md)** | <span className="db-tier t-master">Master</span> | The built-ins, including `delegatesTo` and the returns-argument family |
| 10 | **[Unstubbed defaults](03e-unstubbed-defaults.md)** | <span className="db-tier t-master">Master</span> | What a mock returns before you tell it anything |
| 11 | **[Default answers](03f-default-answers.md)** | <span className="db-tier t-master">Master</span> | `RETURNS_DEEP_STUBS`, `RETURNS_SMART_NULLS` and what each costs |
| 12 | **[Stubbing voids](03g-stubbing-voids.md)** | <span className="db-tier t-master">Master</span> | `doThrow`/`doAnswer`/`doNothing` — where `when` cannot reach |
| 13 | **[Choosing a stubbing vocabulary](03h-choosing-a-stubbing-vocabulary.md)** | <span className="db-tier t-master">Master</span> | Five ways to say it; which one to standardise on |
| 14 | **[Argument matchers](04-argument-matchers.md)** | <span className="db-tier t-master">Master</span> | 🔴 Mix a matcher and a raw value and it fails *later*, elsewhere |
| 15 | **[The matcher catalogue](04b-the-matcher-catalogue.md)** | <span className="db-tier t-master">Master</span> | Every built-in matcher and what it really tests |
| 16 | **[Custom matchers](04c-custom-matchers.md)** | <span className="db-tier t-master">Master</span> | `argThat`, and why the failure message is the deliverable |
| 17 | **[AdditionalMatchers](04d-additional-matchers.md)** | <span className="db-tier t-master">Master</span> | Boolean combinators and the numeric comparisons |
| 18 | **[Verification](05-verification.md)** | <span className="db-tier t-master">Master</span> | Asserting an interaction — a weaker claim than asserting a result |
| 19 | **[InOrder](05b-inorder.md)** | <span className="db-tier t-master">Master</span> | Ordering claims, and how easily they over-specify |
| 20 | **[Async verification](05c-async-verification.md)** | <span className="db-tier t-master">Master</span> | `timeout()` and `after()`, and which one proves an absence |
| 21 | **[Verifying too much](05d-verifying-too-much.md)** | <span className="db-tier t-master">Master</span> | The test that breaks whenever the implementation changes |
| 22 | **[verifyNoMoreInteractions](05e-verifynomoreinteractions.md)** | <span className="db-tier t-master">Master</span> | Almost always the wrong tool, and what it costs |
| 23 | **[Argument captors](06-argument-captors.md)** | <span className="db-tier t-master">Master</span> | Asserting on what was passed, when a matcher cannot express it |
| 24 | **[Captors and generics](06b-captors-and-generics.md)** | <span className="db-tier t-master">Master</span> | The unchecked warning, and the two ways round it |
| 25 | **[The captor() factory](06c-the-captor-factory.md)** | <span className="db-tier t-master">Master</span> | The newer API that types itself |
| 26 | **[Captor type checking](06d-captor-type-checking.md)** | <span className="db-tier t-master">Master</span> | What the compiler will and will not catch for you |
| 27 | **[Captors and multiplicity](06e-captors-and-multiplicity.md)** | <span className="db-tier t-master">Master</span> | `getValue()` vs `getAllValues()`, and the call you forgot happened |
| 28 | **[The captor's lifetime](06f-the-captors-lifetime.md)** | <span className="db-tier t-master">Master</span> | It accumulates, and reusing one across verifications misleads |
| 29 | **[Strictness](07-strictness.md)** | <span className="db-tier t-master">Master</span> | 🔴 Three values in `Strictness`, four in the nested `Mock.Strictness` |
| 30 | **[Living with strict stubs](07b-living-with-strict-stubs.md)** | <span className="db-tier t-master">Master</span> | Two documented silences, and the `@BeforeEach` stub problem |
| 31 | **[Spies](08-spies.md)** | <span className="db-tier t-master">Master</span> | A spy wraps a **copy**, and that one word explains everything |
| 32 | **[What a spy can intercept](08b-what-a-spy-can-intercept.md)** | <span className="db-tier t-master">Master</span> | 🔴 Self-calls **do** go through the spy — the opposite of the folklore |
| 33 | **[Creating a spy without an instance](08c-creating-a-spy-without-an-instance.md)** | <span className="db-tier t-master">Master</span> | `@Spy` on a bare field, and which constructor it uses |
| 34 | **[Stubbing a spy](08d-stubbing-a-spy.md)** | <span className="db-tier t-master">Master</span> | 🔴 `when(spy.foo())` runs the real `foo()`; `doReturn` does not |
| 35 | **[Partial mocks](08e-partial-mocks.md)** | <span className="db-tier t-master">Master</span> | `doCallRealMethod`, `CALLS_REAL_METHODS`, and Mockito's own warning |
| 36 | **[@InjectMocks](09-injectmocks.md)** | <span className="db-tier t-master">Master</span> | 🔴 It swallows injection failures silently; you meet the `null` much later |
| 37 | **[Constructor injection](09b-constructor-injection.md)** | <span className="db-tier t-master">Master</span> | Which constructor wins, and the tie-break nobody documents |
| 38 | **[Property and field injection](09c-property-and-field-injection.md)** | <span className="db-tier t-master">Master</span> | The fallbacks, and when the mock's *name* starts to matter |
| 39 | **[The candidate filters](09d-the-candidate-filters.md)** | <span className="db-tier t-master">Master</span> | Type, then name — and the generic that quietly does not match |
| 40 | **[The case against @InjectMocks](09e-the-case-against-injectmocks.md)** | <span className="db-tier t-master">Master</span> | Constructor injection in the test body makes it unnecessary |
| 41 | **[Never mock the SUT](10-never-mock-the-class-under-test.md)** | <span className="db-tier t-master">Master</span> | Partially mocking the thing you are testing tests the mock |
| 42 | **[Types you do not own](10b-do-not-mock-types-you-do-not-own.md)** | <span className="db-tier t-master">Master</span> | Your mock encodes your belief about a library, not the library |
| 43 | **[The refactor that removes the need](10c-the-refactor-that-removes-the-need.md)** | <span className="db-tier t-master">Master</span> | Most hard-to-mock code is telling you something |
| 44 | **[The honest exceptions](10d-the-honest-exceptions.md)** | <span className="db-tier t-master">Master</span> | When mocking the difficult thing really is right |
| 45 | **[The anti-corruption adapter](10e-the-anti-corruption-adapter.md)** | <span className="db-tier t-master">Master</span> | Own the interface, then mock your own |
| 46 | **[Mocking JDK types](10f-mocking-jdk-types.md)** | <span className="db-tier t-master">Master</span> | `Clock`, `Optional`, collections — inject the value instead |
| 47 | **[Mocking value objects](10g-mocking-value-objects.md)** | <span className="db-tier t-master">Master</span> | A mocked value object is a slower, less correct constructor |
| 48 | **[Static and final](11-static-and-final.md)** | <span className="db-tier t-master">Master</span> | `mockStatic` exists; the scope rule is what makes it safe |
| 49 | **[Static mocking as a signal](11b-static-mocking-as-a-design-signal.md)** | <span className="db-tier t-master">Master</span> | It works, and it is telling you about a dependency you hid |
| 50 | **[Mocking construction](11c-mocking-construction.md)** | <span className="db-tier t-master">Master</span> | `mockConstruction`, and why it is rarely the right answer |
| 51 | **[The unmockable](11d-final-enums-and-the-unmockable.md)** | <span className="db-tier t-master">Master</span> | Enums, records, sealed types — and why that is usually fine |
| 52 | **[Mocks vs fakes](12-mocks-vs-fakes.md)** | <span className="db-tier t-master">Master</span> | Configured answers vs a working implementation |
| 53 | **[What a fake costs](12b-what-a-fake-costs.md)** | <span className="db-tier t-master">Master</span> | Real code you must maintain, and the drift that follows |
| 54 | **[Contract-testing a fake](12c-contract-testing-a-fake.md)** | <span className="db-tier t-master">Master</span> | One suite, run against the real thing and the fake |
| 55 | **[Keeping a contract honest](12d-keeping-a-contract-honest.md)** | <span className="db-tier t-master">Master</span> | The override that disables a clause and reports nothing |
| 56 | **[Running both halves](12e-running-both-halves.md)** | <span className="db-tier t-master">Master</span> | Making sure the build actually runs both subclasses |
| 57 | **[The checklist](13-the-checklist.md)** | <span className="db-tier t-master">Master</span> | Reading a mock-heavy test in a pull request |

## The seven things this topic is really about

1. **Every mock is a claim.** That the collaborator's real behaviour does not matter for this
   assertion. The whole judgement half of the topic is learning when that claim is false
   ([01](01-what-a-mock-is-for.md), [10](10-never-mock-the-class-under-test.md)).
2. **Two APIs, and one of them runs your code.** `when(x.foo())` evaluates `foo()`. On a mock that
   is harmless; on a **spy** it executes the real method with all its side effects, during setup
   ([08d](08d-stubbing-a-spy.md)).
3. **Matchers are positional and all-or-nothing.** Mix one matcher with one raw value and Mockito
   fails later, often in a different test, with a message about the wrong call
   ([04](04-argument-matchers.md)).
4. **Verification is a weaker claim than assertion.** `verify(x).save(order)` says a call happened;
   it says nothing about the result. Over-verification produces tests that break on every refactor
   ([05d](05d-verifying-too-much.md), [05e](05e-verifynomoreinteractions.md)).
5. **Strict stubbing is on by default and deliberately silent twice.** It will not report an unused
   stub in a test that already failed, and will not flag an argument mismatch when stubbing and
   call share a source file ([07b](07b-living-with-strict-stubs.md)).
6. **`@InjectMocks` fails silently.** It swallows injection failures rather than throwing, so the
   symptom is an NPE much later, somewhere that does not name the cause
   ([09](09-injectmocks.md), [09e](09e-the-case-against-injectmocks.md)).
7. **Hard-to-mock code is usually telling you something.** A static call, a constructor buried in a
   method, a type you do not own. The mocking feature that gets you past it exists, works, and
   suppresses the signal ([10c](10c-the-refactor-that-removes-the-need.md),
   [11b](11b-static-mocking-as-a-design-signal.md)).

## Where this connects

- **[01 · JUnit 5](../01-junit-5/README.md)** owns the engine and the lifecycle. `MockitoExtension`
  is a JUnit extension, and [10 · The extension model](../01-junit-5/10-extensions.md) explains the
  machinery it is built on.
- **[02 · AssertJ](../02-assertj/README.md)** owns assertion style. Verification is not assertion,
  and confusing the two is [05](05-verification.md)'s opening argument.
- **[05 · The test pyramid](../05-the-test-pyramid/06-bean-overriding.md)** owns Mockito **inside
  Spring** — `@MockitoBean`, `@MockitoSpyBean`, `@TestBean`, and the fact that a bean override is
  not AOP-proxied. If you are mocking a Spring bean, that topic and not this one has your answer.
- **[03 · Parameterized tests](../03-parameterized-tests/README.md)** is frequently the better tool
  than a mock with consecutive stubbing: many cases, one test, no interaction claims.

{/* FOOTER */}
