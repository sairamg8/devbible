---
title: "Everything this topic argues, compressed into the questions worth asking about a pull request that touches a test with mocks in it — ordered so that the ones which change what a green build means come before the ones which only change what it costs to maintain"
sidebar_label: "13 · The checklist"
sidebar_position: 63
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-28 — this page states no new facts. Every line links to the chunk that
> argues it and carries the citation, all of which are validated against the **Mockito 5.23.0**
> sources on GitHub (tag `v5.23.0`) and the Mockito wiki.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0,
> **Mockito 5.23.0**, JUnit Jupiter 6.0.3. **No sandbox** — nothing on this page is a test run.

**A review checklist is only useful if it is ordered by consequence. The first section below
contains the checks where a "no" means the test does not prove what its name says — a green
build that is lying. The second contains the checks where a "no" means the test will break on
the next refactor. The third is API correctness. Work top down and stop when the budget for the
review runs out; you will have spent it on the right things.**

## 🔴 Tier 1 — does a green run mean anything?

| Check | If it fails |
|---|---|
| **Is the class under test itself mocked or spied?** | The test asserts against a hybrid the test invented — [10 · Never mock the SUT](10-never-mock-the-class-under-test.md) |
| **Is `@Spy` on the `@InjectMocks` field?** | Same defect, in its least visible form — [10](10-never-mock-the-class-under-test.md) |
| **If a method is stubbed on the SUT, is there a comment naming the removal plan and the coverage hole?** | An undocumented permanent exception — [10d · The honest exceptions](10d-the-honest-exceptions.md) |
| **Is a third-party client, SDK or JDK type mocked directly?** | The test certifies your guess about someone else's contract — [10b · Types you do not own](10b-do-not-mock-types-you-do-not-own.md) |
| **If there is an adapter, does it have an integration test?** | Every risky belief is now concentrated in one unverified class — [10e · The anti-corruption adapter](10e-the-anti-corruption-adapter.md) |
| **Is a value object, record or entity mocked?** | Constructor invariants bypassed, `equals` unstubbable — [10g · Mocking value objects](10g-mocking-value-objects.md) |
| **Is `LocalDate.now()` / `Instant.now()` mocked instead of a `Clock` injected?** | A hidden dependency kept, with a thread-local workaround attached — [10f · Mocking JDK types](10f-mocking-jdk-types.md) |
| **Is a `List`, `Map` or `Optional` mocked?** | An object that violates its own interface — [10f](10f-mocking-jdk-types.md) |
| **Could the mock be in a state the real collaborator cannot reach?** (`existsById` true, `findById` empty) | The test passes against a world that does not exist — [12 · Mocks vs fakes](12-mocks-vs-fakes.md) |
| **Does the assertion depend on a value the test stubbed and then expected?** | A tautology with a framework in the middle — [10](10-never-mock-the-class-under-test.md) |
| **Would the test still pass if the method under test were emptied?** | It is not testing that method. The ten-second version of a mutation test — [10](10-never-mock-the-class-under-test.md) |

## Tier 2 — will this test survive the next refactor?

| Check | If it fails |
|---|---|
| **Is a query verified as well as stubbed?** | Redundant: the outcome already proves it — [05d · Verifying too much](05d-verifying-too-much.md) |
| **Is every collaborator call verified?** | The test now fails on any change to the conversation — [05d](05d-verifying-too-much.md) |
| **Is `verifyNoMoreInteractions` used as a default rather than for a specific claim?** | Every new call anywhere breaks it — [05e · verifyNoMoreInteractions](05e-verifynomoreinteractions.md) |
| **Is `InOrder` used where order is not part of the requirement?** | Ordering pinned by accident — [05b · InOrder](05b-inorder.md) |
| **Are there unnecessary stubbings, or is strictness turned down to hide them?** | The unused stub is a real signal about the code — [07 · Strictness](07-strictness.md), [07b · Living with strict stubs](07b-living-with-strict-stubs.md) |
| **Is `lenient()` used per-stub, with a reason, or blanket-applied to the class?** | Blanket leniency discards the whole mechanism — [07b](07b-living-with-strict-stubs.md) |
| **Does the test read the SUT's internals — verifying a self-call, or an argument's private state?** | Implementation pinned as if it were behaviour — [05d](05d-verifying-too-much.md) |
| **Are there more than a handful of `when(...)` lines for one assertion?** | The stubbings are hand-maintaining state; that is a fake — [12](12-mocks-vs-fakes.md) |
| **Is consecutive stubbing simulating a state transition?** | A hand-rolled state machine with no invariants — [03b · Consecutive stubbing](03b-consecutive-stubbing.md), [12](12-mocks-vs-fakes.md) |
| **Does an `Answer` contain a `Map`, branches, or accumulated state?** | A fake hiding in a lambda, with no name and no type — [03c · Answers](03c-answers.md) |
| **If a fake is used, is it contract-tested against the real implementation?** | It will drift, and the drift is invisible — [12b · What a fake costs](12b-what-a-fake-costs.md) |
| **Are a fake and a mock both used for the same collaborator in one class?** | Two sets of assumptions, no stated winner — [12](12-mocks-vs-fakes.md) |

