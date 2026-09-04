---
title: "A flaky test is a test that has stopped making a claim, and the reason it is worth a whole chapter is that its real damage is not the failing build — it is teaching the team that a red build might mean nothing, which disarms every other test in the suite"
sidebar_label: "14 · Flaky tests"
sidebar_position: 51
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-28 against the JUnit 6.0.3 User Guide — "Repeated Tests"
> ([writing-tests/repeated-tests](https://docs.junit.org/6.0.3/writing-tests/repeated-tests.html)),
> "Test Execution Order"
> ([writing-tests/test-execution-order](https://docs.junit.org/6.0.3/writing-tests/test-execution-order.html))
> and "Test Instance Lifecycle"
> ([writing-tests/test-instance-lifecycle](https://docs.junit.org/6.0.3/writing-tests/test-instance-lifecycle.html)).
> JDK 25, Spring Boot 4.1.1, JUnit Jupiter 6.0.3, Spring Framework 7.0.9.

**A test that sometimes passes and sometimes fails, with no change to the code, is not a test.
It has stopped being a claim about behaviour ([01](01-what-a-test-is-for.md)) and become a coin
flip you pay for on every build. This chunk is what a flake costs, how to tell which category
you have, and the first family of causes: state that outlives a test.**

The rest of the taxonomy: [14b · time and determinism](14b-time-and-determinism.md),
[14c · timing and concurrency](14c-timing-and-concurrency.md),
[14d · environment](14d-environment.md). The argument about retry is
[14e · retry is not a fix](14e-retry-is-not-a-fix.md).

## The cost is not the failing build

A flake costs three things, and only the first is obvious.

**The reruns.** Real, measurable, and the smallest of the three.

**The information.** A flaky test's *passes* are worthless too. If the test fails randomly, a
pass tells you nothing about whether the behaviour is correct — you cannot distinguish "correct"
from "the race went your way". Flakiness destroys the signal in both directions.

**🔴 The habit.** This is the one that matters. Once a team learns that a red build might mean
nothing, the first response to any red build becomes "rerun it". That response is now applied to
*genuine* failures too, and the suite has stopped protecting anything. One tolerated flake
degrades every test in the repository, including the ones that are perfectly deterministic.

That is why "it's just flaky" is never a status. It is either fixed, deleted, or explicitly
quarantined with an owner ([14e](14e-retry-is-not-a-fix.md)).

## Reproducing one: `@RepeatedTest(failureThreshold = 1)`

Jupiter has a documented tool for exactly this, and it is not widely known:

> *"`@RepeatedTest` can be configured with a failure threshold which signifies the number of
> failures after which remaining repetitions will be automatically skipped. Set the
> `failureThreshold` attribute to a positive number less than the total number of repetitions in
> order to skip the invocations of remaining repetitions after the specified number of failures
> has been encountered."*

> *"For example, if you are using `@RepeatedTest` to repeatedly invoke a test that you suspect to
> be flaky, a single failure is sufficient to demonstrate that the test is flaky, and there is no
> need to invoke the remaining repetitions. To support that specific use case, set
> `failureThreshold = 1`."*

```java
@RepeatedTest(value = 200, failureThreshold = 1)
void suspectedFlake() {
    // ...
}
```

Two hundred attempts, stopping at the first failure. That converts "it fails about once a week in
CI" into a local reproduction in whatever time two hundred runs take.

⚠️ One caveat, documented:

> *"If the repetitions of a `@RepeatedTest` method are executed in parallel, no guarantees can be
> made regarding the failure threshold. It is therefore recommended that a `@RepeatedTest` method
> be annotated with `@Execution(SAME_THREAD)` when parallel execution is configured."*

And the obvious limit: repetition inside one JVM run cannot reproduce a flake whose cause is
*another test*. For those, randomised ordering ([11b](11b-random-order.md)) and full-suite runs
are the tools.

## Triage: which category is it?

Before hunting, classify. The symptom usually names the family.

| Symptom | Look at |
|---|---|
| Fails only when the full suite runs; passes alone | order dependence, leaked state — this chunk |
| Fails only in the *second* run in the same JVM | leaked state, JVM reuse — this chunk |
| Fails around midnight, month end, or after a clock change | time ([14b](14b-time-and-determinism.md)) |
| Fails on one developer's machine only | locale, charset, time zone ([14b](14b-time-and-determinism.md)) |
| Assertion on a collection's *order* fails intermittently | iteration order, unseeded randomness ([14b](14b-time-and-determinism.md)) |
| Fails more often on a loaded agent | sleeps, timing, concurrency ([14c](14c-timing-and-concurrency.md)) |
| Fails only with parallelism enabled | concurrency ([14c](14c-timing-and-concurrency.md)) |
| `BindException`, connection refused, DNS | environment ([14d](14d-environment.md)) |
| Fails on CI, never locally | any of them — [12f](12f-diagnosing-a-parallel-failure.md) |

## Family 1 — state that outlives a test

### Order dependence

**Recognise it:** the test passes alone and fails in the suite, or vice versa; it fails after a
seemingly unrelated test is added, deleted or renamed.

**Confirm it:** run the class with `@TestMethodOrder(MethodOrderer.Random.class)`, or the suite
with `junit.jupiter.testclass.order.default = org.junit.jupiter.api.ClassOrderer$Random`, with
the seed logged ([11b](11b-random-order.md)).

**Fix it:** each test arranges everything it asserts on. Not `@Order`, which pins the order and
preserves the defect ([11d](11d-when-order-is-a-smell.md)).

### Shared `static` mutable state

**Recognise it:** a `static` field in a test class or a helper that is not a constant — a cache,
a counter, a collected list, a lazily-initialised singleton.

**Why it flakes:** the default `PER_METHOD` lifecycle gives each test a fresh instance
([03](03-the-lifecycle.md)), so instance fields are already isolated; `static` fields deliberately
escape that. Under parallelism they are also a data race
([12e](12e-shared-state-under-parallelism.md)).

**Fix it:** make it an instance field. If it is genuinely a constant, make it immutable —
`List.of(...)`, not `new ArrayList<>()`, because `static final` prevents reassignment and not
mutation.

### Leaked state between tests

Broader than `static` fields: anything one test changes and does not restore.

- a system property set and not unset;
- `Locale.setDefault` / `TimeZone.setDefault`;
- a row inserted without a rollback;
- a file written to a shared location ([14d](14d-environment.md));
- a mock or spy installed on a shared singleton;
- a Spring bean mutated inside a cached context;
- a `ThreadLocal` set and not cleared — which, in a pooled thread, is inherited by whatever runs
  next on that thread.

**Recognise it:** a test that fails only when it runs *after* a specific other test. The pair is
the unit of diagnosis, not the failing test.

**Fix it, in order:** stop mutating the global (inject the value instead); if you must, restore
it in `@AfterEach`, which runs even when the test fails; and where the global is JVM-wide, add a
`@ResourceLock` so a concurrent test cannot observe the window
([12c](12c-resource-locks.md)).

⚠️ `@AfterEach` restoration is necessary but not sufficient under parallelism — another test can
read the mutated value before you restore it. That is what the lock is for.

### Container and database state

**Recognise it:** passes on an empty database, fails on the second run, or fails when someone
else's test ran first. Assertions like `assertEquals(1, repository.count())` are the tell — they
assert about the *whole table*, so any other row anywhere breaks them.

**Fix it:** unique data per test (a key derived from the test name or a random suffix), a
transaction rolled back per test, or a schema per class. `count()` assertions should be scoped to
data the test created.

**Do not fix it with `TRUNCATE` in `@BeforeEach`.** It works serially and cannot survive
parallelism — you are deleting rows another test is mid-way through using — and it is slow.

### JVM reuse and forking

Build tools reuse JVMs across test classes. Maven Surefire's `forkCount` and `reuseForks`, and
Gradle's `forkEvery`, decide how many classes share a JVM.

**Recognise it:** the flake appears or disappears when the fork configuration changes, or a test
passes when run alone in its own fork and fails in a shared one.

**Why it matters:** every JVM-global thing on this page — `static` fields, system properties, the
default `Locale`, loaded classes, a `ThreadLocal` in a pooled thread — persists across *classes*
within a fork. A suite that only passes with `forkEvery = 1` has state leaking between classes
and is paying JVM startup per class to hide it.

**Fix it:** treat `forkEvery = 1` as a diagnostic, not a solution. If it fixes the flake, you have
proved cross-class leakage; find it.

⚠️ Fork configuration is build-tool territory rather than JUnit's, so verify the exact parameter
names against your Surefire or Gradle version — the *behaviour* described here is the JVM's, and
that part is stable.

## Gotchas

**★ Calling a flake "flaky" and moving on.**
It is a defect with an intermittent symptom. Left in place it trains the team to rerun red
builds, which disarms every deterministic test in the repository.

**★ Believing a flaky test's passes.**
If a test fails randomly, its passes carry no information either — you cannot tell "correct" from
"the race went the right way". Flakiness destroys the signal in both directions.

**★ Diagnosing the failing test instead of the pair.**
Order dependence and leaked state are properties of *two* tests. The one that goes red is the
victim; the one that ran earlier is the cause.

**★ Using `@RepeatedTest` without `failureThreshold`.**
By default it is `Integer.MAX_VALUE`, so all repetitions run regardless of failures. For flake
hunting, `failureThreshold = 1` stops at the first failure, which is the whole point.

**★ Repeating a test in parallel to hunt a flake.**
Documented: with parallel execution, *"no guarantees can be made regarding the failure
threshold"*, and the guide recommends `@Execution(SAME_THREAD)` on a `@RepeatedTest`. You also
change the phenomenon you are measuring.

**★ Expecting `@RepeatedTest` to reproduce an order-dependence flake.**
It repeats one method in one JVM. A flake caused by another test needs randomised ordering and a
full-suite run.

**★ `static final` collections treated as constants.**
`static final List<Order> ORDERS = new ArrayList<>()` is mutable and shared. A test that sorts it
in place has changed it for every other test in the JVM, across classes, for the rest of the
fork.

**★ `TRUNCATE` in `@BeforeEach`.**
It hides cross-test data leakage serially, cannot survive parallelism, and is slow. Unique data or
a rolled-back transaction solves the same problem without those properties.

**★ `assertEquals(1, repository.count())`.**
An assertion about the entire table, in a suite where anything else may have written to it. Scope
the assertion to rows the test created.

**★ Fixing a leak with `@AfterEach` alone under parallel execution.**
Restoration closes the window after your test; it does not stop a concurrent test from observing
the mutated value inside the window. Add a `@ResourceLock` for JVM-global state.

**★ Setting `forkEvery = 1` and declaring victory.**
That is a diagnosis — it proves state leaks between classes — bought with a JVM start per class.
Use it to find the leak, not to live with it.

## Interview questions

**★ Why is a flaky test worse than a failing one?**
A failing test tells you something true. A flaky one tells you nothing in either direction: its
failures are ignored and its passes cannot be trusted, because you cannot distinguish a correct
result from a race that happened to go your way. Worse, tolerating one teaches the team that a red
build may be noise, so the "rerun it" reflex gets applied to genuine failures and the whole suite
stops protecting anything.

**★ How would you reproduce a flake that fails once a week in CI?**
If it is self-contained, `@RepeatedTest(value = 200, failureThreshold = 1)` — the guide names this
exact use case, and the threshold stops at the first failure rather than running all two hundred.
If it only fails in the full suite, that points at another test, so the tool is randomised
ordering with the seed logged plus a full-suite run at the CI parallelism.

**★ A test passes alone and fails in the suite. What is your first hypothesis and how do you
confirm it?**
State from another test — order dependence or leaked global state. Confirm with randomised
ordering; the failure is a property of a *pair*, so the goal is to identify which earlier test
leaves the residue. Then fix the leak, either by making the test arrange its own data or by
stopping the earlier test mutating a global.

**★ Why is `TRUNCATE` in `@BeforeEach` a bad answer to database flakiness?**
It only works when tests run one at a time — under parallel execution you are deleting rows a
concurrent test is using — and it is slow, since it runs before every test. It also masks the real
problem, which is that tests are asserting over shared data. Unique per-test data or a
rolled-back transaction removes the sharing instead of repeatedly cleaning up after it.

**★ Your suite only passes with `forkEvery = 1`. What have you learned?**
That state is leaking between test classes inside a JVM: a `static` field, a system property, a
default `Locale`, a `ThreadLocal` left set on a pooled thread. A fresh JVM per class hides it at
the cost of JVM startup for every class. Treat it as a successful diagnosis and go find the
global that is not being reset.

**★ Is a flaky test ever acceptable to leave in the suite?**
Only in an explicitly quarantined state, out of the gating build, with an owner and a date — so
that it stops damaging the signal while somebody fixes it. The unacceptable state is the one most
teams are in: a flaky test in the gating suite that everybody knows to rerun
([14e](14e-retry-is-not-a-fix.md)).

{/* FOOTER */}
