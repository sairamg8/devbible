---
title: "A from-empty run cannot test a data migration at all, because a backfill against an empty table matches zero rows and reports success — so the only way to test one is to migrate to the version before it, seed rows in that older shape, and then migrate the rest of the way"
sidebar_label: "11d2 · Testing a data migration"
sidebar_position: 42
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against Flyway 12's *target* setting
> ([documentation.red-gate.com](https://documentation.red-gate.com/flyway/reference/configuration/flyway-namespace/flyway-target-setting)),
> Flyway's *Java API usage*
> ([documentation.red-gate.com](https://documentation.red-gate.com/flyway/reference/usage/api-java)),
> Testcontainers' *JDBC support*
> ([java.testcontainers.org](https://java.testcontainers.org/modules/databases/jdbc/))
> and Spring Boot 4.1's `FlywayProperties`
> ([github.com/spring-projects/spring-boot](https://github.com/spring-projects/spring-boot/tree/main/module/spring-boot-flyway)).
> JDK 25, Spring Boot 4.1.0, Flyway 12.4.0, PostgreSQL 18.

**Everything in [11d](11d-what-the-test-should-assert.md) is about the schema's construction, and a
from-empty database is the right fixture for that. It is the wrong fixture for the other half of this
topic: `V44__Backfill_customer_region.sql` runs against a table with no rows, updates nothing, reports
success, and tells you precisely nothing. Testing a data migration means constructing the state it
will actually meet, which needs one Flyway setting and a discipline about what you assert. This chunk
is that, plus the list of things the migrations test should deliberately not check.**

## Stage the database with `target`

`target` bounds how far a `migrate()` goes:

> *"The target version up to which Flyway should consider migrations. This must be a valid migration
> version, or one of the special values detailed later."*

with `latest` as the default for versioned migrations, and `current` and `next` as the other special
values. Set it to the version immediately before the migration under test and you get a database in
exactly the shape that migration was written against.

```java
@Test
void v44BackfillsTheNullRegions() {
    var url = postgres.getJdbcUrl();
    var user = postgres.getUsername();
    var pass = postgres.getPassword();

    Flyway.configure().dataSource(url, user, pass).target("43").load().migrate();

    jdbc.update("INSERT INTO customers (id, name, region) VALUES (1, 'a', NULL)");
    jdbc.update("INSERT INTO customers (id, name, region) VALUES (2, 'b', 'emea')");

    Flyway.configure().dataSource(url, user, pass).load().migrate();

    assertThat(jdbc.queryForObject(
            "SELECT region FROM customers WHERE id = 1", String.class))
        .isEqualTo("unknown");
    assertThat(jdbc.queryForObject(
            "SELECT region FROM customers WHERE id = 2", String.class))
        .isEqualTo("emea");
}
```

Flyway's documented fluent form is exactly this shape:

```java
Flyway flyway = Flyway.configure().dataSource(url, user, password).load();
flyway.migrate();
```

### Three things this test is buying

**It seeds the *pre-migration* schema, not the current one.** Inserting rows after every migration has
run cannot test a backfill, because the backfill already ran against an empty table. `target("43")` is
what creates a database in the state `V44` will meet in production.

**The second assertion is the one that matters.** Row 2 already had a region, and asserting it is
*unchanged* is what tests the `WHERE region IS NULL` predicate — the resumability contract from
[10b](10b-batching-a-backfill.md). A backfill written without that predicate overwrites already-correct
rows and passes a test that only checks row 1.

**It is a separate `Flyway` instance from the application's.** This test wants its own container and
its own configuration, so it does not belong in the same class as
[11d](11d-what-the-test-should-assert.md)'s from-empty assertions. The property-driven equivalent is
`spring.flyway.target: "43"` on a dedicated profile — which works, and carries the risk in the gotchas
below.

⚠️ **Seed through `@Sql` or a plain `JdbcTemplate`, never through JPA repositories.** The entities
describe the *post*-migration schema, and half the point is that the database is not in that state
yet. Using a repository either fails on a column that does not exist, or — in a slice where Hibernate
is allowed to build the schema ([11c](11c-the-slice-that-skips-your-migrations.md)) — quietly moves the
database forward and destroys the premise.

⚠️ The Testcontainers JDBC URL form has its own hook for the same job:
`?TC_INITSCRIPT=fixtures/pre_v44.sql` runs a script before anything else connects
([11b2](11b2-making-it-fast.md)). It is neat and it is also a way to accidentally create objects that
`V1` then fails to create.

## What else is worth staging this way

The technique generalises to every migration whose behaviour depends on pre-existing rows, which is
most of the ones this topic warned about:

| Migration | What only pre-existing rows can show |
|---|---|
| A backfill ([10](10-data-migrations.md)) | That the predicate spares rows that are already correct |
| `ADD CONSTRAINT … NOT VALID` + `VALIDATE` ([10c3](10c3-what-the-migration-keeps.md)) | That validation actually fails when a row violates it |
| A `SET NOT NULL` | That it fails on a null, rather than trivially succeeding |
| A unique index added to existing data | That duplicates are rejected rather than absent |
| A type conversion (`text` → `numeric`) | That the existing values actually cast |
| A repeatable seed migration ([05b](05b-what-belongs-in-a-repeatable-migration.md)) | That re-applying it over existing rows does not duplicate them |

🔴 **The most valuable of these is the negative test.** A migration that adds a constraint should have
a test that seeds a *violating* row and asserts the migration fails. That is the only way to know the
constraint expresses what you think it does — and it is the exact rehearsal of the production failure
[10c3](10c3-what-the-migration-keeps.md) is relying on to catch an incomplete backfill.

## What not to assert

**Not the DDL text.** Asserting that `information_schema.columns` contains exactly your column list
duplicates the entity mapping in a third place and breaks on every legitimate change. `ddl-auto:
validate` already performs that comparison, maintained by somebody else.

**Not the contents of `flyway_schema_history`.** Row counts, `installed_rank` and `installed_by` are
implementation detail; they change when you add a migration, and
[09b](09b-what-the-lock-actually-covers.md) already showed `installed_by` is not what people assume.
`info()` is the supported view of the same information.

**Not timings.** The container has no production data and Testcontainers starts PostgreSQL with
`fsync=off` ([11b](11b-wiring-the-container.md)). Any duration measured there is a measurement of the
container, and the argument this topic makes about duration
([08b4](08b4-how-long-is-too-long.md)) needs production's row count instead.

**Not business behaviour.** The migrations test is the slowest test in the suite and the one whose
failure is most alarming. Every unrelated assertion added to it raises the odds of it being marked
`@Disabled` on a bad afternoon.

## Gotchas

**★ A backfill migration matches zero rows on an empty database and reports success.** The from-empty
test cannot exercise a data migration at all. If you have data migrations and no `target`-staged test,
they are untested regardless of how green the build is.

**★ Seeding after all migrations have run tests nothing about the backfill.** The rows have to exist in
the schema as it was *before* the migration under test, which is the entire reason `target` is in the
test.

**★ Assert the rows the migration should have left alone, not only the ones it should have changed.**
A backfill without its `WHERE … IS NULL` predicate passes a test that only checks the null row — and
that predicate is the resumability contract the whole batching design rests on.

**★ Seed with `@Sql` or `JdbcTemplate`, never with repositories.** Your entities describe the schema
*after* the migration; using them to build the *before* state either fails on a missing column or
quietly forces the schema forward.

**★ `spring.flyway.target` defaults to `"latest"`, and leaving it set in a shared profile is a live
outage.** A `target` inherited by a real environment stops later migrations applying and the
application starts perfectly, having skipped them — the silent failure
[11d](11d-what-the-test-should-assert.md)'s `info().pending()` assertion exists to catch.

**★ Prefer a programmatic `Flyway` instance over a `target` property for this test.** The property form
is one careless profile include away from production; a `Flyway.configure()…target("43")` built inside
the test method cannot escape it.

**★ Version strings in `target` are version strings, not file names.** `target("43")` refers to
`V43`, whatever its description; if your versions are timestamps ([02c](02c-choosing-version-numbers.md))
the value is the timestamp, and a test hard-coding it needs updating whenever the neighbouring
migrations move.

**★ The staged test needs its own container.** It deliberately puts the database in a half-migrated
state, so sharing a container or a context with the from-empty test contaminates both. This is one of
the few places where paying for a second container start is correct.

**★ A test that seeds a violating row and expects the migration to fail is the most valuable one you
can write for a constraint** — and it is the one nobody writes, because a passing test that asserts a
failure feels backwards.

**★ Do not assert on `flyway_schema_history` rows.** `installed_rank`, `installed_by` and the row count
are implementation detail that changes every time somebody adds a migration. `info()` is the supported
view.

**★ Never measure a migration's cost in the container.** No production data, and `fsync=off`. Any
number you get describes the container.

**★ A `target`-staged test does not prove the migration is *safe*, only that it is correct.** The lock
level, the duration and the concurrent workload are all still absent
([11](11-testing-migrations.md)), which is why the review in
[12 · The checklist](12-the-checklist.md) is not redundant with the test.

## Interview questions

**★ How do you test a data migration when the test database is empty?**
Stage it. Migrate to the version immediately before the one under test using `target`, insert rows in
that pre-migration shape with plain SQL, then migrate to latest and assert on the rows. The important
part is the second assertion: check that a row which already had the correct value was left alone, not
just that the null row was filled in. That is what tests the `WHERE … IS NULL` predicate, and a
backfill missing it passes a one-row test.

**★ Why seed with `JdbcTemplate` rather than your repositories?**
Because the entities describe the schema *after* the migration under test, and the database is
deliberately in the state before it. Using the repositories either fails on a column that does not
exist yet or, in a slice that lets Hibernate build the schema, quietly moves the database forward and
destroys the premise of the test.

**★ Would you set `spring.flyway.target` in a properties file for this?**
Only in a profile nothing else can load, and preferably not at all. `target` defaults to `latest`, and
a stray `target` inherited by a real environment stops migrations applying while the application
starts perfectly — a schema older than the code, with no error anywhere. Building the staged `Flyway`
instance inside the test method keeps the setting where it cannot escape.

**★ What is the most valuable test you can write for a migration that adds a constraint?**
The negative one: seed a row that violates it, run the migration, assert that it fails. That is the
only way to know the constraint expresses what you think it does, and it is a direct rehearsal of the
production behaviour you are relying on — the `VALIDATE CONSTRAINT` that fails the deployment when a
backfill missed rows. It is also the test nobody writes, because asserting a failure feels backwards.

**★ What should the migrations test deliberately not assert?**
The DDL text — `ddl-auto: validate` already compares the schema to the mappings, and hand-written
`information_schema` assertions are a third copy of the same facts that breaks on every legitimate
change. The contents of `flyway_schema_history` — implementation detail, with `info()` as the
supported view. Timings — the container has no production data and runs with `fsync=off`. And business
behaviour, which belongs in tests that do not pay for a container start.

**★ Your `target`-staged test passes. Is the migration safe to deploy?**
No — it is *correct*, which is a different claim. The test proves the statement does the right thing
to the right rows. It says nothing about how long it takes against ninety million of them, what lock
it holds while it does, what queues behind that lock, or what happens to the other nine pods waiting
on Flyway's advisory lock. Those are review questions, not test questions, which is why the checklist
exists alongside the suite.

{/* FOOTER */}
