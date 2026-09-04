---
title: "A test that needs an order is nearly always one of two things — a single test that has been chopped into several methods, or two tests sharing mutable state — and @Order fixes neither, it only stops you noticing which one you have"
sidebar_label: "11d · When order is a smell"
sidebar_position: 40
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-28 against the JUnit 6.0.3 User Guide — "Test Execution Order"
> ([writing-tests/test-execution-order](https://docs.junit.org/6.0.3/writing-tests/test-execution-order.html))
> and "Test Instance Lifecycle"
> ([writing-tests/test-instance-lifecycle](https://docs.junit.org/6.0.3/writing-tests/test-instance-lifecycle.html)).
> JDK 25, Spring Boot 4.1.1, JUnit Jupiter 6.0.3, Spring Framework 7.0.9.

**[11](11-execution-order.md) and [11c](11c-class-order.md) are the mechanism. This is the
judgement: when you reach for `@Order`, what have you actually found? The guide itself hedges
— it says true unit tests "typically should not" rely on order, and then tells you exactly
which cases it had in mind. Everything outside those cases is a defect wearing an
annotation.**

## What the guide actually sanctions

> *"Although true unit tests typically should not rely on the order in which they are
> executed, there are times when it is necessary to enforce a specific test method execution
> order — for example, when writing integration tests or functional tests where the sequence
> of the tests is important, especially in conjunction with
> `@TestInstance(Lifecycle.PER_CLASS)`."*

That sentence names three things together, and they belong together: **integration or
functional tests**, **where the sequence is the subject**, and **`PER_CLASS`**. The `PER_CLASS`
mention is the tell — the guide is describing a class that deliberately keeps state in instance
fields across methods ([03b](03b-per-class-lifecycle.md)), which is a scenario, not a suite of
independent unit tests.

Everything else it says about ordering is about *classes* and about build time
([11c](11c-class-order.md)).

## Diagnosis: the two things you have actually found

### 1 · One test that has been chopped into several methods

```java
@TestMethodOrder(OrderAnnotation.class)
class OrderCheckoutTests {

    static String orderId;

    @Test @Order(1)
    void createsTheOrder() {
        orderId = api.createOrder(CUSTOMER, ITEM);
        assertNotNull(orderId);
    }

    @Test @Order(2)
    void addsPayment() {
        api.pay(orderId, CARD);
    }

    @Test @Order(3)
    void shipsTheOrder() {
        assertEquals(SHIPPED, api.ship(orderId).status());
    }
}
```

Three methods, one behaviour. The tells are unmistakable: a `static` field carrying a value
between methods, methods that assert nothing, and a failure in the first method that turns the
other two into meaningless red rather than useful information.

**The fix is to write the one test it is:**

```java
class OrderCheckoutTests {

    @Test
    void anOrderCanBeCreatedPaidAndShipped() {
        String orderId = api.createOrder(CUSTOMER, ITEM);

        api.pay(orderId, CARD);

        assertEquals(SHIPPED, api.ship(orderId).status());
    }
}
```

One name, one reason to fail, no `static`, no ordering annotation, and the arrange-act-assert
shape [01 · what a test is for](01-what-a-test-is-for.md) argues for. It is also *faster*,
because there is one setup instead of three.

The objection is always "but then I lose the granularity — I want to know which step broke".
You do not lose it: the failure is an assertion or an exception on a specific line, with a
stack trace, in a test whose name says what was being attempted. Three red methods where two
are red only because the first one failed is *less* information, not more.

### 2 · Two tests sharing mutable state

```java
// 🔴 test B only passes if A ran first
class UserRepositoryTests {

    @Test
    void savesAUser() {
        repository.save(new User("ada"));
    }

    @Test
    void findsAUserByName() {
        assertTrue(repository.findByName("ada").isPresent());   // relies on the row A wrote
    }
}
```

Here `@Order` is not merely a workaround, it is actively harmful: it makes the second test pass
while leaving it asserting nothing about its own subject. The second test does not test
`findByName`; it tests that `save` ran earlier.

**The fix is to give the second test its own arrangement:**

```java
class UserRepositoryTests {

    @Test
    void savesAUser() {
        User saved = repository.save(new User("ada"));

        assertThat(repository.findById(saved.id())).contains(saved);
    }

    @Test
    void findsAUserByName() {
        repository.save(new User("ada"));

        assertThat(repository.findByName("ada")).isPresent();
    }
}
```

Now each test says what it needs, and either can be deleted without breaking the other. The
duplication of `repository.save(...)` is not duplication of *logic*; it is each test stating its
own preconditions, which is what makes a test readable alone at 2am.

Where the shared thing is a database, the arrangement belongs in `@BeforeEach`, in a rollback
per test, or in a fresh schema — the material of
**topic 07 · Testcontainers** *(not written yet)* and **topic 08 · test data patterns**
*(not written yet)*.

## The four questions that settle it

When you are about to add `@Order`, answer these in order:

1. **Does test B assert something about B's own subject, or does it assert that A ran?** If the
   latter, B is not a test.
2. **Could I delete test A and still have B pass?** If not, B depends on A's side effects.
3. **Could I run B alone from the IDE?** A test you cannot run alone has stopped being a unit
   of anything.
4. **Is the *sequence itself* the behaviour under test?** If yes — a state machine, a
   multi-step protocol, a migration — then order is the subject, and the honest expression is
   one test method containing the sequence, not several ordered ones.

Only question 4 has an answer that legitimises anything, and even then the legitimate outcome
is usually a single method.

## When `@Order` is genuinely defensible

Three cases, and they are narrow.

**A long, expensive scenario in a `PER_CLASS` class.** Exactly what the guide describes: a
functional test where the sequence *is* the specification, setup costs seconds, and splitting it
into independent tests would multiply that cost by the number of steps. Here the ordered methods
are one test, expressed as several methods for reporting granularity, and `PER_CLASS` makes the
shared instance state explicit rather than smuggling it through `static`. Write a class comment
saying so.

**A test class that documents a protocol.** A class whose whole purpose is to demonstrate a
sequence — an API walkthrough, a state machine's legal transitions — where the reader is meant
to read the methods top to bottom. The order is documentation, and `OrderAnnotation` makes the
report match the file.

**Ordering *classes* for build time.** `ClassOrderer` with fail-fast or longest-first is not a
correctness statement at all ([11c](11c-class-order.md)). This is the only one of the three
that scales.

In every case: **say why, in a comment, at the top of the class.** `@Order(1)` with no
explanation is indistinguishable from `@Order(1)` added to silence a failure, and six months
later nobody can tell which one they are looking at.

## The rule that makes the whole thing tractable

**A test must set up everything it asserts on, and leave nothing behind.**

That is the invariant. Order dependence is the observable symptom of breaking it in one
direction (not setting up), and leaked state is the symptom of breaking it in the other (not
cleaning up). Every mechanism in this topic exists to support it: fresh instances per method
([03](03-the-lifecycle.md)), `@TempDir` instead of fixed paths ([09](09-tempdir-and-resources.md)),
the `Store` instead of extension fields ([10h](10h-keeping-state.md)), and randomised ordering
as the alarm ([11b](11b-random-order.md)).

## Gotchas

**★ Adding `@Order` to make a red test green.**
That is the entire failure mode this page is about. The test was telling you something true —
that it depends on another test — and the annotation silences it without changing the fact.

**★ A `static` field carrying a value from one test method to the next.**
The clearest possible signal that you have one test written as several. It also breaks under
parallel execution ([12 · parallel execution](12-parallel-execution.md)) and under any test
runner that reuses the JVM across classes.

**★ A test method with no assertions.**
Usually step two of a chopped-up scenario. It cannot fail for a reason of its own, so it
contributes nothing to the report except a line.

**★ Using `PER_CLASS` to enable ordering rather than to express a scenario.**
`PER_CLASS` removes the isolation guarantee and disables parallel execution for that class
([03b](03b-per-class-lifecycle.md)). Choosing it to make ordered tests work is paying a real
price to preserve a defect.

**★ "It only fails in CI" after adding ordered tests.**
Ordering is respected within a class; whether classes are ordered depends on configuration, and
whether anything runs concurrently depends on more configuration
([12](12-parallel-execution.md)). An ordered class that also leaks state across classes fails
exactly there.

**★ Ordering as a substitute for a `@BeforeEach`.**
If several tests need the same arrangement, that arrangement is a `@BeforeEach` or a builder
(**topic 08 · test data patterns**, *not written yet*) — not an earlier test method
that happens to create it as a side effect.

**★ Keeping ordered tests and never re-examining them.**
The legitimate cases are narrow and they change. A scenario test that was expensive in 2019
because it hit a real database is often cheap now that a container starts in seconds; the
ordering that was justified then is inertia now.

**★ Judging a test suite green without ever running it in another order.**
A suite that has only ever run in one order has never been tested for independence at all. That
is what [11b](11b-random-order.md) is for, and a nightly randomised job is the cheapest possible
version of it.

## Interview questions

**★ When is `@Order` on test methods legitimate?**
When the sequence is the behaviour under test — an integration or functional test of a
multi-step protocol, typically with `@TestInstance(PER_CLASS)`, which is exactly the case the
JUnit guide names. Even then the ordered methods are one logical test split for reporting, and
the class should say so in a comment. Everywhere else, needing an order means the tests are not
independent, and the annotation hides that rather than fixing it.

**★ A colleague fixes a failing test by adding `@TestMethodOrder` and `@Order`. What do you say
in review?**
That the failure was information and the annotation deleted it. Then diagnose: either test B
asserts something about test A's side effects — in which case B needs its own arrangement — or
several methods are one scenario, in which case they should be one method. Ask whether B can be
run alone from the IDE; if not, it is not a test yet.

**★ What is the argument against splitting a scenario into three ordered test methods?**
It produces two methods that cannot fail for a reason of their own, a `static` field to carry
state, and a report where a failure in step one makes steps two and three red for no reason of
their own. One method with the whole sequence gives one name, one reason to fail, a stack trace
pointing at the failing line, and one setup instead of three.

**★ How do you know a suite has no order dependence?**
You do not, from a green build in the default order. You raise confidence by running it
repeatedly in randomised order with the seed logged, and by being able to run any single test
alone. The default order is deterministic precisely so that a dependence, once created, keeps
passing — which is convenient for the build and terrible for discovering the problem.

**★ Is there any ordering that is not a smell?**
Class ordering for build economics: fail-fast, and longest-first under parallel execution. Those
are the guide's own examples and they say nothing about correctness — the suite must pass in any
order, and the ordering is only choosing which order it happens to run in to finish sooner.

**★ What single rule prevents almost all of this?**
Every test sets up everything it asserts on and leaves nothing behind. Order dependence is that
rule broken on the setup side; leaked state is it broken on the teardown side. Fresh instances
per method, `@TempDir`, the extension `Store`, and rollback-per-test all exist to make obeying
it cheap.

{/* FOOTER */}
