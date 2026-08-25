---
title: "Wrap the counting in one component and a custom assertion, and put the tests only where N is unbounded — that is what makes the practice survive"
sidebar_label: "6c · Making it reusable"
sidebar_position: 14
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the `org.hibernate.stat.Statistics` interface in the
> Hibernate 7.4 source
> ([github.com/hibernate/hibernate-orm](https://github.com/hibernate/hibernate-orm/blob/7.4/hibernate-core/src/main/java/org/hibernate/stat/Statistics.java)),
> the Spring Boot 4.1 reference *Testing → Auto-configured Data JPA Tests*
> ([docs.spring.io/spring-boot/reference/testing/](https://docs.spring.io/spring-boot/reference/testing/spring-boot-applications.html))
> and the AssertJ documentation on custom assertions
> ([assertj.github.io/doc/](https://assertj.github.io/doc/)).
> JDK 25, Spring Boot 4.1.0, Hibernate ORM 7.4.1, JUnit 5.

**A good practice that requires fifteen lines of boilerplate per test is a
practice that gets abandoned. This chunk is the plumbing that reduces
[chunk 6b](06b-asserting-the-count-in-a-test.md)'s assertion to one readable
line, and the judgement about where to apply it — which matters more, because the
usual way this technique dies is being applied everywhere.**

## Make it reusable

Writing that boilerplate per test is how the practice dies. Wrap it once:

```java
@Component
public class QueryCounter {

    private final Statistics statistics;

    public QueryCounter(EntityManagerFactory emf) {
        this.statistics = emf.unwrap(SessionFactory.class).getStatistics();
    }

    /** Runs {@code work} from a clean slate and reports what it cost. */
    public <T> Counted<T> measure(EntityManager em, Supplier<T> work) {
        em.flush();
        em.clear();
        statistics.clear();
        T result = work.get();
        return new Counted<>(result,
                statistics.getPrepareStatementCount(),
                statistics.getCollectionFetchCount(),
                statistics.getEntityFetchCount());
    }

    public record Counted<T>(T result,
                             long statements,
                             long collectionFetches,
                             long entityFetches) {}
}
```

which makes a test one readable line:

```java
var counted = counter.measure(em, () -> service.summarise());

assertThat(counted.result()).hasSize(20);
assertThat(counted.statements()).isEqualTo(1);
assertThat(counted.collectionFetches()).isZero();
```

An AssertJ custom assertion goes one step further and gives you domain language
in the failure output:

```java
public class CountedAssert extends AbstractAssert<CountedAssert, Counted<?>> {

    public CountedAssert issuedExactly(long expected) {
        isNotNull();
        if (actual.statements() != expected) {
            failWithMessage(
                "Expected <%d> statements but <%d> were issued "
                + "(<%d> collection fetches, <%d> entity fetches — "
                + "a non-zero fetch count is an unfetched association)",
                expected, actual.statements(),
                actual.collectionFetches(), actual.entityFetches());
        }
        return this;
    }
}
```

The failure message is doing real work: it tells the next developer both that the
count changed and, via the fetch counts, which kind of association caused it.

## Where these tests belong

**On the endpoints and services that return collections**, and nowhere else. A
count assertion on a method that loads one aggregate by id is noise — it will
break every time the mapping changes and it is protecting against nothing.

The high-value set is small and identifiable: every list endpoint, every report,
every batch job, every export. Those are exactly the places where N is unbounded,
and there are usually fewer than twenty of them in a service.

⚠️ **Run them against the real database engine**, not H2. Statement *counts* are
mostly engine-independent, so an in-memory database will catch the regression —
but the moment you want to assert anything about the SQL itself, or about how a
fetch join is translated, the dialect differences matter. `@DataJpaTest` replaces
your datasource with an embedded one by default;
`@AutoConfigureTestDatabase(replace = NONE)` turns that off so the test uses the
configured PostgreSQL. See [Topic 01 · JDBC](../01-jdbc/README.md) for what the
driver is doing underneath.

## The fixture is part of the test

A count test is only as good as its data, and this is where they most often fail
quietly.

**Fan-out must be realistic.** Every order needs several lines. With one line per
order, a Cartesian-product bug and a correct fetch join return the same number of
rows and the test cannot tell them apart.

**More than one parent.** With a single order, `1 + N` is 2 and `1` is 1 — a
difference that is easy to write off. Use enough parents that the shapes are
unmistakable, which is why the parameterised version above goes up to 25.

**Build it with the entity manager, then clear.** Building the fixture through
the repository leaves everything managed and initialised, and clearing is what
makes the subsequent measurement honest.

⛔ There is no database on the machine this page was written on, so no output from
these tests is shown anywhere in this topic. The tests are the deliverable; run
them against your own schema.

## Gotchas

**⚠️ Building the fixture through the repository rather than the entity manager.**
Repository saves leave everything managed and initialised, and if the helper's
`clear()` runs before the fixture is flushed, the writes go out during the
measured section and are counted as part of the method's cost.

**⚠️ Making `QueryCounter` a singleton and sharing it across parallel tests.**
The underlying `Statistics` is global to the `SessionFactory`, so two tests
measuring at once corrupt each other's numbers. Either disable parallelism for
these tests or move the counting to a per-thread datasource proxy.

**⚠️ A custom assertion whose failure message only reports the number.**
The whole value of wrapping is the message. If it says "expected 1 but was 26"
and stops there, you have saved four lines and lost the diagnosis. Include the
collection and entity fetch counts — they name which kind of association caused
it.

**⚠️ Letting the helper swallow exceptions from the measured block.**
A `Supplier` that throws will propagate, which is correct, but make sure the
counters are read in a way that does not hide the original failure. A test that
reports "expected 1 statement but was 0" when the real problem was a
`ConstraintViolationException` wastes an afternoon.

**⚠️ Putting the counter in production code because it is a `@Component`.**
It is test infrastructure. Keep it in the test source set, or it becomes
something that has to work — and be maintained — in production.

**⚠️ Applying the assertion to every repository method.**
The fastest way to make the team delete all of them. Each one breaks on unrelated
mapping changes and most of them protect against nothing, because their statement
count cannot depend on data volume.

**⚠️ Not updating the expected number when the method legitimately changes.**
A new genuine query means a new number. Changing it is a one-line, deliberate
edit — and the fact that it must be deliberate is the feature, not the friction.

## Interview questions

**★ How do you stop count assertions from becoming boilerplate nobody
maintains?**
Push the ceremony into one place. A small `QueryCounter` component that takes an
`EntityManager` and a `Supplier`, does the flush-clear-clear before and reads the
counters after, returns a record carrying the result alongside the statement,
collection-fetch and entity-fetch counts. That reduces each test to a call and
two assertions, and it also makes the correct sequence impossible to get wrong —
which matters, because forgetting `em.clear()` is what silently invalidates these
tests. Pair it with a custom AssertJ assertion whose failure message reports all
three counts, so a failure diagnoses itself rather than just reporting a number.

**★ Why does the failure message matter so much for this particular assertion?**
Because the person reading it is usually not the person who wrote the test, and
the raw number tells them nothing about what to do. "Expected 1 statement but was
26" says something broke; "expected 1 but was 26 — 25 collection fetches" says an
association was loaded one parent at a time and points straight at the fetch
plan. The fetch counters are what carry that information, because Hibernate
distinguishes *loaded* from *fetched*: an association that arrived in a join
increments load only, while one that needed its own statement increments both. So
a message that includes the fetch counts turns a regression detector into a
diagnosis, at the cost of two extra fields in a record.

**★ Where do these tests belong and where do they not?**
Only where the statement count could depend on how much data exists: list
endpoints, reports, exports and batch jobs. In a typical service that is fewer
than twenty places, which makes the practice cheap enough to keep. A count
assertion on a method that loads one aggregate by id protects against nothing —
its count cannot grow with the data — and it breaks whenever the mapping changes,
so it is pure maintenance cost. That distinction matters more than the plumbing,
because a suite full of brittle count assertions is how the whole technique gets
removed in one commit, taking the valuable ones with it.

**★ Your team already has these tests and they keep failing for unrelated
reasons. What is going on?**
Almost always one of three things. The tests were applied indiscriminately, so
most of them are asserting on counts that had no business being asserted — fix by
deleting the ones whose count cannot vary with data volume. Or they are running
in parallel, and because Hibernate's statistics are global to the
`SessionFactory`, concurrent measurement corrupts every reading; fix by
serialising them or by counting at a per-thread datasource proxy instead. Or the
service's fetching is genuinely implicit rather than specified, so counts move
whenever anything anywhere changes — and that is not a test problem, it is the
underlying problem the tests are correctly reporting.

---

← Prev: [6b · Asserting the count](06b-asserting-the-count-in-a-test.md) · Index: [The N+1 problem](README.md) · Next → [6d · Proxies and agents](06d-proxies-and-agents.md)
