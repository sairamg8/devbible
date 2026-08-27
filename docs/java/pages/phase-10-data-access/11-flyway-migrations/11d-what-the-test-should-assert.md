---
title: "The strongest assertion in a migrations test is one you never write — if Flyway builds the schema from empty and ddl-auto is validate, the context refusing to refresh is the test — and the two assertions worth adding to it are Flyway's own opinion of the history and the proof that a second migrate() does nothing"
sidebar_label: "11d · What the test should assert"
sidebar_position: 41
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against Flyway 12's *validate* command
> ([documentation.red-gate.com](https://documentation.red-gate.com/flyway/reference/commands/validate)),
> Flyway 12's `MigrateResult` and `MigrationInfoService`
> ([github.com/flyway/flyway](https://github.com/flyway/flyway)),
> and Spring Boot 4.1's `FlywayProperties`
> ([github.com/spring-projects/spring-boot](https://github.com/spring-projects/spring-boot/tree/main/module/spring-boot-flyway)).
> JDK 25, Spring Boot 4.1.0, Flyway 12.4.0, PostgreSQL 18.

**The database is real ([11b](11b-wiring-the-container.md)), the slice is not silently skipping the
migrations ([11c](11c-the-slice-that-skips-your-migrations.md)), and now the test needs a body. Most
of what it should assert is already asserted by the context refreshing, which is why the useful
version of this test is short. This chunk is the three assertions about the schema's construction, in
order of how much they buy. [11d2](11d2-testing-a-data-migration.md) is the one thing none of them
touch — what a data migration did to rows that existed before it — and what the test should
deliberately not assert.**

## Assertion 1 · The context refreshes, with `validate` on

```yaml
# src/test/resources/application-migrationtest.yml
spring:
  jpa:
    hibernate:
      ddl-auto: validate
```

```java
@SpringBootTest
@ActiveProfiles("migrationtest")
@Import(ContainerConfig.class)
class MigrationsBuildAValidSchemaTests {

    @Test
    void contextLoads() {
    }
}
```

That is not a placeholder test. [07 · Boot integration](07-boot-integration.md) established the
ordering — Flyway's initializer runs before the `EntityManagerFactory` is created, guaranteed by
`@DependsOnDatabaseInitialization` — and [07b](07b-validate-not-update.md) established what the two
halves each check. So an empty `@Test` here asserts:

- every migration file parsed and executed against PostgreSQL, in order, from empty;
- no two migrations claim the same version, and no version is missing;
- the resulting schema contains every table, column and type the entity mappings expect.

🔴 **The value comes entirely from `ddl-auto: validate`.** Without it the test proves the SQL runs and
says nothing about whether the schema is the one the application needs — which is the interesting
half, because a migration that runs successfully and produces the wrong column is a normal Tuesday.

⚠️ Use a profile rather than editing the main `application.yml`. Whether production runs `validate` is
a separate decision ([07b](07b-validate-not-update.md) argues for it), and this test should not depend
on that argument having been won.

## Assertion 2 · Flyway's own opinion

Inject the `Flyway` bean and ask it. This is a second opinion from a different mechanism, and it
catches things Hibernate structurally cannot.

```java
@Autowired Flyway flyway;

@Test
void flywayAgreesWithTheFiles() {
    flyway.validate();                                  // throws on disagreement
    assertThat(flyway.info().pending()).isEmpty();
    assertThat(flyway.info().applied()).isNotEmpty();
}
```

What `validate` covers, from Flyway's reference — it *"Validates the applied migrations against the
available ones"* and fails if:

> *"differences in migration names, types or checksums are found"* … *"versions have been applied that
> aren't resolved locally anymore"* … *"versions have been resolved that haven't been applied yet"*

⚠️ **On a from-empty run this is nearly tautological**, because the history table was written by this
run from these files. Its value is different: it is the same call Boot makes at startup with
`validate-on-migrate` (declared `true` by default in `FlywayProperties`), so a test that runs it is a
rehearsal of the check that will run in production — and `info().pending()` being empty catches the
specific, common mistake of a migration that Flyway *resolved* but chose not to apply.

🔴 **A non-empty `pending()` is the interesting failure, and it is silent everywhere else.** A
`target` left set in a shared profile, a `baselineVersion` sitting above a migration, a version below
an applied baseline ([04c](04c-where-the-comparison-does-not-run.md)) — each of these produces an
application that starts perfectly against a schema older than the code expects. Nothing else in the
test complains, because Hibernate's validation only checks what the mappings mention.

`MigrationInfoService` exposes `all()`, `current()`, `pending()` and `applied()`, which is the whole
supported vocabulary for this and the one [03c](03c-reading-the-history.md) explained in detail.

## Assertion 3 · A second `migrate()` does nothing

```java
@Test
void migrateIsIdempotent() {
    MigrateResult result = flyway.migrate();
    assertThat(result.migrationsExecuted).isZero();
    assertThat(result.success).isTrue();
}
```

`MigrateResult` exposes `migrationsExecuted` and `success` as public fields. On a schema Boot has
already migrated, a second `migrate()` must apply nothing — that is precisely the property that makes
it safe for ten pods to call it at once ([09](09-many-instances-one-database.md)), and the reason the
losing instances can find nothing pending and carry on.

🔴 **This assertion catches one specific bug and it is a nasty one: a repeatable migration whose
checksum is not stable.** An `R__` file re-runs whenever its checksum changes
([05](05-repeatable-migrations.md)), and a placeholder that resolves differently between runs, or a
file rewritten by a build step, makes the checksum move. The symptom in production is a repeatable
migration re-applying on every single deployment, forever; the symptom here is `migrationsExecuted`
coming back as one.

⚠️ It does **not** prove that a repeatable migration is *re-runnable*. Flyway skips it because the
checksum is unchanged, which is the opposite of exercising it. Proving an `R__` survives a second
application means executing its statements twice deliberately — read the file and run it through a
`JdbcTemplate`, or apply it against a second schema — and it is worth doing for exactly the constructs
[05c](05c-what-does-not-belong.md) lists as not belonging in one.

## Gotchas

**★ Without `ddl-auto: validate` the migrations test proves only that the SQL ran.** A migration that
executes cleanly and produces a column the mapping does not expect is the exact failure this test
exists to catch, and it is invisible unless Hibernate is checking.

**★ Set `validate` through a test profile, not the main configuration.** Otherwise the test's
correctness depends on a production configuration decision, and somebody turning `ddl-auto` off in
`application.yml` silently guts the test without touching a test file.

**★ An empty `@Test` method looks like a mistake and is not.** Reviewers delete it, or "improve" it by
adding assertions that duplicate the entity mappings. A comment naming what the context refresh is
proving is worth the two lines.

**★ `flyway.validate()` on a from-empty run is close to tautological.** The history it validates was
written moments ago from the files it validates against. Its real value is as a rehearsal of the
startup check and as a home for the `info().pending()` assertion.

**★ `info().pending()` being non-empty is the interesting failure.** It means Flyway resolved a
migration and did not apply it, the context still refreshed, and the application is running against a
schema older than the code. The first symptom in production is a missing column at runtime.

**★ Hibernate's validation will not catch a skipped migration whose columns nothing maps.** An index,
a constraint, a trigger or a table used only by reporting can go unapplied and the context still
refreshes. `info().pending()` is the only assertion covering that.

**★ A second `migrate()` returning `migrationsExecuted > 0` almost always means an unstable
repeatable-migration checksum.** A placeholder that resolves differently per run, or a file a build
step rewrites, makes the checksum move and the `R__` re-applies on every deployment.

**★ Re-running `migrate()` does not test that a repeatable migration is re-runnable.** Flyway skips it
precisely because the checksum is unchanged. Proving re-runnability means executing its statements
twice on purpose.

**★ Asserting `success` alone is close to useless.** `migrate()` throws on failure, so `success` is
true in every case where the assertion runs at all. `migrationsExecuted` is the field carrying the
information.

**★ Do not put business assertions in this test.** It is the slowest test in the suite and the one
whose failure is most alarming; loading it with unrelated coverage makes it slow, flaky and eventually
deleted — taking the only coverage of the migration set with it.

## Interview questions

**★ What is the single most valuable assertion in a migrations test?**
That the application context refreshes with `ddl-auto: validate` against a database the migrations
just built from empty. Because Boot orders Flyway's initializer before the `EntityManagerFactory`, a
context that refreshes proves the files parsed, applied in order, produced a schema, and that the
schema matches every entity mapping. An empty `@Test` method is a real test in that configuration —
and the same test without `validate` is worth very little.

**★ You already have `validate` on. Why also call `flyway.validate()` in the test?**
Because it checks a different pair of things. Hibernate compares the mapping to the live schema;
Flyway compares the migration files to the history table — names, types, checksums, migrations applied
that no longer resolve, migrations resolved that were never applied. On a from-empty run it is nearly
tautological, but it rehearses the check that runs at every production startup, and it is the natural
place to assert that `info().pending()` is empty.

**★ What does a non-empty `pending()` list tell you?**
That Flyway found a migration and deliberately did not apply it — most often a `target` left set in
configuration, a `baselineVersion` sitting above it, or a version below an applied baseline. It is a
particularly nasty class of bug because the application starts perfectly; the schema is simply older
than the code expects, and the first symptom is a missing column at runtime. Hibernate's validation
will not catch it either if the unapplied migration only adds an index or a table nothing maps.

**★ Why assert that a second `migrate()` executes nothing?**
Because that no-op is what makes it safe for every pod in a deployment to call `migrate()` at startup —
the losing instances acquire the lock, find nothing pending and continue. The assertion catches an
unstable repeatable-migration checksum: a placeholder that resolves differently per run, or a file
rewritten by a build step, which in production shows up as an `R__` re-applying on every single
deployment with nobody noticing until it is expensive.

**★ Does that prove your repeatable migrations are idempotent?**
No, and it is important not to think it does. Flyway does not run them a second time precisely because
their checksums have not changed, so nothing was exercised. Proving that an `R__` survives a second
application means executing its statements twice deliberately — through a `JdbcTemplate`, or against a
second schema — and it matters for exactly the constructs
[05c](05c-what-does-not-belong.md) lists as not belonging in a repeatable migration.

**★ A reviewer wants to delete the empty `contextLoads()` test. What do you say?**
That the assertion is the context refreshing, not the method body. With `ddl-auto: validate` and
Flyway ordered before the `EntityManagerFactory`, a refreshed context means every migration parsed and
applied from empty and the resulting schema matched every mapping. Deleting the method deletes the
only test of the migration set; adding assertions to it usually means duplicating the entity mappings
in a third place.

{/* FOOTER */}