## Tier 3 — is the Mockito itself right?

| Check | If it fails |
|---|---|
| **Are raw values and matchers mixed in one call?** | `InvalidUseOfMatchersException`; use `eq(...)` for the raw ones — [04 · Argument matchers](04-argument-matchers.md) |
| **Is `any()` used where the argument is the point of the test?** | The assertion has been widened to nothing — [04b · The matcher catalogue](04b-the-matcher-catalogue.md) |
| **Is a captor used where `argThat` would read better, or the reverse?** | Failure messages get much worse in one direction — [06 · Argument captors](06-argument-captors.md), [04c · Custom matchers](04c-custom-matchers.md) |
| **Is a captor used inside a stubbing rather than a verification?** | Documented as wrong; it captures at the wrong time — [06](06-argument-captors.md) |
| **Does a captor assertion account for every invocation, not just the last?** | `getValue()` is the last one only — [06e · Captors and multiplicity](06e-captors-and-multiplicity.md) |
| **Is a captor field reused across tests?** | State leaks between them — [06f · The captor's lifetime](06f-the-captors-lifetime.md) |
| **Is `when(...)` used to stub a spy or a partial mock?** | The real method runs during setup; use `doReturn(...)` — [08d · Stubbing a spy](08d-stubbing-a-spy.md) |
| **Does an `@InjectMocks` field arrive `null`?** | Injection failed silently; prefer constructor injection — **09 · @InjectMocks** *(not written yet)* |
| **Is a void method stubbed with `when`?** | It cannot be; the `do*` family exists for this — [03g · Stubbing voids](03g-stubbing-voids.md) |
| **Is `RETURNS_DEEP_STUBS` in use?** | A Law of Demeter violation with framework support — [03f · Default answers](03f-default-answers.md) |
| **Is `mockStatic` present, and is its scope closed?** | A leaked scope corrupts later tests on the same thread — [11 · Static and final](11-static-and-final.md) |
| **Is `mockStatic` present at all — for a static you own?** | An undeclared dependency, rented per test — [11b · Static mocking as a signal](11b-static-mocking-as-a-design-signal.md) |
| **Is `mockConstruction` present?** | The class builds its own collaborators; a factory parameter fixes it — [11c · Mocking construction](11c-mocking-construction.md) |
| **Is a mock verified across threads, or a static mock expected to apply inside an executor?** | Scopes are thread-local; the failure looks like a race — [05c · Async verification](05c-async-verification.md), [11](11-static-and-final.md) |
| **Is `reset(...)` called mid-test?** | *"Using this method could be an indication of poor testing"* — [02 · Creating mocks](02-creating-mocks.md) |
| **Was the mock maker changed for the module or for one mock, and is the reason recorded?** | A temporary workaround with no expiry — [02c · Choosing a mock maker](02c-choosing-a-mock-maker.md) |
| **Is `mockito-inline` still on the classpath?** | Redundant since 5.0.0 — [02b · The inline mock maker](02b-the-inline-mock-maker.md) |

## The three questions that replace the whole list

When there is no time for a table:

1. **Is the mock a boundary I own?** Not the SUT, not a library, not a value —
   [10](10-never-mock-the-class-under-test.md), [10b](10b-do-not-mock-types-you-do-not-own.md),
   [10g](10g-mocking-value-objects.md).
2. **Is each mock either stubbed or verified, but not both?** Stubbing supplies input;
   verification asserts output. Doing both to one interaction asserts the same fact twice —
   [01b · Mock, stub, spy, fake](01b-mock-stub-spy-fake.md), [05d](05d-verifying-too-much.md).
3. **Would the test fail if the behaviour it names were removed?** If not, nothing else on this
   page matters — [10](10-never-mock-the-class-under-test.md).

## Where this connects

**Inside phase 11.** Mockito is one library in a stack, and several of the checks above hand off
to a topic that owns the answer:

- **[02 · AssertJ](../02-assertj/README.md)** — the assertion half of every example here. A test
  whose mocking is perfect and whose assertion says `expected: <true> but was: <false>` has still
  cost the next reader an hour.
- **[03 · Parameterized tests](../03-parameterized-tests/README.md)** — when a mock-based test
  is copied five times for five inputs, the table is the fix, not a fifth copy.
- **[01 · JUnit 5](../01-junit-5/01-what-a-test-is-for.md)** — the engine underneath: lifecycle,
  `assertThrows`, and the extension model that `MockitoExtension` plugs into. The parallelism
  chunks matter directly to this topic's thread-local scopes —
  [12e · Shared state under parallelism](../01-junit-5/12e-shared-state-under-parallelism.md).
- **05 · The test pyramid** *(not written yet)* — owns `@MockitoBean` and `@MockitoSpyBean`, the
  Spring-context versions of everything here. Plain Mockito is this topic; a mock installed into
  an application context is that one.
- **06 · MockMvc** *(not written yet)* — the web-layer slice, where the collaborators below the
  controller are usually `@MockitoBean` and the checks in Tier 1 apply unchanged.
- **07 · Testcontainers** *(not written yet)* — the other end of
  [12b](12b-what-a-fake-costs.md): the real dependency that the fake's contract test runs
  against, and the answer to everything a fake cannot express.
- **08 · Test data patterns** *(not written yet)* — builders and object mothers, the concrete
  answer to "the value object is too painful to construct" from
  [10g](10g-mocking-value-objects.md).
- **09 · JaCoCo** *(not written yet)* — the report that shows a stubbed SUT method as
  unexecuted, which is the honest signal [10](10-never-mock-the-class-under-test.md) tells you
  to read rather than paper over.
- **10 · Property-based testing** *(not written yet)* — for the logic you extracted into a
  collaborator in [10c](10c-the-refactor-that-removes-the-need.md), which is now testable with
  no doubles at all and is exactly what properties are good at.
- **11 · Mutation testing** *(not written yet)* — the automated form of Tier 1's last check.
  A surviving mutant inside a stubbed-out method is the machine saying what this topic says.

## Gotchas

**★ Working the checklist bottom-up.**
Tier 3 items are the easy ones to spot and the least important. A review that lands six comments
about `any()` versus `eq()` and misses a `@Spy` on the SUT has optimised for the wrong thing.

**★ Treating the checklist as a lint rule set.**
Almost every line has a legitimate exception, documented in the chunk it links to. The value is
in asking the question, not in the answer always being "no".

**★ Applying it to a test you are about to delete.**
A test that fails Tier 1 is not usually improved by fixing the mocking. It is improved by the
refactor in [10c](10c-the-refactor-that-removes-the-need.md), after which most of it is deleted
and the assertions move to a new file.

**★ Running the list against the diff instead of the file.**
A pull request that adds one stubbing to a test class with a `@Spy` SUT reads clean in the diff
and is not. Open the whole test class the first time you review it.

**★ Using it as a gate rather than a conversation.**
The output of a Tier 1 failure is usually "this class has two responsibilities", which is a
design discussion, not a change request. Blocking the merge without offering the extraction
tends to produce a comment explaining why the spy is necessary, which is where this all started.

## Interview questions

**★ You are reviewing a test that uses mocks. What do you look at first?**
Whether the class under test is itself mocked or spied, because that is the only failure mode
that changes what a green run *means* — everything else changes what the test costs to maintain.
The quickest confirmation is the delete test: if emptying the stubbed method leaves the suite
green, the test never exercised it.

**★ Give three questions that would catch most mocking defects.**
Is the mock a boundary I own — not the class under test, not a library, not a value object? Is
each mock either stubbed or verified rather than both? And would the test fail if the behaviour
it is named after were removed? The first catches the structural defects, the second catches
over-specification, and the third catches everything that is only pretending to test.

**★ Why order a review checklist by consequence rather than by topic?**
Because reviews run out of attention before they run out of list. A checklist grouped by API
area gets you thorough coverage of argument matchers and no coverage of whether the test proves
anything. Grouping by "does a green run mean anything / will this survive a refactor / is the
API used correctly" spends the first and best attention where the damage is.

**★ What is the single most under-reviewed line in a Mockito test?**
`@Spy @InjectMocks Sut sut;`. It is documented, it compiles, and it reads like configuration
rather than like a decision — and it silently makes every assertion in the class an assertion
about a hybrid of the production class and the test's own stubbings.

{/* FOOTER */}
