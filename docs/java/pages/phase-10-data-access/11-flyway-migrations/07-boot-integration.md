---
title: "Spring Boot's Flyway auto-configuration is three beans and one ordering guarantee, and the ordering guarantee is the part that matters — it is what makes ddl-auto validate a real assertion rather than a race"
sidebar_label: "07 · Boot integration"
sidebar_position: 19
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against Spring Boot 4.1's `FlywayAutoConfiguration` and `FlywayProperties`
> ([github.com/spring-projects/spring-boot](https://github.com/spring-projects/spring-boot/blob/main/module/spring-boot-flyway/src/main/java/org/springframework/boot/flyway/autoconfigure/FlywayAutoConfiguration.java)),
> the Boot how-to on data initialization
> ([docs.spring.io](https://docs.spring.io/spring-boot/how-to/data-initialization.html)),
> `DatabaseInitializationDependencyConfigurer`
> ([docs.spring.io](https://docs.spring.io/spring-boot/api/java/org/springframework/boot/sql/init/dependency/DatabaseInitializationDependencyConfigurer.html))
> and the Flyway PostgreSQL database reference
> ([documentation.red-gate.com](https://documentation.red-gate.com/flyway/reference/database-driver-reference/postgresql-database)).
> JDK 25, Spring Boot 4.1.1, Flyway 12.4.0, PostgreSQL 18.

**Boot's Flyway integration is small enough to read in an afternoon and it does exactly one
non-obvious thing. Creating a `Flyway` bean and calling `migrate()` at startup is the easy part.
The valuable part is that Boot makes every bean that touches the database wait for that call —
including the `EntityManagerFactory` — which is what turns `ddl-auto: validate` from a race into a
guarantee.**

## The dependency, and the module people forget

> *"In-memory and file-based databases are supported by the `spring-boot-starter-flyway` starter.
> Other cases require also a database-specific module. For example, use
> `org.flywaydb:flyway-database-postgresql` with PostgreSQL."*

Two artifacts, not one:

```xml
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-flyway</artifactId>
</dependency>
<dependency>
  <groupId>org.flywaydb</groupId>
  <artifactId>flyway-database-postgresql</artifactId>
</dependency>
```

⚠️ **The PostgreSQL module is where PostgreSQL-specific behaviour lives** — the transactional-lock
setting, the parser that knows which statements cannot run in a transaction. Omitting it does not
produce a clear "you forgot a dependency" message; it produces an application that starts and then
fails to recognise its own database.

## What the auto-configuration creates

`FlywayAutoConfiguration` is annotated:

```java
@AutoConfiguration(after = DataSourceAutoConfiguration.class)
@ConditionalOnBooleanProperty(name = "spring.flyway.enabled", matchIfMissing = true)
@Import(DatabaseInitializationDependencyConfigurer.class)
```

and contributes three beans:

| Bean | What it is for |
|---|---|
| `Flyway` | the configured instance, built from `FlywayProperties` |
| `FlywayMigrationInitializer` | an `InitializingBean` whose `afterPropertiesSet()` runs the migration |
| `FlywaySchemaManagementProvider` | tells Boot that Flyway is managing this `DataSource`'s schema |

The initializer is the whole of the "run migrations at startup" behaviour, and it is four lines of
intent: call `flyway.migrate()`, or delegate to a `FlywayMigrationStrategy` bean if one exists
([04e](04e-when-repair-is-the-right-answer.md) covers why writing one is usually a mistake).

⚠️ Note `@ConditionalOnBooleanProperty(… matchIfMissing = true)`: **Flyway is on by default the
moment the jar is on the classpath.** `spring.flyway.enabled: false` is the off switch, and it
leaves the `Flyway` bean uncreated rather than merely idle.

## The ordering guarantee, which is the actual feature

Running migrations in a `@PostConstruct` somewhere would create a race: Hibernate's
`EntityManagerFactory` also builds during context refresh, and if it validates the schema before
Flyway has changed it, `ddl-auto: validate` fails on a table the migration was about to create.

Boot solves it with a mechanism worth knowing by name, because it is general:

1. `FlywayMigrationInitializerDatabaseInitializerDetector` identifies the initializer as a
   **database initializer**.
2. `DatabaseInitializationDependencyConfigurer` — imported by the auto-configuration — finds every
   bean annotated `@DependsOnDatabaseInitialization` and adds a `dependsOn` from it to every
   detected initializer.
3. Boot's own `EntityManagerFactory` builder carries that annotation.

The result: **`migrate()` has completed before the `EntityManagerFactory` exists.** Not by
convention, not by bean-name luck — by an explicit `dependsOn` edge inserted into the bean
definitions.

That is what makes the pairing in [07b · Validate, not update](07b-validate-not-update.md) a real
assertion. Hibernate's validation runs against a schema Flyway has already finished with, so a
mismatch is a genuine disagreement between the entities and the migrations rather than a timing
artefact.

⚠️ **`@DependsOnDatabaseInitialization` is available to your own beans too**, and it is the correct
fix for any component that reads the database during startup — a cache warmer, a config loader, a
`@PostConstruct` that counts rows. Without it, such a bean can legitimately run before the
migrations do.

## Where the migrations live

Default location, and the placeholder that is worth knowing about:

```yaml
spring:
  flyway:
    locations:
      - "classpath:db/migration"
      - "classpath:db/migration/{vendor}"
```

> *"You can also add a special `{vendor}` placeholder to use vendor-specific scripts … Rather than
> using `db/migration`, the preceding configuration sets the directory to use according to the type
> of the database."*

`{vendor}` resolves to the database Boot detects — `postgresql`, `h2`, `mysql`. It is the escape
hatch for the one statement that genuinely cannot be written portably, and it is a trap when used
as a general strategy: a project with a full `postgresql/` set and a full `h2/` set is maintaining
two schemas that nothing compares.

⚠️ **A `locations` list replaces the default rather than adding to it.** Setting
`classpath:db/migration/{vendor}` alone means `classpath:db/migration` is no longer scanned.

## Which `DataSource` Flyway uses

By default the `@Primary` one. Two ways to change it, and they behave differently:

- **`@FlywayDataSource`** on a `DataSource` bean makes Flyway use that one. If you are keeping the
  main auto-configured `DataSource` as well, the how-to is explicit that the second bean needs
  `@Bean(defaultCandidate = false)` so it does not become an ambiguous injection candidate.
- **`spring.flyway.url` / `user` / `password`.** *"Setting either `spring.flyway.url` or
  `spring.flyway.user` is sufficient to cause Flyway to use its own `DataSource`. If any of the
  three properties has not been set, the value of its equivalent `spring.datasource` property will
  be used."*

The second is how you run migrations as a **more privileged user** than the application — a real
pattern, because the application rarely needs `CREATE TABLE` and giving it that right permanently
to support five seconds of startup is a poor trade.

⚠️ The partial-fallback rule is the sharp edge: setting only `spring.flyway.user` silently reuses
`spring.datasource.url` and `spring.datasource.password`. A password that does not match the new
user is a connection failure at startup, and the message names the user rather than the mistake.

## Java migrations and callbacks are just beans

> *"Flyway will be auto-configured with any beans that implement `JavaMigration`."*

> *"To use Java-based callbacks, create one or more beans that implement `Callback`. Any such beans
> are automatically registered with `Flyway`. They can be ordered by using `@Order` or by
> implementing `Ordered`."*

Being beans means they can be injected into, which is convenient and is also the thing to be
careful about: a `JavaMigration` that autowires a repository is a migration whose behaviour depends
on application code that will change independently of it. The migration is permanent; the service
it called is not.

⚠️ And remember [04b](04b-the-edits-nothing-catches.md): `BaseJavaMigration.getChecksum()` returns
`null`, so a Java migration's body can be edited with no detection at all.

## Gotchas

**★ `spring-boot-starter-flyway` alone is not enough for PostgreSQL.** The
`org.flywaydb:flyway-database-postgresql` module carries the vendor behaviour, and its absence is
not reported as a missing dependency.

**★ Flyway runs by default once the jar is present.** `@ConditionalOnBooleanProperty(matchIfMissing
= true)` — adding the starter is opting in.

**★ `spring.flyway.enabled: false` removes the bean**, it does not leave an idle one. Anything
injecting `Flyway` fails to start.

**★ The ordering guarantee comes from an explicit `dependsOn` edge**, added by
`DatabaseInitializationDependencyConfigurer` to every `@DependsOnDatabaseInitialization` bean. It
is not bean-name ordering and not luck.

**★ Your own startup components need `@DependsOnDatabaseInitialization`** if they read the database
during context refresh. Without it they may legitimately run before the migrations.

**★ `locations` replaces the default; it does not extend it.** Setting only
`classpath:db/migration/{vendor}` stops `classpath:db/migration` being scanned.

**★ `{vendor}` used as a general strategy means two unverified schemas.** It is for the rare
statement that cannot be written portably, not for maintaining a parallel set.

**★ Setting only `spring.flyway.user` reuses `spring.datasource.url` and `password`.** The
per-property fallback is documented and it produces a confusing authentication failure.

**★ A second `DataSource` bean annotated `@FlywayDataSource` needs `defaultCandidate = false`**, or
it competes with the primary one for every other injection point.

**★ `JavaMigration` and `Callback` beans are picked up automatically**, which is convenient and
means a migration can depend on application code that will not stay still.

**★ Boot's `Flyway` bean does not expose `repair` through any property.** Running it means the CLI,
a build plugin, or a bean you wrote deliberately.

**★ A `FlywayMigrationStrategy` bean replaces the default `migrate()` call entirely.** Whatever it
does is what happens at startup — including nothing, if it is written wrong.

## Interview questions

**★ What does Boot's Flyway auto-configuration actually create?**
A `Flyway` bean built from `spring.flyway.*`, a `FlywayMigrationInitializer` whose
`afterPropertiesSet()` calls `migrate()`, and a `FlywaySchemaManagementProvider` that tells Boot
this `DataSource`'s schema is managed. It is conditional on `spring.flyway.enabled`, defaulting to
on.

**★ How does Boot guarantee migrations run before Hibernate validates the schema?**
`DatabaseInitializationDependencyConfigurer` adds a `dependsOn` from every bean annotated
`@DependsOnDatabaseInitialization` — which includes the `EntityManagerFactory` — to every detected
database initializer, of which the Flyway initializer is one. It is an explicit dependency edge in
the bean definitions.

**★ Why does that ordering matter so much?**
Because it is what makes `ddl-auto: validate` meaningful. Without it, a validation failure could be
a timing artefact; with it, a failure is a genuine disagreement between the entities and the
migrations.

**★ You have a `@PostConstruct` that queries the database and it fails on a fresh environment.
Why, and what is the fix?**
It ran before the migrations. Annotate the bean `@DependsOnDatabaseInitialization` so Boot adds the
same dependency edge it adds for the `EntityManagerFactory`.

**★ What dependencies does a Boot service on PostgreSQL need for Flyway?**
`spring-boot-starter-flyway` plus `org.flywaydb:flyway-database-postgresql`. The vendor module is
separate and carries the PostgreSQL-specific behaviour.

**★ How do you run migrations as a different, more privileged database user?**
Set `spring.flyway.url`, `user` and `password`. Either `url` or `user` alone is enough to make
Flyway build its own `DataSource` — but set all three, because anything left unset silently falls
back to the matching `spring.datasource` property.

**★ What is `{vendor}` for, and when is it a mistake?**
It substitutes the detected database type into a location path, for the rare statement that cannot
be written portably. It is a mistake as a general strategy, because two full sets of migrations
means two schemas that nothing verifies against each other.

**★ Does adding a `locations` entry extend the default?**
No, it replaces it. Listing only `classpath:db/migration/{vendor}` stops the plain
`classpath:db/migration` directory being scanned at all.

**★ How do you write a migration in Java under Boot?**
Implement `JavaMigration` — usually by extending `BaseJavaMigration` — and make it a bean; Boot
registers it automatically. And override `getChecksum()`, because the base implementation returns
`null` and an unchecksummed migration can be edited undetectably.

**★ What are Flyway callbacks in a Boot application?**
Beans implementing `Callback`, registered automatically and orderable with `@Order` or `Ordered`.
They hook lifecycle events such as before and after `migrate`.

**★ How do you turn Flyway off for a particular profile?**
`spring.flyway.enabled: false`. Be aware it removes the bean, so anything injecting `Flyway` will
fail to start rather than quietly doing nothing.

**★ What replaces the default `migrate()` at startup, and why is that risky?**
A `FlywayMigrationStrategy` bean. The initializer delegates to it entirely, so whatever it does is
what happens — which is powerful for a one-off need and dangerous as a permanent fixture, because
it can silently stop migrating or start repairing on every pod.

{/* FOOTER */}
