---
title: "One shared row turns a suite into a program whose tests are statements, and the single most common expression of that bug is an assertion that a table contains exactly one thing — which is a claim about every test that has ever run, not about the code"
sidebar_label: "05b · Tests that depend on each other"
sidebar_position: 21
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the **JUnit Jupiter 6.0.3** javadoc for
> [`TestMethodOrder`](https://docs.junit.org/6.0.3/api/org.junit.jupiter.api/org/junit/jupiter/api/TestMethodOrder.html)
> and
> [`MethodOrderer`](https://docs.junit.org/6.0.3/api/org.junit.jupiter.api/org/junit/jupiter/api/MethodOrderer.html),
> and the **Spring Framework 7.0.x** testing reference, *Transaction Management*
> ([docs.spring.io](https://docs.spring.io/spring-framework/reference/testing/testcontext-framework/tx.html)).
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1,
> Spring Framework 7.0.9, JUnit Jupiter 6.0.3, Testcontainers 2.0.5.
> ⚠️ **No database and no sandbox on this machine** — Java source, SQL and documented
> behaviour only. No failure output, no CI log and no run comparison appears on this page.

**A test suite is supposed to be a set. Order dependence turns it into a sequence — a
program whose statements happen to be written in different files, run in an order nobody
chose, and which produces a different result when that order changes. The cause is almost
always a row that outlived the test that created it, and the most common shape by a wide
margin is an assertion about a count. This chunk is the anatomy of the bug and why it
reproduces where you are not looking;
[05b2](05b2-finding-order-dependence.md) is how to go and find it on purpose.**

## `count(*) == 1` is the shape of the bug

```java
@Test
void savesTheAccount() {
    repository.save(anAccount().withIban("GB00…").build());

    assertThat(repository.count()).isEqualTo(1);      // 🔴
}
```

Read what that assertion actually claims: **"this table contains exactly one row in the
whole database at this moment"** — which is a statement about every test that has ever run
against this database, in every class, in whatever order the runner picked. It is not a
statement about `save`.

It passes on a developer's machine because the database was empty, and it fails the moment
anything else has written to that table — a different class, an earlier method, a previous
run of the same suite. And the failure message says `expected 1 but was 3`, which reads
like the code under test inserted three rows.

The same claim wears several disguises:

```java
assertThat(repository.findAll()).hasSize(1);                    // same claim
assertThat(repository.findAll()).singleElement()…;              // same claim
assertThat(repository.findAll().get(0).getIban()).isEqualTo(…); // same claim, plus an
                                                                // assumption about order
assertThat(jdbc.queryForObject("SELECT count(*) FROM account", Long.class)).isEqualTo(1L);
```

The last variant is the worst of the family, because `findAll().get(0)` also assumes a row
order the database never promised — a query with no `ORDER BY` may return rows in any
order, and it will change the day the planner picks a different access path.

The fix is to **assert on the rows this test is about, not on the table**:

```java
@Test
void savesTheAccount() {
    String iban = "GB" + UUID.randomUUID();          // unique to this test

    repository.save(anAccount().withIban(iban).build());

    assertThat(repository.findByIban(iban)).isPresent();          // ✅
    assertThat(repository.countByIban(iban)).isEqualTo(1);        // ✅ filtered count
}
```

A filtered count still catches a double insert — which is what the count assertion was
usually trying to catch — while saying nothing about anyone else's rows. That is the whole
technique, and it converts most order-dependent tests into independent ones without any
change to the cleanup strategy.

## The other four shapes

**A generated id asserted directly.** `assertThat(saved.getId()).isEqualTo(1L)` is a claim
about how many rows have ever been inserted, because sequences are not reset by rollback
or by `DELETE`. It passes exactly once per database. See
[04d2](04d2-the-columns-sql-has-to-fill.md).

**A shared row that one test mutates.** A class-level `@Sql` fixture inserts `account 1`;
eight tests read it and the ninth sets its balance to zero. Now every test that runs after
the ninth sees a different premise, and each of them is correct in isolation. This is
exactly the static-fixture bug from [01b](01b-what-the-fix-is-not.md) with the shared
object moved into a table: the reference is `id = 1` instead of a `static final` field, and
`final` protects it just as little.

**A test that relies on running after another.** Usually written knowingly —
`test1_createsTheOrder`, `test2_shipsIt` — sometimes with `@Order` to enforce it. It is a
single test spread over several methods, with the disadvantages that only one of them
reports the real failure and none of them can be run alone.

**A first-in-the-class initialisation.** One method does the expensive setup and the others
assume it. The tell is a method whose name contains "setup" or "init" but which is a
`@Test`.

## Why it reproduces in CI and not on your machine

The three differences are all environmental and none of them are visible in the test code.

**Order.** JUnit Jupiter's default is deterministic but not alphabetical and not source
order. The `TestMethodOrder` javadoc states that when no orderer is applied, *"test methods
will be ordered using a default algorithm that is deterministic but intentionally
nonobvious"*. Deterministic for a given class file — and the class file changes when you
add a method, so the order can change on any commit. Class order is even weaker: per the
`ClassOrderer` javadoc, if `junit.jupiter.testclass.order.default` is unset then *"test
classes are not ordered unless test classes are annotated with `@TestClassOrder`"*, so the
order in which classes run is whatever the platform's discovery produces.

**Selection.** Locally you run one class, or one method, from the IDE. In CI the whole suite
runs. A test that depends on a row a *different class* created cannot fail locally, because
that class never ran.

**Parallelism.** With parallel execution enabled, two classes writing to the same table
interleave, and the count assertion sees the other class's row. This one does not merely
fail more often in CI — it fails *differently on each run*, which is why it gets labelled
flaky and retried instead of fixed.

**And the database.** A developer machine often has a container that has been up for a
week, so the sequence numbers are high and every table has leftovers; CI starts clean every
time. That inverts the usual assumption: a test asserting `id == 1` passes in CI and fails
locally, which makes it look like a local environment problem.

## Why the two obvious defences do not work

**"We will just enforce the order."** `@TestMethodOrder(MethodOrderer.OrderAnnotation.class)`
plus `@Order` makes the suite pass. It also makes the dependency permanent, prevents
running any single test alone, prevents parallelism — the `TestMethodOrder` javadoc notes
that using a `MethodOrderer` disables parallel execution within the class unless explicitly
re-enabled with `@Execution(CONCURRENT)` — and converts an accidental coupling into a
designed one. There is one honest use for ordering, and it is not this.

**"We will clean up between tests."** Necessary, and not sufficient. Cleanup fixes the rows
and does not fix the sequence values, the second-level cache, the context-held state, or
anything outside the database. A suite that truncates perfectly and asserts
`getId() == 1` is still order-dependent. Cleanup is one of the two tools; the other is
making each test's data unique, and the two together are what actually work.

## Where this connects

- Deliberately reproducing this — random order, reverse order, running the suite twice:
  [05b2 · Finding order dependence](05b2-finding-order-dependence.md).
- The cleanup strategies this interacts with: [05 · Cleanup](05-cleanup.md).
- The same bug expressed as a shared static field rather than a shared row:
  [01b · What the fix is not](01b-what-the-fix-is-not.md).
- Why asserting on a generated id is the same mistake:
  [04d2 · The columns SQL has to fill](04d2-the-columns-sql-has-to-fill.md).
- JUnit's ordering machinery in full, and when ordering is legitimate:
  [01 · JUnit 5 → 11 Execution order](../01-junit-5/11-execution-order.md) and
  [11d · When order is a smell](../01-junit-5/11d-when-order-is-a-smell.md).
- Shared state under parallel execution:
  [01 · JUnit 5 → 12e](../01-junit-5/12e-shared-state-under-parallelism.md).
- The unique-data-per-test strategy in a container context:
  [07 · Testcontainers → 06f](../07-testcontainers/06f-sql-scripts-and-unique-data.md).

## Gotchas

**★ `assertThat(repository.count()).isEqualTo(1)` is an assertion about the whole suite.**
It claims the table has exactly one row globally, which depends on every test that has run
before it. Replace it with a filtered count or a lookup by a value this test invented, and
the same test starts asserting the thing it meant to.

**★ `findAll().get(0)` assumes a row order the database never promised.**
A query without `ORDER BY` may return rows in any order, and the order can change when the
planner changes its access path — after an index is added, or after the table grows. The
test then fails for a reason that has nothing to do with the change that triggered it.

**★ A generated id asserted directly is a count in disguise.**
Sequences are not reset by rollback or by `DELETE`, so `getId() == 1` is a claim that
nothing has ever inserted into this table. It passes exactly once per fresh database, which
is why it can pass in CI and fail locally — the reverse of the usual pattern, and therefore
doubly confusing.

**★ A class-level fixture that one method mutates makes every later method order-dependent.**
The eight methods that read `account 1` are all correct alone. The ninth changes it. Nothing
in any of the nine says they share anything, because the sharing is expressed as a
primary-key value in a `.sql` file.

**★ Enforcing order with `@Order` hides the bug and takes parallelism with it.**
The `TestMethodOrder` javadoc notes that applying a `MethodOrderer` disables parallel
execution unless it is re-enabled explicitly with `@Execution(CONCURRENT)`. So the "fix"
costs you the ability to run the suite concurrently, forever, in exchange for not fixing
anything.

**★ Cleanup alone does not make tests independent.**
It resets rows. It does not reset sequences, the Hibernate second-level cache, static
fields, an `ApplicationContext`-held bean, or anything outside the database. A suite with
perfect truncation can still be order-dependent.

**★ The default method order is deterministic but changes when you add a method.**
The javadoc's phrase is *"deterministic but intentionally nonobvious"*. It is stable for a
given class file, and adding a test method produces a different class file — so an
order-dependent class can pass for months and break on a commit that only added a test.

**★ Class execution order is not defined at all unless you ask for it.**
Per the `ClassOrderer` javadoc, without `junit.jupiter.testclass.order.default` or
`@TestClassOrder`, test classes are simply not ordered. Any cross-class dependency is
therefore resting on discovery order, which is not a contract.

**★ Running one test from the IDE cannot reproduce a cross-class dependency.**
The other class never ran, so the row is not there — or, if the local database is stale, it
is there for a completely different reason. Local reproduction of this bug class requires
running the suite, not the test.

**★ A "flaky" test that fails at different points in different runs is usually this bug plus
parallelism, not a timing problem.**
Retrying it makes it pass and removes the only evidence. The tell is that the failure moves
between tests across runs rather than staying in one place.

## Interview questions

**★ A test asserts `repository.count() == 1` and it fails in CI. What is wrong with the test, not the code?**
The assertion is about the whole table, so it is really a claim about every test that has
ever run against that database, in whatever order the runner chose. Locally the developer
ran the class alone against an empty schema; in CI the full suite ran and something else had
already inserted a row. The fix is to assert on the rows this test is responsible for —
look up by a value the test invented, or use a filtered count such as `countByIban(iban)`.
The filtered count still catches a duplicate insert, which is what the original assertion
was usually protecting against, while saying nothing about anyone else's data.

**★ Why does order dependence reproduce in CI and not locally?**
Three environmental differences, none visible in the test source. Selection: locally you run
one class or one method, so a dependency on a different class cannot fire. Order: JUnit's
default method order is, in the javadoc's words, deterministic but intentionally nonobvious,
and it changes when the class file changes, while class order is undefined unless you
configure it — so CI can run things in an order you have never seen. Parallelism: if CI runs
concurrently, two classes interleave against the same table. And the database itself
differs — CI usually starts clean, a developer's container has been up for a week — which
can invert the symptom entirely for id-based assertions.

**★ Someone proposes `@TestMethodOrder(OrderAnnotation.class)` to make the suite pass. What do you say?**
That it converts an accidental dependency into a designed one and buys nothing. The tests
still cannot be run individually, the failure still does not point at the cause, and per the
`TestMethodOrder` javadoc, applying a `MethodOrderer` disables parallel execution within the
class unless you explicitly re-enable it — so it also costs the suite its concurrency,
permanently. Ordering is legitimate for a genuinely sequential scenario deliberately written
as one narrative, ideally in a `@Nested` class with `@TestInstance(PER_CLASS)` so the
sharing is visible. Using it to silence a shared-row bug is not that.

**★ Is cleaning up between tests enough to make a suite order-independent?**
No — necessary but not sufficient. Cleanup resets rows; it does not reset sequence values,
which are non-transactional and never returned, nor the Hibernate second-level cache, nor
static fields, nor anything held in a cached `ApplicationContext`, nor state outside the
database. A suite that truncates every table between methods and still asserts
`getId() == 1` remains order-dependent. The two tools that together do work are cleanup and
making each test's data unique, and unique data is the one that also survives parallelism.

**★ What is the relationship between this and a shared `static` fixture in a unit test?**
They are the same bug with different storage. A `public static final Customer` mutated by
one test changes the premise of the next; a row with `id = 1` mutated by one test does
exactly the same thing. `final` protects neither, because in both cases the reference is
fixed and the contents are not. The only difference is that the database version survives
the JVM, so it can couple tests across classes, across runs, and — with a reused container —
across days.

**★ Your team labels a test flaky and adds a retry. When is that the wrong call?**
When the failure moves between tests across runs rather than staying put, and when the test
passes alone and fails in the suite. That is order dependence or a data race, not
non-determinism in the code under test, and a retry does two harmful things: it makes the
suite green, and it destroys the evidence — the second attempt runs against a database the
first attempt has already changed. A retry is defensible for a genuinely external
non-determinism, such as a network call to a third party. It is never a fix for shared state.

{/* FOOTER */}
