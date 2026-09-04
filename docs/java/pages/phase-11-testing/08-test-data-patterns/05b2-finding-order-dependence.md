---
title: "Order dependence is not a bug you wait for — it is one you can go and cause on purpose in four cheap experiments, and the most valuable of them is simply running the whole suite twice against the same database without resetting it in between"
sidebar_label: "05b2 · Finding order dependence"
sidebar_position: 22
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the **JUnit Jupiter 6.0.3** javadoc for
> [`MethodOrderer`](https://docs.junit.org/6.0.3/api/org.junit.jupiter.api/org/junit/jupiter/api/MethodOrderer.html),
> [`MethodOrderer.Random`](https://docs.junit.org/6.0.3/api/org.junit.jupiter.api/org/junit/jupiter/api/MethodOrderer.Random.html),
> [`TestMethodOrder`](https://docs.junit.org/6.0.3/api/org.junit.jupiter.api/org/junit/jupiter/api/TestMethodOrder.html)
> and
> [`ClassOrderer`](https://docs.junit.org/6.0.3/api/org.junit.jupiter.api/org/junit/jupiter/api/ClassOrderer.html).
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1,
> Spring Framework 7.0.9, JUnit Jupiter 6.0.3.
> ⚠️ **No database and no sandbox on this machine** — configuration, Java source and
> documented behaviour only. No run output, no seed value from an actual execution and no
> pass/fail counts appear on this page.

**[05b](05b-tests-that-depend-on-each-other.md) described the bug. The useful property of
order dependence is that it is *cheap to provoke*: unlike a race condition, you do not have
to get lucky, you just have to change the order. Four experiments find almost all of it,
they cost an afternoon to set up, and one of them — running the suite twice against the same
database — needs no code changes at all.**

## Experiment 1 · Run the suite twice without resetting

The highest-value check in the topic, and it requires nothing but a second invocation:

```bash
./mvnw test                      # first pass
./mvnw test                      # second pass, same database, nothing reset
```

The condition is that the database persists between the two runs — a long-lived container,
a reused Testcontainers instance, or a local PostgreSQL. Any test that fails on the second
pass and not the first is leaving state behind or depends on starting clean. That single
distinction separates "the suite is a set" from "the suite is a program".

It also catches the whole family of `count()` and `getId() == 1` assertions in one go,
because the second pass is the first time those assertions have ever been asked to hold on
a non-empty database.

⚠️ Note the interaction with Testcontainers reuse: with reuse enabled the container — and
its `flyway_schema_history` — survive the run, which is what makes this experiment possible
and is also, separately, a source of confusion when a new migration never runs. That side of
it is [07 → 05b3](../07-testcontainers/05b3-what-reuse-leaks.md).

## Experiment 2 · Randomise method order

```java
@TestMethodOrder(MethodOrderer.Random.class)
class AccountRepositoryTest { }
```

or, better, for the whole suite without touching a single class:

```properties
# src/test/resources/junit-platform.properties
junit.jupiter.testmethod.order.default = \
    org.junit.jupiter.api.MethodOrderer$Random
```

The seed matters, because a random failure you cannot repeat is not useful. Per the
`MethodOrderer.Random` javadoc, the seed defaults to a value derived from `System.nanoTime()`
at class initialization and is **logged at `CONFIG` level** precisely so that a run can be
reproduced; you can also set it explicitly:

```properties
junit.jupiter.execution.order.random.seed = 42
```

The property accepts any string convertible with `Long.valueOf(String)`, and — per the
javadoc — falls back to the generated seed if the value cannot be converted. It is shared
with `ClassOrderer.Random`, so one seed governs both.

The workflow is: run with random order in a nightly job, capture the logged seed when
something fails, then set that seed to reproduce it deterministically while you fix it.
Without capturing the seed, a random-order job produces failures nobody can act on, which
is how these jobs get switched off.

## Experiment 3 · Randomise or reverse class order

```properties
junit.jupiter.testclass.order.default = \
    org.junit.jupiter.api.ClassOrderer$Random
```

This is the one that finds cross-class dependencies, and cross-class is where the expensive
ones live — a fixture created by `AccountRepositoryTest` that `LedgerQueryTest` has been
quietly relying on for a year.

Remember the baseline: per the `ClassOrderer` javadoc, if that property is unset and no
`@TestClassOrder` is present, *"test classes are not ordered"*. So there is no order to
"reverse" in any meaningful sense — the useful comparison is between one arbitrary order and
another, which is exactly what randomising gives you.

`ClassOrderer.ClassName` is the deterministic alternative, and it is worth a thought: it
makes the order stable and knowable, which is good for triage and bad for discovery, because
a stable order lets a dependency survive indefinitely.

## Experiment 4 · Run each test entirely alone

The complement of the other three. A test that only passes as part of a group depends on the
group; a test that only passes *alone* depends on starting clean.

```bash
# one class at a time
./mvnw test -Dtest=AccountRepositoryTest
```

Most build tools cannot cheaply run every *method* in its own JVM, so in practice this is a
per-class check, run over the classes that the first three experiments implicated. It is the
confirmation step rather than the discovery step: once random order has produced a failure,
running the two suspect classes alone and then in each order tells you which one leaves the
state and which one depends on it.

## Reading the result: which test is the broken one?

When A-then-B fails and B-then-A passes, there are two different bugs and they need
different fixes.

- **A leaves state behind.** A committed rows it should not have, or its cleanup was rolled
  back with it, or it used `REQUIRES_NEW`. Fix A's cleanup, per
  [05a3](05a3-truncating-and-deleting.md).
- **B assumes a clean database.** B counts rows globally, asserts on a generated id, or
  reads "the only" row. Fix B's assertions, per
  [05b](05b-tests-that-depend-on-each-other.md).

Both can be true at once, and when they are, fix B first. B's assertion is wrong regardless
of A's behaviour, and fixing it means the pair can never regress in that way again — whereas
fixing only A leaves a test that will break the next time anything else writes to the table.

## Making it stick

Finding the dependencies once is not the objective; not reacquiring them is. Three things
that hold the line:

1. **Random order in CI on the main branch, with the seed logged**, so a new dependency is
   caught by the build that introduced it rather than six months later.
2. **A build that runs the suite twice against the same database** — nightly is enough. It
   catches the leak class of bug, which random order alone does not, because a test can leak
   without any test in the same run depending on it.
3. **A review habit:** any assertion containing `count()`, `hasSize`, `findAll()`,
   `singleElement` or a literal id is a question in review, not automatically wrong but
   always worth one sentence of justification.

The thing not to do is enforce an order to make the failures go away, for the reasons in
[05b](05b-tests-that-depend-on-each-other.md) and
[01 · JUnit 5 → 11d](../01-junit-5/11d-when-order-is-a-smell.md).

## Where this connects

- The anatomy of the bug and the assertions that cause it:
  [05b · Tests that depend on each other](05b-tests-that-depend-on-each-other.md).
- Fixing the leak side: [05a3 · Truncating and deleting](05a3-truncating-and-deleting.md).
- Fixing the "assumes clean" side:
  [04d2 · The columns SQL has to fill](04d2-the-columns-sql-has-to-fill.md).
- JUnit's ordering machinery, seeds and configuration in full:
  [01 · JUnit 5 → 11b Random order](../01-junit-5/11b-random-order.md) and
  [11c · Class order](../01-junit-5/11c-class-order.md).
- Diagnosing a failure that only appears under parallel execution:
  [01 · JUnit 5 → 12f](../01-junit-5/12f-diagnosing-a-parallel-failure.md).
- What a reused container leaks between runs:
  [07 · Testcontainers → 05b3](../07-testcontainers/05b3-what-reuse-leaks.md).

## Gotchas

**★ A random-order job without a captured seed produces failures nobody can reproduce.**
`MethodOrderer.Random` logs its seed at `CONFIG` level for exactly this reason. If your CI
log level hides `CONFIG`, you get an unreproducible failure, the team learns to ignore the
job, and it gets deleted. Turn the logging up before you turn randomisation on.

**★ The seed property is shared between `MethodOrderer.Random` and `ClassOrderer.Random`.**
`junit.jupiter.execution.order.random.seed` governs both, so pinning a seed to reproduce a
method-order failure also pins class order. That is usually what you want, and it means you
cannot vary one while holding the other fixed.

**★ An unparseable seed silently falls back to the generated one.**
The javadoc says the value must be convertible via `Long.valueOf(String)` and that the
framework defaults to the generated seed otherwise. So a typo in the property gives you a
random run that looks pinned.

**★ Running the suite twice only tests anything if the database survives between runs.**
With a container per run, the second pass starts as clean as the first and proves nothing.
The experiment requires a long-lived or reused database, which is a deliberate setup rather
than the default.

**★ Applying a `MethodOrderer` turns off parallel execution within the class.**
The `TestMethodOrder` javadoc states that using a `MethodOrderer` disables parallel
execution unless it is explicitly enabled with `@Execution(CONCURRENT)`. So a suite that
switches on random ordering to hunt for dependencies also stops running its methods
concurrently, and any dependency that only manifests under concurrency stops manifesting.

**★ "It passes alone" and "it passes in the suite" are two different bugs, and only one of
them is in the test you are looking at.**
Fix the test that assumes a clean database first, because its assertion is wrong regardless
of what any other test does.

**★ Randomising order does not find a dependency on a *fixed* fixture.**
If every test reads a class-level fixture and exactly one mutates it, random order finds it.
If the fixture is created once per class and all the tests read it, random order finds
nothing — and the dependency is still there, waiting for the day somebody adds a writing
test. The double-run experiment is what catches that class.

**★ Class order is undefined by default, so there is no "the order" to compare against.**
Without `junit.jupiter.testclass.order.default` or `@TestClassOrder`, classes are simply not
ordered. Do not reason about "the usual order" of classes; there is not one you can rely on.

**★ A test that fails only under random order is often blamed on the randomisation.**
It is a real bug that was previously masked by an order nobody chose. The instinct to revert
the ordering change is strong and wrong.

## Interview questions

**★ How would you deliberately find order-dependent tests in an existing suite?**
Four experiments, cheapest first. Run the whole suite twice against the same database
without resetting it — anything that fails on the second pass is leaking state or assuming a
clean start. Switch method order to `MethodOrderer.Random` via
`junit.jupiter.testmethod.order.default`, capturing the logged seed so failures are
reproducible. Switch class order to `ClassOrderer.Random`, which is what finds cross-class
dependencies. Then run the implicated classes alone and in both orders to work out which one
leaks and which one assumes. None of this requires luck, which is what makes order
dependence much cheaper to hunt than a genuine race.

**★ You enable random test order and a test starts failing. Is the randomisation at fault?**
No — the randomisation revealed a dependency that was previously masked by an order nobody
chose and nobody guaranteed. JUnit's default method order is documented as deterministic but
intentionally nonobvious, and it changes when the class file changes, so that test was one
commit away from failing anyway. The right response is to capture the seed from the log,
reproduce deterministically, and decide whether the failing test assumes a clean database or
some other test leaks into it.

**★ A-then-B fails, B-then-A passes. Which test do you fix?**
Diagnose both and fix B first. A is leaving state behind — committed rows, cleanup that was
rolled back with it, a `REQUIRES_NEW` path — and that is a real defect in A's cleanup. But B
is asserting something about the whole database rather than about its own rows, and that
assertion is wrong regardless of what A does. Fixing B makes the pair robust against every
future test that touches the table; fixing only A leaves B waiting for the next one.

**★ Why is running the suite twice more valuable than randomising the order?**
Because they find different things. Randomising finds tests that depend on *another test in
the same run*. Running twice finds tests that leak state without anything in that run
depending on it — the dependency has not been created yet, but the leak has, and it will bite
the first time someone adds a test that counts rows. It is also the only one of the
experiments that needs no code or configuration change, just a database that survives
between runs.

**★ How do you keep a suite order-independent once you have fixed it?**
Random method and class order in the CI build on the main branch, with the seed logged at a
level the CI actually captures, so a new dependency fails the build that introduced it. A
nightly job that runs the suite twice against a persistent database, to catch leaks that no
current test depends on. And a review habit: every `count()`, `hasSize`, `findAll()`,
`singleElement` or literal-id assertion gets one sentence of justification, because that
family of assertions is where nearly all of these bugs enter.

**★ What kind of order dependence does randomising the order *not* find?**
A dependency on a fixture that every test reads and none mutates is invisible to reordering,
because every order produces the same result — until someone adds the test that writes to it.
Likewise a leak that no test in the current suite happens to notice. And anything that
manifests only under concurrency will actively stop manifesting, because applying a
`MethodOrderer` disables parallel execution within the class unless `@Execution(CONCURRENT)`
is set. Reordering is one instrument, not the whole toolkit.

{/* FOOTER */}
