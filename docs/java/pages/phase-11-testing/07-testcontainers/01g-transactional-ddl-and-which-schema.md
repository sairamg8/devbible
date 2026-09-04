---
title: "DDL is part of a transaction on PostgreSQL and commits one on H2 — and on an embedded database Spring Boot generates the schema for you, so the test may never have run your migrations at all"
sidebar_label: "01g · Transactional DDL, and which schema"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the **H2 2.x documentation** — *Advanced → Transaction Isolation*
> ([advanced.html](https://www.h2database.com/html/advanced.html)) and *Commands → `CREATE INDEX`*,
> *→ `ANALYZE`*, *→ `SET DEFAULT_NULL_ORDERING`*
> ([commands.html](https://www.h2database.com/html/commands.html)) — the **PostgreSQL 18 manual**,
> *CREATE INDEX*
> ([sql-createindex](https://www.postgresql.org/docs/18/sql-createindex.html)) — and **Spring Boot
> 4.1.0 source read at tag `v4.1.0`**:
> [`HibernateDefaultDdlAutoProvider.java`](https://github.com/spring-projects/spring-boot/blob/v4.1.0/module/spring-boot-hibernate/src/main/java/org/springframework/boot/hibernate/autoconfigure/HibernateDefaultDdlAutoProvider.java),
> plus the two `SchemaManagementProvider` implementations that exist at that tag
> (`FlywaySchemaManagementProvider`, `LiquibaseSchemaManagementProvider`).
> Version spine: JDK 25, Spring Boot 4.1.1, Spring Framework 7.0.9, Testcontainers 2.0.5,
> **H2 2.4.240**, PostgreSQL JDBC 42.7.11, Flyway 12.4.0, JUnit Jupiter 6.0.3.
> ⚠️ **No Docker, no PostgreSQL and no sandbox on this machine.** Nothing here is a query log, a
> timing or a test run.

**[01c](01c-what-h2-gets-wrong.md) through [01f2](01f2-pattern-matching-and-search.md) catalogued
the divergences you can see in a statement. This page starts the half you cannot: what a
transaction actually contains, and — the question almost nobody asks of a green repository test —
which schema the test ran against in the first place. Both answers are different on an embedded H2
than on the PostgreSQL you deploy, and neither difference produces a message anywhere.**
## Transactional DDL, and the migration test that cannot exist

PostgreSQL runs DDL inside transactions. Its manual states the boundary by naming the exception
rather than the rule:

> *"a regular `CREATE INDEX` command can be performed within a transaction block, but
> `CREATE INDEX CONCURRENTLY` cannot."*

H2 states the opposite as a general property, twice — once in the isolation chapter:

> *"Please note that most data definition language (DDL) statements, such as 'create table',
> commit the current transaction."*

and once per command, for instance under `CREATE INDEX`:

> *"This command commits an open transaction in this connection."*

The same sentence appears under `ANALYZE`, `SET DEFAULT_NULL_ORDERING` and much of the rest of
the DDL surface. Three consequences, in increasing order of how much time they will cost you.

**One: a failed migration leaves a half-applied schema on H2 and nothing on PostgreSQL.** Flyway
runs each migration in a transaction where the database supports it. On PostgreSQL, a migration
that creates a table, backfills it and then fails on a constraint rolls back to the state before
the migration. On H2 the `CREATE TABLE` committed on the way past, so the schema is now in a
state no migration describes. A test asserting "a failed migration is atomic" is a test that can
only be written against PostgreSQL — see
[Flyway · 11 · Testing migrations](../../phase-10-data-access/11-flyway-migrations/11-testing-migrations.md).

**Two: DDL inside a test method silently disables `@DataJpaTest`'s rollback.** This is the one
that eats an afternoon.

```java
@DataJpaTest              // each test method runs in a transaction that is rolled back
class ReportRepositoryTests {

    @Autowired EntityManager em;

    @Test
    void buildsReport() {
        // On PostgreSQL this DDL is inside the test transaction and rolls back with it.
        // On H2 it COMMITS the test transaction. Everything written before it is now permanent,
        // and everything written after it is in a new transaction that also gets committed.
        em.createNativeQuery("CREATE TABLE report_tmp (id bigint)").executeUpdate();
        ...
    }
}
```

The symptom is never "DDL committed my transaction". The symptom is that tests pass alone and
fail in a suite, or pass in one order and fail in another, and somebody spends the afternoon
adding `@DirtiesContext`.

**Three: `CREATE INDEX CONCURRENTLY` cannot be discovered on H2.** `CONCURRENTLY` is not an H2
keyword, so a migration using it does not parse there at all. The team therefore never learns the
rule PostgreSQL states — that this particular statement must not run inside a transaction block,
which in Flyway terms means the migration has to be marked non-transactional. That rule is
learned in production, during the deploy that was supposed to add an index without taking a lock.


## Sequences, identity, and the SQL you never saw

### The dialect writes the SQL, and the dialect is chosen from the connection

Hibernate resolves `H2Dialect` or `PostgreSQLDialect` from the JDBC metadata of the connection it
was given. Everything downstream follows: the pagination clause, the lock clause, the identity
and sequence strategies, the type mappings. So for any JPQL or Criteria query, **the SQL string
your test executed is not the SQL string production executes.** The test proves that
`H2Dialect`'s rendering of your JPQL returns the right rows.

That is not a hypothetical objection: it is the reason the identifier-folding divergence in
[01c](01c-what-h2-gets-wrong.md) and the null-ordering divergence in
[01e](01e-text-numbers-and-ordering.md) stay hidden. Hibernate generates consistent SQL per
engine, so each engine agrees with itself, and self-consistency is all a green test can see.

### `allocationSize`, and why the sequence bug hides on H2

```java
@Id
@GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "order_seq")
@SequenceGenerator(name = "order_seq", sequenceName = "order_id_seq")  // allocationSize = 50
private Long id;
```

`allocationSize` defaults to 50, and Hibernate's pooled optimizer assumes the database sequence
increments by 50 to match. A migration that creates the sequence by hand does not:

```sql
CREATE SEQUENCE order_id_seq;   -- INCREMENT BY 1 on both engines
```

Now Hibernate hands out ids that collide with ids the sequence will issue again. This bug is
engine-independent — and it is **invisible on H2**, because on H2 the migration usually was not
the thing that created the sequence.

### Which schema did the test actually run against?

Spring Boot 4.1.0, `HibernateDefaultDdlAutoProvider`, read at tag `v4.1.0`:

```java
String getDefaultDdlAuto(DataSource dataSource) {
    if (!EmbeddedDatabaseConnection.isEmbedded(dataSource)) {
        return "none";
    }
    SchemaManagement schemaManagement = getSchemaManagement(dataSource);
    if (SchemaManagement.MANAGED.equals(schemaManagement)) {
        return "none";
    }
    return "create-drop";
}
```

Read it as a decision the framework makes on your behalf. **Embedded and unmanaged means
`create-drop`** — Hibernate generates the schema from your entity classes. Non-embedded means
`none`, so the schema is whatever is already there. `MANAGED` comes from a
`SchemaManagementProvider`, and at v4.1.0 exactly two exist in Boot:
`FlywaySchemaManagementProvider` and `LiquibaseSchemaManagementProvider`.

So on an embedded H2 with no migration tool wired into the slice, the schema your repository test
ran against was **generated from the entities that the test is testing**. It agrees with the
mapping by construction. Every column has the type Hibernate would choose, every sequence has the
increment Hibernate expects, and no index, check constraint, partial unique index or trigger from
your migrations exists at all. The migration-versus-entity drift that a repository test looks like
it is guarding against is precisely the thing it cannot see. That is the subject of
[Flyway · 11c · The slice that skips your migrations](../../phase-10-data-access/11-flyway-migrations/11c-the-slice-that-skips-your-migrations.md).


## Gotchas

**★ DDL inside a `@DataJpaTest` method commits the test transaction on H2 and does not on PostgreSQL.**
H2: *"most data definition language (DDL) statements, such as 'create table', commit the current
transaction."* The rollback that `@DataJpaTest` promises silently stops happening from that
statement onward. The symptom is never a DDL error — it is tests that pass alone and fail in a
suite, or pass in one order and fail in another. If a test needs a temporary table, create it in a
migration or a `@Sql` script that runs outside the test transaction, not with `createNativeQuery`
inside it.

**★ It is not only `CREATE TABLE` — `ANALYZE` and several `SET` commands commit too.**
H2 repeats *"This command commits an open transaction in this connection"* under `CREATE INDEX`,
`ANALYZE` and `SET DEFAULT_NULL_ORDERING`, among others. A test helper that calls `ANALYZE` to make
the optimiser behave, or a fixture that flips a session setting, will commit the test transaction
just as thoroughly as a `CREATE TABLE` — and it looks far more innocent in a diff.

**★ A failed migration is atomic on PostgreSQL and leaves a half-applied schema on H2.**
Flyway runs each migration in a transaction where the database supports it. On PostgreSQL a
migration that creates a table, backfills it and then fails on a constraint rolls back to the state
before the migration. On H2 the `CREATE TABLE` already committed on the way past. So the test
"a failed migration leaves the schema untouched" can only be written against PostgreSQL — see
[Flyway · 11 · Testing migrations](../../phase-10-data-access/11-flyway-migrations/11-testing-migrations.md).

**★ `CREATE INDEX CONCURRENTLY` cannot be tested on H2, so its transaction rule is learned in production.**
PostgreSQL: *"a regular `CREATE INDEX` command can be performed within a transaction block, but
`CREATE INDEX CONCURRENTLY` cannot."* On H2 `CONCURRENTLY` is not a keyword and the migration does
not parse, so nobody meets the rule — which in Flyway terms means marking the migration
non-transactional — until the deploy that was supposed to add an index without taking a lock.

**★ On an embedded database with no Flyway or Liquibase, `ddl-auto` defaults to `create-drop` — Hibernate wrote the schema you tested against.**
Straight out of `HibernateDefaultDdlAutoProvider.getDefaultDdlAuto`. The schema then agrees with
your entity mappings by construction, every sequence has the increment Hibernate wanted, and no
index, trigger, partial unique index, check constraint or column default from your migrations
exists. A repository test in that configuration cannot detect entity-versus-migration drift, which
is most of what people believe it is for.

**★ `MANAGED` comes from exactly two providers, and only if they are auto-configured in that slice.**
At Boot 4.1.0 the only `SchemaManagementProvider` implementations in the framework are Flyway's and
Liquibase's. So the question "did my migrations run in this test?" reduces to "is Flyway or
Liquibase auto-configured *inside this slice*, and enabled?" — which is a per-slice question with a
per-slice answer, not a property of the project. That question is
[Flyway · 11c · The slice that skips your migrations](../../phase-10-data-access/11-flyway-migrations/11c-the-slice-that-skips-your-migrations.md).

**★ A hand-written `CREATE SEQUENCE` increments by 1 and Hibernate's default `allocationSize` is 50.**
The pooled optimizer hands out fifty ids per fetch and the database will issue them again. The fix
is to make the two agree — `CREATE SEQUENCE order_id_seq INCREMENT BY 50` — or to set
`allocationSize = 1` and accept a round trip per insert. The reason this reaches production is not
that H2 behaves differently; it is that on an embedded database the hand-written migration usually
never ran, so Hibernate created the sequence with the increment it expected. The bug is written by
the migration and concealed by `ddl-auto`.

**★ The SQL under test is dialect output, so "we tested the query" is only true for native queries.**
Hibernate resolves `H2Dialect` or `PostgreSQLDialect` from the connection's JDBC metadata and
renders your JPQL or Criteria query accordingly. Whatever string your test executed, production
executes a different one. For derived and JPQL queries that is usually benign, and it is exactly
why the identifier and null-ordering divergences stay hidden — each engine is rendered
self-consistently.

**★ `ddl-auto=create-drop` also hides everything a migration does *after* creating a table.**
Backfills, data corrections, `NOT NULL` added in a second step, defaults, `CHECK` constraints added
later, triggers. Hibernate generates the *current* shape of the schema from the entities in one
pass. Every migration that transformed existing data — the migrations most likely to be wrong — is
skipped entirely, and a green repository test says nothing about them.

## Interview questions

**★ Why is transactional DDL a testing problem rather than an operations problem?**
Because it changes what a test framework's rollback means. `@DataJpaTest` rolls each test method
back, and on PostgreSQL that works even if the test issued DDL, because DDL participates in the
transaction. On H2, *"most data definition language (DDL) statements… commit the current
transaction"*, so any DDL in a test method commits everything before it and the rollback silently
stops applying. The symptom is order-dependent test failures, which get diagnosed as flakiness and
patched with `@DirtiesContext`. It is also an operations problem — a failed migration is atomic on
PostgreSQL and leaves a half-applied schema on H2 — but the testing consequence is the one that
costs an afternoon before anyone suspects the database.

**★ A repository test on an embedded H2 passes. Which schema did it run against?**
Almost certainly one Hibernate generated from the entity classes. Boot's
`HibernateDefaultDdlAutoProvider.getDefaultDdlAuto` returns `create-drop` when the `DataSource` is
embedded and no `SchemaManagementProvider` reports `MANAGED`, and only Flyway and Liquibase supply
those providers. So unless a migration tool is wired into the slice, the schema agrees with the
mapping by construction: every column has the type Hibernate chose, every sequence has the
increment Hibernate expects, and nothing from your migrations — indexes, check constraints, partial
unique indexes, triggers, defaults, backfills — exists at all. The test cannot detect drift between
entities and migrations, which is one of the main things people believe it is protecting them from.

**★ How does `allocationSize` produce a bug that only appears in production?**
Hibernate's `@SequenceGenerator` defaults `allocationSize` to 50 and its pooled optimizer assumes
the database sequence increments by 50 to match. A hand-written `CREATE SEQUENCE` increments by 1,
so Hibernate hands out fifty ids the sequence will hand out again later, and you get duplicate
keys under load. The reason it hides is not that H2 behaves differently — it does not — but that on
an embedded database the hand-written migration usually never ran; Hibernate created the sequence
itself, with the increment it wanted. The bug is created by the migration and concealed by
`ddl-auto`.

**★ Someone argues that `ddl-auto=create-drop` in tests is fine because "the entities are the source of truth". What do you say?**
That it is a coherent position only if the entities really are the source of truth — that is, if
the production schema is also generated from them, which almost nobody does and nobody should. If
migrations are the source of truth for production and entities are the source of truth for tests,
then you have two schemas and a build that never compares them. The comparison is cheap to arrange:
run the real migrations on a real engine in at least one test, and let Hibernate validate rather
than create (`ddl-auto=validate`). That single test is what makes every other repository test mean
something.

**★ What would you actually change in a project where every repository test runs on `create-drop` H2?**
Two things, in order. First, add one migration test on a container that applies the real migrations
and then boots the persistence unit with `ddl-auto=validate` — that catches entity-versus-migration
drift for the whole project in one test, cheaply. Second, move the repository tests whose
assertions depend on what the SQL returned onto the same container, and leave the rest wherever
they are. What you do *not* do is move all of them: [01b](01b-where-the-line-is.md) is about where
the line is, and Testcontainers' own documentation asks for as few database-touching tests as
possible.

**★ Why does DDL committing the transaction present as flaky tests rather than as a clear failure?**
Because the commit is a success, not an error. Nothing is thrown and nothing is logged at a level
anyone reads. What changes is that data written before the DDL is now permanent, so the *next* test
in the same class sees rows it did not create. Whether that breaks depends on test ordering, which
in JUnit is deterministic but unspecified by default and changes when someone adds a method. So the
suite fails on a branch where nobody touched persistence, the failing test is not the offending
one, and the fastest apparent fix — `@DirtiesContext`, or a `deleteAll()` in `@BeforeEach` — hides
the mechanism permanently.

{/* FOOTER */}
