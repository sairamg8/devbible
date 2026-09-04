---
title: "A SQL fixture is honest about what is in the database and blind to refactoring; a fixture inserted through the repository is refactor-safe and can hide the very mapping bug the test exists to catch — the choice is between two different lies, and the honest answer is to use each for what it can actually prove"
sidebar_label: "04d · SQL versus repository fixtures"
sidebar_position: 14
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the **Spring Framework 7.0.x** testing reference,
> *Executing SQL Scripts*
> ([docs.spring.io](https://docs.spring.io/spring-framework/reference/testing/testcontext-framework/executing-sql.html)),
> and the Spring Boot 4.1.1 javadoc for
> [`DataJpaTest`](https://docs.spring.io/spring-boot/api/java/org/springframework/boot/data/jpa/test/autoconfigure/DataJpaTest.html)
> and
> [`TestEntityManager`](https://docs.spring.io/spring-boot/api/java/org/springframework/boot/jpa/test/autoconfigure/TestEntityManager.html)
> (package `org.springframework.boot.jpa.test.autoconfigure` in Boot 4 — it moved).
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1,
> Spring Framework 7.0.9, JUnit Jupiter 6.0.3.
> ⚠️ **No database and no sandbox on this machine** — Java source, SQL and documented
> behaviour only, never the output of a run.

**Once you can write a `@Sql` fixture the question becomes whether you should. The
alternative — build the object with a builder and save it through the repository in a
`@BeforeEach` — is refactor-safe, reads like the rest of the test suite, and has one
disqualifying property for exactly the tests you most want it for: it writes through the
same mapping the test is about to read through, so a mapping that is wrong in both
directions passes. SQL has the opposite profile. This chunk argues that they are not
substitutes, names the failure mode of each, and gives the rule I actually use;
[04d2](04d2-the-columns-sql-has-to-fill.md) covers the mechanical price of the SQL side —
the columns you now have to fill by hand and the sequence you just desynchronised.**

## What each one can prove

**A SQL fixture states the row.** It says `INSERT INTO account (id, iban, balance_minor,
currency) VALUES …` and therefore the test's premise is a claim about the table. If the
mapping is wrong — the entity writes `balance` where the column is `balance_minor`, or an
enum is persisted as an ordinal where the column holds a name — the read fails or returns
the wrong value, and the test catches it.

**A repository fixture states the object.** It says
`repository.save(anAccount().withBalance(gbp("10.00")).build())` and therefore the test's
premise is a claim about the domain. If the mapping is wrong, the write is wrong in exactly
the way that makes the read look right, and the test passes. This is the circularity that
matters:

```java
// The bug: the enum is mapped with the default ORDINAL strategy,
// but the column holds names and production data contains 'SETTLED'.
@Enumerated                       // 🔴 defaults to ORDINAL
private Status status;

// The test that cannot see it:
@BeforeEach
void setUp() {
    repository.save(anAccount().withStatus(SETTLED).build());   // writes 2
}

@Test
void findsSettledAccounts() {
    assertThat(repository.findByStatus(SETTLED)).hasSize(1);    // reads 2 → passes
}
```

The suite is green and every row the application has ever written is wrong. A SQL fixture
containing `'SETTLED'` fails immediately, which is the entire value of writing it in SQL.

Say the trade in one line: **a repository fixture cannot falsify the mapping, because it
uses it.**

## What each one costs

**SQL is opaque to refactoring, and the compiler cannot help.** Rename a column in a
migration and the script breaks at runtime with a column-does-not-exist error — annoying,
but loud and localised. The genuinely bad case is the reverse: rename a *field* and change
its `@Column(name = …)`, and the script keeps working while now describing a schema the
entity no longer maps the way you think. Nothing is red; the fixture is simply asserting
something different from what it did last week.

**SQL can create states the application cannot produce.** A row with a `NULL` in a column
the entity declares `@NotNull`, an orphaned child with no parent, a status value that was
retired two releases ago. This is a genuine feature — legacy rows exist and the code has to
survive them, and the only honest way to test that is to write the legacy row — and it is
also a hazard, because it is equally easy to test a state that can never occur and then
"fix" production code to handle it.

**Repository setup is slower and does more.** A `save` through JPA flushes, cascades,
fires `@PrePersist` and entity listeners, and populates auditing columns. That is
occasionally what you want — it is how you get a valid `@CreatedDate` without writing a
timestamp literal — and it is a lot of machinery to run for a fixture.

**And repository setup drags the persistence context into the test.** If you save and then
query in the same transaction without flushing, the query may see nothing, or the
first-level cache may hand you back the very instance you saved rather than one built from
the row. `TestEntityManager` exists for exactly this, and its javadoc says what
`persistFlushFind` is for:

> *"makes an instance managed and persistent, synchronizes the persistence context to the
> underlying database and finally finds the persisted entity by its ID … helpful when
> ensuring that entity data is actually written and read from the underlying database
> correctly."*

```java
@DataJpaTest
class AccountRepositoryTest {

    @Autowired TestEntityManager em;
    @Autowired AccountRepository repository;

    @Test
    void roundTripsTheStatus() {
        Account saved = em.persistFlushFind(anAccount().withStatus(SETTLED).build());
        // 'saved' came back from the database, not from the identity map
    }
}
```

`persistAndFlush` followed by `em.clear()` is the version to use when you want the
subsequent query to go to the database rather than to the identity map. A plain
`repository.save(…)` gives you neither.

## The rule

Use **repository or builder setup** by default, for tests about behaviour: a query method's
predicate, a service's logic, a controller slice. It is refactor-safe, it reads like the
rest of the suite, and the mapping is not the subject.

Use a **SQL fixture** when the row itself is the subject:

- a test whose premise is a state the application cannot produce — legacy rows, retired
  enum values, `NULL` where the entity forbids it, orphans;
- a test of the mapping, where writing through the mapping would defeat the point;
- a test of a native query or a view, where the entity is not involved;
- a large reference dataset where the object graph is beside the point and the round trips
  would dominate.

And use **migrations, not either of these**, for the schema — see the interview question in
[04](04-fixtures-in-the-database.md).

The hybrid that works in practice: schema from the real migrations, common reference data
from a class-level `@Sql` in `BEFORE_TEST_CLASS`, and the rows the assertion is about built
with a builder and saved through the repository, so the interesting values are visible in
the test rather than in a file.

## Where this connects

- The builder and object-mother patterns this page assumes: [02 · The builder](02-the-builder.md) and [03 · Object mothers](03-object-mothers.md).
- The columns a hand-written `INSERT` has to fill and the sequence it leaves behind:
  [04d2 · The columns SQL has to fill](04d2-the-columns-sql-has-to-fill.md).
- Where the `@Sql` script comes from:
  [04 · Fixtures in the database](04-fixtures-in-the-database.md).
- What rollback does to sequences and auditing:
  [05a2 · What rollback breaks](05a2-what-rollback-breaks.md).
- Why the engine has to be the real one for a mapping test to mean anything:
  [07 · Testcontainers → 01b](../07-testcontainers/01b-where-the-line-is.md).
- Mapping, identity generation and optimistic locking themselves:
  [Phase 10 · Data access](../../phase-10-data-access/README.md).

## Gotchas

**★ A fixture inserted through the repository cannot catch a mapping bug, because it uses
the mapping.**
An enum persisted as an ordinal where the column holds names, a wrong `@Column(name = …)`,
a converter applied in both directions — all of these round-trip perfectly through
`save`-then-`find` and are wrong for every row in production. If the mapping is the
subject, the fixture must be SQL.

**★ Renaming a field and its `@Column` mapping leaves the SQL fixture compiling and lying.**
The script still runs, because the column still exists; it now describes a different
mapping from the one the entity uses. Column *renames* fail loudly, which is the safe case;
mapping changes that keep the column name do not fail at all.

**★ `repository.save(…)` inside a transactional test may not have reached the database when
the next query runs.**
JPA can defer the insert to flush time, and a subsequent `find` may be served from the
first-level cache with the very instance you saved. Use `TestEntityManager.persistAndFlush`
plus `clear()`, or `persistFlushFind`, when the point of the test is that the row
round-trips.

**★ SQL fixtures can express states that cannot occur, and nothing tells you which kind you
just wrote.**
Testing that the code survives a legacy row is valuable. Testing an impossible state, then
adding production code to handle it, is pure cost — and the two look identical in a diff.
When you write a fixture the application could not produce, say why in the test name.

**★ Repository setup runs entity listeners, cascades and validation; SQL runs none of them.**
So a fixture that "works" through the repository may be impossible to express in SQL
without also reproducing what a listener did, and a fixture written in SQL may skip a
`@PrePersist` that production rows always have. Neither is wrong; they are different
premises, and mixing them within one class means two different kinds of row in the same
table.

**★ A large SQL fixture is faster to load and slower to understand.**
Two hundred rows in a script cost one script execution and are opaque; two hundred rows
through a builder cost two hundred round trips and are readable. That trade is real, and it
is the one case where the shared class-level fixture with `BEFORE_TEST_CLASS` earns its
place — as long as nothing writes to it.

**★ Test data written in SQL bypasses bean validation entirely.**
A `@Size(max = 20)` field can hold a 500-character value if the column allows it, so a test
can assert behaviour on a row the application would have rejected at the boundary. That is
occasionally the point; more often it is an accident that makes the test prove less than it
appears to.

## Interview questions

**★ Would you set up a repository test's data with SQL or by saving through the repository?**
Both, for different tests. Saving through the repository is refactor-safe, reads like the
rest of the suite, and is right whenever the mapping is not the subject — which is most
tests. It has one disqualifying property: it writes through the same mapping the test then
reads through, so a mapping that is wrong in both directions passes. Anything whose subject
*is* the mapping, or whose premise is a row the application cannot produce — a legacy value,
a `NULL` the entity forbids, an orphan — has to be SQL, because that is the only way the
test's premise is a claim about the table rather than about the object.

**★ Give a concrete bug that a repository-inserted fixture cannot catch.**
An enum mapped with the default `ORDINAL` strategy against a column that holds names. The
test saves `SETTLED`, Hibernate writes the ordinal, the query reads the ordinal back and
the assertion passes — while every row in production, written by an older release or by
another service, holds the string and does not match. A `@Sql` fixture containing
`'SETTLED'` fails on the first read. The same shape covers a wrong `@Column(name = …)` that
happens to be consistent, and a converter applied symmetrically in both directions.

**★ Your JPA test saves an entity and then queries for it and gets nothing. What is happening?**
Almost certainly that the insert has not been flushed. Inside a transactional test JPA can
defer the write until flush time, so a JPQL or native query issued before the flush does
not see it — and, conversely, a `find` by id may be served from the first-level cache with
the instance you saved rather than from a row. `TestEntityManager.persistAndFlush` followed
by `clear()` forces both the write and a genuine re-read; `persistFlushFind` does it in one
call and exists, per its javadoc, precisely for *"ensuring that entity data is actually
written and read from the underlying database correctly"*.

**★ What is the maintenance cost of SQL fixtures, and how do you keep it down?**
The cost is that the schema is now described in two places — the migrations and the fixture
scripts — with no compiler and no tool keeping them in step. A column rename breaks the
script loudly; a mapping change that keeps the column name does not break it at all, it
just makes it describe something else. I keep the cost down by making the fixtures small
and specific rather than large and shared, by never letting a fixture script create schema
(that is the migrations' job), and by preferring builder-and-repository setup for
everything whose subject is not the row itself. The fixtures that remain are then the ones
that genuinely earn a file.

**★ When is a big shared SQL fixture the right answer?**
When the dataset is reference data — currencies, countries, tax bands, a product catalogue
— that every test in the class reads and no test writes. Then a class-level `@Sql` in
`BEFORE_TEST_CLASS` loads it once, the round-trip cost of building it through a repository
is avoided, and the opacity does not matter because no assertion depends on any individual
row. The condition is strict: the moment a test *writes* to that data, the class has shared
mutable state and the tests become order-dependent.

{/* FOOTER */}
