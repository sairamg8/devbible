---
title: "Write the assertion that fails the build when someone reintroduces it — this is the single highest-value thing in the whole topic"
sidebar_label: "6b · Asserting the count"
sidebar_position: 13
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the `org.hibernate.stat.Statistics` interface in the
> Hibernate 7.4 source
> ([github.com/hibernate/hibernate-orm](https://github.com/hibernate/hibernate-orm/blob/7.4/hibernate-core/src/main/java/org/hibernate/stat/Statistics.java)),
> the Hibernate ORM 7.4 user guide §31.2 *Logging* on asserting statement counts
> ([docs.hibernate.org/orm/7.4/userguide/html_single/](https://docs.hibernate.org/orm/7.4/userguide/html_single/Hibernate_User_Guide.html)),
> the Spring Boot 4.1 reference *Testing → Auto-configured Data JPA Tests*
> ([docs.spring.io/spring-boot/reference/testing/](https://docs.spring.io/spring-boot/reference/testing/spring-boot-applications.html))
> and the JUnit 5 user guide on extensions
> ([junit.org/junit5/docs/current/user-guide/](https://junit.org/junit5/docs/current/user-guide/)).
> JDK 25, Spring Boot 4.1.0, Hibernate ORM 7.4.1, JUnit 5.

**Every other section of this topic tells you how to find an N+1 that already
exists. This one stops the next one. The argument is
[chunk 2](02-why-nobody-sees-it.md)'s: forgetting a fetch plan produces no signal
at all, and anything a codebase can forget silently it will forget — so the fix
is to manufacture the signal, as a test that fails the build.**

## The assertion, in full

```java
@DataJpaTest
@AutoConfigureTestDatabase(replace = NONE)          // run against a real PostgreSQL
@TestPropertySource(properties =
        "spring.jpa.properties.hibernate.generate_statistics=true")
class OrderSummaryQueryCountTest {

    @Autowired EntityManagerFactory emf;
    @Autowired TestEntityManager em;
    @Autowired OrderRepository orders;

    private Statistics stats;

    @BeforeEach
    void setUp() {
        stats = emf.unwrap(SessionFactory.class).getStatistics();
    }

    @Test
    void summarising_orders_takes_a_constant_number_of_statements() {
        givenOrders(20, 5);                          // 20 orders, 5 lines each
        em.flush();
        em.clear();                                  // ← critical: empty the context
        stats.clear();                               // ← critical: reset the counters

        List<OrderSummary> summaries = new OrderSummaryService(orders).summarise();

        assertThat(summaries).hasSize(20);           // still assert the behaviour
        assertThat(stats.getPrepareStatementCount())
                .as("statements issued by summarise()")
                .isEqualTo(1);
        assertThat(stats.getCollectionFetchCount())
                .as("collections needing their own select — the N in N+1")
                .isZero();
    }
}
```

Four things in that test are load-bearing, and leaving out any one of them gives
you a test that passes while the bug is present.

**`em.clear()`** empties the persistence context. Without it, the orders and
lines you just created are already managed, every association is already
initialised, and no SQL runs at all — the test passes with a statement count of
zero and proves nothing. This is the single most common reason one of these tests
is worthless.

**`stats.clear()`** resets counters that are cumulative from application startup.
Without it you are asserting on the total for the whole test class, including
schema validation and every previous test.

**`isEqualTo(1)`**, not `isLessThan(50)`. An exact number is a specification: it
says what this method costs, and it fails when that changes in either direction —
including when someone "optimises" it into two queries that are worse. A loose
bound drifts upward one commit at a time until it means nothing.

**`getCollectionFetchCount()` alongside the statement count.** The statement
count tells you something changed; the fetch count tells you *what*. Asserting
both means the failure message diagnoses itself.

## Make it prove it is a *constant*

The exact-count assertion above is good. This one is better, because it tests the
property that actually defines the bug:

```java
@ParameterizedTest
@ValueSource(ints = {1, 5, 25})
void statement_count_does_not_grow_with_the_number_of_orders(int orderCount) {
    givenOrders(orderCount, 5);
    em.flush();
    em.clear();
    stats.clear();

    new OrderSummaryService(orders).summarise();

    assertThat(stats.getPrepareStatementCount())
            .as("statements for %d orders", orderCount)
            .isEqualTo(1);
}
```

**N+1 is not "too many queries" — it is "a query count that is a function of the
data".** A test that runs the same method against 1, 5 and 25 parents and asserts
the same count each time is testing exactly that, and it cannot be satisfied by
accident. It is also self-documenting: the failure message says *statements for
25 orders: expected 1 but was 26*, which names the bug without anybody needing to
know what N+1 means.

Making that reusable — a `QueryCounter` component, a custom AssertJ assertion,
and where in a codebase these tests belong — is
[chunk 6c](06c-making-it-reusable.md).

⛔ There is no database on the machine this page was written on, so no output from
these tests is shown anywhere in this topic. The tests are the deliverable; run
them against your own schema.

## Gotchas

**⚠️ Forgetting `em.clear()`.**
The fixture is still in the persistence context, every association is already
initialised, no SQL is issued, and the test passes with a count of zero against a
service that is riddled with N+1. This is the failure mode that makes teams
distrust the whole technique.

**⚠️ Forgetting `stats.clear()`.**
Counters are cumulative from startup and global to the `SessionFactory`, so you
assert on everything the test class has ever done. The number is large, arbitrary
and different on every run.

**⚠️ Asserting a range instead of a number.**
`isLessThan(50)` passes at 49 and is therefore a licence for anything up to 49. It
also fails to catch the case where the count *drops* because someone removed a
join that was doing necessary work. Assert the exact number and change it
deliberately when the method changes.

**⚠️ A `@Transactional` test that never flushes.**
Spring's test transaction means nothing is written until flush, so the queries you
are counting may not have run at the point you read the counters. Flush explicitly
before clearing.

**⚠️ Running the test with one parent row.**
`1 + N` where N is 1 is two statements. Two versus one looks like rounding. The
test must use enough parents that the arithmetic is obvious, and ideally must
assert the count is the same across several sizes.

**⚠️ A fixture with one child per parent.**
With one line per order, a Cartesian-product bug and a correct fetch join return
the same number of rows, so the test cannot tell a good fix from a bad one. Give
each parent several children.

**⚠️ Counting statements across a concurrent test.**
The statistics are global to the `SessionFactory`. A parallel test executor
running two of these at once produces garbage in both. Mark them
non-parallelisable, or count at the datasource with a per-thread proxy instead.

**⚠️ Adding the assertion and not the fix.**
A failing count test is a regression detector, not a design. If you add it to a
service that already has N+1, it fails immediately — fix the fetch plan first,
then lock the number in.

## Interview questions

**★ How would you write a test that fails when someone reintroduces an N+1?**
Enable `hibernate.generate_statistics`, get the `Statistics` from the
`SessionFactory` by unwrapping the `EntityManagerFactory`, and around the call
you care about: flush, clear the persistence context, clear the statistics, run
the method, then assert an exact `getPrepareStatementCount()` and a zero
`getCollectionFetchCount()`. The two clears are what make it real — without
`em.clear()` the fixture is still managed and initialised so no SQL runs at all
and the test passes vacuously, and without `stats.clear()` you are asserting on
counters that are cumulative since application startup. The assertion should be
an exact number rather than an upper bound, because a bound drifts upward one
commit at a time and because an exact number also catches a count that changes
for a good-looking but wrong reason.

**★ Why assert the count is *constant across data sizes* rather than just small?**
Because that is the actual definition of the bug. N+1 is not "too many
statements" — a method that legitimately issues four is fine — it is "a statement
count that is a function of the number of rows returned". A parameterised test
that runs the same method against 1, 5 and 25 parents and asserts the same count
each time is testing precisely that property, and it cannot be satisfied
accidentally by a method that happens to be cheap on small data. It also produces
a failure message that explains itself — *statements for 25 orders: expected 1
but was 26* — which means the next developer does not need to know the term N+1
to understand what broke.

**★ What is the most common way one of these tests ends up worthless?**
Forgetting `em.clear()`. The test builds its fixture, so every entity and every
association is already in the persistence context and already initialised; the
method under test then finds everything in the first-level cache and issues no
SQL at all. The count assertion passes with zero, the test is green, and it is
protecting nothing — while the same code in production, called with a fresh
context, issues one statement per row. The general lesson is that a count-based
test is measuring an interaction with the database, so it has to start from the
state production starts from: an empty persistence context and reset counters.

**★ Should these run against H2 or a real PostgreSQL?**
A real PostgreSQL, via Testcontainers or a provisioned instance, with
`@AutoConfigureTestDatabase(replace = NONE)` to stop `@DataJpaTest` swapping in
an embedded database. Statement *counts* are largely engine-independent, so H2
would catch the regression — but as soon as you want to assert anything about the
SQL itself, or verify how a fetch join or a pagination clause is actually
translated, the dialect matters, and Hibernate generates materially different SQL
per dialect. There is also a subtler reason: running against the real engine
means the same test can grow into a check on the query plan or the row count
later, whereas an H2-based test is permanently limited to counting.

**★ Why does the fixture's fan-out matter as much as its size?**
Because fan-out is what distinguishes the two failure modes from each other. If
every order has exactly one line, then one order produces one row whether you
fetched the lines with a join, with a secondary select, or with a Cartesian
product — all three shapes agree, so no assertion on rows or counts can separate
them. Give each order five lines and they diverge immediately: the join returns
five rows per order and one statement, the N+1 returns one row per order and
twenty-one statements, and a two-collection fetch returns twenty-five. So a
fixture with realistic fan-out is not a nicety; it is the thing that gives the
test discriminating power, and a fixture without it can pass against code that is
badly wrong.

**★ What does this test give you that a code-review rule does not?**
It converts a bug with no signal into a bug with a signal, mechanically, on every
commit. The structural problem with N+1 is that omitting a fetch plan produces no
compiler error, no exception, no failing test and no log line — so it depends
entirely on a human noticing, and humans stop noticing. A count assertion is
checked by the build, does not get tired, does not skip the file because the diff
was large, and — crucially — is phrased in terms of the property that defines the
bug rather than in terms of a syntax that might have caused it. That last point
matters because the shapes in [chunk 4c](04c-serialization-and-logging.md) have
no offending syntax at all: the traversal happens inside Jackson. No textual rule
can catch those, and a statement count catches them without knowing they exist.

---

← Prev: [6 · Count, do not read](06-count-do-not-read.md) · Index: [The N+1 problem](README.md) · Next → [6c · Making it reusable](06c-making-it-reusable.md)
