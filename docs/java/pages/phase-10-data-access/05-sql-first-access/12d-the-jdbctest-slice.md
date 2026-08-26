---
title: "`@JdbcTest` gives you a `JdbcClient`, a transaction and an empty database — in Boot 4.1 it no longer imports Flyway, so nothing in the slice builds your schema"
sidebar_label: "12d · The `@JdbcTest` slice"
sidebar_position: 27
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Spring Boot 4.1 `@JdbcTest` javadoc
> ([docs.spring.io/.../jdbc/test/autoconfigure/JdbcTest.html](https://docs.spring.io/spring-boot/api/java/org/springframework/boot/jdbc/test/autoconfigure/JdbcTest.html)),
> the Boot 4.1 appendix *Test Auto-configuration Annotations*
> ([docs.spring.io/spring-boot/appendix/test-auto-configuration/slices.html](https://docs.spring.io/spring-boot/appendix/test-auto-configuration/slices.html))
> compared against the same page for Boot 3.5
> ([docs.spring.io/spring-boot/3.5/appendix/.../slices.html](https://docs.spring.io/spring-boot/3.5/appendix/test-auto-configuration/slices.html)),
> and the Spring Framework 7.0 reference *Testing → Executing SQL scripts*
> ([docs.spring.io/.../executing-sql.html](https://docs.spring.io/spring-framework/reference/testing/testcontext-framework/executing-sql.html)).
> JDK 25, Spring Boot 4.1.0, Spring Framework 7.0.8, PostgreSQL 18.

**A repository built the way [chunk 12](12-testing-and-the-shape-of-a-repository.md)
describes is a class with one collaborator, so the only interesting test is the one
that runs its SQL against a database. `@JdbcTest` is the slice for that: it starts a
context with a `DataSource`, a `JdbcTemplate`, a `JdbcClient` and a transaction
manager, skips everything else, and rolls back each test. What it does not do — and
this changed in Boot 4 — is create your schema.**

## What the annotation actually is

The javadoc, verbatim:

> "Annotation for a JDBC test that focuses **only** on JDBC-based components.
>
> Using this annotation only enables auto-configuration that is relevant to JDBC
> tests. Similarly, component scanning is configured to skip regular components and
> configuration properties.
>
> By default, tests annotated with `@JdbcTest` are transactional and roll back at the
> end of each test. They also use an embedded in-memory database (replacing any
> explicit or usually auto-configured `DataSource`). The `@AutoConfigureTestDatabase`
> annotation can be used to override these settings."

It lives in `org.springframework.boot.jdbc.test.autoconfigure` — the package moved in
Boot 4, from `org.springframework.boot.test.autoconfigure.jdbc` — and it is composed
of:

```java
@BootstrapWith(JdbcTestContextBootstrapper.class)
@ExtendWith(SpringExtension.class)
@OverrideAutoConfiguration(enabled = false)
@TypeExcludeFilters(JdbcTypeExcludeFilter.class)
@Transactional
@AutoConfigureJdbc
@AutoConfigureTestDatabase
@ImportAutoConfiguration
public @interface JdbcTest
```

Read `@OverrideAutoConfiguration(enabled = false)` together with
`@ImportAutoConfiguration`: general auto-configuration is switched **off**, and then a
named list is switched back on. That list is the slice.

## The list, and the four entries that used to be in it

Boot 4.1's appendix gives `@JdbcTest` exactly these:

```
org.springframework.boot.jdbc.autoconfigure.DataSourceAutoConfiguration
org.springframework.boot.jdbc.autoconfigure.DataSourceTransactionManagerAutoConfiguration
org.springframework.boot.jdbc.autoconfigure.JdbcClientAutoConfiguration
org.springframework.boot.jdbc.autoconfigure.JdbcTemplateAutoConfiguration
org.springframework.boot.transaction.autoconfigure.TransactionAutoConfiguration
org.springframework.boot.transaction.autoconfigure.TransactionManagerCustomizationAutoConfiguration
optional:org.springframework.boot.testcontainers.service.connection.ServiceConnectionAutoConfiguration
org.springframework.boot.jdbc.autoconfigure.DataSourceAutoConfiguration
org.springframework.boot.jdbc.test.autoconfigure.TestDatabaseAutoConfiguration
optional:org.springframework.boot.testcontainers.service.connection.ServiceConnectionAutoConfiguration
```

`DataSourceAutoConfiguration` appears twice because the table concatenates the two
meta-annotations' lists — `@AutoConfigureJdbc` contributes the first block,
`@AutoConfigureTestDatabase` the second. `JdbcClientAutoConfiguration` being there is
worth noting on its own: the slice hands you a `JdbcClient` bean, not just a
`JdbcTemplate`.

🔴 **The same page for Boot 3.5 listed four more:**

```
org.springframework.boot.autoconfigure.cache.CacheAutoConfiguration
org.springframework.boot.autoconfigure.flyway.FlywayAutoConfiguration
org.springframework.boot.autoconfigure.liquibase.LiquibaseAutoConfiguration
org.springframework.boot.autoconfigure.sql.init.SqlInitializationAutoConfiguration
```

So on Boot 4.1 the slice contains **nothing that creates a schema**. Not Flyway, not
Liquibase, not `schema.sql`/`data.sql` initialisation. A `@JdbcTest` that used to run
your migrations and then query the result now runs against an empty database, and the
failure is a "relation does not exist" error from the first query.

⚠️ **I could not find a release-note or migration-guide entry announcing this
removal.** The Boot 4.0 release notes and migration guide do not mention test slices
losing Flyway or Liquibase; the evidence is the appendix itself, which is generated
from the slice definitions. Treat the appendix for **your exact Boot version** as the
authority, and check it rather than trusting this paragraph or anything written about
Boot 3.

## Getting a schema back

Three options, in descending order of how much they resemble production.

**1 · Run the real migrations, by importing the auto-configuration by hand.**

```java
@JdbcTest
@ImportAutoConfiguration(FlywayAutoConfiguration.class)
@Import(OrderQueries.class)
class OrderQueriesTests { … }
```

`FlywayAutoConfiguration` is `org.springframework.boot.flyway.autoconfigure.FlywayAutoConfiguration`
in Boot 4. This is the option to prefer, because the schema under the test is then
the schema the migrations produce — see **Flyway and schema migrations** *(not written
yet)*.

**2 · A schema script, run once per class.**

```java
@JdbcTest
@Import(OrderQueries.class)
@Sql(scripts = "/test-schema.sql", executionPhase = BEFORE_TEST_CLASS)
class OrderQueriesTests { … }
```

`BEFORE_TEST_CLASS` is @since Spring Framework 6.1 and has one property that matters
here: class-level declarations in that phase **cannot be overridden** by a
method-level `@Sql`, which is exactly what you want for a schema. A schema declared in
the default `BEFORE_TEST_METHOD` phase silently stops running for any method that
declares fixtures of its own — the `@SqlMergeMode` trap, covered in
**[The fixture and the real database](../04-spring-transactional/20j-the-fixture-and-the-real-database.md)**.

The cost is a second definition of your schema, which will drift from the migrations.
That drift is precisely the thing [chunk 12i](12i-the-parse-test.md)
argues a test should be catching, so a hand-maintained `test-schema.sql` is a
step backwards unless the project is small.

**3 · A container that arrives pre-migrated** — the Testcontainers JDBC URL's
`TC_INITSCRIPT` parameter, or migrations run against the container once per suite.
[Chunk 12f](12f-the-real-database.md) is about that route.

## Gotchas

**A `@JdbcTest` that passed on Boot 3 and fails on Boot 4 with "relation does not
exist" is this change, not your migrations.** The migrations are fine; the slice
stopped running them. Add `@ImportAutoConfiguration(FlywayAutoConfiguration.class)`
and the test is green again — and note the class moved package, from
`org.springframework.boot.autoconfigure.flyway` to
`org.springframework.boot.flyway.autoconfigure`.

**Importing Flyway back does nothing if the `DataSource` was still replaced.** The
migrations will run — against the embedded in-memory database the slice substituted,
where a PostgreSQL migration using `jsonb`, `gen_random_uuid()` or a `text[]` column
fails on the first file. Restoring migrations and restoring the real engine are two
separate fixes, and doing only the first produces a confusing failure inside Flyway
rather than inside your query.

**The slice list is per-version, so anything you read about it has a shelf life.**
That includes this page. The appendix is generated from the slice definitions, so
`docs.spring.io/spring-boot/<your version>/appendix/test-auto-configuration/slices.html`
is the only source that is right by construction. Two Boot versions apart, the list
differs by four entries.

**`excludeAutoConfiguration` on `@JdbcTest` removes entries from the slice's list, not
from the application's.** Since general auto-configuration is already off, excluding
something the slice does not import has no effect and reads as if it does. To *add*
one back you need `@ImportAutoConfiguration`; there is no property that does it.

**`@Sql` with no `scripts` attribute is not a no-op.** It looks for
`classpath:com/example/MyTest.sql` at class level and
`classpath:com/example/MyTest.testMethod.sql` at method level, and throws
`IllegalStateException` if it cannot find one. A leftover file with the conventional
name runs on every test in the class and nothing in the source says so.

**A method-level `@Sql` silently replaces a class-level one.** Method-level
declarations override class-level ones by default, so a class-level schema script
stops running for exactly the methods that declare fixtures of their own — and the
failure is again "relation does not exist", in some tests and not others.
`@SqlMergeMode(MERGE)` at class level, or put the schema in `BEFORE_TEST_CLASS`, which
cannot be overridden at all.

**Contexts are cached, so a schema script can run twice against the same database.**
Spring reuses an application context across test classes with identical
configuration, and the embedded `DataSource` comes with it. A `BEFORE_TEST_CLASS`
script doing a bare `create table` fails in the second class to use that context.
Make schema scripts idempotent — `create table if not exists`, `drop … if exists`
first — or let migrations own the schema, since a migration tool already tracks what
it has applied.

**A hand-written `test-schema.sql` is a second definition of your schema and it will
drift.** It starts as a copy of the migrations and diverges the first time somebody
adds a column and only runs the application. The tests keep passing against the old
shape, which is the exact failure a repository test exists to catch. If you cannot run
the real migrations, at least generate the test schema from them rather than
maintaining it.

**The `optional:` prefix in the import list is doing real work.**
`optional:…ServiceConnectionAutoConfiguration` means the entry applies only when that
class is on the classpath — so the same slice works with and without the Testcontainers
support module. It also means that forgetting the `spring-boot-testcontainers`
dependency does not produce an error: `@ServiceConnection` simply has nothing to
process, and the test quietly runs against the replaced embedded database.

**`@JdbcTest` is `@Transactional`, so every test method gets a transaction whether it
wants one or not.** A test that deliberately needs two connections, or needs its
fixture visible to a second one, is fighting the annotation rather than using it. That
is what `@Commit`, `TestTransaction` and an `ISOLATED` `@Sql` fixture exist for
([chunk 12e](12e-wiring-the-test.md)), and reaching for them is a signal to check
whether the test belongs in this slice at all.

**`@JdbcTest` gives you a `JdbcClient`, which older advice will tell you it does
not.** `JdbcClientAutoConfiguration` is in the slice list, so the fluent API is
injectable in the test itself — useful for arranging fixtures without a second
template. `JdbcClient` arrived in Spring Framework 6.1, so anything written for an
earlier line assumes `JdbcTemplate` only.

## Interview questions

**★ What does `@JdbcTest` give you?**
A minimal application context with a `DataSource`, `JdbcTemplate`,
`NamedParameterJdbcTemplate`, `JdbcClient` and a `DataSourceTransactionManager` — and
nothing else. General auto-configuration is disabled by
`@OverrideAutoConfiguration(enabled = false)` and a fixed list is re-enabled through
`@ImportAutoConfiguration`, so there is no web layer, no JPA, no security and none of
your application beans. Component scanning is filtered to skip regular components.
Each test method runs in a transaction that rolls back at the end. And the
`DataSource` is replaced with an embedded one unless the annotation says otherwise.

**★ Does `@JdbcTest` run your Flyway migrations?**
On Boot 3 it did — `FlywayAutoConfiguration` was in the slice's import list, along
with Liquibase, `spring.sql.init` and caching. On Boot 4.1 none of those four are
there, so nothing in the slice creates a schema and the first query fails with
"relation does not exist". The fix is
`@ImportAutoConfiguration(FlywayAutoConfiguration.class)`, which is also the right
answer on principle: the schema the test runs against should be the one the migrations
produce rather than a second definition that drifts. I would check the appendix for
the exact Boot version rather than trusting memory, because this is a list that has
changed and most of what is written about it predates the change.

**★ What is `@OverrideAutoConfiguration(enabled = false)` doing on the annotation?**
It turns Spring Boot's normal auto-configuration off entirely, so that the slice can
switch on a specific list instead. That is the mechanism behind every test slice, and
it explains both why a slice test starts fast and why things you expected to be there
are missing. It also explains the shape of the two escape hatches:
`excludeAutoConfiguration` prunes the slice's own list, and adding something back
requires `@ImportAutoConfiguration` rather than a property, because there is no
enabled-by-default set left to influence.

**★ How would you get a real schema into a `@JdbcTest`?**
In order of preference: import `FlywayAutoConfiguration` so the actual migrations run;
or declare a schema script with `@Sql(executionPhase = BEFORE_TEST_CLASS)`, which
class-level cannot be overridden by a method-level `@Sql`; or have the database arrive
pre-migrated, which in practice means a container. The first is the only one where the
schema under test is guaranteed to be the schema you deploy, and the difference
matters most for exactly the things a SQL-first repository depends on — constraint
names, defaults, generated columns and index definitions.

**★ Why does the appendix list `DataSourceAutoConfiguration` twice?**
Because the table concatenates the lists contributed by each meta-annotation on the
slice, and `@JdbcTest` carries both `@AutoConfigureJdbc` and
`@AutoConfigureTestDatabase`. Each brings in `DataSourceAutoConfiguration`, so it
appears once per block. It is a rendering artefact rather than a duplicate
registration, but it is a useful one — it tells you which half of the slice each
entry belongs to, and therefore what you would lose by replacing one of the two
meta-annotations.

---

← Prev: [12c · Where the SQL lives](12c-where-the-sql-lives.md) · Index: [05 · SQL-first access](README.md) · Next → [12e · Wiring the test](12e-wiring-the-test.md)
