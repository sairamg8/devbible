---
title: "@DataJpaTest does not import Flyway's auto-configuration at all, so in the slice most teams reach for first the migrations never run and Hibernate builds the schema from your entity classes instead — which means the test asserting that the mapping matches the schema is checking Hibernate's output against Hibernate"
sidebar_label: "11c · The slice that skips your migrations"
sidebar_position: 40
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against Spring Boot 4.1's *Testing* reference
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/testing/spring-boot-applications.html)),
> the *Test Slices* appendix
> ([docs.spring.io](https://docs.spring.io/spring-boot/appendix/test-auto-configuration/slices.html)),
> the *Database Initialization* how-to
> ([docs.spring.io](https://docs.spring.io/spring-boot/how-to/data-initialization.html)),
> `AutoConfigureTestDatabase` and `AutoConfigureTestDatabase.Replace` javadoc
> ([docs.spring.io](https://docs.spring.io/spring-boot/api/java/org/springframework/boot/jdbc/test/autoconfigure/AutoConfigureTestDatabase.html)),
> and the `DataJpaTest`, `AutoConfigureDataJpa.imports` and `FlywayAutoConfiguration` sources
> ([github.com/spring-projects/spring-boot](https://github.com/spring-projects/spring-boot)).
> JDK 25, Spring Boot 4.1.0, Flyway 12.4.0, PostgreSQL 18.

**You have a container ([11b](11b-wiring-the-container.md)) and you want a fast, focused test of the
repositories against a real schema, so you reach for `@DataJpaTest`. The slice is doing two things
you did not ask for and one thing it does not tell you about: it swaps your `DataSource`, and it does
not import Flyway's auto-configuration at all. The consequence is a green test suite in which no
migration has ever run and the schema was invented by Hibernate from the entity classes — which makes
`ddl-auto: validate` a comparison of Hibernate against Hibernate. This chunk is the mechanism, and
the two ways out.**

## What `@DataJpaTest` is composed of

The annotation carries, among others, `@AutoConfigureDataJpa`, `@AutoConfigureJdbc`,
`@AutoConfigureTestDatabase`, `@AutoConfigureTestEntityManager`, `@Transactional` and
`@OverrideAutoConfiguration(enabled = false)`. That last one is the important structural fact: **the
slice starts from nothing and adds back a named list.** The list behind `@AutoConfigureDataJpa` is
two entries:

```
org.springframework.boot.data.jpa.autoconfigure.DataJpaRepositoriesAutoConfiguration
org.springframework.boot.hibernate.autoconfigure.HibernateJpaAutoConfiguration
```

and `@AutoConfigureJdbc` adds the `DataSource`, the transaction manager, `JdbcTemplate`,
`JdbcClient` and — optionally — the Testcontainers service-connection auto-configuration.

🔴 **`FlywayAutoConfiguration` is on neither list.** It is not disabled, not conditional-ed out, not
failing silently — it is simply not imported, so no `Flyway` bean, no `FlywayMigrationInitializer`,
and nothing ever calls `migrate()`.

## Then Hibernate quietly fills the gap

Boot's reference describes the slice's database behaviour:

> *"By default, it scans for `@Entity` classes and configures Spring Data JPA repositories. If an
> embedded database is available on the classpath, it configures one as well."*

and the how-to explains what Hibernate then does with it:

> *"Spring Boot chooses a default value for you based on whether you are using an embedded database.
> An embedded database is identified by looking at the `Connection` type and JDBC url. `hsqldb`,
> `h2`, or `derby` (deprecated) are embedded databases and others are not. If an embedded database is
> identified and no schema manager (Flyway or Liquibase) has been detected, `ddl-auto` defaults to
> `create-drop`. In all other cases, it defaults to `none`."*

The phrase *"no schema manager … has been detected"* is a bean check, and the bean it looks for is
`FlywaySchemaManagementProvider`, contributed by `FlywayAutoConfiguration`. The slice does not import
that auto-configuration, so the provider does not exist, so no schema manager is detected.

Put the three facts together and the default `@DataJpaTest` with H2 on the test classpath behaves
like this:

| Step | What happens |
|---|---|
| `@AutoConfigureTestDatabase` replaces the `DataSource` | H2, in memory |
| `FlywayAutoConfiguration` is not imported | No migrations run, ever |
| No `FlywaySchemaManagementProvider` bean exists | No schema manager detected |
| Embedded database + no schema manager | `ddl-auto` defaults to `create-drop` |
| Hibernate builds the schema from `@Entity` | The test passes |

🔴 **The schema under test was generated from the mappings, so it agrees with the mappings by
construction.** Every drift the loop in [07b](07b-validate-not-update.md) exists to catch — a column
a migration forgot, a type a migration got wrong, an index nobody added — is invisible, because the
migrations were not involved.

## And with a real container, it fails differently

Point the same slice at a Testcontainers PostgreSQL and the picture changes but does not improve:
PostgreSQL is not an embedded database, so `ddl-auto` defaults to `none`, and Flyway is still not
imported. Nothing builds the schema at all, and the first repository call fails on a missing relation.
That failure is at least honest, which is more than the H2 version manages.

## `@AutoConfigureTestDatabase`, and the advice that is now out of date

The javadoc is precise about what the annotation is:

> *"Annotation that can be applied to a test class to configure a test database to use instead of the
> application-defined or auto-configured `DataSource`. In the case of multiple `DataSource` beans,
> only the `@Primary` `DataSource` is considered."*

Every tutorial written before Boot 3.4 tells you to add `@AutoConfigureTestDatabase(replace = NONE)`
next to your container. Read the current default first — `replace` defaults to **`NON_TEST`**, and
`NON_TEST` is documented as:

> *"Replace the `DataSource` bean unless it is auto-configured and connecting to a test database. The
> following types of connections are considered test databases: Any bean definition that includes
> `ContainerImageMetadata` (including `@ServiceConnection` annotated Testcontainers databases, and
> connections created using Docker Compose); Any connection configured using a
> `spring.datasource.url` backed by a `@DynamicPropertySource`; Any connection configured using a
> `spring.datasource.url` with the Testcontainers JDBC syntax."*

🔴 **So on Boot 4.1 a `@ServiceConnection` container, a `@DynamicPropertySource` URL and a `jdbc:tc:`
URL are all already exempt.** Adding `replace = NONE` alongside any of the three changes nothing, and
copying it from an old article is how people conclude that "the annotation fixed it" when the real
change was something else in the same commit.

The four values, and when each is the right answer:

| `Replace` | Meaning | Use when |
|---|---|---|
| `NON_TEST` (default) | Replace unless it is auto-configured *and* connecting to a recognised test database | Almost always |
| `NONE` | Never replace | A `spring.datasource.url` pointing at a real database that Boot cannot recognise as a test one |
| `AUTO_CONFIGURED` | Replace only if auto-configured | You define the `DataSource` yourself and want it kept |
| `ANY` | Replace whatever is there | You want the embedded database unconditionally |

⚠️ **Not replacing the `DataSource` still does not run your migrations.** The two mechanisms are
independent: `@AutoConfigureTestDatabase` decides *which database*, and the imported
auto-configuration list decides *whether Flyway exists*. Fixing the first and expecting the second is
the second-most-common version of this mistake.

## The two ways out

### Add Flyway's auto-configuration to the slice

Boot documents the general mechanism:

> *"Each slice provides one or more `@AutoConfigure…` annotations that namely defines the
> auto-configurations that should be included as part of a slice. Additional auto-configurations can
> be added on a test-by-test basis by creating a custom `@AutoConfigure…` annotation or by adding
> `@ImportAutoConfiguration` to the test."*

```java
@DataJpaTest
@ImportAutoConfiguration(FlywayAutoConfiguration.class)
@Import(ContainerConfig.class)
class CustomerRepositoryTests {
    // schema built by the migrations, against PostgreSQL
}
```

There is no `@AutoConfigureFlyway` — `@ImportAutoConfiguration` naming the class is the supported
route, and wrapping it in your own meta-annotation is what Boot suggests when more than one or two
tests need it.

### Or do not use a slice for this test

The migrations-from-empty test of [11](11-testing-migrations.md) is not a repository test. It is a
whole-context test whose subject is startup: Flyway runs, then Hibernate validates, then the context
refreshes. `@SpringBootTest` does that by definition, and trying to reproduce it inside a slice means
re-adding the auto-configurations the slice removed until you have rebuilt `@SpringBootTest` badly.

Use the slice for repository tests, once the schema question is settled. Use `@SpringBootTest` for the
one test whose subject *is* the schema question. Phase 11 owns the general argument about slices
versus full-context tests — **Phase 11 · The test pyramid** *(not written yet)* — and this topic only
needs the boundary.

## Gotchas

**★ `@DataJpaTest` never runs your migrations.** `FlywayAutoConfiguration` is not in the slice's import
list, and the slice starts from `@OverrideAutoConfiguration(enabled = false)`. Nothing warns you;
there is simply no `Flyway` bean.

**★ Hibernate then builds the schema, so the test passes for the wrong reason.** With an embedded
database and no schema manager detected, `ddl-auto` defaults to `create-drop`, and a schema generated
from the mappings agrees with the mappings by construction.

**★ `ddl-auto: validate` cannot fail in that configuration.** You are validating Hibernate's output
against Hibernate's expectations. The drift-detection loop from
[07b](07b-validate-not-update.md) is switched off and looks identical to switched on.

**★ "No schema manager detected" is a bean check, not a classpath check.** Flyway can be on the
classpath, configured, and full of migrations; if `FlywayAutoConfiguration` was not imported, the
`FlywaySchemaManagementProvider` bean does not exist and Boot concludes there is no schema manager.

**★ Pointing the slice at a real PostgreSQL turns silence into a missing-relation error.** PostgreSQL
is not an embedded database, so `ddl-auto` defaults to `none`, and with Flyway absent nothing creates
anything. It is a better failure than the H2 one because it is a failure.

**★ `@AutoConfigureTestDatabase(replace = NONE)` is usually unnecessary on Boot 4.** The default is
`NON_TEST`, and `@ServiceConnection` containers, `@DynamicPropertySource` URLs and Testcontainers JDBC
URLs are all documented as test databases that `NON_TEST` leaves alone.

**★ Copying `replace = NONE` from a pre-3.4 tutorial is harmless and misleading.** It changes nothing
in the common cases, so it survives in codebases as a piece of cargo cult that people are then afraid
to remove.

**★ Keeping the `DataSource` is not the same as running the migrations.** Two independent mechanisms:
one chooses the database, the other decides whether a `Flyway` bean exists. Fixing the first does not
fix the second.

**★ With multiple `DataSource` beans only the `@Primary` one is considered.** The javadoc says so
explicitly, so a second, non-primary `DataSource` is untouched by the annotation regardless of the
`replace` value.

**★ `@DataJpaTest` is transactional and rolls back by default.** That is fine for the repository tests
it is designed for and is another reason it is the wrong tool for asserting a migration's committed
row effects ([11d](11d-what-the-test-should-assert.md)).

**★ There is no `@AutoConfigureFlyway`.** The supported way to add it is `@ImportAutoConfiguration`
naming `FlywayAutoConfiguration`, optionally wrapped in your own meta-annotation.

**★ Rebuilding `@SpringBootTest` out of `@ImportAutoConfiguration` calls is a smell.** If a slice needs
three or four auto-configurations added back, the test's subject is the whole context and it should
say so.

## Interview questions

**★ Does `@DataJpaTest` run your Flyway migrations?**
No. The slice is built on `@OverrideAutoConfiguration(enabled = false)` and adds back a named list of
auto-configurations, and `FlywayAutoConfiguration` is not on it. So there is no `Flyway` bean and no
migration initializer, and nothing ever calls `migrate()`. The test still passes, which is the
problem.

**★ If the migrations never ran, where does the schema come from?**
From Hibernate. Boot picks a `ddl-auto` default based on the database and on whether a schema manager
was detected — and the detection is a check for a `FlywaySchemaManagementProvider` bean, which the
slice did not import. With H2 on the classpath that means an embedded database with no schema manager,
which defaults to `create-drop`, so Hibernate generates the schema from the `@Entity` classes.

**★ Why is that worse than having no test?**
Because of what it does to `ddl-auto: validate`. The whole point of pairing Flyway with Hibernate
validation is that two independent descriptions of the schema have to agree. If Hibernate generated
the schema, it is comparing its own output with its own expectations, so the check cannot fail — and
a check that cannot fail reads exactly like a check that keeps passing.

**★ You point `@DataJpaTest` at a Testcontainers PostgreSQL. What happens?**
The `DataSource` is no longer replaced, because Boot 4's `Replace.NON_TEST` default recognises a
`@ServiceConnection` container as a test database. But Flyway is still not imported, and PostgreSQL is
not an embedded database, so `ddl-auto` defaults to `none` — nothing creates the schema, and the first
repository call fails on a missing relation. It is a clearer failure than the H2 version, and the fix
is the same: import `FlywayAutoConfiguration`, or use `@SpringBootTest`.

**★ Do you still need `@AutoConfigureTestDatabase(replace = NONE)`?**
Usually not. The default is `NON_TEST`, which replaces the `DataSource` only if it is auto-configured
*and* not connecting to something Boot recognises as a test database — and the javadoc lists
`@ServiceConnection` Testcontainers databases, Docker Compose connections, `@DynamicPropertySource`
URLs and Testcontainers JDBC-syntax URLs as exactly that. `replace = NONE` is still the right answer
for a plain `spring.datasource.url` pointing at a real database Boot has no way to classify.

**★ How do you get the migrations to run inside a slice?**
`@ImportAutoConfiguration(FlywayAutoConfiguration.class)` on the test, which is Boot's documented way
of adding auto-configurations to a slice on a test-by-test basis; there is no dedicated
`@AutoConfigureFlyway`. If more than a couple of tests need it, wrap it in your own
`@AutoConfigure…`-style meta-annotation rather than repeating it.

**★ Would you use a slice for the migrations-from-empty test at all?**
No. That test's subject is the startup sequence — Flyway applies the files, Hibernate validates the
result, the context refreshes — and a slice exists precisely to remove most of that. Reproducing it
inside `@DataJpaTest` means adding auto-configurations back until you have rebuilt `@SpringBootTest`
by hand. Slices are for repository tests once the schema question is settled; `@SpringBootTest` is for
the test whose subject is the schema question.

{/* FOOTER */}
