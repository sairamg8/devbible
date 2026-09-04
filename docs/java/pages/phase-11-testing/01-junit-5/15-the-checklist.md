---
title: "Reviewing a test is a different job from reviewing code, because a test that is wrong still passes — so the review question is never \"is this correct\" but \"what would have to break for this to go red, and would the message tell me what\""
sidebar_label: "15 · The checklist"
sidebar_position: 62
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-28 against the JUnit 6.0.3 User Guide
> ([docs.junit.org/6.0.3](https://docs.junit.org/6.0.3/)) — every claim in the table below is
> argued and sourced in the chunk it links to, and this page adds no new claims of its own.
> JDK 25, Spring Boot 4.1.1, JUnit Jupiter 6.0.3, Spring Framework 7.0.9.

**This is the closing chunk of the topic and it exists to be used, not read. A test under review
has one property that production code does not: when it is wrong it is usually still green. So
the reviewer's job is not to check that it works — it works — but to establish what claim it
makes, what would falsify that claim, and whether the failure would be legible to someone who has
never seen the code.** Every line links to the chunk that argues it.

## The three questions that catch most of it

Before any checklist, three questions. If you only have two minutes for a review, ask these.

1. **What would have to break for this to fail?** If the honest answer is "nothing", the test is
   an expensive `System.out.println` ([01](01-what-a-test-is-for.md),
   [05b](05b-what-not-to-assert.md)).
2. **If it failed at 2am, would the report say what broke?** The failure message is the deliverable
   ([04](04-assertions.md), [06](06-naming-and-display-names.md)).
3. **Would it still pass if it ran second, in parallel, on a different machine?** That is the
   whole of [11](11-execution-order.md) – [14k](14k-fix-quarantine-or-delete.md) compressed into
   one question.

## Does it assert anything that could fail?

- ☐ There is at least one assertion, and it is on the *outcome* rather than on the setup
  ([01](01-what-a-test-is-for.md)).
- ☐ It cannot pass with the production code deleted. If it can, it is testing the framework
  ([01](01-what-a-test-is-for.md)).
- ☐ No assertion on a value the test itself just computed with the same code path
  ([05b](05b-what-not-to-assert.md)).
- ☐ No assertion that is tautologically true — `assertNotNull` on something the compiler
  guarantees, `assertTrue(true)` after a try/catch ([05b](05b-what-not-to-assert.md),
  [02 · AssertJ](../02-assertj/README.md)).
- ☐ Nothing important happens *after* the last assertion, where a failure would skip it.
- ☐ Multiple independent assertions on one object are grouped so you see all the failures, not
  the first ([04b](04b-assertall.md)).

## Would the failure message be readable by someone who did not write it?

- ☐ Expected and actual are the right way round in `assertEquals` — the argument order is
  `(expected, actual)` and reversing it inverts every diff ([04](04-assertions.md)).
- ☐ Any assertion whose subject is not obvious from the values carries a message, and the message
  is supplied as a `Supplier` if building it is expensive ([04](04-assertions.md)).
- ☐ A boolean assertion has a message; `assertTrue(x.isValid())` reports "expected true, was
  false" and nothing else ([04](04-assertions.md), [02 · AssertJ](../02-assertj/README.md)).
- ☐ The test's display name says what the behaviour is, not what the method is called
  ([06](06-naming-and-display-names.md)).
- ☐ `@Nested` classes group by context so the report reads as a sentence
  ([06b](06b-nested-tests.md)).

## Exceptions

- ☐ Exception cases use `assertThrows` and the thrown exception is *inspected*, not merely
  caught ([05](05-assertthrows.md)).
- ☐ No `try { … fail(); } catch` hand-rolled equivalent ([05](05-assertthrows.md)).
- ☐ The assertion is on the exception *type* and, where it matters, on a stable field — not on the
  message string, which a typo fix will break ([05b](05b-what-not-to-assert.md)).
- ☐ `assertThrows` wraps only the line that should throw, not the whole arrange-act-assert block,
  so a setup failure cannot masquerade as the expected exception ([05](05-assertthrows.md)).

## Lifecycle and shared state

- ☐ No `static` mutable field in the test class ([14](14-flaky-tests.md),
  [12e](12e-shared-state-under-parallelism.md)).
- ☐ Fixture setup that only one test needs lives in that test, not in `@BeforeEach`
  ([03](03-the-lifecycle.md)).
- ☐ Anything mutated in `@BeforeEach`/`@BeforeAll` is restored in the matching `@After…`, which
  runs even when the test fails ([03](03-the-lifecycle.md), [14](14-flaky-tests.md)).
- ☐ `@TestInstance(PER_CLASS)` is a deliberate decision with its shared-instance consequences
  understood, not a way to make `@BeforeAll` non-`static` ([03b](03b-per-class-lifecycle.md)).
- ☐ Lifecycle methods inherited from a base class are accounted for — they run, in a defined
  order, and a subclass cannot see them ([03c](03c-inheritance-and-wrapping.md)).
- ☐ Resources opened by the test are closed, by `@AutoClose` or an explicit `@AfterEach`
  ([09d](09d-autoclose.md), [14g](14g-leaked-threads-and-executors.md)).

## Skipping, disabling and conditions

- ☐ `@Disabled` carries a reason and a tracking reference — a bare `@Disabled` is a permanent,
  invisible hole ([07](07-disabling-and-conditions.md)).
- ☐ A condition (`@EnabledOnOs`, `@EnabledIfEnvironmentVariable`, …) is genuinely about
  *capability*, not about the test being inconvenient ([07b](07b-the-built-in-conditions.md),
  [07c](07c-environment-conditions.md)).
- ☐ An assumption is used to skip a test that *cannot* run, never to swallow a failure — an
  aborted test is not a passing one, and the report distinguishes them
  ([08](08-assumptions.md)).
- ☐ Nobody is reading a skipped integration test as coverage. If the variable is missing on CI,
  the test never runs where it mattered ([08](08-assumptions.md),
  [14i](14i-process-globals-and-drift.md)).
- ☐ Tags are from the agreed vocabulary and the gating build's tag expression is known
  ([06d](06d-tagging.md), [06e](06e-tag-expressions-and-filtering.md)).

## Files, paths and resources

- ☐ No absolute path anywhere ([14d](14d-environment.md)).
- ☐ No relative path to a fixture — fixtures load from the classpath, because the working
  directory differs between the IDE, Maven and Gradle ([14d](14d-environment.md)).
- ☐ Anything the test writes goes to `@TempDir`, one per declaration
  ([09](09-tempdir-and-resources.md)).
- ☐ The `@TempDir` cleanup mode is a decision — `ON_SUCCESS` keeps the evidence of the failure you
  wanted to debug ([09b](09b-tempdir-cleanup.md)).
- ☐ No assertion on directory-listing order ([14d](14d-environment.md)).
- ☐ Filename case matches exactly — a Linux agent is case-sensitive and a Mac usually is not
  ([14d](14d-environment.md)).

## Order and isolation

- ☐ The test passes when run alone *and* in the full suite. The pair is the unit of diagnosis
  ([14](14-flaky-tests.md)).
- ☐ No `@Order` unless there is a documented reason that is not "these tests share state"
  ([11](11-execution-order.md), [11d](11d-when-order-is-a-smell.md)).
- ☐ The suite has been run at least once with randomised ordering and the seed logged
  ([11b](11b-random-order.md)).
- ☐ Database assertions are scoped to rows the test created; no `assertEquals(1, repo.count())`
  ([14](14-flaky-tests.md), [14h](14h-ports-network-and-the-database.md)).
- ☐ No generated id, sequence value or database-generated timestamp is asserted on
  ([14h](14h-ports-network-and-the-database.md)).

## Parallel safety

- ☐ Nothing JVM-global is mutated: system properties, default `Locale`, default `TimeZone`,
  `System.out` ([14i](14i-process-globals-and-drift.md), [14b](14b-time-and-determinism.md)).
- ☐ If something global *must* be mutated, there is a `@ResourceLock` and the reviewer knows the
  lock is a containment rather than a fix ([12c](12c-resource-locks.md),
  [12e](12e-shared-state-under-parallelism.md)).
- ☐ `@Isolated` is a last resort and its cost — the whole suite stops — is understood
  ([12d](12d-dynamic-locks-and-isolation.md)).
- ☐ The test does not assume it is the only thing running: no fixed port, no fixed path, no
  shared file ([14d](14d-environment.md), [14h](14h-ports-network-and-the-database.md)).
- ☐ Any `@RepeatedTest` used for flake hunting carries `@Execution(SAME_THREAD)`
  ([14](14-flaky-tests.md)).

## Timing, waiting and timeouts

- ☐ No `Thread.sleep`, anywhere, for any reason ([14c](14c-timing-and-concurrency.md),
  [13d](13d-what-a-timeout-is-for.md)).
- ☐ Asynchronous work is awaited on a signal the code gives you — a latch, a `Future`, an
  `awaitTermination` — before a bounded poll is considered
  ([14c](14c-timing-and-concurrency.md)).
- ☐ A bounded poll states its `atMost` explicitly rather than inheriting a default, and uses
  `untilAsserted` when the check is an assertion ([13d](13d-what-a-timeout-is-for.md)).
- ☐ No assertion of an *absence* that is anchored only to a duration
  ([14f](14f-concurrency-you-cannot-wait-out.md)).
- ☐ `@Timeout` is a hang detector, not a performance assertion
  ([13d](13d-what-a-timeout-is-for.md)).
- ☐ `assertTimeoutPreemptively` is understood to run the code on another thread, with what that
  does to a Spring transaction ([13](13-timeouts.md), [13b](13b-thread-modes.md)).
- ☐ Any executor the test creates is shut down *and* its termination asserted
  ([14g](14g-leaked-threads-and-executors.md)).

## Determinism

- ☐ Nothing calls `now()` without a `Clock` — production code takes an injected `Clock`
  ([14b](14b-time-and-determinism.md)).
- ☐ No unseeded `new Random()`; a fixed value, or a seed that is printed
  ([14b](14b-time-and-determinism.md)).
- ☐ No assertion on `HashMap` or `HashSet` iteration order
  ([14b](14b-time-and-determinism.md)).
- ☐ No `toUpperCase()`/`format` without an explicit `Locale` in code the test exercises
  ([14b](14b-time-and-determinism.md)).
- ☐ No assertion on a locale-formatted date or time string, which CLDR data changes between JDKs
  ([14j](14j-ci-and-version-drift.md)).

## The flakiness questions

- ☐ Has this test ever been rerun to make it pass? If so, it is on the list
  ([14](14-flaky-tests.md)).
- ☐ Is there a retry anywhere in the diff, at test or build level
  ([14e](14e-retry-is-not-a-fix.md))?
- ☐ Is `@RepeatedTest` being used as a retry? It is not one and it will *increase* red builds
  ([14e](14e-retry-is-not-a-fix.md)).
- ☐ If this test is known-flaky, does the diff fix it, make it deterministic, quarantine it with
  an owner and a date, or delete it — and nothing else ([14k](14k-fix-quarantine-or-delete.md))?
- ☐ Does a quarantine tag have a date on it ([14k](14k-fix-quarantine-or-delete.md))?

## Extensions

- ☐ A new extension is genuinely cross-cutting; a helper method or a base class would not have
  done ([10](10-extensions.md)).
- ☐ Any state the extension keeps lives in the `ExtensionContext` `Store`, not in a field
  ([10h](10h-keeping-state.md), [10i](10i-the-store-hierarchy.md)).
- ☐ Registration order is deliberate where several extensions interact
  ([10f](10f-registration-order.md)).

## Where this connects

- **Assertion style and failure messages** — [02 · AssertJ](../02-assertj/README.md). This topic
  teaches JUnit's own assertions because you must be able to read them; the rest of the phase
  uses AssertJ, and its closing checklist is
  [02 · AssertJ · 10](../02-assertj/10-the-checklist.md).
- **Tables of cases** — [03 · Parameterized tests](../03-parameterized-tests/README.md). Anywhere
  this checklist says "the same test with different data", that is `@ParameterizedTest` and its
  sources, not a loop.
- **04 · Mockito** — mocking, stubbing, verification and strictness; start at
  [what a mock is for](../04-mockito/01-what-a-mock-is-for.md). The "never mock the class under
  test" argument lives there, as does the reason a verification failure can surface in a test that
  did not stub anything ([14g](14g-leaked-threads-and-executors.md)).
- **05 · The test pyramid** *(not written yet)* — unit versus slice versus `@SpringBootTest`, the
  context cache, and `@MockitoBean`/`@TestBean`.
- **06 · MockMvc** *(not written yet)* — the web layer in a slice.
- **07 · Testcontainers** *(not written yet)* — real dependencies, which is the answer to most of
  [14h](14h-ports-network-and-the-database.md)'s shared-database argument.
- **08 · Test data patterns** *(not written yet)* — builders and object mothers, which is how the
  "arrange everything you assert on" rule stays readable.
- **09 · JaCoCo** *(not written yet)* — coverage as a floor, and why a suite full of tests that
  assert nothing still scores well.
- **10 · Property-based testing** *(not written yet)* — jqwik, and randomness done deliberately
  rather than by accident ([14b](14b-time-and-determinism.md)).
- **11 · Mutation testing** *(not written yet)* — PIT, which answers the first question on this
  page mechanically: it deletes the production code and tells you which tests still passed.

## Gotchas

**★ Reviewing a test by reading it rather than by asking what would falsify it.**
A test that asserts nothing reads perfectly. The only reliable review question is "what would have
to break for this to go red", and the mechanical version of it is mutation testing.

**★ Approving a test because the build is green.**
Green is the test's normal state and carries no information about whether it is a good test. The
diff is the only place a reviewer can catch a test that will never fail.

**★ Treating this checklist as gates rather than prompts.**
Every line is a question with a legitimate "yes, and here is why" answer. A reviewer who requires
`@TempDir` in a test that never writes a file is enforcing a rule instead of reading the code.

**★ Running the checklist on the test and not on the diff around it.**
Most order-dependence and shared-state defects are introduced by a *change to a different test*.
A new `static` field in a helper class is the defect; the test that goes red next week is not.

**★ Letting "we'll fix the flakiness later" through review.**
Later is when the evidence has been discarded and the habit has formed
([14](14-flaky-tests.md), [14e](14e-retry-is-not-a-fix.md)). The review is the cheapest moment
this decision will ever be available.

## Interview questions

**★ What do you look for when reviewing someone else's test?**
Three things in order. First, what claim it makes and what would falsify it — a test that cannot
fail is the most common defect and it reads perfectly, so I mentally delete the production code
and ask whether the test would notice. Second, the failure message: if this goes red at 2am for
someone who has never seen this code, does the report name the behaviour and show the actual
value, or does it say "expected true, was false"? Third, isolation: would it still pass running
second, in parallel, on a Linux agent in UTC. Everything else — naming, structure, the shape of
the assertions — is secondary to those.

**★ A pull request adds a retry to a test. What do you say?**
That a retry is not one of the available answers, and I would want to know which of the four it
is standing in for. If the flake is understood, fix it; if the cause is genuinely
nondeterministic, weaken the assertion to the invariant that always holds; if neither is happening
today, quarantine it out of the gating build with an owner and a date; if nobody will own it,
delete it. The reason retry is excluded is not aesthetic — it reruns the method without resetting
the static state or the leaked threads that caused the flake, and it discards the failure, which
was the only evidence anybody had ([14e](14e-retry-is-not-a-fix.md)).

**★ How do you review a test that you cannot run?**
By reading it for the properties that do not require execution: does it assert on an outcome,
could it pass with the production code removed, does anything global get mutated, is there a fixed
path or port, is there a `Thread.sleep`, is there a `static` field, does it depend on another test
having run. All of those are visible in the diff. The two things a review genuinely cannot
establish are whether the test is *fast* and whether it is flaky under load — which is what a
full-suite run with randomised ordering at the CI parallelism is for
([11b](11b-random-order.md), [14j](14j-ci-and-version-drift.md)).

**★ Which single check catches the most defects?**
"Could this test pass if the production code were deleted?" It catches assertions on the arrange
step, assertions on values the test computed itself, tests that assert only that no exception was
thrown, and tests whose assertion is inside a branch that never executes. It is also the one check
that can be automated — mutation testing is exactly this question run mechanically against every
statement, which is why topic 11 of this phase is the honest answer to the coverage number topic
09 produces.

**★ Why is reviewing a test different from reviewing production code?**
Because the feedback loop is inverted. Broken production code eventually fails somewhere; a broken
test passes forever and is discovered only when a real defect ships past it. There is no runtime
signal that a test is worthless, so the review is not one line of defence among several — it is
usually the only one, until somebody runs mutation testing or a customer finds the bug.

{/* FOOTER */}
