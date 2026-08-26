---
title: "spring.flyway.locations is a list of classpath and filesystem roots, it defaults to one directory nobody configured, and every way of getting it wrong produces a service that starts perfectly having applied nothing"
sidebar_label: "02b · Where they live"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Spring Boot 4.1 how-to *Use a Higher-level Database Migration
> Tool*
> ([docs.spring.io/spring-boot/how-to/data-initialization.html](https://docs.spring.io/spring-boot/how-to/data-initialization.html)),
> Spring Boot 4.1's `FlywayProperties` and `FlywayAutoConfiguration` sources
> ([github.com/spring-projects/spring-boot](https://github.com/spring-projects/spring-boot/blob/main/module/spring-boot-flyway/src/main/java/org/springframework/boot/flyway/autoconfigure/FlywayProperties.java))
> and the Redgate Flyway *PostgreSQL* database reference
> ([documentation.red-gate.com/flyway/reference/database-driver-reference/postgresql-database](https://documentation.red-gate.com/flyway/reference/database-driver-reference/postgresql-database)).
> JDK 25, Spring Boot 4.1.0, Flyway 12.4.0, PostgreSQL 18.

**Boot's default is `classpath:db/migration` and most projects never change it, which is
correct and also means most people never learn what the setting does — until the day a profile,
a `{vendor}` placeholder or a repackaged jar makes it matter. `locations` is a list, each entry
carries a scheme, and a wrong entry is not an error by default.**

## The default, and what it is a default of

`FlywayProperties` declares it as a one-element list:

```java
private List<String> locations = new ArrayList<>(
        Collections.singletonList("classpath:db/migration"));
```

So the conventional layout is:

```
src/main/resources/db/migration/
    V1__create_customers.sql
```

`classpath:db/migration` means *the resource path `db/migration`*, wherever it comes from — the
built classes directory during development, the `BOOT-INF/classes` entry of the fat jar in
production, or a dependency jar that happens to ship that path. It is not a directory on disk,
and confusing it for one is where most of the trouble starts.

## The two schemes

| Prefix | Resolves to | Read at |
|---|---|---|
| `classpath:` | a package/resource path on the classpath | build output or jar |
| `filesystem:` | a real directory on the machine's filesystem | runtime, absolute or relative to the working directory |

Boot's how-to gives the combined form directly:

```properties
spring.flyway.locations=classpath:db/migration,filesystem:/opt/migration
```

`filesystem:` is the escape hatch for migrations that are mounted in rather than packaged — a
Kubernetes ConfigMap volume, an operator-managed directory. It is genuinely useful and it moves
your migrations outside the artefact you tested, which is a trade worth making consciously.

⚠️ **A `filesystem:` path is resolved against the process's working directory when it is
relative.** That is the JVM's working directory, not the project root, not the location of the
jar. In a container it is whatever `WORKDIR` was set to. Use absolute paths.

## `{vendor}`

Boot supports a placeholder in the location, expanded from the detected database:

```yaml
spring:
  flyway:
    locations: "classpath:db/migration/{vendor}"
```

*"Rather than using `db/migration`, the preceding configuration sets the directory to use
according to the type of the database (such as `db/migration/mysql` for MySQL)."* The set of
values comes from Boot's `DatabaseDriver` enum — `postgresql`, `mysql`, `h2`, `oracle`,
`sqlserver` and so on.

```
db/migration/
├── postgresql/
│   └── V1__create_customers.sql
└── h2/
    └── V1__create_customers.sql
```

**This is almost always the wrong tool for the job it gets used for.** The usual motive is
"H2 in tests, PostgreSQL in production", and it means your tests exercise a schema your
production database has never seen — different types, different constraint behaviour, different
error codes. Topic 05 argues the same point about queries in
[12f · Testing against a real database](../05-sql-first-access/12f-the-real-database.md), and
[12g · Testcontainers and @ServiceConnection](../05-sql-first-access/12g-testcontainers-and-serviceconnection.md)
shows the arrangement that removes the motive entirely.

`{vendor}` earns its keep when you genuinely ship one product against several engines. If you
ship against one engine, two directories are two schemas that will drift.

## Adding a location instead of replacing it

`locations` is a list and setting it **replaces** the default. A profile that wants extra
migrations must repeat the default:

```properties
# application-dev.properties
spring.flyway.locations=classpath:/db/migration,classpath:/dev/db/migration
```

Boot's how-to uses exactly this to demonstrate profile-scoped seed data: *"With that setup,
migrations in `dev/db/migration` run only when the `dev` profile is active."*

⚠️ **Profile-scoped migrations put different history into different environments.** The `dev`
database now has versions production will never have. If the two location sets share a version
number, you have two different scripts claiming the same version — and the checksum only
disagrees on a database that has seen both. Keep profile-scoped migrations in a version range
nothing else uses, or better, make them repeatable `R__` seed scripts with no version at all.

## Test-only migrations

The same mechanism, without any configuration:

```
src/test/resources/db/migration/
    V900__test_reference_data.sql
```

*"you can place test-specific migrations in `src/test/resources` and they are run only when
your application starts for testing"* — because `src/test/resources` is on the test classpath
and not on the main one, so `classpath:db/migration` resolves to the union during a test run.

That union is the subtle part: **the test run sees both directories merged into one logical
location**, which is why the version numbers must not collide. `V900` upward as a reserved test
band is a convention worth adopting.

## Callbacks live in their own list

Boot 4.1 separates them:

```java
/**
 * Locations of callbacks. Can contain the special "{vendor}" placeholder to use
 * vendor-specific callbacks. Unprefixed locations or locations starting with
 * "classpath:" point to a package on the classpath and may contain both SQL and
 * Java-based callbacks. Locations starting with "filesystem:" point to a directory on
 * the filesystem, may only contain SQL callbacks.
 */
private List<String> callbackLocations = new ArrayList<>();
```

`spring.flyway.callback-locations` defaults to empty. Note the asymmetry the javadoc states
outright: a `filesystem:` callback location *"may only contain SQL callbacks"*, because a Java
callback has to be on the classpath to be loaded at all. Java callbacks are also picked up as
beans — *"To use Java-based callbacks, create one or more beans that implement `Callback`. Any
such beans are automatically registered"*, ordered with `@Order`.

## The silence, and the two settings that end it

Both of the following are `false` by default in Boot, and each of them turns a mistake into
nothing at all:

```yaml
spring:
  flyway:
    fail-on-missing-locations: true     # a location that does not exist is an error
    validate-migration-naming: true     # a file that does not parse is an error
```

`fail-on-missing-locations` is the one this page is about. Its javadoc: *"Whether to fail if a
location of migration scripts doesn't exist."* With it off — the default — a typo in
`spring.flyway.locations`, a directory that was renamed, or a profile that dropped the default
entry all produce a perfectly healthy startup that applied zero migrations.

⚠️ **The `{vendor}` placeholder and `fail-on-missing-locations: true` interact badly if you are
careless.** Turning the check on means every vendor directory named by an active configuration
must exist. That is usually what you want; it is occasionally a surprise on a new engine.

## Packaging: the jar, and the native image

**In a fat jar**, `classpath:db/migration` resolves inside `BOOT-INF/classes/db/migration`.
Flyway's classpath scanner handles that; this is the normal case and it works. What does *not*
work is a `filesystem:` location pointing at `src/main/resources` — correct on a developer
machine, meaningless in the container.

**In a GraalVM native image**, classpath scanning is not available at run time, because there is
no classpath left to scan. Boot's Flyway auto-configuration ships a `NativeImageResourceProvider`
and a `FlywayAutoConfigurationRuntimeHints` registrar for exactly this reason: the migration
resources are enumerated at build time and registered as resources so the image can read them.
It is handled for you, but it explains why "just point Flyway at a directory" stops being a
neutral choice when native images are on the roadmap.

## The dependency, again, because it belongs here

PostgreSQL support is *"a separate dependency for Flyway"* — `org.flywaydb:flyway-database-postgresql`.
Without it, Flyway may start against a PostgreSQL URL and fail to recognise the database, and
the PostgreSQL-specific configuration extension is not registered at all. Boot's
`FlywayAutoConfiguration` gates its PostgreSQL customiser on the class being present:

```java
@ConditionalOnClass(name = "org.flywaydb.database.postgresql.PostgreSQLConfigurationExtension")
@Configuration(proxyBeanMethods = false)
static class PostgresqlConfiguration { … }
```

So `spring.flyway.postgresql.transactional-lock` — which
[09 · Many instances, one database](09-many-instances-one-database.md) needs — is silently inert
if the module is missing. The property binds; nothing consumes it.

## Gotchas

**★ Setting `locations` replaces the default rather than adding to it.** A profile that adds a
seed directory and forgets `classpath:db/migration` has just switched off every real migration.

**★ A location that does not exist is not an error by default.** `fail-on-missing-locations` is
`false`, so a typo yields a clean startup with nothing applied.

**★ `classpath:` is not a directory.** It is a resource path resolved against everything on the
classpath, including dependency jars. A library that happens to ship `db/migration` contributes
its files to yours.

**★ A relative `filesystem:` path depends on the process working directory.** It will be right
on your machine and wrong in the container, and the failure is silent for the reason above.

**★ `src/test/resources/db/migration` merges with the main directory during tests.** Useful,
and a duplicate-version conflict waiting to happen. Reserve a version band for test data.

**★ `{vendor}` to run H2 in tests and PostgreSQL in production means you test a schema you do
not ship.** Two directories, two dialects, one of which is never exercised where it matters.

**★ Profile-specific locations create environment-specific history.** The `dev` database now
has versions production will never have; a later collision on a version number is invisible
until a database has seen both scripts.

**★ A `filesystem:` callback location can hold SQL callbacks only.** Java callbacks must be on
the classpath, or beans. The javadoc says so; the failure is a callback that never fires.

**★ `spring.flyway.postgresql.*` binds even without `flyway-database-postgresql` on the
classpath.** The property is accepted and does nothing, because the customiser that consumes it
is conditional on the extension class.

**★ `filesystem:` locations move migrations outside the artefact you tested.** A ConfigMap can
be edited after the image was built and verified. That is sometimes the point and always a
risk.

## Interview questions

**★ Where does Flyway look for migrations in a Spring Boot application by default?**
`classpath:db/migration`, which in a standard layout is `src/main/resources/db/migration`. It
is a single-entry list, and setting `spring.flyway.locations` replaces it rather than appending
to it.

**★ What is the difference between `classpath:` and `filesystem:`?**
`classpath:` is a resource path resolved against everything on the classpath, including inside
the fat jar; `filesystem:` is a real directory on the running machine, resolved relative to the
process working directory when it is not absolute.

**★ What does `{vendor}` do and when would you use it?**
It expands to the detected database type — `db/migration/{vendor}` becomes
`db/migration/postgresql` — so one artefact can carry per-engine migrations. Use it when you
genuinely ship against several engines; do not use it to run H2 in tests, because then you are
validating a schema you never deploy.

**★ How do you add migrations that only run in one profile?**
Set `spring.flyway.locations` in that profile's properties, listing the default *and* the extra
directory. Be aware that you have now created environment-specific migration history, so keep
the version numbers in a range nothing else uses.

**★ Why might Flyway start cleanly and apply nothing?**
Three ways, all silent by default: the location does not exist (`fail-on-missing-locations` is
`false`), the file names do not parse (`validate-migration-naming` is `false`), or every
migration in the location has already been applied. Turn the first two settings on and the
ambiguity disappears.

**★ Where do test-only migrations go?**
`src/test/resources/db/migration`. The test classpath includes both source sets, so Flyway sees
the union — which is why test versions must not collide with real ones.

**★ Why does a native image need special handling for migrations?**
Because there is no classpath to scan at run time. Boot registers the migration resources as
build-time hints and supplies a `NativeImageResourceProvider` so Flyway can enumerate them
without scanning.

**★ You set `spring.flyway.postgresql.transactional-lock: false` and nothing changed. Why?**
Most likely `flyway-database-postgresql` is not on the classpath. Boot's PostgreSQL customiser
is `@ConditionalOnClass` on the extension class, so without the module the property binds
successfully and is never read.

<!--FOOTER-->
