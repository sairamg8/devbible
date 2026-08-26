---
title: "Your repository is not a bean in a slice, the transaction rolls back, and `Replace.NON_TEST` decides whether the database under the test is yours"
sidebar_label: "12e · Wiring the test"
sidebar_position: 28
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Spring Boot 4.1 `@JdbcTest` and
> `@AutoConfigureTestDatabase` javadoc
> ([JdbcTest](https://docs.spring.io/spring-boot/api/java/org/springframework/boot/jdbc/test/autoconfigure/JdbcTest.html),
> [AutoConfigureTestDatabase.Replace](https://docs.spring.io/spring-boot/api/java/org/springframework/boot/jdbc/test/autoconfigure/AutoConfigureTestDatabase.Replace.html)),
> the Spring Boot 3.4 release notes
> ([github.com/spring-projects/spring-boot/wiki/Spring-Boot-3.4-Release-Notes](https://github.com/spring-projects/spring-boot/wiki/Spring-Boot-3.4-Release-Notes))
> and the Spring Framework 7.0 reference *Testing → TestContext Framework →
> Transaction management*
> ([docs.spring.io/.../testcontext-framework/tx.html](https://docs.spring.io/spring-framework/reference/testing/testcontext-framework/tx.html)).
> JDK 25, Spring Boot 4.1.0, Spring Framework 7.0.8, PostgreSQL 18.

**[Chunk 12d](12d-the-jdbctest-slice.md) covered what the slice contains. Three things
about wiring a test on top of it are not obvious from the annotation, and each one has
produced a confusing failure for somebody: the class you are testing is not in the
context, the transaction disappears at the end of the method, and the `DataSource` you
configured may not be the one your query runs against.**

## Your repository is not a bean

"Component scanning is configured to skip regular components" is not a nuance — it
means the class you are trying to test is not in the context. `@Autowired
OrderQueries` fails with a missing-bean error, and the message says no qualifying bean
of type `OrderQueries`, which reads like a scanning misconfiguration in the
application rather than the slice doing exactly what it advertises.

```java
@JdbcTest
@ImportAutoConfiguration(FlywayAutoConfiguration.class)
@Import(OrderQueries.class)
class OrderQueriesTests {

    @Autowired OrderQueries queries;
    @Autowired JdbcClient db;      // for arranging fixtures and asserting on state
    …
}
```

`@Import` on the class is the ordinary way, and listing the class explicitly is a
feature rather than a chore: the test states its own dependencies, so a reader knows
precisely what is in the context. When a package has many repositories and the list
becomes noise, `@JdbcTest`'s `includeFilters` attribute can bring in a stereotype
instead — at the cost of the test no longer saying what it loads.

Injecting the raw `JdbcClient` alongside is deliberate. It is how the test arranges
fixtures and inspects state **without going through the code under test**, which
matters more here than usual — see the gotcha about self-confirming tests below.

## The transaction, and what it hides

Each test method runs in a transaction that is rolled back at the end, because
`@Transactional` is on the annotation and the TestContext framework's default is
rollback:

> "Annotating a test method with `@Transactional` causes the test to be run within a
> transaction that is, by default, automatically rolled back after completion of the
> test."

For SQL-first code this is nearly free of the usual hazard. The famous rollback
problem is the ORM one — Spring's own caution that failing to flush a persistence
context "can produce false positives: Your test passes, but the same code throws an
exception in a live, production environment". A `JdbcClient` repository has no unit of
work to flush; by the time the method returns, every statement has already been sent
and the database has already accepted or rejected it. The whole category described in
**[The false positives](../04-spring-transactional/20b-the-false-positives.md)**
simply does not arise, and that is a real advantage of this style at test time as well
as at runtime.

What rollback still hides is **anything that happens at commit**:

- **Deferred constraints.** A `DEFERRABLE INITIALLY DEFERRED` foreign key is checked
  at commit, and a rolled-back test never commits, so the violation never fires.
- **`on commit` behaviour** — commit-time triggers and temporary-table semantics.
- **Anything that reads on a different connection.** A `REQUIRES_NEW` boundary inside
  the code under test, a second data source, or a real background thread all see a
  database in which your fixture does not exist.
- **The actual durability of a write.** "The row is there" inside the transaction is
  not the same claim as "the row is there".

`@Commit`, `TestTransaction`, and `@Sql(config = @SqlConfig(transactionMode =
ISOLATED))` are the escapes, all argued in
**[Transactions in tests](../04-spring-transactional/20-transactions-in-tests.md)**
and **[The fixture and the real database](../04-spring-transactional/20j-the-fixture-and-the-real-database.md)**.

⚠️ **Committing has a cost the rollback default was paying for you**: the next test
sees your rows. In a suite sharing a cached context and one container, that reaches
across test classes, and the failure appears only when the whole suite runs in a
particular order. Commit deliberately, in named tests, and clean up in an
`AFTER_TEST_METHOD` script rather than in the test body — a script still runs when the
assertion fails.

## `@AutoConfigureTestDatabase` and the default that changed

The slice replaces your `DataSource`. Which one it is willing to replace is the
`replace` attribute, and in Boot 4 it defaults to **`Replace.NON_TEST`**:

| Constant | Javadoc |
|---|---|
| `ANY` | "Replace the `DataSource` bean whether it was auto-configured or manually defined." |
| `AUTO_CONFIGURED` | "Only replace the `DataSource` if it was auto-configured." |
| `NON_TEST` | "Replace the `DataSource` bean unless it is auto-configured and connecting to a test database." |
| `NONE` | "Don't replace the application default `DataSource`." |

`NON_TEST` defines "test database" precisely — three kinds, verbatim:

> "Any bean definition that includes `ContainerImageMetadata` (including
> `@ServiceConnection` annotated Testcontainers databases, and connections created
> using Docker Compose) · Any connection configured using a `spring.datasource.url`
> backed by a `@DynamicPropertySource` · Any connection configured using a
> `spring.datasource.url` with the Testcontainers JDBC syntax"

🔴 **This is why `@AutoConfigureTestDatabase(replace = NONE)` is no longer the
reflexive companion to Testcontainers.** A `@ServiceConnection` container carries
`ContainerImageMetadata`, so the default already leaves it alone. Boot 3.4's release
notes describe the change as: the annotation "now attempts to detect if a database has
been sourced from a container. This should remove the need to add `replace=Replace.NONE`",
with `replace=Replace.AUTO_CONFIGURED` named as the way back to the old behaviour.

`NONE` is still what you want when the database is real but arrives some other way — a
`spring.datasource.url` pointing at a database CI started for you, or a URL assembled
from environment variables — because none of those look like a test database to the
detection.

⚠️ **`@AutoConfigureTestDatabase` considers only the `@Primary` `DataSource`**, per its
own javadoc: "In the case of multiple `DataSource` beans, only the `@Primary`
`DataSource` is considered." An application with two data sources gets one of them
replaced and the other left alone, which is almost never what a test wants and is
invisible until a query goes to the wrong database.

## The whole test

```java
@JdbcTest
@ImportAutoConfiguration(FlywayAutoConfiguration.class)
@Import(OrderQueries.class)
class OrderQueriesTests {

    @Autowired OrderQueries queries;
    @Autowired JdbcClient db;

    @Test
    void findByIdMapsEveryColumn() {
        db.sql("""
               insert into orders (id, customer_id, status, total, placed_at)
               values (1, 7, 'COMPLETED', 42.50, timestamptz '2026-01-02 03:04:05Z')
               """).update();

        OrderRow row = queries.findById(1L).orElseThrow();

        assertThat(row.customerId()).isEqualTo(7L);
        assertThat(row.status()).isEqualTo("COMPLETED");
        assertThat(row.total()).isEqualByComparingTo("42.50");
        assertThat(row.placedAt()).isEqualTo(Instant.parse("2026-01-02T03:04:05Z"));
    }

    @Test
    void findByIdIsEmptyForAnUnknownId() {
        assertThat(queries.findById(999L)).isEmpty();
    }
}
```

Note what the first test asserts: **every mapped component, by value**. Asserting that
a row came back proves the query ran. Asserting the values proves the mapper is bound
to the right columns, which is the one thing nothing else in a SQL-first stack checks
([chunk 10b](10b-what-you-give-up.md)). `isEqualByComparingTo` on the `BigDecimal` is
not fussiness either — `BigDecimal.equals` compares scale, so `42.50` and `42.5` are
unequal, and which one you get back depends on the column's declared `numeric(p, s)`.

## Gotchas

**`@Autowired` on your repository fails with a message that never mentions slicing.**
It says no qualifying bean of type `OrderQueries`, which sends people to check
`@ComponentScan` in the application. The cause is `@TypeExcludeFilters(JdbcTypeExcludeFilter.class)`
on `@JdbcTest`, doing what the javadoc says. `@Import(OrderQueries.class)`.

**A test that arranges fixtures through the repository under test cannot fail.**
Inserting with `queries.insert(...)` and reading back with `queries.findById(...)`
passes whenever the two agree — including when both are wrong about a column name in
the same direction. Arrange with the raw `JdbcClient` or with `@Sql`, and read through
the repository, so the two sides approach the table independently.

**`@JdbcTest` does not turn on your `ConversionService`, your converters, or anything
else the application registers.** Only the listed auto-configurations run. A
repository that depends on a custom `ConversionService` — `JdbcClient.create` takes
one as of 7.0 — maps differently under the slice than in production, and the test is
then asserting the default behaviour rather than yours. Import the configuration that
defines it.

**Adding `replace = NONE` out of habit with no real database configured leaves the
test pointing wherever `spring.datasource.url` resolves.** In a test profile that is
usually nothing, and the failure is loud. When it is not nothing — an inherited
`application.yml`, an environment variable set on a build agent — it is very quiet,
and the first symptom is data in an environment you did not mean to touch.

**Two `DataSource` beans and only the `@Primary` one is replaced.** The javadoc says
so explicitly, and it means a repository wired to the secondary data source runs
against the real thing while the rest of the test runs against an embedded one.
Nothing reports this; the queries just behave differently.

**`BigDecimal` assertions with `isEqualTo` fail on scale, not on value.**
`numeric(10,2)` gives you `42.50` and a literal `new BigDecimal("42.5")` is not equal
to it. Use `isEqualByComparingTo`, or the test becomes a test of the column
definition.

**Timestamp assertions are where a passing test hides a timezone bug.** Mapping
`timestamptz` through `rs.getObject(col, OffsetDateTime.class)` and asserting an
`Instant` is safe. Mapping through `LocalDateTime` or `java.sql.Timestamp` silently
involves the JVM default zone, so the test passes on a developer machine set to UTC
and fails — or worse, quietly shifts — on one that is not. Pin the JVM timezone in the
build if you cannot avoid the types.

**Rolling back is not the same as cleaning up when the test committed anything.**
The moment a test uses `@Commit`, `TestTransaction.flagForCommit()` or an `ISOLATED`
`@Sql` fixture, its rows outlive it. Delete them in an `AFTER_TEST_METHOD` script
rather than at the end of the method body, because a failing assertion skips the rest
of the method and leaves the data behind for every later test.

## Interview questions

**★ Why does `@Autowired` on the repository fail inside a `@JdbcTest`?**
Because the slice filters component scanning. Its javadoc says component scanning "is
configured to skip regular components and configuration properties", implemented by
`@TypeExcludeFilters(JdbcTypeExcludeFilter.class)` on the annotation, so your
`@Repository` is simply not a bean in that context. The fix is
`@Import(OrderQueries.class)`, which I regard as an improvement rather than a chore —
the test then names everything it loads. The confusing part is only the error message,
which reads as a missing `@ComponentScan` in the application.

**★ Why is the rollback default less dangerous for SQL-first than for JPA?**
Because there is no unit of work to flush. Spring's own documentation warns that ORM
tests produce false positives when the persistence context is never flushed — the test
passes because the `UPDATE` was never sent, and the same code throws in production
when the flush finally happens. A `JdbcClient` repository sends every statement at the
call site, so by the time the assertion runs the database has already accepted or
rejected it, and a constraint violation has already been translated and thrown. What
rollback still hides is commit-time behaviour: deferred constraints, commit triggers,
and anything reading on a second connection. For those you need `@Commit`,
`TestTransaction`, or an `ISOLATED` fixture.

**★ Do you still need `@AutoConfigureTestDatabase(replace = NONE)` with
Testcontainers?**
On Boot 4, usually not. The default is `Replace.NON_TEST`, which replaces the
`DataSource` "unless it is auto-configured and connecting to a test database" — and a
`@ServiceConnection` container counts, because its bean definition carries
`ContainerImageMetadata`. So does a `spring.datasource.url` using the Testcontainers
JDBC syntax, and one backed by `@DynamicPropertySource`. `NONE` is still needed when
the real database arrives some other way, such as a URL that CI set up. Boot 3.4 is
where the detection landed, which is why so much existing advice — and so many
existing tests — still carry the annotation. If I saw it on a new test I would ask
which of the three cases applied.

**★ How do you arrange test data for a repository test?**
With something other than the repository under test. Either `@Sql` scripts, which keep
the fixture declarative and let you choose `ISOLATED` when the data must be committed,
or the raw `JdbcClient` the slice already provides. What I avoid is arranging through
the repository's own insert method and asserting through its own query method, because
that test passes whenever the two share a mistake — a column name misspelt on both
sides cancels out and the suite stays green through a rename. The fixture and the
assertion should reach the table from different directions.

**★ What should a repository test assert, concretely?**
Every mapped component, by value, for at least one fully populated row — that is the
only check that the mapper is bound to the right columns, and it is what catches a
rename, a swapped pair of same-typed components and a silently unset property. Then
the boundary cases the return type promises: empty for an unknown id, an empty list
rather than null, the exception for more rows than the signature allows. For writes,
the affected row count and a read-back through a different query. And `BigDecimal`
with `isEqualByComparingTo` rather than `isEqualTo`, because equality on `BigDecimal`
includes scale and the scale comes from the column definition rather than from your
code.

**★ A test passes locally and fails on the build agent. What do you look at first?**
Timezone and ordering, in that order. Anything mapped through `LocalDateTime` or
`java.sql.Timestamp` picks up the JVM default zone, so a test written on a machine set
to UTC behaves differently on one that is not; mapping `timestamptz` to
`OffsetDateTime` and asserting an `Instant` removes the class of failure entirely.
Ordering is the other one: a query with no `order by` is free to return rows in any
order, and small tables usually return them in insertion order, so the test only fails
once the plan changes or the data grows. After those two, shared state — a committed
row from an earlier test class reaching this one through a cached context and a reused
container.

---

← Prev: [12d · The `@JdbcTest` slice](12d-the-jdbctest-slice.md) · Index: [05 · SQL-first access](README.md) · Next → [12f · The real database](12f-the-real-database.md)
